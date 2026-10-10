/**
 * Capability detection that needs no renderer.
 */

let webgl2: boolean | null = null

/** True when a WebGL2 context can be created (checked once, then cached). */
export function supportsWebGL2(): boolean {
  if (webgl2 !== null) return webgl2
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    webgl2 = !!gl
    // Release the probe context right away.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl2 = false
  }
  return webgl2
}
