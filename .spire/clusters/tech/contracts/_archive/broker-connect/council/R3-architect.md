# R3 — architect resolution: broker-connect

> Responding party on C5; answering the UX vocabulary ask and both PM asks. Field names below are
> normalized-record vocabulary (the `BrokerBook` content my lane owns); wire spelling is the
> synthesizer's.

## C5 (ux) — ACCEPT, with one vocabulary amendment

Accepted: `state`/`as_of`/`basis` describe the **snapshot served**; they cannot also describe the
**most recent broker contact**. Those are different honesty claims, so they are different fields.
UX's two additive fields land on `BrokerBook`.

**Amendment (vocabulary, not substance):** one shared closed **failure-cause set** feeds both the
attempt outcome and the unknown reason, so the two fields can never drift apart:

> failure-cause = `broker_unreachable | rate_limited | credential_rejected | credential_unreadable | adapter_fault`

UX's proposed five gain `credential_unreadable` (server-side decrypt-fail: remedy is Replace, but it
is not a claim about Webull — "Webull stopped accepting the key" copy must never render for a fault
that is ours). Then:

- `last_attempt_outcome` = `ok` ∪ failure-cause.
- `reason` (when `state: unknown`) = `no_credential_stored` ∪ failure-cause.

**Attempt semantics (binding):** an *attempt* is actual broker contact (or the read pipeline failing
before contact on `credential_unreadable`). A cache serve under the TTL or the server throttle is
**not** an attempt — `last_attempt_at` does not move, which is exactly how a consumer distinguishes
"server chose not to ask" from "server asked and failed" (this also gives C4's resolution its wire
truth).

**Cache retention rule (closes C5's last-known-book gap):** the TTL bounds *serve-without-attempting*
only; it is not an eviction deadline. On a failed attempt the server serves the last good book with
its true `as_of` plus the failure in `last_attempt_*`; the cached book is dropped only on process
restart or credential delete (§7 invalidation). So "your last confirmed book stays below" is
server-true within a process lifetime and **conditional across restarts** — S7/S8 copy conditional on
a confirmed book, per UX's proposal, stands.

### Final `BrokerBook` envelope (names, types, presence rules)

| Field | Type | Presence |
|---|---|---|
| `state` | enum `ok \| empty \| unknown` | always |
| `reason` | enum `no_credential_stored` ∪ failure-cause | iff `state: unknown`; absent otherwise |
| `as_of` | UTC timestamp of the successful fetch backing this snapshot | iff `state ∈ {ok, empty}`; **absent** when `unknown` (never fabricated) |
| `basis` | enum `fresh \| cache` | iff `state ∈ {ok, empty}` |
| `stale_after_seconds` | positive int, server-owned (see PM ask below) | iff `state ∈ {ok, empty}` |
| `account_ref` | opaque | present whenever a stored credential resolves one; absent when `reason: no_credential_stored` |
| `positions` | `BrokerPosition[]` | always; `[]` under `empty` and `unknown` — meaning comes from `state` only |
| `last_attempt_at` | UTC timestamp of most recent attempt (this process) | iff ≥1 attempt has occurred; absent when `no_credential_stored` or pre-first-attempt after restart |
| `last_attempt_outcome` | enum `ok` ∪ failure-cause | iff `last_attempt_at` present |

Derived render predicates (never wire fields): **degraded** := `last_attempt_outcome ≠ ok` while a
snapshot serves; **stale** := `now − as_of > stale_after_seconds`. Independent axes — S6 and S7/S8
render from different fields, and a cache-served outage is no longer invisible.

## UX ask — `unknown` reason vocabulary: CONFIRMED

`credential_rejected` (broker refused the credential: expired / revoked / unapproved) is its **own
value**, distinct from `broker_unreachable` (broker not reached at all) and `no_credential_stored`
(nothing to try). Final closed vocabulary for `reason`:

> `no_credential_stored | credential_unreadable | credential_rejected | broker_unreachable | rate_limited | adapter_fault`

Six values, closed, typed — never free prose. S8 keys off `credential_rejected` wherever it appears
(`reason` when no book serves, `last_attempt_outcome` when a cached book still serves).

## PM ask — what datum defines "stale" with no poller

**One choice: the server-declared age threshold, riding the envelope.** `stale_after_seconds` is a
server-owned figure derived from the cache TTL, present on every served snapshot
(`[model-read-carries-its-assumptions]`). "Stale" is then a client-derived, time-varying predicate —
`now − as_of > stale_after_seconds` — recomputed as the response ages in the session.

Explicitly rejected: a wire `stale` **boolean** (it freezes at serve time and goes false-negative the
moment the response ages in the client); pure as-of age with an FE-invented threshold (the FE would
be hardcoding a freshness policy the server owns — the same fiction class as C1's cadence field); and
"no binary stale at all" (UX's S6 needs a trip point, and it must be the server's, not copy's). This
is the wire truth UX/PM copy binds to: no cadence exists, no cadence is named; the threshold value
may change server-side without any FE edit.

## PM ask — broker-supplied unrealized P/L (technical half only)

The non-goal bans **reconstruction** — deriving P&L from transaction history, our marks, or any
synthesis. It does **not** ban carrying a fact the broker sends. Technically: the tri-state
broker-supplied-fact pattern (§2 of R1 — supplied / not-supplied-by-broker / supplied-but-unparseable)
already covers this class; if capture shows Webull sends an unrealized P/L, it becomes one more
additive optional tri-state field on `BrokerPosition`, mapped **verbatim** by the adapter — no
computation, no blending with our mark ladder, port and envelope unmoved. `[absent-is-not-none]`
holds at field level: a Webull book without the figure renders it not-supplied, never 0.

Whether any surface **displays** it in v1, and on what basis, is the owner's open product call — the
records carry it (or its absence) honestly either way, and nothing structural blocks either answer.
If it displays, the basis must be named on the datum (UX has that copy drafted); that consequence is
theirs to render, not mine to decide.
