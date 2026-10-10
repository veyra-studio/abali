/**
 * Reading and writing animatable properties on elements and plain objects.
 *
 * Elements get transform shorthands (`x`, `y`, `rotate`, `scale`, …) that
 * compose into one `transform`, CSS custom properties (`--foo`), and any
 * other style property. Plain objects (including signals, via `value`) are
 * written directly.
 */
import type { TweenValue } from './values.js'

export interface TransformState {
  x: TweenValue
  y: TweenValue
  z: TweenValue
  rotate: number
  rotateX: number
  rotateY: number
  scale: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
}

const TRANSFORM_KEYS = new Set<string>([
  'x', 'y', 'z', 'rotate', 'rotateX', 'rotateY', 'scale', 'scaleX', 'scaleY', 'skewX', 'skewY',
])

const transforms = new WeakMap<Element, TransformState>()

function isElement(target: unknown): target is HTMLElement | SVGElement {
  return typeof Element !== 'undefined' && target instanceof Element
}

function transformState(el: Element): TransformState {
  let state = transforms.get(el)
  if (!state) {
    state = { x: 0, y: 0, z: 0, rotate: 0, rotateX: 0, rotateY: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 }
    transforms.set(el, state)
  }
  return state
}

const len = (v: TweenValue) => (typeof v === 'number' ? `${v}px` : v)

/** Composes the stored transform state into a CSS transform string. */
export function composeTransform(s: TransformState): string {
  let out = ''
  if (s.x !== 0 || s.y !== 0 || s.z !== 0) out += `translate3d(${len(s.x)}, ${len(s.y)}, ${len(s.z)}) `
  if (s.rotateX) out += `rotateX(${s.rotateX}deg) `
  if (s.rotateY) out += `rotateY(${s.rotateY}deg) `
  if (s.rotate) out += `rotate(${s.rotate}deg) `
  const sx = s.scale * s.scaleX
  const sy = s.scale * s.scaleY
  if (sx !== 1 || sy !== 1) out += `scale(${sx}, ${sy}) `
  if (s.skewX || s.skewY) out += `skew(${s.skewX}deg, ${s.skewY}deg)`
  return out.trim() || 'none'
}

function toKebab(key: string): string {
  return key.startsWith('--') ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/** Reads the current value of `key` on `target`. */
export function readValue(target: object, key: string): TweenValue {
  if (isElement(target)) {
    if (TRANSFORM_KEYS.has(key)) return transformState(target)[key as keyof TransformState]
    const style = (target as HTMLElement).style
    const prop = toKebab(key)
    const inline = style?.getPropertyValue(prop)
    const raw = inline || (typeof getComputedStyle === 'function' ? getComputedStyle(target).getPropertyValue(prop) : '')
    const trimmed = raw.trim()
    const asNumber = Number(trimmed)
    return trimmed !== '' && !Number.isNaN(asNumber) ? asNumber : trimmed
  }
  const value = (target as Record<string, unknown>)[key]
  return typeof value === 'number' || typeof value === 'string' ? value : 0
}

/** Writes `value` to `key` on `target`. */
export function writeValue(target: object, key: string, value: TweenValue): void {
  if (isElement(target)) {
    if (TRANSFORM_KEYS.has(key)) {
      const state = transformState(target)
      ;(state as unknown as Record<string, TweenValue>)[key] = value
      ;(target as HTMLElement).style.transform = composeTransform(state)
      return
    }
    ;(target as HTMLElement).style.setProperty(toKebab(key), typeof value === 'number' && key !== 'opacity' && !key.startsWith('--') && !UNITLESS.has(key) ? `${value}px` : String(value))
    return
  }
  ;(target as Record<string, unknown>)[key] = value
}

/** Style properties that are numbers without units. */
const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flexGrow', 'flexShrink', 'order', 'scale'])

/** Sets several properties at once (no animation). */
export function setValues(target: object, values: Record<string, TweenValue>): void {
  for (const key in values) writeValue(target, key, values[key]!)
}

/** Forgets the stored transform for `el` (e.g. after removing it). */
export function resetTransform(el: Element): void {
  transforms.delete(el)
  ;(el as HTMLElement).style.removeProperty('transform')
}
