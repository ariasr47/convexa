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
  Dialog, DialogContent, Stack, TextField, Button, Alert, Link, Divider, Box, IconButton, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset transient state whenever the dialog opens or the mode flips (never carry a password over).
  useEffect(() => {
    if (open) { setPassword(''); setErrors({}); setSubmitting(false); }
  }, [open, mode]);

  const c = mode === 'signup' ? AUTH_COPY.signup : AUTH_COPY.login;
  // Title matches the Figma AuthModal ("Welcome back" on login; the copy source's `login.title`
  // is the button/account label "Sign in"). Subtitle per the Figma.
  const title = mode === 'signup' ? AUTH_COPY.signup.title : 'Welcome back';
  const subtitle =
    mode === 'signup'
      ? 'Save personas, sync settings, and unlock AI reads.'
      : 'Sign in to sync your settings and AI key.';

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
        // Display name is set later on the full-page /auth surface; the modal is email + password.
        await auth.signUp({ email: email.trim(), password, display_name: null });
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
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      data-testid="auth-dialog"
      slotProps={{
        // Elevated slate card (raised above the page) + crisp border + dialog shadow, per the Figma.
        paper: {
          sx: {
            borderRadius: 2.5,
            border: 1,
            borderColor: 'divider',
            backgroundImage: 'none',
            bgcolor: '#1c2330', // panel-raised (tokens.extras.panelRaised) — lighter than the page
          },
        },
        backdrop: { sx: { backdropFilter: 'blur(4px)', backgroundColor: 'rgba(8, 11, 16, 0.66)' } },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Box component="form" onSubmit={submit} noValidate>
          <Stack spacing={2}>
            {/* Header — bold title + subtitle + close, per the Figma AuthModal. */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }} data-testid="auth-dialog-title">
                  {title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {subtitle}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close"
                data-testid="auth-close"
                sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            {reason && <Alert severity="info" data-testid="auth-reason">{reason}</Alert>}
            {errors.form && (
              <Alert severity={mode === 'login' ? 'error' : 'warning'} data-testid="auth-form-error">
                {errors.form}
              </Alert>
            )}

            {/* Uppercase standalone label + bordered input with placeholder (Figma AuthModal). */}
            <Box>
              <Typography
                component="label"
                htmlFor="auth-email-input"
                sx={{ display: 'block', mb: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.secondary' }}
              >
                {c.email}
              </Typography>
              <TextField
                id="auth-email-input"
                hiddenLabel
                size="small"
                placeholder="you@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
                disabled={submitting}
                required
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.default' } }}
                slotProps={{ htmlInput: { 'data-testid': 'auth-email' } }}
              />
            </Box>
            <Box>
              <Typography
                component="label"
                htmlFor="auth-password-input"
                sx={{ display: 'block', mb: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.secondary' }}
              >
                {c.password}
              </Typography>
              <TextField
                id="auth-password-input"
                hiddenLabel
                size="small"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errors.password}
                helperText={errors.password}
                disabled={submitting}
                required
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.default' } }}
                slotProps={{ htmlInput: { 'data-testid': 'auth-password' } }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disableElevation
              disabled={submitting}
              data-testid="auth-submit"
            >
              {submitting ? c.submitting : c.submit}
            </Button>

            <Divider flexItem>or</Divider>
            <GoogleButton available={auth.googleAvailable} />

            <Link
              component="button"
              type="button"
              onClick={() => onModeChange(mode === 'signup' ? 'login' : 'signup')}
              data-testid="auth-mode-switch"
              sx={{ alignSelf: 'center', fontWeight: 600 }}
            >
              {mode === 'signup' ? AUTH_COPY.signup.switch : AUTH_COPY.login.switch}
            </Link>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
