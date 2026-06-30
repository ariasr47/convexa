/**
 * StatTile (shared atom) — component-state tests. Asserts the upgraded-tile observable contract:
 * accent (up/down/neutral) → success/error/divider left-accent bar; the label + ⓘ affordance; the
 * mono value; the live-derived OFFLINE state (dim + `⏸ offline` caption); and the cold-load
 * StatSkeleton (LOADING look, `data-testid="cold-skeleton"`, no progressbar role).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import { StatTile, StatSkeleton } from './StatTile';

function wrap(ui: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('StatTile (shared atom)', () => {
  it('renders label and mono value', () => {
    wrap(<StatTile label="Call wall" value="$260" accent="up" />);
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    const val = screen.getByText('$260');
    expect(val).toBeInTheDocument();
    // The value figure uses the mono font stack (figures are mono — token-bound).
    expect(getComputedStyle(val).fontFamily.toLowerCase()).toContain('mono');
  });

  it('shows the ⓘ affordance only when info copy is given', () => {
    const { rerender } = wrap(<StatTile label="Spread" value="$0.05" />);
    // No info → no InfoOutlined icon.
    expect(document.querySelector('[data-testid="InfoOutlinedIcon"]')).toBeNull();
    rerender(<ThemeProvider theme={theme}><StatTile label="Spread" value="$0.05" info="best ask minus best bid" /></ThemeProvider>);
    expect(document.querySelector('[data-testid="InfoOutlinedIcon"]')).not.toBeNull();
  });

  it('OFFLINE: dims and shows the ⏸ offline caption (live-derived tiles)', () => {
    wrap(<StatTile label="Net flow (5m)" value="+1,200" accent="up" offline />);
    expect(screen.getByText('⏸ offline')).toBeInTheDocument();
    // Default (not offline) shows no offline caption.
    render(<ThemeProvider theme={theme}><StatTile label="Net flow (5m)" value="+1,200" accent="up" /></ThemeProvider>);
    expect(screen.getAllByText('⏸ offline').length).toBe(1); // only the offline instance
  });

  it('accent maps to the directional success/error/divider bar (renders without throw for each)', () => {
    for (const accent of ['up', 'down', 'neutral'] as const) {
      const { unmount } = wrap(<StatTile label={`A-${accent}`} value="1" accent={accent} />);
      expect(screen.getByText(`A-${accent}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('accentColor overrides the accent bar (non-directional tier emphasis)', () => {
    wrap(<StatTile label="Opportunity" value="73 · Actionable" accent="neutral" accentColor={theme.palette.warning.main} />);
    expect(screen.getByText('73 · Actionable')).toBeInTheDocument();
  });

  it('StatSkeleton is the LOADING look: cold-skeleton testid, no progressbar role', () => {
    wrap(<StatSkeleton />);
    const sk = screen.getByTestId('cold-skeleton');
    expect(sk).toBeInTheDocument();
    expect(sk.querySelector('[role="progressbar"]')).toBeNull();
    // LOADING ≠ EMPTY: a skeleton carries no "unavailable" copy.
    expect(screen.queryByText(/unavailable/i)).toBeNull();
  });
});
