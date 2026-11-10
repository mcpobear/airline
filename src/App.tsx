import { lazy, Suspense, useEffect } from 'react'
import { StartHint } from './ui/StartHint'
import { StuckBanner } from './ui/StuckBanner'
import { useUiStore } from './state/uiStore'

import { CameraButtons } from './ui/CameraButtons'
import { LeftPanel } from './ui/LeftPanel'
import { RightPanel } from './ui/RightPanel'
import { NewAirline } from './ui/NewAirline'
import { Sidebar } from './ui/Sidebar'
import { PersistenceBanner } from './ui/PersistenceBanner'
import { usePersistStore } from './persistence/persistence'
import { FlightClock } from './ui/FlightClock'
import { Toasts } from './ui/Toasts'
import { useGameStore } from './state/gameStore'
import { StatusBar } from './ui/StatusBar'

// Three.js is large; loading the map separately lets the UI appear first.
const GlobeCanvas = lazy(() => import('./globe/GlobeCanvas').then((m) => ({ default: m.GlobeCanvas })))

/** Shown while the globe's code and imagery load. */
function MapLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center text-sm font-bold text-muted" role="status">
      Drawing the globe…
    </div>
  )
}

export function App() {
  const hasAirline = useGameStore((s) => !!s.airline)
  const status = usePersistStore((s) => s.status)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useUiStore.getState().setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="fixed inset-0 overflow-hidden bg-paper">
      <Suspense fallback={<MapLoading />}>
        <GlobeCanvas />
      </Suspense>
      <StatusBar />
      {hasAirline ? (
        <>
          <Sidebar />
          <LeftPanel />
          <RightPanel />
        </>
      ) : status === 'loading' ? (
        <div className="absolute inset-0 z-10 grid place-items-center text-sm font-bold text-muted">Loading your airline…</div>
      ) : status === 'corrupt' ? null : (
        <NewAirline />
      )}
      <PersistenceBanner />
      <CameraButtons />
      <Toasts />
      <FlightClock />
      {hasAirline && <StuckBanner />}
      {hasAirline && <StartHint />}
    </div>
  )
}
