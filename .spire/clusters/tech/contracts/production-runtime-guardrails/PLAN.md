# production-runtime-guardrails — implementation plan

> **For backend executioners:** implement task-by-task in dependency order. Each task uses the
> cycle failing test → observe failure → minimal implementation → observe pass → commit. Execute
> from the workspace root. If this plan contradicts the tree, **STOP and report the conflict**;
> do not weaken `SPEC.md` or silently substitute another safety claim.

**Goal:** Make an explicitly production API process refuse traffic until its runtime mode,
Postgres state, archive-body root, operator metrics, browser/cookie boundary, and rotatable
cryptographic material satisfy the approved pre-bind contract, while retaining today's simple
development startup and every existing HTTP/trading shape.

**Architecture:** Refactor startup into one typed pipeline:
`RawRuntimeConfig → RuntimeMode → ValidatedRuntimeConfig → production preflight → AppState/router →
listener bind → BackgroundWorkers::spawn`. A new `runtime_guardrails` module owns closed validation,
safe diagnostics, origins/cookie policy, schema/archive probes, and release evidence types. Auth owns
addressed signing/encryption key rings and compatibility reads; production state construction accepts
only the validated production arm and a preflighted Postgres handle. The Massive socket supervisor,
warmer, scanner, and archive ensure loop all move behind listener bind.

**Tech stack:** Rust 2021 · Axum 0.8 / Tokio · Tower HTTP 0.6 · SQLx/Postgres behind the existing
`postgres` feature · AES-256-GCM · HMAC-SHA-256 · React 19/Vitest 4 test baseline only · Nx 23
command wrappers · GitHub Actions Postgres service. The feature implementation remains backend-only;
the frontend lane is limited to two pre-existing test-oracle repairs. **`NO_UI_CHANGE`.**

## Track map

| Track | Tasks | Notes |
|---|---|---|
| Backend | B0–B10 | One sequential lane; the source boundaries are too coupled to split honestly without inventing an intermediate contract. |
| Frontend | F0–F2 | Test-only GATE Z repair: exactly three existing spec files; F2 is the frontend closer. |
| Verification | V1–V9 | Runs after B10/F2; those are the lane closers. |

## Global Constraints

Every task inherits these constraints.

- Preserve the exact production order: environment → raw config → closed mode → validated arm →
  storage/crypto preflight → state/router → listener bind → workers. A failed stage cannot construct
  or call a later one.
- `Prod | Dev | Test | Staging` is the complete mode vocabulary. Railway or release builds reject a
  missing/unknown `APP_ENV`; only a non-Railway debug build may default missing mode to `Dev`.
- Production has no JSON, SQLite, memory, or filesystem-metadata durable fallback. An existing optional
  capture service may remain explicitly disabled, but a configured service cannot become disabled after
  a Postgres/open failure; session archiving is mandatory. Redis is still an optional rebuildable cache.
  Do not add advisory locks, transactional migrations, a release migration job, worker separation, or
  replica coordination in this slice.
- The archive probe proves explicit-path reachability/writeability/flushability only. It must never be
  described as replacement durability; only the real Railway volume receipt can prove AC7.
- First-party production cookies only: host-only, `Secure`, `HttpOnly`, `Path=/`, `SameSite=Lax`.
  Cross-site auth and `SameSite=None` remain rejected.
- Secret-bearing values may enter cryptographic operations, database connections, and constant-time
  comparisons, but never diagnostics, tracing fields, HTTP bodies, receipts, source fixtures, image
  layers, or test failure messages. Non-secret key ids may be logged.
- Do not scan the encrypted credential corpus at startup and do not try every key. Addressed dispatch
  is structural: versioned data names exactly one key; legacy data uses only the explicitly configured
  legacy decoder.
- No endpoint, response field, route, SSE payload, dashboard surface, score, tier, entry gate,
  fingerprint, or quant result changes. `libs/quant-engine/**`, `apps/dashboard-e2e/**`, and
  `libs/api/**` are read-only. Under `apps/dashboard/**`, only
  `src/app/features/auth/riskInputs.spec.tsx` and
  `src/app/app.risk.spec.tsx` and
  `src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts` may change; every runtime,
  component, copy, style, fixture, config, and other test file remains read-only. Pre-existing root
  formatting failures in `AGENTS.md` or `libs/api/**` are baseline evidence only, never authority for
  the frontend lane to edit them.
- AC7 and AC26 remain `UNVERIFIABLE` and ship-blocking until the deployment operator performs the real
  Railway drill/capture and QA independently checks the evidence. A local test or locally fabricated
  PASS receipt cannot substitute.
- Check exit codes after every command. Do not accept a printed pass summary with a non-zero exit.
- Use `cargo fmt`, never a repo-wide format writer. Commit only task-owned paths and preserve unrelated
  dirty workspace changes.

The following block is copied verbatim from `INTERFACE_CONTRACT.md`.

## Conformance spec

The live conformance run uses a valid production-profile server and intentionally sends no operator token to the second endpoint, proving the anonymous metrics denial shape. The successful token path and non-JSON transport properties are deliberately carried by the required transport receipt because this runner cannot inject arbitrary headers or inspect cookie/CORS assertions.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/health",
      "path_params": {},
      "query": {},
      "required": {
        "status": "string",
        "service": "string",
        "durable_store": "string",
        "metrics_auth": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_metrics",
      "path_params": {},
      "query": {},
      "expect_status": 401,
      "required": {
        "error": "string",
        "detail": "string"
      }
    }
  ]
}
```

## Ground truth before implementation

- `Config::from_env()` currently invents a session-signing key, and `crypto.rs` independently invents
  an encryption key. Production construction therefore cannot distinguish configured from ephemeral
  material until B1–B4 remove those implicit choices.
- `AppState::new()` currently connects/falls back among Postgres/local adapters and calls
  `StockStreamHub::spawn`; `server::serve()` then spawns warmer/archive/scanner before binding. B5/B6
  must move all four task producers behind bind.
- `Pg::connect()` currently logs and swallows migration failure. Production preflight must use a new
  strict path; non-production may retain its current degrading behavior.
- `server.rs` currently applies Tower `Any` for origins, methods, and headers. Production may never
  construct that layer.
- `metrics_token_ok` currently compares strings directly. Production uses constant-time bytes after
  decoding a valid base64url token.
- The current embedded migration set ends at v12. This plan checks the compiled set dynamically; it
  does not hardcode 12 as the future definition of current.

---

### Task B0 — Pin baselines and add the runtime module seam

**Files:** `apps/api/src/lib.rs`; `apps/api/src/runtime_guardrails/mod.rs` (create);
`apps/api/tests/production_runtime_guardrails_isolation.rs` (create).

- [ ] Record the current exit/result for:

```powershell
cargo test -p api-rust -p quant-engine
cargo check -p api-rust --features postgres
git diff --stat -- apps/dashboard apps/dashboard-e2e libs/api libs/quant-engine
```

Expected before work: the two Cargo commands exit 0; the four read-only trees have no feature diff.
Record the actual test count in the task commit message; do not invent a plan-time number.

- [ ] Add a failing source-boundary test that requires `pub mod runtime_guardrails;`, asserts the new
  module never imports `quant_engine`, and poisons its scanner with a fixture string so the guard is
  demonstrably non-vacuous.
- [ ] Create only the module seam:

```rust
//! Closed pre-bind production construction contract.
pub mod archive;
pub mod config;
pub mod diagnostics;
pub mod origins;
pub mod preflight;
pub mod receipts;
```

The child files land in later tasks; use empty compilable modules only if the failing test requires
them in this commit. Do not move live startup yet.

- [ ] Run the named isolation test and the default suite; both exit 0. Commit:
  `test(runtime): pin production guardrail module boundary`.

**Reviewer probe:** the boundary test scans at least one real runtime file and fails when a synthetic
`use quant_engine` line is injected.

---

### Task B1 — Closed mode classification and raw environment acquisition

**Files:** `apps/api/src/config.rs`; `apps/api/src/runtime_guardrails/config.rs` (create);
`apps/api/src/main.rs`.

- [ ] First write table-driven tests over an injected environment map, not the process-global env.
  Cover all four exact tokens, case/whitespace rejection, every Railway marker, debug/release policy,
  and the allowed non-Railway debug default. Required public shape:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode { Prod, Dev, Test, Staging }

pub struct HostContext { pub railway: bool, pub release: bool }

pub struct RawRuntimeConfig {
    pub app_env: Option<String>,
    pub config: Config,
    pub database_url: Option<String>,
    pub allowed_browser_origins: Option<String>,
    pub metrics_secret_token: Option<String>,
    pub session_active_key_id: Option<String>,
    pub session_keys_json: Option<String>,
    pub session_legacy_key: Option<String>,
    pub encryption_active_key_id: Option<String>,
    pub encryption_keys_json: Option<String>,
    pub encryption_legacy_key: Option<String>,
}

pub fn classify_mode(raw: Option<&str>, host: HostContext)
    -> Result<RuntimeMode, BootstrapViolation>;
```

- [ ] Refactor `Config::from_env()` into deterministic acquisition from a `RuntimeEnv` reader. Remove
  session/encryption key generation from raw acquisition. Ordinary non-security defaults remain byte
  compatible. `RawRuntimeConfig::from_env()` reads the security variables exactly once and trims only
  presence checks; it must retain no `Debug` output containing values.
- [ ] Detect Railway by presence of any of `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`,
  `RAILWAY_SERVICE_ID`, or `RAILWAY_DEPLOYMENT_ID`; do not log their values. Detect release with
  `!cfg!(debug_assertions)`.
- [ ] At `main`, classify the mode before dispatching any command capable of opening a store or worker.
  Pass the raw/mode pair to `serve`; non-serving commands may consume their validated non-production
  config but may not bypass invalid Railway/release mode classification.
- [ ] Tests must assert invalid mode performs zero calls against a counting config/store factory.
  Run the focused tests, default suite, and Postgres check. Commit:
  `feat(runtime): classify explicit environment before side effects`.

**Reviewer probe:** `APP_ENV=production` is rejected; only literal `prod` selects production. A release
binary without `APP_ENV` fails before `Config` can construct a vendor client.

---

### Task B2 — Aggregate production validation, origins, metrics, cookies, and diagnostics

**Files:** `apps/api/src/runtime_guardrails/config.rs`;
`apps/api/src/runtime_guardrails/diagnostics.rs` (create);
`apps/api/src/runtime_guardrails/origins.rs` (create); `apps/api/src/config.rs`;
`apps/api/Cargo.toml`.

- [ ] Write failing unit matrices for every pure configuration reason in SPEC §4, duplicate collapse,
  exact category/reason order, singular/plural copy, canary non-egress, and a valid production profile.
  Define the closed carrier exactly as:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
pub enum ViolationCategory {
    RuntimeMode, DurableStore, ArchiveBodyRoot, SessionSigning,
    ApiKeyEncryption, ApiKeyRotation, OperatorMetrics,
    AllowedBrowserOrigins, SessionCookies,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct BootstrapViolation {
    pub category: ViolationCategory,
    pub reason: ViolationReason,
}

pub enum ValidatedRuntimeConfig {
    Production(ProductionRuntime),
    Development(NonProductionRuntime),
    Test(NonProductionRuntime),
    Staging(NonProductionRuntime),
}
```

`ViolationReason` is also a closed enum; `Display` returns only the exact SPEC §4 literals. Sort by an
explicit ordinal function, then deduplicate `(category, reason)` before counting.

- [ ] Implement `AllowedBrowserOrigins::parse` with `url::Url`: require HTTPS, a host, no username,
  password, path other than `/`, query, or fragment; reject wildcard/opaque values; remove default 443;
  lowercase scheme/host through URL normalization; deduplicate in insertion order. Store parsed
  `HeaderValue`s so request-time CORS performs no parsing.
- [ ] Validate `METRICS_SECRET_TOKEN` by URL-safe-no-pad decode, requiring at least 32 decoded bytes.
  Reject blank and strings containing the documented placeholder names. Store decoded bytes in a
  redacted wrapper whose `Debug` prints `SecretBytes([REDACTED])`.
- [ ] Add `subtle = "2"` as a direct dependency. B6 must compare decoded token bytes with
  `ConstantTimeEq`; do not rely on a transitive copy or ordinary string equality.
- [ ] Implement `ProductionCookiePolicy` as a zero-choice type:

```rust
pub struct ProductionCookiePolicy;
impl ProductionCookiePolicy {
    pub const SECURE: bool = true;
    pub const HTTP_ONLY: bool = true;
    pub const SAME_SITE: &'static str = "Lax";
    pub const PATH: &'static str = "/";
    pub const DOMAIN: Option<&'static str> = None;
}
```

Reject any production env attempting a domain, insecure flag, disabled HttpOnly, or SameSite other
than Lax. Add raw acquisition for `AUTH_COOKIE_DOMAIN` and `AUTH_COOKIE_HTTP_ONLY`; retain existing
dev defaults.
- [ ] `ProductionRuntime::try_from` performs all pure checks before any probe, returns the complete
  ordered `BootstrapRefusal`, and cannot expose its raw input through `Debug` or error chaining.
- [ ] Run focused tests and canary scan of captured diagnostics. Commit:
  `feat(runtime): validate production browser and operator boundaries`.

**Reviewer probe:** a list containing one valid origin plus one invalid origin refuses the whole
profile; it never silently keeps only the valid member. `https://example.com:443` and
`https://example.com` collapse to one origin.

---

### Task B3 — Versioned session-signing ring and first-party cookie emission

**Files:** `apps/api/src/services/auth/cookies.rs`;
`apps/api/src/services/auth/service.rs`; `apps/api/src/routes/auth.rs`;
`apps/api/src/runtime_guardrails/config.rs`.

- [ ] Replace the string signer with the injected ring API, beginning with golden tests for the legacy
  `<sid>.<hmac>` format and new `v1.<kid>.<sid>.<hmac>` format:

```rust
#[derive(Clone)]
pub struct SigningKeyRing {
    active: KeyId,
    keys: BTreeMap<KeyId, SecretKey32>,
    legacy: Option<LegacySigningKey>,
}

pub enum CookieVerification { Valid { session_id: String }, Anonymous }

impl SigningKeyRing {
    pub fn sign(&self, session_id: &str) -> String;
    pub fn verify(&self, value: Option<&str>) -> CookieVerification;
}
```

HMAC input for v1 is the byte sequence `v1.<kid>.<sid>`. Decode the addressed key id and call
`Mac::verify_slice`; never compare encoded signatures manually and never iterate over the ring.
- [ ] Parse `AUTH_SESSION_KEYS_JSON` as a JSON object whose keys match
  `[A-Za-z0-9_-]{1,32}` and whose values decode to exactly 32 base64url bytes. Reject active-id missing,
  duplicate decoded material, placeholder material, and malformed maps. JSON itself cannot carry a
  duplicate object key safely, so add a serde visitor that rejects duplicate key names while parsing.
- [ ] Preserve the byte-exact legacy derivation: existing `AUTH_SESSION_SIGNING_KEY` bytes are passed
  directly to HMAC. It is verify-only when the ring variables are present. In non-production, an
  omitted stable signer creates an ephemeral active ring and emits exactly the specified development
  warning once.
- [ ] Change `AuthConfig.signing_key` to `SigningKeyRing`; resolve/logout use ring verification; every
  new login/signup/OAuth cookie uses only the active id.
- [ ] Make the production cookie header a function of `ProductionCookiePolicy`, always yielding
  `gf_session=<value>; Path=/; Secure; HttpOnly; SameSite=Lax` with no Domain attribute. Preserve the
  existing name, expiry/revocation behavior, and local insecure-cookie path for non-production. The
  production clearing header uses the same attributes plus `Max-Age=0`; logout cannot emit a weaker
  cookie policy than login.
- [ ] Test retained former key, removed id, unknown id, malformed v1, invalid MAC, legacy configured,
  legacy absent, and the rule that no fallback key is attempted. Commit:
  `feat(auth): add addressed signing-key rotation`.

**Reviewer probe:** poison the addressed key and leave another valid material value in the map; the
cookie must become anonymous rather than authenticate through the second key.

---

### Task B4 — Versioned encryption ring and persisted lazy rewrap

**Files:** `apps/api/src/services/auth/crypto.rs`;
`apps/api/src/services/auth/service.rs`; `apps/api/src/services/auth/store.rs`;
`apps/api/src/routes/auth.rs`; `apps/api/src/runtime_guardrails/config.rs`.

- [ ] Start with golden tests for the old base64 `nonce || ciphertext` token and new envelope. Required
  API:

```rust
pub struct EncryptionKeyRing {
    active: KeyId,
    keys: BTreeMap<KeyId, SecretKey32>,
    legacy: Option<LegacyEncryptionKey>,
}

pub enum Decryption {
    Active(String),
    RewrapRequired { plaintext: String, source: RewrapSource },
}

impl EncryptionKeyRing {
    pub fn encrypt(&self, plaintext: &str) -> Result<String, CryptoFailure>;
    pub fn decrypt(&self, envelope: &str) -> Result<Decryption, CryptoFailure>;
}
```

New output is `v1.<kid>.<nonce-base64url>.<ciphertext-base64url>`. Use AES-GCM `Payload` with AAD
`v1.<kid>`. Legacy `AI_KEY_ENCRYPTION_KEY` retains the exact SHA-256 passphrase derivation and standard
base64 decoding already shipped.
- [ ] Reuse B3's strict duplicate-detecting key-map parser for
  `AI_KEY_ENCRYPTION_KEYS_JSON`; require exactly one active writer, distinct decoded materials, valid
  ids, and 32-byte material. Production never calls the ephemeral constructor. Non-production emits
  the exact development warning once only when it actually constructs an ephemeral encryption key.
- [ ] Route credential writes through the injected active ring before `AuthStore::set_credential`.
  On a successful retired/legacy read, call a single helper:

```rust
fn persist_rewrap(&self, rec: &CredentialRecord, plaintext: &str) -> Result<(), AuthError> {
    let next = self.encryption.encrypt(plaintext).map_err(|_| auth_unavailable())?;
    self.store.set_credential(&rec.user_id, &rec.kind, &next, &rec.last4, &rec.provider)
        .map(|_| ())
        .map_err(|_| auth_unavailable())
}
```

Do not clear or overwrite the old ciphertext before that store call succeeds. A readable plaintext
may serve the current credential-dependent action when rewrap persistence fails, matching SPEC §5;
the stored old value remains retryable.
- [ ] Add store-spy tests proving plaintext never crosses the store port, rewrap writes only active
  envelopes, failed rewrap preserves old bytes, unknown/removed ids do not try other keys, tampering
  version/kid/nonce/ciphertext returns no plaintext, and restart with only the active key reads a
  successfully rewrapped record.
- [ ] Emit only a closed `credential_decrypt_failed` / `credential_rewrap_failed` event and an
  available non-secret key id. Never log the envelope or error source from AES/base64.
- [ ] Run auth tests and the existing auth/interface suite. Commit:
  `feat(auth): add authenticated encryption rotation and rewrap`.

**Reviewer probe:** mutation of the key id must fail authentication because the id is AAD, even when
both ids map to otherwise valid keys.

---

### Task B5 — Strict Postgres schema and archive-root preflight

**Files:** `apps/api/src/db/migrations.rs`; `apps/api/src/db/postgres.rs`;
`apps/api/src/runtime_guardrails/preflight.rs` (create);
`apps/api/src/runtime_guardrails/archive.rs` (create);
`apps/api/src/services/session_chain_archive/body_store.rs`;
`apps/api/src/state.rs`.

- [ ] Write Postgres-feature tests against `TEST_DATABASE_URL` for empty/current/partial/future schema
  and connection failure. Expose compiled truth rather than hardcoding a version:

```rust
pub fn compiled_migrations() -> &'static [(i64, &'static str, &'static str)];

pub struct SchemaPreflight { pub pg: Pg }
impl SchemaPreflight {
    pub async fn run(database_url: &str, timeout: Duration)
        -> Result<Self, PreflightFailure>;
}
```

`run` connects under the timeout, emits `schema_preflight_started`, invokes the existing ordered
`migrations::apply`, rejects any `schema_migrations.version` not in `compiled_migrations()`, asserts
all compiled versions are recorded, performs `SELECT 1`, and queries required columns for `users`,
`sessions`, `user_settings`, `credentials`, `iv_samples`, `scan_rows`, `scan_heartbeat`, `scan_bundles`,
`scan_structure_history`, `structure_outcomes`, `ai_rec_daily`, `user_book`, `grok_links`,
`chain_snapshots`, and `session_chain_archive`. Emit `schema_preflight_finished` only on success.
- [ ] Add `Pg::connect_strict` or accept the preflight-created `Pg` directly. Production must never use
  the current migration-swallowing/fallback path. Preserve `Pg::connect` behavior only for explicitly
  non-production callers.
- [ ] Implement `ArchiveRootProbe::run` under one configurable timeout. Reject unset/empty/conflicting
  roots before I/O. On a unique child sentinel: `create_new`, write fixed non-secret bytes,
  `sync_all`, reopen/read/compare, sync the containing directory on supported Unix targets, then remove.
  A guard object removes the sentinel on every failure path. Windows directory-sync unsupported is a
  named supported-platform result, not a persistence claim.
- [ ] Test missing, equal/nested conflicts, success/cleanup, read-only, timeout via an injected probe
  port, and an injected flush failure. Failure returns only `AbsentOrConflicting`, `Unreachable`,
  `Unusable`, or `TimedOut`; it never contains the configured path.
- [ ] Refactor production `AppState` construction to accept `ProductionPreflight { pg, archive_root }`.
  Its auth, IV, scanner, snapshot, and session-archive metadata factories choose their Postgres arms
  directly. Any attempt to request local/memory metadata returns a `Durable store` violation. An
  explicitly optional disabled service may stay disabled only when its existing enable flag is false;
  it cannot be the result of a failed Postgres/open attempt, and the session archive can never take that
  arm in production. Redis may still degrade to memory.
- [ ] Run Postgres integration tests and default tests. Commit:
  `feat(runtime): require current Postgres schema and writable archive root`.

**Reviewer probe:** insert migration version `max(compiled)+1`; startup must refuse without deleting or
ignoring it. Do not add an advisory lock or claim rollback of a partially applied migration.

---

### Task B6 — Enforce pre-bind construction, exact CORS, metrics auth, and post-bind workers

**Files:** `apps/api/src/server.rs`; `apps/api/src/state.rs`;
`apps/api/src/infrastructure/massive/ws.rs`; `apps/api/src/routes/health.rs`;
`apps/api/src/routes/mod.rs`; `apps/api/src/main.rs`;
`apps/api/src/runtime_guardrails/preflight.rs`.

- [ ] Add failing phase-order tests with a recorder and poison hooks. The accepted sequence must be:

```rust
ModeSelected,
PureValidationFinished,
SchemaPreflightStarted,
SchemaPreflightFinished,
ArchiveProbeFinished,
StateConstructed,
RouterConstructed,
ListenerBound,
WorkersStarted,
```

Each independently invalid pure category records nothing after `PureValidationFinished`. Schema or
archive failure records only its bounded preflight and never `StateConstructed`, `ListenerBound`, or
`WorkersStarted`.
- [ ] Split the Massive hub constructor so it does not spawn:

```rust
pub struct StockStreamWorker { /* owns cmd_rx and event sender */ }
pub fn dormant(cfg: &Config) -> (StockStreamHub, StockStreamWorker);
impl StockStreamWorker { pub fn spawn(self); }
```

`AppState::construct` returns `(AppState, BackgroundWorkers)`. Only after `TcpListener::bind` succeeds
does `BackgroundWorkers::spawn(state)` start the Massive supervisor, warm subscriptions, warmer,
archive ensure worker, and scanner. Test constructors use a dormant hub and no worker.
- [ ] Build the production CORS layer from B2's normalized exact origins using Tower's predicate/list
  support. Pin methods `HEAD, GET, POST, PUT, DELETE` and headers `Accept, Content-Type,
  Authorization, X-Metrics-Token`; allow credentials; let Tower answer OPTIONS. Production code must
  contain no `Any`. Non-production retains its current loopback/local behavior through a separate
  function.
- [ ] Change metrics auth to decode the presented bearer/header token as base64url and compare decoded
  bytes with `subtle::ConstantTimeEq` against the configured secret.
  Accept either header, preserve missing/wrong 401 `{error, detail}`, preserve correct 200 payload, and
  perform the credential check before reading cache/scanner state.
- [ ] Health derives `durable_store` from the constructed backend, not the ambient env. A valid
  production state reports `postgres`; `metrics_auth` reports `required`. Add a test proving neither
  field nor any new field claims volume persistence.
- [ ] Generate one `startup_id` per serve attempt from 16 random bytes. The exact structured events
  `schema_preflight_started`, `schema_preflight_finished`, and `listener_bound` carry that same id,
  `RELEASE_GIT_SHA`, `RAILWAY_DEPLOYMENT_ID`, and RFC3339 UTC time, without secret configuration.
- [ ] CORS integration matrix covers positive and negative methods/headers, exact/lookalike/suffix/
  subdomain/scheme/port origins, default-port normalization, credentials, OPTIONS, and requests with
  no Origin including HEAD/auth. Add a mutation test that rewrites the production builder to `Any`
  and proves the structural guard fails.
- [ ] Run focused server tests, default suite, and Postgres check. Commit:
  `feat(runtime): bind only after guardrails and start workers afterward`.

**Reviewer probe:** `StockStreamHub::spawn` must not appear in `state.rs`; a failed bind must also start
zero background workers.

---

### Task B7 — Deterministic mounted-volume drill and receipt schemas

**Files:** `apps/api/src/main.rs`; `apps/api/src/runtime_guardrails/receipts.rs` (create);
`apps/api/tests/production_runtime_guardrails_receipts.rs` (create).

- [ ] Add a non-serving `production-volume-drill` command with two explicit phases. It never starts
  `AppState`, vendors, a router, or a listener:

```text
api-rust production-volume-drill prepare --volume-id ID --mount-path PATH --state-file PATH
api-rust production-volume-drill verify  --volume-id ID --mount-path PATH --state-file PATH
  --receipt PATH --restart-kind restart|redeploy --executor NAME
  --before-evidence LOCATOR --after-evidence LOCATOR
```

`prepare` requires Railway project/environment/service/deployment ids and `RELEASE_GIT_SHA`, writes a
unique relative sentinel under the mount with `create_new`, flushes it, records its SHA-256 and the
before identity in the state file, and leaves the sentinel present. The operator then replaces the
deployment. `verify` requires the same release/project/environment/service/volume/mount identity and a
different current deployment id, reads and hashes the same locator, removes it only after equality,
and writes the final receipt.
- [ ] Define `VolumeReceiptV1` with every INTERFACE_CONTRACT field. Its validator requires two distinct
  deployment ids, matching 64-lowercase-hex hashes, ordered UTC timestamps, non-empty executor and
  evidence locators, successful cleanup, and matching release/environment/service/volume identity.
  It rejects local execution when Railway markers are absent and never accepts `PASS` from a manually
  supplied result flag; PASS is derived only after verification.
- [ ] Define `TransportReceiptV1` with a backend-owned `local_tests` section and operator-owned
  `migration_startup_owner`. The backend generator may write `local_tests.result=PASS`, but overall
  remains `INCOMPLETE` until the operator section is present and valid. Validate replica count exactly
  one, exactly one target-release startup id, strict timestamp ordering, same git SHA/deployment, and
  three non-empty evidence locators.
- [ ] Receipt tests cover every missing/mismatched field, stale release, same deployment ids, bad hash,
  cleanup failure, second startup id, timestamp inversion, secret-canary rejection, and a happy schema.
  Test prepare/verify over a temp mount with injected Railway identity; label that test `schema-only`,
  never durability proof.
- [ ] Run receipt tests and CLI `--help`. Commit:
  `feat(runtime): add production volume drill and evidence schemas`.

**Reviewer probe:** deleting the post-read cleanup or using the same deployment id must make receipt
validation fail. The CLI cannot emit PASS when run without Railway identity.

---

### Task B8 — Production-profile Postgres harness and CI gate

**Files:** `apps/api/tests/production_runtime_guardrails.rs` (create);
`apps/api/tests/production_runtime_guardrails_postgres.rs` (create);
`.github/workflows/ci.yml`; `.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json`
(generated by the documented execution command, not hand-authored).

- [ ] Add the pure/HTTP harness for AC1–4, AC6, AC8–15, AC17–22, and AC25. Use a counting fixture
  vendor and dormant worker starter. Exercise the real router in-process for CORS/cookie/metrics/no-
  Origin behavior and spawn a real `serve` attempt for before-bind connection refusal.
- [ ] Add the Postgres harness gated by `TEST_DATABASE_URL`. Create an isolated database/schema name
  per test run and clean only that owned namespace. It must prove:
  1. fresh/current/partial/future migration behavior;
  2. no listener during failed schema application;
  3. Postgres-backed account, session, settings, encrypted credential, IV sample, scan/history,
     chain-snapshot metadata, and session-archive metadata survive destruction/reconstruction of
     `AppState` against the same database;
  4. removing/breaking Postgres prevents replacement readiness;
  5. Redis absence remains only cache degradation.
- [ ] Run the harness with an output flag:

```powershell
$env:PRG_TRANSPORT_RECEIPT='.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json'
cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture
```

The test writes git SHA, UTC time, executor, exact command, and named PASS evidence for local bootstrap,
schema, health, metrics 401/200, CORS matrix, cookie attributes, and no-Origin compatibility. It writes
overall `INCOMPLETE` and `migration_startup_owner.result=PENDING`; it must never fabricate operator
evidence.
- [ ] Add a Postgres service to the backend CI job (`postgres:17`, health-cmd `pg_isready`) and run:

```yaml
- name: Production runtime guardrails (postgres)
  run: cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture
  env:
    TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/convexa_test
```

Keep the existing default suite and release build. Do not add backup/PITR, dependency automation,
OpenAPI, load testing, telemetry export, or migration concurrency here.
- [ ] Run CI-equivalent commands locally where Postgres is available. Commit:
  `test(runtime): gate production profile against Postgres`.

**Reviewer probe:** the persistence test must construct two different `AppState` values; reusing one
pool/state object does not prove process-replacement behavior.

---

### Task B9 — Negative-space guards, safe examples, and operator runbook

**Files:** `apps/api/tests/production_runtime_guardrails_isolation.rs`;
`apps/api/.env.example`; `apps/api/Dockerfile`; `docs/ENVIRONMENTS.md`;
`docs/production-runtime-guardrails.md` (create).

- [ ] Extend isolation tests with mutation-proven checks:
  - production constructors cannot name `open_memory`, `open_sqlite`, `open_json`,
    `SigningKeyRing::ephemeral`, or `EncryptionKeyRing::ephemeral`; `disabled` is allowed only for the
    existing explicit `CHAIN_SNAPSHOT_ENABLED=false` arm, never after an open failure, and never for the
    mandatory session archive. Mutation tests distinguish operator disable from failure fallback;
  - production CORS cannot import/use `Any`;
  - `state.rs` cannot call `StockStreamHub::spawn`;
  - runtime/auth/CORS modules cannot be imported by `libs/quant-engine` or scoring modules;
  - dashboard/client trees contain no feature string or runtime-guardrail surface;
  - Docker/environment examples contain variable names/placeholders but no base64 key/token value,
    database URL, origin, cookie, ciphertext, or plaintext canary.
- [ ] Add an end-to-end secret-egress test. Seed distinct canaries for database URL, origin, metrics
  token, every key material value, legacy key, cookie, ciphertext, and plaintext; capture refusal text,
  structured tracing output, HTTP responses, receipt JSON, and build-context file list; assert none of
  the canaries appears. Assert the allowed non-secret key id does appear in the runtime credential
  failure event as the anti-vacuity control.
- [ ] Run existing signal/quant goldens and `apps/api/tests/score_identity.rs` with guardrails on/off
  against the same market fixture. Assert entry gate, score, tier, fingerprint, and serialized quant
  golden bytes are identical.
- [ ] Update `.env.example` with names only: four APP_ENV values;
  `ALLOWED_BROWSER_ORIGINS`; active ids/maps/legacy variables; cookie fixed policy variables;
  `SESSION_CHAIN_ARCHIVE_BODY_ROOT`; `RELEASE_GIT_SHA`; Railway-provided identity names. Remove the
  stale suggestion that production origins are normally unset and remove any advice that a single
  mutable key is the production writer.
- [ ] Keep the image secret-free/non-root and document required production variables in Dockerfile
  comments. Do not add values or COPY an env file.
- [ ] In the operator runbook, give the exact sequence: replica count one → deploy one startup owner →
  capture service config/events/logs → augment transport receipt → volume `prepare` → restart/redeploy →
  volume `verify` → independent QA. State that AC7/AC26 remain blocking until the two release-bound
  receipts validate and that a health response is not volume proof.
- [ ] Run all focused guards, format, and diff fences. Commit:
  `docs(runtime): publish fail-closed production profile and evidence drill`.

**Reviewer probe:** each source scan has an anti-vacuity assertion and an in-memory poisoned input that
fails it; a scan that merely finds no matches is insufficient.

---

### Task B10 — Backend closer: serve and write generic conformance receipt

**Files:** `.spire/clusters/tech/contracts/production-runtime-guardrails/conformance-receipt.json`
(generated only).

**Depends on:** B0, B1, B2, B3, B4, B5, B6, B7, B8, B9. This is the **only backend closer**. It
does not edit or re-implement worker-owned source paths.

- [ ] Free ports, start the release/Postgres-feature server against a disposable real Postgres
  database with `APP_ENV=prod`, valid generated rings/token/origin, explicit temp archive root,
  `WARM_ENABLED=0`, `SCAN_ENABLED=0`, and `LIQUID_SESSION_ENSURE_ENABLED=0`. Never print generated
  secret values. Wait for `listener_bound` and verify its startup id follows the two schema events.
- [ ] Run the installed gate:

```powershell
node .codex/tools/gates.mjs interface_conformance `
  --contract .spire/clusters/tech/contracts/production-runtime-guardrails/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 `
  --report .spire/clusters/tech/contracts/production-runtime-guardrails/conformance-receipt.json
```

Expected: exit 0; receipt `PASS`; health 200 has all required typed fields; unauthenticated metrics is
401 with `{error, detail}`. Then stop the server and free ports.
- [ ] Confirm the backend-local transport receipt is `INCOMPLETE` only because
  `migration_startup_owner` awaits release evidence. Do not mark it PASS locally. Confirm the volume
  receipt is absent/PENDING unless the deployment operator actually ran the Railway replacement drill.
- [ ] Commit only the generated generic conformance receipt if repository practice tracks it. Report
  AC7 and AC26 as `UNVERIFIABLE` pending the named operator/QA evidence, not as failed software tests.

**Reviewer probe:** generic conformance PASS is not accepted as either transport completeness or volume
durability.

---

### Task F0 — Repair the risk-input durable-write oracle

**Lane:** frontend test-only. **Files:**
`apps/dashboard/src/app/features/auth/riskInputs.spec.tsx` only.

- [ ] Record the frontend repair baseline before editing:

```powershell
$repairBase = git rev-parse HEAD
npx nx run @convexa/dashboard:test-ci--src/app/features/auth/riskInputs.spec.tsx
```

Expected failing-first reproduction: non-zero exit; the anonymous test fails only at
`expect(localStorage.length).toBe(0)` because `AppThemeProvider` legitimately persists
`convexa.theme-paint`. After the F0 commit, record both `$repairBase` and the F0 commit SHA in the
frontend-lane handoff so F2 can restore the exact value even if the backend lane commits meanwhile.
- [ ] Import `THEME_PAINT_KEY` from `./firstPaintTheme` and replace the global-length oracle with the
  actual invariant: mounting/focusing the anonymous risk-input surface performs no auth/settings/risk
  durable write, while the theme provider may own its one documented key. Add this helper and assertion:

```tsx
import { THEME_PAINT_KEY } from './firstPaintTheme';

function nonThemeDurableEntries(): Array<[string, string | null]> {
  return Array.from({ length: localStorage.length }, (_, index) => {
    const key = localStorage.key(index);
    return [key ?? '', key === null ? null : localStorage.getItem(key)] as [string, string | null];
  })
    .filter(([key]) => key !== THEME_PAINT_KEY)
    .sort(([a], [b]) => a.localeCompare(b));
}

expect(localStorage.getItem(THEME_PAINT_KEY)).not.toBeNull();
expect(nonThemeDurableEntries()).toEqual([]);
```

Keep the existing `backend.calls.settingsPut === 0` assertion; together the two assertions prove no
server settings write and no client durable auth/settings write. Do not clear or suppress the theme key
inside `Mount`, and do not change `ThemeProvider`, `RiskInputsSection`, or any runtime source.
- [ ] Add a pure anti-vacuity assertion in the same test: temporarily set
  `convexa.settings.poison`, assert `nonThemeDurableEntries()` reports it, then remove it before the final
  empty assertion. This proves the filter does not ignore all storage.
- [ ] Re-run the exact focused target. Expected: exit 0 and the whole risk-input spec passes. Commit only
  this file: `test(auth): ignore owned theme paint in risk durability guard`.

**Reviewer probe:** the assertion exempts exactly `THEME_PAINT_KEY`, not all `convexa.*` keys; a synthetic
auth/settings key must make it fail.

---

### Task F1 — Make the lazy operator-route assertion deterministic

**Lane:** frontend test-only. **Files:** `apps/dashboard/src/app/app.risk.spec.tsx` only.

**Depends on:** F0. It does not edit F0's path or any runtime route/component.

- [ ] Capture both sides of the intermittent baseline before editing. First show that focused execution
  is ordinarily green, then stress the configured full suite until the QA failure is observed (maximum
  five attempts so the task remains bounded):

```powershell
npx nx run @convexa/dashboard:test-ci--src/app/app.risk.spec.tsx
1..5 | ForEach-Object {
  npx nx test @convexa/dashboard -- --run --maxWorkers=2
  if ($LASTEXITCODE -ne 0) { break }
}
```

Expected pre-fix evidence: focused exit 0; at least one full-suite attempt exits non-zero with only the
`/_ops/metrics` case still showing `data-testid="route-fallback"`. If five local attempts do not catch an
intermittent failure, attach QA's fresh failing full-suite transcript as the failing-first evidence and
do not weaken or delete the test.
- [ ] Keep the real lazy route and real operator page. Preload only its module in the test before rendering
  that route, prove the module exported the expected component, then wait explicitly for the fallback to
  leave before asserting the existing separation invariant:

```tsx
it('"/_ops/metrics" renders WITHOUT the trader shell/nav (own chrome)', async () => {
  const operatorModule = await import('@/pages/operator-metrics/operator-metrics');
  expect(typeof operatorModule.OperatorMetrics).toBe('function');

  renderAt('/_ops/metrics');
  await waitFor(() => expect(screen.queryByTestId('route-fallback')).not.toBeInTheDocument());
  expect(await screen.findByText(/Operator Metrics/)).toBeInTheDocument();
  expect(screen.queryByTestId('app-shell')).toBeNull();
  expect(screen.queryByTestId('nav-ticker')).toBeNull();
  expectNoOpsLink();
});
```

Do not mock `App`, `Routes`, `OperatorMetrics`, `React.lazy`, or `Suspense`; do not increase the global
test timeout. The assertions still prove the real `/_ops/metrics` route resolves to the real operator
module outside trader chrome and remains unlinked.
- [ ] Run the focused test repeatedly to prove the fix is not a lucky pass:

```powershell
1..10 | ForEach-Object {
  npx nx run @convexa/dashboard:test-ci--src/app/app.risk.spec.tsx
  if ($LASTEXITCODE -ne 0) { throw "app.risk focused repetition failed" }
}
```

Expected: ten consecutive exit-0 runs.
- [ ] Run the full configured suite and typecheck:

```powershell
npx nx test @convexa/dashboard
npx nx typecheck @convexa/dashboard
```

Expected: both exit 0 with zero failed files/tests and no TypeScript error.
- [ ] Format only the owned file:

```powershell
npx prettier --check "apps/dashboard/src/app/app.risk.spec.tsx"
```

Expected: exit 0. If a root `npm run format:check` separately reports only pre-existing formatting in
`AGENTS.md` or `libs/api/**`, record those paths and their pre-F1 status; do not edit, stage, or reformat
them.
- [ ] Prove the task changed only its test oracle:

```powershell
git diff --name-only -- apps/dashboard
git diff --exit-code -- apps/dashboard `
  ":(exclude)apps/dashboard/src/app/features/auth/riskInputs.spec.tsx" `
  ":(exclude)apps/dashboard/src/app/app.risk.spec.tsx"
```

Expected at this point: only F0's risk-input spec and F1's `app.risk.spec.tsx`; the exclusion diff exits
0. Commit only the owned file: `test(routes): deterministically resolve lazy operator metrics`.

**Reviewer probe:** a mutation that leaves the operator import promise pending must leave the fallback
mounted and fail deterministically. Removing the preload must restore the bounded full-suite stress
susceptibility (use QA's captured failure if five local attempts remain green); changing the operator
route to render inside `AppShell` or adding an `/_ops` link must still fail the test.

---

### Task F2 — Repair the decision-card feature-range oracle and close frontend

**Lane:** frontend test-only; this is the **only frontend closer**. **Files:**
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts` only.

**Depends on:** F0, F1. It does not edit either worker path or any runtime/UI source.

- [ ] Reproduce the stale baseline before editing:

```powershell
npx nx run @convexa/dashboard:test-ci--src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts
```

Expected failing-first reproduction: non-zero exit only in changed-path ownership because
`c678dc1..HEAD` includes unrelated backend history after the shipped decision-card feature.
- [ ] Replace the open-ended historical range with the feature's approved implementation baseline from
  its archived plan and its shipped boundary. Extract the path predicate so it is mutation-testable:

```ts
const DECISION_CARD_BASE = 'f41fe37';
const DECISION_CARD_SHIP = '3b165c8';

function changedPaths(base: string, head: string): string[] {
  return execFileSync('git', ['diff', '--name-only', `${base}..${head}`], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
}

function violatesDecisionCardOwnership(changed: readonly string[]): boolean {
  return (
    changed.some((file) => /^(?:apps\/api|libs\/api)(?:\/|$)/.test(file)) ||
    changed.some((file) => /^apps\/dashboard\/.*(?:api|client|store)(?:\/|\.)/i.test(file))
  );
}
```

Before evaluating, run `git merge-base --is-ancestor DECISION_CARD_BASE DECISION_CARD_SHIP` through
`execFileSync`; a missing/re-written feature range is a hard failure. Assert
`violatesDecisionCardOwnership(changedPaths(DECISION_CARD_BASE, DECISION_CARD_SHIP)) === false`.
Do not use `HEAD`, the production-runtime-guardrails branch base, or the full repository history as the
decision-card feature boundary.
- [ ] Add anti-vacuity controls calling `violatesDecisionCardOwnership` with
  `apps/api/src/server.rs`, `libs/api/src/convexa.ts`, and a dashboard `*Store.ts` path; each must return
  true. A normal decision-card component path must return false.
- [ ] Re-run all three focused specs:

```powershell
npx nx run @convexa/dashboard:test-ci--src/app/features/auth/riskInputs.spec.tsx
npx nx run @convexa/dashboard:test-ci--src/app/app.risk.spec.tsx
npx nx run @convexa/dashboard:test-ci--src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts
```

Expected: all three exit 0.
- [ ] Run the full configured dashboard suite and frontend typecheck:

```powershell
npx nx test @convexa/dashboard
npx nx typecheck @convexa/dashboard
```

Expected: both exit 0; Vitest reports zero failed files/tests. Check exit codes rather than trusting the
printed count.
- [ ] Prove the GATE Z repair produced no runtime/UI diff and exactly the three authorized test paths:

```powershell
git diff --name-only "$repairBase..HEAD" -- apps/dashboard
git diff --exit-code "$repairBase..HEAD" -- apps/dashboard `
  ":(exclude)apps/dashboard/src/app/features/auth/riskInputs.spec.tsx" `
  ":(exclude)apps/dashboard/src/app/app.risk.spec.tsx" `
  ":(exclude)apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts"
git diff --exit-code "$repairBase..HEAD" -- apps/dashboard-e2e libs/api
```

Expected: the first command lists exactly the three spec files; both `--exit-code` commands exit 0 with no
output. Commit only the decision-card spec:
`test(ai-rec): scope decision-card ownership to shipped feature range`.

**Reviewer probe:** the guard must fail on a poisoned backend/client/store path inside the sealed feature
range while ignoring unrelated commits after `3b165c8`; no UI snapshot or runtime component changed.

---

## Independence

All rows are honestly `no`: B1–B6 repeatedly cross the same configuration/auth/bootstrap seams, B7
adds a command in the same `main.rs`, B8/B9 verify those shared paths, and B10 must run the integrated
server. F0/F1/F2 have disjoint paths, but SPEC §4 names no frontend implementation files, so PLAN_METHOD
forbids marking any frontend row `yes`; F2 depends on both workers and is the required closer. No two rows in
the frontend lane share a path.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B0 | backend | `apps/api/src/lib.rs`; `apps/api/src/runtime_guardrails/**`; `apps/api/tests/production_runtime_guardrails_isolation.rs` | — | no |
| B1 | backend | `apps/api/src/config.rs`; `apps/api/src/runtime_guardrails/config.rs`; `apps/api/src/main.rs` | B0 | no |
| B2 | backend | `apps/api/src/runtime_guardrails/config.rs`; `apps/api/src/runtime_guardrails/diagnostics.rs`; `apps/api/src/runtime_guardrails/origins.rs`; `apps/api/src/config.rs`; `apps/api/Cargo.toml` | B1 | no |
| B3 | backend | `apps/api/src/services/auth/cookies.rs`; `apps/api/src/services/auth/service.rs`; `apps/api/src/routes/auth.rs`; `apps/api/src/runtime_guardrails/config.rs` | B2 | no |
| B4 | backend | `apps/api/src/services/auth/crypto.rs`; `apps/api/src/services/auth/service.rs`; `apps/api/src/services/auth/store.rs`; `apps/api/src/routes/auth.rs`; `apps/api/src/runtime_guardrails/config.rs` | B3 | no |
| B5 | backend | `apps/api/src/db/migrations.rs`; `apps/api/src/db/postgres.rs`; `apps/api/src/runtime_guardrails/preflight.rs`; `apps/api/src/runtime_guardrails/archive.rs`; `apps/api/src/services/session_chain_archive/body_store.rs`; `apps/api/src/state.rs` | B4 | no |
| B6 | backend | `apps/api/src/server.rs`; `apps/api/src/state.rs`; `apps/api/src/infrastructure/massive/ws.rs`; `apps/api/src/routes/health.rs`; `apps/api/src/routes/mod.rs`; `apps/api/src/main.rs`; `apps/api/src/runtime_guardrails/preflight.rs` | B5 | no |
| B7 | backend | `apps/api/src/main.rs`; `apps/api/src/runtime_guardrails/receipts.rs`; `apps/api/tests/production_runtime_guardrails_receipts.rs` | B6 | no |
| B8 | backend | `apps/api/tests/production_runtime_guardrails.rs`; `apps/api/tests/production_runtime_guardrails_postgres.rs`; `.github/workflows/ci.yml`; `.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json` | B7 | no |
| B9 | backend | `apps/api/tests/production_runtime_guardrails_isolation.rs`; `apps/api/.env.example`; `apps/api/Dockerfile`; `docs/ENVIRONMENTS.md`; `docs/production-runtime-guardrails.md` | B8 | no |
| B10-backend-closer | backend | `.spire/clusters/tech/contracts/production-runtime-guardrails/conformance-receipt.json` | B0, B1, B2, B3, B4, B5, B6, B7, B8, B9 | no |
| F0 | frontend | `apps/dashboard/src/app/features/auth/riskInputs.spec.tsx` | — | no |
| F1 | frontend | `apps/dashboard/src/app/app.risk.spec.tsx` | F0 | no |
| F2-frontend-closer | frontend | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts` | F0, F1 | no |

F2 is the sole frontend closer. All three frontend paths are pairwise disjoint and test-only.

## Verification track

Run in order. Check `$LASTEXITCODE` after every command.

### V1 — Default Rust regression suite

```powershell
cargo test -p api-rust -p quant-engine
```

Expected: exit 0; count is at least the B0 baseline plus all new unit/non-Postgres tests. Named tests
include mode matrix, violation ordering/dedup, origin matrix, signing rotation, encryption rewrap,
archive probe cleanup, phase order, CORS matrix, receipt validation, secret egress, and score identity.

### V2 — Real Postgres production-profile suite

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/convexa_test'
cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture
```

Expected: exit 0; fresh/current/partial/future cases pass; every named durable record survives state
reconstruction; failed Postgres replacement never becomes ready. If no disposable Postgres is
available locally, record the exact environment blocker; CI's identical service-backed command remains
mandatory before build completion.

### V3 — Production compilation and image boundary

```powershell
cargo check -p api-rust --all-targets --features postgres
cargo build -p api-rust --release --features postgres
docker build -f apps/api/Dockerfile -t convexa-api:production-runtime-guardrails .
```

Expected: all exit 0; release image contains `api-rust`, runs as uid 10001, and its history/filesystem
contain no `.env` or configured secret canary.

### V4 — Focused HTTP/transport integration

```powershell
cargo test -p api-rust --features postgres --test production_runtime_guardrails -- --nocapture
```

Expected: exit 0; metrics missing/wrong → 401 with no metrics body; correct token → unchanged 200;
exact CORS positive matrix passes; every negative method/header/origin arm has no permission; no-Origin
GET/HEAD/auth results are unchanged; cookie attributes are exact.

### V5 — Receipt generation boundaries

```powershell
$env:PRG_TRANSPORT_RECEIPT='.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json'
cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture
cargo test -p api-rust --test production_runtime_guardrails_receipts -- --nocapture
```

Expected: both exit 0. The local transport section is PASS, overall is `INCOMPLETE`, and the operator
section is `PENDING`. Receipt schema tests pass. No volume PASS receipt is generated locally.

### V6 — Live generic interface conformance

Run B10's production-profile server, then:

```powershell
node .codex/tools/gates.mjs interface_conformance `
  --contract .spire/clusters/tech/contracts/production-runtime-guardrails/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 `
  --report .spire/clusters/tech/contracts/production-runtime-guardrails/conformance-receipt.json
```

Expected: exit 0 and generic receipt PASS for both endpoints. This does not discharge AC7 or AC26.

### V7 — Isolation and no-move fences

```powershell
git diff --stat -- apps/dashboard apps/dashboard-e2e libs/api libs/quant-engine
git diff --name-only -- apps/api/src/services/analytics.rs apps/api/src/services/scanner/projection.rs
cargo test -p api-rust --test production_runtime_guardrails_isolation -- --nocapture
cargo test -p api-rust --test score_identity
```

Expected: both diffs print nothing; both test commands exit 0; entry gate, score, tier, fingerprint,
and quant goldens remain byte-identical.

### V8 — Formatting and lint

```powershell
cargo fmt --all -- --check
cargo clippy -p api-rust --all-targets --features postgres -- -D warnings
npm run format:check
```

Expected: both Cargo commands exit 0. If repository-wide pre-existing Clippy warnings exist at B0, use
the recorded baseline and require zero warnings in changed files; do not edit unrelated modules to clean
them up. `npm run format:check` either exits 0 or reproduces only the recorded pre-existing failures in
root `AGENTS.md` and/or `libs/api/**`; require no new formatting failures and do not edit those baseline
paths. The owned `app.risk.spec.tsx` must independently pass the scoped Prettier check in F1 and V9.

### V9 — Frontend baseline repair and zero-UI-diff gate

```powershell
npx nx run @convexa/dashboard:test-ci--src/app/features/auth/riskInputs.spec.tsx
npx nx run @convexa/dashboard:test-ci--src/app/app.risk.spec.tsx
npx nx run @convexa/dashboard:test-ci--src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts
npx nx test @convexa/dashboard
npx nx typecheck @convexa/dashboard
npx prettier --check "apps/dashboard/src/app/app.risk.spec.tsx"
```

Expected: all six commands exit 0. `riskInputs.spec.tsx` permits only the documented
`THEME_PAINT_KEY` and still proves zero auth/settings network or durable writes. The decision-card guard
checks `f41fe37..3b165c8`, proves that range exists, and mutation-proves backend/client/store exclusions.
`app.risk.spec.tsx` preloads the real operator module, removes the lazy fallback deterministically, and
retains the off-shell/unlinked assertions; its focused target also passes ten consecutive runs. The
`$repairBase..HEAD` diff contains exactly the three authorized spec files; runtime dashboard,
dashboard-e2e, and `libs/api` diffs are empty. This gate repairs test baselines only and does not change
or re-verify a browser-visible feature state.

## External release verification — deliberately not local

The deployment operator, not a builder, must perform these after the release candidate exists:

1. Set target Railway API replica count to one and deploy the exact git SHA.
2. Capture complete service configuration, deployment events, and startup logs from deployment start
   through first readiness; augment `migration_startup_owner` in the transport receipt.
3. Run `production-volume-drill prepare`, replace the deployment, then run `verify` against the same
   volume and release; save `production-runtime-guardrails-volume.json` plus before/after evidence.
4. QA independently cross-checks platform evidence, release identities, startup-id set, timestamp
   order, hashes, distinct deployments, cleanup, and secret absence.

Expected final state: both release-bound receipts validate PASS. Until then AC7 and AC26 are
`UNVERIFIABLE` and ship-blocking.

## Task-to-acceptance map

| Acceptance criteria | Tasks / gates |
|---|---|
| AC1–3 mode, side-effect order, aggregate copy | B1, B2, B6, B8, V1/V4 |
| AC4–5 valid profile and durable replacement | B5, B6, B8, V2/V6 |
| AC6 archive preflight | B5, B8, V1/V4 |
| AC7 mounted-volume replacement proof | B7, external release verification, QA |
| AC8–9 metrics auth and isolation | B2, B6, B8, V4/V6 |
| AC10–12 exact CORS/no-Origin | B2, B6, B8, V4 |
| AC13–15 cookie policy/signing rotation | B2, B3, B8, V4 |
| AC16–19 encryption rotation/confidentiality/isolation | B4, B8, V1/V2 |
| AC20–21 dev path and warnings | B1–B4, B8, V1 |
| AC22 safe diagnostics | B2, B4, B9, V1/V3 |
| AC23 score/math identity | B9, V1/V7 |
| AC24 NO_UI_CHANGE | B9, V7, review |
| AC24 configured frontend baseline evidence | F0, F1, F2, V9 |
| AC25 schema boundary | B5, B8, V2 |
| AC26 one startup owner | B6, B7, external release verification, QA |

## Risk register

| Risk | Failure | Plan response |
|---|---|---|
| R1 | Pure validation probes a secret dependency before reporting all repairable errors. | B2 separates pure accumulation from B5 probes; B6 phase recorder makes the boundary observable. |
| R2 | Production accidentally reaches a local adapter through an existing fallback. | B5 accepts a preflighted `Pg` and B9 mutation-scans production constructors. |
| R3 | Stock WebSocket remains a hidden pre-bind worker. | B6 introduces dormant hub/worker halves and asserts `state.rs` contains no spawn call. |
| R4 | Rotation tries all keys and masks a wrong id. | B3/B4 addressed dispatch tests poison the named key while leaving another valid key available. |
| R5 | Legacy compatibility changes bytes and strands existing cookies/ciphertext. | B3/B4 golden fixtures pin current HMAC input and SHA-256/base64 legacy derivation before refactor. |
| R6 | Rewrap overwrites the only readable ciphertext before persistence succeeds. | B4 store-spy ordering and failure tests require old bytes to remain. |
| R7 | CORS is mistaken for auth and breaks direct/non-browser clients. | B6 separately tests exact browser permission and unchanged no-Origin route/auth behavior. |
| R8 | Startup probe is reported as volume durability. | B5 returns only reachability/writeability classes; B7/B9 reserve durability language for release receipts. |
| R9 | Embedded migrations race during rollout. | This slice does not solve concurrency; external gate enforces one startup owner and blocks on a second id. |
| R10 | Tests claim production while using local stores. | B8's production harness requires `--features postgres` plus real `TEST_DATABASE_URL`; health reads constructed backend. |
| R11 | A local actor fabricates PASS evidence. | B7 derives volume PASS only with Railway identity/distinct deployments and leaves transport incomplete without operator evidence. |
| R12 | Large refactor drifts trading math or UI. | B9/V7 require empty protected diffs and byte-identical score/golden results. |

## Explicit non-goals for executioners

Do not add remote object storage, OpenAPI generation, dependency bots/scanners, backups/PITR, load
tests, OpenTelemetry export, worker separation, distributed rate limiting, advisory migration locks,
KMS/Vault, Kubernetes, Kafka, microservices, new endpoints, or UI. Those are separate approved backlog
slices; including them here would violate this approved contract rather than complete it.
