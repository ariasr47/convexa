# ticker-load-experience — PRODUCT CONTRACT (GATE P·X)

> Product layer ONLY: user stories, scope, product behavior, acceptance criteria observable WITHOUT
> reading code. Stands alone against `PROJECT_CONTEXT.md` (§5/§6/§7), `BRIEF.md` (incl. the MEASURED
> LATENCY block), and `ARCHITECTURE_CONTRACT.md` (the locked technical shape). NO code, NO math, NO
> endpoint signatures, NO payload/field names, NO UI layout/copy. Naming, copy, component inventory and
> layout are explicitly handed to UX/Interface; this contract fixes BEHAVIOR and the acceptance bar.
> Every AC is a required behavioral test (the standing FE-tests rule) and is QA-traced at GATE Q.

---

## 1. What this is, in one paragraph

The individual ticker page (`/ticker/:symbol`) should feel INSTANT to open and show a price the trader
fully trusts. This feature refines the EXISTING ticker viewer (it does not invent a new surface): it (1)
removes the single full-page spinner so page structure and every component paint immediately and fill as
their own data arrives, (2) makes the cold load genuinely faster — near-instant when the trader is
already watching the ticker (a live session is open), and merely faster-but-honestly-skeletoned on a
first-ever cold visit — and (3) adds a truly-live "last traded price" readout next to the existing price
so the trader can reconcile against their broker, without ever changing what the page's headline price
and levels are anchored to. Everything here is ADDITIVE: the opportunity score, tier, gate, and the
state fingerprint are byte-identical before and after.

---

## 2. User stories

- **US-1 — Instant structure, no idle spinner.** As a trader opening a ticker page, I want to see the
  page's structure (its tiles, chart frame, sections) immediately rather than a blank page behind a
  single spinner, so I know what's coming and can orient while the data fills in.
- **US-2 — Independent fill.** As a trader, I want each part of the page to appear the moment ITS data
  is ready (the live price, the analytics bundle, the AI read each on their own clock) rather than the
  whole page waiting on the slowest piece, so a slow chain fetch never holds up the live price.
- **US-3 — Fast return visit / active session.** As a trader who is already watching a ticker (or
  returns to one I just looked at), I want the page to come up near-instantly instead of paying the full
  cold-load wait again, because the live data needed is already flowing.
- **US-4 — Honest first-visit wait.** As a trader opening a ticker I've never watched, I accept that the
  first load takes a few seconds, but I want to see the page's structure the whole time (never a frozen
  blank), so the wait feels like loading, not breakage.
- **US-5 — A price I can trust against my broker.** As a trader, I want to see a truly-live last-traded
  print alongside the page's anchor price, so I can reconcile what GammaFlow shows with the last trade my
  broker (e.g. Webull) shows — without the page lying to me when there's no recent print.
- **US-6 — Honest empty/degraded price states.** As a trader, when there's no recent print (between
  trades, overnight, before the first print) or the live feed drops, I want the last-trade readout to say
  so plainly rather than freeze a stale number into looking current.
- **US-7 — Nothing I rely on silently changes.** As a trader, I want my levels, walls, flip, max-pain,
  the opportunity score and everything I've come to read the same way to be exactly as before — the speed
  and the new readout must add to the page, never quietly alter a number I trade off.

---

## 3. Scope

### In scope (Full v1 — ships together)

1. **Skeleton-first load.** Remove the single full-page spinner that today gates the whole page on the
   analytics bundle. Page structure paints immediately; each component fills when its own data source
   resolves (the analytics bundle, the live stream, and the AI read each on their own clock — already
   independent today behind the one removed gate).
2. **Faster cold load via active-session reuse (pre-warm).** When the trader already has a live session
   open for a ticker, a cold page load reuses what that session already holds and comes up near-instant.
   This is a pure acceleration: when no session is active, behavior is unchanged.
3. **Accepted-slow first-ever cold visit.** A first-ever cold visit to an unwatched ticker (no live
   session yet) is EXPLICITLY accepted as still taking a few seconds — but skeletoned, never frozen. This
   is acceptable v1 behavior and is stated as such, not hidden.
4. **Overlapping vendor fetches.** The independent data fetches behind a cold load overlap rather than
   running one-after-another, shaving time off every cold miss. Observable only as a faster cold load.
5. **Request-coalescing (cold-start hardening).** When several loads of the SAME ticker/filter happen at
   once on a cold page, they share one underlying computation instead of each doing the full work. In
   scope as low-risk cold-start protection. Observable as: concurrent identical loads succeed and agree,
   with no degradation versus a single load.
6. **Live last-trade readout.** A truly-live, print-driven "last traded price" shown ALONGSIDE the
   existing anchor price. The anchor price remains the basis for the headline price, the levels (walls /
   flip / peak / max-pain), and the live flip — the last-trade is a READOUT added beside it, never the
   anchor. Honestly nullable (between prints / overnight / pre-first-print) and degrades with the live
   feed like the other live fields.
7. **Real-time-tier freshness behavior.** Under the real-time data tier, the "data is X old" staleness
   warning must stop firing spuriously mid-session — it should reflect genuine staleness only.

### Out of scope (non-goals — restated)

- **Gamma unification / consistent-flip.** Separate `gamma-unification` track (measure-first). This
  feature changes no gamma math source; walls and the flip keep their current, intentionally-distinct
  sources.
- **Any change to the scoring / gate / tier / fingerprint path.** Not one of those values is recomputed
  differently. (Enforced as an explicit invariant AC below.)
- **Any real order / broker path.** Nothing here touches orders, brokers, or real positions. The
  `[no-real-order-path]` invariant is untouched.
- **Any operator-vs-trader boundary change.** Operator/diagnostics stay where they are; the trader page
  gains no operator surface.
- **Overnight price coverage.** The vendor's overnight gap is orthogonal and untouched; the last-trade
  readout is honestly empty overnight, not back-filled.

### Future-dated (named, not scoped here)

- **Chain-fetch parallelization** — the largest theoretical speedup of the cold fetch itself is blocked
  by a current vendor limitation; deferred until the vendor capability exists. Not part of v1.
- **Engine compute speedup** — a secondary ~10% CPU win on the cold path; deferred as a non-required
  optional lever.
- **Any splitting of the analytics bundle into separate per-section fetches** — explicitly NOT done in
  v1 (it would multiply load on a cold cache); permanently gated behind the request-coalescing now being
  added before it could ever be revisited.

---

## 4. Product behavior

### 4.1 The four loading/connection states as the user experiences them (DISTINCT — never conflated)

These four are different on-screen experiences and MUST remain visually distinct. They map to the four
states the architecture locks; here they are described purely as what the trader sees.

- **A. Cold load (never loaded this ticker/filter yet).** The page paints its STRUCTURE immediately —
  the tiles, the chart frame, the sections are all present as placeholders with no data yet. Nothing is
  blank, nothing is an error, and there is no single full-page spinner. Each placeholder is replaced by
  real data the moment its source resolves. This "loading-structure" look is VISUALLY DISTINCT from both
  (i) a component that has loaded but has no data this cycle ("unavailable this cycle"), and (ii) the
  live-feed-dropped (offline) look. A trader can tell at a glance "this is still loading" versus "this
  loaded and there's nothing here" versus "the live feed dropped."

- **B. Refresh failed after a prior success (static bundle persists).** Once the page has data, a later
  failed refresh NEVER blanks what's on screen. The page keeps showing the last good data behind a soft,
  non-alarming "couldn't refresh, showing data from a moment ago" notice. (Existing behavior — preserved,
  not changed.)

- **C. Live feed dropped after load (offline-degrade).** Once the page has data, if the live stream
  drops, only the LIVE-derived readings dim and show an "offline / paused" treatment; the analytics,
  chart, and static reads keep showing the last good values, and a single connection notice tells the
  trader the live stream dropped and is reconnecting. The last-trade readout degrades HERE WITH the other
  live fields (it dims/pauses with them) — it does not stay falsely current. (Existing offline behavior —
  extended to cover the new readout.)

- **D. First-ever load errored (cold-start failure).** If the very first load fails with nothing yet on
  screen, the page shows a single clear error with a Retry. This is the ONLY blank/error screen.
  (Existing behavior — preserved.)

### 4.2 Speed as the user experiences it

- **Active-session / return visit (US-3):** opening or returning to a ticker the trader is already
  watching comes up observably FAST — effectively warm — because the live session's data is reused. The
  trader perceives near-instant data fill, not a multi-second wait.
- **First-ever cold visit (US-4):** opening a ticker with no active session is observably SLOWER (a few
  seconds) — but the whole time it shows skeleton STRUCTURE that fills in, never a frozen blank or a lone
  spinner. The honesty bar: a first cold visit must look like "loading," and a return/active-session
  visit must look meaningfully faster than that.

### 4.3 The last-trade readout vs the anchor price (as the user perceives it)

- The page continues to show its existing anchor price as the headline, and every level (walls, flip,
  peak, max-pain) continues to be measured against that anchor. NONE of that changes.
- A NEW, separate, truly-live last-traded-price readout appears ALONGSIDE the anchor. It updates on real
  prints, so it can differ slightly from the anchor — that difference is expected and benign (it is the
  same kind of difference a trader already sees between GammaFlow and their broker), and the trader can
  use it to reconcile against their broker's last-trade.
- The readout is clearly a SECONDARY readout, never mistakable for the headline/anchor. It must read as
  "here is the last actual print" beside "here is the price the levels are built on."
- **Honest empty state:** when there is no recent print (between trades, overnight, before the first
  print of a session), the readout shows a plain "no recent print" empty state — it NEVER shows a stale
  old number styled as if it were current.
- **Degrades like the other live fields:** on a live-feed drop the readout dims/pauses with the rest of
  the live readings (state C), rather than presenting a frozen value as live.

### 4.4 Honesty of the stale warning under the real-time tier

The existing "data is X old — levels may be unreliable" warning should fire only when the data is
genuinely stale. Under the real-time tier it must stop firing spuriously during an active session (the
prior behavior, where it nagged mid-session, is the bug being fixed). Outside covered hours it may still
honestly indicate age.

---

## 5. Acceptance criteria

> Each AC is observable WITHOUT reading code and is a required behavioral test (FE-tests rule); QA traces
> each to ≥1 named passing test at GATE Q. Degraded/edge variations are split out as their own ACs.
> Stable ids are load-bearing for AC↔test traceability — do not renumber.

### Skeleton-first load

- **AC-Skel-1** — On a cold load (a ticker/filter never loaded yet), the page paints its STRUCTURE
  (placeholders for the tiles, the chart frame, and each section) before any data has arrived, and there
  is NO single full-page spinner gating the whole page.
- **AC-Skel-2** — Each component/section fills independently from its own data source as that source
  resolves: the live readings appear when the live stream delivers, the analytics fill when the bundle
  resolves, and the AI read fills on its own — one slow source does NOT hold up a component whose source
  already resolved.
- **AC-Skel-3** — The cold-load "still loading" placeholder is VISUALLY DISTINCT from a component's
  resolved-but-empty "unavailable this cycle" state: a trader can tell "still loading" apart from "loaded,
  nothing here this cycle." (Edge of AC-Skel-1.)
- **AC-Skel-4** — The cold-load placeholder is VISUALLY DISTINCT from the live-feed-dropped (offline)
  treatment: "never loaded" looks different from "loaded then the live feed dropped." (Edge of AC-Skel-1;
  enforces the cold-load-≠-offline boundary.)
- **AC-Skel-5** — When a data source resolves to an empty/unavailable result (not loading, just nothing
  this cycle), that component shows its existing "unavailable this cycle" empty state and does NOT remain
  in a perpetual skeleton.

### Refresh-failure / offline / cold-start states (preserved — re-asserted against the new model)

- **AC-State-1** — After the page has loaded once, a failed background refresh does NOT blank the page:
  the last good data stays on screen behind a soft "couldn't refresh" notice.
- **AC-State-2** — After the page has loaded once, a live-feed drop dims/pauses ONLY the live-derived
  readings (with a single connection notice) while the analytics, chart, and static reads keep showing
  their last good values.
- **AC-State-3** — If the very FIRST load fails with nothing on screen, the page shows a single clear
  error with a Retry, and that is the ONLY blank/error screen (no skeleton left spinning, no other state
  blanks).

### Speed (return-visit vs first-ever cold)

- **AC-PreWarm-1** — Opening/returning to a ticker that already has an active live session is observably
  FAST (effectively warm): data fills in near-instantly rather than after a multi-second wait.
- **AC-PreWarm-2** — A first-ever cold visit to an unwatched ticker (no active session) is observably
  SLOWER than AC-PreWarm-1 but shows skeleton STRUCTURE the whole time (never a frozen blank, never a
  lone full-page spinner) — i.e. it looks like loading, not breakage. This slower-first-visit is accepted
  v1 behavior.
- **AC-PreWarm-3** — The active-session acceleration NEVER changes what the page shows: a pre-warmed load
  and a non-pre-warmed load of the same ticker/filter present the same data and the same levels/score
  (acceleration only — see AC-Invariant-1).

### Cold-start hardening (request-coalescing + concurrency)

- **AC-Coalesce-1** — Several simultaneous loads of the SAME ticker/filter all succeed and present
  mutually consistent data, with no observable degradation versus a single load (no error, no partial
  page from the contention).
- **AC-Concurrency-1** — The overlapping-fetch behavior is fully transparent to the trader: a cold load
  presents the same complete page as before, only sooner. No section is dropped or reordered by the
  fetches overlapping.

### Best-effort isolation (graceful degradation — never an error page)

- **AC-Isolation-1** — If the active-session acceleration cannot be used for any reason, the page still
  loads correctly via the normal path: there is NO error and NO visible difference beyond it simply being
  the normal (slower) cold load. (A pre-warm failure degrades gracefully, never an error page.)
- **AC-Isolation-2** — If one underlying data source fails on a cold load, only that component shows its
  "unavailable this cycle" state; the rest of the page loads normally. One source's failure does NOT
  blank the page or imply a problem with unrelated components.

### Live last-trade readout

- **AC-LastTrade-1** — During a covered, actively-trading session, a truly-live last-traded-price readout
  is shown ALONGSIDE the anchor price and updates on prints; its value matches a known recent print for
  the ticker (e.g. agrees with the trader's broker last-trade, within normal feed timing).
- **AC-LastTrade-2** — When there is no recent print (between trades, overnight, before the first print),
  the readout shows a plain "no recent print" empty state and NEVER displays a stale prior value styled as
  current.
- **AC-LastTrade-3** — On a live-feed drop, the last-trade readout dims/pauses together with the other
  live-derived readings (it does NOT remain falsely current); it recovers when the feed reconnects.
- **AC-LastTrade-4** — The last-trade readout is clearly SECONDARY to the anchor price and is never
  presentable as the headline price. A trader cannot mistake the readout for the anchor.
- **AC-LastTrade-5 (BINDING anchor boundary)** — The headline price, the levels (walls / flip / peak /
  max-pain), and the live flip remain anchored to the EXISTING anchor price and are observably unaffected
  by the last-trade readout: changing/clearing the last-trade value never moves a level, the headline, or
  the flip. The last-trade is display-only.

### Stale-warning honesty (real-time tier)

- **AC-Stale-1** — Under the real-time tier, during an actively-refreshing session, the "data is X old"
  staleness warning does NOT fire spuriously — it appears only when the data is genuinely stale.
- **AC-Stale-2** — Outside covered hours (or when data is genuinely old), the staleness warning still
  honestly indicates the data's age — the fix narrows false positives, it does not silence real
  staleness.

### Binding invariants (additive guarantees — explicit ACs)

- **AC-Invariant-1 (byte-identical score path)** — The opportunity score, opportunity tier, entry gate,
  and the state fingerprint are BYTE-IDENTICAL before vs after this feature for the same inputs: none of
  skeletoning, the active-session acceleration, the overlapping fetches, the coalescing, the last-trade
  readout, or the freshness-config change alters any of them. (Observable by comparing those values for an
  identical request with the feature off vs on — they must match exactly.)
- **AC-Invariant-2 (best-effort isolation)** — No part of this feature can turn a load into an error page:
  an acceleration failure, a single fetch failure, or a missing print each degrades gracefully (normal
  load / "unavailable this cycle" / "no recent print" respectively), never a crash or blank error beyond
  the existing first-load-failed screen.
- **AC-Invariant-3 (live-vs-static isolation)** — The last-trade readout is treated as LIVE-derived (it
  degrades with the live-feed drop), while the analytics, chart, and static reads remain static (they keep
  rendering the last good bundle on a live-feed drop). The cold-load state is distinct from the
  offline-degrade state (re: AC-Skel-4). The two classes are never conflated.

---

## 6. Product decisions made here

These resolve the Architect's "open questions for the PM" (§11) at the product level, per the owner's
locked scope decision (2026-06-25). Naming/copy/layout/observability specifics are handed downstream as
noted.

1. **Scope = Full v1.** Both the active-session acceleration AND the overlapping fetches ship in v1 (§11
   Q1). They are complementary: acceleration covers return/active-session visits; overlapping fetches help
   every cold miss.
2. **First-ever cold visit is accepted slow-but-skeletoned** (§11 Q1). It is NOT a failure to fix in v1;
   it is acceptable, honestly-skeletoned behavior (AC-PreWarm-2). Do NOT silently narrow this — if a future
   need requires a fast first-ever cold visit, that is a new feature (it depends on the deferred
   chain-fetch parallelization), not a regression of this contract.
3. **Request-coalescing is IN scope** as cold-start hardening (§11 Q2), per the owner. It is the standing
   prerequisite that keeps any future bundle-splitting from ever multiplying cold-cache load.
4. **The last-trade readout is added; the anchor is NOT moved** (the locked `live-spot=NBBO-mid`
   carve-out). It is a display-only, live-derived, honestly-nullable sibling of the anchor (AC-LastTrade-*,
   AC-Invariant-3). **Binding restatement for downstream + future features:** `OPEN_THREADS §9` currently
   reads "Keep mid; do not add last-trade." This feature is the deliberate, owner-sourced narrowing of
   that line to: "the anchor stays the anchor for the headline, levels, and flip; a last-trade readout MAY
   be added beside it, display-only." Any future feature that lets the last-trade drive the
   anchor/levels/flip is a GATE-Z reversal, not an extension. (THREADS §9 should be updated to reflect this
   narrowing.)
5. **The stale-warning false-positive under the real-time tier is fixed** (§11 Q3). The product
   requirement: the warning must reflect genuine staleness only (AC-Stale-1/2). The exact threshold value
   and its relationship to the acceleration's freshness budget are a config/threshold call handed to
   the Architect/Interface; at the product level the bar is simply "it stops nagging mid-session on the
   real-time tier and still tells the truth about real staleness."
6. **Optional levers are DEFERRED, not scoped** (§11 Q6). Chain-fetch parallelization (vendor-blocked) and
   the engine compute speedup are named as Future, filed as deferred seams, and not required by v1.

### Handed to UX / Interface (PM frames the bar; downstream owns the specifics)

- **Last-trade naming, copy, and placement** (§11 Q4): the readout's label, its "no recent print" /
  overnight copy, and exactly how it sits relative to the anchor so a trader never mistakes it for the
  headline. Product bar fixed by AC-LastTrade-1..5; the words and layout are UX's.
- **Skeleton component inventory and the time-to-first-structure-paint bar** (§11 Q5): which components
  get individual placeholders and the precise "structure paints before any data" treatment. Product bar
  fixed by AC-Skel-1..5; the inventory and visual treatment are UX's.
- **Observability honesty for an accelerated load** (§11 Q7): whether/how an accelerated chain acquisition
  is distinguishable in the operator readout so the operator view stays truthful about where time went.
  This is an operator-surface/Interface detail (it touches no trader-facing AC here); flagged so it is not
  lost.

---

## 7. Product-level constraints the next role must NOT violate

- **Additive only.** Nothing here may change the opportunity score, tier, gate, or state fingerprint
  (AC-Invariant-1). If achieving a speed or last-trade outcome would require touching any of those, BOUNCE
  it back as an ARCHITECTURE_CONTRACT amendment — do not narrow scope silently.
- **The anchor stays the anchor.** The last-trade readout is display-only. The headline price, levels, and
  flip stay on the existing anchor (AC-LastTrade-5). This is a one-line owner carve-out, not license to
  re-anchor anything.
- **No new error surfaces.** The only blank/error screen is the existing first-load-failed screen
  (AC-State-3). Every other failure degrades in place (AC-Invariant-2).
- **The four loading/connection states stay distinct.** Cold-load, refresh-failed-after-success,
  live-feed-dropped, and first-load-failed are different on-screen experiences and must never be
  conflated (AC-Skel-3/4, AC-Invariant-3).
- **Honesty over optimism.** A first-ever cold visit must LOOK like loading, not be hidden; an empty
  last-trade must say "no recent print," never freeze a stale number; a stale warning must still tell the
  truth about genuine staleness.
- **No bundle-splitting in v1.** The analytics bundle is loaded as one unit (skeleton over it, not split);
  any future split is gated behind the coalescing being added now.

---

## 8. Compressor #2 — 5-bullet summary (for UX/Tech-Writer)

- **Refine the existing ticker page on three additive axes:** instant skeleton structure (kill the
  full-page spinner), a genuinely faster cold load (near-instant on an active session; accepted
  slow-but-skeletoned on a first-ever cold visit), and a live last-trade readout beside the anchor price.
- **Four distinct on-screen states UX must keep visually separate:** cold-load skeleton, refresh-failed
  (keep last data + soft notice), live-feed-dropped (dim only live fields), first-load-failed (the only
  error screen). Skeleton ≠ "unavailable this cycle" ≠ offline.
- **Last-trade is a display-only, live-derived, honestly-nullable SIBLING of the anchor** — never the
  headline/levels/flip anchor (AC-LastTrade-5, the locked carve-out). UX owns its name, "no recent print"
  copy, and placement so it can't be mistaken for the anchor.
- **Everything is byte-identical on the score/tier/gate/fingerprint path and best-effort isolated** —
  no failure produces a new error page; the only error screen is the existing first-load-failed one.
- **UX owns the skeleton component inventory + the structure-paints-first bar + all last-trade copy;**
  Interface owns the freshness-threshold config and the operator-readout honesty for an accelerated load.
  AC ids (AC-Skel-*, AC-State-*, AC-PreWarm-*, AC-Coalesce-1, AC-Concurrency-1, AC-Isolation-*,
  AC-LastTrade-*, AC-Stale-*, AC-Invariant-*) are the test-traceability anchors for the "Tests to write"
  matrix.
