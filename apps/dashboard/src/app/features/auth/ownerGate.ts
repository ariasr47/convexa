/**
 * The owner gate as this browser has met it (docs/product/ai-analyst/DESIGN.md, "2026-10-26: the
 * owner gate shipped"). Every owner-only route refuses anyone but the owner with a 403: signed out
 * is `auth_required`, signed in as another account is `owner_only`, and so is everyone while the
 * API's `OWNER_EMAILS` is unset. The answer belongs to the session, not to a ticker or a route:
 * asking again under the same session cannot change it.
 *
 * So the first refusal an owner-only read meets is kept here, for this session. While it stands:
 * - every poller and stream on an owner-only route stops (`useOwnerGate()` is non-null);
 * - the page shows its wall (`OwnerGateBoundary` in RequireAuth.tsx).
 * A sign-in or sign-out starts a new session (`startOwnerGateSession`, called by AuthProvider),
 * which clears it, and the surfaces ask again.
 *
 * A module store, as `pages/ticker/liveTapeStore.ts` is, so a fetcher records a refusal without a
 * provider, and a refusal met on one page holds on the next. Demo builds never meet one: the demo
 * transport answers these routes itself.
 */
import { accessRefusalOf, type AccessRefusal } from '@convexa/api';
import { useSyncExternalStore } from 'react';

interface OwnerGateState {
  /** Moves on every sign-in and sign-out, so a refusal is only ever this session's. */
  session: number;
  refusal: AccessRefusal | null;
}

let state: OwnerGateState = { session: 0, refusal: null };
const listeners = new Set<() => void>();

function publish(next: OwnerGateState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;

/** A sign-in or sign-out: what the gate said to the last session says nothing about this one. */
export function startOwnerGateSession(): void {
  publish({ session: state.session + 1, refusal: null });
}

/**
 * Run one owner-only read. A refusal it meets is kept against the session the read was asked under,
 * so an answer that lands after a sign-in or sign-out is dropped; the error is rethrown either way,
 * for the caller's own handling.
 */
export async function ownerOnlyRead<T>(read: () => Promise<T>): Promise<T> {
  const session = state.session;
  try {
    return await read();
  } catch (error) {
    const refusal = accessRefusalOf(error);
    if (refusal && session === state.session && refusal !== state.refusal) {
      publish({ session, refusal });
    }
    throw error;
  }
}

/** This session's refusal, or null while the owner gate has not refused it. */
export function useOwnerGate(): AccessRefusal | null {
  return useSyncExternalStore(subscribe, getState, getState).refusal;
}
