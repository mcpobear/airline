import type { Airport, AirportClass } from '../types/game'

/**
 * Curated airport database. Codes and coordinates are real (airport reference
 * points, rounded to 4 decimals). `metroMillions` is an approximate metro-area
 * population used only for balancing (unlock price now, job demand in Phase 4).
 *
 * To expand: append a row. `airports.test.ts` guards uniqueness and ranges.
 */
export interface AirportRecord extends Airport {
  metroMillions: number
}

type Row = [
  iata: string,
  icao: string,
  name: string,
  city: string,
  country: string,
  lat: number,
  lon: number,
  cls: 'I' | 'M' | 'R',
  metroMillions: number,
]

const CLASS: Record<Row[7], AirportClass> = { I: 'international', M: 'major', R: 'regional' }

const ROWS: Row[] = [
  // Southeast Asia
  ['SIN', 'WSSS', 'Changi Airport', 'Singapore', 'Singapore', 1.3644, 103.9915, 'I', 5.9],
  ['KUL', 'WMKK', 'Kuala Lumpur International', 'Kuala Lumpur', 'Malaysia', 2.7456, 101.7099, 'I', 8.4],
  ['PEN', 'WMKP', 'Penang International', 'George Town', 'Malaysia', 5.2971, 100.2768, 'R', 1.8],
  ['BKK', 'VTBS', 'Suvarnabhumi Airport', 'Bangkok', 'Thailand', 13.69, 100.7501, 'I', 11],
  ['DMK', 'VTBD', 'Don Mueang International', 'Bangkok', 'Thailand', 13.9126, 100.6067, 'M', 11],
  ['HKT', 'VTSP', 'Phuket International', 'Phuket', 'Thailand', 8.1132, 98.3169, 'R', 0.4],
  ['CNX', 'VTCC', 'Chiang Mai International', 'Chiang Mai', 'Thailand', 18.7668, 98.9626, 'R', 1.2],
  ['CGK', 'WIII', 'Soekarno-Hatta International', 'Jakarta', 'Indonesia', -6.1256, 106.6559, 'I', 11],
  ['DPS', 'WADD', 'Ngurah Rai International', 'Denpasar', 'Indonesia', -8.7482, 115.1675, 'M', 0.9],
  ['SUB', 'WARR', 'Juanda International', 'Surabaya', 'Indonesia', -7.3798, 112.7868, 'M', 3],
  ['MNL', 'RPLL', 'Ninoy Aquino International', 'Manila', 'Philippines', 14.5086, 121.0194, 'I', 14],
  ['CEB', 'RPVM', 'Mactan-Cebu International', 'Cebu', 'Philippines', 10.3075, 123.9794, 'R', 1],
  ['SGN', 'VVTS', 'Tan Son Nhat International', 'Ho Chi Minh City', 'Vietnam', 10.8188, 106.652, 'M', 9],
  ['HAN', 'VVNB', 'Noi Bai International', 'Hanoi', 'Vietnam', 21.2212, 105.8072, 'M', 8],
  ['DAD', 'VVDN', 'Da Nang International', 'Da Nang', 'Vietnam', 16.0439, 108.1992, 'R', 1.2],
  ['RGN', 'VYYY', 'Yangon International', 'Yangon', 'Myanmar', 16.9073, 96.1332, 'R', 5.4],
  ['VTE', 'VLVT', 'Wattay International', 'Vientiane', 'Laos', 17.9883, 102.5633, 'R', 0.9],
  ['BWN', 'WBSB', 'Brunei International', 'Bandar Seri Begawan', 'Brunei', 4.9442, 114.9284, 'R', 0.1],
  // East Asia
  ['HKG', 'VHHH', 'Hong Kong International', 'Hong Kong', 'Hong Kong', 22.308, 113.9185, 'I', 7.5],
  ['TPE', 'RCTP', 'Taiwan Taoyuan International', 'Taipei', 'Taiwan', 25.0777, 121.2328, 'I', 7],
  ['HND', 'RJTT', 'Haneda Airport', 'Tokyo', 'Japan', 35.5494, 139.7798, 'I', 37],
  ['NRT', 'RJAA', 'Narita International', 'Tokyo', 'Japan', 35.772, 140.3929, 'M', 37],
  ['KIX', 'RJBB', 'Kansai International', 'Osaka', 'Japan', 34.4273, 135.244, 'M', 19],
  ['ITM', 'RJOO', 'Itami Airport', 'Osaka', 'Japan', 34.7855, 135.438, 'R', 19],
  ['FUK', 'RJFF', 'Fukuoka Airport', 'Fukuoka', 'Japan', 33.5859, 130.4507, 'R', 2.6],
  ['CTS', 'RJCC', 'New Chitose Airport', 'Sapporo', 'Japan', 42.7752, 141.6923, 'R', 2.7],
  ['ICN', 'RKSI', 'Incheon International', 'Seoul', 'South Korea', 37.4602, 126.4407, 'I', 25],
  ['GMP', 'RKSS', 'Gimpo International', 'Seoul', 'South Korea', 37.5583, 126.7906, 'R', 25],
  ['PEK', 'ZBAA', 'Beijing Capital International', 'Beijing', 'China', 40.0801, 116.5846, 'I', 21],
  ['PKX', 'ZBAD', 'Beijing Daxing International', 'Beijing', 'China', 39.5098, 116.4105, 'M', 21],
  ['PVG', 'ZSPD', 'Shanghai Pudong International', 'Shanghai', 'China', 31.1443, 121.8083, 'I', 25],
  ['SHA', 'ZSSS', 'Shanghai Hongqiao International', 'Shanghai', 'China', 31.1979, 121.3363, 'M', 25],
  ['CAN', 'ZGGG', 'Guangzhou Baiyun International', 'Guangzhou', 'China', 23.3924, 113.2988, 'I', 19],
  ['SZX', 'ZGSZ', "Shenzhen Bao'an International", 'Shenzhen', 'China', 22.6393, 113.8107, 'M', 13],
  ['CTU', 'ZUUU', 'Chengdu Shuangliu International', 'Chengdu', 'China', 30.5785, 103.9471, 'M', 21],
  ['XIY', 'ZLXY', "Xi'an Xianyang International", "Xi'an", 'China', 34.4471, 108.7516, 'M', 13],
  // South Asia
  ['DEL', 'VIDP', 'Indira Gandhi International', 'Delhi', 'India', 28.5562, 77.1, 'I', 32],
  ['BOM', 'VABB', 'Chhatrapati Shivaji Maharaj International', 'Mumbai', 'India', 19.0896, 72.8656, 'I', 21],
  ['BLR', 'VOBL', 'Kempegowda International', 'Bengaluru', 'India', 13.1986, 77.7066, 'M', 13],
  ['MAA', 'VOMM', 'Chennai International', 'Chennai', 'India', 12.99, 80.1693, 'M', 11],
  ['CCU', 'VECC', 'Netaji Subhas Chandra Bose International', 'Kolkata', 'India', 22.6547, 88.4467, 'M', 15],
  ['HYD', 'VOHS', 'Rajiv Gandhi International', 'Hyderabad', 'India', 17.2403, 78.4294, 'M', 10],
  ['CMB', 'VCBI', 'Bandaranaike International', 'Colombo', 'Sri Lanka', 7.1808, 79.8841, 'R', 2.4],
  ['DAC', 'VGHS', 'Hazrat Shahjalal International', 'Dhaka', 'Bangladesh', 23.8433, 90.3978, 'M', 23],
  ['KHI', 'OPKC', 'Jinnah International', 'Karachi', 'Pakistan', 24.9065, 67.1608, 'M', 17],
  ['MLE', 'VRMM', 'Velana International', 'Malé', 'Maldives', 4.1918, 73.5291, 'R', 0.2],
  ['KTM', 'VNKT', 'Tribhuvan International', 'Kathmandu', 'Nepal', 27.6966, 85.3591, 'R', 1.5],
  // Middle East & Central Asia
  ['DXB', 'OMDB', 'Dubai International', 'Dubai', 'United Arab Emirates', 25.2532, 55.3657, 'I', 3.6],
  ['AUH', 'OMAA', 'Zayed International', 'Abu Dhabi', 'United Arab Emirates', 24.433, 54.6511, 'M', 1.5],
  ['DOH', 'OTHH', 'Hamad International', 'Doha', 'Qatar', 25.2731, 51.6081, 'I', 2.4],
  ['RUH', 'OERK', 'King Khalid International', 'Riyadh', 'Saudi Arabia', 24.9576, 46.6988, 'M', 7.7],
  ['JED', 'OEJN', 'King Abdulaziz International', 'Jeddah', 'Saudi Arabia', 21.6796, 39.1565, 'M', 4.7],
  ['IST', 'LTFM', 'Istanbul Airport', 'Istanbul', 'Türkiye', 41.2753, 28.7519, 'I', 15.5],
  ['TLV', 'LLBG', 'Ben Gurion Airport', 'Tel Aviv', 'Israel', 32.0114, 34.8867, 'M', 4],
  ['AMM', 'OJAI', 'Queen Alia International', 'Amman', 'Jordan', 31.7226, 35.9932, 'R', 4],
  ['KWI', 'OKBK', 'Kuwait International', 'Kuwait City', 'Kuwait', 29.2266, 47.9689, 'R', 3.2],
  ['MCT', 'OOMS', 'Muscat International', 'Muscat', 'Oman', 23.5933, 58.2844, 'R', 1.6],
  ['ALA', 'UAAA', 'Almaty International', 'Almaty', 'Kazakhstan', 43.3521, 77.0405, 'R', 2],
  ['TAS', 'UTTT', 'Islam Karimov Tashkent International', 'Tashkent', 'Uzbekistan', 41.2579, 69.2812, 'R', 2.9],
  ['GYD', 'UBBB', 'Heydar Aliyev International', 'Baku', 'Azerbaijan', 40.4675, 50.0467, 'R', 2.3],
  // Europe
  ['LHR', 'EGLL', 'Heathrow Airport', 'London', 'United Kingdom', 51.47, -0.4543, 'I', 9.8],
  ['LGW', 'EGKK', 'Gatwick Airport', 'London', 'United Kingdom', 51.1537, -0.1821, 'M', 9.8],
  ['MAN', 'EGCC', 'Manchester Airport', 'Manchester', 'United Kingdom', 53.3537, -2.275, 'M', 2.8],
  ['EDI', 'EGPH', 'Edinburgh Airport', 'Edinburgh', 'United Kingdom', 55.95, -3.3725, 'R', 0.9],
  ['DUB', 'EIDW', 'Dublin Airport', 'Dublin', 'Ireland', 53.4264, -6.2499, 'M', 1.4],
  ['CDG', 'LFPG', 'Charles de Gaulle Airport', 'Paris', 'France', 49.0097, 2.5479, 'I', 11],
  ['ORY', 'LFPO', 'Orly Airport', 'Paris', 'France', 48.7233, 2.3794, 'M', 11],
  ['NCE', 'LFMN', "Nice Côte d'Azur Airport", 'Nice', 'France', 43.6584, 7.2159, 'R', 1],
  ['AMS', 'EHAM', 'Amsterdam Schiphol', 'Amsterdam', 'Netherlands', 52.3105, 4.7683, 'I', 2.5],
  ['FRA', 'EDDF', 'Frankfurt Airport', 'Frankfurt', 'Germany', 50.0379, 8.5622, 'I', 5.8],
  ['MUC', 'EDDM', 'Munich Airport', 'Munich', 'Germany', 48.3537, 11.775, 'M', 2.9],
  ['BER', 'EDDB', 'Berlin Brandenburg Airport', 'Berlin', 'Germany', 52.3667, 13.5033, 'M', 4.5],
  ['MAD', 'LEMD', 'Adolfo Suárez Madrid-Barajas', 'Madrid', 'Spain', 40.4983, -3.5676, 'I', 6.8],
  ['BCN', 'LEBL', 'Barcelona-El Prat', 'Barcelona', 'Spain', 41.2971, 2.0785, 'M', 5.6],
  ['LIS', 'LPPT', 'Humberto Delgado Airport', 'Lisbon', 'Portugal', 38.7813, -9.1359, 'M', 3],
  ['FCO', 'LIRF', 'Leonardo da Vinci-Fiumicino', 'Rome', 'Italy', 41.8003, 12.2389, 'M', 4.3],
  ['MXP', 'LIMC', 'Milan Malpensa', 'Milan', 'Italy', 45.6306, 8.7281, 'M', 5],
  ['ZRH', 'LSZH', 'Zurich Airport', 'Zurich', 'Switzerland', 47.4647, 8.5492, 'M', 1.4],
  ['GVA', 'LSGG', 'Geneva Airport', 'Geneva', 'Switzerland', 46.2381, 6.1089, 'R', 0.6],
  ['VIE', 'LOWW', 'Vienna International', 'Vienna', 'Austria', 48.1103, 16.5697, 'M', 2.9],
  ['CPH', 'EKCH', 'Copenhagen Airport', 'Copenhagen', 'Denmark', 55.618, 12.6508, 'M', 2],
  ['ARN', 'ESSA', 'Stockholm Arlanda', 'Stockholm', 'Sweden', 59.6498, 17.9238, 'M', 2.4],
  ['OSL', 'ENGM', 'Oslo Gardermoen', 'Oslo', 'Norway', 60.1976, 11.1004, 'M', 1.6],
  ['HEL', 'EFHK', 'Helsinki-Vantaa', 'Helsinki', 'Finland', 60.3172, 24.9633, 'M', 1.5],
  ['ATH', 'LGAV', 'Athens Eleftherios Venizelos', 'Athens', 'Greece', 37.9364, 23.9445, 'M', 3.6],
  ['WAW', 'EPWA', 'Warsaw Chopin Airport', 'Warsaw', 'Poland', 52.1657, 20.9671, 'R', 3.1],
  ['PRG', 'LKPR', 'Václav Havel Airport Prague', 'Prague', 'Czechia', 50.1008, 14.26, 'R', 1.4],
  ['BUD', 'LHBP', 'Budapest Ferenc Liszt International', 'Budapest', 'Hungary', 47.4369, 19.2556, 'R', 3],
  ['KEF', 'BIKF', 'Keflavík International', 'Reykjavík', 'Iceland', 63.985, -22.6056, 'R', 0.25],
  // Africa
  ['CAI', 'HECA', 'Cairo International', 'Cairo', 'Egypt', 30.1219, 31.4056, 'M', 22],
  ['JNB', 'FAOR', 'O. R. Tambo International', 'Johannesburg', 'South Africa', -26.1392, 28.246, 'I', 10],
  ['CPT', 'FACT', 'Cape Town International', 'Cape Town', 'South Africa', -33.9715, 18.6021, 'M', 4.8],
  ['ADD', 'HAAB', 'Bole International', 'Addis Ababa', 'Ethiopia', 8.9779, 38.7993, 'M', 5],
  ['NBO', 'HKJK', 'Jomo Kenyatta International', 'Nairobi', 'Kenya', -1.3192, 36.9278, 'M', 5],
  ['LOS', 'DNMM', 'Murtala Muhammed International', 'Lagos', 'Nigeria', 6.5774, 3.3212, 'M', 15],
  ['CMN', 'GMMN', 'Mohammed V International', 'Casablanca', 'Morocco', 33.3675, -7.5898, 'M', 3.8],
  ['ALG', 'DAAG', 'Houari Boumediene Airport', 'Algiers', 'Algeria', 36.691, 3.2154, 'R', 3],
  ['ACC', 'DGAA', 'Kotoka International', 'Accra', 'Ghana', 5.6052, -0.1668, 'R', 2.5],
  ['DAR', 'HTDA', 'Julius Nyerere International', 'Dar es Salaam', 'Tanzania', -6.8781, 39.2026, 'R', 7],
  ['MRU', 'FIMP', 'Sir Seewoosagur Ramgoolam International', 'Mauritius', 'Mauritius', -20.4302, 57.6836, 'R', 0.15],
  // North America
  ['JFK', 'KJFK', 'John F. Kennedy International', 'New York', 'United States', 40.6413, -73.7781, 'I', 20],
  ['EWR', 'KEWR', 'Newark Liberty International', 'New York', 'United States', 40.6895, -74.1745, 'M', 20],
  ['LGA', 'KLGA', 'LaGuardia Airport', 'New York', 'United States', 40.7769, -73.874, 'R', 20],
  ['LAX', 'KLAX', 'Los Angeles International', 'Los Angeles', 'United States', 33.9416, -118.4085, 'I', 13],
  ['SFO', 'KSFO', 'San Francisco International', 'San Francisco', 'United States', 37.6213, -122.379, 'I', 7.7],
  ['ORD', 'KORD', "O'Hare International", 'Chicago', 'United States', 41.9742, -87.9073, 'I', 9.5],
  ['ATL', 'KATL', 'Hartsfield-Jackson Atlanta International', 'Atlanta', 'United States', 33.6407, -84.4277, 'I', 6.1],
  ['DFW', 'KDFW', 'Dallas/Fort Worth International', 'Dallas', 'United States', 32.8998, -97.0403, 'I', 7.9],
  ['DEN', 'KDEN', 'Denver International', 'Denver', 'United States', 39.8561, -104.6737, 'M', 3],
  ['MIA', 'KMIA', 'Miami International', 'Miami', 'United States', 25.7959, -80.287, 'M', 6.1],
  ['SEA', 'KSEA', 'Seattle-Tacoma International', 'Seattle', 'United States', 47.4502, -122.3088, 'M', 4],
  ['IAD', 'KIAD', 'Washington Dulles International', 'Washington', 'United States', 38.9531, -77.4565, 'M', 6.3],
  ['BOS', 'KBOS', 'Logan International', 'Boston', 'United States', 42.3656, -71.0096, 'M', 4.9],
  ['IAH', 'KIAH', 'George Bush Intercontinental', 'Houston', 'United States', 29.9902, -95.3368, 'M', 7.3],
  ['LAS', 'KLAS', 'Harry Reid International', 'Las Vegas', 'United States', 36.084, -115.1537, 'M', 2.3],
  ['HNL', 'PHNL', 'Daniel K. Inouye International', 'Honolulu', 'United States', 21.3187, -157.9225, 'R', 1],
  ['ANC', 'PANC', 'Ted Stevens Anchorage International', 'Anchorage', 'United States', 61.1743, -149.9962, 'R', 0.4],
  ['YYZ', 'CYYZ', 'Toronto Pearson International', 'Toronto', 'Canada', 43.6777, -79.6248, 'I', 6.7],
  ['YVR', 'CYVR', 'Vancouver International', 'Vancouver', 'Canada', 49.1967, -123.1815, 'M', 2.7],
  ['YUL', 'CYUL', 'Montréal-Trudeau International', 'Montréal', 'Canada', 45.4706, -73.7408, 'M', 4.3],
  ['MEX', 'MMMX', 'Benito Juárez International', 'Mexico City', 'Mexico', 19.4363, -99.0721, 'I', 22],
  ['CUN', 'MMUN', 'Cancún International', 'Cancún', 'Mexico', 21.0365, -86.8771, 'R', 0.9],
  ['PTY', 'MPTO', 'Tocumen International', 'Panama City', 'Panama', 9.0714, -79.3835, 'R', 1.9],
  // South America
  ['GRU', 'SBGR', 'São Paulo/Guarulhos International', 'São Paulo', 'Brazil', -23.4356, -46.4731, 'I', 22],
  ['GIG', 'SBGL', 'Rio de Janeiro/Galeão International', 'Rio de Janeiro', 'Brazil', -22.81, -43.2506, 'M', 13],
  ['BSB', 'SBBR', 'Brasília International', 'Brasília', 'Brazil', -15.8711, -47.9186, 'R', 4.8],
  ['EZE', 'SAEZ', 'Ministro Pistarini International', 'Buenos Aires', 'Argentina', -34.8222, -58.5358, 'M', 15],
  ['AEP', 'SABE', 'Jorge Newbery Airfield', 'Buenos Aires', 'Argentina', -34.5592, -58.4156, 'R', 15],
  ['SCL', 'SCEL', 'Arturo Merino Benítez International', 'Santiago', 'Chile', -33.393, -70.7858, 'M', 7],
  ['BOG', 'SKBO', 'El Dorado International', 'Bogotá', 'Colombia', 4.7016, -74.1469, 'M', 11],
  ['LIM', 'SPJC', 'Jorge Chávez International', 'Lima', 'Peru', -12.0219, -77.1143, 'M', 11],
  ['UIO', 'SEQM', 'Mariscal Sucre International', 'Quito', 'Ecuador', -0.1292, -78.3575, 'R', 2.8],
  // Oceania
  ['SYD', 'YSSY', 'Sydney Kingsford Smith', 'Sydney', 'Australia', -33.9399, 151.1753, 'I', 5.3],
  ['MEL', 'YMML', 'Melbourne Airport', 'Melbourne', 'Australia', -37.669, 144.841, 'I', 5.2],
  ['BNE', 'YBBN', 'Brisbane Airport', 'Brisbane', 'Australia', -27.3942, 153.1218, 'M', 2.6],
  ['PER', 'YPPH', 'Perth Airport', 'Perth', 'Australia', -31.9385, 115.9672, 'M', 2.2],
  ['ADL', 'YPAD', 'Adelaide Airport', 'Adelaide', 'Australia', -34.945, 138.5306, 'R', 1.4],
  ['CNS', 'YBCS', 'Cairns Airport', 'Cairns', 'Australia', -16.8858, 145.7553, 'R', 0.15],
  ['DRW', 'YPDN', 'Darwin International', 'Darwin', 'Australia', -12.4147, 130.877, 'R', 0.15],
  ['AKL', 'NZAA', 'Auckland Airport', 'Auckland', 'New Zealand', -37.0082, 174.785, 'M', 1.7],
  ['CHC', 'NZCH', 'Christchurch Airport', 'Christchurch', 'New Zealand', -43.4894, 172.532, 'R', 0.5],
  ['NAN', 'NFFN', 'Nadi International', 'Nadi', 'Fiji', -17.7554, 177.4431, 'R', 0.1],
  ['PPT', 'NTAA', "Faa'a International", 'Papeete', 'French Polynesia', -17.5537, -149.6068, 'R', 0.28],
  ['POM', 'AYPY', 'Jacksons International', 'Port Moresby', 'Papua New Guinea', -9.4434, 147.22, 'R', 0.4],
  ['GUM', 'PGUM', 'Antonio B. Won Pat International', 'Hagåtña', 'Guam', 13.4834, 144.796, 'R', 0.17],
]

export const AIRPORTS: readonly AirportRecord[] = ROWS.map(
  ([iata, icao, name, city, country, lat, lon, cls, metroMillions]) => ({
    iata,
    icao,
    name,
    city,
    country,
    lat,
    lon,
    classification: CLASS[cls],
    metroMillions,
  }),
)

export const AIRPORT_BY_IATA: ReadonlyMap<string, AirportRecord> = new Map(
  AIRPORTS.map((a) => [a.iata, a]),
)

export function getAirport(iata: string): AirportRecord | undefined {
  return AIRPORT_BY_IATA.get(iata)
}

export interface CityGroup {
  key: string
  city: string
  country: string
  airports: AirportRecord[]
}

/** Airports grouped by city (for headquarters selection), cities sorted A-Z. */
export function groupByCity(list: readonly AirportRecord[] = AIRPORTS): CityGroup[] {
  const groups = new Map<string, CityGroup>()
  for (const a of list) {
    const key = `${a.city}|${a.country}`
    const g = groups.get(key) ?? { key, city: a.city, country: a.country, airports: [] }
    g.airports.push(a)
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => a.city.localeCompare(b.city))
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Case/accent-insensitive search over IATA, ICAO, name, city and country. */
export function searchAirports(query: string, list: readonly AirportRecord[] = AIRPORTS) {
  const q = fold(query.trim())
  if (!q) return [...list]
  return list.filter((a) =>
    fold(`${a.iata} ${a.icao} ${a.name} ${a.city} ${a.country}`).includes(q),
  )
}
