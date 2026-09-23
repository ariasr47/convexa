# curvature-v2-landing-and-site — pipeline manifest
Stage:        **GATE S 2026-09-23: shipped and archived** (Windows box, conductor).
  - #49 merged as `08b82de3`, then main was merged into this branch.
  - F14 `9c41093a`, F15 `c76c9736`, F15b `55394a49` (`serve-dist.mjs`), F16 closer `d8b8387e`.
  - GATE Q FAILED at 61 of 71 (`42cf8556`). SPEC GATE Z amendments 1–7 (`22b6928d`). Fix lane `0601fa5f`…`882407ac`.
  - Re-check PASSED 11 of 11 (`0b69f7a2`). R-1 fixed (`65e6abf6`), and the conductor re-measured it.
  - win32 + linux baselines accepted by receipts (`55e61e97`; landing and scanner-dense).
  - Conformance pin promoted to `state/conformance/`.
  - Earlier history below.
Earlier stage:  **GATE PLAN complete 2026-09-10** (planner, one pass; PLAN.md 16 frontend tasks F1–F16, backend empty by contract, V-1…V-15) → **frontend build in flight** (the Mac, unattended; F1 serial → `Independent: yes` pairs, k=2 → F14/F15/F16 wait for PR #49 `fix/fidelity-repair-2` to merge). Conductor rulings at GATE PLAN: **C1** = the plan's pin edit (remove the `VALUE_CARD_RAW` glob with `ValueCard`; keep the two negative-space scans byte-for-byte) — §8 cost 2 wins over §7's literal "unchanged"; **C2** stays a conditional GATE Z for the closer (never raise the bundle pin).
Repos:        frontend
Brief:        BRIEF.md present (five defects recorded in council/decisions.md §0 — the decisions win where they differ)
Contracts:
  - SPEC.md                    draft, R4 pass 3 (final) — 9 sections, 71 acceptance rows (ship-blocking list 19, AC-C1a added), folding receipt 31/31, new §7 item 17 (cut-phrase scan, mutation-proved); contract_lint 0 errors (12 advisory budget warnings; the SPEC is 114 KB against a 40 KB budget — the fold trimmed deliberation and still grew 5 KB)
  - INTERFACE_CONTRACT.md      NO_BACKEND_CHANGE — conformance block for the who-am-I read the auth wall already consumes
  - PLAN.md                    GATE PLAN 2026-09-10 — 16 FE tasks (F1 prerequisite · F2–F13 independent · F14/F15 blocked on fidelity-repair-2 merge · F16 closer), 0 BE, V-1…V-15; decisions D1–D6; C1/C2 recorded above
Open amendments: none — S2 pass 2's 1 Critical closed by owner ruling D-B (A); its 2 Important + 1 Minor folded at R4 pass 3 (SPEC §1/§2.6, §4 + §7 item 17, §3 ship-blocking). No third S2 (cap). Canon Amendments row + ledger `hero-3d-is-a-static-isometric-projection` live on `docs/owner-blockers-2026-09-10` → main
QA (GATE Q):  PASS after GATE Z. QA_REPORT.md holds the first pass (FAIL 61/71) and the re-check (PASS 11/11, R-1 fixed). conformance-receipt.json is 1/1.
Workers:      frontend — F1 ✓ `a3c7c4d9` · F3 ✓ `9c57e082` · F5 ✓ `6e63ce6a` · F2 ✓ `c9d5a704` · F6 ✓ `3e34b9bb` · F4 ✓ `ca43cb57` · F8 ✓ `a54728e9` · F7 ✓ `6a21dcec`+`c7c6bcd2` · F7b ✓ `7c6914b6` · F9 ✓ `98f9028e` · F11 ✓ `06c2db88` · F12 ✓ `c445ab0c` · F10 ✓ `d26b4f60` · F13 ✓ `36776477` · conductor fixup `1398dcf9` (scoped Prettier) · **F7c ✓ `591e2654`** (light-scheme CTA contrast via `textAmber`: 3.0→5.2, 3.3→5.7; A11Y-2 passes) · **every independent row joined** · F14 / F15 / F16 (closer) wait for PR #49 to merge · GATE Q not run. backend — n/a (no rows)
Last gateway:  GATE S @ 2026-09-23 (conductor). Earlier: GATE PLAN @ 2026-09-10 (planner on Opus 5, one pass, no revision) → build lanes

## Conductor's cold verification — 2026-09-10 night, after every independent row joined (`1398dcf9`; not the lanes' numbers)

Build outputs deleted first; every command standalone, ports 4200/4310 freed, port 8000 never touched.

| check | result |
|---|---|
| V-1 `git diff --stat main -- apps/api libs/quant-engine libs/api` | **empty** |
| V-4 `npx nx typecheck @convexa/dashboard --skip-nx-cache` (cold) | exit 0 |
| V-5 `npx nx test @convexa/dashboard --skipNxCache` | exit 0 — **253 files / 3,055 tests** (baseline at F1 start: 243 / 2,941 → +10 files, +114 tests) |
| V-6 pins (`arc radius-scale single-motion-moment hex-discipline banned-hexes stage1-tokens`) | exit 0 — 216 tests |
| V-2 / V-3 `nx lint @convexa/dashboard` · `npm run lint` | 0 · 0 |
| V-15 `npm run format:check` | **1 → 0**: seven lane files (F1 `eslint.config.mjs`; F2 `NotFound.tsx`, `route-boundaries.structural.spec.ts`; F6 `samples.ts`, `ScoreStripSample.tsx`, `AiReadSample.tsx`, `landing-samples.spec.tsx`) needed a scoped Prettier pass — conductor fixup `1398dcf9`, tests of those files re-run green (23/23) |
| V-7 `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` | exit 0 — `index-D0iU0vP1.js` **67.64 kB · gzip 20.88 kB** |
| V-8 `npm run check:bundle` | exit 0 — 43 brotli checks within budget. **§2.4's escape hatch is open:** the entry chunk is above 20 kB gzip, so the closer (F16) may take the `Suspense` split; C2's gap case did not occur |
| V-12 `node --test` (manifest / visual-review / visual-update specs) | exit 0 |
| V-9 `browser:chromium` | exit 0 — **108/108, 0 flaky** (126 expected only after F15 adds its 18) |
| V-10 `browser:a11y` | **exit 1 — 14/16**: `A11Y-2` (route `/`, 1280, LIGHT) two `color-contrast` serious findings on `.MuiButton-sizeMedium` and `button[data-testid="cta-band-secondary"]` → **F7c** spawned; `A11Y-B2` asserts the OLD landing's CTA hrefs (`cta-primary` → `/scanner`) and the waitlist button — a `dashboard-e2e/**` sequence **F15 owns**, red until F15. Waivers: none (AC-G1) |
| V-11 `browser:compat` | 5/15 — chromium journeys pass; **firefox and webkit are not installed on this Mac** (`~/Library/Caches/ms-playwright` has chromium only) — not evidence either way; CI runs all three |
| V-13 `browser:visual` | **expected FAIL** — no `darwin` baseline exists by schema, all six scenarios "snapshot doesn't exist"; the landing's re-acceptance is the owner's win32 + linux flow after the closer |
| landing vs design (scripted, `phase4-build-verify/pairs/landing-{1440,1280,834,390}-dark.jpg`) | app **3,137 / 3,132 / 4,560 / 5,619** px against the design's 2,968 / 2,957 / 4,497 / 5,486 (1.06 · 1.06 · 1.01 · 1.02×); no horizontal overflow at any width; the six sections in the design's order; the design's "desk right now" live strip absent by the SPEC's cut |

**Looked at (not just measured):** the 1440 pair — hero with the static isometric surface beside the headline, the structure-field panel, the score strip, the AI-read sample, the trust cards, the CTA band, the footer once; the 390 pair — the same stack; the phone CTAs are narrower than the design's full-width pair (polish for the closer).

**After F7c (`591e2654`), the final cold pass on the whole tree:** typecheck 0 · **254 files / 3,061 tests** · lint 0 · format 0 · build 0 · bundle 0 · e2e **108/108, 0 flaky** · a11y **15/16** (only `A11Y-B2`, F15's) · lanes diff 0.

**Open after this pass:** F14 / F15 / F16 after PR #49 merges (F16 decides the §2.4 split — the entry chunk is 20.88 kB gzip); then GATE Q; then the landing baseline on Windows. Polish for the closer: the phone CTAs are narrower than the design's full-width pair.
