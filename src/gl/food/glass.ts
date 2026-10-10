/**
 * A plain tumbler of doogh: a heavy-bottomed glass, the doogh a little
 * foamy at the rim, a pinch of dried mint on top. Units: centimetres.
 */
import * as THREE from 'three'
import { seededRandom } from '@veyra/core'

export function createDooghGlass(quality: 'low' | 'medium' | 'high'): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group()
  const H = 10.5
  const rTop = 3.9
  const rBot = 3.2
  const wall = 0.22
  const base = 0.9
  const outline: THREE.Vector2[] = [
    new THREE.Vector2(0, 0.05),
    new THREE.Vector2(rBot - 0.3, 0),
    new THREE.Vector2(rBot, 0.25),
    new THREE.Vector2(rTop, H - 0.1),
    new THREE.Vector2(rTop - 0.04, H),
    new THREE.Vector2(rTop - wall, H - 0.05),
    new THREE.Vector2(rBot - wall + 0.05, base + 0.3),
    new THREE.Vector2(rBot - wall - 0.4, base),
    new THREE.Vector2(0, base - 0.05),
  ]
  const glassGeo = new THREE.LatheGeometry(outline, quality === 'low' ? 48 : 96)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.03,
    transmission: 1,
    ior: 1.5,
    thickness: 0.4,
    attenuationColor: new THREE.Color('#dcebe2'),
    attenuationDistance: 30,
    envMapIntensity: 1.2,
  })
  const glass = new THREE.Mesh(glassGeo, glassMat)
  glass.castShadow = true
  group.add(glass)

  const level = H * 0.82
  const r = (y: number) => rBot - wall - 0.06 + ((rTop - rBot) * (y - base)) / (H - base)
  const doogh = new THREE.Mesh(
    new THREE.LatheGeometry(
      [new THREE.Vector2(0, base + 0.02), new THREE.Vector2(r(base + 0.3), base + 0.05), new THREE.Vector2(r(level), level), new THREE.Vector2(r(level) * 0.96, level + 0.12), new THREE.Vector2(0, level + 0.1)],
      quality === 'low' ? 48 : 96,
    ),
    new THREE.MeshPhysicalMaterial({ color: '#f6f6f1', roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ffffff'), emissive: new THREE.Color('#262624') }),
  )
  group.add(doogh)

  // Foam at the rim and dried mint on the surface.
  const rand = seededRandom(9)
  const bubbleGeo = new THREE.IcosahedronGeometry(1, 1)
  const bubbles = new THREE.InstancedMesh(bubbleGeo, new THREE.MeshPhysicalMaterial({ color: '#fbfbf8', roughness: 0.15, clearcoat: 1, emissive: new THREE.Color('#303030') }), 90)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2
    const d = r(level) * (0.82 + rand() * 0.16)
    const size = 0.06 + rand() ** 2 * 0.16
    p.set(Math.cos(a) * d, level + 0.1 + size * 0.5, Math.sin(a) * d)
    m.compose(p, q, s.setScalar(size))
    bubbles.setMatrixAt(i, m)
  }
  group.add(bubbles)
  const mintGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const mint = new THREE.InstancedMesh(mintGeo, new THREE.MeshStandardMaterial({ color: '#3d5a2a', roughness: 0.9, side: THREE.DoubleSide }), 70)
  const e = new THREE.Euler()
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2
    const d = Math.sqrt(rand()) * r(level) * 0.6
    p.set(Math.cos(a) * d + 0.4, level + 0.13, Math.sin(a) * d - 0.3)
    e.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4)
    q.setFromEuler(e)
    m.compose(p, q, s.set(0.1 + rand() * 0.18, 1, 0.06 + rand() * 0.12))
    mint.setMatrixAt(i, m)
  }
  group.add(mint)
  return {
    group,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
    },
  }
}
