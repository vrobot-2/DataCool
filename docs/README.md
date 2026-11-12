# DataCool docs index

Written 2026-11-09, before the "polish" round starts. Nothing in these files has been implemented yet unless it says **(shipped)**.

| File | What it is |
| --- | --- |
| [`production-plan.md`](production-plan.md) | Original contracts: assets, scene layout, web app, bake. §8 and §9 record what shipped (Blender and web). |
| [`solidcraft-blender.md`](solidcraft-blender.md) | Reference for the SolidCraft → Blender path and its traps. |
| [`polish-plan.md`](polish-plan.md) | **Master plan** for the polish round: goals, user feedback verbatim, workstreams, order, acceptance. Start here. |
| [`product-model.md`](product-model.md) | Making the rack and exchanger look like real, shippable products. |
| [`scale-story.md`](scale-story.md) | Fixing the rack → city jump: shot list, camera, city diorama, film-quality budget. |
| [`art-direction.md`](art-direction.md) | Look and feel: backgrounds, lighting, reflections, pipes, post, type, motion. |
| [`numbers-and-calculator.md`](numbers-and-calculator.md) | Hero figures, the end-of-page calculator, the cartoon 2D diagram, graphs, the "Customise your solution" call to action. |
| [`agent-tasks.md`](agent-tasks.md) | Concrete task cards per teammate: scope, inputs, outputs, acceptance, constraints. |
| [`screenshot-review.md`](screenshot-review.md) | What the current build actually looks like (screenshots taken before any polish work). |

## Open questions (blockers)

1. **"Take you to this site"**: the user said the end call to action "Customise your solution" should take you "to this site" but no URL came with the message. The URL is a placeholder (`CTA_URL`) in [`numbers-and-calculator.md`](numbers-and-calculator.md) until provided. Needed: the URL, and whether to pass calculator values as query parameters.
2. Confirm hero-figure style once the first look-dev frame exists (see `numbers-and-calculator.md` §2).
3. Confirm the film-quality budget (`scale-story.md` §6): one pre-rendered clip vs. none.

## Decisions log

- **Highlight feature removal (user, 2026-11-09):** the part-highlighting / hover-details (hotspots) feature is to be removed. Spec in `polish-plan.md` §8, task T12 in `agent-tasks.md`. No new hotspots for new assets.
- **Film quality:** only a cheap optional clip (`scale-story.md` §6).
- **Hero figures:** approved. **Calculator + cartoon diagram + graphs + "Customise your solution" CTA:** requested (`numbers-and-calculator.md`).

## Working conventions (all agents)

- Package manager and runner: **bun** (`bun install`, `bun run build`, `bunx vite preview`, `bun tools/shots.mjs`).
- CAD only through `solidcraft-cli run script.json` (never the MCP), UTF-8 JSON without BOM; mm in CAD, m in Blender and web; Z-up and −Y front in CAD/Blender; three.js = (x, z, −y) of Blender.
- Blender renders: Cycles + OptiX denoiser (DLSS exists only as a viewport preview denoiser in this build).
- Teammate shells have been confined and could not write `assets/`, `pipeline/`, `app/public/models`, `docs/`; they stage binaries under `build/` and the lead copies them in, then deletes `build/`. Text edits through the file tools work everywhere.
- Keep `scene.glb` node names stable: `rack__baked`, `exchanger__baked`, `district__baked`, `loops__baked`, `district__Ground`, `environment__Ground`.
