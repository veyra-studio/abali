# Abali — «خنکی صدا دارد.»

**Cool has a sound.** A Persian, right-to-left campaign concept for Doogh Abali (دوغ آبعلی), and the first public showcase of the [Veyra](https://github.com/veyra-studio/veyra-core) creative web experience engine.

Live: **https://veyra-studio.github.io/abali/**

> **Independent and unofficial.** This is a concept piece made to demonstrate Veyra. It is not commissioned by, affiliated with, or endorsed by the maker of Doogh Abali. The Abali name and marks belong to their owners.

## The idea

Cool has a sound — **«خنکی صدا دارد.»** Opening a cold Abali is a handful of them: the opener prying off the crown cap — **«تق»**; the gas escaping — **«پیس»**; the first gulps — **«قلپ، قلپ»**; and **«آخیش»**, the word Persian has for that relief. The film stretches those seconds into a scroll, then sets the table and hands the bottle to you.

| # | Chapter | What happens | Veyra at work |
| --- | --- | --- | --- |
| — | Loader | «یک لحظه…» — the crown cap from above; its 21 crimps light up as the film loads, then it snaps off. | `Preloader`, timelines, `SoundBus.tone`/`burst` |
| 00 | «خنکی صدا دارد.» | The bottle on black acrylic with ice, condensation on the glass, reflected in the floor; the headline stands behind it. The ice is ray-traced: light bends through each cube and reflects inside it, showing the bottle and a hidden backlight, with a cloudy heart and tiny bubbles. Tap the glass and it rings; tap the ice and it clinks — keep at a cube and it cracks, then breaks into chips and a puff of ice dust. | three.js layer, `Profile`, `studioEnvironment`, `condensationMaps`, `ReflectiveFloor`, `ContactShadow`, `refractiveSolid`, springs |
| 01 | تق | The camera closes in and looks down onto the cap; a steel opener slides in flat, hooks under the skirt and pries; the cap snaps off in real time — «تق!» — and falls with real gravity. | pinned scene, scroll-triggered real-time events, rigid-body cap |
| 02 | پیس | A breath of cold fog at the mouth, then the fizz. Shake the pointer back and forth (or press the button) and the foam climbs out of the bottle until it boils over, floods the screen white and carries you on to the mountains. | pointer swings, springs, instanced foam, full-screen shader, `scrollTo` |
| 03 | آخیش | «قلپ، قلپ» and a breath out — then the foam turns to snow: a winter valley in the Central Alborz in low morning sun, warm on the slopes, blue in the shade, alpenglow on a volcanic cone far off, crystals glinting in the snow. «آخیش!» stretches with kashida as you scroll; a frosted card names the place: «آبعلی», a mountain town, its coordinates. Move the pointer to look around and to blow the snow aside. | `kashida`, terrain baked in a worker (`heightfield`, `erodedNoise`, `bakeSunlight`, `bakeOcclusion`), rock and snow read from a `noiseTexture`, snowfall |
| 04 | سفره | A block-printed sofreh, creased from storage, seen from above: chelow with saffron and butter, koobideh, grilled tomatoes, a red onion, sumac, lavash and sabzi khordan (herbs, radishes, spring onions), a spoon and a fork in polished steel, are brought in from the side and set down one by one; the menu card lights up. «فقط یک چیز کم است.» — then the bottle, and a tall glass of doogh with ice, mint and a straw. | scene progress, instancing (thousands of rice grains), soft window shadows, contact shadows, refraction, `refractiveSolid` (the same ice, the doogh showing through) |
| 05 | حالا نوبتِ شماست | Your turn: press «تق!» — the opener pries the cap off, it clatters onto the floor and settles; «پیسسس»، «قلپ، قلپ»، «آخیش!». | cap physics, synthesized sound |

Everything visual is generated live: no product photos, no 3D model files, no image textures. The bottle is rebuilt from photographs of the real one — silhouettes traced per row and normalized: a long, nearly straight conical neck from the crown finish to a full upper body, a gentle waist, a slightly narrower lower bulge, a rounded heel and a thick, green-tinted base; the paper label sits on the cone, so its sides converge toward the neck; the navy crown cap has the standard 21 flutes. Label colors (cerulean field, darker border, white rule, golden oval, navy lettering) were sampled from the photos. The reference photos were used for measurement only and are not part of this repository.

## Facts used in the copy

The copy makes no claims about the brand's history, ingredients or awards. It only states:

- **Abali is the name of a town:** a city in Rudehen District, Damavand County, Tehran Province; a mountainous area in the Central Alborz with cold winters and cool summers, at about 35°46′ N, 51°58′ E (both articles agree to the minute) ([Wikipedia, «آبعلی»](https://fa.wikipedia.org/wiki/%D8%A2%D8%A8%D8%B9%D9%84%DB%8C), [Abali](https://en.wikipedia.org/wiki/Abali)).
- **Doogh is served cold and goes with chelow kabab** ("a cold and savoury Persian drink"; "Persian dishes such as Dizi and Chelow Kabab are the most commonly served with doogh" — [Wikipedia, Doogh](https://en.wikipedia.org/wiki/Doogh)).
- **The product** is a carbonated doogh (دوغ گازدار) in a glass bottle with a metal crown cap — as sold and photographed in retail listings. (Listings disagree on the volume, so the copy doesn't state one.)

The headline («خنکی صدا دارد.»), the onomatopoeia (تق، پیس، قلپ، آخیش) and the shaking joke («تکانش ندهید.» … «تکانش بده») describe opening any cold carbonated drink; they are not product claims.

## Develop

```bash
npm install
npm run dev                      # http://localhost:5173/abali/
VEYRA_CORE_SRC=../veyra-core npm run dev   # live-develop the engine too
npm run build                    # typecheck + production build into dist/ (base /abali/)
npm run preview                  # serve dist at http://localhost:4173/abali/
npm run verify                   # end-to-end checks + screenshots of the production build
npm run verify -- --gpu          # same, rendered on the GPU (Metal on macOS, Direct3D on Windows)
npm run engine:update            # move to the newest engine release
```

The engine comes from GitHub: `"@veyra/core": "github:veyra-studio/veyra-core#release"` — the branch veyra-core's CI publishes from every green build. Deploys always install the newest release and record it in `dist/engine.json`; when the engine changes, the site rebuilds on its own (see Deploy).

Add `?debug` for Veyra's diagnostics overlay.

## Structure

```
index.html              Persian markup: all copy lives in the DOM (plus the drawn fallback bottle)
src/main.ts             stage, preloading, loader, sound toggles, lazy worlds
src/chapters.ts         scroll choreography for every chapter
src/gl/experience.ts    the director: one renderer, three worlds, one veil
src/gl/bottle.ts        the bottle: measured profile, glass, doogh, label band, crown cap
src/gl/label.ts         the label artwork
src/gl/studio.ts        hero/finale studio: floor, ice, shadow, opener, wisp, foam
src/gl/{ice,opener,plume,foam,veil}.ts   ice: ray-traced cubes (createIceCube), the studio's arrangement (createIce)
src/gl/landscape.ts     «آخیش»: terrain, sky, snow (alborz.ts shape, terrain.worker.ts bake)
src/gl/table.ts         «سفره»: the flat-lay; food/ cloth, plate, rice, kebab, tomato, glass, sides
src/sound.ts            synthesized sound design (Web Audio)
src/style.css           design tokens, layout, chapter compositions
src/palette.ts          colors sampled from the product
scripts/                verify.mjs (browser checks), engine-stamp.mjs (writes dist/engine.json)
```

## Accessibility and performance

Real headings and text in the DOM (the canvas is decorative); skip link; every interaction has a keyboard path (shake button, open button); sound is on by default (it starts at the first click, tap or key, as browsers require; turning it off is remembered) and both toggles report their state; reduced motion disables smoothing, entrances, pointer tilt, the word stretch and the drop animations; without WebGL, a drawn bottle, mountains and sofreh take over. The terrain is baked in a worker; the mountains and the table are built after the hero has loaded; the table re-renders its shadows only while dishes move; the adaptive quality governor lowers resolution on slow devices, and every world follows its tier as it changes: the low tier drops the floor reflection, the bottle's transmission, the film grain and the blurs, and traces the ice more simply. Worlds built ahead of time are warmed up so reaching them doesn't stall a frame, and the governor holds its judgement while the page loads and builds them, so a capable device keeps its tier. On phones the canvas keeps the large viewport's height, so the address bar sliding in and out doesn't resize it; if the phone takes the GPU back (a page in the background), the drawn fallback stands in and the film's light is rendered again when it returns. The Nastaliq face is cut down to the letters set in it (22 KB instead of 234).

Commissions — a site like this one: [itsmetti@proton.me](mailto:itsmetti@proton.me).

## Deploy

GitHub Actions builds and deploys `dist/` to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`), always with the newest engine release. It also redeploys when the engine changes: immediately when veyra-core's CI sends an `engine-updated` dispatch (needs its optional `SITES_DISPATCH_TOKEN`), otherwise within the hour — a scheduled check compares the engine's `release` branch with the deployed `engine.json`. If a new engine breaks the build, the deploy fails and the current site stays live. **One-time setup:** Settings → Pages → Source: **GitHub Actions**.

## Credits

Fonts: Lalezar, Estedad, Noto Nastaliq Urdu — SIL Open Font License. Built with [Veyra Core](https://github.com/veyra-studio/veyra-core) and [three.js](https://threejs.org). Concept, copy and code: [Veyra Studio](https://veyra-studio.github.io/).
