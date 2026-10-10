/**
 * Scroll controller built on native document scrolling.
 *
 * Wheel input is smoothed by animating the real scroll position, so
 * everything native keeps working: `position: sticky`, the scrollbar,
 * keyboard and find-in-page, anchors, scroll restoration, assistive tech.
 * Touch input and reduced-motion users get untouched native scrolling.
 */
import { resolveEase } from '../core/ease.js';
import { clamp, damp, lerpToLambda } from '../core/math.js';
export class ScrollController {
    /** Current scroll position (px). */
    y = 0;
    /** Where smoothing is heading (px). */
    target = 0;
    /** Smoothed velocity in px/s (positive = down). */
    velocity = 0;
    /** `1` scrolling down, `-1` up, `0` idle. */
    direction = 0;
    /** Maximum scroll position (px). */
    limit = 0;
    lambda;
    wheelMultiplier;
    wantSmooth;
    nativeSelector;
    smoothing = false;
    animation = null;
    lastWritten = -1;
    locked = false;
    previousOverflow = '';
    previousBehavior = '';
    listeners = new Set();
    cleanups = [];
    deps;
    constructor(options = {}, deps = {}) {
        this.wantSmooth = options.smooth ?? true;
        this.lambda = options.lambda ?? lerpToLambda(0.1);
        this.wheelMultiplier = options.wheelMultiplier ?? 1;
        this.nativeSelector = options.nativeSelector ?? '[data-veyra-native-scroll]';
        this.deps = deps;
        if (typeof window === 'undefined')
            return;
        this.y = this.target = window.scrollY;
        this.refresh();
        const root = document.documentElement;
        this.previousBehavior = root.style.scrollBehavior;
        // Our own writes must land instantly; smoothness comes from us.
        root.style.scrollBehavior = 'auto';
        const onWheel = (e) => this.onWheel(e);
        const onScroll = () => this.onNativeScroll();
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('scroll', onScroll, { passive: true });
        this.cleanups.push(() => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('scroll', onScroll);
            root.style.scrollBehavior = this.previousBehavior;
        });
        if (options.anchors ?? true) {
            const onClick = (e) => this.onAnchorClick(e);
            document.addEventListener('click', onClick);
            this.cleanups.push(() => document.removeEventListener('click', onClick));
        }
    }
    /** Whether wheel smoothing is currently active. */
    get smooth() {
        return this.wantSmooth && !this.deps.reducedMotion?.value && !this.deps.touch?.value;
    }
    /** Scroll progress through the whole document, `0…1`. */
    get progress() {
        return this.limit > 0 ? clamp(this.y / this.limit) : 0;
    }
    get isLocked() {
        return this.locked;
    }
    /** Recomputes the scroll limit. Call after layout changes. */
    refresh() {
        if (typeof document === 'undefined')
            return;
        this.limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        this.target = clamp(this.target, 0, this.limit);
    }
    /** Calls `fn` after every frame in which the position changed. */
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    /**
     * Scrolls to a position, an element or a selector. Resolves when done.
     * Honors reduced motion by jumping.
     */
    scrollTo(target, options = {}) {
        if (typeof window === 'undefined')
            return Promise.resolve();
        let top;
        if (typeof target === 'number')
            top = target;
        else {
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            if (!el)
                return Promise.resolve();
            top = el.getBoundingClientRect().top + window.scrollY;
        }
        top = clamp(top + (options.offset ?? 0), 0, this.limit);
        this.animation?.resolve();
        this.animation = null;
        if (options.immediate || this.deps.reducedMotion?.value) {
            this.smoothing = false;
            this.y = this.target = top;
            this.write(top);
            return Promise.resolve();
        }
        if (options.duration !== undefined) {
            return new Promise((resolve) => {
                this.smoothing = false;
                this.animation = { from: this.y, to: top, t: 0, duration: Math.max(0.001, options.duration), ease: resolveEase(options.ease, resolveEase('drift')), resolve };
            });
        }
        this.target = top;
        this.smoothing = true;
        return Promise.resolve();
    }
    /** Prevents user scrolling (e.g. during an intro). */
    lock() {
        if (this.locked || typeof document === 'undefined')
            return;
        this.locked = true;
        this.smoothing = false;
        this.target = this.y;
        const root = document.documentElement;
        this.previousOverflow = root.style.overflow;
        root.style.overflow = 'hidden';
    }
    unlock() {
        if (!this.locked)
            return;
        this.locked = false;
        document.documentElement.style.overflow = this.previousOverflow;
    }
    /** Integrates one frame. Called by the stage in the scroll phase. */
    update(dt) {
        const prev = this.y;
        if (this.animation) {
            const a = this.animation;
            a.t += dt;
            const p = clamp(a.t / a.duration);
            this.y = this.target = a.from + (a.to - a.from) * a.ease(p);
            this.write(this.y);
            if (p >= 1) {
                this.animation = null;
                a.resolve();
            }
        }
        else if (this.smoothing) {
            this.y = damp(this.y, this.target, this.lambda, dt);
            if (Math.abs(this.target - this.y) < 0.5) {
                this.y = this.target;
                this.smoothing = false;
            }
            this.write(this.y);
        }
        const instant = dt > 0 ? (this.y - prev) / dt : 0;
        this.velocity = damp(this.velocity, instant, 12, dt);
        if (Math.abs(this.velocity) < 0.5)
            this.velocity = 0;
        this.direction = this.y > prev ? 1 : this.y < prev ? -1 : this.velocity === 0 ? 0 : this.direction;
        if (this.y !== prev)
            for (const fn of this.listeners)
                fn(this);
    }
    destroy() {
        this.unlock();
        this.animation?.resolve();
        for (const c of this.cleanups)
            c();
        this.listeners.clear();
    }
    write(y) {
        this.lastWritten = y;
        window.scrollTo(0, y);
    }
    onWheel(e) {
        if (!this.smooth || e.ctrlKey || e.shiftKey || e.defaultPrevented)
            return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY))
            return;
        const el = e.target instanceof Element ? e.target : null;
        if (el?.closest(this.nativeSelector))
            return;
        e.preventDefault();
        if (this.locked)
            return;
        let dy = e.deltaY;
        if (e.deltaMode === 1)
            dy *= 40;
        else if (e.deltaMode === 2)
            dy *= window.innerHeight;
        this.refresh();
        if (this.animation) {
            this.animation.resolve();
            this.animation = null;
            this.target = this.y;
        }
        this.target = clamp(this.target + dy * this.wheelMultiplier, 0, this.limit);
        this.smoothing = true;
    }
    onNativeScroll() {
        const actual = window.scrollY;
        if ((this.smoothing || this.animation) && Math.abs(actual - this.lastWritten) < 2)
            return;
        // Scrollbar, keyboard, touch, find-in-page, anchors: follow the browser.
        if (this.animation) {
            this.animation.resolve();
            this.animation = null;
        }
        this.smoothing = false;
        this.y = this.target = actual;
    }
    onAnchorClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
            return;
        const link = e.target instanceof Element ? e.target.closest('a[href*="#"]') : null;
        if (!(link instanceof HTMLAnchorElement))
            return;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash)
            return;
        const id = decodeURIComponent(url.hash.slice(1));
        const dest = id ? document.getElementById(id) : null;
        if (!dest && id !== '' && url.hash !== '#top')
            return;
        e.preventDefault();
        history.pushState(null, '', url.hash);
        void this.scrollTo(dest ?? 0, { duration: 1.2 }).then(() => {
            if (!dest)
                return;
            // Move focus for keyboard and screen-reader users.
            if (!dest.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(dest.tagName)) {
                dest.setAttribute('tabindex', '-1');
            }
            dest.focus({ preventScroll: true });
        });
    }
}
//# sourceMappingURL=scroll.js.map