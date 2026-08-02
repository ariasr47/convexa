/**
 * useBrokerMarks — the market-data axis for broker rows: per-CONTRACT tracked-contract fetch
 * (de-duplicated across the book) + the EXISTING per-leg mark ladder (`computeMark`, untouched),
 * mirroring `usePortfolio`'s resolver exactly so a broker leg and a sim leg with the same
 * contract price identically (same math, no new math — the owner's P/L ruling).
 *
 * Isolation: consumes ONLY `@org/api` (`fetchTrackedContract`) and the model ladder. Never the
 * positions store, never a durable key, never SSE directly (the page's stream props arrive as
 * arguments — broker data itself NEVER rides SSE).
 */
import { computeMark, type MarkResult } from '@/features/trading/model/mark';
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

  const m = data?.market_state;
  const session = live?.market_session ?? null;

  const legMarkFor = useCallback(
    (l: Leg): MarkResult | null => {
      if (!m) return null;
      // Equity bypasses the ladder (the usePortfolio rule, verbatim): live underlying mid, and a
      // stream drop keeps a dimmed-but-PRESENT number — never a blank.
      if (l.kind === 'equity') {
        if (streamOffline) {
          return {
            mark: lastMarkRef.current.get(l.id) ?? m.price,
            basis: 'last_known',
            frozen: false,
          };
        }
        const closed = session === 'overnight' || session === 'closed';
        return {
          mark: isLive ? (live?.mid ?? m.price) : m.price,
          basis: 'snapshot',
          frozen: closed && !isLive,
        };
      }
      const key = legContractKey(l);
      if (key == null) return null;
      const cl = contractLive[key];
      if (!cl || !cl.tracked) return null;
      return computeMark({
        tracked: cl.tracked,
        strike: l.strike as number,
        right: l.right as OptionRight,
        anchorSpot: m.price,
        liveUnderlying: live?.mid ?? null,
        isLive,
        marketSession: session,
        streamOffline,
        lastMark: lastMarkRef.current.get(l.id) ?? null,
      });
    },
    [contractLive, m, live?.mid, isLive, session, streamOffline],
  );

  const legMarksOf = useCallback(
    (bp: BrokerPosition): Map<string, MarkResult | null> => {
      const legs = legsById.get(bp.broker_position_id) ?? [];
      const out = new Map<string, MarkResult | null>();
      for (const l of legs) {
        const res = legMarkFor(l);
        out.set(l.id, res);
        // Keep the last GOOD mark for ⏸ last-known (fresh, resolved bases only).
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
