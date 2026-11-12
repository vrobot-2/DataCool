# Review checklist

Use this before declaring any workstream done. Numbers are compared against
`docs/production-plan.md`.

## Assets

- [ ] `.step`, `.obj`, `.sc` and `*_preview.png` all exist and are non-zero.
- [ ] Preview PNG visually reads as the intended part; no detached bodies, no interpenetration.
- [ ] Bounding box within 2 % of the contract (mm / 1000 when read in Blender).
- [ ] Ground sits at z = 0; front faces −Y.
- [ ] Bodies have meaningful names; plate pack has exactly 72 separate plates.
- [ ] No materials in CAD.
- [ ] STEP reloads in Blender as the expected body/mesh count.

## Stitch / bake

- [ ] `scene_layout.json` matches the placement table.
- [ ] `assemble.py` logs real vs placeholder sources.
- [ ] No asset floats above the floor or intersects the plant.
- [ ] Materials separated by group: frame, stainless, copper, concrete, glass, pipe.
- [ ] Camera keyframes 0–4 frame the right subject.
- [ ] `scene.glb` re-imports with the same objects; file size sane (< 40 MB).
- [ ] AO bake UVs are non-overlapping and textures resolve in the web app.
- [ ] Stills are exposed correctly, not black, not clipped.

## Web

- [ ] `npm run build` clean, no TypeScript errors.
- [ ] Spec Sheet typography and bottom strip match `site/variant-spec.html`.
- [ ] Scroll changes phase, palette, metrics and camera without popping.
- [ ] GLB loads; fallback scene renders if it is missing.
- [ ] 1600×1000 and 500×900 layouts both fit with no horizontal overflow.
- [ ] Reduced motion disables animation; canvas is aria-hidden.
- [ ] First load stays under the perf budget (JS < 180 KB gzip before three is excluded from
      the budget note; document the real number).

## Handover

- [ ] Docs list actual commands, bboxes, body counts and known gaps.
- [ ] No agent-owned folder edited by another workstream.
- [ ] Temp screenshots and scripts removed or clearly marked.
