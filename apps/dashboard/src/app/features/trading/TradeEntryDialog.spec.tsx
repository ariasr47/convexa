/**
 * Component — the SHARED 3-mode sim-entry dialog (sim-entry-unification). Mocks ONLY the network
 * boundary (`fetch` via the @org/api client) and asserts the observable fill preview + confirm
 * payload per mode. MIGRATED from `positions/PositionEntryDialog.spec.tsx` (AC-12..AC-17 — every case
 * kept, none dropped) + the ticker-posture cases the redesigned ghost-trade dialog carried
 * (immediate-limit semantics, SIMULATED chip, AI prefill seeding).
 */
import type { TrackedContract } from '@org/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradeEntryDialog, TradeEntrySubmit } from './TradeEntryDialog';

const contract: TrackedContract = {
  ticker: 'TSLA',
  expiration: '2026-07-17',
  strike: 250,
  right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
  greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45,
  dte: 25,
};

function installFetch(result: TrackedContract | null | 'notfound' | 'throw') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/contract/')) {
        if (result === 'throw') throw new Error('network');
        if (result === 'notfound') return new Response('null', { status: 404 });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
}

function renderDialog(
  onConfirm: (s: TradeEntrySubmit) => void,
  {
    restingLimit = true,
    prefill,
  }: { restingLimit?: boolean; prefill?: Parameters<typeof TradeEntryDialog>[0]['prefill'] } = {},
) {
  return render(
    <TradeEntryDialog
      open
      ticker="TSLA"
      expirations={['2026-07-17']}
      strikes={[250]}
      spot={250}
      restingLimit={restingLimit}
      prefill={prefill}
      onClose={() => undefined}
      onConfirm={onConfirm}
    />,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe('Manual mode (AC-12, AC-13)', () => {
  it('opens at the typed price with a user-entered basis', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch(contract);
    renderDialog(onConfirm);
    // Manual is the default mode.
    await user.type(screen.getByLabelText('Manual price'), '7.5');
    expect(await screen.findByText(/Opens at your price \$7\.50/)).toBeInTheDocument();
    expect(screen.getByText('user-entered price')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'manual', price: 7.5, ticker: 'TSLA' }),
    );
  });

  it('succeeds even when the chain is unavailable (404) — caption + entry still works', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch('notfound');
    renderDialog(onConfirm);
    await user.type(screen.getByLabelText('Manual price'), '3');
    expect(
      await screen.findByText(/Contract stats unavailable — your entry still works\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'manual', price: 3 }),
    );
  });
});

describe('Market mode (AC-14, AC-15, AC-16)', () => {
  it('fills at the live option mid with a snapshot-mid basis', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch(contract);
    renderDialog(onConfirm);
    await user.click(screen.getByRole('button', { name: 'Market' }));
    expect(await screen.findByText(/Fill: mid \$5\.00/)).toBeInTheDocument();
    expect(screen.getByText('snapshot mid')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'market', resolvedBasis: 'snapshot', resolvedMark: 5 }),
    );
  });

  it('falls back to a labeled theoretical mark when there is no quote', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch({ ...contract, option_quote: null });
    renderDialog(onConfirm);
    await user.click(screen.getByRole('button', { name: 'Market' }));
    expect(
      await screen.findByText(/No live quote — fill will use a theoretical/),
    ).toBeInTheDocument();
    expect(screen.getByText('theoretical')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'market', resolvedBasis: 'theoretical' }),
    );
  });

  it('disables confirm with the "can\'t fill" copy when no price is resolvable', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch({ ...contract, option_quote: null, iv: null });
    renderDialog(onConfirm);
    await user.click(screen.getByRole('button', { name: 'Market' }));
    expect(await screen.findByText(/a market order can't fill/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open simulated position' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('Limit mode — resting host (Positions, AC-17)', () => {
  it('rests as a limit order with the Place limit order label + the resting preview', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch(contract);
    renderDialog(onConfirm);
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await user.type(screen.getByLabelText('Limit price'), '4');
    expect(
      await screen.findByText(/Rests until the live mark reaches \$4\.00, then fills at \$4\.00/),
    ).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Place limit order' });
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'limit', limitPrice: 4 }),
    );
  });

  it('hints when the live mark is already at or below the limit (still rests)', async () => {
    const user = userEvent.setup();
    installFetch(contract); // mid = 5
    renderDialog(vi.fn());
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await user.type(screen.getByLabelText('Limit price'), '6'); // 5 <= 6 ⇒ already crossable
    await waitFor(() =>
      expect(screen.getByText(/already at or below your limit/)).toBeInTheDocument(),
    );
  });
});

describe('Limit mode — immediate host (Ticker, no resting lifecycle)', () => {
  it('opens immediately at your limit price with the ghost-trade preview + confirm label', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch(contract);
    renderDialog(onConfirm, { restingLimit: false });
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await user.type(screen.getByLabelText('Limit price'), '4');
    // The shipped ghost-trade limit semantics: an immediate open at your price, not a resting order.
    expect(
      await screen.findByText(/Fills at your limit \$4\.00 · Cost \$400 \(price × 100 × qty\)/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Place limit order' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    // Same mode-tagged payload either way — the HOST decides what a limit means.
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'limit', limitPrice: 4 }),
    );
  });
});

describe('shared skin + prefill seam', () => {
  it('mounts the canonical dialog (trade-entry-dialog testid, SIMULATED chip, mandatory confirm)', async () => {
    installFetch(contract);
    renderDialog(vi.fn());
    const dlg = await screen.findByTestId('trade-entry-dialog');
    expect(within(dlg).getByText('SIMULATED')).toBeInTheDocument();
    expect(within(dlg).getByText(/Open simulated position · TSLA/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Paper trade — no broker, no real money/)).toBeInTheDocument();
    // Nothing is emitted without an explicit confirm; the default (manual, no price) can't confirm.
    expect(within(dlg).getByRole('button', { name: 'Open simulated position' })).toBeDisabled();
  });

  it('seeds every EntryPrefill field editable + renders provenance and sizing copy', async () => {
    installFetch(contract);
    renderDialog(vi.fn(), {
      prefill: {
        expiration: '2026-07-17',
        strike: 250,
        right: 'put',
        qty: 2,
        stop: 6,
        target: 12.5,
        provenance: 'Pre-filled from AI read · Default (no persona)',
        sizingNote: 'Suggested size from the AI read — adjust freely.',
      },
    });
    const dlg = await screen.findByTestId('trade-entry-dialog');
    expect(
      within(dlg).getByText('Pre-filled from AI read · Default (no persona)'),
    ).toBeInTheDocument();
    expect(within(dlg).getByText(/Suggested size from the AI read/)).toBeInTheDocument();
    expect((within(dlg).getByLabelText('Quantity') as HTMLInputElement).value).toBe('2');
    expect((within(dlg).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('6');
    expect((within(dlg).getByLabelText('Target (optional)') as HTMLInputElement).value).toBe(
      '12.5',
    );
  });

  it('keeps the Manual and Limit typed prices mode-scoped (absorbed capability)', async () => {
    const user = userEvent.setup();
    installFetch(contract);
    renderDialog(vi.fn());
    await user.type(screen.getByLabelText('Manual price'), '7.5');
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    expect((screen.getByLabelText('Limit price') as HTMLInputElement).value).toBe(''); // not carried over
    await user.type(screen.getByLabelText('Limit price'), '4');
    await user.click(screen.getByRole('button', { name: 'Manual price' }));
    expect((screen.getByLabelText('Manual price') as HTMLInputElement).value).toBe('7.5'); // remembered
  });
});
