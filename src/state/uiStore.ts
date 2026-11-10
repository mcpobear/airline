import { create } from 'zustand'

export type MapMode = 'flat' | 'globe'

const MAP_MODE_KEY = 'global-airline.mapMode'

/** Reading browser storage can throw (private mode, blocked storage), so a miss just means the default. */
function storedMapMode(): MapMode {
  try {
    return localStorage.getItem(MAP_MODE_KEY) === 'globe' ? 'globe' : 'flat'
  } catch {
    return 'flat'
  }
}

export type SectionId = 'fleet' | 'airports' | 'jobs' | 'market' | 'finances' | 'settings'

/** What the right-hand context panel is showing.  */
export type Selection =
  | { kind: 'point'; lat: number; lon: number }
  | { kind: 'airport'; iata: string }
  | { kind: 'aircraft'; id: string }
  | null

export type CameraCommandKind = 'reset' | 'hq' | 'zoomIn' | 'zoomOut' | 'focus'
export interface CameraCommand {
  /** Monotonic id so repeating the same command re-triggers it. */
  id: number
  kind: CameraCommandKind
  lat?: number
  lon?: number
}

interface UiState {
  activeSection: SectionId
  selection: Selection
  /** Headquarters being chosen while creating an airline. */
  draftHq: string | null
  /** Airport whose waiting jobs the Jobs panel shows (null = HQ). */
  jobsAirport: string | null
  cameraCommand: CameraCommand
  autoRotate: boolean
  /** Route being considered in the dispatch panel (drawn as a preview line). */
  previewRoute: { from: string; to: string } | null
  /** Aircraft the camera follows while it flies (null = free camera). */
  followAircraftId: string | null
  /** Flat map or 3D globe. Remembered in this browser, not part of the save. */
  mapMode: MapMode
  setMapMode: (m: MapMode) => void
  setPreviewRoute: (r: { from: string; to: string } | null) => void
  setFollowAircraft: (id: string | null) => void
  setSection: (s: SectionId) => void
  setSelection: (s: Selection) => void
  setDraftHq: (iata: string | null) => void
  setJobsAirport: (iata: string | null) => void
  issueCameraCommand: (kind: Exclude<CameraCommandKind, 'focus'>) => void
  focusOn: (lat: number, lon: number) => void
  setAutoRotate: (v: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  activeSection: 'fleet',
  selection: null,
  draftHq: null,
  jobsAirport: null,
  cameraCommand: { id: 0, kind: 'reset' },
  autoRotate: true,
  previewRoute: null,
  followAircraftId: null,
  mapMode: storedMapMode(),
  setMapMode: (mapMode) => {
    try {
      localStorage.setItem(MAP_MODE_KEY, mapMode)
    } catch {
      // A browser that refuses storage just forgets the choice next time.
    }
    set({ mapMode })
  },
  setPreviewRoute: (previewRoute) => set({ previewRoute }),
  setFollowAircraft: (followAircraftId) => set(followAircraftId ? { followAircraftId, autoRotate: false } : { followAircraftId }),
  setSection: (activeSection) => set({ activeSection }),
  setSelection: (selection) => set({ selection }),
  setDraftHq: (draftHq) => set({ draftHq }),
  setJobsAirport: (jobsAirport) => set({ jobsAirport }),
  issueCameraCommand: (kind) =>
    set((s) => ({ cameraCommand: { id: s.cameraCommand.id + 1, kind } })),
  focusOn: (lat, lon) =>
    set((s) => ({
      cameraCommand: { id: s.cameraCommand.id + 1, kind: 'focus', lat, lon },
      autoRotate: false,
    })),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
}))
