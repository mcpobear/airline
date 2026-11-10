import type { ReactNode } from 'react'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { SECTION_ICONS } from './icons'
import { MusicToggle } from './MusicToggle'
import { formatMoney } from './format'

const card =
  'rounded-2xl border border-line/60 bg-panel/90 shadow-lg shadow-ink/15 backdrop-blur-md'

function Stat({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string
  value: ReactNode
  tone?: string
}) {
  return (
    <div className={`${card} flex min-w-[88px] flex-col justify-center px-4 py-2`}>
      <span className="text-[11px] font-extrabold tracking-[0.14em] text-muted uppercase">
        {label}
      </span>
      <span className={`text-xl leading-tight font-extrabold ${tone}`}>{value}</span>
    </div>
  )
}

export function StatusBar() {
  const airline = useGameStore((s) => s.airline)
  const setSection = useUiStore((s) => s.setSection)
  const unlockedCount = useGameStore((s) => s.unlockedAirports.length)
  const aircraftCount = useGameStore((s) => s.aircraft.length)
  const flyingCount = useGameStore((s) => s.aircraft.filter((a) => a.flight !== null).length)
  const Gear = SECTION_ICONS.settings
  const none = <span className="text-muted">—</span>

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between p-2">
      <div className="pointer-events-auto flex flex-wrap gap-2">
        <div className={`${card} flex items-center gap-3 py-2 pr-5 pl-2`}>
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal text-xl font-black text-white">
            {airline ? airline.name[0].toUpperCase() : 'G'}
          </div>
          <div className="leading-tight">
            <div className="text-lg font-extrabold">{airline?.name ?? 'Global Airline'}</div>
            <div className="text-xs font-bold text-muted">
              {airline ? `HQ · ${airline.hq}` : 'No airline yet'}
            </div>
          </div>
        </div>
        <Stat
          label="Cash"
          value={airline ? formatMoney(airline.cash) : none}
          tone={airline ? 'text-good' : undefined}
        />
        <Stat label="Airports" value={airline ? unlockedCount : none} />
        <Stat label="Aircraft" value={airline ? aircraftCount : none} />
        <Stat label="Flying" value={airline ? flyingCount : none} />
        <Stat
          label="Lifetime profit"
          value={
            airline ? formatMoney(airline.lifetimeRevenue - airline.lifetimeOperatingCost) : none
          }
        />
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <MusicToggle />
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSection('settings')}
          className={`${card} grid h-14 w-14 place-items-center text-ink transition hover:bg-panel-2 hover:text-teal`}
        >
          <Gear />
        </button>
      </div>
    </header>
  )
}
