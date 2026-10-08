```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/app.risk.spec.tsx","A7-root-structural-lib","22","A signed-out visitor opens the positions or scanner page instead of the sign-in wall, a trader surface links to the operator route, or bare /ticker opens the wrong symbol.","auth","TRIM","structure","Read 1-410. TRIM 3: drawer-entries :349 (dup shell/TopNav.spec.tsx:35-43,59-66), drawer navigate/close :377, shell-node persistence :395 (SSE lifecycle is in shell/shell-live-lifecycle.flow.spec.tsx:175,218). Keep walk :218, wall :234, prefs :265-306, ops :308-342.","none","05702e92 2026-07-16 superpowers-plan"
"apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts","A7-root-structural-lib","16","Operator-only batch-replay or research UI/client code leaks onto trader surfaces, or the public Pages origin stops 404ing /api/_research and /api/_metrics.","invariant:operator-vs-trader-path-separation","TRIM","structure","Read 1-294. Designated carrier of the shared operator-separation scan. TRIM 4: no-trader-page :135, route-table/nav :144 (subsumed by whole-tree scan :111-133), block-list :240 (tests a helper defined in the spec), convexa.ts :274 (subsumed by :283). Keep Pages-404 :226,235,252.","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts","A7-root-structural-lib","14","Same operator-separation scan as the carrier, re-pinned with session-books/object-store strings: archive internals or the research envelope reaching trader surfaces.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-274. Pages-404 :109-153 and libs/api :231-248 duplicate batch-backtest-cli.structural.spec.ts:226-293. Needle scan :167 is the same scan with another array. Block-list :122 is a tautology. Fold identifier needles into the carrier, delete file (14 -> 0).","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts","A7-root-structural-lib","10","Same operator-separation scan as the carrier, re-pinned with chain-snapshots strings.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-170. Pages-404 :79-124 and convexa.ts :153 duplicate batch-backtest-cli.structural.spec.ts:226-270. Needle scan :137 is the same scan (chain-snapshots + 5 prose strings). Fold 'chain-snapshots' into the carrier, delete file (10 -> 0).","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/curvature-v2-deny-list.structural.spec.ts","A7-root-structural-lib","4","A public marketing page (landing/blog/methodology/404) imports the API client, trading code or auth transport because the ESLint deny-list that forbids it was dropped or weakened unnoticed.","guard","TRIM","structure","Read 1-76, eslint.config.mjs:195-260, pages/landing/svg-build-constraint.spec.ts:60-100 (real ESLint probes). TRIM 2: allowed-auth-modules :61 (over-ban fails lint loudly), no-source-violates :67 (equal layer: npm run lint, ci.yml:60). Keep :48,:55.","none","a3c7c4d9 2026-09-10"
"apps/dashboard/src/app/curvature-v2-landing-and-site.structural.spec.ts","A7-root-structural-lib","25","The public methodology score table states component maximums (40/25/25/10/6) that no longer match the engine caps in signals.rs, so a public claim about the score is silently wrong.","contract","TRIM","structure","Read 1-352, libs/quant-engine/src/signals.rs:24,454-541. TRIM 22 (25 -> 3): checker mutations :90-121, copy fidelity vs design/*.mjs :123-215, retired v1 fragments :240-260, Arm B :264,:288,:295,:307, cut phrases :330-352. Keep :269,:274,:281.","none","36776477 2026-09-10"
"apps/dashboard/src/app/curvature-v2-landing-samples.structural.spec.ts","A7-root-structural-lib","3","The landing sample flip-distance figure drifts from the desk's own projection, so marketing shows a number the product would not print.","","RETIRE","structure","Read 1-39. Formula covered by pages/ticker/widgets/_kit/distanceToLevel.spec.ts:30-60; the panel printing the label is pages/landing/landing-samples.spec.tsx:33-37. Case 2 pins a literal, case 3 re-tests the helper. Drift is visible and touches no data or money.","none","9c41093a 2026-09-22"
"apps/dashboard/src/app/day-replay-mock-adapter.spec.tsx","A7-root-structural-lib","2","A session-tape replay is shown or traded as live: live dot or copy while armed, or a simulated order fills against replay ticks.","invariant:present-is-live-paid-only","RETIRE","duplicate","Read 1-275. Covered cheaper: standing and poison pages/ticker/sessionTapeStanding.spec.ts:52-58,109-150; chips CommandDeck.spec.tsx:252-370, ConnectionChip.spec.tsx:110-127; LiveTape.spec.tsx:152-293; no-fill features/trading/orders/engine.spec.ts:96-111.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/day-replay-mock-adapter.structural.spec.ts","A7-root-structural-lib","4","Replay player chrome or an /_ops/replay route appears in the trader app, or the replay chip pulses like a live feed.","","RETIRE","structure","Read 1-69. :29,:44 absence scans (ops-unlinked walk is app.risk.spec.tsx:218-232), :50 STAGES pin (also pinned in massive-flat-file-keep :226 and session-day-tape-capture :311), :63 regex on source (behavior in ConnectionChip.spec.tsx:110-127).","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/exchange-holiday-calendar.structural.spec.ts","A7-root-structural-lib","6","Holiday-calendar operator tooling reaches trader nav, or the scanner stops using the NYSE holiday replica so a holiday weekday looks like an open session.","","RETIRE","duplicate","Read 1-88. Pages-404 :27 duplicates the carrier. TopNav :33 duplicates shell/TopNav.spec.tsx:59-66 and app.risk.spec.tsx:218. Wiring :71 duplicates pages/scanner/format.spec.ts:311 and tools/holiday-calendar-parity.spec.mjs. :45,:61 are absence/structure.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/index-head.structural.spec.ts","A7-root-structural-lib","7","The served HTML head shows a retired product claim (live order flow) in the browser tab or share card, or the no-JS fallback link is dead.","","RETIRE","structure","Read 1-82 and apps/dashboard/index.html noscript block. Pins title/OG copy, absence of v1 strings, noscript text and a hex regex over a 10-line block. All visible on first load; no auth, data or money effect.","none","ca43cb57 2026-09-10"
"apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts","A7-root-structural-lib","13","Same operator-separation scan as the carrier, re-pinned with liquid-names/ensure strings.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-231. Pages-404 :98-146 and libs/api :190-205 duplicate batch-backtest-cli.structural.spec.ts:226-293. Needle scan :157, route/nav :182 and no-new-page :173 are subsumed. Fold identifier needles into the carrier, delete file (13 -> 0).","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts","A7-root-structural-lib","16","The trader bundle contains the flat-files vendor host or keep-matrix chrome, or the public origin stops 404ing the research prefix.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-261. Pages-404 :109-157 and libs/api :206-217 duplicate the carrier. STAGES :220-257 is a structure pin (3 copies in area). Fold 'files.massive.com', 'massive_flat_files', 'MASSIVE_FLAT_FILES', '/api/_research/flat-files' into the carrier, delete file (16 -> 0).","none","a52f74b8 2026-08-30"
"apps/dashboard/src/app/replay-outcome-join.structural.spec.ts","A7-root-structural-lib","15","Same operator-separation scan as the carrier, re-pinned with join-measurement strings.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-284. Duplicates: Pages-404 :216-261, libs/api :264-283, route/nav :142, Settings/Ask-AI :156. :195-212 writes and unlinks a .ts inside src/app (flaky hazard). Fold 5 identifier needles into the carrier, delete file (15 -> 0).","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/research-lab-surface.structural.spec.ts","A7-root-structural-lib","10","The operator research page calls a trader/vendor-triggering route (getTicker/streamTicker), embeds a backend URL or env var, or persists data, so a diagnostic page stops being read-only.","invariant:operator-vs-trader-path-separation","TRIM","duplicate","Read 1-129. Keep :86 (non-vacuity) and :99 (operator-folder refusal scan). TRIM 8: Pages-404 :56, TopNav :62, /lab :70, convexa.ts :80, allowlist skip :93, credentials-omit :110 (dup researchClient.spec.ts:26,39-70,76), tautological mutation :120, folder-exists :125.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/route-boundaries.structural.spec.ts","A7-root-structural-lib","6","A new route is added without an error boundary, so one render error blanks the whole page instead of the route.","guard","TRIM","structure","Read 1-87 and app.tsx route table. Keep :39,:44,:52,:67 (checker plus its mutation proofs). TRIM 2: catch-all-last :75 (router ranks by specificity; unknown-route behavior is app.risk.spec.tsx:252), RouteFallback import pin :83.","none","c9d5a704 2026-09-10"
"apps/dashboard/src/app/session-chain-archive.structural.spec.ts","A7-root-structural-lib","13","Same operator-separation scan as the carrier, re-pinned with session-archive strings.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-229. Pages-404 :93-141, libs/api :195-212, route/nav :180 and no-new-page :170 duplicate the carrier (batch-backtest-cli.structural.spec.ts:226-293). Fold 'session_chain_archive','session-books' into the carrier, delete file (13 -> 0).","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/session-day-tape-capture.structural.spec.ts","A7-root-structural-lib","19","Same operator-separation scan as the carrier, re-pinned with session-day-tape strings.","invariant:operator-vs-trader-path-separation","CONSOLIDATE","duplicate","Read 1-331. Pages-404 :150-198, libs/api :291-302, STAGES :305-331 duplicate or are structure. F2 copy allowlist :235-288 exists only because prose needles collided with shipped S1 copy. Fold 'session-day-tape','session_day_tape' into the carrier, delete file (19 -> 0).","none","3b9567e9 2026-09-01"
"apps/dashboard/src/testing/operatorSessionArchiveAllowlist.spec.ts","A7-root-structural-lib","2","The operator-folder allowlist is loosened so the trader-source scans silently skip real trader code.","guard","RETIRE","duplicate","Read 1-22 and operatorSessionArchiveAllowlist.ts. Predicate precision is proven by batch-backtest-cli.structural.spec.ts:191-222 (poisoned TopNav still reported, folder-exact). folderNameAvoidsPathScanNeedles only feeds the path scans being retired.","none","3b9567e9 2026-09-01"
"libs/api/src/lib/broker.spec.ts","A7-root-structural-lib","6","Broker credentials or the broker book reach the UI wrongly: wrong endpoint or body, an auth refusal swallowed, or an unknown book collapsed into an empty one.","contract","TRIM","structure","Read 1-78 and broker.ts:1-303. TRIM 1: 'deletes credentials idempotently' :39 (mock passthrough, asserts neither URL nor method). Fix :36: it stringifies a Response (always '{}') so it can never fail. Gap: broker.ts:46-120 payload parser untested.","apps/dashboard-e2e/playwright.config.ts:33 (basename collision: that is the e2e broker.spec.ts, not this file)","25cf5943 2026-08-23"
"libs/api/src/lib/contract-authority.spec.ts","A7-root-structural-lib","7","A hand-written wire type or a deep import of the generated schema silently diverges the FE from the Rust API contract.","contract","TRIM","structure","Read 1-164 and tools/api-contract.mjs:1920-1955 (identical authorityScan, run by api:contract:check, ci.yml:53,172). TRIM 5: :50,:63,:77,:83,:117 (text-presence and count pins, dup of :128 plus tsc). Keep :128 (only mutation-proved copy of the rule) and :70 (no second fetch transport).","none","25cf5943 2026-08-23"
"libs/api/src/lib/contract-compat.spec.ts","A7-root-structural-lib","1","A refactor drops a public export of @convexa/api that a screen imports.","contract","RETIRE","structure","Read 1-30. 20 property-exists checks the type system already guarantees: every consumer imports these names, so a drop fails npm run typecheck (ci.yml:63) and the consumer suites.","none","25cf5943 2026-08-23"
"libs/api/src/lib/convexa.spec.ts","A7-root-structural-lib","31","The FE client calls the wrong endpoint/query/body, sends or echoes an AI key, maps an auth or market-paused refusal to the wrong error, or mishandles the SSE stream.","contract","TRIM","structure","Read 1-593. TRIM 3: :65 (asserts only literals built in the test), :442 getScan transport fault (dup :99,:306), :450 getScanUniverse passthrough (URL unasserted). Keep secret-never-echo :319,:332, auth mapping :372,:386,:501, paused 503 :108,:167, SSE :531.","none","27f74e4c 2026-06-28 superpowers-plan"
```

## NOTES

**Shared guard.** Ten files in this area copy the same operator-vs-trader scan. Its four parts are the Pages-404 regex, a trader-source needle scan, a libs/api scan and an allowlist check. Only the needle array differs per feature. The Pages-404 check is also duplicated in five Rust tests (`apps/api/tests/*_isolation.rs`, other auditors' areas).
- I made `batch-backtest-cli.structural.spec.ts` the one carrier. It has the strongest Pages-404 extractor, the allowlist proofs and the poisoned-source proofs.
- The seven CONSOLIDATE files delete everything except their identifier and URL needles. Those become `it.each` rows in the carrier's `TRADER_FORBIDDEN`.
- Prose-copy needles are dropped ('RESEARCH READ ...', 'Path-A ticks', 'saved Tuesday', 'lab names', 'BYTEA', 'Railway volume', and similar). They are non-contract copy, and they forced the F2 copy-allowlist machinery in `session-day-tape-capture.structural.spec.ts:61-100,235-288`.
- Needles to carry:
  - `/api/_research` and `/api/_metrics`
  - `session-books`, `session_chain_archive`, `SESSION_CHAIN_ARCHIVE_BODY_ROOT`
  - `chain-snapshots`
  - `liquid-names-session-capture`, `liquid_session_ensure`, `LIQUID_SESSION_ENSURE`
  - `files.massive.com`, `massive_flat_files`, `MASSIVE_FLAT_FILES`, `/api/_research/flat-files`
  - `replay-outcome-join`, `replay_outcome_join`, `ReplayOutcomeJoin`, `replayOutcomeJoin`, `cmd_replay_outcome_join`
  - `session-day-tape`, `session_day_tape`
  - `authorizes: "nothing"`
- After folding, the carrier is about 12 cases plus about 7 table rows.
- What these deletions would not catch: prose research copy pasted into trader UI with no `/api/_research` call. That is visible in the UI and has no auth, data or money effect.

**TRIM, exact case names (before -> after):**
- `app.risk.spec.tsx` 22 -> 19. Remove:
  - `mobile nav drawer › carries EXACTLY the trader NAV entries, no /_ops link, aria-current on the active entry`: duplicate of `shell/TopNav.spec.tsx:35-43,59-66`.
  - `mobile nav drawer › a drawer link navigates AND closes the drawer (the branch behavior, re-expressed)`.
  - `shell persistence › the SAME shell DOM node survives every in-shell navigation`.
- `batch-backtest-cli.structural.spec.ts` 16 -> 12. Remove:
  - `does not add a trader page for batch replay or capture browse`
  - `route table and nav stay free of batch-replay / capture-browse paths`
  - `the block list matches INTERFACE standing rule 4 (exact + prefix, both families)`
  - `convexa.ts does not grow a batch-backtest or _research replay helper`
- `curvature-v2-deny-list.structural.spec.ts` 4 -> 2. Remove:
  - `the two ALLOWED auth modules are NOT banned (SPEC §2.1 — capability, not folder)`
  - `the glob is not vacuous and no shipped surface source imports a banned specifier`
- `curvature-v2-landing-and-site.structural.spec.ts` 25 -> 3. Keep only these three Arm B cases:
  - `DARK_POOL_BONUS_CAP: i32 = 6 at :24, applied at :541`
  - `proximity cap 40 at :482, vol-stretch cap 25 at :487, active-setups cap 25 at :488, flip-transition 10 at :489`
  - `the score table's Max column matches 40 / 25 / 25 / 10 / 6, in the design source's row order`
  
  Remove everything else: all 4 `Pure checkers` cases, all 9 `Arm A` cases, both `Arm A′` cases, the other 4 `Arm B` cases (`anti-vacuity`, `first-stage clamp`, `applied strictly AFTER`, `MUTATION GUARD`) and all 3 `Arm C` cases.
- `research-lab-surface.structural.spec.ts` 10 -> 2. Keep:
  - `glob sees the operator folder; folder name avoids path-scan needles`. Drop its `folderNameAvoidsPathScanNeedles` line.
  - `operator folder refuses trader imports / relative research fetch / storage / keyframes`
  
  Remove the other 8. `researchClient uses credentials omit and absolute URLs` duplicates `researchClient.spec.ts:26,39-70,76`.
- `route-boundaries.structural.spec.ts` 6 -> 4. Remove:
  - `the catch-all is the LAST route in the shell group`
  - `RouteFallback no longer lives in app.tsx`
- `broker.spec.ts` 6 -> 5. Remove `deletes credentials idempotently`.
- `contract-authority.spec.ts` 7 -> 2. Remove:
  - `keeps generated imports behind the shared facade`
  - `allows semantic facade classes and indexed generated component consumption`
  - `retains the native EventSource boundary for SSE lifecycle semantics`
  - `rejects parallel wire interfaces after indexed migration`
  - `keeps generated consumption centralized to the facade lanes`
  
  Keep `does not add a second ordinary HTTP transport` and `enforces the handwritten-wire boundary and rejects every poison mutation`.
- `convexa.spec.ts` 31 -> 28. Remove:
  - `generated optional availability boundary › keeps absent, null, and explicit false distinguishable`
  - `scanner client › getScan rejects with ApiError on a TRANSPORT fault (server-side it is always 200)`
  - `scanner client › getScanUniverse returns the read-only universe envelope`

**Overlap decision between the two libs/api contract specs:**
- Keep `contract-authority.spec.ts:128`. `tools/api-contract.mjs:1920-1955` runs the same four rules in CI, but its own spec has no poison proof for that scan. Case :128 is the only mutation-proved copy.
- Retire `contract-compat.spec.ts`. The type checker covers it.
- Better still, export `authorityScan` from the tool and import it in :128. That leaves one implementation of the rule.

**RETIRE: the failure each would not catch, and why it is not silent or not costly:**
- `curvature-v2-landing-samples`: a marketing sample figure drifting. Visible, and no data or money effect.
- `day-replay-mock-adapter.spec.tsx`: nothing. Every assertion is covered at the cited file:lines.
- `day-replay-mock-adapter.structural`: a replay route or player chrome added to the trader app. Visible, and the ops-unlinked invariant is enforced by the `app.risk` walk.
- `exchange-holiday-calendar.structural`: nothing. Behavior is in `format.spec.ts:311` and the three-way parity in `tools/holiday-calendar-parity.spec.mjs`.
- `index-head.structural`: retired copy reappearing in the tab title or share card. Owner-visible on first load.
- `operatorSessionArchiveAllowlist.spec`: duplicate of `batch-backtest-cli.structural.spec.ts:191-222`.
- `contract-compat`: a dropped export fails `npm run typecheck` and the consumer suites loudly.

**NEW-BEHAVIOR-TEST:**
1. **Pages catch-all behavior.** `functions/api/[[path]].ts` is the only edge boundary keeping operator endpoints off the public origin. It is currently proven only by source-text regexes (eight FE copies, five Rust `contains` checks). Add a spec that imports `onRequest` and calls it with real `Request` objects. It should assert:
   - `/api/_metrics`, `/api/_metrics/x`, `/api/_research` and `/api/_research/x` return 404.
   - `/api/_researching` and `/api/ticker/SPY` are forwarded.
   - 502 when `API_ORIGIN` is unset.
   
   A good home is `apps/dashboard/src/app/pages-proxy.spec.ts`. This replaces all the regex copies.
2. **Broker book parser.** In `libs/api/src/lib/broker.spec.ts`, cover `brokerBookFromWire` (`broker.ts:46-120`). It should assert:
   - A malformed state, reason, fidelity, kind or right rejects with `ApiError('Malformed broker book payload')`.
   - Null optionals are omitted, not null-padded.
   - 401/422 map to `AuthError` and a 5xx maps to `ApiError`.
   
   Today only the 403 mapping and passthrough are tested. This is a gap, not a structure-only case.

**Question (does not change a verdict):** for the 3 kept Arm B cases, should the methodology table be pinned to `signals.rs` by line number from this TS test? If yes, they break on any edit above those lines. If no, move the check next to the caps as a Rust constants test and delete the 3. That would take `curvature-v2-landing-and-site.structural.spec.ts` to 0.

**FLAKY / timing:**
- `replay-outcome-join.structural.spec.ts:195-212` writes and unlinks `apps/dashboard/src/app/_mutation_poison_replay_outcome_join.ts` in the shared source tree while other workers run. `day-replay-mock-adapter.structural.spec.ts:10-26` walks that same directory at runtime. If the process is killed between write and `finally`, the leaked file fails the :105 scan on later runs. The CONSOLIDATE removes it.
- No sleeps, retries or fake timers anywhere in the area. `Date.now()` appears only in fixtures (`app.risk.spec.tsx:136-142`, `day-replay-mock-adapter.spec.tsx:70,156`) and no assertion depends on it.
- 14 files find the repo root by walking up from `process.cwd()` (`workspaceRoot()`, 8 levels). That works from the repo root or `apps/dashboard` and breaks outside the workspace.

**SLOW:**
- `app.risk.spec.tsx` is 12.27s for 22 cases; every other file is 0.34s or less. The cost is a full `<App/>` render per case.
- The TRIM removes 3 full-App renders, two of them with user-event clicks. My unmeasured estimate is about 10.5s.
- Optional second cut, not applied: the walk rows `/blog`, `/methodology`, `/lab` and `/lab/structure-field` only prove route-to-page binding, and each page has its own spec. Dropping them would save roughly another 2s. The cost is losing the per-surface 'no /_ops link' check on those pages. The nav and footer are shared chrome and are covered by `shell/TopNav.spec.tsx:59-66`.

Totals (23 files): KEEP 0, TRIM 9, CONSOLIDATE 7, RETIRE 7, UNSURE 0, NEW-BEHAVIOR-TEST 0 as file verdicts (2 gaps listed above). Cases drop from 252 to about 77, plus about 7 needle-table rows in the carrier.
