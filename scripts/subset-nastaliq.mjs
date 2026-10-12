// Cuts Noto Nastaliq Urdu down to the letters this page sets in it —
// «دوغ آبعلی» on the label, «آبعلی» in the HUD and on the place card — so
// visitors download a few kilobytes instead of the whole Arabic subset.
// HarfBuzz's subsetter keeps the glyphs those letters shape into (every
// joining form, the Nastaliq ligatures) and the weight axis (400–700).
//
// Run it again whenever text set in Nastaliq changes:
//
//   npm install --no-save subset-font@2.9.0 harfbuzzjs@1.6.2
//   node scripts/subset-nastaliq.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import subsetFont from 'subset-font'

/** Every letter set in Nastaliq, with a space and the joiners. */
const TEXT = 'دوغ آبعلی‌‍'
const source = new URL('../node_modules/@fontsource-variable/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-wght-normal.woff2', import.meta.url)
const target = new URL('../src/fonts/nastaliq-abali.woff2', import.meta.url)

const full = readFileSync(source)
const subset = await subsetFont(full, TEXT, { targetFormat: 'woff2' })
writeFileSync(target, subset)
console.log(`nastaliq-abali.woff2: ${(subset.length / 1024).toFixed(1)} KB (from ${(full.length / 1024).toFixed(1)} KB)`)
