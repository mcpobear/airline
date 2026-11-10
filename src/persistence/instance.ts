import { Persistence } from './persistence'
import { createDexieStorage } from './storage'

let instance: Persistence | null = null

/** The app-wide persistence controller (created on first use). */
export function getPersistence(): Persistence {
  return (instance ??= new Persistence(createDexieStorage()))
}

let started = false

/** Loads the saved game (if any) and starts autosaving. Safe to call more than once. */
export function startPersistence(): void {
  if (started) return
  started = true
  const p = getPersistence()
  void p.boot().then(() => p.start())
}
