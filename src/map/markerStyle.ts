import * as THREE from 'three'

/** Marker and label appearance, shared by the globe and the flat map. */
export type MarkerState = 'hq' | 'unlocked' | 'locked'

export const MARKER_COLORS = {
  hq: new THREE.Color('#e0581e'),
  unlocked: new THREE.Color('#0f8e86'),
  locked: new THREE.Color('#fdf8f0'),
  selected: new THREE.Color('#f2b705'),
}

export function markerState(iata: string, hq: string | undefined, unlocked: Set<string>): MarkerState {
  if (iata === hq) return 'hq'
  return unlocked.has(iata) ? 'unlocked' : 'locked'
}

/** Relative marker size by state, so headquarters and selection stand out. */
export function markerScale(state: MarkerState, selected: boolean): number {
  return state === 'hq' ? 1.7 : selected ? 1.5 : state === 'unlocked' ? 1.15 : 0.9
}

export const LABEL_BASE =
  'pointer-events-none absolute top-0 left-0 rounded-md px-1.5 py-0.5 text-[11px] font-black tracking-wide whitespace-nowrap shadow-sm will-change-transform'

export const LABEL_STYLE: Record<MarkerState | 'selected', string> = {
  hq: 'bg-orange text-white',
  unlocked: 'bg-panel/95 text-teal border border-teal/40',
  locked: 'bg-panel/80 text-muted',
  selected: 'bg-ink text-paper',
}

/** Aircraft colours on the map. */
export const PLANE_COLOR = new THREE.Color('#24474a')
export const PLANE_SELECTED = new THREE.Color('#c2491c')

/** Priority for decluttering labels: lower wins the space. */
export function labelRank(state: MarkerState, selected: boolean, classification: string): number {
  if (selected) return 0
  if (state === 'hq') return 1
  if (state === 'unlocked') return 2
  return 3 + (classification === 'international' ? 0 : classification === 'major' ? 1 : 2)
}

type Rect = [number, number, number, number]
export type { Rect }

export const overlaps = (a: Rect, b: Rect) => a[0] < b[2] + 2 && a[2] + 2 > b[0] && a[1] < b[3] + 2 && a[3] + 2 > b[1]

/** The label text for an airport: code, parked aircraft, inbound aircraft. */
export function labelText(iata: string, parked: number, inbound: number): string {
  return iata + (parked > 0 ? ` ✈${parked}` : '') + (inbound > 0 ? ` ↘${inbound}` : '')
}
