# RESUME — spire/curvature-v2-foundations

**Phase 2 of 4 (`curvature-v2-desk-and-read`) is DONE and closed at GATE S on 2026-09-05.**
Branch has **not** been pushed and there is **no PR** — that is the owner's call.

| phase | scope | state |
|---|---|---|
| 1 `curvature-v2-foundations` | tokens, scales, `FigureCell`, connection chip, nav + ⌘K, container panels | **shipped, GATE Q PASS 79/1/1** |
| 2 `curvature-v2-desk-and-read` | desk masthead, structure-field hero, level ladder, read strip, verdict-first AI read, retention latch | **shipped, GATE Q PASS 60/0/1** |
| 3 | scanner · positions · settings · alerts **· the eight ticker quiet-band widgets' internals** | not started |
| 4 | landing · site pages · responsive sweep · the curve text-equivalent · spacing burn-down remainder | not started |

**Read before designing phase 3:**
`contracts/curvature-v2-desk-and-read/_MANIFEST.md` (gate trail, final measurements, the four defects this
phase found in shipped code, and the carried-debt list with phases attached),
`contracts/curvature-v2-desk-and-read/QA_REPORT.md` (**both passes**), and
`state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` (the seven DELEGATED calls P1–P5, D-14, D-15,
each with its reversal — ratified by the owner's spec approval, and two of them corrected later in the
session when they turned out to be wrong on their facts).

**Phase 2's canon amendments are filed:** rules **11**, **14**, **16** (amber → text-scoped with a closed
three-item non-text list; nine states → **ten**; composition and dispositions), and **17** (tense only).
The `tooltip` z-rung is deliberately **not** amended — `theme.ts:83` already ships a working, consumed
value of **60**, and the gap is in the canon's prose, not the code.

**The one trap that cost the most time this phase**, so phase 3 does not re-chase it: a stale
`node_modules/.vite` glob transform holding a deleted `_mutation_poison_*` file produces a spurious
suite failure that **`--skip-nx-cache` does not clear**. Two build lanes misattributed it to
`pos-params` / `aiProviders` / `app.risk`, which run 5/5 green. Delete `node_modules/.vite`.

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
