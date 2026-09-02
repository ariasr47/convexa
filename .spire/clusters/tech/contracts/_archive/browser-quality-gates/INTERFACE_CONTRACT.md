# browser-quality-gates — interface contract

**Status:** draft

`NO_BACKEND_CHANGE`

This feature adds no FE↔BE surface. Owner rulings D7 and D8 authorize only narrow product accessibility repairs to existing rendered semantics, local contrast, the Settings ticker input's programmatic name, skip-link and auth-dialog focus handoff, coherent Scanner-card link semantics, valid position-sparkline help semantics, and focus-scroll reachability for three existing Positions controls at proven Chromium page scale 2, plus correction of the cold-error oracle to the status-derived `API error 503` the existing client already emits. None of those changes adds, modifies, removes, or reclassifies an endpoint, request field, response field, authentication requirement, status code, or streaming behavior.

Browser-quality scenarios intercept the dashboard's application network boundary with deterministic test fixtures and must fail on unexpected `/api` or SSE traffic rather than reach a live service. Execution-discovered fixture repairs—Scanner SSE event shape, seeded-book preservation, consistent anonymous session, 15-second watchdog timing, and isolated zoom proof—remain test-tooling behavior. The D8 Scanner-card, Ticker/Positions contrast, sparkline, focus-restoration, and focus-scroll changes consume no new response field and trigger no new request. In particular, contrast-only edits to `features/trading/positions/PositionsPanel.tsx` for `[data-testid="positions-disclosure"]` and `features/trading/outcomes/TrackRecordSection.tsx` for `[data-testid^="tr-family-empty-"]`, plus their co-located tests, remain presentation evidence only; the bounded visual-viewport-aware focus-scroll seam for the three already named Positions controls remains client-only focus accommodation. They may mirror existing application inputs but cannot redefine the production interface or justify a backend change.

Existing production endpoint contracts remain authoritative where fixture shapes mirror application behavior:

- `.spire/clusters/tech/state/conformance/public-surface.json`
- `.spire/clusters/tech/state/conformance/scanner.json`
- `.spire/clusters/tech/state/conformance/auth-gated.json`

Those existing files are references only; this frontend delivery feature does not restate their fields or require live endpoint execution.

## Conformance spec

```json
{
  "endpoints": []
}
```

The empty endpoint set is intentional and machine-checkable: conformance for this feature is that no backend contract is introduced. Runtime browser scenarios validate their synthetic fixture boundary under `SPEC.md`; they are not live API conformance tests.
