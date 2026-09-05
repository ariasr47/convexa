# curvature-v2-desk-and-read — pipeline manifest
Stage:        GATE I — brief written 2026-09-05 (phase 2 of 4 of the Curvature Terminal v2 build)
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    n/a — GATE C not yet run
  - INTERFACE_CONTRACT.md      n/a — expected NO_BACKEND_CHANGE (frontend-only; `apps/api` diff must be empty)
Open amendments: none yet. Two canon amendments are already **in scope** for this phase and must not be
                 discovered late: (a) **rule 11 is stale** — it locks "vertical diverging" for the
                 Recharts GEX chart that `widgets/gex-profile-chart/chart.tsx:4` records as already
                 replaced by the Canvas2D structure field, which maps strike→x
                 (`shared/charts/structure-field/StructureFieldCanvas.tsx:217`); left unamended it
                 red-flags correct code at GATE Q. (b) the **`tooltip` z-rung** carried open from
                 phase 1 (canon declares six rungs; MUI defaults tooltip to 1500, above every one).
QA (GATE Q):  n/a
Workers:      n/a — council not yet dispatched
Last gateway:  GATE I @ 2026-09-05

## Gate trail
- GATE I @ 2026-09-05 — brief + cull recorded (8 candidates, 1 chosen, 6 culled with cause, 1 culled-to-partial).
  Three load-bearing code facts read at source rather than asserted (`[cited-code-is-verified-not-assumed]`):
  the structure field already ships horizontally; `useFlashOnChange.ts:44` writes `prev.current` before its
  null guard at `:46`; `verify-tokens.mjs:38` prints the seven v2 additions without structurally checking them.
- Baseline @ 2026-09-05 - conductor's own runs on `spire/curvature-v2-foundations` @ `6a3ef463`, **exit codes checked,
  not printed summaries**: `npm run typecheck` **exit 0**; `npx nx test @convexa/dashboard` **exit 0** @ **215 files /
  2376 tests**; `npm run lint` **exit 0**. All three match phase 1's recorded close-out figures, so the branch is
  where the RESUME said it was.
  e2e honestly **NOT RUN** at baseline (needs `npx playwright install chromium` + a production build + `ports:free`).
- GATE C @ 2026-09-05 - R1 dispatched: architect, pm, ux, blind and parallel.

## Inherited from phase 1 (do not rediscover)
`state/spire-curvature-v2-foundations/RESUME.md` is ACTIVE and carries the five owed items and the gotchas
phase 1 paid for. Eight owner rulings in `contracts/curvature-v2-foundations/council/decisions.md` bind
here — rulings 1, 2, 3, 5, 6 and 8 constrain what this phase builds directly.
