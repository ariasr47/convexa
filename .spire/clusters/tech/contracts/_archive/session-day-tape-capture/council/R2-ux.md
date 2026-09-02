```json
{
  "role": "ux",
  "agree": [
    "Pages trader origin continues to 404 `/api/_research`.",
    "Path-A and Path-B statuses are **independent**.",
    "tape occupants are **not** session-archive identities and are **never** `insert_if_absent`’d as `LiveMassive`.",
    "Do **not** persist `LivePrice` / `price:{SYM}` snapshots as the tape: that type already collapsed trade-vs-mid (`display_price` prefers last trade).",
    "Trader UI is out (`NO_UI_CHANGE`).",
    "Loading or reconstructing from tape must **not** make coverage classify that identity **present**.",
    "Research list/load with **zero vendor I/O**, including after the vendor is gone."
  ],
  "conflicts": [
    {
      "quote": "Persist the **last quote per symbol per 1-second bucket** keyed on vendor `ts_ns` when `ts_ns > 0`, else receive wall-clock with an explicit **receive-clock** basis (timestamp quality is not collapsed).",
      "source": "architect",
      "why": "Operator Path-A copy cannot print `{n_quote} quotes` or “the quote/mid updates that already arrived” for a last-per-1s sample — that renames a downsample as the stocks-path quote stream (PM AC-3 / S1). A vouched `quote` count would still be a count of stored samples, not of every quote the live desk received.",
      "proposal": "R2 picks one keep-set. If every already-received stocks-path quote is stored, Path-A print stays kind-split `trade`/`quote` counts. If last quote per 1-second bucket is stored, operator copy must say that and must not claim every arrived quote/mid.",
      "kind": "product"
    },
    {
      "quote": "Path-A and Path-B append only while `MarketPhase::classify(now) == Rth` (09:30–16:00 ET, weekdays).",
      "source": "architect",
      "why": "PM keeps extended-hours stock events that already arrive and claims completeness only against RTH. If Path-A drops premarket/afterhours, operator copy cannot say every last-trade/quote the live desk already received; dropped prints would read as if they never happened.",
      "proposal": "Append Path-A for already-received extended-hours ticks as PM locked; complete-RTH / partial copy stays 09:30–16:00 ET only. If append stays RTH-only, the operator surface needs an out-of-window class — not `no path-a ticks`.",
      "kind": "product"
    },
    {
      "quote": "Persist interval **300 s** wall-clock per symbol, **independent of** `WARM_INTERVAL_SECS`.",
      "source": "architect",
      "why": "Standing block and Path-B section print the locked interval. PM’s operator-visible series is clock-aligned 09:30, 09:35, …, 16:00. Elapsed 300 s from first in-window warmer success is a different series; printing clock-aligned 5-minute marks for an elapsed-from-first store is a renamed cadence.",
      "proposal": "Persist Path-B on the ET clock-aligned 5-minute marks PM locked (at most one per mark, already-paid only). If elapsed-300s is the store, print that (first snapshot as-of, then 300 s) and do not print 09:30/09:35 marks as if they were stored.",
      "kind": "product"
    },
    {
      "quote": "UX will carry **distinct literals** through the UI for `not_due` / `not_storing` / `missing` / `empty_attempted` / `gap` / `unreadable` / `recording` / `closed`, independently for price tape vs structure snapshots, and will not render a tape occupant as a “present live session book.”",
      "source": "architect",
      "why": "Coverage already uses `missing`/`present` for live-paid session books. Printing `missing` as a tape cell is this feature’s defining integrity failure. Collapsing weekend, future, and before-RTH into `not_due` also violates `absent-is-not-none` against PM’s ineligible-weekend vs not-expected-pre-store vs partial.",
      "proposal": "Operator literals stay tape-specific: `no session day tape…` / `no path-a ticks…` / `no path-b snapshots…` / `session day tape not storing` / `session day tape unreadable:` / `not in tape watchlist:` plus PM’s ineligible-weekend, not-expected-pre-store, partial, complete RTH, Path-B gap, Path-B not-capturing, unauthorized. Never coverage `missing` or `present` on this vehicle. Internal enums may differ; list/load copy must not emit those coverage words.",
      "kind": "technical"
    },
    {
      "quote": "Wrapper: tape occupancy = `TapeCapture`; inner “how we fetched” may record live REST as a historical fact.",
      "source": "architect",
      "why": "Operator load will read whatever the human print shows. Inner `to_wire` / `serialize_capture` bytes stamped `LiveMassive` would label a tape occupant with the session-book provenance token, which copy hard-bans and `present-is-live-paid-only` forbids.",
      "proposal": "Occupancy and operator print provenance is research tape / never `live_massive`. If an inner fetch fact is shown, it is already-paid REST as history — not `MarketDataSourceKind::LiveMassive` and not coverage `present`.",
      "kind": "technical"
    },
    {
      "quote": "Hard cap **8** names at config parse; production refuse if empty or over cap.",
      "source": "architect",
      "why": "Standing block prints the locked watchlist this run used. PM AC-5: a name that is not SPY, QQQ, or IWM receives no tape. A cap-8 operator-expanded set would print extra names as in-watchlist while PM forbids an operator-editable set this slice.",
      "proposal": "Locked-watchlist copy and `not in tape watchlist:` follow PM’s closed trio SPY, QQQ, IWM this slice. Expansion stays Future/owner.",
      "kind": "product"
    },
    {
      "quote": "`78% of the day captured` as a headline is a renamed count with a completeness connotation the data does not carry unless PM locks a session window **and** both paths report against it (they have not, in this BRIEF).",
      "source": "ux",
      "why": "PM locked completeness against RTH 09:30–16:00 ET and distinguishable complete RTH vs partial (AC-19, AC-34). The “they have not” clause is false. Percent headlines stay banned; named complete-RTH vs partial classes do not.",
      "proposal": "Keep the ban on bare percent / “78% of Tuesday”. Add operator-visible complete RTH vs partial. Do not call Path-A-only or Path-B-only a complete day.",
      "kind": "product"
    },
    {
      "quote": "**PM** accepts the six tape absences (no-ticks / no-snapshots / no-identity / not-storing / unreadable / not-in-watchlist) plus foreign coverage-missing as product states required by `[absent-is-not-none]`, not as UX gold-plating — including that zero Path-A ticks is **not** a `[FAIL]` coverage hole.",
      "source": "ux",
      "why": "PM S4/AC-34 also requires distinguishable Path-B-gap, partial, ineligible-weekend, not-expected-pre-store, unauthorized, and complete RTH. Collapsing those into the six literals — or using `no path-b snapshots` for both fetch-off and a missing 5-minute mark — is the absence-collapse this lane was designing against.",
      "proposal": "Keep the six literals as a subset. Extend the closed operator set with PM’s extra classes: Path-B not-capturing ≠ Path-B gap ≠ Path-B empty-while-storing; weekend ≠ not-expected ≠ no-identity; partial ≠ complete RTH. Zero Path-A ticks stays not a coverage `[FAIL]`.",
      "kind": "product"
    },
    {
      "quote": "**`review` owns** absence of trader UI (AC-27), no S3 ingest (AC-37), and non-absorption of lab UI / body-move / watchlist expansion (AC-38).",
      "source": "pm",
      "why": "Absence of a trader route/nav/screen is negative space that can silently regress. Risk-based verify marks that `test` (UX AC-U1/U31). Marking AC-27 `review` lets a helpful widget land without a rejecting GATE Q path.",
      "proposal": "Verify-by for no trader-facing route, nav item, or screen is `test`. Leave `review` on AC-37 (no S3 ingest), AC-38 (no lab UI / body-move / watchlist expansion), standing-block prose, glossary, and SPEC §4 `NO_UI_CHANGE`.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Architect: if last-quote-per-1s is stored, does list/load vouch a Path-A `quote` count, and is the 1-second bucket basis (vendor `ts_ns` vs receive-clock) a field the operator print can name so copy does not say every quote that arrived?",
    "Architect: what per-path occupancy tokens will list/load return for empty_attempted, gap (hub lag vs persist skip vs missing 5-minute mark), not_attempted (tape ⊄ warm), recording, closed, and not_due — without using coverage `missing` or `present`?",
    "PM: if R2 accepts last-quote-per-1s, what exact operator phrase replaces “the quote/mid updates that already arrived on that same stocks path”?",
    "PM: exact operator-visible words for complete RTH, partial, Path-B not-capturing, Path-B gap, and not-expected-pre-store, so those classes are not collapsed into `no path-a ticks` / `no path-b snapshots`."
  ]
}
```
