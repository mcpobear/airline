import type { AircraftModel, AirportCategory } from '../types/game'

/**
 * Aircraft database. Capacities are representative two/three-class airline
 * configurations (not certified maximums); cargo is simplified usable belly
 * space after passenger bags; range and speed are manufacturer figures rounded.
 *
 * Game prices are roughly real list prices / 100 (older types cheaper), and
 * operating cost per km is hand-tuned so bigger jets earn more but cost more.
 * Both are balancing values: expect to retune them in Phase 7.
 *
 * `inService` reflects real-world passenger service as of Nov 2026.
 */
type Row = [
  id: string,
  mfr: AircraftModel['manufacturer'],
  model: string,
  pax: number,
  cargoKg: number,
  rangeKm: number,
  speedKmh: number,
  price: number,
  costPerKm: number,
  category: AirportCategory,
  visual: AircraftModel['visualCategory'],
  inService?: string, // omitted = in service; otherwise the note explaining why not
]

const ROWS: Row[] = [
  // Airbus
  ['a220-100', 'Airbus', 'A220-100', 115, 1200, 6300, 828, 800_000, 5.4, 'small', 'regional'],
  ['a220-300', 'Airbus', 'A220-300', 140, 1800, 6200, 828, 960_000, 6.2, 'medium', 'narrowbody'],
  ['a319neo', 'Airbus', 'A319neo', 140, 2000, 6850, 833, 1_000_000, 6.6, 'medium', 'narrowbody'],
  ['a320neo', 'Airbus', 'A320neo', 165, 2800, 6500, 833, 1_100_000, 7.4, 'medium', 'narrowbody'],
  ['a321neo', 'Airbus', 'A321neo', 200, 3800, 6850, 833, 1_300_000, 8.6, 'medium', 'narrowbody'],
  ['a321lr', 'Airbus', 'A321LR', 200, 3000, 7400, 833, 1_350_000, 8.8, 'medium', 'narrowbody'],
  ['a321xlr', 'Airbus', 'A321XLR', 200, 2200, 8700, 833, 1_420_000, 9.0, 'medium', 'narrowbody'],
  ['a330-800', 'Airbus', 'A330-800', 257, 8000, 13900, 870, 2_500_000, 14.6, 'large', 'widebody'],
  ['a330-900', 'Airbus', 'A330-900', 287, 9500, 12130, 870, 2_900_000, 15.6, 'large', 'widebody'],
  ['a350-900', 'Airbus', 'A350-900', 325, 12000, 15000, 903, 3_100_000, 15.0, 'large', 'widebody'],
  ['a350-1000', 'Airbus', 'A350-1000', 370, 15000, 16100, 903, 3_600_000, 17.0, 'large', 'widebody'],
  ['a380-800', 'Airbus', 'A380-800', 500, 14000, 14800, 903, 4_400_000, 27.5, 'heavy', 'jumbo'],
  // Boeing
  ['b737-700', 'Boeing', '737-700', 126, 1500, 6200, 828, 700_000, 6.6, 'medium', 'narrowbody'],
  ['b737-800', 'Boeing', '737-800', 175, 2800, 5600, 842, 950_000, 8.9, 'medium', 'narrowbody'],
  ['b737max7', 'Boeing', '737 MAX 7', 138, 1800, 6500, 839, 1_000_000, 6.5, 'medium', 'narrowbody',
    'FAA-certified Aug 2026; first deliveries expected early 2027.'],
  ['b737max8', 'Boeing', '737 MAX 8', 175, 2800, 6500, 839, 1_150_000, 8.0, 'medium', 'narrowbody'],
  ['b737max9', 'Boeing', '737 MAX 9', 195, 3500, 6500, 839, 1_250_000, 8.8, 'medium', 'narrowbody'],
  ['b737max10', 'Boeing', '737 MAX 10', 215, 4200, 6100, 839, 1_350_000, 9.3, 'medium', 'narrowbody',
    'FAA-certified Oct 2026; first delivery expected early 2027.'],
  ['b767-300er', 'Boeing', '767-300ER', 235, 7500, 11070, 851, 1_800_000, 14.8, 'large', 'widebody'],
  ['b777-200er', 'Boeing', '777-200ER', 300, 14000, 13080, 905, 2_600_000, 17.5, 'large', 'widebody'],
  ['b777-300er', 'Boeing', '777-300ER', 365, 20000, 13650, 905, 3_500_000, 20.0, 'large', 'widebody'],
  ['b777-8', 'Boeing', '777-8', 350, 18000, 16170, 905, 3_900_000, 17.2, 'large', 'widebody',
    'In development; not yet certified or delivered.'],
  ['b777-9', 'Boeing', '777-9', 410, 22000, 13500, 905, 4_300_000, 19.0, 'large', 'widebody',
    'In flight testing; first deliveries targeted for 2027.'],
  ['b787-8', 'Boeing', '787-8', 242, 11000, 13530, 903, 2_400_000, 12.2, 'large', 'widebody'],
  ['b787-9', 'Boeing', '787-9', 290, 15000, 14010, 903, 2_900_000, 13.6, 'large', 'widebody'],
  ['b787-10', 'Boeing', '787-10', 330, 17000, 11910, 903, 3_300_000, 14.6, 'large', 'widebody'],
  ['b747-8i', 'Boeing', '747-8I', 410, 18000, 14320, 917, 4_000_000, 24.0, 'heavy', 'jumbo'],
  // COMAC
  ['c909', 'COMAC', 'C909', 90, 800, 2200, 828, 400_000, 4.2, 'small', 'regional'],
  ['c919', 'COMAC', 'C919', 164, 2700, 4075, 834, 950_000, 7.9, 'medium', 'narrowbody'],
]

export const AIRCRAFT: readonly AircraftModel[] = ROWS.map(
  ([id, manufacturer, model, passengerCapacity, cargoCapacityKg, rangeKm, cruiseSpeedKmh, price, operatingCostPerKm, airportCategory, visualCategory, note]) => ({
    id,
    manufacturer,
    model,
    passengerCapacity,
    cargoCapacityKg,
    rangeKm,
    cruiseSpeedKmh,
    price,
    operatingCostPerKm,
    airportCategory,
    visualCategory,
    inService: note === undefined,
    ...(note ? { serviceNote: note } : {}),
  }),
)

export const AIRCRAFT_BY_ID: ReadonlyMap<string, AircraftModel> = new Map(
  AIRCRAFT.map((m) => [m.id, m]),
)

export function getAircraftModel(id: string): AircraftModel | undefined {
  return AIRCRAFT_BY_ID.get(id)
}

export const modelLabel = (m: AircraftModel) => `${m.manufacturer} ${m.model}`
