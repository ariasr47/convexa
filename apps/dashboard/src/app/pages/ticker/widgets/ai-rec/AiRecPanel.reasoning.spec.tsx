/**
 * Unit — the structured-reasoning rendering added to the AI-rec card: the lead/detail derivation,
 * the "Why" + "Re-engage when" lists, the collapsible "Analyst read", and the bundle-sourced
 * "Levels in play" strip. Renders the exported pieces in isolation (no App/network mount).
 */
import type { RecStrategy, TickerBundle } from '@convexa/api';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveReasoning, leadAndRest, LevelsStrip, ReasoningSection } from './AiRecPanel';

afterEach(cleanup);

function strat(over: Partial<RecStrategy> = {}): RecStrategy {
  return {
    decision: 'trade',
    bias: 'long',
    structure: 'call debit spread',
    strikes: [260],
    expiration: '2026-07-18',
    entry_trigger: 'break above 260',
    invalidation_level: 242,
    max_risk: '$300',
    position_size: '2 contracts',
    exit_plan: { target: 12, stop: 6 },
    time_horizon: '5d',
    confidence: 'medium',
    rationale: 'Full first sentence. Second detail sentence.',
    ...over,
  };
}

describe('leadAndRest', () => {
  it('splits the first sentence from the remainder', () => {
    expect(leadAndRest('One. Two. Three.')).toEqual({ lead: 'One.', rest: 'Two. Three.' });
  });
  it('returns the whole string as the lead when there is a single sentence', () => {
    expect(leadAndRest('magnet at 255, flip at 248; IV/HV cheap.')).toEqual({
      lead: 'magnet at 255, flip at 248; IV/HV cheap.',
      rest: '',
    });
  });
  it('handles empty input', () => {
    expect(leadAndRest('')).toEqual({ lead: '', rest: '' });
  });
});

describe('deriveReasoning', () => {
  it('prefers summary as the lead and keeps the full rationale as detail', () => {
    const r = deriveReasoning(strat({ summary: 'Sit out — pinned on the magnet.' }));
    expect(r.lead).toBe('Sit out — pinned on the magnet.');
    expect(r.detail).toBe('Full first sentence. Second detail sentence.');
  });
  it('falls back to the first sentence as the lead, remainder as detail (no duplication)', () => {
    const r = deriveReasoning(strat({ summary: null }));
    expect(r.lead).toBe('Full first sentence.');
    expect(r.detail).toBe('Second detail sentence.');
  });
});

describe('ReasoningSection', () => {
  it('renders Why, Re-engage, and a collapsible full read that toggles', async () => {
    const user = userEvent.setup();
    render(
      <ReasoningSection
        strategy={strat({
          summary: 'Sit this one out — price is pinned on the 425 magnet.',
          key_points: ['Dominant call wall at 425', 'IV/HV 0.87 favors buying premium'],
          reengage_when: ['Break and hold above 425'],
          rationale: 'The magnet is glued to price. There is no room to fade toward it.',
        })}
      />,
    );
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('Dominant call wall at 425')).toBeInTheDocument();
    expect(screen.getByText('Re-engage when')).toBeInTheDocument();
    expect(screen.getByText('Break and hold above 425')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Full analysis & data' });
    expect(toggle).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('degrades to just a Rationale lead when the model omits structure (Case B)', () => {
    render(
      <ReasoningSection
        strategy={strat({ summary: null, key_points: undefined, reengage_when: undefined })}
      />,
    );
    expect(screen.getByText('Rationale')).toBeInTheDocument();
    expect(screen.getByText('Full first sentence.')).toBeInTheDocument();
    // Remaining sentence is available behind the toggle.
    expect(screen.getByRole('button', { name: 'Full analysis & data' })).toBeInTheDocument();
    expect(screen.queryByText('Why')).toBeNull();
    expect(screen.queryByText('Re-engage when')).toBeNull();
  });

  it('suppresses the lead when a hero already shows it', () => {
    render(
      <ReasoningSection
        suppressLead
        strategy={strat({
          summary: 'Lead shown by the hero.',
          key_points: ['a point'],
          rationale: 'One sentence only.',
        })}
      />,
    );
    expect(screen.queryByText('Rationale')).toBeNull();
    expect(screen.getByText('a point')).toBeInTheDocument();
  });
});

describe('LevelsStrip', () => {
  const bundle = {
    market_state: {
      call_wall: 425,
      gamma_flip: 382,
      put_wall: 350,
      max_pain: 400,
      net_gex: 3.41e8,
      iv_hv_ratio: 0.874,
      vwap: 426.38,
    },
  } as unknown as TickerBundle;

  it('renders the level chips sourced from the bundle', () => {
    render(<LevelsStrip bundle={bundle} />);
    expect(screen.getByText('Levels in play')).toBeInTheDocument();
    expect(screen.getByText('call wall')).toBeInTheDocument();
    expect(screen.getByText('gamma flip')).toBeInTheDocument();
    expect(screen.getByText('net GEX')).toBeInTheDocument();
    expect(screen.getByText('341.0M')).toBeInTheDocument(); // compact-formatted
    expect(screen.getByText('0.87')).toBeInTheDocument(); // iv/hv, 2 decimals
  });

  it('renders nothing without a bundle', () => {
    const { container } = render(<LevelsStrip bundle={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
