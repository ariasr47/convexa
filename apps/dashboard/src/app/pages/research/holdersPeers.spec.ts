/**
 * The claims and states of the Fund holdings and Peers sections. A cut called "adding", a
 * comparison drawn over too few filers, or an older server's missing field read as an empty answer
 * would each fail silently on the page.
 */
import { describe, expect, it } from 'vitest';
import { changeText, holdersFinding, holdersView, type PublicHolders } from './holdersRead';
import { peersFinding, peersView, type PublicPeers } from './peersRead';

const holder = (manager: string, cik: number, pct: number, change: number | null) => ({
  manager,
  cik: String(cik).padStart(10, '0'),
  accession: 'a',
  url: 'u',
  filed: '2026-08-13',
  shares: pct * 1e8,
  value: 1,
  pct,
  change_pts: change,
  prior_shares: change == null ? null : 1,
});

const holders = (rows: ReturnType<typeof holder>[], extra: Partial<PublicHolders> = {}) =>
  ({
    state: 'live',
    detail: null,
    source_state: 'delayed',
    quarter_end: '2026-06-30',
    prior_quarter_end: '2026-03-31',
    cusip: '67066G104',
    issuer: 'NVIDIA CORPORATION',
    title: 'COM',
    units: 'shares',
    shares_outstanding: { value: 2.43e10, as_of: '2026-08-21' },
    prior_shares_outstanding: null,
    holders: rows,
    managers_listed: 12,
    managers_read: 12,
    managers_holding: rows.length,
    total_pct: null,
    total_change_pts: null,
    window: null,
    ...extra,
  }) as PublicHolders;

describe('fund holdings', () => {
  it('names the biggest change by its direction, in points, with the sign in the glyph', () => {
    const h = holders([
      holder('VANGUARD CAPITAL MANAGEMENT LLC', 1, 9.1, 0.1),
      holder('BlackRock, Inc.', 2, 7.2, -0.6),
      holder('STATE STREET CORP', 3, 4.1, null),
    ]);
    expect(holdersFinding(h, 'NVDA', false)).toBe(
      'The two largest holders own 16.3% of NVDA; the biggest change was BlackRock, Inc. cutting 0.6 points',
    );
    expect(changeText(-0.64)).toBe('▼ 0.6');
    expect(changeText(0.04)).toBe('± 0.0');
    expect(changeText(null)).toBe('new');
  });

  it('an older server without the field shows nothing; an empty answer is not an outage', () => {
    expect(holdersView({ state: 'live' }).kind).toBe('hidden');
    expect(holdersView({ state: 'live', holders: null }).kind).toBe('hidden');
    expect(holdersView({ state: 'live', holders: holders([]) }).kind).toBe('empty');
    expect(
      holdersView({ state: 'live', holders: holders([], { state: 'not_configured' }) }).kind,
    ).toBe('notSetUp');
    expect(
      holdersView({ state: 'live', holders: holders([], { state: 'unavailable', detail: 'x' }) }),
    ).toEqual({ kind: 'unavailable', cause: 'x' });
    expect(
      holdersView({
        state: 'live',
        holders: holders([holder('A', 1, 1, 0)], { source_state: 'last_good' }),
      }),
    ).toEqual({ kind: 'ready', stale: true });
  });
});

const row = (ticker: string, margin: number | null, growth: number | null, subject = false) => ({
  ticker,
  cik: '1',
  entity: ticker,
  subject,
  concept: 'Revenues',
  revenue: 1e9,
  revenue_year_ago: 1e9,
  gross_profit: null,
  gross_margin_pct: margin,
  growth_pct: growth,
  start: null,
  end: '2026-06-30',
  accession: 'a',
});

const peers = (rows: ReturnType<typeof row>[], missing: string[] = []) =>
  ({
    state: 'live',
    detail: null,
    source_state: 'updated',
    quarter: 'CY2026Q2',
    quarter_end: '2026-06-30',
    rows,
    missing,
    unknown: [],
    min_peers: 4,
  }) as PublicPeers;

describe('peers', () => {
  it('needs four peers with the figure, and names the ones not filed', () => {
    const three = peers([
      row('NVDA', 75, 106, true),
      row('MU', 85, 346),
      row('AMD', 54, 50),
      row('INTC', 40, 25),
    ]);
    expect(peersView({ state: 'live', ticker: 'NVDA', peers: three }).kind).toBe('empty');
    const four = peers(
      [
        row('NVDA', 75, 106, true),
        row('MU', 85, 346),
        row('AMD', 54, 50),
        row('INTC', 40, 25),
        row('QCOM', null, -4),
      ],
      ['TSM'],
    );
    expect(peersView({ state: 'live', ticker: 'NVDA', peers: four })).toEqual({
      kind: 'ready',
      missing: ['TSM'],
      stale: false,
    });
    expect(peersView({ state: 'live', ticker: 'NVDA' }).kind).toBe('hidden');
    // The note's company missing from the frames: nothing to compare.
    const noSubject = peers([
      row('MU', 85, 346),
      row('AMD', 54, 50),
      row('INTC', 40, 25),
      row('QCOM', 1, 1),
    ]);
    expect(peersView({ state: 'live', ticker: 'TSM', peers: noSubject }).kind).toBe('empty');
  });

  it('ranks the company only among peers that have the figure', () => {
    const p = peers([
      row('NVDA', 75, 106, true),
      row('MU', 85, 346),
      row('AMD', 54, 50),
      row('INTC', 40, 25),
      row('QCOM', null, -4),
    ]);
    expect(peersFinding(p, 'NVDA', false)).toBe(
      'NVDA ranks second of 5 on growth, 106% on a year; on gross margin it ranks second, behind MU',
    );
    const top = peers([
      row('NVDA', 90, 400, true),
      row('MU', 85, 346),
      row('AMD', 54, 50),
      row('INTC', 40, 25),
      row('QCOM', 1, 1),
    ]);
    expect(peersFinding(top, 'NVDA', true)).toBe(
      'In the sample, NVDA grew fastest of 5, 400% on a year; on gross margin it leads, at 90%',
    );
  });
});
