# R1 — pm position: openapi-router-dependency-replacement

## Position

### Product outcome

Ship an internal maintenance replacement that removes the known vulnerable dependency chain while preserving every externally observable API, application, and contributor-workflow behavior established by `api-contract-generation`. This feature has no new trader, operator, or contributor capability beyond a clean supply-chain result: the current runtime and generated contract remain the product.

### User stories

- As a release operator, I want the advisory and both disallowed dependencies absent so that the release gate can pass without an exception or waiver.
- As an API consumer, I want every existing operation and response meaning preserved so that upgrading the server does not require a client change.
- As a signed-in or anonymous user, I want access, cookie, error, and absence semantics preserved so that internal maintenance cannot change what I am allowed to do or what the application tells me happened.
- As a trader, I want live and degraded application behavior preserved so that the dependency replacement is invisible during normal use, stale data, and a stream interruption.
- As a contributor, I want the existing generate/check workflow and its failure meanings preserved so that contract drift remains detectable and recoverable.
- As a reviewer, I want the existing preservation evidence to remain complete and non-vacuous so that a mutually consistent omission cannot be mistaken for compatibility.

### Scope

**In**

- Remove `utoipa-axum`, `paste`, and the `RUSTSEC-2024-0436` finding from the accepted dependency set and resolved build.
- Preserve the deterministic OpenAPI 3.1 artifact, generated TypeScript contract, public client facade, and contributor generate/check outcomes.
- Preserve the exact 52-operation public inventory, 181 response-conversion cases, 87 direct-HTTP outcomes, and four-call live conformance result established by the shipped contract.
- Preserve current authentication, authorization, cookies, redirects, streaming, error, null, absent, empty, and not-found behavior.
- Preserve operator/research separation, production startup behavior, score/tier/gate/fingerprint results, established quant results, and every current application journey.
- Keep the change invisible in all product UI and avoid any new documentation surface served by the application.

**Out**

- Any new, removed, or renamed API operation; any changed request, response, status, header, media, access, cookie, redirect, or streaming behavior.
- Any new UI, copy, link, route, control, loading treatment, offline treatment, or visual change.
- API redesign, versioning, public SDK publication, runtime validation, public API documentation, or a new streaming transport.
- Scoring, quant, persistence, deployment-policy, secret-handling, account, brokerage, recommendation, or data-migration changes.
- Suppressing, waiving, or relabeling the advisory as an acceptable result.

**Future-dated**

- Adopting a future upstream integration release may be considered only in a separately reviewed maintenance feature with the same preservation evidence.
- API versioning, public documentation or SDKs, runtime validation, generator upgrades, and streaming redesign remain separate future product decisions.

### Product behavior

- Success is intentionally boring: existing consumers, users, and operators receive the same outcomes before and after the replacement, while the dependency audit becomes clean.
- The existing generated artifacts and public client behavior remain authoritative. This feature must not create a parallel contract or a second public surface.
- A clean build is insufficient if preservation evidence shrinks. The reviewed counts and live conformance outcome remain explicit compatibility obligations for this feature.
- Existing failure meanings remain distinct. Missing output, empty output, contract drift, invalid output, incomplete coverage, tooling failure, and generated-client compilation failure must not collapse into a generic success or generic error.
- No degraded state is newly invented. Existing null versus absent versus empty meaning, access refusals, not-found outcomes, dependency failures, and post-load stream-drop behavior remain independently observable.

### Acceptance criteria

Every row blocks ship. Shared evidence may satisfy multiple rows; each row still receives its own verdict.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-01 | As a release operator, I want the vulnerable chain removed. | On the candidate revision, the repository's accepted advisory/license/source/ban check completes successfully with no `RUSTSEC-2024-0436` finding. | test |
| AC-02 | As a release operator, I want removal to be complete. | On the candidate revision, both project declarations and the resolved production dependency inventory contain neither `utoipa-axum` nor `paste`; introducing either one makes the normal gate fail. | test |
| AC-03 | As an API consumer, I want the operation surface preserved. | Before-and-after contract comparison reports the same 52 public operations with no addition, removal, method change, or path change, and the existing independent baseline remains accepted without a behavior-change approval. | test |
| AC-04 | As an API consumer, I want the generated contract preserved. | Two clean generations on the candidate revision are byte-for-byte identical, and comparison with the pre-change approved OpenAPI and generated TypeScript artifacts shows no externally observable contract change. | test |
| AC-05 | As a reviewer, I want response preservation to remain exhaustive. | The candidate run completes all 181 independently identified response-conversion cases with the same observed status, meaningful headers, media/body category, representative body validity, security binding, and declared side effects as the approved pre-change evidence. | test |
| AC-06 | As a reviewer, I want runtime preservation proportional to risk. | The candidate run completes all 87 distinct direct-HTTP outcomes through the production application and preserves their response bodies, envelopes, and pre/post cookie, memory, and durable effects. | test |
| AC-07 | As a release operator, I want deployed behavior sampled independently. | Against the running candidate service, all four established live conformance calls pass with the same required outcome shapes as before the replacement. | test |
| AC-08 | As an anonymous user, I want public access unchanged. | For each existing anonymously accessible behavior in the compatibility suite, a valid request still succeeds and its established invalid-input or dependency-failure counterpart produces the same response and no new side effect. | test |
| AC-09 | As a signed-in user, I want access enforcement unchanged. | Existing session-required behaviors still succeed for an authorized session, while unauthenticated and forbidden attempts retain their distinct responses and perform no protected mutation. | test |
| AC-10 | As a user, I want cookie behavior unchanged. | Existing signup, login, logout, settings, credential, brokerage, and other cookie-bearing flows retain the same cookie presence, security attributes, clearing behavior, browser-owned transport, and server-side refusal when a client check is bypassed. | test |
| AC-11 | As a consumer, I want absence to remain honest. | Approved absent, null, empty, and populated fixtures remain distinguishable in generated types, public client behavior, and application meaning after the replacement. | test |
| AC-12 | As a consumer, I want not-found and error behavior unchanged. | Approved invalid, not-found, conflict, upstream-failure, and unavailable fixtures retain their existing distinct response status, body meaning, and side-effect outcome after the replacement. | test |
| AC-13 | As a trader, I want streaming behavior unchanged. | With the approved stream fixtures, clients still open, consume, close, and reconnect as before; heartbeats and malformed events remain isolated; and one logical subscription does not become duplicated. | test |
| AC-14 | As a trader, I want stream interruption to degrade honestly. | After a successful load followed by a stream drop, the application retains the same last-known static content and presents the same offline treatment as before the replacement. | test |
| AC-15 | As a trader, I want decision outputs unchanged. | Across the pinned compatibility fixtures, entry eligibility, gate outcome, opportunity score, opportunity tier, state fingerprint, and established quant outputs are byte-for-byte identical before and after the replacement. | test |
| AC-16 | As an operator and trader, I want isolation preserved. | Generating/checking the contract and exercising the public client cause no new vendor request, recompute, mutation, or cross-link between operator/research and trader behavior; protected calls remain enforced by the running service. | test |
| AC-17 | As an application consumer, I want the public client unchanged. | Existing consumers compile and pass their affected tests using the same public imports, named exports, and semantic error, null, cancellation, coalescing, credential, and streaming behavior as before the replacement. | test |
| AC-18 | As a trader or operator, I want no product UI change. | Review of the existing landing, ticker, scanner, positions, settings, and operator journeys finds no added or removed control, link, route, copy, navigation outcome, loading/offline/error treatment, or visual change attributable to this feature. | review |
| AC-19 | As a security reviewer, I want no new public tooling surface. | Probing the running candidate application finds no new OpenAPI, Swagger, Redoc, Scalar, or equivalent documentation route or application link. | test |
| AC-20 | As a contributor, I want the clean workflow preserved. | With approved artifacts present, the canonical generate and non-writing check workflows complete offline after dependency installation, the check reports its existing clean-success meaning, and the normal CI/build/release gates pass. | test |
| AC-21 | As a contributor, I want missing and empty outputs refused independently. | A missing required artifact and a valid artifact with zero operations each fail non-zero with their existing distinct category and recovery; neither condition is reported as clean, matching, or ordinary drift. | test |
| AC-22 | As a contributor, I want stale output refused. | A deliberate contract change without regeneration makes the non-writing check fail with the existing drift meaning, identifies only safe repository-relative affected artifacts, and leaves committed output unchanged. | test |
| AC-23 | As a contributor, I want tooling and compilation failures truthful. | A forced generation-stage failure and a forced generated-client compilation failure each fail non-zero under their existing distinct category and recovery, without being mislabeled as drift, match, or network failure. | test |
| AC-24 | As a contributor, I want failed generation recoverable. | Interrupting or failing generation before completion leaves the previously committed artifact set byte-for-byte intact, and the next check refuses any stale or partial candidate rather than silently repairing or accepting it. | test |
| AC-25 | As a reviewer, I want preservation evidence non-vacuous. | Removing the same approved operation from both the candidate runtime and generated contract still makes the normal gate fail against the independent baseline; removing, relabeling, or leaving unexecuted any required preservation case also fails, and restoration returns the gate to green. | test |
| AC-26 | As a release operator, I want production independent of removed tooling. | After all checks pass, the production build starts and serves the established compatibility probes with the removed integration packages unavailable at runtime. | test |
| AC-27 | As a security reviewer, I want committed output safe. | Existing negative scans of generated artifacts still reject credential-like values, current environment values, production origins, and absolute machine paths without printing the forbidden material; the clean candidate artifacts pass. | test |
| AC-28 | As an operator, I want no data consequence. | Completing the replacement and reverting the complete replacement both leave existing persisted user and market data unchanged; restoring generated artifacts alone remains rejected as drift. | test |

## Risks I see

- A mutually consistent omission could make runtime and generated artifacts agree while silently shrinking the public API. The independent baseline and preserved evidence counts must continue to reject this.
- Compilation and a clean advisory report could pass while cookies, access refusals, redirects, streaming, or error bodies change. Those behaviors need their existing direct-runtime evidence, not an inferred compatibility claim.
- Removing only the direct dependency could leave the vulnerable transitive package in the resolved production build. Both names and the advisory must be independently absent.
- Contract generation could become nondeterministic or partially overwrite approved artifacts on failure, turning an internal maintenance change into review noise or false drift.
- The replacement could accidentally add a public documentation surface or become a runtime prerequisite, expanding attack surface despite fixing the advisory.
- Null, absent, and empty responses could collapse during the replacement without obvious happy-path failure, causing the application to assert knowledge it does not have.
- The `NO_UI_CHANGE` claim could hide a changed loading, offline, or error treatment if verification checks only static screenshots or successful journeys.
- A green four-call live smoke result could be mistaken for full parity. It remains supplementary to the complete response-conversion and risk-based direct-runtime evidence.

## Assumptions I'm making about the other two lanes

- The architecture lane can replace the integration dependency without adding, removing, or renaming any of the 52 approved public operations.
- The architecture lane can keep the approved OpenAPI and generated TypeScript outputs externally unchanged and deterministic after the replacement.
- The architecture lane can keep all 181 response-conversion cases and 87 distinct direct-runtime outcomes executable against the replacement rather than weakening or relabeling them.
- The architecture lane can make reintroduction of either removed dependency or the named advisory fail a normal repository gate.
- The architecture lane can keep contract generation out of production startup and preserve the existing atomic failure and rollback behavior.
- The architecture lane can preserve server-side access enforcement, cookie effects, streaming lifecycle, operator/trader separation, and score/quant isolation without a product exception.
- The UX lane will treat `NO_UI_CHANGE` as a full journey-and-state preservation claim covering successful, loading, empty, error, stale, and offline states, not only visual styling.
- The UX lane will introduce no new trader/operator copy, route, link, control, or served documentation surface for this maintenance feature.
- The UX lane can verify the unchanged application journeys without requiring a new design-system amendment or new user-facing recovery language.
