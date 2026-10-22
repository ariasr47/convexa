/**
 * fixtures.ts — named `RecResponse` builders for the rec-input surfaces (PLAN F4). Each builder is a
 * self-contained, minimal-but-complete produced rec covering one closed-vocabulary branch; component
 * specs compose them rather than hand-rolling a fresh envelope per test.
 */
import type {
  CandidateContract,
  CandidateSetEnvelope,
  CitedContract,
  FieldReason,
  Grounding,
  GroundingField,
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

// ---- ai-rec-grounding (SPEC §4, PLAN F9) --------------------------------------------------------

const bareField = (): GroundingField => ({
  state: 'not_applicable',
  basis: null,
  anchor_kind: null,
  anchor_value: null,
  range_low: null,
  range_high: null,
  expiration: null,
  not_checkable_reason: null,
});

function tracedLevel(
  basis: 'exact' | 'near',
  anchor_kind: GroundingField['anchor_kind'],
  value: number,
): GroundingField {
  return { ...bareField(), state: 'traced', basis, anchor_kind, anchor_value: value };
}

function tracedRange(low: number, high: number, expiration: string): GroundingField {
  return {
    ...bareField(),
    state: 'traced',
    basis: 'inside_range',
    range_low: low,
    range_high: high,
    expiration,
  };
}

function untracedField(): GroundingField {
  return { ...bareField(), state: 'untraced' };
}

function notCheckable(reason: NonNullable<GroundingField['not_checkable_reason']>): GroundingField {
  return { ...bareField(), state: 'not_checkable', not_checkable_reason: reason };
}

const structurallyUnchecked = (): GroundingField => notCheckable('structurally_unchecked');

/** The default, fully-traced grounding block — stop on `call_wall` (near), invalidation on `gex_spot`
 *  (exact), target inside the implied move for the cited expiration. `max_risk`/`position_size` are
 *  ALWAYS `not_checkable/structurally_unchecked` — the suppressed pair never varies across fixtures. */
function allTracedGrounding(): Grounding {
  return {
    card: 'all_traced',
    counts: { checked: 4, traced: 4, untraced: 0, not_checkable: 0 },
    tolerance_pct: 0.1,
    fields: {
      exit_stop: tracedLevel('near', 'call_wall', 262),
      exit_target: tracedRange(240, 280, '2026-07-18'),
      invalidation_level: tracedLevel('exact', 'gex_spot', 245),
      max_risk: structurallyUnchecked(),
      position_size: structurallyUnchecked(),
    },
  };
}

/** `recAllTraced()` — card `all_traced`, counts `{4,4,0,0}`. */
export function recAllTraced(): RecResponse {
  return baseResponse();
}

/** `recSomeTraced()` — card `some_traced`, counts `{4,3,1,0}`, stop `untraced`. */
export function recSomeTraced(): RecResponse {
  const g = allTracedGrounding();
  return baseResponse({
    grounding: {
      ...g,
      card: 'some_traced',
      counts: { checked: 4, traced: 3, untraced: 1, not_checkable: 0 },
      fields: { ...g.fields, exit_stop: untracedField() },
    },
  });
}

/** `recFabricated()` — card `none_traced`, counts `{4,0,4,0}`, all three checked fields `untraced`,
 *  cited contract off-set. */
export function recFabricated(): RecResponse {
  return baseResponse({
    grounding: {
      card: 'none_traced',
      counts: { checked: 4, traced: 0, untraced: 4, not_checkable: 0 },
      tolerance_pct: 0.1,
      fields: {
        exit_stop: untracedField(),
        exit_target: untracedField(),
        invalidation_level: untracedField(),
        max_risk: structurallyUnchecked(),
        position_size: structurallyUnchecked(),
      },
    },
    cited_contract: { state: 'off_set', contract: null, legs: [] },
  });
}

/** `recCouldNotCheck()` — card `could_not_check`, counts `{3,0,0,3}`. */
export function recCouldNotCheck(): RecResponse {
  return baseResponse({
    grounding: {
      card: 'could_not_check',
      counts: { checked: 3, traced: 0, untraced: 0, not_checkable: 3 },
      tolerance_pct: 0.1,
      fields: {
        exit_stop: notCheckable('no_named_level'),
        exit_target: notCheckable('no_cited_expiration'),
        invalidation_level: notCheckable('no_named_level'),
        max_risk: structurallyUnchecked(),
        position_size: structurallyUnchecked(),
      },
    },
  });
}

/** `recBlockAbsent()` — `baseResponse()` with the `grounding` key DELETED (not null — deleted). Must
 *  still state real stop/target figures so F17 arm 4 can tell "withheld" from "nothing to seed". */
export function recBlockAbsent(): RecResponse {
  const r = baseResponse();
  delete (r as { grounding?: Grounding }).grounding;
  return r;
}

/** `recLocalRules()` — card `local_rules`, counts `{2,2,0,0}`, no strikes/expiration cited. */
export function recLocalRules(): RecResponse {
  return baseResponse({
    strategy: baseStrategy({ strikes: [], expiration: null, structure: 'local rules' }),
    grounding: {
      card: 'local_rules',
      counts: { checked: 2, traced: 2, untraced: 0, not_checkable: 0 },
      tolerance_pct: 0.1,
      fields: {
        exit_stop: tracedLevel('near', 'gamma_flip', 262),
        exit_target: bareField(), // not_applicable — no expiration cited
        invalidation_level: tracedLevel('exact', 'gamma_flip', 245),
        max_risk: structurallyUnchecked(),
        position_size: structurallyUnchecked(),
      },
    },
    cited_contract: { state: 'none', contract: null, legs: [] },
  });
}

/** `recLocalRulesNothingCheckable()` — card `not_applicable`, counts `{0,0,0,0}`; every checkable
 *  field is `not_applicable` (the `gamma_flip`-null case, AC-64). */
export function recLocalRulesNothingCheckable(): RecResponse {
  return baseResponse({
    strategy: baseStrategy({
      strikes: [],
      expiration: null,
      invalidation_level: null,
      exit_plan: { target: null, stop: null },
    }),
    field_reasons: {
      max_risk: null,
      position_size: null,
      exit_target: null,
      exit_stop: null,
      invalidation_level: null,
    },
    grounding: {
      card: 'not_applicable',
      counts: { checked: 0, traced: 0, untraced: 0, not_checkable: 0 },
      tolerance_pct: 0.1,
      fields: {
        exit_stop: bareField(),
        exit_target: bareField(),
        invalidation_level: bareField(),
        max_risk: structurallyUnchecked(),
        position_size: structurallyUnchecked(),
      },
    },
    cited_contract: { state: 'none', contract: null, legs: [] },
  });
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
      risk_refusal: null,
    },
    field_reasons: {
      max_risk: null,
      position_size: null,
      exit_target: null,
      exit_stop: null,
      invalidation_level: null,
    },
    cited_contract: { state: 'cited', contract: contract(260, 'call'), legs: [] },
    grounding: allTracedGrounding(),
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
      risk_refusal: null,
    },
    field_reasons: {
      max_risk: null,
      position_size: null,
      exit_target: null,
      exit_stop: null,
      invalidation_level: null,
    },
    cited_contract: { state: 'none', contract: null, legs: [] },
    grounding: {
      card: 'not_applicable',
      counts: { checked: 0, traced: 0, untraced: 0, not_checkable: 0 },
      tolerance_pct: 0.1,
      fields: {
        exit_stop: bareField(),
        exit_target: bareField(),
        invalidation_level: bareField(),
        max_risk: structurallyUnchecked(),
        position_size: structurallyUnchecked(),
      },
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
      risk_refusal: null,
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

// ---- rec-absence-literals-hole ------------------------------------------------------------------

const reason = (
  reason: FieldReason['reason'],
  missing_input: FieldReason['missing_input'] = null,
): FieldReason => ({ reason, missing_input });

/** The primary observation shape: a `trade` card on which NONE of the six was named. */
export function recNoneNamed(): RecResponse {
  const r = baseResponse({
    strategy: baseStrategy({
      structure: null,
      strikes: [],
      expiration: null,
      entry_trigger: null,
      time_horizon: null,
      confidence: null,
    }),
  });
  r.field_reasons = {
    ...(r.field_reasons as NonNullable<RecResponse['field_reasons']>),
    structure: reason('not_given'),
    strikes: reason('not_given'),
    expiration: reason('not_given'),
    entry_trigger: reason('not_given'),
    time_horizon: reason('not_given'),
    confidence: reason('not_given'),
  };
  return r;
}

/** NO per-field reason information at all — a pre-feature or degraded server (AC-5). */
export function recNoFieldReasonsBlock(): RecResponse {
  const r = recNoneNamed();
  delete (r as { field_reasons?: unknown }).field_reasons;
  return r;
}

/** Values everywhere but blank-ish: `""` / whitespace / `[]` (AC-7). */
export function recBlankValues(): RecResponse {
  const r = baseResponse({
    strategy: baseStrategy({
      structure: '',
      strikes: [],
      expiration: '   ',
      entry_trigger: '',
      time_horizon: '  ',
      confidence: null,
    }),
  });
  r.field_reasons = {
    ...(r.field_reasons as NonNullable<RecResponse['field_reasons']>),
    structure: reason('not_given'),
    strikes: reason('not_given'),
    expiration: reason('not_given'),
    entry_trigger: reason('not_given'),
    time_horizon: reason('not_given'),
    confidence: reason('not_given'),
  };
  return r;
}
