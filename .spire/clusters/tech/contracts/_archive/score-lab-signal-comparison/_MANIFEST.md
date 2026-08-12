# score-lab-signal-comparison — pipeline manifest
Stage:        **GATE Q PASS** — awaiting owner decision at GATE S (ship/archive)
Repos:        backend  (NO_UI_CHANGE — frontend track empty by design)
Brief:        BRIEF.md present (Goal corrected 2026-08-12 — see below)
Contracts:
  - SPEC.md                    locked (owner-approved 2026-08-12; + GATE Z retention amendment)
  - INTERFACE_CONTRACT.md      locked (real conformance block; S2-verified parseable + no false-fail risk)
  - PLAN.md                    locked (B0–B21 + B12a, V1–V7)
Open amendments: none — both GATE Z bounces resolved and independently re-verified.
QA (GATE Q):  pass 1 — FAIL, 56 PASS / 21 FAIL / 1 UNVERIFIABLE
              pass 2 — FAIL, 75 PASS / 2 FAIL / 1 UNVERIFIABLE (AC-14, AC-37)
              pass 3 — **PASS, 77 PASS / 0 FAIL / 1 UNVERIFIABLE** (AC-62, environment-bound)
                       Full 78-AC sweep, not narrowed to the repaired two. QA made all three new
                       guards go RED by poisoning product source, then restored byte-identically
                       (`git diff -- apps/api` empty, suite back to 249 / exit 0). Parity oracle
                       reproduces bit-for-bit on all 15 pinned constants by `repr()` equality.
                       C1 stays closed in the emitted artifact (48/48 slots tagged). AC-37 re-counted
                       independently: **0 of 525** rendered cells across 9 artifacts fail to close.
                       Conformance PASS on QA's own server (:19311) — never :8000.
              Independent conformance **PASS** at both passes, agreeing with the builder's — no drift.
              **19 of 21 bounced criteria genuinely fixed; no regressions among pass 1's 56 PASSes.**
              Invariants moved: `[absent-is-not-none]` BREACHED→HOLDS ·
              `[structural-over-prose-enforcement]` + `[model-read-carries-its-assumptions]` PARTIAL→HOLDS.

### Carry to GATE S — log these, they are NOT ship blockers
1. **`--symbols " SPY , SPY "` is not de-duplicated** — 15 duplicate `(group,candidate,label)` keys and
   the SPY block printed twice. **Every number stays correct** (pooled 74, not double-counted). QA found
   it at pass 3; it **predates this feature's fix passes**. One `dedup()`. → BACKLOG.
2. **`data/scan.json` is rewritten several times a minute by the :8000 orphan** (PID 58588,
   `taskkill /F` access-denied). It changed with nothing of QA's running, so AC-66 was proven on an
   isolated copy. **Any future pass doing a naive before/after byte check on that file will get a false
   failure.** → BACKLOG / note beside the existing `ports:free` IPv4-only entry.
3. **`contract_lint`'s `R2_JSON_RE` is anchored to the whole file (no `m` flag)** while
   `.claude/council/R2-critique.md` only forbids content *after* the block — so an `# R2 — …` title
   fails the gate, and stripping titles then invalidates the SPEC receipt's byte-hashed `conflict_id`s.
   Cost two fix rounds at GATE C. **Kit-owned — log to `KIT_BACKLOG`; do NOT edit `contract_lint.mjs`
   in place** (`kit_lint` aborts an extract on re-coupling).
4. **PLAN.md's V5 claim is overstated** — the isolation diff carries the `warn!` in `loop.rs` **plus five
   cargo-fmt reflow hunks**. Documentation accuracy, not a code defect.
5. **B0b remains OPEN** — `slice_current/outcomes.json` was never produced (no `MASSIVE_API_KEY`), so
   V3b never ran and no slice in the tree can yet produce a cell above both floors. Guards SKIP loudly.
   **Nothing was synthesised.** → BACKLOG, blocks nothing.

### Escalation trigger — fired, DECLINED with reason (2026-08-12)
ORCHESTRATOR §1 sanctions model escalation when a lane bounces GATE Z **twice on the same feature**.
That condition is now met. **Not escalating.** The two survivors are not a capability failure: AC-14
needs one sentence emitted, AC-37 needs a closing parenthesis restored on 6 of 75 cells, and QA has
located both to the line. Pass 3 fixed 19 of 21 including the Critical, and the two hardest-risk
checks (bit-exact parity across a `stats.rs` change; the poison-proved guard) came through clean —
that is not a lane that is out of its depth. Escalating here would buy nothing and set the precedent
that any two-bounce feature escalates regardless of what the bounces contain. Recorded so the
judgement is auditable rather than silent.
Last gateway:  GATE PLAN @ 2026-08-12 (backend lane closed in 2 passes, 28 commits)

## Build progress (backend lane, the only lane)
Pass 1 (2026-08-12) — **B0, B1, B2, B3 done, each its own commit.** Remaining: **B4 … B21** (PLAN.md
line 914 onward) + the **V1 … V7** verification track.
  - `3407dc1` B0 — `tools/research/extract_score_lab_slices.mjs`; froze
    `slice_2026-08-10/` (221 rows, pre-spine) + `slice_current/` (592 rows, post-spine, populated);
    `research::fixtures` + pinned pre-feature oracle + 7 contract tests, bit-exact vs `evaluate_baseline`.
  - `02d6413` B1 — six stat helpers relocated verbatim into `research::stats`.
  - `b3814a3` B2 — `read_structure_history_strict` forked in `pg_scan.rs` beside the untouched
    fallback; source-scan structural guard; `routes/scan.rs:234` still on the original method.
  - `384dc6b` B3 — closed 11-variant `DerivationKey` + `shared_keys()`.
Test baseline recorded at B0 step 0: **130 passed / exit 0** → **142 passed / exit 0** at pass-1 end,
non-decreasing at every step. `cargo check -p api-rust --features postgres` exit 0.
`git diff --stat` shows zero touch to `apps/dashboard`, `apps/dashboard-e2e`, `libs/api` (NO_UI_CHANGE held).

### Findings + caveats carried into pass 2 / GATE Q
1. **The plan's own extraction snippet sorted `outcomesA`**, which broke bit-exact parity at the 14th
   significant digit (floating-point summation-order sensitivity). Fixed by preserving the source
   file's original outcome order. Consistent with PLAN.md's own warning that a sort here breaks B0
   parity — the snippet contradicted the surrounding prose. Nothing to re-decide; recorded so a later
   reader does not "restore" the sort.
2. **B0b is OPEN and blocks nothing** (PLAN R9): `slice_current/outcomes.json` was not produced — no
   `MASSIVE_API_KEY` in the build environment. Constructed fixtures carry the guards meanwhile and
   SKIP loudly rather than passing vacuously. **Never synthesise outcomes.**
3. **⚠ The pass-1 conformance receipt is SUSPECT and must not be trusted at GATE Q.**
   `conformance-receipt.json` reads verdict **PASS**, mode `live`, against `GET /api/scan/{symbol}/history`
   — but it ran against an **orphaned `api-rust` process on :8000 that could not be terminated**
   (`npm run ports:free` and `taskkill` both denied). Per the repo's standing trap, an orphan serves
   **stale code**, so this receipt attests to an unknown build. The lane's argument that B2 made no
   route-level change is structurally sound but is reasoning, not observation.
   **GATE Q must kill :8000 for real, boot a freshly built server, and re-run conformance itself.**

Pass 2 (2026-08-12) — **B4 … B21 + the V1 … V7 verification track, all done, 24 commits.** Backend
lane is closed; nothing in the assigned range remains open.
Tests **142 → 229 passed / 0 failed / exit 0**. `cargo check -p api-rust --features postgres` exit 0;
`cargo build -p api-rust --release --features postgres` exit 0 (2m27s, V2 full). Scoped
`rustfmt --check` + `cargo clippy` clean over every file touched; `npm run format:check` exit 0.
New: `services/research/{pairing,candidates,derivation,labels,vocabulary,comparison,artifact,render,run,fixtures,scan_guards}.rs`,
`tests/research_isolation.rs`, `docs/research/WEEKLY_SCORE_LAB_RUNBOOK.md` + the dated correction to
`docs/research/SCORE_LAB_DEEP_DIVE_2026-08-11.md`.
**Pass-2 conformance receipt supersedes pass 1's:** verdict **PASS**, mode `live`, run against a server
**built from this pass's own code** on `127.0.0.1:18234` and killed afterward. The orphaned `:8000`
process is still alive and still `taskkill`-denied, and was never pointed at. Caveat (3) above is
therefore answered for the builder receipt — but GATE Q still re-runs conformance independently.
**V3a reproduces the pinned pre-feature oracle exactly**: AUC `0.46744471744471744` /
`0.9318740777176586`, lift `0.17312965139052094`, 75 cells, DIA literal 4, retention SPY
`74 of 576 held`.
**V3b SKIPPED — B0b still open** (`slice_current/outcomes.json` absent, no `MASSIVE_API_KEY`). Stated
explicitly by the lane rather than passed over. **A SKIP is not a PASS** — GATE Q must record it as a
skip and must not treat AC coverage resting on slice B's outcomes as verified.

### Defects the lane caught in its own verification and fixed (not guessed)
1. **V6's banned-term sweep found 54 raw JSON `null`s** in the artifact (`window_utc_first/last`,
   thresholds, retention windows) — a breach of the SPEC's "every artifact field is total by
   construction". Fixed with `skip_serializing_if`, matching the convention `StructureSample`'s
   optional analytics fields already use.
2. **B18's own scan caught two wording defects pre-ship:** correlation lines rendered a bare `{v:.2}`
   with no `n=` qualifier (indistinguishable from the bare-zero defect when a correlation rounds to
   0.00), and a literal `"n/a-on-this-slice"` placeholder string.

### Two lane judgements GATE Q should look at rather than take on trust
- The lane **renamed a test** to `no_retention_literal_appears_in_emitted_strings_or_source` to match
  the name V1 requires. Confirm the rename covers the behaviour V1 wanted, not just the name.
- **PLAN B8's prose is internally inconsistent** ("12 strings and a blank" vs an enumeration summing
  to 12). The lane followed the literal enumeration and documented it inline. Judged not a GATE-Z
  matter; confirm that reading against SPEC §4.

## GATE Z — retention amendment (RESOLVED 2026-08-12)
`SPEC.md` no longer hardcodes "the diary keeps about 7 sessions per symbol" in emitted report copy.
Ruling applied: print the **cap** (`STRUCTURE_HISTORY_MAX`) as the one constant and **derive** samples
held / sessions covered / observed rate / implied span from the run's own rows, per
`[model-read-carries-its-assumptions]`. Landed as §2.8 `retention[]`, §2.10 rejection, §4 header,
§5 zero-denominator row, and **AC-78** (`test`, two arms across the two frozen slices).
It did need a field the report did not compute — `samples_loaded`/`sessions_covered` existed only at
cell scope while the header emits before any cell — so `PLAN.md` gained **B12a** to hoist them to run
scope. Acceptance set is now AC-1 … AC-78.

## Council record
Rounds:        R1 blind ×3 · R2 sighted ×3 · R3 reconcile (2 exchanges, cap reached) · R4 ×4 · S2 ×2
Conflicts:     18 raised · 18/18 quotes machine-verified · 13 technical / 5 product
               4 self-revisions (folded) · 5 closed moot-by-retraction · 0 outstanding
Owner rulings: C-1 v1 candidate set = FIVE (2026-08-12)
               C-2 below-floor cells show value WITH marker; nothing suppressed (2026-08-12)
S2 pass 1:     2 Critical + 2 Important → all fixed at R4
S2 pass 2:     both Criticals CONFIRMED FIXED · no new Critical · spec buildable
               2 further Important → fixed (inverted contrast framing; DerivationKey completeness)
Gate-check:    contract_lint 0 errors (M7 real conformance block; M9 NO_UI_CHANGE)
Acceptance:    AC-1 … AC-77, one folded set with a coverage map
Open questions: 3 in SPEC §9, all owner-confirmable (bar numbers; capture-side warn! scope; fixture size)

## Correction of record (2026-08-12)
The BRIEF's `Goal` originally framed AUC 0.932 as `structure_event` "ranking almost perfectly".
**Wrong** — `structure_event` is a LABEL with no AUC of its own. All three deep-dive figures are
`opportunity_score` ranked against three labels (0.467 / 0.569 / 0.932). The error originated in the
BRIEF (conductor-authored at GATE I), propagated into SPEC §1, and was caught by the S2 verification
pass. Corrected in the BRIEF, SPEC §1/§2.10/§4/§8, AC-69 and AC-72. The corrected reading strengthens
the feature: the 0.932 is substantially the definitional coupling AC-76 now marks.

## Time-critical follow-on (in scope for the build)
Freeze the 2026-08-11 slice as a committed fixture. `STRUCTURE_HISTORY_MAX = 576` at ~74 samples/
symbol/session evicts it in roughly seven sessions from 2026-08-11.
