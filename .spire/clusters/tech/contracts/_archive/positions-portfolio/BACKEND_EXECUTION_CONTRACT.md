# BACKEND EXECUTION CONTRACT — Positions Portfolio

**`NO_BACKEND_CHANGE`.** Backend is unchanged: the Simulated portfolio is FE-only and consumes the
existing interface (`GET /api/contract/{ticker}` + the SSE `LiveUpdate`; see INTERFACE_CONTRACT). No
new endpoint, no new payload field, no `position_eval` change (Q-G keeps it single-position). No
backend build, no migration, no test work in this lane. `signals` / `opportunity_score` /
`opportunity_tier` / `state_fingerprint` stay byte-identical.
</content>
