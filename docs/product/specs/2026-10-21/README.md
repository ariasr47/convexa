# Spec set 2026-10-21: roadmap

_Written 2026-10-22 from the seven specs in this folder, each revised after its skeptic pass. All
seven are proposals. Nothing in them has been built, and no acceptance criterion has been run
against a change: the baselines they quote are measured, the targets are not. The audit IDs
(SLT-, TD-, RA-, SPL-) refer to the four UX audits of 2026-10-22, whose scripts and screenshots
are under `tmp/ux-audit/` (scratch, gitignored)._

## Summary

The four UX audits of 2026-10-22 ran against staging, the public portfolio demo, and production,
the owner's live build. They found the same problems on both. The demo never says what Convexa is,
and it says "Sample" about thirty times per page instead. Clicks on the desk get lost. The sample
data has no spread, so Scanner filters return nothing. Research on the demo runs through a weaker
component than production's note design. And the shared primitives (overlay names, the touch
floor, contrast, page titles) fail axe on both builds. Specs 1 to 4 fix that. Specs 5 and 7 then
add two tools built only from data public pages may show: "Since you last looked" on the note page,
and a fear–greed gauge from OFR and CFTC data. Spec 6 starts the AI analyst with a cutoff-bound Q1
context package in the API, with no model. No spec changes an owner ruling. The production sign-in
walls stay, FINRA stays Off, no licensed data reaches a public page, nothing is sent to a model, and
no CI is proposed.

## The specs, in build order

| Order | Spec | Kind | Size | Depends on | The criterion that matters most |
|---|---|---|---|---|---|
| 1 | [Demo first screen](01-demo-first-screen.md) | ux-polish | M | Spec 4, only for criterion 12's `/research` and `/research/filings` ceilings, which stay pending until spec 4 part C lands. Step 2 waits on D2 and step 5 on D1 (step 8 on both). | **1.** On staging at 390×844 and 360×800, the demo bar is one line, at most 48px tall, reading "Demo · sample data · Oct 7, 2026" then Reset. Today it is 137px and 157px. |
| 2 | [Accessibility and touch floor](02-a11y-touch-floor.md) | ux-polish | L | None | **4.** At 390 with a coarse pointer, on every audited route, on both builds, in both schemes: zero interactive elements under 44px. TradingView's own frame is excluded. |
| 3 | [Desk, Scanner and Positions on the demo](03-trader-surfaces-demo.md) | ux-polish | XL, in four commits. Commit (c), the sample spread, is L and separable. | Specs 1 and 2 | **1.** On `/ticker/SPY` at 1440, all 40 fresh-page presses of Sim orders "Details" open its dialog. Today a single press opened it 1, 3 and 4 times out of 4 in three runs. Criterion 3 is the deterministic gate behind it. |
| 4 | [Research on the demo, and failure states](04-research-demo-and-states.md) | ux-polish | XL, in three parts: A (failure states) M, B (reader polish) M, C (demo note path) L | Specs 1 and 2. Part C also needs spec 3 commit (c), part A and step B3. C2's opt-in also needs spec 1 step 5, which waits on D1. | **1.** On staging, all six `/ticker/{T}/research` pages show the production note anatomy: a headline h1 with a figure, a metric strip of 4 or more cells, and a TL;DR. None shows a raw bar ID or a 4-decimal figure. |
| 5 | [What changed since you last looked](05-what-changed-since.md) | new-tool | M | Spec 4 step B2's `filingTitle.ts` for the production part, which Part A builds at B2's path if B2 hasn't landed, so Part A can start at any time. C2 (the sample notes on `NoteView`) for the staging part. | **12.** When any kind fails, the section shows its Not read row and "This visit isn’t counted", and leaves `next` unchanged. The failure cases are: SEC on a last good copy, holders down, insiders unread, FINRA on and down, and company facts failed. |
| 6 | [Stress gauge](07-stress-gauge.md) | new-tool | L, as two changes: the API, then the frontend | Spec 2 (build after it). Spec 1 step 5 (the opt-in, D1) for criterion 5's missing tag. No spec 4 dependency. Owner answer S7-Q4. | **1.** On production, the gauge integer, its band, the unrounded mean and each row's percentile equal an independent recomputation from the public files, cut off at the as-of dates the page shows. |
| 7 | [Analyst Phase 0a: Q1 context package](06-analyst-phase0a-q1-package.md) | analyst-slice | L | No code dependency. It needs the owner's go-ahead on Phase 0, or on 0a alone (DESIGN §8.1). | **1.** Two replays of the checked-in fixture print the same 64-character `package_id`, and `cmp` finds the two output files identical. |

The file numbers are not the build order: file 07 is built sixth and file 06 seventh.

## Build order, and why

The order is polish first, then the tools, then the analyst slice. The polish specs repair the
floors the tools stand on. The tools are visible on both builds. The analyst slice is visible on
neither.

1. **Spec 1, demo first screen.** It is the first screen of every route a reviewer opens from a
   CV link, so no other spec buys more for its size (M).
   - Steps 1 and 3 need no owner answer. Neither do step 5's leads, Fired note and rule lines.
     Step 4 needs one only for its GitHub href (S1-Q3).
   - It cuts the demo bar on a 390px phone from 137px to 45px, and lifts the landing hero onto the
     first screen. Spec 3's criterion 23 and spec 4's criterion 14 are measured after it lands.
2. **Spec 2, accessibility and touch floor.** Start it now, beside spec 1, in its own worktree.
   Land it second.
   - It has no dependency. It builds shared helpers that later work reuses rather than fixing
     again: `coarseFloor`, `standaloneLinkSx`, `useScrollRegion` and `useDocumentTitle`. Two
     other specs name one: spec 1's footer line takes `standaloneLinkSx` if spec 2 lands first
     (spec 1, Behaviour › Footer (staging)), and spec 4's Coming up rail spreads
     `useScrollRegion` (spec 4, Build plan › B3).
   - Its tap probe decides what the sweep covers, not grep. Running the sweep after spec 1's bar
     and hero changes means it measures the final shell, so nothing needs a second sweep.
   - Specs 1 and 2 both edit `ChartFrame.tsx`, `MarketsPage.tsx`, `FilingsPage.tsx`,
     `ResearchIndexPage.tsx`, `AlertsPage.tsx`, `NewAlertDialog.tsx` and `alertsUi.tsx` (fix 9's
     table). The second spec to land rebases on the first.
3. **Spec 3, trader surfaces.** It comes after specs 1 and 2 because it edits files they change:
   spec 1's `AppShell.tsx`, and spec 2's desk, Scanner and Positions files,
   `TradeEntryDialogView.tsx` and `OrderRow.tsx` among them (fix 9's table).
   - Keep its commit order: (a) clicks, (b) truth, (c) spread, (d) said once.
   - Commit (c) is on the critical path, because spec 4 part C waits for its seeds and levels. If
     the owner wants a smaller first change, (c) can become its own spec with criteria 15 to 23.
     It must still land before spec 4 part C.
4. **Spec 4, Research on the demo.** Its three parts land separately.
   - Part A can start as soon as spec 2 lands, alongside spec 3. It builds `LoadFailure`, the
     failure component, and `RetryButton`, a "Try again" button that is 44px at every pointer.
     It swaps that button in for the four Research "Try again" buttons, in
     `publicUi.tsx`, `NotesView.tsx`, `ComingUpSection.tsx` and `FilingsPage.tsx` (spec 4, Build
     plan › A1). Under a coarse pointer all four already reach 44px in the code: two carry their
     own coarse floor (`publicUi.tsx:213`, `FilingsPage.tsx:1008`), and the theme floor
     (`theme.ts:149-154`) reaches the two MUI Buttons. Spec 2 leaves them alone (spec 2, Why ›
     Input claims corrected while verifying). So the gain is at a fine pointer, where all four are
     under 44px.
   - Part B follows.
   - Part C goes last, after spec 3 commit (c), part A and step B3. C2's opt-in also needs spec 1
     step 5, which waits on D1. Inside C, C1 (the sample series) comes before C2 (the sample
     notes), because the back-dated notes cite Sep 30 closes from the new series.
5. **Spec 5, what changed since.** This is the first new tool.
   - It is front-end only and medium-sized. It adds no request and no API change.
   - It answers DESIGN's Q1, the owner's top question. On production it adds a working public
     feature where most desk panels say Not live.
   - Part A, the production part, can start at any time. It uses spec 4 step B2's `filingTitle.ts`,
     or builds it at B2's path first if B2 hasn't landed. Part B, the staging part, needs C2, and
     its heading tag waits on D1.
   - First, record its six questions in `tracker-data.mjs` (its step 0). Then settle S5-Q6, the TSM
     clusters, before Part A ships.
6. **Spec 7, stress gauge.** It comes second among the tools because it is larger (L).
   - It adds a source (OFR) and an API change that regenerates the contract.
   - It needs the owner's call on building ahead of analyst Phase 2 (S7-Q4).
   - Its API change (steps 1 to 4) touches `apps/api`, plus the regenerated `libs/api` schema and
     `convexa.ts` (spec 7, Build plan, step 4). It can start as soon as S7-Q4 is answered.
   - The frontend (steps 5 to 7) waits for spec 2. Criterion 5's missing tag also needs spec 1
     step 5, the ChartFrame opt-in, which waits on D1.
   - It needs nothing from spec 4: its withheld state draws its own quiet line (Cross-spec fix 3).
7. **Spec 6, analyst Phase 0a.** It is last by priority, not by dependency.
   - It has no route and no UI, so neither audience sees it. Its value is in the repo and in every
     later analyst phase.
   - It waits on DESIGN §8.1.
   - It touches only `apps/api`, appends to `DESIGN.md` and adds one `DECISION_LEDGER.md` row, so
     it does not collide with the polish specs or spec 5. It shares
     `apps/api/src/services/public_data/mod.rs` with spec 7's API change (fix 9's table). If a
     lane is free while the polish specs wait on owner answers, it can start as soon as the owner
     approves 0a.

**The critical path to the full staging story runs:**

1. specs 1 and 2;
2. spec 3 commit (c);
3. spec 4 part A and step B3;
4. C1, then C2;
5. spec 5 part B, on top of its part A, which can start at any time.

Owner decision D1 is on this path: C2's opt-in needs spec 1 step 5, which waits on D1.

**Rules every lane follows.** These come from `CLAUDE.md` and the specs themselves.

- Another workflow is editing `apps/`, `libs/` and `tools/`. Rebase on it before writing.
- Work in a worktree. Never `git stash` in the shared tree.
- Each spec's check scripts live in gitignored `tmp/ux-audit/`. Copy them into the lane's
  worktree, at the same paths.
- Run `npm run ports:free` before any run-the-app check, and use `localhost`.
- Judge every check by its exit code, not its printed summary.
- Run the typecheck and `npm run verify` on every commit. `verify` needs `gitleaks`.
- Regenerate boards with `node design/src/build.mjs`. Never hand-edit `design/canvas` or
  `design/site`.
- Canon changes are appended Amendments rows, written only after the owner answers.
- Production checks are read-only: no sign-in and no form.

## Cross-spec fixes to make before or during the build

Each spec was reviewed on its own. Read side by side, they disagree in these places. Each fix goes
into the spec, or into the lane, before the step it affects.

1. **The shared "say Sample once" row.** Two drafts exist: spec 1 Q1 and spec 3 Q2. It is owner
   decision D1 below. Until it is answered, everything in D1's Holds-up cell waits:
   - spec 1 steps 5 and 8, except step 5's leads, Fired note and rule lines;
   - the masthead and legend part of spec 3 commit (d), and the Sample tag on each of its six
     frames whose only mark is that tag: Sim orders, the AI read, Setups, the hero, Your book and
     the Scanner's scan frame;
   - spec 4 C2's demo note treatment, including its quiet note page through spec 1 step 5's opt-in;
   - spec 5 Part B's heading tag;
   - spec 7 criterion 5's missing tag, through the same opt-in;
   - the opening words of spec 7's staging page disclaimer, with S1-Q4.

   Spec 1 step 8 appends the row once; spec 3 commit (d) appends it only if that step has not
   landed.
2. **Spec 7's staging frame against spec 1's opt-in.**
   - Spec 7's criterion 5 expects the Stress frame to carry the "Demo · sample data" tag.
   - Spec 1 removes that forced tag from board-default frames on `/research/markets`. Spec 7 builds
     after spec 1, so the tag would no longer be there.
   - Recommended: the frame's source chip, "Demo · shaped like OFR and CFTC data", is its one
     mark.
   - Its seven per-row credit lines drop "Demo · " and read "Shaped like …". That also matches
     spec 1 Q4's eventual form.
   - **Applied** in spec 7's 2026-10-22 revision. Criterion 5 now expects no head tag, the source
     chip as the frame's one mark, and the "Shaped like …" credit lines. The missing tag needs
     spec 1 step 5's opt-in, which waits on D1. Both D1 drafts leave a frame with a source line
     only that line, so criterion 5 holds under either answer.
3. **Spec 7's withheld state against spec 4's `LoadFailure`.** Spec 7 asks for a "compact, no
   `what`" `LoadFailure` for Source down and Last good copy. Spec 4 defines neither:
   - `LoadFailure` takes only `couldntLoad` and `sourceDown`, and leaves `lastGood` out on
     purpose.
   - It has no compact form. Its in-frame body is drawn by `ChartFrame` for a message status,
     never for a ready one.

   Recommended: spec 7 uses its own quiet fallback for every withheld cause. Its criterion 2
   already accepts the fallback, and this removes spec 7's dependency on spec 4.

   **Applied** in the same revision. Spec 7 draws one quiet form for every withheld cause, with
   no `LoadFailure`, and depends on nothing in spec 4 (spec 7, Scope and non-goals, and
   Behaviour › Page, the Withheld row).
4. **Step names.** Spec 5 cites spec 4's "step 3" and "step 5". Spec 4's plan calls them B2
   (`filingTitle.ts`) and C2 (the sample notes on `NotesView`/`NoteView`, `NotePublicPanels` under
   them, and the `today` prop). **Applied:** spec 5 now cites B2 and C2 by name.
5. **Spec 2's criterion 14 count.** Spec 3 deletes one of the two `text.disabled` colour uses
   spec 2 keeps, the Widget grip. Spec 2's criterion 14 states both numbers: exactly 2 if spec 2
   lands before spec 3, exactly 1 after. Neither spec edits the other's count when it lands.
6. **The SIMULATED chip.** Specs 2 and 3 agree that the landing's chip (`AiReadSample.tsx`) is
   already the neutral outlined chip, so neither changes it (each spec's Scope and non-goals).
   Spec 3's `SimulatedChip` reuses spec 2's trade-dialog chip if spec 2 lands first.
7. **The sample bars.**
   - Spec 3 keeps spot and every option mark unchanged, and says spec 4 part C replaces the bars
     (spec 3, Behaviour › (c) The sample has spread).
   - Spec 4 part C replaces every bar before Oct 7, and keeps the Oct 7 close pinned.
   - Step C1 recomputes, once, the figures that both specs move: the flow seed, the IV-rank
     observations, AAPL's `iv_rank_band`, and the board lines that quote them.
8. **Page titles.** Spec 2 sets the staging note's title in `ResearchView`, which spec 4 C2
   deletes. After C2, the call in `NotesView` covers both builds. Re-run spec 2's criterion 22 on
   staging then.
9. **Files several specs edit.** Land these in build order, each rebasing on the one before. The
   table lists every file that two or more Build plans name, with each spec's step in brackets.
   The last two rows come from the specs' open questions and this roadmap's own rule, not from a
   Build plan.

   | File | Edited by specs (step) |
   |---|---|
   | `ChartFrame.tsx` | 1 (5), 2 (3, 5a), 4 (A1, C2), 7 (6) |
   | `WidgetProvenanceContext.tsx` | 1 (5), 4 (C2) |
   | `AppShell.tsx` | 1 (1, 2), 3 (d, only once D1's row is approved) |
   | `demo-journey.spec.ts` | 1 (2), 3 (a), 4 (C2) |
   | `MarketsPage.tsx` | 1 (5), 2 (3, 8), 4 (A1, C2), 7 (6) |
   | `FilingsPage.tsx` | 1 (5), 2 (8), 4 (A1, B1, B2, C2) |
   | `ResearchIndexPage.tsx` | 1 (5), 2 (8), 4 (B1, B3, C2) |
   | `ScorecardPage.tsx` | 2 (8), 4 (A1, B1, C2) |
   | `NoteView.tsx` | 2 (3), 4 (B1, C2), 5 (7) |
   | `NotesView.tsx` | 2 (8), 4 (A1, C2), 5 (7) |
   | `ResearchView.tsx` | 2 (8), 4 (C2 deletes it) |
   | `InsiderClusters.tsx` | 2 (3, 5a, 5b), 4 (A1), 5 (8) |
   | `NotePublicPanels.tsx` | 4 (A1), 5 (8) |
   | `FundHoldings.tsx` | 2 (3), 4 (A1), 5 (8) |
   | `FiledFigures.tsx` | 2 (3), 4 (A1, C2), 5 (1, 8) |
   | `Peers.tsx` | 2 (3), 4 (A1) |
   | `filingTitle.ts` (new) | 4 (B2), 5 (Part A, only if B2 has not landed) |
   | `blocks/Valuation.tsx` | 2 (6), 4 (B1) |
   | `LatencyTrend.tsx` | 2 (3), 4 (A1) |
   | `app.tsx` | 2 (8), 4 (C2) |
   | `AlertsPage.tsx` | 1 (5), 2 (3, 8) |
   | `alertsUi.tsx` | 1 (5), 2 (1, 3) |
   | `NewAlertDialog.tsx` | 1 (5), 2 (1, 3) |
   | `TradeEntryDialogView.tsx` | 2 (2, 3, 4), 3 (a, d) |
   | `OrderRow.tsx` | 2 (4), 3 (b) |
   | `OrdersPanel.tsx` | 2 (4), 3 (b, d) |
   | `TrackRecordSection.tsx` | 2 (4), 3 (c, d) |
   | `TickerDashboard.tsx` | 2 (4), 3 (a, d) |
   | `TickerHeader.tsx` | 2 (3), 3 (d, only once D1's row is approved) |
   | `PositionRow.tsx`, `ScanToolbar.tsx` | 2 (3), 3 (d) |
   | `AiRecPanel.tsx` | 2 (3, a `Select` site), 3 (a, d) |
   | `libs/api/src/lib/demo/public-data.ts` | 1 (6), 4 (B2, C2), 7 (5) |
   | demo `transport.ts`, `catalog/shared.ts`, `transport.spec.ts` | 3 (c), 4 (C1, C2) |
   | demo `workspace.ts`, `flowSeed.spec.ts` | 3 (c), 4 (C1) |
   | `catalog/catalog.spec.ts` | 3 (c), 4 (C2) |
   | `apps/api/src/services/public_data/mod.rs` | 6 (`SEC_SPACING` and one test literal), 7 (1, 2, 4) |
   | `pages/trust/sources.ts` | 5 (9), 7 (7) |
   | `CreditsPage.tsx` | 2 (3), 7 (7) |
   | `design/src/screens/final/research.mjs` | 1 (7), 4 (B1, B3, C2) |
   | `design/src/screens/final/account-pages.mjs` | 1 (7), 3 (c, d), 4 (C1) |
   | `design/src/screens/final/ticker-desk.mjs` | 3 (c, d), 4 (C1) |
   | `DESIGN_SYSTEM.md`, appended rows only | 1 (8), 2 (1), 3 (d, only if spec 1 step 8 has not landed), 4 (B3) |
   | `design/src/screens/final/tracker-data.mjs` | 5 (0), and every spec's questions (Owner decisions, below) |
   | `docs/product/ai-analyst/DESIGN.md`, appended only | 6 (8), and 7 if S7-Q4 is yes (its open question 4) |

   Examples of where two specs touch the same lines (not the complete set: each spec's Build plan names its files and lines, and the table above names every shared file):
   - `ChartFrame.tsx`: specs 1 and 4 both change the tag logic at `:91-94`. Specs 2 and 7 both add
     a cell kind to `TableTwinData` (spec 2's link cell, spec 7's text cell).
   - `AppShell.tsx:148`: spec 1's bar layout (`:148-194`) and spec 3's bar context.
   - `TradeEntryDialogView.tsx:541-551`: the SIMULATED chip, in spec 2 step 4 and spec 3 (d).
   - `public-data.ts:262-286`: spec 1's Markets chip strings and spec 7's Markets sample.

   Two things reach past the Build plans. Spec 2's contrast sweep (step 4) works from
   `tmp/ux-audit/spec-a11y-touch-floor/text-disabled-sites.txt`, which also names spec 3's
   `OrderDetailDialog.tsx`, `PositionBrief.tsx`, `PositionsView.tsx` and
   `CustomizationToolbar.tsx`. Its touch sweep (step 3) ends with the tap probe, which may reach
   any file. And every spec that runs `node design/src/build.mjs` changes the generated
   `design/canvas` and `design/site`: after a rebase, regenerate them; never merge them by hand.

## Owner decisions

There are 32 questions across the seven specs, and some overlap. Each row below gives the spec's
recommended answer and what the question holds up. Five answers unblock the most:

- **D1 and D2** unblock spec 1 steps 2, 5 and 8, and the shared row that specs 3, 4, 5 and 7 follow.
- **S2-Q1** unblocks spec 2's theme step.
- **S7-Q4** unblocks all of spec 7.
- **S6-Q1** unblocks all of spec 6.

The rest are needed only when their step starts. Before each spec's first step, record its questions
in `design/src/screens/final/tracker-data.mjs` `OPEN_QUESTIONS`, as spec 5's step 0 does, so the
answers live on disk.

### Questions more than one spec depends on

| # | Question | Recommended | Holds up |
|---|---|---|---|
| D1 | **The shared Amendments row: what a staging frame still says.** Spec 1 Q1 and spec 3 Q2 ask this together. Spec 4 asks the row to name the note's "Sample note" kind pill, and spec 5 follows the row. Both drafts agree on most of it. The demo bar is the page's one "Demo · sample data". Page-level slots yield to the bar: the masthead demo tag, header chips that only state the demo, and the "On this page" legends. Rows and cards carry no Sample tag. A frame whose source chip begins "Sample" or "Demo" needs no other word under either draft, wherever the chip sits: `ChartFrame` draws it in the foot, and Fired's "Sample · shaped like CFTC TFF" sits in its row (spec 1, Behaviour › Research and Alerts on staging: say Sample once). A further source chip is not a second mark. So the Markets frames, spec 7's Stress frame and Fired read the same either way. They differ on one point: a frame with no source line keeps its dashed border and hatch. Spec 1 would add nothing more. Spec 3's text says a frame "names the sample exactly once: in its head (a title beginning Sample or its Sample tag), or by a source chip anywhere in the frame (head, foot or a row) that begins Sample or Demo", so such a frame carries one word in its head. Those frames are spec 1's Coming up (once, at its section head, for all its tiles), sample cards, Rates today strip, Filed feed, Detail and Your alerts, and spec 3's six: Sim orders, the AI read, Setups, the hero and Your book on the desk, and the Scanner's scan frame, whose source sentence begins "Shaped like", not "Sample" or "Demo". | Spec 1 recommends border-only. Spec 3 recommends one word in the head of a frame with no source line. **This roadmap recommends spec 3's text, plus spec 4's kind-pill clause.** The border and hatch never reach the accessibility tree, so under border-only a screen-reader user who jumps to one of those frames hears no "sample" there. That would undercut spec 2. The cost: up to 4 more sample words on `/research` at 1440, the Coming up head and three sample cards. Spec 1 then recounts criterion 12's ceilings, and criterion 13 becomes "exactly one mark on each frame with no source line". | Spec 1 steps 5 and 8 (except the leads, Fired note and rule lines). The masthead and legend part of spec 3 commit (d), and the Sample tag on each of its six frames whose only mark is that tag (Sim orders, the AI read, Setups, the hero, Your book and the Scanner's scan frame). The demo note treatment in spec 4 C2, including its opt-in through spec 1 step 5. Spec 5's staging heading tag; its lines carry no tag under either draft. Spec 7 criterion 5's missing tag, through spec 1 step 5's opt-in. The opening words of spec 7's staging page disclaimer, with S1-Q4 (spec 7, Copy › Page disclaimer). |
| D2 | **The bar's as-of wording:** "As of Oct 7, 2026" from 600px up (spec 1 Q2). Spec 3's desk and Scanner strings follow it. | Yes, in the same row as D1. The brief's "Sample scenario · Oct 7, 2026" uses up the page's whole word budget on chrome. | Spec 1 step 2, and two strings in spec 3 commit (d) |
| D3 | **13F managers with zero shares in the prior quarter** (spec 5 Q1). Spec 6's deviation (c) follows the answer. | Not "buying". A change counts only for managers held in both quarters. A zero-prior manager is named as "shows no position in the prior quarter’s 13F read". Separately, check the API's prior-quarter read for Norges Bank: it may be a missed CUSIP. | Spec 5 follow-up F1. Spec 6's holders change facts. |

### Spec 1, demo first screen

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S1-Q3 | Should the "Built by" footer's GitHub link go to the profile or to the repository? | Show the name as written, and link the repository, `https://github.com/ariasr47/convexa`. A reviewer is looking for the code. | The footer `href` (step 4) |
| S1-Q4 | Demo source labels come in three forms: "Shaped like …", "Demo · shaped like …" and "Sample · shaped like …". Should they become one? | Yes. After specs 1, 3, 4, 5 and 7 land, one follow-up moves every label to "Shaped like …". Until then three pages mix two forms: the desk today, Markets after spec 7 and the note page after spec 5. | The opening words of spec 7's staging page disclaimer, with D1 (spec 7, Copy › Page disclaimer) |

### Spec 2, accessibility and touch floor

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S2-Q1 | Should every ToggleButton's selected state follow P-6 across the theme, with Call and Put losing their green and red? | No. Only the labels change: ink on the fills, and white on light Put. The approved desk and the 2026-10-13 fill decision stay. | The theme branch in step 1, and the `LegFields` branch in step 4 |
| S2-Q2 | Should the insider twin show both tables, the windows and then every trade? | Yes. The trades table is built only when opened. | Step 5a |
| S2-Q3 | Should the insider plot itself be a tab stop? | No. Its keyboard path is the source chip and "Show the numbers". | Step 5a |

### Spec 3, desk, Scanner and Positions

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S3-Q1 | SPY's IV/HV is 1.10, which the engine calls IV rich, but the demo labels SPY Neutral. Which label? | Label SPY IV rich, and change no SPY figure. | The seeds in commit (c). The "IV rich" chip then returns 2 rows instead of 1. |
| S3-Q3 | Should the new sample positions merge into returning visitors' books? | No. The new seeds reach first visits and Reset demo data only. A merge would change a visitor's capital at risk and P/L underneath them. | Commit (c) |

### Spec 4, Research on the demo

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S4-Q1 | Should AAPL join the sample filers? | Yes, with its own dates: a results 8-K on Jul 30 and a 10-Q on Jul 31, for the quarter ended Jun 27. That adds 2 staging Filings rows, gives AAPL's note a valuation, and moves no existing row. | C2: AAPL's two filer rows and their descriptions, its note's valuation bar, and its NEXT second line |
| S4-Q2 | Should the Oct 6 close move with the new series? | Let it move. The masthead day change and the Scanner's Chg % change, and `scanChange.spec.ts` is updated. | C1 |
| S4-Q3 | Should Coming up become a sideways rail below 768px? That needs one rule-17 Amendments row. | Yes, the rail. It puts the first note card above 844px. | B3 |
| S4-Q4 | The staging Markets drift chart loses its flagged NVDA note. Accept that? | Accept. The flagged state stays drawn on the states board. | C2 |
| S4-Q5 | Three open sample calls are dated Oct 2, 5 and 6. How should the notes handle them? | Date the SPY, QQQ and TSLA notes Sep 30. Three notes then read Current and three Review due. | C2 |
| S4-Q6 | Should production's author tools sit behind a disclosure, and should it remember being open? | Yes. It is closed in a browser that has never opened it, and remembered per browser in `localStorage`, with try/catch. | B1 |

### Spec 5, what changed since

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S5-Q2 | Should the section show on production tickers with no note? | Not in slice 1. There would be no panels to link to. | Nothing |
| S5-Q3 | The staging short-interest seed gives ▼ 2.3% in the window. Keep it, or re-author it? | Keep it. The line is true to the seed's chart. | Nothing |
| S5-Q4 | Should the stamp sync to the owner's account now? | No. It stays browser-only until the analyst stores "since I last looked" per owner. | Nothing |
| S5-Q5 | Should the whole latest-note page use the ET day on production? | Yes. The cost: after 9 PM Pacific, the note calls tomorrow "today". | Part A step 7 |
| S5-Q6 | TSM's monthly plan-like purchases read as buying clusters. What should happen? | Before Part A ships, open one of those Form 4s. If they are plan purchases, fix the cluster rule in `insider_trades.rs` as its own change. | Part A shipping |

### Spec 7, stress gauge (built sixth)

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S7-Q4 | DESIGN §7 lists the Stress Gauge and the OFR source under analyst Phase 2. Build them ahead of it? | Yes, on the precedent of the Treasury curve and the calendar, which already ship publicly. `get_stress_gauge` and the Q5 eval stay in Phase 2, and no model reads the gauge. Append one line under DESIGN §7 recording the order. | The whole spec. Without a yes, it waits for Phase 2. |
| S7-Q1 | Should VIX futures also get a fourth Positioning card? | Not in this change. | Nothing |
| S7-Q2 | Which word applies when the OFR answers but its newest day is too old? | Keep the closed set: "Delayed by source", with the reason line. | Nothing |
| S7-Q3 | The sample CFTC report is dated Oct 6, so it would be published after the Oct 7 scenario. Change it? | Keep Oct 6 for now. A later fix moves it to Sep 29 across Positioning, the sample alerts and Stress, in one change. | Nothing |

### Spec 6, analyst Phase 0a (built seventh)

| # | Question | Recommended | Holds up |
|---|---|---|---|
| S6-Q1 | Approve all of Phase 0, or this slice alone (DESIGN §8.1)? | Approve 0a alone now. It adds no model call, key, table, route or licensed data. Slices 0b to 0f stay gated. | The whole spec |
| S6-Q5 | Which live SEC requests may the slice make, and who makes them? | Yes to step 0's three header GETs with the production `SEC_USER_AGENT`, committed as sliced fixtures. The owner makes the live run of about 80 requests (criterion 14). No lane runs the CLI live. | Step 0 and criterion 14 |
| S6-Q2 | How should `omitted` say "not built yet" for the research note? | Add `not_built`, not `off`. | Step 8's DESIGN amendment |
| S6-Q3 | What goes in `persona`? | `null` until slice 0c. | Step 8 |
| S6-Q4 | Accept three deviations from DESIGN's point-in-time table? They are: no 13F-HR/A or Form 4/A, the change in basis points, and zero-prior handling per D3. | Accept all three for 0a. | Step 8 |
| S6-Q6 | May each section carry a `coverage` record? | Yes, so a gap is part of the package and not only a stderr line. | Step 8 |

## Deferred, and why

These were weighed for this set and held back.

| Item | Why it waits |
|---|---|
| **SLT-09** (medium): the eight info and trust pages use five H1 sizes and six left edges. Methodology and Credits sit on different grids. | It is a frame refactor of four production trust pages: Methodology rebuilt on `DocPage`, plus a shared header for Settings and the blog index. No visitor trips over it. It is better done after the blog-naming fix settles the blog header (spec 1 splits that fix out) and after spec 2 settles `linkSx` (`standaloneLinkSx`, `proseLinkSx`). It leads the next polish batch. |
| **SLT-14 and SPL-14** (low): "Log in" vs "Sign in", the full-width Google button that is always disabled, and the auth dialog's hardcoded backdrop instead of the scrim token | They affect only production account entry. Sign-ups are closed and staging signs every visitor in, so neither audience of the demo sees them. Bundle them with analyst Phase 0b (the owner role and gate), which touches the same auth surfaces. |
| **TD-12** (medium): the Overview / Technical / Research tabs come from three implementations and move between pages | It is a cross-page masthead refactor next to the approved desk masthead. Spec 4 moves the demo research route onto `NoteView`, which hosts one of the three copies. Unifying them after specs 3 and 4 land avoids doing the work twice. |
| **SPL-11** (low): the sticky Symbol cell keeps the panel colour when its row is hovered or open | It is a one-line cosmetic fix, desktop only, and costs the demo nothing. It can ride the next Scanner change. |
| **SPL-12** (low): the per-row AS-OF column repeats the header, and the preview repeats visible cells | It changes how the Scanner's honesty contract shows the per-row as-of: shortened to a time, with only differing rows marked. That needs its own look at the contract, not a polish ride-along. |
| **SPL-15** (low): `/_ops/metrics` shows a generic "Metrics readout unavailable" on a 404, and the `/_ops/*` pages lack `<main>` | These are operator-only pages that nothing in the UI links to. No visitor or reviewer reaches them. |
| **Idea: book-event-exposure** (S), through-expiry events on the simulated book | It is the next new tool in line. It is better after spec 3 seeds four demo positions across four tickers, two of them open (SPL-09), which gives it something to show. Its value, descriptive context for Q11, is narrower than what-changed-since or the stress gauge. Its source files, `PortfolioPanel.tsx` and `PositionRow.tsx`, are being edited by the concurrent workflow. |
| **Idea: kill-criteria-tripwires** (M) | It touches the notes toolchain in `tools/research-notes`, which the concurrent workflow is editing, as well as the build plugin and the UI. Each tripwire clause is a metadata edit to the owner's own notes, so the owner should choose them. Only some criteria can be checked against XBRL. |
| **Idea: baseline-paper-record** (M) | It needs spec 6 for `package_id`, and an answer to the open owner decision on the scorer's price key (DESIGN §8.2). Production outcomes computed from Massive closes are a Derived Work, which needs the owner gate (0b). Its value grows with calendar time, so it should be the first item scheduled once §8.2 and 0b are settled. |
| **Idea: filing-text-excerpts** (M) | It is analyst Phase 5 territory, with real parser risk on messy 8-K HTML. By the owner's 2026-10-15 answer, `SEC_USER_AGENT` is local-only, which limits its reach on production. |
| **Idea: q1-answer-page-design** (M) | DESIGN §7 ties the staging samples to each phase as it ships, and Phase 1 approval (§8.1) is still open. The artboard is the right next design step once the owner approves Phase 1. |
| **Idea: persona-in-full-and-user-cap** (M) | These are analyst Phase 0 slices 0c and 0d. The AI read is Not live on production, and the staging reads are authored, so the payoff is latent. It touches both lanes and the persona store. Schedule it after 0a and 0b. |
| **Idea: followed-names-ownership-board** (M) | Most of it is already reachable, per ticker and through the insider-cluster alert. Doing it well needs a server-side summary across tickers, to avoid 14 cold SEC reads under the 10 s `SEC_PART_BUDGET` (`apps/api/src/services/public_data/mod.rs:56`). That lowers its value per unit of size. |
| **Idea: public-data-mcp** (M) | DESIGN marks it optional and last (Phase 6). It adds nothing to the staging demo, and its tool shapes should follow Phase 0a and Phase 1. |
| **Analyst Phase 0 slices 0b–0f**: the owner role, gate and tables; the persona in full; the per-user cap; the notes read API; the price key | They are sequenced behind 0a (spec 6). 0b needs the owner's Phase 0 approval (§8.1), and 0f needs the price-source decision (§8.2). |

**Also parked inside the specs, unscheduled:**

- **Spec 1's small fix spec, not yet written.** It covers two things:
  - production note Sources host names cut off: 86 of 472 hosts at 1440 (`Record.tsx:679-700`);
  - naming the blog plainly.
- **Spec 1 Q4's follow-up:** one "Shaped like …" form for every demo source label.
- **Spec 3's call and put wall labels**, which round to whole dollars while the ladder shows
  cents. That needs its own decision.
- **Two of spec 4's follow-ups:**
  - restaggering the three sample filers' shared dates;
  - the uniform sample peers.
- **Spec 5's slice 2,** the digest across tickers on `/research`, and its follow-up F1, if D3 is
  answered as recommended.
- **Three of spec 7's later items:**
  - a "Stress band changed" alert kind;
  - a VIX card in Positioning (S7-Q1);
  - moving the sample CFTC report to Sep 29 (S7-Q3).
