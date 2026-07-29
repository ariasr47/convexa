# R1 — pm position: positions-legs

> Skill note: `product-management:write-spec` is not installed in this environment (no `Skill` tool
> exposed to this agent; no local `product-management` plugin found under the user or project skill
> paths). Written to the lane rules in `.claude/agents/delivery-pm.md` + `.claude/council/R1-position.md`
> instead. Flagging rather than silently skipping.

## Position

### 0. The one-sentence product framing

Today the app is a **single-option tracker wearing the word "portfolio."** After this feature it is a
**book of positions**, where a position is whatever the trader actually holds. That reframing — not the
list of supported strategies — is the product. Everything below follows from one rule:

> **The app must never refuse to hold something the trader holds.**

That rule is not a nicety. The next feature in this track is the Webull import. An importer that meets a
shape the app rejects does not degrade — it fails, and the whole broker track fails with it. So "which
structures does v1 support" is the wrong question, and answering it with an enumeration would repeat
today's mistake at a higher number.

---

### 1. Scope stand: representation is universal; **naming** and **risk numbers** are the tiered part

I am splitting what has been discussed as one question into three, because they have different costs and
therefore different answers.

**(a) Which leg sets can EXIST — answer: all of them. No tiers, no enumeration, v1.**
Any number of legs, each bought or sold, each either shares or an option, any strikes, any expirations,
any mix. Bought and sold, options and shares, same or different expiries. There is no "supported
structure list" gating what can be saved. A leg set the app has never seen is a normal, savable,
first-class position.

**(b) Which structures get a NAME in v1 — a deliberately conservative list.**
A wrong name is more expensive than no name: a trader who sees "Call debit spread" on something that is
actually a diagonal will size it wrong. And because the name is *derived from the legs and never stored*
(BRIEF, `digested-labels-not-raw-dump`), **adding a name later is free — no migration, no data change.**
That asymmetry is the whole argument: be generous with representation, stingy with names.

v1 named set:

| Named in v1 | Not named in v1 → shows as **Custom** |
|---|---|
| Shares (long / short) | Ratio spreads and backspreads (1×2, 2×3, …) |
| Long call · Long put | Call butterfly / put butterfly (non-iron) |
| Short call · Short put | Non-iron condors |
| Call debit · call credit · put debit · put credit spread | Boxes, jade lizards, and every other exotic |
| Covered call · Cash-secured put | Anything with >4 legs that isn't a condor/butterfly |
| Protective put · Collar | Anything the classifier is not certain about |
| Straddle · Strangle (long and short) | |
| Iron condor · Iron butterfly | |
| Calendar · Diagonal *(named; risk figures withheld — see §2)* | |

**Explicit stands on the structures the dispatch named:**
- **Covered calls — IN and named.** A Webull account is full of them and both of their legs are already
  in v1 anyway (shares + short call). Being able to *hold* one while refusing to *name* it would be the
  worst of both.
- **Cash-secured puts — IN and named.** It is literally a short put; the "cash-secured" part is a
  trader's framing of the same leg. Naming it is a one-line labeling decision with real recognition value.
- **Calendars / diagonals — representable, named, and P/L-correct in v1; risk figures withheld.**
  The legs don't expire together, so a single at-expiration risk figure would be a lie. Named + net
  debit/credit + live P/L + a stated reason where max loss/gain/breakeven would go.
- **Iron condors / iron butterflies — IN, named, with full risk figures.** They are single-expiration
  and defined-risk; they are the archetype of "the app can't tell me what I risk."
- **Ratios and backspreads — representable and P/L-correct, but NOT named in v1.** They show as Custom.
  Naming a 1×2 while being unable to state its risk cleanly buys the trader nothing, and a mis-classified
  ratio is a genuinely dangerous label.

**(c) Which structures get RISK NUMBERS — §2.**

---

### 2. What a trader must see for a multi-leg position — and what waits

**Product-required in v1, in priority order:**

1. **The legs themselves**, visible in the portfolio list without opening a detail surface. A trader must
   be able to tell at a glance that this is two legs and roughly what they are. Today the row *is* the
   contract; if the row stops describing the position, the list stops being scannable.
2. **Net debit or credit at entry** — one figure, explicitly labeled *paid* or *received*. This is the
   number the trader typed and the number their broker showed them. Not surfacing it is indefensible.
3. **Net P/L across all legs**, with today's honest mark behavior preserved.
4. **Max loss.** This is the feature's stated reason for existing: *"a debit spread's real breakeven and
   max loss are currently uncomputable, so the app cannot tell the trader what they actually risk"*
   (BRIEF, Decision impact). Ship legs without max loss and you have shipped a data model, not a product.
5. **Breakeven** (one or two points, whatever the structure has).
6. **Max gain.** A credit spread with no max gain shown gets held to zero — the single most common
   unforced error in premium selling.

**Cut order if something must be cut** (this is a priority call, my lane, stated up front so R2 attacks
a position rather than a hedge): cut **max gain** first, then **breakeven**. **Max loss is not cuttable.**
A release that adds spreads without max loss should not ship.

**Honesty rules on those numbers (non-negotiable, all three):**
- Where the worst case is unbounded, the app shows **"Unlimited"** — never a number, never blank.
- Where the numbers don't apply (multi-expiration, Custom), the app shows a **short stated reason** in
  their place — never blank, never `0`, never `—` with no explanation. (`model-read-carries-its-assumptions`.)
- The figures carry their assumption **in view**: at expiration, held to expiration, excluding fees,
  excluding early assignment. They are not a promise.

**Deferred to Future (named, not built):** payoff diagram; net position greeks (delta/theta/vega);
probability of profit; days-to-breakeven; assignment / early-exercise warnings; per-leg partial close;
roll as a first-class multi-leg action; expiry auto-handling.

**Explicit v1 stand on closing:** **whole-position close only.** A trader cannot close one leg of a
four-leg position in v1. Per-leg close is a Future item. I am naming this because it is the deferral most
likely to bite, and I would rather it be attacked at R2 than discovered at GATE Q.

---

### 3. The unclassifiable position: **Custom is the default, not the failure state**

Stand: there is no such thing as a position the app cannot hold.

- An unrecognised leg set saves normally. **No error, no warning styling, no blocked confirm, no toast.**
- It displays as **"Custom"** with its leg count, in exactly the same visual register as every other
  structure name — neutral, unalarmed. Custom is a description, not a diagnosis.
- It shows its legs, its net debit/credit, and its net P/L like anything else. Only the at-expiration
  risk figures are withheld, with the reason stated.
- It sorts, filters, groups, and appears in the track record like anything else.

Rationale beyond politeness: the classifier is a **labeling convenience layered over a leg set that is
always valid.** If the classifier is instead a gate, then every future broker import is one unexpected
shape away from failing, and every classifier bug becomes a data-entry bug. Making Custom the graceful
default is what makes the classifier safe to be imperfect — which is what lets §1(b) stay conservative.

---

### 4. The merge, as a lived experience

This ships to a trader who may have an open ghost trade on the Ticker page *and* positions on the
Positions page. What they see the day it lands:

- **One book.** Their Ticker-page trade is now a position in the portfolio, alongside the others, with its
  entry, its history, and its decision records intact.
- **The Ticker page stops having its own competing concept.** Whatever position surface lives on the
  Ticker page reads the same book. A trader can no longer end up with two records of one trade.
- **Nothing is combined.** If the same contract existed in both places, they see **two positions, not
  one.** No averaging, no dedupe, no silent merge. This follows the already-shipped positions decision
  ("chose stack" over merge/average, OPEN_THREADS §7c) and, more importantly, silently combining two of
  a trader's records is a *data-changing* act performed without asking. Two honest rows beat one invented
  one. (Same-contract merge stays a named Future item.)
- **One short, dismissible, non-blocking notice** explaining what changed and pointing at export. Not a
  modal wall, not a wizard, not a migration screen with a progress bar. It appears **only** for a trader
  who actually had items in both places — a Positions-only trader is not told about a merge that did not
  happen to them.
- **Their saved views still work.** Including a view grouped by strategy: it now groups by structure, and
  their long calls are still grouped together. A saved view that silently stops applying reads as data loss
  even when nothing was lost.
- **Their track record does not move.** The outcome ledger already unions both stores; after unification it
  must report the **same hit rate, same N, same mean return** it reported the day before. A shift here is a
  bug, not an improvement — and it is the single most sensitive observable of a correct merge, because it
  reads the whole history at once.

**How a trader observes that nothing was lost** — this is the migration's acceptance surface, and it is
deliberately arithmetic, not vibes:
1. **Count:** items after = items in Positions before + items in the ghost trade before. Exactly.
2. **Identity:** every position keeps its ticker, quantity, entry price, entry time, and open/closed state.
3. **History:** the decision log after contains every entry from both logs, **once each** — no drops, no
   doubles.
4. **Stability:** reload five times; the count never changes and no duplicates appear.
5. **Continuity of numbers:** an existing single-option position's P/L reads identically before and after.
6. **Track record:** unchanged, per above.
7. **Corrupt input:** unreadable saved data produces an honest "we couldn't read your saved positions —
   nothing was deleted" state. **Never a silent empty portfolio presented as "you have no positions"** —
   that is the specific failure that would make a trader believe their history is gone when it isn't.

---

### 5. Scope

**IN (v1)**
- A position is a set of legs; any leg set is valid and savable.
- Bought **and sold** legs; **option and share** legs; mixed within one position.
- Net P/L correct across mixed leg types — shares are not valued like contracts.
- Structure name derived and displayed, with **Custom** as the graceful default.
- Net debit/credit at entry; max loss / max gain / breakeven for named single-expiration structures, with
  the three honesty rules.
- Multi-leg entry through the **one existing shared simulated entry dialog** as a variant — never a second
  dialog (`single-shared-sim-entry-dialog`, as narrowed).
- Single-option entry stays exactly as fast as today (no added steps for the common case).
- The two position systems become one book, read by both the Ticker and Positions pages.
- One unified decision history (resolves DECISION_QUEUE **Q2**).
- Grouping / filtering / sorting / saved views / closed-history continue to work over the new shape.
- A loss-free, no-click, one-pass migration carrying everything above.

**OUT (deliberately, this feature)**
- Any broker position, any Webull import, any real-position data source. *Why:* the model must exist
  before the importer is built against it — that is the entire sequencing rationale in the BRIEF.
- Any real-money entry or order path. Everything stays `SIMULATED` (`no-real-order-path`).
- Any backend change. Positions are client-local and are never a scoring input; the `apps/api` diff is
  empty (`additive-keeps-score-byte-identical`).
- Payoff diagram, net greeks, probability of profit.
- Per-leg close; roll as a first-class action.
- Same-contract merge/averaging.
- Teaching the **AI recommendation** path about multi-leg. Accepting a rec still creates a single-option
  position. *Why:* the AI produces single-contract entry recs today; multi-leg reasoning is a prompt +
  schema problem, not a position-model problem, and folding it in here doubles the blast radius of a
  migration that is already the risky part.
- Simulated **orders** filling into multi-leg positions. An order trigger still creates a single-option
  position in v1, same as today. *Why:* same reasoning; the order engine's trigger semantics are
  orthogonal and untouched. (If the architect finds this is nearly free, that is a good R2 conflict to
  raise — I would take it.)

**FUTURE (dated by trigger, not by wish)**
- **Webull import** — the immediately next feature in this track; this one exists to unblock it.
- **Live/broker positions** — still the locked placeholder tab; gated on the vendor/broker decision
  (OPEN_THREADS §1) and system-6.
- **Payoff diagram + net greeks + probability of profit** — after traders are actually holding multi-leg
  positions and we know which reads they reach for.
- **Per-leg close and roll** — first real trigger is a trader with a four-leg position wanting out of one side.
- **Multi-leg AI reassessment** — after the import lands, since that's when real spreads exist in volume.
- **Naming the currently-Custom shapes** (ratios, butterflies, non-iron condors) — free to add at any
  time, no migration, driven by what actually shows up as Custom.

---

### 6. Acceptance criteria

Every AC is observable without reading code. **Verification method is risk-based** (`qa-verify` §4): the
ACs marked **[R]** are visible/intentional behavior verified by review; the ones marked **[T]** are where
a silent regression is genuinely plausible and an automated test is warranted. I am not asking for
one-test-per-AC.

**A — Representation & entry**
- **AC-1 [R]** A trader can open a position made of two option legs — one bought, one sold, same
  expiration — and it appears as **one** row in the portfolio, not two.
- **AC-2 [R]** A trader can open a shares-only position with a quantity and an average price, and it
  appears as one row.
- **AC-3 [R]** A trader can open a position combining shares and an option leg (covered call) and it
  appears as one row.
- **AC-4 [R]** A trader can open a position whose only option leg is **sold** to open, with no offsetting
  bought leg, and it is accepted.
- **AC-5 [T]** Legs with **different expirations** are accepted and saved.
- **AC-6 [T]** A leg set the app has no name for is accepted and saved: no error, no warning icon, no
  blocked confirm.
- **AC-7 [R]** Entering a plain single long option takes no more steps than it does today.

**B — Naming**
- **AC-8 [R]** Each structure in the v1 named set displays a name a trader would recognise (e.g. "Call
  debit spread", "Covered call", "Iron condor", "Shares").
- **AC-9 [R]** An unrecognised leg set displays **"Custom"** with its leg count, in the same neutral visual
  register as every other name — no error styling, no alert colour, no icon.
- **AC-10 [R]** Changing a leg so the shape changes (e.g. moving one expiration) changes the displayed
  name immediately, with no reload.

**C — What the trader sees**
- **AC-11 [R]** Every multi-leg position shows its net entry cost as one figure, explicitly labeled paid
  (debit) or received (credit).
- **AC-12 [T]** Every position shows one net P/L figure covering all of its legs.
- **AC-13 [T]** A 100-share position whose price has risen $1 shows a P/L of **$100**, not $10,000.
- **AC-14 [T]** A named single-expiration structure shows **max loss, max gain, and breakeven**.
- **AC-15 [T]** Where the worst case is unbounded, max loss reads **"Unlimited"** — not a number, not blank.
- **AC-16 [T]** For a multi-expiration or Custom position, the at-expiration figures are replaced by a
  short stated reason — never blank, never `0`.
- **AC-17 [R]** The at-expiration figures carry their assumption in view (held to expiration, excludes
  fees and early assignment).

**D — Live / degraded (`live-vs-static-isolation` must survive the refactor)**
- **AC-18 [T]** On an SSE drop, a multi-leg position's P/L degrades exactly as a single-option position
  does today: last-known value with the offline marker, never blanked.
- **AC-19 [T]** If one leg cannot be quoted while others can, the position shows one honest position-level
  degraded state rather than presenting a partially-real P/L as real.
- **AC-20 [R]** Overnight / market-closed freezes a multi-leg position's P/L the same way it freezes a
  single-option position today.
- **AC-21 [T]** The static figures (net debit/credit, max loss, max gain, breakeven) do **not** dim or
  degrade on an SSE drop — they are not live-derived.

**E — Migration (the loss-free surface; `loss-free-durable-migration` is HARD here)**
- **AC-22 [T]** A trader with items on both surfaces sees, on first load after the update, **one** list
  containing every item from both.
- **AC-23 [T]** The resulting count equals the sum of the two prior counts. Two records of the same
  contract remain **two** positions — nothing merged, averaged, or deduped.
- **AC-24 [T]** Reloading repeatedly does not change the count, create duplicates, or drop anything.
- **AC-25 [T]** Every migrated position keeps its ticker, quantity, entry price, entry time, and
  open/closed state.
- **AC-26 [T]** The decision history after the update contains every entry from both prior logs, **once each**.
- **AC-27 [T]** The track record (hit rate, N, mean return per cell) reads the same immediately before and
  after the update.
- **AC-28 [R]** A one-time, dismissible, non-blocking notice explains the merge — and appears **only** for
  a trader who actually had items in both places.
- **AC-29 [T]** A trader who only ever used the Positions page sees no notice and no change to their
  existing positions.
- **AC-30 [R]** A trader with no saved data sees a normal empty portfolio — no notice, no error.
- **AC-31 [T]** Unreadable or corrupt saved data produces an honest message stating that nothing was
  deleted — never a silent empty portfolio presented as "you have no positions."
- **AC-32 [T]** Saved named views still open and apply; a view that grouped by strategy still groups, with
  long calls still grouped together.
- **AC-33 [T]** Closed/historical positions survive and remain in the history view with their close data.
- **AC-34 [T]** An existing single-option position's P/L figure is identical before and after the update.

**F — One book, two pages**
- **AC-35 [T]** A position opened from the Ticker page appears in the Positions portfolio without a reload.
- **AC-36 [T]** Closing a position on the Positions page is reflected on the Ticker page for that ticker
  without a reload.
- **AC-37 [R]** The Ticker page no longer offers a position concept separate from the portfolio — a trader
  cannot produce two competing records of one trade.

**G — Invariants, observably**
- **AC-38 [R]** Every position surface remains labeled `SIMULATED`; no broker, no order path, no
  real-money entry appears anywhere (`no-real-order-path`).
- **AC-39 [R]** Multi-leg entry happens in the **same** dialog as single-leg entry — there is no second
  entry dialog (`single-shared-sim-entry-dialog`).
- **AC-40 [T]** Opportunity score and tier on the Ticker page are unchanged by any position activity, and
  no backend behavior changes (`additive-keeps-score-byte-identical`).

---

## Risks I see

1. **Data loss, and its cousin: apparent data loss.** The invariant covers the first. The second is a
   product risk the invariant does not cover — a trader who reloads into a portfolio that looks emptier,
   or whose saved view stopped applying, will believe their history is gone whether or not it is. This is
   why AC-31, AC-32 and AC-28 exist. An honest "we couldn't read it, nothing was deleted" beats a
   technically-correct empty list.
2. **Silent P/L drift on existing positions.** The multiplier moving onto the leg is exactly the kind of
   change that produces a plausible-looking but different number on a position that already existed. AC-34
   is the guard, and it is squarely in the "silent regression is plausible" bucket.
3. **The track record moving.** The outcome ledger reads both stores today and is a global function of the
   entire history — it is the most sensitive detector of a subtly wrong merge, and also the thing a trader
   would notice last and trust least once noticed. AC-27.
4. **Over-confident classification.** Naming a diagonal a vertical, or a ratio a spread, mis-sizes real
   decisions. Mitigated by the conservative v1 name list + Custom-as-default. The pressure at R2 and at
   build time will be to name *more*; I would resist it, because names are free to add later and expensive
   to be wrong about now.
5. **Risk figures read as promises.** Max loss at expiration is not max loss in the presence of early
   assignment, dividends, or a pin. AC-17 puts the assumption in view; if it gets treated as decoration
   and dropped, this feature has made the app more confidently wrong.
6. **Scope creep into the payoff diagram.** The moment breakeven and max loss exist, drawing the curve is
   an obvious next step and a large one. It is Future. Named here so the pull is visible.
7. **The Ticker page losing its own trade surface** feels like a removal to a trader who used it daily,
   even though it is a consolidation. AC-35/36/37 make the gain observable; the one-time notice carries
   the explanation.
8. **Cut pressure landing on max loss.** If effort runs long, max loss is the thing that will look
   optional. It is not. §2 states the cut order for exactly this moment.
9. **Concurrent work in `apps/dashboard/src/app/`** (flagged in `_MANIFEST.md`) touching the trading domain
   while this refactor is in flight — a merge conflict inside a durable-migration change is the worst place
   to have one. Coordination is a conductor concern, but the product consequence is a botched migration.
10. **Multi-leg quoting cost.** If pricing N legs means N lookups, a large book could get slow or ratey.
    That is an architecture question, but the product consequence — a portfolio that takes visibly longer
    to show numbers than it does today — would be a regression the trader feels immediately.

---

## Assumptions I'm making about the other two lanes

**About the architect:**
- A position can hold an **arbitrary number of legs with no fixed cap** the product has to explain. If a
  cap is proposed (e.g. 4), the product needs a message for hitting it and I will contest the cap at R2 —
  because the importer will eventually meet a 6-leg account.
- The structure name is **derived at render time from the legs and never persisted**, so an unnamed leg set
  still renders and adding a name later requires **no migration**. My whole §1(b) conservatism depends on
  this being true.
- Classification **cannot throw and cannot block a save** — an unrecognised shape returns "unknown"
  rather than raising. AC-6 fails if this is not the design.
- Per-leg valuation lets **shares and option contracts coexist in one position and sum correctly**
  (the ×100 moves onto the leg). AC-13 and AC-12 depend on this.
- **Max loss, max gain and breakeven are computable client-side from the legs alone**, with **no backend
  call, no new vendor data, and no new dependency**. If any of the three needs a server round-trip, that
  contradicts the BRIEF's `NO_BACKEND_CHANGE` framing and must surface at R2, not at build time.
- The existing **mark ladder applies per leg**, so a position can be partially degraded; and it is
  acceptable to surface **one position-level freshness state (the worst of its legs)** rather than per-leg
  badges. If the architect wants per-leg freshness on the wire, say so at R2 — it changes AC-19 and the UX.
- Quoting an N-leg position uses the **existing contract lookup with no new endpoint** and does not
  introduce a per-position cost that scales badly enough to be user-visible. If N legs means N round trips
  and a 20-position book gets slow, that is an R2 conflict I need raised.
- The migration is **single-pass, migrate-on-read, and requires zero trader action** — no button, no
  wizard, no progress screen. AC-28's "non-blocking notice" assumes there is nothing to block on.
- **Both prior stores are read in one pass** and the merged result is **stable across reloads** (no
  re-migration producing duplicates on load 2). AC-24 depends on this.
- The two decision logs unify **without renumbering, reordering, or losing timestamps**, and without
  introducing duplicates for records the outcome ledger currently de-duplicates across stores. AC-26 and
  AC-27 both depend on this.
- **`apps/api` is untouched.** Zero backend diff.
- Simulated **orders** continue to produce single-option positions with their existing provenance backlink
  intact — i.e. the order engine is not silently broken by the position shape change even though it gains
  no multi-leg capability.

**About UX:**
- The **legs are visible in the list row/card itself** (at minimum a compact summary), not only behind a
  detail view. If the leg summary cannot fit the row, the portfolio stops being scannable and AC-1's "one
  row" becomes "one useless row" — raise it at R2.
- The **one shared entry dialog can grow a multi-leg mode without becoming a wizard**, and the
  single-option path keeps the same click count as today (AC-7). If multi-leg entry forces a step-based
  flow onto single-leg entry, I will contest it.
- Table columns that are **per-leg concepts today** (strike, expiration, right) can present a
  position-level value or an honest "multiple" without the row reading as broken or empty.
- There is room for **one one-time, dismissible, non-blocking merge notice** that is not a modal wall.
- **Custom gets a neutral presentation** — no red, no warning icon, no "unsupported" copy. If the UX
  treats Custom as an error state, §3 collapses.
- **Withheld risk figures get a visible short reason in place of the number**, and the space to say it.
  A bare `—` fails AC-16.
- The **Ticker page can host the shared position surface** without inventing a second concept, and without
  reintroducing a page-local trade panel (AC-37).
- Any new surface is **token-only with dark/light parity** (`theme-token-discipline`) — I am assuming this
  rather than restating it as product behavior.
