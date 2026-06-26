/**
 * AuthDialog — the sign-up + log-in surface (UX_BLUEPRINT §2.2/§2.3). A single dialog that toggles
 * between `login` and `signup` mode; both embed the Google control (§2.4). Drives every component
 * state from the contract: default / loading / duplicate-email(signup) / bad-credentials(login,
 * NON-ENUMERATING) / validation / auth-unavailable / success.
 *
 * Security floor (AC-H1): the password field is masked and the password is NEVER echoed back into
 * any error/state. Errors are mapped off the server `error` CODE (never a leaked detail).
 *
 * On success the dialog closes and (when opened from a gated action) `onSuccess` fires so the caller
 * can return the user to the surface with the action now available (AC-C1/D6c).
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Stack, TextField, Button, Alert, Link, Divider, Box,
} from '@mui/material';
import { AuthError } from '@org/api';
import { useAuth } from './AuthContext';
import { AUTH_COPY } from './copy';
import { GoogleButton } from './GoogleButton';
import { isLikelyEmail, validationFieldCopy } from './validation';

export type AuthMode = 'login' | 'signup';

interface Props {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (m: AuthMode) => void;
  /** Fires AFTER a successful sign-in/sign-up (return-to-gated-action; AC-C1/D6c). */
  onSuccess?: () => void;
  /** Optional in-context reason line shown at the top of the dialog (e.g. the gated-action prompt). */
  reason?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
  form?: string; // non-field banner (bad-credentials / auth-unavailable / duplicate-email)
}

export function AuthDialog({ open, mode, onClose, onModeChange, onSuccess, reason }: Props) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset transient state whenever the dialog opens or the mode flips (never carry a password over).
  useEffect(() => {
    if (open) { setPassword(''); setErrors({}); setSubmitting(false); }
  }, [open, mode]);

  const c = mode === 'signup' ? AUTH_COPY.signup : AUTH_COPY.login;

  const mapError = (err: unknown): FieldErrors => {
    if (err instanceof AuthError) {
      switch (err.code) {
        case 'email_taken':
          return { email: AUTH_COPY.signup.emailTaken };
        case 'bad_credentials':
          // NON-ENUMERATING — fixed copy, identical for wrong-email and wrong-password.
          return { form: AUTH_COPY.login.badCredentials };
        case 'validation': {
          const v = validationFieldCopy(err.message);
          return { [v.field]: v.copy };
        }
        case 'auth_unavailable':
        default:
          return { form: c.unavailable };
      }
    }
    // Any non-AuthError (shouldn't happen) ⇒ the safe degraded banner.
    return { form: c.unavailable };
  };

  const clientValidate = (): FieldErrors | null => {
    const e: FieldErrors = {};
    if (!isLikelyEmail(email)) e.email = c.invalidEmail;
    if (mode === 'login' && password.length === 0) e.password = AUTH_COPY.login.emptyPassword;
    return Object.keys(e).length ? e : null;
  };

  const submit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    const ce = clientValidate();
    if (ce) { setErrors(ce); return; }
    setErrors({});
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await auth.signUp({ email: email.trim(), password, display_name: displayName.trim() || null });
      } else {
        await auth.signIn({ email: email.trim(), password });
      }
      // Success — never retain the password; close + notify.
      setPassword('');
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrors(mapError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth
      data-testid="auth-dialog">
      <DialogTitle data-testid="auth-dialog-title">
        {mode === 'signup' ? AUTH_COPY.signup.title : AUTH_COPY.login.title}
      </DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={submit} noValidate>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {reason && <Alert severity="info" data-testid="auth-reason">{reason}</Alert>}
            {errors.form && (
              <Alert severity={mode === 'login' ? 'error' : 'warning'} data-testid="auth-form-error">
                {errors.form}
              </Alert>
            )}

            <TextField
              label={c.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!errors.email}
              helperText={errors.email}
              disabled={submitting}
              required
              fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'auth-email' } }}
            />
            <TextField
              label={c.password}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!errors.password}
              helperText={errors.password}
              disabled={submitting}
              required
              fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'auth-password' } }}
            />
            {mode === 'signup' && (
              <TextField
                label={AUTH_COPY.signup.displayName}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={submitting}
                fullWidth
                slotProps={{ htmlInput: { 'data-testid': 'auth-display-name' } }}
              />
            )}

            <Button type="submit" variant="contained" disabled={submitting} data-testid="auth-submit">
              {submitting ? c.submitting : c.submit}
            </Button>

            <Divider flexItem>or</Divider>
            <GoogleButton available={auth.googleAvailable} />

            <Link
              component="button"
              type="button"
              onClick={() => onModeChange(mode === 'signup' ? 'login' : 'signup')}
              data-testid="auth-mode-switch"
              sx={{ alignSelf: 'flex-start' }}
            >
              {mode === 'signup' ? AUTH_COPY.signup.switch : AUTH_COPY.login.switch}
            </Link>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
