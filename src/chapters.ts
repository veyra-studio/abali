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
 *
 * Two rules keep it natural. Camera moves and transitions are tied to
 * scroll and begin while the next section scrolls in, so nothing waits on
 * an empty screen. Events — the cap snapping off, a dish set down — are
 * triggered by scroll but play in real time, and undo themselves if the
 * reader scrolls back; nothing is ever left hanging in mid-air.
 */
import { clamp, inlineSign, kashida, lerp, range, scenePresets, splitText, Spring, toPersianDigits, type Stage } from '@veyra/core'
import { BOTTLE } from './gl/bottle'
import type { Experience, World } from './gl/experience'
import type { AbaliSound } from './sound'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
/** Smootherstep: starts and ends at rest — camera moves without a jolt. */
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
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
  /** Progress of a section scrolling in: its top from the viewport's bottom to its top. */
  const scrollIn = (sel: string, onProgress: (p: number) => void) => stage.scene(sel, { start: 'top bottom', end: 'top top', onProgress })

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
  // 01 — تق: the opener comes in with the scroll; the cap snaps off in real time
  // ------------------------------------------------------------------
  const taqWord = $('.taq-word')
  let taqP = 0
  let popped = false
  const POP = 0.55
  const UNDO = 0.5
  const slam = new Spring(0, { stiffness: 320, damping: 14 })
  const taqShow = new Spring(0, { stiffness: 260, damping: 24 })
  stage.scene('#taq', {
    ...scenePresets.pinned,
    onProgress(p) {
      taqP = p
      if (p >= POP && !popped) {
        popped = true
        exp?.studio.openWithOpener()
        sound.taq()
        sound.hiss(0.8)
        slam.impulse(reduced() ? 0 : 9)
      } else if (p < UNDO && popped) {
        // Scrolled back: the cap goes back on, the opener back to the rim.
        popped = false
        exp?.studio.resetCap()
        window.setTimeout(() => sound.clack(), 380)
      }
    },
  })

  // ------------------------------------------------------------------
  // 02 — پیس
  // ------------------------------------------------------------------
  const pisSection = $('#pis')
  const pisWord = $('.pis-word')
  const pisSplit = splitText(pisWord, { type: 'chars' })
  const hint = $('.shake-hint')
  const gauge = $('.gauge')
  const shakeBtn = $<HTMLButtonElement>('.shake-btn')
  let pisIn = 0
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
  scrollIn('#pis', (p) => (pisIn = p))
  stage.scene(pisSection, {
    ...scenePresets.pinned,
    onEnter: () => (pisActive = true),
    onEnterBack: () => (pisActive = true),
    onLeave: () => (pisActive = false),
    onLeaveBack: () => (pisActive = false),
    onProgress(p) {
      pisP = p
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
  const stretch = kashida(akhishWord)
  let akhishIn = 0
  let akhishP = 0
  let stretchLevel = 0
  scrollIn('#akhish', (p) => (akhishIn = p))
  stage.scene(akhishSection, { ...scenePresets.pinned, onProgress: (p) => (akhishP = p) })

  // ------------------------------------------------------------------
  // 04 — سفره
  // ------------------------------------------------------------------
  const sofrehSection = $('#sofreh')
  const menu = $$('.menu li')
  const punchMissing = $('.punch-missing')
  const punchDone = $('.punch-done')
  let sofrehIn = 0
  let sofrehP = 0
  scrollIn('#sofreh', (p) => (sofrehIn = p))
  stage.scene(sofrehSection, {
    ...scenePresets.pinned,
    onProgress(p) {
      sofrehP = p
      const table = exp?.table
      // Without the 3D table, the menu lights up on its own schedule.
      const lit = table ? table.litMenu(p) : Math.floor(range(p, 0.1, 0.7) * 6.99)
      menu.forEach((li, i) => li.classList.toggle('is-on', i < lit))
      punchMissing.classList.toggle('is-on', p >= 0.7 && p < 0.86)
      punchDone.classList.toggle('is-on', p >= 0.9)
    },
  })
  const hookTable = () => {
    if (exp?.table && !exp.table.onLand) exp.table.onLand = (weight) => sound.thud(weight)
  }
  // On narrow screens the menu card lies over the top of the table: the
  // camera frames the spread below it (measured once per viewport size).
  const card = $('.sofreh-copy')
  let coverKey = ''
  let cover = 0
  const tableCover = () => {
    const key = `${vw()}x${vh()}`
    if (key !== coverKey) {
      coverKey = key
      const pin = card.offsetParent as HTMLElement | null
      cover = pin && card.offsetTop < pin.clientHeight * 0.3 ? Math.min(0.6, (card.offsetTop + card.offsetHeight) / pin.clientHeight) : 0
    }
    return cover
  }

  // ------------------------------------------------------------------
  // 05 — Finale: your turn
  // ------------------------------------------------------------------
  const openBtn = $<HTMLButtonElement>('.open-btn')
  const openLabel = $('.open-label')
  const cheers = $('.cheers')
  let finaleIn = 0
  let opened = false
  scrollIn('#finale', (p) => (finaleIn = p))
  let cheerTimer: number | undefined
  openBtn.addEventListener('click', () => {
    window.clearTimeout(cheerTimer)
    if (!opened) {
      opened = true
      exp?.studio.popCap()
      sound.taq()
      sound.hiss(1)
      cheers.textContent = 'پیسسس'
      cheerTimer = window.setTimeout(() => (cheers.textContent = 'آخیش!'), 1100)
      openLabel.textContent = 'یکی دیگر؟'
    } else {
      opened = false
      exp?.studio.resetCap()
      window.setTimeout(() => sound.clack(), 420)
      cheers.textContent = ''
      openLabel.textContent = 'تق!'
    }
  })

  // ------------------------------------------------------------------
  // Per-frame orchestration: worlds, studio state, veil, theme, sound
  // ------------------------------------------------------------------
  let lastWorld: World = 'studio'
  const fizzSpring = new Spring(0, { stiffness: 40, damping: 12 })
  const foamSpring = new Spring(0, { stiffness: 30, damping: 9 })
  let hiss = 0
  stage.onFrame((frame) => {
    const dt = frame.delta
    const time = frame.time
    const r = reduced()
    hookTable()

    // «تق!» slams in when the cap comes off, and leaves if it goes back on.
    taqShow.target = popped ? 1 : 0
    if (r) taqShow.snap(taqShow.target)
    const show = clamp(taqShow.step(dt))
    const s = slam.step(dt)
    taqWord.style.opacity = String(show)
    taqWord.style.transform = r ? 'none' : `scale(${0.92 + show * 0.08 + s * 0.02}) rotate(${s * -0.25}deg)`

    // «پیسسس» spreads like escaping gas.
    if (!r) {
      const n = pisSplit.chars.length
      hiss = lerp(hiss, 0.3 + pressure * 1.2, 1 - Math.exp(-dt * 4))
      pisSplit.chars.forEach((c, i) => {
        const k = (i - (n - 1) / 2) / n
        const drift = Math.sin(time * 1.7 + i * 1.3) * 0.02 * hiss
        c.style.transform = `translate3d(${(k * hiss * 0.18 + drift) * inlineSign(pisWord)}em, ${Math.sin(time * 2.1 + i) * 0.03 * hiss}em, 0)`
      })
    }

    // Shake: the hand's speed builds pressure while the chapter is on screen.
    if (pisActive && pisP > 0.08 && pisP < 0.66 && burst < 0) {
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

    // The bottle boils over: by shaking, or by scrolling on.
    const burstFlood = burst >= 0 ? (burst < 0.7 ? easeOut(burst / 0.7) : 1 - smooth(range(burst, 1.6, 3.0))) : 0
    const scrollFlood = smooth(range(pisP, 0.62, 1))
    const flood = Math.max(burstFlood, scrollFlood)
    pisSection.style.setProperty('--shake-o', String(range(pisP, 0.06, 0.14) * (1 - range(flood, 0.2, 0.45))))
    pisSection.style.setProperty('--copy-o', String(1 - range(flood, 0.55, 0.85)))

    // «آخیش» stretches with the scroll, a letter's breath at a time.
    const stretchTarget = r ? 0 : (mobile() ? 5 : 9) * smooth(range(akhishP, 0.04, 0.5))
    stretchLevel += clamp(stretchTarget - stretchLevel, -dt * 14, dt * 14)
    stretch.level = Math.round(stretchLevel)

    // Sound beds.
    const openFor = exp?.studio.openFor ?? -1
    fizzSpring.target = pisP > 0.02 && pisP < 0.98 ? 0.18 + pressure * 0.82 : popped && taqP < 1 ? 0.25 : 0
    sound.fizz(Math.max(0, fizzSpring.step(dt)))
    const inMountains = Math.max(akhishIn * 0.6, akhishP > 0 && akhishP < 1 ? 1 - Math.abs(akhishP - 0.45) * 1.2 : 0)
    sound.wind(sofrehIn > 0 ? 0 : 0.6 * inMountains)

    // ---- Which world is on screen, and the veil between them ----
    let world: World = 'studio'
    let themeNow: Theme = 'studio'
    let foamFront = -1 // veil foam front, screen space
    let foamFade = 0
    let mist = 0
    let mistCool = 1
    let dark = 0
    if (finaleIn > 0) {
      dark = finaleIn < 0.5 ? smooth(range(finaleIn, 0.04, 0.5)) : 1 - smooth(range(finaleIn, 0.5, 0.95))
      world = finaleIn < 0.5 ? 'table' : 'studio'
      themeNow = finaleIn < 0.5 ? 'table' : 'studio'
    } else if (sofrehIn > 0) {
      // The white of the mountain mist becomes the white of the cloth.
      world = 'table'
      mist = 1 - smooth(range(sofrehIn, 0.1, 0.78))
      themeNow = mist > 0.5 ? 'snow' : 'table'
    } else if (akhishIn > 0) {
      // The foam goes still, turns to mist, and the mist lifts off the valley.
      world = 'landscape'
      themeNow = 'snow'
      foamFront = 1.2
      foamFade = range(akhishIn, 0, 0.14)
      mistCool = range(akhishIn, 0.12, 0.6)
      mist = akhishP > 0 ? smooth(range(akhishP, 0.76, 1)) : 1 - smooth(range(akhishIn, 0.04, 0.8))
    } else {
      world = 'studio'
      if (flood > 0) foamFront = lerp(-0.15, 1.2, flood)
      themeNow = flood > 0.55 ? 'snow' : 'studio'
    }
    setTheme(themeNow)
    sofrehSection.style.setProperty('--table-o', String(world === 'table' ? 1 - mist : 0))
    if (!exp) return

    const veil = exp.veil.uniforms
    veil.uFoam.value = foamFront
    veil.uFoamFade.value = foamFade
    veil.uMist.value = mist
    veil.uMistCool.value = mistCool
    veil.uDark.value = dark
    // Coming back to the studio from another world (under a veil): the cap
    // is as the story left it — off after «تق», on for the finale until opened.
    if (world === 'studio' && lastWorld !== 'studio') exp.studio.setCap(finaleIn > 0 ? !opened : !popped)
    lastWorld = world
    exp.world = world
    // The camera starts up the valley while the mist is still lifting.
    if (exp.landscape) exp.landscape.progress = 0.2 * akhishIn + 0.8 * akhishP
    if (exp.table) {
      exp.table.progress = finaleIn > 0 ? 1 : sofrehP
      if (world === 'table') exp.table.cover = tableCover()
    }

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
    if (world !== 'studio') return

    // The cold wisp: thick for a moment after the cap comes off, then a
    // thin thread; shaking feeds it.
    const wisp = openFor >= 0 ? (r ? 0.45 : 0.24 + 0.58 * Math.exp(-openFor / 2.2)) : 0
    const wispRise = openFor >= 0 ? range(openFor, 0, 1.3) : 0

    if (finaleIn > 0) {
      const place = fromSlot(finaleSlot, true)
      Object.assign(st, place, { floor: 1, ice: 1, idle: 1, pointer: 1 })
      st.baseY += r ? 0 : -(1 - easeOut(finaleIn)) * vh() * 0.25
      st.plume = wisp
      st.plumeRise = wispRise
      return
    }

    const hero = fromSlot(heroSlot, false)
    hero.baseY -= heroLift * vh() * 0.45
    // One continuous camera move: from the hero, while it scrolls away,
    // in to the cap, then back a little to the open neck.
    const toCap = smooth(clamp(0.5 * heroOut + 0.5 * range(taqP, 0, 0.28)))
    const toNeck = smooth(clamp(0.35 * range(taqP, 0.62, 1) + 0.45 * pisIn + 0.2 * range(pisP, 0, 0.12)))
    const place = toNeck > 0 ? mix(capClose(), neckClose(), toNeck) : mix(hero, capClose(), toCap)
    Object.assign(st, place)
    // The floor and the ice slide out of frame as the camera rises; fade them once they're gone.
    st.floor = 1 - range(toCap, 0.3, 0.65)
    st.ice = st.floor
    st.idle = 1 - range(toCap, 0, 0.6)
    st.pointer = Math.max(0.35, 1 - toCap)
    st.tiltX = 0.16 * toNeck
    st.opener = smooth(range(taqP, 0.3, 0.52))
    st.plume = wisp + (pisP > 0 ? pressure * 0.4 : 0)
    st.plumeRise = wispRise
    st.shake = pisP > 0 ? pressure : 0
    foamSpring.target = pisP > 0 ? (burst >= 0 ? 1 : Math.max(pressure * 0.55, scrollFlood)) : 0
    st.foam = clamp(foamSpring.step(dt))
  }, 40)
}
