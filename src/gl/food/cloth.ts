/**
 * The sofreh: cream cotton printed in the qalamkar manner — a border of
 * paisley (boteh) between ruled bands in madder red and soot black, sprigs
 * scattered over the field — with a fine weave and soft wrinkles.
 * Units: centimetres; the cloth lies on y = 0.
 */
import * as THREE from 'three'
import { createNoise, seededRandom } from '@veyra/core'

// Natural dyes, a little faded by washing.
const MADDER = '#8a3b2b'
const SOOT = '#3a302a'
const INDIGO = '#3f4f6e'
const OCHRE = '#b48a45'
const CREAM = '#ece2cd'

function boteh(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, flip: boolean, rand: () => number) {
  const w = h * 0.62
  ctx.save()
  ctx.translate(x, y)
  if (flip) ctx.scale(-1, 1)
  const outline = (s: number) => {
    ctx.beginPath()
    ctx.moveTo(0.18 * w * s, -0.5 * h * s)
    ctx.bezierCurveTo(0.95 * w * s, -0.32 * h * s, 0.78 * w * s, 0.5 * h * s, 0, 0.5 * h * s)
    ctx.bezierCurveTo(-0.72 * w * s, 0.5 * h * s, -0.62 * w * s, -0.08 * h * s, -0.05 * w * s, -0.22 * h * s)
    ctx.quadraticCurveTo(0.3 * w * s, -0.3 * h * s, 0.18 * w * s, -0.5 * h * s)
    ctx.closePath()
  }
  ctx.lineWidth = h * 0.045
  ctx.strokeStyle = SOOT
  ctx.fillStyle = MADDER
  outline(1)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = CREAM
  outline(0.66)
  ctx.fill()
  ctx.fillStyle = INDIGO
  outline(0.42)
  ctx.fill()
  // Dots and a vein, as stamped by the block.
  ctx.fillStyle = OCHRE
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * w * 0.22, Math.sin(a) * h * 0.18 + h * 0.08, h * 0.035, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  void rand
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = OCHRE
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Draws the cloth's print at `pxPerCm` for a `width × depth` cm cloth. */
export function drawCloth(width: number, depth: number, pxPerCm: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.round(width * pxPerCm)
  c.height = Math.round(depth * pxPerCm)
  const ctx = c.getContext('2d')!
  const k = pxPerCm
  const rand = seededRandom(14)
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, c.width, c.height)
  // Cotton: faint mottling where the dye took unevenly (drawn small, scaled up soft).
  const { noise2 } = createNoise(8)
  const mw = Math.ceil(width * 2)
  const mh = Math.ceil(depth * 2)
  const mottle = document.createElement('canvas')
  mottle.width = mw
  mottle.height = mh
  const mctx = mottle.getContext('2d')!
  const mimg = mctx.createImageData(mw, mh)
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const n = noise2(x / 18, y / 18) * 0.65 + noise2(x / 4.4, y / 4.4) * 0.35
      const i = (y * mw + x) * 4
      const v = n > 0 ? 255 : 0
      mimg.data[i] = mimg.data[i + 1] = mimg.data[i + 2] = v
      mimg.data[i + 3] = Math.min(255, Math.abs(n) * 60)
    }
  }
  mctx.putImageData(mimg, 0, 0)
  ctx.imageSmoothingQuality = 'high'
  ctx.globalAlpha = 0.5
  ctx.drawImage(mottle, 0, 0, c.width, c.height)
  ctx.globalAlpha = 1

  // Field: small sprigs in a loose half-drop repeat, the dye a little faded.
  ctx.globalAlpha = 0.42
  for (let y = 24; y < depth - 22; y += 9) {
    for (let x = 24 + ((Math.round(y / 9) % 2) * 4.5); x < width - 22; x += 9) {
      flower(ctx, (x + (rand() - 0.5) * 0.6) * k, (y + (rand() - 0.5) * 0.6) * k, 0.85 * k, rand() > 0.5 ? MADDER : INDIGO)
    }
  }
  ctx.globalAlpha = 1

  // Border: ruled bands and a row of boteh.
  const band = (inset: number, line: number, color: string) => {
    ctx.strokeStyle = color
    ctx.lineWidth = line * k
    ctx.strokeRect(inset * k, inset * k, (width - inset * 2) * k, (depth - inset * 2) * k)
  }
  ctx.fillStyle = MADDER
  ctx.fillRect(0, 0, c.width, 2.4 * k)
  ctx.fillRect(0, c.height - 2.4 * k, c.width, 2.4 * k)
  ctx.fillRect(0, 0, 2.4 * k, c.height)
  ctx.fillRect(c.width - 2.4 * k, 0, 2.4 * k, c.height)
  band(3.2, 0.25, SOOT)
  band(3.8, 0.12, SOOT)
  band(13.0, 0.25, SOOT)
  band(13.6, 0.7, MADDER)
  band(14.5, 0.12, SOOT)
  const row = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.floor(len / 6.6)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      ctx.save()
      ctx.translate(x * k, y * k)
      ctx.rotate(Math.atan2(y1 - y0, x1 - x0))
      boteh(ctx, 0, 0, 5.6 * k, i % 2 === 1, rand)
      flower(ctx, 3.3 * k, -2.6 * k, 0.7 * k, INDIGO)
      flower(ctx, 3.3 * k, 2.6 * k, 0.7 * k, INDIGO)
      ctx.restore()
    }
  }
  const m = 8.4
  row(m, m, width - m, m)
  row(width - m, m, width - m, depth - m)
  row(width - m, depth - m, m, depth - m)
  row(m, depth - m, m, m)
  // Block printing never sits perfectly: a wash of the cloth over the ink.
  ctx.globalAlpha = 0.16
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.globalAlpha = 1
  return c
}

/** A fine cotton weave as a tileable normal map. */
export function drawWeave(size = 256, threads = 32): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const cell = size / threads
  const h = (x: number, y: number) => {
    const u = (x / cell) % 2
    const v = (y / cell) % 2
    const over = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
    const fu = Math.sin(((x % cell) / cell) * Math.PI)
    const fv = Math.sin(((y % cell) / cell) * Math.PI)
    void u
    void v
    return over ? fv * 0.9 + fu * 0.1 : fu * 0.9 + fv * 0.1
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h((x + 1) % size, y) - h((x - 1 + size) % size, y)
      const dy = h(x, (y + 1) % size) - h(x, (y - 1 + size) % size)
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      img.data[i] = (-dx / len) * 127.5 + 127.5
      img.data[i + 1] = (dy / len) * 127.5 + 127.5
      img.data[i + 2] = (1 / len) * 127.5 + 127.5
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** The cloth mesh, gently wrinkled, lying on y = 0. */
export function createCloth(width: number, depth: number, quality: 'low' | 'medium' | 'high'): { mesh: THREE.Mesh; dispose(): void } {
  const segs = quality === 'low' ? 60 : 140
  const geometry = new THREE.PlaneGeometry(width, depth, segs, Math.round((segs * depth) / width)).rotateX(-Math.PI / 2)
  const { noise2 } = createNoise(3)
  const pos = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    // Soft folds from being unfolded onto the floor.
    const fold = noise2(x / 38, z / 38) * 0.55 + noise2(x / 14 + 3, z / 14) * 0.18 + Math.max(0, Math.sin(x / 9 + noise2(z / 30, 1) * 2)) ** 6 * 0.25
    pos.setY(i, fold)
  }
  geometry.computeVertexNormals()
  const print = new THREE.CanvasTexture(drawCloth(width, depth, quality === 'low' ? 6 : quality === 'medium' ? 8 : 11))
  print.colorSpace = THREE.SRGBColorSpace
  print.anisotropy = 8
  const weave = new THREE.CanvasTexture(drawWeave())
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping
  weave.repeat.set(width / 1.6, depth / 1.6)
  const material = new THREE.MeshStandardMaterial({
    map: print,
    normalMap: weave,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.6,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return {
    mesh,
    dispose() {
      geometry.dispose()
      material.dispose()
      print.dispose()
      weave.dispose()
    },
  }
}
