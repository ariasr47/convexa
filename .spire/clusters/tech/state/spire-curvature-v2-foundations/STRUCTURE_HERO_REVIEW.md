# Structure hero — design review against the design source (2026-09-07)

**Trigger:** owner, looking at `/ticker/SPY` on the local build after phase 3 closed: *"The structure widget does
not look that good, have we not gotten to this part of the re-design? Its styling and design look off."*
**Reviewer:** conductor (this is analysis, not a gate verdict). **Method:** the running app on `:4200` against
`design/site/desk.html` served from `design/site/` — both at 1280 px, element-screenshotted with Playwright at
2× — plus the phase-2 pipeline records to find out *why* they differ. Every anchor below was re-checked with
`grep -n` on the working tree at the time of writing.

## The one-paragraph answer

Phase 2 (`curvature-v2-desk-and-read`) rebuilt the hero's **semantics** — one liveness predicate, the retention
latch, the five-row ladder model, the closed not-a-number vocabulary — and QA held every one of those to the
letter. It never held the hero's **composition** to the design source. `PLAN.md:1205` hands the lane an
illustrative vertical stack (`Canvas → LevelLadder → TapeTrailRow → StructurePathStrip`) and the lane built
exactly that; `design/src/screens/desk.mjs:19-25` specifies a two-column `field-grid` with a 300 px ladder
column, and no acceptance criterion in the phase-2 SPEC compares the two. So the shipped hero is the plan's
placeholder layout, not the design. It is **1,225 px tall at 1280 wide; the design is 488 px.**

## Measured

| measure | shipped (`localhost:4200`) | design source (`desk.html`) |
|---|---|---|
| hero panel height @ 1280 | **1,225 px** | **488 px** |
| hero panel height @ 393 | 1,391 px | ladder collapses to a 5-cell row, then 2×2 (`ladder.mjs:7`, `desk.mjs:53,67`) |
| field x-window (SPY, spot 770.19) | **$694–$847** = spot ±10 % (`chart.tsx:26-27`) | 549–601 around 573 = ±4.5 % (`lib.mjs:254`) |
| wall span as a share of the plot | 760→780 = 20 pts of 153 = **13 %** | 560→580 = 20 pts of 52 = 38 % |
| strikes in the window | 31 at $5 step; \|GEX\| top-3 1,430 / 1,024 / 890 $M vs median 3 $M → a flat line with spikes | 26 bars, curve + area |
| axis | `$694` / `$847` corners + `± dealer γ` (`paintStep.ts:471-474`) | strike ticks every $10 and ±$M y ticks (`lib.mjs:278-284`) |
| ladder row | 20 px `FigureCell` card, ~130 px tall each (`LevelLadder.tsx:75-107`, `FigureCell.tsx:68-90`) | one 12/14/11 line, 7 px padding, hairline (`ladder.mjs:22-29`); mid row 18 px |

## Findings, most severe first

**S1 · Composition.** Five regions stacked full-width instead of the design's `field-grid` (field + tape row +
path row left; `Levels` column right with the foot pinned to its bottom by `margin-top: auto`). Source of the
divergence: `PLAN.md:1163-1205` (FE-6 step 1). Design: `desk.mjs:19-25, 298-333`. Canon 14 names
`design/src/components/ladder.mjs` as the ladder's source and says field and ladder "read as one object";
they cannot when the ladder starts 600 px below the field.

**S1 · The ladder is five figure cards.** Each row is a 20 px `FigureCell` with label above and caption below,
in its own raised card. The design's row is a single line: tick · label 12 px · value Mono 14 px · distance
Mono 11 px, with the mid row at 18 px and a `tape` chip. Five numbers take ~650 px here and ~180 px there.
`LevelLadder.tsx:75-107`, `LadderFoot.tsx:23` vs `ladder.mjs:11-29`.

**S1 · The field window is 7.7× the wall span.** `windowedStrikes` (`chart.tsx:26-27`) keeps
`spot × 0.9 … spot × 1.1` or the walls, whichever is wider. For SPY that is $694–$847 while every level sits
between $751 and $780, so the structure the panel exists to show occupies 13 % of the plot and the rest is
the flat tail of 31 five-dollar strikes whose median |GEX| is 3 $M. This — more than any styling — is why the
curve reads as noise. Suggested rule: window = walls ± max(1.5 % of spot, 25 % of the wall span), widened
only as far as needed to keep flip and max pain inside.

**S2 · No scale.** Two dollar figures in the corners and `+ dealer γ` / `− dealer γ`. A trader cannot read a
strike or a magnitude off the field. Design: `lib.mjs:278-284`.

**S2 · Marker labels.** `spot $770.2` (`paintStep.ts:444`, `toFixed(1)`) and `live $770.19` (`:682`) are the
same price labelled twice, 0.6 px apart, stacked in lanes with `flip` inside the plot; the design draws one
`● mid 573.12` pill on the zero line and puts level labels **above** the plot in Mono 10
(`lib.mjs:276-277`). The field's labels are Sans 11 (`paintStep.ts:418,462,679`) while every other traced
figure on the desk is Mono (canon 13).

**S2 · Max pain is in the ladder but not in the field.** Canon 14: "each row's tick uses the same stroke as its
line in the structure field". `paintStep.ts:397-415` draws put, call, spot and flip — no max pain; the model
(`types.ts`) has no `maxPain` field at all. Design draws it dashed steel (`lib.mjs:306`). The ladder's
max-pain tick therefore points at a line that does not exist.

**S2 · Header.** No legend (design: `call-dominated · put-dominated · flip`, `desk.mjs:296`). Toggle reads
`Levels | Magnet` (`StructureHeroPanel.tsx:231-234`) — a leftover from `DealerPositioning`; it switches the
*canvas* between the field and the magnet, the levels stay either way, so the design's `Field | Magnet` is
the honest label. The panel is titled with the symbol (`:214`, as PLAN specified) 30 px under a 30 px
masthead that already says `SPY`; the design titles it `Structure field`.

**S3 · Nested chrome.** The tape row is a rounded, bordered card inside the panel (`TapePulseStrip.tsx:221-229`)
with a 60 px canvas that, at rest, is one horizontal line; the design is a flat hairline row with a 30 px
sparkline and `last 573.10 · ▲ 4 · ▼ 2`. The path strip paints its own darker well and a bottom border
(`StructurePathStrip.tsx:99-101`) that becomes a seam above the panel's rounded corner.

**S3 · Padding.** `bodyPad="none"` (`StructureHeroPanel.tsx:218`) plus children that carry no inset of their
own puts `distance from levels @ $770.19` and the foot cells flush against the panel border.

**S3 · Magnet view.** 200 px canvas (`WallMagnetView.tsx:22`) so the panel changes height on toggle; module-
level hex literals (`:8-15`, exempted at `hex-discipline.spec.ts:64`) so it ignores the light scheme; the
design's magnet carries the reading `+0.81% above the flip · dealers dampen moves here` (`lib.mjs:339`).

**S3 · 393 px.** 1,391 px tall; phase 4 owns the responsive sweep, but the ladder's `5-cell row → 2×2` is the
same component change as the desktop column.

**Note · design site.** `design/site/desk.html` leaks template text into the seg control
(`" data-on="showField">Field`) because `{{fieldSegClass}}` sits inside a `class` attribute at
`desk.mjs:296`. Cosmetic to the design site only; regenerate after fixing the placeholder.

## What is right and must not move

The liveness semantics: `Mid` unconditional, the pause mark + `offline · last known` on a drop, the ladder's
five-tuple and its distance anchor stated once, `NOT_LIVE` on the foot cells, the single store read. Canon 11
locks the field's diverging form (no return to horizontal bars). Z-1 stands. None of the above findings need a
semantic change; they are composition, scale and type.

## How it should be handled

- **Recommended:** open phase 4 with a **structure-hero fidelity** contract as its first item — the design
  source is already the spec, so GATE C is light; one frontend lane (Sonnet); six files
  (`StructureHeroPanel`, `LevelLadder`, `LadderFoot`, `TapePulseStrip` chrome, `chart.tsx` window,
  `paintStep.ts` labels/axis/max-pain); QA adds a composition row that measures the hero against
  `desk.html` at 1280 / 1000 / 393.
- Alternative: a direct repair lane now, off-pipeline. Faster, but this is the desk's primary instrument and
  the working agreement says design before build.
- Not recommended: fold it into the phase-4 responsive sweep unlabelled — the desktop composition is the
  actual defect, not the breakpoints.

## The rest of `/ticker`, region by region (added the same day)

Live page **4,615 px** tall at 1280 vs the design's **2,601 px**. The hero explains ~740 px of the gap; the
context band explains ~1,400 px. Inventory from the DOM (`widget-*` testids, y / height):

| region | design (`desk.mjs`) | live | fidelity |
|---|---|---|---|
| nav | four links · ⌘K · session chip | same | **close** |
| masthead | bare on the ink: 42 px display `SPY 573.12 +1.84 · +0.32%`, chips incl. `● Last trade`, a second line `Levels @ · Structure as-of · refreshes · All expirations`, quick row with 8 names + `Universe member · 69 tracked`, compact inline `Expirations` / `Persona` fields, **one** amber pill `+ Open simulated trade` | inside a raised panel (`command-deck`, 273 px); `SPY · $770.19` with `(levels @ …)` in parentheses; no change/%; a **form row** `TICKER / EXPIRATIONS / PERSONA` with labels above; quick row of 3; the CTA is a grey card with a `Sign in` button | **partial** — content right, framing and control shape wrong |
| zone labels | none (the design has one `CONTEXT` header with an `All · Flow · Vol · Positioning` filter) | `STRUCTURE` · `TAPE & PLAN` · `SUPPORTING CONTEXT` caps labels | extra |
| structure hero | 488 px field-grid | 1,225 px stack — **being repaired** | far |
| read strip | a single strip panel, **no title**, 8 cells split by hairlines (`1.35fr + 7×1fr`, fits 1280), the opportunity cell carries the **ring**, values 18–20 Mono **with sub-captions** (`near wall · IV cheap · 2 setups`, `options look cheap`, `2nd quartile · 41st pct`) | a `Widget` titled *Read strip* with a subtitle, 8 **cards** of fixed 140 px each with ⓘ icons and no captions; the rail **overflows and clips** the 8th cell (`OFF-EXCHA… not p`) at 1280; no ring | **partial** — right eight slots, wrong chrome, clipped |
| tape & plan | the **AI read is the wide 2/3 panel** (verdict-first), a 1/3 right column stacks Live tape (2×2 figures + flow spark), Your position, Sim orders | **Live tape full-width first** (4 cards + empty space), then a full-width *Your book* bar, then AI recommendation ‖ Simulated orders as two **half-width 249 px** panels; signed-out AI state is a `Sign in to ask AI` button in a rounded well (design's signed-out copy: `desk.mjs:196`) | **far** — the phase-2 SPEC's own "wide AI brief beside tape / position / orders" is not what renders |
| context band | one `CONTEXT` header + filter, **3-column grid of quiet cards ~200 px** each: Projected dealer flow (two bars), Market context (2×2 values), Term structure (5 tenor chips + slope), Straddle-implied move (range bar), Fresh positioning (3 rows), Off-exchange (3 bars), Setups (2 cards), Add a widget — ~710 px total | **2-column bento, ~1,960 px**: Projected dealer flow full-width 270; Market context full-width **485** (4 sub-cards × 3 figures, ⓘ on every one); IV rank ‖ Straddle; Term structure ‖ Fresh positioning at **470** (the chart card is stretched to the 8-row list beside it, leaving ~250 px of empty panel under the chart); Off-exchange alone; Setups full-width; Add widget | **far** — density and grid |

Same cause as everywhere else: phase 2's SPEC named the *order* (masthead → hero → strip → brief → band) and
the strip's *slot count*, and both hold; it never named the grid, the card chrome or the density, and the
phase-3 "quiet band widget internals" task was explicitly "no size, layout or order change".

## Site-wide survey (added the same day — owner asked "what about the other parts?")

Same method: live `:4200` vs `design/site/*.html` at 1280. Signed-in surfaces rendered with the e2e fixture's
own approach — a Playwright route answering `/api/auth/session` with `authenticated: true`
(`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:207-218`); no account created, no password entered.
Data endpoints behind the mock return 403, so books are empty and prices show `—` (the market was closed).

| surface | phase | live vs design, in one line | fidelity |
|---|---|---|---|
| `/ticker` masthead · nav · read strip | 2 / 1 | symbol + mid, chips, controls, quick row, eight strip cells — the SPEC named these structures and they match | **close** |
| `/ticker` structure hero | 2 | stack vs `field-grid`; 1,225 px vs 488 px (above) | **far** |
| `/scanner` | 3 | table exists with the right columns; missing the score bar, tier-coloured chips, per-row age treatment, the hover preview card, the three footer cards (`scanner.mjs`); filters are one flat chip row instead of *Your view · presets* | **partial** |
| `/positions` | 3 | design: two figure cells (capital at risk · net P/L) + one action, `Simulated | Live·read-only`, `Open · Pending · History`, one table, track record as four compact cards. Live: small Net P/L box top-right, nested *Simulated orders* card, a second controls row, filter chips, track record as ~14 paragraphs of prose in the empty state, archive buttons | **far** |
| `/alerts` | 3 | design: two columns — *New rule* card (segmented Kind, score presets) beside *Rules* (toggles) and *Fired*. Live: one centred column of MUI outlined fields with floating labels, `Rules (0)` / `Recent (0)` as headings | **far** |
| `/settings` | 3 | design: two columns with a section nav (deferred by owner ruling D-B), effective-cap block, provider tabs + verified-key state + model select. Live: one centred column of cards; the section nav, effective cap and provider chrome are absent | **partial** (nav deferral is recorded; the rest is not) |
| `/` landing · `/methodology` · `/blog` | 4 | still v1 — expected, phase 4 has not opened | n/a |

**Why it is systemic, with the receipts:**

1. **The canon itself demoted composition to intent.** `DESIGN_SYSTEM.md:256` item (7): *"masthead → structure
   field hero → read strip → wide AI brief → quiet context band (**design intent for the build, not a
   line-by-line canon rule**)"*. The pipeline enforces canon rules; it has no instrument for intent.
2. **No BRIEF after phase 1 named a design screen.** Phase 1's BRIEF cites `design/site/library.html` (the
   component sheet); phases 2 and 3 cite none of `design/src/screens/*.mjs` or `design/site/*.html`.
   Phase 3's SPEC references `settings.mjs` once (for a false footnote) and `scanner.mjs` / `alerts.mjs` /
   `positions.mjs` never.
3. **The council reads the screens for copy and semantics, not shape.** Phase 2's UX voice cites
   `desk.mjs:294, 324-325, 337, 341` — the basis line, the two foot cells, a chip colour, a caption — and
   writes state tables. Its agent file (`.claude/agents/spire-tech-ux.md`) binds it to the canon; the R1/R2/S2
   prompts do not mention `design/` at all.
4. **Every acceptance criterion is a behaviour.** Phase 2: 51 `test` + 10 `review` rows; phase 3: 78 + 13.
   None reads "matches `<screen>.html` at 1280 / 393". QA's seat is *observe the criterion*
   (`spire-tech-qa.md:24-48`) and its design-review skill compares "with the stated intent" — the SPEC —
   so QA measured the SPEC faithfully and the SPEC did not carry the screens.
5. **Plans' illustrative JSX became layout.** `PLAN.md:1205` (phase 2, FE-6) is the hero's shipped structure
   verbatim. Build lanes are told to implement every state and consume exactly the interface fields; with
   no composition target, the placeholder is the target.

Net effect: three phases installed v2's **vocabulary** everywhere they touched — tokens, the three faces,
figure cells, chips, the closed vocabulary, liveness — on top of v1's **layouts**, except where a SPEC
happened to name a structure (nav, masthead, the eight-slot strip). That is why every page "has the new
look" up close and reads as the old product at arm's length.

**Fix for the pipeline, not just the hero:** phase 4's SPEC (and any repair contract) carries one
**composition row per surface** — `matches design/site/<screen>.html at 1280 / 1000 / 393, measured` —
with the design's generated page as the oracle, and BRIEFs name the screen files in `Considered:`.

## Process note for the ledger

A phase can pass QA 60/0/1 with a hero that does not match the design it cites. The gap is a missing row
type: *"composition matches the design source"* — measured, at named widths, against the generated
`design/site/*.html`. Phase 4's SPEC should carry one such row per surface it touches.

Evidence: `scratchpad/live-hero-1280.png`, `design-hero-1280.png`, `live-hero-magnet-1280.png`,
`live-hero-393.png`, `live-desk-1280.png`, `design-desk-1280.png` (session scratchpad, 2026-09-07) and the
published review page.
