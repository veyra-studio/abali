/**
 * Layout measurement cache. Reading layout every frame is the classic
 * source of scroll jank, so element rects are measured once (and again
 * after layout changes) in document coordinates; viewport positions are
 * derived from the scroll offset.
 *
 * Elements inside sticky or transformed containers move independently of
 * scroll — track those as `live`, which re-measures them once per frame
 * during the measure phase (all reads batched, no interleaved writes).
 */

export interface DocRect {
  /** Distance from the top of the document (px). */
  top: number
  /** Distance from the left of the document (px). */
  left: number
  width: number
  height: number
}

export interface ViewRect extends DocRect {
  bottom: number
  right: number
}

interface Entry {
  rect: DocRect
  live: boolean
  stale: boolean
  refs: number
}

export class RectCache {
  private readonly entries = new Map<Element, Entry>()

  constructor(private readonly scrollY: () => number = () => (typeof window === 'undefined' ? 0 : window.scrollY)) {}

  /** Measures an element right now (document coordinates). */
  measure(el: Element): DocRect {
    const r = el.getBoundingClientRect()
    const sx = typeof window === 'undefined' ? 0 : window.scrollX
    return { top: r.top + this.scrollY(), left: r.left + sx, width: r.width, height: r.height }
  }

  /**
   * Starts tracking `el`. With `live`, it is re-measured every frame.
   * Returns a function that stops tracking.
   */
  track(el: Element, options: { live?: boolean } = {}): () => void {
    const existing = this.entries.get(el)
    if (existing) {
      existing.refs++
      existing.live ||= !!options.live
    } else {
      this.entries.set(el, { rect: this.measure(el), live: !!options.live, stale: false, refs: 1 })
    }
    let released = false
    return () => {
      if (released) return
      released = true
      const entry = this.entries.get(el)
      if (entry && --entry.refs <= 0) this.entries.delete(el)
    }
  }

  /** Cached document rect (measures on first use or when stale). */
  get(el: Element): DocRect {
    const entry = this.entries.get(el)
    if (!entry) return this.measure(el)
    if (entry.stale) {
      entry.rect = this.measure(el)
      entry.stale = false
    }
    return entry.rect
  }

  /** Viewport-relative rect derived from the cache and the scroll offset. */
  view(el: Element, scrollY: number = this.scrollY()): ViewRect {
    const r = this.get(el)
    const sx = typeof window === 'undefined' ? 0 : window.scrollX
    const top = r.top - scrollY
    const left = r.left - sx
    return { top, left, width: r.width, height: r.height, bottom: top + r.height, right: left + r.width }
  }

  /** Marks every cached rect stale; they re-measure lazily. */
  invalidate(): void {
    for (const entry of this.entries.values()) entry.stale = true
  }

  /** Re-measures live entries. Called once per frame in the measure phase. */
  updateLive(): void {
    for (const [el, entry] of this.entries) {
      if (entry.live || entry.stale) {
        entry.rect = this.measure(el)
        entry.stale = false
      }
    }
  }

  get size(): number {
    return this.entries.size
  }
}
