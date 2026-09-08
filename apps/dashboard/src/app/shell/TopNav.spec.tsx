/**
 * `TopNav` — the v2 navigation (SPEC §4.3, canon rule 19, curvature-v2-foundations). AC-23
 * (exactly four product links, Lab/Blog absent from bar and drawer), AC-23b (no `/_ops` route
 * anywhere, source scan), AC-23c (no clock, no bell, no live-toned chip), N2 (active link state),
 * N4 (<900px burger), N5 (<1100px search-icon collapse).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TopNav } from './TopNav';

function renderNav(props: React.ComponentProps<typeof TopNav> = {}, path = '/ticker') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <TopNav {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('AC-23 — exactly the four product links; Lab and Blog absent from bar AND drawer', () => {
  it('the inline bar shows Scanner, Ticker, Positions, Alerts and no others', () => {
    renderNav();
    for (const label of ['Scanner', 'Ticker', 'Positions', 'Alerts']) {
      expect(screen.getByTestId(`nav-${label.toLowerCase()}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('nav-lab')).toBeNull();
    expect(screen.queryByTestId('nav-blog')).toBeNull();
  });

  it('the drawer (opened) shows the same four and no Lab/Blog', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByTestId('nav-menu-button'));
    for (const label of ['scanner', 'ticker', 'positions', 'alerts']) {
      expect(screen.getByTestId(`nav-drawer-${label}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('nav-drawer-lab')).toBeNull();
    expect(screen.queryByTestId('nav-drawer-blog')).toBeNull();
  });
});

// Strips comments before scanning (mirrors `StraddleMove.spec.tsx`'s `code()` helper): comments
// legitimately DOCUMENT the deliberate absence ("no /_ops entry — URL-only"); the scan asserts
// what the CODE does, not what the prose says about it.
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('AC-23b — no /_ops route in the nav, the drawer, or the sources', () => {
  it('no /_ops literal appears in TopNav.tsx CODE (comments may document the deliberate absence)', async () => {
    const src = (await import('./TopNav?raw')).default as unknown as string;
    expect(code(src)).not.toContain('/_ops');
  });

  it('no rendered nav link points at /_ops', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByTestId('nav-menu-button'));
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const a of links) expect(a.getAttribute('href')).not.toMatch(/\/_ops/);
  });
});

describe('AC-23c — no clock, no bell, no live-toned chip or pulsing dot, signed in or out', () => {
  it('the bar carries none of these', () => {
    renderNav();
    expect(screen.queryByLabelText(/clock/i)).toBeNull();
    expect(screen.queryByLabelText(/notifications|bell/i)).toBeNull();
    expect(document.querySelector('[style*="animation"]')).toBeNull();
    expect(screen.queryByTestId('figure-live-dot')).toBeNull();
  });
});

describe('N2 — the active link carries aria-current AND the colour state, never colour alone', () => {
  it('the current route is aria-current="page" and the others are not', () => {
    renderNav({}, '/ticker/SPY');
    expect(screen.getByTestId('nav-ticker')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-scanner')).not.toHaveAttribute('aria-current');
  });
});

describe('N4 — burger below 900px; N5 — search collapses to an icon below 1100px (declaration only)', () => {
  it('the burger button and the drawer exist, labelled for assistive tech', () => {
    renderNav();
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('both the field form and the icon form of the palette trigger are present in markup (CSS decides which shows)', () => {
    renderNav();
    expect(screen.getByTestId('nav-search-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('nav-search-icon')).toBeInTheDocument();
  });
});

describe('the ⌘K affordance calls onOpenPalette when provided, and is inert (no throw) when absent', () => {
  it('clicking the field form calls onOpenPalette', async () => {
    const user = userEvent.setup();
    const onOpenPalette = vi.fn();
    renderNav({ onOpenPalette });
    await user.click(screen.getByTestId('nav-search-trigger'));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it('clicking the icon form calls onOpenPalette', async () => {
    const user = userEvent.setup();
    const onOpenPalette = vi.fn();
    renderNav({ onOpenPalette });
    await user.click(screen.getByTestId('nav-search-icon'));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it('is inert (does not throw) when onOpenPalette is not passed', async () => {
    const user = userEvent.setup();
    renderNav();
    await expect(user.click(screen.getByTestId('nav-search-trigger'))).resolves.not.toThrow();
  });
});

describe('the wordmark links home, never the operator route', () => {
  it('shell-brand hrefs to /', () => {
    renderNav();
    expect(screen.getByTestId('shell-brand')).toHaveAttribute('href', '/');
  });
});
