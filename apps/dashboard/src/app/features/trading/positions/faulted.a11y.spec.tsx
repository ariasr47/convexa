/**
 * V6 — THE FAULTED STATE'S WRITE-REFUSAL FLOOR (SPEC §7 invariant 7; AC-62, AC-63).
 *
 * Two properties a screenshot can never show and a diff never flags:
 *
 *   1. A REFUSED CONTROL NEVER FIRES. The refusal is `aria-disabled`, never the HTML `disabled`
 *      attribute, and click, Enter and Space all do nothing — so a corrupt store is never handed a
 *      write from the UI.
 *   2. THE BANNER NEVER OFFERS A DESTRUCTIVE PATH. The store never repairs and never deletes, so the
 *      banner carries no repair / reset / clear action over the user's unreadable book.
 */
import { themeForPref } from '@/shared/theme/theme';
import Button from '@mui/material/Button';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaultedBanner, Refused } from './FaultedBanner';

function wrap(ui: React.ReactElement, scheme: 'dark' | 'light' = 'dark') {
  return render(<ThemeProvider theme={themeForPref(scheme)}>{ui}</ThemeProvider>);
}

afterEach(() => cleanup());

describe('AC-63 · a refused control is never `disabled` and never fires', () => {
  it('the HTML `disabled` attribute is NEVER applied, and activation does nothing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    wrap(
      <Refused when>
        <Button onClick={onClick} data-testid="cta">
          Close
        </Button>
      </Refused>,
    );
    const cta = screen.getByTestId('cta');
    expect(cta).not.toHaveAttribute('disabled');
    expect(cta).not.toBeDisabled();
    expect(cta).toHaveAttribute('aria-disabled', 'true');

    await user.click(cta);
    await user.type(cta, '{Enter}');
    await user.type(cta, ' ');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('AC-62 · the banner never offers a destructive path', () => {
  it('offers NO repair / reset / clear path — the store never repairs and never deletes', () => {
    wrap(<FaultedBanner onReload={() => undefined} />);
    const banner = screen.getByTestId('faulted-banner');
    expect(
      within(banner).queryByRole('button', { name: /repair|reset|clear|delete|start over|fix/i }),
    ).toBeNull();
  });
});
