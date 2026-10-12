// End-to-end verification of the production build, served under the real
// GitHub Pages base path (/abali/).
//
//   npm run build && npm run verify            # portable: WebGL on SwiftShader
//   npm run build && npm run verify -- --gpu   # render on the GPU (Metal on a Mac, Direct3D on Windows)
//
// Checks: no console errors or failed requests, Persian RTL semantics and
// copy, keyboard entry point, every chapter and both lazily built worlds
// (mountains, table), the shake and open interactions with sound on,
// reduced motion, mobile layout, and the drawn fallback without WebGL.
// Screenshots go to verify-output/. Exits non-zero on failure.
//
// Needs Chromium for Playwright (`npx playwright install chromium`). On
// SwiftShader WebGL is slow: timings here are not performance data.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const PORT = 4173
const BASE = `http://localhost:${PORT}/abali/`
const OUT = fileURLToPath(new URL('../verify-output/', import.meta.url))
const GPU = process.argv.includes('--gpu')
const WINDOWS = process.platform === 'win32'
const GPU_ANGLE = process.platform === 'darwin' ? 'metal' : WINDOWS ? 'd3d11' : 'default'
const GL_ARGS = GPU ? [`--use-angle=${GPU_ANGLE}`, '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const SETTLE = GPU ? 1400 : 2600
// Start clean, so every screenshot left here is from this run.
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// Run vite directly in its own process group so the whole tree is stopped
// afterwards (killing an `npx` wrapper can leave the server running).
// Windows has no process groups: vite runs as a direct child there.
const root = fileURLToPath(new URL('..', import.meta.url))
const server = spawn(process.execPath, [`${root}node_modules/vite/bin/vite.js`, 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  detached: !WINDOWS,
  windowsHide: true,
})
const stopServer = () => {
  try {
    if (WINDOWS) server.kill()
    else process.kill(-server.pid, 'SIGTERM')
  } catch {}
}
const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.log(`  ✗ ${msg}`)
}
const pass = (msg) => console.log(`  ✓ ${msg}`)
const check = (ok, msg) => (ok ? pass(msg) : fail(msg))

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
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 120000 })
  try {
    await steps(page)
  } catch (error) {
    fail(`${name}: ${error?.stack ?? error}`)
  }
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
const worldsReady = (page) =>
  page.waitForFunction(() => window.__abali?.experience?.landscape && window.__abali?.experience?.table, null, { timeout: 120000 })
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim())
/** Waits for `n` frames of the stage (software rendering is slow: frames, not time). */
const frames = async (page, n) => {
  const f0 = await page.evaluate(() => window.__abali.stage.ticker.current.frame)
  await page.waitForFunction((f) => window.__abali.stage.ticker.current.frame >= f, f0 + n, { timeout: 120000 })
}

try {
  await waitForServer()
  const browser = await chromium.launch({ args: GL_ARGS })

  await visit(browser, `Desktop 1440×900${GPU ? ' (GPU)' : ''}`, { viewport: { width: 1440, height: 900 } }, async (page) => {
    const meta = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      webgl: !document.documentElement.classList.contains('no-webgl'),
      canvas: !!document.querySelector('canvas[data-veyra-gl]'),
      disclaimer: document.querySelector('.disclaimer')?.textContent ?? '',
    }))
    check(meta.lang === 'fa' && meta.dir === 'rtl', `lang="${meta.lang}" dir="${meta.dir}"`)
    const h1 = await text(page, 'h1')
    check(h1 === 'خنکی صدا دارد.', `h1 is the headline in real Persian text (${h1})`)
    check(meta.title.includes('خنکی صدا دارد'), 'document title carries the headline')
    check(meta.disclaimer.includes('غیررسمی') && meta.disclaimer.includes('هیچ ارتباطی'), 'unofficial-concept disclaimer is present')
    const commission = await page.evaluate(() => {
      const a = document.querySelector('.site-footer .commission a')
      return { href: a?.getAttribute('href') ?? '', text: a?.textContent?.trim() ?? '' }
    })
    check(commission.text === 'itsmetti@proton.me' && commission.href.startsWith('mailto:itsmetti@proton.me?subject='), `the footer offers a site like this, by mail (${commission.text})`)
    check(meta.webgl && meta.canvas, 'WebGL experience initialised')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.className)
    check(focused?.includes('skip-link'), `first Tab focuses the skip link (${focused})`)
    await page.evaluate(() => document.activeElement?.blur?.())
    await page.evaluate(() => {
      if (window.__abali) window.__abali.stage.ticker.maxDelta = 0.5
    })
    await page.waitForTimeout(SETTLE)
    await page.screenshot({ path: `${OUT}desktop-hero.png` })
    const shots = [
      ['taq-cap', '#taq', 0.3],
      ['taq-open', '#taq', 0.62],
      ['pis', '#pis', 0.45],
      ['flood', '#pis', 0.97],
      ['akhish', '#akhish', 0.5],
      ['sofreh-missing', '#sofreh', 0.76],
      ['sofreh', '#sofreh', 0.95],
      ['finale', '#finale', 0],
    ]
    for (const [name, sel, p] of shots) {
      if (name === 'akhish') await worldsReady(page)
      await scrollToScene(page, sel, p)
      await page.waitForTimeout(SETTLE)
      await page.screenshot({ path: `${OUT}desktop-${name}.png` })
      if (name === 'taq-open') check((await page.$eval('.taq-word', (el) => getComputedStyle(el).opacity)) === '1', '«تق!» appears once the cap is off')
      if (name === 'akhish') {
        const state = await page.evaluate(() => ({ world: window.__abali.experience.world, theme: document.documentElement.dataset.theme, word: document.querySelector('.akhish-word').textContent, label: document.querySelector('.akhish-word').getAttribute('aria-label') }))
        check(state.world === 'landscape' && state.theme === 'snow', `the mountains are on screen (world ${state.world}, theme ${state.theme})`)
        check(state.word.includes('ـ') && state.label === 'آخیش!', `«آخیش» stretches with kashida and keeps its label for screen readers (${state.word})`)
      }
      if (name === 'sofreh-missing') check(await page.$eval('.punch-missing', (el) => el.classList.contains('is-on')), '«فقط یک چیز کم است.» before the bottle lands')
      if (name === 'sofreh') {
        const s = await page.evaluate(() => ({ world: window.__abali.experience.world, lit: document.querySelectorAll('.menu li.is-on').length, done: document.querySelector('.punch-done').classList.contains('is-on'), landed: window.__abali.experience.table.landed(1), count: window.__abali.experience.table.count }))
        check(s.world === 'table' && s.lit === 6 && s.done && s.landed === s.count, `the table fills: ${s.landed}/${s.count} dishes, ${s.lit}/6 menu items, «حالا کامل شد.»`)
      }
    }
    pass('desktop screenshots → verify-output/desktop-*.png')
    // The finale opens from the keyboard.
    await page.focus('.open-btn')
    await page.keyboard.press('Enter')
    // The opener comes in and pries the cap off, then «پیسسس», «قلپ، قلپ», «آخیش!».
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}desktop-finale-pry.png` })
    await page.waitForFunction(() => document.querySelector('.cheers')?.textContent.includes('آخیش'), null, { timeout: 12000 }).catch(() => {})
    const cheers = await text(page, '.cheers')
    const cap = await page.evaluate(() => window.__abali?.experience?.studio.openFor ?? -1)
    check(cap >= 0, `the cap came off (${cap.toFixed(1)} s ago)`)
    check(cheers.includes('آخیش'), `finale button opens the bottle from the keyboard («${cheers}»)`)
    await page.screenshot({ path: `${OUT}desktop-finale-open.png` })
  })

  await visit(
    browser,
    'Mobile 390×844 (touch)',
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    async (page) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      check(overflow <= 1, `no horizontal overflow (${overflow}px)`)
      await page.waitForTimeout(SETTLE)
      await page.screenshot({ path: `${OUT}mobile-hero.png` })
      // The address bar slides in (80 px less height, nothing else): the
      // canvas keeps its size and the camera holds still.
      const canvas = () =>
        page.evaluate(() => {
          const layer = window.__abali.experience.layer
          return { buffer: `${layer.canvas.width}×${layer.canvas.height}`, distance: layer.camera.position.z }
        })
      const before = await canvas()
      await page.setViewportSize({ width: 390, height: 764 })
      await frames(page, 3)
      const bar = await canvas()
      check(bar.buffer === before.buffer && bar.distance === before.distance, `the address bar sliding in leaves the canvas alone (${before.buffer} → ${bar.buffer})`)
      await page.setViewportSize({ width: 390, height: 844 })
      await frames(page, 3)
      await worldsReady(page)
      for (const [name, sel, p] of [
        ['taq', '#taq', 0.62],
        ['pis', '#pis', 0.45],
        ['akhish', '#akhish', 0.55],
        ['sofreh', '#sofreh', 0.95],
        ['finale', '#finale', 0],
      ]) {
        await scrollToScene(page, sel, p)
        await page.waitForTimeout(SETTLE)
        await page.screenshot({ path: `${OUT}mobile-${name}.png` })
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        if (wide > 1) fail(`horizontal overflow in ${name}: ${wide}px`)
      }
      pass('mobile screenshots → verify-output/mobile-*.png')
    },
  )

  await visit(browser, 'Reduced motion', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, async (page) => {
    const state = await page.evaluate(() => ({
      reduced: document.documentElement.classList.contains('reduced'),
      attr: document.documentElement.hasAttribute('data-reduced-motion'),
    }))
    check(state.reduced && state.attr, 'reduced-motion mode active')
    await worldsReady(page)
    await scrollToScene(page, '#akhish', 0.6)
    await page.waitForTimeout(1500)
    const akhish = await page.evaluate(() => ({
      lines: Array.from(document.querySelectorAll('.akhish-line')).map((e) => getComputedStyle(e).opacity),
      word: document.querySelector('.akhish-word').textContent,
    }))
    check(akhish.lines.every((o) => o === '1') && !akhish.word.includes('ـ'), 'copy is readable without animation, the word unstretched')
    await page.screenshot({ path: `${OUT}reduced-akhish.png` })
    await scrollToScene(page, '#sofreh', 0.95)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}reduced-sofreh.png` })
  })

  await visit(browser, 'Interactions with sound on', { viewport: { width: 1280, height: 800 } }, async (page) => {
    const pressedNow = () => page.evaluate(() => [...document.querySelectorAll('.sound-toggle, .sound-cta')].map((b) => b.getAttribute('aria-pressed')))
    const initial = await pressedNow()
    check(initial.every((p) => p === 'true'), `sound is on by default, both toggles agree (${initial})`)
    // The first click starts the audio the browser held back; the hero's button turns sound off, and on again.
    await page.click('.sound-cta')
    const off = await pressedNow()
    await page.click('.sound-cta')
    const on = await pressedNow()
    check(off.every((p) => p === 'false') && on.every((p) => p === 'true'), `the hero's button turns sound off and on, both toggles agree (${off} → ${on})`)
    const audio = await page.evaluate(() => window.__abali?.stage.sound?.context?.state ?? 'none')
    check(audio === 'running', `audio plays after a click (${audio})`)
    // Taps: the glass rings; an ice cube clinks, cracks and, on the fifth tap, breaks into chips.
    // (After the hero's entrance has settled; the cube is found again before each tap.)
    await page.waitForTimeout(2500)
    const cube = () =>
      page.evaluate(() => {
        const exp = window.__abali.experience
        const mesh = exp.studio.ice.group.children.filter((o) => o.isMesh)[1]
        const v = mesh.getWorldPosition(new mesh.position.constructor()).project(exp.layer.camera)
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, pieces: exp.studio.ice.group.children.filter((o) => o.isMesh && o.visible).length }
      })
    const cubeAt = await cube()
    // Count the chips' strikes on the floor (each one sounds): a few, then silence.
    await page.evaluate(() => {
      const studio = window.__abali.experience.studio
      window.__strikes = []
      const prev = studio.onChipHit
      studio.onChipHit = (s) => {
        window.__strikes.push(performance.now())
        prev?.(s)
      }
    })
    for (let k = 0; k < 5; k++) {
      const at = await cube()
      await page.mouse.click(at.x, at.y)
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(1500)
    const pieces = await page.evaluate(() => window.__abali.experience.studio.ice.group.children.filter((o) => o.isMesh && o.visible).length)
    check(pieces > cubeAt.pieces, `five taps break an ice cube into chips (${cubeAt.pieces} → ${pieces} pieces of ice)`)
    const strikes = await page.evaluate(async () => {
      const before = window.__strikes.length
      await new Promise((r) => setTimeout(r, 1500))
      return { total: window.__strikes.length, later: window.__strikes.length - before }
    })
    check(strikes.total > 0 && strikes.total <= 18 && strikes.later === 0, `the chips land and go quiet (${strikes.total} strikes, ${strikes.later} after they settle)`)
    // Shake: fast pointer movement inside «پیس» builds pressure until it boils over.
    await scrollToScene(page, '#pis', 0.55)
    await page.waitForTimeout(1500)
    let max = 0
    let outOfRange = false
    let burst = false
    for (let i = 0; i < 60 && !burst; i++) {
      await page.mouse.move(i % 2 ? 260 : 1020, 360 + (i % 3) * 40)
      await page.waitForTimeout(30)
      const v = Number(await page.getAttribute('.gauge', 'aria-valuenow'))
      max = Math.max(max, v)
      outOfRange ||= v < 0 || v > 100
      burst ||= ((await page.textContent('.shake-hint')) ?? '').includes('سر رفت')
    }
    check(!outOfRange && (max > 0 || burst), `shaking builds pressure (peak ${max}%${burst ? ', boiled over' : ''})`)
    if (burst) {
      await page.screenshot({ path: `${OUT}interaction-boiled-over.png` })
      // Boiled over: the foam carries the reader on to «آخیش».
      await page.waitForFunction(() => Math.abs(document.querySelector('#akhish').getBoundingClientRect().top) < 80, null, { timeout: 20000 }).catch(() => {})
      const top = await page.evaluate(() => Math.round(document.querySelector('#akhish').getBoundingClientRect().top))
      check(Math.abs(top) < 80, `boiling over carries on to «آخیش» (its top at ${top}px)`)
    }
    await page.click('.shake-btn')
    await scrollToScene(page, '#finale', 0)
    await page.waitForTimeout(1500)
    await page.click('.open-btn')
    await page.waitForTimeout(2600)
    await page.click('.open-btn') // and cap it again
    await page.waitForTimeout(900)
    const label = await text(page, '.open-label')
    check(label === 'تق!', `open → recap cycle works with sound on (button «${label}»)`)
  })

  // Phones take the GPU back from pages in the background. While it is gone
  // the drawn fallback stands in; when it returns, the light that lived only
  // on the GPU (the studio's and the table's environments) is rendered again.
  await visit(browser, 'Lost WebGL context', { viewport: { width: 1280, height: 800 } }, async (page) => {
    await worldsReady(page)
    await page.waitForTimeout(SETTLE)
    const r = await page.evaluate(async () => {
      const { stage, experience: exp } = window.__abali
      const html = document.documentElement
      // Nothing is drawn meanwhile but the probes.
      stage.stop()
      const { renderer, scene, camera } = exp.layer
      const gl = renderer.getContext()
      const slot = document.querySelector('.hero-slot').getBoundingClientRect()
      // The bottle's brightness along its axis, drawn and read in one task.
      const light = () => {
        exp.studio.prepare(renderer, camera)
        renderer.render(scene, camera)
        const dpr = renderer.getPixelRatio()
        const px = new Uint8Array(4)
        let sum = 0
        for (let i = 1; i < 10; i++) {
          gl.readPixels(Math.round((slot.left + slot.width / 2) * dpr), Math.round((exp.layer.height - (slot.top + (slot.height * i) / 10)) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
          sum += px[0] + px[1] + px[2]
        }
        return sum
      }
      const before = light()
      const envs = [scene.environment, exp.table.scene.environment]
      const lose = gl.getExtension('WEBGL_lose_context')
      const event = (type) => new Promise((resolve) => exp.layer.canvas.addEventListener(type, resolve, { once: true }))
      let next = event('webglcontextlost')
      lose.loseContext()
      await next
      const lost = exp.layer.lost.value
      // Still gone after three seconds: the drawn fallback takes over.
      await new Promise((resolve) => setTimeout(resolve, 3400))
      const fallback = html.classList.contains('no-webgl')
      next = event('webglcontextrestored')
      lose.restoreContext()
      await next
      return {
        lost,
        fallback,
        back: !exp.layer.lost.value && !html.classList.contains('no-webgl'),
        rebuilt: scene.environment !== envs[0] && exp.table.scene.environment !== envs[1],
        before,
        after: light(),
      }
    })
    check(r.lost && r.fallback && r.back, `a lost context shows the drawn fallback; the film returns with it (lost ${r.lost}, fallback ${r.fallback}, back ${r.back})`)
    check(r.rebuilt && r.after > r.before * 0.8, `the studio's and the table's light are rendered again (bottle ${r.before} → ${r.after})`)
  })

  await browser.close()

  // Without WebGL the drawn fallback must take over.
  const noGl = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] })
  await visit(noGl, 'No WebGL (drawn fallback)', { viewport: { width: 1280, height: 800 } }, async (page) => {
    const state = await page.evaluate(() => ({
      fallback: document.documentElement.classList.contains('no-webgl'),
      bottle: getComputedStyle(document.querySelector('.hero-slot .fallback-bottle')).display,
    }))
    check(state.fallback && state.bottle === 'block', 'no-webgl fallback active, drawn bottle shown')
    await page.waitForTimeout(2200) // content fades in after the loader
    await page.screenshot({ path: `${OUT}nogl-hero.png` })
    await scrollToScene(page, '#akhish', 0.5)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}nogl-akhish.png` })
    await scrollToScene(page, '#sofreh', 0.9)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}nogl-sofreh.png` })
  })
  await noGl.close()
} catch (error) {
  fail(String(error?.stack ?? error))
} finally {
  stopServer()
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed')
process.exit(failures.length ? 1 : 0)
