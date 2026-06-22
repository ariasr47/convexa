/**
 * GammaFlow API client — the frontend's single point of contact with the backend.
 * Components import from `@org/api` and never call `fetch` directly. This mirrors the
 * MarketDataProvider "port" on the backend: swap the implementation here and the rest of
 * the app is unaffected.
 */

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
}

export interface StrikeRow {
  strike: number;
  net_gex: number;
  call_gex: number;
  put_gex: number;
  call_oi: number;
  put_oi: number;
  total_oi: number;
}

export interface Setup {
  name: string;
  bias: string;
  strategy: string;
  rationale: string;
  conviction: 'low' | 'medium' | 'high';
}

export interface Signals {
  ticker: string;
  regime: 'positive_gamma' | 'negative_gamma' | null;
  regime_note: string | null;
  vol_regime: 'iv_rich' | 'iv_cheap' | 'neutral';
  distances: Record<string, number | null>;
  setups: Setup[];
  opportunity_score: number;
  dark_pool_confluence?: { off_exchange_price: number; coincides_with: string; level: number }[];
}

export interface AiEval {
  ready: boolean;
  reasons: string[];
  changed: boolean;
  state_fingerprint: string;
  score_threshold: number;
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
}

export interface TickerQuery {
  minDte?: number;
  maxDte?: number;
  expirations?: string[]; // explicit YYYY-MM-DD dates; omitted/empty = all
  darkPool?: boolean;     // include off-exchange context + confluence (default backend setting)
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

/** Full bundle for one ticker, optionally filtered by DTE window or explicit expirations. */
export async function getTicker(
  symbol: string,
  { minDte, maxDte, expirations, darkPool }: TickerQuery = {}
): Promise<TickerBundle> {
  const params = new URLSearchParams();
  if (minDte != null) params.set('min_dte', String(minDte));
  if (maxDte != null) params.set('max_dte', String(maxDte));
  if (expirations && expirations.length) params.set('expirations', expirations.join(','));
  if (darkPool != null) params.set('dark_pool', String(darkPool));
  const qs = params.toString();
  const res = await fetch(`/api/ticker/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const detail =
      res.status === 404 ? `No option-chain data for ${symbol.toUpperCase()}` : `API error ${res.status}`;
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as TickerBundle;
}
