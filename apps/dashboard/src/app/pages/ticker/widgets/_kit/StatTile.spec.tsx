/**
 * StatTile / StatSkeleton — RISK-BASED tests (qa-verify.md §4, 2026-07-13). The shared atom carries two
 * degradation contracts the whole board relies on:
 *   - the `⏸ offline` caption renders ONLY in the offline state (`[live-vs-static-isolation]` — a tile
 *     that showed it always, or never, would silently break the page-level dim-on-drop treatment);
 *   - StatSkeleton is the LOADING look and stays DISTINCT from EMPTY (`cold-skeleton` testid is what
 *     the page-level risk spec keys the three-degraded-states walk on; no progressbar, no
 *     "unavailable" copy).
 * NOT asserted (visible → review): label/value rendering, mono font, accent bar colors, ⓘ presence.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatSkeleton, StatTile } from './StatTile';

function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('StatTile (shared atom)', () => {
  it('renders the ⏸ offline caption ONLY when offline', () => {
    const { unmount } = wrap(<StatTile label="Net flow (5m)" value="+1,200" accent="up" offline />);
    expect(screen.getByText('⏸ offline')).toBeInTheDocument();
    // The offline tile still shows its last-known value — dimmed, never blanked.
    expect(screen.getByText('+1,200')).toBeInTheDocument();
    unmount();
    wrap(<StatTile label="Net flow (5m)" value="+1,200" accent="up" />);
    expect(screen.queryByText('⏸ offline')).toBeNull();
  });

  it('StatSkeleton is the LOADING look, distinct from EMPTY: cold-skeleton testid, no progressbar, no "unavailable" copy', () => {
    wrap(<StatSkeleton />);
    const sk = screen.getByTestId('cold-skeleton');
    expect(sk).toBeInTheDocument();
    expect(sk.querySelector('[role="progressbar"]')).toBeNull();
    expect(screen.queryByText(/unavailable/i)).toBeNull();
  });

  it('renders optional secondary caption only when provided (distance-to-spot seam)', () => {
    const { unmount } = wrap(
      <StatTile label="Call wall" value="$260" secondary="+$10 · 4.0% above" />,
    );
    expect(screen.getByTestId('stat-secondary')).toHaveTextContent('+$10 · 4.0% above');
    unmount();
    wrap(<StatTile label="Call wall" value="$260" />);
    expect(screen.queryByTestId('stat-secondary')).toBeNull();
  });
});
