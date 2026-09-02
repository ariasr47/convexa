```json
{
  "role": "pm",
  "agree": [
    "It is a **test driver**, not a runtime service, not a research score lab, and not a second Path-B.",
    "Vendor I/O must never leave the process.",
    "Mixing cold and warm into one percentile is forbidden — that would hide a cache-miss regression inside hit noise.",
    "Those 503s are **expected refusals**, not error-budget failures.",
    "The harness does **not** open 500 real SSE connections in CI.",
    "No trader-visible behavior, copy, layout, or dashboard surface.",
    "No claim that mocked p95 equals production vendor RTT.",
    "Missing file is a hard error, not a skip-as-pass.",
    "Each SSE hold must prove it received injected ticks (count > 0 of non-comment events) or the scenario is fail, not skip.",
    "We do not retune production 120/min.",
    "`NO_UI_CHANGE` is binding.",
    "There is **no trader screen here**, and there is **no `/_ops/metrics` change**.",
    "Do not call locks **SLOs**.",
    "A harness p95 is a **different datum**.",
    "Human summary, machine receipt, and **exit code must agree**.",
    "Do not reuse `RESEARCH READ` / `RESEARCH REPLAY` as the title — a pasted receipt would inherit the wrong genre."
  ],
  "conflicts": [
    {
      "quote": "Hermetic p95 ≤ 2.0s, unexpected errors 0, unexpected stream drops 0.",
      "source": "pm",
      "why": "[PM-C01] I withdraw the single 2.0s ticker-analysis bucket. Mixing cold and warm into one percentile would hide a cache-miss regression inside hit noise, and a 14k-contract cold wave cannot honestly sit under 2.0s if the cold class is budgeted at 4000ms. Unexpected-error count 0 and unexpected stream-hold drops 0 still stand.",
      "proposal": "Split latency locks by scenario (cold HTTP, warm HTTP, SSE time-to-first-byte, SSE emit after inject). Compute each p95 only from successful samples of that scenario. Do not auto-tune. Keep unexpected errors 0 and unexpected stream-hold drops 0 as command-fail locks.",
      "kind": "technical"
    },
    {
      "quote": "A successful load receipt records at least 60 seconds of sustained work and records that 8 ticker-analysis clients and 16 live-stream clients were executed (non-zero on both surfaces).",
      "source": "pm",
      "why": "[PM-C02] I withdraw the 60-second floor and the 8+16 pair as sacred product numbers. Sixty seconds is a dead zone: too short to own leak detection (that is the 10-minute soak) and longer than needed to sample p95/error/refusal on both surfaces. Eight-and-sixteen was 'enough to be concurrent,' not a 500-client certification; the architect's tens-of-clients split still does that job.",
      "proposal": "Keep two named commands, both surfaces actually executed, soak at 10 minutes local + GATE Q and not on merge CI, and a receipt that records the duration and concurrency actually used. Accept a CI-bounded load wall (20s HTTP + 5s SSE hold + refusal probe, total under 60s) and per-profile concurrency (CI 16 warm HTTP + 8 SSE; soak 8 HTTP + 32 SSE), provided a CI load receipt cannot be read as 32-connection or 10-minute evidence.",
      "kind": "product"
    },
    {
      "quote": "The 150 ms / 4000 ms figures are **regression gates for this mocked path**, not production SLOs (telemetry-slos is a later program item).",
      "source": "architect",
      "why": "[PM-C03] I agree they are not production SLOs. I do not agree they are already the locked v1 gates. There is no checked-in bench number; 150ms may flake and 4000ms may be vacuous. Replacing the withdrawn 2.0s blended bucket with uncalibrated figures would be the silent raise this slice forbids. Numeric thresholds are a product lock the brief asked the council to set.",
      "proposal": "Owner locks four harness p95 gates (warm HTTP, cold HTTP, SSE time-to-first-byte, SSE emit after inject) as numbered thresholds, not SLOs. Treat 150 / 4000 / 200 / 500 ms as the candidates. Retune only as a numbered change after a real CI calibration, never inside the driver. Unexpected-error = 0, expected overflow refusals excluded, and zero outbound vendor I/O stay.",
      "kind": "product"
    },
    {
      "quote": "Closed **profile** (`ci` | `soak`) and **scenario** inventory actually executed vs configured-not-run",
      "source": "architect",
      "why": "[PM-C04] Collapsing the command name and the evidence class into `ci` makes a local pre-push load read as CI evidence. A CI run is not a soak (agreed). A local load is not a CI measurement. UX already split Command {load|soak} from Evidence {local|ci}; that split is the honest vocabulary.",
      "proposal": "Closed command vocabulary is load | soak. Closed evidence class is local | ci. Merge CI invokes load. A local load prints Command: load and Evidence: local. Soak remains a distinct command whose receipt cannot say Command: load, and a load receipt cannot say Command: soak.",
      "kind": "technical"
    },
    {
      "quote": "Optional **byte-identity check** that a warm HTTP bundle's score triple equals the snapshot produced by `compute_analytics_from_vendor` on the same book is a **no-fork proof**, not a lab verdict.",
      "source": "architect",
      "why": "[PM-C05] Score / tier / fingerprint must not be capacity thresholds (agreed). Making the no-fork proof optional leaves additive-keeps-score-byte-identical as an unobservable hope. After this feature ships, same market inputs must still produce byte-identical score, tier, and fingerprint; that is ship-blocking isolation, not a lab verdict.",
      "proposal": "Keep score / tier / fingerprint out of p95 and error locks. Require an observable identity proof after a successful load and a successful soak (same inputs, byte-identical score / tier / fingerprint). An empty scoring-engine diff is necessary and not sufficient by itself.",
      "kind": "technical"
    },
    {
      "quote": "Run completed; vendor I/O vouched in-process; all three locks held; ≥1 request actually driven",
      "source": "ux",
      "why": "[PM-C06] If pass means one capacity-refusal rate upper bound on the same run as the overflow probe, expected 503s either fail a 0 lock or hide inside a non-zero lock. BRIEF's p95 / error / refusal are three concerns, not one blended refusal rate. Expected overflow refusals are refusals, not unexpected errors; a probe that records zero such refusals is vacuous, not a green low rate.",
      "proposal": "Happy-path locks are per-scenario harness p95, unexpected-error = 0, and unexpected stream-hold drop = 0. The overflow probe is a separate check: every overflow attempt must be a capacity refusal with 30-second retry guidance, excluded from unexpected-error; zero such refusals fail as vacuous. Print `ok`, `capacity refusal`, `rate-limit refusal`, `unexpected error`, and `client timeout` as separate classes. Standing stays first; FAIL names which lock or which probe check tripped.",
      "kind": "technical"
    },
    {
      "quote": "With the public request budget enabled at a low cap, excess requests are refused as request-budget refusals (the limiter still exists; harness-local disable did not delete it).",
      "source": "pm",
      "why": "[PM-C07] I withdraw the required low-cap limiter probe. The brief already documents the load-test disable. Production 120 stays untouched; the harness process may turn the limiter off; a 429 while this process limiter is 0 is already a blocked/harness error. That is a stronger anti-deletion check than adding a fourth scenario the closed set does not need.",
      "proposal": "Drop the required low-cap limiter probe from this slice. Keep production public request budget 120 unchanged; harness-local 0 framed as this process only; a 429 while the process limiter is 0 is blocked, not a pass; subscriber-ceiling vs session-ceiling vs rate-limit refusal remain distinct class names on the receipt (rate-limit count 0 when limiter off, never a blank empty).",
      "kind": "product"
    }
  ],
  "asks": [
    "[PM-A01] Architect: after a successful 10-minute soak, will the same harness process still serve one ticker-analysis request before teardown, so post-soak liveness is observable and not only a zero subscriber count after shutdown?",
    "[PM-A02] Architect: will GATE Q invoke the soak command once as evidence even though merge CI does not?",
    "[PM-A03] Architect: what printable latency basis will each scenario's harness p95 carry (cold HTTP vs warm HTTP vs SSE time-to-first-byte vs emit after inject) so the receipt can name the clock without inventing it?",
    "[PM-A04] Architect: when the fixture arm is not engaged, does ordinary ticker analysis stay behavior-identical for traders, including score / tier / fingerprint?",
    "[PM-A05] Architect: does the session-overflow probe keep many live clients on one ticker admitted under the subscriber ceiling as a positive control, distinct from refusing a new ticker past the session ceiling?",
    "[PM-A06] UX: can the standing block print one harness-p95 line per executed scenario (basis, observed, lock) instead of a single p95_lock, and still keep standing first on every finished run including FAIL / BLOCKED / INCOMPLETE?",
    "[PM-A07] UX: if the harness gives up waiting, is that a non-zero threshold or unexpected-error failure (distinct `client timeout` class on the receipt) rather than a PASS with timeouts parked off the error lock?"
  ]
}
```
