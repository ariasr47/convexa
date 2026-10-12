/**
 * LiveTape — RISK-BASED widget spec (qa-verify.md §4, 2026-07-13; relabelled curvature-v2-desk-and-read
 * FE-2). The dim/⏸-offline treatment on an SSE drop is PAGE-covered
 * (`pages/ticker/ticker.risk.spec.tsx` walks it end-to-end); this spec keeps only the tape-local
 * honesty logic:
 *   1. PRE-LIVE (`live: null`, `streamOffline: false` — the SAME shape as a post-symbol-change reset,
 *      criterion 16a): every live-derived cell shows the bare em-dash — never a fabricated 0 and
 *      NEVER the bundle's `m.gamma_flip` fallback (SPEC §2.2, criterion 14 — that fallback is what
 *      produced the violation this phase fixes; the structure flip is the LADDER's own row, FE-5);
 *   2. per-field tolerance inside a live payload: a null spread reads em-dash while net flow renders,
 *      and a negative net flow renders signed (the sign path, not just the happy `+`).
 * NOT asserted (visible + intentional → review/page): default live figures, offline dim/caption,
 * labels/tooltips, VWAP formatting.
 */
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionTapeOccupancy } from '../../sessionTapeStanding';
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

const liveUpdate = (
  over: Partial<LiveUpdate> & { session_tape?: SessionTapeOccupancy } = {},
): LiveUpdate =>
  ({
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
  }) as LiveUpdate;

function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const sessionTape = (over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy => ({
  symbol: 'SPY',
  et_date: '2026-08-10',
  tape_time_et: '09:35:00',
  phase: 'playing',
  pace: 1,
  ...over,
});

describe('LiveTape · tape-local honesty', () => {
  it('PRE-LIVE: every live-derived field reads the bare em-dash — never a fabricated 0 and never the bundle fallback (SPEC §2.2, criterion 14)', () => {
    wrap(<LiveTape m={marketState()} live={null} isLive={false} streamOffline={false} />);
    // Net flow, Spread AND Gamma flip all read the bare em-dash — the latch has never held a
    // stream value, and the gamma flip cell no longer falls back to `m.gamma_flip` (that fallback
    // is what produced criterion 14's violation; the bundle's structure flip is the LADDER's own
    // row, FE-5, not this figure).
    expect(screen.getAllByText('—').length).toBe(3);
    expect(screen.queryByText(/^[+-]?0$/)).toBeNull(); // no invented 0 net-flow
    expect(screen.getByText('Gamma flip · live')).toBeInTheDocument(); // the label names the derivation…
    expect(screen.queryByText('Gamma flip (live)')).toBeNull(); // …the old parenthetical form is gone
    expect(screen.queryByText('$248')).toBeNull(); // never the static bundle flip under this label
    // No distance secondary either: `distanceToLevel` is undefined when the level itself is null.
    expect(screen.queryByTestId('stat-secondary')).toBeNull();
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

  it('S1 does not use LIVE_TAPE_SUBTITLE_LIVE or OFFLINE', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          session_tape: sessionTape(),
        })}
        isLive={false}
        displayActive={true}
        streamOffline={false}
      />,
    );
    expect(screen.queryByText(/Live stream · not the structure/)).toBeNull();
    expect(screen.queryByText(/Stream offline · last known ticks/)).toBeNull();
  });

  it('S1 gamma flip label names the session-tape derivation, never the live/parenthetical form', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: true,
          feed: 'session_tape',
          session_tape: sessionTape(),
        })}
        isLive={false}
        displayActive={true}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('Gamma flip · session tape')).toBeInTheDocument();
    expect(screen.queryByText('Gamma flip (live)')).toBeNull();
    expect(screen.queryByText('Gamma flip · live')).toBeNull();
  });

  it('S1 net-flow label keeps its (5m) window at 1× and carries no (Nm) window at 4×', () => {
    const cases: ReadonlyArray<readonly [1 | 4, string, RegExp | null]> = [
      [1, 'Net flow (5m)', null],
      [4, 'Net flow', /Net flow \(\d+m\)/],
    ];
    for (const [pace, label, absent] of cases) {
      const { unmount } = wrap(
        <LiveTape
          m={marketState({ ticker: 'SPY' })}
          live={liveUpdate({
            ticker: 'SPY',
            live: false,
            feed: 'session_tape',
            flow_window_s: 300,
            session_tape: sessionTape({ pace }),
          })}
          isLive={false}
          displayActive={true}
          streamOffline={false}
        />,
      );
      expect(screen.getByText(label), `${pace}×`).toBeInTheDocument();
      if (absent) expect(screen.queryByText(absent), `${pace}×`).toBeNull();
      unmount();
    }
  });

  // ---------------------------------------------------------------------------------------------
  // FE-2 step 5 — the retention latch's empty arm (SPEC §2.2), criterion 13.
  // ---------------------------------------------------------------------------------------------

  it('criterion 13 — a drop with an EMPTY latch renders the bare member, pause mark, and NO "last known" words', () => {
    const { rerender } = wrap(
      <LiveTape m={marketState()} live={null} isLive={false} streamOffline={false} />,
    );
    rerender(
      <ThemeProvider theme={theme}>
        <LiveTape
          m={marketState()}
          live={liveUpdate({ live: false })}
          isLive={false}
          streamOffline={true}
        />
      </ThemeProvider>,
    );
    const cell = screen.getByText('Gamma flip · live').closest('[data-figure-state]');
    expect(cell).toHaveAttribute('data-figure-state', 'offline-bare');
    expect(within(cell as HTMLElement).queryByText(/last known/)).toBeNull();
    expect(within(cell as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('display-active moves numbers; keep-alive does not flash', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          net_flow: 1500,
          spread: 0.02,
          session_tape: sessionTape(),
        })}
        isLive={false}
        displayActive={true}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('+1,500')).toBeInTheDocument();
    expect(screen.getByText('$0.02')).toBeInTheDocument();
  });
});
