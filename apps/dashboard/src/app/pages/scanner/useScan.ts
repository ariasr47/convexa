/**
 * useScan — the `/scanner` page's ONE data owner and its ONLY fetcher.
 *
 * POLLED for STRUCTURE (`[live-vs-static-isolation]`): a single `GET /api/scan` on a stable
 * `SCAN_POLL_MS` interval carries score, tier, flip and walls — everything chain-derived, which the
 * sweep owns and which cannot be live. The cadence the page STATES in its header is the cadence this
 * constant sets.
 *
 * PRICES ARE LIVE as of 2026-08-06 and are NOT this hook's business — `useLivePrices` overlays them
 * from one shared SSE connection. Two data ages on one row, each labelled as what it is. Do not
 * fetch a price here: a price arriving on the poll would silently fight the live one.
 *
 * The interval is created once; the hidden-tab gate is read from a REF at fire time, so visibility
 * flapping or a StrictMode double-invoke can never add a second interval or burst the backend (the
 * `pages/operator-metrics/useLatencyTrend.ts` precedent). Becoming visible again triggers ONE
 * immediate refresh so an ambient radar is never silently stale.
 *
 * Degradation is best-effort: a failed poll KEEPS the last-known rows and flips `degraded` — the
 * table never blanks, never throws into the trader path.
 *
 * The view SAVE is the one gated, state-bearing action (`[server-side-gate-enforcement]`).
 * `saveScanView` IS the server gate (`PUT /api/scan/view` answers a real 403 signed-out), which is
 * useGate's documented "fn carries the enforcement" case — so no separate `opts.serverGate` is
 * passed. Signed out ⇒ `guard` shows the prompt and never runs the write. A 403 from a stale cookie
 * ⇒ the thrown `AuthError` aborts before `setSnapshot`, so NOTHING is written locally. This hook
 * writes no localStorage and owns no durable store — the server is the boundary of record.
 */
import { useGate, type GateApi } from '@/features/auth/useGate';
import {
  AuthError,
  getScan,
  saveScanView,
  type ScanDensity,
  type ScanRow,
  type ScanView,
  type ScanViewSort,
  type ScanViewWrite,
  type SweepHeartbeat,
} from '@org/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sortRows, sweepBanner } from './format';
import { SCAN_COPY } from './labels';

/** Matches the worker's FAST lane (~30s prices, D4) and the header's stated basis. */
export const SCAN_POLL_MS = 30_000;
/** Display-clock tick for the relative "Updated …" / "Sweep last ran …" strings. Presentational
 *  only — it issues no network and never changes a value, just how old we say it is. */
export const SCAN_CLOCK_MS = 5_000;

export const DEFAULT_SORT: ScanViewSort = { key: 'score', dir: 'desc' };

interface Snapshot {
  phase: 'loading' | 'ready';
  rows: ScanRow[];
  view: ScanView | null;
  sweep: SweepHeartbeat | null;
  degraded: boolean;
}

export interface ScanApi {
  /** `loading` ⇒ the FIRST read is still in flight ⇒ the skeleton. Never re-entered after the first
   *  resolution: a later failed poll degrades, it does not re-skeleton. */
  phase: 'loading' | 'ready';
  /** The rows in DISPLAY order (client-side sorted; never refetched to sort). */
  rows: ScanRow[];
  view: ScanView | null;
  sweep: SweepHeartbeat | null;
  degraded: boolean;
  /** Wall clock in epoch-SECONDS, ticking at SCAN_CLOCK_MS — the basis for every relative age. */
  nowS: number;
  sort: ScanViewSort;
  density: ScanDensity;
  setSort: (sort: ScanViewSort) => void;
  setDensity: (density: ScanDensity) => void;
  workerDown: boolean;
  workerDownText: string;
  isEmptyView: boolean;
  gate: GateApi;
  saveError: string | null;
  refresh: () => Promise<void>;
  /** Resolves `true` only when the SERVER echoed a saved view. `false` covers every refusal
   *  (signed-out FE gate, a real 403, a 422) — the caller keeps the editor open on `false`. */
  saveView: (draft: ScanViewWrite) => Promise<boolean>;
}

export function useScan(): ScanApi {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    phase: 'loading',
    rows: [],
    view: null,
    sweep: null,
    degraded: false,
  }));
  const [sortDraft, setSortDraft] = useState<ScanViewSort | null>(null);
  const [densityDraft, setDensityDraft] = useState<ScanDensity | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);
  const gate = useGate();

  const refresh = useCallback(async () => {
    try {
      const res = await getScan();
      setSnapshot({
        phase: 'ready',
        rows: res.rows,
        view: res.view,
        sweep: res.sweep,
        degraded: false,
      });
    } catch {
      // Best-effort: keep whatever we already showed. A transport fault must never blank the table
      // or surface an error screen — the honest states live in the rows + the banner.
      setSnapshot((prev) => ({ ...prev, phase: 'ready', degraded: true }));
    }
  }, []);

  // --- the poll loop: ONE interval, gate read from a ref at fire time -----------------------------
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const hiddenRef = useRef(false);
  useEffect(() => {
    hiddenRef.current = typeof document !== 'undefined' && document.hidden;
    const onVisibility = () => {
      const wasHidden = hiddenRef.current;
      hiddenRef.current = document.hidden;
      if (wasHidden && !document.hidden) void refreshRef.current(); // resume ⇒ refresh at once
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    let active = true;
    void refreshRef.current(); // the first read paints the page, hidden or not
    const id = setInterval(() => {
      if (active && !hiddenRef.current) void refreshRef.current();
    }, SCAN_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // --- the display clock (no network) -------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => setNowS(Date.now() / 1000), SCAN_CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  // --- derived during render, never in an effect --------------------------------------------------
  const sort = sortDraft ?? snapshot.view?.sort ?? DEFAULT_SORT;
  const density = densityDraft ?? snapshot.view?.density ?? 'compact';
  const rows = useMemo(() => sortRows(snapshot.rows, sort), [snapshot.rows, sort]);
  const banner = useMemo(() => sweepBanner(snapshot.sweep, nowS), [snapshot.sweep, nowS]);

  const saveView = useCallback(
    async (draft: ScanViewWrite): Promise<boolean> => {
      setSaveError(null);
      let saved = false;
      try {
        await gate.guard(SCAN_COPY.signInToCustomize, async () => {
          // The SERVER call IS the gate. Signed out, `guard` never reaches this line; with a stale
          // cookie the 403 throws here, so `setSnapshot` below never runs — nothing is persisted
          // and nothing is written locally.
          const echo = await saveScanView(draft);
          setSnapshot((prev) => ({ ...prev, view: echo })); // server-wins echo
          setSortDraft(null);
          setDensityDraft(null);
          saved = true;
          await refreshRef.current(); // re-read rows for the new symbol set
        });
      } catch (err) {
        // `guard` handles auth_required / auth_unavailable itself and re-throws everything else —
        // a 422 arrives here as AuthError('validation') carrying the server's `detail`.
        setSaveError(err instanceof AuthError ? err.message : SCAN_COPY.saveFailed);
        saved = false;
      }
      return saved;
    },
    [gate],
  );

  return {
    phase: snapshot.phase,
    rows,
    view: snapshot.view,
    sweep: snapshot.sweep,
    degraded: snapshot.degraded,
    nowS,
    sort,
    density,
    setSort: setSortDraft,
    setDensity: setDensityDraft,
    workerDown: banner.engaged,
    workerDownText: banner.text,
    isEmptyView: snapshot.phase === 'ready' && (snapshot.view?.symbols.length ?? 0) === 0,
    gate,
    saveError,
    refresh,
    saveView,
  };
}
