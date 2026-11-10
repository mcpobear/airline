import { ImportSave } from './SaveSection'
import { useMemo, useState } from 'react'
import { BALANCE } from '../config/balance'
import { AIRPORT_BY_IATA, groupByCity, searchAirports } from '../data/airports'
import { NAME_MAX, validateAirlineName } from '../sim/airline'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { ClassBadge, IataBadge } from './airportUi'
import { formatMoney } from './format'
import { SearchIcon } from './icons'

const shell =
  'fixed top-[76px] bottom-2 left-2 z-10 flex w-[380px] max-w-[calc(100vw-16px)] flex-col rounded-3xl border border-line/60 bg-panel/90 shadow-xl shadow-ink/15 backdrop-blur-md'
const primary =
  'w-full rounded-2xl bg-orange px-5 py-3 text-base font-black text-white shadow-[0_4px_0_0_var(--color-orange-dark)] transition hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--color-orange-dark)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'

/**
 * New-airline flow in the left panel slot so the map stays visible and
 * interactive: clicking an airport marker also picks the headquarters.
 */
export function NewAirline() {
  const [step, setStep] = useState<'name' | 'hq'>('name')
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const draftHq = useUiStore((s) => s.draftHq)
  const setDraftHq = useUiStore((s) => s.setDraftHq)
  const focusOn = useUiStore((s) => s.focusOn)
  const createAirline = useGameStore((s) => s.createAirline)

  const groups = useMemo(() => groupByCity(searchAirports(query)), [query])
  const nameCheck = validateAirlineName(name)
  const hq = draftHq ? AIRPORT_BY_IATA.get(draftHq) : undefined

  const pick = (iata: string) => {
    const a = AIRPORT_BY_IATA.get(iata)!
    setDraftHq(iata)
    focusOn(a.lat, a.lon)
  }

  const launch = () => {
    if (!hq) return
    const err = createAirline(name, hq.iata)
    if (err) return setError(err)
    setDraftHq(null)
    useUiStore.getState().setSelection({ kind: 'airport', iata: hq.iata })
    useUiStore.getState().setSection('fleet')
    useUiStore.getState().issueCameraCommand('hq')
  }

  if (step === 'name') {
    return (
      <aside className={shell}>
        <div className="px-5 pt-5">
          <div className="text-xs font-extrabold tracking-[0.14em] text-teal uppercase">Step 1 of 2</div>
          <h2 className="text-2xl font-black">Name your airline</h2>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Build a global network at your own pace: no deadlines, no competitors.
          </p>
          <label className="block">
            <span className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">Airline name</span>
            <input
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameCheck.ok && setStep('hq')}
              placeholder="e.g. Merlion Air"
              className="mt-1 w-full rounded-2xl border border-line bg-paper/60 px-4 py-3 text-lg font-bold outline-none transition focus:border-teal"
            />
          </label>
          <div className="mt-auto">
            <button type="button" className={primary} disabled={!nameCheck.ok} onClick={() => setStep('hq')}>
              Choose headquarters
            </button>
            <div className="mt-4 text-center text-sm text-muted">
              Already have a save file? <ImportSave />
            </div>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className={shell}>
      <div className="px-5 pt-5">
        <div className="text-xs font-extrabold tracking-[0.14em] text-teal uppercase">Step 2 of 2</div>
        <h2 className="text-2xl font-black">Choose headquarters</h2>
        <p className="mt-1 text-sm text-muted">Pick a city below or click an airport on the map.</p>
        <label className="relative mt-3 block">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, country or code"
            aria-label="Search airports"
            className="w-full rounded-xl border border-line bg-paper/60 py-2.5 pr-3 pl-10 text-sm font-bold outline-none transition focus:border-teal"
          />
        </label>
      </div>

      <div className="panel-scroll mt-3 flex-1 overflow-y-auto px-3">
        {groups.length === 0 && <p className="px-3 py-6 text-sm text-muted">No airports match “{query}”.</p>}
        {groups.map((g) => (
          <div key={g.key} className="mb-1.5 rounded-2xl bg-panel-2/50 p-2">
            <div className="px-2 pb-1 text-sm font-extrabold">
              {g.city} <span className="font-semibold text-muted">· {g.country}</span>
            </div>
            {g.airports.map((a) => (
              <button
                key={a.iata}
                type="button"
                onClick={() => pick(a.iata)}
                aria-pressed={draftHq === a.iata}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                  draftHq === a.iata ? 'bg-orange/25 ring-1 ring-orange' : 'hover:bg-ink/5'
                }`}
              >
                <IataBadge iata={a.iata} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">{a.name}</span>
                <ClassBadge cls={a.classification} />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-line/60 p-4">
        {hq ? (
          <div className="mb-3 text-sm leading-snug">
            <span className="font-extrabold">{name.trim()}</span> will be based at{' '}
            <span className="font-extrabold text-orange">
              {hq.city} ({hq.iata})
            </span>{' '}
            with <span className="font-extrabold text-good">{formatMoney(BALANCE.economy.startingCash)}</span> to start.
            <div className="mt-1 text-xs text-muted">You also start with two Airbus A220-100 jets.</div>
          </div>
        ) : (
          <div className="mb-3 text-sm text-muted">Select a headquarters to continue.</div>
        )}
        {error && <div className="mb-2 text-sm font-bold text-bad">{error}</div>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep('name')}
            className="rounded-2xl border border-line px-4 text-sm font-extrabold text-muted transition hover:text-ink"
          >
            Back
          </button>
          <button type="button" className={primary} disabled={!hq} onClick={launch}>
            Launch airline
          </button>
        </div>
      </div>
    </aside>
  )
}
