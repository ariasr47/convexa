# curvature-v2-desk-and-read — pipeline manifest
Stage:        GATE C — spec synthesized, skeptic clean, contract_lint 0 errors (phase 2 of 4 of the Curvature Terminal v2 build). AWAITING OWNER APPROVAL of SPEC.md.
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    draft, awaiting owner approval — 32/32 council conflicts folded with verified
                               receipt; SEVEN conductor calls under delegation, all tagged DELEGATED (P1-P5, D-14, D-15)
  - INTERFACE_CONTRACT.md      draft — NO_BACKEND_CHANGE + a Conformance spec block; pins
                               `/api/ticker/{ticker}` then `/api/recommendation/status/{ticker}` (order load-bearing);
                               the recommendation POST is deliberately unpinned (session-bound, mutating, would spend
                               a real AI request against the caller's cap)
Open amendments: none yet. Two canon amendments are already **in scope** for this phase and must not be
                 discovered late: (a) **rule 11 is stale** — it locks "vertical diverging" for the
                 Recharts GEX chart that `widgets/gex-profile-chart/chart.tsx:4` records as already
                 replaced by the Canvas2D structure field, which maps strike→x
                 (`shared/charts/structure-field/StructureFieldCanvas.tsx:217`); left unamended it
                 red-flags correct code at GATE Q. (b) the **`tooltip` z-rung** carried open from
                 phase 1 (canon declares six rungs; MUI defaults tooltip to 1500, above every one).
QA (GATE Q):  n/a
Workers:      council R1x3, R2x3, R3x3, R4 synthesizer (2 passes), S2 skeptic (2 passes)
Last gateway:  GATE C @ 2026-09-05

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
- GATE C @ 2026-09-05 - **32 conflicts, 32/32 quotes machine-verified**; 11 self-revisions folded; 16 technical
  conflicts settled voice-to-voice with **ZERO promoted to a product call**, every one on a file:line read or a canon
  rule number. 5 product conflicts decided by the conductor under the owner's written delegation (owner asleep),
  recorded as DELEGATED not RULED. S2 pass 1: **1 Critical** (the `no_edge` disposition was factually wrong against
  `presentationPolicy.ts:105-136` - request and result states are computed independently, so `no_edge` + a produced
  trade is reachable and the gate note never mounted), 1 Important, 2 Minor. R4 pass 2 repaired all four; S2 pass 2
  marked all four **CLOSED** and raised 1 Important + 1 Minor, both repaired by the conductor. `contract_lint`
  **0 errors** after normalizing two R2 files to the validator's exact shape and re-deriving the 23 affected
  conflict ids plus their inline markers.
  The council found three factual errors in the BRIEF (834's phase, "both schemes", alerts unshipped), two live
  fabrications in shipped code (`LiveTape.tsx:96,190`; `TapePulseStrip.tsx:31-34`) and two blind spots in
  `single-motion-moment.spec.ts` (a rAF loop, and the dynamic keyframe name minted at `useFlashOnChange.ts:71-74`).

## Inherited from phase 1 (do not rediscover)
`state/spire-curvature-v2-foundations/RESUME.md` is ACTIVE and carries the five owed items and the gotchas
phase 1 paid for. Eight owner rulings in `contracts/curvature-v2-foundations/council/decisions.md` bind
here — rulings 1, 2, 3, 5, 6 and 8 constrain what this phase builds directly.
