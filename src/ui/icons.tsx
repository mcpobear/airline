import type { ReactNode, SVGProps } from 'react'
import type { SectionId } from '../state/uiStore'

function Svg({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  )
}

const PlaneIcon = () => (
  <Svg fill="currentColor" stroke="none">
    <path d="M21 15.5v-1.8l-7.5-4.6V4.2a1.5 1.5 0 0 0-3 0v5L3 13.7v1.8l7.5-2.2v4.2l-2 1.5v1.3l3.5-1 3.5 1v-1.3l-2-1.5v-4.2z" />
  </Svg>
)
const TowerIcon = () => (
  <Svg>
    <path d="M12 21v-9M9 21h6M8 12h8l-1.2-5h-5.6zM10 7V4h4v3M7 4h10" />
  </Svg>
)
const BoxIcon = () => (
  <Svg>
    <path d="M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10" />
  </Svg>
)
const MarketIcon = () => (
  <Svg>
    <path d="M3 5h2l2.2 10.5h10.6L20 8H6.2M9 19.5h.01M17 19.5h.01" />
  </Svg>
)
const CoinsIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9s1 1.6 2.5 2 2.5.9 2.5 2-1.1 1.9-2.5 1.9c-1.1 0-2-.4-2.6-1.2M12 6v2M12 16v2" />
  </Svg>
)
const GearIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Svg>
)

export const SECTION_ICONS: Record<SectionId, () => ReactNode> = {
  fleet: PlaneIcon,
  airports: TowerIcon,
  jobs: BoxIcon,
  market: MarketIcon,
  finances: CoinsIcon,
  settings: GearIcon,
}

export const CloseIcon = () => (
  <Svg width="18" height="18" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const PlusIcon = () => (
  <Svg width="20" height="20" strokeWidth="2.4">
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const MinusIcon = () => (
  <Svg width="20" height="20" strokeWidth="2.4">
    <path d="M5 12h14" />
  </Svg>
)
export const TargetIcon = () => (
  <Svg width="20" height="20">
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
)

export const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
)

export const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4-4" />
  </svg>
)
