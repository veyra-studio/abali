/**
 * Minimal, explicit reactive values. No dependency tracking magic: you
 * subscribe to what you need, and derived values list their inputs.
 */
export function signal(initial, equals = Object.is) {
    let current = initial;
    const listeners = new Set();
    const set = (next) => {
        if (equals(current, next))
            return;
        const previous = current;
        current = next;
        for (const listener of [...listeners])
            listener(current, previous);
    };
    return {
        get value() {
            return current;
        },
        set value(next) {
            set(next);
        },
        get: () => current,
        set,
        update: (fn) => set(fn(current)),
        subscribe(listener, options) {
            listeners.add(listener);
            if (options?.immediate)
                listener(current, current);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
/**
 * A value derived from other signals. Recomputed eagerly whenever an input
 * changes; listeners only fire when the derived value actually changes.
 */
export function computed(deps, compute, equals) {
    const read = () => compute(...deps.map((d) => d.value));
    const inner = signal(read(), equals);
    const stops = deps.map((d) => d.subscribe(() => inner.set(read())));
    return {
        get value() {
            return inner.value;
        },
        get: inner.get,
        subscribe: inner.subscribe,
        dispose() {
            for (const stop of stops)
                stop();
        },
    };
}
/**
 * A signal mirroring a CSS media query, e.g.
 * `mediaSignal('(prefers-reduced-motion: reduce)')`. Falls back to `false`
 * outside the browser.
 */
export function mediaSignal(query) {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        const s = signal(false);
        return { get value() { return s.value; }, get: s.get, subscribe: s.subscribe, dispose() { } };
    }
    const mql = window.matchMedia(query);
    const s = signal(mql.matches);
    const onChange = (e) => s.set(e.matches);
    mql.addEventListener?.('change', onChange);
    return {
        get value() {
            return s.value;
        },
        get: s.get,
        subscribe: s.subscribe,
        dispose() {
            mql.removeEventListener?.('change', onChange);
        },
    };
}
//# sourceMappingURL=signal.js.map