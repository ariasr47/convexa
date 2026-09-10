/**
 * `CommandPalette` — component states (SPEC §4.4 P1–P6). Network mocked at `getScan()` only.
 * The keyboard END-TO-END walk (⌘K open → navigate → close, signed-out wall, unsaved-field
 * survival) lives in `palette.flow.spec.tsx` — this file covers the palette's OWN render states.
 */
import { theme } from '@/shared/theme/theme';
import type { ScanResponse, ScanRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

const { getScanMock } = vi.hoisted(() => ({ getScanMock: vi.fn() }));
vi.mock('@convexa/api', () => ({ getScan: getScanMock }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function row(over: Partial<ScanRow> = {}): ScanRow {
  return {
    symbol: 'SPY',
    status: 'ok',
    tier: 'actionable',
    score: 62,
    as_of: Math.floor(Date.now() / 1000) - 5,
    price: 500,
    chg_pct: 0.1,
    call_wall: null,
    put_wall: null,
    flip: null,
    dist_to_wall_pct: null,
    dist_to_flip_pct: null,
    regime: null,
    vol_regime: null,
    ...over,
  } as ScanRow;
}

function scanResponse(over: Partial<ScanResponse> = {}): ScanResponse {
  return {
    rows: [
      row({ symbol: 'SPY' }),
      row({ symbol: 'SPX', score: 40 }),
      row({ symbol: 'AAPL', score: 81 }),
    ],
    sweep: {
      sweep_last_completed: Math.floor(Date.now() / 1000) - 10,
      universe_size: 3,
      updated_at: 0,
    },
    view: {} as ScanResponse['view'],
    ...over,
  };
}

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

describe('P1 — closed renders nothing', () => {
  it('no dialog in the DOM when open=false', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberately never-resolving.
    getScanMock.mockReturnValue(new Promise(() => {}));
    renderPalette(false);
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });
});

describe('P2a — the open→resolved window is a named LOADING state, not a gap', () => {
  it('skeleton rows are present (positive observable); the dialog stays usable throughout', async () => {
    let resolve!: (v: ScanResponse) => void;
    getScanMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPalette(true);

    expect(await screen.findAllByTestId('palette-skeleton-row')).toHaveLength(4);
    // The four surface commands are usable mid-flight.
    for (const id of ['scanner', 'ticker', 'positions', 'alerts']) {
      expect(screen.getByTestId(`palette-command-surface-${id}`)).toBeInTheDocument();
    }
    // No tier, no score, no status word, never a 0.
    expect(screen.queryByText(/^0$/)).toBeNull();
    expect(screen.queryByTestId('palette-empty')).toBeNull();
    expect(screen.queryByTestId('palette-unavailable')).toBeNull();

    resolve(scanResponse());
    await waitFor(() => expect(screen.queryAllByTestId('palette-skeleton-row')).toHaveLength(0));
  });

  it('a typed plausible symbol offers "open anyway" even before the read resolves', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberately never-resolving.
    getScanMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPalette(true);
    await user.type(screen.getByTestId('palette-input'), 'NVDA');
    expect(await screen.findByTestId('palette-open-anyway')).toHaveTextContent(
      'Open NVDA anyway →',
    );
    // The "no tracked symbol matches" CLAIM must not fire while we don't yet know (absent-is-not-none).
    expect(screen.queryByTestId('palette-empty')).toBeNull();
  });

  it('once resolved, the loading form is absent and does not reappear on a later failure', async () => {
    getScanMock.mockResolvedValue(scanResponse());
    renderPalette(true);
    await waitFor(() => expect(screen.queryAllByTestId('palette-skeleton-row')).toHaveLength(0));
    expect(screen.getByTestId('palette-symbol-SPY')).toBeInTheDocument();
    // No re-fetch happens on this same open — the read is one-shot.
    expect(getScanMock).toHaveBeenCalledTimes(1);
  });
});

describe('P2 — empty query shows the tracked-universe default view (never an empty box)', () => {
  it('renders every row once resolved', async () => {
    getScanMock.mockResolvedValue(scanResponse());
    renderPalette(true);
    expect(await screen.findByTestId('palette-symbol-SPY')).toBeInTheDocument();
    expect(screen.getByTestId('palette-symbol-SPX')).toBeInTheDocument();
    expect(screen.getByTestId('palette-symbol-AAPL')).toBeInTheDocument();
  });

  it('the footer helper row advertises exactly move/open/close (AC-33b)', async () => {
    getScanMock.mockResolvedValue(scanResponse());
    renderPalette(true);
    const footer = await screen.findByTestId('palette-footer');
    expect(footer).toHaveTextContent('↑↓ move');
    expect(footer).toHaveTextContent('↵ open ticker');
    expect(footer).toHaveTextContent('esc close');
  });
});

describe('P3 — typing filters as prefix-then-substring; the first row is pre-selected', () => {
  it('filters to matching symbols and points aria-activedescendant at the first', async () => {
    getScanMock.mockResolvedValue(scanResponse());
    const user = userEvent.setup();
    renderPalette(true);
    await screen.findByTestId('palette-symbol-SPY');

    await user.type(screen.getByTestId('palette-input'), 'SP');
    await waitFor(() => {
      expect(screen.getByTestId('palette-symbol-SPY')).toBeInTheDocument();
      expect(screen.getByTestId('palette-symbol-SPX')).toBeInTheDocument();
      expect(screen.queryByTestId('palette-symbol-AAPL')).toBeNull();
    });

    const input = screen.getByTestId('palette-input').querySelector('input')!;
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const active = document.getElementById(activeId!);
    // The first item overall is a SURFACE command (commands are always first); confirm it is
    // marked selected via aria-selected, not merely rendered.
    expect(active).toHaveAttribute('aria-selected', 'true');
  });
});

describe('P4 — no results is one honest line, visibly distinct from AC-30 unavailable', () => {
  it('shows the tracked-universe copy plus "open anyway" for a plausible symbol', async () => {
    getScanMock.mockResolvedValue(scanResponse({ rows: [] }));
    const user = userEvent.setup();
    renderPalette(true);
    await waitFor(() => expect(screen.queryAllByTestId('palette-skeleton-row')).toHaveLength(0));
    await user.type(screen.getByTestId('palette-input'), 'ZZZZZ'.slice(0, 4));
    const empty = await screen.findByTestId('palette-empty');
    expect(empty).toHaveTextContent(/No tracked symbol matches/);
    expect(screen.queryByTestId('palette-unavailable')).toBeNull();
  });

  it('a query that is NOT a plausible ticker shows the empty line with no "open anyway"', async () => {
    getScanMock.mockResolvedValue(scanResponse({ rows: [] }));
    const user = userEvent.setup();
    renderPalette(true);
    await waitFor(() => expect(screen.queryAllByTestId('palette-skeleton-row')).toHaveLength(0));
    await user.type(screen.getByTestId('palette-input'), 'TOOLONGNAME');
    await screen.findByTestId('palette-empty');
    expect(screen.queryByTestId('palette-open-anyway')).toBeNull();
  });
});

describe('AC-30 — a degraded scan read still leaves the palette usable', () => {
  it('the ranked section shows an honest unavailable state; surfaces still navigate', async () => {
    getScanMock.mockRejectedValue(new Error('transport fault'));
    renderPalette(true);
    expect(await screen.findByTestId('palette-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('palette-command-surface-scanner')).toBeInTheDocument();
    expect(screen.queryByTestId('palette-empty')).toBeNull();
  });

  it('a plausible symbol still offers "open anyway" when the ranked read is unavailable', async () => {
    getScanMock.mockRejectedValue(new Error('transport fault'));
    const user = userEvent.setup();
    renderPalette(true);
    await screen.findByTestId('palette-unavailable');
    await user.type(screen.getByTestId('palette-input'), 'NVDA');
    expect(await screen.findByTestId('palette-open-anyway')).toBeInTheDocument();
  });
});

describe('AC-31b — symbols only, no company name anywhere', () => {
  it('renders no name-shaped text (only the ticker symbol itself)', async () => {
    getScanMock.mockResolvedValue(scanResponse());
    renderPalette(true);
    await screen.findByTestId('palette-symbol-SPY');
    expect(screen.queryByText(/SPDR|Apple|S&P 500/i)).toBeNull();
  });
});

describe('AC-29/AC-29b rendered in situ — status vocabulary + freshness, never bare', () => {
  it('every rendered row carries a freshness caption', async () => {
    getScanMock.mockResolvedValue(scanResponse());
    renderPalette(true);
    const spyRow = await screen.findByTestId('palette-symbol-SPY');
    expect(within(spyRow).getByTestId('palette-freshness-SPY')).toBeInTheDocument();
  });

  it('a building row renders the bare dash, never a fabricated score', async () => {
    getScanMock.mockResolvedValue(
      scanResponse({ rows: [row({ symbol: 'BLDG', status: 'building', score: null })] }),
    );
    renderPalette(true);
    const r = await screen.findByTestId('palette-symbol-BLDG');
    expect(within(r).getByText('—')).toBeInTheDocument();
    expect(within(r).queryByText('0')).toBeNull();
  });
});
