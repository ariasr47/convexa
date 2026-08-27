# R1 — ux position: archive-coverage-guardrails

## Position

### UX boundary and intended operator

`NO_UI_CHANGE` is binding. This feature adds no browser page, card, route, navigation item, trader
copy, motion, or design-system amendment. Its user-facing surfaces are limited to operator metrics,
one structured warning, a local audit command, and a storage runbook.

The intended user is the person operating or maintaining Convexa's production archive. Their primary
job is to answer, without inference: **for each required symbol and ET date, was a session book
expected, is its record present, and can its body be read?** The secondary job is to know what to do
before another expected book is missed.

The operator vocabulary must use **book** or **symbol-session**, never bare **day** or **session count**.
One ET date can contribute three expected books: one each for SPY, QQQ, and IWM.

### Information structure and where each datum surfaces

1. **Scope first:** evaluation time in ET, checked ET date range, required symbols, and the applicable
   ET checkpoint. Without these, a count has no defensible meaning.
2. **Coverage summary:** expected, present, readable, missing, and unreadable book counts. `Present`
   must never be presented as a synonym for `readable`.
3. **Per-symbol detail:** each expected symbol-date and its closed status, plus the last readable book
   identity for each symbol. A global count alone cannot tell an operator what was lost.
4. **Write-attempt context:** a separately labeled write-failure count whose time window is explicit.
   It must never be added to missing or unreadable counts.
5. **Outcome and next action:** the audit's PASS/FAIL/ERROR result and a nonzero exit on an incomplete
   or uncheckable archive.

Operator metrics surface the current summary, evaluation timestamp, checkpoint, per-symbol status,
last readable identity, and scoped write-failure count. The warning surfaces only the affected symbol,
ET date, checkpoint, and `missing` or `unreadable` state. The local audit command surfaces the complete
matrix and exit result. The runbook owns storage thresholds and the action attached to each threshold;
metrics and warnings must not invent threshold values.

### Closed vocabulary and copy integrity

These terms are not interchangeable:

| Operator term | Meaning the data must support |
| --- | --- |
| **Expected books** | Required symbol-date pairs whose ET checkpoint has passed. |
| **Present books** | Expected books for which an archive record exists; the body may still be unreadable. |
| **Readable books** | Expected books whose stored body can be opened as a session book. |
| **Missing books** | Expected books for which no archive record exists. |
| **Unreadable books** | Expected books with a record whose body cannot be opened as a session book. |
| **Not due** | A required symbol-date whose ET checkpoint has not passed. It is excluded from `expected`. |
| **Last readable book** | The symbol, ET date, and source timestamp of the latest book actually read. |
| **Archive write failures since service start** | Failed archive write attempts observed in the current service process. It resets on restart and is not a missing-book count. |
| **Coverage complete** | Every expected book is readable. `Present` alone is insufficient. |

The audit's human-readable output uses this order and exact framing:

```text
Archive coverage — {evaluated_at_et}
Scope: SPY, QQQ, IWM · {start_date}–{end_date} ET · checkpoint {checkpoint_et} ET
Readable: {readable} of {expected} expected books
Missing: {missing} · Unreadable: {unreadable} · Present: {present}
```

Per-book rows use exactly one of:

```text
{symbol} {et_date} ET — readable
{symbol} {et_date} ET — missing
{symbol} {et_date} ET — unreadable
{symbol} {et_date} ET — not due until {checkpoint_et} ET
```

Last-readable detail uses:

```text
{symbol} — last readable {et_date} ET · source {source_as_of}
```

When the checked window contains no readable book for a symbol, do not fabricate a date:

```text
{symbol} — no readable book found in the checked window
```

Terminal outcomes are deliberately different:

```text
PASS — every expected book is readable.
FAIL — {missing} missing and {unreadable} unreadable expected books.
ERROR — archive coverage could not be checked: {reason}. No completeness claim was produced.
```

An empty window is not a successful capture claim:

```text
No books were expected in this window.
```

The post-checkpoint warning template is:

```text
Session archive incomplete after {checkpoint_et} ET: {symbol} {et_date} ET is {missing|unreadable}. Run the archive coverage audit for details.
```

The warning must not say `lost`, `recovered`, `restored`, or `complete`; none of those meanings follows
from a single failed check. A later readable result changes current coverage but does not rewrite the
historical warning.

If coverage is served from an aged evaluation, the degraded label is:

```text
STALE — coverage was last evaluated at {evaluated_at_et}; do not treat it as current.
```

If every metrics read performs a current evaluation, the stale state is impossible and this label must
not be emitted. `Offline` is also not a valid label: the local audit is explicitly zero-vendor. Failure
to access the archive is an inspection `ERROR`, not an internet-connectivity claim.

Any future partial reconstruction remains outside the exact archive count and must be labeled:

```text
Partial reconstruction — not an original session book.
```

It must not change `missing` or `unreadable` to `readable`. Withdrawing an unrecoverable completeness
claim is correct behavior.

### Complete state matrix

| State | What the operator sees | Available next action | Must not happen |
| --- | --- | --- | --- |
| **Default / complete** | Scope, counts, per-book rows, last-readable identities, then `PASS — every expected book is readable.` | Continue normal monitoring. | `Present` cannot substitute for `readable`; no warning is emitted. |
| **Default / incomplete** | Same evidence, affected rows marked `missing` or `unreadable`, then the exact FAIL line. | Runbook directs inspection of archive storage and write failures. | No PASS, recovery, or completeness wording. |
| **Loading** | No durable loading state is needed for a noninteractive local command. If a human terminal uses transient progress, it may say `Checking archive coverage…` only before any result. | Wait for the terminal result. | Progress text cannot be the final line or imply success. Machine-readable output contains no progress record. |
| **Not due** | The symbol-date row says `not due until {checkpoint_et} ET`; it is excluded from expected/missing counts. | Recheck after the named checkpoint. | No warning and no missing classification before the checkpoint. |
| **Empty window** | `No books were expected in this window.` with zero expected books. | Change the requested range if desired. | Must not read `all books captured`, `coverage complete`, or `no books found`. |
| **Inspection error** | The exact ERROR line with a bounded reason and no coverage verdict. | Fix access/configuration, then rerun. | No zero exit, PASS, FAIL-as-if-counted, or fabricated zero counts. |
| **Stale** | The stale line beside the last evaluation timestamp when an aged evaluation is actually being shown. | Obtain a current evaluation. | A stale snapshot cannot be labeled current or complete without the stale qualifier. |
| **Offline** | No offline state or copy. The command does not require the vendor or internet. Archive access failure maps to inspection error. | Resolve local/store access. | Do not misdiagnose a mount, permission, or read fault as connectivity. |
| **Success / confirmation** | The PASS line appears only after the complete evidence block. | None required. | No celebratory or trader-facing styling; no green/red semantics are introduced. |

No status relies on color, icons, or terminal animation. Status words and counts remain readable in
plain text, redirected output, and a monochrome terminal.

### Storage runbook wording

The runbook must print or document the capacity source, current usage, action threshold, urgent
threshold, and action. Threshold percentages are a product/operations decision and must be sourced from
configuration or an approved runbook value; this position intentionally supplies no unsupported number.

Use these templates once those values are vouched:

```text
Within plan — storage is at {used_percent}%, below the {action_percent}% action threshold.
Plan growth — storage is at {used_percent}%; the action threshold is {action_percent}%. Increase capacity or reduce usage before the urgent threshold.
Urgent — storage is at {used_percent}%; the urgent threshold is {urgent_percent}%. A full volume can interrupt archive writes.
```

The last line states a risk, not a guarantee that disruption has already occurred. Storage pressure is
not itself an archive coverage result; the two must remain separate.

### Acceptance-criterion state and verification map

These are the UX-owned observable requirements for the synthesizer to fold into SPEC §3. `Verify by`
uses risk: silent semantic or negative-space regressions are `test`; exact visible wording and ordering
are `review`.

| UX AC | Observable requirement | State(s) | Verify by |
| --- | --- | --- | --- |
| UX-01 | No browser route, component, navigation item, trader copy, or dashboard client behavior changes. | all | test |
| UX-02 | Operator output begins with ET evaluation time, checked ET range, required symbols, and exact ET checkpoint before any coverage count. | complete, incomplete, empty, error | review |
| UX-03 | Expected, present, readable, missing, and unreadable counts follow the closed meanings above; `complete` requires every expected book to be readable. | complete, incomplete | test |
| UX-04 | Every expected symbol-date has exactly one of `readable`, `missing`, or `unreadable`; a pre-checkpoint pair is instead `not due` and excluded from expected/missing counts. | complete, incomplete, not due | test |
| UX-05 | The per-symbol last-readable line names symbol, ET date, and source timestamp, or uses the exact no-readable-book sentence without a fabricated date. | complete, incomplete, empty | test |
| UX-06 | The audit prints the exact PASS, FAIL, or ERROR wording for its actual state and never combines those verdicts. | complete, incomplete, error | review |
| UX-07 | Exit is zero only when all due expected books are readable or the requested range has zero expected books; missing, unreadable, or uncheckable coverage exits nonzero. | complete, incomplete, empty, error | test |
| UX-08 | A zero-expected range says `No books were expected in this window.` and never claims books were captured or coverage was complete. | empty | test |
| UX-09 | An archive inspection failure says no completeness claim was produced and emits no fabricated coverage counts. | error | test |
| UX-10 | Before the checkpoint, no missing/unreadable warning is emitted for that symbol-date; after it, the exact warning copy is used for an observed missing or unreadable book. | not due, incomplete | test |
| UX-11 | Warning wording names the checkpoint, symbol, ET date, and actual `missing` or `unreadable` state, followed by the audit next step. | incomplete | review |
| UX-12 | At most one warning is emitted for each symbol-date issue within the declared deduplication scope; repeated checks do not create a warning storm. | incomplete | test |
| UX-13 | The write-failure readout is labeled `since service start`, resets consistently with that scope, and is never presented as a missing/unreadable count. | complete, incomplete, error | test |
| UX-14 | A cached/aged evaluation, if the design permits one, carries the exact STALE qualification and its evaluation time; a current evaluation never carries it. | stale, complete, incomplete | test |
| UX-15 | No local audit state is labeled `offline`; archive access faults use inspection ERROR. | error, offline | test |
| UX-16 | The runbook names the capacity source, approved threshold values, and actions using risk language; it does not infer archive completeness from volume usage. | complete, incomplete | review |
| UX-17 | A partial reconstruction, if surfaced, carries `Partial reconstruction — not an original session book.` and cannot satisfy an expected exact book. | incomplete | test |
| UX-18 | Plain-text output preserves every status and next action without color, animation, or icon dependence. | all rendered states | review |

The SET design canon is adhered to by absence: there is no browser surface to style, no new token or
component, no status tint, and no motion. If implementation adds a browser surface, this position no
longer applies; that is a product re-scope and design-system review, not an implicit extension.

## Risks I see

- An undefined ET checkpoint makes both `expected` and warning timing unverifiable. The exact time and
  daylight-saving treatment must be bound outside the UX lane before copy ships.
- Calling a record `present` without proving its body readable recreates the original blind spot while
  producing a reassuring number.
- A process-lifetime write-failure counter without `since service start` overstates its historical scope;
  a durable counter with that label would be equally misleading.
- `No books found` collapses an empty requested window, a wholly missing expected matrix, and an
  inspection fault into one sentence. Those are three different operator actions.
- A global `last readable` value can hide one symbol falling behind while another advances; the operator
  needs the identity per required symbol.
- Threshold percentages copied from today's provider screen can become stale policy. The runbook needs
  an approved source of truth, not a number remembered in prose.
- Warning deduplication can become concealment if its scope is not declared. One warning must still carry
  enough symbol/date/state detail to identify the unresolved book.
- A reconstructed subset described as `restored` would poison research provenance. Exact archive coverage
  and partial historical material must remain different categories.

## Assumptions I'm making about the other two lanes

- The product lane will bind one exact America/New_York checkpoint and state whether the current ET date
  before that checkpoint is excluded from `expected` rather than treated as missing.
- The product lane will approve the zero-expected-window exit as success-with-no-claim, not as coverage
  complete and not as an operational error.
- The product lane will supply approved storage action and urgent thresholds, or explicitly require them
  to be configuration-backed; no percentage is inferred by this UX position.
- The architecture lane can distinguish record presence from body readability for every required
  SPY/QQQ/IWM symbol-date without fetching Massive or invoking trader computation.
- The architecture lane can expose an evaluation timestamp, checkpoint, complete per-symbol matrix, and
  each symbol's last readable ET date plus source timestamp from read-only data.
- The architecture lane's write-failure count is process-lifetime and resets on restart; if its scope is
  different, the label and tooltip must change to name the actual scope.
- The architecture lane can make warning deduplication observable and bounded by a declared scope while
  still emitting one warning for each affected symbol-date after the checkpoint.
- The architecture lane can guarantee that the local audit command makes zero vendor calls and returns a
  reliable nonzero exit for missing, unreadable, and uncheckable coverage.
- Neither other lane will add a browser surface, trader route dependency, scoring input, fingerprint
  change, vendor fetch, or recovery/reconstruction claim under this feature.
