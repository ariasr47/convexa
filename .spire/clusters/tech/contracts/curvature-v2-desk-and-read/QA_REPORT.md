# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| The ladder renders exactly five rows — call wall, mid, max pain, gamma flip, put wall — sorted by price, at every data state; a null level never removes a row | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| The ladder renders the level names **`Call wall`** and **`Put wall`** as visible text, unchanged in wording from the grid it replaces | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Every non-mid row shows its distance from the levels anchor (`gex_spot`, falling back to `price`); the mid row's distance cell renders `—`, never a computed zero and never an empty cell | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The ladder states, once, which price the distances are measured from | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| A level the current bundle does not carry keeps its row and its label, renders `—` in the not-a-number register (15px Sans) in its value cell, renders `—` in its distance cell, and is never a zero, another member's literal, `$—`, or an empty row — **DELEGATED (D-14)** for the choice of `—` | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| Vol-norm GEX and Raw GEX (1% shock) still render, with their shipped tooltips | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Each ladder row's tick and its line in the field are drawn from one stroke definition — changing one token key moves both, and no ladder tick has a colour the field does not use | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| On the whole desk, at every connection kind and replay standing, the only figure bearing a live dot is the ladder's mid row plus the live tape's stream-sourced cells; the quiet band contains zero live dots and zero `data-figure-state="live"` nodes | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:qa.mutation_poison |
| The desk carries exactly **one** connection chip in the viewport at both scroll positions, and no free-standing liveness **word** renders anywhere in the hero | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The hero's mid readout is labelled `Mid` in every standing and never renders the structure mid under that label; when the stream is delivering but carries no mid, no live claim is made about it | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The hero states its basis once: `levels are REST structure (as-of {age}) · the mid is tape` | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| On a stream drop, a live-derived figure **whose stream latch holds a value** renders that latched value at 50% opacity with the pause marker and the caption `offline · last known` | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| On a drop with an **empty** latch, the same cell renders a closed-vocabulary member with the pause marker and **no** "last known" words | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| No figure anywhere on the desk renders the "last known" retention wording over a value sourced from the REST bundle rather than the stream latch | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:qa.mutation_poison |
| A widget-level subtitle claiming last-known ticks renders only when at least one cell in that widget holds a latched stream value; otherwise the no-ticks-retained arm renders | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| **After a symbol change** the latch is empty: every live-derived cell shows the bare not-a-number member with **no pause mark and no dot** (the stream republishes `{live: null, streamOffline: false}` at `useTickerStream.ts:34`, so `LiveTape.tsx:100`'s `tileOffline` is false and `FigureCell.tsx:255`'s offline arm is never entered), no prior symbol's value survives in any cell, and the connection chip is simultaneously on its **wordless placeholder** (`connectionStateFor` returns `null` when `live == null`) | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| **After a replay arm** the latch is empty: every live-derived cell renders **F6** — full strength, no dot, no pause mark, caption `session replay` (`FigureCell.tsx:277-281`) — no pre-replay value survives, and the connection chip shows the **replay** state, **never** the placeholder (`connectionState.ts:92-96`: once `live` is non-null the resolver cannot re-enter `null` within a mounted session for that symbol) | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| A value restored from the latch on a drop does **not** produce a flash | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| The tape cell's label names its **derivation** (`· live` / `· session tape`) in every standing, never changes with connection state, and is never byte-identical to the ladder's `Gamma flip` row label | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| On a drop, the strip's static cells, the ladder's four structure rows and every quiet-band card render **identical text content** to their pre-drop render, and none is dimmed | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| On a drop the field keeps its last computed geometry — curve, wall lines and flip line still painted — while trail, drift, beam and sweep stop: against a recording 2D context, `live: false` yields zero trail points, zero particle `arc()` calls, zero sweep gradient fills and **non-zero** level strokes | PASS | RUN:frontend.test_cmd,RUN:qa.mutation_poison |
| The field's container is not dimmed on a drop | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| With reduce-motion on, the field drift, the tape trail and the mid beam render as static frames at every width | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The levels, the tape trail's values and the mid are readable as **text** in the DOM beside the field (the ladder is their text equivalent) — **DELEGATED (P1)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The field carries an accessible name, a short summary naming what it plots and the levels it marks, and a programmatic pointer to the ladder as its tabular equivalent — **DELEGATED (P1)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The read strip renders **eight** cells at every state; the cell count does not change between states, an absent datum keeps its slot and its label and renders a closed-vocabulary member in body type, and its neighbours keep rendering their values | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The off-exchange cell renders **`not provided`** whenever the bundle carries no off-exchange object — in both the disabled-source and failed-computation cases — and never `unavailable` or any member naming a cause the app was not told | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:qa.mutation_poison |
| The off-exchange cell renders neutrally, states that it is context only with no side, and never in the success/direction register | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Term structure, IV rank and skew render the wire's closed label; no strip cell re-derives a label from a scalar | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| The verdict word is the first content node in the AI panel's reading order | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| The verdict word is the only element in the panel spending amber **as text**, in **every** state; the only non-text amber permitted anywhere in the panel is the authored `:focus-visible` ring and the in-flight progress indicator while a request is actually running — a colour census of the panel finds no third — **DELEGATED (P2)** | FAIL | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Each of the four risk fields (max risk · invalidation · entry · target) renders its grounding **before** any prose, declaring traced vs the model's own number in the **type register** — Mono for traced, Plex Sans with a dotted rule for the model's own — and never in colour | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Every named AI-read case of §4.5 is independently reachable from at least one producible `(request, result)` pair in the fixture harness — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| No two non-synonymous AI-read cases render the same primary line, and no case is identified — in a criterion, a test or the build report — by a marker another reachable case also renders — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:frontend.test_cmd |
| A **request failure** renders its own named line and never renders as *idle* or as a *no trade* verdict — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| *Stale* and the full-analysis drawer **compose over** a produced read: the read stays present and readable beneath/behind them, and neither replaces it — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The cooldown and daily-cap renders never show each other's marker: a capped user is never shown a countdown, and a cooling-down user is never shown a reset time — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The eight powering reasons each render their own sentence and CTA label; no two collapse into one string | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| *Produced (no trade)* renders at the same typographic weight as a trade, with no warning chrome, no error tone and no red, and names the conditions that would change the read | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| In *produced (no trade)*, **every control the panel renders performs an action this build actually performs** — no disabled placeholder and no control whose label names a capability this build does not have | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The *no trade* wording carries the level as a **condition** in the `Re-engage when {conditions}` line, never as a control label | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| *Idle* offers the ask control and states the snapshot's as-of, and carries **no** quiet-gate note or ask-anyway control; the quiet-gate arm carries both plus everything idle renders — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The quiet gate's `no_trade` renders in Mono lowercase and never in the verdict slot or the verdict's display register; the *no trade* verdict renders in Archivo display and never inside a note — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| A read pinned to an older snapshot than the desk beside it renders an in-body **warning strip with the icon**, never a footnote, and the read stays legible beneath it — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| An SSE drop alone never marks the AI read stale | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Under 768px the brief renders as a bottom sheet with a peek row carrying the verdict; **exactly one** verdict-marked node is mounted at 393px and exactly one at 1280px, and the two carry the same string from the same field | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:qa.e2e |
| Figures inside the bottom sheet step with their container exactly as they do in the panel | UNVERIFIABLE | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| Signed out, without a key, cooling down, capped or after a request failure, the structure, the tape, the strip and the quiet band all render unchanged | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The quiet band carries its own basis and as-of and never wears a live mark | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| At **393px in both colour schemes**, and at **834, 900 and 1280 in the one scheme the standing suite runs**, the desk has no horizontal page overflow | PASS | RUN:frontend.build_cmd,RUN:qa.e2e,RUN:qa.browser_observation |
| At those same width × scheme combinations, the read strip scrolls sideways when its cells do not fit and **the page itself never scrolls sideways** | PASS | RUN:frontend.build_cmd,RUN:qa.e2e,RUN:qa.browser_observation |
| The suite's **executed** case list, captured before GATE Q, names every width × scheme combination rows 49 and 50 claim; a combination claimed but not executed is a FAIL of this row, not a PASS of the row that claimed it | PASS | RUN:qa.playwright_list,RUN:qa.e2e |
| **In light mode at 393 and 1280, the hero field renders on the active scheme's panel surface; no background fill is scheme-invariant** — **DELEGATED (P5)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| No surface this phase creates renders a hardcoded, scheme-invariant background or text colour — **DELEGATED (P5)** | PASS | RUN:frontend.test_cmd,RUN:qa.browser_observation |
| The masthead's one primary action and the brief's "Review simulated trade" both open the one shared `TradeEntryDialog`; no second entry component exists and nothing reaches a real order path | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| `git diff --name-only <merge-base>..HEAD -- apps/api` returns zero lines, and `opportunity_score` / `opportunity_tier` / `state_fingerprint` are byte-identical | PASS | RUN:qa.git_diff,RUN:qa.interface_conformance |
| `npm run typecheck` exits 0, recorded separately from `nx test`'s exit code | PASS | RUN:qa.typecheck,RUN:frontend.test_cmd |
| Every gate this phase lands is proven by a poison run that goes red, and each poison proof is itself proven non-vacuous | PASS | RUN:qa.mutation_poison,RUN:frontend.test_cmd |
| With the readiness gate reporting no fresh edge **and** a produced read on screen (`requestState: 'no_edge'`, `resultState ≠ null`), the gate note and its `Ask anyway` control render **in body, beneath the read**, and the read stays present and readable — the note never replaces it and the panel is never rendered as an ordinary fresh read — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation,RUN:qa.mutation_poison |
| The composing quiet-gate note renders **no** Mono `no_trade` stance line while a verdict is mounted; that literal renders only in the idle arm, where the verdict slot is empty. Neither the idle arm nor the composing arm is identified by the shared gate-note string alone — each is keyed on its own conjunction (§4.5) — **DELEGATED (P4)** | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |
| The term-structure strip cell renders `unavailable` when the wire object is absent, `—` when the object is present with fewer than two points, and the wire's `state` label otherwise; it never renders a label derived from the scalar and never a fourth literal | PASS | RUN:frontend.build_cmd,RUN:qa.browser_observation |

SUMMARY: 59 PASS / 1 FAIL / 1 UNVERIFIABLE
GATE Q: FAIL

---

## Amendments bounced to Frontend

| AC | Expected | Actual | Owner |
| --- | --- | --- | --- |
| 30 — the verdict word is the only element in the panel spending amber as text, in every state; the only non-text amber permitted anywhere in the panel is the authored `:focus-visible` ring and the in-flight progress indicator while a request is actually running — a colour census of the panel finds no third (DELEGATED P2, SB) | A DOM colour census of `[data-testid="ai-rec-panel"]` finds amber (`primary.main`) on the verdict word as TEXT only, and no non-text amber other than the focus ring and the in-flight indicator. | The TEXT half holds in every state observed (dark and light): the sole amber text node is `decision-verdict-word` in the produced-trade state, zero elsewhere. The NON-TEXT half does not: a token-exact census finds a third, fourth, fifth and sixth non-text amber — `variant="contained"` primary CTA fills at `rgb(242,169,59)` dark / `rgb(197,127,25)` light on `Analyze current snapshot` (idle), `Review simulated trade` (produced trade), `Sign in to ask AI` (signed out) and `Open AI providers in Settings` (add-a-key). None is the focus ring; none is the in-flight indicator. Independently, no shipped assertion covers the non-text half at all: `readLayout.render.spec.tsx:84` `amberBearingTexts()` scans `color:` bindings only, so the census row 30 names does not exist in the suite — a `test (SB)` row with no automation for one of its two clauses. `DecisionCard.tsx:487-495` records the exemption as the lane's own reading; SPEC §4.5 (P2) closes the non-text list at exactly two and SPEC §3 restates row 30 as unconditional, so the exemption is not granted by the contract. | Frontend |

## Verification notes

**How this pass was run.** Production build (`nx build @convexa/dashboard --configuration=production`,
exit 0) served by `http-server apps/dashboard/dist` on a freed port; every criterion below was
observed in a real Chromium via an independent Playwright harness written for this pass — the build
lane's e2e helpers were not imported. Scenario matrix: live stream · payload-gap drop (`page.clock`
past `STREAM_OFFLINE_MS`) · session-tape replay · live-to-replay transition · symbol change ·
no-stream-fact · live-stream-without-mid · market closed · all-levels-null bundle · thin
term-structure bundle · full off-exchange bundle · eight AI-panel states · dark and light · 393 /
834 / 900 / 1280.

**AC 46 — UNVERIFIABLE, precise blocker.** The bottom sheet re-declares `containerName: panel` at its
own root inside the portalled Drawer (observed at 393px: two named containers, 393px and 391px wide),
and container stepping is observed working live on the same page (ladder figures step to 17px inside
a 359px named container; read-strip figures to 15px inside 140px named containers). But the sheet
carries the AI read, and the AI read renders **no `FigureCell`** — zero `data-figure-register` nodes
exist inside the sheet in any producible state, so there is no figure inside the sheet whose stepping
can be observed. Declaration: observed. Mechanism: observed. The criterion's own subject: absent.

**AC 28 — PASS with a named deviation.** Term structure renders the wire's `state` (`contango`) and
IV rank renders `band` through a closed lookup, both satisfying both clauses. The **IV skew** cell
renders `+2.4 pts · fear`, where `fear` comes from `skewState(slope)`
(`widgets/_kit/copy.ts:69-73`), a threshold on the scalar — `IvSkewWire`
(`libs/api/src/generated/schema.ts:1533`) carries no label field, so "renders the wire's closed
label" is not satisfiable for skew and "never re-derived from the scalar" is literally violated.
Passed because SPEC §2.4 instructs the strip to carry this shipped behaviour across **unchanged**, and
nothing is raw-dumped — the label is a closed three-member union.

**AC 29 — PASS with a named deviation.** Within `ai-rec-decision-card` the reading order is
`Persona · … -> As of … -> SIMULATED / advisory -> Using your key -> Trade · long`, so the verdict is
the first node of the read's **body** (before `decision-metadata`, `decision-grid`,
`decision-thesis`, `decision-evidence`, `decision-actions` — all confirmed to follow it), not
literally the panel's first content node. A literal reading is self-contradictory against AC 43,
which requires the degraded strip in-body with the read "legible **beneath** it".

**AC 43 — PASS with a named deviation.** The `stale_newer_snapshot` strip is in-body, carries an icon,
is not a footnote, and the read stays present and readable beneath it. Its severity is
`MuiAlert-colorInfo`, not `warning` (`DecisionCard.tsx:345-348` reserves `warning` +
`WarningAmberIcon` for `stale_at_generation`). Passed because SPEC §4.6 states "Stale strips as
shipped"; flagged because canon rule 16 says "stale is a warning strip with the icon".

**AC 53 — PASS with a coverage gap named.** Backgrounds and text in every surface this phase creates
are theme-derived (proved by the light/dark ink read: `246,246,243` vs `11,15,23` at both 393 and
1280). But `hex-discipline.spec.ts:87` matches a `#`-hex regex only, so **`rgba(...)` literals are
invisible to the guard**: `StructureFieldCanvas.tsx:241,244,281` (border + shadow),
`TapePulseStrip.tsx:193` (print flash bars), `WallMagnetView.tsx:90-92,111` are hardcoded and
scheme-invariant. None is a background or text colour, so AC 53 as worded holds — but the
`[theme-token-discipline]` guard has the same shape of blind spot this phase found in
`single-motion-moment.spec.ts`.

**AC 37 — PASS with a note.** All eight powering reasons render eight distinct title+body pairs
(`ai-rec/copy.ts:101-146`), observed live one at a time. CTA labels are shared across three groups
(`Replace key in Settings` x2, `Choose a model` x2, `Open AI providers in Settings` x3); no two
*sentences* collapse, which is the row's non-collapse clause.

**AC 57 — six poisons performed independently by QA, all red.** (1) restoring `?? m.gamma_flip` in
`LiveTape.tsx` gave 2 failures naming `offline-retained` where `offline-bare` was expected;
(2) rendering `'unavailable'` in the empty off-exchange slot gave 4 failures across 2 files;
(3) giving a read-strip cell a live claim gave 15 failures across 3 files (model, DOM census, page
census); (4) collapsing `(no_edge, fresh_trade)` in `readLayoutFor` gave 11 failures across the pure
and full-app suites; (5) removing `&& m.live` from the sweep gate at `paintStep.ts:503` reddened the
`gradientFills` assertion while the `live: true` case stayed green; (6) widening `LiveClaim` back to
`boolean` gave `typecheck` exit 1 with **TS2578** on both `@ts-expect-error` directives, and removing
a *covered* case from `readLayoutFor` while keeping `default` gave **TS2345** naming
`incomplete_trade`. Every poison was reverted and the tree re-verified clean. No
`expect(true).toBe(true)` body exists anywhere in the suite — phase 1's vacuity pattern is absent.

**Suite runs, exit codes read directly.** `nx run-many -t typecheck -p @convexa/dashboard,@convexa/api
--skip-nx-cache` = **0** (fresh, dist/out-tsc/tsbuildinfo deleted first). `nx test
@convexa/dashboard --skip-nx-cache` = **0**, **231 files / 2693 tests**, 0 failures.
`nx test @convexa/api --skip-nx-cache` = **0**, 4 files / 39 tests. `npm run lint` = **0**
(5 pre-existing warnings, 0 errors). `node design/src/verify-tokens.mjs` = **0**.
`npx nx build @convexa/dashboard --configuration=production` = **0**.
`BROWSER_QUALITY_PREBUILD_STATUS=pass nx run dashboard-e2e:e2e --skip-nx-cache` = **0**, **86/86
passed, 0 flaky**, against the built `dist/`.
`npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` from the repo root = **0**,
**86 tests in 7 files**, `desk-and-read.spec.ts` contributing **6**.

**The closer's reported flake is not reproduced, and a different environmental failure is.** The
`app.risk.spec.tsx` 15s timeout the closer recorded did **not** occur in either of QA's two full
runs. QA's **first** full run did fail (exit 1) — on
`chain-archive-object-store.structural.spec.ts`, `Failed to resolve import
"./_mutation_poison_replay_outcome_join.ts?raw"`, a **stale `node_modules/.vite` transform cache**
holding a glob entry for a poison file a previous session deleted. After `rm -rf node_modules/.vite`
that file passes 14/14 and the full re-run is 231/231 green. `--skip-nx-cache` does not clear the
Vite cache — worth adding to the traps list.

**Independent conformance — the build lane's exemption was unnecessary.** BUILD_REPORT V17 recorded
`interface_conformance` as NOT RUN under the `NO_BACKEND_CHANGE` exemption because no backend was
reachable. QA booted the backend the project way (`npx nx serve api`, up on :8000 in ~60s) and ran the
gate against the feature's own `INTERFACE_CONTRACT.md`: **PASS**, live mode, 2/2 endpoints, 19 + 9
required fields present and well-typed. Receipt: `conformance-receipt-qa.json`. There is no builder
receipt to compare against; QA's is the only one and it is green.

**`apps/api` diff, measured four ways.** `git diff origin/main...HEAD -- apps/api | wc -l` = **0**;
`git diff --name-only origin/main...HEAD -- apps/api` = **0 files**; the criterion's own
`git diff --name-only <merge-base>..HEAD -- apps/api` (merge base `07e1e8a6`) = **0**;
`git status --porcelain -- apps/api` = **0**. The two-dot form reports **439 lines** on this branch —
the trap the build report already documents. `opportunity_score` is rendered verbatim
(`readStripModel.ts:126`), `opportunity_tier` likewise, `state_fingerprint` has no production consumer
in the diff; `libs/` is untouched by this branch.

**Criteria-independent Critical sweep (security + integrity), on the changed code.** No Critical
finding. The diff introduces no endpoint, no auth or authorization change (the single `AuthDialog.tsx`
hunk is a border-radius token), no secret handling, no new durable client key
(`[loss-free-durable-migration]` stays disengaged), no injection sink (`dangerouslySetInnerHTML`,
`innerHTML`, `eval`, `document.cookie` all absent from added lines) and no path to a real order —
one `TradeEntryDialog` serves both the masthead action and the brief's `Review simulated trade`,
observed opening the same dialog with different prefills.

**One robustness observation, no criterion attached.** A bundle carrying `gex_spot`, `call_wall`,
`put_wall`, `max_pain` and `gamma_flip` all null throws
`TypeError: Cannot read properties of null (reading 'toFixed')` inside the `structure-field` chunk.
SPEC §5's inner boundary contains it exactly as designed — hero, ladder (5 rows, all the absent
literal), foot, read strip (8 cells) and quiet band all keep rendering — so
`[best-effort-isolated-or-null]` holds. Worth a look before phase 3 promotes more paint paths.

**Environment note for the orchestrator.** Twice during this pass another process on this machine
mutated the working tree underneath QA: a `git checkout` moved HEAD from
`spire/curvature-v2-foundations` to `main` (reflog `HEAD@{0}`), and a later sweep deleted QA's
untracked scratch directory. Both were detected, HEAD was restored to `350ae973` (the SHA this pass
started on), and every observation reported above was re-confirmed on that SHA. No product file was
left modified: `git status --short` is clean apart from this report and the QA receipt.
