/**
 * Easing curves. Every ease maps `t ∈ [0, 1]` to an eased value where
 * `ease(0) = 0` and `ease(1) = 1` (overshooting curves may leave `[0, 1]`
 * in between).
 */
export type Ease = (t: number) => number;
/**
 * A CSS-compatible `cubic-bezier(x1, y1, x2, y2)` timing function.
 * Solved with Newton–Raphson, falling back to bisection.
 */
export declare function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease;
/** The built-in easing library. */
export declare const ease: {
    linear: (t: number) => number;
    sineIn: (t: number) => number;
    sineOut: (t: number) => number;
    sineInOut: (t: number) => number;
    quadIn: (t: number) => number;
    quadOut: (t: number) => number;
    quadInOut: (t: number) => number;
    cubicIn: (t: number) => number;
    cubicOut: (t: number) => number;
    cubicInOut: (t: number) => number;
    quartIn: (t: number) => number;
    quartOut: (t: number) => number;
    quartInOut: (t: number) => number;
    quintIn: (t: number) => number;
    quintOut: (t: number) => number;
    quintInOut: (t: number) => number;
    expoIn: (t: number) => number;
    expoOut: (t: number) => number;
    expoInOut: (t: number) => number;
    circIn: (t: number) => number;
    circOut: (t: number) => number;
    circInOut: (t: number) => number;
    backIn: (t: number) => number;
    backOut: (t: number) => number;
    backInOut: (t: number) => number;
    elasticOut: (t: number) => number;
    bounceOut: Ease;
    /** Veyra signature curves — tuned for editorial, cinematic motion. */
    /** Long, soft landing. Good default for reveals. */
    glide: Ease;
    /** Symmetric, weighty in-out for camera and object moves. */
    drift: Ease;
    /** Fast attack, decisive stop. UI and micro-interactions. */
    snap: Ease;
    /** Slow build, hard release — anticipation before an event. */
    tension: Ease;
};
export type EaseName = keyof typeof ease;
/** Accepts an ease function or the name of a built-in ease. */
export type EaseLike = Ease | EaseName;
export declare function resolveEase(value: EaseLike | undefined, fallback?: Ease): Ease;
//# sourceMappingURL=ease.d.ts.map