/**
 * Manual contract entry (production, no options feed). What is pinned here can store a wrong
 * position silently: a past or mistyped expiry, a zero or negative strike or price, a fractional
 * quantity, a malformed symbol, or a payload whose dollars don't follow from what was typed.
 */
import { netEntryCost, type SimPosition } from '@/features/trading/positions/leg';
import { maxLossOf } from '@/features/trading/positions/maxLoss';
import { structureKindOf } from '@/features/trading/positions/structure';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MANUAL_ENTRY_COPY as C,
  checkManualEntry,
  expirationError,
  newYorkDateIso,
  priceError,
  qtyError,
  strikeError,
  underlyingError,
  type ManualLegFields,
} from './manualContract';
import { TradeEntryDialog } from './TradeEntryDialogView';
import type { TradeEntrySubmit } from './types';

vi.mock('@/shared/hooks/useMarketDataMode', () => ({ useMarketDataMode: () => 'not_live' }));

const TODAY = '2026-10-15';
const call: ManualLegFields = {
  kind: 'option',
  expiration: '2026-11-20',
  strike: 200,
  right: 'call',
  qty: 1,
  price: 6.8,
};

// Options expire on New York's calendar. The browser's date would accept a contract that expired at
// today's close (Honolulu at 8 PM is already tomorrow in New York) or refuse one still listed.
describe('manual contract · today is New York’s date', () => {
  it('takes the New York calendar day, whatever the instant’s UTC day', () => {
    expect(newYorkDateIso(Date.parse('2026-10-16T02:30:00Z'))).toBe('2026-10-15'); // 10:30 PM EDT
    expect(newYorkDateIso(Date.parse('2026-10-15T04:00:00Z'))).toBe('2026-10-15'); // midnight EDT
    expect(newYorkDateIso(Date.parse('2026-10-15T03:59:00Z'))).toBe('2026-10-14'); // 11:59 PM EDT
    expect(newYorkDateIso(Date.parse('2026-11-02T04:30:00Z'))).toBe('2026-11-01'); // 11:30 PM EST
    expect(newYorkDateIso(Date.parse('2026-11-02T05:00:00Z'))).toBe('2026-11-02'); // midnight EST
  });

  it('refuses a contract that expired on New York’s yesterday, late in the Pacific evening', () => {
    // Oct 15, 9:30 PM in Honolulu = Oct 16, 3:30 AM in New York: Oct 15 contracts have expired.
    const today = newYorkDateIso(Date.parse('2026-10-16T07:30:00Z'));
    expect(expirationError('2026-10-15', today)).toBe(C.expirationPast);
    expect(expirationError('2026-10-16', today)).toBeNull();
  });
});

describe('manual contract · field checks', () => {
  it('takes a listed symbol in any case and refuses anything else', () => {
    expect(underlyingError(' nvda ')).toBeNull();
    expect(underlyingError('BRK.B')).toBeNull();
    expect(underlyingError('')).toBe(C.underlyingEmpty);
    expect(underlyingError('   ')).toBe(C.underlyingEmpty);
    for (const bad of ['SPY1', 'TOOLONG', 'BRK.', 'S P Y', '$SPY', 'BRK.BBB'])
      expect(underlyingError(bad)).toBe(C.underlyingShape);
  });

  it('takes today or a later real date, and refuses past, impossible and far-off dates', () => {
    expect(expirationError(TODAY, TODAY)).toBeNull();
    expect(expirationError('2026-11-20', TODAY)).toBeNull();
    expect(expirationError('2031-10-15', TODAY)).toBeNull(); // exactly five years out
    expect(expirationError('', TODAY)).toBe(C.expirationEmpty);
    expect(expirationError('2026-10-14', TODAY)).toBe(C.expirationPast);
    expect(expirationError('2026-02-30', TODAY)).toBe(C.expirationShape);
    expect(expirationError('11/20/2026', TODAY)).toBe(C.expirationShape);
    expect(expirationError('2031-10-16', TODAY)).toBe(C.expirationFar);
    expect(expirationError('2062-11-20', TODAY)).toBe(C.expirationFar);
  });

  it('takes only a positive, finite strike and price and a whole quantity of at least 1', () => {
    expect(strikeError(0.5)).toBeNull();
    expect(strikeError('')).toBe(C.strikeEmpty);
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(strikeError(bad)).toBe(C.strikeRange);
    expect(priceError(0.01)).toBeNull();
    expect(priceError(null)).toBe(C.priceEmpty);
    for (const bad of [0, -1, Number.NaN]) expect(priceError(bad)).toBe(C.priceRange);
    expect(qtyError(1)).toBeNull();
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(qtyError(bad)).toBe(C.qtyRange);
  });

  it('checks the whole entry: one stored symbol, each leg, shares without a contract', () => {
    expect(checkManualEntry({ underlying: 'nvda', legs: [call], today: TODAY })).toEqual({
      ok: true,
      ticker: 'NVDA',
    });
    const shares: ManualLegFields = {
      kind: 'equity',
      expiration: '',
      strike: '',
      right: '',
      qty: 100,
      price: 180,
    };
    expect(checkManualEntry({ underlying: 'NVDA', legs: [shares], today: TODAY }).ok).toBe(true);
    expect(checkManualEntry({ underlying: 'NVDA', legs: [], today: TODAY }).ok).toBe(false);
    expect(
      checkManualEntry({
        underlying: 'NVDA',
        legs: [call, { ...call, expiration: '2026-10-01', right: '', price: 0 }],
        today: TODAY,
      }),
    ).toEqual({
      ok: false,
      underlying: null,
      legs: [{}, { expiration: C.expirationPast, right: C.rightEmpty, price: C.priceRange }],
    });
  });
});

// ---- The dialog on a live build with no feed: what reaches the book ------------------------------

function renderDialog(onConfirm: (s: TradeEntrySubmit) => void) {
  // Exactly the Positions host's props when the site has no feed: no bundle, so no chain.
  return render(
    <ThemeProvider theme={theme}>
      <TradeEntryDialog
        open
        ticker="TSLA"
        expirations={[]}
        strikes={[]}
        spot={0}
        restingLimit
        multiLeg
        onClose={() => undefined}
        onConfirm={onConfirm}
      />
    </ThemeProvider>,
  );
}

const confirm = () =>
  screen.getByRole('button', { name: 'Open simulated position' }) as HTMLButtonElement;
const setDate = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('manual contract · the dialog with no chain', () => {
  const fetchSpy = vi.fn(async () => {
    throw new Error('no request may leave the manual entry');
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchSpy.mockClear();
  });

  it('opens exactly the typed contract, and its dollars follow from it', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    // The host's ticker never stands in for the underlying.
    expect(screen.queryByText(/TSLA/)).toBeNull();
    await user.type(screen.getByLabelText('Underlying'), 'nvda');
    setDate('Expiration', '2026-11-20');
    await user.type(screen.getByLabelText('Strike'), '200');
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
    await user.type(screen.getByLabelText('Manual price'), '6.80');
    expect(confirm()).toBeEnabled();
    await user.click(confirm());

    const submit = onConfirm.mock.calls[0][0] as TradeEntrySubmit;
    expect(submit.entryMode).toBe('manual');
    expect(submit.ticker).toBe('NVDA');
    expect(submit.legs).toEqual([
      {
        kind: 'option',
        ticker: 'NVDA',
        side: 'long',
        qty: 2,
        multiplier: 100,
        price: 6.8,
        expiration: '2026-11-20',
        strike: 200,
        right: 'call',
      },
    ]);
    // The book's own arithmetic on what was stored: 6.80 × 100 × 2 = $1,360 paid, all of it at risk.
    const position: SimPosition = {
      id: 'p',
      legs: submit.legs.map((l, i) => ({
        id: `l${i}`,
        kind: l.kind,
        ticker: l.ticker,
        side: l.side,
        qty: l.qty,
        multiplier: l.multiplier,
        entry_price: l.price as number,
        entry_basis: 'manual',
        expiration: l.expiration,
        strike: l.strike,
        right: l.right,
      })),
      opened_time: '',
      status: 'open',
      entry_mode: 'manual',
      schema_version: 3,
    };
    expect(netEntryCost(position)).toBeCloseTo(1360, 6);
    expect(maxLossOf(position, structureKindOf(position))).toEqual({
      kind: 'figure',
      dollars: 1360,
    });
    // No chain, no lookup: nothing left the dialog.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a past expiry, a bad symbol, a zero strike or a zero price, and says why', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    await user.type(screen.getByLabelText('Underlying'), 'nvda');
    setDate('Expiration', '2026-11-20');
    await user.type(screen.getByLabelText('Strike'), '200');
    await user.type(screen.getByLabelText('Manual price'), '6.80');
    expect(confirm()).toBeEnabled();

    setDate('Expiration', '2026-10-14');
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(C.expirationPast)).toBeInTheDocument();
    setDate('Expiration', '2026-11-20');

    await user.type(screen.getByLabelText('Underlying'), '1');
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(C.underlyingShape)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Underlying'), '{Backspace}');

    await user.clear(screen.getByLabelText('Strike'));
    await user.type(screen.getByLabelText('Strike'), '0');
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(C.strikeRange)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Strike'));
    await user.type(screen.getByLabelText('Strike'), '200');

    await user.clear(screen.getByLabelText('Manual price'));
    await user.type(screen.getByLabelText('Manual price'), '0');
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(C.priceRange)).toBeInTheDocument();

    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
