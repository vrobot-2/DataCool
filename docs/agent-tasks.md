# Agent task cards (polish round)

Rules for everyone: read `README.md` conventions first (bun; CAD only via `solidcraft-cli`; units; axes; GLB node names; confined shells stage binaries in `build/`). Keep `bun run build` green. Write docs updates in place at the end (append to `production-plan.md` §10+). No unrequested new dependencies. Budgets in `polish-plan.md` §6.

Teammates already exist: `ts-shell` (UI / DOM / calculator), `ts-stage` (three scene), `blender-pipeline` (CAD + Blender + GLB). The lead handles screenshots, builds, copying staged files, QA.

---

## T0 — Screenshot review (lead) — W1

- Run: `bunx vite preview --port 4173 --host 127.0.0.1` (background job) and `bun tools/shots.mjs http://127.0.0.1:4173/ app/screenshots`.
- Review every phase at 1600×1000 and 500×900; record faults in `screenshot-review.md` (category, severity, owner).
- Also capture close-ups (rack front, exchanger side) via a debug URL parameter `?cam=rack|exchanger|city` if needed.

## T1 — Product-grade rack — `blender-pipeline` — W2

Scope: `assets/rack/**` (generator `make_rack.py`), `pipeline/assemble.py`, `pipeline/bake.py`, `pipeline/procedural_textures.py`, `pipeline/scene_layout.json`.
Do: everything in `product-model.md` §2 and §5 (bevel + weighted normals, branding decal from `app/public/brand/datacool-logo.svg`, door perforation as texture, UQD couplings with coloured collars, braided hoses, valves/gauges on the manifold, cable bundles, PDU, labels).
Output: re-exported STEP/OBJ/SC/preview in `assets/rack/` (via `build/` staging), rebaked `scene.glb`, new stills of rack front + macro, tri count report.
Acceptance: `product-model.md` §6 for the rack; names preserved.

## T2 — Product-grade exchanger + plant room — `blender-pipeline` — W3, W5

Scope: `assets/exchanger/**`, new `assets/plant/**`, pipeline files as above.
Do: `product-model.md` §3–4 (gasket lines, carrying/guide bars, nameplate with logo, studs/gaskets, probes/gauges/valves, insulation panels, plant room with pumps, headers, expansion tank, control cabinet).
Output: assets + preview PNGs; GLB nodes `plant__baked` (+ keep the existing names).

## T3 — Data hall + underground + city diorama assets — `blender-pipeline` — W5, W6

Scope: `assets/hall/**`, `assets/district/**` (rewrite generator), pipeline files.
Do: `scale-story.md` §3–5. Instances of the baked rack for the hall; trench/earth-section cutaway; diorama city (plinth, street grid, ~60–90 buildings from ~8 archetypes via instancing, trees, lamps, river/bridge, heat-network line geometry as separate named meshes `network__*` so three can animate them), atlased windows (lit emissive).
Output: single `scene.glb` (≤ 25 MB) with documented node names + a JSON `app/public/models/scene.meta.json` listing instance transforms, network polylines (three coords), building ids and their distance along the network (for the light-up animation), and waypoints for the camera rig.
Optional (W7): `pipeline/render_clip.py` + encoded clip per `scale-story.md` §6, only if lead asks.

## T4 — Art direction in three — `ts-stage` — W4

Scope: `app/src/scene/**` (not `Annotations.tsx`), `components/Stage.tsx`, camera section of `phases.ts`.
Do: `art-direction.md` §2–5: studio stage with reflective floor, Lightformer environment per phase, glass pipe overlays with colour bands and inner flow, volumetric cones + dust, per-phase post presets (DOF macro, tilt-shift city), tuned materials (`envMapIntensity`), replace opaque orange loop pipes.
Acceptance: art-direction §8.

## T5 — Camera spline rig + shot choreography — `ts-stage` — W5

Scope: `scene/CameraRig.tsx`, `scene/shots.ts` (new), camera data in `phases.ts`.
Do: replace 5 lerped keyframes with a named-waypoint spline rig + hold zones per `scale-story.md` §1–2; pipe-follow rail from `scene/paths.ts`; section ids for the added shots (`hall`, `plant`, `follow`, `underground`, `city`, `close`, `calculator`). Update `useScrollDriver` anchors to the new section list (coordinate with `ts-shell`, who owns the DOM spacers and the stepper).

## T6 — City heat-network animation — `ts-stage` — W6

Scope: `scene/**`.
Do: load `scene.meta.json`; animate the network polylines (flow particles + glow front driven by scroll), light buildings as the front arrives. **No new hotspots** — the highlight/hover feature is being removed (T12).

## T7 — Hero figures in 3D — `ts-shell` — W8

Scope: `scene/Annotations.tsx` (or new `scene/Hero.tsx`), `components/**`, `data/**` (copy and calc), `styles.css`.
Do: `numbers-and-calculator.md` §2; numbers from `calc()`; count-up in hold zone; mobile layout; ARIA text equivalents.

## T8 — Calculator, cartoon diagram, graphs — `ts-shell` — W9

Scope: `app/src/data/calc.ts` (+ tests), `app/src/components/calculator/**`, `styles.css` (or `calculator.css`), `App.tsx` (new section after the story).
Do: `numbers-and-calculator.md` §1 (fix model issues), §3–5. SVG cartoon with time slider, five graphs, headline cards, presets, URL-hash state, reduced motion, keyboard. Lazy-loaded.
Acceptance: numbers-and-calculator §8; bundle ≤ 40 kB gz.

## T9 — CTA "Customise your solution" — `ts-shell` — W10

Scope: `app/src/data/site.ts`, `Header.tsx`, calculator section.
Blocked on the URL from the user (`CTA_URL`). Build with `VITE_CTA_URL` fallback; link with query parameters as specified.

## T10 — UI polish from review — `ts-shell` — W11

Scope: `components/**`, `styles.css`, `index.html`.
Do: fix the faults in `screenshot-review.md` assigned to DOM/UI (panel positions, mobile clamp, cursor bugs, preloader timing, stepper, strip). Logo draw-on in preloader.

## T12 — Remove the highlight feature — `ts-stage` (scene) + `ts-shell` (cursor) — do early

Spec: `polish-plan.md` §8. Steps:
1. `ts-stage`: delete `scene/Hotspots.tsx`, `scene/hotspotData.ts`, `scene/hoverStore.ts`, `scene/tip.css`; remove the import and `<Hotspots …/>` from `components/Stage.tsx`; grep for `hoverStore`, `Hotspot`, `tip.css`, `style.cursor`.
2. `ts-shell`: remove the `hoverStore` import/label logic from `components/Cursor.tsx`; remove any leftover `.tip` / hotspot CSS from `styles.css`.
3. `bun run build` green; record Stage chunk size before/after; confirm no dangling references (`rg -n "hoverStore|Hotspot|hotspot" app/src`).
4. Note the removal in `production-plan.md` §9.

## T11 — Final QA — lead — W12

- `bun install && bun run build`, bundle sizes recorded.
- `bun tools/shots.mjs` at 1600×1000 + 500×900 for every shot + calculator; review each image; record in `screenshot-review.md`.
- FPS sanity (Chrome performance trace or in-page stats on `?stats`), tier step-down check.
- Copy staged files from `build/`, delete `build/`, remove probe scripts.
- Update `production-plan.md` §10+ ("what actually shipped in polish round").

## Sequencing summary

1. T0 (lead) now.
2. Parallel: T1, T2, T4, T8.
3. Then T3, T5, T7, T10.
4. Then T6, T9 (URL).
5. T11.
