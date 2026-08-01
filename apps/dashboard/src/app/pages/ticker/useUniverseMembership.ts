/**
 * useUniverseMembership — a SILENT, best-effort read of the scanner universe
 * (`GET /api/scan/universe`, an existing anonymous-open surface — INTERFACE: NO_BACKEND_CHANGE) so
 * the Ticker page can decide whether a symbol is in the tracked index/liquid set. Drives ONLY the
 * single-name caveat caption (index-first-defaults AC-4/AC-5); it never touches the bundle/SSE path.
 *
 * `[absent-is-not-none]` (AC-5): membership is `'unknown'` — never `'nonmember'` — until a
 * WELL-FORMED, NON-EMPTY universe payload resolves. A transport fault, a garbled payload, or an
 * empty symbol list can never be evidence that a name is thin. Failure is silent (no toast, no
 * error surface, no retry loop); the only consumer effect is that the caption does not render.
 *
 * One fetch per page mount (the read is tiny and the page keeps its instance across in-page symbol
 * changes); membership re-derives per symbol from the resolved set.
 */
import { getScanUniverse } from '@org/api';
import { useEffect, useState } from 'react';

export type UniverseMembership = 'member' | 'nonmember' | 'unknown';

export function useUniverseMembership(symbol: string): UniverseMembership {
  const [universe, setUniverse] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let alive = true;
    getScanUniverse()
      .then((u) => {
        if (!alive) return;
        const symbols = Array.isArray(u?.symbols)
          ? u.symbols.filter((s): s is string => typeof s === 'string')
          : [];
        // An empty/garbled list cannot support a "not in the universe" claim — stay 'unknown'.
        if (symbols.length > 0) setUniverse(new Set(symbols.map((s) => s.toUpperCase())));
      })
      .catch(() => {
        /* best-effort + silent — membership stays 'unknown' (AC-5) */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (universe == null) return 'unknown';
  return universe.has(symbol.toUpperCase()) ? 'member' : 'nonmember';
}
