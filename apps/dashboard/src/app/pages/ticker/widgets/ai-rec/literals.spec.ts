import { typographyTokens } from '@/shared/theme/tokens';
import type { GroundingField, GroundingState } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  ANCHOR_LABEL_FALLBACK,
  CAP_COULD_NOT_CHECK,
  CAP_REFUSAL_SENTENCE,
  GROUNDING_BLOCK_ABSENT,
  GROUNDING_CARD,
  MISSING_INPUT_CLAUSE,
  PREFILL_WITHHELD,
  someTracedLine,
  UNTRACED_LINE,
} from './copy';
import {
  noTradeRec,
  recAllTraced,
  recOffSet,
  recRightUndetermined,
  tradeRecEqualToCap,
  tradeRecNoRiskBlock,
  tradeRecOverCap,
} from './fixtures';
import {
  anchorLabel,
  candidateFreshnessLine,
  capRefusalLine,
  capSurface,
  cardGroundingLine,
  citedLine,
  fieldLiteral,
  figureClause,
  liquidityLine,
  prefillGate,
  registerSx,
  riskInputsSignature,
  riskInputsSuperseded,
} from './literals';

describe('fieldLiteral — AC-69/70/71/72/72a', () => {
  it('no_trade renders `dash` regardless of the value (checked FIRST)', () => {
    expect(fieldLiteral({ decision: 'no_trade', value: 300, reason: null })).toEqual({
      kind: 'dash',
    });
    expect(fieldLiteral({ decision: 'no_trade', value: null, reason: null })).toEqual({
      kind: 'dash',
    });
  });

  it('a real numeric value renders as `value`', () => {
    expect(fieldLiteral({ decision: 'trade', value: 12, reason: null })).toEqual({
      kind: 'value',
      text: '12',
    });
  });

  it('a real string value renders as `value`', () => {
    expect(fieldLiteral({ decision: 'trade', value: '$300', reason: null })).toEqual({
      kind: 'value',
      text: '$300',
    });
  });

  it('null/undefined/NaN/0/"" never render as a value', () => {
    for (const v of [null, undefined, NaN, 0, '']) {
      const r = fieldLiteral({ decision: 'trade', value: v, reason: null });
      expect(r.kind).not.toBe('value');
    }
  });

  it('a `not_given` reason renders `not_given`', () => {
    expect(
      fieldLiteral({
        decision: 'trade',
        value: null,
        reason: { reason: 'not_given', missing_input: null },
      }),
    ).toEqual({ kind: 'not_given' });
  });

  it('an `unavailable` reason with `missing_input: risk_block` renders `not_set`', () => {
    expect(
      fieldLiteral({
        decision: 'trade',
        value: null,
        reason: { reason: 'unavailable', missing_input: 'risk_block' },
      }),
    ).toEqual({ kind: 'not_set' });
  });

  it('AC-72a — an `unavailable` reason with any other missing input renders `unavailable`, never `not_set`', () => {
    for (const missing of ['candidate_quotes', 'straddle_move'] as const) {
      expect(
        fieldLiteral({
          decision: 'trade',
          value: null,
          reason: { reason: 'unavailable', missing_input: missing },
        }),
      ).toEqual({ kind: 'unavailable' });
    }
  });

  it('no value and no reason renders `unavailable` (never a guess)', () => {
    expect(fieldLiteral({ decision: 'trade', value: undefined, reason: undefined })).toEqual({
      kind: 'unavailable',
    });
  });
});

describe('capSurface — AC-56/57/58/58a/63', () => {
  it('not_applicable ⇒ none (the no_trade card renders NO cap surface at all)', () => {
    expect(capSurface('not_applicable')).toEqual({ kind: 'none' });
  });
  it('no_cap ⇒ no_cap', () => {
    expect(capSurface('no_cap')).toEqual({ kind: 'no_cap' });
  });
  it('within ⇒ comparison{within:true}; equality is within (AC-63)', () => {
    expect(capSurface('within')).toEqual({ kind: 'comparison', within: true });
  });
  it('above ⇒ comparison{within:false}', () => {
    expect(capSurface('above')).toEqual({ kind: 'comparison', within: false });
  });
  it('not_checkable ⇒ not_checkable, never a pass by default', () => {
    expect(capSurface('not_checkable')).toEqual({ kind: 'not_checkable' });
  });
  it('an unknown/absent token renders nothing, never a guess', () => {
    expect(capSurface(undefined)).toEqual({ kind: 'none' });
    expect(capSurface(null)).toEqual({ kind: 'none' });
  });

  it('fixture wiring: no_trade rec resolves to none; equal-to-cap resolves to within; over-cap resolves to above', () => {
    expect(capSurface(noTradeRec().cap_check!.verdict)).toEqual({ kind: 'none' });
    expect(capSurface(tradeRecEqualToCap().cap_check!.verdict)).toEqual({
      kind: 'comparison',
      within: true,
    });
    expect(capSurface(tradeRecOverCap().cap_check!.verdict)).toEqual({
      kind: 'comparison',
      within: false,
    });
    expect(capSurface(tradeRecNoRiskBlock().cap_check!.verdict)).toEqual({ kind: 'no_cap' });
  });
});

describe('citedLine — AC-73/74/75/76/77', () => {
  it('a right_undetermined cite renders both legs, never the off_set literal', () => {
    const line = citedLine(recRightUndetermined().cited_contract);
    expect(line.kind).toBe('right_undetermined');
    if (line.kind === 'right_undetermined') expect(line.legs).toHaveLength(2);
  });
  it('an off-set cite renders off_set', () => {
    expect(citedLine(recOffSet().cited_contract).kind).toBe('off_set');
  });
  it('a `none` cite (no_trade) renders none', () => {
    expect(citedLine(noTradeRec().cited_contract).kind).toBe('none');
  });
  it('an absent cited_contract degrades to none, never a throw', () => {
    expect(citedLine(undefined)).toEqual({ kind: 'none' });
    expect(citedLine(null)).toEqual({ kind: 'none' });
  });
  it('a quoted cited contract carries its strike/right/expiration', () => {
    const line = citedLine({
      state: 'cited',
      contract: {
        expiration: '2026-07-18',
        dte: 25,
        strike: 260,
        right: 'call',
        distance_pct: 4,
        quote_presence: 'quoted',
        bid: 4.8,
        ask: 5.2,
        mid: 5,
        spread_abs: 0.4,
        spread_pct_of_mid: 8,
        open_interest: 500,
        volume: 120,
        iv_state: 'priced',
        iv: 0.32,
        greeks: { delta: 0.5, gamma: 0.02, theta: -0.05, vega: 0.12 },
      },
      legs: [],
    });
    expect(line).toMatchObject({
      kind: 'cited',
      strike: 260,
      right: 'call',
      expiration: '2026-07-18',
    });
  });
  it('a no-two-sided-quote cited contract states the presence reason, never a blank field', () => {
    const line = citedLine({
      state: 'cited',
      contract: {
        expiration: '2026-07-18',
        dte: 25,
        strike: 260,
        right: 'call',
        distance_pct: 4,
        quote_presence: 'no_two_sided_quote',
        bid: null,
        ask: null,
        mid: null,
        spread_abs: null,
        spread_pct_of_mid: null,
        open_interest: 0,
        volume: 0,
        iv_state: 'unpriced',
        iv: null,
        greeks: { delta: null, gamma: null, theta: null, vega: null },
      },
      legs: [],
    });
    expect(line.kind).toBe('cited');
    if (line.kind === 'cited') expect(line.quoteText).toMatch(/no two-sided quote/);
  });
});

describe('liquidityLine — AC-4/66', () => {
  it('an unavailable set renders the unavailable literal', () => {
    expect(
      liquidityLine({
        ticker: 'TSLA',
        state: 'unavailable',
        as_of: null,
        snapshot_age_seconds: null,
        session_basis: null,
        quote_age: 'unknown',
        anchor_spot: null,
        anchor_basis: 'gex_spot',
        band_pct: 15,
        budget: 'prompt',
        sent_to_model: false,
        caps: {
          tenors: 2,
          rights: 2,
          strikes_per_tenor_right: 5,
          max_records: 20,
          max_bytes: 8000,
        },
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
          wide_quote_threshold_pct: 15,
        },
        contracts: [],
      }),
    ).toMatch(/unavailable/);
  });

  it('a checked-empty band renders the empty literal, distinct from unavailable', () => {
    expect(
      liquidityLine({
        ticker: 'TSLA',
        state: 'none_in_band',
        as_of: '2026-06-26T14:00:00Z',
        snapshot_age_seconds: 30,
        session_basis: 'after_close',
        quote_age: 'unknown',
        anchor_spot: 250,
        anchor_basis: 'gex_spot',
        band_pct: 15,
        budget: 'prompt',
        sent_to_model: false,
        caps: {
          tenors: 2,
          rights: 2,
          strikes_per_tenor_right: 5,
          max_records: 20,
          max_bytes: 8000,
        },
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
          wide_quote_threshold_pct: 15,
        },
        contracts: [],
      }),
    ).toMatch(/No candidates in band/);
  });

  it('zero omissions render `none omitted`, never an absent clause', () => {
    const line = liquidityLine(tradeRecEqualToCap().sent!.candidates);
    expect(line).toMatch(/none omitted/);
  });

  it('a non-zero omitted count states the count and the first-applicable reason, from the wire counts only', () => {
    const line = liquidityLine({
      ...tradeRecEqualToCap().sent!.candidates,
      omitted: {
        total: 5,
        expirations_omitted_by_cap: 0,
        by_reason: {
          outside_window: 0,
          outside_band: 5,
          no_interest: 0,
          expiration_cap: 0,
          strike_cap: 0,
        },
      },
    });
    expect(line).toContain('5 omitted (outside band)');
  });

  it('renders identically on a no_trade verdict (AC-66) — the strip is verdict-independent', () => {
    const line = liquidityLine(noTradeRec().sent!.candidates);
    expect(line).toMatch(/candidates across/);
  });

  it('a null envelope degrades to unavailable, never a throw', () => {
    expect(liquidityLine(null)).toMatch(/unavailable/);
    expect(liquidityLine(undefined)).toMatch(/unavailable/);
  });
});

describe('candidateFreshnessLine — AC-8 (GATE Q correction)', () => {
  it('names the as-of and a live-session/prior-close label', () => {
    const line = candidateFreshnessLine(tradeRecEqualToCap().sent!.candidates);
    expect(line).toContain(tradeRecEqualToCap().sent!.candidates.as_of as string);
    expect(line).toMatch(/prior close|live session/);
  });
  it('maps `rth` to live session and `after_close`/`closed_pre` to prior close', () => {
    const base = tradeRecEqualToCap().sent!.candidates;
    expect(candidateFreshnessLine({ ...base, session_basis: 'rth' })).toMatch(/live session/);
    expect(candidateFreshnessLine({ ...base, session_basis: 'after_close' })).toMatch(
      /prior close/,
    );
    expect(candidateFreshnessLine({ ...base, session_basis: 'closed_pre' })).toMatch(/prior close/);
  });
  it('degrades to null (never a lie) when the set carries no as-of', () => {
    expect(candidateFreshnessLine(null)).toBeNull();
    expect(
      candidateFreshnessLine({ ...tradeRecEqualToCap().sent!.candidates, as_of: null }),
    ).toBeNull();
  });
});

describe('citedLine — AC-8 as-of interpolation (GATE Q correction)', () => {
  it('interpolates the passed as-of into the quoted-arm fact line, never a bare "chain snapshot"', () => {
    const cited = tradeRecEqualToCap().cited_contract!;
    const line = citedLine(cited, '2026-06-23T14:00:00Z');
    expect(line.kind).toBe('cited');
    if (line.kind === 'cited') {
      expect(line.quoteText).toContain('from the 2026-06-23T14:00:00Z chain snapshot');
      expect(line.quoteText).not.toContain('from the chain snapshot');
    }
  });
  it('a missing as-of degrades to an honest "unknown" token, never a fabricated date', () => {
    const cited = tradeRecEqualToCap().cited_contract!;
    const line = citedLine(cited, null);
    if (line.kind === 'cited') expect(line.quoteText).toContain('from the unknown chain snapshot');
  });
});

describe('riskInputsSignature / riskInputsSuperseded — AC-64 (GATE Q correction)', () => {
  const set = tradeRecEqualToCap().sent!.risk_inputs;

  it('two structurally-identical blocks produce the same signature', () => {
    expect(riskInputsSignature(set)).toBe(riskInputsSignature({ ...set }));
  });
  it('a changed account size changes the signature', () => {
    expect(riskInputsSignature(set)).not.toBe(
      riskInputsSignature({ ...set, account_size: 75_000 }),
    );
  });
  it('a changed cap value or unit changes the signature', () => {
    expect(riskInputsSignature(set)).not.toBe(
      riskInputsSignature({ ...set, per_trade_cap: { value: 2, unit: 'percent' } }),
    );
    expect(riskInputsSignature(set)).not.toBe(
      riskInputsSignature({ ...set, per_trade_cap: { value: 1, unit: 'usd' } }),
    );
  });
  it('riskInputsSuperseded is false when either side is unknown — never a false positive', () => {
    expect(riskInputsSuperseded(set, null)).toBe(false);
    expect(riskInputsSuperseded(null, set)).toBe(false);
    expect(riskInputsSuperseded(undefined, undefined)).toBe(false);
  });
  it('riskInputsSuperseded is true iff the signatures actually differ (the guard BITES)', () => {
    expect(riskInputsSuperseded(set, set)).toBe(false);
    expect(riskInputsSuperseded(set, { ...set, account_size: 75_000 })).toBe(true);
  });
});

describe('ai-rec-grounding · closed lookups', () => {
  const bare = (state: GroundingState): GroundingField => ({
    state,
    basis: null,
    anchor_kind: null,
    anchor_value: null,
    range_low: null,
    range_high: null,
    expiration: null,
    not_checkable_reason: null,
  });

  it('AC-3 — the clause shape is selected by the wire `basis` alone, never by which numbers are present', () => {
    const near = figureClause({
      state: 'traced',
      basis: 'near',
      anchor_kind: 'call_wall',
      anchor_value: 412,
      range_low: 999,
      range_high: 999,
      expiration: '2026-09-18',
      not_checkable_reason: null,
    });
    expect(near).toEqual({ kind: 'near', anchor: 'call wall', value: 412 });
    const range = figureClause({
      state: 'traced',
      basis: 'inside_range',
      anchor_kind: 'call_wall',
      anchor_value: 412,
      range_low: 400,
      range_high: 420,
      expiration: '2026-09-18',
      not_checkable_reason: null,
    });
    expect(range).toEqual({ kind: 'inside_range', expiration: '2026-09-18', low: 400, high: 420 });
  });

  it('AC-2 — a traced clause naming a source with NO number renders NOWHERE (the negative half)', () => {
    // A malformed/impossible-per-contract payload (basis says traced-exact/near/inside_range but the
    // number the clause would need is null) must never crash into a half-sentence — it renders
    // `{ kind: 'none' }`, same as no clause at all, for every basis member.
    const exactNoValue = figureClause({
      state: 'traced',
      basis: 'exact',
      anchor_kind: 'call_wall',
      anchor_value: null,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: null,
    });
    expect(exactNoValue).toEqual({ kind: 'none' });
    const nearNoValue = figureClause({
      state: 'traced',
      basis: 'near',
      anchor_kind: 'call_wall',
      anchor_value: null,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: null,
    });
    expect(nearNoValue).toEqual({ kind: 'none' });
    const rangeNoEndpoints = figureClause({
      state: 'traced',
      basis: 'inside_range',
      anchor_kind: null,
      anchor_value: null,
      range_low: null,
      range_high: 420,
      expiration: '2026-09-18',
      not_checkable_reason: null,
    });
    expect(rangeNoEndpoints).toEqual({ kind: 'none' });
    const rangeNoExpiration = figureClause({
      state: 'traced',
      basis: 'inside_range',
      anchor_kind: null,
      anchor_value: null,
      range_low: 400,
      range_high: 420,
      expiration: null,
      not_checkable_reason: null,
    });
    expect(rangeNoExpiration).toEqual({ kind: 'none' });
  });

  it("AC-23 — a couldn't-check clause names WHICH missing input blocked the check, by closed lookup, never composed client-side", () => {
    const reasonFor = (
      reason: 'no_named_level' | 'no_cited_expiration' | 'straddle_move_unavailable',
    ) =>
      figureClause({
        state: 'not_checkable',
        not_checkable_reason: reason,
        basis: null,
        anchor_kind: null,
        anchor_value: null,
        range_low: null,
        range_high: null,
        expiration: null,
      });
    const noNamedLevel = reasonFor('no_named_level');
    const noCitedExpiration = reasonFor('no_cited_expiration');
    const straddleUnavailable = reasonFor('straddle_move_unavailable');
    expect(noNamedLevel).toEqual({
      kind: 'not_checkable',
      clause: MISSING_INPUT_CLAUSE.no_named_level,
    });
    expect(noCitedExpiration).toEqual({
      kind: 'not_checkable',
      clause: MISSING_INPUT_CLAUSE.no_cited_expiration,
    });
    expect(straddleUnavailable).toEqual({
      kind: 'not_checkable',
      clause: MISSING_INPUT_CLAUSE.straddle_move_unavailable,
    });
    // All three named reasons are pairwise distinct — a reader can tell WHICH input was missing.
    const clauses = [noNamedLevel, noCitedExpiration, straddleUnavailable].map((c) =>
      c.kind === 'not_checkable' ? c.clause : null,
    );
    expect(new Set(clauses).size).toBe(3);
  });

  it('AC-6 — all eleven anchor tokens map; an unrecognized token takes the level-class fallback', () => {
    const tokens = [
      'gex_spot',
      'call_wall',
      'put_wall',
      'peak_gex_strike',
      'gamma_flip',
      'max_pain',
      'vwap',
      'vwap_upper_2',
      'vwap_upper_3',
      'vwap_lower_2',
      'vwap_lower_3',
    ] as const;
    for (const t of tokens) {
      expect(anchorLabel(t)).toBeTruthy();
      expect(anchorLabel(t)).not.toMatch(/_/); // never a raw wire string
    }
    expect(anchorLabel('cap' as never)).toBe(ANCHOR_LABEL_FALLBACK);
    expect(anchorLabel(null)).toBe(ANCHOR_LABEL_FALLBACK);
  });

  it('AC-26 — the structurally-unchecked pair renders NO clause', () => {
    expect(
      figureClause({
        state: 'not_checkable',
        not_checkable_reason: 'structurally_unchecked',
        basis: null,
        anchor_kind: null,
        anchor_value: null,
        range_low: null,
        range_high: null,
        expiration: null,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('AC-22 (SB) + AC-68 — every literal is distinct from every other AND from all four shipped absence literals', () => {
    const closedSet = [
      GROUNDING_CARD.all_traced,
      GROUNDING_CARD.none_traced,
      GROUNDING_CARD.could_not_check,
      GROUNDING_CARD.local_rules,
      GROUNDING_BLOCK_ABSENT,
      someTracedLine(1, 4),
      UNTRACED_LINE,
      PREFILL_WITHHELD.untraced,
      PREFILL_WITHHELD.not_checkable,
      PREFILL_WITHHELD.block_absent,
    ];
    expect(new Set(closedSet).size).toBe(closedSet.length);
    const absence = ['—', 'not set', 'unavailable', 'not given'];
    for (const s of closedSet) expect(absence).not.toContain(s);
    expect(GROUNDING_CARD.could_not_check).not.toBe(GROUNDING_BLOCK_ABSENT);
    for (const s of closedSet) expect(s.toLowerCase()).not.toContain('grounding');
  });

  it('AC-68 (D8) — the THREE prefill literals are pairwise distinct in their TAILS, not merely as strings', () => {
    const three = [
      PREFILL_WITHHELD.untraced,
      PREFILL_WITHHELD.not_checkable,
      PREFILL_WITHHELD.block_absent,
    ];
    expect(new Set(three).size).toBe(3);
    const stem = 'Not pre-filled — ';
    const tails = three.map((s) => {
      expect(s.startsWith(stem)).toBe(true);
      return s.slice(stem.length);
    });
    expect(new Set(tails).size).toBe(3);
    for (const a of tails) for (const b of tails) if (a !== b) expect(b.includes(a)).toBe(false);
    expect(PREFILL_WITHHELD.block_absent).toContain("wasn't checked against Convexa's numbers");
    expect(PREFILL_WITHHELD.block_absent).not.toBe(GROUNDING_BLOCK_ABSENT);
  });

  it('AC-40 — the three refusal sentences are distinct; an absent/unknown token renders the shipped literal alone', () => {
    expect(capRefusalLine('not_checkable', 'no_text')).toBe(CAP_REFUSAL_SENTENCE.no_text);
    expect(capRefusalLine('not_checkable', null)).toBe(CAP_COULD_NOT_CHECK);
    expect(capRefusalLine('not_checkable', 'bogus' as never)).toBe(CAP_COULD_NOT_CHECK);
    expect(new Set(Object.values(CAP_REFUSAL_SENTENCE)).size).toBe(3);
  });

  it('AC-16 (SB) — poisoning a per-field token changes no count and no card member', () => {
    const g = recAllTraced().grounding!;
    const poisoned = {
      ...g,
      fields: { ...g.fields, exit_stop: { ...g.fields.exit_stop, state: 'untraced' as const } },
    };
    expect(cardGroundingLine(poisoned)).toEqual(cardGroundingLine(g));
  });

  it('AC-23 — not_applicable gets one honest closed grounding statement', () => {
    const line = cardGroundingLine({
      card: 'not_applicable',
      counts: { checked: 0, traced: 0, untraced: 0, not_checkable: 0 },
      tolerance_pct: 0,
      fields: recAllTraced().grounding!.fields,
    });
    expect(line.kind).toBe('quiet');
    if (line.kind !== 'quiet') throw new Error('expected a closed grounding statement');
    expect(line.text).toBe(GROUNDING_CARD.not_applicable);
    expect(line.text).not.toMatch(/AI|source|Convexa number/i);
  });

  it('AC-7 (SB) / AC-68 — the prefill gate is a closed lookup on the wire state, FIVE arms', () => {
    expect(prefillGate(bare('traced'))).toEqual({ seed: true, reason: null });
    expect(prefillGate(bare('untraced'))).toEqual({
      seed: false,
      reason: PREFILL_WITHHELD.untraced,
    });
    expect(prefillGate(bare('not_checkable'))).toEqual({
      seed: false,
      reason: PREFILL_WITHHELD.not_checkable,
    });
    // `not_applicable` — the rec stated no figure; there was nothing to seed and nothing to explain.
    expect(prefillGate(bare('not_applicable'))).toEqual({ seed: false, reason: null });
    // D8 — NO grounding block: never a seed, AND its own reason (never the `not_checkable` one).
    expect(prefillGate(undefined)).toEqual({ seed: false, reason: PREFILL_WITHHELD.block_absent });
    expect(prefillGate(null)).toEqual({ seed: false, reason: PREFILL_WITHHELD.block_absent });
    expect(prefillGate(undefined).reason).not.toBe(PREFILL_WITHHELD.not_checkable);
    // An unrecognized token is unreachable from a conformant server (the wire enum is closed); the
    // shipped discipline is "unknown renders nothing, never a guess" — and it never seeds.
    expect(prefillGate(bare('bogus' as never))).toEqual({ seed: false, reason: null });
  });
});

describe('registerSx — F12, DESIGN_SYSTEM Amendment 2026-08-13, D3 (the type register)', () => {
  const MONO = typographyTokens.monoFontFamily;
  const SANS = typographyTokens.fontFamily;

  it('POSITIVE — a `traced` figure is mono, an `untraced` figure is sans (asserted at rendered scope by ai-rec.grounding.spec.tsx)', () => {
    expect(registerSx('traced')).toEqual({ fontFamily: MONO });
    expect(registerSx('untraced')).toEqual({ fontFamily: SANS });
  });

  it('`not_checkable` is its OWN named arm — a value that exists but was never checked is still NOT traced, and must NOT inherit the mono register', () => {
    // Asserted as its own case, never folded into `untraced` (a different fact) and never left to a
    // wildcard that would silently default to `traced`'s mono register.
    expect(registerSx('not_checkable')).toEqual({ fontFamily: SANS });
    expect(registerSx('not_checkable')).not.toEqual(registerSx('traced'));
  });

  it('`not_applicable` — never actually renders a value (vacuous), but is named explicitly and stays out of the mono register', () => {
    expect(registerSx('not_applicable')).toEqual({ fontFamily: SANS });
  });

  it('an absent grounding state (no data reached this value) defaults SAFE — never mono', () => {
    expect(registerSx(undefined)).toEqual({ fontFamily: SANS });
    expect(registerSx(null)).toEqual({ fontFamily: SANS });
  });

  it('EVERY non-traced member is pairwise identical to each other and distinct from `traced` — the exhaustive set has exactly two outcomes', () => {
    const nonTraced = [
      registerSx('untraced'),
      registerSx('not_checkable'),
      registerSx('not_applicable'),
      registerSx(undefined),
    ];
    for (const r of nonTraced) expect(r).toEqual({ fontFamily: SANS });
    expect(registerSx('traced')).not.toEqual({ fontFamily: SANS });
  });
});
