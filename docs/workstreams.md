# Workstreams

Five parallel workstreams, 2026-11-09. Each owns its folder and must not edit the others'.

| # | Workstream | Owns | Deliverable | Status |
| --- | --- | --- | --- | --- |
| 1 | Rack model | `assets/rack/` | rack STEP/OBJ/SC + preview | done — 28 bodies, 600×1000×2200 mm |
| 2 | Exchanger model | `assets/exchanger/` | frame, core, ports (3 STEP sets) + previews | running |
| 3 | District model | `assets/district/` | city plot + plant + mains STEP + preview | done — 40 bodies, 240×240 m |
| 4 | Spec Sheet web app | `app/` | Vite/React/TS site + R3F viewer + fallback scene | running |
| 5 | Stitch/bake pipeline | `pipeline/`, `app/public/models/` | scene layout, assemble, bake, GLB, stills, encoder | running |

## Round 2 (blocked on round 1)

- Stitch real assets into `pipeline/scene.blend` and replace the placeholder GLB.
- Bake AO/normal maps and export the final `app/public/models/scene.glb`.
- Integrate the GLB into the web app; tune camera keyframes against real geometry.
- Render the five validation stills; review framing and materials.
- Port the Spec Sheet into production styling only if the web agent's implementation drifts
  from `site/variant-spec.html`.
- Update docs with actual bboxes, poly counts and commands.

## Coordination rules

- No shared SolidCraft MCP session: modeling runs independent CLI processes.
- Web source and pipeline output overlap only at `app/public/models/` (pipeline writes, app reads).
- Blender is the only place materials are assigned; CAD stays geometry-only.
- Every asset's origin is its ground centre; stitching applies placement from
  `pipeline/scene_layout.json`.
