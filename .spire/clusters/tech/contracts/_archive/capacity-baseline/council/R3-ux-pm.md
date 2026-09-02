# R3 — ux ⇄ pm: capacity-baseline

One exchange. Conflicts `22e1a7fa` and `4a91fff` only. R1 not rewritten.

Already settled (not reopened): `NO_UI_CHANGE`; Command `load|soak` with Evidence `local|ci`; expected probe 503s are not a refusal *rate*; subscriber-ceiling vs session-ceiling vs rate-limit remain distinct class names; PM withdrew the low-cap limiter probe.

## Resolution

### `22e1a7fa` — vacuous runs must not emit quoteable p95

**Quoted PM sentence:** "A **receipt** on every terminal run (pass or fail) naming profile, duration, concurrency, ceilings in force, observed p95, unexpected-error count, refusal count, mock/not-production standing, and pass/fail against the locked thresholds."

**CONVERGED.** Every terminal run still emits a record. The record is not one measurement shape.

- **Pass** and **threshold-fail** (a completed run that crossed a named lock) write the **full measurement receipt**, standing first: Command, Evidence, surfaces actually driven, this-process ceilings, per-scenario harness p95 (basis, observed, lock), class counts, duration and concurrency actually used, verdict that agrees with the exit, closing “not a production measurement / Authorizes: nothing.”
- **Vacuous, blocked, incomplete, and start-error** write a **short non-measurement record**: standing (mocked vendors · not a production measurement · Command · Evidence · Authorizes: nothing) + verdict line that includes **No pass recorded** + non-zero exit. **No observed-p95 table. No executed-concurrency-as-measurement. No quoteable “we measured and found nothing wrong.”** Partial samples on an incomplete run are not printed as harness p95.

This is the same honesty PM already locked in S5 / AC-16–20 (no success receipt when nothing ran or the run was refused/interrupted). AC-31’s “fail receipts record observed p95” means **threshold-fail only**, not vacuous/blocked/incomplete/start-error.

**PM-A06, folded here:** standing is first on every finished record, including FAIL / BLOCKED / INCOMPLETE. One harness-p95 line per executed scenario (basis, observed, lock) is **only** on pass and threshold-fail. BLOCKED / INCOMPLETE / vacuous / start-error have no executed-scenario sample that can be named as observed p95.

### `4a91fff` — `NO_UI_CHANGE` / no trader route Verify-by

**Quoted PM sentence:** "**`review` owns intentional naming/surface:** command discoverability (AC-1/2) and the no-trader-UI boundary (AC-33)."

**CONVERGED.** Split by silent-regression risk (`spire-tech-risk-based-verify`):

| Row | Verify by | Why |
|---|---|---|
| AC-1, AC-2 (load / soak names on the runner) | **review** | Visible, intentional naming |
| AC-33 / UX-1 / UX-20 (`NO_UI_CHANGE`; no trader route, nav, screen, or new dashboard copy-table strings) | **test** | Negative space — an unlinked route or copy-table insert will not show up on a CLI receipt review |
| UX-5 (exact standing-block cadence) | **review** | Visible, intentional copy |

AC-1/2 stay review. Silent UI/route/copy insertion is test (empty-diff or copy-table scan). Trader 503/429 bodies remain byte-unchanged (already test).

## Still disputed

none
