/**
 * GammaFlow API client — the frontend's single point of contact with the backend.
 * Components import from `@org/api` and never call `fetch` directly. This mirrors the
 * MarketDataProvider "port" on the backend: swap the implementation here and the rest of
 * the app is unaffected.
 */

/** IV skew at a single anchor tenor (nearest expiration >= 7 DTE). `slope` = put-side IV −
 *  call-side IV, in IV points; `reference` records which rule produced the reference IVs.
 *  Display-only; the FE derives the fear/greed/balanced word from `slope`. */
export interface IvSkew {
  slope: number;    // put_iv − call_iv, in IV points
  put_iv: number;   // downside reference IV (%)
  call_iv: number;  // upside reference IV (%)
  dte: number;
  expiration: string; // YYYY-MM-DD
  reference: '25d' | 'moneyness';
}

/** Cross-tenor ATM-IV curve (ignores the DTE filter). `points` ascending by dte; sparse/absent
 *  tenors are omitted, never faked. `state` is server-emitted. */
export interface TermStructure {
  points: { dte: number; expiration: string; atm_iv: number }[];
  state: 'contango' | 'backwardation' | 'flat';
  near_iv: number; // near-tenor ATM IV (%)
  far_iv: number;  // far-tenor ATM IV (%)
  slope: number;   // far_iv − near_iv (sign-bearing)
}

export interface MarketState {
  ticker: string;
  price: number;
  gex_spot: number | null;
  timestamp: number;
  timestamp_iso: string | null;
  call_wall: number;
  put_wall: number;
  peak_gex_strike: number | null;
  gamma_flip: number;
  max_pain: number | null;
  max_pain_expiration: string | null;
  net_gex: number;
  call_gex: number | null;
  put_gex: number | null;
  total_gex: number | null;
  // DEX — net dealer delta exposure ($), scoped to the SELECTED DTE/expiration window (same
  // contracts as net_gex/walls). null when vendor delta is missing chain-wide (best-effort).
  net_dex: number | null;
  call_dex: number | null;
  put_dex: number | null;
  net_vanna: number | null;
  net_charm: number | null;
  net_volga: number | null;
  vwap: number | null;
  vwap_upper_2: number | null;
  vwap_upper_3: number | null;
  vwap_lower_2: number | null;
  vwap_lower_3: number | null;
  dte_min: number | null;
  dte_max: number | null;
  atm_iv: number;
  hv_30d: number;
  iv_hv_ratio: number;
  net_flow: number | null;
  put_call_ratio: number;
  // Vol/OI — FULL CHAIN (ignores the DTE filter; same basis as max_pain / put_call_ratio).
  chain_vol_oi_ratio: number | null; // total option volume / total OI; null if no vendor volume
  total_volume: number | null;       // full-chain session option volume
  vol_oi_unusual_threshold: number;  // single cutoff above which a strike is "unusual" (default 1.0)
  // IV Skew (single anchor tenor) + Term Structure (cross-tenor). Independently nullable.
  iv_skew: IvSkew | null;
  term_structure: TermStructure | null;
}

export interface StrikeRow {
  strike: number;
  net_gex: number;
  call_gex: number;
  put_gex: number;
  call_oi: number;
  put_oi: number;
  total_oi: number;
  // DEX (window-scoped, same rows as net_gex) + Vol/OI (full-chain). Independently nullable.
  net_dex: number | null;
  call_dex?: number | null;
  put_dex?: number | null;
  volume: number | null;       // per-strike session volume
  vol_oi_ratio: number | null; // volume / total_oi; null when total_oi <= 0 OR no volume
}

export interface Setup {
  name: string;
  bias: string;
  strategy: string;
  rationale: string;
  conviction: 'low' | 'medium' | 'high';
}

export type OpportunityTier = 'dormant' | 'watch' | 'actionable' | 'prime';

export interface Signals {
  ticker: string;
  regime: 'positive_gamma' | 'negative_gamma' | null;
  regime_note: string | null;
  vol_regime: 'iv_rich' | 'iv_cheap' | 'neutral';
  distances: Record<string, number | null>;
  setups: Setup[];
  opportunity_score: number;
  // Opportunity escalation (backend-emitted; bands are backend env). Vocabulary is fixed.
  opportunity_tier: OpportunityTier;
  prime_prompt_eligible: boolean; // true only at prime AND actionable (gates the sim-entry prompt)
  dark_pool_confluence?: { off_exchange_price: number; coincides_with: string; level: number }[];
}

/** Sibling of ai_eval, present only when the bundle request carries an open-position context
 *  (pos_* query params); null otherwise. Drives once-per-event reassessment-alert de-dupe. */
export interface PositionEval {
  changed: boolean;     // raw de-dupe: flips once when the position fingerprint moves
  fingerprint: string;
}

export interface AiEval {
  ready: boolean;
  reasons: string[];
  changed: boolean;
  state_fingerprint: string;
  score_threshold: number;
}

// ---- Backend observability (operator-only; the trader FE IGNORES these) ---------------------
// Fixed stage vocabulary + kind taxonomy (the operator readout maps io_* → "I/O", else → "CPU").
export type StageName = 'vendor_fetch' | 'engine_build' | 'off_exchange' | 'signals' | 'persist' | 'serialize_wrap';
export type StageKind = 'io_vendor' | 'cpu_engine' | 'cpu_signals' | 'io_disk' | 'serialize';

export interface MetaTimingStage {
  stage: StageName;
  kind: StageKind;
  duration_ms: number;
  status: 'ok' | 'error' | 'skipped';
}
export interface MetaTimingVendorCall {
  name: string;
  duration_ms: number;
  http_status: number;
  retries: number;
  rate_limit?: { remaining: number; limit: number } | null; // vendor-specific; optional/nullable
}
/** Per-stage breakdown — present on `meta` ONLY when the verbose/debug switch is set. */
export interface MetaTimings {
  total_ms: number;
  stages: MetaTimingStage[];
  vendor_calls: MetaTimingVendorCall[];
}

export interface Meta {
  served_at: string;
  cache: { hit: boolean; age_seconds: number; ttl_seconds: number };
  freshness: {
    snapshot_iso: string | null;
    data_age_seconds: number | null;
    stale: boolean;
    stale_after_seconds: number;
  };
  // Operator correlation id (present when instrumentation is enabled) + optional verbose per-stage
  // timings. Additive + optional so bundles parse cleanly; the TRADER dashboard renders neither.
  trace_id?: string;
  timings?: MetaTimings;
}

export interface Expiration {
  date: string; // YYYY-MM-DD
  dte: number | null;
}

export interface OffExchangeLevel {
  price: number;
  shares: number;
  share_of_offex_pct: number;
  proximity_pct: number;
}

/** A single large off-exchange ("dark pool") print. Display/context only — no side or
 *  direction exists, now or in v1, and the UI must invent none. Ranked largest-notional-first
 *  by the backend (top-5); render in order, never re-sort or re-cap. */
export interface BlockPrint {
  price: number;        // print price
  shares: number;       // print size
  notional: number;     // price * shares (the backend's ranking key)
  proximity_pct: number; // SIGNED ratio vs spot: + above, − below (e.g. 0.004 = +0.4%)
  age_seconds: number;  // age of the print within the recent window
}

export interface OffExchange {
  ratio_pct: number | null;     // off-exchange share of total volume in the window
  offex_shares: number;
  total_shares: number;
  levels: OffExchangeLevel[];
  blocks: BlockPrint[];         // largest-notional first, top-5; may be [] (none ≥ threshold)
  block_min_shares: number;     // active block threshold (shares) for this cycle; label "no blocks ≥ N"
  note: string;
}

export interface TickerBundle {
  market_state: MarketState;
  signals: Signals;
  strike_profile: { ticker: string; spot: number; strikes: StrikeRow[] };
  expirations: Expiration[]; // all future expirations available for the selector
  ai_eval: AiEval;
  meta: Meta;
  off_exchange?: OffExchange; // present only when dark_pool is enabled
  position_eval: PositionEval | null; // present only when pos_* context is supplied
}

// ---- Ghost-trade tracker: tracked-contract stats + reassessment boundary types --------------
export type OptionRight = 'call' | 'put';
export interface OptionQuote { bid: number; ask: number; mid: number; }
/** Each greek may be null (unpriced contract). */
export interface OptionGreeks { delta: number | null; gamma: number | null; theta: number | null; vega: number | null; }
/** Filter-independent stats for one option contract (GET /api/contract). `option_quote` null ⇒
 *  no live NBBO ⇒ the FE falls back to a theoretical (Black-Scholes) mark — not an error. */
export interface TrackedContract {
  ticker: string;
  expiration: string; // YYYY-MM-DD
  strike: number;
  right: OptionRight;
  option_quote: OptionQuote | null;
  greeks: OptionGreeks;
  iv: number | null;
  dte: number;
}

export interface ReplacementContract { expiration: string; strike: number; right: OptionRight; }
/** Ingested reassessment verdict (operator-mediated; pasted JSON treated as `ready` in phase-1). */
export interface Recommendation {
  verdict: 'Hold' | 'Trim' | 'Add' | 'Exit' | 'Roll';
  replacement_contract: ReplacementContract | null; // present only for Roll
  rationale: string;
  verdict_id: string;
  status: 'pending' | 'ready' | 'failed';
}

export interface TickerQuery {
  minDte?: number;
  maxDte?: number;
  expirations?: string[]; // explicit YYYY-MM-DD dates; omitted/empty = all
  darkPool?: boolean;     // include off-exchange context + confluence (default backend setting)
  // Open-position context → makes the bundle compute position_eval. Absent ⇒ position_eval null.
  position?: { expiration: string; strike: number; right: OptionRight; plPct?: number };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Live payload pushed over SSE (mid/flow/live flip). Levels other than the flip come from
 *  the bundle; the UI measures price-vs-wall using `mid` + the bundle's walls. */
export interface LiveUpdate {
  ticker: string;
  mid: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  net_flow: number;
  buy_vol: number;
  sell_vol: number;
  flow_window_s: number;
  spot_ts: number;
  live: boolean;            // true only if a real tick arrived recently (else mid is stale)
  tick_age_s: number | null;
  market_session: string;   // premarket | regular | afterhours | overnight | closed
  feed: string;             // "realtime" | "delayed"
  ts: number;
  gamma_flip: number | null;
  // The last actual TRADE print price off the live trade tape (NOT the NBBO mid). LIVE-DERIVED:
  // rides SSE only, degrades with the other live fields on a stream drop, inherits the payload-level
  // `live`/`tick_age_s` honesty flags. `null` is the honest "no recent print" state (between trades,
  // overnight, before the session's first print) — NEVER an error. DISPLAY-ONLY: it must never feed
  // the headline anchor, the levels, the live gamma-flip, the GEX chart's liveSpot, or any score
  // input — the NBBO `mid` stays the anchor (`live-spot=NBBO-mid`). Always present, value nullable.
  last_trade: number | null;
}

/**
 * Subscribe to the live SSE stream for a ticker. Calls `onUpdate` on each payload and returns
 * an unsubscribe fn that closes the EventSource (which tears down the backend session when the
 * last subscriber leaves). SSE comment lines (heartbeats) are ignored by EventSource.
 */
export function streamTicker(
  symbol: string,
  { minDte, maxDte, expirations }: TickerQuery,
  onUpdate: (u: LiveUpdate) => void
): () => void {
  const params = new URLSearchParams();
  if (minDte != null) params.set('min_dte', String(minDte));
  if (maxDte != null) params.set('max_dte', String(maxDte));
  if (expirations && expirations.length) params.set('expirations', expirations.join(','));
  const qs = params.toString();
  const es = new EventSource(`/api/stream/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  es.onmessage = (e) => {
    try { onUpdate(JSON.parse(e.data) as LiveUpdate); } catch { /* ignore malformed */ }
  };
  // onerror: EventSource auto-reconnects; nothing to do.
  return () => es.close();
}

/** Full bundle for one ticker, optionally filtered by DTE window or explicit expirations. When
 *  `position` is supplied, the bundle additionally returns `position_eval` (else null). */
export async function getTicker(
  symbol: string,
  { minDte, maxDte, expirations, darkPool, position }: TickerQuery = {}
): Promise<TickerBundle> {
  const params = new URLSearchParams();
  if (minDte != null) params.set('min_dte', String(minDte));
  if (maxDte != null) params.set('max_dte', String(maxDte));
  if (expirations && expirations.length) params.set('expirations', expirations.join(','));
  if (darkPool != null) params.set('dark_pool', String(darkPool));
  if (position) {
    params.set('pos_expiration', position.expiration);
    params.set('pos_strike', String(position.strike));
    params.set('pos_right', position.right);
    if (position.plPct != null) params.set('pos_pl_pct', String(position.plPct));
  }
  const qs = params.toString();
  const res = await fetch(`/api/ticker/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const detail =
      res.status === 404 ? `No option-chain data for ${symbol.toUpperCase()}` : `API error ${res.status}`;
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as TickerBundle;
}

/**
 * Filter-independent stats for one tracked option contract (GET /api/contract). Resolves from the
 * full snapshot regardless of the display DTE filter; no new vendor fetch.
 * Returns `null` when the contract is **not in the snapshot** (HTTP 404 → FE "tracking unavailable").
 * A 200 with `option_quote: null` is a valid result (FE → theoretical mark), NOT null here.
 * Other failures throw (the caller treats a throw as "tracking unavailable" too).
 */
export async function fetchTrackedContract(
  symbol: string,
  { expiration, strike, right }: { expiration: string; strike: number; right: OptionRight }
): Promise<TrackedContract | null> {
  const params = new URLSearchParams({ expiration, strike: String(strike), right });
  const res = await fetch(`/api/contract/${symbol.toUpperCase()}?${params.toString()}`);
  if (res.status === 404) return null; // not in snapshot
  if (!res.ok) throw new ApiError(`Contract lookup failed (${res.status})`, res.status);
  return (await res.json()) as TrackedContract;
}

// ---- Operator metrics readout (observability; read-only, side-effect-free) -------------------
// NOTE: the endpoint path is the INTERFACE_CONTRACT's *example* (`/api/_metrics`); the Interface
// left it as "e.g." and the backend lane hasn't pinned it yet. Flagged for confirmation — if the
// backend finalizes a different path, change only this constant.
export const METRICS_ENDPOINT = '/api/_metrics';

export interface MetricsLatency { p50_ms: number; p95_ms: number; max_ms: number; count: number; }
export interface MetricsStage {
  stage: StageName; kind: StageKind;
  p50_ms: number; p95_ms: number; max_ms: number; count: number;
  ok: number; error: number; skipped: number;
}
export interface MetricsCache { hits: number; misses: number; hit_ratio: number; current_data_age_seconds: number; }
export interface MetricsVendor {
  call_count: number; latency_p50_ms: number; latency_p95_ms: number;
  min_rate_limit_headroom: { remaining: number; limit: number } | null; // null ⇒ "unknown"
}
export interface MetricsScope {
  latency_total: MetricsLatency;
  stages: MetricsStage[];
  cache: MetricsCache;
  vendor: MetricsVendor;
}
export interface RecentTrace {
  trace_id: string;
  ticker: string;
  dims: { min_dte: number | null; max_dte: number | null; expirations_present: boolean; dark_pool: boolean };
  cache_hit: boolean;
  cache_age_seconds: number;
  total_ms: number;
  computed_trace_id?: string | null; // on a cache hit: lineage to the miss-trace that computed it
}
export interface MetricsAggregate {
  instrumentation_enabled: boolean;
  window: { size_desc: string; uptime_seconds: number; request_count: number };
  global: MetricsScope;
  per_ticker: Record<string, MetricsScope>;
  recent_traces?: RecentTrace[];
}

/** Read-only operator metrics readout. Side-effect-free: GETs the readout only — never triggers a
 *  bundle fetch, recompute, or cache mutation. Throws on any non-2xx (caller → "Metrics readout
 *  unavailable."). */
export async function fetchMetrics(): Promise<MetricsAggregate> {
  const res = await fetch(METRICS_ENDPOINT);
  if (!res.ok) throw new ApiError(`Metrics readout failed (${res.status})`, res.status);
  return (await res.json()) as MetricsAggregate;
}

// ---- Trader personas (prompt-layer projection only; assembled FE-side, locus PINNED FE-rendered) ----
// Persona is a read-only, post-FREEZE presentation overlay: it changes only the assembled hand-off
// prompt text, NEVER opportunity_score/opportunity_tier/ai_eval/state_fingerprint, and switching it
// triggers NO recompute. There is no `meta.handoff` and no `?persona=` — the FE owns the template.
export type PersonaObjective = 'income' | 'directional_swing' | 'hedging';
export type PersonaRisk = 'conservative' | 'moderate' | 'aggressive';

/** Declarative persona data (no executable logic, no analytics params). The framing-copy fields
 *  (summary/objective_framing/risk_calibration) are FE-embedded UX text. */
export interface PersonaDefinition {
  id: string;
  name: string;
  builtin: boolean;
  version: number;
  objective: PersonaObjective;
  risk: PersonaRisk;
  reassessment_lean: string;       // declarative lean within the fixed schema/cap (text)
  emphasis_note?: string | null;   // bounded free-text; fills the framing slot ONLY
  dte_pref?: { min_dte: number; max_dte: number } | null;
  // FE framing copy (presets carry preset-specific text; customs derive generic text):
  summary?: string;
  objective_framing?: string;
  risk_calibration?: string;
  based_on?: string;               // for customs: the preset id it was derived from
}

export type HandoffSectionKind = 'fixed' | 'persona';
/** One labelled prompt section, badged FIXED ("same under every persona") or PERSONA. */
export interface HandoffSection { id: string; kind: HandoffSectionKind; label: string }
export interface HandoffPrompt { text: string; sections: HandoffSection[] }
/** FE-assembled hand-off projection for both prompts. `fallback` ⇒ persona assembly failed and the
 *  default one-size prompt was used. */
export interface Handoff {
  persona: { id: string | null; name: string };
  entry: HandoffPrompt;
  reassessment: HandoffPrompt;
  fallback?: boolean;
}

// ---- AI recommendations (in-app risk-first ENTRY rec; INTERFACE_CONTRACT §1) -----------------
// Three NEW endpoints. The LLM call is a best-effort, isolated, gated consumer: every rec/status/
// export endpoint is ALWAYS HTTP 200 for an LLM/cap/key fault (the `status`/`over_limit`/
// `in_app_enabled` fields distinguish them) and NEVER a 5xx that would break the bundle/SSE/page.
// A transport-level fault (network / non-2xx) is the only "unavailable" the FE synthesizes itself.
// **No API key is ever sent or received** — the request body carries only identifiers + gating ctx.

export type RecStatusKind = 'produced' | 'unavailable' | 'gated_off';
export type RecDecision = 'trade' | 'no_trade';
export type RecBias = 'long' | 'short' | 'neutral' | 'volatility';
export type RecConfidence = 'low' | 'medium' | 'high';
export type RecGateState = 'available' | 'no_fresh_edge' | 'cooling_down';

/** POST body for a rec request. Carries NO bundle payload and NO key — only identifiers + the
 *  gating context already on the page (INTERFACE §1.1). */
export interface RecRequest {
  persona_id: string | null;       // the persona framing THIS read (per-query override ≠ active)
  snapshot_fingerprint: string;    // ai_eval.state_fingerprint of the bundle on the page (pin/validate)
  dte_min: number | null;          // the DTE window already on the page (carried, not new)
  dte_max: number | null;
  dark_pool: boolean;              // whether off-exchange context is included (mirrors the page)
  override: boolean;               // true ⇒ "Ask anyway" on a no_fresh_edge gate
}

/** The risk-first strategy artifact. `decision: 'no_trade'` ⇒ trade fields null/empty + rationale. */
export interface RecStrategy {
  decision: RecDecision;
  bias: RecBias;
  structure: string | null;
  strikes: number[];               // concrete strike(s); [] allowed for no_trade
  expiration: string | null;       // YYYY-MM-DD within [dte_min,dte_max]; null for no_trade
  entry_trigger: string | null;
  invalidation_level: number | null;
  max_risk: string | null;
  position_size: string | null;
  exit_plan: { target: number | null; stop: number | null };
  time_horizon: string | null;
  confidence: RecConfidence | null;
  rationale: string;
}

export interface RecPersona { id: string | null; name: string; }
export interface RecGate { state: RecGateState; cooldown_remaining_seconds: number; reasons: string[]; }
export interface RecCap { over_limit: boolean; remaining_today: number; resets_at: string; }

/** Always HTTP 200. `status` drives the panel state machine; `strategy` present iff produced. */
export interface RecResponse {
  status: RecStatusKind;
  persona: RecPersona;
  as_of: string | null;            // snapshot_iso the rec is pinned to (echoes the bundle's freshness)
  pinned_fingerprint: string;      // state_fingerprint the rec was generated from (staleness key)
  stale_born: boolean;             // bundle was already stale at generation time (honest-at-birth)
  strategy: RecStrategy | null;    // present iff status === 'produced'
  unavailable_reason: string | null; // present iff status === 'unavailable'; NEVER leaks key text
  gate: RecGate;                   // gating snapshot AT THE TIME OF THIS RESPONSE
  cap: RecCap;
}

/** The structured export that feeds BOTH the in-app call and the manual hand-off (INTERFACE §1.2).
 *  Triggers NO LLM call, costs nothing, available even when in-app AI is unavailable. Egress
 *  invariant: ONLY {context, persona_prompt, glossary} (+ identifiers + egress_note). */
export interface RecExport {
  ticker: string;
  as_of: string | null;
  context: unknown;                // serialization of the cached bundle (null stays null, no recompute)
  persona_prompt: string;          // assembled persona prompt (server-side, canonical-sourced)
  glossary: string;                // field-level reference
  egress_note: string;             // "Complete list of what leaves the machine…"
}

/** Gating + cap + availability without requesting a rec (INTERFACE §1.3). Side-effect-free, 200. */
export interface RecStatus {
  availability: { in_app_enabled: boolean }; // false ⇒ no key configured / feature off → inert in-app
  gate: RecGate;
  cap: RecCap;
}

/** Request a rec (in-app LLM call). ALWAYS 200 for produced/no_trade/unavailable/gated_off — the
 *  `status` field distinguishes them. A non-2xx / network fault throws `ApiError`; the rec hook
 *  catches it and renders the `unavailable` panel state (never thrown to the page). No key is sent. */
export async function requestRecommendation(symbol: string, body: RecRequest): Promise<RecResponse> {
  const res = await fetch(`/api/recommendation/${symbol.toUpperCase()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(`Recommendation request failed (${res.status})`, res.status);
  return (await res.json()) as RecResponse;
}

/** The structured state export (the always-available floor). 200 when a bundle exists; 404 if the
 *  ticker was never fetched. Triggers no LLM call. */
export async function fetchRecExport(
  symbol: string,
  { personaId }: { personaId?: string | null } = {},
): Promise<RecExport> {
  const params = new URLSearchParams();
  if (personaId) params.set('persona_id', personaId);
  const qs = params.toString();
  const res = await fetch(`/api/recommendation/export/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new ApiError(`Export unavailable (${res.status})`, res.status);
  return (await res.json()) as RecExport;
}

/** Gating + cap + availability (drives the action's enabled/de-emphasized/disabled presentation).
 *  Cheap, side-effect-free, always 200. Throws only on a transport fault (caller degrades to inert). */
export async function fetchRecStatus(symbol: string): Promise<RecStatus> {
  const res = await fetch(`/api/recommendation/status/${symbol.toUpperCase()}`);
  if (!res.ok) throw new ApiError(`Status unavailable (${res.status})`, res.status);
  return (await res.json()) as RecStatus;
}

/** Canonical persona source (EXISTING endpoint, INTERFACE §1.4). This feature single-sources the
 *  per-query persona list from it; the FE-embedded presets are the offline / assembly-failure
 *  fallback only. Best-effort: throws on any transport/shape fault so the caller falls back. The
 *  payload may be `PersonaDefinition[]` or `{ personas: PersonaDefinition[] }` — both are accepted. */
export async function fetchPersonas(): Promise<PersonaDefinition[]> {
  const res = await fetch('/api/personas');
  if (!res.ok) throw new ApiError(`Personas unavailable (${res.status})`, res.status);
  const payload = (await res.json()) as unknown;
  const list = Array.isArray(payload) ? payload : (payload as { personas?: unknown })?.personas;
  if (!Array.isArray(list) || list.length === 0) throw new ApiError('Malformed personas payload', 200);
  return list as PersonaDefinition[];
}
