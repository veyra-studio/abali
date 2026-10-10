/**
 * Scenes map scroll position onto progress for a stretch of the document.
 *
 * A scene is defined by an element and two anchors, each written as
 * `"<element edge> <viewport edge>"` — `"top bottom"` means "when the
 * element's top meets the viewport's bottom". Edges accept `top`,
 * `center`, `bottom`, percentages, pixels, and `+=` / `-=` offsets
 * (`"top+=120 center"`, `"bottom 20%"`).
 *
 * Pinning is done with CSS: make a tall wrapper the scene element and give
 * its child `position: sticky; top: 0; height: 100vh`. With the `pinned`
 * preset (`top top` → `bottom bottom`), progress runs 0→1 exactly while
 * the child is stuck. Native sticky is jank-free and needs no spacer hacks.
 */
import { clamp, damp, range } from '../core/math.js'
import type { Frame } from '../core/ticker.js'
import type { RectCache } from '../layout/rects.js'
import type { Timeline } from '../motion/timeline.js'

export interface SceneOptions {
  /** Default `'top bottom'`. */
  start?: string
  /** Default `'bottom top'`. */
  end?: string
  /** Element whose box defines the range. Defaults to the scene element. */
  trigger?: Element
  /** Mirrors progress into a CSS custom property on the element, e.g. `'--progress'`. */
  cssVar?: string
  /** Smooths progress with this convergence rate (per second). `0` = off. */
  smooth?: number
  /** Timeline scrubbed by the scene progress. */
  timeline?: Timeline
  /** Keep calling `onUpdate` this many px beyond the range. Default: half a viewport. */
  margin?: number
  onEnter?: (scene: Scene) => void
  onLeave?: (scene: Scene) => void
  onEnterBack?: (scene: Scene) => void
  onLeaveBack?: (scene: Scene) => void
  /** Called when progress changes. */
  onProgress?: (progress: number, scene: Scene) => void
  /** Called every frame while the scene is near or inside its range. */
  onUpdate?: (scene: Scene, frame: Readonly<Frame>) => void
}

/** Common anchor pairs. */
export const scenePresets = {
  /** Visible anywhere in the viewport: enters at the bottom, leaves at the top. */
  inView: { start: 'top bottom', end: 'bottom top' },
  /** While a sticky child is pinned inside a tall wrapper. */
  pinned: { start: 'top top', end: 'bottom bottom' },
  /** From entering the viewport until its top reaches the middle. */
  reveal: { start: 'top bottom', end: 'top center' },
  /** From its top reaching the top of the viewport until its bottom does. */
  through: { start: 'top top', end: 'bottom top' },
} as const satisfies Record<string, Pick<SceneOptions, 'start' | 'end'>>

type Zone = -1 | 0 | 1

/** Resolves one edge token (e.g. `"top+=20"`, `"50%"`, `"center"`) against a size in px. */
export function resolveEdge(token: string, size: number): number {
  const m = /^(top|center|bottom|left|right|-?\d*\.?\d+(?:px|%)?)(?:([+-]=)(-?\d*\.?\d+)(px|%)?)?$/.exec(token.trim())
  if (!m) throw new Error(`[veyra] Invalid scene edge "${token}"`)
  const base = m[1]!
  let value: number
  if (base === 'top' || base === 'left') value = 0
  else if (base === 'center') value = size / 2
  else if (base === 'bottom' || base === 'right') value = size
  else if (base.endsWith('%')) value = (parseFloat(base) / 100) * size
  else value = parseFloat(base)
  if (m[2]) {
    const amount = m[4] === '%' ? (parseFloat(m[3]!) / 100) * size : parseFloat(m[3]!)
    value += m[2] === '-=' ? -amount : amount
  }
  return value
}

/** Scroll position (px) at which `anchor` is satisfied. */
export function resolveAnchor(anchor: string, elTop: number, elHeight: number, viewportHeight: number): number {
  const parts = anchor.trim().split(/\s+/)
  if (parts.length !== 2) throw new Error(`[veyra] Scene anchor must be "<element edge> <viewport edge>", got "${anchor}"`)
  return elTop + resolveEdge(parts[0]!, elHeight) - resolveEdge(parts[1]!, viewportHeight)
}

export class Scene {
  readonly el: Element
  readonly options: SceneOptions
  /** Scroll position where progress is 0 (px). */
  start = 0
  /** Scroll position where progress is 1 (px). */
  end = 0
  /** Unclamped progress. */
  rawProgress = 0
  /** Progress clamped to `0…1` (smoothed when `smooth` is set). */
  progress = 0
  /** Progress change per second. */
  velocity = 0
  /** Inside `[start, end]`. */
  inRange = false
  /** Within the range plus margin — `onUpdate` runs only then. */
  active = false

  private zone: Zone | null = null
  private lastNotified = -1
  private disposed = false
  private release: (() => void) | null = null

  constructor(
    el: Element,
    options: SceneOptions,
    private readonly rects: RectCache,
    private readonly viewportHeight: () => number,
  ) {
    this.el = el
    this.options = options
    this.release = rects.track(options.trigger ?? el)
    this.refresh()
  }

  /** Length of the scroll range in px. */
  get length(): number {
    return this.end - this.start
  }

  /** Sub-progress of this scene within `[a, b]`. */
  local(a: number, b: number): number {
    return range(this.progress, a, b)
  }

  /** Recomputes the range from current layout. */
  refresh(): void {
    const rect = this.rects.get(this.options.trigger ?? this.el)
    const vh = this.viewportHeight()
    this.start = resolveAnchor(this.options.start ?? 'top bottom', rect.top, rect.height, vh)
    this.end = resolveAnchor(this.options.end ?? 'bottom top', rect.top, rect.height, vh)
  }

  /** Advances the scene for scroll position `y`. Called by the stage every frame. */
  update(y: number, frame: Readonly<Frame>): void {
    if (this.disposed) return
    const len = this.end - this.start
    this.rawProgress = len === 0 ? (y >= this.start ? 1 : 0) : (y - this.start) / len
    const target = clamp(this.rawProgress)
    const previous = this.progress
    const smooth = this.options.smooth ?? 0
    if (smooth > 0 && frame.delta > 0) {
      this.progress = damp(this.progress, target, smooth, frame.delta)
      if (Math.abs(this.progress - target) < 1e-4) this.progress = target
    } else {
      this.progress = target
    }
    this.velocity = frame.delta > 0 ? (this.progress - previous) / frame.delta : 0

    const zone: Zone = y < this.start ? -1 : y > this.end ? 1 : 0
    this.inRange = zone === 0
    const margin = this.options.margin ?? this.viewportHeight() * 0.5
    this.active = y >= this.start - margin && y <= this.end + margin
    if (this.zone !== null && zone !== this.zone) this.transition(this.zone, zone)
    this.zone = zone

    if (this.progress !== this.lastNotified) {
      this.lastNotified = this.progress
      if (this.options.cssVar) (this.el as HTMLElement).style.setProperty(this.options.cssVar, this.progress.toFixed(4))
      if (this.options.timeline) this.options.timeline.progress = this.progress
      this.options.onProgress?.(this.progress, this)
    }
    if (this.active) this.options.onUpdate?.(this, frame)
  }

  destroy(): void {
    this.disposed = true
    this.release?.()
    this.release = null
  }

  private transition(from: Zone, to: Zone): void {
    const o = this.options
    if (from === -1 && to === 0) o.onEnter?.(this)
    else if (from === 0 && to === 1) o.onLeave?.(this)
    else if (from === 1 && to === 0) o.onEnterBack?.(this)
    else if (from === 0 && to === -1) o.onLeaveBack?.(this)
    else if (from === -1 && to === 1) {
      o.onEnter?.(this)
      o.onLeave?.(this)
    } else if (from === 1 && to === -1) {
      o.onEnterBack?.(this)
      o.onLeaveBack?.(this)
    }
  }
}
