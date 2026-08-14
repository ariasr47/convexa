# GATE Z — amendments bounced after GATE Q pass 1

GATE Q verdict: **FAIL** — 65 PASS · 3 FAIL · 0 UNVERIFIABLE. Full report: `QA_REPORT.md`;
independent receipt: `conformance-receipt-qa.json` (**PASS 2/2 on :8010**, agreeing with the backend's).
No Critical security or integrity finding; **all binding invariants hold**, including
`additive-keeps-score-byte-identical` on both arms.

QA verified rather than inherited: it poison-proved all nine guards itself (16 mutations, every one
RED, all restored byte-identically), **ran layer 2 (AC-66) rather than deferring it**, observed the
app in a real browser in both schemes at 1280 and 393px, and proved the 5 red spec files are red at
HEAD too — in a detached worktree, correctly refusing `git stash`.

---

## FRONTEND — 2 items

### Z-F1 · AC-33 FAIL — the "prose numbers are not checked" statement does not exist
**Observed:** the reasoning section carries only `Why` / `Analyst read` / `Show full analysis` and the
prose. QA captured full rendered panel text on three card states and grep-swept
`apps/dashboard/src/app` — the copy exists nowhere.
**Why it matters more than its size:** numbers inside free prose are **out of verification by design**
(D-scope), and the disclosure is the only thing that stops a reader generalizing the per-field clauses
to the prose. Without it, the card implies coverage it does not have — the exact halo failure §9.5
already books as a residual. Missing the disclosure makes the residual worse, not neutral.
**Fix:** add the statement **placed with the reasoning** (not in the tooltip alone), from the closed
literal set, in the caption idiom. Must not use a banned word, must not read as an accusation, and
must be disjoint from every existing literal.

### Z-F2 · F-1 (no AC, CI-BLOCKING) — `format:check` fails on 9 files, all this feature's
**Observed:** `npm run format:check` — CI's **first** frontend step — exits **1** on 9 files, every one
touched by this feature. The same command exits **0** on a clean HEAD worktree, so this is ours.
**Impact:** CI breaks **before** lint, typecheck, test and e2e run. The lane's `format:check` was scoped
to touched paths and passed; the repo-wide invocation is what CI actually runs.
**Fix:** `npx nx format:write --files <the 9 paths>` — **scoped, never bare.** A bare
`nx format:write` is repo-wide and once reformatted 92 unrelated files (`CLAUDE.md` traps).
Re-run the repo-wide `npm run format:check` afterwards and confirm exit 0.

---

## BACKEND — 3 items

### Z-B1 · AC-41 FAIL — the D7 measurement was never run, and no not-run record exists
**Observed:** no committed measurement artifact and no `not-run` record. **The not-run carve-out does
not apply — a provider key resolved in this environment** (QA's own layer-2 run used it:
`POST /api/recommendation/SPY`, `key_source: shared_admin`).
**This is the owner's D7 ruling, and it is the half of the feature that keeps it honest.** Run it as
ruled:
1. **Pre-commit the ladder BEFORE the split is seen** — write it down first. That ordering is the
   whole point; deciding the response after seeing the number is not a measurement.
2. Measure the `traced` / `no match` / `couldn't check` split over **≥5 real recommendations across
   ≥3 tickers**, all inputs available.
3. Record the result in a **committed artifact** and in `OPEN_THREADS`, whatever it says.
4. Ladder: high `no match` ⇒ **one** prompt revision ("quote the level exactly as the context gives
   it") and **one** re-run ⇒ still high ⇒ **ship with the honest rate recorded**.
5. **Never a tolerance widening. Never a scope cut. Never a synthesized run.** If it genuinely cannot
   run, record the unavailability **as a finding** with the reason — the `tradeable-rec-inputs` V10
   precedent, which is canon.

### Z-B2 · AC-47 FAIL — no artifact and no `OPEN_THREADS` entry
`OPEN_THREADS.md` has no `ai-rec-grounding` entry at all. Not ship-blocking by the SPEC's own marking,
but it is the record the next feature reads. Land it with Z-B1's artifact.

### Z-B3 · F-2 (no AC) — the guard-8c pin breaks on any Windows clone
**Observed:** the pin matches a literal `\n`. With `core.autocrlf = true` and no `.gitattributes`, a
fresh checkout yields CRLF (measured: 922 CRLF, 0 bare LF), and under CRLF **that test fails** while
the other three pass.
**⚠ The tempting fix is the wrong one.** Weakening or removing the assertion would gut the **only**
coverage of the 8c poison arm — the arm the backend lane added precisely because it discovered nothing
else could catch it. That would satisfy the guard's NAME while destroying its BEHAVIOUR, which is the
`score-lab-signal-comparison` failure this project has already been bitten by.
**Fix the line-ending sensitivity, not the assertion** — normalize before matching, or pin the path via
`.gitattributes`. Then **re-poison-prove 8c under both LF and CRLF** and show it RED in each.

---

## BOTH LANES — the coverage gap QA under-rated

QA recorded as a **Minor** that **seven `test`-marked ACs have no test naming them**, having verified
them by observation for its report. The standing rule is stricter and it is the rule of record
(`ROLE_LAUNCH_PROMPTS` §4): *"A `test`-marked AC with no corresponding test is a FAIL even if the green
suite passes."*

That rule exists because observation is a QA-session-scoped proof — it dies with the session, while a
`test` marking is a promise the behaviour is guarded **from here on**. An AC marked `test` and covered
only by someone having looked is a silent-regression hole.

**Resolve each of the seven one way or the other, explicitly — never by leaving it:**
- add a named test, **or**
- if the criterion is genuinely a review-class check, that is a **SPEC `Verify by` correction** — bounce
  it to me rather than editing the SPEC yourselves.

Do not close this by re-marking criteria to suit the tests that happen to exist.

---

## Route

Both lanes fix in parallel; **GATE Q then RE-RUNS** on the fix — never trusted unobserved.
Nothing here reopens the SPEC, the interface, the conformance block, the closed vocabularies, D1–D8,
or the nine guards. SPEC §9 items 5/6/7 remain **declared gaps, not defects** — and §9.6 is now
materially better, since QA ran layer 2 for real.
