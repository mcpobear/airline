import type { AirportClass } from '../types/game'

export const CLASS_LABEL: Record<AirportClass, string> = {
  international: 'International hub',
  major: 'Major',
  regional: 'Regional',
}

export function ClassBadge({ cls }: { cls: AirportClass }) {
  const tone =
    cls === 'international'
      ? 'bg-sky/20 text-sky'
      : cls === 'major'
        ? 'bg-teal/15 text-teal'
        : 'bg-ink/8 text-muted'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${tone}`}>
      {CLASS_LABEL[cls]}
    </span>
  )
}

export function IataBadge({ iata }: { iata: string }) {
  return (
    <span className="rounded-lg bg-paper/70 px-2 py-0.5 text-sm font-black tracking-wider">
      {iata}
    </span>
  )
}
