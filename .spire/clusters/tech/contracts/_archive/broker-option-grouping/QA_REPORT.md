# broker-option-grouping — GATE Q report

**Role:** QA / Verification (fresh, de-correlated session; no build-lane involvement).
**Date:** 2026-08-06 · **Baseline commit:** `d53199e` · **Head:** `d85b5a0` (12 commits, unpushed).
**Checklist:** `.claude/contracts/broker-option-grouping/SPEC.md` §3 (50 criteria), verbatim and in order.

> I fix nothing. Every FAIL below is a GATE Z bounce, recorded in the final section.

---

## 0. Gates re-run independently (exit codes, never printed summaries)

| Gate | Command | Result | Exit |
|---|---|---|---|
| FE suite | `npx nx test @org/dashboard --skip-nx-cache` | **122 files / 1434 tests passed** | **0** |
| Typecheck | `npx nx typecheck @org/dashboard --skip-nx-cache` (after `rm -rf apps/dashboard/dist` + deleting every `*.tsbuildinfo`, so the 185 ms incremental hit could not mask it — clean run 5.1 s) | 0 errors | **0** |
| Lint (scoped) | `npx nx lint @org/dashboard --skip-nx-cache` | 0 errors / 0 warnings | **0** |
| e2e | `npx nx e2e dashboard-e2e --skip-nx-cache` (chromium installed) | **41 passed** (baseline 37 + 4 new) | **0** |
| BE suite | `npx nx test api --skip-nx-cache` | passed, unchanged | **0** |
| Empty backend diff | `git diff d53199e HEAD -- apps/api \| wc -l` | **0 lines** | — |

Claimed counts (1434 / 41 / lint 0 / typecheck 0 / empty `apps/api` diff) all reproduce.

## 0b. Runtime interface conformance — both verdicts

The interface is marked **`NO_BACKEND_CHANGE`** but carries an executable `## Conformance spec`, so it
was run rather than waived.

| Receipt | Verdict | Endpoints | When |
|---|---|---|---|
| Backend lane — `conformance-receipt.json` | `PASS` | 1/1, 9 required fields | 2026-08-06T19:50:11Z |
| **QA (authoritative)** — `conformance-receipt-qa.json` | **`PASS`** | 1/1, 9 required fields | 2026-08-06T20:04:21Z |

Independently re-run by me against a freshly booted backend
(`MASSIVE_API_KEY=dummy-verify AI_REC_STUB=1`, `http://127.0.0.1:8000`) with **`--auth-signup` only** —
never `--auth-cookie`, never against a credentialed session, `POST /book/refresh` untouched.
**The two verdicts agree.** No bounce on this axis.

---

## 1. Acceptance criteria — point by point

Route legend: **test** = named passing automated test · **review** = source/copy review · **browser** =
observed by me driving the real app in Chromium against a stubbed network boundary
(`localhost:4300`, captured-shaped book, desktop 1280 and mobile 393).

| # | Acceptance criterion (verbatim, abridged only where marked …) | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Served the captured broker book (14 broker positions: 5 equity rows and 9 option legs), the Broker tab renders the 9 option legs as 5 ticker entries — 3 collapsed groups (TSLA 3 legs, AAPL 2, META 2) and 2 ungrouped single legs (NVDA, PLTR) — alongside the 5 unchanged equity rows, for **10 top-level entries** in total. | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-1 · the captured book composes 3 groups + 2 lone legs + 5 equity rows = 10 top-level entries"; `grouping.spec.ts` "splits into the exact composition SPEC §1 records". Browser: 3 `broker-group-header` (AAPL/META/TSLA), 2 `broker-lone-leg-clause` (NVDA/PLTR), 5 equity rows, count line `14 positions`. |
| 1b | Against the owner's **live** book, every ticker on the Broker tab shows the same option-leg count the Webull app shows … no option leg … is missing. | **UNVERIFIABLE** | — | Owner-only, one-time, against the live Webull account. No live credential is available to QA and none may be used. Not a failure; surfaced in the summary line. |
| 2 | A collapsed group row displays exactly five things: the underlying ticker · the count of option legs with its grouping-basis clause · the net entry cost with its basis label · the combined modeled P/L with its basis label · an expand control. Nothing else … the right rail carries the modeled P/L **and nothing else**. | **PASS** | review + browser | Observed header innerText, desktop: `"AAPL\n2 option legs · grouped by underlying\n⌄\n$3,850.00 debit\nnetted by Convexa\nunavailable\nConvexa-modeled"` — exactly the five. `BrokerGroupHeader.tsx` renders 3 grid children (identity spanning 1–2, net, right rail); the right rail is `GroupPl` only (no reassess slot). `BrokerGroupHeader.spec.tsx` "AC-2 …" also asserts exactly one button in the header. |
| 3 | A collapsed group row displays no single quantity figure and no percent-return figure. | **PASS** | test + review | `BrokerGroupHeader.spec.tsx` "AC-3 / AC-16b — no quantity figure, no percent" (no `×`, no `%`, no `broker-qty`). Structurally: `BrokerGroup` carries no `qty` and no `pl_pct` (`grouping.spec.ts` "the BrokerGroup struct never carries structure/max_loss/qty/eval_subject/pl_pct"). |
| 4 | No trader-visible string produced by this surface … names a structure … and a group renders no structure field at all, **including `Custom`** … the enforced vocabulary is the literal bare-word denylist in §2.3 predicate set B arm 2 … | **PASS** | test + browser | Three layers, each verified to **bite**, not merely to exist: **L1** — I probed it live via `eslint --stdin --stdin-filename .../grouping.ts`; a poisoned `import { structureKindOf } from '@/features/trading/positions/structure'` produced `error … no-restricted-imports`, exit 1. **L2** — `noNaming.scan.spec.ts`: recursive `./**/*.{ts,tsx}` glob, set defined by EXCLUSION, 3 anti-vacuity checks (≥10 files, every EXEMPT path still present, the 3 authored files in the remainder) and **4 mutation guards**, one per predicate, incl. B2's `'these legs may form a spread'` poison with B1 and set A asserted silent on it, plus the AC4_WORDS anti-drift assertion. **L3** — see AC-4b. **e2e** — `broker-grouping.spec.ts` "AC-4 …" asserts all 22 label values and all 13 B2 regexes against the real rendered `broker-tab-panel` innerText in Chromium. |
| 4b | The grouping surface is **structurally incapable** of producing a name, enforced over **every file this feature authors** … and rendering a **collapsed** group from a fixture whose legs **do** carry strike, expiry and right puts **neither** a `STRUCTURE_LABELS` value **nor** a denylist term into **any** channel AC-4 names … *[CF]* | **PASS** | test | `noNaming.render.spec.tsx`, `describe.each(['row','card'])`, driven by **`BOOK_CF_FUTURE_FEED`** — proven by `fixtures.contract.spec.ts` "FUTURE FEED — two legs WITH strike/expiry/right, on a ticker that is not a B2 term" to carry numeric `strike`, string `expiry`, `call|put` `right` on TSLA. Four channels asserted (header innerHTML for B1; the assembled naming surface for B2; `queryByRole('button', {name})` for both arms; every keyboard-reachable tooltip for both arms) + 5 poisons (3 B1, 2 B2, each B2 poison shown uncatchable by B1). **Not reachable on the captured book** — `fixtures.contract.spec.ts` pins that the captured legs carry none of the three facts. |
| 5 | Expanding a group reveals the per-leg rows exactly as they render today: same fields, same not-a-number literals, **same fidelity notes**, same per-leg figures — nothing dropped, nothing added. | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-5 · expanded member content is byte-identical to a standalone render" — for each of TSLA's 3 members, `broker-snapshot-fields`, `broker-net-entry`, `broker-pl` and every `broker-fidelity-note` are compared string-for-string against a standalone `BrokerPositionRow`. Browser: the expanded TSLA panel shows all 3 legs with their own qty, `$10,620.00 debit` / `$3,396.00 credit` / `$6,536.00 debit`, both fidelity notes verbatim per leg, and `Build reassessment`. |
| 6 | **Nothing is lost.** … the sum of every group's **member-position** count plus every ungrouped top-level entry … *[CF: needs a book where one member position carries more than one option leg]* | **PASS** | test | `grouping.integration.spec.tsx` "AC-6 · totality" runs over **both** the captured book (14) **and `BOOK_CF_TWO_LEG_MEMBER`** (2), asserting `Σ group.position_count + ungrouped.length` equals the book's position count. The CF arm is the one that fails a leg-counting implementation; `fixtures.contract.spec.ts` proves `Σ legs ≠ Σ positions` on it. |
| 6b | A collapsed group header states the number of option **legs** … with the noun "legs", and states no other count … On the captured book the three group headers read 3, 2 and 2. | **PASS** | review + browser | Observed: `3 option legs · grouped by underlying` (TSLA), `2 option legs …` (AAPL, META). `BrokerGroupHeader.spec.tsx` "AC-6b …" additionally asserts the header text contains none of `positions/rows/holdings/contracts/trades`. |
| 6c | **The noun tracks the number.** Expanding a group reveals exactly as many option legs as its header counted. *[CF: the same anti-coincidence book as AC-6.]* | **PASS** | test | `grouping.integration.spec.tsx` "AC-6c … **BOOK_CF_TWO_LEG_MEMBER**: header says 3, expanding shows exactly 3 `broker-leg-line` elements" — 2 positions, 3 legs, so a position-counting implementation renders "2" and fails. |
| 7 | On every load of the Broker tab, all groups render collapsed. | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-7 · every group is collapsed on first render" (`aria-expanded="false"` and `hidden` on every panel); e2e `broker-grouping.spec.ts` "AC-7 / AC-26" with a vacuity guard on the count. Browser: all three chevrons render `⌄`, all panels `hidden`. |
| 8 | A group's net entry equals the signed sum of the `Net entry` figures shown on that group's **expanded member rows** … | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-8 · … 10,620 debit − 3,396 credit + 6,536 debit = 13,760 debit, read back from the DOM". Browser confirms the same three member figures and the header's `$13,760.00 debit`; AAPL `$3,850.00`, META `$3,805.00`. `grouping.spec.ts` pins all three against SPEC §1's **left-hand** column. **Webull's raw sums 3,802.00 / 7,889.00 appear nowhere as an asserted rendered figure** — the only occurrences in the repo are the e2e's `expect(panelText).not.toContain(...)` negative assertions. |
| 9 | A group's net entry renders as **ONE figure** — the magnitude plus the **same direction word the per-leg rows already render** … It carries a visible basis label naming **who** computed it, whose tooltip names the **composition** … and when the net rests on at least one contract size Convexa derived, the tooltip and the expanded sentence **say so**. | **PASS** | review + browser | Browser: `$13,760.00 debit` + `netted by Convexa`; hovering the label yields the TRUE-branch tooltip verbatim ("…For at least one of these legs Webull doesn't state the contract size either, so Convexa worked that size out from the leg's own Webull totals…"), and the expanded panel note carries the matching TRUE sentence. One shared formatter `netEntryFigureText` in `brokerView.ts` serves both levels, so group and child grammar cannot diverge. |
| 9b | A group whose signed net is a **credit** renders the credit direction word with a positive magnitude — never a minus-signed debit, never a bare magnitude. *[CF]* | **PASS** | test | `grouping.spec.ts` "AC-9b … renders $1,600.00 credit" and `BrokerGroupHeader.spec.tsx` "BOOK_CF_CREDIT … never a minus sign", both on **`BOOK_CF_CREDIT`**, proven by `fixtures.contract.spec.ts` to compose a strictly negative net with nothing withheld. Captured book has no credit group (also pinned). |
| 9c | A group whose net **magnitude formats to `0.00`** renders `$0.00` with **no direction word**. Child rows are unaffected. *[CF]* | **PASS** | test | `grouping.spec.ts` on **`BOOK_CF_ZERO_NET`** (`fixtures.contract.spec.ts`: legs cancel EXACTLY) plus the boundary arm `groupNetEntryText(0.004)→'$0.00'`, `(0.006)→'$0.01 debit'` — keyed on the formatted magnitude, not an epsilon. `BrokerGroupHeader.spec.tsx` "AC-9c + P3" asserts the rendered text has no `debit|credit`. Child-row non-effect pinned by "the deliberate zero-net singleton divergence is PINNED, not accidental". |
| 10 | The group's net entry is never presented as Webull's own figure. Its disclosure states that the figure is Convexa's own sum … **The copy states no dollar amount and no dollar band for that difference.** | **PASS** | review + browser | Both tooltip variants and both expanded sentences read in `groupCopy.ts` and observed rendered: they name the mechanism ("Convexa's arithmetic, not a Webull figure") and contain no numeral of any kind. |
| 10b | If the disclosure quantifies the possible difference at all, it does so as a **proportion** … never as a fixed dollar figure … | **PASS** | review | It does not quantify at all — vacuously satisfied in the safe direction. No `0.5%`, no dollar band anywhere in `groupCopy.ts`. |
| **11** | **The group's modeled P/L equals the sum of the same per-leg modeled P/L figures shown on its expanded rows, and carries the `Convexa-modeled` basis label everywhere it renders.** | **FAIL** | test (missing) + browser | **Two defects — see the bounce section.** (a) **No test exists.** No assertion anywhere that `group.pl_dollar === Σ member.pl_dollar`, and none that the rendered group P/L equals the sum of the rendered member P/Ls (`grep 'broker-group-pl'` → presence, stale-label, ⏸-dim and withheld-literal assertions only; `grep 'pl_dollar'` in `grouping.spec.ts` → null-propagation only). AC-11 is marked `test` and **blocks the ship**. (b) **Observed wrong in the only state the real feed can produce.** Browser, captured-shaped book: the group header renders modeled P/L **`unavailable`** while every one of its expanded member rows renders **`not provided`**. The label is present in both cases, so the label clause holds. |
| 12 | If **any** leg in a group has a cost the feed never carried **or** a contract size that could not be reconstructed, the group's net entry renders `not provided` — never a partial sum, never 0, never blank. *[CF]* | **PASS** | test | `grouping.spec.ts` "AC-12" `it.each` over **`BOOK_CF_NO_COST`** and **`BOOK_CF_NO_SIZE`**, asserting `{kind:'withheld', literal:'not provided'}` and explicitly `not '$0.00'`, `not /NaN/`. `BOOK_CF_NO_SIZE` is proven to **omit** the key rather than null-pad it. Captured book pinned at 0 for all six withholding counts. |
| 13 | When a group's net entry is withheld, the group's modeled P/L is withheld with it and for the same reason; it never falls back to summing only the legs that have one. `Σ (member.pl_dollar ?? 0)` is a forbidden implementation. *[CF]* | **PASS** | test + browser | `grouping.spec.ts` "AC-13 — FORBIDDEN IMPLEMENTATION: a partial P/L sum" constructs one healthy member (non-null, non-zero P/L) + one withheld member and asserts the group's `pl_dollar` is `null` **and not equal to the healthy value** — the assertion that actually kills the forbidden fold. `BrokerGroupHeader.spec.tsx` "AC-13" renders both slots as the same literal. Browser (doubly-broken CF book): net `not provided`, P/L `not provided`. |
| 14 | A leg whose cost was supplied but unusable this cycle drives the group's aggregates to the `unavailable` family, textually distinct from `not provided`; neither state can be produced by the other's condition. *[CF]* | **PASS** | test | `grouping.spec.ts` "AC-14" on **`BOOK_CF_UNPARSEABLE`** (one transient leg, nothing permanent) → `unavailable`, plus the converse arm on `BOOK_CF_NO_COST` → `not provided`. |
| 15 | When legs in one group are withheld for different reasons, the group renders `not provided` (the permanent cause) over `unavailable` (the transient one) … A group header reading `not provided` above a child row reading `unavailable` … is **correct**. *[CF]* | **PASS** | test | `grouping.spec.ts` "AC-15" on **`BOOK_CF_MIXED_CAUSE`** (proven: one permanent + one transient on *different* legs) → `not provided`. Cascade order pinned directly in `brokerView.spec.ts` "step 2 beats step 3 — PERMANENCE FIRST". |
| 15b | Applying the shared four-step cascade leaves the **shipped per-position literal byte-identical for every single-leg position** on today's feed … *[CF]* | **PASS** | test + review | `brokerView.spec.ts` "AC-15b" `it.each(SINGLE_LEG_CASCADE_ARMS)` — ≥6 arms covering all three N=1 outcomes (`fixtures.contract.spec.ts`). I additionally re-derived the equivalence myself from the diff: the removed expression `!multiplier_known ? NOT_PROVIDED : withheldEntry ? (anyUnparseableBasis ? UNAVAILABLE : NOT_PROVIDED) : figure` maps case-for-case onto the new cascade at N∈{0,1} (0 legs → `not provided` both; multiplier absent → `not provided` both; `not_supplied` → `not provided` both; `unparseable` → `unavailable` both; supplied → figure both). **The only behaviour change in the whole `brokerView.ts` diff is the sanctioned multi-leg mixed-cause inversion** — the extracted `netEntryFigureText` reproduces the old inline template character-for-character (pinned by "is the shipped grammar, to the character"), and no second change slipped in. |
| 16a | In a group row's **net entry** and **modeled P/L** slots, the only not-a-number literals that can render are `not provided` and `unavailable`. `not recorded` renders nowhere … and `no basis` renders nowhere on a group row. | **PASS** | test + browser | `BrokerGroupHeader.spec.tsx` "AC-16a" loops five CF books × both variants, asserting the net text ∈ {`not provided`,`unavailable`} and the header contains neither `not recorded` nor `no basis`. Structurally `no basis` is unreachable: `BrokerGroup` carries no `pl_pct`. *(The AC-11 defect is a wrong choice **between** the two permitted literals, not a sixth literal — so this row's letter holds.)* |
| 16b | A group's quantity fact is **never a blank rendered cell and never a number**: on desktop the header's identity cell spans the quantity column so no cell exists there (or, if a cell exists, it renders `—`); the mobile group card omits the quantity slot entirely. | **PASS** | test + review | Deviation judged and accepted: jsdom exposes no `grid-column` shorthand getter, so the test asserts the **structural proxy** — `header.children` has length 3 (identity, net, right rail), never 4, and the identity cell contains both the count and the toggle. I verified the mechanism in source: `gridColumn: '1 / span 2'` on the identity Box under the same 4-column template as `BrokerPositionRow`. Mobile card renders no quantity node at all. The proxy is strictly stronger against the failure that matters (a stray blank quantity cell). |
| 17a | Beside a withheld group net, the group states how many of its contributing legs could not supply the fact **for the cause the rendered literal names**, out of the group's contributing-leg total … *[CF]* | **PASS** | review + browser | Browser, `BOOK_CF_DOUBLY_BROKEN`-shaped book: header reads `not provided` / `1 of these 2 legs`, tooltip "For 1 of these 2 legs Convexa is missing either the cost Webull sent or the contract size…", and expanding shows the healthy leg still rendering `$10,620.00 debit` beside the withheld one — the refusal is visibly not a failure to read. `BrokerGroupHeader.spec.tsx` "AC-17a" pins the string and that exactly one such element renders. |
| 17b | When causes are mixed within one group, the group renders `not provided` and the count beside it is the **union** cardinality … A doubly-broken leg is counted once. *[CF]* | **PASS** | test + browser | `grouping.spec.ts` "AC-17b … **BOOK_CF_DOUBLY_BROKEN** — 1 of 2, never 2 of 2": `legs_withholding_permanent === 1`, `withheldCountOf === 1`, and the naive sum of cause counts is explicitly shown to be 2 — the number that must never render. Browser confirms only `1 of these 2 legs` renders, and only once. |
| 18 | **Snapshot stale, mark feed up:** the group's leg count and net entry keep their last-known values under the stale treatment; the group's modeled P/L keeps updating and its label names BOTH bases … | **PASS** | test | `BrokerGroupHeader.spec.tsx` "AC-18" × both variants: `modeled_label === 'dual'`, an ancestor of the count clause computes `opacity: 0.62`, and the P/L label matches `/modeled now · on your book as of/`. |
| 19 | **Mark feed down:** the group's modeled P/L dims to last-known (`⏸`) and never blanks; the group's leg count and net entry render un-dimmed and unchanged. | **PASS** | test | `BrokerGroupHeader.spec.tsx` "AC-19" × both variants: P/L text starts `⏸`, non-empty, `opacity 0.5`; the net's computed opacity is **not** 0.5. This is the `[live-vs-static-isolation]` arm and it holds. |
| 20 | In every state where no book is served … the tab renders no group row, no leg count and no expander, and each state's shipped copy is unchanged. A skeleton never renders a placeholder leg count. | **PASS** | test | `grouping.integration.spec.tsx` "AC-20" over `BOOK_NO_CREDENTIAL`→S1, `bookUnknown('broker_unreachable')`→S5, `BOOK_EMPTY`→S4, plus the pending cold-skeleton arm →S9: zero `broker-group-header`, zero `broker-group-toggle`, zero `broker-leg-line` in every one. `renderState.ts` is untouched by this feature, so `state` remains the sole disambiguator. |
| 21 | In the degraded and reauth states, the last-known served book still renders **grouped** beneath its banner … | **PASS** | test | `grouping.integration.spec.tsx` "AC-21" over `bookDegraded('broker_unreachable')` and `BOOK_REAUTH_WITH_SNAPSHOT`: group headers still present. |
| 22 | An equity holding never joins an option group and is never netted with one; no figure spanning shares and option legs renders anywhere on the tab. | **PASS** | test + browser | `grouping.spec.ts` "AC-22" — AAPL's group has exactly 2 option-only members and the AAPL **equity** row sits in `ungrouped`; membership is gated on `legs.every(kind === 'option')`. Browser: the AAPL group reads `$3,850.00 debit` (options only) and a separate `AAPL / Shares / 100 shares / $18,000.00 debit` row renders below — two top-level entries, no combined figure. |
| 23 | A ticker with exactly **one** option leg renders as today's ungrouped option row plus exactly one added secondary clause — `1 option leg · as Webull reports it` as plain text. **No button, no `aria-expanded`, no `aria-controls`, no chevron and never a ghost/disabled one, no group header styling, no `netted by Convexa`.** … | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-23": both clauses read the exact string; within each row zero `broker-group-toggle`, no `[aria-expanded]`, no `[aria-controls]`, no `netted by Convexa`; NVDA's `broker-net-entry` still reads `$7,890.00 debit`. Browser confirms both NVDA and PLTR. *(Recorded per SPEC §7's GATE Q note: the one added clause on these two previously-byte-identical rows is **intentional**, not a regression.)* |
| 24 | (a) A cannot-fully-display (`unrecognized`) entry is never absorbed into a group, never hidden by a collapse, and never counted in a group's leg count. (b) It **renders identically on both form factors** … | **PASS** | test | (a) `grouping.spec.ts` "AC-24a — POS_UNRECOGNIZED stays in ungrouped and never touches Σ leg_count" (zero mapped legs ⇒ `groupKeyOf` returns null ⇒ top-level, never inside a panel). (b) `genericOptionRow.spec.tsx` "R4/F10 · G1 parity … on BOTH form factors" renders `BrokerPositionRow` **and** `BrokerPositionCard` from the same view and compares `broker-pl` and `broker-pl-label` string-for-string, then pins the value to `not provided`. **Owner ruling Q1 verified: the repair is in `BrokerPositionCard.tsx` itself (the `unfaithful` branch now renders `<ModeledPl>` beside `UnfaithfulEntry`), and it is verified on both form factors — it does not ride on any group-row assertion.** |
| 25 | A manual Refresh that returns the same book leaves expanded groups expanded, and a 30-second re-derivation tick does not collapse them. | **PASS** | test | `grouping.integration.spec.tsx` "AC-25": expand TSLA → click `broker-refresh` → still `aria-expanded="true"` (re-queried by `aria-controls`, a fact, not the Show→Hide name) → `vi.advanceTimersByTime(31_000)` → still true. Mechanism verified in source: the React key is the stable `GroupKey`, so the 30 s `nowMs` tick rebuilds derived data without remounting. |
| 26 | After a page reload, all groups render collapsed. | **PASS** | test (e2e) | `broker-grouping.spec.ts` "AC-7 / AC-26 — collapsed on load, and collapsed again after a reload" in real Chromium: expand one, `page.reload()`, re-select the tab, every `[aria-expanded]` is `false` (with a vacuity guard on the count). |
| 27 | This feature introduces **no new durable storage key**: the app's durable keys are identical before and after expanding and collapsing groups. | **PASS** | test + review | `grouping.integration.spec.tsx` "AC-27": `Object.keys(localStorage).sort()` identical before/after expand+collapse. Source: expand state is `useState<ReadonlySet<string>>` in `BrokerTabPanel`; **`grep 'convexa\.'` over `grouping.ts`, `BrokerGroupHeader.tsx`, `groupCopy.ts`, `BrokerTabPanel.tsx` finds only a comment** — no key is written, so `[loss-free-durable-migration]` correctly stays non-binding. |
| 28 | A refresh returning a book that no longer contains a previously-expanded group renders without error and without a stray empty group. | **PASS** | test | `grouping.integration.spec.tsx` "AC-28": expand TSLA, refresh to a TSLA-less book → no `TSLA` text, exactly 2 group headers (AAPL + META), no throw. |
| 29 | For the same book, mobile cards render the same groups, the same leg counts, the same net-entry figure, the same basis label and the same withheld literal as desktop rows. The parity claim extends to **ungrouped** entries (AC-24 (b)) and to the lone-leg clause (AC-23). | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-29" (`matchMedia` forced `<sm`): 3 group headers, TSLA `$13,760.00 debit` + `netted by Convexa`. Every `BrokerGroupHeader.spec.tsx` assertion runs under `describe.each(['row','card'])`. Browser at 393 px: card headers carry identical ticker/count/net/label/P-L text to the desktop rows. Ungrouped parity is AC-24(b)'s dual-form-factor test; the lone-leg clause renders on the card via `secondaryClause`. |
| 30 | `Build reassessment` renders on an **expanded leg row only**. The collapsed group carries **no reassess affordance, no disabled/coming-soon variant, no placeholder and no tooltip stub**; its behaviour and export on a leg row are unchanged from today. | **PASS** | test + browser | **Both halves observed in the browser.** Negative: `getByTestId('broker-group-header').getByTestId('broker-reassess').count() === 0`; no `[aria-disabled="true"]`, no `button[disabled]`, no `/coming soon/i` (`BrokerGroupHeader.spec.tsx` "AC-30 / AC-32"). Positive: after expanding TSLA, `#broker-group-panel-TSLA` contains exactly **3** `broker-reassess` buttons — one per leg. `reassess.tsx` is untouched by the diff and `reassess.spec.tsx` still passes, so the export is unchanged. **Owner ruling Q2 verified: no group-level control and no disabled ghost of one.** |
| 31 | The Simulated tab, the outcome ledger, the Ticker page and a served bundle's score / tier / `state_fingerprint` are identical before and after this feature, and the **`apps/api` diff is empty**. | **PASS** | test + review | `git diff d53199e HEAD -- apps/api` → **0 lines**. The whole change set touches only `features/trading/broker/**`, `src/testing/noNamingVocabulary.ts`, `eslint.config.mjs`, `tsconfig.spec.json` and the e2e spec — `positions/derive.ts`, `outcomes/`, `pages/ticker/` are untouched. `nx test api` green; `nx test @org/dashboard` 1434 green (the sim/ledger/ticker suites included). `grouping.integration.spec.tsx` "AC-31 (FE half)" pins the network call set to the shipped pattern — no new fetch. |
| 32 | The Broker tab still exposes zero order, trade, close or modify affordances — grouping adds none, including on the group row. | **PASS** | test + browser | `broker.risk.spec.tsx` "zero order affordances on every wire arm" runs over ALL_ARMS (now grouped) banning the forbidden testids, the order-verb button regex and "coming soon"/"place an order". `BrokerGroupHeader.spec.tsx` asserts the header's **only** button is the toggle. Browser: the entire tab's buttons are Refresh, the three group toggles and the per-leg `Build reassessment` (advisory, never a write). `[no-real-order-path]` intact. |
| 33 | Group order is stable … Members render in `broker_position_id` order. | **PASS** | test | `grouping.integration.spec.tsx` "AC-33": two `groupBook` runs give `['AAPL','META','NVDA','PLTR','TSLA']` both times and TSLA's member ids equal their own sort. Implementation sorts by key/id — both facts, never a derived number. |
| 34 | The panel's count line still reads the number of **positions** the broker reported, unchanged in wording; it never counts groups and gains no group clause. | **PASS** | test + browser | `grouping.integration.spec.tsx` "AC-34": `14 positions`, and the line matches no `/group/i`. Browser confirms `14 positions`. `BROKER_COPY.positionsCount(views.length)` unchanged in `BrokerTabPanel`. |
| 35 | Webull's own `unrealized_pl` is neither summed nor rendered at group level: the distinctive captured values never reach rendered text on any group surface. | **PASS** | test | `grouping.integration.spec.tsx` "AC-35" scans the whole populated tab's text against every supplied captured `unrealized_pl` value; `unrenderedBrokerPl.spec.tsx` gained "no captured broker P/L value appears in the GROUP header/panel text either" and its source scan still proves `brokerView.ts` is the only non-fixture module naming the field — with its own mutation guard. |
| 36 | The group's expand control is a real `<button type="button">` with an accessible name, `aria-expanded`, and `aria-controls` resolving to a **rendered** panel element in both states … Exactly **one** focus indicator … Enter and Space both toggle it. | **PASS** | test + review | `BrokerGroupHeader.spec.tsx` "AC-36" × both variants: `tagName === 'BUTTON'`, `aria-expanded` flips, `getElementById(panelId)` resolves in **both** states (the panel is always rendered, `hidden` when collapsed), Enter and Space each toggle. Single ring: e2e `broker-grouping.spec.ts` "AC-36" reaches the toggle by **real keyboard Tab** in Chromium and asserts every ancestor's computed `outlineStyle === 'none'` — the shipped `BrokerPositionRow` `:focus-within` ring never wraps the group control. |
| 37 | No horizontal overflow at **393px** with a group expanded — nested children drop their own border and outer padding rather than doubling the frame. Joins the existing 393px viewport set. | **PASS** | test (e2e) + browser | e2e "AC-37" with vacuity guards (header count > 0, leg-line count > 0 after a real click) then `scrollWidth <= innerWidth`. I reproduced independently in Chromium at 393×852 with TSLA expanded: **`scrollWidth 393 === innerWidth 393`**. Nested chrome verified in source: `nested` sets `border: none`, `padding: '8px 0'`, `borderRadius: 0` on both row and card, and may change chrome only. *(See §3 for the separate text-overlap observation — nothing clips or overflows.)* |
| P1 | The provenance clause renders **iff** the derived boolean is true … *[CF]* | **PASS** | test | `BrokerGroupHeader.spec.tsx` "P1" on **`BOOK_CF_NO_RECON_NOTE`** (proven by `fixtures.contract.spec.ts` to carry no reconstruction note yet a real figure): `net_rests_on_derived_size === false`, the expanded note matches the FALSE string byte-for-byte and contains no `/contract size/i`. `grouping.spec.ts` "P1/P3" pins the OR across members. |
| P2 | The boolean is derived from the note's presence via a **single exported `brokerView.ts` constant**, which equals `fixtures.ts`'s `NOTE_MULTIPLIER_RECONSTRUCTED` and is present on the captured option fixtures. | **PASS** | test + review | `brokerView.spec.ts` "P2 …": the constant equals the fixture note verbatim; TRUE on a captured option position, FALSE with the note absent; **mutation guard** proves exact-string membership (an "(edited)" suffix returns false), not a substring sniff. Source: `NOTE_MULTIPLIER_RECONSTRUCTED` + `restsOnDerivedSize` live only in `brokerView.ts`; no render module imports `fixtures.ts`. |
| P3 | The clause is **absent** whenever the net is withheld, and **present** on a `$0.00` net. *[CF]* | **PASS** | test | Absent: `BrokerGroupHeader.spec.tsx` "the panel REPLACES the basis sentence with the withheld reason" on `BOOK_CF_DOUBLY_BROKEN`, and the withheld branch renders no `broker-group-net-label` at all (browser-confirmed: count 0). Present on zero: "AC-9c + P3 — `$0.00` bare, the basis clause still present"; `grouping.spec.ts` confirms `BOOK_CF_ZERO_NET` keeps `kind: 'value'` with the boolean true. |

**Summary: 48 PASS / 1 FAIL / 1 UNVERIFIABLE (50 criteria).**
**Conformance: backend `PASS` · QA `PASS` (agree).**

---

## 2. Invariants (BRIEF "Invariant watch" + promoted canon)

| Invariant | Verdict | Evidence |
|---|---|---|
| **`[absent-is-not-none]`** (HARD — "the live edge of this feature") | **BROKEN** | The five literals survive as five and no sixth is introduced — but at the netting boundary the **permanent** literal collapses into the **transient** one: on the captured/real book shape the group's modeled-P/L slot renders `unavailable` above member rows that each render `not provided`. SPEC §8's own words: "`not provided` must never collapse into `not recorded` **or into `unavailable`**." See the bounce. |
| `[model-read-carries-its-assumptions]` | PASS | The provenance clause is **derived** from a single exported production constant and ORed across members; the netted figure always carries `netted by Convexa` plus a tooltip naming the composition, and the derived-contract-size sentence appears only when the boolean is true (P1/P2/P3, browser-observed). |
| `[additive-keeps-score-byte-identical]` | PASS | `git diff d53199e HEAD -- apps/api` = **0 lines**; `nx test api` green; the import boundary keeps `grouping.ts` off every scoring path. |
| `[live-vs-static-isolation]` | PASS | Netted entry is static and un-dimmed on a mark-feed drop (AC-19 asserts the net's opacity is not 0.5 while the P/L is); the P/L is live-derived, dims to `⏸` at 0.5 and never blanks; the snapshot family takes 0.62 on stale with the dual label. No third "partially stale" treatment exists. |
| `[theme-token-discipline]` | PASS | **Zero hex** in `BrokerGroupHeader.tsx` / `groupCopy.ts` / `grouping.ts` (grep). Only palette tokens (`divider`, `text.primary`, `text.secondary`, `success.main`, `error.main`) and the reused shipped `STALE_SNAPSHOT_SX` / `FactText`. No `extrasFor` is needed because no mode-aware value is used, and **light-mode parity was observed in the browser**: bodyBg `rgb(246,246,243)`, ticker/net `rgb(23,32,43)`, count/label `rgba(0,0,0,0.6)`, divider `rgba(0,0,0,0.12)` — correct light tokens, nothing dark-locked. |
| `[no-real-order-path]` | PASS | AC-32. Read-only by ABSENCE — no write affordance, not even a disabled one, on the group row. |
| `[single-shared-sim-entry-dialog]` | PASS | Untouched; this feature opens no entry dialog (`broker.risk.spec.tsx` still asserts no broker file references `TradeEntryDialog`). |
| `[loss-free-durable-migration]` | PASS (correctly **non-binding**) | Expand state is ephemeral React state keyed on the stable `GroupKey`; **no `convexa.*` key is introduced** (grep + AC-27). |
| `positions.length` is never a disambiguator | PASS | `renderState.ts` untouched; `resolveRenderState` still branches on `state` only (`renderState.spec.ts` AC-10 arm). |

---

## 3. Findings that do not change a verdict (recorded, not bounced)

1. **The lane's F6 fallback deny-list is sufficient — but it is weaker than the commit message implies, and Layer 2 is what actually closes the gap.** I probed Layer 1 live with `eslint --stdin`: it **bites** on `'@/features/trading/positions/structure'` (exit 1, correct message), but it does **not** bite on the relative form `'../positions/structure'` — the `patterns.group` entries are literal specifiers with no wildcard. That path is caught by Layer 2's set-A regex `/from\s+['"][^'"]*positions\/(structure|view|leg)['"]/`, which matches every import-path shape, and by Layer 3 on the outcome. Net judgement: the three-layer stack still closes the hole, but Layer 1 alone is thinner than "three specifiers holding all four entry points" suggests.
2. **Layer 3's mutation guards exercise the predicates on synthetic DOM/strings, not on a deliberately poisoned `BrokerGroupHeader` render.** SPEC §2.3 words it as "a deliberately poisoned header". Guards 1–3 do prove the *channel-1 pipeline* (`b1HitsIn(innerHTML)`) catches rendered text and an `aria-label`, and guard 3 proves the tooltip pipeline — but the attribute-harvesting half of `namingSurfaceOf()` (channel 2's assembler) is itself never proven non-vacuous. Low risk (channels 3 and 4 independently cover accessible names and tooltips), worth a line in a future hardening pass.
3. **The 393 px text overlap the lane flagged for triage — NON-BLOCKING, but the provenance in the lane's note is wrong.** Measured in Chromium at 393×852 on the captured-shaped book: on each **lone option card** (NVDA, PLTR) the feature-authored clause `1 option leg · as Webull reports it` (`whiteSpace: nowrap`) overlaps the `Convexa-modeled` P/L label by **33.0 px horizontally × 13.8 px vertically**. The vertical relationship the lane described (`not provided` over `Convexa-modeled`) actually has **3.8 px of clearance**; the real collision is clause-over-label. Nothing clips and nothing overflows (`scrollWidth 393 === innerWidth 393`), no figure is affected, and AC-37's letter passes — so **it does not block**. But it is **not** purely pre-existing `broker-connect` layout: the colliding element is `LoneLegClause`, authored by this feature and inserted into `BrokerPositionCard` by this feature via `secondaryClause`. Recommend logging it as a follow-up against DESIGN_RULES §5 ("fully responsive down to mobile") rather than closing it as untouched.
4. **Three flagged test-approach deviations — all three judged acceptable.** (a) AC-16b's `gridColumn` → 3-grid-children structural proxy: accepted, source verified, and the proxy is stronger against the failure that matters. (b) Tab-for-reachability + hover-for-content: accepted; the MUI `:focus-visible` gap is real, it is documented in-file against a cited precedent, and the real-browser e2e covers keyboard focus on the toggle. (c) `broker.integration.spec.tsx`'s `getByText(/NVDA/)` → `getAllByText(/NVDA/).length > 0`: accepted; `NVDA_SPREAD` legitimately becomes a 2-leg group, and the adaptation is the minimum that stays true.
5. **`[CF]` anti-coincidence: verified row by row, not accepted from the lane's matrix.** `fixtures.contract.spec.ts` asserts over the **raw wire shape** that the captured book has zero `not_supplied`, zero `unparseable`, zero absent multipliers, a reconstruction note on every option position, exactly one leg per position, and a strictly positive (debit) net for all five tickers — so none of the CF cases can be reached from it. I then traced every `[CF]` row to the specific constructed book its test imports (recorded inline in the table above). No `[CF]` row is satisfied off the captured arm.
6. **Ground truth held.** `3,850.00 / 3,805.00 / 13,760.00 / 7,890.00 / 4,990.00` all observed rendered in a real browser. `3,802.00` and `7,889.00` occur in the repo **only** inside e2e negative assertions.
7. **AC-2 vs SPEC §4's mobile sketch (cosmetic, non-blocking).** §4 says the mobile card's "entire header line is the full-width disclosure button"; the shipped card puts the ticker beside a full-width-flex toggle rather than inside it. AC-2/AC-36's letters are satisfied (five elements, one real button, ≥44 px min-height), so this is a note, not a finding.

---

## 4. Overall GATE Q verdict

# **FAIL**

48 PASS · **1 FAIL (AC-11)** · 1 UNVERIFIABLE (AC-1b, owner-only). Conformance backend `PASS` / QA `PASS`.

The build is in excellent shape: every gate reproduces, the `[CF]` discipline is real and provable, the
no-naming machinery demonstrably bites at all three layers, both owner rulings hold in the shipped code,
and the F2 cascade is a genuine no-op at leg level with exactly one sanctioned change. GATE Q fails on a
single criterion — but that criterion is a ship-blocker, it is the one AC with no test at all, and its
defect is the **default state on the owner's real book**, not an edge case.

---

## Amendments bounced to Frontend

### B1 — AC-11: the group's modeled P/L renders `unavailable` where every member row renders `not provided`, and AC-11 has no test

**Owning lane:** Frontend. **Blocks the ship** (SPEC §3 blocking list includes 11). **Also breaks the
HARD invariant `[absent-is-not-none]`.**

**Acceptance criterion (verbatim):**
> The group's modeled P/L equals the sum of the same per-leg modeled P/L figures shown on its expanded
> rows, and carries the `Convexa-modeled` basis label everywhere it renders. — *Verify by: test*

**Expected.** Where the group cannot state a combined modeled P/L, the slot presents the **same withheld
state its members present**. SPEC §4's component-state table binds this explicitly: *"Modeled P/L slot
(group) … withheld literal + label, **same precedence as the net**"* — and the net's precedence is
**permanence-first** (§2.6). SPEC §8: *"`not provided` must never collapse into `not recorded` **or into
`unavailable`**."* SPEC §2.6's own rationale for the whole cascade correction: `unavailable` *"sells the
trader a refresh that cannot work."*

**Observed (Chromium, `localhost:4300`, captured-shaped book, network stubbed at the boundary):**

```
AAPL   2 option legs · grouped by underlying   ⌄
       $3,850.00 debit                              unavailable
       netted by Convexa                        Convexa-modeled
   └─ (expanded)  AAPL  … Net entry $6,920.00 debit   not provided   Convexa-modeled
                  AAPL  … Net entry $3,070.00 credit  not provided   Convexa-modeled
```

The header says *"we couldn't read it this cycle — refresh"*; every leg underneath says *"the feed never
carried it"*. Same column, same question, opposite permanence claims.

**Why this is the default state, not an edge case.** Webull's `/account/positions` carries no
strike/expiry/right (PROJECT_CONTEXT §6, INTERFACE_CONTRACT Amendment 1), so
`positions/view.ts:413` sets `unpriceable = true` for **every** broker option leg, `legContractKey` is
`null` so no contract is ever fetched, and `pl_dollar` is `null` on every option position. The shipped
leg-level renderer classifies that as permanent — `BrokerPositionRow.tsx:135`
`const permanent = !view.entry_known || view.unpriceable;` → `not provided`, with the
`unpriceableTip` explaining it. The group-level renderer ignores that classification entirely:

```ts
// BrokerGroupHeader.tsx:213 — GroupPl, the pl_dollar == null branch
const literal = group.net_entry.kind === 'withheld' ? group.net_entry.literal : UNAVAILABLE;
```

When the **net** is a figure (the normal case — costs are supplied) and the **P/L** is null, the literal
is hardcoded `UNAVAILABLE`. So on the owner's live book, *every* group header will read `unavailable`
above members reading `not provided`, every day, until `/trade/instrument` lands. The group also drops
the `unpriceableTip`, so the reader loses the one explanation the leg row carries.

**Minimal repro.** Serve the captured book (`BOOK_CAPTURED_COMPLETE`, no injected leg marks — i.e. the
real feed), open the Broker tab, read any group header's right rail, then expand it and read the same
column on its members. Header: `unavailable`. Members: `not provided`.

**Why the suite is green.** Two gaps, both worth closing:
- `BrokerGroupHeader.spec.tsx` injects synthetic marks for every group (`marksForBook()`, lines 27–39,
  with the comment *"so `pl_dollar` resolves to a figure"*), so the header specs never exercise the
  state the real feed produces.
- `BrokerGroupHeader.spec.tsx` "AC-16a" deliberately accepts **either** literal
  (`expect(['not provided','unavailable']).toContain(net)`; the P/L check is an `||` over both), so it
  cannot distinguish right from wrong here.
- **AC-11 itself has no test.** No assertion exists that `group.pl_dollar === Σ member.pl_dollar`, nor
  that the rendered group P/L matches the members'. AC-11 is marked `test` and blocks the ship; under
  `qa-verify` §4 a required-but-missing test on a ship-blocking invariant row is itself a GATE Q FAIL,
  independent of the defect above.

**Closest buildable alternative (not a fix — the shape of one, for GATE Z to rule on).** Give the group's
P/L slot the same permanence-first precedence the net already has, derived from the members rather than
hardcoded — e.g. carry a `pl_withheld_permanent` boolean on `BrokerGroup` (OR over
`!member.entry_known || member.unpriceable`, exactly the leg-level predicate) and render
`not provided` when it is true, `unavailable` only when every member's withholding is genuinely
this-cycle. This adds **no sixth literal**, needs **no new copy**, keeps `grouping.ts` inside its import
allow-list (`unpriceable` and `entry_known` are already fields on `BrokerPositionView`), and leaves every
other AC's assertion untouched. Pair it with the two missing tests:

1. **AC-11 positive** — with marks resolved, the rendered group P/L equals the signed sum of the rendered
   member P/Ls (the DOM read-back shape `grouping.integration.spec.tsx` already uses for AC-8), and the
   `Convexa-modeled` label is present in both the figure and the withheld branch.
2. **AC-11 withheld / `[absent-is-not-none]`** — on the captured book **with no injected marks** (the real
   feed), the group's P/L literal is **byte-identical** to its members' P/L literal. That single assertion
   would have caught this, and it is the regression guard that keeps the two levels from drifting again.

*(Recorded for the same pass, non-blocking: finding §3.3 — the 393 px `LoneLegClause` ↔ `Convexa-modeled`
overlap on mobile lone cards, 33.0 × 13.8 px, feature-authored rather than pre-existing.)*

---
---

# RE-RUN — GATE Q re-verification after the GATE Z fix

**Role:** QA / Verification (same fresh, de-correlated session discipline; I still fix nothing).
**Date:** 2026-08-06 · **Baseline commit:** `d53199e` · **Head:** `d85b5a0` **plus an uncommitted
working tree** (9 modified files: 6 under `broker/`, `eslint.config.mjs`, `.claude/BACKLOG.md`,
`.claude/OPEN_THREADS.md`). Everything below was observed against that working tree.
**Trigger:** my prior verdict **FAIL — 48 PASS / 1 FAIL (AC-11) / 1 UNVERIFIABLE**; the Frontend lane
returned a fix. Nothing in sections 0-4 above is deleted — it is the record of what was wrong.

> **A fix is never trusted unobserved.** Every claim the lane made was re-derived here: the gates were
> re-run for their **exit codes**, Layer 1 was re-probed live with `eslint --stdin`, the 393px overlap
> was re-measured (including an **A/B against the pre-fix style** in the live browser), and AC-11 was
> re-verified in real Chromium against a captured-shaped book with **no injected marks** and
> `/api/contract/` **404ing** — the exact state that produced the defect.

**Environment hygiene first.** `npm run ports:free` reported "all clear" — and was **wrong**:
`netstat -ano` found three **IPv6-only** orphan listeners (`[::1]:4200` pid 52332, `[::1]:4300` pid
68220, `[::1]:4301` pid 39212) that `tools/free-ports.mjs` does not see. One was answering `200` on
`:4300`. All three were killed with `taskkill /T /F` before a single observation was taken, and the
dev server was restarted with `--strictPort` so a silent fallback to another port could not happen.
**No measurement below was taken against a server I did not start from this working tree.**
*(Recorded as finding R-5 — the ports helper is IPv4-only, so the CLAUDE.md trap it exists to prevent
is still reachable.)*

## R0. Gates re-run independently — exit codes, never printed summaries, never through a masking pipe

| Gate | Command | Result | Exit |
|---|---|---|---|
| FE suite | `npx nx test @org/dashboard --skip-nx-cache` | **122 files / 1439 tests passed** (was 1434 — **+5**) | **0** |
| Typecheck | `npx nx typecheck @org/dashboard --skip-nx-cache` after `rm -rf apps/dashboard/dist` and deleting every `*.tsbuildinfo` (an incremental 186ms hit was refused; the clean run took **4.8s**) | 0 errors | **0** |
| Lint (scoped) | `npx nx lint @org/dashboard --skip-nx-cache` — scoped deliberately, never `run-many` | 0 errors / 0 warnings | **0** |
| e2e | `npx nx e2e dashboard-e2e --skip-nx-cache` | **41 passed** | **0** |
| BE suite | `npx nx test api --skip-nx-cache` | **272 passed**, 3 warnings | **0** |
| Empty backend diff | `git diff d53199e -- apps/api \| wc -l` **and** `git status --short apps/api` | **0 lines / 0 files** | — |
| Broker specs, verbose | `npx vitest run --reporter=verbose grouping.spec.ts grouping.integration.spec.tsx BrokerGroupHeader.spec.tsx` | **90 passed** | **0** |

Every claimed count reproduces (1439 / 41 / 272 / lint 0 / typecheck 0 / empty `apps/api` diff).

## R0b. Runtime interface conformance — both verdicts, re-run independently

| Receipt | Verdict | Endpoints | When |
|---|---|---|---|
| Backend lane — `conformance-receipt.json` | `PASS` | 1/1, 9 required fields | 2026-08-06T19:50:11Z |
| **QA (authoritative)** — `conformance-receipt-qa.json` | **`PASS`** | 1/1, 9 required fields | **2026-08-06T21:05:46Z** |

Re-run by me against a backend I booted myself (`apps/api/.venv/Scripts/python.exe main.py`,
`MASSIVE_API_KEY=dummy-verify AI_REC_STUB=1`, `http://127.0.0.1:8000`) with **`--auth-signup` only** —
never `--auth-cookie`, never a credentialed session, `POST /book/refresh` untouched. Tool exit **0**.
**The two verdicts agree.** No bounce on this axis. (The interface is `NO_BACKEND_CHANGE` but carries
an executable `## Conformance spec`, so it is run rather than waived.)

## R1. The bounced criterion — AC-11 — re-verified by observation, not by the fix note

**AC-11 (verbatim):** *The group's modeled P/L equals the sum of the same per-leg modeled P/L figures
shown on its expanded rows, and carries the `Convexa-modeled` basis label everywhere it renders.* —
*Verify by: test.* **Blocks the ship.**

### R1.1 The real-feed state, in a real browser — the observation the old green suite could not make

Chromium 1280x900, `http://localhost:4300`, the **full 14-position captured book**
(`BOOK_CAPTURED_COMPLETE`, reconstructed field-for-field from `broker/fixtures.ts` with a fresh
`as_of`), network stubbed at the boundary, **no injected leg marks**, `/api/contract/` fulfilled
**404** for every request — i.e. exactly what the Webull feed produces. Read straight off the DOM:

```
AAPL | 2 option legs · grouped by underlying | v | $3,850.00 debit | netted by Convexa | not provided | Convexa-modeled
   expanded members: pl   = ["not provided","not provided"]   labels = ["Convexa-modeled","Convexa-modeled"]
                     nets = ["$6,920.00 debit","$3,070.00 credit"]                        AGREE = true
META | 2 option legs · grouped by underlying | v | $3,805.00 debit | netted by Convexa | not provided | Convexa-modeled
   expanded members: pl   = ["not provided","not provided"]                               AGREE = true
                     nets = ["$1,075.00 credit","$4,880.00 debit"]
TSLA | 3 option legs · grouped by underlying | v | $13,760.00 debit | netted by Convexa | not provided | Convexa-modeled
   expanded members: pl   = ["not provided","not provided","not provided"]                AGREE = true
                     nets = ["$10,620.00 debit","$3,396.00 credit","$6,536.00 debit"]
```

The defect is **gone at the only place it mattered**: the header literal is now byte-identical to
every expanded member's literal, on the state the owner's real book produces every day. The net still
renders a **figure** in all three groups — so this is the exact fall-through branch that previously
hardcoded `UNAVAILABLE`, not a case dodged by withholding the net too. The `Convexa-modeled` label is
present in the withheld branch and on every member. Mobile 393px card headers carry identical text
(`AAPL … $3,850.00 debit … not provided … Convexa-modeled`).

Whole-tab scan on that same render: `unavailable` appears **five** times and every one of them is
inside a top-level **equity** `broker-row`'s own `broker-pl` (no spot resolves for equity marks under
the stub) — **zero occurrences on any group surface**. `not recorded` and `no basis`: **zero**.

### R1.2 The arithmetic arm, and the tests that now exist

Named, passing, and verified to have actually run (verbose reporter, exit 0):

| Test | File | What it pins |
|---|---|---|
| `AC-11 — the group modeled P/L equals Σ member.pl_dollar, exactly › AAPL / META / TSLA: group.pl_dollar sums its own resolved members, to the cent` | `grouping.spec.ts` | the arithmetic identity, with an explicit `members.every(pl != null)` guard so a partial fold cannot satisfy it |
| `AC-11 / [absent-is-not-none] — the REAL feed shape: … every group P/L renders "not provided", matching every member` | `grouping.spec.ts` | the literal, plus `entry_known === true` and `unpriceable === true` on every member — the anti-coincidence half |
| `AC-11 / [absent-is-not-none] — the REAL feed shape (unpriceable, no injected marks) …`, run under `describe.each(['row','card'])` | `BrokerGroupHeader.spec.tsx` | the **rendered** header literal on both form factors |
| `AC-11 · the group P/L literal is byte-identical to its expanded members', end to end › captured book …` | `grouping.integration.spec.tsx` | the real `BrokerTabPanel`, expanded, header text vs every member's `broker-pl` text, behind a `netText` figure guard |

**Non-vacuity, argued from evidence rather than asserted:** these tests assert the **exact literal**,
and I observed the *old* build render the other literal in precisely this state in my previous pass —
so each of them fails against the code as it stood at the bounce. The integration arm additionally
asserts the net matches `/debit|credit/` first, which is the guard that stops it from passing for the
wrong reason (a withheld net).

**AC-11 verdict: PASS** — route **test** (four named tests) **+ browser** (independently observed).

## R2. The four specific things I was told not to accept

**(a) "The fix did not just move the hardcode."** Confirmed, with one honest caveat.
`plWithheldLiteralOf` (`grouping.ts:137-151`) **delegates** to the shared `withheldLiteralOf`
(`brokerView.ts:118-127`); it restates no ordering of its own. A repo-wide scan of every literal
selection site (`grep 'UNAVAILABLE\|NOT_PROVIDED'` over `broker/*.ts{,x}` minus specs and fixtures)
finds exactly **one** ordered precedence chain in the codebase — the shared cascade. The former
hardcode at `BrokerGroupHeader.tsx:213` is gone; the header now reads
`plWithheldLiteralOf(group) ?? UNAVAILABLE`, and that `??` is unreachable (the branch is guarded by
`pl_dollar == null`, under which the function never returns `null`).
**Caveat, recorded as R-1:** because the call zeroes the three net-axis buckets, the only value the
shared cascade can return there is the permanent one, and the *transient* default is supplied by the
call site's `?? UNAVAILABLE`. So the shared function carries the permanence rule but not the whole
P/L-axis decision, and the shared function's `null` ("render the figure") is re-read at this one call
site as "no permanent cause — fall back to transient". It is one rule, not two competing ones; it is
not a *complete* delegation. No AC turns on it.

**(b) "`legs_unpriceable` gates only the P/L axis."** **Verified true, three ways.** (i) Source: the
net-axis call at `grouping.ts:235-240` passes only the three original buckets — `legs_unpriceable` is
absent; the leg-level call at `brokerView.ts:296-301` likewise. Only `plWithheldLiteralOf` supplies
it. (ii) Behaviour, in the browser: on the captured book **every** member is `unpriceable` and all
three groups still render their net as a **figure** (`$3,850.00` / `$3,805.00` / `$13,760.00`), which
is precisely what would break if the bucket leaked into the net. (iii) The `BOOK_CF_CREDIT` and
`BOOK_CF_ZERO_NET` books — whose legs are also unpriceable — still render `$1,600.00 credit` and
`$0.00` respectively. A leak would have turned all five into `not provided`.

**(c) "F2's leg-level no-op still holds — check the `defaults to 0` claim."** **Verified.**
`legs_unpriceable?: number` is optional and read as `(input.legs_unpriceable ?? 0)`; neither existing
call site passes it, so both are provably unchanged at the type and the value level. Behaviourally:
the AC-15b `it.each(SINGLE_LEG_CASCADE_ARMS)` arms and the whole 1439-test suite are green, and in the
browser the two lone option rows still render `$7,890.00 debit` / `$4,990.00 debit` with `not provided`
P/L and their shipped literals unchanged.

**(d) AC-13's "same reason" arm, on a transient book.** Driven live on `BOOK_CF_UNPARSEABLE` (net
withheld for `unparseable`, nothing permanent on the net axis):

```
BOOK_CF_UNPARSEABLE: net="unavailable"  pl="unavailable"  pl_label="Convexa-modeled"
```

The P/L carries the net's literal **verbatim** — no silent upgrade to a permanent literal, and no
downgrade. Same for the four permanent books, each of which renders `not provided` in **both** slots
(`BOOK_CF_NO_COST`, `BOOK_CF_NO_SIZE`, `BOOK_CF_MIXED_CAUSE`, `BOOK_CF_DOUBLY_BROKEN`), with
`1 of these 2 legs` beside the **net** only and never beside the P/L. See finding **R-2** for the
residual this arm exposes.

## R3. Regression sweep over the 48 that previously passed

The fix touched the cascade core, the arithmetic, the presentational unit **and** the lint config, so
the blast radius was re-exercised rather than assumed. Route legend as before.

| AC | Verdict | Re-verification in THIS pass |
|---|---|---|
| 12 | **PASS** | Browser, `BOOK_CF_NO_COST` **and** `BOOK_CF_NO_SIZE`: net `not provided`, never `$0.00`, never blank, never `NaN`; `grouping.spec.ts` AC-12 `it.each` green. |
| 13 | **PASS** | Browser, all five withheld CF books: net and P/L render the **same** literal (see R2(d)); `grouping.spec.ts` "FORBIDDEN IMPLEMENTATION: a partial P/L sum" + `BrokerGroupHeader.spec.tsx` AC-13 × both variants green. |
| 14 | **PASS** | Browser, `BOOK_CF_UNPARSEABLE` → `unavailable` in both slots; converse arm (`BOOK_CF_NO_COST` → `not provided`) green. Textually distinct, neither reachable from the other's condition. |
| 15 | **PASS** | Browser, `BOOK_CF_MIXED_CAUSE` → `not provided` (permanent beats transient) with member rows reading `["not provided","unavailable"]` in their own net column — the divergence SPEC §2.6 declares correct. |
| 15b | **PASS** | The `WithholdingInput` extension is provably inert at N=1 (R2(c)); AC-15b's arms green; lone rows re-observed unchanged in the browser. |
| 16a | **PASS** | **Strengthened since the last pass.** The spec's own test moved from set-membership to an exact expected literal per book, and I confirmed the table's expectations against the browser one book at a time. Group slots rendered only `not provided` / `unavailable`; `not recorded` and `no basis` appeared **nowhere** on any header or on the whole tab. |
| 17a | **PASS** | Browser, `BOOK_CF_DOUBLY_BROKEN`: `not provided` + `1 of these 2 legs`, rendered exactly once and beside the **net** only — the new P/L literal did **not** acquire a count. |
| 17b | **PASS** | Same render: the union cardinality `1`, never `2`. |
| 18 / 19 | **PASS** | Untouched code paths (both live on the `pl_dollar != null` branch, which the diff does not enter); `BrokerGroupHeader.spec.tsx` AC-18/AC-19 × both variants green. |
| 1, 6b, 7, 22, 26, 30, 32, 33, 34 | **PASS** | Re-observed live on the captured book: `broker-rows` has 11 children = the count line `14 positions` + **10 top-level entries** (3 `broker-group-entry`, 2 lone `broker-row`, 5 equity `broker-row`); headers read `3 / 2 / 2 option legs`; all three panels `hidden` with `aria-expanded="false"` and `aria-controls` resolving; AAPL's equity row renders separately from AAPL's option group; group headers contain **1** button, **0** `broker-reassess`, **0** `[aria-disabled]`/`disabled`, no "coming soon"; the tab's buttons are Refresh + 3 chevrons + the per-leg `Build reassessment` (3 inside the TSLA panel); e2e AC-7/AC-26 green. |
| 23 | **PASS** | Both lone rows still carry exactly one added clause, **0** toggles, **0** `[aria-expanded]`, **0** `[aria-controls]`, no `netted by Convexa`. The `LoneLegClause` change is style-only — the text and testid are byte-identical. |
| 5, 29 | **PASS** | Expanded TSLA members render their own qty, nets and **both** fidelity notes verbatim; mobile 393 headers carry the same ticker/count/net/label/P-L text as desktop. |
| 4, 4b | **PASS** | Layer 1 re-probed live (below); Layer 2 and Layer 3 suites green; e2e AC-4 (all 22 label values + 13 B2 regexes against real rendered text) green. |
| 31, 35, 27 | **PASS** | `apps/api` diff **0 lines / 0 files**; `nx test api` 272 green; no `convexa.*` key in the changed modules; captured `unrealized_pl` values absent from rendered text. |
| 37 | **PASS** | Re-measured at 393x852: `scrollWidth 393 === innerWidth 393` collapsed **and** with a group expanded (14 leg lines rendered — the vacuity guard). |
| **Owner ruling Q1** (`unrecognized` P/L parity on both form factors) | **holds** | `genericOptionRow.spec.tsx` R4/F10 parity test green; `BrokerPositionCard.tsx` unchanged by this fix. |
| **Owner ruling Q2** (no group-level reassess, not even a ghost) | **holds** | Re-observed: 0 reassess / 0 disabled / 0 "coming soon" in every group header. |

**Layer 1, re-probed live with `eslint --stdin` (not accepted from the note):**

| Target file | alias form `@/features/trading/positions/structure` | relative form `../positions/structure` |
|---|---|---|
| `grouping.ts` | **bites** — `no-restricted-imports`, exit **1** | **bites** — exit **1** *(this is the fix)* |
| `BrokerGroupHeader.tsx` | **bites** — exit **1** | **does NOT bite** — exit **0** |
| `groupCopy.ts` | **bites** — exit **1** | **does NOT bite** — exit **0** |

The bounce is closed for `grouping.ts`. The two presentational modules keep the `**/features/...`
glob form, which minimatch does not match against `../positions/...`, so my original finding survives
there — see **R-3**. It is not an AC failure: Layer 2's set-A regex
(`/from\s+['"][^'"]*positions\/(structure|view|leg)['"]/`) matches **every** import-path shape and
covers those files, and Layer 3 fails on the outcome.

## R4. The 393px overlap — measured, and A/B'd against the pre-fix style

I did not accept "0.0px". I measured the shipped style **and** then, in the same live page, forced
`whiteSpace: nowrap` back onto the clause via the DOM to reproduce the pre-fix geometry side by side:

| | clause box | clause right edge | `Convexa-modeled` label | overlap (x, y) | card right | doc scrollWidth |
|---|---|---|---|---|---|---|
| **Shipped** (`normal` + `overflowWrap: anywhere`) | x 37.0, w 225.8, h **42.2** (2 lines) | **262.8** | x 272.8, w 83.2 | **0.0 x 15.8** | 356.0 | 393 |
| **Counterfactual** (`nowrap`, the pre-fix style) | x 37.0, w 268.8, h 21.1 (1 line) | 305.8 | x 272.8, w 83.2 | **33.0 x 13.8** | 356.0 | 393 |

The counterfactual reproduces my previously reported **33.0 x 13.8 px** overlap to the decimal, which
is what makes the shipped row's **0.0 px horizontal overlap** a measurement rather than a claim. There
is now ~10 px of clearance between the clause and the label.

**No new collision or clip was introduced.** A pairwise bounding-box scan over **every** leaf text
node on both lone cards returns **`[]`** — zero collisions anywhere on the card, not just at the pair
that used to collide. The clause is not clipped (`scrollWidth 226 === clientWidth 226`,
`scrollHeight 42 === clientHeight 42`). Document `scrollWidth === innerWidth === 393` collapsed and
expanded. The P/L element's geometry is **byte-identical between the two states** (x 296.8, w 59.2,
h 43.8) — so the two-line `not / provided` wrap visible on the lone card is **pre-existing** and not a
side-effect of this change. A screenshot of the card at 393 px confirms the visual: ticker + chip,
`1 leg`, the clause on two lines, and `not provided` / `Convexa-modeled` in the right rail, nothing
touching, nothing cut.

`[theme-token-discipline]` re-checked on the diff: **zero hex** in the changed modules; the only style
change is two layout properties. No colour decision was made, so light/dark parity cannot have moved.

## R5. Ground truth

Observed rendered in a real browser on the captured book: **AAPL $3,850.00 · META $3,805.00 ·
TSLA $13,760.00 · NVDA $7,890.00 · PLTR $4,990.00**, all debits. A whole-tab text scan finds
**`3,802.00`: false** and **`7,889.00`: false** — they still occur in the repo only inside the e2e's
`not.toContain(...)` negative assertions. The count line still reads **`14 positions`**.

## R6. Findings from this pass (recorded, none changes a verdict)

- **R-1 — the delegation to the shared cascade is real but partial.** `plWithheldLiteralOf` supplies
  only `legs_unpriceable` and zeroes the rest, so the shared function's *ordering* is never exercised
  by that call and the transient default lives in the call site's `?? UNAVAILABLE`. One rule, not two
  — but a future reader should not read "derived through the shared cascade" as "the whole P/L
  decision is inside `withheldLiteralOf`".
- **R-2 — a residual, CF-only literal divergence that AC-13 itself mandates.** On
  `BOOK_CF_UNPARSEABLE` the group P/L renders `unavailable` (mirroring the net, as AC-13 requires)
  while each member row renders `not provided` (its own leg-level predicate: the legs are also
  `unpriceable`). That is the *reverse* of the divergence SPEC §2.6 blesses, and for the P/L axis the
  `unavailable` copy does promise a refresh that cannot help. **It is not a regression** — the
  net-withheld branch is byte-identical to the pre-fix code — **it is unreachable on the real feed**
  (where the net is always a figure), and **AC-13's letter demands exactly this**. Flagged as a
  spec-level tension between AC-13 ("withheld with it, for the same reason") and §2.6's
  permanence-first rationale, for a future pass to rule on, not as a build defect.
- **R-3 — Layer 1's relative-form gap is closed for `grouping.ts` only.** `BrokerGroupHeader.tsx` and
  `groupCopy.ts` still use the `**/features/trading/positions/*` glob, which does not match
  `../positions/*`; verified live. Layers 2 and 3 cover them. Worth one line in a hardening pass.
- **R-4 — the group's `not provided` still drops the leg row's `unpriceableTip`.** The header states
  the literal without the explanation the member row carries. No AC requires it; noted again because
  the fix made the two levels agree on the *word* while the *reason text* still lives only downstairs.
- **R-5 — `npm run ports:free` is IPv4-only.** It reported "all clear" while three IPv6-only orphan
  listeners were live, one of them serving on `:4300`. The CLAUDE.md trap ("orphaned dev servers serve
  STALE code into your pass") is therefore still reachable through the very tool written to prevent
  it. Tooling finding, unrelated to this feature.
- Findings **§3.1, §3.2, §3.4, §3.5, §3.7** from the first pass stand unchanged. **§3.3 is now
  resolved** (the 393 px overlap is 0.0 px).

## R7. Invariants, re-checked after the fix

| Invariant | Verdict | Evidence in this pass |
|---|---|---|
| **`[absent-is-not-none]`** (HARD) | **PASS** — *was BROKEN* | The vocabulary is still five literals and no sixth. On the real-feed shape the permanent literal no longer collapses into the transient one: header and members both read `not provided`, observed in the browser and pinned by four named tests. The type-level half is unchanged (`net_entry` is still a discriminated union). Residual R-2 is CF-only, AC-13-mandated and not a regression. |
| `[model-read-carries-its-assumptions]` | PASS | Provenance clause still derived from the single exported constant and ORed across members; `netted by Convexa` + composition tooltip re-observed. |
| `[additive-keeps-score-byte-identical]` | PASS | `apps/api` diff 0 lines / 0 files; `nx test api` 272 green; the import boundary keeps `grouping.ts` off every scoring path. |
| `[live-vs-static-isolation]` | PASS | The diff does not enter the `pl_dollar != null` branch where the `⏸`/stale treatments live; AC-18/AC-19 arms green on both variants; the net still renders undimmed as a figure while the P/L is withheld. |
| `[theme-token-discipline]` | PASS | Zero hex in the changed modules; the only style change is `whiteSpace` + `overflowWrap`. |
| `[no-real-order-path]` | PASS | Re-observed: the tab's entire button set is Refresh + 3 chevrons + per-leg `Build reassessment`; group headers carry exactly one button and no disabled ghost. |
| `[single-shared-sim-entry-dialog]` | PASS | Untouched. |
| `[loss-free-durable-migration]` | PASS (correctly non-binding) | No `convexa.*` key in the changed modules; expand state still ephemeral. |
| `positions.length` never a disambiguator | PASS | `renderState.ts` untouched by the fix. |

## R8. Acceptance-criteria tally after the re-run

**49 PASS / 0 FAIL / 1 UNVERIFIABLE (50 criteria).**

- **AC-11: FAIL → PASS** (the only verdict that moved).
- **AC-1b: UNVERIFIABLE**, unchanged and not guessed — it requires the owner's **live** Webull book
  and a one-time side-by-side with the Webull app. No live credential is available to QA and none may
  be used. It is counted here so it stays visible rather than hidden inside a PASS.
- The other 48 verdicts stand, each re-confirmed either by direct re-observation in this pass (the
  blast-radius rows in R3) or by the green re-run of the suite that carried them.

**Conformance: backend `PASS` · QA `PASS` (agree).**

## R9. Overall GATE Q verdict — RE-RUN

# **PASS**

**49 PASS · 0 FAIL · 1 UNVERIFIABLE (AC-1b, owner-only). Conformance backend `PASS` / QA `PASS`.**

The bounced criterion is fixed at the level that matters — not only is the suite green, the defect is
gone in a real browser on the real feed's shape, and the four new tests are the regression guard that
was missing. The fix derives the literal from the shared cascade rather than relocating a hardcode;
`legs_unpriceable` is confined to the P/L axis, verified by source, by behaviour and by two
counter-books; the leg-level cascade is provably inert; Layer 1's relative-form gap is closed for
`grouping.ts`; and the 393 px overlap is 0.0 px, A/B'd against the pre-fix geometry in the same page.
Every gate reproduces on its exit code, and both conformance verdicts agree.

**No amendments are bounced.** The five findings in R6 are recorded for a future pass, and none of
them is an unmet acceptance criterion or a broken invariant. Routing: **GATE S**.
