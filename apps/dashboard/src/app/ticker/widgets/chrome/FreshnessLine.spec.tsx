/**
 * FreshnessLine — component tests for the REST-bundle freshness caption near the Ticker header.
 * Asserts: "Updated {age} ago" renders from the bundle freshness; the age live-counts up off
 * `snapshotIso` (1s tick); the quiet "· refreshing…" affordance shows while a background poll is in
 * flight and clears when it resolves; and the static `dataAgeSeconds` fallback is used when no ISO
 * anchor is present. It reflects the static path only — there is no live/SSE wiring here.
 */
import { ThemeProvider } from '@mui/material/styles';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../../theme';
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
  it('renders "Updated {age} ago" from the live-counted snapshot age', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const iso = new Date(Date.now() - 5_000).toISOString(); // ~5s ago
    renderFL({ snapshotIso: iso, dataAgeSeconds: 5 });
    const line = screen.getByTestId('freshness-line');
    expect(line.textContent).toMatch(/Updated 5s ago/);
  });

  it('age live-counts up between polls (1s tick off snapshotIso)', () => {
    vi.useFakeTimers();
    const iso = new Date(Date.now() - 5_000).toISOString();
    renderFL({ snapshotIso: iso, dataAgeSeconds: 5 });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 5s ago/);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 15s ago/);
  });

  it('falls back to static dataAgeSeconds when no snapshotIso anchor is present', () => {
    renderFL({ snapshotIso: null, dataAgeSeconds: 90 });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated 1m ago/);
  });

  it('shows "· refreshing…" while a background poll is in flight, and clears after it resolves', () => {
    const iso = new Date(Date.now() - 5_000).toISOString();
    const { rerender } = renderFL({ snapshotIso: iso, dataAgeSeconds: 5, refreshing: true });
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/refreshing…/);

    rerender(
      <ThemeProvider theme={theme}>
        <FreshnessLine snapshotIso={iso} dataAgeSeconds={5} refreshing={false} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('freshness-line').textContent).not.toMatch(/refreshing…/);
    expect(screen.getByTestId('freshness-line').textContent).toMatch(/Updated/);
  });
});
