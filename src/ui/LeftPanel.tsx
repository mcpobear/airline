import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { AIRPORTS, searchAirports } from '../data/airports'
import { currentUnlockPrice } from '../sim/airline'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { ClassBadge, IataBadge } from './airportUi'
import { formatMoney } from './format'
import { SearchIcon } from './icons'

import { DevTools } from './DevTools'
import { SaveSection } from './SaveSection'
import { FinancesPanel } from './FinancesPanel'
import { FleetPanel } from './FleetPanel'
import { JobsPanel } from './JobsPanel'
import { MarketPanel } from './MarketPanel'
import { leftShell as shell, PanelHeader as Header } from './panelParts'

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-panel-2/70 p-4 text-left transition hover:bg-panel-2"
    >
      <span>
        <span className="block font-extrabold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-cyan' : 'bg-line'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  )
}

function AirportsList() {
  const [query, setQuery] = useState('')
  const [onlyUnlocked, setOnlyUnlocked] = useState(false)
  const airline = useGameStore((s) => s.airline)
  const unlocked = useGameStore((s) => s.unlockedAirports)
  const selection = useUiStore((s) => s.selection)
  const setSelection = useUiStore((s) => s.setSelection)
  const focusOn = useUiStore((s) => s.focusOn)

  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked])
  const rows = useMemo(() => {
    const found = searchAirports(query).filter((a) => !onlyUnlocked || unlockedSet.has(a.iata))
    return found.sort(
      (a, b) =>
        Number(unlockedSet.has(b.iata)) - Number(unlockedSet.has(a.iata)) ||
        a.city.localeCompare(b.city),
    )
  }, [query, onlyUnlocked, unlockedSet])

  return (
    <>
      <div className="px-4 pb-2">
        <label className="relative block">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, country or code"
            aria-label="Search airports"
            className="w-full rounded-xl border border-line bg-space/60 py-2.5 pr-3 pl-10 text-sm font-bold outline-none transition focus:border-cyan"
          />
        </label>
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-muted">
          <span>
            {unlocked.length} of {AIRPORTS.length} unlocked
          </span>
          <button
            type="button"
            onClick={() => setOnlyUnlocked((v) => !v)}
            aria-pressed={onlyUnlocked}
            className={`rounded-full px-2.5 py-1 transition ${onlyUnlocked ? 'bg-cyan/20 text-cyan' : 'bg-white/5 hover:text-ink'}`}
          >
            Unlocked only
          </button>
        </div>
      </div>
      <div className="panel-scroll flex-1 overflow-y-auto px-3 pb-4">
        {rows.length === 0 && <p className="px-3 py-6 text-sm text-muted">No airports match.</p>}
        {rows.map((a) => {
          const isUnlocked = unlockedSet.has(a.iata)
          const isHq = airline?.hq === a.iata
          const active = selection?.kind === 'airport' && selection.iata === a.iata
          const price = airline ? currentUnlockPrice({ airline, unlockedAirports: unlocked }, a.iata) : null
          return (
            <button
              key={a.iata}
              type="button"
              onClick={() => {
                setSelection({ kind: 'airport', iata: a.iata })
                focusOn(a.lat, a.lon)
              }}
              className={`mb-1.5 flex w-full items-center gap-2 rounded-2xl p-2.5 text-left transition ${
                active ? 'bg-panel-2 ring-1 ring-cyan' : 'bg-panel-2/50 hover:bg-panel-2'
              }`}
            >
              <IataBadge iata={a.iata} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{a.city}</span>
                <span className="block truncate text-xs font-semibold text-muted">{a.country}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <ClassBadge cls={a.classification} />
                {isHq ? (
                  <span className="text-xs font-extrabold text-[#ffb020]">HQ</span>
                ) : isUnlocked ? (
                  <span className="text-xs font-extrabold text-good">Unlocked</span>
                ) : (
                  <span className="text-xs font-extrabold text-muted">{price !== null ? formatMoney(price) : ''}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function FutureAircraftToggle() {
  const enabled = useGameStore((s) => s.settings.futureAircraft)
  const set = useGameStore((s) => s.setFutureAircraft)
  return (
    <Toggle
      label="Upcoming aircraft"
      hint="Also sell jets not yet in airline service (737 MAX 7/10, 777-8/9)."
      checked={enabled}
      onChange={set}
    />
  )
}

function StartOver() {
  const [confirming, setConfirming] = useState(false)
  const resetGame = useGameStore((s) => s.resetGame)
  const hasAirline = useGameStore((s) => !!s.airline)
  if (!hasAirline) return null
  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="font-extrabold">Start over</div>
      <div className="text-xs text-muted">Deletes your airline and begins a new one.</div>
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              resetGame()
              useUiStore.getState().setSelection(null)
              useUiStore.getState().setDraftHq(null)
              useUiStore.getState().setSection('fleet')
              setConfirming(false)
            }}
            className="flex-1 rounded-xl bg-bad px-3 py-2 text-sm font-black text-white"
          >
            Yes, delete everything
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-line px-3 py-2 text-sm font-extrabold text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="mt-3 rounded-xl border border-bad/60 px-3 py-2 text-sm font-extrabold text-bad transition hover:bg-bad/10">
          Reset airline…
        </button>
      )}
    </div>
  )
}

export function LeftPanel() {
  const section = useUiStore((s) => s.activeSection)
  const autoRotate = useUiStore((s) => s.autoRotate)
  const setAutoRotate = useUiStore((s) => s.setAutoRotate)

  if (section === 'settings') {
    return (
      <aside className={shell}>
        <Header title="Settings" />
        <div className="panel-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          <Toggle
            label="Auto-rotate globe"
            hint="Slowly spins the globe until you take control."
            checked={autoRotate}
            onChange={setAutoRotate}
          />
          <FutureAircraftToggle />
          <SaveSection />
          {import.meta.env.DEV && <DevTools />}
          <StartOver />

        </div>
      </aside>
    )
  }

  if (section === 'fleet') return <FleetPanel />
  if (section === 'jobs') return <JobsPanel />
  if (section === 'market') return <MarketPanel />

  if (section === 'airports') {
    return (
      <aside className={shell}>
        <Header title="Airports" />
        <AirportsList />
      </aside>
    )
  }

  return <FinancesPanel />
}
