/**
 * A flat steel bottle opener — the plain kind restaurants keep by the
 * fridge, about 12 cm long with a head wider than the cap. Its opening
 * goes over the cap's edge: the far end rests on top of the cap, the lip
 * (the opening's edge on the handle side) hooks under the crimped skirt,
 * and lifting the handle pries the cap up.
 * Units: bottle units (21.6 cm). The lip sits at the origin; the handle
 * runs toward +x; the underside lies on y = 0.
 */
import * as THREE from 'three'

export interface Opener {
  group: THREE.Group
  dispose(): void
}

/** Length of the opening along the bar (lip to far edge). */
export const OPENER_HOLE = 0.125
/** Where the far end rests on the cap, measured from the lip toward the tip. */
export const OPENER_REST = 0.133

export function createOpener(): Opener {
  const W = 0.2 // width of the head (4.3 cm), wider than the cap
  const r = W / 2
  const head = -0.05 // center of the rounded head
  const end = 0.42 // the handle's end
  const shape = new THREE.Shape()
  shape.moveTo(head, -r)
  // The bar narrows a little from the head toward the handle.
  shape.bezierCurveTo(0.08, -r, 0.12, -r * 0.74, 0.2, -r * 0.72)
  shape.lineTo(end - r * 0.7, -r * 0.7)
  shape.quadraticCurveTo(end, -r * 0.7, end, 0)
  shape.quadraticCurveTo(end, r * 0.7, end - r * 0.7, r * 0.7)
  shape.lineTo(0.2, r * 0.72)
  shape.bezierCurveTo(0.12, r * 0.74, 0.08, r, head, r)
  shape.absarc(head, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false)
  // The opening: a straight lip at x = 0 with rounded corners, sides wide
  // enough for the cap's edge to come up through it, a round far end.
  const hole = new THREE.Path()
  const hw = 0.068
  const cr = 0.02
  const far = -OPENER_HOLE + hw // center of the round far end
  hole.moveTo(-cr, -hw)
  hole.absarc(-cr, -hw + cr, cr, -Math.PI / 2, 0, false)
  hole.lineTo(0, hw - cr)
  hole.absarc(-cr, hw - cr, cr, 0, Math.PI / 2, false)
  hole.lineTo(far, hw)
  hole.absarc(far, 0, hw, Math.PI / 2, (Math.PI * 3) / 2, false)
  hole.lineTo(-cr, -hw)
  shape.holes.push(hole)
  // A hanging hole at the end of the handle.
  const hang = new THREE.Path()
  hang.absarc(end - 0.06, 0, 0.02, 0, Math.PI * 2, true)
  shape.holes.push(hang)

  const thick = 0.009 // 2 mm of steel
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thick - 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0025,
    bevelSegments: 3,
    curveSegments: 32,
  })
  // Lie flat, face up, with the underside on y = 0.
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  geometry.translate(0, -geometry.boundingBox!.min.y, 0)
  // Brushed stainless steel.
  const material = new THREE.MeshPhysicalMaterial({
    color: '#cfd4da',
    metalness: 1,
    // Brushed and a little dull: reflections stay soft as it moves.
    roughness: 0.38,
    anisotropy: 0.7,
    anisotropyRotation: Math.PI / 2,
    envMapIntensity: 1.6,
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
