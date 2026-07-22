# redesign-stage-2 — FRONTEND_EXECUTION_CONTRACT

> **Lane:** GATE V fast-path (UX → Frontend). **Backend lane: `NO_BACKEND_CHANGE`** — no
> INTERFACE_CONTRACT, no BACKEND_EXECUTION_CONTRACT; the **empty `apps/api` diff is itself an
> acceptance criterion** (§7 / §9).
>
> **Rule-of-record:** `.claude/skills/convexa-design/SKILL.md` (Direction ACTIVE; the arc-in-
> exactly-3-places + ONE-motion rules and their enforcement table) +
> `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md` **§3 "The signature" verbatim** (the three
> placements: mark / hero curve-draw / arc dividers; the cut 4th idea — a curved data-frame edge on
> the GEX chart — **STAYS CUT**) + §5 Stage 2 + §6a rulings · `.claude/DESIGN_RULES.md`.
>
> **What Stage 2 is:** THE SIGNATURE lands at the **component layer** — the convex arc spent in
> exactly three places and nowhere else (**a 4th use is a violation, not a flourish**): (1) the
> CONVEXA mark, (2) the one orchestrated hero curve-draw moment, (3) shared arc dividers. Plus the
> landing finish (`<main>`, heading order, remove-one-accessory). Stage 1's tokens/type are the
> substrate; **zero new tokens land here.**
>
> Sources: `BRIEF.md` (scope law) · `CONTEXT_PACK.md` · proposal §3/§5/§6a · skill §Direction +
> enforcement table · `_archive/redesign-stage-1/FRONTEND_EXECUTION_CONTRACT.md` (shape + the
> Stage-1 exports consumed here: `displayScale`, `displayFontFamily`/`displayFontStretch`, the
> palette) · `_archive/redesign-stage-0/FRONTEND_EXECUTION_CONTRACT.md` §4.3 (the hero copy —
> **LOCKED**, visuals only this stage) + §10.2 (the deferred Landing `<main>`).

---

## 1. Design front-half (DESIGN_RULES §1.1–§1.4, folded in — "Design tokens + signature")

**Brief pinned.**
- **Subject:** Convexa's signature — convexity as a *drawable, ownable geometry*: the payoff
  curvature the company is named for, made visible in the mark, one motion moment, and the section
  grammar.
- **Audience:** solo retail options swing traders in dark broker terminals; they know what a
  convex payoff looks like — the geometry reads as *theirs*, not as decoration.
- **Single job of this pass:** make Convexa visually unmistakable — "a visual identity that could
  not be mistaken for anyone else's" — by spending the convex arc in exactly three places, and
  finish the landing's structural floor.

**Structure before style.** The structural moves: (a) ONE arc-geometry primitive
(`shared/ui/arc.ts`) that all three signature surfaces import — the count-of-importers test hangs
off this module; (b) the mark rebuilt as a lockup component (arc-X glyph + Archivo Expanded caps
text) in the existing `shell/ConvexaMark.tsx` slot, so TopNav / drawer / Footer inherit with zero
call-site churn; (c) the hero's decorative layer swapped: `ConvexityMotif` (wallpaper béziers at
16% + radial glow blob) **deleted**, replaced by `pages/landing/HeroCurve.tsx` (the moment) —
absolute overlay, paint-only, box reserved by construction; (d) two straight-rule section seams
replaced by the shared `ArcDivider`; (e) landing landmark + heading outline repaired.
Dependency direction holds: `HeroCurve` is landing-only → lives on the page; `ArcDivider` has 2
consumers (shell + features) → `shared/ui`; the primitive has 3 → `shared/ui`.

**Token plan: ZERO new tokens.** Stated deliberately. Everything binds Stage-1 slots:
- Mark fills: `currentColor` off the mounting context (`text.primary` wordmark text) with the
  arc-X glyph on **`primary.main`** (gammaAmber — "wordmark" is a named amber spend). **No
  gradient anywhere in the mark** (the gradient mark is dead — skill ban list).
- Hero curve stroke: `primary.main`; baseline: `text.secondary` (steel) at low opacity. The amber
  spend on the landing is the mark + the curve — nothing else new.
- Arc dividers: **`divider`** palette slot, strokeWidth 1 — the signature is the *shape*, not a
  new amber spend (dividers stay quiet structure; amber on every seam would be sprinkling).
- Type: the wordmark consumes `typographyTokens.displayFontFamily` + a REAL width axis
  (Expanded — see §3.2); the hero H1 consumes the Stage-1 `displayScale` export (44–56px clamp,
  700) — the export lands on its intended surface this stage.
- Favicon assets (static files in `public/`, outside the theme runtime) carry the token VALUES as
  literals, **test-pinned to `tokens.ts`** (§8-5) — the blog-generator precedent.

**Signature (the three placements — closed):** 1. the mark's arc-X · 2. the hero curve-draw ·
3. arc dividers. Enforced structurally: `shared/ui/arc.ts` has EXACTLY three importers (§8-1).

**Self-critique (recorded).** Default failure modes, each rejected: (1) **arc sprinkling** — the
urge to arc-ify card corners, chips, chart frames once the primitive exists; refused by the
importer-count pin, and the chart frame is the *named cut 4th idea*. (2) **Over-animating the
moment** — glows, particles, loops, replay-on-poll; the moment is ONE curve drawing ONCE on mount,
settling to a static frame. (3) **Faux-expanding the wordmark** — `transform: scaleX` is banned
(Stage 1 §10-1 rule carried); real `wdth` axis or flagged fallback. (4) **Shrinking the full
wordmark into the favicon** — a 7-glyph lockup at 16px is illegible by construction; the favicon
is the arc-X **monogram** alone (the 16px legibility named check, §8 review-2). (5) **Amber
dividers** — rejected; see token plan. (6) The generic-glow vocabulary (radial blobs) is being
*removed* this stage — so the remove-one-accessory cut targets the same family (§6.3), making the
removal consistent rather than adding anything.

---

## 2. Execution order (binding)

1. **`shared/ui/arc.ts`** — the primitive (convex-arc path builder + the X-glyph geometry
   constants). NOT re-exported from the `shared/ui` barrel (`index.ts`) — consumers import the
   module path directly so the importer scan (§8-1) is reliable. Its spec + the three components
   below are the only permitted importers.
2. **The mark** (§3): rebuild `shell/ConvexaMark.tsx` in place; regenerate favicon assets +
   `index.html` icon links.
3. **The hero moment** (§4): add `pages/landing/HeroCurve.tsx`; swap it into `Landing.tsx`;
   DELETE `shared/ui/ConvexityMotif.tsx` (zero-importer proof: it has exactly one consumer today —
   `Landing.tsx:50`; `tsc -b` + grep prove the deletion clean). Replace its assertions in
   `ui-primitives.spec.tsx` with the HeroCurve guards **in the same commit** (guards replaced,
   never deleted-because-red — the §6a-2 discipline applied locally).
4. **Arc dividers** (§5): add `shared/ui/ArcDivider.tsx`; swap the two named seams.
5. **Landing finish** (§6): `<main>`, heading order, display-scale H1, the accessory cut.
6. **Tests** (§8), then the GATE Q battery (§9).

---

## 3. (a) The MARK — the CONVEXA lockup

### 3.1 Decision: styled text + authored arc-X SVG glyph (NOT full path-outlines) — justified

The lockup renders the letters as **styled text** (Archivo, Expanded width, 700, caps) with the
**X replaced by an inline SVG glyph** whose geometry is the two-convex-arc construction. Rationale
(recorded, per the contract's decide-and-justify mandate):
- The X is the ONLY custom geometry in the wordmark — "the X cut from two convex arcs" is
  impossible as live text; the other six letters carry no custom geometry, so converting them to
  outlines buys nothing and costs: selectable/zoomable text, automatic token/mode binding via
  `color`, and font-fidelity (hand-converted or tool-converted outlines of a variable-width face
  are the highest-risk artifact in this stage).
- The favicon does NOT need the letters at all (§3.4) — so "outlines for asset reuse" is not a
  reason. The arc-X glyph geometry is shared between the lockup and the favicon via
  `shared/ui/arc.ts` constants (single-sourced).
- Failure mode accounted: before Archivo loads (font-display swap), the lockup renders in the
  fallback stack — the SVG X is metric-independent (sized in `em` against cap-height), so the
  lockup may reflow slightly on font swap but never collides/overlaps; verified eyes-on with
  Archivo blocked (§8 review-5). This is the accepted cost of live text; a `size-adjust` fallback
  tune is optional latitude, not required.

### 3.2 The lockup spec (`shell/ConvexaMark.tsx`, rebuilt in place)

- **Composition:** `[C O N V E] [arc-X glyph] [A]` — one word, caps: text nodes `CONVE` + the SVG
  X + `A`, flex-aligned on the baseline. NO leading/standalone curve glyph — the in-word X **is**
  the mark (the current decorative leading arc is retired with the old lockup).
- **Type:** `typographyTokens.displayFontFamily`, weight 700, uppercase,
  **`fontStretch: '125%'` (Expanded)** via the real Archivo `wdth` axis. If the vendored variable
  file caps below 125%, ship the max real width available (≥ the Stage-1 112.5%) and FLAG it
  (§10-4) — **never** a `scaleX` faux stretch. Slight positive tracking permitted
  (`letterSpacing` ≈ `0.02em`–`0.04em`) so the arc-X sits comfortably; latitude, render-pass
  judged.
- **The arc-X glyph:** two convex arcs crossing — geometry built from `shared/ui/arc.ts` (the
  same quadratic-arc builder the other two placements use; exact control points are
  implementation latitude with these requirements: both strokes visibly *convex* (bowed, not
  straight diagonals), stroke terminals square or round-capped consistently, stroke weight
  optically matching the Archivo 700 stem at the rendered size, legible as an "X" at 16px).
  `fill="none"`, `stroke="currentColor"` — **no gradient, no literal hex** (§8-5, §8-6).
- **Color:** the glyph binds `primary.main` (gammaAmber); the letter text binds the mounting
  context's `text.primary` (phosphor / inkText). Geometric, token-bound, mode-aware by
  construction. (An all-amber variant is NOT offered — one amber element per lockup.)
- **Accessibility:** the split text nodes would read "CONVE A" — so the lockup wrapper carries
  `role="img"` + `aria-label="Convexa"`, inner text + glyph `aria-hidden`. The TopNav link's
  accessible name stays "Convexa" (casing in the label is NOT changed — display is caps, the name
  is the brand word).
- **API + testids preserved:** keep the `size` / `fontSize` props (call sites: `TopNav.tsx` bar +
  drawer header, `Footer.tsx`) and keep `data-testid="convexa-mark"` on the glyph so existing
  suites keep passing; specs that assert the visible string `Convexa` are updated to the caps
  rendering (a `review:` copy-class change — the accessible name is the stable contract).

### 3.3 Where it lands / what it replaces

| Surface | Replaces |
|---|---|
| `shell/TopNav.tsx` (bar, line ~121 + drawer header ~197) | the old leading-arc + title-case "Convexa" lockup — inherited by rebuilding `ConvexaMark` in place, zero call-site edits |
| `shell/Footer.tsx` (~line 19) — the landing's mark usage (Landing renders no TopNav) | same, inherited |
| Favicon set (§3.4) | the legacy `public/favicon.ico` |

### 3.4 Favicon — the arc-X monogram at 16 / 32 / 180

- **Assets (committed under `apps/dashboard/public/`):**
  - `favicon.svg` — the arc-X monogram: ink `#0B0F17` rounded-square field, gammaAmber `#F2A93B`
    arc-X strokes. Literal values ONLY here (a static asset can't consume the theme), pinned
    byte-exact to `tokens.ts` by §8-5. **No gradient.** Stroke weight tuned for 16px legibility
    (thicker than the lockup glyph's optical weight — small-size master, not a naive scale-down).
  - `favicon.ico` — regenerated from the same geometry, containing **16×16 AND 32×32** entries.
  - `apple-touch-icon.png` — **180×180**, same monogram, opaque ink field.
  - Generation tooling is implementation latitude (one-off script; no new runtime dependency, no
    build-step coupling); the committed binaries + §8-4 checks are the contract.
- **`index.html`:** add `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` above the
  existing `.ico` fallback link (kept), and `<link rel="apple-touch-icon"
  href="/apple-touch-icon.png" />`. No other head changes (SEO/OG block untouched — §7).
- **Named check — legibility at 16px:** the monogram reads as an X-like brand glyph in a real
  browser tab at actual size, dark AND light browser chrome (§8 review-2).

---

## 4. (b) The HERO MOMENT — the payoff curve draws itself

### 4.1 The component (`pages/landing/HeroCurve.tsx` — landing-only, so page-local)

- **Geometry (owned, never charted):** a single **convex payoff shape** — a long-option payoff
  silhouette: a flat-to-shallow baseline-hugging segment on the left that curves smoothly upward
  to exit the top-right; slope monotonically increasing (that IS convexity). Built from the
  `shared/ui/arc.ts` builder. Plus one **baseline** (the horizontal axis the curve settles into).
  **No data binding, no fetch, no axis labels, no numbers** — decorative geometry (`aria-hidden`),
  never a literal chart (the ConvexaMark doc's "never a literal chart" rule carries over).
- **Layers/paint:** curve = `stroke: primary.main`, strokeWidth ~3, opacity ~0.9 (this is THE
  signature — no longer 16% wallpaper); baseline = `text.secondary` (steel) at ~0.35 opacity,
  strokeWidth 1. **NO fill, NO glow, and NO `radial-gradient` anywhere** — the radial blob is
  REMOVED with `ConvexityMotif`, not re-created (§8-7 scans for it).
- **Placement / box reservation (no layout shift, paint-only):** the exact slot `ConvexityMotif`
  occupies today — an absolutely-positioned `inset: 0` overlay inside the hero `Box`
  (`position: relative; overflow: hidden`), `pointer-events: none`, behind the hero copy. The
  hero's box is sized by its CONTENT (Container + copy), never by the SVG — the animation can't
  move layout by construction; §8-3 guards it structurally. `preserveAspectRatio` chosen so the
  curve reads at 393 and 1440 (latitude; render-pass judged).

### 4.2 The draw-in

- **Mechanism:** stroke-dash draw — the curve path gets `stroke-dasharray: L; stroke-dashoffset:
  L` (L = the path length constant, computed once; a hardcoded measured constant is acceptable)
  and a CSS class whose keyframes animate `stroke-dashoffset` → 0. The dash draw is the
  BRIEF-sanctioned mechanism (SVG paint — it repaints, it never lays out); **everything else
  animated is transform/opacity ONLY** (the baseline fades in with `opacity`; the settle is
  `opacity`/`transform` if used). §8-3 pins the keyframe property set to exactly
  {`stroke-dashoffset`, `opacity`, `transform`}.
- **Choreography:** on mount, once — baseline fades in (~200ms), then the curve draws
  left-to-right and **settles into the baseline**: the draw ORIGIN is the left, baseline-hugging
  end, so completing the draw visually plants the curve on the axis; the final frame is the
  static curve resting on the baseline. **Duration ~900ms, delay ~150ms, easing
  `cubic-bezier(0.16, 1, 0.3, 1)`** (decisive start, soft settle; ±latitude within 700–1100ms,
  render-pass judged). `animation-fill-mode: forwards`. **One-shot:** it fires on mount and NEVER
  replays on re-render/poll (Landing is static — no poll exists; the one-shot property is still
  asserted so a future landing data-hook can't regress it).
- **Reduced motion:** `useReducedMotion()` — **the shared hook** (`shared/hooks/useReducedMotion`),
  never a bespoke media query — `true` → render the **static final frame** (no dash class, full
  stroke, baseline at rest opacity). Belt-and-braces: the CSS class is additionally disabled under
  `@media (prefers-reduced-motion: reduce)`. Named test §8-2.

### 4.3 Coexistence with the shipped stagger — explicit

The staggered widget reveal (Widget `revealIndex`, ticker page) **stays, untouched, this stage**,
including all 4 of its guard tests. The two moments never co-fire: **the curve-draw lives on `/`
(landing), the stagger on `/ticker`** — different pages, one moment per surface. The five-family
motion consolidation around the curve-draw — including the pre-approved supersession of the
stagger and the REPLACEMENT (never deletion-because-red) of its guards — is **Stage 3, explicitly
not here** (proposal §6a-2). This stage only ADDS the moment and REMOVES the blob.

### 4.4 What is removed

`shared/ui/ConvexityMotif.tsx` — DELETED (both béziers AND the radial glow blob; the motif is
*absorbed* into the new moment, not left as a stray 4th arc surface). Zero importers after the
swap (sole consumer is `Landing.tsx`); `ui-primitives.spec.tsx`'s motif assertions are replaced by
HeroCurve guards in the same commit.

---

## 5. (c) The ARC DIVIDER — one shared component, two named seams

### 5.1 The component (`shared/ui/ArcDivider.tsx`)

- A full-width **shallow convex arc**: fixed-height SVG (height ~16–24px, reserved — no layout
  shift), `preserveAspectRatio="none"`, one path from the `arc.ts` builder (e.g. bow depth ~8–10%
  of height at center; shallow — a breath of curvature, not a hill).
- **Stroke: the `divider` palette slot**, strokeWidth 1. Token-bound, mode-aware, quiet — the
  shape is the signature (§1 token plan).
- Semantics: `role="separator"` + `aria-orientation="horizontal"` on the wrapper (it replaces
  `<Divider/>` = `<hr>`); the SVG itself `aria-hidden`. Accepts `sx` for the margin the replaced
  Divider carried. `data-testid="arc-divider"`.

### 5.2 The seams (CLOSED list — the exact straight rules found; anything beyond is out of contract)

| # | Seam | Replaces |
|---|---|---|
| 1 | **`shell/Footer.tsx:16`** — the footer's top rule (the landing's page-body ↔ footer boundary; Footer is currently mounted on Landing only) | `<Divider />` |
| 2 | **`features/trading/outcomes/TrackRecordSection.tsx:344`** — the Positions page's book ↔ "Track record" section boundary | `<Divider sx={{ mb: 3 }} />` |

**Found and deliberately EXCLUDED (not section boundaries — they keep their straight rules):**
`TopNav.tsx:207` (drawer chrome) · `AuthDialog.tsx:284` (the "or" inline divider) ·
`CustomizationToolbar.tsx:259/281` (menu dividers) · `AiRecPanel.tsx:1204` (intra-widget rule
above the actions row) · `AiKeySection.tsx:351` (non-embedded path — currently dead: the only
consumer renders `embedded`) · `TrackRecordSection`'s interior rules, if any · the tab-strip
`borderBottom`s (`PortfolioPanel.tsx:100/110`), row separators (`OrderRow`, `PositionRow`,
`PositionsView`), `Widget.tsx` frame borders, `TopNav` chrome `borderBottom`, and the `Jargon`/
operator dotted underlines. The ticker + settings pages contain **no straight-rule section seams**
(bento widget frames and `PanelCard`s carry their own borders) — nothing to replace there; the
arc grammar reaches them when/if seams exist, via deliberate pin edits (§8-1's seam pin).
The static blog HTML's `hr` rules are generator territory and stay straight (§7).

---

## 6. (d) The LANDING FINISH

1. **`<main>` landmark** (Stage 0 §10.2 deferral, landed now): `Landing.tsx` wraps sections 1–3
   (hero, "What works today", coming-soon band) in `component="main"`; `Footer` stays outside it
   (it is `<footer>`). One `<main>` per document (Landing renders outside the AppShell, which owns
   the in-shell `<main>` — no double-landmark possible on a single route).
2. **Heading-order fix** (the H1→H6 fail): the outline becomes `h1` (hero) → `h2` ("What works
   today" — the existing `variant="overline"` Typography gains `component="h2"`, styling
   unchanged) → `h3` card titles: `ValueCard` and `ComingSoonCard` gain a `titleComponent`
   prop (`ElementType`, default `'h3'`; `variant="h6"` STYLING unchanged — these cards have no
   other consumers today, so the default is safe). The coming-soon band's card titles are `h3`
   under the same outline. No skipped levels; exactly one `h1`. (§8-8 guards it.)
3. **Remove-one-accessory pass — the cut, named:** **`ValueCard`'s `::after` hover radial
   light-bleed** (`ValueCard.tsx:67–76`, the `radial-gradient` corner glow + its `opacity`
   hover/reduced-motion wiring). Judged weakest because it is the same generic radial-glow
   vocabulary this stage removes from the hero — cutting it makes the blob removal consistent
   across the page; the card keeps its lift, amber top-edge wipe, border accent, icon scale, and
   CTA nudge (still plenty of hover life). Recorded here; reversible as a single-hunk revert.
   Nothing else is cut, and nothing is added.
4. **Hero display scale lands:** the hero `h1` consumes the Stage-1 exports —
   `displayFontFamily` + `displayFontStretch` (via the theme's h1 variant, which already carries
   Archivo) and **`displayScale`**: `fontSize: clamp(44px, …, 56px)` (implementation latitude on
   the fluid middle term), `fontWeight: displayScale.fontWeight`. Replaces the current hardcoded
   `2.25rem/3.125rem` step. **The hero COPY is LOCKED** — H1, body, gloss, CTAs, chip, coming-soon
   band strings byte-identical (Stage 0 §4.3; visuals only).

---

## 7. NON-GOALS (explicit — touching these is out of contract)

- **Router untouched.** Zero route/`app.tsx` changes — the SEO-prerender plan RE-DERIVES after
  this stage (§6a-5); giving it a moving target is the named failure. `index.html` changes are
  the icon links ONLY (SEO/OG meta block untouched).
- **Hero copy untouched** (Stage 0 §4.3 locked) — and ALL landing strings: this stage changes
  zero user-facing copy.
- **Chart frame untouched** — the curved data-frame edge is the CUT 4th idea; the vertical
  diverging GEX chart is LOCKED (§6a-1). No arc goes near the chart.
- **No motion-family consolidation** — Stage 3 (§4.3 above). The stagger + its guards, ValueCard
  hover set (minus the one cut accessory), flash/pulse families all stay as-is.
- **No new pages, no new routes, no new surfaces.**
- **`brandGradient` NOT deleted** — the disposition check ran: after the mark rebuild it still has
  two consumers (`features/auth/avatar.ts`, `features/auth/AccountControl.tsx` sign-up pill), so
  the deletion condition ("if nothing consumes it") is NOT met. It stays; whether avatar/pill
  gradients fit the final identity is flagged to Stage 3 (§10-2). The MARK itself carries no
  gradient (§8-5).
- **Blog output untouched** (template, `hr` rules, generated pages) — the arc grammar does not
  extend into static generator HTML this stage (§10-5).
- **No durable-key change**; no backend / `libs/api` change; no theme/token VALUE change
  (`tokens.ts` is read-only this stage except — nothing; zero token edits).
- **`/_ops/metrics` untouched** (no arc, no mark work there — operator path separation).

---

## 7b. Binding invariants (restated for this feature)

- **`[theme-token-discipline]`** — every new component (arc.ts consumers) binds theme slots /
  `extrasFor(theme)`; **zero hardcoded hex in `src/`**; favicon assets are the only new literals,
  outside `src/`, test-pinned to tokens (§8-5); `hex-discipline.spec.ts` +
  `banned-hexes.spec.ts` stay green with no new exemptions.
- **`[additive-keeps-score-byte-identical]`** — FE-only; `git diff main -- apps/api` empty at
  GATE Q.
- **The ONE-motion rule** (skill §5) — the curve-draw is THE moment; dash-draw + transform/
  opacity only; `useReducedMotion` via the shared hook; static fallback (§4.2).
- **Arc-in-exactly-3-places** — the importer-count test lands THIS stage per the skill's
  enforcement table (§8-1); a 4th importer is a red build, not a review comment.
- **`[no-real-order-path]`** — landing copy untouched = the honest hero stays honest; the
  coming-soon band + waitlist toast semantics untouched.
- **Vertical-GEX-chart lock** — no chart contact at all.
- **`[live-vs-static-isolation]` / `[operator-vs-trader-path-separation]` /
  `[loss-free-durable-migration]`** — expected NOT exercised (static landing + chrome only); any
  accidental touch is STOP-and-flag.

---

## 8. Tests to write (the requirement set — the FE implements these, never chooses them)

Risk rule (qa-verify §4): `test:` = invariants / negative space / silently-regressing behavior;
`review:` = visible/intentional, verified in the GATE Q render pass. No per-AC mirroring. The
existing suite baseline stays green throughout — **zero deletions/weakenings**, with ONE accounted
substitution: `ConvexityMotif`'s assertions in `ui-primitives.spec.tsx` are REPLACED by the
HeroCurve guards in the same commit (the component is deleted with zero-importer proof — a
substitution, not a weakening; any OTHER guard edit is a scope smell to report).

| # | Kind | Case |
|---|---|---|
| 1 | `test:` | **Arc-importer-count — exactly 3, MUTATION-GUARDED** (the skill's enforcement row, landing this stage). New spec: scan all app sources (`import.meta.glob` `?raw` over `src/app/**/*.{ts,tsx}`, spec files excluded) for imports of the arc primitive module (`@/shared/ui/arc` or a relative equivalent — the regex covers both forms). Assert **set equality** with the allowlist `{shell/ConvexaMark.tsx, pages/landing/HeroCurve.tsx, shared/ui/ArcDivider.tsx}` — not just count 3 (a swap-one-in-one-out must also fail). Also assert `shared/ui/index.ts` does NOT re-export the primitive (keeps the scan sound). Mutation-guard: the extracted checker fails on a fixture source containing a 4th import. SECOND pin in the same spec: `ArcDivider`'s importers == `{shell/Footer.tsx, features/trading/outcomes/TrackRecordSection.tsx}` — extending the seam list is a deliberate pin edit (the P/L-color-pin pattern), never a drive-by. |
| 2 | `test:` | **Reduced motion → static final frame** (named test). Render `HeroCurve` with `matchMedia` mocked to `prefers-reduced-motion: reduce`: the curve path carries NO draw/animation class and no dash offset (full stroke visible); with motion allowed, the draw class IS present. The shared-hook consumption is asserted the same way the existing `useReducedMotion` consumption tests do (source-level import + behavior — no bespoke media-query hook). Existing reduced-motion suites stay green untouched. |
| 3 | `test:` | **No layout shift — paint-only draw, box reserved.** Structural guards (jsdom-honest — no pixel measurement): (a) `HeroCurve`'s wrapper is `position: absolute` + `inset: 0` + `pointer-events: none` inside the hero (className/innerHTML assertions — never `getAttribute('style')`, per the skill's testing gotcha); (b) a source-scan (`?raw`, mutation-guarded) of `HeroCurve.tsx` pins the animated property set: keyframes/transitions reference ONLY `stroke-dashoffset`, `opacity`, `transform` — a `width`/`height`/`margin`/`top` in a keyframe fails. |
| 4 | `test:` | **Favicon assets exist at sizes.** Node-env spec over `apps/dashboard/public/`: `favicon.svg` exists; `apple-touch-icon.png` exists AND its IHDR reads **180×180** (parse the PNG header bytes); `favicon.ico` exists AND its ICONDIR contains **16×16 and 32×32** entries (parse the ICO directory). Plus `index.html?raw` contains the `image/svg+xml` icon link + the apple-touch-icon link. |
| 5 | `test:` | **Mark has no gradient + assets pinned to tokens (scan).** Source-scan (`?raw`, mutation-guarded): `ConvexaMark.tsx`, `arc.ts`, `HeroCurve.tsx`, `ArcDivider.tsx`, and `favicon.svg` contain NO `gradient(`/`<linearGradient`/`<radialGradient` token. `favicon.svg` additionally: its hexes are exactly `{tokens.ink, tokens.gammaAmber}` imported from `tokens.ts` (byte-compare, the blog-generator precedent) and none of the banned-hex list. |
| 6 | `test:` | **Hex/ban-list suites stay green, zero new exemptions**: `hex-discipline.spec.ts` (the new components carry zero hex) + `banned-hexes.spec.ts` (retired identity unreachable) run unchanged. The favicon binaries live outside `src/` and need no exemption; needing one = scope smell. |
| 7 | `test:` | **Radial blob removed — negative space.** Source-scan (`?raw`, mutation-guarded): zero `radial-gradient` occurrences across `pages/landing/**` AND `shared/ui/ValueCard.tsx` (covers both the blob removal §4.4 and the accessory cut §6.3 — the two removals guard each other); plus `ConvexityMotif` no longer exists (import scan finds zero references app-wide). |
| 8 | `test:` | **Landing landmark + heading order.** Rendered `Landing`: exactly one `main` landmark; exactly one `h1`; heading walk is `h1 → h2 → h3…` with no skipped level and NO `h4–h6` elements; card titles render as `h3`. (Extends the Stage-0 heading-semantics pattern to the landing.) |
| 9 | `test:` | **Existing suites zero-weakening**: stagger/reveal guards (Widget.spec — all 4), landing funnel spec (CTA hrefs), hero copy pins (strings byte-identical — the LOCKED copy is enforced by the existing exact-string specs staying green), degraded-state suites, focus-visible, 393 no-overflow (now includes the new hero + dividers), chip floor, theme-color, stage1-token specs. The ONE accounted substitution (ConvexityMotif → HeroCurve guards) is named above; anything else touched = report, don't patch. |
| 10 | `review:` | **The draw moment observed in a real browser** (conductor, per the process rider): load `/` cold — baseline fades, curve draws once, settles into the baseline, no flicker/replay on route away+back (remount = replay is CORRECT — one-shot per mount), no scrollbar jump during the draw; then with OS reduced-motion ON — static curve, no draw. Dark + light, 1440 + 393. |
| 11 | `review:` | **Mark legibility at 16px**: the favicon monogram in a real browser tab (dark + light chrome), a bookmark row, and the 180 icon on a home-screen-style preview — reads as the brand X-glyph, not smudge. Lockup: Archivo Expanded renders REAL width (devtools computed `font-stretch`, no faux transform), arc-X aligns with the caps across font-load states (Archivo blocked → fallback stack: no collision/overlap). |
| 12 | `review:` | **Divider sweep sanity**: both seams (landing footer, positions track-record) at 1440 + 393, dark + light — the arc is shallow and quiet (divider-slot stroke, no amber), height reserved (no shift vs the old `<hr>` spacing), `role="separator"` present; and eyes confirm NO other seam sprouted an arc. |
| 13 | `review:` | **Before/after landing** — full-page captures (dark+light × 1440+393) pre/post, self-critiqued per DESIGN_RULES §1.6: the hero reads MORE distinctive with the blob gone (negative space + one drawn curve), the H1 display scale sits right at both clamps, the cut accessory's absence is invisible except as calm, amber remains spent (mark X, curve, CTAs) — not sprinkled. |

---

## 9. GATE Q battery (process riders, proposal §6a — all required)

1. `npx tsc -b` clean (also proves `ConvexityMotif`'s deletion left zero importers).
2. `nx build dashboard` green.
3. `nx test @org/dashboard` — full suite green (Stage 0+1 baseline + the §8 additions), zero
   skipped/deleted guards beyond the one accounted substitution.
4. Lint (module boundaries) green — `HeroCurve` on the page, `ArcDivider`/`arc.ts` in shared,
   downward-only imports hold.
5. **Empty backend diff proof:** `git diff main -- apps/api` produces no output.
6. **Real-browser render pass (Playwright): 1440 AND 393, BOTH color schemes**, on `/`,
   `/ticker/TSLA`, `/positions` (the track-record seam), `/settings` (untouched — regression eyes)
   — screenshots captured and self-critiqued per DESIGN_RULES §1.6, PLUS a reduced-motion pass on
   `/` (emulate `prefers-reduced-motion`), PLUS the §8-10 live draw observation. Never silently
   skipped; the structural fallback note is not acceptable for the draw moment — this stage's
   whole point is visible.
7. Conformance specs: **n/a and correctly absent** — no FE↔BE surface changed.

---

## 10. Open questions (explicitly recorded — nothing silently decided)

1. **Additive landing seams.** The arc-divider mandate is *replace straight rules*; the landing
   currently has NO rule between hero ↔ "What works today" ↔ coming-soon band, so none was added
   (cut-don't-add stage posture). If the owner wants the arc grammar to ARTICULATE the landing's
   sections (adding 1–2 `ArcDivider`s there), it is a two-line change + a §8-1 seam-pin edit —
   flagged, not decided.
2. **`brandGradient` survivors.** The avatar + Sign-up pill still wear the amber gradient
   (mode-invariant, logo-like). The mark no longer has any gradient kin — whether these two
   surfaces keep a gradient treatment under the final identity is a Stage-3 per-surface call.
   Deletion condition not met this stage (§7).
3. **`og-image.png` still carries the pre-signature identity.** Regenerating the OG card with the
   new mark/curve is asset work NOT in the BRIEF's scope law — flagged for the owner (cheap
   follow-up, big first-impression surface).
4. **Archivo `wdth` ceiling.** The lockup wants Expanded (125%). If the vendored variable file
   tops out below that, the lockup ships at the max REAL width ≥112.5% and the gap is reported —
   never faux-stretched (§3.2).
5. **Blog `hr` rules stay straight.** Extending the arc grammar into the generator template would
   put arc geometry outside the importer-count's reach (static HTML can't import the primitive) —
   left out deliberately; if the owner wants the blog to join the section grammar, it needs its
   own guard design (generator-emitted SVG + a template-scan pin), a small follow-up.
6. **Wordmark casing in existing assertions.** Specs asserting the visible string `Convexa`
   (funnel/footer/nav) update to the caps lockup with `aria-label="Convexa"` as the stable
   accessible name. If any EXTERNAL surface (page `<title>`, OG tags — untouched here) is later
   restyled to caps, that's a copy decision for the owner, not this stage.
7. **Draw timing values** (~150ms delay / ~900ms / the easing curve) are contract *targets* with
   ±latitude (§4.2), finalized in the §8-10 observation — recorded so the render pass judges a
   named intent, not an improvisation.
