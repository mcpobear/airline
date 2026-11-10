import { getAirport } from '../data/airports'
import { currentUnlockPrice, unlockBlocker } from '../sim/airline'
import { useNotifyStore } from '../state/notifyStore'
import { getAircraftModel } from '../data/aircraft'
import { distanceKm } from '../sim/geo'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { ClassBadge, IataBadge } from './airportUi'
import { formatMoney } from './format'
import { rightShell } from './panelParts'
import { JobRow, ghostButton } from './jobUi'
import { waitingJobsAt } from '../sim/jobs'
import { CloseIcon } from './icons'
import { formatDuration } from './format'
import { useNow } from './useNow'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel-2/70 p-4">
      <div className="text-xs font-extrabold tracking-[0.14em] text-muted uppercase">{title}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}

export function AirportPanel({ iata }: { iata: string }) {
  const airport = getAirport(iata)
  const airline = useGameStore((s) => s.airline)
  const unlockedAirports = useGameStore((s) => s.unlockedAirports)
  const unlock = useGameStore((s) => s.unlockAirport)
  const setSelection = useUiStore((s) => s.setSelection)
  const aircraft = useGameStore((s) => s.aircraft)
  const allJobs = useGameStore((s) => s.jobs)
  const setSection = useUiStore((s) => s.setSection)
  const setJobsAirport = useUiStore((s) => s.setJobsAirport)
  const notify = useNotifyStore((s) => s.push)
  const incoming = aircraft.filter((a) => a.flight?.to === iata).sort((a, b) => a.flight!.arrivesAt - b.flight!.arrivesAt)
  const now = useNow(incoming.length > 0)
  if (!airport || !airline) return null

  const hq = getAirport(airline.hq)!
  const isHq = airline.hq === iata
  const isUnlocked = unlockedAirports.includes(iata)
  const game = { airline, unlockedAirports }
  const parked = aircraft.filter((a) => a.airport === iata)
  const waiting = waitingJobsAt(allJobs, iata).sort((a, b) => b.reward - a.reward)
  const paxJobs = waiting.filter((j) => j.kind === 'passenger')
  const cargoJobs = waiting.filter((j) => j.kind === 'cargo')
  const seeAll = () => {
    setJobsAirport(iata)
    setSection('jobs')
  }
  const price = currentUnlockPrice(game, iata)!
  const blocker = isUnlocked ? null : unlockBlocker(game, iata)
  const short = Math.max(0, price - airline.cash)
  const fromHq = Math.round(distanceKm(hq, airport))

  return (
    <aside className={rightShell}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black">{airport.city}</h2>
            <IataBadge iata={iata} />
          </div>
          <div className="text-sm font-semibold text-muted">
            {airport.name}
            {airport.country !== airport.city && ` · ${airport.country}`}
          </div>
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

      <div className="flex flex-wrap gap-2">
        <ClassBadge cls={airport.classification} />
        {isHq ? (
          <span className="rounded-full bg-orange/15 px-2.5 py-0.5 text-xs font-extrabold text-orange">Headquarters</span>
        ) : isUnlocked ? (
          <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-extrabold text-good">Unlocked</span>
        ) : (
          <span className="rounded-full bg-ink/8 px-2.5 py-0.5 text-xs font-extrabold text-muted">Locked</span>
        )}
      </div>

      <Section title="Details">
        <div className="flex justify-between"><span className="text-muted">ICAO</span><b>{airport.icao}</b></div>
        <div className="flex justify-between"><span className="text-muted">Metro population</span><b>~{airport.metroMillions}M</b></div>
        <div className="flex justify-between">
          <span className="text-muted">{isHq ? 'Role' : `From ${airline.hq}`}</span>
          <b>{isHq ? 'Home base' : `${fromHq.toLocaleString('en-US')} km`}</b>
        </div>
      </Section>

      {isUnlocked ? (
        <>
          {([['Passenger jobs', paxJobs], ['Cargo jobs', cargoJobs]] as const).map(([title, list]) => (
            <Section key={title} title={`${title} (${list.length})`}>
              {list.length === 0 && <span className="text-muted">None waiting.</span>}
              {list.slice(0, 3).map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
              {list.length > 3 && (
                <button type="button" onClick={seeAll} className={`${ghostButton} mt-2`}>
                  See all {list.length} in Jobs
                </button>
              )}
            </Section>
          ))}
          <Section title={`Parked aircraft (${parked.length})`}>
            {parked.length === 0 && <span className="text-muted">None parked here.</span>}
            {parked.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelection({ kind: 'aircraft', id: a.id })}
                className="mt-1 flex w-full items-center justify-between rounded-lg bg-paper/40 px-2.5 py-1.5 text-left transition hover:bg-paper/70"
              >
                <span className="font-extrabold">{a.name}</span>
                <span className="text-xs font-bold text-muted">{getAircraftModel(a.modelId)?.model} · {a.registration}</span>
              </button>
            ))}
          </Section>
          <Section title={`Incoming aircraft (${incoming.length})`}>
            {incoming.length === 0 && <span className="text-muted">None en route.</span>}
            {incoming.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelection({ kind: 'aircraft', id: a.id })}
                className="mt-1 flex w-full items-center justify-between rounded-lg bg-paper/40 px-2.5 py-1.5 text-left transition hover:bg-paper/70"
              >
                <span className="font-extrabold">{a.name}</span>
                <span className="text-xs font-bold text-muted">from {a.flight!.from} · {formatDuration(a.flight!.arrivesAt - now)}</span>
              </button>
            ))}
          </Section>
        </>
      ) : (
        <div className="rounded-2xl bg-panel-2/70 p-4">
          <p className="text-sm leading-relaxed">
            Unlock {airport.city} to fly here, load jobs, and use it as a layover.
          </p>
          <button
            type="button"
            disabled={!!blocker}
            onClick={() => {
              const err = unlock(iata)
              notify(err ?? `Unlocked ${airport.city} (${iata}).`, err ? 'bad' : 'good')
            }}
            className="mt-3 w-full rounded-2xl bg-orange px-5 py-3 text-base font-black text-white shadow-[0_4px_0_0_var(--color-orange-dark)] transition hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--color-orange-dark)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Unlock · {formatMoney(price)}
          </button>
          {blocker && (
            <p className="mt-2 text-xs font-bold text-bad">
              Need {formatMoney(short)} more to unlock this airport.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
