# BACKEND_AMENDMENTS_REQUESTED — mainline-integration-2026-09

**Raised by:** backend lane, 2026-09-01. **Scope:** two items — Item 1 blocks AC-11, Item 2 blocks
AC-2 and the first half of AC-8. All 22 conflicted paths in SPEC §2 are resolved and verified and the
merge commit stands; neither item is a conflict *resolution* choice, both are two locked claims about
the same fact. **Status:** GATE Z — each needs an owner ruling, not a lane judgment (SPEC §5:
"bounce, do not pick a winner silently").

---

# Item 1 — Saturday New Year's Day: is the preceding Friday closed? (AC-11)

## Field

NYSE full-day closure on the Friday preceding a **Saturday New Year's Day** — concretely the ET dates
`2027-12-31` and `2032-12-31` (and, outside the shared calendar's domain, `2021-12-31`).

## The two expected shapes

| line | artifact | says |
|---|---|---|
| `codex/browser-quality-gates` (exchange-holiday-calendar) | `apps/api/src/domain/nyse_full_day.rs` + its `#[cfg(test)]` generator, replicated in `apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.ts` | `2027-12-31` and `2032-12-31` **ARE** full-day closures. The locked SPEC gives every holiday the "Saturday → prior Friday" observed shift with no New Year's exception; the locked PLAN spells the case out: *"captures 2033-01-01 Saturday → observed **2032-12-31**"*. |
| `main` (archive-coverage-guardrails) | `apps/api/src/services/session_chain_archive/calendars/xnys_full_day_2026_2035.v1.json` (`calendar_version 2026-2035@2026-08-26.1`) | They are **NOT** closures. A Saturday New Year's Day produces **no** closure at all — 2028 and 2033 carry no New Year's row in either direction. |

Everything else agrees: over the seven overlapping years (2026–2032) the two sets are identical apart
from exactly these two dates (69 vs 71). The dashboard replica is byte-faithful to `nyse_full_day.rs`
— that third arm of the parity test passes.

## Why the lane cannot decide it

1. **Both artifacts are contract-locked** on promoted, QA'd features. Editing either silently picks a
   winner against a locked SPEC.
2. **The backend half cannot move alone.** `apps/dashboard/.../nyseFullDayHolidays.spec.ts` re-derives
   the same generator in TypeScript and pins the replica by set-equality, so dropping the two dates
   from `nyse_full_day.rs` turns that dashboard spec red and breaks **AC-3**. The dashboard is out of
   this lane (hard lane rule; PLAN B3: *"the dashboard list is not edited by this lane — if the
   dashboard list itself is wrong, record it as a GATE Z item for a frontend lane"*).
3. **It is not a merge artifact.** Neither file was among the 22 conflicted paths; both merged
   cleanly. The merge reveals a pre-existing divergence rather than creating one.
4. `shared-session-eligibility-calendar` is violated while both ship:
   `is_nyse_full_day_holiday("2027-12-31")` is `true` (SSE `market_session` → `closed`; keep, tape and
   the research coverage matrix treat the date as ineligible) while the archive coverage policy built
   on the shared calendar treats the same date as an expected session.

## What a ruling needs to settle

- **Which set is right.** Observable precedent: the NYSE traded a full session on Friday 2021-12-31
  (New Year's Day 2022 fell on a Saturday), and the branch's own table marks that date a closure too —
  so the generator's New-Year's arm looks wrong against reality and main's calendar looks right. That
  is a domain ruling; this lane records it, it does not make it.
- **Who edits what.** If main's calendar wins, a frontend lane drops `2027-12-31` / `2032-12-31` (and
  `2021-12-31`) from `nyseFullDayHolidays.ts` and adds the exception to its generator while a backend
  lane makes the same two edits to `nyse_full_day.rs` — in one feature, so the replica pin never goes
  red mid-flight.
- **Domain gap.** The shared calendar covers 2026-01-01..2035-12-31; `nyse_full_day.rs` covers
  2020..2032. "Point the evaluator at the shared calendar" cannot be taken literally: doing so erases
  2020–2025 holiday knowledge that the day-tape / replay surfaces read (their probes use 2020-era ET
  dates). Any unification must state how the pre-2026 years are sourced.

## Evidence in the tree

`tools/holiday-calendar-parity.spec.mjs` is checked in and **RED** on two of its three cases, so the
divergence is build-breaking rather than prose (`structural-over-prose-enforcement`). It names the two
dates in its failure message and passes on the dashboard↔backend-table arm.
`node --test tools/holiday-calendar-parity.spec.mjs` exits 1 (AC-11 not met). Hosted CI does not run
`npm run test:tools`, so AC-12 is unaffected.

---

# Item 2 — the capacity v1 byte-identity oracle pins a 52-operation API surface (AC-2, AC-8)

## Field

`apps/api/src/capacity/identity.rs` — `API_ARTIFACTS` (five pinned SHA-256 values), the
`operations.len() != 52` gate, and the matching `api_contract_artifacts[].base_sha256` rows in
`apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json`, all bound to
`REFERENCE_REVISION = c30ed8151b82f847fd75552528dcba30bdca5ae8`.

## The two expected shapes

| line | says |
|---|---|
| `main` (capacity-baseline v1) | The API surface is **exactly 52 operations** and the five generated artifacts hash to the values captured at `c30ed815`. The module header is explicit: *"This module deliberately treats the committed corpus as an oracle. It never captures or rewrites an oracle and it fails closed when a manifest, route inventory, generated descendant, or decision projection differs."* |
| `codex/browser-quality-gates` | Five additive operator/research operations exist — session-archive coverage, session-books (list + `/book`), session-day-tape (list + `/day`), flat-files (list + `/extract`) — promoted by five QA'd features; `precutover-operation-baseline.json` on that line already records **57**. |

`identity.rs` exists on neither the branch nor the merge base (main-only, added after `a9b073b4`), so
this is not a textual conflict — it is two locked claims about the same number.

## Measured, not assumed: the score half of the oracle still holds

A throwaway local patch demoting **only** the artifact-SHA and 52-count gates to non-fatal prints
(restored immediately; `git diff` on `identity.rs` is empty) made
`cargo run -p api-rust -- capacity-baseline self-test --case byte-identity` **exit 0** on the merged
tree, printing exactly six diagnostics: the five artifact hashes and `route operation count is 57 not
52`. Everything else in `run_control` passed — `npm run api:contract:check`, the generated-client
inventory, and the decision-bearing comparison of `before/ticker.json`, `before/sse.json`,
`before/decision.json`.

**So `additive-keeps-score-byte-identical` is intact:** `opportunity_score`, `opportunity_tier` and
`state_fingerprint` are byte-identical to the reference oracle after the merge. Only the route
inventory moved, and it moved because the branch legitimately added five additive research routes.

## Why the lane cannot decide it

Re-pinning is a governed capacity-baseline act, not a merge resolution: new artifact hashes in
`identity.rs` **and** in the checked-in fixture manifest **and** a new `REFERENCE_REVISION` asserting
where the oracle was captured. Doing that inside this merge would silently retune main's own
fail-closed guard to accept the branch. Deleting the branch's routes to satisfy the pin is the same
move in the other direction.

## Impact until it is ruled

- **AC-2 fails on exactly one test:**
  `archive_coverage_runtime::protected_projection_remains_byte_identical_across_coverage_states`
  → `Err(API artifact changed: apps/api/openapi/precutover-operation-baseline.json)`. The rest is
  green: **1267 passed / 1 failed** across `api-rust` + `quant-engine`.
- **AC-8 first half fails** for the same single reason:
  `npm run capacity:baseline:self-test:byte-identity` exits 1 with
  `error: API artifact changed: apps/api/openapi/precutover-operation-baseline.json`.
- The v2 half of AC-8 (`capacity load`) is unaffected.

## What a ruling needs to settle

Whether the v1 oracle is re-captured at the merge revision (52 → 57 operations, five new artifact
hashes, new `REFERENCE_REVISION`; the `before/*` decision fixtures need no re-capture because they
already match), and which lane owns that re-capture. Nothing else about the merge depends on it.

## Fixed on the way in (not part of the bounce)

`.gitattributes` had no rule for `apps/api/tests/fixtures/capacity-baseline/**`, so with
`core.autocrlf=true` a fresh Windows checkout rewrote the byte-compared oracle to CRLF and the
self-test failed earlier and for the wrong reason (`error: reference_test_seam hash mismatch`) — the
exact defect class `.gitattributes` was written to stop, and the reason main's own
`archive_coverage_runtime.rs` normalizes those files in place before calling `run_control`. A
`text eol=lf` rule for that fixture tree is included in the merge; without it the real failure above
is invisible on Windows.
