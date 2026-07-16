/**
 * outcome-ledger — the READ's invariants. These are the negative space that makes the feature safe:
 * every case here is one where a silent regression is plausible AND invisible to review (per the
 * risk-based rule, `.claude/agents/qa-verify.md` §4). Copy wording / presence / ordering are
 * verified by review, and are deliberately NOT asserted here.
 *
 * The boundary these specs control is **localStorage** — this feature consumes no endpoint, so
 * there is no API client to mock and none is invented.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetMemory as resetGhost } from '@/features/trading/model/store';
import { __resetOrdersMemory } from '@/features/trading/orders/store';
import { __resetMemory as resetPositions } from '@/features/trading/positions/store';
import { closedOutcome, decision, digest, ghostTrade, order, outcomes, position, seedStores } from './fixtures';
import { computeLedgerRead, wilsonInterval } from './ledger';
import { EXCLUSION_PRECEDENCE, N_MIN } from './types';

const reset = () => {
  localStorage.clear();
  resetGhost();
  resetPositions();
  __resetOrdersMemory();
};

const familyOf = (read: ReturnType<typeof computeLedgerRead>, key: string) =>
  read.families.find((f) => f.key === key)!;

/** The balance identity, asserted as a CI check — NEVER a runtime throw. */
const expectBalances = (read: ReturnType<typeof computeLedgerRead>) => {
  const { counted, recorded_closed, excluded_by_reason } = read.coverage;
  const excluded = EXCLUSION_PRECEDENCE.reduce((s, r) => s + excluded_by_reason[r], 0);
  expect(counted + excluded).toBe(recorded_closed);
  for (const f of read.families) {
    const c = f.coverage;
    expect(
      c.attributed + c.unavailable_at_capture + c.pre_capture + (c.not_attributable_by_path ?? 0),
    ).toBe(c.counted_total);
  }
};

beforeEach(reset);

describe('the counted read (AC-7/8/9/11)', () => {
  it('emits the rate ONLY as a non-optional sibling of its n, interval, window, mean and dispersion — the type offers no bare rate', () => {
    const { positions, decisions } = outcomes(N_MIN, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions });
    const cohort = familyOf(computeLedgerRead(), 'tier').cells[0].cohort;
    expect(cohort.state).toBe('computed');
    if (cohort.state !== 'computed') return;
    // AC-8 + AC-9: every one of these is present on the SAME value as the rate. There is no shape
    // in which `hit_rate` exists without them.
    expect(cohort.hit_rate).toBe(60);
    expect(cohort.n).toBe(N_MIN);
    expect(cohort.interval.lo).toBeGreaterThan(0);
    expect(cohort.interval.hi).toBeGreaterThan(cohort.interval.lo);
    expect(cohort.window.first).toBeTruthy();
    expect(cohort.window.last).toBeTruthy();
    expect(cohort.basis_class).toBe('quoted');
    expect(typeof cohort.mean_pl_pct).toBe('number');
    expect(typeof cohort.stdev_pl_pct).toBe('number');
  });

  it('the Wilson interval stays inside [0,100] at the extremes, where the normal approximation would not', () => {
    expect(wilsonInterval(20, 20).hi).toBeLessThanOrEqual(100);
    expect(wilsonInterval(0, 20).lo).toBeGreaterThanOrEqual(0);
    const i = wilsonInterval(12, 20);
    expect(i.lo).toBeLessThan(60);
    expect(i.hi).toBeGreaterThan(60);
  });
});

describe('the floor (AC-E2, AC-E3)', () => {
  it('1–19 counted ⇒ `building` with a count, and the type carries NO rate to render', () => {
    const { positions, decisions } = outcomes(19);
    seedStores({ positions, positionDecisions: decisions });
    const cohort = familyOf(computeLedgerRead(), 'tier').cells[0].cohort;
    expect(cohort).toEqual({ state: 'building', n: 19, n_min: 20 });
    expect(cohort).not.toHaveProperty('hit_rate');
    expect(cohort).not.toHaveProperty('interval');
    expect(cohort).not.toHaveProperty('mean_pl_pct');
  });

  it('AC-E3 — the 3-for-3 trap: three counted outcomes, ALL winners, is `building` and carries no 100% anywhere', () => {
    const { positions, decisions } = outcomes(3, { winners: 3 });
    seedStores({ positions, positionDecisions: decisions });
    const read = computeLedgerRead();
    const cohort = familyOf(read, 'tier').cells[0].cohort;
    expect(cohort).toEqual({ state: 'building', n: 3, n_min: 20 });
    // There is no field on the value a "100%" could be read out of.
    expect(JSON.stringify(cohort)).not.toContain('100');
    expect(read.families.flatMap((f) => f.cells).every((c) => c.cohort.state === 'building')).toBe(
      true,
    );
  });
});

describe('the exclusion precedence + the balance identity (§3.4.3)', () => {
  it('AC-E10 — a closed position with NO decision record (the dev seed shape: a fabricated 196/48.4% winner written straight to the store) is excluded, and reaches no rate', () => {
    // Exactly what `positions/testSeed.ts` writes: `putPosition` with no `appendDecision`.
    seedStores({
      positions: [position({ id: 'seeded', realized_pl_dollar: 196, realized_pl_pct: 48.4 })],
    });
    const read = computeLedgerRead();
    expect(read.coverage.excluded_by_reason.no_decision_record).toBe(1);
    expect(read.coverage.counted).toBe(0);
    expect(read.coverage.recorded_closed).toBe(1); // counted for COVERAGE — not admitted to a cohort
    expect(read.families.flatMap((f) => f.cells)).toHaveLength(0);
    // The roll-up carries INTEGERS ONLY: the fabricated 196 is structurally unreachable from it.
    expect(JSON.stringify(read.coverage)).not.toContain('196');
    expect(JSON.stringify(read.coverage)).not.toContain('48.4');
    expectBalances(read);
  });

  it('AC-E7 — a typed / theoretical / last-known / manual leg is excluded under `unpriced_basis` and reaches no rate', () => {
    const cases = [
      ['user_entered', 'snapshot'],
      ['theoretical', 'snapshot'],
      ['snapshot', 'last_known'],
      ['snapshot', 'manual'],
    ] as const;
    cases.forEach(([entryBasis, exitBasis], i) => {
      reset();
      const o = closedOutcome(`p-${i}`, { entryBasis, exitBasis });
      seedStores({ positions: [o.position], positionDecisions: o.decisions });
      const read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.unpriced_basis).toBe(1);
      expect(read.coverage.counted).toBe(0);
      expectBalances(read);
    });
  });

  it('AC-E8 — a `modeled` leg is excluded under its OWN distinct reason, and no `modeled` cohort exists anywhere', () => {
    const o = closedOutcome('p-1', { exitBasis: 'modeled' });
    seedStores({ positions: [o.position], positionDecisions: o.decisions });
    const read = computeLedgerRead();
    expect(read.coverage.excluded_by_reason.modeled_basis).toBe(1);
    expect(read.coverage.excluded_by_reason.unpriced_basis).toBe(0);
    expect(read.families.flatMap((f) => f.cells.map((c) => c.key))).not.toContain('modeled');
    expectBalances(read);
  });

  it('AC-E9 — a scripted scenario outcome is excluded, and BEFORE the basis reasons (a harness must not hide in a pricing bucket)', () => {
    const o = closedOutcome('p-1', { originOrderId: 'o-9', exitBasis: 'modeled' });
    seedStores({
      positions: [o.position],
      positionDecisions: o.decisions,
      orders: [order({ id: 'o-9', provenance: { source: 'ai_scenario', scenario_id: 's1' } })],
    });
    const read = computeLedgerRead();
    expect(read.coverage.excluded_by_reason.scenario_sourced).toBe(1);
    expect(read.coverage.excluded_by_reason.modeled_basis).toBe(0);
    expectBalances(read);
  });

  it('AC-E6 — one malformed record does not cost the other 99: the rest are still counted, and it is reported', () => {
    const { positions, decisions } = outcomes(99, { winners: 60 });
    const broken = closedOutcome('broken', {});
    delete (broken.position as { realized_pl_pct?: number }).realized_pl_pct;
    seedStores({
      positions: [...positions, broken.position],
      positionDecisions: [...decisions, ...broken.decisions],
    });
    const read = computeLedgerRead();
    expect(read.coverage.counted).toBe(99);
    expect(read.coverage.excluded_by_reason.malformed).toBe(1);
    expect(read.coverage.recorded_closed).toBe(100);
    expectBalances(read);
  });

  it('an UNREADABLE record sits OUTSIDE the balance (its closed-ness is unknowable) while the rest still count', () => {
    const { positions, decisions } = outcomes(2);
    seedStores({
      rawPositions: JSON.stringify({
        schema_version: 2,
        positions: { ...Object.fromEntries(positions.map((p) => [p.id, p])), junk: 42 },
        decisions,
      }),
    });
    const read = computeLedgerRead();
    expect(read.coverage.counted).toBe(2);
    expect(read.coverage.adjacent.unreadable_records).toBe(1);
    expect(read.coverage.recorded_closed).toBe(2); // NOT 3 — an unreadable record is not in M
    expectBalances(read);
  });

  it('AC-E11 / AC-E12 — an OPEN position and a never-filled order are reported BESIDE M, never inside it, and move no rate', () => {
    const o = closedOutcome('p-1', {});
    seedStores({
      positions: [o.position, position({ id: 'p-open', status: 'open', realized_pl_pct: 999 })],
      positionDecisions: o.decisions,
      orders: [
        order({ id: 'o-1', status: 'cancelled' }),
        order({ id: 'o-2', status: 'expired' }),
        order({ id: 'o-3', status: 'waiting' }),
      ],
    });
    const read = computeLedgerRead();
    expect(read.coverage.recorded_closed).toBe(1); // the open position is NOT in the denominator
    expect(read.coverage.adjacent.open_not_counted).toBe(1);
    expect(read.coverage.adjacent.never_filled).toBe(3);
    // The open position's 999% unrealized mark reaches no cohort.
    expect(familyOf(read, 'tier').cells[0].cohort).toEqual({ state: 'building', n: 1, n_min: 20 });
    expectBalances(read);
  });
});

describe('⚠ the denominator M spans BOTH position sources (§2/Q3.1 consequence 6)', () => {
  it('a closed position that exists ONLY in the v1 `trades` map appears in BOTH counted and M — a numerator can never exceed its denominator', () => {
    // The Ticker's `useGhostTrade` is LIVE and still writes v1, and the v1→v2 migration runs only
    // once (when no v2 blob exists). So v1-only positions are permanent. An M read from v2 alone,
    // paired with a numerator from the unioned index, would report counted 1 of 0 — a coverage
    // statement that lies, in the direction of flattering the feature.
    const v1 = closedOutcome('g-only', {});
    seedStores({
      ghostTrades: [ghostTrade({ ...v1.position, ticker: 'NVDA' } as never)],
      ghostDecisions: v1.decisions,
      positions: [],
      positionDecisions: [],
    });
    const read = computeLedgerRead();
    expect(read.coverage.counted).toBe(1);
    expect(read.coverage.recorded_closed).toBe(1);
    expect(read.coverage.counted).toBeLessThanOrEqual(read.coverage.recorded_closed);
    expectBalances(read);
  });

  it('a record copied into BOTH blobs by the v1→v2 migration is de-duped — the union never double-counts', () => {
    const o = closedOutcome('p-dup', {});
    seedStores({
      ghostTrades: [o.position as never],
      ghostDecisions: o.decisions,
      positions: [o.position],
      positionDecisions: o.decisions, // the same records, in both logs
    });
    const read = computeLedgerRead();
    expect(read.coverage.recorded_closed).toBe(1);
    expect(read.coverage.counted).toBe(1);
    expectBalances(read);
  });
});

describe('per-family coverage (§3.4.4)', () => {
  it('AC-E13 — a pre-capture outcome COUNTS in its tier cell and is reported as pre-capture by the other families; tier`s pre_capture is 0 FROM THE DATA', () => {
    const o = closedOutcome('p-1', { entryDigest: null, tier: 'prime' }); // no digest ⇒ pre-capture
    seedStores({ positions: [o.position], positionDecisions: o.decisions });
    const read = computeLedgerRead();
    const tier = familyOf(read, 'tier');
    // Tier is top-level on the record, so it is present pre-capture — the 0 falls out of the data
    // through the SAME generic builder, not out of a tier-specific branch.
    expect(tier.coverage.pre_capture).toBe(0);
    expect(tier.coverage.attributed).toBe(1);
    expect(tier.cells[0].key).toBe('prime');
    for (const key of ['setup', 'iv_band', 'persona'] as const) {
      expect(familyOf(read, key).coverage.pre_capture).toBe(1);
      expect(familyOf(read, key).coverage.attributed).toBe(0);
      expect(familyOf(read, key).cells).toHaveLength(0); // "unknown" is NEVER a cell with a rate
    }
    expectBalances(read);
  });

  it('AC-E14 — captured-but-unavailable is a DIFFERENT count from pre-capture (a wiring gap must not masquerade as an absence)', () => {
    const pre = closedOutcome('p-pre', { entryDigest: null });
    const unavailable = closedOutcome('p-unavail', {
      entryDigest: digest({ persona_id: null, setups: null, iv_rank_band: null }),
    });
    seedStores({
      positions: [pre.position, unavailable.position],
      positionDecisions: [...pre.decisions, ...unavailable.decisions],
    });
    const persona = familyOf(computeLedgerRead(), 'persona').coverage;
    expect(persona.pre_capture).toBe(1);
    expect(persona.unavailable_at_capture).toBe(1);
    expect(persona.counted_total).toBe(2);
    expectBalances(computeLedgerRead());
  });

  it('⚠ `attributed` comes from the OUTCOME population, never from summing cell Ns: ONE outcome firing THREE setups is attributed 1, in 3 cells', () => {
    const o = closedOutcome('p-1', {
      entryDigest: digest({
        setups: [
          { name: 'pin_confluence', conviction: 'high' },
          { name: 'gamma_squeeze', conviction: 'medium' },
          { name: 'wall_rejection', conviction: 'low' },
        ],
      }),
    });
    seedStores({ positions: [o.position], positionDecisions: o.decisions });
    const setup = familyOf(computeLedgerRead(), 'setup');
    expect(setup.cells).toHaveLength(3); // the family FANS OUT
    expect(setup.coverage.attributed).toBe(1); // ...but the outcome is ONE outcome. Not 3.
    expect(setup.cells.reduce((s, c) => s + (c.cohort as { n: number }).n, 0)).toBe(3);
    expectBalances(computeLedgerRead());
  });

  it('AC-E18 — `not_attributable_by_path` is derived from the data, in BOTH directions', () => {
    // The app threads the rec identity on every entry path it writes today, so the digest always
    // carries the KEY (null ⇒ "no rec was involved") and the count is 0.
    const threaded = closedOutcome('p-1', { entryDigest: digest({ ai_rec_fingerprint: null }) });
    seedStores({ positions: [threaded.position], positionDecisions: threaded.decisions });
    let aiRec = familyOf(computeLedgerRead(), 'ai_rec').coverage;
    expect(aiRec.not_attributable_by_path).toBe(0);
    expect(aiRec.unavailable_at_capture).toBe(1); // "had none available at entry" — the honest read

    // A record imported from a browser whose capture predates the threading: the digest exists but
    // the key is ABSENT — the rec MAY have been there; the plumbing could not carry it.
    reset();
    const noKey = digest();
    delete (noKey as { ai_rec_fingerprint?: string | null }).ai_rec_fingerprint;
    const stranded = closedOutcome('p-2', { entryDigest: noKey });
    seedStores({ positions: [stranded.position], positionDecisions: stranded.decisions });
    aiRec = familyOf(computeLedgerRead(), 'ai_rec').coverage;
    expect(aiRec.not_attributable_by_path).toBe(1);
    expect(aiRec.unavailable_at_capture).toBe(0); // NOT collapsed into "none available at entry"
    expectBalances(computeLedgerRead());
  });

  it('an outcome entered from an AI rec is attributed to the single AI-rec cell', () => {
    const o = closedOutcome('p-1', { entryDigest: digest({ ai_rec_fingerprint: 'fp-rec-1' }) });
    seedStores({ positions: [o.position], positionDecisions: o.decisions });
    const aiRec = familyOf(computeLedgerRead(), 'ai_rec');
    expect(aiRec.coverage.attributed).toBe(1);
    expect(aiRec.cells).toHaveLength(1); // ONE cell — never fanned out per fingerprint
    // ⚠ and NO "not from a rec" comparison cell: unknown is never a cohort.
    expect(aiRec.cells[0].key).toBe('taken_from_ai_rec');
  });
});

describe('the join (§3.5)', () => {
  it('⚠ the digest is read from the SAME entry record the join fixed — never borrowed from another record with the same trade_id', () => {
    // An `accept` record for the same trade carries a digest the `open` record lacks. Reading across
    // would fabricate context the entry did not observe and under-count pre-capture.
    const entry = decision({ trade_id: 'p-1', event_type: 'open', clock_time: '2026-03-04T14:00:00.000Z' }); // NO digest
    const accepted = decision({
      trade_id: 'p-1',
      event_type: 'accept',
      clock_time: '2026-03-04T15:00:00.000Z',
      entry_context: digest({ persona_id: 'borrowed', setups: [{ name: 'gamma_squeeze', conviction: 'high' }] }),
    });
    const exit = decision({ trade_id: 'p-1', event_type: 'close', clock_time: '2026-03-05T14:00:00.000Z' });
    seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry, accepted, exit] });
    const read = computeLedgerRead();
    expect(read.coverage.counted).toBe(1);
    expect(familyOf(read, 'persona').coverage.pre_capture).toBe(1); // the ENTRY predates capture
    expect(familyOf(read, 'persona').coverage.attributed).toBe(0);
    expect(familyOf(read, 'persona').cells).toHaveLength(0); // "borrowed" never becomes a cell
  });

  it('an unresolvable join is excluded with its own reason — never guessed, never defaulted', () => {
    const entry = decision({ trade_id: 'p-1', event_type: 'open' });
    seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry] }); // no close record
    const read = computeLedgerRead();
    expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
    expectBalances(read);
  });

  it('hit is `realized_pl_dollar > 0` STRICTLY: a zero result is not a hit and stays in the denominator', () => {
    const { positions, decisions } = outcomes(N_MIN, { winners: 10 });
    // Make one loser an exact scratch: it must not become a hit, and must not leave the denominator.
    positions[19] = { ...positions[19], realized_pl_dollar: 0, realized_pl_pct: 0 };
    seedStores({ positions, positionDecisions: decisions });
    const cohort = familyOf(computeLedgerRead(), 'tier').cells[0].cohort;
    expect(cohort.state).toBe('computed');
    if (cohort.state !== 'computed') return;
    expect(cohort.n).toBe(20);
    expect(cohort.hit_rate).toBe(50); // 10/20 — the scratch is in the denominator, not the numerator
  });
});

describe('the read`s basis (§3.4.6)', () => {
  it('⚠ AC-19 — the capture epoch is DERIVED FROM THE DATA: an older digest-carrying record yields the OLDER date (a hardcoded ship date is invisible to review)', () => {
    const recent = closedOutcome('p-recent', { entryClock: '2026-07-01T10:00:00.000Z' });
    // An archive import can carry records from ANOTHER browser whose capture began earlier.
    const imported = closedOutcome('p-imported', { entryClock: '2025-11-02T09:30:00.000Z' });
    seedStores({
      positions: [recent.position, imported.position],
      positionDecisions: [...recent.decisions, ...imported.decisions],
    });
    expect(computeLedgerRead().basis.capture_epoch).toBe('2025-11-02T09:30:00.000Z');
  });

  it('no record carries a digest ⇒ the epoch is null (day one), never a fabricated date', () => {
    const o = closedOutcome('p-1', { entryDigest: null });
    seedStores({ positions: [o.position], positionDecisions: o.decisions });
    expect(computeLedgerRead().basis.capture_epoch).toBeNull();
  });

  it('AC-E5 — a corrupt blob ⇒ `sources_complete: false`, no throw, and the stored blob is NOT destroyed or rewritten', () => {
    const raw = '{ this is not json';
    seedStores({ rawPositions: raw });
    const read = computeLedgerRead(); // must not throw
    expect(read.basis.sources_complete).toBe(false);
    expect(read.coverage.counted).toBe(0);
    // `[loss-free-durable-migration]`: the unreadable blob survives the read byte-for-byte.
    expect(localStorage.getItem('convexa.positions.v2')).toBe(raw);
  });

  it('⚠ a PARTIAL read never presents its smaller M as the whole population', () => {
    const o = closedOutcome('p-1', {});
    // The ghost store is unreadable; the positions store reads fine. M is therefore understated.
    seedStores({ rawGhost: '{{{', positions: [o.position], positionDecisions: o.decisions });
    const read = computeLedgerRead();
    expect(read.basis.sources_complete).toBe(false);
    expect(read.coverage.counted).toBe(1); // counted cells STILL render — partial means content
    expectBalances(read);
  });

  it('every source reads ⇒ sources_complete, and the basis states the sources spanned + the de-dupe identity', () => {
    seedStores({});
    const basis = computeLedgerRead().basis;
    expect(basis.sources_complete).toBe(true);
    expect(basis.sources).toEqual([
      'convexa.ghost-trade.v1',
      'convexa.positions.v2',
      'convexa.orders.v1',
    ]);
    expect(basis.identity_rule).toContain('trade_id');
  });

  it('an absent store is a COMPLETE read of nothing — not a partial one (empty ≠ unreadable)', () => {
    localStorage.clear();
    const read = computeLedgerRead();
    expect(read.basis.sources_complete).toBe(true);
    expect(read.coverage.recorded_closed).toBe(0);
  });
});

describe('§8 non-goal 15 — the roll-up is not a back door into the cells', () => {
  it('the read exposes no include/exclude toggle, override, filter or per-record excluded payload', () => {
    const o = closedOutcome('p-1', { exitBasis: 'modeled' });
    seedStores({ positions: [o.position], positionDecisions: o.decisions });
    const read = computeLedgerRead();
    const serialized = JSON.stringify(read);
    // Integers and reasons, full stop: no ids, no P&L, no record list from the excluded population.
    expect(serialized).not.toContain('p-1');
    expect(read.coverage.excluded_by_reason.modeled_basis).toBe(1);
    for (const key of Object.keys(read.coverage.excluded_by_reason)) {
      expect(typeof read.coverage.excluded_by_reason[key as keyof typeof read.coverage.excluded_by_reason]).toBe('number');
    }
    // `computeLedgerRead` takes ONE option — a label injector. No filter, no include-list.
    expect(computeLedgerRead.length).toBeLessThanOrEqual(2);
  });
});
