/**
 * useBrokerBook — the Broker tab's ONE data hook: on-open fetch, the credential-hint read (S2's
 * "credential stored" client knowledge), and manual refresh with the honest outcome triple the
 * AC-8 note renders from.
 *
 * Wire discipline:
 *  - Refresh outcomes are derived from the ENVELOPE (basis + `last_attempt_*` movement — C5), not
 *    from HTTP status: throttle/cache-serve leaves `last_attempt_at` UNMOVED; a real failed
 *    attempt moves it and carries the failure cause.
 *  - A failed or transport-faulted read NEVER blanks a loaded book — the last envelope stays and
 *    the render lookup decides what that means (`[best-effort-isolated-or-null]`).
 *  - Import-isolated from the sim positions store: this module touches no `convexa.*` durable key
 *    and nothing here is ever persisted.
 */
import {
  fetchBrokerBook,
  fetchBrokerCredential,
  refreshBrokerBook,
  type BrokerBook,
  type BrokerFailureCause,
} from '@org/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RefreshOutcome {
  /** A fresh broker read landed — the as-of stamp advances; no note needed. */
  advanced: boolean;
  /** Server throttle / cache serve — NOT an attempt; the "unchanged and why" note renders. */
  throttled: boolean;
  /** A real attempt happened and failed — the cause names the honest note. */
  failed: BrokerFailureCause | null;
}

/**
 * Pure outcome derivation (exported for unit tests): fresh ⇒ advanced · served-from-cache with
 * `last_attempt_at` unmoved ⇒ throttled · attempt moved with a failure ⇒ failed. A response that
 * fits none of those (e.g. a transport fault upstream of any envelope) is all-false — the panel
 * still renders an honest note, never a silent no-op.
 */
export function refreshOutcomeOf(prev: BrokerBook | null, next: BrokerBook): RefreshOutcome {
  const served = next.state === 'ok' || next.state === 'empty';
  if (served && next.basis === 'fresh' && next.last_attempt_outcome === 'ok') {
    return { advanced: true, throttled: false, failed: null };
  }
  const attemptMoved =
    next.last_attempt_at != null && next.last_attempt_at !== prev?.last_attempt_at;
  if (attemptMoved && next.last_attempt_outcome != null && next.last_attempt_outcome !== 'ok') {
    return { advanced: false, throttled: false, failed: next.last_attempt_outcome };
  }
  if (served && next.basis === 'cache' && !attemptMoved) {
    return { advanced: false, throttled: true, failed: null };
  }
  // No snapshot at all: an unknown book with a failure reason is a failed attempt even if the
  // attempt stamp did not survive (e.g. first-ever refresh straight into an outage).
  if (next.state === 'unknown' && next.reason != null && next.reason !== 'no_credential_stored') {
    return { advanced: false, throttled: false, failed: next.reason };
  }
  return { advanced: false, throttled: false, failed: null };
}

export interface BrokerBookApi {
  book: BrokerBook | null;
  /** `GET /api/broker/credential` → `set`; null while unread/unreadable. */
  hintSet: boolean | null;
  inFlight: boolean;
  /** True until the FIRST book fetch settles (success or failure) after enable. */
  firstFetch: boolean;
  /** Re-run the on-open GET (the S5 "Try again" affordance). */
  refetch: () => Promise<void>;
  /** POST /api/broker/book/refresh — force-fetch; resolves the honest outcome triple. */
  refresh: () => Promise<RefreshOutcome>;
}

/** `enabled` = signed in. Anonymous sessions never hit the broker surface from here — the panel
 *  renders the shared SignInPrompt before any broker state is reachable (the auth carve-out). */
export function useBrokerBook(enabled: boolean): BrokerBookApi {
  const [book, setBook] = useState<BrokerBook | null>(null);
  const [hintSet, setHintSet] = useState<boolean | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [firstFetch, setFirstFetch] = useState(true);
  // The latest envelope, for outcome comparison inside async callbacks (state may lag).
  const bookRef = useRef<BrokerBook | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const applyBook = useCallback((next: BrokerBook) => {
    bookRef.current = next;
    setBook(next);
  }, []);

  const refetch = useCallback(async () => {
    setInFlight(true);
    try {
      const next = await fetchBrokerBook();
      if (aliveRef.current) applyBook(next);
    } catch {
      // Transport fault / gate refusal: keep whatever was loaded; the lookup renders S5 only when
      // nothing was ever known. Never blank a loaded read.
    } finally {
      if (aliveRef.current) {
        setInFlight(false);
        setFirstFetch(false);
      }
    }
  }, [applyBook]);

  // On-open: the hint read (S2's client knowledge) + the book read. Reset on disable so a
  // signed-out session holds no residual broker data.
  useEffect(() => {
    if (!enabled) {
      bookRef.current = null;
      setBook(null);
      setHintSet(null);
      setInFlight(false);
      setFirstFetch(true);
      return;
    }
    let cancelled = false;
    fetchBrokerCredential()
      .then((h) => {
        if (!cancelled && aliveRef.current) setHintSet(h.set);
      })
      .catch(() => {
        if (!cancelled && aliveRef.current) setHintSet(null);
      });
    void refetch();
    return () => {
      cancelled = true;
    };
  }, [enabled, refetch]);

  const refresh = useCallback(async (): Promise<RefreshOutcome> => {
    const prev = bookRef.current;
    setInFlight(true);
    try {
      const next = await refreshBrokerBook();
      if (aliveRef.current) applyBook(next);
      return refreshOutcomeOf(prev, next);
    } catch {
      // The refresh REQUEST itself failed (our transport, not a broker state). No envelope moved;
      // the caller renders the honest could-not-complete note — never a silent no-op (AC-8).
      return { advanced: false, throttled: false, failed: null };
    } finally {
      if (aliveRef.current) {
        setInFlight(false);
        setFirstFetch(false);
      }
    }
  }, [applyBook]);

  return { book, hintSet, inFlight, firstFetch, refetch, refresh };
}
