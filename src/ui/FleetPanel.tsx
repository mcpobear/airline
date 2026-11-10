import { getAircraftModel, modelLabel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { aircraftPosition } from '../sim/aircraft'
import { aircraftLoad } from '../sim/loading'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import type { AircraftStatus, OwnedAircraft } from '../types/game'
import { formatMoney } from './format'
import { leftShell, Meter, PanelHeader, profitTone } from './panelParts'

export const STATUS_LABEL: Record<AircraftStatus, string> = {
  parked: 'Parked',
  loading: 'Loading',
  departing: 'Departing',
  cruising: 'Cruising',
  arriving: 'Arriving',
}

export const STATUS_TONE: Record<AircraftStatus, string> = {
  parked: 'bg-ink/8 text-muted',
  loading: 'bg-sky/20 text-sky',
  departing: 'bg-orange/20 text-orange',
  cruising: 'bg-teal/15 text-teal',
  arriving: 'bg-orange/20 text-orange',
}

export function locationText(a: OwnedAircraft): string {
  if (a.flight) return `${a.flight.from} → ${a.flight.to}`
  return a.airport ? `At ${a.airport}` : '—'
}

export function FleetPanel() {
  const aircraft = useGameStore((s) => s.aircraft)
  const jobs = useGameStore((s) => s.jobs)
  const selection = useUiStore((s) => s.selection)
  const setSelection = useUiStore((s) => s.setSelection)
  const focusOn = useUiStore((s) => s.focusOn)

  return (
    <aside className={leftShell}>
      <PanelHeader title="Fleet" hint={`${aircraft.length} aircraft`} />
      <div className="panel-scroll flex-1 overflow-y-auto px-3 pb-4">
        {aircraft.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted">No aircraft yet. Buy one from the Market.</p>
        )}
        {aircraft.map((a) => {
          const model = getAircraftModel(a.modelId)!
          const load = aircraftLoad(jobs, a.id)
          const profit = a.lifetimeRevenue - a.lifetimeOperatingCost
          const active = selection?.kind === 'aircraft' && selection.id === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setSelection({ kind: 'aircraft', id: a.id })
                const pos = aircraftPosition(a)
                if (pos) focusOn(pos.lat, pos.lon)
              }}
              className={`mb-2 block w-full rounded-2xl p-3.5 text-left transition ${
                active ? 'bg-panel-2 ring-1 ring-teal' : 'bg-panel-2/60 hover:bg-panel-2'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-lg leading-tight font-black">{a.name}</div>
                  <div className="truncate text-sm font-semibold text-muted">{modelLabel(model)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-extrabold">{locationText(a)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${STATUS_TONE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs font-bold text-muted">
                <div>
                  <div className="mb-1 flex justify-between"><span>Passengers</span><span>{load.pax}/{model.passengerCapacity}</span></div>
                  <Meter value={load.pax} max={model.passengerCapacity} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between"><span>Cargo</span><span>{load.cargoKg.toLocaleString('en-US')}/{model.cargoCapacityKg.toLocaleString('en-US')} kg</span></div>
                  <Meter value={load.cargoKg} max={model.cargoCapacityKg} tone="bg-sky" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm font-bold">
                <span className="text-muted">
                  {a.registration} · {a.airport ? getAirport(a.airport)?.city : ''}
                </span>
                <span>
                  <span className="text-muted">Lifetime profit: </span>
                  <span className={profitTone(profit)}>{formatMoney(profit)}</span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
