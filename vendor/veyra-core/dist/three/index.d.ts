/**
 * three.js integration for Veyra stages (`@veyra/core/three`).
 *
 * - Renders on the stage's single frame loop, after scroll and scenes.
 * - Uses a "pixel camera": at `z = 0`, one world unit is one CSS pixel and
 *   the origin is the viewport center, so DOM layout maps directly into 3D.
 * - Follows the adaptive quality governor for pixel ratio.
 * - Anchors objects to DOM elements, and mirrors DOM text into textures so
 *   real, accessible HTML can be refracted, distorted or lit in WebGL.
 *
 * `three` is an optional peer dependency: only projects importing this
 * entry point need it.
 */
import * as THREE from 'three';
import { type Frame } from '../core/ticker.js';
import type { Stage, StagePlugin } from '../stage.js';
export interface ThreeLayerOptions {
    /** Use an existing canvas. Otherwise a fixed, full-viewport canvas is created. */
    canvas?: HTMLCanvasElement;
    /** Parent for the created canvas. Default `document.body`. */
    container?: HTMLElement;
    /** CSS z-index of the created canvas. Default `0`. */
    zIndex?: number;
    /** Vertical field of view in degrees. Default `35`. Narrow values flatten perspective (product shots). */
    fov?: number;
    /** Near plane in CSS px. Default: 1/20 of the camera distance. Lower it for extreme close-ups. */
    near?: number;
    /** Extra `WebGLRenderer` parameters. */
    renderer?: THREE.WebGLRendererParameters;
    /** Render every frame automatically. Default `true`. */
    autoRender?: boolean;
    /** Upper bound on pixel ratio, on top of the quality governor. Default `2`. */
    maxDpr?: number;
    /** Called every frame before rendering. */
    onFrame?: (layer: ThreeLayer, frame: Readonly<Frame>) => void;
}
export interface AnchorOptions {
    /** Scale the object to the element's box (for 1×1 geometry). Default `false`. */
    size?: boolean;
    /** Re-measure every frame (inside sticky or transformed parents). Default `false`. */
    live?: boolean;
    /** Anchor point inside the element, `0…1` from the top-left. Default `[0.5, 0.5]`. */
    origin?: [number, number];
    /** World z of the anchored object. Default: unchanged. */
    z?: number;
    /** Hide the object while its element is this many px outside the viewport. Default `200`. */
    cullMargin?: number;
}
/** Keeps a 3D object positioned (and optionally sized) over a DOM element. */
export declare class DomAnchor {
    readonly el: Element;
    readonly object: THREE.Object3D;
    private readonly stage;
    private readonly options;
    /** Last computed viewport rect of the element. */
    readonly rect: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    private readonly release;
    constructor(el: Element, object: THREE.Object3D, stage: Stage, options?: AnchorOptions);
    update(width: number, height: number): void;
    destroy(): void;
}
export declare class ThreeLayer {
    readonly stage: Stage;
    private readonly options;
    readonly renderer: THREE.WebGLRenderer;
    readonly scene: THREE.Scene<THREE.Object3DEventMap>;
    readonly camera: THREE.PerspectiveCamera;
    readonly canvas: HTMLCanvasElement;
    /** Viewport size in CSS pixels. */
    width: number;
    height: number;
    autoRender: boolean;
    private readonly anchors;
    private readonly ownsCanvas;
    private readonly cleanups;
    private readonly maxDpr;
    constructor(stage: Stage, options?: ThreeLayerOptions);
    /** Distance from camera to the `z = 0` plane, where 1 unit = 1 CSS px. */
    get distance(): number;
    /** Positions `object` over `el` every frame. */
    anchor(el: Element | string, object: THREE.Object3D, options?: AnchorOptions): DomAnchor;
    /**
     * Mirrors an element's text into a plane anchored over it. The element
     * stays in the DOM for accessibility; hide it visually (e.g.
     * `color: transparent`) once the plane is visible.
     */
    mirrorText(el: HTMLElement, options?: {
        material?: (texture: THREE.CanvasTexture) => THREE.Material;
        scale?: number;
        live?: boolean;
        z?: number;
    }): {
        mesh: THREE.Mesh;
        texture: THREE.CanvasTexture;
        refresh: () => void;
        destroy: () => void;
    };
    render(): void;
    resize(): void;
    destroy(): void;
    private applyPixelRatio;
}
/** Stage plugin: `const gl = stage.use(threeLayer({ zIndex: -1 }))`. */
export declare function threeLayer(options?: ThreeLayerOptions): StagePlugin<ThreeLayer>;
export { supportsWebGL2 } from '../env/capabilities.js';
export { drawElementText, type DrawTextOptions } from '../text/draw.js';
//# sourceMappingURL=index.d.ts.map