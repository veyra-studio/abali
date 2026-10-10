/**
 * three.js integration for Veyra stages (`@veyra/core/three`).
 *
 * - Renders on the stage's single frame loop, after scroll and scenes.
 * - Uses a "pixel camera": at `z = 0`, one world unit is one CSS pixel and
 *   the origin is the viewport center, so DOM layout maps directly into 3D.
 * - Follows the adaptive quality governor for pixel ratio.
 * - Anchors objects to DOM elements, and mirrors DOM text into textures so
 *   real, accessible HTML can be refracted, distorted or lit in WebGL.
 *
 * `three` is an optional peer dependency: only projects importing this
 * entry point need it.
 */
import * as THREE from 'three'
import { Phase, type Frame } from '../core/ticker.js'
import type { Stage, StagePlugin } from '../stage.js'
import { drawElementText } from '../text/draw.js'

export interface ThreeLayerOptions {
  /** Use an existing canvas. Otherwise a fixed, full-viewport canvas is created. */
  canvas?: HTMLCanvasElement
  /** Parent for the created canvas. Default `document.body`. */
  container?: HTMLElement
  /** CSS z-index of the created canvas. Default `0`. */
  zIndex?: number
  /** Vertical field of view in degrees. Default `35`. Narrow values flatten perspective (product shots). */
  fov?: number
  /** Near plane in CSS px. Default: 1/20 of the camera distance. Lower it for extreme close-ups. */
  near?: number
  /** Extra `WebGLRenderer` parameters. */
  renderer?: THREE.WebGLRendererParameters
  /** Render every frame automatically. Default `true`. */
  autoRender?: boolean
  /** Upper bound on pixel ratio, on top of the quality governor. Default `2`. */
  maxDpr?: number
  /** Called every frame before rendering. */
  onFrame?: (layer: ThreeLayer, frame: Readonly<Frame>) => void
}

export interface AnchorOptions {
  /** Scale the object to the element's box (for 1×1 geometry). Default `false`. */
  size?: boolean
  /** Re-measure every frame (inside sticky or transformed parents). Default `false`. */
  live?: boolean
  /** Anchor point inside the element, `0…1` from the top-left. Default `[0.5, 0.5]`. */
  origin?: [number, number]
  /** World z of the anchored object. Default: unchanged. */
  z?: number
  /** Hide the object while its element is this many px outside the viewport. Default `200`. */
  cullMargin?: number
}

/** Keeps a 3D object positioned (and optionally sized) over a DOM element. */
export class DomAnchor {
  /** Last computed viewport rect of the element. */
  readonly rect = { top: 0, left: 0, width: 0, height: 0 }
  private readonly release: () => void

  constructor(
    readonly el: Element,
    readonly object: THREE.Object3D,
    private readonly stage: Stage,
    private readonly options: AnchorOptions = {},
  ) {
    this.release = stage.rects.track(el, { live: options.live })
    if (options.z !== undefined) object.position.z = options.z
  }

  update(width: number, height: number): void {
    const r = this.stage.rects.view(this.el, this.stage.scrollY)
    this.rect.top = r.top
    this.rect.left = r.left
    this.rect.width = r.width
    this.rect.height = r.height
    const [ox, oy] = this.options.origin ?? [0.5, 0.5]
    this.object.position.x = r.left + r.width * ox - width / 2
    this.object.position.y = -(r.top + r.height * oy - height / 2)
    if (this.options.size) this.object.scale.set(r.width, r.height, this.object.scale.z)
    const margin = this.options.cullMargin ?? 200
    this.object.visible = r.bottom > -margin && r.top < height + margin
  }

  destroy(): void {
    this.release()
  }
}

export class ThreeLayer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly canvas: HTMLCanvasElement
  /** Viewport size in CSS pixels. */
  width = 1
  height = 1
  autoRender: boolean
  private readonly anchors = new Set<DomAnchor>()
  private readonly ownsCanvas: boolean
  private readonly cleanups: Array<() => void> = []
  private readonly maxDpr: number

  constructor(
    readonly stage: Stage,
    private readonly options: ThreeLayerOptions = {},
  ) {
    this.ownsCanvas = !options.canvas
    this.canvas = options.canvas ?? document.createElement('canvas')
    if (this.ownsCanvas) {
      this.canvas.setAttribute('aria-hidden', 'true')
      this.canvas.setAttribute('data-veyra-gl', '')
      Object.assign(this.canvas.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: String(options.zIndex ?? 0),
      })
      ;(options.container ?? document.body).append(this.canvas)
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      ...options.renderer,
    })
    this.maxDpr = options.maxDpr ?? 2
    this.autoRender = options.autoRender ?? true
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 35, 1, 1, 10000)

    this.resize()
    this.cleanups.push(stage.viewport.width.subscribe(() => this.resize()))
    this.cleanups.push(stage.viewport.height.subscribe(() => this.resize()))
    if (stage.quality) this.cleanups.push(stage.quality.dpr.subscribe(() => this.applyPixelRatio()))

    const onLost = (e: Event) => {
      e.preventDefault()
      this.autoRender = false
    }
    const onRestored = () => {
      this.autoRender = options.autoRender ?? true
    }
    this.canvas.addEventListener('webglcontextlost', onLost)
    this.canvas.addEventListener('webglcontextrestored', onRestored)
    this.cleanups.push(() => {
      this.canvas.removeEventListener('webglcontextlost', onLost)
      this.canvas.removeEventListener('webglcontextrestored', onRestored)
    })

    this.cleanups.push(
      stage.onFrame((frame) => {
        for (const a of this.anchors) a.update(this.width, this.height)
        options.onFrame?.(this, frame)
        if (this.autoRender) this.render()
      }, Phase.render),
    )
  }

  /** Distance from camera to the `z = 0` plane, where 1 unit = 1 CSS px. */
  get distance(): number {
    return this.camera.position.z
  }

  /** Positions `object` over `el` every frame. */
  anchor(el: Element | string, object: THREE.Object3D, options?: AnchorOptions): DomAnchor {
    const target = typeof el === 'string' ? document.querySelector(el) : el
    if (!target) throw new Error(`[veyra] anchor: no element for ${String(el)}`)
    const a = new DomAnchor(target, object, this.stage, options)
    this.anchors.add(a)
    const destroy = a.destroy.bind(a)
    a.destroy = () => {
      this.anchors.delete(a)
      destroy()
    }
    a.update(this.width, this.height)
    return a
  }

  /**
   * Mirrors an element's text into a plane anchored over it. The element
   * stays in the DOM for accessibility; hide it visually (e.g.
   * `color: transparent`) once the plane is visible.
   */
  mirrorText(el: HTMLElement, options: { material?: (texture: THREE.CanvasTexture) => THREE.Material; scale?: number; live?: boolean; z?: number } = {}): { mesh: THREE.Mesh; texture: THREE.CanvasTexture; refresh: () => void; destroy: () => void } {
    const drawn = drawElementText(el, { scale: options.scale ?? Math.min(2, window.devicePixelRatio || 1) })
    const texture = new THREE.CanvasTexture(drawn.canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const material = options.material?.(texture) ?? new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    mesh.userData.padding = drawn.padding
    this.scene.add(mesh)
    const anchor = this.anchor(el, mesh, { size: true, live: options.live, z: options.z })
    // Expand the plane by the canvas padding so glyph overhangs aren't clipped.
    const pad = drawn.padding
    const update = anchor.update.bind(anchor)
    anchor.update = (w, h) => {
      update(w, h)
      mesh.scale.x = anchor.rect.width + pad * 2
      mesh.scale.y = anchor.rect.height + pad * 2
    }
    const refresh = () => {
      drawElementText(el, { scale: options.scale ?? Math.min(2, window.devicePixelRatio || 1), canvas: drawn.canvas })
      texture.needsUpdate = true
    }
    return {
      mesh,
      texture,
      refresh,
      destroy: () => {
        anchor.destroy()
        this.scene.remove(mesh)
        mesh.geometry.dispose()
        material.dispose()
        texture.dispose()
      },
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  resize(): void {
    this.width = Math.max(1, this.stage.viewport.w)
    this.height = Math.max(1, this.stage.viewport.h)
    this.applyPixelRatio()
    this.renderer.setSize(this.width, this.height, false)
    const fov = THREE.MathUtils.degToRad(this.camera.fov)
    const dist = this.height / 2 / Math.tan(fov / 2)
    this.camera.aspect = this.width / this.height
    this.camera.position.set(0, 0, dist)
    this.camera.near = this.options.near ?? Math.max(1, dist / 20)
    this.camera.far = dist * 10
    this.camera.updateProjectionMatrix()
  }

  destroy(): void {
    for (const c of this.cleanups) c()
    for (const a of [...this.anchors]) a.destroy()
    this.renderer.dispose()
    if (this.ownsCanvas) this.canvas.remove()
  }

  private applyPixelRatio(): void {
    const device = window.devicePixelRatio || 1
    const governed = this.stage.quality?.dpr.value ?? device
    this.renderer.setPixelRatio(Math.min(device, governed, this.maxDpr))
  }
}

/** Stage plugin: `const gl = stage.use(threeLayer({ zIndex: -1 }))`. */
export function threeLayer(options?: ThreeLayerOptions): StagePlugin<ThreeLayer> {
  return (stage, onDestroy) => {
    const layer = new ThreeLayer(stage, options)
    onDestroy(() => layer.destroy())
    return layer
  }
}

export { supportsWebGL2 } from '../env/capabilities.js'
export { drawElementText, type DrawTextOptions } from '../text/draw.js'
