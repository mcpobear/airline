import { useEffect, useMemo, useState } from 'react'
import { getAircraftModel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { dispatchBlocker, flightCost, flightDurationMs } from '../sim/flight'
import { distanceKm } from '../sim/geo'
import { toCore, useGameStore } from '../state/gameStore'
import { useNotifyStore } from '../state/notifyStore'
import { useUiStore } from '../state/uiStore'
import { useShallow } from 'zustand/react/shallow'
import type { OwnedAircraft } from '../types/game'
import { formatDuration, formatKm, formatMoney } from './format'
import { flightProgress, flightWindows, phaseAt } from '../sim/flightProfile'
import { useNow } from './useNow'

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted">{k}</span>
    <b className="text-right">{v}</b>
  </div>
)

const PHASE_TEXT = { departing: 'Taking off', cruising: 'Cruising', arriving: 'Landing' } as const

/** Route planning for a parked aircraft: pick a destination, see the numbers, dispatch. */
export function DispatchSection({ aircraft }: { aircraft: OwnedAircraft }) {
  const core = useGameStore(useShallow(toCore))
  const dispatch = useGameStore((s) => s.dispatchFlight)
  const notify = useNotifyStore((s) => s.push)
  const setPreview = useUiStore((s) => s.setPreviewRoute)
  const [dest, setDest] = useState('')
  const from = aircraft.airport!
  const model = getAircraftModel(aircraft.modelId)!

  useEffect(() => () => setPreview(null), [setPreview])
  useEffect(() => {
    setPreview(dest ? { from, to: dest } : null)
  }, [dest, from, setPreview])

  const options = useMemo(() => {
    const origin = getAirport(from)!
    return (core?.unlockedAirports ?? [])
      .filter((i) => i !== from)
      .map((i) => {
        const a = getAirport(i)!
        return { iata: i, city: a.city, km: distanceKm(origin, a) }
      })
      .sort((a, b) => a.km - b.km)
  }, [core?.unlockedAirports, from])

  if (!core) return null
  const km = dest ? distanceKm(getAirport(from)!, getAirport(dest)!) : 0
  const blocker = dest ? dispatchBlocker(core, aircraft.id, dest) : null
  const revenue = core.jobs
    .filter((j) => j.aircraftId === aircraft.id && j.destination === dest)
    .reduce((s, j) => s + j.reward, 0)

  const go = () => {
    const err = dispatch(aircraft.id, dest)
    if (err) notify(err, 'bad')
    else {
      setPreview(null)
      setDest('')
    }
  }

  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">Dispatch</div>
      <div className="mt-2 text-sm">
        {options.length === 0 ? (
          <span className="text-muted">Unlock another airport to fly somewhere.</span>
        ) : (
          <>
            <label className="block">
              <span className="sr-only">Destination</span>
              <select
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="w-full rounded-xl bg-paper/70 px-3 py-2 font-semibold"
              >
                <option value="">Choose a destination…</option>
                {options.map((o) => (
                  <option key={o.iata} value={o.iata}>
                    {o.iata} · {o.city} · {formatKm(o.km)}
                    {o.km > model.rangeKm ? ' (out of range)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {dest && (
              <div className="mt-3 space-y-0.5">
                <Row k="Distance" v={formatKm(km)} />
                <Row k="Flight time" v={formatDuration(flightDurationMs(km, model))} />
                <Row k="Operating cost" v={formatMoney(flightCost(model, km))} />
                <Row k="Revenue on arrival" v={<span className="text-good">{formatMoney(revenue)}</span>} />
              </div>
            )}
            {blocker && <p className="mt-2 text-xs font-semibold text-bad">{blocker}</p>}
            <button
              type="button"
              disabled={!dest || !!blocker}
              onClick={go}
              className="mt-3 w-full rounded-xl bg-teal px-4 py-2 font-black text-white transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Dispatch flight
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Live status of a flying aircraft. */
export function InFlightSection({ aircraft }: { aircraft: OwnedAircraft }) {
  const f = aircraft.flight!
  const now = useNow(true)
  const follow = useUiStore((s) => s.followAircraftId === aircraft.id)
  const setFollow = useUiStore((s) => s.setFollowAircraft)
  const p = flightProgress(f, now)
  const phase = phaseAt(p, flightWindows(f))
  const to = getAirport(f.to)!
  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">In flight</div>
      <div className="mt-2 space-y-0.5 text-sm">
        <Row k="Route" v={`${f.from} → ${f.to}`} />
        <Row k="Destination" v={`${to.city} (${to.iata})`} />
        <Row k="Phase" v={PHASE_TEXT[phase]} />
        <Row k="Progress" v={`${Math.round(p * 100)}%`} />
        <Row k="Arrives in" v={formatDuration(f.arrivesAt - now)} />
        <Row k="Distance" v={formatKm(f.distanceKm)} />
      </div>
      <button
        type="button"
        aria-pressed={follow}
        onClick={() => setFollow(follow ? null : aircraft.id)}
        className={`mt-3 rounded-lg px-3 py-1 text-xs font-extrabold transition ${
          follow ? 'bg-teal text-white' : 'bg-teal/15 text-teal hover:bg-teal/25'
        }`}
      >
        {follow ? 'Following — tap to stop' : 'Follow on map'}
      </button>
    </div>
  )
}
