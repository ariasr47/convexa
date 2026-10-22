/**
 * Per-CONTRACT tracked-contract fetch, de-duplicated across the whole open/pending book.
 * One contract's 404 marks ONLY the legs that reference it (SPEC §2.5).
 */
import { fetchTrackedContract, type OptionRight, type TrackedContract } from '@convexa/api';
import { useEffect, useMemo, useState } from 'react';
import { legContractKey } from './composeMark';
import type { Leg, SimPosition } from './leg';
import { useMarkFeed } from './markFeed';

/** One CONTRACT's per-cycle lookup result, shared by every leg that references it. */
export interface ContractLive {
  tracked: TrackedContract | null;
  unavailable: boolean;
}

/**
 * The shared core: one lookup per DISTINCT option contract across `legs`, keyed by
 * `legContractKey`. Used by the sim book (`useContractLive`) and the broker book
 * (`useBrokerMarks`), so both fetch on the same terms. `legs` is the memoized leg list; the
 * contract set is rebuilt only when its identity changes.
 */
export function useContractLiveForLegs(
  legs: readonly Leg[],
  servedAt: string | undefined,
): Record<string, ContractLive> {
  const [contractLive, setContractLive] = useState<Record<string, ContractLive>>({});
  // With no options feed on this site the contract route can only refuse: never ask it. Every
  // option mark then reads "Mark not live" (markFeed.tsx), the same answer a refused lookup gives.
  const skip = useMarkFeed() === 'notLive';

  const contractKeys = useMemo(() => {
    const keys = new Map<
      string,
      { ticker: string; expiration: string; strike: number; right: OptionRight }
    >();
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
    return keys;
  }, [legs]);
  const trackKey = [...contractKeys.keys()].toSorted().join(',');

  useEffect(() => {
    if (skip) return;
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
    // Re-fetch when the contract SET or the served bundle changes, never from this effect's own
    // writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, servedAt, skip]);

  return contractLive;
}

/** The sim book's lookups: the legs of every OPEN or PENDING position. */
export function useContractLive(
  simPositions: SimPosition[],
  servedAt: string | undefined,
): Record<string, ContractLive> {
  const legs = useMemo(
    () =>
      simPositions
        .filter((p) => p.status === 'open' || p.status === 'pending')
        .flatMap((p) => p.legs),
    [simPositions],
  );
  return useContractLiveForLegs(legs, servedAt);
}
