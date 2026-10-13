# Public data

The Research section's Markets and Filings views, and the positioning and filings panels under each
ticker's note, read public sources through the API (`/api/public-data/*`). The API fetches each source
server-side, keeps one cached copy for every reader, and answers with a `state` instead of failing when
a source is down. The browser can't call these sources itself: the site's Content-Security-Policy allows
only its own origin.

Adopted 2026-10-13 (owner chose "the Rust API on Railway fetches and serves them live" over a scheduled
rebuild or refresh-on-push).

## Sources

| Source                                                   | What it gives                                                                                          | Delay                                        | Cached   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- | -------- |
| U.S. Treasury daily yield-curve rates (nominal and real) | Treasury yields: 3-month, 2-, 5-, 10-, 30-year, real 10-year                                           | Same business day, after the close           | 6 h      |
| CFTC Traders in Financial Futures                        | Net positions of asset managers and leveraged funds: 10-year T-note, E-mini S&P 500, E-mini Nasdaq-100 | As of Tuesday, published Friday              | 12 h     |
| FINRA Reg SHO daily files                                | Short-sale volume share, 20-day average                                                                | One business day                             | Per file |
| FINRA consolidated short interest                        | Shares short, days to cover                                                                            | Twice a month, about a week after settlement | 12 h     |
| SEC EDGAR submissions                                    | Filings in the last 90 days; Form 4 insider trades                                                     | Minutes after filing                         | 1 h      |
| SEC EDGAR company facts (XBRL)                           | Revenue, margins, EPS, cash as reported in 10-Q/10-K/20-F                                              | With the report                              | 24 h     |

FRED was the first choice for yields; its download endpoint refuses programs that identify themselves
honestly, so the API reads the Treasury's own CSVs (the same figures FRED republishes).

None of these needs a key. All of them are public records or official datasets, so their figures can be
shown on a public site.

## Settings (API)

- `PUBLIC_DATA` — `on` (default) or `off`. Off answers every endpoint with state `off` and calls nothing.
- `SEC_USER_AGENT` — required for anything from EDGAR. The SEC asks every program that reads EDGAR to
  identify itself with a name and contact address; set it on Railway to something like
  `Convexa research <your contact address>`. Without it, filings and insider trades answer
  `not_configured` and the views say so.

## What a filing does to a note

A results or quarterly filing made after a note's date that the note doesn't cite (matched by SEC
accession number) makes the note due, the day it is filed (`freshness()`'s `filed` option, and
`apps/dashboard/src/app/pages/research/filings.ts`). The Filings view offers the command that drafts an
update note (`npm run research:new <TICKER>`); nothing published changes until that note is pushed.

## Not built, and why

- **Fund holdings (13F).** Needs the SEC's quarterly bulk datasets (hundreds of MB); no live source fits.
- **Signal track record.** Grading the scanner's setups needs a daily price history licensed for public
  display. The free price feeds are for personal use only.
