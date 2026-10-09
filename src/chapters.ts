/**
 * Scroll choreography for the whole film. Each chapter is a Veyra scene;
 * its progress drives DOM typography and, when WebGL is available, the
 * product state and world uniforms.
 */
import { clamp, damp, inlineSign, range, scenePresets, splitText, Spring, toPersianDigits, type Stage } from '@veyra/core'
import type { Experience } from './gl/experience'
import type { AbaliSound } from './sound'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
const ease = (t: number) => t * t * (3 - 2 * t)
const easeOut = (t: number) => 1 - (1 - t) ** 3

export function initChapters(stage: Stage, exp: Experience | null, sound: AbaliSound): void {
  const html = document.documentElement
  const reduced = () => stage.reducedMotion.value
  const u = exp?.world.uniforms
  const st = exp?.state

  let theme = 'dark'
  const setTheme = (t: string) => {
    if (t === theme) return
    theme = t
    html.dataset.theme = t
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', t === 'light' ? '#f4f2ec' : t === 'blue' ? '#2a8bd3' : t === 'night' ? '#0b1640' : '#07090c')
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
  // 00 — Hero
  // ------------------------------------------------------------------
  const heroTitle = $('.hero-title')
  const heroKicker = $('.hero .kicker')
  const heroSub = $('.hero-sub')
  const heroCue = $('.scroll-cue')
  let heroOut = 0
  stage.scene('#top', {
    start: 'top top',
    end: 'bottom top',
    onProgress(p) {
      heroOut = p
      if (reduced()) return
      heroTitle.style.transform = `translate3d(0, ${-p * 18}vh, 0)`
      heroTitle.style.opacity = String(1 - range(p, 0.1, 0.55))
      heroSub.style.opacity = heroCue.style.opacity = String(1 - range(p, 0, 0.3))
    },
  })

  // Entrance after the loader.
  if (!reduced()) {
    const tl = stage.timeline()
    tl.fromTo(heroKicker, { opacity: 0, y: 16 }, { opacity: 1, y: 0 }, { duration: 1.1 }, 0.1)
      .fromTo(heroTitle, { clipPath: 'inset(-30% -5% 100% -5%)', y: 40 }, { clipPath: 'inset(-30% -5% -30% -5%)', y: 0 }, { duration: 1.6, ease: 'glide' }, 0.15)
      .fromTo([heroSub, heroCue], { opacity: 0 }, { opacity: 1 }, { duration: 1.2 }, 0.9)
    if (st) tl.fromTo(st, { lift: -0.55 }, { lift: 0 }, { duration: 1.8, ease: 'glide' }, 0)
    tl.play()
  }

  // ------------------------------------------------------------------
  // 01 — Label: push into the label, hand off to the 2D world, morph
  // ------------------------------------------------------------------
  const labelTitle = $('.label-title')
  const labelLines = $$('.label-line')
  let labelP = 0
  stage.scene('#label', {
    ...scenePresets.pinned,
    onProgress(p) {
      labelP = p
      labelTitle.style.setProperty('--title-o', String(range(p, 0.02, 0.12) * (1 - range(p, 0.34, 0.44))))
      const beats = [0.5, 0.62, 0.76]
      labelLines.forEach((line, i) => {
        const t = reduced() ? (p > beats[i]! ? 1 : 0) : easeOut(range(p, beats[i]!, beats[i]! + 0.1))
        line.style.opacity = String(t)
        line.style.transform = reduced() ? 'none' : `translate3d(0, ${(1 - t) * 0.6}em, 0)`
      })
    },
  })

  // ------------------------------------------------------------------
  // 02 — Place
  // ------------------------------------------------------------------
  const placeTitle = $('.place-title')
  const placeCopy = $('.place-copy')
  let placeP = 0
  stage.scene('#place', {
    ...scenePresets.pinned,
    onProgress(p) {
      placeP = p
      if (!reduced()) placeTitle.style.setProperty('--place-shift', `${(0.5 - p) * 16}vh`)
      placeCopy.style.setProperty('--copy-o', String(range(p, 0.22, 0.34) * (1 - range(p, 0.9, 1))))
    },
  })

  // ------------------------------------------------------------------
  // 03 — Fizz: pressure builds when you shake
  // ------------------------------------------------------------------
  const fizzWord = $('.fizz-word')
  const fizzCopy = $('.fizz-copy')
  const shake = $('.shake')
  const hint = $('.shake-hint')
  const gauge = $('.gauge')
  const shakeBtn = $<HTMLButtonElement>('.shake-btn')
  const fizzSection = $('#fizz')
  const fizzWordSpring = new Spring(0, { stiffness: 260, damping: 16 })
  let fizzP = 0
  let fizzActive = false
  let pressure = 0
  let burst = -1 // seconds since burst, or -1
  let hintLevel = -1
  const hints = ['تکانش ندهید.', 'گفتیم تکانش ندهید…', 'جدی می‌گوییم!', 'گفته بودیم!']
  const setHint = (level: number) => {
    if (level === hintLevel) return
    hintLevel = level
    hint.textContent = hints[level]!
  }
  stage.scene('#fizz', {
    ...scenePresets.pinned,
    onEnter: () => (fizzActive = true),
    onEnterBack: () => (fizzActive = true),
    onLeave: () => (fizzActive = false),
    onLeaveBack: () => (fizzActive = false),
    onProgress(p) {
      fizzP = p
      fizzSection.style.setProperty('--shake-o', String(range(p, 0.32, 0.4) * (1 - range(p, 0.93, 1))))
      fizzCopy.style.opacity = String(range(p, 0.24, 0.32))
    },
  })
  shakeBtn.addEventListener('click', () => {
    pressure = Math.min(1, pressure + 0.22)
  })
  // Touch: dragging on the chapter shakes too (pointer velocity covers it).

  // ------------------------------------------------------------------
  // 04 — White: per-letter Lalezar with joins intact, drifting in reading order
  // ------------------------------------------------------------------
  const whiteLines = $$('.white-line')
  const whiteSplits = whiteLines.map((line) => splitText(line, { type: 'chars' }))
  const sign = inlineSign(whiteLines[0]!)
  whiteLines.forEach((line, i) => {
    const split = whiteSplits[i]!
    const from = line.dataset.from === 'left' ? -1 : 1
    let revealed = false
    const reveal = () => {
      if (revealed || reduced()) return
      revealed = true
      stage
        .timeline()
        .fromTo(split.chars, { y: '0.5em', opacity: 0, rotate: -6 }, { y: '0em', opacity: 1, rotate: 0 }, { duration: 1, stagger: 0.045, ease: 'backOut' })
        .play()
    }
    if (!reduced()) split.chars.forEach((c) => (c.style.opacity = '0'))
    stage.scene(line, {
      start: 'top bottom',
      end: 'bottom top',
      onEnter: reveal,
      onEnterBack: reveal,
      onProgress(p) {
        if (reduced()) return
        line.style.setProperty('--shift', `${(0.5 - p) * 22 * from * sign * -1}vw`)
      },
    })
  })
  let whiteIn = 0
  stage.scene('#white', {
    start: 'top bottom',
    end: 'top top',
    onProgress(p) {
      whiteIn = p
    },
  })

  // ------------------------------------------------------------------
  // 05 — Table: the sofreh fills, dish by dish
  // ------------------------------------------------------------------
  const svg = $<SVGSVGElement>('.sofreh-svg')
  // Cloth border dots and rice grains are generated, not hand-placed.
  const dots = svg.querySelector('.cloth-dots')!
  for (let i = 0; i < 4 * 28; i++) {
    const side = Math.floor(i / 28)
    const t = ((i % 28) + 0.5) / 28
    const pos = 82 + t * 836
    const [cx, cy] = side === 0 ? [pos, 40] : side === 1 ? [960, pos] : side === 2 ? [1000 - pos, 960] : [40, 1000 - pos]
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    c.setAttribute('cx', String(cx))
    c.setAttribute('cy', String(cy))
    c.setAttribute('r', i % 2 ? '3' : '5')
    dots.append(c)
  }
  const rice = svg.querySelector('.rice')!
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * 112
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    e.setAttribute('cx', String(-30 + Math.cos(a) * r))
    e.setAttribute('cy', String(10 + Math.sin(a) * r))
    e.setAttribute('rx', '7')
    e.setAttribute('ry', '2.4')
    e.setAttribute('transform', `rotate(${Math.random() * 180} ${-30 + Math.cos(a) * r} ${10 + Math.sin(a) * r})`)
    rice.append(e)
  }
  const capTeeth = svg.querySelector('.bottle-cap')!
  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    c.setAttribute('cx', String(Math.cos(a) * 31))
    c.setAttribute('cy', String(Math.sin(a) * 31))
    c.setAttribute('r', '4.2')
    c.setAttribute('fill', '#24357a')
    capTeeth.append(c)
  }
  // Wrap each dish so CSS transforms don't clobber its SVG placement.
  const dishes = $$<SVGGElement>('.dish', svg).map((g) => {
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    inner.classList.add('dish-inner')
    while (g.firstChild) inner.append(g.firstChild)
    g.append(inner)
    g.style.opacity = '1'
    inner.style.transformBox = 'fill-box'
    inner.style.transformOrigin = 'center'
    return { g, inner, order: Number(g.dataset.order) }
  })
  // Landing order follows the menu: rice, kebab, tomato, onion, sumac, bread & herbs, glass, bottle.
  const sequence = [2, 3, 4, 5, 6, 7, 0, 1, 8, 9]
  const menu = $$('.menu li')
  const menuFor: Record<number, number> = { 2: 0, 3: 1, 4: 1, 5: 2, 6: 3, 7: 4, 0: 5, 1: 5 }
  const tableSection = $('#table')
  stage.scene('#table', {
    ...scenePresets.pinned,
    onProgress(p) {
      const lit = new Set<number>()
      for (const d of dishes) {
        const idx = sequence.indexOf(d.order)
        const startAt = 0.04 + idx * 0.075
        const t = reduced() ? (p >= startAt ? 1 : 0) : range(p, startAt, startAt + 0.1)
        const e = easeOut(t)
        d.inner.style.opacity = String(clamp(t * 1.6))
        d.inner.style.transform = reduced() ? 'none' : `translate(${(1 - e) * 26 * sign}px, ${(1 - e) * -70}px) scale(${1 + (1 - e) * 0.18}) rotate(${(1 - e) * -10}deg)`
        if (t > 0.5 && menuFor[d.order] !== undefined) lit.add(menuFor[d.order]!)
      }
      menu.forEach((li, i) => li.classList.toggle('is-on', lit.has(i)))
      tableSection.style.setProperty('--punch-o', String(range(p, 0.78, 0.86)))
    },
  })

  // ------------------------------------------------------------------
  // 06 — Finale: open gently
  // ------------------------------------------------------------------
  const openBtn = $<HTMLButtonElement>('.open-btn')
  const openOval = $('.open-oval')
  const cheers = $('.cheers')
  const finaleSlot = $('.finale-slot')
  let finaleIn = 0
  let opened = false
  stage.scene('#finale', {
    start: 'top bottom',
    end: 'top top',
    onProgress(p) {
      finaleIn = p
    },
  })
  const burstBubbles = () => {
    if (reduced()) return
    const rect = finaleSlot.getBoundingClientRect()
    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText = `position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height * 0.04}px;z-index:4;pointer-events:none`
    document.body.append(layer)
    const tl = stage.timeline({ onComplete: () => layer.remove() })
    for (let i = 0; i < 26; i++) {
      const b = document.createElement('span')
      const size = 4 + Math.random() * 14
      b.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px;border-radius:50%;border:1.5px solid #f4f2ec;background:rgb(244 242 236 / ${Math.random() * 0.3})`
      layer.append(b)
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
      const d = 80 + Math.random() * 260
      tl.fromTo(b, { x: 0, y: 0, opacity: 1, scale: 0.4 }, { x: Math.cos(a) * d, y: Math.sin(a) * d - 60, opacity: 0, scale: 1 }, { duration: 0.9 + Math.random() * 0.8, ease: 'expoOut' }, Math.random() * 0.15)
    }
    tl.play()
  }
  openBtn.addEventListener('click', () => {
    if (!opened) {
      opened = true
      exp?.popCap()
      sound.pop()
      burstBubbles()
      cheers.textContent = 'نوش جان!'
      openOval.textContent = 'یکی دیگر؟'
    } else {
      opened = false
      exp?.resetCap()
      setTimeout(() => sound.clack(), 420)
      cheers.textContent = ''
      openOval.textContent = 'آرام باز کنید'
    }
  })

  // ------------------------------------------------------------------
  // Per-frame orchestration of GL state, theme and sound
  // ------------------------------------------------------------------
  const fizzLevelSpring = new Spring(0, { stiffness: 40, damping: 12 })
  stage.onFrame((frame) => {
    const dt = frame.delta

    // Theme follows the dominant visual.
    const inLabel = labelP > 0 && labelP < 1
    if (finaleIn > 0.5) setTheme('dark')
    else if (whiteIn > 0.6) setTheme('light')
    else if (fizzP > 0.12) setTheme('night')
    else if (placeP > 0 || (inLabel && labelP > 0.44) || labelP >= 1) setTheme('blue')
    else setTheme('dark')

    // Fizz pressure: pointer speed while the chapter is active.
    if (fizzActive && fizzP > 0.3 && fizzP < 0.95 && burst < 0) {
      const speed = stage.pointer?.speed ?? 0
      pressure += Math.max(0, speed - 250) * 0.00022 * dt * 60
    }
    pressure = Math.max(0, pressure - dt * 0.12)
    if (pressure >= 1 && burst < 0) {
      burst = 0
      setHint(3)
      sound.pop()
    }
    if (burst >= 0) {
      burst += dt
      pressure = Math.max(0, pressure - dt * 0.9)
      if (burst > 2.6) {
        burst = -1
        setHint(0)
      }
    } else {
      setHint(pressure > 0.7 ? 2 : pressure > 0.3 ? 1 : 0)
    }
    gauge.style.setProperty('--pressure', pressure.toFixed(3))
    gauge.setAttribute('aria-valuenow', String(Math.round(pressure * 100)))
    gauge.setAttribute('aria-valuetext', `${toPersianDigits(Math.round(pressure * 100))} درصد`)
    fizzWordSpring.target = range(fizzP, 0.12, 0.26)
    const fw = fizzWordSpring.step(dt)
    const jitter = reduced() ? 0 : pressure * 6
    fizzWord.style.transform = `translate3d(${(Math.random() - 0.5) * jitter}px, ${(Math.random() - 0.5) * jitter}px, 0) scale(${0.55 + fw * 0.45}) rotate(${(1 - fw) * -8}deg)`
    fizzWord.style.opacity = String(clamp(fw * 1.4))

    // Sound beds.
    fizzLevelSpring.target = fizzP > 0.05 && fizzP < 0.98 ? 0.15 + pressure * 0.85 : 0
    sound.fizz(Math.max(0, fizzLevelSpring.step(dt)))
    sound.wind(placeP > 0 && placeP < 1 ? 0.6 * (1 - Math.abs(placeP - 0.5) * 1.4) : 0)

    if (!exp || !u || !st) return

    // ---- Which chapter drives the GL scene ----
    const label = labelP
    const handoff = range(label, 0.36, 0.44)
    const afterHandoff = label >= 0.44 || placeP > 0 || fizzP > 0
    const whiteFlood = whiteIn

    // Product
    let visible = true
    st.push = 0
    st.zoom = 1
    st.idle = 1
    st.tilt = 1
    st.shake = 0
    let lift = st.lift
    if (finaleIn > 0) {
      st.slot = 'finale'
      lift = reduced() ? 0 : -(1 - easeOut(finaleIn)) * 0.4
      visible = true
    } else if (fizzP > 0) {
      // The bottle drops into the night of bubbles, then leaves upward.
      st.slot = 'hero'
      const inT = easeOut(range(fizzP, 0.08, 0.3))
      const outT = ease(range(fizzP, 0.88, 1))
      // Portrait screens: a smaller bottle, higher, so the controls fit below.
      const portrait = stage.viewport.aspect < 0.8
      lift = (1 - inT) * 1.25 + outT * 1.3 + (portrait ? 0.3 : 0.02)
      st.zoom = portrait ? 0.6 : 0.86
      st.shake = pressure
      st.idle = 0.6
      visible = inT > 0 && outT < 1
    } else if (label > 0 && !afterHandoff) {
      st.slot = 'hero'
      st.push = range(label, 0, 0.42)
      lift = 0
      visible = true
    } else if (afterHandoff) {
      // Hidden, but the label parameters stay frozen at the hand-off pose
      // so the oval becomes the sun from exactly where it was.
      st.slot = 'hero'
      st.push = 1
      lift = 0
      visible = false
    } else {
      st.slot = 'hero'
      lift = heroOut > 0 ? 0 : st.lift
    }
    st.lift = lift
    st.visible = visible

    // World
    const showWorld = afterHandoff && whiteFlood < 1
    exp.world.mesh.visible = showWorld
    u.uLabel.value = label >= 0.36 || placeP > 0 || fizzP > 0 ? 1 : 0
    u.uMorph.value = placeP > 0 || fizzP > 0 ? 1 : range(label, 0.46, 0.96)
    u.uTravel.value = fizzP > 0 ? 1 : placeP
    u.uSnow.value = range(placeP, 0.04, 0.25) * (1 - range(fizzP, 0, 0.12))
    u.uNightMix.value = ease(range(fizzP, 0.02, 0.2))
    u.uBubbles.value = range(fizzP, 0.08, 0.3)
    u.uPressure.value = damp(u.uPressure.value, pressure, 8, dt)
    // Foam levels are in screen space: the milk front leads the white
    // chapter's top edge so its text always sits on milk.
    u.uBurst.value = burst >= 0 ? (burst < 0.5 ? easeOut(burst / 0.5) : 1 - ease(range(burst, 1.2, 2.6))) * 1.3 - 0.15 : -1
    u.uMilkMix.value = whiteFlood > 0 ? whiteFlood * 1.2 + 0.04 : -1
    // Cross-fade to the flat label while the bottle is still in front.
    exp.world.overlayAlpha.value = label > 0.36 && label < 0.44 ? handoff : 0

    // The canvas sleeps once the milk has covered everything (white, table)
    // and wakes for the finale.
    exp.active = finaleIn > 0 || whiteFlood < 1
  }, 40)
}
