# broker-connect Implementation Plan

> **For agentic workers (lanes):** this plan is executed by the delivery pipeline — the
> `delivery-backend` lane owns the BACKEND track, the `delivery-frontend` lane owns the FRONTEND
> track, the conductor + `qa-verify` own the VERIFICATION track. Steps use checkbox (`- [ ]`)
> syntax for tracking. Each lane reads its own track plus **Global Constraints** (binding on every
> task) and the **Sequencing** section. Where this plan and `SPEC.md` / `INTERFACE_CONTRACT.md`
> appear to differ, the contracts win and the divergence is a GATE Z bounce — never a silent edit.

**Goal:** Convexa reads the owner's real Webull positions — read-only, absolutely — into the
Positions page's **Broker** tab, behind a new `PositionsProvider` port, with credentials in the
existing encrypted store, an honest as-of/basis envelope, and a Convexa-modeled P/L driven by the
existing mark ladder.

**Architecture:** A new one-way-leaf backend subpackage `apps/api/src/broker/` (structural sibling
of `src/auth/`, `src/marketdata/`) holds a two-method read-only ABC (`fetch_book`, `describe` — NO
write method exists), an env-selected factory (`POSITIONS_PROVIDER`: `webull` | `stub`), a
process-local TTL book cache with C5 attempt semantics, and the Webull adapter mapping vendor
payloads into OUR leg-first records. Credentials extend `UserCredentialStore` with a kind
discriminator (one store, never a fork); the credential is resolved per-request at the `main.py`
boundary and passed as an in-memory value object — the leaf never imports auth. The FE builds a
new import-isolated broker data module, a closed S1–S9 render-state lookup, and projects broker
legs through the `PositionView` seam into the existing `mark.ts` ladder for the modeled P/L, with
two independent degradation axes.

**Tech Stack:** FastAPI + Python 3.12 (`apps/api`, own `.venv`, `nx test api` = pytest) · official
Webull Python SDK (read subset only, pinned) · Fernet via `src/auth/crypto.py` · React 19 + MUI +
Vite (`apps/dashboard`) · Vitest + Testing Library (`npx nx test @org/dashboard`) · Playwright
(`apps/dashboard-e2e`) · `@org/api` shared TS client (consumed as source).

---

## Global Constraints

Every task's requirements implicitly include this section.

**Contracts of record:** `.claude/contracts/broker-connect/SPEC.md` (LOCKED — the 23 ACs are the
definition of done) and `.claude/contracts/broker-connect/INTERFACE_CONTRACT.md` (LOCKED — the
FE↔BE wire truth). `council/decisions.md` is the rationale record; nothing in this plan may
contradict it. **A needed change to the interface during build is a GATE Z amendment routed
through the conductor — never a silent edit.**

**Named non-goals — do not smuggle these in, in any form:** any order/execution/write path to the
broker (no port method, no disabled button, no "coming soon" copy) · multi-leg order surfaces ·
the SnapTrade adapter (designed-for at the port, zero code) · a background poller / cadence wire
field / scheduled-refresh copy (returns only with the named v2 poller, together) · durable broker
persistence client or server (no `convexa.*` key gains broker data; server side is a short-TTL
process-local cache) · broker data on SSE · real-book outcomes in the ledger · real positions as
a scoring input (permanent) · heuristic composition of flat rows into strategies.

**Invariant watch (BRIEF, binding):** `[no-real-order-path]` (formalize the narrowing "read real
positions OK, no real order execution" at GATE S) · **system-6 security red-team FIRES HERE**
(first real-account connection — planned as task V5, performed by a FRESH session at GATE Q) ·
`[secret-encrypted-at-rest]` (Webull App Key/Secret: Fernet ciphertext-only via
`UserCredentialStore`, never logged/returned/browser-sent, masked hint + rotate/delete) ·
`[server-side-gate-enforcement]` (all five broker endpoints signed-in + server-gated; FE checks
are UX only) · `[best-effort-isolated-or-null]` (broker faults degrade the Broker tab ONLY; auth
carve-out: gate refusals are real 401/403, broker faults are typed states inside a 200) ·
`[live-vs-static-isolation]` + `[model-read-carries-its-assumptions]` (every broker datum carries
`as_of`/`basis`/`stale_after_seconds`; polled data never presented as live; every P/L figure names
its basis) · `[absent-is-not-none]` (closed `state` enum is the sole unknown-vs-empty
disambiguator; tri-state broker facts; `not provided` at the render) ·
`[loss-free-durable-migration]` (satisfied by migrating nothing durable — `BrokerPosition` is a
NEW type beside the sim book; `PositionView` is the seam) · `[single-shared-sim-entry-dialog]`
(narrowed: nothing on this surface opens or references `TradeEntryDialog` in any mode) ·
`[additive-keeps-score-byte-identical]` (score/tier/`state_fingerprint` byte-identical with and
without a connected broker) · `[theme-token-discipline]` (no new tokens, zero hex) ·
`[digested-labels-not-raw-dump]` (wire enums authoritative, closed FE lookup, never re-derived).

**Baselines to hold (ratchet up as tasks land — compare against the current figure, record the
new number at the end of every task):**

| Suite | Baseline | Command |
|---|---|---|
| FE unit (Vitest) | **1104 tests / 99 files** + new | `npx nx test @org/dashboard` |
| BE unit (pytest) | current-green + new (record the count before B2) | `nx test api` |
| e2e (Playwright) | **33** + new | `npx nx e2e dashboard-e2e` (needs `npx playwright install chromium`) |
| Lint | **0 errors / 0 warnings** | `npx nx run-many -t lint` |
| Typecheck | **0 errors** | `npx nx run-many -t typecheck` |
| Build | no >500 kB chunk warning | `npx nx build dashboard` |
| Scoring path | `apps/api` scoring modules untouched; score/tier/fingerprint fixtures byte-identical (task V2) | `nx test api` (characterization suite) |

**CLAUDE.md traps (read them; the expensive ones here):** run `npx nx typecheck` before claiming
green — Vitest transpiles without typechecking · check EXIT CODES, not printed summaries · never
a bare `nx format:write` — always `--files` scoped · `npm run ports:free` before any
run-the-app verification (orphaned uvicorn/Vite serve STALE code) · NUL bytes make a file binary
to git/grep — **byte-scan every checked-in fixture**:
`py -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` must print `0`.

**Testing is risk-based** (qa-verify §4, SPEC §7): automate the invariants and negative space
that can silently regress; verify visible intentional presence/wording by review. Not
one-test-per-AC. SPEC §3's `Verify by` column is the assignment of record; the per-AC matrix in
the VERIFICATION track maps it to concrete tasks — respect it, do not re-derive it.

**Credential hygiene during build (binding on every task):** the owner's real Webull App
Key/Secret exist ONLY in the owner's shell session environment during task B1's capture run and
ONLY in the encrypted store at runtime. They are NEVER written to any file — `.env` included —
never committed, never echoed into a terminal transcript the lane persists, never pasted into a
contract, log, fixture, or test. Checked-in fixtures are sanitized (task B1). No test may require
real credentials to pass (`stub` provider + fixtures cover CI).

### Conformance spec

Copied **verbatim** from `.claude/contracts/broker-connect/INTERFACE_CONTRACT.md` — both lanes
inherit this as the binding wire shape:

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

Run it with:

```
apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py \
  --contract .claude/contracts/broker-connect/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:8000 --auth-signup
```

**`--auth-signup` is the ONLY sanctioned mode for this block.** A fresh throwaway account
deterministically has no stored credential, so the book endpoints return the
`unknown`/`no_credential_stored` arm. **Never run it with `--auth-cookie` against a credentialed
session** — the refresh arm would force-fetch against the owner's real Webull rate limits.
PUT/DELETE are excluded because a conformance sweep must not mutate credential state.

---

## File map

**BACKEND — create:** `apps/api/src/broker/__init__.py` (factory) · `apps/api/src/broker/ports.py`
(ABC + records) · `apps/api/src/broker/stub.py` · `apps/api/src/broker/webull_adapter.py` ·
`apps/api/src/broker/service.py` (cache + attempt semantics + envelope assembly) ·
`apps/api/tests/capture_broker_fixtures.py` · `apps/api/tests/fixtures/broker/*.json` ·
`apps/api/tests/test_broker_records.py` · `apps/api/tests/test_broker_credential_endpoints.py` ·
`apps/api/tests/test_broker_book_endpoints.py` · `apps/api/tests/test_broker_adapter.py` ·
`apps/api/tests/test_broker_isolation.py`.
**BACKEND — modify:** `apps/api/src/auth/ports.py` (kind discriminator, additive) ·
`apps/api/src/auth/sqlite_store.py` · `apps/api/src/auth/postgres_store.py` ·
`apps/api/src/auth/service.py` + `apps/api/src/auth/router.py` (broker credential trio) ·
`apps/api/main.py` (book endpoints + per-request credential resolution) ·
`apps/api/requirements.txt` (pinned Webull SDK read packages).

**FRONTEND — create:** `libs/api/src/lib/broker.ts` (+ export in `libs/api/src/index.ts`) ·
`apps/dashboard/src/app/features/trading/broker/` — `renderState.ts`, `predicates.ts`,
`fixtures.ts`, `useBrokerBook.ts`, `brokerView.ts`, `copy.ts`, `BrokerTabPanel.tsx`,
`ProvenanceHeader.tsx`, `BrokerPositionRow.tsx`, `BrokerPositionCard.tsx`, specs beside each ·
`apps/dashboard/src/app/features/auth/BrokerageSection.tsx` (+ spec) ·
`apps/dashboard-e2e/src/e2e/broker.spec.ts`.
**FRONTEND — modify:** `apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx`
(tab label → `Broker`, panel swap) · `positions/view.ts` (broker projection entry — the seam
change its own doc invites) · `positions/labels.ts` (retire LOCKED copy, add `not provided`
literal if the vocabulary lives here) · `features/auth/SettingsPage.tsx` (`#brokerage` section) ·
`positions/positions.risk.spec.tsx` (the LiveTabPanel inert-by-construction test is SUPERSEDED —
replaced by the broker negative-space suite, never silently deleted).
**FRONTEND — delete:** `positions/LiveTabPanel.tsx` (the LOCKED placeholder it replaces).

---

## Sequencing and critical path

```
B1 capture (BLOCKING gate for adapter truth) ─┬─> B4 Webull adapter ──> B5(live arm) ─> B6 ─┐
                                              └─> owner decisions (6b fallback, AC-22)      │
B2 leaf skeleton + records + stub ──┬─> B5 book service/endpoints (stub-backed first) ───────┤
B3 credential kind + endpoints ─────┘                                                        ├─> GATE Q
F1 typed client ─> F2 state module ─┬─> F4 Broker tab UI ─> F6 reassess ─> F7/F8 tests+e2e ──┤   (V1–V4, V6;
              └──> F3 projection ───┘   F5 Settings section (needs F1 only, parallel) ───────┘    V5 fresh
                                                                                                  session)
```

- **B1 is build task #1 and the only cross-track blocker.** It blocks B4 (adapter mapping), the
  AC-6b test arm, and two named owner decisions. It does NOT block B2/B3/B5(stub)/F1–F5: the
  INTERFACE_CONTRACT is the shared truth and FE fixtures are written against it, not against
  Webull.
- FE builds all nine states against typed-envelope fixtures while the adapter lands. After B1,
  F2/F3 fixtures gain the capture-derived arms (multi-leg grouping present-or-flat,
  `unrealized_pl` supplied-or-not) — a fixture extension, not a rework.
- Parallelizable: **B2 ∥ B3** · **B1 ∥ (B2+B3)** · **F1→F2 ∥ F3** · **F4 ∥ F5** · the whole FE
  track ∥ the whole BE track (join at F8 integration against the real server and at GATE Q).
- Sequential (hard deps): B1→B4 · (B2,B3)→B5 · B4→B5-live-arm · (B2..B5)→B6 · F1→(F2,F3) ·
  (F2,F3)→F4 · F4→(F6,F7,F8).

---

# BACKEND track (`delivery-backend`)

### Task B1 — Webull payload CAPTURE (build task #1; blocking; owner-present)

**Files:**
- Create: `apps/api/tests/capture_broker_fixtures.py` (standalone script, stdlib + Webull SDK only)
- Create: `apps/api/tests/fixtures/broker/positions_raw.json`, `account_raw.json`,
  `error_bad_credential.json`, `rate_limit_headers.json` (sanitized — see steps)
- Create: `.claude/contracts/broker-connect/CAPTURE_FINDINGS.md`

**Interfaces:**
- Consumes: nothing in-repo (runs before the adapter exists).
- Produces: the checked-in sanitized fixtures B4's characterization tests bind to, and
  `CAPTURE_FINDINGS.md` — the factual record the conductor routes owner decisions on.

**Credential rule (binding, restated):** the owner's App Key + App Secret come from the OWNER'S
SHELL SESSION ENVIRONMENT for this one run — the owner exports `WEBULL_APP_KEY` and
`WEBULL_APP_SECRET` in the terminal; the script reads `os.environ` only. **They are NEVER written
to any file (`.env` included), never committed, never printed.** The script must refuse to run if
either var is absent, and must never echo either value in any error path.

- [ ] **Step 1:** Write `capture_broker_fixtures.py`: reads the two env vars, calls the SDK's
  account + positions read endpoints, deliberately makes one call with a corrupted key (to capture
  the bad-credential error shape), and records response headers (rate-limit fields). Raw responses
  land in a **gitignored** scratch path first (`apps/api/tests/fixtures/broker/_raw_scratch/`,
  added to `.gitignore` in the same commit).
- [ ] **Step 2:** Owner runs it live (one run): `cd apps/api; $env:WEBULL_APP_KEY='…';
  $env:WEBULL_APP_SECRET='…'; .venv/Scripts/python.exe tests/capture_broker_fixtures.py` — then
  closes that shell (the export dies with the session).
- [ ] **Step 3:** Sanitize into the checked-in fixtures: replace the real account number and any
  account-identifying value with the fixed placeholder `"ACCT_REDACTED"`; keep every structural
  key, enum value, and numeric shape intact; keep at least one options position verbatim in shape.
  No key/secret/signature material may appear anywhere in a fixture.
- [ ] **Step 4:** Byte-scan every fixture for NULs (`…read().count(bytes([0]))` → `0`) and verify
  `git diff` renders them as text, not "Binary files differ".
- [ ] **Step 5:** Write `CAPTURE_FINDINGS.md` answering, with payload evidence: **(a)** does the
  positions payload carry a grouping identity for multi-leg options positions (field name + sample),
  or is it flat per-contract? **(b)** the account payload shape and which value is the account
  identifier (for `account_ref` hashing); **(c)** the bad-credential error shape (status/code/body)
  and how it is distinguished from outage; **(d)** rate-limit headers/thresholds observed; **(e)**
  does Webull supply its own unrealized P/L (field + sample)? **(f)** the exact SDK packages +
  modules the read path needs (for the B4 pin and the import-scope test).
- [ ] **Step 6 (routing, not a lane decision):** report findings to the conductor. **If (a) is
  flat/no-grouping-identity: the grouped-rendering fallback (visual grouping by underlying+expiry
  vs honest flat rows) is a NAMED POST-CAPTURE OWNER DECISION — the conductor presents it to the
  owner and records the ruling (SPEC §9.2); neither lane defaults it.** Likewise (e) routes the
  AC-22 render question. Done-condition: fixtures + findings committed, decisions routed, scratch
  dir empty.

### Task B2 — broker leaf skeleton: records, port, stub adapter, factory  *(parallel with B3)*

**Files:**
- Create: `apps/api/src/broker/__init__.py`, `apps/api/src/broker/ports.py`,
  `apps/api/src/broker/stub.py`
- Test: `apps/api/tests/test_broker_records.py`

**Interfaces:**
- Consumes: stdlib ONLY (`ports.py` mirrors `src/auth/ports.py`'s leaf discipline).
- Produces (binding names for B4/B5): dataclasses `BrokerFact(state: Literal["supplied",
  "not_supplied","unparseable"], value: float | None)` · `BrokerLeg(kind, symbol, underlying,
  expiry, strike, right, quantity, multiplier, cost_basis: BrokerFact, broker_mark: BrokerFact)`
  (quantity SIGNED, multiplier explicit) · `BrokerPosition(broker_position_id, fidelity:
  Literal["exact","partial","unrecognized"], fidelity_notes: list[str], legs: list[BrokerLeg],
  unrealized_pl: BrokerFact)` · `BrokerBook(state: Literal["ok","empty","unknown"], reason,
  as_of, basis, stale_after_seconds, account_ref, positions, last_attempt_at,
  last_attempt_outcome)` with a `to_wire() -> dict` that emits EXACTLY the INTERFACE_CONTRACT §2
  presence rules (absent means absent, never null-padded) · `BrokerCredential(app_key, app_secret)`
  frozen dataclass with `__repr__`/`__str__` overridden to `"BrokerCredential(masked)"` (never
  serializable into a trace) · `ProviderCapabilities(provider_id, refresh_basis,
  supplies_cost_basis, supplies_broker_mark, supplies_unrealized_pl)` ·
  `class PositionsProvider(ABC)` with EXACTLY `fetch_book(credential: BrokerCredential,
  account_ref: str | None) -> BrokerBook` and `describe() -> ProviderCapabilities` ·
  `get_positions_provider(name: str | None = None)` env factory on `POSITIONS_PROVIDER`
  (default `webull`, plus `stub`; `snaptrade` reserved — a raise, no code).

- [ ] **Step 1:** Write failing tests in `test_broker_records.py`: `to_wire()` presence rules
  (unknown ⇒ no `as_of`/`basis`/`stale_after_seconds`; empty and unknown both carry
  `positions: []`; `reason` iff unknown; `last_attempt_outcome` iff `last_attempt_at`) · the port
  type surface has NO write method (`assert not any(m in dir(PositionsProvider) for m in
  ("place_order","cancel","modify","execute"))` plus: its abstractmethods set ==
  `{"fetch_book","describe"}`) · `repr(BrokerCredential(...))` contains neither input string ·
  factory raises on unknown name, returns `StubProvider` for `stub`.
- [ ] **Step 2:** Run `nx test api` — new tests FAIL (module absent). Implement `ports.py`,
  `stub.py` (stub returns a deterministic `ok` book with one equity + one two-leg options
  position, one `empty`, switchable via `STUB_BROKER_BOOK` env for verification), `__init__.py`.
- [ ] **Step 3:** `nx test api` green (baseline + new); `echo $?` → 0. Commit.

### Task B3 — credential-kind discriminator + `/api/broker/credential` trio  *(parallel with B2)*

**Files:**
- Modify: `apps/api/src/auth/ports.py` (additive `kind` param, default `"ai"` — existing call
  sites unchanged), `sqlite_store.py`, `postgres_store.py`, `service.py`, `router.py`
- Test: `apps/api/tests/test_broker_credential_endpoints.py`

**Interfaces:**
- Consumes: `UserCredentialStore` (existing), `crypto.encrypt/decrypt` (existing).
- Produces: kind constant `CREDENTIAL_KIND_BROKER = "broker_webull"` · service methods
  `broker_credential_hint(user) -> {set, last4, storage_available}` ·
  `set_broker_credential(user, app_key, app_secret)` (plaintext blob =
  `json.dumps({"app_key":…, "app_secret":…})` → ONE Fernet ciphertext; `last4 = app_key[-4:]`;
  both halves or 422 — never one) · `delete_broker_credential(user)` (idempotent; MUST call the
  B5 cache-invalidation hook) · `get_decrypted_broker_credential(user_id) -> tuple[str,str] |
  None` (server-side only, `main.py`'s resolver; decrypt-fail ⇒ `None`, never raises) · routes
  `GET/PUT/DELETE /api/broker/credential` per INTERFACE_CONTRACT §5, mirroring the ai-key trio at
  `router.py:205-246`.

- [ ] **Step 1:** Failing tests: anonymous ⇒ 401/403 on all three (AC-4 arm) · PUT with both
  halves ⇒ `{set:true, last4:<app_key last4>, storage_available:true}` · PUT missing/empty either
  half ⇒ 422 with a body that echoes NO fragment of either input · GET after PUT ⇒ masked hint
  only; assert the full response text contains neither plaintext · rotate = overwrite (second PUT
  changes last4, store holds one record) · DELETE idempotent ⇒ `{set:false, storage_available}` ·
  storage-unavailable ⇒ 200 `{set:false, storage_available:false}` · the EXISTING ai-key tests
  still pass byte-identical (the discriminator must not disturb kind="ai" rows).
- [ ] **Step 2:** Implement: `CredentialRecord` gains `kind: str = "ai"`; store methods gain the
  `kind` keyword; adapters key rows on `(user_id, kind)`; service + router per Produces.
- [ ] **Step 3:** `nx test api` green, exit 0. Log-scan assertion: capture logging output in the
  PUT test and assert neither half nor ciphertext appears (AC-5 arm). Commit.

### Task B4 — Webull adapter  *(blocked by B1 + B2)*

**Files:**
- Create: `apps/api/src/broker/webull_adapter.py`
- Modify: `apps/api/requirements.txt` (pin the exact SDK read packages named in
  `CAPTURE_FINDINGS.md` §(f) — account/positions/quote read subset only, never trade/order
  modules)
- Test: `apps/api/tests/test_broker_adapter.py` (characterization over B1 fixtures — the
  golden-fixture pattern the scoring path uses)

**Interfaces:**
- Consumes: B2's records + `PositionsProvider`; B1's sanitized fixtures; the pinned SDK.
- Produces: `WebullProvider(PositionsProvider)` — maps the captured payload shape into
  `BrokerBook`; absorbs vendor paging inside `fetch_book` (pagination never crosses the port);
  maps errors to the closed failure-cause set (bad credential shape from fixtures ⇒
  `credential_rejected`; network/timeout ⇒ `broker_unreachable`; vendor throttle ⇒ `rate_limited`;
  any mapping exception ⇒ caught, `adapter_fault` or per-position `fidelity: partial|unrecognized`
  with `fidelity_notes` naming the dropped fact, never raw payload content). `account_ref` =
  non-reversible keyed hash (HMAC-SHA256 over the account identifier with the server session
  secret, hex-truncated to 16) — NEVER the raw account number.

- [ ] **Step 1:** Failing characterization tests bound to the fixtures: every position in
  `positions_raw.json` appears in the mapped book (count never understates — the AC-6a test-arm
  anchor) · signed quantity (short ⇒ negative) · explicit per-leg multiplier (never hardcoded
  ×100) · tri-state facts (`not_supplied` when the payload lacks the field; `unparseable` on a
  malformed value — corrupt one fixture copy in-test) · multi-leg mapping per the capture truth:
  if grouping identity exists ⇒ one position with N legs; if flat ⇒ one single-leg position per
  contract and NO composition (assert no two fixture contracts land in one position) — the AC-6b
  test arm · unrepresentable entry ⇒ `fidelity: unrecognized`, `legs: []`, surfaced not dropped ·
  error fixtures ⇒ the mapped failure causes above · `unrealized_pl` carried verbatim iff the
  payload supplies it, else `not_supplied` (never computed).
- [ ] **Step 2:** Implement the adapter; run `nx test api` green, exit 0.
- [ ] **Step 3:** Import hygiene proof lands in B6 (source scan); here just keep all SDK imports
  inside `webull_adapter.py`. Commit.

### Task B5 — book service, cache/attempt semantics, `/api/broker/book` + `/refresh`  *(blocked by B2+B3; runs stub-backed until B4 lands)*

**Files:**
- Create: `apps/api/src/broker/service.py`
- Modify: `apps/api/main.py` (two routes + per-request credential resolution, mirroring the
  byo-ai-key resolution at `main.py:856-866`)
- Test: `apps/api/tests/test_broker_book_endpoints.py`

**Interfaces:**
- Consumes: B2 factory/records, B3 resolver (`get_decrypted_broker_credential`).
- Produces: `BrokerBookService` — per-user process-local cache `dict[user_id, CachedBook]`
  (keyed on the opaque server user id, NEVER email/account number — the AC-23 backend boundary);
  policy knobs (env, server-owned): `BROKER_BOOK_TTL_SECONDS` default `60` (serve-without-attempt
  bound only — NOT eviction), `BROKER_STALE_AFTER_SECONDS` default `300` (rides every served
  snapshot), `BROKER_REFRESH_MIN_INTERVAL_SECONDS` default `15` (the refresh throttle) ·
  `get_book(user) -> BrokerBook` and `refresh_book(user) -> BrokerBook` implementing
  INTERFACE_CONTRACT §6 exactly · `invalidate(user_id)` (called by B3's delete — no ghost book) ·
  routes `GET /api/broker/book`, `POST /api/broker/book/refresh` in `main.py`: resolve session
  (anonymous ⇒ real 401/403), resolve credential ⇒ `BrokerCredential` VO or the
  `no_credential_stored` / `credential_unreadable` arms, call the service, return
  `book.to_wire()`. Broker-side trouble is NEVER a 5xx.

- [ ] **Step 1:** Failing tests (stub-backed + a `FailingProvider` test double):
  **C5 attempt semantics** — cache-serve within TTL ⇒ `basis: cache`, `last_attempt_at` UNMOVED;
  refresh ⇒ force-fetch: fresh ⇒ `basis: fresh`, `as_of` + `last_attempt_at` advanced,
  outcome `ok`; throttled (two refreshes inside the min interval) ⇒ cached snapshot,
  `last_attempt_at` UNMOVED; failed attempt ⇒ `last_attempt_at` advanced + failure cause, last
  good book still served with its TRUE (old) `as_of` · **cache retention** — a failed attempt
  never evicts; restart (new service instance) ⇒ no book, `state: unknown` · **delete
  invalidation** — DELETE credential then GET book ⇒ `unknown`/`no_credential_stored`, no field of
  the old book present (AC-3) · **decrypt-fail** — corrupt ciphertext ⇒ 200,
  `credential_unreadable`, response text never contains "rejected"/"Webull rejected" and no
  key material (AC-5/13 arm) · **gate** — anonymous ⇒ 401/403 on both routes (AC-4) ·
  **per-user isolation** — two signed-in users: user A stores a credential and fetches; user B ⇒
  `unknown`/`no_credential_stored` and the serialized response shares NO `account_ref`/`last4`/
  position field with A's (the AC-23 automated arm) · **never-5xx** — a provider that raises ⇒
  200 `adapter_fault`.
- [ ] **Step 2:** Implement service + routes. The broker leaf still imports no auth module —
  `main.py` does the resolution and hands the VO in.
- [ ] **Step 3:** `nx test api` green, exit 0. Boot the app with `POSITIONS_PROVIDER=stub`
  (dummy-key boot per memory), hit both endpoints signed-in via `--auth-signup` conformance run —
  the Global Constraints block passes. `npm run ports:free` first. Commit.

### Task B6 — structural isolation proofs  *(after B2–B5)*

**Files:**
- Test: `apps/api/tests/test_broker_isolation.py`

**Interfaces:** consumes everything landed; produces the source-scan + byte-identity proofs GATE Q
relies on.

- [ ] **Step 1:** Source-scan tests (the outcome-ledger one-way-leaf proof pattern):
  **(a)** no module outside `src/broker/webull_adapter.py` imports the Webull SDK, and the
  adapter's SDK imports ⊆ the read subset named in `CAPTURE_FINDINGS.md` §(f) (deny-list:
  any module path containing `trade`/`order`/`place`) — AC-15's port-level arm ·
  **(b)** `src/broker/**` never imports `core.engine|core.signals|core.live|core.darkpool|
  chain_store` or the bundle path, and none of those import `src/broker` — both directions ·
  **(c)** `src/broker/ports.py` imports stdlib only.
- [ ] **Step 2:** Scoring byte-identity (AC-17 automated arm): run the existing scoring
  characterization suite — fixtures byte-identical (`[additive-keeps-score-byte-identical]`
  checked on every push); plus assert `git diff --stat` over `src/core/ src/providers/` empty of
  this feature's commits (an empty-diff proof, recorded in the task report).
- [ ] **Step 3:** Full `nx test api` + conformance `--auth-signup` green, exit codes checked.
  Record new pytest count in the baseline table. Commit.

---

# FRONTEND track (`delivery-frontend`)

**Lane directive (memory):** load `vercel-react-best-practices`, `composition-patterns`,
`webapp-testing`, `web-design-guidelines`, and `convexa-design` before building UI.

### Task F1 — typed client in `@org/api`

**Files:**
- Create: `libs/api/src/lib/broker.ts` · Modify: `libs/api/src/index.ts` (export)

**Interfaces:**
- Consumes: INTERFACE_CONTRACT §§2–6 verbatim.
- Produces (binding names for F2–F6): types `BrokerFact`, `BrokerLeg`, `BrokerPosition`,
  `BrokerBookState = 'ok'|'empty'|'unknown'`, `BrokerFailureCause = 'broker_unreachable'|
  'rate_limited'|'credential_rejected'|'credential_unreadable'|'adapter_fault'`,
  `BrokerReason = 'no_credential_stored' | BrokerFailureCause`, `BrokerBook` (optional fields
  typed `?`, mirroring wire absence), `BrokerCredentialHint = { set: boolean; last4: string|null;
  storage_available: boolean }` · functions `fetchBrokerCredential()`, `putBrokerCredential(body:
  {app_key: string; app_secret: string})`, `deleteBrokerCredential()`, `fetchBrokerBook()`,
  `refreshBrokerBook()` — same fetch/error grammar as the existing client functions in `libs/api`.

- [ ] **Step 1:** Write the module + export; `npx nx run-many -t typecheck` clean. No new runtime
  logic beyond the fetch wrappers ⇒ covered by F2+ consumers' tests. Commit.

### Task F2 — broker data module: closed render-state lookup, predicates, fixtures, hook  *(after F1; parallel with F3)*

**Files:**
- Create: `features/trading/broker/renderState.ts`, `predicates.ts`, `fixtures.ts`,
  `useBrokerBook.ts` + specs `renderState.spec.ts`, `predicates.spec.ts`, `useBrokerBook.spec.tsx`

**Interfaces:**
- Consumes: F1 types.
- Produces: `type BrokerRenderState = 'S1_never_connected'|'S2_pending_first_sync'|'S3_ok'|
  'S4_empty_confirmed'|'S5_unknown'|'S7_degraded'|'S8_reauth'|'S9_cold_skeleton'` plus modifier
  `isStale: boolean` (S6 is a modifier on S3/S4, never a state of its own) and
  `warn: 'credential_rejected'|'credential_unreadable'|null` ·
  `resolveRenderState(input: { book: BrokerBook | null; hintSet: boolean | null; inFlight:
  boolean; firstFetch: boolean; nowMs: number }): BrokerRender` — a PURE TOTAL FUNCTION (SPEC §4
  precedence I-2): `credential_rejected` ⇒ S8 and `credential_unreadable` ⇒ its own warning-class
  render WHEREVER they appear (reason or `last_attempt_outcome`); S5 matches only
  `broker_unreachable|rate_limited|adapter_fault`; S7 requires a served snapshot
  (`state ∈ {ok, empty}`); **`positions.length` is never an input to any branch** ·
  `isStale(book, nowMs)` := `now − as_of > stale_after_seconds` · `isDegraded(book)` :=
  `last_attempt_outcome !== 'ok'` while a snapshot serves · `useBrokerBook()` — on-open fetch,
  `refresh()` returning `{advanced: boolean, throttled: boolean, failed: BrokerFailureCause|null}`
  for the AC-8 note, hint query via `fetchBrokerCredential` (S2's "credential stored" knowledge) ·
  `fixtures.ts` — one fixture per wire arm: all six reasons, ok/empty/unknown, every
  `last_attempt_outcome`, fresh/cache basis, stale-aged `as_of`, plus (post-B1) the
  capture-derived multi-leg/flat and `unrealized_pl` arms.

- [ ] **Step 1:** Failing unit tests: enumerate the full input product (3 states × 7
  reason/outcome values × snapshot-present × stale) and assert exactly one render per tuple
  (totality + the precedence table) · `state: unknown` with a contrived NON-empty `positions`
  array still renders S5, and `state: empty` with `[]` renders S4 — proof no branch reads length
  (AC-10) · stale derivation boundary cases (exactly at threshold ⇒ not stale) · refresh outcome
  mapping (fresh ⇒ advanced, cache+unmoved `last_attempt_at` ⇒ throttled, moved+failure ⇒ failed).
- [ ] **Step 2:** Implement; `npx nx test @org/dashboard` green + `typecheck` clean. Commit.

### Task F3 — broker projection through the mark ladder (`PositionView` seam)  *(after F1; parallel with F2)*

**Files:**
- Create: `features/trading/broker/brokerView.ts` + `brokerView.spec.ts`
- Modify: `features/trading/positions/view.ts` (the seam file — its own doc: "a change to THIS
  FILE, not a component reaching past the boundary")

**Interfaces:**
- Consumes: F1 `BrokerPosition`/`BrokerLeg`; existing `computeMark`/`MarkResult` (`model/mark.ts`),
  `composePositionMark`, `structureKindOf`, `buildPositionView` internals.
- Produces: `buildBrokerPositionView(args: { position: BrokerPosition; legMarks:
  ReadonlyMap<string, MarkResult | null>; dte: number | null; nowMs: number }): PositionView` —
  `PositionView` gains an additive discriminator `origin: 'sim' | 'broker'` (the existing sim
  builder emits `'sim'`; every other sim field DEEP-EQUAL to before — the existing `view.spec.ts`
  assertions change only by the additive field) · leg mapping: signed `quantity` ⇒
  `side_word` (`Long`/`Short`) + absolute size; explicit `multiplier` honored (never ×100
  hardcoded); `StructureKind` derived FE-side via the existing recogniser over mapped legs — never
  read from the wire · tri-state render vocabulary: `not_supplied` ⇒ the NEW fifth literal
  **`not provided`** (exported constant `NOT_PROVIDED = 'not provided'` beside `NOT_RECORDED` —
  two different truths, never one literal for the other); `unparseable` ⇒ the shipped
  `unavailable` family · modeled P/L: `pl_dollar` from the mark ladder off broker legs (cost basis
  from `cost_basis` facts where supplied; where `not_supplied`, `pl_pct`/entry-derived fields go
  to their withheld states — never 0) · `fidelity !== 'exact'` ⇒ the cannot-fully-display
  projection (renders in F4; the view carries `fidelity` + `fidelity_notes` through) · dual-basis
  label inputs: the view exposes `modeled_label: 'single' | 'dual'` derived from
  snapshot-staleness so F4 renders `modeled now · on your book as of {time}` without re-deriving.
- **Hard constraints:** `SimPosition` is NOT widened; the broker module never imports
  `positions/store.ts` or reads/writes `convexa.positions.v3` or ANY `convexa.*` durable key;
  broker rows are never written anywhere durable.

- [ ] **Step 1:** Failing tests: mapping fidelity (signed qty, multiplier, tri-state ⇒ literals) ·
  sim regression — `buildPositionView` output for the existing fixtures deep-equal to before
  except `origin: 'sim'` · modeled P/L equals the sim engine's number for an identical leg set
  (same math, no new math) · `not provided` ≠ `not recorded` in the produced leg rows ·
  dual/single label derivation at the stale boundary.
- [ ] **Step 2:** Implement; suite + typecheck green. Commit.

### Task F4 — Broker tab UI: S1–S9, provenance header, read-only rows, refresh  *(after F2+F3)*

**Files:**
- Create: `features/trading/broker/BrokerTabPanel.tsx`, `ProvenanceHeader.tsx`,
  `BrokerPositionRow.tsx`, `BrokerPositionCard.tsx`, `copy.ts` + component specs
- Modify: `positions/PortfolioPanel.tsx` (label `🔒 Live` → `Broker`, `LiveTabPanel` →
  `BrokerTabPanel`; internal `tab-live` testid MAY stay — the decisions.md carve-out) ·
  `positions/labels.ts` (retire `LIVE_*` LOCKED copy)
- Delete: `positions/LiveTabPanel.tsx` · Modify: `positions/positions.risk.spec.tsx` — the
  "LiveTabPanel is inert by construction" test (line ~636) is SUPERSEDED by F7's broker
  negative-space suite; replace it in the same commit, never delete-without-replacement.

**Interfaces:**
- Consumes: F2 `resolveRenderState`/`useBrokerBook`, F3 `buildBrokerPositionView`, existing SSE
  liveness signal (`streamOffline` prop grammar from `PortfolioPanel`), `copy.ts` holds EVERY
  trader-visible string from SPEC §4 verbatim (provenance header, S1–S8 copy, tooltips, dual-basis
  label, refresh unchanged-and-why note, `Custom` tip, `not provided` tip).
- Produces: the nine states rendered; read-only rows (**absence**, not disabled controls — the
  spec's rejected list bans reusing the sim row with writes propped off; these are NEW components
  sharing the book grammar through the projection); two-axis degradation wired: market-data axis
  dims ONLY the modeled P/L to ⏸ last-known on SSE drop; book-snapshot axis applies the S6
  treatment ONLY to snapshot fields; all four combinations per the SPEC §4 grid; refresh
  affordance driven by F2's refresh outcome (fresh ⇒ stamp advances; throttled/failed ⇒ the honest
  note, never a silent no-op); design rules: steel-outline `Webull · read-only` chip, mono
  `as of` ledger stamp with `tabular-nums`, burnt orange for S8/`credential_unreadable` only, no
  pulsing dot, no `LIVE` badge, no padlock, 44px targets, ≥11px labels, no 393px overflow (reuse
  the shipped `<sm` card collapse), zero hex.

- [ ] **Step 1:** Failing component tests (from F2 fixtures — the nine states): each S-state
  renders its distinct surface; S4 ≠ S5 textually (AC-10 render arm); S7 ≠ S8 ≠
  `credential_unreadable` (distinct copy off distinct wire values — a generic catch-all is the
  regression); S7/S8 last-known-book clause renders IFF the response carries a served snapshot
  (keyed off the wire, not client memory); stamp invariant — an as-of stamp present whenever any
  broker datum renders (S3–S8); two-axis tests — SSE drop ⇒ modeled P/L ⏸, snapshot fields
  byte-identical; stale+feed-up ⇒ figure still updates AND the dual-basis label present
  (single-basis label over a stale book fails); refresh note on throttle.
- [ ] **Step 2:** Implement; suite + typecheck green; run the app (`npm run ports:free` first,
  `POSITIONS_PROVIDER=stub` backend) and walk S1→S3 via the stub. Commit.

### Task F5 — Settings `#brokerage` section  *(after F1; parallel with F4)*

**Files:**
- Create: `features/auth/BrokerageSection.tsx` + `brokerageSection.spec.tsx`
- Modify: `features/auth/SettingsPage.tsx` (render beside `AiKeySection`, anchor id `brokerage`,
  scroll-on-hash so the S1 CTA deep-link lands)

**Interfaces:**
- Consumes: F1 credential client fns; the `AiKeySection` byo-ai-key component shape as the
  pattern (write-only fields, masked state, saving spinner, storage-unavailable info-note).
- Produces: heading `Brokerage`; helper, saved-state, and Disconnect confirm copy VERBATIM from
  SPEC §4; two-field write-only form (App Key + App Secret, both-halves-required client
  validation mirroring the server 422); saved state `Webull · key ····{last4}` + Replace /
  Disconnect (inline confirm: `Disconnect` / `Keep connection`); errors never echo any key
  fragment; storage-unavailable ⇒ contained info-note, never error-red.

- [ ] **Step 1:** Failing component tests: form ⇒ hint transition on save; both-halves
  validation; no input value ever rendered after save (scan `container.textContent` for the
  entered strings); disconnect confirm flow calls DELETE then the hint shows not-set;
  storage-unavailable note. **Step 2:** implement; green + typecheck. Commit.

### Task F6 — reassessment referencing a real holding  *(after F4)*

**Files:**
- Create: `features/trading/broker/reassess.ts` + spec (or extend the broker view module —
  whichever keeps the existing reassessment request-builder untouched-but-called)

**Interfaces:**
- Consumes: the existing FE-assembled reassessment request builder (the sim flow's), F3's view.
- Produces: `Build reassessment` on a broker row assembles the existing request shape from the
  broker position and VISIBLY carries the real position's as-of basis into the request/export
  (AC-18); the verdict renders advisory-only — no Accept-into-store or any write affordance
  (AC-19); the sim reassessment Accept flow is untouched (its specs stay byte-identical green).

- [ ] **Step 1:** Failing tests: the built request carries the as-of basis string; the broker
  verdict surface renders no accept affordance (query by the sim flow's accept testid ⇒ absent);
  existing sim reassess specs untouched and green. **Step 2:** implement; green. Commit.

### Task F7 — FE negative space, forbidden word, isolation  *(after F4–F6)*

**Files:**
- Create: `features/trading/broker/broker.risk.spec.tsx` (the successor to the LiveTabPanel
  inert test) · Modify: `positions/positions.risk.spec.tsx` (swap in the successor reference)

- [ ] **Step 1:** Source-scan tests (`?raw` imports, the shipped pattern at
  `positions.risk.spec.tsx:636-666`): the broker module (every file under
  `features/trading/broker/`) contains NO import/reference of `TradeEntryDialog` (AC-15/§ narrowed
  invariant) · NO import of `positions/store` and NO string `convexa.` (durable-key isolation) ·
  NO order/trade/close/modify affordance testids render on any broker fixture state (enumerate:
  `open-entry`, close/trim/roll testids from the sim surface ⇒ absent).
- [ ] **Step 2:** Forbidden-word scan: over `broker/copy.ts` exports and each rendered state's
  `textContent`, the word `live` (case-insensitive, word-bounded) appears ONLY inside the
  negation phrase `a snapshot, never live` — the scan targets trader-visible rendered strings
  ONLY, never module names/routes/testids (decisions.md I-4 carve-out; `tab-live` testid must not
  trip it).
- [ ] **Step 3:** Sim-book isolation: connect/disconnect a broker fixture session ⇒ sim store
  contents + outcome-ledger numbers byte-identical before/after (AC-16 FE arm). Suite + typecheck
  green; record new unit count. Commit.

### Task F8 — integration + e2e  *(last FE task)*

**Files:**
- Create: `features/trading/broker/broker.integration.spec.tsx` (Positions page with ONLY the
  network boundary mocked) · `apps/dashboard-e2e/src/e2e/broker.spec.ts`

- [ ] **Step 1:** Integration (mock fetch at the network boundary only): never-connected ⇒ S1 ⇒
  CTA deep-links `#brokerage` ⇒ save ⇒ S2 first-sync ⇒ S3 populated with provenance header ⇒
  refresh throttled ⇒ unchanged-and-why note ⇒ DELETE ⇒ S1 with no residual row text (AC-3 FE
  arm).
- [ ] **Step 2:** e2e (against the stub provider, `--auth-signup`-style throwaway account):
  signed-out Positions ⇒ Broker tab shows `SignInPrompt` (auth carve-out row); signed-in
  no-credential ⇒ S1 not-connected (never an empty table); rendered tab text contains no
  freshness `live`. Keep it to one spec file, 3–4 tests — risk-based, not a state-machine mirror
  (the component tests own the nine states).
- [ ] **Step 3:** Full FE gauntlet: `npx nx test @org/dashboard` (≥ current ratchet) ·
  `npx nx e2e dashboard-e2e` (33 + new) · `npx nx run-many -t lint typecheck` (0/0, 0) ·
  `npx nx build dashboard` (no >500 kB chunk warning). Exit codes checked. Commit.

---

# VERIFICATION track (conductor + `qa-verify`; V5 is a FRESH session)

### Task V1 — per-AC verification matrix (the assignment of record)

| AC | Kind | Where it is proven |
|---|---|---|
| 1 | review | F5 masked-hint render + GATE Q review pass |
| 2 | review | GATE Q: rotate dead→good key, fetch succeeds (owner-present, real account) |
| 3 | test | B5 delete-invalidation + F8 integration no-residual |
| 4 | test | B3 + B5 anonymous 401/403 on all five endpoints |
| 5 | test | B3 log/response scans + B5 decrypt-fail arm (no leak, no "Webull rejected") |
| 6a | test + review | test arm: B4 fixture-bound every-position/count assertions; **review arm (ONE-TIME, OWNER): the app-vs-tab comparison against the Webull app — scheduled at GATE Q with the owner present; no automated test can observe the Webull app** |
| 6b | test | B4 grouping-vs-flat mapping tests bound to the capture truth (+ the owner's recorded fallback ruling if flat) |
| 7 | test | F7 forbidden-word scan + F4 stamp-invariant test |
| 8 | review | GATE Q: manual refresh walk (advance vs honest unchanged-and-why) |
| 9 | review | GATE Q: S1 copy/CTA presence |
| 10 | test | F2 lookup totality/no-length-branch + F4 S4≠S5 render tests |
| 11 | test | F2 stale predicate + F4 snapshot-axis tests (fields keep last-known, marked, never blanked) |
| 12 | test | B5 outage arms + F4 S7 conditional + F7/V2 same-session isolation (sim/SSE/ticker untouched) |
| 13 | test | F4 S8 ≠ S7 ≠ `credential_unreadable` distinct-render tests + B5 mapping |
| 14 | test | B4 fidelity mapping + F4 cannot-fully-display render + `not provided` literal tests |
| 15 | test | B2 no-write-method type test + B6 SDK import scan + F7 affordance/TradeEntryDialog scans |
| 16 | test | F7 sim-store/ledger byte-identity across connect/disconnect |
| 17 | test | B6 scoring characterization fixtures + empty scoring diff + V2 live A/B |
| 18 | review | F6 basis-carry test exists; GATE Q reviews the visible carry in the export |
| 19 | test | F6 no-accept-affordance + sim Accept flow specs byte-identical |
| 20 | review | GATE Q: no fabricated/demo data anywhere; bad key lands in S8, not hang/fake success |
| 21 | test | F4 two-axis tests (⏸ dim, dual-basis label, never single-basis over stale) |
| 22 | review | conditional on capture (e); if supplied: GATE Q reviews the two-numbers/two-bases render |
| 23 | test | B5 two-user isolation test + V4 two-real-account run; V5 re-verifies adversarially |

### Task V2 — score/tier/fingerprint byte-identity live A/B (AC-17)

- [ ] `npm run ports:free`; boot the API (dummy-key boot per memory) with a connected broker
  credential (stub provider suffices — the claim is about the scoring path, not Webull); capture
  `GET` bundle for a fixed ticker; DELETE the credential; capture again; **byte-compare
  score/tier/`state_fingerprint`** (the scanner worker-absent/present proof is the template).
  Done: identical bytes, recorded in the QA report.

### Task V3 — conformance run

- [ ] Run the Global Constraints block via `interface_conformance.py --auth-signup` against the
  running API. `--auth-signup` ONLY — never `--auth-cookie` (real rate limits). Exit code 0.

### Task V4 — AC-23 two-real-account verification

- [ ] With two real signed-in accounts (owner + a fresh second account): account A connects and
  fetches; account B hits all five surfaces ⇒ only its own state
  (`unknown`/`no_credential_stored`, `set:false`), and the raw response bodies share no
  `account_ref`/`last4`/position field with A's; anonymous ⇒ 401/403. Recorded with response
  excerpts (sanitized) in the QA report.

### Task V5 — system-6 security red-team  *(PLANNED here, PERFORMED by a FRESH session at GATE Q — never by a build lane, never by this session)*

The conductor spawns a fresh adversarial session (different base model preferred, the qa-verify
de-correlation rule) with EXACTLY the SPEC §8.1 remit — findings land as ACs on the
credential/egress surface, not as scope reopeners:

- [ ] **Credential storage:** Fernet key provenance/rotation story; ciphertext-only persistence
  proof; plaintext lifetime (request-scope only — including B2's masked `__repr__`); masked-hint
  leak surface; per-user isolation; delete-really-deletes including book-cache invalidation.
- [ ] **Egress:** adapter contacts only the fixed Webull API hosts (testable allowlist);
  credentials/signatures never in URLs/query strings; TLS only; request-signing computed in one
  place; the secret never enters any error message, exception string, or trace.
- [ ] **Logging:** no secret/signature/account-number/position detail at any default level; rule
  on the open observability question (SPEC §9.4: uninstrumented v1 vs timing-only + redaction) —
  a deliberate decision owed to this review, not a default.
- [ ] **Replay & abuse:** Webull signing timestamp/nonce + clock-skew tolerance;
  server-authoritative per-account refresh throttle cannot be weaponized by a hostile client;
  the surface sits entirely behind the existing HMAC-signed session model.
- [ ] **Dependency:** SDK pinned; import-scope confirmed (B6 scan); SDK transitive behavior
  (telemetry, retries, endpoints) checked against the egress allowlist.
- [ ] **AC-23 adversarial re-verify:** session fixation, cache-key collision, log egress.

### Task V6 — baseline sweep + review-AC pass at GATE Q

- [ ] All Global Constraints baselines at their ratcheted figures, by EXIT CODE. Review ACs
  (1, 2, 8, 9, 18, 20, 22) walked against the running app; the AC-6a owner review arm executed
  once with the owner (app vs tab). GATE Z bounces for any gap — qa-verify fixes nothing.

---

## Named decisions routed to the conductor/owner (never a lane)

1. **6b fallback** — if B1 capture shows a flat payload: visual grouping by underlying+expiry vs
   honest flat rows. OWNER decision, recorded (SPEC §9.2).
2. **AC-22 render** — if capture shows Webull supplies unrealized P/L: whether/how the static
   broker-reported reference renders beside the modeled read (within the owner's standing ruling).
3. **Observability** — uninstrumented v1 vs timing-only + redaction: owed to the V5 review.
4. **C3 escape hatch (moot in fact)** — if capture somehow fails at GATE Q: owner chooses ship
   with AC-6a deferred (named runtime follow-up) vs hold GATE S.
5. **"Broker" label** — settled but owner-vetoable at any gate (reversible copy).

## Self-review (performed)

Spec coverage: all 23 ACs appear in the V1 matrix and trace to concrete tasks; §4's nine states
land in F2/F4; §8.1's remit is V5 verbatim; the §2 rejected-approaches list is fenced in Global
Constraints non-goals. Type consistency: `BrokerCredential`/`get_positions_provider` (B2) are
what B5 consumes; `resolveRenderState`/`useBrokerBook` (F2) and `buildBrokerPositionView` (F3)
are what F4 consumes; `NOT_PROVIDED` is defined once (F3) and consumed in F4/F7. Known
deliberate deviations from the writing-plans default: plan lives at
`.claude/contracts/broker-connect/PLAN.md` (pipeline convention, per the conductor's directive),
and step granularity is task-level with binding signatures rather than line-level code — the
lanes are contract-bound and the LOCKED SPEC/INTERFACE own the shapes this plan must not restate.
