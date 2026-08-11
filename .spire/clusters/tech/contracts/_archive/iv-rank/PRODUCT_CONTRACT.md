# iv-rank — PRODUCT_CONTRACT

> GATE P·X deliverable. Product layer ONLY: user stories, scope, product behavior per state,
> acceptance criteria observable WITHOUT reading code, product decisions, and the binding invariants
> restated as product-observable rules. NO code, no formulas, no endpoints, no wire field names, no
> React, no pixel layout (those are UX/Interface at GATE U·X and Backend/Frontend downstream).
>
> Consumes the locked technical shape at `.claude/contracts/iv-rank/ARCHITECTURE_CONTRACT.md` — the
> CM30 basis, write-through accumulation, the new persistent market-data store, the 252-session
> window, and the rank/percentile math are SET and NOT reopened here. This contract decides the
> product face: the words, the bands, the floor, the headline, the placement intent, and the honesty
> rules a trader/QA can verify by looking at the running feature.

---

## 1. What this is, in one paragraph

Convexa currently tells the trader *what* implied volatility is (`atm_iv`, `iv_skew`, term structure)
but never *whether that IV is high or low for this ticker*. **IV Rank** answers the "rich or cheap?"
question — the single most-requested options context the app lacks — by placing today's IV inside the
ticker's own recent history. Because the vendor sells no IV history, Convexa builds its own, one
sample per ticker per day, and honestly says **"still building history"** until it has enough days to
say anything trustworthy. It is advisory context for the trader and for the in-app AI — it is **never**
part of the opportunity score, and it never claims to predict anything.

---

## 2. User stories

- **US-1 (Trader — strategy selection).** As an options trader deciding *how* to express a view on a
  ticker, I want to see whether the ticker's current IV is rich or cheap versus its own recent
  history, so I can lean toward selling premium (defined-risk / credit) when IV is rich or buying
  premium (long options / debit) when IV is cheap — the actual decision this feature exists to inform.

- **US-2 (Trader — trust the number).** As a trader, I want the IV-rank read to always show *how much
  history it's built on* and *what IV it measured*, so I never mistake a rank computed off three weeks
  of data for a mature 52-week read, and I know it's context — not a forecast or a scored signal.

- **US-3 (Trader — honest early state).** As a trader looking at a ticker that hasn't accumulated
  enough history yet, I want an honest "building history — N of the required minimum sessions" message
  instead of a fabricated or misleadingly precise number, so I trust the app's other reads too.

- **US-4 (Downstream AI — richer input).** As the in-app AI producing an entry recommendation, I want
  the IV-rank read included in the state I'm handed automatically, so my rationale can cite it (e.g.
  "IV rank high — premium rich, prefer defined-risk credit over long options") the same way it already
  cites dealer-flow and market-context reads.

- **US-5 (Trader — resilience).** As a trader whose live price stream just dropped, I want the IV-rank
  read to stay visible and un-dimmed (it's a once-a-day read, not a live tile), and if the read itself
  can't be produced this cycle, I want an honest "unavailable this cycle" state — never an error page
  or a broken widget.

---

## 3. Scope

### In scope
- A single **IV-rank read** attached to the ticker's data bundle, surfaced in two places: (a) fed to
  the in-app AI as context automatically, and (b) rendered as a static-family read on the Ticker page.
- The three product states the trader can observe: **Computed**, **Building history**, **Unavailable**.
- The **headline number** (see D4), the **secondary number**, and a small **digested rich/cheap band
  label** (see D2).
- The always-present **self-describing envelope**: the history window (sessions used), the accumulated
  sample count, the IV basis, and the advisory framing — shown beside the number, never separable.
- **Organic accumulation** — a ticker builds history only on the days it is actually viewed (D6).
- Honest **product copy** for all three states and the advisory disclaimer (D1).

### Out of scope
- Any change to the opportunity **score / tier / gate / fingerprint** — this read is never an input to
  them (HARD invariant). Turning the feature on or off leaves every score byte-identical.
- Showing the **raw daily IV history** series anywhere in the UI or to the AI — only derived numbers +
  descriptors + the digested band ever surface (`digested-labels-not-raw-dump`).
- Any **new vendor call**, VIX/index feed, or backfilled/synthetic history — the store starts empty
  and grows.
- **Alerts, notifications, or thresholds that trigger actions** off the IV rank — it is passive
  context, not a trigger.
- Encryption / masked-hint / credential handling — IV samples are non-secret market data.
- Exact pixel placement, widget chrome styling, wire field names, and endpoint shape — UX / Interface /
  Backend downstream own those.

### Future-dated (explicitly deferred, not this feature)
- A **curated warm-list** that pre-accumulates history for popular tickers regardless of views, so a
  rarely-viewed ticker isn't perpetually "building history" (D6 confirms organic-only for now).
- **IV Rank on a per-tenor or per-strategy basis** (e.g. rank of a 45-DTE IV, or of skew) — this
  feature ships one constant-maturity read per ticker.
- **A rank-history sparkline / trend of the rank itself over time** — a possible later enrichment;
  this feature surfaces only the current read.
- **Cross-ticker IV-rank comparison / a scanner column** — out until the scanner surface is built.

---

## 4. Product behavior — what the trader observes in each state

The read is **always present** as one of exactly three mutually-exclusive states (it is never simply
missing, and it never shows a raw error). In every non-null state the **self-describing envelope**
(window sessions, sample count, IV basis, advisory framing) is visible beside the content.

### State A — Computed (enough history exists and a current IV is available)
The trader sees:
- A **headline IV-rank number** (0–100) with a plain descriptor of what it means (position of today's
  IV within the history window's low-to-high range).
- A **secondary IV-percentile number** (0–100), the outlier-robust companion read.
- A **digested rich/cheap band label** (one small token — see D2), e.g. a "premium rich" / "neutral" /
  "premium cheap" read derived from the headline number.
- The **envelope, always beside the numbers**: how many sessions the window used, the total
  accumulated sample count, and the IV basis (a constant-maturity ~30-day read, or an honest fallback
  note when the clean basis wasn't available that day).
- The **advisory framing**: this is context for you and the AI — not a forecast, not a scored signal,
  not a guarantee.

Edge within Computed — **degenerate-flat window.** If the ticker's entire history window has been at a
single IV level (no spread between its low and high), the **rank number cannot be defined**. The read
shows an honest "rank not meaningful yet — IV has been flat across the window" note in place of the
rank number, while the percentile and the envelope still render. It never invents a "50."

### State B — Building history (some history exists, but below the minimum)
The trader sees an honest **"Building history — N of {minimum} sessions"** message with the current
count, and **no rank and no percentile number** (they are not shown at all — not greyed placeholders
implying a value). The envelope (basis, framing) still renders so the reason is legible. This is a
normal, expected state for a newly-viewed ticker, not a defect.

### State C — Unavailable this cycle (read cannot be produced)
When the read cannot be produced this cycle — the history store is unreachable, there is no usable
current IV this cycle, or the read otherwise faults — the trader sees a single muted **"IV rank
unavailable this cycle."** line, in the app's established null-state voice. Never an error page, never
a broken widget, never a stale number presented as current.

### Cross-cutting behavior
- **Stays visible on a live-stream drop.** IV rank is a once-daily static read; when the live price
  stream drops and the live tiles dim/show "offline," the IV-rank read keeps rendering its last value
  **un-dimmed** (it did not go stale because the stream dropped).
- **The AI sees it automatically.** Whatever state the read is in (Computed / Building / Unavailable),
  that same read is included in the context handed to the in-app AI — no separate toggle, no separate
  fetch.
- **The number never appears bare.** In no state does a rank number render without its window +
  sample count + basis + advisory framing beside it.

---

## 5. Acceptance criteria (observable WITHOUT reading code — the QA checklist)

Each AC is one observable behavior a trader or QA can verify on the running feature. Degraded/edge
variations are split out as their own ACs.

**Presence & the two surfaces**
- **AC-1.** On a ticker with enough accumulated history, the Ticker page shows an IV-rank read as a
  static-family read alongside the other context reads (the dealer-flow / market-context family).
- **AC-2.** The IV-rank read is included in the state exported to the in-app AI: an AI recommendation
  produced for a ticker with a computed rank can reference the rank in its rationale.
- **AC-3.** The IV-rank read is visible to an anonymous (logged-out) trader — it is context, not a
  gated action; signing in changes nothing about whether it appears.

**Computed state**
- **AC-4.** In the Computed state, a headline IV-rank number 0–100 is shown with a plain-language
  descriptor of what it means (today's IV's position within the history low-to-high range).
- **AC-5.** In the Computed state, the IV-percentile number 0–100 is also shown as the secondary read.
- **AC-6.** In the Computed state, a single small digested rich/cheap band label is shown (one of the
  three band tokens), consistent with the headline number and the band cut points in D2.
- **AC-7.** In the Computed state, the read shows the window it used (number of sessions), the total
  accumulated sample count, and the IV basis, all visible beside the numbers without any interaction.
- **AC-8.** In the Computed state, the read carries the advisory framing text ("not a forecast, not a
  scored signal, not a guarantee" in the app's voice) — verifiably present.
- **AC-9.** No raw daily IV history series is shown anywhere in the read (no list/table/array of daily
  IV values, no chart of the history) — only the derived numbers, the band, and the envelope.

**Building-history state**
- **AC-10.** On a ticker with at least one but fewer than the minimum accumulated sessions, the read
  shows "Building history — N of {minimum} sessions" with the actual current count N.
- **AC-11.** In the Building-history state, NO rank number and NO percentile number is shown (not even
  a placeholder value implying a number exists).
- **AC-12.** The Building-history state is visually/textually distinguishable from the "unavailable
  this cycle" state — a trader can tell "not enough history yet" apart from "couldn't produce it."

**Degenerate & unavailable states**
- **AC-13.** When the history window has been entirely flat (no spread between its low and high), the
  rank number is NOT shown as a value; instead an honest "rank not meaningful yet" note appears, and it
  is never rendered as "50" (or any fabricated midpoint). The percentile and envelope still render.
- **AC-14.** When the read cannot be produced this cycle (store unavailable / no current IV / fault),
  the trader sees a single muted "IV rank unavailable this cycle." line — never an error page, never a
  broken/blank widget, never an HTTP error surfaced to the trader.
- **AC-15.** A failure of the IV-rank read (any state C cause) leaves the rest of the Ticker page —
  the GEX chart, every other tile, the score/tier — rendering normally; nothing else breaks.

**Isolation & honesty invariants (observable)**
- **AC-16.** Turning the IV-rank feature off vs on leaves the ticker's opportunity score and tier
  **identical** — the number and tier shown to the trader do not change. (The read is advisory-only,
  never a scoring input.)
- **AC-17.** When the live price stream drops (live tiles dim / show "offline"), the IV-rank read stays
  visible and **un-dimmed**, continuing to show its last computed value — it is not treated as a live
  tile.
- **AC-18.** No rank number ever appears without its window + sample count + basis + advisory framing
  beside it — there is no view/state where a bare "82" shows alone.
- **AC-19.** When a given day's IV basis fell back from the clean constant-maturity read to a nearest
  available basis, the read honestly reflects that in its basis descriptor rather than implying a
  cleaner series than exists. (Observable via the basis line differing on such a read.)

---

## 6. Product decisions made here

Resolving the Architect's seven deferred questions (ARCHITECTURE_CONTRACT §9), plus other product
judgments locked here. These are decisions, not options.

### D1 — Copy for the three states (the actual words; exact styling is UX)
Product owns the words; UX owns visual treatment. The words below are canonical and match the app's
established voice (cf. the shipped market-context / dealer-flow advisory + null copy).

- **Widget title:** `IV rank`
- **Widget subtitle / one-liner:** `Where today's IV sits in this ticker's own recent history — is
  option premium rich or cheap? Context the AI also reads · snapshot, never live.`
- **Advisory framing (always present in Computed & Building states):**
  `Advisory context for you and the AI — not a forecast, not a scored signal, not a guarantee.`
- **Basis line (self-describing envelope, Computed state):** a single visible line conveying, in plain
  terms: the window used ("N of the last {window} sessions"), the total accumulated sample count, and
  the IV basis — a constant-maturity ~30-day read, or, on a fallback day, an honest note that this
  day's sample used the nearest available tenor instead. (Exact phrasing to be finalized by UX/Tech-
  Writer within these facts; the FACTS that must appear are fixed here.)
- **Building-history message:** `Building history — {N} of {N_min} sessions. IV rank appears once
  enough daily samples accumulate.`
- **Degenerate-flat note (in place of the rank number):** `Rank not meaningful yet — IV has been flat
  across the window.`
- **Unavailable-this-cycle line:** `IV rank unavailable this cycle.`
- **Rich/cheap band tokens (see D2):** `premium rich` · `neutral` · `premium cheap`.

### D2 — Rich/cheap band: SURFACED, three bands, cut on the headline metric
**Decision: yes, surface a digested band label** — it is the single most-useful digestion for the
"rich or cheap?" decision, and the architecture explicitly permits a small digested band. It is a
**one-token label**, never a raw series.
- **Three bands**, cut on the **headline metric (IV Rank — see D4)**:
  - **IV Rank ≥ 70 → `premium rich`** (lean toward selling premium / defined-risk credit).
  - **IV Rank 30–70 (i.e. ≥ 30 and < 70) → `neutral`.**
  - **IV Rank < 30 → `premium cheap`** (lean toward buying premium / long options).
- Rationale for 70/30: these are the conventional IV-rank thresholds traders already use for the
  rich/cheap call; they keep the two actionable bands meaningful and the middle honestly non-committal.
- The band is **descriptive digestion of the shown number**, not a separate signal, and it inherits the
  same advisory framing. It is **not** shown in the Building-history or Unavailable states.
- The band is **never** rendered when the rank number itself is undefined (degenerate-flat) — no band
  off a missing rank.

### D3 — Minimum-sample floor `N_min` = 20; Rank and Percentile gate at the SAME floor
**Decision: `N_min = 20` sessions** (the architect's recommendation — roughly a trading month, the
smallest window where a rank/percentile isn't laughably noisy). Below 20 accumulated sessions the read
is the Building-history state.
- **Rank and Percentile gate at the same floor (20).** Decision: do **not** split the floors. A trader
  seeing a percentile but not a rank (or vice versa) on the same read is confusing and invites treating
  the earlier-appearing one as more trustworthy than it is; both are equally noisy below 20 sessions.
  One honest threshold, both numbers appear together, keeps the read legible and the trust model
  simple. This is a product judgment resolving the architect's "same floor vs split" question.

### D4 — Headline metric: IV Rank leads; IV Percentile is secondary
**Decision: IV Rank is the headline number; IV Percentile is the secondary read.**
- Rationale: "IV Rank" is the term traders and the AI already use for the rich/cheap call (the BRIEF's
  own decision-impact example says "IV rank 82 — premium rich"); it is the familiar range-position read
  that maps directly to the rich/cheap band (D2). Percentile is retained as the outlier-robust
  companion (a single freak IV day distorts Rank but not Percentile), shown beside it — but Rank is what
  the eye and the band key off.

### D5 — Placement / widget family: STATIC context-read family, with the other AI-context reads
**Decision (product intent; exact pixel placement is UX):** IV rank is a **static-family context read**
and belongs **with the other additive AI-context reads** on the Ticker page — the same family as the
dealer-flow-projection and market-context widgets (positioning/context, not the live tiles). Product
intent is that a trader scanning the "what's the context here" region finds IV rank alongside those
reads. UX decides the exact bento slot / ordering; product only fixes the *family* and that it is
**not** a live tile and **not** mixed into the score/setup surfaces.

### D6 — Ticker scope: organic-only accumulation is ACCEPTED; warm-list is Future
**Decision: organic-only accumulation is acceptable for this feature.** A ticker accumulates history
only on the UTC days it is actually served/viewed; a rarely-viewed ticker builds history slowly and
sits in "Building history" longer. This is acceptable and honest — the Building-history state truthfully
communicates it, and there is no misleading number in the meantime. A **curated warm-list** that
pre-accumulates popular tickers is recorded as a **Future** ask (§3 Future-dated), explicitly out of
scope here. Product accepts that early on, and for thinly-viewed tickers, most reads will be
Building-history — that is the honest cost of having no vendor history, not a defect.

### D7 — Disk-vs-memory honesty requirement: the state must be truthful either way
**Decision (product requirement, independent of the build-time adapter choice):** whichever default
store the Backend picks, the **Building-history / Computed distinction must always reflect the actual
accumulated sample count at read time** — the read must never claim more history than the store
currently holds.
- **Product preference: the on-disk (accumulation-surviving) default**, so that in dev and demo the
  store actually reaches the floor and a *real* Computed rank can be demonstrated. A pure-memory store
  that resets every restart would keep the feature perpetually in Building-history in dev, undermining
  the ability to show the feature working.
- **If** the Backend must fall back to a memory default (accumulation lost on restart), that is
  **acceptable only because the honesty requirement above still holds**: after a reset the read
  truthfully shows "Building history — N of 20" with the reduced count, never a stale or fabricated
  rank. The prototype tolerates the reset; it does **not** tolerate a dishonest count. Restated for QA:
  a store reset must never produce a rank number that isn't backed by the sessions currently in the
  store.

### D8 — Additional locked product judgments
- **D8a — Passive, no triggers.** IV rank never fires an alert, notification, or auto-action. It is
  read-only context. (Reinforces §3 Out-of-scope.)
- **D8b — Percentile is always shown when Rank is shown** (they share the Computed gate, D3) —
  **except** that when Rank is undefined (degenerate-flat, AC-13) the Percentile may still render on
  its own with the honest rank note; a flat window still has a defined percentile.
- **D8c — One read per ticker.** This feature surfaces a single constant-maturity IV-rank read per
  ticker; per-tenor / per-strategy ranks are Future (§3).

---

## 7. Binding invariants restated as product-observable rules

Each is the product face of a build invariant, phrased so QA can check it by observation. Traceability
to the ACs in §5 is noted.

- **Advisory, never scored** (`additive-keeps-score-byte-identical`, HARD): the IV rank never changes
  the ticker's opportunity score or tier. **Product face:** flipping the feature off/on leaves every
  score and tier identical — it's context and display only. *(AC-16.)*

- **Honest unavailable, never an error** (`best-effort-isolated-or-null`): an outage / no-IV cycle /
  read fault shows an honest "unavailable this cycle" line or the "building history" state — never an
  error page, never a broken widget, never a stale number as current, and never breaking the rest of
  the page. *(AC-12, AC-14, AC-15.)*

- **Stays put on a stream drop** (`live-vs-static-isolation`): IV rank is a once-daily static read; it
  stays visible and un-dimmed when the live price stream drops, unlike the live tiles. *(AC-17.)*

- **Never a bare number** (`model-read-carries-its-assumptions`, PROMOTED): the rank never appears
  without its window (sessions), sample count, IV basis, and advisory framing beside it; it is framed
  as context, not a forecast/guarantee/scored signal; and an honest count is shown before enough
  history exists. *(AC-7, AC-8, AC-10, AC-18, AC-19.)*

- **Digested band, never a raw dump** (`digested-labels-not-raw-dump`): any rich/cheap label is one
  small band token; the raw daily IV history is never shown to the trader or the AI. *(AC-6, AC-9.)*

- **Non-secret market data** (`secret-encrypted-at-rest` deliberately NOT engaged): IV samples are
  ordinary market values; nothing about this feature adds a masked-hint, encryption, or credential
  surface. *(No AC needed — it is an absence; QA verifies no such surface appears.)*

- **Anonymous-visible context** (no auth gate): the read is visible logged-out; it is not a gated,
  state-bearing, or cost-bearing action. *(AC-3.)*

---

## 8. Product-level constraints the next roles must not violate

- The **headline is Rank, secondary is Percentile, band cuts at 70/30 on Rank, floor is 20 sessions,
  Rank & Percentile share that floor** (D2–D4) — UX/Interface/Backend implement these; changing any of
  them is a product decision that comes back here (a PRODUCT_CONTRACT amendment).
- The **three-state model (Computed / Building-history / Unavailable) plus the degenerate-flat
  sub-case** is the complete observable state set — no fourth trader-facing state, no fabricated
  midpoint rank.
- The **self-describing envelope (window + sample count + basis + advisory framing) is inseparable from
  the number** — UX may style it but may not hide it behind interaction such that a bare number can
  appear alone.
- **No raw IV history reaches the UI or the AI export** — only derived numbers, the band, and the
  envelope.
- If a needed product outcome cannot be supported by the locked technical shape, that is **bounced back
  as an ARCHITECTURE_CONTRACT amendment** — not silently narrowed. (No such bounce was required here;
  all seven open questions were resolvable within the locked shape.)

---

## 9. Handoff note (for the UX/Tech-Writer, GATE U·X)

You own the exact visual treatment, the bento slot within the static context-read family (D5), the
precise phrasing of the basis line within the fixed facts (D1), and dark/light token parity
(`theme-token-discipline`). You do **not** change: the headline/secondary choice (D4), the band cuts
(D2), the floor (D3), the three-state model (§4), or the "never a bare number / never a raw series"
rules (§7). The shipped market-context and dealer-flow widgets are your closest precedents for voice,
null-state copy, and the advisory footer.
