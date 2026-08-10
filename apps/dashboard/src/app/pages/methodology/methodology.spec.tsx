/**
 * Product spine #7 — methodology / trust surface.
 * Static honesty: heading order, no structure-as-live claim, CTAs, public copy invariants.
 */
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { METHOD_COPY } from './copy';
import { MethodologyPage } from './MethodologyPage';

afterEach(() => cleanup());

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <MethodologyPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('MethodologyPage (product spine #7)', () => {
  it('one h1, section h2s, no h3–h6 pollution', () => {
    const { container } = renderPage();
    expect(screen.getByTestId('methodology-page')).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(METHOD_COPY.title);
    const h2s = container.querySelectorAll('h2');
    expect(h2s.length).toBe(Object.keys(METHOD_COPY.sections).length);
    expect(container.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0);
  });

  it('covers the trust topics: structure, gamma bases, two speeds, score scope, failure modes', () => {
    renderPage();
    const text = screen.getByTestId('methodology-page').textContent ?? '';
    expect(text).toMatch(/walls|flip|GEX/i);
    expect(text).toMatch(/vol-norm|ATM IV|vol regimes/i);
    expect(text).toMatch(/analytic|zero-crossing|vendor.*gamma|dealer-sign|open-interest/i);
    expect(text).toMatch(/Structure as-of|two data speeds|structure.*poll|stream/i);
    expect(text).toMatch(/score|tier/i);
    expect(text).toMatch(
      /does not consume vol-normalized|not consume vol-norm|IV-rank band|advisory context/i,
    );
    expect(text).toMatch(/thin|single-name|unavailable|building/i);
    expect(text).toMatch(/never places|no real order|simulated/i);
    expect(screen.getByTestId('methodology-disclaimer').textContent).toMatch(
      /not investment advice/i,
    );
  });

  it('never claims structure is a live feed; never invents a broker send path', () => {
    renderPage();
    const text = screen.getByTestId('methodology-page').textContent ?? '';
    // Structure path must not be sold as live.
    expect(text).not.toMatch(/structure is live|live structure feed|live GEX stream/i);
    expect(text).not.toMatch(/place an order with your broker|send order to market/i);
  });

  it('CTAs point at scanner, free ticker, and home', () => {
    renderPage();
    expect(screen.getByTestId('methodology-cta-scanner')).toHaveAttribute('href', '/scanner');
    expect(screen.getByTestId('methodology-cta-ticker')).toHaveAttribute('href', '/ticker');
    expect(screen.getByTestId('methodology-cta-home')).toHaveAttribute('href', '/');
  });
});
