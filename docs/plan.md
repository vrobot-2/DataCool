# DataCool — full build plan

> **Revision note (2026-11-09, later):** the delivery decision changed after the UI
> comparison. The site now uses the **Spec Sheet** direction and a **real-time R3F demo with
> baked assets**, not a pre-rendered image sequence. Read
> [`production-plan.md`](./production-plan.md) for the authoritative asset, pipeline and web
> contracts. This file stays as the story, phase and budget reference.

Status: planning locked on 2026-11-09. Every open decision below is **decided**, not proposed.
Anything marked *(locked)* should not be reopened without a written reason.

---

## 1. Goal

A scroll-driven product site for **DataCool**, a direct-to-chip heat-recovery system. One
continuous camera move follows heat from die → rack manifold → transport loop → heat
exchanger → district heating mains. The site must feel photoreal, load fast, and work on a
mid-range laptop without a discrete GPU.

Two deliverables at the end:
1. **A real 3D asset** modelled in SolidCraft, exported STEP, shaded and animated in Blender.
2. **A production website** that plays the render as a scroll-scrubbed sequence with live
   telemetry HUD.

The current `site/index.html` is the **blockout**: layout, copy, palette, scroll pacing and
HUD behaviour only. No 3D, no assets.

---

## 2. Locked decisions

| Area | Decision | Why |
| --- | --- | --- |
| Modeling | **SolidCraft**, parametric, driven through its MCP | editable, real B-rep, STEP out |
| Exchange format | **STEP** (`.sc` → `.step`), OBJ only as fallback | fidelity, one merged mesh |
| Render | **Blender 5.4 + Cycles**, STEP Importer 1.2.1 | verified working |
| Look | **Sub-photoreal**: PBR + real lighting, no photorealism obsession | plausible, not cinema |
| Compositing | **Off** in Blender | version breakage + we grade in the browser |
| Materials | Clay for geometry proofs; **full PBR for the hero render** | proofs stay honest, hero sells |
| Web stack | **Vite + React + TypeScript**, Tailwind, Lenis, GSAP ScrollTrigger | static, no server |
| 3D on site | **None.** Pre-rendered image sequence | perf; no model imports ever |
| Sequence format | **AVIF frames + WebP fallback**, `1600×900`, 2 sets @ 48 and 96 frames | size vs. smoothness |
| HUD | DOM + CSS, animated counters, driven by scroll phase | no canvas needed |
| Deploy | static export to any CDN (Cloudflare Pages primary) | zero backend |
| Fonts | system stack for blockout; **self-hosted variable sans** for production | CLS, latency |
| Browser floor | evergreen Chrome/Edge/Safari/Firefox, ≥ 360 px wide | modern-only |

---

## 3. Story / phases

Five sections, mapped 1:1 to camera moves and to HUD state.

| # | Section | Palette (bg / accent) | Camera | HUD |
| --- | --- | --- | --- | --- |
| 0 | Intro — "every rack is a radiator" | `#0A0F1A` / `#7C8BFF` | wide establishing drift | 24 °C, 0 % |
| 1 | Capture — direct-to-chip plates | `#341310` / `#FF6B57` | macro push into rack interior | 85 °C, 62 % |
| 2 | Transport — sealed extraction | `#141A5E` / `#8FA2FF` | dolly back along manifold | 4.2 L/s, 0 % evap |
| 3 | Exchange — plate core | `#4A2B0C` / `#FFC266` | slow orbit around exchanger | 96.4 %, 0 % mix |
| 4 | Reuse — district energy | `#1B1420` / `#FFB45C` | rise through slab to skyline | 1420 t/yr, 12000 homes |
| — | End — loop closes | `#0A0F1A` | static title | carries phase 4 |

Camera path is authored as a single spline in Blender; each section samples a defined
time range so the web scrub maps linearly to `scrollY / maxScroll`.

---

## 4. Asset pipeline

```
SolidCraft (.sc, parametric)
   └─ export STEP ──► Blender import_scene.step (metre scale, Z-up, merged)
        └─ shade: clay proof → PBR hero
             └─ animate: one camera rig, 5 keyed moves
                  └─ render: 1600×900 EXR/PNG per frame
                       └─ encode: AVIF (+ WebP) sequence, 2 resolutions
                            └─ site: <canvas>/<img> scrub driven by ScrollTrigger
```

Details and traps are in [`solidcraft-blender.md`](./solidcraft-blender.md). Non-negotiables:

- Parameters first, geometry as expressions, `measure` after every batch.
- STEP import **after** `read_factory_settings` + `addon_enable`.
- Hero render: PBR only after geometry is signed off (no amount of shading fixes chevron-less
  plates or stub ports).
- Every frame identical camera/lights/exposure — the sequence must scrub without popping.

### Geometry upgrade backlog (in value order)

1. **Chevron-corrugated plate pack** — biggest realism jump.
2. **Port elbows / manifold routing** — sells "closed loop".
3. **Cast-looking frame ribs** — blend/fillet rather than applied bars.
4. Gaskets, port collars, sensors, cable trays.
5. Skid feet, nameplate engraving, paint seams.

---

## 5. Website build

### Structure
```
src/
  main.tsx
  App.tsx
  sections/         Intro, Capture, Transport, Exchange, Reuse, End
  components/       Hud, ProgressBar, Sequence canvas, CopyBlock, VisualFrame
  hooks/            useScrollPhase, useCounter, useSequenceScrub
  data/phases.ts    single source of truth for copy + telemetry + palette
  styles/           tokens.css, type.css
public/
  seq/1600/{000..095}.avif
  seq/960/{000..095}.avif
```

### Scroll model
- **Lenis** smooth scroll wrapper.
- **GSAP ScrollTrigger** one timeline for the whole page; pin a full-viewport sequence
  canvas and scrub it across the 5 phases.
- Each section is a trigger that sets the active phase → palette, copy, HUD values.
- HUD counters tween over ~900 ms with cubic ease-out on phase entry (as in the blockout).
- Reduced motion: no scrub animation, show a representative still per phase, instant jumps.

### Sequence scrub
- Preload first frame + every 8th frame eagerly; load the rest in the background.
- Draw via a single `<canvas>` (not `<img>` swapping) to avoid decode jank.
- Scrub index = `clamp(round(progress * (frames-1)))`.
- If a frame isn't ready, hold the last decoded one (never blank).

### Telemetry spec (single source `data/phases.ts`)
```ts
type Metric = { label: string; value: number; suffix: string; decimals?: number };
type Phase = {
  id: string; no: string; title: string; eyebrow: string;
  lede: string; notes: string[]; callout: string;
  bg: string; accent: string; metrics: [Metric, Metric];
};
```
Copy and numbers live only here; sections map over it. No duplicated strings.

---

## 6. Performance budget

| Metric | Target |
| --- | --- |
| LCP (mobile 4G) | < 2.5 s |
| CLS | < 0.02 |
| JS (gzip) | < 180 KB |
| First sequence frame (AVIF) | < 120 KB |
| Full 96-frame 1600 set | < 9 MB total, lazy |
| Full 96-frame 960 set | < 3.5 MB total |
| Scroll frame time | ≥ 55 fps on integrated GPU |
| Lighthouse perf | ≥ 90 desktop, ≥ 80 mobile |

Mitigations if over budget: drop to 48 frames at 1600, lower one resolution tier, increase
AVIF CRF, defer non-hero sections until first interaction.

---

## 7. Milestones

| M | Deliverable | Done when |
| --- | --- | --- |
| M0 | Blockout site | `site/index.html` — **done** |
| M1 | Reference + pipeline docs | `docs/solidcraft-blender.md`, this file — **done** |
| M2 | Geometry upgrade pass (plate pack, ports) | `measure` matches plan, clay render approved |
| M3 | Hero PBR look-dev | one still that reads as a real exchanger |
| M4 | Camera animation + sequence render | 96 clean, pop-free frames |
| M5 | Production site (Vite/React) | scroll scrub + HUD at 55 fps |
| M6 | Perf, a11y, deploy | budgets met, live on CDN |

Each milestone is a review gate. Do not start look-dev before M2 is signed off.

---

## 8. Open risks

- **STEP tessellation quality** for dense corrugation — may need `--quality finest` or a
  Blender remesh; verify poly count stays under ~1 M.
- **Sequence weight** — 96 AVIF frames can blow the mobile budget; keep the 48-frame tier as
  the mobile default.
- **GPU portability** — Cycles GPU is machine-specific; always keep a CPU path for renders.
- **Copy accuracy** — all telemetry numbers are placeholders until confirmed by the client;
  they live in one file so they're cheap to replace.
