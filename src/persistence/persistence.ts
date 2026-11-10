import { create } from 'zustand'
import type { GameCore, Result } from '../sim/core'
import { toCore, useGameStore } from '../state/gameStore'
import { useNotifyStore } from '../state/notifyStore'
import { makeSave, parseSave, type SaveFile } from './schema'
import type { SaveStorage } from './storage'

export type PersistStatus =
  | 'loading' // reading the stored save; autosave is off
  | 'ready' // nothing stored yet, or just reset
  | 'saved' // last write succeeded
  | 'error' // a write failed (will retry on the next change)
  | 'corrupt' // a save exists but can't be read; it is kept untouched and autosave is off
  | 'conflict' // another tab saved newer progress; autosave is off until the player chooses
  | 'unavailable' // IndexedDB can't be used in this browser

interface PersistState {
  status: PersistStatus
  message: string | null
  lastSavedAt: number | null
  /** The unreadable stored record, kept so the player can export it. */
  rawCorrupt: unknown
}

export const usePersistStore = create<PersistState>()(() => ({
  status: 'loading',
  message: null,
  lastSavedAt: null,
  rawCorrupt: null,
}))

const set = (p: Partial<PersistState>) => usePersistStore.setState(p)
const CAN_SAVE: PersistStatus[] = ['ready', 'saved', 'error']

/**
 * Loads and autosaves the game through a SaveStorage. Rules it enforces:
 *  - A save that can't be parsed or validated is never loaded and never overwritten.
 *  - A save written by another tab after we loaded is never overwritten silently.
 *  - A valid save is only replaced by explicit player action (import, reset).
 *  - Flights stay timestamp-based, so loading just runs the normal catch-up.
 */
export class Persistence {
  private timer: ReturnType<typeof setTimeout> | undefined
  private queue: Promise<void> = Promise.resolve()
  private lastSeen = 0

  constructor(
    private storage: SaveStorage,
    readonly writerId: string = crypto.randomUUID(),
    private debounceMs = 800,
  ) {}

  async boot(now = Date.now()): Promise<void> {
    let raw: unknown
    try {
      raw = await this.storage.read()
    } catch {
      set({ status: 'unavailable', message: "This browser can't store saves (private mode or blocked storage). You can still play, and export your save from Settings." })
      return
    }
    if (raw === null) {
      set({ status: 'ready', message: null })
      return
    }
    const parsed = parseSave(raw)
    if (!parsed.ok) {
      set({ status: 'corrupt', message: parsed.error, rawCorrupt: raw })
      return
    }
    useGameStore.getState().loadGame(parsed.value.game)
    this.lastSeen = parsed.value.savedAt
    const landed = useGameStore.getState().tick(now, true)
    set({ status: 'saved', message: null, lastSavedAt: parsed.value.savedAt, rawCorrupt: null })
    if (landed.length > 0) {
      const revenue = landed.reduce((s, e) => s + e.revenue, 0)
      useNotifyStore.getState().push(
        `Welcome back: ${landed.length} flight${landed.length === 1 ? '' : 's'} landed while you were away${revenue > 0 ? `, +$${revenue.toLocaleString('en-US')}` : ''}.`,
        'good',
      )
      this.schedule()
    }
  }

  /** Starts autosaving. Returns a function that stops it. */
  start(): () => void {
    const unsub = useGameStore.subscribe((state, prev) => {
      if (prev.airline && !state.airline) {
        // Reset is confirmed in the UI; this is the only path that deletes a save.
        void this.enqueue(async () => {
          await this.storage.remove().catch(() => undefined)
          this.lastSeen = 0
          set({ status: 'ready', message: null, lastSavedAt: null, rawCorrupt: null })
        })
        return
      }
      if (state.airline) this.schedule()
    })
    const flush = () => {
      if (document.visibilityState === 'hidden') void this.saveNow()
    }
    const hasDom = typeof document !== 'undefined'
    if (hasDom) {
      document.addEventListener('visibilitychange', flush)
      window.addEventListener('pagehide', flush)
    }
    return () => {
      unsub()
      if (hasDom) {
        document.removeEventListener('visibilitychange', flush)
        window.removeEventListener('pagehide', flush)
      }
      clearTimeout(this.timer)
    }
  }

  private schedule() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.saveNow(), this.debounceMs)
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(job, job)
    return this.queue
  }

  /** Writes the current game now (if allowed). `force` skips the other-tab check; used after an explicit choice. */
  saveNow(force = false): Promise<void> {
    clearTimeout(this.timer)
    return this.enqueue(async () => {
      const game = toCore(useGameStore.getState())
      const status = usePersistStore.getState().status
      if (!game || !CAN_SAVE.includes(status)) return
      try {
        if (!force) {
          const existing = await this.storage.read()
          if (existing !== null) {
            const parsed = parseSave(existing)
            if (!parsed.ok) {
              set({ status: 'corrupt', message: parsed.error, rawCorrupt: existing })
              return
            }
            if (parsed.value.writerId !== this.writerId && parsed.value.savedAt > this.lastSeen) {
              set({ status: 'conflict', message: 'Another tab saved newer progress for this airline.' })
              return
            }
          }
        }
        const file = makeSave(game, this.writerId)
        await this.storage.write(file)
        this.lastSeen = file.savedAt
        set({ status: 'saved', message: null, lastSavedAt: file.savedAt })
      } catch {
        set({ status: 'error', message: "Couldn't save just now. Will retry on the next change." })
      }
    })
  }

  /** Corrupt save: the player chose to start fresh. This is the explicit overwrite. */
  async discardCorruptSave(): Promise<void> {
    await this.enqueue(async () => {
      await this.storage.remove().catch(() => undefined)
      this.lastSeen = 0
      set({ status: 'ready', message: null, rawCorrupt: null })
    })
  }

  /** Conflict: load the other tab's progress and drop this tab's. */
  async useStoredSave(): Promise<void> {
    set({ status: 'loading' })
    await this.boot()
  }

  /** Conflict: keep this tab's progress, overwriting the other tab's save. */
  async keepThisTab(): Promise<void> {
    set({ status: 'ready', message: null })
    await this.saveNow(true)
  }

  /** The current game as the JSON file the player downloads. */
  exportJson(): string | null {
    const game = toCore(useGameStore.getState())
    return game ? JSON.stringify(makeSave(game, this.writerId), null, 2) : null
  }

  /** Validates imported text without touching the current game. */
  parseImport(text: string): Result<SaveFile> {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return { ok: false, error: "That file isn't valid JSON." }
    }
    return parseSave(raw)
  }

  /** Replaces the current game with an already validated import. The caller has confirmed with the player. */
  async applyImport(file: SaveFile): Promise<void> {
    const game: GameCore = file.game
    useGameStore.getState().loadGame(game)
    useGameStore.getState().tick(Date.now(), true)
    set({ status: 'ready', message: null, rawCorrupt: null })
    await this.saveNow(true)
  }
}
