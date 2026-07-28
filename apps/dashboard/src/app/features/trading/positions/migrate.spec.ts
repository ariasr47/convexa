/**
 * Unit — the ONE lift function and the union. SPEC §7 invariant 1 (`loss-free-durable-migration`,
 * the severity-promoted key): union-once, distinct-id count, abort-entirely on any unreadable
 * source, no fabrication in the lift, and one lift shared by the store and the archive import.
 *
 * Every assertion here protects a loss that is SILENT, TOTAL and IRREVERSIBLE — ~5 localStorage
 * stores hold the whole trading history with no server backup. Nothing in this file may be relaxed
 * to make an implementation pass.
 */
import { describe, expect, it } from 'vitest';
import {
  COLLIDING_ID_PAIR,
  LEGACY_V1_RECORD,
  LEGACY_V2_RECORD,
  MALFORMED_LEGACY_RECORD,
} from './fixtures';
import {
  liftLegacyRecord,
  mergeCollidingRecords,
  unionSources,
  type ParsedSource,
} from './migrate';

const src = (
  key: string,
  records: unknown[],
  decisions: unknown[] = [],
  ok = true,
): ParsedSource => ({ key, ok, records, decisions });

describe('liftLegacyRecord — the ONE lift', () => {
  it('AC-48 — keeps ticker, quantity, entry price, entry time and open/closed state', () => {
    const p = liftLegacyRecord(LEGACY_V2_RECORD);
    expect(p).not.toBeNull();
    expect(p!.legs).toHaveLength(1);
    expect(p!.legs[0].ticker).toBe('TSLA');
    expect(p!.legs[0].qty).toBe(2);
    expect(p!.legs[0].entry_price).toBe(12.4);
    expect(p!.opened_time).toBe('2026-06-12T15:32:00Z');
    expect(p!.status).toBe('open');
    expect(p!.stop).toBe(8);
    expect(p!.target).toBe(22);
  });

  it('sets instrument_kind option and multiplier 100 on every migrated leg', () => {
    const p = liftLegacyRecord(LEGACY_V1_RECORD)!;
    expect(p.legs[0].kind).toBe('option');
    expect(p.legs[0].multiplier).toBe(100);
  });

  it('AC-48 — a pending limit`s EMPTY entry time is carried through, never backfilled', () => {
    const p = liftLegacyRecord({
      ...LEGACY_V2_RECORD,
      status: 'pending',
      entry_time: '',
      limit_price: 9,
    })!;
    expect(p.opened_time).toBe('');
    expect(p.status).toBe('pending');
    expect(p.limit_price).toBe(9);
  });

  it('is FORBIDDEN from fabricating a right, a strike or an entry time', () => {
    const p = liftLegacyRecord(MALFORMED_LEGACY_RECORD)!;
    expect(p.legs[0].right).toBeNull();
    expect(p.legs).toHaveLength(1);

    const noFacts = liftLegacyRecord({ id: 'bare-1', ticker: 'TSLA' })!;
    expect(noFacts.legs[0].right).toBeNull();
    expect(noFacts.legs[0].strike).toBeNull();
    expect(noFacts.legs[0].expiration).toBeNull();
    expect(noFacts.opened_time).toBe(''); // NOT a `new Date()` stamp
  });

  it('does NOT carry the old Strategy value forward', () => {
    const p = liftLegacyRecord({
      ...LEGACY_V2_RECORD,
      strategy: 'long_call',
    }) as unknown as Record<string, unknown>;
    expect(p.strategy).toBeUndefined();
  });

  it('returns null for a record with no usable id', () => {
    expect(liftLegacyRecord({ ticker: 'TSLA' })).toBeNull();
    expect(liftLegacyRecord(null)).toBeNull();
    expect(liftLegacyRecord('nope')).toBeNull();
    expect(liftLegacyRecord({ id: '' })).toBeNull();
  });

  it('never throws on arbitrary garbage', () => {
    for (const junk of [undefined, 0, [], { legs: 'no' }, { id: 5 }]) {
      expect(() => liftLegacyRecord(junk)).not.toThrow();
    }
  });

  it('is DETERMINISTIC — the same record lifts to the same leg id every time', () => {
    // The store migration and the archive import must produce IDENTICAL records from the same
    // source row, or re-importing your own backup diverges from what the migration wrote.
    expect(liftLegacyRecord(LEGACY_V2_RECORD)).toEqual(liftLegacyRecord(LEGACY_V2_RECORD));
    expect(liftLegacyRecord(LEGACY_V2_RECORD)!.legs[0].id).toBe(
      liftLegacyRecord(LEGACY_V2_RECORD)!.legs[0].id,
    );
  });

  it('never mutates the raw record it is handed', () => {
    const raw = { ...LEGACY_V2_RECORD };
    const before = JSON.stringify(raw);
    liftLegacyRecord(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe('unionSources', () => {
  it('AC-45/46 — unions both surfaces and counts DISTINCT IDS, not the arithmetic sum', () => {
    const r = unionSources([
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record, LEGACY_V1_RECORD]),
    ]);
    expect(r.aborted).toBe(false);
    expect(Object.keys(r.positions).sort()).toEqual(['ghost-only-1', 'shared-1']);
    expect(r.source_counts['convexa.positions.v2']).toEqual({ read: 1, contributed: 1 });
    expect(r.source_counts['convexa.ghost-trade.v1']).toEqual({ read: 2, contributed: 1 });
    // The arithmetic sum is 3. The DISTINCT-id count is 2. Never the sum (AC-46).
    expect(Object.keys(r.positions)).toHaveLength(2);
  });

  it('AC-46 — two records of the same CONTRACT with different ids remain TWO positions', () => {
    const r = unionSources([
      src('convexa.positions.v2', [
        { ...LEGACY_V2_RECORD, id: 'lot-a' },
        { ...LEGACY_V2_RECORD, id: 'lot-b' },
      ]),
    ]);
    expect(Object.keys(r.positions)).toHaveLength(2);
  });

  it('keep-first is v2-before-v1, EXCEPT that closed in either source is closed', () => {
    const r = unionSources([
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record]),
    ]);
    const merged = r.positions['shared-1'];
    expect(merged.status).toBe('closed');
    expect(merged.close_time).toBe('2026-06-30T19:55:00Z');
    expect(merged.realized_pl_dollar).toBe(196);
    // plan fields take the v2 copy
    expect(merged.stop).toBe(8);
    expect(merged.target).toBe(22);
  });

  it('AC-49 — unions decisions by identity, ONCE EACH, with no renumbering', () => {
    const shared = {
      id: 'd-1',
      event_type: 'open',
      clock_time: '2026-06-12T15:32:00Z',
      trade_id: 'shared-1',
    };
    const onlyV1 = {
      id: 'd-2',
      event_type: 'open',
      clock_time: '2026-06-18T14:05:00Z',
      trade_id: 'ghost-only-1',
    };
    const r = unionSources([
      src('convexa.positions.v2', [], [shared]),
      src('convexa.ghost-trade.v1', [shared, onlyV1] as unknown[], [shared, onlyV1]),
    ]);
    expect(r.decisions).toHaveLength(2);
    expect(r.decisions.map((d) => d.id)).toEqual(['d-1', 'd-2']);
  });

  it('AC-49 — an ID-LESS decision de-dupes on the composite key, not by object identity', () => {
    const anon = { event_type: 'open', clock_time: '2026-06-12T15:32:00Z', trade_id: 'shared-1' };
    const r = unionSources([
      src('convexa.positions.v2', [], [{ ...anon }]),
      src('convexa.ghost-trade.v1', [], [{ ...anon }]),
    ]);
    expect(r.decisions).toHaveLength(1);
  });

  it('a LOGICAL source is ONE source: an unreadable store reports ONE unread key, not its brand pair', () => {
    // The caller resolves the brand hop and passes ONE entry per logical store. Even though
    // `resolveDurable` may have promoted identical corrupt bytes to BOTH the convexa and gammaflow
    // keys, the union must never be handed — or emit — two entries for one blob.
    const r = unionSources([
      src('convexa.positions.v2', [], [], false),
      src('convexa.ghost-trade.v1', [LEGACY_V1_RECORD]),
    ]);
    expect(r.unread_sources).toEqual(['convexa.positions.v2']);
    expect(r.unread_sources).toHaveLength(1);
    expect(Object.keys(r.source_counts).sort()).toEqual([
      'convexa.ghost-trade.v1',
      'convexa.positions.v2',
    ]);
    expect(Object.keys(r.source_counts)).toHaveLength(2); // never 4 — no legacy-brand key appears
  });

  it('source_counts is keyed by LOGICAL source — no gammaflow.* key ever appears', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('convexa.ghost-trade.v1', [LEGACY_V1_RECORD]),
    ]);
    for (const k of Object.keys(r.source_counts)) expect(k).not.toMatch(/^gammaflow\./);
  });

  it('DEFENCE IN DEPTH — a caller that passes BOTH brand keys for one blob still reports ONE source', () => {
    // `resolveDurable` promotes a legacy-brand blob to the new key BEFORE anything parses it, so an
    // unparseable `gammaflow.positions.v2` leaves the SAME corrupt bytes under `convexa.positions.v2`.
    // A caller that forwards both physical keys must not double the abort reason or the provenance.
    const r = unionSources([
      src('convexa.positions.v2', [], [], false),
      src('gammaflow.positions.v2', [], [], false),
      src('convexa.ghost-trade.v1', [LEGACY_V1_RECORD]),
    ]);
    expect(r.unread_sources).toEqual(['convexa.positions.v2']);
    expect(Object.keys(r.source_counts).sort()).toEqual([
      'convexa.ghost-trade.v1',
      'convexa.positions.v2',
    ]);
    for (const k of Object.keys(r.source_counts)) expect(k).not.toMatch(/^gammaflow\./);
  });

  it('DEFENCE IN DEPTH — a brand pair is never double-READ either', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('gammaflow.positions.v2', [LEGACY_V2_RECORD]),
    ]);
    expect(r.source_counts['convexa.positions.v2']).toEqual({ read: 1, contributed: 1 });
    expect(Object.keys(r.positions)).toHaveLength(1);
  });

  it('DEFENCE IN DEPTH — half a brand pair unreadable makes the WHOLE logical source unread', () => {
    // Conservative on purpose: a logical source that did not read completely has not read.
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('gammaflow.positions.v2', [], [], false),
    ]);
    expect(r.aborted).toBe(true);
    expect(r.unread_sources).toEqual(['convexa.positions.v2']);
  });

  it('AC-57 — ABORTS ENTIRELY if ANY source is unread; no partial result is offered', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('convexa.ghost-trade.v1', [], [], false),
    ]);
    expect(r.aborted).toBe(true);
    expect(r.unread_sources).toEqual(['convexa.ghost-trade.v1']);
  });

  it('an unread source contributes ZERO records but the readable ones are still available in memory', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('convexa.ghost-trade.v1', [], [], false),
    ]);
    expect(Object.keys(r.positions)).toEqual(['shared-1']);
    expect(r.source_counts['convexa.ghost-trade.v1']).toEqual({ read: 0, contributed: 0 });
  });

  it('an unread source contributes ZERO records EVEN IF it carries some — nothing is half-adopted', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('convexa.ghost-trade.v1', [LEGACY_V1_RECORD], [{ id: 'd-x' }], false),
    ]);
    expect(Object.keys(r.positions)).toEqual(['shared-1']);
    expect(r.decisions).toEqual([]);
    expect(r.source_counts['convexa.ghost-trade.v1']).toEqual({ read: 0, contributed: 0 });
  });

  it('AC-52 — no sources at all is a clean empty result, not an error and not an abort', () => {
    const r = unionSources([src('convexa.positions.v2', []), src('convexa.ghost-trade.v1', [])]);
    expect(r.aborted).toBe(false);
    expect(r.positions).toEqual({});
    expect(r.decisions).toEqual([]);
    expect(r.source_counts['convexa.positions.v2']).toEqual({ read: 0, contributed: 0 });
  });

  it('an unliftable row is READ but contributes nothing — it never becomes a phantom position', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD, null, 'garbage', { noId: true }]),
    ]);
    expect(r.source_counts['convexa.positions.v2']).toEqual({ read: 4, contributed: 1 });
    expect(Object.keys(r.positions)).toEqual(['shared-1']);
  });

  it('is deterministic — the same input yields the same output', () => {
    const input = () => [
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record]),
    ];
    expect(unionSources(input())).toEqual(unionSources(input()));
  });

  it('never throws, whatever the source material is', () => {
    expect(() =>
      unionSources([
        src('convexa.positions.v2', [undefined, 0, [], { id: 5 }], [null, 7, 'x']),
        src('convexa.ghost-trade.v1', [], []),
      ]),
    ).not.toThrow();
  });

  it('never mutates the sources it is handed', () => {
    const sources = [
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record]),
    ];
    const before = JSON.stringify(sources);
    unionSources(sources);
    expect(JSON.stringify(sources)).toBe(before);
  });

  it('UNION-ONCE, stated as a hazard: re-running over the sources RESURRECTS a removed record', () => {
    // This function knows nothing about an existing v3 collection — by design. It cannot protect
    // itself from a second run, so the ONCE-ONLY rule can only live in the CALLER (F18: once
    // `convexa.positions.v3` exists, no source is ever consulted again). This test pins the reason:
    // a record the trader deleted in v3 comes straight back out of the source blobs.
    const sources = [
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [LEGACY_V1_RECORD]),
    ];
    const first = unionSources(sources);
    expect(Object.keys(first.positions).sort()).toEqual(['ghost-only-1', 'shared-1']);

    // The trader removes one in v3 …
    const afterRemoval = { ...first.positions };
    delete afterRemoval['ghost-only-1'];
    expect(Object.keys(afterRemoval)).toEqual(['shared-1']);

    // … and a SECOND union over the untouched sources brings it back. Never re-run this.
    const second = unionSources(sources);
    expect(Object.keys(second.positions)).toContain('ghost-only-1');
  });
});

describe('mergeCollidingRecords', () => {
  it('re-opening a closed trade is impossible — the asymmetry is deliberate', () => {
    const open = liftLegacyRecord(COLLIDING_ID_PAIR.v2Record)!;
    const closed = liftLegacyRecord(COLLIDING_ID_PAIR.v1Record)!;
    expect(mergeCollidingRecords(open, closed).status).toBe('closed');
    expect(mergeCollidingRecords(closed, open).status).toBe('closed');
  });

  it('a cancelled second copy is terminal too, and its close data comes with it', () => {
    const open = liftLegacyRecord(COLLIDING_ID_PAIR.v2Record)!;
    const cancelled = liftLegacyRecord({
      ...COLLIDING_ID_PAIR.v1Record,
      status: 'cancelled',
      close_time: '2026-06-29T18:00:00Z',
    })!;
    const m = mergeCollidingRecords(open, cancelled);
    expect(m.status).toBe('cancelled');
    expect(m.close_time).toBe('2026-06-29T18:00:00Z');
  });

  it('two open copies keep the FIRST (v2) copy wholesale', () => {
    const a = liftLegacyRecord({ ...LEGACY_V2_RECORD, stop: 8 })!;
    const b = liftLegacyRecord({ ...LEGACY_V2_RECORD, stop: 99, target: 1 })!;
    expect(mergeCollidingRecords(a, b)).toEqual(a);
  });

  it('never mutates either input', () => {
    const open = liftLegacyRecord(COLLIDING_ID_PAIR.v2Record)!;
    const closed = liftLegacyRecord(COLLIDING_ID_PAIR.v1Record)!;
    const before = [JSON.stringify(open), JSON.stringify(closed)];
    mergeCollidingRecords(open, closed);
    expect([JSON.stringify(open), JSON.stringify(closed)]).toEqual(before);
  });
});
