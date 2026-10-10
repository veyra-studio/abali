/**
 * Scalar helpers used throughout the engine. All functions are pure.
 */
/** Clamp `value` into `[min, max]` (defaults to the unit interval). */
export declare function clamp(value: number, min?: number, max?: number): number;
/** Linear interpolation between `a` and `b`. */
export declare function lerp(a: number, b: number, t: number): number;
/** Inverse of {@link lerp}: where `value` sits between `a` and `b` (unclamped). */
export declare function invLerp(a: number, b: number, value: number): number;
/** Re-map `value` from `[inMin, inMax]` to `[outMin, outMax]`. */
export declare function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number, clampResult?: boolean): number;
/** Hermite smoothstep between two edges. */
export declare function smoothstep(edge0: number, edge1: number, x: number): number;
/**
 * The local progress of `progress` inside the window `[start, end]`, clamped
 * to `[0, 1]`. This is the workhorse of scroll choreography: one scene
 * progress drives many beats, each owning a slice of the timeline.
 *
 * ```ts
 * const titleIn = range(scene.progress, 0, 0.25)
 * const bottleTurn = range(scene.progress, 0.2, 0.8)
 * ```
 */
export declare function range(progress: number, start: number, end: number): number;
/**
 * Frame-rate independent exponential smoothing. Moves `current` toward
 * `target`; `lambda` is the convergence rate per second (higher = snappier).
 * Unlike `lerp(current, target, 0.1)` the result does not depend on FPS.
 */
export declare function damp(current: number, target: number, lambda: number, dt: number): number;
/**
 * Converts a per-frame lerp factor tuned at 60 fps (e.g. `0.1`) into the
 * equivalent `lambda` for {@link damp}.
 */
export declare function lerpToLambda(factor: number, fps?: number): number;
/** Wrap `value` into `[min, max)`. */
export declare function wrap(value: number, min: number, max: number): number;
/** Fractional part, always positive. */
export declare function fract(value: number): number;
/** Round `value` to `decimals` decimal places. */
export declare function roundTo(value: number, decimals?: number): number;
/** Deterministic pseudo-random generator (mulberry32). Returns a function producing `[0, 1)`. */
export declare function seededRandom(seed: number): () => number;
//# sourceMappingURL=math.d.ts.map