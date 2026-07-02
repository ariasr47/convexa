/**
 * useAiRecommendation — the rec-panel brain. Reads `RecStatus` (gate/cap/availability), issues
 * `POST /api/recommendation/{ticker}`, holds the PINNED `RecResponse`, and computes the `stale`
 * transition by comparing the rec's pin (`pinned_fingerprint`/`as_of`) against the LIVE BUNDLE's
 * `ai_eval.state_fingerprint`/`meta.freshness.snapshot_iso`.
 *
 * Invariants enforced here:
 * - [live-vs-static-isolation] — the rec is a STATIC artifact. It is pinned at request time; it
 *   never auto-refreshes/re-runs. The hook fires NO query on a poll or on SSE events. It takes the
 *   polled `bundle` (to compute stale) but NOT `live`/SSE — so an SSE drop leaves the rec untouched.
 * - [best-effort-isolated-or-null] — a transport fault is caught and surfaced as the `unavailable`
 *   panel state; it is never thrown to the page. A status fetch fault degrades the action to inert.
 * - server-side key only — the request body carries only identifiers + the gating context.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TickerBundle, RecResponse, RecStatus, RecGate, RecCap, RecScenarioInfo, requestRecommendation,
  fetchRecStatus, AuthError,
} from '@org/api';

export interface RecRequestOpts {
  override?: boolean;
  personaId?: string | null;
  personaName?: string;
  /** ai-rec-backtest-orders (INTERFACE §1.1): the operator's scenario selector. Omitted/null ⇒
   *  the shipped real path byte-for-byte (the field is then NOT sent at all). */
  scenarioId?: string | null;
}

/** The RecStatus.scenarios advertisement (INTERFACE §2). Absent on an older backend ⇒ treated as
 *  disabled (no picker) — the FE never assumes the flag state. */
export interface ScenarioAdvert {
  enabled: boolean;
  catalog: RecScenarioInfo[];
}

interface AiRecOpts {
  personaId: string | null;   // the per-query read persona (defaults to the active persona)
  personaName: string;
  dteMin: number | null;
  dteMax: number | null;
  darkPool: boolean;
}

const DEFAULT_GATE: RecGate = { state: 'available', cooldown_remaining_seconds: 0, reasons: [] };
const DEFAULT_CAP: RecCap = { over_limit: false, remaining_today: 0, resets_at: '' };

export function useAiRecommendation(ticker: string, bundle: TickerBundle | null, opts: AiRecOpts) {
  // Gate/cap/availability — seeded from `fetchRecStatus`, then refreshed from each rec RESPONSE
  // (which carries the gating snapshot at response time). `inAppEnabled` only ever comes from status.
  const [gate, setGate] = useState<RecGate>(DEFAULT_GATE);
  const [cap, setCap] = useState<RecCap>(DEFAULT_CAP);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [statusReady, setStatusReady] = useState(false);
  // Scenario advertisement — driven ENTIRELY off the wire (never assumed). Default = disabled.
  const [scenarios, setScenarios] = useState<ScenarioAdvert>({ enabled: false, catalog: [] });

  const [rec, setRec] = useState<RecResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Last request shape, so Retry repeats it verbatim (same persona / override).
  const lastReq = useRef<RecRequestOpts>({});
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const applyGating = useCallback((g: RecGate, c: RecCap) => {
    setGate(g);
    setCap(c);
    setCooldownRemaining(g.cooldown_remaining_seconds > 0 ? g.cooldown_remaining_seconds : 0);
  }, []);

  // ---- Status read (side-effect-free; NOT a rec query) ---------------------------------------
  const refreshStatus = useCallback(() => {
    let cancelled = false;
    fetchRecStatus(ticker)
      .then((s: RecStatus) => {
        if (cancelled) return;
        setInAppEnabled(s.availability.in_app_enabled);
        // INTERFACE §2: the wire always carries `scenarios` post-feature; an absent field (older
        // backend) degrades to disabled — zero scenario surface (AC-34), never a throw.
        setScenarios(
          s.scenarios && typeof s.scenarios.enabled === 'boolean'
            ? { enabled: s.scenarios.enabled, catalog: Array.isArray(s.scenarios.catalog) ? s.scenarios.catalog : [] }
            : { enabled: false, catalog: [] },
        );
        applyGating(s.gate, s.cap);
        setStatusReady(true);
      })
      .catch(() => {
        // Transport fault on status: degrade the action to inert, keep the rest of the page intact.
        if (cancelled) return;
        setInAppEnabled(false);
        setScenarios({ enabled: false, catalog: [] });
        setStatusReady(true);
      });
    return () => { cancelled = true; };
  }, [ticker, applyGating]);

  // Read status on mount + ticker change. Reset the pinned rec when the ticker changes.
  useEffect(() => {
    setRec(null);
    setLoading(false);
    setStatusReady(false);
    return refreshStatus();
  }, [ticker, refreshStatus]);

  // ---- Local cooldown countdown (re-enables the action at 0; AC9) ----------------------------
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const id = setInterval(() => setCooldownRemaining((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownRemaining]);

  // ---- Request a rec -------------------------------------------------------------------------
  const request = useCallback(async (reqOpts: RecRequestOpts = {}) => {
    if (loading || !bundle) return;
    const o = optsRef.current;
    const personaId = reqOpts.personaId !== undefined ? reqOpts.personaId : o.personaId;
    const personaName = reqOpts.personaName ?? o.personaName;
    lastReq.current = { ...reqOpts, personaId, personaName };
    setLoading(true);
    try {
      const res = await requestRecommendation(ticker, {
        persona_id: personaId,
        snapshot_fingerprint: bundle.ai_eval.state_fingerprint,
        dte_min: o.dteMin,
        dte_max: o.dteMax,
        dark_pool: o.darkPool,
        override: reqOpts.override ?? false,
        // Additive scenario selector (INTERFACE §1.1): the field is included ONLY when the
        // operator actually selected a scenario — absent otherwise (the shipped path stays
        // byte-for-byte, AC-45).
        ...(reqOpts.scenarioId ? { scenario_id: reqOpts.scenarioId } : {}),
      });
      setRec(res);
      applyGating(res.gate, res.cap);
    } catch (err) {
      // user-accounts (D6f): an AUTH-class outcome (403 auth_required / 503 auth_unavailable) is the
      // OUTERMOST gate — rethrow so the caller's auth gate shows the sign-in / "couldn't reach" prompt
      // and NEVER ai-rec's `unavailable`/cooldown/cap. Reset loading first so the panel re-renders the
      // gate region rather than the spinner.
      if (err instanceof AuthError) {
        setLoading(false);
        throw err;
      }
      // Transport fault → synthesize the `unavailable` artifact (caught, never thrown to the page).
      setRec({
        status: 'unavailable',
        persona: { id: personaId, name: personaName },
        as_of: null,
        pinned_fingerprint: '',
        stale_born: false,
        strategy: null,
        unavailable_reason: 'transport',
        gate,
        cap,
      });
    } finally {
      setLoading(false);
    }
  }, [loading, bundle, ticker, gate, cap, applyGating]);

  const retry = useCallback(() => request(lastReq.current), [request]);
  const dismiss = useCallback(() => setRec(null), []);

  // ---- Derived: stale (newer bundle vs the rec's pin; SSE drop never touches this) -----------
  const stale = useMemo(() => {
    if (!rec || rec.status !== 'produced' || !bundle) return false;
    return (
      bundle.ai_eval.state_fingerprint !== rec.pinned_fingerprint ||
      bundle.meta.freshness.snapshot_iso !== rec.as_of
    );
  }, [rec, bundle]);

  // Effective gate state: the local countdown is the cooldown source of truth; otherwise the
  // server's reported gate (no_fresh_edge / available). A server cooling_down with a now-elapsed
  // local countdown reads as available again.
  const effectiveGateState = cooldownRemaining > 0
    ? 'cooling_down'
    : gate.state === 'cooling_down' ? 'available' : gate.state;

  return {
    // gating / availability
    inAppEnabled, gate, cap, statusReady, cooldownRemaining, effectiveGateState,
    // scenario advertisement (ai-rec-backtest-orders — wire-driven, default disabled)
    scenarios,
    // the pinned artifact
    rec, loading, stale,
    // actions
    request, retry, dismiss, refreshStatus,
  };
}

export type AiRec = ReturnType<typeof useAiRecommendation>;
