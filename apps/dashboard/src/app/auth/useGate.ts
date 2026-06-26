/**
 * useGate — the shared gated-action helper (UX_BLUEPRINT §2.6/§2.7, AC-E1/E4/E7/J1). It answers the
 * one question every gated write/LLM-invoke asks: "may this run now, and if not, what do I show?"
 *
 *  - signed in ⇒ `allowed === true`; the caller runs the existing flow unchanged.
 *  - logged out ⇒ `allowed === false`; the caller shows an in-context sign-in prompt (NEVER a silent
 *    no-op, never a misleading error) and does NOT execute (AC-E1/E4).
 *  - server-enforced (AC-E7): even if a FE check is bypassed, the SERVER returns 403 `auth_required`
 *    / 503 `auth_unavailable`. `guard(run)` wraps a server-call so an `AuthError(auth_required)`
 *    re-opens the prompt and an `AuthError(auth_unavailable)` shows the "couldn't reach sign-in" copy.
 *
 * The auth gate is OUTERMOST: this helper does NOT know about ai-rec's cooldown/cap/no_key — those
 * only run AFTER `allowed` is true, in the existing surfaces.
 */
import { useCallback, useState } from 'react';
import { AuthError, simTradeGate } from '@org/api';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';

export interface GuardOptions {
  /** A server-enforced auth gate to AWAIT BEFORE `fn` runs (AC-E7). When the action's own work is a
   *  pure-client write (e.g. the Positions localStorage sim-trade writes), the server enforcement of
   *  record is THIS call — it must return success before the local mutation happens. A 403/503 from it
   *  throws an `AuthError`, so the write is ABORTED and nothing is persisted. (For an action whose `fn`
   *  is itself the server call — e.g. the ai-rec LLM POST — omit this; `fn` carries the enforcement.) */
  serverGate?: () => Promise<unknown>;
}

export interface GateApi {
  allowed: boolean;
  /** Transient prompt text shown in-context (null ⇒ hidden). Set by `prompt()` / a server rejection. */
  promptText: string | null;
  /** Render the sign-in prompt for `reason` and (when tapped) open the dialog returning to `onSuccess`. */
  prompt: (reason: string, onSuccess?: () => void) => void;
  /** Open the sign-in dialog directly (used by the prompt's "Sign in" button). */
  signIn: (reason: string, onSuccess?: () => void) => void;
  /** Clear the transient prompt. */
  clear: () => void;
  /** Run a gated action: if logged out, show the prompt and DON'T execute; else (optionally await a
   *  server gate, then) run `fn`, translating a server `auth_required`/`auth_unavailable` into the right
   *  in-context copy (AC-E7/J1). When `opts.serverGate` is supplied it is awaited FIRST and must succeed
   *  before `fn` runs — so a pure-client write is still server-enforced. */
  guard: (reason: string, fn: () => void | Promise<void>, opts?: GuardOptions) => Promise<void>;
  /** The server-enforced Positions sim-trade gate (`POST /api/positions/sim-trade/gate`). Pass as
   *  `opts.serverGate` to `guard` for every gated Positions WRITE action so the server is the boundary
   *  of record even if the FE check is bypassed (AC-E7/D6e). */
  simTradeGate: () => Promise<unknown>;
}

export function useGate(): GateApi {
  const auth = useAuth();
  const { openAuth } = useAuthDialog();
  const [promptText, setPromptText] = useState<string | null>(null);

  const allowed = auth.authenticated;

  const signIn = useCallback((reason: string, onSuccess?: () => void) => {
    openAuth({ mode: 'login', reason, onSuccess: () => { setPromptText(null); onSuccess?.(); } });
  }, [openAuth]);

  const prompt = useCallback((reason: string) => {
    setPromptText(reason);
  }, []);

  const clear = useCallback(() => setPromptText(null), []);

  const guard = useCallback(async (
    reason: string,
    fn: () => void | Promise<void>,
    opts?: GuardOptions,
  ) => {
    if (!auth.authenticated) {
      // FE gate: show the in-context prompt, do NOT execute.
      setPromptText(reason);
      return;
    }
    try {
      // Server-enforced gate FIRST (AC-E7): when supplied, it must succeed BEFORE the (possibly
      // pure-client) `fn` runs. If it throws an AuthError, `fn` never runs — nothing is persisted.
      if (opts?.serverGate) await opts.serverGate();
      await fn();
      setPromptText(null);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'auth_required') {
        // Server-enforced rejection (stale cookie / bypassed FE check) — same prompt, nothing persisted.
        setPromptText(reason);
        // Re-sync who-am-I so the rest of the UI reflects the now-anonymous truth.
        void auth.refresh();
      } else if (err instanceof AuthError && err.code === 'auth_unavailable') {
        setPromptText(AUTH_COPY.gate.unavailable);
      } else {
        throw err; // a non-auth fault belongs to the caller's existing handling
      }
    }
  }, [auth]);

  return { allowed, promptText, prompt, signIn, clear, guard, simTradeGate };
}
