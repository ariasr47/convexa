/**
 * The sim-order evaluation engine — PURE transition functions (order × live payload × liveness
 * flags → transition | none) + the clock-expiry check (arch §5). No store access, no fetch, no
 * side effects: purity is preserved deliberately for the deferred recorded-replay seam (arch §8).
 *
 * Binding rules implemented here:
 *  - Trigger input = the live SSE underlying **NBBO mid** ONLY. `last_trade` is FORBIDDEN as an
 *    engine input (§5 canon) — `tickFromLive` structurally drops everything but `mid`.
 *  - Fires on the FIRST live payload satisfying the comparator — including the first after
 *    placement (AC-9). Instantaneous level test; no hidden armed-side state.
 *  - Fill input = a live-resolvable option mark (the caller resolves it through the existing
 *    `computeMark` ladder and passes null unless `isLive && !streamOffline` and the mark is
 *    neither frozen nor last_known). Limit ⇒ shipped `limitWouldFill` semantics, fill price = the
 *    limit (AC-16). Market-on-trigger ⇒ the first live-resolvable mark (AC-17).
 *  - Trigger + fill MAY collapse in one tick — both facts are recorded (arch §2).
 *  - `[live-vs-static-isolation]`: nothing transitions while offline/stale/frozen; clock expiry is
 *    the ONLY off-stream transition (AC-21/26/27/28).
 *  - Strictly forward waiting → triggered → filled; the CALLER applies transitions read-modify-
 *    write against durable status (unexpected current status ⇒ no-op — idempotent, AC-18).
 */
import type { LiveUpdate } from '@org/api';
import { limitWouldFill } from '../positions/entry';
import type { SimOrder, Trigger, OrderFillBasis } from './types';

/** One evaluation tick's inputs. `optionMark` MUST already be live-resolved by the caller (null
 *  when the mark is unavailable, frozen, last_known, or the stream isn't live). */
export interface EngineTick {
  /** Live underlying NBBO mid from the SSE payload (the ONLY trigger input). */
  mid: number | null;
  /** Payload `live` flag AND the >15s payload-gap watchdog both healthy. */
  isLive: boolean;
  streamOffline: boolean;
  /** Live-resolvable option mark for THIS order's contract (computeMark, non-frozen, non-last_known). */
  optionMark: number | null;
  /** Wall clock (epoch ms) for the expiry check. */
  now: number;
}

/** Build the trigger-relevant slice of a live payload. Structurally drops `last_trade` (and every
 *  other field) — the engine can never see it (§5 canon). */
export function tickFromLive(
  live: Pick<LiveUpdate, 'mid' | 'live'> | null,
  streamOffline: boolean,
  optionMark: number | null,
  now: number = Date.now(),
): EngineTick {
  return {
    mid: live?.mid ?? null,
    isLive: (live?.live ?? false) && !streamOffline,
    streamOffline,
    optionMark,
    now,
  };
}

/** Instantaneous level test: `underlying_above` ⇒ mid strictly above the level; `underlying_below`
 *  ⇒ strictly below. (Matches the D8-2 wording "already {above|below} {level}".) */
export function triggerMet(trigger: Trigger, mid: number): boolean {
  return trigger.kind === 'underlying_above' ? mid > trigger.level : mid < trigger.level;
}

/** End of a YYYY-MM-DD calendar day, local time (the contract's own expiration bound). */
function endOfDayMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/** Clock expiry — the ONLY off-stream transition (AC-21): the good-til bound passed, or the
 *  contract's own expiration date passed. Wall-clock fact; safe with no live data. */
export function isClockExpired(order: Pick<SimOrder, 'expires_at' | 'expiration'>, nowMs: number): boolean {
  const goodTil = Date.parse(order.expires_at);
  if (Number.isFinite(goodTil) && goodTil <= nowMs) return true;
  const contractEnd = endOfDayMs(order.expiration);
  return Number.isFinite(contractEnd) && contractEnd < nowMs;
}

/** A pure transition result. The caller stamps it onto the durable order read-modify-write. */
export type OrderTransition =
  | { to: 'triggered'; triggered_time: string }
  | {
      to: 'filled';
      /** Present when trigger + fill collapsed in one tick (both facts recorded). */
      triggered_time?: string;
      filled_time: string;
      fill_mark: number;
      fill_basis: OrderFillBasis;
    }
  | { to: 'expired'; close_time: string };

/** Resolve the fill for a working (triggered) order against a live option mark. */
function resolveFill(
  order: Pick<SimOrder, 'limit_price'>,
  optionMark: number | null,
): { fill_mark: number; fill_basis: OrderFillBasis } | null {
  if (order.limit_price != null) {
    // Shipped limitWouldFill semantics: live mark at/below the limit; fill price = the LIMIT
    // (conservative, no-look-ahead — never better than the limit).
    return limitWouldFill(optionMark, order.limit_price, optionMark != null)
      ? { fill_mark: order.limit_price, fill_basis: 'limit_fill' }
      : null;
  }
  // Market-on-trigger: the FIRST live-resolvable option mark.
  return optionMark != null ? { fill_mark: optionMark, fill_basis: 'trigger_fill' } : null;
}

/**
 * Evaluate ONE order against ONE tick. Returns the transition to apply, or null (no-op).
 * Terminal orders never transition (AC-24). Expiry is checked first and is the only transition
 * allowed while not live. Everything else requires `isLive && !streamOffline` and live inputs.
 */
export function evaluateOrder(order: SimOrder, tick: EngineTick): OrderTransition | null {
  if (order.status !== 'waiting' && order.status !== 'triggered') return null;

  // 1) Clock expiry — allowed off-stream (the ONLY off-stream transition).
  if (isClockExpired(order, tick.now)) {
    return { to: 'expired', close_time: new Date(tick.now).toISOString() };
  }

  // 2) Nothing else moves without live data ([live-vs-static-isolation], AC-26/28).
  if (!tick.isLive || tick.streamOffline) return null;

  const iso = new Date(tick.now).toISOString();
  let triggeredThisTick = false;

  if (order.status === 'waiting') {
    // A waiting order MUST have a trigger (trigger-less orders are created directly as
    // `triggered`, AC-13); defensive no-op otherwise.
    if (!order.trigger) return null;
    if (tick.mid == null || !triggerMet(order.trigger, tick.mid)) return null;
    triggeredThisTick = true;
  }

  // Working the entry (durably `triggered`, or trigger+fill collapsing in this tick).
  const fill = resolveFill(order, tick.optionMark);
  if (fill) {
    return {
      to: 'filled',
      ...(triggeredThisTick ? { triggered_time: iso } : {}),
      filled_time: iso,
      fill_mark: fill.fill_mark,
      fill_basis: fill.fill_basis,
    };
  }
  if (triggeredThisTick) return { to: 'triggered', triggered_time: iso };
  return null;
}
