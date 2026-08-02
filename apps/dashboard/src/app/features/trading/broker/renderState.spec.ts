/**
 * F2 — the closed render-state lookup. The heart of this suite is TOTALITY + PRECEDENCE over the
 * full wire product (SPEC §4 I-2): every reachable tuple maps to exactly one render, the
 * credential warnings win wherever they appear, and NO branch reads `positions.length` (AC-10 —
 * the highest-severity honesty line in the feature).
 */
import type { BrokerAttemptOutcome, BrokerBook, BrokerReason } from '@org/api';
import { describe, expect, it } from 'vitest';
import {
  AS_OF_AT_THRESHOLD,
  AS_OF_FRESH,
  AS_OF_STALE,
  BOOK_EMPTY,
  BOOK_NO_CREDENTIAL,
  BOOK_OK_AT_THRESHOLD,
  BOOK_OK_FRESH,
  BOOK_OK_STALE,
  BOOK_UNKNOWN_WITH_CONTRIVED_POSITIONS,
  FIXED_NOW_MS,
  POS_EQUITY,
  STALE_AFTER_SECONDS,
  bookDegraded,
  bookUnknown,
} from './fixtures';
import { resolveRenderState, type BrokerRender, type BrokerRenderState } from './renderState';

const RENDER_STATES: BrokerRenderState[] = [
  'S1_never_connected',
  'S2_pending_first_sync',
  'S3_ok',
  'S4_empty_confirmed',
  'S5_unknown',
  'S7_degraded',
  'S8_reauth',
  'S9_cold_skeleton',
];

const resolve = (book: BrokerBook | null, over: Partial<Parameters<typeof resolveRenderState>[0]> = {}) =>
  resolveRenderState({
    book,
    hintSet: null,
    inFlight: false,
    firstFetch: false,
    nowMs: FIXED_NOW_MS,
    ...over,
  });

// =================================================================================================
// Totality + precedence over the full wire product
// =================================================================================================

describe('resolveRenderState · totality over the wire product', () => {
  const FAILURES = [
    'broker_unreachable',
    'rate_limited',
    'credential_rejected',
    'credential_unreadable',
    'adapter_fault',
  ] as const;
  const REASONS: BrokerReason[] = ['no_credential_stored', ...FAILURES];
  const OUTCOMES: (BrokerAttemptOutcome | undefined)[] = [undefined, 'ok', ...FAILURES];

  /** Every reachable envelope: 3 states × reason (unknown only) × outcome × fresh/stale as_of. */
  function* envelopes(): Generator<{ book: BrokerBook; label: string }> {
    for (const asOf of [AS_OF_FRESH, AS_OF_STALE]) {
      for (const outcome of OUTCOMES) {
        const attempt =
          outcome === undefined
            ? {}
            : { last_attempt_at: '2026-08-01T14:58:00Z', last_attempt_outcome: outcome };
        for (const state of ['ok', 'empty'] as const) {
          yield {
            label: `${state} · as_of=${asOf} · outcome=${String(outcome)}`,
            book: {
              state,
              as_of: asOf,
              basis: 'cache',
              stale_after_seconds: STALE_AFTER_SECONDS,
              positions: state === 'ok' ? [POS_EQUITY] : [],
              ...attempt,
            },
          };
        }
        for (const reason of REASONS) {
          yield {
            label: `unknown · reason=${reason} · outcome=${String(outcome)}`,
            book: { state: 'unknown', reason, positions: [], ...attempt },
          };
        }
      }
    }
  }

  it('maps EVERY tuple to exactly one member of the closed render set', () => {
    let count = 0;
    for (const { book, label } of envelopes()) {
      const r = resolve(book);
      expect(RENDER_STATES, `${label} → unmapped state ${r.state}`).toContain(r.state);
      count += 1;
    }
    expect(count).toBeGreaterThan(100); // the sweep is real, not vacuous
  });

  it('precedence I-2: credential_rejected ⇒ S8 WHEREVER it appears (reason or outcome)', () => {
    for (const { book, label } of envelopes()) {
      const carries =
        book.reason === 'credential_rejected' ||
        book.last_attempt_outcome === 'credential_rejected';
      const r = resolve(book);
      if (carries) {
        expect(r.state, label).toBe('S8_reauth');
        expect(r.warn, label).toBe('credential_rejected');
      }
    }
  });

  it('precedence I-2: credential_unreadable ⇒ its own warning-class render wherever it appears', () => {
    for (const { book, label } of envelopes()) {
      const rejected =
        book.reason === 'credential_rejected' ||
        book.last_attempt_outcome === 'credential_rejected';
      const unreadable =
        book.reason === 'credential_unreadable' ||
        book.last_attempt_outcome === 'credential_unreadable';
      const r = resolve(book);
      if (unreadable && !rejected) {
        expect(r.state, label).toBe('S8_reauth');
        expect(r.warn, label).toBe('credential_unreadable');
      }
      if (!unreadable && !rejected) {
        expect(r.warn, label).toBeNull(); // the warning class NEVER fires off other causes
      }
    }
  });

  it('S5 matches ONLY the three remaining failure causes; S7 requires a served snapshot', () => {
    for (const { book, label } of envelopes()) {
      const r = resolve(book);
      if (r.state === 'S5_unknown') {
        expect(book.state, label).toBe('unknown');
        expect(['broker_unreachable', 'rate_limited', 'adapter_fault'], label).toContain(
          book.reason,
        );
      }
      if (r.state === 'S7_degraded') {
        expect(['ok', 'empty'], label).toContain(book.state);
        expect(r.hasSnapshot, label).toBe(true);
      }
    }
  });
});

// =================================================================================================
// The named arms
// =================================================================================================

describe('resolveRenderState · named arms', () => {
  it('S1 ← unknown/no_credential_stored', () => {
    expect(resolve(BOOK_NO_CREDENTIAL).state).toBe('S1_never_connected');
  });

  it('S3 ← ok; S4 ← empty; both non-stale on a fresh as_of', () => {
    expect(resolve(BOOK_OK_FRESH)).toEqual<BrokerRender>({
      state: 'S3_ok',
      isStale: false,
      warn: null,
      hasSnapshot: true,
    });
    expect(resolve(BOOK_EMPTY).state).toBe('S4_empty_confirmed');
  });

  it('S7 ← a failed last attempt over a served snapshot, for each non-credential cause', () => {
    for (const cause of ['broker_unreachable', 'rate_limited', 'adapter_fault'] as const) {
      const r = resolve(bookDegraded(cause));
      expect(r.state).toBe('S7_degraded');
      expect(r.hasSnapshot).toBe(true);
    }
  });

  it('S5 ← unknown for each non-credential failure cause (never S4)', () => {
    for (const cause of ['broker_unreachable', 'rate_limited', 'adapter_fault'] as const) {
      const r = resolve(bookUnknown(cause));
      expect(r.state).toBe('S5_unknown');
    }
  });

  it('AC-10: contrived NON-empty positions under state:unknown STILL render S5; empty under state:empty still renders S4 (no branch reads length)', () => {
    expect(resolve(BOOK_UNKNOWN_WITH_CONTRIVED_POSITIONS).state).toBe('S5_unknown');
    expect(resolve({ ...BOOK_EMPTY, positions: [] }).state).toBe('S4_empty_confirmed');
    // And the inverse contrivance: ok with [] is still S3 — state is the sole disambiguator.
    expect(resolve({ ...BOOK_OK_FRESH, positions: [] }).state).toBe('S3_ok');
  });

  it('S8 keeps the wire-keyed snapshot flag: banner + last-known book iff state ∈ {ok, empty}', () => {
    const withBook = resolve(bookDegraded('credential_rejected'));
    expect(withBook).toMatchObject({ state: 'S8_reauth', warn: 'credential_rejected', hasSnapshot: true });
    const without = resolve(bookUnknown('credential_rejected'));
    expect(without).toMatchObject({ state: 'S8_reauth', warn: 'credential_rejected', hasSnapshot: false });
  });
});

// =================================================================================================
// Client-context states (no envelope yet) + the stale modifier
// =================================================================================================

describe('resolveRenderState · client-context states', () => {
  it('S2 ← credential known-stored + first fetch in flight', () => {
    const r = resolve(null, { hintSet: true, inFlight: true, firstFetch: true });
    expect(r.state).toBe('S2_pending_first_sync');
  });

  it('S9 ← mounted before the first fetch settles (hint unknown or unset)', () => {
    expect(resolve(null, { inFlight: true, firstFetch: true }).state).toBe('S9_cold_skeleton');
    expect(resolve(null, { hintSet: false, inFlight: true, firstFetch: true }).state).toBe(
      'S9_cold_skeleton',
    );
    expect(resolve(null, { firstFetch: true }).state).toBe('S9_cold_skeleton');
  });

  it('S5 ← a settled fetch that produced nothing (cold-start transport fault) — never an empty table', () => {
    expect(resolve(null, { firstFetch: false }).state).toBe('S5_unknown');
  });
});

describe('resolveRenderState · the S6 stale modifier', () => {
  it('rides S3 when the snapshot aged past the server threshold', () => {
    expect(resolve(BOOK_OK_STALE)).toMatchObject({ state: 'S3_ok', isStale: true });
  });

  it('boundary: EXACTLY at stale_after_seconds ⇒ NOT stale (strictly greater-than)', () => {
    expect(Date.parse(AS_OF_AT_THRESHOLD)).toBe(FIXED_NOW_MS - STALE_AFTER_SECONDS * 1000);
    expect(resolve(BOOK_OK_AT_THRESHOLD).isStale).toBe(false);
    // …and one millisecond past it IS stale (time-varying, client-derived).
    expect(resolveRenderState({
      book: BOOK_OK_AT_THRESHOLD,
      hintSet: null,
      inFlight: false,
      firstFetch: false,
      nowMs: FIXED_NOW_MS + 1,
    }).isStale).toBe(true);
  });

  it('S6 is a MODIFIER, never a state: no member of the closed set names it', () => {
    expect(RENDER_STATES.some((s) => /S6/.test(s))).toBe(false);
  });
});
