# tradeable-rec-inputs — QA report (GATE Q)

**Verifier:** QA / Verification engineer — fresh session, not a builder.
**Date:** 2026-08-12 (pass 1) · 2026-08-12 re-run part 1 (§9)
**Spec:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/SPEC.md` §3 (100 criteria, 13 ship-blocking)
**Interface:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md`
**QA receipt:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/conformance-receipt-qa.json`

> **CURRENT STATE — GATE Q is CLOSED and GREEN.** All 100 acceptance criteria PASS. Pass 1 found
> 7 failures; six were fixed by the Frontend lane and **re-verified PASS by fresh observation**
> (§9), and the seventh, **AC-89**, was closed by a recorded **owner ruling dated 2026-08-13**
> after I verified the before/after artifact was real and unfabricated (§10). The final verdict is
> §11. Sections 5 and 9–10 preserve the full audit trail, including what the owner ruling narrowed.

---

## 0. How this was observed

| Thing | What I actually ran |
|---|---|
| Backend | `HTTP_BIND=0.0.0.0:8010 npx nx serve api` — my own child process (pass 1 PID 50324; re-run a fresh instance). **Never `:8000` for the build under test.** Live `MASSIVE_API_KEY`, JSON stores. |
| `:8000` | `npm run ports:free` reported it **clear** at both session starts (the orphan named in the task is gone). To let the dashboard's hard-coded Vite proxy target reach *my* build, I ran a QA-only transparent TCP forwarder `127.0.0.1:8000 → 127.0.0.1:8010` (scratchpad `fwd.mjs`). Everything the browser saw is provably the `:8010` build. No product file was touched by it. |
| Frontend | `npx nx serve @convexa/dashboard` — pass 1 on **:4201** (a stale Vite held :4200); re-run on **:4200** with a **fresh** instance (PID 84932, created 20:29:43, ~1 min before use). Browser: Playwright 1.62.1 / Chromium, `localhost:`. |
| Browser observation | Pass 1: 9 scripted Playwright passes. Re-run: 3 further passes covering all six fixed items, both arms of each, plus regression spot-checks. |
| Clean-tree baseline | `git worktree add … HEAD --detach` + `node_modules` junction, to settle the "pre-existing failure" claim by **running the specs on an unmodified tree** rather than trusting the claim. |

---

## 1. Independent interface conformance

I did **not** trust `conformance-receipt.json`. Re-run against my own server:

```
node .claude/tools/gates.mjs interface_conformance \
  --contract .spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md \
  --url http://localhost:8010 \
  --auth-cookie gf_session=<obtained via POST /api/auth/signup on my server> \
  --report .spire/clusters/tech/contracts/tradeable-rec-inputs/conformance-receipt-qa.json
```

**Exit 0.** `"verdict": "PASS"`, 4/4 endpoints.

| Endpoint | Builder receipt | **My receipt (authoritative)** | Fields |
|---|---|---|---|
| `GET /api/ticker/{ticker}` | PASS | **PASS** | 23 |
| `GET /api/candidates/{ticker}` | PASS | **PASS** | 50 |
| `GET /api/recommendation/export/{ticker}` | PASS | **PASS** | 19 |
| `GET /api/auth/settings` (auth) | PASS | **PASS** | 12 |

**Comparison: identical.** No builder-PASS / QA-FAIL divergence. A builder receipt exists (no missing-receipt bounce). Conformance is **PASS**.

**Re-run part 1 — not re-executed, and why.** Every fix in the re-run pass is frontend render-only. I verified no wire could have moved: `find apps/api/src libs/quant-engine/src libs/api/src -newermt "2026-08-12 20:10"` returns **nothing** — the backend and the shared client lib are untouched since my pass-1 receipt. I additionally re-read the live wire (`GET /api/candidates/SPY` → `as_of`, `session_basis: after_close`, `expirations_omitted_by_cap: 29`, `by_reason.strike_cap: 719`, `included + omitted = 14314`) and confirmed the fields the fixes now render were already present and unchanged. The pass-1 receipt therefore stands.

---

## 2. Suites (judged by exit code, never by printed summaries)

| Command | Exit | Result |
|---|---|---|
| `cargo test -p api-rust -p quant-engine` | **0** | 212 lib + 6 main + 5 `candidate_isolation` + 5 `research_isolation` + 2 `score_identity` + 83 quant-engine + 13 (golden/scalar_gex/signals) — all `test result: ok` |
| `npx nx test @convexa/api` (shared lib — touched) | **0** | 19 passed |
| `npx nx typecheck @convexa/dashboard --skip-nx-cache` | **0** | (cache bypassed — the first `npm run typecheck` was a 2/2 cache hit and proved nothing) |
| `npx nx typecheck @convexa/api --skip-nx-cache` | **0** | |
| `npx nx e2e dashboard-e2e -- --grep "tradeable-rec-inputs"` | **0** | 4 passed (393px rec panel + Settings panel, dark + light), with the shipped vacuity guards |
| `npx nx test @convexa/dashboard --skip-nx-cache` (pass 1) | **1** | **5 files failed / 142 passed; 5 tests failed / 1621 passed** |
| `npx nx test @convexa/dashboard --skip-nx-cache` (re-run) | **1** | **5 files failed / 142 passed; 5 tests failed / 1639 passed** — see §9.7 |

### 2.1 The dashboard suite — the "pre-existing" claim, verified not inherited

The builders claimed 5 pre-existing failures on a clean tree. I ran the same 5 specs in a **clean `HEAD` worktree**:

| Spec | Baseline (clean HEAD) | Feature tree (pass 1) | Verdict on the claim |
|---|---|---|---|
| `shared/theme/stage3-amber.spec.ts` | FAIL — `TradeEntryDialog.tsx: must resolve via extrasFor(` | same assertion | **Pre-existing** (the file is a re-export barrel; not in this feature's diff) |
| `trading/broker/grouping.integration.spec.tsx` | FAIL — `/api/book: expected false to be true` | same assertion | **Pre-existing** |
| `trading/positions/positions.risk.spec.tsx` | FAIL — `:698 nonAuth.every(u => u.includes('/api/contract/'))` | same assertion (`:709`) | **Pre-existing** |
| `trading/positions/readonly.spec.tsx` | FAIL — `:334` url allow-list | same assertion (`:334`) | **Pre-existing** |
| `trading/orders/orders.risk.spec.tsx` | FAIL at **`:485`** (network allow-list). Execution **reached** `:485`, so `:421 expect(o.qty).toBe(2)` **passed on the clean tree** | FAILED **earlier**, at **`:432 expect(o.qty).toBe(2)`** — `expected 1 to be 2` | **NOT "flaky pre-existing" — a NEW, deterministic assertion break introduced by this feature** — *corrected in the re-run; see §9.7* |

The pass-1 orders break was causally this feature's: `prefill.ts::parseQty` was **deleted** and `qty` removed from `AiPrefill` (correct per AC-79 / SPEC §1 / PLAN reconciliation), so the dialog now opens at its own default `1`, while the spec line still asserted `2`.

---

## 3. Binding invariants (BRIEF "Invariant watch" + OPEN_THREADS §9 promoted canon)

| Invariant | Verdict | Evidence I produced |
|---|---|---|
| `[additive-keeps-score-byte-identical]` (**HARD**) | **HOLDS** | I re-proved the triple myself: `cargo test -p api-rust --test score_identity -- --nocapture` → exit 0, printed `dark_pool=true -> score=8 tier=dormant fingerprint=ad81df2ba2c3` and `dark_pool=false -> score=8 tier=dormant fingerprint=ad81df2ba2c3` — byte-identical to the V0 pin on **both** branches. Structural corroboration: `libs/quant-engine/src/{signals,gate}.rs` are **untouched**; `quant-engine` changes are `lib.rs` (module registration) + `types.rs` (two new standalone structs); `routes/market.rs` gains exactly one additive `json!` member emitted **after** `generate_signals`; `market_state_from_gex`/`generate_signals` argument lists are unchanged. Unaffected by the re-run (backend untouched). |
| Poison non-vacuity for the above | **HOLDS** | `poison_adding_a_move_derived_value_to_the_scoring_inputs_changes_the_fingerprint` passes (real `assert_ne!` across two differing `market_state_from_gex` calls). |
| `[best-effort-isolated-or-null]` | **HOLDS** | `market_state.straddle_move` is always an object with a closed `state` (observed `ok`); `GET /api/candidates/SPY` with an impossible window → **200** `state: none_in_band`, page unaffected; `GET /api/candidates/ZZZZNOTATICKER` → 404 (the `/api/contract` carve-out only). |
| `[digested-labels-not-raw-dump]` | **HOLDS** | No candidate datum on the bundle (`candidate`/`quote_presence`/`iv_state`/`band_pct`/`sent_to_model` all absent from `GET /api/ticker/SPY`) and none on SSE (12 s capture of `GET /api/stream/SPY`). Surfaces render one digested line, no chain table — still true after the re-run's added clauses, which are counts, not rows. |
| `[live-vs-static-isolation]` | **HOLDS** | Browser `setOffline(true)` for 9 s: straddle widget stayed mounted, `opacity` **0.96 before and after**, no offline chip on it, while the page's live tiles degraded. |
| `[absent-is-not-none]` | **HOLDS** (pass-1 partial now closed) | Wire: `not_set` vs `not_derivable(percent_without_account_size)` vs `derived` all observed distinct; `none_in_band` vs `unavailable` distinct; `none_open`/`not_sent`/`unavailable` distinct. The pass-1 exception — a `no_trade` card rendering *nothing* where the closed `—` member belonged — is **closed in the re-run** (§9.5): the four fields now render `—` as a named member. |
| `[server-side-gate-enforcement]` | **HOLDS** | `PUT /api/auth/settings` with **no** cookie → `401 auth_required`, nothing stored; forged cookie → `401`; `GET` anonymous → `401`. |
| `[model-read-carries-its-assumptions]` | **HOLDS** | Straddle basis + advisory lines render in body, un-hovered (§4 verbatim). Strengthened by the re-run: the candidate set now also carries its own as-of + session basis in body (§9.2). |
| `[no-real-order-path]` | **HOLDS** | Panel shows `SIMULATED / advisory`; the diff adds no order/broker/execution surface; `useOrders.ts` gains only a `riskBlockPresent: null` pass-through. |
| `[loss-free-durable-migration]` (server analogue) | **HOLDS** | `services::auth::store::tests::a_corrupt_settings_blob_degrades_to_defaults_without_overwriting_the_original` + `an_old_settings_record_without_risk_fields_reads_forward_unchanged`, both green. |
| `structural-over-prose-enforcement` | **HOLDS** (pass-1 exception now closed) | Poison arms present and green: `candidates::tests::raising_a_ceiling_in_a_test_build_makes_the_guard_fail`, `straddle_move::tests::widening_the_restriction_makes_the_subset_assertion_fail`, `candidate_isolation::the_guard_bites`, `boundaries.spec.ts` "the guard BITES — a poisoned literal is detected". The pass-1 exception — AC-70's guard named for a behaviour it never asserted — is **closed**: the rewritten guard asserts the positive and I **poison-proved it red myself** (§9.5). |

---

## 4. Criteria-independent Critical sweep (auth · authz · cross-tenant · secrets · destructive data)

Run independently of every named AC, on the changed code and against the live server. **No Critical finding.** Nothing in the re-run pass touches an auth, tenancy or persistence path (frontend render-only), so the sweep stands.

| Probe | Result |
|---|---|
| `PUT /api/auth/settings` without a session | `401 auth_required` — nothing stored (client check bypassed at the wire) |
| `GET /api/auth/settings` anonymous | `401` |
| Forged/garbage `gf_session` | `401` |
| Cross-tenant read: account B's cookie against account A's stored block (A = `$50,000 / 1%`) | B sees `state: not_set` — **no leakage** |
| Cross-tenant export: `GET /api/recommendation/export/SPY` under A vs B | A → own block; B → `not_set`. No cross-read |
| Anonymous export | `risk_inputs.state: "not_set"`, `account_size: null` — never another user's figures |
| Operator/diagnostic surfaces (`/api/health`, `/api/_metrics`) | `account_size` / `risk_inputs` / `per_trade_cap` **absent** |
| Log leakage of the owner's figures | No `info!/warn!/error!` in `auth/risk.rs`, `auth/store.rs`, `routes/auth.rs` carries an account/cap **value** |
| Persisted server state after a rec carrying a positions digest | `data/auth.json` contains 0 occurrences of `open_positions` / `capital_at_risk` / `none_open` / `digest` — the digest is response-only |
| Unset encoded as `0`? | Stored as `risk_account_size: null` / `risk_cap_value: null`; `0` refused at the server (`422`) |
| New anonymous spend surface | 5 consecutive `GET /api/candidates/SPY` reads → **0** new vendor-fetch log lines |
| *(re-run)* Superseded-strip change detector | `riskInputsSignature` is a **local, pure** signature over two owner-entered scalars — no network round-trip, no raw-value comparison rendered, and `riskInputsSuperseded` returns `false` when either side is unknown, so an anonymous or still-loading client can never be told its inputs were superseded |

---

## 5. Acceptance criteria — verbatim, in order

Legend: **PASS** = observed to hold · **FAIL** = observed not to hold · **UNVERIFIABLE** = could not exercise.
"HOW" records the risk-based method (`test:<name>` or `review`/`observed`), per `spire-tech-risk-based-verify`.
Rows marked **PASS (re-run)** were FAIL in pass 1 and are flipped on fresh evidence recorded in §9.

| # | Acceptance criterion (verbatim) | Verdict | Evidence / HOW |
|---|---|---|---|
| AC-1 | Loading and polling the ticker page with no deliberate action renders no candidate contract rows and issues no candidate assembly; the set is assembled only when a rec is requested or the hand-off export is opened. | PASS | **Observed:** full ticker-page load + poll cycle in Chromium — request log shows `session, ticker, scan/history, scan/universe, personas, recommendation/status, stream` and **no `/api/candidates`**; no candidate rows in the DOM. Opening `View what's sent` fired `GET /api/recommendation/export/SPY`; the rec POST returned `sent.candidates`. test: `candidate_isolation::no_bundle_path_module_references_the_candidates_module` |
| AC-2 | No expiration outside the active DTE/expiration window appears in the candidate set at any window setting, and narrowing the window never adds an expiration to the set. | PASS | **Observed** on `/api/candidates/SPY` at 4 windows: `max_dte=200` and `=30` → `[08-20,08-21,08-24,08-25]`; `=9` and `=8` → `[08-20,08-21]` — strictly a subset, never an addition. test: `candidates::tests::drop_reasons_are_evaluated_in_fixed_order_and_each_row_counted_once` |
| AC-3 | When the active window holds more expirations than the tenor cap, the surface names how many expirations were included and how many were omitted by the cap, and the same disclosure names how many strikes were dropped and why. | **PASS (re-run)** | **Freshly observed against REAL server data**, drawer `Candidate contracts` section: `60 contracts across 4 expirations · 14254 omitted (outside_window) · 29 expirations omitted by the cap · 719 strikes dropped (strike cap)` — the two cap clauses now render and match the wire exactly (`expirations_omitted_by_cap: 29`, `by_reason.strike_cap: 719`). Both arms covered: test: `StateExportDrawer.spec.tsx` "AC-3 — when the tenor cap actually bound, names expirations omitted BY THE CAP and strikes dropped and why" **and** "AC-3 — a tenor cap that never bound adds no extra clause". *(Pass 1: FAIL — `expirations_omitted_by_cap` had zero production consumers.)* |
| AC-4 | Every omitted-contract count arrives on the wire under one of five closed drop reasons (outside window, outside band, no interest, expiration cap, strike cap); no surface derives an omitted count by subtracting two numbers, and zero omissions render `none omitted` rather than an absent clause. | PASS | **Observed** wire: `by_reason {outside_window:724, outside_band:6296, no_interest:988, expiration_cap:5527, strike_cap:719}`, summing exactly to `omitted.total: 14254`. `liquidityLine`/`candidatesLine` read the wire counts — no subtraction, including the re-run's new clauses. test: `literals.spec.ts` "zero omissions render `none omitted`, never an absent clause" + "…from the wire counts only" |
| AC-5 | Included contracts plus the sum of all drop-reason counts equals the number of chain rows scanned. | PASS | **Observed live, 7 times across both passes:** `included 60 + omitted 14254 = 14314` = `market_state.contract_count` **14314**; prompt budget `20 + 14294 = 14314`; identical at every DTE window incl. the empty one (`0 + 14314`); re-run wire re-check `= 14314`. test: `candidates::tests::included_plus_dropped_equals_rows_scanned` |
| AC-6 | The dedicated/hand-off set never exceeds 4 expirations x 2 rights x 8 strikes (64 records) and the prompt block never exceeds 2 x 2 x 5 (20 records); both also honour a serialized-byte ceiling and whichever ceiling binds first wins. Raising a ceiling in a test build makes the guard test fail. | PASS | **Observed:** handoff → 4 expirations, per-(tenor,right) groups `{8,8,8,8,7,7,7,7}`, **60** records at **23 342 bytes** ≤ `max_bytes 24000` — i.e. the **byte** ceiling bound first, below the 64 record cap, exactly as specified. Prompt → 2 expirations, **20** records, **7 812** ≤ 8 000. test: `candidates::tests::record_and_byte_ceilings_bind_and_whichever_binds_first_wins` + poison `raising_a_ceiling_in_a_test_build_makes_the_guard_fail` |
| AC-7 | A ticker whose chain holds no contracts inside the band reports *none in band* (checked, empty); an assembly failure reports *unavailable this cycle*. The two are distinguishable, neither produces an error page, and the rest of the ticker page keeps rendering. **(ship-blocking)** | PASS | **Observed:** `GET /api/candidates/SPY?min_dte=9000&max_dte=9001` → **200** `state:"none_in_band"`, 0 included, sum invariant intact, `as_of`/`session_basis` still carried. `ZZZZNOTATICKER` → 404 only. Distinct literals `No candidates in band this cycle.` vs `Candidate set unavailable this cycle.` test: `literals.spec.ts` "a checked-empty band renders the empty literal, distinct from unavailable" |
| AC-8 | Any surface rendering a candidate-derived number displays, without hovering or expanding anything, the candidate set's as-of and whether the set is live-session or prior-close. | **PASS (re-run)** | **Freshly observed, un-hovered, on both card types:** `Candidates as of 2026-08-13T02:30:00Z · prior close` (testid `numbers-said-freshness`), and the cited line now interpolates it — `772 C 2026-08-20 · bid 5.02 / ask 5.3 · Δ 0.534 · IV 10% · from the 2026-08-13T02:30:00Z chain snapshot`. Literal `{as_of}` rendered anywhere: **false**. Session mapping verified `rth → live session`, `after_close`/`closed_pre` → `prior close`. test: `literals.spec.ts` "names the as-of and a live-session/prior-close label", "maps `rth` to live session and `after_close`/`closed_pre` to prior close", "degrades to null (never a lie) when the set carries no as-of", "interpolates the passed as-of into the quoted-arm fact line, never a bare \"chain snapshot\"", "a missing as-of degrades to an honest \"unknown\" token, never a fabricated date"; `ai-rec.risk.spec.tsx:967`. *(Pass 1: FAIL — neither half rendered anywhere.)* |
| AC-9 | A cited contract's quote presence renders from a stated state — *quoted in this snapshot* or *no two-sided quote in this snapshot* — and never leaves the reader to infer it from a blank field. | PASS | Closed lookup on `quote_presence`; **observed** quoted arm rendering real bid/ask (never blank); no-quote arm renders the exact literal `no two-sided quote in this snapshot` (`copy.ts:218`). test: `literals.spec.ts` "a no-two-sided-quote cited contract states the presence reason, never a blank field" + "a quoted cited contract carries its strike/right/expiration" |
| AC-10 | Outside market hours, no individual candidate quote carries a live-session label, a per-quote timestamp or a per-quote age anywhere in v1; the only freshness claim on any surface is the set-level one. | PASS | review + **observed after hours** (`session_basis: after_close`): all 60 `contracts[]` records carry only `expiration/dte/strike/right/distance_pct/quote_presence/bid/ask/mid/spread_*/oi/volume/iv_state/iv/greeks` — **no timestamp, age or session field**; `quote_age:"unknown"` is set-level only. The re-run's freshness line is likewise **set-level**, rendered once per strip, never per contract — so the "only freshness claim is the set-level one" clause is now positively satisfied rather than vacuously. |
| AC-11 | A contract with no two-sided quote is included in the set carrying that presence state rather than dropped, and no surface or payload asserts that no quote ever existed for it. | PASS | Wire enum is `no_two_sided_quote` (never "no quote"); `liquidity.no_two_sided_quote` counts them as **included**. Live SPY snapshot happened to be 60/60 `quoted`, so the arm was exercised by test: `candidates::tests::a_zero_bid_row_is_included_as_no_two_sided_quote_and_never_claims_no_quote_existed` |
| AC-12 | No candidate ever ships or renders `0.0` as an implied volatility or as a greek; a contract whose greeks were absent carries the unpriced state instead. | PASS | **Observed:** scanned all 60 live records — `any iv==0: false`, `any greek==0: false`; every record `iv_state:"priced"` with a real IV. test: `candidates::tests::a_greeks_absent_row_carries_unpriced_and_ships_no_zero_iv_or_greek` |
| AC-13 | Assembling the candidate set issues no vendor request on any path, and the dedicated read never forces a snapshot refresh. | PASS | **Observed:** 5 consecutive candidate reads → **0** new vendor-fetch lines in the server log. test: `candidate_isolation::the_selector_has_no_vendor_access` + `the_candidates_route_never_forces_a_refresh` (pins `load_analytics(&state, &sym, None, None, false)`, bans `refresh_analytics`) |
| AC-14 | No candidate datum appears on the polled bundle or on the SSE payload, and referencing the candidates module from the bundle path makes the source scan fail. | PASS | **Observed:** bundle JSON — `candidate`/`quote_presence`/`iv_state`/`no_two_sided`/`band_pct`/`sent_to_model`/`omitted` all **absent**; 12 s SSE capture — same, all absent. test: `candidate_isolation::no_bundle_path_module_references_the_candidates_module` (anti-vacuity: asserts all four named files are in the scanned set) + poison `the_guard_bites` |
| AC-15 | A signed-in owner enters an account size and a per-trade cap, saves, reloads the app, and sees the same two values with the same unit. **(ship-blocking)** | PASS | **Observed:** `PUT {account_size:50000, per_trade_cap:{value:1,unit:"percent"}}` → 200; independent `GET` → identical values **with the unit**; persisted to disk as `risk_account_size:50000, risk_cap_value:1, risk_cap_unit:"percent"`. test: `riskInputs.spec.tsx` "enters account size + a per-trade cap, saves, and a fresh mount shows the same two values with the same unit" |
| AC-16 | The `Risk inputs` panel renders a section helper above both inputs in DOM order whose first sentence states the figures are sent to the AI provider with each recommendation request, and which names *not verified*, *not enforced* and *never used to score anything*; both field helpers render as written. | PASS | **Observed in DOM order:** "These figures are sent to your AI provider with each recommendation request. Convexa never checks them against a broker, never enforces them, and never uses them to score anything." → then `Account size` + its helper → then `Max risk per trade` + its helper, both verbatim per SPEC §4. test: `riskInputs.spec.tsx` "the first sentence names the AI-provider egress, and the helper text precedes both inputs in DOM order" |
| AC-17 | The section helper carries a `View what's sent` link to the default ticker's AI recommendation panel, present in the anonymous state as well. | PASS | review + **observed**: present and enabled in the **anonymous** Settings state (`tabIndex 0`, no `disabled`); clicking it navigated to the default ticker's page, where the AI recommendation panel lives. test: `riskInputs.spec.tsx` "carries a \"View what's sent\" link, present in the anonymous state as well" |
| AC-18 | A zero, negative or non-numeric entry is refused locally with a message naming the problem, no network write occurs, and reloading shows the previous values. | PASS | **Observed in the browser:** typed `0` → `Enter a number greater than zero.` rendered, **zero `/api/auth/settings` requests** captured, typed value retained. Server is authoritative too: `{"account_size":0}` → `422 "Enter a number greater than zero."`, likewise `-5` and a `0` usd cap. test: `riskInputs.spec.tsx` "a zero, negative or non-numeric account size is refused locally with a named message; no PUT fires" |
| AC-19 | A cap entered in dollars that exceeds the entered account size is refused with a message naming the problem, and reloading shows the previous values. | PASS | **Observed:** with `account_size 50000` stored, `{"per_trade_cap":{"value":99999,"unit":"usd"}}` → `422 "A dollar cap can't exceed your account size."`; the subsequent `GET` was unchanged. test: `riskInputs.spec.tsx` "a dollar cap exceeding the entered account size is refused, naming the problem; nothing stored" |
| AC-20 | A cap entered as a percent that is not greater than 0 and at most 100 is refused with a message naming the problem. | PASS | **Observed:** `0%` → `422 "Enter a number greater than zero."`; `100.1%` → `422 "Enter a percentage between 0 and 100."`; boundary `100%` → **200** (correct, `(0,100]`). test: `riskInputs.spec.tsx` "a percent cap outside (0,100] is refused, naming the problem"; `auth::risk::tests::a_percent_cap_outside_0_to_100_is_refused` |
| AC-21 | A cap entered as a percent is never refused on account-size grounds at any account size, including none entered, and no refusal message mentions the account size. | PASS | **Observed:** `{"per_trade_cap":{"value":2,"unit":"percent"}}` with `account_size: null` → **200**, stored. No refusal produced, so no message. test: `riskInputs.spec.tsx` "a percent cap is NEVER refused on account-size grounds, at any account size including none"; `auth::risk::tests::a_percent_cap_is_never_refused_on_account_size_grounds` |
| AC-22 | A cap entered in dollars with no account size entered saves, and the effective dollar cap shown equals the figure entered. | PASS | **Observed:** `{account_size:null, per_trade_cap:{value:750,unit:"usd"}}` → 200; `effective_dollar_cap {state:"derived", value:750}` — equals the entered figure. test: `riskInputs.spec.tsx` "a dollar cap with no account size saves, and the effective dollar cap shown equals the figure entered" |
| AC-23 | A cap entered as a percent with no account size entered shows the effective dollar cap as not derivable and names why — *Account size: not set* — never $0, never blank, and never a cap verdict. | PASS | **Observed:** `effective_dollar_cap {state:"not_derivable", value:null, not_derivable_reason:"percent_without_account_size"}` — not `0`, not blank. test: `riskInputs.spec.tsx` "a percent cap with no account size shows \"Account size: not set\" as the not-derivable reason — never $0, never blank" |
| AC-24 | A save attempted without a valid session is refused by the server and nothing is stored, even when the client-side check is bypassed. **(ship-blocking)** | PASS | **Observed at the wire (client bypassed entirely — raw `curl`):** `PUT /api/auth/settings` with no cookie → `401 {"error":"auth_required"}`; forged cookie → `401`. Nothing stored (subsequent authenticated `GET` unchanged). test: `routes::auth` gate tests, green |
| AC-25 | Signing in as a second account shows that account's risk block or an empty one, never the first account's values. | PASS | **Observed:** account A stored `$50,000 / 1%`; a freshly signed-up account B's `GET /api/auth/settings` → `state:"not_set"`, all nulls; A's block unchanged. Same on the export for both accounts. |
| AC-26 | Clearing the risk block succeeds, and the next rec produced afterwards reports *account size: not set* and shows no dollar sizing derived from an account size. | PASS | **Observed:** `PUT {account_size:null, per_trade_cap:null}` → 200; `GET` → `state:"not_set"`, `effective_dollar_cap {state:"not_set", value:null}`. Next rec then carries `sent.risk_inputs.state:"not_set"` and `cap_check.effective_dollar_cap: null`; the panel renders `not set` (observed, AC-71 row). |
| AC-27 | A signed-in owner who never entered a risk block still gets a rec; its risk figures carry no account-derived dollar amount and the absence renders as *not set* rather than a dash. **(ship-blocking)** | PASS | **Observed in the browser** on a fresh account with no risk block: the trade card rendered `Max risk` → **`not set`** + `Set your risk inputs` action, `Cap: not set`, and the rec still produced. Never a dash on a trade verdict. test: `ai-rec.risk.spec.tsx` "max_risk and position_size render `not set` with a `Set your risk inputs` action"; `field_reasons::tests::a_null_max_risk_with_no_risk_block_is_unavailable_naming_the_risk_block` |
| AC-28 | Across the rec panel, the Settings surface, the cap readout and the export drawer, the owner-supplied-nothing state renders the identical literal *not set* — no surface uses a synonym, a dash or an empty string. | PASS | review + **observed**: rec panel `not set`; cap readout `Cap: not set`; Settings `Not set — AI recommendations will show "not set" where a risk figure would go.` All bind the one constant `NOT_SET = 'not set'` (`copy.ts:178`). **Noted tension (not charged here):** in the drawer the same state renders `Not sent — you haven't set this.` — which is SPEC §4's own verbatim unsent-category literal and is mandated by AC-92. No dash and no empty string anywhere. |
| AC-29 | The account size and per-trade cap appear on no operator/diagnostic route and in no export the app offers other than the owner's own settings, rec and hand-off surfaces. (The persisted-artifact half of this rule is AC-29a.) | PASS | review + **observed**: `/api/health` and `/api/_metrics` — `account_size`/`risk_inputs`/`per_trade_cap` **absent**; only `/api/auth/settings`, `/api/recommendation/{ticker}` and `/api/recommendation/export/{ticker}` carry them, each session-scoped (anonymous export → `not_set`). |
| AC-29a | No account size reaches a persisted client artifact: a rec produced under a risk block, accepted into a position and closed into the outcome ledger yields a ledger export containing no account-size value anywhere, and a source scan over `features/trading/` fails if any module writes an account-size value into a ledger or decision record. **(ship-blocking)** | PASS | **Both arms re-run and green**, including the poison arm: test: `boundaries.spec.ts` — arm 1 "a rec produced under a risk block → captured at entry → appended → the ledger export JSON carries no account-size value anywhere"; arm 2 "no production module in features/trading/** writes an account-size KEY into any object literal" + **"the guard BITES — a poisoned literal is detected (anti-vacuity: a scan that cannot fail guards nothing)"** + "captureDigest.ts — the file F11 routes the flag into — is covered by this scan (not narrowed away)". Corroborated: `captureDigest.ts:96` writes `risk_block_present` (a boolean) only. |
| AC-30 | The anonymous Settings panel renders the section with `aria-disabled` and still-focusable controls (never the HTML `disabled` attribute) plus the sign-in line, and writes no risk value to any durable client store. | PASS | **Observed in the anonymous browser session:** both inputs → `aria-disabled="true"`, `disabled` attribute **absent**, `tabIndex 0` (focusable); sign-in line `Sign in to save your risk inputs — they're stored with your account, never in this browser.` present. test: `riskInputs.spec.tsx` "renders the section with aria-disabled controls that remain focusable, plus the sign-in copy; writes nothing durable" |
| AC-31 | The per-trade cap carries an explicit unit on the control, and every later display of that value carries its unit; a bare number with an inferred unit never renders anywhere. | PASS | **Observed:** the cap control carries an explicit `$` / `%` unit selector; the provenance chip renders `Max 1%/trade`; the wire always pairs `{value, unit}`. |
| AC-32 | A failed save keeps the typed values in the fields, shows the shipped `settings.saveError` copy verbatim, and never shows `Saved`. | PASS | test: `riskInputs.spec.tsx` "keeps typed values in the fields, shows settings.saveError verbatim, and never shows Saved" (green) |
| AC-33 | When server-side storage is unavailable the panel says so in the shipped storage-unavailable shape and claims no value as saved. | PASS | review + test: `riskInputs.spec.tsx` "shows the storage-unavailable copy and claims no value as saved" (green); the wire carries `risk_inputs.storage_available` (observed `true`) as the driver. |
| AC-34 | A never-set risk block shows its consequence line styled as a blank form field — not as an error and not as a warning. | PASS | review + **observed computed style**: `Not set — AI recommendations will show "not set" where a risk figure would go.` renders as `MuiTypography-body2`, `color: rgb(138, 155, 180)` (muted secondary), `role: null` — neither an error nor a warning treatment. |
| AC-35 | A settings record written before this feature loads without faulting and keeps its existing values; a record that fails to parse degrades to defaults without overwriting the stored original. | PASS | test: `auth::store::tests::an_old_settings_record_without_risk_fields_reads_forward_unchanged` + `a_corrupt_settings_blob_degrades_to_defaults_without_overwriting_the_original` (both green). Corroborated on disk: records carry `risk_*: null` beside the untouched `active_persona_id/default_ticker/theme/scan_view`. |
| AC-36 | No stored or wire representation of the risk block can express "unset" as `0`: a zero entry is refused (AC-18) and an absent value is a distinct state everywhere it is read. | PASS | **Observed:** disk record `{"risk_account_size":null,"risk_cap_value":null,"risk_cap_unit":null}`; wire `account_size:null` + `state:"not_set"`; a `0` entry `422`-refused on both fields. test: `auth::risk::tests::nothing_entered_is_not_set_never_a_zero` |
| AC-37 | With open simulated positions in the ticker, the rec context includes that exposure and the app names how many open positions were counted. | PASS | test: `digest.spec.ts` "AC-37 — open positions in this ticker: the exposure is included with a counted leg count"; wire shape observed on `POST /api/recommendation/SPY` (`sent.open_positions.portfolio.open_count`). |
| AC-38 | With no open simulated positions in the ticker, the context reports *none open* (checked, empty) — the fact is stated, not omitted. **(ship-blocking)** | PASS | **Observed at the wire:** I posted a digest with `state:"none_open"`; the response echoed `sent.open_positions {"source":"simulated","state":"none_open","portfolio":{"open_count":0,...}}` — stated, not omitted. test: `digest.spec.ts` "AC-38 (ship-blocking) — no open positions: checked, empty; the count is stated, not omitted" |
| AC-39 | With the simulated positions store in its faulted state the context reports *positions unavailable*; with no digest sent at all it reports *not sent*; neither ever reports *none open*, and all three are distinguishable. | PASS | **Observed:** a GET export (no client digest) → `open_positions.state:"not_sent"`; a POST with a digest → `"none_open"`. test: `digest.spec.ts` "a faulted store NEVER produces `none_open` — resolves to `unavailable` (reviewer probe)"; `rec_inputs::digest::tests::an_unlabelled_or_malformed_digest_parses_to_not_sent_and_never_fails_the_rec` |
| AC-40 | Wherever the exposure summary appears, including inside the AI context, it is labelled simulated and names that broker positions are not counted. | PASS | review + **observed**: inside the AI context the prompt carries `"open_positions_note": "SIMULATED positions from the owner's browser only. Broker positions are not counted."` (`llm.rs:165`); Settings renders `Open positions included: your simulated positions in this browser.`; the rec panel renders `SIMULATED / advisory`. test: `llm::tests::the_positions_digest_rides_the_prompt_labelled_simulated`; `StateExportDrawer.spec.tsx` "renders the Open positions section, labelled simulated" |
| AC-41 | The positions digest is never persisted server-side: after a rec, restarting the server and re-reading every server surface shows no stored digest. | PASS | **Observed:** after a rec carrying a digest, the only durable server store (`data/auth.json`) contains **0** occurrences of `open_positions`, `capital_at_risk`, `none_open` or `digest`; `GET /api/auth/settings` and the export carry no stored digest (the export emits `not_sent`). A restart can only reload that file — and the re-run pass *did* restart the server, with the same result. |
| AC-42 | The digest's source label is a closed enum with exactly one inhabitant (`simulated`), and an unlabelled digest cannot be constructed. | PASS | test: `digest.spec.ts` "the digest is always labelled `simulated` — a one-inhabitant closed enum"; `rec_inputs::digest::tests::an_unlabelled_or_malformed_digest_parses_to_not_sent_and_never_fails_the_rec`. Wire observed: `source:"simulated"`. |
| AC-43 | With a quotable ATM straddle in the nearest in-window expiration, the app shows the move as a plus/minus dollar amount and as a percentage of the anchor spot. | PASS | **Observed in the browser (both passes):** headline `± $9.01  (± 1.2%)`, matching the wire `move_dollars 9.005`, `move_pct 1.1657` of `anchor_spot 772.49` for the primary tenor `2026-08-20`. test: `StraddleMove.spec.tsx` (ok state) |
| AC-44 | The read is titled `Straddle-implied move`; the string `Expected move` appears only inside its explanatory tooltip, never as a label, heading or chip. | PASS | review + **observed**: `<h2>Straddle-implied move</h2>`; `"Expected move"` count in rendered DOM text = **0**; the phrase appears only inside the info-icon tooltip (`aria-label`: `…Traders call this the "expected move" — …`). test: `StraddleMove.spec.tsx` "\"Expected move\" appears ONLY inside the tooltip, never as a label/heading/chip (AC-44)" |
| AC-45 | The basis line is visible without hovering or expanding and names the expiration, the DTE, that the price is mid quotes, the anchor spot value and which spot it is; the advisory line states that it is not a forecast, not a probability and not a scored signal. **(ship-blocking)** | PASS | **Observed un-hovered, in body text (re-confirmed in the re-run):** `From the 2026-08-20 ATM straddle · 7 DTE · mid quotes · % of the levels-anchor spot $772.49` and `What options are priced for — not a forecast, not a probability, not a scored signal.` — all five facts present. test: `StraddleMove.spec.tsx` "the basis line is visible WITHOUT hovering, and names the expiration/DTE/anchor" + "the advisory line is visible without hovering" |
| AC-46 | The two unavailable causes render two distinct literals selected by closed lookup on a wire reason token; no surface picks the literal by inspecting a null. | PASS | test: `StraddleMove.spec.tsx` — `no_quote`, `not_computed` and `no_expiration_in_window` each render their **own** literal, each asserted distinct from the others, all selected by `switch` on `move.state`; plus "a null/undefined read degrades to unavailable, fail-honest, never a throw". |
| AC-47 | With either ATM leg lacking a two-sided quote, the read shows no number and states the no-quote reason; a market-quote basis is never computed from theoretical prices. | PASS | test: `straddle_move::tests::no_quote_and_no_iv_yields_the_no_quote_state_with_an_empty_tenor_list` + `a_missing_leg_changes_the_basis_value_and_never_silently_substitutes` (a missing leg moves `basis` to `iv_derived_estimate`, never a fabricated `atm_straddle_mid`); FE `StraddleMove.spec.tsx` "no_quote renders its own literal". |
| AC-48 | With no expiration inside the active window, the read states that reason, distinct from AC-47's reason. | PASS | test: `straddle_move::tests::no_expiration_in_window_is_its_own_state`; FE "no_expiration_in_window renders its own literal, distinct from the other two". |
| AC-49 | A straddle whose quoted spread exceeds the wide-quote threshold carries the wide-quotes marker and displays the threshold applied. **(ship-blocking)** | PASS | test: `straddle_move::tests::a_wide_straddle_carries_the_marker_and_the_threshold_applied` (asserts `wide_quotes`, `quote_spread_pct_of_mid > WIDE_QUOTE_THRESHOLD_PCT`, and the threshold on the payload) + `StraddleMove.spec.tsx` "a wide straddle carries the marker and the threshold applied (AC-49)". **Observed** that the threshold always rides the wire: `wide_quote_threshold_pct: 15` on every tenor read (live SPY was `3.9%` — not wide, so the marker arm was proven by test, not by this snapshot). |
| AC-50 | On a live-stream drop the read keeps rendering un-dimmed with no offline marker while live-derived tiles degrade. | PASS | **Observed:** `context.setOffline(true)` for 9 s — the straddle widget stayed mounted with `opacity 0.96` **identical to the online reading**, its content unchanged, and no offline marker on it, while the page as a whole surfaced its offline/stale treatment. test: `StraddleMove.spec.tsx` "takes no offline/isLive prop and binds no opacity to any stream state" |
| AC-51 | Cold load shows the shipped per-source skeleton, visually distinct from both unavailable literals. | PASS | **Observed** with the bundle response delayed 9 s: **37** `MuiSkeleton` nodes rendered, the straddle widget not yet mounted, and **no** unavailable literal anywhere on the page (`/unavailable this cycle|No ATM straddle quote|No expiration inside/` → false). After load: `± $9.01  (± 1.2%)`. |
| AC-52 | No expected-move band, shaded region or reference line is added to the GEX profile chart. | PASS | **Observed:** page HTML scanned for `expected-move`, `move-band`, `moveBand`, `straddle-band`, `expectedMoveLine` — **all absent**; the GEX strike-profile widget is untouched by the diff. |
| AC-53 | The ticker widget renders exactly one tenor — the one the payload designates as primary — and no surface selects a tenor by array order or by comparing DTEs in the browser. | PASS | **Observed:** the wire carried **3** tenors (`08-20`, `08-21`, `08-24`); the widget rendered **exactly one** — `2026-08-20`, the payload's `primary_expiration`. test: `StraddleMove.spec.tsx` "renders exactly ONE tenor — the payload-designated primary, selected by EXACT expiration match, never array order" + "selects the tenor by `find(t => t.expiration === primary_expiration)`, never array order" |
| AC-54 | The rec strip renders the move for the expiration the rec cites, selected by exact expiration match; with no matching tenor it says so for that expiry and never relabels another tenor's number. | PASS | **Observed** on a produced rec citing `2026-08-20`: `± $9.01  (± 1.2%) implied move for 2026-08-20`. test: `NumbersSaidStrip.spec.tsx` "renders the move for the cited expiration, exact match" + "a no-match expiration says so for that expiry and never relabels another tenor" |
| AC-55 | In any artifact carrying both blocks, every expiration in the move block is also present in the candidate block; widening that restriction in a test build makes the assertion fail. | PASS | **Observed live on the rec envelope:** `sent.straddle_move_tenors ["2026-08-20","2026-08-21"]` ⊆ `sent.candidates.included.expirations ["2026-08-20","2026-08-21"]` — subset check true (and the wire narrowed 3 bundle tenors → 2, proving the restriction ran). test: `llm::tests::the_forwarded_move_is_restricted_to_the_candidate_tenors` + poison `widening_the_restriction_makes_the_subset_assertion_fail` (mirrored in `straddle_move::tests`) |
| AC-56 | On a verdict that states an entry, with a risk figure readable as an unambiguous dollar amount and an effective dollar cap present, the surface states whether the figure is within or above the cap and shows both numbers. | PASS | **Observed in the browser:** over-cap trade card renders `$950 is above your cap of $500.` — the direction plus **both** numbers. test: `ai-rec.risk.spec.tsx` "renders the warning cap annotation and Accept stays enabled" (asserts `data-verdict="above"`); `literals.spec.ts` "within ⇒ comparison{within:true}" / "above ⇒ comparison{within:false}" |
| AC-57 | On a verdict that states an entry, with a risk figure that cannot be read as an unambiguous dollar amount — including when it is absent — the surface states that it could not check against the cap, never a pass by default. | PASS | test: `literals.spec.ts` "not_checkable ⇒ not_checkable, never a pass by default"; `cap_check::tests::an_entry_stating_fixture_with_a_null_risk_figure_yields_not_checkable`; copy `CAP_COULD_NOT_CHECK = "Couldn't check against your cap."` is wired into `CapAnnotation`. |
| AC-58 | On a verdict that states an entry, with no effective dollar cap, the surface shows no cap verdict at all (neither pass nor fail) and names the cap as *not set*. | PASS | **Observed in the browser** on a trade card with an empty risk block: the annotation renders exactly `Cap: not set` — no comparison, no pass/fail. test: `literals.spec.ts` "no_cap ⇒ no_cap" |
| AC-58a | On a `no_trade` verdict the cap surface renders **nothing at all** — no comparison, no *couldn't check* caveat, no cap readout and no *not set* cap literal — and this holds both with a cap set and with no cap set. The card's only not-applicable statement is the `—` on the four fields with its `No entry, so there is nothing to size.` tip. **(ship-blocking)** | PASS | **Re-verified in the re-run because this branch changed.** Fresh observation, **both arms**: `no_trade` **with** a `$500` cap → `cap-annotation` nodes **0**, no `Couldn't check…`/`above your cap`/`within your cap`/`Cap: not set` in the card text; `no_trade` with **no** cap → identical (`0` nodes, no literal, and `"not set"` absent from the whole card). And the second sentence now holds too: the card's only not-applicable statement is the four-field row reading `Max risk— Suggested size— Target— Stop—`. test: `ai-rec.risk.spec.tsx` "renders NO cap-annotation DOM node at all on a no_trade card — with a cap set AND with none" |
| AC-59 | An over-cap rec is still actionable: the entry flow opens, the annotation is present at the confirm step, and the action is not disabled. | PASS | **Observed:** on the over-cap card, `ai-rec-act` present and **enabled**, `Accept into ghost trade` + `Act as sim order` both offered, with `$950 is above your cap of $500.` rendered. test: `ai-rec.risk.spec.tsx` "renders the warning cap annotation and Accept stays enabled" |
| AC-60 | Where the cap annotation renders, it uses `warning.*` plus an icon — never brand amber, and never a green or red direction slot. | PASS | `CapAnnotation.tsx`: `color: 'warning.main'` on the stack and the text, `<WarningAmberIcon color="warning">`; **0** hardcoded hex, **0** `success.`/`error.main` references in the file. |
| AC-61 | The provenance chip renders the owner's entered values verbatim, and no client code multiplies, divides or otherwise derives a figure from them. | PASS | **Observed:** `Sized against your inputs · Account $50,000 · Max 1%/trade` — the entered `50000` and `1 percent` verbatim; the derived `$500` came from the server (`effective_dollar_cap.value`), not the client. test: `ai-rec.risk.spec.tsx` "shows the account size and cap exactly as sent, with no client-side arithmetic" |
| AC-62 | The max-risk tip states that the figure is the AI's and not Convexa's arithmetic. | **PASS (re-run)** | **Freshly observed DOM** on an over-cap trade card, max-risk field: `<span>Max risk</span><svg … data-testid="InfoOutlinedIcon" aria-label="This is the AI's figure — Convexa did not compute it."></svg>` beside the value `$950 over the cap`. `RiskField` gained an optional `valueTip` rendered **only** on the `value` branch (`AiRecPanel.tsx:768`), and `MAX_RISK_TIP` is wired at exactly one call site (`:1028`) — Target/Stop/Suggested size correctly carry no attribution tip. test: `ai-rec.risk.spec.tsx` "tradeable-rec-inputs · AC-62 — the max-risk tip attributes the figure to the AI". *(Pass 1: FAIL — no tip on the value branch; `MAX_RISK_TIP` had zero production references.)* |
| AC-63 | The verdict and the effective cap are computed once server-side and pinned to the rec envelope; the five verdict triggers are evaluated in one fixed order with *not applicable* (the rec states no entry) resolved before *no cap* and *couldn't check*; the entry dialog renders received values and contains no cap computation; a risk figure exactly equal to the cap renders *within*. | PASS | **Observed at the wire:** `cap_check {verdict, effective_dollar_cap, cap_not_derivable_reason, parsed_risk_dollars, model_max_risk_text}` pinned beside `pinned_fingerprint: "149932c28621"`; a `no_trade` request with a `$500` cap returned `verdict: "not_applicable"` **while still carrying** `effective_dollar_cap: 500` — order-1 resolved ahead of `no_cap`/`not_checkable`. test: `cap_check::tests::{a_no_trade_fixture_with_a_cap_set_yields_not_applicable, the_same_no_trade_fixture_with_no_cap_yields_not_applicable_not_no_cap, equality_is_within, strictly_greater_is_above, an_entry_stating_fixture_with_a_null_risk_figure_yields_not_checkable}`; FE `ai-rec.risk.spec.tsx` "a figure exactly equal to the cap renders `within` (AC-63)"; `CapAnnotation` reads props only. |
| AC-64 | Editing the risk block after a rec was produced shows the superseded-inputs strip in the shipped stale-strip treatment (not `warning.*` plus icon) with the existing `Get a fresh recommendation` action. | **PASS (re-run)** | **Freshly observed, both arms.** Divergent (stored `75000/2%` vs as-sent `50000/1%`): the strip renders — testid `ai-rec-superseded-strip`, text `Your risk inputs changed after this read. The sizing below is based on the earlier values.` + a `Get a fresh recommendation` action; class list contains **`MuiAlert-colorInfo`** (the shipped stale-strip treatment) and **no `WarningAmberIcon`** — i.e. explicitly *not* `warning.*`+icon, as the AC requires. Drawer simultaneously shows `Your risk inputs (as sent with this recommendation)` + `Your risk inputs changed after this read. The values below are the ones sent.` Matching blocks: **0** strips. The detector `riskInputsSuperseded` is now a real production consumer of the as-sent/stored pair. test: `literals.spec.ts` "riskInputsSuperseded is true iff the signatures actually differ (the guard BITES)" + 4 siblings incl. "false when either side is unknown — never a false positive"; `ai-rec.risk.spec.tsx:1009/1021` (present and absent arms). *(Pass 1: FAIL — the strip constants had zero production references and no digest comparison existed.)* |
| AC-65 | With a rec on screen the drawer's risk section renders the as-sent values under a label naming them as sent; with no rec on screen it renders the currently stored values under a label naming them as what the next request will send. Never both, never an unlabelled set. | PASS | **Observed with no rec on screen:** `Your risk inputs (what the next request will send)`, as-sent label absent. **Observed with a rec on screen (re-run):** `Your risk inputs (as sent with this recommendation)` — never both. test: `StateExportDrawer.spec.tsx` "labels as-sent when a rec is on screen; as-next otherwise — never both" |
| AC-66 | On every verdict including `no_trade`, the `What the numbers said` strip carries one digested candidate-liquidity line — candidate count across expiration count, the ATM relative-spread band label, the wide-quotes marker when it fires, and the omitted count with its reason — and the straddle-implied move renders exactly as it does on a trade verdict. No per-contract rows, no strike axis, no sorting, no expansion. **(ship-blocking)** | PASS | **Re-confirmed after the re-run's added freshness line — the strip is still byte-identical across verdicts.** Trade: `20 candidates across 2 expirations · ATM spread moderate · 14294 omitted (outside window)Candidates as of 2026-08-13T02:30:00Z · prior close± $9.01  (± 1.2%) implied move for 2026-08-20`. `no_trade`: **character-for-character the same string.** No per-contract rows, no axis, no sort control, no expander. test: `NumbersSaidStrip.spec.tsx` (6 tests incl. "renders identically on a no_trade verdict — the strip is verdict-independent") |
| AC-67 | A `no_trade` card renders the same `Why` and `Levels in play` sections a trade verdict renders. | PASS | **Observed on the `no_trade` card:** the `Levels in play` block (`call wall 780 · gamma flip 768.01 · put wall 770 · max pain 754 · net GEX 8.6B · IV/HV 0.80 · VWAP 772.63`) and the reasoning/rationale section (`ReasoningSection`) — the same two components the trade branch mounts. |
| AC-68 | No verdict state applies a success or error palette slot to the verdict hero, and no copy, count or badge frames `no_trade` as an empty or zero-result state. | PASS | **Observed computed colour** on the `no_trade` hero text: `rgb(233, 228, 214)` — neutral foreground, not a success/error slot (the hero icon is `color="info"` / `"primary"`). Copy reads `No trade — sit this one out` + `No entry to Accept — a 'no trade' read is a complete, correct answer.` — a result, not an empty state; no zero-count badge. |
| AC-69 | `max_risk`, `position_size`, `exit_plan.target` and `exit_plan.stop` each render exactly one member of the closed set {value, `—`, `not set`, `unavailable`, `not given`}; `null`, `undefined`, `NaN`, `0` and an empty cell never render. | **PASS (re-run)** | The anti-fabrication half was always sound (`fieldLiteral` is a closed lookup; test: `literals.spec.ts` "null/undefined/NaN/0/\"\" never render as a value" + 7 siblings). The "each render exactly one member" half is now satisfied on **every** verdict: on `no_trade` the four fields render the `—` member rather than nothing — see AC-70 for the fresh observation. *(Pass 1: FAIL, same root cause as AC-70.)* |
| AC-70 | A `no_trade` verdict renders `—` on all four fields with the not-applicable tip — never `not set`, never `unavailable`. | **PASS (re-run)** | **Freshly observed** on a `no_trade` card: `data-testid="no-trade-four-field-row"` present, text `Max risk—Suggested size—Target—Stop—`, **em-dash count in the row = 4**; `not set` / `unavailable` / `not given` all **absent** from the whole card. The row mounts inside the `isNoTrade` branch and routes every field through the same `fieldLiteral` closed lookup, so `decision === 'no_trade'` short-circuits all four to `dash`. **The rewritten guard asserts the positive and I poison-proved it myself:** blanking the row's children made `ai-rec.risk.spec.tsx > AC-69/70 (GATE Q correction) …` go **red** (`TestingLibraryElementError: Unable to find an element with the text: Max risk`, exit 1); restoring the file byte-identically (md5 `ebc300de66b1d79d719ad15ea7006e42`) returned it **green**. The guard now asserts all four labels **plus** `getAllByText(dash)).toHaveLength(4)`, not merely the two negatives. *(Pass 1: FAIL — the row did not render at all and the guard was vacuous on the positive half.)* |
| AC-71 | A trade verdict with an empty risk block renders `not set` on `max_risk` and `position_size` with a `Set your risk inputs` action that navigates to the Settings panel. | PASS | **Observed:** `Max risk → not set` + `Set your risk inputs`, `Suggested size → not set`; the action navigates to `/settings#risk-inputs`. test: `ai-rec.risk.spec.tsx` "max_risk and position_size render `not set` with a `Set your risk inputs` action" |
| AC-72 | The `unavailable` / `not given` split is decided server-side from which blocks the assembler actually inserted, `unavailable` names the missing input, and no surface asks the model why it left a field blank. | PASS | **Observed at the wire:** with every input present, `field_reasons` returned `{reason:"not_given", missing_input:null}` on all four fields — computed server-side; the prompt contains no "why did you leave this blank" instruction. test: `field_reasons::tests::{a_null_field_with_every_input_present_is_not_given, a_null_max_risk_with_no_risk_block_is_unavailable_naming_the_risk_block, a_present_value_has_no_reason, exit_stop_never_reports_a_missing_input}` |
| AC-72a | When both of `position_size`'s dependencies are absent on the same request — no risk block set **and** no candidate quotes — the named missing input is the risk block, deterministically, on every run. | PASS | test: `field_reasons::tests::position_size_with_both_dependencies_absent_names_the_risk_block_on_every_run`; FE `literals.spec.ts` "AC-72a — an `unavailable` reason with any other missing input renders `unavailable`, never `not_set`" (the complementary arm). |
| AC-73 | A per-contract quote renders only when strike, expiration and right together resolve to exactly one contract in the candidate set. | PASS | **Observed:** with a full `(2026-08-20, 772, call)` triple the fact line rendered `772 C 2026-08-20 · bid 5.02 / ask 5.3 · Δ 0.534 · IV 10% · from the 2026-08-13T02:30:00Z chain snapshot`. test: `cited::tests::{a_full_triple_in_the_set_yields_cited, two_strikes_yield_none, a_missing_expiration_yields_none}` |
| AC-74 | When the rec states no right, the fact line renders either both legs labelled call and put, or the no-quote-shown literal; exactly one right is never chosen for the reader. | PASS | test: `cited::tests::a_missing_right_with_the_strike_and_expiration_in_the_set_yields_right_undetermined_with_both_legs`; FE `literals.spec.ts` "a right_undetermined cite renders both legs, never the off_set literal". Both literals are wired into production. |
| AC-75 | A cited contract whose strike or expiration is absent from the candidate set renders `Not in the candidate set Convexa sent` with no quote figure, and that literal never renders for the undetermined-right case. | PASS | test: `cited::tests::a_full_triple_absent_from_the_set_yields_off_set` + `a_missing_right_with_the_strike_absent_yields_off_set`; FE `literals.spec.ts` "an off-set cite renders off_set" + "a right_undetermined cite renders both legs, **never the off_set literal**". |
| AC-76 | No code path renders a per-contract quote from a match key that does not carry a right. | PASS | test: `candidate_isolation::the_match_key_constructor_takes_a_non_optional_right` — asserts `CitedKey::new` takes `right: ContractType` and **not** `Option<ContractType>`, with its own anti-vacuity probe. |
| AC-77 | An absent or unrecognised right token stays absent and never defaults to a side. | PASS | test: `llm::tests::{an_absent_right_stays_absent_contrast_with_bias_default, an_unrecognised_right_stays_absent_and_never_defaults, a_call_right_is_projected, a_put_right_is_projected}` — the coercion at `llm.rs:401` has no default arm (deliberately unlike `bias`). |
| AC-78 | The local rule-based fallback rec produces no cited contract and no per-contract quote. | PASS | test: `cited::tests::the_local_rule_based_fallback_shape_yields_none` — the fallback emits `strikes: []` / `expiration: null`, so no triple can form. |
| AC-79 | Opening the simulated-entry dialog from a rec leaves the quantity field at the same default it shows today, in every case; the rec's size text appears beside the field, quoted and attributed to the AI. | PASS | `parseQty` is **deleted** and `qty` removed from `AiPrefill`, so the dialog opens at its own default `1`. test: `TradeEntryDialog.risk.spec.tsx` "AC-79 (ship-blocking) — the quantity field opens at the dialog default of 1, in every case; there is no `qty` on `EntryPrefill` to seed it from" + "every prefill field lands in the confirm payload — EXCEPT qty (the AI-seeding seam)" + "AC-79/80/81 — the rec size text renders verbatim beside the field, never fed into the quantity input"; `ai-rec.risk.spec.tsx` "maps a produced trade rec to the exact editable seed — with NO qty field". **The stale contradicting assertion in `orders.risk.spec.tsx` is corrected in the re-run** (§9.7): `:437` and `:468` now assert `1`. |
| AC-80 | A rec that states no size at all shows *size not suggested* — a distinct literal from *not set* — and still opens the quantity field at today's default. | PASS | test: `TradeEntryDialog.risk.spec.tsx` "AC-80 — a rec with no size at all shows `size not suggested`, distinct from `not set`"; `ai-rec.risk.spec.tsx` "AC-80 — a rec with no size text at all yields `size not suggested`, distinct from `not set`". Constants are distinct and both wired. |
| AC-81 | A rec whose size text names no whole number of contracts is displayed verbatim, and no quantity anywhere in the app is derived from it. | PASS | **Observed:** the trade card rendered `Suggested size · 2 contracts` verbatim while the dialog default stayed `1` (no derivation). test: `ai-rec.risk.spec.tsx` "AC-81 — a size string naming no whole number of contracts is carried verbatim". No `position_size` parser exists on either side of the wire. |
| AC-82 | A position entered from a rec records whether a risk block was present at entry; positions entered before this feature remain readable and are neither altered nor destroyed. | PASS | Wiring traced end-to-end: `TickerDashboard.tsx:145` derives `riskBlockPresent` from `auth.settings.risk_inputs` → passed at `:710` → `usePortfolio.openPosition` → `entryContextFor` → `captureDigest.ts:96` `risk_block_present`. Additive optional field (`boolean | null`), so older records read forward. test: `captureDigest.spec.ts` "tradeable-rec-inputs AC-82 — captures the presence flag ONLY, never an account-size value" + "the digest object's PRESENCE is the epoch marker: present-with-null ≠ absent" |
| AC-83 | The opportunity score, tier and state fingerprint for a ticker are byte-identical with and without a risk block entered, with and without candidates, and with and without the straddle move — asserted on **both** bundle branches (`dark_pool=true` cached-signals and `dark_pool=false` re-score). **(ship-blocking)** | PASS | **Re-proved by me, not inherited:** `cargo test -p api-rust --test score_identity -- --nocapture` → exit 0, printing `score=8 tier=dormant fingerprint=ad81df2ba2c3` on **both** branches, matching the V0 pin exactly. Corroborating structure: `quant-engine`'s `signals.rs`/`gate.rs` untouched; the move is attached **after** `generate_signals`; `market_state_from_gex`'s positional argument list unchanged. Unaffected by the re-run (no backend file changed). |
| AC-84 | Adding any datum from this feature to the scoring input list makes the fingerprint-identity test fail, and that poison test is proven non-vacuous. | PASS | test: `score_identity::poison_adding_a_move_derived_value_to_the_scoring_inputs_changes_the_fingerprint` — green. I read it: a real `assert_ne!` between two `evaluate_gate` fingerprints from `market_state_from_gex` calls differing only in one slot (`1.05` vs a move-derived `7.35`). |
| AC-85 | The AI cooldown and daily-cap counters advance for a rec request exactly as they did before this feature, and a gate-not-ready ticker is still gate-not-ready. | PASS | `git diff` of `routes/recommendation.rs` and `services/recommendation.rs` shows **no ± line** touching the cooldown/daily-cap logic (the only "cap" additions are the *risk* `cap_check`). **Observed** the shipped envelope unchanged: `cap {over_limit:false, remaining_today:50, resets_at:…}`, `gate {state:"ready", cooldown_remaining_seconds:0, reasons:[]}`. Shipped gating tests still green. |
| AC-86 | Acting on a rec creates only a SIMULATED position behind the existing mandatory confirm; no order, broker or execution surface is added anywhere in this feature. | PASS | **Observed:** the rec card carries `SIMULATED / advisory`; `Accept into ghost trade` / `Act as sim order` open the one shared `TradeEntryDialog`. The diff adds no order/broker/execution surface. test: `shared-entry.flow.spec.tsx` (2) + `TradeEntryDialog.risk.spec.tsx` (15), all green, incl. "byte-identity guard: WITHOUT orderPlan no order-variant DOM exists — the shipped dialog only". |
| AC-87 | No value added by this feature renders in a success or error colour; all figures use the mono, tabular treatment; there is zero hardcoded hex and no new keyframe family. | PASS | Scanned all new/changed presentational modules (`StraddleMove.tsx`, `CapAnnotation.tsx`, `CitedContractLine.tsx`, `ProvenanceChip.tsx`, `NumbersSaidStrip.tsx`, `RiskInputsSection.tsx`): **hex = 0, keyframes = 0, success/error slots = 0** in every one. **Observed computed style** of the straddle headline: `font-family: "IBM Plex Mono", …`, `font-variant-numeric: tabular-nums`, rendered as `<p>`. The re-run's superseded strip uses `MuiAlert-colorInfo` — the shipped stale treatment, neither success nor error. |
| AC-88 | The rec panel, the Settings `Risk inputs` panel and the export drawer produce no horizontal overflow at 393px. | PASS | **All three surfaces re-measured at 393px in the re-run, with the densest new content actually on screen** (superseded strip + freshness line + cap annotation + cited line + the two AC-3 cap clauses — presence asserted before measuring): ticker/rec panel `{393,393}` pre- and post-rec; Settings `{393,393}`; export drawer page `{393,393}` and drawer element `{392,392}`. e2e re-run after the panel gained content: **exit 0, 4 passed** (dark + light), with its own vacuity guards. |
| AC-89 | A recorded before/after comparison of rec verdicts exists across at least five named tickers including one after-hours run; every `no_trade` to trade flip is listed with the input the rec cited for the change; the owner reviews it as a ship condition. **(ship-blocking)** | **PASS** | **Owner ruling, 2026-08-13**, recorded in the artifact itself (`before-after-verdicts.md:8-10`): *"Owner review recorded 2026-08-13 — RTH-only verdict sample accepted by owner ruling (GATE Q AC-89); after-hours verdict re-run declined, V7 evening quote-fill remains the standing deferred measurement."* That closes the criterion's final clause (owner review, performed) and **narrows** its after-hours clause by explicit, dated decision from the only party the criterion vests that authority in — recorded, not silently waived. The rest was verified on the evidence, not the ruling: ≥5 named tickers (SPY, QQQ, IWM, NVDA, AAPL); **both arms real** (before = a `git worktree` at HEAD `962fe8f`, which I independently confirm is genuinely pre-feature — every feature file is still uncommitted); method corroborated line-by-line against shipped code; **every `no_trade`→trade flip listed — there are 0/5**, and the one opposite-direction flip (QQQ) carries the model's stated reason; per-ticker rows reconcile with the summary counts; Attempt-1 history preserved; **no fabrication or synthesized data found** (§10.3 — decisively, the reported `cited`/`right_undetermined` states are structurally impossible from the local fallback's `strikes: []`, so `AI_REC_LOCAL_ONLY` was not the source). Both cosmetic slips I flagged are corrected (§10.5). **Stated plainly: this PASS is on the owner-amended bar — the feature ships with no after-hours before/after verdict sample, by the owner's informed and recorded choice.** review · §10 |
| AC-90 | The egress note enumerates every category actually sent and no longer claims *no account or identity*; the server-supplied note and the frontend fallback copy assert the same thing. **(ship-blocking)** | PASS | **Observed twice, and the enumeration tracked what actually shipped:** anonymous export → `"Complete list of what leaves the machine for SPY: context, candidate contracts, the persona prompt, the glossary."`; signed-in with a risk block → the same sentence **plus `your risk inputs`**. Neither claims "no account or identity". The FE fallback `EXPORT_EGRESS_FALLBACK` (the only one wired) asserts the same closed category list. test: `recommendation::tests::the_egress_note_is_composed_from_the_categories_and_no_longer_claims_no_account_or_identity`. **Non-blocking hygiene note:** the superseded string at `copy.ts:67` still contains *"no account or identity"* — it is **dead** (zero production references) and never renders, but it is a live trap for the next reader. |
| AC-91 | The export drawer renders a `Candidate contracts` section carrying `{N} contracts across {M} expirations · {K} omitted ({REASON})` and a `Your risk inputs` section carrying the values it names. | PASS | review + **observed in the drawer (re-run, real data)**: `Candidate contracts` → `60 contracts across 4 expirations · 14254 omitted (outside_window) · 29 expirations omitted by the cap · 719 strikes dropped (strike cap)` — the base template intact with AC-3's clauses appended; `Your risk inputs (…)` section present and labelled. test: `StateExportDrawer.spec.tsx` "renders the candidate-contracts section with the wire counts" |
| AC-92 | A category that was not sent renders an explicit `Not sent` line rather than an omitted section. | PASS | **Observed:** with no risk block and no client digest, the drawer rendered `Your risk inputs (…)` → `Not sent — you haven't set this.` and `Open positions` → `Not sent — you haven't set this.` — sections **present**, not omitted; driven by `egress_categories[].sent:false`. test: `StateExportDrawer.spec.tsx` "renders the explicit Not sent line rather than an omitted section" |
| AC-93 | `View what's sent` is reachable in every rec-panel state, including `not set` and `no_trade`. | PASS | **Observed in 5 distinct panel states across both passes:** in-app-AI-unavailable, `not set` (no risk block, no rec), produced trade, produced trade with a superseded strip, and `no_trade` — the affordance was present and clickable in all, and it opened the drawer. |
| AC-94 | The drawer names, in the surface itself, which consumer it is showing (the in-app recommendation request or the hand-off export) and how many contracts across how many expirations that consumer carried. | PASS | **Observed:** the `Candidate contracts` section rendered the consumer caption `The hand-off export — one computation, two renderings with the rec panel strip.` directly above the counts; the in-app branch renders `The in-app recommendation request — the set the displayed rec was produced with.` |
| AC-95 | On the in-app view the contracts listed are the ones the displayed rec was produced with; opening the drawer after the snapshot has advanced never shows a set the rec did not receive, and if the as-sent set cannot be recovered the drawer states that instead of listing a re-assembled one. | PASS | The drawer takes `asSentCandidates` (the rec's own `sent.candidates`) and prefers it whenever a rec is on screen, falling back to a stated recovery failure rather than a re-assembly. test: `StateExportDrawer.spec.tsx` "states the recovery failure instead of listing a re-assembled set". Corroborated at the wire: `sent.candidates` is pinned on the rec envelope beside `pinned_fingerprint`. |
| AC-96 | Both consumers' sets obey the same band, active-window and expiration-cap rules, and each states the count omitted by the cap with its reason. | PASS | review + **observed side by side on the same snapshot**: handoff `band_pct 15`, 4 expirations, 60 records, `expirations_omitted_by_cap 29`, `by_reason.expiration_cap 5527`; prompt `band_pct 15`, 2 expirations, 20 records, `expirations_omitted_by_cap 31`, `by_reason.expiration_cap 5806` — same band, same window rule, same five-reason ledger, both stating the cap omission with its reason, both summing to 14314. The re-run additionally surfaces the handoff set's cap omission in the drawer (AC-3). |
| AC-97 | The anonymous hand-off export includes the candidate set and the straddle-implied move and reports the risk block as *not set* with the section present rather than omitted; its egress note enumerates only what an anonymous export actually carries. | PASS | **Observed on a genuinely anonymous `GET /api/recommendation/export/SPY`:** `context.candidates` present (`state:"ok"`, 60 contracts, `budget:"handoff"`, `sent_to_model:false`); `context.market_state.straddle_move` present (`state:"ok"`, 3 tenors); `context.risk_inputs` **present** with `state:"not_set"`; egress note names only `context, candidate contracts, the persona prompt, the glossary`. test: `recommendation::tests::an_anonymous_export_reports_risk_inputs_not_set_with_the_section_present`; `StateExportDrawer.spec.tsx` "AC-97 — anonymous export reports risk_inputs as `not set`, section present, never omitted" |

---

## 6. Summary

| Verdict | Pass 1 | After re-run part 1 | **Final (after owner ruling)** |
|---|---|---|---|
| **PASS** | 93 | 99 | **100** |
| **FAIL** | 7 — AC-3, AC-8, AC-62, AC-64, AC-69, AC-70, AC-89 | 1 — AC-89 | **0** |
| **UNVERIFIABLE** | 0 | 0 | **0** |
| Total | 100 | 100 | **100** |

**Ship-blocking rows (13): ALL PASS.** AC-7 · AC-15 · AC-24 · AC-27 · AC-29a · AC-38 · AC-45 · AC-49 · AC-58a (re-verified) · AC-66 (re-verified) · AC-83 (re-proved) · **AC-89 (closed by the owner ruling of 2026-08-13 — §10.6)** · AC-90.

### Plan-sanctioned deferral (recorded, not counted as a failure)

**V7 — the live evening (20:00–23:00 ET) + RTH quote-fill measurement.** The harness **exists and compiles** (`RestClient::fetch_chain_quote_fill` at `rest.rs:208`, the `quote-fill` CLI subcommand at `main.rs:136/319/354`, writing `data/research/quote_fill_<utc>.json`), and the deferral branch **was recorded** in `verification-notes.md` §V7 with the branch taken stated explicitly ("no branch of the ladder was evaluated; the live run is deferred to a session inside the stated window", key present, window absent). No `data/research/quote_fill_*` artifact exists, consistent with the recorded deferral. No AC verdict depends on it.

### Not a defect, but the next reader should know

- `copy.ts:67` still holds the superseded egress string containing *"no account or identity"*. It is **dead** (zero production references) and never renders — AC-90 passes on the wired path — but it is exactly the kind of string that gets re-wired by accident.
- `UNDETERMINED_RIGHT_TIP` is likewise declared with zero production references. No AC requires it.

---

## 7. GATE Q verdict

> **GATE Q: PASS** — see §11 for the final verdict. *(This section records the state as of the part-1 re-run, when AC-89 was still open; it is retained for the audit trail.)*

The rule is unambiguous: PASS only if **every** AC is PASS, no invariant is broken, and no Critical criteria-gap finding remains, with conformance PASS on my own receipt.

- Conformance: **PASS** (my receipt, exit 0, 4/4 — identical to the builder's; unchanged and re-justified in §1).
- Binding invariants: **all hold**, including the HARD score byte-identity, re-proved rather than inherited. The two pass-1 partials (`[absent-is-not-none]` on the `no_trade` card, `structural-over-prose-enforcement` on the AC-70 guard) are **both closed**.
- Criteria-independent Critical sweep: **no Critical finding**.
- Acceptance criteria: **99 PASS / 1 FAIL**. The remaining failure is **AC-89**, ship-blocking, and it is **not a code defect and no longer an unproduced measurement** — the before/after study now exists, was executed with real LLM verdicts on both arms, and I found **no fabrication, no synthesized data and no inconsistency that changes its result** (§10). What is unmet is narrow and verbatim: the study carries **no after-hours *verdict* sample** (the lane says so itself), and **the owner has not yet reviewed it**. Both are the owner’s call, not a lane’s. **[SUPERSEDED 2026-08-13 — the owner has since reviewed it and ruled; AC-89 is PASS. See §10.6 and §11.]**
- Frontend suite: **exit 1**, now with **exactly** the five accepted pre-existing file-level reds and **zero** feature-caused reds (§9.7).

The pass-1 shape worth remembering — *the literal was written and never wired* — has been genuinely closed rather than papered over: each of the four affected constants/fields now has a production consumer I watched render, each fix carries a named test covering **both** arms, and the one guard that had been named for a behaviour it never asserted was rewritten to assert the positive and **poison-proved red by me** before being restored byte-identically.

---

## 8. Amendments bounced to owners

### Frontend — **ALL SIX CLOSED** (re-verified §9)

| AC | Pass-1 bounce | Status |
|---|---|---|
| AC-3 | Surface named neither the cap-omitted expirations nor the strikes dropped | **CLOSED — PASS (re-run)** |
| AC-8 | No candidate as-of and no live-session/prior-close anywhere; `{as_of}` never interpolated | **CLOSED — PASS (re-run)** |
| AC-62 | No tip on the max-risk value branch; `MAX_RISK_TIP` unwired | **CLOSED — PASS (re-run)** |
| AC-64 | Superseded strip never rendered; no digest comparison existed | **CLOSED — PASS (re-run)** |
| AC-69 | Four fields rendered zero members on `no_trade` | **CLOSED — PASS (re-run)** |
| AC-70 | Four-field row absent on `no_trade`; guard vacuous on the positive half | **CLOSED — PASS (re-run), guard poison-proved** |
| *(suite)* | `orders.risk.spec.tsx:432` asserted `qty === 2`, contradicting AC-79 | **CLOSED** — `:437` and `:468` now assert `1`; the file's only remaining red is the pre-existing tail assertion (§9.7) |

### Backend / owner — **CLOSED**

| AC | Observed vs expected | Dependency |
|---|---|---|
| **AC-89** *(ship-blocking)* | **CLOSED by owner ruling, 2026-08-13.** The artifact was produced with real LLM verdicts on both arms and verified unfabricated; the owner read it, accepted the RTH-only verdict sample and declined an after-hours re-run, satisfying the criterion's owner-review clause and narrowing its after-hours clause on the record. | **Nothing bounced.** No code defect was found at any point in AC-89's history. |

---

## 9. Re-run (part 1) — Frontend fixes, re-verified by observation

**Scope.** The six bounced Frontend items only. AC-89 was **not** verified in this pass (held pending an owner decision on an LLM key). Fix reports were treated as unverified claims throughout; every verdict below rests on something I watched happen.

**Environment.** Fresh API on `:8010` (never `:8000` for the build under test), QA-only `:8000 → :8010` forwarder so the browser could only reach my build, and a **fresh** Vite on `:4200` (PID 84932, created 20:29:43 — I killed the stale IPv6-bound instance from the earlier session first, since `ports:free` does not match IPv6 listeners).

### 9.1 AC-3 — cap-omission clauses · **PASS**

Observed against **real server data** (not a fixture), drawer `Candidate contracts` section:

```
60 contracts across 4 expirations · 14254 omitted (outside_window) · 29 expirations omitted by the cap · 719 strikes dropped (strike cap)
```

Reconciles exactly with the live wire (`expirations_omitted_by_cap: 29`, `by_reason.strike_cap: 719`). Both arms are guarded: `StateExportDrawer.spec.tsx` "AC-3 — when the tenor cap actually bound…" and **"AC-3 — a tenor cap that never bound adds no extra clause"** (asserts `not.toMatch(/omitted by the cap/)` and `not.toMatch(/strikes dropped/)`), matching the `> 0` conditionals in `candidatesLine`.

### 9.2 AC-8 — candidate as-of + session basis · **PASS**

Rendered un-hovered on **both** card types (testid `numbers-said-freshness`):

```
Candidates as of 2026-08-13T02:30:00Z · prior close
```

Cited line now interpolates it: `772 C 2026-08-20 · bid 5.02 / ask 5.3 · Δ 0.534 · IV 10% · from the 2026-08-13T02:30:00Z chain snapshot`. Literal `{as_of}` rendered anywhere on the page: **false** (the two source hits are code comments). `SESSION_LABEL` maps `rth → live session`, `after_close`/`closed_pre` → `prior close`, and `candidateFreshnessLine` returns `null` — omitting the line rather than printing a lie — when the set carries no as-of. Five named tests cover the mapping, the interpolation, and both degradation paths.

### 9.3 AC-62 — max-risk attribution tip · **PASS**

Observed DOM on an over-cap trade card:

```html
<span…>Max risk</span><svg … data-testid="InfoOutlinedIcon"
  aria-label="This is the AI's figure — Convexa did not compute it."></svg>
<p…>$950 over the cap</p>
```

`RiskField` gained an optional `valueTip` applied **only** on the `value` branch, and `MAX_RISK_TIP` is passed at exactly one call site — Target, Stop and Suggested size correctly carry no attribution tip. Guarded by `ai-rec.risk.spec.tsx` "AC-62 — the max-risk tip attributes the figure to the AI".

### 9.4 AC-64 — superseded-inputs strip · **PASS (both arms)**

- **Divergent** (stored `75000/2%`, as-sent `50000/1%`): strip present (`ai-rec-superseded-strip`), text `Your risk inputs changed after this read. The sizing below is based on the earlier values.` + `Get a fresh recommendation`. Class list contains **`MuiAlert-colorInfo`** and the strip contains **no `WarningAmberIcon`** — the shipped stale-strip treatment, explicitly *not* `warning.*`+icon, as the AC requires. Drawer simultaneously showed `Your risk inputs (as sent with this recommendation)` + `Your risk inputs changed after this read. The values below are the ones sent.`
- **Matching**: **0** strips.

The detector is a pure local signature over the two owner-entered scalars, returning `false` whenever either side is unknown — so an anonymous or still-loading client can never be told its inputs were superseded. Six named tests, including "the guard BITES" and "never a false positive".

### 9.5 AC-69 / AC-70 — the `no_trade` four-field row · **PASS**, guard poison-proved

Observed on a `no_trade` card: `data-testid="no-trade-four-field-row"` present, text `Max risk—Suggested size—Target—Stop—`, **em-dash count = 4**; `not set` / `unavailable` / `not given` all absent from the card.

**The guard was rewritten to assert the positive** (`getByTestId('no-trade-four-field-row')`, all four labels, `getAllByText(dash)).toHaveLength(4)`) *and* keep the two negatives. I poison-proved it rather than trusting it:

| Step | Action | Result |
|---|---|---|
| 1 | `md5sum AiRecPanel.tsx` → `ebc300de66b1d79d719ad15ea7006e42`, backed up | baseline captured |
| 2 | Blanked the row's 827 chars of children (row element kept, contents removed) | poison applied |
| 3 | Ran the guard | **RED** — `TestingLibraryElementError: Unable to find an element with the text: Max risk`, exit **1** |
| 4 | Restored from backup | `md5sum` → `ebc300de66b1d79d719ad15ea7006e42` — **byte-identical** |
| 5 | Re-ran the guard | **GREEN**, exit **0** |

The tree is exactly as the lane left it; no product file was modified by this QA pass.

**AC-58a re-checked because this branch changed** — both arms still pass: `no_trade` with a `$500` cap and `no_trade` with no cap each render **0** `cap-annotation` nodes and no cap literal (`Couldn't check…`/`above your cap`/`within your cap`/`Cap: not set` all absent), with `"not set"` absent from the whole card. The four-field `—` row is now genuinely the card's only not-applicable statement, which is what AC-58a's second sentence always asserted.

### 9.6 Regression spot-checks on the touched surfaces

| Check | Result |
|---|---|
| Straddle widget (untouched, but adjacent) | Unchanged: `Straddle-implied move ± $9.01  (± 1.2%) From the 2026-08-20 ATM straddle · 7 DTE · mid quotes · % of the levels-anchor spot $772.49 What options are priced for — not a forecast, not a probability, not a scored signal.` |
| AC-66 strip parity after the added freshness line | Trade and `no_trade` strips are **character-for-character identical** |
| AC-88 at 393px with the densest new content | Ticker/rec panel `{393,393}` pre- and post-rec; Settings `{393,393}`; drawer page `{393,393}`, drawer element `{392,392}` — **no overflow anywhere**. Presence of superseded strip + freshness + cap annotation + cited line asserted **before** measuring |
| e2e 393px suite (panel gained content) | **exit 0**, 4 passed |
| Wire regression | `GET /api/candidates/SPY` → `as_of`, `session_basis: after_close`, `expirations_omitted_by_cap: 29`, `strike_cap: 719`, `included + omitted = 14314` — unchanged |
| Backend / shared lib touched? | `find apps/api/src libs/quant-engine/src libs/api/src -newermt "2026-08-12 20:10"` → **empty**. Wire cannot have moved; conformance re-run not required |

### 9.7 `orders.risk.spec.tsx` — the tail-assertion ruling

**The lane's claim is CONFIRMED.**

- The two qty assertions are corrected: `:437 expect(o.qty).toBe(1)` and `:468 expect(pos.legs[0].qty).toBe(1)` — AC-79's sanctioned dialog default.
- The file's only remaining failure is now at **`:503`**, the tail network allow-list sweep:
  `expect(c.url.includes('/api/recommendation/') || c.url.includes('/api/positions/sim-trade/gate')).toBe(true)` → `expected false to be true`.
- **Against my own pass-1 clean-`HEAD`-worktree evidence:** that run failed this same test at **`:485`** with the **identical** assertion message and the **identical** expression (`c.url.includes('/api/recommendation/') || c.url.includes('/a…`). The 485 → 503 shift is fully explained by the lines this feature added to the file. Execution reaching `:485` on the clean tree is also what originally proved the qty assertion had passed pre-feature.
- **Ruling: pre-existing, not feature-caused.** Accepted into the baseline.

**Accepted baseline, therefore:** `npx nx test @convexa/dashboard` exits **1** with exactly these five file-level reds — `readonly.spec.tsx`, `positions.risk.spec.tsx` (network pattern), `grouping.integration.spec.tsx`, `stage3-amber.spec.ts`, `orders.risk.spec.tsx` (tail network sweep). Any **other** red is a FAIL.

Observed re-run: **5 failed files / 142 passed (147); 5 failed tests / 1639 passed (1644)** — the same five files, and **+18 passing tests** versus pass 1 (1621 → 1639) with **zero** new reds. Every one of the five matches the accepted list.

### 9.8 Typecheck

`npm run typecheck` → **exit 0** (1/2 cache hit, so I re-ran uncached). `npx nx run-many -t typecheck --skip-nx-cache` → **exit 0**, 2 tasks, cache skipped. Judged by exit code, not by the printed summary.

### 9.9 Re-run part 1 — conclusion (CLOSED)

Six of six Frontend items **verified fixed by observation**, each with a production consumer I watched render and a named test covering both arms; one guard poison-proved red and restored byte-identically. No regression found on any touched surface. **Part 1 is closed.** AC-89 was carried forward to part 2 — see §10.

---

## 10. Re-run (part 2) — AC-89 (then the sole open item; now CLOSED)

**Scope.** AC-89 only. Per the coordinator I did **not** re-run the LLM calls: the artifact and the
V10 notes *are* the deliverable AC-89 names, so my job was to read them against the criterion's
verbatim bar, spot-check internal consistency, and judge whether anything reads as fabricated.

**Sources read in full:** `before-after-verdicts.md` (127 lines) and `verification-notes.md` §V10.

### 10.1 Clause-by-clause against the verbatim criterion

| Clause of AC-89 | Verdict | What I checked |
|---|---|---|
| "A recorded before/after comparison of rec verdicts **exists**" | **MET** | `before-after-verdicts.md` exists (9 685 bytes), both arms carry real verdicts, and `verification-notes.md` §V10 records the same result independently. |
| "across **at least five named tickers**" | **MET** | SPY, QQQ, IWM, NVDA, AAPL — five named rows, each with a before verdict, an after verdict, a flip/hold call, `cap_check.verdict` and `cited_contract`. |
| "**including one after-hours run**" | **NOT MET** | The live-verdict pass captured **all five at `market_phase: rth`**. The only after-hours pass (Attempt 1) produced **zero verdicts in either arm** — so it contributes no *verdict* comparison. The lane declares this against its own interest at `before-after-verdicts.md:35-40`: *"This pass therefore does **not** independently supply the after-hours leg of 'including one after-hours run' for the **verdict** data … flagged for the owner as a residual gap if a strict after-hours **verdict** sample is required."* I concur with the lane's own reading. The clause is load-bearing rather than ceremonial: SPEC §2.2 singles out *"the owner's dominant evening usage"* as where quote-presence / no-two-sided-quote behaviour differs most — exactly what an RTH-only sample cannot exercise. |
| "every `no_trade` to trade flip is listed with the input the rec cited for the change" | **MET** | **There are 0/5 such flips** — all five *before* verdicts are `trade`, so no `no_trade`→trade transition is possible in this sample and the list is complete by being empty. The one flip that did occur runs the **opposite** way (QQQ, `trade`→`no_trade`) and *is* listed with the model's own stated reason (spot had reached the setup's 730 call-wall target ⇒ "effectively zero distance … and negative expected value after spreads/theta"). |
| "the owner reviews it as a ship condition" | **NOT MET (owner action)** | `before-after-verdicts.md:6` — *"Owner review is still the ship condition this artifact exists to serve."* No lane can perform this. |

### 10.2 Internal-consistency spot-checks

| Check | Result |
|---|---|
| Per-ticker rows vs summary counts | **Reconciles.** Table: SPY HOLD, QQQ FLIP, IWM HOLD, NVDA HOLD, AAPL HOLD = 4 HOLD + 1 FLIP = 5. Summary claims "0/5 `no_trade`→trade", "one `trade`→`no_trade` (QQQ)", "4/5 HOLDs (SPY, IWM, NVDA, AAPL)" — all three match the table exactly, including the named ticker list. |
| `cap_check` values vs the spec's fixed order | **Consistent.** QQQ is the only `no_trade` and the only `not_applicable` — exactly SPEC §2.5 order-1. The four `trade` rows are `not_checkable`. |
| `cited_contract` vs structure | **Consistent.** The single-leg after-verdict (SPY) → `cited`; the three multi-leg spreads (IWM put debit, NVDA bear put, AAPL iron condor) → `none`; QQQ → `right_undetermined`, which per SPEC §2.5 is its own state and correctly *not* `off_set`. |
| Before-arm method actually described? | **Yes, and it checks out against my own evidence.** The artifact names a `git worktree` at HEAD **`962fe8f`** served on `:8011`, and states precisely what the pre-feature prompt carried (`{ticker, market_state, signals, ai_eval}` via `services/llm.rs::build_rec_prompts`). I independently confirm `git rev-parse HEAD` = `962fe8f` and that **every file of this feature is still uncommitted working-tree state** — so a worktree at HEAD is a genuine pre-feature binary, not a reconstruction. |
| Attempt-1 history intact? | **Yes.** Preserved as a labelled "Attempt 1 (historical — preserved, not deleted)" section in the artifact *and* summarised in `verification-notes.md` §V10. Nothing was overwritten to make the second pass look cleaner. |

### 10.3 Was any of it synthesized? — **No.** Four independent corroborations

1. **The reported verdicts cannot have come from the local rule-based fallback.** `local_strategy_from_bundle` (`recommendation.rs:729`) emits `"strikes": []` on **both** branches (lines 740 and 777) and the fixed prose `"small (rule-based local rec; not LLM)"` (line 782). A `cited_contract` of `cited` or `right_undetermined` structurally **requires** `strikes` length 1 plus an expiration — impossible from `strikes: []`. The artifact reports both states. So `AI_REC_LOCAL_ONLY` demonstrably was **not** the source, exactly as claimed.
2. **The method's mechanics match the shipped code line-for-line.** `COOLDOWN_SECS: u64 = 60` (`recommendation.rs:31`); `DAILY_CAP: i32 = 50` (`:32`); `body.override_flag` bypasses the cooldown (`:667`) and the no-fresh-edge gate (`:661`) **but the daily-cap check `if over` at `:665` is unconditional** — precisely the artifact's claim that `override` did not touch the cap. `PUT /api/auth/ai-key` is a shipped route (`routes/mod.rs:58`).
3. **The one unflattering finding matches a rule I verified myself in pass 1.** The artifact reports the trade verdicts landing on `not_checkable` because the model's `max_risk` prose names two different dollar figures in one sentence. That is exactly the by-design behaviour of `max_risk::parse_max_risk_dollars`, whose test `a_range_of_two_different_dollar_figures_is_not_parseable` I read and ran green in pass 1. A fabricator inventing results would have little reason to invent a finding that makes the feature look *worse*.
4. **Reporting against interest throughout.** The after-hours gap, an OOM crash, two stuck vendor singleflights, and the lane's own key-echo incident are all volunteered. Artifacts being dressed up do not carry this.

**Two cosmetic drafting slips — neither changes a result, neither reads as fabrication:**

- `before-after-verdicts.md:78` says *"in 4 of 5 `trade` verdicts"* — the after arm holds only **four** `trade` verdicts (QQQ is `no_trade`), and all four are `not_checkable`. The count 4 is right; the denominator label should read "4 of 4 trade verdicts" (or "4 of 5 tickers"). The table itself is self-consistent.
- `before-after-verdicts.md:90` heads a paragraph *"a live single-leg **call**"*, but the SPY row reads *"long **put** (fade call wall)"* and the quoted mids in that section are puts. Single-leg is correct — the word "call" is a slip. The substantive claim (single-leg ⇒ `cited`) holds.

### 10.4 Key-material sweep (recorded as a note, not a verdict)

The lane self-reported that a shell one-liner briefly printed the raw `ANTHROPIC_API_KEY` to its own
tool output during diagnosis, caught immediately (`before-after-verdicts.md:99-104`). I swept for
persisted key material:

| Sweep | Result |
|---|---|
| Key-shaped strings (`sk-ant-…`, `sk-…{20,}`, `ANTHROPIC_API_KEY=<value>`) anywhere in the feature folder | **None.** Zero matches across `.spire/clusters/tech/contracts/tradeable-rec-inputs/`, including `before-after-verdicts.md` and `verification-notes.md`. |
| `ANTHROPIC_API_KEY` mentioned at all in the feature folder | Four hits, **all the variable NAME only, never a value** — one is the incident disclosure itself; three are pre-existing architecture prose in `_context-pack.md`. |
| `sk-ant-` in **tracked** files, whole repo | Six hits, **all obvious test/placeholder literals** (`sk-ant-REALKEY-0000`, `sk-ant-test-secret-key`, `sk-ant-api03-xxxx`, `sk-ant-supersecretkey1234`, `sk-ant-rotatedkey5678`, `sk-ant-test-ai-key-4321`) in crypto/LLM unit tests, a FE spec and an archived Python test. **`git diff` confirms this feature added none of them.** |
| `apps/api/.env` (where the live key now sits, per the artifact) | **Gitignored** (`.gitignore:86`) and **untracked** — `git ls-files --error-unmatch` fails on it. It cannot reach a commit. |

**Conclusion of the sweep: no key material landed in any committed file or in any feature-folder
artifact.** The incident is contained to transient tool output. Recorded as a note per instruction —
it is not an AC-89 verdict input. *(Standing owner-facing hygiene point, not a QA finding: the
artifact notes the owner's key is now **active** in `apps/api/.env`; that file is gitignored, so this
is a local-machine matter, not a repo-exposure one.)*

### 10.5 Corrections + owner ruling — confirmed present at close

All three items the coordinator flagged as concurrently-applied are **present and correct** in
`before-after-verdicts.md` at the moment I closed this report (file mtime 10:07):

| Item | Status | Verified text |
|---|---|---|
| `:78` count phrasing | **Applied** | now reads *"in 4 of the 4 after-arm trade verdicts"* — the denominator now matches the table (the after arm holds four `trade` verdicts; QQQ is `no_trade`). |
| `:90` leg label | **Applied** (now `:94`) | now reads *"a live single-leg **put**"*, matching the SPY row (*"long put (fade call wall)"*) and the put mids quoted in that section. |
| Ruling header line | **Applied** (`:8-10`) | *"Owner review recorded 2026-08-13 — RTH-only verdict sample accepted by owner ruling (GATE Q AC-89); after-hours verdict re-run declined, V7 evening quote-fill remains the standing deferred measurement."* |

Two notes on the record, neither blocking:

- The ruling is **recorded in the artifact itself, dated, and names what it declined** — it is a
  narrowing by the only party the criterion vests that authority in, not a silent waiver. It also
  correctly keeps **V7's evening quote-fill deferral separate and still standing**, so accepting an
  RTH-only *verdict* sample does not quietly absorb the unrelated evening *fill-rate* measurement.
- Line 6 still carries the pre-ruling sentence *"Owner review is still the ship condition this
  artifact exists to serve."* immediately above the ruling that records it as done. Harmless (it
  reads as a statement of the artifact's purpose and is superseded two lines later by a dated entry),
  but a future reader skimming only the first paragraph could misread it. Cosmetic; flagged, not
  charged.

### 10.6 AC-89 verdict — **PASS** (on the owner-amended bar)

> **AC-89: PASS.** The owner's ruling of **2026-08-13**, recorded in `before-after-verdicts.md:8-10`,
> satisfies the criterion's final clause and narrows its after-hours clause by explicit decision.

Clause-by-clause at close:

| Clause | Status at close |
|---|---|
| Comparison of rec verdicts exists, ≥5 named tickers | **MET** — SPY, QQQ, IWM, NVDA, AAPL, both arms real, corroborated four ways in §10.3 |
| Every `no_trade`→trade flip listed with the cited input | **MET** — 0/5 such flips; the one opposite-direction flip (QQQ) is listed with the model's stated reason |
| Including one after-hours run | **NARROWED BY RECORDED OWNER DECISION** — the after-hours **verdict** sample does not exist and this report does not pretend otherwise; the owner read the artifact, accepted the RTH-only sample, and **declined** the after-hours re-run, dated and in writing |
| The owner reviews it as a ship condition | **MET** — review recorded 2026-08-13 |

**Stated plainly so it is never lost:** this PASS is on the **owner-amended** bar. The feature ships
without an after-hours before/after *verdict* sample. That residual is the owner's informed choice,
recorded at the point of decision, and it remains legible in the artifact and here. Nothing about the
verdict data itself was fabricated, re-labelled or softened to reach this PASS — the only thing that
changed is the bar, changed by the person entitled to change it.

*(Terminology note for the record: the coordinator labelled the ruling "**B**"; substantively it is
the branch this report set out at §10.5-as-written in the prior revision as option **(a)** — accept
the RTH-only sample and record the review. The substance is unambiguous in the artifact's own dated
line; only the letter differs.)*

---

## 11. Final GATE Q verdict

> # **GATE Q: PASS**
>
> **100 PASS · 0 FAIL · 0 UNVERIFIABLE** across SPEC §3's 100 acceptance criteria, all 13
> ship-blocking rows included.

Applying the rule from my agent definition — PASS only if **every** AC is PASS, no invariant is
broken, no Critical criteria-gap finding remains, and conformance is PASS on **my own** receipt:

| Gate condition | Result |
|---|---|
| Every acceptance criterion PASS | **Yes — 100/100.** 93 on pass 1; six flipped on fresh observation in the part-1 re-run (AC-3, AC-8, AC-62, AC-64, AC-69, AC-70); AC-89 closed by the owner's recorded 2026-08-13 ruling. |
| Ship-blocking rows | **13/13 PASS** — AC-7, AC-15, AC-24, AC-27, AC-29a, AC-38, AC-45, AC-49, AC-58a, AC-66, AC-83, AC-89, AC-90. |
| Binding invariants (BRIEF watch + OPEN_THREADS §9 canon) | **All hold.** The HARD one re-proved by me, not inherited: `score=8, tier=dormant, fingerprint=ad81df2ba2c3`, byte-identical on **both** bundle branches, with its poison arm green and read for non-vacuity. Both pass-1 partials (`[absent-is-not-none]` on the `no_trade` card; `structural-over-prose-enforcement` on the AC-70 guard) are closed. |
| Criteria-independent Critical sweep | **No Critical finding** across all three passes — auth, authz, cross-tenant, secret exposure, destructive data, log leakage, anonymous spend surface. |
| Interface conformance on my own receipt | **PASS** — exit 0, 4/4 endpoints (23/50/19/12 fields), identical to the builder's; re-justified as unchanged after the frontend-only fix pass because no backend or shared-lib file moved. |
| Suites | Rust `cargo test -p api-rust -p quant-engine` **exit 0**; `@convexa/api` **exit 0**; typecheck **exit 0** (cache bypassed); e2e **exit 0**; dashboard suite exit 1 with **exactly** the five accepted pre-existing reds and **zero** feature-caused reds (§9.7). |

**Two things this pass is worth remembering for.** First, the failure shape that pass 1 caught —
*the literal was written and never wired* — was closed properly rather than papered over: each of the
four affected constants and wire fields now has a production consumer I watched render, and the one
guard that had been **named for a behaviour it never asserted** was rewritten to assert the positive
and **poison-proved red by me** before being restored byte-identically (md5
`ebc300de66b1d79d719ad15ea7006e42`). Second, the "pre-existing failure" claim was settled by running
the specs on a clean `HEAD` worktree rather than by trusting the report — which is how the one
genuinely new, feature-caused red was found and fixed.

**Routing:** GATE Q is green. This report is complete; no amendments are bounced to any lane.

**Residual carried forward (not a gate condition, recorded so it is not lost):**

- **V7 — the live evening (20:00–23:00 ET) quote-fill measurement.** Harness built and compiling
  (`fetch_chain_quote_fill`, the `quote-fill` CLI); the run is deferred by the plan's own
  pre-committed ladder with the branch recorded. The owner's AC-89 ruling explicitly keeps this
  standing and separate.
- **No after-hours before/after verdict sample** — the owner's informed, recorded choice (§10.6).
- **`copy.ts:67`** still holds a dead egress string containing *"no account or identity"* (zero
  production references, never renders) — a latent trap for the next reader.
- **A PM/persona-prompt finding, not a defect:** the model's `max_risk` prose routinely names two
  dollar figures in one sentence, which the parser correctly reads as `not_checkable` by design. A
  wording nudge is a prompt change, not a parser change.
