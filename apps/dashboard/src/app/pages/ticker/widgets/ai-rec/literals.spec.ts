import { describe, expect, it } from 'vitest';
import {
  noTradeRec,
  recOffSet,
  recRightUndetermined,
  tradeRecEqualToCap,
  tradeRecNoRiskBlock,
  tradeRecOverCap,
} from './fixtures';
import {
  candidateFreshnessLine,
  capSurface,
  citedLine,
  fieldLiteral,
  liquidityLine,
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
