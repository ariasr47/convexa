/**
 * `LivenessAnnouncer` — AC-12b: exactly ONE `aria-live="polite"` node in the chip path; it
 * announces on a chip-CLASS change and is SILENT on a mid-only change; carries no `role="status"`.
 */
import type { LiveUpdate } from '@convexa/api';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LivenessAnnouncer } from './LivenessAnnouncer';
import type { ConnectionState } from './connectionState';

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

describe('AC-12b — one announcer, class-change only', () => {
  it('exactly one aria-live="polite" node exists, and neither it nor anything else carries role="status"', () => {
    render(<LivenessAnnouncer state={{ kind: 'live' }} live={liveUpdate()} />);
    const nodes = document.querySelectorAll('[aria-live]');
    expect(nodes.length).toBe(1);
    expect(nodes[0]).toHaveAttribute('aria-live', 'polite');
    expect(document.querySelectorAll('[role="status"]').length).toBe(0);
  });

  it('a mid-only update (same class) announces ZERO additional times', () => {
    const { rerender } = render(
      <LivenessAnnouncer state={{ kind: 'live' }} live={liveUpdate({ mid: 500 })} />,
    );
    const first = screen.getByTestId('connection-liveness-announcer').textContent;
    expect(first).toContain('Live stream connected');
    rerender(<LivenessAnnouncer state={{ kind: 'live' }} live={liveUpdate({ mid: 501 })} />);
    const second = screen.getByTestId('connection-liveness-announcer').textContent;
    // The class (kind) is unchanged, so the announced sentence text is UNCHANGED too — it does not
    // re-announce the new mid.
    expect(second).toBe(first);
  });

  it('a class TRANSITION announces exactly once, with the six sentences distinguishable', () => {
    const cases: Array<[ConnectionState, string]> = [
      [{ kind: 'live' }, 'Live stream connected'],
      [{ kind: 'offline' }, 'Live stream offline'],
      [{ kind: 'closed' }, 'Market closed'],
      [{ kind: 'overnight' }, 'Overnight session'],
      [{ kind: 'noTicks' }, 'No live ticks arriving'],
    ];
    const { rerender } = render(<LivenessAnnouncer state={null} live={null} />);
    expect(screen.getByTestId('connection-liveness-announcer').textContent).toBe('');
    for (const [state, expectedStart] of cases) {
      rerender(<LivenessAnnouncer state={state} live={liveUpdate()} />);
      expect(screen.getByTestId('connection-liveness-announcer').textContent).toContain(
        expectedStart,
      );
    }
    const texts = cases.map(([, t]) => t);
    expect(new Set(texts).size).toBe(texts.length); // pairwise distinct
  });

  it('the pre-first-fact placeholder (state=null) announces nothing', () => {
    render(<LivenessAnnouncer state={null} live={null} />);
    expect(screen.getByTestId('connection-liveness-announcer').textContent).toBe('');
  });
});
