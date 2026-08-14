# ai-rec-grounding — pipeline manifest
Stage:        GATE Z — both lanes fixing after GATE Q pass 1 FAIL
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    locked
  - INTERFACE_CONTRACT.md      locked   <- FE-to-BE binding
Open amendments: GATE_Z_BOUNCE.md (Backend: Z-B1/B2/B3 · Frontend: Z-F1/F2 + shared coverage item)
QA (GATE Q):  QA_REPORT FAIL (bounced: Backend + Frontend) — 65 PASS / 3 FAIL / 0 UNVERIFIABLE
Last gateway:  GATE Q @ 2026-08-13 (pass 1 FAIL → GATE Z; re-run pending)

Council: R1 ×3 blind → R2 ×3 sighted (28 conflicts, 28/28 quotes machine-verified, 5 self-revisions)
→ R3 one exchange (19 technical all converged/conceded, none promoted; 8 of 9 product conflicts closed
by convergence) → owner ruling on D7 (noise bar = recorded laddered measurement, not a ship gate)
→ R4 ×2 → S2 ×2 (pass 1 FAIL: 1 Critical + 8 Important + 3 Minor; pass 2 **PASS**).
contract_lint: 0 errors. Ledger: 7 rows (all gate C), including the FIRST instance of
`ai-asserted-numbers-are-traceable`. Two residuals booked open in SPEC §9 (items 5 + 6), not closed
falsely: the halo-effect residual (mitigated by copy + total absence of markers on the four cut
fields, reviewed, never measured against a real reader — closes when `rec-absence-literals-hole`
ships) and the no-key live-HTTP verification gap (layer 2 records not-run with its reason).
