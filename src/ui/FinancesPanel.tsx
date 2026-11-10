import { useShallow } from 'zustand/react/shallow'
import { summarizeFinances } from '../sim/economy'
import { toCore, useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { formatMoney } from './format'
import { leftShell, PanelHeader, profitTone } from './panelParts'

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-0.5">
    <span className="text-muted">{k}</span>
    <b>{v}</b>
  </div>
)

/** Lifetime revenue, operating costs and per-aircraft profitability. */
export function FinancesPanel() {
  const core = useGameStore(useShallow(toCore))
  const setSelection = useUiStore((s) => s.setSelection)
  if (!core) return null
  const f = summarizeFinances(core)
  return (
    <aside className={leftShell}>
      <PanelHeader title="Finances" />
      <div className="panel-scroll flex-1 space-y-3 overflow-y-auto px-3 pb-4 text-sm">
        <div className="rounded-2xl bg-panel-2/70 p-4">
          <Row k="Cash" v={<span className="text-good">{formatMoney(f.cash)}</span>} />
          <Row k="Fleet resale value" v={formatMoney(f.fleetValue)} />
          <Row k="Lifetime revenue" v={formatMoney(f.revenue)} />
          <Row k="Operating costs" v={formatMoney(f.operatingCost)} />
          <Row k="Net profit" v={<span className={profitTone(f.net)}>{formatMoney(f.net)}</span>} />
          <Row k="Jobs delivered" v={f.jobsDelivered.toLocaleString('en-US')} />
          <Row k="Revenue per job" v={f.jobsDelivered ? formatMoney(f.revenue / f.jobsDelivered) : '—'} />
        </div>
        <div className="rounded-2xl bg-panel-2/70 p-4">
          <div className="mb-1 text-xs font-extrabold tracking-[0.14em] text-muted uppercase">By aircraft</div>
          {f.perAircraft.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelection({ kind: 'aircraft', id: a.id })}
              className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition hover:bg-paper/50"
            >
              <span className="font-extrabold">{a.name}</span>
              <span className="text-xs font-bold text-muted">
                {formatMoney(a.revenue)} − {formatMoney(a.cost)} = <span className={profitTone(a.profit)}>{formatMoney(a.profit)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
