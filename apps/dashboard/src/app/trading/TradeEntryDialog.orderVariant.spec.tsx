/**
 * Component — the additive ORDER VARIANT of the ONE shared sim-entry dialog (UX §3 / FRONTEND
 * contract §7 "Order-variant dialog spec"). Covers each dialog state from the §3.2 table
 * (default-seeded · empty-seed · already-met (live re-eval) · stale-rec · scenario-sourced ·
 * validating) plus the byte-identity guard: WITHOUT `orderPlan` none of the order-variant DOM
 * exists (the existing TradeEntryDialog specs stay green, untouched).
 */
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import {
  TradeEntryDialog, OrderPlan, OrderEntrySubmit, defaultGoodTil, goodTilToExpiresAt,
} from './TradeEntryDialog';

const QUOTE = {
  ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45, dte: 24,
};

function installFetch() {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify(QUOTE), { status: 200, headers: { 'Content-Type': 'application/json' } })));
}

function plan(over: Partial<OrderPlan> = {}): OrderPlan {
  return {
    seededTrigger: { kind: 'underlying_above', level: 252 },
    triggerSourceText: 'Enter on a break above 252',
    provenance: { source: 'ai_rec', personaName: 'Default (no persona)', asOf: '2026-07-02T14:00:00Z' },
    stale: false,
    liveMid: null,
    ...over,
  };
}

function mount(orderPlan: OrderPlan | undefined, onConfirmOrder = vi.fn(), orderError: string | null = null) {
  render(
    <ThemeProvider theme={theme}>
      <TradeEntryDialog
        open ticker="TSLA" expirations={['2099-12-19']} strikes={[245, 250, 255]} spot={250}
        prefill={{ expiration: '2099-12-19', strike: 250, right: 'call', qty: 2, stop: 3, target: 9 }}
        orderPlan={orderPlan} onConfirmOrder={onConfirmOrder} orderError={orderError}
        onClose={vi.fn()} onConfirm={vi.fn()}
      />
    </ThemeProvider>,
  );
  return onConfirmOrder;
}

beforeEach(() => { vi.restoreAllMocks(); installFetch(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('order variant — seeded / empty-seed states (§3.2)', () => {
  it('default-seeded: trigger pre-seeded + "Derived from the rec" chip + verbatim words shown', () => {
    mount(plan());
    const dlg = screen.getByTestId('trade-entry-dialog');
    expect(within(dlg).getByText('Simulated order — act on this rec')).toBeInTheDocument();
    expect(within(dlg).getByLabelText('Trigger level')).toHaveValue(252);
    expect(within(dlg).getByTestId('order-seed-chip')).toBeInTheDocument();
    expect(within(dlg).getByTestId('order-verbatim-words')).toHaveTextContent('Enter on a break above 252');
    // Entry price defaults to Market on trigger (nothing to seed — honest default).
    expect(within(dlg).getByRole('button', { name: 'Market on trigger', pressed: true })).toBeInTheDocument();
  });

  it('empty-seed: fields start empty, the no-seed helper shows, verbatim text still shown', () => {
    mount(plan({ seededTrigger: null, triggerSourceText: 'Enter on strength through the wall' }));
    const dlg = screen.getByTestId('trade-entry-dialog');
    expect(within(dlg).getByLabelText('Trigger level')).toHaveValue(null);
    expect(within(dlg).getByTestId('order-no-seed-helper')).toBeInTheDocument();
    expect(within(dlg).queryByTestId('order-seed-chip')).toBeNull();
    expect(within(dlg).getByTestId('order-verbatim-words')).toHaveTextContent('Enter on strength through the wall');
  });

  it('a rec with NO entry trigger renders the honest placeholder in the words block', () => {
    mount(plan({ seededTrigger: null, triggerSourceText: null }));
    expect(screen.getByTestId('order-verbatim-words')).toHaveTextContent('— (the rec stated no entry trigger)');
  });
});

describe('order variant — notice strips (§3.2)', () => {
  it('already-met (D8-2): appears/disappears LIVE as the user edits the trigger vs the live mid', async () => {
    const user = userEvent.setup();
    mount(plan({ liveMid: 253 })); // seeded above 252, live mid 253 ⇒ already met
    expect(screen.getByTestId('order-already-met')).toHaveTextContent(
      'Condition already met — TSLA is already above 252 on live data. This order will trigger on the first live update after you place it.',
    );
    // Editing the level above the mid clears the notice.
    const level = screen.getByLabelText('Trigger level');
    await user.clear(level);
    await user.type(level, '260');
    expect(screen.queryByTestId('order-already-met')).toBeNull();
    // Confirm stays ENABLED with the notice showing (AC-9 — never blocks).
    await user.clear(level);
    await user.type(level, '252');
    expect(screen.getByTestId('order-already-met')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeEnabled();
  });

  it('no live mid ⇒ no already-met notice (only shown when a live mid exists)', () => {
    mount(plan({ liveMid: null }));
    expect(screen.queryByTestId('order-already-met')).toBeNull();
  });

  it('stale-rec (D8-5): the strip shows and proceeding stays allowed (AC-10)', () => {
    mount(plan({ stale: true }));
    expect(screen.getByTestId('order-stale-strip')).toHaveTextContent(
      'Newer data has arrived since this read was pinned (as of 2026-07-02T14:00:00Z). The plan below reflects that older snapshot; the trigger still evaluates against live data only.',
    );
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeEnabled();
  });

  it('scenario-sourced (D8-4): the dialog strip + the scenario provenance line', () => {
    mount(plan({
      provenance: { source: 'ai_scenario', personaName: 'Default (no persona)', asOf: null, scenarioName: 'Break above call wall' },
    }));
    expect(screen.getByTestId('order-scenario-strip')).toHaveTextContent(
      'Scripted scenario — this plan came from the "Break above call wall" scenario, not a real AI read.',
    );
    expect(screen.getByTestId('order-provenance-line')).toHaveTextContent('From scripted scenario · Break above call wall');
  });

  it('real-read provenance line: "From AI read · {persona} · as of {as_of}"', () => {
    mount(plan());
    expect(screen.getByTestId('order-provenance-line')).toHaveTextContent(
      'From AI read · Default (no persona) · as of 2026-07-02T14:00:00Z',
    );
  });
});

describe('order variant — good-til (D3/AC-8) + validation state (§3.2)', () => {
  it('defaults to now+7d capped at the contract expiration; helper text present', () => {
    mount(plan());
    const input = screen.getByLabelText('Good-til');
    expect(input).toHaveValue(defaultGoodTil('2099-12-19')); // 7d out (far expiration ⇒ uncapped)
    expect(screen.getByText(/Every order needs a bound\. Defaults to 7 days/)).toBeInTheDocument();
  });

  it('defaultGoodTil caps at a near expiration', () => {
    const now = new Date(2026, 6, 2);
    expect(defaultGoodTil('2026-07-04', now)).toBe('2026-07-04'); // capped
    expect(defaultGoodTil('2026-08-21', now)).toBe('2026-07-09'); // now + 7d
  });

  it('goodTilToExpiresAt lands at the end of the chosen day', () => {
    const iso = goodTilToExpiresAt('2026-07-09');
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(23);
  });

  it('validating: a cleared good-til blocks confirm with the verbatim validation message', () => {
    mount(plan());
    const input = screen.getByLabelText('Good-til');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText("Set a good-til date after now and no later than the contract's expiration.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
  });

  it('validating: a past good-til date blocks confirm', () => {
    mount(plan());
    const input = screen.getByLabelText('Good-til');
    fireEvent.change(input, { target: { value: '2020-01-01' } });
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
  });
});

describe('order variant — confirm payload + D8-1 + inline store fault', () => {
  it('emits the OrderEntrySubmit with trigger/limit/good-til; limit mode requires a price', async () => {
    const user = userEvent.setup();
    const onConfirmOrder = mount(plan());
    // Switch to Limit — confirm disables until a price is typed.
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    expect(screen.getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
    await user.type(screen.getByLabelText('Limit price'), '4');
    await user.click(screen.getByRole('button', { name: 'Place simulated order' }));
    expect(onConfirmOrder).toHaveBeenCalledTimes(1);
    const submit = onConfirmOrder.mock.calls[0][0] as OrderEntrySubmit;
    expect(submit).toMatchObject({
      ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call', qty: 2,
      stop: 3, target: 9,
      trigger: { kind: 'underlying_above', level: 252 },
      limitPrice: 4,
    });
    expect(submit.expiresAt).toBe(goodTilToExpiresAt(defaultGoodTil('2099-12-19')));
  });

  it('the D8-1 SIMULATED disclosure renders verbatim above the confirm', () => {
    mount(plan());
    expect(screen.getByTestId('order-simulated-disclosure')).toHaveTextContent(
      'Simulated only — no real order is ever placed. Once confirmed, this order can trigger and fill unattended whenever a live stream for TSLA is open in this browser. Orders are stored in this browser — not synced to your account.',
    );
  });

  it('an orderError (faulted store) surfaces inline with the §4.6 title — nothing partial', () => {
    mount(plan(), vi.fn(), 'Orders unavailable');
    expect(screen.getByTestId('order-inline-error')).toHaveTextContent('Orders unavailable');
  });
});

describe('byte-identity without the seam (AC-47/48 guard)', () => {
  it('WITHOUT orderPlan: no order-variant DOM exists and the shipped 3-mode control renders', () => {
    render(
      <ThemeProvider theme={theme}>
        <TradeEntryDialog
          open ticker="TSLA" expirations={['2099-12-19']} strikes={[250]} spot={250}
          onClose={vi.fn()} onConfirm={vi.fn()}
        />
      </ThemeProvider>,
    );
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
