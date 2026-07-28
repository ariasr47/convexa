/**
 * F15 — THE SIM MULTI-LEG VARIANT of the ONE shared entry dialog (SPEC §4 Flows 1, §2.7 *Entry input
 * shape*; AC-4..AC-13, AC-18, AC-22).
 *
 * Risk-based (SPEC §7). What is automated here is what regresses silently:
 *   · the payload contract — one code path for one leg and for six, prices PER LEG, `multiplier`
 *     stored at construction. Wrong here and every downstream position is wrong, invisibly.
 *   · the ALL-OR-NOTHING running net (AC-10). A partial net is not merely incomplete — it can be
 *     SIGN-INVERTED, so a credit reads as a debit.
 *   · negative space — no second dialog, no spread builder, no wizard, no leg cap, no field that
 *     accepts a negative quantity, no field that asks for a net.
 *   · construction-time refusals — a second underlying is rejected; a multi-leg entry can never
 *     become a resting limit (whose per-unit meaning is undefined for a structure).
 *
 * Copy wording is REVIEW-class and is not mirrored here beyond the debit/credit derivation, which is
 * a sign computation rather than a string choice.
 *
 * Mocks ONLY the network boundary (`fetch`).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { TrackedContract } from '@org/api';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradeEntryDialog, type TradeEntrySubmit } from './TradeEntryDialog';
import { DIALOG_NET_COMPUTED, DIALOG_NET_INCOMPLETE } from './positions/labels';

const contract: TrackedContract = {
  ticker: 'TSLA',
  expiration: '2026-07-17',
  strike: 400,
  right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
  greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45,
  dte: 25,
};

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/contract/'))
        return new Response(JSON.stringify(contract), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
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
        expirations={['2026-07-17', '2026-08-21']}
        strikes={[380, 400, 420, 440, 460]}
        spot={400}
        restingLimit
        multiLeg
        onClose={() => undefined}
        onConfirm={() => undefined}
        {...over}
      />
    </ThemeProvider>,
  );
}

const addLeg = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByTestId('entry-add-leg'));

/**
 * Set a numeric field by its ACCESSIBLE NAME. `fireEvent.change` rather than type-after-clear: the
 * qty field floors an empty value at 1, so clearing then typing would prepend that 1.
 */
function setNumber(name: string, value: string) {
  fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } });
}

/** Type a per-leg price into leg `i`'s own field. */
function priceLeg(index: number, value: string) {
  setNumber(`Price leg ${index + 1}`, value);
}

/** Pick a strike on leg `i`. */
async function setStrike(user: ReturnType<typeof userEvent.setup>, index: number, strike: number) {
  const label = index === 0 ? 'Strike' : `Strike leg ${index + 1}`;
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: `$${strike}` }));
}

const confirm = () => screen.getByRole('button', { name: 'Open simulated position' });

beforeEach(() => {
  vi.restoreAllMocks();
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// =================================================================================================
// The negative space: one dialog, no builder, no wizard, no cap, no net field, no negative qty
// =================================================================================================

describe('AC-8 / AC-11 / AC-13 — the shape of the surface', () => {
  it('AC-8 — multi-leg happens INSIDE this dialog: one dialog element, no builder, no step flow', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    await addLeg(user);

    // Still exactly ONE entry dialog in the tree.
    expect(screen.getAllByTestId('trade-entry-dialog')).toHaveLength(1);
    expect(screen.getAllByTestId(/^entry-leg-\d+$/)).toHaveLength(3);
    // …and no wizard chrome anywhere: no Next/Back/Step.
    expect(screen.queryByRole('button', { name: /^(next|back|continue|step)/i })).toBeNull();
  });

  it('AC-9 — the trader prices PER LEG and NO field anywhere asks for a net', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    expect(screen.getByRole('spinbutton', { name: 'Price leg 1' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Price leg 2' })).toBeInTheDocument();
    // Negative space: nothing anywhere invites a NET to be typed.
    const fields = [...screen.queryAllByRole('textbox'), ...screen.queryAllByRole('spinbutton')];
    expect(fields.length).toBeGreaterThan(0);
    for (const el of fields) {
      expect((el.getAttribute('aria-label') ?? '').toLowerCase()).not.toMatch(/\bnet\b/);
    }
  });

  it('AC-11 — direction is a Buy/Sell control and NO field accepts a negative quantity', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    expect(
      within(screen.getByTestId('entry-side-0')).getByRole('button', { name: 'Buy' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('entry-side-1')).getByRole('button', { name: 'Sell' }),
    ).toBeInTheDocument();
    // Every numeric SIZE field floors at 1 — a sign convention here would give direction two homes.
    for (const name of ['Quantity', 'Quantity leg 2']) {
      expect(screen.getByRole('spinbutton', { name })).toHaveAttribute('min', '1');
    }
    // …and a negative is CLAMPED rather than accepted.
    setNumber('Quantity', '-3');
    expect((screen.getByRole('spinbutton', { name: 'Quantity' }) as HTMLInputElement).value).toBe(
      '1',
    );
  });

  it('AC-13 — a SIX-leg position is accepted with no cap enforced and no cap messaged', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    for (let i = 0; i < 5; i++) await addLeg(user);
    expect(screen.getAllByTestId(/^entry-leg-\d+$/)).toHaveLength(6);
    // No cap copy of any kind.
    expect(screen.queryByText(/maximum|at most|up to \d+ legs|limit of \d+/i)).toBeNull();

    for (let i = 0; i < 6; i++) priceLeg(i, '1');
    expect(confirm()).toBeEnabled();
    await user.click(confirm());
    expect((onConfirm.mock.calls[0][0] as TradeEntrySubmit).legs).toHaveLength(6);
  });

  it('the confirm action`s name is unchanged in every case — one leg or six', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(confirm()).toBeInTheDocument();
    await addLeg(user);
    await addLeg(user);
    expect(confirm()).toBeInTheDocument();
  });
});

// =================================================================================================
// The running net — ALL-OR-NOTHING, computed, and signed by arithmetic
// =================================================================================================

describe('AC-10 / AC-22 — the running net', () => {
  it('AC-10 — until EVERY leg has a price the net reads INCOMPLETE, never a partial sum', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    priceLeg(0, '12.40');

    const net = screen.getByTestId('entry-net');
    expect(net).toHaveTextContent(DIALOG_NET_INCOMPLETE);
    // The partial sum ($1240) must not appear ANYWHERE — not as a number, not "so far".
    expect(net.textContent).not.toMatch(/1240/);
    expect(confirm()).toBeDisabled();

    priceLeg(1, '6.10');
    expect(screen.getByTestId('entry-net')).toHaveTextContent('Net debit $630');
  });

  it('AC-9 — the net is LABELLED as computed from the leg prices', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    priceLeg(0, '12.40');
    priceLeg(1, '6.10');
    expect(screen.getByTestId('entry-net')).toHaveTextContent(DIALOG_NET_COMPUTED);
  });

  it('AC-22 — debit vs credit is derived FROM THE SIGN, never from the structure name', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    // Leg 1 long $400 @ 6.10, leg 2 short $420 @ 12.40 ⇒ a NET CREDIT on the same shape that,
    // with the prices swapped, is a net debit. A vertical can be either.
    await setStrike(user, 1, 420);
    priceLeg(0, '6.10');
    priceLeg(1, '12.40');
    expect(screen.getByTestId('entry-net')).toHaveTextContent('Net credit $630');
    // The figure is UNSIGNED — the qualifier word carries direction, and never both.
    expect(screen.getByTestId('entry-net').textContent).not.toMatch(/[+−-]\s*\$630/);

    priceLeg(0, '12.40');
    priceLeg(1, '6.10');
    expect(screen.getByTestId('entry-net')).toHaveTextContent('Net debit $630');
  });

  it('the word `Cost` is retired from every net-bearing surface in this dialog', async () => {
    const user = userEvent.setup();
    renderDialog();
    await addLeg(user);
    priceLeg(0, '12.40');
    priceLeg(1, '6.10');
    expect(screen.getByTestId('trade-entry-dialog').textContent).not.toMatch(/\bCost\b/);
  });
});

// =================================================================================================
// What gets SAVED — one code path, prices per leg, multiplier stored
// =================================================================================================

describe('AC-4 / AC-5 / AC-6 — shapes the app must simply hold', () => {
  it('AC-4 — a NAKED SHORT is accepted and saved: one option leg, sold to open, no offsetting leg', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    await user.click(
      within(screen.getByTestId('entry-side-0')).getByRole('button', { name: 'Sell' }),
    );
    setNumber('Manual price', '6.10');
    await user.click(confirm());

    const submit = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(submit.legs).toHaveLength(1);
    expect(submit.legs[0]).toMatchObject({ side: 'short', kind: 'option', multiplier: 100 });
    // `qty` stays UNSIGNED — direction is carried by `side` and nowhere else.
    expect(submit.legs[0].qty).toBeGreaterThan(0);
  });

  it('AC-5 — legs with DIFFERENT expirations are accepted and saved', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    await addLeg(user);
    await user.click(screen.getByRole('combobox', { name: 'Expiration leg 2' }));
    await user.click(await screen.findByRole('option', { name: '2026-08-21' }));
    priceLeg(0, '12.40');
    priceLeg(1, '6.10');
    await user.click(confirm());

    const submit = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(new Set(submit.legs.map((l) => l.expiration)).size).toBe(2);
  });

  it('AC-6 — an UNNAMED leg set confirms with no error, no warning styling, no icon, no toast', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    // 1 long + 2 short at the same strike = a 1x2 ratio: `custom` in v1.
    await addLeg(user);
    setNumber('Quantity leg 2', '2');
    priceLeg(0, '12.40');
    priceLeg(1, '6.10');

    expect(screen.getByTestId('entry-structure-name')).toHaveTextContent('Custom');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(confirm()).toBeEnabled();
    await user.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('AC-18 — changing a leg so the SHAPE changes updates the displayed name immediately', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByTestId('entry-structure-name')).toHaveTextContent('Long call');
    await addLeg(user);
    await setStrike(user, 1, 420);
    // Leg 2 is seeded SHORT, so a long $400 / short $420 call pair is a call debit spread.
    expect(screen.getByTestId('entry-structure-name')).toHaveTextContent('Call debit spread');
    // Move ONE expiration and the same strikes become a diagonal — no reload, no refetch.
    await user.click(screen.getByRole('combobox', { name: 'Expiration leg 2' }));
    await user.click(await screen.findByRole('option', { name: '2026-08-21' }));
    expect(screen.getByTestId('entry-structure-name')).toHaveTextContent('Diagonal');
  });

  it('AC-2 / AC-3 — an equity leg carries multiplier 1 and NO option facts at all', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    await user.click(
      within(screen.getByTestId('entry-kind-0')).getByRole('button', { name: 'Shares' }),
    );
    setNumber('Quantity', '100');
    priceLeg(0, '250');
    await user.click(confirm());

    const submit = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(submit.legs[0]).toMatchObject({
      kind: 'equity',
      multiplier: 1,
      qty: 100,
      // NEVER a zero-filled strike/expiry: the facts do not apply to this instrument.
      strike: null,
      right: null,
      expiration: null,
    });
  });
});

// =================================================================================================
// The boundaries this variant refuses to cross — visibly
// =================================================================================================

describe('the refusals, stated rather than silent', () => {
  it('Market and Limit are single-leg option modes, refused VISIBLY once a second leg exists', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Single option leg: all three modes live, and the shipped mode-scoped price field is present.
    expect(screen.getByRole('spinbutton', { name: 'Manual price' })).toBeInTheDocument();
    expect(screen.queryByTestId('entry-fill-mode-note')).toBeNull();

    await addLeg(user);
    expect(screen.getByTestId('entry-fill-mode-note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limit' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Market' })).toHaveAttribute('aria-disabled', 'true');
    // The refusal is REACHABLE, not swallowed: the control keeps its place in the tree and its
    // reason, rather than vanishing (a mode that quietly stops existing teaches nothing).
    expect(screen.getByRole('button', { name: 'Limit' })).toBeInTheDocument();
  });

  it('a multi-leg entry can never become a RESTING LIMIT — the emitted mode is always manual', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    // Choose Limit FIRST, then add a leg — the mode must not survive the transition silently.
    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await addLeg(user);
    priceLeg(0, '12.40');
    priceLeg(1, '6.10');
    await user.click(confirm());
    expect((onConfirm.mock.calls[0][0] as TradeEntrySubmit).entryMode).toBe('manual');
  });

  it('WITHOUT `multiLeg` the dialog is byte-identical to shipped — no leg controls exist at all', () => {
    renderDialog({ multiLeg: false });
    expect(screen.queryByTestId('entry-add-leg')).toBeNull();
    expect(screen.queryByTestId('entry-side-0')).toBeNull();
    expect(screen.queryByTestId('entry-kind-0')).toBeNull();
    expect(screen.queryByTestId('entry-structure-name')).toBeNull();
    // The shipped single-contract fields are exactly where they were.
    expect(screen.getByRole('combobox', { name: 'Expiration' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Strike' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Manual price' })).toBeInTheDocument();
  });
});
