/**
 * `TopNav` — the v2 navigation (SPEC §4.3, canon rule 19, curvature-v2-foundations). AC-23b: no
 * `/_ops` route anywhere in the trader shell (invariant operator-vs-trader-path-separation). The
 * drawer links are only mounted once the burger opens it, so this is the one check that sees them;
 * the app-level route walk never opens the drawer.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TopNav } from './TopNav';

describe('AC-23b — no /_ops route in the nav or the drawer', () => {
  it('no rendered nav link points at /_ops', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/ticker']}>
          <TopNav />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await user.click(screen.getByTestId('nav-menu-button'));
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const a of links) expect(a.getAttribute('href')).not.toMatch(/\/_ops/);
  });
});
