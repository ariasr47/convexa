# broker-connect — INTERFACE_CONTRACT (FE↔BE single source of truth)

**Feature:** broker-connect · **Spec:** `SPEC.md` (references this file; never restates it)
**Status:** draft — wire spelling fixed by the R4 synthesizer per the binding R3-architect envelope
table and the R3 decisions log. A change to this file after approval is a GATE Z amendment.

All five endpoints are NEW. No existing endpoint changes shape. Nothing broker-derived rides the
SSE payload, ever. All timestamps are ISO-8601 UTC strings.

---

## 1. The `PositionsProvider` port (backend-internal contract the endpoints stand on)

A read-only ABC in a new one-way-leaf backend subpackage (structural sibling of `src/auth/`,
`src/marketdata/`), env-selected via `POSITIONS_PROVIDER` (`webull` default · `stub` for keyless
verification · `snaptrade` reserved):

- `fetch_book(credential, account_ref) -> BrokerBook` — one call, the whole current-holdings
  snapshot. The adapter absorbs vendor paging; pagination never crosses the port. `credential` is
  an in-memory value object resolved per-request at the `main.py` boundary — the leaf never
  imports the auth subpackage or any store.
- `describe() -> ProviderCapabilities` — static facts: provider id, refresh basis, whether cost
  basis / broker mark / broker unrealized P/L are supplied.

**There is NO write method — nonexistent, not unused.** No `place_order`, `cancel`, `modify`, or
generic `execute(...)`. `[no-real-order-path]` is structural: READ-ONLY has no write surface to
disable, and no caller can express a write request. Adding any write method is a GATE-Z event.

The Webull SDK is imported by the Webull adapter only, and only its account/positions/quote read
subset — pinned by a source-scan test.

## 2. The `BrokerBook` envelope (returned by both book endpoints)

Binding field table (R3-architect, final):

| Field | Type | Presence |
|---|---|---|
| `state` | enum `ok \| empty \| unknown` | always |
| `reason` | enum `no_credential_stored` ∪ failure-cause (§3) | iff `state: unknown`; absent otherwise |
| `as_of` | string (UTC) — time of the successful fetch backing this snapshot | iff `state ∈ {ok, empty}`; **absent** when `unknown` (never fabricated) |
| `basis` | enum `fresh \| cache` | iff `state ∈ {ok, empty}` |
| `stale_after_seconds` | positive integer, server-owned (TTL-derived) | iff `state ∈ {ok, empty}` |
| `account_ref` | string (opaque, server-derived) | present whenever a stored credential resolves one; absent when `reason: no_credential_stored`. **A server-generated non-reversible handle (e.g. a keyed hash) — NEVER the raw broker account number or any reversible encoding of it** (§8.1 classes account numbers as sensitive; opacity is a server obligation, not just a client treatment). Consumer: SPEC AC-23 (cross-account isolation) asserts it is per-account and never another account's; no render copy consumes it in v1 |
| `positions` | `BrokerPosition[]` | always; `[]` under `empty` AND `unknown` — meaning comes from `state` only |
| `last_attempt_at` | string (UTC) — most recent attempt, this process | iff ≥1 attempt has occurred; absent when `no_credential_stored` or pre-first-attempt after restart |
| `last_attempt_outcome` | enum `ok` ∪ failure-cause (§3) | iff `last_attempt_at` present |

**Typed unknown-vs-empty (`[absent-is-not-none]`):** both `empty` and `unknown` carry
`positions: []`, so `state` is the SOLE disambiguator — no consumer may branch on
`positions.length`. The FE renders `state`/`reason`/`last_attempt_outcome` via closed lookup,
never re-deriving.

**Attempt semantics (binding, C5):** an *attempt* = actual broker contact, or the read pipeline
failing before contact on `credential_unreadable`. A cache serve under the TTL or a server
throttle is NOT an attempt — `last_attempt_at` does not move. This is how a consumer distinguishes
"server chose not to ask" (throttle/cache: `last_attempt_at` unmoved) from "server asked and
failed" (`last_attempt_at` moved, `last_attempt_outcome ≠ ok`).

**Cache retention:** the TTL bounds serve-without-attempting only — it is not an eviction
deadline. On a failed attempt the server serves the last good book with its true `as_of` plus the
failure in `last_attempt_*`. The cached book is dropped only on process restart or credential
delete (delete must never leave a ghost book).

**Derived render predicates (never wire fields):**
- **degraded** := `last_attempt_outcome ≠ ok` while a snapshot serves
- **stale** := `now − as_of > stale_after_seconds` (client-derived, time-varying)

Explicitly rejected (do not re-add): a wire `stale` boolean · an FE-invented staleness threshold ·
a `refresh_seconds` cadence field (returns only with the named v2 poller, together with the
scheduled-refresh copy).

## 3. Closed vocabularies

ONE shared **failure-cause** set feeds both `last_attempt_outcome` and `unknown.reason` so they
can never drift:

> failure-cause = `broker_unreachable | rate_limited | credential_rejected | credential_unreadable | adapter_fault`

- `reason` (iff `state: unknown`) = `no_credential_stored` ∪ failure-cause — six values, closed,
  typed, never free prose.
- `last_attempt_outcome` = `ok` ∪ failure-cause.
- `credential_rejected` (broker refused the credential: expired/revoked/unapproved) is its own
  value with its own render (reauth warning + Reconnect CTA) wherever it appears — distinct from
  `broker_unreachable` and from `credential_unreadable` (server-side decrypt-fail: remedy is
  Replace, but it is OUR fault — "Webull rejected your key" copy must never render for it).

## 4. `BrokerPosition` and `BrokerLeg` record shapes

Defined against Convexa's leg-first model, not Webull's payload — a payload surprise is an adapter
mapping problem, never a port/envelope reopening. Newly-discovered broker facts land as additive
optional fields; the envelope and methods never move.

**`BrokerPosition`:**

| Field | Type | Presence / rule |
|---|---|---|
| `broker_position_id` | string (opaque, broker's own identifier) | always; stable across refreshes (diffing key) |
| `fidelity` | enum `exact \| partial \| unrecognized` | always — mapping-fidelity marker |
| `fidelity_notes` | string[] | iff `fidelity ≠ exact`; each dropped/unmapped fact named; never raw payload content |
| `legs` | `BrokerLeg[]` | always; `[]` permitted only under `fidelity: unrecognized` (the flagged opaque entry — surfaced, never silently omitted) |
| `unrealized_pl` | `BrokerFact` (§ tri-state) | always — the **additive P/L carry field**: Webull's own unrealized P/L mapped **verbatim** by the adapter; no computation, no blending with the mark ladder. `not_supplied` when the captured payload does not carry it |

A flat per-contract payload yields single-leg positions; a payload with a grouping identity yields
multi-leg positions — same shape either way (AC-6a/6b). **The adapter never composes legs into a
position by heuristic.** No strategy/structure field exists anywhere on the wire: `StructureKind`
is derived FE-side from leg shape and never stored — one authority.

**`BrokerLeg`:**

| Field | Type | Presence / rule |
|---|---|---|
| `kind` | enum `equity \| option` | always (closed) |
| `symbol` | string | always (broker instrument symbol) |
| `underlying` | string | always |
| `expiry` | string `YYYY-MM-DD` | iff `kind: option` **AND the broker supplies it** — see Amendment 1 |
| `strike` | number | iff `kind: option` **AND the broker supplies it** — see Amendment 1 |
| `right` | enum `call \| put` | iff `kind: option` **AND the broker supplies it** — see Amendment 1 |
| `quantity` | number, **signed** (short = negative; one convention, stated here once) | always |
| `multiplier` | number, explicit per-leg (never hardcoded ×100 — the positions-legs lesson) | **always when known** — see Amendment 1 |
| `cost_basis` | `BrokerFact` | always |
| `broker_mark` | `BrokerFact` | always |

**`BrokerFact` — the tri-state broker-supplied-fact pattern** (`[absent-is-not-none]` at field
level; never a bare null that collapses "Webull doesn't send this" into "zero"):

```
{ "state": "supplied" | "not_supplied" | "unparseable", "value": number }
```

`value` present iff `state: supplied`. FE render mapping: `not_supplied` → the `not provided`
literal · `unparseable` → the `unavailable` family. The **Convexa-modeled P/L** is NOT a wire
field — it is computed FE-side by the existing mark ladder off the `PositionView` projection and
is always basis-labeled as Convexa-modeled (owner ruling, decisions.md).

## 5. Credential endpoints (byo-ai-key pattern; server-gated)

Base path `/api/broker/credential`. All three sit behind the signed-in gate (anonymous ⇒ real
401/403, `[server-side-gate-enforcement]`); the session is resolved server-side from the cookie —
the body never carries identity. Write-only from the client: no response ever carries the key,
the secret, or ciphertext. Storage-unavailable ⇒ 200 `set:false, storage_available:false`, never
a 5xx. The App Key + App Secret are ONE logical record — set/replace requires both halves; they
are never independently mutable.

| Method · path | Request body | 200 response | Semantics |
|---|---|---|---|
| `GET /api/broker/credential` | — | `{ "set": boolean, "last4": string \| null, "storage_available": boolean }` | Masked-hint read. `last4` = last 4 of the **App Key** (the secret is never hinted); `null` when not set. |
| `PUT /api/broker/credential` | `{ "app_key": string, "app_secret": string }` | Success: `{ "set": true, "last4": string, "storage_available": true }` · storage-unavailable: `{ "set": false, "storage_available": false }` (both 200 — see prose above; the success shape is not the only 200) | Set/replace (rotate = overwrite ciphertext, no history). Fernet-encrypted before the store; ciphertext-only persistence; 422-class error on empty/malformed input, never echoing any fragment. |
| `DELETE /api/broker/credential` | — | `{ "set": false, "storage_available": boolean }` | Idempotent. **Also invalidates the server-side book cache for the account** — the Broker tab returns to not-connected with no ghost book (AC-3). |

Storage: the existing `UserCredentialStore` port extended with a credential-kind discriminator —
one store, never a second credential store. Decrypt-fail downstream = no-usable-credential
(`credential_unreadable`), never a leak, never a 5xx.

## 6. Book endpoints

Both signed-in + server-gated (anonymous ⇒ real 401/403). Broker-side trouble is NEVER a 5xx: a
typed `unknown` state or a `last_attempt_*` failure inside a 200 (the auth carve-out — gate
refusals are real statuses; broker faults are product states). A broker fault cannot unmount or
degrade any shared endpoint — the leaf has none.

| Method · path | 200 response | Semantics |
|---|---|---|
| `GET /api/broker/book` | `BrokerBook` (§2) | Read the book. Serves the TTL cache when fresh enough (`basis: cache`), else fetches (`basis: fresh`). No credential ⇒ `state: unknown`, `reason: no_credential_stored` — a 200 product state. |
| `POST /api/broker/book/refresh` | `BrokerBook` (§2) | **Force-fetch semantics (C4, binding):** always *requests* a fresh broker read. The server may throttle (server-authoritative, per-account — protects the owner's own broker rate limits; not the client's to bypass). Outcomes, all 200 + envelope: **fresh fetch** → `basis: fresh`, `as_of` advanced, `last_attempt_at` advanced, `last_attempt_outcome: ok` · **throttled** → cached snapshot, `basis: cache`, `last_attempt_at` UNMOVED (not an attempt) — the FE renders "unchanged and why", never a silent no-op · **attempt failed** → `last_attempt_at` advanced + failure-cause in `last_attempt_outcome`, last good book still served with its true `as_of` (or `state: unknown` if none). |

The client never controls retry aggression against the broker; there is no retry parameter.

## 7. What is deliberately NOT on this interface

- Any write/order/execution surface (no such port method exists — §1).
- Any broker field on the bundle or the SSE payload (score/tier/`state_fingerprint` byte-identical
  broker-connected vs not).
- Pagination, per-position lookup, transaction history, cash balances, multi-account aggregation.
- A cadence field, a wire `stale` boolean, or any scheduled-refresh claim (§2 rejected list).
- Durable broker-book persistence (client or server) — the book is a fetched view; the only
  durable artifact is the credential ciphertext (§5).

## Conformance spec

Environment-independent arms only, run with `--auth-signup` (a fresh throwaway account
deterministically has NO stored credential, so the book endpoints return the
`unknown`/`no_credential_stored` arm and the hint returns `set:false`). The `ok`/`empty` envelope
arms, `positions[]`/leg/tri-state shapes, `last_attempt_*` presence, degraded/stale behavior, and
the PUT/DELETE credential flows all require a stored credential (and a live or fixture broker) —
those are verified by the adapter characterization tests over captured payload fixtures and the
backend endpoint tests, not by this block. PUT/DELETE are also excluded because a conformance
sweep must not mutate credential state. **Never run this block with `--auth-cookie` against a
credentialed session:** the refresh arm would force-fetch against the owner's real Webull rate
limits — `--auth-signup` (fresh throwaway account) is the only sanctioned mode.

```json
{
  "comment": "Fresh-session (no-credential) arms only. Credential-dependent arms (state ok/empty, positions[] shapes, last_attempt_*, PUT/DELETE flows) are covered by adapter fixture tests + backend tests — see prose above.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/broker/credential",
      "auth": true,
      "required": {
        "set": "boolean",
        "last4": "string|null",
        "storage_available": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/broker/book",
      "auth": true,
      "required": {
        "state": "string",
        "reason": "string",
        "positions": "array",
        "as_of": "string?",
        "basis": "string?",
        "stale_after_seconds": "number?",
        "account_ref": "string?",
        "last_attempt_at": "string?",
        "last_attempt_outcome": "string?"
      }
    },
    {
      "method": "POST",
      "path": "/api/broker/book/refresh",
      "auth": true,
      "required": {
        "state": "string",
        "reason": "string",
        "positions": "array"
      }
    }
  ]
}
```

---

## Amendments (post-lock)

> The contract locked at GATE C (owner-approved 2026-08-01). Changes after that point are recorded
> here as numbered amendments with their evidence — never as silent edits to the tables above. The
> affected table rows point here.

### Amendment 1 (2026-08-03) — `BrokerLeg` presence under a feed that carries no contract detail

**Evidence.** The owner's real Webull capture (`CAPTURE_FINDINGS.md`; fixtures under
`apps/api/tests/fixtures/broker/`) proved `/account/positions` returns **13 generic keys for option
rows, identical to stock rows** — no `option_type`, `strike_price`, `expire_date`,
`contract_multiplier`, or `underlying_symbol`, and `symbol` is the bare underlying ticker, not an
OCC contract code. The council designed against a *flat* payload; the real payload is flat **and
anonymous**. The locked presence rules (`expiry`/`strike`/`right` = "iff `kind: option`";
`multiplier` = "always") cannot be satisfied for any real Webull option position.

**Change.**
- `expiry`, `strike`, `right`: presence becomes **"iff `kind: option` AND the broker's payload
  carries the fact; omitted otherwise — absent, never null-padded."** A position with any omitted
  option fact is `fidelity: partial`, and **each omission is named in `fidelity_notes`**.
- `multiplier`: presence becomes **"always when known — supplied by the broker, or reproduced
  exactly from broker-supplied aggregates under the guards in `RECONCILIATION_PLAN.md` §4. Omitted
  when neither holds; every multiplier-dependent output is then withheld (`not provided`), never
  defaulted to 1 or 100."**

**Scope.** Presence rules only. **No new field, no new endpoint, no method change, no envelope
change** — the `## Conformance spec` block below is untouched and still passes. `[absent-is-not-none]`
is preserved: every omission is paired with a named `fidelity_notes` entry, so "we don't know" is
never renderable as "there is nothing."

**Rejected alternative** (recorded so it isn't re-proposed): mapping every option to
`fidelity: unrecognized` + `legs: []` is legal under the *unamended* contract, but discards the
quantity, cost basis and mark Webull **does** supply — on 9 of the owner's 14 real positions. It
would report less than we honestly know.
