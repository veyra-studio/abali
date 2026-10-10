/**
 * Pointer state: raw and smoothed position, normalized coordinates and a
 * smoothed velocity. Updated once per frame in the input phase.
 */
import { damp } from '../core/math.js';
export class Pointer {
    /** Client position in CSS pixels. */
    x = 0;
    y = 0;
    /** Normalized position: `-1…1` left→right and bottom→top (GL convention). */
    nx = 0;
    ny = 0;
    /** Smoothed client position. */
    sx = 0;
    sy = 0;
    /** Smoothed normalized position. */
    snx = 0;
    sny = 0;
    /** Velocity in CSS pixels per second (smoothed). */
    vx = 0;
    vy = 0;
    /** Whether a button / touch is down. */
    down = false;
    /** Whether the pointer has been seen inside the window. */
    inside = false;
    /** Type of the most recent pointer event. */
    type = 'mouse';
    smoothing;
    velocitySmoothing;
    lastX = 0;
    lastY = 0;
    moved = false;
    cleanups = [];
    constructor(options = {}) {
        this.smoothing = options.smoothing ?? 8;
        this.velocitySmoothing = options.velocitySmoothing ?? 10;
        if (typeof window === 'undefined')
            return;
        this.x = this.sx = this.lastX = window.innerWidth / 2;
        this.y = this.sy = this.lastY = window.innerHeight / 2;
        const onMove = (e) => {
            this.x = e.clientX;
            this.y = e.clientY;
            this.type = e.pointerType;
            if (!this.inside) {
                // First sighting: avoid a velocity spike from the default center.
                this.lastX = this.sx = e.clientX;
                this.lastY = this.sy = e.clientY;
            }
            this.inside = true;
            this.moved = true;
        };
        const onDown = (e) => {
            onMove(e);
            this.down = true;
        };
        const onUp = () => {
            this.down = false;
        };
        const onLeave = (e) => {
            if (!e.relatedTarget)
                this.inside = false;
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerdown', onDown, { passive: true });
        window.addEventListener('pointerup', onUp, { passive: true });
        window.addEventListener('pointercancel', onUp, { passive: true });
        document.addEventListener('pointerout', onLeave, { passive: true });
        this.cleanups.push(() => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            document.removeEventListener('pointerout', onLeave);
        });
    }
    /** Speed in CSS pixels per second. */
    get speed() {
        return Math.hypot(this.vx, this.vy);
    }
    /** Advances smoothing. `width`/`height` are the viewport size. */
    update(dt, width, height) {
        if (dt <= 0)
            return;
        const ivx = this.moved ? (this.x - this.lastX) / dt : 0;
        const ivy = this.moved ? (this.y - this.lastY) / dt : 0;
        this.moved = false;
        this.lastX = this.x;
        this.lastY = this.y;
        this.vx = damp(this.vx, ivx, this.velocitySmoothing, dt);
        this.vy = damp(this.vy, ivy, this.velocitySmoothing, dt);
        this.sx = damp(this.sx, this.x, this.smoothing, dt);
        this.sy = damp(this.sy, this.y, this.smoothing, dt);
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        this.nx = (this.x / w) * 2 - 1;
        this.ny = -((this.y / h) * 2 - 1);
        this.snx = (this.sx / w) * 2 - 1;
        this.sny = -((this.sy / h) * 2 - 1);
    }
    destroy() {
        for (const c of this.cleanups)
            c();
    }
}
//# sourceMappingURL=pointer.js.map