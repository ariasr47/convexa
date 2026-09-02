# R3 — pm ↔ ux

One exchange. Conflict `5380f8da4ad619b65438d35cd37a10c5f6865b5f28304c948c138c741a4a0bb7` only
(Verify-by marks). D1 (Path-A quote keep-set) and D2 (Path-A extended-hours window) are not this
exchange and are not reopened.

**Quote I withdraw the AC-27 half of:** “**`review` owns** absence of trader UI (AC-27), no S3
ingest (AC-37), and non-absorption of lab UI / body-move / watchlist expansion (AC-38).”

I accept UX’s split, with the archive-coverage remainder so a review of “no named screen” cannot
stand in for trader silence.

## Converged

Absence of a trader route, nav item, Settings line, Ask-AI mention, Ticker/LiveTape caption, toast,
Pages proxy, or `/_ops/metrics` tape card is **negative space**. It can land while a reviewer still
sees “no new screen.” Marking original AC-27 `review` assumed the claim under test and left GATE Q
with no rejecting path for a helpful widget. That is silent-regression risk
(`spire-tech-risk-based-verify`): automate when a human would miss it on a normal pass.

S3 ingest and absorbing lab UI / body-move / watchlist expansion remain whole extra programs. A
human notices those on a normal pass. Standing-block prose, glossary, and the SPEC §4
`NO_UI_CHANGE` declaration stay intentional copy / product non-choice.

**Binding Verify-by for synthesis** (fold UX ship-blocking silence rows; do not replace them with
the AC-27 remainder):

| Fold | Observable | Verify by | Why |
|---|---|---|---|
| PM AC-27 **remainder only** | No new named trader dashboard route or screen was chosen this slice. SPEC §4 carries `NO_UI_CHANGE`. This row does **not** certify trader-chrome absence, Pages 404, or `/_ops/metrics` non-render. | review | Visible product non-choice. Same remainder as archive-coverage: it does not replace the silence tests. |
| UX AC-U1 (replaces original AC-27 silence claim) **(SB)** | Trader surfaces gain no new route, nav item, Settings copy, Ask-AI line, Ticker / LiveTape / Scanner / Positions / Landing affordance, tooltip, or toast mentioning session day tape, Path-A ticks, Path-B snapshots, “saved Tuesday,” or playback. | test | Toast / Ask-AI / nav / LiveTape caption can land with no named new screen. Structural empty-diff / copy-table scan. |
| UX AC-U2 **(SB)** | Trader empty / error / offline / `unavailable this cycle` / `—` / LiveTape copy is byte-unchanged by tape persist success, persist skip, list, load, not-storing, or unreadable. Live ticks do not dim or blank because the sidecar ran or skipped. | test | Byte-identity of trader chrome is negative space. PM AC-25 (live ticks not blanked because capture is running) stays `test` and does not absorb this copy-table row. |
| UX AC-U3 **(SB)** | Pages trader origin still 404s `_research` and `_metrics` (and subpaths), including any tape sibling under those prefixes. Tape is not proxied to the trader origin. | test | A trader-origin proxy regression is invisible on a “no dashboard route” review. PM AC-28 (trader origin cannot obtain a tape list or body) stays `test` and is not a substitute for this prefix 404. |
| UX AC-U4 **(SB)** | `/_ops/metrics` gains no tape matrix, tape chip, Path-A/B counts, or stage named from this feature. If tape JSON rides an existing operator diagnostic, that page does not render it as latency / headroom / `—`. | test | An unlinked metrics page can grow a tape widget while “no new screen” still looks true. Closed stage-set assertion; unknown JSON stays unrendered. |
| UX AC-U31 **(SB)** | Trader-consumed client / trader surfaces do not grow a tape list/load used by Landing, Ticker, Positions, Scanner, Settings, or Ask-AI. Operator tape read stays unconsumed on the trader path. | test | A client operation can ship without a named route. PM AC-30 (no trader-facing redistribution of stored ticks/snapshots as a market-data feed) stays `test` and does not absorb this. |
| PM AC-37 **(SB)** | This ship does not download or ingest S3 flat files. | review | Whole extra program; noticed on a normal pass. Unchanged. |
| PM AC-38 | This ship does not add a trader/operator lab UI, move session-archive bodies, or expand the watchlist beyond SPY, QQQ, IWM. | review | Scope-honesty / non-absorption. Unchanged. |
| UX AC-U25 | SPEC §4 carries `NO_UI_CHANGE`; no design-system amendment; no new tokens / components / patterns / motion. | review | Intentional canon declaration. Does not replace AC-U1–U4 / U31. |
| UX AC-U26 / U28 / U29 / U30 | Standing-block wording, is/is-not, glossary, banned-term table; skip/empty copy not claiming dollar loss or completeness; license one-liner; loading phrasing. | review | Intentional copy. Unchanged from UX. |
| UX AC-U27 | Operator can list/load tape without the trader UI. | review | Positive operator path is visible. Not a silence test. |

**Already `test` and not reopened:** PM AC-25 (live ticks not blanked), AC-28 (trader origin
refused), AC-30 (no redistribution as a feed), AC-36 (no playback this slice).

**GATE Q method.** One structural empty-diff / copy-table scan, plus Pages 404 non-regression, plus
`/_ops/metrics` closed-stage assertion. Not one-test-per-AC. No DOM harness. Hollow “renders
without throw” does not satisfy the `test` marks.

**AC-27 remainder, restated for synthesis**

> No new named trader dashboard route or screen was chosen this slice. SPEC §4 carries
> `NO_UI_CHANGE`. This row does not certify trader-chrome absence, Pages 404 of `_research` /
> `_metrics`, or `/_ops/metrics` non-render. **Verify by: review.**

Original AC-27 (“No trader-facing route, nav item, or screen is added or changed”) is **not**
kept as a `review` silence row. That observable travels with UX AC-U1 as `test`.

## Still split

None. Verify-by marks for trader-chrome absence, Pages 404, `/_ops/metrics` non-render, S3, and
non-absorption are settled. Nothing here needs a product card.
