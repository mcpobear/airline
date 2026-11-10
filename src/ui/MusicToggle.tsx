import { useEffect } from 'react'
import { useAudioStore } from '../state/audioStore'

/**
 * Starts the lounge music after the player's first interaction, which is when
 * browsers allow audio to begin, and offers a one-click mute.
 */
export function MusicToggle() {
  const enabled = useAudioStore((s) => s.enabled)
  const setEnabled = useAudioStore((s) => s.setEnabled)
  const unlock = useAudioStore((s) => s.unlock)

  useEffect(() => {
    const go = () => unlock()
    window.addEventListener('pointerdown', go, { once: true })
    window.addEventListener('keydown', go, { once: true })
    return () => {
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('keydown', go)
    }
  }, [unlock])

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? 'Mute lounge music' : 'Play lounge music'}
      title={enabled ? 'Mute lounge music' : 'Play lounge music'}
      onClick={() => setEnabled(!enabled)}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-line/60 transition ${
        enabled ? 'bg-teal/15 text-teal' : 'bg-panel text-muted hover:text-ink'
      }`}
    >
      {enabled ? <SpeakerOn /> : <SpeakerOff />}
    </button>
  )
}

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function SpeakerOn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" />
    </svg>
  )
}

function SpeakerOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...base} aria-hidden="true">
      <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5z" />
      <path d="m16 10 4 4M20 10l-4 4" />
    </svg>
  )
}
