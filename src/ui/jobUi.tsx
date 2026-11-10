import type { ReactNode } from 'react'
import { getAirport } from '../data/airports'
import { distanceKm } from '../sim/geo'
import type { Job } from '../types/game'
import { formatMoney } from './format'

export const jobQuantityText = (j: Job) =>
  j.kind === 'passenger' ? `${j.quantity} pax` : `${j.quantity.toLocaleString('en-US')} kg`

export function KindBadge({ kind }: { kind: Job['kind'] }) {
  return kind === 'passenger' ? (
    <span className="rounded-md bg-cyan/15 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-cyan">PAX</span>
  ) : (
    <span className="rounded-md bg-purple/20 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-purple">CARGO</span>
  )
}

/**
 * One job: kind, route (final destination), size, distance and the reward paid
 * on delivery. `action` is a slot for Load / Unload / Dismiss buttons.
 */
export function JobRow({ job, action, note }: { job: Job; action?: ReactNode; note?: ReactNode }) {
  const from = getAirport(job.origin)
  const to = getAirport(job.destination)
  const km = from && to ? Math.round(distanceKm(from, to)) : 0
  return (
    <div className="mt-1.5 rounded-xl bg-space/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <KindBadge kind={job.kind} />
          {job.status === 'at_layover' && (
            <span className="rounded-md bg-orange/20 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-orange">LAYOVER</span>
          )}
          <span className="truncate text-sm font-black">
            {job.origin} → {job.destination}
          </span>
        </div>
        <span className="text-sm font-black text-good">{formatMoney(job.reward)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold text-muted">
          {to?.city} · {km.toLocaleString('en-US')} km · {jobQuantityText(job)}
        </span>
        {action}
      </div>
      {note && <div className="mt-1 text-xs font-bold text-bad">{note}</div>}
    </div>
  )
}

export const smallButton =
  'shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-35'
export const loadButton = `${smallButton} bg-orange text-white hover:brightness-110`
export const ghostButton = `${smallButton} bg-white/10 text-muted hover:text-ink`
