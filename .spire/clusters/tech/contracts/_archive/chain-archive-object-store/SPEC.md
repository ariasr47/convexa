# chain-archive-object-store — spec

**Source brief:** .spire/clusters/tech/contracts/chain-archive-object-store/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** approved 2026-08-20 (owner A — plan and build)

## 1. Goal + scope

Keep **session-archive bodies** off the app Postgres BYTEA / unbounded workspace JSON so weeks of
paid books can accumulate without the Railway OLTP volume becoming the retention policy. After this
ship, identity `(symbol, et_date)` plus mandatory `source_as_of` and list metadata live in a thin
index; chain bodies live in an env-configured filesystem store (Railway volume / local path).
Research list/load stay **zero Massive**, reuse the shipped closed miss/unreadable/not-storing
strings, and authorize **nothing** on the live score. No trader UI.

**In scope:**

- Body/index split behind the existing `SessionChainArchive` facade
  (`insert_if_absent` / `list` / `load` / `plant_conformance_seed`).
- Thin durable index (Postgres row or thin Json metadata) holding identity, provenance, list
  metadata, and an opaque body locator — **not** full-chain BYTEA after cutover.
- Filesystem body store as the **only** prod adapter this ship, rooted at named dial
  **`SESSION_CHAIN_ARCHIVE_BODY_ROOT`** (Railway volume mount or local path). S3-compatible is
  deferred on the same port shape.
- Research list/load continue under `/api/_research/session-books/...` with mandatory
  `source_as_of`, `vendor_called=false`, and zero Massive — including on miss and unreadable.
- Honest outcomes: missing identity → exact `no session book…`; identity/pointer without readable
  body (including missing object) → exact `session book unreadable: <reason>`; store disabled /
  not configured / unavailable at open → exact `session archive not storing`.
- Migrator that moves legacy inline BYTEA / `body_b64` into the body store and **clears/drops** the
  inline body column/field so GATE Q can observe bodies off the app OLTP volume (Definition of Done
  — dual-read alone is not enough).
- Desk isolation: object/volume I/O never sits on the trader HTTP/SSE await path; store failures
  never fail bundle / scan / SSE; score / tier / fingerprint stay byte-identical.
- Path-B / corpus tools continue against the **same** `SessionChainArchive` facade (open-the-same-
  store continuity only).
- Secret hygiene: bodies and index carry no API keys; body-root path is runtime env only
  (`no-secrets-in-image`).

**Out of scope:**

- Moving **48-ring** / `ChainSnapshotStore` / `pg_chain_snapshot` bodies off BYTEA / `body_b64`
  this ship (explicit Non-move; residual named in AC-22).
- Implementing an S3-compatible adapter this ship.
- Raising the 48-per-symbol cap or stretching 14-day ring retention.
- Buying Massive hist-chain / PIT (program P7).
- Starting `ai-rec-lab-p4`, declaring the session-corpus wait complete, or absorbing join-smoke /
  weekly-digest chore execution.
- Any trader UI, trader route, nav item, Settings control, Ask-AI line, `/_ops` storage chrome, or
  redistribution of stored books as a trader feed.
- Changing live score / tier / gate / fingerprint.
- Rewriting Path-B / `batch-backtest` / `replay-outcome-join` CLIs beyond opening the same store.
- Minting a fifth absence class, storage-backend product strings, or a second operator vocabulary.
- Redesigning research HTTP envelopes or inventing a storage-location wire field.

**Future (deliberately deferred):**

- S3-compatible (or other multi-host object) adapter on the same body-store port.
- 48-ring body migration if volume pressure returns inside the 14d+48/symbol envelope (requires a
  later human Decision card).
- Multi-week corpus readiness gate / paid-book AUC (program #5 clock).
- AI-rec lab P4 over the growing corpus (program #6).
- Optional operator dashboard for body-store health / orphaned-pointer audits (operator-vs-trader
  only; not required to ship).
- Lifecycle / cold-tier / delete policies beyond “bodies off app OLTP so weeks can accumulate.”

## 2. Architecture

### 2.1 Verified live surface (cite, do not assume)

Today session-archive **bodies** sit beside identity:

- `apps/api/src/services/session_chain_archive/store.rs` — `SessionChainArchive` enum
  `Disabled | Memory | Json | Failing | Postgres`; `StoredRow` / `JsonRecord` carry `body` /
  `body_b64` with `(symbol, et_date, source_as_of, source)`.
- `apps/api/src/db/pg_session_chain_archive.rs` — `INSERT`/`SELECT` column `body` as raw bytes;
  migration 11 defines `body BYTEA NOT NULL` on `session_chain_archive`.
- Boot prefers Postgres when the pool exists, else Json under `SESSION_CHAIN_ARCHIVE_STORE_PATH`
  (path-conflict guard vs `chain_snapshot_store_path` already exists). Live Postgres open does
  **not** currently require a filesystem root — this ship adds that requirement for the body store.
- Parallel ring `ChainSnapshotStore` / `pg_chain_snapshot` likewise store full-chain bodies under
  dual retention (14d + 48/symbol) — **bounded**; session archive is prune-proof and unbounded by
  design (the OLTP failure mode this ship fixes).
- Research outcomes already live in `routes/research_session_books.rs`: miss / unreadable /
  not-storing / list store-error with `vendor_called=false` — never a Massive refill.

Context pack §2 still narrates FastAPI; production backend is Axum / `api-rust`
(`cited-code-is-verified-not-assumed`).

### 2.2 Chosen shape — pointer index + filesystem body store

Keep `SessionChainArchive` as the facade callers already hold. Split **index content** from
**body bytes**:

| Component | Owns | Must not |
| --- | --- | --- |
| `SessionChainArchive` facade | first-wins identity API callers already use | vendor SDK; score/signals; trader routes |
| Index adapter (Postgres / thin Json) | `(symbol, et_date)` PK, `source_as_of`, `source_as_of_ns`, `source`, opaque body locator | retain chain BYTEA / `body_b64` after migration completes |
| FS body store (one-way leaf port) | opaque put/get/delete-by-key under `SESSION_CHAIN_ARCHIVE_BODY_ROOT` | know MarketData / Massive; sit on trader request await |
| `archive_session_best_effort` / liquid-name ensure worker | off-path / best-effort writers (ensure **may** await FS body put because it is not trader HTTP) | fail trader HTTP/SSE on body errors |
| Research list/load (existing routes) | index+body assemble; closed miss/unreadable/not-storing vocabulary | call Massive; invent storage-location fields; collapse classes |

**Config (named):**

| Dial | Env | Default / open rule |
| --- | --- | --- |
| Enable | `SESSION_CHAIN_ARCHIVE_ENABLED` | **true** (unchanged); `0`/`false`/`no`/`off` → Disabled → exact `session archive not storing` |
| Index Json path | `SESSION_CHAIN_ARCHIVE_STORE_PATH` | Existing thin-index / local Json family (unchanged path-conflict vs ring) |
| **Body root** | **`SESSION_CHAIN_ARCHIVE_BODY_ROOT`** | **Required when archive is enabled and the FS body store is in use** (Postgres prod on Railway volume, and any adapter that puts bodies on disk). **No silent default.** Unset, empty, missing, or unusable → fail-open to Disabled / exact **`session archive not storing`** at open. Must **not** equal or nest under `CHAIN_SNAPSHOT_STORE_PATH` (ring) or under the index Json dir. **Do not** `create_dir_all` a default path that hides misconfig. |

**Prod adapter named:** Railway volume (or any host path) via **`SESSION_CHAIN_ARCHIVE_BODY_ROOT`**
— not S3 this ship. Image carries no secrets. Local/dev without Postgres uses the same body-root
split (thin metadata under the index path family + body files under `BODY_ROOT`) so workspace JSON
stops absorbing unbounded `body_b64`.

**Body locator (binding):** the storage key is **unique per put**, not derived from
`(symbol, et_date)` alone. Include `source_as_of` (and/or a put nonce) so two concurrent writers
for the same identity **never share a key**. Identity-only deterministic locators are **rejected**
(§2.7) — they last-win the body bytes while the index first-wins, reopening shipped first-wins.

**Write path (binding):**

1. If the identity already exists in the index, return `Ok(false)` **without body I/O**.
2. Otherwise **`put` body under a unique-per-put key**, then **`insert_if_absent` on the index**
   with that locator (`ON CONFLICT DO NOTHING` / in-memory check).
3. If the index insert loses (another writer won first-wins), the **first body is retained** via
   the winning index row; the losing put is an **orphan blob** — acceptable. Best-effort
   delete-on-conflict of the orphan may run but must not fail the caller.
4. Do **not** put under a key two racers share.

`archive_session_best_effort` continues to swallow errors so the ring append / trader path is
unchanged. Concurrent `spawn_capture` and liquid-name ensure for the same `(symbol, et_date)` must
still leave exactly one identity with the **first** retained body.

**Research load:** index lookup → miss → `no session book`; hit → `get` body by locator →
missing/corrupt → `session book unreadable: <reason>`; success → `StoredSessionBook` with
mandatory `source_as_of` and zero Massive. **List is index-only** (no body I/O).

**Open-time misconfig:** when the archive is enabled but `SESSION_CHAIN_ARCHIVE_BODY_ROOT` is
unset / empty / missing / unusable / path-conflicts with the ring store, fail-open to
**`session archive not storing`** at open — never invent a default root, never
`create_dir_all`-into-existence a silent path that leaves durable Postgres index rows pointing at
ephemeral container disk.

### 2.3 48-ring this ship — Non-move + named residual

**Non-move.** `ChainSnapshotStore` / `pg_chain_snapshot` keep co-located BYTEA / `body_b64` under
the existing 14d + 48/symbol prune. Ring-body migration is Out unless a later human Decision card
brings it In.

**Residual (binding, not silent):** ring BYTEA may still pressure OLTP **inside** the
14d+48/symbol envelope. That residual is **bounded** and does **not** falsify the BRIEF claim that
weeks of prune-proof session corpus can accumulate without Postgres disk being session retention
policy — session bodies leaving OLTP is the mechanism. Accepted residual Postgres disk bound for
the 4–6 week corpus wait = whatever the live ring retains inside that envelope — not an unbounded
second retention class.
<!-- spire:council-resolution:v1 cec469e9f03a6d6d8d78a30d66d029abb4081da9fd2322357be34b2ee058e82b folded -->
<!-- spire:council-resolution:v1 0b07881f47cb8b4d6d28bb6976c8aa299aa8aa2e822c9706fca5bd556c619342 folded -->

### 2.4 Migration / Definition of Done (inline body clear/drop)

**Mechanism:** additive schema/index change introducing the locator; a one-shot (or boot-idempotent)
migrator reads each row/file that still has inline body, `put`s bytes to the body store under a
**unique-per-put** key, writes the locator, then **clears/drops** the inline body column/field so
the app DB no longer retains chain BYTEA / `body_b64`.

**Dual-read window:** if locator present, load from body store; else if legacy inline body still
present, serve it (research-only). After backfill proof, inline body storage is removed.

**DoD (SPEC-plannable, ship-blocking with AC-1/2):** finishing the migrator clear/drop so GATE Q can
observe bodies off the app OLTP volume — not only dual-read serving of legacy rows. Corrupt /
unreadable legacy rows become `session book unreadable`, never Massive refill.

### 2.5 Isolation / error rules

- **`[operator-vs-trader-path-separation]`:** body I/O belongs to research load + off-path
  archive/ensure writers. Trader bundle/SSE/ticker routes do not open the body store.
- **`[best-effort-isolated-or-null]`:** archive write failures stay swallowed at
  `archive_session_best_effort`; they never become trader HTTP errors or score inputs.
- **`[additive-keeps-score-byte-identical]`:** no import from signals/score/fingerprint/gate.
- **`[absent-is-not-none]`:** keep four distinct outcomes — `no session book…` ≠
  `session book unreadable: <reason>` ≠ `session archive not storing` ≠ ring
  `no stored snapshot for <SYMBOL>`. A locator with a missing object is **unreadable**, not miss,
  not not-storing, and not a vendor miss. No fifth storage class.
- **`[no-secrets-in-image]`:** `SESSION_CHAIN_ARCHIVE_BODY_ROOT` and any future object credentials
  are runtime env only.
- **Massive license: research only** — stored books are not redistributed on trader routes.

### 2.6 Failure modes + isolation

| Dependency | Slow | Absent / misconfigured | Wrong / corrupt |
| --- | --- | --- | --- |
| FS body store (`SESSION_CHAIN_ARCHIVE_BODY_ROOT`) | Trader path unaffected (no await on trader HTTP); research load may be slow but stays zero-Massive | Unset / empty / missing / unusable / nest-under-ring → open fail-open to `session archive not storing`; no false stored success; desk up; **no** silent `create_dir_all` default | Missing/corrupt object behind pointer → `session book unreadable: <reason>` (opaque reason; no S3/volume/BYTEA/path product vocabulary) |
| Index (PG / thin Json) | List/load degrade via existing store-error / unreadable classes | Not-storing or list store-error — never Massive | Partial write / orphan pointer → unreadable / store-error, never fabricated hit |
| Concurrent put race | N/A | N/A | Unique-per-put keys → index first-wins retains **first** body; loser put is orphan blob (not last-wins overwrite) |
| Massive | N/A on research read | N/A | Research must **never** refill from Massive |

**Must never be partially applied as a false success:** index claiming stored while body put did not
complete must not return a successful research load of a fabricated book.

### 2.7 Not buildable / rejected approaches

- **Identity-only / `(symbol, et_date)`-deterministic body locator** — concurrent writers share a
  key, second `put` overwrites first bytes, index still first-wins → **body last-wins**, orphan
  story is false, shipped first-wins reopened. Unique-per-put keys only.
- **Silent default body root + `create_dir_all`** — hides unset `SESSION_CHAIN_ARCHIVE_BODY_ROOT`,
  parks bodies on ephemeral disk while Postgres index stays durable, then every pointer becomes
  unreadable after restart. Fail-open to not-storing instead.
- **S3-compatible adapter this ship** — higher complexity (new crate, creds, retries, IAM); team has
  no object_store/AWS SDK in `apps/api/Cargo.toml` today; BRIEF-scale retention fits one volume.
- **Moving ring bodies in the same cutover** — second body-store migration; ring is already bounded;
  expands scope beyond the session-OLTP failure mode.
- **Leaving BYTEA on OLTP while adding pointer theater** — fails AC-1/2; dual-read without clear/drop
  is not Done.
- **Silent Massive refill on missing object** — license/honesty incident; forbidden.
- **Fifth absence class / storage-branded chrome** (“object store miss,” “volume unavailable,”
  “off Postgres”) — reopens shipped vocabulary; Owner A forbids.
- **Object I/O on trader request await** — desk stalls when storage hiccups; AC-13/14.
- **Endpoint/payload redesign** or storage-location wire field — research surface stays
  byte-compatible with shipped `session-chain-archive`.

## 3. Acceptance criteria (with user stories)

Actors: research operator / owner (list/load via `/api/_research/session-books/...`). **Not** the
signed-in trader. **(SB)** = ship-blocking. Exact operator strings are the honesty observables;
shortened labels in prose are aliases only — not a second vocabulary.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | As the research operator, I want session-archive bodies off the app OLTP volume so weeks of books can accumulate. | After a session book for `(T, D)` is successfully archived under the post-split store **and** the migrator clear/drop has completed for that identity, the **full chain body is not retained as an unbounded blob on the app database volume** (body resides under `SESSION_CHAIN_ARCHIVE_BODY_ROOT`; the app DB / thin index may hold identity, provenance, list metadata, and at most a pointer/locator). | test |
| AC-2 **(SB)** | same | Given many session identities archived under the post-split store after clear/drop, **app-database storage for those identities does not grow in proportion to full chain-body size** (body bytes accumulate off the OLTP volume). | test |
| AC-3 **(SB)** | As the research operator, I want load after the split to still return the book with provenance and zero Massive. | Loading `(T, D)` when the body object is present returns the book body with **mandatory `source_as_of`** and **zero live Massive calls** (`vendor_called=false`). | test |
| AC-4 **(SB)** | As the research operator, I want list to stay metadata-cheap. | Listing session-archive identities for a symbol completes with **zero live Massive calls** and does **not** require retrieving every chain body to produce the list. | test |
| AC-5 **(SB)** | As the research operator, I want a missing identity to stay an honest miss. | Requesting `(T, D)` when no session identity exists reports exactly **`no session book for <SYMBOL> on <ET_DATE>`** (list empty: **`no session book for <SYMBOL>`**) and performs **zero Massive calls**. | test |
| AC-6 **(SB)** | As the research operator, I want a missing object behind a pointer to be unreadable, not miss and not a vendor refill. | When a session identity for `(T, D)` exists but the body object is **missing**, research load reports exactly **`session book unreadable: <reason>`** (distinct from miss and not-storing) with **zero Massive calls**. `<reason>` may be an opaque store fault; it must not introduce S3 / volume / BYTEA / path product vocabulary. | test |
| AC-7 **(SB)** | same | When a session identity exists but the body is **corrupt / unreadable**, research load reports **`session book unreadable: <reason>`** (not a successful book, not miss, not not-storing) with **zero Massive calls**. | test |
| AC-8 **(SB)** | As the research operator, I want disabled/unavailable store to be exactly not-storing. | When the archive is **disabled**, or **`SESSION_CHAIN_ARCHIVE_BODY_ROOT` is unset / empty / missing / unusable / path-conflicts** at open (not configured), or the body store is otherwise unavailable at open, the trader desk remains available; archival does **not** report a false stored success; the operator observes exact **`session archive not storing`** — distinct from `no session book…`, from unreadable, and from list **`session archive store error: <reason>`**. No “or store-error” alias for not-storing; no silent default body root. | test |
| AC-9 **(SB)** | As the research operator, I want partial writes and races to fail closed without last-winning the body. | A **partial write** (index/pointer claims stored while body put did not complete) does **not** produce a successful research load of a fabricated book. Concurrent puts for the same `(T, D)` use **unique-per-put** locators: the index first-wins row retains the **first** body; the losing put is an orphan blob (not an overwrite of the winner’s object). Outcomes that are not a successful first-wins load are unreadable or store-error with **zero Massive calls**. | test |
| AC-10 **(SB)** | As the research operator, I want miss/unreadable never to silently substitute another date. | A research miss or unreadable object for `(T, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing/unreadable stays missing/unreadable). | test |
| AC-11 **(SB)** | As the research operator, I want ring miss to stay distinct from session miss. | Empty / pruned intraday-ring miss for T remains **observably** the live ring string **`no stored snapshot for <SYMBOL>`** — distinct from `no session book…` and from `session book unreadable: <reason>`. | test |
| AC-12 **(SB)** | As the research operator, I want cutover to leave claim-kept books loadable. | Cutover leaves previously claim-kept session books **loadable under the same research contract** (moved bodies or equivalent), or any identity that cannot be loaded is reported via honest unreadable/miss — never a quiet Massive backfill. | test |
| AC-13 **(SB)** | As the desk owner, I want object I/O off the trader request path. | Object-store / volume I/O for archive or research load does **not** sit on the trader request path in a way that makes store stall fail or delay the trader response. (Off-path ensure Notify worker **may** await FS body put.) | test |
| AC-14 **(SB)** | As the desk owner, I want store faults not to take down the desk. | If object-store write or read fails, trader-facing scan/serve/SSE still **succeeds**. | test |
| AC-15 **(SB)** | As the desk owner, I want zero trader chrome for the storage move. | `apps/dashboard` gains **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, tooltip, or `/_ops` chrome mentioning object storage / S3 / volume / BYTEA / “session bodies moved”; no trader UI exposes object-store browse, session-archive download, or historical-chain replay. | test |
| AC-16 **(SB)** | As the desk owner, I want no trader redistribution of stored books. | No trader-facing product path redistributes session-archive / object-stored books as a market-data feed (research/operator surfaces stay off the trader origin the same way existing research capture does; Pages `/api/_research` stays 404). | test |
| AC-17 **(SB)** | As the desk owner, I want score neutrality. | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with the object/volume store on vs off and with store I/O succeeding vs failing; bodies/pointers are not scoring inputs. | test |
| AC-18 **(SB)** | As the owner, I want secret-free stored material. | Stored session material (bodies and index/metadata) contains **no API keys or other secrets**. | test |
| AC-19 **(SB)** | As the owner, I want this ship not to fake retention by raising the ring. | This ship does **not** raise the existing 48-per-symbol cap or stretch 14-day ring retention as a substitute for moving session bodies off the app OLTP volume. | review |
| AC-20 **(SB)** | As the owner, I want no hist-chain purchase smuggled in. | This ship does **not** include purchasing Massive hist-chain / PIT history. | review |
| AC-21 | As the owner, I want program sequencing to stay honest. | This ship does **not** start AI-rec lab P4, declare the session-corpus wait complete, or absorb join-smoke / weekly-digest chore execution. | review |
| AC-22 **(SB)** | As the owner, I want ring deferral named, not silent. | Spec/decisions **explicitly name** 48-ring body Non-move this ship and state the residual: ring BYTEA may still pressure OLTP inside the 14d+48/symbol envelope; that residual does not falsify session-book accumulation off OLTP. Ring-body migration is Out unless a later human card brings it In. | review |
| AC-23 | As the research operator, I want verification without the trader UI. | Operator verification (list / load / miss / unreadable / not-storing) is available **without** using the trader UI via `/api/_research/session-books/...`. | review |
| AC-24 **(SB)** | As the desk owner, I want research hits to keep authorizing nothing. | Every research hit list/load envelope that surfaces session books states **`authorizes: "nothing"`** (list-miss 200 keeps the shipped envelope fields including `authorizes`; load 404 stays detail-only). | test |
| AC-25 | As the research operator, I want Path-B continuity on the same store. | Path-B / corpus tools that must open the session archive continue to load books from the **same** post-split `SessionChainArchive` facade without inventing a second corpus for this ship. | review |
<!-- spire:council-resolution:v1 a22173172f27018a88e09904b0be15db2c4db11be78f99e453d7a04b2de91c47 folded -->
<!-- spire:council-resolution:v1 40a7bfedb6e77921766d338eab5c3c1e09d453b7615043e54b5c8ac4bf944407 folded -->

**Method notes (risk-based):**

- **`test`** — silent money/correctness/retention failures: bodies off OLTP after clear/drop
  (AC-1/2), zero-vendor load with provenance (AC-3), metadata-only list (AC-4), exact miss /
  unreadable / not-storing / partial-write + concurrent unique-key first-wins (AC-5–11), cutover
  honesty (AC-12), desk isolation (AC-13/14), no trader redistribution (AC-16), score byte-identity
  (AC-17), no secrets (AC-18), structural trader-chrome absence (AC-15), hit-envelope
  `authorizes: nothing` (AC-24), unset/`BODY_ROOT` misconfig → exact not-storing (AC-8). No DOM
  harness — structural empty-diff / affordance scan plus research-wire assertion.
- **`review`** — intentional scope: no 48 raise / no hist-chain (AC-19/20), program non-absorption
  (AC-21), named ring residual (AC-22), operator-without-trader-UI (AC-23), Path-B same-store
  continuity (AC-25).
- Prefer **one** high-level integration pass: archive `(T, D)` → assert body off OLTP + identity
  listable → load with provenance + vendor-call counter 0 → delete/omit object → unreadable +
  counter 0 → unset `SESSION_CHAIN_ARCHIVE_BODY_ROOT` / disable store → exact
  `session archive not storing` + desk still OK → concurrent put race retains first body → force
  store stall and confirm trader path unaffected — over per-AC micro-harnesses.
- Exact closed string values are asserted by unit / GATE Q; interface conformance checks
  shape/presence.

**Ship-blocking set:** AC-1–AC-20, AC-22, AC-24. AC-21, AC-23, AC-25 are required honesty / scope
checks (`review`).

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature touches **no** dashboard surface — no route, no component, no token,
no new motion, and no `DESIGN_SYSTEM.md` amendment. Anyone proposing a Ticker chip, Settings
“research corpus storage” section, Ask-AI “we kept Tuesday’s book on object storage” line, or a
trader-linked `/_ops` storage browser is **re-scoping**.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal). **Design direction:** does not apply — no trader presentation ships; no canon amendment.

**Flows (operator / research only):**

1. Paid capture / ensure archives a session identity; body lands under
   `SESSION_CHAIN_ARCHIVE_BODY_ROOT` — invisible on the trader path; object I/O does not sit on
   trader HTTP await.
2. Operator lists via `GET /api/_research/session-books/{symbol}` — thin index; zero Massive.
3. Operator loads one `(symbol, et_date)` → body with mandatory `source_as_of`;
   `vendor_called=false`.
4. After 48-ring prune, the same session identity still loads (session archive remains prune-proof;
   ring Non-move does not change that).
5. Missing identity → exact `no session book…`. Pointer without readable body → exact
   `session book unreadable: <reason>` — never silent Massive refill.

**Component states — trader path (S0):** one required state — **unchanged**. Body put/get success,
missing object, store misconfig, and migration are all invisible on Landing / Ticker / Settings /
Ask-AI / Scanner / Positions / shell nav. Trader empty/error/offline/`unavailable this cycle`/`—`
copy is byte-unchanged.

**Component states — research read (S1)** — reuse shipped session-chain-archive matrix; no new
state names:

| Component / state | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Research list/load (HTTP) | Hit: `framing` = `RESEARCH READ — SESSION BOOK`, mandatory `source_as_of`, `provenance` = `loaded from session archive · no vendor call`, `authorizes: nothing` (+ market body on load) | N/A (HTTP request/response; no “fetching from S3…” chrome) | No identity: exact `no session book for <SYMBOL> on <ET_DATE>` / list `no session book for <SYMBOL>`. Ring vehicle empty: live `no stored snapshot for <SYMBOL>` (distinct) | Not storing: exact `session archive not storing`. Unreadable (incl. missing object): `session book unreadable: <reason>`. List I/O: `session archive store error: <reason>` | N/A as trader SSE marketing; do not invent “stale object” |

**Copy (Owner A, 2026-08-20 — exact shipped session-chain-archive §4 strings; no second deck):**

| Concept | Approved term / exact string | Banned (this ship) |
|---|---|---|
| Prune-proof day identity | **session book** / **session archive** / `(symbol, et_date)` | “S3 book”, “object-store row”, “hist-chain product” |
| Intraday dual-retention ring | **48-ring** / **ring snapshot** / **stored chain snapshot** | calling the ring a “session archive”; ring “S3 snapshot” chrome |
| When taken | **`et_date`** (ET `YYYY-MM-DD`) · **`source_as_of`** (UTC) | “uploaded at”, “fresh because off Postgres” |
| How obtained on read | **`loaded from session archive · no vendor call`** | “loaded from S3”, “streamed from volume”, “synced from Massive” |
| Day with no capture | **`no session book for <SYMBOL> on <ET_DATE>`** / **`no session book for <SYMBOL>`** | “not in object store”; ring miss string |
| Empty/pruned ring (ring vehicle) | Live **`no stored snapshot for <SYMBOL>`** | Inventing `empty 48-ring…`; session miss on ring vehicle |
| Store disabled / unavailable | **`session archive not storing`** | “bucket disabled”; aliasing to miss, unreadable, or list store-error |
| Identity present, body bad (incl. missing object) | **`session book unreadable: <reason>`** | “object store miss”, “volume unavailable”, “BYTEA migrated”, “off Postgres”, “S3 NoSuchKey” as a **new** closed string |
| List metadata I/O fault | **`session archive store error: <reason>`** | aliasing to unreadable |
| Score posture (hit) | **`authorizes: nothing`** | implying live score uses archived books |
| License | **Our research · not redistributed on a trader route.** | “shareable feed”, “customer historical options API” |

Four mandatory-distinct operator outcomes — never interchangeable:
`no session book…` ≠ live ring `no stored snapshot…` ≠ `session archive not storing` ≠
`session book unreadable: <reason>`.

**Hard ban — storage-backend chrome:** operator/trader surfaces must not advertise the physical
store (S3-compatible, Railway volume, filesystem path, BYTEA, pointer). Backend location is an
adapter fact, not user vocabulary. Opaque `<reason>` on unreadable may carry a store I/O fault
string already emitted by live code — it must not become a second closed taxonomy of
bucket/volume product phrases.

**Hard ban — live-as-market-feed:** `live` / `LIVE` as a badge on research read is forbidden.
Closed lineage `source: live_massive` \| `fixture` remains provenance only.
<!-- spire:council-resolution:v1 c705f8f76927879fb69f9f38b0575c7b5cbda31ebf87bbefdcbd9ed273890643 folded -->

## 5. Error handling

| Class | Operator / research sees | Trader sees | Log / retry |
|---|---|---|---|
| Archive / body put fail after paid path otherwise succeeded | No false stored success; operator log family `session archive write skipped — trader path unchanged` | Nothing new; desk up | Log + drop; no retry storm on the request path |
| Archive disabled, or `SESSION_CHAIN_ARCHIVE_BODY_ROOT` unset / empty / missing / unusable / path-conflicts at open | Exact **`session archive not storing`** · `store=error` · `vendor_called=false` | Desk up | Honest operator signal; no Massive recovery; no silent default root |
| Research miss (no identity) | Exact **`no session book…`** · `store=miss` · `vendor_called=false` | N/A | No vendor retry; no date substitution |
| Identity/pointer present, body missing/corrupt/unreadable (incl. missing object) | Exact **`session book unreadable: <reason>`** · `store=error` · `vendor_called=false` | N/A | No Massive fallback; opaque reason only |
| List metadata I/O fault | Exact **`session archive store error: <reason>`** · distinct error code | N/A | Not aliased to unreadable or not-storing |
| Concurrent put race (unique keys) | Winner load succeeds with **first** body; loser put is orphan (not visible as a second identity) | Desk unchanged | Optional orphan GC; not required to ship |
| Partial write / orphan pointer | Unreadable or store-error — never fabricated hit | Desk unchanged | Best-effort orphan GC optional; not required to ship |
| Body store slow | Research may be slow; still zero Massive | Trader HTTP/SSE unaffected | No trader await on object I/O |
| Empty/pruned ring (ring query) | Live **`no stored snapshot for <SYMBOL>`** | N/A | Must not alias to session miss |
| Bad / missing `et_date` | **422** (same family as ring `as_of` required/unparseable) | N/A | No vendor fetch |
| Score path under any store state | N/A | Score/tier/fingerprint byte-identical | Bodies/pointers never scoring inputs |

Research-read error is **not** a license to hit Massive. Missing stays missing; unreadable stays
unreadable; not-storing stays not-storing.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/chain-archive-object-store/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** Backend store internals change (pointer index + FS body
store under `SESSION_CHAIN_ARCHIVE_BODY_ROOT` + unique-per-put locators + migrator clear/drop) but
**no new HTTP endpoints** are added. Existing operator research GETs
`/api/_research/session-books/{symbol}` and `/api/_research/session-books/{symbol}/book` are
**reused byte-compatible** with shipped `session-chain-archive` and **re-pinned** in the interface
file as the machine-checkable surface. Not `NO_BACKEND_CHANGE`. Authoritative field lists live in
that file — this SPEC does not restate them. No storage-location envelope field.

## 7. Testing strategy

**Automate (`test`):**

- Post-split archive + migrator clear/drop → body absent from app OLTP / not proportional to chain
  size (AC-1/2).
- Research load hit: mandatory `source_as_of`, `vendor_called=false`, zero Massive (AC-3);
  list metadata-only + zero Massive (AC-4).
- Exact miss / unreadable (missing object + corrupt) / not-storing / list store-error disjointness
  with never-Massive (AC-5–11); no date substitution; ring miss string preserved.
- Concurrent put race: unique-per-put keys; index first-wins retains **first** body; loser is
  orphan, not overwrite (AC-9).
- Unset / conflicted `SESSION_CHAIN_ARCHIVE_BODY_ROOT` → exact `session archive not storing`
  (AC-8); no silent `create_dir_all` default.
- Cutover: legacy claim-kept books loadable or honest unreadable — never Massive backfill (AC-12).
- Desk isolation: trader path does not await object I/O; store fail leaves scan/serve/SSE up
  (AC-13/14); off-path ensure may await FS put.
- Structural trader-chrome empty-diff / affordance scan (AC-15); Pages `/api/_research` 404 /
  no redistribution (AC-16); score byte-identity (AC-17); no secrets (AC-18).
- Hit envelope `authorizes: "nothing"` wire assertion (AC-24).

**Review:**

- No 48-cap raise / no hist-chain (AC-19/20), program non-absorption (AC-21), named ring Non-move +
  residual (AC-22), operator path without trader UI (AC-23), Path-B same-facade continuity (AC-25).

**Invariants that must never silently regress:** session bodies off OLTP after clear/drop; research
read stays Massive-free; four absence classes stay disjoint with exact shipped strings; missing
object → unreadable not miss; not-storing is exact `session archive not storing` (not store-error
alias); unique-per-put locator keeps first-wins on the body; object I/O never joins trader await;
score/tier/fingerprint stay non-inputs; no storage-backend chrome; ring BYTEA Non-move residual
stays named; `BODY_ROOT` unset does not invent a default path.

**FE tiers:** none — `NO_UI_CHANGE`. No DOM harness. Integration tests mock the network / vendor
boundary only where counters are asserted; prefer hermetic store + poisoned locator/missing file
fixtures for unreadable; race two `insert_if_absent` writers for AC-9.

## 8. Guardrails this feature must not break

From BRIEF invariant watch:

- **`operator-vs-trader-path-separation`** — body I/O and research stay off trader routes; no trader
  chrome; Pages `_research` stays 404.
- **`best-effort-isolated-or-null`** — archive/body-store failure never fails desk bundle/scan/SSE.
- **`additive-keeps-score-byte-identical`** — bodies/pointers are non-inputs; `authorizes: nothing`.
- **`no-secrets-in-image`** — `SESSION_CHAIN_ARCHIVE_BODY_ROOT` and credentials are runtime env
  only; stored material carries no API keys.
- **`absent-is-not-none`** — miss ≠ unreadable ≠ not-storing ≠ ring miss; no fifth storage class.
- **`cited-code-is-verified-not-assumed`** — cite live `session_chain_archive/store.rs`,
  `pg_session_chain_archive.rs`, `chain_snapshot/store.rs`, `research_session_books.rs` — not
  Python-era paths.
- **Massive license: research only** — no trader redistribution of stored books.

Also do not reopen shipped session-archive identity, **first-wins** (unique-per-put body keys
required), prune isolation, or closed vocabulary; do not raise the 48-cap; do not buy hist-chain;
do not absorb AI lab / corpus-wait completion / chore rituals; do not implement S3 this ship; do
not move ring bodies without a later human Decision card.

## 9. Open questions

None — Owner A (exact shipped operator strings; missing object = opaque
`session book unreadable: <reason>`; no S3/volume/BYTEA chrome), ring Non-move + named residual
AC-22, AC-15/AC-24 Verify by test, exact AC-8 `session archive not storing` (no store-error alias),
named `SESSION_CHAIN_ARCHIVE_BODY_ROOT` (no silent default; nest-under-ring forbidden),
unique-per-put body locator (S2 Critical repair), migrator clear/drop as DoD for AC-1/2, and
re-pin of `/api/_research/session-books` conformance are settled.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"cec469e9f03a6d6d8d78a30d66d029abb4081da9fd2322357be34b2ee058e82b","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"0b07881f47cb8b4d6d28bb6976c8aa299aa8aa2e822c9706fca5bd556c619342","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"a22173172f27018a88e09904b0be15db2c4db11be78f99e453d7a04b2de91c47","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":1,"conflict_id":"c705f8f76927879fb69f9f38b0575c7b5cbda31ebf87bbefdcbd9ed273890643","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"40a7bfedb6e77921766d338eab5c3c1e09d453b7615043e54b5c8ac4bf944407","disposition":"folded","section":"§3"}]}
-->
