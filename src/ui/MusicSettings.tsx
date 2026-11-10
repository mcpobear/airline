import { useAudioStore } from '../state/audioStore'

/** Lounge music on/off and how loud, remembered in this browser. */
export function MusicSettings() {
  const enabled = useAudioStore((s) => s.enabled)
  const volume = useAudioStore((s) => s.volume)
  const setEnabled = useAudioStore((s) => s.setEnabled)
  const setVolume = useAudioStore((s) => s.setVolume)

  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled(!enabled)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span>
          <span className="block font-extrabold">Lounge music</span>
          <span className="block text-xs text-muted">
            A slow jazz loop played in your browser. Nothing is downloaded.
          </span>
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-teal' : 'bg-ink/15'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`}
          />
        </span>
      </button>
      <label className="mt-3 flex items-center gap-3">
        <span className="text-xs font-bold text-muted">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          disabled={!enabled}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink/15 accent-teal disabled:opacity-40"
          aria-label="Music volume"
        />
      </label>
    </div>
  )
}
