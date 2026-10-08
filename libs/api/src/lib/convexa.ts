/**
 * Convexa API client — the frontend's single point of contact with the backend.
 * Components import from `@convexa/api` and never call `fetch` directly. This mirrors the
 * MarketDataProvider "port" on the backend: swap the implementation here and the rest of
 * the app is unaffected.
 */
import type { components } from '../generated/schema';
import { http } from './client';
import { dataMode } from './demo/mode';
export type { components };

/** IV skew at a single anchor tenor (nearest expiration >= 7 DTE). `slope` = put-side IV −
 *  call-side IV, in IV points; `reference` records which rule produced the reference IVs.
 *  Display-only; the FE derives the fear/greed/balanced word from `slope`. */
export type IvSkew = components['schemas']['IvSkewWire'];

/** Cross-tenor ATM-IV curve (ignores the DTE filter). `points` ascending by dte; sparse/absent
 *  tenors are omitted, never faked. `state` is server-emitted. */
export type TermStructure = Omit<components['schemas']['TermStructureWire'], 'state'> & {
  state: 'contango' | 'backwardation' | 'flat';
};

/** Projected-dealer-flow charm limb (dealer-flow-projection INTERFACE_CONTRACT §payload). Window-scoped
 *  (moves with the DTE filter, like net_gex/net_dex). All values pre-computed on the wire — the FE never
 *  does its own arithmetic. Independently nullable (null iff net_charm unavailable OR no future monthly
 *  OPEX). Signed $-delta values inherit the dealer-book convention (calls +, puts −). */
export type CharmLimb = components['schemas']['DealerFlowCharmWire'];

/** Projected-dealer-flow vanna limb. Instantaneous (no time horizon — its "horizon" is the vol-move
 *  magnitude). `illustrative_projected_delta` is PRE-SCALED on the wire (= net_vanna · 5) — the FE
 *  renders it DIRECTLY and never multiplies. `reference_direction` is `"increase"` (a vol drop is the
 *  exact negation; the FE states this, no second figure). Independently nullable (null iff net_vanna
 *  unavailable). */
export type VannaLimb = components['schemas']['DealerFlowVannaWire'];

/** A forward-looking projection of the delta dealers are expected to hedge, derived from the same
 *  window-scoped net_charm / net_vanna aggregates already in the bundle. STATIC (rides the cached REST
 *  bundle, never the SSE stream). Two independently-nullable limbs; the whole object is null only when
 *  BOTH limbs are unavailable OR the compute raised. Display/AI-context ONLY — never a scoring input
 *  (`[additive-keeps-score-byte-identical]`). */
export type DealerFlowProjection = components['schemas']['DealerFlowProjectionWire'];

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
export type TrendDirectionRead = components['schemas']['TrendDirectionWire'];

/** Trend strength (Wilder ADX(14)). Null under its floor / missing high-low. */
export type TrendStrengthRead = components['schemas']['TrendStrengthWire'];

/** Momentum state (Wilder RSI(14)). Null under its floor. */
export type MomentumStateRead = components['schemas']['MomentumStateWire'];

/** Trend & momentum read — three independently-nullable labels off the daily-bar series. Null when
 *  all 3 labels are null OR the read raised. */
export type TrendMomentumRead = components['schemas']['TrendMomentumWire'];

/** Shape scalars over the window-scoped net-GEX profile. ALL-OR-NULL (one compute; needs >= 5
 *  eligible strikes & sum|net_gex| > 0). When present every field is non-null. */
export type GexProfileShapeRead = components['schemas']['GexProfileShapeWire'];

/** Where today's volume sits vs standing OI, strike by strike. Independently nullable. */
export type DivergenceLocation = components['schemas']['DivergenceLocationWire'];

/** Which right today's volume favors vs the standing book. Independently nullable; when present
 *  ALL THREE scalars are non-null. */
export type DivergenceComposition = components['schemas']['DivergenceCompositionWire'];

/** Flow vs positioning read — null when BOTH sub-components are null OR the read raised. The flow
 *  basis is the chain snapshot's same-day cumulative option volume — UNSIGNED; never the SSE net
 *  flow; never tick data. */
export type FlowVsPositioningRead = components['schemas']['FlowVsPositioningWire'];

/** One ATR horizon. Independently nullable (a horizon without its full valid-bar tail is null —
 *  never a fabricated 0). */
export type AtrHorizon = components['schemas']['AtrHorizonWire'];

/** Average-true-range read — null when ALL horizons are null OR the read raised. */
export type AtrRead = Omit<
  components['schemas']['AtrReadWire'],
  'atr_5d' | 'atr_14d' | 'atr_30d'
> & {
  atr_5d: components['schemas']['AtrHorizonWire'] | null;
  atr_14d: components['schemas']['AtrHorizonWire'] | null;
  atr_30d: components['schemas']['AtrHorizonWire'] | null;
};

/** The AI context pack. Null only when ALL FOUR children are null OR the wrapper raised. The KEY is
 *  always present on a post-feature backend; it is OPTIONAL on `MarketState` so pre-feature payloads
 *  type-check (consumers read `m.market_context ?? null`). */
export type MarketContextPack = Omit<
  components['schemas']['MarketContextPackWire'],
  'trend_momentum' | 'gex_profile_shape' | 'flow_vs_positioning' | 'atr'
> & {
  trend_momentum: components['schemas']['TrendMomentumWire'] | null;
  gex_profile_shape: components['schemas']['GexProfileShapeWire'] | null;
  flow_vs_positioning: components['schemas']['FlowVsPositioningWire'] | null;
  atr: AtrRead | null;
};

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

export type IvRankRead = Omit<components['schemas']['IvRankReadWire'], 'iv_basis' | 'basis_dte'> & {
  iv_basis: string;
  basis_dte: number;
};

type MarketWire = components['schemas']['MarketWire'];
/** Validated market-state projection used by the existing presentation code. The wire remains
 * generated `MarketWire`; this projection records the fields the bundle normalizer requires before
 * exposing a state to consumers. */
export type MarketState = Omit<
  MarketWire,
  | 'ticker'
  | 'price'
  | 'gex_spot'
  | 'timestamp'
  | 'timestamp_iso'
  | 'call_wall'
  | 'put_wall'
  | 'peak_gex_strike'
  | 'gamma_flip'
  | 'max_pain'
  | 'max_pain_expiration'
  | 'net_gex'
  | 'call_gex'
  | 'put_gex'
  | 'total_gex'
  | 'net_dex'
  | 'call_dex'
  | 'put_dex'
  | 'net_vanna'
  | 'net_charm'
  | 'net_volga'
  | 'vwap'
  | 'vwap_upper_2'
  | 'vwap_upper_3'
  | 'vwap_lower_2'
  | 'vwap_lower_3'
  | 'dte_min'
  | 'dte_max'
  | 'atm_iv'
  | 'hv_30d'
  | 'iv_hv_ratio'
  | 'net_flow'
  | 'put_call_ratio'
  | 'chain_vol_oi_ratio'
  | 'total_volume'
  | 'vol_oi_unusual_threshold'
  | 'iv_skew'
  | 'term_structure'
  | 'dealer_flow_projection'
  | 'straddle_move'
  | 'ai_eval'
  | 'expirations'
  | 'iv_rank'
  | 'market_context'
  | 'meta'
  | 'market_state'
  | 'signals'
  | 'strike_profile'
  | 'vol_normalized_gex'
  | 'off_exchange'
  | 'position_eval'
  | 'score_drivers'
  | 'setups'
  | 'distances'
  | 'changed'
  | 'contract_count'
  | 'dark_pool_confluence'
  | 'market_phase'
  | 'opportunity_score'
  | 'opportunity_tier'
  | 'prime_prompt_eligible'
  | 'regime'
  | 'regime_note'
  | 'state_fingerprint'
  | 'vol_regime'
  | 'zero_dte_contribution_pct'
> & {
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
  chain_vol_oi_ratio: number | null;
  total_volume: number | null;
  vol_oi_unusual_threshold: number;
  iv_skew: IvSkew | null;
  term_structure: TermStructure | null;
  dealer_flow_projection: DealerFlowProjection | null;
  market_context?: MarketContextPack | null;
  iv_rank?: IvRankRead | null;
  vol_normalized_gex?: VolNormalizedGex | null;
  straddle_move: StraddleMove;
};

/** Vol-normalized dollar GEX aggregates. Sign matches raw net_gex; magnitude is / vol. */
export type VolNormalizedGex = components['schemas']['VolNormalizedGexWire'];

// ---- Straddle-implied move (tradeable-rec-inputs INTERFACE_CONTRACT §2) ------------------------
// Additive `market_state` member, attached AFTER `generate_signals`. Always an object (never a bare
// null) carrying a closed `state`; the FE renders every state/basis/anchor by closed lookup on the
// wire token and never re-derives one from a scalar or a null (`[digested-labels-not-raw-dump]`,
// `[absent-is-not-none]`). STATIC — never a scoring input, never on SSE.
export type StraddleMoveState = 'ok' | 'no_quote' | 'not_computed' | 'no_expiration_in_window';
export type MoveBasis = 'atm_straddle_mid' | 'iv_derived_estimate';
/** One inhabitant today — the levels anchor (`gex_spot`), never the live display price. */
export type MoveAnchorBasis = 'gex_spot';

export type StraddleTenor = components['schemas']['StraddleTenorWire'];

export type StraddleMove = components['schemas']['StraddleMoveWire'];

// ---- Candidate contract set (tradeable-rec-inputs INTERFACE_CONTRACT §1) -----------------------
// `GET /api/candidates/{ticker}` — the dedicated deliberate pull, and the shape reused verbatim by
// `sent.candidates` (in-app rec) and `context.candidates` (export). Never on the bundle, never on
// SSE, never on a passive page load (AC-1). STATIC (chain-snapshot derived).
export type CandidateSetState = 'ok' | 'none_in_band' | 'unavailable';
export type CandidateBudget = 'handoff' | 'prompt';
export type QuotePresence = 'quoted' | 'no_two_sided_quote';
export type IvState = 'priced' | 'unpriced';
export type SpreadBand = 'tight' | 'moderate' | 'wide' | 'unknown';

export type CandidateGreeks = components['schemas']['CandidateGreeksWire'];

/** One candidate contract. A no-quote contract is INCLUDED carrying `quote_presence`, never
 *  dropped (AC-11). `iv`/greeks are `null` iff `iv_state === 'unpriced'`; `0.0` never ships as an
 *  IV or a greek (the vendor's unpriced sentinel, AC-12). */
export type CandidateContract = components['schemas']['CandidateContractWire'];

export type CandidateCaps = components['schemas']['CandidateCapsWire'];

export type CandidateIncluded = components['schemas']['CandidateIncludedWire'];

/** Five closed reasons, fixed evaluation order, each contract counted EXACTLY once. */
export type CandidateOmittedByReason = components['schemas']['CandidateDropWire'];

export type CandidateOmitted = components['schemas']['CandidateOmittedWire'];

export type CandidateLiquidity = components['schemas']['CandidateLiquidityWire'];

export type CandidateSetEnvelope = components['schemas']['CandidatesWire'];

/** GET /api/candidates/{ticker} — the deliberate pull. Anonymous-ok, STATIC, never a vendor request
 *  on any path. `404` only when the ticker has no chain at all; everything else is `200` with a
 *  stated `state` (empty band / all dropped / assembly failed) — never invented by the FE. */
export async function getCandidates(
  symbol: string,
  opts: { minDte?: number; maxDte?: number; budget?: CandidateBudget } = {},
): Promise<CandidateSetEnvelope> {
  const result = await http.GET('/api/candidates/{ticker}', {
    params: {
      path: { ticker: symbol.toUpperCase() },
      query: { min_dte: opts.minDte, max_dte: opts.maxDte, budget: opts.budget },
    },
  });
  return dataOf(result, 'Candidates unavailable');
}

export type StrikeRow = components['schemas']['MarketStrike'];

export type Setup = components['schemas']['MarketSetup'];

// The generated wire is intentionally open; consumers apply their own closed display maps.
export type OpportunityTier = string;

/**
 * Presentation/domain projection of the generated market wire. The transport authority remains
 * `MarketWire`; this projection keeps the signal panel's closed vocabulary and does not describe a
 * second HTTP response shape.
 */
export type Signals = Pick<
  components['schemas']['MarketWire'],
  | 'ticker'
  | 'regime'
  | 'regime_note'
  | 'vol_regime'
  | 'distances'
  | 'setups'
  | 'opportunity_score'
  | 'opportunity_tier'
  | 'prime_prompt_eligible'
  | 'dark_pool_confluence'
  | 'score_drivers'
> & {
  ticker: string;
  regime: 'positive_gamma' | 'negative_gamma' | null;
  regime_note: string | null;
  vol_regime: 'iv_rich' | 'iv_cheap' | 'neutral';
  distances: Record<string, number | null>;
  setups: components['schemas']['MarketSetup'][];
  opportunity_score: number;
  opportunity_tier: 'prime' | 'actionable' | 'watch' | 'avoid';
  prime_prompt_eligible: boolean;
};

/** Sibling of ai_eval, present only when the bundle request carries an open-position context
 *  (pos_* query params); null otherwise. Drives once-per-event reassessment-alert de-dupe. */
export type PositionEval = components['schemas']['MarketPositionEval'];

export type AiEval = components['schemas']['MarketAiEval'];

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

export type Expiration = Omit<components['schemas']['MarketExpiration'], 'dte'> & {
  dte: number | null;
};

export type OffExchangeLevel = components['schemas']['OffExchangeLevelWire'];

/** A single large off-exchange ("dark pool") print. Display/context only — no side or
 *  direction exists, now or in v1, and the UI must invent none. Ranked largest-notional-first
 *  by the backend (top-5); render in order, never re-sort or re-cap. */
export type BlockPrint = components['schemas']['BlockPrintWire'];

export type OffExchange = components['schemas']['OffExchangeWire'];

/** Normalized bundle projection. `getTicker` only returns this after required bundle members have
 * been validated; all transport fields still originate in generated `MarketWire`. */
export type TickerBundle = Omit<
  MarketWire,
  | 'market_state'
  | 'signals'
  | 'strike_profile'
  | 'expirations'
  | 'ai_eval'
  | 'meta'
  | 'dealer_flow_projection'
  | 'iv_rank'
  | 'iv_skew'
  | 'market_context'
  | 'off_exchange'
  | 'score_drivers'
  | 'straddle_move'
  | 'term_structure'
  | 'vol_normalized_gex'
> & {
  market_state: MarketState;
  signals: Signals;
  strike_profile: { ticker: string; spot: number; strikes: StrikeRow[] };
  expirations: Expiration[];
  ai_eval: AiEval;
  meta: Meta;
  off_exchange?: OffExchange;
  position_eval: PositionEval | null;
};

function isTickerBundle(value: unknown): value is TickerBundle {
  // The generated operation already supplies the authoritative response type. This boundary only
  // rejects non-object transport payloads; optional wire members are normalized by consumers.
  return value !== null && typeof value === 'object';
}

// ---- Ghost-trade tracker: tracked-contract stats + reassessment boundary types --------------
export type OptionRight = 'call' | 'put';
export type OptionQuote = components['schemas']['OptionQuoteWire'];
/** Each greek may be null (unpriced contract). */
export type OptionGreeks = components['schemas']['ContractGreeksWire'];
/** Filter-independent stats for one option contract (GET /api/contract). `option_quote` null ⇒
 *  no live NBBO ⇒ the FE falls back to a theoretical (Black-Scholes) mark — not an error. */
export type TrackedContract = components['schemas']['ContractWire'];

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
    /** Typed error code (SPEC B5, `no-vendor-production-posture`). Absent on every error body that
     *  doesn't carry one — never invented; only a genuine wire `code` ever lands here. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** SPEC B2/B5 wire value: the ONLY `code` the paused reply ever sets. */
const MARKET_DATA_PAUSED_CODE = 'market_data_paused';

/** True iff `error` is the typed "market data is paused" fault (F1). The one place that string
 *  ever gets compared — every consumer calls this instead of matching `code`/`message` itself. */
export function isMarketDataPaused(error: unknown): boolean {
  return error instanceof ApiError && error.code === MARKET_DATA_PAUSED_CODE;
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
export type PerTradeCap = Omit<components['schemas']['PerTradeCapBody'], 'unit'> & {
  unit: CapUnit;
};
export type EffectiveDollarCapState = 'derived' | 'not_derivable' | 'not_set';
export type NotDerivableReason = 'percent_without_account_size';
export type EffectiveDollarCap = components['schemas']['EffectiveDollarCapBody'];
export type RiskInputsState = 'set' | 'not_set';
export type RiskInputs = Omit<
  components['schemas']['RiskInputsBody'],
  'per_trade_cap' | 'state' | 'account_size'
> & {
  account_size: number | null;
  per_trade_cap?: PerTradeCap | null;
  state: RiskInputsState;
};

/** The owner-entered PATCH shape for `PUT /api/auth/settings` — each fact independently clearable
 *  (send `null` to clear). Distinct from the read shape `RiskInputs`: the effective cap / storage
 *  flag / timestamp are server-derived and never sent by the client. */
export type RiskInputsPatch = Pick<
  components['schemas']['SettingsPatchBody'],
  'account_size' | 'per_trade_cap'
>;

/** The 3 light, presentation-only prefs (D7). NEVER read by signals/engine/scoring/fingerprint
 *  (AC-F4) — they only change which default a UI lands on. */
type AuthSettingsWire = components['schemas']['AuthSettingsBody'];
export type UserSettings = Omit<AuthSettingsWire, 'theme' | 'risk_inputs'> & {
  theme: ThemePref;
  risk_inputs?: RiskInputs;
};

function themeFromWire(value: string): ThemePref {
  if (value === 'dark' || value === 'light' || value === 'system') return value;
  throw new ApiError('Malformed settings payload', 200);
}

function settingsFromWire(value: AuthSettingsWire): UserSettings {
  return {
    ...value,
    theme: themeFromWire(value.theme),
    risk_inputs: value.risk_inputs as RiskInputs | undefined,
  };
}

/** Authenticated identity (never the raw email as id; `id` is opaque + stable). */
export type AuthUser = components['schemas']['AuthUserBody'];

/** The server-authoritative who-am-I read. ALWAYS 200 (anonymous is a normal result). Drives
 *  signed-in-vs-anonymous, identity, the config-gated Google flag, and the per-user settings. */
type AuthResponseWire = components['schemas']['AuthResponseBody'];
export type SessionStatus = Omit<
  AuthResponseWire,
  'authenticated' | 'google_available' | 'user' | 'settings' | 'demo_seed'
> & {
  authenticated: boolean;
  user: AuthUser | null;
  google_available: boolean;
  settings: UserSettings | null;
  demo_seed?: { email: string } | null;
};

function sessionFromWire(value: AuthResponseWire): SessionStatus {
  return {
    authenticated: value.authenticated === true,
    google_available: value.google_available === true,
    user: value.user ?? null,
    settings: value.settings ? settingsFromWire(value.settings) : null,
    demo_seed: value.demo_seed ?? null,
  };
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

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return (
    value === 'email_taken' ||
    value === 'validation' ||
    value === 'bad_credentials' ||
    value === 'auth_required' ||
    value === 'auth_unavailable' ||
    value === 'google_unavailable' ||
    value === 'signups_closed'
  );
}

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
type ClientResult<T> = { data?: T; error?: unknown; response: Response };

/** Read the typed `code` off a non-OK JSON body (SPEC B5) — `openapi-fetch` already parses it into
 *  `result.error`. Absent on every body that doesn't carry one; never invented. */
function codeOf(result: ClientResult<unknown>): string | undefined {
  const body =
    result.error && typeof result.error === 'object'
      ? (result.error as Record<string, unknown>)
      : {};
  return typeof body.code === 'string' ? body.code : undefined;
}

function resultError(result: ClientResult<unknown>, message: string): ApiError {
  return new ApiError(
    `${message} (${result.response.status})`,
    result.response.status,
    codeOf(result),
  );
}

function authResultError(result: ClientResult<unknown>): AuthError {
  const body = result.error && typeof result.error === 'object' ? result.error : {};
  const fields = body as Record<string, unknown>;
  let code: AuthErrorCode = 'auth_unavailable';
  if (isAuthErrorCode(fields.error)) code = fields.error;
  else if (result.response.status === 401) code = 'bad_credentials';
  else if (result.response.status === 403) code = 'auth_required';
  else if (result.response.status === 409) code = 'email_taken';
  else if (result.response.status === 422) code = 'validation';
  const message =
    typeof fields.message === 'string'
      ? fields.message
      : typeof fields.detail === 'string'
        ? fields.detail
        : 'Something went wrong. Please try again.';
  return new AuthError(code, message, result.response.status);
}

function dataOf<T>(result: ClientResult<T>, message: string): T {
  if (!result.response.ok || result.data === undefined) throw resultError(result, message);
  return result.data;
}

type RecommendationWire = components['schemas']['RecommendationBody'];

function recDecision(value: string): RecDecision {
  return value === 'trade' ? 'trade' : 'no_trade';
}
function recBias(value: string): RecBias {
  switch (value) {
    case 'long':
    case 'short':
    case 'neutral':
    case 'volatility':
      return value;
    default:
      return 'neutral';
  }
}
function recConfidence(value: string | null | undefined): RecConfidence | null {
  switch (value) {
    case 'low':
    case 'medium':
    case 'high':
      return value;
    default:
      return null;
  }
}
function recGate(value: string | null | undefined): RecGateState {
  return value === 'no_fresh_edge' || value === 'cooling_down' ? value : 'available';
}
function capVerdict(value: string): CapVerdict {
  switch (value) {
    case 'not_applicable':
    case 'no_cap':
    case 'not_checkable':
    case 'within':
    case 'above':
      return value;
    default:
      return 'not_checkable';
  }
}
function groundingAnchor(value: string | null | undefined): AnchorKind | null {
  switch (value) {
    case 'gex_spot':
    case 'call_wall':
    case 'put_wall':
    case 'peak_gex_strike':
    case 'gamma_flip':
    case 'max_pain':
    case 'vwap':
    case 'vwap_upper_2':
    case 'vwap_upper_3':
    case 'vwap_lower_2':
    case 'vwap_lower_3':
      return value;
    default:
      return null;
  }
}
function groundingState(value: string): GroundingState {
  switch (value) {
    case 'not_applicable':
    case 'not_checkable':
    case 'traced':
    case 'untraced':
      return value;
    default:
      return 'not_checkable';
  }
}
function groundingReason(value: string | null | undefined): NotCheckableReason | null {
  switch (value) {
    case 'structurally_unchecked':
    case 'no_named_level':
    case 'no_cited_expiration':
    case 'straddle_move_unavailable':
      return value;
    default:
      return null;
  }
}
function groundingCard(value: string): GroundingCard {
  switch (value) {
    case 'not_applicable':
    case 'local_rules':
    case 'none_traced':
    case 'could_not_check':
    case 'some_traced':
    case 'all_traced':
      return value;
    default:
      return 'could_not_check';
  }
}
function citedContractState(value: string): CitedContractState {
  switch (value) {
    case 'cited':
    case 'right_undetermined':
    case 'off_set':
    case 'none':
      return value;
    default:
      return 'none';
  }
}
function keySource(value: string): KeySource {
  return value === 'own_key' || value === 'grok_subscription' ? value : 'none';
}
function fieldReason(
  value: components['schemas']['RecommendationFieldReasonBody'] | null | undefined,
): FieldReason | null {
  if (!value) return null;
  const reason =
    value.reason === 'unavailable' || value.reason === 'unrecognized_value'
      ? value.reason
      : 'not_given';
  const missing = value.missing_input;
  const missingInput: MissingInput | null =
    missing === 'candidate_quotes' || missing === 'straddle_move' || missing === 'candidate_set'
      ? missing
      : missing === 'risk_block'
        ? 'risk_block'
        : null;
  return { reason, missing_input: missingInput };
}
function projectStrategy(
  value: components['schemas']['RecommendationStrategyBody'] | null | undefined,
): RecStrategy | null {
  if (!value) return null;
  return {
    decision: recDecision(value.decision),
    bias: recBias(value.bias),
    structure: value.structure ?? null,
    strikes: value.strikes,
    expiration: value.expiration ?? null,
    entry_trigger: value.entry_trigger ?? null,
    invalidation_level: value.invalidation_level ?? null,
    max_risk: value.max_risk ?? null,
    position_size: value.position_size ?? null,
    exit_plan: { target: value.exit_plan.target ?? null, stop: value.exit_plan.stop ?? null },
    time_horizon: value.time_horizon ?? null,
    confidence: recConfidence(value.confidence),
    right: value.right === 'call' || value.right === 'put' ? value.right : null,
    summary: value.summary ?? null,
    key_points: value.key_points ?? undefined,
    reengage_when: value.reengage_when ?? undefined,
    rationale: value.rationale ?? '',
  };
}
function projectRiskInputs(value: {
  state: string;
  account_size?: number | null;
  per_trade_cap?: { unit: string; value: number } | null;
}): RiskInputs {
  const state: RiskInputsState = value.state === 'set' ? 'set' : 'not_set';
  return {
    state,
    account_size: value.account_size ?? null,
    per_trade_cap:
      value.per_trade_cap == null
        ? null
        : { ...value.per_trade_cap, unit: value.per_trade_cap.unit as CapUnit },
    effective_dollar_cap: {
      state: 'not_set',
      value: null,
      not_derivable_reason: null,
      derived_from: { account_size: null, cap_value: null, cap_unit: null },
    },
    storage_available: true,
    updated_at: null,
  };
}
function projectOpenPositions(value: { source: string; state: string }): OpenPositionsDigest {
  return {
    source: 'simulated',
    state: value.state === 'none_open' || value.state === 'unavailable' ? value.state : 'not_sent',
    this_underlying: null,
    portfolio: null,
  };
}
function emptyCandidateSet(ticker: string): CandidateSetEnvelope {
  return {
    ticker,
    state: 'unavailable',
    as_of: null,
    snapshot_age_seconds: null,
    session_basis: null,
    quote_age: 'unknown',
    anchor_spot: null,
    anchor_basis: 'unavailable',
    band_pct: 0,
    budget: 'handoff',
    sent_to_model: false,
    caps: { tenors: 0, rights: 0, strikes_per_tenor_right: 0, max_records: 0, max_bytes: 0 },
    included: { contracts: 0, expirations: [], expiration_count: 0 },
    omitted: {
      total: 0,
      expirations_omitted_by_cap: 0,
      by_reason: {
        outside_window: 0,
        outside_band: 0,
        no_interest: 0,
        expiration_cap: 0,
        strike_cap: 0,
      },
    },
    liquidity: {
      quoted: 0,
      no_two_sided_quote: 0,
      atm_relative_spread_band: 'unknown',
      wide_quotes: false,
      wide_quote_threshold_pct: 0,
    },
    contracts: [],
  };
}
function projectGroundingField(
  value: components['schemas']['RecommendationGroundingFieldBody'],
): GroundingField {
  const basis =
    value.basis === 'exact' || value.basis === 'near' || value.basis === 'inside_range'
      ? value.basis
      : null;
  const anchor_kind = groundingAnchor(value.anchor_kind);
  const state = groundingState(value.state);
  const not_checkable_reason = groundingReason(value.not_checkable_reason);
  return {
    state,
    basis,
    anchor_kind,
    anchor_value: value.anchor_value ?? null,
    range_low: value.range_low ?? null,
    range_high: value.range_high ?? null,
    expiration: value.expiration ?? null,
    not_checkable_reason,
  };
}
function projectGrounding(
  value: components['schemas']['RecommendationGroundingBody'] | null | undefined,
): Grounding | null {
  if (!value) return null;
  const card = groundingCard(value.card);
  return {
    card,
    counts: value.counts,
    tolerance_pct: value.tolerance_pct,
    fields: {
      exit_stop: projectGroundingField(value.fields.exit_stop),
      exit_target: projectGroundingField(value.fields.exit_target),
      invalidation_level: projectGroundingField(value.fields.invalidation_level),
      max_risk: projectGroundingField(value.fields.max_risk),
      position_size: projectGroundingField(value.fields.position_size),
    },
  };
}
function egressCategory(value: components['schemas']['EgressCategoryBody']): EgressCategory | null {
  switch (value.key) {
    case 'context':
    case 'candidates':
    case 'risk_inputs':
    case 'open_positions':
    case 'persona_prompt':
    case 'glossary':
      return { key: value.key, sent: value.sent };
    default:
      return null;
  }
}
function projectRecommendation(wire: RecommendationWire): RecResponse {
  const gateWire = wire.gate;
  const capWire = wire.cap;
  const persona = wire.persona ?? { id: null, name: '' };
  const fieldWire = wire.field_reasons;
  return {
    status: wire.status,
    ticker: wire.ticker,
    as_of: wire.as_of ?? null,
    ...(wire.pinned_fingerprint == null ? {} : { pinned_fingerprint: wire.pinned_fingerprint }),
    stale_born: wire.stale_born,
    persona: { id: persona.id ?? null, name: persona.name },
    gate: {
      state: recGate(gateWire?.state),
      cooldown_remaining_seconds: gateWire?.cooldown_remaining_seconds ?? 0,
      reasons: gateWire?.reasons ?? [],
    },
    cap: {
      over_limit: capWire?.over_limit ?? false,
      remaining_today: capWire?.remaining_today ?? 0,
      resets_at: capWire?.resets_at ?? '',
    },
    powering: wire.powering
      ? {
          key_source: keySource(wire.powering.key_source),
          provider: wire.powering.provider ?? null,
          model: wire.powering.model ?? null,
          unavailable_reason: wire.powering.unavailable_reason ?? null,
          preference: { power_path: null, provider: null, model: null },
        }
      : null,
    strategy: projectStrategy(wire.strategy),
    key_source: wire.key_source,
    provider: wire.provider,
    model: wire.model,
    scenario: wire.scenario ? { id: wire.scenario.id, name: wire.scenario.name } : null,
    sent: wire.sent
      ? {
          budget: 'prompt',
          candidates: wire.sent.candidates,
          straddle_move_tenors: wire.sent.straddle_move_tenors,
          risk_inputs: projectRiskInputs(wire.sent.risk_inputs ?? { state: 'not_set' }),
          risk_inputs_digest: wire.sent.risk_inputs_digest,
          open_positions: projectOpenPositions(
            wire.sent.open_positions ?? { source: 'simulated', state: 'not_sent' },
          ),
        }
      : null,
    cap_check: wire.cap_check
      ? {
          verdict: capVerdict(wire.cap_check.verdict),
          effective_dollar_cap: wire.cap_check.effective_dollar_cap ?? null,
          cap_not_derivable_reason:
            wire.cap_check.cap_not_derivable_reason === 'percent_without_account_size'
              ? 'percent_without_account_size'
              : null,
          parsed_risk_dollars: wire.cap_check.parsed_risk_dollars ?? null,
          model_max_risk_text: wire.cap_check.model_max_risk_text ?? null,
          risk_refusal:
            wire.cap_check.risk_refusal === 'no_text' ||
            wire.cap_check.risk_refusal === 'no_dollar_figure' ||
            wire.cap_check.risk_refusal === 'multiple_different_figures'
              ? wire.cap_check.risk_refusal
              : null,
        }
      : null,
    field_reasons: fieldWire
      ? {
          max_risk: fieldReason(fieldWire.max_risk),
          position_size: fieldReason(fieldWire.position_size),
          exit_target: fieldReason(fieldWire.exit_target),
          exit_stop: fieldReason(fieldWire.exit_stop),
          invalidation_level: fieldReason(fieldWire.invalidation_level),
          structure: fieldReason(fieldWire.structure),
          strikes: fieldReason(fieldWire.strikes),
          expiration: fieldReason(fieldWire.expiration),
          entry_trigger: fieldReason(fieldWire.entry_trigger),
          time_horizon: fieldReason(fieldWire.time_horizon),
          confidence: fieldReason(fieldWire.confidence),
        }
      : null,
    cited_contract: wire.cited_contract
      ? {
          state: citedContractState(wire.cited_contract.state),
          contract: wire.cited_contract.contract ?? null,
          legs: wire.cited_contract.legs,
        }
      : null,
    grounding: projectGrounding(wire.grounding),
    unavailable_reason: wire.unavailable_reason,
    authorized: wire.authorized,
    availability: wire.availability as { in_app_enabled: boolean },
    scenarios: wire.scenarios
      ? {
          enabled: wire.scenarios.enabled,
          catalog: wire.scenarios.catalog.map((s) => ({ id: s.id, name: s.name })),
        }
      : null,
    context: wire.context
      ? {
          ...wire.context,
          candidates: wire.context.candidates,
          risk_inputs: projectRiskInputs(wire.context.risk_inputs ?? { state: 'not_set' }),
          open_positions: projectOpenPositions(
            wire.context.open_positions ?? { source: 'simulated', state: 'not_sent' },
          ),
        }
      : {
          candidates: emptyCandidateSet(wire.ticker ?? ''),
          risk_inputs: projectRiskInputs({ state: 'not_set' }),
          open_positions: projectOpenPositions({ source: 'simulated', state: 'not_sent' }),
        },
    persona_prompt: wire.persona_prompt,
    glossary: wire.glossary,
    egress_note: wire.egress_note,
    egress_categories: wire.egress_categories
      ?.map(egressCategory)
      .filter((value): value is EgressCategory => value !== null),
  };
}

/** GET /api/auth/session — who-am-I. ALWAYS 200 server-side; on a TRANSPORT fault (network / non-200)
 *  this REJECTS so the caller can record `subsystem_degraded` and treat the result as anonymous —
 *  it never throws into the trader path (the caller degrades). Sends the cookie automatically. */
export async function getSession(): Promise<SessionStatus> {
  const result = await http.GET('/api/auth/session');
  return sessionFromWire(dataOf(result, 'Session read failed'));
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
  const result = await http.POST('/api/auth/signup', {
    body,
  });
  if (!result.response.ok) throw authResultError(result);
  if (result.data === undefined) throw authResultError(result);
  return sessionFromWire(result.data);
}

/** POST /api/auth/login — success ⇒ identity shape (cookie set). Throws `AuthError` with
 *  `bad_credentials`(401, NON-ENUMERATING) / `validation`(422) / `auth_unavailable`(503). The 401
 *  message is identical for unknown-email vs wrong-password (AC-C3/H3) — the FE renders fixed copy. */
export async function login(body: LoginRequest): Promise<SessionStatus> {
  const result = await http.POST('/api/auth/login', {
    body,
  });
  if (!result.response.ok) throw authResultError(result);
  if (result.data === undefined) throw authResultError(result);
  return sessionFromWire(result.data);
}

/** POST /api/auth/logout — idempotent; 200 regardless of prior state. After this, who-am-I reports
 *  anonymous. Best-effort: a transport fault is swallowed (the FE still re-reads who-am-I). */
export async function logout(): Promise<void> {
  try {
    await http.POST('/api/auth/logout');
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
  const result = await http.PUT('/api/auth/settings', {
    body: patch,
  });
  if (!result.response.ok) throw authResultError(result);
  if (result.data === undefined) throw authResultError(result);
  return settingsFromWire(result.data);
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
  const result = await http.POST('/api/positions/sim-trade/gate');
  if (!result.response.ok) throw authResultError(result);
  const data = dataOf(result, 'Trade gate failed');
  // The live contract names `authorized`; the dashboard test backend still emits its legacy
  // `allowed` spelling, which is accepted only as a compatibility input and never re-emitted.
  const legacyAllowed = 'allowed' in data && data.allowed === true;
  if (data.authorized !== true && !legacyAllowed)
    throw new ApiError('Malformed trade gate payload', 200);
  return { authorized: true };
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
export type ScanScoreDrivers = components['schemas']['ScanScoreDriversDto'];

export type ScanRow = components['schemas']['ScanRowDto'];

/** The closed sortable-key set the FE may offer (INTERFACE §2.3). Sorting is a CLIENT-SIDE re-order
 *  of the returned rows; it never re-derives a value and never refetches. */
export type ScanSortKey =
  'score' | 'symbol' | 'price' | 'chg_pct' | 'dist_to_flip_pct' | 'dist_to_wall_pct';
export type ScanViewSort = components['schemas']['ScanSort'];
export type ScanDensity = 'compact' | 'comfortable';

/** The caller's effective view. `symbols` IS the display ordering. */
export type ScanView = components['schemas']['ScanView'];

/** Sweep metadata (INTERFACE §2.4). The FE derives "sweep last ran X ago" from these epochs vs its
 *  own clock; the wire carries NO pre-rendered freshness copy. */
export type SweepHeartbeat = components['schemas']['SweepHeartbeatDto'];

/** `GET /api/scan` (INTERFACE §3.1). Every symbol in `view.symbols` is present in `rows`
 *  (building-fill) — the screen is never dead. `sweep` is null iff the worker never wrote one. */
export type ScanResponse = components['schemas']['ScanEnvelope'];

/** `GET /api/scan/universe` (INTERFACE §3.2). Read-only — v1 has no add/request/remove path. */
export type ScanUniverse = components['schemas']['UniverseResponse'];

/** `PUT /api/scan/view` body (INTERFACE §3.4). `symbols` is required and must be a subset of the
 *  CURRENT universe, in display order; the server 422s anything else. */
export interface ScanViewWrite {
  symbols: string[];
  name?: string | null;
  sort?: ScanViewSort;
  density?: ScanDensity;
}

function toScanViewBody(view: ScanViewWrite): components['schemas']['ScanViewBody'] {
  // The server applies the default sort when omitted; retain that legacy omission on the wire.
  return { ...view } as components['schemas']['ScanViewBody'];
}

/** GET /api/scan — the requested-or-default view as slim rows + sweep metadata. Anonymous-open;
 *  server-side it is best-effort ALWAYS 200 (a store outage degrades CONTENT, never the status), so a
 *  non-2xx here means a TRANSPORT/proxy fault: we reject and the caller keeps its last-known rows. */
export async function getScan(): Promise<ScanResponse> {
  const result = await http.GET('/api/scan');
  return dataOf(result, 'Scan read failed');
}

/** GET /api/scan/universe — the read-only owner-curated universe for the view editor. */
export async function getScanUniverse(): Promise<ScanUniverse> {
  const result = await http.GET('/api/scan/universe');
  return dataOf(result, 'Universe read failed');
}

/** GET /api/scan/view — the caller's effective view. Anonymous ALWAYS gets a readable default; a
 *  READ is never gated. (The page reads the view off `getScan()`; this exists for the editor's
 *  reconciliation + parity with the wire.) */
export async function getScanView(): Promise<ScanView> {
  const result = await http.GET('/api/scan/view');
  return dataOf(result, 'View read failed');
}

/** PUT /api/scan/view — the ONE server-gated, state-bearing scanner action
 *  (`[server-side-gate-enforcement]`). Signed-in ⇒ 200 echoing the SAVED view (server-wins).
 *  Signed-out ⇒ a REAL 403 `auth_required` even if the FE guard is bypassed/absent, and NOTHING is
 *  persisted (AC-3). Off-universe symbol / bad sort / bad density ⇒ 422 `validation` (AC-13).
 *  Auth-subsystem fault ⇒ 503 `auth_unavailable`. Never touches the bundle/SSE path. */
export async function saveScanView(view: ScanViewWrite): Promise<ScanView> {
  const result = await http.PUT('/api/scan/view', {
    body: toScanViewBody(view),
  });
  if (!result.response.ok) {
    if (result.response.status === 422) {
      const body = (result.error ?? {}) as { detail?: unknown };
      throw new AuthError(
        'validation',
        typeof body.detail === 'string' ? body.detail : 'That view is not valid.',
        422,
      );
    }
    throw authResultError(result);
  }
  if (result.data === undefined) throw authResultError(result);
  return result.data;
}

/** One slow-lane structure snapshot (not a live price tick). Chronological on the wire. */
export type StructureSample = components['schemas']['StructureSampleDto'];

/** `GET /api/scan/{symbol}/history` — durable structure path for the ticker Structure zone. */
export type StructureHistoryResponse = components['schemas']['StructureHistoryResponse'];

/** GET /api/scan/{symbol}/history — anonymous-open structure history. Empty samples is honest
 *  cold-start, not an error. Transport faults reject so the caller can keep last-known path. */
export async function getStructureHistory(
  symbol: string,
  limit = 48,
  fetchOpts: FetchOpts = {},
): Promise<StructureHistoryResponse> {
  const sym = symbol.trim().toUpperCase();
  const result = await http.GET('/api/scan/{symbol}/history', {
    params: { path: { symbol: sym }, query: { limit: limit > 0 ? Math.min(limit, 96) : 0 } },
    signal: fetchOpts.signal,
    headers: fetchOpts.signal ? { 'x-convexa-preserve-signal': '1' } : undefined,
  });
  return dataOf(result, 'Structure history failed');
}

/** Live payload pushed over SSE (mid/flow/live flip). Levels other than the flip come from
 *  the bundle; the UI measures price-vs-wall using `mid` + the bundle's walls. */
/** Generated SSE payload; EventSource lifecycle remains the only handwritten transport boundary. */
export type LiveUpdate = components['schemas']['LiveUpdateBody'];

function isLiveUpdate(value: unknown): value is LiveUpdate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const hasLiveValue = ['mid', 'last_trade', 'gamma_flip', 'net_flow'].some(
    (key) => typeof candidate[key] === 'number',
  );
  return (
    hasLiveValue &&
    (candidate.ticker == null || typeof candidate.ticker === 'string') &&
    (candidate.live == null || typeof candidate.live === 'boolean') &&
    (candidate.market_session == null || typeof candidate.market_session === 'string')
  );
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
  if (dataMode === 'demo') {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import('./demo/streams').then(({ subscribeTicker }) => {
      if (!active) return;
      unsubscribe = subscribeTicker(symbol, { minDte, maxDte, expirations }, (event) => {
        if (event.kind === 'ticker_update') onUpdate(event.update);
      });
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }
  const params = new URLSearchParams();
  if (minDte != null) params.set('min_dte', String(minDte));
  if (maxDte != null) params.set('max_dte', String(maxDte));
  if (expirations && expirations.length) params.set('expirations', expirations.join(','));
  const qs = params.toString();
  const es = new EventSource(`/api/stream/${symbol.toUpperCase()}${qs ? `?${qs}` : ''}`);
  es.onmessage = (e) => {
    try {
      const payload: unknown = JSON.parse(e.data);
      if (isLiveUpdate(payload)) onUpdate(payload);
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
  const result = await http.GET('/api/ticker/{ticker}', {
    params: {
      path: { ticker: symbol.toUpperCase() },
      query: {
        min_dte: minDte,
        max_dte: maxDte,
        expirations: expirations?.length ? expirations.join(',') : undefined,
        pos_expiration: position?.expiration,
        pos_strike: position?.strike,
        pos_right: position?.right,
        pos_pl_pct: position?.plPct,
        dark_pool: darkPool,
      },
    },
    signal: fetchOpts.signal,
    headers: fetchOpts.signal ? { 'x-convexa-preserve-signal': '1' } : undefined,
  });
  if (!result.response.ok) {
    const code = codeOf(result);
    // F1: the paused reply's own `detail` ("Market data is paused.") is the honest message — never
    // the generic status-shaped text the other branches synthesize (`isMarketDataPaused` is what
    // callers key on; this text is a debug fallback only, never parsed).
    const bodyDetail =
      result.error && typeof result.error === 'object'
        ? (result.error as Record<string, unknown>).detail
        : undefined;
    const detail =
      code === MARKET_DATA_PAUSED_CODE && typeof bodyDetail === 'string'
        ? bodyDetail
        : result.response.status === 404
          ? `No option-chain data for ${symbol.toUpperCase()}`
          : result.response.status === 429
            ? `Rate limited (${result.response.status})`
            : `API error ${result.response.status}`;
    throw new ApiError(detail, result.response.status, code);
  }
  if (result.data === undefined) throw resultError(result, 'Ticker read failed');
  if (!isTickerBundle(result.data)) throw new ApiError('Malformed ticker payload', 200);
  return result.data;
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
  const result = await http.GET('/api/contract/{ticker}', {
    params: {
      path: { ticker: symbol.toUpperCase() },
      query: { expiration, strike, right },
    },
  });
  if (result.response.status === 404) return null;
  return dataOf(result, 'Contract lookup failed');
}

// ---- Operator metrics readout (observability; read-only, side-effect-free) -------------------
// NOTE: the endpoint path is the INTERFACE_CONTRACT's *example* (`/api/_metrics`); the Interface
// left it as "e.g." and the backend lane hasn't pinned it yet. Flagged for confirmation — if the
// backend finalizes a different path, change only this constant.
export const METRICS_ENDPOINT = '/api/_metrics';

export type MetricsLatency = components['schemas']['MetricsLatency'];
export type MetricsStage = components['schemas']['MetricsStage'];
export type MetricsCache = components['schemas']['MetricsCache'];
export type MetricsVendor = components['schemas']['MetricsVendor'];
export type MetricsScope = Omit<components['schemas']['MetricsScope'], 'stages'> & {
  stages: Array<
    Omit<components['schemas']['MetricsStage'], 'kind' | 'stage'> & {
      kind: StageKind;
      stage: StageName;
    }
  >;
};
export type RecentTrace = components['schemas']['RecentTrace'];
export type MetricsAggregate = Omit<
  components['schemas']['MetricsWire'],
  'window' | 'global' | 'per_ticker'
> & {
  window: {
    size_desc: string;
    uptime_seconds: number;
    request_count: number;
  };
  global: MetricsScope;
  per_ticker: Record<string, MetricsScope>;
};

/** Read-only operator metrics readout. Side-effect-free: GETs the readout only — never triggers a
 *  bundle fetch, recompute, or cache mutation. Throws on any non-2xx (caller → "Metrics readout
 *  unavailable."). */
export async function fetchMetrics(): Promise<MetricsAggregate> {
  const result = await http.GET('/api/_metrics');
  const value = dataOf(result, 'Metrics readout failed');
  return {
    ...value,
    window: value.operator,
    global: value.global as MetricsScope,
    per_ticker: value.per_ticker as Record<string, MetricsScope>,
  } as MetricsAggregate;
}

// ---- Trader personas (prompt-layer projection only; assembled FE-side, locus PINNED FE-rendered) ----
// Persona is a read-only, post-FREEZE presentation overlay: it changes only the assembled hand-off
// prompt text, NEVER opportunity_score/opportunity_tier/ai_eval/state_fingerprint, and switching it
// triggers NO recompute. There is no `meta.handoff` and no `?persona=` — the FE owns the template.
export type PersonaObjective = 'income' | 'directional_swing' | 'hedging';
export type PersonaRisk = 'conservative' | 'moderate' | 'aggressive';

/** Declarative persona data (no executable logic, no analytics params). The framing-copy fields
 *  (summary/objective_framing/risk_calibration) are FE-embedded UX text. */
/** FE semantic persona projection. The HTTP payload is generated `PersonaWire`; this model adds
 * presentation-only framing copy assembled by the persona feature. */
export interface PersonaDefinition {
  id: string;
  name: string;
  builtin: boolean;
  version: number;
  objective: PersonaObjective;
  risk: PersonaRisk;
  reassessment_lean: string;
  emphasis_note?: string | null;
  dte_pref?: { min_dte: number; max_dte: number } | null;
  summary?: string;
  objective_framing?: string;
  risk_calibration?: string;
  based_on?: string;
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

/**
 * Domain projection of the generated recommendation envelope.  The generated response is only
 * accepted at the facade boundary; consumers receive closed vocabularies and explicit nulls so a
 * widened OpenAPI string can never leak into the recommendation state machine.
 */
export interface RecResponseDomain {
  status?: RecStatusKind | string | null;
  ticker?: string | null;
  as_of: string | null;
  pinned_fingerprint?: string;
  stale_born?: boolean | null;
  persona: RecPersona;
  gate: RecGate;
  cap: RecCap;
  powering?: RecPowering | null;
  strategy: RecStrategy | null;
  key_source?: string | null;
  provider?: string | null;
  model?: string | null;
  scenario?: RecScenarioInfo | null;
  sent?: RecSent | null;
  cap_check?: CapCheck | null;
  field_reasons?: FieldReasons | null;
  cited_contract?: CitedContract | null;
  grounding?: Grounding | null;
  unavailable_reason?: string | null;
  authorized?: boolean | null;
  availability?: { in_app_enabled: boolean } | null;
  scenarios?: { enabled: boolean; catalog: RecScenarioInfo[] } | null;
  context?: RecExportContext | null;
  persona_prompt?: string | null;
  glossary?: string | null;
  egress_note?: string | null;
  egress_categories?: EgressCategory[];
  /** Retained for compatibility with pre-contract fixtures; the current server no longer emits it. */
  remaining_free_uses?: number | null;
}
export type RecResponse = RecResponseDomain;

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
export interface ExportRiskInputs {
  state: RiskInputsState | string;
  account_size?: number | null;
  per_trade_cap?: PerTradeCap | null;
  effective_dollar_cap?: EffectiveDollarCap;
  storage_available?: boolean;
  updated_at?: number | null;
}

/** `context.open_positions` on the export. A GET carries no client digest, so `state` is always
 *  `not_sent` here — distinct from the in-app rec's richer three-member digest. */
export interface ExportOpenPositions {
  source: OpenPositionsSource | string;
  state: OpenPositionsState | string;
  this_underlying?: OpenPositionsThisUnderlying | null;
  portfolio?: OpenPositionsPortfolio | null;
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
interface RecExportDomain {
  ticker?: string | null;
  as_of?: string | null;
  context: RecExportContext;
  egress_categories: EgressCategory[];
  persona?: RecPersona | null;
  persona_prompt?: string | null;
  glossary?: string | null;
  egress_note?: string | null;
}
export type RecExport = RecExportDomain;

/** Gating + cap + availability without requesting a rec (INTERFACE §1.3). Side-effect-free, 200. */
interface RecStatusDomain {
  availability: { in_app_enabled: boolean };
  gate: RecGate;
  cap: RecCap;
  powering?: RecPowering | null;
  scenarios?: { enabled: boolean; catalog: RecScenarioInfo[] } | null;
}
export type RecStatus = RecStatusDomain;

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

function aiProviderFromWire(value: string): ByoProvider {
  if (value === 'anthropic' || value === 'openai' || value === 'xai' || value === 'gemini')
    return value;
  throw new ApiError('Malformed AI provider payload', 200);
}

function aiBootstrapFromWire(
  value: components['schemas']['AiProvidersBootstrapBody'],
): AiProvidersBootstrap {
  const powerPath = value.preference.power_path;
  if (powerPath != null && powerPath !== 'own_key' && powerPath !== 'grok_subscription')
    throw new ApiError('Malformed AI provider payload', 200);
  const grokReason = value.grok.unavailable_reason;
  if (
    grokReason != null &&
    grokReason !== 'subscription_unavailable' &&
    grokReason !== 'oauth_unlinked' &&
    grokReason !== 'oauth_expired'
  )
    throw new ApiError('Malformed AI provider payload', 200);
  return {
    storage_available: value.storage_available,
    providers: value.providers.map((provider) => ({
      provider: aiProviderFromWire(provider.provider),
      set: provider.set,
      last4: provider.last4 ?? null,
    })),
    grok: {
      available: value.grok.available,
      connected: value.grok.connected,
      unavailable_reason: grokReason ?? null,
    },
    preference: {
      power_path: powerPath ?? null,
      provider:
        value.preference.provider == null ? null : aiProviderFromWire(value.preference.provider),
      model: value.preference.model ?? null,
    },
    catalog: {
      providers: value.catalog.providers.map((provider) => ({
        provider: aiProviderFromWire(provider.provider),
        models: provider.models,
      })),
      grok_subscription: value.catalog.grok_subscription,
    },
  };
}

/** @deprecated Use AiProvidersBootstrap. Kept as an alias so existing imports compile. */
export type AiKeyStatus = AiProvidersBootstrap;

/** In-flight GET /api/auth/ai-key. Overlapping callers share one Promise; cleared on settle.
 *  Not a cache — a later call after success/failure fetches again. */
let aiKeyStatusInflight: Promise<AiProvidersBootstrap> | null = null;

/** GET /api/auth/ai-key — Settings + Ask-AI bootstrap (matrix, grok arm, preference, catalog).
 *  NEVER returns a secret. 403 ⇒ AuthError('auth_required') (anonymous). */
export async function getAiKeyStatus(): Promise<AiProvidersBootstrap> {
  if (aiKeyStatusInflight) return aiKeyStatusInflight;
  aiKeyStatusInflight = (async () => {
    const result = await http.GET('/api/auth/ai-key');
    if (!result.response.ok) throw authResultError(result);
    return aiBootstrapFromWire(dataOf(result, 'AI providers unavailable'));
  })().finally(() => {
    aiKeyStatusInflight = null;
  });
  return aiKeyStatusInflight;
}

/** Test seam — drop a hanging in-flight GET so the next spec starts clean. */
export function __resetAiKeyStatusInflight() {
  aiKeyStatusInflight = null;
}

/** PUT /api/auth/ai-key — store/overwrite the BYO ciphertext for ONE closed provider slot.
 *  The client MUST send `provider`; the server must not retitle the slot from the key string.
 *  Returns the full bootstrap — NEVER echoes the key. Storage-unavailable is a 200 with
 *  `storage_available:false`, NOT a 5xx. */
export async function setAiKey(key: string, provider: ByoProvider): Promise<AiProvidersBootstrap> {
  const result = await http.PUT('/api/auth/ai-key', {
    body: { key, provider },
  });
  if (!result.response.ok) throw authResultError(result);
  return aiBootstrapFromWire(dataOf(result, 'AI key update failed'));
}

/** DELETE /api/auth/ai-key?provider= — remove one BYO slot. Idempotent. 403 / 422 as documented. */
export async function removeAiKey(provider: ByoProvider): Promise<AiProvidersBootstrap> {
  const result = await http.DELETE('/api/auth/ai-key', {
    params: { query: { provider } },
  });
  if (!result.response.ok) throw authResultError(result);
  return aiBootstrapFromWire(dataOf(result, 'AI key removal failed'));
}

/** DELETE /api/auth/grok — unlink the Grok subscription. Session required. */
export async function disconnectGrok(): Promise<void> {
  const result = await http.DELETE('/api/auth/grok');
  if (!result.response.ok) throw authResultError(result);
}

/** Browser navigation target for Connect Grok. Only used when `grok.available` is true. */
export const GROK_OAUTH_START = '/api/auth/grok/start';

// ---- Durable book (multi-device positions blob) ------------------------------------------------

export type BookEnvelope = components['schemas']['BookEnvelopeSchema'];

type BookPutBody = components['schemas']['BookPutBody'];
function toBookPutBody(body: {
  schema_version?: number;
  updated_at?: number;
  blob: Record<string, unknown>;
}): BookPutBody {
  const blob = body.blob;
  if (
    typeof blob.schema_version !== 'number' ||
    !Array.isArray(blob.positions) ||
    !Array.isArray(blob.orders) ||
    !Array.isArray(blob.decisions)
  ) {
    throw new TypeError('Book payload is not a valid generated contract shape');
  }
  return { ...body, blob: blob as BookPutBody['blob'] };
}

/** GET /api/book — signed-in server copy of positions v3 blob (empty when none). */
export async function getBook(): Promise<BookEnvelope> {
  const result = await http.GET('/api/book');
  if (result.response.status === 403 || result.response.status === 503)
    throw authResultError(result);
  return dataOf(result, 'Book get failed');
}

/** PUT /api/book — push local blob; latest-wins by updated_at. */
export async function putBook(body: {
  schema_version?: number;
  updated_at?: number;
  blob: Record<string, unknown>;
}): Promise<BookEnvelope> {
  const result = await http.PUT('/api/book', {
    body: toBookPutBody(body),
  });
  if (result.response.status === 403 || result.response.status === 503)
    throw authResultError(result);
  return dataOf(result, 'Book put failed');
}

/** Request a rec (in-app LLM call). ALWAYS 200 for produced/no_trade/unavailable/gated_off — the
 *  `status` field distinguishes them. A non-2xx / network fault throws `ApiError`; the rec hook
 *  catches it and renders the `unavailable` panel state (never thrown to the page). No key is sent. */
export async function requestRecommendation(
  symbol: string,
  body: RecRequest,
): Promise<RecResponse> {
  const result = await http.POST('/api/recommendation/{ticker}', {
    params: { path: { ticker: symbol.toUpperCase() } },
    body,
  });
  // no-vendor-production-posture B2 amendment (GATE Z 2026-09-24): this route is also a B2 route —
  // paused answers the SAME typed 503 as every other one (`code: "market_data_paused"`, no `error`
  // field). Checked FIRST and by `code` alone (never by status), because the auth-class branch right
  // below also matches on a bare 503 and would otherwise swallow this into `auth_unavailable` (same
  // status, no `code`) — routing a signed-in, paused caller into the sign-in gate's "couldn't reach"
  // prompt instead of the honest paused panel. `isMarketDataPaused` only ever recognizes `ApiError`,
  // so this must throw one, not an `AuthError`.
  if (codeOf(result) === MARKET_DATA_PAUSED_CODE) {
    throw resultError(result, 'Recommendation request failed');
  }
  // user-accounts (D6f): the auth gate is the OUTERMOST precondition on the LLM invoke. A 403
  // `auth_required` / 503 `auth_unavailable` is an AUTH-class outcome — surface it as an `AuthError`
  // (NOT the ai-rec `unavailable` artifact) so the FE shows the sign-in / "couldn't reach" prompt
  // and NEVER ai-rec's cooldown/cap/no_key (AC-E4/E7/J1). All other non-2xx stay `ApiError`.
  if (result.response.status === 403 || result.response.status === 503)
    throw authResultError(result);
  return projectRecommendation(dataOf(result, 'Recommendation request failed'));
}

/** The structured state export (the always-available floor). 200 when a bundle exists; 404 if the
 *  ticker was never fetched. Triggers no LLM call. */
export async function fetchRecExport(
  symbol: string,
  { personaId, sampleFingerprint }: { personaId?: string | null; sampleFingerprint?: string } = {},
): Promise<RecExport> {
  const result = await http.GET('/api/recommendation/export/{ticker}', {
    params: {
      path: { ticker: symbol.toUpperCase() },
      query: { persona_id: personaId ?? undefined },
    },
    ...(dataMode === 'demo' && sampleFingerprint
      ? { headers: { 'x-convexa-sample-fingerprint': sampleFingerprint } }
      : {}),
  });
  const projected = projectRecommendation(dataOf(result, 'Export unavailable'));
  return {
    ...projected,
    context: projected.context ?? {
      candidates: emptyCandidateSet(symbol.toUpperCase()),
      risk_inputs: projectRiskInputs({ state: 'not_set' }),
      open_positions: projectOpenPositions({ source: 'simulated', state: 'not_sent' }),
    },
    egress_categories: projected.egress_categories ?? [],
  };
}

/** Gating + cap + availability (drives the action's enabled/de-emphasized/disabled presentation).
 *  Cheap, side-effect-free, always 200. Throws only on a transport fault (caller degrades to inert). */
export async function fetchRecStatus(symbol: string): Promise<RecStatus> {
  const result = await http.GET('/api/recommendation/status/{ticker}', {
    params: { path: { ticker: symbol.toUpperCase() } },
  });
  const wire = dataOf(result, 'Status unavailable');
  const projected = projectRecommendation(wire);
  return {
    availability: projected.availability as { in_app_enabled: boolean },
    gate: projected.gate,
    cap: projected.cap,
    powering: projected.powering,
    scenarios: projected.scenarios,
  };
}

/** Canonical persona source (EXISTING endpoint, INTERFACE §1.4). This feature single-sources the
 *  per-query persona list from it; the FE-embedded presets are the offline / assembly-failure
 *  fallback only. Best-effort: throws on any transport/shape fault so the caller falls back. The
 *  payload may be `PersonaDefinition[]` or `{ personas: PersonaDefinition[] }` — both are accepted. */
export async function fetchPersonas(): Promise<PersonaDefinition[]> {
  const result = await http.GET('/api/personas');
  const payload = dataOf(result, 'Personas unavailable') as unknown;
  const list = Array.isArray(payload) ? payload : (payload as { personas?: unknown })?.personas;
  if (!Array.isArray(list) || list.length === 0)
    throw new ApiError('Malformed personas payload', 200);
  return list;
}
