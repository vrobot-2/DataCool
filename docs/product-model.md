# Product-grade models (rack, exchanger, plant room)

Problem: "the rough model and rack doesn't look like a true product yet". The current meshes are accurate CAD (contract-correct bounding boxes, named bodies) but read as CAD, not as a designed product. This doc lists what a product-design pass adds and *how* in our pipeline (SolidCraft CLI → STEP/OBJ → Blender assemble/bake → GLB → three).

## 1. What makes something look like a real product

1. **Edge treatment.** Real parts never have razor-sharp 90° edges. Add bevels/chamfers/fillets (0.5–3 mm depending on part) so edges catch highlights. This is the single biggest "CAD → product" jump.
2. **Seams, gaps, fasteners.** Panel splits, shadow gaps, gaskets, rivets/screws at believable pitch, hinge barrels, latches.
3. **Brand and labelling.** Logo on door/nameplate, serial/data plate with real fields, safety and flow-direction labels, colour-coded hot/cold tags, rack-U numbering.
4. **Materials with story.** Powder-coat with fine speckle, anodised aluminium, brushed and bead-blasted stainless, black EPDM gaskets, copper with oxidation hint, zinc-plated bolts, glossy black bezels, emissive status LEDs, a small glass/LCD status screen.
5. **Cables and hoses.** Cable bundles with ties, braided hoses with crimp collars, quick-disconnect couplings (UQD style) on every cold plate, drip trays.
6. **Instrumentation.** Pressure gauges, temperature probes/thermowells, flow meters, leak sensors, valves with handles.
7. **Wear-free imperfection.** Slight roughness variation, edge wear on paint, tiny normal noise. Not dirty — just not CG-perfect.

## 2. Rack (`assets/rack/`)

Contract stays: 600 × 1000 × 2200 mm, named bodies `RackFrame, Tray01–08, ColdPlate01–08, ManifoldL/R, Branch01–08, Door` (+ existing `Led*`, detail bodies). Current: 339 bodies, 85.6 k tris, generator `assets/rack/make_rack.py`.

Additions for product look (cap rack at ≤ 140 k tris):

| Area | Add |
| --- | --- |
| Door | Perforated mesh pattern as an **alpha/normal texture** (not geometry); brushed-aluminium handle with lock cylinder; hinge barrels; **DataCool logo** plate (embossed, accent colour); a small status light bar. |
| Frame | Bevelled uprights, powder-coat; corner brackets; rack-U numbering ticks as texture; ground bonding stud; adjustable feet over casters. |
| Trays | Stamped front bezel with slotted vents (normal map), recessed handles, tray ID label, **UQD-style quick disconnects** (two per cold plate, blue/red collars), braided hose with crimp ferrules and an S-bend, retention clip. |
| Cold plate | Visible micro-channel fin hint through a transparent window? (skip) — instead: machined copper top with engraved flow arrow and 4 screws, silicone gasket line. |
| Manifold | Insulated sleeve sections with strap bands; isolation ball valves with lever handles at each branch; pressure gauge top; drain valve bottom; flow-direction arrow decals; supply (indigo) / return (crimson) colour bands. |
| Rear | PDU with inlet cable, labelled sockets, cable management arms with Velcro ties, zip-tied bundles following the upright, a leak-detection rope along the floor. |
| Top | Cable duct with cutouts; coolant inlet/outlet flange to the loop header; small beacon/status LED. |

Implementation notes:
- Bevel in Blender, not CAD: apply a **Bevel modifier** (1 segment, 0.6–1.5 mm, angle limit 40°, harden normals) + **Weighted Normal** to the rack bodies in `assemble.py` before decimation; check tri count. Alternatively apply `solid.fillet` on key bodies in the SolidCraft script (edges picked by point) where cheap.
- Use **normal-map-baked detail** for vents, perforations, engraving (`pipeline/procedural_textures.py` already generates maps; extend it) rather than geometry.
- Cables: build in Blender as bevelled curves (`assemble.py`), convert to mesh, material `rubber_black` / `hose_braided`.
- Keep thin cylinders ≥ 10 mm tall in CAD or the OBJ explodes (known trap).
- Logo: bake the SVG into a 1024² emissive/albedo decal texture (white on dark) and place it as a quad with a slight emboss normal.

## 3. Exchanger (`assets/exchanger/`)

Contract stays: 868 × 1328 × 1620 mm; frame, core (72 plates), ports.

Additions:
- **Gasket lines** visible around the plate pack edges (black rubber strip, slightly proud).
- **Carrying bar (top) and guide bar (bottom)** under the moving frame; the real product look of a gasketed plate exchanger.
- Tie rods with **washers, nuts, protective sleeves**; compression dimension label.
- **Nameplate**: DataCool logo + fields (model, serial, duty, design pressure/temp, year); riveted, brushed stainless.
- **Painted frame** (DataCool accent or deep graphite), with a **flow-direction label set** (hot in/out, cold in/out) and arrows.
- **Port connections**: flange studs/nuts (not just bolts), spiral-wound gasket ring peeking between flanges, bolt caps, **temperature probes (thermowells + cables)** and **pressure gauges** on the inlets, **drain and vent valves** at low/high points.
- Optional **insulation jacket** panels (quilted, with straps) on part of the pack, colour-coded, hiding detail where geometry is expensive.
- Chevron plate relief: keep as normal map (already in GLB), but add **edge-light AO** so plate edges read in the macro shot.

## 4. Plant room (new asset, `assets/plant/`)

Needed by the scale story (`scale-story.md` §3): a compact mechanical room so the exchanger sits in a believable place.
- Floor with painted safety lines; walls/ceiling (open on the camera side), cable trays, unistrut racks, supply/return headers with **insulation + colour bands**, circulation pumps (two, with motors), expansion tank, valves, gauges, a control cabinet with status screen, floor drain, sump.
- Budget ≤ 60 k tris. Reuse exchanger, loop pipe, valve, gauge meshes as instances.

## 5. Materials table (final target)

| Key | Look | Notes |
| --- | --- | --- |
| `powdercoat_graphite` | #2A2E34, rough 0.55, speckle normal | rack frame, exchanger frame |
| `anodized_silver` | #B9BEC6, metal 1, rough 0.35, brushed streaks | door handle, trims |
| `stainless_brushed` | #B9BEC6, metal 1, rough 0.30, long streaks | plates, flanges, nameplate |
| `copper_machined` | #B87333, metal 1, rough 0.28 | cold plates |
| `epdm_black` | #0D0D0F, rough 0.85 | gaskets, hoses |
| `hose_braided` | grey weave normal, rough 0.7 | braided lines |
| `accent_supply`, `accent_return` | indigo #7C8BFF / crimson #FF6B57, emissive 0.25 | colour bands, quick-disconnect collars |
| `led_green/amber/white` | emissive 1.0 | status |
| `glass_dark` | #1A1D22, rough 0.08 | door window, LCD |

## 6. Acceptance

- At 1600×1000, the rack front and the exchanger macro each look like a catalogue render (reviewed on screenshots and Cycles stills).
- Bevels visible on all primary silhouettes; no sharp-edge aliasing flicker in motion.
- Branding visible on rack door and exchanger nameplate; at least four product labels legible in macro.
- Rack ≤ 140 k tris, exchanger ≤ 220 k, GLB budget per `polish-plan.md` §6.
- Contract bodies and node names preserved (the GLB node names are used by the scene code; the hotspot feature that also used them is being removed — see `polish-plan.md` §8).
