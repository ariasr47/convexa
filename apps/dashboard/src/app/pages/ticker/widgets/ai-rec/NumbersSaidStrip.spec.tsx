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
  // The move line shows the straddle move of exactly the tenor it names: the cited expiration, or
  // the payload's primary tenor when nothing is cited (no_trade, AC-66). A cited expiration with no
  // matching tenor says so for that expiry and never relabels another tenor's number.
  it.each([
    {
      name: 'a cited expiration with a matching tenor shows that tenor’s move',
      citedExpiration: '2026-07-18' as string | null,
      shown: 'numbers-said-move',
      hidden: 'numbers-said-move-absent',
      label: /Jul \d+ \(\d+ DTE\)/,
      raw: '2026-07-18',
      dollars: '$10.00' as string | null,
    },
    {
      name: 'a cited expiration with no matching tenor says so for that expiry, never another tenor',
      citedExpiration: '2026-08-21',
      shown: 'numbers-said-move-absent',
      hidden: 'numbers-said-move',
      label: /Aug \d+ \(\d+ DTE\)/,
      raw: '2026-08-21',
      dollars: null,
    },
    {
      name: 'AC-66 — a null cited expiration (no_trade) falls back to the payload primary tenor',
      citedExpiration: null,
      shown: 'numbers-said-move',
      hidden: 'numbers-said-move-absent',
      label: /Jul \d+ \(\d+ DTE\)/,
      raw: '2026-07-18',
      dollars: '$10.00',
    },
  ])('picks the move tenor: $name', ({ citedExpiration, shown, hidden, label, raw, dollars }) => {
    renderStrip({ citedExpiration });
    const line = screen.getByTestId(shown);
    expect(line).toHaveTextContent(label);
    expect(line).not.toHaveTextContent(raw);
    if (dollars) expect(line).toHaveTextContent(dollars);
    expect(screen.queryByTestId(hidden)).not.toBeInTheDocument();
  });
});
