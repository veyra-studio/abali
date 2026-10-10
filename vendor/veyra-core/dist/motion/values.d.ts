/**
 * Value interpolation: numbers, colors, and strings containing numbers
 * (`"inset(0% 0% 100% 0%)"`, `"blur(8px)"`, `"10vw"`).
 */
export type TweenValue = number | string;
export type Interpolator = (t: number) => TweenValue;
export type RGBA = [number, number, number, number];
/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. */
export declare function parseColor(input: string): RGBA | null;
export declare function formatColor([r, g, b, a]: RGBA): string;
/**
 * Mixes two colors. Interpolates in linear-light space so blends stay
 * luminous instead of going muddy in the middle.
 */
export declare function mixColor(a: RGBA, b: RGBA, t: number): RGBA;
/**
 * Builds an interpolator between two values. When structures don't match
 * (e.g. `"auto"` → `"10px"`), the value switches at the end.
 */
export declare function interpolate(from: TweenValue, to: TweenValue): Interpolator;
//# sourceMappingURL=values.d.ts.map