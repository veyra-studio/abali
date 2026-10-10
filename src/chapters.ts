/**
 * Scroll choreography for the whole film. Each chapter is a Veyra scene;
 * its progress drives the DOM typography and, with WebGL, the worlds:
 *
 *   hero    the bottle stands in the studio, cold, capped
 *   تق      the camera closes in on the cap; the opener bites; the cap flies
 *   پیس     the gas escapes as a cold wisp; shake it and it boils over
 *   آخیش    the foam turns to snow: Abali's mountains, the word stretches
 *   سفره    the sofreh fills, dish by dish; one thing is missing
 *   finale  your turn: open it
 */
import { clamp, inlineSign, kashida, lerp, range, scenePresets, splitText, Spring, toPersianDigits, type Stage } from '@veyra/core'
import { BOTTLE } from './gl/bottle'
import type { Experience, World } from './gl/experience'
import type { AbaliSound } from './sound'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
const ease = (t: number) => t * t * (3 - 2 * t)
const easeOut = (t: number) => 1 - (1 - t) ** 3

interface Place {
  x: number
  baseY: number
  scale: number
}
const mix = (a: Place, b: Place, t: number): Place => ({ x: lerp(a.x, b.x, t), baseY: lerp(a.baseY, b.baseY, t), scale: lerp(a.scale, b.scale, t) })

type Theme = 'studio' | 'snow' | 'table'
const THEME_COLOR: Record<Theme, string> = { studio: '#05070b', snow: '#e9f0f6', table: '#efe7d6' }

export function initChapters(stage: Stage, exp: Experience | null, sound: AbaliSound): void {
  const html = document.documentElement
  const reduced = () => stage.reducedMotion.value
  const vw = () => stage.viewport.w
  const vh = () => stage.viewport.h
  const mobile = () => vw() < 760

  let theme: Theme = 'studio'
  const setTheme = (t: Theme) => {
    if (t === theme) return
    theme = t
    html.dataset.theme = t
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
  }

  // ------------------------------------------------------------------
  // HUD chapter indicator
  // ------------------------------------------------------------------
  const hudNo = $('.hud-no')
  const hudName = $('.hud-name')
  let currentChapter = ''
  for (const section of $$<HTMLElement>('.chapter')) {
    const enter = () => {
      if (currentChapter === section.id) return
      currentChapter = section.id
      hudNo.textContent = section.dataset.no ?? ''
      hudName.textContent = section.dataset.chapter ?? ''
      sound.tick()
    }
    stage.scene(section, { start: 'top center', end: 'bottom center', onEnter: enter, onEnterBack: enter })
  }

  // ------------------------------------------------------------------
  // Placements: CSS px for the pixel camera
  // ------------------------------------------------------------------
  const heroSlot = $('.hero-slot')
  const finaleSlot = $('.finale-slot')
  for (const el of [heroSlot, finaleSlot]) stage.rects.track(el)
  const fromSlot = (el: Element, live: boolean): Place => {
    // The hero slot is read as if the page were at the top: the bottle stays
    // where it first stood while the hero scrolls away beneath it.
    const r = live ? stage.rects.view(el) : stage.rects.get(el)
    return { x: r.left + r.width / 2 - vw() / 2, baseY: -(r.top + r.height - vh() / 2), scale: r.height }
  }
  /** Close on the cap: the crown fills a good part of the screen, beside the copy. */
  const capClose = (): Place => {
    const S = vh() * (mobile() ? 1.3 : 2.35)
    const capY = vh() * (mobile() ? -0.06 : 0.07)
    return { x: mobile() ? 0 : vw() * 0.17 * inlineSign(html), baseY: capY - 0.983 * S, scale: S }
  }
  /** The open neck, a little further back, room for the wisp above it. */
  const neckClose = (): Place => {
    const S = vh() * (mobile() ? 1.2 : 1.85)
    const mouthY = vh() * (mobile() ? -0.02 : -0.1)
    return { x: mobile() ? 0 : vw() * 0.17 * inlineSign(html), baseY: mouthY - BOTTLE.rim * S, scale: S }
  }

  // ------------------------------------------------------------------
  // 00 — Hero
  // ------------------------------------------------------------------
  const heroTitle = $('.hero-title')
  const beats = $$('.hero-title .beat')
  const heroFade = $$('.hero .kicker, .hero-sub, .hero-actions')
  let heroOut = 0
  stage.scene('#top', {
    start: 'top top',
    end: 'bottom top',
    onProgress(p) {
      heroOut = p
      if (reduced()) {
        heroTitle.style.opacity = String(1 - range(p, 0.2, 0.6))
        return
      }
      heroTitle.style.transform = `translate3d(0, ${-p * 14}vh, 0)`
      heroTitle.style.opacity = String(1 - range(p, 0.15, 0.6))
      for (const el of heroFade) el.style.opacity = String(1 - range(p, 0, 0.35))
    },
  })
  let heroLift = reduced() ? 0 : 1
  if (!reduced()) {
    const tl = stage.timeline()
    beats.forEach((b, i) => {
      tl.fromTo(b, { opacity: 0, y: '0.35em', scale: 1.08 }, { opacity: 1, y: '0em', scale: 1 }, { duration: 0.9, ease: 'backOut' }, 0.15 + i * 0.32)
    })
    tl.fromTo(heroFade, { opacity: 0 }, { opacity: 1 }, { duration: 1.2 }, 1.1)
    const lift = { v: 1 }
    tl.fromTo(lift, { v: 1 }, { v: 0 }, { duration: 1.8, ease: 'glide', onUpdate: () => (heroLift = lift.v) }, 0)
    tl.play()
  }

  // ------------------------------------------------------------------
  // 01 — تق
  // ------------------------------------------------------------------
  const taqSection = $('#taq')
  const taqWord = $('.taq-word')
  const taqLine = $('.taq-line')
  const taqNo = $('#taq .chapter-no')
  let taqP = 0
  let popped = false
  const taqSpring = new Spring(0, { stiffness: 320, damping: 14 })
  const POP = 0.58
  stage.scene(taqSection, {
    ...scenePresets.pinned,
    onProgress(p) {
      taqP = p
      const lineO = range(p, 0.1, 0.2)
      taqLine.style.opacity = taqNo.style.opacity = String(lineO)
      // The pop fires once each time the scroll crosses it going forward.
      if (p >= POP && !popped) {
        popped = true
        sound.taq()
        sound.hiss(0.8)
        taqSpring.impulse(reduced() ? 0 : 9)
      } else if (p < POP - 0.02 && popped) {
        popped = false
      }
    },
  })

  // ------------------------------------------------------------------
  // 02 — پیس
  // ------------------------------------------------------------------
  const pisSection = $('#pis')
  const pisWord = $('.pis-word')
  const pisSplit = splitText(pisWord, { type: 'chars' })
  const pisLine = $('.pis-line')
  const shake = $('.shake')
  const hint = $('.shake-hint')
  const gauge = $('.gauge')
  const shakeBtn = $<HTMLButtonElement>('.shake-btn')
  let pisP = 0
  let pisActive = false
  let pressure = 0
  let burst = -1 // seconds since the bottle boiled over, or -1
  let hintLevel = -1
  const hints = ['تکانش ندهید.', 'گفتیم تکانش ندهید!', 'دارد سر می‌رود!', 'دیدید؟ سر رفت.']
  const setHint = (level: number) => {
    if (level === hintLevel) return
    hintLevel = level
    hint.textContent = hints[level]!
  }
  stage.scene(pisSection, {
    ...scenePresets.pinned,
    onEnter: () => (pisActive = true),
    onEnterBack: () => (pisActive = true),
    onLeave: () => (pisActive = false),
    onLeaveBack: () => (pisActive = false),
    onProgress(p) {
      pisP = p
      pisSection.style.setProperty('--shake-o', String(range(p, 0.22, 0.3) * (1 - range(p, 0.84, 0.9))))
      // The copy goes under the foam as the bottle boils over.
      pisSection.style.setProperty('--copy-o', String(1 - range(p, 0.9, 0.97)))
      pisLine.style.opacity = String(range(p, 0.12, 0.2))
    },
  })
  shakeBtn.addEventListener('click', () => {
    if (burst < 0) pressure = Math.min(1, pressure + 0.22)
  })

  // ------------------------------------------------------------------
  // 03 — آخیش
  // ------------------------------------------------------------------
  const akhishSection = $('#akhish')
  const akhishWord = $('.akhish-word')
  const akhishLines = $$('.akhish-line')
  const stretch = kashida(akhishWord)
  let akhishP = 0
  stage.scene(akhishSection, {
    ...scenePresets.pinned,
    onProgress(p) {
      akhishP = p
      akhishWord.style.opacity = String(range(p, 0.06, 0.16))
      stretch.level = reduced() ? 0 : Math.round((mobile() ? 5 : 9) * ease(range(p, 0.14, 0.62)))
      akhishLines.forEach((line, i) => {
        const t = range(p, 0.3 + i * 0.08, 0.4 + i * 0.08)
        line.style.opacity = String(t)
        line.style.transform = reduced() ? 'none' : `translate3d(0, ${(1 - easeOut(t)) * 0.5}em, 0)`
      })
    },
  })

  // ------------------------------------------------------------------
  // 04 — سفره
  // ------------------------------------------------------------------
  const sofrehSection = $('#sofreh')
  const menu = $$('.menu li')
  const punchMissing = $('.punch-missing')
  const punchDone = $('.punch-done')
  let sofrehP = 0
  let landedCount = 0
  stage.scene(sofrehSection, {
    ...scenePresets.pinned,
    onProgress(p) {
      sofrehP = p
      const table = exp?.table
      // Without the 3D table, the menu lights up on its own schedule.
      const lit = table ? table.litMenu(p) : Math.floor(range(p, 0.1, 0.7) * 6.99)
      menu.forEach((li, i) => li.classList.toggle('is-on', i < lit))
      const landed = table ? table.landed(p) : 0
      if (landed > landedCount) sound.thud(landed === table?.count ? 1.3 : 0.8)
      landedCount = landed
      punchMissing.classList.toggle('is-on', p >= 0.7 && p < 0.86)
      punchDone.classList.toggle('is-on', p >= 0.9)
    },
  })

  // ------------------------------------------------------------------
  // 05 — Finale: your turn
  // ------------------------------------------------------------------
  const openBtn = $<HTMLButtonElement>('.open-btn')
  const openLabel = $('.open-label')
  const cheers = $('.cheers')
  let finaleIn = 0
  let opened = false
  let wisp = -1 // seconds since the finale pop, or -1
  stage.scene('#finale', {
    start: 'top bottom',
    end: 'top top',
    onProgress(p) {
      finaleIn = p
    },
  })
  let cheerTimer: number | undefined
  openBtn.addEventListener('click', () => {
    window.clearTimeout(cheerTimer)
    if (!opened) {
      opened = true
      exp?.studio.popCap()
      sound.taq()
      sound.hiss(1)
      wisp = 0
      cheers.textContent = 'پیسسس'
      cheerTimer = window.setTimeout(() => (cheers.textContent = 'آخیش!'), 1100)
      openLabel.textContent = 'یکی دیگر؟'
    } else {
      opened = false
      exp?.studio.resetCap()
      wisp = -1
      window.setTimeout(() => sound.clack(), 420)
      cheers.textContent = ''
      openLabel.textContent = 'تق!'
    }
  })

  // ------------------------------------------------------------------
  // Per-frame orchestration: worlds, studio state, veil, theme, sound
  // ------------------------------------------------------------------
  const wordSpring = new Spring(0, { stiffness: 180, damping: 18 })
  const fizzSpring = new Spring(0, { stiffness: 40, damping: 12 })
  const foamSpring = new Spring(0, { stiffness: 30, damping: 9 })
  let hiss = 0
  stage.onFrame((frame) => {
    const dt = frame.delta
    const time = frame.time
    const r = reduced()

    // «تق!» slams in at the pop.
    const taqT = taqP >= POP ? 1 : 0
    const slam = taqSpring.step(dt)
    taqWord.style.opacity = String(taqT)
    taqWord.style.transform = r ? 'none' : `scale(${1 + slam * 0.02}) rotate(${slam * -0.25}deg)`

    // «پیسسس…» spreads like escaping gas.
    wordSpring.target = range(pisP, 0.04, 0.16)
    const w = wordSpring.step(dt)
    pisWord.style.opacity = String(clamp(w * 1.4))
    if (!r) {
      const n = pisSplit.chars.length
      hiss = lerp(hiss, 0.3 + pressure * 1.2, 1 - Math.exp(-dt * 4))
      pisSplit.chars.forEach((c, i) => {
        const k = (i - (n - 1) / 2) / n
        const drift = Math.sin(time * 1.7 + i * 1.3) * 0.02 * hiss
        c.style.transform = `translate3d(${(k * hiss * 0.18 + drift) * inlineSign(pisWord)}em, ${Math.sin(time * 2.1 + i) * 0.03 * hiss}em, 0)`
      })
    }

    // Shake: pointer speed builds pressure while the chapter is on screen.
    if (pisActive && pisP > 0.24 && pisP < 0.84 && burst < 0) {
      const speed = stage.pointer?.speed ?? 0
      pressure += Math.min(0.05, Math.max(0, speed - 250) * 0.00022 * dt * 60)
    }
    pressure = clamp(pressure - dt * 0.12, 0, 1)
    if (pressure >= 1 && burst < 0) {
      burst = 0
      setHint(3)
      sound.hiss(1)
      sound.taq()
    }
    if (burst >= 0) {
      burst += dt
      pressure = Math.max(0, pressure - dt * 0.9)
      if (burst > 3.2) {
        burst = -1
        setHint(0)
      }
    } else {
      setHint(pressure > 0.7 ? 2 : pressure > 0.3 ? 1 : 0)
    }
    gauge.style.setProperty('--pressure', pressure.toFixed(3))
    gauge.setAttribute('aria-valuenow', String(Math.round(pressure * 100)))
    gauge.setAttribute('aria-valuetext', `${toPersianDigits(Math.round(pressure * 100))} درصد`)

    // Sound beds.
    fizzSpring.target = pisP > 0.02 && pisP < 0.98 ? 0.18 + pressure * 0.82 : taqP > POP && taqP < 1 ? 0.25 : 0
    sound.fizz(Math.max(0, fizzSpring.step(dt)))
    sound.wind(akhishP > 0 && akhishP < 1 ? 0.65 * (1 - Math.abs(akhishP - 0.5) * 1.3) : 0)

    // ---- Which world is on screen ----
    let world: World = 'studio'
    let themeNow: Theme = 'studio'
    let foamFront = -1 // veil foam front, screen space
    let mist = 0
    let dark = 0
    const burstFlood = burst >= 0 ? (burst < 0.7 ? easeOut(burst / 0.7) : 1 - ease(range(burst, 1.6, 3.0))) : 0
    const scrollFlood = ease(range(pisP, 0.86, 1))
    if (finaleIn > 0) {
      dark = finaleIn < 0.5 ? ease(range(finaleIn, 0.04, 0.5)) : 1 - ease(range(finaleIn, 0.5, 0.95))
      world = finaleIn < 0.5 ? 'table' : 'studio'
      themeNow = finaleIn < 0.5 ? 'table' : 'studio'
    } else if (sofrehP > 0) {
      world = 'table'
      themeNow = 'table'
      mist = 1 - ease(range(sofrehP, 0.01, 0.12))
    } else if (akhishP > 0) {
      world = 'landscape'
      themeNow = 'snow'
      mist = Math.max(1 - ease(range(akhishP, 0.02, 0.3)), ease(range(akhishP, 0.86, 1)))
    } else {
      world = 'studio'
      const flood = Math.max(burstFlood, scrollFlood)
      if (flood > 0) foamFront = lerp(-0.15, 1.18, flood)
      themeNow = flood > 0.55 ? 'snow' : 'studio'
    }
    setTheme(themeNow)
    if (!exp) return

    const veil = exp.veil.uniforms
    veil.uFoam.value = foamFront
    veil.uMist.value = mist
    veil.uDark.value = dark
    exp.world = world
    if (exp.landscape) exp.landscape.progress = akhishP
    if (exp.table) exp.table.progress = finaleIn > 0 ? 1 : sofrehP

    // ---- Studio state ----
    const st = exp.studio.state
    st.visible = true
    st.turn = 0
    st.tiltX = 0
    st.shake = 0
    st.foam = 0
    st.plume = 0
    st.plumeRise = 0
    st.opener = 0
    st.capScrub = 0
    if (world !== 'studio') return

    if (finaleIn > 0) {
      const place = fromSlot(finaleSlot, true)
      Object.assign(st, place, { floor: 1, ice: 1, idle: 1, pointer: 1 })
      st.baseY += r ? 0 : -(1 - easeOut(finaleIn)) * vh() * 0.25
      if (wisp >= 0) {
        wisp += dt
        st.plume = 0.8 * (1 - range(wisp, 1.2, 3.2))
        st.plumeRise = range(wisp, 0, 1.4)
      }
      return
    }

    const hero = fromSlot(heroSlot, false)
    hero.baseY -= heroLift * vh() * 0.45
    if (pisP > 0) {
      // The open neck: wisp, foam, the shake.
      const t = ease(range(pisP, 0, 0.2))
      Object.assign(st, mix(capClose(), neckClose(), t))
      st.capScrub = 1
      st.floor = 0
      st.ice = 0
      st.idle = 0
      st.pointer = 0.4
      st.tiltX = 0.16 * t
      st.shake = pressure
      st.plume = r ? 0.5 : 0.78
      st.plumeRise = 1
      foamSpring.target = burst >= 0 ? 1 : Math.max(pressure * 0.55, scrollFlood)
      st.foam = clamp(foamSpring.step(dt))
    } else if (taqP > 0) {
      const zoom = ease(range(taqP, 0, 0.32))
      Object.assign(st, mix(hero, capClose(), zoom))
      st.floor = 1 - range(taqP, 0, 0.14)
      st.ice = st.floor
      st.idle = 1 - zoom
      st.pointer = 1 - zoom * 0.7
      const p = taqP
      st.opener = p < 0.5 ? 0.5 * ease(range(p, 0.16, 0.5)) : p < POP ? 0.5 + 0.3 * range(p, 0.5, POP) : 0.8 + 0.2 * range(p, POP + 0.02, 0.8)
      st.capScrub = p < 0.5 ? 0 : p < POP ? 0.25 * range(p, 0.5, POP) : r ? 1 : 0.25 + 0.75 * range(p, POP, 0.86)
      st.plume = range(p, POP, POP + 0.08) * (r ? 0.5 : 0.7)
      st.plumeRise = range(p, POP, 0.97)
      foamSpring.target = 0
      foamSpring.step(dt)
    } else {
      Object.assign(st, hero, { floor: 1, ice: 1, idle: 1, pointer: heroOut > 0 ? 1 - heroOut : 1 })
    }
  }, 40)
}
