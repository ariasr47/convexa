```json
{
  "role": "ux",
  "exchange": "pm",
  "conflict_id": "68809cec4cf21311bcedbd98192a02383852ffcfc57cf4ba1fcf0dffcf4afb80",
  "converged": true,
  "withdrawn": [],
  "quote": "**`review` owns** command discoverability/naming (AC-20), absence of trader UI (AC-29), and non-absorption of tape/object-store/monitor/volume (AC-35).",
  "resolution": "Split Verify-by by silent-regression risk (spire-tech-risk-based-verify). Naming and program non-absorption stay review. Trader-chrome absence, Pages 404, and `/_ops/metrics` non-render are test. PM AC-29 may remain review only as the visible product non-choice (no named dashboard route was chosen); it does not replace the silence tests. D1 16:00 ET and D2 one date D untouched. No DOM harness. Hollow “renders without throw” does not satisfy the test marks.",
  "spec_section_3": [
    {
      "fold": "PM AC-20",
      "criterion": "A named archive-coverage audit command is listed with the API crate’s existing research commands; the name reads as coverage/audit of session books, not as fetch, backfill, or score-lab.",
      "verify_by": "review",
      "why": "Visible, intentional naming on the runner."
    },
    {
      "fold": "PM AC-35",
      "criterion": "This ship does not add tape capture, object-storage migration, a paid monitor, or volume-threshold runbook automation.",
      "verify_by": "review",
      "why": "Scope-honesty; a whole extra program is noticed on a normal pass."
    },
    {
      "fold": "PM AC-29 (remainder only)",
      "criterion": "No new named trader dashboard route or screen was chosen this slice. SPEC §4 carries NO_UI_CHANGE; no DESIGN_SYSTEM.md amendment.",
      "verify_by": "review",
      "why": "Product non-choice is visible. This row does not certify trader-chrome absence, Pages 404, or `/_ops/metrics` non-render."
    },
    {
      "fold": "UX AC-U1",
      "criterion": "apps/dashboard trader surfaces gain no new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, tooltip, or toast mentioning session-archive coverage, missing SPY/QQQ/IWM books, or this audit command.",
      "verify_by": "test",
      "why": "Toast / Ask-AI / nav insert can land without a named new screen; review of AC-29 will miss it. Structural empty-diff / copy-table scan; no DOM harness."
    },
    {
      "fold": "UX AC-U2",
      "criterion": "Trader empty / error / offline / `unavailable this cycle` / `—` copy is byte-unchanged by coverage derive, warnings, CLI pass/fail, missing books, or unreadable books.",
      "verify_by": "test",
      "why": "Byte-identity of trader chrome is negative space; silently regresses."
    },
    {
      "fold": "UX AC-U3 (with PM AC-30, already test)",
      "criterion": "Pages trader origin still 404s `/api/_research` and `/api/_metrics` (and subpaths), including any coverage sibling under those prefixes. Coverage is not proxied to the trader origin.",
      "verify_by": "test",
      "why": "A Pages proxy regression is invisible on a dashboard-route review."
    },
    {
      "fold": "UX AC-U4",
      "criterion": "`/_ops/metrics` gains no coverage matrix, coverage chip, or stage named from this feature. If coverage JSON rides `_metrics`, the existing page does not render it as p50/p95/headroom/`—`.",
      "verify_by": "test",
      "why": "Unlinked OperatorMetrics can grow a coverage widget while AC-29 “no new screen” still looks true. Closed stage-set assertion; unknown JSON stays unrendered."
    }
  ],
  "still_open": []
}
```
