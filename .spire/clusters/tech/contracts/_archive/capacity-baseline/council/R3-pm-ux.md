# R3 — pm ⇄ ux technical resolution: capacity-baseline

One exchange. Conflicts `22e1a7fa` and `4a91fff` only. I accept both UX proposals.

Not reopened: blended 2.0s withdrawn; 60s/8+16 withdrawn; limiter probe withdrawn; Command `load`|`soak`; soak 10 minutes local + GATE Q, not merge CI.

## Resolution

### `22e1a7fa` — no quoteable observed-p95 table on vacuous / blocked / incomplete / start-error

**Quote I withdraw:** “A **receipt** on every terminal run (pass or fail) naming profile, duration, concurrency, ceilings in force, observed p95, unexpected-error count, refusal count, mock/not-production standing, and pass/fail against the locked thresholds.”

**CONVERGED.** A degraded run has no honest observed p95. Printing that table on vacuous, blocked, incomplete, or start-error is a quoteable “we measured” artifact — the empty-corpus failure mode, and my defining failure mode of burying degraded states inside a happy-path receipt criterion.

**Binding**

- Pass and threshold-fail write the full measurement receipt, standing first: duration, concurrency actually used, ceilings in force, per-scenario harness p95 (not a blend), unexpected-error count, refusal class counts, mock / not-a-production-measurement standing, and which locks held or which lock tripped.
- Vacuous, blocked, incomplete, and start-error write a short non-measurement record: standing first, verdict, **No pass recorded**. No observed-p95 table.
- Every terminal run still produces a durable record. Silence is not allowed. The record on those four states is not a measurement.
- `[FAIL]` for a crossed lock after real work is threshold-fail (measurement receipt). `[FAIL]` for zero work is vacuous (non-measurement). Those stay distinguishable (AC-36).
- Standing remains first on every finished run, including BLOCKED / INCOMPLETE / ERROR. That answers PM-A06 for standing. I withdraw the half of PM-A06 that asked for harness-p95 observed lines on those states.

**AC-31 restated for synthesis**

> Pass and threshold-fail receipts record observed per-scenario harness p95, unexpected-error count, refusal class counts, duration, concurrency actually used, and ceilings in force — a pass is not an empty “ok.” **Verify by: test.**

**Degraded companion (fold into AC-16–20; do not bury in AC-31)**

> Vacuous, blocked, incomplete, and start-error runs exit non-zero, write a short non-measurement record (standing + verdict + No pass recorded), and emit no observed-p95 table. **Verify by: test.**

### `4a91fff` — AC-1/2 stay review; no-trader-UI is test

**Quote I withdraw the second half of:** “**`review` owns intentional naming/surface:** command discoverability (AC-1/2) and the no-trader-UI boundary (AC-33).”

**CONVERGED.** Command names on the runner are visible and intentional. A new unlinked trader route or dashboard string will not show up on a CLI receipt review — that is negative space under `[operator-vs-trader-path-separation]` and `NO_UI_CHANGE`.

**Binding**

- AC-1 and AC-2 remain **review**.
- AC-33, UX-1, and UX-20 — no trader route, nav, screen, or new dashboard strings; SPEC §4 `NO_UI_CHANGE` — are **test** (structural empty-diff or copy-table scan). No DOM harness.
- Exact standing-block cadence stays **review** (UX-5).

**AC-33 restated for synthesis**

> No trader-facing route, nav item, screen, or new dashboard strings are added or changed. **Verify by: test.**

## Still disputed

none
