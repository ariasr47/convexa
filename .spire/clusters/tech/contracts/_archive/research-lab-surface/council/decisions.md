# research-lab-surface — council decisions

R3 input: `council/conflicts.json` (13 conflicts, quotes machine-verified, 8 product / 5 technical, 2 self-revisions).

## Self-revisions (folded; not human, not a re-spawn)

- Architect withdraws paid-book JSON export (metrics Export is not a paid-chain precedent).
- Architect withdraws `sessionStorage` for token/origin (plaintext secret-at-rest; contradicts reload-reask).
- PM withdraws “same class of access as operator metrics” (relative `/api/_research` on Pages is a 404; weekly list/open needs a runtime non-Pages API origin + metrics token).

## Unanimous / conductor folds (no exchange)

- Operator URL-only, off `AppShell`, unlinked. Not `/lab` (instrument demos). Not `/_ops/metrics` retrofit.
- Pages trader origin still 404s `/api/_research`. No Function proxy hole.
- Metrics token is the gate; trader cookie is not. Token never in query string, copy, logs, or aria.
- Reload re-asks (page memory only). No `localStorage` / `sessionStorage`.
- `NO_BACKEND_CHANGE`. Empty `apps/api` product diff. `Authorizes: nothing`.
- Tape / snapshots / flat-file extracts **out** of v1 chrome. No unified “status” column. Books table never grows `present` / `kept`.
- Coverage `present` = loadable `LiveMassive` only; never mint `present` from list `source`.
- No download/export of a loaded book this slice.
- TopNav stays the trader set.

## Human product rulings

- **2026-08-31 coverage this slice — A.** Conflicts `631e0c48…`, `08b87c5a…`, `b5ac2c09…`, `2d8c5c58…`.
  v1 on `/_ops/research` is session-books list+digest **plus** one **partitioned** coverage card
  (existing coverage GET, server-default date). Coverage speaks only its closed deck
  (`present` | `missing` | `unreadable` | `not yet due` | `blocked occupancy`); `present` is a
  loadable `LiveMassive` body only. Books table prints `source` verbatim and **never** grows a
  `present` / `kept` column. Do not mint coverage cells from list `source`. Tape / snapshots /
  flat-files stay out. Local matrix is `Evidence: this process`, not hosted/CI coverage. No CLI
  `[PASS]` line on this screen.

## Technical exchanges (one round)

- **Verify-by dump/sibling absence — pm ↔ ux (`342bae92…`). CONVERGED.** `test`: dump-absence (no `market.contracts` / OHLC / tape rows on open; GATE Q needs a dump-capable planted body) and sibling-vehicle absence (no tape / snapshot / extract tables). `review`: in-flight standing, not-naming-Lab, motion/theme tokens, exact coverage English. Coverage card is In (ruling A), not an absence target. Unified status column still `test`.
- **Origin transport — architect ↔ ux. CONVERGED.** Sitting `API origin` is a runtime public URL in tab memory beside the metrics token (not baked, not durable, not a secret, not in the query). Research GETs are `absoluteBase + existing path`; relative `/api/_research` is poison. Reject `*.pages.dev` as research **base**. Origin-blocked is a property of that base / request URL, not of the dashboard `location.host`. Distinct arms: empty origin, Pages host, Pages/research-family 404, relative-404, CORS, 401 — none collapse to empty-list. Load JSON 404 `no_session_book` is load-miss, not origin-blocked. Production CORS exact-matches `ALLOWED_BROWSER_ORIGINS`; live Railway lists `https://convexa.pages.dev` and already allows `Authorization` / `x-metrics-token`. Preview/custom SPA hosts are not members (ops allowlist, not a Function hole). UX: visible `API origin` field + `Metrics token`; `origin-rejected` / `origin-blocked` first-class vs `metrics_unauthorized`, empty-list, `Coverage readout unavailable.`, `Session archive readout unavailable.` Coverage GET only after origin is committed and not rejected/blocked.
- sessionStorage / export: folded above, no spawn.

## Pending human product rulings

- none
