# Scale story: from rack to city without a jump

Problem: the camera currently goes from ~3 m to ~185 m in a single interpolation, and the city is a field of 18 random boxes on a 240 m slab. This doc defines a believable ladder of scales, the camera choreography, the city diorama, and the (cheap) film-quality option.

## 1. Principles

- No consecutive shots differ in scale by more than ~6× in camera-to-subject distance.
- Something continuous always bridges the cut: **the pipe**. The supply main is the visual spine from rack to city.
- Each shot has one subject, one hero figure, one accent colour.
- Dwell: every shot has a hold zone in the scroll range (≈ 35 % of its section) where the camera is almost still; motion happens in the remaining 65 %.

## 2. Shot list

| # | Shot | Subject | Camera (approx) | Hero figure (see numbers doc) | Asset |
| --- | --- | --- | --- | --- | --- |
| 0 | Establish | rack + exchanger on a studio stage | 6 m, 35° elevation | $ total / yr | existing |
| 1 | Rack macro | cold plates + quick disconnects | 0.4–1.2 m | cooling saved $ | rack (product pass) |
| 2 | Manifold dolly | riser + valves | 1.5 → 4 m | pumping $ small | rack/loop |
| 3 | **Data hall** | row of 8–10 racks, ceiling, aisles, overhead headers | 8–14 m, low | MW of heat | hall = instanced rack |
| 4 | **Plant room** | exchanger, pumps, headers | 3–6 m orbit | heat revenue $ | plant room (new) |
| 5 | **Pipe-follow** | camera rides the supply main through the wall and down | rail along a spline, 2–6 m, speed ramps | MWh/yr moved | loop + trench |
| 6 | **Underground cutaway** | glowing mains in an earth slice under a street | 6–20 m, sideways | km of mains, $ gas avoided | trench/earth section |
| 7 | **City rise** | camera exits the ground and rises to the diorama | 20 → 150 m | CO₂ t, homes | city diorama |
| 8 | Closing wide | whole diorama lit, loop closes (return line fades in) | 150–220 m | $ total / yr + payback | city |
| 9 | Calculator | page content (no 3D focus, subtle backdrop) | static, slow drift | — | — |

Camera implementation: replace the 5 per-phase lerp keyframes with a **spline rig** (CatmullRom for position and target through named waypoints) driven by scroll with per-shot ease and hold. Data stays in `phases.ts` (camera section only). For the pipe-follow shot, build the rail from the same path as `Flow` (`scene/paths.ts`) so particles and camera agree.

## 3. Data hall (new)

- 2 rows × 5 racks (10 racks), 1.2 m rack pitch, 1.8 m cold aisle, 1.2 m hot aisle, polished concrete floor with painted aisle lines, ceiling grid with cable trays and the overhead supply/return headers with **insulation and colour bands**, drop pipes to each rack manifold, low warm light panels, a haze plane.
- All racks are **instances** of the same baked rack mesh; vary door state (a few open), LEDs, and a rack-ID decal via per-instance colour or UV offset.
- Headers connect to the existing loop pipes so flow particles route rack → header → plant room.
- Budget ≤ 40 k extra tris (floor, ceiling, trays, headers) + instancing.

## 4. Plant room and pipe-follow (new)

- Plant room: see `product-model.md` §4.
- Pipe-follow route (three coords, Y-up; concrete values to be fixed when the assets exist): plant room supply header → wall penetration with sleeve → short trench in a concrete slab → drops to z = −6 m (Blender) / y = −6 (three) → runs under the plant yard → meets the street main.
- **Cutaway:** earth section as a thick plane or boxes with layered soil colours (topsoil, clay, gravel bedding), concrete duct bank around the main, **warning tape** line above it, a few utilities (grey water pipe, blue duct bank) for realism; the main pipe has glass-like insulation with a glowing amber core and flowing particles.
- A section plane (clip plane) lets us reveal the underground part while the camera is below grade, then restore full ground when rising. Prefer a **stylised cut slab** (box edge visible) over real clipping to keep it cheap.

## 5. City diorama (replaces the random boxes)

Why current city fails: 18 random boxes, a 240 m slab, mains hidden, no streets/trees, and a plant that earlier swallowed the exchanger. Replace with a **tilt-shift architectural diorama**:

- **Plinth:** rounded square ~350–450 m across, with a visible earth cutaway on the sides (ties to §4), soft shadow on the stage floor, subtle rim light.
- **Street grid:** 4–5 streets with kerbs, crosswalk marks, tree rows, street lamps with a faint glow, a river or canal on one side with a bridge, a park.
- **Buildings (≈ 60–90, instanced from ~8 archetypes):** low-rise apartments (most), mid-rise towers, school, hospital, civic hall, swimming pool, a district-heated greenhouse. Mostly white/light-grey massing with a few hero buildings in accent colour. Facade windows from a texture atlas (lit at dusk), roofs with plant boxes and a few solar panels.
- **Heat network:** thin glowing amber lines on the street surface from the plant to each building (end nodes pulse); buildings **light up as the heat front arrives** (scroll-driven, per-building threshold by distance along the network). This is the "payoff".
- **Plant:** the DataCool plant with the four stacks at the centre-left, visible exchanger hall windows.
- **Look:** tilt-shift depth of field, bloom on windows/network, long shadows from a low sun, warm dusk horizon, subtle haze, a few tiny moving elements (cars on the street as light streaks, boats), kept as instanced meshes.
- **Budget:** ≤ 120 k tris, ≤ 3 materials atlased, 2 textures ≤ 2048².
- **Build path:** `assets/district/make_district.py` is rewritten (SolidCraft CLI) to emit blockout bodies per archetype and a layout JSON; Blender `assemble.py` instances them from the layout; three loads one GLB. Alternative: build the city fully in Blender with geometry nodes/scripts and bake — also acceptable if CLI is slow.

## 6. Film quality — keep it cheap

User: "film quality would be nice but that's expensive, keep that in mind."

Policy:
1. **Default is real-time** with baked lighting + post (bloom, DOF, grain). It must look good on its own.
2. **Optional single hero clip** pre-rendered in Blender Cycles only for the **city rise** (shot 7) if the real-time version still doesn't meet the bar:
   - 1280×720, 96 frames (loopable 4 s), Cycles OptiX, 24 spp + OptiX denoise (no DLSS for final renders), AgX look, low-bounce settings.
   - Encode to WebM/MP4 (`pipeline/encode.py`), target ≤ 2.5 MB; played as a `<video>` texture or full-bleed layer, scrubbed by scroll (frame-seek via `currentTime` or an image sequence of ≤ 96 WebP at ≈ 25 kB).
   - Cost estimate: a few hundred seconds of GPU time (stills at 1600×900 take tens of seconds each); definitely < 1 h.
3. **Never** pre-render the full page or hero macro shots. Hero macro (rack/exchanger) stays real-time with the baked product materials.
4. The clip is optional and behind a feature flag (`VITE_USE_CLIP`) so the real-time path is always the fallback.

## 7. Acceptance

- Scroll through all shots at 1600×1000 and 500×900; no jump cut, no empty frame, no clipped geometry through the camera.
- Pipe-follow stays on the pipe for its whole duration; particles visible inside.
- The city reads as a place (streets, trees, building types), heat network visibly lights buildings.
- Per-shot numbers pinned (see `numbers-and-calculator.md`).
- Performance and size budgets in `polish-plan.md` §6.
