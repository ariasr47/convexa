# RESUME — spire/curvature-v2-foundations

## ➡ HANDOVER — to a fresh session on the owner's Mac (written 2026-09-08 on the Windows box)

**Read this first, then the recovery block under it.** Claude's per-machine memory does **not** travel —
this file and its two siblings (`STRUCTURE_HERO_REVIEW.md`, `STRUCTURE_HERO_REPAIR_TASK.md`) are the only
memory the Mac session has. Treat every claim here as a claim: re-verify against `git` before acting.

**Branch state at handover:** `spire/curvature-v2-foundations` at **`aebf7cc7`** plus one `docs(research):`
commit made at handover for the owner's business-review folder (27 files, read-only research, no code).
Pushed to origin; **no PR**; nothing uncommitted. `main` is untouched by this branch's work.

**What just happened (last 24 h):** phase 3 closed at GATE S → owner saw the `/ticker` structure hero
"looks off" → review found it was the plan's placeholder stack and that every phase built v2 vocabulary on
v1 layouts (site-wide survey in `STRUCTURE_HERO_REVIEW.md`) → owner ruled *"just fix the ticker screen
for now"* → one Sonnet repair lane landed it (`57525861..1ac1f339`) → conductor re-verified cold
(typecheck 0 · 239 files / 2,861 tests 0 · lint 0 · e2e `desk|curvature|overflow` 108/108 vs production
build · `apps/api` diff empty) · hero **1,225 → 550 px** at 1280 (design 488).

**The decision waiting for the owner:** extend the same fidelity pass to the **rest of `/ticker`**
(masthead frame · read-strip chrome + an 8th-cell **clip at 1280** · tape-&-plan grid · context-band
grid/density — measured table in the review) — recommended, one Sonnet lane, same rules as
`STRUCTURE_HERO_REPAIR_TASK.md` — or stop at the hero and open phase 4 proper. **Ask; do not start it.**
Then the five cosmetic hero residuals (review § "Repair result") fold into whichever comes first.

**How to boot on the Mac:**
1. `git fetch && git switch spire/curvature-v2-foundations && git status` — expect a clean tree at or after
   the research commit.
2. `node .spire/bin/spire.mjs run tech --provider claude` then `/spire-tech` (cold start) — the conductor's
   boot sequence reads this file as the overlay.
3. Toolchain: Node via nvm (`.nvmrc` / `package.json engines`), `npm ci`, Rust stable for `apps/api`
   (`cargo run -p api-rust -- serve`), `npx playwright install chromium` for e2e. `npm run ports:free`
   is cross-platform (`lsof` on macOS). None of the Windows notes in the global CLAUDE.md (`py -3`,
   nvm-windows PATH, MSYS path mangling, CRLF) apply on the Mac; `python3` is fine.
4. `npm run dev` → `http://localhost:4200/ticker/SPY` needs no account; scanner / positions / alerts do —
   **never create an account or type a password on the owner's behalf**; to *render* those pages for a
   layout check, route `/api/auth/session` to `{ authenticated: true, … }` in Playwright as
   `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:207-218` does (data endpoints then 403 — fine
   for composition, useless for populated states).
5. Design oracle: serve `design/site/` statically (`python3 -m http.server 4310 --directory design/site`)
   and compare `desk.html` etc. at 1280 / 1000 / 393. Regenerate with `node design/src/build.mjs`; never
   hand-edit `design/canvas` or `design/site`.
6. Gates before any "done": `npx nx typecheck @convexa/dashboard --skip-nx-cache`, the dashboard suite
   (delete `node_modules/.vite` if a `_mutation_poison_*` phantom appears), `npm run lint`, and e2e as
   `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e` against the production build after
   `npm run ports:free`. Exit codes, not printed summaries.

**Standing rules that bit this week:** never `git stash`; never a bare `nx format:write` (scope with
`--files`); `apps/api` diff must stay 0 on this branch; `OrderRow.tsx:172` is off-limits (Z-1); no literal
NUL bytes; verify every cited `file:line` with `grep -n` before acting — anchors drifted in every phase;
ask before push / merge / release / deploy / migrations; build lanes on Sonnet, Opus/Fable for
council / skeptic / architecture.

## ⚠ RECOVERY BLOCK — written 2026-09-08 because the owner's session could end abruptly

**Where we are.** Phases 1–3 shipped. After phase 3 the owner looked at `/ticker/SPY` locally and said the
structure widget looked off. Investigation (`STRUCTURE_HERO_REVIEW.md`, this folder) found the hero is the
plan's placeholder stack, 1,225 px vs the design's 488 px, and that the divergence is **systemic**: every
phase installed v2's vocabulary on v1's layouts because no BRIEF/SPEC/QA row ever compared composition to
`design/site/*.html`. Owner ruling (2026-09-07): **"Just fix the ticker screen for now."**

**UPDATE 2026-09-08 — the hero repair LANDED and is verified by the conductor's own runs.** Five lane
commits `57525861 · 9b57e338 · a8f822b1 · 003853cc · 1ac1f339` (17 files, frontend only), all ten task items
done. Conductor re-ran cold: typecheck **0** · dashboard suite **239 files / 2,861 tests, exit 0** · lint **0**
(one pre-existing warning) · e2e `--grep "desk|curvature|overflow"` against the production build **108/108,
exit 0** · `apps/api` diff **empty** · NUL scan clean. Measured hero at 1280: **550 px** (was 1,225; design
488), Magnet view also 550 (no height jump); 1000: 760 px, one column, 5-cell ladder row; 393: 1,041 px, 2×2
ladder; no horizontal overflow, 0 console errors. Pushed to origin as a backup. Residuals recorded in
`STRUCTURE_HERO_REVIEW.md` § "Repair result" — none blocking.

**Open owner question, unanswered when written:** the rest of `/ticker` also diverges (masthead framing,
read strip chrome + an 8th-cell clip at 1280, the tape-&-plan grid, the context-band grid/density — table in
`STRUCTURE_HERO_REVIEW.md` § "The rest of `/ticker`"). Recommended: a second lane for the full ticker page
after the hero lands. **Ask before starting it.**

**Not started, still pending the owner:** phase 4 proper; the `docs/research/…` folder (offered twice for
`docs(research):`, never answered); the canon's Icons-row `U+26A0` question.

**Servers** (kill with `npm run ports:free`, plus `4310` for the static design site): `npm run dev` on
`:4200`/`:8000`; `py -3 -m http.server 4310` from `design/site/`.

---

**Phase 3 of 4 (`curvature-v2-surfaces`) is DONE and closed at GATE S on 2026-09-07 — GATE Q PASS 95/0/0.**
**Phase 2 of 4 (`curvature-v2-desk-and-read`) is DONE and closed at GATE S on 2026-09-05.**
**Phase 1 of 4 is DONE and closed at GATE S on 2026-09-03.**
**Next: phase 4 of 4 — open it at GATE I.** Branch is **pushed to origin as a backup** (owner's call, 2026-09-07) and there
is **no PR** — the owner's call. Everything after the backup push is local; push again before relying on it.

| phase | scope | state |
|---|---|---|
| 1 `curvature-v2-foundations` | tokens, scales, `FigureCell`, connection chip, nav + ⌘K, container panels | **shipped, GATE Q PASS 79/1/1** |
| 2 `curvature-v2-desk-and-read` | desk masthead, structure-field hero, level ladder, read strip, verdict-first AI read, retention latch | **shipped, GATE Q PASS 60/0/1** |
| 3 `curvature-v2-surfaces` | scanner · positions (sim + Broker tab) · settings · alerts **· the eight ticker quiet-band widgets' internals** | **shipped, GATE Q PASS 95/0/0** (pass 4; passes 1–3 FAILed 91/4/0, 93/2/0, 94/1/0). 5 owner rulings D-A…D-E, 2 conductor calls, S2 ×2, 4 GATE Z repair passes |
| 4 | landing · site pages · responsive sweep · the curve text-equivalent · spacing burn-down remainder · **settings section navigation (deferred from phase 3 by owner ruling D-B)** | not started |

**Read before designing phase 4:** `contracts/curvature-v2-surfaces/_MANIFEST.md` — the **GATE S close-out section** is the
most useful page in this branch: the conductor's own final measurements, what the gate caught that three green suites did not,
the regression this phase introduced and fixed, and the process notes. Then `contracts/curvature-v2-surfaces/QA_REPORT.md`
(**all four passes** — the three FAILs are where the value is) and `council/decisions.md` §4 (rulings **D-A…D-E**, each with
its reversal; the two CONDUCTOR calls are the only ones that lapse). `BUILD_REPORT.md` §9 carries the itemized debt with
`file:line` and an owning phase. The AI-powered direction is **PARKED** in `context/BACKLOG.md` (2026-09-06 harvest) with the
verified provider rules and the resume shape — do not re-derive it.

**Phase 4's scope, and what phase 3 handed it:** landing · site pages · responsive sweep · the curve text-equivalent · the
spacing burn-down remainder · **settings section navigation** (owner ruling **D-B** deferred it out of phase 3 — it is a real
scope item with three named behaviours, not leftovers) · the three sub-44px `Select`s on `/ticker` and the 15 `ScanToolbar`
chips (itemized, untouched this phase so out of criterion 66's reach) · the `/positions` condor width tuning at 900px.
**Owner-flagged 2026-09-07, after phase 3 closed — the structure hero does not match the design source:**
`STRUCTURE_HERO_REVIEW.md` (this folder) measures it — 1,225 px tall vs the design's 488 px at 1280, the field
window at spot ±10 % (`chart.tsx:26-27`) leaving the wall span 13 % of the plot, the ladder as five figure
cards instead of `ladder.mjs`'s one-line rows, no axis, no max-pain line, `Levels|Magnet` toggle. Root cause
is `PLAN.md:1205`'s illustrative stack becoming the layout with no composition criterion. **It is systemic, not the hero alone** — the same
file's site-wide survey rates `/positions` and `/alerts` **far** from their design pages and `/scanner` and
`/settings` **partial**; only nav, masthead and the read strip are close. Cause: no BRIEF after phase 1 named a
design screen, no criterion in any phase reads "matches `<screen>.html` at a width", and the canon (`:256` item 7)
calls composition "design intent, not a line-by-line rule". **Phase 4 must carry one composition row per
surface, with the generated design page as the oracle.** Awaiting the owner's call on route.
**Open owner question filed in the canon's Icons row:** does the colour-emoji clause reach `U+26A0` (⚠) in a scanner chip
label (`pages/scanner/labels.ts:196,205,211`), or is it a deliberate third truth mark? Answer it before touching those chips.

**Read before designing phase 3 (kept for provenance):**
`contracts/curvature-v2-desk-and-read/_MANIFEST.md` (gate trail, final measurements, the four defects this
phase found in shipped code, and the carried-debt list with phases attached),
`contracts/curvature-v2-desk-and-read/QA_REPORT.md` (**both passes**), and
`state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` (the seven DELEGATED calls P1–P5, D-14, D-15,
each with its reversal — ratified by the owner's spec approval, and two of them corrected later in the
session when they turned out to be wrong on their facts).

**Phase 3's canon amendment is filed:** rule **13**'s type register now reads "traced to Convexa's computation
**or to a record the trader entered**" (owner ruling **D-D**), so a number the trader typed renders Mono with no dotted rule.
Criterion 7a was amended separately by owner ruling **D-E** at GATE Z — it is a contract row, not canon.

**Phase 2's canon amendments are filed:** rules **11**, **14**, **16** (amber → text-scoped with a closed
three-item non-text list; nine states → **ten**; composition and dispositions), and **17** (tense only).
The `tooltip` z-rung is deliberately **not** amended — `theme.ts:83` already ships a working, consumed
value of **60**, and the gap is in the canon's prose, not the code.

**The traps that cost the most time, so phase 4 does not re-chase them:**
1. A stale `node_modules/.vite` glob transform holding a deleted `_mutation_poison_*` file produces a spurious
   suite failure that **`--skip-nx-cache` does not clear**. It bit again in phase 3, including one of QA's own runs.
   Delete `node_modules/.vite`.
2. **The local e2e run silently falls through to the Vite dev server** unless invoked as
   `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e` from the repo root, because `process.env.CI` is unset
   outside CI. `broker-grouping.spec.ts` fails ~74/75 on dev and passes against the production build.
3. **The browser-quality manifest is four files that must move in lockstep** with the e2e case count, or passing tests
   report `"status": "incomplete"`.
4. **The IDE's diagnostics were wrong on every lane's tree this phase** — dozens of phantom errors on trees that
   cold-typecheck at exit 0. The cold exit code is the only evidence.
5. **Verify every cited line number and path with `grep -n` before acting on it.** Anchors drifted repeatedly, in both
   directions: lanes corrected the conductor twice, and QA corrected the conductor once.

---

# RESUME — spire/curvature-v2-foundations (2026-09-03)

**Resume status:** ACTIVE — **phase 2 closed at GATE S 2026-09-05; the next step is phase 3.**  
**Written:** 2026-09-03 (GATE R, phase 1 closed at GATE S — a clean phase boundary, not a mid-build checkpoint)

Written at GATE R for a **fresh session on another machine**. Self-contained against `PROJECT_CONTEXT.md`.
Boot with `/conductor`; this file is the overlay.

## Objective

Build **Curvature Terminal v2** — the owner-approved site-wide redesign — in **four phases**, through the
spire council pipeline (owner chose the pipeline over a direct branch build, 2026-09-03).

**Phase 1 of 4 is DONE and closed at GATE S.** Phases 2–4 are unstarted.

| phase | scope | state |
|---|---|---|
| 1 `curvature-v2-foundations` | tokens, scales, `FigureCell`, connection chip, nav + ⌘K, container panels | **shipped, GATE Q PASS** |
| 2 | desk hero + level ladder + read strip + **verdict-first AI read brief** | not started — *this is the owner's original loudest complaint* |
| 3 | scanner · positions · settings · alerts | not started |
| 4 | landing · site pages · responsive sweep (adds 834 to the overflow suite) | not started |

## Done (7 commits on this branch, pushed, **no PR**)

`ccea723` canon re-baseline · `4231e13` the `design/` source · `2fb26d9` council output · `e5b132b` adapter
receipt · `404f814` **the phase-1 build** (134 files) · `e94343c` pipeline records · `770d547` canon
amendments + ledger.

Design canon is `SET — Curvature Terminal v2` (`context/DESIGN_SYSTEM.md`). `docs/design/DESIGN_SYSTEM.md`
is a pointer stub. `design/` holds the canvas + static site + `library.html` + the verified token mirror;
regenerate with `node design/src/build.mjs`, never hand-edit `design/canvas` or `design/site`.

## Verified final state (the conductor's own runs, not the lanes')

typecheck 0 · dashboard suite 0 @ **215 files / 2376 tests** · lint 0 · e2e 0 @ **75/75 against the
production build** · `node design/src/verify-tokens.mjs` 0 · `contract_lint` 0 errors · `apps/api` diff
**0 lines** · all 32 council conflict ids re-derive from the live R2 bytes.

## Next concrete step

Open **phase 2** at GATE I: write `.spire/clusters/tech/contracts/<phase-2-feature>/BRIEF.md` (format:
`ORCHESTRATOR.md` §4a; fill `Considered:` with the real cull set), then `/council <feature>`.
**Read `contracts/curvature-v2-foundations/council/decisions.md` first** — eight owner rulings, several
of which bind later phases.

## Owed to phase 2 (carried, do not rediscover)

1. **The `LiveTape` last-non-null retention latch** and a test that a latched value is **not** re-flashed
   (owner ruling 2). `useFlashOnChange.ts:44` writes `prev.current` *before* its null guard, so a drop
   destroys the last value — retention is a real mechanism, not wiring. Clear the latch on symbol change
   and on replay arm.
2. `design/src/verify-tokens.mjs`'s structured checks cover only the **10 v1 tokens**, not the 7 v2
   additions — its exit 0 does **not** prove the mirror matches for `steel2` et al.
3. The spacing exemption list's burn-down (fenced with an expiry by owner ruling 4).
4. The itemized 44px carried debt — `BUILD_REPORT.md` §4, `file:line`, phase attached.
5. **Open owner question:** the undeclared `tooltip` z-rung (canon declares six rungs, MUI has eight;
   `tooltip` defaults to 1500, above every v2 rung).

## Gotchas this phase paid for — do not relearn them

- **A fully green suite is not evidence of correct behaviour.** GATE Q #1 FAILed 72/8/1 while typecheck,
  2353 tests, 75/75 e2e and lint were all green: `[live-vs-static-isolation]` was broken because two
  predicates answered "is this live?". The census test that would have caught it had never been written.
  Ledger key `one-liveness-predicate`.
- **`apps/dashboard-e2e/playwright.config.ts` is an explicit `testMatch` allowlist.** A new spec file not
  added to it never runs and reports green. Prove execution with `--list`.
- **`borderRadius: n` in `sx` means n × `shape.borderRadius`**, not n pixels. Changing `shape` moves every
  numeric site by that ratio.
- **`type-floor.spec.tsx:39` returns only the first rule bearing a class** — structurally blind to
  `@container` blocks; it would pass with them deleted.
- **jsdom does not evaluate container queries.** AC-20b is honestly UNVERIFIABLE (both `FigureCell`
  consumers are `span={2}`, so no wide/narrow panel pair exists to compare). Do not convert it to a PASS.
- **The e2e dev-server flake is real and diagnosed:** `broker-grouping.spec.ts` fails ~74/75 on the Vite
  dev server (`net::ERR_ABORTED`, a navigation race) and passes 75/75 against the production build. Run
  e2e against the production build. `npm run ports:free` first, always.
- **Two tests once shipped with `expect(true).toBe(true)` under a "MUTATION PROOF" heading.** Ledger key
  `a-proof-must-be-able-to-fail`: where a guard is compile-time, prove it with `@ts-expect-error`
  (TS2578 fires if the error stops occurring), never a runtime `expect`.

## Not committed, deliberately

`.claude/launch.json` (CLAUDE.md forbids a hand-maintained copy — generate from `project.json` on demand)
and `convexa-api-contract-candidate-*.ok` (generated cache marker; one is already wrongly tracked on
`main`, and `spire/repo-hygiene-2026-09` fixes the cause).
