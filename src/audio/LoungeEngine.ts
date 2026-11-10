import { barEvents, SECONDS_PER_BAR, type NoteEvent } from './score'

/**
 * Plays the lounge score with Web Audio. Everything is synthesised in the
 * browser: no audio files to download, nothing licensed, and it never repeats
 * exactly because the melody is keyed to the bar number.
 *
 * Notes are scheduled a little ahead of time against the audio clock, which is
 * what keeps the timing steady even when the main thread is busy drawing the map.
 */
const LOOKAHEAD_SECONDS = 1.5
const TICK_MS = 250

export class LoungeEngine {
  private context: BaseAudioContext | null = null
  private master: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | undefined
  private nextBar = 0
  private nextBarTime = 0
  private volume = 0.5
  private running = false

  get isRunning(): boolean {
    return this.running
  }

  /** True once the browser has let us make sound (needs a user gesture first). */
  get isReady(): boolean {
    return this.context?.state === 'running'
  }

  /** Renders a stretch of the score into an existing context, used for offline checks. */
  scheduleBars(context: BaseAudioContext, fromBar: number, count: number, startTime = 0): void {
    this.context = context
    this.master ??= this.buildChain(context)
    this.master.gain.value = 1
    for (let i = 0; i < count; i++) {
      const barTime = startTime + i * SECONDS_PER_BAR
      for (const event of barEvents(fromBar + i)) this.play(event, barTime + event.at)
    }
  }

  async start(): Promise<void> {
    if (this.running) return
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = (this.context ??= new Ctor()) as AudioContext
    this.master ??= this.buildChain(ctx)
    // Browsers start audio suspended until the player interacts with the page.
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }
    this.running = true
    this.master!.gain.setTargetAtTime(this.volume, this.context.currentTime, 1.2)
    this.nextBar = 0
    this.nextBarTime = this.context.currentTime + 0.25
    this.schedule()
    this.timer = setInterval(() => this.schedule(), TICK_MS)
  }

  stop(): void {
    this.running = false
    clearInterval(this.timer)
    this.timer = undefined
    const ctx = this.context as AudioContext | null
    if (ctx && this.master && typeof ctx.suspend === 'function') {
      // Fade out rather than cutting, then let the context idle.
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
      void ctx.suspend().catch(() => undefined)
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.context && this.master && this.running) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.2)
    }
  }

  /** master -> warmth -> reverb mix -> limiter -> speakers */
  private buildChain(ctx: BaseAudioContext): GainNode {
    const master = ctx.createGain()
    master.gain.value = 0

    const warmth = ctx.createBiquadFilter()
    warmth.type = 'lowpass'
    warmth.frequency.value = 2600
    warmth.Q.value = 0.4

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.ratio.value = 6
    limiter.attack.value = 0.01
    limiter.release.value = 0.3

    const reverb = ctx.createConvolver()
    reverb.buffer = impulseResponse(ctx, 2.6, 2.4)
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    const dry = ctx.createGain()
    dry.gain.value = 0.8

    master.connect(warmth)
    warmth.connect(dry)
    warmth.connect(reverb)
    reverb.connect(wet)
    dry.connect(limiter)
    wet.connect(limiter)
    limiter.connect(ctx.destination)
    return master
  }

  /** Queues every bar that starts within the lookahead window. */
  private schedule(): void {
    const ctx = this.context
    if (!ctx || !this.running) return
    while (this.nextBarTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      for (const event of barEvents(this.nextBar)) {
        this.play(event, this.nextBarTime + event.at)
      }
      this.nextBar += 1
      this.nextBarTime += SECONDS_PER_BAR
    }
  }

  private play(event: NoteEvent, when: number): void {
    const ctx = this.context
    const master = this.master
    if (!ctx || !master || when < ctx.currentTime - 0.05) return
    if (event.voice === 'brush') return this.playBrush(event, when, ctx, master)

    const gain = ctx.createGain()
    const attack = event.voice === 'pad' ? 0.5 : event.voice === 'melody' ? 0.12 : 0.02
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(event.gain, when + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + event.duration)

    const sources: OscillatorNode[] = []
    if (event.voice === 'bass') {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = event.frequency
      sources.push(osc)
    } else {
      // Two slightly detuned voices give the electric-piano shimmer.
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator()
        osc.type = event.voice === 'pad' ? 'sine' : 'triangle'
        osc.frequency.value = event.frequency
        osc.detune.value = detune
        sources.push(osc)
      }
    }

    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = event.voice === 'bass' ? 420 : 2200
    for (const osc of sources) {
      osc.connect(tone)
      osc.start(when)
      osc.stop(when + event.duration + 0.1)
    }
    tone.connect(gain)
    gain.connect(master)
  }

  /** A short hiss standing in for a brushed cymbal. */
  private playBrush(event: NoteEvent, when: number, ctx: BaseAudioContext, master: GainNode): void {
    const frames = Math.floor(ctx.sampleRate * event.duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.5)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 6500
    band.Q.value = 0.8
    const gain = ctx.createGain()
    gain.gain.value = event.gain
    source.connect(band)
    band.connect(gain)
    gain.connect(master)
    source.start(when)
  }
}

/** A decaying noise burst used as a simple hall reverb. */
function impulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, decay)
    }
  }
  return buffer
}
