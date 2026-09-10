# curvature-v2-landing-and-site — pipeline manifest
Stage:        GATE C complete; **SPEC APPROVED 2026-09-10** (owner-delegated). **Rebased onto `main` 4ca9edc7 on 2026-09-10** (phases 1–3 merged as `3f9d941e`; the blockers record #47 and the fidelity review #48 on main). **Next: GATE PLAN** (`spire-tech-planner`, frontend track only — `NO_BACKEND_CHANGE`). A separate desk repair lane (`fix/fidelity-repair-2`, review findings N1–N7) runs before this feature's build lane so the visual baselines are re-accepted once.
Repos:        frontend
Brief:        BRIEF.md present (five defects recorded in council/decisions.md §0 — the decisions win where they differ)
Contracts:
  - SPEC.md                    draft, R4 pass 3 (final) — 9 sections, 71 acceptance rows (ship-blocking list 19, AC-C1a added), folding receipt 31/31, new §7 item 17 (cut-phrase scan, mutation-proved); contract_lint 0 errors (12 advisory budget warnings; the SPEC is 114 KB against a 40 KB budget — the fold trimmed deliberation and still grew 5 KB)
  - INTERFACE_CONTRACT.md      NO_BACKEND_CHANGE — conformance block for the who-am-I read the auth wall already consumes
Open amendments: none — S2 pass 2's 1 Critical closed by owner ruling D-B (A); its 2 Important + 1 Minor folded at R4 pass 3 (SPEC §1/§2.6, §4 + §7 item 17, §3 ship-blocking). No third S2 (cap). Canon Amendments row + ledger `hero-3d-is-a-static-isometric-projection` live on `docs/owner-blockers-2026-09-10` → main
QA (GATE Q):  n/a
Workers:      n/a
Last gateway:  GATE C @ 2026-09-10 (rulings + final fold on the Mac; council rounds 2026-09-08/09)
