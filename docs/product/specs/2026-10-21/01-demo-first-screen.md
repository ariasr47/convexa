# First screen on the demo: say what Convexa is, and say Sample once

_Proposal, 2026-10-21; revised 2026-10-22 after the skeptic pass. Kind: ux-polish. Size: M. Depends on: research-demo-and-states (spec 4), for criterion 12's `/research` and `/research/filings` ceilings only. Build steps 2 and 5 wait on owner questions Q2 and Q1 (the roadmap's D2 and D1), step 8 waits on both, and step 4's GitHub `href` waits on Q3 (Build plan)._

Code citations are to `main@e1bdc487`. Its app code is the same as `8ef735c4`. The audits read `791ebd88`. Commit `2cb4c8ef` has landed since, so the shell now supplies the sample board and a few lines have moved. This spec gives the current line numbers.

Numbers marked _probe_ were measured on 2026-10-22 against https://staging.convexa.pages.dev and https://convexa.pages.dev. The scripts are in `tmp/ux-audit/spec-demo-first-screen/` (scratch, gitignored):

- `baseline.mjs` → `baseline.json`: today's pages.
- Prototypes. These change the page's DOM in a headless browser to try out the proposed layout and copy, then measure it:
  - `proto-bar-hero.mjs`, `proto-once-v2.mjs` (this spec and spec 04's strings together), `proto-once-thisspec.mjs` (this spec alone).
  - From the revision: `rev-bar.mjs` (the bar with the gaps this spec states; exit 0), `rev-bar-phone.mjs` (phone variants that keep the glyph; exit 0), `rev-hero-grid.mjs` (the hero grid recipe on both builds; exit 0).
  - `proto-wide.mjs` and `proto-glyph.mjs` are superseded by the `rev-*` probes.
- Checks. These read the real DOM only, change nothing, and exit 0 only when their criterion holds. Today each exits 1:
  - `ac-bar.mjs` (criteria 1–3)
  - `ac8-hero.mjs` (criterion 8)
  - `ac13-frames.mjs`, with `ac13-frames.baseline.json` (criterion 13)
  - `frames.mjs` and `dialog-count.mjs`
- The skeptic's probes are in `tmp/ux-audit/review-demo-first-screen/`. Criterion 13 reuses `desk-research-frames.mjs`.

Production was only loaded and read: the prototypes changed its DOM in a local headless browser and sent nothing. Nothing was signed in or submitted on either site. On staging, the New alert dialog was opened and closed without saving.

## Why

The staging demo is the public portfolio. All four audits found the same thing on its first screen: there is no sentence that says what Convexa is, and the space goes to saying the data is a sample, over and over.

**1. The demo bar costs a phone screen and never names the product (SLT-08, TD-06, RA-02).**

- The bar is three caption items and the Reset button. They sit in a `Stack` whose direction is `{ xs: 'column', sm: 'row' }`, with spacing 0.5 and no separators (`shell/AppShell.tsx:148-194`, Stack at `:161-165`).
- At 390×844 the bar is 137px tall at y=0. The 57px nav sits under it, so 194px (23%) of the screen goes before any content. At 360 the bar is 157px (_probe_, `baseline.mjs`, `proto-bar-hero.mjs`).
- At 1440 the bar is one 61px row, but it runs on: "Demo · sample data Authored scenario · October 7, 2026 · no market feed connected Signed in as the demo account".
- No item says what the product does. A visitor who deep-links to `/ticker/SPY` never sees the landing's explanation (TD-06).
- Screenshots: `tmp/ux-audit/shell-landing-trust/shots/staging-phone-dark-landing.png`, `tmp/ux-audit/spec-demo-first-screen/shots/staging_phone_dark__research.png`.

**2. Each staging page says "sample" about thirty times before it says what it is (RA-02).**

First-viewport count of words starting with sample, demo, authored or scenario, case-insensitive. Method in Verification (_probe_, `baseline.mjs`; it matches the audit's `results.json`):

| Route | Staging 1440×900 | Staging 390×844 | Production 1440×900 | Production 390×844 |
| --- | --- | --- | --- | --- |
| `/research` | 31 | 22 | 2 | 0 |
| `/research/markets` | 19 | 14 | 2 | 0 |
| `/research/filings` | 31 | 16 | 2 | 0 |
| `/alerts` | 30 | 16 | 3 | 0 |

- At 1440, 7 of each staging count are chrome: 6 in the bar and 1 in the nav's "Demo account" (`features/auth/AccountControl.tsx:86-98`).
- The rest are repeats:
  - Page leads say what the data is not. `/research` opens "Sample research notes authored for the demo scenario, one per sample symbol." (`pages/research/ResearchIndexPage.tsx:799`). `/research/filings` opens "What the demo's sample companies filed" (`pages/research/FilingsPage.tsx:220`). `/alerts` adds "In the demo every kind, structure included, is a sample on the Oct 7 scenario." (`pages/alerts/AlertsPage.tsx:499`).
  - Header chips repeat the bar: "Demo · sample data" (`MarketsPage.tsx:124`, `FilingsPage.tsx:233`) and "Demo · sample notes · scenario of Oct 7, 2026" (`ResearchIndexPage.tsx:802-808`).
  - Every ChartFrame that takes its provenance from the shell's sample board is forced to show the "Demo · sample data" tag, whatever its own tag says (`shared/charts/frame/ChartFrame.tsx:91-94`, since `2cb4c8ef`). The frame is already dashed with the hatch stripe.
  - Each frame also carries a "Demo · shaped like …" source line, so a Markets chart says it twice.
  - Alerts puts a "Sample" tag on every enabled rule's row (`alertsUi.tsx:125`). The row's line repeats it: "Sample note · NVDA", "Sample filings · Oct 7 scenario" (`alertsUi.tsx:96-106`). The "On this page" legend says "Demo · sample data" and "Sample 7" (`AlertsPage.tsx:403-407`).
- `frames.mjs` (_probe_) finds 7 demo or sample tags inside `main` on `/research`, 9 on Markets, 2 on Filings and 16 on Alerts. Where they sit (`review-demo-first-screen/frames-rerun.mjs`, `ac13-frames.mjs`):
  - On the first three pages, each sits in a dashed, hatched frame or in an unframed header. The unframed headers are Coming up, whose tiles are dashed with no hatch, and Rates today, whose strip is dashed with no hatch.
  - On Alerts:
    - 2 sit in the legend.
    - 6 sit on rule rows in the solid "Your alerts" panel.
    - 7 sit in the solid "What each kind watches" table.
    - 1 sits in the dashed, hatched Fired panel.
- Screenshots: `tmp/ux-audit/research-alerts/shots/staging_research_desk_dark_fold.png`, `staging_markets_phone_light_fold.png`, `staging_alerts_desk_dark_dialog.png`.

**3. The landing describes the live product, not the demo, and its labels mislead (SLT-03, SLT-06, SLT-07, SLT-04).**

- **No mention of options up front.** The chip reads "Dealer-gamma analytics · free ticker, no account" and the H1 reads "See the dealer positioning behind the price." (`pages/landing/copy.ts:38-39`). Neither says options. On staging the chip says "no account" right under a bar that says "Signed in as the demo account".
- **The AI copy describes the live product.** The H2 "A risk-first read, on your own key, grounded in the structure." and the trust card "The AI read runs on your own key…" render on both builds (`copy.ts:100`, `:126`). Staging needs no key, and its reads are pre-written (`ctaDemo.body`, `copy.ts:144`).
- **The secondary button's label is wrong.** It reads "How it’s built" (`copy.ts:43`) and opens `/methodology` (`Landing.tsx:330-359`). That page's H1, and the footer, both call it "How Convexa works" (`shell/Footer.tsx:46`).
- **The samples claim to be SPY and contradict the desk.** All three illustrative sample titles name SPY: `StructureFieldSample.tsx:35`, `ScoreStripSample.tsx:46`, `AiReadSample.tsx:30`. Their levels (put wall 560, flip 568.5, call wall 580; `samples.ts:14-24`) disagree with the staging SPY desk the primary button opens (704.02 / 683.92 / 652.22, canon ruling (3) of 2026-10-14, `DESIGN_SYSTEM.md:278`). They also differ from the hero's illustrative levels (555 / 571 / 590, _probe_). This spec removes the symbol and leaves the values (Non-goals).
- **On a phone the hero is off the first screen.** Its stage starts at y=935 on staging and y=929 on production at 390×844 (_probe_). The footnote sits between the buttons and the hero, at 40px on staging and 100px on production (_probe_, `proto-bar-hero.mjs`).

**4. Nothing says who built it (SLT-03).**

- Footer.tsx has no author or source link. The footer ends "© 2026 Convexa. All rights reserved." (`Footer.tsx:108-114`). `Rodrigo` appears nowhere in `apps/dashboard/src`.
- The owner's GitHub profile is already public on `/privacy` (`pages/trust/PrivacyPage.tsx:30`). The repository is public (`gh api repos/ariasr47/convexa`: `visibility: public`, 2026-10-22).
- The engineering post, "How Convexa Is Built" (`docs/blog/posts.json`, tag Engineering), is two clicks deep. Every route to it says methodology:
  - the footer link "Blog — how we read structure" (`Footer.tsx:56`)
  - the index H1 "How we read structure" and the intro "the longer form of the Methodology page" (`pages/blog/copy.ts:8-11`)
  - the post's own line "Blog · How we read structure" (`BlogPostPage.tsx:223`)
- So the staging author line links the post directly. Renaming the blog is split out (Non-goals).

**5. One state, two components (RA-13).**

- "Demo · sample data" renders as a mono `ProvenanceChip` in page headers (`MarketsPage.tsx:124`, `FilingsPage.tsx:233`). In sections it renders as a `DataStateTag` with its glyph (`MarketsPage.tsx:380`, `FilingsPage.tsx:623`).
- Step 1 of the New alert dialog shows 12 "Sample" tokens on staging: 6 chips that read "Sample · shaped like …" (`NewAlertDialog.tsx:438-441`), each beside a "Sample" `StateTag` (`:443`) (_probe_, `dialog-count.mjs`). The same pair appears at `NewAlertDialog.tsx:1253-1258` (review step) and at `AlertsPage.tsx:1010-1015`, `:1101-1111` and `:1133-1145`.
- The note's Sources host column cuts host names on production (`pages/research/blocks/Record.tsx:679`, `:688-700`; 86 of 472 hosts at 1440, `sources-clip.mjs`). That is a production layout bug, not a demo first-screen one, and it is split out (Non-goals).

**Corrections to the input**

- The bar is at `AppShell.tsx:148-194`, not `:147-191`; `2cb4c8ef` added an import. The other moved lines are `MarketsPage.tsx:124`/`:380` (not `:126`/`:384`), `FilingsPage.tsx:623` (not `:624`) and `NewAlertDialog.tsx:443` (not `:444`).
- **"The avatar already says it" is only half true.** On a phone the avatar shows the initial "D", with the accessible name "Account settings". The name "Demo account" is hidden below 600px (`AccountControl.tsx:86-95`) and appears in the drawer (`shell/TopNav.tsx:472`). From 600px up the nav shows "Demo account" beside the avatar. So "Signed in as the demo account" repeats the nav at sm and up, and the drawer on a phone. This spec drops it at every width.
- **The brief's bar wording cannot meet the brief's word target.** With "Sample scenario · Oct 7, 2026 · no market feed connected", the chrome alone counts 6 at 1440: "Demo · sample data" (2), "Sample scenario" (2), "Reset demo data" (1) and the nav's "Demo account" (1). With every other fix in place, the four pages measure 6, 8, 7 and 8 (_probe_, `proto-once-v2.mjs`, "brief" rows). This spec uses "As of Oct 7, 2026" instead. The chrome then counts 4, and the pages measure 4, 6, 5 and 6. See Q2.
- **"On the live site the read runs on your own key" is false today.** Production has no options feed. Its bar says "Dealer structure, flow and AI reads need a paid options feed." (_probe_). The staging trust card says "With a live options feed" instead.
- TD-06 asked for Reset in a menu on a phone. The phone drawer already has "Reset demo data" (`TopNav.tsx:518-522`). The bar keeps a 44px "Reset", as the brief says.
- Spec 04 owns some of the words the input counted (Scope, Coordination). After this spec alone, `/research` is at 8 and `/research/filings` at 20. Both reach the target once spec 04's seed copy lands.

## Who and when

- **A recruiter or reviewer on staging, on a phone, from a link in a CV.** In the first ten seconds they need to learn three things: what Convexa is, that this is a demo on sample data (said once), and who built it. Today the first screen of every route spends 194px on a four-line provenance bar. On a deep link to the desk or to Research, no line names the product.
- **The owner on production.** Production's first screen changes in three small ways:
  - The hero's second button reads "How it works".
  - The three sample titles drop "SPY".
  - Below 1100px, the hero comes before its footnote.

  No production ruling changes.

## Scope and non-goals

**In scope**

- The staging demo bar, which every staging route shares, desk included (`AppShell.tsx:148-194`, `ResetDemoControl.tsx`).
- The landing (`pages/landing`): `copy.ts`, `Landing.tsx`, the three sample titles, and the hero's place below 1100px.
- The staging footer's author line (`shell/Footer.tsx`).
- On staging, the lead sentence of `/research`, `/research/markets`, `/research/filings` and `/alerts`, and their page-level provenance: header chips, the "On this page" legend, frame tags, and row tags.
- The New alert dialog's duplicate tags.
- The demo seed strings that feed those chips and rows: `libs/api/src/lib/demo/public-data.ts:262`, `:277` and `:285`, and `alerts.ts:25` and `:95`.
- The final design boards for these surfaces, plus one canon Amendments row (Q1, Q2).

**Non-goals**

- **The desk, Scanner and Positions (spec 3).** The ticker desk hierarchy is approved as built and is not touched. The desk gets only the shared bar.
  - The desk's own `WidgetProvenanceProvider` (`TickerDashboard.tsx:1022`) and its Widget tags stay as they are.
  - **The desk's Research tab is the desk's too.** On staging, `/ticker/:symbol/research` renders six board-default ChartFrames, each tagged demo: short interest, insider clusters, filed figures, revenue as filed, fund holdings and peers (`ResearchView.tsx:34-66` → `SecRecordSections.tsx:18-21`; `review-demo-first-screen/desk-research-frames.mjs`). They keep that tag in this spec. The ChartFrame change is an opt-in on the three Research pages only (Behaviour). Spec 04 replaces that page with the sample note and sets the same opt-in there (spec 4, Build plan › C2; Coordination below).
  - The desk still says "Authored scenario · October 7, 2026 · no market feed connected" at `TickerDashboard.tsx:1328`, `pages/scanner/format.ts:386` and `ticker/research/ResearchView.tsx:334`. Spec 3 takes the bar's new wording for the first two (spec 3, Copy, the rows "Desk 'About this sample'" and "Scanner sample banner"). Spec 4 deletes `ResearchView.tsx` (spec 4, Build plan › C2).
- **No production ruling changes.** The sign-in wall stays on `/scanner` and `/positions`. There is no demo mode on production. The production chip, CTA band, bar, footer and leads are unchanged. That includes the straight apostrophe in "hasn't" in the `/research/filings` lead (`FilingsPage.tsx:221`).
- **Hiding the hero's keyboard help line on touch is spec 2's (SLT-05; spec 2, Behaviour › (d) Keyboard and focus, and its criterion 20).**
- **Below-the-fold copy that already says sample once, inside a dashed frame, stays.** One example is the Markets "Coming up" finding (`ComingUpSection.tsx:134`).
- **The Markets page-foot disclaimer is not touched here.** On staging it already reads "Demo · sample data shaped like the Federal Reserve’s, … files; nothing on this page is a real observation." (`MarketsPage.tsx:249-252`). Spec 7 rewrites that string to add the OFR, and its draft opens "Sample data shaped like …" (spec 7, Copy › Page disclaimer).
  - It is a plain `<p>` at the page foot. So it is below the first viewport criterion 12 counts, and it is no `[data-state]` tag for criterion 13.
  - Under Q1 the bar is the page's one "Demo · sample data", and today's line repeats it until spec 7 lands. Whether the line opens "Sample data" or keeps "Demo · sample data" as an exempt page-foot line is decided with Q1 and Q4.
- **The sample notes' content, the sample series, the card freshness tags, filing titles and descriptions, and Filings "Expected" belong to spec 04.**
- **The landing samples' values stay** (`samples.ts:14-24`, put wall 560, flip 568.5, call wall 580). They still differ from the hero's illustrative levels (555 / 571 / 590). Once the titles drop SPY, neither claims to be a real symbol's structure, and each carries an "illustrative" chip. Aligning the two would touch `samples.ts` and all three sample renders. It is out of scope here.
- **Split out to a separate small fix spec (not yet written).** Neither is a first-screen change on the demo:
  - **The note Sources host wrap.** This is production only: Why §5 and `sources-clip.mjs`, with 86 of 472 hosts cut at 1440 and 79 of 443 at 768. The fix is `Record.tsx:679-700`.
  - **Naming the blog plainly.** The changes are the footer link, the index H1, eyebrow and intro, the empty body, and the post line (`BlogPostPage.tsx:218-225`, span at `:222-224`). The evidence is Why §4.

**Coordination with specs 03, 04 and 05**

- **Spec 03 Q2** recommends one Amendments row: the shell's demo bar is the page's one "Demo · sample data", and page-level slots yield to it. This spec applies the same rule to Research and Alerts.
  - The two drafts differ on one point. Spec 03's text has a sample frame name the sample exactly once: in its head (a title that begins "Sample", or its Sample tag), or by a source chip anywhere in the frame (head, foot or a row) that begins "Sample" or "Demo" (spec 3, Open questions for the owner › 2). A frame whose source chip already does that gets nothing more under either draft, wherever the chip sits. Further source chips in it are not extra marks, because a chip that names a source keeps naming it (Behaviour › Research and Alerts on staging: say Sample once). Fired is such a frame: its one chip sits in its row. So the drafts differ only on frames with no source line: spec 03's text gives each one word in its head. Its reason is that the border and hatch never reach the accessibility tree.
  - This spec's frames with no source line are these: Coming up, the six sample cards, the Rates today strip, the Filed feed, Detail and "Your alerts". Coming up counts once: its section has no frame of its own and its tiles are dashed and hatched, so under spec 03's text its one word sits in the section's head, where its demo tag is today, not on each tile.
  - Q1 puts both texts to the owner as one question. Either way it ends as one shared row.
- **Spec 04 keeps this spec's `/research` lead.** This spec owns the four leads. Spec 04 keeps this spec's first sentence and changes only the second, once the sample notes take the published format (spec 4, Copy › Other strings, "Index lead (demo)").
- **Demo Expected reads "Computed · from the notes"**, as production does (spec 4, Behaviour › `/research/filings`). The list is computed from the notes on both builds. The "Sample · from the sample notes" tag spec 04 first proposed would repeat the bar under Q1 and put `/research/filings` at 7.
- **The Coming up sentence.** This spec rewrites its demo wording (Copy). Spec 04 narrows "for every note" to production's "for every note with a valuation", and the FOMC tile's line to "every valued note", without adding a sample word (spec 4, Copy › Other strings, "Coming up lead (demo)").
- **ChartFrame's tag logic.** Spec 04 also edits `ChartFrame.tsx:91-94`: a warn status puts the warn state in the head (spec 4, Build plan › A1, and Behaviour › `/research/markets` (failure states only)). The two compose:
  - Spec 04's warn tag shows in any state.
  - This spec only removes the forced demo tag, on pages that opt in.
  - Whichever lands second rebases onto the other.
- **The desk's Research tab** (`/ticker/:symbol/research`) is spec 04's page. This spec leaves its frame tags alone (Non-goals).
  - Spec 04's C2 replaces the page with the sample note. On the demo it sets this spec's ChartFrame opt-in (Behaviour) to `false` around `NotesView` when `source="sample"`, so board-default frames under the note lose the forced tag (spec 4, Build plan › C2).
  - Without that, those frames keep "Demo · sample data" beside the note's kind pill.
  - The opt-in ships in this spec's step 5, which waits on Q1. That part of C2 waits on step 5 too.
- **The remaining `/research` and `/research/filings` words are in spec 04's strings.**
  - The sample-note thesis lines: `catalog/shared.ts:80`, `:95`, `:110` (spec 4, Build plan › C2).
  - The filing descriptions, "Demo sample filing" (`public-data.ts:395`; spec 4, Build plan › B2).
  - The Expected sentence (`FilingsPage.tsx:130`), which spec 04 deletes (spec 4, Behaviour › `/research/filings`).
  - Acceptance criterion 12 is written so it holds before and after spec 04.
- **Spec 05** draws a staging section on `/ticker/NVDA/research`, directly under the sample note's header and above its figure strip (spec 5, Behaviour › Where it sits). Its staging tags are set in spec 5, Who and when (the reviewer), Behaviour › States (the "Sample (staging)" row), Design › Frame and Heading, and Acceptance criteria › 1. The row decides them:
  - Both Q1 texts give rows inside a frame no Sample tag, so spec 05's lines carry none either way.
  - Neither text lets the heading say "Demo · sample data", because the bar is the page's one.
  - Under this spec's text the heading carries no tag. The frame keeps its dashed border, its hatch and its "Scenario · Oct 7, 2026" sub line.
  - Under spec 03's text the heading carries one Sample word.
  - Which of those two holds waits on Q1. If the owner declines the row, spec 05 keeps the tags it drew without it: "Demo · sample data" on the heading and Sample on every line.

## Behaviour

### The demo bar (staging, every route)

- **When it renders.** It renders when `dataMode === 'demo' && playback` (`AppShell.tsx:148`), as today. Production renders `MarketDataNotice` and is unchanged.
- **Layout.**
  - The bar's inner row takes `MarketDataNotice`'s column: max width 1240, centred, one flex row that wraps (`MarketDataNotice.tsx:97-106`).
  - It does not take that row's gaps. Its **column gap is 6px and its row gap is 0**.
  - Each separator is its own `aria-hidden` span holding only "·", with no spaces. The 6px gap spaces it.
  - Why not MarketDataNotice's gaps: its 12px column gap and 4px row gap wrap the wide row to 85px at 1000 and 1024 (`review-demo-first-screen/wide-gap.mjs`).
- **From 600px up (sm+).**
  - The row reads, in order: the demo glyph, "Demo · sample data" (bold), "·", the framing sentence, "·", "As of Oct 7, 2026 · no market feed connected", then "Reset demo data" at the row's right end.
  - **The row is one line from 1100px up, 61px tall.** That held at 1100, 1280 and 1440, in both schemes (_probe_, `rev-bar.mjs`).
    - The seven items take 945px. The row also measured one line from 999px, but with only 6px to spare at 999, 7px at 1000 and 31px at 1024.
    - That margin is too thin to promise across font renderers. Below 1100 the row may wrap.
  - From 600 to 998px it wraps to two lines, 81px (_probe_, row gap 0). Today it is 81px at 600–899 and 61px from 900.
  - When the row wraps, Reset stays at the right end of its line. Use `margin-left: auto` on Reset, not a spacer box. With that, Reset sat at the row's right edge at every width from 600 to 1440 (_probe_, `rev-bar.mjs`). In an earlier probe a spacer let Reset fall to the left of line two.
- **Below 600px (xs).**
  - One line, in this order:
    - the demo glyph
    - "Demo · sample data" (bold)
    - "·"
    - "Oct 7, 2026"
    - a trailing text button that reads "Reset", whose accessible name stays "Reset demo data" (`aria-label`)
  - **The glyph stays at every width.** P-2 pairs each state word with a glyph (`DESIGN_SYSTEM.md:275`).
  - The line uses the canon phrase and does not name the product. The nav's CONVEXA wordmark sits 6px under the bar (`shell-brand` top at 51px under a 45px bar, _probe_, `rev-bar-phone.mjs`), so "Convexa" in the bar would repeat it. And "Convexa demo · sample data · Oct 7, 2026" with the glyph wraps at 360 (65px, 4px short).
  - **The fit.** One line, 45px, at 320, 360, 375, 390 and 414, both schemes. The spare room is 6px at 320, 46px at 360 and 76px at 390 (_probe_, `rev-bar-phone.mjs`, variant `canon+2026`). At 320 a wider-rendering font may wrap it to two lines (65px). Either way there is no cut text and no sideways scroll.
  - The bar has no vertical padding at xs, so the 44px button sets its height. The bar is 45px including its 1px border.
- **Removed at every width:** "Authored scenario · October 7, 2026 · no market feed connected" and "Signed in as the demo account".
- **Paused and ended playback keep their current strings and controls** (`AppShell.tsx:176-190`).
  - The paused state still shows "Retry demo".
  - Playback pauses only on a storage fault (`libs/api/src/lib/demo/workspace.ts:55-60`) or a failed scenario load (`:105-112`). It ends when the 30-minute scenario has played: 360 one-second ticks of 5 s each, about 6 minutes, while a page observes it (`:27`, `:63-70`). Hiding the tab does not pause it.
  - In these states the row may wrap to a second line at any width. The 48px phone limit applies only while playback runs.
- **Reset** keeps its confirmation popover, its focus return and its copy (`ResetDemoControl.tsx:47-94`). Only the bar's label shortens at xs.
- **Scrolling.** The bar still scrolls away, and the nav stays sticky. Nothing becomes sticky.
- **It stays the single page-level provenance.** It carries "Demo · sample data" and its as-of, the rule-18 demo exception (`DESIGN_SYSTEM.md:174`, Amendments 2026-10-07).

### Landing (`/`)

- **Staging chip:** "Options analytics desk · demo account, sample data". This replaces both SLT-03's and SLT-06's proposals. The production chip is unchanged.
- **Staging AI section:** a new H2 and a new third trust card (Copy). Both are demo variants in `copy.ts`, next to `hero.footnote` and `ctaDemo` (`copy.ts:44-49`, `:141-147`). Production keeps `aiRead.h2` and `trustCards[2]`.
- **Hero secondary button:** "How it works" on both builds. It still goes to `/methodology` (AC-L9's one-click proof path; `Landing.tsx:330-359`, and `cta-methodology` at `:430-441`).
- **Sample titles,** on both builds: "Net dealer gamma by strike", "Triage score" and "AI read". They have no symbol and no suffix. The chip beside each already says "illustrative": "Demo · illustrative sample" on staging and "Illustrative sample" on production (`copy.ts:66-69`). The values in `samples.ts` stay (Non-goals).
- **The hero grid.** The footnote moves below the panel under 1100px. From 1100 up it keeps today's place and geometry.
  - **The move.** The footnote leaves the copy `Stack` (`Landing.tsx:361-363`) and becomes the hero grid's third item, after the panel (`:367`). It takes `data-testid="hero-footnote"`, `maxWidth: 600` and `justifySelf: 'start'`. That keeps its width as today: shrink-to-fit, up to the Stack's 600.
  - **Below 1100 (one column):** DOM order is copy, panel, footnote. The grid keeps its xs gap of 5 (40px).
  - **From 1100 (`laptop`):**
    - The grid keeps `gridTemplateColumns: '1.05fr 1fr'` (`Landing.tsx:211-218`).
    - It gains `gridTemplateRows: 'auto auto'`, a `columnGap` of 6 (48px) and a `rowGap` of 2.5 (20px, the Stack's spacing).
    - The copy Stack sits in column 1, row 1, with `alignSelf: 'end'`.
    - The footnote sits in column 1, row 2, with `alignSelf: 'start'`.
    - The panel sits in column 2 across both rows, with `alignSelf: 'center'`.
    - The left column is then exactly the Stack's old height, so the panel and the copy centre as they do today.
  - **Measured** (_probe_, `rev-hero-grid.mjs`, exit 0, both builds, both schemes):
    - At 1280, 1440 and 1920 the stage top stays 252.
    - At 1100 it stays 268 on staging and 299 on production.
    - The gap from the buttons to the footnote stays 20px, and the footnote's box width is unchanged.
    - Below 1100 the stage moves up 40px on staging and 80px on production (1024, 768).
    - At 390×844 the stage top is 784 on staging with the new bar and 810 on production. The baselines are 935 and 929. The same holds at 360.
  - **Why not the first draft's grid:** a footnote in column 1, row 2, under the grid's 48px gap and `alignItems: 'center'`, moved the stage to 261 on staging and 266 on production at 1440. It also put the footnote 48px from the buttons (`review-demo-first-screen/hero-grid.mjs`).
- **The landing reads no session fact and makes no request.** It stays that way (AC-L17, `Landing.tsx:13-17`). The new strings are constants.

### Footer (staging)

- **One new caption line above the copyright line:** "Built by Rodrigo Arias · How it’s built · GitHub ↗".
  - "How it’s built" is a router link to `/blog/how-convexa-is-built`, the engineering post.
  - "GitHub ↗" opens in a new tab with `rel="noopener noreferrer"` and the ↗ mark, following `PrivacyPage.tsx:144-154`. Its `href` is Q3's answer.
  - The links use the footer's existing link style (`Footer.tsx:28-34`), or spec 2's `standaloneLinkSx` (spec 2, Behaviour › (b) Touch floor) if spec 2 lands first.
- **Production's footer gets no author line and is otherwise unchanged.** Renaming the blog is split out (Non-goals).

### Research and Alerts on staging: say Sample once

The rule (Q1, shared with spec 03 Q2):

- The bar is the page's one "Demo · sample data".
- Page-level slots yield to it. That means a header chip that only states the demo, and the "On this page" legend.
- A sample frame always has the dashed border and the hatch stripe (P-3, P-8). Beyond that it carries at most one word: its source line ("Demo · shaped like …") where it has one. A frame with no source line carries no word. Q1 puts spec 03's alternative to the owner.
- Rows and cards inside a frame carry no Sample tag. A row's divider line is not a frame.
- A chip that names a source keeps naming it.
- Every other state word stays: Off, Couldn’t load, Not set up.
- Reference content is not sample data. "What each kind watches" describes the alert kinds, so its frame stays solid.

Per route, with each frame that held a demo or sample tag and its target treatment. Criterion 13 measures exactly these:

- **`/research`.**
  - The lead describes the tool (Copy).
  - The header chip "Demo · sample notes · scenario of Oct 7, 2026" is removed (`ResearchIndexPage.tsx:802-808`).
  - **Coming up** drops its "Demo · sample data" heading tag (`:561-563`). The section itself has no frame.
    - Each tile (`ol > li`, `:586-590`) keeps its dashed border and gains the 8px hatch stripe. That is the same `::before` block `Panel` draws (`alertsUi.tsx:215-229`).
    - Its sentence loses the sample words (`:569`), and the FOMC tile's due line reads "every note" (`:751`).
  - **The six sample cards** (`article`) drop their "Sample" tag (`:235`). They are already dashed and hatched (_probe_, `frames.mjs`), and spec 04 gives them freshness tags.
  - The card chart caption reads "last 10 sessions" (`:159`).
- **`/research/markets`.**
  - The lead gets a staging variant (Copy). Its production words, "from public sources, refreshed each business day" (`MarketsPage.tsx:119-121`), are false on a fully mocked build. Production's lead is unchanged.
  - The "Demo · sample data" header chip is removed (`:124`).
  - The two source chips read "Demo · shaped like …". This is the form the frames on the same page already use (`:70`, `:1458`). The strings come from the demo transport (`public-data.ts:262`, `:277`, `:285`).
  - **Rates today** drops its demo tag (`:380`). Its read strip (`section[aria-label="Rates today"]`, wrapper at `:389`) gains the hatch stripe beside its dashed border.
  - **The chart frames** drop the forced demo tag (ChartFrame, below). They keep the dashed border, the hatch and their "Demo · shaped like …" source line.
- **`/research/filings`.**
  - The lead gets a staging variant that describes the tool (Copy). Production's lead is unchanged, byte for byte.
  - The "Demo · sample data" chip is removed (`:233`).
  - The EDGAR chip reads "Demo · shaped like SEC EDGAR · Oct 7" (`:236-240`).
  - **The Filed feed** (`section[aria-labelledby=feed-h]`), **Detail** (`section[aria-labelledby=filing-detail]`) and **the figures frame** drop their demo tag (`:347-349`, `:623`, `:981-982`). They are already dashed and hatched (_probe_). The figures frame keeps `couldntLoad` when it fails (`:978`).
- **`/alerts`.**
  - The lead keeps `ALERTS_LEAD` and swaps the demo sentence (`AlertsPage.tsx:497-502`).
  - The "On this page" legend does not render on the demo (`:403-407`). Production's legend is unchanged.
  - **"Your alerts"** becomes a sample panel on the demo: dashed with the hatch, using the existing `sample` prop (`AlertsPage.tsx:589-591`, `alertsUi.tsx:185-230`).
    - Its rule rows keep their 1px `divider` top rule. That is a list divider between rows, not a frame, so criterion 13 measures the panel, not the rows.
    - An enabled rule's row shows no state tag on the demo. This is a new branch: today `state: null` renders "Checking…" (`alertsUi.tsx:86-93`), so "no tag" must not reuse it. A switched-off rule still shows "Off".
    - The row line drops "Sample" (`alertsUi.tsx:96-106`, Copy). The seeded flip rule's note becomes "Watch the flip" (`libs/api/src/lib/demo/alerts.ts:25`).
    - The suggestions, shown when no rule is left, sit inside this panel. On the demo, the `StateTag` beside each "Sample · shaped like …" chip does not render (`AlertsPage.tsx:1010-1015`).
  - **Fired** keeps its dashed, hatched frame and drops its head tag (`AlertsPage.tsx:642-645`).
    - Its row keeps the chip "Sample · shaped like CFTC TFF" as the frame's one word.
    - The seeded detail drops "sample report" (`alerts.ts:95`).
    - The note under it is reworded so it holds for zero, one or many firings (`:667-670`, Copy). On staging, a desk records structure firings too (`TickerDashboard.tsx:633` → `useAlerts.ts:104-121`).
  - **"What each kind watches"** (`:626`) is the exempt reference table. It stays a solid frame.
    - On the demo its fourth column goes. The "In the demo" header (`:1078-1080`) does not render, and neither does the state cell of each kind's row (`:1107-1112`) or of the structure row (`:1144-1146`). Each of those cells holds only a `StateTag`.
    - The table has 3 columns on staging and 4 on production.
    - Its source chips keep "Sample · shaped like …", because they name a source.
- **New alert dialog.** On the demo, step 1 drops the `StateTag` beside each "Sample · shaped like …" chip (`NewAlertDialog.tsx:438-443`). That takes step 1 from 12 "Sample" tokens to 6. The review step does the same (`:1253-1258`). On production each tile keeps its chip and its state tag.
- **ChartFrame, on the three Research pages only.** Today, on a sample board, a frame given no `provenance` shows the demo tag in every state, whatever its call site passes (`ChartFrame.tsx:91-94`). On `/research`, `/research/markets` and `/research/filings` that changes:
  - **The frame drops the forced demo tag.**
    - If the call site passes a tag whose kind is `warn` or `quiet`, the frame shows it (`shared/dataState/vocabulary.ts:28-51`). Those are Last good copy, Source down, Couldn’t load, Not set up, Off, Paused, Not live and Sign in. Examples are LiquiditySection's `lastGood` (`LiquiditySection.tsx:124-129`) and any failure state.
    - A passed `solid`, `dashed` or `dotted` tag, such as Updated or Computed, still never shows on a sample board, as today.
  - It keeps the dashed border, the hatch stripe and its source line.
  - **The mechanism is an opt-in the page sets, not a new default.**
    - `WidgetProvenanceContext.tsx` gains a second boolean context, default `true`: on a sample board, the frame names the sample.
    - The three Research pages set it to `false` around their content on the demo. ChartFrame reads it beside the board.
    - Its provider is exported, so another page can set it. Spec 04 sets it on the sample note page (Coordination; spec 4, Build plan › C2).
    - The doc comments at `ChartFrame.tsx:6-8` and `:73-74` and `WidgetProvenanceContext.tsx:1-7` change with it.
  - **Everywhere else the forced tag stays.** That covers the desk and its tabs (`/ticker/:symbol/*`, including the six Research-tab frames in Non-goals, until spec 04's C2 replaces that page with the sample note, which opts in), `/research/scorecard`, `/positions` and `/scanner`.
  - **Frames that pass `provenance` explicitly are unaffected:**
    - the landing samples
    - the Technical tab's sample chart
    - the Scorecard's `SignalsSample`
    - Markets' frame at `MarketsPage.tsx:1901-1907`
    - Filings' figures frame (`FilingsPage.tsx:975`), whose demo tag this spec removes at its call site (`:981-982`)

### States

| State | Staging (demo) | Production |
| --- | --- | --- |
| Loading | On the three Research pages, board-default frames show their ghost and the dashed, hatched border, with no tag (today: the "Demo · sample data" tag in every state). Elsewhere unchanged. The bar renders once `playback` is known, as today. | Unchanged |
| Empty | Empty copy unchanged except the strings in Copy. | Unchanged |
| Error | On the three Research pages a board-default frame shows a passed `warn` or `quiet` tag (Couldn’t load, Source down, Last good copy, Not set up, Off…); only the forced demo tag goes. Frames that pass explicit failure tags keep them (Filings figures `couldntLoad`). Elsewhere unchanged. Spec 04's shared failure component, `LoadFailure` (spec 4, Build plan › A1), is unaffected. | Unchanged |
| Sample (staging) | As described above | n/a |
| Not live (production) | n/a | Unchanged. The production bar, the Not live tags and the "On this page" legend stay |
| Signed out | n/a: staging is always signed in to the demo account | Unchanged, including the sign-in wall on `/scanner` and `/positions` |
| Playback paused or ended | The bar keeps today's strings and controls; it may wrap. | n/a |
| Phone width | One-line bar, 45px, glyph kept. Hero before footnote. Leads as on desktop. | Hero before footnote. Nothing else |

## Copy

The voice follows `DESIGN_SYSTEM.md`: plain words and short sentences. New strings use ’ (U+2019), matching `copy.ts`. Every state word comes from the closed list (`shared/dataState/vocabulary.ts:32-51`). This spec adds no state word. The bar keeps the canon phrase "Demo · sample data" at every width. Its as-of wording is Q2.

**Demo bar**

| Width | Now | New |
| --- | --- | --- |
| ≥600 | **Demo · sample data** · Authored scenario · October 7, 2026 · no market feed connected · Signed in as the demo account · Reset demo data | [glyph] **Demo · sample data** · Convexa is an options desk: dealer positioning, SEC filings and research notes. · As of Oct 7, 2026 · no market feed connected · Reset demo data |
| <600 | the same four items, one per line | [glyph] **Demo · sample data** · Oct 7, 2026 · Reset (accessible name "Reset demo data") |
| paused / ended | Simulated playback paused. Showing the last sample. · Retry demo / Sample playback complete. Showing the last sample. | unchanged |

The "·" between items is an `aria-hidden` span with no spaces. The "·" inside "As of Oct 7, 2026 · no market feed connected" is text.

**Landing**

| Key | Build | Now | New |
| --- | --- | --- | --- |
| `hero.chip` → new `hero.chipDemo` | staging | Dealer-gamma analytics · free ticker, no account | Options analytics desk · demo account, sample data |
| `hero.secondary` | both | How it’s built | How it works |
| `aiRead.h2` → new `aiRead.h2Demo` | staging | A risk-first read, on your own key, grounded in the structure. | A risk-first read, grounded in the structure: here, written for the sample day. |
| `register.trustCards[2].body` → new demo body | staging | The AI read runs on your own key, pins to a snapshot, and cites what it used. Figures it could not trace render in body type. You confirm every paper trade. | With a live options feed, the read runs on your own key, pins to a snapshot, and cites what it used. Here every read is written for the sample day. Figures it could not trace render in body type. You confirm every paper trade. |
| sample titles | both | Net dealer gamma by strike · SPY / Triage score · SPY / AI read · SPY | Net dealer gamma by strike / Triage score / AI read |

**Footer**

| Where | Build | Now | New |
| --- | --- | --- | --- |
| footer, new line | staging | (none) | Built by Rodrigo Arias · How it’s built · GitHub ↗ |

**Research and Alerts (staging only)**

Each staging lead describes the tool. None states a fact that only live data could make true, such as "filed", "from public sources" or "refreshed". Production's leads are unchanged.

| Where | Now | New |
| --- | --- | --- |
| `/research` lead (`ResearchIndexPage.tsx:799`) | Sample research notes authored for the demo scenario, one per sample symbol. Each opens with its thesis, evidence and what would change it. | Research notes on the tickers Convexa follows. Each opens with its thesis, the evidence and what would change it. |
| Coming up sentence (`:569`) | In the sample: each sample note’s results date, the scenario calendar’s FOMC decision for every sample note, and results windows estimated from sample filing history. Each date is when its note comes due for review. Scenario of Oct 7, 2026. | Each note’s results date, the FOMC decision for every note, and results windows estimated from filing history. Each date is when its note comes due for review. As of Oct 7, 2026. |
| FOMC tile due line (`:751`) | every sample note | every note |
| card chart caption (`:159`) | Daily close change, % · last 10 sample sessions | Daily close change, % · last 10 sessions |
| `/research/markets` lead (`MarketsPage.tsx:119-121`), new demo variant | Rates, positioning and the money behind them, from public sources, refreshed each business day. The 10-year on this page is the risk-free rate every note's valuation starts from. | Rates, positioning and the money behind them, shaped like the public sources Convexa reads each business day. The 10-year on this page is the risk-free rate every note’s valuation starts from. |
| `/research/filings` lead (`FilingsPage.tsx:220`) | What the demo's sample companies filed, newest first. A results or quarterly filing the note hasn't read makes it due. | How Convexa lists each followed company’s SEC filings, newest first. A results or quarterly filing the note hasn’t read makes it due. |
| EDGAR chip (`:238`) | Sample filings, shaped like SEC EDGAR · Oct 7 | Demo · shaped like SEC EDGAR · Oct 7 |
| rates source (`public-data.ts:277`) | Demo sample (shaped like U.S. Treasury daily par and real yield curves) | Demo · shaped like U.S. Treasury daily par and real yield curves |
| futures source (`:285`) | Demo sample (shaped like CFTC Traders in Financial Futures) | Demo · shaped like CFTC Traders in Financial Futures |
| liquidity source (`:262`) | Demo sample (shaped like Fed H.4.1, Treasury DTS and NY Fed reverse repo) | Demo · shaped like Fed H.4.1, Treasury DTS and NY Fed reverse repo |
| `/alerts` demo sentence (`AlertsPage.tsx:499`) | In the demo every kind, structure included, is a sample on the Oct 7 scenario. | Every kind can be set up here, structure included. |
| rule lines (`alertsUi.tsx:97-105`) | Checks the sample tape · Sample note · NVDA · Sample filings · Oct 7 scenario · Sample Form 4s · Oct 7 scenario · Sample report · as of Tue Oct 6 · Sample settlement · Sep 30 | Checks while a ticker desk is open · Note · NVDA · Filings · Oct 7 · Form 4s · Oct 7 · Report · as of Tue Oct 6 · Settlement · Sep 30 |
| seeded flip note (`alerts.ts:25`) | Watch the authored sample flip | Watch the flip |
| seeded firing detail (`alerts.ts:95`) | +2.70M contracts net, sample report, positions as of Tue Oct 6 | +2.70M contracts net, positions as of Tue Oct 6 |
| Fired note (`AlertsPage.tsx:669`) | Alerts never fire in the demo on their own; this firing is part of the scenario. Nothing here was published by a source. | Each firing here comes from the sample day: one is seeded with it, and structure alerts fire while a ticker desk is open. Nothing here was published by a source. |
| kinds table, fourth column header (`AlertsPage.tsx:1079`) | In the demo | (column not rendered on the demo) |

**Notes on the Research and Alerts strings:**

- **The Markets lead's second sentence holds on staging.** The demo's notes read the sample 10-year on each valuation date (`libs/api/src/lib/demo/calendar.ts:114-115`).
- **The Fired note holds for zero, one or many firings.** One firing is seeded (`alerts.ts:88-103`; seed version 1 had none). The desk adds structure firings while it is open.

## Design

Everything reuses existing tokens and components. Nothing comes from the Banned list (`DESIGN_SYSTEM.md:211-233`).

- **Bar.**
  - `background.paper` with a 1px `divider` bottom border, as today.
  - Caption type. "Demo · sample data" is weight 700 in `text.primary`. Everything else is `text.secondary`.
  - Column gap 6px, row gap 0. The separators are `text.secondary` spans that hold only "·" and are marked `aria-hidden`.
  - The glyph is `CropFreeOutlined` at 14px in `text.secondary`, the demo state's glyph (`DataStateTag.tsx:35-36`). It shows at every width and is `aria-hidden`. This matches the final board's demo notice, which draws the sample icon (`design/src/lib.mjs:596`).
  - Reset is the neutral text button by ruling A (`ResetDemoControl.tsx:41-43`), `minHeight: 44` (rule 7). At xs its visible label is "Reset", and `aria-label` keeps "Reset demo data", so the visible label begins the accessible name.
- **No amber is added.** The landing's one contained primary stays the only amber action (ruling A, `DESIGN_SYSTEM.md:284`).
- **The P-8 sample frame:** a 1px dashed `textTertiary` border plus the 8px `hatch` stripe, as `ChartFrame` and the alerts `Panel` draw it (`alertsUi.tsx:215-229`).
  - The Rates today strip and each Coming up tile gain the stripe. They copy `Panel`'s `::before` block; they need no new token.
  - Spec 04's C2 moves this treatment into one export, `sampleFrameSx`, beside `ChartFrame` (spec 4, Design › Sample treatment; Build plan › C2). This spec lands before it, so it copies. The tiles and the strip may switch to `sampleFrameSx` later.
  - "Your alerts" takes the existing `sample` prop.
- **The hero grid** uses the existing spacing scale: `rowGap` 2.5 and `columnGap` 6 at `laptop`, and the xs gap of 5 as today.

Sketches (not to scale):

```
1440, staging
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⌗ Demo · sample data · Convexa is an options desk: dealer positioning, SEC filings and        │
│   research notes. · As of Oct 7, 2026 · no market feed connected           Reset demo data   │  61px, one row
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ CONVEXA  Scanner Ticker Research Positions Alerts     [Jump to a ticker or note ⌘K]  Demo account (D) │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
(the sentence is one line at 1440; it wraps in this sketch only)

390, staging                         390, landing below the nav (both builds)
┌───────────────────────────────┐     chip
│ ⌗ Demo · sample data ·        │     H1
│   Oct 7, 2026          Reset  │ 45  sub-line, spine
├───────────────────────────────┤     [ Open the Ticker → ] / [ See the full demo → ]
│ CONVEXA          (D)  🔍  ≡   │ 57  [ How it works ]
└───────────────────────────────┘     ┌ hero panel ┐  ← top edge in the first screen
(one line on the device)              footnote

1100 and up, both builds (grid rows)
┌ col 1, row 1: chip, H1, sub, buttons (alignSelf end) ┐ ┌ col 2, rows 1–2 ┐
├ 20px row gap                                          ┤ │ hero panel      │
└ col 1, row 2: footnote (alignSelf start)              ┘ └ (centred)       ┘
```

## Data and licence

No new tool, source or request.

- The landing still makes no request (AC-L17).
- The footer line adds two links and nothing else.
- The name and the GitHub profile are the owner's own. The profile is already public on `/privacy`, and the repository is public.
- Staging stays fully mocked. The changed seed strings are authored copy in `libs/api/src/lib/demo`.
- Production shows no new data.

## Acceptance criteria

Each check names its script under `tmp/ux-audit/` (scratch), or a manual step. "Both schemes" means dark and light. Light is set the way `research-alerts/audit.mjs:184-188` sets it. The `ac-*.mjs` checks read the real DOM only, and exit 0 only when their criterion holds.

1. **The phone bar is one line.**
   - On staging at 390×844 and 360×800, both schemes:
     - `[data-testid=demo-provenance]` is ≤48px tall (baseline 137 and 157; probe 45).
     - Its text reads "Demo · sample data · Oct 7, 2026", then a button that reads "Reset" and whose accessible name is "Reset demo data".
     - The demo glyph renders.
     - No element in the bar overflows its box, and the page has no sideways scroll.
   - At 320×800 the bar is ≤65px with the same text, with no cut text and no sideways scroll.
   - Check: `ac-bar.mjs`. Today it exits 1, and all 14 of its rows fail.
2. **The wide bar names the product.**
   - On staging, both schemes, at 1100×900 and 1440×900, the bar is one row, ≤61px.
   - At 768×1024 and 1024×768 it is ≤81px; two rows are allowed.
   - It reads "Demo · sample data · Convexa is an options desk: dealer positioning, SEC filings and research notes. · As of Oct 7, 2026 · no market feed connected", then "Reset demo data". The glyph comes first, and Reset sits at the right end of its row.
   - Check: `ac-bar.mjs`, and a screenshot at 1024 and 1440.
3. **The old bar lines are gone.** On staging at 390, 768 and 1440, "Signed in as the demo account" and "Authored scenario" appear nowhere in the bar. Check: `ac-bar.mjs`.
4. **Playback lines are unchanged.** On staging:
   - **Paused.** On `/ticker/SPY`, make `localStorage` throw: redefine `window.localStorage` with a throwing getter, as `demo-journey.spec.ts:463-475` does. Then click "Reset demo data" and confirm.
     - The bar shows "Simulated playback paused. Showing the last sample." and a "Retry demo" button.
     - Reset still opens "Reset the demo?".
   - **Ended.** Keep a ticker desk open through the roughly 6-minute playback, or fast-forward a Playwright clock 360 ticks, as `demo-journey.spec.ts:508-524` does. The bar shows "Sample playback complete. Showing the last sample."
   - Check: the demo e2e journey (Verification 5) asserts both strings at those lines and must keep doing so. Then check by hand on staging after the deploy. Hiding the tab does not pause playback.
5. **Landing copy.** On staging, the hero chip reads "Options analytics desk · demo account, sample data", and the AI section's H2 and third trust card read as in Copy. On production the chip, H2 and trust card are byte-identical to today. Check: page text.
6. **The hero's second button.** On both builds, `[data-testid=cta-secondary]` reads "How it works" and its `href` is `/methodology`.
7. **Sample titles.** On both builds:
   - The three sample frames' titles read exactly "Net dealer gamma by strike", "Triage score" and "AI read".
   - None contains "SPY" or "illustrative".
   - The chips still read "Demo · illustrative sample" on staging and "Illustrative sample" on production.
8. **The hero.** Both builds, both schemes:
   - At 390×844, `[data-testid=gamma-surface-hero]` top is <844 (baseline 935 on staging and 929 on production; probe 784 and 810). `[data-testid=hero-footnote]` sits below the stage.
   - At 1440×900 the stage top is 252 ±2px. At 1100×900 it is 268 ±2 on staging and 299 ±2 on production, as today.
   - At both widths the footnote's top is 20 ±1px under the secondary button's bottom, as today.
   - Check: `ac8-hero.mjs`. Today it exits 1: the four 390 rows fail, and the 1440 and 1100 rows pass.
9. **Who built it.**
   - On staging, the footer shows "Built by Rodrigo Arias · How it’s built · GitHub ↗". "How it’s built" navigates to `/blog/how-convexa-is-built`. "GitHub ↗" has `target="_blank"`, `rel="noopener noreferrer"` and the agreed `href` (Q3).
   - On production, no footer line contains "Built by", and the footer's text is byte-identical to today.
10. _Moved out: blog naming (Non-goals). This number is kept so later numbers don't shift._
11. **Leads.**
    - On staging, before spec 04 part C, the four leads read as in Copy.
    - After spec 04 part C, the `/research` lead keeps Copy's first sentence, and its second is spec 04's "Each opens with a 30-second summary." (spec 4, Copy › Other strings, "Index lead (demo)"). The other three leads still read as in Copy.
    - Either way, none contains sample, demo, authored or scenario. None contains "filed", "from public sources" or "refreshed".
    - Production's four leads are byte-identical to today. That includes the straight apostrophe in "hasn't" on `/research/filings`.
    - Check: page text.
12. **Sample said once.** Counted at 1440×900 and at 390×844, both schemes, with the Verification method:
    - **Sample-word ceilings.**

      | Route | 1440 ceiling | 1440 probe (this spec alone) | 1440 baseline | 390 ceiling | 390 probe |
      | --- | --- | --- | --- | --- | --- |
      | `/research/markets` | ≤6 | 6 | 19 | ≤4 | 4 |
      | `/alerts` | ≤6 | 6 | 30 | ≤4 | 2 |
      | `/research` | ≤6 after spec 04 | 8 | 31 | ≤4 | 2 |
      | `/research/filings` | ≤6 after spec 04 | 20 | 31 | ≤4 after spec 04 | 10 |

    - **Which draft.** These ceilings are for this spec's draft of Q1 (D1). Under spec 03's draft, each frame with no source line adds its one head word, and the ceilings are recounted; which set applies waits on D1.
    - **Before spec 04 lands,** every match left on `/research` and `/research/filings`, beyond the chrome and one source chip, is in a string spec 04 replaces. Those are the sample-note thesis lines, the filing descriptions ("Demo sample filing") and the Filings Expected sentence. With those replaced, the probe measures 4 and 5 (`proto-once-v2.mjs`). Until then those rows are recorded as pending, not as failures.
    - **Production:** the counts stay at 2, 2, 2 and 3.
    - Check: `baseline.mjs` (`firstViewportCount`, `firstViewportText`). The probe columns come from `proto-once-thisspec.mjs`. The revised copy here changes no counted word in a first viewport. The phone bar's bold run counts 2, as before. The new leads and the Fired note keep the same counts.
13. **One mark per frame.** On staging:
    - **No demo tags, and the sample marks D1 sets.** `main` on the four pages holds no `[data-state=demo]`, under either draft. Under this spec's draft (Q1) it also holds no `[data-state=sample]`. Under spec 03's draft it holds exactly one mark on each frame with no source line instead, Coming up's at its section head (README, Owner decisions › D1), and `ac13-frames.mjs` checks that form. Which form applies waits on D1. The baseline is 7, 9, 2 and 16.
    - **Each named frame has its target treatment.**
      - These are dashed with the hatch stripe:
        - the Coming up tiles (`section[aria-labelledby=coming-up] ol > li`; baseline dashed, no hatch)
        - the sample cards (`main article`)
        - the Rates today strip (`section[aria-label="Rates today"]`; baseline dashed, no hatch)
        - every chart frame (`main figure[data-provenance]`)
        - the Filed feed (`section[aria-labelledby=feed-h]`)
        - Detail (`section[aria-labelledby=filing-detail]`)
        - "Your alerts" (`section[aria-label="Your alerts"]`; baseline solid)
        - Fired (`section[aria-label="Fired"]`)
      - "What each kind watches" (`section[aria-label="What each kind watches"]`) is solid with no hatch.
      - The rule rows are not measured. Their top rule is a list divider inside "Your alerts".
    - **The kinds table** has 3 columns on staging and 4 on production.
    - **Out-of-scope routes are unchanged.** Staging `/ticker/NVDA/research` and `/ticker/TSLA/research` still show 6 frames each with `data-state=demo`. This holds until spec 04's C2 lands. C2 replaces that page with the sample note and sets the opt-in there (Coordination), so from then on this check no longer applies.
    - **Production is unchanged.** Its state keys on the four pages match `ac13-frames.baseline.json`, in order.
    - **A board-default frame given a `warn` or `quiet` tag still shows it.** Review this in the ChartFrame diff; no staging route produces one on demand.
    - Check: `ac13-frames.mjs` and `review-demo-first-screen/desk-research-frames.mjs` (read its output). Today `ac13-frames.mjs` exits 1 with 8 failures: 3 frames, tags on all 4 pages, and the kinds table's 4 columns.
14. **Dialog step 1.**
    - On staging, step 1 of the New alert dialog holds 6 "Sample" tokens (baseline 12) and no `[data-state=sample]` (baseline 6). Its 6 chips still read "Sample · shaped like …".
    - On production, each tile still shows its chip and its state tag.
    - Check: `dialog-count.mjs`. On production, open the dialog and do not save.
15. **Source chips.** On staging, no text reads "Demo sample (" or "Sample filings, ". The Markets header chips read "Demo · shaped like …".
16. _Moved out: Sources wrap (Non-goals). This number is kept so later numbers don't shift._
17. **No sideways scroll.** At 320, 360 and 390, every touched route has `document.documentElement.scrollWidth === innerWidth`.
18. **Gates pass.** `npm run typecheck` and `npm run verify` exit 0, and the updated demo e2e journey exits 0 (Verification).

## Verification

This is risk-based, per `CLAUDE.md`. The change is copy, layout and authored seed strings. It touches no money, auth, data write, parser or contract, so **no new tests**. Proof is the observable checks above.

**Measurement method (criterion 12)**

- Text nodes count when their parent element has width >0, is not `visibility: hidden`, and has its top in [0, innerHeight).
- Measure after `networkidle` plus 1.5 s.
- Match with `/\b(sample|demo|authored|scenario)/gi`.
- Do not cap the text length. The audit's `audit.mjs` capped it at 1800 characters, which leaves staging's numbers unchanged but can undercount production.

**Runs**

1. **Bring the scripts.** The check scripts live in gitignored `tmp/`, so a build lane in a fresh worktree does not have them.
   - Copy `tmp/ux-audit/spec-demo-first-screen/` and `tmp/ux-audit/review-demo-first-screen/desk-research-frames.mjs` into the same paths in the lane's worktree.
   - They import `@playwright/test` from the repo's `node_modules`, so they must run from inside the repo.
2. **Check the local builds, one at a time.** Both modes write `apps/dashboard/dist`.
   - Run `npm run ports:free -- 4317` first, so a stale server can't answer (the orphaned-server trap in `CLAUDE.md`).
   - **Demo build.**
     - Build it: `npm run build:dashboard:demo; echo $?` (must print 0).
     - Serve it: `node apps/dashboard-e2e/tools/serve-dist.mjs apps/dashboard/dist 4317 localhost https`.
     - Run `STAGING_BASE=https://localhost:4317 node ac-bar.mjs; echo $?`, then `ac8-hero.mjs` and `ac13-frames.mjs` the same way.
     - Set `ENVS` and `STG` at the top of `baseline.mjs`, `frames.mjs` and `dialog-count.mjs` to the local base, then run them. Check each exit code.
   - **Live build.**
     - Stop the server, then build it: `npm run build:dashboard; echo $?`.
     - Serve it the same way, and run the checks with `PROD_BASE=https://localhost:4317`.
     - A static serve answers no `/api/health`, so the live build's notice may take a different form from the deployed one. Take production's criterion 8 and 12 numbers from the deployed site (run 3).
3. **After the owner deploys,** re-run the same scripts against staging and production, with no base override. Also re-run the brief's scripts at 390 and 1440, both schemes:
   - `tmp/ux-audit/shell-landing-trust/verify.mjs` (bar height, hero top)
   - `tmp/ux-audit/research-alerts/audit.mjs` (first-viewport text)
4. **Gates.** Run `npm run typecheck; echo $?` and `npm run verify; echo $?`. Both must print 0. Vitest does not typecheck, so a green test run is not enough.
5. **The demo e2e journey.** Update the existing copy assertions in `apps/dashboard-e2e/src/demo/demo-journey.spec.ts`:
   - `:64` and `:315` expect "October 7, 2026" today. They now expect "Oct 7, 2026".
   - `:63` stays as it is. The bar still contains "Demo · sample data".
   - `:65` expects "Demo account" in `[data-testid=account-email]` (`AccountControl.tsx:89`, visible at 1440) instead of "Signed in as the demo account" in the bar.
   - The paused (`:463-482`) and ended (`:508-524`) steps stay unchanged. They cover criterion 4.
   - Then run `npx playwright test -c apps/dashboard-e2e/playwright.demo.config.ts; echo $?`. It needs `npx playwright install chromium`.
6. **Hygiene.**
   - Format only the touched files: `npx nx format:write --files <a>,<b>`. Never run a bare `nx format:write`.
   - Byte-scan every touched file for NUL. Each must print 0:
     `python3 -c "import io,sys;[print(f, io.open(f,'rb').read().count(bytes([0]))) for f in sys.argv[1:]]" <files>`
7. **Design source.** Run `node design/src/build.mjs; echo $?` (exit 0). Then check that `git diff --stat design/canvas design/site` lists only the boards this spec touched.

**Performance:** no new request, no new dependency and no new motion. The landing route gains only string constants (well under 1 KB gzipped). Bundle budgets are unchanged.

## Build plan

| Step | What | Files | Size |
| --- | --- | --- | --- |
| 1 | **Demo bar layout.** The 1240 column, a 6px column gap and a 0 row gap, separator spans, the glyph at every width, the xs line with no vertical padding, and Reset at the row's end. `ResetDemoControl` takes an optional short visible label and keeps "Reset demo data" as its name. **Not blocked.** | `shell/AppShell.tsx:148-194`, `shell/ResetDemoControl.tsx:19-46` | S |
| 2 | **Demo bar copy.** The framing sentence, "As of Oct 7, 2026", and the two removed lines. Update the e2e assertions (Verification 5). **Blocked on Q2.** | `shell/AppShell.tsx`, `apps/dashboard-e2e/src/demo/demo-journey.spec.ts:64-65,315` | S |
| 3 | **Landing.** Demo copy variants, "How it works", the sample titles, and the hero grid recipe with `data-testid="hero-footnote"`. Refresh `copy.ts`'s header note, which still calls "How it’s built" pinned (`copy.ts:4-12`). **Not blocked.** | `pages/landing/copy.ts`, `Landing.tsx:211-367`, `StructureFieldSample.tsx:35`, `ScoreStripSample.tsx:46`, `AiReadSample.tsx:30` | S |
| 4 | **Staging footer line.** The `href` waits on Q3; the rest is not blocked. | `shell/Footer.tsx` | S |
| 5 | **Say Sample once.** The ChartFrame opt-in, header chips, legend, row tags, the panel's `sample` prop, the Coming up and Rates hatch, the kinds table's column, and the dialog tags. The opt-in's provider is exported, because spec 04's C2 sets it on the sample note page. **Blocked on Q1.** The four leads, the Fired note and the rule lines can land before Q1, because they hold under either answer. | `shared/charts/frame/ChartFrame.tsx:6-8,73-94`, `shared/ui/Widget/WidgetProvenanceContext.tsx`, `pages/research/ResearchIndexPage.tsx`, `MarketsPage.tsx`, `FilingsPage.tsx`, `pages/alerts/AlertsPage.tsx`, `alertsUi.tsx`, `NewAlertDialog.tsx` | M |
| 6 | **Demo seed strings.** Coordinate with the workflow now editing `libs/`. Spec 04 edits other lines of `public-data.ts`. | `libs/api/src/lib/demo/public-data.ts:262,277,285`, `alerts.ts:25,95` | S |
| 7 | **Final boards, then regenerate.** Leave the v2/v4 history boards as they are: add a final-kit variant rather than editing `v4Notice`/`v4Footer` in `lib.mjs`, which the v4 boards share. Find every final site by grepping `design/src/screens/final` for the old strings. Also correct the paused-bar note's "or a hidden tab" to "a storage fault or a failed scenario load" (`shell-site-front.mjs:38`). Each board follows its step, and the strings behind Q1 and Q2 wait for those answers. | `design/src/screens/final/shell-site-front.mjs:35-40,62,71,76`, `shell-site-kit.mjs:228,232,236`, `research.mjs:143`, `account-pages.mjs:191,201` | S |
| 8 | **Canon.** After Q1 and Q2, append one Amendments row, shared with spec 03 Q2; spec 05 follows it. The row carries spec 4's kind-pill clause (spec 4, Scope › Coordination): the demo note's "Sample note" pill stays. This step owns the row. Spec 03's commit (d) needs it, and appends it only if this step has not landed (spec 3, Build plan › 4. (d)), so it is appended once. Never edit the 2026-10-07 row. | `.spire/clusters/tech/context/DESIGN_SYSTEM.md` | S |
| 9 | **Verify** (Verification 1–7), then report the measured numbers with their exit codes. | `tmp/ux-audit/spec-demo-first-screen/*` | S |

**Order.**

- Steps 1, 3 and 4 can start now. Step 4's GitHub `href` waits on Q3.
- Step 2 waits on Q2.
- Step 5 waits on Q1, except its leads, Fired note and rule lines.
- Step 8 waits on both Q1 and Q2.
- Step 5 needs step 6 for the chip strings.
- Spec 04's C2 needs step 5's opt-in for the sample note page (Coordination).
- Step 7 follows the code it draws.
- Criterion 12's `/research` and `/research/filings` ceilings pass only after spec 04 lands.

## Open questions for the owner

1. **One "Demo · sample data" per page, on Research and Alerts too, and what a frame must still say.**
   - **The proposed row.** The demo bar is the page's one "Demo · sample data", with its as-of. Page-level slots yield to it: header chips that only state the demo, and the "On this page" legend. The demo note's kind pill, "Sample note" (D-21's tag, in the note header's kind slot), is not a header chip that only states the demo, and it stays. A sample frame keeps its dashed border and hatch, plus at most its source line. Rows and cards inside a frame carry no Sample tag. Reference tables, such as "What each kind watches", are not sample frames.
   - On staging this supersedes D-19's per-frame tag (`design/src/screens/final/tracker-data.mjs:225`). It goes beyond P-3's "Sample tag" for sample data inside the live site, which keeps applying on production.
   - **The question to decide.** On long pages, once the bar has scrolled away, is the dashed border with the hatch enough for a frame that has no source line? Those frames are Coming up (counted once, at its section head, for all its tiles), the six sample cards, the Rates today strip, the Filed feed, the sticky Detail panel, and "Your alerts". Spec 03 Q2 proposes that each keep one word in its head, because the border and hatch never reach the accessibility tree.
   - **Recommended: yes, border-only, as written here.**
     - Staging never mixes sample and live data, so a per-frame word tells nothing apart.
     - The bar's `role="status"` "Demo · sample data" comes first in the DOM on every page.
     - The tradeoff: a screen-reader user who jumps straight to a heading deep in the page hears no "sample" there.
     - Under spec 03's text, each of those frames regains one word, Coming up once at its section head. On `/research` at 1440 that is up to 4 more in the first viewport: the Coming up head and three sample cards. Criterion 12's ceilings would be recounted to match. Criterion 13's "no `[data-state=sample]`" would become "exactly one mark on each frame with no source line" (README, Owner decisions › D1).
     - Either answer is one shared row, and spec 05 follows it.
   - Without the row, `/alerts` stays near 14 at 1440 by the probe's own counts: four visible row tags, the legend's three words and the Fired tag stay.
2. **The bar's as-of wording.** "As of Oct 7, 2026" replaces the brief's "Sample scenario · Oct 7, 2026" from 600px up. Below 600 the bar reads "Demo · sample data · Oct 7, 2026", which is the 2026-10-07 exception's phrase and date with the glyph, so it needs no ruling.
   - **Recommended: yes, in the same row as Q1.** The brief's wording leaves no budget for the page: 6 of 6 words at 1440 are chrome, and three pages fail (probe 6/8/7/8).
3. **The "Who built it" line.** Today the owner's name appears nowhere in the app. Which link should "GitHub ↗" take: the profile (the brief, already on `/privacy`) or the public repository, `https://github.com/ariasr47/convexa`?
   - **Recommended: show the name as written, and link the repository.** A reviewer is looking for the code, and the profile is one click from the repo.
4. **One form for demo source labels.** Three forms exist:
   - "Shaped like …" (spec 03's desk masthead and Scanner, spec 05's staging credits, spec 07's staging credit lines)
   - "Demo · shaped like …" (12 Research frames, for example `MarketsPage.tsx:70`; two of them are the note page's panels, `NotePublicPanels.tsx:455` and `:662`)
   - "Sample · shaped like …" (the desk's read strip, Alerts and the dialog, for example `AlertsPage.tsx:1012`)

   This spec keeps each page's own form. Until the follow-up below, three pages mix two forms:
   - **The desk, today.** The masthead's chip reads "Shaped like a delayed SPY quote", and the read strip's reads "Sample · shaped like the options chain" (spec 3, Behaviour › (d) Sample and simulated said once).
   - **Markets, after spec 07.** The Stress frame's "Shaped like …" credit lines sit inside a frame whose source chip reads "Demo · shaped like …" (spec 7, Copy › Rows, the staging credit lines).
   - **The note page, after spec 05.** The section's "Shaped like SEC EDGAR" credits sit above panels that read "Demo · shaped like …" (spec 5, Copy, the Meta row).
   - **Recommended: after specs 1, 3, 4, 5 and 7 land, one follow-up moves all of them to "Shaped like …".** The dashed border already says sample, and the bar says it in words.
