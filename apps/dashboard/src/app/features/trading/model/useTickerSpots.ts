/**
 * `useTickerSpots` — the per-UNDERLYING spot fan-out that makes `resolveLegMark`'s R8 rule
 * satisfiable.
 *
 * A page is focused on ONE ticker: it holds that ticker's bundle and that ticker's SSE. A book is
 * not — the owner's real Webull book spans ten underlyings, and the sim book can too. Before R8
 * every equity leg was priced off the focused bundle regardless of its own symbol. Pricing a leg
 * off its own underlying needs that underlying's spot, so this hook fans out per DISTINCT ticker
 * exactly the way the per-CONTRACT `fetchTrackedContract` fan-out already does: one lookup per
 * distinct symbol, de-duplicated across the whole book, re-armed on the same `key`/`servedAt`
 * dependency shape, best-effort per symbol (one ticker's failure marks only its own legs).
 *
 * NO BACKEND CHANGE: `getTicker` is the existing endpoint the Positions page already calls for its
 * focused anchor bundle. The FOCUSED ticker is never re-fetched here — its spot comes from the
 * bundle already in hand, and it is the only ticker that can have a live mid, because it is the
 * only one with a stream open.
 *
 * A ticker that never resolves stays `null`, and `resolveLegMark` withholds. A ticker that resolved
 * ONCE keeps its last good spot across a later failed refresh — never blanked
 * (`[best-effort-isolated-or-null]`, `[live-vs-static-isolation]`).
 */
import { getTicker, type LiveUpdate, type TickerBundle } from '@convexa/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface TickerSpots {
  /**
   * THIS ticker's own spot: the focused bundle's price when it IS the focused ticker, else the
   * independently-fetched one. `null` when unresolved — NEVER another ticker's price.
   */
  spotOf: (ticker: string) => number | null;
  /** THIS ticker's live underlying mid. Only the focused (streamed) ticker ever has one. */
  liveUnderlyingOf: (ticker: string) => number | null;
  /** The focused symbol, upper-cased — exposed for assertions and debugging, not for pricing. */
  focused: string | null;
}

const up = (t: string | null | undefined): string => (t ?? '').toUpperCase();

export function useTickerSpots(
  /** Every distinct underlying the caller needs a spot for (case-insensitive; de-duplicated here). */
  tickers: readonly string[],
  bundle: TickerBundle | null,
  live: LiveUpdate | null,
  /** Used only until the bundle lands; `market_state.ticker` is authoritative once it has. */
  focusedFallback?: string | null,
): TickerSpots {
  const [spots, setSpots] = useState<Record<string, number>>({});

  const focused = up(bundle?.market_state?.ticker ?? focusedFallback) || null;
  const focusedSpot = bundle?.market_state?.price ?? null;
  const servedAt = bundle?.meta?.served_at;

  // The de-duplicated FOREIGN set, as one sorted string — the `trackKey` shape the contract fan-out
  // uses, so this effect re-arms on exactly the same terms and never from its own writes.
  const spotKey = useMemo(
    () =>
      [...new Set(tickers.map(up).filter((t) => t !== '' && t !== focused))].toSorted().join(','),
    [tickers, focused],
  );
  const foreign = useMemo(() => (spotKey === '' ? [] : spotKey.split(',')), [spotKey]);

  useEffect(() => {
    let cancelled = false;
    for (const t of foreign) {
      getTicker(t)
        .then((d) => {
          if (cancelled) return;
          const price = d?.market_state?.price;
          if (typeof price === 'number') setSpots((prev) => ({ ...prev, [t]: price }));
        })
        .catch(() => {
          // Per-ticker isolation, best-effort: a failed lookup marks ONLY this symbol's legs. A
          // previously-resolved spot is KEPT (a failed refresh never blanks a loaded read); one
          // that never resolved stays absent, and its legs withhold rather than borrow a price.
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotKey, servedAt]);

  const spotOf = useCallback(
    (ticker: string): number | null => {
      const t = up(ticker);
      if (t === '') return null;
      if (focused != null && t === focused) return focusedSpot;
      return spots[t] ?? null;
    },
    [focused, focusedSpot, spots],
  );

  const liveMid = live?.mid ?? null;
  const liveUnderlyingOf = useCallback(
    (ticker: string): number | null => (focused != null && up(ticker) === focused ? liveMid : null),
    [focused, liveMid],
  );

  return useMemo(
    () => ({ spotOf, liveUnderlyingOf, focused }),
    [spotOf, liveUnderlyingOf, focused],
  );
}
