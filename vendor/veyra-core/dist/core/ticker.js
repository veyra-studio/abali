/**
 * The single frame loop. Every moving part of a Veyra stage — scroll,
 * scenes, springs, renderers — runs inside one `requestAnimationFrame`
 * callback, ordered by phase. One loop means one consistent `time`, no
 * duplicated rAF work, and a single place to pause when the tab is hidden.
 */
/**
 * Ordered phases. Lower runs first. Use the named phases or any number in
 * between to fine-tune ordering.
 */
export const Phase = {
    /** Pointer / input sampling. */
    input: -300,
    /** Scroll position integration. */
    scroll: -200,
    /** Layout reads (cached rect updates). Keep DOM reads here. */
    measure: -100,
    /** Default: scenes, springs, timelines, game logic. */
    update: 0,
    /** DOM writes and WebGL rendering. */
    render: 100,
    /** Debug overlays, stats. */
    post: 200,
};
export class Ticker {
    /** Multiplies `delta` and `time`. `0` freezes time without stopping the loop. */
    timeScale = 1;
    maxDelta;
    /** Smoothed frames per second (real time). */
    fps = 60;
    entries = [];
    state = { time: 0, delta: 0, rawDelta: 0, frame: 0, now: 0 };
    rafId = null;
    wanted = false;
    last = -1;
    requestFrame;
    cancelFrame;
    clock;
    onVisibility;
    constructor(options = {}) {
        this.maxDelta = options.maxDelta ?? 1 / 15;
        const hasWindow = typeof window !== 'undefined';
        this.requestFrame =
            options.requestFrame ??
                (hasWindow ? (cb) => window.requestAnimationFrame(cb) : (cb) => setTimeout(() => cb(this.clock()), 16));
        this.cancelFrame =
            options.cancelFrame ?? (hasWindow ? (id) => window.cancelAnimationFrame(id) : (id) => clearTimeout(id));
        this.clock = options.now ?? (() => performance.now());
        if ((options.autoPause ?? true) && typeof document !== 'undefined') {
            this.onVisibility = () => {
                if (document.hidden)
                    this.halt();
                else if (this.wanted)
                    this.resume();
            };
            document.addEventListener('visibilitychange', this.onVisibility);
        }
    }
    /** The current frame (shared, mutated each tick). */
    get current() {
        return this.state;
    }
    get running() {
        return this.rafId !== null;
    }
    /** Number of registered callbacks. */
    get size() {
        return this.entries.length;
    }
    /**
     * Registers `fn` to run every frame in the given phase. Callbacks with
     * equal priority run in registration order. Returns a remover.
     */
    add(fn, priority = Phase.update) {
        const entry = { fn, priority, removed: false };
        // Copy-on-write keeps iteration in `tick` safe from mutation.
        const next = this.entries.slice();
        let i = next.length;
        while (i > 0 && next[i - 1].priority > priority)
            i--;
        next.splice(i, 0, entry);
        this.entries = next;
        return () => this.removeEntry(entry);
    }
    /** Removes every registration of `fn`. */
    remove(fn) {
        for (const entry of this.entries)
            if (entry.fn === fn)
                this.removeEntry(entry);
    }
    /** Runs `fn` on the next frame only. */
    once(fn, priority = Phase.update) {
        const remove = this.add((frame) => {
            remove();
            fn(frame);
        }, priority);
        return remove;
    }
    /** Starts the loop. Safe to call repeatedly. */
    start() {
        this.wanted = true;
        if (typeof document === 'undefined' || !document.hidden)
            this.resume();
        return this;
    }
    /** Stops the loop. Registered callbacks are kept. */
    stop() {
        this.wanted = false;
        this.halt();
        return this;
    }
    /**
     * Advances one frame. Called by the rAF loop, but also usable manually
     * (tests, offline rendering, or driving Veyra from another loop).
     */
    tick(now = this.clock()) {
        const s = this.state;
        const raw = this.last < 0 ? 0 : Math.max(0, (now - this.last) / 1000);
        this.last = now;
        s.rawDelta = raw;
        s.delta = Math.min(raw, this.maxDelta) * this.timeScale;
        s.time += s.delta;
        s.frame += 1;
        s.now = now;
        if (raw > 0)
            this.fps += (1 / raw - this.fps) * 0.08;
        const entries = this.entries;
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.removed)
                continue;
            try {
                entry.fn(s);
            }
            catch (error) {
                // One failing effect must not freeze the whole experience: report it
                // once, drop the callback, keep the loop alive.
                this.removeEntry(entry);
                console.error('[veyra] A ticker callback threw and was removed.', error);
            }
        }
    }
    /** Stops the loop, removes all callbacks and listeners. */
    destroy() {
        this.stop();
        this.entries = [];
        if (this.onVisibility)
            document.removeEventListener('visibilitychange', this.onVisibility);
    }
    removeEntry(entry) {
        if (entry.removed)
            return;
        entry.removed = true;
        this.entries = this.entries.filter((e) => e !== entry);
    }
    resume() {
        if (this.rafId !== null)
            return;
        this.last = -1;
        const loop = (now) => {
            this.rafId = this.requestFrame(loop);
            this.tick(now);
        };
        this.rafId = this.requestFrame(loop);
    }
    halt() {
        if (this.rafId === null)
            return;
        this.cancelFrame(this.rafId);
        this.rafId = null;
    }
}
let defaultTicker = null;
/**
 * The shared ticker. Stages adopt it unless given their own, so standalone
 * animations and stage-driven ones share one frame loop.
 */
export function getDefaultTicker() {
    if (!defaultTicker)
        defaultTicker = new Ticker();
    return defaultTicker;
}
//# sourceMappingURL=ticker.js.map