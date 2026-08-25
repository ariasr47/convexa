# R1 — architect position: capacity-baseline

## Position

### Technical shape and option choice

Build one repository-owned Rust capacity harness beside the API crate. It orchestrates a harness-only child-service mode, drives real loopback HTTP and SSE clients, samples the child process, evaluates a closed threshold policy, writes one canonical machine-readable report, and exits non-zero after the report is complete when any required observation fails. The child-service mode assembles the same router and request/SSE execution path as normal serve, but accepts only fixture-backed market data, ephemeral loopback binding, and temporary persistence roots; it is not a production configuration flag and cannot be selected by normal serve.

I choose this over k6/Vegeta plus shell scripts. The Rust option has moderately higher initial complexity, but lower install and operating cost, better team familiarity, direct reuse of the existing fixture provider seam, and access to typed lifecycle probes; cost and hermeticity are decisive. I choose a child process over an in-process router test because OS memory and descriptor/handle measurements need a process boundary and SSE must traverse the real socket lifecycle; fidelity is decisive despite the extra child-control machinery.

### Component boundaries

Keep six one-way components:

1. A closed scenario model owns workload phases, protocol kind, fixture identity, concurrency/hold/duration settings, expected outcome class, and threshold policy. It contains no application route implementation or scoring logic.
2. A runner validates the full manifest, creates unique temporary state, starts one fresh child per isolation group, waits on a bounded readiness barrier, executes scenarios, requests graceful shutdown, and force-terminates only after a bounded cleanup timeout that itself fails the run.
3. Separate REST and SSE drivers own client concurrency and monotonic timing. They return observations; they do not decide pass/fail.
4. A harness-only application assembler owns fixture injection and a test lifecycle probe. The live-provider constructor is absent from this assembler's reachable type graph; an attempted live-provider selection is a setup failure before a listener starts. Exact reuse anchors in the current Rust assembly are `[lane-check]` because this R1 was intentionally limited to the supplied context pack rather than source inspection.
5. A resource sampler owns platform adapters for resident memory and open descriptor/handle count. Linux, macOS, and Windows adapters are required; an unavailable adapter is a failed required observation, never a skipped check. The service lifecycle probe counts active SSE subscribers and spawned SSE tasks by RAII guards at create/drop boundaries; if the existing subscriber permit cannot expose this safely, add a test-only counter at that boundary `[lane-check]`.
6. An evaluator consumes immutable observations and a versioned threshold set; a reporter serializes the result in stable scenario order with fixed units and rounding. The runner validates the completed report against the closed manifest before returning success.

No component may import into the quant/scoring or recommendation modules. The dependency direction is application-under-test → existing domain/engine, while harness drivers and evaluators only consume the application's externally observable behavior plus the test lifecycle probe.

### Closed v1 workload

The normal local profile must finish within three minutes on a supported development host and must contain every following scenario; reducing counts or omitting a scenario requires changing the versioned manifest, so selection cannot silently shrink:

- REST warm: prime one representative single-ticker request, discard five warm-ups, then measure 100 serial cache-hit requests.
- REST cold: use 12 deterministic fixture/cache identities, each exactly once against fresh temporary state, so a measured request cannot inherit a prior cache entry without adding a cache-reset route.
- REST parallel: launch 32 clients simultaneously against one cold identity to exercise request coalescing, then 32 clients across eight warm identities to exercise shared read capacity.
- SSE lifecycle: connect and hold at configured capacity, prove one additional connection receives the existing refusal behavior, disconnect all accepted clients, wait through a bounded quiet period, and prove the next connection is accepted.
- SSE churn: run ten connect/hold/disconnect waves at one quarter of configured capacity, with all clients closing from both orderly and abrupt sides.
- Short soak: sustain mixed warm REST traffic and SSE occupancy/churn for 60 seconds while sampling once per second. The same harness also provides a 15-minute extended profile; it is not a substitute for the mandatory short soak in the normal gate.

The configured SSE cap is the source of truth; the harness tests cap-minus-one, cap, and cap-plus-one behavior rather than copying the cap into test code. Expected cap refusal is classified separately from an unexpected transport/application error.

### Threshold and recovery policy

Use monotonic clocks and nearest-rank percentiles over completed samples. Warm REST must have zero unexpected errors, p95 at or below 250 ms, and p99 at or below 500 ms. Cold REST must have zero unexpected errors and p95 at or below 2 seconds. Both parallel phases must complete every request, have zero unexpected errors, p95 at or below 3 seconds, and finish within 5 seconds wall time. Accepted SSE connects must have p95 at or below 500 ms; the over-cap refusal must arrive within 500 ms; accepted streams must not disconnect unexpectedly.

Sample resources after readiness but before load, throughout load, and for a 10-second quiet grace after every SSE phase. At the end of grace, active subscriber count and harness-observed SSE task count must equal their pre-phase baselines; descriptor/handle count may be at most baseline plus two. Quiescent resident memory, defined as the median of the last three samples, may be at most baseline plus the larger of 16 MiB or 10 percent, and three successive post-wave quiet samples may not rise by more than 4 MiB total. The extended profile additionally fails on a positive quiescent-memory slope above 1 MiB per minute. These are fixed ceilings, not calibrated from the same run, because self-calibration would normalize a regression.

Thresholds are intentionally generous for fixture-backed local execution and still catch order-of-magnitude latency regressions, refusal failures, leaked permits/tasks, and unbounded resource growth. Host identity, OS, architecture, revision, profile version, and sampler support are recorded as evidence, but host speed never rewrites the threshold policy.

### Data flow, determinism, and failure isolation

The runner validates fixtures and thresholds first, launches the fixture-only child with vendor credentials removed, and accepts only loopback destinations. The child emits lifecycle snapshots over a harness-owned process channel rather than a trader or operator HTTP route. Drivers generate requests from a fixed seed and closed manifest, append immutable observations, then the evaluator folds observations into scenario verdicts. The reporter writes to a temporary sibling and atomically replaces the final report only after all required sections exist.

"Deterministic report" means canonical schema version, scenario membership/order, units, rounding, seed, and serialization for the same observations; measured latency and resource values are evidence and are not falsely claimed to be byte-identical across hosts. Random request identifiers, wall-clock prose, unordered maps, and secrets are excluded. A scenario timeout, driver error, malformed response, missing sample, sampler failure, isolation violation, child crash, cleanup timeout, or absent report section is a first-class failed verdict. Independent scenarios continue after a failure by receiving fresh child state, so one fault does not erase later evidence; the final process exits non-zero after report emission.

Vendor isolation is enforced by construction at three layers: the harness assembler accepts only the fixture provider type, the child environment contains no live vendor credential, and the manifest records a zero live-provider-construction/invocation count from a poisonable audit guard. The runner refuses success if any layer is absent. No paid service, external network, database, browser, or production deployment participates.

### Normal-gate placement

The fast profile is one non-optional member of the repository's normal local verification aggregate; its report must exist, validate, contain the exact manifest, and contain no failed or missing verdict before the aggregate succeeds. The exact existing aggregate insertion point is `[lane-check]` until the planner reads the repository scripts. The extended soak is a separately selectable profile using the same executable, manifest vocabulary, evaluator, and report schema, so it cannot drift into a second harness.

### Restated binding constraints and explicit non-goals

- `[operator-vs-trader-path-separation]`: this is a CLI/test harness and inherited process channel only. It adds no trader/bundle route, operator HTTP surface, vendor fetch, cache mutation beyond the traffic being measured, or UI link.
- `[additive-keeps-score-byte-identical]`: the harness may observe existing score, tier, entry-gate, and fingerprint bytes but cannot supply inputs to them. Build enforcement must poison-prove the one-way dependency rule and hold the scoring/recommendation source diff empty for this feature.
- `[best-effort-isolated-or-null]`: injected failure of an optional added computation must still leave the core bundle successful and SSE usable, with the optional result absent; the harness records this as a required isolation scenario rather than changing the existing error policy.
- `[production-fails-closed]`: harness-only assembly cannot weaken or bypass production startup validation. Normal production serve has no harness-mode fallback, fixture auto-selection, temporary-store fallback, or listener-before-preflight path.
- `[structural-over-prose-enforcement]`: closed manifests, exhaustive outcome types, unreachable live-provider construction, versioned report validation, and mutation tests that poison scenario omission, threshold breach, provider invocation, and missing resource samples must make each violation turn the gate red.
- `[no-secrets-in-image]`: fixtures and reports contain no secrets; the harness strips vendor credentials, redacts the inherited environment to an allowlist, and introduces no build-time secret or root-runtime requirement.
- `[cited-code-is-verified-not-assumed]`: source-specific attachment points in this position are marked `[lane-check]`; planning must resolve them by reading current Rust and verification-script sources before naming files or symbols.
- The trading request path remains single-ticker-on-demand. Harness concurrency is many clients invoking representative existing single-ticker requests; it does not add an in-request market sweep or feed a scanner result into the request path.
- Vendor gamma continues to define the profile/walls/net GEX, while analytic Black-Scholes gamma continues to define the flip over the existing grid and expiry floor. The harness changes no gamma source, formula, constant, DTE scope, price anchor, score, tier, fingerprint basis, recommendation input, or recommendation math.
- `NO_UI_CHANGE`: no dashboard source, layout, copy, browser behavior, or generated client contract changes. A zero-dashboard-diff guard belongs in verification.

Explicit non-goals are production capacity certification, cloud or multi-replica load, live-vendor benchmarking, WAN/TLS benchmarking, database stress, browser/UI performance, score calibration, math optimization, auto-scaling policy, alerting/telemetry rollout, and authorization to change a production threshold. The report is local comparative evidence; it does not claim hosted throughput.

## Risks I see

- Local scheduling and power-management noise can breach a fixed latency ceiling. Warm-ups, sample counts, monotonic timing, generous absolute ceilings, and environment evidence reduce ambiguity, but a slow host remains an honest gate failure rather than a reason to self-calibrate.
- Process memory allocators retain arenas after valid cleanup, so RSS alone can report a false leak. Exact subscriber/task recovery and descriptor/handle recovery are the primary leak proofs; quiescent RSS delta and slope are secondary bounded signals.
- A fixture corpus can be too cheap to represent production compute. The manifest therefore needs representative chain sizes and response shapes pinned in fixture metadata; changing that corpus changes the profile version and cannot silently make the gate easier.
- Test-only lifecycle probes can alter the path they measure. RAII integer counters with no allocation or I/O on the SSE hot path limit observer effect; the 15-minute profile must also run with probe sampling reduced to confirm the same verdict.
- Platform resource adapters can disagree semantically. Each adapter must document whether it counts descriptors or handles and pass adapter parity fixtures; unsupported semantics fail visibly rather than reporting zero.
- The current fixture/provider assembly, SSE permit owner, and normal verification aggregate are not source-read in this blind round. Every claimed attachment remains `[lane-check]` until planning verifies it; if any seam is absent, the mechanism must be revised rather than asserted.

## Assumptions I'm making about the other two lanes

- I assume PM accepts a mandatory local profile capped at three minutes plus an optional 15-minute profile; if PM requires the full soak on every normal verification, the gate-cost design and scenario counts must change.
- I assume PM treats the numeric v1 ceilings above as regression tripwires for fixture-backed local execution, not production SLOs; if they are intended as customer-facing or hosted-capacity promises, local evidence is insufficient.
- I assume PM requires every closed scenario and every supported-platform resource observation to be present for success; if partial evidence may pass, the closed-manifest failure mechanism must be weakened explicitly.
- I assume PM accepts expected over-cap SSE refusal as a successful behavior observation rather than an error-rate event; if refusal semantics differ, the evaluator classification must change without changing the service contract in this feature.
- I assume UX/Tech Writer owns the exact CLI command names, report member names, diagnostic wording, and operator remediation text; if those are not supplied, the synthesizer must define them without altering the technical report contents described here.
- I assume UX/Tech Writer will preserve `NO_UI_CHANGE` and place no trader-facing surface or copy around this harness; if discoverability is required, it belongs in repository/operator documentation only.
- I assume both lanes accept that deterministic serialization does not mean identical latency measurements across machines; if byte-identical reports are required, the report must exclude the evidence it was created to measure.
