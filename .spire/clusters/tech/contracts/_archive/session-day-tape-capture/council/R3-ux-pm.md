# R3 — ux ↔ pm

Conflict `5380f8da4ad619b65438d35cd37a10c5f6865b5f28304c948c138c741a4a0bb7` only.
One exchange. Stay in UX lane. D1 (Path-A keep-set) and D2 (Path-A window) untouched.
Occupancy literals, Path-B marks, and tape enablement are not this pair.

**Quote contradicted:** "**`review` owns** absence of trader UI (AC-27), no S3 ingest (AC-37), and non-absorption of lab UI / body-move / watchlist expansion (AC-38)."

## Converged

Split Verify-by by silent-regression risk (`spire-tech-risk-based-verify`). Same fold as shipped `archive-coverage-guardrails` (`68809cec…` → SPEC AC-38 review remainder vs AC-39–42 test): trader-chrome absence, Pages 404 of `_research`/`_metrics`, and `/_ops/metrics` non-render are **`test`**. “No dashboard route chosen” / SPEC §4 `NO_UI_CHANGE` **may stay `review`** and **does not replace** those tests.

I withdraw the demand that PM **AC-27 as a single row** must itself flip to `test`. AC-27 as written (“No trader-facing route, nav item, or screen is added or changed”) is the chrome criterion, not a product non-choice. Leaving that whole sentence on `review` lets a toast, Ask-AI line, LiveTape caption, Settings copy, OperatorMetrics card, or Pages proxy land with no new named screen — GATE Q would have no rejecting path. The visible remainder (no named dashboard route was chosen; SPEC §4 `NO_UI_CHANGE`; no `DESIGN_SYSTEM.md` amendment) may stay `review`. That remainder **does not certify** trader-chrome absence, Pages 404, or `/_ops/metrics` non-render.

AC-37 (no S3 ingest) and AC-38 (no lab UI / body-move / watchlist expansion) stay **`review`**, as UX R2 already left them. A silent widget is AC-U1, not AC-38.

No DOM harness. Hollow “renders without throw” does **not** satisfy the `test` marks. Prefer **one** GATE Q structural pass: empty-diff / copy-table scan on `apps/dashboard` + Pages 404 non-regression + OperatorMetrics closed stage set — not one-test-per-AC.

### SPEC §3 fold — `test`

| Fold | Criterion | Why `test` |
|---|---|---|
| UX **AC-U1** (chrome half of PM AC-27) | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy, Ask-AI line, Ticker/LiveTape/Scanner/Positions/Landing affordance, tooltip, or toast mentioning session day tape, Path-A ticks, Path-B snapshots, “saved Tuesday”, or playback. | Toast / Ask-AI / nav / LiveTape insert can land without a named new screen; review of “no route chosen” will miss it. Structural empty-diff / copy-table scan. |
| UX **AC-U2** | Trader empty / error / offline / `unavailable this cycle` / `—` / LiveTape copy is **byte-unchanged** by tape persist success, persist skip, list, load, not-storing, or unreadable. Live ticks do not dim or blank because the sidecar ran or skipped. | Byte-identity of trader chrome is negative space; silently regresses. |
| UX **AC-U3** | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including any tape sibling under those prefixes. Tape is not proxied to the trader origin. | A Pages proxy regression is invisible on a dashboard-route review. |
| UX **AC-U4** | `/_ops/metrics` gains **no** tape matrix, tape chip, Path-A/B counts, or stage named from this feature. If tape JSON rides `_metrics`, the existing page does **not** render it as p50/p95/headroom/`—`. | Unlinked OperatorMetrics can grow a tape widget while “no new screen” still looks true. Closed stage-set assertion; unknown JSON stays unrendered. |
| UX **AC-U31** | Trader-consumed `@convexa/api` / dashboard code does **not** grow a tape list/load operation used by Landing/Ticker/Positions/Scanner/Settings/Ask-AI. OpenAPI churn, if any, stays unconsumed on the trader path. | Client consumption can ship with no new route. |
| PM **AC-28** | Trader origin cannot obtain a tape list or tape body (refused the same way existing operator/research diagnostics are refused on that origin). | Already `test`; keep. Does not replace AC-U3. |
| PM **AC-29** | When an operator token is required, a tape read without it is refused and returns no tape body. | Already `test`; keep. |
| PM **AC-30** | No trader-facing product path redistributes stored ticks or structure snapshots as a market-data feed. | Already `test`; keep. |
| PM **AC-36** | This ship does not play a stored day into the ticker page or the live stream. | Already `test`; keep. |

### SPEC §3 fold — `review`

| Fold | Criterion | Why `review` |
|---|---|---|
| PM **AC-27 remainder only** | No new **named** trader dashboard route or screen was chosen this slice. SPEC §4 carries `NO_UI_CHANGE`; no `DESIGN_SYSTEM.md` amendment. **This row does not certify** trader-chrome absence, Pages 404, or `/_ops/metrics` non-render. | Product non-choice is visible. Must not replace AC-U1–U4 / U31. |
| UX **AC-U25** | SPEC §4 carries `NO_UI_CHANGE`; no `DESIGN_SYSTEM.md` amendment; no new tokens/components/patterns/motion. | Fold with AC-27 remainder. Do not double-count as chrome absence. |
| PM **AC-37** | This ship does not download or ingest S3 flat files. | Whole-program non-absorption; noticed on a normal pass. |
| PM **AC-38** | This ship does not add a trader/operator lab UI, move session-archive bodies, or expand the watchlist beyond SPY, QQQ, IWM. | Scope-honesty for culled/parked harvest items. A silent widget is AC-U1. |
| UX **AC-U26** | Standing-block wording, is/is-not block, glossary sentences, and banned-term table are the approved copy. | Intentional copy. |
| UX **AC-U27** | Operator can list/load tape **without** the trader UI (CLI and/or Railway-direct operator GET). | Positive operator-path existence; not the silence tests. |
| UX **AC-U28** / **U29** / **U30** | Skip/empty copy does not assert dollar loss; license one-liner present; loading copy names a session-day-tape read. | Intentional copy. |

Synthesizer: do **not** keep PM AC-27’s current sentence as a single `review` row. Split it the way archive-coverage split AC-29 → SPEC AC-38 (`review` remainder) + AC-39–42 (`test` silence).

## Still split

None on Verify-by. This pair does not reopen D1, D2, D3, or occupancy print.
