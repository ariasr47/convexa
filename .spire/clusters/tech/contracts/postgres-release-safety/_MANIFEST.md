# postgres-release-safety — pipeline manifest
Stage:        GATE Z — container command-path repair complete; redeployment pending
Repos:        backend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked — approved 2026-08-22; 29 AC; NO_UI_CHANGE
  - INTERFACE_CONTRACT.md      locked — release CLI protocol + unchanged health conformance
  - PLAN.md                    locked — 6 backend tasks + 1 closer; 10 verification stages
Open amendments: redeploy the repaired image and repeat the direct live Railway review for AC28
QA (GATE Q):  QA_REPORT FAIL (28 PASS / 0 FAIL / 1 UNVERIFIABLE; AC28 only)
Workers:      one sequential backend lane; no frontend lane
Council:      R1 3 voices · R2 4 conflicts · R3 0 unresolved · R4 repair loop 1
S2:           pass 1 found 1 Critical / 2 Important / 1 Minor; all closed
              GATE Z evidence repairs ended with 0 Critical / 0 Important / 1 Minor
GATE Z:       planner STOP exposed unprovable chronology; contract now splits immutable
              repository/process validation from accountable live Railway review
Gate-check:   contract_lint 0 errors / 2 pre-existing context-size warnings
Last gateway:  GATE Z @ 2026-08-22
