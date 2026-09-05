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
 */
import { getScan, type ScanRow, type SweepHeartbeat } from '@convexa/api';
import { useEffect, useRef, useState } from 'react';

export interface PaletteScan {
  /** `loading` ⇒ the FIRST read is still in flight ⇒ skeleton rows. NEVER re-entered after the
   *  first resolution (§2.6, `useScan.ts:76-78` precedent). */
  phase: 'loading' | 'ready';
  rows: ScanRow[];
  sweep: SweepHeartbeat | null;
  /** `getScan()` rejected (a transport/proxy fault — the server itself is always-200). */
  unavailable: boolean;
}

/** `active` gates the fetch — pass the dialog's own `open` state so no read fires before the
 *  palette is actually opened, and no SECOND read fires on a re-render while already open. */
export function usePaletteScan(active: boolean): PaletteScan {
  const [state, setState] = useState<PaletteScan>({
    phase: 'loading',
    rows: [],
    sweep: null,
    unavailable: false,
  });
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active || firedRef.current) return;
    firedRef.current = true;
    let cancelled = false;
    getScan()
      .then((res) => {
        if (cancelled) return;
        setState({ phase: 'ready', rows: res.rows, sweep: res.sweep, unavailable: false });
      })
      .catch(() => {
        if (cancelled) return;
        // The ONE-SHOT read never re-enters loading — it degrades to the honest unavailable arm.
        setState((prev) => ({ ...prev, phase: 'ready', unavailable: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Reset the one-shot latch when the palette closes, so the NEXT open fires a fresh read (a
  // stale cached read from three opens ago is not honest either).
  useEffect(() => {
    if (!active) {
      firedRef.current = false;
      setState({ phase: 'loading', rows: [], sweep: null, unavailable: false });
    }
  }, [active]);

  return state;
}
