/**
 * Scroll choreography for the whole film. Each chapter is a Veyra scene;
 * its progress drives the DOM typography and, with WebGL, the worlds:
 *
 *   hero    the bottle stands in the studio, cold, capped: «خنکی صدا دارد.»
 *   تق      the camera closes in on the cap; the opener pries it off
 *   پیس     a breath of cold fog, then the fizz; shake it and it boils over
 *   آخیش    gulps, then the foam turns to snow: Abali's mountains, the word stretches
 *   سفره    the sofreh fills, dish by dish; one thing is missing
 *   finale  your turn: open it — تق، پیس، قلپ قلپ، آخیش
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
/**
 * Writes a style property only when its value changes: the per-frame code
 * below sets the same values most frames, and every write costs the
 * browser style work.
 */
const written = new WeakMap<HTMLElement, Map<string, string>>()
const put = (el: HTMLElement, prop: string, value: string) => {
  let last = written.get(el)
  if (!last) written.set(el, (last = new Map()))
  if (last.get(prop) === value) return
  last.set(prop, value)
  el.style.setProperty(prop, value)
}
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
  /** Width of the picture's frame: at most twice the height (CSS `--frame`). */
  const frame = () => Math.min(vw(), 2 * vh())
  // The reading direction, read once: it never changes, and reading it
  // (computed style) every frame would force the browser to restyle.
  const forward = inlineSign(html)

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
  // Over the footer, which scrolls under the HUD, the HUD gets a dark ground.
  const hud = $('.hud')
  const footer = $('.site-footer')
  let hudHeight = hud.offsetHeight
  stage.onRefresh(() => (hudHeight = hud.offsetHeight))
  let overFooter = false
  stage.onFrame(() => {
    const over = stage.rects.view(footer).top < hudHeight
    if (over === overFooter) return
    overFooter = over
    html.classList.toggle('hud-over-footer', over)
  })
  /** Progress of a section scrolling in: its top from the viewport's bottom to its top. */
  const scrollIn = (sel: string, onProgress: (p: number) => void) => stage.scene(sel, { start: 'top bottom', end: 'top top', onProgress })

  // ------------------------------------------------------------------
  // Placements: CSS px for the pixel camera
  // ------------------------------------------------------------------
  const heroSlot = $('.hero-slot')
  const finaleSlot = $('.finale-slot')
  const finaleSection = $('#finale')
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
    return { x: mobile() ? 0 : frame() * 0.17 * forward, baseY: capY - 0.983 * S, scale: S }
  }
  /** The open neck, a little further back, room for the wisp above it. */
  const neckClose = (): Place => {
    const S = vh() * (mobile() ? 1.2 : 1.85)
    const mouthY = vh() * (mobile() ? -0.02 : -0.1)
    return { x: mobile() ? 0 : frame() * 0.17 * forward, baseY: mouthY - BOTTLE.rim * S, scale: S }
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
        put(heroTitle, 'opacity', String(1 - range(p, 0.2, 0.6)))
        return
      }
      put(heroTitle, 'transform', `translate3d(0, ${-p * 14}vh, 0)`)
      put(heroTitle, 'opacity', String(1 - range(p, 0.15, 0.6)))
      for (const el of heroFade) put(el, 'opacity', String(1 - range(p, 0, 0.35)))
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
  let snapped = false
  const snap = () => {
    snapped = true
    sound.taq()
    sound.hiss(0.8)
    slam.impulse(reduced() ? 0 : 9)
  }
  stage.scene('#taq', {
    ...scenePresets.pinned,
    onProgress(p) {
      taqP = p
      if (p >= POP && !popped) {
        // The opener levers in real time; the sound and «تق!» come when the cap snaps.
        popped = true
        if (exp) exp.studio.openWithOpener()
        else snap()
      } else if (p < UNDO && popped) {
        // Scrolled back: the cap flies back on, the opener back to the rim.
        popped = false
        snapped = false
        exp?.studio.resetCap()
        window.setTimeout(() => sound.clack(), 480)
      }
    },
  })

  // ------------------------------------------------------------------
  // 02 — پیس
  // ------------------------------------------------------------------
  const pisSection = $('#pis')
  const pisWord = $('.pis-word')
  const pisSplit = splitText(pisWord, { type: 'chars' })
  const pisForward = inlineSign(pisWord)
  const hint = $('.shake-hint')
  const gauge = $('.gauge')
  const shakeBtn = $<HTMLButtonElement>('.shake-btn')
  let pisIn = 0
  let pisP = 0
  let pisActive = false
  let pressure = 0
  let burst = -1 // seconds since the bottle boiled over, or -1
  // Boiled over: the foam fills the screen and carries the reader on to
  // «آخیش» (held while that scroll runs; it recedes if the reader stops it).
  let burstHold = false
  let burstFlood = 0
  // Shaking is back and forth: the last fast swing's direction on each axis.
  let swingX = 0
  let swingY = 0
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
      // Only where it spans the width (portrait); beside the table it covers nothing.
      cover = pin && card.offsetTop < pin.clientHeight * 0.3 && card.offsetWidth > pin.clientWidth * 0.6 ? Math.min(0.6, (card.offsetTop + card.offsetHeight) / pin.clientHeight) : 0
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
  let finalePending = false
  // The finale's three sounds, and a fourth: the gulps before «آخیش!».
  const cheer = () => {
    sound.taq()
    sound.hiss(1)
    cheers.textContent = 'پیسسس'
    cheerTimer = window.setTimeout(() => {
      cheers.textContent = 'قلپ، قلپ'
      sound.gulps(3)
      sound.ahh(1.45)
      cheerTimer = window.setTimeout(() => (cheers.textContent = 'آخیش!'), 1500)
    }, 900)
  }
  openBtn.addEventListener('click', () => {
    window.clearTimeout(cheerTimer)
    if (!opened) {
      opened = true
      openLabel.textContent = 'یکی دیگر؟'
      // The opener comes in and pries the cap off; the sounds follow the snap.
      if (exp) {
        finalePending = true
        exp.studio.openWithOpener()
      } else cheer()
    } else {
      opened = false
      finalePending = false
      exp?.studio.resetCap()
      window.setTimeout(() => sound.clack(), 480)
      cheers.textContent = ''
      openLabel.textContent = 'تق!'
    }
  })
  const hookStudio = () => {
    if (!exp || exp.studio.onPop) return
    exp.studio.onPop = () => {
      if (finalePending) {
        finalePending = false
        cheer()
      } else snap()
    }
    exp.studio.onCapHit = (strength) => sound.capHit(strength)
    exp.studio.onChipHit = (strength) => sound.ice('clink', 0.35 + strength * 0.5)
  }

  // ------------------------------------------------------------------
  // Taps: the glass rings, the ice clinks — tap a cube again and again and
  // it cracks, then breaks into chips and dust. Links, buttons and the HUD
  // keep their clicks.
  // ------------------------------------------------------------------
  const interactive = 'a, button, input, select, textarea, label, [role="button"], .hud'
  if (exp) {
    document.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest(interactive)) return
      const hit = exp.pick(e.clientX, e.clientY)
      if (!hit) return
      if (hit.kind === 'bottle') {
        exp.studio.tapBottle(e.clientX < innerWidth / 2 ? -1 : 1)
        sound.glass()
      } else {
        const what = exp.studio.tapIce(hit.index)
        if (what) sound.ice(what)
      }
    })
  }
  // A mouse over something to tap shows it.
  const finePointer = window.matchMedia('(pointer: fine)')
  let lastPointer = ''
  let canTap = false

  // ------------------------------------------------------------------
  // Per-frame orchestration: worlds, studio state, veil, theme, sound
  // ------------------------------------------------------------------
  let lastWorld: World = 'studio'
  let lastFinale = false
  const fizzSpring = new Spring(0, { stiffness: 40, damping: 12 })
  const foamSpring = new Spring(0, { stiffness: 30, damping: 9 })
  let hiss = 0
  let gaugePercent = -1
  let gulped = false
  stage.onFrame((frame) => {
    const dt = frame.delta
    const time = frame.time
    const r = reduced()
    hookTable()
    hookStudio()
    if (exp && finePointer.matches && stage.pointer) {
      const key = `${Math.round(stage.pointer.x)},${Math.round(stage.pointer.y)},${exp.world},${Math.round(stage.scrollY)}`
      if (key !== lastPointer) {
        lastPointer = key
        const over = stage.pointer.inside && exp.pick(stage.pointer.x, stage.pointer.y) !== null
        if (over !== canTap) html.classList.toggle('can-tap', (canTap = over))
      }
    }

    // «تق!» slams in when the cap comes off, and leaves if it goes back on.
    taqShow.target = snapped ? 1 : 0
    if (r) taqShow.snap(taqShow.target)
    const show = clamp(taqShow.step(dt))
    const s = slam.step(dt)
    put(taqWord, 'opacity', show.toFixed(3))
    put(taqWord, 'transform', r || show === 0 ? 'none' : `scale(${(0.92 + show * 0.08 + s * 0.02).toFixed(4)}) rotate(${(s * -0.25).toFixed(3)}deg)`)

    // «پیسسس» spreads like escaping gas (only while its chapter is on screen).
    if (!r && pisActive) {
      const n = pisSplit.chars.length
      hiss = lerp(hiss, 0.3 + pressure * 1.2, 1 - Math.exp(-dt * 4))
      pisSplit.chars.forEach((c, i) => {
        const k = (i - (n - 1) / 2) / n
        const drift = Math.sin(time * 1.7 + i * 1.3) * 0.02 * hiss
        c.style.transform = `translate3d(${(k * hiss * 0.18 + drift) * pisForward}em, ${Math.sin(time * 2.1 + i) * 0.03 * hiss}em, 0)`
      })
    }

    // Shake: only back and forth builds pressure — each fast swing that
    // reverses the last one adds a little (more for a hard one); a sweep or
    // a nudge adds nothing. Vigorous shaking boils it over in about five seconds.
    if (pisActive && pisP > 0.08 && pisP < 0.66 && burst < 0 && stage.pointer) {
      const swing = (v: number, last: number) => {
        if (Math.abs(v) < 380) return last
        const dir = Math.sign(v)
        if (last !== 0 && dir !== last) pressure += 0.045 + 0.035 * clamp((Math.abs(v) - 380) / 1800)
        return dir
      }
      swingX = swing(stage.pointer.vx, swingX)
      swingY = swing(stage.pointer.vy, swingY)
    }
    pressure = clamp(pressure - dt * 0.06, 0, 1)
    if (pressure >= 1 && burst < 0) {
      burst = 0
      burstHold = true
      setHint(3)
      sound.hiss(1)
      sound.taq()
      // Let the foam rise over the screen, then carry on to the mountains.
      window.setTimeout(
        () =>
          void stage.scroll?.scrollTo(akhishSection, { duration: r ? 0 : 2.6, ease: 'drift' }).then(() => {
            // Stopped on the way (the reader scrolled): the foam goes back down.
            if (Math.abs(stage.rects.view(akhishSection).top) > 40) burstHold = false
          }),
        r ? 0 : 550,
      )
    }
    if (burst >= 0) {
      burst += dt
      pressure = Math.max(0, pressure - dt * 0.9)
      // Arrived (the scroll's own flood has taken over), or gone back down.
      if (akhishIn > 0.6 || (!burstHold && burstFlood <= 0)) {
        burst = -1
        burstHold = false
        setHint(0)
      }
    } else {
      setHint(pressure > 0.7 ? 2 : pressure > 0.3 ? 1 : 0)
    }
    burstFlood = clamp(burstFlood + (burst >= 0 && burstHold ? dt / 0.7 : -dt / 1.4))
    put(gauge, '--pressure', pressure.toFixed(3))
    const percent = Math.round(pressure * 100)
    if (percent !== gaugePercent) {
      gaugePercent = percent
      gauge.setAttribute('aria-valuenow', String(percent))
      gauge.setAttribute('aria-valuetext', `${toPersianDigits(percent)} درصد`)
    }

    // The bottle boils over: by shaking, or by scrolling on.
    const scrollFlood = smooth(range(pisP, 0.62, 1))
    const flood = Math.max(easeOut(burstFlood), scrollFlood)
    put(pisSection, '--shake-o', (range(pisP, 0.06, 0.14) * (1 - range(flood, 0.2, 0.45))).toFixed(3))
    put(pisSection, '--copy-o', (1 - range(flood, 0.55, 0.85)).toFixed(3))

    // «آخیش» stretches with the scroll, a letter's breath at a time.
    const stretchTarget = r ? 0 : (mobile() ? 5 : 9) * smooth(range(akhishP, 0.04, 0.5))
    stretchLevel += clamp(stretchTarget - stretchLevel, -dt * 14, dt * 14)
    stretch.level = Math.round(stretchLevel)

    // Sound beds.
    const openFor = exp?.studio.openFor ?? -1
    fizzSpring.target = pisP > 0.02 && pisP < 0.98 ? 0.18 + pressure * 0.82 : popped && taqP < 1 ? 0.25 : 0
    sound.fizz(Math.max(0, fizzSpring.step(dt)))
    // «قلپ، قلپ»: the first gulps as the foam turns to mountain air, before «آخیش!».
    if (akhishIn > 0.1 && !gulped && popped) {
      gulped = true
      sound.gulps(3)
      sound.ahh(1.45)
    } else if (akhishIn <= 0.02 && akhishP <= 0) gulped = false
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
    // «آخیش» is navy while the mist is thick and turns white over the clear valley.
    put(akhishSection, '--clear', (exp && world === 'landscape' ? smooth(range(mist, 0.55, 0.25)) : 0).toFixed(3))
    if (!exp) return

    const veil = exp.veil.uniforms
    veil.uFoam.value = foamFront
    veil.uFoamFade.value = foamFade
    veil.uMist.value = mist
    veil.uMistCool.value = mistCool
    veil.uDark.value = dark
    // Coming back to the studio from another world (under a veil), or
    // arriving at the finale however you got there: the cap is as the story
    // left it — off after «تق», on for the finale until you open it.
    const atFinale = finaleIn > 0.5
    if (world === 'studio' && (lastWorld !== 'studio' || atFinale !== lastFinale)) exp.studio.setCap(atFinale ? !opened : !popped)
    lastWorld = world
    lastFinale = atFinale
    exp.world = world
    // The camera starts up the valley while the mist is still lifting.
    if (exp.landscape) exp.landscape.progress = 0.2 * akhishIn + 0.8 * akhishP
    if (exp.table) {
      exp.table.progress = finaleIn > 0 ? 1 : sofrehP
      if (world === 'table') exp.table.cover = tableCover()
    }

    // ---- Studio state ----
    exp.shift = 0
    const st = exp.studio.state
    st.visible = true
    st.turn = 0
    st.tiltX = 0
    st.capTilt = 0
    st.shake = 0
    st.foam = 0
    st.plume = 0
    st.plumeRise = 0
    st.opener = 0
    if (world !== 'studio') return

    // A breath of cold fog over the mouth the moment the cap comes off (the
    // gas expands and cools) — small, faint and gone within a second.
    const wisp = openFor >= 0 && !r ? 0.7 * Math.exp(-openFor / 0.3) * smooth(range(openFor, 0, 0.04)) : 0
    const wispRise = openFor >= 0 ? range(openFor, 0, 0.55) : 0

    if (finaleIn > 0) {
      // Once the finale starts to leave, its picture scrolls with the page
      // like a photograph: the bottle keeps its place in the scene and the
      // view is lifted instead (no shift in perspective, no floor tipping past eye level).
      const lift = Math.max(0, -stage.rects.view(finaleSection).top)
      exp.shift = lift
      const place = fromSlot(finaleSlot, true)
      place.baseY -= lift
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
    // In close on the cap the camera looks down onto it a little, so the
    // opener lying on top reads as a flat steel blade.
    st.capTilt = 0.38 * toCap * (1 - toNeck)
    st.opener = smooth(range(taqP, 0.3, 0.52))
    st.plume = wisp
    st.plumeRise = wispRise
    st.shake = pisP > 0 ? pressure : 0
    foamSpring.target = pisP > 0 ? (burst >= 0 ? 1 : Math.max(pressure * 0.55, scrollFlood)) : 0
    st.foam = clamp(foamSpring.step(dt))
  }, 40)
}
