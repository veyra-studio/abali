/**
 * Viewport state as signals, with a resize policy suited to mobile: a
 * height-only change smaller than `heightThreshold` (the URL bar showing or
 * hiding while scrolling) does not trigger a layout refresh.
 */
import { type Signal } from '../core/signal.js';
export interface ViewportOptions {
    /** Height changes below this (px) are ignored for layout on touch devices. Default `160`. */
    heightThreshold?: number;
}
export declare class Viewport {
    readonly width: Signal<number>;
    readonly height: Signal<number>;
    readonly dpr: Signal<number>;
    /** Coarse primary pointer (most phones and tablets). */
    readonly touch: Signal<boolean>;
    /** Last width/height used for layout. Changes trigger `onLayout`. */
    readonly layoutSize: Signal<{
        width: number;
        height: number;
    }>;
    private readonly heightThreshold;
    private readonly cleanups;
    constructor(options?: ViewportOptions);
    get w(): number;
    get h(): number;
    get aspect(): number;
    /** Re-reads window metrics. Called on `resize`; call manually if needed. */
    read(): void;
    /** Subscribes to layout-relevant resizes. */
    onLayout(fn: (size: {
        width: number;
        height: number;
    }) => void): () => void;
    destroy(): void;
}
//# sourceMappingURL=viewport.d.ts.map