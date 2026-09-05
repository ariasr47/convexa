# curvature-v2-desk-and-read — pipeline manifest
Stage:        BUILD — frontend lane dispatched 2026-09-05 (phase 2 of 4 of the Curvature Terminal v2 build).
Repos:        frontend
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    **locked (owner-approved 2026-09-05)** — 32/32 council conflicts folded with verified
                               receipt; SEVEN conductor calls under delegation, all tagged DELEGATED (P1-P5, D-14, D-15)
                               — **ratified by the owner's spec approval 2026-09-05**; they stay tagged so the
                               provenance survives into GATE Q and the ledger
  - INTERFACE_CONTRACT.md      **locked** — NO_BACKEND_CHANGE + a Conformance spec block; pins
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
Workers:      council R1x3, R2x3, R3x3, R4 synthesizer (2 passes), S2 skeptic (2 passes); planner; frontend lane (build)
Last gateway:  GATE PLAN @ 2026-09-05

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

- GATE PLAN @ 2026-09-05 - PLAN.md: 15 tasks (1 backend verification-only + 14 frontend), 3 tracks, a 17-row
  verification table, 15 mutation proofs, Independence all-`no` with stated grounds. The planner **bounced one
  GATE Z item** rather than planning around it: SPEC criterion 16 was **not satisfiable as written**.
- GATE Z @ 2026-09-05 - criterion 16 split into **16a** (symbol change) and **16b** (replay arm), each asserting
  what the code can actually produce, verified at source by the conductor before amending:
  `useTickerStream.ts:34` republishes `{live: null, streamOffline: false}` on a symbol change, so
  `LiveTape.tsx:100`'s `tileOffline` is false and `FigureCell.tsx:255`'s offline arm is never entered - there is
  **no pause mark** on that path; and a replay arm renders **F6** (`FigureCell.tsx:277-281`: no dot, no pause mark)
  while `connectionState.ts:92-96` forbids the chip re-entering the placeholder within a mounted session. The
  original row demanded both together, so a fixture satisfying it would have gone **green against a state the app
  cannot produce** - the vacuity the spec's own row 57 forbids. The chip half was right for 16a (the republished
  null does return the chip to its wordless placeholder) and wrong for 16b (replay shows the replay state).
  Also closed the planner's U-1: `SPEC.md`'s status line still read `draft` after the owner's approval.
- BUILD @ 2026-09-05 - frontend lane dispatched on Sonnet (per the budget rule: build lanes Sonnet, council Opus).

