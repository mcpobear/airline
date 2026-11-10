import { mixSeed, mulberry32 } from './random'

/**
 * Plausible national-style registrations ("9V-ABC", "N123AB", "JA123A"...).
 * Pattern letters: L = letter, D = digit. Countries not listed fall back to "X-LLLL".
 */
const SCHEMES: Record<string, [prefix: string, body: string]> = {
  Singapore: ['9V-', 'LLL'], Malaysia: ['9M-', 'LLL'], Thailand: ['HS-', 'LLL'],
  Indonesia: ['PK-', 'LLL'], Philippines: ['RP-C', 'DDDD'], Vietnam: ['VN-A', 'DDD'],
  Myanmar: ['XY-', 'LLL'], Laos: ['RDPL-', 'DDDDD'], Brunei: ['V8-', 'LLL'],
  'Hong Kong': ['B-H', 'LL'], Taiwan: ['B-', 'DDDDD'], Japan: ['JA', 'DDDL'],
  'South Korea': ['HL', 'DDDD'], China: ['B-', 'DDDD'], India: ['VT-', 'LLL'],
  'Sri Lanka': ['4R-', 'LLL'], Bangladesh: ['S2-', 'LLL'], Pakistan: ['AP-', 'LLL'],
  Maldives: ['8Q-', 'LLL'], Nepal: ['9N-', 'LLL'], 'United Arab Emirates': ['A6-', 'LLL'],
  Qatar: ['A7-', 'LLL'], 'Saudi Arabia': ['HZ-', 'LLL'], Türkiye: ['TC-', 'LLL'],
  Israel: ['4X-', 'LLL'], Jordan: ['JY-', 'LLL'], Kuwait: ['9K-', 'LLL'], Oman: ['A4O-', 'LL'],
  Kazakhstan: ['UP-A', 'DDDD'], Uzbekistan: ['UK', 'DDDDD'], Azerbaijan: ['4K-AZ', 'DD'],
  'United Kingdom': ['G-', 'LLLL'], Ireland: ['EI-', 'LLL'], France: ['F-', 'LLLL'],
  Netherlands: ['PH-', 'LLL'], Germany: ['D-', 'LLLL'], Spain: ['EC-', 'LLL'],
  Portugal: ['CS-', 'LLL'], Italy: ['I-', 'LLLL'], Switzerland: ['HB-', 'LLL'],
  Austria: ['OE-', 'LLL'], Denmark: ['OY-', 'LLL'], Sweden: ['SE-', 'LLL'],
  Norway: ['LN-', 'LLL'], Finland: ['OH-', 'LLL'], Greece: ['SX-', 'LLL'],
  Poland: ['SP-', 'LLL'], Czechia: ['OK-', 'LLL'], Hungary: ['HA-', 'LLL'],
  Iceland: ['TF-', 'LLL'], Egypt: ['SU-', 'LLL'], 'South Africa': ['ZS-', 'LLL'],
  Ethiopia: ['ET-', 'LLL'], Kenya: ['5Y-', 'LLL'], Nigeria: ['5N-', 'LLL'],
  Morocco: ['CN-', 'LLL'], Algeria: ['7T-', 'LLL'], Ghana: ['9G-', 'LLL'],
  Tanzania: ['5H-', 'LLL'], Mauritius: ['3B-', 'LLL'], 'United States': ['N', 'DDDLL'],
  Canada: ['C-F', 'LLL'], Mexico: ['XA-', 'LLL'], Panama: ['HP-', 'DDDD'],
  Brazil: ['PR-', 'LLL'], Argentina: ['LV-', 'LLL'], Chile: ['CC-', 'LLL'],
  Colombia: ['HK-', 'DDDD'], Peru: ['OB-', 'DDDD'], Ecuador: ['HC-', 'LLL'],
  Australia: ['VH-', 'LLL'], 'New Zealand': ['ZK-', 'LLL'], Fiji: ['DQ-', 'LLL'],
  'French Polynesia': ['F-O', 'LLL'], 'Papua New Guinea': ['P2-', 'LLL'], Guam: ['N', 'DDDLL'],
}

const FALLBACK: [string, string] = ['X-', 'LLLL']

export function hasRegistrationScheme(country: string): boolean {
  return country in SCHEMES
}

/**
 * Deterministic for a given (country, seed, aircraftNumber); retries with a
 * new attempt counter until the result is not in `taken`, so registrations
 * are never duplicated.
 */
export function generateRegistration(
  country: string,
  seed: number,
  aircraftNumber: number,
  taken: ReadonlySet<string>,
): string {
  const [prefix, body] = SCHEMES[country] ?? FALLBACK
  for (let attempt = 0; attempt < 1000; attempt++) {
    const rand = mulberry32(mixSeed(seed, aircraftNumber, attempt))
    let reg = prefix
    for (const kind of body) {
      reg += kind === 'L' ? String.fromCharCode(65 + Math.floor(rand() * 26)) : Math.floor(rand() * 10)
    }
    if (!taken.has(reg)) return reg
  }
  throw new Error('Could not generate a unique registration')
}
