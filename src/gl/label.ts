/**
 * The label artwork, redrawn from photographs of the real label: a paper
 * label on the bottle's conical shoulder — a darker blue border, a white
 * rule, a cerulean field, a golden oval with a thin dark outline, and
 * «دوغ آبعلی» in navy Nastaliq.
 *
 * The artwork is drawn in "seen" coordinates (arc length × outline length),
 * so the oval and the lettering keep their proportions on the cone while
 * the border follows the label's cut edges, which converge toward the neck.
 */
import { seededRandom } from '@veyra/core'
import { colors } from '../palette'

export interface LabelShape {
  /** Artwork aspect: width / height (physical). */
  aspect: number
  /** Half the label's width at `v` (0 bottom … 1 top), as a fraction of the full width. */
  halfWidthAt(v: number): number
}

/** Draws the label at `width` pixels wide. */
export function drawLabel(shape: LabelShape, width = 2048): HTMLCanvasElement {
  const height = Math.round(width / shape.aspect)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  const W = width
  const H = height
  // Edges of the label at a canvas row (canvas y runs down; v runs up).
  const edge = (y: number) => {
    const half = shape.halfWidthAt(1 - y / H) * W
    return [W / 2 - half, W / 2 + half] as const
  }
  /** The label's outline inset by `side` px from the cut edges and `tb` px from top and bottom. */
  const inset = (side: number, tb: number) => {
    const top = tb
    const bottom = H - tb
    const [tl, tr] = edge(top)
    const [bl, br] = edge(bottom)
    // Inset the slanted sides perpendicular to themselves.
    const slope = (bl - tl) / (bottom - top)
    const k = side * Math.sqrt(1 + slope * slope)
    ctx.beginPath()
    ctx.moveTo(tl + k, top)
    ctx.lineTo(tr - k, top)
    ctx.lineTo(br - k, bottom)
    ctx.lineTo(bl + k, bottom)
    ctx.closePath()
  }

  // Paper (the white shows only as a hairline at the cut edges).
  ctx.fillStyle = '#f3f5f2'
  ctx.fillRect(0, 0, W, H)
  // Border.
  const u = H / 100 // one percent of the label height
  ctx.fillStyle = colors.labelBorder
  inset(u * 0.35, u * 0.5)
  ctx.fill()
  // White rule.
  ctx.fillStyle = colors.labelRule
  inset(u * 2.2, u * 4.6)
  ctx.fill()
  // Field.
  ctx.fillStyle = colors.labelField
  inset(u * 4.1, u * 7.6)
  ctx.fill()

  // The oval, with a thin dark keyline.
  const cx = W / 2
  const cy = H * 0.5
  const rx = H * 0.565
  const ry = H * 0.36
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx + u * 0.9, ry + u * 0.9, 0, 0, Math.PI * 2)
  ctx.fillStyle = colors.labelKeyline
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  const oval = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, ry * 0.2, cx, cy, rx * 1.05)
  oval.addColorStop(0, colors.labelOvalLight)
  oval.addColorStop(1, colors.labelOval)
  ctx.fillStyle = oval
  ctx.fill()

  // «دوغ آبعلی» — Nastaliq, navy, filling the oval the way the real lettering does.
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = colors.labelInk
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const size = H * 0.42
  ctx.font = `700 ${size}px "Noto Nastaliq Urdu Variable", "Noto Nastaliq Urdu", serif`
  const text = 'دوغ آبعلی'
  const m = ctx.measureText(text)
  const ascent = m.actualBoundingBoxAscent || size * 0.9
  const descent = m.actualBoundingBoxDescent || size * 0.4
  // The real lettering is drawn taller than the typeface: stretch it upright.
  const stretch = 1.24
  const scale = Math.min((rx * 1.5) / Math.max(1, m.width), (ry * 1.62) / ((ascent + descent) * stretch))
  ctx.translate(cx, cy + ((ascent - descent) / 2) * scale * stretch)
  ctx.scale(scale, scale * stretch)
  ctx.fillText(text, 0, 0)
  ctx.restore()

  // Print and paper texture: faint grain, a little ink spread.
  const rand = seededRandom(7)
  ctx.globalAlpha = 0.05
  for (let i = 0; i < (W * H) / 260; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#0a2a55'
    const s = 1 + rand() * 1.6
    ctx.fillRect(rand() * W, rand() * H, s, s)
  }
  ctx.globalAlpha = 1
  return c
}
