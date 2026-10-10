/**
 * Sound as an optional layer. Off by default, never required for
 * understanding the experience, persisted per visitor, unlocked on a user
 * gesture (as browsers require) and silenced while the tab is hidden.
 */
import { type Signal } from '../core/signal.js';
export interface SoundOptions {
    /** localStorage key for the visitor's choice; `false` disables persistence. Default `'veyra:sound'`. */
    storageKey?: string | false;
    /** Master volume `0…1`. Default `0.8`. */
    volume?: number;
}
export interface PlayOptions {
    volume?: number;
    /** Playback rate (pitch). Default `1`. */
    rate?: number;
    /** Stereo pan `-1…1`. */
    pan?: number;
    /** Seconds from now. */
    delay?: number;
}
export declare class SoundBus {
    /** Whether the visitor wants sound. */
    readonly enabled: Signal<boolean>;
    private ctx;
    private master;
    private readonly volume;
    private readonly key;
    private readonly cleanups;
    constructor(options?: SoundOptions);
    /** The audio context, created lazily. `null` outside the browser. */
    get context(): AudioContext | null;
    /** Node to connect custom graphs (synths, effects) to. */
    get output(): AudioNode | null;
    /** True when sound is wanted and the context is running. */
    get audible(): boolean;
    /** Turns sound on. Call from a click or key handler. */
    enable(): Promise<void>;
    /** Turns sound off (fades out quickly). */
    disable(): void;
    toggle(): Promise<void>;
    /** Plays a decoded buffer through the master bus. No-op when silent. */
    play(buffer: AudioBuffer, options?: PlayOptions): AudioBufferSourceNode | null;
    /** Fetches and decodes an audio file. */
    load(url: string): Promise<AudioBuffer>;
    /** A buffer of noise — the raw material for synthesized fizz, wind, hiss. */
    noise(seconds?: number, color?: 'white' | 'pink'): AudioBuffer | null;
    destroy(): void;
    private resume;
    private persist;
}
//# sourceMappingURL=bus.d.ts.map