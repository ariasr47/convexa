# chain-snapshot-capture — R3 decisions

Source: `council/conflicts.json` (11 conflicts, 11/11 quotes verified).

## Folded — technical (voices converged, no human call)

### T1 — AC-15 is a test, not a review
- **Conflict id:** `200df8d4…` (ux vs pm)
- **Ruling:** AC-15 (no capture chrome on trader routes) is `Verify by: test` — structural empty-diff / no capture affordance. AC-23 (operator path exists without trader UI) may stay `review`.
- **Settled by:** R3 PM + UX exchange.

### T2 — One miss string
- **Conflict id:** `8c938b8b…` (ux vs pm)
- **Ruling:** Operator-visible miss binds to closed `no stored snapshot for <SYMBOL>`. Drop competing “none for this ticker.” Meaning (absent store ≠ empty chain; no Massive fill-in) unchanged.
- **Settled by:** R3 PM + UX exchange.

### T3 — Who names research-read transport
- **Conflict id:** `5e9322d5…` (ux vs architect)
- **Ruling:** Architect names domain facts (symbol, as_of, store hit/miss/error; no Massive on load/list). Interface at R4 names transport/bytes. UX binds framing and states only over those facts. Architect retracts “UX / Interface will name transport.”
- **Settled by:** R3 Architect + UX exchange.

## Default-with-veto (reversible — owner may override)

### D-ret — Dual retention bound
- **Conflicts:** `ccc9fc0a…` · `0ff23844…` · `66ce89ed…` (partial)
- **Ruling:** Retention is **max-age AND per-symbol count cap**, never latest-wins collapse, never count-only with no age, never age-only with unbounded same-day volume. Architect names the numeric defaults; product ACs assert “inside the active retention policy,” not age-alone.
- **Say `stop` / override if you wanted age-only or an unbounded keep-forever store.**

### D-copy — Operator research-read wording is In
- **Conflict id:** `b9b5ba17…` (ux vs pm)
- **Ruling:** Trader UI / new dashboard pages stay Out (`NO_UI_CHANGE` in SPEC §4). Operator CLI / ops-check wording under the closed vocabulary is **In** (not “microcopy polish”).
- **Say `stop` if you wanted zero operator copy this ship.**

## Human product call

### D1 — Every paid fetch vs interval skip — **A (owner 2026-08-18)**
- **Conflicts:** `18414e85…` · `4f26c095…` · `5b58c363…` · `7a522d83…`
- **Ruling:** Save **every** successful paid fetch. Cost is governed only by dual retention (D-ret: max-age **and** per-symbol count cap). **No** min-interval thinning in v1. A paid cycle that fetches a book and writes nothing is a defect, not a skip class.
- **Consequence:** AC-4 +1 applies whenever cycle 2 is a successful paid fetch (subject only to later prune by retention). Architect does **not** ship `STRUCTURE_HISTORY_MIN_INTERVAL`-style skip. UX does **not** need a “capture skipped — within min interval” token this round.
- **Settled by:** owner letter A.

## R3 closed
All product calls settled. Technical T1–T3 + D-ret + D-copy + D1. Synthesizer writes SPEC + INTERFACE against this file.
