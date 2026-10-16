/**
 * Product spine #6 — shell keyboard floor: skip link is the first tab stop and targets main.
 * AC-27 (curvature-v2-foundations): adding the ⌘K palette does not change this, on every route —
 * extended here rather than a second keyboard-floor test (PLAN FE-9).
 */
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const { getScanMock, resumeDemoPlaybackMock, resetDemoWorkspaceMock } = vi.hoisted(() => ({
  getScanMock: vi.fn(),
  resumeDemoPlaybackMock: vi.fn(),
  resetDemoWorkspaceMock: vi.fn(),
}));
vi.mock('@convexa/api', () => ({
  dataMode: 'live',
  demoClock: () => null,
  subscribeDemoClock: () => () => undefined,
  resumeDemoPlayback: resumeDemoPlaybackMock,
  resetDemoWorkspace: resetDemoWorkspaceMock,
  getScan: getScanMock,
  // A deliberately never-resolving read: these tests only need the palette's list to stay pending.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  getScanUniverse: () => new Promise(() => {}),
  getMarketDataMode: () => Promise.resolve('live'),
  DEMO_ACCOUNT: { id: 'demo-account', email: 'demo@example.invalid', display_name: 'Demo account' },
}));

describe('AppShell · keyboard skip link (spine #6)', () => {
  it('exposes a skip link targeting #main-content and a main landmark with that id', () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<div data-testid="page">page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    const skip = screen.getByTestId('skip-to-main');
    expect(skip.tagName.toLowerCase()).toBe('a');
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(skip).toHaveTextContent(/skip to main content/i);

    const main = document.querySelector('main#main-content');
    expect(main).toBeTruthy();
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });

  it('AC-27 — the ⌘K palette does not change the first tab stop, closed OR after an open+close cycle', async () => {
    // A deliberately never-resolving promise (this test only needs the read to stay pending).
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getScanMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/x" element={<div>page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    const firstFocusable = () =>
      (
        Array.from(
          document.querySelectorAll(
            'a[href], button, [tabindex]:not([tabindex="-1"]), input, select, textarea',
          ),
        ) as HTMLElement[]
      )[0];

    expect(firstFocusable()?.getAttribute('data-testid')).toBe('skip-to-main');

    await user.keyboard('{Meta>}k{/Meta}');
    await screen.findByTestId('command-palette');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());

    expect(firstFocusable()?.getAttribute('data-testid')).toBe('skip-to-main');
  });

  it('the single-key shortcuts never fire while typing, and do outside a field', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/x" element={<input aria-label="Note search" data-testid="field" />} />
              <Route path="/scanner" element={<div data-testid="scanner-route" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    // Typed into a field: the text lands in the field and the shell does nothing.
    const field = screen.getByTestId('field');
    await user.click(field);
    await user.keyboard('/gs?');
    expect(field).toHaveValue('/gs?');
    expect(screen.queryByTestId('command-palette')).toBeNull();
    expect(screen.queryByTestId('shortcuts-sheet')).toBeNull();
    expect(screen.queryByTestId('scanner-route')).toBeNull();

    // Outside a field: ? opens the sheet, Esc closes it, / opens the palette, g then s goes.
    field.blur();
    await user.keyboard('?');
    expect(await screen.findByTestId('shortcuts-sheet')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('shortcuts-sheet')).toBeNull());

    await user.keyboard('/');
    await screen.findByTestId('command-palette');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('command-palette')).toBeNull());

    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('gs');
    expect(await screen.findByTestId('scanner-route')).toBeInTheDocument();
  });

  it('an open Select or Menu list owns its letters: no shortcut fires from a focused option', async () => {
    // The DOM an open MUI Select / Menu leaves focus in: an option or menu item inside a
    // role="presentation" popover — no input, no dialog role.
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                path="/x"
                element={
                  <div role="presentation">
                    <ul role="listbox" aria-label="Persona">
                      <li role="option" aria-selected tabIndex={-1} data-testid="option">
                        Swing
                      </li>
                    </ul>
                    <ul role="menu" aria-label="Account">
                      <li role="menuitem" tabIndex={-1} data-testid="menuitem">
                        Settings
                      </li>
                    </ul>
                  </div>
                }
              />
              <Route path="/scanner" element={<div data-testid="scanner-route" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    for (const testid of ['option', 'menuitem']) {
      screen.getByTestId(testid).focus();
      await user.keyboard('gs?/');
      expect(screen.queryByTestId('scanner-route')).toBeNull();
      expect(screen.queryByTestId('shortcuts-sheet')).toBeNull();
      expect(screen.queryByTestId('command-palette')).toBeNull();
    }
  });
});
