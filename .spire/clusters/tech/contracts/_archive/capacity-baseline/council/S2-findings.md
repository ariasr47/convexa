# S2 — skeptic findings: capacity-baseline

## §0

- **Produced:** `.spire/clusters/tech/contracts/capacity-baseline/council/S2-findings.md` (fresh pass after owner D2/D3)
- **Decided:** **Critical count = 0.** Pass-2 Criticals are closed in the current SPEC body. No loop to R4 on those defects.
- **Carry forward:** D2 (load max subscribers **9**; 8 per-ticker + 1 prices at ceiling) and D3 (harness-only hub; production `subscribe` / `admit_and_subscribe` unchanged on the live server; HTTP stream routes still driven; HubCmd queue must not grow) are folded through §1–§9, INTERFACE, and ACs. Prior pass-2 Importants on second-bind overflow, standing `client timeout = 0`, identity HTTP **triple**, and stream-hold class literal are also closed.
- **Unresolved (non-blocking):** UX `conflict_id` stamp↔`conflicts.json` mismatch; harness-only hub injection shape vs typed `StockStreamHub`; load session-ceiling **4** vs unbound per-ticker symbol cardinality. §9 “None” is consistent with Critical count 0.

Method: re-checked pass-2 Criticals against D2/D3 + current SPEC/INTERFACE; walked every R2 conflict by proposal substance; spot-checked `try_admit` (`*n >= max_subscribers`), both SSE routes → `admit_sse` → `admit_and_subscribe`, and `StockStreamHub::subscribe` → `HubCmd::Subscribe`; verified `gex_SPY.json` `meta.contract_count: 14218`.

## Critical  (blocks — must loop back to R4)

- None.

## Important  (should fix)

- **`conflicts.json` UX `conflict_id`s still do not match the SPEC folding-receipt stamps.** Body substance folds all seven R2-ux proposals, but the receipt lists rehashed UX ids (`c404b05a…`, `91aac0cc…`, `23e408e6…`, `32fe2b7f…`, `0cf0d9c2…`, `ecb3ec94…`, `f983ceea…`) while `council/conflicts.json` still carries `1deb45cc…`, `c0cdf890…`, `5f58b486…`, `22e1a7fa…`, `4a91fffd…`, `c11c1ced…`, `d7cd1197…`. A stamp↔registry audit will false-report seven drops. — evidence: SPEC.md §9 folding receipt UX rows; `council/conflicts.json` UX entries; `council/R2-ux.md` conflicts array.

- **Harness-only hub injection shape is outcome-clear but seam-underspecified against today’s typed `StockStreamHub`.** D3 correctly closes the pass-2 contradiction (HTTP routes + no HubCmd growth + live-server subscribe unchanged). Current code still types `admit_and_subscribe(&StockStreamHub)` and `StockStreamHub::subscribe` always `send`s `HubCmd::Subscribe`. SPEC does not pin whether `for_capacity_harness` may add a construction-time no-enqueue mode on that type, introduce a parallel hub behind AppState, or otherwise keep the live path byte-identical. Two builders can “satisfy” D3 by editing the shared `subscribe` body in a way that risks live behavior. Pin the allowed seam (and keep the HubCmd queue poison). — evidence: decisions.md D3; SPEC.md §2 Component boundaries “Harness-only hub” + mock boundary item 4 + Structural HubCmd row; `apps/api/src/services/live_capacity.rs` `admit_and_subscribe`; `apps/api/src/infrastructure/massive/ws.rs` `subscribe` → `HubCmd::Subscribe`.

- **Load hold sets session ceiling 4 without binding how many distinct symbols the 8 per-ticker SSE clients open.** Hold-phase session-ceiling refusals must be 0 (AC-24) while prices may touch a closed 1–2 symbol list. Eight per-ticker clients on eight distinct tickers would trip session ceiling 4 and fail the locked load profile; same-symbol (or ≤4 distinct including prices) is the only satisfying shape, but SPEC never says so for the per-ticker hold (HTTP same-symbol is stated; SSE is not). — evidence: SPEC.md §2 commands table load LiveCapacity **9 / 4**; SPEC.md AC-24; SPEC.md §2 Surfaces per-ticker SSE vs prices “closed 1–2 symbol list”; `live_capacity.rs` session check on `new_symbol_count`.

## Minor / advisory

- `INTERFACE_CONTRACT.md` banner `NO_BACKEND_CHANGE` is qualified to production HTTP / FE↔BE only and correctly admits harness seams — still easy to misread on a lane skim. — evidence: INTERFACE_CONTRACT.md lines 8–10.

- Fixture-Some refuse remains `APP_ENV=prod` only; a non-prod hosted construct could still engage the arm. — evidence: SPEC.md §2 mock boundary item 2.

- `decisions.md` technical exchange #10 still says “Hold **under** ceiling” while D2/SPEC load hold is **at** ceiling 9 (9 admits succeed; refusals still 0). Wording drift in the decision log only. — evidence: decisions.md item 10; SPEC.md §2 load LiveCapacity cell; decisions.md D2.

## Checked and clean

- **Dropped conflicts (substance):** All R2-architect (4), R2-pm (7), and R2-ux (7) proposals are present in SPEC body (load≠soak + local|ci; D1 150/4000/200/500 + prices bases; two refusal checks not a rate; subscriber vs session classes; short non-measurement; identity required with oracle→HTTP triple+Path-B; 429 probe withdrawn; AC-1/2 review vs NO_UI test; no blended ticker-analysis p95; load 16 HTTP + 8 per-ticker SSE + 1 prices / soak 8+32). None relegated only to §9. UX id rehash is registry drift, not a silent omission.

- **Pass-2 Critical #1 closed (D2):** Load LiveCapacity max subscribers is **9**; concurrent hold is **8 per-ticker SSE + 1 prices SSE = 9 at ceiling**; `try_admit` `>= max` means 9 admits succeed; a 10th on that holder is not the overflow probe. Matches AC-5 / AC-21 / AC-24 / AC-41 / INTERFACE load hold line. Spot-check: `live_capacity.rs` `*n >= self.max_subscribers`; both `stream_ticker_http` / `stream_prices_http` call `admit_sse`.

- **Pass-2 Critical #2 closed (D3):** Harness drives production HTTP stream routes on loopback; throwaway process injects harness-only hub (`subscribe` updates symbol set, does **not** enqueue `HubCmd`); production `StockStreamHub::subscribe` / `admit_and_subscribe` on the live server stay unchanged; structural poison requires vendor-subscribe queue does not grow with worker off; in-process HTTP-skipping shortcut rejected. Old “production subscribe is not the admit path” phrasing is gone. Remaining Important is injection-seam clarity, not the prior contradiction.

- **Pass-2 Importants closed:** Overflow is HTTP on a **second** `127.0.0.1:0` bind of `routes::router(probe state)`; standing Thresholds and `[PASS]` include `client timeout = 0`; §2 identity scopes post-work HTTP to the score/tier/fingerprint **triple**; outcome class literal is `unexpected stream-hold drops` everywhere that matters.

- **Unobservable ACs:** AC-1–49 remain externally checkable via command listing, exit, receipt/stdout, OpenAPI/dashboard empty-diff, named identity fields, or `ticker_analysis_request_tickers`. No new ship-gate AC is source-only.

- **Component states:** §4 trader UI N/A under `NO_UI_CHANGE`; operator run states cover pass / RUNNING / vacuous / partial-surface / FAIL·BLOCKED·INCOMPLETE·ERROR / NOT RUN soak, including blocked standing without `MOCKED VENDORS`.

- **Interface mismatch (HTTP):** INTERFACE `endpoints: []` matches SPEC §1/§6 no new HTTP operations and §2 reuse of existing ticker/SSE routes on throwaway binds. No dashboard field consumes an unpromised wire field.

- **Internal contradiction (remainder):** Load ceiling-9 vs 8+1 prices, second-bind overflow vs hold instance, Evidence `ci` vs ambient `CI`, identity triple vs full envelope, and HubCmd live-vs-harness framing are internally consistent after D2/D3. No section pair reopens the pass-2 Criticals.

- **Guardrails:** `[operator-vs-trader-path-separation]`, `[no-secrets-in-image]`, `[single-ticker-on-demand]` narrowed form, `[absent-is-not-none]` (including load at ceiling 9 is not “under”), `[additive-keeps-score-byte-identical]` identity shape, `[cited-code-is-verified-not-assumed]` (`try_admit` / enqueue-on-live-subscribe / no ceiling setter), and `[structural-over-prose-enforcement]` (HubCmd poison, second-bind overflow poison) hold. Empty quant-engine diff still required.
