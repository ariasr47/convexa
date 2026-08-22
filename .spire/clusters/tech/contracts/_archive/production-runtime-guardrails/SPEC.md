# production-runtime-guardrails — spec

**Source brief:** .spire/clusters/tech/contracts/production-runtime-guardrails/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-21

## 1. Goal + scope

Make API production safety a pre-bind construction contract for deployment operators while preserving the current low-friction development path. A process that explicitly declares production may accept traffic only after durable Postgres state, the mounted archive-body path, metrics authentication, exact browser origins, first-party cookie policy, and stable rotatable cryptographic material have all passed their named checks. The runtime probe proves only archive-path reachability and writeability; ship evidence separately proves that the path is a mounted persistent volume, because the human chose mounted-volume proof now and deferred remote object storage.

**In scope:**

- Closed runtime-mode classification and one authoritative validation/preflight stage before stores, router, listener, or workers become usable.
- Production-only refusal of local JSON, SQLite, process-memory, ephemeral-secret, wildcard-CORS, open-metrics, and cross-site-cookie fallbacks.
- Postgres connectivity and current-release schema preflight for production state; Redis remains an optional rebuildable cache.
- An explicit session-archive body root with a bounded create/write/fsync/remove probe plus a ship-blocking mounted-volume restart/redeploy sentinel drill.
- Exact production browser-origin allowlisting with explicit CORS methods, headers, and credential policy.
- Stable, independent key rings for session HMAC signing and AES-256-GCM API-key encryption, including legacy compatibility and planned rotation.
- Aggregated, stable, value-free startup diagnostics and development-only ephemeral-key warnings.
- Preservation of all existing HTTP shapes, trader routes, SSE behavior, score, tier, entry gate, fingerprint, and quant math.

**Out of scope:**

- Any React dashboard, trader, or operator web-surface change.
- New or changed endpoints, response fields, authentication eligibility, session lifetime, provider choice, archive retention, or trading behavior.
- Cross-site authentication or `SameSite=None`; production is first-party through the existing Cloudflare same-origin proxy.
- New database migration orchestration/concurrency machinery, backups/PITR, generated OpenAPI, dependency automation, load testing, telemetry export, worker separation, distributed rate limiting, or replica coordination. This slice still applies and verifies the current embedded migrations before bind under a single-startup-owner deployment constraint.
- KMS/Vault integration, bulk re-encryption, indexed rotation-progress reporting, or automatic recovery after a required key is deliberately removed.
- Kubernetes, Kafka, microservices, or a new remote-storage vendor.

**Future (deliberately deferred):**

- `remote-archive-body-store`: S3-compatible archive bodies behind the existing body-store boundary.
- Managed key custody, scheduled retirement, bulk rewrap, and corpus-indexed rotation progress.
- Explicit environment-promotion policy and continuous configuration-health history.
- The remaining production-maturity slices named in the brief.

<!-- spire:council-resolution:v1 ba81492e6074b4b510db46fc9702061ae333fde959ee207509de6f2ecf4e24f0 folded -->

## 2. Architecture

### Bootstrap boundary and runtime modes

`apps/api/src/main.rs` and `apps/api/src/server.rs` must use this order:

`environment -> RawRuntimeConfig -> RuntimeMode -> validated arm -> storage/crypto preflight -> AppState/router -> listener bind -> background workers`.

`RuntimeMode` is the closed vocabulary `Prod | Dev | Test | Staging`, selected only by `APP_ENV=prod|dev|test|staging`. A Railway marker means an explicit mode is mandatory, not that the process is production. Railway and all release builds refuse missing or unknown `APP_ENV` before any stateful factory, listener, or worker starts. Only a debug build outside Railway may default missing `APP_ENV` to `Dev`. The selected mode is logged without configured values.

`ValidatedRuntimeConfig` is a closed enum with `Production(ProductionRuntime)` and non-production arms. `ProductionRuntime::try_from(RawRuntimeConfig)` collects every safely detectable violation and is the only input accepted by the production `AppState` and router constructors. Production code cannot call ephemeral-key constructors or local durable-store adapters; development-only constructors remain available only through non-production arms.

<!-- spire:council-resolution:v1 f27f5a0e9af8681a6ade2217073f212cc32d2a25a1f6d00c9ed25e9da845ada7 folded -->

### Production state and archive proof

Production requires the binary to contain its Postgres feature, a non-placeholder `DATABASE_URL`, a pool connection, the schema usable at this binary's current embedded migration set, and a bounded trivial query before bind. `SchemaPreflight` calls the existing ordered, idempotent `db::migrations::apply` for only the migrations compiled into the current release, then checks that every compiled version is recorded and that the required current relations/columns can be queried. A fresh database reaches the current schema through that path. A failed or partial current migration exits before listener/router/workers; it does not claim transactional rollback, and the same current release may retry only after the underlying fault is corrected. A database containing unknown/future migration versions is refused rather than guessed backward-compatible.

This feature does not add an advisory lock, migration transaction framework, or separate release job. Until the queued migration-concurrency slice lands, the production deployment profile is explicitly one API startup owner: replica count is one during migration/startup and a second release/API process must not start until the first reaches readiness. The backend emits secret-free `schema_preflight_started`, `schema_preflight_finished`, and `listener_bound` events carrying one generated `startup_id`, release git SHA, Railway deployment id, and UTC timestamp. The deployment operator augments `.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json` with a release-bound `migration_startup_owner` record containing the Railway project/environment/service/deployment ids, configured replica count, the complete set of target-release startup instance ids observed from platform events, the one schema-preflight interval and listener-bound time, capture time/operator, and service-config, deployment-event, and startup-log evidence locators.

The record may say `PASS` only when the configured replica count is one; every id/timestamp is bound to the same release and deployment; exactly one target-release startup id exists from deployment start through first readiness; its schema start precedes schema finish, which precedes listener bind; and the linked platform evidence enumerates all target-release instances in that window. A missing id/window/evidence locator, a second target-release startup before readiness, a release mismatch, or a locally fabricated platform record is ship-blocking. The deployment operator owns capture; `spire-tech-qa` owns cross-checking the receipt against the platform evidence. This proves the narrow rollout constraint without claiming a database-level lock or generalized migration-concurrency solution. The production factory then supplies Postgres implementations for accounts, sessions, settings, encrypted credentials, IV history, scanner state/history, chain-snapshot metadata, and session-archive metadata. A production factory request for JSON, SQLite, memory, or filesystem metadata returns a bootstrap violation; it never silently falls back. Redis is optional and may preserve the current in-memory cache degradation because it is not a system of record.

Production also requires session archiving enabled and an explicit `SESSION_CHAIN_ARCHIVE_BODY_ROOT` that neither equals nor nests under the snapshot ring or archive-index path. Before bind, `ArchiveRootProbe` creates a unique sentinel, writes non-secret bytes, flushes the file and containing directory where supported, reads the bytes back, and removes it under one bounded timeout. Its result is named `Archive body root`; it proves only explicit-path reachability and writeability.

Mounted-volume durability is a separate release gate with an auditable receipt at `.spire/clusters/tech/state/conformance/production-runtime-guardrails-volume.json`. The backend executioner owns a deterministic drill command and receipt-schema tests; the deployment operator owns executing it against the named production Railway environment and mounted volume across an actual restart or redeploy; `spire-tech-qa` owns independently checking the receipt against the release and linked host/workflow evidence. The command writes a unique non-secret sentinel through the application mount, records its SHA-256, restart/redeploys, reads and hashes the same locator after replacement, and removes it only after the read succeeds. The receipt must contain `schema_version`, `feature`, `result`, release git SHA, Railway project/environment/service identifiers, deployment ids before/after, volume id and mount path, sentinel relative locator, write/read SHA-256 values, UTC written/verified timestamps, restart kind, executor identity, and non-secret evidence locators. `PASS` requires matching 64-hex hashes, different deployment ids, matching release/environment/volume identity, successful cleanup, and evidence that names both sides of the replacement. Missing, locally generated, stale-release, mismatched, or secret-bearing receipts do not satisfy the gate. That receipt—not the in-process probe or `/api/health`—is the durability proof. Remote object storage remains deferred because the existing body-store boundary already keeps large bodies out of Postgres and the mounted-volume rollout has the smaller blast radius.

<!-- spire:council-resolution:v1 8d713030b4831c8ae3eba091dd8a26d19d6854c63ebb5b9c37f8f584d26cd6b6 folded -->

### Browser and cookie boundary

`ALLOWED_BROWSER_ORIGINS` is a non-empty comma-separated production list compiled once into normalized origins. Each entry must be an HTTPS scheme, host, and optional non-default port only. Parsing rejects wildcard or opaque origins, embedded credentials, paths, query strings, fragments, and non-HTTPS schemes; default ports are normalized and duplicates removed. The production CORS layer pins the current route inventory to browser methods `HEAD|GET|POST|PUT|DELETE` with `OPTIONS` handled for preflight, and request headers `Accept|Content-Type|Authorization|X-Metrics-Token`, plus credential support. `HEAD` is retained because Axum's existing GET routes provide HEAD semantics; `PATCH`, `CONNECT`, and `TRACE` are intentionally not browser-allowed because no current route uses them. It never receives Tower `Any`. An exact origin receives its own allow-origin value; any other browser origin receives none. A request without `Origin`, including non-browser `HEAD`, retains its existing route and authentication result because CORS is browser isolation, not client authentication. Any future route method/header addition must update this pin and its positive/negative preflight tests in the same change.

Production authentication is first-party only through the existing Cloudflare same-origin proxy. `ProductionCookiePolicy` is fixed to host-only, `Secure`, `HttpOnly`, `Path=/`, and `SameSite=Lax`. A configured domain, `SameSite=None`, insecure transport, or disabling `HttpOnly` is a bootstrap violation. Expiry, server-side revocation, and the `gf_session` cookie name remain unchanged. Supporting secure cross-site cookies later requires a new design decision and dedicated origin/cookie/deployment tests.

`METRICS_SECRET_TOKEN` is mandatory in production, must be a base64url encoding of at least 32 bytes, and is compared in constant time after header parsing. Blank values and the documented example/placeholder values are invalid. The metrics route remains unavailable through the trader-origin proxy.

<!-- spire:council-resolution:v1 29f22b3580519a9f7553ed963bc5b391c2f3b33a28f2db0d79cf6a86dc4bd615 folded -->

### Stable cryptographic material and rotation

`apps/api/src/services/auth/cookies.rs` and `crypto.rs` gain separate `SigningKeyRing` and `EncryptionKeyRing` types. Runtime injection uses `AUTH_SESSION_ACTIVE_KEY_ID` with `AUTH_SESSION_KEYS_JSON`, and `AI_KEY_ENCRYPTION_ACTIVE_KEY_ID` with `AI_KEY_ENCRYPTION_KEYS_JSON`; each JSON value is a map from non-secret key id to base64url-encoded 32-byte material. Key ids are restricted to `[A-Za-z0-9_-]{1,32}`. Production rejects a missing active id, active id absent from the map, duplicate ids, malformed material, duplicate material under different ids, placeholder material, or any map without exactly one active writer. Existing `AUTH_SESSION_SIGNING_KEY` and `AI_KEY_ENCRYPTION_KEY` are accepted only as explicitly configured legacy decoders during migration; their existing derivations remain byte-exact. Secret values never enter diagnostics, serialization, repository files, or image layers.

New credentials use an unambiguous envelope `v1.<kid>.<nonce-base64url>.<ciphertext-base64url>`. AES-256-GCM authenticates the version and key id as associated data. Encryption always uses the active key. Versioned decryption dispatches only to the addressed id; legacy unversioned base64 dispatches only to the configured legacy decoder. Successful decrypt with a retired or legacy key returns `RewrapRequired`, and the auth service writes a newly encrypted envelope through the credential-store port. The old ciphertext is preserved unless that write succeeds. Unknown/removed ids, malformed envelopes, invalid authentication tags, or failed rewrap never expose plaintext and map to no usable credential.

New cookies use `v1.<kid>.<session-id>.<hmac>`, signed only by the active signing key with version, id, and session id covered by HMAC-SHA-256. Verification dispatches only to the addressed id; the legacy `<session-id>.<hmac>` form dispatches only to the configured legacy signer. Retired signing keys are verify-only. Because the current route-local auth helpers do not provide one universal response-attachment seam, this slice does not depend on lazy cookie refresh: the former signing key remains configured through the maximum absolute session lifetime, after which it may be removed. Removing it early predictably makes only its remaining cookies anonymous; no other key is guessed.

Startup validates only key-ring structure and an explicitly configured legacy decoder. It does not scan the credential corpus and never claims that all historical keys are present. Corpus-indexed safe-retirement proof remains future work.

<!-- spire:council-resolution:v1 f90ec10dc8b7fe12fb564b43d5a601f28a730f45d3648d43bf9a7524ffc850b6 folded -->

### Diagnostics and module ownership

`BootstrapViolation { category, reason }` is a secret-free closed type accumulated in this stable category order: `Runtime mode` → `Durable store` → `Archive body root` → `Session signing` → `API-key encryption` → `API-key rotation` → `Operator metrics` → `Allowed browser origins` → `Session cookies`. Within a category, reasons render in the order listed under §4 Copy; duplicate category/reason pairs collapse before the issue count. Rendering occurs only after validation finishes, so one start reports all safely detectable issues. Storage probes receive bounded timeouts and return closed failure classes; they never interpolate connection strings, paths, origins, tokens, key material, cookies, ciphertext, or plaintext.

Expected implementation ownership:

- `apps/api/src/config.rs`: raw environment acquisition and backward-compatible non-production defaults.
- New `apps/api/src/runtime_guardrails/`: mode classification, validated runtime arms, origins, cookie policy, key-ring parsing, archive probe, violations, and rendering.
- `apps/api/src/main.rs`, `server.rs`, and `state.rs`: enforce the pre-bind order and accept validated arms.
- `apps/api/src/db/` plus the auth, IV, scanner, snapshot, and session-archive factories: refuse production fallback adapters.
- `apps/api/src/services/auth/{cookies.rs,crypto.rs,service.rs,store.rs}` and `apps/api/src/routes/auth.rs`: versioned rings, compatibility reads, rewrap, and first-party cookie emission.
- `apps/api/src/routes/health.rs`: retain its existing shapes; a valid production instance reports authenticated metrics and `durable_store=postgres` for application state/metadata only, never archive-volume persistence.
- Production environment examples and deployment configuration: name variables and placeholders only; never contain values.

### Failure modes + isolation

- Invalid production mode, configuration, origin, cookie policy, key-ring structure, Postgres preflight, or archive-root probe is fatal before network readiness and before workers. No best-effort fallback applies at this safety boundary.
- A Postgres outage after readiness keeps the existing auth/state failure class while anonymous market reads and SSE retain their existing dependency behavior; it does not switch to a local durable store.
- Runtime credential decrypt or rewrap failure preserves ciphertext, yields no usable credential, and emits only a closed failure class plus non-secret key id when one was present.
- Redis remains optional and isolated. Vendor calls, scoring, bundle computation, and SSE work do not occur during validation.
- Non-production retains local stores, local HTTP/CORS behavior, and ephemeral crypto fallbacks, with exact development warnings when those fallbacks are active.

**Not buildable / rejected approaches:** deployment-runbook-only validation cannot prevent drift; wildcard CORS plus proxy reliance leaves the direct origin permissive; single secrets replaced in place strand cookies and ciphertext; trying every key hides configuration errors; corpus scanning at boot is unbounded and cannot identify legacy ciphertext; KMS adds a new network dependency before it is required; remote object storage is the queued next durability slice; startup probes alone must not be described as persistence proof.

## 3. Acceptance criteria (with user stories)

All criteria are ship-blocking. `test` covers software safety boundaries and silent negative space; `review` covers external deployment evidence that requires operator/QA inspection and the deliberately unchanged visible dashboard surface.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | As a deployment operator, I want an explicit runtime mode so that host detection cannot mislabel an environment. | On Railway or in any release build, missing or unknown `APP_ENV` exits non-zero before the listener binds; `prod`, `dev`, `test`, and `staging` select their named arms, while only a non-Railway debug build may default a missing value to `dev`. | test |
| 2 | As a deployment operator, I want unsafe production configuration rejected before unrelated side effects. | For each pure configuration category removed or corrupted independently, no stateful probe, listener, worker, vendor request, or domain write occurs; a store/schema/archive probe failure may leave only its bounded preflight or current-migration effects and still starts no listener or worker. | test |
| 3 | As a deployment operator, I want one repair pass. | With multiple invalid production categories, one refusal reports the headline, correct singular/plural count, and every failed category in the fixed order `Runtime mode` → `Durable store` → `Archive body root` → `Session signing` → `API-key encryption` → `API-key rotation` → `Operator metrics` → `Allowed browser origins` → `Session cookies`, with §4 reason order inside each category and no duplicate count. | test |
| 4 | As a deployment operator, I want a usable valid profile. | With a complete valid production profile and one startup owner, current embedded migrations and required-relation probes complete before bind, `GET /api/health` returns 200, `durable_store` identifies only the Postgres state/metadata backend, and `metrics_auth` reports required; the response makes no archive-volume persistence claim. | test |
| 5 | As a deployment operator, I want production state to survive process replacement. | After production writes account, session, settings, encrypted-credential, IV-history, scanner, snapshot-metadata, and session-archive-metadata records, restarting against the same Postgres instance makes each record observable through its existing read path; removing or breaking Postgres prevents the replacement process from becoming ready. | test |
| 6 | As a deployment operator, I want the archive path usable before traffic. | An absent, conflicting, read-only, non-flushable, or timed-out archive body root refuses startup; a successful probe creates, verifies, flushes, and removes its sentinel without claiming persistence. | test |
| 7 | As a deployment operator, I want auditable proof that archive bodies survive deployment replacement. | The deployment operator runs the production-volume drill across distinct deployment ids and produces `.spire/clusters/tech/state/conformance/production-runtime-guardrails-volume.json`; `PASS` is accepted only when the release/environment/service/volume identities match, write/read SHA-256 values are identical 64-hex values, UTC times and executor are present, cleanup succeeded, and linked evidence names the before/after deployments. | review |
| 8 | As a deployment operator, I want metrics closed by default in production. | Production refuses an absent, blank, placeholder, or malformed metrics token; with a valid token, an unauthenticated or incorrectly authenticated `GET /api/_metrics` returns 401 with no metrics content, while the correct token returns the unchanged metrics readout. | test |
| 9 | As a trader, I want metrics isolated from market work. | Reading or being denied `GET /api/_metrics` performs no vendor request, bundle computation, cache mutation, trader-state mutation, or SSE work. | test |
| 10 | As a deployment operator, I want exact browser origins. | Production refuses an empty list, wildcard, opaque or malformed entry, embedded credentials, path/query/fragment, or non-HTTPS entry; default ports normalize and duplicate origins collapse without broadening the list. | test |
| 11 | As a browser user, I want current routes usable only from the configured first-party origin. | Positive preflights for `HEAD|GET|POST|PUT|DELETE` and `Accept|Content-Type|Authorization|X-Metrics-Token` succeed only for an exact normalized allowlisted origin with credentials; `OPTIONS` supplies that preflight, while `PATCH|CONNECT|TRACE`, an undeclared header, a lookalike/subdomain/suffix, or a different scheme/port receives no browser permission. | test |
| 12 | As an API client, I want CORS not to masquerade as authentication. | Requests without `Origin`, including existing non-browser `HEAD` and authenticated calls, retain their pre-feature status/body behavior, while the production browser policy contains no wildcard origin/method/header arm. | test |
| 13 | As a signed-in trader, I want unambiguous first-party cookies. | Production session responses emit a host-only `gf_session` cookie with `Path=/`, `Secure`, `HttpOnly`, and `SameSite=Lax`; a domain attribute, insecure policy, disabled `HttpOnly`, or `SameSite=None` refuses startup. | test |
| 14 | As a deployment operator, I want stable session signing. | Production refuses missing, malformed, placeholder, duplicate-id, duplicate-material, or active-id-missing signing rings; every new cookie names and is signed by exactly the active id. | test |
| 15 | As a signed-in trader, I want planned signing rotation not to log me out immediately. | A cookie signed by a retained former key remains authenticated during the overlap, new cookies use only the active key, legacy cookies use only the configured legacy verifier, and removing the former key makes only its remaining cookies anonymous without trying another key. | test |
| 16 | As a signed-in trader, I want planned API-key rotation to preserve my credential. | A legacy or retained-key ciphertext remains usable, is rewrapped with the active key after successful use, and remains usable after restart with only the active key once the rewrap has persisted. | test |
| 17 | As a deployment operator, I want structural key-ring validation to remain truthful. | Startup refuses only statically provable ring errors and does not claim corpus readability; a removed or unknown historical key discovered during credential use produces the existing no-usable-credential outcome and a value-free operational event. | test |
| 18 | As a trader, I want encrypted credentials to remain confidential. | New persisted credentials use the versioned active-key envelope and never equal or contain the submitted plaintext; malformed envelopes, altered key ids/nonces/ciphertext, or authentication failure return no plaintext and do not overwrite the stored ciphertext. | test |
| 19 | As a trader, I want credential failures isolated. | With an unreadable credential or failed rewrap, its credential-dependent action reports the existing no-usable-credential outcome while anonymous market reads and the live stream retain their existing dependency behavior. | test |
| 20 | As a developer, I want local startup to remain simple. | In explicit `dev` outside production, omitting Postgres and production key rings still starts with documented local stores, loopback browser access, local cookie policy, and ephemeral signing/encryption keys. | test |
| 21 | As a developer, I want temporary local keys made visible. | Each active development cryptographic fallback emits its exact one-line development warning; a stable configured key suppresses its warning, and no production process can continue after emitting either fallback warning. | test |
| 22 | As a deployment operator, I want diagnostics safe for retained logs. | Refusal output, structured logs, errors, HTTP responses, and image/build inputs contain none of the supplied database URL, origin values, metrics token, key material, cookie, ciphertext, or plaintext; only closed categories, reasons, and non-secret key ids may appear. | test |
| 23 | As a trader, I want runtime hardening separated from trading decisions. | Given identical market fixtures before and after the feature, the entry gate, opportunity score, opportunity tier, and state fingerprint are byte-identical, and all quant-engine golden outputs remain unchanged. | test |
| 24 | As a trader, I want the product surface unchanged. | Existing dashboard routes, controls, copy, navigation, loading/degraded states, and SSE presentation show no new runtime-guardrail surface. | review |
| 25 | As a deployment operator, I want schema failure to remain pre-bind without pretending concurrency is solved. | A fresh database reaches exactly the current embedded migration set before readiness; a failed/partial current migration or unknown future version refuses startup, and a corrected single-owner retry reaches a queryable current schema without any listener having opened during failure. | test |
| 26 | As a deployment operator, I want proof that schema application had one startup owner. | For the shipped production release, `migration_startup_owner` in the transport receipt is bound to the same git SHA and Railway deployment, records replica count one and exactly one observed target-release startup id from deployment start through first readiness, orders schema-start < schema-finish < listener-bind UTC times, and links complete service-config, platform-event, and startup-log evidence; a second startup id or any missing/mismatched field blocks ship. | review |

<!-- spire:council-resolution:v1 68d42b1fbae30ecf2523753f1e775a2525e5f73d3cd1b9d860f4453dc0e6dd86 folded -->

## 4. UI + interaction

`NO_UI_CHANGE`. The React dashboard, `/_ops/metrics`, trader routes, and Cloudflare Pages presentation remain unchanged. The only human-facing material is plain-text API startup output for the deployment operator.

**Flows:** On accepted configuration, validation emits no security claim and startup proceeds normally. On refused production configuration, the process prints the complete refusal once and exits non-zero. On development fallback, startup proceeds and prints only the matching fallback warning. Recovery is configuration correction followed by process restart; there is no browser flow or retry control.

**Component states** — every applicable process-output state is specified:

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| API startup diagnostic | Accepted configuration: ordinary startup output, no new “secure” or “production ready” claim | Not applicable; validation is bounded bootstrap work, not an interactive state | Not applicable; accepted configuration needs no new message | Refused production: headline, count summary, then every failed category in stable order; process exits | Not applicable; dependency failure before bind is a refusal, not an offline/stale view |
| Development crypto warning | Absent when stable material is configured | Not applicable | Absent when no ephemeral fallback is active | Not an error state; each active ephemeral fallback prints its exact warning | Not applicable |

**Copy:**

- Headline: `Production startup refused`
- Singular: `Fix 1 configuration issue before starting the API in production.`
- Plural: `Fix {count} configuration issues before starting the API in production.`
- Runtime mode: `Runtime mode: set APP_ENV to prod, dev, test, or staging.`
- Postgres absent/invalid: `Durable store: configure Postgres for production state.`
- Postgres unreachable/unusable: `Durable store: Postgres must be reachable and usable before startup.`
- Archive root absent/conflicting: `Archive body root: configure an explicit production path.`
- Archive probe failure: `Archive body root: the configured path must be writable and flushable before startup.`
- Session signing absent/invalid: `Session signing: configure one valid active production key.`
- Encryption absent/invalid: `API-key encryption: configure one valid active production key.`
- Rotation duplicate id: `API-key rotation: key identifiers must be unique.`
- Rotation active membership: `API-key rotation: the active key must name a configured key.`
- Rotation material: `API-key rotation: key material must be valid and distinct.`
- Legacy decoder: `API-key rotation: configure the required legacy decoder.`
- Metrics: `Operator metrics: require authenticated access in production.`
- Origins missing: `Allowed browser origins: configure one or more explicit origins.`
- Origins wildcard: `Allowed browser origins: wildcard origins are not allowed.`
- Origins malformed/opaque/credentials/path/query/fragment: `Allowed browser origins: each entry must be an origin without credentials, path, query, or fragment.`
- Origins transport: `Allowed browser origins: use HTTPS in production.`
- Cookies: `Session cookies: production requires a host-only, Secure, HttpOnly, SameSite=Lax cookie.`
- Development signing warning: `Development fallback: the session-signing key is temporary and changes when this process restarts.`
- Development encryption warning: `Development fallback: the API-key encryption key is temporary; credentials encrypted with it may be unreadable after restart.`

Configured values never appear. Multiple reasons in one category render as separate closed lines and each contributes to the issue count. Passing validation never prints “Secure,” “Fully protected,” or “Production ready.” The withdrawn corpus-derived message `retain every key required to read existing encrypted credentials` must not render because startup cannot prove that claim.

Diagnostic lines always use the category order `Runtime mode` → `Durable store` → `Archive body root` → `Session signing` → `API-key encryption` → `API-key rotation` → `Operator metrics` → `Allowed browser origins` → `Session cookies`. Within a category they use the Copy-list order above, and an identical category/reason pair renders and counts once.

<!-- spire:council-resolution:v1 c5747bb607ad47a303355939a182b2d9f5632c45ff6fcae17b5bbf750d182ee1 folded -->

**Design authority:** `NO_UI_CHANGE`; `.spire/clusters/tech/context/DESIGN_SYSTEM.md` remains the sole UI authority and requires no amendment.

**Design direction:** No Curvature Terminal token, component, motion, icon, focus, responsive, or browser-copy pattern is consumed. Plain-text startup output is complete without color or terminal formatting.

## 5. Error handling

- Runtime-mode refusal uses the headline and `Runtime mode` line, exits non-zero, and performs no store, router, listener, or worker construction.
- Production validation aggregates all statically detectable configuration errors. Store/archive probes add only closed timeout/unreachable/unusable classes. Diagnostics never include the rejected value.
- A failed Postgres connection, current-migration, current-schema, or archive preflight is a startup refusal. Current migration work may be partially applied because this slice adds no transaction/concurrency mechanism, but the listener and workers remain absent; a single startup owner retries only the same current release after correction. A later Postgres outage uses existing auth/state errors and never falls back to local persistence; unrelated anonymous reads/SSE keep their current dependency behavior.
- Missing/incorrect metrics credentials return the existing 401 JSON error with no metrics body. The correct operator credential returns the unchanged readout. No market work or state mutation is triggered in either case.
- Unlisted browser origins receive no CORS permission; direct requests without `Origin` keep their route/auth result. Cross-site cookie policy is refused at startup, not degraded.
- Unknown, removed, corrupt, or unauthenticated credential envelopes yield no usable credential, preserve the old ciphertext, and log only the closed failure class and available non-secret key id. No distinct corpus-derived “rotation refused” state exists because startup does not inspect the corpus.
- Failed lazy rewrap preserves the readable old ciphertext and returns the existing credential-dependent result for that request when the plaintext was successfully obtained; subsequent attempts may retry. It never writes plaintext.
- A cookie with an unknown/removed id, invalid signature, or removed legacy verifier resolves anonymous under existing session semantics. Retained old signing keys remain through maximum absolute session lifetime; this slice adds no universal refresh middleware.
- Development fallback is allowed only in non-production arms and emits the exact warning. Production never warns and continues.

<!-- spire:council-resolution:v1 74b754e16c355b9e4c718c30ac1c2fa55c268feedc6da1a32fbb0b50880376b4 folded -->

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/production-runtime-guardrails/INTERFACE_CONTRACT.md`
**Summary for readers of this spec:** No endpoint or response shape changes. The contract pins the existing health response of a successfully validated instance and the production unauthenticated-denial shape for operator metrics; `durable_store` names only the Postgres state/metadata backend, never archive-volume persistence. Startup refusal occurs before any HTTP interface exists. CORS, cookie, authorized-metrics, bootstrap, and mounted-volume claims are bound to named receipts in the companion file.

## 7. Testing strategy

Automate the silent safety boundaries rather than matching one test per criterion:

- A table-driven bootstrap matrix covers every `APP_ENV` context and poisons each production requirement independently, then combines failures to prove aggregation, stable ordering, accepted-path viability, pre-bind refusal, and zero worker/vendor side effects.
- Production factory integration tests run against real Postgres and prove each state-bearing adapter is Postgres, state survives process replacement, local fallbacks are impossible, and Redis loss remains an isolated cache degradation. Fresh/current/partial/future-schema fixtures prove the current-migration boundary and failed startup never opens a listener. The backend also tests that one `startup_id` orders the three release/deployment-bound schema/listener events; this local test does not prove production exclusivity.
- Archive probe tests cover missing, conflicting, read-only, unflushable, timeout, success, and cleanup. The backend executioner implements and schema-tests the deterministic production-volume drill; the deployment operator executes write → restart/redeploy → byte-identical read → cleanup on the real mount; QA checks `.spire/clusters/tech/state/conformance/production-runtime-guardrails-volume.json` against the release and its evidence locators. A local receipt, unit test, health response, or in-process probe cannot substitute for it.
- CORS integration tests pin the current matrix: exact origins and normalized default ports; browser `HEAD|GET|POST|PUT|DELETE`; preflight `OPTIONS`; headers `Accept|Content-Type|Authorization|X-Metrics-Token`; credentials; negative `PATCH|CONNECT|TRACE` and undeclared headers; lookalikes/scheme/port differences; malformed entries; and no-`Origin` non-browser requests. A mutation-proven guard makes production `Any` or an unreviewed method/header addition fail.
- Cookie/key-ring golden tests pin the legacy formats, versioned envelopes, active-only writes, retired-key reads, addressed-key dispatch, corruption authentication failure, early key removal, no indiscriminate key trial, and retained-session overlap.
- Credential-store tests inspect persisted bytes, prove successful and failed rewrap ordering, and ensure stores never receive plaintext. Secret-egress tests seed unique canaries into every secret-bearing input and scan diagnostic/log/response/build outputs for absence.
- Existing endpoint conformance runs against a production-profile server using `INTERFACE_CONTRACT.md`. The backend executioner emits the local-test portion of `.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json`, keyed to git SHA and command, with pass/fail entries for bootstrap refusal, schema preflight, health-field semantics, authorized and unauthorized metrics, exact-origin/preflight CORS, first-party cookie attributes, and no-`Origin` compatibility. The deployment operator supplies its release-bound `migration_startup_owner` section from Railway configuration/events/logs, and QA cross-checks that section plus independently reruns the integration tests. The receipt cannot be complete or PASS without both portions. The generic conformance runner does not inject arbitrary transport headers, so its two endpoint probes cannot substitute for this receipt.
- Existing quant-engine goldens plus a pinned end-to-end market fixture prove entry gate, score, tier, fingerprint, and every math output byte-identical. Dashboard review confirms `NO_UI_CHANGE`.

AC7 and AC26 are `UNVERIFIABLE` and ship-blocking in a local-only run; each may be marked PASS only after the deployment operator provides its release-bound receipt evidence and QA reviews it. No prose, local receipt, health response, or in-process probe may be substituted for either external proof.

## 8. Guardrails this feature must not break

- `[secret-encrypted-at-rest]`: API keys cross the store boundary only as authenticated ciphertext; decrypt/authentication failure yields no usable secret.
- `[no-secrets-in-image]`: all database locations, origins, metrics tokens, key rings, and legacy decoders are runtime-injected; images remain non-root and contain no secret or `.env` value.
- `[structural-over-prose-enforcement]`: closed runtime types, production-only constructors, factory refusal, addressed key dispatch, and mutation-proven `Any`/ephemeral guards make forbidden states impossible or build-breaking.
- `[operator-vs-trader-path-separation]`: metrics remain read-only, off trader routes, unlinked, proxy-blocked, and unable to fetch vendors, recompute bundles, mutate caches/state, or touch SSE.
- `[best-effort-isolated-or-null]`: bootstrap refusal is the explicit production-safety boundary; optional bundle fields retain their isolated/null behavior and credential failure remains no usable secret.
- `[additive-keeps-score-byte-identical]`: runtime/auth/CORS/cookie modules cannot enter the pure quant engine; entry gate, score, tier, and fingerprint remain byte-identical.
- All gamma sourcing, generalized Black-Scholes parameters, time floor, flip grid/crossing, GEX/DEX formulae and signs, full-chain versus window scopes, IV/HV/skew/term rules, VWAP bands, NBBO-mid anchor, display-only last trade, server-side gates, and no-real-order boundary remain unchanged.
- No endpoint, response field, SSE payload, dashboard route, or trader copy changes.

## 9. Open questions

None. The human selected mounted-volume durability evidence with remote object storage deferred, and first-party-only production cookies. Every R2 technical conflict is resolved above.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"8d713030b4831c8ae3eba091dd8a26d19d6854c63ebb5b9c37f8f584d26cd6b6","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"f90ec10dc8b7fe12fb564b43d5a601f28a730f45d3648d43bf9a7524ffc850b6","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"ba81492e6074b4b510db46fc9702061ae333fde959ee207509de6f2ecf4e24f0","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":1,"conflict_id":"c5747bb607ad47a303355939a182b2d9f5632c45ff6fcae17b5bbf750d182ee1","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":2,"conflict_id":"74b754e16c355b9e4c718c30ac1c2fa55c268feedc6da1a32fbb0b50880376b4","disposition":"folded","section":"§5"},{"source":"R2-ux.md","index":0,"conflict_id":"f27f5a0e9af8681a6ade2217073f212cc32d2a25a1f6d00c9ed25e9da845ada7","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":1,"conflict_id":"68d42b1fbae30ecf2523753f1e775a2525e5f73d3cd1b9d860f4453dc0e6dd86","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":2,"conflict_id":"29f22b3580519a9f7553ed963bc5b391c2f3b33a28f2db0d79cf6a86dc4bd615","disposition":"folded","section":"§2"}]}
-->
