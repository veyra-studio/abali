/**
 * A product-photography lighting environment: a dark studio with two tall
 * strip softboxes behind the subject (the long rim highlights on glass),
 * a key softbox above, and a faint fill. Baked once into a PMREM map.
 */
import * as THREE from 'three'

export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#040507')
  const geo = new THREE.PlaneGeometry(1, 1)
  const box = (w: number, h: number, intensity: number, position: [number, number, number], tint = '#ffffff') => {
    const color = new THREE.Color(tint).multiplyScalar(intensity)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
    mesh.scale.set(w, h, 1)
    mesh.position.set(...position)
    mesh.lookAt(0, position[1] * 0.3, 0)
    scene.add(mesh)
  }
  // Rim strips, slightly behind the bottle.
  box(0.9, 9, 9, [-4.2, 0.5, -2.6])
  box(0.9, 9, 9, [4.2, 0.5, -2.6])
  // Key: a large softbox above, in front, on the reading side (right).
  box(5, 3, 4, [2.6, 4.5, 3.4], '#fff6ea')
  // Cool fill from the left.
  box(3, 4, 0.7, [-4.5, 0.6, 3.8], '#dbe9ff')
  // A thin top bar for the cap and shoulder.
  box(6, 0.5, 3, [0, 6, 0])
  // Floor bounce.
  box(8, 8, 0.12, [0, -4, 0], '#9fb6d6')

  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(scene, 0.015)
  pmrem.dispose()
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose()
  })
  geo.dispose()
  return target.texture
}
