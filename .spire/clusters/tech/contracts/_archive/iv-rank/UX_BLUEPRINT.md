# iv-rank — UX_BLUEPRINT

> GATE U·X deliverable. UX + tech-writing layer ONLY: component states, where each datum surfaces,
> the exact user-facing copy (honoring the locked product framing), tooltip/glossary text, and the
> exact degraded-state wording. Maps each AC to the component state(s) that satisfy it — **that
> mapping IS the required-tests matrix.** No server internals, no math, no final endpoint/payload
> decisions beyond naming the fields the UI consumes.
>
> Binds to the LOCKED product face: `.spire/clusters/tech/contracts/iv-rank/PRODUCT_CONTRACT.md` (D1–D8, the
> three-state model, the ACs) and the technical shape at
> `.spire/clusters/tech/contracts/iv-rank/ARCHITECTURE_CONTRACT.md` (CM30 basis, 252-window, after-scoring attach,
> the §3.2 nested read). Does NOT re-scope product or invent behavior.
>
> Closest shipped precedents (voice, null copy, advisory footer, static-family shell, token
> discipline): the **"Market context"** widget (`MarketContext.tsx`) and the **"Projected dealer
> flow"** widget (`DealerFlowProjection.tsx`), both under `apps/dashboard/src/app/ticker/widgets/`.

---

## 1. Where iv-rank lives (surfaces, family, placement)

- **Surface A — the Ticker page widget.** A single **STATIC-family read** widget titled **"IV rank"**,
  in the same family as `DealerFlowProjection` and `MarketContext` (D5). It is a `Widget`-shell
  widget with the shared static-frame subtitle, an ⓘ info affordance, a body, and one widget-level
  advisory footer — structurally the `DealerFlowProjection` widget (a small single-object read),
  not the four-sub-card `MarketContext` grid.
- **Placement.** In the bento board, in the static context-read family, **directly after
  `MarketContext`** (which sits after `DealerFlowProjection`). Rationale: iv-rank is the newest member
  of the same "what's the context here" family and reads naturally after the market-context block; it
  must sit before the live-derived tiles' neighbors are disturbed only by the +1 `revealIndex` shift
  the executioner applies to the sections below it. (UX judgment left open by the product contract;
  see §8.)
- **Surface B — the AI export.** No new UI. The read rides `market_state` and the AI state exporter
  forwards `market_state` wholesale — the AI sees whatever state the read is in automatically (AC-2).
  This surface has NO component; it is verified at the interface + backend layer.
- **NOT a live tile.** iv-rank takes **no** `offline`/`isLive`/`streamOffline` prop, reads neither the
  SSE stream nor the payload-gap watchdog, and carries **no** `⏸ offline` chip — same static-isolation
  posture as `MarketContext`/`DealerFlowProjection` (`live-vs-static-isolation`, AC-17).

The widget consumes exactly one field: **`market_state.iv_rank`** (see INTERFACE_CONTRACT for the
shape/name/presence). It never fetches, never derives a band from a raw number, never renders a
descriptor string it received on the wire — it has its own pinned copy.

---

## 2. Component states (the complete observable set)

The widget renders exactly **four mutually-exclusive body states** off the single `iv_rank` object.
These map 1:1 to the product's three states plus the degenerate-flat sub-case (§4 of the product
contract). No fifth state exists; no fabricated midpoint rank ever renders.

| State | Trigger (what the FE observes on the wire) | Body renders |
|---|---|---|
| **Default / Computed** | `iv_rank != null` AND its `state` is the computed marker AND `iv_rank.rank != null` | headline Rank + descriptor, secondary Percentile, one band token, the envelope (window sessions · sample count · basis), the advisory footer |
| **Computed · degenerate-flat** | `iv_rank != null`, computed marker, but `iv_rank.rank == null` with the flat reason | the flat note in place of the rank; Percentile + envelope still render; **no band token**; advisory footer present |
| **Building history** | `iv_rank != null` AND its `state` is the building marker | the "Building history — N of {N_min} sessions" message; **no rank, no percentile, no band**; the basis/framing envelope still renders; advisory footer present |
| **Unavailable this cycle** | `iv_rank == null` (whole field null, or the key absent on a pre-feature payload → read as null) | ONE muted "IV rank unavailable this cycle." line; no sub-content, no advisory footer (nothing to frame) |

**State discrimination is wire-driven, never FE-guessed.** The FE reads the presence/shape the
interface declares (an explicit `state` discriminant + nullable `rank`), and maps to the body state
via a closed lookup. It never re-derives the band, the state, or a rank from a scalar. An unknown
`state` value degrades to the **Unavailable** body (fail-honest), never a broken render.

There is **no `loading` / `stale` / `offline` / `empty` widget-local state:**
- **Loading** is owned by the page's existing skeleton-first load (the widget simply isn't mounted
  until the first bundle lands, exactly like `MarketContext`). The widget itself has no spinner.
- **Stale** shares the page's existing soft "Couldn't refresh" treatment — no per-widget stale badge.
- **Offline** does NOT apply (static family; see AC-17). The widget stays visible + un-dimmed on an
  SSE drop; it has no offline branch.
- **Empty** is the **Unavailable** body (the honest null-state line), not a separate blank.

---

## 3. Where each datum surfaces (the read's anatomy, Computed state)

Every datum below comes from the `iv_rank` object (interface names in the INTERFACE_CONTRACT). The
FE renders the numbers; it renders its own pinned copy for every label/descriptor — **never** a
descriptor string received on the wire (those exist only so the AI export is self-describing).

- **Headline — IV Rank (D4).** The 0–100 rank number, prominent (the eye keys off this). Beside it a
  plain-language descriptor of what it means (pinned FE copy, §4). In degenerate-flat, this slot is
  replaced by the flat note.
- **Secondary — IV Percentile (D4).** The 0–100 percentile number, smaller, the outlier-robust
  companion. Present in Computed AND in degenerate-flat (a flat window still has a defined percentile,
  D8b).
- **Band token (D2).** ONE small digested label — `premium rich` · `neutral` · `premium cheap` —
  derived by the backend from the Rank and delivered as a closed enum on the wire; the FE displays it
  via a closed lookup, **never** re-derived from the rank number FE-side. Shown ONLY in Computed with
  a defined rank; **never** in Building, Unavailable, or degenerate-flat.
- **The envelope (always beside the numbers — `model-read-carries-its-assumptions`, AC-18).** One or
  two visible lines conveying, in plain terms:
  - the **window used** — "N of the last {window} sessions" (sessions the rank/percentile were
    computed over);
  - the **total accumulated sample count**;
  - the **IV basis** — a constant-maturity ~30-day read, or, on a fallback day, an honest note that
    this day's sample used the nearest available tenor at its actual DTE (AC-19).
- **Advisory footer (Computed + Building — AC-8).** The verbatim advisory framing line (§4).

**No raw series anywhere (`digested-labels-not-raw-dump`, AC-9).** No list/table/array of daily IV
values, no chart of the history, no sparkline. Only the derived numbers, the band token, and the
envelope. The widget's expanded/peek overlay (if the bento shell offers it) shows this same body
larger — never a series.

---

## 4. Copy (canonical, pinned FE strings)

Product owns the words (PRODUCT_CONTRACT D1); UX finalizes the basis-line phrasing within the fixed
facts and owns visual treatment. These are the exact strings the FRONTEND contract pins as named copy
constants (mirroring `./copy` for MarketContext). `{N}`, `{N_min}`, `{window}`, `{count}`,
`{sessions}`, `{rank}`, `{pct}`, `{dte}` are runtime substitutions.

**Widget chrome**
- **Title:** `IV rank`
- **Subtitle / one-liner:** `Where today's IV sits in this ticker's own recent history — is option premium rich or cheap? Context the AI also reads · snapshot, never live.`
- **Widget ⓘ info (glossary):** `IV rank places today's implied volatility inside this ticker's own accumulated recent history — 0 = the window's lowest IV, 100 = its highest. High = option premium is relatively rich; low = relatively cheap. Advisory context only; never a scored signal.`

**Computed state**
- **Headline label:** `IV rank`
- **Headline descriptor (pinned, plain-language, AC-4):** `Today's IV sits at the {rank}th position of its {window}-session low-to-high range.` (Rendered beside/under the headline number. UX may split the number and descriptor across two lines.)
- **Secondary label:** `IV percentile`
- **Secondary descriptor (pinned, AC-5):** `{pct}% of sessions in the window had lower IV than today.`
- **Band tokens (D2, one of):** `premium rich` · `neutral` · `premium cheap`
- **Basis line (the self-describing envelope, AC-7 / AC-19):**
  - clean CM30 day: `Over {sessions} of the last {window} sessions · {count} samples · ~30-day constant-maturity IV.`
  - fallback day: `Over {sessions} of the last {window} sessions · {count} samples · nearest-tenor IV (~{dte}d) — clean 30-day basis unavailable this day.`
- **Advisory footer (verbatim, AC-8):** `Advisory context for you and the AI — not a forecast, not a scored signal, not a guarantee.`

**Computed · degenerate-flat (AC-13)**
- **In place of the rank number/descriptor:** `Rank not meaningful yet — IV has been flat across the window.`
- (Percentile, basis line, and advisory footer still render exactly as in Computed. NO band token.)

**Building-history state (AC-10, AC-11)**
- **Message:** `Building history — {N} of {N_min} sessions. IV rank appears once enough daily samples accumulate.`
- (No rank, no percentile, no band. The basis line and advisory footer still render so the reason is
  legible; the basis line in this state carries only the framing that exists — the count is in the
  message itself. If the basis of accumulated samples is known, the basis descriptor may render; if
  not, only the message + advisory footer show. This is the honest early state, not a defect.)

**Unavailable-this-cycle state (AC-14)**
- **The ONLY line:** `IV rank unavailable this cycle.` (Muted `text.disabled`, the app's established
  null-state voice — identical treatment to `MC_WHOLE_EMPTY` / `DFP_WHOLE_EMPTY`. No advisory footer.)

**Tooltips / glossary (ⓘ affordances)**
- **Rank ⓘ:** `IV rank = today's IV positioned between the window's lowest and highest IV (0–100). Sensitive to a single extreme day.`
- **Percentile ⓘ:** `IV percentile = the share of sessions in the window with lower IV than today (0–100). More robust to a single outlier day than the rank.`
- **Band ⓘ:** `Rich (rank ≥ 70) leans toward selling premium / defined-risk credit; cheap (rank < 30) leans toward buying premium / long options; 30–70 is neutral. A descriptive read of the number, not a signal.`
- **Basis ⓘ:** `The IV sampled is a constant-maturity ~30-day read interpolated from the term structure. On days the clean 30-day basis isn't available, the nearest tenor is used and shown here honestly.`
- **Building ⓘ:** `This ticker builds one IV sample per day it's viewed. Until {N_min} accumulate, there isn't enough history for a trustworthy rank.`

Voice guardrails (honesty posture, `additive-keeps-score-byte-identical`): NO copy/color/placement
may imply the read feeds the score/gate/tier/setup. NO buy/sell imperative beyond the band's
lean-toward framing already fixed by D2; no "smart money," no stop/target/sizing/distance language.
The band's `premium rich`/`cheap` tokens and their tooltip lean-framing are the ONLY permitted
directional language, and they inherit the advisory frame.

---

## 5. AC → component-state map — THIS IS THE REQUIRED-TESTS MATRIX

Each row is one AC × the component state(s) that satisfy it × the edge/invariant it pins. The FRONTEND
contract's "Tests to write" note enumerates these verbatim so the FE *implements* the set and never
*chooses* it. `[BE]`/`[IF]` mark ACs whose home is the backend or interface layer (not a FE widget
test) — noted here for completeness of the mapping.

| AC | Home | Component state(s) | Required assertion |
|---|---|---|---|
| **AC-1** | FE | Default/Computed | The widget renders in the static family (`widget-iv-rank` shell + `iv-rank` body testid) alongside the other context reads. |
| **AC-2** | [BE]/[IF] | — (AI export) | The `iv_rank` field rides `market_state` in the wholesale AI export; not a FE widget test. |
| **AC-3** | FE | all states | The widget renders with NO auth/session/gate wiring — anonymous-visible; no gate call in the source (source-scan negative). |
| **AC-4** | FE | Default/Computed | Headline Rank 0–100 + the pinned plain-language descriptor both render. |
| **AC-5** | FE | Default/Computed + degenerate-flat | Secondary Percentile 0–100 + its descriptor render. |
| **AC-6** | FE | Default/Computed | Exactly ONE band token renders, from the closed set, matching the wire enum for the given rank (70/30 consistency verified via fixtures at rank 82→rich, 50→neutral, 18→cheap). |
| **AC-7** | FE | Default/Computed | The basis line renders window sessions + accumulated sample count + IV basis, all visible without interaction. |
| **AC-8** | FE | Default/Computed + Building | The verbatim advisory footer renders. |
| **AC-9** | FE | Default/Computed (+ source-scan) | NO series/list/table/chart of daily IV renders in any state; source carries no chart/series import for the history. |
| **AC-10** | FE | Building history | "Building history — {N} of {N_min} sessions" renders with the actual N from the wire. |
| **AC-11** | FE | Building history | NO rank number and NO percentile number render (not even a placeholder value). |
| **AC-12** | FE | Building vs Unavailable (contrast) | The Building body and the Unavailable body are textually distinct (different copy constants; a test renders both and asserts they differ). |
| **AC-13** | FE | Computed · degenerate-flat | With `rank == null`+flat reason: the flat note renders in the rank slot, NO "50"/any number in the rank slot, NO band token; Percentile + basis line still render. |
| **AC-14** | FE | Unavailable this cycle | Whole-null (and key-absent) → the single muted "IV rank unavailable this cycle." line; no error text, no blank, no advisory footer. |
| **AC-15** | FE | Unavailable (isolation) | A null `iv_rank` renders the muted line while sibling widgets in the same render tree still render (a null never blanks/errors the board). |
| **AC-16** | [BE] | — (score byte-identity) | Verified by the backend byte-identity proof (flag off/on); not a FE widget test. |
| **AC-17** | FE | all states (static isolation) | The widget takes NO live/offline prop, carries NO `⏸ offline` chip in any state; a stream-drop scenario leaves it un-dimmed (flow test) — contrast a dimming live tile; source-scan asserts no `streamTicker`/`EventSource`/`streamOffline`/`isLive`/watchdog reference. |
| **AC-18** | FE | Default/Computed + degenerate-flat | The rank number NEVER renders without the basis line + advisory framing in the same body (no state renders a bare number alone). |
| **AC-19** | FE | Default/Computed (fallback fixture) | With `iv_basis == nearest_tenor`, the basis line renders the fallback wording incl. the actual DTE — distinct from the clean-CM30 wording. |
| **theme** | FE | Default + Unavailable, dark+light | Renders under BOTH `theme` and `lightTheme`; the component source carries ZERO hardcoded hex (source-scan via `?raw`). |

Fixture anatomy the FE pins (so display strings are deterministic): rank `82` / percentile `74` /
window `252` / sessions `130` / count `130` / basis `interpolated_30d` for the Default fixture; a
`nearest_tenor` + `basis_dte 23` variant for AC-19; `rank: null` + flat reason for AC-13; a
`building` fixture with `N: 12`, `N_min: 20`; and `null` for AC-14/AC-15.

---

## 6. Degraded-state wording — the exact strings (single source)

Restated together for QA precision (these are the load-bearing strings; the FRONTEND contract pins
them as named constants):

- **Unavailable:** `IV rank unavailable this cycle.`
- **Building:** `Building history — {N} of {N_min} sessions. IV rank appears once enough daily samples accumulate.`
- **Degenerate-flat (rank slot):** `Rank not meaningful yet — IV has been flat across the window.`
- **Fallback basis:** `Over {sessions} of the last {window} sessions · {count} samples · nearest-tenor IV (~{dte}d) — clean 30-day basis unavailable this day.`

---

## 7. Binding invariants carried into the split (UX-observable)

- `live-vs-static-isolation` — STATIC; no offline prop, no `⏸` chip, un-dimmed on SSE drop. (AC-17.)
- `model-read-carries-its-assumptions` — never a bare number; window + count + basis + advisory
  always beside it. (AC-7, AC-8, AC-18, AC-19.)
- `digested-labels-not-raw-dump` — one band token; no raw IV series anywhere. (AC-6, AC-9.)
- `additive-keeps-score-byte-identical` — display/context only; honesty-posture voice guardrails
  (§4). (AC-16 is the BE proof.)
- `best-effort-isolated-or-null` — the four-state model incl. the honest Unavailable line; a null
  never breaks the board. (AC-12, AC-14, AC-15.)
- `theme-token-discipline` — token-only, dark/light parity, zero hardcoded hex. (theme row.)
- No auth gate — anonymous-visible. (AC-3.)

---

## 8. UX/interface judgments the product contract left open (flagged)

1. **Exact bento placement** — product fixed only the *family* (static context reads) and that iv-rank
   is not a live tile / not on the score surfaces (D5). UX chose **directly after `MarketContext`**
   (newest member of the same family, reads after the market-context block). Executioner applies the
   `revealIndex` cascade shift to sections below it, exactly as `MarketContext`/`DealerFlowProjection`
   did.
2. **Basis-line phrasing** — product fixed the FACTS that must appear (window, sample count, basis +
   the fallback honesty); UX finalized the exact wording in §4 (clean vs fallback variants).
3. **Widget shell choice** — UX chose the small single-object `DealerFlowProjection`-style shell
   (headline + secondary + band + envelope + one footer) over the four-sub-card `MarketContext` grid,
   because iv-rank is one read, not four. The bento `span` is a UX pick (recommend `span={1}` — it is
   a compact single read; the executioner may widen to `span={2}` if the envelope wraps awkwardly).
4. **Building-state basis rendering** — product requires the framing legible in Building; UX chose to
   always render the advisory footer + (when known) the basis descriptor, with the count carried in
   the message itself. No rank/percentile ever shows in this state.
