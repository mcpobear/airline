import Dexie, { type Table } from 'dexie'
import type { SaveFile } from './schema'

/** Where saves live. The game depends on this interface, so tests (and any future backend) can swap it. */
export interface SaveStorage {
  /** The raw stored record (untrusted until parsed), or null when there is no save. */
  read(): Promise<unknown | null>
  write(file: SaveFile): Promise<void>
  remove(): Promise<void>
}

interface SaveRow {
  id: string
  data: unknown
}

class AirlineDb extends Dexie {
  saves!: Table<SaveRow, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({ saves: 'id' })
  }
}

const SLOT = 'main'

/** IndexedDB storage through Dexie. Throws if IndexedDB is unavailable (private mode, blocked). */
export function createDexieStorage(dbName = 'global-airline'): SaveStorage {
  const db = new AirlineDb(dbName)
  return {
    read: async () => (await db.saves.get(SLOT))?.data ?? null,
    write: async (file) => {
      await db.saves.put({ id: SLOT, data: file })
    },
    remove: async () => {
      await db.saves.delete(SLOT)
    },
  }
}

/** In-memory storage for tests. */
export function createMemoryStorage(initial: unknown = null): SaveStorage & { raw: () => unknown } {
  let value: unknown = initial
  return {
    read: async () => (value === null ? null : structuredClone(value)),
    write: async (file) => {
      value = structuredClone(file)
    },
    remove: async () => {
      value = null
    },
    raw: () => value,
  }
}
