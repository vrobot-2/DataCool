# Polish plan — master

Status: **planning**. Nothing below is built yet. See `README.md` for the index.

## 1. User feedback (verbatim intent, kept so nothing is lost)

Round A ("make it look way better"):
- "I want this to look **way better**."
- "The **numbers** to show aren't represented well."
- "It looks **unpolished with plain backgrounds**."
- "The model goes from the rack and solution **directly to city scale**, and the **city itself is weird**."
- "Don't do anything yet, come up with ideas to make it polished."

Round B (this plan):
- "The **rough model and rack don't look like a true product** yet."
- "**Film quality would be nice but that's expensive, keep that in mind.**"
- "**Hero figures is good.**"
- "Add a **calculator at the end** with a **cartoonish animated 2D representation diagram** of **what they save over time**, and **graphs and figures**."
- "At the end it should say **Customise your solution** and it should **take you to this site**" (URL not supplied yet — see open questions).
- "Take screenshots and take a look at what it looks like."
- "**Before you do anything, write everything into md files, like everything.**"

Round C:
- "**Add a note to remove the highlight feature.**" → the part-highlighting / hover-details feature (hotspots) is **to be removed** (see §8 and task T12 in `agent-tasks.md`). Do not extend it, and do not build new hotspots for new assets.

Earlier standing requests that remain in force (all shipped as a first pass, to be refined):
text on 3D, dollars-saved numbers, texturing, better background, flow dynamics, more detailed rack, post-processing, modern UI + cursor effects, preloading, DataCool branding (`app/public/brand/datacool-logo.svg`), less bloat. Also: use bun; keep CAD on `solidcraft-cli`; use the OptiX denoiser.
**Superseded:** "part highlighting with hover details" — now marked for removal (§8).

## 2. Diagnosis (why it looks unpolished)

From the stills, the code, and the first screenshot review (`screenshot-review.md`):

1. **Models read as CAD, not product.** Sharp unbevelled edges, no seams/gaskets/fasteners at the right scale, no labels, brand, data plates, gauges or cables; the rack looks like shelves with boxes. Detail is geometric but not *product-design* detail. → `product-model.md`.
2. **Backgrounds are empty.** Dark gradient + faint stars. No studio floor, no environment reflections, no depth cues, no sense of place. → `art-direction.md`.
3. **Scale story is broken.** One camera lerp from ~3 m to ~185 m; the city is a field of 18 random boxes on a slab with no streets, trees, or context. → `scale-story.md`.
4. **Numbers are tickers in a strip.** They are not connected to objects and don't tell a business story; no way to test your own case. → `numbers-and-calculator.md`.
5. **Metals are dark; lighting is generic.** No environment map in the baked path, windows are flat squares, pipes are opaque orange tubes.
6. **Unverified UI.** Nobody has looked at the live page (panels, cursor, preloader, hotspots). Fix list comes out of `screenshot-review.md`.

## 3. Target

A scroll story that feels like a premium product site (think hardware launch page + data-viz explainer):

1. Studio-quality macro of a **recognisable DataCool rack** (branded, detailed, glossy) →
2. a **data hall row** (so scale grows gradually) →
3. a **plant room** with the branded exchanger →
4. **follow the pipe** out of the building and into the ground →
5. **underground cutaway** of the glowing mains →
6. a **diorama city** that lights up as heat arrives →
7. **hero figure** per step, pinned to its object →
8. **Calculator + cartoon savings diagram + graphs** →
9. **"Customise your solution"** call to action → external site.

Non-goals: full film-quality rendering of the whole page; extra heavy dependencies; a CMS.

## 4. Workstreams

| ID | Name | Doc | Owner (suggested) | Depends on |
| --- | --- | --- | --- | --- |
| W1 | Screenshot review + fix list | `screenshot-review.md` | lead | — |
| W2 | Product-grade rack (CAD + bake) | `product-model.md` §2 | blender-pipeline | W1 |
| W3 | Product-grade exchanger + plant room | `product-model.md` §3–4 | blender-pipeline | W1 |
| W4 | Art direction: environment, floor, light, pipes | `art-direction.md` | ts-stage | W1 |
| W5 | Scale story: data hall, plant room, pipe-follow, underground | `scale-story.md` §2–4 | blender-pipeline (assets) + ts-stage (camera) | W2, W3 |
| W6 | City diorama | `scale-story.md` §5 | blender-pipeline + ts-stage | W5 |
| W7 | Optional pre-rendered hero clip | `scale-story.md` §6 | blender-pipeline | W6 |
| W8 | Hero figures in 3D | `numbers-and-calculator.md` §2 | ts-shell | W4 |
| W9 | Calculator + cartoon diagram + graphs | `numbers-and-calculator.md` §3–5 | ts-shell | — (model is independent) |
| W10 | CTA "Customise your solution" | `numbers-and-calculator.md` §6 | ts-shell | URL from user |
| W11 | UI polish pass from review | `screenshot-review.md` §fixes | ts-shell | W1 |
| W12 | Final QA: build, screenshots, perf budget | `agent-tasks.md` §QA | lead | all |

Concrete task cards with scopes and acceptance criteria are in `agent-tasks.md`.

## 5. Order of work

1. **W1** screenshots + review (done first, results appended to `screenshot-review.md`).
2. In parallel: **W2/W3** (asset work, slow), **W4** (look-dev in three), **W9** (calculator is self-contained, no scene dependency).
3. **W5 → W6** once rack/exchanger are re-baked and the environment look is settled.
4. **W8, W10, W11** after the look is stable.
5. **W7** only if the real-time city still doesn't reach the bar.
6. **W12** final pass.

## 6. Budgets and constraints

- **Page weight:** first paint JS ≤ 250 kB gz (currently ~190 kB gz before lazy chunks); lazy 3D chunk ≤ 350 kB gz; `scene.glb` ≤ 25 MB (now 18 MB; target ≤ 22 MB after adding hall/plant/city by reusing instances and sharing materials); total initial download behind the preloader ≤ 30 MB.
- **Triangles:** rack ≤ 140 k, exchanger ≤ 220 k, hall instances share one rack mesh (instancing), plant room ≤ 60 k, city ≤ 120 k. Target scene total ≤ 600 k tris, 60 fps on an RTX 4060 laptop, ≥ 30 fps on integrated GPUs with the quality tier step-down.
- **Film quality:** only as a cheap, optional, looped clip (see `scale-story.md` §6). Never a full-page frame sequence.
- **Render cost reference:** 1600×900 Cycles stills at 20–32 spp with OptiX denoise take roughly tens of seconds each on this machine; a 96-frame 1280×720 clip is well under an hour.
- **Accessibility:** `prefers-reduced-motion` disables cursor effects, flow animation speed-ups, camera easing; calculator is fully keyboard-operable with visible focus; all hero figures also exist as text for screen readers.
- **Honesty of numbers:** all dollar figures are *modelled from stated assumptions*; the calculator exposes the assumptions and every output cites which input drives it.

## 7. Acceptance for the polish round

1. Side-by-side with the "before" screenshots, the page no longer has any plain flat background; every phase has a deliberate backdrop and lighting.
2. Rack and exchanger close-ups read as real products: branding, bevels, gaskets/seams, labels, gauges, cables, believable materials. Reviewed at 1600×1000 close-ups.
3. Scroll path has no scale jump larger than ~6× between consecutive shots; the pipe-follow + underground cutaway bridges plant → city.
4. City is a coherent diorama (streets, trees, building types, glowing heat network), not random boxes.
5. Each phase shows a single hero figure pinned to its object; numbers match `derive()`.
6. Calculator at the end: live inputs → animated 2D cartoon diagram (savings over time) + at least three graphs + headline figures; reset + share; keyboard accessible.
7. CTA "Customise your solution" opens the user-provided site (new tab, with query parameters if agreed).
8. `bun run build` passes; screenshots at 1600×1000 and 500×900 reviewed for every phase and the calculator; budgets in §6 met or documented.
9. Docs updated with what shipped (append sections 10+ to `production-plan.md`).
10. The part-highlight / hover-details feature is gone (see §8): no ghost outlines, no spec cards on hover, no hotspot proxies, no cursor-ring hotspot label; nothing else regresses.

## 8. Feature removal: part highlighting + hover details

Decision (user, Round C): **remove the highlight feature.** Scope of the removal:

- Delete `app/src/scene/Hotspots.tsx`, `app/src/scene/hotspotData.ts`, `app/src/scene/hoverStore.ts`, `app/src/scene/tip.css`.
- Remove the `<Hotspots …/>` mount and import from `app/src/components/Stage.tsx`.
- Remove the hover-label coupling from `app/src/components/Cursor.tsx` (it reads `hoverStore`); the ring keeps growing over links and `[data-magnetic]` elements only.
- Remove any `document.body.style.cursor = 'pointer'` side effects from the scene code.
- Remove hotspot references in docs where they describe live behaviour: `production-plan.md` §9 (add a note that it was removed), `scale-story.md` and `agent-tasks.md` (already updated: no new hotspots, T6 no longer includes them).
- Keep the 3D annotation panels (title/lede/specs with leader lines) and the hero figures; those are not part of this feature.
- After removal: `bun run build` passes, the bundle shrinks (record the Stage chunk size before/after), and the canvas receives pointer events normally (nothing blocks them).
- Owner: `ts-stage` for scene files, `ts-shell` for `Cursor.tsx`. Task card T12.
