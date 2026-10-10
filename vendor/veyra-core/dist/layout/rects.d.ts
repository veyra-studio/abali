/**
 * Layout measurement cache. Reading layout every frame is the classic
 * source of scroll jank, so element rects are measured once (and again
 * after layout changes) in document coordinates; viewport positions are
 * derived from the scroll offset.
 *
 * Elements inside sticky or transformed containers move independently of
 * scroll — track those as `live`, which re-measures them once per frame
 * during the measure phase (all reads batched, no interleaved writes).
 */
export interface DocRect {
    /** Distance from the top of the document (px). */
    top: number;
    /** Distance from the left of the document (px). */
    left: number;
    width: number;
    height: number;
}
export interface ViewRect extends DocRect {
    bottom: number;
    right: number;
}
export declare class RectCache {
    private readonly scrollY;
    private readonly entries;
    constructor(scrollY?: () => number);
    /** Measures an element right now (document coordinates). */
    measure(el: Element): DocRect;
    /**
     * Starts tracking `el`. With `live`, it is re-measured every frame.
     * Returns a function that stops tracking.
     */
    track(el: Element, options?: {
        live?: boolean;
    }): () => void;
    /** Cached document rect (measures on first use or when stale). */
    get(el: Element): DocRect;
    /** Viewport-relative rect derived from the cache and the scroll offset. */
    view(el: Element, scrollY?: number): ViewRect;
    /** Marks every cached rect stale; they re-measure lazily. */
    invalidate(): void;
    /** Re-measures live entries. Called once per frame in the measure phase. */
    updateLive(): void;
    get size(): number;
}
//# sourceMappingURL=rects.d.ts.map