/**
 * `ConnectionChip` — AC-2…AC-6, AC-8, AC-9, AC-11, AC-12: the six-state matrix + the wordless
 * placeholder + motion gating (SPEC §4.2).
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

function renderChip(live: LiveUpdate | null, streamOffline: boolean, reduced = false) {
  const state = connectionStateFor({ live, streamOffline, routeSymbol: 'SPY' });
  wrap(<ConnectionChip state={state} live={live} routeSymbol="SPY" reduced={reduced} />);
  return state;
}

describe('AC-9 — the wordless placeholder before the first stream fact', () => {
  it('is present in the slot, carries no text, no tone, no dot, no connection vocabulary', () => {
    wrap(<ConnectionChip state={null} live={null} routeSymbol="SPY" reduced={false} />);
    const placeholder = screen.getByTestId('connection-chip-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.textContent).toBe('');
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    expect(screen.queryByText(/live|closed|overnight|ticks|offline|replay|connecting/i)).toBeNull();
  });
});

describe('AC-2 — closed', () => {
  it('neutral, no warning icon, names the mid', () => {
    renderChip(liveUpdate({ live: true, market_session: 'closed' }), false);
    const chip = screen.getByTestId('connection-chip');
    expect(chip).toHaveAttribute('data-connection-state', 'closed');
    expect(chip).toHaveTextContent('market closed');
    expect(chip).toHaveTextContent('573.12');
    expect(chip.querySelector('[data-testid="WarningAmberIcon"]')).toBeNull();
  });
});

describe('AC-3 — overnight', () => {
  it('warning + icon, names the mid', () => {
    renderChip(liveUpdate({ live: false, market_session: 'overnight' }), false);
    const chip = screen.getByTestId('connection-chip');
    expect(chip).toHaveAttribute('data-connection-state', 'overnight');
    expect(chip).toHaveTextContent('overnight');
    expect(chip.querySelector('[data-testid="WarningAmberIcon"]')).toBeInTheDocument();
  });
});

describe('AC-4 — no ticks', () => {
  it('warning + icon, names the mid', () => {
    renderChip(liveUpdate({ live: false, market_session: 'regular' }), false);
    const chip = screen.getByTestId('connection-chip');
    expect(chip).toHaveAttribute('data-connection-state', 'noTicks');
    expect(chip).toHaveTextContent('no live ticks');
    expect(chip.querySelector('[data-testid="WarningAmberIcon"]')).toBeInTheDocument();
  });
});

describe('AC-5 — offline', () => {
  it('warning + icon, says reconnecting; the chip itself never blanks (renders a real state, not nothing)', () => {
    renderChip(liveUpdate({ live: true, market_session: 'regular' }), true);
    const chip = screen.getByTestId('connection-chip');
    expect(chip).toHaveAttribute('data-connection-state', 'offline');
    expect(chip).toHaveTextContent('Live offline — reconnecting…');
    expect(chip.querySelector('[data-testid="WarningAmberIcon"]')).toBeInTheDocument();
  });
});

describe('AC-6 — replay carries NO live dot and NO pulse in ANY standing', () => {
  const standings: SessionTapeOccupancy['phase'][] = ['playing', 'gap', 'ended', 'fault'];
  for (const phase of standings) {
    it(`standing derived from phase="${phase}"`, () => {
      renderChip(liveUpdate({ session_tape: occ({ phase }) } as Partial<LiveUpdate>), false);
      const chip = screen.getByTestId('connection-chip');
      expect(chip).toHaveAttribute('data-connection-state', 'replay');
      // `drop`/`fault` carry NO dot at all (sessionTapeStanding.ts); the other standings carry a
      // hollow ring, never filled — either way, never `●` and never an animation.
      const dot = chip.querySelector('[data-testid="connection-chip-dot"]');
      if (dot) {
        // A filled dot has `bgcolor: currentColor` with no border; a hollow ring has a border and
        // no background fill — assert it is never the FILLED (live) treatment.
        expect(getComputedStyle(dot).borderWidth).not.toBe('0px');
      }
      expect(chip.querySelector('[style*="animation"]')).toBeNull();
    });
  }

  it('the drop standing carries no literal ⚠ and renders the stroke warn icon instead (AC-8)', () => {
    renderChip(
      liveUpdate({ session_tape: occ({ phase: 'playing' }) } as Partial<LiveUpdate>),
      true, // streamOffline while session tape was last vouched playing → `drop`
    );
    const chip = screen.getByTestId('connection-chip');
    expect(chip.textContent).not.toContain('⚠');
    expect(chip.querySelector('[data-testid="WarningAmberIcon"]')).toBeInTheDocument();
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

describe('AC-11/AC-12 — liveness motion stops on drop; reduced motion strips the pulse', () => {
  it('the live dot animates only while genuinely live and motion is not reduced', () => {
    renderChip(liveUpdate({ live: true, market_session: 'regular' }), false, false);
    const dot = screen.getByTestId('connection-chip-dot');
    expect(getComputedStyle(dot).animationName).not.toBe('none');
  });

  it('reduced motion renders the dot static and fully opaque, and the chip still states the state in words', () => {
    renderChip(liveUpdate({ live: true, market_session: 'regular' }), false, true);
    const dot = screen.getByTestId('connection-chip-dot');
    expect(getComputedStyle(dot).animationName === 'none' || getComputedStyle(dot).animationName === '').toBe(
      true,
    );
    expect(screen.getByTestId('connection-chip')).toHaveTextContent('live');
  });

  it('every non-live state carries no dot animation (five non-live arms)', () => {
    const arms: Array<[LiveUpdate, boolean]> = [
      [liveUpdate({ live: true, market_session: 'closed' }), false],
      [liveUpdate({ live: false, market_session: 'overnight' }), false],
      [liveUpdate({ live: false, market_session: 'regular' }), false],
      [liveUpdate({ live: true, market_session: 'regular' }), true],
      [liveUpdate({ session_tape: occ() } as Partial<LiveUpdate>), false],
    ];
    for (const [live, streamOffline] of arms) {
      const { unmount } = wrap(
        <ConnectionChip
          state={connectionStateFor({ live, streamOffline, routeSymbol: 'SPY' })}
          live={live}
          routeSymbol="SPY"
          reduced={false}
        />,
      );
      const dot = screen.queryByTestId('connection-chip-dot');
      if (dot) expect(dot.getAttribute('style') ?? '').not.toContain('animation');
      unmount();
    }
  });
});

describe('one resolved kind per render — data-connection-state matches the resolver output', () => {
  it.each<[Partial<LiveUpdate>, boolean, ConnectionState['kind']]>([
    [{ live: true, market_session: 'regular' }, false, 'live'],
    [{ live: true, market_session: 'closed' }, false, 'closed'],
    [{ live: false, market_session: 'overnight' }, false, 'overnight'],
    [{ live: false, market_session: 'regular' }, false, 'noTicks'],
    [{ live: true, market_session: 'regular' }, true, 'offline'],
  ])('%o streamOffline=%s → %s', (over, streamOffline, kind) => {
    const state = renderChip(liveUpdate(over), streamOffline);
    expect(state?.kind).toBe(kind);
    expect(screen.getByTestId('connection-chip')).toHaveAttribute('data-connection-state', kind);
  });
});
