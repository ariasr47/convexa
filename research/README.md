# Research notes

Ticker research published on the site. Each ticker's latest note is the **Research** tab
(`/ticker/<TICKER>/research`); older notes stay readable at `/ticker/<TICKER>/research/<file-name>`, and
`/research` lists every ticker. Notes are Markdown files compiled into the site at build time, so they
work while live market data is off. Every valuation figure is computed by the build from inputs the
note states; nothing a reader sees as a result is typed by hand.

The rules behind the format (why each part exists, freshness, how to update) are in
[`docs/research-method/README.md`](../docs/research-method/README.md).

## Add or update a note

1. **New ticker:** `npm run research:new <TICKER> -- --fresh` writes
   `research/<TICKER>/<today>-initiation.md` from [`_template.md`](_template.md).
   **Update:** `npm run research:new <TICKER>` writes `research/<TICKER>/<today>-update.md` from the
   latest note: facts blanked to `___`, sections flagged `re-confirm`, judgments at their old values, and
   a `since` block listing the old calls.
2. Write the note. `npm run research:check -- --values <TICKER>` prints what the valuation computes;
   add `--only <TICKER>` to judge that ticker's folder alone while other drafts are half-written.
3. `npm run research:check` (the pre-push hook runs it too) must pass.
4. Commit and push. Cloudflare Pages rebuilds the site.

`npm run research:due` lists what is due now and the next dates that will age a note (`-- --all` for every date). Files starting with `_` are ignored, which
suits drafts.

**Never edit an old note's analysis.** A real update is a new dated note. Edit in place only to record a
catalyst's outcome, mark a forecast or kill criterion resolved, set `not_following_since`, or fix an
error; each such edit sets `updated:` and adds a `changelog` line.

## Front matter

| Field                 | Required | Example                                 | Notes                                                  |
| --------------------- | -------- | --------------------------------------- | ------------------------------------------------------ |
| `ticker`              | yes      | `CBRS`                                  | Must match the folder name                             |
| `date`                | yes      | `2026-10-12`                            | When the note was written; also the thesis-review date |
| `title`               | yes      | `A $25B backlog on a $0.9B year.`       | The headline                                           |
| `company`             | no       | `Cerebras Systems`                      | Shown beside the ticker                                |
| `about`               | no       | `Nasdaq · AI inference chips and cloud` | One line under the company name                        |
| `stance`              | no       | `watching`                              | Yours. `bullish`, `bearish`, `neutral` or `watching`   |
| `target`              | no       | `150`                                   | Yours. Dollars per share; needs `target_date`          |
| `target_date`         | no       | `2027-06-30`                            | When the target applies                                |
| `position`            | no       | `none`                                  | Yours. Disclosed in the header                         |
| `horizon`             | no       | `mid-2028`                              | Free text                                              |
| `tags`                | no       | `AI chips, IPO 2026`                    | Comma-separated                                        |
| `summary`             | no       | `One or two sentences.`                 | Defaults to the first paragraph                        |
| `updated`             | no       | `2026-10-20`                            | Set when an outcome or correction is recorded          |
| `not_following_since` | no       | `2027-01-05`                            | Archives the ticker: no more review prompts            |

Any other field is an error.

## Structure

A note opens with a short **lead** (a paragraph, then a `strip` and a `tldr` block), then up to five
**parts**, each a `#` heading, each holding **sections**:

```
# The verdict
## What the price implies | The price pays for growth almost no company has delivered.
```

Text after `|` is the section's one-line headline; before it, the label used in the side rail. Sections
are numbered automatically. `###` headings work inside a section. The template has the standard five
parts: The verdict · The evidence · The debate · Valuation and what's next · The record.

## Every figure carries its date

In `metrics` and `strip` rows, and for the valuation's `price`, `shares`, `net_cash`, `revenue` and
`margin_now`, a value is written `value @ as-of`: `$209.9M @ Q2 2026`, `146.62 @ 2026-10-12`. An undated
value fails the check.

## Blocks

A fenced block named on its opening line becomes a visual. Each row is cells separated by `|`. Text
cells take **bold**, _italic_, links and `[n]` source references. Write `\|` for a literal pipe.

| Block                 | Row format                                                                                       | Renders                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `strip`               | `label \| value @ as-of \| sub \| concept (optional)`                                            | The header strip of figures                                           |
| `tldr`                | `figure \| sentence` (1–4 rows)                                                                  | The 30-second summary                                                 |
| `metrics`             | `label \| value @ as-of \| delta \| up/down/flat \| note [n] \| concept (optional)`              | Figure tiles                                                          |
| `chart bar "Caption"` | `label \| number \| approx/guide (optional) \| shown text (optional)`                            | A column chart (negatives hang below zero); the last plain bar is lit |
| `split "Caption"`     | `label \| number \| detail (optional)`                                                           | One bar cut into shares of its total                                  |
| `compare "Caption"`   | `label \| number \| shown text \| emph (optional)`                                               | Horizontal bars on one scale                                          |
| `bridge "Caption"`    | `label \| number`: first and last rows are totals, the rest signed steps                         | A walk from one total to another                                      |
| `units "Caption"`     | `total \| unit` (one row)                                                                        | The total drawn as blocks of the unit                                 |
| `implied`             | (no rows)                                                                                        | What the price implies, from `valuation`                              |
| `variant`             | `driver \| what the price implies \| your view \| what settles it`                               | Your view against the price's                                         |
| `scorecard`           | `pillar \| metric \| latest \| ok/watch/broken \| kill criterion`                                | The thesis scorecard                                                  |
| `moat`                | `source \| evidence/unproven/none \| why`                                                        | The moat check                                                        |
| `case`                | `+ headline \| detail` or `- headline \| detail`                                                 | Case for vs the strongest case against                                |
| `premortem`           | `story \| kill criterion it maps to (#n)`                                                        | The pre-mortem                                                        |
| `valuation`           | see below                                                                                        | Football field, scenarios, odds, sensitivity                          |
| `catalysts`           | `date \| event \| detail \| confirmed/expected/target \| outcome (optional)`                     | The dated timeline                                                    |
| `kill`                | `#n \| trigger \| threshold \| source \| check by \| then \| outcome (opt.)`                     | Kill criteria                                                         |
| `forecasts`           | `claim \| probability (0–1, blank = yours to set) \| resolve by \| source \| yes/no/void (opt.)` | The forecast ledger, Brier-scored                                     |
| `changelog`           | `date \| initiation/outcome/revision/roll-forward/correction \| text`                            | The change log                                                        |
| `sources`             | `n \| title \| https://…`                                                                        | Numbered sources for `[n]` references                                 |
| `since`               | `catalyst/forecast/kill/pillar \| the old call \| what happened`                                 | Update notes: the old calls, scored first                             |
| `moves`               | `input \| old → new \| trigger \| why`                                                           | Update notes: every judgment that moved                               |

Plain Markdown still works: paragraphs, lists, tables, `> quotes`, **bold**, _italic_, `code`, links
(`https://`, `http://` or `/` only), and `---` rules. Images and raw HTML are not supported.

**Dates** in `catalysts`, `kill` and `forecasts`: `2026-10-14`, `2026-11` (a month), `2026-Q4`, `2027`,
`2026-11-05..2026-11-16` or `2027-07..2027-12` (a window), `by 2026-11-10`, or `ongoing` (kill criteria
only). An approximate
date counts from the end of its window. A row with an outcome no longer ages the note.

### The valuation block

```valuation
method: Narrative DCF with a failure probability
why: Young and pre-profit, so earnings multiples don't apply.
price: 146.62 @ 2026-10-12
shares: 273.7 @ 2026-06-30
net_cash: 7700 @ 2026-06-30
revenue: 885 @ FY2026 guide
margin_now: -16% @ Q2 2026
tax: 21%
terminal_growth: 3%
terminal_wacc: 8.5%
margin_year: 7
uncertainty: very-high
uncertainty_why: Pre-profit, three customers are 76% of revenue.

scenario | rev_y1 | growth | margin_y1 | margin_target | sales_to_capital | wacc | p_fail | distress | story
bear     | 2000   | 20%    | -10%      | 15%           | 1.2              | 12%  | 30%    | 10       | The backlog slips.
base     | 2600   | 45%    | -5%       | 25%           | 1.5              | 11%  | 15%    | 15       | Converts on schedule.
bull     | 3000   | 60%    | 0%        | 32%           | 1.8              | 10%  | 5%     | 20       | OpenAI exercises its option.

sensitivity: margin_target 20%, 25%, 30% x wacc 10%, 11%, 12%
odds: 5/11/4
traded: 146 - 350 @ 2026-05-14..2026-10-12
third_party: 288.67 @ 2026-10-12 | Wall Street average target (TipRanks)
```

Money is in **$ millions**, shares in **millions**, `price` and `distress` in **dollars per share**.

- **The model** is a 10-year free-cash-flow DCF (Damodaran's story-to-numbers form). Revenue starts at
  `revenue` (year 0); year 1 is `rev_y1` when given, then it grows at `growth` through year 5 and fades
  linearly to `terminal_growth` by year 10. The operating margin moves in a straight line from
  `margin_y1` (or `margin_now` at year 0) to `margin_target` by `margin_year`, then holds. Taxes apply to
  profit after losses carried forward (`nol:` sets a starting balance); `terminal_tax` (default `tax`)
  applies from year 11. Reinvestment is new revenue ÷ `sales_to_capital`; a falling revenue releases no
  capital. Year 1 can state its reinvestment outright with `reinvest_y1` ($M, e.g. guided capex less
  depreciation): a jump that comes from prices rather than capacity needs far less capital than the
  ratio would charge. The cost of capital is `wacc` through year
  5, then moves to `terminal_wacc` by year 10. The terminal value reinvests `terminal_growth ÷
terminal_roc` of profit (`terminal_roc` defaults to `terminal_wacc`: no excess returns forever).
- **Value per share** = (enterprise value + `net_cash`) ÷ `shares`, floored at zero, then weighted for
  failure: going-concern value × (1 − `p_fail`) + `distress` × `p_fail`.
- **Yours, so optional:** `odds` (bear/base/bull in twentieths, summing to 20) adds a weighted value.
  Leave it out until you decide.
- **The build computes:** the three scenario values, each against the dated price; the weighted value;
  a sensitivity grid on the base case (`sensitivity:` names two inputs and three values each); the
  growth the price implies (the base case solved for `growth`); and the share of the price that
  today's profit supports. `implied` renders the last two.
- `method`, `price`, `shares`, `net_cash`, `revenue`, `margin_now`, `tax`, `terminal_growth`,
  `terminal_wacc` and the three scenario rows are required. The columns `rev_y1`, `reinvest_y1` and
  `margin_y1`, and the fields `margin_year` (default 5), `nol`, `terminal_tax`, `terminal_roc`, `traded`,
  `third_party`, `sensitivity`, `odds`, `why`, `uncertainty` and `uncertainty_why` are optional.

## Figures against the filing

A `strip` or `metrics` figure can name its XBRL concept in a last cell. The note page then shows it
beside the value the company tagged in its filing for the same period ("Checked against the filing"),
and `node tools/research-notes/check-filings.mjs` lists the same check for the author.

```metrics
Revenue | $96.2B @ Q2 FY2027 | ▲ 106% YoY | up | Data Center $89.0B [1] | us-gaap:Revenues
Operating margin, GAAP | 66.2% @ Q2 FY2027 | ▲ 5.4 pts YoY | up | [1] | us-gaap:OperatingIncomeLoss / us-gaap:Revenues
Guarantees | $108.5B @ 2026-07-26 | | flat | [2] | none
```

- **The concept** is one of the concepts in `tools/research-notes/filing-check.mjs` (`CHECKED_CONCEPTS`,
  the ones the API reads), written with its taxonomy; or two joined by `/` (a ratio, for a `%` figure),
  `-` or `+` (a computed figure); or `none` when no standard concept exists (the page says "Not tagged ·
  cites the filing").
- **The period** is the as-of: `Q2 FY2027` (or `Q2 FY27`) and `FY2026` match the fiscal period the
  company tagged; a date matches the filing whose period ends that day.
- **A match** is equal at the note's precision: `$96.2B` matches $96,221M; `66.2%` doesn't match 66.37%.
- **A known difference** is explained after `;` in the same cell, like
  `us-gaap:OperatingIncomeLoss / us-gaap:Revenues; as reported in the 8-K`. The page still shows both
  values; the check then passes.
- **Units.** A `$` figure is US dollars: it is compared only with a value tagged in `USD` (or `USD/shares`
  per share). A filer that tags only its own currency (TWD, EUR) reads "units differ" against it.
- **Which filings.** The check reads the two newest periodic filings (10-Q, 10-K, 20-F, 40-F; never an
  amendment), the same two the note page reads. A figure from an older filing, such as last year's
  10-K once two 10-Qs have followed it, is listed as not checked, not failed.
- **Quarterly cash flow.** A 10-Q's cash-flow statement tags year-to-date amounts, and neither check
  keeps a six- or nine-month span. A Q1 figure checks as it is (the year to date is the quarter); for a
  Q2 or Q3 cash-flow figure (operating cash flow, capex, free cash flow) cite the filing with `none`.

The check reads only saved SEC company-facts answers, never EDGAR itself: save
`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` as `research/_filings/<TICKER>.json`.
It exits 1 on a difference with no `;` reason, a concept the filing doesn't tag, units that don't fit,
or a figure or period it can't read; a ticker with no saved answer is listed as not checked.

## What the check refuses

- Front matter: unknown or repeated fields, a bad date or stance, a `target` without `target_date`.
- Links that aren't `https://`, `http://` or a same-site `/` path; a `[n]` with no matching `sources` row.
- A block with the wrong number of cells, an unknown status word, a number that isn't one, an
  undated figure, a `bridge` whose steps don't add up, `odds` that don't sum to 20.
- A `___` blank, or a `<!-- re-confirm … -->` flag still in place. After re-reading a carried section,
  replace its flag with `<!-- carried from 2026-10-12; re-confirmed 2026-11-18 -->`.
- A judgment that differs from the ticker's previous note with no `moves` row: any scenario input,
  `terminal_tax`, `terminal_growth`, `terminal_wacc`, `terminal_roc`, `margin_year`, `odds`,
  `uncertainty`, `stance` or `target`. Name it as written: `base.margin_target`, `odds`, `stance`.
