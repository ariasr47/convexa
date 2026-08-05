/**
 * useBrokerMarks — the market-data axis for broker rows: per-CONTRACT tracked-contract fetch
 * (de-duplicated across the book) + per-UNDERLYING spot fan-out + the EXISTING per-leg mark ladder,
 * run through the SHARED `resolveLegMark` so a broker leg and a sim leg with the same contract
 * price identically (same math, no new math — the owner's P/L ruling).
 *
 * That identity used to rest on this file holding a byte-identical COPY of `usePortfolio`'s
 * resolver. R8 proved a copy is not an invariant: the same cross-ticker equity bug lived in both,
 * and fixing one alone would have broken the identity the copy existed to guarantee. The resolver
 * now lives in `model/legMark.ts` and both hooks call it.
 *
 * Isolation: consumes ONLY `@org/api` (`fetchTrackedContract`, `getTicker` via `useTickerSpots`)
 * and the model ladder. Never the positions store, never a durable key, never SSE directly (the
 * page's stream props arrive as arguments — broker data itself NEVER rides SSE).
 */
import { resolveLegMark } from '@/features/trading/model/legMark';
import { type MarkResult } from '@/features/trading/model/mark';
import { useTickerSpots } from '@/features/trading/model/useTickerSpots';
import { legContractKey } from '@/features/trading/positions/composeMark';
import type { Leg } from '@/features/trading/positions/leg';
import {
  fetchTrackedContract,
  type BrokerPosition,
  type LiveUpdate,
  type OptionRight,
  type TickerBundle,
  type TrackedContract,
} from '@org/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { brokerLegsOf } from './brokerView';

interface ContractLive {
  tracked: TrackedContract | null;
  unavailable: boolean;
}

export interface BrokerMarksApi {
  /** Per-leg mark map for ONE broker position (keyed by the stable broker leg ids). */
  legMarksOf: (bp: BrokerPosition) => Map<string, MarkResult | null>;
  /** Nearest resolvable DTE across the position's option legs. */
  dteOf: (bp: BrokerPosition) => number | null;
}

export function useBrokerMarks(
  positions: readonly BrokerPosition[],
  data: TickerBundle | null,
  live: LiveUpdate | null,
  isLive: boolean,
  streamOffline: boolean,
): BrokerMarksApi {
  const [contractLive, setContractLive] = useState<Record<string, ContractLive>>({});
  /** Last good mark per broker leg id — what ⏸ last-known renders on a stream drop. */
  const lastMarkRef = useRef<Map<string, number>>(new Map());

  // Mapped legs per position, memoized on the book identity.
  const legsById = useMemo(() => {
    const out = new Map<string, Leg[]>();
    for (const bp of positions) out.set(bp.broker_position_id, brokerLegsOf(bp));
    return out;
  }, [positions]);

  // Distinct contracts across the WHOLE book (the usePortfolio de-duplication rule).
  const contractKeys = useMemo(() => {
    const keys = new Map<
      string,
      { ticker: string; expiration: string; strike: number; right: OptionRight }
    >();
    for (const legs of legsById.values()) {
      for (const l of legs) {
        const key = legContractKey(l);
        if (key && !keys.has(key)) {
          keys.set(key, {
            ticker: l.ticker,
            expiration: l.expiration as string,
            strike: l.strike as number,
            right: l.right as OptionRight,
          });
        }
      }
    }
    return keys;
  }, [legsById]);
  const trackKey = [...contractKeys.keys()].sort().join(',');
  const servedAt = data?.meta.served_at;

  useEffect(() => {
    let cancelled = false;
    contractKeys.forEach((c, key) => {
      fetchTrackedContract(c.ticker, {
        expiration: c.expiration,
        strike: c.strike,
        right: c.right,
      })
        .then((tc) => {
          if (cancelled) return;
          setContractLive((prev) => ({ ...prev, [key]: { tracked: tc, unavailable: tc == null } }));
        })
        .catch(() => {
          if (cancelled) return;
          // Per-contract isolation: one lookup's fault marks ONLY the legs referencing it.
          setContractLive((prev) => ({ ...prev, [key]: { tracked: null, unavailable: true } }));
        });
    });
    return () => {
      cancelled = true;
    };
    // The shipped usePortfolio dependency shape: re-fetch when the contract SET or the served
    // bundle changes, never from this effect's own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, servedAt]);

  const session = live?.market_session ?? null;

  // Per-UNDERLYING spot fan-out (R8). The real Webull book spans ten underlyings while the page
  // holds ONE bundle and ONE stream — so every distinct symbol gets its own spot, and a leg is
  // never priced off whichever ticker is on screen.
  const legTickers = useMemo(() => {
    const set = new Set<string>();
    for (const legs of legsById.values())
      for (const l of legs) if (l.ticker) set.add(l.ticker.toUpperCase());
    return [...set];
  }, [legsById]);
  const spots = useTickerSpots(legTickers, data, live);

  const legMarkFor = useCallback(
    (l: Leg): MarkResult | null => {
      const key = l.kind === 'option' ? legContractKey(l) : null;
      return resolveLegMark({
        leg: l,
        spot: spots.spotOf(l.ticker),
        liveUnderlying: spots.liveUnderlyingOf(l.ticker),
        isLive,
        marketSession: session,
        streamOffline,
        lastMark: lastMarkRef.current.get(l.id) ?? null,
        tracked: key != null ? (contractLive[key]?.tracked ?? null) : null,
      });
    },
    [contractLive, spots, isLive, session, streamOffline],
  );

  const legMarksOf = useCallback(
    (bp: BrokerPosition): Map<string, MarkResult | null> => {
      const legs = legsById.get(bp.broker_position_id) ?? [];
      const out = new Map<string, MarkResult | null>();
      for (const l of legs) {
        const res = legMarkFor(l);
        out.set(l.id, res);
        // Keep the last GOOD mark for ⏸ last-known (fresh, resolved bases only). The per-ticker
        // correction sits INSIDE `legMarkFor`, i.e. strictly BEFORE this write — otherwise a
        // session that once wrote a foreign price would keep serving it from the cache under ⏸
        // until a reload (R8).
        if (res?.mark != null && res.basis !== 'last_known' && !res.frozen) {
          lastMarkRef.current.set(l.id, res.mark);
        }
      }
      return out;
    },
    [legsById, legMarkFor],
  );

  const dteOf = useCallback(
    (bp: BrokerPosition): number | null => {
      let best: number | null = null;
      for (const l of legsById.get(bp.broker_position_id) ?? []) {
        const key = legContractKey(l);
        const dte = key ? (contractLive[key]?.tracked?.dte ?? null) : null;
        if (dte != null && (best == null || dte < best)) best = dte;
      }
      return best;
    },
    [legsById, contractLive],
  );

  return { legMarksOf, dteOf };
}
