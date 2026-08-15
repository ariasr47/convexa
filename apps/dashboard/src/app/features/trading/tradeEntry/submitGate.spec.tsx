/**
 * submitGate.spec.tsx — rec-absence-literals-hole (PLAN F12, SPEC §7 Layer 4, AC-12f).
 *
 * The safety property the owner's ruling bought lives in ONE predicate
 * (`TradeEntryDialogView.tsx`'s `everyLegAddressed`), and a build lane could widen the types and
 * render an empty-looking control without ever touching it. This guard drives the REAL dialog and
 * asserts the CONFIRM CONTROL, never the predicate expression directly.
 */
import { biasToRight } from '@/pages/ticker/widgets/ai-rec/prefill';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradeEntryDialog } from './TradeEntryDialogView';
import type { EntryPrefill } from './types';

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/contract/')) return new Response('null', { status: 404 });
      throw new Error(`unexpected ${url}`);
    }),
  );
}

function renderDialog(prefill: EntryPrefill | undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <TradeEntryDialog
        open
        ticker="TSLA"
        expirations={['2026-07-17', '2026-07-18']}
        strikes={[250, 260]}
        spot={250}
        prefill={prefill}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />
    </ThemeProvider>,
  );
}

const confirmButton = () =>
  screen.getByRole('button', { name: 'Open simulated position' }) as HTMLButtonElement;

const fullyStated: EntryPrefill = {
  expiration: '2026-07-18',
  strike: 260,
  right: 'call',
};

beforeEach(() => {
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('rec-absence-literals-hole · Layer 4 — the submit gate itself, proven (AC-12f)', () => {
  // Arms 1-4 each type a manual price so the ONLY thing disabling confirm is the ONE unstated
  // contract field under test — isolating the conjunct rather than letting an untyped price mask it.
  it('arm 1 — an unstated strike disables the confirm control', async () => {
    const user = userEvent.setup();
    renderDialog({ ...fullyStated, strike: null });
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(confirmButton()).toBeDisabled();
  });

  it('arm 2 — an unstated expiration disables the confirm control', async () => {
    const user = userEvent.setup();
    renderDialog({ ...fullyStated, expiration: null });
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(confirmButton()).toBeDisabled();
  });

  it('arm 3 — an unstated direction disables the confirm control, and no Call/Put button is pressed', async () => {
    const user = userEvent.setup();
    renderDialog({ ...fullyStated, right: null });
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(confirmButton()).toBeDisabled();
    // The Call/Put toggle group — located via its own "Call" button, since it carries no aria-label
    // (unlike the fill-mode group, which does) and there is more than one `role="group"` on the page.
    const toggleGroup = screen.getByRole('button', { name: 'Call' }).closest('[role="group"]');
    expect(toggleGroup).not.toBeNull();
    expect(
      within(toggleGroup as HTMLElement).queryAllByRole('button', { pressed: true }),
    ).toHaveLength(0);
  });

  it('arm 4 — the bias-only case: structure never named, bias stated, still disables confirm', async () => {
    const user = userEvent.setup();
    // The one `biasToRight` path that produced a submittable direction after the owner's `:45` fix.
    expect(biasToRight({ structure: null, bias: 'short' })).toBeNull();
    renderDialog({ ...fullyStated, right: biasToRight({ structure: null, bias: 'short' }) });
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(confirmButton()).toBeDisabled();
  });

  it('arm 5 (non-vacuity) — a fully-stated prefill plus a typed manual price ENABLES the confirm control', async () => {
    const user = userEvent.setup();
    renderDialog(fullyStated);
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(confirmButton()).toBeEnabled();
  });

  it('arm 6 — typing clears the refusal: an unstated direction + filling it in enables confirm', async () => {
    const user = userEvent.setup();
    renderDialog({ ...fullyStated, right: null });
    // Price typed FIRST, isolating direction as the one remaining unstated field — confirm still
    // disabled here proves the guard, not merely the untyped price.
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(confirmButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Call' }));
    expect(confirmButton()).toBeEnabled();
  });
});
