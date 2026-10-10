# Abali — «یک بطری کوه»

**A bottle of mountain.** A Persian, right-to-left campaign concept for Doogh Abali (دوغ آبعلی), and the first public showcase of the [Veyra](https://github.com/veyra-studio/veyra-core) creative web experience engine.

Live: **https://veyra-studio.github.io/abali/**

> **Independent and unofficial.** This is a concept piece made to demonstrate Veyra. It is not commissioned by, affiliated with, or endorsed by the maker of Doogh Abali. The Abali name and marks belong to their owners.

## The idea

Look at the label: a blue field, a yellow oval, white. Sky, sun, snow. The film pushes the camera *into* the label and finds the landscape it has always been describing — Abali, in the Alborz — then follows it down to the table.

| # | Chapter | What happens | Veyra at work |
| --- | --- | --- | --- |
| — | Loader | A crown cap seen from above; its 21 crimps light up as assets load, then it pops. | `Preloader`, timelines, optional synthesized sound |
| 00 | «یک بطری کوه» | A procedurally built 3D bottle stands in front of the Nastaliq headline; it follows the pointer. | three.js layer, DOM-anchored placement, springs |
| 01 | Label | Scroll pushes into the label; a perspective-correct hand-off swaps the 3D label for a 2D world; the calligraphy dissolves and the oval rises as the sun over snowy ridges. | pinned scenes, scrubbed choreography, custom shaders |
| 02 | آبعلی | The place: Alborz ridges, Damavand's cone, snowfall, wind. | scene progress → parallax, sound bed |
| 03 | گاز | Night, carbonation. Shake the pointer (or press the button): pressure builds, the gauge climbs, the foam bursts. | pointer velocity, springs, live uniforms |
| 04 | سفید | Snow, doogh, sofreh. Lalezar lines animate letter by letter **with their joins intact**. | script-aware `splitText`, direction-aware drift |
| 05 | سفره | A flat-lay sofreh fills dish by dish; the menu lights up. | scene-driven SVG choreography |
| 06 | نوش جان | Back to the dark. «آرام باز کنید» — open it gently. | cap physics, bubble burst, sound |

Everything visual is generated live: no product photos, no 3D model files, no images. The bottle's contour was measured from reference photography of the 260 ml glass bottle; the label colors (cerulean field, lemon oval, navy Nastaliq) were sampled from it.

## Facts used in the copy

The copy avoids brand-history claims. It only states:

- Abali (آبعلی) is a place in the Alborz mountains, in Damavand County, Tehran Province, known for mineral springs and snowy winters (it hosts one of Iran's oldest ski areas).
- The product is a carbonated doogh (دوغ گازدار), sold in a glass bottle with a metal crown cap.
- Doogh is traditionally served with chelow kabab.

## Develop

```bash
npm install
npm run dev                      # http://localhost:5173/abali/
VEYRA_CORE_SRC=../veyra-core npm run dev   # live-develop the engine too
npm run build                    # typecheck + production build into dist/ (base /abali/)
npm run preview                  # serve dist at http://localhost:4173/abali/
npm run verify                   # end-to-end checks + screenshots of the production build
npm run engine:update            # vendor the latest ../veyra-core release
```

Add `?debug` for Veyra's diagnostics overlay.

## Structure

```
index.html            Persian markup: all copy lives in the DOM
src/main.ts           stage, preloading, loader, sound toggle
src/chapters.ts       scroll choreography for every chapter
src/gl/experience.ts  renderer, product placement, label hand-off math
src/gl/product.ts     procedural bottle, label artwork, crown cap, ice
src/gl/world.ts       fullscreen shader: label → landscape, snow, bubbles, foam
src/gl/env.ts         product-photography lighting environment
src/sound.ts          synthesized sound design (Web Audio)
src/style.css         design tokens, layout, chapter compositions
vendor/veyra-core/    vendored Veyra Core release (see VENDORED.json)
```

## Accessibility

Real headings and text in the DOM (the canvas is decorative); skip link; every interaction has a keyboard path (shake button, open button); sound is off by default; reduced motion disables smoothing, entrances and pointer tilt; without WebGL, an illustrated CSS/SVG fallback takes over.

## Deploy

GitHub Actions builds and deploys `dist/` to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`). **One-time setup:** Settings → Pages → Source: **GitHub Actions**.

## Credits

Fonts: Noto Nastaliq Urdu, Lalezar, Estedad — SIL Open Font License. Built with [Veyra Core](https://github.com/veyra-studio/veyra-core) and [three.js](https://threejs.org). Concept and code: [Veyra Studio](https://veyra-studio.github.io/).
