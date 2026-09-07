# curvature-v2-surfaces — pipeline manifest
Stage:        GATE I — brief written 2026-09-05 (phase 3 of 4 of the Curvature Terminal v2 build)
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    **draft** (R4 2026-09-06, 1006 lines) — 95 acceptance criteria, 53 `SB`; 27/27 council conflicts
                               folded with inline markers; four OWNER rulings + one CONDUCTOR call tagged inline. Awaiting S2,
                               `contract_lint`, then owner approval.
  - INTERFACE_CONTRACT.md      **draft** (R4 2026-09-06, 182 lines) — NO_BACKEND_CHANGE measured three-dot; Conformance block
                               pins `GET /api/scan` + the `/api/ticker/{ticker}` spine, deliberately NOT `PUT /api/scan/view`
                               or `/api/broker/*`; durable client stores named with their loss-free rule.
Open amendments: **two queued for GATE S, neither applied mid-build.** (1) Rule 13 — owner ruling D-D 2026-09-06: the traced
                 clause widens to "traced to Convexa's computation **or to a record the trader entered**", so a user-entered
                 number (alert threshold, risk input, sim entry) renders Mono with no dotted rule. (2) Icons row — an owner
                 QUESTION, not yet a ruling, filed by ux self-revision #25: does the colour-emoji clause reach `U+26A0` in a
                 scanner chip label (`labels.ts:196,205,211`), or is the `⚠` glyph a deliberate third truth mark? The chip
                 ships byte-identical this phase either way.
                 Phase 2 filed four (canon rules **11**, **14**, **16**, **17**); this phase
                 inherits them as settled. One named, non-blocking gap carries in: the **`tooltip` z-rung
                 is undeclared in the canon** while `theme.ts:83` already ships a working, consumed value
                 of **60** (`AppShell.tsx:42` reads `tooltip + 1`). Closing it means declaring 60, not
                 inventing a number.
QA (GATE Q):  n/a
Workers:      council R1x3 blind (402 / 273 / 422 lines), R2x3 sighted (27 conflicts, 27/27 quotes verified), R3x3 one
              exchange (22/22 CONVERGE) — all 2026-09-06; R4 synthesizer + S2 skeptic pending on four owner rulings
Last gateway:  GATE I @ 2026-09-05 — GATE C opened 2026-09-06

## Gate trail
- GATE I @ 2026-09-05 — brief + cull recorded (6 candidates, 1 chosen, 5 culled with cause). Five facts read
  at source rather than asserted (`[cited-code-is-verified-not-assumed]`), one of which **corrects phase 2's
  own brief**: the eight ticker quiet-band widgets do **not** consume `FigureCell` (zero of eight), and
  neither do scanner / positions / alerts / settings. `StatTile` is gone as a component; every surviving
  mention is a comment. Settings lives at `features/auth/SettingsPage.tsx`, not `pages/`. Alerts already
  ships `level_touch` + price threshold to `convexa.alerts.v1`.
- GATE C (in progress) @ 2026-09-06 — R1 ×3 blind (architect 402 / pm 273 / ux 422 lines); R2 ×3 sighted: **27 conflicts,
  27/27 quotes machine-verified**; 7 self-revisions folded, 2 technical converged by them, 11 technical settled in ONE
  exchange at **22/22 CONVERGE, zero promoted**. Four product calls to the owner, one card at a time: D-A scanner price
  liveness · D-B settings section navigation (net-new construction) · D-C `Widget`-frame ⓘ (desk reopened for one shared
  change) · D-D register of a user-entered number. **All three R1s falsified BRIEF facts:** the scanner runs a real price
  SSE (`useLivePrices.ts:39-57`) so "scanner rows are snapshot surfaces" was false as an absolute; Settings has **no rail**
  (`SettingsPage.tsx:156`), so "rail → tabs at 900" is construction, not a responsive fix; four of the eight quiet-band
  widgets carry no mono figure, and `term-structure`'s only numeral is painted on a canvas (`TermHeatChart.tsx:105-106`).
  **Shipped defects found by the council:** green `+$0` on a fully-unmarked book (`PositionsPage.tsx:147-154,189`); a
  fabricated `≥ 60` on alerts rules with no threshold (`AlertsPage.tsx:192`) and a price threshold that never renders at all;
  `Widget`'s ⓘ non-focusable at seven live sites (`Widget.tsx:245-249`) despite phase-1 ruling 6 declaring AC-35 satisfied;
  `PositionsPage.tsx:88` calling the banned `genuineIsLive` outside the fence's glob; `alerts/store.ts:66-68` resetting to
  empty on a parse failure while the next write overwrites the key — a live `loss-free-durable-migration` breach;
  `PauseMark`/`LiveDot` module-private in `FigureCell.tsx`, so no surface outside the primitive can render the declared
  pause icon today.

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
