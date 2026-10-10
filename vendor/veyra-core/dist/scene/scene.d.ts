import type { Frame } from '../core/ticker.js';
import type { RectCache } from '../layout/rects.js';
import type { Timeline } from '../motion/timeline.js';
export interface SceneOptions {
    /** Default `'top bottom'`. */
    start?: string;
    /** Default `'bottom top'`. */
    end?: string;
    /** Element whose box defines the range. Defaults to the scene element. */
    trigger?: Element;
    /** Mirrors progress into a CSS custom property on the element, e.g. `'--progress'`. */
    cssVar?: string;
    /** Smooths progress with this convergence rate (per second). `0` = off. */
    smooth?: number;
    /** Timeline scrubbed by the scene progress. */
    timeline?: Timeline;
    /** Keep calling `onUpdate` this many px beyond the range. Default: half a viewport. */
    margin?: number;
    onEnter?: (scene: Scene) => void;
    onLeave?: (scene: Scene) => void;
    onEnterBack?: (scene: Scene) => void;
    onLeaveBack?: (scene: Scene) => void;
    /** Called when progress changes. */
    onProgress?: (progress: number, scene: Scene) => void;
    /** Called every frame while the scene is near or inside its range. */
    onUpdate?: (scene: Scene, frame: Readonly<Frame>) => void;
}
/** Common anchor pairs. */
export declare const scenePresets: {
    /** Visible anywhere in the viewport: enters at the bottom, leaves at the top. */
    readonly inView: {
        readonly start: 'top bottom';
        readonly end: 'bottom top';
    };
    /** While a sticky child is pinned inside a tall wrapper. */
    readonly pinned: {
        readonly start: 'top top';
        readonly end: 'bottom bottom';
    };
    /** From entering the viewport until its top reaches the middle. */
    readonly reveal: {
        readonly start: 'top bottom';
        readonly end: 'top center';
    };
    /** From its top reaching the top of the viewport until its bottom does. */
    readonly through: {
        readonly start: 'top top';
        readonly end: 'bottom top';
    };
};
/** Resolves one edge token (e.g. `"top+=20"`, `"50%"`, `"center"`) against a size in px. */
export declare function resolveEdge(token: string, size: number): number;
/** Scroll position (px) at which `anchor` is satisfied. */
export declare function resolveAnchor(anchor: string, elTop: number, elHeight: number, viewportHeight: number): number;
export declare class Scene {
    private readonly rects;
    private readonly viewportHeight;
    readonly el: Element;
    readonly options: SceneOptions;
    /** Scroll position where progress is 0 (px). */
    start: number;
    /** Scroll position where progress is 1 (px). */
    end: number;
    /** Unclamped progress. */
    rawProgress: number;
    /** Progress clamped to `0…1` (smoothed when `smooth` is set). */
    progress: number;
    /** Progress change per second. */
    velocity: number;
    /** Inside `[start, end]`. */
    inRange: boolean;
    /** Within the range plus margin — `onUpdate` runs only then. */
    active: boolean;
    private zone;
    private lastNotified;
    private disposed;
    private release;
    constructor(el: Element, options: SceneOptions, rects: RectCache, viewportHeight: () => number);
    /** Length of the scroll range in px. */
    get length(): number;
    /** Sub-progress of this scene within `[a, b]`. */
    local(a: number, b: number): number;
    /** Recomputes the range from current layout. */
    refresh(): void;
    /** Advances the scene for scroll position `y`. Called by the stage every frame. */
    update(y: number, frame: Readonly<Frame>): void;
    destroy(): void;
    private transition;
}
//# sourceMappingURL=scene.d.ts.map