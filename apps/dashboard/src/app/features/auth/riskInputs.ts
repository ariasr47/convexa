/**
 * riskInputs — pure validation for the Settings `Risk inputs` panel (tradeable-rec-inputs SPEC §4).
 * Local refusals are UX sugar for the obvious cases, mirroring `validation.ts`'s stance: the SERVER
 * is the enforcement boundary and is authoritative (INTERFACE_CONTRACT §4).
 *
 * This module performs NO arithmetic on an entered value — no multiplication, no division, no
 * derivation of the effective dollar cap. That figure is derived exactly once, server-side, and
 * rendered verbatim from `effective_dollar_cap.value`.
 */
import type { CapUnit, PerTradeCap } from '@convexa/api';
import { RISK_INPUTS_COPY } from './copy';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Thousands grouping on a plain decimal ("25000" → "25,000", "1234.5" → "1,234.5"). Anything
 *  that isn't a plain decimal (an exponent form) is returned as `String` gives it, unchanged. */
function grouped(value: number): string {
  const s = String(value);
  const m = /^(\d+)(\.\d+)?$/.exec(s);
  if (!m) return s;
  return m[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (m[2] ?? '');
}

/** Thousands groups: a first group of 1–3 digits that doesn't start with zero, then `,ddd`s.
 *  "0,500" is refused, since to someone who writes a decimal comma it means 0.5, not 500. */
const GROUPED = /^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/;
/** The only form `Number()` is ever handed: digits, optionally a point and more digits. Keeps out
 *  everything else `Number()` accepts: "0x10" (16), "0b11" (3), "0o17", "1e3" (1000), ".5", "". */
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * The typed text as plain decimal text, or `null` when it is malformed. A leading `$` (when
 * `dollar`) and thousands commas are accepted, so the field's own display ("$25,000") saves back
 * as the same number. Commas must be real thousands groups: "1,50" is refused rather than read as
 * 150 (a decimal comma would otherwise be off by a hundred), and so is "0,500".
 */
function amountText(raw: string, dollar: boolean): string | null {
  let s = raw.trim();
  if (dollar && s.startsWith('$')) s = s.slice(1).trim();
  if (s.includes(',')) {
    if (!GROUPED.test(s)) return null;
    s = s.replace(/,/g, '');
  }
  return PLAIN_DECIMAL.test(s) ? s : null;
}

/** Empty input clears the field (a legal, independently-clearable action) — never a refusal. */
export function validateAccountSize(raw: string): ValidationResult<number | null> {
  if (raw.trim() === '') return { ok: true, value: null };
  const text = amountText(raw, true);
  if (text === null) return { ok: false, error: RISK_INPUTS_COPY.errorGreaterThanZero };
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0)
    return { ok: false, error: RISK_INPUTS_COPY.errorGreaterThanZero };
  return { ok: true, value: n };
}

/** A percent cap is validated ONLY against its own (0,100] range — never against the account size,
 *  at any account size including none entered (AC-21). A dollar cap is validated against the
 *  ACCOUNT SIZE PASSED IN (the value already on the form, entered or stored — never re-derived). */
export function validateCap(
  raw: string,
  unit: CapUnit,
  accountSize: number | null,
): ValidationResult<PerTradeCap | null> {
  if (raw.trim() === '') return { ok: true, value: null };
  const text = amountText(raw, unit === 'usd');
  if (text === null) return { ok: false, error: RISK_INPUTS_COPY.errorGreaterThanZero };
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0)
    return { ok: false, error: RISK_INPUTS_COPY.errorGreaterThanZero };
  if (unit === 'percent') {
    if (n > 100) return { ok: false, error: RISK_INPUTS_COPY.errorPercentRange };
    return { ok: true, value: { value: n, unit } };
  }
  // unit === 'usd'
  if (accountSize != null && n > accountSize)
    return { ok: false, error: RISK_INPUTS_COPY.errorCapExceedsAccount };
  return { ok: true, value: { value: n, unit } };
}

/** Formats a stored value back into its draft text — verbatim, never re-derived or rounded; only
 *  grouped for reading ("25000" reads "25,000"). */
export function formatAmount(value: number | null | undefined): string {
  return value == null ? '' : grouped(value);
}

/** The account size as the board draws it ("$25,000"). The stored figure stays the plain number:
 *  `validateAccountSize` reads this text back to exactly the value it came from. */
export function formatAccountSize(value: number | null | undefined): string {
  return value == null ? '' : `$${grouped(value)}`;
}
