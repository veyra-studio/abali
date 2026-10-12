# Abali — working notes for Claude Code

First showcase of the Veyra engine: a Persian RTL campaign concept for Doogh Abali. The master plan and progress tracker for all Veyra repositories is `docs/PLAN.md` in [veyra-core](https://github.com/veyra-studio/veyra-core).

## Commands

```bash
npm install
npm run dev            # Vite dev server
npm run build          # tsc --noEmit + vite build (base /abali/)
npm run verify         # Playwright checks on the production build → verify-output/ (add -- --gpu for the GPU: Metal on a Mac, Direct3D on Windows)
npm run engine:update  # move to the newest engine release (github:veyra-studio/veyra-core#release)
VEYRA_CORE_SRC=../veyra-core npm run dev   # alias the engine to its source ($env:VEYRA_CORE_SRC='../veyra-core'; npm run dev in PowerShell)
```

## Rules

- Persian-first: copy lives in `index.html`, in natural Persian (ZWNJ, «٫», Persian digits, «» quotes). Don't add English UI labels.
- No invented brand facts (history, ingredients, awards, volume). See "Facts used in the copy" in README.md (every fact has a source, also listed in the footer). Keep the unofficial-concept disclaimer.
- The headline is «خنکی صدا دارد.»; the chapters are the sounds of opening a cold one: «تق»، «پیس»، «قلپ، قلپ»، «آخیش». Lalezar has no proper «…» glyph: don't put ellipses in Lalezar-set text.
- Things that happen (the cap popping, dishes set down, the finale) are triggered by the scroll but play in real time, with real physics, and reverse when you scroll back; only camera moves and transitions follow the scroll directly.
- The bottle is measured from photographs (`src/gl/bottle.ts`): change the profile only against reference photos, never by eye. Colors live in `src/palette.ts` (and the CSS tokens).
- Engine code is never patched here; generic capabilities go to veyra-core. Once merged there, CI publishes the `release` branch and this site rebuilds with it (dispatch or hourly check); locally, `npm run engine:update`.
- Pinned chapters: a tall `.chapter.pinned` wrapper + `.pin` sticky child. Never override `.pin`'s `position: sticky` (it is also the stacking layer above the WebGL canvas).
- The hero title sits *under* the canvas (the bottle stands in front of it); other text sits above.
- Horizontal overflow must be clipped (RTL documents render offset otherwise).
- Three worlds share one renderer (`src/gl/experience.ts`): the studio (pixel camera, DOM slots), the landscape and the table (own cameras, built lazily after the hero). Chapters choose the world and write state; transitions use the veil (foam, mist, dark).
- Keep the heavy work off the scroll: the terrain bakes in `terrain.worker.ts`; the table re-renders shadows only while dishes move; transmissive glass refracts only opaque objects (keep liquids opaque).
- The ice is ray-traced (`refractiveSolid`, `src/gl/ice.ts`): what its rays see is written in GLSL (`solidOutside`) — in the studio the bottle (a cylinder), the black floor and a backlight hidden behind the set; in the glass the doogh. Keep those in step with the scene, and keep the hooks cheap (sines, not noise: they run at every bounce, for every pixel). Its mesh has large flat faces on purpose: GPUs shade in 2×2 blocks, so small triangles would run the trace several times per pixel. The bottle's glass keeps three.js's milky transmission on purpose (the frosted look); the low tier swaps it for a frosted blend without transmission.
- Weak devices: every world follows the quality tier *as it changes* (`setQuality` on the studio, the landscape and the table; `html[data-quality]` for CSS). The low tier drops the floor's reflection, the bottle's transmission, the grain and the blurs. Worlds built ahead of time are warmed up (`warmUp`) so reaching them doesn't stall. One-off heavy work (loading, building a world) runs under `stage.quality.hold(...)`, so its slow frames don't cost a capable device its tier. In per-frame code, never read computed style or layout, never build strings, and write styles only when they change (`put` in `chapters.ts`). Measure with `?capture&quality=low|medium|high` (pins the tier).
- Phones: the canvas keeps the large viewport's height (`stableHeight`), so the address bar sliding in and out doesn't resize it. Place things with the layer's height (`vh()` in `chapters.ts` reads it), never `innerHeight`.
- Lost WebGL contexts: `studio.restore` and `table.restore` render again what existed only on the GPU (the three environments) and redraw the shadows; anything new rendered once into a target needs the same. Without the context for 3 s, the drawn fallback (`html.no-webgl`) stands in until it returns.
- Fonts: Noto Nastaliq is cut down to the letters set in it, «دوغ آبعلی» (`src/fonts/nastaliq-abali.woff2`, 22 KB instead of 234). If text set in Nastaliq changes, regenerate it with `scripts/subset-nastaliq.mjs` (instructions in its header).
- Commissions: the footer offers a site like this — `itsmetti@proton.me` (mailto with a subject).
- Taps (`chapters.ts` → `experience.pick` → `studio.pick`): the bottle is picked as a column, each ice cube as its box — never raycast the dense meshes. Links, buttons and the HUD keep their clicks. Shaking counts swings that reverse, not speed: a sweep or a nudge must not fill the gauge.
- Responsive: phones (≤ 760 px), short wide screens (a phone on its side, ≤ 520 px high) and very wide ones (the picture keeps to `--frame`, at most twice as wide as tall; JS placements use the same frame) each have their layout; check all of them after layout changes.

## Verification

`npm run verify` serves `dist/` under `/abali/` and checks console errors, failed requests, RTL semantics and copy, the disclaimer and the commission address, keyboard entry, every chapter and both lazy worlds, the shake and open interactions with sound on, reduced motion, mobile overflow, a phone's address bar sliding in (the canvas keeps its size), a lost WebGL context (fallback, then the light rendered again) and the drawn fallback without WebGL. Headless WebGL runs on SwiftShader (portable, slow); `--gpu` renders on the GPU (Metal on a Mac, Direct3D on Windows). `?capture` exposes `window.__abali` and lifts the frame-delta clamp so animations keep real-time pace in captures.
