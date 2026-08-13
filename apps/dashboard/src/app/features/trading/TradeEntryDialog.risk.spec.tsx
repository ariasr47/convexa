/**
 * TradeEntryDialog — RISK-BASED suite (per the amended QA rule, `.claude/agents/qa-verify.md` §4,
 * 2026-07-13). Consolidates the former base + order-variant per-AC specs down to what can silently
 * regress without a reviewer noticing:
 *
 *   1. The CONFIRM-PAYLOAD contract per mode — the host seam. A wrong `entryMode`/price/basis in the
 *      emitted payload is invisible in the DOM but corrupts every downstream position/order.
 *   2. Blocking states — market with NO resolvable price and an invalid/blank good-til must DISABLE
 *      confirm (silently "filling" with nothing is the failure mode).
 *   3. `single-shared-sim-entry-dialog` byte-identity guard — WITHOUT `orderPlan` none of the
 *      order-variant DOM exists (the order variant is a VARIANT, never a fork).
 *   4. Pure good-til helpers (`defaultGoodTil` capping, `goodTilToExpiresAt` end-of-day).
 *
 * NOT asserted here (visible + intentional → review/QA): preview/notice/disclosure wording (the D8
 * strips, already-met/stale/scenario copy), chips, provenance lines, styling. The end-to-end proofs
 * that both pages mount THIS dialog live in `shared-entry.flow.spec.tsx`; the Act flow lives in
 * `orders/orders.risk.spec.tsx`. Mocks ONLY the network boundary (`fetch`).
 */
import { theme } from '@/shared/theme/theme';
import type { TrackedContract } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrderEntrySubmit,
  OrderPlan,
  TradeEntryDialog,
  TradeEntrySubmit,
  defaultGoodTil,
  goodTilToExpiresAt,
} from './TradeEntryDialog';

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

function installFetch(result: TrackedContract | null | 'notfound') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/contract/')) {
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

type DialogProps = Parameters<typeof TradeEntryDialog>[0];

function renderDialog(over: Partial<DialogProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <TradeEntryDialog
        open
        ticker="TSLA"
        expirations={['2026-07-17']}
        strikes={[250]}
        spot={250}
        restingLimit
        onClose={() => undefined}
        onConfirm={() => undefined}
        {...over}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// =================================================================================================
// 1. The confirm-payload contract per mode (the host seam)
// =================================================================================================

describe('TradeEntryDialog · confirm payload per mode', () => {
  it('manual emits the typed price — even with the chain down (404), entry still works', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch('notfound');
    renderDialog({ onConfirm });
    await user.type(screen.getByLabelText('Manual price'), '3');
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    // ONE payload shape for one leg and for six (SPEC §2.7): a single-leg entry is a ONE-ELEMENT
    // ARRAY, so there is never a single-leg path beside a multi-leg one.
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'manual', ticker: 'TSLA' }),
    );
    const submitted = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(submitted.legs).toHaveLength(1);
    expect(submitted.legs[0]).toMatchObject({ price: 3, qty: 1, side: 'long', multiplier: 100 });
  });

  it('market resolves the live mid (snapshot basis) or degrades to a LABELED theoretical mark', async () => {
    const user = userEvent.setup();
    // (a) quote available ⇒ snapshot mid.
    let onConfirm = vi.fn();
    installFetch(contract);
    renderDialog({ onConfirm });
    await user.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('snapshot mid');
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'market', resolvedBasis: 'snapshot', resolvedMark: 5 }),
    );
    cleanup();
    // (b) no quote ⇒ the fill basis degrades to `theoretical` — never silently passed off as live.
    onConfirm = vi.fn();
    installFetch({ ...contract, option_quote: null });
    renderDialog({ onConfirm });
    await user.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('theoretical');
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'market', resolvedBasis: 'theoretical' }),
    );
  });

  it('market with NO resolvable price disables confirm — it can never emit', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch({ ...contract, option_quote: null, iv: null });
    renderDialog({ onConfirm });
    await user.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText(/a market order can't fill/);
    expect(screen.getByRole('button', { name: 'Open simulated position' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('limit emits the same mode-tagged payload under BOTH hosts — the host decides the semantics', async () => {
    const user = userEvent.setup();
    // (a) resting host (Positions): the resting confirm label.
    let onConfirm = vi.fn();
    installFetch(contract);
    renderDialog({ onConfirm });
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await user.type(screen.getByLabelText('Limit price'), '4');
    await user.click(screen.getByRole('button', { name: 'Place limit order' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'limit', limitPrice: 4 }),
    );
    cleanup();
    // (b) immediate host (Ticker): NO resting affordance, same payload shape.
    onConfirm = vi.fn();
    installFetch(contract);
    renderDialog({ onConfirm, restingLimit: false });
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await user.type(screen.getByLabelText('Limit price'), '4');
    expect(screen.queryByRole('button', { name: 'Place limit order' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ entryMode: 'limit', limitPrice: 4 }),
    );
  });

  it('typed prices stay MODE-SCOPED — a manual price never leaks into the limit payload', async () => {
    const user = userEvent.setup();
    installFetch(contract);
    renderDialog();
    await user.type(screen.getByLabelText('Manual price'), '7.5');
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    expect((screen.getByLabelText('Limit price') as HTMLInputElement).value).toBe('');
    await user.type(screen.getByLabelText('Limit price'), '4');
    await user.click(screen.getByRole('button', { name: 'Manual price' }));
    expect((screen.getByLabelText('Manual price') as HTMLInputElement).value).toBe('7.5');
  });

  it('every prefill field lands in the confirm payload — EXCEPT qty (the AI-seeding seam)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch(contract);
    renderDialog({
      onConfirm,
      prefill: {
        expiration: '2026-07-17',
        strike: 250,
        right: 'put',
        stop: 6,
        target: 12.5,
      },
    });
    await user.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('snapshot mid');
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    const submit = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(submit).toMatchObject({ ticker: 'TSLA', stop: 6, target: 12.5 });
    expect(submit.legs).toHaveLength(1);
    expect(submit.legs[0]).toMatchObject({
      kind: 'option',
      ticker: 'TSLA',
      side: 'long',
      expiration: '2026-07-17',
      strike: 250,
      right: 'put',
      multiplier: 100,
    });
  });

  it('AC-79 (ship-blocking) — the quantity field opens at the dialog default of 1, in every case; there is no `qty` on `EntryPrefill` to seed it from', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    installFetch(contract);
    renderDialog({
      onConfirm,
      prefill: { expiration: '2026-07-17', strike: 250, right: 'put', stop: 6, target: 12.5 },
    });
    expect((screen.getByLabelText(/Quantity/) as HTMLInputElement).value).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('snapshot mid');
    await user.click(screen.getByRole('button', { name: 'Open simulated position' }));
    const submit = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(submit.legs[0]).toMatchObject({ qty: 1 });
  });

  it('AC-79/80/81 — the rec size text renders verbatim beside the field, never fed into the quantity input', async () => {
    installFetch(contract);
    renderDialog({
      prefill: {
        expiration: '2026-07-17',
        strike: 250,
        right: 'put',
        sizeText: '2 contracts',
      },
    });
    expect((screen.getByLabelText(/Quantity/) as HTMLInputElement).value).toBe('1');
    expect(screen.getByTestId('entry-ai-size-text')).toHaveTextContent('2 contracts');
  });

  it('AC-80 — a rec with no size at all shows `size not suggested`, distinct from `not set`', async () => {
    installFetch(contract);
    renderDialog({
      prefill: {
        expiration: '2026-07-17',
        strike: 250,
        right: 'put',
        sizeText: 'size not suggested',
      },
    });
    expect(screen.getByTestId('entry-ai-size-text')).toHaveTextContent('size not suggested');
    expect(screen.getByTestId('entry-ai-size-text')).not.toHaveTextContent(/\bnot set\b/);
  });
});

// =================================================================================================
// 2. The order variant — payload + blocking states + the byte-identity guard
// =================================================================================================

function plan(over: Partial<OrderPlan> = {}): OrderPlan {
  return {
    seededTrigger: { kind: 'underlying_above', level: 252 },
    triggerSourceText: 'Enter on a break above 252',
    provenance: {
      source: 'ai_rec',
      personaName: 'Default (no persona)',
      asOf: '2026-07-02T14:00:00Z',
    },
    stale: false,
    liveMid: null,
    ...over,
  };
}

function renderOrderVariant(orderPlan: OrderPlan, onConfirmOrder = vi.fn()) {
  renderDialog({
    expirations: ['2099-12-19'],
    strikes: [245, 250, 255],
    prefill: { expiration: '2099-12-19', strike: 250, right: 'call', stop: 3, target: 9 },
    orderPlan,
    onConfirmOrder,
  });
  return onConfirmOrder;
}

describe('TradeEntryDialog · order variant', () => {
  it('emits the full OrderEntrySubmit — seeded trigger, limit price, the defaulted good-til bound', async () => {
    const user = userEvent.setup();
    installFetch(contract);
    const onConfirmOrder = renderOrderVariant(plan());
    // Limit mode requires a price before confirm can emit.
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
    await user.type(screen.getByLabelText('Limit price'), '4');
    await user.click(screen.getByRole('button', { name: 'Place simulated order' }));
    expect(onConfirmOrder).toHaveBeenCalledTimes(1);
    const submit = onConfirmOrder.mock.calls[0][0] as OrderEntrySubmit;
    expect(submit).toMatchObject({
      ticker: 'TSLA',
      expiration: '2099-12-19',
      strike: 250,
      right: 'call',
      qty: 1,
      stop: 3,
      target: 9,
      trigger: { kind: 'underlying_above', level: 252 },
      limitPrice: 4,
    });
    expect(submit.expiresAt).toBe(goodTilToExpiresAt(defaultGoodTil('2099-12-19')));
  });

  it('empty seed: nothing guessed — confirming emits trigger:null (market-on-trigger arms now)', async () => {
    const user = userEvent.setup();
    installFetch(contract);
    const onConfirmOrder = renderOrderVariant(
      plan({ seededTrigger: null, triggerSourceText: 'Enter on strength through the wall' }),
    );
    expect(screen.getByLabelText('Trigger level')).toHaveValue(null);
    await user.click(screen.getByRole('button', { name: 'Place simulated order' }));
    const submit = onConfirmOrder.mock.calls[0][0] as OrderEntrySubmit;
    expect(submit.trigger).toBeNull();
    expect(submit.limitPrice).toBeNull();
  });

  it('good-til can never emit blank or past — confirm disables until a valid bound is set', async () => {
    installFetch(contract);
    const onConfirmOrder = renderOrderVariant(plan());
    const input = screen.getByLabelText('Good-til');
    expect(input).toHaveValue(defaultGoodTil('2099-12-19')); // never blank by default
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '2020-01-01' } });
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
    fireEvent.change(input, { target: { value: defaultGoodTil('2099-12-19') } });
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeEnabled();
    expect(onConfirmOrder).not.toHaveBeenCalled();
  });

  it('byte-identity guard: WITHOUT orderPlan no order-variant DOM exists — the shipped dialog only', async () => {
    installFetch(contract);
    renderDialog();
    const dlg = screen.getByTestId('trade-entry-dialog');
    expect(within(dlg).getByText('Open simulated position · TSLA')).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Manual price' })).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Market' })).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Limit' })).toBeInTheDocument();
    expect(within(dlg).queryByTestId('order-trigger-section')).toBeNull();
    expect(within(dlg).queryByTestId('order-good-til-section')).toBeNull();
    expect(within(dlg).queryByTestId('order-simulated-disclosure')).toBeNull();
    expect(within(dlg).queryByText('Simulated order — act on this rec')).toBeNull();
  });
});

// =================================================================================================
// 3. Pure good-til helpers
// =================================================================================================

describe('TradeEntryDialog · good-til helpers (pure)', () => {
  it('defaultGoodTil = min(now+7d, contract expiration)', () => {
    const now = new Date(2026, 6, 2);
    expect(defaultGoodTil('2026-07-04', now)).toBe('2026-07-04'); // capped at expiration
    expect(defaultGoodTil('2026-08-21', now)).toBe('2026-07-09'); // now + 7d
  });

  it('goodTilToExpiresAt lands at the end of the chosen day', () => {
    const d = new Date(goodTilToExpiresAt('2026-07-09'));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(23);
  });
});
