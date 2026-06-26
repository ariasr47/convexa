/**
 * AuthDialogProvider — owns the SINGLE shared AuthDialog instance + a `useAuthDialog()` opener, so any
 * surface (the account control, a Positions write, the Ask-AI control) can pop the sign-in surface
 * in-context with a reason line and a return-to-action callback (UX_BLUEPRINT §2.6/§2.7, D6c).
 *
 * This is pure UX wiring; the auth STATE lives in AuthContext. Mount this INSIDE AuthProvider.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AuthDialog, type AuthMode } from './AuthDialog';

interface OpenOpts {
  mode?: AuthMode;
  /** In-context reason line at the top of the dialog (e.g. the gated-action prompt copy). */
  reason?: string;
  /** Fires after a successful sign-in/sign-up (return the user to the action; AC-C1/D6c). */
  onSuccess?: () => void;
}

interface AuthDialogApi {
  openAuth: (opts?: OpenOpts) => void;
  closeAuth: () => void;
}

const Ctx = createContext<AuthDialogApi | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [reason, setReason] = useState<string | undefined>();
  const [onSuccess, setOnSuccess] = useState<(() => void) | undefined>(undefined);

  const openAuth = useCallback((opts: OpenOpts = {}) => {
    setMode(opts.mode ?? 'login');
    setReason(opts.reason);
    // Wrap in a fn so React doesn't call the callback as a state updater.
    setOnSuccess(() => opts.onSuccess);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openAuth, closeAuth }}>
      {children}
      <AuthDialog
        open={open}
        mode={mode}
        reason={reason}
        onClose={closeAuth}
        onModeChange={setMode}
        onSuccess={() => { onSuccess?.(); }}
      />
    </Ctx.Provider>
  );
}

export function useAuthDialog(): AuthDialogApi {
  const ctx = useContext(Ctx);
  // A no-op stub when used outside the provider (keeps isolated renders from crashing).
  return ctx ?? { openAuth: () => undefined, closeAuth: () => undefined };
}
