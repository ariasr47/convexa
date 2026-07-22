# Convexa dashboard — large-scale design review

> **Date:** 2026-07-22 · **Reviewer:** Claude (structural live walk + code audit) · **Scope:** every routed
> surface of `apps/dashboard` at `:4300`, dark **and** light schemes, desktop + mobile.
> **Rubric:** `front-end-design/CLAUDE.md` + `claude-code-design-quality-guide.md` (the studio rubric:
> typography-as-personality, committed palette, atmosphere, one-orchestrated-motion, signature element,
> quality floor, copy-as-design-material, AI-slop tells).
>
> ⚠ **Method note — not visually verified by eye.** One screenshot was attempted and hung (known
> environment constraint: the preview pane does not composite). All evidence below is *structural*:
> `getComputedStyle` samples, DOM/accessibility facts, verbatim copy, and source reads. Values are real
> rendered values; what no tool can grade here is gestalt (visual balance, crowding). A human pass over
> real screenshots should accompany any redesign decision.
>
> ⚠ **Deviation from the brief:** the backend **was** running (live SSE, real TSLA data), so the walk
> reviewed the *live* surfaces; degraded/empty states were graded from their live occurrences (auth-gated
> AI panel, empty orders/positions/track-record) plus the copy modules that own the offline/unavailable
> strings (`widgets/_kit/copy.ts`, `StatTile` offline treatment).
>
> A second environment artifact: the ticker bento renders at `opacity: 0` in this harness because the
> one-time staggered reveal waits on compositing that never happens. All content was still in the DOM and
> fully measurable. This is not an app bug, but see finding T-9 (the reveal is opacity-only, so content is
> never hidden from assistive tech — correct behavior, verified).

---

## 1. Verdict

**Competent-but-generic, with an unusually strong honesty-and-discipline floor and no visual signature.**
This is emphatically not AI slop: the token discipline is real and mechanically enforced, light-mode parity
genuinely holds, the motion program is gated and purposeful, and the copy is some of the most honest
product writing I have reviewed — "Snapshot, never live," "Activity, not direction," "information, not a
warning" are house style, not accidents. But against the rubric's bar — *"a visual identity that could not
be mistaken for anyone else's"* — Convexa fails cleanly. The type system is Inter everywhere (the rubric
names it a default); the base palette is, hex-for-hex, **GitHub Dark's** (`#161b22`, `#8b949e`, `#e6edf3`
are exact GitHub-dark values; `#0e1117` is one notch off GitHub's `#0d1117`); the brand mark is a
blue→violet gradient, the single most common SaaS gradient in existence; and the landing is the standard
hero + three-value-cards + coming-soon-band skeleton. The one element designed to be a signature — the
convexity-curve motif — renders at 0.16 opacity on one page and nowhere else. Meanwhile the quality floor
has two hard failures the brand conversation must not paper over: **the app horizontally overflows at
393 px (no mobile nav strategy at all)** and **filled buttons have no visible keyboard focus ring**.
Verdict in one line: *excellent engineering discipline wearing borrowed clothes.*

---

## 2. The identity question

**What the identity currently is:**

- **Palette.** Dark `#0e1117` canvas / `#161b22` paper, text `#e6edf3`/`#8b949e`, primary `#4f9cff` with a
  deep `#1d6fe0` for filled buttons, semantic green/red/amber/cyan, and an `accentViolet #7b5cff` used
  almost solely inside the brand gradient. Light mode is a faithful mirror (`#f5f6f8`/`#ffffff`,
  `#1d6fe0`). Committed? The *system* is committed (tokens, parity, semantics are airtight). The *choice*
  is not: the neutrals are GitHub Dark's, and blue-on-dark-slate is the median fintech/dev-tool look.
  Distribution is timid in the rubric's sense — the blue never dominates anything; it is an accent
  sprinkled evenly (chips, links, one reference line, the hero glow). No color owns a surface.
- **Type.** One family for everything: `Inter, system-ui, Segoe UI, Roboto` (measured on body, h1, widget
  headers, nav — identical stack everywhere). Display = Inter 700 at 50 px/-1 px tracking. The one genuine
  type *decision* is Roboto Mono for every figure (measured on stat values) — right instinct for a tape,
  but Roboto Mono is itself a default mono. There is no characterful display face; typography here is a
  neutral delivery vehicle, exactly what the rubric warns against.
- **Motion.** The strongest identity candidate the app owns: one orchestrated staggered widget-reveal
  (~55 ms/step cascade), flash-on-tick gated `isLive && !streamOffline`, mount-only GEX bar-grow, hover
  lift, a conic-gradient border on the selected/live widget, View-Transition expand. All reduced-motion
  guarded (verified: `useReducedMotion` consumed in `Widget`, `chart`, `TickerHeader`, `CommandDeck`,
  `useFlashOnChange`; 4 `prefers-reduced-motion` CSS blocks live on the landing page alone). This is close
  to the rubric's "one orchestrated moment" ideal, with a mild scatter risk (five distinct
  micro-interaction families on one page).
- **Signature candidates, graded:**
  - *Convexity-curve motif* — two béziers at `opacity: 0.16` behind the landing hero
    (`ConvexityMotif.tsx`), decorative-only, appears on exactly one surface. A whisper, not a signature.
  - *Vertical diverging GEX chart* — the most "Convexa" thing on screen, but rendered 240 px tall in
    stock Recharts with genre-standard green-up/red-down. The domain content is distinctive; the
    treatment is not.
  - *The bento board* — the best-engineered candidate (container queries, `:has()`, conic selection
    border, recessed 'inset' wells under raised tiles) but "bento grid of cards" is the current default
    dashboard idiom, not a differentiator.
  - **Net: there is no ONE element the product is remembered by.** Boldness is spent nowhere.
- **Is the identity carried?** Inside the shell, yes — Ticker, Positions, Scanner, Settings, and even the
  operator page share tokens, Inter, and the honesty voice (operator copy is arguably the most
  on-brand writing in the app). **It collapses at the blog.** The static articles are a different design
  universe: measured `background #f4f1eb` (cream — within 2 hex digits of the rubric's named slop tell
  ~#F4F1EA), Segoe UI system stack, warm-grey/teal accents, no app nav, plus raw Times New Roman leaking
  on 15 unstyled elements. The "how we build" content is a brand asset wearing another company's clothes.

---

## 3. Findings table (surface × rubric dimension)

Severity: **H**igh / **M**ed / **L**ow. Evidence is measured/computed unless marked (code).

| # | Surface | Dimension | Finding | Sev | Evidence |
|---|---------|-----------|---------|-----|----------|
| G-1 | All | Typography-as-personality | Single-family Inter everywhere; no display face; personality carried by weight only | **H** | Computed `font-family: Inter, system-ui, "Segoe UI", Roboto` on body, h1 (50px/700/-1px), widget headers (16px/600), nav — identical stack on every surface |
| G-2 | All | Committed palette | Base neutrals are GitHub Dark's, near-verbatim | **H** | `#161b22` paper, `#8b949e` secondary, `#e6edf3` text = exact GitHub-dark tokens; `#0e1117` vs GitHub `#0d1117` (tokens.ts:16-23) |
| G-3 | All | Palette distribution | Blue accent evenly sprinkled, never dominant; violet exists (`#7b5cff`) but is confined to the brand gradient — no surface owns a color | M | Landing: primary appears only as chip tint (α.12), link text, CTA fill, hero glow (α.18); no dominant field anywhere |
| G-4 | Shell/brand | Slop-adjacent default | Brand mark + Sign-up pill = blue→violet 135° gradient, the most common SaaS gradient | M | `brandGradient = linear-gradient(135deg, #4f9cff, #7b5cff)` (tokens.ts:89), measured on the Sign-up pill |
| G-5 | All | Quality floor | **No visible focus ring on filled buttons** (MUI default ripple-only) | **H** | Focused "Open the Ticker viewer →": `outline: none`, box-shadow = MUI resting elevation, `:focus-visible` matched but nothing visible; 0 `:focus-visible` rules in all stylesheets. Plain `MuiLink`s fall back to the *UA default* ring — visible but undesigned |
| G-6 | All | Quality floor | **Horizontal overflow at 393 px; no mobile nav** | **H** | 393px iframe: `scrollWidth 580` vs `innerWidth 393` on both `/` and `/ticker/TSLA`; nav items "Log in" (right edge 495px) and "Sign up" (580px) render past the viewport; all 7 nav items always inline, no hamburger/drawer at any width |
| G-7 | All | Quality floor | No `<main>` landmark on any page | M | Landing landmark census: `header:1 nav:1 main:0 footer:1 section:0` |
| G-8 | All | Touch targets | Nav/CTA links 24–31 px tall (floor is ~44 px) | M | Measured: "Log in" 31px, "Analyze a ticker →" 24px, "Notify me" 31px, "Preview the scanner" 21px |
| L-1 | Landing | Atmosphere | Genuine layered atmosphere — the one place the app builds depth | *(good)* | Radial hero glow `radial-gradient(60% 50% at 80% 10%, rgba(79,156,255,.18)…)`, bézier motif, hatched coming-soon band `repeating-linear-gradient(135deg, #161b22 0 18px, #14181f 18px 36px)` |
| L-2 | Landing | Structure/layout | Cookie-cutter SaaS skeleton: hero → 3 value cards → coming-soon band → footer | M | DOM order + copy census; `gridTemplateColumns: repeat(3, 1fr)` value row (Landing.tsx:113) |
| L-3 | Landing | Heading hierarchy | H1 jumps straight to H6 ×5 (card titles); no H2 on the page | M | Heading census: `H1` then five `H6` (MUI `variant h6` cards) |
| L-4 | Landing | Copy honesty tension | Hero sells the unbuilt capability ("See the AI read on your **real** positioning… Connect your positions") while the hatched band below admits brokerage connect is coming-soon | M | H1 + body copy vs `ComingSoonCard` "Connect a real brokerage — Coming soon"; hero CTA routes to `/ticker`, not to any connect flow |
| T-1 | Ticker | Structure-encodes-meaning | Stat **values** are H6 headings — ~25 numeric headings pollute the outline ("$420, heading level 6") | **H** | Ticker heading census: `H6: -10,149`, `H6: $0.17`, `H6: $420`, `H6: $366.91`… (StatTile renders values as `Typography variant="h6"`, StatTile.tsx:137) |
| T-2 | Ticker | Type floor | TintChip label type is **9 px** (conviction tags, proximity chips) | **H** | `fontSize: 9` (TintChip.tsx:21); measured 9px on the live "MEDIUM" chip |
| T-3 | Ticker | Signature | The GEX profile — the product's centerpiece — is a 240 px-tall stock Recharts bar chart in genre-default red/green | M | Measured SVG 1118×240; 16 `#2ecc71` + 16 `#ff5c5c` bar paths; `recharts-wrapper` |
| T-4 | Ticker | Motion | Motion program is genuinely orchestrated and honest, but five families coexist on one page (reveal, flash, lift, conic border, VT expand) — at the edge of the rubric's scatter warning | L | Widget.tsx:10-21 (all feature-detected + RM-guarded); flash gated `isLive && !streamOffline` |
| T-5 | Ticker | Structure | Elevation/`inset`-well system is real design thinking: raised mono-figure tiles on recessed wells, bevel insets | *(good)* | Tile: `inset 0 1px 0 rgba(255,255,255,.05)` top-light + `bodyVariant 'inset'` recessed wells (Widget.tsx:69-72) |
| T-6 | Ticker | Undesigned token leak | SIMULATED chip renders MUI's default grey, not a token | L | Measured chip border `1px solid rgb(97,97,97)` (MUI grey[700] default) |
| T-7 | Ticker | Copy | Honesty micro-copy is the best material in the app (see §5) | *(good)* | "Snapshot, never live…", "Activity, not direction — no side implied", "not a price forecast, not a scored signal, not a guarantee" |
| T-8 | Ticker | Copy/labels | Label style drifts: `IV / HV` (spaces) vs `Vol/OI` (none) vs `Net flow (5m)`; toolbar overlines TICKER/EXPIRATIONS/PERSONA vs sentence-case elsewhere | L | Live tile label census |
| T-9 | Ticker | A11y of reveal | Staggered reveal is opacity-only (never `visibility`/`display`), so pre-reveal content stays in the a11y tree | *(good)* | Measured hidden sections: `opacity: 0, visibility: visible` |
| P-1 | Positions | Heading discipline | Best-structured page: real H1 → H2 ("Track record") | *(good)* | Heading census: `H1: Positions · H2: Track record` |
| P-2 | Positions | Copy density | Honesty disclosures stack four consecutive caveat paragraphs before content (browser-local + sim-fills + no-slippage + not-advice) | M | Verbatim run: "Simulated positions are stored in this browser… anyone using this browser will see them." → "The sim has no slippage, no partial fills…" → "Stored in this browser only…" |
| P-3 | Positions | Copy as design | Emoji as UI glyph: tab "🔒 Live" | L | Button census: `"🔒 Live"` |
| S-1 | Scanner | Empty state | Model coming-soon page: honest, redirects to what works | *(good)* | "It's not live yet — for now, analyze one ticker at a time on the Ticker page." + `COMING SOON` chip + CTA |
| B-1 | Blog | Identity dilution | Static articles are an alien design system: cream bg, system font, no shell — and cream is the rubric's named slop tell | **H** | Measured article body: `background #f4f1eb` (tell ≈ #F4F1EA), `font-family "Segoe UI", system-ui…`, teal accent `rgb(46,111,105)`, no `<nav>`; 15 elements resolve raw Times New Roman |
| B-2 | Blog index | Consistency | In-app index page IS on-theme (dark, Inter, proper H1/H2) — the break is only the static articles | L | Index census: dark bg, `H1: Blog`, two `H2` |
| ST-1 | Settings | Copy honesty | Static subtitle "Saved to your account." shown to anonymous users whose settings are browser-local — contradicted two lines later by "Sign in to sync your settings" | M | `subtitle: 'Saved to your account.'` (features/auth/copy.ts:70) rendered unconditionally (SettingsPage.tsx:144) |
| ST-2 | Settings | Labels/headings | Both text inputs unlabelled (uppercase overlines not associated); section titles (Account / AI key / Preferences) are not headings — page outline is H1 only | M | Input census: `labelled: false` ×2; heading census: only `H1: Settings` |
| O-1 | Operator | Identity carry | Keeps the full token system + the honesty voice; the categorical `chartCategorical` (Tableau-10 subset) is a deliberate non-semantic choice | *(good)* | Dark tokens + Inter measured; hollow-grey stale-repeat dots (LatencyTrend.tsx:101-109) |
| O-2 | Operator | Heading hierarchy | Page has no H1 — outline starts at H6 ("Convexa · Operator Metrics") | L | Heading census: six H6, zero H1/H2 |
| O-3 | Operator | Copy | Typo: "Rolling window: last last ~500 req" | L | Verbatim page text |
| LM-1 | All (light) | Light-mode parity | Parity genuinely holds: gradients re-derive from light primary, hatch swaps to `#fff/#f0f2f5`, chart re-fills `#1e9e57/#d23b3b`, zero dark-locked surfaces found | *(good)* | Light-mode sweep on `/` + `/ticker/TSLA`: dark-bg census returned 0 elements; measured light bar fills + white tiles |
| LM-2 | Light | Token gap | Light `text.primary` is MUI's default `rgba(0,0,0,.87)`, not a token (known THEME_AUDIT gap #3 — confirmed live) | L | Measured light h1/body color `rgba(0, 0, 0, 0.87)`; palette.light omits `text.primary` (tokens.ts:31) |

**Type system, graded explicitly:** Inter (rubric-named default) for 100 % of UI text; Roboto Mono for
figures (good instinct, default execution); only two ramp rungs designed (`h1`, `h6` — theme.ts:14-16),
everything else MUI's default scale re-fonted (THEME_AUDIT gap #5, confirmed). Tracking/width/optical
size unused. **Grade: the weakest axis of the whole design — this is where a redesign buys the most
identity per unit of risk.**

**Palette, graded explicitly:** the `#4f9cff`-on-`#0e1117` pair reads *committed as a system, generic as
a choice*: it is contrast-sound (button fill `#1d6fe0` chosen for ≈5.5:1 with white — tokens.ts:62-64),
semantically disciplined (green/red reserved for calls/puts/P&L, amber = stale, cyan = live), and
mode-mirrored — but the hues themselves are the dev-tool median, the neutrals are borrowed outright
(G-2), and no color is ever spent boldly.

---

## 4. Quality-floor audit

Pass/fail per floor item. "Shell" covers nav/footer shared by all in-shell pages.

| Floor item | Landing | Ticker | Positions | Scanner | Blog (app) | Blog (static) | Settings | Operator |
|---|---|---|---|---|---|---|---|---|
| Responsive to 393 px | **FAIL** (580px scrollWidth; nav overflows viewport) | **FAIL** (same shell) | **FAIL** (shell) | **FAIL** (shell) | **FAIL** (shell) | not tested | **FAIL** (shell) | **FAIL** (shell) |
| Visible keyboard focus | **FAIL** on buttons (no ring — `outline: none`, ripple-only); **marginal** on links (undesigned UA ring) | same | same | same | same | UA default (pass by accident) | same | same |
| `prefers-reduced-motion` | **PASS** — 4 CSS blocks + shared hook | **PASS** — hook consumed on every animated surface (Widget, chart, header, CommandDeck, flash) | PASS | PASS (static) | PASS (static) | PASS (static) | PASS | PASS |
| Semantic HTML / landmarks | partial: header/nav/footer yes, **no `<main>`** | no `<main>` | no `<main>` | no `<main>` | no `<main>` | no nav/shell at all | no `<main>` | no `<main>` |
| Heading hierarchy | **FAIL** (H1→H6×5) | **FAIL** (values as H6, ~25 numeric headings) | **PASS** (H1→H2) | PASS (H1 only) | PASS (H1→H2) | PASS (H1→H2×13) | **FAIL** (H1 only; sections unsemantic) | **FAIL** (no H1, H6 only) |
| Labeled inputs | n/a (none) | **PASS** (TICKER / EXPIRATIONS / PERSONA labels associated — `input.labels` resolves) | mostly buttons | n/a | n/a | n/a | **FAIL** (2 unlabelled text inputs) | n/a |
| Contrast | PASS: `#8b949e` on `#0e1117` ≈ 6.1:1; disabled `#5b6675` ≈ 3.2:1 (acceptable for disabled) | PASS, **except 9 px TintChip type** (size, not ratio, is the failure) | PASS | PASS | PASS | PASS (dark-on-cream) | PASS | PASS |
| Touch targets ≥ ~44 px | **FAIL** (21–31 px links/buttons throughout) | FAIL (same idiom) | FAIL | FAIL | FAIL | untested | FAIL | FAIL |

Floor summary: **reduced-motion and contrast are genuinely excellent; responsiveness, focus-visible,
heading semantics, and touch targets need a dedicated hardening pass regardless of any rebrand.**

---

## 5. Copy audit

**Worst 5** (against "write from the user's side / errors explain / no false claims / no filler"):

1. **"Saved to your account."** — Settings subtitle, shown to anonymous users whose settings are
   explicitly *not* saved to any account (the page itself says so two lines later). A false claim in the
   one place the app is otherwise scrupulously honest. (`features/auth/copy.ts:70`)
2. **"Rolling window: last last ~500 req"** — operator page; duplicated word in shipped copy.
3. **"🔒 Live"** — Positions tab; an emoji doing a design system's job. The lock belongs to iconography
   (the landing already uses `LockIcon` properly).
4. **Hero: "See the AI read on your real positioning." / "Connect your positions and get an AI read on
   your real risk"** — the page's largest type sells the one capability that doesn't exist yet
   (brokerage connect is the hatched coming-soon card below). Aspirational-north-star framing is a
   choice, but as written the H1 promises what the product cannot do today.
5. **The Positions disclosure stack** — four back-to-back caveat paragraphs (browser-local → sim-fills →
   no-slippage enumeration → not-advice) before the user reaches their own book. Every sentence is
   individually good; together they read as terms-of-service, and repetition dilutes the honesty brand.

**Best 5** (genuinely rubric-grade material — copy as design):

1. **"Snapshot, never live — these stay current on a stream drop and refresh with the data load."**
   (Dealer positioning) — names the exact failure mode a trader would mis-read, in one breath.
2. **"Activity, not direction — no side implied."** (Fresh positioning) — six words that prevent the
   most dangerous misreading of Vol/OI data.
3. **"No simulated orders for TSLA. Act on an AI read to create one — it watches the live tape for the
   entry."** — an empty state that is a working tutorial: what's missing, how to make one, what it will
   do. (The Positions twin "Open one to start your book." is equally good.)
4. **"Shown factually — no thresholds, no alerts. A high line or low headroom is information, not a
   warning."** (Operator) — the product's epistemics stated as interface copy.
5. **"Nothing has closed yet. When your simulated positions start closing, this is where you'll see how
   they actually turned out — hit rate and average return by tier…"** (Track record) — an invitation
   that also sets honest expectations about *when* numbers will appear.

Honorable mention: the whole `unavailable this cycle` family (16+ strings in `widgets/_kit/copy.ts`) —
per-cell, per-row, per-widget degradation copy that never guesses. This is a designed *system* of
absence, and it is rarer than a designed system of presence.

---

## 6. What is GOOD and must survive a redesign

Verified, not vibes:

1. **The token discipline, and the machine that enforces it.** `hex-discipline.spec.ts` is a glob-based
   (not enumerated) zero-hardcoded-hex scan with a justified-exemption list *and a liveness rule that
   fails stale exemptions*. Exactly one exemption survives (the Google brand mark — legitimately
   theme-invariant). Any rebrand should change `tokens.ts` and watch the whole app follow. *(One honest
   caveat: the scan matches `#hex` only — `rgba()` literals like StatTile's neutral sheens pass through.
   Acceptable today because they're achromatic overlays, but the seam is worth knowing about.)*
2. **Light-mode parity as a delivered invariant, not a claim.** Measured live: gradients re-derive from
   the scheme primary, the hatch band swaps token pairs, the GEX chart re-fills with light
   success/error, and a census for dark-locked backgrounds found zero on both key pages. `extrasFor`/
   `elevationFor` (mode-resolved at the callback) is the pattern that made this true.
3. **The honesty patterns as designed states.** LOADING ≠ EMPTY ≠ OFFLINE is a real tri-state system:
   skeletons that "must NEVER appear post-load," offline = value dimmed to 50 % + `⏸ offline` caption
   (never a frozen value passing as live), and the `unavailable this cycle` copy family. The
   offline-supersedes-live chip rule ("a stale 'live' can never contradict a dropped transport") is
   design thinking of a high order.
4. **The restrained, gated motion program.** Flash-on-tick fires only when `isLive && !streamOffline`;
   the reveal is one-time and opacity-only; everything is feature-detected, GPU-cheap, and
   reduced-motion-guarded through one shared hook that the animated surfaces demonstrably consume.
   Keep the *gating architecture* even if the motion vocabulary changes.
5. **The elevation ladder + inset-well surface system.** A small named scale (`e1/e2/e4`) instead of
   MUI's 25 slots, luminance-first depth with shadows as the supporting cue, top-light bevels on tiles,
   recessed wells under tile grids. This is the most *original* purely-visual thinking in the app —
   more its own than the palette it's currently painted in.
6. **Mono-for-figures.** Every number on the tape in the mono stack, labels in the sans. The instinct is
   exactly right for a trading surface; a redesign should upgrade the faces, not the idea.
7. **Copy as a first-class, single-sourced material.** Strings live in owned `copy.ts` modules per
   domain, with exact-string tests. The best strings (§5) are brand assets.

---

## 7. Slop-tell scan (each tell, explicitly)

| Tell (rubric) | Present? | Evidence / note |
|---|---|---|
| Cream `~#F4F1EA` + high-contrast serif + terracotta `~#D97757` | **Partial hit — blog statics only.** | Article body measured `#f4f1eb` cream + warm neutrals; no serif (system sans), no terracotta (teal `rgb(46,111,105)`). Two of three signature components absent, but the cream field on the one off-system surface is exactly how the tell manifests |
| Near-black + single acid-green or vermilion accent | **No.** | Canvas is near-black, but the accent system is plural and semantic (blue/green/red/amber/cyan/violet), and the greens/reds are data semantics, not decor |
| Broadsheet (hairline rules, 0 radius, dense columns) | **No.** | 10–12 px radii everywhere, soft borders, card idiom |
| Purple/violet gradients on white | **No, with an asterisk.** | The blue→violet `135deg` brand gradient lives on dark and is token-derived — but it is the generic SaaS gradient family, just not on white (finding G-4) |
| Predictable layouts / cookie-cutter components | **Partial hit.** | Landing = hero + 3 cards + band + footer (L-2); bento dashboard; MUI atoms visibly MUI (default grey chip, default elevation shadow on buttons). Rescued from full slop by the inset-well/elevation system, the hatch band, and the honesty states |
| Inter / Space Grotesk overuse | **Full hit (Inter).** | The entire UI, measured (G-1). No Space Grotesk |
| Excess animation as a tell | **No.** | Motion is gated, one-time, and reduced-motion clean; if anything the risk is five families on one page (T-4), not excess per se |

---

## 8. Raw material for a signature (not a proposal — inventory)

Elements from Convexa's own world that a signature element could be built from, all already latent in the
product:

1. **The convexity curve itself.** The current motif is two béziers at 16 % opacity — but *convexity*
   (payoff curvature, the name of the company) is a drawable, ownable geometry. It could become a
   structural device (section dividers that curve, a curved data-frame edge, the loading state) rather
   than background wallpaper.
2. **Walls and magnets.** Call wall / put wall / max pain are the product's daily vocabulary and are
   inherently spatial: price *pinned between* levels, *pulled toward* a magnet. A visual language of
   fields-with-attractors (the GEX chart already draws the levels; nothing else in the app does) is
   available to no competitor's generic dashboard.
3. **The gamma flip as a threshold.** The app already treats the flip line as special (amber, "the one
   line that matters"). A signature could make regime — above/below the flip, positive/negative gamma —
   the page's *atmosphere* (the app currently whispers it in one chip: "positive gamma").
4. **The tape.** Flash-on-tick already exists and is honest. A mono-type-forward, tape-native
   identity (figures as the display face, not Inter headlines over mono data) would grow out of what
   §6.6 already does well.
5. **Dealer positioning as pressure/flow.** Charm drift and vanna ("−$16.2B delta drift into OPEX") are
   directional *forces* the copy already narrates. Vector/flow-field imagery is native to the domain and
   absent from every generic fintech template.

The redesign's identity budget should be spent on **one** of these, with type as the delivery mechanism
(G-1) — everything in §6 (tokens, parity machinery, honesty states, motion gating, elevation system)
is the chassis the new skin bolts onto.
