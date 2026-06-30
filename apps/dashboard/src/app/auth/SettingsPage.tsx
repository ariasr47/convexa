/**
 * SettingsPage — the account + 3 light prefs surface (UX_BLUEPRINT §2.9, AC-F1/F2/F3/F4; convexa-
 * redesign Figma `4:2572`). Reachable from the nav gradient avatar when signed in (and viewable
 * anonymously — it just falls back to client-local).
 *
 * Layout (re-skin): a centered max-width ~640 column — "Settings" heading + "Tuned to your account."
 * subtitle, then three stacked `background.paper` panel cards (Account / AI key / Preferences) with
 * uppercase field labels, and the Landing disclaimer caption in the footer.
 *
 *  - signed in (server-wins): each control is pre-set to the SERVER value (null ⇒ app default); a
 *    change writes through to the server (the carried settings update; AC-F1). Save shows a quiet
 *    "Saved"; a failure shows a non-blocking error and the control reverts (UX_BLUEPRINT §2.9).
 *  - anonymous: the client-local stores are the source of truth — exactly as today (AC-A3/F3).
 *
 * Log out now lives HERE (the Account panel "Sign out") — it was removed from the nav.
 *
 * SCORE-NEUTRAL (AC-F4): nothing here is wired into any bundle/score path; the helper copy reinforces
 * it ("Affects appearance only."). Theme/persona/ticker are never scoring inputs.
 */
import { useEffect, useState } from 'react';
import {
  Container, Stack, Typography, FormControl, InputLabel, Select, MenuItem, TextField,
  Snackbar, Alert, Box, Button, Card, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import type { ThemePref } from '@org/api';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { useSettings } from './useSettings';
import { usePersona } from '../personas/usePersona';
import { AUTH_COPY, SETTINGS_DEFAULTS } from './copy';
import { AiKeySection } from './AiKeySection';
import { avatarInitial, GRADIENT_AVATAR_SX } from './avatar';

const C = AUTH_COPY.settings;

/** A `background.paper` panel card — rounded `card` radius, 1px `divider` border, ~24 padding. */
function PanelCard({ heading, children, testId }: {
  heading: string; children: React.ReactNode; testId?: string;
}) {
  return (
    <Card
      variant="outlined"
      data-testid={testId}
      sx={{ bgcolor: 'background.paper', borderColor: 'divider', borderRadius: 2.5, p: 3 }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', mb: 2 }}>{heading}</Typography>
      {children}
    </Card>
  );
}

/** Uppercase field label (11px, 700, letter-spacing, secondary) — matches the auth modal. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

export function SettingsPage() {
  const auth = useAuth();
  const { openAuth } = useAuthDialog();
  const settings = useSettings();
  const persona = usePersona();
  const [tickerDraft, setTickerDraft] = useState(settings.effective.defaultTicker);
  const [savedOpen, setSavedOpen] = useState(false);

  // Keep the ticker text field synced to the effective value when it changes from outside
  // (e.g. who-am-I resolves, or an account switch). Server-wins, so the field never overwrites it.
  useEffect(() => { setTickerDraft(settings.effective.defaultTicker); }, [settings.effective.defaultTicker]);

  // Surface the quiet "Saved" toast on a successful server write (signed-in only).
  const flashSaved = () => { if (settings.serverBacked) setSavedOpen(true); };

  // Persona options mirror the existing persona picker.
  const personaOptions = [
    { id: 'default', name: 'Default (no persona)' },
    ...persona.presets.filter((p) => p.id !== 'default').map((p) => ({ id: p.id, name: p.name })),
    ...persona.customs.map((p) => ({ id: p.id, name: p.name })),
  ];

  const onPersona = async (id: string) => { await settings.setPersona(id); flashSaved(); };
  const onTheme = async (t: ThemePref) => { await settings.setTheme(t); flashSaved(); };
  const commitTicker = async () => {
    const norm = tickerDraft.trim() ? tickerDraft.trim().toUpperCase() : SETTINGS_DEFAULTS.ticker;
    setTickerDraft(norm);
    await settings.setDefaultTicker(norm);
    flashSaved();
  };

  // Show the display name when set; otherwise the email is the single primary line (don't repeat it
  // as a secondary line — that read as duplicated for accounts with no display name).
  const hasDisplayName = !!auth.user?.display_name?.trim();
  const primaryName = hasDisplayName ? auth.user!.display_name!.trim() : auth.user?.email || '';

  return (
    <Container maxWidth="sm" sx={{ py: 4, maxWidth: 640 }} data-testid="settings-page">
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h1" sx={{ fontSize: '1.9rem', fontWeight: 700 }}>{C.title}</Typography>
        <Typography variant="body2" color="text.secondary">{C.subtitle}</Typography>
      </Stack>

      <Stack spacing={3}>
        {/* ===== 1. Account panel — display + Sign out (log out now lives here) ===== */}
        <PanelCard heading={C.accountHeading} testId="settings-account-panel">
          {auth.authenticated ? (
            <Stack direction="row" spacing={2} alignItems="center" data-testid="settings-account-signed-in">
              <Box sx={GRADIENT_AVATAR_SX} aria-hidden>{avatarInitial(auth.user)}</Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>{primaryName}</Typography>
                {hasDisplayName && (
                  <Typography variant="body2" color="text.secondary" noWrap>{auth.user?.email}</Typography>
                )}
              </Box>
              <Button
                variant="outlined"
                size="small"
                data-testid="settings-signout"
                onClick={() => { void auth.signOut(); }}
              >
                {C.signOut}
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between"
              data-testid="settings-account-signed-out">
              <Typography variant="body2" color="text.secondary">{C.accountSignedOutPrompt}</Typography>
              <Button
                variant="contained"
                size="small"
                disableElevation
                data-testid="settings-signin"
                onClick={() => openAuth({ mode: 'login' })}
              >
                {C.signIn}
              </Button>
            </Stack>
          )}
        </PanelCard>

        {/* ===== 2. AI key panel (re-skin only; all logic + testids + the security floor preserved) ===== */}
        <PanelCard heading={C.aiKey.heading} testId="settings-ai-key-panel">
          <AiKeySection embedded />
        </PanelCard>

        {/* ===== 3. Preferences panel — appearance only (score-neutral) ===== */}
        <PanelCard heading={C.preferencesHeading} testId="settings-preferences-panel">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{C.themeHelper}</Typography>

          <Stack spacing={2.5}>
            {/* Active persona */}
            <Box>
              <FieldLabel>{C.activePersona}</FieldLabel>
              <FormControl fullWidth size="small">
                <InputLabel id="settings-persona-label" sx={{ display: 'none' }}>{C.activePersona}</InputLabel>
                <Select
                  labelId="settings-persona-label"
                  aria-label={C.activePersona}
                  value={settings.effective.personaId}
                  onChange={(e) => onPersona(String(e.target.value))}
                  disabled={!auth.ready}
                  inputProps={{ 'data-testid': 'settings-persona' }}
                >
                  {personaOptions.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            {/* Default ticker */}
            <Box>
              <FieldLabel>{C.defaultTicker}</FieldLabel>
              <TextField
                fullWidth
                size="small"
                aria-label={C.defaultTicker}
                helperText={C.defaultTickerHelper}
                value={tickerDraft}
                onChange={(e) => setTickerDraft(e.target.value)}
                onBlur={commitTicker}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commitTicker(); } }}
                disabled={!auth.ready}
                slotProps={{ htmlInput: { 'data-testid': 'settings-ticker' } }}
              />
            </Box>

            {/* Theme — segmented control (Dark / Light / System) */}
            <Box>
              <FieldLabel>{C.theme}</FieldLabel>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={settings.effective.theme}
                disabled={!auth.ready}
                onChange={(_e, v) => { if (v) void onTheme(v as ThemePref); }}
                aria-label={C.theme}
                data-testid="settings-theme"
                sx={{
                  // Three equal, spaced, OUTLINED buttons — active = primary outline + faint tint
                  // (Figma `4:2572`), not MUI's connected/filled toggle group.
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1,
                  width: '100%',
                  '& .MuiToggleButton-root': {
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px',
                    color: 'text.secondary',
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1,
                    '&:not(:first-of-type)': { ml: 0, borderLeft: '1px solid', borderColor: 'divider' },
                    '&.Mui-selected': {
                      color: 'primary.main',
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(79, 156, 255, 0.08)',
                    },
                    '&.Mui-selected:hover': { bgcolor: 'rgba(79, 156, 255, 0.12)' },
                    '&:not(:first-of-type).Mui-selected': { borderColor: 'primary.main' },
                  },
                }}
              >
                <ToggleButton value="dark" data-testid="settings-theme-dark">{C.themeDark}</ToggleButton>
                <ToggleButton value="light" data-testid="settings-theme-light">{C.themeLight}</ToggleButton>
                <ToggleButton value="system" data-testid="settings-theme-system">{C.themeSystem}</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>

          {settings.saveError && (
            <Alert severity="error" onClose={settings.clearSaveError} data-testid="settings-save-error" sx={{ mt: 2 }}>
              {C.saveError}
            </Alert>
          )}
        </PanelCard>

        {/* Footer disclaimer — reuse the Landing caption (verbatim). */}
        <Typography variant="caption" color="text.secondary" data-testid="settings-disclaimer" sx={{ mt: 1 }}>
          Convexa is an analysis tool. All positions and trades shown are <strong>simulated</strong>{' '}
          (paper). Not investment advice. No brokerage connection.
        </Typography>
      </Stack>

      <Snackbar
        open={savedOpen}
        autoHideDuration={2000}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" data-testid="settings-saved">{C.saved}</Alert>
      </Snackbar>
    </Container>
  );
}

export default SettingsPage;
