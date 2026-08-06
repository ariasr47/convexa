/**
 * F3 — the broker→PositionView projection: mapping fidelity (signed qty, explicit multiplier,
 * tri-state → literals), the sim-engine identity (same math, no new math), withheld entry-derived
 * reads, and the dual-basis label derivation at the stale boundary.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { mkLeg, mkPosition } from '@/features/trading/positions/fixtures';
import { buildPositionView } from '@/features/trading/positions/view';
import { describe, expect, it } from 'vitest';
import {
  NOTE_MULTIPLIER_RECONSTRUCTED,
  NOT_PROVIDED,
  UNAVAILABLE,
  brokerFactText,
  brokerLegId,
  brokerLegsOf,
  buildBrokerPositionView,
  netEntryFigureText,
  restsOnDerivedSize,
  withheldLiteralOf,
} from './brokerView';
import {
  AS_OF_AT_THRESHOLD,
  BOOK_CF_NO_RECON_NOTE,
  FIXED_NOW_MS,
  NOTE_MULTIPLIER_RECONSTRUCTED as FIXTURE_NOTE,
  POS_CAPTURE_NVDA_OPTION,
  POS_NO_COST_BASIS,
  POS_SPREAD,
  POS_UNRECOGNIZED,
  SINGLE_LEG_CASCADE_ARMS,
  STALE_AFTER_SECONDS,
  equityLeg,
  optionLeg,
  supplied,
  unparseable,
} from './fixtures';

const mark = (m: number): MarkResult => ({ mark: m, basis: 'snapshot', frozen: false });

function marksFor(bpId: string, values: number[]): Map<string, MarkResult | null> {
  return new Map(values.map((v, i) => [brokerLegId(bpId, i), mark(v)] as const));
}

describe('brokerLegsOf — mapping fidelity', () => {
  it('signed quantity ⇒ side + ABSOLUTE size (short = negative on the wire, an enum here)', () => {
    const legs = brokerLegsOf(POS_SPREAD);
    expect(legs[0]).toMatchObject({ side: 'long', qty: 1 });
    expect(legs[1]).toMatchObject({ side: 'short', qty: 1 });
  });

  it('explicit per-leg multiplier carried verbatim — never re-derived from kind', () => {
    const bp = {
      broker_position_id: 'bp-mult',
      fidelity: 'exact' as const,
      legs: [
        optionLeg({ multiplier: 10 }), // an adjusted contract — the exact case ×100 hardcodes break
        equityLeg({ multiplier: 1 }),
      ],
      unrealized_pl: supplied(1),
    };
    expect(brokerLegsOf(bp).map((l) => l.multiplier)).toEqual([10, 1]);
  });

  it('leg ids are stable across rebuilds (the mark-cache/diffing key)', () => {
    expect(brokerLegsOf(POS_SPREAD).map((l) => l.id)).toEqual(
      brokerLegsOf(POS_SPREAD).map((l) => l.id),
    );
  });
});

describe('tri-state broker facts → the closed render vocabulary', () => {
  it('not_supplied → `not provided` · unparseable → the `unavailable` family · supplied → dollars', () => {
    expect(brokerFactText({ state: 'not_supplied' })).toBe(NOT_PROVIDED);
    expect(brokerFactText(unparseable())).toBe(UNAVAILABLE);
    expect(brokerFactText(supplied(4.2))).toBe('$4.20');
  });

  it('`not provided` ≠ `not recorded` — two different truths, never one literal for the other', () => {
    expect(NOT_PROVIDED).toBe('not provided');
    expect(NOT_PROVIDED).not.toBe('not recorded');
    // Broker option legs ALWAYS carry strike/right/expiry (wire presence rules), so the mapped
    // leg rows never render the sim `not recorded` literal for them.
    const v = buildBrokerPositionView({
      position: POS_SPREAD,
      legMarks: marksFor('bp-spread-1', [5.1, 2.0]),
      dte: 20,
      nowMs: FIXED_NOW_MS,
    });
    for (const row of v.legs) {
      expect(row.instrument_text).not.toBe('not recorded');
      expect(row.expiry_text).not.toBe('not recorded');
    }
  });
});

describe('buildBrokerPositionView — the projection', () => {
  it('modeled P/L equals the SIM engine for an identical leg set (same math, no new math)', () => {
    const legMarks = marksFor('bp-spread-1', [5.1, 2.0]);
    const broker = buildBrokerPositionView({
      position: POS_SPREAD,
      legMarks,
      dte: 20,
      nowMs: FIXED_NOW_MS,
    });

    // The same two legs as a sim position, same entries, same marks.
    const simLegs = [
      mkLeg({ side: 'long', qty: 1, multiplier: 100, entry_price: 4.2, strike: 250 }),
      mkLeg({ side: 'short', qty: 1, multiplier: 100, entry_price: 1.9, strike: 260 }),
    ];
    const sim = buildPositionView({
      position: mkPosition(simLegs),
      legMarks: new Map([
        [simLegs[0].id, mark(5.1)],
        [simLegs[1].id, mark(2.0)],
      ]),
      dte: 20,
    });

    expect(broker.pl_dollar).toBe(sim.pl_dollar);
    expect(broker.mark.net_mark).toBe(sim.mark.net_mark);
    expect(broker.structure).toBe(sim.structure); // recogniser runs FE-side, one authority
    expect(broker.structure).toBe('call_debit_spread');
  });

  it('sim regression: buildPositionView emits origin `sim` (the one additive field) and stays pure', () => {
    const legs = [mkLeg()];
    const p = mkPosition(legs);
    const lm = new Map([[legs[0].id, mark(11)]]);
    const a = buildPositionView({ position: p, legMarks: lm, dte: 10 });
    const b = buildPositionView({ position: p, legMarks: lm, dte: 10 });
    expect(a.origin).toBe('sim');
    expect(a).toEqual(b);
  });

  it('missing cost basis WITHHOLDS every entry-derived read — never 0, never a partial figure', () => {
    const v = buildBrokerPositionView({
      position: POS_NO_COST_BASIS,
      legMarks: marksFor('bp-nocost-1', [6.0]),
      dte: 120,
      nowMs: FIXED_NOW_MS,
    });
    expect(v.entry_known).toBe(false);
    expect(v.pl_dollar).toBeNull();
    expect(v.pl_pct).toEqual({ kind: 'unavailable' });
    expect(v.net_entry_text).toBe(NOT_PROVIDED);
    // Per-leg truth stays visible: the broker mark fact renders its own literal.
    expect(v.leg_reads[0].cost_basis_text).toBe(NOT_PROVIDED);
    expect(v.leg_reads[0].broker_mark_text).toBe(NOT_PROVIDED);
  });

  it('an UNPARSEABLE cost basis renders the unavailable family (a different truth from not-supplied)', () => {
    const bp = {
      broker_position_id: 'bp-unp',
      fidelity: 'exact' as const,
      legs: [optionLeg({ cost_basis: unparseable() })],
      unrealized_pl: unparseable(),
    };
    const v = buildBrokerPositionView({
      position: bp,
      legMarks: marksFor('bp-unp', [5.0]),
      dte: 20,
      nowMs: FIXED_NOW_MS,
    });
    expect(v.net_entry_text).toBe(UNAVAILABLE);
    expect(v.leg_reads[0].cost_basis_text).toBe(UNAVAILABLE);
  });

  it('the unrecognized zero-leg entry is surfaced with EVERY aggregate withheld (never a $0 claim)', () => {
    const v = buildBrokerPositionView({
      position: POS_UNRECOGNIZED,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    expect(v.fidelity).toBe('unrecognized');
    expect(v.fidelity_notes).toEqual(['instrument class not representable']);
    expect(v.pl_dollar).toBeNull();
    expect(v.net_entry_text).toBe(NOT_PROVIDED);
    expect(v.legs).toHaveLength(0);
  });

  it('carries Webull unrealized P/L VERBATIM (tri-state) — never computed, never blended', () => {
    const v = buildBrokerPositionView({
      position: { ...POS_SPREAD, unrealized_pl: supplied(123.45) },
      legMarks: marksFor('bp-spread-1', [5.1, 2.0]),
      dte: 20,
      nowMs: FIXED_NOW_MS,
    });
    expect(v.unrealized_pl).toEqual({ state: 'supplied', value: 123.45 });
    expect(v.unrealized_pl.value).not.toBe(v.pl_dollar); // two numbers, two bases, never one
  });

  it('dual/single modeled label flips at the STALE boundary (server threshold, strictly >)', () => {
    const book = {
      state: 'ok' as const,
      as_of: AS_OF_AT_THRESHOLD,
      stale_after_seconds: STALE_AFTER_SECONDS,
    };
    const at = buildBrokerPositionView({
      position: POS_SPREAD,
      legMarks: marksFor('bp-spread-1', [5.1, 2.0]),
      dte: 20,
      nowMs: FIXED_NOW_MS,
      book,
    });
    expect(at.modeled_label).toBe('single');
    const past = buildBrokerPositionView({
      position: POS_SPREAD,
      legMarks: marksFor('bp-spread-1', [5.1, 2.0]),
      dte: 20,
      nowMs: FIXED_NOW_MS + 1,
      book,
    });
    expect(past.modeled_label).toBe('dual');
  });
});

describe('the corrected four-step cascade (SPEC §2.6)', () => {
  const cascade = (o: Partial<Parameters<typeof withheldLiteralOf>[0]>) =>
    withheldLiteralOf({
      contributing_legs: 2,
      legs_multiplier_unknown: 0,
      legs_basis_not_supplied: 0,
      legs_basis_unparseable: 0,
      ...o,
    });

  it('step 1 — a missing contract size is PERMANENT and outranks everything', () => {
    expect(cascade({ legs_multiplier_unknown: 1, legs_basis_unparseable: 1 })).toBe(NOT_PROVIDED);
  });

  it('step 2 beats step 3 — PERMANENCE FIRST. This is the shipped bug, corrected', () => {
    expect(cascade({ legs_basis_not_supplied: 1, legs_basis_unparseable: 1 })).toBe(NOT_PROVIDED);
  });

  it('step 3 — a transient cause alone is `unavailable`', () => {
    expect(cascade({ legs_basis_unparseable: 2 })).toBe(UNAVAILABLE);
  });

  it('step 4 — nothing withheld means the FIGURE renders (null, never a sixth literal)', () => {
    expect(cascade({})).toBeNull();
  });

  it('a zero-leg subject nets nothing — `not provided`, never a figure', () => {
    expect(cascade({ contributing_legs: 0 })).toBe(NOT_PROVIDED);
  });
});

describe('AC-15b — the correction is a BYTE-IDENTICAL no-op at leg level', () => {
  it.each(SINGLE_LEG_CASCADE_ARMS)('single-leg literal unchanged: %s', (_l, position, expected) => {
    const v = buildBrokerPositionView({
      position,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
      book: null,
    });
    if (expected === 'FIGURE') expect(v.net_entry_text).toMatch(/^\$[\d,]+\.\d{2} (debit|credit)$/);
    else expect(v.net_entry_text).toBe(expected);
  });
});

describe('the shared net-entry figure formatter', () => {
  it('is the shipped grammar, to the character', () => {
    expect(netEntryFigureText(13760, 'net_debit')).toBe('$13,760.00 debit');
    expect(netEntryFigureText(-1250, 'net_credit')).toBe('$1,250.00 credit');
  });
  it('renders a POSITIVE magnitude with a direction WORD — never a minus sign', () => {
    expect(netEntryFigureText(-1250, 'net_credit')).not.toMatch(/[-−]/);
  });
});

describe('P2 — the provenance boolean comes from ONE exported production constant', () => {
  const viewOf = (p: typeof POS_CAPTURE_NVDA_OPTION) =>
    buildBrokerPositionView({
      position: p,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
      book: null,
    });

  it('the constant equals the fixtures note verbatim (the FE/BE prose seam)', () => {
    expect(NOTE_MULTIPLIER_RECONSTRUCTED).toBe(FIXTURE_NOTE);
  });
  it('TRUE on a captured option position, FALSE with the note absent', () => {
    expect(viewOf(POS_CAPTURE_NVDA_OPTION).net_rests_on_derived_size).toBe(true);
    expect(viewOf(BOOK_CF_NO_RECON_NOTE.positions[0]).net_rests_on_derived_size).toBe(false);
  });
  it('MUTATION GUARD: exact-string membership, not a substring sniff', () => {
    expect(restsOnDerivedSize([NOTE_MULTIPLIER_RECONSTRUCTED])).toBe(true);
    expect(restsOnDerivedSize([`${NOTE_MULTIPLIER_RECONSTRUCTED} (edited)`])).toBe(false);
    expect(restsOnDerivedSize([])).toBe(false);
  });
});
