# R3 — decisions: capacity-baseline

## Human rulings

### Fast normal check plus extended release soak — A, 2026-08-24

The mandatory normal local profile targets completion within three minutes and includes a 60-second
mixed REST/SSE soak. The same harness also exposes a separately selectable 15-minute extended soak for
release evidence. The extended profile is not a substitute for the mandatory short profile, and neither
profile may silently omit a closed scenario. Neither result claims production throughput or an SLO.

This resolves conflicts
`4b8471a54b8feb68bc3cce1d4ae781827ed7c9e100966ea8114417170ee88ea7`,
`f00bd27c0268213121d501f0632d5e08a3f130d06fcd3f6ae9f229443bed25b9`, and
`519e3275e76096a5373d1bfe22294cc2dac5f9de8c18978503cfe936ea831aff`.

### Windows 11 and Linux x64 in v1 — A, 2026-08-24

Windows 11 and Linux x64 are the required v1 platforms. Each must provide complete, comparable
resident-memory, open-handle/descriptor, runtime-task, and active-request/stream observations; an
unsupported or missing required measurement fails rather than passing as zero or being skipped. The
sampler remains a port so macOS can be added later, but v1 makes no macOS support claim.

This resolves conflicts
`adb59fcddf483cebb61d2952ba78f1701865f535fab3f6c0acbb63a9894ba5cc`,
`93643b269b975a1a6f686850c90d552da8cfafa63bfc6aed095aebb412a3db09`, and
`21ea7f5d4a1204c9ce5a896b2085407dfa4c04f89c6efa5c86ddddecb6c1a1eb`.

### Concurrent warm and parallel pressure — A, 2026-08-24

The closed normal workload primes the representative single-ticker cache, discards warm-up
observations, then measures 200 warm requests at concurrency 16. Its shared-capacity phase measures 320
requests at concurrency 32. A separately named 32-client cold-identity burst remains required to test
request coalescing; it cannot replace the 320-request phase. Every retained scenario has its own report
row, cache precondition, sample count, and threshold, and the combined normal profile must still meet the
human-selected three-minute target.

This resolves conflicts
`5bccaee120695a570e862e2c9ce18722f413f8c87d114e5b8f9be8c7a7a1bc7c`,
`51c1446cd5244eec63428cb1357557c1a0d94ea3bcdfcab9042e17513e05f65c`,
`af0b823df3a83cba62011e51cbd53245bffdb56f63a56da4255fba739263d663`,
`ae57512a010bceb52689e6a41b13dbd0d0a2078dd42ec92bb76396dce778f968`,
`89da6d69fe60c69f632087afc4ac7e7152c95928fc4cffb38e44603a7860b1bf`, and
`dcff0b301e277495b10c6401eae7b2d51208b88467fea4485456be0d7385a402`.

### Full-capacity orderly churn plus abrupt-drop coverage — A, 2026-08-24

The required SSE recovery scenario runs ten full waves at the configured v1 cap of 32 accepted
clients, with every client closing normally and service-side subscriber/task state returning to its
pre-wave baseline. A separately named smaller abrupt-drop scenario is also required; it proves lost
clients release their permits and tasks without replacing or weakening the full-capacity clean-close
evidence. The expected cap-plus-one refusal remains its own successful behavior class, never an
unexpected error.

This resolves conflict
`2c8988979a79a6770a2b041f3f00a2d6d6c33142393fc350db109199ba9b0d0a`.

### Balanced cross-platform latency policy — recommended A accepted, 2026-08-24

The blocking normal-profile ceilings are: warm REST p95 at most 250 ms and every observation at most
1,000 ms; cold REST p95 at most 3,000 ms and every observation at most 5,000 ms; shared-capacity REST
p95 at most 1,500 ms and every observation at most 5,000 ms; accepted SSE connection p95 at most 500
ms; and the expected cap-plus-one refusal observed within 1,000 ms. Every scenario requires zero
unexpected transport, response, or disconnect errors. Supplemental p99 and whole-phase duration may be
reported but cannot replace or silently tighten these versioned blocking limits.

This resolves conflicts
`c4d3fc962c75232ed3e33c9c3890a1816272d2cb33a4751985db720b7e37d0cd`,
`7d95da8c88ed838f4204ee98ff49412d9d4e8fba16738bde4f3b310d6e949e15`,
`a7bd5b4b44ab27453b39cd8683ca24b53157cadf6357781d1f60976e4c14144d`,
`85c6881770c1f44d7dbaac40790d540f9fa6dacf8ecdbd0a189ad40e223ff01b`,
`4163323d4522a77f9cd95ba2e4c70a56a919cda8d4130c7def4de97bcae22b6d`, and
`7d0bb97aa65947fe1fde0b5c4af5b6141a6c611c3d12b6938d7cbbe30df3dddf`.

### Balanced soak and recovery resource policy — recommended A accepted, 2026-08-24

The normal profile samples after a stabilized pre-load baseline. During mixed load, resident memory may
be at most 128 MiB above baseline, while open handles/descriptors and runtime tasks may each be at most
eight above baseline. Thirty seconds after all generated traffic drains, resident memory may be at most
64 MiB above baseline, handles/descriptors and tasks may each be at most two above baseline, and exact
harness-owned request and subscriber counts must return to their pre-load values. Missing or unsupported
required samples fail. Median and slope observations remain diagnostics; the 15-minute profile also fails
on a positive quiescent-memory slope above 1 MiB/minute.

This resolves conflicts
`d8d92ca7d2ed59e329fd57da59a9892b1e19d3ae9ffed30c4d8144a9348204e9`,
`8683910536a413ee0404ba22915fc329cd10aeb2ce4617023e34da5ce5405d68`, and
`37602a720e720e001ac97ecad364a4f762bd5c2000139c564e6d4cb40c4b589a`.

## Technical resolutions

### Isolation claim is source-bounded and poison-proved

A passing run records zero attempted use of every non-local integration in the complete,
source-verified outbound connector inventory. Any attempted use fails the scenario and overall run.
The harness uses the real router with fixture market data, local or temporary stores, a non-network
stream producer, loopback-only binding, and an allowlisted environment. A mutation-tested source guard
pins the connector inventory, while poison tests prove each forbidden adapter selection turns the run
red. This does not claim portable detection of an arbitrary future direct socket; a universal operating-
system egress sandbox is out of scope.

This resolves conflict
`3e08bf190ef5197ec672fbc6cd769c96bf09311f18b3fe9f336d1290e2b2d6f0`.

### Machine names and human wording have separate owners

Architecture owns machine-interface semantics: profiles, schema fields and types, requiredness,
canonical order, versioning, units, statistical basis, and failure behavior. R4 binds the exact command
and report-member names. UX owns claim-safe diagnostics, remediation wording, and comprehensible
presentation of those semantics, but may not rename them or invent units or guarantees.

The required bounded statement is: `This report contains deterministic results from the local
fixture/mock harness only. It is not evidence of production capacity, safety, vendor performance, or a
scaling guarantee.` Missing, unsupported, or skipped required evidence reads `did not pass`, never as
success. Remediation directs the operator only to check local harness inputs and rerun the documented
command.

This resolves conflicts
`320413c46a6a4a3a0c6348215a1123aca55d4a43de1756c2ea49029f823ff635` and
`9540723d2dc7fbb4c2bb1ae60d1de1274253608a828cdebe414f945c3fae9b68`.

### Verification stays risk-based

Automated tests cover threshold evaluation, isolation, report completeness, failure exits, resource
recovery, unchanged trader responses/streams/scores/recommendations, and structural no-dashboard/no-
client-contract change. Review covers bounded operator wording and visibly unchanged trader controls,
copy, statuses, and workflows. Structural guards supplement but do not replace visible review; there is
no one-test-per-criterion mandate.

This resolves conflicts
`2d71310ab01f2670c84a9f6b5f836149ccf16eeb4f7b65f35d06381d5cae6502`,
`1076250f65ebda667cb1ddf096be8d1677359855bf26eb983d8773e5eb135e30`, and
`93181348ac1149b9b6e4b36d93c756bf95c758cb02933fc73ef7fe331d1d280f`.

## Product rulings still pending

None.
