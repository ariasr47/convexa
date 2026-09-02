# capacity-baseline — R3 decisions

Source: `council/conflicts.json` (18 conflicts, 6 self-revisions, quotes 18/18).

## Self-revisions (folded; no exchange)

1. **Architect withdraws profile name `ci` as the operator-facing command.** Commands are `load` and `soak`. Evidence class is a second axis: `local` | `ci`. Merge CI invokes `load` only. Soak is local + GATE Q, not the default backend CI job. (`2254ef16`, architect self-revision; aligns with PM-C04 and UX product conflict on the same quote.)
2. **PM withdraws the single 2.0s ticker-analysis p95 bucket.** Latency locks split by scenario (cold HTTP, warm HTTP, SSE TTFB, SSE emit). Unexpected-error = 0 and unexpected stream-hold drops = 0 still stand. (`c2a867d4`)
3. **PM withdraws 60s / 8+16 as sacred load identity.** Accepts a CI-bounded load wall (20s HTTP + 5s SSE hold + refusal probe, total under 60s) and per-profile concurrency (CI load 16 warm HTTP + 8 SSE; soak 8 HTTP + 32 SSE). Soak remains 10 minutes local + GATE Q. Receipt records duration and concurrency actually used; a load receipt cannot claim soak evidence. (`ea8b01f5`; settles architect/UX product conflicts on the original 8+16/60s sentence.)
4. **PM withdraws the required low-cap public-limiter probe.** Production 120 unchanged; harness process may set limiter 0; a 429 while process limiter is 0 is blocked. Subscriber vs session vs rate-limit remain distinct class names (rate-limit count 0 when limiter off, never blank). (`58d5355a`)
5. **UX withdraws one `capacity refusal` bucket for every 503.** Receipt classes distinguish subscriber-ceiling vs session-ceiling (plus rate-limit, unexpected error, unexpected stream drop, client timeout). (`c11c1ced`)
6. **UX withdraws a capacity-refusal *rate* upper bound.** Expected probe 503s are not printed as a rate the run stayed under. (`d7cd1197`)

## Technical exchanges (converged)

7. **Score/tier/fingerprint identity is required after a successful load and a successful soak** (`c40411fb`). Isolation predicate, not a p95/error lock. Same-process Path-B on the golden book is the oracle; skip is a fail. Empty `quant-engine` diff is necessary and not sufficient. Architect withdrew “optional no-fork proof.”
8. **Vacuous/blocked/incomplete/start-error runs emit a short non-measurement record** (standing + verdict + “No pass recorded”, no observed-p95 table). Pass and threshold-fail get the full measurement receipt. (`22e1a7fa`)
9. **AC-1/2 command naming stays review; NO_UI_CHANGE / no trader route / no new dashboard strings is test.** Standing-block cadence stays review. (`4a91fff`)
10. **Refusal is two phase-separated checks, not a rate** (`b4adaac8`). Hold under ceiling: subscriber- and session-ceiling counts 0. Overflow: every attempt is 503 + Retry-After 30 (all-admit is vacuous fail). Probe 503s stay out of unexpected-error. Standing prints first on stdout and in the receipt file; stderr is progress (`[RUNNING]`) unless stdout is JSON.

## Product — owner ruling

11. **D1 — four harness p95 fail-lines (owner A, 2026-08-28).** Warm HTTP **150 ms**, cold HTTP **4000 ms**, SSE time-to-first-byte **200 ms**, SSE emit after inject **500 ms**. These are regression gates for this mocked path, not production SLOs. Retune only as a numbered amendment after a real CI calibration; never silent auto-tune inside the driver. Unexpected-error = 0 and unexpected stream-hold drops = 0 still fail the command. (`16b124f2`)
12. **D2 — load subscriber ceiling (owner A, 2026-08-28, S2 pass 2).** Load LiveCapacity max subscribers is **9**, not 8, so 8 per-ticker SSE clients plus one prices-SSE client can hold concurrently without tripping the under-ceiling refusal check. Still far below production 500. Soak hold stays 32 SSE under production 500/50; overflow remains a dedicated nested LiveCapacity, not a 501st connection.
13. **D3 — harness stream hub (owner A, 2026-08-28, S2 pass 2).** The harness still drives production HTTP stream routes (`/api/stream/{ticker}` and `/api/stream/prices`) on the throwaway loopback process. That process injects a **harness-only hub** whose `subscribe` updates the symbol set for session-ceiling accounting and **does not enqueue vendor `HubCmd`**. Production `StockStreamHub::subscribe` / `admit_and_subscribe` on the live server stay unchanged. Structural poison: with worker off, admitting many times must not grow a vendor-subscribe command queue. Do not drive streams only via an in-process shortcut that skips HTTP.
14. **D4 — merge CI load profile (owner B, 2026-08-28, post GATE Q).** Hold ship. Merge CI `capacity load` must run **`--release`** with **`APP_ENV=dev`** (not debug `cargo run`, not unset APP_ENV which trips production startup refusal). D1 150 ms warm lock is not retuned. Soak stays off the default backend job.
