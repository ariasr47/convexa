# Audit — lean tests and CI, 2026-10

Default branch `main` at `8932fc11`. Measurements: [BASELINE.md](BASELINE.md). Per-file verdicts:
[audit.csv](audit.csv) (531 rows). Exact cases to remove or merge per file: [areas/](areas/) (one
report per area) and the cross-area [areas/RECONCILIATION.md](areas/RECONCILIATION.md). Numbered
batches: [BATCHES.md](BATCHES.md). Step log: [PROGRESS.md](PROGRESS.md).

## The answer

- **Tests:** 5,161 runnable cases today (Vitest 3,184 · Rust 1,643 · `test:tools` 150 · Playwright CI
  gates 184; +12 Postgres-gated) → **about 2,930** after every proposed retirement, trim and
  consolidation (Vitest 1,708 · Rust 1,104 · tools 62 · Playwright 56). Projection from the auditors'
  case lists; REPORT.md will carry the runner's count.
- **Local suite time:** about **9.5 minutes** of measured wall time for the green local path today
  (`cargo test` 198 s, `test:tools` 87 s, Vitest 85 s, Chromium gate 57 s, …). After: a `verify`
  command scoped to the change, **target under 2 minutes** (batch 97); the full-suite time after the
  batches will be measured, not projected.
- **CI minutes a month:** **4,959** billed Linux minutes in the last 30 days (measured; 2.48× the
  2,000 free; one run was refused by the Actions budget) → **about 600** projected: CI on manual
  dispatch at an assumed 8 runs a month × about 47 minutes, plus about 224 for supply-chain on push
  and its weekly cron, which a floor guard pins (batch 93). About 380 if the owner also moves
  supply-chain to manual.

## Pinned protection (deliberate breaks, Phase 1)

Each break was applied on a clean worktree, the suites were run, and `git restore` returned the tree
to clean (`git status` showed only `docs/testing/`). The catching tests are **KEEP-PINNED**; no batch
removes them (verified by the reconciliation, NEVER-REMOVE check).

| Break | Change | Caught by | Not caught by |
|---|---|---|---|
| B1 money | `maxLoss.ts:114` iron condor/butterfly uses the narrower wing (`Math.max`→`Math.min`) — understated max loss | **only** `features/trading/positions/maxLoss.spec.ts:195` | Chromium gate (128/128 green) |
| B2 permission | `services/auth/service.rs:404` revoked/expired sessions accepted | **only** `tests/api_contract_parity.rs` `cookie_and_gate_http_parity_flow_is_explicit` (`:1249`, replayed cookie after logout) | 1,642 other Rust tests; Postgres guardrails (2/2 green) |
| B3 data write | `shared/lib/durable/resolveDurable.ts` deletes the legacy blob after promoting it (violates the promoted `loss-free-durable-migration` never-delete) | 15 tests: `durable/migration.spec.ts` ×10, `resolveDurable.spec.ts` ×2, `positions/store.spec.ts` ×2, `model/store.spec.ts` ×1 | Chromium gate |

**Floor gap from B2:** session idle and absolute expiry (`now >= expires_at`,
`now >= absolute_expires_at`) has **no test** — the one catcher only exercises revocation. B1 shows
the asymmetric-condor max-loss rule rests on a single unit case.

## Per-area tables

Verdict counts are per file; a TRIM file stays with fewer cases. "After" is the auditors' projected
case count after the area's batches, adjusted by the reconciliation.

| Area | Files | Cases today | KEEP | TRIM | CONSOLIDATE | RETIRE | UNSURE | NEW-TEST | Cases after (projected) |
|---|---|---|---|---|---|---|---|---|---|
| A1-ticker-ai-rec | 26 | 507 | 3 | 13 | 3 | 7 | 0 | 0 | 138 |
| A2-ticker-other | 49 | 487 | 7 | 26 | 0 | 15 | 1 | 0 | 214 |
| A3a-trading-positions | 33 | 486 | 9 | 16 | 1 | 7 | 0 | 0 | 342 |
| A3b-trading-broker-orders-outcomes | 37 | 565 | 19 | 16 | 1 | 1 | 0 | 0 | 487 |
| 20 | `apps/api/src/capacity/harness_app.rs` (in-file test module; structure) | 2 → 0 | removed: loader_rejects_invalid_fixture_root, loader_supports_dedicated_and_legacy_fixture_roots |
| 20 | `apps/api/src/services/capacity_harness/inject.rs` (in-file test module; structure) | 1 → 0 | removed: inject_publishes_changing_quotes |
| A4-auth-alerts | 13 | 114 | 1 | 10 | 1 | 1 | 0 | 0 | 64 |
| A5-shared-shell-theme | 47 | 357 | 12 | 16 | 4 | 15 | 0 | 0 | 169 |
| A6-pages-other | 37 | 416 | 8 | 22 | 0 | 7 | 0 | 0 | 210 |
| A7-root-structural-lib | 23 | 252 | 0 | 9 | 7 | 7 | 0 | 0 | 84 |
| R1-rust-security-contracts | 36 | 256 | 9 | 17 | 0 | 7 | 0 | 3 | 157 |
| R2-rust-money-math-parsers | 42 | 282 | 9 | 16 | 12 | 2 | 0 | 3 | 176 |
| R3a-rust-research-tape-archive | 41 | 363 | 8 | 28 | 2 | 3 | 0 | 0 | 265 |
| R3b-rust-flatfile-snapshot-capacity | 29 | 154 | 9 | 17 | 1 | 2 | 0 | 0 | 117 |
| R4a-rust-it-contracts-guardrails | 28 | 379 (+3 uncounted) | 8 | 16 | 1 | 2 | 1 | 0 | 306 |
| R4b-rust-it-capacity-capture-replay | 30 | 209 | 7 | 20 | 1 | 2 | 0 | 0 | 83 |
| T1-tools-playwright | 60 | 384 (+38 uncounted) | 12 | 13 | 0 | 32 | 2 | 1 | see T1 note |

T1 note: `test:tools` 150 → about 62 (`api-contract.spec.mjs` 61 → 44; five one-off router/baseline
tooling specs, `capacity-gate`, `ci-resource-guards` and `vite-mui-path-imports` retire; `free-ports`,
`holiday-calendar-parity` and `postgres-release-receipt` stay). Playwright CI gates 184 → 56: Chromium
128 → 6 (navigation 5, curvature-v2 1 after the AC-35/U-32 consolidation), compatibility 15 and
accessibility 35 unchanged, visual 6 → 0 **only if the owner rules** (batch 22 is BLOCKED). The 38
never-run spec files (supply-chain 17, e2e tools 21) are not in any suite today; batch 98 wires the
kept guard proofs into `test:tools`.

**Biggest single wins:** `ai-rec.risk/grounding/absence.spec.tsx` (152 s of file wall time, 125
cases → about 26; floor parts kept as direct renders); `no-overflow.spec.ts` (93 layout cases);
`readLayout.spec.ts` (113 table rows whose only production use is one annex flag); the operator
separation scan copied into seven `*.structural.spec.ts` files (folded into one carrier) and into
five Rust `*_isolation.rs` files; `capacity_baseline_isolation.rs` 31 → 13;
`archive_coverage_runtime.rs`'s 22-second test that cannot observe coverage at all.

## Cross-area reconciliation

Fifteen auditors each saw one area, so some retired a test as a duplicate of a test another auditor
was also removing. One reviewer checked all 192 duplicate rows and every case-level citation:
**33 conflicts**, of which **11 would have left a behavior untested**. Resolved by keeping the
cheapest single copy (full table: [areas/RECONCILIATION.md](areas/RECONCILIATION.md)):

- quant-engine: `soa.rs` `dollar_gex_spot_gamma_formula` and `gex.rs` DTE-window test stay; the
  `tests/scalar_gex.rs` copies go. R2's `gamma_flip`/`greeks`/`gex:635`/`max_pain` removals require
  R4a's `golden.rs` hard-assert first (it soft-skips missing fixtures today, `golden.rs:360-370`):
  **batch 31 runs after batch 41**.
- `tests/capacity_load.rs` stays (with short holds); the three `run.rs` load runs go.
- `api_contract_policy.rs:67` (only real-source authority scan), `day_tape/path_a.rs`
  `recv_loop_source_does_not_persist`, `market_data/mod.rs:224`, `capacity_harness/receipt.rs:397`,
  `DecisionCard.spec.tsx:291`, `TopNav.spec.tsx:59-66` (opened-drawer no-`/_ops`) stay.
- Two moves: the producer `display_spot > 0` assert into `batch_backtest.rs`; grounding AC-29 into the
  `cardGroundingLine` table.
- Second review overturned one removal: `positions.integration.spec.tsx:368` (the only test that a v2
  blob with an equity leg promotes to v3 intact).
- R4a/R4b Pages-404 scan removals depend on A7 folding the needles into
  `batch-backtest-cli.structural.spec.ts` — A7's trim batches (38–39) come first.

## Keep list (121 files kept whole; 289 more stay with fewer cases)

What each kept file guards, in the auditors' words (`[floor class]`; `pinned:` marks the break
catchers). TRIM/CONSOLIDATE files are in audit.csv.

**A1-ticker-ai-rec** (3)

- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/emDashCoalesce.scan.spec.ts` (4) — A ?? '—' fallback quietly renders a missing value as the reserved not-applicable mark. [invariant:absent-is-not-none]
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/prefill.absence.spec.ts` (6) — Accept pre-fills a strike, expiration or call/put the AI never named (taken from the chain or guessed from bias), putting a fabricated contract one tap from a sim position. [invariant:ai-asserted-numbers-are-traceable]
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/useAiRecommendation.spec.ts` (3) — A failed refresh silently replaces the user's pinned AI read, or a paused POST shows 'try again' and is rethrown. [repro]

**A2-ticker-other** (7)

- `apps/dashboard/src/app/pages/ticker/live-dot-census.spec.tsx` (13) — A closed, overnight, replaying or dropped desk wears a LIVE dot on stale or replayed figures, so a trader reads frozen numbers as live. [invariant:live-vs-static-isolation]
- `apps/dashboard/src/app/pages/ticker/pos-params.spec.tsx` (14) — A position on the ticker silently changes the bundle request's pos_* params or the opportunity score/tier, changing server-side scoping and fingerprint for the same ticker. [invariant:additive-keeps-score-byte-identical]
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/useStreamLatch.spec.ts` (6) — After an SSE drop a live tile shows another ticker's last value or a NaN instead of the retained last-known value. [invariant:live-vs-static-isolation]
- `apps/dashboard/src/app/pages/ticker/widgets/chrome/FreshnessLine.spec.tsx` (2) — The structure-age caption freezes between polls or prints NaN, so stale structure looks fresh. [invariant:live-vs-static-isolation]
- `apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/chart.spec.tsx` (5) — The structure field plots the wrong strike window (walls dropped, unsorted, flip or max pain clipped) or mis-maps strike rows, drawing the primary instrument wrong. [parser]
- `apps/dashboard/src/app/pages/ticker/widgets/position-brief/PositionBrief.spec.tsx` (7) — The desk claims no positions when the store is faulted, shows a fabricated P/L of 0, frames a last-known mark as live, or picks one of N positions. [invariant:absent-is-not-none]
- `apps/dashboard/src/app/pages/ticker/widgets/structure-history/historyMath.spec.ts` (4) — The path strip shows a wrong score or flip-distance delta, or draws a sparkline from fewer than two points. [parser]

**A3a-trading-positions** (9)

- `apps/dashboard/src/app/features/trading/positions/composeMark.spec.ts` (25) — A multi-leg position shows a partial, sign-inverted net mark when a leg is unpriced, a weaker or frozen leg basis is hidden, or a resting limit fills off a stale leg or a per-unit-vs-dollar units mix-up. [money]
- `apps/dashboard/src/app/features/trading/positions/crossTicker.integration.spec.tsx` (6) — A foreign-ticker position on a multi-ticker page shows P/L priced off the focused ticker's spot (the reproduced $25200 / +$5200 fabrication) and keeps serving it as last-known. [repro]
- `apps/dashboard/src/app/features/trading/positions/digest.spec.ts` (8) — The open-positions digest sent with an AI rec tells the model the trader has no exposure when the store faulted, or invents a max-loss figure for an unbounded structure. [invariant:absent-is-not-none]
- `apps/dashboard/src/app/features/trading/positions/entry.spec.ts` (8) — A sim entry fills at the wrong price or basis, or a resting limit fills off a non-live mark or on the wrong side of the cross. [money]
- `apps/dashboard/src/app/features/trading/positions/leg.spec.ts` (16) — Leg cost or P/L arithmetic drifts: 100 shares up $1 reads $10,000, a short leg's sign flips, a credit's P/L% inverts or divides by ~0, or single-leg P/L diverges from the shipped formula. [money]
- `apps/dashboard/src/app/features/trading/positions/migrate.spec.ts` (34) — The one legacy lift and union lose, duplicate, invent or bring back deleted positions and decisions when the v1/v2 stores merge into v3. That loss is silent, total and irreversible. [invariant:loss-free-durable-migration]
- `apps/dashboard/src/app/features/trading/positions/migration.spec.ts` (28) — The real store cutover over real localStorage re-runs the union, deletes or rewrites a source blob, half-promotes on an unreadable source, or flattens a multi-leg v2 record. [invariant:loss-free-durable-migration]
- `apps/dashboard/src/app/features/trading/positions/store.spec.ts` (20) — The durable positions store loses a v1 or legacy-brand trade, discards a source blob, overwrites a corrupt blob on the next write, or throws on quota or corruption. [invariant:loss-free-durable-migration;pinned:B3 (2 brand-migration cases)]
- `apps/dashboard/src/app/features/trading/positions/testSeed.spec.ts` (6) — The demo-account seed writes fake positions into a real user's book, clobbers existing positions, or re-seeds after the user deleted the seeded rows. [data-write]

**A3b-trading-broker-orders-outcomes** (19)

- `apps/dashboard/src/app/features/trading/TradeEntryDialog.risk.spec.tsx` (18) — A sim entry silently records the wrong mode, price, basis or quantity, or pre-types an AI-asserted stop/target/size, corrupting every position or order built from it. [money]
- `apps/dashboard/src/app/features/trading/shared-entry.flow.spec.tsx` (2) — Positions or Ticker launches a forked entry dialog, or a resting limit fills off a non-live mark or at the wrong price. [invariant:single-shared-sim-entry-dialog]
- `apps/dashboard/src/app/features/trading/model/captureDigest.spec.ts` (10) — Entry-context capture throws into a trade write, fetches, dumps raw data, or records the account-size figure into the durable log. [data-write]
- `apps/dashboard/src/app/features/trading/model/legMark.spec.ts` (11) — A leg is priced off another ticker's price or a 0/borrowed mark (R8), showing a confidently wrong P&L. [money]
- `apps/dashboard/src/app/features/trading/model/mark.spec.ts` (14) — The mark ladder or P&L arithmetic silently yields a wrong or fabricated mark or P&L. [money]
- `apps/dashboard/src/app/features/trading/model/useTickerSpots.spec.tsx` (7) — A foreign-ticker leg borrows the focused ticker's price, or a failed refresh blanks a spot that had loaded. [money]
- `apps/dashboard/src/app/features/trading/orders/orders.risk.spec.tsx` (9) — A rec→Act order skips the mandatory confirm, reaches a real order path, fills wrong or twice, is stored despite a server 403, overwrites a corrupt store, or loses its scenario marker. [invariant:no-real-order-path]
- `apps/dashboard/src/app/features/trading/orders/seed.spec.ts` (7) — A rec's prose trigger is mis-parsed into a guessed or wrong trigger level that gets pre-filled into an order. [parser]
- `apps/dashboard/src/app/features/trading/orders/useOrderEngine.spec.tsx` (2) — One bad order, or one failed contract lookup, stops evaluation and fills for every other order. [invariant:best-effort-isolated-or-null]
- `apps/dashboard/src/app/features/trading/broker/broker.integration.spec.tsx` (1) — The connect→read→refresh→disconnect journey breaks, or the old book's data stays on screen after disconnect. [smoke]
- `apps/dashboard/src/app/features/trading/broker/brokerCrossTicker.integration.spec.tsx` (4) — A broker row is priced off the focused ticker (R8 showed +$5200 instead of +$1000), or an offline cold start poisons the last-known value. [money]
- `apps/dashboard/src/app/features/trading/broker/fixtures.contract.spec.ts` (14) — A broker fixture drifts so the credit, withholding and leg-count tests pass vacuously off the captured book. [guard]
- `apps/dashboard/src/app/features/trading/broker/noNaming.render.spec.tsx` (13) — A broker group starts naming an option structure on its own the day the vendor feed carries strike, expiry and right. [invariant:structural-over-prose-enforcement]
- `apps/dashboard/src/app/features/trading/broker/noNaming.scan.spec.ts` (12) — A new broker module imports the structure-naming machine or hand-types a shape word, and nothing fails. [invariant:structural-over-prose-enforcement]
- `apps/dashboard/src/app/features/trading/broker/predicates.spec.ts` (8) — A stale broker snapshot is shown as fresh, staleness is invented client-side, or 'degraded' fires with no snapshot. [contract]
- `apps/dashboard/src/app/features/trading/broker/reassess.spec.tsx` (5) — A reassessment of a real holding drops its as-of basis or offers an accept or write affordance against real money. [invariant:no-real-order-path]
- `apps/dashboard/src/app/features/trading/broker/unrenderedBrokerPl.spec.tsx` (17) — Webull's own unrealized P&L, roughly 100× wrong by its own arithmetic, reaches the screen. [money]
- `apps/dashboard/src/app/features/trading/broker/useBrokerBook.spec.tsx` (10) — A throttled refresh is shown as fresh, a failed refresh blanks the book, or a signed-out user triggers broker requests. [contract]
- `apps/dashboard/src/app/features/trading/tradeEntry/submitGate.spec.tsx` (6) — Confirm enables when a rec left the strike, expiry or direction unstated, opening a position the AI never specified. [guard]

**A4-auth-alerts** (1)

- `apps/dashboard/src/app/features/alerts/evaluate.spec.ts` (5) — An alert rule silently stops firing, or fires at the wrong level, when score, tier or price crosses its threshold, so the user misses the signal they set up. [parser]

**A5-shared-shell-theme** (12)

- `apps/dashboard/src/app/shell/shell-live-lifecycle.flow.spec.tsx` (2) — Leaving the ticker leaves its live feed open or a revisit double-subscribes, so a user sees stale or doubled live data and the browser leaks streams. [smoke]
- `apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.tsx` (7) — A live price flash fires on stale or offline data or under reduced motion, or never clears. [invariant:single-motion-moment]
- `apps/dashboard/src/app/shared/hooks/useReducedMotion.spec.tsx` (2) — Motion plays for a user who asked for reduced motion. [invariant:single-motion-moment]
- `apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts` (13) — A desk figure shows a live dot or pulse while the stream is dropped, market closed, tape replay or offline; a second liveness expression creeps into a desk file. [invariant:live-vs-static-isolation]
- `apps/dashboard/src/app/shared/liveness/liveClaim.typeproof.spec.ts` (1) — A hand-written boolean is accepted as a liveness claim after the brand is removed, with no runtime test failing. [invariant:structural-over-prose-enforcement]
- `apps/dashboard/src/app/shared/theme/hex-discipline.spec.ts` (4) — A hardcoded colour renders right in one scheme and silently breaks the other (light mode unreadable). [invariant:theme-token-discipline]
- `apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts` (12) — A new animation family or an ungated live pulse ships, so decorative or fake-live motion appears on a stale or dropped stream. [invariant:single-motion-moment]
- `apps/dashboard/src/app/shared/theme/warning-icon.spec.ts` (3) — A warning is conveyed by colour alone because a warning Alert suppresses its icon. [guard]
- `apps/dashboard/src/app/shared/ui/ErrorBoundary.spec.tsx` (3) — One widget or route exception white-screens the desk with no retry.
- `apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx` (3) — A coming-soon placeholder gains a link or button of its own, opening a path toward a not-yet-built real surface. [invariant:no-real-order-path]
- `apps/dashboard/src/app/shared/lib/durable/migration.spec.ts` (23) — A user's open positions, closed P/L, decisions, personas or prefs vanish or are overwritten after the gammaflow->convexa key/version migration, with no server backup. [invariant:loss-free-durable-migration;pinned:B3 (10 cases)]
- `apps/dashboard/src/app/shared/lib/durable/resolveDurable.spec.ts` (8) — A migrate-on-read helper deletes, mutates or throws on a user's legacy blob. [invariant:loss-free-durable-migration;pinned:B3 (2 cases)]

**A6-pages-other** (8)

- `apps/dashboard/src/app/pages/landing/StructureFieldSample.spec.tsx` (1) — The landing sample field is mounted with live/real-time flags, so a prospect sees fabricated data presented as live. [invariant:live-vs-static-isolation]
- `apps/dashboard/src/app/pages/operator-session-archive/classify.spec.ts` (11) — The operator console shows an origin/CORS/auth fault as an empty archive, or accepts a body claiming vendor_called or authorizes!=nothing as a legal research read. [invariant:operator-vs-trader-path-separation]
- `apps/dashboard/src/app/pages/operator-session-archive/sittingBase.spec.ts` (10) — The operator token is sent over plain http to a non-loopback host, to a Pages static host, or to a URL with userinfo/query/path. [auth]
- `apps/dashboard/src/app/pages/scanner/deskParams.spec.ts` (5) — A shared scanner URL with junk or unknown values invents a filter or sort, so the trader sees a subset believing it is the whole universe. [parser]
- `apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.spec.ts` (3) — The scanner session badge shows RTH on an NYSE full-day holiday, or Closed on a trading day. [contract]
- `apps/dashboard/src/app/pages/scanner/useScan.spec.tsx` (8) — A signed-out or stale-cookie scan-view save is treated as persisted or cached locally, the scanner polls a hidden tab or opens a stream and bursts the backend, or one failed poll blanks the table. [invariant:server-side-gate-enforcement]
- `apps/dashboard/src/app/pages/positions/capitalAtRisk.spec.ts` (7) — The positions mast shows a computed-looking Capital at risk ($0 or a partial sum) for a book with nothing to sum, or counts an unbounded short as a number. [money]
- `apps/dashboard/src/app/pages/positions/netPl.spec.ts` (10) — Net P/L (open) shows a green +$0 for an empty or unmarked book, a number while the stream is down, or a partial sum without its coverage caption. [money]

**R1-rust-security-contracts** (9)

- `apps/api/src/error.rs` (2) — The FE stops recognising paused market data because the 503 body loses code=market_data_paused, or other error bodies gain a stray code key. [conformance:no-vendor-production-posture]
- `apps/api/src/middleware/rate_limit.rs` (3) — One IP drains vendor quota on data routes because the per-IP limit stops counting or misclassifies expensive paths. [guard]
- `apps/api/src/runtime_guardrails/archive.rs` (3) — Production starts on an archive root it cannot durably write, so captures are lost. [invariant:production-fails-closed]
- `apps/api/src/runtime_guardrails/origins.rs` (1) — A wildcard, http or look-alike origin gets credentialed CORS access. [auth]
- `apps/api/src/server.rs` (6) — A look-alike origin gets credentialed CORS, production serves without a valid snapshot root, or paused boot starts vendor workers. [invariant:production-fails-closed]
- `apps/api/src/services/auth/passwords.rs` (1) — A wrong password, or an unknown account, logs in. [auth]
- `apps/api/src/services/auth/risk.rs` (8) — A user's per-trade dollar cap is derived wrongly or an invalid cap is stored. [money]
- `apps/api/src/services/auth/service.rs` (13) — Signup opens while locked, a BYO key is echoed, or key rotation loses or rewrites stored ciphertext. [invariant:secret-encrypted-at-rest]
- `apps/api/src/services/auth/store.rs` (8) — User settings or credentials are lost, merged or overwritten on a legacy or corrupt read. [data-write]

**R2-rust-money-math-parsers** (9)

- `apps/api/src/domain/price.rs` (2) — The live price shown to traders uses a quote side instead of the last trade, or a wrong NBBO mid [money]
- `apps/api/src/services/rec_inputs/digest.rs` (3) — A non-simulated (broker) positions payload is accepted into the rec, or a malformed digest fails the rec [invariant:no-real-order-path]
- `apps/api/src/services/scanner/tiering.rs` (2) — A broad price move promotes the whole universe into one slow batch, multiplying vendor calls per cycle [invariant:single-ticker-on-demand]
- `apps/api/src/services/scanner/universe.rs` (1) — The scanner desk default view lists symbols that are never swept, or lowercase duplicates [parser]
- `libs/quant-engine/src/context_pack.rs` (5) — The AI/desk context shows a wrong trend/strength/ATR read, or a short history yields a label instead of null [invariant:digested-labels-not-raw-dump]
- `libs/quant-engine/src/darkpool.rs` (3) — Off-exchange share, ratio or block prints shown as context are miscounted [invariant:dark-pool-context-only]
- `libs/quant-engine/src/iv_rank.rs` (4) — IV rank or band shown to traders and the AI is wrong, or a thin/flat history yields an invented rank [invariant:model-read-carries-its-assumptions]
- `libs/quant-engine/src/straddle_move.rs` (9) — Implied-move dollars/% are wrong, or a missing quote is silently replaced instead of reported in a closed state [invariant:best-effort-isolated-or-null]
- `libs/quant-engine/src/vol_units.rs` (5) — An IV percent is accepted as a decimal (100x error) at a unit boundary [guard]

**R3a-rust-research-tape-archive** (8)

- `apps/api/src/services/day_tape/clocks.rs` (4) — Ticks outside the 04:00-20:00 ET Path-A window or off the 79 Path-B marks (including holidays) would be silently dropped or stored as extras. [data-write]
- `apps/api/src/services/research/mod.rs` (1) — The trader GET /api/scan/{symbol}/history could lose its degrade-honestly fallback, or the lab's strict read could quietly gain one and compute on degraded rows. [conformance:score-lab-signal-comparison]
- `apps/api/src/services/research/pairing.rs` (3) — Sample-to-outcome pairing could drop, duplicate or reorder rows, or re-drop score-less rows, corrupting every lab metric. [parser]
- `apps/api/src/services/research/scan_guards.rs` (3) — Adoption or verdict language, retention literals, n/a/NaN, or bare-zero absences could appear in any console or artifact string, for any fixture. [invariant:absent-is-not-none]
- `apps/api/src/services/session_chain_archive/archive.rs` (3) — Ring captures would not be copied into the session archive under the right ET identity, a non-archival as_of would be stored, or an archive failure would break the capture caller. [data-write]
- `apps/api/src/services/session_chain_archive/audit.rs` (6) — The production coverage audit could run against a disabled, misconfigured or unsupported store and certify coverage, or create, migrate or write archive state while auditing. [guard]
- `apps/api/src/services/session_chain_archive/body_store.rs` (5) — Archive bodies could overwrite each other (non-unique locator), fail a byte round-trip, be read outside the body root (path traversal), or be created at a default path. [data-write]
- `apps/api/src/services/session_chain_archive/et_date.rs` (5) — Books would be filed under the UTC date instead of the ET session date, epoch or seed identities mis-keyed, or a junk et_date accepted. [data-write]

**R3b-rust-flatfile-snapshot-capacity** (9)

- `apps/api/src/capacity/evaluate.rs` (6) — A real RSS/fd/task leak, or a malformed or unsupported resource sample, passes the extended soak gate instead of failing it. [guard]
- `apps/api/src/capacity/rest.rs` (1) — Workload clients keep loopback connections alive, which inflates measured fds/handles and turns the capacity gate red with no real defect. [repro]
- `apps/api/src/capacity/self_test.rs` (1) — Two self-test receipts written at the same time share a temp path, and one uploaded evidence receipt is torn or overwritten. [repro]
- `apps/api/src/services/capacity_harness/fixture.rs` (3) — The load gate silently runs on a toy book (syn_mini or under 1000 contracts) or falls back when the golden file is missing, so it measures nothing realistic. [guard]
- `apps/api/src/services/capacity_harness/identity.rs` (3) — Under load, the warm-HTTP score/tier/fingerprint drifts from the Path-B oracle and the identity check is vacuous or reads the wrong fields. [guard]
- `apps/api/src/services/chain_snapshot/filesystem.rs` (1) — A temp file left by a crash, or a prune tombstone, gets listed or loaded as a real chain snapshot. [data-write]
- `apps/api/src/services/flat_file_keep/extract.rs` (4) — The kept extract contains foreign symbols or the raw gzip body, or a bad header is stored as an empty extract. [parser]
- `apps/api/src/services/flat_file_keep/fs.rs` (3) — Kept extracts or miss sidecars are lost or misread on disk, a leftover temp file is listed as an occupant, or a miss is written next to a kept extract. [data-write]
- `apps/api/src/services/flat_file_keep/occupancy.rs` (11) — A day that is not elapsed, ineligible, not stored or refused shows as a miss or as present, so 'we don't know' collapses into 'nothing there'. [invariant:absent-is-not-none]

**R4a-rust-it-contracts-guardrails** (8)

- `apps/api/tests/archive_coverage_audit.rs` (9) — The archive-coverage audit reports PASS while session books are missing or unreadable, or mutates the archive it audits. [guard]
- `apps/api/tests/archive_coverage_guardrails.rs` (8) — A fixture/non-live occupant or a missing/unreadable book counts as present, so paid-data gaps in the research corpus go unnoticed. [invariant:present-is-live-paid-only]
- `apps/api/tests/grounding_isolation.rs` (4) — The AI recommendation grounds figures against data never sent, or an env flag enables a fabricating source, so untraceable numbers render as fact. [invariant:ai-asserted-numbers-are-traceable]
- `apps/api/tests/market_data_paused_no_vendor_contact.rs` (1) — With market data paused, a route still dials the vendor or answers something other than the exact paused 503. [conformance:no-vendor-production-posture]
- `apps/api/tests/postgres_release_safety_serve_target.rs` (2) — Railway pre-deploy cannot find the migration binary, or the standard serve target builds without Postgres (both shipped once). [repro]
- `apps/api/tests/recommendation_post_live_mode_llm_error_fallback.rs` (1) — In live mode, a bundle failure on POST /api/recommendation returns the paused 503 or a changed envelope instead of the 200 unavailable/llm_error the dashboard handles. [contract]
- `apps/api/tests/score_identity.rs` (3) — An additive feature silently changes opportunity_score, tier or state_fingerprint. [invariant:additive-keeps-score-byte-identical]
- `libs/quant-engine/tests/signals_characterization.rs` (2) — Signal scores, setups or fingerprints silently diverge from the reference implementation. [invariant:score-change-is-deliberate-and-measured]

**R4b-rust-it-capacity-capture-replay** (7)

- `apps/api/tests/capacity_load.rs` (1) — The hermetic capacity load regresses on thresholds, identity or the zero-vendor claim.
- `apps/api/tests/chain_archive_object_store.rs` (1) — Archived chain bodies are lost, overwritten by a racing second insert, reported missing when unreadable, or the legacy body_b64 index fails to migrate. [data-write]
- `apps/api/tests/chain_snapshot_capture.rs` (2) — Captured snapshots are not stored, purged too early or too late, carry secrets, or a failed write corrupts the ring. [data-write]
- `apps/api/tests/liquid_names_session_capture.rs` (2) — The liquid-name ensure pays for vendor fetches when a book is present or promotable, fails to archive the day's book, or runs on a weekend. [data-write]
- `apps/api/tests/massive_flat_file_keep.rs` (1) — Kept flat-file extracts are overwritten or misclassified, the research read loses its operator token, secrets leak, or a keep mints present/LiveMassive coverage. [data-write]
- `apps/api/tests/session_chain_archive.rs` (2) — The ring prune deletes durable session books, a later same-day capture overwrites the first, a failing archive breaks capture, or late-evening captures file under the next UTC date. [data-write]
- `apps/api/tests/session_day_tape_capture.rs` (4) — Tape capture drops ticks without a recorded gap, calls the vendor for Path-B, or a tape write failure stalls trader SSE or 5xxs the desk. [data-write]

**T1-tools-playwright** (12)

- `tools/free-ports.spec.mjs` (5) — ports:free misses an IPv6 listener or matches :28000 as :8000, so a stale dev server certifies an old build during verification. [repro]
- `tools/holiday-calendar-parity.spec.mjs` (3) — The shared XNYS calendar, the Rust holiday table and the scanner replica disagree, so a holiday counts as a session day in archive coverage (or the reverse). [invariant:present-is-live-paid-only]
- `apps/dashboard-e2e/tools/artifact-safety.spec.mjs` (pending) — Uploaded browser evidence (traces, screenshots) carries an Authorization header, a cookie, a real email or a production URL. [guard]
- `apps/dashboard-e2e/tools/readiness.spec.mjs` (pending) — An a11y, compat or visual scan runs against an empty, wrong or error page and passes vacuously. [invariant:a11y-gate-scans-both-schemes-and-overlays]
- `apps/dashboard-e2e/tools/real-negative-controls.spec.mjs` (pending) — The compat, a11y-readiness or visual gate cannot actually fail on a real poisoned run. [guard]
- `apps/dashboard-e2e/tools/summary.spec.mjs` (pending) — Browser-quality evidence with flaky or not-run tests, wrong counts, unknown keys, a changed artifact hash or a path escape is accepted as a pass. [guard]
- `tools/supply-chain/artifacts.spec.mjs` (pending) — A dashboard archive with traversal or symlinks, or an OCI image not bound to its verified manifest digest, is accepted as release evidence; raw Docker errors leak tokens. [guard]
- `tools/supply-chain/candidate.spec.mjs` (pending) — A toolchain candidate is qualified even though a check mutated package-lock, or HEAD vouches for itself. [guard]
- `tools/supply-chain/inventory.spec.mjs` (pending) — The SBOM omits a component, admits an alternate-registry or checksum-less package, or a Syft omission passes. [guard]
- `tools/supply-chain/toolchain.spec.mjs` (pending) — A toolchain binding is accepted with a mutated selector or patch, or without strict accepted-revision CI. [guard]
- `apps/dashboard-e2e/src/quality/compatibility.spec.ts` (15) — One of five critical journeys breaks in Chromium, Firefox or WebKit: navigation, degrade on stream loss, signed-out auth dialog, dense positions, dense scanner. [smoke]
- `apps/dashboard-e2e/src/quality/accessibility.spec.ts` (35) — A shipped surface or overlay ships a serious or critical axe violation, or a keyboard or zoom/reflow failure, in either colour scheme. [invariant:a11y-gate-scans-both-schemes-and-overlays]

## Floor gaps (behavior that can fail silently and costly, with no test today)

1. **Session idle/absolute expiry** — no test (break B2). Batch 100.
2. **Broker credential at rest** — nothing proves `set_broker_credential` stores only ciphertext and
   never echoes `app_secret` (`services/auth/service.rs:986-1035`; zero test hits for `app_secret`).
   Batch 100.
3. **Book PUT latest-wins** (`routes/book.rs:480-503`) and PUT 403/400 — untested; only GET 403 is.
   Batch 100.
4. **Paused `/api/price`** — absent from `market_data_paused_no_vendor_contact.rs:118-131`. Batch 100.
5. **Massive chain normalizer** (`infrastructure/massive/rest.rs:964`, `:1028`, `:878`) — zero tests;
   golden fixtures start after normalization. Batch 101.
6. **Score inputs without value pins** — 30-day HV (`hv.rs`), VWAP ±2σ bands that trigger scored setups
   (`vwap.rs`, `signals.rs:331-351`), dark-pool bonus cap (`signals.rs`; `dark-pool-context-only`
   unenforced). Batch 101.
7. **Research pairing horizon filter** (`research/pairing.rs:128`) — only the retired oracle is tested.
   Batch 102.
8. **Vacuous checks that look like protection:** three "no session-archive pollution" tests build a
   fresh archive that the code under test never sees (`session_day_replay.rs:705-749`,
   `session_day_tape_capture.rs:434-462`, `massive_flat_file_keep.rs:779-796`); the capacity
   connector-poison control can never fail (`capacity/self_test.rs:140-154`); four research "vendor
   call" counters have no writer; `classify_evidence` (the production path) is an untested copy of
   `classify_with`. Batch 102.
9. **Never-run guard proofs** — 17 supply-chain and 21 browser-quality tool spec files run nowhere;
   the live repo already fails `workflow-guard` (`apps/api/Dockerfile:mutable-image`) and three more
   kept guards are red (BASELINE §3). `assertArtifactSafe` has no caller, so CI uploads browser
   evidence unscanned. Batch 98.
10. **Postgres-only code that CI never runs:** `chain_snapshot_export_postgres.rs` (1 test; passed 1/1
    locally against a throwaway Postgres) and the Postgres arm of `archive_coverage_audit.rs:313-350`.
11. **Dashboard money:** `closePosition` realized P/L write (`usePortfolio.ts:516-537`), exact netted
    `netPl` / summed `capitalAtRisk` (regex-only today). Batch 103.
12. **Pages proxy** `functions/api/[[path]].ts` — the one edge boundary keeping operator endpoints off
    the public origin is "proven" only by 15 source-text regexes. Batch 103.
13. **Not a test gap, reported:** `/api/auth/*` is exempt from the only rate limiter
    (`middleware/rate_limit.rs:93-99`), so login guessing is unbounded. The capacity sampler is
    Linux/Windows only (`capacity/resources/mod.rs:24-40`), so `npm run capacity:baseline` cannot pass
    on this Mac. The Windows-only capacity normalization test (`runner.rs:1950`) runs in no CI job.
    `nyse_full_day` ends in 2032 with no failing test after that.

## UNSURE (kept; the question that settles each)

- `tools/postgres-release-receipt.spec.mjs` — is `postgres-release-receipt.mjs produce/validate` still a
  step of every Railway migration release (`DEPLOY_RUNBOOK.md:26-28`), or was it one-off GATE-S evidence?
- `tools/supply-chain/run-promoted-conformance.spec.mjs` (and `candidate.spec.mjs`, `toolchain.spec.mjs`)
  — will the Node 24.19.0 candidate qualification ever run again now that `.nvmrc` is 26.7.0?
- `pages/ticker/widgets/chrome/TickerHeader.faulted.spec.tsx` — does any test click the Ticker door
  (`open-sim-trade`) on a faulted store and prove no dialog mounts?
- `apps/api/tests/chain_snapshot_export_postgres.rs` — is the Postgres → filesystem export still an
  operator path? If yes, add it to the CI Postgres steps; if no, retire it with the exporter.
- Questions without a verdict change: is understating `capital_at_risk` when an unbounded position is
  open intended (`digest.ts:118-124`)? Is the uniform-mark realized P/L on a multi-leg close with an
  unpriced leg intended (`usePortfolio.ts:516-537`)? Can the cap verdict print `$null`
  (`CapAnnotation.tsx:52-65`)? Is the footer disclaimer a per-page legal requirement?

## Risks

- **Local typecheck can lie today.** `nx.json` `targetDefaults.typecheck.inputs` excludes specs, and a
  type error in `arc.spec.ts` replayed a cached green (exit 0) while the uncached run failed (exit 1,
  TS2322). CI is unaffected (cold cache). Fixed in batch 96.
- **Coverage drops where layout is the product:** retiring `no-overflow.spec.ts`,
  `PositionRow.a11y.spec.tsx` and `offlineLayout.spec.tsx` leaves `/positions` overflow at the `md`
  breakpoint unmeasured. The a11y gate keeps a 393 px reflow check (A11Y-B7).
- **Visual gate:** your ruling makes browser-quality guards floor; the audit rule calls pixel
  snapshots structure. Batch 22 (and the visual tooling in 6 and 21) waits for your ruling.
- **Flakes kept until their cause is fixed:** AC-35/U-32 (product race; the fix belongs in PR #76),
  `COVERAGE_VENDOR_CALLS` shared across three test modules with different locks
  (`research_session_coverage.rs:364`, `coverage/matrix.rs:1264`, `ensure_worker.rs:472`), fixed
  sleeps in `day_tape/path_a.rs` and `session_day_tape_capture.rs`, fake-timer leaks in
  `positions-page.spec.tsx:601` and `positions.integration.spec.tsx:475-526`.
- **Same-commit edits are mandatory** where a config or tool names a test: Playwright configs and the
  quality manifest, `apps/dashboard-e2e/tools/isolation.mjs`, `ci.yml:272`, `api-contract.mjs` (binds
  `http_parity_harness_observes_all_operations`, `normalizer_set_is_executable`, `boundary_evidence_*`),
  and `capacity_cli.rs:93-96` (needs `evidence_clap_flag_is_rejected` in `main.rs`, kept).

## CI plan (Phase 3; detail in BATCHES.md 91–95)

| Workflow | Class | Mode | Triggers after | Timeouts | Minutes/month now → after |
|---|---|---|---|---|---|
| `ci.yml` | ci | manual | `workflow_dispatch` (+`affected_only`) | frontend 37, backend 45, capacity 15 | 4,318 → ~376 at 8 dispatches (≈47 min each: frontend ~12, backend ~22, capacity 7, supply-chain call 6) |
| `supply-chain.yml` | ci (reusable) | **blocked** — guard pins push+cron | unchanged until ruled | 15 on all five jobs | 220 → ~224 (push ~200 + cron ~24); duplicate on push disappears with manual CI; ~0 if ruled manual |
| `conformance.yml` | ops (prod half) | unchanged (disabled) | `push: main`, daily cron, dispatch | optional 15 | 403 → 0 while disabled |
| `deploy-smoke.yml` | ops | unchanged (disabled) | `push: main`, dispatch | optional 15 | 14 → 0 while disabled |
| `browser-visual-linux-candidates.yml` | ops | unchanged | dispatch | optional 15 | 4 → on demand |

All jobs are `ubuntu-24.04`; raw minutes equal Linux-equivalent (pricing: Linux $0.006, Windows $0.010,
macOS $0.062 per minute; no Windows or macOS legs exist). Root-cause items: flake → product fix in
PR #76; upload noise → condition on the gate step; F-J → owner-ruled baseline. Owner commands after the
branch is merged (whether to resume is your call):

```
gh workflow enable ci.yml
gh workflow run ci.yml --ref main
```

## Nx plan (Phase 4; BATCHES.md 96)

Typecheck inputs to `default` (proven cache bug); `{"runtime":"node --version"}` in `sharedGlobals`;
`.spire` into `.nxignore` (drops the stray `tech` project); cacheable `api:test` with explicit Rust
inputs; capacity targets stay uncached; graph JSON and a cache-hit proof. No cycles today. No Nx Cloud
(none configured; remote caching needs an account — your decision). Docs read (nx_docs, nx 23):
`/docs/guides/tasks--caching/configure-inputs`, `/docs/reference/inputs`,
`/docs/guides/tasks--caching/configure-outputs`, `/docs/features/ci-features/affected`,
`/docs/guides/nx-cloud/setup-ci`.

## Verify plan (Phase 5; BATCHES.md 97–99)

`npm run verify` = `nx affected -t lint typecheck test` against `git merge-base HEAD origin/main` plus
the hermetic guard specs; target under 2 minutes, measured. Pre-push hook = affected lint + typecheck,
under 1 minute, committed as `tools/hooks/pre-push`; you install it with
`git config core.hooksPath tools/hooks` (no hook path or pre-push hook exists today). Fix
`run-gate.mjs` so it stops orphaning its Vite server.

## Batches

Full lists with files, counts and same-commit edits: [BATCHES.md](BATCHES.md).

| Batches | Phase | Kind |
|---|---|---|
| 1–9 | retire | risk-gone (T1 one-off tooling specs, lane fences, visual bookkeeping; `fixtures.spec.ts`; `score_lab.rs` module; `production_runtime_guardrails_receipts.rs`; `blog-tokens.spec.ts`; `StructureHistory.spec.tsx`) |
| 10–24 | retire | structure, one area each |
| 25–37 | retire | duplicate, one area each (**31 runs after 41**) |
| 38–83 | trim/consolidate | ≤8 files each; A7 (38–39) and R4a (40–42) first |
| 84–90 | speed-ups | typing cost, SSE keep-alive, capacity holds, fixtures, api-contract spawns |
| 91–95 | CI | manual mode + timeouts; repeated work; supply-chain timeouts (mode BLOCKED); ops listed; root causes (flake fix BLOCKED on PR #76) |
| 96 | Nx | inputs, `.nxignore`, Rust caching, graph |
| 97–99 | verify and hook | `npm run verify`; wire never-run guard proofs (+ fix their reds); pre-push hook, run-gate fix, README |
| 100–104 | new behavior tests | R1 auth, R2 money/parsers, Rust data writes, dashboard money/contracts, a11y gate proof |

**BLOCKED:** 6, 21, 22 (visual gate — your ruling); 93 mode/cron (workflow-guard floor pins);
95 flake fix (lives in PR #76). **Depends:** 31 after 41; R4a/R4b scan removals after 38–39.

## Trim ledger

| Batch | File | Cases before → after | Removed or merged (named in the commit) |
|---|---|---|---|
| 4 | `apps/api/src/services/research/score_lab.rs` (in-file test module; risk-gone) | 4 → 0 | removed: driver_attribution_runs_with_drivers, horizon_filter_ignores_other_horizons, pair_and_baseline_detects_positive_score_abs_lift, uncorrelated_scores_near_chance_auc |
| 18 | `apps/api/src/routes/recommendation.rs` (in-file test modules schema_tests, gate_schema_tests; structure) | 5 → 0 | removed: recommendation_schema_is_not_empty, export_egress_category_fixture_is_closed_and_exhaustive, gate_runtime_success_fixture_matches_closed_dto, recommendation_enum_conversions_match_into_responses, sim_trade_enum_conversions_match_into_responses |
| 19 | `apps/api/src/infrastructure/redis/price_cache.rs` (in-file test module; structure) | 1 → 0 | removed: memory_roundtrip |
| 20 | `apps/api/src/capacity/harness_app.rs` (in-file test module; structure) | 2 → 0 | removed: loader_rejects_invalid_fixture_root, loader_supports_dedicated_and_legacy_fixture_roots |
| 20 | `apps/api/src/services/capacity_harness/inject.rs` (in-file test module; structure) | 1 → 0 | removed: inject_publishes_changing_quotes |
| 24 | `apps/api/tests/capacity_isolation.rs` (same-commit edit for the retired capacity-gate spec) | 10 → 9 | removed: node_gate_contains_disposable_exit_propagation_mutations |
| 30 | `apps/api/src/routes/candidates.rs` (in-file test module response_conversion_tests; duplicate of tests/api_contract_parity.rs:436-472) | 1 → 0 | removed: candidates_success_and_failures_execute_typed_production_conversions |
| 30 | `apps/api/src/routes/contract.rs` (in-file test module response_conversion_tests; duplicate of tests/api_contract_parity.rs:474-506) | 2 → 0 | removed: contract_boundaries_convert_typed_query_and_app_error_variants, every_declared_contract_response_variant_has_its_own_status |
| 30 | `apps/api/src/routes/demo.rs` (in-file test module response_conversion_tests; duplicate of tests/api_contract_parity.rs:282-352) | 1 → 0 | removed: demo_boundary_converts_the_typed_html_variant |
| 30 | `apps/api/src/routes/market.rs` (in-file test module wire_schema_tests; duplicate of api:contract:check OpenAPI oracle and tests/api_contract_parity.rs:282-352) | 2 → 0 | removed: market_routes_convert_dto_successes_and_production_app_errors, market_wire_declares_every_runtime_bundle_and_signal_field |
| 30 | `apps/api/src/routes/ticker.rs` (in-file test module response_conversion_tests; duplicate of tests/api_contract_parity.rs:282-352 and tests/market_data_paused_no_vendor_contact.rs:118-160) | 4 → 0 | removed: declared_progressive_error_variants_preserve_distinct_statuses, paused_progressive_stream_answers_503_without_opening_sse, progressive_stream_success_uses_sse_and_errors_use_app_error, resolve_price_fast_uses_fixture_aware_quick_live_price |
| 30 | `apps/api/src/services/auth/grok_oauth.rs` (in-file test module tests; duplicate of services/auth/service.rs:1162 and :1424) | 1 → 0 | removed: grok_oauth_arm_is_unavailable_until_docs_verify |
| 32 | `apps/api/src/services/day_tape/literals.rs` (in-file test module tests; duplicate of services/day_tape/occupancy.rs:683-707) | 1 → 0 | removed: list_clock_closed_set_has_no_not_expected_before_storing |
| 32 | `apps/api/src/services/day_tape/mod.rs` (in-file test module poison_tests; duplicate of tests/session_day_tape_isolation.rs:130-195) | 2 → 0 | removed: day_tape_sources_forbid_archive_ring_and_watermark_tokens, occupancy_source_forbids_coverage_and_livemassive_arms |
| 38 | `apps/dashboard/src/app/app.risk.spec.tsx` (TRIM; structure) | 22 → 19 | removed: mobile nav drawer › carries EXACTLY the trader NAV entries, no /_ops link, aria-current on the active entry; mobile nav drawer › a drawer link navigates AND closes the drawer; shell persistence › the SAME shell DOM node survives every in-shell navigation |
| 38 | `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts` (TRIM + CONSOLIDATE carrier) | 16 → 19 | removed: does not add a trader page for batch replay or capture browse; route table and nav stay free of batch-replay / capture-browse paths; the block list matches INTERFACE standing rule 4; convexa.ts does not grow a batch-backtest or _research replay helper. Added: one it.each over FOLDED_TRADER_FORBIDDEN (7 rows: session-archive, research-envelope, liquid-names-session-capture, massive-flat-file-keep, replay-outcome-join, session-day-tape-capture, session-day-replay), folding the identifier needles of the 4 specs retired in this batch and of 3 batch-39 specs, each row with a poisoned-source proof |
| 38 | `apps/dashboard/src/app/curvature-v2-deny-list.structural.spec.ts` (TRIM; duplicate of npm run lint) | 4 → 2 | removed: the two ALLOWED auth modules are NOT banned; the glob is not vacuous and no shipped surface source imports a banned specifier |
| 38 | `apps/dashboard/src/app/curvature-v2-landing-and-site.structural.spec.ts` (TRIM; structure) | 25 → 3 | removed: 4 pure-checker cases, Arm A (9 byte-for-byte copy provenance cases), Arm A′ (2), Arm B (4 line-pinned clamp scans and mutation guard), Arm C (3); kept the 3 score-cap pins (DARK_POOL_BONUS_CAP 6, caps 40/25/25/10, the Max column) |
| 39 | `apps/dashboard/src/app/research-lab-surface.structural.spec.ts` (TRIM; duplicate/structure) | 10 → 2 | removed: Pages Function 404 for /api/_research unchanged; TopNav has no /_ops/research to: href; /lab still lab-index in app routes; convexa.ts has no research helper; allowlist skip is not vacuous; researchClient uses credentials omit and absolute URLs (kept at researchClient.spec.ts:39); mutation — poisoning allowlisted folder with getTicker would fail the scan; anti-vacuity — operator folder sources exist on disk. Kept case renamed to `glob sees the operator folder` (its path-scan-needle line dropped) |
| 39 | `apps/dashboard/src/app/route-boundaries.structural.spec.ts` (TRIM; structure) | 6 → 4 | removed: the catch-all is the LAST route in the shell group; RouteFallback no longer lives in app.tsx |
| 39 | `libs/api/src/lib/broker.spec.ts` (TRIM) | 6 → 5 | removed: deletes credentials idempotently |
| 39 | `libs/api/src/lib/contract-authority.spec.ts` (TRIM; duplicate of the kept poison-mutation case) | 7 → 2 | removed: keeps generated imports behind the shared facade; allows semantic facade classes and indexed generated component consumption; retains the native EventSource boundary for SSE lifecycle semantics; rejects parallel wire interfaces after indexed migration; keeps generated consumption centralized to the facade lanes |
| 39 | `libs/api/src/lib/convexa.spec.ts` (TRIM) | 31 → 28 | removed: generated optional availability boundary › keeps absent, null, and explicit false distinguishable; scanner client › getScan rejects with ApiError on a TRANSPORT fault; scanner client › getScanUniverse returns the read-only universe envelope |
| 40 | `apps/api/tests/api_contract_gate_isolation.rs` (TRIM; structure) | 8 → 4 | removed: production_runtime_isolation_has_no_generator_or_contract_artifacts, protected_quant_scoring_and_runtime_openapi_surface_remain_untouched, release_build_keeps_postgres_and_contract_check_is_before_it, router_integration_gate_requires_history_and_probe_inputs |
| 40 | `apps/api/tests/api_contract_parity.rs` (TRIM; structure/duplicate) | 232 → 215 | removed: baseline_pairs_are_present, boundary_matrix_is_exhaustive, every_operation_has_identity, every_operation_has_response, fallback_is_not_an_openapi_operation, html_surface_is_declared, legacy_ticker_query_fields_do_not_change_bundle_behavior, no_schema_less_json, ordinary_http_has_typed_responses, paths_are_unique_and_nonempty, response_conversion_registry_preserves_distinct_mapping_families, response_conversion_uses_route_owned_health_builder, response_conversion_uses_route_owned_success_builders, response_conversion_uses_shared_production_error_mappings, security_schemes_are_value_free, stream_media_is_event_stream, ticker_stream_media_is_event_stream; KEEP-PINNED cookie_and_gate_http_parity_flow_is_explicit byte-identical; orphaned fixture fixtures/api_contract/boundary-matrix.json deleted |
| 40 | `apps/api/tests/api_contract_policy.rs` (TRIM; structure (RECONCILIATION keeps 2)) | 5 → 2 | removed: required_nullable_optional_and_empty_remain_distinct, specialized_surface_and_risk_vocabularies_are_closed, typed_map_policy_refuses_unconstrained_json |
| 40 | `apps/api/tests/api_contract_router.rs` (TRIM; structure) | 7 → 3 | removed: contract_openapi_operation_ids_are_unique_and_specialized_boundaries_are_closed, exporter_has_no_runtime_dependencies, pure_openapi_export_is_byte_stable, runtime_and_openapi_are_built_from_one_registered_graph; kept router_integration_compile_probe_emits_execution_receipt (prep removed it) because npm run api:router-integration:compile-probe runs it by name — owner question in REPORT |
| 40 | `apps/api/tests/api_contract_runtime_auth_research.rs` (TRIM; duplicate) | 7 → 6 | removed: runtime_evidence_fragment_resolves_to_real_tests |
| 40 | `apps/api/tests/api_contract_runtime_market_stream.rs` (TRIM; duplicate) | 5 → 4 | removed: runtime_market_stream_fixture_is_schema_v2_and_non_vacuous |
| 40 | `apps/api/tests/archive_coverage_guardrails_isolation.rs` (TRIM; duplicate/structure) | 12 → 2 | removed: convexa_api_facade_has_no_coverage_helper, coverage_http_not_nested_on_metrics, list_load_framing_unchanged, no_live_badge_in_coverage_surfaces, operator_metrics_stages_unchanged, operator_token_shape_is_url_safe_base64_at_least_32_bytes, pages_404s_research_prefix_including_coverage, trader_dashboard_sources_have_no_coverage_chrome, worker_tick_skips_coverage_when_archive_disabled, write_skipped_warn_untouched |
| 40 | `apps/api/tests/archive_coverage_runtime.rs` (TRIM + CONSOLIDATE; duplicate) | 19 → 13 | removed: ensure_pass_completes_before_snapshot_is_published, invalid_calendar_domain_is_rejected_and_holiday_is_not_due, metrics_projection_source_rejects_request_time_work_poison, production_router_constructs_with_historical_gap_policy, protected_projection_remains_byte_identical_across_coverage_states, runtime_evaluation_is_read_only, valid_policy_and_calendar_allow_historical_gaps; merged valid_policy_and_calendar_allow_historical_gaps + invalid_calendar_domain_is_rejected_and_holiday_is_not_due into production_calendar_rejects_out_of_domain_dates_and_holidays_are_not_due |
| 41 | `apps/api/tests/candidate_isolation.rs` (TRIM; duplicate) | 5 → 4 | removed: the_match_key_constructor_takes_a_non_optional_right |
| 41 | `apps/api/tests/postgres_release_safety_isolation.rs` (TRIM; structure) | 6 → 4 | removed: migration_and_startup_paths_do_not_import_quant_scoring_gate_or_fingerprint, public_http_and_frontend_contract_paths_have_no_feature_diff |
| 41 | `apps/api/tests/postgres_release_safety_postgres.rs` (TRIM; structure; Postgres-gated) | 10 → 9 | removed: simultaneous_serve_port_pair_is_always_distinct (removal re-applied onto the batch 29a file) |
| 41 | `apps/api/tests/production_runtime_guardrails.rs` (TRIM; duplicate of src/runtime_guardrails/origins.rs:81-110 and config.rs:555-605) | 3 → 1 | removed: debug_only_missing_mode_defaults_dev, origins_are_https_exact_and_default_port_normalized |
| 41 | `apps/api/tests/production_runtime_guardrails_isolation.rs` (TRIM; duplicate) | 12 → 8 | removed: completed_guardrail_receipt_is_resolved_from_the_contract_archive, credential_failure_remains_outside_anonymous_market_and_stream_modules, metrics_auth_precedes_every_operator_state_read_and_guard_is_non_vacuous, runtime_guardrails_do_not_cross_into_quant_math_and_guard_is_non_vacuous |
| 41 | `apps/api/tests/research_isolation.rs` (TRIM; structure) | 5 → 3 | removed: get_structure_history_route_still_calls_the_shared_fallback_read, quant_engine_carries_no_reference_to_research_at_all |
| 41 | `libs/quant-engine/tests/golden.rs` (CONSOLIDATE; duplicate) | 3 → 2 | removed: exact_parity_set_spy_qqq_nvda, golden_fixtures_if_present; merged into golden_fixtures_match_reference_and_canonical_exact_set_is_required, which hard-asserts the canonical SPY/QQQ/NVDA exact set (soft skips removed; proved: without gex_NVDA.json it panics at :376) |
| 41 | `libs/quant-engine/tests/scalar_gex.rs` (TRIM; duplicate) | 8 → 6 | removed: dte_window_shapes_gex_only, spot_gamma_formula_single_call; MOVE: full-chain total_volume Some(20.0) and the with_dte_window(Some(0.0), Some(30.0)) row added to src/gex.rs dte_window_excludes_far_contracts_from_gex_not_pcr |
| 31 | `libs/quant-engine/src/max_pain.rs` (in-file test module tests; duplicate of tests/scalar_gex.rs:107-175 and the golden exact max_pain + expiration on 3 real chains, golden.rs:261-266, now hard-asserted by batch 41) | 4 → 0 | removed: max_pain_simple, prefers_monthly_opex, third_friday_is_monthly, weekly_not_monthly |
| 42 | `apps/api/tests/production_runtime_guardrails_postgres.rs` (TRIM; structure; Postgres-gated) | 2 → 1 | removed: postgres_harness_runtime_supports_production_blocking_adapters (tokio flavor / block_in_place is framework behavior; its ordering assert is true by definition, since the bound is timeout + 2 s); unused import POSTGRES_ACQUIRE_TIMEOUT dropped |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.reasoning.spec.tsx` (TRIM; structure) | 10 → 1 | removed 9 cases, merged/renamed into 0; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx` (TRIM; structure) | 21 → 5 | removed 16 cases, merged/renamed into 0; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx` (TRIM; structure (RECONCILIATION keeps :291, renamed)) | 28 → 8 | removed 21 cases, merged/renamed into 1; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/NumbersSaidStrip.spec.tsx` (CONSOLIDATE; duplicate (one it.each, 3 rows)) | 9 → 3 | removed 9 cases, merged/renamed into 3; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/StateExportDrawer.spec.tsx` (TRIM + CONSOLIDATE; structure) | 8 → 6 | removed 4 cases, merged/renamed into 2; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx` (CONSOLIDATE; duplicate (one it.each, 3 rows)) | 20 → 3 | removed 20 cases, merged/renamed into 3; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.grounding.spec.tsx` (TRIM; duplicate (5 MOVE cases kept until batch 44's cardGroundingLine table)) | 32 → 8 | removed 25 cases, merged/renamed into 1; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 43 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx` (TRIM + CONSOLIDATE; duplicate) | 73 → 25 | removed 52 cases, merged/renamed into 4; every removed title is listed in the batch 43 commit message (areas/A1-ticker-ai-rec.md NOTES) |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.grounding.spec.tsx` (MOVE out; 4 cases now rows of literals.spec.ts cardGroundingLine; AC-29 (:592 orig) kept as the render-level proof) | 8 → 4 | removed 4 cases, merged/renamed into 0; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/bannedWords.scan.spec.ts` (TRIM; duplicate) | 6 → 5 | removed 1 cases, merged/renamed into 0; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts` (TRIM; structure) | 8 → 3 | removed 5 cases, merged/renamed into 0; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts` (TRIM; duplicate) | 8 → 4 | removed 4 cases, merged/renamed into 0; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/literals.spec.ts` (CONSOLIDATE; duplicate; adds the cardGroundingLine table (MOVE in)) | 53 → 33 | removed 26 cases, merged/renamed into 6; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planLiterals.spec.ts` (TRIM; duplicate) | 7 → 6 | removed 1 cases, merged/renamed into 0; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts` (CONSOLIDATE; structure) | 8 → 1 | removed 8 cases, merged/renamed into 1; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts` (CONSOLIDATE; duplicate) | 32 → 26 | removed 7 cases, merged/renamed into 1; every removed title is listed in the batch 44 commit message |
| 44 | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.render.spec.tsx` (TRIM; structure) | 36 → 2 | removed 35 cases, merged/renamed into 1; every removed title is listed in the batch 44 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.spec.ts` (TRIM; duplicate) | 13 → 7 | removed 6 cases, merged/renamed into 0; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/single-name-caveat.spec.tsx` (TRIM; duplicate) | 8 → 6 | removed 3 cases, merged/renamed into 1; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/ticker-desk-composition.spec.tsx` (TRIM; structure) | 10 → 4 | removed 6 cases, merged/renamed into 0; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/ticker-invariants.spec.tsx` (TRIM; duplicate) | 2 → 1 | removed 1 cases, merged/renamed into 0; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/ticker.risk.spec.tsx` (TRIM; structure) | 21 → 11 | removed 10 cases, merged/renamed into 0; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/connection/ConnectionChip.spec.tsx` (TRIM + CONSOLIDATE; structure) | 19 → 3 | removed 18 cases, merged/renamed into 2; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/connection/connectionState.spec.ts` (TRIM; structure) | 13 → 10 | removed 3 cases, merged/renamed into 0; every removed title is listed in the batch 45 commit message |
| 45 | `apps/dashboard/src/app/pages/ticker/recentTickers/store.spec.ts` (TRIM; structure) | 8 → 3 | removed 5 cases, merged/renamed into 0; every removed title is listed in the batch 45 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/quiet-band.register.spec.tsx` (TRIM; structure) | 12 → 3 | removed 9 cases, renamed 0 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.spec.tsx` (TRIM; structure) | 22 → 11 | removed 11 cases, renamed 0 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/_kit/TintChip.spec.tsx` (TRIM; structure) | 6 → 1 | removed 5 cases, renamed 0 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.spec.ts` (TRIM; structure) | 21 → 18 | removed 3 cases, renamed 0 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/_kit/distanceToLevel.spec.ts` (TRIM; duplicate) | 7 → 6 | removed 1 cases, renamed 0 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx` (TRIM; duplicate) | 29 → 3 | removed 26 cases, renamed 0 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx` (TRIM; structure; owner ruling keeps the 3 F-D canvas cases) | 11 → 5 | removed 8 cases, renamed 2 (describe renames); every removed title is listed in the batch 46 commit message |
| 46 | `apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.liveStatus.spec.ts` (TRIM; duplicate) | 4 → 1 | removed 4 cases, renamed 1 (describe renames); every removed title is listed in the batch 46 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx` (TRIM; structure) | 2 → 1 | removed 2 cases, merged/renamed into 1; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.spec.tsx` (TRIM; duplicate) | 5 → 4 | removed 1 cases, merged/renamed into 0; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.spec.tsx` (TRIM; risk-gone (widget unmounted); one loop over an 8-row table) | 14 → 1 | removed 14 cases, merged/renamed into 1; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/LadderFoot.spec.tsx` (TRIM; structure) | 5 → 3 | removed 2 cases, merged/renamed into 0; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/ladderModel.spec.ts` (TRIM; structure) | 23 → 12 | removed 14 cases, merged/renamed into 3; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx` (TRIM; structure) | 17 → 7 | removed 11 cases, merged/renamed into 1; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.spec.tsx` (TRIM; duplicate) | 11 → 10 | removed 1 cases, merged/renamed into 0; every removed title is listed in the batch 47 commit message |
| 47 | `apps/dashboard/src/app/pages/ticker/widgets/read-strip/readStripModel.spec.ts` (TRIM; structure) | 31 → 19 | removed 13 cases, merged/renamed into 1; every removed title is listed in the batch 47 commit message |
