/**
 * Convexa API client — the frontend's single point of contact with the backend.
 * Components import from `@convexa/api` and never call `fetch` directly. This mirrors the
 * MarketDataProvider "port" on the backend: swap the implementation here and the rest of
 * the app is unaffected.
 */

/** IV skew at a single anchor tenor (nearest expiration >= 7 DTE). `slope` = put-side IV −
 *  call-side IV, in IV points; `reference` records which rule produced the reference IVs.
 *  Display-only; the FE derives the fear/greed/balanced word from `slope`. */
export interface IvSkew {
  slope: number; // put_iv − call_iv, in IV points
  put_iv: number; // downside reference IV (%)
  call_iv: number; // upside reference IV (%)
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
  far_iv: number; // far-tenor ATM IV (%)
  slope: number; // far_iv − near_iv (sign-bearing)
}

/** Projected-dealer-flow charm limb (dealer-flow-projection INTERFACE_CONTRACT §payload). Window-scoped
 *  (moves with the DTE filter, like net_gex/net_dex). All values pre-computed on the wire — the FE never
 *  does its own arithmetic. Independently nullable (null iff net_charm unavailable OR no future monthly
 *  OPEX). Signed $-delta values inherit the dealer-book convention (calls +, puts −). */
export interface CharmLimb {
  projected_delta: number; // signed $-delta drift to the horizon (= net_charm · horizon_days)
  per_day_base: number; // signed $-delta per +1 calendar day (= net_charm)
  horizon_days: number; // calendar days to the next monthly OPEX, >= 1
  opex_date: string; // ISO YYYY-MM-DD the drift is projected to (next monthly OPEX)
}

/** Projected-dealer-flow vanna limb. Instantaneous (no time horizon — its "horizon" is the vol-move
 *  magnitude). `illustrative_projected_delta` is PRE-SCALED on the wire (= net_vanna · 5) — the FE
 *  renders it DIRECTLY and never multiplies. `reference_direction` is `"increase"` (a vol drop is the
 *  exact negation; the FE states this, no second figure). Independently nullable (null iff net_vanna
 *  unavailable). */
export interface VannaLimb {
  projected_delta: number; // signed $-delta at the base move (= net_vanna · move_iv_points)
  move_iv_points: number; // base assumed vol move, IV points (fixed 1.0)
  illustrative_move_iv_points: number; // illustrative shock, IV points (fixed 5.0)
  illustrative_projected_delta: number; // PRE-SCALED signed $-delta at the illustrative move (= net_vanna · 5)
  reference_direction: string; // the direction the quote assumes; value is "increase"
}

/** A forward-looking projection of the delta dealers are expected to hedge, derived from the same
 *  window-scoped net_charm / net_vanna aggregates already in the bundle. STATIC (rides the cached REST
 *  bundle, never the SSE stream). Two independently-nullable limbs; the whole object is null only when
 *  BOTH limbs are unavailable OR the compute raised. Display/AI-context ONLY — never a scoring input
 *  (`[additive-keeps-score-byte-identical]`). */
export interface DealerFlowProjection {
  spot_basis: number; // synchronized_spot / gex_spot the flow was computed at (close-anchored, NOT live)
  charm: CharmLimb | null; // null if net_charm unavailable OR horizon undeterminable
  vanna: VannaLimb | null; // null if net_vanna unavailable
}

// ---- AI context pack ("Market context") — ai-context-pack INTERFACE_CONTRACT §payload -----------
// One additive, independently-nullable nested object on `market_state`, mirroring
// `dealer_flow_projection`. STATIC (rides the cached REST bundle, never the SSE stream) and advisory
// CONTEXT only — never a scoring input (`[additive-keeps-score-byte-identical]`). Five levels of
// best-effort null: per-label (TI) / per-horizon (ATR) / per-sub-component (divergence) / per-read /
// whole-pack. The `label` fields are CLOSED enums computed backend-side from the UNROUNDED scalars —
// the FE never re-derives a label from a scalar (an unknown enum renders that label's unavailable
// state). The `window`/`thresholds`/`flow_basis`/`method` descriptor strings exist so the AI export
// is self-describing; the FE does NOT parse or render them (it has its own pinned copy).

/** Trend direction off daily closes (close vs EMA20 vs EMA50). Null under its warm-up floor. */
export interface TrendDirectionRead {
  label: 'uptrend' | 'downtrend' | 'mixed';
  close: number; // last close ($), 2dp
  ema20: number; // EMA20 of closes ($), 2dp
  ema50: number; // EMA50 of closes ($), 2dp
  window: string; // fixed descriptor (wire-only; FE renders its own pinned copy)
  thresholds: string; // fixed descriptor
}

/** Trend strength (Wilder ADX(14)). Null under its floor / missing high-low. */
export interface TrendStrengthRead {
  label: 'weak' | 'moderate' | 'strong';
  adx: number; // Wilder ADX(14), 2dp on the wire (FE displays 1dp)
  window: string;
  thresholds: string;
}

/** Momentum state (Wilder RSI(14)). Null under its floor. */
export interface MomentumStateRead {
  label: 'overbought' | 'bullish' | 'neutral' | 'bearish' | 'oversold';
  rsi: number; // Wilder RSI(14), 2dp on the wire (FE displays 1dp)
  window: string;
  thresholds: string;
}

/** Trend & momentum read — three independently-nullable labels off the daily-bar series. Null when
 *  all 3 labels are null OR the read raised. */
export interface TrendMomentumRead {
  as_of_session: string; // ISO YYYY-MM-DD — the last daily bar's ET session date
  direction: TrendDirectionRead | null;
  strength: TrendStrengthRead | null;
  momentum: MomentumStateRead | null;
}

/** Shape scalars over the window-scoped net-GEX profile. ALL-OR-NULL (one compute; needs >= 5
 *  eligible strikes & sum|net_gex| > 0). When present every field is non-null. */
export interface GexProfileShapeRead {
  concentration: number; // normalized HHI in [0,1], 2dp
  concentration_label: 'concentrated' | 'mixed' | 'dispersed';
  balance: number; // in [-1,+1], signed, 2dp (+ = weight above spot)
  balance_label: 'above_skewed' | 'balanced' | 'below_skewed';
  center_of_mass_distance: number; // signed FRACTION of spot_basis (4dp; FE renders as a percent)
  eligible_strikes: number; // int — strikes with |net_gex| > 0 in the selected window
  spot_basis: number; // gex_spot the shape was computed at (close-anchored, NOT live)
  thresholds: string;
}

/** Where today's volume sits vs standing OI, strike by strike. Independently nullable. */
export interface DivergenceLocation {
  label: 'aligned' | 'rotating' | 'divergent';
  distribution_shift: number; // in [0,1], 2dp
  thresholds: string;
}

/** Which right today's volume favors vs the standing book. Independently nullable; when present
 *  ALL THREE scalars are non-null. */
export interface DivergenceComposition {
  label: 'flow_put_tilted' | 'consistent' | 'flow_call_tilted';
  volume_pcr: number; // today's put/call VOLUME ratio, 2dp
  oi_pcr: number; // standing full-chain put/call OI ratio (== put_call_ratio), 2dp
  tilt_ratio: number; // volume_pcr / oi_pcr, 2dp
  thresholds: string;
}

/** Flow vs positioning read — null when BOTH sub-components are null OR the read raised. The flow
 *  basis is the chain snapshot's same-day cumulative option volume — UNSIGNED; never the SSE net
 *  flow; never tick data. */
export interface FlowVsPositioningRead {
  flow_basis: string; // fixed descriptor
  location: DivergenceLocation | null;
  composition: DivergenceComposition | null;
}

/** One ATR horizon. Independently nullable (a horizon without its full valid-bar tail is null —
 *  never a fabricated 0). */
export interface AtrHorizon {
  value: number; // $ (2dp)
  pct_of_close: number; // PERCENT of close_basis (2dp, e.g. 2.31 = 2.31%)
  window_bars: number; // int
}

/** Average-true-range read — null when ALL horizons are null OR the read raised. */
export interface AtrRead {
  as_of_session: string; // ISO YYYY-MM-DD (same convention as trend_momentum.as_of_session)
  close_basis: number; // the last bar's close ($) the percentages are against, 2dp
  method: string; // fixed descriptor
  atr_5d: AtrHorizon | null;
  atr_14d: AtrHorizon | null;
  atr_30d: AtrHorizon | null;
}

/** The AI context pack. Null only when ALL FOUR children are null OR the wrapper raised. The KEY is
 *  always present on a post-feature backend; it is OPTIONAL on `MarketState` so pre-feature payloads
 *  type-check (consumers read `m.market_context ?? null`). */
export interface MarketContextPack {
  trend_momentum: TrendMomentumRead | null;
  gex_profile_shape: GexProfileShapeRead | null;
  flow_vs_positioning: FlowVsPositioningRead | null;
  atr: AtrRead | null;
}

// ---- IV rank — iv-rank INTERFACE_CONTRACT §3 ----------------------------------------------------
// One additive, independently-nullable nested object on `market_state`, mirroring
// `dealer_flow_projection` / `market_context`. STATIC (rides the cached REST bundle, never the SSE
// stream) and advisory CONTEXT only — never a scoring input (`[additive-keeps-score-byte-identical]`).
// The read carries an explicit `state` discriminant + nullable children so the FE maps to its four
// body states purely from the wire (never re-deriving state, band, or a rank from a scalar). The
// `*_descriptor`/`advisory_note` strings exist so the AI export is self-describing; the FE does NOT
// parse or render them (it has its own pinned copy — a sentinel-value test guards this).

/** The two mutually-exclusive non-null read states. An unknown value → the FE treats the read as
 *  unavailable (fail-honest). `computed` = enough history + a current IV; `building` = 1..N_min-1
 *  samples. (Whole-read unavailable is expressed by `iv_rank == null`, NOT a `state` value.) */
export type IvRankState = 'computed' | 'building';

/** The digested rich/cheap band token (D2), computed backend-side from the Rank at 70/30 cut points.
 *  CLOSED enum — the FE displays it via a closed lookup and NEVER re-derives it from `rank` (an
 *  unknown value renders no band). Present ONLY when `state == 'computed'` AND `rank != null`. */
export type IvRankBand = 'premium_rich' | 'neutral' | 'premium_cheap';

/** How the sampled IV was derived (self-describing basis, `model-read-carries-its-assumptions`). */
export type IvBasis = 'interpolated_30d' | 'nearest_tenor';

export interface IvRankRead {
  /** Which of the two non-null states this read is in. Drives the FE body-state selection. */
  state: IvRankState;

  // ---- Computed-state numbers (all null unless state == 'computed') ----
  /** IV Rank 0–100 (headline, D4). null when state != 'computed' OR the window is degenerate-flat
   *  (IV_max == IV_min) — in the flat sub-case `state` stays 'computed', `rank` is null, and
   *  `rank_unavailable_reason` explains it. NEVER a fabricated midpoint. */
  rank: number | null;
  /** Set ONLY when state == 'computed' && rank == null (degenerate-flat): a short machine reason the
   *  FE maps to its pinned flat note. Closed value: 'flat_window'. null otherwise. */
  rank_unavailable_reason: 'flat_window' | null;
  /** IV Percentile 0–100 (secondary, D4). Present whenever state == 'computed' (incl. degenerate-flat
   *  — a flat window still has a defined percentile). null when state != 'computed'. */
  percentile: number | null;
  /** The digested band token (D2). Present ONLY when state == 'computed' && rank != null; null in the
   *  flat sub-case and in building. */
  band: IvRankBand | null;

  // ---- The self-describing envelope (present in BOTH states; carries the read's assumptions) ----
  /** The IV value the read measured this cycle (percentage points, ×100 convention). null in building
   *  when no current IV was usable but samples exist below the floor. */
  current_iv: number | null;
  /** Sessions actually used in the window (== sample_count until 252, then 252). */
  window_sessions: number;
  /** Total accumulated samples for this ticker (== window_sessions until >252). */
  sample_count: number;
  /** The rolling window cap (252). Fixed descriptor for the "N of the last {window} sessions" copy. */
  window_cap: number;
  /** The minimum-sample floor (N_min = 20, D3). The FE renders "N of {N_min} sessions" in building. */
  min_samples: number;
  /** How current_iv was derived (self-describing basis, AC-19). */
  iv_basis: IvBasis;
  /** The actual DTE the sample represents: 30 for a clean interpolation; the fallback tenor DTE
   *  otherwise. The FE renders it in the fallback basis line. */
  basis_dte: number;

  // ---- Self-describing descriptors (WIRE-ONLY — for the AI export; the FE does NOT render these) ----
  /** Plain-language window/basis/framing descriptors so the AI export is self-describing. The FE has
   *  its OWN pinned copy and MUST NOT render these strings (a sentinel-value test guards this). */
  window_descriptor: string;
  basis_descriptor: string;
  advisory_note: string;
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
  /**
   * ATM IV as **percent** on the wire (22 = 22%). Engine storage is decimal (0.22);
   * the API converts at the boundary via `atm_iv_to_wire_percent`. Never treat this as
   * a fraction of 1 when comparing to HV% or feeding a re-implemented vol-norm.
   */
  atm_iv: number;
  /** 30d historical vol as **percent annualized** (same unit as wire `atm_iv`). */
  hv_30d: number;
  iv_hv_ratio: number;
  net_flow: number | null;
  put_call_ratio: number;
  // Vol/OI — FULL CHAIN (ignores the DTE filter; same basis as max_pain / put_call_ratio).
  chain_vol_oi_ratio: number | null; // total option volume / total OI; null if no vendor volume
  total_volume: number | null; // full-chain session option volume
  vol_oi_unusual_threshold: number; // single cutoff above which a strike is "unusual" (default 1.0)
  // IV Skew (single anchor tenor) + Term Structure (cross-tenor). Independently nullable.
  iv_skew: IvSkew | null;
  term_structure: TermStructure | null;
  // Projected dealer flow (charm + vanna limbs) — additive, independently nullable, STATIC (rides the
  // cached bundle, never the SSE stream). Never a scoring input.
  dealer_flow_projection: DealerFlowProjection | null;
  // AI context pack ("Market context") — additive, independently nullable, STATIC. OPTIONAL key so
  // pre-feature payloads type-check; consumers read `m.market_context ?? null`. Never a scoring input.
  market_context?: MarketContextPack | null;
  // IV rank (iv-rank) — additive, independently nullable, STATIC. OPTIONAL key so pre-feature payloads
  // type-check; consumers read `m.iv_rank ?? null`. Never a scoring input.
  iv_rank?: IvRankRead | null;
  // Vol-normalized GEX (vol-normalized-gex) — additive, independently nullable, STATIC. OPTIONAL key.
  // Magnitude only (net/call/put/total ÷ ATM IV or HV). Walls/flip stay raw. Never a scoring input.
  vol_normalized_gex?: VolNormalizedGex | null;
  // Straddle-implied move (tradeable-rec-inputs) — additive, STATIC, ALWAYS an object (never a bare
  // null — the backend's constructor is total). Not optional: a post-feature backend always emits
  // it. Never a scoring input.
  straddle_move: StraddleMove;
}

/** Vol-normalized dollar GEX aggregates. Sign matches raw net_gex; magnitude is / vol. */
export interface VolNormalizedGex {
  net_gex: number;
  call_gex: number;
  put_gex: number;
  total_gex: number;
  /** Decimal annualized vol actually used (e.g. 0.22). */
  vol_used: number;
  /** `atm_iv` preferred; `hv_30d` only when ATM IV is missing. */
  vol_basis: 'atm_iv' | 'hv_30d';
  /** Honest basis for the desk / methodology. */
  basis_note: string;
}

// ---- Straddle-implied move (tradeable-rec-inputs INTERFACE_CONTRACT §2) ------------------------
// Additive `market_state` member, attached AFTER `generate_signals`. Always an object (never a bare
// null) carrying a closed `state`; the FE renders every state/basis/anchor by closed lookup on the
// wire token and never re-derives one from a scalar or a null (`[digested-labels-not-raw-dump]`,
// `[absent-is-not-none]`). STATIC — never a scoring input, never on SSE.
export type StraddleMoveState = 'ok' | 'no_quote' | 'not_computed' | 'no_expiration_in_window';
export type MoveBasis = 'atm_straddle_mid' | 'iv_derived_estimate';
/** One inhabitant today — the levels anchor (`gex_spot`), never the live display price. */
export type MoveAnchorBasis = 'gex_spot';

export interface StraddleTenor {
  expiration: string;
  dte: number;
  strike_used: number;
  strike_distance_pct: number;
  straddle_price: number;
  move_dollars: number;
  /** Percent OF `anchor_spot` — never of the live display price. */
  move_pct: number;
  basis: MoveBasis;
  quote_spread_pct_of_mid: number | null;
  wide_quotes: boolean;
}

export interface StraddleMove {
  state: StraddleMoveState;
  as_of: string | null;
  session_basis: string | null;
  anchor_spot: number | null;
  anchor_basis: MoveAnchorBasis;
  /** The words the basis line renders for the anchor — rendered VERBATIM by the client. */
  anchor_label: string;
  /** The tenor the UI renders by default; selected server-side by the same rule that selects the
   *  candidate tenors. The client never picks by array order or by comparing DTEs. */
  primary_expiration: string | null;
  wide_quote_threshold_pct: number;
  /** <= 3, ascending by DTE. Sparse tenors are omitted, never emitted null. */
  tenors: StraddleTenor[];
}

// ---- Candidate contract set (tradeable-rec-inputs INTERFACE_CONTRACT §1) -----------------------
// `GET /api/candidates/{ticker}` — the dedicated deliberate pull, and the shape reused verbatim by
// `sent.candidates` (in-app rec) and `context.candidates` (export). Never on the bundle, never on
// SSE, never on a passive page load (AC-1). STATIC (chain-snapshot derived).
export type CandidateSetState = 'ok' | 'none_in_band' | 'unavailable';
export type CandidateBudget = 'handoff' | 'prompt';
export type QuotePresence = 'quoted' | 'no_two_sided_quote';
export type IvState = 'priced' | 'unpriced';
export type SpreadBand = 'tight' | 'moderate' | 'wide' | 'unknown';

export interface CandidateGreeks {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

/** One candidate contract. A no-quote contract is INCLUDED carrying `quote_presence`, never
 *  dropped (AC-11). `iv`/greeks are `null` iff `iv_state === 'unpriced'`; `0.0` never ships as an
 *  IV or a greek (the vendor's unpriced sentinel, AC-12). */
export interface CandidateContract {
  expiration: string;
  dte: number;
  strike: number;
  right: OptionRight;
  /** Signed distance from `anchor_spot`, percent. */
  distance_pct: number;
  quote_presence: QuotePresence;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread_abs: number | null;
  spread_pct_of_mid: number | null;
  open_interest: number;
  volume: number;
  iv_state: IvState;
  iv: number | null;
  greeks: CandidateGreeks;
}

export interface CandidateCaps {
  tenors: number;
  rights: number;
  strikes_per_tenor_right: number;
  max_records: number;
  max_bytes: number;
}

export interface CandidateIncluded {
  contracts: number;
  expirations: string[];
  expiration_count: number;
}

/** Five closed reasons, fixed evaluation order, each contract counted EXACTLY once. */
export interface CandidateOmittedByReason {
  outside_window: number;
  outside_band: number;
  no_interest: number;
  expiration_cap: number;
  strike_cap: number;
}

export interface CandidateOmitted {
  total: number;
  expirations_omitted_by_cap: number;
  by_reason: CandidateOmittedByReason;
}

export interface CandidateLiquidity {
  quoted: number;
  no_two_sided_quote: number;
  atm_relative_spread_band: SpreadBand;
  wide_quotes: boolean;
  wide_quote_threshold_pct: number;
}

export interface CandidateSetEnvelope {
  ticker: string;
  state: CandidateSetState;
  as_of: string | null;
  snapshot_age_seconds: number | null;
  session_basis: string | null;
  /** Set-level only, one member in v1 (rule 2 — no per-quote freshness/session label exists). */
  quote_age: 'unknown';
  anchor_spot: number | null;
  anchor_basis: MoveAnchorBasis;
  /** Payload-stated constant (15.0), never a caller-tunable query knob. */
  band_pct: number;
  budget: CandidateBudget;
  /** `false` on the dedicated read; `true` on `sent.candidates` (the in-app prompt). */
  sent_to_model: boolean;
  caps: CandidateCaps;
  included: CandidateIncluded;
  omitted: CandidateOmitted;
  liquidity: CandidateLiquidity;
  contracts: CandidateContract[];
}

/** GET /api/candidates/{ticker} — the deliberate pull. Anonymous-ok, STATIC, never a vendor request
 *  on any path. `404` only when the ticker has no chain at all; everything else is `200` with a
 *  stated `state` (empty band / all dropped / assembly failed) — never invented by the FE. */
export async function getCandidates(
  symbol: string,
  opts: { minDte?: number; maxDte?: number; budget?: CandidateBudget } = {},
): Promise<CandidateSetEnvelope> {
  const params = new URLSearchParams();
  if (opts.minDte != null) params.set('min_dte', String(opts.minDte));
  if (opts.maxDte != null) params.set('max_dte', String(opts.maxDte));
  if (opts.budget) params.set('budget', opts.budget);
  const qs = params.toString();
  const res = await fetch(`/api/candidates/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new ApiError(`Candidates unavailable (${res.status})`, res.status);
  return (await res.json()) as CandidateSetEnvelope;
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
  volume: number | null; // per-strike session volume
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
  /** Additive score breakdown (same shape as ScanScoreDrivers) when the engine emits it. */
  score_drivers?: ScanScoreDrivers | null;
}

/** Sibling of ai_eval, present only when the bundle request carries an open-position context
 *  (pos_* query params); null otherwise. Drives once-per-event reassessment-alert de-dupe. */
export interface PositionEval {
  changed: boolean; // raw de-dupe: flips once when the position fingerprint moves
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
export type StageName =
  'vendor_fetch' | 'engine_build' | 'off_exchange' | 'signals' | 'persist' | 'serialize_wrap';
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
  price: number; // print price
  shares: number; // print size
  notional: number; // price * shares (the backend's ranking key)
  proximity_pct: number; // SIGNED ratio vs spot: + above, − below (e.g. 0.004 = +0.4%)
  age_seconds: number; // age of the print within the recent window
}

export interface OffExchange {
  ratio_pct: number | null; // off-exchange share of total volume in the window
  offex_shares: number;
  total_shares: number;
  levels: OffExchangeLevel[];
  blocks: BlockPrint[]; // largest-notional first, top-5; may be [] (none ≥ threshold)
  block_min_shares: number; // active block threshold (shares) for this cycle; label "no blocks ≥ N"
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
export interface OptionQuote {
  bid: number;
  ask: number;
  mid: number;
}
/** Each greek may be null (unpriced contract). */
export interface OptionGreeks {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}
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

export interface ReplacementContract {
  expiration: string;
  strike: number;
  right: OptionRight;
}
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
  darkPool?: boolean; // include off-exchange context + confluence (default backend setting)
  // Open-position context → makes the bundle compute position_eval. Absent ⇒ position_eval null.
  position?: { expiration: string; strike: number; right: OptionRight; plPct?: number };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- User accounts (auth + per-user settings; INTERFACE_CONTRACT user-accounts) ---------------
// The auth surface is a NEW HTTP-status-bearing class (NOT the null-on-failure bundle rule). The
// FE learns auth state ONLY from `getSession` (who-am-I); it never reads the HTTP-only session
// cookie. The browser holds ONLY the cookie — NO session id / signing key / secret EVER appears in
// any response body (AC-H1/H2). Errors carry `{error, message}`; the FE maps off the `error` code.
//
// CRITICAL: the bundle/SSE path (`getTicker`/`streamTicker`) is UNTOUCHED — these auth calls add NO
// header and NO query param to it (AC-I2). They are a separate concern.

/** One of `"dark"`/`"light"`/`"system"` — the only valid theme values (INTERFACE §2.1). */
export type ThemePref = 'dark' | 'light' | 'system';

// ---- Risk inputs (tradeable-rec-inputs INTERFACE_CONTRACT §4) ----------------------------------
// Owner-entered, per-user, server-side; lives on the existing settings record. `0` is a LEGAL entry
// (never an encoding of "unset" — `Option<T>` everywhere on the wire); a zero ENTRY is refused by
// validation (AC-36). The effective dollar cap is derived exactly once, server-side — the client
// performs NO arithmetic on the owner's entered values.
export type CapUnit = 'usd' | 'percent';
export interface PerTradeCap {
  value: number;
  unit: CapUnit;
}
export type EffectiveDollarCapState = 'derived' | 'not_derivable' | 'not_set';
export type NotDerivableReason = 'percent_without_account_size';
export interface EffectiveDollarCap {
  state: EffectiveDollarCapState;
  /** Derived exactly once, server-side. Never computed client-side. */
  value: number | null;
  not_derivable_reason: NotDerivableReason | null;
  /** What the figure was derived from — so the UI can label it *derived from your inputs*, never
   *  *validated* / *checked* / *enforced*. */
  derived_from: { account_size: number | null; cap_value: number | null; cap_unit: CapUnit | null };
}
export type RiskInputsState = 'set' | 'not_set';
export interface RiskInputs {
  state: RiskInputsState;
  /** `null` = not set. `0` is a legal entry, never an encoding of unset. */
  account_size: number | null;
  per_trade_cap: PerTradeCap | null;
  /** Always an object, never null. */
  effective_dollar_cap: EffectiveDollarCap;
  storage_available: boolean;
  updated_at: number | null;
}

/** The owner-entered PATCH shape for `PUT /api/auth/settings` — each fact independently clearable
 *  (send `null` to clear). Distinct from the read shape `RiskInputs`: the effective cap / storage
 *  flag / timestamp are server-derived and never sent by the client. */
export interface RiskInputsPatch {
  account_size?: number | null;
  per_trade_cap?: PerTradeCap | null;
}

/** The 3 light, presentation-only prefs (D7). NEVER read by signals/engine/scoring/fingerprint
 *  (AC-F4) — they only change which default a UI lands on. */
export interface UserSettings {
  active_persona_id: string | null; // null ⇒ app default (Default persona)
  default_ticker: string | null; // null ⇒ app default (TSLA)
  theme: ThemePref;
  // Risk inputs (tradeable-rec-inputs) — OPTIONAL key so an older backend degrades to `not_set`,
  // never a throw (mirrors `RecStatus.scenarios` at the ai-rec-backtest-orders precedent).
  risk_inputs?: RiskInputs;
  // ai-providers — standing preference (single writer). Optional so an older session echo
  // degrades to nulls rather than throwing.
  ai_power_path?: PowerPath | null;
  ai_provider?: ByoProvider | null;
  ai_model?: string | null;
}

/** Authenticated identity (never the raw email as id; `id` is opaque + stable). */
export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  auth_methods: string[]; // e.g. ["password"] or ["password","google"]
}

/** The server-authoritative who-am-I read. ALWAYS 200 (anonymous is a normal result). Drives
 *  signed-in-vs-anonymous, identity, the config-gated Google flag, and the per-user settings. */
export interface SessionStatus {
  authenticated: boolean;
  user: AuthUser | null; // null when anonymous
  google_available: boolean; // D9 config flag — drives present-disabled↔present-enabled
  settings: UserSettings | null; // null when anonymous (FE uses client-local stores instead)
  // DEV-ONLY: present (with the seeded email) when the backend seeded a fixed test account
  // (SEED_TEST_ACCOUNT, non-postgres); null in production. Lets the login form pre-fill it.
  demo_seed?: { email: string } | null;
}

/** The auth-class error codes the FE maps to copy (INTERFACE §2). `auth_required` is the gated-action
 *  + settings-401 code; `auth_unavailable` is the subsystem-degraded code. */
export type AuthErrorCode =
  | 'email_taken'
  | 'validation'
  | 'bad_credentials'
  | 'auth_required'
  | 'auth_unavailable'
  | 'google_unavailable'
  /** Owner lockdown (2026-08-06): registration is closed. A POLICY refusal, not a fault — the FE
   *  must not fold it into `auth_unavailable`, which claims a transient problem. */
  | 'signups_closed';

/** A typed auth failure carrying the server `error` code + safe `message`. The FE maps off `code`;
 *  `message` is a fallback only (never enumerating, never a secret/hash/password). */
export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Parse a non-2xx auth response into an `AuthError` (INTERFACE §1 error envelope). Falls back to a
 *  generic code/message when the body is absent or malformed — but never invents a misleading code. */
async function toAuthError(res: Response): Promise<AuthError> {
  let code: AuthErrorCode = 'auth_unavailable';
  let message = 'Something went wrong. Please try again.';
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body && typeof body.error === 'string') code = body.error as AuthErrorCode;
    if (body && typeof body.message === 'string') message = body.message;
  } catch {
    // No/garbled JSON body — fall back by status so the FE still maps a sensible state.
    if (res.status === 503) code = 'auth_unavailable';
    else if (res.status === 422) code = 'validation';
    else if (res.status === 409) code = 'email_taken';
    else if (res.status === 401) code = 'bad_credentials';
    else if (res.status === 403) code = 'auth_required';
  }
  return new AuthError(code, message, res.status);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** GET /api/auth/session — who-am-I. ALWAYS 200 server-side; on a TRANSPORT fault (network / non-200)
 *  this REJECTS so the caller can record `subsystem_degraded` and treat the result as anonymous —
 *  it never throws into the trader path (the caller degrades). Sends the cookie automatically. */
export async function getSession(): Promise<SessionStatus> {
  const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`Session read failed (${res.status})`, res.status);
  return (await res.json()) as SessionStatus;
}

export interface SignupRequest {
  email: string;
  password: string;
  display_name?: string | null;
}
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /api/auth/signup — success ⇒ the signed-in identity shape (a cookie is set). Throws
 *  `AuthError` with `email_taken`(409) / `validation`(422) / `auth_unavailable`(503) on failure. */
export async function signup(body: SignupRequest): Promise<SessionStatus> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as SessionStatus;
}

/** POST /api/auth/login — success ⇒ identity shape (cookie set). Throws `AuthError` with
 *  `bad_credentials`(401, NON-ENUMERATING) / `validation`(422) / `auth_unavailable`(503). The 401
 *  message is identical for unknown-email vs wrong-password (AC-C3/H3) — the FE renders fixed copy. */
export async function login(body: LoginRequest): Promise<SessionStatus> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as SessionStatus;
}

/** POST /api/auth/logout — idempotent; 200 regardless of prior state. After this, who-am-I reports
 *  anonymous. Best-effort: a transport fault is swallowed (the FE still re-reads who-am-I). */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* best-effort — the caller re-reads who-am-I regardless */
  }
}

/** The write-side patch shape: the 3 light prefs plus the optional risk-inputs patch (a different
 *  shape from the read-side `UserSettings.risk_inputs`, since the effective cap/storage flag/
 *  timestamp are server-derived and never sent). */
export interface UserSettingsPatch extends Partial<Omit<UserSettings, 'risk_inputs'>> {
  risk_inputs?: RiskInputsPatch;
}

/** PUT /api/auth/settings — signed-in ⇒ echoes the full saved bag (server-wins, D7). Anonymous ⇒
 *  401 `auth_required` (anonymous prefs stay client-local). 422 `validation` on a bad theme or a
 *  refused risk-input entry (dollar cap exceeding account size, percent outside (0,100], non-numeric
 *  or non-positive — the server refusal is authoritative; nothing is stored on a refusal). */
export async function saveSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  const res = await fetch('/api/auth/settings', {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as UserSettings;
}

/** POST /api/positions/sim-trade/gate — the SERVER-ENFORCED auth gate for Positions sim-trade WRITE
 *  actions (open/edit/close a sim position, place a resting limit, save a named view, accept an AI rec
 *  into the tracker — D6a/D6e, INTERFACE §2.8). The FE awaits this BEFORE the local localStorage write
 *  so enforcement is server-side, not FE-only (AC-E7): the FE auth check is UX sugar; THIS is the
 *  boundary of record. Positions data stays CLIENT-LOCAL — this carries no positions payload and the
 *  request body is empty; the server resolves the session from the HTTP-only cookie. The Positions
 *  ROUTE is never gated (viewable anonymously, AC-E3) — only these writes call this.
 *
 *  Success ⇒ 200 `{ authorized: true }`. With no valid session ⇒ 403 `auth_required` (⇒ AuthError, the
 *  FE shows the sign-in prompt and ABORTS the write). On an auth-subsystem fault ⇒ 503 `auth_unavailable`
 *  (⇒ AuthError, the "couldn't reach sign-in" copy). Mirrors `requestRecommendation`'s auth-class
 *  handling exactly. NEVER touches the bundle/SSE path (no new header/param there — AC-I2). */
export async function simTradeGate(): Promise<{ authorized: true }> {
  const res = await fetch('/api/positions/sim-trade/gate', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
  });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as { authorized: true };
}

// ---- Scanner v1 (scanner INTERFACE_CONTRACT §2–§3) ---------------------------------------------
// The scan surface is POLL-BASED: four plain REST calls, NO SSE, NO per-row stream
// (`[live-vs-static-isolation]`). Three anonymous-open READS (always 200 server-side; a transport
// fault REJECTS here so the caller degrades to its last-known rows) + one server-gated WRITE (a real
// 403 `auth_required` signed-out — `[server-side-gate-enforcement]`; the FE check is UX only).
// Every field name/type below is the FIXED P1 wire (`ScanRow.to_wire()` / `SweepHeartbeat.to_wire()`)
// as pinned in INTERFACE §2 — do NOT rename or add keys.

/** The closed per-row status vocabulary (INTERFACE §2.2). The FE renders it via a CLOSED LOOKUP and
 *  never re-derives it; an unknown value is treated as unavailable (fail-honest), never guessed. */
export type ScanStatus = 'ok' | 'stale' | 'error' | 'building';

/** One scan row. EVERY numeric field is nullable (a partial/failed compute still yields an honest
 *  row) and renders as honestly-missing — never `0`, never a fabricated value. No raw series ever
 *  rides a row (`[digested-labels-not-raw-dump]`). */
/** Additive score breakdown from quant-engine (optional on older payloads). */
export interface ScanScoreDrivers {
  proximity: number; // 0–40 nearest level
  vol: number; // 0–25 |IV/HV−1|
  setups: number; // 0–25 setup count
  transition: number; // 0 or 10 near flip
  dark_pool: number; // 0–6 confluence bonus
  total: number; // equals score
}

export interface ScanRow {
  symbol: string; //                    canonical UPPER-case
  price: number | null; //              last poll price
  chg_pct: number | null; //            % change since prior session close
  score: number | null; //              opportunity_score — CONSUMED, never re-derived
  tier: string | null; //               opportunity_tier enum (closed FE lookup)
  regime: string | null; //             regime label enum (closed FE lookup)
  vol_regime: string | null; //         vol-regime label enum (closed FE lookup)
  flip: number | null; //               gamma flip level
  dist_to_flip_pct: number | null; //   signed % of price to the flip (display transport)
  call_wall: number | null;
  put_wall: number | null;
  dist_to_wall_pct: number | null; //   signed % of price to the NEARER wall
  /** Epoch-SECONDS of the compute that produced the row. NOT nullable — and for a synthesized
   *  `building` row it is NOT a freshness claim, so the FE MUST branch on `status === 'building'`
   *  BEFORE rendering any "Updated …" text (INTERFACE §3.1, PINNED). */
  as_of: number;
  status: ScanStatus;
  /** Optional score drivers — prefer over FE heuristics when present. */
  score_drivers?: ScanScoreDrivers | null;
}

/** The closed sortable-key set the FE may offer (INTERFACE §2.3). Sorting is a CLIENT-SIDE re-order
 *  of the returned rows; it never re-derives a value and never refetches. */
export type ScanSortKey =
  'score' | 'symbol' | 'price' | 'chg_pct' | 'dist_to_flip_pct' | 'dist_to_wall_pct';
export interface ScanViewSort {
  key: ScanSortKey;
  dir: 'asc' | 'desc';
}
export type ScanDensity = 'compact' | 'comfortable';

/** The caller's effective view. `symbols` IS the display ordering. */
export interface ScanView {
  source: 'account' | 'default'; //  where THIS response's view came from
  authenticated: boolean; //         whether the caller is signed in
  name: string | null; //            optional user label; null for the default view
  symbols: string[]; //              subset ⊆ universe, IN DISPLAY ORDER
  sort: ScanViewSort; //             default { key: 'score', dir: 'desc' }
  density: ScanDensity; //           default 'compact'
}

/** Sweep metadata (INTERFACE §2.4). The FE derives "sweep last ran X ago" from these epochs vs its
 *  own clock; the wire carries NO pre-rendered freshness copy. */
export interface SweepHeartbeat {
  updated_at: number; //                   last worker tick (epoch seconds)
  sweep_last_completed: number | null; //  epoch seconds of the last COMPLETED full pass, or null
  universe_size: number; //                symbols the worker is tracking
}

/** `GET /api/scan` (INTERFACE §3.1). Every symbol in `view.symbols` is present in `rows`
 *  (building-fill) — the screen is never dead. `sweep` is null iff the worker never wrote one. */
export interface ScanResponse {
  view: ScanView;
  rows: ScanRow[];
  sweep: SweepHeartbeat | null;
}

/** `GET /api/scan/universe` (INTERFACE §3.2). Read-only — v1 has no add/request/remove path. */
export interface ScanUniverse {
  symbols: string[];
  universe_size: number;
}

/** `PUT /api/scan/view` body (INTERFACE §3.4). `symbols` is required and must be a subset of the
 *  CURRENT universe, in display order; the server 422s anything else. */
export interface ScanViewWrite {
  symbols: string[];
  name?: string | null;
  sort?: ScanViewSort;
  density?: ScanDensity;
}

/** GET /api/scan — the requested-or-default view as slim rows + sweep metadata. Anonymous-open;
 *  server-side it is best-effort ALWAYS 200 (a store outage degrades CONTENT, never the status), so a
 *  non-2xx here means a TRANSPORT/proxy fault: we reject and the caller keeps its last-known rows. */
export async function getScan(): Promise<ScanResponse> {
  const res = await fetch('/api/scan', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`Scan read failed (${res.status})`, res.status);
  return (await res.json()) as ScanResponse;
}

/** GET /api/scan/universe — the read-only owner-curated universe for the view editor. */
export async function getScanUniverse(): Promise<ScanUniverse> {
  const res = await fetch('/api/scan/universe', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`Universe read failed (${res.status})`, res.status);
  return (await res.json()) as ScanUniverse;
}

/** GET /api/scan/view — the caller's effective view. Anonymous ALWAYS gets a readable default; a
 *  READ is never gated. (The page reads the view off `getScan()`; this exists for the editor's
 *  reconciliation + parity with the wire.) */
export async function getScanView(): Promise<ScanView> {
  const res = await fetch('/api/scan/view', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`View read failed (${res.status})`, res.status);
  return (await res.json()) as ScanView;
}

/** The scan-view WRITE's error envelope differs by status: 403/503 use the auth `{error, message}`
 *  envelope, while the 422 validation refusal uses FastAPI's `{detail}`. Map both into the typed
 *  `AuthError` so `useGate` can translate `auth_required` → the sign-in prompt, `auth_unavailable` →
 *  the degraded copy, and re-throw `validation` to the caller's own inline handling. */
async function toScanViewError(res: Response): Promise<AuthError> {
  if (res.status === 422) {
    let detail = 'That view is not valid.';
    try {
      const body = (await res.clone().json()) as { detail?: string };
      if (body && typeof body.detail === 'string') detail = body.detail;
    } catch {
      /* no/garbled body — keep the safe fallback */
    }
    return new AuthError('validation', detail, 422);
  }
  return toAuthError(res);
}

/** PUT /api/scan/view — the ONE server-gated, state-bearing scanner action
 *  (`[server-side-gate-enforcement]`). Signed-in ⇒ 200 echoing the SAVED view (server-wins).
 *  Signed-out ⇒ a REAL 403 `auth_required` even if the FE guard is bypassed/absent, and NOTHING is
 *  persisted (AC-3). Off-universe symbol / bad sort / bad density ⇒ 422 `validation` (AC-13).
 *  Auth-subsystem fault ⇒ 503 `auth_unavailable`. Never touches the bundle/SSE path. */
export async function saveScanView(view: ScanViewWrite): Promise<ScanView> {
  const res = await fetch('/api/scan/view', {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
    body: JSON.stringify(view),
  });
  if (!res.ok) throw await toScanViewError(res);
  return (await res.json()) as ScanView;
}

/** One slow-lane structure snapshot (not a live price tick). Chronological on the wire. */
export interface StructureSample {
  symbol: string;
  as_of: number; // epoch seconds of the structure recompute
  price: number | null;
  score: number | null;
  tier: string | null;
  regime: string | null;
  vol_regime: string | null;
  flip: number | null;
  dist_to_flip_pct: number | null;
  call_wall: number | null;
  put_wall: number | null;
  dist_to_wall_pct: number | null;
  /** Additive score breakdown when the engine emitted it (research capture spine). */
  score_drivers?: ScanScoreDrivers | null;
  /** Dollar net GEX at capture (optional research field). */
  net_gex?: number | null;
  /** ATM IV (%) / HV (%) when both available. */
  iv_hv_ratio?: number | null;
  /** ATM IV as decimal (0.22 = 22%) at capture. */
  atm_iv?: number | null;
  /** 30d HV percent annualized at capture. */
  hv_30d?: number | null;
}

/** `GET /api/scan/{symbol}/history` — durable structure path for the ticker Structure zone. */
export interface StructureHistoryResponse {
  symbol: string;
  samples: StructureSample[];
  /** Server basis string (slow-lane only, thinned, capped). */
  basis: string;
  /** Total samples stored for this symbol (may exceed samples.length when limited). */
  stored_count?: number;
  /** Scan store backend: `json` | `postgres`. */
  backend?: string;
}

/** GET /api/scan/{symbol}/history — anonymous-open structure history. Empty samples is honest
 *  cold-start, not an error. Transport faults reject so the caller can keep last-known path. */
export async function getStructureHistory(
  symbol: string,
  limit = 48,
  fetchOpts: FetchOpts = {},
): Promise<StructureHistoryResponse> {
  const sym = encodeURIComponent(symbol.trim().toUpperCase());
  const q = limit > 0 ? `?limit=${Math.min(limit, 96)}` : '';
  const res = await fetch(`/api/scan/${sym}/history${q}`, {
    credentials: 'same-origin',
    signal: fetchOpts.signal,
  });
  if (!res.ok) throw new ApiError(`Structure history failed (${res.status})`, res.status);
  return (await res.json()) as StructureHistoryResponse;
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
  live: boolean; // true only if a real tick arrived recently (else mid is stale)
  tick_age_s: number | null;
  market_session: string; // premarket | regular | afterhours | overnight | closed
  feed: string; // "realtime" | "delayed"
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
  onUpdate: (u: LiveUpdate) => void,
): () => void {
  const params = new URLSearchParams();
  if (minDte != null) params.set('min_dte', String(minDte));
  if (maxDte != null) params.set('max_dte', String(maxDte));
  if (expirations && expirations.length) params.set('expirations', expirations.join(','));
  const qs = params.toString();
  const es = new EventSource(`/api/stream/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  es.onmessage = (e) => {
    try {
      onUpdate(JSON.parse(e.data) as LiveUpdate);
    } catch {
      /* ignore malformed */
    }
  };
  // onerror: EventSource auto-reconnects; nothing to do.
  return () => es.close();
}

/** Full bundle for one ticker, optionally filtered by DTE window or explicit expirations. When
 *  `position` is supplied, the bundle additionally returns `position_eval` (else null). */
export type FetchOpts = {
  /** Abort in-flight work on ticker/route change (perf §3.2). */
  signal?: AbortSignal;
};

export async function getTicker(
  symbol: string,
  { minDte, maxDte, expirations, darkPool, position }: TickerQuery = {},
  fetchOpts: FetchOpts = {},
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
  const res = await fetch(`/api/ticker/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`, {
    signal: fetchOpts.signal,
  });
  if (!res.ok) {
    const detail =
      res.status === 404
        ? `No option-chain data for ${symbol.toUpperCase()}`
        : res.status === 429
          ? `Rate limited (${res.status})`
          : `API error ${res.status}`;
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
  { expiration, strike, right }: { expiration: string; strike: number; right: OptionRight },
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

export interface MetricsLatency {
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  count: number;
}
export interface MetricsStage {
  stage: StageName;
  kind: StageKind;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  count: number;
  ok: number;
  error: number;
  skipped: number;
}
export interface MetricsCache {
  hits: number;
  misses: number;
  hit_ratio: number;
  current_data_age_seconds: number;
}
export interface MetricsVendor {
  call_count: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
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
  dims: {
    min_dte: number | null;
    max_dte: number | null;
    expirations_present: boolean;
    dark_pool: boolean;
  };
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
  reassessment_lean: string; // declarative lean within the fixed schema/cap (text)
  emphasis_note?: string | null; // bounded free-text; fills the framing slot ONLY
  dte_pref?: { min_dte: number; max_dte: number } | null;
  // FE framing copy (presets carry preset-specific text; customs derive generic text):
  summary?: string;
  objective_framing?: string;
  risk_calibration?: string;
  based_on?: string; // for customs: the preset id it was derived from
}

export type HandoffSectionKind = 'fixed' | 'persona';
/** One labelled prompt section, badged FIXED ("same under every persona") or PERSONA. */
export interface HandoffSection {
  id: string;
  kind: HandoffSectionKind;
  label: string;
}
export interface HandoffPrompt {
  text: string;
  sections: HandoffSection[];
}
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

// ---- ai-providers (INTERFACE_CONTRACT ai-providers) ------------------------------------------
// Provenance / power-path tokens. NEVER scoring inputs. `shared_admin` is retired as a product
// path — poison fixtures may still assign the string via a cast, never as a live union member.
export type ByoProvider = 'anthropic' | 'openai' | 'xai' | 'gemini';
export const BYO_PROVIDERS: readonly ByoProvider[] = [
  'anthropic',
  'openai',
  'xai',
  'gemini',
] as const;
export type PowerPath = 'own_key' | 'grok_subscription';
export type KeySource = 'own_key' | 'grok_subscription' | 'none';
export type GrokUnavailableReason = 'subscription_unavailable' | 'oauth_unlinked' | 'oauth_expired';
export type PoweringUnavailableReason =
  | 'no_key'
  | 'subscription_unavailable'
  | 'oauth_unlinked'
  | 'oauth_expired'
  | 'storage_unavailable'
  | 'model_not_in_catalog'
  | 'model_missing'
  | 'model_unset'
  | 'key_unusable'
  | 'key_rejected';
/** @deprecated Retired with free-uses. Kept only so older fixtures type-check via widening. */
export type ByoUnavailableReason = PoweringUnavailableReason;
export type RecBias = 'long' | 'short' | 'neutral' | 'volatility';
export type RecConfidence = 'low' | 'medium' | 'high';
export type RecGateState = 'available' | 'no_fresh_edge' | 'cooling_down';

// ---- Open-positions digest (tradeable-rec-inputs INTERFACE_CONTRACT §5) ------------------------
// CLIENT-supplied, bounded, NEVER persisted server-side. `source` is a one-inhabitant closed enum —
// an unlabelled digest is unconstructable — so a future broker source is an additive variant, not a
// shape change. `state` is the reconciled three-member vocabulary: `none_open` (checked, empty) ·
// `not_sent` (old client / disabled / faulted-to-absent) · `unavailable` (the store faulted).
export type OpenPositionsSource = 'simulated';
export type OpenPositionsState = 'none_open' | 'not_sent' | 'unavailable';
export type MaxLossState = 'known' | 'ineligible';
export interface OpenPositionsMaxLoss {
  state: MaxLossState;
  value: number | null;
  reason: string | null;
}
export interface OpenPositionsThisUnderlying {
  direction: string;
  leg_count: number;
  nearest_expiry_dte: number;
  max_loss: OpenPositionsMaxLoss;
}
export interface OpenPositionsPortfolio {
  open_count: number;
  capital_at_risk: number | null;
}
export interface OpenPositionsDigest {
  source: OpenPositionsSource;
  state: OpenPositionsState;
  this_underlying: OpenPositionsThisUnderlying | null;
  portfolio: OpenPositionsPortfolio | null;
}

/** POST body for a rec request. Carries NO bundle payload and NO key — only identifiers + the
 *  gating context already on the page (INTERFACE §1.1). */
export interface RecRequest {
  persona_id: string | null; // the persona framing THIS read (per-query override ≠ active)
  snapshot_fingerprint: string; // ai_eval.state_fingerprint of the bundle on the page (pin/validate)
  dte_min: number | null; // the DTE window already on the page (carried, not new)
  dte_max: number | null;
  dark_pool: boolean; // whether off-exchange context is included (mirrors the page)
  override: boolean; // true ⇒ "Ask anyway" on a no_fresh_edge gate
  // ai-rec-backtest-orders (INTERFACE §1.1, additive): the OPTIONAL request-scoped scenario
  // selector. Absent/null ⇒ the shipped real path byte-for-byte (AC-45). Only ever non-null when
  // the operator picked a scenario from a server-advertised catalog (RecStatus.scenarios).
  scenario_id?: string | null;
  // tradeable-rec-inputs (INTERFACE §5, additive/optional): the client-supplied, bounded,
  // NEVER-persisted-server-side open-positions digest.
  open_positions?: OpenPositionsDigest;
}

/** ai-rec-backtest-orders (INTERFACE §1.3/§2): one catalog entry / the provenance identity of a
 *  scripted scenario. `id` = the stable selector token the POST echoes back as `scenario_id`;
 *  `name` = the human-readable display name, rendered verbatim (single-sourced from the server
 *  registry, AC-36). */
export interface RecScenarioInfo {
  id: string;
  name: string;
}

/** The risk-first strategy artifact. `decision: 'no_trade'` ⇒ trade fields null/empty + rationale. */
export interface RecStrategy {
  decision: RecDecision;
  bias: RecBias;
  structure: string | null;
  strikes: number[]; // concrete strike(s); [] allowed for no_trade
  expiration: string | null; // YYYY-MM-DD within [dte_min,dte_max]; null for no_trade
  entry_trigger: string | null;
  invalidation_level: number | null;
  max_risk: string | null;
  position_size: string | null;
  exit_plan: { target: number | null; stop: number | null };
  time_horizon: string | null;
  confidence: RecConfidence | null;
  // tradeable-rec-inputs (additive, optional — an older backend/local fallback omits it). Members
  // `call` / `put` / absent. NO DEFAULT: unlike the shipped `bias` coercion, an unrecognised or
  // absent right stays absent (never guessed) — see `cited_contract`.
  right?: OptionRight | null;
  // Structured reasoning (additive/optional — a rec may omit them; the FE degrades gracefully).
  summary?: string | null; // one-line verdict lead the reader scans first
  key_points?: string[]; // short scannable bullets, each citing a specific level
  reengage_when?: string[]; // concrete conditions that would change the call
  rationale: string; // the full prose (the "show full analysis" body)
}

export interface RecPersona {
  id: string | null;
  name: string;
}
export interface RecGate {
  state: RecGateState;
  cooldown_remaining_seconds: number;
  reasons: string[];
}
export interface RecCap {
  over_limit: boolean;
  remaining_today: number;
  resets_at: string;
}

/** Always HTTP 200. `status` drives the panel state machine; `strategy` present iff produced. */
export interface RecResponse {
  status: RecStatusKind;
  persona: RecPersona;
  as_of: string | null; // snapshot_iso the rec is pinned to (echoes the bundle's freshness)
  pinned_fingerprint: string; // state_fingerprint the rec was generated from (staleness key)
  stale_born: boolean; // bundle was already stale at generation time (honest-at-birth)
  strategy: RecStrategy | null; // present iff status === 'produced'
  unavailable_reason: string | null; // present iff status === 'unavailable'; NEVER leaks key text
  gate: RecGate; // gating snapshot AT THE TIME OF THIS RESPONSE
  cap: RecCap;
  // ai-providers (additive; INTERFACE_CONTRACT ai-providers). NEVER a `key` field — provenance
  // names what ran. `remaining_free_uses` / `free_uses_total` are retired product fields (optional
  // legacy ignore only — the UI must not advertise them).
  key_source?: KeySource;
  provider?: string | null;
  model?: string | null;
  remaining_free_uses?: number | null;
  free_uses_total?: number | null;
  // ai-rec-backtest-orders (INTERFACE §1.3, additive): scenario provenance. NON-NULL on EVERY
  // scenario-driven response (produced, scenario no_trade, AND fault scenarios); null/absent on
  // every real read. The FE keys the "SCRIPTED SCENARIO" marking off this field ONLY (D8-4).
  scenario?: RecScenarioInfo | null;
  // ---- tradeable-rec-inputs (additive; INTERFACE_CONTRACT §5) — present iff `status === 'produced'`
  // on a post-feature backend. Optional so an older backend degrades gracefully (never a throw): the
  // FE renders every one of these fields by closed lookup on the wire token, never by inspecting a
  // null, and performs NO arithmetic (the cap verdict + effective cap are computed once server-side
  // and pinned — never recomputed client-side).
  sent?: RecSent;
  cap_check?: CapCheck;
  field_reasons?: FieldReasons;
  cited_contract?: CitedContract;
  // ---- ai-rec-grounding (additive; INTERFACE_CONTRACT §1) — always present on every `base`-built
  // envelope. Absent ONLY from a pre-feature server (the one client-selected branch — a lookup on
  // PRESENCE, never a re-derivation from figures).
  grounding?: Grounding;
}

// ---- tradeable-rec-inputs response types (INTERFACE_CONTRACT §5) -------------------------------

/** Five members, evaluated in ONE fixed order server-side, first match wins — the frontend never
 *  re-derives this order. `not_applicable` (the rec states `no_trade`) resolves FIRST: the UI
 *  renders NO cap surface at all in that state — no comparison, no caveat, no `not set` literal. */
export type CapVerdict = 'not_applicable' | 'no_cap' | 'not_checkable' | 'within' | 'above';

export interface CapCheck {
  verdict: CapVerdict;
  /** Still carried when the verdict is `not_applicable`, so the drawer can show what would have
   *  been used. */
  effective_dollar_cap: number | null;
  cap_not_derivable_reason: NotDerivableReason | null;
  /** The output of the ONE server-side `max_risk` parse. */
  parsed_risk_dollars: number | null;
  /** The model's raw prose, so copy can attribute each half: Convexa performed the comparison, on a
   *  figure the AI asserted. */
  model_max_risk_text: string | null;
  /** ai-rec-grounding — the widened OUTPUT of the same ONE `max_risk` parse. Non-null IFF
   *  `parsed_risk_dollars` is null and the risk text was examined. Never rides `cap_not_derivable_reason`
   *  — the two tokens answer different questions and neither stands in for the other. */
  risk_refusal: RiskRefusal | null;
}

/** The declared dependency this field was missing, in FIXED priority order. `position_size` is the
 *  only field with two dependencies (risk block, then candidate quotes); when both are absent the
 *  token is `risk_block` (the input the owner can fix), deterministically.
 *  rec-absence-literals-hole — `candidate_set` is the new fourth member: it means the candidate SET
 *  the assembler inserted was empty, reachable on `strikes`/`expiration` only. */
export type MissingInput = 'risk_block' | 'candidate_quotes' | 'straddle_move' | 'candidate_set';

/** `null` when the field has a value; else the closed reason. Computed SERVER-SIDE from which
 *  blocks the assembler inserted — the model is never asked why it left a field blank.
 *  rec-absence-literals-hole — `unrecognized_value` is the new third member: the field was STATED but
 *  off Convexa's scale (reachable on `confidence` only). */
export interface FieldReason {
  reason: 'not_given' | 'unavailable' | 'unrecognized_value';
  missing_input: MissingInput | null;
}

export interface FieldReasons {
  max_risk: FieldReason | null;
  position_size: FieldReason | null;
  exit_target: FieldReason | null;
  exit_stop: FieldReason | null;
  /** ai-rec-grounding — same shape as its four siblings. Required so `Invalidation` can render through
   *  the shipped closed absence-literal set (`fieldLiteral`) now that it moves onto it. */
  invalidation_level: FieldReason | null;
  // rec-absence-literals-hole — the six plan/conviction fields. OPTIONAL (`?:`) because a pre-feature
  // server omits them entirely, and that state is renderable, not an error.
  structure?: FieldReason | null;
  strikes?: FieldReason | null;
  expiration?: FieldReason | null;
  entry_trigger?: FieldReason | null;
  time_horizon?: FieldReason | null;
  confidence?: FieldReason | null;
}

/** A cited contract exists only when the parsed rec yields EXACTLY ONE `(expiration, strike, right)`
 *  triple. `right_undetermined` is its own state — the strike/expiration WERE sent, so it must
 *  never render the `off_set` literal (that would assert a falsehood). */
export type CitedContractState = 'cited' | 'right_undetermined' | 'off_set' | 'none';

export interface CitedContract {
  state: CitedContractState;
  /** The matching §1 candidate record; present only for `cited`. */
  contract: CandidateContract | null;
  /** Both legs for `right_undetermined`, when the pair is available; otherwise empty. */
  legs: CandidateContract[];
}

// ---- ai-rec-grounding response types (INTERFACE_CONTRACT §1) ------------------------------------

/** Four members, ONE fixed order server-side, first match wins. Collapsing `not_checkable` into
 *  `untraced` is forbidden: it would stamp "matches nothing we own" on a number nobody could check. */
export type GroundingState = 'not_applicable' | 'not_checkable' | 'traced' | 'untraced';

/** Non-null IFF `state === 'traced'`, and CONSTRAINED PER FIELD: `exit_stop`/`invalidation_level` may
 *  emit only `exact`/`near`; `exit_target` only `inside_range`; the other two, none. */
export type MatchBasis = 'exact' | 'near' | 'inside_range';

export type NotCheckableReason =
  'structurally_unchecked' | 'no_named_level' | 'no_cited_expiration' | 'straddle_move_unavailable';

/** The eleven price-scale anchors, read off the SENT market_state. There is no cap member and there
 *  never will be one — that is what makes `traces to Convexa's risk cap (500)` unrenderable. */
export type AnchorKind =
  | 'gex_spot'
  | 'call_wall'
  | 'put_wall'
  | 'peak_gex_strike'
  | 'gamma_flip'
  | 'max_pain'
  | 'vwap'
  | 'vwap_upper_2'
  | 'vwap_upper_3'
  | 'vwap_lower_2'
  | 'vwap_lower_3';

export type GroundingCard =
  | 'not_applicable'
  | 'local_rules'
  | 'none_traced'
  | 'could_not_check'
  | 'some_traced'
  | 'all_traced';

/** Every key is ALWAYS present, `null` where the discriminator does not carry it. A client must not
 *  select a clause shape by inspecting which keys are non-null — switch on `state`, then `basis`, then
 *  `not_checkable_reason`. */
export interface GroundingField {
  state: GroundingState;
  basis: MatchBasis | null;
  anchor_kind: AnchorKind | null;
  anchor_value: number | null;
  range_low: number | null;
  range_high: number | null;
  expiration: string | null;
  not_checkable_reason: NotCheckableReason | null;
}

export interface GroundingCounts {
  checked: number;
  traced: number;
  untraced: number;
  /** Excludes every `structurally_unchecked` one; includes the cited contract when
   *  `right_undetermined`. Invariant: traced + untraced + not_checkable === checked. */
  not_checkable: number;
}

export interface Grounding {
  card: GroundingCard;
  counts: GroundingCounts;
  /** The payload-stated constant, once per response. Never per field, never a query knob. */
  tolerance_pct: number;
  fields: {
    exit_stop: GroundingField;
    exit_target: GroundingField;
    invalidation_level: GroundingField;
    max_risk: GroundingField;
    position_size: GroundingField;
  };
}

/** The widened OUTPUT of the ONE `max_risk` parse. Non-null IFF `parsed_risk_dollars` is null and the
 *  risk text was examined. The ACCEPTED INPUT SET did not move by one input. */
export type RiskRefusal = 'no_text' | 'no_dollar_figure' | 'multiple_different_figures';

/** The as-sent echo (§1.1 in-app rec). Pinned to the envelope alongside `pinned_fingerprint` — no
 *  consumer ever recomputes any of it. */
export interface RecSent {
  budget: 'prompt';
  /** The §1 envelope as actually sent, `sent_to_model: true`. */
  candidates: CandidateSetEnvelope;
  /** The tenors actually forwarded. Invariant: subset of the expirations in `sent.candidates`. */
  straddle_move_tenors: string[];
  /** The as-sent risk block (§4 shape) — the authoritative source for the drawer's *as sent with
   *  this recommendation* label. */
  risk_inputs: RiskInputs;
  /** Change detector for the superseded-inputs strip; compared against the currently stored block. */
  risk_inputs_digest: string;
  open_positions: OpenPositionsDigest;
}

/** `context.risk_inputs` on the export — the read-side shape, minus the storage/timestamp fields the
 *  export has no use for. Anonymous callers ALWAYS see `state: 'not_set'` — present, never omitted. */
export type ExportRiskInputs = Pick<
  RiskInputs,
  'state' | 'account_size' | 'per_trade_cap' | 'effective_dollar_cap'
>;

/** `context.open_positions` on the export. A GET carries no client digest, so `state` is always
 *  `not_sent` here — distinct from the in-app rec's richer three-member digest. */
export interface ExportOpenPositions {
  source: OpenPositionsSource;
  state: OpenPositionsState;
}

/** The serialization of the cached bundle plus this feature's additive sections. Indexable so a
 *  passthrough field (e.g. `market_state`) still reads without a throw. */
export interface RecExportContext {
  market_state?: { straddle_move?: StraddleMove } & Record<string, unknown>;
  candidates: CandidateSetEnvelope;
  risk_inputs: ExportRiskInputs;
  open_positions: ExportOpenPositions;
  [key: string]: unknown;
}

/** One egress-disclosure row. A category with `sent: false` renders an explicit `Not sent` line,
 *  never an omitted section (AC-92). */
export interface EgressCategory {
  key: 'context' | 'candidates' | 'risk_inputs' | 'open_positions' | 'persona_prompt' | 'glossary';
  sent: boolean;
}

/** The structured export that feeds BOTH the in-app call and the manual hand-off (INTERFACE §1.2).
 *  Triggers NO LLM call, costs nothing, available even when in-app AI is unavailable. Egress
 *  invariant: the enumeration follows what actually shipped — see `egress_categories`. */
export interface RecExport {
  ticker: string;
  as_of: string | null;
  context: RecExportContext; // serialization of the cached bundle (null stays null, no recompute)
  persona_prompt: string; // assembled persona prompt (server-side, canonical-sourced)
  glossary: string; // field-level reference
  egress_note: string; // server-composed from `egress_categories` (AC-90)
  // tradeable-rec-inputs (additive/optional — an older backend omits it; the FE falls back to the
  // shipped fixed egress copy rather than throwing).
  egress_categories?: EgressCategory[];
}

/** Gating + cap + availability without requesting a rec (INTERFACE §1.3). Side-effect-free, 200. */
export interface RecStatus {
  availability: { in_app_enabled: boolean }; // false ⇒ no key configured / feature off → inert in-app
  gate: RecGate;
  cap: RecCap;
  // Retired free-uses counters — optional legacy ignore only. Do not advertise.
  remaining_free_uses?: number | null;
  free_uses_total?: number | null;
  // ai-providers — standing powering probe. Optional so an older backend degrades (no powering
  // chrome) rather than throwing. Signed-out: key_source none, preference nulls, reason null.
  powering?: RecPowering;
  // ai-rec-backtest-orders (INTERFACE §2): the scenario advertisement. The wire ALWAYS carries it
  // after this feature (flag OFF ⇒ `{enabled:false, catalog:[]}` — the catalog is never enumerable
  // while disabled, D1/AC-34). Typed OPTIONAL here only as FE resilience against an older backend:
  // an absent field degrades exactly like `enabled:false` (no picker rendered) — never a throw.
  scenarios?: { enabled: boolean; catalog: RecScenarioInfo[] };
}

export interface RecPoweringPreference {
  power_path: PowerPath | null;
  provider: ByoProvider | null;
  model: string | null;
}

export interface RecPowering {
  key_source: KeySource;
  provider: string | null;
  model: string | null;
  unavailable_reason: string | null;
  preference: RecPoweringPreference;
}

/** Closed catalog model id the leaf will call. `recommended` is at most one true per list. */
export interface CatalogModel {
  id: string;
  recommended: boolean;
}

export interface CatalogProvider {
  provider: ByoProvider;
  models: CatalogModel[];
}

export interface AiProviderSlot {
  provider: ByoProvider;
  set: boolean;
  last4: string | null;
}

export interface GrokSubscriptionStatus {
  available: boolean;
  connected: boolean;
  unavailable_reason: GrokUnavailableReason | null;
}

export interface AiPreference {
  power_path: PowerPath | null;
  provider: ByoProvider | null;
  model: string | null;
}

/** GET/PUT/DELETE `/api/auth/ai-key` bootstrap. All keys always present. NEVER carries secrets. */
export interface AiProvidersBootstrap {
  storage_available: boolean;
  providers: AiProviderSlot[];
  grok: GrokSubscriptionStatus;
  preference: AiPreference;
  catalog: {
    providers: CatalogProvider[];
    grok_subscription: { provider: string; models: CatalogModel[] };
  };
}

/** @deprecated Use AiProvidersBootstrap. Kept as an alias so existing imports compile. */
export type AiKeyStatus = AiProvidersBootstrap;

/** GET /api/auth/ai-key — Settings + Ask-AI bootstrap (matrix, grok arm, preference, catalog).
 *  NEVER returns a secret. 403 ⇒ AuthError('auth_required') (anonymous). */
export async function getAiKeyStatus(): Promise<AiProvidersBootstrap> {
  const res = await fetch('/api/auth/ai-key', { credentials: 'same-origin' });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as AiProvidersBootstrap;
}

/** PUT /api/auth/ai-key — store/overwrite the BYO ciphertext for ONE closed provider slot.
 *  The client MUST send `provider`; the server must not retitle the slot from the key string.
 *  Returns the full bootstrap — NEVER echoes the key. Storage-unavailable is a 200 with
 *  `storage_available:false`, NOT a 5xx. */
export async function setAiKey(key: string, provider: ByoProvider): Promise<AiProvidersBootstrap> {
  const res = await fetch('/api/auth/ai-key', {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
    body: JSON.stringify({ key, provider }),
  });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as AiProvidersBootstrap;
}

/** DELETE /api/auth/ai-key?provider= — remove one BYO slot. Idempotent. 403 / 422 as documented. */
export async function removeAiKey(provider: ByoProvider): Promise<AiProvidersBootstrap> {
  const res = await fetch(`/api/auth/ai-key?provider=${encodeURIComponent(provider)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) throw await toAuthError(res);
  return (await res.json()) as AiProvidersBootstrap;
}

/** DELETE /api/auth/grok — unlink the Grok subscription. Session required. */
export async function disconnectGrok(): Promise<void> {
  const res = await fetch('/api/auth/grok', { method: 'DELETE', credentials: 'same-origin' });
  if (!res.ok) throw await toAuthError(res);
}

/** Browser navigation target for Connect Grok. Only used when `grok.available` is true. */
export const GROK_OAUTH_START = '/api/auth/grok/start';

// ---- Durable book (multi-device positions blob) ------------------------------------------------

export interface BookEnvelope {
  schema_version: number;
  updated_at: number;
  blob: Record<string, unknown>;
  source: string;
}

/** GET /api/book — signed-in server copy of positions v3 blob (empty when none). */
export async function getBook(): Promise<BookEnvelope> {
  const res = await fetch('/api/book', { credentials: 'same-origin' });
  if (res.status === 403 || res.status === 503) throw await toAuthError(res);
  if (!res.ok) throw new ApiError(`Book get failed (${res.status})`, res.status);
  return (await res.json()) as BookEnvelope;
}

/** PUT /api/book — push local blob; latest-wins by updated_at. */
export async function putBook(body: {
  schema_version?: number;
  updated_at?: number;
  blob: Record<string, unknown>;
}): Promise<BookEnvelope> {
  const res = await fetch('/api/book', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 403 || res.status === 503) throw await toAuthError(res);
  if (!res.ok) throw new ApiError(`Book put failed (${res.status})`, res.status);
  return (await res.json()) as BookEnvelope;
}

/** Request a rec (in-app LLM call). ALWAYS 200 for produced/no_trade/unavailable/gated_off — the
 *  `status` field distinguishes them. A non-2xx / network fault throws `ApiError`; the rec hook
 *  catches it and renders the `unavailable` panel state (never thrown to the page). No key is sent. */
export async function requestRecommendation(
  symbol: string,
  body: RecRequest,
): Promise<RecResponse> {
  const res = await fetch(`/api/recommendation/${symbol.toUpperCase()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  // user-accounts (D6f): the auth gate is the OUTERMOST precondition on the LLM invoke. A 403
  // `auth_required` / 503 `auth_unavailable` is an AUTH-class outcome — surface it as an `AuthError`
  // (NOT the ai-rec `unavailable` artifact) so the FE shows the sign-in / "couldn't reach" prompt
  // and NEVER ai-rec's cooldown/cap/no_key (AC-E4/E7/J1). All other non-2xx stay `ApiError`.
  if (res.status === 403 || res.status === 503) throw await toAuthError(res);
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
  const res = await fetch(
    `/api/recommendation/export/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`,
  );
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
  if (!Array.isArray(list) || list.length === 0)
    throw new ApiError('Malformed personas payload', 200);
  return list as PersonaDefinition[];
}
