# How Convexa research notes are built

Three research briefs (2026-10-12), each with numbered sources, back the note design on the
[Convexa Research View](https://claude.ai/artifact/HxZArSCsbrjQCx8VBbYRw7) canvas:

- [structure-and-valuation.md](structure-and-valuation.md): professional report structure (CFA Research
  Challenge, Morningstar, FINRA 2241), valuation per company type (Damodaran, Mauboussin), industry KPIs,
  earnings-quality and governance checks.
- [perspectives-and-forecasting.md](perspectives-and-forecasting.md): variant perception, base rates,
  pre-mortems, steelmanning, calibrated forecasts and Brier scoring, positioning lenses, how dealer gamma fits.
- [information-design.md](information-design.md): ADHD-friendly and skimmable reading, uncertainty and
  valuation charts, platform patterns to borrow or avoid, accessibility.

## The note, in five parts

| Part | Sections | Why |
|---|---|---|
| First screen | Header strip, price-vs-value strip with uncertainty, TL;DR, two timestamps (price as of, thesis reviewed), stance and position | 57% of viewing time stays above the fold; answer first |
| 1 · The verdict | What the price implies (reverse DCF, base rates, your variant view) · Thesis scorecard with kill criteria | Edge needs a view that differs from what the price already assumes |
| 2 · The evidence | Key numbers · Revenue and earnings quality (GAAP vs adjusted bridge) · Backlog · Customers · Moat and competition | Facts before opinions; adjustments made visible |
| 3 · The debate | Case for vs the strongest case against · Pre-mortem · Positioning and ownership · Dilution and governance | Counter confirmation bias; show who holds the other side |
| 4 · Valuation and next | Valuation by company type (football field, scenarios with odds in twentieths, sensitivity) · Catalysts · Kill criteria · Forecasts | Ranges, not points; decisions committed in advance; checkable calls |
| 5 · The record | Change log (real revisions vs roll-forward) · Sources | Updates in small, dated steps; calibration over time |

## Rules carried into the build

- Every valuation output is computed by the build from stated inputs; nothing hand-typed.
- Values are ranges with an uncertainty word; "upside" is only shown against the dated price.
- Stance, target, scenario odds, forecast probabilities and position belong to the author and stay unset until written.
- Direction is shown by sign and ▲/▼, never colour alone; one amber element per screen.
- Valuation method follows company type: normalized DCF (cyclical), narrative DCF with failure probability (young), enterprise DCF with distress probability (levered).
- Freshness is worked out in the reader's browser from the note's own dates. The pre-push check never reads the clock.

## Keeping notes honest over time (adopted 2026-10-12)

A note is never kept current. It stays true as of its date, and the page works out when that stops. The project is
frozen and maintained by one person, so any rule that depends on regular upkeep will fail; a note nobody touches
again must decay into an honest dated record, never into a wrong claim about today.

1. **Every number carries its date.** A fact carries its period or as-of date (`$209.9M @ Q2 2026`); the price
   carries the day it was taken (`price: 146.62 @ 2026-10-12`). Market data is paused, so there is no live price
   to refresh against. `research:check` fails on an undated number.
2. **A real update is a new dated note; old notes stay readable.** Notes already sort newest first
   (`tools/research-notes/notes.mjs:529`) and the ticker page shows the latest on top, older below
   (`apps/dashboard/src/app/pages/research/NotesView.tsx:202`). `updated:` is only for corrections and recorded
   outcomes, each with a change-log line.
3. **Freshness is computed in the browser, never at build.** The site is not rebuilt after it deploys, so a
   build-time check would say "current" forever.
4. **A stale note says what has happened since, by name and date,** and hides figures that depend on an old price.
5. **The pre-push check never reads the clock.** `research:check` fails on structure only (an undated number, a
   catalyst without a date). `npm run research:due` lists what is due; it is never part of pre-push, because a
   check that depends on today's date would block unrelated pushes on random days.

| State | When | The page shows |
|---|---|---|
| Current | None of the note's dates has passed | "Current · review by <date>" |
| Review due | An earnings date, catalyst, forecast deadline or kill-criterion check date has passed, or the price is 30+ days old | A banner: "Written <date>. Since then: <events>. The figures below predate them." "% to base" hides once the price is 30+ days old; the value range stays |
| Superseded | A newer note exists for the ticker | A banner linking to the newer note; this one stays at its own address |
| Archived | `not_following_since:` is set | "Not following since <date>"; the ticker leaves "Coming up" and `research:due` |

An approximate date counts from the end of its window (`~Nov 5–16` → Nov 16; `2026-12` → Dec 31), so a note never
claims to predate an event that has not happened yet. Write the confirmed date once it is announced.

## Updating a note (adopted 2026-10-12)

Start from the old note as the starting view and the checklist, never as a draft to edit. The danger is a stale fact
copied forward under the new date, where it looks freshly checked. Starting from a blank page has the opposite cost:
it throws away the record of calls and outcomes, which is the point of keeping notes.

| Content | Treatment | Why |
|---|---|---|
| Facts (numbers, quotes, dates) | Never copied. Looked up again in the filings; the old values stay in the old note | A copied number would pass rule 1 under a date it was never checked on |
| Analysis (business, moat, customers, governance) | Carried over, flagged `re-confirm`; `research:check` refuses to publish until each is re-confirmed or rewritten | Mostly durable, so rewriting wastes effort; publishing it unread is how errors spread |
| Judgment (odds, forecasts, valuation inputs, stance) | Start from the old values; move them in small logged steps: *trigger · old → new · why* | The best forecasters revise often and in small steps (Atanasov et al. 2020; [perspectives-and-forecasting.md](perspectives-and-forecasting.md) item 10) |

**First step of every update:** score the old note's catalysts, forecasts and kill criteria against what happened,
before changing any view.

| What happened | What to do |
|---|---|
| None of the note's dates has passed | Nothing |
| A catalyst passed and the view is unchanged | Record its outcome in the existing note's change log (`updated:`) |
| New results or filings | An update note: `npm run research:new <TICKER>` |
| A kill criterion fired, the price left the bear-to-bull range, the business changed shape, or 4+ quarters since the last full note | A fresh full note from the blank template (`research:new <TICKER> --fresh`). Read the old note only after drafting, then compare: when the thesis broke, its framing is what failed |
| No longer following the stock | `not_following_since: <date>` |

### Tooling (planned, not built)

- `npm run research:new <TICKER>` builds the next note from the latest one: every fact replaced by `___`, analysis
  sections flagged `<!-- re-confirm: carried from <date> -->`, judgments at their old values, and a `since` block
  listing the old catalysts, forecasts and kill criteria, each waiting for an outcome. `--fresh` gives the blank
  template.
- `research:check` refuses a note with a blank, a remaining `re-confirm` flag, an undated number, or a judgment that
  differs from the previous note without a `moves` line.
- `npm run research:due` lists due notes by date.

The canvas's Freshness board shows each state as it renders.

Personal research, not financial advice.
