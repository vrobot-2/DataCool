# DataCool showcase

A SolidCraft → Blender → real-time web pipeline for a direct-to-chip heat-recovery product
site. Five phases follow heat from die to district mains, with a persistent spec-sheet HUD.

## Where things are

| Path | What |
| --- | --- |
| `docs/production-plan.md` | **Authoritative** asset, pipeline and web contracts |
| `docs/solidcraft-blender.md` | SolidCraft → STEP → Blender fast path and traps |
| `docs/plan.md` | Story, phase/camera plan, perf budget |
| `docs/workstreams.md` | Current split of work and owners |
| `assets/rack/` | Server rack, cold plates, rear manifold |
| `assets/exchanger/` | Plate exchanger, split into frame / core / ports |
| `assets/district/` | 240 m city plot, plant, underground mains |
| `pipeline/` | Blender stitching, bake, GLB export, stills, encoding |
| `app/` | Vite + React + TS Spec Sheet site with R3F viewer |
| `site/variants.html` | The three UI directions (Spec Sheet is chosen) |
| `proof/` | Original single-piece exchanger proof and clay render |

## Run

```powershell
# model a piece (independent process, parallel-safe)
C:\Users\vivaa\Downloads\solidcraft\solidcraft-cli.exe run assets\rack\build_rack.json `
  --out assets\rack\rack.step --out assets\rack\rack.obj --save assets\rack\rack.sc --quality fine

# Blender pipeline
C:\Users\vivaa\Downloads\blender\blender.exe -b --factory-startup -P pipeline\assemble.py
C:\Users\vivaa\Downloads\blender\blender.exe -b --factory-startup -P pipeline\render_stills.py

# site
cd app
npm install
npm run dev
npm run build
```

## Rules

- mm in SolidCraft, metres in Blender/web. Z up, −Y front.
- Modeling uses separate `solidcraft-cli` processes; never the shared MCP session.
- STEP import needs `read_factory_settings` first, then
  `addon_enable("bl_ext.user_default.step_importer")`, then `import_scene.step`.
- The Spec Sheet is locked: Archivo + IBM Plex Mono, graphite base, bottom spec strip.
