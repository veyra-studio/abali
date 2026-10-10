/**
 * Draws an element's text into a 2D canvas with the element's own font,
 * color, direction and the browser's own line breaks (read from the live
 * layout). Renderer-agnostic: use the canvas in Canvas2D, as a WebGL
 * texture (see `@veyra/core/three`'s `mirrorText`), or anywhere else.
 */
export interface DrawTextOptions {
    /** Canvas pixels per CSS pixel. Default `2`. */
    scale?: number;
    /** Extra room around the box (CSS px) for glyph overhangs. Default: 25% of the font size. */
    padding?: number;
    /** Override the text color. */
    color?: string;
    /** Reuse a canvas. */
    canvas?: HTMLCanvasElement;
}
/**
 * Draws an element's text into a canvas with the element's own font,
 * color, direction and — crucially — the browser's own line breaks, read
 * from the live layout. The canvas maps 1:1 (times `scale`) to the
 * element's box plus `padding` on each side.
 */
export declare function drawElementText(el: HTMLElement, options?: DrawTextOptions): {
    canvas: HTMLCanvasElement;
    padding: number;
    width: number;
    height: number;
};
//# sourceMappingURL=draw.d.ts.map