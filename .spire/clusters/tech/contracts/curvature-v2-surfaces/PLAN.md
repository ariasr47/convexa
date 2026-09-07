# curvature-v2-surfaces — implementation plan

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-surfaces/SPEC.md` (**approved** — owner, 2026-09-06, option A; **not editable here**)
**Interface:** `.spire/clusters/tech/contracts/curvature-v2-surfaces/INTERFACE_CONTRACT.md` (posture `NO_BACKEND_CHANGE`, measured **three-dot**)
**Council:** `council/decisions.md` (four OWNER rulings D-A/D-B/D-C/D-D · two CONDUCTOR calls, both reversible · 11 technical conflicts settled 22/22 CONVERGE) · `council/S2-findings.md` (both passes) · `council/R3-architect-addendum.md` (the `retained` predicate; the `AccessibleHelp` promotion)
**Prior rulings that bind:** `contracts/curvature-v2-foundations/council/decisions.md` — phase 1's eight owner rulings; **ruling 6 names this phase's quiet-band work and freezes those widgets' layout**
**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET**)

**Baseline (the conductor's own runs, `spire/curvature-v2-foundations` @ `dd1326d9`, exit codes checked — restate it in the build report, do not re-derive it):**
`npm run typecheck` **exit 0** · `npm run lint` **exit 0** ·
`npx nx test @convexa/dashboard --skip-nx-cache` **exit 1 at 2691 / 2694** — three **load** timeouts
(`app.risk.spec.tsx` "/\_ops/metrics renders WITHOUT the trader shell"; `orders.risk.spec.tsx`
`act_confirm_live_cross_fill…` and `cancel_is_terminal…`) that **pass in isolation at exit 0, 31/31** ·
`git diff --stat f8957d3f..HEAD -- apps libs` **empty** ·
**e2e NOT RUN at baseline** (phase 2 closed it at **86/86** against the production build).

> **Read this before reporting anything green.** The baseline suite exits **1**. A run that exits 1 at
> 2691/2694 with those three files is **at baseline** — prove it the way the conductor did (re-run those
> two files in isolation, record 31/31 exit 0). Any *other* failure is a real one.

---

## STATUS — nothing is re-litigated, and no criterion was found unplannable

The spec is approved; four owner rulings and two reversible conductor calls are settled. This plan
implements them and re-opens none. **All 95 criteria are planned; there is no GATE Z bounce.** Phase 2's
planner bounced its criterion 16 because the app could not produce the state the row demanded. Every
criterion here was checked against the tree and is reachable. Two **scope readings** are recorded
instead — each is a reading of the spec's own words, each carries its reversal, neither is silent.

## GATE Z WATCH — two scope readings the conductor should confirm before the lane starts

**Z-1 — `features/trading/orders/OrderRow.tsx:172` carries a `⏸` and renders on BOTH surfaces.**
Measured: that line renders `to trigger · ⏸ offline`; `OrderRow` is mounted by `OrdersPanel.tsx:150`
(*"the Positions-page management home … rendered INSIDE the Simulated tab"*, `OrdersPanel.tsx:2`, wired
at `PositionsPanel.tsx:116`) **and** by `OrdersWidget.tsx:161,183`, which `TickerDashboard.tsx:611`
mounts on the ticker desk. Under the widest reading, criterion 29 (SB, *"no `⏸` survives in any
positions source string"*) would force a change to what the **desk** renders — which **D-C** forbids in
terms (*"the ticker desk is reopened for this single shared-frame change and nothing else — no desk
layout, copy, state or spec content changes"*). Two SB requirements would contradict.
**Reading taken:** SPEC §1 scopes the surface as *"Positions (sim book + Broker tab + header readout)"*
and §3 C is headed the same way; the orders panel is a fourth surface the spec never names. Criterion 29
therefore binds `features/trading/positions/`, `features/trading/broker/` and `pages/positions/`, and
`OrderRow.tsx:172` is **out of scope**, booked as carried debt with `file:line` and a phase (FE-14 item
7). D-C's fence is untouched. **Reversal:** the conductor rules orders *is* a positions surface → 29 and
D-C collide and that **is** a GATE Z question for the owner, not a lane decision.

**Z-2 — one `⏸` lives inside a frozen positions tooltip sentence, where an icon cannot render.**
`features/trading/positions/labels.ts:57` (`SESSION_DELTA_TIP`) reads *"…and **freezes (⏸)** while the
feed is offline…"*. It is a plain `string` used as a MUI `Tooltip` title, so the stroke icon cannot be
substituted into it. Criterion 29 (SB) wants the glyph gone; CF-2 (SB) freezes positions tooltips.
**Reading taken:** §2.7's permitted class **(1)** is *"replacing a typographic truth mark (`⏸`) with the
declared stroke icon"*; the parenthetical is exactly such a mark and the sentence's meaning survives
without it. FE-5 deletes the three characters ` (⏸)` and **changes nothing else in that sentence**, and
itemizes it in the build report. `SESSION_DELTA_TIP` is **not** one of the three literal tips U-15
freezes. **Reversal:** class (1) does not reach a sentence → the glyph stays, the scan carries one named
live-checked exemption with `labels.ts:57` attached, and the residual is GATE Z debt.

---

## Goal

Carry Curvature Terminal v2 onto **scanner · positions · settings · alerts** and the **eight ticker
quiet-band widgets**, so the type register, the closed nine-member not-a-number vocabulary and the one
liveness answer become properties of the **app** rather than of the ticker desk — with `apps/api`
byte-frozen and the empty diff measured three-dot.

## Architecture shape

Everything ships inside `apps/dashboard` (React 19 + Vite + MUI v9/Emotion, Vitest + jsdom + Testing
Library) plus `apps/dashboard-e2e` (Playwright). **The decision travels, not the component:** the whole
F1–F9 branch of `FigureCell` (`FigureCell.tsx:250-300`) moves to a pure `shared/figure/figureState.ts`
plus `shared/figure/FigureMarks.tsx` (the two module-private marks become named exports) plus
`shared/figure/figureFace.ts` (the one face binding outside `shared/theme/tokens.ts`). `FigureCell`
imports them back and keeps its card, its 20/17/15 ladder and its `data-figure-state` on the card root.
The scanner atoms, the positions row cells, the Broker tab's cells and the two mono-run quiet-band
widgets consume the **module**, never the card; the positions header readout keeps `FigureCell` itself
inside its own `PanelContainer`. `Widget.tsx`'s `info` becomes the one shipped focusable-help pattern at
its single render site, fixing all eight `<Widget info=…>` sites by construction, with `AccessibleHelp`
promoted into `shared/ui/` in the same change so `shared/` never imports from `pages/`.

## Tech stack this plan binds

`@mui/material ^9.2.0` (`theme.containerQueries('panel')`, `extrasFor(theme)`, the theme-level
coarse-pointer 44px floor at `theme.ts:132-137`, `shape.borderRadius = 12`) · `react ^19.2.8`
(`useSyncExternalStore` in `alerts/store.ts`) · `vitest ~4.1.10` (jsdom; the `?raw` `import.meta.glob`
scan idiom; `renderHook`; fake timers) · `@playwright/test ^1.62.1` (chromium; `testMatch` is an
explicit **allowlist**) · `@convexa/api` generated wire types (`libs/api/src/generated/schema.ts`).

---

## Global constraints

1. **`NO_BACKEND_CHANGE`, three-dot.** `git diff origin/main...HEAD -- apps/api` returns **zero lines**
   (criterion 67, SB); `opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical.
   **No task below writes under `apps/api`.** Three-dot is the contract, not two-dot.
2. **Check EXIT CODES, never printed summaries.** PowerShell `$LASTEXITCODE`; Git Bash `echo $?` /
   `${PIPESTATUS[0]}`. A suite once printed `1004 passed` while exiting non-zero.
3. **`nx test` green does NOT mean the types are sound.** `npm run typecheck` exit 0 is recorded
   **separately** at every claim of done (criterion 68, SB). It is the only thing that sees the
   `LiveClaim` brand and criterion 2's required-`register` poison.
4. **Never a bare `nx format:write`** — one bare run reformatted **92** unrelated files. Always
   `npx nx format:write --files <a>,<b>`.
5. **A stale `node_modules/.vite` glob transform holds a deleted `_mutation_poison_*` file, and
   `--skip-nx-cache` does NOT clear it** (phase 2's most expensive trap). Poison **in place** with the
   Edit tool and revert; if a poison will not go red, or a red will not clear, delete
   `apps/dashboard/node_modules/.vite` and the workspace `node_modules/.vite`.
6. **The e2e quality reporter is CWD-dependent** — `playwright.config.ts:45` writes a repo-root-relative
   path. Run Playwright from `C:\Dev\convexa`.
7. **`npm run ports:free` before any run-the-app verification** (sweeps 8000/4200/4300 on **both**
   address families). e2e runs against the **production build**, never the dev server.
8. **NUL bytes make a file BINARY to git and grep.** Never write a literal NUL. Verify by byte scan:
   `py -3 -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"`.
9. **Never `git stash`** — it captures the whole tree and another lane may hold uncommitted work.
10. **Scripted `sed`/`node` replaces silently no-op on CRLF files.** Use the Edit tool and
    **grep-verify after every scripted edit**.
11. **Stale `tsc --build` outputs produce phantom TS2353/TS6305** — delete `apps/dashboard/dist`,
    `out-tsc`, `apps/dashboard-e2e/out-tsc` and every `*.tsbuildinfo`, rebuild `tsconfig.app.json`
    **before** `tsconfig.spec.json`.
12. **Pins are re-pointed, never deleted**; every exemption list keeps its live-check so a stale entry
    red-builds.
13. **Mutation proofs are part of done** (criterion 69, SB): poison what the rule forbids, the build
    goes red, **and the poison test is itself proven non-vacuous**. Phase 1 shipped two
    `expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading — every proof below says how the
    test *fails* and what output to record.
14. **No new durable client key and no new persisted preference.** Any converted surface that wants one
    is a GATE Z bounce, not a lane decision.
15. **Conformance spec** — copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec`. Both
    lanes inherit this shape:

> ## Conformance spec
>
> Machine-checkable. `interface_conformance.mjs` runs this against the live backend at G1. It pins the
> existing wire this frontend-only phase binds to, so a silent field rename or a nullability change is
> caught before GATE Q rather than as a blank column on `/scanner` or a dead mark on `/positions`.
>
> **Endpoint order is load-bearing, not cosmetic.** `/api/scan` runs first because it is the read this
> phase's headline criteria depend on and it is answerable without any prior fetch. `/api/ticker/{ticker}`
> follows and is pinned only at its structural spine — its full field list belongs to phase 2's contract
> and is not duplicated here.
>
> ```json
> {
>   "endpoints": [
>     {
>       "method": "GET",
>       "path": "/api/scan",
>       "path_params": {},
>       "query": {},
>       "required": {
>         "view": "object",
>         "view.source": "string",
>         "view.authenticated": "boolean",
>         "view.density": "string",
>         "view.sort": "object",
>         "view.sort.key": "string",
>         "view.sort.dir": "string",
>         "sweep": "object|null",
>         "rows[].symbol": "string",
>         "rows[].status": "string",
>         "rows[].as_of": "number",
>         "rows[].price": "number|null",
>         "rows[].chg_pct": "number|null",
>         "rows[].score": "number|null",
>         "rows[].tier": "string|null",
>         "rows[].regime": "string|null",
>         "rows[].vol_regime": "string|null",
>         "rows[].flip": "number|null",
>         "rows[].call_wall": "number|null",
>         "rows[].put_wall": "number|null",
>         "rows[].dist_to_flip_pct": "number|null",
>         "rows[].dist_to_wall_pct": "number|null"
>       }
>     },
>     {
>       "method": "GET",
>       "path": "/api/ticker/{ticker}",
>       "path_params": { "ticker": "SPY" },
>       "query": {},
>       "required": {
>         "market_state": "object",
>         "market_state.price": "number|null?",
>         "signals": "object",
>         "signals.opportunity_score": "number|null?",
>         "signals.opportunity_tier": "string|null?"
>       }
>     }
>   ]
> }
> ```
>
> **What this block buys, stated exactly, so no reader trusts it for more than it checks.**
>
> - **Checked outright:** that `/api/scan` still answers `200` **without a session** and still returns a
>   `view` **object** with its `sort` sub-object, and that `/api/ticker/{ticker}` still returns
>   `market_state` and `signals` **objects**. Those are the structural spines the scanner table and the
>   positions marks hang on.
> - **Checked per row:** every `rows[].*` field is type-checked on **every** row the sweep returns. A
>   rename (`chg_pct` → `change_pct`), a flattening, or a nullability tightening on any of the eleven
>   columns is a FAIL — and each of those is a column that would otherwise go blank or silently lose its
>   absent-value path.
> - **Known limit, named rather than hidden:** the row fan-out proves nothing when `rows` is **empty**.
>   An empty `rows` array is a legitimate state (a caller whose view holds no symbols), so this block
>   cannot double as a data-presence check. SPEC §3 criterion 62 closes that hole on the side that
>   matters — the e2e run is required to **seed a non-empty scan** and a non-empty alerts blob before it
>   measures overflow, precisely because the shipped suite measures empty pages today.
> - **Not caught by these pins:** a rename of an **optional** field on the ticker bundle — it reads as
>   absence, which is a legal state there. That residual is closed elsewhere: `apps/api` is byte-frozen
>   for this phase (criterion 67, proved by an empty three-dot diff), so no rename can originate here;
>   and every field above is consumed through the generated wire types in
>   `libs/api/src/generated/schema.ts`, so a rename landing from a later backend phase is a **compile
>   error** caught by `npm run typecheck`, which criterion 68 already requires with its exit code
>   recorded separately.
> - **Not checked at all, by design:** both SSE streams (the runner does not read event streams), the
>   mutating `PUT /api/scan/view`, and the two `/api/broker/*` reads (session-bound and
>   credential-bound; see the table above).
>
> No field above is new; nothing here authorises a backend edit. If the runner cannot reach a live
> backend, this is a `NO_BACKEND_CHANGE` feature and the exemption stands — record it as such rather
> than inventing a sample pass.

---

## Per-task cycle (every task below)

Write the failing test → run it, **watch it fail and record the failure text** → implement minimally →
run it, watch it pass and **record exit 0** → `npx nx format:write --files <changed>` → **commit**.

**Lanes commit per task, at minimum** — commit at every green step inside a task if you can, and never
carry more than one task's worth of uncommitted work. Phase 2 lost a lane to a rate limit mid-task; a
killed lane must cost one task, not the phase. Conventional commits with a scope
(`feat(dashboard):`, `fix(dashboard):`, `refactor(dashboard):`, `test(dashboard):`).
**If a step contradicts the tree, report the conflict; do not resolve it silently.**

**Model:** every task defaults to **Sonnet** (`spire-tech-frontend`). **FE-1 is the one task that
warrants Opus** — it is the phase's single point of failure (§2.1: done as a *copy* rather than a
*move*, the two copies drift and the phase **creates** the inconsistency it exists to close), it edits a
primitive sixteen shipped desk call sites depend on, and it authors both mutation-proved needles.

## The six traps already paid for — do not rediscover them

| # | Trap | Where it bites |
|---|---|---|
| T1 | `playwright.config.ts:30-38` is an explicit `testMatch` **allowlist** of seven specs; an unregistered spec **never runs and reports green** (criterion 63). | FE-13 — `curvature-v2.spec.ts` and `no-overflow.spec.ts` are already listed, so **extend those two**. A new file's name goes in the **same commit**, proved with `--list`. |
| T2 | A stale `node_modules/.vite` glob transform holds a deleted `_mutation_poison_*`; `--skip-nx-cache` does **not** clear it. | Every `?raw` poison — FE-1, FE-2, FE-5, FE-11. Poison in place, revert; if it misbehaves, delete `node_modules/.vite`. |
| T3 | The e2e quality reporter writes a repo-root-relative path (`playwright.config.ts:45`). | FE-13 — run Playwright from `C:\Dev\convexa`. |
| T4 | `no-overflow.spec.ts`'s `seed()` (`:520-547`) takes `{ scheme, positions }` **only**, so `/alerts` is measured **empty** and `/scanner` with a possibly-zero row count. | FE-13 step 1 — the seeding work is **required**, not optional (SPEC §7, §9 item 2). |
| T5 | `scanner.risk.spec.tsx:869` pins `/Prices (live\|offline)/` and the test renders the **offline** arm, so the D-A header edit may leave it **GREEN**. | FE-4 — do not assume it reds. Run it, record which, then pin **both** arms. |
| T6 | `theme.ts:132-137` already floors `button, [role="button"], a` at 44×44 under `@media (pointer: coarse)`. | Criterion 66 — the promoted `AccessibleHelp` is a real `<button>` and inherits the floor, which is why §2.8's *"the component itself is untouched"* and 66 do **not** collide. Measure it; do not restyle it. |

---

# Backend track

The backend lane implements **zero product code**: `NO_BACKEND_CHANGE` makes its whole job the empty
diff, score identity and the receipt. Stated rather than padded with invented work.

## BE-1 — Empty three-dot diff · score identity · conformance receipt (**backend closer**)

**Owns:** `.spire/clusters/tech/contracts/curvature-v2-surfaces/conformance-receipt.json`
**Depends on:** — · **Independent:** no (sole backend task; it is the closer) · **Criteria:** 67 (SB)

1. **Empty diff, three-dot, count reported.** Two-dot would also report work that landed on
   `origin/main` after this branch started and would fail a clean lane for someone else's commits.
   ```bash
   cd /c/Dev/convexa
   git diff --name-only origin/main...HEAD -- apps/api > /tmp/api-diff.txt; wc -l < /tmp/api-diff.txt
   test "$(wc -l < /tmp/api-diff.txt)" -eq 0; echo "criterion-67 exit=$?"
   ```
   Expected `0` files, `exit=0`. **A non-zero count is a STOP** — report it; never revert another lane's
   work to make it pass.
2. **Score identity.** With the diff empty, the evidence is one bundle read captured **before FE-1** and
   one **after FE-13**, same ticker, both verbatim in the build report:
   `npm run ports:free && npx nx serve api &` then
   `curl -s localhost:8000/api/ticker/SPY` → record `signals.opportunity_score`,
   `signals.opportunity_tier`, `ai_eval.state_fingerprint`. Different strings **with an empty diff**
   means the vendor snapshot moved — re-run both inside one 60s cache window and say so.
3. **Receipt.**
   `node .claude/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/curvature-v2-surfaces/INTERFACE_CONTRACT.md --url http://localhost:8000 --report .spire/clusters/tech/contracts/curvature-v2-surfaces/conformance-receipt.json`
   → `2 endpoint(s)`, exit **0**, `/api/scan` **first** (order is load-bearing). If no backend is
   reachable, record `NOT RUN — no reachable backend, NO_BACKEND_CHANGE exemption`
   (`[local-evidence-is-not-hosted-evidence]`). **Never invent a sample pass.**
4. `npm run ports:free` before leaving — an orphan on :8000 serves stale code into the next lane.

**Reviewer probe:** does the receipt's endpoint array match the block above **in order**, and does every
`rows[].*` pin still carry `|null` on the eleven nullable columns? An unmarked pin FAILs every run
against a symbol whose sweep holds no wall.

---

# Frontend track

Fourteen tasks, strictly ordered. **FE-1** is the spine; **FE-2** the liveness fence; **FE-3/4** the
scanner; **FE-5/6/7** positions, the header readout and the Broker tab; **FE-8** settings; **FE-9/10**
alerts; **FE-11** the quiet band; **FE-12** D-C's shared-frame change; **FE-13** the browser layer;
**FE-14** the closer.

## FE-1 — `shared/figure/`: the F1–F9 branch, the two marks, the one face, and N-1's two needles

**Owns:** new `apps/dashboard/src/app/shared/figure/{figureState.ts,FigureMarks.tsx,figureFace.ts,index.ts,figureState.spec.ts}` · `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx` · `apps/dashboard/src/app/shared/theme/fonts.spec.ts`
**Depends on:** — · **Independent:** no · **Spec:** §2.1, §2.3, §5 last bullet, §7 inv. 1–3
**Criteria:** 1 (SB, mechanism), 2 (SB), N-1 (SB); the host for 3, 4, 12, 13, 27a, 27b, 28, 29, 35e, 53, 54
**Specs added:** `shared/figure/figureState.spec.ts`. **Specs edited:** `shared/theme/fonts.spec.ts`
(append one `describe`; the shipped `RETIRED_FACES` block is untouched). **Expect zero desk-spec edits.**
**Commit boundary:** one commit per step 1–4, one for step 5, one for step 6. Do not leave the tree with
the marks moved but `FigureCell` not re-pointed.

**Why one task (SPEC §5).** *"The module extraction, the `FigureCell` re-import of the two marks and the
`?raw` scan's two needles land in **one** change."* **Why a MOVE, not a COPY (§2.1's named risk):** two
copies drift and the phase creates the inconsistency it exists to close. `FigureCell` must end this task
with **zero** local state logic and **zero** local face literal.

1. **`figureFace.ts`** — the only face binding outside `shared/theme/tokens.ts`. Exports
   `MONO_FACE = { fontFamily: typographyTokens.monoFontFamily, fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }`,
   `SANS_FACE = { fontFamily: typographyTokens.fontFamily }`,
   `UNTRACED_RULE = { borderBottom: '1px dotted', borderColor: 'text.secondary' }` and
   `faceFor = (mono: boolean) => (mono ? MONO_FACE : SANS_FACE)`. Plain objects consumers spread into
   their own `sx` — **the ladder does not travel** (§2.1): a 12px list row keeps 12px, a table cell keeps
   `fontSize: 'inherit'`; 20/17/15 and the fixed 15px literal size stay `FigureCell`'s panel-scale
   constants.
2. **`figureState.ts`** — pure, no JSX. Move `FigureCell.tsx:250-300` **verbatim in behaviour** into
   ```ts
   figureStateOf({ value, register, live, offline, replay, caption, assertedBy })
     → { figureState, isLiteral, mono, isFigure, dim, untraced, showDot, showPause, caption }
   ```
   the signature **both lanes signed** (§2.1; `decisions.md` §3 #0+#16). `figureState` is one of the nine
   shipped names (`default · loading · live · offline-retained · offline-bare · replay · empty ·
   unavailable · untraced`). `dim` (from `:266,275`) and `untraced` (`:294`) are included **deliberately** —
   without `dim` the scanner's retained arm has no reduced-emphasis output at all. The four captions are
   the **shipped strings verbatim, not re-authored**: `offline · last known` (`:262`), `offline` (`:271`),
   `session replay` (`:282`), `${assertedBy} · untraced` (`:293`), with the shipped
   `'AI-stated · untraced'` fallback. Offline/replay captions **override** the caller's `caption`
   (shipped precedence `:253,262,271`). `live` keeps the **`LiveClaim` brand** (`liveClaim.ts:23-29`) so
   the extraction is not a back door around the one-mint rule — a scanner caller holds no `LiveUpdate`
   and can pass only `NOT_LIVE`. `register` stays **required, no default** and is **ignored on a
   literal** (`:284-288`, AC-19).
3. **`FigureMarks.tsx`** — move the `PauseMark` (`:151-156`) and `LiveDot` (`:128-149`) bodies out
   **byte-for-byte**, including `data-testid="figure-live-dot"` and the visually-hidden word `live`
   (nine shipped specs key on that testid), and export both. They are module-private today — the file
   exports only `:158,:238,:339,:355` — which is exactly why criteria 12, 27a, 27b, 28, 29 and 35e all
   wait on this landing.
4. **`FigureCell` consumes the module.** Delete `const MONO` (`:54`) and both mark bodies; import
   `faceFor`/`MONO_FACE`/`UNTRACED_RULE`, `LiveDot`/`PauseMark`, `figureStateOf`. `ValueGlyph` binds
   `...faceFor(mono)` in place of `fontFamily: mono ? MONO : …` (`:225`) and `...(untraced ?
   UNTRACED_RULE : {})` in place of the inline rule (`:228`); the caption `Typography` (`:316`) binds
   `...MONO_FACE`. Replace `:250-300` with one `figureStateOf` call and render from its fields, keeping
   `:302-329` otherwise byte-identical — `data-figure-state` stays on the **card root** (`:303`) so the
   nine specs keyed on it are untouched.
5. **`figureState.spec.ts`** — a table over all nine states: `default`; `live` (`showDot`);
   `offline-retained` (`dim`, `showPause`, caption exactly `offline · last known`); `offline-bare`
   (`mono:false`, `isFigure:false`, caption exactly `offline`, and **`last known` appears nowhere**);
   `unavailable` from `'not recorded'` with `register:'traced'` (**`mono:false`** — register ignored);
   `empty` from `'—'`; `replay`; `untraced` (caption `model · untraced`); and offline **overriding** a
   caller caption. Run → fails → implement → passes → commit.
6. **`fonts.spec.ts` — two needles, each with its OWN poison.** The file's shipped guard (`:157-161`)
   proves only that `RETIRED_FACES` catches a retired **face literal**; it exercises **neither** needle,
   so nothing is inherited (SPEC §2.3; S2 pass-1 Important #2). Scope is criterion N-1's three trees:
   `/src/app/features/trading/`, `/src/app/pages/positions/`, `/src/app/pages/scanner/`. Homes are
   `/src/app/shared/theme/tokens.ts` and `/src/app/shared/figure/`.
   ```ts
   // needle 1 — a closed-nine member inside a mono-bound sx (line-window, ±6/+12 lines)
   const MONO_BOUND = /\.\.\.\s*MONO\b|MONO_FACE|monoFontFamily|fontFamily\s*:\s*MONO\b/;
   const NINE = ['—','unavailable','not given','not set','size not suggested','unrecognized','not recorded','no basis','not provided'];
   export function memberInMonoRun(src: string): string[] { /* windowed scan, returns `line:member` */ }
   // needle 2 — a face literal, or a face binding, outside the two homes
   const FACE_LITERAL = /fontFamily\s*:\s*['"`]/;
   const FACE_BINDING = /typographyTokens\s*\.\s*(mono|display)?[Ff]ontFamily/;
   export const bindsFaceLocally = (src: string) => FACE_LITERAL.test(src) || FACE_BINDING.test(src);
   ```
   Four `it`s: **(a) anti-vacuity** — in-scope sources `> 10` and the set contains a `pages/scanner/` and
   a `features/trading/positions/` path (measured today: **14** in-scope files carry a binding);
   **(b) mutation guard, needle 1, its own** — `memberInMonoRun("const MONO={fontFamily:x};\n<Box sx={MONO}>{'not recorded'}</Box>")` is non-empty
   while the `SANS` form is empty; **(c) mutation guard, needle 2, its own** —
   `bindsFaceLocally("fontFamily: 'IBM Plex Mono'")` and
   `bindsFaceLocally('fontFamily: typographyTokens.monoFontFamily')` are `true`,
   `bindsFaceLocally('...faceFor(true)')` is `false`; **(d) enforcement** — no in-scope source violates
   either needle, minus `EXEMPT`.
   **`EXEMPT`, live-checked, with the task that removes each entry** (the shipped
   `liveClaim.spec.ts:111-135` idiom: an entry whose file no longer exists **or no longer violates**
   red-builds, so a stale exemption cannot quietly widen the fence). The needles therefore **enforce from
   the first commit**; each later task deletes its own entries; FE-14 asserts the map is **empty**:
   `ScanCells.tsx` + `ViewEditorDialog.tsx` → FE-3 · `PositionRow.tsx`, `PositionCard.tsx`,
   `LegDisclosure.tsx`, `outcomes/TrackRecordSection.tsx`, `orders/OrderRow.tsx`,
   `orders/OrderDetailDialog.tsx` → FE-5 · `broker/{BrokerPositionRow,BrokerPositionCard,BrokerGroupHeader,ProvenanceHeader,reassess}.tsx` → FE-7 ·
   `pages/positions/PositionsPage.tsx` → FE-6. Record the measured site list in the build report:
   `BrokerPositionRow.tsx:120,158,183,315,369` · `BrokerPositionCard.tsx:76,138` · `BrokerGroupHeader.tsx:41` ·
   `ProvenanceHeader.tsx:70` · `reassess.tsx:126,139` · `TrackRecordSection.tsx:88,136` · `OrderRow.tsx:46` ·
   `OrderDetailDialog.tsx:39` · `LegDisclosure.tsx:59` · `PositionCard.tsx:40,74,95,151,160` ·
   `PositionRow.tsx:73-78` · `PositionsPage.tsx:185` · `ScanCells.tsx:44-48` · `ViewEditorDialog.tsx:47`.
7. **Run:** `cd apps/dashboard && npx vitest run src/app/shared/figure src/app/shared/theme/fonts.spec.ts`
   → exit 0; then `npx nx test @convexa/dashboard --skip-nx-cache` (this is where a mis-moved mark
   surfaces: `FigureCell.spec.tsx`, `type-floor.spec.tsx`, `ticker.risk.spec.tsx:327-329,371`,
   `live-dot-census.spec.tsx`, `LiveTape.spec.tsx`) and `npm run typecheck` → 0.

**MUTATION PROOF A (criterion 2, SB).** Delete `register` from `ReadStrip.tsx:59-65` and run
`npm run typecheck`: must fail **TS2741/TS2322** naming `register`; `nx test` stays green — that is the
point. Record the error text; revert.
**MUTATION PROOF B (needle 1, SB)** and **C (needle 2, SB)** are recorded here with the planted fixtures
(guards b/c) and re-run against real sources after FE-5/FE-3 remove their exemptions.

**Reviewer probe:** does `grep -n "fontFamily" .../\_kit/FigureCell.tsx` return **zero** lines? Does
`git log -p` show the marks **moved** (deleted there, added here) rather than duplicated? Are the four
captions the shipped bytes?

## FE-2 — The liveness fence reaches four surfaces; `/positions` stops calling the banned predicate

**Owns:** `apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts` · `apps/dashboard/src/app/pages/positions/PositionsPage.tsx` (**lines 31 and 88 only**)
**Depends on:** — · **Independent:** no (shares `PositionsPage.tsx` with FE-6) · **Spec:** §2.2 last block, §7 inv. 1 · **Criteria:** 6 (SB)
**Specs edited:** `liveClaim.spec.ts` (glob widened; `BANNED` and the mutation guard **unchanged**),
`pages/positions/positions.integration.spec.tsx`, `pages/positions/positions-page.spec.tsx` (fixtures
only — see step 3). **Copy diffs: none.** **Commit boundary:** one commit.

1. **Widen the glob to exactly the five paths criterion 6 names**, keeping the desk glob:
   `pages/scanner/**`, `pages/positions/**`, `pages/alerts/**`, `features/trading/positions/**`,
   `features/auth/**`, `!**/*.spec.{ts,tsx}`. Rename `DESK_SOURCES` → `FENCED_SOURCES` and its three
   uses. Keep the live-checked `EXEMPT` idiom so a stale exemption red-builds.
2. **Measured: no new EXEMPT entry is required.** This plan grepped the five new globs for
   `\bgenuineIsLive\b`, `\btape\s*\.\s*isLive\b`, `\bisLive\s*&&` — the only non-spec hit outside the
   desk is `PositionsPage.tsx:31,88`, which step 3 deletes. The shipped `live-tape/LiveTape.tsx` entry
   stays, unchanged and still accurate. If a new offender appears, add it to `EXEMPT` with its reason;
   **never widen `BANNED` and never rename a variable to dodge the regex.**
3. **The deletion.** `:31` → `import { isDeliveringLive } from '@/shared/liveness/liveClaim';`;
   `:88` → `const isLive = isDeliveringLive(live, streamOffline);`. `:114-128` already holds `live` and
   `streamOffline` — precisely the predicate's two arguments — so one predicate leaves the tree and none
   arrives. **Behaviour delta, stated not discovered:** `isDeliveringLive` also returns `NOT_LIVE` when
   `market_session === 'closed'` (that is why it is the canon predicate — `liveClaim.ts:41-45`). `isLive`
   flows to `usePortfolio` (`:130`), `PortfolioPanel` (`:201`) and `useOrderEngine` (`:136`): with the
   venue closed, `mark.ts:95`'s modeled-from-live-underlying rung is skipped (the ladder falls to its
   snapshot/theoretical/frozen rungs, which exist for this) and `usePortfolio.ts:299` refuses limit
   fills. `LiveClaim` is `boolean & {…}`, so every `isLive: boolean` prop still type-checks. Run the two
   page specs first, record which cases move, and **fix the FIXTURE (`market_session: 'open'`), not the
   assertion** — a test that needed a closed venue to read live was asserting the defect.
4. **Run:** `cd apps/dashboard && npx vitest run src/app/shared/liveness src/app/pages/positions`;
   `npm run typecheck`.

**MUTATION PROOF D (criterion 6, SB).** Plant `const x = genuineIsLive(live, false);` in
`pages/scanner/Scanner.tsx` — **one of the five NEW globs**; planting it on the desk would prove only
what the shipped fence already proved, which is the vacuity 69 exists to catch. The scan must go red
naming that file. Record; revert (T2 if the red will not clear).

**Reviewer probe:** does `grep -rn "genuineIsLive" apps/dashboard/src/app` return only
`sessionTapeStanding.ts`, `liveTapeStore.ts`, `orders/engine.ts` and specs — i.e. is `pages/positions/`
gone? And does `Object.keys(FENCED_SOURCES).some(f => f.includes('pages/alerts/'))` hold?

## FE-3 — Scanner: register + the closed nine on every figure, both layouts, and the lookup-miss member

**Owns:** `apps/dashboard/src/app/pages/scanner/{ScanCells.tsx,ScanTable.tsx,ScanCard.tsx,labels.ts,ViewEditorDialog.tsx}` · new `apps/dashboard/src/app/pages/scanner/scanner.register.spec.tsx` · `apps/dashboard/src/app/shared/theme/fonts.spec.ts` (its two EXEMPT entries only) · `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts`
**Depends on:** FE-1 · **Independent:** no · **Spec:** §2.1, §2.7, §4.1 · **Criteria:** 9 (SB), 10 (SB), 11A (SB), 17, U-6, 18, 19, 20, 22 (SB), U-35 (scanner half); 1/3/4 on this surface
**Specs added:** `scanner.register.spec.tsx`. **Specs edited:** `fonts.spec.ts` (delete two EXEMPT
entries), `radius-scale.spec.ts` (the `'10px'` string sites), `scanner.risk.spec.tsx` only if a register
attribute breaks an existing query — record it if so. **Copy diffs: none** (CF-1's two sentences are
FE-4's; every other scanner string is byte-identical, including `'⚠ Stale'` / `'⚠ Error'`).
**Commit boundary:** one commit per step.

1. **The atoms consume the module.** In `ScanCells.tsx`, delete the local `export const MONO`
   (`:44-48`) and route every atom through `figureStateOf` + `faceFor`. Each atom emits
   `data-figure-state` **on its own node** (e.g. `cell-price`, `:71-77`) and `data-figure-register` on
   the value — **an assertion queries state at the cell testid and never assumes co-location** (§2.1).
   `PriceCell` (`:68`), `ChgCell` (`:82`), `ScoreCell` (`:98`), `LevelDistCell` (`:178`), `UpdatedCell`
   (`:218`) and `Dash` (`:51`) all change; **`fontSize: 'inherit'` (`:74`) stays** — register and state
   travel, size does not, and a criterion that made scanner cells step would fight `ScanTable.tsx:237`'s
   density sizes.
2. **The absent value leaves the mono run (criterion 17, needle 1).** Today `dash(value, fmt)`
   (`format.ts:222-224`) returns `EM_DASH` **inside** each atom's mono span, and `Dash` (`:51-61`) spreads
   `...MONO` around it. After this task an absent value renders through the module's literal arm — Sans,
   `data-figure-state="empty"`, never stepped, never a unit. `EM_DASH` and `dash()` keep their bytes.
3. **U-6 — a lookup MISS is `unavailable`, a null is `—`.** `labels.ts:254-257`'s `closed()` collapses
   both into `null`. Split it: `closedLookup(map, v)` returns `{ kind:'value', text } | { kind:'absent' }
   | { kind:'miss' }`. `LabelCell` renders `unavailable` (closed-nine member, Sans) on `miss` and `—` on
   `absent`. *"The wire sent an enum this build does not know"* is a fact this build can observe.
   **ux's tip half is dropped** (§2.7): `LabelCell` has no help host and adding one is new chrome on a
   frozen surface, while the status path already renders `Unavailable` with its tip one cell away.
4. **Both layouts, one datum (criterion 9).** `ScanTable.cellContent` and `ScanCard` already share the
   atoms; add an assertion that for one fixture row the table cell and the card cell carry the **same
   text and the same `data-figure-register`/`data-figure-state`**. They are deliberately **not** the same
   size (§2.1) — assert text + register + state, never `fontSize`.
5. **No live mark anywhere (10, 11A).** Assert `queryAllByTestId('figure-live-dot')` is empty on the
   scanner in every connection state, and that no atom passes anything but `NOT_LIVE`.
6. **The four page states (18, 19, 20).** Assert the cold placeholder renders **zero figures** and never
   returns after the first read (`Scanner.tsx:182`), that `scan-empty-view` and `scan-empty-filter` are
   two messages with two recovery controls and neither is an error, and that signed out the page renders
   the sign-in wall **naming the surface** (`RequireAuth`), never an empty table.
7. **U-35 (scanner half).** `ScanTable.tsx:289-290` and `ScanCard.tsx:70` `borderRadius: '10px'` →
   `borderRadius: 1` (the panel role; `shape.borderRadius` is **12**, `radius-scale.spec.ts:36-39`).
   Extend `radius-scale.spec.ts` to catch **string** radii (`/borderRadius:\s*'\d+px'/`) — its shipped
   `NUMERIC_RADIUS` regex (`:18`) cannot see `'10px'`, which is why these two survived.
8. **Delete this task's two `fonts.spec.ts` EXEMPT entries** (`ScanCells.tsx`, `ViewEditorDialog.tsx`) in
   the same commit as step 1; `ViewEditorDialog.tsx:47`'s `MONO.fontFamily` becomes `...MONO_FACE`.
9. **Run:** `cd apps/dashboard && npx vitest run src/app/pages/scanner src/app/shared/theme` → exit 0.

**MUTATION PROOF E (criterion 9, SB).** Change `ScanCard`'s regime cell to render the raw enum instead of
the closed label. The both-layouts assertion must go red naming the mismatch. Record; revert.
**Reviewer probe:** does the card still render as **one anchor** with `focusableHelp={false}`
(`ScanCard.tsx:54-59,107`) and no focusable control nested inside it (criterion 22)? Is
`no-overflow.spec.ts:938`'s single-anchor pin still green?

## FE-4 — Scanner: the degraded price arm, the flash gate, and D-A's two sentences

**Owns:** `apps/dashboard/src/app/pages/scanner/{Scanner.tsx,ScanTable.tsx,ScanCard.tsx,ScanCells.tsx,labels.ts,scanner.risk.spec.tsx}` · `apps/dashboard/src/app/pages/scanner/scanner.register.spec.tsx`
**Depends on:** FE-1, FE-3 · **Independent:** no · **Spec:** §2.2, §4.2 · **Criteria:** 12 (SB), 13 (SB), 14 (SB), 15, 16, CF-1 (SB)
**Specs edited:** `scanner.risk.spec.tsx:869` (see T5 — **run it first**). **Copy diffs (the closed set,
itemize both in the build report):** `labels.ts:25` `cadenceHeader` and `labels.ts:26-29` `cadenceGloss`.
**Nothing else on scanner** — `cadenceHeaderOffline` (`:32`) byte-identical, `'⚠ Stale'` (`:205`),
`'⚠ Error'` (`:211`) and every tooltip byte-identical.

1. **Exactly one new prop.** `ScanTableProps` (`ScanTable.tsx:47-60`) and `ScanCardProps`
   (`ScanCard.tsx:30-35`) each gain **one** per-symbol prop, `{ retained: boolean } | null`, computed
   **once** at `Scanner.tsx:119-126` where `live` (`:115`) and the per-symbol price (`:122`) are already
   in hand:
   ```ts
   const priceOffline = (sym: string) =>
     live.offline && live.prices[sym] != null ? { retained: true } : null;
   ```
   Provenance, never age. The outer null/non-null is **the stream's** state; the inner boolean is **the
   datum's** provenance — the shipped desk precedent reads it exactly this way
   (`LiveTape.tsx:126,197,208,223` over `useStreamLatch.ts:19-20,42`).
   **The `ts`-age option is WITHDRAWN and must not be re-proposed:** `ts` carries `ev.ts_ns`
   (nanoseconds, *"0 if missing"*, `apps/api/src/domain/price.rs:18-19`), so `Date.now() − lp.ts` is off
   by 10⁶ and every vendor-timestamp-less symbol would read `offline · last known` permanently, while
   live (§2.2; `R3-architect-addendum.md` §1).
2. **F4 on the price only (12).** `PriceCell` takes the prop and renders the module's retained arm — dim
   + the declared stroke `PauseMark` + caption `offline · last known`, observable as
   `[data-testid="cell-price"][data-figure-state="offline-retained"]`. Structure figures beside it keep
   **identical text** and are **not** dimmed (they come from `useScan` and never touch `live`).
3. **`offline-bare` is unreachable here by construction (13).** The arm is only reachable when
   `live.prices[sym]` exists, so `retained: false` cannot occur — assert the *expression*, and assert a
   never-ticked symbol renders its swept price at full strength, `data-figure-state="default"`, no pause
   mark, no last-known wording.
4. **Drive the EVENT, never the clock (12).** `live.offline` turns true immediately on `es.onerror`
   (`useLivePrices.ts:79-82`) or at the first watchdog tick strictly past `SILENCE_MS = 45_000`
   (`:37,85` strict `>`, `5_000`ms interval `:86`) — a bounded **[45 s, 50 s)** window. Use a mocked
   `EventSource` firing `onerror` (the repo's idiom at `ticker-hierarchy.spec.tsx:24-30`) or fake timers.
   **Never wait 45 s of wall clock.**
5. **One flag, so header and figures cannot disagree (12).** `Scanner.tsx:144` swaps
   `cadenceHeaderOffline` for `cadenceHeader` on `live.offline`, and the per-figure arm is
   `live.offline && …` — the **same** flag from the **same** `useLivePrices` call in the same render.
   Assert both move together.
6. **The flash stops while the stream is down (14).** `Scanner.tsx:89`'s `flashActive` gains
   `&& !live.offline`. Assert no price cell applies a flash class on a change during a drop.
7. **The two sentences (15, CF-1 — OWNER D-A, set widened by CONDUCTOR).**
   `cadenceHeader` → **`Prices per tick · structure ~3 min · hot names sooner`** — the separator, order
   and third clause byte-identical, the banned token gone.
   `cadenceGloss` → drop the opening `Prices stream live.` and keep the rest:
   **`Prices change tick by tick. The options structure — score, tier, flip and walls — re-computes about every 3 minutes, and names that just moved re-compute sooner, so those numbers are a recent snapshot rather than a live read.`**
   The word `live` may stand inside the closing **denial** — criterion 15 bans the assertion, not the
   token. Deleting the opening sentence outright also satisfies 15; **the criterion, not this string, is
   the contract.** The gloss keeps its `Jargon` host, so no node, element or testid changes
   (`Scanner.tsx:140,143-146`). CF-1's scan: an exemption list naming **exactly those two constants and
   no third**, every other `SCAN_COPY` value asserted byte-identical against a frozen table.
8. **T5 — `scanner.risk.spec.tsx:869` may stay GREEN.** It pins `/Prices (live|offline)/` and the test
   renders the **offline** arm (`cadenceHeaderOffline` still contains `Prices offline`). **Run it before
   and after; record which.** Either way, strengthen it to pin **both** arms: online → the new header,
   `live` absent from the page text; offline → `cadenceHeaderOffline` byte-identical.
9. **Worker-down (16).** With `scan.workerDown`, assert rows keep last-known values under
   `scan-worker-down` (warning + MUI's icon), every figure keeps its `data-figure-register`, and **no row
   is blanked**.
10. **Run:** `cd apps/dashboard && npx vitest run src/app/pages/scanner`.

**MUTATION PROOF F (criterion 12, SB).** Change the predicate to `live.offline ? { retained: true } :
null` (dropping the provenance term). The never-ticked-symbol test must go red on a pause mark that
should not be there. Record; revert.
**MUTATION PROOF G (CF-1, SB).** Change any third `SCAN_COPY` value by one byte. The freeze scan must go
red naming that key. Record; revert.
**Reviewer probe:** does the word `live` appear in `cadenceHeader`? Does the gloss still assert liveness
in **any** connection state? And is `cadenceHeaderOffline` byte-identical (it becomes **true** for the
first time this phase, because the figures now dim)?

## FE-5 — Positions rows: the offline contract on six cells, the `⏸` removal, the one inversion, the keyboard tips

**Owns:** `apps/dashboard/src/app/features/trading/positions/{PositionRow.tsx,PositionCard.tsx,PositionsView.tsx,labels.ts,LegDisclosure.tsx,PortfolioPanel.tsx,PositionsPanel.tsx,positions.risk.spec.tsx,offlineLayout.spec.tsx,tint.spec.tsx}` · `apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx` · `apps/dashboard/src/app/features/trading/orders/{OrderRow.tsx,OrderDetailDialog.tsx}` (**face re-point only**) · `apps/dashboard/src/app/shared/theme/fonts.spec.ts` (its six EXEMPT entries)
**Depends on:** FE-1 · **Independent:** no · **Spec:** §2.3, §4.3 · **Criteria:** 23 (SB), 24 (SB), 25 (SB, sim arm), 26, 27a (SB), 27b (SB), 28 (SB), 29 (SB), U-9, U-15, U-15a (SB), 30, 31, 32, 33, 35, CF-2 (SB)
**Specs edited:** `positions.risk.spec.tsx` (`:420-424` `⏸ offline` → the icon; extend `:851-869` with
the sim-book *never `not provided`* arm), `offlineLayout.spec.tsx:60`, `tint.spec.tsx:202`,
`positions.integration.spec.tsx:497-498,523`. **Copy diffs to itemize (all class (1) — a truth mark →
the declared stroke icon):** `PositionRow.tsx:68` (`'⏸ offline'`), `:378` (`' ⏸'`), `:388` (bare `'⏸'`),
**`:549`** (`Paused — resumes pricing when the live feed returns. ⏸`), `PositionsView.tsx:367` (bare
`'⏸'`), `labels.ts:57` (` (⏸)` deleted — see **Z-2**). **Nothing else changes**: the `—` in
`delta_entry` is byte-identical and only its register moves.

> **Plan finding the lane must not trip over:** SPEC §2.3 names **three** character marks; the tree
> carries **six** in-scope sites (above). Criterion 29's wording — *"no `⏸` survives in any positions
> source string"* — is the contract and is broader than §2.3's enumeration, so all six are in scope.
> `features/trading/orders/OrderRow.tsx:172` is a seventh and is **out of scope** (Z-1).

1. **The six live-derived cells owe the offline contract, from the module.** `mark` (`:284-320`), `pl`
   (`:321-341`), `pl_pct` (`:342-367`), `delta_entry` (`:368-382`), `session_delta` (`:383-392`),
   `trend` (`:393-411`) render through `figureStateOf`, so `dim` comes from the module and **never** from
   the cell-local `liveDim` (`:200`) — that is what stops `PositionsPage.tsx:190`'s shape (opacity, no
   pause, no caption) being re-minted per cell. `session_delta` has a retained arm available
   (`ctx.sessionDelta`, `RowContext:119-120`), so on a drop it renders the **last value dimmed with the
   stroke mark and the `offline · last known` caption, not a naked glyph** (27a). A cell with no retained
   value renders a closed-nine member **with** the pause icon and **no** last-known words (27b), and no
   cell ever renders a bare pause marker with neither a value nor a member beside it (28).
2. **`literal()` and its per-member tips STAY.** `PositionRow.tsx:145-153` is a single Tooltip-wrapped
   renderer differing by text and testid only. `FigureCell` has **no value-row help host** (`:307` mounts
   help in the LABEL row), so converting those cells would **delete** the three tips and the non-synonymy
   criterion would read green while the distinction went invisible. **`FigureCell` conversion on
   positions = the header readout only** (FE-6). **Boundary the build must not cross:** `dashCell`
   (`:167`) is deliberately **untestidded** (`:69`) — no assertion may assume a DOM hook for `—`.
3. **U-15a (CONDUCTOR, reversible) — the three tips become keyboard-reachable.** Use the file's **own
   idiom three hundred lines down** (`:396-401`): `Tooltip describeChild` + a visually-hidden
   `aria-describedby` target + focusability. **Attributes only, zero wording change.**
4. **The one inversion (17 → rule 24).** `delta_entry` (`:374` `...MONO`, `:377` `DASH`) routes through
   the shipped `dashCell` (`:167`, same `DELTA_ENTRY_TIP`): the word `—` stays **byte-identical**, only
   the register moves Mono → Sans. `dte` (`:518`), `entry_time` (`:522`), `stop` (`:526`), `target`
   (`:528`) already render `DASH` in Sans and are correct.
5. **Record fields never dim, never wear a mark (U-9)** — contract, structure line, qty, net entry,
   **max loss** (whose own tooltip promises exactly this), expiry, status. **Closed/cancelled rows carry
   neither mark in any connection state (31).** **Faulted is not offline (30):** with the store faulted,
   every write affordance is refused but still focusable and explained, **nothing dims and no pause mark
   appears** — the shipped `Refused`/`FaultedBanner` posture (`FaultedBanner.tsx:92-117`), unchanged.
6. **Non-synonymy, sim arm (24, 25, 26).** Three **different fixtures reaching three different arms**
   against the shipped testids `cell-unavailable` (`:164`), `cell-not-recorded` (`:166`), `cell-no-basis`
   (`:348`) — extend `positions.risk.spec.tsx:851-869` with *the sim book never renders `not provided`*
   and keep `:882-887`'s cell-level `no basis` proof. Tip texts stay `review` (U-15).
7. **Tinting (35).** Signed-P&L direction only, and **only where the tinted value is a computed P&L over
   marked rows** — never a zero standing in for an unmarked or empty book, never on a closed-vocabulary
   member.
8. **Signed-out wall and empty book (32, 33)** — the wall **names the surface**, and the empty state is
   distinct from both the wall and a load failure.
9. **Face re-point (needle 2).** Delete the local face bindings in `PositionRow.tsx:73-78`,
   `PositionCard.tsx:40`, `LegDisclosure.tsx:59`, `TrackRecordSection.tsx:88`, `OrderRow.tsx:46`,
   `OrderDetailDialog.tsx:39` → `...MONO_FACE` from the module, **byte-identical render**, and delete
   the six EXEMPT entries in the same commit. `OrderRow.tsx` is shared with the desk: the re-point
   changes **no rendered byte** (same face, same tabular numerals), and the build report says so under
   Z-1 with `LiveTape.spec.tsx`/`orders.risk.spec.tsx` re-run as evidence.
10. **Run:** `cd apps/dashboard && npx vitest run src/app/features/trading src/app/pages/positions`.

**MUTATION PROOF H (criterion 29, SB).** Restore `'⏸'` at `PositionRow.tsx:388`. A `?raw` scan over
`features/trading/{positions,broker}/**` + `pages/positions/**` for `/⏸/` must go red naming the file.
Record; revert. *(That scan is authored here and is the enforcement for 29; it is **not** inherited from
`fonts.spec.ts`.)*
**MUTATION PROOF I (criterion 27b, SB).** Give the bare arm the `offline · last known` caption. The
27b test must go red on `last known` appearing where nothing was retained. Record; revert.
**Reviewer probe:** do the three literal tips carry **exactly** their shipped wording (U-15) while now
being reachable by keyboard (U-15a)? Does any assertion assume a testid for `—`?

## FE-6 — The positions header readout: `FigureCell`, five states, and the rendered container step

**Owns:** `apps/dashboard/src/app/pages/positions/PositionsPage.tsx` · new `apps/dashboard/src/app/pages/positions/netPl.ts` + `netPl.spec.ts` · `apps/dashboard/src/app/pages/positions/positions-page.spec.tsx` · `apps/dashboard/src/app/shared/theme/fonts.spec.ts` (its one EXEMPT entry)
**Depends on:** FE-1, FE-2 · **Independent:** no (shares `PositionsPage.tsx` with FE-2) · **Spec:** §2.2 end, §4.3 · **Criteria:** 35a (SB), 35b (SB), 35c, 35d, 35e (SB), 7a, 7b, 8, 23 (SB, header)
**Specs added:** `netPl.ts` + `netPl.spec.ts`. **Copy diffs (positions = additions only):** the coverage
caption `{n} of {m} open marked` — **one** template used by two states, so no second sentence is minted.
Label `Net P/L (open)` and `data-testid="positions-net-pl"` are **unchanged**.

1. **A pure state function**, so the five arms are testable without the page:
   `netPlStateOf({ views, streamOffline, retainedTotal })` → `{ value, register, caption, tint, offline }`
   over the same set the sum already walks (`:147-154`, verified page-local and purely presentational,
   so it sits inside criterion 67's fence). Arms: **no open rows → `—` (F7), Sans, no tint, the caller's
   basis line** (today it renders a green `+$0` — a shipped defect this closes); **open, none marked →
   `unavailable` (F8), no number, no tint, caption `0 of {m} open marked`**; **some marked → the
   computable sum, Mono, direction permitted, caption `{n} of {m} open marked` (mandatory)**; **all
   marked → the total, no caption**; **drop → F4 (retained total + pause icon + `offline · last known`)
   or F5 (`unavailable` + pause icon + `offline`), and the offline caption OVERRIDES the coverage
   caption** (the primitive's shipped behaviour `FigureCell.tsx:253,262,271`, not a new composition rule).
2. **Render it through `FigureCell`** (`:177-195`), which absorbs the hand-bound mono face at `:185` and
   the bare `opacity: 0.5` at `:190`, and delete the EXEMPT entry.
3. **7a / 8 — the rendered step, and the container that makes it possible.** Wrap the readout block in
   `PanelContainer` (`shared/ui/PanelContainer.tsx`, the **only** sanctioned way to declare the `panel`
   name; `ReadStrip.tsx:54` is the shipped precedent) with `sx={{ maxWidth: 320 }}`. Without a named
   ancestor `theme.containerQueries('panel')` never matches and the declared step **never fires at any
   viewport** — with a green build (§2.4's hazard). **No second container name is introduced anywhere.**
   The **rendered** proof is FE-13's browser measurement (jsdom cannot evaluate a container query, and
   §7 invariant 5 says no criterion claims a jsdom proof of stepping); this task's jsdom test asserts
   only that the readout has a `PanelContainer` ancestor and that no second name exists.
4. **7b — the off-ladder sites, named with their reason in the build report:** scanner table cells at
   `fontSize: 'inherit'` (`ScanCells.tsx:74`, fighting `ScanTable.tsx:237`'s density sizes would break
   the dense read); the two 12px quiet-band list rows (`FreshPositioning.tsx:56`,
   `OffExchangeBlocks.tsx:79` — stepping them 20→17→15 would **enlarge** them and break ruling 6's
   layout freeze); the positions row cells at `0.86rem`.
5. **Run:** `cd apps/dashboard && npx vitest run src/app/pages/positions`.

**MUTATION PROOF J (criterion 35b, SB).** Make the unmarked-book arm return `0` instead of
`unavailable`. The 35b test must go red on a number and on the direction colour. Record; revert.
**MUTATION PROOF K (criterion 35e, SB).** Let the coverage caption win over the offline caption. The 35e
test must go red on `{n} of {m} open marked` appearing during a drop. Record; revert.
**Reviewer probe:** is `{n} of {m} open marked` **one** template used by two states? Does the readout
still carry `data-testid="positions-net-pl"` and the label `Net P/L (open)` byte-identical?

## FE-7 — The Broker tab: register on its figures, `not provided` non-synonymy, read-only

**Owns:** `apps/dashboard/src/app/features/trading/broker/{BrokerPositionRow.tsx,BrokerPositionCard.tsx,BrokerGroupHeader.tsx,ProvenanceHeader.tsx,reassess.tsx,BrokerTabPanel.spec.tsx,BrokerGroupHeader.spec.tsx,brokerCrossTicker.integration.spec.tsx,genericOptionRow.spec.tsx}` · `apps/dashboard/src/app/shared/theme/fonts.spec.ts` (its five EXEMPT entries)
**Depends on:** FE-1 · **Independent:** no · **Spec:** §1 (narrowed non-goal), §4.1 · **Criteria:** 23 (SB), 25 (SB, broker arm), 34 (SB), 29 (broker sites)
**Specs edited:** `BrokerGroupHeader.spec.tsx:268` (`/^⏸/`), `BrokerTabPanel.spec.tsx:293,301,302,314`,
`brokerCrossTicker.integration.spec.tsx:173` (`['⏸ +$1000','⏸ +$120']`) — all four re-point from the
glyph to the rendered `PauseMark` (query the icon, not the character). **Copy diffs:**
`BrokerGroupHeader.tsx:215` and `BrokerPositionRow.tsx:128` (`'⏸ '` → the stroke icon) — class (1).
**No broker DATA work:** no `/api/broker/*` change, no new network call, and **no change to the
deliberate `NOT_RECORDED → NOT_PROVIDED` per-surface substitution** (`notANumber.ts:15-16`).

1. Figures render through the module (register + state), faces re-pointed, five EXEMPT entries deleted.
2. **Non-synonymy, broker arm (25).** The shipped `genericOptionRow.spec.tsx:175-184` already asserts
   *"the string `not recorded` appears in NO broker state"* across `ALL_ARMS` **and** in the projection —
   keep it, and add the positive half: a fixture whose feed withheld the fact renders `not provided`
   (`BrokerPositionRow.tsx:141,195`). With FE-5's sim-book arm and the shipped `:186-215` sim proof, the
   criterion's **three fixtures reaching three arms** is complete.
3. **Read-only (34).** Assert the tab renders **no** entry, order or cancel control in any state, and
   **issues no new network call** (spy on `fetch`; only the shipped `useBrokerBook.ts:62` /
   `renderState.ts:44` reads may fire). The one entry affordance on the surface opens the single shared
   `TradeEntryDialog`.
4. **Run:** `cd apps/dashboard && npx vitest run src/app/features/trading/broker`.

**MUTATION PROOF L (criterion 25, SB).** Make `brokerFactText` return `not recorded` for
`{ state: 'not_supplied' }`. `genericOptionRow.spec.tsx`'s no-`not recorded` census must go red. Record;
revert. **Reviewer probe:** did any assertion get **weakened** from the glyph to a substring that also
matches the icon's `aria-hidden` markup? The re-pointed assertions must query the icon element.

## FE-8 — Settings: register, `not set`, neutral confirmation, browser-only persistence, the scales

**Owns:** `apps/dashboard/src/app/features/auth/{SettingsPage.tsx,RiskInputsSection.tsx,copy.ts}` · new `apps/dashboard/src/app/features/auth/settings.register.spec.tsx`
**Depends on:** FE-1 · **Independent:** no · **Spec:** §2.6, §4.4 · **Criteria:** 36 (SB), 39 (SB), 40 (SB), 41 (SB), 42 (SB), 43, U-19, U-35 (settings half)
**Specs added:** `settings.register.spec.tsx`. **Copy diffs:** one **new** line for U-19 (session still
resolving) — the five section headings and their order are the **shipped** ones and nothing reorders (the
file records that a trader input must not be grouped with credentials).

1. **D-D applies here (36).** A user-entered number is **TRACED**: the risk inputs render in the **Mono
   register with no dotted rule**, and the F9 caption `${assertedBy} · untraced` is **never** produced
   for a user-entered value. Bind the face from `shared/figure/figureFace` (delete
   `RiskInputsSection.tsx:29`'s local `MONO`) and emit `data-figure-register="mono"` on both inputs.
   *(N-1's scan scope is the spec's three trees and does not include `features/auth/`; criterion 1 is
   satisfied here by the conversion plus this component assertion — recorded in FE-14 item 9.)*
2. **`not set`, never a pre-filled number (36).** `placeholder="0"` (`RiskInputsSection.tsx:154,198`) is
   a pre-filled-looking number → `placeholder="not set"` (a member of the closed nine, confirmed at
   `notANumber.ts:30`). `formatAmount(null)` already yields `''`; nothing else changes.
3. **41 — the confirmation loses the direction palette, the error keeps its severity AND its icon.**
   `SettingsPage.tsx:387` `<Alert severity="success">` → neutral chrome (`severity="info"` or a plain
   `Snackbar` message) keeping the word `Saved` it ships with; `:344` `<Alert severity="error">` stays
   **exactly** as it is. Canon rule 5 requires warning/error **+ icon always**, and the Banned row
   reserves green/red for *"status chips, success states or hit rates"* — an error alert is none of
   those. **An error is a state, not a direction.** Same treatment for
   `RiskInputsSection.tsx:311` (success snackbar) and `:300` (error alert, unchanged).
4. **40 — a failed write is non-blocking, reverts the control, shows no confirmation.** Assert all three
   in one test (`settings.saveError` set → the control shows its last known value and
   `settings-saved` is absent).
5. **39 — signed out, browser-only, and the canvas footnote is NOT imported.** `copy.ts:79`
   (`subtitleAnonymous: 'Stored in this browser.'`) already says it — assert it renders signed out **and
   that `Saved to your account.` is absent from the DOM in that state**. Do **not** delete `copy.ts:78`
   or `:219`: those are the signed-in strings, truthful for server-backed settings. The prohibition is on
   importing the canvas footnote `design/src/screens/settings.mjs:30` as a panel footnote, because
   `convexa.uiprefs.v1` (`localPrefs.ts:15`) is browser-local.
6. **42 — nothing on settings is live.** No live mark, no pulse, in any state; credential readiness is a
   **state**, never a stream. Assert `figure-live-dot` count is zero and no keyframe class is applied.
7. **U-19 — one line while the session resolves.** `auth.ready === false` currently freezes every control
   silently (`disabled={!auth.ready}`). Add one line above the fields, removed the moment the session
   resolves.
8. **U-35 (settings half).** `SettingsPage.tsx:67` `borderRadius: 2.5` → `1` (panel = **12**, not 30px);
   controls stay 8 (theme override) and pills 999. Assert against `shape.borderRadius`.
9. **43 — masked hint only** (review): capture the AI-key and brokerage panels showing a stored
   credential with no key material in any state.
10. **Run:** `cd apps/dashboard && npx vitest run src/app/features/auth`.

**MUTATION PROOF M (criterion 41, SB).** Restore `severity="success"` on the save confirmation. The
neutral-chrome test must go red naming the direction-reserved palette slot. Record; revert.
**Reviewer probe:** does the **error** alert still carry its icon (rule 5), and is the confirmation the
only thing that lost its palette?

## FE-9 — Alerts store: the read-fault latch (loss-free), and the pre-phase blob proof

**Owns:** `apps/dashboard/src/app/features/alerts/store.ts` · new `apps/dashboard/src/app/features/alerts/store.spec.ts`
**Depends on:** — · **Independent:** no (shares `features/alerts/**` with FE-10) · **Spec:** §2.5 · **Criteria:** 51 (SB), 52 (SB), 70 (SB), N-5 (store half)
**Specs added:** `store.spec.ts`. **Copy diffs: none.** **This task precedes any alerts UI change** — the
loss-free rule is repaired before the surface that writes to the store is touched.

**The live breach, verified at source.** `store.ts:59-68` casts `parsed.events` straight to
`AlertEvent[]` and resets to `empty()` on a parse failure — correct so far, nothing is written — but the
**next** `upsertRule` / `pushEvent` / `setNotifyBrowser` calls `persist` (`:41-49`), which `setItem`s the
empty state over **the same key the corrupt blob occupies**. `resolveDurable`'s never-delete guarantee
does not apply, because it reads one key and writes another.

1. **The latch.** A module-level `let readFaulted = false`, set **only** in `readAlerts`'s catch branch
   (`:66-68`); `persist()` keeps the in-memory update and the `notify()` (so the session is not wedged)
   but **skips `localStorage.setItem` entirely** while latched. Export `alertsReadFaulted()` for the UI.
   **It is a read-path guarantee, not a key or shape change** — which is why criterion 51 is a no-op
   migration rather than a version chain. `convexa.alerts.v1` (`types.ts:47`), `AlertsState` (`:39-45`)
   and `AlertEvent` (`:27-37`) are untouched; `message` (`:32`) is **never deleted**.
2. **`store.spec.ts`, four cases.** (a) **51/70** — a blob written **before** the phase (rules +
   events, `read` flags set) is read back with every rule and firing present and `enabled` exactly as
   saved; (b) **52** — a corrupt blob degrades to an empty list, the page renders its empty state rather
   than throwing, **and `localStorage.getItem(ALERTS_KEY)` is byte-identical to the corrupt original
   after a subsequent `upsertRule`**; (c) the latch is per-session and never auto-clears; (d) a healthy
   read still persists normally (anti-vacuity: the latch does not disable writing in the happy path).
3. **Run:** `cd apps/dashboard && npx vitest run src/app/features/alerts`.

**MUTATION PROOF N (criterion 52, SB).** Remove the `readFaulted` guard from `persist`. Case (b) must go
red on the stored original being overwritten. Record; revert. **Reviewer probe:** does case (b) compare
the **raw stored string**, not the parsed object? An assertion on the parsed value cannot see the
overwrite.

## FE-10 — Alerts page: closed lookups, thresholds by type, unread off the coloured edge, three empties

**Owns:** `apps/dashboard/src/app/pages/alerts/AlertsPage.tsx` · `apps/dashboard/src/app/features/alerts/{useAlerts.ts,evaluate.ts}` · new `apps/dashboard/src/app/features/alerts/labels.ts` · new `apps/dashboard/src/app/pages/alerts/alerts.risk.spec.tsx` · `apps/dashboard/src/app/features/alerts/evaluate.spec.ts`
**Depends on:** FE-1, FE-9 · **Independent:** no · **Spec:** §2.5, §2.6, §4.5 · **Criteria:** 44 (SB), 45 (SB), 46 (SB), 47a (SB), 47b, 47c, 47d (SB), 48, 49 (SB), 50, N-5, U-23a, U-24, U-27
**Specs added:** `alerts.risk.spec.tsx`. **Specs edited:** `evaluate.spec.ts` (the new label source).
**Copy diffs:** alerts copy is **not** frozen by §2.7 — its changes are the criteria in §3 E and the
strings in §4.5. Itemize them anyway.

1. **One lookup, two consumers.** Move `KINDS` (`AlertsPage.tsx:21-25`) and `LEVELS` (`:27-32`) into
   `features/alerts/labels.ts`, so the page **and** `evaluate.ts` build labels from the **same** closed
   maps (U-23a: a firing recorded after this phase and its rule row read the same words). No raw wire
   token reaches the DOM (45): `:189`'s `${r.symbol} · ${r.kind}` becomes `${r.symbol} · ${KIND_LABEL[r.kind]}`.
2. **Thresholds by type (§4.5, D-D).** `:191-195` becomes four arms:
   **score gate** → label `Score gate`, value `≥ {scoreMin}` in the **Mono (traced)** register, **bare
   index** — `≥ 72`, never `≥ 72 pts`, because a score is a unitless 0–100 index (`types.ts:20-22`) and
   a fabricated suffix is the inferred-unit failure the 2026-08-12 canon amendment names (47b);
   **price threshold** → label `Price threshold`, the value with its **currency prefix**, Mono — today it
   **never renders at all** (written `:48`, evaluated `evaluate.ts:110`, absent from `:191-195`) (47a);
   **structure level** → the label from the closed `LEVELS` lookup and **no threshold number of the
   rule's own** (the level's value is a market fact the record does not hold), absent → **`not recorded`**,
   never the bare word `level` (`:193`) (47d);
   **tier change** → `any tier transition`, **byte-identical**.
   **An absent score gate or price threshold renders `not set`** — never the fabricated `≥ 60` at `:192`,
   which the record does not hold (`types.ts:22`; `evaluate.ts:83` holds a third copy of `60` while the
   composer's own default is `70` at `:39`) (46).
3. **Unread leaves the coloured edge (44).** `:217-222`'s `borderLeft` colour is today the **only**
   carrier. Move the distinction into the **label row and type** (an `Unread` word plus weight), keep
   whatever edge remains as redundant, and assert the two states differ with colour removed —
   distinguishable in a black-and-white screenshot.
4. **Three empties, three sentences (48).** *No rules* (shipped, byte-identical) · *rules armed, nothing
   fired* · *nothing evaluated yet*. The third needs an **ephemeral** marker: a module-level counter in
   `useAlerts` incremented in `evaluateSnap` (`:38-52`) and exposed as `hasEvaluated`. **It is
   in-memory only — no new durable key** (constraint 14). Word it truthfully for a per-session marker,
   e.g. *"No snapshot has been evaluated yet this session — open a ticker so rules can evaluate."*
   Each names its next action; none renders as an error.
5. **49 — the page states rules evaluate on structure snapshots, not a stream**, and no element carries
   a live mark or a pulse (the shipped `:67-70` sentence already says it; assert both halves).
6. **50 — a denied or unavailable notification permission renders a state saying so**; the control never
   reads as "on" for a permission the browser did not grant (`useAlerts.ts:80-97`).
7. **N-5 — the faulted posture, identical to `PositionRow.tsx:122-127`.** When `alertsReadFaulted()` is
   true: a banner explains it, every write affordance (`alerts-add`, the enable switch, `Remove`, `Mark
   read`, `alerts-notify`) is **refused but still focusable and explained** — `aria-disabled`,
   `aria-describedby` → the banner id, `data-refused="true"`, no-op activation, the theme's own
   `action.disabled*` emphasis — and **nothing dims and no pause mark appears**. Faulted is not offline
   and this phase keeps them two states. *(A small local helper mirrors
   `FaultedBanner.tsx:92-117`'s attribute set rather than importing the trading domain into alerts; the
   test asserts the **same attribute set** so the two cannot drift silently. Recorded as debt — FE-14
   item 7.)*
8. **U-23a / U-24 / U-27 (review + test).** The Recent list renders stored `message` strings
   **verbatim** and makes **no claim** that stored history was re-labelled (pre-phase strings are legacy
   content, `types.ts:32`, `:225`); the back-fill honesty line and the *"stored in this browser"*
   disclosure are both present; every firing timestamp **names its zone** (`:233`'s
   `toLocaleString()` gains `timeZoneName: 'short'`).
9. **Run:** `cd apps/dashboard && npx vitest run src/app/pages/alerts src/app/features/alerts`.

**MUTATION PROOF O (criterion 46, SB).** Restore `?? 60` on the score-gate line. The test must go red on
a threshold the record does not hold. Record; revert.
**MUTATION PROOF P (criterion 44, SB).** Make read/unread differ **only** by the edge colour. The
black-and-white test must go red. Record; revert.
**Reviewer probe:** does `≥ 72` render with **no** unit suffix, and does an absent level render
`not recorded` rather than the word `level`?

## FE-11 — The quiet band: register, container steps, the two copy sites, the proximity chip

**Owns:** `apps/dashboard/src/app/pages/ticker/widgets/{off-exchange-blocks,fresh-positioning,market-context,setups,iv-rank,straddle-move,term-structure,dealer-flow-projection}/**` · `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts` · new `apps/dashboard/src/app/pages/ticker/widgets/quiet-band.register.spec.tsx`
**Depends on:** FE-1 · **Independent:** no · **Spec:** §2.4, §4.6 · **Criteria:** 53 (SB), 54 (SB), 56, 56a, 57, 57b, 58 (SB), 59 (SB), 61, 7a/8 (quiet-band containers)
**Specs added:** `quiet-band.register.spec.tsx`. **Specs edited:** none expected —
`lookalikes.spec.ts:22-27,47-55` is a live-checked exemption list naming **four other** widgets; neither
mono-run widget is on it, so converting them edits no spec. **Copy diffs — the closed set is exactly two
sites (56a):** `_kit/copy.ts:355` `MC_CELL_EMPTY` splits into value **`unavailable`** + caption
**`this cycle`** (as `design/src/components/figure-cell.mjs:40` already draws it); `Setups.tsx:52`
renders **two** sentences where it renders one — `[]` keeps `No clean setup right now.`
**byte-for-byte**, `undefined` renders **`Setups unavailable this cycle.`**. **Nothing else** — the
`*_WHOLE_EMPTY` prose (`copy.ts:297,352-354`) is widget-body prose, not values, and is untouched.
**A third change is a conflict, not a detail** — U-30 (`Setups.tsx:41`'s `toUpperCase()`) is **withdrawn**
carried debt.

1. **Split by figure, not by widget.** `term-structure` and `setups` are figure-free **in the DOM**. The
   two that bind a widget-local mono constant are the real work: `OffExchangeBlocks.tsx:24` → `:79-81`
   (`{b.shares.toLocaleString()} sh @ ${b.price.toFixed(2)}` at `fontFamily: MONO, fontSize: 12`) and
   `FreshPositioning.tsx:15` → `:56-58` (the same **and it interpolates `'—'` INTO the mono run**). For
   both: delete the local `MONO`, resolve register through the module, **lift the absent-value token into
   its own Sans span at the row's own 12px** (never `FigureCell`'s 15px literal size — a 15px absent
   value inside a 12px list inverts the hierarchy), **no size, layout or order change**, and name the
   visible register diff in the build report.
2. **The other six** (`market-context`, `iv-rank`, `straddle-move`, `dealer-flow-projection`,
   `term-structure`, `setups`) resolve register through the module for every DOM figure and set **no**
   typeface from a widget-local font constant (53); **none can render an untraced figure in the mono
   register in any state** (54). **`TermHeatChart.tsx:105-106` is an explicit non-goal, cited:** it
   paints `${p.atm_iv.toFixed(1)}%` onto a canvas with a hard-coded `'600 10px "IBM Plex Mono"'` — no
   `data-figure-register` and no DOM assertion can reach it, so it is named in the build report rather
   than left to read green under a criterion that cannot see it.
3. **The container-step hazard and its shipped fix (7a/8).** `Widget.tsx:180` declares
   `containerName: 'panel'`, but the nearest **named** ancestor of a quiet-band figure is the whole
   widget body: `MarketContext.tsx:443` lays `repeat(auto-fit, minmax(210px, 1fr))` across one panel, so
   four ~210px figures inside a ~900px panel **never cross the 360px threshold and the declared step
   never fires at any viewport** — with a green build and a green `type-floor.spec.tsx`, which asserts
   only that the declaration exists. Every converted multi-figure widget wraps **each figure in its own
   nested `PanelContainer`** (same name; nearest-ancestor wins — `ReadStrip.tsx:54` is the shipped
   precedent), **never a second container name and never `containerName` on the widget's own grid**.
4. **56 / 57 / 57b / 61.** Each widget keeps its **shipped composition** — ordering, grouping and label
   wording unchanged, every sentence not named in 56a byte-identical, proven by a scan. Each
   unavailable-this-cycle state renders **its own** message with its figures as closed-nine members, and
   an unavailable widget never blanks or degrades a neighbour. A widget whose input was **never
   delivered** says so in its own words and states **no market fact** about a ticker nobody scored
   (`FreshPositioning.tsx:41` vs `:45` and `OffExchangeBlocks.tsx:46` vs `:50` already split the two
   arms). The off-exchange band stays neutral and context-only: no directional colour, no side claim,
   block prints display-only.
5. **58 — no quiet-band figure carries a live mark in any connection state.** Assert `figure-live-dot`
   count is zero across all eight.
6. **59 — the off-exchange proximity chip.** `OffExchangeBlocks.tsx:85-89` wraps a bare `<span>` in a
   `Tooltip` — hover-only, outside the four widgets ruling 6 fixed. Give it the file-local idiom
   (`Tooltip describeChild` + `tabIndex={0}` + `aria-describedby`), **`PROXIMITY_TOOLTIP` wording
   unchanged**. FE-13 proves tap + keyboard in the browser at every checked width.
7. **Run:** `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets`.

**MUTATION PROOF Q (criterion 54, SB).** Render `'unavailable'` inside the mono run of
`FreshPositioning.tsx`. The register test **and** `fonts.spec.ts` needle 1 must both go red. Record;
revert. **MUTATION PROOF R (56a).** Make the `undefined` and `[]` setups arms share one sentence again.
The two-arm test must go red. Record; revert.
**Reviewer probe:** is `ruling 6`'s layout freeze intact — same ordering, grouping and label wording — and
is there exactly **one** container name (`panel`) in every file this task touched?

## FE-12 — D-C: the `Widget` frame's ⓘ, the `AccessibleHelp` promotion, and AC-35 extended to eight frame roots

**Owns:** new `apps/dashboard/src/app/shared/ui/AccessibleHelp.tsx` · `apps/dashboard/src/app/shared/ui/index.ts` · `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx` · the nine importers (`_kit/FigureCell.tsx`, `market-context/MarketContext.tsx`, `dealer-flow-projection/DealerFlowProjection.tsx`, `iv-rank/IvRank.tsx`, `straddle-move/StraddleMove.tsx`, `ai-rec/{DecisionCard,GroundingNote,ProvenanceChip,reasoning}.tsx`) · `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AccessibleHelp.tsx` (**deleted**) · `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts`
**Depends on:** FE-1 · **Independent:** no (shares the e2e spec with FE-13) · **Spec:** §2.8 · **Criteria:** U-32 (SB), 59 (frame half), 66 (this control)
**Specs edited:** `curvature-v2.spec.ts:496-592` (**extended, not merely re-run**). **Copy diffs: none.**
**Commit boundary:** the promotion and the `Widget.tsx` edit land **together** — U-32 is not satisfiable
by either half alone, and shipping the frame edit without the move would leave a `shared/` → `pages/`
import in the tree.

1. **Promote, do not re-implement.** Move `pages/ticker/widgets/ai-rec/AccessibleHelp.tsx` to
   `shared/ui/AccessibleHelp.tsx` **byte-for-byte** (same props `label`/`text`, same `aria-label`, same
   `stopPropagation` on click **and** focus, same `enterTouchDelay={0}` — every one of those is a
   live-browser-confirmed defect fix, documented in its own header) and re-point the **nine** existing
   importers with **zero behaviour change**. Wiring it in where it stands would make `shared/` import
   from `pages/` — the exact inversion §2.1 refuses for the figure module, recorded twice in shipped code
   (`notANumber.ts:18-23`, `liveClaim.ts:9-14`).
2. **One change at the single render site.** `Widget.tsx:245-249`:
   ```tsx
   {info && <AccessibleHelp label={`About ${title}`} text={info} />}
   ```
   All eight live `info=` sites are fixed **by construction** — `OffExchangeBlocks.tsx:39`,
   `DealerFlowProjection.tsx:159`, `TermStructure.tsx:34`, `MarketContext.tsx:417`,
   `FreshPositioning.tsx:38`, `IvRank.tsx:276`, `StructureHeroPanel.tsx:216`, `LiveTape.tsx:179`
   (verified at source: exactly eight `<Widget … info=…>`).
3. **The accessible name is part of the criterion, not a style choice.** AC-35's helper resolves its
   target as `container.getByRole('button', { name: /^About /i }).first()` (`:577`, `:588`), and a
   frame-scoped container holds the header **and** the body. Because `Widget.tsx:452-453` renders the
   header box before the body box, `.first()` resolves to the **new header control only if it carries
   the `About ` prefix**. Named anything else it falls through to a pre-existing body button
   (`IvRank.tsx:118`, `MarketContext.tsx:143`, `DealerFlowProjection.tsx:80`, or a `FigureCell` ⓘ) and
   the suite reports green **without ever exercising the control D-C repairs**.
4. **AC-35 gains a SECOND, frame-scoped site list.** The five shipped entries stay **exactly** as they
   are and are **not** interchangeable with the new list — they prove ruling 6's body controls and the
   `FigureCell` primitive, and `straddle-move` passes no `info` prop at all. The new list enumerates all
   eight `info=` sites at the **frame root** `data-testid="widget-{id}"` (`Widget.tsx:335`) — including
   `widget-structure-hero` and `widget-live-tape` — and asserts, on that frame's **header** ⓘ under the
   name above, the four properties the shipped helper already asserts (`:530-557`): a real `<button>`,
   revealed by a genuine tap, revealed by keyboard focus, dismissed by Escape. **Scoping to a widget's
   own body testid can never reach it** — `structure-hero` (`StructureHeroPanel.tsx:239`), `live-tape`
   (`LiveTape.tsx:183`), `iv-rank` (`IvRank.tsx:280`) and their peers are `<Box>`es **inside**
   `<Widget>`'s body, and the frame header is not in that subtree. `ladder-foot` (`:585-589`) targets
   `LadderFoot.tsx:23`'s own `FigureCell` ⓘ — a different control D-C does not touch — and **does not
   count** toward U-32, nor does any other body-level `FigureCell` control.
5. **Re-run the five desk specs named in §2.8 inside this criterion, for the hero AND the live tape**,
   and record each exit code: `curvature-v2.spec.ts:496-592` (extended) ·
   `ticker-hierarchy.spec.tsx:85,100,117-119` (a new focusable button inside the shared frame changes the
   desk's accessible tree and tab order at all eight sites) ·
   `single-motion-moment.spec.ts:228-236,265-277` (its poison run string-transforms the **real**
   `Widget.tsx` source, so it is in scope by construction) ·
   `live-dot-census.spec.tsx:170-184,221-223,283-294` · `LiveTape.spec.tsx:114-436`. Include
   `ticker-desk-composition.spec.tsx:129` (it reads `widget-live-tape`'s `textContent`; `AccessibleHelp`
   renders an `aria-label` with no visible text, so it **should** be unaffected — cheap to include, and
   its greenness is evidence rather than an assumption). **The desk is reopened for this single change
   and nothing else**: no desk layout, copy, state or spec content changes.
6. **Run:** the five specs above under vitest, then FE-13 runs the e2e half.

**MUTATION PROOF S (U-32, SB — required by name).** Rename the promoted header button, or drop the
`About ` prefix, and AC-35 must go **red at all eight frame sites**. A rename that leaves it green is the
vacuous gate `[structural-over-prose-enforcement]` and criterion 69 exist to catch. Record the eight
failures; revert.
**Reviewer probe:** does `grep -rn "ai-rec/AccessibleHelp" apps/dashboard/src` return **zero**? Does
`shared/ui/Widget/Widget.tsx` import only from `shared/`? And does the new AC-35 list contain **eight**
`widget-` roots, hero and tape included?

## FE-13 — The browser layer: seeded pages, the executed case list, the rendered step, the touch floor

**Owns:** `apps/dashboard-e2e/src/e2e/{no-overflow.spec.ts,curvature-v2.spec.ts}` (+ `playwright.config.ts` **only** if a new file proves unavoidable)
**Depends on:** FE-3…FE-12 · **Independent:** no · **Spec:** §7 · **Criteria:** 21 (SB), 37A, 62 (SB), 63 (SB), 64, 65, 66, 7a (the rendered proof)
**Specs edited:** both e2e files. **Copy diffs: none.**

1. **Extend `seed()` (T4 — required work, not optional).** `no-overflow.spec.ts:520-547` takes
   `{ scheme, positions }` only, so `/alerts` is walked with **no rules and no events** and `/scanner`'s
   wide-band walk asserts only that the page is attached — a zero-row scan passes. Add
   `alerts?: 'seeded'`, writing a **non-empty** `convexa.alerts.v1` blob (two rules of different kinds
   incl. a price threshold, three events, one unread) via the same `addInitScript`, and add a
   **pre-measure count assertion** on `/scanner` (`scan-row` count `> 0` — the shipped fixture at `:153-183`
   already returns three rows) and on `/alerts` (`alerts-rule` count `> 0`), the idiom the positions
   cases already use at `:1033`. **Without this, criterion 62 is green on empty pages.**
2. **62 — 393 in BOTH schemes, and 834 / 900 / 1280 in the one scheme the standing suite runs**
   (`:33`, `:47-54`; **834 already ships** — do not add it, keep it green), over the four surfaces,
   **seeded**. 21: at every width where the dense table renders, no column is clipped, the table scrolls
   **inside its own container** and the page never scrolls sideways.
3. **63 — the executed case list.** `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list`
   from the **repo root** (T3), captured into the build report, naming every width × scheme combination
   row 62 claims. `playwright.config.ts:30-38` is an **allowlist**: a combination **claimed but not
   executed** is a FAIL of 63, not a PASS of 62.
4. **37A (D-B).** All five sections — Account · Preferences · Risk inputs · AI providers · Brokerage —
   reachable at **every checked width** in the shipped **single 640px column** (`SettingsPage.tsx:156`),
   with no page-body overflow. **No rail, no tabs — that is phase 4.**
5. **7a — the rendered container step.** At 1280 vs 393 on `/positions`, read
   `getComputedStyle(...).fontSize` of `[data-testid="positions-net-pl"]`'s value inside its
   `PanelContainer` and assert the **wide** measurement is `20px` and the **narrow** one steps to `17px`.
   This is the rendered assertion §7 invariant 5 demands; a rule-presence assertion is explicitly not
   sufficient and jsdom cannot evaluate a container query. *(Planning decision: criterion 7a is marked
   `test`; it is automated here in Playwright because §7 assigns container stepping to the browser and
   states that no criterion claims a jsdom proof of stepping. Recorded in FE-14 item 9.)*
6. **66 — the 44px effective hit area in BOTH dimensions on a coarse pointer at 393px** for every control
   this phase creates or touches: the eight frame ⓘs, the off-exchange proximity chip, the three
   positions literal tips, the alerts write affordances, the settings controls. `test.use({ hasTouch: true })`
   makes `@media (pointer: coarse)` true and `theme.ts:132-137` floors `button, [role="button"], a` at
   44×44 (T6) — **measure `boundingBox()`, do not restyle**. Anything failing outside that set is
   itemized with `file:line` in the build report as carried debt with a phase attached.
7. **64 / 65.** In light mode at 393 and 1280, no surface this phase touches renders a scheme-invariant
   background or text colour — the shipped `hex-discipline.spec.ts` (extended in phase 2 to catch
   `rgb(a)` literals, with **per-value** exemptions, so a whole-file waiver is no longer available and a
   new hardcoded colour is build-breaking **today**) plus a token-pair assertion that every palette slot
   these surfaces bind resolves differently under `theme` and `lightTheme`; and no figure, chip or label
   renders below the **11px floor** at any checked width.
8. **Run:** `npm run ports:free && npx playwright install chromium && npm run build` (production, never
   the dev server), then `npx nx e2e dashboard-e2e` from the repo root. **At or above phase 2's close-out
   of 86/86.**

**Reviewer probe:** does the `--list` output actually contain the alerts-seeded cases, and does the
`/scanner` walk assert a row count **before** it measures? A wide-band walk over a zero-row table is the
vacuity row 62 exists to close.

## FE-14 — Frontend closer: verification run, build report, review captures, canon amendment

**Owns:** `.spire/clusters/tech/contracts/curvature-v2-surfaces/BUILD_REPORT.md` and the review captures it references
**Depends on:** FE-1 … FE-13 · **Independent:** no · **This is the frontend closer.**
**Implements no worker paths** — if a suite is red, **report it**; do not re-implement FE-1…FE-13's files.

Run the whole verification track below, record **exit codes**, then write the report carrying, at
minimum — these are deliverables, not nice-to-haves:

1. **Every mutation proof A–S with its recorded failure text**, and for each, the **anti-vacuity**
   evidence that the poison test itself bites (criterion 69, SB). Phase 1 shipped two
   `expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading — a proof without its red output is
   not a proof.
2. **`fonts.spec.ts`'s `EXEMPT` map is EMPTY** (criterion N-1 admits no exemption in its final state),
   and `liveClaim.spec.ts`'s `EXEMPT` still carries exactly its one live-checked desk entry.
3. **The itemized visible copy diffs — the closed set, nothing else:** scanner `cadenceHeader` +
   `cadenceGloss` (CF-1); `_kit/copy.ts:355` split into value + caption and `Setups.tsx:52`'s second
   sentence (56a); positions **additions only** — the coverage caption (35b/35c) — plus the six class-(1)
   truth-mark replacements (`PositionRow.tsx:68,378,388,549`, `PositionsView.tsx:367`, `labels.ts:57`)
   and the two broker ones (`BrokerGroupHeader.tsx:215`, `BrokerPositionRow.tsx:128`); alerts and
   settings changes per §3 D/E. Anything beyond these is an R2-class conflict, not a lane decision.
4. **The executed e2e case list** (`--list` + the run's exit code), naming 393 dark · 393 light · 834 ·
   900 · 1280 (criterion 63, SB).
5. **`npm run typecheck` exit code, recorded SEPARATELY from `nx test`'s** (criterion 68, SB), and the
   suite's exit code **against the stated baseline** (exit 1 at 2691/2694 with the three named load
   timeouts is at baseline; anything else is a regression).
6. **The `review` rows, each with its capture:** 7b · 15 · 43 · 47c · 56 · 60 · 63 · 69 · U-15 · U-19 ·
   U-24 · U-27 · U-37.
7. **Named debt, each with `file:line` and a phase** — verbatim from SPEC §1 Out / Future, plus this
   plan's three: per-symbol live marks on `/scanner` (the phase that adds `market_session` + `live` to
   `/api/stream/prices`) · the quiet-tape false-offline watchdog (`useLivePrices.ts:66,84-86`;
   `stream.rs:444-449` — the same phase, because the honest fix is one line on that route and it is a
   backend change criterion 67 forbids) · alert-history re-labelling (`types.ts:32`,
   `AlertsPage.tsx:225`; additive, read-new-else-old, `message` retained, a fixture from a pre-phase
   blob) · settings section navigation (**phase 4**, with the three behaviours D-B names) ·
   `TermHeatChart.tsx:105-106` (explicit non-goal) · U-30 `Setups.tsx:41` · U-8's foot line (phase 4) ·
   **`features/trading/orders/OrderRow.tsx:172`'s `⏸` (Z-1)** · **the alerts-local refusal helper
   duplicating `FaultedBanner.tsx:92-117`'s treatment** · the scanner's five-band responsive column set
   and the positions laptop column drop (phase 4).
8. **The canon amendment queued for GATE S, ONE clause, not applied by this build:** rule 13 becomes
   *"traced to Convexa's computation **or to a record the trader entered**"* (OWNER — D-D). Plus the
   **Amendments question filed, not answered**: does the Icons row's colour-emoji clause reach `U+26A0`
   in a chip label (`labels.ts:196,205,211`)? The chips ship byte-identical either way.
9. **The three planning decisions a reviewer should see rather than re-derive:** criterion 7a is proven
   in Playwright (§7 assigns container stepping to the browser; no criterion claims a jsdom proof) ·
   N-1's scan scope is the spec's three trees, so `features/auth/`'s face de-binding is proven by FE-8's
   component assertion instead · the two GATE Z scope readings (Z-1, Z-2) with their reversals.

---

# Verification track

Exact commands, exact expectations. **Check EXIT CODES, not printed summaries.** Counts are verified
directly under vitest, never read off the Nx summary — an exit 0 with **zero tests collected** renders
identically in Nx's output. PowerShell: `$LASTEXITCODE`. Git Bash: `echo $?` / `${PIPESTATUS[0]}`.

| # | Command (cwd `C:\Dev\convexa` unless stated) | Expected | Criteria |
|---|---|---|---|
| V1 | `cd apps/dashboard && npx vitest run src/app/shared/figure` | exit **0**; the nine-state table green | 1, 2, 3, 4 |
| V2 | `cd apps/dashboard && npx vitest run src/app/shared/theme/fonts.spec.ts` | exit **0**; **both** new mutation guards present; `EXEMPT` empty at close | N-1 (SB) |
| V3 | `cd apps/dashboard && npx vitest run src/app/shared/liveness` | exit **0**; `FENCED_SOURCES` loads all five new trees | 6 (SB) |
| V4 | `cd apps/dashboard && npx vitest run src/app/pages/scanner` | exit **0**; the CF-1 freeze scan names exactly two exempt constants | 9–20, U-6, 22, CF-1 |
| V5 | `cd apps/dashboard && npx vitest run src/app/features/trading/positions src/app/features/trading/outcomes src/app/features/trading/orders` | exit **0**; the `⏸` scan green over the in-scope trees | 23–35, U-9, U-15a, CF-2 |
| V6 | `cd apps/dashboard && npx vitest run src/app/features/trading/broker` | exit **0**; the no-`not recorded` census intact | 25, 34 |
| V7 | `cd apps/dashboard && npx vitest run src/app/pages/positions` | exit **0**; the five Net P/L arms green | 35a–35e, 7a(decl), 8 |
| V8 | `cd apps/dashboard && npx vitest run src/app/features/auth` | exit **0** | 36, 39–42, U-19, U-35 |
| V9 | `cd apps/dashboard && npx vitest run src/app/features/alerts src/app/pages/alerts` | exit **0**; the pre-phase-blob case compares the **raw stored string** | 44–52, N-5, U-23a |
| V10 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets` | exit **0**; `lookalikes.spec.ts` **unamended** | 53–61 |
| V11 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/ticker-hierarchy.spec.tsx src/app/pages/ticker/live-dot-census.spec.tsx src/app/pages/ticker/ticker-desk-composition.spec.tsx src/app/shared/theme/single-motion-moment.spec.ts src/app/pages/ticker/widgets/live-tape` | exit **0** — the five desk specs D-C reopens, **re-run inside U-32** | U-32 (SB) |
| V12 | `npx nx test @convexa/dashboard --skip-nx-cache` | exit **0**, or **exit 1 at ≥2691/2694 with exactly the three named load timeouts** (baseline); any other failure is real | 68 |
| V13 | `npm run typecheck` | exit **0**, recorded **separately** — the only thing that sees the brand and criterion 2's poison | 68 (SB) |
| V14 | `npm run lint` | exit **0** | house |
| V15 | `npm run format:check -- --files <changed>` | exit **0**. **Never a bare `nx format:write`** | house |
| V16 | `npm run ports:free && npx playwright install chromium && npm run build` | exit **0** each; the **production** build, both address families swept | 62, 66 |
| V17 | `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list` (repo root) | the executed case list, naming 393 dark · 393 light · 834 · 900 · 1280 | 63 (SB) |
| V18 | `npx nx e2e dashboard-e2e` (repo root) | exit **0**; **at or above phase 2's 86/86** against the production build | 21, 37A, 62, 66, 7a |
| V19 | `git diff --name-only origin/main...HEAD -- apps/api \| wc -l` | **0**, count reported | 67 (SB) |
| V20 | `node .claude/tools/interface_conformance.mjs --contract …/curvature-v2-surfaces/INTERFACE_CONTRACT.md --url http://localhost:8000 --report …/conformance-receipt.json` | exit **0**, `2 endpoint(s)`, `/api/scan` **first**; **or** `NOT RUN — no reachable backend, NO_BACKEND_CHANGE exemption` recorded honestly | §6 |

**Mutation proofs, run and recorded** (`[structural-over-prose-enforcement]`; each proven non-vacuous):

| Proof | Poison | Must |
|---|---|---|
| A | delete `register` from `ReadStrip.tsx:59-65` | `npm run typecheck` red (TS2741/TS2322); `nx test` **stays green** — that is the point |
| B | a closed-nine member back inside a mono-bound `sx` (`PositionRow.tsx`) | `fonts.spec.ts` needle 1 red, naming file + member |
| C | `fontFamily: typographyTokens.monoFontFamily` re-added to `ScanCells.tsx` | `fonts.spec.ts` needle 2 red, naming the file |
| D | `genuineIsLive(...)` planted in `pages/scanner/Scanner.tsx` (**a NEW glob**) | the widened fence red, naming that file |
| E | `ScanCard` renders the raw regime enum | the both-layouts test red on the mismatch |
| F | drop the provenance term from `priceOffline` | the never-ticked-symbol test red on an unexpected pause mark |
| G | change any third `SCAN_COPY` value by one byte | the CF-1 freeze scan red, naming the key |
| H | restore `'⏸'` at `PositionRow.tsx:388` | the positions `⏸` scan red, naming the file |
| I | give the bare offline arm the `last known` caption | the 27b test red |
| J | return `0` for the unmarked-book Net P/L | the 35b test red on a number **and** a direction colour |
| K | let the coverage caption beat the offline caption | the 35e precedence test red |
| L | `brokerFactText({state:'not_supplied'})` → `not recorded` | the broker no-`not recorded` census red |
| M | restore `severity="success"` on the settings confirmation | the neutral-chrome test red |
| N | remove the `readFaulted` guard from `persist()` | the corrupt-blob test red on the **raw stored string** being overwritten |
| O | restore `?? 60` on the score-gate line | the fabricated-threshold test red |
| P | make read/unread differ only by the edge colour | the black-and-white test red |
| Q | render `'unavailable'` inside `FreshPositioning`'s mono run | the register test **and** needle 1 both red |
| R | collapse the two setups arms back into one sentence | the 56a two-arm test red |
| S | rename the promoted header button / drop the `About ` prefix | **AC-35 red at all eight frame sites** (a green here is the vacuous gate 69 exists to catch) |

---

# Criterion → task → proof → poison (all 95 rows; **SB** rows carry a named red-going poison)

| # | SB | Task | Proof | Poison (must go red) |
|---|---|---|---|---|
| 1 | SB | FE-1, FE-3, FE-5..FE-11 | register attribute present on every converted figure; V1/V2 | A — delete a `register` |
| 2 | SB | FE-1 | typeproof; V13 | A |
| 3 | SB | FE-1, FE-3, FE-5 | literal arm is Sans, never stepped, no unit; V1/V4/V5 | B |
| 4 | SB | FE-3, FE-5, FE-10 | per-surface text scan: no `null`/`undefined`/`NaN`/empty/`0`-for-absent | B |
| 5 | SB | FE-1, FE-3 | `live` only via `LiveClaim`; no page/widget-level claim; V1/V4 | D |
| 6 | SB | FE-2 | widened fence + `genuineIsLive` gone; V3 | D |
| 7a | — | FE-6, FE-11, FE-13 | **rendered** step 20→17 measured in Chromium; V18 | — |
| 7b | — | FE-6 | build report names every off-ladder site with its reason | — |
| 8 | — | FE-6, FE-11 | nested `PanelContainer`s, one container name; V7/V10 | — |
| N-1 | SB | FE-1 (+ every surface task's EXEMPT removal) | two needles, two own guards; V2 | B and C |
| 9 | SB | FE-3 | table vs card: same text + register + state; V4 | E |
| 10 | SB | FE-3 | zero `figure-live-dot` on structure figures; V4 | D |
| 11A | SB | FE-3, FE-4 | zero live mark in every connection state; V4 | D |
| 12 | SB | FE-4 | `cell-price[data-figure-state=offline-retained]`, event-driven; V4 | F |
| 13 | SB | FE-4 | never-ticked symbol at full strength; `retained:false` unreachable | F |
| 14 | SB | FE-4 | no flash during a drop; V4 | F |
| 15 | — | FE-4 | review: header + gloss assert liveness in no state | G |
| 16 | — | FE-4 | worker-down keeps rows + registers, blanks nothing | — |
| 17 | — | FE-3 | uncomputed row → chip + closed-nine, never `0`, never a mono `—` | B |
| U-6 | — | FE-3 | miss → `unavailable`; null → `—`; V4 | E |
| 18 | — | FE-3 | cold placeholder has zero figures, never re-entered | — |
| 19 | — | FE-3 | two empties, two recovery controls, neither an error | — |
| 20 | — | FE-3 | sign-in wall names the surface | — |
| 21 | SB | FE-13 | no clipped column; table scrolls in its own container; V18 | seeding removed → row-count assertion red |
| 22 | SB | FE-3 | card carries every datum; stays one anchor, no nested control | E |
| CF-1 | SB | FE-4 | freeze scan, exemption list = exactly two constants; V4 | G |
| 23 | SB | FE-5, FE-6, FE-7 | register on every positions/broker/header figure; V5/V6/V7 | A |
| 24 | SB | FE-5 | three producible states, each with its own explanation; V5 | L |
| 25 | SB | FE-5, FE-7 | three fixtures → three arms; sim never `not provided`, broker never `not recorded` | L |
| 26 | — | FE-5 | `no basis` cell-level; the dollar P/L beside it still a figure | — |
| 27a | SB | FE-5 | retained value + stroke mark + `offline · last known`; V5 | I |
| 27b | SB | FE-5 | member + pause icon, **no** last-known words; V5 | I |
| 28 | SB | FE-5 | no bare pause marker anywhere; V5 | H |
| 29 | SB | FE-5, FE-7 | `⏸` scan over the three in-scope trees; V5/V6 | H |
| U-9 | — | FE-5 | record fields never dim, never wear a mark | I |
| U-15 | — | FE-5 | review: three tips, wording unchanged | — |
| U-15a | SB | FE-5 | `describeChild` + `aria-describedby`, focusable, zero wording change; V5 | remove `tabIndex` → red |
| 30 | — | FE-5 | faulted: refused-but-focusable, nothing dims, no mark | N |
| 31 | — | FE-5 | closed/cancelled rows carry neither mark | — |
| 32 | — | FE-5 | wall names the surface | — |
| 33 | — | FE-5 | empty book ≠ wall ≠ load failure | — |
| 34 | SB | FE-7 | read-only; `fetch` spy shows no new call; V6 | add a cancel control → red |
| 35 | — | FE-5, FE-6 | tint only on a computed P&L over marked rows | J |
| 35a | SB | FE-6 | no open rows → `—`, no tint; V7 | J |
| 35b | SB | FE-6 | none marked → `unavailable` + `0 of {m} open marked`; V7 | J |
| 35c | — | FE-6 | some marked → sum + mandatory caption | J |
| 35d | — | FE-6 | all marked → total, no caption | J |
| 35e | SB | FE-6 | F4/F5 + offline caption **precedence**; V7 | K |
| CF-2 | SB | FE-5 | freeze scan + the itemized permitted changes; V5 | change any other positions label → red |
| 36 | SB | FE-8 | Mono (D-D) + `not set`, no pre-filled number; V8 | restore `placeholder="0"` → red |
| 37A | — | FE-13 | five sections reachable at every width, no body overflow; V18 | — |
| 39 | SB | FE-8 | signed out: browser-only stated, footnote absent; V8 | import the canvas footnote → red |
| 40 | SB | FE-8 | non-blocking error, control reverts, no confirmation; V8 | show the confirmation on failure → red |
| 41 | SB | FE-8 | confirmation neutral, error keeps severity **+ icon**; V8 | M |
| 42 | SB | FE-8 | no live mark, no pulse in any state; V8 | add a pulse → red |
| 43 | — | FE-8 | review: masked hint only | — |
| U-19 | — | FE-8 | review: one line while the session resolves | — |
| U-35 | — | FE-3, FE-8 | radius ladder 12/8/999; string-radius scan; V4/V8 | restore `'10px'` → red |
| 44 | SB | FE-10 | distinction in label row + type, not the edge alone; V9 | P |
| 45 | SB | FE-10 | closed lookups; no raw wire token in the DOM; V9 | render `r.kind` raw → red |
| 46 | SB | FE-10 | absent threshold → closed-nine member; V9 | O |
| 47a | SB | FE-10 | price threshold renders, Mono, currency prefix; V9 | drop the prefix → red |
| 47b | — | FE-10 | bare index `≥ 72`, no invented unit | add ` pts` → red |
| 47c | — | FE-10 | review: the money input states its unit as a control | — |
| 47d | SB | FE-10 | level from `LEVELS`, no number of its own, absent → `not recorded`; tier line byte-identical | render `level` → red |
| 48 | — | FE-10 | three distinct messages, each naming its next action | — |
| 49 | SB | FE-10 | "structure snapshots" stated; no live mark, no pulse; V9 | add a live mark → red |
| 50 | — | FE-10 | denied/unavailable permission says so; never reads "on" | — |
| 51 | SB | FE-9 | pre-phase blob read back intact; V9 | N |
| 52 | SB | FE-9 | corrupt blob → empty list, **raw original preserved**; V9 | N |
| N-5 | — | FE-10 | banner + refused-but-focusable, nothing dims, no mark | N |
| U-23a | — | FE-10 | new firing built from the closed lookups; no re-label claim | render a stale label → red |
| U-24 | — | FE-10 | review: back-fill honesty + browser-only disclosure | — |
| U-27 | — | FE-10 | review: every firing timestamp names its zone | — |
| 53 | SB | FE-11 | stated register on all eight; no widget-local font constant; V10 | Q |
| 54 | SB | FE-11 | no untraced figure in the mono register, any state; V10 | Q |
| 56 | — | FE-11 | review + byte-identical scan over shipped sentences | R |
| 56a | — | FE-11 | exactly two sites; `[]` arm byte-for-byte; V10 | R |
| 57 | — | FE-11 | own message + closed-nine members; no neighbour degraded | — |
| 57b | — | FE-11 | never-delivered says so, asserts no market fact | — |
| 58 | SB | FE-11 | zero live marks across the band; V10 | pass a claim to a widget figure → red |
| 59 | SB | FE-11, FE-12, FE-13 | tap + keyboard at every width, proximity chip included; V18 | S (frames); remove `tabIndex` on the chip → red |
| U-32 | SB | FE-12 | eight frame roots asserted; five desk specs re-run; V11/V18 | S |
| 60 | — | FE-11 | review: each widget states its own basis + as-of | — |
| 61 | — | FE-11 | neutral, context-only, display-only prints | tint the chip → red |
| 62 | SB | FE-13 | seeded pages at 393×2 + 834/900/1280; V18 | drop the seed → the count assertion reds |
| 63 | SB | FE-13 | `--list` case list captured; V17 | unregister a spec → `--list` count drops |
| 64 | — | FE-13 | hex-discipline + token-pair + light walk | hardcode a colour → red |
| 65 | — | FE-13 | no type below the 11px floor at any width | — |
| 66 | — | FE-13 | `boundingBox()` ≥44×44 on coarse at 393 | — |
| 67 | SB | BE-1 | empty three-dot diff + score identity; V19 | any `apps/api` write → non-zero count |
| 68 | SB | all | `typecheck` exit recorded separately; V13 | A |
| 69 | SB | FE-14 | every proof A–S with its red output + anti-vacuity | a proof without recorded red output is a FAIL |
| 70 | SB | FE-9 | loss-free against a pre-phase blob; V9 | N |
| U-37 | — | FE-14 | review: every degraded copy names the degrade | — |

---

## Independence

Lane is `backend` or `frontend` only. **All rows `Independent: no`** — the honest **cannot split**
signal, not a missing table (PLAN_METHOD: *"An all-`no` table is not a miss; it is 'cannot split.'"*).
Three grounds, all measured:

1. **PLAN_METHOD's frontend rule.** `yes` requires **SPEC §4** to name the files a task owns. §4's file
   citations are `labels.ts:25,26-29,32`, `Scanner.tsx:143-146`, `scanner.risk.spec.tsx:869`,
   `Jargon.tsx:19-30`, `PositionsPage.tsx:147-154,189,193`, `PositionRow.tsx:68,378,388`,
   `FigureCell.tsx:253,262,271`, `localPrefs.ts:15`, `notANumber.ts:26-36`, `types.ts:20-22`,
   `_kit/copy.ts:355,297,352-354`, `MarketContext.tsx:291,299,375`, `Setups.tsx:32,52`,
   `FreshPositioning.tsx:41,45`, `OffExchangeBlocks.tsx:46,50`, `design/src/screens/settings.mjs:30`,
   `design/src/components/figure-cell.mjs:40`. It names **none** of `shared/figure/**` (new),
   `ScanCells.tsx`, `ScanTable.tsx`, `ScanCard.tsx`, `Widget.tsx`, `AccessibleHelp.tsx`,
   `alerts/store.ts`, `AlertsPage.tsx`, `SettingsPage.tsx`, `RiskInputsSection.tsx`, the broker files,
   `fonts.spec.ts`, `liveClaim.spec.ts` or any e2e file. Where §4 does not name the files, the row is `no`.
2. **Pervasive write-path overlap.** `shared/theme/fonts.spec.ts` is written by **FE-1, FE-3, FE-5, FE-6
   and FE-7** (each removes its own EXEMPT entries). `pages/positions/PositionsPage.tsx` by FE-2 and
   FE-6. `pages/scanner/**` by FE-3 and FE-4. `features/alerts/**` by FE-9 and FE-10.
   `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` by FE-12 and FE-13.
   `_kit/FigureCell.tsx` by FE-1 while FE-12 re-points its `AccessibleHelp` import.
3. **Hard mechanism prerequisites.** FE-1's module is a prerequisite for every register conversion below
   it; FE-9's latch must land before FE-10 touches an alerts write path (the loss-free rule); FE-12's
   promotion and frame edit are one indivisible change (§2.8); FE-13 measures what FE-3…FE-12 render.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| BE-1 | backend | `.spire/clusters/tech/contracts/curvature-v2-surfaces/conformance-receipt.json` | — | no |
| FE-1 | frontend | `apps/dashboard/src/app/shared/figure/**`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx`, `apps/dashboard/src/app/shared/theme/fonts.spec.ts` | — | no |
| FE-2 | frontend | `apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts`, `apps/dashboard/src/app/pages/positions/PositionsPage.tsx` | — | no |
| FE-3 | frontend | `apps/dashboard/src/app/pages/scanner/**`, `apps/dashboard/src/app/shared/theme/fonts.spec.ts`, `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts` | FE-1 | no |
| FE-4 | frontend | `apps/dashboard/src/app/pages/scanner/**` | FE-1, FE-3 | no |
| FE-5 | frontend | `apps/dashboard/src/app/features/trading/positions/**`, `apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx`, `apps/dashboard/src/app/features/trading/orders/OrderRow.tsx`, `apps/dashboard/src/app/features/trading/orders/OrderDetailDialog.tsx`, `apps/dashboard/src/app/shared/theme/fonts.spec.ts` | FE-1 | no |
| FE-6 | frontend | `apps/dashboard/src/app/pages/positions/**`, `apps/dashboard/src/app/shared/theme/fonts.spec.ts` | FE-1, FE-2 | no |
| FE-7 | frontend | `apps/dashboard/src/app/features/trading/broker/**`, `apps/dashboard/src/app/shared/theme/fonts.spec.ts` | FE-1 | no |
| FE-8 | frontend | `apps/dashboard/src/app/features/auth/**` | FE-1 | no |
| FE-9 | frontend | `apps/dashboard/src/app/features/alerts/store.ts`, `apps/dashboard/src/app/features/alerts/store.spec.ts` | — | no |
| FE-10 | frontend | `apps/dashboard/src/app/pages/alerts/**`, `apps/dashboard/src/app/features/alerts/**` | FE-1, FE-9 | no |
| FE-11 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/**` | FE-1 | no |
| FE-12 | frontend | `apps/dashboard/src/app/shared/ui/**`, `apps/dashboard/src/app/pages/ticker/widgets/**`, `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` | FE-1 | no |
| FE-13 | frontend | `apps/dashboard-e2e/**` | FE-3, FE-4, FE-5, FE-6, FE-7, FE-8, FE-10, FE-11, FE-12 | no |
| FE-14 | frontend | `.spire/clusters/tech/contracts/curvature-v2-surfaces/BUILD_REPORT.md` | FE-1, FE-2, FE-3, FE-4, FE-5, FE-6, FE-7, FE-8, FE-9, FE-10, FE-11, FE-12, FE-13 | no |

**Closers.** Backend: **BE-1** (empty-diff proof, score identity and `conformance-receipt.json` only — it
re-implements no worker paths; there are none). Frontend: **FE-14** (leftover verification, the report and
the review captures only — it implements no worker paths).

**Estimated lane count: 2** — one backend worker (BE-1) and one frontend worker (FE-1 → FE-14 in order).

---

## Debt and non-goals, carried verbatim from SPEC §1 so the build lane cannot re-scope

**Out of scope.** Settings section navigation (rail ≥900 → horizontal control <900) — **OUT, phase 4**
(OWNER — D-B); pm rows 37/38 and ux U-17/U-18 are **withdrawn**, and the canvas footnote
`Saved to your account.` (`design/src/screens/settings.mjs:30`) must **not** be imported (criterion 39).
Re-labelling alert history — **carried debt**; the Recent list may not claim history was re-labelled.
`TermHeatChart.tsx:105-106` — an **explicit non-goal, cited**. Per-symbol live marks on `/scanner` —
carried debt, dated (OWNER — D-A). The quiet-tape watchdog falsehood on `/scanner` — carried debt, dated,
**NOT repaired here** (no frontend-only change can fix it; the separating signal is a heartbeat
**comment** `EventSource` never dispatches). **No broker DATA work** — no `/api/broker/*` change, no new
broker network call, and **no change to the deliberate `NOT_RECORDED → NOT_PROVIDED` per-surface
substitution**. The `⚠` glyph in the scanner status chips **stays** — `'⚠ Stale'` and `'⚠ Error'` are
byte-identical after this phase. Landing, blog, site, methodology and lab pages; the responsive sweep
(including the scanner's five-band column set and any move of its table→cards threshold); the structure
field's point-by-point curve text-equivalent; the spacing-exemption remainder — **all phase 4**. Any
backend change, any new wire field, any new SSE event, **any new durable client key or shape**, any real
order path, any score/tier/fingerprint change, any alerts server sync. Any **tenth** not-a-number member
(an Amendments event, owner ruling 3). **Re-composing any of the eight quiet-band widgets** — ruling 6's
layout freeze stands; only the *reason* for it was corrected.

**Future (deliberately deferred), each booked in `BUILD_REPORT.md` with `file:line` and a phase.**
Per-symbol live marks on `/scanner` — the phase that adds session fields to `/api/stream/prices`. The
quiet-tape watchdog falsehood — the **same** phase. Alert-history re-labelling as an **additive**,
read-new-else-old shape change with `message` retained as fallback and a fixture authored from a
pre-phase blob. Settings section navigation — phase 4, with the three behaviours named. The scanner's
five-band responsive column set and the positions table's laptop column drop — phase 4. Server-owned
alerts (multi-device sync) — post-go-live track, not a Curvature phase. Broker tab real data — the
`broker-connect` track.

**Not buildable / rejected — recorded so a later session does not cheerfully re-propose them:**
`FigureCell` inside the scanner table or scan card · a second liveness mint for the prices stream
(option B) · adding `market_session`/`live` to `/api/stream/prices` (option C) · driving the scanner's
retained arm from the age of the per-symbol `ts` · wiring `pages/ticker/widgets/ai-rec/AccessibleHelp`
into `shared/ui/Widget/Widget.tsx` where it stands · a value-row help host on `FigureCell` · converting
the positions `literal()` cells to `FigureCell` · assuming a DOM hook for the positions `—` · declaring
`containerName` on a widget's own grid, or a second container name · asserting the container step by
rule presence · a durable shape change on `convexa.alerts.v1` to repair history · a count-shaped
criterion over the eight widgets · any new persisted user preference on these surfaces · scoping a
frame-ⓘ assertion to a widget's own body testid.

---

## Unresolved / flag at review

**U-1 — Z-1: `features/trading/orders/OrderRow.tsx:172`.** Read as out of scope (SPEC §1/§3 C enumerate
three positions surfaces; the orders panel is a fourth the spec never names) and booked as carried debt.
The wider reading collides with D-C's desk fence and would be a GATE Z question for the owner. **The
conductor should confirm the reading before FE-5 starts.**

**U-2 — Z-2: `labels.ts:57`'s ` (⏸)` inside a frozen tooltip sentence.** Deleted under §2.7's permitted
class (1) and itemized; the alternative is a named live-checked exemption and GATE Z debt.

**U-3 — SPEC §2.3 enumerates three positions `⏸` sites; the tree carries six in scope.** The extra three
are `PositionRow.tsx:549`, `PositionsView.tsx:367` and `labels.ts:57`, plus two on the Broker tab
(`BrokerGroupHeader.tsx:215`, `BrokerPositionRow.tsx:128`). Criterion 29's wording is the contract and is
broader than §2.3's list, so all are planned. Recorded so GATE Q does not read the extra edits as scope
creep.

**U-4 — `scanner.risk.spec.tsx:869` may not go red on the D-A header edit.** SPEC §4.2 states the edit
*"lands on"* that assertion; measured, the test renders the **offline** arm, whose `Prices offline` text
still satisfies `/Prices (live|offline)/`. FE-4 runs it before and after and records which. Either way it
is strengthened to pin both arms. Not a spec defect — a prediction the plan refuses to assume.

**U-5 — criterion 7a is marked `test` but §7 forbids a jsdom proof of stepping.** Planned as an
automated **Playwright** rendered assertion (FE-13 step 5), with the declaration-level assertion in
jsdom. No requirement is weakened; recorded so a reviewer sees the reasoning.

**U-6 — N-1's scan scope is the spec's three trees, which excludes `features/auth/`.** Criterion 1 covers
settings, so FE-8 removes `RiskInputsSection.tsx:29`'s local binding and proves the register with a
component assertion instead of extending the scan's spec-named scope. Flagged rather than silently
widening a criterion.

**U-7 — the alerts faulted posture uses a local helper mirroring `FaultedBanner.tsx:92-117`'s attribute
set**, rather than importing the trading domain into `features/alerts/` or renaming the shipped
`shared/ui/Refused` (a different component with different props). The alerts test asserts the **same
attribute set** so the two cannot drift silently; promoting one shared refusal treatment is booked as
debt.

**U-8 — `features/alerts/**` is outside criterion 6's five globs** (the criterion names `pages/alerts/**`
only). Measured: no banned expression exists there today. Recorded as a residual, not closed by this
plan — widening the glob beyond the criterion's own list would be a spec edit.
