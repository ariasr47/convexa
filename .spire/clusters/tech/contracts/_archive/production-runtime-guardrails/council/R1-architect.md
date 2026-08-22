# R1 — architect position: production-runtime-guardrails

## Position

### Technical shape

Production readiness must be a construction prerequisite, not a warning emitted after the server has already become reachable. The bootstrap flow should be:

`process environment -> raw configuration -> environment classification -> validation and storage preflight -> validated runtime configuration -> stores/crypto/router -> bind listener -> spawn workers`.

The load-bearing mechanism is a closed bootstrap type with separate development and production arms. Only the production arm can construct a production server, and its constructor returns an error unless every required guardrail is satisfied. The server/router constructor accepts that validated type rather than raw environment strings, so a caller cannot accidentally bypass validation. Validation should collect all violations, render only variable names and non-secret reasons, and terminate non-zero before the listener binds or any background worker starts.

Environment classification must itself fail closed. A Railway runtime marker forces the production arm and conflicts with an explicit development declaration. Outside Railway, an explicit production declaration selects production; a missing declaration is permitted only for debug builds so the existing local-development experience keeps ephemeral fallbacks. A release build with no declaration refuses startup. This does not infer every possible hosting platform; I assume non-Railway production deploys will set the explicit environment declaration.

The production configuration constructor must enforce these requirements:

- A Postgres-backed durable-store configuration is present, the binary contains Postgres support, the pool can be established, and a trivial query succeeds before bind. Every state-bearing factory that otherwise selects JSON, SQLite, memory, or filesystem metadata fallback must receive the validated production arm and refuse that fallback for accounts, sessions, settings, encrypted credentials, IV history, scanner state, snapshot metadata, and session-archive metadata. Redis remains optional because it is a rebuildable cache, not a durable system of record; a Redis fault may retain the existing memory-cache degradation.
- The session-archive body root is explicit rather than the development default, exists or can be created, and passes a create/write/fsync/remove sentinel before bind. This proves reachability and writeability, not persistence across host replacement; the deployment lane must still prove the path is a mounted durable volume by a restart/redeploy drill. Requiring a remote body store is explicitly outside this feature because the shipped filesystem body-store boundary already keeps large bodies out of app Postgres.
- Operator metrics have a non-empty, production-strength secret. The existing constant-time token comparison remains the access mechanism. Metrics stay read-only, off trader routes, and unavailable through the trader-origin proxy; a missing token is fatal in production rather than making the operator route public.
- Browser origins are a non-empty exact allowlist. Each entry is parsed once into a scheme/host/optional-port origin, rejects wildcard and opaque origins, rejects paths/query/fragment, and requires HTTPS in production. The CORS layer receives this compiled allowlist plus explicit method/header sets; production code never passes Tower's `Any`. CORS is browser isolation only and does not replace authentication or rate limits for direct HTTP clients.
- Cookie construction is derived from a validated production cookie policy: `Secure` and `HttpOnly` are mandatory, the cookie is host-only unless a separately justified domain is configured, and the same-site mode is fixed to the current first-party Pages-proxy flow. An incompatible override is a startup error, not a warning. Expiry and server-side session revocation semantics remain unchanged.
- Both session-signing material and credential-encryption material resolve to stable key rings. Ephemeral generation exists only inside the development arm and is not callable from the production constructor.

### Cryptographic continuity and rotation

Use two independent internal key-ring types: one for HMAC session signing and one for authenticated credential encryption. Each contains exactly one active write/sign key and zero or more retired verify/decrypt-only keys. Key identifiers are non-secret; key material is runtime-injected, never serialized, logged, committed, or baked into the image. The production parser rejects duplicate identifiers, a missing active identifier, malformed material, and active material below the required strength.

New credential ciphertext uses a versioned internal envelope containing the envelope version, key identifier, nonce, and authenticated ciphertext. Encryption always uses the active key; decryption dispatches by key identifier. The legacy unversioned ciphertext decoder remains as a deliberately isolated compatibility arm using an explicitly configured legacy key derived exactly as the current implementation derives it. Successful legacy or retired-key decryption returns both the plaintext and a `rewrap required` disposition. The auth service immediately produces new ciphertext through the crypto boundary and writes only that ciphertext through the credential-store port. A failed rewrap never overwrites the old value; a decrypt/authentication failure remains `no usable secret`, never plaintext disclosure or an application-wide error.

New session cookies carry a signing-key identifier and are signed only by the active signing key. Verification accepts the addressed retired key, while the legacy cookie verifier tries only the explicitly configured legacy signing key. A successful retired/legacy verification is marked for refresh so the auth boundary issues a cookie signed by the active key. Rotation is therefore two-phase: add a new active key while retaining the old key for reads, allow lazy rewrap/refresh to drain old material, then remove the old key only after non-secret key-identifier counters and the maximum session lifetime show no remaining dependency. Removing a key early predictably makes its remaining credentials unusable or sessions anonymous; the system must not guess another key.

Environment variables are acceptable for this phase because they match the existing Railway/runtime-injection mechanism and team familiarity. A managed KMS/Vault envelope would improve custody but adds network availability, identity, cost, and operational states without being required by the brief. The key-ring boundary should make a future KMS-backed key provider replaceable without changing auth stores or HTTP handling.

### Isolation and failure rules

- Configuration, origin, cookie, or key-ring invalidity in production is a bootstrap failure before network readiness. It is not governed by best-effort degradation because silently serving with an unsafe boundary is the failure this feature exists to prevent.
- Failure to reach required durable stores during initial production bootstrap is fatal. A later Postgres outage retains the current isolation: auth/state-bearing operations fail closed through their existing error class while anonymous bundle/SSE computation remains available and does not touch the auth store.
- Runtime credential decrypt failure yields no usable credential. Lazy rewrap failure preserves the prior ciphertext and may emit a secret-free operational event containing only the key identifier and failure class.
- Development retains current ephemeral secrets, local stores, permissive loopback origins, and non-secure local-cookie capability, but the startup log must label that arm as development. No development default is copied into the production arm.
- Production validation must not initiate vendor fetches, scoring, bundle computation, or SSE work. Storage probes are bounded by timeouts and occur before workers start.

### Structural enforcement

The feature should be guarded by tests that poison the forbidden states and prove the build goes red:

- A table-driven production validation matrix removes or corrupts each required item independently and proves construction fails; the development matrix proves local fallbacks still construct.
- A source/build guard proves the production router path cannot reference wildcard CORS or ephemeral-key constructors, and proves the guard is non-vacuous by injecting the forbidden reference in the test fixture.
- Crypto golden tests prove current legacy ciphertext and cookies remain readable with their legacy keys, new writes use only the active key, retired keys are read-only, unknown/removed keys fail closed, corruption fails authentication, and rewrap never sends plaintext to a store.
- Store-factory tests prove production cannot select JSON/SQLite/memory fallback while development still can. The archive-root probe is tested for absent, read-only, and successful roots.
- A secret-egress scan covers logs, errors, serialized values, and image/build inputs. Only key identifiers may appear in diagnostics.
- The quant-engine and all score/gate/fingerprint modules must have an empty feature diff; a pinned score/tier/fingerprint fixture before and after production configuration proves byte identity.

### Binding constraints retained

- `[secret-encrypted-at-rest]`: recoverable API keys remain authenticated-encrypted before the store boundary; stores receive ciphertext only, and decrypt failure is no usable secret.
- `[no-secrets-in-image]`: all origins, tokens, database locations, and key rings are runtime-injected; no secret literal or value enters the repository or container layers, and the existing non-root image requirement remains.
- `[structural-over-prose-enforcement]`: validated types, closed environment arms, key-ring types, factory refusal, and mutation-proven guards make forbidden production states impossible or build-breaking rather than merely documented.
- `[operator-vs-trader-path-separation]`: metrics remain read-only, side-effect-free, off all trader/bundle routes, unlinked, and blocked at the trader-origin proxy. Startup validation adds no trader-visible data flow.
- `[best-effort-isolated-or-null]`: optional bundle computations and their null-on-failure behavior are untouched. This feature's bootstrap refusal is a deliberate safety boundary, while credential decrypt failure continues to degrade to no usable secret without breaking bundle/SSE.
- `[additive-keeps-score-byte-identical]`: configuration, auth crypto, CORS, cookies, and bootstrap modules cannot be imported by the pure quant engine; entry gate, score, tier, and fingerprint remain byte-identical.
- All domain math remains unchanged: vendor gamma still drives the strike profile/walls while analytic generalized Black-Scholes gamma drives the flip; cost-of-carry, rate/dividend handling, the one-day time floor, the ±20% 100-point nearest-crossing flip search, GEX/DEX formulae and sign conventions, max-pain/PCR and Vol/OI full-chain scope, window-scoped GEX/DEX, IV/HV/term/skew rules, VWAP bands, and NBBO-mid versus display-last-trade/closed-session spot semantics are untouched. The mechanism is an empty quant-engine diff plus the byte-identity pin, not a prose promise.

### Options compared and explicit non-goals

The chosen central validator beats deployment-runbook-only checks on structural enforcement and review cost: it adds a small familiar Rust type boundary and prevents unsafe startup on every host, whereas a runbook can drift silently. Versioned key rings beat replacing single secrets in place on continuity and scalability: they add modest parsing/state complexity but permit planned rotation without mass logout or permanent credential loss. Runtime-injected rings beat KMS for this phase on cost and team familiarity; the internal provider boundary preserves the later upgrade path. Exact CORS allowlisting beats wildcard plus proxy reliance because it closes the direct Railway browser surface with negligible runtime cost.

We explicitly do not add or change endpoint signatures, response bodies, frontend behavior, trader copy, scoring, quant math, SSE payloads, database migration concurrency, OpenAPI generation, telemetry export, load tests, worker topology, distributed rate limiting, backup/PITR policy, remote object storage, Kubernetes, or a managed secrets service. Those are separate production-maturity features and mixing them here would increase blast radius without strengthening this feature's bootstrap invariant.

## Risks I see

- Production classification outside Railway is only as strong as the explicit environment declaration. A deployment system that falsely declares development can bypass production rules; the next deployment-maturity round should make that declaration immutable in infrastructure configuration.
- Runtime write probes cannot prove that a filesystem path survives host replacement. Only a redeploy/restart persistence drill can establish the volume property, so the contract must not claim more than explicit-path reachability and writeability.
- Lazy cryptographic migration creates an operational overlap period. Removing a retired key before all credentials have been read/rewrapped or sessions have expired causes predictable loss of usability; key-identifier counters and a documented two-phase removal gate are required.
- Cookie refresh on legacy verification requires the auth boundary to be able to attach a replacement cookie to authenticated responses. If the current resolver cannot do that, the old signing key must remain until natural expiry or a contained middleware seam must be introduced.
- Tightening CORS can expose an undocumented browser origin. Exact allowlisting is still the correct failure mode, but deployment inventory must identify every legitimate Pages/custom/local origin before production rollout.
- Requiring Postgres reachability before bind makes transient database startup ordering visible as a crash/restart loop. Bounded connection retries belong in the platform supervisor policy; the API must not become partially ready with fallback state.
- Strong active-key encoding may differ from the current arbitrary-string-to-SHA-256 derivation. The legacy decoder must preserve that derivation exactly, while new active keys use validated random material; conflating the two would strand existing ciphertext.

## Assumptions I'm making about the other two lanes

- I assume Product agrees that unsafe production configuration produces process refusal, not a degraded anonymous service; if false, the central bootstrap invariant conflicts with the observable goal.
- I assume Product defines the production deployment as Railway today and requires any later host to set an explicit environment declaration; if false, environment classification needs another non-spoofable platform signal.
- I assume Product accepts current authenticated sessions remaining valid during a planned signing-key overlap; if rotation is intended to revoke every session, the retired verification path should be removed for session keys only.
- I assume Product does not require Redis for correctness or durability; if false, Redis must move from optional cache to a production bootstrap dependency and its outage semantics must be redesigned.
- I assume Product accepts a required explicit, writable session-body root plus a deployment persistence drill for this feature; if it requires runtime-provable remote durability, the deferred remote-object-store feature must be pulled into scope.
- I assume UX has no trader-facing surface or copy obligation because invalid production configuration exits before serving and runtime credential-decrypt failure already maps to the established unavailable state; if false, a new interface contract is required.
- I assume UX/Product require first-party browser access through the Cloudflare proxy and do not require arbitrary embedded or cross-site cookie use; if false, the same-site and origin policy must be reconsidered before synthesis.
- I assume the backend can refresh a successfully verified legacy session cookie on an authenticated response; if false, signing-key rotation must rely on retaining the old verifier through maximum session lifetime.
- I assume the current stored credential corpus uses one legacy unversioned AES-GCM format derived from the existing encryption secret; if false, each additional historical format needs its own explicit decoder and golden fixture rather than heuristic key trial.
