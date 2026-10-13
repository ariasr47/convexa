import type {
  PublicFact,
  PublicFiling,
  PublicFilings,
  PublicMarkets,
  PublicPeriodicFiling,
  PublicPositionGroup,
  PublicTicker,
  PublicYieldPoint,
} from '../convexa';

/**
 * Demo answers for the public-data endpoints. Every figure here is authored for the demo — none
 * was fetched from FRED, CFTC, FINRA or SEC — and every answer says so in `detail` and `source`.
 * Nothing in this module makes a request.
 */

/** The frozen instant the rest of the demo transport answers at. */
const DEMO_TIME = '2026-10-07T18:30:00Z';
const DEMO_DATE = '2026-10-07';
const DAY_MS = 86_400_000;
const SAMPLE = 'Demo sample: authored figures shaped like the live feeds; nothing was fetched.';
const MAX_TICKERS = 30;
const TICKER = /^[A-Z][A-Z.-]{0,9}$/;

interface Profile {
  /** Illustrative round numbers, not reported values. */
  shares: number | null;
  shortInterest: number;
  dailyVolume: number;
  shortRatio: number;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  cash: number | null;
}

const PROFILES: Record<string, Profile> = {
  SPY: {
    shares: null,
    shortInterest: 2.6e8,
    dailyVolume: 7.0e7,
    shortRatio: 0.52,
    revenue: null,
    netIncome: null,
    eps: null,
    cash: null,
  },
  QQQ: {
    shares: null,
    shortInterest: 1.1e8,
    dailyVolume: 4.5e7,
    shortRatio: 0.55,
    revenue: null,
    netIncome: null,
    eps: null,
    cash: null,
  },
  AAPL: {
    shares: 1.5e10,
    shortInterest: 1.2e8,
    dailyVolume: 5.0e7,
    shortRatio: 0.4,
    revenue: 9.0e10,
    netIncome: 2.3e10,
    eps: 1.5,
    cash: 3.0e10,
  },
  MSFT: {
    shares: 7.4e9,
    shortInterest: 6.0e7,
    dailyVolume: 2.0e7,
    shortRatio: 0.42,
    revenue: 7.5e10,
    netIncome: 2.7e10,
    eps: 3.6,
    cash: 3.0e10,
  },
  NVDA: {
    shares: 2.4e10,
    shortInterest: 3.0e8,
    dailyVolume: 1.5e8,
    shortRatio: 0.47,
    revenue: 4.5e10,
    netIncome: 2.5e10,
    eps: 1.0,
    cash: 1.2e10,
  },
  TSLA: {
    shares: 3.2e9,
    shortInterest: 8.0e7,
    dailyVolume: 9.5e7,
    shortRatio: 0.45,
    revenue: 2.2e10,
    netIncome: 1.2e9,
    eps: 0.35,
    cash: 1.6e10,
  },
};

const round = (value: number, places = 2) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Weekdays of the 400 days ending on the demo date, oldest first, on a smooth authored path. */
function demoYields(): PublicYieldPoint[] {
  const end = Date.parse(`${DEMO_DATE}T00:00:00Z`);
  const points: PublicYieldPoint[] = [];
  for (let back = 399; back >= 0; back -= 1) {
    const ms = end - back * DAY_MS;
    const weekday = new Date(ms).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const t = (399 - back) / 399;
    const wave = Math.sin(t * Math.PI * 3) * 0.12;
    points.push({
      date: isoDay(ms),
      t3m: round(4.35 - 0.2 * t + wave * 0.3),
      t2y: round(3.9 + 0.8 * t + wave),
      t5y: round(3.95 + 0.95 * t + wave),
      t10y: round(4.15 + 1.0 * t + wave * 0.9),
      t30y: round(4.7 + 0.85 * t + wave * 0.7),
      real10y: round(1.8 + 1.05 * t + wave * 0.6),
    });
  }
  return points;
}

function group(
  net: number,
  weekChange: number,
  min: number,
  max: number,
  median: number,
): PublicPositionGroup {
  return {
    net,
    week_change: weekChange,
    min_3y: min,
    max_3y: max,
    median_3y: median,
    position_in_range: round((net - min) / (max - min), 3),
    weeks: 156,
  };
}

export function demoPublicMarkets(): PublicMarkets {
  const daily = demoYields();
  const latest = daily[daily.length - 1];
  const yearAgo = [...daily].reverse().find((p) => p.date <= '2025-10-07') ?? null;
  return {
    state: 'live',
    detail: SAMPLE,
    rates: {
      source: 'Demo sample (shaped like Federal Reserve H.15 via FRED)',
      as_of: latest.date,
      fetched_at: DEMO_TIME,
      latest,
      year_ago: yearAgo,
      daily,
    },
    futures: {
      source: 'Demo sample (shaped like CFTC Traders in Financial Futures)',
      report_date: '2026-10-06',
      fetched_at: DEMO_TIME,
      markets: [
        {
          code: '043602',
          name: '10-year T-note',
          exchange: 'CBOT',
          asset_managers: group(2_700_000, 48_000, 1_900_000, 2_800_000, 2_350_000),
          leveraged_funds: group(-2_050_000, -61_000, -2_300_000, -1_100_000, -1_700_000),
        },
        {
          code: '13874A',
          name: 'E-mini S&P 500',
          exchange: 'CME',
          asset_managers: group(880_000, 9_000, 610_000, 990_000, 820_000),
          leveraged_funds: group(-390_000, -22_000, -460_000, -120_000, -280_000),
        },
        {
          code: '209742',
          name: 'E-mini Nasdaq-100',
          exchange: 'CME',
          asset_managers: group(70_000, 3_100, 31_000, 82_000, 58_000),
          leveraged_funds: group(-21_000, 4_700, -64_000, -4_000, -30_000),
        },
      ],
    },
  };
}

/** SEC's company browse page for the ticker: a real page, since the demo filings are not. */
const secBrowse = (ticker: string) =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(ticker)}&owner=include&count=40`;

function demoFilingsFor(ticker: string): PublicFiling[] {
  const profile = PROFILES[ticker];
  if (!profile || profile.revenue === null) return [];
  const index = Object.keys(PROFILES).indexOf(ticker);
  const filing = (
    n: number,
    form: string,
    filed: string,
    kind: PublicFiling['kind'],
    items: string[],
    reportDate: string | null,
  ): PublicFiling => ({
    ticker,
    cik: '0000000000',
    accession: `0000000000-26-${String(index * 10 + n).padStart(6, '0')}`,
    form,
    items,
    filed,
    report_date: reportDate,
    description: 'Demo sample filing',
    url: secBrowse(ticker),
    kind,
  });
  return [
    filing(3, '8-K', '2026-09-24', 'other', ['5.07'], '2026-09-22'),
    filing(2, '10-Q', '2026-08-27', 'periodic', [], '2026-07-26'),
    filing(1, '8-K', '2026-08-27', 'results', ['2.02', '9.01'], '2026-08-27'),
  ];
}

const newestFirst = (a: PublicFiling, b: PublicFiling) =>
  b.filed.localeCompare(a.filed) || b.accession.localeCompare(a.accession);

export function demoPublicFilings(tickers: string[]): PublicFilings {
  const filings: PublicFiling[] = [];
  const missing: string[] = [];
  for (const ticker of tickers) {
    if (PROFILES[ticker]) filings.push(...demoFilingsFor(ticker));
    else missing.push(ticker);
  }
  return {
    state: 'live',
    detail: tickers.length ? SAMPLE : null,
    checked_at: tickers.length ? DEMO_TIME : null,
    filings: filings.sort(newestFirst),
    missing,
  };
}

function demoPeriodic(ticker: string, profile: Profile): PublicPeriodicFiling[] {
  const { revenue, netIncome, eps, cash } = profile;
  if (revenue === null || netIncome === null || eps === null || cash === null) return [];
  const quarters = [
    { accession: 2, filed: '2026-08-27', end: '2026-07-26', prior: '2026-04-26', scale: 1 },
    { accession: 0, filed: '2026-05-28', end: '2026-04-26', prior: '2025-10-26', scale: 0.94 },
  ];
  const index = Object.keys(PROFILES).indexOf(ticker);
  return quarters.map((q) => {
    const fact = (
      concept: string,
      label: string,
      value: number,
      unit: string,
      places: number,
    ): PublicFact => ({
      concept,
      label,
      value: round(value * q.scale, places),
      unit,
      period_end: q.end,
      prior_value: round(value * q.scale * 0.94, places),
      prior_period_end: q.prior,
    });
    return {
      accession: `0000000000-26-${String(index * 10 + q.accession).padStart(6, '0')}`,
      form: '10-Q',
      filed: q.filed,
      period_end: q.end,
      facts: [
        fact('Revenue', 'Revenue', revenue, 'USD', 0),
        fact('NetIncomeLoss', 'Net income', netIncome, 'USD', 0),
        fact('EarningsPerShareDiluted', 'Diluted EPS', eps, 'USD/shares', 2),
        fact('CashAndCashEquivalentsAtCarryingValue', 'Cash and equivalents', cash, 'USD', 0),
      ],
    };
  });
}

const SETTLEMENTS = [
  '2026-04-15',
  '2026-04-30',
  '2026-05-15',
  '2026-05-29',
  '2026-06-15',
  '2026-06-30',
  '2026-07-15',
  '2026-07-31',
  '2026-08-14',
  '2026-08-29',
  '2026-09-15',
  '2026-09-30',
];

export function demoPublicTicker(ticker: string): PublicTicker {
  const profile = PROFILES[ticker];
  if (!profile) {
    return {
      ticker,
      state: 'unavailable',
      detail: `No demo sample is authored for ${ticker}.`,
      short_interest: null,
      short_volume: null,
      insiders: null,
      shares_outstanding: null,
      periodic: [],
      filings: [],
      filings_state: 'unavailable',
      filings_detail: `No demo sample is authored for ${ticker}.`,
    };
  }
  const history = SETTLEMENTS.map((settlement_date, i) => ({
    settlement_date,
    shares_short: Math.round(profile.shortInterest * (0.92 + 0.08 * Math.sin(i))),
  }));
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const totalVolume = profile.dailyVolume;
  const company = profile.revenue !== null;
  return {
    ticker,
    state: 'live',
    detail: SAMPLE,
    short_interest: {
      settlement_date: latest.settlement_date,
      shares_short: latest.shares_short,
      days_to_cover: round(latest.shares_short / totalVolume),
      change_percent: round(
        ((latest.shares_short - previous.shares_short) / previous.shares_short) * 100,
      ),
      average_daily_volume: totalVolume,
      history,
    },
    short_volume: {
      date: '2026-10-06',
      short_volume: Math.round(totalVolume * profile.shortRatio),
      total_volume: totalVolume,
      ratio: profile.shortRatio,
      avg_ratio: round(profile.shortRatio - 0.02, 4),
      days: 20,
    },
    insiders: company
      ? {
          state: 'live',
          detail: SAMPLE,
          window_days: 90,
          filings: 6,
          sales: 9,
          buys: 1,
          shares_sold: 410_000,
          shares_bought: 2_500,
          planned: 8,
          latest: '2026-10-02',
        }
      : null,
    shares_outstanding:
      profile.shares === null ? null : { value: profile.shares, as_of: '2026-08-20' },
    periodic: demoPeriodic(ticker, profile),
    filings: demoFilingsFor(ticker),
    filings_state: 'live',
    filings_detail: company ? SAMPLE : `Demo sample: no filings are authored for ${ticker}.`,
  };
}

/** Route one demo public-data request. `null` = not a public-data path. */
export function demoPublicData(
  pathname: string,
  search: URLSearchParams,
): { ok: true; body: unknown } | { ok: false; detail: string } | null {
  if (pathname === '/api/public-data/markets') return { ok: true, body: demoPublicMarkets() };
  if (pathname === '/api/public-data/filings') {
    const tickers: string[] = [];
    for (const part of (search.get('tickers') ?? '').split(',')) {
      const ticker = part.trim().toUpperCase();
      if (!ticker) continue;
      if (!TICKER.test(ticker))
        return { ok: false, detail: "tickers must be symbols of 1-10 characters: A-Z, '.' or '-'" };
      if (!tickers.includes(ticker)) tickers.push(ticker);
    }
    if (tickers.length > MAX_TICKERS)
      return { ok: false, detail: `tickers must be at most ${MAX_TICKERS} symbols` };
    return { ok: true, body: demoPublicFilings(tickers) };
  }
  const match = pathname.match(/^\/api\/public-data\/tickers\/([^/]+)$/);
  if (match) {
    const ticker = decodeURIComponent(match[1]).trim().toUpperCase();
    if (!TICKER.test(ticker))
      return { ok: false, detail: "ticker must be 1-10 characters: A-Z, '.' or '-'" };
    return { ok: true, body: demoPublicTicker(ticker) };
  }
  return null;
}
