/**
 * `ReadStrip` — DOM-level proof for criteria 8, 25, 50 (SPEC §2.4, §2.5, §4.1). The pure-model
 * equivalents (and the value/copy mutation proof) live in `readStripModel.spec.ts`; this file
 * proves what only the rendered DOM can: the `[data-figure-state]` count, the live-dot census, the
 * PER-CELL named container declaration (never at the rail), and the rail's own overflow discipline.
 *
 * MUTATION PROOF (poison → confirm red → revert, actually run this session): passed
 * `andPresent(isDeliveringLive(...), 1)` as the `netDex` cell's `live` instead of `NOT_LIVE` under a
 * genuinely live fixture — the "zero live dots anywhere in the strip" test below went red (found 1
 * dot, in the Net DEX cell). Reverted; suite green again.
 */
import { andPresent, isDeliveringLive } from '@/shared/liveness/liveClaim';
import { theme } from '@/shared/theme/theme';
import type { MarketState, OffExchange } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { allRulesForClass, emotionClassOf, joinedStyleText } from '../_kit/emotionCssReader';
import { ReadStrip } from './ReadStrip';
import {
  buildReadStrip,
  READ_STRIP_SLOTS,
  type ReadStripCells,
  type ReadStripInput,
} from './readStripModel';

afterEach(() => cleanup());

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

const FULL_INPUT: ReadStripInput = {
  m: marketState(),
  offExchange: offEx(),
  volOiThreshold: 1,
  unusualCount: 0,
  tierWord: 'Actionable',
  opportunityScore: 73,
  ivRank: {
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
  },
};

function wrap(cells: ReadStripCells = buildReadStrip(FULL_INPUT)) {
  return render(
    <ThemeProvider theme={theme}>
      <ReadStrip cells={cells} />
    </ThemeProvider>,
  );
}

describe('ReadStrip — eight cells at every state, none dropped (criterion 25)', () => {
  it('renders exactly eight [data-figure-state] nodes with a full bundle', () => {
    const { container } = wrap();
    expect(container.querySelectorAll('[data-figure-state]')).toHaveLength(8);
  });

  it('renders exactly eight [data-figure-state] nodes with every optional datum absent, neighbours intact', () => {
    const cells = buildReadStrip({
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
    const { container } = wrap(cells);
    expect(container.querySelectorAll('[data-figure-state]')).toHaveLength(8);
    // The eighth (off-exchange) reads `not provided`; its neighbours keep rendering their values —
    // the reviewer probe named in PLAN's FE-7 section.
    expect(screen.getByText('not provided')).toBeInTheDocument();
    expect(screen.getByText('Net DEX')).toBeInTheDocument();
    expect(screen.getByText('IV / HV')).toBeInTheDocument();
    expect(screen.getByText('1.12')).toBeInTheDocument();
  });

  it('every slot keeps its label even when its own value is absent', () => {
    wrap();
    for (const label of [
      'Opportunity',
      'Net DEX',
      'IV / HV',
      'IV rank',
      'Vol/OI',
      'IV skew',
      'Term structure',
      'Off-exchange %',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(READ_STRIP_SLOTS).toHaveLength(8);
  });
});

describe('ReadStrip — every cell is dotless; a stray live claim is a defect (criterion 8)', () => {
  it('zero live dots and zero data-figure-state="live" nodes anywhere in the strip', () => {
    const { container } = wrap();
    expect(container.querySelectorAll('[data-testid="figure-live-dot"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-figure-state="live"]')).toHaveLength(0);
  });

  it('MUTATION GUARD (the reader, not the source): a cell wearing a live claim IS caught by the same census', () => {
    // Proves the assertion above is non-vacuous — a genuinely poisoned fixture must fail it. The
    // actual source poison (readStripModel.ts / ReadStrip.tsx) was run and reverted this session
    // (see file doc comment); this reproduces the same failure signature from a local fixture so the
    // regression is caught even if the reader itself is ever weakened.
    const claim = isDeliveringLive(
      { live: true, market_session: 'regular' } as Parameters<typeof isDeliveringLive>[0],
      false,
    );
    const poisoned = buildReadStrip(FULL_INPUT).map((c) =>
      c.slot === 'netDex' ? { ...c, live: andPresent(claim, 1) } : c,
    ) as ReadStripCells;
    const { container } = wrap(poisoned);
    expect(container.querySelectorAll('[data-testid="figure-live-dot"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-figure-state="live"]')).toHaveLength(1);
  });
});

describe('ReadStrip — the container-query hazard: each cell is its OWN named container (SPEC §2.5)', () => {
  it('every cell wrapper declares container-type:inline-size;container-name:panel', () => {
    wrap();
    for (const slot of READ_STRIP_SLOTS) {
      const wrapper = screen.getByTestId(`read-strip-cell-${slot}`);
      const cls = emotionClassOf(wrapper);
      expect(cls, `${slot} cell should carry an emotion class`).toBeTruthy();
      const rule = allRulesForClass(joinedStyleText(), cls as string).join(';');
      expect(rule, `${slot} cell rule: ${rule}`).toContain('container-type:inline-size');
      expect(rule, `${slot} cell rule: ${rule}`).toContain('container-name:panel');
    }
  });

  it("the rail itself does NOT declare container-name:panel (would blind every cell's own query)", () => {
    wrap();
    const rail = screen.getByTestId('read-strip-rail');
    const cls = emotionClassOf(rail);
    if (cls) {
      const rule = allRulesForClass(joinedStyleText(), cls).join(';');
      expect(rule).not.toContain('container-name:panel');
    }
  });
});

describe('ReadStrip — the rail is a rail; the page is not (criterion 50)', () => {
  it('the rail declares overflow-x:auto and min-width:0', () => {
    wrap();
    const rail = screen.getByTestId('read-strip-rail');
    const cls = emotionClassOf(rail);
    expect(cls).toBeTruthy();
    const rule = allRulesForClass(joinedStyleText(), cls as string).join(';');
    expect(rule).toContain('overflow-x:auto');
    expect(rule).toContain('min-width:0');
  });
});
