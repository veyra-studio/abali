// End-to-end verification of the production build, served under the real
// GitHub Pages base path (/abali/).
//
//   npm run build && npm run verify
//
// Checks: no console errors or failed requests, Persian RTL semantics,
// keyboard entry point, reduced-motion mode, mobile layout; writes
// screenshots to verify-output/. Exits non-zero on failure.
//
// Needs Chromium for Playwright (`npx playwright install chromium` outside
// environments where it is preinstalled). WebGL runs on SwiftShader when no
// GPU is available, which is slow: timings here are not performance data.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const PORT = 4173
const BASE = `http://localhost:${PORT}/abali/`
const OUT = new URL('../verify-output/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// Run vite directly in its own process group so the whole tree is stopped
// afterwards (killing an `npx` wrapper can leave the server running).
const root = new URL('..', import.meta.url).pathname
const server = spawn(process.execPath, [`${root}node_modules/vite/bin/vite.js`, 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  detached: true,
})
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {}
}
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.log(`  ✗ ${msg}`)
}
const pass = (msg) => console.log(`  ✓ ${msg}`)

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

async function visit(browser, name, options, steps) {
  console.log(`\n${name}`)
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => errors.push(`request failed ${r.url()} ${r.failure()?.errorText}`))
  await page.goto(`${BASE}?capture`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 90000 })
  await steps(page)
  if (errors.length) fail(`${name}: ${errors.length} console/network error(s):\n    ${errors.join('\n    ')}`)
  else pass(`${name}: no console or network errors`)
  await context.close()
}

const scrollToScene = (page, selector, progress) =>
  page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel)
      const top = el.getBoundingClientRect().top + scrollY
      window.scrollTo(0, top + Math.max(0, el.offsetHeight - innerHeight) * p)
    },
    [selector, progress],
  )

try {
  await waitForServer()
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

  await visit(browser, 'Desktop 1440×900', { viewport: { width: 1440, height: 900 } }, async (page) => {
    const meta = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      webgl: !document.documentElement.classList.contains('no-webgl'),
      canvas: !!document.querySelector('canvas[data-veyra-gl]'),
    }))
    meta.lang === 'fa' && meta.dir === 'rtl' ? pass('lang="fa" dir="rtl"') : fail(`lang/dir is ${meta.lang}/${meta.dir}`)
    meta.h1 === 'یک بطری کوه' ? pass('h1 is real Persian text') : fail(`unexpected h1: ${meta.h1}`)
    meta.webgl && meta.canvas ? pass('WebGL experience initialised') : fail('WebGL experience missing')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.className)
    focused?.includes('skip-link') ? pass('first Tab focuses the skip link') : fail(`first Tab focused: ${focused}`)
    await page.evaluate(() => document.activeElement?.blur?.())
    await page.evaluate(() => {
      if (window.__abali) window.__abali.stage.ticker.maxDelta = 0.5
    })
    const shots = [
      ['hero', '#top', 0],
      ['label', '#label', 0.2],
      ['landscape', '#label', 0.85],
      ['place', '#place', 0.5],
      ['fizz', '#fizz', 0.55],
      ['white', '#white', 0.4],
      ['table', '#table', 0.92],
      ['finale', '#finale', 0],
    ]
    for (const [name, sel, p] of shots) {
      await scrollToScene(page, sel, p)
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `${OUT}desktop-${name}.png` })
    }
    pass(`desktop screenshots → verify-output/desktop-*.png`)
    // The finale interaction works from the keyboard.
    await page.focus('.open-btn')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(800)
    const cheers = await page.textContent('.cheers')
    cheers?.includes('نوش جان') ? pass('finale button opens the bottle (keyboard)') : fail(`finale cheers text: ${cheers}`)
  })

  await visit(
    browser,
    'Mobile 390×844 (touch)',
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    async (page) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      overflow <= 1 ? pass('no horizontal overflow') : fail(`horizontal overflow: ${overflow}px`)
      for (const [name, sel, p] of [
        ['hero', '#top', 0],
        ['place', '#place', 0.5],
        ['fizz', '#fizz', 0.55],
        ['table', '#table', 0.92],
        ['finale', '#finale', 0],
      ]) {
        await scrollToScene(page, sel, p)
        await page.waitForTimeout(2500)
        await page.screenshot({ path: `${OUT}mobile-${name}.png` })
      }
      pass('mobile screenshots → verify-output/mobile-*.png')
    },
  )

  await visit(browser, 'Reduced motion', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, async (page) => {
    const state = await page.evaluate(() => ({
      reduced: document.documentElement.classList.contains('reduced'),
      attr: document.documentElement.hasAttribute('data-reduced-motion'),
    }))
    state.reduced && state.attr ? pass('reduced-motion mode active') : fail('reduced-motion mode not detected')
    await scrollToScene(page, '#label', 0.85)
    await page.waitForTimeout(2000)
    const lines = await page.$$eval('.label-line', (els) => els.map((e) => getComputedStyle(e).opacity))
    lines.every((o) => o === '1') ? pass('label lines readable without animation') : fail(`label line opacities: ${lines}`)
    await page.screenshot({ path: `${OUT}reduced-landscape.png` })
  })

  await browser.close()

  // Without WebGL the illustrated fallback must take over.
  const noGl = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] })
  await visit(noGl, 'No WebGL (illustrated fallback)', { viewport: { width: 1280, height: 800 } }, async (page) => {
    const fallback = await page.evaluate(() => document.documentElement.classList.contains('no-webgl'))
    fallback ? pass('no-webgl fallback active') : fail('fallback class missing without WebGL')
    await page.waitForTimeout(2200) // content fades in after the loader
    await page.screenshot({ path: `${OUT}nogl-hero.png` })
    await scrollToScene(page, '#place', 0.5)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}nogl-place.png` })
  })
  await noGl.close()
} catch (error) {
  fail(String(error?.stack ?? error))
} finally {
  stopServer()
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed')
process.exit(failures.length ? 1 : 0)
