/**
 * Minimal, explicit reactive values. No dependency tracking magic: you
 * subscribe to what you need, and derived values list their inputs.
 */

export type Listener<T> = (value: T, previous: T) => void

export interface ReadonlySignal<T> {
  /** Current value. */
  readonly value: T
  /** Same as `.value`; convenient for passing as a getter. */
  get(): T
  /**
   * Called whenever the value changes. Returns an unsubscribe function.
   * With `immediate`, the listener is also invoked right away.
   */
  subscribe(listener: Listener<T>, options?: { immediate?: boolean }): () => void
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T
  set(value: T): void
  update(fn: (value: T) => T): void
}

export function signal<T>(initial: T, equals: (a: T, b: T) => boolean = Object.is): Signal<T> {
  let current = initial
  const listeners = new Set<Listener<T>>()

  const set = (next: T) => {
    if (equals(current, next)) return
    const previous = current
    current = next
    for (const listener of [...listeners]) listener(current, previous)
  }

  return {
    get value() {
      return current
    },
    set value(next: T) {
      set(next)
    },
    get: () => current,
    set,
    update: (fn) => set(fn(current)),
    subscribe(listener, options) {
      listeners.add(listener)
      if (options?.immediate) listener(current, current)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

type SignalValues<T extends readonly ReadonlySignal<unknown>[]> = {
  [K in keyof T]: T[K] extends ReadonlySignal<infer V> ? V : never
}

export interface Computed<T> extends ReadonlySignal<T> {
  /** Stops listening to the inputs. */
  dispose(): void
}

/**
 * A value derived from other signals. Recomputed eagerly whenever an input
 * changes; listeners only fire when the derived value actually changes.
 */
export function computed<const D extends readonly ReadonlySignal<unknown>[], T>(
  deps: D,
  compute: (...values: SignalValues<D>) => T,
  equals?: (a: T, b: T) => boolean,
): Computed<T> {
  const read = () => compute(...(deps.map((d) => d.value) as SignalValues<D>))
  const inner = signal(read(), equals)
  const stops = deps.map((d) => d.subscribe(() => inner.set(read())))
  return {
    get value() {
      return inner.value
    },
    get: inner.get,
    subscribe: inner.subscribe,
    dispose() {
      for (const stop of stops) stop()
    },
  }
}

/**
 * A signal mirroring a CSS media query, e.g.
 * `mediaSignal('(prefers-reduced-motion: reduce)')`. Falls back to `false`
 * outside the browser.
 */
export function mediaSignal(query: string): Computed<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    const s = signal(false)
    return { get value() { return s.value }, get: s.get, subscribe: s.subscribe, dispose() {} }
  }
  const mql = window.matchMedia(query)
  const s = signal(mql.matches)
  const onChange = (e: MediaQueryListEvent) => s.set(e.matches)
  mql.addEventListener?.('change', onChange)
  return {
    get value() {
      return s.value
    },
    get: s.get,
    subscribe: s.subscribe,
    dispose() {
      mql.removeEventListener?.('change', onChange)
    },
  }
}
