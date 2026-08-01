/**
 * outcome-ledger — the READ's invariants. These are the negative space that makes the feature safe:
 * every case here is one where a silent regression is plausible AND invisible to review (per the
 * risk-based rule, `.claude/agents/qa-verify.md` §4). Copy wording / presence / ordering are
 * verified by review, and are deliberately NOT asserted here.
 *
 * The boundary these specs control is **localStorage** — this feature consumes no endpoint, so
 * there is no API client to mock and none is invented.
 */
import { __resetMemory as resetGhost } from '@/features/trading/model/store';
import { __resetOrdersMemory } from '@/features/trading/orders/store';
import { __resetMemory as resetPositions } from '@/features/trading/positions/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  closedOutcome,
  decision,
  digest,
  ghostTrade,
  order,
  outcomes,
  position,
  seedStores,
} from './fixtures';
import { computeLedgerRead, isCloseBearing, wilsonInterval } from './ledger';
import { EXCLUSION_PRECEDENCE, N_MIN } from './types';

const reset = () => {
  localStorage.clear();
  resetGhost();
  resetPositions();
  __resetOrdersMemory();
};

const familyOf = (read: ReturnType<typeof computeLedgerRead>, key: string) => {
  const family = read.families.find((f) => f.key === key);
  if (!family) throw new Error(`ledger read carries no family "${key}"`);
  return family;
};

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
    const entry = decision({
      trade_id: 'p-1',
      event_type: 'open',
      clock_time: '2026-03-04T14:00:00.000Z',
    }); // NO digest
    const accepted = decision({
      trade_id: 'p-1',
      event_type: 'accept',
      clock_time: '2026-03-04T15:00:00.000Z',
      entry_context: digest({
        persona_id: 'borrowed',
        setups: [{ name: 'gamma_squeeze', conviction: 'high' }],
      }),
    });
    const exit = decision({
      trade_id: 'p-1',
      event_type: 'close',
      clock_time: '2026-03-05T14:00:00.000Z',
    });
    seedStores({
      positions: [position({ id: 'p-1' })],
      positionDecisions: [entry, accepted, exit],
    });
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
});

/**
 * ⚠⚠ THE CLOSE-BEARING PREDICATE (§2/Q3.5). `close` is NOT the only close-bearing event — but the
 * naive widen (`close | accept | roll`) is WORSE than the under-count it fixes, and the "symmetric"
 * refinement (`accept` with `ai_verdict ∈ {Exit, Roll}`) is verifiably wrong. Each case below is a
 * verified code path.
 *
 * ⚠ The root cause of the original defect is visible in the shape of this file's history:
 * `unresolved_join` had NO dedicated behavioural case — only a label-exists check. A reason with a
 * label and no behavioural case is exactly how a wrong join ships GREEN. These cases close that hole.
 */
describe('⚠ the close-bearing predicate + the exit-basis join (§2/Q3.5)', () => {
  describe('the predicate, on a single record — the rule, assertable without building a read', () => {
    it('close | roll | (accept AND ai_verdict === "Exit") are close-bearing; EVERYTHING else is not', () => {
      expect(isCloseBearing(decision({ event_type: 'close' }))).toBe(true);
      expect(isCloseBearing(decision({ event_type: 'roll' }))).toBe(true);
      expect(isCloseBearing(decision({ event_type: 'accept', ai_verdict: 'Exit' }))).toBe(true);

      // ⚠ TRAP 1 — `accept` is AMBIGUOUS. The Hold/Trim/Add path writes `accept` and closes NOTHING.
      for (const verdict of ['Hold', 'Trim', 'Add']) {
        expect(isCloseBearing(decision({ event_type: 'accept', ai_verdict: verdict }))).toBe(false);
      }
      expect(isCloseBearing(decision({ event_type: 'accept' }))).toBe(false); // absent verdict

      // ⚠ TRAP 2 — the trap INSIDE the trap. The closing roll branch is gated on
      // `replacement_contract`; a Roll verdict without one falls through and writes `accept` +
      // `ai_verdict: 'Roll'` WITHOUT closing. The "symmetric" guess fabricates an exit for a LIVE
      // position. Only `event_type === 'roll'` is a roll close.
      expect(isCloseBearing(decision({ event_type: 'accept', ai_verdict: 'Roll' }))).toBe(false);

      // ⚠ TRAP 3 — `ai_verdict` is OVERLOADED: on an `alert` it carries the message PROSE.
      // `event_type` is the gate; `ai_verdict` only ever refines the `accept` case.
      expect(
        isCloseBearing(decision({ event_type: 'alert', ai_verdict: 'Exit the position now' })),
      ).toBe(false);
      expect(isCloseBearing(decision({ event_type: 'alert', ai_verdict: 'Exit' }))).toBe(false);

      // The set is CLOSED and FAIL-HONEST: an event the contract does not name is NOT a close — it
      // produces an under-count that is REPORTED, never a guessed exit basis.
      for (const event of ['open', 'reject', 'order_filled', 'limit_cancelled'] as const) {
        expect(isCloseBearing(decision({ event_type: event }))).toBe(false);
      }
      expect(isCloseBearing(decision({ event_type: 'some_future_event' as never }))).toBe(false);
    });

    it('the `Exit` conjunct is EXACT and case-sensitive — `ai_verdict` is free text, and only the exact literal the code writes is a close', () => {
      for (const near of ['exit', 'EXIT', 'Exited', ' Exit', 'Exit ']) {
        expect(isCloseBearing(decision({ event_type: 'accept', ai_verdict: near }))).toBe(false);
      }
    });
  });

  describe('the records the OLD rule threw away — now counted, retroactively, with zero bytes written', () => {
    it('case 1 — an Exit-verdict close (`accept` + `ai_verdict: "Exit"`) is COUNTED, and its exit basis is read from THAT record', () => {
      // Under the old `event_type === 'close'` rule this resolved to NO close record and fell to
      // `unresolved_join` — "couldn't link to its decision", which was factually FALSE: the decision
      // was linked, recorded, and sitting right there under a different name.
      const o = closedOutcome('p-1', { exitEvent: 'accept', exitVerdict: 'Exit' });
      seedStores({ positions: [o.position], positionDecisions: o.decisions });
      let read = computeLedgerRead();
      expect(read.coverage.counted).toBe(1);
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(0);
      expectBalances(read);

      // ...and the basis comes from THAT record: make it unpriced and the outcome leaves the headline.
      reset();
      const unpriced = closedOutcome('p-1', {
        exitEvent: 'accept',
        exitVerdict: 'Exit',
        exitBasis: 'theoretical',
      });
      seedStores({ positions: [unpriced.position], positionDecisions: unpriced.decisions });
      read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.unpriced_basis).toBe(1);
      expect(read.coverage.counted).toBe(0);
      expectBalances(read);
    });

    it('⚠ case 2 (PINNED, §11.6-A) — a ROLL close is COUNTED as a plain outcome, exit basis from the `roll` record', () => {
      // The rolled-OUT leg is a REAL outcome: the trader entered on a read, the position resolved, a
      // P&L was booked. "It's a continuation, not a loss" is the exact self-flattering sentence this
      // feature exists to refuse. Rolls skew to losses (they happen under duress), so EXCLUDING them
      // is the FLATTERING direction — it removes real losses from the denominator.
      const o = closedOutcome('p-1', { exitEvent: 'roll', exitVerdict: 'Roll', plPct: -30 });
      seedStores({ positions: [o.position], positionDecisions: o.decisions });
      const read = computeLedgerRead();
      expect(read.coverage.counted).toBe(1);
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(0);
      // ⚠ Counted as a PLAIN outcome — no marker, no badge, no asterisk, no roll category anywhere
      // in the read (AC-E19/AC-E21). The roll left no trace on the shape of the value.
      expect(JSON.stringify(read)).not.toMatch(/roll/i);
      expectBalances(read);
    });
  });

  describe('⚠ the records a NAIVE widen would have fabricated an exit for', () => {
    it('case 3 — THE TRAP: a non-closing `accept` (Hold/Trim/Add) with NO close-bearing record ⇒ `unresolved_join`, NOT counted', () => {
      // `useGhostTrade` writes `accept` on the Hold/Trim/Add path, which only adjusts qty. A rule of
      // the form "close | accept | roll" would take this mid-life record's `mark_basis` as an EXIT
      // basis for a position that closed at some other time via some other record — fabricating an
      // exit, and therefore a fill-quality class, from a mark no close ever happened at.
      for (const verdict of ['Hold', 'Trim', 'Add']) {
        reset();
        const entry = decision({
          trade_id: 'p-1',
          event_type: 'open',
          clock_time: '2026-03-04T14:00:00.000Z',
        });
        const midLife = decision({
          trade_id: 'p-1',
          event_type: 'accept',
          ai_verdict: verdict,
          clock_time: '2026-03-04T15:00:00.000Z',
        });
        seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry, midLife] });
        const read = computeLedgerRead();
        expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
        expect(read.coverage.counted).toBe(0);
        expectBalances(read);
      }
    });

    it('case 4 — THE TRAP INSIDE THE TRAP: a replacement-less deferred roll (`accept` + `ai_verdict: "Roll"`) ⇒ `unresolved_join`', () => {
      // This is the case an implementer's "symmetric" fix gets wrong. `acceptVerdict` gates the
      // closing roll on `rec.replacement_contract`; without one, the Roll verdict falls through to
      // the Hold/Trim/Add write and records `accept` + `ai_verdict: 'Roll'` — WITHOUT closing. The
      // position here closed by some other means whose record never landed; a rule reading
      // `ai_verdict ∈ {Exit, Roll}` would hand it this live-position mark as an exit basis.
      const entry = decision({
        trade_id: 'p-1',
        event_type: 'open',
        clock_time: '2026-03-04T14:00:00.000Z',
      });
      const deferred = decision({
        trade_id: 'p-1',
        event_type: 'accept',
        ai_verdict: 'Roll',
        clock_time: '2026-03-04T15:00:00.000Z',
      });
      seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry, deferred] });
      const read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
      expect(read.coverage.counted).toBe(0);
      expectBalances(read);
    });

    it('case 5 — an `alert` whose `ai_verdict` is PROSE is never close-bearing: `event_type` is the gate', () => {
      const entry = decision({
        trade_id: 'p-1',
        event_type: 'open',
        clock_time: '2026-03-04T14:00:00.000Z',
      });
      const alert = decision({
        trade_id: 'p-1',
        event_type: 'alert',
        ai_verdict: 'Price crossed the flip — consider an Exit',
        clock_time: '2026-03-04T16:00:00.000Z',
      });
      seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry, alert] });
      const read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
      expect(read.coverage.counted).toBe(0);
      expectBalances(read);
    });
  });

  describe('TOTALITY — the rule leaves no judgement, including in the rare case', () => {
    it('case 6 — two close-bearing records at the IDENTICAL latest clock_time ⇒ the WORST `mark_basis` decides', () => {
      // §2/Q3.1 consequence 7: one trade_id CAN carry two close-bearing records with different event
      // names from different stores. Latest-by-clock_time resolves it; on an exact tie, the worst
      // basis wins — deterministic, total, and it can only ever move an outcome OUT of the headline.
      const tie = '2026-03-05T14:00:00.000Z';
      const entry = decision({
        trade_id: 'p-1',
        event_type: 'open',
        clock_time: '2026-03-04T14:00:00.000Z',
      });
      const quoted = decision({
        trade_id: 'p-1',
        event_type: 'close',
        clock_time: tie,
        mark_basis: 'snapshot',
      });
      const modeled = decision({
        trade_id: 'p-1',
        event_type: 'accept',
        ai_verdict: 'Exit',
        clock_time: tie,
        mark_basis: 'modeled',
      });
      // Order-independent: the worst basis wins whichever way the union happens to iterate.
      for (const order2 of [
        [quoted, modeled],
        [modeled, quoted],
      ]) {
        reset();
        seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry, ...order2] });
        const read = computeLedgerRead();
        expect(read.coverage.excluded_by_reason.modeled_basis).toBe(1);
        expect(read.coverage.counted).toBe(0);
        expectBalances(read);
      }
    });

    it('the tie-break is NOT generalized to "worst basis among ALL close-bearing records" — only among EXACT clock_time ties', () => {
      // Generalizing would fold an earlier record's basis into the exit, excluding outcomes for
      // something untrue of their exits. An EARLIER modeled close must not poison a LATER quoted one.
      const entry = decision({
        trade_id: 'p-1',
        event_type: 'open',
        clock_time: '2026-03-04T14:00:00.000Z',
      });
      const earlierModeled = decision({
        trade_id: 'p-1',
        event_type: 'roll',
        clock_time: '2026-03-05T10:00:00.000Z',
        mark_basis: 'modeled',
      });
      const latestQuoted = decision({
        trade_id: 'p-1',
        event_type: 'close',
        clock_time: '2026-03-05T14:00:00.000Z',
        mark_basis: 'snapshot',
      });
      seedStores({
        positions: [position({ id: 'p-1' })],
        positionDecisions: [entry, earlierModeled, latestQuoted],
      });
      const read = computeLedgerRead();
      expect(read.coverage.counted).toBe(1); // the LATEST record's basis decides — it is quoted
      expect(read.coverage.excluded_by_reason.modeled_basis).toBe(0);
      expectBalances(read);
    });
  });

  describe('⚠ `unresolved_join` REMAINS LIVE — both enumerated shapes, so it can never become a dead branch', () => {
    it('case 7a — a closed position with a valid entry record and NO close-bearing record', () => {
      // Reachable: the stores degrade to in-memory on a storage fault, so a position write can
      // survive while its close `appendDecision` does not; also a close record dropped by per-record
      // validation, and an import that carried the position but whose decision log was truncated.
      const entry = decision({ trade_id: 'p-1', event_type: 'open' });
      seedStores({ positions: [position({ id: 'p-1' })], positionDecisions: [entry] });
      const read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
      expectBalances(read);
    });

    it('case 7b — a set `origin_order_id` with no `SimOrder` in the order index', () => {
      // Reachable: the orders blob failed to read, or an import carried the position but not its order.
      const o = closedOutcome('p-1', { originOrderId: 'o-missing' });
      seedStores({ positions: [o.position], positionDecisions: o.decisions, orders: [] });
      const read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
      expect(read.coverage.counted).toBe(0);
      expectBalances(read);
    });
  });

  describe('the change is a READ, not a migration', () => {
    it('case 9 — backwards compatibility: PRE-EXISTING records (no per-record id, NO digest) closed by an Exit accept are counted, and read `pre_capture`', () => {
      // A3 consults no digest, reads no new field, and has no epoch behaviour at all: historical
      // Exit/Roll closes come back RETROACTIVELY, the first time the amended read runs, and not one
      // byte is written to do it. A2's pre-capture counts survive it untouched.
      const entry = decision({
        trade_id: 'p-old',
        event_type: 'open',
        clock_time: '2025-11-02T09:30:00.000Z',
        tier: 'actionable',
      });
      delete (entry as { id?: string }).id; // a record written before per-record ids existed
      const exit = decision({
        trade_id: 'p-old',
        event_type: 'accept',
        ai_verdict: 'Exit',
        clock_time: '2025-11-03T09:30:00.000Z',
      });
      delete (exit as { id?: string }).id;
      seedStores({
        positions: [position({ id: 'p-old', close_time: '2025-11-03T09:30:00.000Z' })],
        positionDecisions: [entry, exit],
      });
      const read = computeLedgerRead();
      expect(read.coverage.counted).toBe(1);
      expect(familyOf(read, 'tier').cells[0].key).toBe('actionable'); // tier is top-level: it counts
      for (const key of ['setup', 'iv_band', 'persona'] as const) {
        expect(familyOf(read, key).coverage.pre_capture).toBe(1); // digest ABSENT ⇒ predates capture
      }
      expect(read.basis.capture_epoch).toBeNull(); // no record carries a digest — nothing invented
      // ⚠ Zero bytes written: the stores survive the read byte-for-byte.
      const before = localStorage.getItem('convexa.positions.v2');
      computeLedgerRead();
      expect(localStorage.getItem('convexa.positions.v2')).toBe(before);
      expectBalances(read);
    });

    it('⚠ M is IDENTICAL before and after the join changes — if M moved, something was touched that should not have been', () => {
      // The denominator is |P1| — readable, closed, recorded positions. The close-bearing predicate
      // changes only WHICH records reach step 3 of the precedence loop; it can never move M. This is
      // the cheapest regression net available on the whole amendment.
      const exits = [
        closedOutcome('p-close', {}),
        closedOutcome('p-exit', { exitEvent: 'accept', exitVerdict: 'Exit' }),
        closedOutcome('p-roll', { exitEvent: 'roll', exitVerdict: 'Roll' }),
        closedOutcome('p-none', { exitEvent: 'alert' }), // no close-bearing record ⇒ unresolved_join
      ];
      seedStores({
        positions: exits.map((e) => e.position),
        positionDecisions: exits.flatMap((e) => e.decisions),
      });
      const read = computeLedgerRead();
      expect(read.coverage.recorded_closed).toBe(4); // M spans them all, regardless of the join
      expect(read.coverage.counted).toBe(3);
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(1);
      expectBalances(read);
    });
  });

  describe('§11.6-B — the rolled-INTO leg', () => {
    it('⚠ case 10 (PINNED) — a closed position whose ONLY decision record is the `roll` that opened it ⇒ `no_decision_record`, never counted', () => {
      // `acceptVerdict`'s roll produces TWO artifacts: leg A (the rolled-OUT leg, which genuinely
      // closes — case 2) and leg B, a NEW position whose only record is `event_type: 'roll'`. It has
      // no `open` record, so the SPINE RULE (step 2) excludes it BEFORE the exit join is ever
      // consulted — leg B's entry is not a scored decision, it is a mechanical consequence of the
      // roll. This feature measures entries made on a READ.
      //
      // ⚠ The price of "fixing" this by admitting `roll` as an ENTRY event: `roll` is not a capture
      // event, so a roll-entry record carries NO digest — and digest-absent IS the pre-capture epoch
      // marker. Every historical rolled-into leg would report as "predates capture" when capture in
      // fact ran, corrupting the very count that exists to make the gap honest, unrepairably (no
      // backfill). Do not do it.
      const legB = decision({
        trade_id: 'p-legb',
        event_type: 'roll',
        ai_verdict: 'Roll',
        clock_time: '2026-03-05T14:00:00.000Z',
      });
      const closeB = decision({
        trade_id: 'p-legb',
        event_type: 'close',
        clock_time: '2026-03-09T14:00:00.000Z',
      });
      seedStores({ positions: [position({ id: 'p-legb' })], positionDecisions: [legB, closeB] });
      const read = computeLedgerRead();
      expect(read.coverage.excluded_by_reason.no_decision_record).toBe(1);
      expect(read.coverage.excluded_by_reason.unresolved_join).toBe(0);
      expect(read.coverage.counted).toBe(0);
      expect(read.families.flatMap((f) => f.cells)).toHaveLength(0);
      expectBalances(read);
    });

    it('a rolled position produces ONE counted outcome (leg A) and ONE excluded leg (leg B) — no double-count, no silent drop', () => {
      // The gap the user WILL notice, and it is REPORTED, not silent: leg A counts once; leg B shows
      // up in the exclusion breakdown the day it closes. `no_decision_record` is therefore a LIVE,
      // GROWING bucket driven by ordinary activity — not a demo-seed curiosity.
      const legA = closedOutcome('p-lega', { exitEvent: 'roll', exitVerdict: 'Roll', plPct: -25 });
      const legB = decision({
        trade_id: 'p-legb',
        event_type: 'roll',
        clock_time: '2026-03-05T14:00:00.000Z',
      });
      const closeB = decision({
        trade_id: 'p-legb',
        event_type: 'close',
        clock_time: '2026-03-09T14:00:00.000Z',
      });
      seedStores({
        positions: [legA.position, position({ id: 'p-legb' })],
        positionDecisions: [...legA.decisions, legB, closeB],
      });
      const read = computeLedgerRead();
      expect(read.coverage.recorded_closed).toBe(2);
      expect(read.coverage.counted).toBe(1); // leg A, once
      expect(read.coverage.excluded_by_reason.no_decision_record).toBe(1); // leg B
      expectBalances(read);
    });
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
      'convexa.positions.v3',
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
      expect(
        typeof read.coverage.excluded_by_reason[
          key as keyof typeof read.coverage.excluded_by_reason
        ],
      ).toBe('number');
    }
    // `computeLedgerRead` takes ONE option — a label injector. No filter, no include-list.
    expect(computeLedgerRead.length).toBeLessThanOrEqual(2);
  });
});
