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
// Sound toggle
// ---------------------------------------------------------------------
const toggle = document.querySelector<HTMLButtonElement>('.sound-toggle')!
const label = toggle.querySelector('.sound-label')!
stage.sound?.enabled.subscribe(
  (on) => {
    toggle.setAttribute('aria-pressed', String(on))
    toggle.setAttribute('aria-label', on ? 'صدا روشن است؛ برای خاموش کردن بزنید' : 'صدا خاموش است؛ برای روشن کردن بزنید')
    label.textContent = on ? 'صدا روشن' : 'صدا'
  },
  { immediate: true },
)
toggle.addEventListener('click', () => void stage.sound?.toggle())

// ---------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------
const loader = initLoader()
const preload = new Preloader()
preload.progress.subscribe((p) => loader.progress(p), { immediate: true })

const fonts = Promise.all([
  preload.font('700 1em "Noto Nastaliq Urdu Variable"', 'یک بطری کوه دوغ آبعلی', 1),
  preload.font('400 1em "Lalezar"', 'پیسسس سفید برف', 0.5),
  preload.font('400 1em "Estedad Variable"', 'آبعلی نام جایی در البرز است', 0.5),
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
        exp.layer.render()
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
await loader.finish(stage, () => sound.pop())
stage.scroll?.unlock()
html.classList.add('is-ready')
stage.refresh(true)
initChapters(stage, experience, sound)

// Debug handle for development and automated captures (`?capture`). Capture
// mode also lifts the frame-delta clamp so animations keep real-time pace
// in slow software-rendered browsers.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('capture')) {
  Object.assign(window, { __abali: { stage, experience } })
  if (!import.meta.env.DEV) stage.ticker.maxDelta = 0.5
}
