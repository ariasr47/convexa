# score-lab-signal-comparison — QA report (GATE Q, **pass 3** — re-verification after the second GATE Z fix)

**Verifier:** QA / Verification — fresh session, not a builder, **not the session that wrote pass 1 or pass 2**
**Date:** 2026-08-12
**Verdict:** **GATE Q — PASS** (77 PASS · 0 FAIL · 1 UNVERIFIABLE)

---

## 0. What was observed, and on what

| Item | Detail |
| --- | --- |
| Code under test | **`5161a227eb0713358d3731db6f04537259f5aa34`** — `fix(research): score-lab GATE Z bounce 2 — AC-14 statement + AC-37 regression`. The whole feature is now **committed**; `git diff` over `apps/` is empty. |
| Which files this pass actually touched | The commit bundles bounce 1 (uncommitted when pass 2 ran) with bounce 2, so the commit stat over-states this pass. Isolated by mtime against pass 2's own observation point (its binary, 13:36:50): **`artifact.rs` 14:04:32 · `render.rs` 14:04:37 · `run.rs` 14:05:37 · `comparison.rs` 14:06:59** are the only four sources newer than it. `main.rs` **13:36:33**, `fixtures.rs` 13:20:16, **`stats.rs` 13:19:13** — all older, i.e. **untouched this pass**, as required. `INTERFACE_CONTRACT.md` **02:04:41** and `SPEC.md` 09:10:29 — untouched. |
| Binary observed | `target/debug/api-rust.exe`, rebuilt by me from the code on disk (`cargo build -p api-rust` → exit 0), and **rebuilt again after my poison tests** so every figure quoted below comes from the restored source. Post-restore re-run of the 4-symbol variant is **deep-equal** to the pre-poison artifact. |
| The orphan on :8000 | Still real, still unkillable (PID **58588**, still LISTENING), still holding `target/debug/api-rust-orphan-locked.exe`. **Nothing in this report was observed against :8000.** My server ran on **:19311**, from my own build, and was terminated afterwards (`taskkill /F` → SUCCESS). |
| Rust suite | `cargo test -p api-rust -p quant-engine` → **exit 0**, checked by exit code, not the printed summary. 160 + 6 + 5 + 65 + 3 + 8 + 2 = **249 passed / 0 failed** (was 247; +2 = the two new tests). Re-run **after** restoring my poisons: still **249 / exit 0**. |
| Postgres half | `cargo check -p api-rust --features postgres` → **exit 0**. |
| Conformance (mine) | `conformance-receipt-qa.json` → **PASS**, `http://127.0.0.1:19311`, 1/1 endpoint, 7 required fields. Agrees with the builder's receipt (`:19102`, PASS). **No divergence.** |
| `NO_UI_CHANGE` | **Structurally confirmed.** `git diff --name-only d16c32d -- apps/dashboard apps/dashboard-e2e libs/api` → **0 files**. No frontend lane, no frontend suite step. |
| Primary observation surface | **17 real CLI invocations** over the committed 2026-08-10 fixture + the store: default · `SPY` · `spy` · `SPY,QQQ` · `spy,qqq` · `SPY,QQQ,IWM,DIA` (×3, incl. a duplicate run and `--driver-loo false`) · `SPY,DIA` · `" SPY , SPY "` · `TSLA` · injection-shaped symbol · `--horizon 99d` · missing path · empty-outcomes · empty-samples · `--store` (×2) · empty `MASSIVE_API_KEY`. Artifacts + consoles captured outside the repo. |
| My footprint | Read-only on the product. Three files were temporarily poisoned to prove guards bite and **all three restored byte-identically** — proven by `git diff --exit-code -- apps/api` → **empty**, and by md5 (`render.rs` `9b4d81760fe7d73a6bb8dc6a9436eb46` before and after). `git status` at the end matches `git status` at the start. |

### The two repaired criteria — verified on real runs, not accepted

**AC-14 — the single-symbol statement now exists, and both arms are right.**

| Run | Console line 61 = artifact `per_symbol_note` |
| --- | --- |
| `--symbols SPY` | `Per symbol — single symbol requested: pooled above is that one symbol (SPY) over these same rows, so pooled is not a cross-symbol summary` |
| `--symbols spy` (case-folded) | identical, symbol rendered `SPY` |
| default · `SPY,QQQ` · `spy,qqq` · `SPY,QQQ,IWM,DIA` · `--driver-loo false` · `--store` · no-credential | `Per symbol — pooled above is not a summary of these` — **byte-identical to §4's required heading on all 8 multi-symbol runs** |

The note is **computed once** (`artifact.rs:37 per_symbol_heading`), stored once (`artifact.rs:657`),
and **reused, never re-derived**: `render.rs:286` is `out.push(art.per_symbol_note.clone())` and a
repo-wide grep finds exactly one construction site. Console and artifact are therefore equal by
construction, and I confirmed the field's value appears verbatim in its own console on **every** run.
The numeric half still holds: `--symbols SPY` → pooled `n_paired` **74** = `Symbol(SPY)` 74, with
`n_eligible` and reason maps identical on **all 15** candidate × label pairs.

**AC-37 — 0 of 75, not 6 of 75.**

Machine-checked over **525 rendered cells across 9 artifacts** (75/75/60/75/45/60/30/45/60):
**0 cells fail to end with `)`** and **0 cells have unbalanced parentheses**. The caveat now closes
parenthetically and its *meaning* survived the rewording — both halves AC-15 requires are still there:

```
not symbol-comparable: net GEX magnitude scales with each symbol's own float/OI (see the per-symbol cells for the honest read)
```

AC-15 itself re-verified independently: the first-class field `not_symbol_comparable` is **true on
exactly the 6 pooled GEX-magnitude cells and false on the other 69** (set identity, not a count), the
caveat text rides **inside each of those cells' own `rendered`**, and the true-set and the
text-carrying-set are the **same objects**. Console lines 33, 39, 176, 192, 289, 305.

### The two new tests exist, are named as claimed, pass — and I made both go red

A test that cannot be shown to bite is not enforcement. `vocabulary.rs:521`'s literal-only assertion
is exactly why AC-37 landed green last time, so I poisoned each new test's subject and watched:

| Poison (product source, then restored) | Test | Result |
| --- | --- | --- |
| `comparison.rs:623` caveat closed with `; per-symbol cells are the honest read` instead of a parenthetical | `every_cells_rendered_text_ends_with_its_closing_parenthesis_ac37` (`comparison.rs`) | **RED** — *"6 of 75 cells do not end with ')'"*, naming all six `Pooled × net_gex_* × <label>` cells |
| `artifact.rs:37` single-symbol branch disabled (`if false && …`) | `single_symbol_run_states_pooled_is_that_one_symbol_over_the_same_rows` (`run.rs`) | **RED** at `run.rs:452` — *"artifact per_symbol_note does not state 'same rows'"* |
| `render.rs:103` retention span assembled at runtime (`"ab{}ut {} sessions", "o", 2+2`) so the needle never appears contiguously in source | `no_retention_literal_appears_in_emitted_strings_or_source` | **RED** at `artifact.rs:930` — *"a real run's console contains a retention literal … left: Some(\"about 4 sessions\")"* |
| — all restored — | | `git diff -- apps/api` **empty**; suite back to 249 / exit 0 |

Both new tests are also non-vacuous by construction: the AC-37 test asserts `cells.len() == 75`
("must run over the full declared grid, not a subset") **and** pins the 6 caveat cells positively;
the AC-14 test asserts the statement in **both** surfaces the pass-2 repro scanned, asserts the
heading is `!=` the multi-symbol string, and asserts the multi-symbol run is **unaffected**.

### Settled facts — re-confirmed, not re-litigated

- **V3a parity oracle reproduces bit-for-bit.** All **15** pinned constants compared by `repr()`
  equality (not by eye) against `pre_feature_report.json`: AUC `0.46744471744471744` /
  `0.5691303548446406` / `0.9318740777176586`; lift `0.17312965139052094` / `0.12984723854289074` /
  `1.93859649122807`; precision, recall and base rate likewise; n/n_pos/top_decile_n 221/111/23,
  221/74/23, 221/114/23. **75 cells**, DIA renders **literal 4** on all 15 of its cells, retention SPY
  `74 of 576 held`. Pooled `pearson_vs_abs_move` `-0.021586482599806937` and `pearson_vs_ret_simple`
  `0.13703694247431422` also match the oracle exactly. **No drift.**
- **C1 stays closed in the emitted artifact.** All **48** ranking-metric slots across the 25
  candidate-scope records carry `Absent{UndefinedOnThisData}` with a named `precondition` **and**
  `failing_fact`; **0** fabricated values. `correlations` serialize at full precision
  (`0.51016091304366`, `-0.30751440624493687`), `role` and `basis` present. DIA's retention entry
  carries tagged absences on both estimates and renders literal 3 alone.
- **B0b is still OPEN and the SKIP is still loud.** `slice_current/outcomes.json` absent; the guard
  prints `SKIP: slice_current/outcomes.json absent — B0b not yet landed. The constructed fixtures
  carry these guards meanwhile.` **A SKIP is not a PASS.** V3b was not run, no slice produces a cell
  above both floors, and **no outcomes were synthesised**. No §3 criterion rests solely on slice B.
- **PLAN B8 "12 vs 13"** — closed; SPEC §4 requires 12.
- **Default vs explicit cell count** — the default run emits **60** cells over `[IWM, QQQ, SPY]`; **75**
  comes from `--symbols SPY,QQQ,IWM,DIA` (the fixture has no DIA). Both observed, both correct.

### Environment note — `data/scan.json` is being mutated by the orphan, not by this feature

Mid-session I found the repo's store changing under me (md5 `082df11…` → `822e94e…` → `d7a6f18…`,
size 6,569,988 → 6,641,401). With **nothing of mine running** it changed again inside a 20-second
window, and PID **58588** is still LISTENING on :8000 — the orphan's sweep worker is flushing the
durable store. AC-66 was therefore re-verified on an **isolated copy** the orphan cannot reach:
byte-identical before and after a `--store` lab run. (The in-place before/after md5 taken around the
first `--store` run was also identical.)

---

## 1. Point-by-point verdicts (AC-1 … AC-78, verbatim)

| # | Acceptance criterion (verbatim) | Verify by | Verdict | Evidence / HOW |
| --- | --- | --- | --- | --- |
| AC-1 | A run with no flags beyond today's runbook invocation prints the declared candidate set, and the number of candidates it reports equals the number it printed — five in v1. | review | **PASS** | review/QA — console lines 19/29/35/41/51 print candidates 1–5 in declared order on all 12 successful runs; artifact `candidates[]` length **5** on every one. |
| AC-2 | The raw-GEX candidate is labelled a **control** wherever its figure appears, in console and artifact, in its own label (not a legend), printed immediately after the vol-normalized row, with one sentence stating why it is present. It is never presented as a candidate under consideration. | review | **PASS** | review/QA — console:35 `3  Raw GEX magnitude - control (ranked on \|net GEX\|; same eligible rows as the row above, so a vol-norm result can be attributed to the normalization)`, directly after row 2; the marker rides in the display name on every cell line. tests `candidate_rows_carry_direction_basis_and_control_rationale`, `exactly_one_control_and_it_names_an_existing_candidate`. |
| AC-3 | The string `net_gex_vol_norm_signed`, and any display label for it, appears nowhere in the console output or the artifact — no row, no placeholder, no footnote promising it later. | test | **PASS** | test `net_gex_vol_norm_signed_appears_nowhere_in_the_registry` + my own scan: **0 occurrences** across 15 consoles and 9 artifacts. |
| AC-4 | Every candidate is reported on the same metric family (AUC, lift@top decile, precision@top decile, calibration); no candidate silently omits a metric another carries — an omitted metric renders its metric-level literal. | test | **PASS** | Observed: every `Computed` cell renders AUC / Lift@10 / Precision@10 / Recall@10 / Calibration — **120 value-bearing metric lines over 24 Computed cells, 0 omissions**; non-computed candidates are dispositioned at carrier level, which §2.5(b) precedence requires. *Recorded, unchanged:* the trailing "Calibration (quintile bins, pooled)" summary block lists only the 3 candidates with computed calibration (§6 note 9). |
| AC-5 | On a constructed slice where one candidate ranks the label perfectly and another ranks it exactly inversely, the report places them at opposite extremes of the ranking metric, and a third candidate whose values are unrelated to the label reports at chance. | test | **PASS** | test `f_perfect_and_inverse_places_candidates_at_expected_extremes` — named, passing in my run. |
| AC-6 | Two runs over identical inputs produce identical figures; the artifacts differ only in run timestamp and output path. | test | **PASS** | Observed — two full 4-symbol CLI runs; artifacts **deep-equal** after removing `generated_at_utc` (0 differing top-level keys); consoles differ on exactly **2** of 409 lines (line 11 timestamp, line 409 artifact path). test `two_runs_over_identical_inputs_are_byte_identical`. |
| AC-7 | Candidates appear in the declared order and symbols in their input order on every run; the table is never sorted by a metric value. | test | **PASS** | Observed: `candidates[]` = the declared 5-key order on every artifact; `--symbols SPY,QQQ,IWM,DIA` → `[SPY,QQQ,IWM,DIA]`, default → `[IWM,QQQ,SPY]` (the samples file's first-seen order). Cell vector = declared cross product order. tests `candidate_blocks_appear_in_declared_order`, `five_entries_unique_keys_declared_order`, `retention_entries_are_in_requested_order`. |
| AC-8 | The artifact contains exactly `groups × candidates × labels` cells and the set of `(group, candidate, label)` keys equals the declared cross product — including for a fixture whose requested symbols contain one with zero paired rows. Every cell carries a state. | test | **PASS** | Machine-checked on **9 artifacts**: 75 / 75 / 60 / 75 / 45 / 60 / 30 / 45 / 60 cells, key set **equal** to the cross product, **no duplicate keys**, **state present on every cell** — all 9 green, including the DIA (zero-paired) variant. test `totality_over_the_declared_cross_product_including_a_zero_paired_symbol`. *See §6 note 1 for the malformed duplicate-symbol input, which is outside this observed-good set.* |
| AC-9 | Every candidate × label is reported once pooled and once per **requested** symbol; a run restricted to two symbols produces per-symbol blocks for exactly those two and no others. | test | **PASS** | Observed `--symbols SPY,QQQ` → groups exactly `{Pooled, Symbol(SPY), Symbol(QQQ)}`, 45 cells, no others; `--symbols SPY` → `{Pooled, Symbol(SPY)}`, 30 cells. test `per_symbol_section_present_for_every_requested_symbol`. |
| AC-10 | **Composition:** for every candidate × label, the pooled used count printed in the report equals the sum of the per-symbol used counts, and for each named exclusion reason the pooled count equals the sum of the per-symbol counts for that reason. Checked on a slice where at least one symbol contributes exclusions and at least one does not. | test | **PASS** | Verified arithmetically over **135 candidate × label pairs across 9 runs — 0 violations**, on used counts **and** reason-by-reason maps. tests `symbols_as_a_strict_subset_restricts_pooled_not_only_the_group_list`, `identities_hold_on_f_mixed` (the mixed-exclusion fixture the AC's last sentence requires), `identities_hold_on_slice_0810`. |
| AC-11 | **Closure:** within any single scope, used samples plus total excluded samples equals **that scope's own** paired row count, printed in the same block as the figures it bounds, and rendered on each candidate row as `n = <used> (excluded <k>: <reason>)` with every reason counted. | test | **PASS** | Verified over **525 cells across 9 runs**: `n_eligible + Σ excluded_by_reason == n_paired_in_group`, **zero violations**. Rendered form observed (`n = 221 (excluded 0) · sessions = 1 …`). test `closure_holds_on_every_constructed_fixture`. |
| AC-12 | **Paired eligibility:** in every group and every label, the raw-GEX control and the vol-normalized candidate report equal used counts and equal exclusion counts reason by reason. | test | **PASS** | Verified over **105 group × label combinations across 9 runs — 0 violations**; `n_eligible` and reason maps identical for `net_gex_abs_raw` / `net_gex_vol_norm_abs`. test `identity3_is_not_vacuous_on_real_slice_current_data`. |
| AC-13 | A requested symbol whose rows produced no paired outcome for the horizon appears in the per-symbol section carrying the no-paired-outcome literal, naming the horizon and both counts — never omitted from the report. | test | **PASS** | Observed on `--symbols SPY,QQQ,IWM,DIA`: all **15** DIA cells render `no paired outcome (0 of 0 DIA samples labelled at horizon 1d)`; its candidate-scope records and retention entry are present too. test `dia_zero_paired_rows_renders_no_paired_outcome`. |
| AC-14 | A single-symbol run still renders the per-symbol section and states that the pooled block is that one symbol over the same rows. | test | **PASS** | **Pass-2 FAIL cleared — observed on the running CLI, both arms.** `--symbols SPY` (and `--symbols spy`) → console:61 **and** artifact `per_symbol_note` = `Per symbol — single symbol requested: pooled above is that one symbol (SPY) over these same rows, so pooled is not a cross-symbol summary`; the per-symbol section still renders (30 cells, `Symbol(SPY)` group present). Multi-symbol runs keep `Per symbol — pooled above is not a summary of these` byte-for-byte on **8** runs. Counts still identical (pooled 74 = SPY 74 on 15/15 pairs). Computed once in `artifact.rs::per_symbol_heading`, reused by `render.rs:286` — one construction site, never re-derived. test `single_symbol_run_states_pooled_is_that_one_symbol_over_the_same_rows` — **which I made go red by disabling the branch**. |
| AC-15 | Pooled cells for the GEX-magnitude family carry, as a field wherever the figure appears, the caveat that net GEX magnitude is not symbol-comparable and that the per-symbol cells are the honest read. | test | **PASS** | Field `not_symbol_comparable` **true on exactly the 6 pooled GEX-magnitude cells, false on the other 69** (object-identity set comparison, on 3 different runs), and the caveat renders **inside each of those cells' own text**, now closing parenthetically: `… scales with each symbol's own float/OI (see the per-symbol cells for the honest read)` (console 33, 39, 176, 192, 289, 305). Both halves the criterion names — *not symbol-comparable* and *per-symbol is the honest read* — survived the AC-37 rewording. test `pooled_gex_magnitude_cells_carry_the_not_symbol_comparable_caveat` + the new AC-37 test's positive pin on the same 6 cells. |
| AC-16 | Any single figure in the report can be read together with its horizon, window start/end (UTC), symbol scope, row and session counts, label definition and threshold value, without opening another file. | review | **PASS** | review/QA — console:3 `This run: 2026-08-10 17:15–23:58 UTC (6h42m) · 221 paired rows · horizon 1d`; a `Window: … · SINGLE SESSION (d=1)` banner heads blocks 4/6/7 (lines 18, 152, 400); symbol scope on every per-symbol cell header; `n=`/`sessions=` on every value atom; the label definition + threshold printed in every cell block. |
| AC-17 | Every metric row carries its label definition verbatim from the label's own definition string, in the same block as the number — never in a legend at the bottom. | test | **PASS** | Artifact: **75/75** cells carry `label_definition` **byte-equal** to `labels[].definition`. Console: **78** `label …` lines = 75 cell blocks + the 3 slice-description lines, each verbatim, each **inside** its own cell block (e.g. console:28 immediately under the metric lines); the last one is at line 398 of 409 because it belongs to the last cell block, not to a bottom legend. test `every_cell_block_carries_its_label_definition`. |
| AC-18 | Every candidate row states its ranking direction in words. | test | **PASS** | Observed on all five: `(higher score ranks first)`, `larger vol-normalized \|net GEX\| ranks first`, the control's `(ranked on \|net GEX\|; same eligible rows …)`, `nearer the flip ranks first`, `nearer the nearer wall ranks first`. test `candidate_rows_carry_direction_basis_and_control_rationale`. |
| AC-19 | The vol-normalized rows carry the vol-basis **counts triple** (ATM IV / HV 30d / unavailable), so a scope where every sample fell back to HV is distinguishable from one where none did; those rows are labelled a magnitude read, never "score" or "signal". | test | **PASS** | Observed console:29 — `2  Vol-normalized GEX magnitude (ranked on \|net GEX\| / vol scalar; larger vol-normalized \|net GEX\| ranks first; **basis mix: ATM IV 0, HV 30d 0, unavailable 0**)`; three independently-read counters derived at render time from `candidate_scope[Pooled].basis_mix`. "magnitude", never "score"/"signal". test `candidate_rows_carry_direction_basis_and_control_rationale`. *Recorded gap, unchanged: §6 note 3.* |
| AC-20 | No candidate label uses the word "distance" unqualified by its sign treatment; every geometry row prints both the raw field name and the fold applied to it. | test | **PASS** | Observed console:41/51 — `4  Closeness to flip (ranked on -\|dist_to_flip_pct, %\|; nearer the flip ranks first)` and `5  Closeness to nearer wall (ranked on -\|dist_to_wall_pct, %\|; …)` — raw field name **and** fold, on the row. "Distance" appears nowhere in any console. tests `candidate_rows_carry_direction_basis_and_control_rationale`, `geometry_entries_negate_abs_and_basis_names_raw_field`. |
| AC-21 | The saved artifact alone contains every figure and every state marker shown in the console output; nothing quoted on screen is missing from the file. | test | **PASS** | Machine-checked across **9 runs**: **all 1,644** non-blank lines of every cell's `rendered` appear verbatim in that run's console — **0 missing**; and every figure-bearing console line is sourced from an artifact `rendered` string, with **1** non-figure section header aside (`Calibration (quintile bins, pooled)`). The new `per_symbol_note` obeys the same discipline: field first, console reuses it. tests `console_equals_artifact_strings_ac21`, `artifact_alone_carries_every_cells_rendered_string_ac21`. |
| AC-22 | The run prints a version marker for the lab's own output shape, in console and artifact. | review | **PASS** | review/QA — console:11 `version=score_lab_v2-2026-08`; artifact `version: "score_lab_v2-2026-08"` on all 12 successful runs. test `version_marker_is_the_bumped_v2_string_and_v1_never_appears`. |
| AC-23 | Every saved artifact records the report version, the **set** of distinct trading session dates covered (not merely their count), the label threshold value in force, and a stable identifier per candidate that does not change when a display label is reworded. | test | **PASS** | Observed `session_dates: ["2026-08-10"]` (a set), `labels[0].threshold: 0.0035792827633384064`, `candidates[].key` distinct from `candidates[].display`. *Note, unchanged:* the two rule-based labels omit the `threshold` key (§6 note 7). |
| AC-24 | Every metric cell, in console and artifact, is in exactly one of the eight declared cell states, and the artifact records that state as its own value rather than leaving it to be inferred from a missing number. | test | **PASS** | Observed **525/525** cells across 9 runs carry `state` as a first-class tagged value; live histogram `{Computed, NoEligibleRows, DegenerateLabel, NoPairedOutcome}` at cell scope plus `NotRun` on the driver carrier under `--driver-loo false` — none outside the declared set. |
| AC-25 | The ten declared literals plus a bare above-floor value are pairwise distinct in a plain-text paste with no surrounding prose. | test | **PASS** | test `twelve_strings_and_a_blank_are_pairwise_distinct` plus the four supporting proofs (`first_character_partitions_number_present_vs_absent`, `no_absence_literal_begins_with_a_numeral`, `every_literal_ends_with_one_balanced_parenthetical_…`, `every_literal_is_nonempty_with_nonwhitespace_first_char_…`) — all named and passing. PLAN B8's "12 vs 13" settled: SPEC §4 requires 12. |
| AC-26 | `n/a`, a blank, `null`, `NaN`, `-`, and a bare `0` appear in no cell, and no string outside the declared literal set appears in any cell. | test | **PASS** | My own scan over **15 consoles + 9 artifacts**: **0** occurrences of `n/a`, `NaN`, `undefined (`, `too few (`, `not attempted`, `no input (`, `never captured`, `not applicable`; **0** raw JSON nulls. Zero-exclusion headers render `n = 221 (excluded 0)`; the Calibration line carries its counts and a closing parenthetical. |
| AC-27 | A candidate whose input was absent on **every** paired row in a scope renders the no-eligible-rows literal with the count of rows checked and each reason with its own count — and renders no numeric value, no zero and no bare dash. | test | **PASS** | Observed on all **24** `NoEligibleRows` cells, regex-matched: `no eligible rows (0 of 221 paired rows: net_gex not carried or dropped at capture (non-finite/non-positive) 221)`. No numeric metric, no zero, no dash. test `net_gex_candidates_are_all_no_eligible_rows_on_slice_0810`. |
| AC-28 | The row-level reasons are never collapsed into one word: each reason appears with its own count inside the literal's parenthetical, and for `net_gex` / `atm_iv` / `hv_30d` / `iv_hv_ratio` the reason text says the value was not carried **or was dropped at capture as non-finite/non-positive**, never that it was "never captured". | test | **PASS** | Wording observed exactly as required, with the count inside the parenthetical; `never captured` → **0** occurrences across all 15 consoles and 9 artifacts. test `reason_text_wording_for_capture_filtered_fields_never_claims_never_captured`. |
| AC-29 | A candidate that computed over the full row set and found no ranking effect renders a numeric value at chance with its counts, textually distinct from AC-27 in a plain-text paste with no surrounding prose. | test | **PASS** | Observed e.g. `AUC 0.467 (n=221, sessions=1 — under-powered: below session floor 2)` versus literal 3 — the first character partitions digit vs lowercase. Covered by the distinctness set test. |
| AC-30 | A candidate whose value is identical across every eligible row in a scope renders the candidate-constant literal — not a chance-level value, not the absent literal. | test | **PASS** | test `f_const_candidate_renders_degenerate_candidate_for_the_composite` — named, passing. Not producible on either committed slice. |
| AC-31 | A scope in which the label has no positives (or no negatives) renders the label-constant literal for every candidate in that scope, naming the positive and negative counts. | test | **PASS** | Observed **12** cells on the 4-symbol run, e.g. `no variation in the label (74 rows, 0 positive / 74 negative at large_abs_move >= 0.36%; ranking undefined)`; every one names both counts. test `f_no_positives_renders_degenerate_label_for_every_candidate_on_structure_event`. |
| AC-32 | A cell with `n_eligible = 0` and an empty reason map renders the no-paired-outcome or the not-run literal and **never** the no-eligible-rows literal; those three strings are pairwise non-identical. | test | **PASS** | Observed: **15** cells match the antecedent (all DIA), **all 15** render literal 4 and **none** contains `no eligible rows`. Distinctness from the set test. |
| AC-33 | A metric with no value inside a `Computed` carrier — a cell or a candidate-scope record — renders literal 9 or literal 10, never a blank, never `n/a`, never a carrier-level literal, never a substituted `0`. | test | **PASS** | Both must-fire tests present and passing, and both assert the **rendered string**: `literal_9_fires_on_a_three_row_cells_quintile_calibration` (cell scope, `f_thin`) and `literal_10_fires_on_a_const_outcomes_record_correlation_line` (record scope, `f_const_outcome`). In the emitted artifact, carrier-level precedence is respected — DIA's `NoPairedOutcome` record renders literal 4 alone, with no metric-level literal leaking through. |
| AC-34 | A metric-level literal changes neither the carrier's state nor its `n=` / `sessions=`; sibling metrics in the same carrier still render their values; and inside an under-powered carrier the literal renders alone while the carrier's counts and under-powered marker still appear in its block header. | test | **PASS** | `literal_9_fires_on_a_three_row_cells_quintile_calibration` asserts, on the same carrier: state stays `Computed`, `carrier_n == cell.n_eligible` (`comparison.rs:1525`), and all four siblings are still `MetricValue::Value(_)`. My own scan across all 9 runs: **0** absence lines carry `— under-powered:`, and **0** of the 120 value-bearing metric lines lack counts+marker. test `under_powered_marker_appears_only_in_value_bearing_atoms`. |
| AC-35 | Literal 9 prints the statistic's **own** usable count and the statistic's minimum; it never reuses the carrier's `n=` as the statistic's n. | test | **PASS** | Structurally enforced by two independently-sourced fields at both construction sites in the **changed** `comparison.rs`, re-read this pass: `compute_calibration` passes `have: n` where `n = values.len()` beside a separate `carrier_n` parameter (`comparison.rs:280-290`), and `correlation_metric` passes `have: pairs.len()` beside `carrier_n` (`comparison.rs:659-669`). *Recorded gap, unchanged:* all **26** live `UnderMinimum` instances on this slice have `have == carrier_n == 0`, so the property is proven structurally, not by an observed differing instance (§6 note 4). |
| AC-36 | Literal 10 names the failed precondition and the fact that failed it; the bare string `undefined (` appears nowhere in console or artifact. | test | **PASS** | Every `UndefinedOnThisData` in the emitted artifact carries `stat` + `precondition` + `failing_fact` — **48/48** candidate-scope slots plus DIA's two retention estimates. `undefined (` → **0** occurrences across 15 consoles and 9 artifacts. test `undefined_for_this_data_is_never_abbreviated`. |
| AC-37 | No rendered cell ends without its closing parenthesis. | test | **PASS** | **Pass-2 FAIL cleared — I re-ran and counted myself.** **0 of 525** rendered cells across 9 artifacts fail to end with `)` (the 4-symbol run is **0 of 75**, was 6 of 75), and **0** cells have unbalanced parentheses. The cause is repaired at source: the AC-15 caveat now closes on a parenthetical, following the AC-55 coupling mark's precedent. The missing enforcement is closed too — `every_cells_rendered_text_ends_with_its_closing_parenthesis_ac37` runs over the full 75-cell declared grid, pins the 6 caveat cells positively, and **I watched it go red** under a poisoned caveat. |
| AC-38 | The `not applicable` state is reserved and unreachable in v1: no cell in any run or fixture carries it, and the artifact's literal legend marks it `reserved — not reachable in v1`. | test | **PASS** | Observed: `not applicable` → **0** occurrences across 15 consoles and 9 artifacts; `literal_legend["7_not_applicable"] = "reserved — not reachable in v1"`. test `not_applicable_marked_reserved_in_the_legend`. |
| AC-39 | When the attribution block ran and no loaded row carried a driver breakdown, the block renders the no-eligible-rows literal naming how many of how many rows were checked — and prints no rows of `n = 0`. | test | **PASS** | Observed console:406 `Driver attribution: no eligible rows (0 of 221 loaded samples: score_drivers absent 221)`; artifact `driver_attribution.entries` is `[]`, `n_with_drivers: 0`; no `n = 0` row printed. |
| AC-40 | When the attribution block was switched off by its flag, the block renders the not-run literal naming that flag — never the no-eligible-rows literal, and never a blank section. | test | **PASS** | **Exercised on the real CLI.** `--driver-loo false` → exit **0**, console:406 `Driver attribution: not run (--driver-loo off; 221 samples loaded, none examined)`, artifact `flag_on: false` — literal 8, naming the flag, no blank section. Four named guard tests including the anti-vacuity `driver_loo_bare_switch_form_is_rejected` and `driver_loo_defaults_to_true_when_omitted`. |
| AC-41 | When some loaded rows carry a driver breakdown and others do not, attribution is computed on those that do and reports its reduced count plus the excluded count. | test | **PASS** | test `build_driver_attribution_computes_on_rows_with_drivers_and_reports_the_excluded_count` over the `f_drivers_mixed` fixture — named, passing. Not producible on either committed slice (slice A has 0/221 with drivers). |
| AC-42 | A live capture that produces an otherwise-ok row with an empty driver breakdown emits a log line naming the symbol and the time, so a present-day regression is distinguishable from a pre-2026-08-10 capture. | test | **PASS** | Four named passing tests on the decision predicate `should_warn_missing_drivers` (`store.rs:78`): `ok_row_with_score_and_no_drivers_should_warn` (fire), `ok_row_with_score_and_drivers_should_not_warn`, `non_ok_status_never_warns_even_with_score_and_no_drivers`, `ok_row_with_no_score_never_warns`. *Noted, unchanged:* the log line itself was never observed — no capture in this environment produced such a row. |
| AC-43 | The evidence block is the first block of both console output and artifact on **every** run — including partial, degenerate and stale runs — and its one-line form is repeated at the end of the console output. | test | **PASS** | Observed on all 12 successful runs: `RESEARCH READ — NOT A PRODUCT RULING` is the first report line and `Evidence: …` is the penultimate line (409-line run → header line 1, one-liner line 408). tests `evidence_header_is_first_block_and_contains_no_verdict_language`, `evidence_one_liner_repeats_at_the_end`. *Recorded, unchanged:* on `--store` runs one tracing INFO line precedes the header on stdout (§6 note 6). |
| AC-44 | The run's evidence class is derived from the distinct-session count and the group set, never a constant: two fixtures (1 session vs 3 sessions) emit different evidence-class tokens. No cell or header contains `AT BAR`, `BELOW BAR`, `PASS`, `FAIL`, `MEETS`, `above the bar` or `below the bar`. | test | **PASS** | tests `two_fixtures_emit_different_evidence_class_tokens`, `evidence_class_single_session`, `evidence_class_multi_session_under_two_weeks`, `evidence_class_multi_week_at_or_above_fourteen_calendar_days`, `no_output_contains_banned_verdict_tokens`. My own scan: **0** occurrences of every banned token across 15 consoles and 9 artifacts. |
| AC-45 | The evidence header's wording matches the approved copy in §4 — including the bar's own text printed verbatim beside the run's values, the line stating that the multi-week half is not evaluable from one run and why, and the sentence "Ranking a candidate signal here is not adopting it." | review | **PASS** | review/QA against §4's block, line by line: bar text verbatim at console:5; the "Not evaluable here" fact line at console:6 ending `derived from these rows over 2026-08-10→2026-08-10; not a stored constant, and it moves when the capture rate moves`; the closing sentence at console:8. Human window, no epoch floats. *Recorded gap, unchanged: §6 note 2.* |
| AC-46 | Every run — console and artifact — carries the slice's span, its count of distinct trading sessions, its sample counts, and an explicit statement that the run authorizes no score change. Deleting the prose around the numbers cannot remove it. | test | **PASS** | All four present as first-class fields on every successful run (`window_utc_first`/`_last`, `session_dates`, `n_samples_loaded`/`n_outcomes_loaded`/`n_paired`, `authorizes`) and in the console. |
| AC-47 | A slice covering fewer than two distinct trading sessions is labelled single-session in both console output and artifact, and the window banner appears on the metric tables themselves, not only in the header block. | test | **PASS** | `SINGLE SESSION (d=1)` in console:2, artifact `evidence_class`, and on every cell's own `evidence_class`. The window banner appears **on the metric tables** at console **18, 152, 400** (blocks 4, 6, 7). test `window_banner_appears_on_the_metric_tables_not_only_the_header`. |
| AC-48 | Every cell prints its row count **and** its distinct-session count, in console and artifact. | test | **PASS** | Artifact: **525/525** cells across 9 runs carry both `n_rows` and `n_sessions`. Console: `Computed` cells print `n = … · sessions = …` plus `(n=…, sessions=…)` on every value atom; absence literals carry row counts, per §4's pinned shapes 3–6. |
| AC-49 | A cell below the printed row floor **or** below the printed session floor renders its value, its counts and the under-powered marker as **one literal**, naming which floor(s) it fell below; no line break, column boundary or truncation may separate the number from its marker. | test | **PASS** | Machine-checked over all **120** value-bearing metric lines in the 4-symbol run: **0** missing `(n=…` or `— under-powered: below session floor 2`. Every marker is on the same physical line as its number. test `under_powered_marker_appears_only_in_value_bearing_atoms`. |
| AC-50 | Both floors in force are printed as numbers once per run, in console and artifact, and the floor named in a marker equals the printed floor. | test | **PASS** | console:13 `row_floor=30 · session_floor=2`; artifact `row_floor_in_force: 30`, `session_floor_in_force: 2`; markers name `below session floor 2` — equal. |
| AC-51 | A cell drawn from exactly one distinct session carries the single-session marker even when its row count is above the row floor. | test | **PASS** | Observed: `n=221` (above row floor 30), `sessions=1` → `— under-powered: below session floor 2` on every value atom of every `Computed` cell; the marker names the session floor only, never the row floor. |
| AC-52 | A cell above both floors carries **no** under-powered marker and no single-session marker. | test | **PASS** | test `power_evaluate_matches_floors` asserts `Power::evaluate(30, 2) == Powered` alongside three under-powered cases — presence **and** absence both asserted. Not producible on any committed slice (B0b open). |
| AC-53 | No cell's value is suppressed for being below a floor: every computed value appears in both console and artifact, marked; a below-floor cell is textually distinct from every absence literal, from an above-floor value and from a blank, in a plain-text paste with no surrounding prose. | test | **PASS** | Machine-checked: **0** of the 24 `Computed` cells withhold any of `auc`/`lift`/`precision`/`recall`/`calibration`; all 120 lines render marked. `— under-powered:` appears in **0** absence lines (my own scan across 9 runs), so a thin number and an absence can never collide. |
| AC-54 | The report contains no adoption or verdict language: no candidate is described as better, best, winning, recommended, promising or ready, and no per-run pass/fail against the multi-week bar appears. Enforced by a scan over the run's own strings. | test | **PASS** | My own case-insensitive scan over **15 consoles** for `best\|winner\|winning\|recommended\|promising\|predictive\|accuracy\|orthogonal\|independent\|validated\|backtested\|proved\|hit rate\|success rate\|next step\|performance\|quality` → **0 matches**. test `no_output_contains_banned_verdict_tokens`; scan guards in `scan_guards.rs` incl. `scanner_bites_on_a_synthetic_dirty_string`. |
| AC-55 | Any candidate × label pair whose **declared derivation provenance intersects** is marked as definitionally coupled wherever its figure appears, inside the cell's own text, naming the shared derivation keys. | test | **PASS** | Observed **inside `Cell.rendered`** on all 15 coupled cells, each with a non-empty `shared_keys`, e.g. `definitionally coupled with structure_event (shared: flip, call wall, put wall)`. test `coupled_cells_rendered_text_carries_the_mark_and_shared_keys`. |
| AC-56 | No column header, row label or note uses a banned term from the vocabulary table in §4, and no output contains a recommendation, adoption verb or "next step" implying a score change. | review | **PASS** | review/QA — I read the full 409-line console and every string field of the artifact, including the two **new** strings this pass added (`per_symbol_note`'s single-symbol arm and the reworded caveat). Both conform: "pooled", "cross-symbol summary", "not symbol-comparable", "the honest read" — no banned term, no adoption verb, no next step. Backed by the scan in AC-54. |
| AC-57 | The artifact contains a cell for every candidate × label × group in the declared grid — none omitted for width or any other reason. When the console narrows, it drops metric columns, never markers, counts or qualifiers. | test | **PASS** | First half observed (key-set equality on 9 artifacts, 525 cells). Second half holds vacuously and I re-checked it on the **changed** `render.rs`: **0** occurrences of any width/terminal/COLUMNS/truncate logic, so nothing can be dropped. |
| AC-58 | The primary-KPI block appears before any secondary-label block in both console and artifact, and each secondary block is labelled as secondary. | review | **PASS** | review/QA — machine-checked on the 409-line console: last primary-label content line **151**, first `[secondary]` token line **153**; secondary headings at 153 (`up_move`) and 246 (`structure_event`); 52 lines carry `[secondary]`. Console order is §4's fixed 4→5→6. test `primary_block_precedes_every_secondary_block_for_every_candidate`. (The artifact's `cells[]` is a flat declared-order vector by design — §2.8.) |
| AC-59 | A run with zero paired rows fails loudly, names which of the three causes fired (no samples loaded / no outcomes loaded / no overlap at this horizon) with each count, prints the exact next command, and leaves **no** artifact that could later be read as a run with no findings. | test | **PASS** | **All three causes observed live**, each exit 1 with **no artifact written** (verified by `ls`): `(no overlap at this horizon). Samples loaded: 592. Outcomes loaded: 221.` · `(no outcomes loaded). Samples loaded: 221. Outcomes loaded: 0.` · `(no samples loaded). Samples loaded: 0. Outcomes loaded: 221.` — each followed by `Run join-outcomes first: cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM`. tests `zero_overlap_at_horizon_names_no_overlap`, `samples_present_but_no_outcomes_names_no_outcomes_loaded`, `zero_samples_and_zero_outcomes_names_no_samples_loaded`. |
| AC-60 | A requested horizon for which no outcomes were labelled fails naming that horizon, rather than reporting zeros for every candidate. | test | **PASS** | Observed `--horizon 99d` → `error: No outcomes were labelled for horizon=99d. Horizons present in this outcomes file: [1d]`, exit 1, no artifact. test `unlabelled_horizon_fails_naming_it_not_zeros`. |
| AC-61 | A missing or unreadable outcomes input fails naming the path it tried, and writes no artifact. | review | **PASS** | review/QA — observed `error: Could not read input does/not/exist.json: The system cannot find the path specified. (os error 3)`, exit 1, output file not created. |
| AC-62 | When the analytics read for any symbol cannot be served in full, the run aborts naming that symbol and the underlying error, before any metric is computed and before any artifact is written; it never reports that symbol's analytics fields as absent. | test | **UNVERIFIABLE** | **Precise blocker, unchanged and environmental:** the degraded-read condition exists only on the Postgres backend, and `read_structure_history_strict` is behind `--features postgres`. There is no `DATABASE_URL` and no Postgres instance here, so the failure condition cannot be produced. What *was* established: `cargo check -p api-rust --features postgres` exit **0**; `strict_collect_aborts_on_first_failure_naming_the_symbol` and `serve_path_keeps_its_fallback_and_the_lab_path_has_none` pass; `strict_collect` runs before `run_lab`, which is before any artifact write. **Not a regression** — same verdict as passes 1 and 2. |
| AC-63 | Progress lines name the phase during a long store read. | review | **PASS** | review/QA — observed on stderr during a `--store data/scan.json` run: `score-lab: reading structure history from the store…` then `score-lab: loading IWM…` / `QQQ` / `SPY`. |
| AC-64 | When the newest paired sample predates the run beyond one session, the stale-diary line appears naming both dates. | test | **PASS** | **Observed firing** on every fixture run: console:9 `Newest sample 2026-08-10 (1.9 days before this run) — this read describes an older diary, not today`, with the run date on console:11. Threshold `STALE_DIARY_SESSION_DAYS = 1.0` (`render.rs:12`, used at `:110` — re-read on the changed file). test `stale_diary_line_fires_beyond_one_session_not_same_session` asserts both directions. |
| AC-65 | The lab completes with no vendor credential present in the environment. | test | **PASS** | Observed: `MASSIVE_API_KEY= ./api-rust score-lab …` (empty value wins over `.env`) → exit **0**, full 361-line report emitted. My scan of the four changed files finds **no** `reqwest` / `Client::new` / `env::var` — no HTTP client is constructible on the CLI path. |
| AC-66 | The diary/sample store is byte-identical before and after a run — the lab reads and never writes to it. | test | **PASS** | Observed twice. (a) In place: `md5sum data/scan.json` identical before/after a `--store data/scan.json` run (`082df11d9ed00097b03d68fcb3f6bb63`), `cmp` clean. (b) **Isolated** (because the :8000 orphan mutates that file independently — §0): a private copy of the store, run against with `--store`, is **byte-identical** before and after. |
| AC-67 | For a fixed ticker, the score, tier and state fingerprint served by the app are byte-identical before and after this feature, and the feature's diff touches no file on the scoring path except the log-only capture warning. | test | **PASS** | Second clause observed directly and is the stronger evidence: `git diff --stat d16c32d -- libs/quant-engine apps/api/src/services/scanner/projection.rs apps/api/src/services/analytics.rs apps/api/src/routes` (committed **and** working tree) → **empty**. `cargo test -p quant-engine` → 65 passed, incl. `signals_byte_identical_to_python_fixtures` and `exact_parity_set_spy_qqq_nvda`. This pass's four files are all under `services/research/` — **no scoring-path file was touched**. |
| AC-68 | The running server exposes no new route for lab results and no change to the routes it exposed before this feature; `GET /api/scan/{symbol}/history` answers 200 with its existing shape (see `INTERFACE_CONTRACT.md`). | test | **PASS** | **My own** conformance re-run against my own current-source server on **:19311**: `conformance-receipt-qa.json` verdict **PASS**, 1/1 endpoint, 7 required fields present + well-typed, 200 with the full envelope. Probed `/api/research`, `/api/research/lab`, `/api/score-lab`, `/api/lab`, `/api/scan/SPY/lab` → all **404**. `git diff -- apps/api/src/routes` empty. |
| AC-69 | A run over the **committed 2026-08-11 fixture** (a samples file and an outcomes file read through the file input path, never the live diary) reports for the composite candidate, pooled, the base rate, ranking metric and lift@top decile the pre-feature lab reported for that slice — AUC 0.467 and lift@top decile 0.17 against `large_abs_move` — asserted against the retained parity oracle. | test | **PASS** | Observed through `--samples`/`--outcomes` (never the diary): `auc 0.46744471744471744`, `lift_top_decile 0.17312965139052094`, `base_rate 0.502262443438914` — compared to `pre_feature_report.json` by `repr()` equality, not by eye. tests `slice_0810_reproduces_the_pre_feature_report`, `pooled_composite_large_abs_move_reproduces_pre_feature_constants`. |
| AC-70 | On that same fixture, the SPY and QQQ candidate-scope records for the composite candidate report **opposite-signed** association with the continuous outcome, each stating its sign. Asserted as a sign-and-ordering claim, never to two decimals. | test | **PASS** | Observed in `candidate_scope[].rendered`: `Pearson vs abs_move   0.51 (n=74)` (SPY) versus `Pearson vs abs_move   -0.31 (n=73)` (QQQ) — opposite-signed, each carrying its sign and its own n; full precision survives in `correlations` (`0.51016091304366` / `-0.30751440624493687`). |
| AC-71 | For the same slice and horizon, the composite candidate's pooled base rate, ranking metric, precision@top decile and lift@top decile match what the pre-feature lab reported. Calibration bin edges change with the new binning rule; that change is declared by a bump of the printed report version, and both the pre- and post-change values are recorded. | test | **PASS** | All four match exactly on all three labels (§0's 15-constant check). Version bumped to `score_lab_v2-2026-08` with `version_marker_is_the_bumped_v2_string_and_v1_never_appears`. Pre-change equal-width bins recorded in the committed `pre_feature_report.json`; post-change quintile bins with `quantile_lo/hi` **and** native `edge_lo/hi` recorded in the artifact. |
| AC-72 | Every published figure that was **hand-derived** — the deep dive's per-symbol table, which its own heading marks `(hand-paired)` — appears only as a difference log beside the run's own cells, prefixed `hand-derived, unvouched:`, with any divergence named and attributed to the pooled-once threshold scoping. No hand-derived figure is asserted as a test oracle. The global ranking-metrics table (including the composite's 0.932 against `structure_event`) was tool-produced and is **not** labelled hand-derived. | review | **PASS** | review/QA — `SCORE_LAB_DEEP_DIVE_2026-08-11.md:77-89`: heading `(hand-paired)`, both figure columns prefixed `hand-derived, unvouched:`, the run's own cell beside each row with the divergence attributed to the pooled-once threshold. I re-checked the quoted run-cells against **my** run: SPY literal 6 verbatim, QQQ AUC ≈ 0.38 (mine 0.384), IWM AUC ≈ 0.293 (mine 0.293). Doc untouched this pass (mtime 12:16). |
| AC-73 | Every item the weekly runbook's Record step asks for is readable directly off one run's output, with no hand computation and no second command; the runbook's Record step instructs paste-not-retype, and the bar lives in the emitted output rather than only in the runbook. | review | **PASS** | review/QA — `WEEKLY_SCORE_LAB_RUNBOOK.md` Record step re-read against my own run: evidence header ✅ (console:1-9), pooled composite × `large_abs_move` AUC + Lift with `n=`/`sessions=` ✅ (console:22-27), per-symbol section ✅ (61-151), `definitionally coupled` marks ✅, retention line ✅ (console:6). *"Paste the emitted evidence block and tables. Do not retype numbers."* present; the Pass-bar section defers to the tool's emitted bar text and restates no numbers. |
| AC-74 | The runbook's existing invocation still works unchanged and now returns the comparative, per-symbol report — comparative is the default, not an opt-in flag. | review | **PASS** | review/QA — `score-lab --help` shows the same flag set (`--outcomes --horizon --store --samples --symbols --out --driver-loo --json`); **no new flag was added by this pass**. A bare `--samples/--outcomes/--horizon` run returned the full comparative per-symbol report (361 lines, 60 cells). `--driver-loo` still defaults to `true` when omitted. |
| AC-75 | Literal 10 is reachable and literal 6 covers the case it does not: on a fixture where a candidate's values vary but the continuous outcome is constant across the usable pairs, that candidate-scope record is `Computed` and its correlation line renders literal 10 naming the failed precondition; on a fixture where a scope has no positives, every cell in that scope renders literal 6 and **no** metric-level literal appears anywhere in that scope. | test | **PASS** | `literal_10_fires_on_a_const_outcomes_record_correlation_line` (over `f_const_outcome`) asserts, in order: the record's state is `Computed`; both pearsons are `Absent(UndefinedOnThisData{precondition: "the outcome to vary"})`; and `record.rendered.contains("undefined for this data")`. The literal-6 half stays covered by `f_no_positives_renders_degenerate_label_for_every_candidate_on_structure_event`. Both named and passing. |
| AC-76 | The set of candidate × label pairs marked definitionally coupled over the declared grid equals the pinned expected set — in v1 exactly `proximity_to_flip × structure_event`, `proximity_to_nearer_wall × structure_event` and `opportunity_score × structure_event`, in every group. Emptying or narrowing any registry `derived_from` declaration fails this test rather than silently unmarking a cell. | test | **PASS** | Observed over the real 75-cell artifact: coupled pairs = **exactly those three**, `definitionally_coupled: true` on **15** cells = 3 pairs × 5 groups, `false` on the other 60. Six named pin tests including four genuine poison tests (`emptying_structure_events_derived_from_empties_the_set`, `narrowing_the_composite_to_score_only_drops_the_pair`, `adding_flip_to_large_abs_move_adds_two_pairs`, `an_unrelated_shared_key_on_both_sides_adds_a_pair`). |
| AC-77 | Every candidate whose declared derivation set intersects another candidate's prints a shared-derivation note wherever its own label appears, naming the other candidate(s) and the shared keys; the composite score's note names both geometry candidates and their shared level keys. The note is distinct from the definitional-coupling mark and never replaces it. | test | **PASS** | Observed on all five candidate labels (console:20, 30, 36, 42, 52); the composite's note names **both** geometry candidates and `(flip, call wall, put wall)`. Distinct from, and co-present with, the coupling mark on the same run. tests `shared_derivation_note_present_on_all_five_with_expected_partners`, `shares_derivation_with_is_exactly_the_declared_pairs`, `every_note_starts_with_the_fixed_prefix`. |
| AC-78 | Every retention figure the run prints — samples held, sessions covered, observed samples-per-session and the implied cap-holds-sessions estimate — is **derived from that run's own loaded rows**, per requested symbol, and is labelled an estimate over a stated window. Two fixtures with different capture rates produce different printed figures. The only retention constant in the emitted copy is the cap itself; no session-count or samples-per-day figure appears as a literal anywhere in the emitted strings. | test | **PASS** | Observed 4 `retention[]` entries in requested order: SPY `74 of 576 held · 74.0/session over 1 session · cap holds ~7.8 sessions`, QQQ `73 … ~7.9 sessions`, IWM `74 …`, DIA `samples_loaded: 0` with **both** estimates `Absent{UndefinedOnThisData{failing_fact:"DIA has 0 loaded samples in this run"}}` and `rendered` = literal 3. Cap sourced from `STRUCTURE_HISTORY_MAX`. tests `retention_figures_are_derived_not_constant`, `the_two_slices_have_materially_different_capture_rates`, `retention_sessions_agree_with_the_cell_level_session_counts`, `a_requested_symbol_with_no_samples_still_gets_a_retention_entry`, and `no_retention_literal_appears_in_emitted_strings_or_source` — **whose emitted arm I poisoned and watched go red at `artifact.rs:930`** on this pass's `render.rs` (§0). |

---

## 2. Summary

| Verdict | Count |
| --- | --- |
| **PASS** | **77** |
| **FAIL** | **0** |
| **UNVERIFIABLE** | **1** |
| Total | 78 |

- **UNVERIFIABLE:** AC-62 (environmental — no Postgres; unchanged from passes 1 and 2, **not a regression**)

**Automation depth (risk-based).** Every `test`-marked criterion maps to ≥1 named, passing test,
recorded per row above; every `review` criterion was confirmed by inspection of a real run's output,
not of source. The **two automation gaps pass 2 named are closed**:

- AC-37 had **no test at all** — `vocabulary.rs:521` asserted the property only for the ten literals
  in isolation. It now has `every_cells_rendered_text_ends_with_its_closing_parenthesis_ac37`, at
  **cell scope over the full 75-cell declared grid**, with a positive pin on the 6 caveat cells.
- AC-14's only test asserted numbers. It now also has
  `single_symbol_run_states_pooled_is_that_one_symbol_over_the_same_rows`, asserting the statement in
  **both** surfaces plus the multi-symbol non-regression.

**The suite is not hollow.** I did not take the green at face value: I poisoned three separate
product-source subjects and watched three different tests go red at three different assertions, then
restored all three byte-identically and re-ran the suite to 249 / exit 0.

---

## 3. Independent conformance

| | Backend receipt | **QA receipt (authoritative)** |
| --- | --- | --- |
| File | `conformance-receipt.json` | `conformance-receipt-qa.json` |
| Verdict | PASS | **PASS** |
| base_url | `http://127.0.0.1:19102` | `http://127.0.0.1:19311` |
| checked_at | 2026-08-12T21:10:01Z | 2026-08-12T21:26:17Z |
| Endpoints | 1/1 pass, 7 required checked | 1/1 pass, 7 required checked |

**No divergence.** My run was against a server I built from the code now on disk, on a port I chose,
**never :8000**. The wire-visible regression this block exists to catch — the strict analytics read
having been applied to the shared `read_structure_history` — did not occur:
`GET /api/scan/SPY/history?limit=5` returned **200** with the full envelope (`symbol`, `basis`,
`stored_count`, `backend`, `samples[]` with `symbol`/`as_of`). This pass touched no route, no
`pg_scan.rs`, and no `StructureSample`. Conformance is **PASS**.

---

## 4. Binding-invariant watch (BRIEF + promoted canon)

| Invariant | Verdict | Evidence |
| --- | --- | --- |
| `[score-change-is-deliberate-and-measured]` | **HOLDS** | No weight, constant, threshold or fingerprint basis changed by this pass — its four files are all under `services/research/`. Every run emits `Authorizes: nothing…` and `Ranking a candidate signal here is not adopting it.` from the tool. No `AT BAR`/`BELOW BAR`/pass-fail token anywhere (0 hits, my own scan over 15 consoles). |
| `[additive-keeps-score-byte-identical]` | **HOLDS** | Empty diff over `libs/quant-engine`, `projection.rs`, `analytics.rs`, `apps/api/src/routes` — committed **and** working tree. `quant-engine` 65/65 green including the Python-fixture byte-identity test. |
| `[operator-vs-trader-path-separation]` | **HOLDS** | No new route (5 probes → 404; routes diff empty); no vendor call (no HTTP client constructible in the four changed files; empty-key run exit 0); the diary is read-only (isolated-copy proof, §0); `NO_UI_CHANGE` structurally confirmed (0 frontend files). |
| `[model-read-carries-its-assumptions]` | **HOLDS** | Re-verified on the pasted surface, not the registry: human window + duration on the header **and** as a banner on blocks 4/6/7; basis expression, ranking direction and vol-basis mix on every candidate row; geometry raw field + fold; label definition + threshold in **75/75** cell blocks; and the not-symbol-comparable caveat as a field **and** in the cell's own text. **This pass strengthened it:** a single-symbol run now states the assumption that pooled *is* that one symbol, instead of asserting the opposite. |
| `[absent-is-not-none]` | **HOLDS** | §5 C1 stays closed **in the emitted artifact**: 48/48 candidate-scope ranking-metric slots carry `Absent{UndefinedOnThisData}` with a named `precondition` + `failing_fact`; 0 fabricated `auc 0.5 / lift 1.0`; `correlations`/`role`/`basis` at full precision; DIA's retention estimates are tagged absences; carrier-level precedence respected (DIA's record renders literal 4 alone). Literals 9 and 10 both retain must-fire fixtures asserting the *rendered string*; literal 8 reachable from the shipped CLI (observed). |
| `[best-effort-isolated-or-null]` | **HOLDS** | Per-candidate exclusion by reason with counts, verified arithmetically over **525 cells** (closure 0 violations) and **105 group × label** IDENTITY-3 checks (0 violations). No candidate's ineligibility touched another's row set. |
| `[structural-over-prose-enforcement]` | **HOLDS** (strengthened) | The property that landed green last pass now has a test at the right scope, and I proved the bite: **three poisons, three reds, three different assertions** (`comparison.rs` cell-scope paren; `artifact.rs` single-symbol branch; `render.rs` runtime-assembled retention literal caught at `artifact.rs:930`). |
| `[dark-pool-context-only]`, `[digested-labels-not-raw-dump]` | **HOLD** | Off-exchange declared as a determinant only; the artifact carries labelled cells and closed-vocabulary states, no raw series, nothing fed to the AI. |

**No invariant is broken.**

---

## 5. Criteria-independent Critical sweep (this pass's changed code)

Scope: `artifact.rs`, `comparison.rs`, `render.rs`, `run.rs` — the four files newer than pass 2's
observation point — read in full over their production halves, independent of any named AC.

- **No auth, authorization, tenancy or secret-handling code is present or changed.** Scan of the
  four production halves: **0** occurrences of `unsafe`, `panic!`, `std::process`, `Command::new`,
  `env::var`, `reqwest`, `Client::new`, `fs::write`, `fs::remove`, `fs::create`, or any SQL. The lab
  constructs no HTTP client and reads no credential; the empty-`MASSIVE_API_KEY` run completed at
  exit 0.
- **No destructive data operation.** These files write nothing at all — `run::run_lab` is pure
  (`run.rs:1` "Reads nothing, writes nothing") and the single artifact write stays in `main.rs:644`,
  **after** `run_lab` returns `Ok`. I exercised **five** failure paths and confirmed by `ls` that
  **no artifact was written on any of them**. The store is read-only (isolated-copy proof).
- **The new operator-controlled string path is safe.** `per_symbol_heading` interpolates a
  `--symbols` value into the report. I probed it: lowercase folds (`spy` → `SPY`), whitespace is
  trimmed, and an injection-shaped symbol (`SPY","evil":"x`) is simply filtered out by the whitelist
  intersection, failing loudly at exit 1 with no artifact. The value reaches only a console string
  and a serde-escaped JSON field — no shell, no SQL, no HTML sink.
- **`--symbols` remains a narrowing whitelist intersection** applied once before pairing; it cannot
  widen the row set.
- **One defensive note, not a finding:** `render.rs:182` `CANDIDATES.iter().find(…).unwrap()` — the
  key is always drawn from the same registry it searches, so it is total by construction; it is the
  only `unwrap()` in the four production halves.

**No new Critical finding, and no criteria gap requiring a spec amendment.** The one behavioural
oddity I found (duplicate `--symbols` entries, §6 note 1) is an input-hygiene gap on malformed input,
not a security, integrity or destructive-data defect.

---

## 6. Recorded, non-blocking (no verdict assigned)

1. **NEW — a duplicated `--symbols` entry is not de-duplicated.** `--symbols " SPY , SPY "` →
   `requested_symbols=[SPY,SPY]`, **45 cells with 15 duplicate `(group,candidate,label)` keys**, the
   SPY per-symbol block printed **twice** with identical figures, and two identical `retention[]`
   entries. Every individual number stays correct — pooled `n_paired` is **74**, not double-counted,
   and closure holds on all 45 cells — so this is repetition, not a measurement error. It also
   predates this pass (it arrived with the `--symbols` filter in bounce 1). Under a strict reading,
   the printed composition identity for that malformed input reads pooled 74 versus Σ per-symbol 148.
   Worth one `dedup()`. Related: on `--symbols SPY,DIA` (one symbol *surviving*) the multi-symbol
   heading still prints — defensible, because DIA's 15 cells say `no paired outcome` explicitly, so
   pooled is not *silently* one symbol; AC-14 is written about a single-symbol **run**, which is what
   was fixed and verified.
2. **The "Not evaluable here" retention figure names no symbol** and prints only one symbol's figures
   on a multi-symbol run (`74 of 576 held · 74.0/session…`, where §4's instance reads
   `SPY 250 of 576 over 2 sessions, 125/session`). All four symbols' figures are in `retention[]`.
   Unchanged from pass 2.
3. **AC-19's distinguishability clause is untested and unexercised.** The triple is `{0,0,0}` on the
   only slice that runs, and no test asserts that two different mixes render differently (contrast
   AC-78's two-fixture `retention_figures_are_derived_not_constant`). Unchanged from pass 2.
4. **AC-35 has no runtime instance where `have` ≠ `carrier_n`.** All **26** live `UnderMinimum`
   instances in the 4-symbol artifact are `(pearson, needs 3, have 0, carrier_n 0)`, so "never reuses
   the carrier's n" is proven structurally by two independently-sourced fields rather than by an
   observed differing instance. Unchanged from pass 2.
5. **The `stats::pearson` epsilon is absolute, not relative to scale** — it declares a series constant
   at stdev ≲ 1e-6 in that series' own units. `stats.rs` was **not touched this pass**, and the
   oracle still reproduces bit-for-bit, so nothing here moved. Unchanged from pass 2.
6. **`--store` runs emit one tracing INFO line to stdout before the evidence header.** Unchanged.
7. **`labels[].threshold` is omitted (not a tagged absence) for the two rule-based labels** in the
   artifact, while the console renders `threshold=no numeric threshold (rule-based label)`. Unchanged.
8. **B0b remains open** — `slice_current/outcomes.json` absent, the guard SKIPs loudly, V3b was never
   run, and no slice can produce a cell above both floors. **Do not synthesise outcomes.**
9. **The pooled "Calibration (quintile bins, pooled)" block lists 3 of 5 candidates**, with no literal
   for the two dispositioned at carrier level. Unchanged from passes 1 and 2.
10. **ENVIRONMENT — `data/scan.json` is being rewritten by the :8000 orphan (PID 58588)**, several
    times a minute, growing the file. It is unrelated to this feature (proven: the file changed while
    nothing of mine was running), but it will corrupt any naive before/after byte-identity check in a
    future verification pass. Use an isolated copy, as I did. The orphan also still holds
    `target/debug/api-rust-orphan-locked.exe`.

---

## 7. Delta vs pass 2

**Pass 2: 75 PASS / 2 FAIL / 1 UNVERIFIABLE → pass 3: 77 PASS / 0 FAIL / 1 UNVERIFIABLE.**

### Repaired — both of the two, verified by observation and by making the new guards bite

| AC | What pass 2 observed | What I observed now |
| --- | --- | --- |
| **AC-14** | `--symbols SPY` printed the multi-symbol heading `Per symbol — pooled above is not a summary of these` — the opposite claim; `same rows` / `one symbol` / `single symbol` → 0 hits in console and artifact; the only test asserted numbers | Console:61 **and** artifact `per_symbol_note` both read `Per symbol — single symbol requested: pooled above is that one symbol (SPY) over these same rows, so pooled is not a cross-symbol summary`; computed once and reused (one construction site); **multi-symbol heading byte-identical on 8 runs**; new test asserts both surfaces and **goes red** when the branch is disabled |
| **AC-37** | 6 of 75 cells ended without `)` — the AC-15 caveat appended unparenthesized; no test at cell scope | **0 of 525** cells across 9 artifacts fail to end with `)`; **0** unbalanced; caveat closes on `(see the per-symbol cells for the honest read)` and AC-15's meaning is intact; new cell-scope test over the full 75-cell grid **goes red** when the paren is removed |

### Regressed from PASS — none

All 75 pass-2 PASSes were re-verified from scratch on live runs and **all 75 still hold**. The
regression risk this pass carried was real — the fix touched `artifact.rs`, `comparison.rs`,
`render.rs` and `run.rs`, i.e. the whole render/artifact surface most criteria are observed through —
so the highest-risk properties were re-checked at full breadth rather than spot-checked:

- **The parity oracle is untouched** — all 15 pinned constants reproduce by `repr()` equality;
  `stats.rs` was not modified this pass (mtime 13:19 < the 14:04+ edits).
- **The grid survived the render changes** — key-set equality, no duplicate keys and state-presence
  hold on **9** artifacts (525 cells); closure 0 violations over 525 cells; composition 0 violations
  over 135 pairs; IDENTITY-3 0 violations over 105 group × label.
- **AC-15 did not regress while AC-37 was repaired** — the caveat is still on exactly the 6 pooled
  GEX cells, still inside each cell's text, still saying both things the criterion requires. This was
  the specific hazard (pass 2's AC-37 failure *was* pass 1's AC-15 fix), and it did not repeat.
- **AC-21's artifact↔console equality survived the new field** — 1,644 rendered lines checked across
  9 runs, 0 missing; the new `per_symbol_note` obeys the same field-first discipline.
- **The retention guard still bites on the edited `render.rs`** — proven, not assumed.

---

## 8. Overall verdict

# GATE Q — PASS

Both bounced criteria are genuinely repaired, and I did not take either on trust: AC-14's statement
was read off a live single-symbol run in **both** surfaces with the multi-symbol arm proven
byte-identical on eight runs, and AC-37's count was re-derived by me over **525 rendered cells across
nine artifacts** — zero failures, where pass 2 measured six. The two new tests exist under the names
claimed, pass, and **bite**: I poisoned each one's subject in product source and watched it go red,
plus a third poison to re-confirm the retention guard on the `render.rs` this pass edited. All three
poisons were restored byte-identically (`git diff -- apps/api` empty) and the suite returned to
**249 passed / exit 0**, checked by exit code.

Nothing regressed. The full AC-1 … AC-78 sweep was re-run rather than narrowed, because the fix
touched the whole render/artifact surface — and the properties most exposed to it (the parity oracle,
grid totality, the three identities, the artifact↔console equality, and AC-15 itself) were re-verified
at full breadth. Every binding invariant holds, one of them strengthened by this very fix:
`[model-read-carries-its-assumptions]` no longer has a run that asserts the opposite of its own data.
Conformance is **PASS on my own receipt**, against my own current-source server on my own port, never
:8000. `--features postgres` checks clean. `NO_UI_CHANGE` is structurally confirmed.

The single non-PASS is **AC-62**, UNVERIFIABLE by environment — the degraded-analytics-read condition
exists only behind Postgres, which does not exist here. That is the same verdict passes 1 and 2
recorded and is not a regression; it will need a Postgres environment or a fault-injection harness to
close, and it should not hold this feature.

Two things stay open and are named here so they are not lost in the PASS: **B0b** (no
`slice_current/outcomes.json`, so V3b has never run and no cell has ever cleared both floors — the
guard SKIPs loudly and no outcomes may be synthesised), and the ten recorded items in §6, of which
the newly found one — a duplicated `--symbols` entry printing a symbol's block twice — is the only
one I would ask the Backend lane to look at deliberately.

Route to GATE S.

---

## 9. Amendments bounced to Backend

**None.** No criterion failed. The §6 items are recorded observations with repros, not amendments; no
fix is proposed and none was made.
