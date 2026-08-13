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

/** Empty input clears the field (a legal, independently-clearable action) — never a refusal. */
export function validateAccountSize(raw: string): ValidationResult<number | null> {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  const n = Number(trimmed);
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
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  const n = Number(trimmed);
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

/** Formats a stored value back into its draft text — verbatim, never re-derived. */
export function formatAmount(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}
