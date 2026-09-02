# R3 — architect ↔ ux

One exchange. Conflicts `446e10df9ce747f4c951c8888533ac9b92e970925e8aad209faea71c42d0fb0e` (completeness / percent), `677662fc45cae5ae4dcab60266632a7ec8b1ecc5c9d983cd14fbe302a2a9a832` (occupancy types vs operator literals), `7da8e8369c6d39ead11394e8ed48583873c56d5e3fcd4d07bcdc69f7cdcea38d` (inner fetch / `LiveMassive`). Conductor folds already in force: no coverage `present`/`missing` on this vehicle; Path-B is clock-aligned 5-minute marks 09:30…16:00 ET; watchlist v1 = SPY/QQQ/IWM; Path-A keep-set and extended-hours window are human D1/D2 (occupancy must work for either). I do not relitigate those. I do not author operator strings, endpoint signatures, or payload keys.

## Converged

All three. No residual product clock. PM already withdrew operator-facing “complete RTH” as a success class; types below make partial ≠ through-window ≠ empty-while-storing observable without a success badge and without a percent headline.

### 1. Types vs strings (`677662fc…`) — I own types; UX owns strings

I **withdraw** the R1 operator-facing token list (`not_due` / `missing` / `empty_attempted` / one `gap` / `recording` / `closed`) as anything list/load may print. Those names collided with coverage cells (`missing`, `not yet due`) and collapsed distinctions PM and UX both require. UX’s closed tape literals remain UX-owned. Internal type identifiers in this file are **not** copy.

**Mechanism: occupancy is a product of independent axes, not one mutually exclusive tag.** A single enum that offers `partial` *or* `empty_while_storing` *or* `closed` forces a priority collapse — the exact fabricated-complete-day failure. Axes compose. Exhaustive match is per axis so a new arm cannot silently become “empty day.” Tape occupancy types live on the tape leaf; they are **not** aliases of coverage `IdentityStatus` (`Present` / `Missing` / `NotYetDue` / `RejectedSource`). `coverage.rs` does not import the tape module; tape load never calls `classify_loaded`.

**Axis A — gate (one of, day identity, before content):**

| Type | When | Distinct from |
| --- | --- | --- |
| `NotInWatchlist` | symbol outside locked trio | attempted-empty |
| `NotStoring` | store disabled / unavailable | a grid of empty days |
| `Unauthorized` | read-path token miss (not stored occupancy) | empty tape |
| `IneligibleWeekend` | ET Saturday/Sunday | empty-while-storing, coverage not-yet-due |
| `NotElapsed` | `et_date` after today ET | NoIdentity (we should have tried) |
| `NotExpectedPreStore` | eligible weekday before this environment was storing | NoIdentity, empty-while-storing |
| `NoIdentity` | storing, eligible, capturable date, no day container | quiet attempted day |
| `Unreadable` | identity exists; body not loadable | empty, not-storing |
| `StoringReady` | gate passed; path axes below apply | — |

**Quiet-day mint.** Empty-while-storing ≠ no-identity only if the day container is created when capture **arms**, not when the first tick arrives. Mechanism: Path-A sidecar, on first capture-on for `(symbol, et_date)`, mints the Path-A log (zero records allowed). Path-B series mints when Path-B is armed (first persist-hook fire or first honest mark-gap). A full quiet RTH with store on is therefore `StoringReady` + empty content, not `NoIdentity`.

**Axis B — per-path content (Path-A and Path-B independent):**

| Type | When |
| --- | --- |
| `EmptyWhileStoring` | that path armed; stored record count of that path is 0 |
| `Occupied` | that path has ≥1 stored record (not a success badge) |
| `PathAHubGap` | first-class Path-A gap occupant: `Lagged(n)`, writer-channel full, hub `Closed`/reconnect, persist fault. Coexists with empty or occupied ticks. |
| `PathBMarkGap` | clock-aligned mark in 09:30…16:00 inclusive with no snapshot while Path-B storing was on. Stays a gap. No fill fetch, no interpolation. |
| `PathBNotCapturing` | already-paid warm/refresh off, or tape name not in the warm set — **no** fabricated mark-gap grid. Path-A may still append. |
| `Recording` | that path is armed and the ET day is still in progress (not a day verdict) |

`PathAHubGap` is not `PathBMarkGap`. `PathBNotCapturing` is not `PathBMarkGap` and not `EmptyWhileStoring`. `EmptyWhileStoring` is not `NoIdentity` and not `NotStoring`. Kind-split Path-A counts and Path-B snapshot counts remain the honesty surface beside these types; occupancy does not encode them as a percent.

**Axis C — per-path capture span (only when Axis A is `StoringReady` and that path was armed). Independent of tick/snapshot counts. One clock: RTH 09:30–16:00 America/New_York (already locked). No holiday clock, no percent clock, no second completeness window.**

| Type | Derivation |
| --- | --- |
| `Partial` | recorded capture-on interval for that path does not cover [09:30, 16:00] ET (started after 09:30, or stopped before 16:00, or both) |
| `ThroughWindow` | recorded capture-on interval for that path covers [09:30, 16:00] ET |

Mechanism for the interval:

- Path-A: sidecar records capture-on from the instant it is recv-looping with store enabled for that identity, through disable/stop/end of window. `ThroughWindow` iff armed-from ≤ 09:30 ET and armed-until ≥ 16:00 ET. Tick count is not an input. Hub-gap records count as capture-on evidence, not as ticks.
- Path-B: the locked mark grid **is** the evidence. Each mark 09:30, 09:35, …, 16:00 is snapshot **or** `PathBMarkGap` **or** silent. Silent means not armed then → `Partial`. `ThroughWindow` iff no silent marks (every mark is snapshot or honest gap). All-gaps is still `ThroughWindow` on this axis — and is **not** a complete day (Axis B carries the gaps / zero snapshots).
- `ThroughWindow` cannot be known until capture has run through 16:00. `Partial` can be known earlier (mid-session start at 11:00 is already `Partial`). While still armed before 16:00 with start ≤ 09:30, Axis B may be `Recording`; Axis C is not yet `ThroughWindow`.

**Compositions that must remain representable (the anti-fabrication set):**

- `ThroughWindow` × Path-A `EmptyWhileStoring` — quiet day, capture was on. Not a complete-day occupancy arm.
- `ThroughWindow` × Path-B all `PathBMarkGap` (snapshot count 0) — warmer missed every mark. Not a complete-day occupancy arm.
- `Partial` × `EmptyWhileStoring` — started late **and** quiet. Distinct from the quiet through-window day.
- `Partial` × `Occupied` — started late, has records. Distinct from through-window occupied.
- Path-A `ThroughWindow` × Path-B `PathBNotCapturing` — independent paths; one side does not stand in for the other.
- `Occupied` on one path × `EmptyWhileStoring` on the other — already agreed independent.

**D1/D2-stable.** Axis B `EmptyWhileStoring` / `Occupied` count **stored** records of that path, whatever keep-set D1 locks. Axis C span is always vs 09:30–16:00, whatever Path-A append window D2 locks. Out-of-window ticks, if kept, are extra content, not required for `ThroughWindow` and not `EmptyWhileStoring`. Out-of-window ticks, if not kept, are not stored and are not empty-while-storing.

**UX mapping constraint (copy stays UX-owned):** list/load human print maps these types to UX’s closed tape set. It must not emit coverage `present`, `missing`, `not yet due`, or `blocked occupancy`. I do not write the strings. UX may omit a positive `ThroughWindow` literal: `Partial` named when true, through-window as the residual of storing ∧ eligible ∧ armed ∧ ¬Partial, with Axis B and counts beside it. That is enough for the operator to tell partial ≠ through-window ≠ empty-while-storing without a success badge.

Poison (build-red, non-vacuous): occupancy match is exhaustive per axis; no arm converts to `MarketDataSourceKind::LiveMassive` or coverage `present`/`missing`; planting a new gate/content/span state that is not handled fails compile; a quiet through-window fixture cannot classify as `NoIdentity` or as a complete-day tag (there is no such tag).

### 2. Inner fetch provenance never `LiveMassive` on tape occupants (`7da8e836…`)

I **withdraw** the R1 sentence that inner “how we fetched” may record live REST as a historical fact **if that fact is `MarketDataSourceKind::LiveMassive`**. UX is right: `to_wire` copies `bundle.source` onto `ChainSnapshotWire.source`; `serialize_capture` persists that discriminant; live compute stamps `LiveMassive` (`analytics.rs`, `LiveMarketData`). Coverage `classify_loaded` maps `(LiveMassive, LiveMassive)` → `IdentityStatus::Present`. An operator print of those bytes is a session-book provenance token on a tape occupant, which `present-is-live-paid-only` forbids.

I still do **not** add a third `MarketDataSourceKind` variant (that enum is the archive/ring/coverage machine). I still do **not** restamp inner bytes as `Fixture` (a lie that would read as `blocked occupancy` if it ever leaked into coverage).

**Chosen mechanism: tape-local wrapper with no `MarketDataSourceKind` on occupancy or operator provenance; persist-time drop of that discriminant from any reused capture codec.**

| Option | Complexity | Cost | Familiarity | Decisive failure |
| --- | --- | --- | --- | --- |
| Reuse `serialize_capture` as the outer tape document | lowest | none | highest | occupancy IS `LiveMassive` |
| Wrap codec, still project inner `source` to print | low | none | high | operator load prints `live_massive` |
| Wrap + persist-time drop of the source discriminant; inner fetch fact is a **tape-local** already-paid-REST history type that `coverage.rs` does not import | low | none | medium | none if drop is real |
| Tape-local structure record, no `MarketDataSourceKind` field at all | medium | none | lower | none by construction |

Decisive axis: `present-is-live-paid-only` + `structural-over-prose-enforcement`. Familiarity with `to_wire` loses if the codec cannot drop the discriminant.

How:

- Outer occupancy is the Axis A/B/C product above (`TapeCapture` wrapper). No conversion function into `MarketDataSourceKind`.
- Path-B persist still clones `VendorBundle` only when keeping, still only from already-paid `refresh_analytics`, still no `spawn_capture`.
- If structure content reuses the capture codec for chain/greeks bytes, the tape writer **drops** the `MarketDataSourceKind` discriminant **before** append. Stored Path-B bytes after persist cannot classify as `LiveMassive`. Inner historical fact, **if** UX chooses to show one, is tape-local “already-paid REST as history” — not `MarketDataSourceKind::LiveMassive`, not coverage `present`. I do not author that string.
- List/load provenance is computed from the wrapper only. Tape load never calls `classify_loaded`, never `insert_if_absent`, never `archive_session_best_effort`.
- A reconstructed / S3 / `LiveMassive`-stamped artifact offered as this tape is not a tape hit: occupancy cannot be `Occupied`/`ThroughWindow` from that stamp. UX already owns the blocked-reconstructed print; I own that the type system cannot treat it as live-paid present.

Poison: (1) no `fn` converts a tape record into `MarketDataSourceKind::LiveMassive` plus a session-archive body; (2) occupancy type has no `LiveMassive` / `Present` / `Missing` arm; (3) a planted Path-B body whose inner codec still carries `LiveMassive` is `Unreadable` or blocked-reconstructed, never tape-hit framing and never a coverage `present` flip; (4) `refresh_analytics` still does not `spawn_capture`.

### 3. Partial vs through-window without a percent and without a fabricated complete day (`446e10df…`)

I **withdraw** two claims:

1. That PM had not locked a session window. R1-pm locked completeness against RTH 09:30–16:00 ET. The “they have not, in this BRIEF” clause is false. Percent headlines stay banned (UX). `{k} snapshots` and kind-split Path-A counts stay counts, not health.
2. The occupancy arm `complete_rth` from my R2 proposal, including “Path-A may be empty” under that name. That arm **is** the fabricated open-to-close success PM withdrew: a through-window day with Path-A zero prints, or Path-B all gaps, would still pass and be labeled complete.

Fold, do not promote: Axis C (`Partial` | `ThroughWindow`) is the capture-on interval versus the **same** 09:30–16:00 clock Path-B already uses. It is not a fourth human clock. It is not a success class. Empty-while-storing, Path-B gaps, and kind/snapshot counts remain the honesty surface (PM). There is **no** occupancy arm that means “complete day,” “verified complete,” or “complete RTH.”

Operator-facing consequence I can require without writing copy:

- `Partial` must be distinguishable from `EmptyWhileStoring`, `NoIdentity`, `IneligibleWeekend`, `NotExpectedPreStore`, `PathBNotCapturing`, and `PathBMarkGap`.
- `ThroughWindow` must not be mapped to a success/completeness headline, a percent, or coverage `present`. UX may leave it unprinted (residual of ¬Partial) or print it as a span fact beside Axis B — UX’s strings. A through-window quiet Path-A day prints as empty-while-storing (UX literal) without a complete-day badge. A through-window all-gap Path-B day prints as gaps / zero snapshots without a complete-day badge.
- Zero Path-A ticks stays not a coverage `[FAIL]`.
- Do not call Path-A-only or Path-B-only a complete day (there is no such type).

AC-19’s “not claimed complete RTH” is then structural: the type that would make that claim does not exist. Mid-session start is `Partial` by Axis C. Quiet full-window is `ThroughWindow` × `EmptyWhileStoring`, not complete.

## Still split (promote to product only if you cannot settle)

None. The residual “must the operator see a named complete-RTH class?” is settled by types: `Partial` is the named span class; `ThroughWindow` is a non-success span fact; no complete-day occupancy arm. That matches PM’s withdrawal of operator-facing complete RTH as a success class. UX maps strings under the constraints above. A request for a positive complete-RTH **success** literal would contradict that fold and would be a product reopen of a withdrawn class — not a fourth clock this exchange needs to invent.
)
