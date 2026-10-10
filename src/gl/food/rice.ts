/**
 * Chelow: a mound of long-grain rice, every grain an instance, crowned with
 * saffron rice and a pat of butter. Units: centimetres; the mound sits on
 * y = 0 at the origin.
 */
import * as THREE from 'three'
import { seededRandom } from '@veyra/core'

export interface Rice {
  group: THREE.Group
  dispose(): void
}

export function createRice(options: { quality: 'low' | 'medium' | 'high'; radius?: number; height?: number }): Rice {
  const R = options.radius ?? 8.6
  const H = options.height ?? 4.6
  const count = options.quality === 'low' ? 1800 : options.quality === 'medium' ? 3400 : 5600
  const rand = seededRandom(23)
  // Dome: a soft heap, slightly lopsided where the spoon shaped it.
  const dome = (x: number, z: number) => {
    const r = Math.hypot(x / R, (z / R) * 1.08)
    if (r >= 1) return 0
    return H * (1 - r * r) ** 0.85 * (1 + 0.06 * Math.sin(Math.atan2(z, x) * 3))
  }
  const grain = new THREE.CapsuleGeometry(0.11, 0.72, 3, 6)
  grain.rotateZ(Math.PI / 2) // long axis along x
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.4,
    metalness: 0,
    // Rice is translucent: a little self-light keeps the shadowed grains from going grey.
    emissive: new THREE.Color('#4a463d'),
    envMapIntensity: 0.8,
  })
  const mesh = new THREE.InstancedMesh(grain, material, count)
  mesh.castShadow = true
  mesh.receiveShadow = true
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3(1, 1, 1)
  const white = new THREE.Color('#f7f3e8')
  const saffron = new THREE.Color('#f3a20e')
  const pale = new THREE.Color('#f8d37a')
  const col = new THREE.Color()
  const twist = new THREE.Quaternion()
  const yAxis = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    // Uniform over the disc, a little denser toward the top.
    const a = rand() * Math.PI * 2
    const d = Math.sqrt(rand()) * R * 1.02
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d * 0.93
    const h = dome(x, z) - rand() * 0.35
    p.set(x, Math.max(0.05, h), z)
    // Normal of the dome by finite differences.
    const e = 0.2
    up.set(dome(x - e, z) - dome(x + e, z), 2 * e, dome(x, z - e) - dome(x, z + e)).normalize()
    q.setFromUnitVectors(yAxis, up)
    twist.setFromAxisAngle(yAxis, rand() * Math.PI * 2)
    q.multiply(twist)
    // A little disorder: grains don't lie flat.
    twist.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (rand() - 0.5) * 0.7)
    q.multiply(twist)
    const len = 0.85 + rand() * 0.3
    s.set(len, 1, 1)
    m.compose(p, q, s)
    mesh.setMatrixAt(i, m)
    // Saffron on the crown, mixed with white at the edge of the stain.
    const crown = Math.hypot(x + R * 0.12, z - R * 0.1) / (R * 0.42)
    const stained = crown < 1 && rand() < 0.95 - crown * 0.75
    col.copy(stained ? (rand() < 0.65 ? saffron : pale) : white)
    col.offsetHSL(0, 0, (rand() - 0.5) * 0.04)
    mesh.setColorAt(i, col)
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  // A pat of butter, softening on the hot rice.
  const butterGeo = new THREE.BoxGeometry(2.2, 1.0, 1.9, 6, 3, 6)
  const bp = butterGeo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < bp.count; i++) {
    v.fromBufferAttribute(bp, i)
    const sag = v.y > 0 ? 0.18 * (Math.abs(v.x) / 1.1 + Math.abs(v.z) / 0.95) : 0
    bp.setXYZ(i, v.x * (1 + (v.y < 0 ? 0.08 : 0)), v.y - sag, v.z * (1 + (v.y < 0 ? 0.08 : 0)))
  }
  butterGeo.computeVertexNormals()
  const butterMat = new THREE.MeshPhysicalMaterial({ color: '#f6dc86', roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: new THREE.Color('#3a2e10') })
  const butter = new THREE.Mesh(butterGeo, butterMat)
  butter.position.set(-R * 0.08, H + 0.15, R * 0.05)
  butter.rotation.set(0.08, 0.5, -0.05)
  butter.castShadow = true

  const group = new THREE.Group()
  group.add(mesh, butter)
  return {
    group,
    dispose() {
      grain.dispose()
      material.dispose()
      butterGeo.dispose()
      butterMat.dispose()
    },
  }
}
