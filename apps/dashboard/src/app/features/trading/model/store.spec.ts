/**
 * Unit — the ghost-trade durable store (`model/store.ts`). Risk-based: round-trip, the append-only
 * decision log, corrupt-blob degradation WITHOUT destroying the original, storage-failure isolation,
 * and the legacy-brand read (gammaflow → convexa, promote-forward, never delete the old blob).
 *
 * NOTE (documented split — do NOT "unify"): this store's `appendDecision` writes
 * `convexa.ghost-trade.v1`; the positions store has its OWN `appendDecision` writing
 * `convexa.positions.v2`. Each store's contract is tested against ITS OWN key.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMemory,
  allDecisions,
  appendDecision,
  clearTrade,
  decisionsForTrade,
  getTrade,
  GHOST_TRADE_KEY,
  GHOST_TRADE_LEGACY_KEY,
  putTrade,
} from './store';
import type { DecisionRecord, GhostTrade } from './types';

function trade(over: Partial<GhostTrade> = {}): GhostTrade {
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

function decision(over: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
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
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
});

describe('trade round-trip', () => {
  it('puts, reads (ticker case-insensitive), and clears a trade — durably under its OWN key', () => {
    putTrade(trade());
    expect(getTrade('tsla')?.id).toBe('t-1'); // case-insensitive key
    // Durable under convexa.ghost-trade.v1 (this store's key), not the positions store's key.
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toContain('t-1');
    expect(localStorage.getItem('convexa.positions.v2')).toBeNull();
    // Survives a reload (re-hydrate from localStorage).
    __resetMemory();
    expect(getTrade('TSLA')?.entry_mark).toBe(5);
    clearTrade('TSLA');
    expect(getTrade('TSLA')).toBeNull();
  });

  it('clearTrade removes only that ticker', () => {
    putTrade(trade({ id: 'a', ticker: 'TSLA' }));
    putTrade(trade({ id: 'b', ticker: 'AAPL' }));
    clearTrade('TSLA');
    expect(getTrade('TSLA')).toBeNull();
    expect(getTrade('AAPL')?.id).toBe('b');
  });
});

describe('append-only decision log', () => {
  it('appends (never rewrites), reads oldest-first globally and newest-first per trade', () => {
    appendDecision(decision({ event_type: 'open', clock_time: '2026-06-20T10:00:00Z' }));
    appendDecision(decision({ event_type: 'close', clock_time: '2026-06-21T10:00:00Z' }));
    appendDecision(decision({ trade_id: 'other', event_type: 'reject' }));
    expect(allDecisions().map((d) => d.event_type)).toEqual(['open', 'close', 'reject']);
    expect(decisionsForTrade('t-1').map((d) => d.event_type)).toEqual(['close', 'open']);
  });
});

describe('failure isolation', () => {
  it('a corrupt blob degrades to empty WITHOUT throwing and WITHOUT destroying the original blob', () => {
    localStorage.setItem(GHOST_TRADE_KEY, '{ not json');
    __resetMemory();
    expect(() => getTrade('TSLA')).not.toThrow();
    expect(getTrade('TSLA')).toBeNull();
    expect(allDecisions()).toEqual([]);
    // The unreadable original is left intact for manual recovery — a read never wipes it.
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toBe('{ not json');
  });

  it('a localStorage write failure degrades to in-memory only, never throws into the UI', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => putTrade(trade())).not.toThrow();
    expect(getTrade('TSLA')?.id).toBe('t-1'); // still readable in memory
    spy.mockRestore();
  });
});

describe('brand migration (gammaflow → convexa)', () => {
  it('reads a legacy-brand blob, promotes it forward, and NEVER deletes the original', () => {
    const legacyBlob = JSON.stringify({
      schema_version: 1,
      trades: { TSLA: trade({ id: 'legacy-brand' }) },
      decisions: [decision({ trade_id: 'legacy-brand' })],
    });
    localStorage.setItem(GHOST_TRADE_LEGACY_KEY, legacyBlob);
    __resetMemory();
    // Loss-free read through the legacy key…
    expect(getTrade('TSLA')?.id).toBe('legacy-brand');
    expect(decisionsForTrade('legacy-brand')).toHaveLength(1);
    // …promoted forward under the new brand, with the old blob byte-identical (rollback-safe).
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toBe(legacyBlob);
    expect(localStorage.getItem(GHOST_TRADE_LEGACY_KEY)).toBe(legacyBlob);
  });

  it('the new-brand blob WINS when both exist (never regresses to the legacy copy)', () => {
    localStorage.setItem(
      GHOST_TRADE_LEGACY_KEY,
      JSON.stringify({ schema_version: 1, trades: { TSLA: trade({ id: 'old' }) }, decisions: [] }),
    );
    localStorage.setItem(
      GHOST_TRADE_KEY,
      JSON.stringify({ schema_version: 1, trades: { TSLA: trade({ id: 'new' }) }, decisions: [] }),
    );
    __resetMemory();
    expect(getTrade('TSLA')?.id).toBe('new');
  });
});
