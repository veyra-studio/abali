/**
 * Damped harmonic springs, solved analytically: the result is exact for any
 * time step, so springs stay stable on 30 Hz phones and 144 Hz monitors.
 */

export interface SpringConfig {
  /** Spring constant `k`. Higher = faster. Default `170`. */
  stiffness?: number
  /** Damping coefficient `c`. Default `26` (≈ critically damped at default stiffness/mass). */
  damping?: number
  /** Mass `m`. Default `1`. */
  mass?: number
  /** Distance and speed under which the spring is considered at rest. Default `0.001`. */
  precision?: number
}

/** Ready-made characters. */
export const springs = {
  /** Calm, no overshoot. */
  gentle: { stiffness: 120, damping: 22, mass: 1 },
  /** Responsive UI default. */
  default: { stiffness: 170, damping: 26, mass: 1 },
  /** Lively with a little overshoot. */
  bouncy: { stiffness: 260, damping: 14, mass: 1 },
  /** Heavy object: slow, weighty settle. */
  heavy: { stiffness: 90, damping: 20, mass: 2.4 },
  /** Fast and tight. */
  snappy: { stiffness: 420, damping: 38, mass: 1 },
} satisfies Record<string, SpringConfig>

export class Spring {
  value: number
  target: number
  velocity = 0
  stiffness: number
  damping: number
  mass: number
  precision: number

  constructor(initial = 0, config: SpringConfig = {}) {
    this.value = initial
    this.target = initial
    this.stiffness = config.stiffness ?? 170
    this.damping = config.damping ?? 26
    this.mass = config.mass ?? 1
    this.precision = config.precision ?? 0.001
  }

  /** True when value and velocity are within `precision` of rest at the target. */
  get settled(): boolean {
    return Math.abs(this.target - this.value) <= this.precision && Math.abs(this.velocity) <= this.precision
  }

  /** Jump to a value with no motion. */
  snap(value: number): this {
    this.value = value
    this.target = value
    this.velocity = 0
    return this
  }

  /** Adds an instantaneous velocity kick (units per second). */
  impulse(velocity: number): this {
    this.velocity += velocity
    return this
  }

  /** Advances the simulation by `dt` seconds. Returns the new value. */
  step(dt: number): number {
    if (dt <= 0) return this.value
    if (this.settled) {
      this.value = this.target
      this.velocity = 0
      return this.value
    }
    const { stiffness: k, damping: c, mass: m } = this
    const x0 = this.value - this.target
    const v0 = this.velocity
    const w0 = Math.sqrt(k / m)
    const zeta = c / (2 * Math.sqrt(k * m))
    let x: number
    let v: number

    if (Math.abs(zeta - 1) < 1e-3) {
      // Critically damped (with tolerance: the other branches divide by
      // terms that vanish as zeta → 1): fastest approach without overshoot.
      const e = Math.exp(-w0 * dt)
      const b = v0 + w0 * x0
      x = e * (x0 + b * dt)
      v = e * (b - w0 * (x0 + b * dt))
    } else if (zeta < 1) {
      // Under-damped: oscillates while decaying.
      const wd = w0 * Math.sqrt(1 - zeta * zeta)
      const e = Math.exp(-zeta * w0 * dt)
      const cos = Math.cos(wd * dt)
      const sin = Math.sin(wd * dt)
      const b = (v0 + zeta * w0 * x0) / wd
      x = e * (x0 * cos + b * sin)
      v = e * ((-zeta * w0) * (x0 * cos + b * sin) + (-x0 * wd * sin + b * wd * cos))
    } else {
      // Over-damped: slow, creeping approach.
      const s = w0 * Math.sqrt(zeta * zeta - 1)
      const r1 = -zeta * w0 + s
      const r2 = -zeta * w0 - s
      const c2 = (v0 - r1 * x0) / (r2 - r1)
      const c1 = x0 - c2
      const e1 = Math.exp(r1 * dt)
      const e2 = Math.exp(r2 * dt)
      x = c1 * e1 + c2 * e2
      v = c1 * r1 * e1 + c2 * r2 * e2
    }

    this.value = this.target + x
    this.velocity = v
    if (this.settled) {
      this.value = this.target
      this.velocity = 0
    }
    return this.value
  }
}
