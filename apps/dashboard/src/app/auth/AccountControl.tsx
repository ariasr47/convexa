/**
 * AccountControl — the AppShell top-right account affordance (UX_BLUEPRINT §2.1). Reflects who-am-I:
 *  - loading: a neutral muted placeholder (the rest of the app renders normally — no blocking spinner).
 *  - unauthenticated (incl. subsystem-degraded): a `Sign in` control opening the AuthDialog.
 *  - authenticated: the display name (else email) with a menu: `Settings`, `Log out`.
 *
 * The degraded state is treated as unauthenticated (shows `Sign in`); the "couldn't reach sign-in"
 * copy surfaces only on submit / on a gated action — never here, and never on the trader path.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Menu, MenuItem, Skeleton, Box, Typography, Divider,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';

export function AccountControl() {
  const auth = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  if (!auth.ready) {
    return (
      <Skeleton variant="rounded" width={88} height={32} data-testid="account-loading" />
    );
  }

  if (!auth.authenticated) {
    return (
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        startIcon={<AccountCircleIcon />}
        onClick={() => openAuth({ mode: 'login' })}
        data-testid="account-signin"
      >
        {AUTH_COPY.account.signIn}
      </Button>
    );
  }

  const name = auth.user?.display_name || auth.user?.email || 'Account';

  return (
    <Box>
      <Button
        size="small"
        color="inherit"
        startIcon={<AccountCircleIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        data-testid="account-menu-button"
      >
        {name}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 0.5, maxWidth: 240 }}>
          <Typography variant="caption" color="text.secondary" noWrap data-testid="account-email">
            {auth.user?.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => { setAnchor(null); navigate('/settings'); }}
          data-testid="account-settings"
        >
          {AUTH_COPY.account.settings}
        </MenuItem>
        <MenuItem
          onClick={async () => { setAnchor(null); await auth.signOut(); }}
          data-testid="account-logout"
        >
          {AUTH_COPY.account.logOut}
        </MenuItem>
      </Menu>
    </Box>
  );
}
