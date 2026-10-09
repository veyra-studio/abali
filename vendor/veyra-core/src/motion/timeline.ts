/**
 * Timelines: sequenced, seekable motion. A timeline can play in time
 * (driven by the ticker) or be scrubbed by any progress source — most
 * often a scroll scene. Standalone tweens are single-child timelines.
 */
import { resolveEase, type Ease, type EaseLike } from '../core/ease.js'
import { clamp } from '../core/math.js'
import { getDefaultTicker, Phase, type Ticker } from '../core/ticker.js'
import { readValue, writeValue } from './style.js'
import { interpolate, type Interpolator, type TweenValue } from './values.js'

export type Targets = object | string | ArrayLike<object> | null | undefined
export type TweenVars = Record<string, TweenValue>
/** Per-target delay. A number staggers linearly; a function gets full control. */
export type Stagger = number | ((index: number, count: number) => number)

export interface TweenOptions {
  /** Seconds. Default `0.8`. */
  duration?: number
  /** Default `'glide'`. */
  ease?: EaseLike
  /** Offsets each target's start when animating several targets. */
  stagger?: Stagger
  onStart?: () => void
  onUpdate?: (progress: number) => void
  onComplete?: () => void
}

/**
 * Where to insert a child:
 * - `number` — absolute seconds
 * - omitted — end of the timeline
 * - `'<'` / `'>'` — start / end of the previously added child (`'<0.2'`, `'>-=0.1'` offsets)
 * - `'+=0.5'` / `'-=0.5'` — relative to the end of the timeline
 * - `'label'`, `'label+=0.3'` — relative to a label
 */
export type Position = number | string

export interface TimelineOptions {
  ticker?: Ticker
  /** Called after every render with the timeline progress. */
  onUpdate?: (progress: number) => void
  onComplete?: () => void
  /** Restart from the beginning when playback reaches an end. */
  loop?: boolean
  /** Playback speed multiplier. */
  timeScale?: number
}

interface Child {
  start: number
  duration: number
  /** `localTime` may be outside `[0, duration]`. */
  render(localTime: number, force: boolean): void
}

/** Resolves selectors, lists and single objects into an array of targets. */
export function toTargets(targets: Targets): object[] {
  if (targets == null) return []
  if (typeof targets === 'string') {
    return typeof document === 'undefined' ? [] : Array.from(document.querySelectorAll(targets))
  }
  if (typeof (targets as ArrayLike<object>).length === 'number' && !(typeof Element !== 'undefined' && targets instanceof Element)) {
    return Array.from(targets as ArrayLike<object>)
  }
  return [targets as object]
}

interface Track {
  target: object
  key: string
  from: TweenValue | undefined
  to: TweenValue | undefined
  interp?: Interpolator
}

class TweenChild implements Child {
  start = 0
  duration: number
  private readonly ease: Ease
  private initialized = false
  private last = -1

  constructor(
    private readonly tracks: Track[],
    private readonly options: TweenOptions,
    immediate: boolean,
  ) {
    this.duration = Math.max(0, options.duration ?? 0.8)
    this.ease = resolveEase(options.ease)
    if (immediate) {
      // fromTo/from: show the start state now, before the tween is reached.
      this.init()
      this.apply(0, -1)
      this.last = 0
    }
  }

  private init(): void {
    for (const t of this.tracks) {
      const current = readValue(t.target, t.key)
      t.interp = interpolate(t.from ?? current, t.to ?? current)
    }
    this.initialized = true
  }

  render(local: number, force: boolean): void {
    // Start values are captured the first time the playhead reaches the
    // tween, so sequenced tweens chain from each other's end states.
    if (!this.initialized) {
      if (local < 0) return
      this.init()
    }
    const p = this.duration === 0 ? (local >= 0 ? 1 : 0) : clamp(local / this.duration)
    if (p === this.last && !force) return
    const previous = this.last
    this.last = p
    this.apply(p, previous)
  }

  private apply(p: number, previous: number): void {
    const e = this.ease(p)
    for (const t of this.tracks) writeValue(t.target, t.key, t.interp!(e))
    if (previous <= 0 && p > 0) this.options.onStart?.()
    this.options.onUpdate?.(p)
    if (p === 1 && previous !== 1) this.options.onComplete?.()
  }
}

class CallChild implements Child {
  duration = 0
  start = 0
  private prev = -Infinity
  constructor(private readonly fn: (direction: 1 | -1) => void) {}
  render(local: number): void {
    const prev = this.prev
    this.prev = local
    if (prev < 0 && local >= 0) this.fn(1)
    else if (prev >= 0 && local < 0) this.fn(-1)
  }
}

class FnChild implements Child {
  start = 0
  private active = false
  private last = -1
  private readonly ease: Ease
  constructor(
    private readonly fn: (progress: number) => void,
    public duration: number,
    ease: EaseLike | undefined,
  ) {
    this.ease = resolveEase(ease, (t) => t)
  }
  render(local: number, force: boolean): void {
    if (!this.active) {
      if (local < 0) return
      this.active = true
    }
    const p = this.duration === 0 ? (local >= 0 ? 1 : 0) : clamp(local / this.duration)
    if (p === this.last && !force) return
    this.last = p
    this.fn(this.ease(p))
  }
}

export class Timeline implements Child {
  /** Start offset when nested inside another timeline. */
  start = 0
  timeScale: number
  loop: boolean

  private children: Child[] = []
  private labels = new Map<string, number>()
  private last: Child | null = null
  private _time = 0
  private _duration = 0
  private _playing = false
  private direction: 1 | -1 = 1
  private detach: (() => void) | null = null
  private readonly ticker: Ticker
  private readonly options: TimelineOptions
  private resolveFinished: (() => void) | null = null
  private _finished: Promise<void> = Promise.resolve()
  private initialized = false

  constructor(options: TimelineOptions = {}) {
    this.options = options
    this.ticker = options.ticker ?? getDefaultTicker()
    this.timeScale = options.timeScale ?? 1
    this.loop = options.loop ?? false
  }

  /** Total length in seconds. */
  get duration(): number {
    return this._duration
  }

  /** Playhead position in seconds. */
  get time(): number {
    return this._time
  }
  set time(value: number) {
    this.seek(value)
  }

  /** Playhead position as `[0, 1]`. Setting it scrubs the timeline. */
  get progress(): number {
    return this._duration === 0 ? (this._time > 0 ? 1 : 0) : this._time / this._duration
  }
  set progress(value: number) {
    this.seek(clamp(value) * this._duration)
  }

  get playing(): boolean {
    return this._playing
  }

  /** Resolves when the current playback reaches its end. */
  get finished(): Promise<void> {
    return this._finished
  }

  /** Animates targets from their current values to `vars`. */
  to(targets: Targets, vars: TweenVars, options: TweenOptions = {}, position?: Position): this {
    return this.addTweens(targets, undefined, vars, options, position, false)
  }

  /** Animates targets from `vars` to their current values. */
  from(targets: Targets, vars: TweenVars, options: TweenOptions = {}, position?: Position): this {
    return this.addTweens(targets, vars, undefined, options, position, true)
  }

  /** Animates targets between explicit values. The start state is applied immediately. */
  fromTo(targets: Targets, fromVars: TweenVars, toVars: TweenVars, options: TweenOptions = {}, position?: Position): this {
    return this.addTweens(targets, fromVars, toVars, options, position, true)
  }

  /** Sets values at a point in time (a zero-length tween). */
  set(targets: Targets, vars: TweenVars, position?: Position): this {
    return this.addTweens(targets, undefined, vars, { duration: 0 }, position, false)
  }

  /** Calls `fn` whenever the playhead crosses `position` (receives the direction). */
  call(fn: (direction: 1 | -1) => void, position?: Position): this {
    return this.insert(new CallChild(fn), position)
  }

  /**
   * Adds a nested timeline, or a function that receives an eased progress
   * over `duration` seconds.
   */
  add(child: Timeline | ((progress: number) => void), position?: Position, options: { duration?: number; ease?: EaseLike } = {}): this {
    if (child instanceof Timeline) return this.insert(child, position)
    return this.insert(new FnChild(child, options.duration ?? 1, options.ease), position)
  }

  /** Names a point in time. */
  label(name: string, position?: Position): this {
    this.labels.set(name, this.resolve(position))
    return this
  }

  /** Moves the playhead and renders. */
  seek(time: number, force = false): this {
    this._time = clamp(time, 0, this._duration)
    this.renderAt(this._time, force)
    return this
  }

  play(from?: number): this {
    if (from !== undefined) this.seek(from)
    this.direction = 1
    return this.run()
  }

  reverse(from?: number): this {
    if (from !== undefined) this.seek(from)
    this.direction = -1
    return this.run()
  }

  restart(): this {
    this.seek(0, true)
    return this.play()
  }

  pause(): this {
    this._playing = false
    this.detach?.()
    this.detach = null
    return this
  }

  /** Stops playback and removes all children. */
  kill(): this {
    this.pause()
    this.children = []
    this._duration = 0
    return this
  }

  /** @internal Child protocol, used when nested. */
  render(local: number, force: boolean): void {
    if (!this.initialized) {
      if (local < 0) return
      this.initialized = true
    }
    this._time = clamp(local, 0, this._duration)
    this.renderAt(this._time, force)
  }

  private run(): this {
    if (this._playing) return this
    if (this._duration === 0) {
      this.renderAt(this._time, true)
      this.options.onComplete?.()
      return this
    }
    if ((this.direction === 1 && this._time >= this._duration) || (this.direction === -1 && this._time <= 0)) {
      this._time = this.direction === 1 ? 0 : this._duration
    }
    this._playing = true
    this._finished = new Promise((resolve) => (this.resolveFinished = resolve))
    this.detach = this.ticker.add((frame) => {
      let next = this._time + frame.delta * this.timeScale * this.direction
      let done = false
      const atEnd = this.direction === 1 ? next >= this._duration : next <= 0
      if (atEnd) {
        if (this.loop) {
          next = this.direction === 1 ? next - this._duration : this._duration + next
          this.renderAt(this.direction === 1 ? this._duration : 0, false)
        } else {
          next = clamp(next, 0, this._duration)
          done = true
        }
      }
      this._time = next
      this.renderAt(next, false)
      if (done) {
        this.pause()
        this.options.onComplete?.()
        this.resolveFinished?.()
      }
    }, Phase.update)
    if (this.ticker === getDefaultTicker()) this.ticker.start()
    return this
  }

  private addTweens(
    targets: Targets,
    fromVars: TweenVars | undefined,
    toVars: TweenVars | undefined,
    options: TweenOptions,
    position: Position | undefined,
    immediate: boolean,
  ): this {
    const list = toTargets(targets)
    const keys = Object.keys(toVars ?? fromVars ?? {})
    const base = this.resolve(position)
    const stagger = options.stagger ?? 0
    let first: Child | null = null
    list.forEach((target, index) => {
      const tracks: Track[] = keys.map((key) => ({
        target,
        key,
        from: fromVars?.[key],
        to: toVars?.[key],
      }))
      const offset = typeof stagger === 'function' ? stagger(index, list.length) : stagger * index
      const child = new TweenChild(tracks, options, immediate)
      child.start = base + offset
      this.push(child)
      first ??= child
    })
    if (first) this.last = first
    return this
  }

  private insert(child: Child, position: Position | undefined): this {
    child.start = this.resolve(position)
    this.push(child)
    this.last = child
    return this
  }

  private push(child: Child): void {
    this.children.push(child)
    this._duration = Math.max(this._duration, child.start + child.duration)
  }

  private resolve(position: Position | undefined): number {
    const end = this._duration
    if (position === undefined) return end
    if (typeof position === 'number') return Math.max(0, position)
    const prevStart = this.last?.start ?? 0
    const prevEnd = this.last ? this.last.start + this.last.duration : 0
    const m = /^(<|>)?(?:([+-]=)?(-?\d*\.?\d+))?$/.exec(position.trim())
    if (m && !m[1] && !m[2] && m[3]) return Math.max(0, parseFloat(m[3]))
    if (m && (m[1] || m[2])) {
      const base = m[1] === '<' ? prevStart : m[1] === '>' ? prevEnd : end
      const amount = m[3] ? parseFloat(m[3]) : 0
      return Math.max(0, m[2] === '-=' ? base - amount : base + amount)
    }
    const lm = /^(.+?)(?:([+-]=)(\d*\.?\d+))?$/.exec(position.trim())
    if (lm && this.labels.has(lm[1]!)) {
      const base = this.labels.get(lm[1]!)!
      const amount = lm[3] ? parseFloat(lm[3]) : 0
      return Math.max(0, lm[2] === '-=' ? base - amount : base + amount)
    }
    throw new Error(`[veyra] Invalid timeline position "${position}"`)
  }

  /**
   * Renders children so the right one wins when several touch the same
   * property: not-yet-started children first (latest start first), then
   * completed ones (earliest end first), then active ones.
   */
  private renderAt(time: number, force: boolean): void {
    const pending: Child[] = []
    const done: Child[] = []
    const active: Child[] = []
    for (const child of this.children) {
      if (time < child.start) pending.push(child)
      else if (time > child.start + child.duration || (child.duration === 0 && time >= child.start)) done.push(child)
      else active.push(child)
    }
    pending.sort((a, b) => b.start - a.start)
    done.sort((a, b) => a.start + a.duration - (b.start + b.duration))
    active.sort((a, b) => a.start - b.start)
    for (const c of pending) c.render(time - c.start, force)
    for (const c of done) c.render(time - c.start, force)
    for (const c of active) c.render(time - c.start, force)
    this.options.onUpdate?.(this.progress)
  }
}

/** Creates a paused timeline. */
export function timeline(options?: TimelineOptions): Timeline {
  return new Timeline(options)
}

/**
 * Animates `targets` to `vars` right away and returns the playing timeline.
 *
 * ```ts
 * animate('.title', { y: 0, opacity: 1 }, { duration: 1.2, ease: 'glide' })
 * animate(uniforms.uReveal, { value: 1 })
 * ```
 */
export function animate(targets: Targets, vars: TweenVars, options: TweenOptions & { ticker?: Ticker; delay?: number } = {}): Timeline {
  const tl = new Timeline({ ticker: options.ticker })
  tl.to(targets, vars, options, options.delay ?? 0)
  return tl.play()
}
