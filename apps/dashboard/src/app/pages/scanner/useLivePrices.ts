/**
 * useLivePrices — live prices for the rows on screen, over ONE SSE connection.
 *
 * The scanner's structure (score, tier, flip, walls) stays POLLED by `useScan` — it is chain-derived
 * and the sweep owns it. Only the price is live. Two data ages on one row, each labelled as what it
 * is (`[live-vs-static-isolation]`).
 *
 * ONE `EventSource` for every symbol, not one per row: `GET /api/stream/prices?symbols=…` fans out
 * server-side over a single shared vendor socket. Wiring rows to `/api/stream/{ticker}` instead
 * would build a `LiveSession` per row, each running an option-chain refresh loop — the cost this
 * whole design avoids.
 *
 * Degradation (`[best-effort-isolated-or-null]`): a dropped stream flips `offline` and the last
 * known prices are KEPT, dimmed by the caller. It never blanks a row and never throws — the polled
 * structure keeps rendering untouched. A symbol that never ticks simply has no live price, and the
 * row falls back to the swept one.
 *
 * Only symbols currently RENDERED are subscribed. Subscribing the whole universe would re-create,
 * in a new place, the overnight waste the market-hours gate exists to remove.
 */
import { useEffect, useRef, useState } from 'react';

/** A live price plus when it arrived, so the caller can age it honestly. */
export interface LivePrice {
  price: number;
  ts: number;
}

export interface LivePricesState {
  /** Symbol → latest live price. Absent symbol ⇒ no live tick yet; use the swept price. */
  prices: Record<string, LivePrice>;
  /** True when the stream is down. Prices stay readable; the caller dims them. */
  offline: boolean;
}

/** Watchdog: no payload and no heartbeat for this long ⇒ treat the stream as down. */
const SILENCE_MS = 45_000;

export function useLivePrices(symbols: string[]): LivePricesState {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [offline, setOffline] = useState(false);

  // The subscription key: sorted + joined so a re-render with the same symbols in a different order
  // does not tear the connection down and rebuild it.
  const key = [...new Set(symbols.map((s) => s.toUpperCase()))].toSorted().join(',');
  const lastSeen = useRef<number>(0);

  useEffect(() => {
    if (!key) {
      setOffline(false);
      return;
    }
    let es: EventSource | null = null;
    let watchdog: ReturnType<typeof setInterval> | null = null;

    try {
      es = new EventSource(`/api/stream/prices?symbols=${encodeURIComponent(key)}`);
    } catch {
      setOffline(true);
      return;
    }

    lastSeen.current = Date.now();

    es.onmessage = (e: MessageEvent) => {
      lastSeen.current = Date.now();
      setOffline(false);
      try {
        const payload = JSON.parse(e.data) as { prices?: Record<string, LivePrice> };
        if (!payload?.prices) return;
        // Merge, never replace: a payload carries only CHANGED symbols, so replacing would drop
        // every quiet symbol's last known price.
        setPrices((prev) => ({ ...prev, ...payload.prices }));
      } catch {
        /* a malformed frame is not worth a state change */
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; surface the gap without tearing anything down.
      setOffline(true);
    };

    watchdog = setInterval(() => {
      if (Date.now() - lastSeen.current > SILENCE_MS) setOffline(true);
    }, 5_000);

    return () => {
      if (watchdog) clearInterval(watchdog);
      es?.close();
    };
  }, [key]);

  return { prices, offline };
}
