/**
 * A compact diagnostics panel: frame-time graph, FPS, quality, scroll and a
 * scroll map showing every scene's range against the viewport. Enable with
 * `createStage({ debug: true })` or by adding `?debug` to the URL.
 */
import type { Frame } from '../core/ticker.js';
import type { QualityGovernor } from '../quality/governor.js';
import type { Scene } from '../scene/scene.js';
import type { ScrollController } from '../scroll/scroll.js';
export interface DebugSources {
    scroll: () => ScrollController | null;
    quality: () => QualityGovernor | null;
    scenes: () => Iterable<Scene>;
    viewportHeight: () => number;
}
export declare class DebugOverlay {
    private readonly sources;
    readonly el: HTMLElement;
    private readonly graph;
    private readonly map;
    private readonly text;
    private readonly history;
    private head;
    private frameCount;
    constructor(sources: DebugSources);
    update(frame: Readonly<Frame>): void;
    destroy(): void;
    private drawGraph;
    private drawMap;
}
/** True when the URL asks for debugging (`?debug` or `#debug`). */
export declare function debugRequested(): boolean;
//# sourceMappingURL=overlay.d.ts.map