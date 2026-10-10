# Abali — working notes for Claude Code

First showcase of the Veyra engine: a Persian RTL campaign concept for Doogh Abali. The master plan and progress tracker for all Veyra repositories is `docs/PLAN.md` in [veyra-core](https://github.com/veyra-studio/veyra-core).

## Commands

```bash
npm install
npm run dev            # Vite dev server
npm run build          # tsc --noEmit + vite build (base /abali/)
npm run verify         # Playwright checks on the production build → verify-output/
npm run engine:update  # move to the newest engine release (github:veyra-studio/veyra-core#release)
VEYRA_CORE_SRC=../veyra-core npm run dev   # alias the engine to its source
```

## Rules

- Persian-first: copy lives in `index.html`, in natural Persian (ZWNJ, «٫», Persian digits, «» quotes). Don't add English UI labels.
- No invented brand facts (history, ingredients, awards). See "Facts used in the copy" in README.md. Keep the unofficial-concept disclaimer.
- Engine code is never patched here; generic capabilities go to veyra-core. Once merged there, CI publishes the `release` branch and this site rebuilds with it (dispatch or hourly check); locally, `npm run engine:update`.
- Pinned chapters: a tall `.chapter.pinned` wrapper + `.pin` sticky child. Never override `.pin`'s `position: sticky` (it is also the stacking layer above the WebGL canvas).
- The hero title sits *under* the canvas (the bottle stands in front of it); other text sits above.
- Horizontal overflow must be clipped (RTL documents render offset otherwise).
- Keep the world shader cheap: ridgelines come from the precomputed lookup texture, not per-pixel noise.

## Verification

`npm run verify` serves `dist/` under `/abali/` and checks console errors, failed requests, RTL semantics, keyboard entry, reduced motion and mobile overflow. Headless WebGL runs on SwiftShader (slow): `?capture` exposes `window.__abali` and lifts the frame-delta clamp so animations keep real-time pace in captures.
