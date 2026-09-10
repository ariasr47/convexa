# curvature-v2-desk-and-read — pipeline manifest
Stage:        GATE S — closed 2026-09-05 (phase 2 of 4 of the Curvature Terminal v2 build). Branch NOT pushed; no PR.
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
QA (GATE Q):  **QA_REPORT PASS** on the re-run — 60 PASS / 0 FAIL / 1 UNVERIFIABLE over 61 rows (16 split into 16a/16b).
              Pass 1 FAILed 59/1/1 on criterion 30 and bounced. Both passes preserved.
Workers:      council R1x3, R2x3, R3x3, R4 synthesizer (2 passes), S2 skeptic (2 passes); planner;
              frontend lanes x11 (FE-1..FE-14, two killed mid-task and recovered); QA x2; GATE Z fix lanes x2
Last gateway:  GATE S @ 2026-09-05

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

- BUILD @ 2026-09-05 - all 14 frontend tasks landed across **eleven** lanes. Two were killed mid-task (one by a
  session rate limit); the conductor recovered the second lane's uncommitted FE-3 work by hand after verifying it
  cold, and every lane thereafter committed per task so a kill cost one task rather than four.
- GATE Z @ 2026-09-05 (x3, all bounced by a lane or by QA rather than discovered later):
  (1) the planner refused to plan around SPEC criterion 16 - split into **16a**/**16b** because the original row
  demanded a pause mark and a placeholder together, which no code path can produce;
  (2) SPEC 4.1's ladder-mid/tape-trail offline treatment owned no task - assigned to FE-11, with the mechanism
  stated (branch on the **standing union**, never `!isLive`, so replay cannot contradict 16b);
  (3) A10's pinned-read retention owned no task - assigned to FE-10, which found it was **not** true by
  construction and fixed a real defect in the hook.
- GATE Q #1 @ 2026-09-05 - **FAIL 59/1/1**. Criterion 30 (amber, DELEGATED P2) on two independent grounds: a
  token-exact DOM census found four primary CTA fills spending brand amber, and the census the row named **did
  not exist** (`readLayout.render.spec.tsx:84` scanned `color:` bindings only).
- GATE Z @ 2026-09-05 - **owner ruling**: the conductor's P2 list of two was the outlier, not the code. Canon
  defines `primary.main` AS fill amber and the approved canvas draws these buttons amber. Row 30 amended to a
  closed list of **three**, teeth moved from exclusion to **cardinality**. The missing census was built and
  mutation-proven both ways.
- GATE Q #2 @ 2026-09-05 - **PASS 60/0/1**, verified by QA performing both mutations itself. Row 46 stays
  honestly UNVERIFIABLE (the bottom sheet mounts and carries zero `FigureCell` figures). 3 MEDIUM findings.
- GATE Z @ 2026-09-05 - hardening, not a bounce: F2 (whole-file `hex-discipline` exemptions had disarmed the
  guard - injecting `#F2A93B` into `FigureCell.tsx` passed at exit 0) narrowed to per-value; F3
  (`fieldAmbientShadow`, unmirrored and lab-only) removed by conductor ruling. F1 carried as named debt.
- GATE S @ 2026-09-05 - canon amended (rules **11**, **14**, **16**, and **17** tense-only); the `tooltip`
  z-rung deliberately **not** amended - `theme.ts:83` already ships a working, consumed value of **60**.

## Final measurements (conductor's own runs, not the lanes')
typecheck **0** - dashboard suite **0** @ **231 files / 2694 tests** - lint **0** - `verify-tokens` **0** @ 34/34 -
e2e **86/86** against the production build from the repo root, `--list` proving 6 `desk-and-read.spec.ts` cases -
independent conformance **PASS** live 2/2 endpoints - `git diff origin/main...HEAD -- apps/api` **0 lines**.

## Four real defects this phase found in PREVIOUSLY-SHIPPED code
1. `LiveTape.tsx:96,190` printed `offline - last known` over a REST-bundle number that never came off the stream.
2. `TapePulseStrip.tsx:31-34` printed `Live $<structureMid>` when a live stream carried no mid.
3. `useAiRecommendation.ts`'s catch branch **destroyed a pinned AI read on any failed refresh** - both `Refresh`
   and `Ask anyway` re-request while a read is showing, so a transport fault silently replaced paid-for output.
4. The hero's mid stream read was gated on `claim` alone (always false during replay), so the mid could never
   show a real replayed value.
Plus four primary CTAs defaulting to MUI's unthemed amber, found only by a DOM colour census.

## Carried debt (named, with a phase attached)
F1 - the amber census is token-exact and evadeable three ways (`alpha(primary.main, .9)`, `'primary.light'`,
`'&:hover'` - `allRulesForClass` matches `.css-x{` only). The structure field's point-by-point **curve
text-equivalent** (DELEGATED P1) - phase 4. The spacing-exemption remainder - phase 4. The eight quiet-band
widgets' internal rebuild - phase 3. The `tooltip` z-rung canon declaration (code already ships 60).
The CWD-dependent e2e quality reporter. The stale `node_modules/.vite` glob-transform flake, which
`--skip-nx-cache` does **not** clear.

