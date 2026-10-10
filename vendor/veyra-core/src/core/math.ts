/**
 * Scalar helpers used throughout the engine. All functions are pure.
 */

/** Clamp `value` into `[min, max]` (defaults to the unit interval). */
export function clamp(value: number, min = 0, max = 1): number {
  return value < min ? min : value > max ? max : value
}

/** Linear interpolation between `a` and `b`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Inverse of {@link lerp}: where `value` sits between `a` and `b` (unclamped). */
export function invLerp(a: number, b: number, value: number): number {
  return a === b ? (value < a ? 0 : 1) : (value - a) / (b - a)
}

/** Re-map `value` from `[inMin, inMax]` to `[outMin, outMax]`. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  clampResult = false,
): number {
  const t = invLerp(inMin, inMax, value)
  return lerp(outMin, outMax, clampResult ? clamp(t) : t)
}

/** Hermite smoothstep between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(invLerp(edge0, edge1, x))
  return t * t * (3 - 2 * t)
}

/**
 * The local progress of `progress` inside the window `[start, end]`, clamped
 * to `[0, 1]`. This is the workhorse of scroll choreography: one scene
 * progress drives many beats, each owning a slice of the timeline.
 *
 * ```ts
 * const titleIn = range(scene.progress, 0, 0.25)
 * const bottleTurn = range(scene.progress, 0.2, 0.8)
 * ```
 */
export function range(progress: number, start: number, end: number): number {
  return clamp(invLerp(start, end, progress))
}

/**
 * Frame-rate independent exponential smoothing. Moves `current` toward
 * `target`; `lambda` is the convergence rate per second (higher = snappier).
 * Unlike `lerp(current, target, 0.1)` the result does not depend on FPS.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/**
 * Converts a per-frame lerp factor tuned at 60 fps (e.g. `0.1`) into the
 * equivalent `lambda` for {@link damp}.
 */
export function lerpToLambda(factor: number, fps = 60): number {
  return -Math.log(1 - clamp(factor, 0, 0.999999)) * fps
}

/** Wrap `value` into `[min, max)`. */
export function wrap(value: number, min: number, max: number): number {
  const span = max - min
  return span === 0 ? min : ((((value - min) % span) + span) % span) + min
}

/** Fractional part, always positive. */
export function fract(value: number): number {
  return value - Math.floor(value)
}

/** Round `value` to `decimals` decimal places. */
export function roundTo(value: number, decimals = 3): number {
  const p = 10 ** decimals
  return Math.round(value * p) / p
}

/** Deterministic pseudo-random generator (mulberry32). Returns a function producing `[0, 1)`. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
