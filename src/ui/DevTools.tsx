import { useGameStore } from '../state/gameStore'

/**
 * Developer cheats. Rendered only in development builds (`import.meta.env.DEV`
 * is false and this whole branch is removed from production bundles).
 */
export function DevTools() {
  const s = useGameStore.getState
  const btn = 'rounded-lg bg-white/10 px-2.5 py-1 text-xs font-extrabold hover:bg-white/15'
  return (
    <div className="rounded-2xl border border-dashed border-orange/60 p-4">
      <div className="font-extrabold text-orange">Developer tools (dev builds only)</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => useGameStore.setState((x) => (x.airline ? { airline: { ...x.airline, cash: x.airline.cash + 1_000_000 } } : x))}>
          +$1M
        </button>
        <button type="button" className={btn} onClick={() => s().tick(Date.now() + 3_600_000)}>
          Land all flights
        </button>
      </div>
    </div>
  )
}
