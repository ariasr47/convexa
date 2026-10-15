/**
 * Per-CONTRACT tracked-contract fetch, de-duplicated across the whole open/pending book.
 * One contract's 404 marks ONLY the legs that reference it (SPEC §2.5).
 */
import { fetchTrackedContract, type OptionRight, type TrackedContract } from '@convexa/api';
import { useEffect, useMemo, useState } from 'react';
import { legContractKey } from './composeMark';
import type { SimPosition } from './leg';
import { useMarkFeed } from './markFeed';

/** One CONTRACT's per-cycle lookup result, shared by every leg that references it. */
export interface ContractLive {
  tracked: TrackedContract | null;
  unavailable: boolean;
}

export function useContractLive(
  simPositions: SimPosition[],
  servedAt: string | undefined,
): Record<string, ContractLive> {
  const [contractLive, setContractLive] = useState<Record<string, ContractLive>>({});
  // With no options feed on this site the contract route can only refuse: never ask it. Every
  // option mark then reads "Mark not live" (markFeed.tsx).
  const skip = useMarkFeed() === 'notLive';

  const contractKeys = useMemo(() => {
    const keys = new Map<
      string,
      { ticker: string; expiration: string; strike: number; right: OptionRight }
    >();
    for (const p of simPositions) {
      if (p.status !== 'open' && p.status !== 'pending') continue;
      for (const l of p.legs) {
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
  }, [simPositions]);
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
          setContractLive((prev) => ({ ...prev, [key]: { tracked: null, unavailable: true } }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, servedAt, skip]);

  return contractLive;
}
