export interface PointerOptions {
    /** Convergence rate of the smoothed position (per second). Default `8`. */
    smoothing?: number;
    /** Convergence rate of the velocity estimate. Default `10`. */
    velocitySmoothing?: number;
}
export declare class Pointer {
    /** Client position in CSS pixels. */
    x: number;
    y: number;
    /** Normalized position: `-1…1` left→right and bottom→top (GL convention). */
    nx: number;
    ny: number;
    /** Smoothed client position. */
    sx: number;
    sy: number;
    /** Smoothed normalized position. */
    snx: number;
    sny: number;
    /** Velocity in CSS pixels per second (smoothed). */
    vx: number;
    vy: number;
    /** Whether a button / touch is down. */
    down: boolean;
    /** Whether the pointer has been seen inside the window. */
    inside: boolean;
    /** Type of the most recent pointer event. */
    type: 'mouse' | 'pen' | 'touch';
    smoothing: number;
    velocitySmoothing: number;
    private lastX;
    private lastY;
    private moved;
    private readonly cleanups;
    constructor(options?: PointerOptions);
    /** Speed in CSS pixels per second. */
    get speed(): number;
    /** Advances smoothing. `width`/`height` are the viewport size. */
    update(dt: number, width: number, height: number): void;
    destroy(): void;
}
//# sourceMappingURL=pointer.d.ts.map