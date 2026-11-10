/**
 * Core domain models. These are plain serialisable data shapes with no
 * behaviour, shared by the simulation engine, persistence and UI.
 * The saved shape lives in `persistence/schema.ts`.
 */

export type AirportClass = 'international' | 'major' | 'regional'
export type AirportCategory = 'small' | 'medium' | 'large' | 'heavy'

export interface Airport {
  iata: string
  icao?: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
  classification: AirportClass
}

export interface AircraftModel {
  id: string
  manufacturer: 'Airbus' | 'Boeing' | 'COMAC'
  model: string
  passengerCapacity: number
  cargoCapacityKg: number
  rangeKm: number
  cruiseSpeedKmh: number
  price: number
  operatingCostPerKm: number
  airportCategory: AirportCategory
  visualCategory: 'regional' | 'narrowbody' | 'widebody' | 'jumbo'
  inService: boolean
  /** Shown to the player when `inService` is false. */
  serviceNote?: string
}

export type AircraftStatus = 'parked' | 'loading' | 'departing' | 'cruising' | 'arriving'

export interface Flight {
  from: string
  to: string
  /** Epoch ms. Persisted so progress survives refreshes and closed tabs. */
  departedAt: number
  arrivesAt: number
  distanceKm: number
}

export interface OwnedAircraft {
  id: string
  /** Display name, e.g. "A220-100 #1". */
  name: string
  registration: string
  modelId: string
  airport: string | null
  status: AircraftStatus
  flight: Flight | null
  loadedJobIds: string[]
  lifetimeRevenue: number
  lifetimeOperatingCost: number
  purchasePrice: number
}

export type JobKind = 'passenger' | 'cargo'
export type JobStatus = 'waiting' | 'loaded' | 'in_transit' | 'at_layover' | 'delivered'

/**
 * A passenger or cargo job. `destination` is the FINAL destination: it keeps it across layovers
 * and is paid only on delivery there. Jobs have no deadline and never expire.
 */
export interface Job {
  id: string
  kind: JobKind
  origin: string
  destination: string
  /** Passenger count for passenger jobs, kilograms for cargo jobs. */
  quantity: number
  reward: number
  currentAirport: string | null
  aircraftId: string | null
  status: JobStatus
}

export interface AirlineProfile {
  name: string
  hq: string
  cash: number
  lifetimeRevenue: number
  lifetimeOperatingCost: number
  /** Jobs delivered to their final destination (each is paid exactly once). */
  jobsDelivered: number
}
