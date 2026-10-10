/**
 * Damped harmonic springs, solved analytically: the result is exact for any
 * time step, so springs stay stable on 30 Hz phones and 144 Hz monitors.
 */
export interface SpringConfig {
    /** Spring constant `k`. Higher = faster. Default `170`. */
    stiffness?: number;
    /** Damping coefficient `c`. Default `26` (≈ critically damped at default stiffness/mass). */
    damping?: number;
    /** Mass `m`. Default `1`. */
    mass?: number;
    /** Distance and speed under which the spring is considered at rest. Default `0.001`. */
    precision?: number;
}
/** Ready-made characters. */
export declare const springs: {
    /** Calm, no overshoot. */
    gentle: {
        stiffness: number;
        damping: number;
        mass: number;
    };
    /** Responsive UI default. */
    default: {
        stiffness: number;
        damping: number;
        mass: number;
    };
    /** Lively with a little overshoot. */
    bouncy: {
        stiffness: number;
        damping: number;
        mass: number;
    };
    /** Heavy object: slow, weighty settle. */
    heavy: {
        stiffness: number;
        damping: number;
        mass: number;
    };
    /** Fast and tight. */
    snappy: {
        stiffness: number;
        damping: number;
        mass: number;
    };
};
export declare class Spring {
    value: number;
    target: number;
    velocity: number;
    stiffness: number;
    damping: number;
    mass: number;
    precision: number;
    constructor(initial?: number, config?: SpringConfig);
    /** True when value and velocity are within `precision` of rest at the target. */
    get settled(): boolean;
    /** Jump to a value with no motion. */
    snap(value: number): this;
    /** Adds an instantaneous velocity kick (units per second). */
    impulse(velocity: number): this;
    /** Advances the simulation by `dt` seconds. Returns the new value. */
    step(dt: number): number;
}
//# sourceMappingURL=spring.d.ts.map