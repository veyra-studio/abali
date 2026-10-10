import { type Signal } from '../core/signal.js';
export type QualityTier = 'low' | 'medium' | 'high';
export interface QualityOptions {
    /** Starting level `0…1`, or `'auto'` to estimate from device hints. Default `'auto'`. */
    initial?: number | 'auto';
    /** Lowest allowed level. Default `0`. */
    min?: number;
    /** Highest allowed level. Default `1`. */
    max?: number;
    /** Frames per evaluation window. Default `45`. */
    window?: number;
    /** Target as a fraction of the detected refresh rate. Default `0.86`. */
    targetRatio?: number;
    /** Device-pixel-ratio range mapped from level. Default `[1, 2]`. */
    dprRange?: [number, number];
    /** Disable adaptation (level stays at `initial`). Default `true`. */
    adaptive?: boolean;
}
/** Estimates a starting level from hardware hints. */
export declare function estimateQuality(): number;
export declare class QualityGovernor {
    /** Continuous quality level, `0…1`. */
    readonly level: Signal<number>;
    /** Coarse tier derived from `level`. */
    readonly tier: Signal<QualityTier>;
    /** Recommended canvas pixel ratio. */
    readonly dpr: Signal<number>;
    /** Detected display refresh rate (Hz), refined over the first second. */
    refreshRate: number;
    private readonly opts;
    private samples;
    private warmup;
    private badWindows;
    private goodWindows;
    private cooldown;
    constructor(options?: QualityOptions);
    /** Target frames per second given the refresh rate. */
    get target(): number;
    /** Forces a level (e.g. from a user setting). */
    set(level: number): void;
    /** Feeds one frame's real duration in seconds. Called by the stage every frame. */
    sample(rawDelta: number): void;
    private step;
    private toTier;
    private toDpr;
}
//# sourceMappingURL=governor.d.ts.map