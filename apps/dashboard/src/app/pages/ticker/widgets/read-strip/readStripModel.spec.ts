/**
 * `readStripModel.ts` — SPEC §2.4, criteria 25, 26, 27, 28, 60. Pure model tests; the DOM-level
 * equivalents (criteria 8, 25, 50) live in `ReadStrip.spec.tsx`.
 *
 * MUTATION PROOF (poison → confirm red → revert, actually run this session, not narrated): replaced
 * the off-exchange slot's `NOT_PROVIDED` fallback with the literal `'unavailable'` — the "never
 * `unavailable`" test below (criterion 26) went red naming the actual string it received
 * (`'unavailable'`, not `'not provided'`). Reverted; suite green again. See `ReadStrip.spec.tsx` for
 * the companion DOM-level poison proof (criterion 8, the dot census).
 */
import { NOT_PROVIDED } from '@/shared/copy/notANumber';
import { NOT_LIVE } from '@/shared/liveness/liveClaim';
import type { IvRankRead, MarketState, OffExchange } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { buildReadStrip, READ_STRIP_SLOTS, type ReadStripInput } from './readStripModel';

const marketState = (over: Partial<MarketState> = {}): MarketState => ({
  ticker: 'TSLA',
  price: 250.5,
  gex_spot: 250,
  timestamp: 1,
  timestamp_iso: '2026-06-23T14:30:00Z',
  call_wall: 260,
  put_wall: 240,
  peak_gex_strike: 255,
  gamma_flip: 248,
  max_pain: 250,
  max_pain_expiration: '2026-06-26',
  net_gex: 1.2e9,
  call_gex: 2.0e9,
  put_gex: -0.8e9,
  total_gex: 1.2e9,
  net_dex: 5.0e8,
  call_dex: 6.0e8,
  put_dex: -1.0e8,
  net_vanna: null,
  net_charm: null,
  net_volga: null,
  vwap: 249,
  vwap_upper_2: null,
  vwap_upper_3: null,
  vwap_lower_2: null,
  vwap_lower_3: null,
  dte_min: null,
  dte_max: null,
  atm_iv: 45,
  hv_30d: 40,
  iv_hv_ratio: 1.12,
  net_flow: null,
  put_call_ratio: 0.8,
  chain_vol_oi_ratio: 0.5,
  total_volume: 100_000,
  vol_oi_unusual_threshold: 1,
  iv_skew: null,
  term_structure: null,
  dealer_flow_projection: null,
  straddle_move: {
    state: 'not_computed',
    as_of: null,
    session_basis: null,
    anchor_spot: null,
    anchor_basis: 'gex_spot',
    anchor_label: 'gex_spot',
    primary_expiration: null,
    wide_quote_threshold_pct: 15,
    tenors: [],
  },
  ...over,
});

const offEx = (over: Partial<OffExchange> = {}): OffExchange => ({
  ratio_pct: 38,
  offex_shares: 38_000,
  total_shares: 100_000,
  levels: [],
  blocks: [],
  block_min_shares: 5000,
  note: '',
  ...over,
});

const ivRank = (over: Partial<IvRankRead> = {}): IvRankRead => ({
  state: 'computed',
  rank: 82,
  rank_unavailable_reason: null,
  percentile: 74,
  band: 'premium_rich',
  current_iv: 41.2,
  window_sessions: 130,
  sample_count: 130,
  window_cap: 252,
  min_samples: 20,
  iv_basis: 'interpolated_30d',
  basis_dte: 30,
  window_descriptor: 'w',
  basis_descriptor: 'b',
  advisory_note: 'a',
  ...over,
});

const FULL_INPUT: ReadStripInput = {
  m: marketState(),
  offExchange: offEx(),
  volOiThreshold: 1,
  unusualCount: 0,
  tierWord: 'Actionable',
  opportunityScore: 73,
  ivRank: ivRank(),
};

function bySlot(input: ReadStripInput) {
  const cells = buildReadStrip(input);
  return Object.fromEntries(cells.map((c) => [c.slot, c]));
}

describe('READ_STRIP_SLOTS — eight fixed slots, in order (criterion 25)', () => {
  it('is exactly the closed eight-member tuple', () => {
    expect(READ_STRIP_SLOTS).toEqual([
      'opportunity',
      'netDex',
      'ivHv',
      'ivRank',
      'volOi',
      'ivSkew',
      'termStructure',
      'offExchange',
    ]);
  });

  it('buildReadStrip always returns exactly eight cells, in that order, whatever the input', () => {
    const full = buildReadStrip(FULL_INPUT);
    expect(full).toHaveLength(8);
    expect(full.map((c) => c.slot)).toEqual(READ_STRIP_SLOTS);

    const empty = buildReadStrip({
      m: marketState({
        net_dex: null,
        chain_vol_oi_ratio: null,
        iv_skew: null,
        term_structure: null,
      }),
      offExchange: null,
      volOiThreshold: 1,
      unusualCount: 0,
      tierWord: 'Dormant',
      opportunityScore: 0,
      ivRank: null,
    });
    expect(empty).toHaveLength(8);
    expect(empty.map((c) => c.slot)).toEqual(READ_STRIP_SLOTS);
  });
});

describe('buildReadStrip — every cell is dotless (criterion 8 model half)', () => {
  it('all eight cells carry NOT_LIVE', () => {
    const cells = buildReadStrip(FULL_INPUT);
    expect(cells.every((c) => c.live === NOT_LIVE)).toBe(true);
  });
});

describe('buildReadStrip — the seven decomposed cells, byte-for-byte with DealerPositioning', () => {
  it('opportunity — score · tier word', () => {
    const c = bySlot(FULL_INPUT);
    expect(c.opportunity.value).toBe('73 · Actionable');
  });

  it('netDex — unavailable when null, formatted otherwise', () => {
    expect(bySlot(FULL_INPUT).netDex.value).toBe('$500.0M');
    const nulled = bySlot({ ...FULL_INPUT, m: marketState({ net_dex: null }) });
    expect(nulled.netDex.value).toBe('unavailable');
  });

  it('ivHv — the raw ratio to two decimals, never unavailable (never null on the wire)', () => {
    expect(bySlot(FULL_INPUT).ivHv.value).toBe('1.12');
  });

  it('volOi — unavailable when null, "×"-suffixed otherwise', () => {
    expect(bySlot(FULL_INPUT).volOi.value).toBe('0.50×');
    const nulled = bySlot({ ...FULL_INPUT, m: marketState({ chain_vol_oi_ratio: null }) });
    expect(nulled.volOi.value).toBe('unavailable');
  });

  it('ivSkew — unavailable when null, sign + pts + closed skewState suffix otherwise', () => {
    const withSkew = bySlot({
      ...FULL_INPUT,
      m: marketState({
        iv_skew: { call_iv: 20, put_iv: 25, slope: -2.4, expiration: 'x', reference: 'delta' },
      }),
    });
    expect(withSkew.ivSkew.value).toBe('−2.4 pts · greed');
    expect(bySlot(FULL_INPUT).ivSkew.value).toBe('unavailable');
  });

  it('opportunity info carries the shipped OPPORTUNITY_TIER_INFO suffix', () => {
    expect(bySlot(FULL_INPUT).opportunity.info).toContain('Not a trade signal.');
    expect(bySlot(FULL_INPUT).opportunity.info).toContain(
      'Tier: Dormant → Watch → Actionable → Prime.',
    );
  });
});

describe('buildReadStrip — the off-exchange slot renders NOT_PROVIDED, never unavailable (criterion 26)', () => {
  it('renders the value when ratio_pct is present', () => {
    expect(bySlot(FULL_INPUT).offExchange.value).toBe('38%');
  });

  it('renders NOT_PROVIDED when the whole off-exchange object is absent', () => {
    const c = bySlot({ ...FULL_INPUT, offExchange: null });
    expect(c.offExchange.value).toBe(NOT_PROVIDED);
    expect(c.offExchange.value).not.toBe('unavailable');
  });

  it('renders NOT_PROVIDED when the object is present but ratio_pct is null', () => {
    const c = bySlot({
      ...FULL_INPUT,
      offExchange: offEx({ ratio_pct: null as unknown as number }),
    });
    expect(c.offExchange.value).toBe(NOT_PROVIDED);
  });

  it('renders NOT_PROVIDED when the object is undefined', () => {
    const c = bySlot({ ...FULL_INPUT, offExchange: undefined });
    expect(c.offExchange.value).toBe(NOT_PROVIDED);
  });
});

describe('buildReadStrip — the off-exchange slot is neutral, context-only, no side (criterion 27)', () => {
  const NEUTRAL = 'Side/intent unknown — context only, not a directional signal.';

  it('the populated arm carries the shipped context-only sentence, byte-for-byte', () => {
    expect(bySlot(FULL_INPUT).offExchange.info).toContain(NEUTRAL);
    expect(bySlot(FULL_INPUT).offExchange.info).toContain('Top levels:');
  });

  it('the empty (NOT_PROVIDED) arm still carries the shipped context-only sentence', () => {
    const c = bySlot({ ...FULL_INPUT, offExchange: null });
    expect(c.offExchange.info).toBe(NEUTRAL);
  });
});

describe('buildReadStrip — term structure keeps the shipped three-way render (criterion 60)', () => {
  it('object absent → unavailable', () => {
    const c = bySlot({ ...FULL_INPUT, m: marketState({ term_structure: null }) });
    expect(c.termStructure.value).toBe('unavailable');
  });

  it('object present, fewer than two points → the minimum-claim member, not unavailable', () => {
    const c = bySlot({
      ...FULL_INPUT,
      m: marketState({
        term_structure: {
          state: 'contango',
          near_iv: 20,
          far_iv: 22,
          slope: 2,
          points: [{ dte: 7, atm_iv: 20, expiration: '2026-07-01' }],
        } as MarketState['term_structure'],
      }),
    });
    expect(c.termStructure.value).toBe('—');
  });

  it('object present with ≥2 points → the wire state label, never re-derived', () => {
    const c = bySlot({
      ...FULL_INPUT,
      m: marketState({
        term_structure: {
          state: 'backwardation',
          near_iv: 22,
          far_iv: 18,
          slope: -4,
          points: [
            { dte: 7, atm_iv: 22, expiration: '2026-07-01' },
            { dte: 90, atm_iv: 18, expiration: '2026-09-24' },
          ],
        } as MarketState['term_structure'],
      }),
    });
    expect(c.termStructure.value).toBe('backwardation');
  });
});

describe('buildReadStrip — IV rank is the eighth cell, closed-lookup digest (criterion 28)', () => {
  it('computed with a recognized band — rank + the closed band label', () => {
    expect(bySlot(FULL_INPUT).ivRank.value).toBe('82 · premium rich');
  });

  it('computed with an unrecognized band — rank alone, never a raw pass-through', () => {
    const c = bySlot({ ...FULL_INPUT, ivRank: ivRank({ band: 'not_a_real_band' }) });
    expect(c.ivRank.value).toBe('82');
    expect(c.ivRank.value).not.toContain('not_a_real_band');
  });

  it('degenerate-flat (rank null) — the closed unavailable member, never a fabricated midpoint', () => {
    const c = bySlot({ ...FULL_INPUT, ivRank: ivRank({ rank: null, band: null }) });
    expect(c.ivRank.value).toBe('unavailable');
  });

  it('building — the closed unavailable member (the strip is a digest; the full distinction stays in the untouched widget)', () => {
    const c = bySlot({
      ...FULL_INPUT,
      ivRank: ivRank({ state: 'building', rank: null, band: null }),
    });
    expect(c.ivRank.value).toBe('unavailable');
  });

  it('whole read null — the closed unavailable member', () => {
    const c = bySlot({ ...FULL_INPUT, ivRank: null });
    expect(c.ivRank.value).toBe('unavailable');
  });
});
