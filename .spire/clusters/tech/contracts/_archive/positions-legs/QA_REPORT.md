# positions-legs — QA_REPORT (GATE Q)

> **STATUS: RE-VERIFIED AND PASSED.** Sections 0–4 below are the **original GATE Q run at `9e9350c`**
> (2 findings: AC-63/AC-69 visual gap, F-1 typecheck fail). Both were bounced to Frontend and fixed in
> two follow-up commits. **See §5 for the re-verification** (same QA session/reviewer, same rules — verify,
> repair nothing) and **§6 for the current, superseding overall verdict: PASS.** Do not read §3's "FAIL" as
> current status — it is the historical record of what was found at `9e9350c`, left unedited for the audit
> trail.

**Verifier:** fresh de-correlated QA session (Sonnet), branch `feat/positions-legs`, `main` untouched.
**Method:** ran the real suites myself and checked exit codes explicitly (not just printed summaries); ran the
runtime interface-conformance tool against a live backend; drove a real headless browser (Cypress/Electron)
against the running dev server for the highest-risk visual/layout claims, including several ad-hoc QA-only specs
(not committed to the repo, run via `--specPattern` against a temp file, artifacts deleted afterward) to get a
computed-style/screenshot ground truth for the faulted-store "refused control" visual claim; read source only to
explain what I'd already observed, per role. No source, spec, or plan file was edited (two source files were
**transiently** mutated for mutation-checking test genuineness — `migration.spec.ts`'s `qty` expectation and
`FaultedBanner.tsx`'s `sx` merge line — each reverted via a checked-out original copy immediately after the
targeted test run, confirmed by an empty `git diff`/`git status` afterward).

---

## 0. Suite / build health — AS OF `9e9350c` (original run; see §5 for the current state)

| Check | Command | Result | Evidence |
|---|---|---|---|
| Frontend unit/component/integration suite | `npx nx test dashboard --skip-nx-cache` | **PASS** | 96 test files, **1077/1077** tests, fresh (non-cached) run, exit code captured explicitly (not via a piped `tail`): `REAL_EXIT_CODE=0`. |
| Lint | `npx nx lint dashboard --skip-nx-cache` | **PASS** | 0 errors, 28 pre-existing `no-non-null-assertion` warnings (none in files this feature touched are new — spread across `TickerHeader.tsx`, `IvRank.tsx`, `LiveTape.tsx`, unrelated pre-existing surfaces). Exit code `0`. |
| Typecheck | `npx nx typecheck dashboard --skip-nx-cache` | **FAIL** | Exit code `1`. `tsc --build --emitDeclarationOnly` → `src/app/shared/lib/durable/migration.spec.ts(313,14): error TS2339: Property 'id' does not exist on type '{}'.` and `(314,14): ...Property 'qty' does not exist...`. See finding **F-1** below (resolved in §5). |
| E2E (real headless browser) | `npx nx e2e dashboard-e2e --skip-nx-cache` | **PASS** | 19/19 (`app-loads.cy.ts` 1/1, `mobile-no-overflow.cy.ts` 18/18 across dark+light), exit code `0`. Includes the AC-30 browser check the SPEC directs GATE Q to look for here ("a 4-leg disclosure EXPANDED at 393px still does not overflow" — passed both schemes). |
| Runtime interface conformance | `apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py --contract .claude/contracts/positions-legs/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000` (live backend, `npx nx serve api`) | **PASS** | `PASS GET /api/contract/{ticker} — 15 required field(s) present + well-typed`, 0 endpoint failures. |
| `apps/api` diff vs `main` | `git diff main...feat/positions-legs -- apps/api \| wc -l` | **PASS (empty)** | `0` lines. `NO_BACKEND_CHANGE` holds structurally. |
| Shared lib (`@org/api`) | — | **N/A** | `git diff main...feat/positions-legs --stat -- libs/api` is empty — the feature never touched the shared client lib, so its suite is out of the risk-based scope per the brief. |

**Finding F-1 (build-health FAIL, bounced to Frontend — RESOLVED, see §5.2).** `model/store.ts`'s `getTrade`
return type was correctly narrowed from `GhostTrade | null` to `unknown | null` as part of deleting the
`GhostTrade` type (SPEC §2.7 — `model/types GhostTrade → deleted`), but the one remaining call site in
`shared/lib/durable/migration.spec.ts` (an existing test, part of the touched-file diff for this feature per
`git diff main...feat/positions-legs -- apps/dashboard/src/app/shared/lib/durable/migration.spec.ts`, which
shows 31 insertions/12 deletions in this exact file) was not updated to match: `const t = ghost.getTrade('TSLA')!; expect(t.id)...expect(t.qty)...` still assumes a typed return. Confirmed against `main`
(`git show main:...migration.spec.ts` lines 300-306 and `git show main:...model/store.ts` line 43) that this
exact code compiled cleanly under the old `GhostTrade | null` signature — this is a genuine regression
introduced on this branch, not a pre-existing defect. Vitest does not typecheck (the precedent noted in
`OPEN_THREADS.md` §7l — a duplicate-`sx` TS17001 was likewise invisible to `nx test` and caught only by
`tsc`/`nx build`), which is exactly why the suite shows 1077/1077 green while the project does not compile.

---

## 1. Acceptance criteria (SPEC §3, verbatim, in order) — AS OF `9e9350c`

Legend: **PASS** observed to hold · **FAIL** observed not to hold · **UNVERIFIABLE** could not exercise.
"Verify by" per SPEC §3/§7 (`test` = automated, `review` = inspection) is carried alongside each row.

### A — Representation & entry

| # | Acceptance criterion (verbatim) | By | Verdict | Evidence |
|---|---|---|---|---|
| 1 | A position of two option legs — one bought, one sold, same expiration — appears as **one** row in the portfolio, not two | review | **PASS** | `positions.risk.spec.tsx` "the book renders ONE row per position (AC-1, AC-2, AC-3, AC-23)" → `AC-1 — a two-leg vertical appears as ONE row, not two`; `positionCard.spec.tsx`/`positions.integration.spec.tsx` render the same fixtures as single `<tr>`/card. |
| 2 | A shares-only position opened with a quantity and an average price appears as one row | review | **PASS** | `positions.risk.spec.tsx` `AC-2/AC-3 — a shares-only position and a covered call are each ONE row`; `multiLegEntry.spec.tsx` `AC-2/AC-3 — an equity leg carries multiplier 1 and NO option facts at all`. |
| 3 | A position combining an equity leg and an option leg appears as one row | review | **PASS** | Same test as #2 (covered call case). |
| 4 | A position whose only option leg is **sold** to open, with no offsetting bought leg, is accepted and saved | test | **PASS** | `multiLegEntry.spec.tsx` `AC-4 — a NAKED SHORT is accepted and saved: one option leg, sold to open, no offsetting leg`. |
| 5 | Legs with **different expirations** are accepted and saved | test | **PASS** | `multiLegEntry.spec.tsx` `AC-5 — legs with DIFFERENT expirations are accepted and saved`. |
| 6 | A leg set the app has no name for is accepted and saved — no error, no warning styling, no warning icon, no blocked confirm, no toast | test | **PASS** | `multiLegEntry.spec.tsx` `AC-6 — an UNNAMED leg set confirms with no error, no warning styling, no icon, no toast`. |
| 7 | Entering a plain single long option takes no more steps than it does today | review | **PASS** | `shared-entry.flow.spec.tsx` (pre-existing, untouched behaviourally — `positions_and_ticker_pages_render_the_same_trade_entry_dialog`, `..._fills_only_on_a_live_cross`) still green; `multiLegEntry.spec.tsx`'s `AC-8` test demonstrates the single-leg path is the 1-row default state of the same dialog, not a second flow. |
| 8 | Multi-leg entry happens in the **same** dialog as single-leg entry — no second dialog, no separate spread builder | review | **PASS** | `multiLegEntry.spec.tsx` `AC-8 — multi-leg happens INSIDE this dialog: one dialog element, no builder, no step flow`; `TradeEntryDialog.tsx` comment: "the SIM MULTI-LEG VARIANT... one open path" — one component, `legs: LegInput[]`. |
| 9 | The trader enters a price **per leg** and the running net updates from those prices, shown as computed. No field asks for a net | review | **PASS** | `multiLegEntry.spec.tsx` `AC-9 — the trader prices PER LEG and NO field anywhere asks for a net`; `AC-9 — the net is LABELLED as computed from the leg prices`. |
| 10 | Until every leg has a price, the running net reads as **incomplete** rather than a partial sum | test | **PASS** | `multiLegEntry.spec.tsx` `AC-10 — until EVERY leg has a price the net reads INCOMPLETE, never a partial sum`. |
| 11 | Leg direction is a Buy/Sell (Long/Short) control; no form field accepts a negative quantity | review | **PASS** | `multiLegEntry.spec.tsx` `AC-11 — direction is a Buy/Sell control and NO field accepts a negative quantity`. |
| 12 | Close is whole-position only: no per-leg Close/Cancel anywhere, leg rows carry no actions | review | **PASS** | `legDisclosure.spec.tsx` `AC-12 — legs carry NO actions: no button, no link, no per-leg Close or Cancel`. |
| 13 | A 6-leg position is accepted, saved and rendered — no leg-count limit enforced or messaged | test | **PASS** | `multiLegEntry.spec.tsx` `AC-13 — a SIX-leg position is accepted with no cap enforced and no cap messaged`; `fixtures.spec.ts` "the six-leg fixture exercises the no-leg-cap rule (AC-13)". |

### B — Naming

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 14 | Each of the 21-name v1 set displays a recognisable name | review | **PASS** | `structure.spec.ts` exhaustively covers all 22 members via `STRUCTURE_LABELS: Record<StructureKind,string>` (compile-time total map — see `AC-20 — the map is total and 1:1`); `PositionRow`/`PositionCard` render `STRUCTURE_LABELS[kind]` directly (`cell-structure` testid). |
| 15 | An unmatched leg set displays `Custom` with its leg count, same neutral register, no diagnosis styling | review | **PASS** | `structure.spec.ts` `AC-21` cases; `tint.spec.tsx` "the structure chip is className-identical for Iron condor, Shares and Custom" — proves no distinct/alarmed styling for `Custom`. |
| 16 | A naked short put displays `Short put`; nothing implies collateral/cash/buying-power | review | **PASS** | `structure.spec.ts` `AC-16 — no label implies collateral, cash set aside or buying power` — sweeps `STRUCTURE_LABELS` + tips for the banned words; `cash_secured_put` confirmed absent from `StructureKind` (§2.3). |
| 17 | Same position shows the same structure name across re-renders, reloads, sessions | review | **PASS** | `structure.spec.ts` `describe('AC-17 — determinism')` — pure/total function of leg shape, no randomness/entry-order dependence; zero durable bytes (never re-derived from a stored value). |
| 18 | Changing a leg in the entry dialog so the shape changes updates the name immediately, no reload | review | **PASS** | `multiLegEntry.spec.tsx` `AC-18 — changing a leg so the SHAPE changes updates the displayed name immediately`. |
| 19 | Editing/corrupting an entry price never changes the displayed structure name — debit/credit by strike geometry | test | **PASS** | `structure.spec.ts` `describe('AC-19 — the name never moves on an entry price')`; `structureKindOf` (read at `structure.ts`) never reads `entry_price` — confirmed by source (`leg.ts`/`structure.ts` type signature excludes it). |
| 20 | No structure name rendered by two enum members and no member renders two names (4 verticals, long/short straddle, long/short strangle, long/short shares distinct) | review | **PASS** | `structure.spec.ts` `describe('AC-20 — the map is total and 1:1')`. |
| 21 | Non-iron butterfly, non-iron condor, 1×2 ratio and >4-leg exotic all render `Custom` in v1 | review | **PASS** | `structure.spec.ts` `AC-21 — a non-iron butterfly is custom in v1`, `AC-21 — a non-iron condor is custom in v1` (+ ratio/exotic cases in the same describe block, confirmed `butterfly`/non-iron `condor` absent from the 22-member `StructureKind` union at `structure.ts:19-41`). |

### C — What the trader sees

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 22 | Net entry shown as **one** figure, labelled debit/credit, disclosed as computed from per-leg prices — never quoted/broker/direct-entry | review | **PASS** | `view.spec.ts` `AC-22 — carries ONE net entry figure with a debit/credit basis derived from the SIGN`; `labels.ts` `NET_ENTRY_TIP` verbatim matches SPEC §4. |
| 23 | Every position shows one net P/L figure covering all legs | test | **PASS** | `positions.risk.spec.tsx` `AC-23 — every position shows ONE net P/L figure covering all of its legs`. |
| 24 | 100-share position, $1 rise, shows P/L of **$100**, not $10,000 | test | **PASS** | `leg.spec.ts` `AC-24 — 100 shares up $1 is $100, not $10,000`. |
| 25 | A pre-existing well-formed single-leg option position's P/L is **identical** before/after, renders exactly as shipped | test | **PASS** | `leg.spec.ts` `AC-25 — a long single option is the exact (mark - entry) * 100 * qty special case`, `describe('AC-25 — byte-identity with the shipped single-leg formula')`; `migration.spec.ts`/`store.spec.ts` migrate real shipped-shape fixtures and assert unchanged `pl`/`pl_pct`. |
| 26 | Profitable credit structure shows **positive** P/L%; near-zero-net structure never `±Infinity`/`0`/blank; literal `undefined`/`null`/`NaN` never appear | test | **PASS** | `leg.spec.ts` `AC-26 — a winning credit structure reports a POSITIVE percentage`, `AC-26 — a near-zero net cost yields no_basis, never Infinity/0/blank`; `view.spec.ts` `never renders the literal undefined, null or NaN (AC-26)`. |
| 27 | P/L% column header carries a basis-aware tip; each row's tip names **that row's** basis; no new column | review | **PASS** | `labels.ts:94-100` `plPctBasisTip(basis)` — two distinct strings for `net_debit`/`net_credit`; `PositionRow.tsx` wires it per-row; no new `ColumnKey` added for this. |
| 28 | Each of the 15 eligible structures shows one **unsigned** max-loss figure with its at-expiration assumption disclosed, incl. plain long call/put, short put, 100 shares | test | **PASS** | `maxLoss.spec.ts` `describe('AC-28 — the figure, for the single-leg members too')`, `AC-28 — an eligible structure shows ONE unsigned figure: no +, no −, no decimals`, `AC-28 — a DEFINED-RISK CREDIT structure still shows a figure, not a reason`; `maxLoss.ts:22-38` — `MAX_LOSS_ELIGIBLE` is exactly the ruled 15. |
| 29 | Every other structure shows **no figure and one short stated reason** (`unlimited risk`/`mixed expiries`/`unnamed shape`) — never blank/0/bare `—`/`Unlimited`/computed number | test | **PASS** | `maxLoss.spec.ts` `describe('AC-29 — no figure and one stated reason, exhaustively three')`, `AC-29 — an unbounded structure shows ONE stated reason, never a figure and never 'Unlimited'`, `AC-29 — a multi-expiry structure and an unnamed shape each state their OWN reason`; `maxLossCell.spec.tsx` `AC-29 — an ineligible structure renders a reason, never a bare —, never 0, never a number`, `AC-29 — 'unlimited risk' and 'unnamed shape' stay distinguishable, never clipped to a prefix`. |
| 30 | Collapsed card carries **at most one** risk figure/reason, never three; `/positions` keeps `scrollWidth ≤ innerWidth` at 393px both schemes, incl. 4-leg disclosure expanded — **browser-verified at V7** | test (browser) | **PASS** | `positionCard.spec.tsx` `AC-30 — the collapsed card carries AT MOST ONE risk figure or reason, never three`, `AC-30 — leg count changes ONE label and nothing else in the COLLAPSED card`; **real headless-browser** `mobile-no-overflow.cy.ts` (run this session, Electron 138 headless, both dark+light): `/positions fits at 393px with a SEEDED book — cards, five-item footers, the risk slot` and `a 4-leg disclosure EXPANDED at 393px still does not overflow` — **both passed**, satisfying the SPEC's explicit direction to look for this at the V7 full-page integration rather than earlier. |
| 31 | `—`/`unavailable`/`not recorded`/`no basis` are **four** distinct literals, each independently assertable (three by testid, `—` by shipped treatment), none rendered for another's meaning | test | **PASS** | `view.spec.ts` `describe("positions · the four not-a-number literals (AC-31)")`, `AC-31 — 'no basis' is a CELL-level state: the dollar P/L beside it still renders a figure`; testids `cell-unavailable`/`cell-not-recorded`/`cell-no-basis` grepped present in `PositionRow.tsx`. |
| 32 | A record that can never be priced renders `unavailable` with the **permanent** tip, not this-cycle; excluded from subtotal + counted; still listed/closable/never hidden/pruned | review | **PASS** | `view.spec.ts` `AC-32 — a record that can never be priced is flagged 'unpriceable', separately from 'unavailable'`, `AC-32 — a well-formed position that merely failed THIS cycle is unavailable but NOT unpriceable`. |
| 33 | A shares position renders `—` (not blank/`N/A`/`0`) in strike/right/expiry/DTE, carries `Shares` chip, qty reads `100 sh` | review | **PASS** | `view.spec.ts` `AC-33 — a shares position exposes null option facts so the cell can render '—', never a fake value`; `positionCard.spec.tsx` `AC-33 — a shares card reads '100 sh', carries the Shares chip, and shows — for the expiry`. |
| 34 | No surface reads `Cost`; debit reads `Net debit`, credit reads `Net credit`, derived from sign; confirm button label unchanged; P/L tooltip no longer claims universal ×100 | review | **PASS** | `defaults.spec.ts` `AC-34 — the entry column header reads Net entry and the word Cost is gone`; `positionCard.spec.tsx` `AC-34 — the entry slot reads Net debit / Net credit from the SIGN; 'Cost' appears nowhere`; `labels.ts` `PL_TIP` rewritten verbatim (no `×100` universal claim — reads "Each leg uses its own multiplier"). |
| 35 | Leg disclosure appears only when >1 leg; expanding shows one line per leg with side as a **word**, size, instrument, that leg's own mark+basis | review | **PASS** | `legDisclosure.spec.tsx` `AC-35 — appears ONLY when a position has more than one leg`, `AC-35 — one line per leg, with side as a WORD, size, instrument, expiry and that leg's own mark`. |
| 36 | Leg-disclosure state is ephemeral: absent from saved view config, never persisted, gone after reload | test | **PASS** | `legDisclosure.spec.tsx` `AC-36 — the state is EPHEMERAL: a re-mount comes back collapsed`, `AC-36/AC-80 — expanding is a READ: nothing is written to storage and nothing re-fetches`; `usePortfolio.views.spec.tsx` `AC-36 — the expansion state is absent from the persisted view config, so a reload forgets it`. |
| 37 | Over-long structure line collapses first-and-last, authored in the string (never CSS ellipsis mid-number), full list in tooltip **and** disclosure | review | **PASS** | `view.spec.ts` `AC-37 — an over-long strike list collapses in the STRING, first-and-last, with the leg count`, `AC-37 — a short strike list does NOT collapse: every strike stays in the cell form`. |

### D — Live / degraded

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 38 | On SSE drop a multi-leg position's P/L degrades exactly as single-option does today — last-known + offline marker, never blanked | test | **PASS** | `positions.risk.spec.tsx` `AC-38/AC-42/AC-43 — an SSE drop degrades the live block only; STATIC cells never dim`; `composeMark.spec.ts` `AC-38 — an SSE drop leaves a last-known number PRESENT and dimmable, never blanked`. |
| 39 | If one leg can't be quoted while others can, P/L, P/L% **and** mark all read `unavailable`; never a partial sum | test | **PASS** | `composeMark.spec.ts` `AC-39 — one unresolved leg withholds pl, pl_pct AND mark together`; `positions.risk.spec.tsx` `AC-39/AC-40 — one unpriceable leg withholds the WHOLE position, is counted, and costs no other row`. |
| 40 | A withheld position (AC-39) is omitted from the group subtotal and counted in `· N positions excluded (unavailable)` — never summed as zero | test | **PASS** | `usePortfolio.views.spec.tsx` `AC-40 — a withheld row is EXCLUDED from the subtotal and COUNTED, never summed as zero`; `derive.spec.ts` same assertion at the derivation layer. |
| 41 | Mixed leg bases: row's basis chip shows the **weakest** and its tip names the mixing | review | **PASS** | `composeMark.ts`/`composeMark.spec.ts` weakest-basis ordering; `PositionRow.tsx:292` renders `` `${basisMeta.tip} ${WEAKEST_BASIS_TIP}` `` when mixed — `WEAKEST_BASIS_TIP` verbatim matches SPEC §4. |
| 42 | Cold skeleton, offline-degrade, `unavailable`, pending are four visually distinct, never render alike; static cells never dim | test | **PASS** | `positions.risk.spec.tsx` `AC-42 — offline and unavailable are DIFFERENT states, never rendered alike`; `maxLossCell.spec.tsx` `AC-42/AC-29 — the risk slot NEVER dims: it is STATIC, not live-derived (className identity)`. |
| 43 | Market-closed/overnight freezes a multi-leg position's P/L the same way it freezes a single-option position today | review | **PASS** | `positions.risk.spec.tsx` `AC-38/AC-42/AC-43 — an SSE drop degrades the live block only; STATIC cells never dim` (freeze/offline share the same `last_known`+dim path, unchanged `computeMark` ladder per §2.5). |
| 44 | A resting composite limit never fills while **any** leg's mark is stale, frozen or `last_known` | test | **PASS** | `usePortfolio.spec` `describe("usePortfolio · the resting composite limit (AC-44)")`; `multiLegEntry.spec.tsx` `describe('AC-44 — a composite limit never fills off a stale leg')`. |

### E — Migration

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 45 | A trader with items on both surfaces sees, on first load, **one** list with every item from both | test | **PASS** | `migrate.spec.ts` `AC-45/46 — unions both surfaces and counts DISTINCT IDS, not the arithmetic sum`; `migration.spec.ts` `AC-45 — a trader with items on BOTH surfaces sees ONE list containing every item from both`. Code-read confirmed (`migrate.ts` `unionSources`, `store.ts` `read()` §2 union path) — union, not read-new-else-old. |
| 46 | Count = distinct record ids (not arithmetic sum); two same-contract records with different ids remain **two** positions | test | **PASS** | `migrate.spec.ts`/`migration.spec.ts` `AC-46 — two records of the same CONTRACT with different ids remain TWO positions`, `AC-46 — the count is the number of DISTINCT record ids, not the arithmetic sum`. |
| 47 | Reloading repeatedly does not change the count, create duplicates, or drop anything | test | **PASS** | `migration.spec.ts` `AC-47 — reloading repeatedly does not change the count, duplicate anything, or drop anything`; `describe('AC-58 — the union runs EXACTLY once')` guards re-arming. |
| 48 | Every migrated position keeps ticker/qty/entry price/entry time/open-closed state; a pending limit's empty entry time is carried through, never backfilled | test | **PASS** | `migrate.spec.ts` `AC-48 — keeps ticker, quantity, entry price, entry time and open/closed state`, `AC-48 — a pending limit's EMPTY entry time is carried through, never backfilled`; `migrate.ts:206-211` reads `opened_time`/`entry_time` verbatim, never fabricates. |
| 49 | Decision history after the update has every entry from both prior logs, once each — no drops/doubles/renumbering/lost timestamps | test | **PASS** | `migrate.spec.ts` `AC-49 — unions decisions by identity, ONCE EACH, with no renumbering`, `AC-49 — an ID-LESS decision de-dupes on the composite key, not by object identity`; `migration.spec.ts` `AC-49 — the history contains every entry from both prior logs, ONCE each`. |
| 50 | Hit rate, N and mean return per cell read the same immediately before/after; a multi-leg position counts as exactly **one** ledger record | test | **PASS** | `ledger.spec.ts` `describe('AC-50 — the track record does not move across the update')`; `outcomes/ledger.ts` counts per `SimPosition.id`, never per leg. |
| 51 | A one-time dismissible non-blocking notice explains the merge and points at export; appears **only** for both-surfaces traders; survives reload until dismissed; never reappears | review | **PASS** | `positions.integration.spec.tsx` `describe('AC-51/AC-52 — the merge notice')`, `AC-51 — it appears for a BOTH-surfaces trader, survives reload, and never returns once dismissed`; `store.ts` `shouldShowMergeNotice()` requires **2+** contributing sources (`source_counts...contributed > 0`). |
| 52 | Positions-only trader sees no notice/change; no-data trader sees a normal empty portfolio, no notice/error | test | **PASS** | `positions.integration.spec.tsx` `AC-52 — a Positions-page-only trader never sees it`; `migration.spec.ts` `AC-52 — no sources at all is a clean empty result, not an error and not an abort`, `AC-52 — a trader with no saved data gets a normal empty portfolio, no notice, no error`, `AC-52 — a Positions-page-only trader sees no notice`. |
| 53 | Saved named views still open and apply; a view that grouped by strategy still groups, long calls still grouped together | test | **PASS** | `defaults.spec.ts` `describe("normalizeViewConfig — read-time only, NEVER a write (AC-53, AC-54, AC-82)")`, `AC-53 — a view that grouped by strategy still groups, with long calls still together`; `derive.spec.ts` `AC-53 — grouping by structure keeps every long call in one group`; `migration.spec.ts` "carries the v2 blob's saved views forward — a saved view is not lost by the cutover (AC-53)". |
| 54 | A saved view whose filter references a value that no longer exists **opens**, shows rows, never throws, is flagged `adjusted`, shows its notice, does **not** write to the store until saved | test | **PASS** | Fixture-integrity confirmed first: `fixtures.ts:384` filters on `structure: 'long_butterfly'`, a value **absent** from the 22-member `StructureKind` (`structure.ts:19-41`) — genuinely retired, not a live enum member (the exact false-pass the SPEC's §7 correction warns about was checked for and is **not** present here). `defaults.spec.ts` `AC-54 — a filter on a value that no longer exists degrades to no filter and is FLAGGED`; `derive.spec.ts` `AC-54 — a view with a stale structure filter OPENS, shows rows, never throws, writes nothing`; end-to-end integration `positions.integration.spec.tsx` `describe('AC-53/AC-54 — the seeded stale saved view')` seeds `STALE_SAVED_VIEW_CUSTOMIZATION`, asserts the notice renders with `staleViewNotice('Tech swings')`, and that stored `customization.views` JSON is byte-identical after render. |
| 55 | Closed and cancelled positions survive with their close data and remain in the history view | test | **PASS** | `migrate.spec.ts` `AC-55 — a record closed in EITHER source is closed, with that source's close data`; `mergeCollidingRecords` (`migrate.ts:239-249`) implements the stated monotone exception. |
| 56 | Starting from an unparseable positions blob, opening/closing/cancelling leaves that blob **byte-identical** — the shipped destroy-on-next-write defect is gone | test | **PASS** | `store.spec.ts` `describe('fault latch (AC-56) — an unparseable blob is never overwritten')`, `refuses every mutator and leaves the damaged blob byte-identical`, `determines fault synchronously at initialisation, not on the first write`. Confirmed **mutation-sensitive**: the test comment states "this test must FAIL against the pre-latch store or it proves nothing," and reading `store.ts:303-304` (`write()` checks `positionsFaulted()` first, `NEVER overwrite a readable-but-unparseable prior blob`) shows the guard is actually present, not merely asserted. |
| 57 | If **any** source blob is unreadable, **no** v3 blob is written at all and every source blob is left byte-identical | test | **PASS** | `migrate.spec.ts` `AC-57 — ABORTS ENTIRELY if ANY source is unread; no partial result is offered`; `migration.spec.ts` `describe('AC-57 — ANY unreadable source aborts the promote ENTIRELY')`, `and every mutator refuses, so nothing is half-written on top of the abort (AC-61)`; `store.ts:268-280` (`if (union.aborted) { ...faulted = true; return memory; }` — no `write()` call on that path). |
| 58 | After the promote, no source blob is ever read again: a removed/closed-in-v3 position never reappears; no code path writes `convexa.ghost-trade.v1` after this release | test | **PASS** | `migration.spec.ts` `describe('AC-58 — the union runs EXACTLY once')`, `AC-58 — no code path writes convexa.ghost-trade.v1 after this release` — this is a **source-text grep** of `model/store.ts` for a write call, per that file's own header comment (which deliberately omits naming the deleted functions so the comment itself can't be mistaken for a survivor). `store.ts:237-259` — once `V3_KEY` exists, sources are never consulted, on any branch (including a corrupt v3 blob). |
| 59 | A v3 blob with corrupt/missing provenance still reads: records render, migration is **not** re-armed, no re-union, merge notice suppressed | test | **PASS** | `migration.spec.ts` `AC-59 — corrupt provenance still reads, does NOT re-arm the migration, and suppresses the notice`; `store.ts:333-347` `shouldShowMergeNotice()` returns `false` when `provenance == null`. |
| 60 | Exporting and re-importing an archive produces the same records the migration produced; a v1 archive envelope still imports; import is merge-only, never adopts a provenance block | test | **PASS** | `archive.spec.ts` `describe('AC-60 — envelope v2, and the ONE lift shared with the store migration')` — asserts `imported` deep-equals `liftLegacyRecord(file.stores.ghost_trade.trades.NVDA)` **against the actual production function**, not a look-alike, directly satisfying SPEC §7 invariant 1's "assert the *same* function object/behaviour". |

### F — The faulted store

| # | AC | By | Verdict (`9e9350c`) | Evidence |
|---|---|---|---|---|
| 61 | While faulted, **no durable write occurs from any surface** — open/close/cancel/save-view leaves browser storage byte-identical | test | **PASS** | `store.spec.ts` `describe('AC-61 — nothing is written, from any surface')`, `leaves the WHOLE of storage byte-identical — nothing is rerouted to another key (AC-61)` — this test takes a **full `snapshotStorage()`** before and after every mutator call, not just the one key under test, directly checking the "not buildable" rejected approach (routing new writes to a fresh key) never happens. |
| 62 | Faulted banner renders above the table, non-dismissible, warning icon, §4 copy verbatim, two actions present and operable | review | **PASS** | `faulted.spec.tsx` `describe('AC-62 · the banner announces without hijacking')`, `AC-62 — the banner is non-dismissible, carries an icon, and both actions are operable`; `FaultedBanner.tsx` copy strings match SPEC §4 verbatim (`FAULTED_BANNER_HEADING`/`_BODY`/`_CLOSING` in `labels.ts`), `role="status"`, `WarningAmberIcon`. |
| 63 | Every mutating control renders **visibly refused** (reduced-emphasis token treatment, no hover elevation/colour shift, distinguishable in both schemes) **and** `aria-disabled="true"`, remains focusable + tooltip-reachable, described by the banner, no-ops on activation; entry dialog never opens; HTML `disabled` never used; nothing else makes the reason unreachable | test | **FAIL at `9e9350c`; PASS on re-verify — see §5.1** | The `aria-disabled`/focusable/tooltip/no-op half was solidly implemented and tested; the visual reduced-emphasis half was not implemented anywhere in the shipped code, confirmed by source review and a live browser screenshot. **Fixed in `a634d0b`; re-verified below.** |
| 64 | No frame ever paints an enabled entry/close/cancel/save affordance on a faulted store — refusal present on first paint | test | **PASS** | `faulted.spec.tsx` `describe('AC-64 — no frame ever paints an enabled affordance on a faulted store')`; `store.ts:230-259` — fault determination happens synchronously inside `read()`, called before first render (no async gap). |
| 65 | Faulted and offline are independent: faulted dims no data (no figure/live-block/⏸/number change — only refused controls take AC-63's treatment); offline disables no control; both banners render in declared priority order | test | **PASS (core claim); dependency on AC-63 now also resolved — see §5.1** | `faulted.spec.tsx` `describe('AC-65 — faulted and offline are independent, and legible together')`; `bannerRegion.spec.tsx` asserts the fixed priority order. |
| 66 | While faulted, **no dismissible notice renders** — not merge, not stale-view | test | **PASS** | `faulted.spec.tsx` / `multiLegEntry.spec.tsx` both carry `AC-66 — while faulted NO dismissible notice renders: not merge, not stale-view`; `CustomizationToolbar.tsx:112-113` (`showMerge = !faulted && ...`, `showStale = !faulted && ...`). |
| 67 | Faulted with zero rows renders the faulted empty copy; normal "no positions yet" empty state never shown in this state | review | **PASS** | `faulted.spec.tsx` `AC-67 — faulted with zero rows renders EMPTY_FAULTED, never the normal empty copy`. |
| 68 | While faulted, Archive block and post-export snack carry the partial-archive note; `Export archive` label unchanged; export still works | review | **PASS** | `faulted.spec.tsx` `describe('AC-68 · the export pointer is a pointer')`, `describe('AC-68 — export still works, and says it is partial')`; `ArchiveBlock.tsx` diff (42 lines) wires `TR_ARCHIVE_PARTIAL_NOTE`. |
| 69 | The Ticker page's entry CTA carries the same refused treatment and its own one-line notice while faulted — not scoped to `/positions` | test | **PARTIAL at `9e9350c`; PASS on re-verify — see §5.1** | `TickerFaultedNotice` renders and `Refused` wraps the CTA (`aria-disabled`, no-op, tooltip) — the aria/keyboard half held; the visual half did not. **Fixed in `a634d0b` (new `TickerHeader.faulted.spec.tsx`); re-verified below.** |

### G — One book, two pages

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 70 | A position opened from the Ticker page appears in the Positions portfolio without a reload | test | **PASS** | `positions.integration.spec.tsx` `describe('AC-70/AC-71 — one book across both pages, without a reload')`. |
| 71 | Closing a position on the Positions page is reflected on the Ticker page for that ticker without a reload | test | **PASS** | Same describe block as #70 (both directions asserted together). |
| 72 | The Ticker page no longer offers a position concept separate from the portfolio — no two competing records of one trade | review | **PASS** | `model/useGhostTrade.ts` confirmed **deleted** (`git diff --stat` shows 562 deletions, file absent on disk); `TickerDashboard.tsx` comment + code confirms it now reads `usePortfolio` scoped to the ticker (§2.7 "this *is* the merge"). |

### H — `position_eval`

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 73 | For a single-option position the position-context read behaves byte-identically to shipped | test | **PASS** | `pos-params.spec.tsx` `'exactly 1 single-option position — BYTE-IDENTICAL to today: surfaced, whole_position'` — asserts `suppressed: false`, `subject: {kind:'whole_position', leg_id}`, and `queryLeg.id` equals that leg. |
| 74 | For >1-leg position, no position-context evaluation is surfaced on any surface; the underlying `pos_*` request is unchanged/unconditional — a multi-leg `pos_*` request in the network tab is correct | test | **PASS** | `pos-params.spec.tsx` `describe('AC-74/AC-77 — the pos_* request shape never branches')`, `AC-74 — no position-context evaluation is SURFACED for a multi-leg position, on any surface`; `evalSubject.ts:33-64` (`primary_leg` still returns a `leg_id` so the request fires; `suppressed` governs the render only). |
| 75 | For a position with no option leg, no evaluation is produced, and the projection carries an explicit reason rather than an ambiguous null | test | **PASS** | `pos-params.spec.tsx` `AC-75 — a shares-only position carries an EXPLICIT reason, not an ambiguous null` — `{kind:'none', reason:'no_option_leg'}`. |

### I — Invariants, observably

| # | AC | By | Verdict | Evidence |
|---|---|---|---|---|
| 76 | Every position surface remains labelled `SIMULATED`; paper badge + positions disclosure survive verbatim; no broker/order path/real-money entry anywhere | review | **PASS** | `positions.risk.spec.tsx` `describe('AC-76 — every position surface stays SIMULATED')`; `SIMULATED is unmistakable: PAPER badge + the mandatory browser-local disclosure; no real-order affordance` (part of the 1077 green suite). |
| 77 | Opportunity score and tier on the Ticker page are unchanged by any position activity; `apps/api` diff is empty | test | **PASS** | `git diff main...feat/positions-legs -- apps/api \| wc -l` → `0`. `positions.risk.spec.tsx` `opening positions issues ONLY contract lookups — never a bundle/ticker/scoring request`; `pos-params.spec.tsx` `describe('AC-74/AC-77 — the pos_* request shape never branches')`. |
| 78 | Green/red appear **only** on P/L $, P/L %, group subtotal, sparkline stroke, realized-close figure; structure chips, leg sides, Call/Put, debit/credit, risk slot, `—`/`unavailable`/`not recorded`, offline tags are untinted | test | **PASS** | `tint.spec.tsx` `describe('tint discipline — className identity (AC-78)')` — className-identity assertions (not `getAttribute('style')`, which the file itself explains is vacuous for MUI `sx`) across Short/Long leg labels, Call/Put in the leg list, credit/debit entry cells, the structure chip, and the not-a-number literals + offline tag; `maxLossCell.spec.tsx` `AC-78 — the risk slot carries NO tint: neither the figure nor the reason is success/error`. |
| 79 | Leg disclosure is keyboard-operable with a visible authored `:focus-visible` ring and correct `aria-expanded`/`aria-controls`; leg text ≥11px; mobile hit targets ≥44px; stat values never headings | test | **PASS** | `legDisclosure.spec.tsx` `AC-79 — the control is a real <button> with aria-expanded and a RESOLVING aria-controls`, `AC-79 — keyboard-operable: Enter AND Space both toggle it, and it takes focus`, `leg text sits above the 11px floor (AC-79)`; `positionCard.spec.tsx` `AC-79 — the disclosure button is ≥44px tall...`; `faulted.a11y.spec.tsx` proves the keyboard/focus-visible property independently (see its own module comment on the jsdom `:focus-visible`-first-tab-stop caveat, which is why it is proven on the primitive rather than deep in a mounted page). |
| 80 | Expanding/collapsing/grouping/sorting/switching views trigger **zero** fetches, leave the book byte-identical, rewrite no saved view; only `customization.working` legitimately moves; nothing reaches a real order path | test | **PASS** | `usePortfolio.views.spec.tsx` `describe('AC-80 · the leg disclosure is a pure read')`, `describe('AC-80 · re-deriving the view never refetches and never touches the book')`; `positions.risk.spec.tsx` `AC-43/AC-80 — RENDERING writes nothing: the book is byte-identical after a mount`; `positions.risk.spec.tsx` `grouping by ticker renders a subtotal without issuing any fetch`. |
| 81 | The feature adds zero values to `tokens.ts`, zero hardcoded hexes, dark/light parity | test | **PASS** | `tint.spec.tsx` `describe('tint discipline — token discipline (AC-81)')` — a repo-file `import.meta.glob(['./*.tsx', ...], {query:'?raw'})` raw-source sweep of every `.tsx` under `positions/`, same pattern as the pre-existing repo-wide `hex-discipline.spec.ts` (which also passed, confirmed non-vacuous via its own `'the glob is not vacuous'` guard test). `git diff main...feat/positions-legs -- apps/dashboard/src/app/shared/theme/tokens.ts` shows no change to that file. |
| 82 | At `lg`+ table shows `Max loss` column, same figure/reason as card, same formatting/wording; at `md`- column absent, figure stays on card; every pre-existing saved view byte-identical in storage (no view's stored columns gain `max_loss`, no rewrite, no re-save needed) | test | **PASS** | `defaults.spec.ts` `describe('the max_loss column (AC-82, Q6 ruling)')` — `DEFAULT_COLUMNS` contains it, `OPTIONAL_COLUMNS` does not, `TABLE_HEADER_LABELS.max_loss` is `undefined` (no override map entry), `FIGMA_COLUMNS` contains it (`is in FIGMA_COLUMNS — the fit was measured and RULED at lg and above`), and `visibleColumnsFor(false)` excludes it while `visibleColumnsFor(true)` includes it — confirmed wired to a real `useMediaQuery(theme.breakpoints.up('lg'))` in `PositionsView.tsx:142-143`, not a guessed prop. Storage-byte-identity: `defaults.spec.ts` `AC-82 — normalization is in-memory: a stored blob is byte-identical after a read`, `AC-82 — reading a SEEDED stale saved view leaves its stored bytes untouched`; `positions.integration.spec.tsx` end-to-end confirms `JSON.stringify(after.customization.views)` equals the pre-render bytes for the seeded builtin+named views. |
| 83 | Position-context behaviour depends on open-position count three ways (0/1/>1); the `pos_*` request stays unconditional/byte-identical in all three; the >1 pick never reaches a surface | test | **PASS** | `pos-params.spec.tsx` `describe('AC-83 — position-context behaviour is three-way by OPEN-POSITION COUNT')`, `'0 open positions...'`, `'exactly 1 single-option position...'`, `'exactly 1 MULTI-LEG position...'`, `'more than 1 — suppressed, carrying EvalNoneReason.multiple_positions, never a silent null'` — this last test explicitly asserts the pick is **deterministic** (`sel.position?.id` is `'p-1'` regardless of input order) and that "it never reaches a surface: `subject` is what a renderer reads, and it says `none`". Source-followed: `TickerDashboard.tsx` only ever reads `evalSel.position != null` (a boolean gate for whether *some* position is open — never the id, ticker, or any identifying fact of the picked position) and `evalSel.queryLeg` (feeds the wire params only) — confirmed the standing caveat holds: the lowest-id pick never reaches a rendered surface. |

---

## 2. Tally — AS OF `9e9350c`

- **PASS: 80**
- **FAIL: 1** (AC-63 — the visual half of the "refused control" requirement; AC-69's cross-reference to the same
  gap is rolled into this one finding rather than double-counted)
- **UNVERIFIABLE: 0**
- Plus **1 build-health FAIL** outside the 83-item AC list (F-1, `nx typecheck`).

## 3. Overall GATE Q verdict AS OF `9e9350c`: **FAIL** (superseded — see §6)

---

## 4. Amendments bounced to Frontend (from the `9e9350c` run — both now resolved, see §5)

| Failing item | Observed | Expected | Owning lane |
|---|---|---|---|
| **AC-63 / AC-69 — refused-control visual treatment** | Read `FaultedBanner.tsx`'s `Refused` component: it clones the child adding only `aria-disabled`, `aria-describedby`, `data-refused`, and no-op `onClick`/`onKeyDown` handlers — it never touches `sx`/class/style. Checked all five consumer sites: `PositionRow.tsx` (Close button, `rowActionSx` — a static, unconditional style object) and Cancel button (plain MUI `<Button>`, no conditional sx); `PositionCard.tsx` (same `Refused` wrap, no conditional style); `CustomizationToolbar.tsx`'s Save/"Save as new view…"/Delete `MenuItem`s (no conditional style) and its own `+ Open simulated position` CTA, whose `opacity`/`cursor` are keyed to `canOpenEntry` (a "bundle data has loaded" flag, unrelated to store health), **not** to `faulted`; `TickerHeader.tsx`'s "+ Open simulated trade" CTA, which has **zero** conditional styling at all. Confirmed with a live, this-session-only ad-hoc Cypress spec that the "+ Open simulated trade" CTA rendered as a fully bright, fully opaque amber button — visually indistinguishable from its enabled state. | SPEC.md §3 AC-63 (and §4's "RULED 2026-07-28" block) requires every refused control to **additionally** render with "the theme's own disabled ink/fill/border tokens... and no hover elevation or hover colour shift" — token-only, in addition to (never instead of) the aria/keyboard properties. | **Frontend** |
| **Build health — `nx typecheck dashboard` fails** | `tsc --build --emitDeclarationOnly` → 2 errors in `shared/lib/durable/migration.spec.ts` (lines 313-314), caused by `model/store.ts`'s `getTrade` return type narrowing without updating this pre-existing test's call site. Vitest does not typecheck, so `nx test dashboard` was 1077/1077 green while the project did not compile. | `nx typecheck dashboard` exits `0`. | **Frontend** |

---

## 5. RE-VERIFICATION (after commits `d34df60`, `a634d0b`)

**Scope of this pass, stated explicitly per the coordinator's instruction:** this is a **targeted re-verify**,
not a re-run of all 83 ACs. I re-checked: (a) the two bounced findings end-to-end, live; (b) every AC whose
evidence in §1 depended on the changed files (AC-63, AC-65, AC-69, and — because `Refused`'s consumer sites are
shared with tint-discipline and the faulted-empty/merge-notice suppression logic — AC-78/AC-81 tint discipline
and AC-62/AC-66/AC-67/AC-68 faulted-banner behaviour, by re-running their test files fresh rather than assuming);
(c) the four suites + conformance, fresh, exit codes checked explicitly. **The other 76 ACs are exactly as
recorded in §1 at `9e9350c` — I did not re-derive them; nothing in these two commits touches their evidence
paths** (`git show --stat` for both commits, reproduced below, confirms the changed-file set is narrow).

```
d34df60 — apps/dashboard/src/app/shared/lib/durable/migration.spec.ts | 10 +++++++---  (1 file)
a634d0b — apps/dashboard/src/app/features/trading/positions/FaultedBanner.tsx          |  52 ++++-
          apps/dashboard/src/app/features/trading/positions/faulted.a11y.spec.tsx      | 213 +++++++++++++++++++++
          apps/dashboard/src/app/features/trading/positions/faulted.spec.tsx           |  52 +++++
          apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.faulted.spec.tsx | 98 ++++++++++  (new file)
```

### 5.1 AC-63 / AC-69 — the visual half, re-verified live

**What changed (read via `git show a634d0b`):** the fix lands **once**, in `FaultedBanner.tsx`'s `Refused`
primitive, not per-site. It merges a new `refusedSx` object into the wrapped child's own `sx` using the MUI
array form (`sx: [...(Array.isArray(ownSx) ? ownSx : [ownSx]), refusedSx].filter(Boolean)`), so the site's own
geometry (padding, border-radius, etc.) survives and only the emphasis tokens are overridden. `refusedSx` binds
`color: 'action.disabled'`, `bgcolor`/`borderColor: 'action.disabledBackground'`, `boxShadow: 'none'`, and a
`&:hover` block repeating the same three so hover shifts neither colour nor elevation. No hex, no opacity hack,
no new token — confirmed by reading the diff directly (the only new import is `SxProps`/`Theme` types).

**ARIA half confirmed byte-for-byte unchanged.** The `aria-disabled: true`, `aria-describedby: FAULTED_BANNER_ID`,
`data-refused: 'true'`, and the no-op `onClick`/`onKeyDown` swallow are the exact same lines as at `9e9350c`
(diff shows them untouched — only the `sx` line beneath them is new). Grepped the diff and the current file for
`disabled=`, `pointerEvents`, `tabIndex`: the only occurrences are in **prose comments** explicitly describing
what must never be reintroduced ("no `disabled`, no `pointerEvents: 'none'`, no `tabIndex: -1`") — none appear in
actual JSX/props. Confirmed the same 8 `<Refused>` call sites as before (`grep -rn "<Refused"` across
`apps/dashboard/src/app/`) — no new consumer site was added or removed; the primitive is genuinely the single
choke point the commit message claims.

**Mutation-checked myself, not trusted from the commit message.** I copied `FaultedBanner.tsx` to a scratch
location, edited the live file to replace the `sx` merge line with the pre-fix `sx: ownSx` (discarding
`refusedSx` entirely, changing nothing else), and ran the three test files the commit lists:

```
npx nx test dashboard --skip-nx-cache -- faulted.a11y.spec.tsx faulted.spec.tsx widgets/chrome/TickerHeader.faulted.spec.tsx
```

Result: **9 tests failed**, exactly matching the commit's own claim ("strip the `sx` merge and 9 go red") —
`AC-63 · a refused control is VISIBLY refused, in both colour schemes` (dark + light, ×2 assertions each: the
resolved-token check and the hover-shift check), `the treatment MERGES with the control's own sx`, `EVERY
refused control goes through the ONE primitive` (`faulted.spec.tsx`), `the entry CTA is a visibly QUIETER
control while faulted than while healthy`, and both `TickerHeader.faulted.spec.tsx` schemes. I then restored the
original file byte-for-byte from my scratch copy and re-ran the same three files: **43/43 pass.**
`git diff`/`git status` confirmed empty before moving on — no leftover mutation.

**Read the vacuity-guard and cascade-resolution claims in `faulted.a11y.spec.tsx`, and satisfied myself they are
true, not just asserted:**
- The **vacuity guard**: before asserting anything about the *refused* control, the test first asserts the
  *enabled* control's background resolves to the brand amber (`bindsPrimary(...) === true`) and does **not**
  bind the disabled tokens. If the injected-CSS reader returned nothing (an empty sheet, wrong class), this
  guard fails first and loudly, rather than every subsequent `.not.toBe(...)` passing vacuously.
- The **cascade claim** ("the amber is gone" is a last-declaration-wins read, not a text-absence read): I traced
  `effective()` — it reads *every* occurrence of a CSS property within a class's injected rule text and takes
  the **last** one (`hits[hits.length - 1]`), which is exactly how the browser cascade resolves duplicate
  declarations in the same rule. It also resolves one level of `var(--variant-*)` indirection, which is
  necessary because MUI v7's `Button` paints via `background-color: var(--variant-containedBg)` — I confirmed
  this is genuinely how MUI v7 emits Button styles (the variable is declared in the same class body), so
  resolving it is not optional scaffolding, it is required for the assertion to mean anything.
- The **compound-selector exclusion** (`.css-x.Mui-disabled{...}` must not be read as if it applied): traced the
  `injectedCss` regex — it matches a class token followed by zero or more `:pseudo` chains **immediately**
  followed by `{`. A compound rule like `.css-x.Mui-disabled{...}` has `.Mui-disabled` between the class and the
  brace, so the regex does not match it (there is no `{` immediately after `.css-x`). This is technically sound:
  the exclusion is real, not just claimed.
- **Result:** these three claims hold, and combined with the mutation check above, the 9 new/changed assertions
  are demonstrably capable of failing — this is not the false-pass class the SPEC's own §7 correction warns
  about.

**Verified live, myself, the exact case I originally caught.** With the real dev server (`:4200`) and real
backend (`:8000`) running, I seeded a corrupt `convexa.positions.v2` blob and visited `/ticker/TSLA` (a fresh,
this-session-only Cypress spec, not committed). Screenshot evidence: the "+ Open simulated trade" CTA now
renders as a **quiet grey pill** — clearly distinguishable from the still-bright amber it showed before the fix
— while the faulted banner ("⚠ Recording paused — Convexa couldn't read your saved data...") renders correctly
above it. This directly reverses the exact failure I documented in the original run.

**AC-63 / AC-69 verdict: PASS.**

### 5.2 F-1 — `nx typecheck`, re-verified

**What changed (read via `git show d34df60`):** `migration.spec.ts` lines 312-318 now read
`expect(ghost.getTrade('TSLA')).toMatchObject({ id: 'gt1', qty: 4 })` instead of the old
`const t = ghost.getTrade('TSLA')!; expect(t.id).toBe('gt1'); expect(t.qty).toBe(4);`.

**Confirmed the narrowing itself is untouched:** `model/store.ts:50` still reads
`export function getTrade(ticker: string): unknown | null` — byte-identical to the `9e9350c` state I recorded
originally. The fix is entirely on the test's assertion, not a widening of the production type back to
something typed (which would have been "fixing" the wrong side of the regression).

**Ran `nx typecheck` fresh:** `npx nx typecheck dashboard --skip-nx-cache` → **exit `0`**, clean
`tsc --build --emitDeclarationOnly` with no output at all.

**Confirmed the assertion is not weakened into something that cannot fail** — mutation-checked myself rather
than trusting the commit message's "flipping the expected qty turns it red" claim: temporarily changed the
expected `qty: 4` to `qty: 999` in the live file and ran the single test
(`npx nx test dashboard --skip-nx-cache -- migration.spec.ts -t "ghost-trade: open trade"`). Result: **fails**,
with a clear diff (`- qty: 999` / `+ qty: 4`) — confirming `toMatchObject` here is genuinely asserting the
material's actual shape, not a degenerate always-true check (e.g. `toMatchObject({})` would have passed
regardless). Restored the original file from a saved copy; `git diff` on the file came back empty afterward.

**F-1 verdict: RESOLVED, PASS.**

### 5.3 AC-65 — faulted dims no data — checked myself, live, not from the lane's screenshot

Per the coordinator's explicit instruction not to take this on trust: I seeded a **faulted store that still
renders a real row** — `convexa.positions.v2` corrupt (forces the abort/fault path) alongside a **valid** trade
under `convexa.ghost-trade.v1` (a real TSLA long call, since the union-abort path still runs whatever *did*
parse in-memory, per `store.ts:268-280`, which is exactly the mechanism that makes this state reachable at
all). Visited `/positions` for real (live backend, no mocked network) and screenshotted the actual `<tr>`:

```
TSLA  $300 Call  Long call  1 ×  $500 debit  unavailable  unavailable  unavailable  —  —  $500  Aug 21 · 24d  [Close]
```

The static/structural cells (`TSLA`, `$300 Call`, `Long call`, `1 ×`, `$500 debit`, `$500` max loss,
`Aug 21 · 24d`) render at full ink strength — not dimmed. The `unavailable` cells render in the pre-existing,
unrelated `text.disabled` not-a-number treatment (the contract lookup failed on a stale fixture expiration —
expected, and not new to this fix). The `[Close]` button at the row's right edge is visibly the same quiet grey
as the CTA — confirming the treatment reaches this consumer site too, while nothing beside it dims. This
directly confirms AC-65's core claim under this fix, live, independent of the lane's own report.

**Re-checked all five `<Refused>` consumer sites are still exactly the same set as before** (no new site was
added that might wrap a data cell instead of a control) — `PositionRow.tsx` (Close, Cancel), `PositionCard.tsx`
(Close/Cancel), `CustomizationToolbar.tsx` (Delete-view, Save-changes, Save-as-new, the entry CTA),
`TickerHeader.tsx` (entry CTA). All eight wrap **controls**, none wrap a figure/live-block/sparkline.

**AC-65 verdict: PASS** (unchanged from §1, now independently re-confirmed live rather than resting on the
parenthetical dependency on AC-63 that existed at `9e9350c`).

### 5.4 The light-scheme contrast question — my ruling

**The measurement.** Light-mode `action.disabled`/`action.disabledBackground` are not overridden anywhere in
`theme.ts`/`tokens.ts` for this feature (confirmed: no `MuiButton`/`action` override touches them, and no new
token was added — grepped the diff), so they resolve to MUI's stock light-mode defaults
(`rgba(0,0,0,0.26)` ink on `rgba(0,0,0,0.12)` fill). Composited over a typical light background
(`background.paper` `#ffffff` or `background.default` `#F6F6F3`), this lands in the **very low single-digit
contrast range** — my own back-of-envelope sRGB compositing put it in roughly the same neighbourhood the lane
reported (~2.6:1), i.e. genuinely low, not a rounding dispute.

**My ruling: this is acceptable for this surface, and I concur with the lane's reading — with the reasoning
made explicit rather than waved through.** Two things make this the right call rather than a shrug:
1. **WCAG 1.4.3/1.4.11's "inactive component" exemption is squarely on point, not a stretch.** The Understanding
   documents for both success criteria give exactly this archetype — a control that is temporarily
   non-operative (their own example: a disabled Submit button before a form is complete) is explicitly exempt
   from the contrast floor, precisely because its own label is not carrying information the user needs to act on
   right now. `aria-disabled` is the ARIA authoring-practice-recommended way to mark exactly this state
   (perceivable and focusable, but not currently operable) — it is not a looser or more ambiguous case than
   `disabled` for this purpose, only better for keyboard/tooltip reachability, which is the property this whole
   feature is protecting.
2. **The information the AC actually protects — the *reason* for the refusal — does not live on the button's own
   label, and I checked where it does live.** The banner body (`FAULTED_BANNER_BODY`, `text.primary`, full
   strength) and the tooltip (`WRITE_REFUSED_TIP`, rendered through MUI's **stock**, unthemed `Tooltip` — I
   confirmed there is no `MuiTooltip` override in `theme.ts`, so it keeps MUI's default high-contrast
   dark-chip-with-white-text styling regardless of app theme) are where the reason is actually delivered, and
   both are fully legible in both schemes. The button's own label ("Close", "+ Open simulated position") is
   restating an action name the trader already knows, not delivering new information — exactly the case the
   exemption is written for.

If a future reviewer wants a stricter floor than the WCAG exemption technically requires here, that is a
legitimate design preference to raise with the owner — but it is not what AC-63's own text asks for (which is
*distinguishability from the enabled state*, not an absolute contrast minimum on the refused label), and I am
not marking it a finding.

### 5.5 Regression sweep — fresh, exit codes checked explicitly

| Check | Command | Result | Evidence |
|---|---|---|---|
| Frontend suite | `npx nx test dashboard --skip-nx-cache` | **PASS** | **97 test files** (+1 — the new `TickerHeader.faulted.spec.tsx`), **1087/1087 tests** (+10), exit `0`. |
| Lint | `npx nx lint dashboard --skip-nx-cache` | **PASS** | 0 errors, 27 pre-existing warnings (one fewer than the `9e9350c` count — unrelated to this fix), exit `0`. |
| Typecheck | `npx nx typecheck dashboard --skip-nx-cache` | **PASS** | Exit `0` (was `1`). Re-run twice (once immediately after the fix, once again after the mutation-check revert) — both clean. |
| E2E (real headless browser) | `npx nx e2e dashboard-e2e --skip-nx-cache` | **PASS** | 19/19, exit `0` — unchanged from `9e9350c` (these commits do not touch layout). |
| Runtime interface conformance | `interface_conformance.py` against live `nx serve api` | **PASS** | 1/1 endpoint, 0 failures — unchanged (`NO_BACKEND_CHANGE` still holds; these commits are FE-only). |
| `apps/api` diff vs `main` | `git diff main...HEAD -- apps/api \| wc -l` | **PASS (empty)** | `0` lines, confirmed again at the new HEAD. |
| Targeted regression: tint discipline + faulted-banner suite | `npx nx test dashboard --skip-nx-cache -- tint.spec.tsx positions.integration.spec.tsx faulted.spec.tsx faulted.a11y.spec.tsx bannerRegion.spec.tsx` | **PASS** | 6 files, 80/80 tests, exit `0` — confirms the `refusedSx` merge did not disturb className-identity tint assertions (AC-78/AC-81) or the merge-notice/stale-view suppression logic (AC-62/AC-66/AC-67/AC-68), which share `CustomizationToolbar.tsx`'s banner-region code with the changed `Refused` primitive. |

**Working tree left clean.** `git status --porcelain` after all mutation-checks shows only the pre-existing
untracked `.claude/RESUME.md` and this report — no stray edits, no leftover scratch/screenshot files inside the
repo (temp Cypress artifacts under `apps/dashboard-e2e/test-output/` were removed after each ad-hoc run; that
directory is gitignored regardless).

### 5.6 Re-verified tally

- **AC-63: FAIL → PASS.** **AC-69: PARTIAL → PASS.** **AC-65: PASS → PASS, independently re-confirmed live.**
- **F-1 (`nx typecheck`): FAIL → PASS.**
- **76 ACs unchanged from §1** (not re-derived this pass — no code in these two commits touches their evidence).
- **0 new findings.** The two flagged-not-changed items (light-scheme contrast, the cascade/vacuity test
  technique) were audited and both hold up under my own scrutiny (§5.4, and the mutation-check + regex trace in
  §5.1).

---

## 6. Overall GATE Q verdict (current, supersedes §3): **PASS**

**83/83 acceptance criteria PASS.** All suites green with exit codes checked explicitly: `nx test dashboard`
1087/1087 (exit 0), `nx lint dashboard` 0 errors (exit 0), `nx typecheck dashboard` clean (exit 0), `nx e2e
dashboard-e2e` 19/19 real-browser (exit 0), interface conformance 1/1 (exit 0), `apps/api` diff empty. Both
findings from the `9e9350c` run were fixed, and I re-verified both fixes independently — live, with mutation
checks I ran myself rather than trusting the lane's own claims, and with a fresh screenshot of the exact case I
originally caught now showing the corrected behaviour. No invariant from the BRIEF's Invariant watch is broken.
The light-scheme contrast question was audited and ruled acceptable for this surface, for the reasons in §5.4.
