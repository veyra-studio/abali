/**
 * Script and direction utilities: Unicode Arabic joining types (for
 * Persian, Arabic, Urdu, Kurdish…) and strong-direction detection.
 */

/**
 * Unicode joining type:
 * `D` dual-joining, `R` right-joining, `C` join-causing,
 * `T` transparent (combining marks), `U` non-joining.
 */
export type JoiningType = 'D' | 'R' | 'C' | 'T' | 'U'

// Right-joining letters (join only to the preceding letter), from
// Unicode ArabicShaping.txt.
const RIGHT_JOINING: Array<[number, number]> = [
  [0x0622, 0x0625], [0x0627, 0x0627], [0x0629, 0x0629], [0x062f, 0x0632], [0x0648, 0x0648],
  [0x0671, 0x0673], [0x0675, 0x0677], [0x0688, 0x0699], [0x06c0, 0x06c0], [0x06c3, 0x06cb],
  [0x06cd, 0x06cd], [0x06cf, 0x06cf], [0x06d2, 0x06d3], [0x06d5, 0x06d5], [0x06ee, 0x06ef],
  [0x0759, 0x075b], [0x076b, 0x076c], [0x0771, 0x0771], [0x0773, 0x0774], [0x0778, 0x0779],
  [0x08aa, 0x08ac], [0x08ae, 0x08ae], [0x08b1, 0x08b2], [0x08b9, 0x08b9],
]

// Combining marks (harakat, Quranic marks, superscript alef).
const TRANSPARENT: Array<[number, number]> = [
  [0x0610, 0x061a], [0x064b, 0x065f], [0x0670, 0x0670], [0x06d6, 0x06dc], [0x06df, 0x06e4],
  [0x06e7, 0x06e8], [0x06ea, 0x06ed], [0x08ca, 0x08e1], [0x08e3, 0x08ff],
]

// Letters that are dual-joining within the Arabic blocks; everything else in
// the blocks (digits, punctuation, hamza, symbols) is non-joining.
const DUAL_JOINING: Array<[number, number]> = [
  [0x0620, 0x0620], [0x0626, 0x0626], [0x0628, 0x0628], [0x062a, 0x062e], [0x0633, 0x063f],
  [0x0641, 0x0647], [0x0649, 0x064a], [0x066e, 0x066f], [0x0678, 0x0687], [0x069a, 0x06bf],
  [0x06c1, 0x06c2], [0x06cc, 0x06cc], [0x06ce, 0x06ce], [0x06d0, 0x06d1], [0x06fa, 0x06fc],
  [0x06ff, 0x06ff], [0x0750, 0x0758], [0x075c, 0x076a], [0x076d, 0x0770], [0x0772, 0x0772],
  [0x0775, 0x0777], [0x077a, 0x077f], [0x08a0, 0x08a9], [0x08af, 0x08b0], [0x08b3, 0x08b8],
  [0x08ba, 0x08c8],
]

const inRanges = (cp: number, ranges: Array<[number, number]>) => {
  for (const [a, b] of ranges) if (cp >= a && cp <= b) return true
  return false
}

const COMBINING = /\p{M}/u

/** The joining type of a single code point. */
export function joiningType(cp: number): JoiningType {
  if (cp === 0x200d || cp === 0x0640 || cp === 0x07fa) return 'C' // ZWJ, tatweel, NKo lajanyalan
  if (inRanges(cp, TRANSPARENT)) return 'T'
  if (inRanges(cp, RIGHT_JOINING)) return 'R'
  if (inRanges(cp, DUAL_JOINING)) return 'D'
  if (COMBINING.test(String.fromCodePoint(cp))) return 'T'
  return 'U'
}

/** Joining type of a grapheme cluster: the type of its first non-transparent code point. */
export function clusterJoiningType(cluster: string): JoiningType {
  for (const ch of cluster) {
    const t = joiningType(ch.codePointAt(0)!)
    if (t !== 'T') return t
  }
  return 'T'
}

const joinsLeft = (t: JoiningType) => t === 'D' || t === 'C'
const joinsRight = (t: JoiningType) => t === 'D' || t === 'R' || t === 'C'

export const ZWJ = '‍'

const LAM = 0x0644
const ALEFS = new Set([0x0622, 0x0623, 0x0625, 0x0627, 0x0671, 0x0672, 0x0673])

/** Splits text into grapheme clusters (user-perceived characters). */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
  // Fallback: code points, with combining marks attached to their base.
  const out: string[] = []
  for (const ch of text) {
    if (out.length && COMBINING.test(ch)) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

export interface ShapedCluster {
  /** The original characters of this unit. */
  text: string
  /** The text to render in isolation so it keeps its contextual form. */
  display: string
  joinsPrevious: boolean
  joinsNext: boolean
}

/**
 * Splits a word into renderable units that keep their joined (contextual)
 * forms when each unit is placed in its own box.
 *
 * Arabic-script letters normally lose their joining when wrapped in
 * separate inline-blocks — "سلام" falls apart into "س ل ا م". Each unit
 * here carries zero-width joiners on the sides where it connects, so the
 * browser still picks initial / medial / final forms. Lam + alef stays one
 * unit to preserve the mandatory ligature.
 */
export function shapeClusters(word: string): ShapedCluster[] {
  const raw = graphemes(word)
  const units: string[] = []
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!
    const next = raw[i + 1]
    if (next !== undefined && cur.codePointAt(0) === LAM && ALEFS.has(next.codePointAt(0)!)) {
      units.push(cur + next)
      i++
    } else {
      units.push(cur)
    }
  }
  // Per unit: can it connect to the previous unit, and to the next one?
  // A trailing ZWNJ (grapheme segmentation attaches it to the preceding
  // letter) blocks the forward join; a lam-alef ligature ends in alef,
  // which never joins forward.
  const caps = units.map((text) => {
    const t = clusterJoiningType(text)
    const ligature = text.length === 2 && text.codePointAt(0) === LAM && ALEFS.has(text.codePointAt(1)!)
    const last = text.codePointAt(text.length - 1)
    const back = joinsRight(t)
    const forward = last === 0x200c ? false : last === 0x200d ? true : !ligature && joinsLeft(t)
    return { back, forward }
  })
  return units.map((text, i) => {
    const joinsPrevious = caps[i]!.back && i > 0 && caps[i - 1]!.forward
    const joinsNext = caps[i]!.forward && i < units.length - 1 && caps[i + 1]!.back
    const endsWithJoiner = text.codePointAt(text.length - 1) === 0x200d
    return {
      text,
      display: (joinsPrevious ? ZWJ : '') + text + (joinsNext && !endsWithJoiner ? ZWJ : ''),
      joinsPrevious,
      joinsNext,
    }
  })
}

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/u
const LTR_CHAR = /[A-Za-zÀ-ʯͰ-ϿЀ-ӿ]/u

/** Direction of the first strong character in `text`, or `null` if none. */
export function strongDirection(text: string): 'rtl' | 'ltr' | null {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return 'rtl'
    if (LTR_CHAR.test(ch)) return 'ltr'
  }
  return null
}

/** True if `text` contains Arabic-script characters (Persian, Arabic, Urdu…). */
export function hasArabicScript(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]/u.test(text)
}

/** Resolved writing direction of an element. */
export function directionOf(el: Element): 'rtl' | 'ltr' {
  if (typeof getComputedStyle === 'function' && el.isConnected) {
    const d = getComputedStyle(el).direction
    if (d === 'rtl' || d === 'ltr') return d
  }
  const holder = el.closest('[dir]')
  return holder?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr'
}

/**
 * `-1` for right-to-left elements, `1` otherwise. Multiply horizontal
 * motion by it so "forward" follows the reading direction:
 * `x: 40 * inlineSign(el)`.
 */
export function inlineSign(el: Element): 1 | -1 {
  return directionOf(el) === 'rtl' ? -1 : 1
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Converts ASCII digits to Persian (Extended Arabic-Indic) digits. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!)
}
