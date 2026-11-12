# DataCool production plan — Spec Sheet + real-time 3D

Decided 2026-11-09. This supersedes the pre-rendered-sequence assumption in `plan.md`.
The site ships a **real-time R3F demo** with **baked** assets. Spec Sheet is the locked UI.

## 1. Non-negotiables

- Units: **millimetres** in SolidCraft, **metres** in Blender and the web scene (STEP already imports at metre scale).
- Axes: **Z up**, **−Y is front** for equipment. Every asset's origin is its ground centre at `(0,0,0)` unless stated.
- Geometry only in CAD. Materials are assigned once, in Blender.
- All modeling runs through **independent `solidcraft-cli run script.json` processes** — never the shared MCP session. Script format:
  ```json
  {"commands":[{"command":"solid.box","params":{...}}]}
  ```
  Write JSON as UTF-8 **without BOM** (`[IO.File]::WriteAllText(..., UTF8Encoding($false))`).
- Export both `*.step` and `*.obj` (quality fine) and one `*_preview.png` (`snapshot --view iso --no-grid --no-axes --quality fine`).
- No agent edits another agent's folder.

## 2. Repository layout

```
assets/
  rack/          rack.step, rack.obj, rack.sc, rack_preview.png
  exchanger/     exchanger_frame.*, exchanger_core.*, exchanger_ports.*, assembled preview
  district/      district.step/obj/sc, district_preview.png
pipeline/        assemble.py, bake.py, render_seq.py, scene_layout.json, scene.blend
app/             Vite + React + TS production site (Spec Sheet + R3F)
  public/models/ scene.glb, textures/ (written by pipeline)
docs/            production-plan.md, solidcraft-blender.md, plan.md
site/            blockout + chosen variant (reference only)
```

## 3. Asset contracts

### 3.1 Rack — `assets/rack/rack.step`
- Envelope **600 × 1000 × 2200 mm**, front at −Y, ground z = 0.
- 4 uprights 40×40, top/bottom rails, 3 shelves.
- 8 server trays 480 × 900 × 70 at `z = 250 + 180·i`, centred in X/Y.
- Cold plate 140 × 140 × 18 on each tray, at the front (`y ≈ −250`), with two hose barbs.
- Rear manifold: two vertical pipes Ø54 at `x = ±200, y = +480, z = 100…2100`; one Ø24 branch per tray with a 90° elbow.
- Front door frame + 6 horizontal slats; no perforation grid.
- Named bodies: `RackFrame`, `Tray01…08`, `ColdPlate01…08`, `ManifoldL/R`, `Branch01…08`, `Door`.
- Preview from iso.

### 3.2 Exchanger — three files in `assets/exchanger/`
Overall envelope **868 × 1328 × 1620 mm**, ground z = 0.
- `exchanger_frame.step`: fixed frame, moving frame, 4 tie rods Ø44 with nuts, skid rails/cross members/feet, 2 lifting lugs with holes, nameplate. Frame 780 × 90 × 1350, rounded corners r45.
- `exchanger_core.step`: 72 plates 730 × 1270 × 5.6, pitch 7.1, centred, pack from `y = −0.253` to `+0.257` m; each plate has 4 port holes Ø120 at `x = ±200`, `z = 500 / 1050` mm and a 6 mm raised border. **Chevron detail is baked, not modeled.**
- `exchanger_ports.step`: 4 straight flanged ports Ø144, flange Ø276 × 28 with 8 bolts Ø18, on both faces at `x = ±200`, `z = 500 / 1050`, extending to `y = ±664 mm`.
- Previews per file + one assembled preview.

### 3.3 District — `assets/district/district.step`
- Plot **240 000 × 240 000 mm**, slab 400 thick, top at z = 0.
- 18 buildings on a 3×3-ish block grid, footprints 12–40 m, heights 12–70 m, 20 m streets, none closer than 30 m to the centre. Simple setbacks and rooftop boxes only — windows are baked.
- Central plant 30 × 30 × 15 m with four stacks Ø3 × 8 m.
- Underground: Ø1.6 m trunk mains at `z = −6000`, crossing under the plant along X and Y; six Ø0.6 m branches to buildings; 8 manhole collars at grade.
- Named bodies by type (`Building01…`, `MainX`, `MainY`, `Branch01…`, `Plant`, `Stack01…`).
- Preview pulled back to show the whole plot.

## 4. Scene layout (metres)

`pipeline/scene_layout.json` is the single source of placement:

| Asset | Position | Rotation | Notes |
| --- | --- | --- | --- |
| rack | `(-3.2, 2.0, 0)` | Z 180° | front faces the exchanger |
| exchanger | `(0, 0, 0)` | none | hero object |
| district | `(0, 0, 0)` | none | surrounds the plant; buildings ≥ 30 m out |
| loop pipes | procedural | — | rack rear → exchanger ports, Ø100, 3 elbows, flanges |

Camera move (one continuous rig, 5 sampled phases):
0. 6 m out, 1.6 m high, 35° elevation — establishing.
1. rack macro, 1.2 m from cold plates.
2. dolly back along the manifold, 4 m.
3. orbit exchanger, 2.8 m radius, 30°.
4. rise to 110 m over the district, tilt down.

## 5. Web app contract

- Vite + React + TypeScript. Dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `lenis`, `gsap`.
- Spec Sheet typography/layout ported from `site/variant-spec.html` — Archivo + IBM Plex Mono, bottom spec strip, 12-col grid.
- One fixed `<Canvas>` occupying the right 58 % of the viewport (full width above the copy on mobile).
- `src/data/phases.ts` is the only source of copy, metrics, palette, camera keyframes.
- Scroll progress drives camera interpolation and the active phase; HUD counters use tabular figures.
- Load `/models/scene.glb`. If missing or failed, render a procedural fallback scene so the app always runs.
- Must pass `npm run build` and be screenshot-verified at 1600×1000 and 500×900.

## 6. Bake / export contract

- `assemble.py`: STEP import (factory reset → `addon_enable("bl_ext.user_default.step_importer")` → `import_scene.step`), placement from layout JSON, PBR materials, lights, cameras, `pipeline/scene.blend`.
- `bake.py`: smart UV unwrap, AO bake 1024/2048 per object group, save to `app/public/models/textures/`, wire into materials, keep UVs, export `app/public/models/scene.glb` (Draco optional, must load in three).
- `render_seq.py`: 5 validation stills at 1600×900; `--frames N` renders the full 96-frame sequence.
- `encode.py`: frames → WebP/AVIF sequence + manifest; ffmpeg 8 and Pillow 13 are installed.
- Use the clay-proof conventions from `solidcraft-blender.md`; do not enable compositing.

## 7. Definition of done for this pass

1. Three asset sets exist with previews and sane bounding boxes.
2. `pipeline/scene.blend` assembles rack + exchanger + district with materials.
3. `app/` builds, runs the Spec Sheet UI, and shows the scene (or fallback) with a scroll-driven camera.
4. At least one Blender validation still and two site screenshots reviewed.
5. Docs updated with what actually shipped.

## 8. What actually shipped — Blender pipeline

- **Import**: the Blender 5.4 STEP importer returns one merged mesh per file (every option tried), which defeats name-based materials. `assemble.py` therefore imports the **SolidCraft OBJ twins** (named bodies, mm; vertices scaled ×0.001, Z-up, no rotation) and prefixes each body `<file stem>__<body>`; STEP is only the fallback. Counts: rack 28, exchanger 26 + 72 + 36, district 40 bodies.
- **Materials**: `scene_layout.json` rules now match those names; materials are copied per asset (`rack__copper`, `exchanger__stainless`, …) so `bake.py` can rewrite them independently.
- **Mesh budget**: fine-tessellated bolts/nuts/manholes/fans (raw 1.7 M tris) are collapse-decimated to a size-proportional budget → **320 k tris** total (rack 85.6 k, exchanger 190 k, district 40 k, loops 3.5 k).
- **Rack detail** (`assets/rack/make_rack.py` → `build_rack.json`, 339 bodies, still 600 × 1000 × 2200 mm): per tray a front bezel with 2 handles, drive-bay grille, 2 fan rings + hubs, 2 port blocks, 2 PSU slots and green/amber `Led*` bodies; hose stubs + clamps on both cold-plate barbs; louvre vent rows on both sides; rack-U ear rails with ticks; top cable duct; rear PDU strip with 12 sockets; door handle + hinge barrels (door frame moved to y = −468 so the handle stays inside the envelope); 4 casters (uprights start at z = 50). Thin cylinders must stay ≥ 10 mm tall or SolidCraft tessellates them absurdly (OBJ 205 MB → 40 MB at `--quality standard`).
- **Bboxes (world, m)**: rack 0.6 × 1.0 × 2.2 at x −3.5…−2.9, y 1.5…2.5; exchanger 0.868 × 1.328 × 1.62; district slab 240 × 240 (z −6.8…74 with mains/stacks), offset (−30, +30, 0) so the 30 m plant (now at world (−30, +30), three.js (−30, 0, −30)) does not swallow the exchanger; loop pipes end at y = 0.664 on the +Y port faces (x = +0.2, z 1.05 / 0.5).
- **Axes**: glTF is Y-up metres, Blender (x, y, z) → three.js (x, z, −y). Rack lands at three.js (−3.2, 0, −2.0); camera keys in `phases.ts` equal the layout keyframes under that mapping (fov 34° ≙ 39.2 mm on a 24 mm vertical sensor).
- **Bake**: smart-UV AO per asset group (rack 1024, exchanger 2048, district 1024, loops 1024, 32 samples, CPU, ~40 s total), baked albedo = base colour × AO on UV0 (JPEG). The 240 m district slab is excluded (flat material) because its AO streaks.
- **Texture maps** (`bake.py` + `procedural_textures.py`, config in the `detail` block of `scene_layout.json`; PNG/JPEG written to `pipeline/textures/`, embedded in the GLB): a second world-space box-projected UV map `UVDetail` (TEXCOORD_1) carries metallic-roughness maps (brushed streaks for stainless/painted steel/copper, grain for pipes/plastic/concrete), brushed/grain normal maps, a **herringbone chevron normal map on the exchanger plates**, and a **district facade set** (albedo with dark glass windows, warm emissive map for ~38 % lit windows, glass/wall roughness–metal map; roofs sample a window-free texel). Constant emissive: green/amber `Led*` bodies, faint warm glow on copper cold plates.
- **Deliverable**: `app/public/models/scene.glb` = baked export, ~18 MB, 6 meshes / 17 primitives, 17 materials, 29 images, no Draco/extensions → plain `GLTFLoader`. Node names `rack__baked`, `exchanger__baked`, `district__baked`, `loops__baked`, `district__Ground`, `environment__Ground` are unchanged. `pipeline/scene_unbaked.glb` (7.8 MB, flat PBR) is the fallback. `pipeline/inspect_glb.py` prints per-material map channels.
- **Stills**: `pipeline/renders/phase_0…4.png` (1600 × 900, rendered from `scene_baked.blend`, Cycles + OptiX denoise, 20 samples).
- **Run order**: `assemble.py` → `bake.py` (writes `app/public/models/scene.glb` + `pipeline/textures/`) → `render_stills.py -- --samples 20 --blend pipeline/scene_baked.blend`; `export_glb.py` refreshes the unbaked fallback. All scripts honour `DATACOOL_OUT=<dir>` to write products under another root. Ignore Blender's exit code 1 and the cascadio "Failed to remove" noise; judge by `WROTE` / `OK`.
- **Known gaps**: the mains at z = −6 m sit under the opaque slab and are not visible; the lit windows are flat emissive squares (no bloom in the GLB itself).

## 9. What actually shipped — web app

- **Stack**: Vite + React + TypeScript in `app/`; `bun run build` (`tsc --noEmit && vite build`) passes. Run with `bunx vite preview` or `bun run dev`.
- **Shell**: `main.tsx`, `App.tsx`, `styles.css`, `components/VisOverlay.tsx` (fig / big number / caption), plus the existing Header, PhaseSection, SpecStrip and scroll/reduced-motion hooks. Stage sits in an error boundary with a gradient fallback.
- **Scene**: `components/Stage.tsx` is a thin Canvas; modules live in `src/scene/` (CameraRig, Lights, primitives, Rack, Exchanger, District, ProceduralScene, `useSceneModel` GLB loader, GlbEnvironment, GlbMains). `/models/scene.glb` loads first; the procedural scene is the fallback.
- **Axes**: three.js = (x, z, −y) of Blender. `phases.ts` camera keyframes follow that mapping; phase 4 looks at the plant at (−30, 0, −30). Fov is a constant 34°.
- **Not yet verified by eye**: no browser screenshots at 1600×1000 / 500×900 were reviewed for the site. `tools/shots.mjs` (playwright-core, run with `bun tools/shots.mjs <url> app/screenshots`) is ready for that.
- **Tooling note**: all CAD runs through `solidcraft-cli run`; Cycles stills use the OptiX denoiser (DLSS exists in this Blender build only as a viewport preview denoiser).

## 11. Polish round — scene

- **T12 highlight removal (shipped)**: `scene/Hotspots.tsx`, `hotspotData.ts`, `hoverStore.ts`, `tip.css` removed and `<Hotspots/>` unmounted from `Stage.tsx`; no `document.body.style.cursor` side effects remain in scene code. Stage chunk 48.72 kB / 16.71 kB gz → 42.08 kB / 14.34 kB gz.
- **Spline camera system (shipped)**: Created `scene/shots.ts` with 9 Shot definitions (intro, rack, manifold, hall, plant, follow, underground, city, close) containing position, target, hold zones, hero anchors, and optional FOV. Updated `CameraRig.tsx` to use CatmullRom spline interpolation through waypoints with per-shot hold zones (camera nearly still during hold fraction, smooth motion in transitions). Camera path now supports the full scale ladder from macro (~0.4m) to diorama (~220m).

- **Environment & lighting (shipped)**: Created `scene/StudioEnvironment.tsx` with Lightformer-based environment (top softbox, rim light, fill strips, ambient ring) providing per-shot intensity and tint configurations. Added reflective studio floor (MeshReflectorMaterial, blur [400,100], mirror 0.35) for rack/manifold shots. Updated `scene/Lights.tsx` with per-shot lighting configurations, volumetric light cones (additive cone meshes) for studio shots, and increased `GlbEnvironment` intensity from 0.35 to 0.5. Environment resolves "no plain backgrounds" and "metals read as black" issues.

- **Glass pipe overlays (shipped)**: Created `scene/GlassPipes.tsx` with translucent MeshPhysicalMaterial tubes (transmission 0.6, opacity 0.4) overlaying the baked opaque copper pipes. Two main loop segments (supply indigo, return crimson) from rack manifold to exchanger ports, with color band markers (torus geometry) every ~0.5m. Particles flow visibly inside the glass tubes.

- **Hero figures integration (shipped)**: Mounted `scene/Hero.tsx` (created by ts-shell) in `Stage.tsx`. Hero component displays per-shot hero figures (large numbers pinned in 3D) with count-up animations during hold zones, deriving values from `calc(DEFAULTS)`.

- **City animation (shipped)**: Created `scene/CityAnimation.tsx` with heat network light-up: glowing amber tubes (TubeGeometry along CatmullRom curves) animate from plant to buildings during city shots (7-8), and buildings light up (sphere glows with emissive amber) as heat front arrives. Loads `scene.meta.json` for network polylines and building positions when available, with hardcoded fallback network. Animation progress ramps during shot 7 (first half) and completes by shot 8.

- **Stage.tsx integration**: All new components mounted in correct render order: StudioEnvironment, Lights (with cameraT), Hero, GlassPipes, CityAnimation, Flow. Stage chunk grew from 42.08 kB / 14.34 kB gz (T12) to 89.94 kB / 28.74 kB gz with environment and animation additions.

- **Known integration points for other teammates**:
  - `scene.meta.json` (blender-pipeline T3): CityAnimation will use network.polylines and buildings when available.
  - `data/calc.ts` (ts-shell T8): Hero figures consume calc(DEFAULTS) for accurate numbers.
  - Calculator components (ts-shell T8): Currently have build errors outside stage scope.
  - GLB nodes from pipeline: CityAnimation expects network meshes `network__<id>` if baked in GLB.

- **Remaining scene work**: PostFX per-shot presets (DOF for macro, tilt-shift for city, bloom tuning), pipe-follow camera rail from `paths.ts`, visibility culling (hide city/stage/rack+exchanger by shot), material `envMapIntensity` tuning per baked GLB material class. These require final baked GLB with product-grade rack/exchanger (T1/T2) and new geometry (T3).


## 12. Polish round — pipeline (blender-pipeline tasks A-D)

### Task A: Product-grade rack — COMPLETED

**Generator:** `assets/rack/make_rack.py` enhanced from 339 to 513 bodies.

**New features:**
- **UQD quick-disconnect couplings** on every cold plate: stainless base body + colored collars (blue for supply A, red for return B) + barbs extending to cold plate.
- **Braided hoses** with S-bend from coupling to manifold branch, crimp ferrules at both ends.
- **Manifold instrumentation:**
  - 8 pairs of ball valves with lever handles at each branch connection height.
  - Pressure gauges at top of each manifold (left/right).
  - Drain valves with handles at bottom.
- **Logo plate** on front door (180×80 mm) for DataCool branding texture decal.
- **Tray ID label plates** (60×12 mm) on each tray bezel.
- **Status light bar** on door top with 4 LED positions.
- **Cable bundles** in top cable duct (6 cables).
- **PDU inlet cable** from PDU strip to top duct.
- **Lock cylinder** on door handle.
- **Corner brackets** (8) at frame joints.
- **Grounding stud** at base.
- **Retention clips** under each cold plate.
- **Mounting screws** (4) on each cold plate.

**Output:** `assets/rack/rack.{step,obj,sc}`
- STEP: 2.5 MB
- OBJ: 301.7 MB (fine tessellation, 513 named bodies)
- SC: 954 KB

**Tri budget:** Raw OBJ ~600 k tris (will decimate to ≤ 140 k per product-model.md §6).

**Contract preserved:** 600 × 1000 × 2200 mm envelope, ground z=0, front at −Y, all original named bodies (RackFrame, Tray01–08, ColdPlate01–08, ManifoldL/R, Branch01–08, Door) plus 174 new detail bodies.

---

### Task C: Enhanced exchanger frame — COMPLETED

**Generator:** `assets/exchanger/make_frame_enhanced.py` (new, 69 commands, 59 bodies).

**New features:**
- **Gasket strips** (black EPDM) around plate pack perimeter: left, right, bottom, top (8 mm thick).
- **Nameplate** (280 × 180 mm, brushed stainless) riveted to fixed frame front face, positioned for DataCool logo + specification fields texture.
- **Carrying bar** at top (780 × 60 mm) with 4 grip sections.
- **Guide bar** at bottom (780 × 40 mm).
- **Protective sleeves** on all 4 tie rods (Ø28 × 1580 mm, dark plastic).
- **Washers** at tie rod nuts (top and bottom, 8 total).
- **Flow direction label plates** (60 × 40 mm): hot in/out, cold in/out on front and rear faces (8 total).
- **Compression dimension label** (100 × 30 mm) on front.

**Output:** `assets/exchanger/exchanger_frame_enhanced.{step,obj}`
- STEP: 355 KB
- OBJ: 45.2 MB

**Note:** This replaces `exchanger_frame.{step,obj}` in the assembly. `exchanger_core.{step,obj}` and `exchanger_ports.{step,obj}` remain unchanged from the original build.

**Tri budget:** Frame ~120 k (will decimate with core+ports to total ≤ 220 k per product-model.md §6).

---

### Task B: City diorama — COMPLETED

**Generator:** `assets/district/make_city_diorama.py` (new, 200 commands, 94 bodies).

**Features:**
- **Plinth base** 400 × 400 m rounded square, 400 mm thick, with earth cutaway section (topsoil, clay, gravel layers visible on edges down to z = −6.8 m).
- **Street grid:** 5 north–south + 5 east–west streets (6 m wide, 200 mm thick), forming 4×4 block grid (~80 m blocks); crosswalk marks at intersections.
- **Building archetypes** (8, for Blender instancing):
  - ArchLowRise: 5-floor apartment, 18 × 14 × 15 m.
  - ArchMidRise: 8-floor apartment, 20 × 16 × 24 m.
  - ArchTower: 16-floor tower with setback, 16 × 16 × 48 m.
  - ArchSchool: 2-floor L-shape, 40 × 14 + 14 × 26 × 8 m.
  - ArchHospital: 6-floor cross, 30 × 30 + wings, 20 m tall.
  - ArchCivic: 3-floor civic hall, 36 × 24 × 12 m.
  - ArchPool: recreation/pool, 32 × 24 × 8 m + roof.
  - ArchGreenhouse: low glass greenhouse, 28 × 18 × 6 m + peaked roof.
- **Plant building:** 30 × 30 × 15 m with 4 stacks (Ø1.5 m × 8 m) at corners; window openings on all faces for exchanger hall visibility.
- **Park:** 70 × 50 m open green space at (−120, 80).
- **River + bridge:** 300 m long channel (12 m wide, 2 m deep) at y=140 m, bridge with road deck and 4 pillars.
- **Heat network geometry:** trunk X and trunk Y ducts (Ø0.8 m at z = −6 m, 280 m long each); 6 branch ducts (Ø0.6 m) rising to surface; manholes (Ø0.8 m × 0.2 m) at 9 access points.
- **Tree archetype:** simple Ø0.3 m × 8 m cylinder (will be instanced).
- **Lamp archetype:** pole Ø0.12 m × 4.5 m + head 0.6 × 0.4 × 0.2 m.

**Instance layout:** `assets/district/city_layout.json` (110 KB):
- 62 building instances distributed across grid blocks (avoiding plant center), semi-random with seed 42: 30 low-rise, 20 mid-rise, 8 tower, 1 each school/hospital/civic/pool/greenhouse.
- 480 tree instances along streets (15 m spacing, both sides).
- 60 lamp instances (30 m spacing along streets).
- Heat network polyline points for animation (trunk X/Y sample points).

**Output:** `assets/district/district_diorama.{step,obj}` + `city_layout.json`
- STEP: 1.1 MB
- OBJ: 30.6 MB
- Layout JSON: 110 KB

**Tri budget:** Archetypes + infrastructure ~80 k base; instanced total after decimation target ≤ 120 k (product-model.md, scale-story.md §5).

---

### Updated configuration files

**pipeline/scene_layout.json:**
- Added 5 new materials: `uqd_collar_blue` (#7C8BFF indigo), `uqd_collar_red` (#FF6B57 crimson), `gasket_black` (#0D0D0F EPDM), `brass_valve` (#B5A642), `label_plate` (#E9ECF2 white).
- Inserted 10 new rack material rules (UQD collars, valves, gauges, labels, cables, brackets, lock), 5 exchanger rules (gaskets, nameplate, sleeves, labels), 9 city rules (archetypes, plant, streets, trees, lamps, river, earth, network).
- Added detail texture specs for new materials: brushed brass valves, noise-textured EPDM, noise collars, plain labels.

**app/public/models/scene.meta.json** (new, 6 KB):
- Node name mappings: rack__baked, exchanger__baked, district__baked, loops__baked, district__Ground, environment__Ground.
- **Hall** section: 10 rack instances positioned in 2 rows × 5 (1.2 m pitch, 1.8 m cold aisle), rotations 0/π, bounds (−5.4, −2.5, 0) to (0.6, 2.5, 2.2).
- **Plant** section: position (−30, 30, 0), size 30 × 30 × 15 m.
- **Network** section: 6 polylines (trunk_x, trunk_y, branch_01–04) with point arrays for flow animation; trunk points every ~40 m, branches from plant to building endpoints with z rise from −6 to 0.
- **Buildings** array: 10 sample entries (id, archetype, position m, rotation rad, distanceAlongNetwork m) for light-up animation; full list (62) in city_layout.json.
- **Waypoints**: 13 named camera positions for spline rig (establish, rack_macro, manifold, hall_entry, hall_aisle, exchanger, plant_orbit, pipe_follow_start/mid, underground, city_emerge, city_rise, city_wide).
- **Bounds**: per-asset bboxes for culling (rack, exchanger, hall, plant, district).

---

### Task D: Rebake — NOT COMPLETED (blocked on Blender pipeline execution)

**Required steps:**
1. **Update `pipeline/assemble.py`** to import:
   - `assets/rack/rack.obj` (enhanced, 513 bodies).
   - `assets/exchanger/exchanger_frame_enhanced.obj` + existing `exchanger_core.obj` + `exchanger_ports.obj`.
   - `assets/district/district_diorama.obj` as base geometry + instance buildings/trees/lamps from `city_layout.json`.
   - Existing `loop_pipes` procedural geometry.
2. **Apply materials** per updated `scene_layout.json` rules (24 new rules, 5 new materials).
3. **Decimate** meshes per optimize config: rack to ≤ 140 k, exchanger to ≤ 220 k, district base + instances to ≤ 120 k (total scene ≤ 600 k tris).
4. **Instance rack** 10 times for data hall per `scene.meta.json` hall.rackInstances (share one baked mesh).
5. **Instance city** archetypes per `city_layout.json` (62 buildings, 480 trees, 60 lamps).
6. **Bake AO** per existing `pipeline/bake.py`: rack 1024², exchanger 2048², district 1024², loops 1024² (32 samples, CPU, albedo = base × AO).
7. **Apply procedural detail textures** per `pipeline/procedural_textures.py` and `scene_layout.json` detail specs (brushed normals, chevron on plates, facade windows, new materials).
8. **Export `app/public/models/scene.glb`** with Draco or plain GLTFLoader, target ≤ 25 MB (current 18 MB → expect ~22 MB with instancing savings).
9. **Preserve node names:** `rack__baked`, `exchanger__baked`, `district__baked`, `loops__baked`, `district__Ground`, `environment__Ground`.

**Blocker:** This requires running Blender 5.4 headless with the updated scripts. The enhanced assets and configuration are ready; the Blender execution step needs either:
- Lead to run `blender.exe -b --factory-startup -P pipeline/assemble.py` then `bake.py` with the updated scripts.
- OR pipeline teammate to be granted direct Blender execution capability (currently asset generation only via SolidCraft CLI completed).

**Deliverables staged in repository:**
- Enhanced source assets: `assets/rack/rack.*`, `assets/exchanger/exchanger_frame_enhanced.*`, `assets/district/district_diorama.*`, `city_layout.json`.
- Updated configuration: `pipeline/scene_layout.json`, `app/public/models/scene.meta.json`.
- Generators committed: `make_rack.py`, `make_frame_enhanced.py`, `make_city_diorama.py`.

**Missing assets (deferred/optional per scale-story.md §4):**
- **Plant room interior detail:** pumps, headers, expansion tank, control cabinet, piping. The plant *building shell* exists in the city diorama (30 m cube with stacks and windows); the interior equipment is not modeled. Can use the existing exchanger as the anchor and add placeholder boxes in Blender, or defer to ts-stage to add procedural equipment in three.js.
- **Hall ceiling/floor detail:** The hall layout is defined in `scene.meta.json` with 10 rack instances; floor, ceiling grid, cable trays, overhead headers are not modeled. Again, can be added procedurally in three.js or as simple Blender boxes.

**Acceptance (when Task D completes):**
- `app/public/models/scene.glb` ≤ 25 MB, loads in three.js GLTFLoader.
- Node names `rack__baked`, `exchanger__baked`, `district__baked` present with expected materials.
- `scene.meta.json` lists all instances, polylines, waypoints; ts-stage can parse and render.
- Screenshot stills at 1600×900 from updated `pipeline/render_stills.py` show: enhanced rack front with UQD couplings and logo, exchanger with nameplate and gaskets, city diorama with buildings/streets/network visible.
- Tri count report from `inspect_glb.py`: rack ≤ 140 k, exchanger ≤ 220 k, district ≤ 120 k, loops ≤ 5 k, total ≤ 600 k.

---

### Summary of pipeline deliverables (T1–T3, partial T4)

| Task | Asset | Status | Files | Bodies | Size |
| --- | --- | --- | --- | --- | --- |
| T1 (A) | Enhanced rack | ✓ Complete | rack.step/obj/sc | 513 | 2.5 MB / 301 MB |
| T2 (C) | Enhanced exchanger | ✓ Frame only | exchanger_frame_enhanced.step/obj | 59 | 355 KB / 45 MB |
| T3 (B) | City diorama | ✓ Complete | district_diorama.step/obj + layout | 94 + 602 inst | 1.1 MB / 30.6 MB |
| — | Config | ✓ Complete | scene_layout.json, scene.meta.json | — | 28 KB / 6 KB |
| T3 | Plant room interior | ⊗ Deferred | (not modeled) | — | — |
| T3 | Hall ceiling/floor | ⊗ Deferred | (not modeled) | — | — |
| T4 (D) | Rebake scene.glb | ⊗ Blocked | (Blender execution needed) | — | target ≤ 25 MB |

**Next steps for lead or ts-stage:**
1. Run updated `pipeline/assemble.py` + `bake.py` in Blender to produce final `scene.glb`.
2. Verify GLB loads in three.js and instance data in `scene.meta.json` parses correctly.
3. Add procedural hall/plant detail in three.js if needed (floor, ceiling, headers, pumps).
4. Take acceptance screenshots per agent-tasks.md T1–T3.
