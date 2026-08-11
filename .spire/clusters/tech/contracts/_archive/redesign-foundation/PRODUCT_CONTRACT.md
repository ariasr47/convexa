# redesign-foundation — PRODUCT CONTRACT

> Role: Delivery PM (PM-after-Architect, GATE P·X). PRODUCT LAYER ONLY of feature `redesign-foundation`.
> Self-contained against `.claude/PROJECT_CONTEXT.md` (§5/§6/§7), `.claude/contracts/redesign-foundation/
> BRIEF.md`, and the LOCKED `ARCHITECTURE_CONTRACT.md` (its §1–§7 boundary is respected and never
> contradicted here). No chat-history dependency.
>
> This contract owns: user stories, scope (In/Out/Future), product behavior, and acceptance criteria
> observable WITHOUT reading code. It owns NO code, math, endpoints, payload/field names, or UI layout —
> those are the Architect's (locked) and the UX/FE lanes' (downstream). Where the export needs a product
> meaning (cyan/violet roles, no-data-source elements, fidelity bar), that decision is made in §1.
>
> **What this feature is:** a *purely visual* reskin. The Landing, the AppShell nav, and the shared theme
> adopt the Claude Design dark-fintech visual language. Structure, copy, behavior, routes, durable state,
> the scoring path, and every degraded/honesty surface are PRESERVED byte-for-byte in observable terms.
> If a desired visual outcome cannot be reached without changing structure/behavior/the technical shape,
> that is an ARCHITECTURE_CONTRACT amendment (GATE-Z bounce) — NOT a silent scope narrowing here.

---

## 0. The one-paragraph product summary

Convexa gets a visual refresh. A trader arriving at the front door (`/`) sees the same Landing they see
today — same hero hook, same "what works today" value cards, same honest "coming soon" brokerage and
Scanner, same footer disclaimer — but rendered in the redesigned dark-fintech look faithful to the
commissioned Claude Design export: a darker base, a layered panel/elevation feel, a clear three-tier text
hierarchy, the brand accents, and **Roboto Mono on numerics**. Inside the app, the persistent top nav
(the Convexa wordmark + Ticker / Positions / Scanner + the account control) is restyled to match and keeps
persisting across pages. A light theme remains a legible, supported secondary. Nothing a trader can *do*
changes: every link goes where it went, the waitlist still just acknowledges in place, simulated stays
labelled simulated, and no number, score, or saved position is altered.

---

## 1. Product decisions made here (the owner-resolved inputs + PM calls)

The conductor resolved the Architect's five §7 open questions on the owner's behalf. They are RESTATED
here as binding product decisions, plus the PM-level dispositions that follow from them.

### D1 — Fidelity bar: HIGH / faithful to the export
- The target is **HIGH fidelity to the Claude Design export** — the owner commissioned the redesign and
  directed "implement it." The redesigned Landing and nav must match the export's **structure, composition,
  and visual language** (the dark-fintech look, the section ordering, the card-grid feel, the accent and
  text hierarchy) as seen in the reference screenshots.
- **Faithful, not pixel-locked over correctness.** Where pixel-exactness conflicts with (a) real data /
  real component behavior, (b) a preservation rule in §4, or (c) the honesty floor, the real behavior
  WINS and the deviation is acceptable — the UX lane notes any such deviation. Fidelity never licenses
  removing/renaming a `data-testid`, changing copy a test asserts, or making a non-functional affordance
  look functional.
- **Observable bar for an AC:** a reviewer comparing the running Landing/nav side-by-side with the export
  screenshots (`01-landing.png` for the Landing; the persistent nav across `02`–`05`) recognizes it as
  the same design — same hero, same value-card row, same coming-soon band, same footer, same nav chrome —
  in the dark-fintech palette, not the pre-redesign look.

### D2 — Light mode stays a legible, supported secondary
- The dark theme is the default and the design's native mode. The **light theme remains supported and
  legible**: it must resolve to a valid light palette where text, controls, and surfaces are readable and
  nothing leaks dark-on-dark or dark-on-light. The exact light counterpart values are derived downstream
  (UX/FE); the product requirement is only **resolves + legible**, with the same theme-preference behavior
  user-accounts already ships (anonymous default dark; a signed-in/anonymous "light" preference yields the
  light theme). No new theme-preference UI, no new durable key.

### D3 — No-data-source elements: omit, or honest "coming soon" — never a working-looking control over absent data
- The honesty floor (`[no-real-order-path]`) governs every affordance. If the export shows any element on
  the Landing or nav that maps to **no built capability / no real data source**, it is EITHER omitted OR
  presented as an explicitly honest, non-functional "coming soon" affordance. It is NEVER rendered as a
  working-looking control over data we don't have.
- **Disposition in the foundation triplet (PM finding):** the only such elements that appear in this
  feature's surfaces are the two already-honest ones — the **"Connect a real brokerage"** block (a
  non-navigating *acknowledge-in-place* waitlist affordance with a "coming soon" marker) and the
  **Scanner** block (a "coming soon" marker linking to the honest Scanner placeholder page). Both stay
  exactly as honest as today. The reskin may restyle them to match the export but must keep them visually
  honest (see AC-H1/AC-H2). No new data-bearing element is introduced by this feature.

### D4 — Accent meanings (so the visual vocabulary is correct)
- **Blue** = the primary/interactive accent (CTAs, links, the active-nav indicator, the brand mark) — its
  product meaning and current value are UNCHANGED.
- **Cyan** = **informational / secondary** accent (a quiet, non-primary highlight; informational emphasis).
  Not a status color, not a primary CTA color.
- **Violet** = the **AI / persona** brand accent. It mostly matters in later features (the AI-rec / persona
  surfaces, features 2–4); within THIS feature it may appear only as part of the brand/visual language if
  the export uses it on the Landing/nav, and never as a status meaning.
- **Green = calls, red = puts** is a domain meaning and is NEVER inverted or recolored (carried from the
  bundle/chart conventions). This feature does not introduce call/put coloring on its surfaces, but the
  shared theme it establishes must preserve that meaning for the surfaces that inherit it (AC-Inv-2).

### D5 — Fonts: self-hosted Inter + Roboto Mono, additive
- Inter (UI body) and **Roboto Mono (numerics)** are **self-hosted** assets, loaded additively (no web
  font is loaded today, so this adds rather than replaces). Self-hosting is the product call — it keeps
  the offline-honesty and deploy/secret posture intact (no third-party font CDN dependency at runtime).
- If a font asset fails to load, the surface **degrades to a system fallback and stays fully legible** —
  never a blank, broken, or error surface (AC-Type-2). A trader never sees a missing-font failure state.

### D6 — Reskin only; everything else preserved
- This is a visual reskin of the **foundation theme + Landing + AppShell nav (+ the Convexa brand mark)**.
  It changes **no** product behavior, route, copy that a test asserts, durable key, score, or backend.
  The deferred surfaces (Ticker / Positions / Scanner page internals / Settings-auth / operator) inherit
  the new theme automatically but receive NO component reskin in this feature.

**Flagged for owner confirmation (non-blocking):** none of D1–D6 invents product scope — they restate the
owner-resolved inputs. The only items a downstream reviewer may want the owner to eyeball are listed in
§7 ("Items flagged for owner confirmation"); they are visual-judgment calls, not scope changes.

---

## 2. User stories

- **US-1 (front-door impression).** As a trader landing on `/`, I want Convexa to look like a polished,
  modern dark-fintech product so that my first impression is "this is credible and current," not dated.
- **US-2 (recognize the redesign).** As the owner who commissioned the Claude Design redesign, I want the
  shipped Landing and nav to faithfully match the export so that what I paid for is what went live.
- **US-3 (unchanged navigation).** As a returning trader, I want every button, link, and tab to still do
  exactly what it did before so that the new look never makes me re-learn the app or hit a dead end.
- **US-4 (legible numbers).** As a trader, I want numeric readouts rendered in a clean monospace so prices,
  P/L, and metrics line up and are easy to scan — established now so every numeric surface inherits it.
- **US-5 (light-mode user).** As a trader who prefers a light theme, I want the app to stay legible and
  usable in light mode after the redesign so the refresh doesn't take away a mode I rely on.
- **US-6 (honest about what's not built).** As a trader, I want anything that isn't built yet to keep
  looking clearly "coming soon" so I'm never tricked into thinking I connected a broker or ran a scan.
- **US-7 (no surprise to my data).** As a trader, I want my simulated positions, saved views, and the
  analysis I see to be exactly the same after the redesign so a visual update never touches my data or
  the numbers the engine produces.
- **US-8 (a foundation for later).** As the owner, I want this first feature to establish the shared theme
  and reskin pattern so the later per-surface redesigns (Ticker, Positions, Scanner, Settings) inherit
  the look without re-deciding it.

---

## 3. Scope

### 3.1 In scope (this feature)
- **The shared visual foundation (theme):** the dark-fintech token vocabulary from the export — a darker
  base, a layered panel/elevation feel, a three-tier text hierarchy, the borders, and the brand accents
  (blue primary, cyan informational, violet AI-accent; green=calls / red=puts preserved) — adopted as the
  app's single theme so every surface inherits the new look. Both the dark (default) and light themes.
- **Typography:** self-hosted Inter (UI) and self-hosted Roboto Mono (numerics), loaded and available as
  the established way to render numbers in mono.
- **The Landing (`/`):** reskinned to the export — hero (brand mark, hook headline, sub-hook, primary
  CTA), the "what works today" value-card row, the honesty band (brokerage "coming soon" + Scanner
  "coming soon"), and the footer disclaimer — all in the new visual language, all behavior preserved.
- **The AppShell nav:** the persistent top chrome (Convexa wordmark + Ticker / Positions / Scanner tabs +
  the account control) reskinned to the export and still persisting across in-shell pages.
- **The Convexa brand mark** (wordmark + convexity arc): may be restyled visually; stays a data-free,
  fetch-free brand element rendering the literal wordmark "Convexa."

### 3.2 Out of scope (explicitly NOT this feature)
- **No component reskin** of the Ticker / GEX viewer, the Positions portfolio internals, the Scanner page
  internals, the Settings/auth surfaces, or the operator metrics surface. These INHERIT the new theme
  (they render under the same app theme) — that automatic inheritance is expected and acceptable — but
  none of their components are individually redesigned here.
- **No product-behavior change** of any kind: no new control, no changed copy that a test asserts, no
  route change, no new nav entry, no new page.
- **No backend / scoring change.** `apps/api` is untouched; the score / tier / `state_fingerprint` and
  the AI gate are byte-identical. No theme/font/style becomes a scoring input.
- **No durable-state change.** No new or renamed localStorage key; keys stay `convexa.*`. No theme-
  preference UI change.
- **No operator-surface exposure.** `/_ops/metrics` stays off the nav, unlinked, and unstyled by this
  feature.

### 3.3 Future-dated (later features in the program — NOT now)
- **Feature 2 — Ticker / GEX viewer** reskin (numeric-heavy; inherits the Roboto Mono handle established
  here).
- **Feature 3 — Positions** portfolio reskin.
- **Feature 4 — Scanner page + Settings/auth** reskin (the AI-key field stays write-only/masked and the
  server gate holds — flagged for that feature, out of scope now).
- Reconciling existing ad-hoc monospace usages onto the established mono handle (a later cleanup).
- Operator metrics reskin — NOT part of this program.

---

## 4. Product behavior (what the trader observes — preservation is the behavior)

Because this is a visual reskin, the "behavior" is overwhelmingly *preservation* of today's behavior under
a new skin. The following are the observable behaviors that must hold after the reskin.

### 4.1 The Landing (`/`)
- The Landing is a single dark marketing surface rendered **outside** the trader nav shell.
- It is **static**: rendering `/` issues **no trader/bundle/analysis network request** and opens no live
  stream (a one-time, non-blocking who-am-I account read is a pre-existing app concern, not the Landing).
- The hero shows: the Convexa brand mark, the headline hook **"See the AI read on your real positioning."**,
  a sub-hook referencing live dealer-gamma context, and a primary CTA that enters the app at the Ticker
  viewer.
- A "what works today" row presents three value cards — **Ticker / GEX analysis**, **Simulated positions
  portfolio**, **AI recommendations** — each with its descriptive copy and a CTA that navigates into a
  real in-app route (no dead-end).
- The honesty band presents the **"Connect a real brokerage"** block and the **Scanner** block, both
  marked "coming soon" (see §4.3).
- The footer carries the simulated/not-investment-advice disclaimer.
- The jargon tooltips (e.g. on "dealer gamma," "SIMULATED") remain present and on-hover.

### 4.2 The AppShell nav
- The nav is the **persistent** chrome for the in-shell pages: the Convexa wordmark, the Ticker / Positions
  / Scanner tabs, and the account control.
- It **persists across in-shell navigation** — moving between Ticker, Positions, and Scanner swaps the
  page content beneath the bar without the bar remounting/flashing.
- The **active** tab is visibly and accessibly indicated (the current page's tab is marked as the current
  page); the other tabs are not.
- The **wordmark links to `/`** (the Landing — the honest front door), never to the operator route.
- The nav contains **no** link/button/menu entry to the operator metrics route.
- The nav owns no feature data, makes no fetch, opens no stream; a page error renders inside the page area
  and never blanks the nav bar.

### 4.3 Honesty surfaces (must stay honest under the new skin)
- The **"Connect a real brokerage"** block is a **non-navigating** affordance: activating it acknowledges
  in place (a "thanks, we'll let you know" acknowledgement), stays on the Landing, enters no broker flow,
  and issues no network call. It is visibly marked "coming soon." The reskin must NOT make it look like a
  working/primary connect button.
- The **Scanner** block is marked "coming soon" and links only to the honest Scanner placeholder page —
  never presented as a working scanner.
- The **footer disclaimer** stays present: positions/trades are **simulated** (paper), not investment
  advice, no brokerage connection.
- Across the (inherited) deferred surfaces, the **SIMULATED** labelling, the live-vs-static offline
  degrade (dimmed + offline caption, never blanked), and call=green/put=red stay intact and visually
  distinguishable under the new theme (see §4.5 and AC-Inv-2/AC-Inv-3).

### 4.4 Typography
- Numeric readouts render in **Roboto Mono** (a clean tabular monospace) as the established numeric style.
- Body/UI text renders in **Inter**.
- A font that fails to load degrades to a legible system fallback — never a blank/error surface.

### 4.5 Theming & isolation (preserved)
- **Dark is the default**; an anonymous, never-touched visitor sees the dark theme.
- The **light theme resolves and is legible** when selected (the existing theme-preference mechanism is
  unchanged).
- The reskin keeps the live-vs-static degrade **visually distinguishable**: a dimmed/offline live tile is
  still clearly distinct from a normal tile and from an "unavailable this cycle" tile under the new
  palette — the theme must not pick colors that make the offline-dim invisible or ambiguous.
- The **scoring path is untouched**: the score, tier, AI gate, and `state_fingerprint` are byte-identical
  before and after the reskin; no setting/theme/font is ever a scoring input.
- **Durable state is untouched**: no localStorage key/value changes; a returning user's simulated
  positions, saved views, persona, and theme preference are all preserved.

---

## 5. Acceptance criteria (each AC = a required behavioral test; observable WITHOUT reading code)

> Every AC is observable by a reviewer or a test that exercises the running UI and asserts on visible
> structure, text, behavior, accessibility state, or the absence of a network call — never by reading
> source. Each is the required behavioral test the executioners must cover and QA traces at GATE Q. The
> degraded/edge variations are split out as their own ACs.

### A. Landing — visual fidelity (D1, US-1/US-2)
- **AC-Land-1 (hero present, redesigned).** On `/`, the hero renders the Convexa brand mark, the exact
  headline **"See the AI read on your real positioning."**, a sub-hook, and a primary CTA — in the
  redesigned dark-fintech look matching the export hero.
- **AC-Land-2 (value cards preserved).** On `/`, the three value cards render with their titles —
  **"Ticker / GEX analysis"**, **"Simulated positions portfolio"**, **"AI recommendations"** — as a
  card row matching the export's "what works today" section.
- **AC-Land-3 (honesty band present).** On `/`, the brokerage block and the Scanner block both render,
  each visibly marked "coming soon," matching the export's coming-soon band.
- **AC-Land-4 (footer disclaimer present).** On `/`, the footer renders the simulated / not-investment-
  advice / no-brokerage-connection disclaimer.
- **AC-Land-5 (recognizably the export).** A side-by-side comparison of the running Landing with
  `01-landing.png` is recognizable as the same design (same hero, value-card row, coming-soon band,
  footer) in the dark-fintech palette — not the pre-redesign appearance.

### B. Landing — behavior preserved (US-3/US-7)
- **AC-Land-6 (static — no network on `/`).** Rendering `/` issues no trader/bundle/analysis fetch and
  opens no live stream. (The one-time non-blocking who-am-I account read is excluded.)
- **AC-Land-7 (primary CTA enters the app).** Activating the hero primary CTA navigates into the in-shell
  Ticker viewer (default symbol).
- **AC-Land-8 (value-prop CTAs navigate, no dead-end).** Each value-card CTA navigates into a real in-shell
  route — the Positions card to the Positions page, the Ticker/AI cards to the Ticker viewer — none
  dead-ends.

### C. Honesty surfaces — stay honest (D3, US-6; `[no-real-order-path]`)
- **AC-H1 (brokerage is non-navigating "coming soon").** The brokerage block shows a "coming soon" marker;
  activating its waitlist affordance produces an in-place acknowledgement, stays on the Landing, triggers
  no navigation, and issues no network call. It is not styled as a working/primary connect control.
- **AC-H2 (Scanner is "coming soon").** The Scanner block shows a "coming soon" marker and links only to
  the honest Scanner placeholder page; it is never presented as a working scanner.
- **AC-H3 (simulated stays labelled).** The Landing footer disclaimer and the "SIMULATED" framing on the
  surfaces that carry it remain present and honest under the new skin.

### D. AppShell nav — visual + behavior (D1, US-3)
- **AC-Nav-1 (nav reskinned + persistent + wordmark).** On an in-shell page, the redesigned nav renders
  the Convexa wordmark and the Ticker / Positions / Scanner tabs (and the account control), matching the
  export nav chrome; the wordmark text is exactly **"Convexa"** (never "GammaFlow").
- **AC-Nav-2 (nav persists across pages).** Navigating between Ticker, Positions, and Scanner keeps the
  same nav bar in place (no remount/flash); the page content swaps beneath it.
- **AC-Nav-3 (active-tab indication).** The tab for the current page is marked as the current page
  (accessible current-page state); the other tabs are not.
- **AC-Nav-4 (wordmark → Landing).** The wordmark links to `/` (the Landing), not to the operator route.
- **AC-Nav-5 (Landing has no trader nav).** On `/`, the trader nav shell is NOT rendered.

### E. Typography (D5, US-4)
- **AC-Type-1 (numerics in mono).** Numeric readouts render in Roboto Mono (a tabular monospace) as the
  established numeric style; body/UI text renders in Inter. Both fonts are actually loaded (not a bare
  system fallback when the network is healthy).
- **AC-Type-2 (font-fail degrades legibly).** If a font asset fails to load, the affected text falls back
  to a legible system font and the surface stays fully usable — never a blank or error surface.

### F. Theming — both modes resolve, isolation holds (D2, US-5; `[live-vs-static-isolation]`)
- **AC-Theme-1 (dark default).** An anonymous, never-touched visitor sees the redesigned dark theme by
  default; the app renders without a theming error.
- **AC-Theme-2 (light resolves + legible).** With the light theme preference selected, the app resolves to
  a valid light palette where text and controls are legible and nothing leaks dark-on-dark; switching
  preference works as today.
- **AC-Theme-3 (offline-dim stays distinguishable).** Under the new theme, a live tile in its dimmed/
  offline degraded state is still visually distinct from both a normal tile and an "unavailable this
  cycle" tile — the reskin does not make the offline-dim invisible or ambiguous.

### Inv. Invariants (preserved — observable; PROJECT_CONTEXT §5)
- **AC-Inv-1 (every existing testid + asserted copy + role preserved).** Every `data-testid`, asserted
  text string, link role, and accessible current-page state on the Landing and the nav that the existing
  suite queries is preserved verbatim; the existing Vitest suite stays green with no removed/renamed
  testid and no changed asserted copy.
- **AC-Inv-2 (call/put + accent meanings preserved).** The shared theme preserves green=calls / red=puts
  (never inverted/recolored) and the primary-blue / cyan-informational / violet-AI accent meanings, so
  the inherited deferred surfaces keep their correct status colors.
- **AC-Inv-3 (degraded + honesty visuals survive).** After the reskin, the live-vs-static offline degrade
  (dimmed + offline caption, never blanked) and the honesty surfaces (SIMULATED, the non-navigating
  brokerage, the coming-soon Scanner) remain intact and visually honest on the inherited surfaces.
- **AC-Inv-4 (scoring path byte-identical / NO_BACKEND_CHANGE).** The score, tier, AI gate, and
  `state_fingerprint` are byte-identical before and after the reskin; no theme/font/style is a scoring
  input; `apps/api` is untouched.
- **AC-Inv-5 (durable state untouched).** No localStorage key or value changes; keys stay `convexa.*`; a
  returning user's simulated positions, saved views, persona, and theme preference are preserved.
- **AC-Inv-6 (operator separation).** No nav/Landing link, button, or menu reaches `/_ops/metrics`; the
  operator surface is not reskinned and stays off the shell and unlinked.
- **AC-Inv-7 (single theme + single router preserved).** The reskin introduces no second theme provider
  and no second router; the one app theme and one router still work for deep-links, nav, and theming with
  no duplicate-provider error.

---

## 6. Product-level constraints the next role must not violate

Restated for UX/FE. These are HARD; a conflict is a GATE-Z / ARCHITECTURE-amendment bounce, never a silent
narrowing.

1. **Reskin only — preserve every observable behavior.** No `data-testid` removed/renamed/moved off the
   element a test queries; no asserted copy changed; no route/nav-entry/page added or removed; the
   non-navigating brokerage and coming-soon Scanner stay non-functional and honest.
2. **High fidelity to the export, but correctness/honesty wins over pixels.** Match the export's structure
   and look; deviate only where pixel-exactness conflicts with real data/components, a §5 preservation AC,
   or the honesty floor — and note the deviation. Do not invent a Landing element that has no built
   capability behind it (D3); do not make a coming-soon affordance look working.
3. **Both themes resolve; dark is default, light is legible.** The theme work may not collapse to a
   dark-only theme; light must stay a valid, legible secondary. No new theme-preference UI or durable key.
4. **Numerics in mono via the established handle; fonts self-hosted + fail-soft.** Roboto Mono is the one
   established way to render numerics; Inter is the UI body font; both self-hosted; a font-load failure
   degrades to a legible system fallback, never a blank/error surface.
5. **Accent meanings are fixed.** Blue = primary/interactive, cyan = informational/secondary, violet =
   AI/persona accent; green = calls, red = puts (never inverted). The new theme must carry these so the
   inherited surfaces stay correct.
6. **No backend / scoring / durable-state change.** Score / tier / gate / `state_fingerprint` byte-
   identical; `apps/api` untouched; no localStorage key/value change; no setting becomes a scoring input.
7. **Operator separation holds.** No nav/Landing path to `/_ops/metrics`; that surface is not reskinned.
8. **No second theme provider / router.** Tokens flow through the one existing theme; the one router stays.

---

## 7. Items flagged for owner confirmation (non-blocking — visual judgment only)

These are the only places a downstream reviewer may want an owner eyeball. None changes scope; each has a
safe default already chosen.

- **F1 — Violet on the Landing/nav.** Violet is the AI/persona accent and mostly matters in later
  features. If the export uses violet on the Landing/nav as part of the brand language, it appears as
  visual brand only (never a status meaning). *Default: include it where the export shows it on these
  surfaces; confirm only if the owner wants violet held back entirely until the AI surfaces ship.*
- **F2 — Any export Landing element beyond today's set.** PM finding: the export's Landing
  (`01-landing.png`) maps element-for-element to today's Landing (hero, value-card row, brokerage +
  Scanner coming-soon band, footer). *Default: if the UX lane reading the compiled bundle discovers an
  additional element with no built capability behind it, it is omitted or rendered as honest "coming soon"
  (D3) — confirm with the owner only if it appears to be a genuinely new product surface (which would be
  out of this feature's scope and an ARCHITECTURE/BRIEF bounce).*
- **F3 — Light-mode look.** The export is a dark design; the light counterpart values are derived
  downstream. *Default: any valid, legible light palette satisfies the product bar (D2); confirm only if
  the owner has a specific light-mode aesthetic in mind.*

---

## 8. Compressor #2 — 5-bullet summary (for the UX/Tech-Writer lane)

- **Purely visual reskin of theme + Landing + AppShell nav (+ brand mark)** to the Claude Design export at
  HIGH fidelity (dark-fintech look; correctness/honesty wins over pixels). Everything else is preserved;
  deferred surfaces inherit the theme but get no component reskin.
- **Preserve every observable behavior:** all `data-testid`s, asserted copy, routes, the static no-network
  Landing, the persistent + active-aware nav, the wordmark→`/`, and the existing green suite. A removed
  testid / changed copy / new element-with-no-capability is a bounce, not a silent narrowing.
- **Honesty floor holds:** the non-navigating brokerage "coming soon" (acknowledge-in-place, no network),
  the coming-soon Scanner (links only to the placeholder), SIMULATED labelling, and the live-offline dim
  (dimmed + offline caption, distinguishable under the new palette) all stay honest.
- **Theming + type:** dark default + legible light (both resolve, no new pref UI/key); self-hosted Inter +
  Roboto Mono (numerics in mono via one established handle; font-fail degrades to a legible fallback).
  Accent meanings fixed: blue=primary, cyan=informational, violet=AI/persona; green=calls/red=puts.
- **NO_BACKEND_CHANGE:** score / tier / gate / `state_fingerprint` byte-identical; no scoring input added;
  durable `convexa.*` keys untouched; `/_ops/metrics` stays off-shell + unreskinned; one theme + one
  router.
