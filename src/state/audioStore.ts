import { create } from 'zustand'
import { LoungeEngine } from '../audio/LoungeEngine'

const KEY = 'global-airline.audio'

interface Stored {
  enabled: boolean
  volume: number
}

/** Browser storage can throw or be empty; either way we fall back to the defaults. */
function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>
      return {
        enabled: parsed.enabled !== false,
        volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : 0.5,
      }
    }
  } catch {
    // Ignore: the player just gets the defaults this time.
  }
  return { enabled: true, volume: 0.5 }
}

function save(state: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // A browser that refuses storage simply forgets the choice.
  }
}

const engine = new LoungeEngine()

interface AudioState extends Stored {
  setEnabled: (v: boolean) => void
  setVolume: (v: number) => void
  /** Called after the first click or key press, which is when browsers allow sound. */
  unlock: () => void
}

export const useAudioStore = create<AudioState>()((set, get) => ({
  ...load(),
  setEnabled: (enabled) => {
    set({ enabled })
    save({ enabled, volume: get().volume })
    if (enabled) void engine.start()
    else engine.stop()
  },
  setVolume: (volume) => {
    set({ volume })
    save({ enabled: get().enabled, volume })
    engine.setVolume(volume)
  },
  unlock: () => {
    engine.setVolume(get().volume)
    if (get().enabled && !engine.isRunning) void engine.start()
  },
}))

export { engine as loungeEngine }
