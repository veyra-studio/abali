/**
 * Asset preloading with weighted progress. Tasks start immediately; each
 * helper returns a promise of its result so loading and usage stay
 * together. Failures never block the experience: they are recorded,
 * counted as complete, and the caller decides on a fallback.
 */
import { signal, type Signal } from '../core/signal.js'

export interface PreloadDoneOptions {
  /** Resolve no earlier than this many seconds after the preloader was created. */
  minDuration?: number
}

export class Preloader {
  /** Weighted completion, `0…1`. */
  readonly progress: Signal<number> = signal(0)
  /** Errors from failed tasks. */
  readonly errors: unknown[] = []

  private total = 0
  private loaded = 0
  private readonly pending = new Set<Promise<unknown>>()
  private readonly createdAt = typeof performance === 'undefined' ? Date.now() : performance.now()

  /** Tracks any promise (or promise factory) with a progress weight. */
  add<T>(task: Promise<T> | (() => Promise<T>), weight = 1): Promise<T> {
    const promise = typeof task === 'function' ? task() : task
    this.total += weight
    this.update()
    const tracked = promise.then(
      (value) => {
        this.complete(weight, tracked)
        return value
      },
      (error: unknown) => {
        this.errors.push(error)
        this.complete(weight, tracked)
        console.warn('[veyra] Preload task failed:', error)
        throw error
      },
    )
    this.pending.add(tracked)
    // Avoid unhandled-rejection noise; callers may still catch `tracked`.
    tracked.catch(() => {})
    return tracked
  }

  /** Loads and decodes an image. */
  image(src: string, weight = 1): Promise<HTMLImageElement> {
    return this.add(async () => {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      if (typeof img.decode === 'function') await img.decode()
      else await new Promise((res, rej) => ((img.onload = res), (img.onerror = rej)))
      return img
    }, weight)
  }

  /** Loads a font face, e.g. `font('700 1em "Estedad"', 'متن نمونه')`. */
  font(descriptor: string, text?: string, weight = 0.5): Promise<FontFace[]> {
    return this.add(() => (typeof document === 'undefined' ? Promise.resolve([]) : document.fonts.load(descriptor, text)), weight)
  }

  /** Waits for every font declared in CSS that is currently loading. */
  fonts(weight = 0.5): Promise<unknown> {
    return this.add<unknown>(() => (typeof document === 'undefined' ? Promise.resolve() : document.fonts.ready), weight)
  }

  /** Fetches a resource. */
  fetch(url: string, as: 'arrayBuffer', weight?: number): Promise<ArrayBuffer>
  fetch(url: string, as: 'json', weight?: number): Promise<unknown>
  fetch(url: string, as: 'text', weight?: number): Promise<string>
  fetch(url: string, as: 'blob', weight?: number): Promise<Blob>
  fetch(url: string, as: 'arrayBuffer' | 'json' | 'text' | 'blob' = 'arrayBuffer', weight = 1): Promise<unknown> {
    return this.add(async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`[veyra] ${res.status} ${res.statusText} for ${url}`)
      return res[as]()
    }, weight)
  }

  /** Resolves when every task added so far (and any added meanwhile) settles. */
  async done(options: PreloadDoneOptions = {}): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending])
    const min = (options.minDuration ?? 0) * 1000
    const now = typeof performance === 'undefined' ? Date.now() : performance.now()
    const wait = this.createdAt + min - now
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.progress.set(1)
  }

  private complete(weight: number, task: Promise<unknown>): void {
    this.loaded += weight
    this.pending.delete(task)
    this.update()
  }

  private update(): void {
    this.progress.set(this.total === 0 ? 1 : Math.min(1, this.loaded / this.total))
  }
}
