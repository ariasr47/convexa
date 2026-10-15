import type {
  PublicAnnualRevenue,
  PublicFact,
  PublicFiling,
  PublicFilings,
  PublicFuturesMarket,
  PublicInsiders,
  PublicMarkets,
  PublicPeriodicFiling,
  PublicPositionGroup,
  PublicShortVolume,
  PublicTaggedFact,
  PublicTicker,
  PublicYieldPoint,
} from '../convexa';
import { DEMO_CALENDAR, DEMO_RESULTS_WINDOWS } from './calendar';

/**
 * Demo answers for the public-data endpoints. Every figure here is authored for the demo — none
 * was fetched from the U.S. Treasury, CFTC, FINRA or SEC — and every answer says so in `detail` and `source`.
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

/** Weekly Tuesdays, oldest first, ending on the demo's latest report (2026-10-06): three years. */
const DEMO_WEEKS = 156;
const demoWeekDates = (): string[] => {
  const end = Date.parse('2026-10-06T00:00:00Z');
  return Array.from({ length: DEMO_WEEKS }, (_, i) =>
    isoDay(end - (DEMO_WEEKS - 1 - i) * 7 * DAY_MS),
  );
};

/** A smooth authored weekly path between `lo` and `hi`, ending exactly at `end`. */
function weeklyPath(end: number, lo: number, hi: number, seed: number): number[] {
  const mid = (lo + hi) / 2;
  const amp = (hi - lo) / 2;
  const path = Array.from(
    { length: DEMO_WEEKS },
    (_, i) =>
      Math.round(
        (mid + amp * 0.9 * Math.sin(seed + i * 0.09) * Math.cos(seed / 2 + i * 0.031)) / 100,
      ) * 100,
  );
  // Ease the last eight weeks into `end`, so the latest report is the authored net.
  for (let k = 0; k < 8; k += 1) {
    const i = DEMO_WEEKS - 8 + k;
    const w = (k + 1) / 8;
    path[i] = Math.round((path[i] * (1 - w) + end * w) / 100) * 100;
  }
  path[DEMO_WEEKS - 1] = end;
  return path;
}

/** The quantile by linear interpolation between ranks, rounded (as the API computes it). */
function quantile(sorted: number[], q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

/** A group's summary computed from its own weekly series, the way the API does, so the demo's
 *  figures and its history agree. */
function group(series: number[]): PublicPositionGroup {
  const net = series[series.length - 1];
  const sorted = [...series].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  return {
    net,
    week_change: net - series[n - 2],
    min_3y: min,
    max_3y: max,
    median_3y: n % 2 ? sorted[(n - 1) / 2] : Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2),
    p10_3y: quantile(sorted, 0.1),
    p90_3y: quantile(sorted, 0.9),
    position_in_range: max === min ? 0.5 : round((net - min) / (max - min), 3),
    weeks: n,
  };
}

/** One demo market: four groups' weekly paths, their summaries and the history rows. */
function demoMarket(
  code: string,
  name: string,
  exchange: string,
  paths: { asset: number[]; lev: number[]; dealer: number[]; other: number[] },
): PublicFuturesMarket {
  const dates = demoWeekDates();
  return {
    code,
    name,
    exchange,
    asset_managers: group(paths.asset),
    leveraged_funds: group(paths.lev),
    dealers: group(paths.dealer),
    other_reportables: group(paths.other),
    history: dates.map((date, i) => ({
      date,
      asset_managers: paths.asset[i],
      leveraged_funds: paths.lev[i],
      dealers: paths.dealer[i],
      other_reportables: paths.other[i],
    })),
  };
}

/** Twenty-six H.4.1 Wednesdays ending Sep 30, 2026, on a smooth authored path shaped like the
 *  live inputs ($ millions): Fed assets edging up, the Treasury's cash rebuilding into quarter end,
 *  reverse repo draining. `net` is computed from the three, as the API does. */
function demoLiquidity(): NonNullable<PublicMarkets['liquidity']> {
  const end = Date.parse('2026-09-30T00:00:00Z');
  const W = 26;
  const weeks = Array.from({ length: W }, (_, i) => {
    const fed = Math.round(6_600_000 + i * 4_200 + Math.sin(i * 1.7) * 3_000);
    const tga = Math.round(
      830_000 + Math.sin(i / 3.5) * 40_000 + (i >= 21 ? ((i - 20) / 5) * 85_000 : 0),
    );
    const rrp = Math.round(Math.max(4_000, 30_000 - i * 800 + Math.cos(i * 1.3) * 1_500));
    return {
      date: isoDay(end - (W - 1 - i) * 7 * DAY_MS),
      fed_assets: fed,
      tga,
      reverse_repo: rrp,
      net: fed - tga - rrp,
    };
  });
  return {
    source: 'Demo sample (shaped like Fed H.4.1, Treasury DTS and NY Fed reverse repo)',
    as_of: weeks[W - 1].date,
    fetched_at: DEMO_TIME,
    weeks,
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
      source: 'Demo sample (shaped like U.S. Treasury daily par and real yield curves)',
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
        demoMarket('043602', '10-year T-note', 'CBOT', {
          asset: weeklyPath(2_700_000, 1_900_000, 2_800_000, 0.4),
          lev: weeklyPath(-2_050_000, -2_300_000, -1_100_000, 1.7),
          dealer: weeklyPath(-90_000, -260_000, 120_000, 2.9),
          other: weeklyPath(-310_000, -520_000, -60_000, 4.1),
        }),
        demoMarket('13874A', 'E-mini S&P 500', 'CME', {
          asset: weeklyPath(880_000, 610_000, 990_000, 0.9),
          lev: weeklyPath(-390_000, -460_000, -120_000, 2.2),
          dealer: weeklyPath(-180_000, -320_000, 40_000, 3.3),
          other: weeklyPath(60_000, -40_000, 150_000, 5.0),
        }),
        demoMarket('209742', 'E-mini Nasdaq-100', 'CME', {
          asset: weeklyPath(70_000, 31_000, 82_000, 1.3),
          lev: weeklyPath(-21_000, -64_000, -4_000, 2.6),
          dealer: weeklyPath(-28_000, -45_000, 6_000, 3.8),
          other: weeklyPath(9_000, -6_000, 21_000, 4.6),
        }),
      ],
    },
    liquidity: demoLiquidity(),
    calendar: DEMO_CALENDAR,
  };
}

/** Twenty weekdays of short-sale volume ending on the demo's latest file (2026-10-06), on a small
 *  authored wave around the profile's ratio; the average is the mean of those days, as the API
 *  computes it, and the latest day is the profile's own ratio. */
function demoShortVolume(totalVolume: number, ratio: number): PublicShortVolume {
  const end = Date.parse('2026-10-06T00:00:00Z');
  const dates: string[] = [];
  for (let back = 0; dates.length < 20; back += 1) {
    const ms = end - back * DAY_MS;
    const weekday = new Date(ms).getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.unshift(isoDay(ms));
  }
  const daily = dates.map((date, i) => {
    const r = i === dates.length - 1 ? ratio : round(ratio - 0.02 + 0.035 * Math.sin(i * 0.9), 4);
    const total = Math.round(totalVolume * (0.85 + (0.3 * ((i * 7) % 10)) / 10));
    return { date, short_volume: Math.round(total * r), total_volume: total, ratio: r };
  });
  const last = daily[daily.length - 1];
  return {
    date: last.date,
    short_volume: last.short_volume,
    total_volume: last.total_volume,
    ratio: last.ratio,
    avg_ratio: round(daily.reduce((sum, d) => sum + d.ratio, 0) / daily.length, 4),
    days: daily.length,
    daily,
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
    results: DEMO_RESULTS_WINDOWS.filter((w) => tickers.includes(w.ticker)),
    missing,
  };
}

function demoPeriodic(ticker: string, profile: Profile): PublicPeriodicFiling[] {
  const { revenue, netIncome, eps, cash } = profile;
  if (revenue === null || netIncome === null || eps === null || cash === null) return [];
  const quarters = [
    {
      accession: 2,
      filed: '2026-08-27',
      start: '2026-04-27',
      end: '2026-07-26',
      prior: '2026-04-26',
      scale: 1,
      fp: 'Q2',
    },
    {
      accession: 0,
      filed: '2026-05-28',
      start: '2026-01-26',
      end: '2026-04-26',
      prior: '2025-10-26',
      scale: 0.94,
      fp: 'Q1',
    },
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
    // The same values as XBRL tags them for the quarter (or at its end, for cash), so the note's
    // "Checked against the filing" section has a sample filing to compare with.
    const tag = (concept: string, value: number, unit: string, places: number, instant = false) =>
      ({
        concept,
        unit,
        value: round(value * q.scale, places),
        start: instant ? null : q.start,
        end: q.end,
      }) satisfies PublicTaggedFact;
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
      fiscal_year: 2027,
      fiscal_period: q.fp,
      tagged: [
        tag('us-gaap:CashAndCashEquivalentsAtCarryingValue', cash, 'USD', 0, true),
        tag('us-gaap:EarningsPerShareDiluted', eps, 'USD/shares', 2),
        tag('us-gaap:NetIncomeLoss', netIncome, 'USD', 0),
        tag('us-gaap:Revenues', revenue, 'USD', 0),
      ],
    };
  });
}

/** Five sample fiscal years of annual revenue, each as first filed, growing, none restated. */
function demoAnnualRevenue(ticker: string, profile: Profile): PublicAnnualRevenue[] {
  if (profile.revenue === null) return [];
  const index = Object.keys(PROFILES).indexOf(ticker);
  const years = [
    { fy: 2022, end: '2022-01-30', filed: '2022-03-18', share: 0.31 },
    { fy: 2023, end: '2023-01-29', filed: '2023-02-24', share: 0.36 },
    { fy: 2024, end: '2024-01-28', filed: '2024-02-21', share: 0.52 },
    { fy: 2025, end: '2025-01-26', filed: '2025-02-26', share: 0.74 },
    { fy: 2026, end: '2026-01-25', filed: '2026-02-25', share: 0.93 },
  ];
  return years.map((y, i) => ({
    fiscal_year: y.fy,
    period_end: y.end,
    value: round(profile.revenue! * 4 * y.share, 0),
    unit: 'USD',
    concept: 'us-gaap:Revenues',
    accession: `0000000000-${String(y.fy).slice(2)}-${String(index * 10 + 5 + i).padStart(6, '0')}`,
    filed: y.filed,
    restated_value: null,
  }));
}

/** Six months of sample Form 4 trades around the Oct 7 scenario, with one buying cluster (three
 *  directors in September) so the cluster form is visible; roles only, as on the live answer. */
function demoInsiders(ticker: string): PublicInsiders {
  const url = secBrowse(ticker);
  const t = (
    insider: number,
    trade_date: string,
    kind: 'purchase' | 'sale',
    shares: number,
    price: number,
    planned: boolean,
    n: number,
  ) => {
    const filed = isoDay(Date.parse(`${trade_date}T00:00:00Z`) + 2 * DAY_MS);
    return {
      insider,
      trade_date,
      filed,
      kind,
      shares,
      price,
      planned,
      accession: `0000000000-26-9${String(n).padStart(5, '0')}`,
      url,
    };
  };
  const transactions = [
    t(3, '2026-05-20', 'sale', 40_000, 118.2, true, 1),
    t(0, '2026-06-10', 'sale', 120_000, 121.5, true, 2),
    t(1, '2026-06-12', 'sale', 30_000, 122.1, true, 3),
    t(0, '2026-07-08', 'sale', 120_000, 126.4, true, 4),
    t(2, '2026-08-03', 'sale', 18_000, 131.8, false, 5),
    t(1, '2026-09-02', 'sale', 30_000, 128.9, true, 6),
    t(4, '2026-09-14', 'purchase', 1_200, 124.3, false, 7),
    t(5, '2026-09-16', 'purchase', 800, 123.6, false, 8),
    t(6, '2026-09-19', 'purchase', 500, 125.1, false, 9),
  ];
  // The 90-day card counts the same sample: trades filed Jul 9 – Oct 7.
  const recent = transactions.filter((x) => x.filed >= '2026-07-09');
  const sales = recent.filter((x) => x.kind === 'sale');
  const buys = recent.filter((x) => x.kind === 'purchase');
  return {
    state: 'live',
    detail: SAMPLE,
    window_days: 90,
    filings: recent.length,
    sales: sales.length,
    buys: buys.length,
    shares_sold: sales.reduce((s, x) => s + x.shares, 0),
    shares_bought: buys.reduce((s, x) => s + x.shares, 0),
    planned: recent.filter((x) => x.planned).length,
    latest: recent[recent.length - 1].filed,
    history_days: 182,
    roles: [
      'President and CEO',
      'EVP and CFO',
      'EVP, Operations',
      'EVP, Field Operations',
      'Director 1',
      'Director 2',
      'Director 3',
    ],
    transactions,
    clusters: [{ from: '2026-09-14', to: '2026-09-19', insiders: 3, trades: 3, planned_trades: 0 }],
    sale_windows: [],
    history_filings: transactions.length,
    history_filings_read: transactions.length,
    history_reaches_back_to: null,
  };
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
      short_interest_state: 'unavailable',
      short_interest_detail: `No demo sample is authored for ${ticker}.`,
      short_volume: null,
      short_volume_state: 'unavailable',
      short_volume_detail: `No demo sample is authored for ${ticker}.`,
      insiders: null,
      shares_outstanding: null,
      periodic: [],
      annual_revenue: [],
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
    // Sample answers never carry a per-part note: the page-level demo label says what they are.
    short_interest_state: 'live',
    short_interest_detail: null,
    short_volume_state: 'live',
    short_volume_detail: null,
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
    short_volume: demoShortVolume(totalVolume, profile.shortRatio),
    insiders: company ? demoInsiders(ticker) : null,
    shares_outstanding:
      profile.shares === null ? null : { value: profile.shares, as_of: '2026-08-20' },
    periodic: demoPeriodic(ticker, profile),
    annual_revenue: demoAnnualRevenue(ticker, profile),
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
