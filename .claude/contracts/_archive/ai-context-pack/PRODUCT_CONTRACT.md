# ai-context-pack — PRODUCT CONTRACT (PM, compressed for the UX/Tech-Writer)

> Reader has ONLY `.claude/PROJECT_CONTEXT.md` + `ARCHITECTURE_CONTRACT.md` + this contract.
> Decisions, not deliberation. PM lane: no code, no math, no endpoints, no wire names, no layout.
> Every AC below is observable without reading code and is a REQUIRED behavioral test — the FE
> execution contract's test matrix must cover each, and QA traces each at GATE Q.

## 1. Product goal (derived from ARCHITECTURE_CONTRACT §1 — not re-scoped)

Give the trader — and, automatically, the in-app AI — a small, honest, pre-digested **market
context read** on the Ticker page, built entirely from data already in hand: (a) a 3-label
trend/momentum regime read, (b) how concentrated/skewed the dealer-gamma structure is,
(c) whether today's option flow sits where the standing positioning sits, and (d) realistic
multi-horizon daily-range context (ATR). It rides the existing bundle and the existing AI state
export. It is **advisory context only — never a scoring input, never a guarantee** — and every
surfaced read carries its own assumptions (window / thresholds / basis / as-of) visibly.

## 2. Users & stories

- **Trader (primary, anonymous or signed-in — no auth gate on any of this):**
  1. Before trusting mean-reversion around the GEX levels, I want a digested trend-direction /
     trend-strength / momentum read so I know whether the tape is trending or chopping.
  2. I want to see at a glance whether the dealer-gamma structure is concentrated or dispersed,
     and whether it sits above or below spot, without interpreting the whole profile chart.
  3. I want to know when **today's** option activity sits somewhere different from the standing
     OI (rotation) — stated honestly as composition/location only, never a buy/sell claim.
  4. I want typical-range context (5/14/30-day ATR, $ and %) to sanity-check whether a move or
     distance is realistic — WITHOUT the app computing stops/targets for me (out of scope).
  5. When I ask the in-app AI, I want it fed these same reads (they ride the state export
     automatically) with zero effect on the score/tier/gate.
  6. When any read can't be computed honestly, I want that read — and only that read — to say
     so, with everything else intact.
- **Operator:** I want the new compute's cost visible in the existing `/_ops/metrics` readout,
  off the trader path.

## 3. Scope

**In (this feature):**
- The four reads on the cached bundle (Architect §3 content, pinned) + their independent nulls.
- ONE new trader-facing surface on the Ticker page presenting all four reads (composition intent
  in §4.2; layout/copy final form = UX lane).
- Automatic AI state-export ride-along (zero serializer change, zero prompt-template change).
- Glossary coverage for the pack + each read (windows, thresholds, bases, caveats).
- The optional operator observability span — **wanted this pass** (§4.6).

**Out (hard — inherited non-goals, restated as product scope):**
- Never a scoring/gate/tier/fingerprint input. No raw indicator/OHLC series shown or shipped.
- No buy/sell, aggressor-side, or "smart money" framing anywhere (flow volume has no side).
- No stop/target, distance-to-level, or sizing display (ATR is context + a future-enabler seam).
- No prompt-template or persona change; no threshold tuning knob/env in v1; nothing on SSE.
- No IV-rank / market-backdrop / volume-profile-CVD (separately queued GATE I items).

**Future-dated (named, not built — backlog items, not silent scope):**
- Distance-to-level display derived from ATR (zero-backend-change seam, Architect §3d).
- Threshold/window tuning as its own feature (never silent drift).
- An explicit prompt-template mention of the pack (deliberately NOT done now — §4.4).

## 4. Product decisions made here (resolves ARCHITECTURE_CONTRACT §9, in order)

**4.1 Naming/vocabulary (§9.1).** Final wire/field names + `@org/api` types = interface contract
(UX split). The **product-visible vocabulary** is decided here and must inform them:
| Concept | Product name (display-family; exact strings = UX) |
|---|---|
| The pack | **Market context** (framed as: context the AI also reads) |
| Child 1 (TI regime) | **Trend & momentum** — labels: Trend, Strength, Momentum |
| Child 2 (GEX shape) | **Gamma profile shape** — Concentration, Above/below balance, Center of mass |
| Child 3 (divergence) | **Flow vs positioning (today)** — Location, Composition |
| Child 4 (ATR) | **Average true range** — 5-day / 14-day / 30-day rows, $ and % |
Enum values surface as a **1:1 meaning-preserving display mapping** (e.g. `above_skewed` →
"Skewed above spot") — one display string per enum value, never softened/strengthened/re-bucketed,
never replaced by a bare number. UX owns the exact mapping table; the FE contract must pin it.

**4.2 Ticker-page surfacing (§9.2).** **All four children render, in ONE surface** (one widget in
the existing Ticker bento board — not four separate tiles), **static family, adjacent to and after
the dealer-flow projection read** (the "AI context" family stays grouped). It inherits the shared
Widget-shell behavior as-is (expand functional; grip/⋮/add stay affordance-only). **The digested
headline labels of all four reads must be visible WITHOUT expanding** — digestion is the point;
scalars/thresholds may sit in tooltips or the expanded view. Exact placement, internal arrangement,
and expand content = UX lane.

**4.3 User-facing copy intent (§9.3).** (Final strings = UX/Tech-Writer; intent binding.)
- **Labels:** mapped 1:1 per §4.1.
- **Assumptions line (`model-read-carries-its-assumptions`):** each sub-read shows its basis
  visibly without interaction — TI + ATR: as-of session date + window; shape: spot basis;
  divergence: the flow-basis descriptor including "today's session cumulative option volume,
  unsigned (no buy/sell side)". Exact thresholds + windows live one affordance away (hover
  tooltip, the app's existing jargon-tooltip convention — §4.5).
- **Advisory framing:** one visible line on the surface, mirroring dealer-flow-projection's
  pattern: advisory context (for the AI and you) — not a scored signal, not a forecast, not a
  guarantee.
- **Null copy:** reuse the established honest family — each null read/label shows its own
  "unavailable this cycle" state; whole-pack null = one surface-level unavailable state. **No
  per-null reason codes on the wire in v1** (product-accepted; the glossary explains
  insufficient-history as a cause). Never a fabricated value, never a silent blank.
- **Glossary:** `market_state_glossary.md` gains entries for the pack + each of the four reads:
  what each label means, its window + pinned thresholds, the unsigned-flow caveat, the ATR
  method + horizons, and the advisory/never-scored framing.

**4.4 AI prompt handling (§9.4).** **Rely on the automatic export ride-along ONLY.** No
prompt-template change, no template mention of the pack (protects the Default-persona
byte-identical rendering; the pack is self-describing in-payload, so the model sees labeled,
threshold-carrying reads without guidance). The BRIEF's "AI cites regime/ATR/shape/divergence"
outcome is realized as **pack-present-in-export**; an LLM actually citing it is stochastic and
is deliberately NOT an acceptance criterion. A template mention is a named future item (§3).

**4.5 Threshold visibility (§9.5).** **Yes — visible in the product.** Windows/bases inline per
§4.3; exact pinned thresholds via the per-label hover tooltip + the glossary. A future tuning
knob is a backlog item (§3 Future-dated); v1 thresholds are fixed and presented as fixed.

**4.6 Operator observability span (§9.6).** **Wanted this pass.** The pack compute gets its own
stage span at the orchestration boundary (off_exchange pattern, skipped-honest), visible only on
`/_ops/metrics`; nothing pack-related renders on trader routes from `meta`.

## 5. Product behavior (dashboard)

- Renders for **any visitor** (anonymous browsing unchanged — no sign-in, no gate).
- Values arrive with the bundle poll (~60s) and change **only** on a new bundle; the surface
  shares the bundle's freshness/staleness presentation.
- **Static family:** never dims, blanks, or badges on a live-stream drop; excluded from the
  live-offline treatment exactly like the four positioning tiles + dealer-flow projection.
- Independently honest degradation at every level: per-label (TI), per-horizon (ATR),
  per-sub-component (divergence), per-read, whole-pack — each shows its own unavailable state
  while everything else keeps rendering.
- New FE surface is token-only (`theme-token-discipline`), dark + light parity part of done.

## 6. Acceptance criteria (each = one observable behavior = one required test)

**Default / happy path**
- **AC-1 (pack renders, anonymous):** With a healthy bundle carrying all four reads, the Ticker
  page shows the Market-context surface with all four sub-reads populated — Trend & momentum
  (3 labels + their generating scalars), Gamma profile shape (concentration + balance labels,
  3 scalars, eligible-strike count), Flow vs positioning (location + composition labels, both
  PCRs, the shift scalar), ATR (3 horizons, each $ and % + window) — with no sign-in.
- **AC-2 (vocabulary fidelity):** Every displayed label is the 1:1 display mapping of exactly one
  pinned enum value; no other label text can appear; a different enum value in the payload
  renders its mapped display string.
- **AC-3 (digested only):** The surface shows labels + their declared basis scalars only — no raw
  indicator time series, no OHLC array, no multi-period indicator table, anywhere.
- **AC-4 (assumptions visible):** Without any interaction, each sub-read shows its basis: TI and
  ATR the as-of session date + window; shape its spot basis; divergence its flow-basis descriptor
  including the unsigned/no-side statement.
- **AC-5 (thresholds discoverable):** Each label exposes a hover/tooltip affordance revealing its
  window and the exact pinned v1 thresholds.
- **AC-6 (advisory framing):** The surface carries a visible advisory line (context, not a scored
  signal / forecast / guarantee) without any interaction.
- **AC-7 (no trade advice):** Nowhere in the surface: buy/sell or "smart money" wording, stop/
  target, distance-to-level, or sizing figures; divergence composition wording is put/call
  composition only.

**Refresh & live/static isolation**
- **AC-8 (bundle cadence):** Pack values change only when a new bundle arrives; live SSE ticks
  between polls change nothing in the surface.
- **AC-9 (stale honesty):** When the bundle is flagged stale, the pack shares the page's existing
  staleness presentation — never presented fresher than its bundle.
- **AC-10 (SSE drop, un-dimmed):** On a live-stream drop, all four reads stay fully visible and
  un-dimmed while the live-derived tiles dim and the offline chip shows; on reconnect, the pack
  is unchanged until the next bundle.
- **AC-11 (nothing on SSE):** The live SSE payload is unchanged by this feature (no pack fields
  ride it).

**Degraded / nulls (each its own test)**
- **AC-12 (single read null):** Exactly one read null → only that read shows its own "unavailable
  this cycle" state; the other three render with values; no error banner; page intact.
- **AC-13 (TI per-label null):** One TI label null (e.g. strength when high/low are missing) →
  that label alone shows unavailable; the sibling TI labels render with values.
- **AC-14 (under-warmed = honest null):** With insufficient history, every affected label/read
  shows unavailable — never a silently-emitted or implausible value.
- **AC-15 (ATR per-horizon null):** A null ATR horizon is individually shown unavailable (or
  honestly omitted per UX pattern); the remaining horizons render; a 0 is never shown for it.
- **AC-16 (divergence sub-null):** Location and Composition degrade independently — one null
  leaves the other rendering with its values.
- **AC-17 (whole-pack null):** Parent object null → one surface-level "unavailable this cycle"
  state; the GEX chart, positioning tiles, dealer-flow read, live tape, and the rest of the page
  are unaffected; no HTTP-error surface anywhere.
- **AC-18 (pre-feature payload):** A bundle lacking the pack field entirely renders the
  surface-level unavailable state with no crash and no console errors.

**Export / AI**
- **AC-19 (export ride-along):** The state export (export drawer / no-LLM export floor) contains
  the pack with the same values the page shows.
- **AC-20 (export null honesty):** A read that is null on the page is null/absent in the export —
  never fabricated there.
- **AC-21 (prompt unchanged):** The Default-persona AI hand-off (View AI hand-off) renders
  byte-identical to pre-feature; no prompt template mentions the pack.

**Invariants (observable)**
- **AC-22 (score byte-identity):** `opportunity_score` / `opportunity_tier` /
  `state_fingerprint` in the bundle are byte-identical with vs without the pack, including under
  a forced whole-pack failure.
- **AC-23 (existing values unchanged):** The extended daily-bar history changes no existing
  displayed value — HV 30d, IV/HV, VWAP bands, the four positioning tiles, and the dealer-flow
  projection are identical on identical underlying data.
- **AC-24 (theme parity):** The surface renders correctly in BOTH dark and light modes,
  token-only — no unthemed/illegible element in either mode.
- **AC-25 (glossary):** Glossary entries exist for the pack + each of the four reads, including
  windows/thresholds, the unsigned-flow caveat, the ATR method, and the advisory framing.
- **AC-26 (operator span, operator-only):** With observability enabled, a cold bundle build shows
  the pack's compute stage in the `/_ops/metrics` readout; nothing pack-related renders on any
  trader route.

## 7. Product constraints the next roles must NOT violate

- **`additive-keeps-score-byte-identical` (HARD):** advisory context/display only; never a
  scoring/gate/tier/fingerprint input (AC-22 is the proof surface).
- **`best-effort-isolated-or-null`:** every level of null is its own honest unavailable state;
  never an HTTP error, never a fabricated 0, never a blanked page (AC-12–AC-18).
- **`live-vs-static-isolation`:** all four reads are STATIC family — excluded from live-offline
  dimming, nothing on SSE (AC-8–AC-11).
- **`digested-labels-not-raw-dump`:** small label set + ≤3 basis scalars each; no raw series ever
  reaches the user or the wire (AC-3).
- **`model-read-carries-its-assumptions`:** every surfaced read is self-describing (window /
  thresholds / basis / as-of visible or one affordance away) and framed advisory, never a
  guarantee (AC-4–AC-6).
- **Unsigned flow, honestly framed:** no side/aggressor/"smart money" language anywhere (AC-7).
- **ATR is context only:** no stop/target/distance/sizing UI this feature (AC-7).
- **No prompt-template change** (AC-21); **Default persona stays byte-identical**.
- **`theme-token-discipline`:** token-only, `extrasFor(theme)` for mode-aware values, dark/light
  parity part of done (AC-24).
- Untouched canon: `gamma-sourcing-split`, NBBO-mid anchor, max-pain/PCR full-chain, dark-pool
  rules, `no-real-order-path`, `server-side-gate-enforcement` (no auth gate on any of this —
  the pack is part of anonymous browsing).

## 8. Amendments bounced to Architect

**None.** The ARCHITECTURE_CONTRACT's shape supports every product outcome above without
narrowing: independent nullability at label/horizon/sub-component/read/pack level, in-payload
self-description (as-of, spot basis, flow basis, windows/thresholds), the export ride-along, and
the static-family declaration are all already provided. The accepted trade-off is recorded, not
bounced: no per-null reason codes in v1 (§4.3) — generic honest null copy is sufficient and
matches the four-positioning-tiles precedent.

## 9. Handoff to the UX/Tech-Writer (what you own next)

- The exact display-string mapping table for every enum (1:1, meaning-preserving — pin it in the
  FE contract), the assumptions/advisory line wording, null-state copy, tooltip copy, and the
  glossary entry text (§4.1/§4.3 intent binding).
- Final wire/field names + `@org/api` types (interface contract; content pinned in Architect §3;
  product vocabulary in §4.1 should inform naming).
- The widget's internal arrangement + expanded-view content within the §4.2 composition decision
  (one widget, after dealer-flow projection, headline labels visible without expanding).
- The FE test matrix: every AC in §6 → at least one named test case, with the degraded/edge ACs
  (AC-9, AC-10, AC-12–AC-18) as their own cases.
