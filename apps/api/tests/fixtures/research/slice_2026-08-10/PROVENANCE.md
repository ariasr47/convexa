# slice_2026-08-10 — provenance

**Extracted:** 2026-08-12, via `tools/research/extract_score_lab_slices.mjs` (SLICE A branch).

**Source paths (gitignored, local-only):**
- `data/scan.json` (`history` map, symbols SPY/QQQ/IWM) — the structure-sample ring buffer.
- `data/research/outcomes_20260811T193619Z.json` (`horizon: "1d"` rows only) — the deep dive's
  joined outcomes artifact.
- `data/research/score_lab_1d_20260811T193620Z.json` — the pre-feature lab's own report, copied
  verbatim as `pre_feature_report.json` (the tool-produced oracle `research/fixtures.rs` pins
  against).

**Membership rule:** every row in `outcomes_20260811T193619Z.json` (1d horizon) defines the wanted
`(symbol, as_of)` key set (millisecond-rounded, matching `score_lab.rs::as_of_key`); `samples.json`
is exactly the store rows whose key is in that set. Self-checking: the extraction script throws
`SLICE A incomplete` if any wanted key is missing from the store (ring eviction) rather than
silently thinning.

**Census (script output, verbatim):**

```json
{
  "n": 221,
  "score": 221,
  "score_drivers": 0,
  "net_gex": 0,
  "atm_iv": 0,
  "hv_30d": 0,
  "hv_only": 0
}
```

**Per-symbol counts:** `{ "IWM": 74, "QQQ": 73, "SPY": 74 }`. Outcomes: 221 (matches sample count —
no duplicate `(symbol, as_of)` keys).

**Samples-per-session (SPY):** 74 samples / 1 ET session (`2026-08-10`) = **74 samples/session**.
This is the capture-rate figure AC-78 needs to differ materially from `slice_current`'s — see that
slice's PROVENANCE.md. The two rates are **74** (this slice) vs **~98.5** (slice_current, SPY,
197 samples across 2 ET sessions) — a 24.5 samples/session difference, well over AC-78's `>1.0`
discrimination floor.

**Why these rows carry no `score_drivers` and no analytics fields.** These rows carry no
`score_drivers` and no analytics fields **because they were captured before the capture spine
landed in `13656ad` (2026-08-10) — not because the append path is broken.** It is not: 12,256 of
12,477 rows in the source store carry drivers. This is the captured truth of 2026-08-10 and it
must never be repaired.

**ET session:** all 221 rows fall on the single ET calendar date `2026-08-10` (verified by
`research::fixtures::tests::slice_0810_is_one_et_session`, via `session_date_et`). This is what
makes the slice's evidence class `SINGLE SESSION (d=1)`.

**Byte sizes (measured 2026-08-12):** `samples.json` and `outcomes.json` are each well under 100KB;
`pre_feature_report.json` is a single small JSON report. No binary content — verified via a byte
scan for literal NUL bytes (count = 0) per `CLAUDE.md`'s NUL-byte trap.

**This slice must never be repaired, backfilled or resampled.** It is the pinned reproduction
input for AC-69/70/71/72 and the parity oracle in `research/fixtures.rs`.
