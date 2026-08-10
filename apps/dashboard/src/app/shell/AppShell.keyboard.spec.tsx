/**
 * Product spine #6 — shell keyboard floor: skip link is the first tab stop and targets main.
 */
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

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

  it('skip link is the first focusable element in the shell (before nav)', () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<div>page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    const focusables = Array.from(
      document.querySelectorAll(
        'a[href], button, [tabindex]:not([tabindex="-1"]), input, select, textarea',
      ),
    ) as HTMLElement[];
    // First focusable in document order should be the skip link (parked off-screen until focus).
    expect(focusables[0]?.getAttribute('data-testid')).toBe('skip-to-main');
  });
});
