import { getAircraftModel, modelLabel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { aircraftPosition } from '../sim/aircraft'
import { aircraftLoad, jobFitBlocker } from '../sim/loading'
import { waitingJobsAt } from '../sim/jobs'
import { useNotifyStore } from '../state/notifyStore'
import { JobRow, ghostButton, loadButton } from './jobUi'
import type { AircraftModel, OwnedAircraft } from '../types/game'
import { useState } from 'react'
import { toCore, useGameStore } from '../state/gameStore'
import { useShallow } from 'zustand/react/shallow'
import { resaleValue, sellBlocker } from '../sim/economy'
import { useUiStore } from '../state/uiStore'
import { airportAccess, formatMoney } from './format'
import { STATUS_LABEL, STATUS_TONE } from './FleetPanel'
import { CloseIcon } from './icons'
import { DispatchSection, InFlightSection } from './DispatchSection'
import { formatDuration } from './format'
import { useNow } from './useNow'
import { Meter, profitTone, rightShell } from './panelParts'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">{title}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted">{k}</span>
    <b className="text-right">{v}</b>
  </div>
)

function LoadingSection({ aircraft, model }: { aircraft: OwnedAircraft; model: AircraftModel }) {
  const jobs = useGameStore((s) => s.jobs)
  const load = useGameStore((s) => s.loadJob)
  const unload = useGameStore((s) => s.unloadJob)
  const notify = useNotifyStore((s) => s.push)
  const [kind, setKind] = useState<'all' | 'passenger' | 'cargo'>('all')

  const onboard = jobs.filter((j) => j.aircraftId === aircraft.id)
  const used = aircraftLoad(jobs, aircraft.id)
  const potential = onboard.reduce((sum, j) => sum + j.reward, 0)
  const parked = aircraft.airport !== null && aircraft.flight === null
  const waiting = parked
    ? waitingJobsAt(jobs, aircraft.airport!)
        .filter((j) => kind === 'all' || j.kind === kind)
        .sort((a, b) => b.reward - a.reward)
    : []
  const act = (err: string | null) => err && notify(err, 'bad')

  return (
    <>
      <Section title="Load">
        <div className="mb-2">
          <div className="mb-1 flex justify-between"><span className="text-muted">Passengers</span><b>{used.pax} / {model.passengerCapacity}</b></div>
          <Meter value={used.pax} max={model.passengerCapacity} />
        </div>
        <div>
          <div className="mb-1 flex justify-between"><span className="text-muted">Cargo</span><b>{used.cargoKg.toLocaleString('en-US')} / {model.cargoCapacityKg.toLocaleString('en-US')} kg</b></div>
          <Meter value={used.cargoKg} max={model.cargoCapacityKg} tone="bg-purple" />
        </div>
        <Row k="Free seats / cargo" v={`${model.passengerCapacity - used.pax} / ${(model.cargoCapacityKg - used.cargoKg).toLocaleString('en-US')} kg`} />
      </Section>

      <Section title={`Loaded jobs (${onboard.length})`}>
        {onboard.length === 0 && <span className="text-muted">Nothing onboard yet. Load jobs below.</span>}
        {onboard.map((j) => (
          <JobRow
            key={j.id}
            job={j}
            action={
              <button type="button" disabled={!parked} onClick={() => act(unload(aircraft.id, j.id))} className={ghostButton}>
                Unload
              </button>
            }
          />
        ))}
        {onboard.length > 0 && (
          <Row k="Revenue potential" v={<span className="text-good">{formatMoney(potential)}</span>} />
        )}
      </Section>

      <Section title={parked ? `Available at ${aircraft.airport} (${waitingJobsAt(jobs, aircraft.airport!).length})` : 'Available jobs'}>
        {!parked && <span className="text-muted">Jobs can only be loaded while parked.</span>}
        {parked && (
          <div className="mb-1 flex gap-1.5">
            {(['all', 'passenger', 'cargo'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold capitalize transition ${
                  kind === k ? 'bg-cyan/20 text-cyan' : 'bg-white/5 text-muted hover:text-ink'
                }`}
              >
                {k === 'passenger' ? 'Passengers' : k}
              </button>
            ))}
          </div>
        )}
        {parked && waiting.length === 0 && <span className="text-muted">No jobs of this kind waiting here.</span>}
        <div className="panel-scroll max-h-80 overflow-y-auto">
          {waiting.map((j) => {
            const blocker = jobFitBlocker(aircraft, model, jobs, j)
            return (
              <JobRow
                key={j.id}
                job={j}
                note={blocker}
                action={
                  <button type="button" disabled={!!blocker} onClick={() => act(load(aircraft.id, j.id))} className={loadButton}>
                    Load
                  </button>
                }
              />
            )
          })}
        </div>
      </Section>

    </>
  )
}

function SellSection({ aircraft }: { aircraft: OwnedAircraft }) {
  const core = useGameStore(useShallow(toCore))
  const sell = useGameStore((s) => s.sellAircraft)
  const setSelection = useUiStore((s) => s.setSelection)
  const notify = useNotifyStore((s) => s.push)
  const [confirm, setConfirm] = useState(false)
  if (!core) return null
  const blocker = sellBlocker(core, aircraft.id)
  const value = resaleValue(aircraft)
  const go = () => {
    const err = sell(aircraft.id)
    if (err) notify(err, 'bad')
    else {
      notify(`Sold ${aircraft.name} for ${formatMoney(value)}.`, 'good')
      setSelection(null)
    }
  }
  return (
    <Section title="Sell aircraft">
      <Row k="Resale value" v={formatMoney(value)} />
      {blocker && <p className="mt-1 text-xs font-semibold text-muted">{blocker}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!!blocker}
          onClick={() => (confirm ? go() : setConfirm(true))}
          className={`${confirm ? 'bg-bad text-white' : 'bg-white/10 text-muted hover:text-ink'} rounded-lg px-3 py-1 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-35`}
        >
          {confirm ? `Confirm sale · ${formatMoney(value)}` : 'Sell…'}
        </button>
        {confirm && (
          <button type="button" onClick={() => setConfirm(false)} className={ghostButton}>
            Cancel
          </button>
        )}
      </div>
    </Section>
  )
}

export function AircraftPanel({ id }: { id: string }) {
  const aircraft = useGameStore((s) => s.aircraft.find((a) => a.id === id))
  const setSelection = useUiStore((s) => s.setSelection)
  const focusOn = useUiStore((s) => s.focusOn)
  if (!aircraft) return null

  const model = getAircraftModel(aircraft.modelId)!
  const airport = aircraft.airport ? getAirport(aircraft.airport) : undefined
  const profit = aircraft.lifetimeRevenue - aircraft.lifetimeOperatingCost
  const now = useNow(!!aircraft.flight)
  const pos = aircraftPosition(aircraft, now)
  const dest = aircraft.flight ? getAirport(aircraft.flight.to) : undefined

  return (
    <aside className={rightShell}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl leading-tight font-black">{aircraft.name}</h2>
          <div className="text-sm font-semibold text-muted">{modelLabel(model)}</div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setSelection(null)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-panel-2 text-muted transition hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-space/70 px-2 py-0.5 text-sm font-black tracking-wider">{aircraft.registration}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${STATUS_TONE[aircraft.status]}`}>
          {STATUS_LABEL[aircraft.status]}
        </span>
      </div>

      <Section title="Position">
        <Row k="Location" v={airport ? `${airport.city} (${airport.iata})` : 'In flight'} />
        <Row k="Destination" v={dest ? `${dest.city} (${dest.iata})` : '—'} />
        <Row k="Estimated arrival" v={aircraft.flight ? `in ${formatDuration(aircraft.flight.arrivesAt - now)}` : '—'} />
        {pos && (
          <button
            type="button"
            onClick={() => focusOn(pos.lat, pos.lon)}
            className="mt-2 rounded-lg bg-cyan/15 px-3 py-1 text-xs font-extrabold text-cyan transition hover:bg-cyan/25"
          >
            Show on globe
          </button>
        )}
      </Section>

      {aircraft.flight ? <InFlightSection aircraft={aircraft} /> : <DispatchSection aircraft={aircraft} />}

      <LoadingSection aircraft={aircraft} model={model} />

      <Section title="Performance">
        <Row k="Range" v={`${model.rangeKm.toLocaleString('en-US')} km`} />
        <Row k="Cruise speed" v={`${model.cruiseSpeedKmh} km/h`} />
        <Row k="Operating cost" v={`$${model.operatingCostPerKm.toFixed(2)} / km`} />
        <Row k="Can use" v={airportAccess(model.airportCategory)} />
      </Section>

      <SellSection aircraft={aircraft} />

      <Section title="Results">
        <Row k="Lifetime profit" v={<span className={profitTone(profit)}>{formatMoney(profit)}</span>} />
        <Row k="Purchase price" v={formatMoney(aircraft.purchasePrice)} />
      </Section>

    </aside>
  )
}
