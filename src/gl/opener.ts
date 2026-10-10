/**
 * A flat steel bottle opener — the plain kind restaurants keep by the
 * fridge: a bar with a rounded head and an opening whose lip hooks under
 * the crown cap. Units: bottle units; the opening's lip sits at the origin.
 */
import * as THREE from 'three'

export interface Opener {
  group: THREE.Group
  dispose(): void
}

export function createOpener(): Opener {
  const L = 0.62 // overall length
  const W = 0.145 // width of the head
  const shape = new THREE.Shape()
  // Outline: rounded head around the origin, a bar toward +x tapering slightly.
  const r = W / 2
  shape.moveTo(-r * 0.2, -r)
  shape.lineTo(L - r * 0.6, -r * 0.78)
  shape.quadraticCurveTo(L, -r * 0.78, L, 0)
  shape.quadraticCurveTo(L, r * 0.78, L - r * 0.6, r * 0.78)
  shape.lineTo(-r * 0.2, r)
  shape.absarc(-r * 0.2, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false)
  // The opening: a rounded slot whose near edge is the lip.
  const hole = new THREE.Path()
  const x0 = -0.035
  const x1 = 0.005
  const hh = 0.028
  hole.moveTo(x0, -hh)
  hole.lineTo(x1, -hh)
  hole.absarc(x1, 0, hh, -Math.PI / 2, Math.PI / 2, false)
  hole.lineTo(x0, hh)
  hole.absarc(x0, 0, hh, Math.PI / 2, (Math.PI * 3) / 2, false)
  shape.holes.push(hole)
  // A hanging hole at the end of the bar.
  const hang = new THREE.Path()
  hang.absarc(L - 0.075, 0, 0.022, 0, Math.PI * 2, true)
  shape.holes.push(hang)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0035,
    bevelSegments: 3,
    curveSegments: 32,
  })
  geometry.translate(0, 0, -0.004)
  // Lie flat: the bar in the XZ plane, its face up.
  geometry.rotateX(-Math.PI / 2)
  // Brushed stainless steel.
  const material = new THREE.MeshPhysicalMaterial({
    color: '#d5d9de',
    metalness: 1,
    roughness: 0.3,
    anisotropy: 0.8,
    anisotropyRotation: Math.PI / 2,
    envMapIntensity: 1.7,
  })
  const mesh = new THREE.Mesh(geometry, material)
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
