/**
 * Easing curves. Every ease maps `t ∈ [0, 1]` to an eased value where
 * `ease(0) = 0` and `ease(1) = 1` (overshooting curves may leave `[0, 1]`
 * in between).
 */
export type Ease = (t: number) => number

const PI = Math.PI
const c1 = 1.70158
const c2 = c1 * 1.525
const c3 = c1 + 1

/**
 * A CSS-compatible `cubic-bezier(x1, y1, x2, y2)` timing function.
 * Solved with Newton–Raphson, falling back to bisection.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solveT = (x: number): number => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      if (Math.abs(err) < 1e-7) return t
      const d = slopeX(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 40; i++) {
      const v = sampleX(t)
      if (Math.abs(v - x) < 1e-7) break
      if (x > v) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveT(x)))
}

const bounceOut: Ease = (t) => {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}

/** The built-in easing library. */
export const ease = {
  linear: (t: number) => t,

  sineIn: (t: number) => 1 - Math.cos((t * PI) / 2),
  sineOut: (t: number) => Math.sin((t * PI) / 2),
  sineInOut: (t: number) => -(Math.cos(PI * t) - 1) / 2,

  quadIn: (t: number) => t * t,
  quadOut: (t: number) => 1 - (1 - t) * (1 - t),
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),

  cubicIn: (t: number) => t * t * t,
  cubicOut: (t: number) => 1 - (1 - t) ** 3,
  cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),

  quartIn: (t: number) => t ** 4,
  quartOut: (t: number) => 1 - (1 - t) ** 4,
  quartInOut: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),

  quintIn: (t: number) => t ** 5,
  quintOut: (t: number) => 1 - (1 - t) ** 5,
  quintInOut: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),

  expoIn: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  expoOut: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  expoInOut: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,

  circIn: (t: number) => 1 - Math.sqrt(1 - t * t),
  circOut: (t: number) => Math.sqrt(1 - (t - 1) ** 2),
  circInOut: (t: number) =>
    t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,

  backIn: (t: number) => c3 * t ** 3 - c1 * t * t,
  backOut: (t: number) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2,
  backInOut: (t: number) =>
    t < 0.5
      ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
      : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,

  elasticOut: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1,

  bounceOut,

  /** Veyra signature curves — tuned for editorial, cinematic motion. */
  /** Long, soft landing. Good default for reveals. */
  glide: cubicBezier(0.16, 1, 0.3, 1),
  /** Symmetric, weighty in-out for camera and object moves. */
  drift: cubicBezier(0.65, 0, 0.35, 1),
  /** Fast attack, decisive stop. UI and micro-interactions. */
  snap: cubicBezier(0.2, 0.9, 0.1, 1),
  /** Slow build, hard release — anticipation before an event. */
  tension: cubicBezier(0.7, 0, 0.84, 0),
} satisfies Record<string, Ease>

export type EaseName = keyof typeof ease

/** Accepts an ease function or the name of a built-in ease. */
export type EaseLike = Ease | EaseName

export function resolveEase(value: EaseLike | undefined, fallback: Ease = ease.glide): Ease {
  if (!value) return fallback
  if (typeof value === 'function') return value
  const fn = ease[value]
  if (!fn) throw new Error(`[veyra] Unknown ease "${String(value)}"`)
  return fn
}
