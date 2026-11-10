import { mulberry32 } from '../sim/random'

/**
 * The music, written as data rather than played: a slow lounge progression
 * that loops for ever. Keeping it separate from the Web Audio code means the
 * arrangement can be read and tested without a browser.
 *
 * Four chords, two bars each, in F major: Fmaj9 - Dm9 - Gm9 - C13. Soft
 * electric-piano voicings over a walking-ish bass, with an occasional sparse
 * melody note. Nothing lands on a strong beat hard enough to be distracting.
 */
export const BPM = 66
export const BEATS_PER_BAR = 4
export const BARS_PER_CHORD = 2
export const SECONDS_PER_BEAT = 60 / BPM
export const SECONDS_PER_BAR = SECONDS_PER_BEAT * BEATS_PER_BAR

export type Voice = 'pad' | 'bass' | 'melody' | 'brush'

export interface NoteEvent {
  voice: Voice
  /** Seconds from the start of the bar. */
  at: number
  /** Hertz; brushes ignore it. */
  frequency: number
  duration: number
  /** Relative loudness, 0..1, before the master volume. */
  gain: number
}

interface Chord {
  name: string
  /** MIDI notes of the piano voicing. */
  voicing: number[]
  /** MIDI note of the bass root. */
  root: number
  /** Notes the melody may use, in MIDI. */
  colour: number[]
}

export const PROGRESSION: Chord[] = [
  { name: 'Fmaj9', voicing: [53, 57, 60, 64, 67], root: 41, colour: [72, 76, 79, 81] },
  { name: 'Dm9', voicing: [50, 53, 57, 60, 64], root: 38, colour: [69, 72, 76, 77] },
  { name: 'Gm9', voicing: [55, 58, 62, 65, 69], root: 43, colour: [70, 74, 77, 81] },
  { name: 'C13', voicing: [48, 52, 58, 62, 69], root: 36, colour: [69, 72, 74, 76] },
]

/** Equal temperament, A4 = 440 Hz. */
export const midiToFrequency = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

export function chordForBar(bar: number): Chord {
  const index = Math.floor(bar / BARS_PER_CHORD) % PROGRESSION.length
  return PROGRESSION[((index % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length]
}

/**
 * Everything that sounds during one bar. Deterministic: bar number in, the
 * same notes out, so the music never drifts and can be tested.
 */
export function barEvents(bar: number): NoteEvent[] {
  const chord = chordForBar(bar)
  const firstBarOfChord = bar % BARS_PER_CHORD === 0
  const random = mulberry32(bar * 2654435761)
  const events: NoteEvent[] = []

  // Piano: the full voicing when the chord changes, a lighter echo halfway through.
  const padNotes = firstBarOfChord ? chord.voicing : chord.voicing.slice(1, 4)
  const padGain = firstBarOfChord ? 0.16 : 0.1
  padNotes.forEach((midi, i) => {
    events.push({
      voice: 'pad',
      at: i * 0.045, // a gentle roll rather than a block chord
      frequency: midiToFrequency(midi),
      duration: SECONDS_PER_BAR * (firstBarOfChord ? 1.9 : 1.1),
      gain: padGain,
    })
  })

  // Bass: root on one, fifth-ish lift on three.
  events.push({ voice: 'bass', at: 0, frequency: midiToFrequency(chord.root), duration: SECONDS_PER_BEAT * 1.8, gain: 0.3 })
  events.push({
    voice: 'bass',
    at: SECONDS_PER_BEAT * 2,
    frequency: midiToFrequency(chord.root + (firstBarOfChord ? 7 : 5)),
    duration: SECONDS_PER_BEAT * 1.5,
    gain: 0.22,
  })

  // Melody: at most two notes a bar, never on the downbeat.
  const melodyCount = random() < 0.55 ? (random() < 0.35 ? 2 : 1) : 0
  for (let i = 0; i < melodyCount; i++) {
    const beat = 1 + Math.floor(random() * 3) + (random() < 0.4 ? 0.5 : 0)
    events.push({
      voice: 'melody',
      at: beat * SECONDS_PER_BEAT,
      frequency: midiToFrequency(chord.colour[Math.floor(random() * chord.colour.length)]),
      duration: SECONDS_PER_BEAT * (0.9 + random() * 1.4),
      gain: 0.07,
    })
  }

  // Brushes on the backbeat, barely there.
  for (const beat of [1, 3]) {
    events.push({ voice: 'brush', at: beat * SECONDS_PER_BEAT, frequency: 0, duration: 0.25, gain: 0.03 })
  }

  return events.sort((a, b) => a.at - b.at)
}
