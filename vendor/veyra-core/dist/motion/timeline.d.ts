/**
 * Timelines: sequenced, seekable motion. A timeline can play in time
 * (driven by the ticker) or be scrubbed by any progress source — most
 * often a scroll scene. Standalone tweens are single-child timelines.
 */
import { type EaseLike } from '../core/ease.js';
import { type Ticker } from '../core/ticker.js';
import { type TweenValue } from './values.js';
export type Targets = object | string | ArrayLike<object> | null | undefined;
export type TweenVars = Record<string, TweenValue>;
/** Per-target delay. A number staggers linearly; a function gets full control. */
export type Stagger = number | ((index: number, count: number) => number);
export interface TweenOptions {
    /** Seconds. Default `0.8`. */
    duration?: number;
    /** Default `'glide'`. */
    ease?: EaseLike;
    /** Offsets each target's start when animating several targets. */
    stagger?: Stagger;
    onStart?: () => void;
    onUpdate?: (progress: number) => void;
    onComplete?: () => void;
}
/**
 * Where to insert a child:
 * - `number` — absolute seconds
 * - omitted — end of the timeline
 * - `'<'` / `'>'` — start / end of the previously added child (`'<0.2'`, `'>-=0.1'` offsets)
 * - `'+=0.5'` / `'-=0.5'` — relative to the end of the timeline
 * - `'label'`, `'label+=0.3'` — relative to a label
 */
export type Position = number | string;
export interface TimelineOptions {
    ticker?: Ticker;
    /** Called after every render with the timeline progress. */
    onUpdate?: (progress: number) => void;
    onComplete?: () => void;
    /** Restart from the beginning when playback reaches an end. */
    loop?: boolean;
    /** Playback speed multiplier. */
    timeScale?: number;
}
interface Child {
    start: number;
    duration: number;
    /** `localTime` may be outside `[0, duration]`. */
    render(localTime: number, force: boolean): void;
}
/** Resolves selectors, lists and single objects into an array of targets. */
export declare function toTargets(targets: Targets): object[];
export declare class Timeline implements Child {
    /** Start offset when nested inside another timeline. */
    start: number;
    timeScale: number;
    loop: boolean;
    private children;
    private labels;
    private last;
    private _time;
    private _duration;
    private _playing;
    private direction;
    private detach;
    private readonly ticker;
    private readonly options;
    private resolveFinished;
    private _finished;
    private initialized;
    constructor(options?: TimelineOptions);
    /** Total length in seconds. */
    get duration(): number;
    /** Playhead position in seconds. */
    get time(): number;
    set time(value: number);
    /** Playhead position as `[0, 1]`. Setting it scrubs the timeline. */
    get progress(): number;
    set progress(value: number);
    get playing(): boolean;
    /** Resolves when the current playback reaches its end. */
    get finished(): Promise<void>;
    /** Animates targets from their current values to `vars`. */
    to(targets: Targets, vars: TweenVars, options?: TweenOptions, position?: Position): this;
    /** Animates targets from `vars` to their current values. */
    from(targets: Targets, vars: TweenVars, options?: TweenOptions, position?: Position): this;
    /** Animates targets between explicit values. The start state is applied immediately. */
    fromTo(targets: Targets, fromVars: TweenVars, toVars: TweenVars, options?: TweenOptions, position?: Position): this;
    /** Sets values at a point in time (a zero-length tween). */
    set(targets: Targets, vars: TweenVars, position?: Position): this;
    /** Calls `fn` whenever the playhead crosses `position` (receives the direction). */
    call(fn: (direction: 1 | -1) => void, position?: Position): this;
    /**
     * Adds a nested timeline, or a function that receives an eased progress
     * over `duration` seconds.
     */
    add(child: Timeline | ((progress: number) => void), position?: Position, options?: {
        duration?: number;
        ease?: EaseLike;
    }): this;
    /** Names a point in time. */
    label(name: string, position?: Position): this;
    /** Moves the playhead and renders. */
    seek(time: number, force?: boolean): this;
    play(from?: number): this;
    reverse(from?: number): this;
    restart(): this;
    pause(): this;
    /** Stops playback and removes all children. */
    kill(): this;
    /** @internal Child protocol, used when nested. */
    render(local: number, force: boolean): void;
    private run;
    private addTweens;
    private insert;
    private push;
    private resolve;
    /**
     * Renders children so the right one wins when several touch the same
     * property: not-yet-started children first (latest start first), then
     * completed ones (earliest end first), then active ones.
     */
    private renderAt;
}
/** Creates a paused timeline. */
export declare function timeline(options?: TimelineOptions): Timeline;
/**
 * Animates `targets` to `vars` right away and returns the playing timeline.
 *
 * ```ts
 * animate('.title', { y: 0, opacity: 1 }, { duration: 1.2, ease: 'glide' })
 * animate(uniforms.uReveal, { value: 1 })
 * ```
 */
export declare function animate(targets: Targets, vars: TweenVars, options?: TweenOptions & {
    ticker?: Ticker;
    delay?: number;
}): Timeline;
export {};
//# sourceMappingURL=timeline.d.ts.map