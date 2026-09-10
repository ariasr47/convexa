import { theme } from '@/shared/theme/theme';
import type { CandidateSetEnvelope, StraddleMove as StraddleMoveRead } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NumbersSaidStrip } from './NumbersSaidStrip';

afterEach(() => cleanup());

function candidates(overrides: Partial<CandidateSetEnvelope> = {}): CandidateSetEnvelope {
  return {
    ticker: 'TSLA',
    state: 'ok',
    as_of: '2026-06-26T14:00:00Z',
    snapshot_age_seconds: 30,
    session_basis: 'after_close',
    quote_age: 'unknown',
    anchor_spot: 250,
    anchor_basis: 'gex_spot',
    band_pct: 15,
    budget: 'prompt',
    sent_to_model: true,
    caps: { tenors: 2, rights: 2, strikes_per_tenor_right: 5, max_records: 20, max_bytes: 8000 },
    included: { contracts: 4, expirations: ['2026-07-18'], expiration_count: 1 },
    omitted: {
      total: 0,
      expirations_omitted_by_cap: 0,
      by_reason: {
        outside_window: 0,
        outside_band: 0,
        no_interest: 0,
        expiration_cap: 0,
        strike_cap: 0,
      },
    },
    liquidity: {
      quoted: 4,
      no_two_sided_quote: 0,
      atm_relative_spread_band: 'tight',
      wide_quotes: false,
      wide_quote_threshold_pct: 15,
    },
    contracts: [],
    ...overrides,
  };
}

function move(overrides: Partial<StraddleMoveRead> = {}): StraddleMoveRead {
  return {
    state: 'ok',
    as_of: '2026-06-26T14:00:00Z',
    session_basis: 'after_close',
    anchor_spot: 250,
    anchor_basis: 'gex_spot',
    anchor_label: 'gex_spot',
    primary_expiration: '2026-07-18',
    wide_quote_threshold_pct: 15,
    tenors: [
      {
        expiration: '2026-07-18',
        dte: 25,
        strike_used: 250,
        strike_distance_pct: 0,
        straddle_price: 10,
        move_dollars: 10,
        move_pct: 4,
        basis: 'atm_straddle_mid',
        quote_spread_pct_of_mid: 8,
        wide_quotes: false,
      },
    ],
    ...overrides,
  };
}

function renderStrip(props: Partial<Parameters<typeof NumbersSaidStrip>[0]> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <NumbersSaidStrip
        candidates={candidates()}
        move={move()}
        citedExpiration="2026-07-18"
        {...props}
      />
    </ThemeProvider>,
  );
}

describe('NumbersSaidStrip — AC-4/54/66 (ship-blocking)', () => {
  it('renders the digested liquidity line from the wire counts only', () => {
    renderStrip();
    expect(screen.getByTestId('numbers-said-liquidity')).toHaveTextContent(
      '4 candidates across 1 expirations',
    );
  });

  it('renders the move for the cited expiration, exact match', () => {
    renderStrip();
    expect(screen.getByTestId('numbers-said-move')).toHaveTextContent('2026-07-18');
    expect(screen.getByTestId('numbers-said-move')).toHaveTextContent('$10.00');
  });

  it('a no-match expiration says so for that expiry and never relabels another tenor', () => {
    renderStrip({ citedExpiration: '2026-08-21' });
    expect(screen.getByTestId('numbers-said-move-absent')).toHaveTextContent('2026-08-21');
    expect(screen.queryByTestId('numbers-said-move')).not.toBeInTheDocument();
  });

  it('AC-66 — a null cited expiration (no_trade) still renders a real move reading via the payload primary tenor', () => {
    renderStrip({ citedExpiration: null });
    expect(screen.getByTestId('numbers-said-move')).toHaveTextContent('2026-07-18');
  });

  it('renders on an unavailable candidate set with the unavailable literal, never a throw', () => {
    renderStrip({ candidates: { ...candidates(), state: 'unavailable' } });
    expect(screen.getByTestId('numbers-said-liquidity')).toHaveTextContent(/unavailable/);
  });

  it('AC-8 (GATE Q correction) — renders the candidate set as-of (exchange-clock form, fidelity repair 2 N5) and session basis, un-hovered', () => {
    renderStrip();
    const freshness = screen.getByTestId('numbers-said-freshness');
    expect(freshness.textContent ?? '').not.toContain(candidates().as_of as string);
    expect(freshness).toHaveTextContent(/\d{2}:\d{2}:\d{2} ET/);
    expect(freshness).toHaveTextContent(/prior close|live session/);
  });

  it('an empty band renders the checked-empty literal, distinct from unavailable', () => {
    renderStrip({
      candidates: {
        ...candidates(),
        state: 'none_in_band',
        included: { contracts: 0, expirations: [], expiration_count: 0 },
      },
    });
    expect(screen.getByTestId('numbers-said-liquidity')).toHaveTextContent(/No candidates in band/);
  });
});
