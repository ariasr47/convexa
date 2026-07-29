/**
 * The leg — the unit a position is made of, and the unit the mark ladder resolves.
 *
 * Three hard stands (SPEC §2.1), each with a rejected alternative:
 *  - `qty` is UNSIGNED; `side` carries direction. A sign convention is not checkable; an enum is.
 *  - `multiplier` is STORED on the leg, never derived from `kind`. Adjusted options are real, and
 *    `kind === 'option' ? 100 : 1` reintroduces the exact hardcode this feature exists to kill.
 *  - `entry_price` is PER-UNIT and always POSITIVE. Debit vs credit is a property of the
 *    composition; the sign enters through `side` at composition time and nowhere else.
 *
 * Pure module: no store access, no React, no fetch.
 */
import type { OptionRight } from '@org/api';
import type { EntryBasis, EntryMode, PositionId, PositionStatus } from './types';

export type LegId = string;
export type InstrumentKind = 'option' | 'equity';
export type LegSide = 'long' | 'short';

export interface Leg {
  /** Stable uuid, minted at creation, never reused. */
  id: LegId;
  /** The projection exposes this as `instrument_kind`. */
  kind: InstrumentKind;
  /** ON THE LEG — a broker import produces leg-shaped rows each carrying their own symbol. */
  ticker: string;
  side: LegSide;
  /** POSITIVE integer, always. */
  qty: number;
  /** STORED. 100 for a standard option contract, 1 for equity. Never derived from `kind`. */
  multiplier: number;
  /** Per-unit, always POSITIVE. */
  entry_price: number;
  entry_basis: EntryBasis;
  /** Option-only; `null` on an equity leg or an unrecorded legacy fact. */
  expiration: string | null;
  strike: number | null;
  right: OptionRight | null;
}

export interface SimPosition {
  id: PositionId;
  /** length >= 1. Single-underlying is enforced at CONSTRUCTION, not by the type. */
  legs: Leg[];
  /** The legacy `entry_time`, carried verbatim — `''` on a pending limit, NEVER backfilled. */
  opened_time: string;
  status: PositionStatus;
  entry_mode: EntryMode;
  limit_price?: number | null;
  placed_time?: string;
  /** Plan data — POSITION-level, never leg-level. */
  stop?: number | null;
  target?: number | null;
  realized_pl_dollar?: number;
  realized_pl_pct?: number;
  close_time?: string;
  origin_order_id?: string;
  schema_version: number;
}

export const SIM_POSITION_SCHEMA_VERSION = 3;

/**
 * The net-entry magnitude below which a percentage has no meaningful denominator, in DOLLARS.
 * A true zero-cost collar computes to exactly 0; float noise on a real net is orders of magnitude
 * under 50 cents, and no real structure is opened for a net of less than half a dollar.
 */
export const NET_BASIS_EPS = 0.5;

export function sideSign(l: Leg): 1 | -1 {
  return l.side === 'long' ? 1 : -1;
}

export function legCost(l: Leg): number {
  return sideSign(l) * l.entry_price * l.multiplier * l.qty;
}

export function legValue(l: Leg, mark: number): number {
  return sideSign(l) * mark * l.multiplier * l.qty;
}

export function legPl(l: Leg, mark: number): number {
  return sideSign(l) * (mark - l.entry_price) * l.multiplier * l.qty;
}

/** > 0 debit (money paid), < 0 credit (money received). */
export function netEntryCost(p: SimPosition): number {
  return p.legs.reduce((sum, l) => sum + legCost(l), 0);
}

/**
 * ALL-OR-NOTHING. If ANY leg's mark is null the position's P/L is null — never a partial sum.
 * The reason is not incompleteness, it is SIGN INVERSION: drop the short leg from a credit spread
 * and a losing position renders as a winner. Do not relax this into "a partial sum with an
 * asterisk" (SPEC §2.5). Per-leg truth is fully visible in the leg disclosure.
 */
export function positionPl(
  p: SimPosition,
  marks: ReadonlyMap<LegId, number | null>,
): number | null {
  let total = 0;
  for (const l of p.legs) {
    const mark = marks.get(l.id);
    if (mark == null) return null;
    total += legPl(l, mark);
  }
  return total;
}

/**
 * The percentage breaks twice in shipped code and both are fixed here: a credit structure divides a
 * correctly-signed numerator by a NEGATIVE denominator (flipping the sign), and a near-costless
 * structure divides by ~0 (yielding +/-Infinity). The denominator becomes a MAGNITUDE, and `basis`
 * is REQUIRED on the value branch so it is impossible to hold the figure without holding its basis.
 */
export type PlPctState =
  | { kind: 'value'; value: number; basis: 'net_debit' | 'net_credit' }
  | { kind: 'no_basis' }
  | { kind: 'unavailable' }
  | { kind: 'not_applicable' };

export function plPctStateOf(args: {
  plDollar: number | null;
  netEntryCost: number;
  status: PositionStatus;
  anyLegUnresolved: boolean;
}): PlPctState {
  if (args.status === 'pending') return { kind: 'not_applicable' };
  if (args.anyLegUnresolved || args.plDollar == null) return { kind: 'unavailable' };
  if (Math.abs(args.netEntryCost) < NET_BASIS_EPS) return { kind: 'no_basis' };
  return {
    kind: 'value',
    value: (args.plDollar / Math.abs(args.netEntryCost)) * 100,
    basis: args.netEntryCost > 0 ? 'net_debit' : 'net_credit',
  };
}
