/**
 * LiveTape — component-state tests for the LIVE-DERIVED tile row. Centerpiece behavior:
 * `[live-vs-static-isolation]` — on `streamOffline` the live tiles DIM + caption `⏸ offline`, never
 * blank, never frozen-as-current; when live they render the live figures; pre-live they show `—`.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import type { LiveUpdate, MarketState } from '@org/api';
import { theme } from '../../theme';
import { LiveTape } from './LiveTape';

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

const liveUpdate = (over: Partial<LiveUpdate> = {}): LiveUpdate => ({
  ticker: 'TSLA', mid: 251, bid: null, ask: null, spread: 0.05, net_flow: 1200, buy_vol: 0, sell_vol: 0,
  flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular', feed: 'realtime',
  ts: Date.now(), gamma_flip: 248, last_trade: 251.13, ...over,
});

function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('LiveTape (live-derived tiles)', () => {
  it('DEFAULT (live): renders live net-flow, spread, live gamma flip, VWAP', () => {
    wrap(<LiveTape m={marketState()} live={liveUpdate()} isLive={true} streamOffline={false} />);
    expect(screen.getByText('Net flow (5m)')).toBeInTheDocument();
    expect(screen.getByText('+1,200')).toBeInTheDocument();
    expect(screen.getByText('$0.05')).toBeInTheDocument();
    expect(screen.getByText('Gamma flip (live)')).toBeInTheDocument();
    expect(screen.getByText('$248')).toBeInTheDocument();
    expect(screen.getByText('$249.00')).toBeInTheDocument(); // VWAP
    // Not offline → no ⏸ offline caption.
    expect(screen.queryByText('⏸ offline')).toBeNull();
  });

  it('PRE-LIVE (no tick yet): live fields show — and the flip is the static authoritative value', () => {
    wrap(<LiveTape m={marketState()} live={null} isLive={false} streamOffline={false} />);
    expect(screen.getByText('Gamma flip')).toBeInTheDocument(); // no "(live)" suffix
    expect(screen.getByText('$248')).toBeInTheDocument();        // static flip
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);  // net flow + spread show em-dash
  });

  it('OFFLINE (SSE drop): live tiles dim + caption ⏸ offline; flip falls back to static, never blank', () => {
    // streamOffline true ⇒ isLive false; the tiles carry the offline caption.
    wrap(<LiveTape m={marketState()} live={liveUpdate()} isLive={false} streamOffline={true} />);
    expect(screen.getAllByText('⏸ offline').length).toBeGreaterThan(0);
    // The gamma flip never blanks — it shows the static authoritative value.
    expect(screen.getByText('$248')).toBeInTheDocument();
    expect(screen.getByText('Gamma flip')).toBeInTheDocument();
  });

  it('negative net flow renders the down accent figure', () => {
    wrap(<LiveTape m={marketState()} live={liveUpdate({ net_flow: -800 })} isLive={true} streamOffline={false} />);
    expect(screen.getByText('-800')).toBeInTheDocument();
  });
});
