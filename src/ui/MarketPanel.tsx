import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AIRCRAFT, modelLabel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { canOperateAt, isAvailable, purchaseBlocker } from '../sim/aircraft'
import { useGameStore, toCore } from '../state/gameStore'
import { useNotifyStore } from '../state/notifyStore'
import type { AircraftModel } from '../types/game'
import { airportAccess, formatMoney } from './format'
import { leftShell, PanelHeader } from './panelParts'

const MAKERS = ['All', 'Airbus', 'Boeing', 'COMAC'] as const

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-extrabold tracking-[0.12em] text-muted uppercase">{label}</div>
      <div className="text-sm font-extrabold">{value}</div>
    </div>
  )
}

function ModelCard({ model }: { model: AircraftModel }) {
  // toCore builds a fresh object each call, so compare shallowly to avoid a render loop.
  const game = useGameStore(useShallow(toCore))
  const buy = useGameStore((s) => s.purchaseAircraft)
  const notify = useNotifyStore((s) => s.push)
  const hq = game ? getAirport(game.airline.hq) : undefined
  const blocker = game ? purchaseBlocker(game, model.id) : 'Create an airline first.'
  const cashShort = game ? Math.max(0, model.price - game.airline.cash) : 0
  const hqIncompatible = hq ? !canOperateAt(model, hq) : false

  // Short, actionable reason shown under the button.
  const reason = !blocker
    ? null
    : cashShort > 0 && !hqIncompatible && model.inService
      ? `Need ${formatMoney(cashShort)} more`
      : blocker

  const onBuy = () => {
    const r = buy(model.id)
    if (r.ok) notify(`Delivered ${r.value.name} (${r.value.registration}) to ${hq?.city}.`, 'good')
    else notify(r.error, 'bad')
  }

  return (
    <div className={`mb-2 rounded-2xl bg-panel-2/60 p-3.5 ${blocker && hqIncompatible ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-lg leading-tight font-black">{modelLabel(model)}</div>
          <div className="text-xs font-bold text-muted">
            <span className="capitalize">{model.visualCategory}</span> · {airportAccess(model.airportCategory)}
          </div>
        </div>
        <div className="text-lg font-black text-good">{formatMoney(model.price)}</div>
      </div>
      {!model.inService && (
        <div className="mt-2 rounded-xl bg-sky/15 px-2.5 py-1.5 text-xs font-bold text-sky">
          Not yet in service · {model.serviceNote}
        </div>
      )}
      <div className="mt-2.5 grid grid-cols-5 gap-2">
        <Stat label="Seats" value={String(model.passengerCapacity)} />
        <Stat label="Cargo" value={`${(model.cargoCapacityKg / 1000).toFixed(1)}t`} />
        <Stat label="Range km" value={`${(model.rangeKm / 1000).toFixed(1)}k`} />
        <Stat label="Speed" value={`${model.cruiseSpeedKmh}`} />
        <Stat label="Cost/km" value={`$${model.operatingCostPerKm.toFixed(1)}`} />
      </div>
      <button
        type="button"
        disabled={!!blocker}
        onClick={onBuy}
        className="mt-3 w-full rounded-xl bg-orange px-4 py-2 text-sm font-black text-white shadow-[0_3px_0_0_var(--color-orange-dark)] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        Buy · {formatMoney(model.price)}
      </button>
      {reason && <p className="mt-1.5 text-xs font-bold text-bad">{reason}</p>}
    </div>
  )
}

export function MarketPanel() {
  const [maker, setMaker] = useState<(typeof MAKERS)[number]>('All')
  const settings = useGameStore((s) => s.settings)
  const cash = useGameStore((s) => s.airline?.cash ?? 0)

  const models = useMemo(
    () =>
      AIRCRAFT.filter((m) => isAvailable(m, settings) && (maker === 'All' || m.manufacturer === maker)).sort(
        (a, b) => a.price - b.price,
      ),
    [maker, settings],
  )

  return (
    <aside className={leftShell}>
      <PanelHeader title="Aircraft Market" hint={<span className="text-good">{formatMoney(cash)}</span>} />
      <div className="flex gap-1.5 px-4 pb-2">
        {MAKERS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={maker === m}
            onClick={() => setMaker(m)}
            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
              maker === m ? 'bg-teal/20 text-teal' : 'bg-ink/5 text-muted hover:text-ink'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="panel-scroll flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-1 pb-2 text-xs text-muted">New aircraft are delivered to your headquarters.</p>
        {models.map((m) => (
          <ModelCard key={m.id} model={m} />
        ))}
      </div>
    </aside>
  )
}
