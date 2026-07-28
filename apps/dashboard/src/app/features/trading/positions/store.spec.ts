/**
 * Unit — durable store + v1→v2 migration (AC-30, AC-31, AC-36). The store is the only place the
 * migration + the corrupt-blob isolation are exercised in isolation; the flow-integration suite
 * re-checks the observable behavior end-to-end.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMemory,
  allPositions,
  appendDecision,
  decisionsForPosition,
  getCustomization,
  getPosition,
  PORTFOLIO_LEGACY_V1_KEY,
  PORTFOLIO_LEGACY_V2_KEY,
  PORTFOLIO_V1_KEY,
  PORTFOLIO_V2_KEY,
  positionsFaulted,
  putCustomization,
  putPosition,
  removePosition,
} from './store';
import type { DecisionRecord, Position } from './types';

function v1Trade(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't-1',
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-06-20T10:00:00Z',
    status: 'open',
    schema_version: 1,
    ...over,
  };
}

function mkPosition(over: Partial<Position> = {}): Position {
  return {
    id: 'p-1',
    ticker: 'AAPL',
    expiration: '2026-08-21',
    strike: 200,
    right: 'put',
    side: 'long',
    qty: 1,
    entry_mark: 3,
    entry_basis: 'user_entered',
    entry_time: '2026-06-22T10:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
}

/** Every durable byte, so "nothing was written" can be asserted over storage as a whole. */
function snapshotStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k != null) out[k] = localStorage.getItem(k) ?? '';
  }
  return out;
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
});

describe('v1→v2 migration', () => {
  it('migrates an existing single v1 trade into one open position keyed by id (loss-free)', () => {
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: v1Trade() },
        decisions: [],
      }),
    );
    __resetMemory();
    const positions = allPositions();
    expect(positions).toHaveLength(1);
    const p = positions[0];
    expect(p.id).toBe('t-1');
    expect(p.ticker).toBe('TSLA');
    expect(p.status).toBe('open');
    expect(p.entry_mark).toBe(5);
    expect(p.qty).toBe(2);
    // A v1 record had no entry_mode ⇒ it reads as a manual entry.
    expect(p.entry_mode ?? 'manual').toBe('manual');
  });

  it('carries the v1 decision history over verbatim (same trade_id join)', () => {
    const dec: DecisionRecord = {
      event_type: 'open',
      clock_time: '2026-06-20T10:00:00Z',
      trade_id: 't-1',
      contract: { ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', qty: 2 },
      mark_price: 5,
      mark_basis: 'snapshot',
      underlying_spot: 250,
      pl_dollar: 0,
      pl_pct: 0,
      tier: 'watch',
      position_fingerprint: '',
      schema_version: 1,
    };
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: v1Trade() },
        decisions: [dec],
      }),
    );
    __resetMemory();
    expect(decisionsForPosition('t-1')).toHaveLength(1);
    expect(decisionsForPosition('t-1')[0].event_type).toBe('open');
  });

  it('writes a v2 blob and leaves the readable v1 blob intact (never discards it)', () => {
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: v1Trade() },
        decisions: [],
      }),
    );
    __resetMemory();
    allPositions(); // triggers migration + write-back
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBeTruthy(); // v1 left intact
  });

  it('migrates a v1 closed trade into a closed position (retained, not pruned)', () => {
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: {
          TSLA: v1Trade({
            status: 'closed',
            realized_pl_dollar: 120,
            realized_pl_pct: 24,
            close_time: '2026-06-21T10:00:00Z',
          }),
        },
        decisions: [],
      }),
    );
    __resetMemory();
    const p = allPositions()[0];
    expect(p.status).toBe('closed');
    expect(p.realized_pl_dollar).toBe(120);
  });
});

describe('brand migration (gammaflow → convexa, loss-free)', () => {
  it('reads a legacy-brand v2 blob, promotes it forward, and NEVER deletes the original', () => {
    const legacyBlob = JSON.stringify({
      schema_version: 2,
      positions: { 'p-legacy': mkPosition({ id: 'p-legacy' }) },
      decisions: [],
    });
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, legacyBlob);
    __resetMemory();
    expect(allPositions().map((p) => p.id)).toEqual(['p-legacy']); // loss-free read
    // Promoted forward under the new brand; the old blob stays byte-identical (rollback-safe).
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(legacyBlob);
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBe(legacyBlob);
  });

  it('migrates a legacy-brand v1 ghost-trade blob (brand hop + version hop), sources intact', () => {
    const legacyV1 = JSON.stringify({
      schema_version: 1,
      trades: { TSLA: v1Trade() },
      decisions: [],
    });
    localStorage.setItem(PORTFOLIO_LEGACY_V1_KEY, legacyV1);
    __resetMemory();
    const positions = allPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].id).toBe('t-1');
    expect(positions[0].schema_version).toBe(2);
    // Written forward under convexa.positions.v2; the legacy source is never deleted.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V1_KEY)).toBe(legacyV1);
  });

  it('the new-brand v2 blob WINS when both brands exist (never regresses to the legacy copy)', () => {
    localStorage.setItem(
      PORTFOLIO_LEGACY_V2_KEY,
      JSON.stringify({
        schema_version: 2,
        positions: { old: mkPosition({ id: 'old' }) },
        decisions: [],
      }),
    );
    localStorage.setItem(
      PORTFOLIO_V2_KEY,
      JSON.stringify({
        schema_version: 2,
        positions: { new: mkPosition({ id: 'new' }) },
        decisions: [],
      }),
    );
    __resetMemory();
    expect(allPositions().map((p) => p.id)).toEqual(['new']);
  });
});

describe('store failure isolation (AC-36)', () => {
  it('degrades a corrupt v2 blob to an empty portfolio without throwing — and never destroys the original blob', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, '{ not json');
    __resetMemory();
    expect(() => allPositions()).not.toThrow();
    expect(allPositions()).toEqual([]);
    // A degraded READ never wipes the (possibly recoverable) original.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe('{ not json');
  });

  it('initializes customization to defaults when absent and never errors', () => {
    __resetMemory();
    const c = getCustomization();
    expect(c.views.length).toBeGreaterThan(0);
    expect(c.views.some((v) => v.builtin)).toBe(true);
  });

  it('survives a localStorage write failure (in-memory only, no throw)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => putPosition(mkPosition())).not.toThrow();
    expect(getPosition('p-1')?.id).toBe('p-1'); // still in memory
    spy.mockRestore();
  });
});

describe('positions CRUD + decisions', () => {
  it('puts, reads, and removes a position', () => {
    putPosition(mkPosition());
    expect(getPosition('p-1')?.ticker).toBe('AAPL');
    removePosition('p-1');
    expect(getPosition('p-1')).toBeNull();
  });

  it('appends decisions and reads them newest-first per position', () => {
    const base: Omit<DecisionRecord, 'event_type' | 'clock_time'> = {
      trade_id: 'p-1',
      contract: { ticker: 'AAPL', expiration: '2026-08-21', strike: 200, right: 'put', qty: 1 },
      mark_price: 3,
      mark_basis: 'snapshot',
      underlying_spot: 200,
      pl_dollar: 0,
      pl_pct: 0,
      tier: 'watch',
      position_fingerprint: '',
      schema_version: 2,
    };
    appendDecision({ ...base, event_type: 'limit_placed', clock_time: '2026-06-22T10:00:00Z' });
    appendDecision({ ...base, event_type: 'limit_filled', clock_time: '2026-06-22T10:05:00Z' });
    const recs = decisionsForPosition('p-1');
    expect(recs.map((r) => r.event_type)).toEqual(['limit_filled', 'limit_placed']);
  });

  it('persists customization across a memory reset (durable)', () => {
    const c = getCustomization();
    putCustomization({ ...c, activeViewId: c.views[0].id });
    __resetMemory();
    expect(getCustomization().views.length).toBeGreaterThan(0);
  });
});

/**
 * The fault latch (AC-56, AC-61) — spec §2.9, §2.10. This is a LIVE SHIPPED DEFECT, not a refactor:
 * `read()` caught to an empty portfolio and the very next mutator's `write()` overwrote the
 * unparseable-but-possibly-recoverable blob. `orders/store.ts` (`ordersFaulted()`) is the pattern.
 * Per spec §7 invariant 2 this test must FAIL against the pre-latch store or it proves nothing.
 */
describe('fault latch (AC-56) — an unparseable blob is never overwritten', () => {
  const CORRUPT = '{"schema_version":2,"positions":{ THIS IS NOT JSON';

  beforeEach(() => {
    localStorage.clear();
    __resetMemory();
  });

  it('refuses every mutator and leaves the damaged blob byte-identical', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();

    expect(positionsFaulted()).toBe(true);

    expect(putPosition(mkPosition({ id: 'p-new' }))).toBe(false);
    expect(removePosition('p-new')).toBe(false);
    expect(appendDecision({ trade_id: 'p-new' } as unknown as DecisionRecord)).toBe(false);
    expect(putCustomization(getCustomization())).toBe(false);

    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(CORRUPT);
  });

  it('leaves the WHOLE of storage byte-identical — nothing is rerouted to another key (AC-61)', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();
    const before = snapshotStorage();

    putPosition(mkPosition({ id: 'p-new' }));
    removePosition('p-1');
    appendDecision({ trade_id: 'p-new' } as unknown as DecisionRecord);
    putCustomization(getCustomization());

    // Not just "the damaged key survives": no fresh positions key is invented either (spec §2
    // *Not buildable* — routing new positions to a fresh key while faulted).
    expect(snapshotStorage()).toEqual(before);
  });

  it('is not faulted for an absent blob, and mutators still work', () => {
    __resetMemory();
    expect(positionsFaulted()).toBe(false);
    expect(putPosition(mkPosition({ id: 'p-ok' }))).toBe(true);
    expect(allPositions().map((p) => p.id)).toContain('p-ok');
  });

  it('determines fault synchronously at initialisation, not on the first write', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();
    // No mutator has been called yet.
    expect(positionsFaulted()).toBe(true);
  });

  it('a corrupt blob still degrades to an empty portfolio and never throws', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();
    expect(() => allPositions()).not.toThrow();
    expect(allPositions()).toEqual([]);
    expect(positionsFaulted()).toBe(true);
  });

  it('clears the latch on a later hydration of a readable blob (the flag is not sticky)', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();
    expect(positionsFaulted()).toBe(true);

    // Repaired outside the app (the store itself never repairs, prunes or deletes it).
    localStorage.setItem(
      PORTFOLIO_V2_KEY,
      JSON.stringify({ schema_version: 2, positions: { 'p-1': mkPosition() }, decisions: [] }),
    );
    __resetMemory();
    expect(positionsFaulted()).toBe(false);
    expect(putPosition(mkPosition({ id: 'p-2' }))).toBe(true);
  });

  it('the v1→v2 migration write still lands (the latch does not block a clean promote)', () => {
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({ schema_version: 1, trades: { TSLA: v1Trade() }, decisions: [] }),
    );
    __resetMemory();
    expect(allPositions()).toHaveLength(1);
    expect(positionsFaulted()).toBe(false);
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();
  });
});
