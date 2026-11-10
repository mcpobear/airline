import { useEffect } from 'react'
import { useGameStore } from '../state/gameStore'

/**
 * Drives the simulation clock. Ticks twice a second, and immediately when
 * the tab becomes visible again (timers are throttled in background tabs).
 * Because flights are defined by timestamps, this is also how a flight that
 * ended while the browser was closed gets reconciled.
 */
export function FlightClock() {
  const tick = useGameStore((s) => s.tick)
  useEffect(() => {
    const run = () => tick(Date.now())
    run()
    const id = setInterval(run, 500)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
    }
  }, [tick])
  return null
}
