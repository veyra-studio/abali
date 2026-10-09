/**
 * The stage is the composition root: one ticker, one viewport, one pointer,
 * one scroll controller, one layout cache and the scenes that hang off
 * them, wired in the right order every frame.
 *
 * ```ts
 * const stage = createStage()
 * stage.scene('#intro', { ...scenePresets.pinned, onProgress: (p) => … })
 * ```
 */
import { mediaSignal, signal, type Signal } from './core/signal.js'
import { getDefaultTicker, Phase, type Frame, type TickFn, type Ticker } from './core/ticker.js'
import { DebugOverlay, debugRequested } from './debug/overlay.js'
import { Pointer, type PointerOptions } from './env/pointer.js'
import { Viewport, type ViewportOptions } from './env/viewport.js'
import { RectCache } from './layout/rects.js'
import { Timeline, type Targets, type TimelineOptions, type TweenOptions, type TweenVars } from './motion/timeline.js'
import { QualityGovernor, type QualityOptions } from './quality/governor.js'
import { Scene, type SceneOptions } from './scene/scene.js'
import { ScrollController, type ScrollOptions } from './scroll/scroll.js'
import { SoundBus, type SoundOptions } from './sound/bus.js'

export interface StageOptions {
  /** Defaults to the shared ticker. */
  ticker?: Ticker
  /** Scroll controller options, or `false` to read native scroll only. */
  scroll?: ScrollOptions | false
  /** Adaptive quality options, or `false` to disable. */
  quality?: QualityOptions | false
  pointer?: PointerOptions | false
  viewport?: ViewportOptions
  /** Sound bus options. Off unless provided. */
  sound?: SoundOptions | boolean
  /** Show the debug overlay. `'auto'` (default) follows `?debug` in the URL. */
  debug?: boolean | 'auto'
  /** `'system'` (default) follows `prefers-reduced-motion`. */
  reducedMotion?: 'system' | boolean
  /** Start the ticker immediately. Default `true`. */
  autoStart?: boolean
}

/** Extensions receive the stage and a way to register cleanup. */
export type StagePlugin<T> = (stage: Stage, onDestroy: (cleanup: () => void) => void) => T

export interface Stage {
  readonly ticker: Ticker
  readonly viewport: Viewport
  readonly pointer: Pointer | null
  readonly scroll: ScrollController | null
  readonly rects: RectCache
  readonly quality: QualityGovernor | null
  readonly sound: SoundBus | null
  /** Effective reduced-motion preference. Writable for in-page toggles. */
  readonly reducedMotion: Signal<boolean>
  readonly scenes: ReadonlySet<Scene>
  /** Current scroll position (px). */
  readonly scrollY: number
  /** Creates a scroll scene. */
  scene(target: Element | string, options?: SceneOptions): Scene
  /** Creates a paused timeline on this stage's ticker. */
  timeline(options?: Omit<TimelineOptions, 'ticker'>): Timeline
  /** Plays a tween on this stage. Jumps to the end under reduced motion. */
  animate(targets: Targets, vars: TweenVars, options?: TweenOptions & { delay?: number }): Timeline
  /** Runs `fn` every frame in `phase`. */
  onFrame(fn: TickFn, phase?: number): () => void
  /** Re-measures layout and scene ranges (batched to the next frame). */
  refresh(immediate?: boolean): void
  /** Installs an extension, e.g. `stage.use(threeLayer())`. */
  use<T>(plugin: StagePlugin<T>): T
  start(): Stage
  stop(): Stage
  destroy(): void
}

export function createStage(options: StageOptions = {}): Stage {
  const ticker = options.ticker ?? getDefaultTicker()
  const viewport = new Viewport(options.viewport)
  const pointer = options.pointer === false ? null : new Pointer(options.pointer)

  const systemReduced = mediaSignal('(prefers-reduced-motion: reduce)')
  const reducedMotion = signal(options.reducedMotion === undefined || options.reducedMotion === 'system' ? systemReduced.value : options.reducedMotion)
  const stopSystem = options.reducedMotion === undefined || options.reducedMotion === 'system' ? systemReduced.subscribe((v) => reducedMotion.set(v)) : () => {}
  const reflectReduced = (v: boolean) => {
    if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-reduced-motion', v)
  }
  reflectReduced(reducedMotion.value)
  const stopReflect = reducedMotion.subscribe(reflectReduced)

  const scroll = options.scroll === false ? null : new ScrollController(options.scroll ?? {}, { reducedMotion, touch: viewport.touch })
  const readScroll = () => (scroll ? scroll.y : typeof window === 'undefined' ? 0 : window.scrollY)
  const rects = new RectCache(readScroll)
  const quality = options.quality === false ? null : new QualityGovernor(options.quality)
  const sound = options.sound ? new SoundBus(options.sound === true ? {} : options.sound) : null
  const scenes = new Set<Scene>()
  const cleanups: Array<() => void> = []
  let needsRefresh = false

  const layoutHeight = () => viewport.layoutSize.value.height

  const doRefresh = () => {
    needsRefresh = false
    rects.invalidate()
    scroll?.refresh()
    for (const s of scenes) s.refresh()
  }

  const removers = [
    ticker.add((f) => pointer?.update(f.rawDelta, viewport.w, viewport.h), Phase.input),
    ticker.add((f) => scroll?.update(f.delta > 0 ? f.rawDelta : 0), Phase.scroll),
    ticker.add(() => {
      if (needsRefresh) doRefresh()
      rects.updateLive()
    }, Phase.measure),
    ticker.add((f: Readonly<Frame>) => {
      const y = readScroll()
      for (const s of scenes) s.update(y, f)
    }, Phase.update - 10),
    ticker.add((f) => quality?.sample(f.rawDelta), Phase.post),
  ]

  const debugOn = options.debug === true || ((options.debug ?? 'auto') === 'auto' && debugRequested())
  let overlay: DebugOverlay | null = null
  if (debugOn && typeof document !== 'undefined') {
    const mount = () => {
      overlay = new DebugOverlay({ scroll: () => scroll, quality: () => quality, scenes: () => scenes, viewportHeight: layoutHeight })
      removers.push(ticker.add((f) => overlay?.update(f), Phase.post + 10))
    }
    if (document.body) mount()
    else document.addEventListener('DOMContentLoaded', mount, { once: true })
  }

  cleanups.push(viewport.onLayout(() => (needsRefresh = true)))
  if (typeof document !== 'undefined') {
    const onFonts = () => (needsRefresh = true)
    document.fonts?.addEventListener?.('loadingdone', onFonts)
    cleanups.push(() => document.fonts?.removeEventListener?.('loadingdone', onFonts))
    const onLoad = () => (needsRefresh = true)
    window.addEventListener('load', onLoad)
    cleanups.push(() => window.removeEventListener('load', onLoad))
    if (typeof ResizeObserver !== 'undefined') {
      let lastHeight = -1
      const ro = new ResizeObserver(() => {
        const h = document.documentElement.scrollHeight
        if (h !== lastHeight) {
          lastHeight = h
          needsRefresh = true
        }
      })
      const observe = () => document.body && ro.observe(document.body)
      if (document.body) observe()
      else document.addEventListener('DOMContentLoaded', observe, { once: true })
      cleanups.push(() => ro.disconnect())
    }
  }

  const stage: Stage = {
    ticker,
    viewport,
    pointer,
    scroll,
    rects,
    quality,
    sound,
    reducedMotion,
    scenes,
    get scrollY() {
      return readScroll()
    },
    scene(target, sceneOptions = {}) {
      const el = typeof target === 'string' ? document.querySelector(target) : target
      if (!el) throw new Error(`[veyra] stage.scene: no element for ${String(target)}`)
      const s = new Scene(el, sceneOptions, rects, layoutHeight)
      const destroy = s.destroy.bind(s)
      s.destroy = () => {
        scenes.delete(s)
        destroy()
      }
      scenes.add(s)
      return s
    },
    timeline(timelineOptions = {}) {
      return new Timeline({ ...timelineOptions, ticker })
    },
    animate(targets, vars, tweenOptions = {}) {
      const reduced = reducedMotion.value
      const tl = new Timeline({ ticker })
      tl.to(targets, vars, reduced ? { ...tweenOptions, duration: 0, stagger: 0 } : tweenOptions, reduced ? 0 : (tweenOptions.delay ?? 0))
      return tl.play()
    },
    onFrame(fn, phase = Phase.update) {
      const remove = ticker.add(fn, phase)
      removers.push(remove)
      return remove
    },
    refresh(immediate = false) {
      if (immediate) doRefresh()
      else needsRefresh = true
    },
    use(plugin) {
      return plugin(stage, (fn) => cleanups.push(fn))
    },
    start() {
      ticker.start()
      return stage
    },
    stop() {
      ticker.stop()
      return stage
    },
    destroy() {
      for (const r of removers) r()
      for (const s of [...scenes]) s.destroy()
      for (const c of cleanups.splice(0)) c()
      overlay?.destroy()
      scroll?.destroy()
      pointer?.destroy()
      viewport.destroy()
      sound?.destroy()
      stopSystem()
      stopReflect()
      systemReduced.dispose()
    },
  }

  if (options.autoStart ?? true) ticker.start()
  return stage
}
