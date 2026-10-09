/**
 * grouping.ts — the pure, total, clock-injected group arithmetic (SPEC §2, PLAN F4).
 * Built over `BrokerPositionView[]` composed from the F1 fixtures — never a re-projection.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import type { BrokerBook, BrokerPosition } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { brokerLegId, buildBrokerPositionView } from './brokerView';
import {
  AS_OF_STALE,
  BOOK_CAPTURED_COMPLETE,
  BOOK_CF_CREDIT,
  BOOK_CF_DOUBLY_BROKEN,
  BOOK_CF_MIXED_CAUSE,
  BOOK_CF_NO_COST,
  BOOK_CF_NO_RECON_NOTE,
  BOOK_CF_NO_SIZE,
  BOOK_CF_TWO_LEG_MEMBER,
  BOOK_CF_UNPARSEABLE,
  BOOK_CF_ZERO_NET,
  FIXED_NOW_MS,
  POS_UNRECOGNIZED,
  notSupplied,
  optionLeg,
  supplied,
} from './fixtures';
import {
  groupBook,
  groupNetEntryText,
  plWithheldLiteralOf,
  withheldCauseOf,
  withheldCountOf,
} from './grouping';

const groupsOf = (book: BrokerBook) =>
  groupBook(
    book.positions.map((position) =>
      buildBrokerPositionView({
        position,
        legMarks: new Map(),
        dte: null,
        nowMs: FIXED_NOW_MS,
        book,
      }),
    ),
    book,
    FIXED_NOW_MS,
  );

describe('AC-1 — the captured book yields 3 groups + 2 lone entries + 5 equity rows', () => {
  it('splits into the exact composition SPEC §1 records', () => {
    const { groups, ungrouped } = groupsOf(BOOK_CAPTURED_COMPLETE);
    expect(groups.filter((g) => g.leg_count > 1).map((g) => g.key)).toEqual([
      'AAPL',
      'META',
      'TSLA',
    ]);
    expect(groups.filter((g) => g.leg_count === 1).map((g) => g.key)).toEqual(['NVDA', 'PLTR']);
    expect(ungrouped).toHaveLength(5);
    expect(ungrouped.every((v) => v.broker.legs.every((l) => l.kind === 'equity'))).toBe(true);
  });
});

describe("AC-8 — a group's net equals the signed sum of its members' rendered figures", () => {
  it('AAPL / META / TSLA reproduce SPEC §1 to the cent, and equal Σ member.net_entry_cost', () => {
    const { groups } = groupsOf(BOOK_CAPTURED_COMPLETE);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    const mustGet = (k: string) => {
      const g = byKey.get(k);
      if (g == null) throw new Error(`no group ${k}`);
      return g;
    };
    const aapl = mustGet('AAPL');
    const meta = mustGet('META');
    const tsla = mustGet('TSLA');
    expect(aapl.net_entry_text).toBe('$3,850.00 debit');
    expect(meta.net_entry_text).toBe('$3,805.00 debit');
    expect(tsla.net_entry_text).toBe('$13,760.00 debit');
    for (const g of [aapl, meta, tsla]) {
      expect(g.net_entry.kind).toBe('value');
      if (g.net_entry.kind === 'value') {
        const memberSum = g.members.reduce((acc, m) => acc + m.net_entry_cost, 0);
        expect(g.net_entry.dollars).toBeCloseTo(memberSum, 6);
      }
    }
  });
});

/**
 * Real marks off each leg's own `broker_mark`, so `pl_dollar` resolves to a FIGURE — an isolated
 * check of the ARITHMETIC ONLY, orthogonal to the withholding axis AC-12/13/14 exercise below (a
 * test-setup concern, matching `BrokerGroupHeader.spec.tsx`'s own `marksForBook`).
 */
function groupsWithResolvedMarks(book: BrokerBook) {
  const legMarks = new Map<string, { mark: number; basis: 'snapshot'; frozen: boolean }>();
  for (const p of book.positions) {
    p.legs.forEach((l, i) => {
      const mark = l.broker_mark.state === 'supplied' ? (l.broker_mark.value ?? 0) : 0;
      legMarks.set(brokerLegId(p.broker_position_id, i), {
        mark,
        basis: 'snapshot',
        frozen: false,
      });
    });
  }
  return groupBook(
    book.positions.map((position) =>
      buildBrokerPositionView({ position, legMarks, dte: null, nowMs: FIXED_NOW_MS, book }),
    ),
    book,
    FIXED_NOW_MS,
  );
}

describe('AC-11 — the group modeled P/L equals Σ member.pl_dollar, exactly', () => {
  it('AAPL / META / TSLA: group.pl_dollar sums its own resolved members, to the cent', () => {
    const { groups } = groupsWithResolvedMarks(BOOK_CAPTURED_COMPLETE);
    for (const key of ['AAPL', 'META', 'TSLA']) {
      const g = groups.find((x) => x.key === key);
      if (g == null) throw new Error(`no group ${key}`);
      // Guards the sum against a silent partial fold: every member must have resolved for the
      // group total to mean anything (`Σ (member.pl_dollar ?? 0)` is the NAMED FORBIDDEN form).
      expect(g.members.every((m) => m.pl_dollar != null)).toBe(true);
      const memberSum = g.members.reduce((acc, m) => acc + (m.pl_dollar as number), 0);
      expect(g.pl_dollar).not.toBeNull();
      expect(g.pl_dollar).toBeCloseTo(memberSum, 6);
    }
  });
});

describe('AC-11 / [absent-is-not-none] — the REAL feed shape: the group P/L never claims `unavailable` over a PERMANENT `not provided`', () => {
  it('captured book, NO injected marks (production never fetches a contract key for an unpriceable leg): every group P/L renders `not provided`, matching every member', () => {
    // `groupsOf` (this file's own harness, above) already uses `legMarks: new Map()` — the exact
    // production shape for the real feed, where every option leg is `unpriceable` (no
    // strike/expiry/right) so `useBrokerMarks` never resolves a contract key for it.
    const { groups } = groupsOf(BOOK_CAPTURED_COMPLETE);
    for (const key of ['AAPL', 'META', 'TSLA']) {
      const g = groups.find((x) => x.key === key);
      if (g == null) throw new Error(`no group ${key}`);
      // The net is a FIGURE (cost basis is fully known) — this is the exact shape that let the
      // old hardcoded branch fall through to `UNAVAILABLE`.
      expect(g.net_entry.kind).toBe('value');
      expect(g.pl_dollar).toBeNull();
      expect(plWithheldLiteralOf(g)).toBe('not provided');
      // Every member independently reaches the SAME conclusion via its own leg-level predicate
      // (`!entry_known || unpriceable`) — the byte-identity this test exists to pin.
      for (const m of g.members) {
        expect(m.pl_dollar).toBeNull();
        expect(m.entry_known).toBe(true);
        expect(m.unpriceable).toBe(true);
      }
    }
  });
});

describe('AC-9b — a credit group renders the word, positive magnitude, no minus', () => {
  it('renders $1,600.00 credit', () => {
    const { groups } = groupsOf(BOOK_CF_CREDIT);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.net_entry.kind).toBe('value');
    if (g.net_entry.kind === 'value') expect(g.net_entry.basis).toBe('net_credit');
    expect(g.net_entry_text).toMatch(/^\$1,600\.00 credit$/);
  });
});

describe('AC-9c — a group netting to 0.00 renders `$0.00` with NO direction word', () => {
  it('BOOK_CF_ZERO_NET renders the bare figure', () => {
    const { groups } = groupsOf(BOOK_CF_ZERO_NET);
    expect(groups).toHaveLength(1);
    expect(groups[0].net_entry_text).toBe('$0.00');
  });

  it('the rule keys on the FORMATTED magnitude, not an epsilon', () => {
    expect(groupNetEntryText(0.004, 'net_debit')).toBe('$0.00');
    expect(groupNetEntryText(0.006, 'net_debit')).toBe('$0.01 debit');
  });
});

describe('AC-12 — a missing cost or contract size withholds the net entirely', () => {
  it.each([
    ['BOOK_CF_NO_COST', BOOK_CF_NO_COST],
    ['BOOK_CF_NO_SIZE', BOOK_CF_NO_SIZE],
  ] as const)('%s withholds with `not provided`, never a fabricated figure', (_label, book) => {
    const { groups } = groupsOf(book);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.net_entry).toEqual({ kind: 'withheld', literal: 'not provided' });
    expect(g.net_entry_text).toBe('not provided');
    expect(g.net_entry_text).not.toBe('$0.00');
    expect(g.net_entry_text).not.toMatch(/NaN/);
  });
});

describe('AC-13 — the P/L is withheld with the net, same literal', () => {
  it.each([
    ['BOOK_CF_NO_COST', BOOK_CF_NO_COST],
    ['BOOK_CF_NO_SIZE', BOOK_CF_NO_SIZE],
  ] as const)('%s withholds pl_dollar too', (_label, book) => {
    const { groups } = groupsOf(book);
    expect(groups[0].pl_dollar).toBeNull();
  });
});

describe('AC-13 — FORBIDDEN IMPLEMENTATION: a partial P/L sum', () => {
  it('one withheld member + one healthy member ⇒ pl_dollar is null, never the healthy value', () => {
    const goodLeg = optionLeg({
      symbol: 'ZZZ',
      underlying: 'ZZZ',
      quantity: 1,
      cost_basis: supplied(2),
      broker_mark: supplied(2.5),
    });
    const goodPos: BrokerPosition = {
      broker_position_id: 'zzz-good',
      fidelity: 'exact',
      legs: [goodLeg],
      unrealized_pl: notSupplied(),
    };
    const badLeg = optionLeg({
      symbol: 'ZZZ',
      underlying: 'ZZZ',
      quantity: 1,
      cost_basis: notSupplied(),
      broker_mark: notSupplied(),
    });
    const badPos: BrokerPosition = {
      broker_position_id: 'zzz-bad',
      fidelity: 'partial',
      fidelity_notes: [],
      legs: [badLeg],
      unrealized_pl: notSupplied(),
    };
    const mark = (m: number): MarkResult => ({ mark: m, basis: 'snapshot', frozen: false });
    const goodView = buildBrokerPositionView({
      position: goodPos,
      legMarks: new Map([[brokerLegId('zzz-good', 0), mark(3)]]),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    const badView = buildBrokerPositionView({
      position: badPos,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    expect(goodView.pl_dollar).not.toBeNull();
    const theNonNullMemberValue = goodView.pl_dollar as number;
    expect(theNonNullMemberValue).not.toBe(0);

    const { groups } = groupBook([goodView, badView], null, FIXED_NOW_MS);
    expect(groups).toHaveLength(1);
    expect(groups[0].pl_dollar).toBeNull();
    expect(groups[0].pl_dollar).not.toBe(theNonNullMemberValue);
  });
});

describe('AC-14 — a transient cause is `unavailable`, textually distinct', () => {
  it('BOOK_CF_UNPARSEABLE renders `unavailable`, never `not provided`', () => {
    const { groups } = groupsOf(BOOK_CF_UNPARSEABLE);
    expect(groups[0].net_entry).toEqual({ kind: 'withheld', literal: 'unavailable' });
  });

  it('a permanent-only book never renders `unavailable`', () => {
    const { groups } = groupsOf(BOOK_CF_NO_COST);
    expect(groups[0].net_entry).toEqual({ kind: 'withheld', literal: 'not provided' });
  });
});

describe('AC-15 — mixed causes: `not provided` wins, deterministically', () => {
  it('BOOK_CF_MIXED_CAUSE renders `not provided`', () => {
    const { groups } = groupsOf(BOOK_CF_MIXED_CAUSE);
    expect(groups[0].net_entry).toEqual({ kind: 'withheld', literal: 'not provided' });
  });
});

describe('AC-17b — the union count: a doubly-broken leg is counted ONCE', () => {
  it('BOOK_CF_DOUBLY_BROKEN — 1 of 2, never 2 of 2', () => {
    const { groups } = groupsOf(BOOK_CF_DOUBLY_BROKEN);
    const g = groups[0];
    expect(g.legs_withholding_permanent).toBe(1);
    expect(g.leg_count).toBe(2);
    expect(withheldCountOf(g)).toBe(1);
    expect(withheldCauseOf(g)).toBe('both_permanent');
    // The naive SUM double-counts — this is the number that must NEVER be rendered.
    expect(g.legs_basis_not_supplied + g.legs_multiplier_unknown).toBe(2);
  });
});

describe('AC-6 / AC-6c — leg_count comes from the wire legs, not the position count', () => {
  it('BOOK_CF_TWO_LEG_MEMBER: leg_count 3, position_count 2', () => {
    const { groups } = groupsOf(BOOK_CF_TWO_LEG_MEMBER);
    expect(groups).toHaveLength(1);
    expect(groups[0].leg_count).toBe(3);
    expect(groups[0].position_count).toBe(2);
  });
});

describe('AC-22 — an equity leg is never a member and never a contributor', () => {
  it("AAPL's group has 2 option-only members; the equity row sits in ungrouped", () => {
    const { groups, ungrouped } = groupsOf(BOOK_CAPTURED_COMPLETE);
    const aapl = groups.find((g) => g.key === 'AAPL');
    if (aapl == null) throw new Error('no AAPL group');
    expect(aapl.members).toHaveLength(2);
    expect(aapl.members.every((m) => m.broker.legs.every((l) => l.kind === 'option'))).toBe(true);
    expect(ungrouped.some((v) => v.broker.legs.some((l) => l.underlying === 'AAPL'))).toBe(true);
  });
});

describe('AC-24a — an `unrecognized` entry is never grouped or counted', () => {
  it('POS_UNRECOGNIZED stays in ungrouped and never touches Σ leg_count', () => {
    const withUnrecognized: BrokerBook = {
      ...BOOK_CAPTURED_COMPLETE,
      positions: [...BOOK_CAPTURED_COMPLETE.positions, POS_UNRECOGNIZED],
    };
    const before = groupsOf(BOOK_CAPTURED_COMPLETE);
    const after = groupsOf(withUnrecognized);
    expect(
      after.ungrouped.some(
        (v) => v.broker.broker_position_id === POS_UNRECOGNIZED.broker_position_id,
      ),
    ).toBe(true);
    expect(
      after.groups.every(
        (g) =>
          !g.members.some(
            (m) => m.broker.broker_position_id === POS_UNRECOGNIZED.broker_position_id,
          ),
      ),
    ).toBe(true);
    const sumLegCount = (gs: typeof before.groups) => gs.reduce((acc, g) => acc + g.leg_count, 0);
    expect(sumLegCount(after.groups)).toBe(sumLegCount(before.groups));
  });
});

describe('totality — never throws, and a malformed member routes to ungrouped', () => {
  it('an empty view array yields an empty grouped book', () => {
    expect(() => groupBook([], null, FIXED_NOW_MS)).not.toThrow();
    const g = groupBook([], null, FIXED_NOW_MS);
    expect(g.groups).toEqual([]);
    expect(g.ungrouped).toEqual([]);
  });

  it('a view whose legs are `[]` (unrecognized) routes to ungrouped', () => {
    const view = buildBrokerPositionView({
      position: POS_UNRECOGNIZED,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    const g = groupBook([view], null, FIXED_NOW_MS);
    expect(g.groups).toEqual([]);
    expect(g.ungrouped).toHaveLength(1);
  });

  it('a blank underlying routes to ungrouped', () => {
    const pos: BrokerPosition = {
      broker_position_id: 'malformed-blank',
      fidelity: 'exact',
      legs: [optionLeg({ symbol: '', underlying: '', quantity: 1 })],
      unrealized_pl: notSupplied(),
    };
    const view = buildBrokerPositionView({
      position: pos,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    const g = groupBook([view], null, FIXED_NOW_MS);
    expect(g.groups).toEqual([]);
    expect(g.ungrouped).toHaveLength(1);
  });

  it('a mixed-underlying position routes to ungrouped', () => {
    const pos: BrokerPosition = {
      broker_position_id: 'malformed-mixed',
      fidelity: 'exact',
      legs: [
        optionLeg({ symbol: 'AAA', underlying: 'AAA', quantity: 1 }),
        optionLeg({ symbol: 'BBB', underlying: 'BBB', quantity: -1 }),
      ],
      unrealized_pl: notSupplied(),
    };
    const view = buildBrokerPositionView({
      position: pos,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    const g = groupBook([view], null, FIXED_NOW_MS);
    expect(g.groups).toEqual([]);
    expect(g.ungrouped).toHaveLength(1);
  });

  it('a present-but-NaN multiplier routes to ungrouped (an ABSENT one does not)', () => {
    const pos: BrokerPosition = {
      broker_position_id: 'malformed-nan-mult',
      fidelity: 'exact',
      legs: [optionLeg({ symbol: 'CCC', underlying: 'CCC', quantity: 1, multiplier: Number.NaN })],
      unrealized_pl: notSupplied(),
    };
    const view = buildBrokerPositionView({
      position: pos,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    const g = groupBook([view], null, FIXED_NOW_MS);
    expect(g.groups).toEqual([]);
    expect(g.ungrouped).toHaveLength(1);
  });
});

describe('the invariants in §2.6 hold on every fixture book', () => {
  const books: BrokerBook[] = [
    BOOK_CAPTURED_COMPLETE,
    BOOK_CF_CREDIT,
    BOOK_CF_ZERO_NET,
    BOOK_CF_NO_COST,
    BOOK_CF_NO_SIZE,
    BOOK_CF_UNPARSEABLE,
    BOOK_CF_MIXED_CAUSE,
    BOOK_CF_DOUBLY_BROKEN,
    BOOK_CF_TWO_LEG_MEMBER,
    BOOK_CF_NO_RECON_NOTE,
  ];
  it('both cardinality invariants hold on every group of every book', () => {
    for (const book of books) {
      for (const g of groupsOf(book).groups) {
        expect(g.legs_basis_not_supplied + g.legs_basis_unparseable).toBeLessThanOrEqual(
          g.leg_count,
        );
        expect(g.legs_withholding_permanent + g.legs_withholding_transient).toBeLessThanOrEqual(
          g.leg_count,
        );
      }
    }
  });
});

describe('modeled_label is derived at the GROUP from isStale, never read off members[0]', () => {
  it('fresh as_of ⇒ single; stale as_of ⇒ dual, for every group', () => {
    const fresh = groupsOf(BOOK_CAPTURED_COMPLETE);
    expect(fresh.groups.length).toBeGreaterThan(0);
    expect(fresh.groups.every((g) => g.modeled_label === 'single')).toBe(true);

    const staleBook: BrokerBook = { ...BOOK_CAPTURED_COMPLETE, as_of: AS_OF_STALE };
    const stale = groupsOf(staleBook);
    expect(stale.groups.every((g) => g.modeled_label === 'dual')).toBe(true);
  });
});

describe('P1/P3 — provenance ORs across members; absent when withheld, present on $0.00', () => {
  it('captured book true; no-recon-note book false; zero-net book true with kind value', () => {
    const captured = groupsOf(BOOK_CAPTURED_COMPLETE);
    expect(captured.groups.every((g) => g.net_rests_on_derived_size)).toBe(true);

    const noRecon = groupsOf(BOOK_CF_NO_RECON_NOTE);
    expect(noRecon.groups[0].net_rests_on_derived_size).toBe(false);

    const zeroNet = groupsOf(BOOK_CF_ZERO_NET);
    expect(zeroNet.groups[0].net_rests_on_derived_size).toBe(true);
    expect(zeroNet.groups[0].net_entry.kind).toBe('value');
  });
});

describe('singleton agreement on the captured lone legs', () => {
  it('NVDA and PLTR: group text is byte-identical to the member text', () => {
    const { groups } = groupsOf(BOOK_CAPTURED_COMPLETE);
    for (const key of ['NVDA', 'PLTR']) {
      const g = groups.find((x) => x.key === key);
      if (g == null) throw new Error(`no group ${key}`);
      expect(g.members).toHaveLength(1);
      expect(g.net_entry_text).toBe(g.members[0].net_entry_text);
    }
  });
});

describe('the deliberate zero-net singleton divergence is PINNED, not accidental', () => {
  it('a one-position group with a supplied basis of 0 renders the group bare and the member with a word', () => {
    const pos: BrokerPosition = {
      broker_position_id: 'zero-singleton',
      fidelity: 'exact',
      legs: [optionLeg({ symbol: 'QQQ', underlying: 'QQQ', quantity: 1, cost_basis: supplied(0) })],
      unrealized_pl: notSupplied(),
    };
    const view = buildBrokerPositionView({
      position: pos,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
    });
    const { groups } = groupBook([view], null, FIXED_NOW_MS);
    expect(groups).toHaveLength(1);
    expect(groups[0].position_count).toBe(1);
    expect(groups[0].net_entry_text).toBe('$0.00');
    expect(view.net_entry_text).toMatch(/^\$0\.00 (debit|credit)$/);
    expect(groups[0].net_entry_text).not.toBe(view.net_entry_text);
  });
});

describe('no group field can name a shape', () => {
  it('the BrokerGroup struct never carries structure/max_loss/qty/eval_subject/pl_pct', () => {
    const { groups } = groupsOf(BOOK_CAPTURED_COMPLETE);
    const keys = Object.keys(groups[0]);
    for (const banned of [
      'structure',
      'structure_label',
      'structure_line',
      'max_loss',
      'qty',
      'eval_subject',
      'pl_pct',
    ]) {
      expect(keys).not.toContain(banned);
    }
  });
});
