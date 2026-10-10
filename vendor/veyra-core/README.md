# Veyra Core

**A creative web experience engine.** Veyra is the runtime foundation behind ambitious, art-directed websites — immersive campaigns, interactive brand worlds, scroll-driven storytelling — built by [Veyra Studio](https://veyra-studio.github.io/).

It is not a site builder or a component kit. It owns the hard, reusable parts of creative development — time, scroll, motion, layout measurement, typography, rendering quality — and leaves art direction entirely to the project.

```ts
import { createStage, scenePresets, splitText } from '@veyra/core'

const stage = createStage()                       // one loop, smooth native scroll

const title = splitText('h1', { type: 'chars' })   // Persian-safe letter splitting
stage.timeline()
  .fromTo(title.chars, { y: '0.6em', opacity: 0 }, { y: '0em', opacity: 1 }, { stagger: 0.03 })
  .play()

stage.scene('#story', {                           // scroll → progress
  ...scenePresets.pinned,                         // pinned with CSS sticky
  onProgress: (p) => (mesh.rotation.y = p * Math.PI * 2),  // e.g. a three.js mesh
})
```

Live showcase: **[Abali](https://veyra-studio.github.io/abali/)** — a Persian, RTL campaign concept built on this engine.

---

## What's inside

| Module | What it does |
| --- | --- |
| **Ticker** | One `requestAnimationFrame` loop with ordered phases (input → scroll → measure → update → render → post). Pauses when hidden, clamps stalls, survives a throwing callback. |
| **Motion** | Seekable timelines (`to` / `from` / `fromTo` / `call` / labels / stagger), tweens for numbers, colors, CSS strings and transforms; analytic springs; easing library incl. `cubicBezier`. |
| **Scroll** | Smooth wheel scrolling on top of **native** scroll — sticky, scrollbar, keyboard, find-in-page, anchors and assistive tech keep working. Native on touch and under reduced motion. Anchor links scroll smoothly and move focus. |
| **Scenes** | Map scroll position to progress with anchors like `"top bottom"`, enter/leave callbacks, CSS-variable output, timeline scrubbing, smoothing and visibility culling. Pinning uses CSS `position: sticky`. |
| **Layout cache** | Element rects measured once, viewport positions derived from scroll — no per-frame layout reads (with an opt-in live mode for sticky contexts). |
| **Type** | Script-aware `splitText`: Arabic-script letters (Persian, Arabic, Urdu…) **keep their joined forms** when split, lam-alef stays whole, mixed-direction runs keep their order, screen readers get the text once. |
| **Quality** | Adaptive governor: detects refresh rate, measures real frame times, steps quality and pixel ratio down under load and back up with headroom. |
| **Assets** | Weighted preloader for images, fonts, fetches and any promise; failures never block the experience. |
| **Sound** | Optional audio bus: off by default, persisted per visitor, gesture-unlocked, muted when the tab is hidden, noise generator for synthesized sound design. |
| **Debug** | `?debug` overlay: frame-time graph, FPS, quality, scroll, and a scroll map of every scene's range. |
| **three.js** *(optional)* | `@veyra/core/three`: renderer on the stage loop, pixel-perfect camera (1 unit = 1 CSS px), DOM-anchored objects, and DOM text mirrored into textures with the browser's own line breaks. |
| **Utilities** | `drawElementText` (real HTML text into a canvas, for Canvas2D/WebGL effects), `supportsWebGL2`, `toPersianDigits`, `inlineSign` and the math helpers (`range`, `damp`, `mapRange`, …). |

Zero runtime dependencies. Everything in the core is ~19 KB min+gzip, and projects ship only what they import (the scroll-scenes example's engine chunk is ~13 KB). three.js is an optional peer dependency used only through the `/three` entry point.

## Install

Veyra is not on npm yet. Projects vendor the packed release (see [docs/integration.md](docs/integration.md)):

```bash
npm run release:pack                        # in veyra-core → release/veyra-core-0.1.0.tgz
# in a project:
mkdir -p vendor/veyra-core && tar -xzf ../veyra-core/release/veyra-core-0.1.0.tgz -C vendor/veyra-core --strip-components=1
npm install ./vendor/veyra-core three       # three only for @veyra/core/three
```

## Develop

```bash
npm install
npm run examples    # dev server with live examples (http://localhost:5173)
npm test            # unit tests (Vitest + jsdom)
npm run typecheck
npm run build       # ESM + .d.ts into dist/
npm run release:pack  # check everything, then pack release/veyra-core-<version>.tgz
```

Examples (in `examples/`, imported from source):

1. **Scroll scenes** — pinned horizontal track, scrubbed timeline, CSS-only progress.
2. **Persian type** — naive vs. script-aware splitting, side by side.
3. **three.js + DOM** — grid-anchored shader planes bent by scroll velocity, a mirrored HTML headline, an object anchored to a sticky box.

## Documentation

- [Guide](docs/guide.md) — every module with usage
- [Architecture & decisions](docs/architecture.md) — principles, frame pipeline, what Veyra owns vs. builds on
- [Integration](docs/integration.md) — consuming the engine from projects, local co-development, releasing
- [Plan & progress](docs/PLAN.md) — roadmap and status across the Veyra repositories

## Browser support

Evergreen browsers (Chrome/Edge 111+, Safari 16.4+, Firefox 115+). Uses `Intl.Segmenter` when available for grapheme clustering (with a fallback).

## License

MIT © Veyra Studio
