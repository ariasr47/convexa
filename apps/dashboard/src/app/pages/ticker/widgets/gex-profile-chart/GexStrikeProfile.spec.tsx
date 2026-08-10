/**
 * GexStrikeProfile — RISK-BASED spec (qa-verify.md §4, 2026-07-13). Keeps the widget's degradation
 * contract (no in-window strikes → the widget renders NOTHING, no empty frame, no throw) and adds unit
 * coverage for the previously-untested pure windowing logic (`windowedStrikes`) the wrapper AND chart
 * share — a silent regression there (walls dropped from the window, unsorted strikes) renders a
 * plausible-looking but wrong chart no reviewer would catch.
 * NOT asserted (visible + intentional → review): title/legend presence, bar colors, reference-line
 * styling, tooltip content.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { StrikeRow } from '@org/api';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { windowedStrikes } from './chart';
import { GexStrikeProfile } from './GexStrikeProfile';

const strike = (over: Partial<StrikeRow>): StrikeRow => ({
  strike: 250,
  net_gex: 1e6,
  call_gex: 1e6,
  put_gex: 0,
  call_oi: 0,
  put_oi: 0,
  total_oi: 0,
  net_dex: null,
  vol_oi_ratio: null,
  volume: null,
  ...over,
});

describe('windowedStrikes (pure windowing shared by wrapper + chart)', () => {
  it('widens the ±10% spot window to always include the walls it labels, and sorts ascending', () => {
    // Walls OUTSIDE ±10% of spot 250 (225–275): put wall 200, call wall 300.
    const rows = [320, 300, 250, 200, 180].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 300, 200);
    expect(out.map((s) => s.strike)).toEqual([200, 250, 300]); // walls kept, out-of-window dropped, sorted
  });

  it('non-positive walls fall back to the plain ±10% spot window', () => {
    const rows = [200, 230, 250, 270, 300].map((k) => strike({ strike: k }));
    const out = windowedStrikes(rows, 250, 0, 0);
    expect(out.map((s) => s.strike)).toEqual([230, 250, 270]); // 225–275 only
  });
});

describe('GexStrikeProfile (section wrapper)', () => {
  it('renders NOTHING (no empty widget frame, no throw) when no strikes fall in the window', () => {
    const cases: StrikeRow[][] = [
      [], // no strikes at all
      [strike({ strike: 1000 })], // strikes exist, none in-window
    ];
    for (const strikes of cases) {
      const { container, unmount } = render(
        <ThemeProvider theme={theme}>
          <div style={{ width: 600, height: 500 }}>
            <GexStrikeProfile
              strikes={strikes}
              spot={250}
              callWall={260}
              putWall={240}
              gammaFlip={248}
            />
          </div>
        </ThemeProvider>,
      );
      expect(screen.queryByTestId('widget-gex-strike-profile')).toBeNull();
      expect(container).toBeInTheDocument();
      unmount();
    }
  });
});
