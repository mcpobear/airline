import { useShallow } from 'zustand/react/shallow'
import { nextJobRefreshAt } from '../sim/jobs'
import { toCore, useGameStore } from '../state/gameStore'
import { formatDuration } from './format'
import { useNow } from './useNow'

/**
 * Counts down to the next job-board turnover. Jobs you have already loaded are
 * not affected, so the wording says what is actually at stake.
 */
export function JobBoardTimer({ compact = false }: { compact?: boolean }) {
  const core = useGameStore(useShallow(toCore))
  const now = useNow(true)
  if (!core) return null
  const left = Math.max(0, nextJobRefreshAt(core, now) - now)
  if (compact) {
    return <span className="text-xs font-bold text-muted">New board in {formatDuration(left)}</span>
  }
  return (
    <p className="px-1 pb-1 text-xs text-muted">
      Select a parked aircraft to load these. These offers are replaced in{' '}
      <b className="text-ink">{formatDuration(left)}</b>; anything already loaded stays with your aircraft.
    </p>
  )
}
