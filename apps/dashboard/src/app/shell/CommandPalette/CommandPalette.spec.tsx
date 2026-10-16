/**
 * `CommandPalette` — its own render states on a LIVE build (production). Network mocked at the API
 * client. What earns a test here is what fails silently and costs something: production must never
 * call the scan (it needs the options feed this site doesn't run, AC “opening ⌘K sends no request
 * to /api/scan”), a failed ticker list must leave the palette usable, and the “nothing matches”
 * claim must not fire before the lists have answered.
 * The keyboard END-TO-END walk (⌘K open → reach the surfaces) lives in `palette.flow.spec.tsx`.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

const { getScanMock, getScanUniverseMock } = vi.hoisted(() => ({
  getScanMock: vi.fn(),
  getScanUniverseMock: vi.fn(),
}));
vi.mock('@convexa/api', () => ({
  getScan: getScanMock,
  getScanUniverse: getScanUniverseMock,
  dataMode: 'live',
  getMarketDataMode: async () => 'not_live',
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function renderPalette(open = true, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <CommandPalette open={open} onClose={onClose} />
        </MemoryRouter>
      </ThemeProvider>,
    ),
  };
}

describe('production ⌘K lists tickers by name and never calls the scan', () => {
  it('reads the universe, lists it A→Z, and makes no getScan() call', async () => {
    getScanUniverseMock.mockResolvedValue({ symbols: ['SPY', 'AAPL', 'QQQ'], universe_size: 3 });
    renderPalette(true);
    await screen.findByTestId('palette-symbol-AAPL');
    const symbols = screen
      .getAllByTestId(/^palette-symbol-/)
      .map((el) => el.getAttribute('data-testid'));
    // Research-noted tickers join the universe; the universe's three keep A→Z order among them.
    const universe = symbols.filter((s) => /-(AAPL|QQQ|SPY)$/.test(s ?? ''));
    expect(universe).toEqual(['palette-symbol-AAPL', 'palette-symbol-QQQ', 'palette-symbol-SPY']);
    expect(screen.getByTestId('palette-footnote')).toHaveTextContent(
      'Scores aren’t live on this site, so tickers list by name.',
    );
    expect(getScanMock).not.toHaveBeenCalled();
  });
});

describe('P2a — the open→resolved window is a named LOADING state, not a gap', () => {
  it('a typed plausible symbol offers "open anyway" before the list resolves, and claims no empty result', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberately never-resolving.
    getScanUniverseMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPalette(true);
    await user.type(screen.getByTestId('palette-input'), 'QXTR');
    expect(await screen.findByTestId('palette-open-anyway')).toHaveTextContent(
      'Open QXTR anyway →',
    );
    expect(screen.queryByTestId('palette-empty')).toBeNull();
  });
});

describe('a failed ticker list still leaves the palette usable', () => {
  it('says so, keeps the go-to commands, and still offers "open anyway"', async () => {
    getScanUniverseMock.mockRejectedValue(new Error('transport fault'));
    const user = userEvent.setup();
    renderPalette(true);
    expect(await screen.findByTestId('palette-unavailable')).toHaveTextContent(
      'Couldn’t search tickers right now.',
    );
    expect(screen.getByTestId('palette-command-surface-scanner')).toBeInTheDocument();
    await user.type(screen.getByTestId('palette-input'), 'QXTR');
    expect(await screen.findByTestId('palette-open-anyway')).toBeInTheDocument();
    // The ticker list was never searched, so “No ticker or note matches” would be a false claim.
    expect(screen.queryByTestId('palette-empty')).toBeNull();
  });

  it('no match is one honest line once both lists answered', async () => {
    getScanUniverseMock.mockResolvedValue({ symbols: [], universe_size: 0 });
    const user = userEvent.setup();
    renderPalette(true);
    await waitFor(() => expect(screen.queryAllByTestId('palette-skeleton-row')).toHaveLength(0));
    await user.type(screen.getByTestId('palette-input'), 'QXTR');
    expect(await screen.findByTestId('palette-empty')).toHaveTextContent(
      'No ticker or note matches “QXTR”.',
    );
    expect(screen.queryByTestId('palette-unavailable')).toBeNull();
  });
});
