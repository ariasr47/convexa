# index-first-defaults — pipeline manifest
Stage:        GATE S — SHIPPED + ARCHIVED 2026-08-01 (QA_REPORT PASS 6/6; canon folded: OPEN_THREADS §7y + PROJECT_CONTEXT §6 + BACKLOG queue)
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked (conductor note: §4 "route default constant. No UI." was
                               under-specified against AC-2 — the shipped `DefaultTickerRedirect`
                               (pref-wins via existing useSettings precedence) is REQUIRED by AC-2's
                               observable and is ACCEPTED as spec-compliant, not a GATE Z deviation)
  - INTERFACE_CONTRACT.md      NO_BACKEND_CHANGE (lane proof: `git diff --stat apps/api` empty)
Open amendments: none
QA (GATE Q):  pending — fresh de-correlated session dispatched 2026-08-01; conformance n/a (NO_BACKEND_CHANGE)
Last gateway:  GATE V @ 2026-08-01
