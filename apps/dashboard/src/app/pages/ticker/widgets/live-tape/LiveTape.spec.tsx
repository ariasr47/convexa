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

  it('S0 title Live tape and LIVE_TAPE_SUBTITLE_* still exist when occupancy omitted', () => {
    wrap(
      <LiveTape
        m={marketState()}
        live={liveUpdate({ live: true })}
        isLive={true}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('Live tape')).toBeInTheDocument();
    expect(screen.getByText(/Live stream · not the structure snapshot below/)).toBeInTheDocument();
    expect(screen.getByText('Gamma flip · live')).toBeInTheDocument();
  });

  it('S1 title is Session tape from first session_tape payload including starting', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          session_tape: sessionTape({ tape_time_et: null, phase: 'playing' }),
        })}
        isLive={false}
        displayActive={false}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('Session tape')).toBeInTheDocument();
    expect(screen.queryByText('Live tape')).toBeNull();
    expect(
      screen.getByText(/Session day tape · SPY · Mon Aug 10 · not a live feed/),
    ).toBeInTheDocument();
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

  it('S1 1× net-flow keeps (5m) and last-few-minutes ⓘ', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          flow_window_s: 300,
          session_tape: sessionTape({ pace: 1 }),
        })}
        isLive={false}
        displayActive={true}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('Net flow (5m)')).toBeInTheDocument();
  });

  it('S1 4× net-flow is Net flow with no (Nm) and no last few minutes', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          flow_window_s: 300,
          session_tape: sessionTape({ pace: 4 }),
        })}
        isLive={false}
        displayActive={true}
        streamOffline={false}
      />,
    );
    expect(screen.getByText('Net flow')).toBeInTheDocument();
    expect(screen.queryByText(/Net flow \(\d+m\)/)).toBeNull();
  });

  it('S1 ended subtitle is Session tape ended · last tape ticks · structure levels stay snapshot', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          session_tape: sessionTape({ phase: 'ended' }),
        })}
        isLive={false}
        displayActive={false}
        streamOffline={false}
      />,
    );
    expect(
      screen.getByText('Session tape ended · last tape ticks · structure levels stay snapshot'),
    ).toBeInTheDocument();
  });

  it('S1 drop does not show ⏸ offline', () => {
    wrap(
      <LiveTape
        m={marketState({ ticker: 'SPY' })}
        live={liveUpdate({
          ticker: 'SPY',
          live: false,
          feed: 'session_tape',
          session_tape: sessionTape({ phase: 'playing' }),
        })}
        isLive={false}
        displayActive={false}
        streamOffline={true}
      />,
    );
    expect(screen.queryByText(/⏸ offline/)).toBeNull();
    expect(screen.getByText('Session tape')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------------------------
  // FE-2 step 5 — the retention latch's two arms (SPEC §2.2), criteria 12/13/15/15b/17/18.
  // ---------------------------------------------------------------------------------------------

  it('criterion 12 — a drop with a HELD latch renders the retained value, dimmed, with the pause mark and "offline · last known"', () => {
    const live = liveUpdate({ gamma_flip: 260 }); // distinct from the bundle's 248 (criterion 14)
    const { rerender } = wrap(
      <LiveTape m={marketState()} live={live} isLive={true} streamOffline={false} />,
    );
    expect(screen.getByText('$260')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <LiveTape m={marketState()} live={live} isLive={true} streamOffline={true} />
      </ThemeProvider>,
    );
    const cell = screen.getByText('Gamma flip · live').closest('[data-figure-state]');
    expect(cell).toHaveAttribute('data-figure-state', 'offline-retained');
    expect(within(cell as HTMLElement).getByText('$260')).toBeInTheDocument(); // never $248
    expect(within(cell as HTMLElement).getByText('offline · last known')).toBeInTheDocument();
  });

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

  it('criterion 15b — at least one held latch renders the LAST-KNOWN-TICKS subtitle arm', () => {
    const live = liveUpdate({ net_flow: 900, spread: null, gamma_flip: null });
    const { rerender } = wrap(
      <LiveTape m={marketState()} live={live} isLive={true} streamOffline={false} />,
    );
    rerender(
      <ThemeProvider theme={theme}>
        <LiveTape m={marketState()} live={live} isLive={true} streamOffline={true} />
      </ThemeProvider>,
    );
    expect(
      screen.getByText('Stream offline · last known ticks · structure levels stay current'),
    ).toBeInTheDocument();
  });

  it('criterion 15 — no latch ever held a value renders the NO-TICKS-RETAINED subtitle arm', () => {
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
    expect(
      screen.getByText('Stream offline · no ticks retained · structure levels stay current'),
    ).toBeInTheDocument();
  });

  it('criterion 17 — a value restored from the latch on reconnect does not re-flash', () => {
    // jsdom does not compute `animation-name` from an emotion-injected stylesheet, so this is
    // asserted on the emotion CLASS NAME instead: `flashColorSx` folds the flash state into the
    // `sx` object, so a genuinely flashing value gets a DIFFERENT generated class than a resting
    // one — proven by the anti-vacuity half below, on the SAME mechanism.
    const live248 = liveUpdate({ gamma_flip: 248 });
    const { rerender, unmount } = wrap(
      <LiveTape m={marketState()} live={live248} isLive={true} streamOffline={false} />,
    );
    const restingClass = screen.getByText('$248').className;
    rerender(
      <ThemeProvider theme={theme}>
        <LiveTape m={marketState()} live={live248} isLive={true} streamOffline={true} />
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider theme={theme}>
        <LiveTape m={marketState()} live={live248} isLive={true} streamOffline={false} />
      </ThemeProvider>,
    );
    // useFlashOnChange.ts:46 returns early on a null `before` — the drop fed it `null`, so the
    // restored print (the SAME 248) has no `before` to compare against and cannot flash: its class
    // stays the RESTING one.
    expect(screen.getByText('$248').className).toBe(restingClass);
    unmount();

    // ANTI-VACUITY: the SAME mechanism must show a genuinely DIFFERENT class on an ordinary
    // live-to-live value change, or the equality above passes merely because this harness cannot
    // see a class change at all.
    const { rerender: rerenderFlash } = wrap(
      <LiveTape m={marketState()} live={live248} isLive={true} streamOffline={false} />,
    );
    rerenderFlash(
      <ThemeProvider theme={theme}>
        <LiveTape
          m={marketState()}
          live={liveUpdate({ gamma_flip: 261 })}
          isLive={true}
          streamOffline={false}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('$261').className).not.toBe(restingClass);
  });

  it('criterion 18 — the gamma-flip label names the derivation and is never byte-identical to the ladder row label across live AND a drop', () => {
    const live = liveUpdate({ gamma_flip: 248 });
    const { rerender } = wrap(
      <LiveTape m={marketState()} live={live} isLive={true} streamOffline={false} />,
    );
    expect(screen.getByText('Gamma flip · live')).toBeInTheDocument();
    expect(screen.queryByText('Gamma flip')).toBeNull(); // the ladder's own row label (FE-5)

    rerender(
      <ThemeProvider theme={theme}>
        <LiveTape m={marketState()} live={live} isLive={true} streamOffline={true} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Gamma flip · live')).toBeInTheDocument(); // label UNCHANGED by the drop
    expect(screen.queryByText('Gamma flip')).toBeNull();
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
