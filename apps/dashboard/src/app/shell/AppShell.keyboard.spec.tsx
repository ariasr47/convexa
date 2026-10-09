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

const { getScanMock } = vi.hoisted(() => ({ getScanMock: vi.fn() }));
vi.mock('@convexa/api', () => ({ getScan: getScanMock }));

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
});
