import { useMemo } from 'react'
import { AIRPORTS, getAirport } from '../data/airports'
import { distanceKm } from '../sim/geo'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'

/** Explains the first step: jobs only exist between unlocked airports, so a new airline needs a second one. */
export function StartHint() {
  const hq = useGameStore((s) => s.airline?.hq)
  const unlockedCount = useGameStore((s) => s.unlockedAirports.length)
  const setSection = useUiStore((s) => s.setSection)
  const setSelection = useUiStore((s) => s.setSelection)
  const nearest = useMemo(() => {
    const origin = hq ? getAirport(hq) : undefined
    if (!origin) return null
    return AIRPORTS.filter((a) => a.iata !== origin.iata)
      .map((a) => ({ a, km: distanceKm(origin, a) }))
      .sort((x, y) => x.km - y.km)[0]
  }, [hq])
  if (!hq || unlockedCount >= 2 || !nearest) return null
  return (
    <div role="status" className="fixed bottom-[76px] left-1/2 z-20 w-[min(520px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-teal/50 bg-panel/95 p-4 text-sm shadow-xl backdrop-blur-md">
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
  )
}
