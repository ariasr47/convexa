# FRONTEND_AMENDMENTS_REQUESTED — research-lab-surface

GATE Q FAIL 2026-08-31. Owner: Frontend. Do not edit SPEC / INTERFACE / PLAN. Do not touch `apps/api`.

## Items

### AC-29 — digest-region Retry after unreadable is a no-op
**Why it can't stand:** Ship-blocking AC-29 requires `session book unreadable:` **including a warm Retry of the same identity**. First open of QQQ 2026-08-30 paints `session book unreadable: body object unreadable: missing` (good). Clicking digest-region Retry issues **0** `/api/_research` requests. `digestMemory` is cleared on Unreadable, so `digestRetry` has no identity and no-ops. Warm Retry of the same identity never happens.

**Closest buildable alternative:** Keep the last **load identity** (symbol + et_date) for digest-region Retry when standing is unreadable or load invariant-fault, even if the success digest projection is cleared. Retry must call `digestRetryGets(identity)` → that identity’s load GET only. After Retry, still paint `session book unreadable:` (or invariant-fault) — not miss, not stale chip, not a kept prior success digest. Zero vendor calls.

### AC-46 — digest Retry fan-out
**Why it can't stand:** Same observation. SPEC §2 / AC-46: digest-region Retry (load unreadable / load invariant-fault only) re-issues that identity’s **load GET only**. Observed: Retry click → 0 research GETs.

**Closest buildable alternative:** Same identity-retention as AC-29. Page Retry stays list GET + coverage GET (never load). Do not start a poll loop.

## Out of this bounce
- Independent conformance PASS 7/7 (matches builder).
- 51 other ACs PASS including AC-38 coverage-unavailable, occupancy exclusive standing, chip-switch hide, cors≠stale.
- Full dashboard suite 1 red in `session-day-tape-capture.structural.spec.ts` — outside this feature’s writes; not this bounce unless the fix regresses it.

## Verify
- Failing test first: after an unreadable (and after load invariant-fault) paint, digest Retry issues exactly one load GET for that identity; page Retry still list+coverage only.
- Re-run feature Vitest + typecheck; check exit codes.
- Do not stash / restore / reset the dirty tree.
