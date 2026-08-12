# slice_current — provenance

**Extracted:** 2026-08-12, via `tools/research/extract_score_lab_slices.mjs` (SLICE B branch).

**Source path (gitignored, local-only):** `data/scan.json` (`history` map, symbols SPY/QQQ/IWM).

**Membership rule:** every store row for SPY/QQQ/IWM whose `(symbol, as_of)` key is **NOT** in
`slice_2026-08-10`'s outcomes key set. These are the fully-populated post-capture-spine
(`13656ad`, 2026-08-10) rows.

**Census (script output, verbatim):**

```json
{
  "n": 592,
  "score": 592,
  "score_drivers": 592,
  "net_gex": 589,
  "atm_iv": 589,
  "hv_30d": 589,
  "hv_only": 0
}
```

**Per-symbol counts:** `{ "IWM": 196, "QQQ": 199, "SPY": 197 }`.

**`hv_only` is 0**, as expected: `resolve_vol_scalar` prefers `atm_iv` whenever present
(`vol_gex.rs:86-92`), and current captures carry both `atm_iv` and `hv_30d` together. This
fixture alone **cannot** carry AC-19's `hv_30d`-fallback arm — that arm is covered by the
constructed fixtures (B10, `f_mixed()` family), stated here explicitly rather than left implicit.

**`net_gex`/`atm_iv`/`hv_30d` are 589 of 592, not 592 of 592** — a genuine non-zero, non-total
population. This is the property IDENTITY 3 / the GEX candidates need to be exercised
non-vacuously on real data: 3 rows are missing analytics (non-finite/non-positive at capture,
per `store.rs::with_analytics`'s finite/positive guards), giving real `InputAbsent`/
`InputNonFinite` exclusion counts to reconcile.

**Sessions covered and capture rate (per symbol, ET calendar date):**

| symbol | n | sessions | rate (samples/session) |
|---|---|---|---|
| SPY | 197 | 2026-08-11, 2026-08-12 | 98.5 |
| QQQ | 199 | 2026-08-11, 2026-08-12 | 99.5 |
| IWM | 196 | 2026-08-11, 2026-08-12 | 98.0 |

This is materially different from `slice_2026-08-10`'s SPY rate of 74 samples/session (single ET
session) — the pair AC-78's two-fixture assertion needs to distinguish a *derived* retention
figure from a hardcoded one.

**Outcomes:** `outcomes.json` is **absent from this fixture as of 2026-08-12.** `join-outcomes`
requires `MASSIVE_API_KEY`, which is not configured in this environment, and the newest rows
(2026-08-12) are inside an open forward session and would not label yet even with a key. Per
`PLAN.md` B0 step 4's documented fallback: `samples.json` is committed **alone**; a follow-on task
**B0b** (re-run `cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM --horizons 1d --out
.tmp/outcomes_current.json`, filter to this slice's `(symbol, as_of)` keys, write
`outcomes.json`) is open and **blocks nothing** — the constructed fixtures (B10) carry every
guard meanwhile, and AC-78 falls back to `slice_2026-08-10` vs the constructed `f_mixed()`
fixture (which has its own, different capture rate) until B0b lands.
`research::fixtures::slice_current_outcomes()` returns `Option<Vec<StructureOutcome>>` and is
`None` today; every test consuming it SKIPS loudly (see
`slice_current_outcomes_pair_when_present`) rather than passing vacuously.

**Byte size:** `samples.json` ≈ few hundred KB (592 rows). Verified NUL-byte-free (count = 0) per
`CLAUDE.md`'s NUL-byte trap.

**This slice must never be repaired, backfilled or resampled.**
