/**
 * FreshnessLine — RISK-BASED spec (qa-verify.md §4, 2026-07-13). The caption's rendering is visible;
 * what a reviewer CANNOT see is the timer semantics:
 *   1. the age LIVE-COUNTS up off `snapshotIso` between polls (a frozen age silently misrepresents
 *      snapshot freshness — the exact trust this line exists to build);
 *   2. the honest fallback chain: no/invalid ISO anchor → the static `dataAgeSeconds`, never NaN/blank.
 * NOT asserted (visible → review): the "· refreshing…" affordance, exact copy, styling.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FreshnessLine } from './FreshnessLine';

function renderFL(props: Partial<React.ComponentProps<typeof FreshnessLine>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <FreshnessLine snapshotIso={null} dataAgeSeconds={null} refreshing={false} {...props} />
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('FreshnessLine (REST-bundle freshness caption)', () => {
  it('the age live-counts up between polls (1s tick off snapshotIso)', () => {
    vi.useFakeTimers();
    const iso = new Date(Date.now() - 5_000).toISOString();
    renderFL({ snapshotIso: iso, dataAgeSeconds: 5 });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 5s ago/);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 15s ago/);
  });

  it('falls back to the static dataAgeSeconds when the ISO anchor is missing or unparseable (never NaN/blank)', () => {
    const missing = renderFL({ snapshotIso: null, dataAgeSeconds: 90 });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 1m ago/);
    missing.unmount();
    renderFL({ snapshotIso: 'not-a-date', dataAgeSeconds: 90 });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 1m ago/);
    expect(screen.getByTestId('freshness-line').textContent).not.toMatch(/NaN/);
  });
});
