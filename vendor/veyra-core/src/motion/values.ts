/**
 * Value interpolation: numbers, colors, and strings containing numbers
 * (`"inset(0% 0% 100% 0%)"`, `"blur(8px)"`, `"10vw"`).
 */

export type TweenValue = number | string

export type Interpolator = (t: number) => TweenValue

const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi
const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i
const RGB = /^rgba?\(\s*([^)]+)\)$/i

export type RGBA = [number, number, number, number]

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. */
export function parseColor(input: string): RGBA | null {
  const value = input.trim()
  const hex = HEX.exec(value)
  if (hex) {
    let h = hex[1]!
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  const rgb = RGB.exec(value)
  if (rgb) {
    const parts = rgb[1]!.split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const channel = (p: string) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p))
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
    return [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!), alpha]
  }
  return null
}

export function formatColor([r, g, b, a]: RGBA): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)))
  return a >= 1 ? `rgb(${c(r)} ${c(g)} ${c(b)})` : `rgb(${c(r)} ${c(g)} ${c(b)} / ${Math.round(a * 1000) / 1000})`
}

/**
 * Mixes two colors. Interpolates in linear-light space so blends stay
 * luminous instead of going muddy in the middle.
 */
export function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
  const toLinear = (v: number) => (v / 255) ** 2.2
  const toSrgb = (v: number) => Math.max(0, v) ** (1 / 2.2) * 255
  return [
    toSrgb(toLinear(a[0]) + (toLinear(b[0]) - toLinear(a[0])) * t),
    toSrgb(toLinear(a[1]) + (toLinear(b[1]) - toLinear(a[1])) * t),
    toSrgb(toLinear(a[2]) + (toLinear(b[2]) - toLinear(a[2])) * t),
    a[3] + (b[3] - a[3]) * t,
  ]
}

function splitNumbers(value: string): { numbers: number[]; strings: string[] } {
  const numbers: number[] = []
  const strings = value.split(NUMBER)
  for (const match of value.matchAll(NUMBER)) numbers.push(parseFloat(match[0]))
  return { numbers, strings }
}

function unitOf(value: string): string {
  const m = /^\s*[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?([a-z%]*)\s*$/i.exec(value)
  return m ? m[1]! : ''
}

/**
 * Builds an interpolator between two values. When structures don't match
 * (e.g. `"auto"` → `"10px"`), the value switches at the end.
 */
export function interpolate(from: TweenValue, to: TweenValue): Interpolator {
  if (typeof from === 'number' && typeof to === 'number') {
    const a = from
    const b = to
    return (t) => a + (b - a) * t
  }

  // A property that isn't set yet reads as '' — start from zero.
  if (from === '' && typeof to === 'number') from = 0
  if (from === '' && typeof to === 'string' && /^\s*[-+]?[\d.]/.test(to)) from = `0${unitOf(to)}`
  if (typeof from === 'number' && typeof to === 'number') return interpolate(from, to)

  // Mixed number/string with a unit: give the number the same unit.
  if (typeof from === 'number' && typeof to === 'string') from = `${from}${unitOf(to)}`
  if (typeof to === 'number' && typeof from === 'string') to = `${to}${unitOf(from)}`

  const a = String(from)
  const b = String(to)

  const ca = parseColor(a)
  const cb = parseColor(b)
  if (ca && cb) return (t) => formatColor(mixColor(ca, cb, t))

  const sa = splitNumbers(a)
  const sb = splitNumbers(b)
  const compatible =
    sa.numbers.length === sb.numbers.length &&
    sa.numbers.length > 0 &&
    sa.strings.every((s, i) => s === sb.strings[i])
  if (!compatible) return (t) => (t >= 1 ? b : a)

  return (t) => {
    let out = sb.strings[0]!
    for (let i = 0; i < sb.numbers.length; i++) {
      const v = sa.numbers[i]! + (sb.numbers[i]! - sa.numbers[i]!) * t
      out += String(Math.round(v * 10000) / 10000) + sb.strings[i + 1]!
    }
    return out
  }
}
