/**
 * AccountControl — the AppShell top-right account affordance (UX_BLUEPRINT §2.1, README §1).
 * Reflects who-am-I:
 *  - loading: a neutral muted placeholder (the rest of the app renders normally — no blocking spinner).
 *  - unauthenticated (incl. subsystem-degraded): a `Sign in` control opening the AuthDialog.
 *  - authenticated: the **email** (secondary) + a **32px gradient avatar** that is a RouterLink to
 *    `/settings` (clicking the profile opens Settings). NO dropdown menu — log out moved onto the
 *    Settings Account panel (convexa-redesign Figma `4:2572`).
 *
 * The degraded state is treated as unauthenticated (shows `Sign in`); the "couldn't reach sign-in"
 * copy surfaces only on submit / on a gated action — never here, and never on the trader path.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AVATAR_SX, avatarInitial } from './avatar';

export function AccountControl() {
  const auth = useAuth();
  const { openAuth } = useAuthDialog();

  if (!auth.ready) {
    return <Skeleton variant="rounded" width={88} height={32} data-testid="account-loading" />;
  }

  if (!auth.authenticated) {
    // Custom login/sign-up control: a ghost "Log in" + a flat contained-primary "Sign up" pill,
    // both opening the shared AuthDialog (login vs signup mode). Stage-3 §5.1: the gradient fill
    // retired with `brandGradient` — flat `primary.main` + `primary.contrastText` fixes the
    // measured-broken white-on-amber label; radius/hover lift/glow stay, reduced-motion safe.
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button
          size="small"
          variant="text"
          onClick={() => openAuth({ mode: 'login' })}
          data-testid="account-signin"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            '&:hover': { color: 'text.primary' },
          }}
        >
          Log in
        </Button>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={() => openAuth({ mode: 'signup' })}
          data-testid="account-signup"
          sx={{
            whiteSpace: 'nowrap',
            borderRadius: 999,
            px: 2,
            transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
            '&:hover': {
              transform: 'translateY(-1px)',
              filter: 'brightness(1.06)',
              // Hover glow stays a mode-aware primary tint (an accent on the brand action).
              boxShadow: (theme) => `0 8px 22px -8px ${alpha(theme.palette.primary.main, 0.6)}`,
            },
            '@media (prefers-reduced-motion: reduce)': { '&:hover': { transform: 'none' } },
          }}
        >
          Sign up
        </Button>
      </Stack>
    );
  }

  // Signed-in: the email (secondary, hidden < sm to save space) + a 32px brand-amber avatar that
  // links to /settings. No dropdown menu — log out now lives on the Settings Account panel.
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <Typography
        variant="body2"
        noWrap
        data-testid="account-email"
        sx={{
          color: 'text.secondary',
          maxWidth: 220,
          lineHeight: 1,
          display: { xs: 'none', sm: 'block' },
        }}
      >
        {auth.user?.email}
      </Typography>
      <Box
        component={RouterLink}
        to="/settings"
        aria-label="Account settings"
        data-testid="account-avatar"
        sx={{ ...AVATAR_SX, textDecoration: 'none' }}
      >
        {avatarInitial(auth.user)}
      </Box>
    </Stack>
  );
}
