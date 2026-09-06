# curvature-v2-surfaces — pipeline manifest
Stage:        GATE I — brief written 2026-09-05 (phase 3 of 4 of the Curvature Terminal v2 build)
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    n/a — GATE C not yet run
  - INTERFACE_CONTRACT.md      n/a — expected NO_BACKEND_CHANGE (frontend-only; `apps/api` three-dot diff must be empty)
Open amendments: none yet. Phase 2 filed four (canon rules **11**, **14**, **16**, **17**); this phase
                 inherits them as settled. One named, non-blocking gap carries in: the **`tooltip` z-rung
                 is undeclared in the canon** while `theme.ts:83` already ships a working, consumed value
                 of **60** (`AppShell.tsx:42` reads `tooltip + 1`). Closing it means declaring 60, not
                 inventing a number.
QA (GATE Q):  n/a
Workers:      n/a — council not yet dispatched
Last gateway:  GATE I @ 2026-09-05

## Gate trail
- GATE I @ 2026-09-05 — brief + cull recorded (6 candidates, 1 chosen, 5 culled with cause). Five facts read
  at source rather than asserted (`[cited-code-is-verified-not-assumed]`), one of which **corrects phase 2's
  own brief**: the eight ticker quiet-band widgets do **not** consume `FigureCell` (zero of eight), and
  neither do scanner / positions / alerts / settings. `StatTile` is gone as a component; every surviving
  mention is a comment. Settings lives at `features/auth/SettingsPage.tsx`, not `pages/`. Alerts already
  ships `level_touch` + price threshold to `convexa.alerts.v1`.

## Inherited (do not rediscover)
`state/spire-curvature-v2-foundations/RESUME.md` carries the phase table and the trap that cost phase 2 the
most time (a stale `node_modules/.vite` glob transform that `--skip-nx-cache` does **not** clear).
`contracts/curvature-v2-desk-and-read/_MANIFEST.md` carries phase 2's gate trail, the **four defects it found
in previously-shipped code**, and the carried-debt list with phases attached.
`contracts/curvature-v2-foundations/council/decisions.md` — phase 1's eight owner rulings; **ruling 6 assigns
this phase its quiet-band work by name**.
`state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` — phase 2's seven DELEGATED calls, each with its
reversal, including the two later found wrong on their facts.

## Debt this phase is scoped to inherit
The eight quiet-band widgets' register enforcement and container steps (phase 1 ruling 6, deferred by name).
**Not** this phase: the curve text-equivalent (DELEGATED P1) and the spacing-exemption remainder — both phase 4.
