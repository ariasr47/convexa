/**
 * The seven sources the site reads, in the order /credits lists them. Static copy: what each card says
 * about its source never depends on the live state check. Each id is the card's deep-link anchor
 * (/credits#finra-si).
 *
 * Design: design/src/screens/final/trust-pages.mjs (SOURCES). Copy is a draft for the owner to
 * review; not legal advice.
 */
export type SourceId =
  'treasury' | 'cftc' | 'finra-si' | 'finra-shvol' | 'sec' | 'tradingview' | 'massive';

export interface Source {
  id: SourceId;
  toc: string;
  name: string;
  owner: string;
  reads: string;
  cadence: string;
  terms: string;
  /** FINRA's notice follows the terms. */
  finra?: boolean;
  privacy?: string;
  where: string;
  link: readonly [label: string, href: string];
  /** Staging: what the demo's sample data is shaped like. */
  shaped?: string;
  operator?: string;
}

const FINRA_TERMS =
  'FINRA’s terms for its free equity data (§2.3) ask for this notice wherever the data, or anything worked out from it, appears:';

export const SOURCES: readonly Source[] = [
  {
    id: 'treasury',
    toc: 'U.S. Treasury',
    name: 'Daily Treasury yield curve rates',
    owner: 'U.S. Department of the Treasury',
    reads:
      'The daily par yield curve (3-month, 2-, 5-, 10- and 30-year) and the daily real yield curve (10-year).',
    cadence:
      'Every business day, after the close (published after 3:30 PM ET). Convexa checks every 6 hours.',
    terms:
      'U.S. government data, free to show on a public site. Convexa credits the Treasury on every card that uses it.',
    where: 'Research → Markets, and the discount-rate check on each research note.',
    link: [
      'Treasury interest-rate data',
      'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',
    ],
    shaped: 'Treasury’s daily curves',
  },
  {
    id: 'cftc',
    toc: 'CFTC',
    name: 'Traders in Financial Futures',
    owner: 'Commodity Futures Trading Commission (CFTC)',
    reads:
      'Net positions of asset managers and leveraged funds in 10-year T-note, E-mini S&P 500 and E-mini Nasdaq-100 futures.',
    cadence:
      'Weekly. Positions as of Tuesday, published Friday afternoon. Convexa checks every 12 hours.',
    terms: 'U.S. government data, free to show on a public site, credited to the CFTC.',
    where: 'Research → Markets, and the positioning card under each ticker’s note.',
    link: [
      'CFTC Commitments of Traders',
      'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
    ],
    shaped: 'the CFTC’s weekly report',
  },
  {
    id: 'finra-si',
    toc: 'FINRA short interest',
    name: 'Consolidated short interest',
    owner: 'FINRA (Financial Industry Regulatory Authority)',
    reads: 'Shares sold short and days to cover for each followed ticker, at each settlement date.',
    cadence:
      'Twice a month, about a week after each settlement date. Convexa checks every 12 hours.',
    terms: FINRA_TERMS,
    finra: true,
    where: 'The positioning card under each ticker’s research note.',
    link: [
      'FINRA short interest',
      'https://www.finra.org/finra-data/browse-catalog/equity-short-interest',
    ],
    shaped: 'FINRA’s short-interest file',
  },
  {
    id: 'finra-shvol',
    toc: 'FINRA short-sale volume',
    name: 'Reg SHO daily short-sale volume',
    owner: 'FINRA (Financial Industry Regulatory Authority)',
    reads:
      'Each trading day’s short-sale volume and total volume for each followed ticker. Convexa works out the short share and its 20-day average.',
    cadence: 'Every trading day, one business day late. Convexa reads each day’s file once.',
    terms: FINRA_TERMS,
    finra: true,
    where: 'The positioning card under each ticker’s research note.',
    link: [
      'FINRA short-sale volume',
      'https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data',
    ],
    shaped: 'FINRA’s daily Reg SHO files',
  },
  {
    id: 'sec',
    toc: 'SEC EDGAR',
    name: 'EDGAR filings and company facts',
    owner: 'U.S. Securities and Exchange Commission (SEC)',
    reads:
      'Filings of the last 90 days, Form 4 insider trades, and the figures companies report in 10-Q, 10-K and 20-F filings (XBRL company facts).',
    cadence:
      'As filed: a filing appears minutes after the SEC accepts it. Convexa checks filings every hour and company facts every 24 hours.',
    terms:
      'Public record, free to show. The SEC asks every program that reads EDGAR to identify itself with a name and a contact address.',
    where:
      'Research → Filings, the insider card and “Filed since this note” under each ticker’s note.',
    link: ['SEC EDGAR', 'https://www.sec.gov/edgar'],
    shaped: 'SEC EDGAR filings',
    operator:
      'Set SEC_USER_AGENT on the API to a name and contact address, such as “Convexa research <address>”.',
  },
  {
    id: 'tradingview',
    toc: 'TradingView',
    name: 'Advanced chart widget',
    owner: 'TradingView',
    reads:
      'Nothing. TradingView draws daily candles, the 20- and 50-day EMAs and RSI 14 from its own prices, inside a frame on the Technical tab and the desk’s daily price panel.',
    cadence: 'TradingView’s own. US prices are delayed (Cboe One).',
    terms:
      'Display only: Convexa reads, stores and computes nothing from the frame (TradingView policies §3). TradingView’s attribution stays exactly as it publishes it (§4).',
    privacy:
      'Loading the chart sends your browser’s IP address and the page’s address to TradingView.',
    where: 'Ticker → Technical; the ticker desk’s daily price panel.',
    link: ['TradingView', 'https://www.tradingview.com'],
  },
  {
    id: 'massive',
    toc: 'Massive options feed',
    name: 'Options and stock market data',
    owner: 'Massive',
    reads:
      'On a site that subscribes: option chains with greeks and implied volatility, option trades and quotes, and stock prices — the inputs to dealer structure, flow, the tape, scores and AI reads.',
    cadence: 'Streaming during market hours.',
    terms: 'A paid subscription. This site doesn’t subscribe.',
    where:
      'The ticker desk’s structure, flow and AI read; the scanner; option prices in trade entry.',
    link: ['Massive', 'https://massive.com'],
    shaped: 'the Massive options feed',
  },
];

export const TYPEFACES = [
  // Copyright lines as each OFL.txt states them (public/fonts/*/OFL.txt).
  ['IBM Plex Sans', 'Copyright 2019 IBM Corp.', '/fonts/ibm-plex-sans/OFL.txt'],
  ['IBM Plex Mono', 'Copyright 2017 IBM Corp.', '/fonts/ibm-plex-mono/OFL.txt'],
  ['Archivo', 'Copyright 2020 The Archivo Project Authors', '/fonts/archivo/OFL.txt'],
] as const;
