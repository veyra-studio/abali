/**
 * Adaptive quality. Watches real frame times and steps a quality level
 * down when the device struggles, and cautiously back up when it has
 * headroom. Renderers subscribe to `level` / `dpr` instead of guessing
 * device capability up front.
 */
import { clamp, lerp } from '../core/math.js'
import { signal, type Signal } from '../core/signal.js'

export type QualityTier = 'low' | 'medium' | 'high'

export interface QualityOptions {
  /** Starting level `0…1`, or `'auto'` to estimate from device hints. Default `'auto'`. */
  initial?: number | 'auto'
  /** Lowest allowed level. Default `0`. */
  min?: number
  /** Highest allowed level. Default `1`. */
  max?: number
  /** Frames per evaluation window. Default `45`. */
  window?: number
  /** Target as a fraction of the detected refresh rate. Default `0.86`. */
  targetRatio?: number
  /** Device-pixel-ratio range mapped from level. Default `[1, 2]`. */
  dprRange?: [number, number]
  /** Disable adaptation (level stays at `initial`). Default `true`. */
  adaptive?: boolean
}

/** Estimates a starting level from hardware hints. */
export function estimateQuality(): number {
  if (typeof navigator === 'undefined') return 0.75
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  let level = 0.75
  const cores = nav.hardwareConcurrency ?? 4
  if (cores <= 4) level -= 0.15
  if (cores >= 8) level += 0.1
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) level -= 0.15
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) level -= 0.1
  if (nav.connection?.saveData) level -= 0.25
  return clamp(level)
}

export class QualityGovernor {
  /** Continuous quality level, `0…1`. */
  readonly level: Signal<number>
  /** Coarse tier derived from `level`. */
  readonly tier: Signal<QualityTier>
  /** Recommended canvas pixel ratio. */
  readonly dpr: Signal<number>
  /** Detected display refresh rate (Hz), refined over the first second. */
  refreshRate = 60

  private readonly opts: Required<Omit<QualityOptions, 'initial'>>
  private samples: number[] = []
  private warmup: number[] = []
  private badWindows = 0
  private goodWindows = 0
  private cooldown = 0

  constructor(options: QualityOptions = {}) {
    this.opts = {
      min: options.min ?? 0,
      max: options.max ?? 1,
      window: options.window ?? 45,
      targetRatio: options.targetRatio ?? 0.86,
      dprRange: options.dprRange ?? [1, 2],
      adaptive: options.adaptive ?? true,
    }
    const initial = options.initial === undefined || options.initial === 'auto' ? estimateQuality() : options.initial
    this.level = signal(clamp(initial, this.opts.min, this.opts.max))
    this.tier = signal(this.toTier(this.level.value))
    this.dpr = signal(this.toDpr(this.level.value))
    this.level.subscribe((l) => {
      this.tier.set(this.toTier(l))
      this.dpr.set(this.toDpr(l))
    })
  }

  /** Target frames per second given the refresh rate. */
  get target(): number {
    return Math.min(this.refreshRate, 120) * this.opts.targetRatio
  }

  /** Forces a level (e.g. from a user setting). */
  set(level: number): void {
    this.level.set(clamp(level, this.opts.min, this.opts.max))
  }

  /** Feeds one frame's real duration in seconds. Called by the stage every frame. */
  sample(rawDelta: number): void {
    // Ignore stalls (tab switches, GC pauses, first frame).
    if (rawDelta <= 0 || rawDelta > 0.25) return
    if (this.warmup.length < 60) {
      this.warmup.push(rawDelta)
      if (this.warmup.length === 60) {
        const sorted = [...this.warmup].sort((a, b) => a - b)
        const median = sorted[30]!
        const hz = 1 / median
        // Snap to common refresh rates.
        this.refreshRate = [30, 48, 60, 75, 90, 100, 120, 144, 165, 240].reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best), 60)
      }
      return
    }
    if (!this.opts.adaptive) return
    if (this.cooldown > 0) {
      this.cooldown--
      return
    }
    this.samples.push(rawDelta)
    if (this.samples.length < this.opts.window) return
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length
    this.samples = []
    const fps = 1 / avg
    if (fps < this.target) {
      this.goodWindows = 0
      if (++this.badWindows >= 2) {
        this.badWindows = 0
        this.step(-0.2)
      }
    } else if (fps > this.target * 1.08) {
      this.badWindows = 0
      // Climb slowly to avoid oscillating between levels.
      if (++this.goodWindows >= 6) {
        this.goodWindows = 0
        this.step(0.1)
      }
    } else {
      this.badWindows = 0
      this.goodWindows = 0
    }
  }

  private step(amount: number): void {
    const next = clamp(this.level.value + amount, this.opts.min, this.opts.max)
    if (next === this.level.value) return
    this.level.set(next)
    // Give the new level time to show its effect before judging again.
    this.cooldown = 30
  }

  private toTier(l: number): QualityTier {
    return l < 0.34 ? 'low' : l < 0.67 ? 'medium' : 'high'
  }

  private toDpr(l: number): number {
    const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    const [lo, hi] = this.opts.dprRange
    return Math.round(Math.min(device, lerp(lo, hi, l)) * 100) / 100
  }
}
