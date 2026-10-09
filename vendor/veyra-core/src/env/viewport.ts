/**
 * Viewport state as signals, with a resize policy suited to mobile: a
 * height-only change smaller than `heightThreshold` (the URL bar showing or
 * hiding while scrolling) does not trigger a layout refresh.
 */
import { signal, type Signal } from '../core/signal.js'

export interface ViewportOptions {
  /** Height changes below this (px) are ignored for layout on touch devices. Default `160`. */
  heightThreshold?: number
}

export class Viewport {
  readonly width: Signal<number>
  readonly height: Signal<number>
  readonly dpr: Signal<number>
  /** Coarse primary pointer (most phones and tablets). */
  readonly touch: Signal<boolean>
  /** Last width/height used for layout. Changes trigger `onLayout`. */
  readonly layoutSize: Signal<{ width: number; height: number }>

  private readonly heightThreshold: number
  private readonly cleanups: Array<() => void> = []

  constructor(options: ViewportOptions = {}) {
    this.heightThreshold = options.heightThreshold ?? 160
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth
    const h = typeof window === 'undefined' ? 800 : window.innerHeight
    this.width = signal(w)
    this.height = signal(h)
    this.dpr = signal(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
    this.touch = signal(typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches)
    this.layoutSize = signal({ width: w, height: h }, (a, b) => a.width === b.width && a.height === b.height)

    if (typeof window === 'undefined') return
    const onResize = () => this.read()
    window.addEventListener('resize', onResize, { passive: true })
    this.cleanups.push(() => window.removeEventListener('resize', onResize))
    const coarse = window.matchMedia?.('(pointer: coarse)')
    if (coarse) {
      const onPointer = (e: MediaQueryListEvent) => this.touch.set(e.matches)
      coarse.addEventListener?.('change', onPointer)
      this.cleanups.push(() => coarse.removeEventListener?.('change', onPointer))
    }
  }

  get w(): number {
    return this.width.value
  }

  get h(): number {
    return this.height.value
  }

  get aspect(): number {
    return this.width.value / Math.max(1, this.height.value)
  }

  /** Re-reads window metrics. Called on `resize`; call manually if needed. */
  read(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.width.set(w)
    this.height.set(h)
    this.dpr.set(window.devicePixelRatio || 1)
    const prev = this.layoutSize.value
    const heightOnly = w === prev.width
    if (heightOnly && this.touch.value && Math.abs(h - prev.height) < this.heightThreshold) return
    this.layoutSize.set({ width: w, height: h })
  }

  /** Subscribes to layout-relevant resizes. */
  onLayout(fn: (size: { width: number; height: number }) => void): () => void {
    return this.layoutSize.subscribe((size) => fn(size))
  }

  destroy(): void {
    for (const c of this.cleanups) c()
  }
}
