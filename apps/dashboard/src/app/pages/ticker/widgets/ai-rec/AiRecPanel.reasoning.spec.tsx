/**
 * Unit — the bundle-sourced "Levels in play" strip on the AI-rec card. Renders the exported piece in
 * isolation (no App/network mount).
 */
import type { TickerBundle } from '@convexa/api';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LevelsStrip } from './reasoning';

afterEach(cleanup);

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
});
