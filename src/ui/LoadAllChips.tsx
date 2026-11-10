import { getAirport } from '../data/airports'
import { useGameStore } from '../state/gameStore'
import { useNotifyStore } from '../state/notifyStore'
import type { Job, OwnedAircraft } from '../types/game'

/**
 * One tap to fill an aircraft with everything bound for the same place.
 * Destinations are offered with their waiting count, busiest first, so the
 * common case (take the whole Bangkok pile) is a single click.
 */
export function LoadAllChips({ aircraft, waiting }: { aircraft: OwnedAircraft; waiting: readonly Job[] }) {
  const loadAll = useGameStore((s) => s.loadAllTowards)
  const notify = useNotifyStore((s) => s.push)

  const counts = new Map<string, number>()
  for (const j of waiting) counts.set(j.destination, (counts.get(j.destination) ?? 0) + 1)
  const destinations = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
  if (destinations.length === 0) return null

  const onLoad = (dest: string) => {
    const r = loadAll(aircraft.id, dest)
    if (!r.ok) return notify(r.error, 'bad')
    const city = getAirport(dest)?.city ?? dest
    notify(
      r.leftBehind > 0
        ? `Loaded ${r.loaded} of ${r.loaded + r.leftBehind} jobs for ${city}. ${aircraft.name} is full.`
        : `Loaded ${r.loaded} job${r.loaded === 1 ? '' : 's'} for ${city}.`,
      'good',
    )
  }

  return (
    <div className="mt-2 mb-1">
      <div className="text-[11px] font-bold text-muted">Load all bound for</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {destinations.map(([dest, n]) => (
          <button
            key={dest}
            type="button"
            onClick={() => onLoad(dest)}
            title={`Load every job waiting for ${getAirport(dest)?.city ?? dest} that still fits`}
            className="rounded-full bg-teal/15 px-2.5 py-1 text-xs font-extrabold text-teal transition hover:bg-teal/25"
          >
            {dest} <span className="font-bold opacity-70">{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
