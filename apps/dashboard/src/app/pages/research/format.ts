/** Formatting for research figures. Pure; the numbers themselves arrive computed from the build. */
import type { NoteStance, Uncertainty } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-12" → "Oct 12, 2026". Parsed by hand so no time zone can shift the day. */
export function formatNoteDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-10-12" → "Oct 12". */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** An as-of written in a note: real days shorten to "Jun 30"; periods ("Q2 2026") stay as written. */
export function formatAsOf(asOf: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? formatShortDate(asOf) : asOf;
}

/** Dollars per share: whole dollars from $100, cents below. */
export function money(value: number): string {
  const abs = Math.abs(value);
  const text =
    abs >= 100
      ? Math.round(abs).toLocaleString('en-US')
      : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? '−' : ''}$${text}`;
}

/** A share price, always to the cent: "$146.62". */
export function priceText(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** $ millions → "$34.8B" / "$885M". */
export function millions(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1000)
    return `${sign}$${(abs / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}M`;
}

/** A percentage already in percent units: 12.345 → "12%"; keeps one decimal under 10. */
export function percent(value: number): string {
  const abs = Math.abs(value);
  return `${abs < 10 && abs !== Math.round(abs) ? abs.toFixed(1) : Math.round(abs)}%`;
}

/** A fraction: 0.115 → "11.5%". */
export function rate(value: number): string {
  const pct = Math.round(value * 1000) / 10;
  return `${pct}%`;
}

/** Direction of a signed change, never colour alone: ▲ / ▼ plus the size. */
export function arrow(value: number): '▲' | '▼' {
  return value >= 0 ? '▲' : '▼';
}

export const STANCE_LABEL: Record<NoteStance, string> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
  watching: 'Watching',
};

/** Green and red are reserved for direction (DESIGN_SYSTEM); a stance is a direction. */
export const STANCE_TONE: Record<NoteStance, 'success' | 'error' | 'neutral'> = {
  bullish: 'success',
  bearish: 'error',
  neutral: 'neutral',
  watching: 'neutral',
};

export const UNCERTAINTY_LABEL: Record<Uncertainty, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'very-high': 'Very high',
  extreme: 'Extreme',
};

/** Bars lit out of five, Morningstar's ladder. */
export const UNCERTAINTY_LEVEL: Record<Uncertainty, number> = {
  low: 1,
  medium: 2,
  high: 3,
  'very-high': 4,
  extreme: 5,
};

/** Input keys as a reader reads them. */
export const INPUT_LABEL: Record<string, string> = {
  rev_y1: 'Year-1 revenue',
  growth: 'Revenue growth',
  margin_y1: 'Year-1 margin',
  margin_target: 'Target margin',
  sales_to_capital: 'Sales to capital',
  wacc: 'Cost of capital',
  p_fail: 'Chance of failure',
  distress: 'Value in distress',
  terminal_growth: 'Terminal growth',
  terminal_wacc: 'Terminal cost of capital',
  terminal_roc: 'Terminal return on capital',
  tax: 'Tax rate',
  margin_year: 'Margin reached in year',
};
