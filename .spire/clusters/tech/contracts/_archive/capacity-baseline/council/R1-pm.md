# R1 — pm position: capacity-baseline

## Position

### Who this is for, and what job it does

The buyer is a **maintainer or quality-gate operator**, not a trader. Convexa already serves
on-demand ticker analysis and a live stream, and already refuses extra live clients when the
shipped live-subscriber and live-session ceilings are crossed. What it does **not** have is a
named, repeatable way to **load and soak those two surfaces**, with **checked latency, error, and
refusal thresholds**, against **mocked vendors**, so a capacity regression fails a local or CI
command.

The job: **turn an unmeasured live-API / live-stream capacity gap into a failing gate.** A clean
run below the locked thresholds exits 0 and writes a receipt. A run that crosses a locked
p95, unexpected-error, or refusal threshold exits non-zero. Mocked vendor I/O never leaves the
process. The receipt cannot be mistaken for a production measurement, a paid-feed test, or
permission to change score, tier, fingerprint, or production runtime defaults.

This is production-maturity tooling. It adds **no trader-facing product surface**. It is **not**
production SLOs (that is a later program item). It is **not** a second scoring or research path.

### Locked numbers (hermetic regression gates, not production SLOs)

These numbers are product locks for this slice. They exist so a silent capacity regression fails a
command. They do **not** certify Railway, a paid Options feed, or a live-user SLO.

| Profile | Where it runs | Sustained work | Concurrent ticker-analysis clients | Concurrent live-stream clients | 95th-percentile latency of successful ticker-analysis responses | Unexpected errors | Unexpected live-stream drops/errors during the hold |
|---|---|---|---|---|---|---|---|
| **Load** | Local and CI | **60 seconds** | **8** | **16** | **≤ 2.0 seconds** | **0** | **0** |
| **Soak** | Local and GATE Q; **not** the merge CI path | **10 minutes** | **8** | **16** | **≤ 2.0 seconds** | **0** | **0** |

Shipped production defaults this feature **must not change**:

- Live **subscriber** ceiling: **500**
- Live **session** ceiling (distinct live tickers in the shared hub): **50**
- Capacity-refusal **retry guidance: 30 seconds**
- Public per-client request budget: **120 per minute**, with the already-documented load-test disable

Over-capacity is **probed**, not certified at 500/50 in CI. The harness may lower subscriber and
session ceilings **for that probe only**. The receipt must name the ceilings that were in force.
Many live clients on **one** ticker remain admitted while under the subscriber ceiling; a client
that would add a **new** live ticker past the session ceiling is refused. Those two refusals stay
distinct from a public request-budget refusal.

p95 is computed only over **successful** ticker-analysis responses. Expected capacity refusals in
the over-capacity probe are **refusals**, not unexpected errors. Timeouts, unexpected failures, and
unexpected stream drops are unexpected errors. There is **no silent warmup exclusion**: if a
warmup window exists, the receipt names it, and a run that then performs zero counted work is a
configuration failure, not a pass.

### User stories

- **S1** — As a maintainer, I want one named **load** command so that a capacity regression on
  ticker analysis or the live stream fails before I push.
- **S2** — As a maintainer, I want one named **soak** command so that a leak or exhaustion that a
  60-second load would miss fails a longer local/GATE Q run.
- **S3** — As a maintainer, I want both commands to run against **mocked vendors** so that
  capacity evidence never burns the paid Options feed and never depends on vendor availability.
- **S4** — As a reviewer, I want a receipt that cannot be mistaken for a **production
  measurement** or a **score-change authorization** so that a green hermetic run cannot launder
  into an SLO claim or a scoring change.
- **S5** — As a reviewer, I want **empty, skipped, unmocked, interrupted, and infrastructure
  failures** to be distinct non-zero outcomes so that “nothing ran” cannot look like “nothing
  failed.”
- **S6** — As an operator, I want the shipped **live-subscriber vs live-session** refusal
  behavior exercised so that a regression in admission/refusal is caught without opening 501
  production-default connections in CI.
- **S7** — As the desk owner, I want this harness **off every trader path**, **byte-identical
  score / tier / fingerprint**, and **unchanged production runtime defaults** so that a quality
  gate cannot drift the desk (`operator-vs-trader-path-separation`,
  `additive-keeps-score-byte-identical`, `single-ticker-on-demand`, `production-fails-closed`).
- **S8** — As a release owner, I want **CI to run load, not soak**, and I want that distinction
  visible on receipts so that a 60-second CI pass is never reported as a soak.

### Scope

#### In

- One named **load** command and one named **soak** command, each driving **both** in-scope
  surfaces: on-demand **ticker analysis** (the trading request path that computes the one ticker
  asked for) and the **live stream** (subscribe, hold, capacity refusal).
- Checked thresholds in the table above, failing the command when crossed.
- A **separate over-capacity probe** (harness-local reduced ceilings allowed) that observes:
  extra live clients refused at the subscriber ceiling; extra distinct live tickers refused at
  the session ceiling; many clients on one ticker still admitted under the subscriber ceiling;
  retry guidance of 30 seconds on those refusals.
- **Mocked vendor I/O that never leaves the process.** A run that would use the live paid feed or
  a production host is refused before work starts.
- A **receipt** on every terminal run (pass or fail) naming profile, duration, concurrency,
  ceilings in force, observed p95, unexpected-error count, refusal count, mock/not-production
  standing, and pass/fail against the locked thresholds.
- **CI wiring for load only.** Soak is a local + GATE Q command this slice.
- Harness-local handling of the public request budget so the load/soak process is not itself
  failed by the production default budget, **without deleting** that budget from production
  behavior.
- Discoverable command names on the project runner / root scripts a maintainer already uses for
  quality gates.
- Hermetic verifiability from command exit code, receipt text, and vendor-I/O isolation —
  no trader UI.

#### Out

- Any trader-facing UI, route, nav item, copy, theme, motion, or in-app capacity meter.
- Any change to opportunity score, tier, entry gate, fingerprint, weights, or quantitative
  outputs.
- Any change to **production** live-subscriber / live-session ceilings, retry guidance, public
  request-budget default, or other production runtime defaults.
- Pointing the harness at the production host, or any recipe that burns the paid Options feed.
- Treating a green hermetic receipt as a **production SLO**, a live-user capacity certification,
  or authorization to change scoring (`telemetry-slos` is a later program item).
- Load-testing the scanner sweep worker, AI recommendation, auth, broker, research CLIs,
  operator-metrics readout, or the full public API catalog. This slice is ticker analysis + live
  stream, not “every route.”
- An in-request market sweep. Concurrency is many clients each asking for **one** ticker. The
  harness is an **off-request test driver**.
- Certifying 500 live subscribers or 50 live sessions as a CI proof. Probes use reduced
  ceilings; production defaults stay 500/50.
- Multi-replica fan-out, shared live-hub across processes, Kubernetes, Kafka, or service mesh
  (`replica-safe-workers` and later program items).
- 24-hour soak, hosted soak, or paid performance-lab services.
- A second scoring, replay, or research-measurement path. The receipt **Authorizes: nothing** on
  the live score.
- Frontend/dashboard runtime change. `NO_UI_CHANGE`.

#### Future-dated

- Production SLOs, dashboards, and alert runbooks (`telemetry-slos`, program #7).
- Soak on the merge CI path, or a soak longer than 10 minutes, after this baseline exists and
  flake/cost are measured.
- Tightening the 2.0s hermetic p95 after observed receipt figures exist. The first slice records
  observed p95; it does **not** auto-tune the gate downward (auto-tune would hide regressions).
- Exercising production-default 500/50 with real connection counts in a dedicated lab, if an
  owner later wants that certification.
- Replica-safe live-stream fan-out and distributed request budgets (`replica-safe-workers`).
- Remote archive body store and the rest of the production-maturity sequence after this item.

### Product behavior

**Actors:** maintainer / quality-gate operator at a terminal or CI. **Not** the trader on
Landing / Ticker / Positions / Scanner.

**Happy path**

| Situation | What must be true |
|---|---|
| Clean load, mocked vendors, under ceilings | The load command drives ticker analysis and live stream at 8 + 16 concurrency for 60 seconds, stays within the locked p95/error/drop thresholds, exits 0, and writes a load receipt. |
| Clean soak, same mock and concurrency | The soak command does the same for 10 minutes, exits 0, and writes a soak receipt. After it ends, a follow-up ticker-analysis request is still served. |
| Vendor isolation | The entire run performs **zero outbound vendor I/O**. No paid Options credential is required. |
| CI | The merge CI path invokes **load**, not soak. A CI pass is a load pass. |
| Desk | Score / tier / fingerprint for the same market inputs are unchanged. No trader surface appeared. Production defaults are unchanged. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| p95 of successful ticker-analysis responses exceeds 2.0s | Command exits **non-zero** and the receipt names the **latency** threshold as failed. |
| Unexpected error count exceeds 0 | Command exits **non-zero** and the receipt names the **error** threshold as failed. |
| Unexpected live-stream drop/error during the hold | Command exits **non-zero** and the receipt names the **stream-hold** threshold as failed. |
| Live clients exceed the subscriber ceiling (probe; reduced ceiling allowed) | Additional clients are **refused** with **30-second retry guidance**. Already-admitted clients are not silently converted into a green “held” count. |
| A client would add a new live ticker past the session ceiling | That client is **refused** with **30-second retry guidance**, distinct from a subscriber-ceiling refusal and from a public request-budget refusal. |
| Many live clients on **one** ticker, under the subscriber ceiling | They are **admitted** even if their count exceeds the session ceiling. |
| Live client under both ceilings | **Admitted** (positive control). A probe that only ever refuses is not evidence of admission. |
| Mock / fixture absent or unusable | Command exits **non-zero** as a **configuration** failure, performs **no** live vendor I/O, writes **no** success receipt. |
| Run would target live vendor or production host | **Refused before work starts.** No success receipt. |
| Zero ticker-analysis requests or zero live-stream clients executed | **Configuration failure**, non-zero. Not a pass. |
| Harness-controlled process fails to start | **Infrastructure failure**, non-zero. Not a passed threshold check and not a configuration-empty pass. |
| Interrupted / crashed run | Non-zero; **no** success receipt left behind that could later be quoted as a pass. |
| Public request budget still enabled at a low cap (limiter probe) | Excess requests are **refused** as request-budget refusals, proving the limiter still exists. |
| Load receipt vs soak receipt | Profile name and recorded duration disagree with the command that was invoked → the run is not labeled as the other profile. |
| Secrets in output | Receipt and command output contain **no** secret values. |

**Closed product rules (binding)**

1. **Maintainer gate, not a trader feature.** No in-app surface.
2. **Two named commands, two jobs.** Load is the CI/pre-push gate. Soak is the longer local/GATE Q
   gate. One cannot silently stand in for the other.
3. **Both surfaces or it did not run.** A green load or soak that executed only analysis or only
   streams is a configuration failure.
4. **Mocked vendor or it does not start.** Miss/unmocked stays unmocked; never a live fill-in.
5. **Hermetic numbers are regression gates, not production SLOs.** Every receipt says so.
6. **Over-capacity is a probe with named ceilings**, not a silent rewrite of production 500/50.
7. **Subscriber ceiling ≠ session ceiling ≠ request-budget.** Three distinct refusal families.
8. **Absent work ≠ passed thresholds ≠ infrastructure failure** (`absent-is-not-none`).
9. **The harness is an off-request driver** (`single-ticker-on-demand` narrowed form). It never
   becomes an in-request universe sweep and never becomes a second scoring path.
10. **A receipt authorizes nothing** on live score / tier / fingerprint / production defaults
    (`score-change-is-deliberate-and-measured`, `additive-keeps-score-byte-identical`).
11. **Production fails closed; the harness does not fail open.** Missing mock does not fall
    through to the paid feed (`production-fails-closed` applied to this operator tool).

### Acceptance criteria

Observable from **command exit code, command listing, and receipt text** (plus vendor-I/O
isolation and live score identity). No source reading required. `Verify by` is risk-based:
`test` where silent regression is plausible; `review` where the behavior is visible/intentional.
Never one-test-per-AC theater. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | A named load command is listed on the project runner and root package scripts a maintainer already uses for quality gates, with a name that reads as load (not soak, not a generic “test”). | review |
| **AC-2 (SB)** | S2 | A named soak command is listed the same way, is not an alias of the load command, and is invocable independently. | review |
| **AC-3 (SB)** | S1 | Given mocked vendors and a process under the live ceilings, the load command exits 0. | test |
| **AC-4 (SB)** | S2 | Given the same mocked-vendor setup, the soak command exits 0. | test |
| **AC-5 (SB)** | S1 | A successful load receipt records at least 60 seconds of sustained work and records that 8 ticker-analysis clients and 16 live-stream clients were executed (non-zero on both surfaces). | test |
| **AC-6 (SB)** | S2 | A successful soak receipt records at least 10 minutes of sustained work and records that 8 ticker-analysis clients and 16 live-stream clients were executed (non-zero on both surfaces). | test |
| **AC-7 (SB)** | S1 | On a successful load, the receipt’s 95th-percentile latency of successful ticker-analysis responses is ≤ 2.0 seconds. | test |
| **AC-8 (SB)** | S2 | On a successful soak, the receipt’s 95th-percentile latency of successful ticker-analysis responses is ≤ 2.0 seconds. | test |
| **AC-9 (SB)** | S1 | On a successful load, the receipt’s unexpected-error count is 0 and unexpected live-stream drop/error count during the hold is 0. | test |
| **AC-10 (SB)** | S2 | On a successful soak, the receipt’s unexpected-error count is 0 and unexpected live-stream drop/error count during the hold is 0. | test |
| **AC-11 (SB)** | S2 | After a successful soak, one follow-up ticker-analysis request against the same harness-controlled process is served successfully (the process is not left unable to serve). | test |
| **AC-12 (SB)** | S1 | When ticker-analysis latency is forced above the 2.0s p95 threshold, the load command exits non-zero and the receipt names the latency threshold as failed. | test |
| **AC-13 (SB)** | S1 | When unexpected errors are forced above 0, the load command exits non-zero and the receipt names the error threshold as failed. | test |
| **AC-14 (SB)** | S1 | When unexpected live-stream drops/errors are forced during the hold, the load command exits non-zero and the receipt names the stream-hold threshold as failed. | test |
| **AC-15 (SB)** | S3 | A full successful load run and a full successful soak run each complete with **zero outbound vendor I/O**. | test |
| **AC-16 (SB)** | S3 | When the mock/fixture is absent or unusable, the invoked command exits non-zero as a configuration failure, performs zero outbound vendor I/O, and writes no success receipt. | test |
| **AC-17 (SB)** | S3 | When the configuration would use a live vendor or the production host, the command refuses **before** issuing work, exits non-zero, and writes no success receipt. | test |
| **AC-18 (SB)** | S5 | A run that executes zero ticker-analysis requests or zero live-stream clients exits non-zero as a configuration failure and is not reported as a passed threshold check. | test |
| **AC-19 (SB)** | S5 | Failure to start the harness-controlled process exits non-zero as an infrastructure failure, not as a passed threshold check and not as a configuration-empty pass. | test |
| **AC-20 (SB)** | S5 | An interrupted run exits non-zero and leaves no success receipt that could later be quoted as a pass. | test |
| **AC-21 (SB)** | S6 | With a harness-local subscriber ceiling of N, the first N live clients are admitted and the next client is refused with retry guidance of 30 seconds. | test |
| **AC-22 (SB)** | S6 | With a harness-local session ceiling of 1, multiple live clients on **one** ticker are admitted while under the subscriber ceiling, and a client that would add a **second** live ticker is refused with retry guidance of 30 seconds. | test |
| **AC-23 (SB)** | S6 | Subscriber-ceiling refusal, session-ceiling refusal, and public request-budget refusal are textually distinct on the receipt/output — they cannot share one undifferentiated “rejected” marker. | test |
| **AC-24 (SB)** | S7 | After this feature ships, production defaults remain live-subscriber ceiling 500, live-session ceiling 50, retry guidance 30 seconds, and public request budget 120 per minute. | test |
| **AC-25 (SB)** | S1 | The load and soak processes complete their in-threshold runs without being failed by the production-default public request budget (a harness-local disable or equivalent is allowed). | test |
| **AC-26 (SB)** | S6 | With the public request budget enabled at a low cap, excess requests are refused as request-budget refusals (the limiter still exists; harness-local disable did not delete it). | test |
| **AC-27 (SB)** | S4 | Every success and failure receipt states that the run used mocked vendor I/O and is **not** a production measurement. Deleting surrounding prose cannot remove that standing from the receipt. | test |
| **AC-28 (SB)** | S4 | Receipt text contains no language that would read as a production SLO, a production p95, a live paid-feed measurement, or permission to change live score / tier / fingerprint / weights (no “production SLO met,” “live capacity certified,” “adopt this score,” or equivalent). Enforced by a scan over the run’s own emitted strings. | test |
| **AC-29 (SB)** | S8 | A load receipt is labeled as load and cannot be labeled as soak; a soak receipt is labeled as soak and cannot be labeled as load. | test |
| **AC-30 (SB)** | S8 | The merge CI path invokes the load command and does not invoke the soak command. | test |
| **AC-31 (SB)** | S4 | Pass and fail receipts both record observed p95, unexpected-error count, refusal count, duration, concurrency, and ceilings in force — a pass is not an empty “ok.” | test |
| **AC-32 (SB)** | S7 | After a successful load and a successful soak, live opportunity score, tier, and state fingerprint for the same market inputs are **byte-identical** to before the runs. | test |
| **AC-33 (SB)** | S7 | No trader-facing route, nav item, or screen is added or changed. | review |
| **AC-34 (SB)** | S7 | Every ticker-analysis request issued by the harness names exactly one ticker; a universe-sweep shaped request is not how the harness generates concurrency. | test |
| **AC-35 (SB)** | S4 | Canary secret values present in the environment do not appear in command output or receipts. | test |
| **AC-36 (SB)** | S5 | Threshold failure, configuration failure, and infrastructure failure are distinguishable in the command result without reading source. | test |

**Method notes (risk-based).**

- **`test` concentrates on silent gate failures:** exit codes vs thresholds (AC-3/4, AC-12–14),
  both surfaces actually executed (AC-5/6), recorded p95/error/drop (AC-7–10), post-soak
  liveness (AC-11), zero outbound vendor I/O and no live fallback (AC-15–17), vacuous/infra/
  interrupt honesty (AC-18–20), subscriber vs session vs request-budget refusals (AC-21–23,
  AC-26), production defaults unchanged (AC-24), harness not eaten by the production budget
  (AC-25), receipt standing and anti-SLO/anti-score scan (AC-27/28), load≠soak labeling and CI
  path (AC-29/30), non-empty figures (AC-31), score identity (AC-32), single-ticker driver
  (AC-34), secret-egress (AC-35), distinguishable failure classes (AC-36). These can die under
  a refactor while “a command exists” still looks fine.
- **`review` owns intentional naming/surface:** command discoverability (AC-1/2) and the
  no-trader-UI boundary (AC-33).
- Prefer **one** hermetic integration pass: start mocked process → load → assert exit 0 +
  receipt figures + zero vendor I/O → force p95/error/drop over-threshold → assert non-zero →
  over-capacity probe with reduced ceilings → absent-mock / live-target / zero-work refusals →
  soak once at GATE Q — not a named micro-harness per row.
- No DOM harness is required. Observability is command / receipt / vendor-I/O isolation /
  score identity.
- Soak is **not** required on every merge CI job. GATE Q must run soak once as evidence the
  soak command exists and checks the same threshold families. Subsequent CI evidence is load.

**Ship-blocking set:** AC-1–AC-36.

### Product decisions locked in this position

1. **Audience = maintainers of quality gates.** No trader-facing product surface.
2. **Surfaces under test = on-demand ticker analysis + live stream only.**
3. **Two commands:** load (60s, CI + local) and soak (10 min, local + GATE Q, not merge CI).
4. **Concurrency 8 + 16.** Enough to be concurrent; not a 500-client certification.
5. **Hermetic p95 ≤ 2.0s, unexpected errors 0, unexpected stream drops 0.** Regression gates,
   not production SLOs. Observed figures are recorded; the gate is not auto-tuned.
6. **Mocked vendor I/O never leaves the process.** Live/production target is refused before work.
7. **Over-capacity is a reduced-ceiling probe** that preserves subscriber vs session vs
   request-budget as three refusal families, with 30-second retry guidance on capacity refusals.
8. **Production defaults stay 500 / 50 / 30s / 120 per minute.**
9. **Harness is not a second scoring path** and **not** an in-request universe sweep.
10. **Vacuous green is a bug.** Zero work, missing mock, failed start, and interrupt cannot pass.
11. Architect names process wiring, how mock isolation is enforced, and how p95 is collected.
    Product binds the outcomes and numbers above, not mechanism names.

### Binding constraints restated

- **`additive-keeps-score-byte-identical`:** the harness does not become a scoring input or a
  second transform. Score / tier / fingerprint stay byte-identical.
- **`operator-vs-trader-path-separation`:** this is an operator command + receipt, off every
  trader route and unlinked from trader UI.
- **`single-ticker-on-demand`:** the trading request path still computes the one ticker asked
  for. The harness is an off-request test driver, never an in-request market sweep.
- **`production-fails-closed`:** missing mock or a live/production target is a refusal, never a
  silent paid-feed fallback. Production runtime defaults are not loosened to make the gate pass.
- **`no-secrets-in-image`:** no paid-feed credential in the build artifact; receipts do not echo
  secrets.
- **`structural-over-prose-enforcement`:** threshold fail, mock isolation, vacuous-green
  refusal, and load≠soak must bite when poisoned — documentation alone is not the gate.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Existing live-ceiling and request-budget **product** defaults are taken from the
  brief and standing operator canon; mechanism reuse is an architecture assumption below.
- **`best-effort-isolated-or-null`:** a harness failure stays on the operator command. It does
  not become a new trader-visible error on bundle or live stream for ordinary users.
- **`absent-is-not-none`:** zero work, missing mock, threshold fail, and infrastructure fail
  remain distinct.
- **`score-change-is-deliberate-and-measured`:** a capacity receipt authorizes no live score
  change.

## Risks I see

- **SLO laundering.** A green mocked p95 will be quoted as “production can hold this.” AC-27/28
  exist so the receipt cannot say that. Real production SLOs stay a later feature.
- **Vacuous green.** Zero clients, skipped mock, failed bind, or a load labeled as soak would
  look like capacity is fine. AC-18–20, AC-29/30, AC-36.
- **Live-feed fall-through.** A “helpful” missing-mock → paid vendor path would bill the Options
  feed and destroy the brief. AC-15–17.
- **Thresholds too loose.** 2.0s p95 will not catch a 50ms → 1500ms regression. That is an
  accepted first-slice trade: the receipt records observed p95 so a later owner can tighten;
  auto-tune is forbidden. If architecture cannot stay under 2.0s on the locked fixture, that is
  an R2 conflict, not a quiet raise.
- **Thresholds too tight / flaky.** CI noise plus real engine compute on fixtures could make
  2.0s fail randomly and train people to ignore the gate. Same R2 rule: evidence, not silence.
- **Ceiling rewrite.** Implementing over-capacity by shipping production defaults of 4 and 1
  would “pass” probes and shrink the live desk. AC-24.
- **Collapsed refusals.** One “rejected” marker for subscriber, session, and request-budget
  would hide the shipped many-viewers-on-one-ticker rule. AC-21–23.
- **Limiter deleted to make load pass.** Disabling the public request budget globally, or
  removing it, would buy a green load with a production hole. AC-25/26.
- **Second scoring path.** Replaying compute into a research-style report, or using load as a
  score-lab stand-in, would violate the brief. AC-28/32.
- **In-request sweep.** Generating concurrency by asking one request to compute many tickers
  would reopen `single-ticker-on-demand`. AC-34.
- **Soak theater.** Shipping a soak command that is load with a different name, or skipping soak
  at GATE Q, would fail the brief’s load **and** soak requirement. AC-2/6/30.
- **Trader-path creep.** A dashboard “capacity” widget would violate operator/trader separation.
  AC-33.
- **My criteria going unobservable.** If synthesis rewrites rows into “the harness is correct”
  intentions that require reading source, those rows should be cut or restated — not kept for
  coverage theater.

## Assumptions I'm making about the other two lanes

- The architecture lane can drive the **existing** on-demand ticker-analysis path and live-stream
  path from an off-request test driver against a **harness-controlled** process, without adding a
  trader route and without turning one request into a universe sweep, so AC-33/34 are implementable
  as stated.
- The architecture lane can keep **all vendor I/O inside the process** (including on miss) so that
  absent mock is a refusal rather than a live paid-feed fill-in; if the current fixture/port cannot
  cover live-stream plus ticker analysis without outbound I/O, that is an R2 conflict, not a quiet
  scope cut to “analysis only.”
- The architecture lane can collect 95th-percentile **successful** ticker-analysis latency, unexpected
  error count, unexpected stream-drop count, and refusal counts onto a receipt **without** changing
  production runtime defaults or trader-visible payloads.
- The architecture lane can meet **p95 ≤ 2.0 seconds at 8 concurrent mocked-vendor ticker-analysis
  clients** on local and CI for both 60-second load and 10-minute soak; if a measured fixture run
  cannot, architecture says so at R2 rather than silently raising the number.
- The architecture lane can lower live-subscriber and live-session ceilings **for a probe process
  only**, while production defaults remain 500 and 50, so AC-21/22/24 do not fight each other.
- The architecture lane can preserve **three distinguishable refusal families** (subscriber ceiling,
  session ceiling, public request budget) with 30-second retry guidance on the two capacity
  families, matching the shipped product rule that many viewers on one ticker are not refused for
  session-count reasons.
- The architecture lane can disable or raise the public request budget **for the harness process
  only** and still demonstrate, in a separate probe, that the limiter refuses excess when enabled
  (AC-25/26).
- The architecture lane can make a 10-minute soak at 8+16 concurrency finish without wedging the
  process (AC-11) and without requiring merge CI to pay that 10 minutes (AC-30).
- The architecture lane will verify at **live** source which capacity, request-budget, ticker-analysis,
  live-stream, and fixture surfaces are reusable — not Python-era archive paths
  (`cited-code-is-verified-not-assumed`). This position does not assume filenames, types, or
  command flags.
- The architecture lane can prove score / tier / fingerprint byte-identity after load and soak
  without Massive credentials in the build environment.
- The UX / tech-writer lane will design **no trader UI**; if UX proposes a dashboard, route, nav
  item, or in-app capacity meter, that contradicts this Out list and
  `operator-vs-trader-path-separation`, and I will raise it as a conflict at R2.
- The UX / tech-writer lane owns exact operator wording: command names, load vs soak labels, the
  mocked / not-a-production-measurement standing, threshold-fail vs configuration-fail vs
  infrastructure-fail, and the three refusal-family names. I own only that those distinctions
  exist in the receipt, are mutually distinguishable as words, and that production-SLO and
  score-authorization language is absent (AC-27/28 scan emitted text).
- The UX / tech-writer lane can keep receipt copy honest that **Playwright-style hosted-vs-local
  confusion does not recur here**: a CI load pass is not a soak, and a local soak is not a
  production measurement.
