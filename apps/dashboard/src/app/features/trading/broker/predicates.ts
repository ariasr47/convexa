/**
 * Derived render predicates over the `BrokerBook` envelope (INTERFACE_CONTRACT §2 — "derived
 * render predicates, never wire fields").
 *
 *  - stale    := now − as_of > stale_after_seconds   (client-derived, time-varying; the THRESHOLD
 *                is server-owned — an FE-invented threshold is on the contract's rejected list)
 *  - degraded := last_attempt_outcome ≠ ok while a snapshot serves
 *
 * Pure module: no React, no fetch, no clock — `nowMs` is an argument so every derivation is
 * deterministic under test.
 */
import type { BrokerBook } from '@convexa/api';

/** A served snapshot exists in THIS response (`state ∈ {ok, empty}`). The S7/S8 "last-known book
 *  stays below" clause keys off THIS — the wire, never client memory (decisions.md I-3). */
export function hasServedSnapshot(book: BrokerBook | null): boolean {
  return book != null && (book.state === 'ok' || book.state === 'empty');
}

/**
 * Book-snapshot-axis staleness. Strictly GREATER THAN the server threshold: a snapshot exactly at
 * `stale_after_seconds` old is NOT yet stale (boundary pinned by test). `false` whenever no
 * snapshot serves or the envelope lacks either datum — an unknown book is not "stale", it is
 * unknown (S5 owns that).
 */
export function isStale(book: BrokerBook | null, nowMs: number): boolean {
  if (!hasServedSnapshot(book) || book?.as_of == null || book.stale_after_seconds == null)
    return false;
  const asOfMs = Date.parse(book.as_of);
  if (Number.isNaN(asOfMs)) return false; // a garbled stamp never fabricates staleness either way
  return nowMs - asOfMs > book.stale_after_seconds * 1000;
}

/** Degraded (S7 precondition): the last attempt failed while a snapshot still serves. */
export function isDegraded(book: BrokerBook | null): boolean {
  return (
    hasServedSnapshot(book) &&
    book?.last_attempt_outcome != null &&
    book.last_attempt_outcome !== 'ok'
  );
}

/** Whole seconds of snapshot age, floored at 0 (a skewed client clock never renders a negative age). */
export function snapshotAgeSeconds(book: BrokerBook | null, nowMs: number): number | null {
  if (book?.as_of == null) return null;
  const asOfMs = Date.parse(book.as_of);
  if (Number.isNaN(asOfMs)) return null;
  return Math.max(0, Math.floor((nowMs - asOfMs) / 1000));
}
