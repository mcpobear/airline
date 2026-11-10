import { isLand } from '../data/landLookup'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { AircraftPanel } from './AircraftPanel'
import { AirportPanel } from './AirportPanel'
import { CloseIcon } from './icons'
import { formatCoord } from './format'

const shell =
  'fixed top-[76px] right-2 bottom-2 z-10 flex w-[327px] flex-col rounded-3xl border border-line/60 bg-panel/90 p-5 shadow-xl shadow-ink/15 backdrop-blur-md'

/** Context panel: shows the selected airport or aircraft, or a clicked map location. */
export function RightPanel() {
  const selection = useUiStore((s) => s.selection)
  const setSelection = useUiStore((s) => s.setSelection)
  const hasAirline = useGameStore((s) => !!s.airline)

  if (!hasAirline) return null
  if (selection?.kind === 'airport') return <AirportPanel iata={selection.iata} />
  if (selection?.kind === 'aircraft') return <AircraftPanel id={selection.id} />

  if (!selection) {
    return (
      <aside className={shell}>
        <h2 className="text-2xl font-black">Nothing selected</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Click an airport on the map, or pick an airport or aircraft from the side panel, to see its details.
        </p>
      </aside>
    )
  }

  const land = isLand(selection.lat, selection.lon)
  return (
    <aside className={shell}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Location</h2>
          <span className="mt-1 inline-block rounded-full bg-teal/15 px-3 py-0.5 text-xs font-extrabold text-teal">
            {land ? 'Land' : 'Ocean'}
          </span>
        </div>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => setSelection(null)}
          className="grid h-10 w-10 place-items-center rounded-full bg-panel-2 text-muted transition hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="mt-4 rounded-2xl bg-panel-2/70 p-4">
        <div className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">Coordinates</div>
        <div className="mt-1 text-lg font-extrabold">{formatCoord(selection.lat, selection.lon)}</div>
      </div>
    </aside>
  )
}
