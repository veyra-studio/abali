/**
 * Scroll controller built on native document scrolling.
 *
 * Wheel input is smoothed by animating the real scroll position, so
 * everything native keeps working: `position: sticky`, the scrollbar,
 * keyboard and find-in-page, anchors, scroll restoration, assistive tech.
 * Touch input and reduced-motion users get untouched native scrolling.
 */
import { type EaseLike } from '../core/ease.js';
import type { ReadonlySignal } from '../core/signal.js';
export interface ScrollOptions {
    /** Smooth wheel scrolling. Default `true`. Ignored for touch input and reduced motion. */
    smooth?: boolean;
    /** Convergence rate (per second) of smoothed scrolling. Default ≈ lerp `0.1` at 60 fps. */
    lambda?: number;
    /** Multiplier applied to wheel deltas. Default `1`. */
    wheelMultiplier?: number;
    /** Wheel events inside elements matching this selector scroll natively. */
    nativeSelector?: string;
    /** Intercept same-page anchor links to scroll smoothly and move focus. Default `true`. */
    anchors?: boolean;
}
export interface ScrollToOptions {
    /** Added to the resolved position (px). */
    offset?: number;
    /** Seconds. When omitted, uses the smoothing lambda. */
    duration?: number;
    ease?: EaseLike;
    /** Jump without animation. */
    immediate?: boolean;
}
export interface ScrollDeps {
    reducedMotion?: ReadonlySignal<boolean>;
    touch?: ReadonlySignal<boolean>;
}
export type ScrollListener = (scroll: ScrollController) => void;
export declare class ScrollController {
    /** Current scroll position (px). */
    y: number;
    /** Where smoothing is heading (px). */
    target: number;
    /** Smoothed velocity in px/s (positive = down). */
    velocity: number;
    /** `1` scrolling down, `-1` up, `0` idle. */
    direction: 1 | -1 | 0;
    /** Maximum scroll position (px). */
    limit: number;
    lambda: number;
    wheelMultiplier: number;
    private readonly wantSmooth;
    private readonly nativeSelector;
    private smoothing;
    private animation;
    private lastWritten;
    private locked;
    private previousOverflow;
    private previousBehavior;
    private readonly listeners;
    private readonly cleanups;
    private readonly deps;
    constructor(options?: ScrollOptions, deps?: ScrollDeps);
    /** Whether wheel smoothing is currently active. */
    get smooth(): boolean;
    /** Scroll progress through the whole document, `0…1`. */
    get progress(): number;
    get isLocked(): boolean;
    /** Recomputes the scroll limit. Call after layout changes. */
    refresh(): void;
    /** Calls `fn` after every frame in which the position changed. */
    subscribe(fn: ScrollListener): () => void;
    /**
     * Scrolls to a position, an element or a selector. Resolves when done.
     * Honors reduced motion by jumping.
     */
    scrollTo(target: number | Element | string, options?: ScrollToOptions): Promise<void>;
    /** Prevents user scrolling (e.g. during an intro). */
    lock(): void;
    unlock(): void;
    /** Integrates one frame. Called by the stage in the scroll phase. */
    update(dt: number): void;
    destroy(): void;
    private write;
    private onWheel;
    private onNativeScroll;
    private onAnchorClick;
}
//# sourceMappingURL=scroll.d.ts.map