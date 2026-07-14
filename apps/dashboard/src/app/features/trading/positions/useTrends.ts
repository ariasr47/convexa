/**
 * usePlTrends — bounded, ephemeral ring buffers of recent per-position (timestamp, P/L$) samples,
 * reusing the `useLatencyTrend` ring-buffer pattern (ARCHITECTURE_CONTRACT §3.2, reuse ledger §8):
 * bounded by count + age, append-on-refresh, a GAP = a break (never stitched/interpolated), cleared
 * on reload (ephemeral, live-derived). Also tracks the ephemeral SESSION ANCHOR per position (the
 * P/L$ at first observation this session) for the Session Δ.
 *
 * On an SSE drop the caller appends a `null` break sample so the sparkline shows a broken line; the
 * session delta freezes (no new sample); both clear on reload (the ref starts empty each mount).
 */
import { useCallback, useRef, useState } from 'react';

const COUNT_CAP = 240; // per-position hard memory bound
const AGE_MAX_MS = 60 * 60_000; // 60m retained

/** One sample. `pl == null` ⇒ a break (offline gap), never plotted as 0/interpolated. */
export interface PlSample {
  t: number;
  pl: number | null;
}

export interface TrendApi {
  /** Append a live P/L$ sample for a position (ignored when pl is null AND last was already a break). */
  record(id: string, pl: number): void;
  /** Append an explicit break (gap) for a position — used on SSE drop. */
  recordBreak(id: string): void;
  /** The bounded sample series for a position (oldest→newest). */
  series(id: string): PlSample[];
  /** The ephemeral session anchor P/L$ for a position (first observed this session), or null. */
  sessionAnchor(id: string): number | null;
}

export function usePlTrends(): TrendApi {
  const seriesRef = useRef<Map<string, PlSample[]>>(new Map());
  const anchorRef = useRef<Map<string, number>>(new Map());
  const [, setVersion] = useState(0);

  const push = useCallback((id: string, sample: PlSample) => {
    const arr = seriesRef.current.get(id) ?? [];
    // Collapse consecutive breaks (one gap marker is enough).
    if (sample.pl == null && arr.length && arr[arr.length - 1].pl == null) return;
    arr.push(sample);
    const cutoff = Date.now() - AGE_MAX_MS;
    let pruned = arr.filter((x) => x.t >= cutoff);
    if (pruned.length > COUNT_CAP) pruned = pruned.slice(pruned.length - COUNT_CAP);
    seriesRef.current.set(id, pruned);
    setVersion((v) => v + 1);
  }, []);

  const record = useCallback(
    (id: string, pl: number) => {
      if (!anchorRef.current.has(id)) anchorRef.current.set(id, pl); // session anchor = first observed
      push(id, { t: Date.now(), pl });
    },
    [push],
  );

  const recordBreak = useCallback(
    (id: string) => {
      push(id, { t: Date.now(), pl: null });
    },
    [push],
  );

  const series = useCallback((id: string): PlSample[] => seriesRef.current.get(id) ?? [], []);
  const sessionAnchor = useCallback(
    (id: string): number | null => anchorRef.current.get(id) ?? null,
    [],
  );

  return { record, recordBreak, series, sessionAnchor };
}
