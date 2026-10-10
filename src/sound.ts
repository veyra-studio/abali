/**
 * Synthesized sound design — no audio files. Everything is built from
 * noise and oscillators on the Veyra sound bus, so it stays silent unless
 * the visitor turns sound on.
 */
import type { SoundBus } from '@veyra/core'

export interface AbaliSound {
  /** The crown cap coming off: thunk + hiss + metallic ring. */
  pop(): void
  /** The cap crimping back on. */
  clack(): void
  /** A soft tick for chapter changes. */
  tick(): void
  /** Carbonation crackle, `0…1`. */
  fizz(level: number): void
  /** Mountain wind, `0…1`. */
  wind(level: number): void
}

export function createSound(bus: SoundBus | null): AbaliSound {
  let noise: AudioBuffer | null = null
  let pink: AudioBuffer | null = null
  let fizzGain: GainNode | null = null
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let fizzLevel = 0
  let crackleTimer: number | null = null

  const ctx = () => (bus?.audible ? bus.context : null)
  const out = () => bus?.output ?? null

  const ensureBuffers = () => {
    if (!bus) return
    noise ??= bus.noise(2, 'white')
    pink ??= bus.noise(4, 'pink')
  }

  const noiseBurst = (c: AudioContext, opts: { from: number; to: number; q: number; gain: number; attack: number; decay: number; type?: BiquadFilterType }) => {
    if (!noise) return
    const src = c.createBufferSource()
    src.buffer = noise
    const f = c.createBiquadFilter()
    f.type = opts.type ?? 'bandpass'
    f.Q.value = opts.q
    const t = c.currentTime
    f.frequency.setValueAtTime(opts.from, t)
    f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.decay)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(opts.gain, t + opts.attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.attack + opts.decay)
    src.connect(f).connect(g).connect(out()!)
    src.start(t, Math.random() * 1.5)
    src.stop(t + opts.attack + opts.decay + 0.05)
  }

  const tone = (c: AudioContext, freq: number, endFreq: number, gain: number, decay: number, type: OscillatorType = 'sine', delay = 0) => {
    const o = c.createOscillator()
    o.type = type
    const t = c.currentTime + delay
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(endFreq, t + decay)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out()!)
    o.start(t)
    o.stop(t + decay + 0.05)
  }

  const crackle = () => {
    const c = ctx()
    if (!c || fizzLevel <= 0.01) {
      crackleTimer = null
      return
    }
    // Tiny bubbles bursting: short high blips at random pitches.
    const n = 1 + Math.floor(fizzLevel * 4 * Math.random())
    for (let i = 0; i < n; i++) tone(c, 2200 + Math.random() * 5200, 1800 + Math.random() * 3000, 0.012 + fizzLevel * 0.025, 0.012 + Math.random() * 0.02, 'sine', Math.random() * 0.04)
    crackleTimer = window.setTimeout(crackle, 30 + (1 - fizzLevel) * 120 * Math.random())
  }

  return {
    pop() {
      const c = ctx()
      if (!c) return
      ensureBuffers()
      tone(c, 210, 55, 0.5, 0.12, 'sine')
      noiseBurst(c, { from: 7000, to: 2600, q: 0.7, gain: 0.32, attack: 0.006, decay: 0.9 })
      noiseBurst(c, { from: 1800, to: 900, q: 2, gain: 0.12, attack: 0.002, decay: 0.08 })
      tone(c, 2630, 2600, 0.05, 0.25, 'triangle', 0.02)
      tone(c, 3710, 3700, 0.035, 0.2, 'triangle', 0.025)
    },
    clack() {
      const c = ctx()
      if (!c) return
      ensureBuffers()
      noiseBurst(c, { from: 3200, to: 2400, q: 6, gain: 0.25, attack: 0.001, decay: 0.07 })
      tone(c, 1900, 1700, 0.05, 0.09, 'square')
    },
    tick() {
      const c = ctx()
      if (!c) return
      tone(c, 1320, 1300, 0.025, 0.05, 'sine')
    },
    fizz(level) {
      fizzLevel = level
      const c = ctx()
      if (!c) return
      ensureBuffers()
      if (!fizzGain && pink) {
        const src = c.createBufferSource()
        src.buffer = pink
        src.loop = true
        const hp = c.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 3000
        fizzGain = c.createGain()
        fizzGain.gain.value = 0
        src.connect(hp).connect(fizzGain).connect(out()!)
        src.start()
      }
      fizzGain?.gain.setTargetAtTime(level * 0.16, c.currentTime, 0.12)
      if (level > 0.01 && crackleTimer === null) crackle()
    },
    wind(level) {
      const c = ctx()
      if (!c) return
      ensureBuffers()
      if (!windGain && pink) {
        const src = c.createBufferSource()
        src.buffer = pink
        src.loop = true
        windFilter = c.createBiquadFilter()
        windFilter.type = 'lowpass'
        windFilter.frequency.value = 500
        windFilter.Q.value = 0.8
        windGain = c.createGain()
        windGain.gain.value = 0
        src.connect(windFilter).connect(windGain).connect(out()!)
        src.start()
        // Gusts: slowly wandering cutoff.
        const lfo = c.createOscillator()
        lfo.frequency.value = 0.09
        const lfoGain = c.createGain()
        lfoGain.gain.value = 260
        lfo.connect(lfoGain).connect(windFilter.frequency)
        lfo.start()
      }
      windGain?.gain.setTargetAtTime(level * 0.22, c.currentTime, 0.4)
    },
  }
}
