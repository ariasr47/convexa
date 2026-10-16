/**
 * The synced book never crosses accounts on one browser (audit 2026-10-15, W-E01). Before the fix,
 * account A's book stayed in localStorage after A left; account B's older server book was not
 * adopted, and B's next write pushed A's positions into B's account.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkLeg, mkPosition } from './fixtures';
import {
  __resetMemory,
  allPositions,
  bookOwner,
  claimBookFor,
  clearSyncedBook,
  exportBookBlob,
  importBookBlobIfNewer,
  putPosition,
} from './store';

const book = (id: string, ticker: string) => {
  const p = mkPosition([mkLeg({ ticker })], { id });
  return { schema_version: 3, positions: { [p.id]: p }, decisions: [] };
};
const ids = () =>
  allPositions()
    .map((p) => p.id)
    .sort();

beforeEach(() => {
  vi.useFakeTimers(); // the store's 800 ms push never fires
  localStorage.clear();
  __resetMemory();
});
afterEach(() => vi.useRealTimers());

describe('the synced book at the account boundary', () => {
  it("drops another account's book before pulling, so none of it reaches this account", () => {
    claimBookFor('user-a');
    expect(importBookBlobIfNewer(book('a-position', 'TSLA'), 2000)).toBe(true);
    __resetMemory(); // A's session ends without a sign-out; a reload re-reads the same storage

    claimBookFor('user-b');
    expect(ids()).toEqual([]);
    // B's server book is older than A's last write, and is still adopted.
    expect(importBookBlobIfNewer(book('b-server', 'SPY'), 1000)).toBe(true);
    expect(putPosition(mkPosition([mkLeg({ ticker: 'NVDA' })], { id: 'b-new' }))).toBe(true);
    expect(Object.keys(exportBookBlob().positions).sort()).toEqual(['b-new', 'b-server']);
    expect(bookOwner()).toBe('user-b');
  });

  it("keeps the same account's book, and an untagged one from before the tag", () => {
    expect(putPosition(mkPosition([mkLeg({ ticker: 'AAPL' })], { id: 'mine' }))).toBe(true);
    claimBookFor('user-a');
    expect(ids()).toEqual(['mine']);
    __resetMemory();
    claimBookFor('user-a');
    expect(ids()).toEqual(['mine']);
  });

  it('sign-out leaves an empty book that a reload does not refill', () => {
    claimBookFor('user-a');
    expect(putPosition(mkPosition([mkLeg({ ticker: 'AAPL' })], { id: 'mine' }))).toBe(true);
    clearSyncedBook();
    expect(ids()).toEqual([]);
    __resetMemory();
    expect(ids()).toEqual([]);
  });
});
