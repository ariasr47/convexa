/**
 * Manual contract entry: the trade entry's form when the site has no options chain (production with
 * the feed off, Final Overlays DLG-01). There is no expiry or strike list to pick from, so the
 * trader types the underlying and each contract, and this module decides whether what they typed
 * can be recorded.
 *
 * It checks the SHAPE of a contract, never that it is listed: with no chain there is nothing to
 * check a listing against, and the dialog says so. A position opened here is simulated and stored in
 * this browser; nothing is sent anywhere.
 *
 * Pure on purpose: the dialog renders these messages and the spec pins them, so a typo that would
 * store a wrong position (a past expiry, a zero strike, a negative price) fails a test, not a book.
 */
import type { InstrumentKind } from '@/features/trading/positions/leg';
import type { OptionRight } from '@convexa/api';

/** How far out an expiration can be before it reads as a mistyped year. Listed equity options
 *  (LEAPS included) run under three years; five leaves room without accepting 2062 for 2026. */
export const MAX_EXPIRY_YEARS = 5;

/** A listed US symbol: 1-5 letters, with an optional share class after a dot (BRK.B, BF.B). */
const SYMBOL = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MANUAL_ENTRY_COPY = {
  lead: 'No options chain on this site, so type the contract. Nothing checks that it is listed; it opens at the price you type.',
  underlyingEmpty: 'Enter the underlying’s symbol, like SPY.',
  underlyingShape: 'Use the listed symbol: 1 to 5 letters, with a class after a dot (BRK.B).',
  expirationEmpty: 'Enter the contract’s expiration.',
  expirationShape: 'That isn’t a date. Use the calendar or YYYY-MM-DD.',
  expirationPast: 'That expiration has passed. Pick today or later.',
  expirationFar: `That’s more than ${MAX_EXPIRY_YEARS} years out. Check the year.`,
  strikeEmpty: 'Enter the strike.',
  strikeRange: 'The strike must be above zero.',
  rightEmpty: 'Pick Call or Put.',
  qtyRange: 'Quantity is a whole number, 1 or more.',
  priceEmpty: 'Enter your price per share, like 6.80.',
  priceRange: 'The price must be above zero.',
} as const;

/** One leg as the dialog holds it. `price` is the per-unit price this leg would open at. */
export interface ManualLegFields {
  kind: InstrumentKind;
  expiration: string;
  strike: number | '';
  right: OptionRight | '';
  qty: number;
  price: number | null;
}

export type ManualLegErrors = Partial<
  Record<'expiration' | 'strike' | 'right' | 'qty' | 'price', string>
>;

export type ManualEntryCheck =
  { ok: true; ticker: string } | { ok: false; underlying: string | null; legs: ManualLegErrors[] };

/** The symbol as it would be stored: trimmed and upper-cased. */
export function normalizeUnderlying(raw: string): string {
  return raw.trim().toUpperCase();
}

export function underlyingError(raw: string): string | null {
  const s = normalizeUnderlying(raw);
  if (!s) return MANUAL_ENTRY_COPY.underlyingEmpty;
  return SYMBOL.test(s) ? null : MANUAL_ENTRY_COPY.underlyingShape;
}

/** A real calendar date in YYYY-MM-DD, or null (2026-02-30 is not one). */
function calendarDate(s: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(s);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

/**
 * Today's date in New York, YYYY-MM-DD: the calendar US equity options expire on. The browser's own
 * date is wrong at the edges: at 8 PM in Honolulu it is already tomorrow in New York, so an option
 * that expired at today's close would still be accepted, and in Tokyo the morning after an
 * expiration the browser is a day ahead and refuses a contract that is still listed.
 */
export function newYorkDateIso(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * `today` is New York's date (`newYorkDateIso`), never the browser's. An expiration of today is
 * accepted: a same-day contract is live until the close.
 */
export function expirationError(expiration: string, today: string): string | null {
  if (!expiration) return MANUAL_ENTRY_COPY.expirationEmpty;
  const date = calendarDate(expiration);
  if (!date) return MANUAL_ENTRY_COPY.expirationShape;
  if (expiration < today) return MANUAL_ENTRY_COPY.expirationPast;
  const now = calendarDate(today);
  if (now) {
    const limit = `${String(now.y + MAX_EXPIRY_YEARS).padStart(4, '0')}-${today.slice(5)}`;
    if (expiration > limit) return MANUAL_ENTRY_COPY.expirationFar;
  }
  return null;
}

const positive = (v: number | '' | null): boolean =>
  v !== '' && v != null && Number.isFinite(v) && v > 0;

export function strikeError(strike: number | ''): string | null {
  if (strike === '') return MANUAL_ENTRY_COPY.strikeEmpty;
  return positive(strike) ? null : MANUAL_ENTRY_COPY.strikeRange;
}

export function qtyError(qty: number): string | null {
  return Number.isInteger(qty) && qty >= 1 ? null : MANUAL_ENTRY_COPY.qtyRange;
}

export function priceError(price: number | null): string | null {
  if (price == null) return MANUAL_ENTRY_COPY.priceEmpty;
  return positive(price) ? null : MANUAL_ENTRY_COPY.priceRange;
}

/** Every problem with one leg. A share leg names no contract, so only quantity and price apply. */
export function manualLegErrors(leg: ManualLegFields, today: string): ManualLegErrors {
  const errors: ManualLegErrors = {};
  const put = (key: keyof ManualLegErrors, message: string | null) => {
    if (message) errors[key] = message;
  };
  if (leg.kind === 'option') {
    put('expiration', expirationError(leg.expiration, today));
    put('strike', strikeError(leg.strike));
    put('right', leg.right ? null : MANUAL_ENTRY_COPY.rightEmpty);
  }
  put('qty', qtyError(leg.qty));
  put('price', priceError(leg.price));
  return errors;
}

/** The whole entry: one underlying for every leg (a position is single-underlying), then each leg. */
export function checkManualEntry(input: {
  underlying: string;
  legs: ManualLegFields[];
  today: string;
}): ManualEntryCheck {
  const underlying = underlyingError(input.underlying);
  const legs = input.legs.map((leg) => manualLegErrors(leg, input.today));
  const clean = underlying == null && legs.length > 0 && legs.every((e) => !Object.keys(e).length);
  return clean
    ? { ok: true, ticker: normalizeUnderlying(input.underlying) }
    : { ok: false, underlying, legs };
}
