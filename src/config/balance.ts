/**
 * Central balancing configuration.
 *
 * Every tunable gameplay number lives here, never in React components.
 * Phase 1 only consumes the `globe` and `time` blocks; the economy block is
 * declared up-front so later phases have a single place to rebalance from.
 */
export const BALANCE = {
  time: {
    /** 1 real flight-hour == 1 minute of gameplay, i.e. 60x acceleration. */
    flightTimeAcceleration: 60,
    /** Fixed allowance (real flight-minutes) for climb, descent and ground ops. */
    flightOverheadMinutes: 30,
  },
  economy: {
    startingCash: 500_000,
    aircraftResaleFraction: 0.6,
    passengerRevenuePerPaxKm: 0.12,
    cargoRevenuePerKgKm: 0.004,
    departureFixedCost: 1_500,
    /** One-off emergency funding offered only when the airline is completely stuck with no way to fly. */
    rescueGrant: 25_000,
  },
  aircraft: {
    starterModelId: 'a220-100',
    starterCount: 2,
    /** Largest aircraft category each airport class can handle. */
    airportMaxCategory: { regional: 'medium', major: 'large', international: 'heavy' },
  },
  airports: {
    /** Base unlock price by classification, before city and network scaling. */
    baseUnlockPrice: { international: 90_000, major: 55_000, regional: 22_000 },
    /** price *= cityBase + cityLogScale * log10(1 + metroMillions). */
    cityBase: 0.7,
    cityLogScale: 0.4,
    /** Each airport already unlocked adds this fraction to later prices... */
    networkGrowthPerAirport: 0.03,
    /** ...up to this multiplier, so expansion costs rise but never explode. */
    networkGrowthCap: 2,
    priceRounding: 500,
  },
  jobs: {
    /** Hard cap on jobs waiting at one airport. Generation stops at the cap; existing jobs are never deleted. */
    maxWaitingJobsPerAirport: 40,
    /** Jobs an airport is filled up to when it refills (bigger airports offer more). */
    targetJobs: { international: 24, major: 16, regional: 10 },
    /** An airport refills when waiting jobs fall below target x this fraction. */
    refillThresholdFraction: 0.5,
    /** Probability that a generated job is cargo rather than passengers. */
    cargoShare: { international: 0.4, major: 0.35, regional: 0.25 },
    minPassengers: 4,
    maxPassengers: { international: 90, major: 70, regional: 45 },
    minCargoKg: 100,
    maxCargoKg: { international: 3000, major: 1800, regional: 900 },
    /** Relative pull of a destination by its class; combined with sqrt(metro population) and distance decay. */
    destinationClassWeight: { international: 1.5, major: 1.0, regional: 0.6 },
    distanceDecayKm: 1500,
    distanceDecayPower: 1.2,
    /** Random +/- variation applied to each job's reward. */
    rewardVariation: 0.12,
    /** Jobs that must exist so a player never arrives somewhere with nothing to carry. */
    returnGuarantee: { toHq: 2, toNearest: 1, nearestCount: 2 },
    /** When an airport is unlocked, the HQ and this many nearest airports get jobs towards it. */
    newAirportFeeders: 5,
    jobsToNewAirport: 2,
    jobsToNewAirportFromHq: 3,
  },
  globe: {
    /** Icosphere subdivision; faces = 20 * (detail + 1)^2. */
    detail: 40,
    minDistance: 1.25,
    maxDistance: 6,
    defaultDistance: 3.1,
    /** Lighting. `ambient` is the night-side floor: higher = gentler day/night contrast. */
    sunIntensity: 2.2,
    ambient: 1.7,
    /** Default framing (Southeast Asia). Replaced by the HQ view in Phase 2. */
    defaultView: { lat: 15, lon: 105 },
    autoRotateSpeed: 0.35,
    /** Distance at which an airport's IATA label appears (unlocked/HQ/selected always show up to maxLabelDistance). */
    labelDistance: { international: 4.6, major: 3.0, regional: 2.2 },
    maxLabelDistance: 4.6,
    /** Camera distance when focusing an airport. */
    focusDistance: 2.3,
  },
} as const
