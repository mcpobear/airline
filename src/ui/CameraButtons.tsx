import { useUiStore } from '../state/uiStore'
import { useGameStore } from '../state/gameStore'
import { HomeIcon, MinusIcon, PlusIcon, TargetIcon } from './icons'

const btn =
  'grid h-11 w-11 place-items-center rounded-xl border border-line/60 bg-panel/90 text-ink shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-panel-2 hover:text-cyan'

export function CameraButtons() {
  const issue = useUiStore((s) => s.issueCameraCommand)
  const hasAirline = useGameStore((s) => !!s.airline)
  return (
    <div className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
      <button type="button" aria-label="Zoom out" title="Zoom out" className={btn} onClick={() => issue('zoomOut')}>
        <MinusIcon />
      </button>
      <button type="button" aria-label="Reset camera" title="Reset camera" className={btn} onClick={() => issue('reset')}>
        <TargetIcon />
      </button>
      {hasAirline && (
        <button type="button" aria-label="Go to headquarters" title="Go to headquarters" className={btn} onClick={() => issue('hq')}>
          <HomeIcon />
        </button>
      )}
      <button type="button" aria-label="Zoom in" title="Zoom in" className={btn} onClick={() => issue('zoomIn')}>
        <PlusIcon />
      </button>
    </div>
  )
}
