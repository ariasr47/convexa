# What Convexa can build without Massive

Written 2026-10-13. Everything here runs on public data or free tools: no Massive (or similar paid
market-data) subscription. **Status** is one of:

- **live**: built and serving through `/api/public-data/*`.
- **switch**: built; needs one setting, no code.
- **build**: free source confirmed reachable; not built.
- **verify**: free source, but its terms for showing it on a public site are unchecked.
- **blocked**: needs a daily price history licensed for public display (see "The one gate").

"Checked" means fetched live in this session (2026-10-13). Anything not marked checked is from
knowledge, not tested.

## Rates, money and macro

| What                                                                                                                    | Source                                                                                                                    | Delay                              | Status                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Yield curve against a year ago, real 10-year, breakeven, 2s10s                                                          | U.S. Treasury daily par and real yield curve CSVs (checked)                                                               | Same day, after the close          | live                                                                                 |
| Each note's discount-rate drift, flagged at 0.25 pts                                                                    | Treasury 10-year against each note's price date                                                                           | Same day                           | live                                                                                 |
| Liquidity panel: Fed balance sheet less the Treasury General Account less reverse repo                                  | Fed H.4.1 (Data Download Program), Treasury Fiscal Data API (Daily Treasury Statement), NY Fed Markets API (reverse repo) | Weekly (H.4.1), daily (the others) | build                                                                                |
| Short-rate panel: SOFR, effective fed funds, repo volumes                                                               | NY Fed Markets API, no key                                                                                                | Next morning                       | build                                                                                |
| Treasury auctions: size, tail, bid-to-cover, indirect share                                                             | Treasury Fiscal Data API / TreasuryDirect                                                                                 | Same day                           | build                                                                                |
| Macro calendar: FOMC dates, CPI and jobs (BLS), GDP and PCE (BEA), auctions; as Markets events and note review triggers | Fed, BLS, BEA and Treasury published schedules                                                                            | Scheduled ahead                    | build                                                                                |
| Macro series: CPI, payrolls, unemployment, GDP, PCE                                                                     | BLS API (free key for v2), BEA API (free key)                                                                             | On release                         | build                                                                                |
| Hundreds of other macro series                                                                                          | FRED official API with a free key. The keyless CSV refuses honest User-Agents (checked)                                   | Varies                             | verify (some series are third-party copyrighted, e.g. ICE BofA spreads, S&P indices) |

## Positioning: "the positioning behind the price"

| What                                                                                                                 | Source                                                               | Delay                                        | Status                             |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| Asset managers and leveraged funds in 10-year notes, E-mini S&P, E-mini Nasdaq                                       | CFTC Traders in Financial Futures (checked)                          | Tuesday data, Friday release                 | live                               |
| More contracts: 2/5/30-year notes, Russell, VIX futures, dollar, currencies; managed money in gold, crude and grains | CFTC TFF and Disaggregated reports, same Socrata API                 | Same                                         | build                              |
| Short interest, days to cover, history                                                                               | FINRA consolidated short interest (checked)                          | Twice a month, about a week after settlement | live (FINRA display terms: verify) |
| Short-sale volume share and 20-day average                                                                           | FINRA Reg SHO daily files (checked)                                  | Next day                                     | live (same)                        |
| Off-exchange volume by ticker (ATS and non-ATS): the free stand-in for the paid block-trade panel                    | FINRA OTC Transparency                                               | 2 weeks (Tier 1), 4 weeks (others)           | build / verify                     |
| Fails to deliver                                                                                                     | SEC fails-to-deliver files                                           | Twice a month, about two weeks late          | build                              |
| Insider trades, 10b5-1 plan flag                                                                                     | SEC Form 4                                                           | Minutes after filing                         | switch (`SEC_USER_AGENT`)          |
| Insider clusters: several insiders buying within days                                                                | Derived from Form 4                                                  | Same                                         | build (after the switch)           |
| Fund holdings changes for a curated list of funds                                                                    | SEC 13F-HR information tables, per filing (avoids the bulk datasets) | 45 days after quarter end, by law            | build                              |
| 5%+ and activist stakes                                                                                              | SEC Schedules 13D and 13G                                            | Days                                         | build                              |
| Congressional stock trades                                                                                           | House Clerk and Senate eFD periodic transaction reports              | Up to 45 days; House reports are PDFs        | build (heavy parsing)              |

## Company facts and research

| What                                                                                                       | Source                                                   | Status                                                  |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Filings feed, "Filed since this note", a note comes due the day a results filing lands                     | SEC EDGAR submissions                                    | switch (`SEC_USER_AGENT`)                               |
| Reported revenue, margins, EPS, cash in the filing detail                                                  | SEC XBRL company facts                                   | switch (`SEC_USER_AGENT`)                               |
| Note figures filled from XBRL with period and filed date, flagging what an author typed that doesn't match | XBRL company facts                                       | build                                                   |
| Peer tables: one concept across every filer for a period (gross margin across semis, for example)          | XBRL frames API                                          | build                                                   |
| Share count and dilution, buybacks; short interest as % of shares outstanding                              | XBRL company facts (`dei` shares outstanding, cash flow) | build (the % already switches on with `SEC_USER_AGENT`) |
| 8-K event timeline per ticker (results, executive changes, agreements)                                     | EDGAR 8-K item numbers                                   | build (the kinds exist in the Filings feed)             |
| Next results date estimated from each company's filing cadence                                             | EDGAR filing history                                     | build                                                   |
| Government contract awards, for government-heavy names                                                     | USAspending.gov API, no key                              | build                                                   |
| Forecast scorecard: Brier score, calibration, past due                                                     | The notes' own forecasts                                 | live                                                    |

## The one gate: daily price history

Everything below needs end-of-day prices. Computing them is free (open-source indicator libraries);
the data's terms are the problem: free price feeds are usually licensed for personal use, not for
display on a public site. All of these work today on staging's sample data.

| What                                                                                                 | Status                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Technical analysis: trend and moving averages, RSI, ATR, support and resistance from the daily range | live as TradingView's chart (EMA 20/50, RSI 14), adopted 2026-10-13; Convexa-computed readings stay blocked |
| Relative strength against SPY and the sector ETF; sector rotation                                    | blocked                                                                                                     |
| Realized volatility (implied volatility needs options data, so it stays not live)                    | blocked                                                                                                     |
| Correlation and beta matrix                                                                          | blocked                                                                                                     |
| Earnings-move history and seasonality                                                                | blocked                                                                                                     |
| Signal track record: the scanner's setups graded after trading costs                                 | blocked                                                                                                     |
| Forecast outcomes graded against price automatically                                                 | blocked (the forecast half is live)                                                                         |

Ways through the gate, each to verify before choosing:

1. A provider whose free or cheap plan allows public display with attribution. Massive's own free
   tier, Tiingo, Alpha Vantage, Stooq and Nasdaq Data Link are the usual candidates; their display
   terms are unchecked.
2. Embedded third-party charts that carry their own data licence (TradingView's free widgets, with
   their branding and attribution). This gives live charts and a technical summary without Convexa
   holding the data. Cost: an off-brand third-party script and a looser Content-Security-Policy.
3. Keep price-based tools on staging's sample data, or private.

### Research, 2026-10-13: what each path actually allows

The terms pages were read on 2026-10-13. Section references are given so each verdict can be
re-checked.

- **Free and cheap price APIs: none allow public display.**
  - Massive Basic and Starter ($0 / $29) are for individual use; derived works may not be shown to
    third parties. Display starts with the Business plan at $2,499/mo (individuals ToS §2, §6.1(k);
    businesses ToS §2.2).
  - Tiingo is internal use only and names charts and dashboards as prohibited; display costs
    $250–500/mo. The free plan also forbids storing data at all, which rules out a daily
    fetch-and-cache (tiingo.com/tos §1.6, §7.3).
  - Alpha Vantage (§2(a)), Finnhub ("Redistribution Rights"), FMP (§2.2.2: forbidden whether the
    use is free or paid), and EODHD (non-professional terms; even its $399 internal plan
    excludes display): not allowed.
  - Marketstack Basic ($9.99) is unclear: its terms don't address display, and its US data comes
    from Tiingo.
  - The cheapest plan that clearly allows external display is Twelve Data Venture, at $124/mo
    billed yearly or $149/mo monthly. It requires attribution, and derived data must not be
    reversible into prices (terms §2.2(c)). A support article says US equities need an add-on, so
    get written confirmation before paying.
- **Open, scraped and broker sources: none allow it.**
  - Stooq forbids redistribution without consent (§5.3).
  - Nasdaq Data Link has no free US end-of-day data, and derived data needs Nasdaq's approval
    (§1.2, §1.4).
  - Yahoo forbids both the scraping and the redistribution (ToS, "Member conduct";
    help SLN2310).
  - Alpaca, Tradier, Interactive Brokers and Schwab: personal use only, or written consent
    required.
  - FRED's index series are copyrighted by S&P and Nasdaq.
  - The "CC0" price datasets on Kaggle don't disclose a licensed source.
- **Exchange rules.**
  - Until 2027-04-01, the tape plans charge nothing for public end-of-day display. This is
    explicit for Nasdaq-listed stocks (UTP fee schedule) and ambiguous for NYSE-listed ones (CTA
    documents don't address end-of-day data). The real gate is the vendor's licence.
  - From 2027-04-01 the new consolidated-tape plan (approved 2026-06-26, Release 34-105778)
    requires an explicit licence even for end-of-day redistribution. Its policies v1.2 §4.6 treat
    creating derived data as licensed non-display use. They don't say whether that covers
    indicators computed from end-of-day data; ask licensing@datact.com.
- **Embedded widgets: TradingView is the one clean free path.**
  - TradingView's free iframe widgets carry their own data licence. They cover all the followed
    stocks and ETFs (US data delayed), can draw moving averages and RSI, compare against SPY, and
    show a technical-rating gauge. Whether ATR is available is unconfirmed.
  - Conditions (policies §3, §4):
    - leave the TradingView attribution exactly as designed;
    - display only, with no scraping or processing;
    - label prices as delayed;
    - name TradingView in the privacy notice: it receives visitor IPs and page URLs, and sets no
      cookies per its FAQ.
  - The Content-Security-Policy needs `script-src https://s3.tradingview.com` and
    `frame-src https://www.tradingview-widget.com https://s.tradingview.com`.
  - Limits: widget data can't feed Convexa's own computations, there's no SLA, and the gauge
    only themes as dark or transparent.
  - Other widgets (Investing.com, Finnhub, Stockdio, Barchart) are unclear or don't cover US
    stocks.

**Adopted 2026-10-13 (owner chose (a)):** TradingView's advanced-chart widget on the live Technical
tab; see README.md, "Price charts". The technical-rating gauge is left out: it words its summary as
buy and sell calls.

**Recommendation as made:** TradingView iframe widgets for the price chart and technical summary, labeled
as TradingView's and delayed. The tools that need Convexa's own computations stay blocked or on
sample data: the signal track record, the relative-strength and realized-volatility figures, and
grading forecasts against price. Revisit if a paid display licence becomes worth it (Twelve Data
Venture, after written confirmation).

## Not free, stays "not live" in the hybrid site

Options chains and everything built on them: dealer gamma (GEX) and the gamma flip, vanna and
charm flows, IV term structure and rank, straddle-implied move, Vol/OI, max pain; intraday tape,
VWAP and real-time block trades; and the AI read built on those inputs. Free substitutes exist only
for pieces (FINRA OTC volume for blocks, realized volatility for implied); the rest shows an honest
not-live state or labeled sample data.
