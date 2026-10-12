/**
 * Unit — the `PositionView` projection. Risk-based (SPEC §7): the invariants, not the wording.
 * Structure-label strings are review-class; what is automated here is all-or-nothing propagation
 * across pl/pl_pct/mark, the LIVE-vs-STATIC split (a static field must be byte-identical offline),
 * the authored-in-the-string collapse, the never-render-undefined rule, and purity.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { describe, expect, it } from 'vitest';
import {
  FX_CALENDAR,
  FX_CALL_DEBIT_SPREAD,
  FX_COVERED_CALL,
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_RATIO_1X2,
  FX_SHARES_LONG,
  FX_SHORT_CALL,
  FX_SHORT_VERTICAL,
  mkLeg,
  mkPosition,
} from './fixtures';
import { STRUCTURE_LABELS } from './structure';
import { buildPositionView, STRUCTURE_LINE_MAX_STRIKES } from './view';

/** U+2026 — the authored ellipsis. Never three periods. */
const ELLIPSIS = '…';

const mr = (
  mark: number | null,
  basis: MarkResult['basis'] = 'snapshot',
  frozen = false,
): MarkResult => ({ mark, basis, frozen });
const allMarks = (
  p: Parameters<typeof buildPositionView>[0]['position'],
  v: number,
  basis: MarkResult['basis'] = 'snapshot',
) => new Map(p.legs.map((l) => [l.id, mr(v, basis)]));

describe('buildPositionView', () => {
  it('AC-22 — carries ONE net entry figure with a debit/credit basis derived from the SIGN', () => {
    const debit = buildPositionView({
      position: FX_LONG_CALL,
      legMarks: allMarks(FX_LONG_CALL, 14),
      dte: 30,
    });
    expect(debit.net_entry_basis).toBe('net_debit');
    expect(debit.net_entry_cost).toBeGreaterThan(0);

    const credit = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: allMarks(FX_SHORT_VERTICAL, 5),
      dte: 30,
    });
    expect(credit.net_entry_basis).toBe('net_credit');
  });

  it('AC-39 — one unresolved leg withholds pl, pl_pct AND mark together', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs;
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map([
        [a.id, mr(5)],
        [b.id, null],
      ]),
      dte: 30,
    });
    expect(v.mark.net_mark).toBeNull();
    expect(v.pl_dollar).toBeNull();
    expect(v.pl_pct).toEqual({ kind: 'unavailable' });
    expect(v.unavailable).toBe(true);
  });

  /**
   * RULED 2026-07-28 (GATE Z bounce #2, SPEC §4 *The `contract` cell*) — the CELL form drops the
   * structure WORD for a multi-leg position because the `Structure` chip already carries it (a
   * silent regression would quietly re-spend the 1280 headroom the bounce was raised over), and
   * AC-37 collapses a strike list longer than `STRUCTURE_LINE_MAX_STRIKES` IN THE STRING,
   * first-and-last with the leg count. Single-leg, covered-call and shares-only cells are
   * BYTE-IDENTICAL to the shipped descriptor. The full line keeps the noun and every strike: it is
   * the tooltip.
   */
  it('the structure line, its collapsed cell form and its full tooltip form, per structure', () => {
    expect(STRUCTURE_LINE_MAX_STRIKES).toBe(3);
    const rows: ReadonlyArray<{
      position: Parameters<typeof buildPositionView>[0]['position'];
      full: string;
      collapsed: string;
      noun: string | null;
    }> = [
      // single leg — the shipped descriptor; there was never a noun to drop
      { position: FX_LONG_CALL, full: '$400 Call', collapsed: '$400 Call', noun: null },
      // vertical — 2 strikes, under the boundary: no collapse, only the noun goes
      {
        position: FX_CALL_DEBIT_SPREAD,
        full: '$400/$420 Call vertical',
        collapsed: '$400/$420 Call',
        noun: 'vertical',
      },
      // condor — 4 strikes, over the boundary: first…last with the leg count, no noun, no right
      {
        position: FX_IRON_CONDOR,
        full: '$380/$400/$440/$460 condor',
        collapsed: `$380${ELLIPSIS}$460 (4 legs)`,
        noun: 'condor',
      },
      // covered call — shares-plus-the-option, not a strike list
      {
        position: FX_COVERED_CALL,
        full: '100 sh + $420 Call',
        collapsed: '100 sh + $420 Call',
        noun: null,
      },
      // shares only — reads in shares
      { position: FX_SHARES_LONG, full: '100 shares', collapsed: '100 shares', noun: null },
      // custom (unrecognised shape) — a plain leg count, no diagnosis, no warning register
      { position: FX_RATIO_1X2, full: '2 legs', collapsed: '2 legs', noun: null },
      // calendar — the two EXPIRIES are facts and stay; only the noun goes
      {
        position: FX_CALENDAR,
        full: '$400 Call calendar · Aug 21 → Sep 18',
        collapsed: '$400 Call · Aug 21 → Sep 18',
        noun: 'calendar',
      },
    ];
    for (const { position, full, collapsed, noun } of rows) {
      const v = buildPositionView({ position, legMarks: new Map(), dte: null });
      expect(v.structure_line).toBe(full);
      expect(v.structure_line_full).toBe(full);
      expect(v.structure_line_collapsed).toBe(collapsed);
      expect(v.structure_line_collapsed).not.toContain('...');
      // the noun is not LOST — it is on the chip (`structure_label`) and in the tooltip
      expect(v.structure_label).toBe(STRUCTURE_LABELS[v.structure]);
      if (noun) {
        expect(v.structure_line_collapsed).not.toMatch(new RegExp(noun, 'i'));
        expect(v.structure_line_full).toContain(noun);
      }
    }
  });

  it('a multi-expiry structure carries its expiries in the line and reports the NEAREST separately', () => {
    const v = buildPositionView({
      position: FX_CALENDAR,
      legMarks: allMarks(FX_CALENDAR, 13),
      dte: 30,
    });
    expect(v.multi_expiration).toBe(true);
    expect(v.nearest_expiration).toBe('2026-08-21');
    expect(v.structure_line).toContain('→');
  });

  it('a single-expiry structure is not flagged multi_expiration and still reports its expiry', () => {
    const v = buildPositionView({
      position: FX_IRON_CONDOR,
      legMarks: allMarks(FX_IRON_CONDOR, 3),
      dte: 30,
    });
    expect(v.multi_expiration).toBe(false);
    expect(v.nearest_expiration).toBe('2026-08-21');
    expect(v.structure_line).not.toContain('→');
  });

  it('AC-33 — a shares position exposes null option facts so the cell can render `—`, never a fake value', () => {
    const v = buildPositionView({ position: FX_SHARES_LONG, legMarks: new Map(), dte: null });
    expect(v.structure).toBe('shares_long');
    expect(v.legs[0].instrument_kind).toBe('equity');
    expect(v.legs[0].size_text).toBe('100 sh');
    expect(v.multi_expiration).toBe(false);
    expect(v.nearest_expiration).toBeNull();
    expect(v.qty_text).toBe('100 sh');
  });

  it('qty_text is unit-aware: contracts for options, shares for equity, structure-level when mixed', () => {
    expect(
      buildPositionView({ position: FX_LONG_CALL, legMarks: new Map(), dte: null }).qty_text,
    ).toBe('1 ×');
    expect(
      buildPositionView({ position: FX_COVERED_CALL, legMarks: new Map(), dte: null }).qty_text,
    ).toBe('1 ×');
  });

  it('leg rows carry the side as a WORD and each leg`s own mark + basis', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs;
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map([
        [a.id, mr(11, 'snapshot')],
        [b.id, mr(5, 'theoretical')],
      ]),
      dte: 30,
    });
    expect(v.legs.map((l) => l.side_word)).toEqual(['Short', 'Long']);
    expect(v.legs[1].basis).toBe('theoretical');
    expect(v.legs.map((l) => l.side_word)).not.toContain('+');
    expect(v.legs.map((l) => l.side_word)).not.toContain('−');
  });

  it('an unresolved leg row is flagged individually while resolved rows keep their marks', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs;
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map([
        [a.id, mr(11)],
        [b.id, null],
      ]),
      dte: 30,
    });
    expect(v.legs[0].unavailable).toBe(false);
    expect(v.legs[0].mark).toBe(11);
    expect(v.legs[1].unavailable).toBe(true);
    expect(v.legs[1].mark).toBeNull();
    expect(v.legs[1].basis).toBeNull();
  });

  it('AC-32 — a record that can never be priced is flagged `unpriceable`, separately from `unavailable`', () => {
    const broken = mkPosition([mkLeg({ strike: null, right: null })]);
    const v = buildPositionView({ position: broken, legMarks: new Map(), dte: null });
    expect(v.unpriceable).toBe(true);
    expect(v.unavailable).toBe(true);
    expect(v.structure).toBe('custom');
  });

  it('AC-32 — a well-formed position that merely failed THIS cycle is unavailable but NOT unpriceable', () => {
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map(),
      dte: 30,
    });
    expect(v.unavailable).toBe(true);
    expect(v.unpriceable).toBe(false);
  });

  it('NEVER emits undefined, null or NaN where a rendered string is expected', () => {
    const broken = mkPosition([mkLeg({ strike: null, right: null, expiration: null })]);
    for (const p of [FX_IRON_CONDOR, FX_SHARES_LONG, FX_RATIO_1X2, broken]) {
      const v = buildPositionView({ position: p, legMarks: new Map(), dte: null });
      const strings = [
        v.structure_label,
        v.structure_line,
        v.structure_line_collapsed,
        v.structure_line_full,
        v.qty_text,
        ...v.legs.flatMap((l) => [l.side_word, l.size_text, l.instrument_text]),
      ];
      for (const s of strings) {
        expect(typeof s).toBe('string');
        expect(s).not.toMatch(/undefined|null|NaN/);
      }
    }
  });

  it('is a PURE projection — building it twice from the same inputs yields deep-equal output', () => {
    const a = buildPositionView({
      position: FX_IRON_CONDOR,
      legMarks: allMarks(FX_IRON_CONDOR, 3),
      dte: 30,
    });
    const b = buildPositionView({
      position: FX_IRON_CONDOR,
      legMarks: allMarks(FX_IRON_CONDOR, 3),
      dte: 30,
    });
    expect(a).toEqual(b);
  });

  it('never mutates the position it projects', () => {
    const before = JSON.stringify(FX_IRON_CONDOR);
    buildPositionView({
      position: FX_IRON_CONDOR,
      legMarks: allMarks(FX_IRON_CONDOR, 3),
      dte: 30,
    });
    expect(JSON.stringify(FX_IRON_CONDOR)).toBe(before);
  });
});

describe('live-vs-static isolation, at the projection', () => {
  it('an SSE drop (every leg last_known) changes ONLY the live fields — every static field is identical', () => {
    const live = buildPositionView({
      position: FX_IRON_CONDOR,
      legMarks: allMarks(FX_IRON_CONDOR, 3, 'snapshot'),
      dte: 30,
    });
    const offline = buildPositionView({
      position: FX_IRON_CONDOR,
      legMarks: allMarks(FX_IRON_CONDOR, 3, 'last_known'),
      dte: 30,
    });
    // STATIC — must be byte-identical: structure line, qty, net entry, max loss, expiry.
    expect(offline.structure).toBe(live.structure);
    expect(offline.structure_line).toBe(live.structure_line);
    expect(offline.structure_line_collapsed).toBe(live.structure_line_collapsed);
    expect(offline.qty_text).toBe(live.qty_text);
    expect(offline.net_entry_cost).toBe(live.net_entry_cost);
    expect(offline.net_entry_basis).toBe(live.net_entry_basis);
    expect(offline.max_loss).toEqual(live.max_loss);
    expect(offline.nearest_expiration).toBe(live.nearest_expiration);
    // LIVE — and it degrades to a weak basis, NOT to a blank: the number still exists.
    expect(offline.mark.basis).toBe('last_known');
    expect(offline.mark.net_mark).toBe(live.mark.net_mark);
    expect(offline.unavailable).toBe(false);
    expect(offline.pl_dollar).toBe(live.pl_dollar);
  });

  it('a withheld max-loss reason survives an SSE drop unchanged — the risk slot is not live-derived', () => {
    const live = buildPositionView({
      position: FX_SHORT_CALL,
      legMarks: allMarks(FX_SHORT_CALL, 4, 'snapshot'),
      dte: 30,
    });
    const dead = buildPositionView({ position: FX_SHORT_CALL, legMarks: new Map(), dte: 30 });
    expect(live.max_loss).toEqual({ kind: 'withheld', reason: 'unbounded' });
    expect(dead.max_loss).toEqual(live.max_loss);
  });
});

describe('pl_pct branch selection, through the projection', () => {
  it('a pending limit is not_applicable — never unavailable and never no_basis', () => {
    const pending = mkPosition([mkLeg({ entry_price: 8.4 })], {
      status: 'pending',
      limit_price: 840,
    });
    const v = buildPositionView({ position: pending, legMarks: new Map(), dte: 30 });
    expect(v.pl_pct).toEqual({ kind: 'not_applicable' });
  });

  it('AC-26 — a winning credit structure reports a POSITIVE percentage on a net_credit basis', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs; // short 400 @12.40, long 420 @6.10 ⇒ net credit
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map([
        [a.id, mr(10)],
        [b.id, mr(5)],
      ]),
      dte: 30,
    });
    expect(v.pl_dollar).toBeGreaterThan(0);
    expect(v.pl_pct.kind).toBe('value');
    if (v.pl_pct.kind === 'value') {
      expect(v.pl_pct.value).toBeGreaterThan(0);
      expect(v.pl_pct.basis).toBe('net_credit');
    }
  });
});
