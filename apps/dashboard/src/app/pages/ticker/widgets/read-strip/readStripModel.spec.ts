/**
 * `readStripModel.ts` — SPEC §2.4, criteria 26, 27, 28, 60. Pure model tests. The DOM-level spec for
 * criteria 8, 25 and 50 was retired (lean-tests batch 11).
 *
 * MUTATION PROOF (poison → confirm red → revert, actually run this session, not narrated): replaced
 * the off-exchange slot's `NOT_PROVIDED` fallback with the literal `'unavailable'` — the "never
 * `unavailable`" test below (criterion 26) went red naming the actual string it received
 * (`'unavailable'`, not `'not provided'`). Reverted; suite green again.
 */
import { NOT_PROVIDED } from '@/shared/copy/notANumber';
import type { IvRankRead, MarketState, OffExchange } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { buildReadStrip, type ReadStripInput } from './readStripModel';

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
  setupsCount: 2,
};

function bySlot(input: ReadStripInput) {
  const cells = buildReadStrip(input);
  return Object.fromEntries(cells.map((c) => [c.slot, c]));
}

describe('buildReadStrip — the seven decomposed cells, byte-for-byte with the old dealer positioning widget', () => {
  it('opportunity — score · tier word', () => {
    const c = bySlot(FULL_INPUT);
    expect(c.opportunity.value).toBe('73 · Actionable');
  });

  it('opportunity — an unscored ticker reads —, never 0 (TD-07)', () => {
    const c = bySlot({ ...FULL_INPUT, opportunityScore: null });
    expect(c.opportunity.value).toBe('—');
    expect(c.opportunity.sub).toBe('not scored this cycle');
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
});

describe('buildReadStrip — the off-exchange slot renders NOT_PROVIDED, never unavailable (criterion 26)', () => {
  it('renders the value when ratio_pct is present', () => {
    expect(bySlot(FULL_INPUT).offExchange.value).toBe('38%');
  });

  it('renders NOT_PROVIDED, never unavailable, when the object is absent, undefined or carries a null ratio_pct', () => {
    const cases: ReadonlyArray<readonly [string, ReadStripInput['offExchange']]> = [
      ['whole object absent', null],
      ['object present, ratio_pct null', offEx({ ratio_pct: null as unknown as number })],
      ['object undefined', undefined],
    ];
    for (const [name, offExchange] of cases) {
      const c = bySlot({ ...FULL_INPUT, offExchange });
      expect(c.offExchange.value, name).toBe(NOT_PROVIDED);
      expect(c.offExchange.value, name).not.toBe('unavailable');
    }
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

  // The band is the WIRE's, never re-derived from the rank. Each row pairs a band with a rank on
  // the far side of a documented cut (`IVR_TIP_BAND`: rich ≥ 70, cheap < 30), so any local
  // mapping — including an off-by-one at either cut — prints a different label than the wire sent.
  it.each<[number, string, string]>([
    [70, 'neutral', '70 · neutral'],
    [29, 'neutral', '29 · neutral'],
    [30, 'premium_cheap', '30 · premium cheap'],
    [69, 'premium_rich', '69 · premium rich'],
  ])(
    'rank %d with wire band %s renders %s — the wire band wins at the cut',
    (rank, band, value) => {
      expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ rank, band }) }).ivRank.value).toBe(value);
    },
  );
});

// =================================================================================================
// Ticker fidelity repair, change 4 (F4) — the per-cell sub-caption (`design/src/screens/desk.mjs:29`'s
// `cell({ ..., sub })`). Every non-static one is derived from the SAME model data the cell's own
// `value`/`info` already use (never a new fabricated qualifier); the two static taglines
// ("delta hedging pressure", "context only, no side") name what the metric IS, not a data claim, so
// they hold even when `value` itself is unavailable. `—` is the closed-nine dash, never an invented
// qualifier, where the model has nothing to say this cycle.
// =================================================================================================
describe('buildReadStrip — sub-caption (F4): derived from the model, `—` where it has nothing to say', () => {
  it('opportunity: setups count, singular/plural, "no setups" at zero, `—` when unresolved', () => {
    expect(bySlot({ ...FULL_INPUT, setupsCount: 2 }).opportunity.sub).toBe('2 setups');
    expect(bySlot({ ...FULL_INPUT, setupsCount: 1 }).opportunity.sub).toBe('1 setup');
    expect(bySlot({ ...FULL_INPUT, setupsCount: 0 }).opportunity.sub).toBe('no setups');
    expect(bySlot({ ...FULL_INPUT, setupsCount: null }).opportunity.sub).toBe('—');
  });

  it('ivHv: derived from the SAME ratio the value renders — >1 expensive, <1 cheap, ===1 fair', () => {
    expect(bySlot({ ...FULL_INPUT, m: marketState({ iv_hv_ratio: 1.12 }) }).ivHv.sub).toBe(
      'options look expensive',
    );
    expect(bySlot({ ...FULL_INPUT, m: marketState({ iv_hv_ratio: 0.82 }) }).ivHv.sub).toBe(
      'options look cheap',
    );
    expect(bySlot({ ...FULL_INPUT, m: marketState({ iv_hv_ratio: 1 }) }).ivHv.sub).toBe(
      'options fairly priced',
    );
  });

  it('ivRank: quartile + percentile from the SAME `percentile` the full widget’s own descriptor uses, proper English ordinals, `—` when null', () => {
    // Matches the design's own "2nd quartile · 41st pct" shape (desk.mjs) — the quartile ordinal
    // from a small fixed table, the percentile's own ordinal from the general 1st/2nd/3rd/…th rule
    // (11th/12th/13th excepted).
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: 74 }) }).ivRank.sub).toBe(
      '3rd quartile · 74th pct',
    );
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: 12 }) }).ivRank.sub).toBe(
      '1st quartile · 12th pct', // the "teens" exception: 12th, not 12nd
    );
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: 41 }) }).ivRank.sub).toBe(
      '2nd quartile · 41st pct',
    );
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: 22 }) }).ivRank.sub).toBe(
      '1st quartile · 22nd pct',
    );
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: 63 }) }).ivRank.sub).toBe(
      '3rd quartile · 63rd pct',
    );
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: 90 }) }).ivRank.sub).toBe(
      '4th quartile · 90th pct',
    );
    expect(bySlot({ ...FULL_INPUT, ivRank: ivRank({ percentile: null }) }).ivRank.sub).toBe('—');
    expect(bySlot({ ...FULL_INPUT, ivRank: null }).ivRank.sub).toBe('—');
  });

  it('volOi: the SAME `unusualCount` the ⓘ tooltip states in full-sentence form, `—` at zero', () => {
    expect(bySlot({ ...FULL_INPUT, unusualCount: 3 }).volOi.sub).toBe('3 unusual strikes');
    expect(bySlot({ ...FULL_INPUT, unusualCount: 1 }).volOi.sub).toBe('1 unusual strike');
    expect(bySlot({ ...FULL_INPUT, unusualCount: 0 }).volOi.sub).toBe('—');
  });

  it('ivSkew: the SAME closed phrase table `skewTip` spends inline, `—` when the skew read is absent', () => {
    const fear = bySlot({
      ...FULL_INPUT,
      m: marketState({
        iv_skew: {
          slope: 5,
          dte: 30,
          expiration: '2026-07-03',
          put_iv: 30,
          call_iv: 25,
          reference: 'delta',
        },
      }),
    });
    expect(fear.ivSkew.sub).toContain('fear');
    const greed = bySlot({
      ...FULL_INPUT,
      m: marketState({
        iv_skew: {
          slope: -5,
          dte: 30,
          expiration: '2026-07-03',
          put_iv: 25,
          call_iv: 30,
          reference: 'delta',
        },
      }),
    });
    expect(greed.ivSkew.sub).toContain('greed');
    expect(bySlot({ ...FULL_INPUT, m: marketState({ iv_skew: null }) }).ivSkew.sub).toBe('—');
  });

  it('termStructure: the SAME near/far tenor pair `termTip` already names, `—` under two points or absent', () => {
    const c = bySlot({
      ...FULL_INPUT,
      m: marketState({
        term_structure: {
          state: 'contango',
          slope: 3.8,
          near_iv: 14.2,
          far_iv: 18.0,
          points: [
            { dte: 7, expiration: '2026-06-30', atm_iv: 14.2 },
            { dte: 90, expiration: '2026-09-21', atm_iv: 18.0 },
          ],
        },
      }),
    });
    expect(c.termStructure.sub).toBe('7d 14.2 → 90d 18.0');

    const thin = bySlot({
      ...FULL_INPUT,
      m: marketState({
        term_structure: {
          state: 'flat',
          slope: 0,
          near_iv: 14.2,
          far_iv: 14.2,
          points: [{ dte: 7, expiration: '2026-06-30', atm_iv: 14.2 }],
        },
      }),
    });
    expect(thin.termStructure.sub).toBe('—');

    expect(
      bySlot({ ...FULL_INPUT, m: marketState({ term_structure: null }) }).termStructure.sub,
    ).toBe('—');
  });
});
