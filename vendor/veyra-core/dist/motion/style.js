const TRANSFORM_KEYS = new Set([
    'x', 'y', 'z', 'rotate', 'rotateX', 'rotateY', 'scale', 'scaleX', 'scaleY', 'skewX', 'skewY',
]);
const transforms = new WeakMap();
function isElement(target) {
    return typeof Element !== 'undefined' && target instanceof Element;
}
function transformState(el) {
    let state = transforms.get(el);
    if (!state) {
        state = { x: 0, y: 0, z: 0, rotate: 0, rotateX: 0, rotateY: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 };
        transforms.set(el, state);
    }
    return state;
}
const len = (v) => (typeof v === 'number' ? `${v}px` : v);
/** Composes the stored transform state into a CSS transform string. */
export function composeTransform(s) {
    let out = '';
    if (s.x !== 0 || s.y !== 0 || s.z !== 0)
        out += `translate3d(${len(s.x)}, ${len(s.y)}, ${len(s.z)}) `;
    if (s.rotateX)
        out += `rotateX(${s.rotateX}deg) `;
    if (s.rotateY)
        out += `rotateY(${s.rotateY}deg) `;
    if (s.rotate)
        out += `rotate(${s.rotate}deg) `;
    const sx = s.scale * s.scaleX;
    const sy = s.scale * s.scaleY;
    if (sx !== 1 || sy !== 1)
        out += `scale(${sx}, ${sy}) `;
    if (s.skewX || s.skewY)
        out += `skew(${s.skewX}deg, ${s.skewY}deg)`;
    return out.trim() || 'none';
}
function toKebab(key) {
    return key.startsWith('--') ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
/** Reads the current value of `key` on `target`. */
export function readValue(target, key) {
    if (isElement(target)) {
        if (TRANSFORM_KEYS.has(key))
            return transformState(target)[key];
        const style = target.style;
        const prop = toKebab(key);
        const inline = style?.getPropertyValue(prop);
        const raw = inline || (typeof getComputedStyle === 'function' ? getComputedStyle(target).getPropertyValue(prop) : '');
        const trimmed = raw.trim();
        const asNumber = Number(trimmed);
        return trimmed !== '' && !Number.isNaN(asNumber) ? asNumber : trimmed;
    }
    const value = target[key];
    return typeof value === 'number' || typeof value === 'string' ? value : 0;
}
/** Writes `value` to `key` on `target`. */
export function writeValue(target, key, value) {
    if (isElement(target)) {
        if (TRANSFORM_KEYS.has(key)) {
            const state = transformState(target);
            state[key] = value;
            target.style.transform = composeTransform(state);
            return;
        }
        ;
        target.style.setProperty(toKebab(key), typeof value === 'number' && key !== 'opacity' && !key.startsWith('--') && !UNITLESS.has(key) ? `${value}px` : String(value));
        return;
    }
    ;
    target[key] = value;
}
/** Style properties that are numbers without units. */
const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flexGrow', 'flexShrink', 'order', 'scale']);
/** Sets several properties at once (no animation). */
export function setValues(target, values) {
    for (const key in values)
        writeValue(target, key, values[key]);
}
/** Forgets the stored transform for `el` (e.g. after removing it). */
export function resetTransform(el) {
    transforms.delete(el);
    el.style.removeProperty('transform');
}
//# sourceMappingURL=style.js.map