/**
 * The stage is the composition root: one ticker, one viewport, one pointer,
 * one scroll controller, one layout cache and the scenes that hang off
 * them, wired in the right order every frame.
 *
 * ```ts
 * const stage = createStage()
 * stage.scene('#intro', { ...scenePresets.pinned, onProgress: (p) => … })
 * ```
 */
import { type Signal } from './core/signal.js';
import { type TickFn, type Ticker } from './core/ticker.js';
import { Pointer, type PointerOptions } from './env/pointer.js';
import { Viewport, type ViewportOptions } from './env/viewport.js';
import { RectCache } from './layout/rects.js';
import { Timeline, type Targets, type TimelineOptions, type TweenOptions, type TweenVars } from './motion/timeline.js';
import { QualityGovernor, type QualityOptions } from './quality/governor.js';
import { Scene, type SceneOptions } from './scene/scene.js';
import { ScrollController, type ScrollOptions } from './scroll/scroll.js';
import { SoundBus, type SoundOptions } from './sound/bus.js';
export interface StageOptions {
    /** Defaults to the shared ticker. */
    ticker?: Ticker;
    /** Scroll controller options, or `false` to read native scroll only. */
    scroll?: ScrollOptions | false;
    /** Adaptive quality options, or `false` to disable. */
    quality?: QualityOptions | false;
    pointer?: PointerOptions | false;
    viewport?: ViewportOptions;
    /** Sound bus options. Off unless provided. */
    sound?: SoundOptions | boolean;
    /** Show the debug overlay. `'auto'` (default) follows `?debug` in the URL. */
    debug?: boolean | 'auto';
    /** `'system'` (default) follows `prefers-reduced-motion`. */
    reducedMotion?: 'system' | boolean;
    /** Start the ticker immediately. Default `true`. */
    autoStart?: boolean;
}
/** Extensions receive the stage and a way to register cleanup. */
export type StagePlugin<T> = (stage: Stage, onDestroy: (cleanup: () => void) => void) => T;
export interface Stage {
    readonly ticker: Ticker;
    readonly viewport: Viewport;
    readonly pointer: Pointer | null;
    readonly scroll: ScrollController | null;
    readonly rects: RectCache;
    readonly quality: QualityGovernor | null;
    readonly sound: SoundBus | null;
    /** Effective reduced-motion preference. Writable for in-page toggles. */
    readonly reducedMotion: Signal<boolean>;
    readonly scenes: ReadonlySet<Scene>;
    /** Current scroll position (px). */
    readonly scrollY: number;
    /** Creates a scroll scene. */
    scene(target: Element | string, options?: SceneOptions): Scene;
    /** Creates a paused timeline on this stage's ticker. */
    timeline(options?: Omit<TimelineOptions, 'ticker'>): Timeline;
    /** Plays a tween on this stage. Jumps to the end under reduced motion. */
    animate(targets: Targets, vars: TweenVars, options?: TweenOptions & {
        delay?: number;
    }): Timeline;
    /** Runs `fn` every frame in `phase`. */
    onFrame(fn: TickFn, phase?: number): () => void;
    /** Re-measures layout and scene ranges (batched to the next frame). */
    refresh(immediate?: boolean): void;
    /** Installs an extension, e.g. `stage.use(threeLayer())`. */
    use<T>(plugin: StagePlugin<T>): T;
    start(): Stage;
    stop(): Stage;
    destroy(): void;
}
export declare function createStage(options?: StageOptions): Stage;
//# sourceMappingURL=stage.d.ts.map