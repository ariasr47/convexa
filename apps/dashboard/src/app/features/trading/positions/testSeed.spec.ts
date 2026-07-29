/**
 * Unit — the dev/test-account portfolio seed (`seedTestPositionsIfNeeded`). Verifies: seeds only for
 * the test email, seeds a non-empty portfolio into an empty store, is one-time per browser+account
 * (marker), is non-destructive (never clobbers existing positions), and never throws on a storage
 * fault. Simulation-only; this seam only ever writes to the client-local positions store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimPosition } from './leg';
import { liftLegacyRecord } from './migrate';
import { __resetMemory, allPositions, PORTFOLIO_V3_KEY, putPosition } from './store';
import { seedTestPositionsIfNeeded, TEST_ACCOUNT_EMAIL, TEST_SEED_MARKER_KEY } from './testSeed';
import type { Position } from './types';

function mkPosition(over: Partial<Position> = {}): Position {
  return {
    id: 'real-1',
    ticker: 'MSFT',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'user_entered',
    entry_time: '2026-06-22T10:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
});

describe('seedTestPositionsIfNeeded', () => {
  it('seeds a non-empty simulated portfolio when the test account signs in with an empty store', () => {
    expect(allPositions()).toHaveLength(0);
    seedTestPositionsIfNeeded(TEST_ACCOUNT_EMAIL);
    const seeded = allPositions();
    expect(seeded.length).toBeGreaterThan(0);
    // A realistic mix: at least one open and one closed position.
    expect(seeded.some((p) => p.status === 'open')).toBe(true);
    expect(seeded.some((p) => p.status === 'closed')).toBe(true);
    // Marker recorded so we don't re-seed.
    expect(localStorage.getItem(TEST_SEED_MARKER_KEY)).not.toBeNull();
  });

  it('is a no-op for any other account (no positions, no marker)', () => {
    seedTestPositionsIfNeeded('someone-else@example.com');
    expect(allPositions()).toHaveLength(0);
    expect(localStorage.getItem(TEST_SEED_MARKER_KEY)).toBeNull();
  });

  it('is case-insensitive on the test email', () => {
    seedTestPositionsIfNeeded(TEST_ACCOUNT_EMAIL.toUpperCase());
    expect(allPositions().length).toBeGreaterThan(0);
  });

  it('is one-time: a second call does not re-seed after the seeded rows are removed', () => {
    seedTestPositionsIfNeeded(TEST_ACCOUNT_EMAIL);
    expect(allPositions().length).toBeGreaterThan(0);
    // Simulate the user deleting every seeded row (store back to empty).
    localStorage.setItem(
      PORTFOLIO_V3_KEY,
      JSON.stringify({ schema_version: 3, positions: {}, decisions: [] }),
    );
    __resetMemory();
    // Marker is still set → the second sign-in must NOT re-seed.
    seedTestPositionsIfNeeded(TEST_ACCOUNT_EMAIL);
    expect(allPositions()).toHaveLength(0);
  });

  it('is non-destructive: does not clobber existing positions, but marks handled', () => {
    putPosition(liftLegacyRecord(mkPosition()) as SimPosition);
    expect(allPositions()).toHaveLength(1);
    seedTestPositionsIfNeeded(TEST_ACCOUNT_EMAIL);
    // The pre-existing (real) position survives and no seed rows were added.
    const after = allPositions();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('real-1');
    // Still records the marker so we never seed over this account later.
    expect(localStorage.getItem(TEST_SEED_MARKER_KEY)).not.toBeNull();
  });

  it('never throws when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => seedTestPositionsIfNeeded(TEST_ACCOUNT_EMAIL)).not.toThrow();
    spy.mockRestore();
  });
});
