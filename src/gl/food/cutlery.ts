/**
 * A spoon and a fork in brushed steel — Persian tables eat chelow kabab
 * with both. Units: centimetres; each lies on y = 0 along x, the working
 * end toward −x, the handle rising a little toward its end.
 */
import * as THREE from 'three'

const steel = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#d4d8dc',
    metalness: 1,
    roughness: 0.22,
    anisotropy: 0.5,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  })

/** A flat handle from the neck (x = 0, half-width w0) to its rounded end (half-width w1). */
function handle(length: number, w0: number, w1: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(0, -w0)
  s.bezierCurveTo(length * 0.35, -w0, length * 0.6, -w1, length - w1, -w1)
  s.quadraticCurveTo(length, -w1, length, 0)
  s.quadraticCurveTo(length, w1, length - w1, w1)
  s.bezierCurveTo(length * 0.6, w1, length * 0.35, w0, 0, w0)
  s.lineTo(0, -w0)
  return s
}

/** Extrudes a flat steel outline and tilts it up along its length (`rise(x)` is linear between neighbours). */
function sheet(shape: THREE.Shape, rise: (x: number) => number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 20 })
  geometry.rotateX(-Math.PI / 2)
  const pos = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + rise(pos.getX(i)))
  geometry.computeVertexNormals()
  return geometry
}

export function createSpoon(length = 19): { group: THREE.Group; dispose(): void } {
  const bowlL = 6.2
  const bowlW = 2.1
  const depth = 0.6
  const material = steel()
  // The bowl: half an egg, hollow side up, its back resting on the cloth.
  const bowlGeo = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  bowlGeo.scale(bowlL / 2, depth, bowlW)
  // Broader at the tip than at the neck.
  const bp = bowlGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i)
    bp.setZ(i, bp.getZ(i) * (1 - 0.18 * (x / (bowlL / 2))))
  }
  bowlGeo.computeVertexNormals()
  const bowl = new THREE.Mesh(bowlGeo, material)
  bowl.position.set(-bowlL / 2, depth + 0.04, 0)
  const neck = depth + 0.02
  const handleGeo = sheet(handle(length - bowlL + 0.4, 0.3, 0.62), (x) => neck - 0.1 + x * 0.045)
  const stem = new THREE.Mesh(handleGeo, material)
  stem.position.x = -0.4
  const group = new THREE.Group()
  group.add(bowl, stem)
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return {
    group,
    dispose() {
      bowlGeo.dispose()
      handleGeo.dispose()
      material.dispose()
    },
  }
}

export function createFork(length = 19): { group: THREE.Group; dispose(): void } {
  const headL = 6.6
  const headW = 1.3
  const tine = 0.36
  const gap = (headW * 2 - tine * 4) / 3
  const root = -2.9 // where the slots between the tines end
  const shape = new THREE.Shape()
  // From the neck, out to the shoulder, then the four tines in turn.
  shape.moveTo(0.4, -0.34)
  shape.bezierCurveTo(-1.0, -0.4, -1.8, -headW, -2.5, -headW)
  shape.lineTo(-headL + 0.15, -headW + 0.06)
  let z = -headW
  for (let i = 0; i < 4; i++) {
    const z1 = z + tine
    // Round the tip, come back along the tine to the slot, round the slot.
    shape.quadraticCurveTo(-headL - 0.08, z + tine / 2, -headL + 0.15, z1 - 0.03)
    if (i < 3) {
      shape.lineTo(root, z1)
      shape.quadraticCurveTo(root + 0.22, z1 + gap / 2, root, z1 + gap)
      shape.lineTo(-headL + 0.15, z1 + gap + 0.03)
    }
    z = z1 + gap
  }
  shape.lineTo(-2.5, headW)
  shape.bezierCurveTo(-1.8, headW, -1.0, 0.4, 0.4, 0.34)
  // The handle, continuing from the neck.
  const L = length - headL
  shape.bezierCurveTo(L * 0.35, 0.34, L * 0.6, 0.62, L - 0.62, 0.62)
  shape.quadraticCurveTo(L, 0.62, L, 0)
  shape.quadraticCurveTo(L, -0.62, L - 0.62, -0.62)
  shape.bezierCurveTo(L * 0.6, -0.62, L * 0.35, -0.34, 0.4, -0.34)
  // Tines curve up a little at the tips; the handle rises toward its end.
  const geometry = sheet(shape, (x) => 0.04 + (x < -3 ? (-3 - x) * 0.06 : 0) + Math.max(0, x) * 0.045)
  const material = steel()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  const group = new THREE.Group()
  group.add(mesh)
  return {
    group,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
