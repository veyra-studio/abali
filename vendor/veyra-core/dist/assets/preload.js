/**
 * Asset preloading with weighted progress. Tasks start immediately; each
 * helper returns a promise of its result so loading and usage stay
 * together. Failures never block the experience: they are recorded,
 * counted as complete, and the caller decides on a fallback.
 */
import { signal } from '../core/signal.js';
export class Preloader {
    /** Weighted completion, `0…1`. */
    progress = signal(0);
    /** Errors from failed tasks. */
    errors = [];
    total = 0;
    loaded = 0;
    pending = new Set();
    createdAt = typeof performance === 'undefined' ? Date.now() : performance.now();
    /** Tracks any promise (or promise factory) with a progress weight. */
    add(task, weight = 1) {
        const promise = typeof task === 'function' ? task() : task;
        this.total += weight;
        this.update();
        const tracked = promise.then((value) => {
            this.complete(weight, tracked);
            return value;
        }, (error) => {
            this.errors.push(error);
            this.complete(weight, tracked);
            console.warn('[veyra] Preload task failed:', error);
            throw error;
        });
        this.pending.add(tracked);
        // Avoid unhandled-rejection noise; callers may still catch `tracked`.
        tracked.catch(() => { });
        return tracked;
    }
    /** Loads and decodes an image. */
    image(src, weight = 1) {
        return this.add(async () => {
            const img = new Image();
            img.decoding = 'async';
            img.src = src;
            if (typeof img.decode === 'function')
                await img.decode();
            else
                await new Promise((res, rej) => ((img.onload = res), (img.onerror = rej)));
            return img;
        }, weight);
    }
    /** Loads a font face, e.g. `font('700 1em "Estedad"', 'متن نمونه')`. */
    font(descriptor, text, weight = 0.5) {
        return this.add(() => (typeof document === 'undefined' ? Promise.resolve([]) : document.fonts.load(descriptor, text)), weight);
    }
    /** Waits for every font declared in CSS that is currently loading. */
    fonts(weight = 0.5) {
        return this.add(() => (typeof document === 'undefined' ? Promise.resolve() : document.fonts.ready), weight);
    }
    fetch(url, as = 'arrayBuffer', weight = 1) {
        return this.add(async () => {
            const res = await fetch(url);
            if (!res.ok)
                throw new Error(`[veyra] ${res.status} ${res.statusText} for ${url}`);
            return res[as]();
        }, weight);
    }
    /** Resolves when every task added so far (and any added meanwhile) settles. */
    async done(options = {}) {
        while (this.pending.size)
            await Promise.allSettled([...this.pending]);
        const min = (options.minDuration ?? 0) * 1000;
        const now = typeof performance === 'undefined' ? Date.now() : performance.now();
        const wait = this.createdAt + min - now;
        if (wait > 0)
            await new Promise((r) => setTimeout(r, wait));
        this.progress.set(1);
    }
    complete(weight, task) {
        this.loaded += weight;
        this.pending.delete(task);
        this.update();
    }
    update() {
        this.progress.set(this.total === 0 ? 1 : Math.min(1, this.loaded / this.total));
    }
}
//# sourceMappingURL=preload.js.map