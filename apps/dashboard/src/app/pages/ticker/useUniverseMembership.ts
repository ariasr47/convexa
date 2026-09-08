/**
 * useUniverseMembership — a SILENT, best-effort read of the scanner universe
 * (`GET /api/scan/universe`, an existing anonymous-open surface — INTERFACE: NO_BACKEND_CHANGE) so
 * the Ticker page can decide whether a symbol is in the tracked index/liquid set. Drives the
 * single-name caveat caption (index-first-defaults AC-4/AC-5) AND — ticker fidelity repair, change 3
 * (F3) — the masthead's `Universe member · N tracked names` note (`design/src/screens/desk.mjs:285`,
 * `quick-note`): it never touches the bundle/SSE path.
 *
 * `[absent-is-not-none]` (AC-5): membership is `'unknown'` — never `'nonmember'` — until a
 * WELL-FORMED, NON-EMPTY universe payload resolves. A transport fault, a garbled payload, or an
 * empty symbol list can never be evidence that a name is thin. Failure is silent (no toast, no
 * error surface, no retry loop); the only consumer effect is that the caption does not render. The
 * SAME discipline extends to `size` (F3): a failed/garbled read leaves it `null`, never a fabricated
 * `0` — "N tracked names" never renders with an invented N.
 *
 * `size` is the backend's OWN count (`ScanUniverse.universe_size`), never `symbols.length` — the
 * wire's own authoritative total, not a derived one (the two happen to agree in the fixtures this
 * repo ships, but the wire field is the traced one).
 *
 * One fetch per page mount (the read is tiny and the page keeps its instance across in-page symbol
 * changes); membership re-derives per symbol from the resolved set.
 */
import { getScanUniverse } from '@convexa/api';
import { useEffect, useState } from 'react';

export type UniverseMembership = 'member' | 'nonmember' | 'unknown';

export interface UniverseInfo {
  membership: UniverseMembership;
  /** `ScanUniverse.universe_size` once a well-formed, non-empty read resolves; `null` while
   *  unresolved/failed/garbled (AC-5, extended). */
  size: number | null;
}

export function useUniverseMembership(symbol: string): UniverseInfo {
  const [universe, setUniverse] = useState<ReadonlySet<string> | null>(null);
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getScanUniverse()
      .then((u) => {
        if (!alive) return;
        const symbols = Array.isArray(u?.symbols)
          ? u.symbols.filter((s): s is string => typeof s === 'string')
          : [];
        // An empty/garbled list cannot support a "not in the universe" claim — stay 'unknown'.
        if (symbols.length > 0) {
          setUniverse(new Set(symbols.map((s) => s.toUpperCase())));
          setSize(typeof u?.universe_size === 'number' ? u.universe_size : null);
        }
      })
      .catch(() => {
        /* best-effort + silent — membership stays 'unknown' (AC-5) */
      });
    return () => {
      alive = false;
    };
  }, []);

  const membership: UniverseMembership =
    universe == null ? 'unknown' : universe.has(symbol.toUpperCase()) ? 'member' : 'nonmember';
  return { membership, size };
}
