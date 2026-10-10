/**
 * The single frame loop. Every moving part of a Veyra stage — scroll,
 * scenes, springs, renderers — runs inside one `requestAnimationFrame`
 * callback, ordered by phase. One loop means one consistent `time`, no
 * duplicated rAF work, and a single place to pause when the tab is hidden.
 */
export interface Frame {
    /** Scaled seconds elapsed since the ticker started. */
    time: number;
    /** Scaled seconds since the previous frame, clamped to `maxDelta`. */
    delta: number;
    /** Real seconds since the previous frame (unscaled, unclamped). */
    rawDelta: number;
    /** Frame counter, starting at 1. */
    frame: number;
    /** The `performance.now()` timestamp of this frame in milliseconds. */
    now: number;
}
export type TickFn = (frame: Readonly<Frame>) => void;
/**
 * Ordered phases. Lower runs first. Use the named phases or any number in
 * between to fine-tune ordering.
 */
export declare const Phase: {
    /** Pointer / input sampling. */
    readonly input: -300;
    /** Scroll position integration. */
    readonly scroll: -200;
    /** Layout reads (cached rect updates). Keep DOM reads here. */
    readonly measure: -100;
    /** Default: scenes, springs, timelines, game logic. */
    readonly update: 0;
    /** DOM writes and WebGL rendering. */
    readonly render: 100;
    /** Debug overlays, stats. */
    readonly post: 200;
};
export interface TickerOptions {
    /** Upper bound for `frame.delta` in seconds. Prevents jumps after stalls. Default `1/15`. */
    maxDelta?: number;
    /** Pause automatically while the document is hidden. Default `true`. */
    autoPause?: boolean;
    /** Injection points for tests or custom hosts. */
    requestFrame?: (cb: (now: number) => void) => number;
    cancelFrame?: (id: number) => void;
    now?: () => number;
}
export declare class Ticker {
    /** Multiplies `delta` and `time`. `0` freezes time without stopping the loop. */
    timeScale: number;
    maxDelta: number;
    /** Smoothed frames per second (real time). */
    fps: number;
    private entries;
    private readonly state;
    private rafId;
    private wanted;
    private last;
    private readonly requestFrame;
    private readonly cancelFrame;
    private readonly clock;
    private readonly onVisibility?;
    constructor(options?: TickerOptions);
    /** The current frame (shared, mutated each tick). */
    get current(): Readonly<Frame>;
    get running(): boolean;
    /** Number of registered callbacks. */
    get size(): number;
    /**
     * Registers `fn` to run every frame in the given phase. Callbacks with
     * equal priority run in registration order. Returns a remover.
     */
    add(fn: TickFn, priority?: number): () => void;
    /** Removes every registration of `fn`. */
    remove(fn: TickFn): void;
    /** Runs `fn` on the next frame only. */
    once(fn: TickFn, priority?: number): () => void;
    /** Starts the loop. Safe to call repeatedly. */
    start(): this;
    /** Stops the loop. Registered callbacks are kept. */
    stop(): this;
    /**
     * Advances one frame. Called by the rAF loop, but also usable manually
     * (tests, offline rendering, or driving Veyra from another loop).
     */
    tick(now?: number): void;
    /** Stops the loop, removes all callbacks and listeners. */
    destroy(): void;
    private removeEntry;
    private resume;
    private halt;
}
/**
 * The shared ticker. Stages adopt it unless given their own, so standalone
 * animations and stage-driven ones share one frame loop.
 */
export declare function getDefaultTicker(): Ticker;
//# sourceMappingURL=ticker.d.ts.map