/**
 * useOrderEngine — the evaluation hook (arch §5). Mounts on the Ticker page (its ticker's EXISTING
 * SSE) and the Positions page (its focused ticker's EXISTING SSE). It opens NO EventSource of its
 * own and adds NO param to any bundle/SSE request (AC-44) — it consumes the live payload the host
 * page already holds.
 *
 *  - Trigger input: the live underlying `mid` ONLY (via `tickFromLive`, which structurally drops
 *    `last_trade` — §5 canon).
 *  - Fill input: the option mark through the EXISTING `computeMark` ladder, accepted ONLY live —
 *    not frozen, not last_known, `isLive && !streamOffline` (AC-16/17/28).
 *  - Per-order contract lookups via the EXISTING `GET /api/contract`; a single order's lookup
 *    failure degrades only that order's fill leg (per-row isolation, arch §9).
 *  - Per-tick isolation: an evaluation-tick throw is caught per order per tick.
 *  - No retro-fill: evaluation runs only on new live payloads; on (re)open it starts from the next
 *    payload (AC-27). Clock expiry is swept on every tick too (the only off-stream transition).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  fetchTrackedContract, TickerBundle, LiveUpdate, TrackedContract,
} from '@org/api';
import { computeMark } from '../ghost-trade/mark';
import { allOrders, subscribeOrders, getOrdersVersion } from './store';
import { evaluateAndApply, sweepExpiredOrders, DecisionCtx } from './useOrders';
import { tickFromLive } from './engine';
import type { SimOrder } from './types';

export interface OrderEngineInputs {
  /** The ticker the HOST page's existing stream covers. */
  ticker: string;
  /** The host page's polled bundle (anchor spot for the mark ladder). Best-effort — null degrades
   *  the fill leg only. */
  bundle: TickerBundle | null;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
}

/** Resolve a LIVE option mark for one order, or null (unavailable / frozen / last_known / not
 *  live). Uses the existing computeMark ladder — a "modeled" mark off the live underlying counts
 *  as live, identical to the shipped resting-limit rule. */
function liveOptionMark(
  order: SimOrder,
  tracked: TrackedContract | null | undefined,
  bundle: TickerBundle | null,
  live: LiveUpdate | null,
  isLive: boolean,
  streamOffline: boolean,
): number | null {
  if (!tracked || !bundle || !isLive || streamOffline) return null;
  const res = computeMark({
    tracked,
    strike: order.strike,
    right: order.right,
    anchorSpot: bundle.market_state.price,
    liveUnderlying: live?.mid ?? null,
    isLive,
    marketSession: live?.market_session ?? null,
    streamOffline,
    lastMark: null,
  });
  if (res.frozen || res.basis === 'last_known' || res.mark == null) return null;
  return res.mark;
}

export function useOrderEngine({ ticker, bundle, live, isLive, streamOffline }: OrderEngineInputs): void {
  const version = useSyncExternalStore(subscribeOrders, getOrdersVersion, getOrdersVersion);
  const symbol = ticker.toUpperCase();

  // Active (non-terminal) orders for THIS page's covered ticker. `version` is the external-store
  // read key (allOrders() re-derives when it bumps) — eslint can't see through the store read.
  const active = useMemo(
    () => allOrders().filter(
      (o) => o.ticker === symbol && (o.status === 'waiting' || o.status === 'triggered'),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, symbol],
  );
  const activeKey = active.map((o) => o.id).join(',');

  // Per-order tracked-contract stats (the fill leg's input). Refetched on the bundle cadence.
  const [tracked, setTracked] = useState<Record<string, TrackedContract | null>>({});
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  const servedAt = bundle?.meta.served_at;

  useEffect(() => {
    let cancelled = false;
    active.forEach((o) => {
      fetchTrackedContract(o.ticker, { expiration: o.expiration, strike: o.strike, right: o.right })
        .then((tc) => {
          if (!cancelled) setTracked((prev) => ({ ...prev, [o.id]: tc }));
        })
        .catch(() => {
          // Per-row isolation: this order's fill leg degrades; triggers (mid-only) keep working.
          if (!cancelled) setTracked((prev) => ({ ...prev, [o.id]: null }));
        });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, servedAt]);

  // The evaluation tick: runs on each new live payload (and liveness flips). Nothing here runs on
  // a bundle poll alone — the bundle is never a trigger/fill input ([live-vs-static-isolation]).
  useEffect(() => {
    const now = Date.now();
    const ctx: DecisionCtx = {
      spot: live?.mid ?? bundle?.market_state.price ?? 0,
      tier: bundle?.signals.opportunity_tier ?? '',
    };
    // 1) Clock expiry — every order, any ticker (the only off-stream transition, AC-21).
    try { sweepExpiredOrders(now, ctx); } catch { /* isolated */ }
    // 2) Live evaluation for covered orders — re-read durable state, evaluate pure, apply RMW.
    for (const o of allOrders()) {
      if (o.ticker !== symbol || (o.status !== 'waiting' && o.status !== 'triggered')) continue;
      try {
        const mark = liveOptionMark(o, trackedRef.current[o.id], bundle, live, isLive, streamOffline);
        evaluateAndApply(o, tickFromLive(live, streamOffline, mark, now), ctx);
      } catch {
        /* per-tick isolation: one bad order/tick never kills the engine or the stream consumer */
      }
    }
    // NOTE: deliberately NOT keyed on the store version — a just-placed order is evaluated on the
    // NEXT live payload (D8-2: "will trigger on the first live update after you place it"), never
    // synchronously at placement off a payload that predates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, isLive, streamOffline, symbol]);
}
