/**
 * Sound as an optional layer. Off by default, never required for
 * understanding the experience, persisted per visitor, unlocked on a user
 * gesture (as browsers require) and silenced while the tab is hidden.
 */
import { signal } from '../core/signal.js';
function readStored(key) {
    if (!key)
        return false;
    try {
        return localStorage.getItem(key) === '1';
    }
    catch {
        return false;
    }
}
export class SoundBus {
    /** Whether the visitor wants sound. */
    enabled;
    ctx = null;
    master = null;
    volume;
    key;
    cleanups = [];
    constructor(options = {}) {
        this.key = options.storageKey ?? 'veyra:sound';
        this.volume = options.volume ?? 0.8;
        this.enabled = signal(readStored(this.key));
        if (typeof window === 'undefined')
            return;
        // A stored "on" still needs a gesture before audio may start.
        const unlock = () => {
            if (this.enabled.value)
                void this.resume();
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock);
        const onVisibility = () => {
            if (!this.ctx)
                return;
            if (document.hidden)
                void this.ctx.suspend();
            else if (this.enabled.value)
                void this.ctx.resume();
        };
        document.addEventListener('visibilitychange', onVisibility);
        this.cleanups.push(() => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            document.removeEventListener('visibilitychange', onVisibility);
        });
    }
    /** The audio context, created lazily. `null` outside the browser. */
    get context() {
        if (!this.ctx && typeof window !== 'undefined' && 'AudioContext' in window) {
            this.ctx = new AudioContext();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.enabled.value ? this.volume : 0;
            this.master.connect(this.ctx.destination);
        }
        return this.ctx;
    }
    /** Node to connect custom graphs (synths, effects) to. */
    get output() {
        return this.context ? this.master : null;
    }
    /** True when sound is wanted and the context is running. */
    get audible() {
        return this.enabled.value && this.ctx?.state === 'running';
    }
    /** Turns sound on. Call from a click or key handler. */
    async enable() {
        this.enabled.set(true);
        this.persist();
        await this.resume();
    }
    /** Turns sound off (fades out quickly). */
    disable() {
        this.enabled.set(false);
        this.persist();
        if (this.ctx && this.master) {
            const t = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(t);
            this.master.gain.setTargetAtTime(0, t, 0.05);
        }
    }
    async toggle() {
        if (this.enabled.value)
            this.disable();
        else
            await this.enable();
    }
    /** Plays a decoded buffer through the master bus. No-op when silent. */
    play(buffer, options = {}) {
        const ctx = this.ctx;
        if (!ctx || !this.master || !this.audible)
            return null;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = options.rate ?? 1;
        let node = src;
        const gain = ctx.createGain();
        gain.gain.value = options.volume ?? 1;
        node.connect(gain);
        node = gain;
        if (options.pan !== undefined && 'createStereoPanner' in ctx) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = options.pan;
            node.connect(panner);
            node = panner;
        }
        node.connect(this.master);
        src.start(ctx.currentTime + (options.delay ?? 0));
        return src;
    }
    /** Fetches and decodes an audio file. */
    async load(url) {
        const ctx = this.context;
        if (!ctx)
            throw new Error('[veyra] Web Audio is not available');
        const data = await (await fetch(url)).arrayBuffer();
        return ctx.decodeAudioData(data);
    }
    /** A buffer of noise — the raw material for synthesized fizz, wind, hiss. */
    noise(seconds = 1, color = 'white') {
        const ctx = this.context;
        if (!ctx)
            return null;
        const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            if (color === 'white')
                data[i] = white;
            else {
                // Paul Kellet's economy pink filter.
                b0 = 0.99765 * b0 + white * 0.099046;
                b1 = 0.963 * b1 + white * 0.2965164;
                b2 = 0.57 * b2 + white * 1.0526913;
                data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
            }
        }
        return buffer;
    }
    destroy() {
        for (const c of this.cleanups)
            c();
        void this.ctx?.close();
        this.ctx = null;
        this.master = null;
    }
    async resume() {
        const ctx = this.context;
        if (!ctx || !this.master)
            return;
        if (ctx.state !== 'running') {
            try {
                await ctx.resume();
            }
            catch {
                return;
            }
        }
        const t = ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.enabled.value ? this.volume : 0, t, 0.08);
    }
    persist() {
        if (!this.key)
            return;
        try {
            localStorage.setItem(this.key, this.enabled.value ? '1' : '0');
        }
        catch {
            /* storage unavailable (private mode) — keep the in-memory choice */
        }
    }
}
//# sourceMappingURL=bus.js.map