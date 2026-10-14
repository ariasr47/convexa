/**
 * `usePaletteScan` — the palette's ONE-SHOT ranked read (SPEC §2.6). Shaped after the shipped
 * precedent rather than re-derived: `pages/scanner/useScan.ts`'s `phase: 'loading' | 'ready'`,
 * where `loading` means the FIRST read is still in flight and is NEVER re-entered — a later failed
 * read DEGRADES (`unavailable: true`), it does not re-skeleton.
 *
 * `getScan()` rejects only on a TRANSPORT fault — the server is best-effort always-200 (a store
 * outage degrades CONTENT, never the HTTP status) — so a rejection here is exactly AC-30's
 * unavailable arm. `useScan` on `/scanner` stays the page's one data owner and only fetcher; this
 * hook adds NO poll and NO ambient traffic — one `getScan()` call per palette OPEN, cached for the
 * dialog's lifetime (a fresh open re-fetches; this hook's own instance is torn down on close since
 * the palette does not `keepMounted`).
 *
 * The ranked read needs the options feed. On a live build whose feed is off (/api/health says
 * `not_live` or `paused`) the scan store holds only an old copy, so the hook doesn't read it at all
 * and reports `off`: the palette says ranked symbols need the feed instead of showing stale rows.
 */
import { marketDataOff } from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { dataMode, getScan, type ScanRow, type SweepHeartbeat } from '@convexa/api';
import { useEffect, useRef, useState } from 'react';

export interface PaletteScan {
  /** `loading` ⇒ the FIRST read is still in flight ⇒ skeleton rows. NEVER re-entered after the
   *  first resolution (§2.6, `useScan.ts:76-78` precedent). */
  phase: 'loading' | 'ready';
  rows: ScanRow[];
  sweep: SweepHeartbeat | null;
  /** `getScan()` rejected (a transport/proxy fault — the server itself is always-200). */
  unavailable: boolean;
  /** The options feed is off on this site, so no ranked read was made. */
  off: boolean;
}

/** `active` gates the fetch — pass the dialog's own `open` state so no read fires before the
 *  palette is actually opened, and no SECOND read fires on a re-render while already open. */
export function usePaletteScan(active: boolean): PaletteScan {
  const [state, setState] = useState<PaletteScan>({
    phase: 'loading',
    rows: [],
    sweep: null,
    unavailable: false,
    off: false,
  });
  const firedRef = useRef(false);
  // Demo builds read their own sample scan; a live build waits for the health read first.
  const mode = useMarketDataMode();
  const feed =
    dataMode === 'demo' ? 'on' : mode === null ? 'pending' : marketDataOff(mode) ? 'off' : 'on';

  useEffect(() => {
    if (!active || firedRef.current || feed === 'pending') return;
    firedRef.current = true;
    if (feed === 'off') {
      setState({ phase: 'ready', rows: [], sweep: null, unavailable: false, off: true });
      return;
    }
    firedRef.current = true;
    let cancelled = false;
    getScan()
      .then((res) => {
        if (cancelled) return;
        setState({
          phase: 'ready',
          rows: res.rows,
          sweep: res.sweep,
          unavailable: false,
          off: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // The ONE-SHOT read never re-enters loading — it degrades to the honest unavailable arm.
        setState((prev) => ({ ...prev, phase: 'ready', unavailable: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [active, feed]);

  // Reset the one-shot latch when the palette closes, so the NEXT open fires a fresh read (a
  // stale cached read from three opens ago is not honest either).
  useEffect(() => {
    if (!active) {
      firedRef.current = false;
      setState({ phase: 'loading', rows: [], sweep: null, unavailable: false, off: false });
    }
  }, [active]);

  return state;
}
