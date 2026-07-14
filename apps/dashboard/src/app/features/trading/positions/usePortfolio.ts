/**
 * usePortfolio — the portfolio brain. Owns the durable flat positions collection, the per-row
 * tracked-contract fetch + honest mark/P-L (the EXISTING `computeMark`/`pl` run per row), the
 * resting-limit fill lifecycle (fills only on a LIVE cross at the limit price), the decision log,
 * the ephemeral per-position trend + session delta, and the durable customization/saved-view state.
 *
 * Everything is simulation-only — no code path places a real order (`[no-real-order-path]`). Positions
 * never feed signals/score/tier/fingerprint (`[additive-keeps-score-byte-identical]`). Per-row
 * failures + store failures degrade locally (`[best-effort-isolated-or-null]`). Live cells degrade on
 * an SSE drop while records/history/customization persist (`[live-vs-static-isolation]`).
 */
import {
  fetchTrackedContract,
  LiveUpdate,
  OptionRight,
  TickerBundle,
  TrackedContract,
} from '@org/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeMark, MarkResult, pl } from '@/features/trading/model/mark';
import { SCHEMA_VERSION as GT_SCHEMA } from '@/features/trading/model/types';
import { cloneConfig, configEqual } from './defaults';
import { DerivedRow, RowMetrics } from './derive';
import { LIMIT_FILL_BASIS, limitWouldFill, resolveManualFill } from './entry';
import {
  allPositions,
  appendDecision,
  decisionsForPosition,
  getCustomization,
  getPosition,
  newId,
  putCustomization,
  putPosition,
} from './store';
import {
  CustomizationState,
  DecisionRecord,
  EntryBasis,
  EntryMode,
  FilterState,
  PORTFOLIO_SCHEMA_VERSION,
  Position,
  PositionId,
  SavedView,
  strategyOf,
  ViewConfig,
} from './types';
import { usePlTrends } from './useTrends';

export interface OpenPositionInput {
  ticker: string;
  expiration: string;
  strike: number;
  right: OptionRight;
  qty: number;
  entryMode: EntryMode;
  /** manual: the typed price. market: ignored (resolved). limit: the limit price. */
  price?: number;
  limitPrice?: number;
  /** Pre-resolved fill (market mode) so the dialog's own fetch isn't repeated. */
  resolvedMark?: number;
  resolvedBasis?: EntryBasis;
  stop?: number | null;
  target?: number | null;
}

export interface OpenResult {
  ok: boolean;
  reason?: string;
  position?: Position;
}

/** One row's per-cycle live data (the contract lookup + computed mark/P-L). */
interface RowLive {
  tracked: TrackedContract | null;
  unavailable: boolean;
  markRes: MarkResult | null;
}

export function usePortfolio(
  focusedTicker: string,
  data: TickerBundle | null,
  live: LiveUpdate | null,
  isLive: boolean,
  streamOffline: boolean,
) {
  const [positions, setPositions] = useState<Position[]>(() => allPositions());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [custom, setCustom] = useState<CustomizationState>(() => getCustomization());
  const [rowLive, setRowLive] = useState<Record<PositionId, RowLive>>({});
  const lastMarkRef = useRef<Map<PositionId, number>>(new Map());
  const trends = usePlTrends();

  const refreshPositions = useCallback(() => setPositions(allPositions()), []);

  const m = data?.market_state;
  const session = live?.market_session ?? null;
  const tier = data?.signals.opportunity_tier ?? 'dormant';
  const servedAt = data?.meta.served_at;

  // ---- Per-row tracked-contract fetch (per-row isolation) -------------------------------------
  // Fetch the held contract's stats for every OPEN or PENDING position, on mount + each bundle
  // refresh. A single row's lookup failure marks ONLY that row unavailable; others/bundle/SSE intact.
  const trackable = useMemo(
    () => positions.filter((p) => p.status === 'open' || p.status === 'pending'),
    [positions],
  );
  const trackKey = trackable.map((p) => p.id).join(',');

  useEffect(() => {
    let cancelled = false;
    trackable.forEach((p) => {
      fetchTrackedContract(p.ticker, { expiration: p.expiration, strike: p.strike, right: p.right })
        .then((tc) => {
          if (cancelled) return;
          setRowLive((prev) => ({
            ...prev,
            [p.id]: { tracked: tc, unavailable: tc == null, markRes: prev[p.id]?.markRes ?? null },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setRowLive((prev) => ({
            ...prev,
            [p.id]: { tracked: null, unavailable: true, markRes: prev[p.id]?.markRes ?? null },
          }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, servedAt]);

  // ---- Per-row mark + P/L (computed each render; last-good mark kept for offline) --------------
  const markFor = useCallback(
    (p: Position): MarkResult | null => {
      const rl = rowLive[p.id];
      if (!rl || !rl.tracked || !m) return null;
      return computeMark({
        tracked: rl.tracked,
        strike: p.strike,
        right: p.right,
        anchorSpot: m.price,
        liveUnderlying: live?.mid ?? null,
        isLive,
        marketSession: session,
        streamOffline,
        lastMark: lastMarkRef.current.get(p.id) ?? null,
      });
    },
    [rowLive, m, live?.mid, isLive, session, streamOffline],
  );

  // Build the row metrics for every position (the live-derived view).
  const rows = useMemo<DerivedRow[]>(() => {
    return positions.map((p) => {
      const rl = rowLive[p.id];
      const markRes = p.status === 'open' || p.status === 'pending' ? markFor(p) : null;
      const unavailable =
        (p.status === 'open' || p.status === 'pending') && (rl?.unavailable ?? false);
      const mark = markRes?.mark ?? null;
      const plNow =
        p.status === 'open' ? pl(mark, p.entry_mark, p.qty) : { dollar: null, pct: null };
      const sessAnchor = trends.sessionAnchor(p.id);
      const sessionDelta =
        plNow.dollar != null && sessAnchor != null && !streamOffline
          ? plNow.dollar - sessAnchor
          : null;
      const metrics: RowMetrics = {
        id: p.id,
        plDollar: unavailable ? null : plNow.dollar,
        plPct: unavailable ? null : plNow.pct,
        unavailable,
        deltaEntry: unavailable ? null : plNow.dollar,
        sessionDelta,
        dte: rl?.tracked?.dte ?? null,
      };
      return { position: p, metrics, strategy: strategyOf(p) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, rowLive, markFor, streamOffline, historyVersion]);

  // ---- Keep last-good mark + feed the trend/session ring buffers (live-derived, ephemeral) ----
  useEffect(() => {
    positions.forEach((p) => {
      if (p.status !== 'open') return;
      const markRes = markFor(p);
      if (markRes && !markRes.frozen && markRes.basis !== 'last_known' && markRes.mark != null) {
        lastMarkRef.current.set(p.id, markRes.mark);
        const plNow = pl(markRes.mark, p.entry_mark, p.qty);
        if (plNow.dollar != null) trends.record(p.id, plNow.dollar);
      } else if (streamOffline) {
        trends.recordBreak(p.id); // gap = broken line (never 0/interpolated)
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowLive, live?.mid, streamOffline]);

  // ---- Resting-limit fill lifecycle (fills only on a LIVE cross at the limit price) -----------
  useEffect(() => {
    if (streamOffline || !isLive) return; // no fills off a non-live mark
    positions.forEach((p) => {
      if (p.status !== 'pending' || p.limit_price == null) return;
      const markRes = markFor(p);
      const liveMark =
        markRes && !markRes.frozen && markRes.basis !== 'last_known' ? markRes.mark : null;
      if (limitWouldFill(liveMark, p.limit_price, true)) {
        fillLimit(p);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowLive, live?.mid, streamOffline, isLive]);

  // ---- Decision records ----------------------------------------------------------------------
  const recordDecision = useCallback(
    (
      partial: Pick<DecisionRecord, 'event_type'> & Partial<DecisionRecord>,
      p: Position,
      markPrice: number | null,
      basis: string,
    ) => {
      const plv = pl(markPrice, p.entry_mark, p.qty);
      const rec: DecisionRecord = {
        clock_time: new Date().toISOString(),
        trade_id: p.id,
        contract: {
          ticker: p.ticker,
          expiration: p.expiration,
          strike: p.strike,
          right: p.right,
          qty: p.qty,
        },
        mark_price: markPrice ?? p.entry_mark,
        mark_basis: basis as DecisionRecord['mark_basis'],
        underlying_spot: m?.price ?? 0,
        pl_dollar: plv.dollar ?? 0,
        pl_pct: plv.pct ?? 0,
        tier,
        position_fingerprint: data?.position_eval?.fingerprint ?? '',
        schema_version: GT_SCHEMA,
        ...partial,
      } as DecisionRecord;
      appendDecision(rec);
      setHistoryVersion((v) => v + 1);
    },
    [m, tier, data],
  );

  const decisionsFor = useCallback(
    (id: PositionId) => decisionsForPosition(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

  // ---- Open a position (the 3 entry modes) ---------------------------------------------------
  const openPosition = useCallback(
    (input: OpenPositionInput): OpenResult => {
      const ticker = input.ticker.toUpperCase();
      const base = {
        id: newId(),
        ticker,
        expiration: input.expiration,
        strike: input.strike,
        right: input.right,
        side: 'long' as const,
        qty: input.qty,
        stop: input.stop ?? null,
        target: input.target ?? null,
        schema_version: PORTFOLIO_SCHEMA_VERSION,
        entry_mode: input.entryMode,
      };

      if (input.entryMode === 'manual') {
        const fill = resolveManualFill(input.price ?? 0);
        const p: Position = {
          ...base,
          entry_mark: fill.mark,
          entry_basis: fill.basis,
          entry_time: new Date().toISOString(),
          status: 'open',
        };
        putPosition(p);
        refreshPositions();
        recordDecision({ event_type: 'open' }, p, fill.mark, fill.basis);
        return { ok: true, position: p };
      }

      if (input.entryMode === 'market') {
        // The dialog already resolved the market fill (or signalled it cannot fill).
        if (input.resolvedMark == null || input.resolvedBasis == null) {
          return { ok: false, reason: "Couldn't fill at market — no position was opened." };
        }
        const p: Position = {
          ...base,
          entry_mark: input.resolvedMark,
          entry_basis: input.resolvedBasis,
          entry_time: new Date().toISOString(),
          status: 'open',
        };
        putPosition(p);
        refreshPositions();
        recordDecision({ event_type: 'open' }, p, input.resolvedMark, input.resolvedBasis);
        return { ok: true, position: p };
      }

      // limit — rests pending; fills later on a live cross.
      const limitPrice = input.limitPrice ?? input.price ?? 0;
      const p: Position = {
        ...base,
        entry_mark: limitPrice,
        entry_basis: LIMIT_FILL_BASIS,
        entry_time: '',
        placed_time: new Date().toISOString(),
        status: 'pending',
        limit_price: limitPrice,
      };
      putPosition(p);
      refreshPositions();
      recordDecision({ event_type: 'limit_placed' }, p, limitPrice, LIMIT_FILL_BASIS);
      return { ok: true, position: p };
    },
    [recordDecision, refreshPositions],
  );

  // ---- Resting-limit transitions -------------------------------------------------------------
  const fillLimit = useCallback(
    (p: Position) => {
      const filled: Position = {
        ...p,
        status: 'open',
        entry_mark: p.limit_price ?? p.entry_mark,
        entry_basis: LIMIT_FILL_BASIS,
        entry_time: new Date().toISOString(),
      };
      putPosition(filled);
      refreshPositions();
      recordDecision({ event_type: 'limit_filled' }, filled, filled.entry_mark, LIMIT_FILL_BASIS);
    },
    [recordDecision, refreshPositions],
  );

  const cancelLimit = useCallback(
    (id: PositionId) => {
      const p = getPosition(id);
      if (!p || p.status !== 'pending') return;
      const cancelled: Position = {
        ...p,
        status: 'cancelled',
        close_time: new Date().toISOString(),
      };
      putPosition(cancelled);
      refreshPositions();
      recordDecision(
        { event_type: 'limit_cancelled' },
        cancelled,
        p.limit_price ?? p.entry_mark,
        LIMIT_FILL_BASIS,
      );
    },
    [recordDecision, refreshPositions],
  );

  // ---- Close an open position ----------------------------------------------------------------
  const closePosition = useCallback(
    (id: PositionId) => {
      const p = getPosition(id);
      if (!p || p.status !== 'open') return;
      const markRes = markFor(p);
      const markPrice = markRes?.mark ?? p.entry_mark;
      const plv = pl(markPrice, p.entry_mark, p.qty);
      const closed: Position = {
        ...p,
        status: 'closed',
        close_time: new Date().toISOString(),
        realized_pl_dollar: plv.dollar ?? 0,
        realized_pl_pct: plv.pct ?? 0,
      };
      putPosition(closed);
      refreshPositions();
      recordDecision({ event_type: 'close' }, p, markPrice, markRes?.basis ?? p.entry_basis);
    },
    [markFor, recordDecision, refreshPositions],
  );

  // ---- Customization + saved views (durable, view-only) --------------------------------------
  const setWorking = useCallback((patch: Partial<ViewConfig>) => {
    setCustom((prev) => {
      const next = { ...prev, working: { ...prev.working, ...patch } };
      putCustomization(next);
      return next;
    });
  }, []);

  const setFilter = useCallback((patch: Partial<FilterState>) => {
    setCustom((prev) => {
      const working = { ...prev.working, filter: { ...prev.working.filter, ...patch } };
      const next = { ...prev, working };
      putCustomization(next);
      return next;
    });
  }, []);

  const activeView = useMemo(
    () => custom.views.find((v) => v.id === custom.activeViewId) ?? custom.views[0],
    [custom],
  );
  const hasUnsavedChanges = useMemo(
    () => !configEqual(custom.working, activeView.config),
    [custom.working, activeView],
  );

  const switchView = useCallback((id: string) => {
    setCustom((prev) => {
      const v = prev.views.find((x) => x.id === id);
      if (!v) return prev;
      const next = { ...prev, activeViewId: id, working: cloneConfig(v.config) };
      putCustomization(next);
      return next;
    });
  }, []);

  const saveAsNewView = useCallback((name: string) => {
    setCustom((prev) => {
      const v: SavedView = { id: newId(), name, config: cloneConfig(prev.working) };
      const next = { ...prev, views: [...prev.views, v], activeViewId: v.id };
      putCustomization(next);
      return next;
    });
  }, []);

  const saveChanges = useCallback(() => {
    setCustom((prev) => {
      const views = prev.views.map((v) =>
        v.id === prev.activeViewId ? { ...v, config: cloneConfig(prev.working) } : v,
      );
      const next = { ...prev, views };
      putCustomization(next);
      return next;
    });
  }, []);

  const renameView = useCallback((id: string, name: string) => {
    setCustom((prev) => {
      const views = prev.views.map((v) => (v.id === id ? { ...v, name } : v));
      const next = { ...prev, views };
      putCustomization(next);
      return next;
    });
  }, []);

  const deleteView = useCallback((id: string) => {
    setCustom((prev) => {
      const target = prev.views.find((v) => v.id === id);
      if (!target || target.builtin) return prev; // the seeded default cannot be deleted
      const views = prev.views.filter((v) => v.id !== id);
      const activeViewId = prev.activeViewId === id ? views[0].id : prev.activeViewId;
      const working = prev.activeViewId === id ? cloneConfig(views[0].config) : prev.working;
      const next = { ...prev, views, activeViewId, working };
      putCustomization(next);
      return next;
    });
  }, []);

  const trendFor = useCallback((id: PositionId) => trends.series(id), [trends]);

  return {
    positions,
    rows,
    decisionsFor,
    markFor,
    trendFor,
    openPosition,
    closePosition,
    cancelLimit,
    fillLimit,
    // customization
    custom,
    working: custom.working,
    activeView,
    hasUnsavedChanges,
    setWorking,
    setFilter,
    switchView,
    saveAsNewView,
    saveChanges,
    renameView,
    deleteView,
    refreshPositions,
  };
}
