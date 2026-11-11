import { useUiStore } from '../state/uiStore'
import { useGameStore } from '../state/gameStore'
import { HomeIcon, MinusIcon, PlusIcon, TargetIcon } from './icons'
import { useCompact } from './useCompact'

const btn =
  'grid h-11 w-11 place-items-center rounded-xl border border-line/60 bg-panel/90 text-ink shadow-lg shadow-ink/15 backdrop-blur-md transition hover:bg-panel-2 hover:text-teal'

export function CameraButtons() {
  const issue = useUiStore((s) => s.issueCameraCommand)
  const hasAirline = useGameStore((s) => !!s.airline)
  const selection = useUiStore((s) => s.selection)
  const panelOpen = useUiStore((s) => s.panelOpen)
  const compact = useCompact()
  // On a phone a panel or a context sheet covers the map, and the column of
  // buttons would be left poking out from behind it with nothing to aim at.
  if (compact && (panelOpen || selection)) return null
  return (
    <div className="fixed z-[5] flex gap-2 bottom-[calc(var(--nav-h)+16px)] left-1/2 -translate-x-1/2 max-lg:left-auto max-lg:right-2 max-lg:translate-x-0 max-lg:top-[var(--panel-top)] max-lg:bottom-auto max-lg:flex-col">
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
