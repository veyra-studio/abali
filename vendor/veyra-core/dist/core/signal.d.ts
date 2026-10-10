/**
 * Minimal, explicit reactive values. No dependency tracking magic: you
 * subscribe to what you need, and derived values list their inputs.
 */
export type Listener<T> = (value: T, previous: T) => void;
export interface ReadonlySignal<T> {
    /** Current value. */
    readonly value: T;
    /** Same as `.value`; convenient for passing as a getter. */
    get(): T;
    /**
     * Called whenever the value changes. Returns an unsubscribe function.
     * With `immediate`, the listener is also invoked right away.
     */
    subscribe(listener: Listener<T>, options?: {
        immediate?: boolean;
    }): () => void;
}
export interface Signal<T> extends ReadonlySignal<T> {
    value: T;
    set(value: T): void;
    update(fn: (value: T) => T): void;
}
export declare function signal<T>(initial: T, equals?: (a: T, b: T) => boolean): Signal<T>;
type SignalValues<T extends readonly ReadonlySignal<unknown>[]> = {
    [K in keyof T]: T[K] extends ReadonlySignal<infer V> ? V : never;
};
export interface Computed<T> extends ReadonlySignal<T> {
    /** Stops listening to the inputs. */
    dispose(): void;
}
/**
 * A value derived from other signals. Recomputed eagerly whenever an input
 * changes; listeners only fire when the derived value actually changes.
 */
export declare function computed<const D extends readonly ReadonlySignal<unknown>[], T>(deps: D, compute: (...values: SignalValues<D>) => T, equals?: (a: T, b: T) => boolean): Computed<T>;
/**
 * A signal mirroring a CSS media query, e.g.
 * `mediaSignal('(prefers-reduced-motion: reduce)')`. Falls back to `false`
 * outside the browser.
 */
export declare function mediaSignal(query: string): Computed<boolean>;
export {};
//# sourceMappingURL=signal.d.ts.map