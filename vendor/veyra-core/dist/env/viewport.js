/**
 * Viewport state as signals, with a resize policy suited to mobile: a
 * height-only change smaller than `heightThreshold` (the URL bar showing or
 * hiding while scrolling) does not trigger a layout refresh.
 */
import { signal } from '../core/signal.js';
export class Viewport {
    width;
    height;
    dpr;
    /** Coarse primary pointer (most phones and tablets). */
    touch;
    /** Last width/height used for layout. Changes trigger `onLayout`. */
    layoutSize;
    heightThreshold;
    cleanups = [];
    constructor(options = {}) {
        this.heightThreshold = options.heightThreshold ?? 160;
        const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
        const h = typeof window === 'undefined' ? 800 : window.innerHeight;
        this.width = signal(w);
        this.height = signal(h);
        this.dpr = signal(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
        this.touch = signal(typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);
        this.layoutSize = signal({ width: w, height: h }, (a, b) => a.width === b.width && a.height === b.height);
        if (typeof window === 'undefined')
            return;
        const onResize = () => this.read();
        window.addEventListener('resize', onResize, { passive: true });
        this.cleanups.push(() => window.removeEventListener('resize', onResize));
        const coarse = window.matchMedia?.('(pointer: coarse)');
        if (coarse) {
            const onPointer = (e) => this.touch.set(e.matches);
            coarse.addEventListener?.('change', onPointer);
            this.cleanups.push(() => coarse.removeEventListener?.('change', onPointer));
        }
    }
    get w() {
        return this.width.value;
    }
    get h() {
        return this.height.value;
    }
    get aspect() {
        return this.width.value / Math.max(1, this.height.value);
    }
    /** Re-reads window metrics. Called on `resize`; call manually if needed. */
    read() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.width.set(w);
        this.height.set(h);
        this.dpr.set(window.devicePixelRatio || 1);
        const prev = this.layoutSize.value;
        const heightOnly = w === prev.width;
        if (heightOnly && this.touch.value && Math.abs(h - prev.height) < this.heightThreshold)
            return;
        this.layoutSize.set({ width: w, height: h });
    }
    /** Subscribes to layout-relevant resizes. */
    onLayout(fn) {
        return this.layoutSize.subscribe((size) => fn(size));
    }
    destroy() {
        for (const c of this.cleanups)
            c();
    }
}
//# sourceMappingURL=viewport.js.map