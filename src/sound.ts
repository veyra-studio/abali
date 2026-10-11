/**
 * Synthesized sound design — no audio files. Built from tones and noise on
 * the Veyra sound bus, so it stays silent unless the visitor turns sound on.
 * The film is about three sounds: «تق» (the cap), «پیس» (the gas) and the
 * «آخیش» after the first gulps («قلپ، قلپ»).
 */
import type { SoundBus } from '@veyra/core'

export interface AbaliSound {
  /** «تق»: the opener bites, the crown cap snaps off. */
  taq(): void
  /** «پیس»: the gas escaping, `0…1` strength. */
  hiss(strength?: number): void
  /** The cap pressed back on. */
  clack(): void
  /** The cap landing on the acrylic, bouncing or rattling as it settles, `0…1`. */
  capHit(strength: number): void
  /** «قلپ، قلپ»: `count` gulps of a cold drink. */
  gulps(count?: number): void
  /** «آخیش»: the breath out after the gulps, `delay` seconds from now. */
  ahh(delay?: number): void
  /** A soft tick for chapter changes. */
  tick(): void
  /** A dish set down on the cloth. */
  thud(weight?: number): void
  /** Carbonation crackle, `0…1`. */
  fizz(level: number): void
  /** Mountain wind, `0…1`. */
  wind(level: number): void
  /** A knock on the full bottle: the glass rings briefly, damped by the doogh, `0…1`. */
  glass(strength?: number): void
  /** Ice: a `clink`, a `crack` running through it, the cube breaking (`shatter`), or a chip landing (`tik`), `0…1`. */
  ice(kind: 'clink' | 'crack' | 'shatter' | 'tik', strength?: number): void
}

export function createSound(bus: SoundBus | null): AbaliSound {
  let pink: AudioBuffer | null = null
  let fizzGain: GainNode | null = null
  let windGain: GainNode | null = null
  let fizzLevel = 0
  let crackleTimer: number | null = null
  let lastTik = -1

  const ctx = () => (bus?.audible ? bus.context : null)

  const loop = (c: AudioContext, filter: BiquadFilterType, frequency: number, q: number): { gain: GainNode; filter: BiquadFilterNode } | null => {
    pink ??= bus?.noise(4, 'pink') ?? null
    if (!pink || !bus?.output) return null
    const src = c.createBufferSource()
    src.buffer = pink
    src.loop = true
    const f = c.createBiquadFilter()
    f.type = filter
    f.frequency.value = frequency
    f.Q.value = q
    const g = c.createGain()
    g.gain.value = 0
    src.connect(f).connect(g).connect(bus.output)
    src.start()
    return { gain: g, filter: f }
  }

  const crackle = () => {
    if (!ctx() || fizzLevel <= 0.01) {
      crackleTimer = null
      return
    }
    // Tiny bubbles bursting: short high blips at random pitches.
    const n = 1 + Math.floor(fizzLevel * 4 * Math.random())
    for (let i = 0; i < n; i++) {
      const f = 2200 + Math.random() * 5200
      bus!.tone({ frequency: f, to: f * 0.8, gain: 0.01 + fizzLevel * 0.022, decay: 0.012 + Math.random() * 0.02, delay: Math.random() * 0.04, pan: (Math.random() - 0.5) * 0.8 })
    }
    crackleTimer = window.setTimeout(crackle, 30 + (1 - fizzLevel) * 120 * Math.random())
  }

  return {
    taq() {
      if (!ctx()) return
      const b = bus!
      // The bite of steel on tin, the snap, the cap's ring as it flies.
      b.burst({ from: 3600, to: 2600, q: 7, gain: 0.32, attack: 0.001, decay: 0.035 })
      b.tone({ frequency: 190, to: 70, gain: 0.45, attack: 0.002, decay: 0.08 })
      b.burst({ from: 1500, to: 900, q: 2, gain: 0.14, attack: 0.001, decay: 0.06, delay: 0.004 })
      b.tone({ frequency: 3120, to: 3090, type: 'triangle', gain: 0.045, decay: 0.22, delay: 0.012 })
      b.tone({ frequency: 4660, to: 4620, type: 'triangle', gain: 0.03, decay: 0.16, delay: 0.016 })
    },
    hiss(strength = 1) {
      if (!ctx()) return
      const b = bus!
      b.burst({ filter: 'highpass', from: 6200, to: 2400, q: 0.7, gain: 0.26 * strength, attack: 0.008, decay: 0.95 })
      b.burst({ from: 1400, to: 700, q: 1.2, gain: 0.08 * strength, attack: 0.01, decay: 0.5 })
    },
    clack() {
      if (!ctx()) return
      bus!.burst({ from: 3200, to: 2400, q: 6, gain: 0.24, attack: 0.001, decay: 0.07 })
      bus!.tone({ frequency: 1900, to: 1700, type: 'square', gain: 0.04, decay: 0.09 })
    },
    capHit(strength) {
      if (!ctx() || strength < 0.02) return
      const b = bus!
      // Thin tin on a hard floor: a bright click and a short, inharmonic ring.
      const f = 2700 + Math.random() * 500
      b.burst({ from: 5600, to: 4200, q: 8, gain: 0.12 * strength, attack: 0.001, decay: 0.025 })
      b.tone({ frequency: f, to: f * 0.99, type: 'triangle', gain: 0.035 * strength, decay: 0.07 + strength * 0.08 })
      b.tone({ frequency: f * 1.71, type: 'triangle', gain: 0.02 * strength, decay: 0.05 + strength * 0.05 })
    },
    gulps(count = 3) {
      if (!ctx()) return
      const b = bus!
      // Each swallow: a soft knock in the throat and the rising "glug" of
      // liquid and air; a breath-length apart, never quite even.
      let t = 0.02
      for (let i = 0; i < count; i++) {
        const k = 0.9 + Math.random() * 0.2
        b.burst({ filter: 'lowpass', from: 900, to: 260, q: 1.4, gain: 0.14, attack: 0.004, decay: 0.06, delay: t })
        b.tone({ frequency: 170 * k, to: 400 * k, gain: 0.16, attack: 0.006, decay: 0.1, delay: t + 0.025 })
        b.tone({ frequency: 105 * k, to: 75 * k, gain: 0.1, attack: 0.004, decay: 0.12, delay: t + 0.01 })
        t += 0.42 + Math.random() * 0.12
      }
    },
    ahh(delay = 0) {
      if (!ctx()) return
      const b = bus!
      // An open-mouthed breath out: soft air through two vowel-like resonances,
      // swelling and falling away, a little lower as it ends.
      b.burst({ from: 1150, to: 820, q: 2.2, gain: 0.11, attack: 0.09, decay: 0.85, delay })
      b.burst({ from: 2600, to: 1900, q: 3, gain: 0.05, attack: 0.08, decay: 0.7, delay })
      b.burst({ filter: 'lowpass', from: 700, to: 300, q: 0.7, gain: 0.06, attack: 0.1, decay: 0.9, delay })
    },
    tick() {
      if (!ctx()) return
      bus!.tone({ frequency: 1320, to: 1300, gain: 0.022, decay: 0.05 })
    },
    thud(weight = 1) {
      if (!ctx()) return
      bus!.burst({ filter: 'lowpass', from: 420, to: 140, q: 0.9, gain: 0.22 * weight, attack: 0.002, decay: 0.12 })
      bus!.tone({ frequency: 120 + Math.random() * 30, to: 70, gain: 0.12 * weight, decay: 0.09 })
    },
    fizz(level) {
      fizzLevel = level
      const c = ctx()
      if (!c) return
      fizzGain ??= loop(c, 'highpass', 3000, 0.7)?.gain ?? null
      fizzGain?.gain.setTargetAtTime(level * 0.14, c.currentTime, 0.12)
      if (level > 0.01 && crackleTimer === null) crackle()
    },
    wind(level) {
      const c = ctx()
      if (!c) return
      if (!windGain) {
        const bed = loop(c, 'lowpass', 520, 0.8)
        if (bed) {
          windGain = bed.gain
          // Gusts: a slowly wandering cutoff.
          const lfo = c.createOscillator()
          lfo.frequency.value = 0.09
          const depth = c.createGain()
          depth.gain.value = 260
          lfo.connect(depth).connect(bed.filter.frequency)
          lfo.start()
        }
      }
      windGain?.gain.setTargetAtTime(level * 0.2, c.currentTime, 0.5)
    },
    glass(strength = 1) {
      if (!ctx()) return
      const b = bus!
      // A fingertip on thick glass: the tap, a short ring (a full bottle
      // doesn't sing for long) and the dull knock of the doogh inside.
      const f = 1380 + Math.random() * 160
      b.burst({ from: 5600, to: 4400, q: 6, gain: 0.09 * strength, attack: 0.001, decay: 0.018 })
      b.tone({ frequency: f, to: f * 0.998, gain: 0.07 * strength, attack: 0.001, decay: 0.2 })
      b.tone({ frequency: f * 2.64, type: 'triangle', gain: 0.028 * strength, decay: 0.09 })
      b.tone({ frequency: f * 4.18, gain: 0.014 * strength, decay: 0.05 })
      b.tone({ frequency: 300, to: 220, gain: 0.08 * strength, attack: 0.002, decay: 0.06 })
    },
    ice(kind, strength = 1) {
      const c = ctx()
      if (!c) return
      const b = bus!
      const s = strength
      // A knock on ice: the click of the contact, then the cube's own ring —
      // a few inharmonic modes, damped fast (ice rings far shorter than
      // glass), pitched by its size.
      const knock = (gain: number, pitch: number, delay = 0, ring = 1) => {
        b.burst({ from: pitch * 1.6, q: 1.3, gain: gain * 0.9, attack: 0.0008, decay: 0.014, delay })
        b.tone({ frequency: pitch, to: pitch * 0.992, gain: gain * 0.75, attack: 0.0012, decay: 0.07 * ring, delay })
        b.tone({ frequency: pitch * 2.31, gain: gain * 0.38, attack: 0.001, decay: 0.04 * ring, delay })
        b.tone({ frequency: pitch * 3.87, gain: gain * 0.18 * ring, attack: 0.001, decay: 0.022 * ring, delay })
      }
      // A splinter: a tiny broadband click, as ice fractures in a drink.
      const splinter = (gain: number, delay: number) => {
        b.burst({ from: 1800 + Math.random() * 3200, q: 1.6, gain, attack: 0.0006, decay: 0.004 + Math.random() * 0.005, delay })
      }
      const pitch = 1700 + Math.random() * 450
      if (kind === 'clink') {
        knock(0.16 * s, pitch)
        // Its weight knocking the acrylic.
        b.tone({ frequency: 230, to: 150, gain: 0.07 * s, attack: 0.002, decay: 0.035 })
      } else if (kind === 'tik') {
        // A chip landing: small, high and quick (not two at once).
        if (c.currentTime - lastTik < 0.016) return
        lastTik = c.currentTime
        knock(0.075 * s, 2300 + Math.random() * 1000, 0, 0.45)
      } else if (kind === 'crack') {
        // A fracture: a sharp snap, the crackle of it running through, the cube ringing.
        b.burst({ from: 1300, q: 0.8, gain: 0.32 * s, attack: 0.0008, decay: 0.028 })
        b.tone({ frequency: 180, to: 90, gain: 0.12 * s, attack: 0.001, decay: 0.045 })
        knock(0.08 * s, pitch * 0.92, 0.004)
        let t = 0.012
        for (let i = 0; i < 12; i++) {
          splinter((0.13 - i * 0.008) * s, t)
          t += 0.004 + Math.random() * 0.016
        }
      } else {
        // Breaking: a crunch and a burst of splinters; the chips' own landings follow ('tik').
        b.burst({ from: 1700, to: 900, q: 0.75, gain: 0.36 * s, attack: 0.001, decay: 0.09 })
        b.tone({ frequency: 150, to: 70, gain: 0.14 * s, decay: 0.07 })
        knock(0.07 * s, pitch * 0.85, 0.003)
        let t = 0.006
        for (let i = 0; i < 16; i++) {
          splinter((0.12 - i * 0.005) * s, t)
          t += 0.003 + Math.random() * 0.01
        }
      }
    },
  }
}
