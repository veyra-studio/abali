/**
 * Timelines: sequenced, seekable motion. A timeline can play in time
 * (driven by the ticker) or be scrubbed by any progress source — most
 * often a scroll scene. Standalone tweens are single-child timelines.
 */
import { resolveEase } from '../core/ease.js';
import { clamp } from '../core/math.js';
import { getDefaultTicker, Phase } from '../core/ticker.js';
import { readValue, writeValue } from './style.js';
import { interpolate } from './values.js';
/** Resolves selectors, lists and single objects into an array of targets. */
export function toTargets(targets) {
    if (targets == null)
        return [];
    if (typeof targets === 'string') {
        return typeof document === 'undefined' ? [] : Array.from(document.querySelectorAll(targets));
    }
    if (typeof targets.length === 'number' && !(typeof Element !== 'undefined' && targets instanceof Element)) {
        return Array.from(targets);
    }
    return [targets];
}
class TweenChild {
    tracks;
    options;
    start = 0;
    duration;
    ease;
    initialized = false;
    last = -1;
    constructor(tracks, options, immediate) {
        this.tracks = tracks;
        this.options = options;
        this.duration = Math.max(0, options.duration ?? 0.8);
        this.ease = resolveEase(options.ease);
        if (immediate) {
            // fromTo/from: show the start state now, before the tween is reached.
            this.init();
            this.apply(0, -1);
            this.last = 0;
        }
    }
    init() {
        for (const t of this.tracks) {
            const current = readValue(t.target, t.key);
            t.interp = interpolate(t.from ?? current, t.to ?? current);
        }
        this.initialized = true;
    }
    render(local, force) {
        // Start values are captured the first time the playhead reaches the
        // tween, so sequenced tweens chain from each other's end states.
        if (!this.initialized) {
            if (local < 0)
                return;
            this.init();
        }
        const p = this.duration === 0 ? (local >= 0 ? 1 : 0) : clamp(local / this.duration);
        if (p === this.last && !force)
            return;
        const previous = this.last;
        this.last = p;
        this.apply(p, previous);
    }
    apply(p, previous) {
        const e = this.ease(p);
        for (const t of this.tracks)
            writeValue(t.target, t.key, t.interp(e));
        if (previous <= 0 && p > 0)
            this.options.onStart?.();
        this.options.onUpdate?.(p);
        if (p === 1 && previous !== 1)
            this.options.onComplete?.();
    }
}
class CallChild {
    fn;
    duration = 0;
    start = 0;
    prev = -Infinity;
    constructor(fn) {
        this.fn = fn;
    }
    render(local) {
        const prev = this.prev;
        this.prev = local;
        if (prev < 0 && local >= 0)
            this.fn(1);
        else if (prev >= 0 && local < 0)
            this.fn(-1);
    }
}
class FnChild {
    fn;
    duration;
    start = 0;
    active = false;
    last = -1;
    ease;
    constructor(fn, duration, ease) {
        this.fn = fn;
        this.duration = duration;
        this.ease = resolveEase(ease, (t) => t);
    }
    render(local, force) {
        if (!this.active) {
            if (local < 0)
                return;
            this.active = true;
        }
        const p = this.duration === 0 ? (local >= 0 ? 1 : 0) : clamp(local / this.duration);
        if (p === this.last && !force)
            return;
        this.last = p;
        this.fn(this.ease(p));
    }
}
export class Timeline {
    /** Start offset when nested inside another timeline. */
    start = 0;
    timeScale;
    loop;
    children = [];
    labels = new Map();
    last = null;
    _time = 0;
    _duration = 0;
    _playing = false;
    direction = 1;
    detach = null;
    ticker;
    options;
    resolveFinished = null;
    _finished = Promise.resolve();
    initialized = false;
    constructor(options = {}) {
        this.options = options;
        this.ticker = options.ticker ?? getDefaultTicker();
        this.timeScale = options.timeScale ?? 1;
        this.loop = options.loop ?? false;
    }
    /** Total length in seconds. */
    get duration() {
        return this._duration;
    }
    /** Playhead position in seconds. */
    get time() {
        return this._time;
    }
    set time(value) {
        this.seek(value);
    }
    /** Playhead position as `[0, 1]`. Setting it scrubs the timeline. */
    get progress() {
        return this._duration === 0 ? (this._time > 0 ? 1 : 0) : this._time / this._duration;
    }
    set progress(value) {
        this.seek(clamp(value) * this._duration);
    }
    get playing() {
        return this._playing;
    }
    /** Resolves when the current playback reaches its end. */
    get finished() {
        return this._finished;
    }
    /** Animates targets from their current values to `vars`. */
    to(targets, vars, options = {}, position) {
        return this.addTweens(targets, undefined, vars, options, position, false);
    }
    /** Animates targets from `vars` to their current values. */
    from(targets, vars, options = {}, position) {
        return this.addTweens(targets, vars, undefined, options, position, true);
    }
    /** Animates targets between explicit values. The start state is applied immediately. */
    fromTo(targets, fromVars, toVars, options = {}, position) {
        return this.addTweens(targets, fromVars, toVars, options, position, true);
    }
    /** Sets values at a point in time (a zero-length tween). */
    set(targets, vars, position) {
        return this.addTweens(targets, undefined, vars, { duration: 0 }, position, false);
    }
    /** Calls `fn` whenever the playhead crosses `position` (receives the direction). */
    call(fn, position) {
        return this.insert(new CallChild(fn), position);
    }
    /**
     * Adds a nested timeline, or a function that receives an eased progress
     * over `duration` seconds.
     */
    add(child, position, options = {}) {
        if (child instanceof Timeline)
            return this.insert(child, position);
        return this.insert(new FnChild(child, options.duration ?? 1, options.ease), position);
    }
    /** Names a point in time. */
    label(name, position) {
        this.labels.set(name, this.resolve(position));
        return this;
    }
    /** Moves the playhead and renders. */
    seek(time, force = false) {
        this._time = clamp(time, 0, this._duration);
        this.renderAt(this._time, force);
        return this;
    }
    play(from) {
        if (from !== undefined)
            this.seek(from);
        this.direction = 1;
        return this.run();
    }
    reverse(from) {
        if (from !== undefined)
            this.seek(from);
        this.direction = -1;
        return this.run();
    }
    restart() {
        this.seek(0, true);
        return this.play();
    }
    pause() {
        this._playing = false;
        this.detach?.();
        this.detach = null;
        return this;
    }
    /** Stops playback and removes all children. */
    kill() {
        this.pause();
        this.children = [];
        this._duration = 0;
        return this;
    }
    /** @internal Child protocol, used when nested. */
    render(local, force) {
        if (!this.initialized) {
            if (local < 0)
                return;
            this.initialized = true;
        }
        this._time = clamp(local, 0, this._duration);
        this.renderAt(this._time, force);
    }
    run() {
        if (this._playing)
            return this;
        if (this._duration === 0) {
            this.renderAt(this._time, true);
            this.options.onComplete?.();
            return this;
        }
        if ((this.direction === 1 && this._time >= this._duration) || (this.direction === -1 && this._time <= 0)) {
            this._time = this.direction === 1 ? 0 : this._duration;
        }
        this._playing = true;
        this._finished = new Promise((resolve) => (this.resolveFinished = resolve));
        this.detach = this.ticker.add((frame) => {
            let next = this._time + frame.delta * this.timeScale * this.direction;
            let done = false;
            const atEnd = this.direction === 1 ? next >= this._duration : next <= 0;
            if (atEnd) {
                if (this.loop) {
                    next = this.direction === 1 ? next - this._duration : this._duration + next;
                    this.renderAt(this.direction === 1 ? this._duration : 0, false);
                }
                else {
                    next = clamp(next, 0, this._duration);
                    done = true;
                }
            }
            this._time = next;
            this.renderAt(next, false);
            if (done) {
                this.pause();
                this.options.onComplete?.();
                this.resolveFinished?.();
            }
        }, Phase.update);
        if (this.ticker === getDefaultTicker())
            this.ticker.start();
        return this;
    }
    addTweens(targets, fromVars, toVars, options, position, immediate) {
        const list = toTargets(targets);
        const keys = Object.keys(toVars ?? fromVars ?? {});
        const base = this.resolve(position);
        const stagger = options.stagger ?? 0;
        let first = null;
        list.forEach((target, index) => {
            const tracks = keys.map((key) => ({
                target,
                key,
                from: fromVars?.[key],
                to: toVars?.[key],
            }));
            const offset = typeof stagger === 'function' ? stagger(index, list.length) : stagger * index;
            const child = new TweenChild(tracks, options, immediate);
            child.start = base + offset;
            this.push(child);
            first ??= child;
        });
        if (first)
            this.last = first;
        return this;
    }
    insert(child, position) {
        child.start = this.resolve(position);
        this.push(child);
        this.last = child;
        return this;
    }
    push(child) {
        this.children.push(child);
        this._duration = Math.max(this._duration, child.start + child.duration);
    }
    resolve(position) {
        const end = this._duration;
        if (position === undefined)
            return end;
        if (typeof position === 'number')
            return Math.max(0, position);
        const prevStart = this.last?.start ?? 0;
        const prevEnd = this.last ? this.last.start + this.last.duration : 0;
        const m = /^(<|>)?(?:([+-]=)?(-?\d*\.?\d+))?$/.exec(position.trim());
        if (m && !m[1] && !m[2] && m[3])
            return Math.max(0, parseFloat(m[3]));
        if (m && (m[1] || m[2])) {
            const base = m[1] === '<' ? prevStart : m[1] === '>' ? prevEnd : end;
            const amount = m[3] ? parseFloat(m[3]) : 0;
            return Math.max(0, m[2] === '-=' ? base - amount : base + amount);
        }
        const lm = /^(.+?)(?:([+-]=)(\d*\.?\d+))?$/.exec(position.trim());
        if (lm && this.labels.has(lm[1])) {
            const base = this.labels.get(lm[1]);
            const amount = lm[3] ? parseFloat(lm[3]) : 0;
            return Math.max(0, lm[2] === '-=' ? base - amount : base + amount);
        }
        throw new Error(`[veyra] Invalid timeline position "${position}"`);
    }
    /**
     * Renders children so the right one wins when several touch the same
     * property: not-yet-started children first (latest start first), then
     * completed ones (earliest end first), then active ones.
     */
    renderAt(time, force) {
        const pending = [];
        const done = [];
        const active = [];
        for (const child of this.children) {
            if (time < child.start)
                pending.push(child);
            else if (time > child.start + child.duration || (child.duration === 0 && time >= child.start))
                done.push(child);
            else
                active.push(child);
        }
        pending.sort((a, b) => b.start - a.start);
        done.sort((a, b) => a.start + a.duration - (b.start + b.duration));
        active.sort((a, b) => a.start - b.start);
        for (const c of pending)
            c.render(time - c.start, force);
        for (const c of done)
            c.render(time - c.start, force);
        for (const c of active)
            c.render(time - c.start, force);
        this.options.onUpdate?.(this.progress);
    }
}
/** Creates a paused timeline. */
export function timeline(options) {
    return new Timeline(options);
}
/**
 * Animates `targets` to `vars` right away and returns the playing timeline.
 *
 * ```ts
 * animate('.title', { y: 0, opacity: 1 }, { duration: 1.2, ease: 'glide' })
 * animate(uniforms.uReveal, { value: 1 })
 * ```
 */
export function animate(targets, vars, options = {}) {
    const tl = new Timeline({ ticker: options.ticker });
    tl.to(targets, vars, options, options.delay ?? 0);
    return tl.play();
}
//# sourceMappingURL=timeline.js.map