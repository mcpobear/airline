import type { GameCore, Result } from '../sim/core'
import { validateGame } from './validate'

/** Bump when the saved shape changes, and add a migration from the previous version. */
export const SCHEMA_VERSION = 2

export interface SaveFile {
  schemaVersion: number
  savedAt: number
  /** Identifies the browser tab that wrote the save, to detect two tabs playing at once. */
  writerId: string
  game: GameCore
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/** MIGRATIONS[n] upgrades a version-n save to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // v2 added the job-board refresh cycle. Older saves start a fresh cycle from
  // the moment they are loaded, so the player gets a full interval to play with.
  1: (raw) => {
    const game = (raw.game ?? {}) as Record<string, unknown>
    return { ...raw, game: { ...game, jobEpoch: Date.now(), jobBatch: 0 } }
  },
}

/** Turns untrusted data (from storage or a file) into a valid SaveFile, migrating older versions. */
export function parseSave(raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, current = SCHEMA_VERSION): Result<SaveFile> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'This is not a Global Airline save.' }
  let data = raw as Record<string, unknown>
  let version = data.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'This is not a Global Airline save (missing version).' }
  }
  if (version > current) {
    return { ok: false, error: `This save was made by a newer version of the game (save v${version}, this is v${current}).` }
  }
  while (version < current) {
    const step = migrations[version]
    if (!step) return { ok: false, error: `No migration from save version ${version}.` }
    data = step(data)
    version += 1
    data.schemaVersion = version
  }
  const problem = validateGame(data.game)
  if (problem) return { ok: false, error: `The save is damaged: ${problem}.` }
  return {
    ok: true,
    value: {
      schemaVersion: current,
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
      writerId: typeof data.writerId === 'string' ? data.writerId : '',
      game: data.game as GameCore,
    },
  }
}

export function makeSave(game: GameCore, writerId: string, now = Date.now()): SaveFile {
  return { schemaVersion: SCHEMA_VERSION, savedAt: now, writerId, game }
}
