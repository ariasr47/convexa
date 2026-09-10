# curvature-v2-landing-and-site — pipeline manifest
Stage:        **GATE PLAN complete 2026-09-10** (planner, one pass; PLAN.md 16 frontend tasks F1–F16, backend empty by contract, V-1…V-15) → **frontend build in flight** (the Mac, unattended; F1 serial → `Independent: yes` pairs, k=2 → F14/F15/F16 wait for PR #49 `fix/fidelity-repair-2` to merge). Conductor rulings at GATE PLAN: **C1** = the plan's pin edit (remove the `VALUE_CARD_RAW` glob with `ValueCard`; keep the two negative-space scans byte-for-byte) — §8 cost 2 wins over §7's literal "unchanged"; **C2** stays a conditional GATE Z for the closer (never raise the bundle pin).
Repos:        frontend
Brief:        BRIEF.md present (five defects recorded in council/decisions.md §0 — the decisions win where they differ)
Contracts:
  - SPEC.md                    draft, R4 pass 3 (final) — 9 sections, 71 acceptance rows (ship-blocking list 19, AC-C1a added), folding receipt 31/31, new §7 item 17 (cut-phrase scan, mutation-proved); contract_lint 0 errors (12 advisory budget warnings; the SPEC is 114 KB against a 40 KB budget — the fold trimmed deliberation and still grew 5 KB)
  - INTERFACE_CONTRACT.md      NO_BACKEND_CHANGE — conformance block for the who-am-I read the auth wall already consumes
  - PLAN.md                    GATE PLAN 2026-09-10 — 16 FE tasks (F1 prerequisite · F2–F13 independent · F14/F15 blocked on fidelity-repair-2 merge · F16 closer), 0 BE, V-1…V-15; decisions D1–D6; C1/C2 recorded above
Open amendments: none — S2 pass 2's 1 Critical closed by owner ruling D-B (A); its 2 Important + 1 Minor folded at R4 pass 3 (SPEC §1/§2.6, §4 + §7 item 17, §3 ship-blocking). No third S2 (cap). Canon Amendments row + ledger `hero-3d-is-a-static-isometric-projection` live on `docs/owner-blockers-2026-09-10` → main
QA (GATE Q):  n/a
Workers:      frontend — F1 ✓ `a3c7c4d9` · F3 ✓ `9c57e082` · F5 ✓ `6e63ce6a` · F2 ✓ `c9d5a704` · F6 ✓ `3e34b9bb` · F4 ✓ `ca43cb57` · F8 ✓ `a54728e9` · F7 ✓ `6a21dcec`+`c7c6bcd2` · F7b ✓ `7c6914b6` (flow test → `cta-primary`) · F9 (running) · F11 (spawned) · queue: F10 (after F9) → (F12, F13) → F14/F15/F16 after PR #49 merges. backend — n/a (no rows)
Last gateway:  GATE PLAN @ 2026-09-10 (planner on Opus 5, one pass, no revision) → build lanes
