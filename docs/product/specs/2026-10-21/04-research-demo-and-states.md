# Research on the demo: the real note design, reader-facing copy, honest failure states

_Proposal, 2026-10-21; revised 2026-10-22 after the skeptic pass. Kind: ux-polish. Size: XL as one change, so it ships as three parts that each land on their own (Build plan): **A** failure states (M), **B** production reader and author polish (M), **C** the demo note path, sample series and sample notes (L). Depends on: demo-first-screen (spec 01), a11y-touch-floor (spec 02). Part C also depends on trader-surfaces-demo (spec 03) step (c), and step C2’s opt-in on spec 01 step 5, which waits on owner decision D1._

Code citations are to `main@8ef735c4`. The audits read `791ebd88`; the two commits since then (`2cb4c8ef`, which takes provenance from the shell, and `8ef735c4`) move some lines, and this spec gives the current ones. Numbers marked _probe_ were measured on 2026-10-22 with the scripts in `tmp/ux-audit/spec-research-demo-and-states/` (scratch, gitignored, results in `probe.json`). The other numbers come from the earlier audit in `tmp/ux-audit/research-alerts/`. Production was read with GET requests only. Nothing was signed in or submitted.

## Why

Research is production’s strongest surface: fourteen real notes on public SEC data that work without a paid feed. The demo is the portfolio, and it shows the weakest version of those same pages. Five problems follow, each measured.

**1. The demo never shows the real note design (RA-01, TD-07).**

- On the demo, `/ticker/:symbol/research` goes to a different component. `ResearchRoute` renders `ResearchView` inside `PageColumn` when `dataMode` is `demo`, and `NotesView` → `NoteView` otherwise (`apps/dashboard/src/app/app.tsx:214-223`).
- Staging MSFT at 1440×900 (_probe_):
  - The h1 is “MSFT steady-trend case”.
  - The visible text holds 4 raw bar IDs of the form `portfolio-2026-10-07-v1:MSFT:2026-10-07`, the figure “EMA20 525.0387 USD”, and the line “60 source IDs · all 60 authored bars”.
  - There is no metric row, no valuation bar and no TL;DR.
- NVDA and SPY show 2 raw IDs each (_probe_). Production MSFT opens “Microsoft now spends 44% of its revenue on capex. What that capital earns decides the price.” and carries a TL;DR.
- Where the defects come from:
  - `pages/ticker/research/ResearchView.tsx:96-105` builds the “Source:” lines from raw IDs, and `:119-123` writes the “60 source IDs” line.
  - `:317` is the eyebrow “Sample research note · authored for this scenario”.
  - The copy is filler about authored bars, and the titles are labels (“NVDA higher-variation case”, `libs/api/src/lib/demo/catalog/shared.ts:108`). The narratives are at `shared.ts:47-136`, and `:262` prints the EMA with `toFixed(4)`.
- The side panel says “The production site shows the owner’s real notes, with their sources, freshness and the public panels.” It is plain text with no link (`DemoNoteSide.tsx:118-122`; the sentence is :120-121).
- Screenshots: `tmp/ux-audit/research-alerts/shots/staging_note-msft_desk_dark_fold.png`, `…/production_note-nvda_desk_dark_fold.png`, `tmp/ux-audit/ticker-desk/steps/staging__ticker_NVDA_research_desktop_dark_0.png`, `tmp/ux-audit/spec-research-demo-and-states/shots/staging_note_MSFT_1440.png`.
- An unknown symbol on staging (`/ticker/AMD/research`) gets a warning Alert, “No sample research note for this symbol.”, with a “Retry demo” button. That is a failure style and a retry for a state that is not a failure (`ResearchView.tsx:412-417`, `:463-478`).

**2. The sample price series reads as fabricated (RA-11).**

- The close path is a sine: `close = base + i·step + sin((i+phase)/4)·base·0.004` (`shared.ts:219`). Across each symbol’s 59 daily moves, the median absolute move is 0.048–0.066% and the largest is 0.176% (_probe_, `closes.mjs`).
- Each `/research` card plots its last 10 moves. On every card the 10 values fall in one run, for example AAPL from +0.13% down to −0.05% and TSLA from +0.10% down to −0.01%. The per-card medians are 0.03–0.09% (_probe_, `probe-bars.mjs`, which reads each chart’s accessible name).
  - **Correction to the input:** the six cards’ up/down patterns already differ from each other (6 distinct of 6), so “no two identical” is true today. The real defect is that every card is a monotone staircase. Acceptance criterion 6 tests for that instead.
- Every candle is an up candle, because `open = close − spread × 0.28` (`shared.ts:224`).
- The code says it outright: “Sample sessions move by hundredths of a percent” (`ResearchIndexPage.tsx:149`).
- On staging, 5 of 6 cards read “NEXT · IN 21 DAYS FOMC decision, Oct 28”; only TSLA differs. Production has the same problem on 5 of 14 cards: CRWV, MU, AMD, TSLA and TSM (_probe_, `probe-next.mjs`). Both cards take the soonest event (`ResearchIndexPage.tsx:190`, `:443`), and the FOMC is the soonest event for most notes.

**3. Two calendars on one demo (RA-05).**

- Staging Filings says “The demo’s sample notes carry no dated results, so nothing is expected in this scenario.” (_probe_). The cause: Expected is hard-coded empty in demo mode (`FilingsPage.tsx:93-105`, with the copy at `:127-131`).
- The same build’s `/research` Coming up lists “TSLA · Q3 results · Oct 22” and “MSFT · Q1 FY27 results · Oct 29”. It reads `SAMPLE_AGING`, built from `DEMO_NOTE_RESULTS` and `DEMO_CALENDAR` (`ResearchIndexPage.tsx:112-121`, `:751`).
- Owner answer 7 of 2026-10-15 already rules that staging shows the sample notes’ review triggers (`DESIGN_SYSTEM.md:285`).

**4. Filing titles carry the least information (RA-15).**

- Each row’s bold title is `filing.description || filing.form` (`FilingsPage.tsx:556`). The detail headline is the same value (`:637`).
- On production, 113 of 114 rows have the form code as the bold title, beside a column that already shows it (“8-K” 21 times, “SCHEDULE 13G” 12, “6-K” 10). The one exception is “AMZN 8A CERT - SEPT. NOTES”. The detail h2 reads “8-K” (_probe_, `probe-forms.mjs`).
- All 9 staging rows read “Demo sample filing” (`libs/api/src/lib/demo/public-data.ts:395`).

**5. Author tools shown to readers, and failure states that break the warning pattern (RA-04, RA-06, RA-10, RA-14).**

- **Scorecard.** Both builds show “Add yes, no or void as the fifth cell of each row, set updated: in the front matter, and log it in the change log.” This hint is not demo-gated (`ScorecardPage.tsx:155`), although its sibling at `:174-177` is. There are 7 “Copy row” buttons on staging and 20 on production (_probe_).
- **Filings.**
  - Production spends the page’s one amber fill, background rgb(242,169,59) (_probe_), on “Copy the draft command”. It copies the CLI command `npm run research:new TSLA` (`FilingsPage.tsx:598`, `:658-680`). It shows only when a results or quarterly filing is new since the note (`:658`).
  - The paragraph at `:702-706` tells readers to “Run … in the repo”.
  - The Final Filings board draws the detail’s one amber action on “Open the filing” (`design/src/screens/final/research.mjs:205`, `class="btn primary"`) and does not draw the draft command at all. Ruling A keeps amber on each screen’s single primary action “where the Final boards draw it” (`DESIGN_SYSTEM.md:284`). The build has the two swapped: amber on the command, and “Open the filing” outlined (`FilingsPage.tsx:681-700`).
- **Placeholders.** Production cards and note headers show a dashed “Stance · your call” pill (`ResearchIndexPage.tsx:483`, `NoteView.tsx:248`). Dashed is canon P-3’s mark for sample data (`DESIGN_SYSTEM.md:275`), but `ui.tsx:95` reuses it for “a slot that is the owner’s to fill”. Other author-facing items:
  - the dashed “Your stance, target, position” card (`NoteView.tsx:605-635`)
  - the “Your view · your call” cells (`blocks/Judgment.tsx:104-112`)
  - “Write odds: 5/11/4 …” (`blocks/Valuation.tsx:920`)
- **Filters that do nothing.** On production, “All · 14” and “Stance not set · 14” select the same 14 notes (_probe_). The `'unset'` chip is always added (`ResearchIndexPage.tsx:753-768`, chip at `:762-766`). Staging has the same no-op in its Freshness group: “All · 6” and “Current · 6” (`:848-872`).
- **Tab badges.** The Scorecard tab badge reads “77 open”, and the link’s accessible name is “Scorecard77 open”. The Notes tab has the same run-together name, “Notes14” (_probe_, `scorecardTabName`; `ResearchTabs.tsx:30`, `:37`, badge at `:78-93`).
- **Phone index.** At 390×844, the first note card’s top edge is at y=1371 on staging and y=1426 on production (_probe_; the audit’s 1477 and 1531 were measured to the card’s h2).
  - The filter bar ends at y=608 and y=555.
  - Coming up then fills y=640–1339 and y=587–1394. That is 5 or 6 cards of 99px each, plus a 153px intro paragraph.
  - So the filters sit about 760px above the notes they filter. The causes are the one-column grid `repeat(auto-fill, minmax(190px, 1fr))` (`ResearchIndexPage.tsx:580`) and the list rendered between the filters and the cards (`:948`, `:985`).
  - Screenshot: `tmp/ux-audit/research-alerts/shots/production_research_phone_dark_fold.png`.
- **Failure states.**
  - `SourceProblem` has a neutral border and no icon (`publicUi.tsx:163-221`). Its Try again is 36px at fine pointers (`:202`; 44px only under `pointer: coarse`, `:213`).
  - `ChartFrame`’s failure message is marked only by a 2px warning-coloured left edge (`shared/charts/frame/ChartFrame.tsx:260`). That edge encodes state in hue alone, which is the cause behind the banned accent-bar pattern (`DESIGN_SYSTEM.md:229`). It also breaks rule 5, `warning.*` plus an icon, always (`:160`).
  - Frame retry buttons are under 44px too: Coming up’s is an MUI `size="small"` outlined Button (`ComingUpSection.tsx:150-158`), and the Filings figures frame’s is `minHeight: 36` (`FilingsPage.tsx:991-1000`).
  - The design kit draws the same edge (`design/src/chart-kit.mjs:138`). The canon wins over the board (`DESIGN_SYSTEM.md:9`).
  - Screenshots with `/api/**` answering 503: `tmp/ux-audit/research-alerts/shots-states/production_markets_fail.png`, `…/production_note-msft_fail.png`.
- **A failed note loses its h1.** In `states.json`, `fail.note-msft.h1` is null, and the only text is “MSFT research couldn’t load (HTTP 503).” (`NotesView.tsx:220-231`, with the detail from `notesData.ts:25`).
  - **The realistic note failure is worse.** A note’s text is a hashed static asset, `assets/research-<T>-<hash>.json`, not `/api` (`tools/research-notes/vite-plugin.mjs:68-73`). Cloudflare Pages answers a missing asset with the app’s HTML and status 200. This was checked with curl on both builds on 2026-10-22.
  - So a tab left open across a deploy shows “NVDA research couldn’t load (`Unexpected token '<', "<!doctype "... is not valid JSON`).” Its Try again re-fetches the same dead URL forever (_probe_, `probe-stale-asset.mjs`, `shots/production_note-nvda_stale-asset.png`).

## Who and when

- **A reviewer on staging** (a recruiter or hiring manager) has two minutes. They open `/research`, then one note, on a laptop or a phone. They need to see the same note design the owner publishes, on sample data that looks like a sample rather than a fake. Then they need a one-click way to the real thing.
- **The owner on production** reads and maintains fourteen notes. When a results filing lands, they run `npm run research:new <T>`. They want the author tools one click away, but not in an anonymous reader’s face (Q6). When something fails, they want to know whether it was the network, the server or a stale tab.

## Scope and non-goals

**In scope**

- **(a)** The demo note page renders through `NotesView` and `NoteView`, on six sample notes written in the published format.
- **(b)** A deterministic, realistic sample series, and a NEXT line that leads with each note’s own trigger.
- **(c)** One calendar on the demo. Filing titles from item meaning on both builds. Realistic staging filing descriptions.
- **(d)** Reader-facing copy. “Open the filing” as the Filings detail’s one primary, as the board draws it. Author tools in a “For the author” disclosure on production (Q6). The stance and freshness filter rule. The tab badges and their accessible names.
- **(e)** The phone index order, and one failure component shared by `ChartFrame` and `SourceProblem`, used on Markets, Filings and the note.

**Non-goals**

- **No owner role or owner gate.** None exists: grepping `is_owner|OwnerGate|isOwner|owner_only` across `apps/api/src`, `apps/dashboard/src/app` and `libs/api/src` returns nothing. The role is to-build in Phase 0 of `docs/product/ai-analyst/DESIGN.md:507`.
  - **Correction to the input:** the input says “Phase 0b”, but DESIGN.md names it “0 · Groundwork”. The disclosure gives way to owner-session gating when Phase 0 ships.
- **No production note changes.** No edit to the content of any note in `research/<TICKER>/`, and no new data source.
- **No level, score or position changes here.** Spec 03 owns them (see Coordination). This spec pins the Oct 7 close, so nothing computed from spot alone moves.
- **The three existing sample filers keep their shared dates** (Aug 27 and Sep 24). Their periodic reports, figures and annual revenue all sit on one fiscal calendar (`public-data.ts:432-449`, `:505-512`), so restaggering them would ripple through all of them. This is filed as a follow-up. AAPL, if it joins (Q1), takes its own dates, so no existing row moves.
- **The uniform sample peers stay as they are**, with every company at 71.0% gross margin and 44.0% growth (`public-data.ts:657`). The sample notes must not cite them. Also a follow-up.
- **The 264 scored sample-history calls keep their text** (`research-ledger.ts:139-178`). They are only aggregated.
- **Elsewhere:** nothing on Markets beyond its failure states, nothing on the Technical tab’s layout (its bars change, b), nothing about FINRA, and no CI (CI mode is off).

**Coordination with specs 01, 03 and 05**

- **Spec 03 owns the seeds and the levels.** The `catalog/*.seed.json` files, `scenario-loader.ts` and the level arithmetic in `catalog/shared.ts:232-246` (walls, flip, max pain and the expiry variants) belong to spec 03’s step (c) (spec 03, (c) The sample has spread › Seeds, How the seeds are read and Max pain; spec 03, Build plan, commit 3). So do `atm_iv`, the IV/HV ratio and the regime. This spec owns only the bar loop inside `makeScenario` (`shared.ts:210-230`: dates, closes and candles) and the six sample notes. Spec 03 (c) lands first, and part C rebases on it.
- **Which invariant wins on the bars.** Spec 03 keeps `base`, `step` and `phase` byte-identical, so “Spot and every option mark are therefore unchanged” (spec 03, (c) The sample has spread › How the seeds are read). This spec also keeps those three fields byte-identical and pins the Oct 7 close. It does replace every bar before Oct 7, and Oct 7’s open, high and low. **On the bars, this spec’s series wins.** Everything spec 03 relies on survives, because each item reads only the Oct 7 close:
  - spot;
  - every option mark (`sampleContractMark` takes spot alone, `shared.ts:162-172`);
  - the replay’s underlying mid (`workspace.ts:121-123`), and with it the D-04 limit-order guard (spec 03, (c) › Positions seed, “No working order is added”);
  - the levels spec 03 authors.

  Spec 03 already says so: it names step C1 as the change that replaces the bars and keeps the Oct 7 close (spec 03, (c) › How the seeds are read).
- **σ comes from the desk’s HV, not its IV.** The walk’s daily σ is the desk’s 30-day HV ÷ √252. Today that HV is 23 for every symbol, or 1.45% a day. It is written as three literal 23s: the desk’s `hv_30d: 23` (`transport.ts:946`), the desk’s `atmIv / 23` (`:947`) and the structure history’s `hv_30d: 23` (`:1507`).
  - The draft took σ from ATM IV. With spec 03’s authored IVs, the bars would then realize their implied volatility, which contradicts spec 03’s IV rich and IV cheap labels (IV/HV ≥ 1.10 or ≤ 0.90; spec 03, (c) › One source, five readers, the fourth of its six invariants).
  - Taking σ from HV makes the bars realize exactly what the desk says they realized. If spec 03 makes HV a seed field, the walk reads that instead.
  - Part C moves the 23 into one exported constant in `shared.ts`, read by the walk and in place of all three transport literals (`transport.ts:946`, `:947`, `:1507`), after spec 03’s edits to those lines.
- **Levels are cited by reference.** The sample notes quote no level from today’s derivation. A note cites “the desk’s gamma flip”, and its figure is filled in from spec 03’s seed after (c) lands. The draft’s 521.54 (MSFT), 626.81 (QQQ) and 197.26 (NVDA) were today’s derived flips. Spec 03 moves MSFT’s down and puts TSLA’s above spot (spec 03, (c) › The six rows).
- **Figures both specs move are recomputed once.**
  - Spec 03’s per-seed IV and this spec’s series both feed `flowSeed` (Vol/OI, skew and off-exchange share; `flowSeed.ts:56-76`) and the IV-rank observations (`transport.ts:767-772`).
  - Spec 03 writes AAPL’s `iv_rank_band` into a seeded decision, read from AAPL’s own bundle after its IV change (spec 03, (c) › Positions seed, the AAPL row’s `iv_rank_band`).
  - Part C lands second. It recomputes those figures, AAPL’s band and the board lines that quote them (`design/src/screens/final/ticker-desk.mjs:105-106`, `:229`; `account-pages.mjs:64-69`), and states each in its PR.
  - Spec 03 open question 1 (“change no SPY figure”) holds for spec 03’s own change. Part C does move SPY’s bar-derived cells: IV rank, skew, Vol/OI, off-exchange share, ATR and the technical read.
- **Both specs edit one test.** Spec 03 extends the per-symbol loop in `transport.spec.ts:313` with its coherence block. Part C deletes only the research-evidence assertions inside that same test (`:298-342`) and keeps spec 03’s block. Both specs also edit `demo-journey.spec.ts` (spec 03 at `:143` and `:153`, this spec at `:318-381`).
- **Spec 01 owns the leads and the “say Sample once” rule.**
  - Spec 01 owns the `/research` lead and asks this spec to keep its first sentence (spec 01, Scope › Coordination with specs 03, 04 and 05, “Spec 04 keeps this spec’s `/research` lead”). This spec changes only the second (Copy).
  - Demo Expected reads “Computed · from the notes”, as spec 01 recommends (same section, the Demo Expected bullet), because the list is computed from the notes on both builds.
  - On the note page this spec follows the shared “say Sample once” row, owner decision D1 (spec 01 Q1, spec 03 Q2; spec 01’s draft is at Behaviour › Research and Alerts on staging: say Sample once). What follows holds under either draft. The page-level provenance chip and the About card’s `demo` tag are dropped. The note keeps one header word, its kind pill “Sample note”. That pill is D-21’s tag (`design/src/screens/final/tracker-data.mjs:227`), drawn in the slot where production prints the note’s kind (`NoteView.tsx:259`), so it is not an added chip. This spec asks the shared Amendments row (spec 01 Q1, spec 03 Q2) to name it in one clause.
  - **The quiet board.** Spec 01 hands this spec the opt-in for the note page (spec 01, Scope › Non-goals, “The desk’s Research tab is the desk’s too”, and Coordination, “The desk’s Research tab”). C2 sets it: on the demo, `ResearchRoute` wraps `NotesView` (`source="sample"`) in the provider spec 01 exports from `WidgetProvenanceContext.tsx` for its second, boolean context, set to `false`, as the three Research pages do (spec 01, Behaviour › Research and Alerts on staging › ChartFrame, on the three Research pages only). So no board-default frame on the note page, in the note or in `NotePublicPanels` under it, keeps the forced “Demo · sample data” tag. That needs spec 01 step 5, which waits on D1. The opt-in holds under either draft, because both make the bar the page’s one “Demo · sample data”. What each sample container says beyond its border waits on D1 (Behaviour, the Sample treatment row).
  - Spec 01’s criterion 13 checks that staging `/ticker/NVDA/research` and `/ticker/TSLA/research` still show 6 demo-tagged frames. It already says that check stops applying once C2 lands.
- **Spec 05’s production part needs B2** (`filingTitle.ts`, the 8-K item words). **Its staging part needs C2**: the sample note page it mounts on, and `sampleFrameSx` for its frame (spec 05, Behaviour › Where it sits, and Build plan › Part A and Part B). If B2 has not landed when spec 05’s Part A starts, Part A builds `filingTitle.ts` where B2 names it. C2 also retires `demoFigures`, so on the demo the check frame reads the sample note’s own figures (Behaviour › `/ticker/:symbol/research` on staging, the duplicated note facts). Spec 05’s step 1 then moves only `filingsOf`, and its staging figures line is whatever `filedFinding` returns for those matching figures (spec 05, Build plan › Part A, step 1).
- **The workflow now editing `apps/`, `libs/` and `tools/`.** Each part rebases on it before writing. Never `git stash` in the shared tree.

## Behaviour

### `/ticker/:symbol/research` on staging (the six sample notes)

`ResearchRoute` renders `NotesView` on both builds. On the demo, `NotesView` gets `source="sample"`, which does four things:

- It reads the sample notes instead of `researchUrl`.
- It sets `today` to the scenario day, `DEMO_CALENDAR_TODAY` = 2026-10-07 (`libs/api/src/lib/demo/calendar.ts:11`).
- It builds the calendar inputs from the scenario only: `DEMO_CALENDAR`’s FOMC dates and `DEMO_RESULTS_WINDOWS`, as `sampleNoteAging` does today (`reviewTriggers.ts:146-149`). The Fed’s real table stays out. One small helper does this, and `sampleNoteAging` goes (Verification).
- It tells `NoteView` to draw the sample treatment.

| State | What shows |
| --- | --- |
| Loading | The ticker as the h1 (display face, the size of the header’s ticker), then the three skeletons at their final shape (`NotesView.tsx:212-218`). |
| Ready | The production note anatomy in production order: header (ticker, company, about), whose kind pill reads **Sample note**; the headline as the h1; the deck; the metric row (strip); the valuation bar beside the TL;DR on single names (`NoteView.tsx:710-729`); then the parts with the section rail. There is no header provenance chip (spec 01 Q1). The D-21 elements stay. Its section rail is `NoteView`’s own `Rail` and `PartChips`. Its tag is the kind pill. Its 60-session sample price chart (`SampleTaChart`, `rsi={false}`) is the first figure of the note’s “The evidence” part. The side column holds “Next up”, “This note comes due”, “Why uncertainty is …” and **About this note**, which carries the link to a published note. `NotePublicPanels` sits under the note on the demo transport’s answer. Its demo branches already exist (`NotePublicPanels.tsx:164`, `:360`, `:374`, `:399`, `:624`, `:789`). It replaces `DemoNoteSide`’s two panels and `ResearchView`’s “Public record” band (`ResearchView.tsx:35-66`). |
| Sample treatment | Every figure container (the strip, the TL;DR, every `ChartFrame` in the note) is dashed with the hatch stripe and has no live dot (P-3, P-8). `useNoteFrame` stops hard-coding `provenance: 'primary'` (`blocks/noteFrame.ts:8-10`) and returns no `provenance`, so every note frame takes the board default, which the shell sets to `sample` on the demo and `primary` on production since `2cb4c8ef` (`shell/AppShell.tsx:222`). Production’s note frames stay solid and keep their own tags. On the demo, spec 01’s opt-in around `NotesView` (Coordination) drops the forced “Demo · sample data” tag from every board-default frame on the page, and a passed `warn` or `quiet` tag still shows. **What each container says beyond its border waits on D1:** under spec 01’s draft, its source line where it has one and nothing more; under spec 03’s draft, the sample named once in words, in its head or by a source chip that begins “Sample” or “Demo”. The strip and the TL;DR take `sampleFrameSx`, the treatment `ChartFrame` draws (`ChartFrame.tsx:113-131`), which C2 moves into one export beside it (Design). Their containers gain `data-testid="note-strip"` and `data-testid="note-tldr"` (`blocks/Figures.tsx:14`, `:61`). |
| Sources | Each sample note’s sources block lists readable rows, such as “Sample bar · Oct 7, 2026, close”, linked to the site page that shows the figure (`/ticker/NVDA/technical-analysis`, `/research/markets#rates`). A cited sample filing links to `/research/filings#<accession>`. `secAccessions` already reads an accession from any source link containing “filings” (`tools/research-notes/notes.mjs:943-949`), so the sample index carries each note’s cited accessions as production’s does. Filings selects the row named in the fragment on load. The note validator already accepts site-relative links (`notes.mjs:120-122`). No per-bar ID appears in visible text. The scenario ID appears once, in the sample chart’s source chip. |
| No note (unknown symbol) | The production “none” state (`NotesView.tsx:233-246`), reworded for the demo: h1 “No sample note on AMD.”, the list of the six sample symbols as links, and “See all research”. No warning styling and no retry. |
| Unknown slug | As production: “No NVDA note named “x”.” with a link to the latest (`NotesView.tsx:252-262`). |
| Couldn’t load | The page h1 is the ticker. Below it sits the failure component (see `/research/markets` below) with a plain cause, and Try again. If the asset came back as HTML, it shows **Reload** instead, because a stale tab can only recover by reloading. |
| Phone (390) | `NoteView`’s own phone layout, as it is today (`NoteView.tsx:704-746`): one column; the header, the strip, then the valuation bar and the TL;DR; then the parts (`NoteBody`, with `PartChips`); then the side cards, in a grid after the parts. **One demo-only move:** below `lg`, the About card renders directly after the TL;DR row, so a reviewer on a phone reaches the published-note link without scrolling past every part. The other side cards stay after the parts. Production’s phone order is unchanged. The About link wraps. Nothing scrolls sideways. |
| Signed out | Not applicable. Staging signs every visitor in to the demo account, and research needs no sign-in on either build. |

**The sample notes.** There are six Markdown files in the published format, one per staging symbol, at `research/_sample/<TICKER>/<date>-sample.md`.

- The loader skips folders that start with `_` (`notes.mjs:819`), so production’s index can never list them.
- The same parser and validator compile them. An invalid sample note fails the build, as a published note does (`vite-plugin.mjs:38-40`).
- The plugin emits them as a second, demo-only output: `virtual:convexa-sample-research`, with `sampleIndex` and `sampleUrl(ticker)`, and one hashed `research-sample-<TICKER>-<hash>.json` asset per note. The demo imports it dynamically, so the live build never fetches it. This is the same rule `research-ledger.ts:6` follows.

Every figure comes from the demo scenario, as the comment at `app.tsx:211` requires. Three rules govern what a sample note may say:

1. **A stated fact is one another demo surface shows.** Every figure a sample note states as a fact is one another demo surface also shows, or arithmetic on such figures marked `calc`. A reviewer who clicks through finds the same number.
2. **Valuation judgments are labelled assumptions.** A valuation block needs inputs no demo surface shows (`tools/research-notes/valuation.mjs:17-62`). These are authored and labelled as the sample’s assumptions. They are listed in the note’s model-inputs table, “How the model works, and every input” (`blocks/Valuation.tsx:1140-1306`), and the About card says so (Copy). Where each comes from:

   | Input | Source in the demo |
   | --- | --- |
   | `price` | The note-date close from the series (b): Oct 7 for MSFT, NVDA and AAPL; Sep 30 for TSLA |
   | `shares` | The profile’s shares outstanding (`public-data.ts:44-104`) |
   | `revenue` | The last sample quarter’s revenue × 4, marked `calc`, on the same annualized basis as the headlines’ P/E |
   | `margin_now` | The sample filing tags no operating income. The stand-in is net margin grossed up at the stated tax rate, net income ÷ revenue ÷ (1 − tax), marked `calc` and named so in the block’s `why` |
   | `tax`, `terminal_tax` | 21%, the U.S. federal statutory rate, stated as the sample’s assumption |
   | `net_cash` | The sample 10-Q’s cash and equivalents. The sample reports no debt, so net cash equals cash, and the inputs table says so |
   | `wacc`, `terminal_wacc` | The sample 10-year on the note date (`public-data.ts:132-153`) plus an authored equity risk premium, stated in `why` |
   | `terminal_growth` | Authored, no higher than the sample 10-year on the note date |
   | `growth`, `margin_target`, `sales_to_capital`, `p_fail`, `distress` | Authored judgments, one row per scenario, with the scenario’s `story` |

3. **A back-dated note cites only what existed on its date.** A note cites only figures dated on or before its note date. The Sep 30 notes (SPY, QQQ, TSLA) cite no Oct 7 level, close or desk read.

That gives:

| Note | Valuation bar | Figures it may cite |
| --- | --- | --- |
| MSFT, NVDA, TSLA | Yes | Close; shares outstanding; the sample 10-Q’s revenue, net income, diluted EPS and cash (`public-data.ts:429-500`); the desk’s levels (Oct 7 notes only); the sample 10-year (`public-data.ts:132-153`); and the rule 2 assumptions |
| AAPL | Yes, if Q1 is answered as recommended; otherwise no | Close and shares today. Its own sample 10-Q figures once AAPL joins the sample filers |
| SPY, QQQ | No | Close, the sample curve and the sample calendar, all on or before Sep 30. These are funds; the scenario values no fund (`calendar.ts:113-118`). |

**Correction to the input:** the input asks for “each” note to have a valuation bar. Funds get none. Their notes carry a headline, a metric row and a TL;DR. `NoteView` already renders the TL;DR alone when a note has no valuation (`NoteView.tsx:712`). It follows that `valued` is false for SPY and QQQ, so the FOMC does not make them due. Today `sampleNoteAging` marks all six as valued (`reviewTriggers.ts:163`).

The dates and catalysts:

- MSFT, NVDA and AAPL are dated Oct 7, the scenario day. SPY, QQQ and TSLA are dated Sep 30 (Q5).
- Every catalyst is a date the scenario already has.
  - TSLA’s Q3 results (Oct 22) and MSFT’s results (Oct 29) come from today’s `DEMO_NOTE_RESULTS` (`calendar.ts:105-108`).
  - MSFT’s label becomes “Q3 FY27 results”. Its sample 10-Q is fiscal Q2 of FY2027, the quarter ended Jul 26 (`public-data.ts:436-442`, `:490-491`), so “Q1 FY27” would contradict the filing the note cites. TSLA’s “Q3 results” already agrees.
  - SPY’s catalyst is CPI on Oct 14 and QQQ’s is PCE prices on Oct 30, both from `DEMO_CALENDAR` (`calendar.ts:26-33`, `:50-57`).
  - AAPL and NVDA lean on their estimated results windows (`calendar.ts:86-100`).
- A fund’s catalyst label must not match `/results|earnings/`, or Filings’ Expected would claim the fund files results (`FilingsPage.tsx:99`). It must not be `FOMC_TRIGGER` either, which the card and Coming up treat as the shared calendar row (`ResearchIndexPage.tsx:94-108`).

The forecasts:

- Each sample note’s forecasts block holds that ticker’s open calls from the sample ledger.
- They keep today’s 34 rows (3 past their dates, 4 inside the next two weeks, the rest later; 31 carry a probability). The probabilities and per-ticker counts stay (`research-ledger.ts:54-134`), and the claims are rewritten.
- **A resolve date may move when its claim needs it.** A moved date stays in its bucket (past, next two weeks, later), so the Scorecard’s counts hold.
- **Each claim resolves on a kind of figure the demo shows**: a daily close, a filed figure or a scheduled release. A back-dated note’s claims follow rule 3.
- The three past-date calls (QQQ Oct 2, SPY Oct 5, TSLA Oct 6) resolve on bars the Technical tab already shows. They stay open because scoring is the author’s step. That waiting state is what the Scorecard shows, and its demo hint says so (Copy, Q5).
- The Scorecard then reads `OPEN` from the sample index, as production reads `researchIndex` (`ScorecardPage.tsx:58-60`). `HISTORY` and the signal grades stay in `research-ledger.ts`.

This also ends the demo’s duplicated note facts:

- `DEMO_NOTE_RESULTS` becomes the TSLA and MSFT notes’ own catalysts.
- `DEMO_NOTE_PRICED` becomes the valuation blocks’ price dates.
- `SAMPLE_AGING` is computed from the sample index the way production’s rows are (`ResearchIndexPage.tsx:705-737`).
- Their consumers read the sample index: `ComingUpSection.tsx:93`, `ResearchIndexPage.tsx:112-121`, `MarketsPage.tsx:1217-1224`.
- **`demoNoteFilings` and `UNCITED` go** (`public-data.ts:355`, `:362-372`). Today they date every sample note on Oct 7 and mark the sample accessions as cited (`:356-372`), which would be false for the Sep 30 notes and for any filing a new note does not cite. Filings reads the sample index’s `latest` (note date plus cited accessions) exactly as production reads `researchIndex` (`FilingsPage.tsx:54-60`). The standing copy (“The TSLA note already cites this filing.”, `:645-649`) then follows what each note actually cites. TSLA’s note leaves its vote 8-K uncited, as `UNCITED` does today. Every sample filing predates Sep 30, so none reads “new since the note”.
- **`demoFigures` goes** (`FiledFigures.tsx:37-81`). Today it writes the figures the “Checked against the filing” frame checks, from the sample 10-Q, with diluted EPS a cent high (`:67`), so staging shows a Differs row. Once the note is a real file, that row would contradict the note’s own figure, for example NVDA’s $1.00 EPS in its TL;DR (Copy), and break rule 1.
  - On the demo the frame reads the sample note’s own figures, the sample index’s `latest.figures` for the ticker, as production reads `researchIndex` (`FiledFigures.tsx:165-167`). It reaches the sample index through the demo’s dynamic import, never a static one (AC 17).
  - Each sample note on a company with a sample 10-Q (MSFT, NVDA, TSLA, and AAPL if Q1 is yes) states the 10-Q’s figures in metrics or strip rows that name their XBRL concept, as the published notes do (`notes.mjs:922-939`). The sample 10-Q tags four: revenue, net income, diluted EPS and cash (`public-data.ts:492-497`). So the frame has rows to check, and no row differs.
  - The tradeoff: staging no longer shows a Differs row, and rule 1 rules out authoring one. The production board keeps the form drawn (`design/src/screens/final/planned-charts.mjs:208-215`).

**Dead code.** The following goes once nothing imports it:

- `ResearchView.tsx` and `DemoNoteSide.tsx`
- `SampleResearchCase` (`libs/api/src/lib/demo/types.ts:30`), `loadSampleResearch` (`views.ts:163-206`) and `researchNarratives` (`shared.ts:37-137`)
- The recommendation export, which reads the last bar’s ID directly instead of `scenario.research.evidence` (`transport.ts:494-496`)
- `demoNoteFilings`, `UNCITED`, `sampleNoteAging` and `demoFigures`
- `SampleChip`. Nothing replaces it in the note header; the kind pill carries the word.

### `/ticker/:symbol/research` on production

Production changes in three ways:

- **The h1 survives every state.** It is the ticker while loading and on failure, and the headline when ready.
- **Failures name their cause in plain words.** The status code stays in a `data-status` attribute for debugging and is not shown.
- **Author slots leave the reader’s view:**
  - The header shows a stance pill only when the note sets one (`NoteView.tsx:245-249`).
  - The “Your view” column of the variant table is left out when every row is empty. When only some rows are set, an unset cell reads `not set`, the rule-24 member, in Sans.
  - The odds frame keeps “This note sets no odds.” and drops the “Write odds: …” cause and the “not set” pill (`blocks/Valuation.tsx:911-923`).
  - The dashed “Your stance, target, position” card is replaced by a **For the author** disclosure at the end of the side column (Q6). It lists each unset slot and its front-matter key.
  - The footnote’s last sentence moves into that disclosure as well (`NoteView.tsx:816-823`).

### `/research` (both builds)

- **Order at every width:** tabs, then h1 and lead, then Coming up, then the filter bar, then the card grid. The filter bar sits directly above the cards it filters.
  - The board (`design/src/screens/final/research.mjs`) is updated to match.
- **Coming up below 768px** becomes a sideways rail of the same cards, one row tall (Q3):
  - Each card is 72% of the column wide, so the next one peeks.
  - The rail snaps to cards and spreads spec 02’s `useScrollRegion('Coming up, scrolls sideways')` (spec 02, (d) Keyboard and focus › Note tables and code blocks). So it is a tab stop and a named region only while it overflows, which satisfies axe `scrollable-region-focusable`, and it leaves no page overflow.
  - The 153px intro paragraph becomes one line plus an ⓘ (`shared/ui/AccessibleHelp.tsx`) that holds the full text.
  - At 768px and above, the grid is unchanged.
  - This needs a one-line canon row that adds the rail to rule 17’s deliberate rails (`DESIGN_SYSTEM.md:172`). See Q3.
- **Section gap below 768px** steps down from 32 to 24, still on the 4-pt ladder. The budget at 390×844, built from today’s measured positions:
  - Production’s first card lands at about y=716.
  - Staging’s lands at about y=761 with the Freshness group hidden, and about y=813 with it shown (Q5 makes three notes Review due, so it shows).
  - The staging numbers assume today’s demo banner (main starts at y=194). Spec 01 shortens that banner to 45px at phone width (spec 01, Behaviour › The demo bar (staging, every route) › Below 600px (xs)), and AC 14 is measured after both land.
- **Filter groups.** A group shows only when the notes it covers hold at least two values. While all 14 production notes have no stance, the Stance group is hidden. It returns once two stances exist. While all six sample notes share one freshness, staging’s Freshness group is hidden.
  - A group whose chosen chip would vanish stays until it is cleared. This is the rule the Freshness chips already follow (`ResearchIndexPage.tsx:923-924`).
- **The NEXT line on a card leads with the note’s own trigger.**
  - The own trigger is the soonest event `upcoming()` lists whose label is not `FOMC_TRIGGER`. `upcoming()` lists unresolved catalysts only (`tools/research-notes/freshness.mjs:93-96`). So a note’s own triggers are its dated catalysts plus, from the calendar, its estimated results window, which `calendarTriggers` adds as a catalyst labelled `ESTIMATE_TRIGGER` (`reviewTriggers.ts:108-111`).
  - **Kill dates and forecast dates do not lead.** They are not review triggers. Widening `upcoming()` to include them would change `npm run research:due`, which reads the same function. The card filters `upcoming()`’s output inside `ResearchIndexPage.tsx`, and `freshness.mjs` is untouched.
  - When the FOMC falls before that trigger and the note is valued, a second line says so.
  - When the note has no trigger of its own, the FOMC leads, as today.
  - The card never claims a later date is the next one due.
  - The rule applies on both builds. On production it changes the lead line of each of the 5 FOMC-led cards whose note has a later catalyst or results window.
  - Staging, after part C, with Q1 as recommended:

    | Card | NEXT line | Second line |
    | --- | --- | --- |
    | AAPL | Results, estimated from filing history, Oct 29–Nov 2 | Before it: FOMC decision, Oct 28 |
    | MSFT | Q3 FY27 results, Oct 29 | Before it: FOMC decision, Oct 28 |
    | NVDA | Results, estimated from filing history, Nov 18–20 | Before it: FOMC decision, Oct 28 |
    | QQQ | PCE prices, Oct 30 | none (a fund, unvalued) |
    | SPY | CPI, Oct 14 | none (a fund, unvalued) |
    | TSLA | Q3 results, Oct 22 | none (Oct 22 is before Oct 28) |

    AAPL and NVDA share a label, so the six lines differ by label and date together (AC 8). If Q1 is answered no, AAPL is unvalued and loses its second line.
- **Staging cards** read the sample index: the title is the note’s headline, the thesis line is its deck, and the chart is the daily close change from the new series (b).
  - The tag reads “Current” or “Review due”, computed by `freshness()` on the scenario day. This replaces the constant `SAMPLE_FRESHNESS` (`ResearchIndexPage.tsx:130`).
- **States:**
  - Loading: cards `aria-busy` (unchanged).
  - Empty search: “No ticker matches this search.” (unchanged).
  - A failed sample index: the failure component.
  - Phone: as above.

### The sample series (staging only, `libs/api/src/lib/demo/catalog/shared.ts`)

- **Pin the last close.** The Oct 7 close stays at today’s value for every symbol. It is the existing formula evaluated at i = 59, now used only as the anchor: SPY 690.62, QQQ 632.91, AAPL 264.29, MSFT 526.66, NVDA 199.17, TSLA 476.03. Spot, every option mark, the replay’s mid and anything else computed from spot alone therefore stay unchanged. The levels are spec 03’s (Coordination).
- **Walk backwards from the anchor.** Each earlier close is `c[i−1] = c[i] / (1 + r[i])`, where:
  - `r[i] = step/base + σ·z[i]`, so the authored drift stays;
  - `z` is a standard normal from a seeded PRNG keyed on `${SCENARIO_ID}:${symbol}`. The 59 draws are standardized to mean 0 and standard deviation 1, so the drift is exactly `step/base` and the realized volatility over the 59 moves is exactly σ, to rounding;
  - `σ` is the desk’s 30-day HV ÷ √252: today 23 ÷ √252 = 1.45% a day for every symbol (`transport.ts:946`). One exported `shared.ts` constant replaces the three literal 23s: the desk’s `hv_30d` (`transport.ts:946`), the desk’s `atmIv / 23` (`:947`) and the structure history’s `hv_30d` (`:1507`). The bars then realize the HV the desk prints, and spec 03’s IV/HV labels describe these bars (Coordination);
  - closes round to cents.
- **Candles.** The open is the prior close times (1 + a gap of σ/4). The high and low wrap max(open, close) and min(open, close) by |N(0, σ/2)|. Up and down candles both occur. This includes Oct 7’s open, high and low; its close stays pinned.
- **Dates.** The series skips NYSE holidays, as the sample Treasury path skips bond holidays (`public-data.ts:117-129`). In this window that means 2026-09-07, Labor Day. It stays 60 bars (`catalog.spec.ts:43`).
- **What changes downstream:**
  - the Technical tab’s bars and indicators;
  - **the desk’s technical read**: direction, momentum and strength from EMA20/50, RSI14 and ADX14 (`transport.ts:830-856`, sent at `:991-1010`), and ATR14. The desk’s Market context card shows it, and the Final desk board quotes it as “Uptrend · Dispersed” and “ATR 14d $12.94 (1.9%)” (`design/src/screens/final/ticker-desk.mjs:229`). The read can come out mixed or down for a symbol. Nothing on the demo contradicts that, because the demo’s AI read is a neutral no-trade (`transport.ts:709-711`) and rule 1 holds the notes to what the desk shows. The scratch script that runs the walk prints each symbol’s read, and the PR states it;
  - the flow seed figures (`flowSeed.ts:58-76`);
  - the IV-rank observations (`transport.ts:767-772`);
  - the structure-history samples (`transport.ts:1490-1502`);
  - the cards;
  - the design copy of the series. That copy, at `design/src/screens/final/ticker-tech.mjs:30-34`, also still uses an old NVDA seed: base 187, step 0.21, against 190.54 and 0.15.

  The board lines that quote any of these are recomputed once, after spec 03 (c) and part C have both landed (Coordination).
- **Q2:** whether the Oct 6 close moves too.
- **Determinism.** The same seed gives the same bars in every browser on every load, and after “Reset demo data”.

### `/research/filings`

**Expected on the demo** uses production’s rule (`FilingsPage.tsx:96-103`):

- It reads the sample notes’ own results catalysts within 42 days of `DEMO_CALENDAR_TODAY`. That gives TSLA “Q3 results” Oct 22 and MSFT “Q3 FY27 results” Oct 29.
- Estimated windows stay on Coming up and the calendar, as on production.
- The tag reads “Computed · from the notes”, as on production, and as spec 01 recommends (spec 01, Scope › Coordination with specs 03, 04 and 05, the Demo Expected bullet). The list is computed from the notes on both builds, and the bar already says the page is a demo.
- The “no dated results” copy is deleted.

**Row titles on both builds** come from the item’s meaning (the lookup below), with the form and items as secondary text in the existing column.

- For an 8-K, the title is its lead item’s meaning, by the priority 2.02, 1.01, 2.01, 5.02, 5.07, 2.03, 3.02, 7.01, 8.01, then the rest. Then comes “+ N more” when other non-9.01 items exist.
- A form with no mapping keeps the form code, so a row never goes blank.
- EDGAR’s description shows in the detail only when it adds words beyond the form code (1 of 114 rows today).
- The detail h2 is the same title.
- Spec 05 imports the item words from here, as it plans to (spec 05, Why › What the audit changed in the idea, item 9, and Behaviour › Line kinds, the `filing` row).

**Staging seed descriptions:** each of the 9 seed rows gets its own EDGAR-style description, replacing “Demo sample filing”.

**The detail’s actions follow the board.**

- “Open the filing” becomes the detail’s one contained amber primary, as the Final board draws it (`research.mjs:205`, ruling A). It stays a link to EDGAR that opens in a new tab.
- “Copy the draft command” becomes an outlined neutral button. Together with the “Run … in the repo” line (`:702-706`), it moves into a **For the author** disclosure in the detail panel (Q6).
- Filings then spends amber once, on the action the board names. The command still shows only when a results or quarterly filing is new since the note.

**States:**

- Loading: the feed skeleton (unchanged).
- Couldn’t load and Source down: the failure component.
- Off and Not set up: the quiet panel with its state tag.
- “Nothing filed in the last 90 days”: quiet.

### `/research/scorecard`

- **Demo.** The past-due hint at `:155` is gated on `DEMO` and gets reader copy. The soon hint’s demo branch at `:175` gets new copy too, because it calls the paths “authored” and the claims change (Copy). The “Copy row” buttons don’t render. The claims are the rewritten sample-note forecasts.
- **Production.** Each forecast list shows date, ticker, claim and probability. A **For the author** disclosure under each list (Q6) holds the hint and the rows as copyable Markdown, each with its “Copy row” (unchanged behaviour, 44px).
- Loading, empty and failed states are unchanged, except that a failed sample ledger uses the failure component, not the plain `role="status"` paragraph at `:144-147`.

### `/research/markets` (failure states only)

**The failure component**, `LoadFailure`, lives at `shared/dataState/LoadFailure.tsx`.

- It takes:
  - `state`: `couldntLoad` or `sourceDown` (`vocabulary.ts:36-38`). `lastGood` is left out. “Last good copy” means older data is still showing, not that a region failed, and `StaleNote` already draws it (`publicUi.tsx:224`), unchanged;
  - `what`: the region’s name, standalone only;
  - `cause`: the cause in plain words;
  - optional `still`: what still works;
  - `action`: the one button, a `RetryButton` exported from the same file. It takes `onClick` and an optional `reload`, which sets the label to “Reload” instead of “Try again”;
  - `inFrame`: set by `ChartFrame` only (below).
- **Standalone** (`SourceProblem`, the note page, the Scorecard’s sample ledger), it renders a panel with:
  - a 1px solid border in `warning.main` at 60%, the same border the warn `DataStateTag` uses (`DataStateTag.tsx:80-84`);
  - the warning glyph (`WarningAmberOutlined`, 20px, `warning.main`);
  - the word from the closed vocabulary in `warning.main`, then “ · ” and `what`;
  - the cause, then `still`, in `text.secondary`;
  - the action.
- **Inside a chart frame** (`inFrame`), the frame’s head tag carries the glyph and the word. The body renders the cause, `still` and the action only, inside the frame’s existing neutral message panel. So no region says its word twice, and no region shows two buttons.
- `RetryButton` is a 44px outlined neutral button at every pointer.
- **It carries `role="status"`, which is a deliberate change.** `ChartFrame`’s warn body uses `role="alert"` today (`ChartFrame.tsx:248`). An alert is assertive and interrupts whatever the screen reader is saying. In the fail state Markets renders five failed regions at once, which would fire five interruptions on load. A failed load is not an emergency the reader must hear before anything else. The word stays visible and is announced politely, and a retry that fails again is announced the same way.

**`ChartFrame`’s warn messages:**

- **The type.** `ChartStatus`’s warn variant becomes `{ kind: 'message'; tone: 'warn'; state?: 'couldntLoad' | 'sourceDown'; cause: string }` (`shared/charts/frame/frameTitle.ts:9`). `state` defaults to `couldntLoad`. The quiet variant keeps `text` and `cause` unchanged.
- **`text` goes for warn.** The head tag’s word plus the frame title say what failed, and P-10 already makes a failed frame’s title name the metric. So “Couldn’t load the reported figures.” becomes the title “Reported figures” with the tag “Couldn’t load” (`FilingsPage.tsx:948-950`). Any words in a call site’s `text` beyond that move into its `cause`.
- **The head tag.** When the status is warn, the frame’s head tag is the warn state. A call site that already passes a warn `tag` keeps it, with its `detail`, for example Coming up’s “Source down · schedules” (`comingUp.ts`). Otherwise `ChartFrame` draws `DataStateTag state={status.state}`. The frames that pass an explicit failure tag today (FiledFigures, InsiderClusters, the Filings figures frame) keep showing it, as spec 01’s error row expects (spec 01, Behaviour › States, the Error row).
- **The body.** `StateBody` renders `LoadFailure inFrame` and drops the 2px left edge (`ChartFrame.tsx:260`). It keeps the ghost grid and the plot’s height (`:230-245`).
- **The retry.** The frame’s existing `action` slot carries it (`ChartFrame.tsx:176`, rendered in the message panel). Call sites that pass a retry pass `<RetryButton onClick={…} />` instead of their own small button:
  - `ComingUpSection.tsx:150-158` (`size="small"` today);
  - `FilingsPage.tsx:991-1000` (`minHeight: 36` today).

  Those are the two frame retries. `FiledFigures.tsx:195`, `FundHoldings.tsx:183`, `InsiderClusters.tsx:167` and `Peers.tsx:93` are warn-message sites only: their `action` is the operator `<details>`/`<OperatorNote />` on the notSetUp branch, not a retry, and it stays untouched (only their `text` moves into `cause`). The page-level "Try again" buttons in `publicUi.tsx` (SourceProblem) and `NotesView.tsx` are swapped for `RetryButton` the same way, so the Research tree has four "Try again" buttons in all, matching spec 2's count.

  `LoadFailure` never adds a button of its own inside a frame.

**Where it goes:**

- `SourceProblem` keeps its name and takes a `state`. Warn states render `LoadFailure` standalone, with `action={<RetryButton onClick={retry} />}`. Quiet states (`off`, `notSetUp`, empty) keep the neutral panel and gain their `DataStateTag`, so no state is carried by border alone.
- Call sites:
  - `SourceProblem` is used 11 times: Markets 5, Filings 4, NotePublicPanels 1, PublicDesk 1.
  - Warn message statuses (`tone: 'warn'`) appear at 11 sites outside specs. Each passes its state and moves its words into `cause`. The quiet ones are unchanged.
- `NotesView`’s error state renders `LoadFailure` standalone under the ticker h1, in place of the MUI `Alert` (`NotesView.tsx:220-231`).

**Markets in the fail state:**

- “Rates and positioning” reads Couldn’t load, with Try again.
- The Coming up frame reads Couldn’t load, with Try again (`comingUp.ts:303-308`, `ComingUpSection.tsx:150-158`).
- The three per-source panels read Source down (`MarketsPage.tsx:199-241`).
- Off stays quiet and gains its tag (`:185-189`).

### Research tabs (both builds)

- The Scorecard badge reads “77 open forecasts” (staging: “34 open forecasts”). The link’s accessible name is “Scorecard, 77 open forecasts” (`ResearchTabs.tsx:37`).
- The Notes badge keeps its visible count, “14”. The link’s accessible name is “Notes, 14 notes” (`:30`).
- Both names come from visually hidden text around the badge (`, ` before it, and ` notes` after the Notes count), not from `aria-label`. That way the visible words stay inside the accessible name (WCAG 2.5.3).
- On a phone the tab row is already a rail (`DESIGN_SYSTEM.md:273`), so the longer badge scrolls instead of wrapping.

### Not live

None of these pages depends on the options feed. The one Not live tag among them, on the Scorecard’s Signal track record (`ScorecardPage.tsx:811`, `DataStateTag state="notLive" detail="price source"`), stays as it is. The sample notes and their components never load on production.

## Copy

The voice follows `DESIGN_SYSTEM.md`: plain words, short sentences, a figure with its unit and date. State words come only from the closed list in `vocabulary.ts:32-51`. Apostrophes are ’ (U+2019) in every proposed string, matching `Couldn’t load`. Today several titles use a straight apostrophe, for example `MarketsPage.tsx:180`. A byte scan of this section is in Verification.

**Sample note voice.** Write like `research/NVDA/2026-10-13-initiation.md`:

- The headline states a finding with a figure, in P-10’s sense.
- The deck says what the price assumes.
- Each figure carries its unit, period and source.
- The body never says “authored”, “synthetic” or “scenario”. The kind pill, the frames’ source lines and the dashed frames carry sample status (P-3), with the bar as the page’s one “Demo · sample data” (spec 01 Q1).
- No stance and no advice. Stance stays unset on every sample note.

The proposed headlines below use the scenario’s own figures. The owner may reword them; the figures are fixed by the seeds. The dates assume Q1 and Q5 are answered as recommended.

| Note (date) | Headline (h1) | Figures and source |
| --- | --- | --- |
| NVDA (Oct 7) | A 55.6% net margin on a $45.0B quarter. At 49.8 times annualized earnings, the price assumes it holds. | $25.0B ÷ $45.0B, sample 10-Q for the quarter ended Jul 26 (`public-data.ts:86-94`, `:432-449`); $199.17 ÷ ($1.00 × 4) |
| MSFT (Oct 7) | Microsoft keeps 36.0% of revenue as profit. At 36.6 times annualized earnings, the price already counts on it. | $27.0B ÷ $75.0B; $526.66 ÷ ($3.60 × 4) |
| AAPL (Oct 7) | $90.0B of revenue a quarter at a 25.6% net margin. At 44.0 times annualized earnings, the window from Oct 29 decides it. | $23.0B ÷ $90.0B, AAPL’s own sample 10-Q for the quarter ended Jun 27 (Q1); $264.29 ÷ ($1.50 × 4); window `calendar.ts:86-93` |
| TSLA (Sep 30) | A 5.5% net margin at {P/E} times annualized earnings. The price is a bet on margins the last quarter doesn’t show. | $1.2B ÷ $22.0B; the Sep 30 close from (b) ÷ ($0.35 × 4), filled in after (b) lands |
| SPY (Sep 30) | A 5.15% 10-year, up 0.87 points in a year. CPI on Oct 14 is the first test of what the index can carry. | Sample curve: 5.15% on 2026-09-30 against 4.28% on 2025-09-30 (`public-data.ts:132-153`); CPI on Oct 14 (`calendar.ts:27-32`) |
| QQQ (Sep 30) | Long-duration growth on a 5.15% 10-year, with the curve only 0.44 points steep. PCE prices on Oct 30 is the next rate print. | 5.15% − 4.71% on 2026-09-30; PCE on Oct 30 (`calendar.ts:50-56`) |

**The NVDA TL;DR, as the example for the other five:**

- `55.6%` | Net margin in the quarter ended Jul 26: $25.0B of profit on $45.0B of revenue. [2]
- `49.8×` | The Oct 7 close over the last quarter’s $1.00 EPS times four. The base case assumes the margin settles at {base `margin_target`}%, one of the model’s stated inputs; the bar shows where the price sits against that range. [1][2]
- `Nov 18–20` | The next results window, estimated from the filing history. The note comes due when that filing lands. [3]

**The NVDA metric row.** Price $199.17 @ Oct 7 · Market cap $4.78T (24.0B shares × price, calc) · P/E 49.8× (calc) · Net margin 55.6% · Cash $12.0B @ Jul 26 · Gamma flip {the desk’s NVDA flip @ Oct 7, from spec 03’s seed}.

**Forecast claims** take the same voice. Some examples of the rewrite:

| Today | Rewritten | Date |
| --- | --- | --- |
| “The authored path keeps its higher-close sequence through Oct 2.” (QQQ, 70%, note dated Sep 30) | “QQQ closes Oct 2 above its Sep 30 close of {QQQ’s Sep 30 close}.” | Oct 2, unchanged. It resolves on the Oct 2 bar and stays open as a past-date call (Q5) |
| “The authored close holds above its 20-session average through Oct 13.” (MSFT, 72%, note dated Oct 7) | “Microsoft closes Oct 13 above the gamma flip the desk shows on Oct 7, {MSFT’s flip}.” | Oct 13, unchanged |
| “A sample session moves more than 4% before Nov 6.” (NVDA, 45%) | “NVIDIA’s Q3 FY2027 revenue is at least $47.0B.” | Moves from Nov 6 to Nov 20, the end of NVDA’s results window (`calendar.ts:95-99`), and stays in the “later” bucket |

The other 31 follow the same rules. Each level is filled in from spec 03’s seed once (c) lands, never from today’s derived values. NVDA’s fiscal Q3 FY2027 follows its sample 10-Q, which is Q2 of FY2027 (`public-data.ts:441`, `:490-491`).

**Note page (demo):**

- Header provenance chip: none. The bar says “Demo · sample data” (spec 01 Q1).
- Kind pill: “Sample note” (`DataStateTag state="sample" word="Sample note"`, in the slot production uses for the note’s kind, `NoteView.tsx:259`).
- About card title: “About this note”, with no tag.
- About card body: “Written for the demo’s Oct 7, 2026 scenario, in the same format as the published notes. Prices come from the scenario’s bars and company figures from its filings; none is a company record. The valuation’s other inputs are assumptions made for this example, listed with the model.”
- About card link: “Read a published note: NVIDIA, from its SEC filings ↗”. It points to `${LIVE_SITE_URL}/ticker/NVDA/research` (`shared/lib/demoSite.ts:9`) and opens in a new tab with `rel="noopener"`. That page is the owner’s own writing and is already public. Nothing crosses builds.
- Footnote: production’s footnote without its last sentence: “{RESEARCH_DISCLAIMER} Figures come from the cited sources as of the dates shown; “calc” marks arithmetic on cited figures. Valuation values are computed from the stated inputs when the site builds.” The About card already says the note is a sample, so the footnote does not repeat it.
- Sample chart source chip: “Sample bars · scenario portfolio-2026-10-07-v1”, the frame’s one source line.
- None state: “No sample note on AMD.” / “The demo has sample notes on AAPL, MSFT, NVDA, QQQ, SPY and TSLA.”

**Failure causes.** One helper, `failureCause()`, sits beside `LoadFailure`. Each cause gets its action:

| What happened | Cause | Action |
| --- | --- | --- |
| `fetch` rejected (offline, DNS, CORS) | Your browser couldn’t reach Convexa. Check the connection, then try again. | Try again |
| `/api` answered 5xx or not JSON | Convexa’s server didn’t answer. | Try again |
| A note asset answered 5xx | The site’s host didn’t send this note. | Try again |
| A note asset answered HTML (a stale tab after a deploy) | This page is older than the site’s latest update. Reload to get the current notes. | Reload |
| A note asset’s JSON had the wrong shape | The note’s file arrived but couldn’t be read. | Reload |

**Failure lines:**

- Markets, standalone: “Couldn’t load · Rates and positioning” / “Convexa’s server didn’t answer.” / “The notes and the Scorecard don’t depend on it.”
- Calendar, in its frame: head tag “Couldn’t load”; body “Convexa’s server didn’t answer.” / “Each note still lists its own dates.” Today’s `text`, “The calendar didn’t load.” (`comingUp.ts:306`), goes, because the title and the tag say it.
- Filings figures, in its frame: title “Reported figures”, tag “Couldn’t load”; body: the SEC cause, then “The filing itself is linked below.”
- Note, standalone: “Couldn’t load · MSFT research note” / the cause from the table.
- Source down (unchanged wording): for example “Source down · Rates” / “The Treasury’s rate files didn’t answer and there is no earlier copy to show.”

**Other strings:**

- Index lead (demo): spec 01’s first sentence, then production’s second: “Research notes on the tickers Convexa follows. Each opens with a 30-second summary.” This replaces spec 01’s second sentence once part C gives the sample notes the published format (`ResearchIndexPage.tsx:798-799`; spec 01, Copy › Research and Alerts (staging only), the `/research` lead row).
- Coming up lead (demo): spec 01’s sentence (same table, the Coming up sentence row), with “the FOMC decision for every note” narrowed to production’s words, “the FOMC decision for every note with a valuation” (`ResearchIndexPage.tsx:569-570`). The FOMC tile’s due line reads “every valued note”, as production’s does (`:750`). The phone one-liner reads “When each note comes due for review.” No sample word is added.
- NEXT second line: “Before it: FOMC decision, Oct 28 · moves the discount rate”
- Filings Expected tag (demo): “Computed · from the notes” (`DataStateTag state="computed" detail="from the notes"`), as production.
- **For the author** (summary, 44px, production only; Q6 on whether it remembers being open):
  - Filings: “For the author · draft the update”. Button: “Copy the command” / “Copied”.
  - Scorecard: “For the author · N rows to fill”. This holds the two existing hints (`ScorecardPage.tsx:155`, `:177`).
  - Note: “For the author · unset: stance, target, position, odds”
- Scorecard past-due hint (demo, `:155`): “These calls passed their dates before Oct 7. They stay open here, so the page shows a call waiting for its outcome.”
- Scorecard soon hint (demo, `:175`): “Calls from each note’s forecasts block. Each one resolves on a close, a filing or a release the site shows.” This replaces “Sample forecasts on the demo’s authored price paths.”
- Tab badges: Scorecard “{n} open forecasts”, accessible name “Scorecard, {n} open forecasts”. Notes “{m}”, accessible name “Notes, {m} notes”.

**Filing titles, a closed lookup** in `pages/research/filingTitle.ts`. The words follow SEC’s own Form 8-K item captions (SOURCES.md:88, reuse permitted):

| Code | Title |
| --- | --- |
| 1.01 | Material agreement |
| 1.02 | Agreement ended |
| 1.05 | Cybersecurity incident |
| 2.01 | Acquisition or sale completed |
| 2.02 | Results of operations |
| 2.03 | New debt or obligation |
| 2.05 | Exit or restructuring costs |
| 2.06 | Impairment |
| 3.01 | Listing notice |
| 3.02 | Unregistered share sale |
| 3.03 | Change to shareholder rights |
| 4.01 | Auditor change |
| 4.02 | Past financials no longer reliable |
| 5.02 | Director or officer change |
| 5.03 | Charter or bylaw change |
| 5.07 | Shareholder vote results |
| 7.01 | Regulation FD disclosure |
| 8.01 | Other events |
| 9.01 | Exhibits (never the lead) |
| 10-Q | Quarterly report |
| 10-K | Annual report |
| 6-K | Foreign issuer report |
| 20-F | Foreign annual report |
| DEF 14A | Proxy statement |
| DEFA14A | Additional proxy material |
| PRE 14A | Preliminary proxy statement |
| PRE 14C | Preliminary information statement |
| PX14A6G | Shareholder solicitation |
| N-PX | Fund proxy votes |
| ARS | Annual report to shareholders |
| 424B2, 424B3, 424B5 | Prospectus |
| FWP | Free-writing prospectus |
| S-3ASR | Shelf registration |
| S-4 | Merger registration |
| S-8 | Employee stock plan registration |
| EFFECT | Registration effective |
| 8-A12B | Exchange listing registration |
| CERT | Exchange listing certification |
| SCHEDULE 13G | Passive stake over 5% |
| SCHEDULE 13D | Active stake over 5% |
| 13F-HR | Fund holdings report |

A `/A` suffix (or `S-8 POS`) appends “ (amended)”. This covers every form in production’s list today (`probe-forms.mjs`).

**Staging seed descriptions** (`public-data.ts:378-403`). None names a fiscal quarter, so none can clash with a note’s catalyst label:

- results 8-K: “Results release, quarter ended Jul 26” (AAPL, if Q1 is yes: “Results release, quarter ended Jun 27”)
- 10-Q: “Quarterly report, period ended Jul 26, 2026” (AAPL: “… ended Jun 27, 2026”)
- 5.07 8-K: “Annual meeting vote results”

The company name comes first, for example “NVIDIA · Results release, quarter ended Jul 26”. The row title comes from the lookup.

## Design

Every part reuses existing tokens and components. Nothing comes from the Banned list.

- **Sample treatment:** the dashed `textTertiary` border and the 8px `hatch` stripe from `ChartFrame.tsx:113-131` (P-3, P-8).
  - C2 moves that block into one export, `sampleFrameSx`, in `shared/charts/frame/sampleFrame.ts`, re-exported from `shared/charts/frame/index.ts`. `ChartFrame`’s sample branch, the strip, the TL;DR and spec 05’s section all use it. Nothing copies it.
  - Spec 01’s Coming up tiles and Rates today strip copy `Panel`’s `::before` block (spec 01, Design › The P-8 sample frame). They may switch to `sampleFrameSx` later.
  - The note’s one header mark is the kind pill, `DataStateTag state="sample" word="Sample note"`. There is no header `ProvenanceChip` on the demo note.
- **`LoadFailure`, standalone:**
  - border `alpha(warning.main, 0.6)`, 1px solid, radius 12 (a panel);
  - glyph `WarningAmberOutlined` 20px in `warning.main`;
  - word 14px weight 600 in `warning.main`, which measures 4.91:1 on paper in light (`tokens.ts:54`);
  - cause 14px `text.secondary`;
  - spacing 8, 12 and 16 from the 4-pt ladder.
- **`LoadFailure`, in a frame:** no border, glyph or word of its own. The frame’s head `DataStateTag` (14px glyph, warn border) carries them. The body sits in the existing neutral message panel (`divider` border, no left edge). It keeps the ghost grid and the plot’s height, so the layout doesn’t shift (`ChartFrame.tsx:230-245`).
- **`RetryButton`:** `variant="outlined"`, neutral by ruling A, `minHeight: 44` at every pointer.
- **Filings detail actions:** “Open the filing” is the contained amber primary (the board’s `btn primary`), with the external-link mark. “Copy the command” is outlined and neutral, inside the disclosure.
- **For the author:** a native `<details>` with a 44px `<summary>` in `text.secondary`. Inside, buttons are outlined and neutral. It never mounts on the demo. Its open state follows Q6. As recommended, it is closed in a browser that has never opened it and remembers being open in that browser through `localStorage`. Every read and write sits in try/catch, and it falls back to closed when storage is unavailable.
- **Coming up rail (below 768):** `display: grid; grid-auto-flow: column; grid-auto-columns: 72%; overflow-x: auto; scroll-snap-type: x mandatory`. Cards keep `PANEL_SX` and are dashed on the demo (`ResearchIndexPage.tsx:584-594`). The rail is the only sideways scroller on the page.
- **Tab badges:** unchanged pill (`ResearchTabs.tsx:80-93`), with longer text on the Scorecard and visually hidden words on both.

**Staging note at 390×844, first screen:**

```
OVERVIEW  TECHNICAL  RESEARCH            All research →
NVDA   NVIDIA
       Nasdaq · AI chips
[Position · not stated] [9 min · 2 min skim] [▢ Sample note]   ← kind pill, the one header mark
A 55.6% net margin on a $45.0B quarter. At       ← h1, the headline
49.8 times annualized earnings, the price
assumes it holds.
NVIDIA’s deck paragraph …
┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐ ▒▒ hatch
┆ PRICE $199.17   MARKET CAP $4.78T ┆  ← metric row, dashed
┆ P/E 49.8×       NET MARGIN 55.6%  ┆
└┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
┌┄ Price against the value range ┄┐ ▒▒  ← valuation bar, dashed
┌┄ TL;DR · 30 seconds ┄┄┄┄┄┄┄┄┄┄┄┐ ▒▒
┌ About this note ┐                     ← demo only: directly after the TL;DR below lg
```

**`/research` at 390×844 (production):**

```
Notes 14 · Markets · Filings · Scorecard 77 open forecasts   (rail)
Research
Notes on the tickers being followed …
Coming up · next 10 weeks  [ƒ Computed]  ⓘ
When each note comes due for review.
┌──────────┐┌──────────┐┌───            ← rail (Q3), 99px tall, scrolls
│MSFT 6 d  ││Fed  6 d  ││AM
│FQ1-27 …  ││FOMC dec… ││Q3
└──────────┘└──────────┘└───
[ Find a ticker                    ]
[Current · 12] [Review due · 2]          ← Stance group hidden (all unset)
┌ first note card ┐                      ← top < 844
```

**Failure, Markets (standalone):**

```
┌──────────────────────────────────────────────────┐  1px warning.main @ 60%
│ ⚠  Couldn’t load · Rates and positioning          │  glyph + word in warning.main
│ Convexa’s server didn’t answer.                   │  text.secondary
│ The notes and the Scorecard don’t depend on it.   │
│ [ Try again ]                                     │  44px, outlined, neutral
└──────────────────────────────────────────────────┘
```

**Failure, in a chart frame:**

```
Coming up                                  [⚠ Couldn’t load]   ← title names the metric; head tag carries glyph + word
┌──────────────────────────────────────┐                      ← neutral panel on the ghost grid, no left edge
│ Convexa’s server didn’t answer.      │
│ Each note still lists its own dates. │
│ [ Try again ]                        │                      ← the frame’s action slot, 44px
└──────────────────────────────────────┘
```

**Boards.** The canon wins over the boards, and the boards are updated in the same part that changes the code, then regenerated with `node design/src/build.mjs`. Never hand-edit `design/canvas` or `design/site`.

- `design/src/chart-kit.mjs:136-140`: `.cstate.warn` loses the left edge; the frame head draws the warn tag (part A).
- `design/src/screens/final/ticker-note.mjs:117-136`: the staging note drawn in the note template, with the kind pill and no header chip (part C); the failure states (part A).
- `research.mjs`: the order, the rail and the For-the-author disclosure; the “Stance · your call” state at `:312` is retired (part B). The demo Expected section (`:196`) shows the two sample results under “Computed · from the notes” (part C). “Open the filing” is already the board’s primary and does not change.
- `research-spec.mjs` (part B).
- `ticker-tech.mjs:30-34`: the new series (part C).
- `planned-charts.mjs:216-221` and its demo title at `:228`: the demo check draws the sample 10-Q’s figures with no Differs row, and the title is `filedFinding`’s sentence for matching rows (part C). The production rows keep their Differs row.
- `ticker-desk.mjs:105-106` and `:229`, `account-pages.mjs:64-69`, and any board that quotes the Oct 6 close (Q2): recomputed once, after spec 03 (c) and part C (Coordination).

## Data and licence

- There is no new source and no new cost.
- Staging stays fully mocked: the sample notes, the series and the filings are authored seed data in the repo, and nothing is fetched.
- The only cross-build link points to a production note that is already public, the owner’s own writing, citing SEC filings. The SEC permits reuse, with credit requested (`docs/product/ai-analyst/SOURCES.md:88`).
- The filing-title words follow SEC’s form and item captions.
- The sample valuations’ tax assumption is the U.S. federal statutory rate, a public-domain fact.
- No licensed data reaches a public page.

## Acceptance criteria

1. **The staging note shows the real design.** On staging, at 1440×900 and 390×844, in dark and light, each of `/ticker/{AAPL,MSFT,NVDA,QQQ,SPY,TSLA}/research` passes four checks:
   - The h1 is the note’s headline and contains a figure.
   - `[data-testid="note-strip"]` has 4 or more cells.
   - `[data-testid="note-tldr"]` is present and titled “TL;DR · 30 seconds”.
   - Every single-name note (MSFT, NVDA, TSLA, and AAPL if Q1 = yes) shows `[data-testid="note-price-value"]`.

   `main`’s visible text has 0 matches of `/portfolio-2026-10-07-v1:[A-Z]+:\d{4}-\d{2}-\d{2}/` and 0 matches of `/\b\d+\.\d{4}\b/`.

   _Check:_ extend `tmp/ux-audit/spec-research-demo-and-states/probe.mjs` to both viewports and both schemes.
2. **Every note figure is drawn as sample.** On those pages, every `figure[data-provenance]` inside the note `article` reads `sample`. `[data-testid="note-strip"]` and `[data-testid="note-tldr"]` compute `border-style: dashed`. No `figure[data-provenance]` inside `main` holds a `[data-state="demo"]` tag (spec 01’s opt-in; this holds under either D1 draft). No element carries a live dot or pulse.

   _Check:_ Playwright `getComputedStyle`.
3. **The About link points to a published note.** The About card has one link whose `href` is exactly `https://convexa.pages.dev/ticker/NVDA/research`, with `target="_blank"` and `rel` containing `noopener`. At 390×844 the About card comes before the note’s first part in DOM order. The sentence at `DemoNoteSide.tsx:120-121` appears nowhere.
4. **The demo’s old note path is gone.** `git ls-files` lists no `ResearchView.tsx` or `DemoNoteSide.tsx`. `rg "ResearchView|DemoNoteSide|loadSampleResearch|SampleResearchCase|demoNoteFilings|sampleNoteAging|demoFigures" apps libs` finds nothing.
5. **One calendar on the demo.** On staging, `/research` Coming up, `/research/filings` Expected and the Markets “Coming up” frame all list TSLA’s results on Oct 22 and MSFT’s on Oct 29. The TSLA note’s “This note comes due” card lists Oct 22, and the MSFT note’s lists Oct 29. Filings Expected lists exactly those two, under “Computed · from the notes”. The text “carry no dated results” appears on no page.
6. **The sample series moves like a market.** For each staging card, read the 10 values from the chart’s accessible name:
   - The median |move| is between 0.5% and 3.0%.
   - The 10 values are not in ascending or descending order. Today all six are descending.
   - The Oct 7 close on each desk’s masthead is unchanged (SPY $690.62 … TSLA $476.03).

   _Check:_ `probe-bars.mjs`, and a load of `/ticker/SPY` on staging.
7. **The series is deterministic.** Two cold loads of staging `/ticker/NVDA/technical-analysis`, and one load after “Reset demo data”, give identical “Show the numbers” tables.
8. **NEXT lines lead with the note’s own trigger.**
   - On staging, the six cards’ NEXT lines, each compared whole (label and date, as rendered), are pairwise different, and none leads with “FOMC decision”. AAPL and NVDA share the label “Results, estimated from filing history” and differ by date.
   - Each card whose note is valued and whose own trigger falls after Oct 28 also shows “Before it: FOMC decision, Oct 28”. With Q1 as recommended, that is AAPL, MSFT and NVDA (the table in Behaviour).
   - On production, a card leads with “FOMC decision” only when `upcoming()` lists no other catalyst for its note: no dated catalyst in its front matter, and no estimated results window on the page’s loaded calendar. Kill and forecast dates do not count.

   _Check:_ `probe-next.mjs` on both builds, reading each production note’s catalysts from `virtual:convexa-research`’s index and the results windows from the page’s filings answer.
9. **Filing titles carry meaning.** On both builds, no row’s bold title equals the text of its form column. Every 8-K whose lead item is 2.02 reads “Results of operations”, 5.07 reads “Shareholder vote results”, and 1.01 reads “Material agreement”. The detail h2 equals the selected row’s title. Staging contains no “Demo sample filing”, and no seed description names a fiscal quarter.

   _Check:_ `probe-filings.mjs`, extended.
10. **Scorecard shows no author tools to readers.** On staging, the Scorecard shows neither “front matter” nor any “Copy row”. On production, in a fresh browser context, neither shows until a “For the author” summary is opened. Once it is opened, “Copy row” puts the row’s Markdown on the clipboard. Clipboard read is granted only in the test context, and this involves no form or network write.
11. **Filings spends amber on the board’s primary.** Run against a local live-mode build, with Playwright routing `/api/public-data/filings` to a fixture that holds one results 8-K filed after the TSLA note’s date. The fixture is a saved production answer with only that row’s `filed` moved, at `tmp/ux-audit/spec-research-demo-and-states/fixtures/filings-new.json`. With that filing selected:
    - “Open the filing” computes `background-color` equal to `primary.main`, and no other element on the page does.
    - “Copy the command” sits inside a `<details>` that is closed in a fresh context.

    No production page is touched by this check.
12. **No “your call” placeholders for readers.** On production, `/research` shows no “Filter by stance” group while every note’s stance is unset. No card, note header or variant cell contains “your call”. On staging, `/research` shows no “Filter by freshness” group while all six notes share one freshness state.
13. **The tab badges name what they count.** On both builds:
    - The Scorecard tab’s accessible name is “Scorecard, {n} open forecasts”, and its visible badge reads “{n} open forecasts”. Here n equals the “Open forecasts” figure on `/research/scorecard`, read in the same session.
    - The Notes tab’s accessible name is “Notes, {m} notes”. Here m equals the number of note cards on `/research`.
    - The probe’s `scorecardTabName` today reads “Notes14” and “Scorecard77 open”.
14. **Phone index puts a note on the first screen.** At 390×844, on both builds:
    - With Q3 answered “rail”, the first `article` top is under 844. With Q3’s alternative, it is under 900 (projected 824 to 876 on staging). Today it is 1371 on staging and 1426 on production.
    - The filter group’s bottom edge is within 48px above the first card.
    - `document.documentElement.scrollWidth === clientWidth`.
    - With Q3 answered “rail”, the Coming up rail scrolls sideways and, while it overflows, takes keyboard focus as a region named “Coming up, scrolls sideways” (`useScrollRegion`). With two or more cards at 72% each, it overflows.

    _Check:_ `probe-phone.mjs`.

    **Correction to the input:** the input’s target says “below 844”, but the intent is above the fold: y < 844.
15. **Failures follow the warning pattern.** Answer `/api/**` with 503 and `/assets/research-*.json` with 503 (`tmp/ux-audit/research-alerts/states.mjs`, fail mode, plus a staging run). Then check production Markets, Filings, `/ticker/MSFT/research` and `/ticker/NVDA/research`, and staging `/ticker/MSFT/research`. Every failed region (a `SourceProblem` panel, a chart frame in the message state, or the note’s failure panel) shows:
    - exactly one svg glyph whose colour computes to `warning.main`, beside the word “Couldn’t load”, or “Source down” for a source failure. In a chart frame both sit in the head tag;
    - a cause that does not contain “HTTP”;
    - exactly one “Try again” button, at least 44px tall at a fine pointer.

    The note pages’ h1 is the ticker. No element computes a 2px `border-left` in the warning colour. No failure container carries `role="alert"`; each carries `role="status"`.
16. **A stale tab is told to reload.** With `/assets/research-*.json` answered 200 `text/html` (`probe-stale-asset.mjs`), the note shows “This page is older than the site’s latest update. Reload to get the current notes.” with a “Reload” button. The text “Unexpected token” appears nowhere.
17. **Performance budgets hold.**
    - Staging note headline h1 visible: 1.2s or less, median of 3 cold loads at 1440. Today production `NoteView` measures 0.97–1.02s and staging `ResearchView` 0.98–1.49s (`states.json` timing).
    - Each `research-sample-*.json` is 45KB raw or less. Production notes are 57–73KB (`apps/dashboard/dist/assets`).
    - Production `/research` and its note pages request no `research-sample-*` asset and no sample chunk (network log).
    - `tools/check-dashboard-bundle.mjs` passes with its budgets unchanged.
18. **Typecheck, verify and the demo journey pass.** `npm exec nx run-many -t typecheck -p @convexa/dashboard,@convexa/api,dashboard-e2e`, `npm run verify` and `npx playwright test -c apps/dashboard-e2e/playwright.demo.config.ts` each exit 0. Checked with `echo $?`, not the printed summary.
19. **An unknown symbol on the demo is a quiet state.** On staging `/ticker/AMD/research`:
    - The h1 reads “No sample note on AMD.”
    - There are six links, to the six sample notes, plus “See all research”.
    - No element carries `role="alert"` or computes `warning.main` as its colour or border.
    - No button named “Retry demo”, “Retry” or “Try again” exists.
20. **The loading state keeps the h1.** With the note asset delayed by 3 s (Playwright route), on both builds, the h1 is the ticker throughout loading. The three skeletons render at their final heights (`NotesView.tsx:212-218`) and are replaced, not shifted, when the note arrives.
21. **Quiet states carry their tag.** On production Markets and Filings, every Off or Not set up panel holds a `[data-state="off"]` or `[data-state="notSetUp"]` tag with its svg glyph. No panel’s state is carried by its border alone.
22. **Sample notes agree with the desk and with their dates.**
    - Every desk level an Oct 7 sample note cites equals the figure the desk ladder shows for that symbol on `/ticker/{T}`.
    - Every close a note cites equals that date’s close in the Technical tab’s “Show the numbers” table.
    - The Sep 30 notes cite no figure dated after Sep 30.
    - On each company note with a sample 10-Q, `[data-testid="chart-filed-figures"]` checks the note’s own figures and shows no “Differs” row.

    _Check:_ a probe for the first, second and fourth. The third is a review check of the six files, recorded in the PR.

## Verification

This is risk-based, per `CLAUDE.md`. The change is UI, copy and authored seed data, so **no new tests**. The filing-title map is a closed copy lookup, not a parser. Proof is the observable checks above and the existing suites.

- **The sample notes’ validity is already enforced.** They compile through `loadNotes`, and an invalid note fails the build (`vite-plugin.mjs:38-40`). That is the check for the authored Markdown, including every valuation block’s required inputs (`valuation.mjs:52-62`).
- **Tests that encode removed behaviour are retired, each with a `RETIRED:` line** in `.spire/clusters/tech/state/RETIRED.md` (part C):
  - The research-evidence assertions inside the per-symbol test at `libs/api/src/lib/demo/transport.spec.ts:298-342`: the `loadSampleResearch` import, `researchTitles`, and `:314-342`, which check `EMA20` to 4 places and the 60 source IDs. The test and its loop stay, with spec 03’s coherence block (Coordination).
  - The `research.evidence` source-ID check in `catalog/catalog.spec.ts:47-53`.
  - `apps/dashboard/src/app/pages/research/reviewTriggers.spec.ts:185-230`, the `sampleNoteAging` block. The function is deleted, because the sample notes are now dated files that go through production’s `calendarTriggers` path, which the same spec file already covers. Its QQQ expectation, “gives every sample note the scenario’s FOMC” (`:206-207`), is the behaviour this spec removes, since funds are unvalued.
    - Its one silent-risk assertion moves, as an update: only the scenario’s calendar is read, never the Fed’s table (`:208-215`). It goes into a case on the new scenario-calendar helper.
- **Tests updated, not retired:**
  - `apps/dashboard-e2e/src/demo/demo-journey.spec.ts:318-381` (part C), rewritten against the new note anatomy:
    - QQQ: the h1 is its headline, and `[data-testid="note-tldr"]` is visible.
    - `portfolio-2026-10-07-v1:QQQ:` appears 0 times (it asserts exactly 2 today, `:319`).
    - The section rail and “The evidence” part are present. The checks for the “Evidence” region with 2 list items and “Source:”, and for the Risks and Invalidation headings (`:322-327`), go, because the published format names its parts differently.
    - NVDA (`:358`) and SPY (`:377`) wait for their new headlines.
    - Spec 03 edits `:143` and `:153` of the same file, so this part rebases on it.
  - `shared/charts/frame/frameTitle.spec.ts:16` and `pages/research/comingUp.spec.ts:222-229` (part A): the warn variant’s new shape, `state` and `cause` with no `text`. Both pin a rule that fails silently: P-10 and the calendar’s failure word.
  - `scanChange.spec.ts:12-15` (SPY 690.75 → 690.62, −0.02%), if Q2 lets the Oct 6 close move.
  - Any `flowSeed.spec.ts` or `transport.spec.ts` expectation that reads a bar other than Oct 7 (part C).

  These tests pin data derivations and contracts that can fail silently, which is the risk class they exist for.
- **Run in order, after `npm run ports:free`, checking each exit code with `echo $?`:**
  1. `npm exec nx test @convexa/api` and `npm exec nx test @convexa/dashboard`.
  2. Typecheck (AC 18).
  3. `npm run verify`. It runs `nx affected -t lint typecheck test` and gitleaks (`tools/verify.mjs:43`), and no browser suite. So it can pass while the demo journey is red.
  4. The demo journey: `npx playwright test -c apps/dashboard-e2e/playwright.demo.config.ts` (needs `npx playwright install chromium`). Parts B and C change pages it walks.
  5. `npm run check:bundle`.
  6. `node design/src/build.mjs` and `node design/src/verify-tokens.mjs`.
  7. Byte scans of this spec’s strings as they land in code: no straight apostrophe inside any new user-facing string literal, and no NUL byte in any touched file (`python3 -c "import io,sys;print(io.open(sys.argv[1],'rb').read().count(bytes([0])))" FILE`).
- **Re-run the audit probes:**
  - `tmp/ux-audit/research-alerts/probe-pos.mjs`, `probe-filings.mjs` and `states.mjs` (slow and fail);
  - this spec’s `probe.mjs`, `probe-phone.mjs`, `probe-next.mjs`, `probe-bars.mjs`, `probe-forms.mjs` and `probe-stale-asset.mjs`.

  For the run against unreleased code, first run `npm run ports:free`, then serve a demo-mode and a live-mode build locally. Use `localhost`, not `127.0.0.1`.
- **Perf, with numbers:** see AC 17. Measure 3 cold loads, take the median, and record the numbers in the PR body.

Nothing in this spec has been run against the change yet. The baselines above are measured; the targets are not.

## Build plan

Three parts, each its own PR and each green on its own: typecheck and `npm run verify` exit 0, plus the demo journey for parts B and C. Part A can land at any time after spec 02 (README, Build order, and why, step 4). Other specs edit many of the same files (spec 02 among them: `ChartFrame.tsx`, `MarketsPage.tsx`, `InsiderClusters.tsx`, `LatencyTrend.tsx`, `FiledFigures.tsx`, `FundHoldings.tsx`, `Peers.tsx`, `NotesView.tsx`, `NoteView.tsx`, `FilingsPage.tsx` and `ScorecardPage.tsx`). README, Cross-spec fixes, fix 9 has the full table; files several specs edit land in build order. Part B is independent of A, except that B1’s Scorecard disclosure sits beside the ledger failure A changes; whichever lands second rebases. Part C waits for spec 03 (c), part A (its note failure) and B3 (the NEXT rule its staging cards use). C2’s opt-in also needs spec 01 step 5, which waits on owner decision D1.

| Part · step | Work | Files likely touched | Size |
| --- | --- | --- | --- |
| **A1** | `LoadFailure`, `RetryButton` and `failureCause()`. `ChartStatus`’s warn variant takes `state` and `cause`, with no `text`. `ChartFrame` draws the warn tag in its head and `LoadFailure inFrame` in its body, with no left edge and `role="status"`. `SourceProblem` takes `state`, and quiet states gain their tag. Migrate the 11 `SourceProblem` sites, the 11 warn message sites and the 2 frame retry buttons (Coming up and the Filings figures frame; the four note panels keep their operator-note action). `NotesView` keeps the ticker h1 in loading and error. `notesData` classifies network, status, HTML and shape failures. The Scorecard’s failed sample ledger. Kit and states board. The two spec fixtures. | `shared/dataState/LoadFailure.tsx` (new), `publicUi.tsx`, `charts/frame/ChartFrame.tsx`, `frameTitle.ts`, `frameTitle.spec.ts`, `comingUp.ts`, `comingUp.spec.ts`, `ComingUpSection.tsx`, `MarketsPage.tsx`, `FilingsPage.tsx`, `FiledFigures.tsx`, `FundHoldings.tsx`, `InsiderClusters.tsx`, `Peers.tsx`, `NotePublicPanels.tsx`, `public-desk/PublicDesk.tsx`, `operator-metrics/LatencyTrend.tsx`, `NotesView.tsx`, `notesData.ts`, `ScorecardPage.tsx`, `design/src/chart-kit.mjs`, `ticker-note.mjs` (states board) | M |
| **B1** | Reader copy on production. The For-the-author disclosure (Scorecard, Filings, note sidebar), per Q6. Author slots hidden when empty. “Open the filing” becomes the primary and the draft command goes neutral. The filter-group rule. Both tab badges and their accessible names. | `ScorecardPage.tsx`, `FilingsPage.tsx`, `NoteView.tsx`, `blocks/Judgment.tsx`, `blocks/Valuation.tsx`, `ui.tsx`, `ResearchIndexPage.tsx`, `ResearchTabs.tsx`, `design/src/screens/final/research.mjs`, `research-spec.mjs` | M |
| **B2** | Filing titles from meaning, on both builds. Staging seed descriptions. B2 depends on no other step. AAPL’s two descriptions arrive with its rows in C2, if Q1 is yes. Spec 05’s Part A consumes this step. | `pages/research/filingTitle.ts` (new), `FilingsPage.tsx`, `DemoNoteSide.tsx` (until C2 removes it), `libs/api/src/lib/demo/public-data.ts` | S |
| **B3** | `/research` order at every width. The Coming up rail below 768, through spec 02’s `useScrollRegion` (spec 02 step 1), with its one-liner and ⓘ (Q3). The NEXT rule on both builds, catalysts only. Canon row for the rail (Q3). | `ResearchIndexPage.tsx`, `DESIGN_SYSTEM.md` (one Amendments row, after the owner’s answer), `design/src/screens/final/research.mjs` | S |
| **C1** | The sample series: the anchor, the backward walk with σ from HV, candles and holidays. One exported HV constant. Recompute the figures spec 03 and this spec both move, AAPL’s `iv_rank_band`, and the boards that quote them. Update seeded expectations; retire nothing here. | `libs/api/src/lib/demo/catalog/shared.ts` (the bar loop, `:210-230`), `transport.ts` (the three literal 23s, `:946`, `:947`, `:1507`), `workspace.ts` (AAPL’s decision, spec 03’s seed), `scanChange.spec.ts` (Q2), `flowSeed.spec.ts` and `transport.spec.ts` expectations, `design/src/screens/final/ticker-tech.mjs`, `ticker-desk.mjs`, `account-pages.mjs` and the boards quoting Oct 6 (Q2) | M |
| **C2** | The six sample notes and the sample output of the plugin. `NotesView` and `NoteView` get `source`, `today`, `calendar` and `sample`; the About card moves on a phone. `useNoteFrame` returns no provenance, so note frames take the board’s. `ResearchRoute` sends both builds through `NotesView`, and on the demo wraps it in spec 01’s opt-in (needs spec 01 step 5, which waits on D1). The sample treatment becomes one export, `sampleFrameSx`, used by `ChartFrame`, the strip, the TL;DR and spec 05. The sample index replaces `DEMO_NOTE_RESULTS`, `DEMO_NOTE_PRICED`, `SAMPLE_AGING`’s inputs and `demoNoteFilings`. The check frame reads the sample note’s own figures, and `demoFigures` goes. Funds unvalued. Ledger `OPEN` from the notes, with the claims rewritten. Staging cards from the sample index. Demo Expected. Filings selects a row from the URL fragment. AAPL joins the filers if Q1 is yes. Delete the dead code. Rewrite the journey’s research steps and retire the three test blocks. Spec 05 consumes this step. | `research/_sample/*/` (new), `tools/research-notes/vite-plugin.mjs`, `vite-plugin.d.mts`, `virtual-research.d.ts`, `app.tsx`, `NotesView.tsx`, `NoteView.tsx`, `blocks/noteFrame.ts`, `blocks/Figures.tsx`, `shared/charts/frame/sampleFrame.ts` (new), `shared/charts/frame/ChartFrame.tsx`, `shared/charts/frame/index.ts`, `shared/ui/Widget/WidgetProvenanceContext.tsx` (its doc comment names the note page as an opt-in site), `notesData.ts`, `reviewTriggers.ts`, `reviewTriggers.spec.ts`, `ResearchIndexPage.tsx`, `ComingUpSection.tsx`, `MarketsPage.tsx`, `FilingsPage.tsx`, `FiledFigures.tsx`, `ScorecardPage.tsx`, `sampleLedger.ts`, `libs/api/src/lib/demo/{calendar,research-ledger,types,views,transport,public-data}.ts`, `catalog/shared.ts` (narratives only), `catalog/catalog.spec.ts`, `transport.spec.ts`, `libs/api/src/index.ts`, `apps/dashboard-e2e/src/demo/demo-journey.spec.ts`, the removed files, `RETIRED.md`, `design/src/screens/final/ticker-note.mjs`, `ticker.mjs`, `research.mjs`, `planned-charts.mjs` | L |
| **C3** | Regenerate the boards. Run the verification list. Note the measurements in the PR. | `design/` (generated) | XS |

C1 comes before C2, because the back-dated notes cite Sep 30 closes from the new series. C2 fills the notes’ levels from spec 03’s seed, so spec 03 (c) must have landed.

## Open questions for the owner

1. **AAPL has no sample filings** (`public-data.ts:342-347`), so its note has no company figures for a valuation bar. Yet its results window is “estimated from filing history” (`calendar.ts:86-93`). Should AAPL join the sample filers?
   - **The contradiction to resolve first.** Joining `SAMPLE_FILERS` as it stands gives AAPL the shared calendar: a results 8-K filed Aug 27 for the quarter ended Jul 26 (`public-data.ts:400-402`). AAPL’s window is built from results filed Jul 30, May 1, Jan 29 and Oct 30 (`calendar.ts:87-92`). The filing list would then contradict the estimate it is supposed to support.
     - Aligning the window’s basis to Aug 27 instead would move AAPL’s window onto NVDA’s (Nov 18–20), so the two cards’ NEXT lines would be identical.
   - **Recommended: yes, with AAPL’s own dates.** AAPL’s rows would be a results 8-K filed Jul 30 and its 10-Q filed Jul 31, for the quarter ended Jun 27, 2026. Its periodic and annual-revenue rows would take its own period ends: a fiscal year ending in late September, fiscal Q3 FY2026.
     - This adds 2 rows to staging Filings. The vote 8-K is left out because an Apple-like meeting falls outside the 90-day window. AAPL’s note gets a valuation, and its estimated window then rests on a filing the demo lists.
     - No existing row moves, because the three current filers keep the shared calendar.
     - The cost: `demoPeriodic` and `demoAnnualRevenue` take per-company period ends for AAPL only (`public-data.ts:432-512`), and the Filings board loses its “AAPL has no filings” state.
     - The funds still show the not-a-company state.
   - **The alternative:** no. AAPL’s note has no valuation bar, and its window keeps a basis the demo never lists.
2. **Should the Oct 6 close move with the new series?**
   - **Recommended: let it move.** Pinning it keeps every card’s highlighted latest bar at −0.01% to −0.05% and every masthead at “−0.02%”.
   - Moving it changes the masthead day change and the scanner’s Chg %, one test (`scanChange.spec.ts:12-15`), and the board lines that quote 690.75 (`design/src/screens/final/ticker.mjs:58`, `ticker-desk.mjs:105-106`, `account-pages.mjs:64-69`, `account.mjs:60`).
   - The Oct 7 close and everything built on spot stay.
3. **Should Coming up become a sideways rail below 768px?** That needs a one-line Amendments row adding it to rule 17’s deliberate rails, as the Research tabs got on 2026-10-13. The alternative, “next 3 + All N” with two-line items, measures about 824px to the first card on staging with the Freshness group hidden, and about 876px with it shown, against an 844px target. AC 14 states both outcomes.
   - **Recommended: the rail.**
4. **The staging Markets drift chart loses its flagged note.** Today it draws NVDA flagged from `DEMO_NOTE_PRICED` (priced Jun 1). Priced on their note dates, the sample valuations all start from the sample 10-year of 5.15%. Keeping the old dates would hide the price line on three of four valuation bars (over 30 days old) and mark those notes Review due.
   - **Recommended: accept the change.** The flagged state stays drawn on the Markets states board.
5. **The ledger holds three open calls dated Oct 2, 5 and 6** (QQQ, SPY, TSLA). A note dated Oct 7 can’t carry them coherently, and in `NoteView` a passed forecast makes its note Review due.
   - **Recommended:** date those three notes Sep 30. Staging then shows Current on three notes and Review due on three, as production shows both today. Each of the three calls resolves on a bar the Technical tab shows and waits for scoring, which the Scorecard’s demo hint says (Copy).
   - **The alternative:** move the three dates past Oct 7. All six notes stay Current, and the Scorecard’s past-due list leaves the demo.
6. **Should the author tools on production sit behind a disclosure, and should it remember being open?** Production is the owner’s own tool, but its research pages are public and need no sign-in. The draft command is the owner’s next step on a new results filing. A disclosure that is closed on every load adds a click each time.
   - **Recommended:** a disclosure that is closed in a browser that has never opened it, and remembers being open in that browser (`localStorage`, try/catch, closed when storage is unavailable). The owner opens it once per browser. A reader on a fresh browser sees one closed line. The state never reaches the account and resets on a new device.
   - **The alternatives:** closed on every load, with no stored state (one click per visit for the owner). Or no disclosure, with the outlined neutral buttons shown to everyone (readers see author tools).
