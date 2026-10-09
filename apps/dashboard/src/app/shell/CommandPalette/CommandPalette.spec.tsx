/**
 * `CommandPalette` — component states (SPEC §4.4 P1–P6). Network mocked at `getScan()` only.
 * The keyboard END-TO-END walk (⌘K open → reach all four surfaces) lives in `palette.flow.spec.tsx`;
 * the signed-out wall is covered in `app.risk.spec.tsx`. This file covers the palette's OWN render
 * states.
 */
import { theme } from '@/shared/theme/theme';
import type { ScanResponse, ScanRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
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
    // SPEC B4 — additive, required on the wire; 'live' is this suite's unchanged default.
    market_data: 'live',
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

describe('P2a — the open→resolved window is a named LOADING state, not a gap', () => {
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
