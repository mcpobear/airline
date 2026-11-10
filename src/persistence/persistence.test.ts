import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeGame } from '../sim/testUtils'
import { dispatchFlight } from '../sim/flight'
import { useGameStore } from '../state/gameStore'
import { Persistence, usePersistStore } from './persistence'
import { makeSave, parseSave, SCHEMA_VERSION } from './schema'
import { createDexieStorage, createMemoryStorage } from './storage'
import { validateGame } from './validate'

const T0 = 1_700_000_000_000
const reset = () => {
  useGameStore.getState().resetGame()
  usePersistStore.setState({ status: 'loading', message: null, lastSavedAt: null, rawCorrupt: null })
}
const play = (game = makeGame({ unlock: ['KUL'] })) => useGameStore.getState().loadGame(game)

beforeEach(reset)

describe('schema and validation', () => {
  it('accepts a fresh game and round-trips through JSON', () => {
    const g = makeGame({ unlock: ['KUL'] })
    expect(validateGame(g)).toBeNull()
    const parsed = parseSave(JSON.parse(JSON.stringify(makeSave(g, 'w1', 5))))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.game).toEqual(g)
  })

  it('rejects damaged data with a reason', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const bad = (mutate: (x: any) => void) => {
      const copy = JSON.parse(JSON.stringify(g))
      mutate(copy)
      return validateGame(copy)
    }
    expect(bad((x) => (x.airline.cash = 'lots'))).toMatch(/cash/)
    expect(bad((x) => (x.aircraft[0].modelId = 'zeppelin'))).toMatch(/unknown model/)
    expect(bad((x) => (x.unlockedAirports = ['XXX']))).toMatch(/unlocked airports/)
    expect(bad((x) => (x.aircraft[0].airport = null))).toMatch(/parked or flying/)
    expect(bad((x) => x.jobs.push({ ...x.jobs[0] }))).toMatch(/duplicate job/)
    expect(bad((x) => (x.jobs[0].aircraftId = 'ghost'))).toMatch(/missing aircraft/)
    expect(validateGame(null)).toMatch(/missing/)
  })

  it('refuses newer or unversioned saves and runs migrations for older ones', () => {
    const g = makeGame()
    expect(parseSave({ ...makeSave(g, 'w'), schemaVersion: SCHEMA_VERSION + 1 })).toMatchObject({ ok: false })
    expect(parseSave({ hello: 1 })).toMatchObject({ ok: false })
    const old = { schemaVersion: 1, savedAt: 1, writerId: 'w', game: { ...g, legacyName: 'x' } }
    const migrated = parseSave(old, { 1: (r) => ({ ...r, migrated: true }) }, 2)
    expect(migrated.ok).toBe(true)
    if (migrated.ok) expect(migrated.value.schemaVersion).toBe(2)
    expect(parseSave(old, {}, 2)).toMatchObject({ ok: false })
  })
})

describe('storage', () => {
  it('round-trips a save through IndexedDB (Dexie) and can delete it', async () => {
    const s = createDexieStorage('test-db')
    expect(await s.read()).toBeNull()
    const file = makeSave(makeGame({ unlock: ['KUL'] }), 'w', 42)
    await s.write(file)
    expect(parseSave(await s.read())).toMatchObject({ ok: true })
    await s.remove()
    expect(await s.read()).toBeNull()
  })
})

describe('persistence controller', () => {
  it('starts empty when there is no save, and saves once a game exists', async () => {
    const storage = createMemoryStorage()
    const p = new Persistence(storage, 'tab-a')
    await p.boot()
    expect(usePersistStore.getState().status).toBe('ready')
    play()
    await p.saveNow()
    expect(usePersistStore.getState().status).toBe('saved')
    expect(parseSave(storage.raw())).toMatchObject({ ok: true })
  })

  it('loads a saved game and lands flights that finished while the browser was closed', async () => {
    const g0 = makeGame({ unlock: ['KUL'] })
    const r = dispatchFlight(g0, g0.aircraft[0].id, 'KUL', T0)
    if (!r.ok) throw new Error(r.error)
    const storage = createMemoryStorage(makeSave(r.value, 'old-tab', T0 + 1))
    const p = new Persistence(storage, 'tab-b')
    await p.boot(T0 + 24 * 3_600_000)
    const s = useGameStore.getState()
    expect(s.aircraft[0].flight).toBeNull()
    expect(s.aircraft[0].airport).toBe('KUL')
    expect(usePersistStore.getState().status).toBe('saved')
  })

  it('never loads or overwrites a corrupt save', async () => {
    const corrupt = { schemaVersion: 1, savedAt: 1, writerId: 'x', game: { airline: 'nope' } }
    const storage = createMemoryStorage(corrupt)
    const p = new Persistence(storage, 'tab-c')
    await p.boot()
    expect(usePersistStore.getState().status).toBe('corrupt')
    expect(useGameStore.getState().airline).toBeNull()
    play()
    await p.saveNow()
    await p.saveNow(true)
    expect(storage.raw()).toEqual(corrupt) // untouched, even when forced
    await p.discardCorruptSave()
    expect(storage.raw()).toBeNull()
    expect(usePersistStore.getState().status).toBe('ready')
  })

  it('does not silently overwrite progress saved by another tab', async () => {
    const storage = createMemoryStorage()
    const a = new Persistence(storage, 'tab-a')
    await a.boot()
    play()
    await a.saveNow()
    // another tab writes newer progress
    const g = makeGame({ unlock: ['KUL', 'BKK'], seed: 99 })
    await storage.write(makeSave(g, 'tab-b', Date.now() + 5000))
    await a.saveNow()
    expect(usePersistStore.getState().status).toBe('conflict')
    expect((parseSave(storage.raw()) as any).value.game.seed).toBe(99)
    await a.keepThisTab()
    expect((parseSave(storage.raw()) as any).value.game.seed).toBe(useGameStore.getState().seed)
  })

  it('imports only valid files and replaces the game on request', async () => {
    const storage = createMemoryStorage()
    const p = new Persistence(storage, 'tab-d')
    await p.boot()
    play()
    expect(p.parseImport('not json')).toMatchObject({ ok: false })
    expect(p.parseImport('{"schemaVersion":1,"game":{}}')).toMatchObject({ ok: false })
    const imported = makeGame({ unlock: ['KUL', 'BKK'], seed: 123 })
    const parsed = p.parseImport(JSON.stringify(makeSave(imported, 'x')))
    if (!parsed.ok) throw new Error(parsed.error)
    await p.applyImport(parsed.value)
    expect(useGameStore.getState().seed).toBe(123)
    expect((parseSave(storage.raw()) as any).value.game.seed).toBe(123)
  })

  it('exports exactly what it would save', async () => {
    const p = new Persistence(createMemoryStorage(), 'tab-e')
    expect(p.exportJson()).toBeNull()
    play()
    const parsed = p.parseImport(p.exportJson()!)
    expect(parsed.ok).toBe(true)
  })
})
