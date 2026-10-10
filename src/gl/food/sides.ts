/**
 * What sits beside the plate: a red onion halved, a bowl of sumac, folded
 * lavash and sabzi khordan — fresh herbs, radishes and spring onions.
 * Units: centimetres, on y = 0.
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

  // --- Onion: a red onion halved, cut face up, and two loose rings ---------
  const onion = new THREE.Group()
  {
    const R = 4.4
    const rand = seededRandom(13)
    // The cut face: layers of white flesh, each edged with its own thin
    // red-violet skin, the rings a little off-center as onions grow.
    const rings = keep(
      canvas(512, 512, (ctx) => {
        ctx.fillStyle = '#4e1a33'
        ctx.fillRect(0, 0, 512, 512)
        const { noise2 } = createNoise(31)
        // A layer's outline: never a true circle, a little flattened and bumpy.
        const layer = (cx: number, cy: number, r: number, seed: number) => {
          ctx.beginPath()
          for (let a = 0; a <= 72; a++) {
            const th = (a / 72) * Math.PI * 2
            const rr = r * (1 + noise2(Math.cos(th) * 1.3 + seed, Math.sin(th) * 1.3) * 0.035) * (1 - 0.04 * Math.cos(th * 2 + seed))
            ctx.lineTo(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr)
          }
          ctx.closePath()
        }
        const n = 10
        for (let i = n; i >= 1; i--) {
          const t = i / n
          const r = t * 252
          const ox = 256 + (1 - t) * 18
          const oy = 256 - (1 - t) * 11
          // Each layer's own skin: deep violet on the outer layers, paler inside.
          ctx.fillStyle = i === n ? '#5e1c3c' : i > n - 3 ? '#8e3463' : '#a7577f'
          layer(ox, oy, r, i * 1.7)
          ctx.fill()
          const g = ctx.createRadialGradient(ox, oy, r * 0.1, ox, oy, r)
          g.addColorStop(0, '#f7f1f2')
          g.addColorStop(0.75, i % 2 ? '#f4ecef' : '#efe4e9')
          g.addColorStop(1, '#e6cbd8')
          ctx.fillStyle = g
          layer(ox, oy, r - (i === n ? 11 : i > n - 3 ? 5 : 3.5) - rand() * 1.5, i * 1.7)
          ctx.fill()
        }
      }),
    )
    const dome = new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    dome.scale(1, 0.85, 1) // the lower half: dome down, the cut face up
    dome.translate(0, R * 0.85, 0)
    const skin = keep(new THREE.MeshPhysicalMaterial({ color: '#6b2440', roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#c98aa5') }))
    const face = keep(new THREE.MeshPhysicalMaterial({ map: rings, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new THREE.Color('#201a1c') }))
    const cut = new THREE.CircleGeometry(R * 0.995, 64).rotateX(-Math.PI / 2)
    cut.translate(0, R * 0.85, 0)
    onion.add(new THREE.Mesh(keep(dome), skin), new THREE.Mesh(keep(cut), face))
    // Two rings slipped off the other half: violet outside, white inside.
    const band = keep(
      canvas(8, 64, (ctx) => {
        ctx.fillStyle = '#f4e8ef'
        ctx.fillRect(0, 0, 8, 64)
        ctx.fillStyle = '#9c386b'
        ctx.fillRect(0, 0, 8, 12)
        ctx.fillRect(0, 52, 8, 12)
      }),
    )
    const ringMat = keep(new THREE.MeshPhysicalMaterial({ map: band, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }))
    for (const [x, z, r, tube] of [[6.2, 1.2, 2.6, 0.24], [7.4, -2.2, 1.9, 0.22]] as const) {
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(r, tube, 8, 48)), ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.scale.set(1, 1, 0.55)
      ring.position.set(x, tube * 0.55, z)
      onion.add(ring)
    }
  }

  // --- Sumac: a small bowl of the coarse, dark red spice, a little spoon in it
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
    const bowl = new THREE.Mesh(keep(new THREE.LatheGeometry(outline, 64)), keep(new THREE.MeshPhysicalMaterial({ color: '#eef2f4', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 })))
    const { noise2 } = createNoise(5)
    // A soft mound of coarse powder: grains and clumps, a dip where a spoon went in.
    const top = 3.85
    const heap = keep(new THREE.RingGeometry(0.001, top, 96, 28).rotateX(-Math.PI / 2))
    const hp = heap.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(hp.count * 3)
    const base = new THREE.Color('#6a2130')
    const dark = new THREE.Color('#3c0f1a')
    const light = new THREE.Color('#8c3644')
    const c = new THREE.Color()
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i)
      const z = hp.getZ(i)
      const r = Math.hypot(x, z) / top
      const grain = noise2(x * 6, z * 6) * 0.05 + noise2(x * 13, z * 13) * 0.025
      const dip = Math.exp(-(((x + 0.8) ** 2 + (z - 0.4) ** 2) / 1.6)) * 0.12
      hp.setY(i, 2.0 + (1 - r * r) * 0.85 + noise2(x * 1.6, z * 1.6) * 0.08 + grain - dip)
      c.copy(base).lerp(dark, Math.max(0, -grain * 9) + r * 0.25).lerp(light, Math.max(0, grain * 7) * 0.6)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    heap.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    heap.computeVertexNormals()
    const powder = keep(
      canvas(256, 256, (ctx) => {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 256, 256)
        const rand = seededRandom(3)
        for (let i = 0; i < 5200; i++) {
          const v = rand()
          ctx.fillStyle = v > 0.55 ? 'rgba(255, 220, 220, 0.55)' : v > 0.15 ? 'rgba(60, 20, 25, 0.5)' : 'rgba(20, 5, 8, 0.6)'
          ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2)
        }
      }),
    )
    powder.wrapS = powder.wrapT = THREE.RepeatWrapping
    powder.repeat.set(2, 2)
    const spice = new THREE.Mesh(heap, keep(new THREE.MeshStandardMaterial({ map: powder, vertexColors: true, roughness: 1 })))
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
      canvas(1024, 1024, (ctx) => {
        const S = 1024
        const { noise2: n2 } = createNoise(21)
        const rand = seededRandom(19)
        // The dough: pale cream, unevenly baked.
        const img = ctx.createImageData(S, S)
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const v = n2(x / 140, y / 140) * 0.6 + n2(x / 36, y / 36) * 0.3 + n2(x / 9, y / 9) * 0.1
            const i = (y * S + x) * 4
            img.data[i] = 236 + v * 10
            img.data[i + 1] = 221 + v * 12
            img.data[i + 2] = 184 + v * 16
            img.data[i + 3] = 255
          }
        }
        ctx.putImageData(img, 0, 0)
        // Where the oven was hottest the bubbles toasted: in loose clusters.
        const blob = (x: number, y: number, r: number, fill: string) => {
          ctx.fillStyle = fill
          ctx.beginPath()
          for (let a = 0; a <= 16; a++) {
            const th = (a / 16) * Math.PI * 2
            const rr = r * (0.75 + 0.5 * (n2(x / 30 + Math.cos(th), y / 30 + Math.sin(th)) * 0.5 + 0.5))
            ctx.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr)
          }
          ctx.fill()
        }
        for (let i = 0; i < 900; i++) {
          const x = rand() * S
          const y = rand() * S
          const heat = n2(x / 160 + 7, y / 160) * 0.5 + 0.5
          if (rand() > heat * 1.3) continue
          const r = 2 + rand() ** 2.5 * 16
          // A pale bubble, toasted golden at its top, sometimes darker in the middle.
          blob(x, y, r * 1.4, 'rgba(250, 238, 210, 0.55)')
          blob(x, y, r, `rgba(${196 - heat * 40}, ${138 - heat * 40}, ${72 - heat * 30}, ${0.35 + heat * 0.4})`)
          if (r > 7 && rand() < 0.45) blob(x + 1, y - 1, r * 0.45, `rgba(${120 - heat * 30}, ${72 - heat * 20}, 38, 0.55)`)
        }
        // Small blisters that stayed pale, with a faint shadow on one side.
        for (let i = 0; i < 700; i++) {
          const x = rand() * S
          const y = rand() * S
          const r = 1.5 + rand() * 5
          ctx.fillStyle = 'rgba(120, 90, 50, 0.12)'
          ctx.beginPath()
          ctx.arc(x + r * 0.35, y + r * 0.35, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(252, 244, 224, 0.7)'
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        // A few charred specks, and a dusting of flour.
        for (let i = 0; i < 260; i++) {
          ctx.fillStyle = `rgba(60, 36, 20, ${0.3 + rand() * 0.5})`
          ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 2.5, 1 + rand() * 2)
        }
        for (let i = 0; i < 2600; i++) {
          ctx.fillStyle = `rgba(255, 252, 244, ${0.25 + rand() * 0.4})`
          ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 1.5, 1 + rand() * 1.5)
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

  // --- Sabzi khordan: sprigs of basil, purple basil, mint and tarragon,
  // radishes and spring onions, in a loose heap -------------------------
  const herbs = new THREE.Group()
  {
    const rand = seededRandom(41)
    const low = quality === 'low'
    // Leaf textures: the shape as alpha, a pale midrib and veins, darker edges.
    const leafTexture = (shape: 'broad' | 'small' | 'narrow') =>
      keep(
        canvas(128, 256, (ctx) => {
          ctx.clearRect(0, 0, 128, 256)
          const w = shape === 'narrow' ? 22 : shape === 'small' ? 54 : 60
          const path = () => {
            ctx.beginPath()
            ctx.moveTo(64, 250)
            if (shape === 'small') {
              // Mint: an oval with a toothed edge.
              const pts = 26
              for (let i = 0; i <= pts; i++) {
                const t = i / pts
                const a = Math.PI * t
                const r = (i % 2 ? 0.92 : 1) * w * Math.sin(a) ** 0.9
                ctx.lineTo(64 + r, 250 - t * 240)
              }
              for (let i = pts; i >= 0; i--) {
                const t = i / pts
                const a = Math.PI * t
                const r = (i % 2 ? 0.92 : 1) * w * Math.sin(a) ** 0.9
                ctx.lineTo(64 - r, 250 - t * 240)
              }
            } else {
              ctx.bezierCurveTo(64 + w * 1.5, 190, 64 + w * 0.9, 50, 64, 6)
              ctx.bezierCurveTo(64 - w * 0.9, 50, 64 - w * 1.5, 190, 64, 250)
            }
            ctx.closePath()
          }
          path()
          const g = ctx.createLinearGradient(64 - w, 0, 64 + w, 0)
          g.addColorStop(0, '#bdbdbd')
          g.addColorStop(0.5, '#ffffff')
          g.addColorStop(1, '#bdbdbd')
          ctx.fillStyle = g
          ctx.fill()
          ctx.save()
          path()
          ctx.clip()
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.lineWidth = shape === 'narrow' ? 2 : 3
          ctx.beginPath()
          ctx.moveTo(64, 250)
          ctx.lineTo(64, 8)
          if (shape !== 'narrow') {
            ctx.lineWidth = 1.6
            for (let i = 1; i < 8; i++) {
              const y = 236 - i * 28
              ctx.moveTo(64, y)
              ctx.quadraticCurveTo(64 + w * 0.5, y - 12, 64 + w * 1.1, y - 34)
              ctx.moveTo(64, y)
              ctx.quadraticCurveTo(64 - w * 0.5, y - 12, 64 - w * 1.1, y - 34)
            }
          }
          ctx.stroke()
          ctx.restore()
        }),
      )
    // A leaf: base at the origin, tip toward −z, folded along the midrib.
    const leafGeo = keep(new THREE.PlaneGeometry(1, 1, 4, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.5))
    {
      const lp = leafGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < lp.count; i++) {
        const x = lp.getX(i)
        const z = lp.getZ(i)
        lp.setY(i, Math.abs(x) * 0.28 + z * z * 0.12)
      }
      leafGeo.computeVertexNormals()
    }
    const stemGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0))
    const kinds = {
      basil: { tex: leafTexture('broad'), color: '#336f2c', rough: 0.38, width: 0.62, list: [] as THREE.Matrix4[] },
      purple: { tex: leafTexture('broad'), color: '#53263f', rough: 0.4, width: 0.6, list: [] as THREE.Matrix4[] },
      mint: { tex: leafTexture('small'), color: '#4a8a36', rough: 0.62, width: 0.75, list: [] as THREE.Matrix4[] },
      tarragon: { tex: leafTexture('narrow'), color: '#5a8d3c', rough: 0.5, width: 0.3, list: [] as THREE.Matrix4[] },
    }
    const stems: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    // A sprig: a stem with leaves in pairs (or alternate, for tarragon),
    // smaller toward the tip.
    const sprig = (kind: keyof typeof kinds, x: number, z: number, y: number, heading: number, length: number, size: number) => {
      const k = kinds[kind]
      dir.set(Math.cos(heading), 0.12, Math.sin(heading)).normalize()
      stems.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.12, z), q.setFromUnitVectors(up, dir), new THREE.Vector3(0.045 + size * 0.012, length, 0.045 + size * 0.012)))
      const nodes = kind === 'tarragon' ? 7 : 4
      for (let i = 0; i < nodes; i++) {
        const t = 0.25 + (i / nodes) * 0.75
        const px = x + dir.x * length * t
        const py = y + dir.y * length * t + 0.05
        const pz = z + dir.z * length * t
        const s = size * (1.05 - t * 0.55) * (0.85 + rand() * 0.3)
        const sides = kind === 'tarragon' ? [i % 2 ? 1 : -1] : [1, -1]
        for (const side of sides) {
          // Leaves point forward and out from the stem (the leaf's tip is −z).
          const yaw = -Math.PI / 2 - heading - side * (0.75 + rand() * 0.35)
          e.set((rand() - 0.5) * 0.4, yaw, (rand() - 0.5) * 0.5 + side * 0.2)
          k.list.push(new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), q.setFromEuler(e), new THREE.Vector3(s * k.width * 1.6, 1, s * 1.6)))
        }
      }
      // A cluster at the tip.
      e.set(0.2, -Math.PI / 2 - heading, 0)
      k.list.push(new THREE.Matrix4().compose(new THREE.Vector3(x + dir.x * length, y + dir.y * length + 0.1, z + dir.z * length), q.setFromEuler(e), new THREE.Vector3(size * 0.5 * k.width * 1.6, 1, size * 0.8)))
    }
    // Lay the heap: sprigs fanning from one side, a few across the top.
    const spread = low ? 0.6 : 1
    const plan: Array<[keyof typeof kinds, number, number]> = [
      ['basil', Math.round(7 * spread), 2.4],
      ['purple', Math.round(4 * spread), 2.3],
      ['mint', Math.round(9 * spread), 1.5],
      ['tarragon', Math.round(6 * spread), 1.6],
    ]
    for (const [kind, n, size] of plan) {
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const d = Math.sqrt(rand()) * 5
        const x = Math.cos(a) * d * 1.3 - 3
        const z = Math.sin(a) * d
        sprig(kind, x, z, 0.3 + rand() * 1.6 * (1 - d / 6), (rand() - 0.5) * 1.6, 6 + rand() * 4, size)
      }
    }
    for (const k of Object.values(kinds)) {
      if (!k.list.length) continue
      const mat = keep(new THREE.MeshStandardMaterial({ color: k.color, map: k.tex, alphaTest: 0.45, roughness: k.rough, side: THREE.DoubleSide }))
      const mesh = new THREE.InstancedMesh(leafGeo, mat, k.list.length)
      const tint = new THREE.Color()
      k.list.forEach((m, i) => {
        mesh.setMatrixAt(i, m)
        // No two leaves quite the same green.
        mesh.setColorAt(i, tint.setHSL(0, 0, 0.82 + rand() * 0.36))
      })
      herbs.add(mesh)
    }
    const stemMesh = new THREE.InstancedMesh(stemGeo, keep(new THREE.MeshStandardMaterial({ color: '#5f7f34', roughness: 0.6 })), stems.length)
    stems.forEach((m, i) => stemMesh.setMatrixAt(i, m))
    herbs.add(stemMesh)

    // Radishes: round, magenta-red, a white tip and a thin root; one halved.
    const radishGeo = keep(new THREE.SphereGeometry(1, 28, 18))
    {
      const rp = radishGeo.attributes.position as THREE.BufferAttribute
      const colors = new Float32Array(rp.count * 3)
      const red = new THREE.Color('#c01c4b')
      const deep = new THREE.Color('#86113a')
      const white = new THREE.Color('#f3e6ea')
      const c = new THREE.Color()
      for (let i = 0; i < rp.count; i++) {
        const y = rp.getY(i)
        // The root end (−y) pales to white.
        c.copy(red).lerp(deep, Math.max(0, y) * 0.5).lerp(white, THREE.MathUtils.smoothstep(-y, 0.55, 0.95))
        colors.set([c.r, c.g, c.b], i * 3)
      }
      radishGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    const radishMat = keep(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }))
    const rootGeo = keep(new THREE.ConeGeometry(0.12, 2.4, 6).translate(0, -1.2, 0))
    const rootMat = keep(new THREE.MeshStandardMaterial({ color: '#efdde2', roughness: 0.6 }))
    const radishes: Array<[number, number, number, number]> = [
      [6.5, 3.2, 1.25, 0.4],
      [8.3, 1.0, 1.1, 2.0],
      [5.2, 5.6, 1.15, -0.8],
    ]
    for (const [x, z, r, turn] of radishes) {
      const g = new THREE.Group()
      const body = new THREE.Mesh(radishGeo, radishMat)
      body.scale.set(r, r * 1.12, r)
      const root = new THREE.Mesh(rootGeo, rootMat)
      root.position.y = -r * 1.05
      g.add(body, root)
      // Lying on its side, root pointing away.
      g.rotation.set(0, turn, Math.PI / 2 - 0.2)
      g.position.set(x, r * 0.95, z)
      herbs.add(g)
    }
    {
      // A halved radish: white inside, a red rim.
      const face = keep(
        canvas(128, 128, (ctx) => {
          ctx.fillStyle = '#c01c4b'
          ctx.beginPath()
          ctx.arc(64, 64, 62, 0, Math.PI * 2)
          ctx.fill()
          const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 58)
          g.addColorStop(0, '#fbf5f6')
          g.addColorStop(1, '#f1dde3')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(64, 64, 57, 0, Math.PI * 2)
          ctx.fill()
        }),
      )
      const half = new THREE.Group()
      const dome = new THREE.Mesh(keep(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), radishMat)
      dome.position.y = 1.1
      const cut = new THREE.Mesh(keep(new THREE.CircleGeometry(1.1, 32).rotateX(-Math.PI / 2)), keep(new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.3, clearcoat: 0.8 })))
      cut.position.y = 1.1
      half.add(dome, cut)
      half.scale.setScalar(0.95)
      half.position.set(9.4, 0, 4.2)
      herbs.add(half)
    }

    // Spring onions: a white bulb, long hollow green leaves.
    const bulbGeo = keep(new THREE.CylinderGeometry(0.42, 0.5, 3.2, 12).rotateZ(Math.PI / 2))
    const bulbMat = keep(new THREE.MeshPhysicalMaterial({ color: '#f1efe4', roughness: 0.35, clearcoat: 0.5 }))
    const greenGeo = keep(new THREE.CylinderGeometry(0.22, 0.32, 1, 10).rotateZ(Math.PI / 2).translate(0.5, 0, 0))
    const greenMat = keep(new THREE.MeshPhysicalMaterial({ color: '#2f7a2c', roughness: 0.4, clearcoat: 0.3 }))
    for (const [x, z, turn, length] of [[2.5, -5.6, 0.25, 15], [3.5, -4.4, 0.4, 13], [1.8, -6.6, 0.12, 14]] as const) {
      const g = new THREE.Group()
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.x = 1.6
      g.add(bulb)
      for (const [spread, l] of [[0.06, length], [-0.08, length * 0.85]] as const) {
        const leaf = new THREE.Mesh(greenGeo, greenMat)
        leaf.position.x = 3.1
        leaf.rotation.y = spread
        leaf.scale.set(l, 1, 1)
        g.add(leaf)
      }
      // Bulbs in the heap, the greens reaching away from the plate.
      g.rotation.y = turn
      g.position.set(x, 0.55, z)
      herbs.add(g)
    }
    herbs.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
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
