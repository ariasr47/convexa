/**
 * F2 — the derived render predicates (INTERFACE_CONTRACT §2: derived, never wire fields).
 * Staleness is strictly greater-than the SERVER-declared threshold; degraded requires a served
 * snapshot; neither ever fires off an unknown book.
 */
import { describe, expect, it } from 'vitest';
import {
  BOOK_EMPTY,
  BOOK_NO_CREDENTIAL,
  BOOK_OK_AT_THRESHOLD,
  BOOK_OK_FRESH,
  BOOK_OK_STALE,
  FIXED_NOW_MS,
  STALE_AFTER_SECONDS,
  bookDegraded,
  bookUnknown,
} from './fixtures';
import { hasServedSnapshot, isDegraded, isStale, snapshotAgeSeconds } from './predicates';

describe('hasServedSnapshot', () => {
  it('true iff state ∈ {ok, empty} — the wire-keyed last-known condition', () => {
    expect(hasServedSnapshot(BOOK_OK_FRESH)).toBe(true);
    expect(hasServedSnapshot(BOOK_EMPTY)).toBe(true);
    expect(hasServedSnapshot(BOOK_NO_CREDENTIAL)).toBe(false);
    expect(hasServedSnapshot(bookUnknown('broker_unreachable'))).toBe(false);
    expect(hasServedSnapshot(null)).toBe(false);
  });
});

describe('isStale — now − as_of > stale_after_seconds, server threshold only', () => {
  it('fresh under the threshold; stale past it', () => {
    expect(isStale(BOOK_OK_FRESH, FIXED_NOW_MS)).toBe(false);
    expect(isStale(BOOK_OK_STALE, FIXED_NOW_MS)).toBe(true);
  });

  it('boundary: exactly AT the threshold is NOT stale; one ms past it is', () => {
    expect(isStale(BOOK_OK_AT_THRESHOLD, FIXED_NOW_MS)).toBe(false);
    expect(isStale(BOOK_OK_AT_THRESHOLD, FIXED_NOW_MS + 1)).toBe(true);
  });

  it('never fires without a served snapshot or without the server datum', () => {
    expect(isStale(bookUnknown('broker_unreachable'), FIXED_NOW_MS)).toBe(false);
    expect(isStale(null, FIXED_NOW_MS)).toBe(false);
    expect(isStale({ ...BOOK_OK_STALE, stale_after_seconds: undefined }, FIXED_NOW_MS)).toBe(false); // no FE-invented threshold, ever
    expect(isStale({ ...BOOK_OK_STALE, as_of: 'garbled' }, FIXED_NOW_MS)).toBe(false);
  });

  it('time-varying: the same envelope trips as the clock advances (no serve-time freeze)', () => {
    const justServed = FIXED_NOW_MS - 60_000; // as_of is 60s old at FIXED_NOW
    expect(isStale(BOOK_OK_FRESH, justServed + 60_000)).toBe(false);
    expect(isStale(BOOK_OK_FRESH, justServed + (STALE_AFTER_SECONDS + 61) * 1000)).toBe(true);
  });
});

describe('isDegraded — last attempt failed while a snapshot serves', () => {
  it('true for each failure cause over a served book', () => {
    for (const cause of [
      'broker_unreachable',
      'rate_limited',
      'adapter_fault',
      'credential_rejected',
      'credential_unreadable',
    ] as const) {
      expect(isDegraded(bookDegraded(cause))).toBe(true);
    }
  });

  it('false on ok outcome, absent outcome, or no snapshot', () => {
    expect(isDegraded(BOOK_OK_FRESH)).toBe(false);
    expect(
      isDegraded({ ...BOOK_OK_FRESH, last_attempt_at: undefined, last_attempt_outcome: undefined }),
    ).toBe(false);
    expect(isDegraded(bookUnknown('broker_unreachable'))).toBe(false);
    expect(isDegraded(null)).toBe(false);
  });
});

describe('snapshotAgeSeconds', () => {
  it('whole seconds, floored at zero (a skewed clock never renders a negative age)', () => {
    expect(snapshotAgeSeconds(BOOK_OK_FRESH, FIXED_NOW_MS)).toBe(60);
    expect(snapshotAgeSeconds(BOOK_OK_FRESH, FIXED_NOW_MS - 120_000)).toBe(0);
    expect(snapshotAgeSeconds(BOOK_NO_CREDENTIAL, FIXED_NOW_MS)).toBeNull();
  });
});
