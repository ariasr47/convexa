# R1 — pm position: production-runtime-guardrails

## Position

### Product outcome

Production safety is a startup contract, not a warning. A Convexa process in production mode becomes ready only when its durable state, browser-origin boundary, operator-metrics protection, session-cookie policy, and cryptographic material are all usable and durable. Invalid production configuration stops the process before it can accept traffic and reports actionable configuration categories without printing secret values.

The same release must preserve the low-friction local path: outside production mode, the existing local stores and process-lifetime secrets remain valid fallbacks, and the local dashboard can still reach the API without production credentials. This feature changes neither trader-facing behavior nor trading calculations.

### User stories

- **US-1 — Deployment operator:** As the operator, I want an unsafe production process to refuse readiness so that a deployment cannot silently serve with temporary state, temporary keys, exposed metrics, permissive browser access, or unsafe cookies.
- **US-2 — Developer:** As a developer, I want local defaults to keep working so that production hardening does not make ordinary local development depend on production infrastructure or secrets.
- **US-3 — Signed-in trader:** As a trader with a stored AI-provider credential, I want planned server-key rotation to preserve my usable credential so that maintenance does not force an unnecessary replacement.
- **US-4 — Trader:** As a trader, I want runtime hardening to leave market reads, streaming behavior, and all scoring outputs unchanged so that an operational change cannot alter a trading decision.

### Scope

**In**

- One authoritative production-mode startup contract, evaluated before readiness.
- Durable production storage for account, session, settings, credential, and archive-body state.
- Stable session-signing material and rotatable encryption material.
- An explicit, exact browser-origin allowlist in production; no wildcard production origin.
- Mandatory authentication for the operator metrics surface in production.
- Production cookie settings that retain HTTP-only protection, require secure transport, and reject internally inconsistent cross-site policy.
- Operator-readable refusal output that identifies every invalid configuration category found in one run without revealing configured values.
- Preservation of non-production local fallbacks.
- Preservation of the existing trader surface and all trading/scoring outputs.

**Out**

- New trader-facing settings, banners, pages, or controls.
- Changing authentication eligibility, session duration, AI-provider choices, or credential-management journeys.
- Database migration orchestration, backup policy, generated API documentation, dependency automation, load testing, telemetry expansion, worker separation, or replica coordination.
- Changing archive retention or selecting a new remote storage vendor.
- Automatic recovery of credentials after their required decryption key has been deliberately retired.
- Any trading-math, signal, score, tier, fingerprint, market-data, recommendation, broker, or order behavior.

**Future-dated**

- Managed secret-store or key-management-service integration.
- Scheduled key retirement, bulk re-encryption, and rotation-progress reporting.
- Environment promotion policy across preview, staging, and production.
- Operator-facing configuration-health history beyond startup refusal output.

### Product behavior

- Production mode is explicit. A missing or unrecognized mode must not be silently interpreted as production-ready.
- Production readiness requires the declared durable database and archive-body store to be configured and reachable. Local-disk or process-memory fallbacks are not production substitutes.
- A production secret is invalid when it is absent, blank, a documented placeholder, malformed for its purpose, or duplicated where distinct key identities are required.
- Encryption rotation has one current write key and may retain older read keys. A planned rotation means adding the new key, making it current for new writes, retaining the old key for reads, and retiring the old key only after its credentials no longer need it.
- When a stored credential cannot be decrypted, it remains a no-usable-credential condition: it does not reveal bytes, crash the server, or interrupt unrelated trader reads and streams.
- Production browser access is exact-origin based. An allowlisted browser origin receives permission; an unlisted origin does not. Requests without a browser origin remain governed by their existing authentication and route rules rather than being rejected merely for lacking that header.
- Operator metrics remain separate from trader routes and require the configured operator secret in production.
- Production session cookies remain HTTP-only and require secure transport. A cross-site cookie policy that is incompatible with secure transport is rejected at startup.
- Non-production mode may use the existing local durable-store substitutes and process-lifetime keys. Those fallbacks must never make a process ready when the process declares production mode.

### Acceptance criteria

All criteria below are ship-blocking. Startup, negative-space, confidentiality, continuity, and byte-identity behaviors use `test` because they can regress silently; the visibly unchanged trader surface uses `review`.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | US-1 | Given production mode and a complete valid production configuration, when the process starts, it begins accepting traffic and its readiness check reports ready. | test |
| 2 | US-1 | Given production mode with any required durable database or archive-body store omitted, when the process starts, it exits unsuccessfully before readiness. | test |
| 3 | US-1 | Given production mode with a configured required durable store that cannot be reached or used, when the process starts, it exits unsuccessfully before readiness. | test |
| 4 | US-1 | Given production mode with session-signing material absent, blank, placeholder, or malformed, when the process starts, it exits unsuccessfully before readiness. | test |
| 5 | US-1 | Given production mode with no valid current encryption key, when the process starts, it exits unsuccessfully before readiness. | test |
| 6 | US-1 | Given production mode with an absent, empty, wildcard-containing, or malformed browser-origin allowlist, when the process starts, it exits unsuccessfully before readiness. | test |
| 7 | US-1 | Given production mode without a nonblank operator-metrics secret, when the process starts, it exits unsuccessfully before readiness. | test |
| 8 | US-1 | Given production mode whose session-cookie policy would omit HTTP-only protection, allow insecure transport, or request cross-site delivery without secure transport, when the process starts, it exits unsuccessfully before readiness. | test |
| 9 | US-1 | Given several invalid production settings at once, when startup is refused, the operator output names every invalid configuration category found in that run. | test |
| 10 | US-1 | Given startup refusal caused by any secret-bearing setting, the process output and HTTP-visible responses contain neither the supplied secret nor decrypted credential material. | test |
| 11 | US-1 | Given a browser request from an exactly allowlisted origin, the browser receives origin permission for the requested supported operation. | test |
| 12 | US-1 | Given the same browser request from an origin that is not exactly allowlisted, the response does not grant that origin browser permission. | test |
| 13 | US-1 | Given a non-browser request without an origin header, its existing authentication and route outcome is unchanged by the browser-origin guardrail. | test |
| 14 | US-1 | Given production mode, an operator-metrics read with a missing or incorrect operator credential is denied and returns no metrics content. | test |
| 15 | US-1 | Given production mode, an operator-metrics read with the configured operator credential returns the existing metrics readout. | test |
| 16 | US-1 | Given any operator-metrics read, completing that read triggers no market-data work and changes no trader state. | test |
| 17 | US-2 | Given non-production mode with production-only durable-store and secret settings omitted, the process starts with the documented local fallbacks and accepts local development traffic. | test |
| 18 | US-2 | Given the documented local dashboard origin and a non-production API using local defaults, browser requests from that dashboard continue to receive origin permission. | test |
| 19 | US-3 | Given a credential stored under the former encryption key, when the process restarts with a new current key while retaining the former key for reads, a credential-dependent action can still use the stored credential. | test |
| 20 | US-3 | Given the same rotation configuration, when the trader replaces or adds a credential and the process later restarts with only the new key, a credential-dependent action can use that newly stored credential. | test |
| 21 | US-3 | Given a stored credential whose decryption key is no longer available or whose ciphertext is unreadable, a credential-dependent action reports the existing no-usable-credential outcome instead of returning a server failure. | test |
| 22 | US-4 | Given the unusable stored credential condition in criterion 21, anonymous market reads remain available under their existing dependency behavior. | test |
| 23 | US-4 | Given the unusable stored credential condition in criterion 21, the live stream remains available under its existing dependency behavior. | test |
| 24 | US-4 | Given identical market fixtures before and after this feature under valid runtime configuration, opportunity score, opportunity tier, entry gate, and state fingerprint are byte-identical. | test |
| 25 | US-4 | Given a valid runtime configuration, the trader-facing pages, controls, copy, and navigation contain no new surface introduced by this feature. | review |

## Risks I see

- A deployment may set the wrong runtime mode and accidentally receive local fallbacks. The production-mode decision must be explicit, inspectable in deployment configuration, and represented in startup output without exposing secrets.
- A superficial validation may accept whitespace, example placeholders, wildcard-equivalent origins, duplicated key identities, or a writable-looking but non-durable path.
- Checking only that storage is named, rather than usable, could allow readiness followed by immediate session or credential failure.
- Origin matching by suffix or substring could admit a hostile lookalike domain. Acceptance requires exact-origin behavior.
- Rotation can become irreversible if the former key is removed before all credentials have been replaced, or if rollback code cannot read credentials written with the new key.
- Refusal output can itself become a secret leak if it echoes configured values while explaining a failure.
- A strict production cookie policy can break preview or local HTTP environments if those environments are misclassified as production.
- Treating credential decryption failure as a fatal application error would violate the existing isolated no-usable-secret behavior and could take unrelated trading reads offline.
- Broad startup refactoring could accidentally touch quant or scoring modules; byte-identity evidence is required even though no math change is intended.

## Assumptions I'm making about the other two lanes

- The architecture lane will define one authoritative production-mode boundary that completes before the listener or readiness state is exposed.
- The architecture lane can distinguish production-required durable stores from optional caches; an unavailable cache will not be mislabeled as loss of durable state.
- The architecture lane can support one current encryption key plus retained read keys and can identify which key should read an existing ciphertext without trying secrets indiscriminately.
- The architecture lane will preserve the existing crypto boundary in front of every credential store, so no persistence adapter receives plaintext.
- The architecture lane will keep operator metrics off trader routes and keep runtime validation outside the quant engine and scoring modules.
- The UX/tech-writer lane will provide concise operator refusal language for each configuration category without including configured values or suggesting that an unsafe bypass is acceptable.
- The UX/tech-writer lane will treat this as no trader-UI change and will not add a dashboard warning that implies an unsafe production process can continue serving.
- The deployment environment can inject runtime configuration and durable key material without placing secrets in the repository or built image.
- Existing credential-dependent behavior has an observable no-usable-credential outcome that can be reused for missing, retired-key, and unreadable-ciphertext cases.
- Existing automated fixtures can compare scoring outputs and exercise credential use without calling a live external AI provider.
