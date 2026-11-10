import { GLOBE_STYLES } from '../world/palettes'
import { useUiStore } from '../state/uiStore'

/** Picks how the world is drawn. Remembered in this browser, not part of the save. */
export function GlobeStyleSection() {
  const current = useUiStore((s) => s.globeStyle)
  const setStyle = useUiStore((s) => s.setGlobeStyle)
  const selected = GLOBE_STYLES.find((s) => s.id === current) ?? GLOBE_STYLES[0]

  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="font-extrabold">World style</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GLOBE_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            aria-pressed={style.id === current}
            onClick={() => setStyle(style.id)}
            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
              style.id === current ? 'bg-teal text-white' : 'bg-ink/8 text-muted hover:text-ink'
            }`}
          >
            {style.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{selected.blurb}</p>
    </div>
  )
}
