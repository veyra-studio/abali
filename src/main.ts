import './style.css'
import { createStage, Preloader, supportsWebGL2 } from '@veyra/core'
import { initChapters } from './chapters'
import type { Experience } from './gl/experience'
import { initLoader } from './loader'
import { createSound } from './sound'

const html = document.documentElement
// The film starts at the top; don't let the browser restore a position
// underneath the intro.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
const stage = createStage({
  sound: { storageKey: 'abali:sound' },
  quality: { dprRange: [1, 2] },
})
const sound = createSound(stage.sound)
const reduced = stage.reducedMotion.value
html.classList.toggle('reduced', reduced)
stage.reducedMotion.subscribe((r) => html.classList.toggle('reduced', r))

// Film grain over everything (decorative).
const grain = document.createElement('div')
grain.className = 'grain'
grain.setAttribute('aria-hidden', 'true')
document.body.append(grain)

// ---------------------------------------------------------------------
// Sound: the HUD toggle and the hero's invitation drive the same bus.
// ---------------------------------------------------------------------
const toggle = document.querySelector<HTMLButtonElement>('.sound-toggle')!
const toggleLabel = toggle.querySelector('.sound-label')!
const cta = document.querySelector<HTMLButtonElement>('.sound-cta')!
const ctaLabel = cta.querySelector('.sound-cta-label')!
stage.sound?.enabled.subscribe(
  (on) => {
    for (const b of [toggle, cta]) b.setAttribute('aria-pressed', String(on))
    toggle.setAttribute('aria-label', on ? 'صدا روشن است؛ برای خاموش کردن بزنید' : 'صدا خاموش است؛ برای روشن کردن بزنید')
    toggleLabel.textContent = on ? 'صدا روشن' : 'صدا'
    ctaLabel.textContent = on ? 'صدا روشن است' : 'صدا را روشن کنید'
  },
  { immediate: true },
)
for (const b of [toggle, cta]) {
  b.addEventListener('click', async () => {
    const wasOn = stage.sound?.enabled.value
    await stage.sound?.toggle()
    if (!wasOn) sound.taq()
  })
}

// ---------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------
const loader = initLoader()
const preload = new Preloader()
preload.progress.subscribe((p) => loader.progress(p), { immediate: true })

const fonts = Promise.all([
  preload.font('700 1em "Noto Nastaliq Urdu Variable"', 'دوغ آبعلی', 1),
  preload.font('400 1em "Lalezar"', 'خنکی صدا دارد. سفره چیده شد.', 1),
  preload.font('400 1em "Estedad Variable"', 'سه صدا تا خنکی. همه‌چیز با یک دربازکن شروع می‌شود.', 0.5),
])

let experience: Experience | null = null
if (supportsWebGL2()) {
  preload
    .add(
      (async () => {
        await fonts // the label artwork uses the Nastaliq face
        const { createExperience } = await import('./gl/experience')
        const exp = createExperience(stage)
        // Compile shaders now rather than on the first scrolled frame.
        await exp.layer.renderer.compileAsync(exp.layer.scene, exp.layer.camera)
        experience = exp
      })(),
      4,
    )
    .catch((error: unknown) => {
      console.warn('[abali] WebGL experience unavailable, using the illustrated fallback.', error)
      html.classList.add('no-webgl')
    })
} else {
  html.classList.add('no-webgl')
}

stage.scroll?.lock()
window.scrollTo(0, 0)
await preload.done({ minDuration: reduced ? 0 : 1.4 })
await loader.finish(stage, () => sound.taq())
stage.scroll?.unlock()
html.classList.add('is-ready')
stage.refresh(true)
initChapters(stage, experience, sound)

// Build the later worlds while the visitor reads the hero.
if (experience) {
  const exp = experience as Experience
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600))
  idle(() => {
    void exp.prepare('landscape').then(() => idle(() => void exp.prepare('table')))
  })
}

// Debug handle for development and automated captures (`?capture`). Capture
// mode also lifts the frame-delta clamp so animations keep real-time pace
// in slow software-rendered browsers.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('capture')) {
  Object.assign(window, { __abali: { stage, experience } })
  if (!import.meta.env.DEV) stage.ticker.maxDelta = 0.5
}
