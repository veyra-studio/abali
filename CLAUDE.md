# Abali — working notes for Claude Code

First showcase of the Veyra engine: a Persian RTL campaign concept for Doogh Abali. The master plan and progress tracker for all Veyra repositories is `docs/PLAN.md` in [veyra-core](https://github.com/veyra-studio/veyra-core).

## Commands

```bash
npm install
npm run dev            # Vite dev server
npm run build          # tsc --noEmit + vite build (base /abali/)
npm run verify         # Playwright checks on the production build → verify-output/ (add -- --gpu on a Mac)
npm run engine:update  # move to the newest engine release (github:veyra-studio/veyra-core#release)
VEYRA_CORE_SRC=../veyra-core npm run dev   # alias the engine to its source
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

## Verification

`npm run verify` serves `dist/` under `/abali/` and checks console errors, failed requests, RTL semantics and copy, the disclaimer, keyboard entry, every chapter and both lazy worlds, the shake and open interactions with sound on, reduced motion, mobile overflow and the drawn fallback without WebGL. Headless WebGL runs on SwiftShader (portable, slow); `--gpu` renders on Metal. `?capture` exposes `window.__abali` and lifts the frame-delta clamp so animations keep real-time pace in captures.
