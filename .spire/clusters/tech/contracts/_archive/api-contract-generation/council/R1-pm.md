# R1 — pm position: api-contract-generation

## Position

### Product promise

This feature replaces a contributor-maintained Rust/TypeScript agreement with an executable,
reviewable chain: the Rust HTTP contract produces one deterministic OpenAPI artifact; that artifact
produces checked TypeScript types and request functions; the shared API package presents the
generated result to its existing consumers; and the normal repository gates reject any broken link
in that chain.

This is production-maturity tooling, not a product redesign. A trader, signed-in user, anonymous
visitor, or operator should observe the same HTTP behavior and the same application behavior before
and after the cutover. In particular, authentication decisions, cookie/session behavior, streaming
behavior, error outcomes, unknown-versus-empty meaning, score/tier/entry eligibility, state identity,
and trader-visible copy and interactions do not change.

### User stories

- As a backend contributor, I want one intentional Rust contract change to produce the complete
  reviewable contract/client diff so that I do not have to find and edit a second handwritten model.
- As a frontend contributor, I want the shared API package to expose contract-derived types and
  request functions so that an incompatible backend change fails before it reaches a browser.
- As a reviewer, I want generated diffs to contain only semantic contract changes so that I can tell
  an intended wire change from tool noise.
- As a release operator, I want stale, missing, partial, or failed generation to stop the normal gate
  so that production cannot ship an unverifiable client/server agreement.
- As a trader or operator, I want the migration to preserve every existing flow so that tooling work
  creates no behavior, access, data, or presentation change.

### Scope

#### In

- A complete approved baseline inventory of the server's production HTTP operations, including
  ordinary request/response operations, authenticated outcomes, error outcomes, streaming transport,
  and operator-only operations. No registered production operation may disappear silently.
- Deterministic OpenAPI generation from the Rust-owned contract and deterministic TypeScript type and
  request-function generation from that artifact.
- Migration of every currently consumed ordinary HTTP operation in the shared API package to
  contract-generated output. Specialized streaming connection behavior may remain specialized, but
  its transported contract must come from the same generated truth and its existing behavior must be
  preserved.
- Normal local and CI gates that prove both the rejecting side (drift is blocked) and accepting side
  (a coherent regenerated change passes).
- Preservation of current HTTP status, authentication, session/cookie, error, null/absent/empty,
  streaming, trader-path, and operator-path behavior.
- An atomic repository cutover: the contract artifact, generated TypeScript output, shared-package
  migration, compatibility proof, and enforcement land together. A clean checkout remains usable
  without a running production service, live vendor access, production data stores, or secrets.
- Contributor-facing failure output that identifies whether the problem is generation failure,
  missing output, stale output, invalid contract coverage, or client compilation, and states the
  recovery action.

#### Out

- Any HTTP behavior change, operation rename, authentication-policy change, new access gate, scoring
  change, or response-meaning redesign.
- Any trader-facing redesign, new control, new route, changed copy, or altered loading/offline/error
  treatment.
- GraphQL, a public Swagger/documentation UI, public SDK publication, microservices, or runtime code
  generation.
- Supply-chain automation, capacity baselining, telemetry/SLO work, archive storage changes, recovery
  automation, or other later production-maturity slices.
- A general API versioning or breaking-change approval program. This feature detects and exposes
  change; it does not authorize a breaking change.
- Changes to persisted user data or a data migration.

#### Future — only after this feature ships under a separate approved brief

- Public or partner API documentation and externally published SDKs.
- Formal compatibility/versioning policy for intentional breaking changes.
- Additional generated client languages or clients outside this monorepo.
- Release-note automation and dependency-bot/supply-chain policy around generator upgrades.
- Runtime discovery or documentation surfaces, if separately justified without weakening production
  startup or operator/trader-path isolation.

### Product behavior and rollout expectations

1. The approved pre-cutover inventory is the completeness oracle for migration. Every inventoried
   operation appears exactly once in the OpenAPI artifact. Any intentional exclusion from generated
   request functions remains contract-described and is explicitly identified; there is no silent
   exclusion.
2. Generation is a reproducible build action, not a running-service feature. It does not contact a
   live vendor, require production credentials, mutate a data store, start workers, or open a network
   listener.
3. A normal contributor can make an intentional Rust contract change, regenerate, and review the
   resulting OpenAPI and TypeScript diff. Timestamps, absolute paths, wall-clock values, machine-local
   ordering, and unrelated formatting do not create diffs.
4. The shared API package remains the application-facing boundary. During the final shipped state,
   migrated contract shapes are not also maintained by hand behind that boundary. Existing consumers
   either continue through compatible exports or are migrated in the same atomic change.
5. Drift enforcement fails closed. A stale artifact, missing artifact, partially generated output,
   generator error, unrepresentable contract, or generated-client compile failure cannot be accepted
   because an older artifact happens to exist.
6. Enforcement is non-vacuous: a deliberate contract mutation makes the gate fail, restoring or
   regenerating the matching output makes it pass, and the proof is part of completion evidence.
7. The cutover introduces no deployment configuration, secret, runtime generation step, persisted
   data migration, or public documentation surface. Rollback is a repository revert, not a data
   recovery operation.
8. Rollout is blocked unless runtime compatibility and trader-visible parity are observed against the
   same pre-cutover baseline. Passing compilation alone is insufficient.

### Acceptance criteria

Every row below blocks ship. `test` is used where a silent regression is plausible; `review` is used
for visible, intentional artifact/copy decisions. GATE Q must record the actual evidence for every
row, but one high-level proof may cover several related rows.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a reviewer, I want complete coverage so omissions cannot masquerade as success. | Given the approved pre-cutover HTTP inventory, generating the OpenAPI artifact represents every inventoried production operation exactly once. | test |
| AC-2 | As a reviewer, I want exclusions to be explicit. | Given an operation whose connection behavior is intentionally not generated, the operation remains represented in the OpenAPI artifact and the generation result identifies that exclusion rather than omitting it silently. | test |
| AC-3 | As a contributor, I want reproducible output. | Two clean generations from the same commit and declared toolchain, performed in different filesystem roots and at different wall-clock times, produce byte-for-byte identical OpenAPI artifacts. | test |
| AC-4 | As a contributor, I want reproducible clients. | Two clean TypeScript generations from the same OpenAPI bytes and declared toolchain produce byte-for-byte identical TypeScript output. | test |
| AC-5 | As a reviewer, I want semantic diffs. | A no-contract-change regeneration produces no repository diff in either generated artifact. | test |
| AC-6 | As a backend contributor, I want one intentional source change to propagate. | A deliberate compatible Rust contract mutation produces the expected OpenAPI diff without an unrelated OpenAPI change. | test |
| AC-7 | As a frontend contributor, I want the generated client to track the artifact. | Regenerating from the deliberately changed OpenAPI artifact produces the matching TypeScript type/request-function diff without an unrelated generated-client change. | test |
| AC-8 | As a frontend contributor, I want checked output. | From a clean checkout, the generated TypeScript output and the shared API package compile successfully against each other. | test |
| AC-9 | As a frontend contributor, I want one maintained contract boundary. | For every migrated ordinary HTTP operation, the shared API package exposes the contract-derived type and request behavior without a second hand-maintained contract shape being accepted by the normal gate. | test |
| AC-10 | As a release operator, I want stale output blocked. | When the Rust contract is changed without regeneration, the normal repository gate fails and identifies generated contract drift. | test |
| AC-11 | As a release operator, I want stale client output blocked. | When the OpenAPI artifact changes without TypeScript regeneration, the normal repository gate fails and identifies generated-client drift. | test |
| AC-12 | As a release operator, I want missing output blocked. | When either required generated artifact is absent, the normal repository gate fails rather than recreating or accepting it silently as an unrelated side effect. | test |
| AC-13 | As a release operator, I want partial output blocked. | When generation is interrupted after producing only part of its output, the normal repository gate fails and does not treat the prior or partial bytes as current. | test |
| AC-14 | As a contributor, I want generator errors to be actionable. | When contract generation fails, the command exits unsuccessfully and its visible output identifies the failing stage and the contributor action needed to retry or repair it. | review |
| AC-15 | As a release operator, I want an invalid empty result blocked. | If generation yields no production operations, the normal repository gate fails rather than accepting an empty OpenAPI artifact. | test |
| AC-16 | As a backend contributor, I want unsupported contract shapes exposed. | If a Rust contract change cannot be represented by the chosen generation chain, generation fails visibly and the unchanged prior artifact is not accepted as current. | test |
| AC-17 | As a contributor, I want the accepting path proven. | After the deliberate mutation is fully regenerated and the generated client compiles, the drift portion of the normal repository gate passes. | test |
| AC-18 | As a contributor, I want generation available without production dependencies. | With network access disabled and production credentials, vendor access, data stores, workers, and listeners unavailable, a clean contract/client generation completes successfully using repository inputs and declared toolchain dependencies. | test |
| AC-19 | As a user, I want ordinary HTTP behavior preserved. | Against the pinned pre-cutover fixtures, each inventoried ordinary operation returns the same externally observable status, headers with contract meaning, and response body before and after migration. | test |
| AC-20 | As a signed-in or anonymous user, I want access semantics preserved. | Against the pinned pre-cutover authentication fixtures, successful, unauthenticated, forbidden, and conflicting actions retain their prior status, session/cookie effect, and mutation/no-mutation outcome after migration. | test |
| AC-21 | As a trader, I want live updates preserved. | Against the pinned pre-cutover stream fixture, the migrated application opens, consumes, closes, and reconnects the live stream with the same event meaning and without an added duplicate subscription. | test |
| AC-22 | As a trader, I want honest degraded states preserved. | When the stream drops after a successful load, the application retains the same last-known static information and exposes the same offline treatment as the pre-cutover build. | test |
| AC-23 | As a consumer, I want unknown to remain different from empty. | For the pinned absent, null, empty, and populated fixtures, generated TypeScript consumption preserves the pre-cutover externally visible distinction for each case. | test |
| AC-24 | As a trader, I want decision outputs unchanged. | For the pinned compatibility fixtures, entry eligibility, score, tier, and state identity are byte-for-byte identical before and after migration. | test |
| AC-25 | As an operator, I want diagnostic isolation preserved. | Exercising contract generation and the generated clients causes no operator-only operation to be linked from or invoked by a trader flow, and causes no trader operation to be invoked by an operator-only flow. | test |
| AC-26 | As a release operator, I want no runtime generation dependency. | A production build and startup complete with generation tools unavailable at runtime, provided the repository gate accepted the generated artifacts before build. | test |
| AC-27 | As a security reviewer, I want generated output safe to commit and ship. | Generated artifacts contain no credential value, secret, machine-local absolute path, or production data captured from the generation environment. | test |
| AC-28 | As a trader, I want no visible redesign. | Comparing the pre-cutover and post-cutover application across the existing landing, ticker, scanner, positions, settings, and operator journeys shows no added or removed control, changed user-facing copy, changed navigation outcome, or changed visual treatment attributable to this feature. | review |
| AC-29 | As an operator, I want no public documentation surface added accidentally. | After deployment, no new public documentation or contract-browsing surface is reachable and no new link to one appears in the trader or operator application. | test |
| AC-30 | As a release operator, I want a migration without data recovery risk. | Installing or rolling back this change leaves persisted user and market data untouched; neither direction asks the operator or user to run a data migration. | review |

## Risks I see

- The OpenAPI artifact could look authoritative while omitting a production operation, especially a
  specialized stream, authentication outcome, research surface, or operator-only operation.
- The generator could flatten absent, null, and empty into one TypeScript shape, recreating a known
  fabricated-meaning risk even while compilation remains green.
- Cookie/session behavior, non-success outcomes, and streaming semantics may be poorly expressed by
  a default generator and silently left in handwritten code.
- A compatibility wrapper could preserve the shared package name while continuing to hand-maintain
  the actual contract, yielding two sources of truth under a new label.
- Generated ordering, timestamps, paths, or formatting could create noisy diffs that reviewers begin
  ignoring, defeating the review benefit.
- A drift gate that is only observed green could be vacuous; completion requires a poisoned change
  that demonstrably turns it red and a restored change that turns it green.
- Generation could accidentally require a running server, production configuration, secrets, vendor
  access, or a data store, making local and CI enforcement brittle and violating the no-runtime-
  generation boundary.
- An atomic internal migration can still change runtime behavior even when types compile, especially
  for error bodies, cookies, streams, and unknown/empty cases; parity evidence must be external.
- Tooling scope could absorb the queued supply-chain or public-documentation work and delay the
  correctness outcome this feature was selected to deliver.
- Preserving every existing export indefinitely could turn compatibility into a permanent manual
  facade. Compatibility should preserve consumers, not preserve duplicate contract authorship.

## Assumptions I'm making about the other two lanes

- The architecture lane can name a generation boundary that covers every registered production HTTP
  operation without starting a listener, worker, vendor client, or production data store; this is
  falsified if generation requires a live service or runtime credentials.
- The architecture lane can represent authenticated outcomes, session/cookie effects, non-success
  responses, null/absent/empty distinctions, and streaming media in the executable contract; this is
  falsified if any of those remain authoritative only in handwritten TypeScript.
- The architecture lane can keep the specialized live-stream connection behavior while sourcing its
  transported types from the generated contract; this is falsified if migration requires a new stream
  protocol or omits the stream from drift enforcement.
- The architecture lane can make both stale-contract and stale-client mutations fail the normal
  repository gate, then make the regenerated forms pass; this is falsified if enforcement can only be
  demonstrated on its green path.
- The architecture lane can preserve the shared API package as the consumer boundary without retaining
  a second authoritative handwritten contract for migrated operations; this is falsified if contributors
  must still edit Rust and TypeScript contract declarations separately.
- The UX lane will treat trader and operator presentation as intentionally unchanged and will identify
  any unavoidable user-visible delta as a conflict rather than redesigning around it.
- The UX lane will define concise contributor-facing recovery language for generation failure, missing
  output, and drift without introducing a public documentation surface; this is falsified if a developer
  cannot tell which action restores the gate from its visible output.
- The UX lane will include existing loading, offline, error, authentication, and unknown/empty states in
  its parity review rather than checking only the happy-path trader screen.
