# Art direction

Goal: a premium hardware-launch look in the locked "Spec Sheet" typography (Archivo + IBM Plex Mono, 12-col grid), on top of a 3D scene that never shows a plain flat background and never looks like a CAD viewport.

## 1. Concept: "technical dusk"

Dark graphite stage, precision lighting, glass-and-metal products, colour-coded energy (indigo cold → crimson hot → amber city), warm dusk at the city. Think hardware launch page crossed with an engineering datasheet.

Colour tokens (existing + additions):

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | #0B0E13 | page base |
| `--panel` | #12161D | glass panels |
| `--cold` | #7C8BFF | supply / inlet / indigo |
| `--hot` | #FF6B57 | return / hot / crimson |
| `--amber` | #FFB45C | district / revenue |
| `--ink` | #E9ECF2 | text |
| `--mute` | #8A93A3 | secondary text |
| `--money` | #5CE0A0 | savings / positive $ (calculator only) |

## 2. Per-shot environments (no plain backgrounds)

| Shot | Environment | Key light | Backdrop |
| --- | --- | --- | --- |
| Establish / rack macro | **Studio stage**: dark cyclorama, glossy floor (MeshReflectorMaterial, blurred, 0.35 mirror) | cool top softbox + warm rim | gradient cyc with a faint hex grid fading to horizon |
| Manifold | same stage, tighter | accent-coloured kickers on the pipes | volumetric light cones |
| Data hall | **Interior**: polished concrete, ceiling grid, cold-aisle blue light strips, warm hot-aisle spill | linear area lights | depth haze, floor reflections |
| Plant room | industrial interior, painted floor lines, equipment shadows | overhead panel lights + accent bounce | steam wisps near headers |
| Pipe-follow / underground | **Cutaway slab**: layered soil, duct bank | pipe core emissive acts as key | dark earth, floating dust |
| City | **Diorama dusk**: warm horizon, low sun, tilt-shift | warm sun + cool sky fill | gradient sky, soft clouds band, stars high |
| Calculator | quiet gradient with a subtle moving mesh/noise, no 3D focus | — | `--bg` with a radial brand glow |

## 3. Lighting and reflections

- **Environment lighting:** a studio HDRI-like environment (drei `<Environment>` with a custom Lightformer rig: two long strips, one softbox, one rim) so metals reflect something. Per-phase intensity/tint, driven by `cameraT`. This is the main reason the metals read dark now.
- **Baked GLB materials:** raise `envMapIntensity` per material class (metals 1.0–1.4, plastic 0.6, concrete 0.3) after the environment lands.
- **Shadows:** contact shadows under every product; soft directional shadow in the city; no shadow from the 600 m ground (receive only, already done).
- **Volumetrics (fake):** additive cone meshes with a noise shader for the stage lights and plant-room ceiling lights; billboard dust particles in light cones.

## 4. Pipes and energy

- **Translucent glass pipes** (MeshPhysicalMaterial with transmission or a cheap alpha + fresnel) with the **flow particles visibly inside**; colour bands (indigo supply, crimson return) every ~0.5 m, insulation sleeves with strap bands where specified.
- Pipe core emissive subtly pulses with flow rate; bloom keeps it glowing. Replace the current opaque orange loop pipes (baked `accent_pipe`) with a thin brand-colour core and a glass jacket (instanced overlay, don't double the GLB geometry; hide the baked pipe mesh where the overlay replaces it).
- Heat shimmer (screen-space refraction wobble) near the hot return only, tiny amplitude.

## 5. Post-processing stack (already shipped; tune)

Order: SMAA/MSAA → N8AO-lite or SSAO only if cheap → **depth of field** (macro shots only: focus on subject, background blurs; tilt-shift in the city) → Bloom (per-phase) → ToneMapping (AgX/ACES) → Vignette → light grain/chroma. Per-phase presets in one table. Tier degrade stays (`PerformanceMonitor`).

## 6. Typography, layout, UI motion

- Keep Archivo (wdth 62–125) + IBM Plex Mono. **Hero numerals**: Archivo wdth ~90, weight 800, tabular-nums, `clamp(56px, 9vw, 168px)`.
- Panels: glass (blur 14–18 px, 1 px hairline, subtle noise), 8 px grid, consistent mono labels.
- Headings tied to the scene: leader lines end at objects with a 6 px dot; labels never overlap hero figures (collision pass in `Annotations`).
- Motion language: ease `cubic-bezier(.22,1,.36,1)`, 280–520 ms, stagger 40 ms; camera moves use damped springs; no bounce on text.
- Cursor: dot + ring (shipped), magnetic stepper dots (the ring label on 3D hotspots goes away with the highlight feature, `polish-plan.md` §8); on the calculator the ring turns `--money` over sliders.
- Branding: logo in header, preloader, favicon (shipped); add **logo on the rack door and exchanger nameplate in the 3D models** (see `product-model.md`), and as a watermark in the calculator diagram.

## 7. Preloader polish

Logo draw-on animation (stroke reveal on the logo paths), progress bar with real GLB progress, status lines; on completion the preloader wipes to reveal the establish shot with the camera already in a slow drift.

## 8. Acceptance

- No frame in the scroll story shows a flat colour fill as the dominant background.
- Metals show clear environment reflections; no material looks "black hole" dark in any shot.
- Pipes read as glass tubes with flowing fluid, with colour-coded bands.
- Macro shots have depth of field; city has tilt-shift; each shot has a distinct, deliberate lighting mood.
- Visual consistency: tokens and type scale used everywhere; calculator matches the page.
