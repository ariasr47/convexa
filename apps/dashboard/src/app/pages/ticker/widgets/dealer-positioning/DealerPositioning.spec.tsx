/**
 * DealerPositioning — RISK-BASED widget spec (qa-verify.md §4, 2026-07-13). The page-level contract
 * (statics persist through an SSE drop, section-level nulls) lives in `pages/ticker/ticker.risk.spec.tsx`;
 * this spec keeps the grid's own PARTIAL-object tolerance (`best-effort-isolated-or-null`):
 *   1. per-FIELD nulls inside the market_state degrade only their own tile — the walls keep rendering,
 *      no fabricated value, and the STATIC grid never grows an offline treatment of its own;
 *   2. an absent off_exchange section omits its tile entirely (never a fabricated 0%).
 * NOT asserted (visible + intentional → review): default tile values/labels, captions, tier colors.
 */
import { theme } from '@/shared/theme/theme';
import type { MarketState, OffExchange, Signals } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DealerPositioning } from './DealerPositioning';

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
  vol_normalized_gex: {
    net_gex: 6e9, // 1.2e9 / 0.20
    call_gex: 1e10,
    put_gex: -4e9,
    total_gex: 6e9,
    vol_used: 0.2,
    vol_basis: 'atm_iv',
    basis_note: 'Net GEX ÷ ATM IV (test).',
  },
  ...over,
});

const signals: Signals = {
  ticker: 'TSLA',
  regime: 'positive_gamma',
  regime_note: null,
  vol_regime: 'neutral',
  distances: {},
  setups: [],
  opportunity_score: 73,
  opportunity_tier: 'actionable',
  prime_prompt_eligible: false,
};

const offEx: OffExchange = {
  ratio_pct: 38,
  offex_shares: 38_000,
  total_shares: 100_000,
  levels: [],
  blocks: [],
  block_min_shares: 5000,
  note: '',
};

function renderDP(overM: Partial<MarketState> = {}, offExchange: OffExchange | null = offEx) {
  return render(
    <ThemeProvider theme={theme}>
      <DealerPositioning
        m={marketState(overM)}
        sig={signals}
        offExchange={offExchange}
        volOiThreshold={1}
        unusualCount={0}
        tierWord="Actionable"
        tierColor={theme.palette.warning.main}
        opportunityScore={73}
      />
    </ThemeProvider>,
  );
}

describe('DealerPositioning · per-field null tolerance (static tile grid)', () => {
  it('each nullable metric degrades to its own "unavailable" tile — walls intact, no offline treatment, no fabricated 0', () => {
    renderDP({ net_dex: null, chain_vol_oi_ratio: null, iv_skew: null, term_structure: null });
    // Net DEX, Vol/OI, IV skew, Term structure each read "unavailable" independently…
    expect(screen.getAllByText('unavailable').length).toBe(4);
    // …while the walls keep rendering (isolation) and nothing fabricates a $0.
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\b/)).toBeNull();
    // The STATIC grid never grows an offline state of its own ([live-vs-static-isolation]).
    expect(screen.queryByText('⏸ offline')).toBeNull();
  });

  it('the Off-exchange % tile is OMITTED when the section is absent (never a fabricated 0%)', () => {
    renderDP({}, null);
    expect(screen.queryByText('Off-exchange %')).toBeNull();
    expect(screen.getByText('$260')).toBeInTheDocument(); // the rest of the grid still renders
  });

  it('vol-norm GEX renders when present; degrades independently when null', () => {
    renderDP();
    expect(screen.getByText('Vol-norm GEX')).toBeInTheDocument();
    // 6e9 → $6.0B (fmtUsdCompact)
    expect(screen.getByText('$6.0B')).toBeInTheDocument();
    cleanup();

    renderDP({ vol_normalized_gex: null });
    // Walls still intact; vol-norm is one more "unavailable" among others with defaults present.
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.getByText('Vol-norm GEX')).toBeInTheDocument();
    expect(screen.getAllByText('unavailable').length).toBeGreaterThanOrEqual(1);
  });
});

describe('DealerPositioning · distance-to-spot secondary (SET-obedient display)', () => {
  it('shows distance secondary on Call wall, Put wall, and Max pain from gex_spot', () => {
    // call 260 / put 240 / max pain 250 · spot 250 → +$10 / −$10 / at spot
    renderDP();
    const seconds = screen.getAllByTestId('stat-secondary').map((el) => el.textContent);
    expect(seconds).toEqual(
      expect.arrayContaining(['+$10 · 4.0% above', '−$10 · 4.0% below', 'at spot']),
    );
  });

  it('omits distance secondary when spot cannot be anchored', () => {
    // price is non-null on MarketState; omit it (undefined) so levelSpot has no mid fallback.
    renderDP({ gex_spot: null, price: undefined });
    // Walls still render; no fabricated distance without an anchor.
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-secondary')).toBeNull();
  });
});
