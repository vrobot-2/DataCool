# SolidCraft → Blender: fast path for agents

Reference for any agent (human or mini) that has to get a real, parametric model out of
SolidCraft and into a Blender render without rediscovering the traps. Everything here was
verified on this machine on 2026-11-09 with SolidCraft (Nov 7 build) and Blender 5.4.0 Alpha.

---

## 1. The two installs

| Tool | Path | Notes |
| --- | --- | --- |
| SolidCraft CLI | `C:\Users\vivaa\Downloads\solidcraft\solidcraft-cli.exe` | headless engine + MCP server |
| SolidCraft app | `C:\Users\vivaa\Downloads\solidcraft\solidcraft.exe` | optional; if open, the MCP bridges to it |
| Blender | `C:\Users\vivaa\Downloads\blender\blender.exe` | 5.4.0 Alpha, portable |

Everything runs headless. The user does not need to open either app for the pipeline to work.

---

## 2. MCP setup (opencode)

Registered in `C:\Users\vivaa\.config\opencode\opencode.jsonc`:

```jsonc
"mcp": {
  "solidcraft": {
    "type": "local",
    "command": [
      "C:\\Users\\vivaa\\Downloads\\solidcraft\\solidcraft-cli.exe",
      "mcp",
      "--allow-path",
      "C:\\coding-project\\datacool"
    ]
  }
}
```

`--allow-path` is mandatory: the server refuses to read/write outside the listed roots.
Add one flag per project root. After editing the config, restart the MCP or the session; the
tools appear as `tools.solidcraft.*` inside `execute`.

Backend line in the server instructions tells you where you are:
- `Backend: headless` → in-process session, nothing visible to the user.
- `Backend: connected to the SolidCraft app` → drives their open window.

A headless session keeps its design across tool calls but is lost when the server restarts.
**Save early** (`.sc`), reopen with `open` if needed.

---

## 3. SolidCraft command shapes

Units are **millimetres** and **degrees**. Any numeric field may be an expression over
parameters: `"w/2 - wall - 6"`, `"FW*0.86"`, `"30 deg"`, `"16 in"`.

### Build route
1. `parameters.add { name, expression, unit? }` — `unit: ""` for dimensionless counts.
2. `solid.box { length, width, height, center:[x,y,z], name }` — `center` is available on
   *creation*; note `timeline.edit` uses `corner` (see traps).
3. `solid.cylinder { radius, height, base:[x,y,z], axis:[x,y,z]|"X"|"Y"|"Z", operation, name }`.
4. `solid.fillet { body, edges:[[x,y,z],...], radius }` — edges are picked by a point near them.
5. `solid.pattern.rectangular { features:["Plate01"], dir1, count1, spacing1 }` — clones the
   feature; each clone becomes its own body (`Plate01…Plate72`).
6. `sketch.create { plane:"XY"|"XZ"|"YZ"|{origin,x_dir,y_dir}, offset }` →
   `sketch.rectangle.center` / `sketch.circle.center` / `sketch.line` → `sketch.finish` →
   `solid.extrude { distance, direction:"positive"|"negative", operation }`.

### Sketch plane axes (this is where everyone gets it wrong)

| `plane` | sketch x | sketch y | +distance is along |
| --- | --- | --- | --- |
| `XY` | +X | +Y | +Z |
| `XZ` | +X | **−Z** | +Y |
| `YZ` | +Y | +Z | +X |

So a circle at world height `z` on a face at `y = -620` is drawn at sketch coord
`[x, -z]` on an `XZ` plane with `offset: -620`.

### Checkpoints that actually catch errors
- After each stage: `measure {}` (returns JSON **string**) → compare body count, `closed`,
  total bbox and volume against numbers you computed first.
- `body_topology` for cylinder origins/axes when a hole is suspiciously placed.
- `check_parameters { set:{...} }` to prove the design follows its parameters, then it
  restores them.
- `inspect_design { measure:false, sketches:false }` is cheap — call it before assuming empty.

---

## 4. Traps (all hit for real)

1. **`timeline.edit` field names are the feature's own, not the creation args.**
   Boxes expose `body_names, corner, height, length, width, operation` — **no `center`**.
   `{"unknown field \"center\"; BoxFeature has ... corner ..."}` is the error. Re-express the
   centre as a corner: `center:[x,y,z]` with `length,width,height` → `corner:[x-l/2, y-w/2, z-h/2]`.
   Run `timeline.inspect` to see the exact field list of any feature.
2. **`measure` and friends return JSON encoded as a string.** `JSON.parse` once (sometimes
   the MCP wrapper stringifies twice — loop until `typeof v === "object"`).
3. **`batch` is all-or-nothing.** On error the earlier steps are rolled back and the reply
   names the failing `index`, its `error`, `applied` and `not_run`. Fix and resend; do not
   try to reason about partial state.
4. **A pattern needs the base feature name**, not an index. Spacing is centre-to-centre.
5. **Boilerplate warning** — every reply may end with "this is a headless session…". It is
   informational, not an error.
6. **Sketch must end at dof 0.** `sketch.solve` reports it; an under-constrained sketch will
   extrude unpredictably.
7. **`solid.extrude` on a closed profile with `operation:"new"`** makes a new body; to cut,
   target an existing body with `operation:"cut", targets:["Body"]`.
8. **Export is per-format**; STEP and OBJ are independent writes. Export both — STEP for
   fidelity, OBJ as the fallback.

---

## 5. Export

From the MCP, or equivalently with the CLI:

```powershell
solidcraft-cli.exe run --in design.sc --out design.step --out design.obj --quality fine
```

Via MCP tool shape:

```js
await tools.solidcraft.export({ path: ".../heat_exchanger.step", format: "step" });
await tools.solidcraft.export({ path: ".../heat_exchanger.obj",  format: "obj"  });
await tools.solidcraft.save({ path: ".../heat_exchanger.sc" });
```

Reference sizes for the exchanger: `.sc` ≈ 0.26 MB, `.step` ≈ 0.87 MB, `.obj` ≈ 30 MB
(fine tessellation). Prefer STEP whenever the importer is available.

---

## 6. Blender 5.4 has NO built-in STEP importer

`bpy.ops.wm.step_import` is declared in some builds but the add-on is not bundled — calling
it raises `could not be found`. You must install an extension. This is the one that works:

- Extension: **STEP Importer 1.2.1** (`step_importer`), from `extensions.blender.org`.
- Direct archive used here: `proof/tools/step_importer.zip` (16 MB).
- Install target repo: `user_default` (persists in the portable Blender's user config).

### Install (once per Blender install)

```powershell
& blender.exe -b --factory-startup --python-expr @"
import bpy
bpy.ops.extensions.package_install_files(
    filepath=r'C:\coding-project\datacool\proof\tools\step_importer.zip',
    repo='user_default', enable_on_install=True)
"@
```

### Enable order (critical)

`bpy.ops.wm.read_factory_settings()` **disables all extensions**, including one installed
with `enable_on_install=True`. The operator also lives under a different namespace than you
expect:

| Guess | Reality |
| --- | --- |
| `bpy.ops.wm.step_import` | ❌ not found |
| `bpy.ops.import_scene.step` | ✅ correct operator |

So the only order that works:

```python
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.step_importer")
bpy.ops.import_scene.step(filepath=r"...\heat_exchanger.step")
```

Enable **after** the factory reset, never before. Module id is
`bl_ext.user_default.step_importer`.

### Import result and scale

- The STEP comes in as **one merged mesh** (~7.8 k polys for the exchanger), Z-up,
  already at **metre** scale — bbox `(-0.434,-0.664,0) … (0.434,0.664,1.620)`.
- Do **not** apply a scale factor to STEP. The OBJ path needs the opposite:
  `bpy.ops.wm.obj_import(global_scale=0.001, forward_axis='Y', up_axis='Z')`.
- Useful `import_scene.step` properties: `up_axis`, `rotation_deg`, `scale`, `merge_objects`,
  `origin_offset` (`KEEP|CENTERXY|CENTERXYZ|BOTTOM`), `use_assembly_collections`.

---

## 7. Render recipe (clay proof, no compositing)

Script: `proof/render_clay.py`. Env switches: `PROOF_SOURCE=step|obj`, `PROOF_QUALITY=test|final`.

- Engine **Cycles**, GPU (`OPTIX`; a HIP warning on AMD is harmless).
- **No compositor**: `scene.use_nodes = False`. Blender 5.2+ replaced `scene.node_tree` with
  `scene.compositing_node_group` and `CompositorNodeComposite` with `NodeGroupOutput`; the
  old compositor recipes fail. Just turn it off.
- One neutral clay material for everything (`Base Color 0.30,0.30,0.31`, `Roughness 0.72`),
  no textures, no per-part finishes.
- Smoothing: weld doubles at `1e-5`, then per-edge smooth where face angle ≤ 34°, all polys
  `use_smooth = True`. This keeps machined flats crisp and rounds smooth.
- Four area lights (key / rim / fill / top) + dark world `0.055,0.062,0.075`.
- `AgX`, look `AgX - Medium High Contrast`, exposure `-0.55`.
- `final` = 1600×1160, 192 samples, adaptive, denoise; renders in ~12 s on this GPU.
- Camera `(3.30,-3.40,1.36)`, 55 mm, aimed at `(0,0.02,0.86)`.

Run:

```powershell
$env:PROOF_SOURCE="step"; $env:PROOF_QUALITY="final"
& blender.exe -b --factory-startup -P proof/render_clay.py
```

Blender returns exit code 1 in this portable build even on success because of the HIP
warning on stderr — judge by `WROTE …` and the PNG, not the exit code.

---

## 8. End-to-end checklist

1. MCP up, `inspect_design` shows the expected state.
2. Parameters added before geometry; all sizes are expressions.
3. Build in 2–3 `batch` calls; `measure` after each and compare to your own numbers.
4. `save` the `.sc`.
5. `export` STEP (and OBJ as fallback).
6. Blender: factory reset → enable `bl_ext.user_default.step_importer` → `import_scene.step`.
7. Weld + smooth + clay → lights → camera → Cycles/AgX, compositor off → render.
8. Verify the PNG visually; a `WROTE` line alone does not prove framing.

---

## 9. What still limits realism

Geometry, not rendering, is the ceiling. Known gaps in the current exchanger:
flat plate stack instead of chevron-corrugated plates; ribs read as applied bars rather than
cast ribs; straight port stubs with no elbows/manifolds; no gaskets, collars or sensor
detail. Fixing these in SolidCraft (swept/lofted corrugation, port routing) buys more than
any look-dev change.
