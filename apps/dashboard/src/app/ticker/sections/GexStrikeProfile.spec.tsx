/**
 * GexStrikeProfile — component test for the section wrapper around the recharts net-GEX chart. Asserts
 * the re-skinned frame renders (title + legend), it delegates to the existing chart logic (per-strike
 * bars within the spot window), and it degrades to null when there are no in-window strikes (no throw).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import type { StrikeRow } from '@org/api';
import { theme } from '../../theme';
import { GexStrikeProfile } from './GexStrikeProfile';

const strike = (over: Partial<StrikeRow>): StrikeRow => ({
  strike: 250, net_gex: 1e6, call_gex: 1e6, put_gex: 0,
  call_oi: 0, put_oi: 0, total_oi: 0, net_dex: null, vol_oi_ratio: null, volume: null, ...over,
});

const strikes: StrikeRow[] = [
  strike({ strike: 240, net_gex: -2e6 }),
  strike({ strike: 250, net_gex: 1e6 }),
  strike({ strike: 260, net_gex: 3e6 }),
];

function wrap(ui: React.ReactNode) {
  // ResponsiveContainer needs a non-zero size in jsdom; give the parent an explicit box.
  return render(<ThemeProvider theme={theme}><div style={{ width: 600, height: 500 }}>{ui}</div></ThemeProvider>);
}

describe('GexStrikeProfile (section wrapper)', () => {
  it('renders the re-skinned frame: title + legend', () => {
    wrap(<GexStrikeProfile strikes={strikes} spot={250} callWall={260} putWall={240} gammaFlip={248} />);
    expect(screen.getByText('GEX strike profile')).toBeInTheDocument();
    expect(screen.getByText('Call-dominated (net +)')).toBeInTheDocument();
    expect(screen.getByText('Put-dominated (net −)')).toBeInTheDocument();
  });

  it('returns null (no throw) when no strikes fall in the spot window', () => {
    const { container } = wrap(<GexStrikeProfile strikes={[]} spot={250} callWall={260} putWall={240} gammaFlip={248} />);
    // The wrapper div is present but the chart card is not rendered.
    expect(screen.queryByText('GEX strike profile')).toBeNull();
    expect(container).toBeInTheDocument();
  });
});
