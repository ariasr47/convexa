# capacity-baseline — spec

**Source brief:** .spire/clusters/tech/contracts/capacity-baseline/BRIEF.md  
**Council:** R1 positions · R2 critiques · decisions.md (under council/)  
**Status:** APPROVED 2026-08-24

## 1. Goal + scope

Build a repository-owned, hermetic Rust harness that gives developers and release owners repeatable local evidence that the current revision still meets fixed REST and SSE regression guardrails. The harness launches an isolated loopback child service over fixtures/mocks, drives existing production request and stream routes, measures latency, errors, concurrency and resource recovery, writes a complete deterministic JSON report on pass or failure, and returns non-zero when any required observation is breached, missing or unverifiable. Its result is local regression evidence only, never production-capacity certification.

**In scope:**

- One mandatory `normal` profile for Windows 11 x64 and Linux x64. The measured profile targets completion within 180 seconds and includes a 60-second mixed REST/SSE soak.
- One separately selected `extended` profile using the same executable, manifest, evaluator and report schema. It runs the same closed scenarios with a 15-minute mixed soak and adds the quiescent-memory-slope guardrail.
- Existing anonymous `GET /api/ticker/{ticker}` REST traffic and `GET /api/stream/{ticker}` SSE traffic over representative frozen market-data fixtures, a non-network stream producer, loopback binding and temporary/local stores.
- Fixed, versioned warm, cold, coalescing, shared-capacity, expected-not-found, SSE boundary, orderly-churn, abrupt-drop, mixed-soak, recovery, optional-computation-isolation and outbound-connector-isolation scenarios.
- Required resident-memory, open-handle/descriptor, Tokio-task and active harness-owned request/subscriber observations on both supported platforms. A missing or unsupported required observation is a failure, never zero or skipped.
- A canonical machine-readable report retained on success and handled failure, plus normal local-gate integration that fails on a threshold breach, malformed/incomplete report or non-zero harness result.

**Out of scope:**

- Any new public, trader or operator HTTP route; any new endpoint, query parameter, response field, SSE event or generated client change.
- Production traffic, live-vendor benchmarking, production services, brokers, LLMs, OAuth providers, Redis/Postgres servers, cloud resources, paid accounts or subscriptions.
- Production throughput claims, SLOs, replica sizing, auto-scaling policy, WAN/TLS benchmarking, database stress, telemetry rollout or alerting.
- Dashboard source, UI, browser behavior, trader copy, scores, recommendations, gamma/math, stream semantics, production startup policy or production configuration changes.
- Automatic threshold calibration or promotion of the latest run into a new baseline.

**Future (deliberately deferred):**

- macOS resource adapters and support evidence.
- Hosted-runner comparison, multi-replica exercises, production-telemetry correlation, and 30-minute or overnight endurance profiles.
- Any threshold revision based on measured evidence; it requires a separately approved contract change.

The fast/extended split is deliberate: the normal path stays routine enough to run on every local verification, while the extended soak provides stronger release evidence without replacing or weakening the required fast profile. Neither result authorizes a production claim.

<!-- spire:council-resolution:v1 4b8471a54b8feb68bc3cce1d4ae781827ed7c9e100966ea8114417170ee88ea7 folded -->
<!-- spire:council-resolution:v1 f00bd27c0268213121d501f0632d5e08a3f130d06fcd3f6ae9f229443bed25b9 folded -->
<!-- spire:council-resolution:v1 519e3275e76096a5373d1bfe22294cc2dac5f9de8c18978503cfe936ea831aff folded -->
<!-- spire:council-resolution:v1 adb59fcddf483cebb61d2952ba78f1701865f535fab3f6c0acbb63a9894ba5cc folded -->
<!-- spire:council-resolution:v1 93643b269b975a1a6f686850c90d552da8cfafa63bfc6aed095aebb412a3db09 folded -->
<!-- spire:council-resolution:v1 21ea7f5d4a1204c9ce5a896b2085407dfa4c04f89c6efa5c86ddddecb6c1a1eb folded -->

## 2. Architecture

### 2.1 Commands, gate and artifacts

Add an `api-rust capacity-baseline` CLI command and bind these repository commands exactly:

- `npm run capacity:baseline` → the `normal` profile, writing `apps/api/data/capacity/capacity-baseline-normal.json`.
- `npm run capacity:baseline:extended` → the `extended` profile, writing `apps/api/data/capacity/capacity-baseline-extended.json`.
- `npm run capacity:baseline:self-test:connector-poison` → the connector-poison and unlisted-inventory negative controls, writing `apps/api/data/capacity/self-tests/connector-poison.json`.
- `npm run capacity:baseline:self-test:optional-fault` → the `market_state.iv_rank` store-fault isolation control, writing `apps/api/data/capacity/self-tests/optional-fault.json`.
- `npm run capacity:baseline:self-test:byte-identity` → the committed before/current-revision identity comparison, writing `apps/api/data/capacity/self-tests/byte-identity.json`.
- `npm test` → the existing unit/test targets, the three self-test commands above, then `npm run capacity:baseline`; the aggregate succeeds only when every self-test exits zero and the normal harness exits zero with a complete passing report.

`package.json` owns the documented scripts; `apps/api/project.json` owns the normal, extended and self-test Nx targets. `apps/api/src/main.rs` exposes the CLI subcommand and delegates immediately into a new one-way leaf at `apps/api/src/capacity/`. The extended command is never part of `npm test` and cannot satisfy the normal-profile gate.

The three self-test scripts are no-argument public repository commands backed by these exact CLI selections: `api-rust capacity-baseline self-test --case connector-poison`, `--case optional-fault`, and `--case byte-identity`. They run only the named deterministic control, never live load. A self-test exits zero only when its healthy control passes, its injected negative control produces the exact expected inner failure, and its retained JSON receipt validates; an unavailable control, an empty connector inventory, a tolerated fault, or a malformed receipt exits non-zero. This makes the controls runnable by GATE Q without locating a Rust test name or reading source.

The byte-identity control owns a committed corpus at `apps/api/tests/fixtures/capacity-baseline/v1/identity/`. Its `manifest.json` pins the pre-feature source revision `c30ed8151b82f847fd75552528dcba30bdca5ae8`, every input/oracle relative path and SHA-256, the exact `SPY?min_dte=7&max_dte=45` request, the non-network SSE input, a fixed wall clock/seed, and the ordered identity projection. The committed `before/` oracles must be generated from that revision in a detached disposable checkout, not from the implementation worktree. The externally runnable self-test verifies all manifest hashes, records the current full revision plus a digest of the governed after-tree, runs the current fixture assembly, and byte-compares: (a) the complete decision-bearing ticker projection, excluding only the manifest-listed runtime observations `meta.served_at`, `meta.compute_ms`, `meta.elapsed_ms`, and `meta.cache.age_seconds`; (b) the first data-bearing SSE event with its timestamp fixed by the manifest clock; and (c) score, tier, `ai_eval.state_fingerprint`, entry-gate and deterministic local-rules recommendation projections. No command may update `before/`, change the reference revision, add an exclusion, or accept new bytes; any such change is an explicit contract/baseline amendment.

The same manifest contains this closed `api_contract_artifacts` inventory. `base_sha256` is the SHA-256 of the source-read accepted repository bytes present before this feature; paths and digests are lowercase and exact:

| Repository-relative path | `base_sha256` | Bound meaning |
|---|---|---|
| `apps/api/openapi/precutover-operation-baseline.json` | `2803c58a00f563e6e136056582f1a5682fc05bfe196f501d9e813c48a8b35c8f` | Immutable accepted set of exactly 52 `{method,path}` operations, including the existing ticker JSON and ticker SSE routes |
| `apps/api/openapi/convexa.openapi.json` | `deec24e279c03c93c2af8da8f5ee3e694f188f5a3cca3ee7ce803f9ac17b9f87` | Generated OpenAPI 3.1 document with exactly 52 operations |
| `apps/api/openapi/parity-coverage.json` | `c7f23f6ca20157d82efeb66f1fdb3662cc5d7a5096c331b29166562e6832c01b` | Generated parity coverage with exactly 52 operation rows |
| `apps/api/openapi/generated-artifacts.manifest.json` | `b7b501c2852d433ebf08053b25c13763617d24f48914a08e180ca33b75015949` | Existing four-artifact manifest owned by `tools/api-contract.mjs` and checked by `npm run api:contract:check` |
| `libs/api/src/generated/schema.ts` | `724181c0d47cae9a3a7032eecfa21901c310f1406aab26e9b14735c43a352e9c` | Generated TypeScript client schema |

The identity command first runs the existing `npm run api:contract:check` unchanged and requires exit 0; it does not reimplement, replace, bypass or weaken that check. That command remains authoritative for regenerating the live router contract, comparing its sorted 52-operation method/path set with `precutover-operation-baseline.json`, validating OpenAPI/parity/manifest consistency, rejecting its already-governed unlisted artifacts, and compiling the generated client. The identity receipt records `api_contract_check.command`, `api_contract_check.exit_code`, and `api_contract_check.status`; a missing/unrunnable/non-zero check makes the outer self-test non-zero.

The identity command then verifies the five-row inventory above. Its receipt contains one `api_contract_artifacts[]` row for every path, in the table order, with `path`, `base_sha256`, `current_sha256`, and `match`; no extra or missing row is valid. It also records `route_inventory` with the baseline path, `operation_count: 52`, the baseline artifact's base/current SHA-256, and the existing check's pass status. Thus the receipt identifies the exact accepted route inventory and proves that the authoritative live comparison ran without requiring GATE Q to read a route source file.

Generated-client additions are governed separately and recursively. The closed base inventory below `libs/api/src/generated/` contains exactly one descendant entry, `file\tlibs/api/src/generated/schema.ts\n`; its SHA-256 is `262f9c4f4e9fd5641c82b686237d58086c5d7d16a02fd9209821ae86e42bcbe9`. Enumeration visits every descendant without following symlinks, emits each regular file, directory or symlink as `<type>\t<repo-relative-path>\n`, sorts by ordinal repo-relative path, and hashes the concatenated UTF-8 bytes. The receipt exposes `generated_client_inventory.root`, `base_entries`, `current_entries`, `base_sha256`, `current_sha256`, `additions`, `removals`, and `match`. Any added directory, file or symlink, including an unlisted generated client beside `schema.ts`, is visible in `current_entries`/`additions` and makes the self-test non-zero. The retained `byte-identity.json` is valid only when the existing API contract check passes, every artifact base/current digest matches, the generated-client entry set/digest matches, and every before/after decision artifact matches.

### 2.2 Component boundaries

The new `apps/api/src/capacity/` leaf has six responsibilities:

1. `manifest.rs` owns the closed scenario IDs, fixture identities, protocol, cache precondition, counts/concurrency/hold/duration, expected outcome class, required observations and versioned thresholds. It imports no route, scoring, recommendation or quant implementation.
2. `runner.rs` validates the complete manifest and fixture corpus before binding, creates unique temporary state, starts one fresh child per isolation group, waits on a bounded readiness channel, continues independent groups after failures, requests graceful shutdown, and force-terminates only after a bounded cleanup timeout that fails the run.
3. `rest.rs` and `sse.rs` are loopback clients using monotonic clocks. They return immutable observations and never decide pass/fail. SSE connects through the real socket route and classifies `accepted`, `expected_capacity_refusal`, `expected_fixture_not_found`, and `unexpected_error` separately.
4. `harness_app.rs` assembles the same `routes::router` graph used by normal serve but accepts only `MarketDataPort::Fixture`, the non-network stream producer, in-memory or temporary-file stores, loopback bind and the v1 subscriber cap. `server.rs`/`state.rs` gain an explicit test-harness assembly seam; normal `serve` retains its existing production/dev assembly and can never select this seam by environment variable or fallback.
5. `resources/` owns one sampler trait with required `windows.rs` and `linux.rs` adapters. A low-overhead RAII lifecycle probe at the existing `services/live_capacity.rs` subscriber guard and the request/task spawn/drop boundaries reports active harness-owned requests, subscribers and SSE tasks over a child-process control channel. It adds no HTTP surface and performs no allocation or I/O on each SSE data tick.
6. `evaluate.rs` consumes observations against the immutable policy; `report.rs` validates the exact scenario set, serializes stable order/units/rounding, writes a temporary sibling, and atomically replaces the final report only after every required section has a verdict.

Application-under-test dependencies continue toward existing domain/engine modules. Harness drivers/evaluators consume external behavior and the private child control channel only. No capacity module may be imported by `libs/quant-engine`, scoring, fingerprint, recommendation, trader routes or dashboard code.

### 2.3 Closed v1 manifest

All counts below are blocking manifest data. Reducing a count, changing a cache precondition or omitting an ID changes `profile_version` and is rejected by report validation.

| Scenario ID | Required behavior and load | Blocking threshold |
|---|---|---|
| `rest_cold` | 12 deterministic fixture/cache identities, each measured exactly once against fresh temporary cache state | p95 ≤ 3,000 ms; each ≤ 5,000 ms; 0 unexpected errors |
| `rest_expected_not_found` | One symbol absent from the fixture catalog | classified only as `expected_fixture_not_found`; not a data success or unexpected error |
| `rest_warm_concurrent` | Prime one representative single ticker, discard 5 warm-ups, then 200 measured cache-hit requests at concurrency 16 | p95 ≤ 250 ms; each ≤ 1,000 ms; 0 unexpected errors |
| `rest_cold_coalesced` | 32 simultaneous clients against one fresh cold identity | all 32 complete; p95 ≤ 3,000 ms; each ≤ 5,000 ms; 0 unexpected errors |
| `rest_shared_capacity` | 320 requests at concurrency 32 distributed over 8 primed representative identities | p95 ≤ 1,500 ms; each ≤ 5,000 ms; 0 unexpected errors |
| `sse_capacity_hold` | With the manifest-owned cap set to 32, observe cap-minus-one, then hold the same 32 accepted clients for the first 60 seconds of `mixed_soak`; retain an independently named row with its own connect and hold observations | accepted-connect p95 ≤ 500 ms; 0 unexpected disconnects |
| `sse_capacity_refusal` | While 32 remain accepted, attempt client 33 | `expected_capacity_refusal` within 1,000 ms; accepted clients unaffected |
| `sse_orderly_churn` | 10 full waves of 32 accepted clients; every client closes normally | after each bounded wave drain, subscriber and SSE-task counts equal pre-wave values |
| `sse_abrupt_drop` | 10 waves of 8 accepted clients terminated without orderly client close | after each bounded wave drain, permits/subscribers and SSE tasks equal pre-wave values |
| `mixed_soak` | Normal: 60 seconds. Extended: 900 seconds. In both, warm REST concurrency 16 runs while the same 32-client cohort used by `sse_capacity_hold` remains held and lane B supplies controlled SSE churn on its isolated child; the row retains its own REST, held-stream, churn-overlap and one-second resource observations rather than inheriting either SSE verdict | REST p95 ≤ 1,000 ms; 0 unexpected REST errors; 0 unexpected stream disconnects |
| `optional_compute_fault` | Select the harness-only failing IV-store read adapter, request a fixture bundle, and keep an already accepted ticker SSE open; the named optional target is `market_state.iv_rank`, not `ai_eval` | HTTP 200; `market_state.iv_rank` is null; the core identity projection and the required `ai_eval` object are unchanged; a later SSE data event is received |
| `outbound_isolation` | Run through the fixture child and audit every pinned non-local connector | 0 attempted forbidden connector constructions/invocations |
| `post_load_recovery` | Drain all generated traffic, keep all seven A/B/C/D1/D2/D3/E workload children alive and quiescent through the same 30-second checkpoint, and retain each child's pre-load/current resource and lifecycle observations plus their aggregate | every child and the seven-child aggregate: exact active request/subscriber return to pre-load; handles/descriptors and Tokio tasks ≤ baseline +2; RSS ≤ baseline +64 MiB; all seven alive and observed before cleanup |

Nearest-rank percentiles over completed observations and monotonic elapsed time are authoritative. Supplemental p99, median resource samples and whole-phase duration may be reported but never replace or silently tighten a blocking threshold.

During `mixed_soak`, sampling begins only after a stabilized pre-load baseline and occurs once per second. RSS must remain ≤ baseline +128 MiB; open handles/descriptors and Tokio tasks must each remain ≤ baseline +8. The extended profile additionally fails when the fitted positive slope across quiescent RSS samples exceeds 1 MiB/minute. Missing samples fail the affected scenario and the overall run.

### 2.4 Executable normal-profile schedule

The normal profile has a 140-second hard internal schedule and a 180-second outer command deadline. Phase deadlines include cancellation acknowledgement, cannot borrow from a later phase, and turn every unfinished scenario into a named `did_not_pass` row. The last 40 seconds are reserved outer-runner margin; they are not available to extend a scenario. The normal report's `summary.elapsed_ms` covers preflight through atomic report replacement. On the supported-platform precondition that the same-revision Rust test/build step has already produced the binary, the repository command must return within 180 seconds, including Nx/CLI launch overhead.

| Phase | Hard budget | Execution and concurrency |
|---|---:|---|
| Manifest, fixture and sampler preflight | 8 s | One coordinator validates the closed manifest, identity hashes, platform adapter and temporary roots before binding. |
| Child launch and baseline stabilization | 12 s | Start exactly seven loopback fixture children for A, B, C, D1, D2, D3 and E, and require readiness plus three consecutive one-second per-child baseline samples before load. |
| Concurrent workload window | 70 s | Run lanes A–E concurrently. A lane may use only its assigned child/state; REST identities are disjoint across D1–D3. |
| Post-load recovery | 30 s | After every lane has stopped generating traffic, keep all seven children alive and quiescent through one shared 30-second window; at its end take each child's resource/lifecycle snapshot and the aggregate before any cleanup begins. |
| Evaluation | 5 s | Fold immutable observations into all 13 independently named scenario verdicts; missing rows fail. |
| Graceful/forced cleanup | 7 s | Shut down each validated child PID; a forced termination or deadline breach is reported as failure. |
| Final validation and atomic report replacement | 8 s | Validate closed shape and evidence, then replace the normal report and return the verdict. |
| **Total hard internal budget** | **140 s** | **All 13 scenarios, recovery and report finalization are included; 40 s remains before the 180-second outer deadline.** |

The concurrent workload lanes are closed schedule data:

- **A — held-capacity/mixed (70 s):** connect the cap-minus-one and cap observations within 5 seconds; once 32 are accepted, start the same 60-second clock for `sse_capacity_hold` and normal `mixed_soak`, attempt `sse_capacity_refusal` during its first second, run warm REST concurrency 16 for the full 60 seconds, and record lane B's separately instrumented controlled-churn overlap, then drain within 5 seconds. The hold, refusal and soak keep separate scenario rows, observation arrays, thresholds and failure lists even though the accepted cohort and wall-clock interval are shared.
- **B — orderly churn (60 s):** start with lane A's 60-second interval and run 10 full-capacity waves sequentially on one child, with a hard 6-second connect/close/drain budget per wave and independent pre/post lifecycle counts. Its wave evidence is stored under `sse_orderly_churn`; `mixed_soak` stores only its independently named churn-overlap timestamps and unexpected-disconnect count.
- **C — abrupt churn (50 s):** run 10 eight-client waves sequentially on one child, with a hard 5-second connect/drop/drain budget per wave and independent permit/subscriber/task observations.
- **D1 — cold/absence (8 s):** run the 12 distinct cold identities concurrently at driver concurrency 12, then the expected-not-found request; each cold identity still has fresh cache state and its own latency observation.
- **D2 — warm/coalesced (25 s):** run the 5 excluded warm-ups and 200 warm requests at concurrency 16, then the 32-client cold coalescing burst on a separate identity.
- **D3 — shared capacity (55 s):** run all 320 requests in ten concurrency-32 batches over the eight primed identities.
- **E — isolation controls (20 s):** reuse the one E child sequentially: run `optional_compute_fault` with the failing IV-store read adapter, reset its harness-only fixture/control state to the recorded E pre-load baseline, then run `outbound_isolation` with the pinned connector audit enabled. The reset and second readiness acknowledgement are bounded inside the 20-second lane budget; a reset, readiness or isolation-control failure marks the affected row `did_not_pass`. No second E child is launched, preserving exactly seven workload children and the 140-second ledger.

A shared wall-clock interval never permits shared verdicts: report validation requires all 13 manifest IDs exactly once and requires the scenario-specific evidence named above. The seven child identities are fixed as `A`, `B`, `C`, `D1`, `D2`, `D3`, `E`; none may be shut down or replaced after baseline stabilization and before the shared recovery checkpoint. For `post_load_recovery`, each child row records `alive_at_checkpoint`, its sampler semantic, and pre-load/current/delta values for RSS, handles or file descriptors, Tokio tasks, active harness requests, active subscribers and active SSE tasks. The aggregate row sums the seven pre-load and current values field by field and derives deltas from those sums. A pass requires all seven child rows present and alive; each child independently satisfies exact request/subscriber return, handles/descriptors and Tokio tasks at most its own baseline +2, and RSS at most its own baseline +64 MiB; the aggregate independently satisfies the same ceilings against the summed baseline, including only +2 handles/descriptors, +2 Tokio tasks and +64 MiB RSS rather than seven allowances. A missing sample, early child exit/replacement, cleanup before observation, per-child breach or aggregate breach makes `post_load_recovery` and the overall run `did_not_pass`. Cleanup begins only after this verdict input is immutable. The extended profile uses the same lanes and independent evidence, but lane A holds the cohort for the first 60 seconds for `sse_capacity_hold` and continues the independently sampled `mixed_soak` to 900 seconds; it is not subject to the normal 180-second deadline.

<!-- spire:council-resolution:v1 5bccaee120695a570e862e2c9ce18722f413f8c87d114e5b8f9be8c7a7a1bc7c folded -->
<!-- spire:council-resolution:v1 51c1446cd5244eec63428cb1357557c1a0d94ea3bcdfcab9042e17513e05f65c folded -->
<!-- spire:council-resolution:v1 af0b823df3a83cba62011e51cbd53245bffdb56f63a56da4255fba739263d663 folded -->
<!-- spire:council-resolution:v1 ae57512a010bceb52689e6a41b13dbd0d0a2078dd42ec92bb76396dce778f968 folded -->
<!-- spire:council-resolution:v1 89da6d69fe60c69f632087afc4ac7e7152c95928fc4cffb38e44603a7860b1bf folded -->
<!-- spire:council-resolution:v1 dcff0b301e277495b10c6401eae7b2d51208b88467fea4485456be0d7385a402 folded -->
<!-- spire:council-resolution:v1 2c8988979a79a6770a2b041f3f00a2d6d6c33142393fc350db109199ba9b0d0a folded -->
<!-- spire:council-resolution:v1 c4d3fc962c75232ed3e33c9c3890a1816272d2cb33a4751985db720b7e37d0cd folded -->
<!-- spire:council-resolution:v1 7d95da8c88ed838f4204ee98ff49412d9d4e8fba16738bde4f3b310d6e949e15 folded -->
<!-- spire:council-resolution:v1 a7bd5b4b44ab27453b39cd8683ca24b53157cadf6357781d1f60976e4c14144d folded -->
<!-- spire:council-resolution:v1 85c6881770c1f44d7dbaac40790d540f9fa6dacf8ecdbd0a189ad40e223ff01b folded -->
<!-- spire:council-resolution:v1 4163323d4522a77f9cd95ba2e4c70a56a919cda8d4130c7def4de97bcae22b6d folded -->
<!-- spire:council-resolution:v1 7d0bb97aa65947fe1fde0b5c4af5b6141a6c611c3d12b6938d7cbbe30df3dddf folded -->
<!-- spire:council-resolution:v1 d8d92ca7d2ed59e329fd57da59a9892b1e19d3ae9ffed30c4d8144a9348204e9 folded -->
<!-- spire:council-resolution:v1 8683910536a413ee0404ba22915fc329cd10aeb2ce4617023e34da5ce5405d68 folded -->
<!-- spire:council-resolution:v1 37602a720e720e001ac97ecad364a4f762bd5c2000139c564e6d4cb40c4b589a folded -->

### 2.5 Hermeticity and isolation

The harness child receives an allowlisted environment with vendor/OAuth/LLM/database/Redis credentials and URLs removed, binds only to `127.0.0.1` on an ephemeral port, uses fixture market data and a non-network stock-event producer, and uses only temporary local persistence. The harness-only assembler's reachable constructors exclude live Massive REST/WebSocket, Redis, Postgres, LLM-provider HTTP and Google OAuth. The current source-verified outbound constructor inventory is checked into the harness manifest and pinned by a mutation-tested source guard; adding or moving a connector without updating the inventory fails tests. Poison tests prove that selecting or invoking each forbidden adapter records an attempt and makes the scenario and overall run `did_not_pass`.

This is intentionally source-bounded. It proves zero use of the complete pinned connector graph; it does not claim operating-system detection of an arbitrary future direct socket. A universal OS firewall/sandbox is not part of v1.

The harness does not weaken `production-fails-closed`: production `serve` still performs its existing configuration/schema/archive preflight before listener or workers, and it has no harness-mode environment flag, fixture fallback, temporary-store fallback or alternate router. The harness executable never contacts a running production service.

<!-- spire:council-resolution:v1 3e08bf190ef5197ec672fbc6cd769c96bf09311f18b3fe9f336d1290e2b2d6f0 folded -->

### 2.6 Report contract

The report is UTF-8 canonical JSON with one trailing newline, fixed object-member order, manifest scenario order, millisecond latency rounded to three decimals, memory in integer bytes, counts as integers and slopes in MiB/minute rounded to three decimals. Re-serializing the same immutable observations must produce byte-identical bytes. Measured values are not expected to match across hosts.

Top-level members, in order, are:

1. `schema_version` (`1`), `feature` (`"capacity-baseline"`), `profile` (`"normal"|"extended"`), `profile_version` (`"1"`), `seed` (integer), `revision` (string).
2. `environment`: `os`, `arch`, `logical_cpus`, `rustc`, `sampler`, and sampler semantic (`handles` on Windows, `file_descriptors` on Linux). It contains no hostname, username, absolute path, credential or inherited environment dump.
3. `claim`: exactly `This report contains deterministic results from the local fixture/mock harness only. It is not evidence of production capacity, safety, vendor performance, or a scaling guarantee.`
4. `manifest`: the complete ordered scenario definitions, cache preconditions, load parameters, required observations, thresholds, units and expected outcome classes used for this run.
5. `scenarios`: one row per manifest ID with `id`, `status` (`pass|did_not_pass`), `expected_outcome`, `observations`, `thresholds`, `failures`, and `diagnostics`. Missing/unavailable evidence is a named failure and never a null-valued pass. The `post_load_recovery` observations contain ordered `children` rows for exactly `A`, `B`, `C`, `D1`, `D2`, `D3`, `E` plus `aggregate`; each exposes `alive_at_checkpoint`, sampler semantic, and pre-load/current/delta values for RSS, handles or file descriptors, Tokio tasks, active requests, active subscribers and active SSE tasks.
6. `summary`: `verdict` (`pass|did_not_pass`), `elapsed_ms`, ordered `failed_scenarios`, `missing_required_observations`, `forbidden_connector_attempts`, and `cleanup`.

The runner validates this closed shape before atomic replacement. Startup failure, readiness timeout, child crash, scenario timeout, malformed response, sampler failure, isolation attempt, cleanup timeout or report incompleteness still yields a complete report with affected rows marked `did_not_pass`, followed by a non-zero exit. Remediation text may direct the operator only to inspect local fixtures/prerequisites and rerun the same documented command.

Architecture owns these machine names and semantics. Human-readable diagnostics preserve them, state observed value/unit/threshold/direction, and use `did not pass` for missing, unsupported or skipped evidence.

<!-- spire:council-resolution:v1 320413c46a6a4a3a0c6348215a1123aca55d4a43de1756c2ea49029f823ff635 folded -->
<!-- spire:council-resolution:v1 9540723d2dc7fbb4c2bb1ae60d1de1274253608a828cdebe414f945c3fae9b68 folded -->

**Failure modes + isolation:** A setup or child failure cannot erase later independent evidence: every workload lane has its own fixed child/state, E resets its private fixture/control state between its two sequential controls, and the final verdict is emitted after all runnable groups complete. A dependency fault in an optional added computation leaves the existing bundle/SSE behavior intact and is evaluated separately. An early child exit is preserved as both its lane failure and missing recovery evidence; no replacement child may impersonate its baseline. Force termination after the cleanup deadline is itself a failed observation. A partial report is never promoted to the final path.

For the optional fault, the harness-only assembly substitutes a failing IV-store read adapter at the existing `compute_analytics_from_vendor` store seam. It does not add an environment flag, query parameter, endpoint or production-selectable adapter. The route must still serialize the existing required `ai_eval` object; only `market_state.iv_rank` becomes null. The companion interface contract pins both facts.

**Not buildable / rejected approaches:** External load tools plus shell orchestration are rejected because they add installation variance, weaken typed fixture/lifecycle integration and complicate Windows/Linux parity. An in-process router-only benchmark is rejected because it cannot establish real socket/SSE lifecycle or child-process RSS and handle/descriptor recovery. Live-vendor, production-service and self-calibrating-baseline approaches are forbidden because they destroy hermeticity or normalize regressions.

## 3. Acceptance criteria (with user stories)

Each row is independently observable without reading production source. `test` is used where a silent regression could pass review; `review` is reserved for bounded wording and visible no-change.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a developer, I want one repeatable normal check so that capacity regressions block routine verification. | On Windows 11 x64 and Linux x64 after the same-revision Rust test/build step has produced the binary, `npm run capacity:baseline` follows the 140-second phase ledger, returns within 180 seconds, writes all 13 normal scenario rows plus cleanup evidence, and exits 0 only when every required row passes with `summary.elapsed_ms` at or below 180,000. | test |
| AC-2 | As a release owner, I want longer evidence without weakening the normal gate. | `npm run capacity:baseline:extended` runs the same closed scenarios with a 900-second mixed soak and slope check; it writes the extended report, and its result cannot satisfy or replace a missing/failing normal report. | test |
| AC-3 | As a developer, I want cold-path evidence. | With fresh cache state for each identity, all 12 `rest_cold` observations complete with p95 ≤ 3,000 ms, every observation ≤ 5,000 ms, and zero unexpected errors. | test |
| AC-4 | As a developer, I want warm concurrent evidence. | After one representative ticker is primed and 5 warm-ups are excluded, 200 measured requests at concurrency 16 complete with p95 ≤ 250 ms, every observation ≤ 1,000 ms, and zero unexpected errors. | test |
| AC-5 | As a developer, I want coalescing pressure checked. | Thirty-two simultaneous requests for one fresh cold identity all complete with p95 ≤ 3,000 ms, every observation ≤ 5,000 ms, and zero unexpected errors. | test |
| AC-6 | As a developer, I want shared-capacity pressure checked. | All 320 requests at concurrency 32 over 8 primed identities complete with p95 ≤ 1,500 ms, every observation ≤ 5,000 ms, and zero unexpected errors. | test |
| AC-7 | As a reviewer, I need expected absence distinguished from failure. | A request for the manifest's absent symbol is reported as `expected_fixture_not_found` and is counted as neither successful data nor an unexpected error. | test |
| AC-8 | As a release owner, I want the supported stream boundary checked. | With the manifest cap at 32, cap-minus-one and all 32 clients are accepted, accepted-connect p95 is ≤ 500 ms, and all 32 remain connected for the 60-second hold unless intentionally closed. | test |
| AC-9 | As a release owner, I want refusal semantics checked. | While 32 streams remain accepted, client 33 receives the existing capacity refusal within 1,000 ms, the result is classified `expected_capacity_refusal`, and no accepted client disconnects because of it. | test |
| AC-10 | As a release owner, I want orderly churn leaks caught. | Across 10 full waves of 32 orderly closes, every accepted client closes and the service-side subscriber and SSE-task counts return to their pre-wave values after each bounded drain. | test |
| AC-11 | As a release owner, I want lost-client cleanup caught. | Across 10 waves of 8 abrupt client drops, every permit is released and subscriber/SSE-task counts return to their pre-wave values after each bounded drain. | test |
| AC-12 | As an operator, I want sustained mixed-load evidence. | During the normal 60-second mixed soak, warm REST at concurrency 16 has p95 ≤ 1,000 ms with zero unexpected errors while 32 accepted streams have zero unexpected disconnects. | test |
| AC-13 | As an operator, I want bounded resources under load. | Every required soak sample reports RSS ≤ stabilized baseline +128 MiB and open handles/descriptors and Tokio tasks each ≤ baseline +8; a missing or unsupported sample makes the row and overall run `did_not_pass`. | test |
| AC-14 | As an operator, I want post-load recovery evidence. | The normal report keeps the fixed A/B/C/D1/D2/D3/E children alive and quiescent through the same 30 seconds after all generated traffic drains, then exposes each child's pre-load/current resource and lifecycle values and the summed aggregate before cleanup. It passes only when all seven are alive and observed and every child plus the aggregate has active requests/subscribers exactly at baseline, handles/descriptors and Tokio tasks ≤ its corresponding baseline +2, and RSS ≤ its corresponding baseline +64 MiB; any missing child/sample or early cleanup is `did_not_pass`. | test |
| AC-15 | As a release owner, I want extended leak evidence. | In the extended profile, a positive quiescent-RSS slope above 1 MiB/minute makes the mixed-soak scenario and overall run `did_not_pass`, with the observed slope and threshold retained. | test |
| AC-16 | As a reviewer, I want hermetic evidence. | A passing run binds only loopback, uses fixture/mock market data and temporary/local stores, requires no paid account or secret, and reports zero attempted constructions/invocations for every connector in the pinned outbound inventory. | test |
| AC-17 | As a reviewer, I want isolation enforcement to bite. | `npm run capacity:baseline:self-test:connector-poison` exits 0 only after its healthy fixture run passes, every pinned forbidden connector construction/invocation produces a nested `outbound_isolation: did_not_pass` and overall `did_not_pass`, and the injected unlisted-inventory probe is rejected; its retained receipt names every connector/control and contains no tolerated or unexercised case. | test |
| AC-18 | As a trader, I need optional failures isolated from the product path. | `npm run capacity:baseline:self-test:optional-fault` exits 0 only when the healthy fixture returns `market_state.iv_rank` as an object, the failing IV-store read returns HTTP 200 with that key null, the remaining decision-bearing ticker projection and required `ai_eval.ready`/`ai_eval.state_fingerprint` bytes match the healthy control, and an SSE accepted before injection yields a later data event; the receipt records both responses and the stream observation. | test |
| AC-19 | As a reviewer, I want stable evidence. | Serializing the same completed observation fixture twice produces byte-identical report bytes with canonical member/scenario order, units, rounding, seed, thresholds, verdicts and one trailing newline. | test |
| AC-20 | As a reviewer, I want complete evidence. | Removing any required scenario, observation, threshold or verdict from an otherwise passing report makes validation and the process result fail; the malformed report cannot replace the prior final report. | test |
| AC-21 | As a developer, I need setup failures preserved. | Missing/unreadable fixtures, unsupported sampling, readiness timeout, child crash or cleanup timeout each produces a retained complete report naming the failed stage/row and a non-zero exit; no performance row is reported as passing without its required observations. | test |
| AC-22 | As a release owner, I need breaches to block the normal aggregate. | Controlled breaches of latency, maximum observation, error, disconnect, memory, handle/descriptor, task, recovery, elapsed-time and isolation guardrails each make `npm test` non-zero while the report retains the observed value and blocking threshold. | test |
| AC-23 | As a reviewer, I need the claim bounded. | The report contains exactly the settled local-fixture disclaimer, and missing/unsupported evidence uses `did not pass`; no operator text calls the result production-ready, safe capacity, vendor performance or an SLO. | review |
| AC-24 | As a trader, I expect no visible product change. | Before/after review finds no new or changed dashboard control, copy, status or workflow. | review |
| AC-25 | As a trader, I expect no silent wire or decision change. | `npm run capacity:baseline:self-test:byte-identity` runs the unchanged `npm run api:contract:check`, verifies pre-feature revision `c30ed8151b82f847fd75552528dcba30bdca5ae8`, and exits 0 only when the manifest-defined ticker/SSE/decision artifacts are byte-identical and the §2.1 route/artifact/generated-client inventories match. From `byte-identity.json` alone, GATE Q can observe the API check command/status, the 52-operation baseline path/count/base/current digest, all five exact artifact paths with base/current SHA-256 and match, the recursively enumerated base/current entries/digests/additions/removals under `libs/api/src/generated/`, both decision-artifact hashes, and the exact exclusion list; any missing row, route/artifact/client addition, removal or mismatch is non-zero. | test |
| AC-26 | As a trader, I expect production behavior to remain closed and unchanged. | Normal production `serve` cannot select fixture/harness assembly or temporary-store fallback, still refuses unmet production prerequisites before listener/workers, and receives no request from either harness profile. | test |

## 4. UI + interaction

**Flows:** `NO_UI_CHANGE`. The only flow is developer/release-owner CLI → local child process → machine report/process exit. There is no dashboard, trader, browser or operator-web flow.

**Component states:** Not applicable. No component is added or changed; default, loading, empty, error and offline/stale states remain exactly as shipped.

**Copy:** No trader-facing copy is added. The only fixed human-readable report statement is: `This report contains deterministic results from the local fixture/mock harness only. It is not evidence of production capacity, safety, vendor performance, or a scaling guarantee.` Missing, unsupported or skipped required evidence is described as `did not pass`.

**Design authority:** `NO_UI_CHANGE`. `.spire/clusters/tech/context/DESIGN_SYSTEM.md` remains untouched and governs the unchanged dashboard.

**Design direction:** Not applicable; no project-canon component, state, token, motion, layout or copy is introduced.

## 5. Error handling

- Manifest/fixture validation occurs before listener start. Missing, empty, unreadable or schema-invalid inputs produce a complete `did_not_pass` report, name the local input, start no performance scenario and return non-zero.
- Readiness timeout, child exit/crash and loopback bind failure mark the isolation group's scenarios `did_not_pass`; later independent groups still run with their dedicated state when safe. A child lost after baseline cannot be replaced for recovery evidence: its `alive_at_checkpoint` is false, its current sample is missing, and `post_load_recovery` fails.
- Scenario timeout, malformed REST/SSE response, unexpected status, transport error or unexpected disconnect is preserved in that scenario's `failures` with phase and observation identity. Expected not-found and cap refusal retain their separate expected outcome classes.
- Required sampler unsupported, sample missing or non-finite measurement is `did_not_pass`; it is never omitted, coerced to zero or converted to a pass.
- A forbidden connector construction/invocation records the connector ID, fails the scenario and overall run, and does not print a URL, credential or inherited environment value.
- Graceful shutdown begins only after the shared recovery snapshot is immutable and is bounded. If it expires, the runner force-terminates the exact validated child PID, records `cleanup_timeout`, writes the completed report and exits non-zero.
- Report validation precedes atomic replacement. An incomplete temporary report is retained only as a diagnostic sibling and cannot overwrite the last complete final report.
- Diagnostics state the failed scenario, observed value and unit, blocking threshold/direction, then direct the operator only to inspect local prerequisites/fixtures and rerun the same command. There is no automatic retry that hides a first failure and no threshold rewrite.
- No failure is surfaced to the trader UI, production logs or an HTTP diagnostic route because the harness is local CLI/test tooling only.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/capacity-baseline/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This backend/test-tooling feature exercises and preserves the existing anonymous ticker bundle and ticker SSE routes through a private fixture-only child assembly. It adds no endpoint or wire field. The companion file is authoritative for the existing route purposes/error semantics and contains the parseable conformance block for the JSON route; SSE lifecycle remains verified by the capacity harness because a finite JSON conformance probe cannot consume the held stream.
For live conformance against that child, the finite JSON probe uses fixture-catalog symbol `SYN`. This does not alter the separate immutable `SPY?min_dte=7&max_dte=45` identity-oracle request in §2.1.

## 7. Testing strategy

Automation protects all silent-regression risks: closed manifest membership, threshold evaluation, expected-outcome classification, canonical report bytes, atomic failure reports, normal-gate exit propagation, fixture-only assembly, source-pinned outbound inventory, connector poison cases, production/harness separation, resource adapters, lifecycle counter balance, existing REST/SSE behavior and scoring/recommendation byte identity. Tests must demonstrate both accepting and rejecting paths; an assertion-free run or a poison guard that cannot turn red is not evidence.

GATE Q runs the exact external commands from §2.1 for AC-17, AC-18 and AC-25 and inspects their retained JSON receipts; locating or invoking private Rust test names is not acceptable evidence. `npm test` invokes all three commands before the normal profile, so a connector guard that no longer bites, an IV-rank fault that escapes isolation, or a before/after identity mismatch blocks the normal verification aggregate.

Depth is risk-based, not one test per acceptance row:

- Pure unit/property tests cover nearest-rank percentile calculation, threshold boundary direction, deterministic ordering/rounding, report validation, scenario-manifest set equality and evaluator outcome classes.
- Process integration tests launch the real loopback children over fixtures and cover the closed normal flow, REST/SSE protocol behavior, one reused sequential E child, all-seven-child recovery and failure report retention. Recovery controls leak or terminate each B–E child in turn and inject an aggregate-only ceiling breach so no lane can evade the per-child or aggregate verdict. Network is mocked only at the external integration boundary; the Axum router/socket path is real.
- Platform adapter tests run on Windows 11 x64 and Linux x64 and must report comparable semantic units. Missing platform evidence remains a failure.
- Mutation/poison tests remove scenarios/samples, breach every threshold family, invoke each forbidden connector, introduce the self-test's synthetic unlisted-inventory probe, perturb dashboard/generated-client/scoring sources, and prove the corresponding gate goes red. The connector command must enumerate a non-empty manifest inventory and record an exercised result for every ID. The byte-identity control stages an added generated-client descendant and an API operation addition through the existing API-contract checker; each must independently produce the expected nested inventory/check failure while the outer self-test records the rejecting control and succeeds only when both guards bite.
- The optional-fault command exercises `market_state.iv_rank` specifically by failing the IV-store read behind the private child assembly. It compares healthy/faulted core bytes and a stream event while retaining `ai_eval` as a required object; no HTTP fault switch or production environment flag is permitted.
- The identity command treats `apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json` as immutable input, verifies its SHA-256 inventories and pinned reference revision, runs and records the unchanged existing API-contract check, recursively inventories every generated-client descendant, and compares the current fixture output to the committed `before/` bytes. The receipt schema and exact base digests are those in §2.1; updating an oracle, base digest, base entry or accepted route inventory is never part of normal test execution.
- Existing route conformance runs the companion `INTERFACE_CONTRACT.md` JSON block against the live local API. SSE content, cap/refusal and disconnect recovery are tested by the harness and route-level SSE integration tests because the JSON conformance runner cannot hold an event stream.
- Review is limited to the exact bounded disclaimer and visible confirmation that no trader controls, copy, statuses or workflows changed. Structural no-dashboard/no-client-contract guards supplement, not replace, that visible review.

The current frontend stack does have browser harnesses, but none is added or required here because this feature has `NO_UI_CHANGE`; UI paint/layout criteria do not exist.

<!-- spire:council-resolution:v1 93181348ac1149b9b6e4b36d93c756bf95c758cb02933fc73ef7fe331d1d280f folded -->
<!-- spire:council-resolution:v1 2d71310ab01f2670c84a9f6b5f836149ccf16eeb4f7b65f35d06381d5cae6502 folded -->
<!-- spire:council-resolution:v1 1076250f65ebda667cb1ddf096be8d1677359855bf26eb983d8773e5eb135e30 folded -->

## 8. Guardrails this feature must not break

- `[operator-vs-trader-path-separation]`: the harness is CLI/test tooling plus a private inherited control channel. It adds no trader/bundle route, no operator HTTP surface and no UI link. Existing requests are measured, not redefined.
- `[additive-keeps-score-byte-identical]`: entry gate, `opportunity_score`, `opportunity_tier`, `state_fingerprint`, recommendation input/output, scoring/recommendation source, the five pinned API-contract artifacts and the closed generated-client descendant inventory remain byte-identical. The capacity leaf cannot be imported by those modules.
- `[best-effort-isolated-or-null]`: an injected IV-store read failure leaves the core ticker bundle successful and SSE usable, with `market_state.iv_rank` null while the existing `ai_eval` object remains required and unchanged.
- `[production-fails-closed]`: normal production startup retains every schema/config/archive prerequisite before workers/listener; harness assembly is not selectable by production config or fallback.
- `[structural-over-prose-enforcement]`: closed manifest/report types, exhaustive verdicts, fixture-only constructor reachability, source-pinned outbound inventory and mutation/poison controls must make omission, breach and connector use build- or gate-breaking.
- `[no-secrets-in-image]`: fixture/report bytes contain no secrets, inherited environment is allowlisted, credentials are removed, outputs contain no URLs/tokens/absolute user paths, and no build-time secret or root runtime is introduced.
- `[cited-code-is-verified-not-assumed]`: attachment points are the source-read Rust router (`apps/api/src/routes/mod.rs`), ticker route (`routes/market.rs`), SSE route (`routes/stream.rs`), live-capacity guard (`services/live_capacity.rs`), fixture provider (`services/market_data/`) and current normal verification scripts (`package.json`, `apps/api/project.json`). If planning finds bytes have moved, it must re-verify and amend rather than copy stale names.
- The production trading request path still computes exactly one requested ticker. Harness concurrency is multiple clients of that existing path, never an in-request market sweep or scanner-to-score input.
- Vendor gamma still defines profile/walls/net GEX and analytic Black-Scholes gamma still defines the flip. No formula, constant, DTE scope, price anchor, score, tier, fingerprint basis, recommendation math or SSE payload meaning changes.
- `NO_UI_CHANGE`: dashboard source, navigation, component states, copy, payload consumption and browser behavior remain unchanged.
- No live vendor, production service, external database/cache, broker, LLM, OAuth provider, paid service or subscription is used by either profile.

## 9. Open questions

None. All 28 R2 conflicts are settled by the 2026-08-24 human rulings and folded above.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"4b8471a54b8feb68bc3cce1d4ae781827ed7c9e100966ea8114417170ee88ea7","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":1,"conflict_id":"5bccaee120695a570e862e2c9ce18722f413f8c87d114e5b8f9be8c7a7a1bc7c","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"51c1446cd5244eec63428cb1357557c1a0d94ea3bcdfcab9042e17513e05f65c","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"adb59fcddf483cebb61d2952ba78f1701865f535fab3f6c0acbb63a9894ba5cc","disposition":"folded","section":"§1"},{"source":"R2-architect.md","index":4,"conflict_id":"3e08bf190ef5197ec672fbc6cd769c96bf09311f18b3fe9f336d1290e2b2d6f0","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"d8d92ca7d2ed59e329fd57da59a9892b1e19d3ae9ffed30c4d8144a9348204e9","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":6,"conflict_id":"93181348ac1149b9b6e4b36d93c756bf95c758cb02933fc73ef7fe331d1d280f","disposition":"folded","section":"§7"},{"source":"R2-pm.md","index":0,"conflict_id":"f00bd27c0268213121d501f0632d5e08a3f130d06fcd3f6ae9f229443bed25b9","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":1,"conflict_id":"93643b269b975a1a6f686850c90d552da8cfafa63bfc6aed095aebb412a3db09","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":2,"conflict_id":"af0b823df3a83cba62011e51cbd53245bffdb56f63a56da4255fba739263d663","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"ae57512a010bceb52689e6a41b13dbd0d0a2078dd42ec92bb76396dce778f968","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":4,"conflict_id":"2c8988979a79a6770a2b041f3f00a2d6d6c33142393fc350db109199ba9b0d0a","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":5,"conflict_id":"c4d3fc962c75232ed3e33c9c3890a1816272d2cb33a4751985db720b7e37d0cd","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":6,"conflict_id":"7d95da8c88ed838f4204ee98ff49412d9d4e8fba16738bde4f3b310d6e949e15","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":7,"conflict_id":"a7bd5b4b44ab27453b39cd8683ca24b53157cadf6357781d1f60976e4c14144d","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":8,"conflict_id":"85c6881770c1f44d7dbaac40790d540f9fa6dacf8ecdbd0a189ad40e223ff01b","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":9,"conflict_id":"8683910536a413ee0404ba22915fc329cd10aeb2ce4617023e34da5ce5405d68","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":10,"conflict_id":"2d71310ab01f2670c84a9f6b5f836149ccf16eeb4f7b65f35d06381d5cae6502","disposition":"folded","section":"§7"},{"source":"R2-pm.md","index":11,"conflict_id":"320413c46a6a4a3a0c6348215a1123aca55d4a43de1756c2ea49029f823ff635","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"519e3275e76096a5373d1bfe22294cc2dac5f9de8c18978503cfe936ea831aff","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":1,"conflict_id":"21ea7f5d4a1204c9ce5a896b2085407dfa4c04f89c6efa5c86ddddecb6c1a1eb","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":2,"conflict_id":"89da6d69fe60c69f632087afc4ac7e7152c95928fc4cffb38e44603a7860b1bf","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":3,"conflict_id":"4163323d4522a77f9cd95ba2e4c70a56a919cda8d4130c7def4de97bcae22b6d","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":4,"conflict_id":"dcff0b301e277495b10c6401eae7b2d51208b88467fea4485456be0d7385a402","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":5,"conflict_id":"7d0bb97aa65947fe1fde0b5c4af5b6141a6c611c3d12b6938d7cbbe30df3dddf","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":6,"conflict_id":"37602a720e720e001ac97ecad364a4f762bd5c2000139c564e6d4cb40c4b589a","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":7,"conflict_id":"9540723d2dc7fbb4c2bb1ae60d1de1274253608a828cdebe414f945c3fae9b68","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":8,"conflict_id":"1076250f65ebda667cb1ddf096be8d1677359855bf26eb983d8773e5eb135e30","disposition":"folded","section":"§7"}]}
-->
