/**
 * Script-aware text splitting for typographic motion.
 *
 * - Arabic-script letters keep their joined forms when split into chars
 *   (see `shapeClusters`), and lam-alef ligatures stay intact.
 * - Runs written in the opposite direction (English inside Persian, or the
 *   reverse) stay in one isolated unit, so word order survives.
 * - Screen readers get the original text once; generated pieces are
 *   `aria-hidden`.
 * - Every piece exposes its index as a CSS variable (`--char-index`,
 *   `--word-index`, `--line-index`) for CSS-only staggering.
 *
 * For Nastaliq and other typefaces whose letters cascade vertically,
 * animate words rather than chars: per-letter boxes cannot carry the
 * cascade.
 */
import { directionOf, shapeClusters, strongDirection } from './script.js'

export type SplitType = 'lines' | 'words' | 'chars'

export interface SplitOptions {
  /** What to split into. Default `'words'`. Chars and lines imply words. */
  type?: SplitType | SplitType[]
  /**
   * Wrap lines and/or words in `overflow: hidden` masks for reveal effects.
   * `true` masks lines when splitting lines, otherwise words.
   */
  mask?: boolean | 'lines' | 'words'
  /** Extra room inside masks so ascenders/descenders aren't clipped. Default `'0.18em'`. */
  maskPadding?: string
  /** Class names for generated elements. */
  classes?: Partial<Record<'line' | 'word' | 'char' | 'mask', string>>
  /** Keep a visually hidden copy for assistive tech. Default `true`. */
  a11y?: boolean
}

export interface SplitText {
  readonly el: HTMLElement
  readonly direction: 'rtl' | 'ltr'
  /** Line elements (the inner, animatable element when masked). Empty unless lines were requested. */
  readonly lines: HTMLElement[]
  /** Word elements, in logical order. */
  readonly words: HTMLElement[]
  /** Character elements, in logical order. */
  readonly chars: HTMLElement[]
  /** Words grouped by visual line (available whenever lines were requested). */
  readonly lineWords: HTMLElement[][]
  /** Restores the original markup. */
  revert(): void
  /** Re-splits with the same options — call after resize or font loading. */
  refresh(): void
}

const SR_ONLY =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap'

const SPACE = /([ \t\n\r\f]+)/

const originals = new WeakMap<Element, string>()

interface Unit {
  /** Text inside the unit (the isolated run, for opposite-direction runs). */
  text: string
  /** Whitespace between words. */
  space: boolean
  /** Set for opposite-direction runs. */
  dir: 'rtl' | 'ltr' | null
  /** Neutral characters kept outside the isolate, in the base direction. */
  prefix: string
  suffix: string
}

const LTR_STRONG = /[A-Za-z\u00c0-\u02af\u0370-\u03ff\u0400-\u04ff]/u
const RTL_STRONG = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u
/** European-number tokens (Latin or Persian digits with separators). */
const EN_TOKEN = /^[0-9\u06f0-\u06f9]+(?:[.,:/\u066b\u066c-][0-9\u06f0-\u06f9]+)*$/u

/**
 * Groups words so opposite-direction runs become one isolated unit.
 *
 * Inline-blocks act as neutral characters in the parent's bidi algorithm,
 * so "Veyra Core" split into two boxes inside Persian text would render
 * as "Core Veyra". Runs are kept together (with neutrals between their
 * words), boundary punctuation stays outside the isolate, and digits
 * following a left-to-right run join it (Unicode bidi rule W7).
 */
function groupRuns(tokens: string[], base: 'rtl' | 'ltr'): Unit[] {
  const opposite = base === 'rtl' ? 'ltr' : 'rtl'
  const strong = opposite === 'ltr' ? LTR_STRONG : RTL_STRONG
  const units: Unit[] = []
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]!
    const isSpace = i % 2 === 1
    if (isSpace || strongDirection(tok) !== opposite) {
      units.push({ text: tok, space: isSpace, dir: null, prefix: '', suffix: '' })
      i++
      continue
    }
    let end = i
    for (let j = i + 2; j < tokens.length; j += 2) {
      const d = strongDirection(tokens[j]!)
      if (d === base) break
      if (d === opposite) end = j
    }
    if (opposite === 'ltr') {
      while (end + 2 < tokens.length && EN_TOKEN.test(tokens[end + 2]!)) end += 2
    }
    const run = tokens.slice(i, end + 1).join('')
    const chars = [...run]
    let first = chars.findIndex((c) => strong.test(c))
    let last = chars.length - 1
    while (last > first && !(strong.test(chars[last]!) || /[0-9\u06f0-\u06f9]/u.test(chars[last]!))) last--
    if (first < 0) first = 0
    units.push({
      text: chars.slice(first, last + 1).join(''),
      space: false,
      dir: opposite,
      prefix: chars.slice(0, first).join(''),
      suffix: chars.slice(last + 1).join(''),
    })
    i = end + 1
  }
  return units
}

function span(className: string | undefined, style: string): HTMLSpanElement {
  const s = document.createElement('span')
  if (className) s.className = className
  s.setAttribute('style', style)
  s.setAttribute('aria-hidden', 'true')
  return s
}

export function splitText(target: Element | string, options: SplitOptions = {}): SplitText {
  const el = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
  if (!el) throw new Error(`[veyra] splitText: no element for ${String(target)}`)

  const types = new Set<SplitType>(Array.isArray(options.type) ? options.type : [options.type ?? 'words'])
  const wantChars = types.has('chars')
  const wantLines = types.has('lines')
  const maskMode = options.mask === true ? (wantLines ? 'lines' : 'words') : options.mask || null
  const pad = options.maskPadding ?? '0.18em'
  const cls = options.classes ?? {}

  // Splitting twice would nest pieces; start from the original markup.
  const saved = originals.get(el)
  if (saved !== undefined) el.innerHTML = saved
  const original = el.innerHTML
  originals.set(el, original)

  const direction = directionOf(el)
  const words: HTMLElement[] = []
  const chars: HTMLElement[] = []

  // Collect text nodes first; we mutate while replacing.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n as Text)
  const flat = Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE)

  for (const node of textNodes) {
    const text = node.data
    if (!text.trim()) continue
    // `split` with a capture group alternates word, space, word… (even
    // indices are words, possibly empty; odd indices are whitespace).
    const units = groupRuns(text.split(SPACE), direction)
    const frag = document.createDocumentFragment()
    units.forEach((unit) => {
      if (unit.space || unit.text === '') {
        if (unit.text) frag.append(unit.text)
        return
      }
      const word = span(cls.word, 'display:inline-block;white-space:nowrap')
      word.style.setProperty('--word-index', String(words.length))
      const fill = (parent: HTMLElement, text: string) => {
        if (!text) return
        if (!wantChars) {
          parent.append(text)
          return
        }
        for (const part of text.split(SPACE)) {
          if (!part) continue
          if (/^\s+$/.test(part)) {
            parent.append(part)
            continue
          }
          for (const cluster of shapeClusters(part)) {
            const c = span(cls.char, 'display:inline-block')
            c.style.setProperty('--char-index', String(chars.length))
            c.textContent = cluster.display
            parent.append(c)
            chars.push(c)
          }
        }
      }
      if (unit.dir) {
        // Opposite-direction run: an isolate inside the word box, with
        // boundary punctuation left in the base direction around it.
        fill(word, unit.prefix)
        const iso = document.createElement('span')
        iso.setAttribute('dir', unit.dir)
        fill(iso, unit.text)
        word.append(iso)
        fill(word, unit.suffix)
      } else {
        fill(word, unit.text)
      }
      words.push(word)
      if (maskMode === 'words') {
        const mask = span(cls.mask, `display:inline-block;overflow:hidden;vertical-align:top;padding-block:${pad};margin-block:-${pad}`)
        mask.append(word)
        frag.append(mask)
      } else {
        frag.append(word)
      }
    })
    node.replaceWith(frag)
  }

  const lines: HTMLElement[] = []
  const lineWords: HTMLElement[][] = []
  if (wantLines && words.length) {
    // Group by vertical position. offsetTop is transform-independent.
    let currentTop = -Infinity
    for (const w of words) {
      const box = maskMode === 'words' ? (w.parentElement as HTMLElement) : w
      const top = box.offsetTop
      if (top > currentTop + box.offsetHeight * 0.5) {
        lineWords.push([])
        currentTop = top
      }
      lineWords[lineWords.length - 1]!.push(w)
    }
    if (flat) {
      // Wrap each line's nodes into a block so lines animate independently.
      lineWords.forEach((group, li) => {
        const first = maskMode === 'words' ? group[0]!.parentElement! : group[0]!
        const last = maskMode === 'words' ? group[group.length - 1]!.parentElement! : group[group.length - 1]!
        const line = span(cls.line, 'display:block;white-space:nowrap')
        line.style.setProperty('--line-index', String(li))
        el.insertBefore(line, first)
        let node: ChildNode | null = first
        while (node) {
          const next: ChildNode | null = node.nextSibling
          line.append(node)
          if (node === last) break
          node = next
        }
        if (maskMode === 'lines') {
          const mask = span(cls.mask, `display:block;overflow:hidden;padding-block:${pad};margin-block:-${pad}`)
          el.insertBefore(mask, line)
          mask.append(line)
        }
        lines.push(line)
      })
    }
  }

  if (options.a11y ?? true) {
    const sr = document.createElement('span')
    sr.setAttribute('style', SR_ONLY)
    sr.setAttribute('data-veyra-sr', '')
    const tmp = document.createElement('div')
    tmp.innerHTML = original
    sr.textContent = (tmp.textContent ?? '').replace(/\s+/g, ' ').trim()
    el.prepend(sr)
  }
  el.setAttribute('data-veyra-split', '')

  const result: SplitText = {
    el,
    direction,
    lines,
    words,
    chars,
    lineWords,
    revert() {
      el.innerHTML = original
      el.removeAttribute('data-veyra-split')
      originals.delete(el)
    },
    refresh() {
      const next = splitText(el, options)
      Object.assign(result, { lines: next.lines, words: next.words, chars: next.chars, lineWords: next.lineWords })
    },
  }
  return result
}
