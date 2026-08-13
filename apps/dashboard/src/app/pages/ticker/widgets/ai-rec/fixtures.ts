/**
 * fixtures.ts — named `RecResponse` builders for the rec-input surfaces (PLAN F4). Each builder is a
 * self-contained, minimal-but-complete produced rec covering one closed-vocabulary branch; component
 * specs compose them rather than hand-rolling a fresh envelope per test.
 */
import type {
  CandidateContract,
  CandidateSetEnvelope,
  CitedContract,
  RecResponse,
  RecStrategy,
} from '@convexa/api';

function candidateSet(overrides: Partial<CandidateSetEnvelope> = {}): CandidateSetEnvelope {
  return {
    ticker: 'TSLA',
    state: 'ok',
    as_of: '2026-06-26T14:00:00Z',
    snapshot_age_seconds: 30,
    session_basis: 'after_close',
    quote_age: 'unknown',
    anchor_spot: 250,
    anchor_basis: 'gex_spot',
    band_pct: 15,
    budget: 'prompt',
    sent_to_model: true,
    caps: { tenors: 2, rights: 2, strikes_per_tenor_right: 5, max_records: 20, max_bytes: 8_000 },
    included: { contracts: 2, expirations: ['2026-07-18'], expiration_count: 1 },
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
      quoted: 2,
      no_two_sided_quote: 0,
      atm_relative_spread_band: 'moderate',
      wide_quotes: false,
      wide_quote_threshold_pct: 15,
    },
    contracts: [contract(260, 'call')],
    ...overrides,
  };
}

function contract(strike: number, right: 'call' | 'put', quoted = true): CandidateContract {
  return {
    expiration: '2026-07-18',
    dte: 25,
    strike,
    right,
    distance_pct: 4,
    quote_presence: quoted ? 'quoted' : 'no_two_sided_quote',
    bid: quoted ? 4.8 : null,
    ask: quoted ? 5.2 : null,
    mid: quoted ? 5.0 : null,
    spread_abs: quoted ? 0.4 : null,
    spread_pct_of_mid: quoted ? 8 : null,
    open_interest: 500,
    volume: 120,
    iv_state: 'priced',
    iv: 0.32,
    greeks: { delta: right === 'call' ? 0.5 : -0.5, gamma: 0.02, theta: -0.05, vega: 0.12 },
  };
}

function baseStrategy(overrides: Partial<RecStrategy> = {}): RecStrategy {
  return {
    decision: 'trade',
    bias: 'long',
    structure: 'long call',
    strikes: [260],
    expiration: '2026-07-18',
    entry_trigger: 'break above 252',
    invalidation_level: 245,
    max_risk: '$300',
    position_size: '2 contracts',
    exit_plan: { target: 12, stop: 6 },
    time_horizon: '5d',
    confidence: 'medium',
    rationale: 'edge',
    right: 'call',
    ...overrides,
  };
}

function baseResponse(overrides: Partial<RecResponse> = {}): RecResponse {
  return {
    status: 'produced',
    persona: { id: null, name: 'Default (no persona)' },
    as_of: '2026-06-26T14:00:00Z',
    pinned_fingerprint: 'fp-A',
    stale_born: false,
    strategy: baseStrategy(),
    unavailable_reason: null,
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' },
    sent: {
      budget: 'prompt',
      candidates: candidateSet(),
      straddle_move_tenors: ['2026-07-18'],
      risk_inputs: {
        state: 'set',
        account_size: 50_000,
        per_trade_cap: { value: 1, unit: 'percent' },
        effective_dollar_cap: {
          state: 'derived',
          value: 500,
          not_derivable_reason: null,
          derived_from: { account_size: 50_000, cap_value: 1, cap_unit: 'percent' },
        },
        storage_available: true,
        updated_at: 1_700_000_000_000,
      },
      risk_inputs_digest: 'set:50000:1percent',
      open_positions: {
        source: 'simulated',
        state: 'none_open',
        this_underlying: null,
        portfolio: null,
      },
    },
    cap_check: {
      verdict: 'within',
      effective_dollar_cap: 500,
      cap_not_derivable_reason: null,
      parsed_risk_dollars: 300,
      model_max_risk_text: '$300',
    },
    field_reasons: { max_risk: null, position_size: null, exit_target: null, exit_stop: null },
    cited_contract: { state: 'cited', contract: contract(260, 'call'), legs: [] },
    ...overrides,
  };
}

/** A complete, correct `no_trade` answer. All four fields render `—`; the cap surface renders
 *  NOTHING (AC-58a). */
export function noTradeRec(): RecResponse {
  return baseResponse({
    strategy: baseStrategy({
      decision: 'no_trade',
      structure: null,
      strikes: [],
      expiration: null,
      max_risk: null,
      position_size: null,
      exit_plan: { target: null, stop: null },
      right: null,
    }),
    cap_check: {
      verdict: 'not_applicable',
      effective_dollar_cap: 500,
      cap_not_derivable_reason: null,
      parsed_risk_dollars: null,
      model_max_risk_text: null,
    },
    field_reasons: { max_risk: null, position_size: null, exit_target: null, exit_stop: null },
    cited_contract: { state: 'none', contract: null, legs: [] },
  });
}

/** A trade verdict with an empty risk block: `max_risk`/`position_size` render `not set` with the
 *  `Set your risk inputs` action (AC-71). */
export function tradeRecNoRiskBlock(): RecResponse {
  const base = baseResponse();
  return baseResponse({
    strategy: baseStrategy({ max_risk: null, position_size: null }),
    sent: {
      ...(base.sent as NonNullable<typeof base.sent>),
      risk_inputs: {
        state: 'not_set',
        account_size: null,
        per_trade_cap: null,
        effective_dollar_cap: {
          state: 'not_set',
          value: null,
          not_derivable_reason: null,
          derived_from: { account_size: null, cap_value: null, cap_unit: null },
        },
        storage_available: true,
        updated_at: null,
      },
    },
    cap_check: {
      verdict: 'no_cap',
      effective_dollar_cap: null,
      cap_not_derivable_reason: null,
      parsed_risk_dollars: null,
      model_max_risk_text: null,
    },
    field_reasons: {
      max_risk: { reason: 'unavailable', missing_input: 'risk_block' },
      position_size: { reason: 'unavailable', missing_input: 'risk_block' },
      exit_target: null,
      exit_stop: null,
    },
  });
}

/** A trade verdict whose parsed risk figure is strictly greater than the effective cap. */
export function tradeRecOverCap(): RecResponse {
  return baseResponse({
    strategy: baseStrategy({ max_risk: '$900' }),
    cap_check: {
      verdict: 'above',
      effective_dollar_cap: 500,
      cap_not_derivable_reason: null,
      parsed_risk_dollars: 900,
      model_max_risk_text: '$900',
    },
  });
}

/** A trade verdict whose parsed risk figure exactly equals the effective cap — `within` (AC-63). */
export function tradeRecEqualToCap(): RecResponse {
  return baseResponse({
    strategy: baseStrategy({ max_risk: '$500' }),
    cap_check: {
      verdict: 'within',
      effective_dollar_cap: 500,
      cap_not_derivable_reason: null,
      parsed_risk_dollars: 500,
      model_max_risk_text: '$500',
    },
  });
}

/** The model returned strike + expiration but no right — both legs shown, never the off-set literal
 *  (AC-74). */
export function recRightUndetermined(): RecResponse {
  const cited: CitedContract = {
    state: 'right_undetermined',
    contract: null,
    legs: [contract(260, 'call'), contract(260, 'put')],
  };
  return baseResponse({ strategy: baseStrategy({ right: undefined }), cited_contract: cited });
}

/** The cited strike/expiration is absent from the candidate set Convexa sent — `off_set` (AC-75). */
export function recOffSet(): RecResponse {
  return baseResponse({
    strategy: baseStrategy({ strikes: [999], expiration: '2026-12-18' }),
    cited_contract: { state: 'off_set', contract: null, legs: [] },
  });
}
