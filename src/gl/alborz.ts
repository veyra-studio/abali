/**
 * The shape of the Alborz scene: a valley that meanders up toward a lone
 * volcanic cone, eroded massifs on both sides. Shared by the terrain worker
 * (which bakes it) and the landscape (whose camera follows the valley).
 * Units: metres.
 */
import { erodedNoise, ridgedNoise, smoothstep } from '@veyra/core'

export const SIZE = 26000
/** A low morning sun from the east, a little in front: long shadows, warm faces, alpenglow on the cone. */
export const SUN_DIR: readonly [number, number, number] = [0.74, 0.24, 0.28]
export const CONE = { x: 1800, z: -9800, radius: 7400, height: 5200 }

/** Valley floor follows a gentle meander up the z axis. */
export const valleyX = (z: number) => Math.sin(z / 5200) * 900 + Math.sin(z / 2300 + 1.3) * 260

export function terrainHeight(x: number, z: number): number {
  const across = Math.abs(x - valleyX(z))
  // Eroded massifs: ridges, spurs and gullies from noise with derivatives.
  const massif = erodedNoise(x / 3400 + 4.1, z / 3400 - 2.7, { octaves: 10, seed: 3, sharpness: 1.4 })
  let h = massif * 2900
  // Crests sharpen where the mountains are high.
  h += ridgedNoise(x / 1500 + 7, z / 1500 - 3, { octaves: 6, seed: 9 }) * 520 * smoothstep(0.35, 0.7, massif)
  // The valley carves through: a flat-ish floor, walls rising to the ridges.
  const carve = smoothstep(180, 3200, across)
  h = h * (0.22 + 0.78 * carve) + carve * 600
  // The valley floor: drifts and hummocks under the snow.
  h += erodedNoise(x / 420, z / 420, { octaves: 5, seed: 21 }) * 70 * (1 - carve * 0.6)
  // The cone: a stratovolcano with radial gullies and a shallow crater.
  const dx = x - CONE.x
  const dz = z - CONE.z
  const r = Math.hypot(dx, dz) / CONE.radius
  if (r < 1) {
    const a = Math.atan2(dz, dx)
    // Gullies run down the flanks unevenly: noise around the cone, not a comb.
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const gullies = 1 + (ridgedNoise(ca * 6 + 3, sa * 6 + r * 2.5, { octaves: 4, seed: 31 }) - 0.5) * 0.09 * r
    const cone = (1 - r) ** 1.22 * CONE.height * gullies
    const crater = Math.exp(-((r / 0.035) ** 2)) * 70
    h = Math.max(h, cone - crater + erodedNoise(x / 900, z / 900, { octaves: 5, seed: 12 }) * 160 * r)
  }
  return h
}

