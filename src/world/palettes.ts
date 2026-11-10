export type RGB = readonly [number, number, number]

/**
 * A look for the world: how the sea, the land and the coastline are coloured,
 * plus how the globe around them is lit. Everything that distinguishes one
 * style from another lives here, so adding a look means adding a palette
 * rather than touching the renderer.
 */
export interface WorldPalette {
  /** Open ocean, far from any coast. */
  seaDeep: RGB
  /** Ocean a little way out. */
  seaMid: RGB
  /** Shallow water hugging the coast. */
  seaShelf: RGB
  /** The drawn coastline. */
  coast: RGB
  /** How strongly the coastline is drawn, 0..1. */
  coastStrength: number
  /** How wide the coastline reads; smaller is tighter. */
  coastWidth: number
  biomes: {
    ice: RGB
    tundra: RGB
    forest: RGB
    jungle: RGB
    grass: RGB
    steppe: RGB
    desert: RGB
    rock: RGB
  }
  /** How much high ground is lightened and low ground darkened, 0 = flat colour. */
  relief: number
  /** How far the shallow-water shelf reaches from the coast, as a fraction of the map width. */
  shelf: number
  /** Optional graticule baked into the texture. */
  graticule?: { colour: RGB; strength: number; spacing: number }
}

export interface GlobeLighting {
  /** Key light strength. */
  sun: number
  /**
   * Light from behind the camera, so whatever you are looking at is lit.
   * With this off the key light follows the real sub-solar point instead,
   * which is prettier but leaves half your network in darkness.
   */
  follow: boolean
  /** Overall fill, so the night side is never pitch black. */
  ambient: number
  skyColour: string
  groundColour: string
  sunColour: string
  /** Rim glow around the planet. */
  atmosphere: { colour: RGB; strength: number } | null
  /** Page behind the globe. */
  background: string
  /** Stars behind the globe. */
  stars: boolean
}

export interface GlobeStyle {
  id: string
  name: string
  blurb: string
  /** Faceted low-poly geometry instead of a smooth textured sphere. */
  faceted: boolean
  palette: WorldPalette
  lighting: GlobeLighting
  /** Colour of flight paths and the aircraft drawn over this world. */
  route: string
  plane: string
}

const JET_AGE: WorldPalette = {
  seaDeep: [0x16, 0x4d, 0x63],
  seaMid: [0x1f, 0x6a, 0x80],
  seaShelf: [0x3c, 0x95, 0xa6],
  coast: [0x1d, 0x3a, 0x3e],
  coastStrength: 0.85,
  coastWidth: 0.13,
  biomes: {
    ice: [0xf0, 0xea, 0xdf],
    tundra: [0xb7, 0xb9, 0x9c],
    forest: [0x6f, 0x8f, 0x5a],
    jungle: [0x55, 0x7c, 0x47],
    grass: [0x9d, 0xa9, 0x65],
    steppe: [0xc2, 0xb0, 0x7c],
    desert: [0xdc, 0xc0, 0x84],
    rock: [0xa8, 0x90, 0x6c],
  },
  relief: 0.14,
  shelf: 1 / 240,
}

/** Printed atlas: flat ink-and-paper, no attempt at realism. */
const ATLAS: WorldPalette = {
  seaDeep: [0x1b, 0x5f, 0x6e],
  seaMid: [0x24, 0x75, 0x83],
  seaShelf: [0x4f, 0xa0, 0xa8],
  coast: [0x16, 0x32, 0x36],
  coastStrength: 1,
  coastWidth: 0.1,
  biomes: {
    ice: [0xf6, 0xf1, 0xe6],
    tundra: [0xd9, 0xd2, 0xb8],
    forest: [0xa9, 0xb8, 0x87],
    jungle: [0x94, 0xa9, 0x72],
    grass: [0xd3, 0xc9, 0x9a],
    steppe: [0xdd, 0xcb, 0x9b],
    desert: [0xe8, 0xd3, 0x9e],
    rock: [0xc4, 0xb0, 0x8c],
  },
  relief: 0.06,
  shelf: 1 / 300,
  graticule: { colour: [0x16, 0x32, 0x36], strength: 0.13, spacing: 20 },
}

/** Inflight night map: dark water, dim land, coastlines picked out in light. */
const NIGHT: WorldPalette = {
  seaDeep: [0x07, 0x11, 0x1f],
  seaMid: [0x0b, 0x1a, 0x2e],
  seaShelf: [0x12, 0x2b, 0x45],
  coast: [0x6f, 0xd8, 0xd0],
  coastStrength: 0.95,
  coastWidth: 0.09,
  biomes: {
    ice: [0x7d, 0x92, 0xa6],
    tundra: [0x66, 0x7b, 0x8c],
    forest: [0x4b, 0x66, 0x6e],
    jungle: [0x44, 0x60, 0x68],
    grass: [0x58, 0x71, 0x7a],
    steppe: [0x68, 0x7d, 0x82],
    desert: [0x75, 0x87, 0x89],
    rock: [0x5d, 0x71, 0x7e],
  },
  relief: 0.12,
  shelf: 1 / 420,
  graticule: { colour: [0x4f, 0x9d, 0xa8], strength: 0.09, spacing: 30 },
}

/** Bold poster: saturated flat colour and a thick drawn coast, no shading at all. */
const BOLD: WorldPalette = {
  seaDeep: [0x1c, 0x6e, 0x9c],
  seaMid: [0x24, 0x84, 0xb4],
  seaShelf: [0x46, 0xa8, 0xca],
  coast: [0x14, 0x2b, 0x33],
  coastStrength: 1,
  coastWidth: 0.2,
  biomes: {
    ice: [0xf2, 0xf4, 0xf0],
    tundra: [0xbf, 0xc4, 0x9e],
    forest: [0x4f, 0x97, 0x5b],
    jungle: [0x3d, 0x85, 0x4e],
    grass: [0x86, 0xb2, 0x5c],
    steppe: [0xcf, 0xb0, 0x62],
    desert: [0xe8, 0xc1, 0x6a],
    rock: [0xa8, 0x8a, 0x5f],
  },
  relief: 0,
  shelf: 1 / 420,
}

/** Relief globe: closer to a physical map, with real greens and browns. */
const RELIEF: WorldPalette = {
  seaDeep: [0x10, 0x3a, 0x60],
  seaMid: [0x18, 0x56, 0x85],
  seaShelf: [0x31, 0x88, 0xad],
  coast: [0x16, 0x33, 0x3f],
  coastStrength: 0.5,
  coastWidth: 0.08,
  biomes: {
    ice: [0xf4, 0xf7, 0xfa],
    tundra: [0x9a, 0xa5, 0x88],
    forest: [0x47, 0x6e, 0x3c],
    jungle: [0x2f, 0x5c, 0x33],
    grass: [0x79, 0x92, 0x4c],
    steppe: [0xb0, 0xa0, 0x62],
    desert: [0xd6, 0xbb, 0x7e],
    rock: [0x8b, 0x76, 0x5c],
  },
  relief: 0.3,
  shelf: 1 / 300,
}

export const GLOBE_STYLES: GlobeStyle[] = [
  {
    id: 'atlas',
    name: 'Printed atlas',
    blurb: 'Ink and paper. Flat colour, drawn coastlines and a faint graticule, lit evenly like a desk globe.',
    faceted: false,
    palette: ATLAS,
    lighting: {
      sun: 0.5,
      follow: true,
      ambient: 2.4,
      skyColour: '#fff8ec',
      groundColour: '#cdbfa8',
      sunColour: '#fff4df',
      atmosphere: { colour: [0.45, 0.55, 0.55], strength: 0.35 },
      background: '#e9dfd0',
      stars: false,
    },
    route: '#c2491c',
    plane: '#1d3a3e',
  },
  {
    id: 'relief',
    name: 'Relief globe',
    blurb: 'A physical globe: real greens and browns with shaded terrain, over a starfield.',
    faceted: false,
    palette: RELIEF,
    lighting: {
      sun: 1.9,
      follow: true,
      ambient: 1.5,
      skyColour: '#cfe4ff',
      groundColour: '#44566b',
      sunColour: '#fff3dc',
      atmosphere: { colour: [0.35, 0.62, 0.95], strength: 0.9 },
      background: '#0d1526',
      stars: true,
    },
    route: '#ffd24a',
    plane: '#f5f1e8',
  },
  {
    id: 'night',
    name: 'Night routes',
    blurb: 'The inflight map at 3am: dark water, dim continents, coastlines in light, routes glowing over them.',
    faceted: false,
    palette: NIGHT,
    lighting: {
      sun: 0.5,
      follow: true,
      ambient: 2.7,
      skyColour: '#9fc6ff',
      groundColour: '#17283a',
      sunColour: '#dce9ff',
      atmosphere: { colour: [0.3, 0.7, 0.85], strength: 1.1 },
      background: '#05080f',
      stars: true,
    },
    route: '#6fe3d8',
    plane: '#ffd98a',
  },
  {
    id: 'bold',
    name: 'Bold poster',
    blurb: 'Saturated flat colour with a thick drawn coastline and no shading. The most graphic of the four.',
    faceted: false,
    palette: BOLD,
    lighting: {
      sun: 0.3,
      follow: true,
      ambient: 2.6,
      skyColour: '#ffffff',
      groundColour: '#c6cfc4',
      sunColour: '#fffaf0',
      atmosphere: { colour: [0.3, 0.5, 0.6], strength: 0.45 },
      background: '#e9dfd0',
      stars: false,
    },
    route: '#c2491c',
    plane: '#142b33',
  },
  {
    id: 'faceted',
    name: 'Low poly (current)',
    blurb: 'The faceted globe the game has today: visible triangles and a stepped coastline.',
    faceted: true,
    palette: JET_AGE,
    lighting: {
      sun: 2.0,
      follow: false,
      ambient: 1.5,
      skyColour: '#fff6e6',
      groundColour: '#9db6a8',
      sunColour: '#fff3dc',
      atmosphere: { colour: [0.42, 0.56, 0.58], strength: 0.5 },
      background: '#e9dfd0',
      stars: false,
    },
    route: '#1a6a66',
    plane: '#24474a',
  },
]

export const DEFAULT_GLOBE_STYLE = 'relief'

export function globeStyle(id: string): GlobeStyle {
  return GLOBE_STYLES.find((s) => s.id === id) ?? GLOBE_STYLES[0]
}
