/**
 * The loader is a crown cap seen from above: 21 crimps that light up as
 * the experience loads, then the cap pops off.
 */
import { toPersianDigits, type Stage } from '@veyra/core'

export interface Loader {
  progress(p: number): void
  finish(stage: Stage, onPop?: () => void): Promise<void>
}

export function initLoader(): Loader {
  const root = document.querySelector<HTMLElement>('.loader')!
  const teeth = root.querySelector<SVGGElement>('.cap-teeth')!
  const num = root.querySelector<HTMLElement>('.loader-num')!
  const svg = root.querySelector<SVGSVGElement>('.cap-loader')!
  const N = 21
  const paths: SVGPathElement[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2
    const pt = (r: number, da: number) => `${(Math.cos(a + da) * r).toFixed(2)} ${(Math.sin(a + da) * r).toFixed(2)}`
    const d = `M${pt(33, -0.13)} L${pt(46, -0.085)} Q${pt(48.5, 0)} ${pt(46, 0.085)} L${pt(33, 0.13)} Z`
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    path.dataset.angle = String(a)
    teeth.append(path)
    paths.push(path)
  }

  let shown = 0
  return {
    progress(p) {
      const on = Math.round(p * N)
      if (on === shown) return
      shown = on
      paths.forEach((path, i) => path.classList.toggle('is-on', i < on))
      num.textContent = toPersianDigits(Math.round(p * 100))
    },
    async finish(stage, onPop) {
      this.progress(1)
      if (stage.reducedMotion.value) {
        root.classList.add('is-done')
        return
      }
      await new Promise((r) => setTimeout(r, 220))
      onPop?.()
      // Crimps fly outward, the cap spins up and away.
      const tl = stage.timeline()
      paths.forEach((path, i) => {
        const a = Number(path.dataset.angle)
        tl.to(path, { x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0 }, { duration: 0.7, ease: 'expoOut' }, i * 0.008)
      })
      tl.to(svg, { y: -70, rotate: 160, scale: 0.6, opacity: 0 }, { duration: 0.9, ease: 'snap' }, 0.05)
      tl.to(root.querySelectorAll('.loader-line, .loader-count'), { opacity: 0, y: 12 }, { duration: 0.5, ease: 'glide' }, 0)
      tl.play()
      await new Promise((r) => setTimeout(r, 420))
      root.classList.add('is-done')
      await tl.finished
    },
  }
}
