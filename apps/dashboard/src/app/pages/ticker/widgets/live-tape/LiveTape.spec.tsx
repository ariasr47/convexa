/**
 * LiveTape — RISK-BASED widget spec (qa-verify.md §4, 2026-07-13). The dim/⏸-offline treatment on an
 * SSE drop is PAGE-covered (`pages/ticker/ticker.risk.spec.tsx` walks it end-to-end); this spec keeps
 * only the tape-local honesty logic:
 *   1. PRE-LIVE (no tick yet): live-derived fields read the honest em-dash — never a fabricated 0 —
 *      and the gamma flip shows the STATIC authoritative value WITHOUT the "(live)" claim;
 *   2. per-field tolerance inside a live payload: a null spread reads em-dash while net flow renders,
 *      and a negative net flow renders signed (the sign path, not just the happy `+`).
 * NOT asserted (visible + intentional → review/page): default live figures, offline dim/caption,
 * labels/tooltips, VWAP formatting.
 */
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveTape } from './LiveTape';

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

const liveUpdate = (over: Partial<LiveUpdate> = {}): LiveUpdate => ({
  ticker: 'TSLA',
  mid: 251,
  bid: null,
  ask: null,
  spread: 0.05,
  net_flow: 1200,
  buy_vol: 0,
  sell_vol: 0,
  flow_window_s: 300,
  spot_ts: 1,
  live: true,
  tick_age_s: 1,
  market_session: 'regular',
  feed: 'realtime',
  ts: Date.now(),
  gamma_flip: 248,
  last_trade: 251.13,
  ...over,
});

function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('LiveTape · tape-local honesty', () => {
  it('PRE-LIVE: live fields read the em-dash (never a fabricated 0) and the flip is the STATIC value without the "(live)" claim', () => {
    wrap(<LiveTape m={marketState()} live={null} isLive={false} streamOffline={false} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // net flow + spread honest-empty
    expect(screen.queryByText(/^[+-]?0$/)).toBeNull(); // no invented 0 net-flow
    expect(screen.getByText('Gamma flip')).toBeInTheDocument(); // static authority…
    expect(screen.queryByText('Gamma flip (live)')).toBeNull(); // …never claimed live
    expect(screen.getByText('$248')).toBeInTheDocument(); // the static flip value
    // Distance secondary: flip 248 vs gex_spot 250 → −$2.0 · 0.8% below
    expect(screen.getByTestId('stat-secondary')).toHaveTextContent('−$2.0 · 0.8% below');
  });

  it('per-field: a null spread reads em-dash while net flow renders; a negative net flow renders signed', () => {
    wrap(
      <LiveTape
        m={marketState()}
        live={liveUpdate({ spread: null, net_flow: -800 })}
        isLive={true}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('-800')).toBeInTheDocument(); // the negative path, not just the happy '+'
    expect(screen.getByText('—')).toBeInTheDocument(); // the null spread, isolated
  });
});
