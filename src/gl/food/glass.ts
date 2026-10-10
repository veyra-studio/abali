/**
 * A tall glass of doogh, seen from above so it must read at a glance as a
 * drink, not a bowl: clear glass that shows the cloth through its walls, a
 * glossy surface with a ring of fine fizz at the edge, two floating ice
 * cubes (ray-traced, `createIceCube`), a sprig of fresh mint and a striped
 * paper straw leaning on the rim.
 * Units: centimetres; the glass stands on y = 0.
 */
import * as THREE from 'three'
import { seededRandom } from '@veyra/core'
import { createIceCube } from '../ice'

export function createDooghGlass(quality: 'low' | 'medium' | 'high'): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group()
  const disposables: Array<{ dispose(): void }> = []
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x)
  const seg = quality === 'low' ? 48 : 96
  const H = 12.5
  const rTop = 3.7
  const rBot = 3.05
  const wall = 0.24
  const base = 1.1
  const outline: THREE.Vector2[] = [
    new THREE.Vector2(0, 0.05),
    new THREE.Vector2(rBot - 0.3, 0),
    new THREE.Vector2(rBot, 0.28),
    new THREE.Vector2(rTop, H - 0.1),
    new THREE.Vector2(rTop - 0.05, H),
    new THREE.Vector2(rTop - wall, H - 0.05),
    new THREE.Vector2(rBot - wall + 0.05, base + 0.3),
    new THREE.Vector2(rBot - wall - 0.4, base),
    new THREE.Vector2(0, base - 0.05),
  ]
  const glassMat = keep(
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.03,
      transmission: 1,
      ior: 1.5,
      thickness: 0.5,
      attenuationColor: new THREE.Color('#dcebe2'),
      attenuationDistance: 30,
      specularIntensity: 1,
      envMapIntensity: 1.3,
    }),
  )
  const glass = new THREE.Mesh(keep(new THREE.LatheGeometry(outline, seg)), glassMat)
  glass.castShadow = true
  group.add(glass)

  // The doogh: a liquid, so glossy, with a slight meniscus at the wall.
  const level = H * 0.72
  const r = (y: number) => rBot - wall - 0.06 + ((rTop - rBot) * (y - base)) / (H - base)
  const doogh = new THREE.Mesh(
    keep(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, base + 0.02),
          new THREE.Vector2(r(base + 0.3), base + 0.05),
          new THREE.Vector2(r(level), level + 0.12),
          new THREE.Vector2(r(level) - 0.25, level + 0.02),
          new THREE.Vector2(r(level) * 0.6, level),
          new THREE.Vector2(0, level),
        ],
        seg,
      ),
    ),
    keep(new THREE.MeshPhysicalMaterial({ color: '#f5f4ef', roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color('#ffffff'), emissive: new THREE.Color('#222220') })),
  )
  doogh.receiveShadow = true
  group.add(doogh)

  const rand = seededRandom(9)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  const e = new THREE.Euler()

  // Fizz: a tight ring of tiny bubbles where the doogh meets the glass.
  const fizzCount = quality === 'low' ? 110 : 220
  const fizz = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(1, 1)), keep(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.1, clearcoat: 1, emissive: new THREE.Color('#3a3a38') })), fizzCount)
  for (let i = 0; i < fizzCount; i++) {
    const a = rand() * Math.PI * 2
    const d = r(level) - 0.08 - rand() ** 2 * 0.55
    const size = 0.035 + rand() ** 3 * 0.08
    p.set(Math.cos(a) * d, level + 0.06 + size * 0.4, Math.sin(a) * d)
    m.compose(p, q.identity(), s.setScalar(size))
    fizz.setMatrixAt(i, m)
  }
  group.add(fizz)

  // Two ice cubes afloat: the same ice as in the studio, here showing the
  // white doogh through itself — below the surface, or wherever a ray
  // heads down into it — and the room above.
  const mist = new THREE.Color('#fbf8f2')
  const dooghOutside = /* glsl */ `
uniform float iceSurface; // how far below the cube's center the doogh's surface lies (its own units)
uniform vec3 iceDoogh;
vec3 solidOutside(vec3 p, vec3 d) {
  float level = vSolidOrigin.y - iceSurface * length(vSolidBasis[1]);
  if (p.y < level || d.y < 0.0) return iceDoogh;
  return solidEnvironment(d, 0.0);
}
`
  for (const [i, [x, z, turn]] of ([[-1.1, 0.7, 0.4], [0.9, -0.9, 1.1]] as const).entries()) {
    const cube = createIceCube({
      size: 1.9,
      quality,
      seed: 3.7 + i * 5.1,
      cloud: 0.35,
      mist,
      outside: dooghOutside,
      uniforms: { iceSurface: { value: 0.35 }, iceDoogh: { value: new THREE.Color('#e9e6de').multiplyScalar(0.92) } },
    })
    disposables.push(cube)
    cube.mesh.position.set(x, level + 0.35, z)
    cube.mesh.rotation.set(0.12, turn, -0.1)
    group.add(cube.mesh)
  }

  // A sprig of fresh mint: a stem and four leaves.
  const leafShape = new THREE.Shape()
  leafShape.moveTo(0, 0)
  leafShape.bezierCurveTo(0.55, 0.25, 0.6, 1.1, 0, 1.7)
  leafShape.bezierCurveTo(-0.6, 1.1, -0.55, 0.25, 0, 0)
  const leafGeo = keep(new THREE.ShapeGeometry(leafShape, 8))
  leafGeo.rotateX(-Math.PI / 2)
  {
    // A crease down the middle, the edges lifted.
    const pos = leafGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.abs(pos.getX(i)) * 0.35)
    leafGeo.computeVertexNormals()
  }
  const leafMat = keep(new THREE.MeshStandardMaterial({ color: '#4a8a33', roughness: 0.55, side: THREE.DoubleSide }))
  const sprig = new THREE.Group()
  for (const [a, k] of [[0.3, 1], [2.1, 0.9], [3.6, 0.8], [5.0, 0.7]] as const) {
    const leaf = new THREE.Mesh(leafGeo, leafMat)
    leaf.scale.setScalar(k)
    leaf.rotation.set(0, a, 0)
    leaf.position.set(0, 0.05 + rand() * 0.1, 0)
    sprig.add(leaf)
  }
  sprig.position.set(0.9, level + 0.12, 1.1)
  group.add(sprig)

  // A striped paper straw leaning on the rim.
  const stripes = document.createElement('canvas')
  stripes.width = 16
  stripes.height = 128
  {
    const ctx = stripes.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 16, 128)
    ctx.fillStyle = '#2c8ed8'
    for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 16, 14)
  }
  const stripeTex = keep(new THREE.CanvasTexture(stripes))
  stripeTex.colorSpace = THREE.SRGBColorSpace
  stripeTex.wrapS = THREE.RepeatWrapping
  stripeTex.wrapT = THREE.RepeatWrapping
  stripeTex.repeat.set(1, 4)
  const strawLength = 20
  const strawR = 0.32
  const straw = new THREE.Mesh(keep(new THREE.CylinderGeometry(strawR, strawR, strawLength, 20, 1, true)), keep(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7, side: THREE.DoubleSide })))
  // As a straw sits in a glass: its foot on the bottom against one wall, the
  // straw leaning on the rim opposite, the rest rising out past the rim.
  const lean = new THREE.Vector3(-0.82, 0, -0.57).normalize()
  const foot = lean.clone().multiplyScalar(-(r(base + 0.3) - strawR - 0.15)).setY(base + strawR)
  const onRim = lean.clone().multiplyScalar(rTop - wall - strawR).setY(H + strawR * 0.8)
  const dir = onRim.clone().sub(foot).normalize()
  straw.position.copy(foot).addScaledVector(dir, strawLength / 2)
  straw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  straw.castShadow = true
  group.add(straw)

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
