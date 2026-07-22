# Decision queue — one decision at a time

> The console surfaces ONE open item at a time (topmost first) and appends outcomes below.
> Human-editable AND machine-parsed — keep the exact bullet shapes:
>
>   open item   - **[Q<n>]** <title> — <context> · recommend: <what + why> · defer-cost: <what it costs to wait>
>   outcome     - [Q<n>] DECIDED <yyyy-mm-dd>: <outcome>
>               - [Q<n>] DEFERRED <yyyy-mm-dd>: <why + the revisit trigger>
>
> One line per item (continuation lines may be indented). Ids stay unique forever — never reuse
> a Q<n>, even after it is decided.

## Open
- **[Q1]** Green-light the vendor-licensing research — the Massive/Polygon license FORBIDS the
  redistribution a paid product needs (the hard monetization blocker, parked in BACKLOG §C since
  June); a deep-research pass would produce a cited report on Massive redistribution terms +
  Databento/ORATS commercial licensing + whether Databento Standard includes Blue Ocean overnight
  · recommend: YES — Value H, blocked a month, zero code, unblocks the whole monetization track
  and the vendor/overnight decision together · defer-cost: every week of product work continues
  against a stack that may be unsellable as-is.
- **[Q2]** Rule on the split decision log — `appendDecision` writes to TWO stores
  (`convexa.ghost-trade.v1` live from the Ticker page; `convexa.positions.v2` from Positions), so
  Ticker ghost-trade records land in a key nothing reads; outcome-ledger already unions both, so it
  is correct either way — the question is whether the split is INTENDED (then: union + document,
  small) or not (then: store unification, a durable-key refactor with `loss-free-durable-migration`
  binding) · recommend: union + document NOW, unify only as its own deliberate feature — never on
  another feature's critical path · defer-cost: the audit spine stays split; every Ticker ghost
  trade keeps writing to a dead-letter key that LOOKS legacy and invites a catastrophic "cleanup".
- **[Q3]** Score change — go or no-go — the outcome-ledger now measures whether the opportunity
  score is any good (hit-rate/expectancy by tier on /positions); the score's weights
  (`40/25/25/10`, `8.0`/setup, gate 50) have never been validated against an outcome, and
  `score-change-is-deliberate-and-measured` defines the only legal path (explicit feature + measured
  before/after + fingerprint version bump; PRODUCT §7.4: partition or reset the all-time tier cells)
  · recommend: review the track record FIRST, then decide — if samples are still thin, DEFER with
  "revisit at N≥20 in the tier cells" rather than change blind · defer-cost: low while samples are
  small; the defer trigger makes waiting honest instead of indefinite.

## Decided
