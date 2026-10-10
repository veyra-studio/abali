/**
 * What sits beside the plate: half an onion, a bowl of sumac, folded
 * flatbread and a bunch of fresh herbs. Units: centimetres, on y = 0.
 */
import * as THREE from 'three'
import { createNoise, seededRandom } from '@veyra/core'

export interface Sides {
  onion: THREE.Group
  sumac: THREE.Group
  bread: THREE.Group
  herbs: THREE.Group
  dispose(): void
}

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function createSides(quality: 'low' | 'medium' | 'high'): Sides {
  const disposables: Array<{ dispose(): void }> = []
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x)

  // --- Onion: a half, cut face up, its layers showing --------------------
  const onion = new THREE.Group()
  {
    const R = 4.3
    const rand = seededRandom(13)
    const rings = keep(
      canvas(512, 512, (ctx) => {
        ctx.fillStyle = '#f6f1e6'
        ctx.fillRect(0, 0, 512, 512)
        // Layers: each a slightly translucent band with a bright edge.
        for (let i = 14; i >= 1; i--) {
          const r = (i / 14) * 246
          const ox = (14 - i) * 0.9
          ctx.fillStyle = i % 2 ? '#f3ede0' : '#ece4d3'
          ctx.beginPath()
          ctx.ellipse(256 + ox, 256 - ox * 0.6, r, r * (0.95 + rand() * 0.03), 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        // The papery skin at the rim.
        ctx.strokeStyle = '#b98a5c'
        ctx.lineWidth = 7
        ctx.beginPath()
        ctx.arc(256, 256, 250, 0, Math.PI * 2)
        ctx.stroke()
      }),
    )
    const dome = new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    dome.scale(1, 0.82, 1) // the lower half: dome down, the cut face up
    dome.translate(0, R * 0.82, 0)
    const skin = keep(new THREE.MeshPhysicalMaterial({ color: '#c79a63', roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#f3d7a8') }))
    const face = keep(new THREE.MeshPhysicalMaterial({ map: rings, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, emissive: new THREE.Color('#25221d') }))
    const cut = new THREE.CircleGeometry(R * 0.995, 64).rotateX(-Math.PI / 2)
    cut.translate(0, R * 0.82, 0)
    onion.add(new THREE.Mesh(keep(dome), skin), new THREE.Mesh(keep(cut), face))
  }

  // --- Sumac: a small glazed bowl of the deep red spice --------------
  const sumac = new THREE.Group()
  {
    const outline = [
      [0, 0.1],
      [2.2, 0],
      [2.6, 0.4],
      [4.2, 2.6],
      [4.4, 3.2],
      [4.15, 3.25],
      [3.8, 2.6],
      [2.2, 0.7],
      [0, 0.6],
    ].map(([r, h]) => new THREE.Vector2(r, h))
    const bowl = new THREE.Mesh(keep(new THREE.LatheGeometry(outline, 64)), keep(new THREE.MeshPhysicalMaterial({ color: '#e8eef2', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 })))
    const { noise2 } = createNoise(5)
    const heap = keep(new THREE.CircleGeometry(3.85, 64, 0, Math.PI * 2).rotateX(-Math.PI / 2))
    const hp = heap.attributes.position as THREE.BufferAttribute
    // A soft mound of powder with a few clumps.
    const seg = new THREE.CircleGeometry(3.85, 48)
    seg.dispose()
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i)
      const z = hp.getZ(i)
      const r = Math.hypot(x, z) / 3.85
      hp.setY(i, 2.0 + (1 - r * r) * 0.9 + noise2(x * 2.2, z * 2.2) * 0.06)
    }
    heap.computeVertexNormals()
    const powder = keep(
      canvas(256, 256, (ctx) => {
        ctx.fillStyle = '#6e1b26'
        ctx.fillRect(0, 0, 256, 256)
        const rand = seededRandom(3)
        for (let i = 0; i < 2600; i++) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(140, 42, 54, 0.8)' : 'rgba(58, 14, 20, 0.7)'
          ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2)
        }
      }),
    )
    const spice = new THREE.Mesh(heap, keep(new THREE.MeshStandardMaterial({ map: powder, roughness: 1 })))
    sumac.add(bowl, spice)
  }

  // --- Bread: lavash, folded in four, edges torn and blistered -----------
  const bread = new THREE.Group()
  {
    const { noise2 } = createNoise(11)
    const layer = (w: number, d: number, seed: number) => {
      // An irregular outline: a rounded rectangle with a torn edge.
      const shape = new THREE.Shape()
      const n = 72
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        const sq = 1 / Math.max(Math.abs(c) / (w / 2), Math.abs(s) / (d / 2)) // a box…
        const round = Math.min(sq, Math.hypot(w / 2, d / 2) * 0.86) // …with soft corners
        const r = round * (1 + noise2(a * 3 + seed, seed) * 0.05 + noise2(a * 13, seed) * 0.015)
        if (i === 0) shape.moveTo(c * r, s * r)
        else shape.lineTo(c * r, s * r)
      }
      const geo = new THREE.ShapeGeometry(shape, 24)
      geo.rotateX(-Math.PI / 2)
      const p = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i)
        const z = p.getZ(i)
        p.setY(i, 0.12 + Math.max(0, noise2(x / 5 + seed, z / 5)) * 0.5 + noise2(x / 1.6, z / 1.6 + seed) * 0.06)
      }
      geo.computeVertexNormals()
      // Planar UVs for the crust texture.
      const uv = new Float32Array(p.count * 2)
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = p.getX(i) / w + 0.5
        uv[i * 2 + 1] = p.getZ(i) / d + 0.5
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      return keep(geo)
    }
    const crust = keep(
      canvas(512, 512, (ctx) => {
        ctx.fillStyle = '#e8d6ae'
        ctx.fillRect(0, 0, 512, 512)
        const rand = seededRandom(19)
        // Blisters from the oven wall: pale bubbles with toasted rims.
        for (let i = 0; i < 520; i++) {
          const x = rand() * 512
          const y = rand() * 512
          const r = 2 + rand() ** 2 * 13
          const g = ctx.createRadialGradient(x, y, 0, x, y, r)
          const dark = rand() < 0.4
          g.addColorStop(0, dark ? 'rgba(140, 96, 52, 0.62)' : 'rgba(248, 238, 214, 0.6)')
          g.addColorStop(0.7, dark ? 'rgba(160, 118, 70, 0.3)' : 'rgba(196, 160, 110, 0.25)')
          g.addColorStop(1, 'rgba(200, 150, 80, 0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }),
    )
    const mat = keep(new THREE.MeshStandardMaterial({ map: crust, roughness: 0.82, side: THREE.DoubleSide }))
    const a = new THREE.Mesh(layer(30, 24, 1), mat)
    const b = new THREE.Mesh(layer(28, 22, 4), mat)
    b.position.set(1.5, 0.5, -1)
    b.rotation.y = 0.12
    bread.add(a, b)
  }

  // --- Herbs: basil, mint and tarragon in a loose bunch ---------------
  const herbs = new THREE.Group()
  {
    const leafTex = keep(
      canvas(128, 256, (ctx) => {
        ctx.clearRect(0, 0, 128, 256)
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(64, 4)
        ctx.bezierCurveTo(124, 70, 118, 190, 64, 252)
        ctx.bezierCurveTo(10, 190, 4, 70, 64, 4)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(64, 10)
        ctx.lineTo(64, 248)
        for (let i = 1; i < 7; i++) {
          ctx.moveTo(64, 30 + i * 32)
          ctx.lineTo(28, 10 + i * 32)
          ctx.moveTo(64, 30 + i * 32)
          ctx.lineTo(100, 10 + i * 32)
        }
        ctx.stroke()
      }),
    )
    leafTex.colorSpace = THREE.NoColorSpace
    const leaf = keep(new THREE.PlaneGeometry(1, 2, 2, 4).rotateX(-Math.PI / 2))
    // Curl the leaf a little.
    const lp = leaf.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < lp.count; i++) lp.setY(i, Math.abs(lp.getX(i)) * 0.35 + lp.getZ(i) * lp.getZ(i) * 0.06)
    leaf.computeVertexNormals()
    const kinds = [
      { color: '#2f5d24', size: 2.6, count: 26 }, // basil
      { color: '#4f2a3f', size: 2.3, count: 10 }, // purple basil
      { color: '#4c7a32', size: 1.7, count: 30 }, // mint
      { color: '#5d8a3c', size: 1.4, count: 26 }, // tarragon (narrow)
    ]
    const rand = seededRandom(41)
    for (const k of kinds) {
      const mat = keep(new THREE.MeshStandardMaterial({ color: k.color, alphaMap: leafTex, alphaTest: 0.4, roughness: 0.55, side: THREE.DoubleSide }))
      const n = quality === 'low' ? Math.ceil(k.count * 0.6) : k.count
      const mesh = new THREE.InstancedMesh(leaf, mat, n)
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const e = new THREE.Euler()
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const d = Math.sqrt(rand()) * 6
        const narrow = k.size < 1.5 ? 0.45 : 1
        e.set((rand() - 0.5) * 0.7, a + Math.PI / 2 + (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.7)
        q.setFromEuler(e)
        m.compose(new THREE.Vector3(Math.cos(a) * d * 1.4, 0.4 + rand() * 2.4 * (1 - d / 7), Math.sin(a) * d), q, new THREE.Vector3(k.size * narrow, 1, k.size))
        mesh.setMatrixAt(i, m)
      }
      herbs.add(mesh)
    }
  }

  return {
    onion,
    sumac,
    bread,
    herbs,
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
