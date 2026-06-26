/**
 * SettingsPage — the 3 light prefs surface (UX_BLUEPRINT §2.9, AC-F1/F2/F3/F4). Reachable from the
 * account menu when signed in (and viewable anonymously — it just falls back to client-local).
 *
 *  - signed in (server-wins): each control is pre-set to the SERVER value (null ⇒ app default); a
 *    change writes through to the server (the carried settings update; AC-F1). Save shows a quiet
 *    "Saved"; a failure shows a non-blocking error and the control reverts (UX_BLUEPRINT §2.9).
 *  - anonymous: the client-local stores are the source of truth — exactly as today (AC-A3/F3).
 *
 * SCORE-NEUTRAL (AC-F4): nothing here is wired into any bundle/score path; the helper copy reinforces
 * it ("Affects appearance only.").
 */
import { useEffect, useState } from 'react';
import {
  Container, Stack, Typography, FormControl, InputLabel, Select, MenuItem, TextField,
  Snackbar, Alert, Box, Chip,
} from '@mui/material';
import { useAuth } from './AuthContext';
import { useSettings } from './useSettings';
import { usePersona } from '../personas/usePersona';
import { AUTH_COPY, SETTINGS_DEFAULTS } from './copy';

export function SettingsPage() {
  const auth = useAuth();
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
  const onTheme = async (t: 'dark' | 'light' | 'system') => { await settings.setTheme(t); flashSaved(); };
  const commitTicker = async () => {
    const norm = tickerDraft.trim() ? tickerDraft.trim().toUpperCase() : SETTINGS_DEFAULTS.ticker;
    setTickerDraft(norm);
    await settings.setDefaultTicker(norm);
    flashSaved();
  };

  return (
    <Container maxWidth="sm" sx={{ py: 3 }} data-testid="settings-page">
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="h1">{AUTH_COPY.settings.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {auth.authenticated
            ? 'Saved to your account.'
            : 'Stored in this browser while you’re signed out.'}
        </Typography>
      </Stack>

      <Stack spacing={3}>
        {/* Active persona */}
        <FormControl fullWidth>
          <InputLabel id="settings-persona-label">{AUTH_COPY.settings.activePersona}</InputLabel>
          <Select
            labelId="settings-persona-label"
            label={AUTH_COPY.settings.activePersona}
            value={settings.effective.personaId}
            onChange={(e) => onPersona(String(e.target.value))}
            disabled={!auth.ready}
            inputProps={{ 'data-testid': 'settings-persona' }}
          >
            {personaOptions.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Default ticker */}
        <Box>
          <TextField
            fullWidth
            label={AUTH_COPY.settings.defaultTicker}
            helperText={AUTH_COPY.settings.defaultTickerHelper}
            value={tickerDraft}
            onChange={(e) => setTickerDraft(e.target.value)}
            onBlur={commitTicker}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commitTicker(); } }}
            disabled={!auth.ready}
            slotProps={{ htmlInput: { 'data-testid': 'settings-ticker' } }}
          />
        </Box>

        {/* Theme */}
        <FormControl fullWidth>
          <InputLabel id="settings-theme-label">{AUTH_COPY.settings.theme}</InputLabel>
          <Select
            labelId="settings-theme-label"
            label={AUTH_COPY.settings.theme}
            value={settings.effective.theme}
            onChange={(e) => onTheme(e.target.value as 'dark' | 'light' | 'system')}
            disabled={!auth.ready}
            inputProps={{ 'data-testid': 'settings-theme' }}
          >
            <MenuItem value="dark">{AUTH_COPY.settings.themeDark}</MenuItem>
            <MenuItem value="light">{AUTH_COPY.settings.themeLight}</MenuItem>
            <MenuItem value="system">{AUTH_COPY.settings.themeSystem}</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {AUTH_COPY.settings.themeHelper}
          </Typography>
        </FormControl>

        {settings.saveError && (
          <Alert
            severity="error"
            onClose={settings.clearSaveError}
            data-testid="settings-save-error"
          >
            {AUTH_COPY.settings.saveError}
          </Alert>
        )}

        {!auth.authenticated && (
          <Chip
            size="small"
            variant="outlined"
            label="Signed out — stored in this browser"
            data-testid="settings-anonymous"
            sx={{ alignSelf: 'flex-start' }}
          />
        )}
      </Stack>

      <Snackbar
        open={savedOpen}
        autoHideDuration={2000}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" data-testid="settings-saved">{AUTH_COPY.settings.saved}</Alert>
      </Snackbar>
    </Container>
  );
}

export default SettingsPage;
