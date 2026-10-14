// The hybrid site (owner goal, 2026-10-13): live where free public data reaches, honestly not live
// where the paid options feed (Massive) is needed. One row per widget on every screen.
// `status` uses docs/public-data/CANDIDATES.md's words (live · switch · build · verify · blocked);
// `not live` marks what that file lists under "Not free"; `—` marks things that need no data source.
// `state` is the widget's state once the switches are on (SEC_USER_AGENT set); `today` notes where
// production differs now. Sources and delays come from the same file and apps/api public_data.

// [widget, shows, needs, source, delay, status, state, tag, chip, today?]
export const SOURCE_MAP = [
  { screen: 'Shell', rows: [
    ['Site data notice', 'What is live on this site, in one line', 'GET /api/health market_data', 'Convexa API', '—', '—', 'local', '', '', 'Says “paused”; v4 says “not live” (X-01)'],
    ['Connection chip', 'live · closed · overnight · no ticks · offline · replay', 'Stream mid and session', 'Massive stocks WebSocket', 'Real time', 'not live', 'notLive', 'slot shows the page legend', '', 'No chip renders while paused'],
    ['⌘K jump-to', 'Commands, tickers with notes, scan rows with score', '/api/scan + research index', 'Convexa (scores need Massive)', '—', 'not live', 'notLive', 'Scores not live', 'Research index · build', 'Scan rows fail; commands work'],
    ['Demo bar (staging)', 'Demo · sample data · scenario date · Reset Demo', 'Build mode', 'Authored scenario Oct 7, 2026', '—', '—', 'demo', 'Demo · sample data', '', ''],
  ] },
  { screen: 'Landing', rows: [
    ['Gamma surface hero', 'Strike × tenor dealer gamma, isometric', 'Static illustration', 'Authored SVG', '—', '—', 'sample', 'Illustrative sample', '', ''],
    ['Feature samples', 'Structure field, score strip, AI read', 'Static illustration', 'Authored', '—', '—', 'sample', 'Illustrative sample', '', ''],
    ['What is live here', 'Rates, positioning, filings, research counts', 'Public-data endpoints', 'Treasury · CFTC · FINRA · SEC', 'Per source', 'live', 'current', 'Updated', 'per source', 'Not drawn today (proposal)'],
  ] },
  { screen: 'Ticker · overview', rows: [
    ['Masthead price', 'A price Convexa holds itself', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Price in TradingView’s chart', '', 'Stream mid (Massive); paused shows nothing'],
    ['52-week range', 'Where the close sits in its year', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', ''],
    ['Daily chart', 'Candles, EMA 20/50, volume, RSI 14', 'TradingView’s widget (its own prices)', 'TradingView', 'US prices delayed', 'live (TradingView chart)', 'thirdParty', 'Live · TradingView', 'Chart by TradingView · US prices delayed', 'Shipped on the Technical tab; drawn on the desk too'],
    ['Regime chip', 'positive / negative gamma', 'Options chain', 'Massive', 'Snapshot ~60 s', 'not live', 'notLive', 'Not live', '', ''],
    ['Structure field + ladder', 'Gamma by strike, walls, flip, max pain', 'Options chain + stream mid', 'Massive', 'Snapshot ~60 s', 'not live', 'notLive', 'Not live · or Sample', 'Sample · not market data', ''],
    ['Tape trail + structure path', 'Mid trail; score path', 'Stream; scanner history', 'Massive', 'Real time', 'not live', 'notLive', 'Not live', '', ''],
    ['Read strip (8 cells)', 'Opportunity, net DEX, IV/HV, IV rank, Vol/OI, skew, term, off-exchange %', 'Chain, trades, IV store', 'Massive', 'Snapshot', 'not live', 'notLive', 'Not live', '', ''],
    ['AI read', 'Verdict-first brief', 'Chain snapshot + your key', 'Massive + your provider', 'On request', 'not live', 'notLive', 'Not live · sample brief', 'Sample · not market data', 'Paused copy'],
    ['Live tape', 'Net flow, spread, live flip, VWAP', 'Stream, minute bars', 'Massive', 'Real time', 'not live', 'notLive', 'Not live', '', ''],
    ['Position brief', 'Your paper position on this ticker', 'Local book; marks need the chain', 'This browser / account', '—', '—', 'local', 'Stored here', 'marks: last known Oct 8', 'Marks unavailable'],
    ['Sim orders', 'Waiting · triggered · filled', 'Local store; triggers need the stream', 'This browser', '—', 'not live', 'paused', 'Not evaluated', '', ''],
    ['Context band (6 cards)', 'Dealer flow, term, straddle move, fresh positioning, blocks, setups', 'Options chain, trades', 'Massive', 'Snapshot', 'not live', 'notLive', 'Not live', '', ''],
    ['Market context · trend, ATR', 'Trend and average true range', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', 'Massive daily bars today'],
    ['Off-exchange volume (weekly)', 'ATS and non-ATS share of volume', 'FINRA OTC Transparency', 'FINRA', '2 weeks (Tier 1), 4 weeks', 'build / verify', 'delayed', 'Delayed · 2 weeks', 'FINRA OTC · week of Sep 22', 'New: the stand-in for blocks'],
    ['Short interest', 'Share of float short, days to cover, 12 reports', 'FINRA consolidated short interest', 'FINRA', 'Twice a month, ~1 week late', 'live', 'delayed', 'Delayed · 9 days', 'FINRA · settlement Sep 30', ''],
    ['Short-sale volume', 'Daily short-sale share, 20-day average', 'FINRA Reg SHO daily files', 'FINRA', 'Next day', 'live', 'current', 'Updated Oct 12', 'FINRA Reg SHO daily · Oct 12', ''],
    ['Insider trades', 'Sales, buys, 10b5-1 flag, 90 days', 'SEC Form 4', 'SEC EDGAR', 'Minutes after filing', 'switch', 'current', 'Updated', 'SEC Form 4', 'Not set up until SEC_USER_AGENT'],
    ['Insider clusters', 'Several insiders buying within days', 'Derived from Form 4', 'SEC EDGAR', 'Minutes', 'build', 'computed', 'Computed', 'SEC Form 4', ''],
    ['Fails to deliver', 'Settlement fails, twice a month', 'SEC FTD files', 'SEC', 'Twice a month, ~2 weeks late', 'build', 'delayed', 'Delayed · 2 weeks', 'SEC fails-to-deliver', ''],
    ['Recent filings', '8-K, 10-Q, 10-K with items', 'SEC EDGAR submissions', 'SEC EDGAR', 'Within the hour', 'switch', 'current', 'Checked 14:00 UTC', 'SEC EDGAR', 'Not set up until SEC_USER_AGENT'],
  ] },
  { screen: 'Ticker · technical', rows: [
    ['Daily chart (TradingView)', 'Daily candles, EMA 20 and 50, volume, RSI 14', 'TradingView’s advanced-chart widget', 'TradingView, from its own licensed prices', 'US prices delayed (Cboe One)', 'live (TradingView chart)', 'thirdParty', 'Live · TradingView', 'Chart by TradingView · US prices delayed', 'Shipped 2026-10-13; demo keeps sample bars'],
    ['Readings Convexa computes', 'RSI 14, ADX 14, ATR 14 as Convexa figures', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', ''],
    ['Support and resistance', 'Levels from the daily range', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', ''],
    ['Relative strength', 'Against SPY and the sector ETF', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', ''],
    ['Realized volatility', '20/60-day realized vol (implied stays not live)', 'Daily bars licensed to Convexa', 'none yet', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', ''],
  ] },
  { screen: 'Ticker · research (note)', rows: [
    ['Note body and figures', 'The owner’s published note', 'research/&lt;T&gt;/*.md at build', 'The note’s cited sources', 'As written', 'live', 'current', 'Written Oct 13 · Current', 'per figure: 8-K 99.1 · Aug 26', ''],
    ['Valuation range', 'Bear · base · bull per share', 'Computed at build', 'The note’s inputs', 'As written', 'live', 'computed', 'Computed at build', '', ''],
    ['Figures filled from XBRL', 'Each figure against the filing’s tagged value', 'SEC XBRL company facts', 'SEC EDGAR', 'On filing', 'build', 'computed', 'Matches 10-Q', '10-Q · period to Jul 27', ''],
    ['Freshness banner', 'Review due when events pass or a filing lands', 'Note dates + EDGAR', 'Browser + SEC EDGAR', 'Hourly', 'switch', 'current', 'Review due', '', ''],
    ['Who is positioned how', 'Short interest, short volume, insiders', 'FINRA + SEC', 'FINRA · SEC EDGAR', 'Per source', 'live / switch', 'delayed', 'per card', 'per card', ''],
    ['Filed since this note', 'Filings after the note date', 'SEC EDGAR submissions', 'SEC EDGAR', 'Within the hour', 'switch', 'current', 'Checked hourly', 'SEC EDGAR', 'Not set up until SEC_USER_AGENT'],
  ] },
  { screen: 'Research · index and Markets', rows: [
    ['Research index cards', 'Every ticker with notes, stance, freshness', 'Build index', 'research/*.md', 'As written', 'live', 'current', 'Current · Review due', '', ''],
    ['Coming up', 'Catalysts from every note', 'Notes’ events', 'The notes', 'Scheduled', 'live', 'computed', 'Computed', '', ''],
    ['Rates today', '10-year, real 10-year, breakeven, 2s10s, 3-month', 'Treasury par and real curves', 'U.S. Treasury', 'Same day, after the close', 'live', 'current', 'Updated Oct 9', 'U.S. Treasury · par yield curve', ''],
    ['Yield curve vs a year ago', 'The curve, two dates', 'Treasury par curve', 'U.S. Treasury', 'Same day', 'live', 'current', 'Updated Oct 9', 'U.S. Treasury', ''],
    ['Real vs breakeven', 'What moved the 10-year', 'Computed from Treasury', 'U.S. Treasury', 'Same day', 'live', 'computed', 'Computed', 'U.S. Treasury', ''],
    ['Discount-rate drift', 'Notes valued at a rate the 10-year has left', 'Treasury + build index', 'U.S. Treasury · notes', 'Same day', 'live', 'computed', 'Computed', '', ''],
    ['Futures positioning', 'Asset managers and leveraged funds, 3 markets', 'CFTC TFF', 'CFTC', 'Tuesday data, Friday release', 'live', 'delayed', 'As of Oct 6 · out Oct 9', 'CFTC TFF', ''],
    ['Liquidity panel', 'Fed balance sheet less TGA less reverse repo', 'H.4.1, Daily Treasury Statement, NY Fed RRP', 'Fed · Treasury · NY Fed', 'Weekly and daily', 'build', 'current', 'Updated', 'Fed H.4.1 · Oct 8', ''],
    ['Short rates', 'SOFR, effective fed funds, repo volume', 'NY Fed Markets API', 'NY Fed', 'Next morning', 'build', 'current', 'Updated', 'NY Fed · Oct 9', ''],
    ['Treasury auctions', 'Size, tail, bid-to-cover, indirect share', 'Fiscal Data API', 'U.S. Treasury', 'Same day', 'build', 'current', 'Updated', 'TreasuryDirect', ''],
    ['Macro calendar', 'FOMC, CPI, jobs, GDP, PCE, auctions', 'Published schedules', 'Fed · BLS · BEA · Treasury', 'Scheduled ahead', 'build', 'current', 'Scheduled', 'Fed · BLS · BEA', ''],
    ['More futures', '2/5/30-year, Russell, VIX, dollar, gold, crude', 'CFTC TFF + Disaggregated', 'CFTC', 'Tuesday data, Friday release', 'build', 'delayed', 'As of Tue · out Fri', 'CFTC', ''],
  ] },
  { screen: 'Research · Filings and Scorecard', rows: [
    ['Filings feed', 'What landed, kind, in-note standing', 'SEC EDGAR submissions', 'SEC EDGAR', 'Within the hour', 'switch', 'current', 'Checked 14:00 UTC', 'SEC EDGAR', 'Not set up until SEC_USER_AGENT'],
    ['Reported figures', 'Revenue, margins, EPS, cash vs prior', 'SEC XBRL company facts', 'SEC EDGAR', 'On filing', 'switch', 'current', 'From the 10-Q', '10-Q · quarter to Jul 27', ''],
    ['Expected filings', 'Next six weeks, from the notes', 'Notes’ events', 'The notes', 'Scheduled', 'live', 'computed', 'Scheduled', '', ''],
    ['13F holders', 'Quarterly changes by the largest holders', 'SEC 13F-HR information tables', 'SEC EDGAR', '45 days after quarter end, by law', 'build', 'delayed', 'Delayed · 45 days by law', '13F-HR · quarter to Jun 30', ''],
    ['Peer table', 'One concept across a sector for a period', 'XBRL frames API', 'SEC EDGAR', 'On filing', 'build', 'computed', 'Computed', 'XBRL frames · CY2026Q2', ''],
    ['Forecast scorecard', 'Brier, calibration, past due', 'The notes’ forecasts', 'The notes', 'As resolved', 'live', 'computed', 'Computed', '', ''],
    ['Signal track record', 'Scanner setups graded after costs', 'Daily bars licensed to Convexa', 'none yet (TradingView is display-only)', 'End of day', 'blocked', 'notLive', 'Not live · price source', '', 'SignalsOff panel today'],
  ] },
  { screen: 'Scanner', rows: [
    ['Scan table', 'Score, tier, regime, flip, walls, IV/HV, Vol/OI', 'Options chain sweep', 'Massive', '~3-min sweep', 'not live', 'notLive', 'Not live · or Sample', 'Sample · not market data', 'Shows the last board from Oct 8, paused'],
    ['Price column', 'Prices per tick', 'Stream', 'Massive', 'Real time', 'not live', 'notLive', 'Not live', '', ''],
    ['View editor', 'Universe list, your order', '/api/scan/universe', 'Convexa config', '—', '—', 'local', 'Stored here', '', ''],
  ] },
  { screen: 'Positions', rows: [
    ['Book records', 'Your paper positions and history', 'Local store + account sync', 'This browser / account', '—', '—', 'local', 'Stored here', '', ''],
    ['Marks and P&L', 'Mark, P&L, % since entry', 'Contract quotes + stream', 'Massive', 'Snapshot', 'not live', 'paused', 'Last known · Oct 8', '', 'Marks unavailable'],
    ['Capital at risk', 'Max loss across open positions', 'Computed from records', 'Your records', '—', '—', 'computed', 'Computed', '', ''],
    ['Track record', 'How your paper decisions closed', 'Local outcomes', 'Your records', '—', '—', 'local', 'Stored here', '', ''],
    ['Broker tab', 'Webull holdings, read-only', 'Webull API on demand', 'Webull', 'On demand', '—', 'local', 'As of on refresh', 'Webull · read-only', ''],
  ] },
  { screen: 'Alerts', rows: [
    ['Rules composer and list', 'Score gate, tier change, level touch', 'Local store', 'This browser', '—', '—', 'local', 'Stored here', '', ''],
    ['Rule evaluation', 'Fires on an open desk', 'Structure snapshots', 'Massive', 'Snapshot', 'not live', 'notLive', 'Not live', '', '“no rule can fire right now”'],
    ['Calendar and filing rules', 'A release date, a new 8-K (proposal)', 'Macro calendar · EDGAR', 'Fed · BLS · SEC', 'Scheduled · hourly', 'build', 'current', 'Updated', '', 'Proposal, not built'],
  ] },
  { screen: 'Settings and dialogs', rows: [
    ['Account, preferences, risk inputs', 'Saved settings', 'Account API', 'Convexa', '—', '—', 'local', 'Saved', '', ''],
    ['AI providers', 'Your key, model', 'Account API', 'Convexa', '—', '—', 'local', 'Saved', '', ''],
    ['Trade entry · Market and Limit', 'Fill at the mid; resting limit', 'Contract quotes', 'Massive', 'Snapshot', 'not live', 'notLive', 'Not live', '', ''],
    ['Trade entry · Manual price', 'Your own price, user-entered', 'Nothing', 'You', '—', '—', 'local', 'User-entered', '', 'Works today'],
    ['Order detail', 'Plan as placed, lifecycle', 'Local store', 'This browser', '—', '—', 'local', 'Stored here', '', ''],
    ['What’s sent drawer', 'Exactly what leaves for the AI', 'Recommendation export', 'Convexa (snapshot needs Massive)', 'On request', 'not live', 'notLive', 'Not live · sample export', '', ''],
    ['Persona picker', 'How the AI is briefed', 'Local store', 'This browser', '—', '—', 'local', 'Stored here', '', ''],
  ] },
  { screen: 'Site and operator', rows: [
    ['Methodology, blog', 'How Convexa works', 'Static', 'Authored', '—', '—', 'local', '', '', ''],
    ['Lab demos', 'Instrument candidates', 'Synthetic; one SPY button reads the bundle', 'Authored · Massive', '—', 'not live', 'sample', 'Synthetic', '', '“Use live SPY structure” fails'],
    ['Operator metrics', 'Latency by stage', '/api/_metrics', 'Convexa', 'Live', '—', 'local', '', '', ''],
    ['Session archive', 'Stored session books', '/api/_research', 'Convexa', '—', '—', 'local', '', '', ''],
  ] },
];

/** The tools wave: every row of docs/public-data/CANDIDATES.md, grouped as the file groups them. */
export const ROADMAP = [
  { group: 'Rates, money and macro', rows: [
    ['Yield curve, real 10-year, breakeven, 2s10s', 'U.S. Treasury par and real curves', 'Same day, after the close', 'live', 'The risk-free rate every note starts from', 'Markets'],
    ['Each note’s discount-rate drift', 'Treasury 10-year vs each note’s price date', 'Same day', 'live', 'A note comes due when its rate goes stale', 'Markets · notes'],
    ['Liquidity panel', 'Fed H.4.1, Daily Treasury Statement, NY Fed reverse repo', 'Weekly and daily', 'build', 'Net liquidity behind risk appetite', 'Markets'],
    ['Short-rate panel', 'NY Fed Markets API', 'Next morning', 'build', 'Funding stress in SOFR and repo', 'Markets'],
    ['Treasury auctions', 'Fiscal Data API / TreasuryDirect', 'Same day', 'build', 'Demand for duration: tails and bid-to-cover', 'Markets · calendar'],
    ['Macro calendar', 'Fed, BLS, BEA, Treasury schedules', 'Scheduled ahead', 'build', 'Events on Markets; review triggers on notes', 'Markets · notes · alerts'],
    ['Macro series: CPI, payrolls, GDP, PCE', 'BLS API, BEA API (free keys)', 'On release', 'build', 'The print beside its calendar date', 'Markets'],
    ['Other macro series', 'FRED official API (free key)', 'Varies', 'verify', 'Hundreds of series; some third-party copyrighted', 'Markets'],
  ] },
  { group: 'Positioning', rows: [
    ['Asset managers and leveraged funds, 3 markets', 'CFTC TFF', 'Tuesday data, Friday release', 'live', 'Positioning behind index and rates moves', 'Markets'],
    ['More contracts and commodities', 'CFTC TFF + Disaggregated', 'Same', 'build', '2/5/30-year, Russell, VIX, dollar, gold, crude', 'Markets'],
    ['Short interest and days to cover', 'FINRA consolidated short interest', 'Twice a month, ~1 week late', 'live', 'Crowding on the short side', 'Desk · notes'],
    ['Short-sale volume', 'FINRA Reg SHO daily', 'Next day', 'live', 'Daily short share, with its caveat', 'Desk · notes'],
    ['Off-exchange volume by ticker', 'FINRA OTC Transparency', '2 weeks (Tier 1), 4 weeks', 'build / verify', 'The free stand-in for the paid blocks panel', 'Desk'],
    ['Fails to deliver', 'SEC FTD files', 'Twice a month, ~2 weeks late', 'build', 'Settlement stress, with what it does not mean', 'Desk'],
    ['Insider trades, 10b5-1 flag', 'SEC Form 4', 'Minutes after filing', 'switch', 'Who inside is selling or buying', 'Desk · notes'],
    ['Insider clusters', 'Derived from Form 4', 'Minutes', 'build', 'Several insiders buying within days', 'Desk · notes'],
    ['Fund holdings changes', 'SEC 13F-HR information tables', '45 days after quarter end, by law', 'build', 'What the largest holders added and cut', 'Desk · Filings'],
    ['5%+ and activist stakes', 'SEC 13D and 13G', 'Days', 'build', 'A new large holder, and its intent', 'Desk · Filings'],
    ['Congressional stock trades', 'House Clerk, Senate eFD', 'Up to 45 days', 'build', 'Heavy parsing (House PDFs)', 'Desk'],
  ] },
  { group: 'Company facts and research', rows: [
    ['Filings feed, filed since this note', 'SEC EDGAR submissions', 'Within the hour', 'switch', 'A note comes due the day results land', 'Filings · notes'],
    ['Reported figures in the filing detail', 'SEC XBRL company facts', 'On filing', 'switch', 'Revenue, margins, EPS, cash vs prior', 'Filings'],
    ['Note figures filled from XBRL', 'XBRL company facts', 'On filing', 'build', 'Typed figures checked against the filing', 'Note authoring'],
    ['Peer tables', 'XBRL frames API', 'On filing', 'build', 'One concept across a sector for a period', 'Notes · Filings'],
    ['Share count, dilution, buybacks', 'XBRL company facts (dei, cash flow)', 'On filing', 'build', 'Short interest as % of shares out', 'Desk · notes'],
    ['8-K event timeline', 'EDGAR 8-K items', 'Within the hour', 'build', 'Results, executive changes, agreements', 'Desk · Filings'],
    ['Next results date from cadence', 'EDGAR filing history', 'Estimated', 'build', 'A dated review trigger', 'Notes · calendar'],
    ['Government contract awards', 'USAspending.gov', 'Varies', 'build', 'For government-heavy names', 'Notes'],
    ['Forecast scorecard', 'The notes’ own forecasts', 'As resolved', 'live', 'Brier score, calibration, past due', 'Scorecard'],
  ] },
  { group: 'The one gate: daily price history', rows: [
    ['Technical analysis: trend, RSI, ATR, support and resistance', 'TradingView’s chart (EMA 20/50, RSI 14), adopted 2026-10-13; Convexa-computed readings need a licensed feed', 'US prices delayed', 'live (TradingView chart) / blocked (Convexa readings)', 'A live Technical tab now; Convexa’s own readings later', 'Desk · Technical'],
    ['Relative strength vs SPY and the sector; rotation', 'Daily bars licensed to Convexa (none yet)', 'End of day', 'blocked', 'Leadership inside a sector', 'Desk · Markets'],
    ['Realized volatility', 'Daily bars licensed to Convexa (none yet)', 'End of day', 'blocked', 'The free half of IV/HV', 'Desk'],
    ['Correlation and beta matrix', 'Daily bars licensed to Convexa (none yet)', 'End of day', 'blocked', 'How names move together', 'Markets'],
    ['Earnings-move history and seasonality', 'Daily bars licensed to Convexa (none yet)', 'End of day', 'blocked', 'What results days usually do', 'Notes'],
    ['Signal track record after costs', 'Daily bars licensed to Convexa (none yet)', 'End of day', 'blocked', 'Whether the scanner’s setups paid', 'Scorecard'],
    ['Forecast outcomes graded against price', 'Daily bars licensed to Convexa (none yet)', 'End of day', 'blocked', 'Automatic resolution (the forecast half is live)', 'Scorecard'],
  ] },
];

/** Sample figures for the NVDA hybrid desk (illustrative values, not market data). */
export const NVDA = {
  symbol: 'NVDA', name: 'NVIDIA', venue: 'Nasdaq', sector: 'Semiconductors', sectorEtf: 'SMH',
  close: '$226.32', closeDate: 'Mon Oct 12', change: '▲ 1.4%', change52: '$164.27–$243.37', pos52: 75,
  ta: { trend: 'Above its 50- and 200-day averages', sma20: '219.40', sma50: '212.85', sma200: '188.10', rsi: '61', atr: '$6.85', atrPct: '3.0%', hv20: '38%', hv60: '41%', support: '$211.00', resistance: '$243.37', rsSpy: '+8.6 pts', rsSector: '+2.1 pts' },
  closes: [205, 207, 204, 209, 212, 210, 214, 213, 216, 211, 209, 213, 217, 219, 218, 221, 220, 223, 219, 222, 225, 224, 222, 226, 228, 225, 227, 226],
};
