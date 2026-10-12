/**
 * The WebGL side of the film. One renderer, three worlds, one veil:
 * - studio: the bottle on black acrylic (hero, تق, پیس, finale), placed in
 *   CSS pixels through the layer's pixel camera;
 * - landscape: Abali's mountains in snow (آخیش), built when first needed;
 * - table: the sofreh, seen from above (سفره), built when first needed;
 * - veil: foam, mist and dark fades drawn over whichever world is showing.
 * Chapters choose the world and write state; this module renders.
 */
import * as THREE from 'three'
import { Phase, type Stage } from '@veyra/core'
import { threeLayer, warmUp, type ThreeLayer } from '@veyra/core/three'
import type { Landscape } from './landscape'
import { createStudio, type Quality, type Studio } from './studio'
import type { Table } from './table'
import { createVeil, type Veil } from './veil'

export type World = 'studio' | 'landscape' | 'table' | 'none'

export interface Experience {
  layer: ThreeLayer
  studio: Studio
  veil: Veil
  /** The world drawn this frame. */
  world: World
  /**
   * CSS px the studio's picture is lifted, as if it were printed on the page:
   * a lens shift, so scrolling past the finale moves it without changing
   * perspective (the floor never tips past eye level).
   */
  shift: number
  landscape: Landscape | null
  table: Table | null
  /** Builds the landscape and the table (lazy chunks). Safe to call repeatedly. */
  prepare(which: 'landscape' | 'table'): Promise<void>
  /** What is under a point of the screen (CSS px) in the studio: the bottle, an ice cube, or nothing. */
  pick(x: number, y: number): ReturnType<Studio['pick']>
  dispose(): void
}

export function createExperience(stage: Stage): Experience {
  // three.js's milky fill behind transmissive glass is kept on purpose: it
  // gives the cold bottle its frosted white look (the ice doesn't use
  // transmission, so it isn't affected). The canvas keeps the large
  // viewport's height: a phone's address bar sliding in and out doesn't
  // resize it (chapters place things with `layer.height`).
  const layer = stage.use(threeLayer({ fov: 15, zIndex: 1, maxDpr: 2, near: 2, autoRender: false, stableHeight: true, renderer: { antialias: stage.quality?.tier.value !== 'low' } }))
  // Read the tier after the layer: on a software renderer it starts low.
  const tier: Quality = stage.quality?.tier.value ?? 'medium'
  const { renderer, scene, camera } = layer
  // Reading back every program's compile log waits for the driver: only
  // in development and in captures (where the checks look for errors).
  renderer.debug.checkShaderErrors = import.meta.env.DEV || new URLSearchParams(location.search).has('capture')
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  // The bottle's glass is frosted: it reads its transmission from blurred
  // levels, so a half-size target looks the same at a quarter of the cost.
  const transmission = (t: Quality) => (t === 'high' ? 0.6 : 0.5)
  renderer.transmissionResolutionScale = transmission(tier)
  const studio = createStudio(renderer, scene, tier)
  // Every world follows the tier as it changes, not only when it is built.
  stage.quality?.tier.subscribe((t) => {
    renderer.transmissionResolutionScale = transmission(t)
    studio.setQuality(t)
    exp.landscape?.setQuality(t)
    exp.table?.setQuality(t)
  })
  const veil = createVeil()

  // A lost WebGL context (phones take the GPU back from pages in the
  // background): when it returns, what was rendered on the GPU — the
  // studio's and the table's light — is rendered again and the shadows are
  // redrawn. If it doesn't come back soon, the drawn fallback stands in.
  layer.onRestore(() => {
    studio.restore(renderer)
    exp.table?.restore(renderer)
  })
  let fallbackTimer = 0
  let fellBack = false
  layer.lost.subscribe((lost) => {
    window.clearTimeout(fallbackTimer)
    const html = document.documentElement
    if (lost) {
      fallbackTimer = window.setTimeout(() => {
        fellBack = true
        html.classList.add('no-webgl')
      }, 3000)
    } else if (fellBack) {
      fellBack = false
      html.classList.remove('no-webgl')
    }
  })

  const pending = new Map<string, Promise<void>>()
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const exp: Experience = {
    layer,
    studio,
    veil,
    world: 'studio',
    shift: 0,
    landscape: null,
    table: null,
    prepare(which) {
      let p = pending.get(which)
      if (!p) {
        // Built and warmed up (programs compiled, textures uploaded, shadows
        // drawn) ahead of time, so the first frame showing it doesn't stall.
        p =
          which === 'landscape'
            ? import('./landscape').then(async ({ createLandscape }) => {
                const landscape = await createLandscape(renderer, stage.quality?.tier.value ?? tier)
                await warmUp(renderer, landscape.scene, landscape.camera)
                exp.landscape = landscape
              })
            : import('./table').then(async ({ createTable }) => {
                const table = await createTable(renderer, stage.quality?.tier.value ?? tier)
                await warmUp(renderer, table.scene, table.camera)
                exp.table = table
              })
        // Building a world is slow on purpose: the quality governor waits
        // (a capable device must not lose its tier to it).
        stage.quality?.hold(p)
        pending.set(which, p)
      }
      return p
    },
    pick(x, y) {
      if (exp.world !== 'studio') return null
      ndc.set((x / layer.width) * 2 - 1, -(y / layer.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return studio.pick(raycaster.ray)
    },
    dispose() {
      studio.dispose()
      veil.dispose()
      exp.landscape?.dispose()
      exp.table?.dispose()
      layer.destroy()
    },
  }

  stage.onFrame((frame) => {
    const dt = frame.delta
    const time = frame.time
    const reduced = stage.reducedMotion.value
    veil.uniforms.uTime.value = time
    veil.uniforms.uRes.value.set(layer.width, layer.height)

    let world = exp.world
    if (world === 'landscape' && !exp.landscape) world = 'none'
    if (world === 'table' && !exp.table) world = 'none'
    const drawing = world !== 'none' || veil.active
    layer.canvas.style.visibility = drawing ? 'visible' : 'hidden'
    if (!drawing) return

    renderer.autoClear = true
    if (world === 'studio') {
      if (exp.shift !== 0) camera.setViewOffset(layer.width, layer.height, 0, exp.shift, layer.width, layer.height)
      else if (camera.view?.enabled) camera.clearViewOffset()
      studio.update(dt, time, stage.pointer, reduced)
      studio.prepare(renderer, camera)
      renderer.render(scene, camera)
    } else if (world === 'landscape') {
      exp.landscape!.update(dt, time, layer.width, layer.height, reduced, stage.pointer)
      renderer.render(exp.landscape!.scene, exp.landscape!.camera)
    } else if (world === 'table') {
      exp.table!.update(dt, time, layer.width, layer.height, reduced)
      renderer.render(exp.table!.scene, exp.table!.camera)
    } else {
      renderer.clear()
    }
    if (veil.active) {
      renderer.autoClear = false
      renderer.render(veil.scene, veil.camera)
      renderer.autoClear = true
    }
  }, Phase.render + 1)

  return exp
}
