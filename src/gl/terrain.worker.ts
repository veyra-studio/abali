/** Bakes the Alborz terrain off the main thread: heights, sunlight, occlusion and the mesh. */
import { bakeOcclusion, bakeSunlight, heightfield, heightfieldMesh } from '@veyra/core'
import { SIZE, SUN_DIR, terrainHeight } from './alborz'

self.onmessage = (e: MessageEvent<{ quality: 'low' | 'medium' | 'high' }>) => {
  const { quality } = e.data
  const res = quality === 'high' ? 320 : quality === 'medium' ? 240 : 168
  const field = heightfield({ size: [SIZE, SIZE], resolution: res, height: terrainHeight })
  const sun = bakeSunlight(field, SUN_DIR, { steps: quality === 'low' ? 48 : 80, softness: 0.05 })
  const ao = bakeOcclusion(field, { directions: quality === 'low' ? 6 : 8, steps: 8, radius: 1600 })
  const segs = quality === 'high' ? 360 : quality === 'medium' ? 260 : 170
  const mesh = heightfieldMesh(field, {
    segments: [segs, segs],
    // Dense near the camera (high v), sparse toward the far range.
    layout: (u, v) => {
      const s = 1 - v
      const z = SIZE / 2 - SIZE * s ** 1.7
      const k = u * 2 - 1
      const x = Math.sign(k) * Math.abs(k) ** 1.35 * (SIZE / 2)
      return [x, z]
    },
    attributes: { aSun: sun, aOcclusion: ao },
  })
  const heights = field.heights
  const transfer = [heights.buffer, mesh.positions.buffer, mesh.normals.buffer, mesh.uvs.buffer, mesh.indices.buffer, ...Object.values(mesh.attributes).map((a) => a.buffer)]
  ;(self as unknown as Worker).postMessage({ heights, res, mesh }, transfer as Transferable[])
}
