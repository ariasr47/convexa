/**
 * DealerPositioning — component-state tests for the STATIC tile grid. Asserts: the static reads render
 * their values; each nullable metric independently degrades to its own "unavailable" copy
 * (`[best-effort-isolated-or-null]`); the Opportunity tile shows the score+tier word; and the grid has
 * NO offline state of its own (`[live-vs-static-isolation]` — statics persist regardless of the feed).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import type { MarketState, Signals, OffExchange } from '@org/api';
import { theme } from '../../theme';
import { DealerPositioning } from './DealerPositioning';

const marketState = (over: Partial<MarketState> = {}): MarketState => ({
  ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1, timestamp_iso: '2026-06-23T14:30:00Z',
  call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
  max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2.0e9, put_gex: -0.8e9, total_gex: 1.2e9,
  net_dex: 5.0e8, call_dex: 6.0e8, put_dex: -1.0e8, net_vanna: null, net_charm: null, net_volga: null,
  vwap: 249, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
  dte_min: null, dte_max: null, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
  put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
  iv_skew: null, term_structure: null, ...over,
});

const signals: Signals = {
  ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
  setups: [], opportunity_score: 73, opportunity_tier: 'actionable', prime_prompt_eligible: false,
};

const offEx: OffExchange = {
  ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [], block_min_shares: 5000, note: '',
};

function renderDP(overM: Partial<MarketState> = {}, offExchange: OffExchange | null = offEx) {
  return render(
    <ThemeProvider theme={theme}>
      <DealerPositioning
        m={marketState(overM)} sig={signals} offExchange={offExchange}
        volOiThreshold={1} unusualCount={0}
        tierWord="Actionable" tierColor={theme.palette.warning.main} opportunityScore={73}
      />
    </ThemeProvider>,
  );
}

describe('DealerPositioning (static tile grid)', () => {
  it('DEFAULT: renders the static reads (walls, GEX, DEX, max pain, IV/HV) + Opportunity score+tier', () => {
    renderDP();
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.getByText('$240')).toBeInTheDocument();
    expect(screen.getByText('$1200.0M')).toBeInTheDocument(); // Net GEX
    expect(screen.getByText('$500.0M')).toBeInTheDocument();  // Net DEX
    expect(screen.getByText('1.12')).toBeInTheDocument();      // IV/HV
    expect(screen.getByText('73 · Actionable')).toBeInTheDocument();
    // "snapshot, never live" caption present.
    expect(screen.getByText(/Snapshot, never live/)).toBeInTheDocument();
  });

  it('EMPTY (per-field null): each nullable metric shows its own "unavailable", isolated', () => {
    renderDP({ net_dex: null, chain_vol_oi_ratio: null, iv_skew: null, term_structure: null });
    // Net DEX, Vol/OI, IV skew, Term structure each read "unavailable" while the walls still render.
    expect(screen.getAllByText('unavailable').length).toBe(4);
    expect(screen.getByText('$260')).toBeInTheDocument(); // walls unaffected (isolation)
  });

  it('Off-exchange % tile is omitted when off_exchange is absent (best-effort)', () => {
    renderDP({}, null);
    expect(screen.queryByText('Off-exchange %')).toBeNull();
    expect(screen.getByText('$260')).toBeInTheDocument(); // the rest of the grid still renders
  });

  it('static grid has no offline state of its own (no ⏸ offline caption anywhere)', () => {
    renderDP();
    expect(screen.queryByText('⏸ offline')).toBeNull();
  });
});
