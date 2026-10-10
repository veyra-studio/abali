/**
 * A compact diagnostics panel: frame-time graph, FPS, quality, scroll and a
 * scroll map showing every scene's range against the viewport. Enable with
 * `createStage({ debug: true })` or by adding `?debug` to the URL.
 */
import type { Frame } from '../core/ticker.js'
import type { QualityGovernor } from '../quality/governor.js'
import type { Scene } from '../scene/scene.js'
import type { ScrollController } from '../scroll/scroll.js'

export interface DebugSources {
  scroll: () => ScrollController | null
  quality: () => QualityGovernor | null
  scenes: () => Iterable<Scene>
  viewportHeight: () => number
}

const GRAPH_W = 140
const GRAPH_H = 34
const MAP_W = 26
const MAP_H = 120

export class DebugOverlay {
  readonly el: HTMLElement
  private readonly graph: HTMLCanvasElement
  private readonly map: HTMLCanvasElement
  private readonly text: HTMLElement
  private readonly history = new Float32Array(GRAPH_W)
  private head = 0
  private frameCount = 0

  constructor(private readonly sources: DebugSources) {
    this.el = document.createElement('div')
    this.el.setAttribute('data-veyra-debug', '')
    this.el.setAttribute('aria-hidden', 'true')
    this.el.setAttribute(
      'style',
      'position:fixed;left:12px;bottom:12px;z-index:2147483647;display:flex;gap:8px;padding:8px;' +
        'background:rgba(10,10,12,.82);color:#e8e6df;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;' +
        'border:1px solid rgba(255,255,255,.12);border-radius:6px;pointer-events:none;direction:ltr;backdrop-filter:blur(6px)',
    )
    const col = document.createElement('div')
    this.graph = document.createElement('canvas')
    this.map = document.createElement('canvas')
    for (const [c, w, h] of [[this.graph, GRAPH_W, GRAPH_H], [this.map, MAP_W, MAP_H]] as const) {
      c.width = w * 2
      c.height = h * 2
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      c.style.display = 'block'
    }
    this.text = document.createElement('div')
    this.text.style.whiteSpace = 'pre'
    this.text.style.marginTop = '6px'
    col.append(this.graph, this.text)
    this.el.append(col, this.map)
    document.body.append(this.el)
  }

  update(frame: Readonly<Frame>): void {
    this.history[this.head] = frame.rawDelta * 1000
    this.head = (this.head + 1) % GRAPH_W
    // Text and map at ~10 Hz; the graph every frame.
    this.drawGraph()
    if (++this.frameCount % 6 !== 0) return
    const scroll = this.sources.scroll()
    const quality = this.sources.quality()
    const scenes = [...this.sources.scenes()]
    const active = scenes.filter((s) => s.active).length
    const fps = frame.rawDelta > 0 ? Math.round(1 / Math.max(frame.rawDelta, 1e-3)) : 0
    const lines = [
      `fps ${String(fps).padStart(3)}  ${(frame.rawDelta * 1000).toFixed(1)}ms`,
      quality ? `q ${quality.level.value.toFixed(2)} ${quality.tier.value}  dpr ${quality.dpr.value}  ${quality.refreshRate}Hz` : 'q —',
      scroll ? `y ${Math.round(scroll.y)}/${Math.round(scroll.limit)}  v ${Math.round(scroll.velocity)}${scroll.smooth ? '  smooth' : ''}` : 'scroll native',
      `scenes ${active}/${scenes.length} active`,
    ]
    this.text.textContent = lines.join('\n')
    this.drawMap(scroll, scenes)
  }

  destroy(): void {
    this.el.remove()
  }

  private drawGraph(): void {
    const ctx = this.graph.getContext('2d')
    if (!ctx) return
    const w = this.graph.width
    const h = this.graph.height
    ctx.clearRect(0, 0, w, h)
    const scale = h / 50 // 50 ms full height
    // 60 fps and 30 fps guides.
    ctx.fillStyle = 'rgba(255,255,255,.12)'
    ctx.fillRect(0, h - 16.7 * scale, w, 1)
    ctx.fillRect(0, h - 33.3 * scale, w, 1)
    for (let i = 0; i < GRAPH_W; i++) {
      const ms = this.history[(this.head + i) % GRAPH_W]!
      const bar = Math.min(h, ms * scale)
      ctx.fillStyle = ms > 33.4 ? '#ff5a4e' : ms > 17.5 ? '#ffc94a' : '#7ee0a1'
      ctx.fillRect(i * 2, h - bar, 2, bar)
    }
  }

  private drawMap(scroll: ScrollController | null, scenes: Scene[]): void {
    const ctx = this.map.getContext('2d')
    if (!ctx) return
    const w = this.map.width
    const h = this.map.height
    ctx.clearRect(0, 0, w, h)
    const limit = scroll?.limit ?? Math.max(0, document.documentElement.scrollHeight - innerHeight)
    const vh = this.sources.viewportHeight()
    const total = limit + vh
    if (total <= 0) return
    const y = scroll?.y ?? window.scrollY
    ctx.fillStyle = 'rgba(255,255,255,.08)'
    ctx.fillRect(0, 0, w, h)
    scenes.forEach((s, i) => {
      const top = (Math.max(0, s.start) / total) * h
      const bottom = (Math.max(0, s.end) / total) * h
      ctx.fillStyle = s.inRange ? 'rgba(126,224,161,.85)' : 'rgba(126,180,224,.45)'
      const lane = (i % 3) * (w / 3)
      ctx.fillRect(lane + 2, top, w / 3 - 4, Math.max(2, bottom - top))
    })
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(1, (y / total) * h, w - 2, Math.max(4, (vh / total) * h))
  }
}

/** True when the URL asks for debugging (`?debug` or `#debug`). */
export function debugRequested(): boolean {
  if (typeof location === 'undefined') return false
  return new URLSearchParams(location.search).has('debug') || location.hash === '#debug'
}
