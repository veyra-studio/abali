/**
 * Asset preloading with weighted progress. Tasks start immediately; each
 * helper returns a promise of its result so loading and usage stay
 * together. Failures never block the experience: they are recorded,
 * counted as complete, and the caller decides on a fallback.
 */
import { type Signal } from '../core/signal.js';
export interface PreloadDoneOptions {
    /** Resolve no earlier than this many seconds after the preloader was created. */
    minDuration?: number;
}
export declare class Preloader {
    /** Weighted completion, `0…1`. */
    readonly progress: Signal<number>;
    /** Errors from failed tasks. */
    readonly errors: unknown[];
    private total;
    private loaded;
    private readonly pending;
    private readonly createdAt;
    /** Tracks any promise (or promise factory) with a progress weight. */
    add<T>(task: Promise<T> | (() => Promise<T>), weight?: number): Promise<T>;
    /** Loads and decodes an image. */
    image(src: string, weight?: number): Promise<HTMLImageElement>;
    /** Loads a font face, e.g. `font('700 1em "Estedad"', 'متن نمونه')`. */
    font(descriptor: string, text?: string, weight?: number): Promise<FontFace[]>;
    /** Waits for every font declared in CSS that is currently loading. */
    fonts(weight?: number): Promise<unknown>;
    /** Fetches a resource. */
    fetch(url: string, as: 'arrayBuffer', weight?: number): Promise<ArrayBuffer>;
    fetch(url: string, as: 'json', weight?: number): Promise<unknown>;
    fetch(url: string, as: 'text', weight?: number): Promise<string>;
    fetch(url: string, as: 'blob', weight?: number): Promise<Blob>;
    /** Resolves when every task added so far (and any added meanwhile) settles. */
    done(options?: PreloadDoneOptions): Promise<void>;
    private complete;
    private update;
}
//# sourceMappingURL=preload.d.ts.map