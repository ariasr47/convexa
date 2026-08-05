/**
 * R5a — the standing disclaimer: ONE source, two render sites, and no claim that a stored
 * credential falsifies.
 *
 * "No brokerage connection." was true until broker-connect shipped; the instant a Webull credential
 * is stored it is a lie the app tells on every page. The replacement keeps the load-bearing claims
 * (the sim book is paper; the brokerage link is read-only; not advice) and drops the one that
 * stopped being true.
 */
import { Footer } from '@/shell/Footer';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCLAIMER_TEXT, DisclaimerCopy } from './disclaimer';

const theme = createTheme();

afterEach(() => cleanup());

/** Whitespace-insensitive compare: JSX authoring inserts line breaks the DOM collapses. */
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('R5a · the standing disclaimer', () => {
  it('no longer claims "No brokerage connection" — the app now reads a real one', () => {
    expect(DISCLAIMER_TEXT).not.toContain('No brokerage connection');
  });

  it('names what IS still true: paper sim book, read-only brokerage, not advice', () => {
    expect(DISCLAIMER_TEXT).toContain('simulated');
    expect(DISCLAIMER_TEXT).toContain('read-only');
    expect(DISCLAIMER_TEXT).toContain('never places, changes, or cancels an order');
    expect(DISCLAIMER_TEXT).toContain('Not investment advice');
  });

  it('keeps <strong>simulated</strong> emphasized in the rendered form', () => {
    const r = render(<DisclaimerCopy />);
    expect(r.container.querySelector('strong')?.textContent).toBe('simulated');
  });

  it('the rendered form and the plain-text form say the same thing', () => {
    const r = render(<DisclaimerCopy />);
    expect(squash(r.container.textContent ?? '')).toBe(squash(DISCLAIMER_TEXT));
  });

  it('the FOOTER renders that one source (not its own copy of the words)', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </ThemeProvider>,
    );
    const el = screen.getByTestId('footer-disclaimer');
    expect(squash(el.textContent ?? '')).toBe(squash(DISCLAIMER_TEXT));
    expect(el.querySelector('strong')?.textContent).toBe('simulated');
  });
});
