/**
 * The closed S1–S9 render-state lookup (SPEC §4) — a PURE TOTAL FUNCTION over the wire envelope
 * plus four pieces of client context. Every wire tuple maps to EXACTLY ONE render (precedence
 * rule I-2); no branch anywhere reads `positions.length` (`[absent-is-not-none]`, AC-10).
 *
 * S6 (stale) is a MODIFIER on S3/S4 — `isStale` on the result — never a state of its own.
 * `credential_rejected` ⇒ S8 and `credential_unreadable` ⇒ its own warning-class render WHEREVER
 * they appear (as `reason` or as `last_attempt_outcome`); both surface through `warn`, which is
 * what the panel's banner copy branches on (S8's "Webull stopped accepting" copy must NEVER
 * render for a server-side decrypt-fail). S5 matches ONLY the three remaining failure causes.
 *
 * Pure module: no React, no fetch, no clock (`nowMs` is an input).
 */
import type { BrokerBook } from '@org/api';
import { hasServedSnapshot, isStale } from './predicates';

export type BrokerRenderState =
  | 'S1_never_connected'
  | 'S2_pending_first_sync'
  | 'S3_ok'
  | 'S4_empty_confirmed'
  | 'S5_unknown'
  | 'S7_degraded'
  | 'S8_reauth'
  | 'S9_cold_skeleton';

/** The two credential warning classes — distinct renders off distinct wire values (AC-13). */
export type BrokerWarn = 'credential_rejected' | 'credential_unreadable' | null;

export interface BrokerRender {
  state: BrokerRenderState;
  /** S6 — the book-snapshot-axis modifier on S3/S4 (and on the S7/S8 last-known book). */
  isStale: boolean;
  /** Non-null ⇒ the warning-class banner renders; selects WHICH copy (reauth vs our-fault). */
  warn: BrokerWarn;
  /** This response carries a served snapshot (`state ∈ {ok, empty}`) — the wire-keyed condition
   *  for the S7 rows / S8 "your last confirmed book stays below" clause. */
  hasSnapshot: boolean;
}

export interface RenderStateInput {
  /** The last envelope received, or null before any response landed. */
  book: BrokerBook | null;
  /** `GET /api/broker/credential` → `set`, or null while unknown — S2's "credential stored". */
  hintSet: boolean | null;
  /** A book request is currently in flight. */
  inFlight: boolean;
  /** No book fetch has SETTLED yet (success or failure) this mount. */
  firstFetch: boolean;
  nowMs: number;
}

/** The credential-warning pick, closed over both carrier fields. `credential_rejected` outranks
 *  `credential_unreadable` (deterministic order; the two cannot legitimately co-occur). */
function warnOf(book: BrokerBook): BrokerWarn {
  if (book.reason === 'credential_rejected' || book.last_attempt_outcome === 'credential_rejected')
    return 'credential_rejected';
  if (
    book.reason === 'credential_unreadable' ||
    book.last_attempt_outcome === 'credential_unreadable'
  )
    return 'credential_unreadable';
  return null;
}

export function resolveRenderState(input: RenderStateInput): BrokerRender {
  const { book, hintSet, inFlight, firstFetch, nowMs } = input;

  // ---- No envelope yet: the client-context states -----------------------------------------------
  if (book == null) {
    // Credential known-stored + the very first fetch in flight ⇒ S2 (named first-sync copy).
    if (firstFetch && inFlight && hintSet === true) {
      return { state: 'S2_pending_first_sync', isStale: false, warn: null, hasSnapshot: false };
    }
    // Mounted, first fetch not yet settled ⇒ the cold skeleton (S9 ≠ S7 ≠ S5 — three states).
    if (firstFetch) {
      return { state: 'S9_cold_skeleton', isStale: false, warn: null, hasSnapshot: false };
    }
    // A fetch SETTLED without producing an envelope (transport fault, nothing known) ⇒ S5:
    // "a fetch fails with nothing known" is AC-10's unknown arm, never an empty table.
    return { state: 'S5_unknown', isStale: false, warn: null, hasSnapshot: false };
  }

  const stale = isStale(book, nowMs);
  const hasSnapshot = hasServedSnapshot(book);

  // ---- Precedence I-2: the credential warnings win wherever they appear -------------------------
  const warn = warnOf(book);
  if (warn != null) {
    return { state: 'S8_reauth', isStale: stale, warn, hasSnapshot };
  }

  // ---- A served snapshot: S7 over S3/S4 when the last attempt failed ----------------------------
  if (hasSnapshot) {
    if (book.last_attempt_outcome != null && book.last_attempt_outcome !== 'ok') {
      return { state: 'S7_degraded', isStale: stale, warn: null, hasSnapshot };
    }
    return {
      state: book.state === 'ok' ? 'S3_ok' : 'S4_empty_confirmed',
      isStale: stale,
      warn: null,
      hasSnapshot,
    };
  }

  // ---- `state: unknown` — reason decides S1 vs S5 (NEVER positions.length) ----------------------
  if (book.reason === 'no_credential_stored') {
    return { state: 'S1_never_connected', isStale: false, warn: null, hasSnapshot: false };
  }
  // The three remaining failure causes (broker_unreachable | rate_limited | adapter_fault) — and,
  // fail-honest, any unknown future reason value: "we don't know" is the only safe claim.
  return { state: 'S5_unknown', isStale: false, warn: null, hasSnapshot: false };
}
