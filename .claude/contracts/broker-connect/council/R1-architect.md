# R1 — architect position: broker-connect

## Position

### 1. The port: `PositionsProvider`, a read-only ABC mirroring `MarketDataProvider`

A new **`PositionsProvider` port** (ABC + normalized record dataclasses/TypedDicts), the exact
structural pattern of `src/providers/base.py` and `src/auth/ports.py`: the port defines the contract,
adapters own vendor mapping, an env-selected factory picks the adapter (the `get_provider()` /
`DATA_PROVIDER` / `ACCOUNT_STORE` precedent — a `POSITIONS_PROVIDER`-style env selects `webull` today,
`snaptrade` later, plus a stub/fixture adapter for keyless verification, the `StubLLMProvider`
precedent).

**Port surface (deliberately minimal — one read, one health probe):**

- `fetch_book(credential, account_ref) -> BrokerBook` — one call returns the entire current-holdings
  snapshot. No pagination leaks through the port (the adapter absorbs paging); no per-position lookup
  method in v1 (nothing needs it, and every extra method is future coupling).
- `describe() -> ProviderCapabilities` — static facts the orchestration layer and UI honesty need:
  provider id, refresh basis it supports, whether cost basis / broker mark are supplied. This is how
  SnapTrade's different capability set arrives later without a port change.
- **There is NO write method. Not "unused" — nonexistent.** No `place_order`, no `cancel`, no
  `modify`, no generic `execute(...)` escape hatch, ever. `[no-real-order-path]` is enforced by the
  port's type surface: an adapter physically cannot be asked to write because no caller can express
  the request. Reopening that is GATE Z, and it would be *visible* — a new method on a frozen port.

**Credential is an argument, not a dependency.** The port takes an in-memory credential value object
resolved by the orchestration boundary; the broker leaf never imports the auth subpackage or any
store. This keeps both leaves one-way (precedent: byo-ai-key's per-request key resolution at the
`main.py` boundary). It is also the SnapTrade insurance: BYO App Key/Secret (Webull) and
OAuth-token-per-connection (SnapTrade) are both "an opaque credential object + an account reference"
from the port's side. The port must never encode the Webull-ism that there is exactly one implicit
account.

### 2. Normalized record content — defined against OUR leg-first model, not Webull's payload

This is the load-bearing insulation for the OPEN QUESTION (options/multi-leg payload shape
unverified until the owner's API approval lands). The port's records are defined against the model
`positions-legs` already made total, so a payload surprise is an **adapter mapping problem, never a
port reopening**:

- **`BrokerLeg`** — instrument kind (closed: equity | option), symbol/underlying, option identity
  (expiry, strike, right) when kind=option, **signed quantity** (short = negative, one convention,
  stated once), **explicit per-leg multiplier** (the `positions-legs` lesson: never hardcode ×100),
  and optional broker-supplied facts: cost basis, broker mark, each **tri-state** — supplied /
  not-supplied-by-broker / supplied-but-unparseable — never a bare null that collapses "Webull
  doesn't send this" into "zero" (`[absent-is-not-none]` at field level).
- **`BrokerPosition`** — one instrument-level holding: `leg` facts + broker's own position identifier
  (for stable diffing across refreshes) + a **mapping-fidelity marker**, closed vocabulary:
  `exact` (payload fully understood) · `partial` (position imported, some facts dropped — each drop
  named) · `unrecognized` (payload shape we could not map; the position is surfaced as a flagged
  opaque entry, never silently omitted). A book that silently drops a position it can't parse is a
  fabricated claim about the risk carried — the exact failure `[absent-is-not-none]` exists to
  prevent, one level up.
- **`BrokerBook`** — the snapshot envelope: `state` (closed enum, see §5) · `as_of` (broker fetch
  time) · `basis` (closed vocabulary for how this snapshot was obtained — on-demand fetch vs served
  from the short server cache; see §6) · `account_ref` · `positions[]` · fault reason when state is
  unknown.

**No strategy/structure field anywhere on the wire or in the records.** Grouping flat broker
positions into spreads is the FE recogniser's job — `StructureKind` is DERIVED from leg shape and
NEVER STORED (positions-legs canon). Webull almost certainly reports options per-contract flat;
even if it reports grouped, the adapter flattens to legs and the recogniser re-derives. One
authority for "what structure is this", not two.

**Payload verification without port churn:** the build lane's first task (payload capture against
the live account) produces checked-in **fixtures**; the adapter's mapping is characterization-tested
against them (the golden-fixture pattern the scoring path already uses). Adding a newly-discovered
broker fact later is an **additive optional field on a record** — the port methods and the envelope
never move.

### 3. Where the leaf lives — a one-way leaf off the trading path, composed only at the boundary

A new backend subpackage, structural sibling of `src/auth/`, `src/marketdata/`, `src/scanstore/`:
ports + normalized records, the Webull adapter, the factory, and the broker surface's own error
class. **Import rules (the structural guarantee, both directions):**

- `engine` / `signals` / `live` / `darkpool` / the bundle path / the SSE path **never import the
  broker leaf**. `main.py` is the sole orchestration boundary that mounts/composes it (the `src/auth/`
  precedent exactly).
- The broker leaf **never imports** `signals`/`engine`/`live`/scoring anything. Real positions are
  structurally incapable of reaching `opportunity_score`/`opportunity_tier`/`state_fingerprint` —
  `[additive-keeps-score-byte-identical]` holds by module boundary, provable by the existing
  characterization suite plus an empty diff on the scoring modules, and re-provable live
  (bundle byte-identical broker-connected vs not — the scanner's worker-absent/worker-present proof
  is the template).
- The Webull **SDK is imported by the Webull adapter only** — nothing else in the repo may import
  it (the vendor-SDK rule from `MarketDataProvider`). Further: the adapter imports **only the
  account/positions/quote subset** of the SDK, never its trade/order modules. This needs a statable
  violation test, not prose (a source-scan the way outcome-ledger proved its one-way leaf) — flag
  for the `structural-over-prose-enforcement` watch.

**Frontend boundary (structural only — no UI design here):** the Live tab's data module is a
domain-level unit that is **import-isolated from the sim positions store** — it never reads or
writes `convexa.positions.v3` or any `convexa.*` durable key. Sim and Live share *render* capability
through the **`PositionView` projection** (the §7x seam: a derived, in-memory, per-render
projection that both `SimPosition` and `BrokerPosition` map into), never through a shared store and
never through widening `SimPosition`. `BrokerPosition` is a NEW type beside the sim book —
`[loss-free-durable-migration]` is satisfied by **not migrating anything**: no durable key changes,
no shape changes, and the v1 rule below.

### 4. Durability rule: the broker book is a fetched view, never a durable store (v1)

The broker is the source of truth and is always re-fetchable; persisting its book creates a
consistency-and-migration liability with zero payoff. Therefore, v1:

- **Client:** no `convexa.*` key gains broker data. The book lives in memory for the session.
- **Server:** no new durable store. A short-lived **process-local cache** of the last fetched book
  (TTL-bounded, the 60s bundle-cache pattern) is permitted so a refresh storm doesn't hammer the
  broker; it resets on restart (accepted — same as the auth prototype's posture). The "stateless
  server" narrowing holds: the trading/bundle path stays stateless; broker state is a cache, not a
  record.
- The **only durable artifact** this feature creates is the credential record (§7), which rides the
  existing auth-side store.

If a later feature wants last-known-book-across-restart or broker history, that is a new,
deliberately designed store — a named seam, not scope creep here.

### 5. Unknown vs empty, in the type — `[absent-is-not-none]`

`BrokerBook.state` is a **closed enum** and the **sole disambiguator**, the `event_calendar`
pattern exactly:

- `unknown` — no successful fetch backs this response (no credential, decrypt-fail, broker
  unreachable, rate-limited with no usable cache, adapter fault). `positions` is `[]` and **means
  nothing**.
- `empty` — a successful fetch returned a confirmed-empty account. `positions` is `[]` and means
  "we checked; you hold nothing."
- `ok` — a successful fetch with holdings.

Both `unknown` and `empty` carry an empty list, so **no consumer may branch on `positions.length`**
— the state enum is authoritative, rendered by closed lookup, never re-derived (the
`digested-labels-not-raw-dump` rule applied to a state). "Your Webull account is empty" must never
be assertable about an account nobody successfully read. `unknown` carries a closed reason
vocabulary (not free prose) so the consumer can distinguish "not connected" from "connected but
failing" without parsing strings — the exact reason set is an interface decision, but *that it is
closed and typed* is architectural.

### 6. Refresh model: on-demand + TTL cache; no background poller, no MQTT (v1)

- **v1 is on-demand fetch with the short server-side TTL cache** (§4) and an explicit user-initiated
  refresh. Rationale: the consumer is one owner looking at one page; a standing poller is a second
  process-lifecycle concern (the scanner worker taught us that a background loop is its own feature
  with its own heartbeat/fairness/ops story) and buys nothing at N=1 users.
- **No MQTT / streaming, and nothing broker-derived EVER rides the SSE payload.** The SSE path is
  the live trading path; broker data on it would violate both the leaf boundary and
  `[live-vs-static-isolation]`. Non-goal, stated.
- **The as-of basis rides the data** (`as_of` + `basis` on every `BrokerBook`,
  `[model-read-carries-its-assumptions]`): a snapshot served from the TTL cache says so; a fresh
  fetch says so. Polled/fetched data is **never presentable as live** — the scanner's structural
  honesty rule ("poll-based, never 'live'") applies verbatim to this surface. How that renders is
  the UX lane's call; *that the datum carries its own basis so honest rendering is even possible*
  is mine.
- A background cadence poller and any push channel are **named deferred seams**, not v1.

### 7. Credential lifecycle — `[secret-encrypted-at-rest]` via the UserCredentialStore precedent

The owner's Webull **App Key + App Secret** are one logical credential record (both halves together
— a key without its secret is not a usable credential and must not be independently mutable):

- **Reuse the existing `UserCredentialStore` port with a credential-kind discriminator** — extend
  the one store, never fork a second credential store. The byo-ai-key Anthropic key is the shipped
  reference: Fernet symmetric encryption via the existing `src/auth/crypto.py` leaf, server-side
  encryption key, **the crypto boundary sits before the store** (no store/DB ever sees plaintext),
  **ciphertext-only persistence**.
- **Never logged, never returned in any response, never sent to the browser.** Write-only from the
  client: masked hint only (the `····last4` pattern), Replace and Delete, **no reveal**.
- **Decrypt-fail = no-usable-credential**, surfaced as `BrokerBook.state: unknown` with the
  appropriate closed reason — never an exception up any path, never a leak, never an error on a
  trading surface.
- **Per-user record, session-resolved:** the broker surface is signed-in + **server-gated**
  (`[server-side-gate-enforcement]` — the gate is at the server boundary; any FE check is UX only).
  Credential decryption happens per-request at the orchestration boundary and the plaintext lives
  only in request-scope memory.
- Rotation = Replace (a new write overwrites the ciphertext); Delete leaves the Live surface in
  `unknown / not-connected` — a deleted credential must never leave a ghost book behind (the
  server cache for that account is invalidated on delete).

### 8. Failure isolation — `[best-effort-isolated-or-null]`, with the auth-style carve-out

- **Blast radius rule: a broker failure of any kind degrades the Live surface ONLY.** Bundle, SSE,
  the sim book, scoring, the Ticker page: byte-identical, untouched. The one-way leaf (§3) makes
  this structural, not aspirational.
- **Within the broker surface itself**, the auth precedent's carve-out applies: the null-not-error
  rule governs added *bundle* computations; a dedicated stateful surface may speak real statuses.
  Concretely: auth-gate refusals are real 401/403 (`server-side-gate-enforcement`); but a *broker-side*
  failure (outage, rate limit, bad payload, decrypt-fail) is a **typed `unknown` state inside a
  successful response**, not a 5xx — the LiveTab must be able to render "couldn't reach your broker"
  as a product state, and a raised exception anywhere in adapter/mapping code is caught at the
  surface boundary and becomes `unknown` + reason.
- Rate limiting is handled server-side (throttle + TTL cache); a rate-limited moment serves the
  cached book with its honest `as_of`/`basis`, or `unknown` if there is none. The client never
  gets to decide retry aggression against the broker.

### 9. READ-ONLY absoluteness — the enforcement stack, restated as one list

1. No write method exists on the `PositionsProvider` port (§1) — unexpressable, not just unused.
2. The adapter imports only the read subset of the Webull SDK; a source-scan/violation test pins it (§3).
3. No surface this feature adds accepts any instruction destined for the broker — the only
   client-initiated broker-touching action is "fetch/refresh my book," a read.
4. No entry surface exists here at all (the `[single-shared-sim-entry-dialog]` NARROWING: a future
   real-money surface is structurally separate, and it is not this feature — non-goal).
5. Real positions never feed score/tier/gate/fingerprint (§3); they MAY feed the **reassessment/AI
   read** — that is the post-FREEZE, non-scoring prompt-context side (the personas/ai-rec boundary),
   and it changes nothing about scoring byte-identity.
6. Reopening any of this is a GATE-Z owner decision, per the `no-real-order-path` canon.

### 10. system-6 security review — the scope this feature hands the red-team

First real-account connection: the standing trigger fires. Threat-model bullets the review must cover:

- **Credential storage:** Fernet key provenance/rotation story; ciphertext-only persistence proof;
  plaintext lifetime (request-scope only, never in a long-lived object); masked-hint leak surface;
  per-user isolation of credential records; delete-really-deletes (incl. cache invalidation §7).
- **Egress:** the adapter may contact **only the fixed Webull API hosts** (an allowlist assertion,
  testable); credentials/signatures never in URLs or query strings; TLS only; Webull's
  request-signing (App Secret signs requests) computed in one place with the secret never entering
  any error message, exception string, or trace.
- **Logging:** no secret, signature material, account number, or position detail in logs at any
  default level; observability treatment of the broker surface decided deliberately (either
  uninstrumented v1 — the SSE precedent — or instrumented timing-only with an explicit redaction
  rule); the structured trace emitter must be shown to never serialize the credential object.
- **Replay & abuse:** Webull signing's timestamp/nonce handling and our clock-skew tolerance;
  refresh-action throttling so a hostile or buggy client cannot weaponize our server against the
  owner's broker rate limits (server-authoritative, per-account); session-cookie posture on the
  new gated surface is the existing HMAC-signed model — the review confirms the new surface sits
  entirely behind it.
- **Dependency:** the official Webull SDK is pinned; the review confirms the import-scope rule (§3)
  and whether the SDK's transitive behavior (telemetry, retries, endpoints) matches the egress
  allowlist.

### 11. Explicit non-goals (v1)

- No order, execution, modification, or any write to the broker — no write method exists (§9).
- No SnapTrade build — designed-for only (§1's credential-as-argument + capabilities shape is the
  design-for; zero SnapTrade code, accounts, or sandbox work).
- No background poller, no MQTT/streaming, no broker data on SSE (§6).
- No transaction history, no cash balances, no broker-reported P&L reconstruction — the book is
  current holdings only. (Balances are account facts, not leg facts — the positions-legs naming rule
  cuts the same way here. Named seam if PM wants it later.)
- No durable persistence of the broker book, client or server (§4).
- No merge/reconciliation between the sim book and the real book — two books, one projection seam.
- No universe/scanner/multi-account aggregation surface.
- No broker input to `signals`/score/tier/gate/`state_fingerprint`, ever (§3).

### 12. Binding constraints restated (the ones this lane touches)

`[no-real-order-path]` (§9, structural) · `[secret-encrypted-at-rest]` (§7) ·
`[server-side-gate-enforcement]` (§7) · `[best-effort-isolated-or-null]` (§8, with the auth carve-out) ·
`[live-vs-static-isolation]` + `[model-read-carries-its-assumptions]` (§6 — as-of/basis rides the data,
never presented live) · `[absent-is-not-none]` (§5 — closed state enum sole disambiguator, plus
field-level tri-states §2) · `[loss-free-durable-migration]` (§4 — satisfied by zero durable change;
`PositionView` is the seam) · `[single-shared-sim-entry-dialog]` narrowing (§9 — no entry surface at
all) · `[additive-keeps-score-byte-identical]` (§3 — leaf boundary + characterization fixtures +
a live connected-vs-not byte-identity proof).

## Risks I see

- **The Webull payload surprises us anyway.** The mapping-fidelity vocabulary (§2) absorbs shape
  surprises, but a *semantic* surprise (e.g., Webull reports short options with unsigned quantity +
  a side flag, or fractional-share equity positions, or a multiplier convention per exchange) could
  force a normalized-record field to change meaning, not just grow. Mitigation is the fixture-first
  build order — but the risk is real until real payloads exist, and the council should not let any
  lane commit to per-field UI/product promises before capture.
- **The SDK import-scope rule lacks an enforcement mechanism today.** "Adapter imports only the read
  subset" is prose until a source-scan test exists; `structural-over-prose-enforcement` is on the
  watch list precisely because we keep landing here. If the SDK is a monolith that can't be
  subset-imported, the fallback (direct HTTP against the read endpoints with our own signing) is a
  bigger build than planned.
- **Extending `UserCredentialStore` with a kind discriminator touches a shipped, security-reviewed
  store.** Small change, but it's the one place this feature edits existing credential code — a
  regression there leaks toward byo-ai-key. Needs its own test coverage, not just new-path coverage.
- **Cache-honesty drift:** a TTL-cached book with a stale `as_of` is honest by construction, but if
  the TTL and the refresh affordance are tuned carelessly, the practical experience is "the number
  never changes" — pressure will build to add the background poller ad hoc. Better to name the
  poller as the explicit v2 seam now than to have it appear as a "small fix."
- **Approval-shaped unknowns:** the owner's Individual OpenAPI approval may land with regional host
  differences, tighter rate limits than documented, or scopes that force flow changes. Everything
  downstream of `fetch_book` is insulated; the adapter's auth/signing layer is not.
- **Two books, one page:** the `PositionView` projection is designed to let Live and Sim share
  rendering without sharing stores — but it is also the seam most tempting to abuse (writing
  broker-derived rows *into* the sim store "just to reuse X"). The zero-durable-broker-data rule
  (§4) must survive contact with implementation convenience.

## Assumptions I'm making about the other two lanes

- **PM scopes v1 to the current-holdings snapshot only** — no transaction history, no cash/balances,
  no broker-reported P&L day-1. Falsified if PM's observables require any account-level or
  historical fact; the normalized records must then grow *before* build, not after.
- **PM keeps SnapTrade at zero code this feature** — no sandbox, no account, no OAuth flow work.
  Falsified by any SnapTrade deliverable in the PM scope.
- **PM treats the blocked Webull approval as a sequencing fact** (payload capture is build task #1;
  design proceeds now), not as a reason to ship an unverified adapter behind a flag or to invent a
  mock-only "done." Falsified if the PM's definition of done doesn't include a live payload capture.
- **PM's reassessment observable ("a reassessment request references a real holding") rides the
  existing FE-assembled reassessment flow** consuming the fetched book — no new backend
  scoring/eval surface for real positions. Falsified if PM expects `position_eval`-style server
  evaluation of broker positions in v1.
- **UX renders unknown-book vs confirmed-empty-book as two visually distinct states driven by the
  wire state enum via closed lookup** — never derived from list emptiness. Falsified by any design
  where an unconnected/failed account can read as "no positions."
- **UX stamps the Live tab with the snapshot's as-of/basis and offers an explicit refresh** — and
  never uses "live" language on fetched/cached data (the scanner precedent). Falsified by any
  auto-updating or "live"-labeled treatment of the polled book.
- **UX's broker-outage treatment degrades only the Live surface** — the Simulated tab, Ticker page,
  and everything else render exactly as they do today during a broker failure. Falsified by any
  design that shares a loading/error boundary between Live and Sim.
- **UX's credential surface is write-only with a masked hint, Replace/Delete, no reveal** — the AI-key
  Settings section pattern. Falsified by any reveal, echo-back, or client-side retention of the
  secret.
- **Neither lane places any order/close/trade affordance on or near the Live tab** — not even a
  disabled or "coming soon" control that implies execution. Falsified by any such affordance in the
  UX spec or PM scope.
