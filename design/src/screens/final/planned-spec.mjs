// Final · Planned — spec cards for the nine planned public-data tools. Sources, delays and status words
// are docs/public-data/CANDIDATES.md's (2026-10-13); routes and API fields are proposed (none of this
// is built: checked against apps/api/src/services/public_data/ and apps/dashboard/src/app/pages/ on
// 2026-10-14). The status word sits only here, under Built so far (P-4).
const STAGING = (what) => `Signed in to the demo account on the Oct 7, 2026 scenario. ${what} Every frame dashed with the hatch stripe, chips “Demo · shaped like …”; no request leaves the browser (sample fixtures in the demo transport).`;
const CORE = ['P-2', 'P-4', 'P-8', 'P-9', 'P-10', 'P-11', 'P-13', 'Env 2026-10-14'];

export const LIQUIDITY_SPEC = {
  title: 'Liquidity',
  route: '/research/markets#liquidity (proposed)',
  job: 'Show how much money the Fed’s balance sheet leaves in the system after the Treasury’s cash and reverse repo, beside the curve every note’s valuation starts from.',
  env: {
    production: 'Live public data: the H.4.1 Wednesday, the Treasury’s cash account and reverse repo for the same day, netted by Convexa. Weekly, after the Thursday release. No mocks.',
    staging: STAGING('The same section on a sample 26-week series ending Sep 30.'),
  },
  widgets: [
    { name: 'Net liquidity chart (line, 26 weeks)', source: 'Fed H.4.1 (Data Download Program) − Treasury DTS operating cash − NY Fed reverse repo · weekly, Thursday 4:30 PM ET', production: ['computed', 'Computed · weekly'], staging: 'demo' },
    { name: 'Inputs: Fed assets, TGA, reverse repo (sparklines)', source: 'Same three sources, own-range scaling stated', production: 'current', staging: 'demo' },
    { name: 'Four-figure strip', source: 'Latest week and its four-week change', production: ['computed', 'Computed'], staging: 'demo' },
  ],
  states: [
    { tag: ['computed', 'Computed · weekly'], when: 'All three inputs exist for the latest H.4.1 Wednesday.' },
    { tag: ['delayed', 'Delayed by source'], when: 'The Fed moved the H.4.1 for a holiday: the card says which week and when it lands.' },
    { tag: 'loading', when: 'First paint; the frame holds its final height.' },
    { tag: 'stale', when: 'One input failed this cycle; last week’s net stays dimmed with when it was fetched.' },
    { tag: ['unavailable', 'Source down · Fed'], when: 'A source is down and nothing is cached: unknown, not empty. Rates and positioning still show.' },
    { tag: 'error', when: 'Convexa’s API didn’t answer: cause and Try again.' },
    { tag: 'empty', when: 'No H.4.1 week and DTS day share a date yet (a fresh deploy).' },
    { tag: 'off', when: 'PUBLIC_DATA=off on this server.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'The section stacks under Positioning: claim, chart at full width (right gutter narrows, minor ticks drop), the three input cards in one column, then the strip as 2×2. Text ≥ 11px; the jump nav scrolls sideways with 44px targets.',
  acceptance: [
    'The claim’s number equals the plotted net change over the last four points (no hand-typed figure, DB-04).',
    'The as-of names the H.4.1 Wednesday and its Thursday release, never the day the page was read.',
    'The y axis says it doesn’t start at zero; the table twin lists every third week with all four columns.',
    'Treasury down: liquidity shows Source down while the curve and CFTC panels still render.',
    'Staging: zero requests to the Fed, Treasury or NY Fed; the frame is dashed and hatched.',
  ],
  built: [
    { status: 'shipped', what: 'API (2026-10-15): the H.4.1 total assets (Data Download Program, found by its identifier H41/H41/RESPPMA_N.WW), the Treasury’s TGA closing balance (Fiscal Data DTS) and NY Fed reverse repo, fetched together and netted per Wednesday (the same day, or the business day before it within four days); 26 weeks; PublicMarketsWire.liquidity (apps/api/src/services/public_data/liquidity.rs, tested against the three real answers).' },
    { status: 'shipped', what: 'The section on /research/markets (LiquiditySection.tsx): the four-figure strip with four-week changes, the net line on an axis that says it doesn’t start at zero, the three inputs on their own stated ranges, a table twin, and a title computed from the figures that names the input that moved most. Checked live: $5.86T for the week to Oct 7.' },
    { status: 'partial', what: 'Not yet: event marks on the line (quarter ends, FOMC, tax dates), and a Delayed by source tag when the Fed moves the H.4.1 for a holiday (the frame shows the last Wednesday it has).' },
    { status: 'shipped', what: 'The host page (/research/markets: Treasury curve, CFTC positioning) and its state words.', host: true },
  ],
  rulings: ['P-1', ...CORE],
  code: ['apps/api/src/services/public_data/{fed_h41,fiscal_dts,nyfed}.rs (new)', 'apps/api/src/routes/public_data.rs · PublicMarketsWire.liquidity (new)', 'apps/dashboard/src/app/pages/research/MarketsPage.tsx', 'libs/api/src/lib/demo/public-data.ts (sample fixture)'],
};

export const CALENDAR_SPEC = {
  title: 'Calendar · releases and results',
  route: '/research/markets#coming-up (proposed) · review triggers on /research and each note',
  job: 'Put the next six weeks of macro releases and the followed companies’ results dates in one place, and mark which notes each one makes due.',
  env: {
    production: 'Live: the Fed, BLS, BEA and Treasury published schedules, the notes’ own dated catalysts, and windows estimated from each company’s EDGAR filing history (needs SEC_USER_AGENT for the estimates; without it, those rows fall back to the notes’ dates).',
    staging: STAGING('The demo’s six names on sample dates around the Oct 7 scenario.'),
  },
  widgets: [
    { name: 'Six-week grid (macro, from the note, estimated)', source: 'Agency schedules (scheduled ahead) · note catalysts (build time) · EDGAR cadence (on filing)', production: ['current', 'Scheduled'], staging: 'demo' },
    { name: '“Makes due” markers', source: 'The notes’ review rules: results and periodic filings; FOMC for valued notes', production: ['computed', 'From the notes'], staging: 'demo' },
  ],
  states: [
    { tag: ['current', 'Scheduled'], when: 'Every agency schedule read within its refresh window.' },
    { tag: ['delayed', 'Moved by source'], when: 'An agency moved a release (a shutdown, a holiday): the new date with “moved from Oct 15”.' },
    { tag: ['computed', 'Estimated'], when: 'No announced date: a dashed window from the last four 10-Q/10-K dates.' },
    { tag: 'notConfigured', when: 'SEC_USER_AGENT unset: estimated windows can’t be drawn; rows say so and keep the notes’ dates.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'stale', when: 'A schedule failed to refresh; last good copy with its date.' },
    { tag: 'error', when: 'Convexa’s API didn’t answer.' },
    { tag: 'empty', when: 'A quiet week shows “Nothing scheduled”; six empty weeks teach what will appear.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'The six week columns become one list, week by week; each event a card with date, name, source and its “Makes due” line. The key wraps above the list.',
  acceptance: [
    'Estimated dates are drawn as dashed windows and labelled “Estimated from filing history”; they never look like announced dates.',
    'A release the agency moves shows its new date within one refresh and says it moved.',
    'Every results row names the note it makes due; FOMC rows say “every valued note”.',
    'Counts in the claim (companies reporting) match the grid.',
    'Staging: only the demo’s six names appear; no request leaves the browser.',
  ],
  built: [
    { status: 'shipped', what: 'API (2026-10-15): PublicMarketsWire.calendar from the Fed’s FOMC calendar page, BLS’s iCalendar schedule (CPI, PPI, jobs report), BEA’s release-dates file (GDP, PCE) and Treasury’s refunding page (the next refunding statement), all keyless, read twice a day; a release that moves carries the date it moved from (calendar.rs, tested against real saved answers). PublicFilingsWire.results: each company’s expected window from its last four 8-K 2.02 dates, or its 10-Q and 10-K dates (needs SEC_USER_AGENT).' },
    { status: 'shipped', what: 'The section on /research/markets#coming-up (ComingUpSection.tsx): six week columns of releases, the notes’ dated results and dashed estimated windows; each results row names its note, the FOMC every valued note; the claim counts the companies in the grid; without SEC_USER_AGENT the rows keep the notes’ dates and say so. The demo draws the scenario’s sample calendar (libs/api/src/lib/demo/calendar.ts).' },
    { status: 'partial', what: 'Not yet: review triggers from the calendar on /research and on each note, and a release’s reference period (“CPI”, not “CPI, September”: the schedules don’t state it).' },
    { status: 'partial', what: 'The notes’ own catalysts already drive “Coming up” on /research and the note’s “comes due” card (build time).' },
  ],
  rulings: [...CORE],
  code: ['apps/api/src/services/public_data/calendar.rs (new: Fed, BLS, BEA, Treasury schedules)', 'apps/api/src/services/public_data/edgar.rs (filing cadence)', 'apps/dashboard/src/app/pages/research/MarketsPage.tsx · noteContext.ts (review triggers)'],
};

export const OTC_SPEC = {
  title: 'Off-exchange volume',
  route: '/ticker/:symbol/research · public-record band (proposed)',
  job: 'Show how many of a name’s shares traded away from exchanges each week, the free stand-in for the paid block-trade panel.',
  env: {
    production: 'Live once FINRA’s display terms are confirmed: FINRA OTC Transparency weekly ATS and non-ATS shares, two weeks late for Tier 1 names, four for the rest. No mocks.',
    staging: STAGING('Twelve sample weeks ending Sep 14.'),
  },
  widgets: [
    { name: 'Weekly stacked bars (ATS, non-ATS) with the 12-week median', source: 'FINRA OTC Transparency · 2 weeks (Tier 1), 4 weeks (others)', production: ['delayed', 'Delayed by source · 2 weeks'], staging: 'demo' },
    { name: 'Side-column summary card', source: 'Latest week’s total and its median', production: ['delayed', 'Delayed by source'], staging: 'demo' },
  ],
  states: [
    { tag: ['delayed', 'Delayed by source · 2 weeks'], when: 'Always: FINRA publishes late by design.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'empty', when: 'FINRA lists no off-exchange trades for the symbol that week (a fund, a thin name).' },
    { tag: 'stale', when: 'FINRA failed this cycle; the earlier copy, dimmed, with its time.' },
    { tag: 'unavailable', when: 'FINRA down, nothing cached.' },
    { tag: 'error', when: 'Convexa’s API didn’t answer.' },
    { tag: 'off', when: 'PUBLIC_DATA=off, or FINRA’s terms rule out public display (then the card is removed, not greyed).' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'Bars keep all 12 weeks; every other date label drops; the median label moves into the subtitle. The table twin scrolls sideways inside its frame.',
  acceptance: [
    'The chart shows shares, never a percent of total volume (no free consolidated volume to divide by).',
    'The as-of names the week and its publication date; Tier 2 names say four weeks.',
    'The note under the chart says it is not block trades and carries no direction.',
    'FINRA’s attribution line from the existing short-data cards appears under the band.',
  ],
  built: [
    { status: 'todo', what: 'Status: build / verify. Source reachable; FINRA’s public-display terms unchecked (open question Q-2). Un-parked by owner (2026-10-15).' },
    { status: 'shipped', what: 'The band’s neighbours: FINRA short interest and short-sale volume cards (live).', host: true },
  ],
  rulings: ['P-1', ...CORE],
  code: ['apps/api/src/services/public_data/finra.rs (+ OTC Transparency weekly)', 'apps/api/src/routes/public_data.rs · PublicTickerWire.off_exchange (new)', 'apps/dashboard/src/app/pages/research/NotePublicPanels.tsx'],
};

export const CLUSTERS_SPEC = {
  title: 'Insider clusters',
  route: '/ticker/:symbol/research · Insider trades, expanded (proposed)',
  job: 'Tell a cluster of insiders buying on the open market apart from routine sales under pre-set plans.',
  env: {
    production: 'Live after the switch: SEC Form 4 through EDGAR, minutes after filing. Until SEC_USER_AGENT is set, the card shows Not set up (as the Insider trades card does today).',
    staging: STAGING('A sample with one buying cluster, so the cluster form is visible.'),
  },
  widgets: [
    { name: 'Form 4 timeline by insider (12 months)', source: 'SEC EDGAR Form 4 · minutes after filing; trades up to 2 business days earlier', production: ['computed', 'Computed from Form 4'], staging: 'demo' },
    { name: 'Cluster windows table', source: 'Derived: 3+ insiders, open-market purchases, 10 days', production: ['computed', 'Computed'], staging: 'demo' },
  ],
  states: [
    { tag: ['computed', 'Computed from Form 4'], when: 'EDGAR answered; clusters derived.' },
    { tag: ['empty', 'No cluster'], when: 'No buying cluster in the window: says so and what one would be.' },
    { tag: 'notConfigured', when: 'Production today: SEC_USER_AGENT unset.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'stale', when: 'EDGAR failed this cycle; last good copy with its time.' },
    { tag: 'unavailable', when: 'EDGAR down, nothing cached.' },
    { tag: 'error', when: 'Convexa’s API didn’t answer.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'Role names shorten to a 120px column; months show every other label; the cluster windows table stays under “Show the numbers”.',
  acceptance: [
    'Only open-market purchases count toward a cluster; 10b5-1 plan sales never do, and the note says so.',
    'Dots are placed by trade date, not by index (DB-08).',
    'Roles, not names, on the chart; each dot links to its filing.',
    'With SEC_USER_AGENT unset the card says Not set up, not empty.',
  ],
  built: [
    { status: 'todo', what: 'Status: build (after the switch). Needs per-transaction Form 4 rows; today’s wire only carries totals. Un-parked by owner (2026-10-15).' },
    { status: 'shipped', what: 'Insider trades card (90-day sales, buys, plan count) behind SEC_USER_AGENT: “switch”.', host: true },
  ],
  rulings: [...CORE],
  code: ['apps/api/src/services/public_data/edgar.rs (Form 4 transactions)', 'apps/api/src/routes/public_data.rs · InsidersWire.transactions, .clusters (new)', 'apps/dashboard/src/app/pages/research/NotePublicPanels.tsx · InsidersCard'],
};

export const HOLDERS_SPEC = {
  title: 'Fund holdings (13F)',
  route: '/ticker/:symbol/research · public-record band (proposed)',
  job: 'Show who the largest institutional holders are and what they added or cut last quarter, with the 45-day lag stated.',
  env: {
    production: 'Live after the switch: 13F-HR information tables read per filing (not the bulk datasets), as a % of shares outstanding from XBRL. Arrives up to 45 days after the quarter.',
    staging: STAGING('Six sample holders.'),
  },
  widgets: [
    { name: 'Largest holders, % of shares (bar list)', source: 'SEC 13F-HR per filing · 45 days after quarter end · shares outstanding from XBRL dei', production: ['delayed', 'Delayed by law · 45 days'], staging: 'demo' },
    { name: 'Filing-window line', source: 'Count of 13F-HRs filed for the open quarter', production: ['current', 'Updated'], staging: 'demo' },
  ],
  states: [
    { tag: ['delayed', 'Delayed by law · 45 days'], when: 'Always.' },
    { tag: ['current', 'Window open'], when: 'Oct 1 – Nov 16: the new quarter is arriving; the chart stays on the complete quarter until the deadline.' },
    { tag: 'empty', when: 'No 13F filer reports the security (small names, funds).' },
    { tag: 'notConfigured', when: 'SEC_USER_AGENT unset.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'stale', when: 'EDGAR failed; last good copy.' },
    { tag: 'error', when: 'Convexa’s API didn’t answer.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'Holder names wrap in a 150px column; value labels stay at the bar ends; the strip above becomes 2×2.',
  acceptance: [
    'Change is in points of shares outstanding, not share counts, so splits and buybacks never read as buying.',
    'The chart never mixes quarters: during the filing window it stays on the last complete quarter.',
    'The subtitle says 13F covers long US-listed positions only.',
    'Holder names appear as filed (the board shows placeholders).',
  ],
  built: [{ status: 'todo', what: 'Status: build. Per-filing 13F parsing not started; shares outstanding already switches on with SEC_USER_AGENT. Un-parked by owner (2026-10-15).' }],
  rulings: [...CORE],
  code: ['apps/api/src/services/public_data/edgar_13f.rs (new)', 'apps/api/src/routes/public_data.rs · PublicTickerWire.holders (new)', 'apps/dashboard/src/app/pages/research/NotePublicPanels.tsx'],
};

export const XBRL_SPEC = {
  title: 'Figures against the filing',
  route: '/ticker/:symbol/research · “Checked against the filing” (proposed) · research check in npm run verify',
  job: 'Check every figure a note states against the value the filing tags for the same period, for readers on the note and for the author before it publishes.',
  env: {
    production: 'Live after the switch: SEC XBRL company facts for each cited 10-Q/10-K. Until SEC_USER_AGENT is set, the section shows Not set up. The note’s own figure is never rewritten.',
    staging: STAGING('Four sample figures against a sample 10-Q, one differing by a cent.'),
  },
  widgets: [
    { name: 'Check table (figure, note, filing, concept, check)', source: 'XBRL company facts · on filing', production: ['computed', 'Checked against the filing'], staging: 'demo' },
    { name: 'Revenue as filed, five fiscal years', source: 'XBRL company facts, each 10-K', production: ['current', 'Updated · on filing'], staging: 'demo' },
  ],
  states: [
    { tag: [['computed', 'Checked against the filing']], when: 'Every figure resolved. Per row: Matches when equal at the note’s precision; Computed for derived figures (free cash flow).' },
    { tag: 'Check · Differs', when: 'The figure differs from the filing: both shown, the gap stated, burnt orange with the warning glyph.' },
    { tag: 'Check · Not tagged', when: 'No standard concept (guarantees, backlog): the note cites the filing instead.' },
    { tag: ['delayed', 'Facts not in yet'], when: 'The 10-Q is filed but its XBRL facts haven’t reached the API (usually within a day).' },
    { tag: 'notConfigured', when: 'SEC_USER_AGENT unset (production today).' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'error', when: 'The company-facts request failed.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'Each row becomes a card: figure on top, note and filing values side by side, concept below in mono, the check last.',
  acceptance: [
    'A differing figure shows both values and the gap; the note’s text is unchanged.',
    'The research check in npm run verify lists the same differences and fails on any it can’t explain.',
    '“Differs” uses the warning glyph and burnt orange, never red/green.',
    'Concepts with no standard tag say “Not tagged · cites the filing”, never a dash alone.',
  ],
  built: [
    { status: 'todo', what: 'Status: build. Note figures carry no XBRL concept yet; no comparison exists. Un-parked by owner (2026-10-15).' },
    { status: 'shipped', what: 'Reported figures in the Filings detail (FactWire, six concepts) behind SEC_USER_AGENT: “switch”.', host: true },
  ],
  rulings: [...CORE],
  code: ['research/<TICKER>/*.md (figure concepts in front matter)', 'apps/api/src/services/public_data/edgar.rs (company facts)', 'apps/dashboard/src/app/pages/research/NotePublicPanels.tsx', 'tools/ (research check, new)'],
};

export const PEERS_SPEC = {
  title: 'Peers',
  route: '/ticker/:symbol/research · “Against its peers” (proposed)',
  job: 'Place a company against its sector on one reported concept for the same calendar quarter.',
  env: {
    production: 'Live after the switch: the SEC XBRL frames API, one concept across every filer for a calendar quarter. Peer lists come from the note’s front matter.',
    staging: STAGING('Five sample peers.'),
  },
  widgets: [
    { name: 'Dot strips: gross margin and revenue growth', source: 'XBRL frames API · on filing; frames align to calendar quarters', production: ['computed', 'Computed · CY2026 Q2'], staging: 'demo' },
  ],
  states: [
    { tag: ['computed', 'Computed'], when: 'At least four peers have filed for the quarter.' },
    { tag: ['delayed', '2 of 9 not filed'], when: 'Some peers haven’t filed yet: they’re listed as missing, never dropped silently.' },
    { tag: 'empty', when: 'Fewer than four peers filed: nothing to compare yet.' },
    { tag: 'notConfigured', when: 'SEC_USER_AGENT unset.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'error', when: 'The frames request failed.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'The two strips stack; only NVDA and the extremes keep labels; every value stays in the table.',
  acceptance: [
    'The note’s company is filled; peers are rings; the zero line shows on growth whenever a peer is negative (P-11).',
    'The subtitle names the calendar quarter and the note explains fiscal-quarter mapping.',
    'Missing filers are named in the as-of line.',
  ],
  built: [{ status: 'todo', what: 'Status: build. No frames fetcher; peer lists not in note front matter yet. Un-parked by owner (2026-10-15).' }],
  rulings: [...CORE],
  code: ['apps/api/src/services/public_data/xbrl_frames.rs (new)', 'apps/dashboard/src/app/pages/research/NotePublicPanels.tsx'],
};

export const SIGNALS_SPEC = {
  title: 'Signal track record',
  route: '/research/scorecard#signals',
  job: 'Grade the scanner’s setups after trading costs, with how sure each rate is, beside the notes’ forecast calibration.',
  env: {
    production: 'Today: Not live · price source (shipped). The design target, drawn here with illustrative values, needs two things production doesn’t have: a daily price history licensed for public display, and the scanner’s setups, which come from the options feed.',
    staging: STAGING('The demo’s authored setups graded on sample prices.'),
  },
  widgets: [
    { name: 'Rate with 95% interval, by setup', source: 'Scanner setup log + daily closes licensed to Convexa · graded 5 sessions after each setup', production: ['notLive', 'Not live · price source'], staging: 'demo' },
  ],
  states: [
    { tag: ['notLive', 'Not live · price source'], when: 'Production today and until both inputs exist.' },
    { tag: ['sample', 'Design target'], when: 'This board only: the target drawn on illustrative values.' },
    { tag: 'computed', when: 'Graded: rates with intervals and n.' },
    { tag: ['empty', 'Too few to judge'], when: 'Fewer than 20 graded setups for a family: its row says so instead of a rate.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'error', when: 'Grading failed to load.' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'Setup names move above each interval row; the axis keeps 0, 50 and 100%.',
  acceptance: [
    'Every rate shows its interval and n; a family under 20 says “too few to judge”.',
    'Costs are stated (0.10% round trip) in the subtitle.',
    'Production shows Not live with the reason and a link to the demo until both inputs exist.',
  ],
  built: [
    { status: 'todo', what: 'Status: blocked. Needs daily prices licensed for public display; also needs setups, which need Massive in production. Un-parked by owner (2026-10-15).' },
    { status: 'shipped', what: 'The Not live panel on /research/scorecard (SignalsOff).', host: true },
  ],
  rulings: ['P-1', 'P-3', ...CORE],
  code: ['apps/dashboard/src/app/pages/research/ScorecardPage.tsx · SignalsOff', 'apps/dashboard/src/app/features/trading/outcomes/ledger.ts (setup outcomes)'],
};

export const TA_SPEC = {
  title: 'Technical readings',
  route: '/ticker/:symbol/technical-analysis · under TradingView’s chart',
  job: 'Give the readings Convexa computes itself (trend, RSI, ATR, realized volatility, support and resistance, relative strength) next to TradingView’s display-only chart.',
  env: {
    production: 'TradingView’s chart is live (shipped). Convexa’s readings show Not live · price source until it holds a daily price history licensed for public display; this row draws their design target with illustrative values.',
    staging: STAGING('Computed in the browser from the demo’s 60 sample bars (EMA, RSI, ADX, ATR ship today; realized vol, support and resistance, relative strength are new).'),
  },
  widgets: [
    { name: 'TradingView chart', source: 'TradingView widget, its own licensed delayed prices', production: 'thirdParty', staging: ['computed', 'Computed · sample bars'] },
    { name: 'Readings grid', source: 'Daily bars licensed to Convexa (none yet)', production: ['notLive', 'Not live · price source'], staging: 'demo' },
    { name: 'Relative strength vs SPY and SMH (small multiples)', source: 'Same bars, rebased to 100', production: ['notLive', 'Not live · price source'], staging: 'demo' },
  ],
  states: [
    { tag: 'thirdParty', when: 'TradingView’s frame, production.' },
    { tag: ['notLive', 'Not live · price source'], when: 'Production readings today.' },
    { tag: ['sample', 'Design target'], when: 'This board only.' },
    { tag: 'computed', when: 'Readings on the last bar, once licensed.' },
    { tag: ['empty', 'Insufficient history'], when: 'A reading with fewer bars than its window: the count, never a zero.' },
    { tag: 'loading', when: 'First paint.' },
    { tag: 'error', when: 'Bars failed to load (staging: Retry demo).' },
    { tag: 'demo', when: 'Staging.' },
  ],
  phone: 'TradingView’s frame first at 480px, then the readings as a 2-column grid, the range bar and the two relative-strength panels stacked.',
  acceptance: [
    'No reading is computed from TradingView’s frame; the note under the readings says so.',
    'Production readings show Not live with the reason and a link to the demo’s Technical tab.',
    'Relative strength is two small panels (≤ 3 series each, P-9), rebased to 100 with the 100 line drawn.',
    'Realized volatility is labelled “not implied vol”.',
  ],
  built: [
    { status: 'todo', what: 'Status: blocked (Convexa readings). Needs a daily price history licensed for public display (Twelve Data Venture the cheapest clear path, unconfirmed). Un-parked by owner (2026-10-15).' },
    { status: 'shipped', what: 'TradingView’s chart, live (status live, adopted 2026-10-13); staging’s EMA 20/50, RSI 14, ADX 14, ATR 14 from sample bars.', host: true },
  ],
  rulings: ['P-1', 'P-14', ...CORE],
  code: ['apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisLive.tsx · TechnicalAnalysisView.tsx', 'libs/api/src/lib/demo/indicators.ts'],
};
