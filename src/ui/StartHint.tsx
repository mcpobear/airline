import { useMemo, useState } from 'react'
import { AIRPORTS, getAirport } from '../data/airports'
import { distanceKm } from '../sim/geo'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { CloseIcon } from './icons'
import { useCompact } from './useCompact'

/** Explains the first step: jobs only exist between unlocked airports, so a new airline needs a second one. */
export function StartHint() {
  const hq = useGameStore((s) => s.airline?.hq)
  const unlockedCount = useGameStore((s) => s.unlockedAirports.length)
  const setSection = useUiStore((s) => s.setSection)
  const setSelection = useUiStore((s) => s.setSelection)
  const selection = useUiStore((s) => s.selection)
  const panelOpen = useUiStore((s) => s.panelOpen)
  const compact = useCompact()
  const [dismissed, setDismissed] = useState(false)
  const nearest = useMemo(() => {
    const origin = hq ? getAirport(hq) : undefined
    if (!origin) return null
    return AIRPORTS.filter((a) => a.iata !== origin.iata)
      .map((a) => ({ a, km: distanceKm(origin, a) }))
      .sort((x, y) => x.km - y.km)[0]
  }, [hq])
  if (!hq || unlockedCount >= 2 || !nearest || dismissed) return null
  // On a phone this card floats over the whole screen, so anything else that
  // covers the map - the section panel, the context sheet - would be behind
  // it. There it waits until the player is back on the map.
  if (compact && (selection || panelOpen)) return null
  return (
    <div
      role="status"
      className="fixed bottom-[calc(var(--nav-h)+76px)] left-1/2 z-20 flex w-[min(520px,calc(100vw-24px))] -translate-x-1/2 gap-3 rounded-2xl border border-teal/50 bg-panel/95 p-4 text-sm shadow-xl backdrop-blur-md"
    >
      <div className="min-w-0 flex-1">
        <b>No jobs yet — you need somewhere to fly to.</b>
        <p className="mt-1 text-muted">
          Jobs travel between airports you've unlocked. Unlock a second airport and jobs appear straight away. The nearest is{' '}
          {nearest.a.city} ({nearest.a.iata}), {Math.round(nearest.km).toLocaleString('en-US')} km away.
        </p>
        <button
          type="button"
          onClick={() => {
            setSection('airports')
            setSelection({ kind: 'airport', iata: nearest.a.iata })
          }}
          className="mt-3 rounded-xl bg-teal px-4 py-2 font-black text-white transition hover:brightness-110"
        >
          Show {nearest.a.city}
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss hint"
        onClick={() => setDismissed(true)}
        className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full bg-panel-2 text-muted transition hover:text-ink"
      >
        <CloseIcon />
      </button>
    </div>
  )
}
