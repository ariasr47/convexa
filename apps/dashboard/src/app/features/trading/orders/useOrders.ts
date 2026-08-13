/**
 * useOrders — the orders store brain (list / create / cancel, the render-time expiry sweep, the
 * derived evaluation sub-state) + the module-level mutation functions the evaluation engine hook
 * shares (read-modify-write transitions, decision-record appends, the fill→Position creation).
 *
 * Invariants owned here:
 *  - `[server-side-gate-enforcement]`: `createOrder` is a PURE LOCAL write — the caller (the Act
 *    confirm) awaits `POST /api/positions/sim-trade/gate` via `useGate.guard` BEFORE calling it.
 *  - Idempotent transitions (AC-18): `applyOrderTransition` re-reads the durable order and no-ops
 *    when the current status isn't the expected one — multiple mounted hooks can't double-fill.
 *  - Exactly ONE Position per fill, created via the EXISTING positions-store path with the
 *    additive `trigger_fill`/`limit_fill` basis + `origin_order_id` backlink (AC-18/31).
 *  - Every transition appends to the SAME append-only decision log (`trade_id` = order id); a fill
 *    also emits the position `open` event (AC-32).
 *  - Store faults degrade to the honest unavailable state; create REFUSES to write into a faulted
 *    store (`[best-effort-isolated-or-null]`, AC-29).
 */
import { entryContextFor } from '@/features/trading/model/captureDigest';
import type { DecisionEvent, DecisionRecord } from '@/features/trading/model/types';
import { SCHEMA_VERSION as DECISION_SCHEMA } from '@/features/trading/model/types';
import type { SimPosition } from '@/features/trading/positions/leg';
import {
  allDecisions,
  appendDecision,
  newId,
  putPosition,
} from '@/features/trading/positions/store';
import { PORTFOLIO_SCHEMA_VERSION } from '@/features/trading/positions/types';
import type { OptionRight, TickerBundle } from '@convexa/api';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { STORE_FAULT_TITLE } from './copy';
import { EngineTick, evaluateOrder, isClockExpired, OrderTransition } from './engine';
import {
  __notifyOrdersChanged,
  allOrders,
  buildOrdersExport,
  getOrder,
  getOrdersVersion,
  newOrderId,
  OrdersExport,
  ordersFaulted,
  putOrder,
  subscribeOrders,
} from './store';
import {
  isTerminal,
  OrderEvalState,
  OrderProvenance,
  ORDERS_SCHEMA_VERSION,
  SimOrder,
  Trigger,
} from './types';

// ---- Decision records ----------------------------------------------------------------------------

/** Ambient market context for a decision record — best-effort, zeros when unknown. */
export interface DecisionCtx {
  spot?: number;
  tier?: string;
  /** outcome-ledger: the bundle ALREADY IN HAND on the host page, for the best-effort entry-context
   *  capture. Absent ⇒ every bundle-sourced digest field captures null. Never fetched here. */
  bundle?: TickerBundle | null;
}

/** The order path carries the rec identity durably on the order itself, so capture reads it from
 *  there. A scripted-scenario order is excluded from every rate by the ledger anyway; its identity
 *  is not an AI-rec attribution. */
function recIdentityOf(order: SimOrder): string | null {
  return order.provenance?.source === 'ai_rec' ? (order.provenance.rec_fingerprint ?? null) : null;
}

function orderDecision(
  event: DecisionEvent,
  order: SimOrder,
  extra: Partial<DecisionRecord>,
  ctx: DecisionCtx = {},
): DecisionRecord {
  return {
    id: newId(),
    event_type: event,
    clock_time: new Date().toISOString(),
    trade_id: order.id,
    contract: {
      ticker: order.ticker,
      expiration: order.expiration,
      strike: order.strike,
      right: order.right,
      qty: order.qty,
    },
    mark_price: order.limit_price ?? 0,
    mark_basis: 'manual', // plan price, not a market quote — overridden by `extra` on fills
    underlying_spot: ctx.spot ?? 0,
    pl_dollar: 0,
    pl_pct: 0,
    tier: ctx.tier ?? '',
    position_fingerprint: '',
    schema_version: DECISION_SCHEMA,
    // outcome-ledger capture (decision-point events only) — never gates the order write.
    ...entryContextFor(event, {
      bundle: ctx.bundle ?? null,
      aiRecFingerprint: recIdentityOf(order),
      // tradeable-rec-inputs (AC-82): the order lifecycle has no risk-inputs read of its own here —
      // `null` (genuinely unresolved this cycle), never a fabricated `false`.
      riskBlockPresent: null,
    }),
    ...extra,
  } as DecisionRecord;
}

// ---- Create / cancel (module-level so the engine hook + UI share one path) ------------------------

export interface CreateOrderInput {
  ticker: string;
  expiration: string;
  strike: number;
  right: OptionRight;
  qty: number;
  trigger: Trigger | null;
  limit_price: number | null;
  stop: number | null;
  target: number | null;
  expires_at: string;
  provenance: OrderProvenance;
}

export interface CreateOrderResult {
  ok: boolean;
  reason?: string;
  order?: SimOrder;
}

/** Persist a confirmed order. Status: `waiting` with a trigger; `triggered` (armed immediately,
 *  never `waiting`) without one (AC-12/13). REFUSES a faulted store — nothing partial (AC-29). */
export function createOrder(input: CreateOrderInput, ctx: DecisionCtx = {}): CreateOrderResult {
  if (ordersFaulted()) return { ok: false, reason: STORE_FAULT_TITLE };
  const now = new Date().toISOString();
  const order: SimOrder = {
    id: newOrderId(),
    created_time: now,
    schema_version: ORDERS_SCHEMA_VERSION,
    ticker: input.ticker.toUpperCase(),
    expiration: input.expiration,
    strike: input.strike,
    right: input.right,
    side: 'long',
    qty: Math.max(1, Math.floor(input.qty)),
    trigger: input.trigger,
    limit_price: input.limit_price,
    stop: input.stop,
    target: input.target,
    expires_at: input.expires_at,
    provenance: input.provenance,
    status: input.trigger ? 'waiting' : 'triggered',
    ...(input.trigger ? {} : { triggered_time: now }),
  };
  if (!putOrder(order)) return { ok: false, reason: STORE_FAULT_TITLE };
  appendDecision(orderDecision('order_placed', order, {}, ctx));
  __notifyOrdersChanged();
  return { ok: true, order };
}

/** Two-step-confirmed cancel — allowed from `waiting`/`triggered` only; terminal; no position. */
export function cancelOrder(id: string, ctx: DecisionCtx = {}): void {
  const o = getOrder(id);
  if (!o || (o.status !== 'waiting' && o.status !== 'triggered')) return;
  const cancelled: SimOrder = {
    ...o,
    status: 'cancelled',
    close_time: new Date().toISOString(),
    close_reason: 'cancelled',
  };
  if (!putOrder(cancelled)) return;
  appendDecision(orderDecision('order_cancelled', cancelled, {}, ctx));
  __notifyOrdersChanged();
}

// ---- Transitions (read-modify-write; idempotent) ---------------------------------------------------

/**
 * Apply a pure engine transition to the durable order. Re-reads the current status first: an
 * unexpected current status ⇒ NO-OP (strictly-forward, idempotent under multiple mounted hooks,
 * AC-18/24). A fill creates exactly ONE open Position via the existing positions-store path and
 * appends BOTH the `order_filled` record (with `position_id`) and the position `open` record.
 */
export function applyOrderTransition(
  id: string,
  expectedStatus: SimOrder['status'],
  transition: OrderTransition,
  ctx: DecisionCtx = {},
): void {
  const current = getOrder(id);
  if (!current || current.status !== expectedStatus) return; // idempotent no-op
  if (isTerminal(current.status)) return; // terminal never transitions (AC-24)

  if (transition.to === 'expired') {
    const expired: SimOrder = {
      ...current,
      status: 'expired',
      close_time: transition.close_time,
      close_reason: 'expired',
    };
    if (!putOrder(expired)) return;
    appendDecision(orderDecision('order_expired', expired, {}, ctx));
    __notifyOrdersChanged();
    return;
  }

  if (transition.to === 'triggered') {
    const triggered: SimOrder = {
      ...current,
      status: 'triggered',
      triggered_time: transition.triggered_time,
    };
    if (!putOrder(triggered)) return;
    appendDecision(orderDecision('order_triggered', triggered, {}, ctx));
    __notifyOrdersChanged();
    return;
  }

  // filled — trigger + fill may have collapsed in one tick; both facts are recorded (arch §2).
  // A sim-order fill produces exactly ONE position in the ONE book (AC-18). Post-cutover that book
  // holds `SimPosition`s, so the fill is written as a one-element leg list — the same single open
  // path a one-leg manual entry takes. The order→position link stays an id string: no new edge out
  // of `orders/` (SPEC §2.7).
  const position: SimPosition = {
    id: newId(),
    legs: [
      {
        id: `${newId()}-l0`,
        kind: 'option',
        ticker: current.ticker,
        side: 'long',
        qty: current.qty,
        multiplier: 100,
        entry_price: transition.fill_mark,
        entry_basis: transition.fill_basis,
        expiration: current.expiration,
        strike: current.strike,
        right: current.right,
      },
    ],
    opened_time: transition.filled_time,
    status: 'open',
    entry_mode: current.limit_price != null ? 'limit' : 'market',
    limit_price: current.limit_price,
    stop: current.stop,
    target: current.target,
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    origin_order_id: current.id,
  };
  const filled: SimOrder = {
    ...current,
    status: 'filled',
    ...(transition.triggered_time ? { triggered_time: transition.triggered_time } : {}),
    filled_time: transition.filled_time,
    fill_mark: transition.fill_mark,
    fill_basis: transition.fill_basis,
    position_id: position.id,
  };
  if (!putOrder(filled)) return;
  if (transition.triggered_time) {
    // Collapsed tick: the trigger fact is still recorded (arch §2).
    appendDecision(orderDecision('order_triggered', filled, {}, ctx));
  }
  putPosition(position); // exactly ONE position per fill (AC-18)
  appendDecision(
    orderDecision(
      'order_filled',
      filled,
      {
        mark_price: transition.fill_mark,
        mark_basis: transition.fill_basis as DecisionRecord['mark_basis'],
        position_id: position.id,
      },
      ctx,
    ),
  );
  // The fill ALSO emits the existing position `open` event (trade_id = position id, AC-32). This is
  // the record the outcome ledger joins as the position's ENTRY (its spine), so it carries the same
  // best-effort digest — with the rec identity the order path already holds durably.
  appendDecision({
    id: newId(),
    event_type: 'open',
    clock_time: transition.filled_time,
    trade_id: position.id,
    contract: {
      // Read off the position's ONE leg — the fill created it, so this is the same contract the
      // order names, and the record is byte-identical to what shipped.
      ticker: position.legs[0].ticker,
      expiration: position.legs[0].expiration ?? '',
      strike: position.legs[0].strike ?? 0,
      right: position.legs[0].right ?? current.right,
      qty: position.legs[0].qty,
    },
    mark_price: transition.fill_mark,
    mark_basis: transition.fill_basis as DecisionRecord['mark_basis'],
    underlying_spot: ctx.spot ?? 0,
    pl_dollar: 0,
    pl_pct: 0,
    tier: ctx.tier ?? '',
    position_fingerprint: '',
    schema_version: DECISION_SCHEMA,
    ...entryContextFor('open', {
      bundle: ctx.bundle ?? null,
      aiRecFingerprint: recIdentityOf(filled),
      riskBlockPresent: null,
    }),
  } as DecisionRecord);
  __notifyOrdersChanged();
}

/** Clock-expiry sweep over EVERY non-terminal order (any ticker) — run on engine ticks AND on
 *  store read/render (AC-21: the only off-stream transition). */
export function sweepExpiredOrders(nowMs: number = Date.now(), ctx: DecisionCtx = {}): void {
  for (const o of allOrders()) {
    if (o.status !== 'waiting' && o.status !== 'triggered') continue;
    if (isClockExpired(o, nowMs)) {
      applyOrderTransition(
        o.id,
        o.status,
        {
          to: 'expired',
          close_time: new Date(nowMs).toISOString(),
        },
        ctx,
      );
    }
  }
}

/** Run one pure evaluation over an order and apply the result (per-tick isolation lives in the
 *  engine hook's try/catch). */
export function evaluateAndApply(order: SimOrder, tick: EngineTick, ctx: DecisionCtx = {}): void {
  const t = evaluateOrder(order, tick);
  if (t) applyOrderTransition(order.id, order.status, t, ctx);
}

// ---- Derived evaluation reality (UX §4.3 — computed at render, NEVER stored) -----------------------

export interface LiveCoverage {
  /** The ticker THIS page's existing stream covers (uppercased by the caller or here). */
  ticker: string;
  mid: number | null;
  isLive: boolean;
  streamOffline: boolean;
}

/** Derive the honest-coverage sub-state for a non-terminal order. Terminal ⇒ null (nothing is
 *  being evaluated). Never suppressible on a non-terminal row (D8-3, AC-25). */
export function deriveEval(order: SimOrder, coverage: LiveCoverage | null): OrderEvalState | null {
  if (isTerminal(order.status)) return null;
  const covered = coverage != null && coverage.ticker.toUpperCase() === order.ticker.toUpperCase();
  if (covered && coverage.isLive && !coverage.streamOffline) {
    return { kind: 'watching', mid: coverage.mid };
  }
  if (covered && coverage.streamOffline) {
    // Live cells dim + keep the last-known value; the row persists (AC-26).
    return { kind: 'offline', lastMid: coverage.mid };
  }
  return { kind: 'not_evaluated' };
}

// ---- The hook --------------------------------------------------------------------------------------

export interface OrdersApi {
  orders: SimOrder[];
  faulted: boolean;
  create: (input: CreateOrderInput, ctx?: DecisionCtx) => CreateOrderResult;
  cancel: (id: string, ctx?: DecisionCtx) => void;
  exportPayload: () => OrdersExport;
}

/** The store brain: a live view over the external orders store (all mounted instances stay in
 *  sync via the store subscription) + a render-time expiry sweep. */
export function useOrders(): OrdersApi {
  const version = useSyncExternalStore(subscribeOrders, getOrdersVersion, getOrdersVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orders = useMemo(() => allOrders(), [version]);
  const faulted = ordersFaulted();

  // Render-time expiry sweep (AC-21): reads/renders apply the wall-clock transition. Re-running on
  // each version bump is safe — expired orders are terminal, so the sweep converges (no loop).
  useEffect(() => {
    sweepExpiredOrders();
  }, [version]);

  const create = useCallback(
    (input: CreateOrderInput, ctx?: DecisionCtx) => createOrder(input, ctx),
    [],
  );
  const cancel = useCallback((id: string, ctx?: DecisionCtx) => cancelOrder(id, ctx), []);
  const exportPayload = useCallback(() => buildOrdersExport(allDecisions()), []);

  return { orders, faulted, create, cancel, exportPayload };
}
