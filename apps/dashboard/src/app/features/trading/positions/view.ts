/**
 * `PositionView` — a per-cycle DERIVED, NEVER-PERSISTED projection (the existing DerivedRow /
 * OrderEvalState precedent).
 *
 * Presentational components consume a PositionView and NEVER import the store, NEVER call the
 * recogniser, and NEVER perform leg arithmetic or leg formatting. If a component needs a number
 * that is not on this projection, that is a change to THIS FILE, not a component reaching past the
 * boundary. That boundary is what lets the same components serve sim-now and broker-later without a
 * fork — and it is the seam `BrokerPosition` plugs into later without touching a durable key.
 *
 * Pure: no store access, no React, no fetch, no clock. Building it twice from the same inputs
 * yields deep-equal output, which is what makes it safe to rebuild every cycle.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import type { MarkBasis } from '@/features/trading/model/types';
import { composePositionMark, type PositionMark } from './composeMark';
import { evalSubjectOf, type EvalSubject } from './evalSubject';
import {
  netEntryCost,
  plPctStateOf,
  positionPl,
  type InstrumentKind,
  type Leg,
  type LegId,
  type PlPctState,
  type SimPosition,
} from './leg';
import { maxLossOf, type MaxLossResult } from './maxLoss';
import { STRUCTURE_LABELS, structureKindOf, type StructureKind } from './structure';

/**
 * Above this many DISTINCT strikes the structure line collapses to its first-and-last form. Three
 * is the point at which a strike list stops being scannable in one dense row.
 */
export const STRUCTURE_LINE_MAX_STRIKES = 3;

/** U+2026, authored in the string. NEVER three periods, and never a CSS ellipsis mid-number. */
const ELLIPSIS = '…';
/** The literal for a fact the saved record never held (SPEC §4, the four not-a-number literals). */
const NOT_RECORDED = 'not recorded';

export interface LegDisplayRow {
  leg_id: LegId;
  /** The WORD — never `+`/`−`, never coloured (SPEC §4 *The leg disclosure*). */
  side_word: 'Long' | 'Short';
  /** `1 ×` for a contract, `100 sh` for equity. */
  size_text: string;
  /** `$400 Call`, `Shares`, or `not recorded` when the facts were never held. */
  instrument_text: string;
  /** `Jul 18`; `—` for an equity leg; `not recorded` when the record never held one. */
  expiry_text: string;
  instrument_kind: InstrumentKind;
  /** THIS leg's own mark — per-leg truth is fully visible even when the aggregate is withheld. */
  mark: number | null;
  /** THIS leg's own basis; `null` when the leg did not resolve. */
  basis: MarkBasis | null;
  unavailable: boolean;
}

export interface PositionView {
  position: SimPosition;
  /**
   * The position's ONE underlying. Single-underlying is enforced at construction (SPEC §2.7), so
   * every leg carries the same symbol and this is that symbol. Projected because the derivation
   * pipeline filters and sorts on it and must not reach into `position.legs` to find it.
   */
  ticker: string;
  structure: StructureKind;
  structure_label: string;
  /** Pre-formatted, single line, never wrapping. */
  structure_line: string;
  /** The first-and-last collapsed variant — AUTHORED IN THE STRING, never a CSS ellipsis. */
  structure_line_collapsed: string;
  /** The full strike list, for the tooltip. */
  structure_line_full: string;
  net_entry_cost: number;
  net_entry_basis: 'net_debit' | 'net_credit';
  mark: PositionMark;
  pl_dollar: number | null;
  pl_pct: PlPctState;
  max_loss: MaxLossResult;
  legs: LegDisplayRow[];
  eval_subject: EvalSubject;
  /**
   * The structure-level SIZE as a number — what `qty_text` formats. NEVER a sum across legs: a
   * 1-long/2-short ratio is not "3 contracts". Projected so the sort axis has a number without any
   * component or derivation performing leg arithmetic.
   */
  qty: number;
  /** Structure-level qty text — `2 ×` for options, `100 sh` for equity, `1 ×` for a covered call. */
  qty_text: string;
  /** The unit-aware tip beside it (SPEC §4 *Qty, unit-aware*) — leg formatting stays in here. */
  qty_tip: string;
  unavailable: boolean;
  frozen: boolean;
  /** True when the saved record can NEVER be priced (a missing strike/right), not just this cycle. */
  unpriceable: boolean;
  dte: number | null;
  nearest_expiration: string | null;
  multi_expiration: boolean;
  /** Distinct option expirations. Drives the card's `+N more` suffix — never two dates in one slot. */
  expiration_count: number;
}

// ---- Small pure formatters ----------------------------------------------------------------------

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * `2026-08-21` -> `Aug 21`, formatted from the STRING PARTS. Deliberately not via `new Date(s)`:
 * that parses as UTC midnight and renders the previous day west of Greenwich, which would print a
 * different expiry to a trader in Denver than to one in Berlin for the same saved record.
 */
function monthDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : iso;
}

const rightWord = (r: 'call' | 'put') => (r === 'call' ? 'Call' : 'Put');
const strikeText = (k: number) => `$${k}`;

const isOption = (l: Leg) => l.kind === 'option';
const isEquity = (l: Leg) => l.kind === 'equity';

/**
 * `1 leg` / `4 legs`. SINGULAR MATTERS: SPEC §4's row anatomy for a malformed migrated record reads
 * `TSLA · 1 leg`, and `1 legs` under a structure chip is the kind of tell that makes a trader
 * distrust every other number on the row.
 */
const legCountText = (n: number) => `${n} leg${n === 1 ? '' : 's'}`;

/** The distinct strikes across the option legs, ascending. */
function distinctStrikes(legs: readonly Leg[]): number[] {
  const set = new Set<number>();
  for (const l of legs) if (isOption(l) && l.strike != null) set.add(l.strike);
  return [...set].sort((a, b) => a - b);
}

/** The distinct expirations across the option legs, ascending. */
function distinctExpirations(legs: readonly Leg[]): string[] {
  const set = new Set<string>();
  for (const l of legs) if (isOption(l) && l.expiration != null) set.add(l.expiration);
  return [...set].sort();
}

/** The one right shared by every option leg, or `null` when the structure mixes rights. */
function sharedRight(legs: readonly Leg[]): 'call' | 'put' | null {
  const rights = new Set(legs.filter(isOption).map((l) => l.right));
  if (rights.size !== 1) return null;
  const [only] = [...rights];
  return only === 'call' || only === 'put' ? only : null;
}

/** The noun the structure line ends with. `''` for a single leg, whose line is just `$400 Call`. */
const STRUCTURE_NOUN: Partial<Record<StructureKind, string>> = {
  call_debit_spread: 'vertical',
  call_credit_spread: 'vertical',
  put_debit_spread: 'vertical',
  put_credit_spread: 'vertical',
  long_straddle: 'straddle',
  short_straddle: 'straddle',
  long_strangle: 'strangle',
  short_strangle: 'strangle',
  iron_condor: 'condor',
  iron_butterfly: 'butterfly',
  calendar: 'calendar',
  diagonal: 'diagonal',
};

// ---- The structure line -------------------------------------------------------------------------

/**
 * One small pure case per structure family, dispatched on `StructureKind`. The single-leg option
 * form is BYTE-IDENTICAL to the shipped descriptor (`PositionRow.tsx:97-118` renders
 * `${p.strike} {Call|Put}` under a `$`), so an existing user's row does not move.
 */
function structureLine(p: SimPosition, kind: StructureKind): string {
  const legs = p.legs;
  const options = legs.filter(isOption);
  const equities = legs.filter(isEquity);

  // Equity only.
  if (options.length === 0) {
    const qty = equities.reduce((n, l) => n + l.qty, 0);
    return equities.length > 0 ? `${qty} shares` : legCountText(legs.length);
  }

  // Equity + options (covered call, protective put, collar): shares first, then each option.
  if (equities.length > 0) {
    const shares = equities.reduce((n, l) => n + l.qty, 0);
    const parts = options.map((l) =>
      l.strike != null && l.right != null
        ? `${strikeText(l.strike)} ${rightWord(l.right)}`
        : NOT_RECORDED,
    );
    return `${shares} sh + ${parts.join(' + ')}`;
  }

  const noun = STRUCTURE_NOUN[kind] ?? '';
  const strikes = distinctStrikes(options);
  const expiries = distinctExpirations(options);

  // An unnamed shape gets a plain leg count — no diagnosis, no strike archaeology (AC-15).
  if (kind === 'custom' || strikes.length === 0) return legCountText(legs.length);

  const right = sharedRight(options);
  const head = strikes.map(strikeText).join('/');
  // The right word appears only when every option leg shares one — a condor does not claim a right.
  const body = right ? `${head} ${rightWord(right)}` : head;
  const named = noun ? `${body} ${noun}` : body;

  // Multi-expiry structures carry their expiries IN the line; the `expiry` column then shows the
  // nearest one with the multi-expiry tooltip (SPEC §4 *The `contract` cell*).
  if (expiries.length > 1) {
    return `${named} · ${monthDay(expiries[0])} → ${monthDay(expiries[expiries.length - 1])}`;
  }
  return named;
}

/**
 * The first-and-last collapse — AUTHORED IN THE STRING. A CSS ellipsis mid-number would render
 * `$38…` and read as data; this form never can. The full list stays on `structure_line_full`.
 */
function collapseLine(p: SimPosition, kind: StructureKind, full: string): string {
  const options = p.legs.filter(isOption);
  const strikes = distinctStrikes(options);
  if (strikes.length <= STRUCTURE_LINE_MAX_STRIKES) return full;
  const noun = STRUCTURE_NOUN[kind] ?? '';
  const range = `${strikeText(strikes[0])}${ELLIPSIS}${strikeText(strikes[strikes.length - 1])}`;
  const head = noun ? `${range} ${noun}` : range;
  return `${head} (${p.legs.length} legs)`;
}

// ---- The leg rows -------------------------------------------------------------------------------

function legRow(l: Leg, res: MarkResult | null): LegDisplayRow {
  const resolved = res != null && res.mark != null;
  return {
    leg_id: l.id,
    side_word: l.side === 'long' ? 'Long' : 'Short',
    size_text: l.kind === 'equity' ? `${l.qty} sh` : `${l.qty} ×`,
    instrument_text:
      l.kind === 'equity'
        ? 'Shares'
        : l.strike != null && l.right != null
          ? `${strikeText(l.strike)} ${rightWord(l.right)}`
          : NOT_RECORDED,
    // `—` says the field does not apply to this instrument; `not recorded` says the saved record
    // never held it. Two different truths, never one literal for the other's meaning (SPEC §4).
    expiry_text:
      l.kind === 'equity' ? '—' : l.expiration != null ? monthDay(l.expiration) : NOT_RECORDED,
    instrument_kind: l.kind,
    mark: resolved ? (res as MarkResult).mark : null,
    basis: resolved ? (res as MarkResult).basis : null,
    unavailable: !resolved,
  };
}

/**
 * The structure-level SIZE. Options ⇒ the largest option leg's size; equity-only ⇒ the share count.
 * A ratio's legs disagree; the structure-level size is the largest, and the disclosure carries each
 * leg's own size. NEVER a sum — 1 long + 2 short is not "3 contracts".
 */
function qtyOf(p: SimPosition): number {
  const options = p.legs.filter(isOption);
  if (options.length === 0) return p.legs.filter(isEquity).reduce((n, l) => n + l.qty, 0);
  return Math.max(...options.map((l) => l.qty));
}

/** Options ⇒ `${qty} ×`; equity-only ⇒ `${qty} sh`; mixed ⇒ the STRUCTURE-level unit `${qty} ×`. */
function qtyText(p: SimPosition): string {
  return p.legs.some(isOption) ? `${qtyOf(p)} ×` : `${qtyOf(p)} sh`;
}

/**
 * The unit-aware qty tip (SPEC §4 *Qty, unit-aware*). Composed from the LEGS here, not in a
 * component: a covered call's tip has to name both halves, and leg formatting never leaves this
 * module. For `FX_COVERED_CALL` this reads exactly the spec's string.
 */
function qtyTip(p: SimPosition, label: string): string {
  const options = p.legs.filter(isOption);
  const equities = p.legs.filter(isEquity);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  if (options.length === 0) {
    return `${plural(
      equities.reduce((n, l) => n + l.qty, 0),
      'share',
    )}.`;
  }
  const size = Math.max(...options.map((l) => l.qty));
  if (equities.length === 0) {
    return `${plural(size, 'contract')} — ${options[0].multiplier} shares each.`;
  }
  const shares = equities.reduce((n, l) => n + l.qty, 0);
  const optionParts = options
    .map((l) => `${l.qty} ${l.side} ${l.right ?? 'option'}`)
    .join(' plus ');
  return (
    `${size} ${label.toLowerCase()} — ${plural(shares, 'share')} plus ${optionParts}. ` +
    "Expand the position to see each leg's size."
  );
}

// ---- The projection -----------------------------------------------------------------------------

export function buildPositionView(args: {
  position: SimPosition;
  legMarks: ReadonlyMap<LegId, MarkResult | null>;
  dte: number | null;
}): PositionView {
  const { position, legMarks, dte } = args;

  const structure = structureKindOf(position);
  const mark = composePositionMark(legMarks, position);

  const numericMarks = new Map<LegId, number | null>(
    position.legs.map((l) => [l.id, legMarks.get(l.id)?.mark ?? null]),
  );
  const pl_dollar = positionPl(position, numericMarks);
  const net_entry_cost = netEntryCost(position);

  const structure_line = structureLine(position, structure);
  const options = position.legs.filter(isOption);
  const expiries = distinctExpirations(options);

  return {
    position,
    // Single-underlying is enforced at CONSTRUCTION, so every leg agrees; leg 0 IS the position's
    // ticker. `''` is unreachable for a real record (`legs.length >= 1`) and is not a rendered value.
    ticker: position.legs[0]?.ticker ?? '',
    structure,
    structure_label: STRUCTURE_LABELS[structure],
    structure_line,
    structure_line_collapsed: collapseLine(position, structure, structure_line),
    // The full list IS the uncollapsed line: it always carries every strike.
    structure_line_full: structure_line,
    net_entry_cost,
    net_entry_basis: net_entry_cost > 0 ? 'net_debit' : 'net_credit',
    mark,
    pl_dollar,
    pl_pct: plPctStateOf({
      plDollar: pl_dollar,
      netEntryCost: net_entry_cost,
      status: position.status,
      anyLegUnresolved: mark.unavailable,
    }),
    max_loss: maxLossOf(position, structure),
    legs: position.legs.map((l) => legRow(l, legMarks.get(l.id) ?? null)),
    eval_subject: evalSubjectOf(position),
    qty: qtyOf(position),
    qty_text: qtyText(position),
    qty_tip: qtyTip(position, STRUCTURE_LABELS[structure]),
    unavailable: mark.unavailable,
    frozen: mark.frozen,
    // PERMANENT, not this-cycle: the fact was never recorded, so no future cycle can fix it. This is
    // what selects UNPRICEABLE_RECORD_TIP over ROW_UNAVAILABLE_TIP at render time (AC-32).
    unpriceable: options.some((l) => l.strike == null || l.right == null || l.expiration == null),
    dte,
    nearest_expiration: expiries.length > 0 ? expiries[0] : null,
    multi_expiration: expiries.length > 1,
    expiration_count: expiries.length,
  };
}
