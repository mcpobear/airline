import { useUiStore, type SectionId } from '../state/uiStore'
import { SECTION_ICONS } from './icons'

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'airports', label: 'Airports' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'market', label: 'Market' },
  { id: 'finances', label: 'Finances' },
  { id: 'settings', label: 'Settings' },
]

export function Sidebar() {
  const active = useUiStore((s) => s.activeSection)
  const setSection = useUiStore((s) => s.setSection)

  return (
    <nav
      aria-label="Main navigation"
      className="fixed top-[132px] left-1 z-20 flex w-[68px] flex-col gap-1 rounded-2xl border border-line/60 bg-panel/90 p-1.5 shadow-lg shadow-ink/15 backdrop-blur-md"
    >
      {SECTIONS.map(({ id, label }) => {
        const Icon = SECTION_ICONS[id]
        const selected = id === active
        return (
          <button
            key={id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => setSection(id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-extrabold transition ${
              selected
                ? 'bg-orange text-white shadow-md shadow-orange/30'
                : 'text-muted hover:bg-ink/5 hover:text-teal'
            }`}
          >
            <Icon />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
