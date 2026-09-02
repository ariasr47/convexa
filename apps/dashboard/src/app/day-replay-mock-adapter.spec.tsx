/**
 * day-replay-mock-adapter — one S1 fixture pass (SPEC §7 dashboard).
 * Covers starting / playing / ended / drop / gap / poison live:true + session_tape:
 * banned interpolations absent, isLive false, no fills, end ≠ live-offline, loading ≠ S0,
 * payload-gap ≠ live-offline, 1× omits ·1×, 4× prints ·4×, 4× net-flow honesty.
 * S0 fixture asserts shipped live strings still exist when occupancy is omitted.
 */
import { evaluateOrder, tickFromLive } from '@/features/trading/orders/engine';
import type { SimOrder } from '@/features/trading/orders/types';
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  consumeStanding,
  genuineIsLive,
  type SessionTapeOccupancy,
} from './pages/ticker/sessionTapeStanding';
import { connectionChip } from './pages/ticker/widgets/chrome/TickerHeader';
import { LiveTape } from './pages/ticker/widgets/live-tape/LiveTape';

function occ(over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy {
  return {
    symbol: 'SPY',
    et_date: '2026-08-10',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  };
}

function live(
  over: Partial<LiveUpdate> & { session_tape?: SessionTapeOccupancy } = {},
): LiveUpdate {
  const { session_tape, ...rest } = over;
  return {
    ticker: 'SPY',
    mid: 500,
    bid: null,
    ask: null,
    spread: 0.02,
    net_flow: 1200,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: false,
    tick_age_s: 1,
    market_session: 'session_tape',
    feed: 'session_tape',
    ts: Date.now(),
    gamma_flip: 498,
    last_trade: 500.1,
    ...rest,
    ...(session_tape !== undefined ? { session_tape } : {}),
  } as LiveUpdate;
}

function marketState(over: Partial<MarketState> = {}): MarketState {
  return {
    ticker: 'SPY',
    price: 499,
    gex_spot: 500,
    timestamp: 1,
    timestamp_iso: '2026-08-10T13:35:00Z',
    call_wall: 510,
    put_wall: 490,
    peak_gex_strike: 505,
    gamma_flip: 498,
    max_pain: 500,
    max_pain_expiration: '2026-08-14',
    net_gex: 1e9,
    call_gex: 1e9,
    put_gex: -1e8,
    total_gex: 1e9,
    net_dex: 1e8,
    call_dex: 1e8,
    put_dex: -1e7,
    net_vanna: null,
    net_charm: null,
    net_volga: null,
    vwap: 500,
    vwap_upper_2: null,
    vwap_upper_3: null,
    vwap_lower_2: null,
    vwap_lower_3: null,
    dte_min: null,
    dte_max: null,
    atm_iv: 15,
    hv_30d: 12,
    iv_hv_ratio: 1.1,
    net_flow: null,
    put_call_ratio: 0.8,
    chain_vol_oi_ratio: 0.5,
    total_volume: 1_000_000,
    vol_oi_unusual_threshold: 1,
    iv_skew: null,
    term_structure: null,
    dealer_flow_projection: null,
    ...over,
  } as MarketState;
}

const BANNED = [
  '● live ·',
  'Streaming live',
  'Live tape',
  'Gamma flip (live)',
  '⚠ Live offline — reconnecting…',
  '○ overnight — no live data',
  '○ market closed',
  '○ no live ticks',
  '⏸ offline',
  '⏸ Last trade',
  'partial captured day',
  'complete open-to-close',
] as const;

function order(): SimOrder {
  return {
    id: 'o-s1',
    created_time: new Date().toISOString(),
    schema_version: 1,
    ticker: 'SPY',
    expiration: '2099-12-19',
    strike: 500,
    right: 'call',
    side: 'long',
    qty: 1,
    trigger: { kind: 'underlying_above', level: 100 },
    limit_price: null,
    stop: null,
    target: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    provenance: { source: 'manual' },
    status: 'waiting',
  };
}

describe('day-replay-mock-adapter · S1 fixture pass', () => {
  it('starting / playing / ended / drop / gap / poison — banned live chrome absent; isLive false; no fills', () => {
    const starting = live({ session_tape: occ({ tape_time_et: null, phase: 'playing' }) });
    const playing1x = live({ session_tape: occ({ pace: 1 }) });
    const playing4x = live({ session_tape: occ({ pace: 4 }) });
    const ended = live({ session_tape: occ({ phase: 'ended', tape_time_et: '16:00:00' }) });
    const gap = live({ session_tape: occ({ phase: 'gap' }) });
    const poison = live({ live: true, session_tape: occ() });

    // Standing classification
    expect(consumeStanding({ live: starting, streamOffline: false, routeSymbol: 'SPY' })).toEqual({
      kind: 'starting',
    });
    expect(consumeStanding({ live: playing1x, streamOffline: false, routeSymbol: 'SPY' })).toEqual({
      kind: 'playing',
    });
    expect(consumeStanding({ live: ended, streamOffline: false, routeSymbol: 'SPY' })).toEqual({
      kind: 'ended',
    });
    expect(consumeStanding({ live: gap, streamOffline: false, routeSymbol: 'SPY' })).toEqual({
      kind: 'gap',
    });
    expect(consumeStanding({ live: playing1x, streamOffline: true, routeSymbol: 'SPY' })).toEqual({
      kind: 'drop',
    });
    expect(consumeStanding({ live: ended, streamOffline: true, routeSymbol: 'SPY' })).toEqual({
      kind: 'ended',
    });

    // Chips
    const startChip = connectionChip(starting, false, false, 'SPY');
    expect(startChip?.text).toBe('session tape · starting…');
    expect(startChip?.pulse).toBe(false);

    const playChip = connectionChip(playing1x, false, false, 'SPY');
    expect(playChip?.text).toContain('tape 09:35:00 ET');
    expect(playChip?.text).not.toMatch(/1×/);
    expect(playChip?.dot).toBe('○');
    expect(playChip?.pulse).toBe(false);

    const play4 = connectionChip(playing4x, false, false, 'SPY');
    expect(play4?.text).toMatch(/4×/);

    const dropChip = connectionChip(playing1x, true, false, 'SPY');
    expect(dropChip?.text).toBe('⚠ Session tape stream dropped');
    expect(dropChip?.text).not.toContain('Live offline');

    const endChip = connectionChip(ended, false, false, 'SPY');
    expect(endChip?.text).toBe('session tape ended · SPY · Mon Aug 10');
    expect(endChip?.text).not.toContain('Live offline');

    const gapChip = connectionChip(gap, false, false, 'SPY');
    expect(gapChip?.text).toBe('session tape gap · SPY · Mon Aug 10');

    const poisonChip = connectionChip(poison, false, false, 'SPY');
    expect(poisonChip?.dot).toBe('○');
    expect(poisonChip?.text).not.toMatch(/●/);
    expect(genuineIsLive(poison, false)).toBe(false);

    // LiveTape render — banned strings absent; 4× net-flow honesty
    const { container } = render(
      <ThemeProvider theme={theme}>
        <LiveTape
          m={marketState()}
          live={playing4x}
          isLive={false}
          displayActive={true}
          streamOffline={false}
        />
      </ThemeProvider>,
    );
    const text = container.textContent ?? '';
    for (const ban of BANNED) {
      expect(text).not.toContain(ban);
    }
    expect(text).toContain('Session tape');
    expect(text).toContain('Net flow');
    expect(text).not.toMatch(/Net flow \(\d+m\)/);
    expect(text).not.toMatch(/last few minutes/i);
    expect(screen.queryByText('Gamma flip (live)')).toBeNull();

    // Fills off
    const tick = tickFromLive(poison, false, 1);
    expect(tick.isLive).toBe(false);
    expect(evaluateOrder(order(), tick)).toBeNull();
  });

  it('S0 fixture — shipped live strings still exist when occupancy is omitted', () => {
    const s0 = live({
      live: true,
      feed: 'realtime',
      market_session: 'regular',
    });
    expect(genuineIsLive(s0, false)).toBe(true);
    const chip = connectionChip(s0, false, false);
    expect(chip?.text).toMatch(/live/);
    expect(chip?.dot).toBe('●');

    const offline = connectionChip(s0, true, false);
    expect(offline?.text).toContain('⚠ Live offline — reconnecting…');

    render(
      <ThemeProvider theme={theme}>
        <LiveTape m={marketState()} live={s0} isLive={true} streamOffline={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Live tape')).toBeInTheDocument();
    expect(screen.getByText('Gamma flip (live)')).toBeInTheDocument();
  });
});
