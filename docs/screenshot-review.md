# Screenshot review (T0 / W1) — "before" state

Taken 2026-11-10 from `bun run build` → `vite preview` (port 4173) with `node tools/shots.mjs`,
Chrome headless (ANGLE d3d11). Files: `app/screenshots/{desktop,mobile}_{0..5}_*.png`
(desktop 1600×1000, mobile 500×900). Build at that moment: index 40.96 kB (14.25 gz),
Stage 48.72 kB (16.71 gz), PostFX 172.03 kB (78.07 gz), three 885.69 kB (238.31 gz),
react 147.22 kB (47.51 gz), css 11.19 kB (3.30 gz). No `pageerror` in either run; canvas present.

Severity: **S1** = breaks the brief (user complaint), **S2** = clearly unpolished, **S3** = nit.

## Per shot

| Shot | File | Faults | Sev | Owner |
| --- | --- | --- | --- | --- |
| 0 Establish | desktop_0_intro | Plain flat light-grey floor fills ~60 % of the frame; a district tower with checkerboard windows intrudes top-left (scale leak); rack is a black silhouette (no env reflections); leader dot floats in empty air; loop pipes opaque orange; grey concrete "wall" behind. | S1 | ts-stage (stage/env), blender-pipeline (rack look) |
| 1 Rack macro | desktop_1_p1 | Tray tops blow out to pure white (specular + exposure); cold plates are flat orange slabs; city buildings visible through the rack behind the macro subject; hose stubs read as red cylinders; panel covers 25 % of the subject; leader line crosses the rack. | S1 | ts-stage (exposure/DOF/backdrop), blender-pipeline (product detail), ts-shell (panel placement) |
| 2 Manifold | desktop_2_p2 | Rack reads as an empty cage with glowing bars; opaque copper pipes with hard 90° joints; bright white "horizon line" where the ground plane meets the sky; checkerboard-window boxes + star field behind a 3 m subject; flat grey floor with a hard box shadow. | S1 | ts-stage, blender-pipeline |
| 3 Exchanger | desktop_3_p3 | Best shot. Still: plain beige gradient backdrop, an unmotivated warm blob on the right, chaotic particle cloud through the plate pack, rack floating cropped in the top-left, no nameplate/branding/labels, frame looks like painted CAD. | S2 | ts-stage (backdrop, particles), blender-pipeline (nameplate, gaskets, labels) |
| 4 District | desktop_4_p4 | **City is 18 grey boxes with checkerboard windows on a flat slab**; plant is a cube + 4 cylinders; the rack+exchanger stand as a toy in the middle of the plaza (origin not hidden); "mains" are sparkle lines on the surface; manholes are grey discs; no streets, trees, context. | S1 | blender-pipeline (diorama), ts-stage (network anim) |
| 5 Close | desktop_5_end | Identical camera to shot 4 (no move between the last two phases); same city faults; closing copy card is the only change. | S1 | ts-stage (camera), ts-shell (copy/hero) |

Scale ladder observed: shot 1 ≈ 1 m → shot 2 ≈ 4 m → shot 3 ≈ 3 m → shot 4 ≈ 185 m: a ~60× jump in one lerp (brief says ≤ 6×).

## Mobile (500×900)

- Panels drop list item 01 (only 02/03 render) — the clamp hides the first bullet rather than the last; check `PhaseSection` overflow rule. S2, ts-shell.
- Panels sit over the subject (shot 0 panel over the rack, shot 1 over the trays). Dock panels to the bottom third on mobile. S2, ts-shell.
- Spec strip collapses to 2 cells, fine. Stepper dots are tiny (≈ 6 px targets). S3, ts-shell.
- Shot 1 mobile shows the same blown-out trays. S1, ts-stage.

## Cross-cutting

1. **Backgrounds**: every frame's dominant background is a flat fill (grey floor / beige gradient / grey slab). No studio floor reflections, no environment, no depth cues. → `art-direction.md` §2–3 (ts-stage).
2. **Exposure**: ACES at 1.08 with white tray tops = clipped highlights in shot 1. Needs a real environment map + lower material emissive/specular on the trays, DOF for macro. (ts-stage; blender-pipeline for the tray material.)
3. **Scale leak**: the 240 m district is always in view (buildings in shots 0–2). Hide/fade the city outside its shots, or move the studio stage away from the city. (ts-stage.)
4. **Rack/exchanger at city centre** in shots 4–5: hide `rack__baked`, `exchanger__baked`, `loops__baked` once the camera is above ~40 m, or re-layout so the plant building sits where they are. (ts-stage / blender-pipeline.)
5. **No hero figure** pinned in 3D; numbers live only in the strip and bullet lists. (ts-shell, T7.)
6. **No calculator / CTA section**: page ends on the closing card. (ts-shell, T8/T9.)
7. **Hotspots** (highlight feature) still shipped: `scene/Hotspots.tsx` + `hoverStore` + `tip.css`. To remove (T12).
8. Preloader not captured (completes before the first shot); cursor not visible headless — verify by hand later.

## Fix list by owner (feeds T10 / T4 / T1–T3)

- ts-shell: mobile panel docking + bullet clamp; stepper target size; hero figures; calculator; CTA; preloader logo draw-on; Cursor hotspot coupling removal.
- ts-stage: studio stage + reflective floor + Lightformer env; city/stage visibility by shot; exposure + DOF; glass pipes; spline camera with distinct shots 4/5 and the new hall/plant/follow/underground shots; network light-up; delete Hotspots.
- blender-pipeline: product-grade rack (bevels, decals, UQDs, hoses, labels), exchanger nameplate/gaskets/probes, plant room, data hall instances, diorama city (streets, archetypes, trees, plinth), `scene.meta.json`.
