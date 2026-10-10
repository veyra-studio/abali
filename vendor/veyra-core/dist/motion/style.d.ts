/**
 * Reading and writing animatable properties on elements and plain objects.
 *
 * Elements get transform shorthands (`x`, `y`, `rotate`, `scale`, …) that
 * compose into one `transform`, CSS custom properties (`--foo`), and any
 * other style property. Plain objects (including signals, via `value`) are
 * written directly.
 */
import type { TweenValue } from './values.js';
export interface TransformState {
    x: TweenValue;
    y: TweenValue;
    z: TweenValue;
    rotate: number;
    rotateX: number;
    rotateY: number;
    scale: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
}
/** Composes the stored transform state into a CSS transform string. */
export declare function composeTransform(s: TransformState): string;
/** Reads the current value of `key` on `target`. */
export declare function readValue(target: object, key: string): TweenValue;
/** Writes `value` to `key` on `target`. */
export declare function writeValue(target: object, key: string, value: TweenValue): void;
/** Sets several properties at once (no animation). */
export declare function setValues(target: object, values: Record<string, TweenValue>): void;
/** Forgets the stored transform for `el` (e.g. after removing it). */
export declare function resetTransform(el: Element): void;
//# sourceMappingURL=style.d.ts.map