# R3 — pm ↔ architect: score / tier / fingerprint identity (`c40411fb`)

One technical exchange. Quote in dispute: “Optional **byte-identity check** that a warm HTTP bundle's score triple equals the snapshot produced by `compute_analytics_from_vendor` on the same book is a **no-fork proof**, not a lab verdict.”

Not reopened: commands `load` | `soak`; evidence `local` | `ci`; blended 2.0s withdrawn; 60s / 8+16 withdrawn; limiter probe withdrawn; soak 10 minutes local + GATE Q. p95 millisecond numbers are not locked here.

## Resolution

**CONVERGED.** Score / tier / fingerprint identity after a successful load and after a successful soak is **required**. It is **not** a capacity threshold and **not** a lab verdict.

I accept the architect’s proof *shape* and I withdraw two claims I no longer need:

1. I withdraw any reading of score / tier / fingerprint as a p95, unexpected-error, stream-drop, or overflow-probe lock. Those locks stay latency / error / drop / refusal. Identity is a separate **isolation** verdict. A mismatch does not file as a crossed latency or error lock.
2. I withdraw AC-32’s temporal “before the runs vs after the runs” framing. A throwaway harness process is not the production desk, so a before/after on that process does not prove trader identity. The observable proof is the architect’s no-fork shape: on the **same book and same market inputs**, the analysis load/soak just served is **byte-identical** in score, tier, and fingerprint to the production analysis of that book. That is identity versus the same production function, not a new formula, and it **authorizes nothing**.

I do **not** accept **optional**. Skip, omit, or an empty comparison is a fail, not a pass. An empty scoring-engine change is **necessary and not sufficient**: a fork on the production analysis path outside the engine would still ship. Architect R1 already named that risk (additive fixture arm on the production path) and named score-identity as the mitigation — required, not hoped.

Binding outcomes:

- After a **successful load**, identity is observed or the run is an **isolation failure** (non-zero, distinguishable from a capacity-threshold fail). Merge CI invokes load, so a fork cannot merge as a capacity pass.
- After a **successful soak**, the same identity proof is observed again (the 10-minute hold did not fork scoring). GATE Q already runs soak.
- When the fixture arm is not engaged, ordinary ticker analysis for traders stays behavior-identical, including score / tier / fingerprint. Fixture-backed production remains refused.
- Receipt standing still **Authorizes: nothing** on score / tier / fingerprint / production defaults.
- Vacuous, blocked, incomplete, and start-error runs are not a successful load or soak; they do not emit a quoteable identity-pass.

## Still disputed

none
