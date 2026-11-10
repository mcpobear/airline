import { describe, expect, it } from 'vitest'
import { barEvents, BARS_PER_CHORD, chordForBar, midiToFrequency, PROGRESSION, SECONDS_PER_BAR } from './score'

describe('lounge score', () => {
  it('tunes to A440', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6)
    expect(midiToFrequency(57)).toBeCloseTo(220, 6)
    expect(midiToFrequency(81)).toBeCloseTo(880, 6)
  })

  it('holds each chord for two bars and then loops', () => {
    expect(chordForBar(0).name).toBe(PROGRESSION[0].name)
    expect(chordForBar(1).name).toBe(PROGRESSION[0].name)
    expect(chordForBar(2).name).toBe(PROGRESSION[1].name)
    const loop = PROGRESSION.length * BARS_PER_CHORD
    expect(chordForBar(loop).name).toBe(PROGRESSION[0].name)
    expect(chordForBar(loop + 5).name).toBe(chordForBar(5).name)
  })

  it('writes the same bar the same way every time', () => {
    for (const bar of [0, 3, 17, 128]) {
      expect(barEvents(bar)).toEqual(barEvents(bar))
    }
  })

  it('keeps every note inside its bar and audible', () => {
    for (let bar = 0; bar < 64; bar++) {
      const events = barEvents(bar)
      expect(events.length).toBeGreaterThan(0)
      for (const e of events) {
        expect(e.at).toBeGreaterThanOrEqual(0)
        expect(e.at).toBeLessThan(SECONDS_PER_BAR)
        expect(e.gain).toBeGreaterThan(0)
        expect(e.gain).toBeLessThanOrEqual(0.35)
        expect(e.duration).toBeGreaterThan(0)
        if (e.voice !== 'brush') {
          expect(e.frequency).toBeGreaterThan(30)
          expect(e.frequency).toBeLessThan(2000)
        }
      }
      // Bass and chord always present; nothing ever stacks up loud enough to clip.
      expect(events.some((e) => e.voice === 'bass')).toBe(true)
      expect(events.some((e) => e.voice === 'pad')).toBe(true)
      expect(events.reduce((sum, e) => sum + e.gain, 0)).toBeLessThan(1.6)
    }
  })

  it('keeps the melody off the downbeat and sparse', () => {
    let melodyNotes = 0
    for (let bar = 0; bar < 48; bar++) {
      for (const e of barEvents(bar)) {
        if (e.voice !== 'melody') continue
        melodyNotes++
        expect(e.at).toBeGreaterThan(0)
      }
    }
    expect(melodyNotes).toBeGreaterThan(0)
    expect(melodyNotes).toBeLessThan(48 * 2)
  })
})
