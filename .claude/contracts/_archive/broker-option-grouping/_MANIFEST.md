# broker-option-grouping — pipeline manifest
Stage:        GATE Q RE-RUN **PASS** — 49 PASS / 0 FAIL / 1 UNVERIFIABLE. Ready for GATE S.
QA re-run:    AC-11 FAIL → PASS, re-verified BY OBSERVATION in real Chromium on the full 14-position
              captured book with NO injected marks and `/api/contract/` 404ing — all three groups
              render a net FIGURE (so it is the exact fall-through branch that used to hardcode
              `UNAVAILABLE`) with header and every expanded member agreeing on `not provided`;
              `unavailable` appears 5× on the tab, all inside equity rows, zero on any group surface.
              Fix confirmed to DERIVE from the one shared cascade, not relocate the hardcode.
              `legs_unpriceable` confirmed P/L-axis-only three ways (a leak would have turned
              BOOK_CF_CREDIT/ZERO_NET into `not provided`; they still render $1,600.00 credit / $0.00).
              F2 leg-level no-op still holds. AC-13 transient arm correct both directions.
              393px A/B'd in the live page: shipped 0.0px overlap vs counterfactual `nowrap`
              reproducing the earlier 33.0 × 13.8 px to the decimal; pairwise leaf-node scan empty.
              Layer 1 re-probed live — `grouping.ts` now bites BOTH alias and relative forms.
              Gates (PIPESTATUS, unmasked): FE 122/1439 · typecheck 0 (forced clean) · lint 0 ·
              e2e 41 · api 272 · `git diff d53199e -- apps/api` 0 lines/0 files. All exit 0.
              5 non-blocking findings R-1..R-5 — see QA_REPORT. **R-5 is a live tooling defect:
              `npm run ports:free` is IPv4-ONLY and reported "all clear" while three IPv6-only
              orphans were serving (`[::1]:4200/4300/4301`, one answering 200 on :4300). The
              CLAUDE.md stale-server trap is still reachable THROUGH the tool written to prevent it.**
PRIOR stage:  GATE Z — QA FAIL on AC-11, bounced to frontend, fixed, re-verified (history below)
QA (GATE Q):  QA_REPORT FAIL (bounced: frontend) — 48 PASS / 1 FAIL / 1 UNVERIFIABLE of 50.
              Conformance: backend PASS · QA PASS (independently re-run, `--auth-signup` only) —
              they AGREE, no bounce on that axis. AC-1b UNVERIFIABLE (owner-only, live Webull book).
              THE FAIL — AC-11, two defects on one row:
                1. `BrokerGroupHeader.tsx:213` hardcodes `UNAVAILABLE` in the `pl_dollar == null`
                   branch. `unpriceable` is true for EVERY broker option leg (no strike/expiry/
                   right on the feed) so `pl_dollar` is ALWAYS null on the real book, and the leg
                   renderer calls that permanent (`BrokerPositionRow.tsx:135` → `not provided`).
                   ⇒ on the owner's live book every group header reads `unavailable` above members
                   reading `not provided` — the exact `[absent-is-not-none]` collapse §2.6's
                   permanence-first cascade exists to prevent. Observed in Chromium, not inferred.
                2. AC-11 has NO test despite being marked `test` + blocking. The suite hid the bug:
                   `BrokerGroupHeader.spec.tsx` injects synthetic marks so `pl_dollar` resolves, and
                   AC-16a accepts EITHER literal so it could not fail.
              Two QA corrections to lane claims: Layer 1 does NOT bite the relative form
              `'../positions/structure'` (literal specifiers; Layer 2's set-A regex still catches
              it, so the stack closes) · the 393px overlap is FEATURE-AUTHORED, not pre-existing —
              `LoneLegClause` overlaps `Convexa-modeled` by 33.0 × 13.8 px on lone option cards;
              nothing clips, QA ruled it NON-BLOCKING but it must be logged, not closed as untouched.
              Held under attack: `[CF]` anti-coincidence real (every row traced to its constructed
              book) · no-naming bites (Layer 1 probed live via `eslint --stdin`, exit 1) · F2 is a
              genuine leg-level no-op, re-derived case-for-case from the diff · both owner rulings
              hold in shipped code · ground truth rendered, 3,802/7,889 only in negative assertions.
Build:        single-lane frontend, phased F1–F5 · F6–F9 · F10–F11+V1–V5. 9 commits on `main`
              (`674459d`..`d85b5a0`), UNPUSHED. Lane-claimed gates, all exit 0: dashboard
              122 files / 1434 tests (baseline 116/1291) · e2e 41 (baseline 37) · api 272
              unchanged · lint 0/0 · typecheck 0 · `git diff --stat d53199e -- apps/api` EMPTY.
              F6 took the plan's DOCUMENTED deny-list fallback (the negation-glob allow-list
              flagged its own allow-listed specifiers on this ESLint version) — recorded in the
              commit message, both overrides proved to bite. Browser-verified in both phases.
              Open for QA triage: at 393px a lone/ungrouped `partial` card's two-line-wrapped
              `not provided` overlaps the `Convexa-modeled` label beneath it — text collides,
              nothing clips; pre-existing `BrokerPositionCard` layout from broker-connect.
              AC-1b is owner-only against the live Webull book ⇒ expected UNVERIFIABLE.
Repos:        frontend
Brief:        BRIEF.md present (CORRECTED 2026-08-06 at R2 — book composition was factually wrong)
Contracts:
  - SPEC.md                    LOCKED — owner-approved 2026-08-06 (1371 lines)
  - INTERFACE_CONTRACT.md      LOCKED — NO_BACKEND_CHANGE + a live `## Conformance spec` block
                               re-pinning the `GET /api/broker/book` read arm (139 lines)
  - PLAN.md                    in progress (fresh delivery-planner; revisions CONTINUE that agent,
                               never a cold re-spawn — ROLE_LAUNCH_PROMPTS §5 loop rule)
Open amendments: none
QA (GATE Q):  n/a
Gate-check:   contract_lint 0 errors / 3 warnings (all pre-existing PROJECT_CONTEXT shard sizes)
Council:
  - R1 positions               architect · pm · ux (blind, 1176 lines)
  - R2 cross-critique          25 conflicts · 25/25 quotes verified · 14 asks
  - R3 reconcile               7 self-revisions folded · 15 technical resolved (0 UNRESOLVED across
                               6 pair-exchange files) · 1 targeted pass on the crossed provenance
                               point · 2 owner rulings (Q1=A, Q2=A) · decisions.md
  - R4 synthesis               3 passes: initial · Criticals 1+2 · owner-authorized bare-word fix
  - S2 adversarial             2 passes. Pass 1: 2 Critical, 1 Important, 2 Minor — ALL CLOSED and
                               independently re-verified at pass 2. Pass 2: 1 new Critical
                               (predicate set B matched only compound labels) — closed by R4 pass 3.
                               ⚠ R4 pass 3 is NOT skeptic-reviewed (loop cap reached; owner informed).
Conductor errors found + fixed at this gate (recorded, not quietly patched):
  - BRIEF book composition wrong (13 positions / "4 verticals + 1 lone") → 14 holdings, 3 groups
    + 2 lone legs. Caught by architect at R2. Correction STRENGTHENS the no-naming rule: TSLA's
    +10/−4/+4 means a qty-pairing heuristic mis-pairs the owner's ACTUAL book today.
  - decisions.md §0 C0-2 group nets were Webull raw `total_cost` sums, not what Convexa renders.
    Caught by council-skeptic at S2 pass 1. Correct: META 3,805.00 · NVDA 7,890.00 (the latter
    already pinned by a shipped passing test, genericOptionRow.spec.tsx:77,264).
Still to correct at GATE S: the same 13-positions / "4 apparent verticals" error in
    OPEN_THREADS.md §7z and RESUME.md.
Last gateway:  GATE C @ 2026-08-06
