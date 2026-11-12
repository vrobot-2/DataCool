# Numbers, hero figures and the calculator

User asks: numbers "aren't represented well"; **hero figures are good**; add a **calculator at the end** with a **cartoonish animated 2D diagram of what they save over time**, plus **graphs and figures**; the end should say **"Customise your solution"** and take the user **to a site** (URL pending).

## 1. Current state (shipped)

- `app/src/data/phases.ts` exports `ASSUMPTIONS` and `derive()`; copy and strip metrics derive from it.
- Defaults: 15 MW campus, 85 % load, 8,760 h, $0.09/kWh, cooling 0.30 → 0.08 kW per kW IT, 70 % heat captured, 96.4 % exchanger effectiveness, 40 K delta, 85 kW pumping, heat sold $38/MWh, gas displaced $0.045/kWh-th, 0.202 t CO₂/MWh-th, carbon $85/t, 12 MWh/home/yr, $26 M capex.
- Outputs: cooling saved $2.2 M/yr, heat revenue $2.9 M/yr, gas avoided for the city $3.4 M/yr, carbon value $1.3 M/yr, total headline $6.4 M/yr, payback 4.1 yr, ≈ 6,280 homes.

### Known modelling issues to fix first

1. **Headline mixes cash and non-cash.** `totalUsd = cooling saved + heat revenue + carbon value`. Carbon value is not cash to the operator. Split into **Operator cash benefit** = cooling saved + heat revenue − pumping cost, and **Societal value** = carbon value (+ city gas avoided shown as the city's saving, not the operator's). The payback should use operator cash benefit.
2. **Pumping cost ($0.67 M/yr) is shown but not netted** against the benefit.
3. **Capex is a fixed $26 M** regardless of size. The calculator needs capex per MW (default ≈ $1.7 M/MW from 26/15) plus an optional fixed plant/pipeline cost.
4. **Heat sale is flat at $38/MWh** with no capture-of-demand limit; add a "heat demand utilisation" input (default 90 %).
5. **Cooling baseline** comparison should show the air-cooled case explicitly (0.30 kW/kW) and DataCool (0.08) as the two bars.
6. Everything must be labelled **Modelled · assumptions editable**.

## 2. Hero figures (pinned in 3D)

One huge number per shot, set in Archivo (condensed, wide numerals) with a mono label and a one-line "how", attached to the object it describes, with a thin leader line (reuse the `Annotations` machinery; the numbers sit next to, not on top of, the object).

| Shot | Figure | Label | Source |
| --- | --- | --- | --- |
| Establish | `$X.XM / yr` | Operator cash benefit | derive() operator cash |
| Rack macro | `$2.2M` | Cooling bill avoided / yr | coolingSavedUsd |
| Manifold | `4.2 L/s` | Sealed flow carrying `X MW` | flowLps, heatMWth |
| Data hall | `13 MW` | Heat captured, not exhausted | avgITMW × capture |
| Plant room | `$2.9M` | Heat revenue / yr | heatRevenueUsd |
| Pipe-follow | `X GWh` | Heat delivered / yr | heatMWh |
| Underground | `$3.4M` | City gas bill avoided / yr | gasAvoidedUsd |
| City | `6,280` | Homes heated | homes |
| Close | `4.1 yr` | Payback | paybackYears |

Rules:
- Numbers count up when their shot enters the hold zone, then freeze (tabular figures). Reduced motion: no counting.
- Always one hero per shot; supporting figures go to the hover cards or the strip.
- Mobile: hero shrinks (`clamp`) and docks to the bottom third.
- Every figure has a plain-text equivalent (`aria-label`) and a "how is this calculated" footnote link to the calculator assumptions.

## 3. Calculator (end of page)

Section after the closing wide shot. Layout (desktop): left = inputs, centre = **animated cartoon diagram**, right = big result figures; below = graphs. Mobile: stacked, diagram first.

### Inputs

| Input | Control | Range | Default |
| --- | --- | --- | --- |
| IT capacity | slider + number | 1–100 MW | 15 |
| Average load | slider | 40–100 % | 85 |
| Electricity price | slider | $0.03–0.30/kWh | 0.09 |
| Cooling today (kW per kW IT) | slider | 0.15–0.60 | 0.30 |
| Heat captured in liquid | slider | 40–90 % | 70 |
| Heat sale price | slider | $0–120/MWh | 38 |
| Heat demand utilisation | slider | 30–100 % | 90 |
| Gas price displaced | slider | $0.02–0.12/kWh-th | 0.045 |
| Carbon price | slider | $0–200/t | 85 |
| Capex | number | $/MW (default 1.73 M) + fixed | derived |
| Horizon | segmented | 5 / 10 / 15 years | 10 |

Preset chips: "Edge site 2 MW", "Enterprise 15 MW", "Hyperscale 80 MW". "Reset" returns to defaults. State kept in the URL hash so a configuration is shareable.

### Outputs (headline cards)

1. **Operator cash benefit / yr** (cooling saved + heat revenue − pumping).
2. **Payback (years)** and **10-year net** (cumulative cash − capex).
3. **Heat delivered** MWh/yr and **homes heated**.
4. **CO₂ avoided** t/yr and carbon value (labelled societal).
5. **City gas bill avoided** (labelled city benefit).

All derived by one pure function (`calc(inputs) → outputs` in `app/src/data/calc.ts`) shared by the hero figures (so the scroll story and the calculator can never disagree). Unit tests for the function (bun test): defaults match the existing derive() within rounding after fixes in §1.

## 4. Cartoon 2D animated diagram — "what you save over time"

Style: flat, chunky outlines, soft shadows, palette from the brand (indigo #7C8BFF, crimson #FF6B57, amber #FFB45C, graphite #0B0E13, off-white); friendly, playful, but still on-brand and readable. Pure **SVG + CSS/SMIL or requestAnimationFrame** (no libraries; GSAP was removed for bloat).

Scene (left → right), one continuous strip that changes with the **time slider (Year 0 → horizon)**:

1. **Server racks** (3 cartoon racks) puffing wavy red heat lines. With DataCool, the heat lines are captured into a pipe (animated droplets).
2. **Pipe + exchanger** icon in the middle; droplets flow (speed ∝ MW), a little thermometer drops from red to blue on the return.
3. **City** on the right: little houses/windows light up in proportion to homes heated; chimney smoke from boilers fades as years pass (gas avoided).
4. **Top lane: "Without DataCool"** — a cartoon money-burning meter: coins fly out of a cooling unit into a flame; a grey bar of cumulative cooling spend grows.
5. **Bottom lane: "With DataCool"** — coins flow back: a coin stack (piggy bank or vault) grows year by year; the capex appears as an initial dip (a big coin drops out), then the stack climbs, crossing the **payback line** with a confetti pop.
6. **Time slider / play button:** scrub or press play to watch years pass; labelled ticks at 0, payback year, horizon. A big floating counter shows cumulative $.
7. A **mascot** (a small droplet or a heart-shaped spark) points to key moments with speech bubbles ("Payback in year 4!").

Behaviours: autoplay once when the section scrolls into view; manual scrub overrides; reduced motion = static final frame with tabs for year 0/payback/horizon; every moving element has a text equivalent in an `aria-live` summary.

## 5. Graphs and figures

Hand-rolled SVG charts (no chart library):

1. **Cumulative cash flow** (line/area): DataCool vs. baseline, crossing zero at payback; shaded net gain; hover shows year + $.
2. **Annual benefit stack** (stacked bars by year or a single stacked bar): cooling saved, heat revenue, minus pumping; with carbon value as a separate hatched segment.
3. **Energy flow** (Sankey-style simplified): IT electricity → heat → captured → delivered to city; losses shown; widths proportional to MW.
4. **Cooling energy per kW IT**: two bars, 0.30 vs 0.08 with a "−73 %" badge.
5. **Sensitivity strip**: tornado of ±20 % on electricity price, heat price, capture fraction, capex vs. payback years.

Figures row: headline cards (§3) with count-up and `Δ vs baseline` chips. Copy: a one-line "what this means" sentence updated live (e.g. "A 15 MW site pays back in 4.1 years and keeps 6,280 homes warm.").

## 6. Call to action: "Customise your solution"

- Final section title: **Customise your solution**, with a primary button of the same label and a secondary "Download this scenario (PDF/CSV)" later (optional).
- Behaviour: the button opens `CTA_URL` in a new tab (`rel="noopener"`), and appends the calculator state as query parameters (agreed schema: `it_mw`, `load`, `elec`, `cooling_before`, `capture`, `heat_price`, `util`, `gas`, `carbon`, `capex_per_mw`, `years`, plus `utm_source=datacool-site`). If the target site does not accept parameters, link bare.
- `CTA_URL = TBD` (**the user did not include the URL**; ask). Put it in `app/src/data/site.ts` as the single source (`export const CTA_URL`), with an env override `VITE_CTA_URL`.
- Also add the same CTA to the header (small) after the preloader.
- Track clicks: `window.dispatchEvent(new CustomEvent('datacool:cta', { detail }))` (no analytics dependency).

## 7. Files (planned)

- `app/src/data/calc.ts` (+ `calc.test.ts`) — pure calculator model.
- `app/src/data/site.ts` — CTA URL and share-link helpers.
- `app/src/components/calculator/Calculator.tsx`, `Inputs.tsx`, `Cartoon.tsx` (SVG), `Charts.tsx`, `Results.tsx`, `calculator.css`.
- `app/src/scene/Annotations.tsx` / hero-figure component — updated to use the same `calc()`.
- `phases.ts` — copy and strip derived from `calc()` defaults; the `end` phase scrolls into the calculator section.

## 8. Acceptance

- Hero figure per shot, pinned, legible at 1600×1000 and 500×900, derived from `calc()`.
- Calculator: all inputs live; outputs, cartoon and all five graphs update within a frame; time slider/play works; keyboard operable; reduced-motion safe.
- Numbers reconcile: defaults match the scroll story exactly; cash vs. societal vs. city benefit separated and labelled.
- "Customise your solution" appears at the end and opens the supplied URL with parameters.
- Bundle impact of the calculator ≤ 40 kB gz, lazy-loaded when the section nears the viewport.
