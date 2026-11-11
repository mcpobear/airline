import { useMemo, useState } from 'react'
import { getAirport } from '../data/airports'
import { waitingJobsAt } from '../sim/jobs'
import { JobBoardTimer } from './JobBoardTimer'
import { useGameStore } from '../state/gameStore'
import { useNotifyStore } from '../state/notifyStore'
import { useUiStore } from '../state/uiStore'
import { ghostButton, JobRow } from './jobUi'
import { leftShell, PanelHeader } from './panelParts'

const KINDS = [
  ['all', 'All'],
  ['passenger', 'Passengers'],
  ['cargo', 'Cargo'],
] as const

/** Waiting jobs at one airport. Jobs never expire; they wait until you take or dismiss them. */
export function JobsPanel() {
  const hq = useGameStore((s) => s.airline?.hq)
  const unlocked = useGameStore((s) => s.unlockedAirports)
  const jobs = useGameStore((s) => s.jobs)
  const dismiss = useGameStore((s) => s.dismissJob)
  const notify = useNotifyStore((s) => s.push)
  const stored = useUiStore((s) => s.jobsAirport)
  const setJobsAirport = useUiStore((s) => s.setJobsAirport)
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('all')

  const airport = stored && unlocked.includes(stored) ? stored : (hq ?? '')
  const waiting = useMemo(() => waitingJobsAt(jobs, airport).sort((a, b) => b.reward - a.reward), [jobs, airport])
  const shown = waiting.filter((j) => kind === 'all' || j.kind === kind)
  const options = useMemo(
    () => [...unlocked].sort((a, b) => (getAirport(a)?.city ?? '').localeCompare(getAirport(b)?.city ?? '')),
    [unlocked],
  )

  return (
    <aside className={leftShell}>
      <PanelHeader title="Jobs" hint={`${waiting.length} waiting`} />
      <div className="px-4 pb-2">
        <select
          aria-label="Airport"
          value={airport}
          onChange={(e) => setJobsAirport(e.target.value)}
          className="w-full rounded-xl border border-line bg-paper/60 px-3 py-2.5 text-sm font-bold outline-none focus:border-teal"
        >
          {options.map((iata) => (
            <option key={iata} value={iata}>
              {iata} · {getAirport(iata)?.city} ({waitingJobsAt(jobs, iata).length})
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-1.5">
          {KINDS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                kind === id ? 'bg-teal/20 text-teal' : 'bg-ink/5 text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-scroll flex-1 overflow-y-auto px-3 pt-1 pb-4">
        <JobBoardTimer />
        {shown.length === 0 && (
          <p className="px-1 py-4 text-sm text-muted">
            {unlocked.length < 2
              ? 'Unlock a second airport to start generating jobs.'
              : 'No jobs of this kind waiting here.'}
          </p>
        )}
        {shown.map((j) => (
          <JobRow
            key={j.id}
            job={j}
            action={
              <button
                type="button"
                title="Remove this job (the board may add a new one)"
                onClick={() => {
                  const err = dismiss(j.id)
                  if (err) notify(err, 'bad')
                }}
                className={ghostButton}
              >
                Dismiss
              </button>
            }
          />
        ))}
      </div>
    </aside>
  )
}
