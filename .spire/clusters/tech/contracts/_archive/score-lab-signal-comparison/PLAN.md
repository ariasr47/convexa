# score-lab-signal-comparison Implementation Plan

> **For agentic workers:** implement task-by-task, in order. Steps use checkbox (`- [ ]`) syntax.
> Each task carries its own TDD cycle: write the failing test → run it, watch it fail → implement
> minimally → run it, watch it pass → commit. If this plan contradicts the tree, **report the
> conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code").

**Goal:** Turn the weekly score-lab from "one metric on one composite" into a **comparative,
per-symbol measurement** — five declared candidate signals × three labels × (pooled + per requested
symbol) = a total 60-cell grid — where the thinness of the evidence rides in the output rather than
in the operator's memory, and where the motivating slice is frozen as a committed fixture before the
ring buffer evicts it.

**Architecture:** A new module set under `apps/api/src/services/research/` — `pairing` (score-agnostic
rows) → `candidates` / `labels` (two `const` registries, pure `fn` extractors, mandatory transitive
`derived_from`) → `comparison` (group × candidate × label → `Cell`) → `artifact` + `render`, driven by
one pure library entrypoint `run::run_lab()`. `main.rs` keeps all I/O. The import arrow is one-way:
`services::research` may read `services::scanner::store` types; nothing under `scanner`, `signals`,
`projection.rs` or `quant-engine`'s scoring path may import `services::research`.

**Tech Stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · `quant-engine` workspace lib ·
`cargo test -p api-rust -p quant-engine` · Nx 23 targets (`npx nx test api`, `npx nx build api`).
**Backend-only.** Node is used once, for the fixture extraction script.

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`, `libs/quant-engine` read-only) | **B0 … B21** (incl. **B12a**), strictly ordered | The only build track |
| **Frontend** (`apps/dashboard`) | **none — zero-task track by design** | See "Frontend track" |
| **Verification** | **V1 … V7**, after B21 (V4's server setup is independent) | |

**Sequencing — the two non-negotiable facts.**

1. **B0 is first, ahead of every refactor, and its deadline is roughly TWO DAYS.** Not "seven
   sessions" — that figure was inherited from a ~74-samples/symbol/session estimate that today's
   capture rate more than doubles. **Measured now, from `data/scan.json`:** SPY's ring holds **250**
   samples of `STRUCTURE_HISTORY_MAX = 576` (74 on 2026-08-10 + 8 on 08-11 + **168 on 08-12**),
   leaving **326** of headroom — and **today alone has already added 168**, on a day that may not
   even be complete. At the observed rate, `326 / 168 ≈ 1.9 days` before eviction begins, **oldest
   first**, which is precisely the 2026-08-10 rows AC-69/70/71/72 depend on. B0 touches no production
   code, so nothing gates it. **Do it in the first sitting and push it.** *"Do not invent drivers for
   past null rows"* applies to the whole diary: nothing here backfills, repairs or synthesises.
2. **B2 (the strict-read fork) is early and isolated**, because the predictable defect — making the
   *shared* `read_structure_history` strict and turning `GET /api/scan/{symbol}/history` into a 500
   for the browser — is wire-visible, and the Conformance spec below exists to catch exactly it.

Everything after B2 is dependency order: primitives (B3–B8) → the engine (B9–B11) → the emitters
(B12, **B12a**, B13–B15) → wiring and errors (B16–B17) → the negative-space guards (B18–B20) → docs
(B21). **B12a must land before B13**: B13 emits the evidence header, and the header now prints
figures B12a computes.

---

## Global Constraints

Every task's requirements implicitly include this section.

### Standing project constraints (`CLAUDE.md` — each has bitten this repo before)

- **Check EXIT CODES, not printed summaries.** A suite once printed `1004 passed` while exiting
  non-zero. `$LASTEXITCODE` (PowerShell) / `echo $?` (bash) after **every** gate command, never through
  a pipe that masks it.
- **A green test run does not mean the types are sound** — for this Rust track the equivalent trap is
  that `cargo test` builds **default features only**, so `apps/api/src/db/pg_scan.rs` (behind
  `--features postgres`) is **not compiled**. B2 changes that file. `cargo check -p api-rust --features
  postgres` is mandatory in V2.
- **Never run a bare `nx format:write`** (one bare run reformatted 92 unrelated files). Scope it:
  `npx nx format:write --files path/a,path/b`. Prettier's scope here is `tools/**/*.mjs` and root
  `*.md` — **`apps/api/**` is not prettier-scoped**, so Rust and the JSON fixtures are formatted by
  `cargo fmt` only.
- **`npm run ports:free` before any run-the-app verification** (V4). Orphaned listeners on :8000/:4200
  serve STALE code and have fed a false-green verification pass before.
- **Never write a literal NUL byte.** It makes a file binary to git and grep. This plan's separators are
  printable. Verify any generated file with
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` → `0`.

### Baselines

| Gate | Command | Baseline | After |
|---|---|---|---|
| Rust suite | `cargo test -p api-rust -p quant-engine` | **record in B0 step 0** | baseline + all new tests, exit 0 |
| Postgres compile | `cargo check -p api-rust --features postgres` | exit 0 | exit 0 |
| Release build | `cargo build -p api-rust --release --features postgres` | exit 0 | exit 0 |
| Prettier | `npm run format:check` | exit 0 | exit 0 |
| Conformance | `node .claude/tools/interface_conformance.mjs …` | PASS | PASS |

> **Do not invent a baseline number.** B0 step 0 records the real one; every later task asserts
> non-decrease against that recorded number.

### Feature-specific hard rules (SPEC §§1–8)

- **Measurement only.** No change to `opportunity_score`, `opportunity_tier`, `state_fingerprint`, the
  entry gate, weights, constants or the fingerprint basis. The feature's diff touches **zero file on
  the scoring path except one log-only `warn!` in `loop.rs`** (B19). `libs/quant-engine/` is **read
  only** — declaring the composite's provenance was a *read* of `signals.rs`, never an edit.
- **One-way boundary.** Nothing under `services::scanner`, `services::analytics`,
  `scanner::projection`, or `quant-engine` may `use crate::services::research::…`. Source scan in B20.
- **No HTTP route, handler, dashboard widget or operator page.** `NO_UI_CHANGE`. The lab must not
  acquire an HTTP client on any code path (`reqwest`, `MassiveRestClient`, `MarketDataPort` are banned
  from the `score-lab` command path). AC-65/AC-68, guarded in B20.
- **No write to the diary.** The lab reads and never writes (AC-66). No new capture field, no schema
  migration, no vendor call, no recompute, no cache mutation.
- **`net_gex_vol_norm_signed` appears nowhere** — no row, no placeholder, no footnote (AC-3).
- **`derived_from` has no default and may not be empty.** A registry entry that fails to declare its
  provenance must fail to compile or fail a registry test.
- **The grid is total.** `groups × candidates × labels`, always, in declared order, with **no filtering
  step anywhere that can remove a coordinate**. Never sorted by a metric.
- **Nothing is suppressed** (owner ruling C-2). A below-floor cell renders its value **with** its
  marker, in one literal, in console *and* artifact.
- **No retention figure is a literal.** The **cap** (`STRUCTURE_HISTORY_MAX`) is printed as a constant
  because it is one; samples held, sessions covered, the observed per-session rate and the implied
  span are **derived from the run's own rows** and labelled as estimates over a stated window
  (SPEC §2.8 `retention[]`, §2.10, AC-78). A capture-rate change must move the printed number by
  itself.
- **Every rendered figure is exactly one of: a value atom, or one of the ten declared literals.** No
  `n/a`, blank, `null`, `NaN`, `-`, bare `0`, or bare `undefined (` anywhere in console or artifact
  (`main.rs:655`/`:659` are the live instances of exactly this defect and are deleted by B17).
- **No adoption or verdict language**, and **no per-run pass/fail against the multi-week bar**. The
  tool prints the bar's *text* beside the run's values and never the outcome of the comparison.

### Interface contract

This feature adds **no endpoint, no route, no field**. The block below is copied **verbatim** from
`INTERFACE_CONTRACT.md` so the build lane inherits the exact binding shape. It is a **machine-checked
non-regression guard**, not a description of new surface: the lab's strict read (§2.7 / B2) forks from
the same `read_structure_history` path this endpoint serves, and "the serve path keeps its fallback
unchanged" is a claim better verified than asserted.

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/scan/{symbol}/history",
      "path_params": { "symbol": "SPY" },
      "query": { "limit": 5 },
      "required": {
        "symbol": "string",
        "basis": "string",
        "stored_count": "number",
        "backend": "string",
        "samples": "array",
        "samples[].symbol": "string",
        "samples[].as_of": "number"
      }
    }
  ]
}
```

**What a FAIL here means** (from `INTERFACE_CONTRACT.md`): a non-200 almost certainly means the strict
analytics read was applied to the shared `read_structure_history` instead of a lab-only variant. The
four analytics fields and `score_drivers` are `skip_serializing_if = "Option::is_none"` (absent keys,
not nulls) and are deliberately **not** asserted; the `samples[].*` fan-out passes vacuously on an
empty diary, which is correct guard behaviour.

---

## File structure

**Created — `apps/api/src/services/research/`:**
`stats.rs` (the six shipped stat helpers, moved verbatim) · `derivation.rs` (`DerivationKey` + the
provenance source guard) · `pairing.rs` (`LabRow`, score-agnostic pairing, **the one session
counter**) · `candidates.rs` (the five-entry registry) · `labels.rs` (the three-entry registry +
`LabelSet`) · `vocabulary.rs` (`Ineligible`, `CellState`, `Power`, `MetricValue`, `MetricState`, the
ten literals) · `comparison.rs` (precedence, carriers, metrics, identities) · `artifact.rs` (the JSON
shape, **`retention[]`**) · `render.rs` (console) · `run.rs` (the pure entrypoint) · `fixtures.rs`
(`#[cfg(test)]` fixture builders + the pinned oracle constants).

**Created — fixtures + tooling:**
`apps/api/tests/fixtures/research/slice_2026-08-10/{samples.json,outcomes.json,pre_feature_report.json,PROVENANCE.md}`
· `apps/api/tests/fixtures/research/slice_current/{samples.json,outcomes.json,PROVENANCE.md}` ·
`tools/research/extract_score_lab_slices.mjs`.

**Modified:** `apps/api/src/services/research/mod.rs` · `score_lab.rs` (helpers moved out;
`evaluate_baseline` retained **test-only**) · `apps/api/src/main.rs` · `apps/api/src/db/pg_scan.rs`
(strict fork) · `apps/api/src/services/scanner/store.rs` (strict passthrough + the wrong `~2 RTH
weeks` comment) · `apps/api/src/services/scanner/loop.rs` (one `warn!`) ·
`docs/research/WEEKLY_SCORE_LAB_RUNBOOK.md` · `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`.

**Deleted:** nothing. `evaluate_baseline` / `ScoreLabReport` are **not** deleted and **not** run
alongside the new block — they survive as the test-only parity oracle.

---

## Frontend track — EMPTY BY DESIGN

**There are no frontend tasks, and that is the design, not an omission.** `SPEC.md` §4 carries
`NO_UI_CHANGE`; `INTERFACE_CONTRACT.md` adds nothing to the FE↔BE seam; every council voice agreed. A
web or `/_ops` page for lab results would breach `[operator-vs-trader-path-separation]`. The surface
is the CLI's console output and its JSON artifact.

The one obligation, negative and ship-blocking, verified in V5:

- [ ] **`git diff --stat -- apps/dashboard apps/dashboard-e2e libs/api` prints nothing.**

If a task appears to need a frontend change, that is a **GATE Z question**, not an implementation
detail.

---

## Ground truth this plan was written against (measured in-tree, 2026-08-12)

### The diary's actual population — measured per symbol per UTC day

**This table is load-bearing and corrects an earlier over-generalisation in this plan.** A first pass
sampled a few `as_of` eras, found no analytics fields, and generalised to "no structure sample in the
diary carries them". That is **false**. The real shape:

| symbol | 2026-08-10 | 2026-08-11 | 2026-08-12 |
|---|---|---|---|
| SPY | n=74 · drivers **0** · net_gex **0** · atm_iv **0** | n=8 · drivers 8 · net_gex 7 · atm_iv 7 | n=168 · drivers **168** · net_gex **168** · atm_iv **168** |
| QQQ | n=73 · drivers **0** · net_gex **0** · atm_iv **0** | n=8 · drivers 8 · net_gex 7 · atm_iv 7 | n=168 · drivers **168** · net_gex **168** · atm_iv **168** |
| IWM | n=74 · drivers **0** · net_gex **0** · atm_iv **0** | n=8 · drivers 8 · net_gex 7 · atm_iv 7 | n=166 · drivers **166** · net_gex **166** · atm_iv **166** |

File-wide: **12,256 of 12,477** samples carry `score_drivers`; **12,253** carry `net_gex` and
`atm_iv`. `hv_30d` is also populated on current captures (verified by direct read).

**The correct statement:** the **221-row 2026-08-10 slice** is entirely unpopulated because it was
captured **before the capture spine landed in `13656ad` (2026-08-10)**. Everything captured after that
commit is fully populated.

> **The capture-spine fix IS WORKING in current data.** `projection.rs:126` populates `score_drivers`,
> `store.rs:129` `from_row` copies them, `pg_scan.rs:426` persists them, and 12,256 of 12,477 rows
> carry them today. `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md` reads as though the append path
> is broken — it is not, and a lane or a future GATE I reading only that doc would waste effort
> "fixing" a correct path. **The genuine residual is exactly one thing: nothing logs when an `ok` row
> yields null drivers.** That is B19, and B21 step 3 corrects the doc.

### The rest

| Fact | Where | Why it matters |
|---|---|---|
| Both slices **still exist locally**: `data/scan.json` (`history` map) holds the 221 pre-spine rows the deep dive used **and** ~518 fully-populated current rows; `data/research/outcomes_20260811T193619Z.json` holds the pre-spine slice's outcomes | verified: `data/scan.json` contains `"symbol":"SPY","as_of":1786382123.955,…` matching `outcomes[0].as_of` | B0 is a **local extraction**, not a prod pull. No credential, no network. |
| `data/` is **gitignored** (`.gitignore:90`) | — | Fixtures MUST land under `apps/api/tests/fixtures/`, never `data/research/`. |
| The pre-spine slice is **one ET session** (2026-08-10 17:15–23:58 UTC ⇒ ET 13:15–19:58) | `session_date_et` (`outcomes.rs:40`) | Evidence class on it is `SINGLE SESSION (d=1)`. AC-44's multi-session counterpart comes from the current slice **and** `f_mixed()`. |
| The directory name **must be `slice_2026-08-10`**, not `…-08-11` | the rows' own `as_of` values | 2026-08-11 is the deep dive's *run* date; the *capture* date is 2026-08-10. |
| **GATE Z retention amendment (landed after the first draft of this plan).** `SPEC.md` no longer hardcodes `about 7 sessions per symbol` in the evidence header. §2.8 gains `retention[]`; §4's header prints the **cap** as a constant and **derives** samples held, sessions covered, observed rate and implied span from the run's own rows; §5 gains a zero-denominator row; §2.10 rejects hardcoded retention figures; §4's term table bans any standing retention claim; **AC-78** (`test`) pins it. | `SPEC.md` §1.10, §2.8, §2.10, §4, §5, §7, AC-78 | **Creates a real gap this plan must close:** `samples_loaded` and `sessions_covered` exist today only at **cell** scope, and the header is emitted **before any cell**. **B12a** hoists them to run scope. |
| Pre-feature oracle values, exact | `data/research/score_lab_1d_20260811T193620Z.json` | Reproduced verbatim in B0 as pinned constants. |
| `pg_scan.rs` is behind `#[cfg(feature = "postgres")]` (`db/mod.rs:15`) | — | `cargo test` does **not** compile the strict fork. The guard must be a source scan (`include_str!`); V2 must run `cargo check --features postgres`. |
| CI = `cargo test -p api-rust -p quant-engine` (default features) + `cargo build --release --features postgres` | `.github/workflows/ci.yml:85,89` | Both halves covered. |
| Fixtures are read from `src/` unit tests via `PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/…")` | precedent: `services/analytics.rs:442` | B0's loaders use the same shape. |
| `resolve_vol_scalar`, `IvDecimal`, `HvPercent` re-exported at the `quant_engine` crate root | `lib.rs:65-66` | `use quant_engine::{resolve_vol_scalar, HvPercent, IvDecimal, VolNormBasis};` |
| `IvDecimal::try_from_decimal` rejects `> 5.0`; `HvPercent::try_from_percent` rejects `> 500.0` | `vol_units.rs:36,80` | A percent-shaped IV becomes `VolScalarUnavailable` and is **counted**, never silently divided. |
| `resolve_vol_scalar` **prefers `atm_iv` whenever present** | `vol_gex.rs:86-92` | Current rows carry both, so a real fixture yields `basis_mix` with `hv_30d = 0`. **AC-19's HV-fallback arm still needs a constructed fixture.** Measure, don't assume (B0 step 3). |
| The score's determinant region is one contiguous slice of `signals.rs`: `fn generate_signals(` (`:169`) … `fn state_fingerprint(` (`:554`) | read directly | B6 scans exactly that region. |

---

## Fixture map — which fixture satisfies which criterion

Three sources, deliberately layered. **A guard that bites only on hand-built input is materially
weaker than one that also bites on a real capture**, so every criterion that *can* be carried by real
data is.

| Fixture | Source | Carries |
|---|---|---|
| **`slice_2026-08-10`** — 221 rows, 3 symbols, 1 ET session, score+geometry only | **real, frozen** | AC-69, AC-70, AC-71, AC-72 · AC-27/AC-28 (literal 3 with the capture-filtered wording, **live**) · AC-39 (attribution ran, nothing eligible) · AC-44 arm 1 (`SINGLE SESSION (d=1)`) · AC-47/AC-51 · AC-8 totality with a fourth requested symbol · **AC-78 arm 1** |
| **`slice_current`** — ~518 rows, 3 symbols, ≥2 ET sessions, fully populated | **real, frozen** | AC-12 / IDENTITY 3 **non-vacuously on real data** · AC-10 with genuine non-zero exclusion counts · AC-19 `atm_iv` + `unavailable` arms · AC-41 · AC-44 arm 2 · AC-52 (a cell above **both** floors, impossible on a d=1 slice) · **AC-78 arm 2** |
| **seven constructed fixtures** (B10) | synthetic, deterministic | AC-5, AC-30, AC-31, AC-33/34/35, AC-49, AC-75 both halves, AC-19's **`hv_30d` fallback arm**, and AC-10's *asymmetric-symbol* condition |

**AC-78 runs against the `slice_2026-08-10` / `slice_current` pair.** Their capture rates differ
materially and for a documented reason — SPY holds 74 samples over 1 session in the first and ~176
over ≥2 sessions in the second — so the derived retention figures must differ between the two runs.
That pair is what makes AC-78 falsifiable: a figure that regressed to a constant would print
identically on both and go red. **B0's two-fixture shape is what makes this testable at all** — a
single-fixture assertion cannot distinguish a derived figure from a hardcoded one, which is precisely
how "about 7 sessions" survived into approved copy.

**Do not collapse these.** Each row names something the others cannot carry.

---

## Backend track

### Task B0: Freeze BOTH slices as committed fixtures — **DO THIS FIRST (≈2-day deadline)**

**Why it is first, with the arithmetic.** `STRUCTURE_HISTORY_MAX = 576` is **per symbol**. SPY holds
**250** (74 + 8 + 168); headroom **326**; today alone added **168**. `326 / 168 ≈ 1.9 days` before
eviction begins, **oldest first**. This task touches **no production code**, so nothing gates it.
**If it slips, the data is gone permanently.** Nothing here backfills, repairs or synthesises — it
copies rows that exist.

**Files:** New `tools/research/extract_score_lab_slices.mjs` · New
`apps/api/tests/fixtures/research/slice_2026-08-10/{samples.json,outcomes.json,pre_feature_report.json,PROVENANCE.md}`
· New `apps/api/tests/fixtures/research/slice_current/{samples.json,outcomes.json,PROVENANCE.md}` ·
New `apps/api/src/services/research/fixtures.rs` · Modify `research/mod.rs`.

- [ ] **Step 0 — record the baseline.** Run `cargo test -p api-rust -p quant-engine`; check
      `$LASTEXITCODE` is 0; write the passing test count into the Baselines table and the commit
      message. Every later task asserts non-decrease against it.

- [ ] **Step 1 — write the extraction script** `tools/research/extract_score_lab_slices.mjs`:

```js
/**
 * ONE-SHOT extraction of the two score-lab fixture slices.
 *
 * SLICE A — `slice_2026-08-10`: the 221 PRE-CAPTURE-SPINE rows the deep dive measured. Captured
 *   before `13656ad` landed, so they carry score + geometry and NOTHING else. Their job is pinning
 *   reproduction of the published figures. Membership is defined by the outcomes artifact's own
 *   (symbol, as_of) key set — not "whatever is in the store today" — which makes it self-checking.
 *
 * SLICE B — `slice_current`: the FULLY POPULATED rows captured after the spine landed. Their job is
 *   letting IDENTITY 3 / COMPOSITION / basis_mix / AC-78 bite on real data instead of only on
 *   hand-built input. Membership is "every row for the three symbols that is NOT in slice A".
 *
 * Inputs are gitignored (`/data/`), so this cannot be re-run by a reviewer. It is committed so the
 * extraction is READABLE, and each PROVENANCE.md records what it produced.
 *
 *   node tools/research/extract_score_lab_slices.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const STORE = `${ROOT}data/scan.json`;
const OUTCOMES_IN = `${ROOT}data/research/outcomes_20260811T193619Z.json`;
const REPORT_IN = `${ROOT}data/research/score_lab_1d_20260811T193620Z.json`;
const OUT_A = `${ROOT}apps/api/tests/fixtures/research/slice_2026-08-10`;
const OUT_B = `${ROOT}apps/api/tests/fixtures/research/slice_current`;
const SYMBOLS = ['SPY', 'QQQ', 'IWM'];

/** Millisecond bucket — mirrors `score_lab.rs::as_of_key` exactly. */
const key = (symbol, asOf) => `${String(symbol).trim().toUpperCase()}|${Math.round(asOf * 1000)}`;
const bySymbolCount = (rows) => {
  const m = {};
  for (const r of rows) {
    const k = r.symbol.toUpperCase();
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
};
/** Population census — the number this plan's fixture map depends on. Never assume it; measure it. */
const census = (rows) => ({
  n: rows.length,
  score: rows.filter((s) => s.score != null).length,
  score_drivers: rows.filter((s) => s.score_drivers != null).length,
  net_gex: rows.filter((s) => s.net_gex != null).length,
  atm_iv: rows.filter((s) => s.atm_iv != null).length,
  hv_30d: rows.filter((s) => s.hv_30d != null).length,
  hv_only: rows.filter((s) => s.hv_30d != null && s.atm_iv == null).length,
});

// ---- SLICE A ----------------------------------------------------------------------------------
const outcomesA = JSON.parse(readFileSync(OUTCOMES_IN, 'utf8')).outcomes.filter(
  (o) => String(o.horizon).trim().toLowerCase() === '1d',
);
const wantedA = new Set(outcomesA.map((o) => key(o.symbol, o.as_of)));

const history = JSON.parse(readFileSync(STORE, 'utf8')).history ?? {};
const allForSymbols = [];
for (const [sym, series] of Object.entries(history)) {
  if (!SYMBOLS.includes(sym.toUpperCase())) continue;
  for (const s of series) allForSymbols.push(s);
}

const samplesA = allForSymbols.filter((s) => wantedA.has(key(s.symbol, s.as_of)));
const foundA = new Set(samplesA.map((s) => key(s.symbol, s.as_of)));
const missing = [...wantedA].filter((k) => !foundA.has(k));
if (missing.length > 0) {
  throw new Error(
    `SLICE A incomplete: ${missing.length} of ${wantedA.size} rows are no longer in the store ` +
      `(ring eviction — the ~2-day deadline was missed). STOP and pull from the prod history ` +
      `endpoint instead. First missing: ${missing[0]}`,
  );
}
if (samplesA.length !== outcomesA.length) {
  throw new Error(`duplicate (symbol, as_of): ${samplesA.length} samples for ${outcomesA.length} outcomes`);
}

// ---- SLICE B ----------------------------------------------------------------------------------
const samplesB = allForSymbols.filter((s) => !wantedA.has(key(s.symbol, s.as_of)));
if (samplesB.length === 0) {
  throw new Error('SLICE B empty — no post-spine rows found. Do not proceed without measuring why.');
}

const sortRows = (a, b) => a.symbol.localeCompare(b.symbol) || a.as_of - b.as_of;
samplesA.sort(sortRows);
samplesB.sort(sortRows);
outcomesA.sort(sortRows);

mkdirSync(OUT_A, { recursive: true });
mkdirSync(OUT_B, { recursive: true });
writeFileSync(`${OUT_A}/samples.json`, JSON.stringify(samplesA));
writeFileSync(`${OUT_A}/outcomes.json`, JSON.stringify(outcomesA));
writeFileSync(`${OUT_A}/pre_feature_report.json`, readFileSync(REPORT_IN, 'utf8'));
writeFileSync(`${OUT_B}/samples.json`, JSON.stringify(samplesB));

console.log(
  JSON.stringify(
    {
      slice_a: { bySymbol: bySymbolCount(samplesA), census: census(samplesA), outcomes: outcomesA.length },
      slice_b: { bySymbol: bySymbolCount(samplesB), census: census(samplesB) },
    },
    null,
    2,
  ),
);
```

- [ ] **Step 2 — run it.** `node tools/research/extract_score_lab_slices.mjs`. **Expected:**
      `slice_a.bySymbol = { IWM: 74, QQQ: 73, SPY: 74 }`, `slice_a.census.score = 221` with
      `score_drivers`/`net_gex`/`atm_iv`/`hv_30d` all **0**, `slice_a.outcomes = 221`;
      `slice_b` ≈ 518 rows with `score_drivers` ≈ `net_gex` ≈ `atm_iv` ≈ n. `$LASTEXITCODE` = 0.
      **If it throws "SLICE A incomplete": STOP and report.** Fallback is a prod pull through
      `GET /api/scan/{symbol}/history?limit=576`, filtered by the same key set — and if that is short
      too, the rows are gone and AC-69/70/71 must be renegotiated at GATE Z.
      **Do not thin, resample, or synthesise to make the counts work.**

- [ ] **Step 3 — record the census.** Copy the script's JSON output verbatim into each
      `PROVENANCE.md`, alongside source paths, extraction date, the membership rule, and the measured
      byte sizes. **`slice_b.census.hv_only` decides whether real data can carry AC-19's HV-fallback
      arm.** If it is `0` (expected), say so explicitly and leave that arm to `f_mixed()`.
      **Also record each slice's per-symbol samples-per-session** — that is the input AC-78's
      two-fixture assertion rests on, and a reviewer needs to see the two rates differ.

      `slice_2026-08-10/PROVENANCE.md` must also carry:
      *"These rows carry no `score_drivers` and no analytics fields because they were captured before
      the capture spine landed in `13656ad` (2026-08-10) — not because the append path is broken. It
      is not: 12,256 of 12,477 rows in the source store carry drivers. This is the captured truth of
      2026-08-10 and it must never be repaired."*

- [ ] **Step 4 — outcomes for slice B.** Slice B's samples are the irreplaceable, evictable asset and
      are frozen in step 2 with **no vendor call**. Its **outcomes** need `join-outcomes`, which needs
      `MASSIVE_API_KEY` and a *closed forward session*, so the newest rows may not be labellable
      today. Run:

```powershell
cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM --horizons 1d --out .tmp/outcomes_current.json
```

  Filter that artifact to slice B's `(symbol, as_of)` key set and write `slice_current/outcomes.json`.
  - **If ≥ ~24 rows label:** commit it; slice B is live for the real-data guards.
  - **If nothing labels yet:** commit `samples.json` **alone** with a `PROVENANCE.md` note and open
    **B0b**, a one-step follow-on that re-runs the join once the session closes. **B0b blocks
    nothing:** the constructed fixtures carry every guard meanwhile, and AC-78 falls back to slice A
    vs `f_mixed()` (which has its own, different capture rate). **Never synthesise outcomes.**

- [ ] **Step 5 — write the failing fixture-contract tests.** New `research/fixtures.rs`, registered in
      `mod.rs` as `#[cfg(test)] pub mod fixtures;`:

```rust
//! Test-only fixture loaders + the pinned pre-feature oracle.
//!
//! Both slices are read through the FILE input path, never the live diary: a test that reads the
//! ring buffer goes red on a calendar date rather than on a code change (SPEC §7).

use crate::services::research::StructureOutcome;
use crate::services::scanner::store::StructureSample;
use std::path::PathBuf;

fn fixture_dir(slice: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/research").join(slice)
}

fn load_samples(slice: &str) -> Vec<StructureSample> {
    let raw = std::fs::read_to_string(fixture_dir(slice).join("samples.json")).expect("samples.json");
    serde_json::from_str(&raw).expect("samples.json decodes as Vec<StructureSample>")
}

fn load_outcomes(slice: &str) -> Vec<StructureOutcome> {
    let raw = std::fs::read_to_string(fixture_dir(slice).join("outcomes.json")).expect("outcomes.json");
    serde_json::from_str(&raw).expect("outcomes.json decodes as Vec<StructureOutcome>")
}

/// SLICE A — the 221 PRE-CAPTURE-SPINE rows the deep dive measured (captured 2026-08-10 UTC; the
/// deep dive's "2026-08-11" is its RUN date). Score + geometry only.
pub fn slice_0810_samples() -> Vec<StructureSample> { load_samples("slice_2026-08-10") }
pub fn slice_0810_outcomes() -> Vec<StructureOutcome> { load_outcomes("slice_2026-08-10") }

/// SLICE B — fully populated post-spine rows. Exercises the GEX candidates on REAL capture, and is
/// AC-78's second arm (its capture rate differs materially from slice A's).
pub fn slice_current_samples() -> Vec<StructureSample> { load_samples("slice_current") }
/// `None` until B0b lands. Every guard using this SKIPS loudly rather than passing vacuously.
pub fn slice_current_outcomes() -> Option<Vec<StructureOutcome>> {
    fixture_dir("slice_current").join("outcomes.json").exists().then(|| load_outcomes("slice_current"))
}

/// The pre-feature lab's own numbers for slice A, transcribed from
/// `data/research/score_lab_1d_20260811T193620Z.json`. TOOL-PRODUCED, not hand-derived, so they are
/// legitimate test oracles (AC-72 draws that line explicitly).
pub mod pre_feature {
    pub const N_PAIRED: usize = 221;
    pub const LARGE_ABS_MOVE_N_POSITIVE: usize = 111;
    pub const LARGE_ABS_MOVE_BASE_RATE: f64 = 0.502_262_443_438_914;
    pub const LARGE_ABS_MOVE_AUC: f64 = 0.467_444_717_444_717_44;
    pub const LARGE_ABS_MOVE_PRECISION_TOP: f64 = 0.086_956_521_739_130_43;
    pub const LARGE_ABS_MOVE_RECALL_TOP: f64 = 0.018_018_018_018_018_018;
    pub const LARGE_ABS_MOVE_LIFT_TOP: f64 = 0.173_129_651_390_520_94;
    pub const TOP_DECILE_N: usize = 23;
    pub const UP_MOVE_AUC: f64 = 0.569_130_354_844_640_6;
    pub const UP_MOVE_BASE_RATE: f64 = 0.334_841_628_959_276;
    pub const UP_MOVE_LIFT_TOP: f64 = 0.129_847_238_542_890_74;
    pub const STRUCTURE_EVENT_AUC: f64 = 0.931_874_077_717_658_6;
    pub const STRUCTURE_EVENT_BASE_RATE: f64 = 0.515_837_104_072_398_2;
    pub const STRUCTURE_EVENT_PRECISION_TOP: f64 = 1.0;
    pub const STRUCTURE_EVENT_LIFT_TOP: f64 = 1.938_596_491_228_07;
    pub const PEARSON_SCORE_VS_ABS_MOVE: f64 = -0.021_586_482_599_806_937;
    /// Pre-change EQUAL-WIDTH calibration bins (lo, hi, n). AC-71 requires BOTH values on record.
    pub const CALIBRATION_EQUAL_WIDTH: [(f64, f64, usize); 5] = [
        (37.0, 47.2, 22), (47.2, 57.4, 4), (57.4, 67.6, 115), (67.6, 77.8, 50), (77.8, 88.0, 30),
    ];
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::outcomes::session_date_et;
    use crate::services::research::score_lab::{evaluate_baseline, pair_samples_outcomes};
    use std::collections::{BTreeMap, BTreeSet};

    fn as_of_key(as_of: f64) -> u64 { (as_of * 1000.0).round() as u64 }

    fn per_symbol(samples: &[StructureSample]) -> BTreeMap<String, usize> {
        let mut m = BTreeMap::new();
        for s in samples { *m.entry(s.symbol.to_ascii_uppercase()).or_default() += 1; }
        m
    }

    // ---- SLICE A -----------------------------------------------------------------------------

    #[test]
    fn slice_0810_is_the_deep_dives_slice() {
        let samples = slice_0810_samples();
        let outcomes = slice_0810_outcomes();
        assert_eq!(samples.len(), 221, "sample count");
        assert_eq!(outcomes.len(), 221, "outcome count");

        let ps = per_symbol(&samples);
        assert_eq!(ps.get("SPY"), Some(&74));
        assert_eq!(ps.get("QQQ"), Some(&73));
        assert_eq!(ps.get("IWM"), Some(&74));
        assert_eq!(ps.len(), 3, "exactly three symbols");

        let sk: BTreeSet<(String, u64)> = samples.iter()
            .map(|s| (s.symbol.to_ascii_uppercase(), as_of_key(s.as_of))).collect();
        let ok: BTreeSet<(String, u64)> = outcomes.iter()
            .map(|o| (o.symbol.to_ascii_uppercase(), as_of_key(o.as_of))).collect();
        assert_eq!(sk, ok, "sample and outcome key sets must be equal");
        assert!(outcomes.iter().all(|o| o.horizon.trim() == "1d"));
    }

    /// The captured truth of 2026-08-10 — PRE-capture-spine (`13656ad`). If this goes red, someone
    /// REPAIRED the fixture, which is forbidden. AC-27/AC-28/AC-39's live instances rest on these
    /// absences. NOTE: a property of THIS SLICE, not of the diary — 12,256 of 12,477 rows in the
    /// source store DO carry drivers.
    #[test]
    fn slice_0810_carries_no_drivers_and_no_analytics() {
        for s in slice_0810_samples() {
            assert!(s.score.is_some(), "{} carries a score", s.symbol);
            assert!(s.dist_to_flip_pct.is_some(), "{} carries dist_to_flip_pct", s.symbol);
            assert!(s.dist_to_wall_pct.is_some(), "{} carries dist_to_wall_pct", s.symbol);
            assert!(s.score_drivers.is_none(), "pre-spine: score_drivers stay null (never repaired)");
            assert!(s.net_gex.is_none(), "pre-spine: net_gex was never captured on this slice");
            assert!(s.atm_iv.is_none(), "pre-spine: atm_iv was never captured on this slice");
            assert!(s.hv_30d.is_none(), "pre-spine: hv_30d was never captured on this slice");
            assert!(s.iv_hv_ratio.is_none(), "pre-spine: iv_hv_ratio was never captured");
        }
    }

    #[test]
    fn slice_0810_is_one_et_session() {
        let dates: BTreeSet<String> =
            slice_0810_samples().iter().filter_map(|s| session_date_et(s.as_of)).collect();
        assert_eq!(dates, BTreeSet::from(["2026-08-10".to_string()]),
            "single ET session — this is what makes it evidence class SINGLE SESSION (d=1)");
    }

    /// The parity oracle, pinned at the point of freeze. Exact equality is correct: the oracle is
    /// the SHIPPED `evaluate_baseline` over the SAME rows in the SAME order, so the arithmetic is
    /// bit-reproducible. A tolerance would hide a real reordering.
    #[test]
    fn slice_0810_reproduces_the_pre_feature_report() {
        let rows = pair_samples_outcomes(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        assert_eq!(rows.len(), pre_feature::N_PAIRED);
        let report = evaluate_baseline(&rows, "1d");

        let large = report.labels.iter().find(|l| l.label == "large_abs_move").unwrap();
        assert_eq!(large.n, 221);
        assert_eq!(large.n_positive, pre_feature::LARGE_ABS_MOVE_N_POSITIVE);
        assert_eq!(large.base_rate, pre_feature::LARGE_ABS_MOVE_BASE_RATE);
        assert_eq!(large.auc, Some(pre_feature::LARGE_ABS_MOVE_AUC));
        assert_eq!(large.precision_top_decile, Some(pre_feature::LARGE_ABS_MOVE_PRECISION_TOP));
        assert_eq!(large.recall_top_decile, Some(pre_feature::LARGE_ABS_MOVE_RECALL_TOP));
        assert_eq!(large.lift_top_decile, Some(pre_feature::LARGE_ABS_MOVE_LIFT_TOP));
        assert_eq!(large.top_decile_n, pre_feature::TOP_DECILE_N);

        let up = report.labels.iter().find(|l| l.label == "up_move").unwrap();
        assert_eq!(up.auc, Some(pre_feature::UP_MOVE_AUC));
        assert_eq!(up.base_rate, pre_feature::UP_MOVE_BASE_RATE);
        assert_eq!(up.lift_top_decile, Some(pre_feature::UP_MOVE_LIFT_TOP));

        let se = report.labels.iter().find(|l| l.label == "structure_event").unwrap();
        assert_eq!(se.auc, Some(pre_feature::STRUCTURE_EVENT_AUC));
        assert_eq!(se.base_rate, pre_feature::STRUCTURE_EVENT_BASE_RATE);
        assert_eq!(se.precision_top_decile, Some(pre_feature::STRUCTURE_EVENT_PRECISION_TOP));
        assert_eq!(se.lift_top_decile, Some(pre_feature::STRUCTURE_EVENT_LIFT_TOP));

        assert_eq!(report.score_vs_abs_move.pearson, Some(pre_feature::PEARSON_SCORE_VS_ABS_MOVE));

        // Driver attribution was void on this slice (0/221 rows carried drivers). AC-39's live case.
        assert!(report.drivers.iter().all(|d| d.n == 0), "no row carried score_drivers");
    }

    // ---- SLICE B -----------------------------------------------------------------------------

    /// Slice B exists to make the GEX candidates, `basis_mix` and AC-78's second arm bite on REAL
    /// capture. If its population or its capture rate regresses, those guards silently go vacuous —
    /// so assert both directly, here, where the failure is legible.
    #[test]
    fn slice_current_is_fully_populated_and_multi_session() {
        let samples = slice_current_samples();
        assert!(samples.len() > 400, "slice B is thin: {} rows", samples.len());
        assert_eq!(per_symbol(&samples).len(), 3, "SPY, QQQ, IWM");

        let with_gex = samples.iter().filter(|s| s.net_gex.is_some()).count();
        let with_iv = samples.iter().filter(|s| s.atm_iv.is_some()).count();
        let with_drivers = samples.iter().filter(|s| s.score_drivers.is_some()).count();
        // NON-ZERO and NON-TOTAL is the property IDENTITY 3 needs to stop being vacuous.
        assert!(with_gex > 0, "no row carries net_gex — the GEX candidates cannot be exercised");
        assert!(with_gex < samples.len(), "EVERY row carries net_gex — no real exclusions to count");
        assert!(with_iv > 0, "no row carries atm_iv — basis_mix would be degenerate");
        assert!(with_drivers > 0, "the capture spine (13656ad) is populating drivers — assert it");

        let dates: BTreeSet<String> =
            samples.iter().filter_map(|s| session_date_et(s.as_of)).collect();
        assert!(dates.len() >= 2, "slice B must span >= 2 ET sessions (AC-44 arm 2, AC-52)");
    }

    /// AC-78's fixture PRECONDITION, asserted separately from the AC itself (B12a) so a false-fail
    /// there is legible: if the two slices ever share a capture rate, AC-78 cannot distinguish a
    /// derived figure from a constant, and THAT is the thing to fix — not the assertion.
    #[test]
    fn the_two_slices_have_materially_different_capture_rates() {
        let rate = |samples: &[StructureSample]| -> f64 {
            let spy: Vec<&StructureSample> =
                samples.iter().filter(|s| s.symbol.eq_ignore_ascii_case("SPY")).collect();
            let sessions: BTreeSet<String> =
                spy.iter().filter_map(|s| session_date_et(s.as_of)).collect();
            spy.len() as f64 / sessions.len().max(1) as f64
        };
        let a = rate(&slice_0810_samples());
        let b = rate(&slice_current_samples());
        assert!((a - b).abs() > 1.0,
            "AC-78 needs two DIFFERENT capture rates; got slice A {a} vs slice B {b} SPY samples/session");
    }

    /// Until B0b lands this skips LOUDLY rather than passing vacuously.
    #[test]
    fn slice_current_outcomes_pair_when_present() {
        let Some(outcomes) = slice_current_outcomes() else {
            eprintln!("SKIP: slice_current/outcomes.json absent — B0b not yet landed. \
                       The constructed fixtures carry these guards meanwhile.");
            return;
        };
        let rows = pair_samples_outcomes(&slice_current_samples(), &outcomes, "1d");
        assert!(!rows.is_empty(), "slice B outcomes exist but pair nothing — key mismatch");
    }
}
```

- [ ] **Step 6 — run it, watch it fail** (fixtures absent) if you wrote the tests first; then
      `cargo test -p api-rust research::fixtures` and watch them pass. `$LASTEXITCODE` = 0.
- [ ] **Step 7 — NUL scan** on every JSON fixture (→ `0`), then `npm run format:check` (the new `.mjs`
      is prettier-scoped; if it fails, run `npm run format` and confirm via `git status` that it
      touched **only** that file).
- [ ] **Step 8 — commit.** `feat(research): freeze the 2026-08-10 and current score-lab slices as
      committed fixtures (GATE PLAN B0)`. **Deadline-critical. Push it.**

**Reviewer probe:** does `slice_2026-08-10/samples.json` contain exactly the 221 `(symbol, as_of)`
pairs of its `outcomes.json`, and did anyone "fix" a null? And does `slice_current`'s census show a
*non-total* `net_gex` count and a capture rate materially different from slice A's? If either
collapses, IDENTITY 3 or AC-78 is being carried by constructed input alone.

---

### Task B1: Extract the stat helpers into `research::stats` (pure move)

**Why now:** every downstream metric calls these, and the parity oracle's **bit-exactness** depends on
the new comparison path calling the *same* functions rather than re-implementations.

**Files:** New `research/stats.rs` · Modify `score_lab.rs`, `mod.rs`.

- [ ] **Step 1:** Move, **verbatim, no edits**, from `score_lab.rs` into `stats.rs`: `pearson`,
      `spearman`, `ranks`, `percentile_sorted`, `man_whitney_auc`, `top_decile_precision_recall`.
      Make each `pub(crate)`. Add `pub mod stats;` to `mod.rs`. In `score_lab.rs` add
      `use crate::services::research::stats::{man_whitney_auc, pearson, percentile_sorted, spearman, top_decile_precision_recall};`
      and delete the moved bodies.
- [ ] **Step 2:** `cargo test -p api-rust -p quant-engine`. **Expected: baseline + B0's tests,
      unchanged, exit 0.** A changed count means the move was not verbatim.
- [ ] **Step 3:** Commit — `refactor(research): extract score-lab stat helpers into research::stats`.

**Reviewer probe:** `git diff` on the moved functions should be pure relocation. Any edit — even
reordering an accumulation loop — breaks the bit-exact parity B0 just pinned.

---

### Task B2: Fork the analytics read — strict for the lab, fallback intact for the serve path

**This is the trap.** `[F.1]` requires the lab to load through a **strict read with no fallback**
(hard CLI error before any metric or artifact), while `GET /api/scan/{symbol}/history` **must keep its
existing fallback**. Both are served today by `read_structure_history`. **The predictable defect is
making the shared read strict for everyone**, turning a degrading endpoint into a 500 for the browser.

**Files:** Modify `db/pg_scan.rs` · `services/scanner/store.rs` · New test module in `research/mod.rs`.

- [ ] **Step 1 — write the failing structural guard.** In `mod.rs`:

```rust
#[cfg(test)]
mod strict_read_fork_guard {
    /// `pg_scan.rs` sits behind `--features postgres`, so `cargo test` never COMPILES it.
    /// The fork is therefore guarded as SOURCE — read as text, which works under any feature set.
    const PG_SCAN_SRC: &str = include_str!("../../db/pg_scan.rs");

    fn body_of(src: &str, sig: &str) -> &str {
        let start = src.find(sig).unwrap_or_else(|| panic!("fn not found: {sig}"));
        let rest = &src[start + sig.len()..];
        let end = rest.find("\n    pub async fn ").or_else(|| rest.find("\n    fn ")).unwrap_or(rest.len());
        &rest[..end]
    }

    #[test]
    fn serve_path_keeps_its_fallback_and_the_lab_path_has_none() {
        let fallback = body_of(PG_SCAN_SRC, "pub async fn read_structure_history(");
        let strict = body_of(PG_SCAN_SRC, "pub async fn read_structure_history_strict(");

        // Anti-vacuity: both bodies were actually found and are non-trivial.
        assert!(fallback.len() > 400, "fallback body not sliced (len {})", fallback.len());
        assert!(strict.len() > 200, "strict body not sliced (len {})", strict.len());
        // ...and `contains` discriminates (a needle that must NOT be there).
        assert!(!fallback.contains("read_structure_history_definitely_not_a_fn"));

        // ARM A — the SERVE path still degrades honestly.
        assert!(
            fallback.contains("retrying base columns"),
            "GET /api/scan/{{symbol}}/history must keep its base-columns fallback \
             (INTERFACE_CONTRACT.md: making the shared read strict is the predicted defect)"
        );
        assert!(fallback.contains("full={e}; base={e2}"), "fallback still reports both errors");

        // ARM B — the LAB path has no fallback at all.
        assert!(
            !strict.contains("retrying base columns") && !strict.contains("base={e2}"),
            "the strict read must have NO fallback arm (SPEC §2.7, AC-62)"
        );
        assert_eq!(
            strict.matches("sqlx::query(").count(), 1,
            "the strict read issues exactly one SELECT — a second query IS a fallback"
        );
        assert!(strict.contains("STRICT"), "the strict read's error must be self-identifying");
    }
}
```

- [ ] **Step 2 — run it, watch it fail** (`read_structure_history_strict` does not exist).
- [ ] **Step 3 — implement.** In `pg_scan.rs`, add **beside** the untouched `read_structure_history`
      (do not refactor it, do not share its `match`):

```rust
    /// Strict analytics read for the RESEARCH LAB ONLY — no fallback, ever.
    ///
    /// `read_structure_history`'s base-columns retry is per symbol and fires on ANY SQL error, so
    /// SPY can return analytics-rich while QQQ returns analytics-blind — poisoning the cross-symbol
    /// comparison this lab exists to produce, with the only trace a server log while the artifact is
    /// permanent. The lab is offline, CLI and re-runnable: it refuses to run instead.
    ///
    /// `GET /api/scan/{symbol}/history` keeps its fallback and MUST NOT be pointed at this fn
    /// (INTERFACE_CONTRACT.md — the conformance block is the machine check).
    pub async fn read_structure_history_strict(
        &self,
        symbol: &str,
        limit: usize,
    ) -> AppResult<Vec<StructureSample>> {
        if limit == 0 { return Ok(Vec::new()); }
        let sym = symbol.trim().to_ascii_uppercase();
        if sym.is_empty() { return Ok(Vec::new()); }
        let lim = limit.min(STRUCTURE_HISTORY_MAX) as i64;
        let rows = sqlx::query(
            r#"SELECT symbol, as_of, price, score, tier, regime, vol_regime,
                      flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                      score_drivers, net_gex, iv_hv_ratio, atm_iv, hv_30d
               FROM scan_structure_history
               WHERE upper(btrim(symbol)) = $1
               ORDER BY as_of DESC
               LIMIT $2"#,
        )
        .bind(&sym)
        .bind(lim)
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| {
            AppError::Config(format!(
                "STRICT analytics read failed for {sym}: {e}. The research lab does not fall back \
                 to base columns — a partial read would record a FALSE absence in a permanent artifact."
            ))
        })?;

        let mut out: Vec<StructureSample> = Vec::with_capacity(rows.len());
        for r in &rows {
            match Self::structure_sample_from_sql(r) {
                Some(s) => out.push(s),
                None => return Err(AppError::Config(format!(
                    "STRICT analytics read for {sym}: a row failed to decode; refusing to \
                     silently drop it from a research slice."
                ))),
            }
        }
        out.reverse();
        Ok(out)
    }
```

- [ ] **Step 4 — plumb it through `ScanStore`** (`store.rs`), beside the untouched original:

```rust
    /// Strict research read — errors propagate. Never call this from a route handler.
    pub async fn read_structure_history_strict(
        &self,
        symbol: &str,
        limit: usize,
    ) -> AppResult<Vec<StructureSample>> {
        match self {
            // The JSON backend has no partial-schema path, so strict == normal here.
            Self::Json(s) => Ok(s.read_structure_history(symbol, limit).await),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.read_structure_history_strict(symbol, limit).await,
        }
    }
```

  The difference that matters: the shipped Postgres arm of `read_structure_history` swallows the error
  into `Vec::new()` after a `tracing::error!`. The strict arm **must not** — no `unwrap_or_default`,
  no `Vec::new()` on error.

- [ ] **Step 5:** `cargo test -p api-rust` → guard passes, baseline non-decrease, exit 0. Then
      `cargo check -p api-rust --features postgres` → exit 0. **If the local toolchain cannot build
      sqlx** (windows-gnu without `dlltool`), record that verbatim in the commit message and rely on
      CI's release build — but do **not** skip the attempt.
- [ ] **Step 6 — commit.** `feat(research): strict no-fallback analytics read for the lab; serve path
      unchanged`.

**Reviewer probe:** does `routes/scan.rs::get_structure_history` still call
`state.scan.read_structure_history(...)`? One character of drift there is a browser-visible 500.

---

### Task B3: `research::derivation` — the closed `DerivationKey` enum

**Files:** New `research/derivation.rs`.

- [ ] **Step 1 — write the failing test, then implement:**

```rust
//! Closed provenance vocabulary. `derived_from` is the TRANSITIVE DETERMINANT SET — every
//! underlying quantity the value ultimately depends on — NOT the immediate field read. That
//! distinction is the whole mechanism: `opportunity_score` reads one stored scalar and declares
//! eight keys, because the question the mark answers is "what does this number depend on".

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DerivationKey {
    Score, NetGex, VolScalar, IvHvRatio, Setups,
    Flip, CallWall, PutWall, PeakGex, OffExchange, ForwardPricePath,
}

impl DerivationKey {
    pub const ALL: [DerivationKey; 11] = [
        Self::Score, Self::NetGex, Self::VolScalar, Self::IvHvRatio, Self::Setups,
        Self::Flip, Self::CallWall, Self::PutWall, Self::PeakGex, Self::OffExchange,
        Self::ForwardPricePath,
    ];

    /// Human name used inside a cell's coupling mark, e.g. "call wall".
    pub const fn human(self) -> &'static str {
        match self {
            Self::Score => "score",
            Self::NetGex => "net GEX",
            Self::VolScalar => "vol scalar",
            Self::IvHvRatio => "IV/HV ratio",
            Self::Setups => "setups",
            Self::Flip => "flip",
            Self::CallWall => "call wall",
            Self::PutWall => "put wall",
            Self::PeakGex => "peak GEX strike",
            Self::OffExchange => "off-exchange prints",
            Self::ForwardPricePath => "forward price path",
        }
    }
}

/// Ordered intersection of two declared provenance sets. Order follows `ALL`, so the rendered
/// mark is deterministic run to run (AC-6).
pub fn shared_keys(a: &[DerivationKey], b: &[DerivationKey]) -> Vec<DerivationKey> {
    DerivationKey::ALL.into_iter().filter(|k| a.contains(k) && b.contains(k)).collect()
}
```

- [ ] **Step 2 — tests:** `ALL` has 11 distinct members; `human()` returns 11 distinct non-empty
      strings; `shared_keys` is order-stable and commutative in content; `shared_keys(&[], &[Flip])`
      is empty.
- [ ] **Step 3:** `cargo test -p api-rust research::derivation` green, exit 0. Commit.

---

### Task B4: `research::pairing` — score-agnostic rows, and the ONE session counter

`score.filter(is_finite)` moves **out** of pairing (`score_lab.rs:157`) into the `opportunity_score`
extractor. A sample with `net_gex` but no `score` is now ineligible for one candidate and a full
participant in the other four.

**Files:** New `research/pairing.rs`.

- [ ] **Step 1 — `LabRow`, `pair_rows`, and the session counter:**

```rust
/// One paired (sample, outcome) row — score-AGNOSTIC. Every candidate's input rides here as an
/// Option; eligibility is decided by the candidate's own extractor, never by pairing.
#[derive(Debug, Clone, PartialEq)]
pub struct LabRow {
    pub symbol: String,
    pub as_of: f64,
    pub session_date: Option<String>,
    // candidate inputs
    pub score: Option<f64>,
    pub net_gex: Option<f64>,
    pub atm_iv: Option<f64>,
    pub hv_30d: Option<f64>,
    pub dist_to_flip_pct: Option<f64>,
    pub dist_to_wall_pct: Option<f64>,
    pub score_drivers: Option<ScanScoreDrivers>,
    // outcomes
    pub horizon: String,
    pub ret_simple: Option<f64>,
    pub abs_move: Option<f64>,
    pub hit_call_wall: Option<bool>,
    pub hit_put_wall: Option<bool>,
    pub crossed_flip: Option<bool>,
}

/// THE definition of "a session" for this feature. THREE call sites, ONE rule:
///   1. run-level `session_dates` / `evidence_class`  — over the PAIRED row set        (B4/B12)
///   2. run-level `retention[]`                       — over one symbol's LOADED samples (B12a)
///   3. per-cell `n_sessions`                         — over one cell's eligible rows    (B9)
/// Never re-derive this. Two independent notions of "session" would let the evidence header and
/// the per-cell figures disagree while both look right — the exact class of silent divergence this
/// feature exists to prevent.
pub fn session_dates_of(as_ofs: impl Iterator<Item = f64>) -> BTreeSet<String> {
    as_ofs.filter_map(session_date_et).collect()
}

pub struct Pairing {
    pub rows: Vec<LabRow>,
    /// Duplicate `(symbol, as_of_ms)` keys collapsed by the index (`score_lab.rs:145` does this
    /// today with no count). Low likelihood under 300s thinning, zero cost to count.
    pub duplicate_keys_collapsed: usize,
    pub n_samples_by_symbol: BTreeMap<String, usize>,
    pub session_dates: BTreeSet<String>,
    pub window_first: Option<f64>,
    pub window_last: Option<f64>,
}

pub fn pair_rows(
    samples: &[StructureSample],
    outcomes: &[StructureOutcome],
    horizon: &str,
) -> Pairing;
```

  `pair_rows` mirrors `pair_samples_outcomes` exactly — same `as_of_key` millisecond bucket, same
  index-then-iterate-outcomes order — **minus** the score filter, **plus** the collapse count, the
  per-symbol sample counts, the ET session-date set and the UTC window bounds. **Row order must be the
  outcomes-iteration order**; a sort here silently breaks B0's bit-exact parity.

- [ ] **Step 2 — the parity test:** on `slice_2026-08-10`, `pair_rows(...).rows` has 221 entries whose
      `(symbol, as_of)` sequence is **identical** to `pair_samples_outcomes(...)`'s,
      `duplicate_keys_collapsed == 0`, `n_samples_by_symbol == {IWM:74, QQQ:73, SPY:74}`,
      `session_dates == {"2026-08-10"}`.
- [ ] **Step 3 — the divergence test:** a constructed sample with `score: None` but
      `dist_to_flip_pct: Some(..)` is **dropped** by `pair_samples_outcomes` and **kept** by
      `pair_rows`. This is the behaviour change; assert it rather than discover it.
- [ ] **Step 4 — the single-definition test:** `session_dates_of` over a cell's rows, over the paired
      set, and over one symbol's loaded samples all agree on the same ET dates for the same `as_of`s.
      Assert `session_dates_of` is the **only** thing in `research/` that calls `session_date_et`
      (source scan over `research/*.rs`) — the structural half of "third call site, not a second
      definition".
- [ ] **Step 5:** green, exit 0. Commit.

---

### Task B5: `research::candidates` — the five-entry registry

**Files:** New `research/candidates.rs`.

- [ ] **Step 1 — the types:**

```rust
use crate::services::research::derivation::{shared_keys, DerivationKey as DK};
use crate::services::research::pairing::LabRow;
use quant_engine::{resolve_vol_scalar, HvPercent, IvDecimal, VolNormBasis};

/// Row-level exclusion reason. NEVER rendered alone — reasons ride inside literal 3's
/// parenthetical, each with its own count.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Ineligible {
    InputAbsent { field: &'static str },
    /// Reachable ONLY for `score` and the two geometry fields. `store.rs:138-149` writes `None`
    /// for a non-finite `net_gex`/`atm_iv`/`hv_30d`, so "carried but invalid" is indistinguishable
    /// from "never carried" for those four — see the wording rule in `vocabulary.rs` (AC-28).
    InputNonFinite { field: &'static str },
    VolScalarUnavailable,
    /// Defensive guard on the divide. `IvDecimal`/`HvPercent` make a non-positive scalar
    /// unreachable today; the variant is kept, DECLARED unreachable-in-v1 here, and exercised
    /// directly by a unit test so it is a tested branch rather than a dead one.
    DegenerateInput { field: &'static str },
    /// The row carried the input, not the outcome. `binary_label` returns `Option<bool>` and
    /// `score_lab.rs:253-257` filter_maps the `None`s away SILENTLY today — without this variant
    /// the CLOSURE identity is false for every label with missing outcome flags.
    LabelUndefined { label: &'static str },
}

pub enum Family { Score, GexMagnitude, LevelGeometry }
pub enum Role { Primary, Control { for_candidate: &'static str } }

/// How the ranked scalar was derived from its raw field. Mandatory: `projection.rs:25-45` proves
/// the geometry fields are SIGNED, so ranking them raw would put the FARTHEST rows in the top
/// decile and read as "level geometry is anti-predictive".
pub struct Orientation {
    pub raw_field: &'static str,
    pub negated_abs: bool,
    /// Rendered in words on every candidate row (AC-18).
    pub direction: &'static str,
}

pub struct Candidate {
    pub key: &'static str,          // stable, never reworded (AC-23)
    pub display: &'static str,
    pub family: Family,
    pub orientation: Orientation,
    pub basis: &'static str,        // exact expression + units, verbatim into the artifact
    pub inputs: &'static [&'static str],
    pub derived_from: &'static [DK], // TRANSITIVE. No default, may not be empty.
    pub role: Role,
    pub extract: fn(&LabRow) -> Result<f64, Ineligible>,
}
```

  `fn` pointers in a `const` slice — **not** trait objects and **not** a `Signal` trait (SPEC §2.10).

- [ ] **Step 2 — the extractors.** Check order inside the two GEX extractors is load-bearing:
      **`net_gex` first, then the vol scalar**, identically in both, so their reason maps are equal
      reason by reason (IDENTITY 3 / AC-12).

```rust
fn vol_scalar(r: &LabRow) -> Result<(f64, VolNormBasis), Ineligible> {
    let iv = r.atm_iv.and_then(IvDecimal::try_from_decimal);
    let hv = r.hv_30d.and_then(HvPercent::try_from_percent);
    let (v, basis) = resolve_vol_scalar(iv, hv).ok_or(Ineligible::VolScalarUnavailable)?;
    vol_scalar_guard(v)?;
    Ok((v, basis))
}

/// Extracted so the DegenerateInput branch is directly testable rather than dead.
pub(crate) fn vol_scalar_guard(v: f64) -> Result<(), Ineligible> {
    if !v.is_finite() || v <= 0.0 {
        return Err(Ineligible::DegenerateInput { field: "vol_scalar" });
    }
    Ok(())
}

fn extract_opportunity_score(r: &LabRow) -> Result<f64, Ineligible> {
    let v = r.score.ok_or(Ineligible::InputAbsent { field: "score" })?;
    if !v.is_finite() { return Err(Ineligible::InputNonFinite { field: "score" }); }
    Ok(v)
}

fn extract_net_gex_vol_norm_abs(r: &LabRow) -> Result<f64, Ineligible> {
    let g = r.net_gex.ok_or(Ineligible::InputAbsent { field: "net_gex" })?;
    if !g.is_finite() { return Err(Ineligible::InputNonFinite { field: "net_gex" }); }
    let (v, _) = vol_scalar(r)?;
    Ok(g.abs() / v)   // no rounding in the lab path: rank metrics only care about order
}

fn extract_net_gex_abs_raw(r: &LabRow) -> Result<f64, Ineligible> {
    let g = r.net_gex.ok_or(Ineligible::InputAbsent { field: "net_gex" })?;
    if !g.is_finite() { return Err(Ineligible::InputNonFinite { field: "net_gex" }); }
    // NOT DEAD CODE. The control deliberately REQUIRES a resolvable vol scalar it never uses, so
    // raw and vol-norm are measured over the identical row set. Delete this line and IDENTITY 3
    // (AC-12) goes red — which is exactly why the identity exists.
    let _unused_by_design = vol_scalar(r)?;
    Ok(g.abs())
}

fn extract_proximity_to_flip(r: &LabRow) -> Result<f64, Ineligible> {
    let d = r.dist_to_flip_pct.ok_or(Ineligible::InputAbsent { field: "dist_to_flip_pct" })?;
    if !d.is_finite() { return Err(Ineligible::InputNonFinite { field: "dist_to_flip_pct" }); }
    Ok(-d.abs())
}

fn extract_proximity_to_nearer_wall(r: &LabRow) -> Result<f64, Ineligible> {
    let d = r.dist_to_wall_pct.ok_or(Ineligible::InputAbsent { field: "dist_to_wall_pct" })?;
    if !d.is_finite() { return Err(Ineligible::InputNonFinite { field: "dist_to_wall_pct" }); }
    Ok(-d.abs())
}
```

- [ ] **Step 3 — the registry, in declared order (owner ruling C-1):**

```rust
pub const CANDIDATES: &[Candidate] = &[
    Candidate {
        key: "opportunity_score",
        display: "Composite opportunity score",
        family: Family::Score,
        orientation: Orientation { raw_field: "score", negated_abs: false,
            direction: "higher score ranks first" },
        basis: "score (0-100 composite, as captured; no transform)",
        inputs: &["score"],
        derived_from: &[DK::Score, DK::CallWall, DK::PutWall, DK::Flip, DK::PeakGex,
                        DK::OffExchange, DK::IvHvRatio, DK::Setups],
        role: Role::Primary,
        extract: extract_opportunity_score,
    },
    Candidate {
        key: "net_gex_vol_norm_abs",
        display: "Vol-normalized GEX magnitude",
        family: Family::GexMagnitude,
        orientation: Orientation { raw_field: "net_gex", negated_abs: false,
            direction: "larger vol-normalized |net GEX| ranks first" },
        basis: "abs(net_gex) / vol scalar (ATM IV decimal preferred, else 30d HV as decimal)",
        inputs: &["net_gex", "atm_iv", "hv_30d"],
        derived_from: &[DK::NetGex, DK::VolScalar],
        role: Role::Primary,
        extract: extract_net_gex_vol_norm_abs,
    },
    Candidate {
        key: "net_gex_abs_raw",
        display: "Raw GEX magnitude - control",
        family: Family::GexMagnitude,
        orientation: Orientation { raw_field: "net_gex", negated_abs: false,
            direction: "larger |net GEX| ranks first" },
        basis: "abs(net_gex) (requires a resolvable vol scalar it does not use, so the eligible \
                row set is identical to the vol-normalized candidate's)",
        inputs: &["net_gex", "atm_iv", "hv_30d"],
        derived_from: &[DK::NetGex],
        role: Role::Control { for_candidate: "net_gex_vol_norm_abs" },
        extract: extract_net_gex_abs_raw,
    },
    Candidate {
        key: "proximity_to_flip",
        display: "Closeness to flip",
        family: Family::LevelGeometry,
        orientation: Orientation { raw_field: "dist_to_flip_pct", negated_abs: true,
            direction: "nearer the flip ranks first" },
        basis: "-abs(dist_to_flip_pct) (signed distance to flip, %; folded to absolute then negated)",
        inputs: &["dist_to_flip_pct"],
        derived_from: &[DK::Flip],
        role: Role::Primary,
        extract: extract_proximity_to_flip,
    },
    Candidate {
        key: "proximity_to_nearer_wall",
        display: "Closeness to nearer wall",
        family: Family::LevelGeometry,
        orientation: Orientation { raw_field: "dist_to_wall_pct", negated_abs: true,
            direction: "nearer the nearer wall ranks first" },
        basis: "-abs(dist_to_wall_pct) (signed distance to nearer wall, %; folded then negated)",
        inputs: &["dist_to_wall_pct"],
        derived_from: &[DK::CallWall, DK::PutWall],
        role: Role::Primary,
        extract: extract_proximity_to_nearer_wall,
    },
];

/// Candidate x candidate overlap — a DIFFERENT mark from `definitionally_coupled`, rendered once
/// per candidate on its own label, never per cell (AC-77).
pub fn shares_derivation_with(c: &Candidate) -> Vec<(&'static str, Vec<DK>)> {
    CANDIDATES.iter()
        .filter(|o| o.key != c.key)
        .filter_map(|o| {
            let k = shared_keys(c.derived_from, o.derived_from);
            (!k.is_empty()).then_some((o.key, k))
        })
        .collect()
}
```

- [ ] **Step 4 — registry tests:**
  - `CANDIDATES.len() == 5`; keys unique; keys in the declared order
    `["opportunity_score","net_gex_vol_norm_abs","net_gex_abs_raw","proximity_to_flip","proximity_to_nearer_wall"]`.
  - **every** entry has `!derived_from.is_empty()` and `!inputs.is_empty()`.
  - `net_gex_abs_raw` is the only `Role::Control`, and its `for_candidate` names an existing key.
  - Geometry entries have `negated_abs == true`; every entry's `basis` names its `raw_field`
    (AC-20: no unqualified "distance").
  - **AC-3:** no `key`, `display`, `basis`, `direction` or `inputs` entry contains
    `net_gex_vol_norm_signed` — asserted again over the whole rendered artifact in B18.
  - `shares_derivation_with` returns exactly: composite ↔ `{proximity_to_flip: [Flip]}` and
    `{proximity_to_nearer_wall: [CallWall, PutWall]}`; the two GEX candidates ↔ each other via
    `[NetGex]`; and **no other pair**. Set equality, not "contains".
  - `vol_scalar_guard(0.0)` is `Err(DegenerateInput { field: "vol_scalar" })`;
    `vol_scalar_guard(0.22)` is `Ok(())`.
- [ ] **Step 5:** green, exit 0. Commit.

**Reviewer probe:** did anyone "clean up" `let _unused_by_design = vol_scalar(r)?;`? That deletion is
the exact defect IDENTITY 3 exists to make loud — and it only goes loud if B10's non-vacuity fixtures
exist.

---

### Task B6: Verify the composite's provenance **against `signals.rs`**, not against itself

`derived_from` being the *transitive determinant set* is correctness-critical, and an incomplete
declaration silently unmarks a coupled cell — the defect S2 caught **twice** (`PeakGex` and
`OffExchange` were both missed on the first pass because provenance was traced through the scoring
function alone and not its caller).

**Files:** Modify `research/derivation.rs` (test module).

- [ ] **Step 1 — write the guard:**

```rust
#[cfg(test)]
mod provenance_source_guard {
    use super::DerivationKey as DK;
    use crate::services::research::candidates::CANDIDATES;

    const SIGNALS_SRC: &str = include_str!("../../../../../libs/quant-engine/src/signals.rs");

    /// Everything that contributes to the emitted `opportunity_score` lives in ONE contiguous
    /// region: `generate_signals` (:169) through `dark_pool_confluence` (:506), ending where
    /// `state_fingerprint` (:554) begins. Slicing the region rather than a single function is the
    /// lesson of the two missed keys: the completeness bar is "trace every contributor to the
    /// emitted value", not "read the obviously-named function".
    fn score_region() -> &'static str {
        let start = SIGNALS_SRC.find("pub fn generate_signals(").expect("generate_signals");
        let end = SIGNALS_SRC.find("pub fn state_fingerprint(").expect("state_fingerprint");
        assert!(end > start, "signals.rs function order changed — re-derive this region");
        &SIGNALS_SRC[start..end]
    }

    /// identifier in the region  ->  the key it obliges us to declare.
    const CONTRIBUTORS: &[(&str, DK)] = &[
        ("dist.call_wall_pct", DK::CallWall),
        ("dist.put_wall_pct", DK::PutWall),
        ("dist.gamma_flip_pct", DK::Flip),
        ("state.peak_gex_strike", DK::PeakGex),
        ("dark_pool_confluence(", DK::OffExchange),
        ("ivhv", DK::IvHvRatio),
        ("setups.len()", DK::Setups),
    ];

    #[test]
    fn opportunity_score_derived_from_equals_what_signals_rs_actually_reads() {
        let region = score_region();

        // ---- anti-vacuity ----------------------------------------------------------------
        assert!(region.len() > 8_000, "region not sliced (len {})", region.len());
        assert!(region.contains("out.opportunity_score = drivers.total;"),
            "the region must contain the assignment that produces the emitted score");
        assert!(region.contains("dist.call_wall_pct"),
            "positive control: `contains` finds a needle that IS present");
        assert!(!region.contains("dist.max_pain_pct"),
            "negative control: `contains` rejects a needle that is NOT present");

        let composite = CANDIDATES.iter().find(|c| c.key == "opportunity_score").unwrap();

        // ---- SET EQUALITY, both directions -----------------------------------------------
        // Under-declaring (the S2 defect) and over-declaring both go red.
        let mut expected: Vec<DK> = vec![DK::Score];
        for (needle, key) in CONTRIBUTORS {
            if region.contains(needle) && !expected.contains(key) { expected.push(*key); }
        }
        expected.sort();
        let mut declared: Vec<DK> = composite.derived_from.to_vec();
        declared.sort();
        assert_eq!(declared, expected,
            "opportunity_score.derived_from must equal what signals.rs actually reads. \
             If signals.rs gained a determinant, add its key here AND to the registry; \
             if it lost one, narrow BOTH. Never narrow the registry alone.");
    }

    /// Every registry entry, both registries, declares a non-empty provenance set.
    #[test]
    fn no_registry_entry_has_an_empty_derived_from() {
        for c in CANDIDATES {
            assert!(!c.derived_from.is_empty(), "candidate {} declares no provenance", c.key);
        }
        for l in crate::services::research::labels::LABELS {
            assert!(!l.derived_from.is_empty(), "label {} declares no provenance", l.key);
        }
    }
}
```

- [ ] **Step 2:** run — red until B7 exists, then green. Both must be green before B11.
- [ ] **Step 3:** commit.

**Reviewer probe:** the `CONTRIBUTORS` table is the only hand-written link between the score and the
provenance model. If `signals.rs` grows a term whose identifier is not in that table, this test stays
green while the declaration goes stale. Re-check at every GATE S that touches `signals.rs`.

---

### Task B7: `research::labels` — three entries + the once-per-slice threshold

**Files:** New `research/labels.rs`.

- [ ] **Step 1 — types and registry:**

```rust
pub enum LabelRule { MedianAbsMove, RetPositive, StructureEvent }

pub struct Label {
    pub key: &'static str,
    /// Verbatim into every metric block, never into a legend at the bottom (AC-17).
    pub definition: &'static str,
    pub derived_from: &'static [DK],
    pub rule: LabelRule,
    /// Primary KPI renders before every secondary block (AC-58).
    pub primary: bool,
}

pub const LABELS: &[Label] = &[
    Label { key: "large_abs_move",
        definition: "abs_move >= median(abs_move) over the full paired set for this horizon",
        derived_from: &[DK::ForwardPricePath], rule: LabelRule::MedianAbsMove, primary: true },
    Label { key: "up_move",
        definition: "ret_simple > 0 (directional; the composite is ranking-not-direction)",
        derived_from: &[DK::ForwardPricePath], rule: LabelRule::RetPositive, primary: false },
    Label { key: "structure_event",
        definition: "hit_call_wall OR hit_put_wall OR crossed_flip within the horizon",
        // The three flags are FORWARD-PATH facts computed against the sample's OWN levels — which
        // is why this label's provenance names those levels and not merely the price path. That is
        // the entire coupling story for this feature.
        derived_from: &[DK::ForwardPricePath, DK::CallWall, DK::PutWall, DK::Flip],
        rule: LabelRule::StructureEvent, primary: false },
];
```

- [ ] **Step 2 — `LabelSet`:** computed **once per (horizon, slice)**, over the full paired row set,
      **before any grouping or candidate eligibility filtering**, held fixed across every cell.

```rust
pub struct LabelSet {
    /// Index-aligned to the row vector. `None` == the row carried no outcome for this label
    /// (-> `Ineligible::LabelUndefined`).
    pub values: BTreeMap<&'static str, Vec<Option<bool>>>,
    /// The threshold VALUE in force. Rides on every cell, because a median-relative label moves
    /// the bar with the slice.
    pub thresholds: BTreeMap<&'static str, Option<f64>>,
}

pub fn build_label_set(rows: &[LabRow]) -> LabelSet;
```

  The `large_abs_move` threshold is `percentile_sorted(sorted_finite_abs_moves, 0.5)` — the **same
  helper, same 0.5** as `binary_label` uses today, so pooled parity is bit-exact. Removes today's
  O(n² log n) re-sort per row per bin.

  **Per-group medians are forbidden** — they pin every symbol's base rate to ~0.50 and measure SPY's
  lift and QQQ's lift against different bars, destroying the cross-symbol comparison while looking
  fine.

- [ ] **Step 3 — tests:**
  - On `slice_2026-08-10`: positive counts are **111** (`large_abs_move`), **74** (`up_move`),
    **114** (`structure_event`) — the pre-feature numbers.
  - **The threshold is scope-invariant:** building from the full 221 rows and filtering to SPY yields
    the *same* threshold as the pooled build; re-deriving a median over SPY alone gives a
    **different** number — proving the once-only scoping is load-bearing, not incidental.
  - A row with `abs_move: None` yields `values["large_abs_move"][i] == None`.
- [ ] **Step 4:** green, exit 0. Commit.

---

### Task B8: `research::vocabulary` — four layers, ten literals, one distinctness proof

**Files:** New `research/vocabulary.rs`.

- [ ] **Step 1 — the types** (`Ineligible` lives in `candidates.rs`; re-export here so the vocabulary
      has one home):

```rust
pub enum CellState {
    Computed { metrics: Metrics, power: Power },
    NoPairedOutcome { n_samples_in_group: usize, horizon: String, symbol: String },
    NoEligibleRows { by_reason: BTreeMap<ReasonKey, usize> },  // non-empty by construction
    DegenerateCandidate { value: f64, n: usize },
    DegenerateLabel { n_pos: usize, n_neg: usize },
    NotApplicable { metric: &'static str, reason: &'static str },  // RESERVED — see below
    NotRun { block: &'static str, flag: &'static str },
}

pub enum Power { Powered, UnderPowered { n_rows: usize, n_sessions: usize, row_floor: usize,
                                         session_floor: usize } }

pub enum MetricValue { Value(f64), Absent(MetricState) }
pub enum MetricState {
    UnderMinimum { stat: &'static str, needs: usize, unit: &'static str, have: usize, carrier_n: usize },
    UndefinedOnThisData { stat: &'static str, precondition: &'static str, failing_fact: String },
}

pub const ROW_FLOOR: usize = 30;
pub const SESSION_FLOOR: usize = 2;
```

  **Metrics live *inside* `Computed`, with `power` as their sibling.** It is therefore
  **unrepresentable** for a thin carrier to lack its numbers. A metric exists **iff** the state is
  `Computed`. Ruling C-2 made unbreakable by construction. The withdrawn `InsufficientN` variant
  **stays withdrawn**.

  **`NotApplicable` is RESERVED AND NOT REACHABLE IN v1.** The precedence function below has **no arm
  that emits it**. Kept so a future boolean candidate has somewhere to land; the legend marks it
  `reserved — not reachable in v1`; AC-38 tests the negative.

- [ ] **Step 2 — the reason vocabulary and its AC-28 wording rule:**

```rust
#[derive(PartialEq, Eq, PartialOrd, Ord)]  // declared order = enum order = render order
pub enum ReasonKey {
    InputAbsent(&'static str),
    InputNonFinite(&'static str),
    VolScalarUnavailable,
    DegenerateInput(&'static str),
    LabelUndefined(&'static str),
    /// Retention scope only (B12a): a requested symbol the diary returned nothing for.
    NoSamplesLoaded,
}

/// Machine-stable key for the artifact map (`input_absent:net_gex`, `vol_scalar_unavailable`, ...).
pub fn reason_json_key(r: &ReasonKey) -> String;

/// Human text inside literal 3's parenthetical.
///
/// AC-28: for `net_gex` / `atm_iv` / `hv_30d` / `iv_hv_ratio` the text MUST say the value was not
/// carried OR was dropped at capture as non-finite/non-positive, and must NEVER claim "never
/// captured" — `store.rs:138-149` makes those two cases indistinguishable and the run cannot know.
/// (On `slice_2026-08-10` the true cause is a third thing again — the rows predate the capture
/// spine — which is exactly why the wording must not assert a cause it cannot know.)
pub fn reason_text(r: &ReasonKey) -> String {
    const CAPTURE_FILTERED: [&str; 4] = ["net_gex", "atm_iv", "hv_30d", "iv_hv_ratio"];
    match r {
        ReasonKey::InputAbsent(f) if CAPTURE_FILTERED.contains(f) =>
            format!("{f} not carried or dropped at capture (non-finite/non-positive)"),
        ReasonKey::InputAbsent(f) => format!("{f} absent"),
        ReasonKey::InputNonFinite(f) => format!("{f} non-finite"),
        ReasonKey::VolScalarUnavailable =>
            "vol scalar unavailable (atm_iv and hv_30d not carried or dropped at capture)".into(),
        ReasonKey::DegenerateInput(f) => format!("{f} degenerate"),
        ReasonKey::LabelUndefined(l) => format!("{l} undefined on this row"),
        ReasonKey::NoSamplesLoaded => "no samples loaded for this requested symbol".into(),
    }
}
```

  > **Planning decision, flagged for review.** §4's remark that "the longest literal is 78
  > characters" describes its *instances*; AC-28's wording is *binding* and makes the four
  > capture-filtered reasons longer. No AC asserts a maximum literal length, and §4's own layout rule
  > is "fewer metrics per line, **never shorter literals**", which accommodates it.

- [ ] **Step 3 — the ten literals, one renderer each.** Binding shapes (the spec's parentheticals are
      instances):

| # | Key | Shape |
|---|---|---|
| 1 | `Computed`, above both floors | `{v} (n={n}, sessions={s})` |
| 2 | `Computed`, under-powered | `{v} (n={n}, sessions={s} — under-powered: {floors})` |
| 3 | `NoEligibleRows` | `no eligible rows (0 of {P} paired rows: {reason} {k}, {reason} {k})` |
| 4 | `NoPairedOutcome` | `no paired outcome (0 of {n_samples} {SYMBOL} samples labelled at horizon {h})` |
| 5 | `DegenerateCandidate` | `no variation in the candidate ({n} eligible rows, all = {v}; ranking undefined)` |
| 6 | `DegenerateLabel` | `no variation in the label ({n} rows, {pos} positive / {neg} negative at {threshold_text}; ranking undefined)` |
| 7 | `NotApplicable` (reserved) | `not applicable ({reason})` |
| 8 | `NotRun` | `not run ({flag} off; {n} samples loaded, none examined)` |
| 9 | `UnderMinimum` | `not enough rows for this statistic ({stat} needs {needs} {unit}; {have} of {carrier_n} eligible rows)` |
| 10 | `UndefinedOnThisData` | `undefined for this data ({stat} needs {precondition}; {failing_fact})` |

  `{floors}` ∈ `below row floor {R}` · `below session floor {S}` · `below row floor {R} and session
  floor {S}`. `{threshold_text}` is the label's own: `large_abs_move >= 0.42%` ·
  `up_move (ret_simple > 0)` · `structure_event (hit_call_wall OR hit_put_wall OR crossed_flip)`.
  Literal 3's `{P}` noun varies by carrier scope: `paired rows` at cell scope, `loaded samples` at
  retention scope (B12a).

  > **Planning decision, flagged for review — number formatting.** AUC renders to **3 decimals**
  > (matching the published 0.467 and the shipped console's `{:.3}`); every other metric to **2**.
  > The artifact carries full `f64` precision regardless. Only the *shapes* bind, and the distinctness
  > proof depends only on "begins with a digit".

  **Retired and forbidden** — B18 rejects them: `too few (`, `undefined (base rate`,
  ` — not applicable`, `no input (`, `not attempted`.

- [ ] **Step 4 — the distinctness test, over the SET (not twelve snapshots):**

```rust
#[test]
fn twelve_strings_and_a_blank_are_pairwise_distinct() {
    let corpus: Vec<String> = vec![ /* literal 1 instance, literal 2 instance, literals 3..10,
                                       a bare above-floor value, and "" */ ];
    assert_eq!(corpus.len(), 13, "12 strings + a blank — a shrinking corpus stops proving");
    // (1) first-character partition: digit => a number is present; lowercase => no number here.
    // (2) `— under-powered:` appears in the marked value and NOWHERE else.
    // (3) no absence literal begins with a numeral.
    // (4) the eight absence heads differ by their second token; no head is a complete other literal.
    // (5) every literal is non-empty with a non-whitespace first character.
    // (6) every literal ends in `)` with exactly one BALANCED parenthetical (AC-37).
    // (7) `undefined for this data` is never abbreviated to a bare `undefined (` (AC-36).
    for (i, a) in corpus.iter().enumerate() {
        for (j, b) in corpus.iter().enumerate() {
            if i != j { assert_ne!(a, b, "literals {i} and {j} collide"); }
        }
    }
    // ... plus the seven properties above, each its own assertion with its own message.
}
```

- [ ] **Step 5:** green, exit 0. Commit.

---

### Task B9: `research::comparison` — precedence, carriers, metrics

**Files:** New `research/comparison.rs`.

- [ ] **Step 1 — groups and totality:**

```rust
pub enum GroupKey { Pooled, Symbol(String) }
```

  Pooled is **not a special case** — a group whose predicate is `|_| true`, so there is exactly one
  metrics code path and pooled cannot drift from per-symbol.

  **Groups are enumerated from `requested_symbols` BEFORE pairing.** `groups = {Pooled} ∪ {Symbol(s)}`
  in requested input order. The grid is the **full cross product**, in declared order, with **no
  filtering step anywhere that can remove a coordinate**.

- [ ] **Step 2 — ONE construction site.** Every carrier is built by a single function that
      dispositions *every* paired row into eligible-or-reason **before** choosing a state. That single
      site — not the type — is what makes `NoEligibleRows` with an empty map unreachable, which is why
      the invariant test in B10 is load-bearing rather than decorative.

```rust
fn disposition(rows: &[&LabRow], cand: &Candidate, label: Option<&Label>, ls: &LabelSet)
    -> (Vec<f64>, Vec<bool>, BTreeMap<ReasonKey, usize>);

pub fn build_cell(...) -> Cell;
pub fn build_record(...) -> CandidateScopeRecord;
```

- [ ] **Step 3 — the precedence function, first match wins:**

```rust
// 1. block switched off                       -> NotRun
// 2. n_paired_in_group == 0                   -> NoPairedOutcome     [PAIRING-SCOPED CARRIERS ONLY]
// 3. n_eligible == 0                          -> NoEligibleRows (map necessarily non-empty)
// 4. all eligible candidate values identical  -> DegenerateCandidate
// 5. n_positive == 0 || n_positive == n_elig  -> DegenerateLabel     [CELLS ONLY]
// 6. otherwise                                -> Computed
```

  **Arm 5 is label-scoped and is evaluated for cells only.** A candidate-scope record has no label and
  runs arms 1–4 then 6. That is exactly what makes literal 10 reachable (B10/AC-75). **Arm 2 is
  pairing-scoped**, which matters for B12a's retention carrier — see there.

- [ ] **Step 4 — cell fields.** `n_positive` and `base_rate` are **cell-level, not inside `Computed`**
      — literal 6 prints them for a `DegenerateLabel` cell. `Metrics` holds only the statistics:
      `auc`, `precision_top_decile`, `recall_top_decile`, `lift_top_decile`, `top_decile_n`,
      `n_positive_in_top`, `calibration`. All scalar metric fields are `MetricValue`, never
      `Option<f64>`.

  Also on the cell: `n_paired_in_group`, `n_samples_in_group`, `n_eligible`, `excluded_by_reason`,
  `n_rows`, `n_sessions`, `evidence_class`, `tie_fraction`, `under_powered`, `row_floor_in_force`,
  `session_floor_in_force`, `definitionally_coupled` + shared keys, label rule + threshold value,
  horizon, and `rendered: String` (the exact console literal).

- [ ] **Step 5 — quintile calibration.** Quantile bins of the candidate's **own** eligible values
      within the group, each bin reporting its quantile range *and* its native-unit edges — one
      binning rule for every candidate. **This changes `opportunity_score`'s calibration relative to
      the pre-feature run; declared by the `SCORE_LAB_VERSION` bump (B12), never silent.** Below 5
      usable rows the series renders literal 9.
- [ ] **Step 6 — `tie_fraction`** as a cell field. Tie density in the geometry candidates is real
      (`dist_to_flip_pct` is 2dp-rounded and exactly `0.00` on the flip; `man_whitney_auc` credits
      ties at 0.5), biasing those cells *toward* the null — the safe direction, but it must be visible.
- [ ] **Step 7 — the parity test (the centrepiece).** On `slice_2026-08-10`, the
      `(Pooled, opportunity_score, large_abs_move)` cell reproduces the B0 constants **exactly**
      (`assert_eq!` on `f64`, not a tolerance) for `auc`, `base_rate`, `precision_top_decile`,
      `lift_top_decile`, `top_decile_n`, `n_positive`, `n_eligible == 221`. Same for `up_move` and
      `structure_event`. The test states the calibration exception in its own body and asserts the
      **new** quintile edges alongside `CALIBRATION_EQUAL_WIDTH` (AC-71: both on record).
- [ ] **Step 8:** green, exit 0. Commit.

**Reviewer probe:** if the parity assertion needed a tolerance to pass, something reordered the row
vector or re-implemented a stat helper. Find it; do not widen the tolerance.

---

### Task B10: The three identities + the fixtures that make them bite

**Why unusually load-bearing:** these guards' whole value is that they go red when someone later
weakens them, and **on `slice_2026-08-10` two of them pass vacuously**. `slice_current` fixes that on
**real** data; the constructed fixtures cover shapes real capture will not reliably produce.

**Files:** Modify `comparison.rs` (test module) · `fixtures.rs`.

- [ ] **Step 1 — build the seven constructed fixtures.** Each returns
      `(Vec<StructureSample>, Vec<StructureOutcome>, Vec<String> /* requested symbols */)`, all
      deterministic (no RNG, no clock):

| Fixture | Shape | What only IT can carry |
|---|---|---|
| `f_mixed()` | 3 symbols × 3 ET sessions. **SPY**: every row carries `net_gex` + `atm_iv` (**zero** GEX exclusions). **QQQ**: no row carries `net_gex` (**all** excluded). **IWM**: half carry `net_gex` with **only `hv_30d`**, half with neither. Some rows carry `abs_move: None`. | AC-10's **asymmetric-symbol** condition — `slice_current` cannot supply it, since every symbol there has a near-identical population profile. Also AC-19's **`hv_30d` fallback arm**, which real capture cannot supply while `atm_iv` is always present. |
| `f_no_positives()` | one symbol scope where `structure_event` is false on every row | AC-31; AC-75 second half |
| `f_const_outcome()` | candidate values vary; `abs_move` identical on every usable pair | AC-75 first half (literal 10 on a record's correlation line) |
| `f_const_candidate()` | one candidate identical on every eligible row | AC-30 (literal 5) |
| `f_thin()` | a 3-row cell for one symbol **plus** a >30-row, ≥2-session cell for another | AC-49 (marker present) **and** AC-52 (marker absent) in one run; literal 9 on the quintile series |
| `f_sparse_pearson()` | ~150 eligible rows, only 2 with a finite `ret_simple` | AC-35 (the statistic's own n ≠ the carrier's `n=`) |
| `f_perfect_and_inverse()` | one candidate ranks the label perfectly, one exactly inversely, one unrelated | AC-5 |

- [ ] **Step 2 — write the identity assertions** as one reusable helper applied to **every** fixture's
      artifact, universally quantified over the full grid **with no carve-out**:

```rust
pub fn assert_identities(a: &Artifact) {
    // IDENTITY 2 — CLOSURE, per cell: used + sum(exclusions) == that scope's OWN paired count.
    for c in &a.cells {
        let excluded: usize = c.excluded_by_reason.values().sum();
        assert_eq!(c.n_eligible + excluded, c.n_paired_in_group,
            "CLOSURE failed at ({}, {}, {})", c.group, c.candidate, c.label);
    }
    // ...and P(Pooled) == sum over symbols.
    // IDENTITY 1 — COMPOSITION, per (candidate, label): pooled used == sum of per-symbol used,
    // and for EVERY reason r, pooled E(r) == sum of per-symbol E(r).
    // IDENTITY 3 — PAIRED ELIGIBILITY, per (group, label):
    //   U(net_gex_abs_raw) == U(net_gex_vol_norm_abs) AND their reason maps are EQUAL.
}

/// COMPOSITION is the load-bearing one — it is what fails when a symbol is silently dropped.
/// The FALSE form that must never appear is "pooled = sum(per-symbol) + exclusions": it
/// double-counts E and is true only when E == 0.
pub fn assert_composition_is_not_vacuous(a: &Artifact) { /* ... */ }
pub fn assert_identity3_is_not_vacuous(a: &Artifact) { /* ... */ }
```

- [ ] **Step 3 — apply, and record which fixture carries which:**
  - `assert_identities` runs on **every** fixture, including `slice_2026-08-10`.
  - `assert_identity3_is_not_vacuous` runs on **`slice_current`** (real data) **and** `f_mixed()`.
  - `assert_composition_is_not_vacuous` runs on **`f_mixed()`**, with a doc comment stating that
    `slice_current` cannot carry it.
  - Each real-data guard uses `slice_current_outcomes()`; when it returns `None` the test **prints a
    loud SKIP and returns** — never a silent pass.
- [ ] **Step 4 — the totality test (AC-8):** on `slice_2026-08-10` with `--symbols SPY,QQQ,IWM,DIA`,
      the `(group, candidate, label)` key **set** equals the declared cross product;
      `cells.len() == 75`; every cell carries a `state`; DIA cells carry literal 4. **Set equality**,
      not length.
- [ ] **Step 5 — the empty-map invariant (AC-32):** no cell has `n_eligible == 0` with an empty
      `excluded_by_reason` *and* a state that names no group-level cause.
- [ ] **Step 6:** green, exit 0. Commit.

---

### Task B11: The coupling marks and their pins

**Files:** Modify `comparison.rs`, `candidates.rs` (test modules).

- [ ] **Step 1 — derive, do not hand-keep:**
      `definitionally_coupled(cand, label) = shared_keys(cand.derived_from, label.derived_from)`,
      emitted as a boolean **plus the shared keys**, rendered **inside the cell's own text**, never in
      a legend — `definitionally coupled with structure_event (shared: call wall, put wall)`.
- [ ] **Step 2 — the AC-76 set-equality pin:**

```rust
#[test]
fn coupled_set_over_the_declared_grid_equals_the_pinned_v1_set() {
    let mut fired: BTreeSet<(&str, &str)> = BTreeSet::new();
    for c in CANDIDATES {
        for l in LABELS {
            if !shared_keys(c.derived_from, l.derived_from).is_empty() {
                fired.insert((c.key, l.key));
            }
        }
    }
    assert_eq!(fired, BTreeSet::from([
            ("opportunity_score", "structure_event"),
            ("proximity_to_flip", "structure_event"),
            ("proximity_to_nearer_wall", "structure_event"),
        ]),
        "Emptying or NARROWING any registry `derived_from` must fail here rather than silently \
         unmark a cell. The composite x structure_event pair IS the deep dive's 0.932 row.");
    assert!(fired.iter().all(|(_, l)| *l == "structure_event"),
        "no candidate couples with large_abs_move or up_move — ForwardPricePath alone is shared \
         with no snapshot-time read");
    assert_eq!(fired.len(), 3);
}
```

- [ ] **Step 3 — mutation guards proving the pin bites** (four tests over *local copies* of the
      registry rows, never mutating the `const`): (a) narrowing the composite to `[Score]` drops it;
      (b) emptying `structure_event.derived_from` empties the set; (c) adding `Flip` to
      `large_abs_move` adds two pairs; (d) an unrelated key on both sides adds a pair.
- [ ] **Step 4 — AC-55/AC-77 in the emitted output:** every coupled cell's `rendered` contains the
      coupling mark with its shared keys; every candidate's label block contains
      `shares derivation with: {partners} ({shared human keys})`; the composite's note names **both**
      geometry candidates; the note is a **different string** from the coupling mark and never
      replaces it. Assert on all five candidates — an **absent** note is what review does not see.
- [ ] **Step 5:** green, exit 0. Commit.

---

### Task B12: `research::artifact` — the JSON shape, evidence class, legend, version bump

**Files:** New `research/artifact.rs` · Modify `score_lab.rs` (`SCORE_LAB_VERSION`).

- [ ] **Step 1 — bump the version:** `pub const SCORE_LAB_VERSION: &str = "score_lab_v2-2026-08";`
      (was `score_lab_v1-2026-04`). Assert the old string appears nowhere in the emitted artifact.
- [ ] **Step 2 — the top-level shape** (flat, not nested): `version` · `generated_at_utc` · `horizon` ·
      `requested_symbols` · `sample_source` · `outcomes_path` · `window_utc_first` ·
      `window_utc_last` · `session_dates` (**the set**) · `n_samples_loaded` · `n_outcomes_loaded` ·
      `n_paired` · `duplicate_keys_collapsed` · `evidence_class` · `bar_text` ·
      `bar_evaluable_from_single_run: false` + `bar_not_evaluable_reason` · **`retention[]` (B12a)** ·
      `authorizes` · `row_floor_in_force` · `session_floor_in_force` · `labels[]` · `candidates[]` ·
      `cells[]` · `candidate_scope[]` · `driver_attribution` · `literal_legend`.
- [ ] **Step 3 — `evidence_class`, derived run-level from the FULL paired set**, facts only:
      `d <= 1` → `SINGLE SESSION (d=1)`; else `span_calendar_days >= 14` →
      `MULTI-WEEK (d={d}, span {n} calendar days)`; else `MULTI-SESSION (d={d})`. Symbol scope is a
      **second, independent fact** on the same line. Sessions come from `session_dates_of` (B4) —
      **never a second definition**.
      > **Planning decision, flagged for review:** the `MULTI-WEEK` threshold (`span >= 14 calendar
      > days`) is not fixed by the spec; it is a pure function of the data and unreachable under the
      > current cap, which the artifact records via `bar_evaluable_from_single_run: false`.
      `BELOW BAR`, `AT BAR`, `INSUFFICIENT — cannot evaluate` are **gone and must not return**.
- [ ] **Step 4 — every carrier carries its own `rendered: String`,** the exact console literal (AC-21,
      and it makes AC-26's scan checkable over the artifact alone).
- [ ] **Step 5 — `literal_legend`:** the ten literals with meanings, `NotApplicable` marked
      `reserved — not reachable in v1`.
- [ ] **Step 6 — determinism (AC-6):** `generated_at_utc` is **injected**, so a test runs the same
      inputs twice and asserts the two serialized artifacts are **byte-identical**. Every map is a
      `BTreeMap`, every set a `BTreeSet`.
- [ ] **Step 7:** green, exit 0. Commit.

---

### Task B12a: Hoist `samples_loaded` and `sessions_covered` to run scope — the `retention[]` block

**Why this task exists.** The GATE Z retention amendment removed the hardcoded `about 7 sessions per
symbol` from the evidence header. The header now prints the **cap** as a constant and **derives**
everything else from the run's own rows (SPEC §2.8 `retention[]`, §4, AC-78). Those quantities —
`samples_loaded` and `sessions_covered` — exist today **only at cell scope** (`n_samples_in_group`,
`n_sessions`), and **the evidence header is emitted before any cell**. Nothing else in the artifact
supplies them. The synthesizer named this as a planner gap rather than letting a lane discover it
mid-build.

**The correctness point, and the whole reason this is its own task: a THIRD CALL SITE of one pure
function, NOT a second definition of "session".** Two independent notions of what a session is would
silently diverge between the header and the per-cell figures, and that is precisely the class of
defect this feature exists to prevent. `session_dates_of` (B4, wrapping `session_date_et`) is the
single definition; this task calls it over a **different row set** — per-symbol *loaded samples*
rather than paired rows — never under a different rule.

**Files:** Modify `research/pairing.rs` · `research/artifact.rs`. **Must land before B13.**

- [ ] **Step 1 — run-scope per-symbol load stats.** In `pairing.rs`, add to `Pairing`:

```rust
pub struct SymbolLoadStats {
    pub samples_loaded: usize,
    pub session_dates: BTreeSet<String>,   // via session_dates_of — the ONE definition
    pub window_first: Option<f64>,
    pub window_last: Option<f64>,
}

/// Keyed by REQUESTED symbol, in requested order. A requested symbol the diary returned nothing
/// for STILL gets an entry with `samples_loaded: 0` — §5's new row: never an omitted symbol.
pub loaded_by_symbol: BTreeMap<String, SymbolLoadStats>,
```

  Computed from the **loaded sample set** plus the **requested symbol set**, in the same pass that
  computes `session_dates`. Note the row sets differ deliberately: `evidence_class` is over *paired*
  rows, retention is over *loaded* samples (the ring's contents are what the cap bounds).

- [ ] **Step 2 — the `Retention` record** in `artifact.rs`:

```rust
pub struct Retention {
    pub symbol: String,
    pub samples_loaded: usize,
    /// The ONE retention constant that may be a literal, because it IS one.
    /// Imported from `scanner::store::STRUCTURE_HISTORY_MAX` — never re-typed as `576`.
    pub cap: usize,
    pub sessions_covered: usize,
    pub samples_per_session_observed: MetricValue,  // samples_loaded / sessions_covered
    pub cap_holds_sessions_estimate: MetricValue,   // cap / samples_per_session_observed
    /// The window the estimate was computed over — an estimate without its window is a claim.
    pub window_first: Option<String>,
    pub window_last: Option<String>,
    pub state: CellState,
    pub rendered: String,
}
```

- [ ] **Step 3 — the zero-denominator arm (§5's new row).** Retention's carrier scope is one symbol's
      **loaded samples**, where pairing has no meaning — so **arm 2 is inapplicable here**, exactly as
      **arm 5 is inapplicable at candidate-scope-record scope** because there is no label (§2.4's own
      precedent). `samples_loaded == 0` therefore falls to **arm 3**, and both estimate fields render
      **literal 3**, per §5: never a zero, never a blank, never an omitted symbol.

```text
  DIA   0 of 576 held · no eligible rows (0 of 0 loaded samples: no samples loaded for this requested symbol 0)
```

  > **Planning decision, flagged for review — the one place §5 and §2.4 need a bridge.** §5's new row
  > says the estimate renders the **no-eligible-rows** literal (3), not no-paired-outcome (4).
  > Reading arm 2 as pairing-scoped is what makes those two statements consistent, and it reuses the
  > arm-5 precedent rather than inventing a rule. The alternative — an **empty** reason map — was
  > considered and rejected: AC-32 forbids exactly that pairing at cell scope, and adopting it here
  > would put a shape one AC away from a violation into the artifact. The trailing ` 0` reads oddly in
  > this degenerate case; it is kept so literal 3's shape (and the closing-paren and distinctness
  > guards) hold without a carve-out. **If an implementer finds this reading contradicts §2.4 in
  > practice, report the conflict — do not resolve it.**

- [ ] **Step 4 — tests (AC-78).** Write these before the implementation:

```rust
/// AC-78 arm 1+2: two fixtures with DIFFERENT capture rates must print DIFFERENT figures.
/// The fixture precondition (the rates really do differ) is asserted separately in B0 so a
/// false-fail here is legible.
#[test]
fn retention_figures_are_derived_not_constant() {
    let a = run_lab(inputs_for(slice_0810())).unwrap().artifact;
    let b = run_lab(inputs_for(slice_current())).unwrap().artifact;
    let spy = |art: &Artifact| art.retention.iter().find(|r| r.symbol == "SPY").unwrap().clone();
    let (ra, rb) = (spy(&a), spy(&b));

    assert_ne!(ra.samples_per_session_observed, rb.samples_per_session_observed,
        "observed rate regressed to a constant: {ra:?} vs {rb:?}");
    assert_ne!(ra.cap_holds_sessions_estimate, rb.cap_holds_sessions_estimate,
        "implied span regressed to a constant: {ra:?} vs {rb:?}");
    // The cap is the ONE thing that must be identical, because it IS a constant.
    assert_eq!(ra.cap, rb.cap);
    assert_eq!(ra.cap, crate::services::scanner::store::STRUCTURE_HISTORY_MAX);
    // Every estimate is labelled with the window it was computed over.
    assert!(ra.window_first.is_some() && ra.window_last.is_some());
}

/// No retention figure may be a literal in code or copy. The cap is exempt — it IS one.
#[test]
fn no_retention_literal_appears_in_emitted_strings_or_source() {
    const RENDER_SRC: &str = include_str!("render.rs");
    const ARTIFACT_SRC: &str = include_str!("artifact.rs");
    for banned in ["about 7 sessions", "7 sessions per symbol", "about seven sessions",
                   "~74", "78 samples", "168 samples", "3.4 days", "about 4 sessions"] {
        for (name, src) in [("render.rs", RENDER_SRC), ("artifact.rs", ARTIFACT_SRC)] {
            assert!(!src.contains(banned),
                "{name} contains the retention literal {banned:?} — it must be DERIVED (AC-78)");
        }
    }
    // The cap is imported, never re-typed.
    assert!(!RENDER_SRC.contains("576") && !ARTIFACT_SRC.contains("576"),
        "the cap must come from STRUCTURE_HISTORY_MAX, not a typed 576");
    // Anti-vacuity: the scan bites.
    assert!(RENDER_SRC.contains("STRUCTURE_HISTORY_MAX") || ARTIFACT_SRC.contains("STRUCTURE_HISTORY_MAX"));
}

/// §5's new row: a requested symbol with zero loaded samples.
#[test]
fn a_requested_symbol_with_no_samples_still_gets_a_retention_entry() {
    let art = run_lab(inputs_for_with_symbols(slice_0810(), &["SPY", "QQQ", "IWM", "DIA"])).unwrap().artifact;
    let dia = art.retention.iter().find(|r| r.symbol == "DIA").expect("DIA is never omitted");
    assert_eq!(dia.samples_loaded, 0);
    assert!(dia.rendered.starts_with("no eligible rows ("), "renders literal 3, not a zero or blank");
    assert!(!dia.rendered.contains("0.0") && !dia.rendered.contains("n/a"));
}

/// The single-definition guarantee, from the consumer side.
#[test]
fn retention_sessions_agree_with_the_cell_level_session_counts() {
    let art = run_lab(inputs_for(slice_current())).unwrap().artifact;
    for r in &art.retention {
        if r.samples_loaded == 0 { continue; }
        let cell_sessions = art.cells.iter()
            .filter(|c| c.group == format!("Symbol({})", r.symbol))
            .map(|c| c.n_sessions).max().unwrap_or(0);
        assert!(cell_sessions <= r.sessions_covered,
            "a cell cannot cover MORE sessions than the symbol's loaded samples do — \
             two different notions of 'session' have crept in ({} vs {})",
            cell_sessions, r.sessions_covered);
    }
}
```

- [ ] **Step 5 — implement** `retention[]`, emitted in requested-symbol order, and wire it into the
      artifact between `bar_not_evaluable_reason` and `authorizes`. `run_lab` computes it in the same
      pass as `evidence_class`.
- [ ] **Step 6:** `cargo test -p api-rust research::artifact` green, baseline non-decrease, exit 0.
      Commit — `feat(research): derive retention figures per run (retention[], AC-78)`.

**Reviewer probe:** grep the whole `research/` tree for a bare `576` and for any session-count numeral
in a format string. The previous hardcoded figure read correctly on the day it was written and was
wrong by a factor of two within weeks — that is the failure mode, and it is invisible on any single
run.

---

### Task B13: `render` — evidence header, provenance line, slice description

**Files:** New `research/render.rs`. **Depends on B12a.**

- [ ] **Step 1 — the evidence header, verbatim from the AMENDED §4** (AC-45 is `review`, so the copy
      must match exactly, with only the varying parts substituted). **Every number in the "Not
      evaluable here" block except the cap is computed per run from `retention[]`** — the figures
      below are an instance, not literals:

```text
RESEARCH READ — NOT A PRODUCT RULING
  Evidence:   SINGLE SESSION (d=1) · symbols: SPY, QQQ, IWM
  This run:   2026-08-10 17:15–23:58 UTC (6h43m) · 221 paired rows · horizon 1d
  Bar (runbook text, printed beside the run's values; this run does not evaluate it):
              large_abs_move lift @ top decile >= 1.10, sustained across >= 10 sessions
              spanning >= 3 calendar weeks
  Not evaluable here: the multi-week half needs more history than the raw diary holds. The diary is
              a per-symbol ring capped at STRUCTURE_HISTORY_MAX = 576 samples, oldest evicted first.
              At this run's own observed rate — SPY 250 of 576 over 2 sessions, 125/session — the
              cap holds about 4 sessions. Derived from these rows over 2026-08-10→2026-08-12; not a
              stored constant, and it moves when the capture rate moves.
  Authorizes: nothing. No weight, constant, gate threshold or fingerprint basis changes on the
              strength of this run.  [score-change-is-deliberate-and-measured]
  Ranking a candidate signal here is not adopting it.
```

  `STRUCTURE_HISTORY_MAX = 576` is printed as a constant **because it is one** — imported, not typed.
  The samples held, sessions covered, observed per-session rate and implied span come from
  `retention[]` (B12a) and are labelled as observations over a stated window. This is the same
  discipline the spec applies to label thresholds and power floors.

- [ ] **Step 2 — block 2 (provenance):** report version, generated-at UTC, outcomes artifact path
      consumed, sample source, horizon. **Nothing may be reported that this line cannot source.**
- [ ] **Step 3 — block 3 (slice description):** requested symbols, paired rows, window first→last UTC,
      sessions covered, both floors as numbers, label definitions **verbatim** with their threshold
      values. Plus the stale-diary line (AC-64) when the newest paired sample predates the run beyond
      one session: `Newest sample {d} ({n} days before this run) — this read describes an older diary,
      not today`.
- [ ] **Step 4 — tests:** the header is the **first** block on every branch including the degenerate
      ones (AC-43); the one-line form repeats at the end (B15); **two fixtures**
      (`slice_2026-08-10` = 1 session, `slice_current` / `f_mixed()` = ≥3 sessions) emit **different**
      evidence-class tokens **and different retention figures** (AC-44 + AC-78 in one run); no output
      contains `AT BAR`, `BELOW BAR`, `PASS`, `FAIL`, `MEETS`, `above the bar`, `below the bar`; the
      stale-diary line fires 7 days after the newest sample and not in the same session.
- [ ] **Step 5:** green, exit 0. Commit.

---

### Task B14: `render` — candidate-major metric blocks

Layout is **candidate-major line blocks, not a column grid**: the two metric-level literals reach ~110
characters, which no fixed-width grid holds without dropping the qualifiers — and the qualifiers are
the honesty. Under width pressure the console prints **fewer metrics per line, never shorter
literals**.

- [ ] **Step 1 — the candidate labels, in declared order, verbatim from §4** (row 3 prints
      **immediately after** row 2 and carries its control marker **in its own label**):

```text
1  Composite opportunity score
   shares derivation with: Closeness to flip, Closeness to nearer wall (call wall, put wall, flip —
   up to 40 of its 100 points are proximity to the nearest of those levels, plus 10 for flip proximity)
2  Vol-normalized GEX magnitude (ranked on |net GEX| / vol scalar; basis mix: ATM IV {a}, HV 30d {h}, unavailable {u})
   shares derivation with: Raw GEX magnitude — control (net GEX)
3  Raw GEX magnitude — control (ranked on |net GEX|; same eligible rows as the row above, so a vol-norm result can be attributed to the normalization)
   shares derivation with: Vol-normalized GEX magnitude (net GEX)
4  Closeness to flip (ranked on -|signed distance to flip, %|; higher = nearer)
   shares derivation with: Composite opportunity score (flip)
5  Closeness to nearer wall (ranked on -|signed distance to nearer wall, %|; higher = nearer)
   shares derivation with: Composite opportunity score (call wall, put wall)
```

- [ ] **Step 2 — the block body**, per §4's rendered example. The marker rides on **every**
      value-bearing atom and on the block header; a metric line with no value renders literal 9 or 10
      **alone**:

```text
  Closeness to nearer wall — large_abs_move · IWM
  n = 3 (excluded 71: dist_to_wall_pct absent 71) · sessions = 1 — under-powered: below row floor 30 and session floor 2
  AUC          0.670 (n=3, sessions=1 — under-powered: below row floor 30 and session floor 2)
  Lift@10      1.50 (n=3, sessions=1 — under-powered: below row floor 30 and session floor 2)
  Calibration  not enough rows for this statistic (quintile calibration needs 5 usable rows; 3 of 3 eligible rows)
```

- [ ] **Step 3 — required per-row facts:** ranking direction in words (AC-18); label definition
      verbatim in the same block (AC-17); horizon, window, symbol scope, row and session counts,
      threshold value (AC-16); the pooled GEX-family caveat that net GEX magnitude is **not
      symbol-comparable** (AC-15); the coupling mark inside the cell's own text (AC-55).
- [ ] **Step 4 — block ordering:** primary-KPI block before any secondary block, each secondary block
      **labelled secondary**; the per-symbol section headed `Per symbol — pooled above is not a
      summary of these`; a single-symbol run still renders the per-symbol section (AC-14).
- [ ] **Step 5 — tests:** the marker appears on a below-floor cell **and is absent** on an above-floor
      cell in the *same* run (`f_thin()`, and again on `slice_current`); the `— under-powered:`
      substring appears only in value-bearing atoms and block headers, **never inside literals 3–10**;
      candidate order in the emitted vector is the declared order and symbol order is the input order,
      asserted **on the emitted vector** so a later `sort_by(auc)` fails rather than passes green.
- [ ] **Step 6:** green, exit 0. Commit.

---

### Task B15: `render` — calibration, driver attribution, the repeated one-liner

- [ ] **Step 1 — calibration**, per candidate, quintile bins with quantile range *and* native-unit
      edges; thin bins **marked, never withheld**.
- [ ] **Step 2 — driver attribution**, same vocabulary: nothing eligible → literal 3 naming how many
      of how many rows were checked, and **no rows of `n = 0`** (AC-39, `slice_2026-08-10`'s live
      case); switched off → literal 8 naming that flag, never literal 3 and never a blank section
      (AC-40); partially present → computed on the rows that have it, reporting its reduced count plus
      the excluded count (AC-41).
- [ ] **Step 3 — the evidence one-liner** repeated at the end of the console output (AC-43).
- [ ] **Step 4 — tests:** AC-39 on `slice_2026-08-10` (assert the literal, and that `n = 0` appears in
      **no** driver row); AC-40 with `--driver-loo false`; AC-41 as above.
- [ ] **Step 5:** green, exit 0. Commit.

---

### Task B16: Error paths — three named causes, no artifact, ever

**Files:** New `research/run.rs`.

- [ ] **Step 1 — make "no artifact on failure" structural, not remembered:**

```rust
pub enum LabError {
    /// AC-59 — three DISTINGUISHABLE causes with counts, not today's single `bail!`.
    NoPairedRows { n_samples: usize, n_outcomes: usize, horizon: String, cause: NoPairCause },
    /// AC-60
    HorizonHasNoOutcomes { horizon: String, horizons_present: Vec<String> },
    /// AC-61
    InputUnreadable { path: String, source: String },
    /// AC-62 — raised BEFORE any metric is computed and before any artifact is written.
    AnalyticsReadFailed { symbol: String, source: String },
}
pub enum NoPairCause { NoSamplesLoaded, NoOutcomesLoaded, NoOverlapAtHorizon }

pub struct LabRun { pub artifact: Artifact, pub console: String }

/// The ONE entrypoint. Reads nothing, writes nothing. `main.rs` may only write the artifact after
/// this returns `Ok`, so "an empty or partial artifact is never written" is a property of the
/// call graph rather than a rule an implementer must remember.
pub fn run_lab(inputs: LabInputs) -> Result<LabRun, LabError>;

/// Strict collection: `main.rs` performs the (async) reads and hands the results here. The first
/// failure aborts before any metric and before any artifact.
pub fn strict_collect(
    reads: Vec<(String, Result<Vec<StructureSample>, String>)>,
) -> Result<Vec<StructureSample>, LabError>;
```

- [ ] **Step 2 — the messages.** `NoPairedRows` prints the exact next command, e.g.
      `No paired rows for horizon=1d. Samples loaded: 221. Outcomes loaded: 0. Run join-outcomes
      first: cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM`.
      `AnalyticsReadFailed` names the symbol **and** the underlying SQL error.
- [ ] **Step 3 — tests:** each variant's `Display` contains its named facts; `strict_collect` with one
      failing entry returns `AnalyticsReadFailed` naming that symbol; `run_lab` on zero overlap
      returns `NoPairedRows { cause: NoOverlapAtHorizon }`.
- [ ] **Step 4:** green, exit 0. Commit.

---

### Task B17: `main.rs` — rewire `cmd_score_lab`

- [ ] **Step 1 — CLI surface is UNCHANGED.** Same flags. **Comparative, per-symbol is the DEFAULT —
      no new flag** (AC-74). One semantic change: `--symbols`, when given, is now the **requested**
      symbol set that enumerates groups (previously a post-load filter); absent, it is the distinct
      symbols of the loaded samples.
- [ ] **Step 2 — the new body**, in this exact order:
  1. read outcomes file → on failure `LabError::InputUnreadable`;
  2. resolve the requested symbol set;
  3. load samples — `--samples` file path, **or** the store via **`read_structure_history_strict`**
     (never `read_structure_history`), collecting `Vec<(String, Result<Vec<StructureSample>, String>)>`;
  4. `strict_collect(...)?`;
  5. `run_lab(...)?`;
  6. **only now** `create_dir_all` + `write` the artifact;
  7. print `run.console` (or the artifact JSON under `--json`).
- [ ] **Step 3 — delete the old console block.** `main.rs:655` and `:659`
      (`.unwrap_or_else(|| "n/a".into())`) are the **live instances** of the closed-vocabulary defect
      this feature exists to eliminate. `evaluate_baseline` and `leave_one_driver_out` are **no longer
      called from `main.rs`**.
- [ ] **Step 4 — progress lines** naming the phase during a long store read (AC-63), to **stderr** so
      `--json` stdout stays machine-readable.
- [ ] **Step 5 — tests:** source scan asserting `main.rs` contains `read_structure_history_strict` and
      **not** a bare `read_structure_history(` inside `cmd_score_lab`, and no `evaluate_baseline`.
- [ ] **Step 6:** `cargo test` green, exit 0. Commit.

---

### Task B18: The closed-vocabulary and banned-term scans

**This is the highest-probability regression in the whole feature** — a one-line "cleanup" that looks
like polish.

- [ ] **Step 1 — the scan**, over **every rendered string** in the console *and* the artifact (all
      `rendered` fields plus every string-valued field), for **every** fixture:
  - **Nothing outside the ten literals** where a carrier's value belongs;
  - `n/a`, `NaN`, `null`, a bare `-`, an empty carrier, a bare `0`, and `undefined (` appear in **no**
    cell;
  - retired strings appear nowhere: `too few (`, `undefined (base rate`, ` — not applicable`,
    `no input (`, `not attempted`;
  - `net_gex_vol_norm_signed` and any display label for it appear **nowhere** (AC-3);
  - **no adoption or verdict language** — `better`, `best`, `winning`, `winner`, `recommended`,
    `promising`, `ready`, `top signal`, `validated`, `backtested`, `proved`, `accurate`,
    `predictive`, `works`, `edge`, `independent`, `unrelated`, `orthogonal`, `standalone`,
    `next step` (AC-54, AC-56);
  - `AT BAR` · `BELOW BAR` · `PASS` · `FAIL` · `MEETS` · `above the bar` · `below the bar` (AC-44);
  - **no standing retention claim** (§4's new term-table row): the emitted strings contain no
    session-count or samples-per-day figure other than the ones `retention[]` derived, and none of
    `about 7 sessions`, `7 sessions per symbol`, `about seven sessions`, `keeps about`, `~74`,
    `78 samples`, `168 samples`, `3.4 days` (AC-78).
- [ ] **Step 2 — anti-vacuity:** assert the scanned corpus is non-empty and exceeds a floor
      (`console.len() > 4_000`, `cells.len() == 75` on the totality fixture), and assert the scanner
      **bites**: feed it a synthetic string containing `n/a`, and a second containing
      `keeps about 7 sessions`, and assert each is reported. A guard that cannot demonstrate it bites
      is not enforcement.
- [ ] **Step 3 — AC-38's must-not-fire:** no cell in **any** run or fixture carries `NotApplicable`;
      the legend marks it `reserved — not reachable in v1`.
- [ ] **Step 4:** green, exit 0. Commit.

---

### Task B19: The capture-side `warn!` and the wrong retention comment

> **Read this first.** The capture-spine fix **is working**: 12,256 of 12,477 samples carry
> `score_drivers`, and every post-`13656ad` row carries the analytics fields too. The deep dive reads
> as though the append path is broken; **it is not**, and B21 step 3 corrects that doc. **The genuine
> residual is exactly one thing** — nothing logs when an `ok` row yields null drivers. **Do not "fix"
> the append path. It is correct.**

- [ ] **Step 1 — `loop.rs`, in the `Some(sample)` arm (~`:468`)**, where `row.status == "ok"` and a
      score exists but `row.score_drivers.is_none()`, emit a `warn!` naming symbol / `as_of` / score,
      mirroring the existing `from_row`-skipped warning at `:475`. **Log only.**

```rust
if row.score.is_some() && row.score_drivers.is_none() {
    warn!(
        ticker = %sym,
        as_of = row.as_of,
        score = ?row.score,
        "scanner ok row carried a score but no score_drivers — a live capture regression, \
         not a pre-13656ad row"
    );
}
```

- [ ] **Step 2 — `store.rs:28`**, correct the wrong in-code comment (`~2 RTH weeks at 5-minute
      thinning`). **State the cap and the mechanism, not a span:** 576 samples per symbol, oldest
      evicted first; the span that implies depends on the capture rate, which is observed per run and
      printed by `retention[]` (B12a) rather than asserted here. Naming a fixed span in a comment is
      the same defect §2.10 now rejects in copy — do not replace one stale number with another.
      **Raising `STRUCTURE_HISTORY_MAX` or archiving rows is NOT in scope** — a separate
      durable-storage decision logged to BACKLOG at GATE S, which the measurement strengthens.
- [ ] **Step 3 — test (AC-42):** unit-test the predicate as a pure fn
      (`fn should_warn_missing_drivers(row: &ScanRow) -> bool`): ok+score+no drivers → true;
      ok+score+drivers → false; non-ok → false. Assert `append_structure_sample` is called with an
      **unchanged** sample in the warning case.
- [ ] **Step 4:** `cargo test` green, baseline non-decrease, exit 0. Commit.

> **SPEC §9 Q2 boundary.** A **second** capture-side `warn!` — when `with_analytics` drops a
> non-finite or non-positive analytic — is an **owner-confirmable open question and is NOT in this
> plan**. If scoped in: one `if` in `store.rs::with_analytics` plus one unit test.

---

### Task B20: The isolation guards

- [ ] **Step 1 — the one-way boundary.** Source scan over `services/scanner/**`, `services/analytics.rs`,
      `routes/**` and `libs/quant-engine/src/**`: none may contain `services::research`.
      **Anti-vacuity:** assert the scanned file list is non-empty and includes `scanner/loop.rs`,
      `scanner/projection.rs`, `scanner/store.rs` by name, so a renamed file cannot silently shrink
      the scan.
- [ ] **Step 2 — no HTTP client on the lab path.** Scan `cmd_score_lab`'s body and every
      `research/*.rs` for `reqwest`, `MassiveRestClient`, `MarketDataPort`, `http`, `Client::new` →
      none (AC-65).
- [ ] **Step 3 — no new route.** `routes/mod.rs` and `server.rs` diffs are **empty**. Assert
      `routes/scan.rs` still calls `state.scan.read_structure_history(` in `get_structure_history` —
      the consumer-side half of B2's fork guard.
- [ ] **Step 4 — the diary is byte-identical before and after a run (AC-66).** Copy a JSON store to a
      temp path, hash it, run the lab with `--store`, hash again, assert equality.
- [ ] **Step 5 — score byte-identity (AC-67).** `git diff --stat` over `libs/quant-engine/`,
      `scanner/projection.rs`, `services/analytics.rs` must be **empty**; the only `scanner/` changes
      are the log-only `warn!` and the comment. Run `signals_characterization` → green and unchanged.
- [ ] **Step 6:** green, exit 0. Commit.

---

### Task B21: Runbook, deep-dive corrections, difference log

- [ ] **Step 1 — `docs/research/WEEKLY_SCORE_LAB_RUNBOOK.md`.** The invocation is unchanged (AC-74)
      and now returns the comparative, per-symbol report. Rewrite the **Record** step to: *"Paste the
      emitted evidence block and tables. Do not retype numbers."* Every item it asks for must be
      readable off one run's output (AC-73). The pass bar's text now lives in the emitted output; the
      runbook points at it rather than restating it. **The runbook must not state a retention span
      either** — point at the run's own `retention[]` block (§4's term-table row applies to every
      surface, not just the header).
- [ ] **Step 2 — the hand-derived difference log (AC-72).** In
      `docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`, the **"Per-symbol heterogeneity
      (hand-paired)"** table is the only hand-derived block. Prefix each figure
      `hand-derived, unvouched:` and place the run's **own** per-symbol cells beside them, naming any
      divergence and attributing it to the **pooled-once threshold scoping**. **The "Global ranking
      metrics" table was tool-produced and is NOT labelled hand-derived.**
- [ ] **Step 3 — correct two things the doc gets wrong:**
  - **(a) The framing:** all three rows of the global table are the **same candidate**
    (`opportunity_score`) against three different labels. `structure_event` is a **label** with **no
    AUC of its own**. The finding is *the composite ranks structure events almost perfectly while
    ranking large moves worse than chance — one candidate, two labels, opposite outcomes* — and since
    the score is largely built from proximity to the walls and the flip while `structure_event` means
    price reached a wall or crossed the flip, that 0.932 is substantially **definitional coupling**
    (AC-76 marks it), not predictive power.
  - **(b) The driver-attribution section.** It says the diary rows "do not carry drivers" and lists
    "ensure slow-lane append always copies `row.score_drivers`" as follow-up. **That work landed in
    `13656ad` (2026-08-10) and is working:** 12,256 of 12,477 samples carry drivers today. Add a dated
    correction note, and state that the **only** residual — the missing log — is delivered by B19.
    Without this note a future GATE I will re-brief work that is already done.
- [ ] **Step 4:** `npm run format:check` (root `*.md` is prettier-scoped; `docs/**` is not — check
      `git status` shows only intended files). Commit.

---

## Verification track

Every command states its expected output. **Check `$LASTEXITCODE` after each.**

### V1 — Rust suite

```powershell
cargo test -p api-rust -p quant-engine
```
**Expected:** exit **0**; count **≥ the B0-recorded baseline plus every test added by B0–B20**. These
names must appear: `slice_0810_is_the_deep_dives_slice`,
`slice_0810_carries_no_drivers_and_no_analytics`, `slice_0810_is_one_et_session`,
`slice_0810_reproduces_the_pre_feature_report`, `slice_current_is_fully_populated_and_multi_session`,
`the_two_slices_have_materially_different_capture_rates`,
`serve_path_keeps_its_fallback_and_the_lab_path_has_none`,
`opportunity_score_derived_from_equals_what_signals_rs_actually_reads`,
`coupled_set_over_the_declared_grid_equals_the_pinned_v1_set`,
`twelve_strings_and_a_blank_are_pairwise_distinct`, `retention_figures_are_derived_not_constant`,
`no_retention_literal_appears_in_emitted_strings_or_source`,
`a_requested_symbol_with_no_samples_still_gets_a_retention_entry`,
`retention_sessions_agree_with_the_cell_level_session_counts`.
**If `slice_current_outcomes_pair_when_present` printed its SKIP line, B0b is still open — say so
explicitly in the QA note rather than reporting a clean sweep.**

### V2 — the Postgres half compiles

```powershell
cargo check -p api-rust --features postgres
cargo build -p api-rust --release --features postgres
```
**Expected:** exit **0** for both. Skipping this means shipping the strict fork untypechecked. If the
local toolchain cannot link sqlx, record the exact error and rely on CI's identical release step.

### V3 — the real end-to-end runs over both committed slices

**V3a — the pre-spine slice:**

```powershell
npm run ports:free
cargo run -p api-rust -- score-lab `
  --samples apps/api/tests/fixtures/research/slice_2026-08-10/samples.json `
  --outcomes apps/api/tests/fixtures/research/slice_2026-08-10/outcomes.json `
  --horizon 1d --symbols SPY,QQQ,IWM,DIA --out .tmp/lab_0810.json 2>&1 | Tee-Object .tmp/lab_0810.console.txt
$LASTEXITCODE
```
**Expected:** exit **0**, and in `.tmp/lab_0810.json`:

| Check | Expected |
|---|---|
| `version` | `score_lab_v2-2026-08` (`score_lab_v1-2026-04` appears nowhere) |
| `cells.length` | **75** — 5 groups × 5 candidates × 3 labels |
| `evidence_class` | `SINGLE SESSION (d=1)` |
| `session_dates` | `["2026-08-10"]` |
| `n_paired` | 221 |
| Pooled `opportunity_score × large_abs_move` | `auc` = `0.4674447174447174…`, `lift_top_decile` = `0.1731296513905209…`, `base_rate` = `0.502262443438914`, `n_eligible` = 221 |
| Pooled `opportunity_score × structure_event` | `auc` = `0.9318740777176586`, `definitionally_coupled` = **true**, shared keys `["call_wall","put_wall","flip"]` |
| All 15 `net_gex_vol_norm_abs` + all 15 `net_gex_abs_raw` cells | literal 3, `n_eligible` 0, reason `net_gex not carried or dropped at capture (non-finite/non-positive)` with its count |
| All 15 DIA cells | literal 4, naming horizon `1d` and `0 of 0 DIA samples` |
| `retention[]` | **4 entries**, one per requested symbol, in requested order. SPY/QQQ/IWM carry `cap: 576`, `sessions_covered: 1`, a derived `samples_per_session_observed` (74 / 73 / 74) and a derived `cap_holds_sessions_estimate`, each with its window. **DIA** carries `samples_loaded: 0` and renders **literal 3**, never a zero or blank. |
| Console "Not evaluable here" block | names `STRUCTURE_HISTORY_MAX = 576` **and** this run's own rate; contains **no** phrase asserting a standing span (`about 7 sessions`, `keeps about`, …) |
| Driver attribution | literal 3 naming `0 of 221`; the string `n = 0` appears in no driver row |
| `NotApplicable` | in **no** cell; in `literal_legend` marked `reserved — not reachable in v1` |

**V3b — the current slice.** Skip only if B0b has not landed, and say so in the QA note.

```powershell
cargo run -p api-rust -- score-lab `
  --samples apps/api/tests/fixtures/research/slice_current/samples.json `
  --outcomes apps/api/tests/fixtures/research/slice_current/outcomes.json `
  --horizon 1d --symbols SPY,QQQ,IWM --out .tmp/lab_current.json 2>&1 | Tee-Object .tmp/lab_current.console.txt
$LASTEXITCODE
```
**Expected:** exit **0**; `evidence_class` is a **multi-session** token **different from V3a's**;
`net_gex_vol_norm_abs` and `net_gex_abs_raw` cells are `Computed` with **equal** `n_eligible` and
**equal** reason maps in every group and label (IDENTITY 3 on real data); `basis_mix` shows a non-zero
`atm_iv` count; at least one cell clears **both** floors and carries **no** under-powered marker.
**And the AC-78 cross-check, done by eye at the gate:** SPY's `samples_per_session_observed` and
`cap_holds_sessions_estimate` here are **different numbers** from V3a's. If they match, a derived
figure has regressed to a constant — the exact defect the amendment removed.

> **Expected divergence to check, not to fix:** V3a's calibration bins will **not** match
> `pre_feature_report.json`'s equal-width bins. Declared by the version bump; both recorded (AC-71).

### V4 — interface conformance (the strict-read guard, at the wire)

```powershell
npm run ports:free
npx nx serve api     # separate shell; wait for :8000
node .claude/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/score-lab-signal-comparison/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 `
  --report .spire/clusters/tech/contracts/score-lab-signal-comparison/conformance-receipt.json
$LASTEXITCODE
```
**Expected:** exit **0**, receipt `PASS`, `GET /api/scan/SPY/history?limit=5` → **200** with `symbol`,
`basis`, `stored_count`, `backend`, `samples` present and correctly typed. The `samples[].*` fan-out
passes vacuously on an empty local diary — **correct guard behaviour**, not a skip. **A non-200 means
the strict read was applied to the shared `read_structure_history`.** Then `npm run ports:free` again.

### V5 — isolation and empty diffs

```powershell
git diff --stat -- apps/dashboard apps/dashboard-e2e libs/api           # expect: nothing
git diff --stat -- libs/quant-engine                                     # expect: nothing
git diff --stat -- apps/api/src/services/scanner/projection.rs apps/api/src/services/analytics.rs
                                                                          # expect: nothing
git diff --stat -- apps/api/src/routes                                   # expect: nothing
git diff --stat -- apps/api/src/services/scanner/loop.rs                 # expect: the warn! only
```
Plus `cargo test -p quant-engine signals_characterization` → green; confirm the diary byte-identity
test from B20 step 4 appears in the V1 output.

### V6 — the closed-vocabulary and banned-term sweep over the real runs

```powershell
Select-String -Path .tmp/lab_0810.*, .tmp/lab_current.* -Pattern 'n/a|NaN|null|undefined \(|too few \(|not attempted|no input \(|AT BAR|BELOW BAR|net_gex_vol_norm_signed|\bbest\b|\bwinner\b|\brecommended\b|\borthogonal\b|about 7 sessions|keeps about|seven sessions'
```
**Expected:** **no matches.** (`null` must appear nowhere: every artifact field is total by
construction.) B18 proves the property over fixtures; V6 proves it over the shipped binary's real
output.

### V7 — format and lint

```powershell
cargo fmt --all -- --check
cargo clippy -p api-rust --all-targets
npm run format:check
```
**Expected:** `cargo fmt` exit 0; `npm run format:check` exit 0; `clippy` produces **zero new warnings
in the added modules** (pre-existing warnings elsewhere are out of scope — clippy is not in CI).

---

## Risk register — what a reviewer should probe

| # | Risk | Where it bites | Named response |
|---|---|---|---|
| R1 | **The fixtures are not extracted in time.** SPY 326 of 576 headroom, +168/day ⇒ **≈2 days**. | B0 | Do B0 first and push it. If the script throws "SLICE A incomplete", STOP and report — do not thin, resample or synthesise. |
| R2 | **The shared read is made strict for everyone**, 500-ing the browser. | B2 | The B2 source guard (both arms) + V4's live conformance run + B20 step 3's consumer-side assertion. |
| R3 | **A guard passes vacuously.** IDENTITY 3 and AC-10 are 0-vs-0 on `slice_2026-08-10`. | B10 | `assert_identity3_is_not_vacuous` on **`slice_current` (real data)** *and* `f_mixed()`; `assert_composition_is_not_vacuous` on `f_mixed()`. Plus the scanner-bites assertions in B18 and the control pair in B6. |
| R4 | **`derived_from` silently narrows**, unmarking the 0.932 cell. | B6, B11 | Set equality in **both** directions against `signals.rs`, plus four mutation guards. |
| R5 | **A later `sort_by(auc)`** converts a measurement into a leaderboard. | B14 step 5 | Declared order asserted **on the emitted vector**. |
| R6 | **`let _unused_by_design = vol_scalar(r)?;` deleted as dead code.** | B5 | IDENTITY 3 goes red — but only if R3's non-vacuity fixtures exist. Coupled risks; do not ship one without the other. |
| R7 | **AC-70's inversion may not hold on the fixture.** SPY +0.51 / QQQ −0.31 were hand-derived and are **not** oracles (AC-72). | B9/B10 | Assert **sign and ordering only**, never to two decimals. **If the real signs do not invert, that is a finding, not a test to weaken — report it at GATE Z.** |
| R8 | **`cargo test` does not compile `pg_scan.rs`.** | B2 | V2 is mandatory; the guard is a source scan. |
| R9 | **`slice_current`'s outcomes cannot be joined yet.** | B0 step 4 | Freeze `samples.json` **now** regardless. Open B0b. **B0b blocks nothing**; guards SKIP loudly. **Never synthesise outcomes.** |
| R10 | **Generalising a population fact from a partial scan.** An earlier draft asserted "no sample in the diary carries analytics fields" from a spot check; the truth is 12,256 of 12,477 populated. | Anywhere fixture coverage is claimed | The extraction script emits a **census** (B0 step 3) and `slice_current_is_fully_populated_and_multi_session` asserts it. **Claim coverage from a measured count, never a spot check.** |
| R11 | **A lane or a future GATE I "fixes" the capture spine**, which is already correct. | B19, B21 step 3 | Both say so with the 12,256/12,477 count. The residual is the log, nothing else. |
| R12 | **A retention figure regresses to a constant.** This already happened once: "about 7 sessions" read correctly the day it was written and was wrong by a factor of two within weeks. **It is invisible on any single run.** | B12a, B13, B18 | The **two-fixture** assertion (`retention_figures_are_derived_not_constant`), the source scan for retention literals and a bare `576`, B18's emitted-string scan with its bites-check, and V3b's by-eye cross-check against V3a. **R12 is why B0's two-slice shape is load-bearing beyond fixtures.** |
| R13 | **A second definition of "session" creeps in** for the run-scope figures, so the header and the cells disagree while both look right. | B12a | `session_dates_of` is the single definition (B4); B4 step 4 asserts nothing else in `research/` calls `session_date_et`; B12a's `retention_sessions_agree_with_the_cell_level_session_counts` checks it from the consumer side. |
| R14 | **A prettier or `nx format` run reformats 92 unrelated files.** | B0 step 7, B21 | Always scope; always `git status` after. |
| R15 | **Someone "repairs" `slice_2026-08-10`'s null `score_drivers`.** | B0 step 5 | `slice_0810_carries_no_drivers_and_no_analytics` goes red; its message says why. |

---

## SPEC §9 open questions — owner-confirmable, **not blocking**

None gates the build. **Do not invent answers.**

1. **The three bar numbers** (in-run lift ≥ 1.10 at ≥ 10 distinct sessions; sustained across ≥ 3
   calendar weeks).
   *Where it bites:* B13 step 1 only — the bar's **text** is a `const BAR_TEXT: &str` printed beside
   the run's values. The tool never evaluates it, so **nothing in §3 depends on the values**. A change
   is a one-line const edit plus the AC-45 copy review.
   *Previously listed here and now CLOSED:* the header's `about 7 sessions per symbol` figure. It was
   ruled a defect at GATE Z and removed; the header now derives its span from `retention[]` (B12a) and
   prints only the cap as a constant. No longer an open question.

2. **Whether the capture-side non-finite `warn!` is in scope.**
   *Where it bites:* B19 only. **Not planned in.** If scoped in: one `if` in
   `store.rs::with_analytics` plus one unit test. It is the only thing that could ever retire AC-28's
   wording constraint — and even then only for rows captured **after** the change.

3. **Whether checked-in fixtures of this size are acceptable.** Now **two** fixtures (~221 + ~518
   rows).
   *Where it bites:* B0 only. The plan **measures** the size and records it in each `PROVENANCE.md` —
   evidence, not an answer. **The trap:** thinning a fixture to shrink it would change every metric it
   exists to pin. Honest fallbacks, in order: (a) compression; (b) a reduced symbol set — and **(b)
   weakens AC-70's inversion claim, which needs SPY *and* QQQ**. Take (a). Note that `slice_current`
   also carries AC-78's second arm and real-data IDENTITY 3 (R3, R12), so dropping it is not a free
   save.

---

## Not buildable / rejected — do not re-propose (SPEC §2.10)

**A hardcoded retention figure in emitted copy or in spec prose** (an earlier draft printed "the diary
keeps about 7 sessions per symbol" in the evidence header, inherited from an R1 estimate of ~74
samples/symbol/session; measurement on 2026-08-12 found 168/symbol/day, filling the 576 cap in ≈3.4
days — the lesson is not "use 168", it is that the run must derive the span from its own rows) ·
field-name intersection as the coupling test · deconfounding the composite (partial correlation,
residualization, "score minus proximity") · storing `net_gex_vol_norm` + basis on `StructureSample` ·
running `evaluate_baseline` alongside the new block · closed-form (Hanley–McNeil) AUC confidence
intervals (they assume independent observations; the observed capture cadence on one underlying is
massively autocorrelated, so the interval would be badly too narrow) · trait objects or a `Signal`
trait per candidate · a derived `BELOW BAR` / `AT BAR` standing verdict · a `BaseRateZero`
metric-level state and any lift/base-rate-zero example of literal 10 · withholding below-floor values ·
`InsufficientN` as a metric-free state · per-group or per-candidate label thresholds · per-candidate
calibration binning rules · changing the capture-side non-finite filter · raising
`STRUCTURE_HISTORY_MAX`.
