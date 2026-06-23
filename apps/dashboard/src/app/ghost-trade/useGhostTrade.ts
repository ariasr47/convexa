/**
 * useGhostTrade — the ghost-trade brain. Owns the durable trade, the tracked-contract fetch, the
 * honest mark + P/L, edge-detected reassessment alerts, the reassessment boundary (operator-
 * mediated: build request → ingest pasted verdict), and the accept/reject → position mapping.
 * Everything here is simulation-only; no code path can place a real order.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTrackedContract, TickerBundle, LiveUpdate, TrackedContract, Recommendation, OptionRight,
} from '@org/api';
import { GhostTrade, DecisionRecord, DecisionEvent, TradeAlert, MarkBasis, SCHEMA_VERSION } from './types';
import {
  getTrade, putTrade, clearTrade, appendDecision, decisionsForTrade, newId,
} from './store';
import {
  computeMark, pl, MarkResult, ADD_QTY_MAX, PL_TARGET_PCT, PL_STOP_PCT, DTE_ALERT_THRESHOLD, bsPrice,
} from './mark';

const TIER_ORDER = ['dormant', 'watch', 'actionable', 'prime'];

export type ReassessPhase = 'idle' | 'pending' | 'ready' | 'accepted' | 'rejected' | 'failed';

export interface NewTradeForm {
  expiration: string;
  strike: number;
  right: OptionRight;
  qty: number;
  entryMark: number;
  entryBasis: MarkBasis;
  // Optional risk plan (editable; seeded from an AI rec when Accepted). Additive — manual entries
  // leave them undefined. Not an input to the mark/P-L math.
  stop?: number | null;
  target?: number | null;
}

export function useGhostTrade(
  ticker: string,
  data: TickerBundle | null,
  live: LiveUpdate | null,
  isLive: boolean,
  streamOffline: boolean,
) {
  const [trade, setTradeState] = useState<GhostTrade | null>(() => getTrade(ticker));
  const [historyVersion, setHistoryVersion] = useState(0);
  const [tracked, setTracked] = useState<TrackedContract | null>(null);
  const [trackingUnavailable, setTrackingUnavailable] = useState(false);
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);
  const [reassess, setReassess] = useState<{ phase: ReassessPhase; rec?: Recommendation; note?: string }>({ phase: 'idle' });

  const m = data?.market_state;
  const stale = data?.meta.freshness.stale ?? false;
  const session = live?.market_session ?? null;
  const tier = data?.signals.opportunity_tier ?? 'dormant';

  // Reload the durable trade when the ticker changes.
  useEffect(() => {
    setTradeState(getTrade(ticker));
    setTracked(null);
    setTrackingUnavailable(false);
    setAlerts([]);
    setReassess({ phase: 'idle' });
  }, [ticker]);

  const persist = useCallback((t: GhostTrade | null) => {
    if (t) putTrade(t); else clearTrade(ticker);
    setTradeState(t);
  }, [ticker]);

  // Fetch the held contract's stats (filter-independent) on open + on each bundle refresh.
  const servedAt = data?.meta.served_at;
  useEffect(() => {
    if (!trade || trade.status !== 'open') { setTracked(null); setTrackingUnavailable(false); return; }
    let cancelled = false;
    fetchTrackedContract(trade.ticker, { expiration: trade.expiration, strike: trade.strike, right: trade.right })
      .then((tc) => { if (cancelled) return; setTracked(tc); setTrackingUnavailable(tc == null); })
      .catch(() => { if (cancelled) return; setTracked(null); setTrackingUnavailable(true); });
    return () => { cancelled = true; };
  }, [trade, servedAt]);

  // ---- Honest mark + P/L (computed each render; last good mark kept for offline) --------------
  const lastMarkRef = useRef<number | null>(null);
  let markRes: MarkResult | null = null;
  if (trade && trade.status === 'open' && tracked && m) {
    markRes = computeMark({
      tracked, strike: trade.strike, right: trade.right,
      anchorSpot: m.price,
      liveUnderlying: live?.mid ?? null,
      isLive, marketSession: session, streamOffline,
      lastMark: lastMarkRef.current,
    });
  }
  useEffect(() => {
    if (markRes && !markRes.frozen && markRes.basis !== 'last_known' && markRes.mark != null) {
      lastMarkRef.current = markRes.mark;
    }
  });
  const plNow = trade ? pl(markRes?.mark ?? null, trade.entry_mark, trade.qty) : { dollar: null, pct: null };

  // ---- Decision records ----------------------------------------------------------------------
  const recordDecision = useCallback((
    partial: Pick<DecisionRecord, 'event_type'> & Partial<DecisionRecord>,
    t: GhostTrade,
    markPrice: number | null,
    basis: MarkBasis,
  ) => {
    const p = pl(markPrice, t.entry_mark, t.qty);
    const rec: DecisionRecord = {
      clock_time: new Date().toISOString(),
      trade_id: t.id,
      contract: { ticker: t.ticker, expiration: t.expiration, strike: t.strike, right: t.right, qty: t.qty },
      mark_price: markPrice ?? t.entry_mark,
      mark_basis: basis,
      underlying_spot: m?.price ?? 0,
      pl_dollar: p.dollar ?? 0,
      pl_pct: p.pct ?? 0,
      tier,
      position_fingerprint: data?.position_eval?.fingerprint ?? '',
      schema_version: SCHEMA_VERSION,
      ...partial,
    };
    appendDecision(rec);
    setHistoryVersion((v) => v + 1);
  }, [m, tier, data]);

  const decisions = useMemo(
    () => (trade ? decisionsForTrade(trade.id) : []),
    [trade, historyVersion],
  );

  // ---- Open / Close --------------------------------------------------------------------------
  const openTrade = useCallback((f: NewTradeForm) => {
    if (trade && trade.status === 'open') return; // one open trade per ticker
    const t: GhostTrade = {
      id: newId(), ticker: ticker.toUpperCase(), expiration: f.expiration, strike: f.strike,
      right: f.right, side: 'long', qty: f.qty, entry_mark: f.entryMark, entry_basis: f.entryBasis,
      entry_time: new Date().toISOString(), status: 'open', schema_version: SCHEMA_VERSION,
      stop: f.stop ?? null, target: f.target ?? null,
    };
    persist(t);
    recordDecision({ event_type: 'open' }, t, f.entryMark, f.entryBasis);
    setReassess({ phase: 'idle' });
    setAlerts([]);
  }, [trade, ticker, persist, recordDecision]);

  const closeTrade = useCallback((via: DecisionEvent = 'close', verdict?: string, verdictId?: string) => {
    if (!trade || trade.status !== 'open') return;
    const markPrice = markRes?.mark ?? trade.entry_mark;
    const p = pl(markPrice, trade.entry_mark, trade.qty);
    const closed: GhostTrade = {
      ...trade, status: 'closed', close_time: new Date().toISOString(),
      realized_pl_dollar: p.dollar ?? 0, realized_pl_pct: p.pct ?? 0,
    };
    persist(closed);
    recordDecision(
      { event_type: via, ai_verdict: verdict, verdict_id: verdictId, user_choice: verdict ? 'accept' : undefined },
      trade, markPrice, markRes?.basis ?? trade.entry_basis,
    );
  }, [trade, markRes, persist, recordDecision]);

  const startNew = useCallback(() => { persist(null); setAlerts([]); setReassess({ phase: 'idle' }); }, [persist]);

  // ---- Reassessment boundary (operator-mediated) ---------------------------------------------
  const reassessDisabled = stale || session === 'overnight' || session === 'closed' || !trade || trade.status !== 'open';

  const reassessmentRequest = useMemo(() => {
    if (!trade || !m) return null;
    return {
      reassessment_request: {
        trade: {
          ticker: trade.ticker, expiration: trade.expiration, strike: trade.strike, right: trade.right,
          side: trade.side, qty: trade.qty, entry_mark: trade.entry_mark, entry_time: trade.entry_time,
        },
        market_state: m,
        decision_digest: decisions.slice(0, 8).map((d) => ({
          event_type: d.event_type, clock_time: d.clock_time,
          verdict: d.ai_verdict, choice: d.user_choice, mark: d.mark_price, pl_pct: d.pl_pct,
        })),
      },
    };
  }, [trade, m, decisions]);

  const requestReassess = useCallback(() => {
    if (reassessDisabled) return;
    setReassess({ phase: 'pending' });
  }, [reassessDisabled]);

  // Ingest a pasted verdict JSON (phase-1 transport = operator-mediated artifact; pasted = ready).
  const ingestVerdict = useCallback((jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const rec: Recommendation = parsed.recommendation ?? parsed;
      if (!['Hold', 'Trim', 'Add', 'Exit', 'Roll'].includes(rec.verdict)) throw new Error('bad verdict');
      if (rec.status === 'failed') { setReassess({ phase: 'failed' }); return; }
      setReassess({ phase: 'ready', rec: { ...rec, status: 'ready' } });
    } catch {
      setReassess({ phase: 'failed' });
    }
  }, []);

  const reassessFailed = useCallback(() => setReassess({ phase: 'failed' }), []);

  const rejectVerdict = useCallback(() => {
    if (!trade || reassess.phase !== 'ready' || !reassess.rec) return;
    recordDecision(
      { event_type: 'reject', ai_verdict: reassess.rec.verdict, verdict_id: reassess.rec.verdict_id, user_choice: 'reject' },
      trade, markRes?.mark ?? null, markRes?.basis ?? trade.entry_basis,
    );
    setReassess({ phase: 'rejected' });
  }, [trade, reassess, markRes, recordDecision]);

  const acceptVerdict = useCallback(async () => {
    if (!trade || reassess.phase !== 'ready' || !reassess.rec) return;
    const rec = reassess.rec;
    const markPrice = markRes?.mark ?? null;
    const basis = markRes?.basis ?? trade.entry_basis;

    if (rec.verdict === 'Exit') {
      closeTrade('accept', 'Exit', rec.verdict_id);
      setReassess({ phase: 'accepted', note: 'Position closed and realized P/L booked.' });
      return;
    }
    if (rec.verdict === 'Roll' && rec.replacement_contract) {
      const rc = rec.replacement_contract;
      // Roll constraint: the replacement must be priced in the current snapshot, else DEFER.
      let repl: TrackedContract | null = null;
      try { repl = await fetchTrackedContract(trade.ticker, rc); } catch { repl = null; }
      if (!repl) {
        setReassess({ phase: 'ready', rec, note: 'Roll deferred — the replacement contract isn’t priced in the current snapshot yet. It will retry on the next refresh.' });
        return;
      }
      const entryMark = repl.option_quote?.mid
        ?? (repl.iv != null && m ? bsPrice(rc.right, m.price, rc.strike, repl.dte, repl.iv) : trade.entry_mark);
      const entryBasis: MarkBasis = repl.option_quote?.mid != null ? 'snapshot' : 'theoretical';
      // Close the current ghost (book realized) then open the replacement ghost.
      closeTrade('roll', 'Roll', rec.verdict_id);
      const next: GhostTrade = {
        id: newId(), ticker: trade.ticker, expiration: rc.expiration, strike: rc.strike, right: rc.right,
        side: 'long', qty: trade.qty, entry_mark: entryMark, entry_basis: entryBasis,
        entry_time: new Date().toISOString(), status: 'open', schema_version: SCHEMA_VERSION,
      };
      persist(next);
      recordDecision({ event_type: 'roll', ai_verdict: 'Roll', verdict_id: rec.verdict_id, user_choice: 'accept' }, next, entryMark, entryBasis);
      setReassess({ phase: 'accepted', note: 'Rolled into the replacement contract.' });
      return;
    }
    // Hold / Trim / Add — qty change (Add capped by the operator cap).
    let qty = trade.qty;
    if (rec.verdict === 'Trim') qty = Math.max(1, Math.floor(trade.qty / 2));
    if (rec.verdict === 'Add') qty = Math.min(trade.qty + 1, ADD_QTY_MAX);
    const updated: GhostTrade = { ...trade, qty };
    persist(updated);
    recordDecision(
      { event_type: 'accept', ai_verdict: rec.verdict, verdict_id: rec.verdict_id, user_choice: 'accept' },
      updated, markPrice, basis,
    );
    const note = rec.verdict === 'Add' && qty === ADD_QTY_MAX ? 'Applied — Add was capped at the operator limit.' : 'Applied — recorded in decision history.';
    setReassess({ phase: 'accepted', note });
  }, [trade, reassess, markRes, m, closeTrade, persist, recordDecision]);

  // ---- Alert edge-detection (once per event; suppressed while stale/offline/closed) -----------
  const suppressed = stale || streamOffline || !isLive || session === 'overnight' || session === 'closed';
  const armed = useRef<Record<string, boolean>>({}); // event-key -> currently raised (for the edge)
  const prevTierRef = useRef<string | null>(null);
  const prevPosChangedRef = useRef(false);
  const primedRef = useRef<string | null>(null); // trade id whose armed state has been seeded

  const raiseAlert = useCallback((key: string, message: string) => {
    setAlerts((prev) => [{ id: `${key}-${Date.now()}`, message, time: new Date().toISOString() }, ...prev].slice(0, 6));
    if (trade) recordDecision({ event_type: 'alert', ai_verdict: message }, trade, markRes?.mark ?? null, markRes?.basis ?? trade.entry_basis);
  }, [trade, markRes, recordDecision]);

  useEffect(() => {
    if (!trade || trade.status !== 'open' || !m) return;
    const a = armed.current;
    // First evaluation for this trade (incl. after a reload): seed the armed/relation state to the
    // CURRENT conditions WITHOUT firing — only an actual subsequent cross/rise then raises an alert.
    const firstRun = primedRef.current !== trade.id;
    // Helper: fire once on the rising edge of `cond`; re-arm when it clears. Seed-only on firstRun.
    const edge = (key: string, cond: boolean, message: string) => {
      if (firstRun) { a[key] = cond; return; }
      if (cond && !a[key]) { a[key] = true; if (!suppressed) raiseAlert(key, message); }
      else if (!cond) a[key] = false;
    };

    // Tier rose (bundle-class). Seeded on firstRun (prevTier null ⇒ no fire).
    const prevTier = prevTierRef.current;
    if (!firstRun && prevTier && TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(prevTier) && !suppressed) {
      raiseAlert(`tier-${tier}`, `Opportunity rose to ${cap(tier)} — consider reassessing.`);
    }
    prevTierRef.current = tier;

    // DTE threshold (bundle-class).
    edge('dte', tracked != null && tracked.dte <= DTE_ALERT_THRESHOLD, `${tracked?.dte ?? DTE_ALERT_THRESHOLD} DTE left — consider reassessing.`);

    // position_eval.changed (bundle-class de-dupe signal from the server).
    const posChanged = data?.position_eval?.changed ?? false;
    if (!firstRun && posChanged && !prevPosChangedRef.current && !suppressed) {
      raiseAlert(`pos-${data?.position_eval?.fingerprint ?? ''}`, 'Your position context changed — consider reassessing.');
    }
    prevPosChangedRef.current = posChanged;

    // Live-class: price crossing a wall / the gamma flip (edge on the relation flip).
    const px = live?.mid ?? null;
    if (px != null) {
      edge('callwall', px >= m.call_wall, `Price crossed the call wall ($${m.call_wall}) — consider reassessing.`);
      edge('putwall', px <= m.put_wall, `Price crossed the put wall ($${m.put_wall}) — consider reassessing.`);
      edge('flip', px >= m.gamma_flip, `Price crossed the gamma flip ($${Math.round(m.gamma_flip)}) — consider reassessing.`);
    }
    // Live-class: P/L target / stop.
    const plp = plNow.pct;
    if (plp != null) {
      edge('target', plp >= PL_TARGET_PCT, `P/L hit your +${PL_TARGET_PCT}% target — consider reassessing.`);
      edge('stop', plp <= PL_STOP_PCT, `P/L hit your ${PL_STOP_PCT}% stop — consider reassessing.`);
    }
    primedRef.current = trade.id; // armed/relation state now reflects current conditions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade, m, tracked, tier, live?.mid, plNow.pct, suppressed, data?.position_eval?.changed]);

  // Position context to feed back into the bundle request (makes the server compute position_eval).
  const positionQuery = useMemo(
    () => (trade && trade.status === 'open'
      ? { expiration: trade.expiration, strike: trade.strike, right: trade.right }
      : undefined),
    [trade],
  );

  return {
    trade, tracked, trackingUnavailable, markRes, plNow, decisions, alerts,
    reassess, reassessDisabled, reassessmentRequest,
    openTrade, closeTrade, startNew, requestReassess, ingestVerdict, acceptVerdict, rejectVerdict, reassessFailed,
    dismissAlert: (id: string) => setAlerts((p) => p.filter((x) => x.id !== id)),
    positionQuery,
  };
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
