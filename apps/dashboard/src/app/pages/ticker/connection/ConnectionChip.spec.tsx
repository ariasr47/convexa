/**
 * `ConnectionChip` — AC-2…AC-6, AC-8: the six-state matrix (SPEC §4.2).
 */
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionTapeOccupancy } from '../sessionTapeStanding';
import { ConnectionChip } from './ConnectionChip';
import { connectionStateFor, type ConnectionState } from './connectionState';

function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'SPY',
    mid: 573.12,
    bid: null,
    ask: null,
    spread: 0.05,
    net_flow: 0,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: true,
    tick_age_s: 1,
    market_session: 'regular',
    feed: 'massive',
    ts: 0,
    gamma_flip: null,
    last_trade: null,
    ...over,
  } as LiveUpdate;
}

function occ(over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy {
  return {
    symbol: 'SPY',
    et_date: '2026-09-02',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  };
}

function renderChip(live: LiveUpdate | null, streamOffline: boolean) {
  const state = connectionStateFor({ live, streamOffline, routeSymbol: 'SPY' });
  const { unmount } = wrap(
    <ConnectionChip state={state} live={live} routeSymbol="SPY" reduced={false} />,
  );
  return { state, unmount };
}

describe('the five non-replay kinds — state, words and warning icon match the resolver output (AC-2…AC-5)', () => {
  it('one resolved kind per render: data-connection-state, its words and its warning icon', () => {
    const rows: Array<{
      over: Partial<LiveUpdate>;
      streamOffline: boolean;
      kind: ConnectionState['kind'];
      texts: string[];
      warnIcon: boolean;
    }> = [
      {
        over: { live: true, market_session: 'regular' },
        streamOffline: false,
        kind: 'live',
        texts: ['live'],
        warnIcon: false,
      },
      // AC-2: neutral, no warning icon, names the mid.
      {
        over: { live: true, market_session: 'closed' },
        streamOffline: false,
        kind: 'closed',
        texts: ['market closed', '573.12'],
        warnIcon: false,
      },
      // AC-3: warning + icon.
      {
        over: { live: false, market_session: 'overnight' },
        streamOffline: false,
        kind: 'overnight',
        texts: ['overnight'],
        warnIcon: true,
      },
      // AC-4: warning + icon.
      {
        over: { live: false, market_session: 'regular' },
        streamOffline: false,
        kind: 'noTicks',
        texts: ['no live ticks'],
        warnIcon: true,
      },
      // AC-5: warning + icon, says reconnecting; the chip itself never blanks (renders a real state).
      {
        over: { live: true, market_session: 'regular' },
        streamOffline: true,
        kind: 'offline',
        texts: ['Live offline — reconnecting…'],
        warnIcon: true,
      },
    ];
    for (const { over, streamOffline, kind, texts, warnIcon } of rows) {
      const { state, unmount } = renderChip(liveUpdate(over), streamOffline);
      expect(state?.kind, kind).toBe(kind);
      const chip = screen.getByTestId('connection-chip');
      expect(chip, kind).toHaveAttribute('data-connection-state', kind);
      for (const text of texts) expect(chip, kind).toHaveTextContent(text);
      const icon = chip.querySelector('[data-testid="WarningAmberIcon"]');
      if (warnIcon) expect(icon, kind).toBeInTheDocument();
      else expect(icon, kind).toBeNull();
      unmount();
    }
  });
});

describe('AC-6 — replay carries NO live dot and NO pulse in ANY standing', () => {
  it('every standing (playing, gap, ended, fault) resolves to replay, never a filled dot or an animation', () => {
    const standings: SessionTapeOccupancy['phase'][] = ['playing', 'gap', 'ended', 'fault'];
    for (const phase of standings) {
      const { unmount } = renderChip(
        liveUpdate({ session_tape: occ({ phase }) } as Partial<LiveUpdate>),
        false,
      );
      const chip = screen.getByTestId('connection-chip');
      expect(chip, `phase=${phase}`).toHaveAttribute('data-connection-state', 'replay');
      // `drop`/`fault` carry NO dot at all (sessionTapeStanding.ts); the other standings carry a
      // hollow ring, never filled — either way, never `●` and never an animation.
      const dot = chip.querySelector('[data-testid="connection-chip-dot"]');
      if (dot) {
        // A filled dot has `bgcolor: currentColor` with no border; a hollow ring has a border and
        // no background fill — assert it is never the FILLED (live) treatment.
        expect(getComputedStyle(dot).borderWidth, `phase=${phase}`).not.toBe('0px');
      }
      expect(chip.querySelector('[style*="animation"]'), `phase=${phase}`).toBeNull();
      unmount();
    }
  });
});

describe('AC-8 — standing sentences are pairwise distinct and never say "Live offline"', () => {
  it('drop / ended / gap / starting render distinct, non-"Live offline" text', () => {
    const cases: Array<{ live: Partial<LiveUpdate>; streamOffline: boolean }> = [
      { live: { session_tape: occ({ phase: 'playing' }) }, streamOffline: true }, // drop
      { live: { session_tape: occ({ phase: 'ended' }) }, streamOffline: false }, // ended
      { live: { session_tape: occ({ phase: 'gap' }) }, streamOffline: false }, // gap
      { live: { session_tape: occ({ tape_time_et: null }) }, streamOffline: false }, // starting
    ];
    const texts = cases.map(({ live, streamOffline }) => {
      const state = connectionStateFor({
        live: liveUpdate(live as Partial<LiveUpdate>),
        streamOffline,
        routeSymbol: 'SPY',
      });
      const { unmount } = wrap(
        <ConnectionChip
          state={state}
          live={liveUpdate(live as Partial<LiveUpdate>)}
          routeSymbol="SPY"
          reduced={false}
        />,
      );
      const text = screen.getByTestId('connection-chip').textContent ?? '';
      unmount();
      return text;
    });
    expect(new Set(texts).size).toBe(texts.length); // pairwise distinct
    for (const t of texts) expect(t).not.toContain('Live offline');
  });
});
