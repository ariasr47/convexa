/**
 * Unit — the retired ghost-trade blob, read-only (`model/store.ts`). Risk-based: the READ contract
 * that the v3 union and the outcome-ledger harvest depend on (round-trip of an existing blob,
 * corrupt-blob degradation WITHOUT destroying the original, the legacy-brand promote), plus the
 * thing this module now exists to guarantee — **it cannot write**.
 *
 * The write paths (`putTrade`, `clearTrade`, the second `appendDecision`) are DELETED at the v3
 * cutover, together with `useGhostTrade`. That deletion is the structural half of the union's
 * once-only guarantee: the residual hole a once-only migration cannot close on its own is a stale
 * tab on the pre-v3 build writing a NEW v1 record, and there is no writer left to do it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetMemory,
  allDecisions,
  allTrades,
  decisionsForTrade,
  getTrade,
  GHOST_TRADE_KEY,
  GHOST_TRADE_LEGACY_KEY,
} from './store';
import type { DecisionRecord } from './types';

/** The retired record shape, as it still sits in a real browser's localStorage. */
function trade(over: Record<string, unknown> = {}) {
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

function seed(key: string, trades: Record<string, unknown>, decisions: DecisionRecord[] = []) {
  const blob = JSON.stringify({ schema_version: 1, trades, decisions });
  localStorage.setItem(key, blob);
  __resetMemory();
  return blob;
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
});

describe('AC-58 — the v1 writer is GONE, by construction', () => {
  it('exports no write function — putTrade, clearTrade and appendDecision are deleted', async () => {
    const mod = (await import('./store')) as Record<string, unknown>;
    for (const name of ['putTrade', 'clearTrade', 'appendDecision', 'write']) {
      expect(mod[name], `${name} must not exist`).toBeUndefined();
    }
  });
});

describe('read contract (the migration + harvest source)', () => {
  it('reads an existing blob by ticker, case-insensitively, and survives a reload', () => {
    seed(GHOST_TRADE_KEY, { TSLA: trade() });
    expect((getTrade('tsla') as { id: string }).id).toBe('t-1');
    __resetMemory();
    expect((getTrade('TSLA') as { entry_mark: number }).entry_mark).toBe(5);
    expect(Object.keys(allTrades())).toEqual(['TSLA']);
  });

  it('reads the append-only log oldest-first globally and newest-first per trade', () => {
    seed(GHOST_TRADE_KEY, {}, [
      decision({ event_type: 'open', clock_time: '2026-06-20T10:00:00Z' }),
      decision({ event_type: 'close', clock_time: '2026-06-21T10:00:00Z' }),
      decision({ trade_id: 'other', event_type: 'reject' }),
    ]);
    expect(allDecisions().map((d) => d.event_type)).toEqual(['open', 'close', 'reject']);
    expect(decisionsForTrade('t-1').map((d) => d.event_type)).toEqual(['close', 'open']);
  });
});

describe('failure isolation', () => {
  it('a corrupt blob degrades to empty WITHOUT throwing and WITHOUT destroying the original', () => {
    localStorage.setItem(GHOST_TRADE_KEY, '{ not json');
    __resetMemory();
    expect(() => getTrade('TSLA')).not.toThrow();
    expect(getTrade('TSLA')).toBeNull();
    expect(allDecisions()).toEqual([]);
    // The unreadable original is left intact for manual recovery — a read never wipes it.
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toBe('{ not json');
  });
});

describe('brand migration (gammaflow → convexa)', () => {
  it('reads a legacy-brand blob, promotes it forward, and NEVER deletes the original', () => {
    const legacyBlob = seed(GHOST_TRADE_LEGACY_KEY, { TSLA: trade({ id: 'legacy-brand' }) }, [
      decision({ trade_id: 'legacy-brand' }),
    ]);
    expect((getTrade('TSLA') as { id: string }).id).toBe('legacy-brand');
    expect(decisionsForTrade('legacy-brand')).toHaveLength(1);
    // Promoted forward under the new brand, with the old blob byte-identical (rollback-safe). The
    // promote lives in `resolveDurable`, not here — which is why this module still has no setItem.
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toBe(legacyBlob);
    expect(localStorage.getItem(GHOST_TRADE_LEGACY_KEY)).toBe(legacyBlob);
  });

  it('the new-brand blob WINS when both exist (never regresses to the legacy copy)', () => {
    localStorage.setItem(
      GHOST_TRADE_LEGACY_KEY,
      JSON.stringify({ schema_version: 1, trades: { TSLA: trade({ id: 'old' }) }, decisions: [] }),
    );
    seed(GHOST_TRADE_KEY, { TSLA: trade({ id: 'new' }) });
    expect((getTrade('TSLA') as { id: string }).id).toBe('new');
  });
});
