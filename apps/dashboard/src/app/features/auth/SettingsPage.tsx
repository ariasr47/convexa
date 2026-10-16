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
import { usePersona } from '@/features/personas/usePersona';
import { DisclaimerCopy } from '@/shared/copy/disclaimer';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { dataMode, resetDemoWorkspace, type ThemePref } from '@convexa/api';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AiKeySection } from './AiKeySection';
import { useAuth } from './AuthContext';
import { useAuthDialog } from './AuthDialogProvider';
import { AVATAR_SX, avatarInitial } from './avatar';
import { BrokerageSection } from './BrokerageSection';
import { AUTH_COPY, RISK_INPUTS_COPY, SETTINGS_DEFAULTS } from './copy';
import { RiskInputsSection } from './RiskInputsSection';
import { useSettings } from './useSettings';

const C = AUTH_COPY.settings;

/** A `background.paper` panel card — rounded `card` radius, 1px `divider` border, ~24 padding. */
function PanelCard({
  heading,
  children,
  testId,
  tag,
}: {
  heading: string;
  children: React.ReactNode;
  testId?: string;
  /** The panel's status tag (canon P-2): where its data lives, or what it needs. */
  tag?: PanelTag;
}) {
  return (
    <Card
      variant="outlined"
      data-testid={testId}
      sx={{ bgcolor: 'background.paper', borderColor: 'divider', borderRadius: 1, p: 3 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 2,
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem' }}>{heading}</Typography>
        {tag && (
          <Box component="span" data-testid={testId ? `${testId}-tag` : undefined}>
            <DataStateTag state={tag.state} label={tag.label} />
          </Box>
        )}
      </Box>
      {children}
    </Card>
  );
}

type PanelTag = { state: DataStateKey; label?: string };
type PanelKey = 'account' | 'preferences' | 'risk' | 'ai' | 'brokerage';

/** Each panel's status tag (design/src/screens/final/account-pages.mjs settingsStaging /
 *  settingsProduction): the demo account, Stored here for what this browser or the account keeps,
 *  Sign in for what a signed-out visitor can't use, Read-only sample for the demo's AI and broker. */
function panelTags(mode: 'demo' | 'signedIn' | 'signedOut'): Partial<Record<PanelKey, PanelTag>> {
  const stored: PanelTag = { state: 'local' };
  if (mode === 'demo')
    return {
      account: { state: 'demo' },
      risk: stored,
      ai: { state: 'sample', label: 'Read-only sample' },
      brokerage: { state: 'sample', label: 'Read-only sample' },
    };
  if (mode === 'signedOut')
    return {
      account: { state: 'signIn' },
      preferences: stored,
      risk: { state: 'signIn' },
      ai: { state: 'signIn' },
      brokerage: { state: 'signIn' },
    };
  return { preferences: stored, risk: stored };
}

/** Uppercase field label (11px, 700, letter-spacing, secondary) — matches the auth modal. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'text.secondary',
        mb: 0.75,
      }}
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
  const { hash } = useLocation();

  // Deep-links: Broker tab → `#brokerage`; Ask-AI Settings CTA → `#ai-key` / `#ai-providers`.
  // Guarded: jsdom has no scrollIntoView.
  useEffect(() => {
    const id =
      hash === '#brokerage'
        ? 'brokerage'
        : hash === '#ai-key' || hash === '#ai-providers'
          ? 'ai-key'
          : null;
    if (!id) return;
    document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

  // Keep the ticker text field synced to the effective value when it changes from outside
  // (e.g. who-am-I resolves, or an account switch). Server-wins, so the field never overwrites it.
  useEffect(() => {
    setTickerDraft(settings.effective.defaultTicker);
  }, [settings.effective.defaultTicker]);

  // Surface the quiet "Saved" toast on a successful server write (signed-in only).
  const flashSaved = () => {
    if (settings.serverBacked) setSavedOpen(true);
  };

  // Persona options mirror the existing persona picker.
  const personaOptions = [
    { id: 'default', name: 'Default (no persona)' },
    ...persona.presets.filter((p) => p.id !== 'default').map((p) => ({ id: p.id, name: p.name })),
    ...persona.customs.map((p) => ({ id: p.id, name: p.name })),
  ];

  // curvature-v2-surfaces criterion 40 (SB): a failed write is non-blocking, reverts the control to
  // its last known value, and shows NO confirmation. `useSettings.writeServer` now re-throws on
  // failure (mirroring `setRiskInputs`'s own idiom) precisely so this closure can tell success from
  // failure — `settings.saveError` is read from a stale render closure and cannot be trusted here.
  const onPersona = async (id: string) => {
    try {
      await settings.setPersona(id);
      flashSaved();
    } catch {
      // settings.saveError already reflects the failure (the error Alert renders from it); the
      // Select is a pure reflection of settings.effective.personaId, which never moved.
    }
  };
  const onTheme = async (t: ThemePref) => {
    try {
      await settings.setTheme(t);
      flashSaved();
    } catch {
      // Same as above — the ToggleButtonGroup reflects settings.effective.theme, which never moved.
    }
  };
  const commitTicker = async () => {
    const norm = tickerDraft.trim() ? tickerDraft.trim().toUpperCase() : SETTINGS_DEFAULTS.ticker;
    try {
      await settings.setDefaultTicker(norm);
      setTickerDraft(norm);
      flashSaved();
    } catch {
      // Reverts the draft to the last CONFIRMED value — never left showing text that failed to save.
      setTickerDraft(settings.effective.defaultTicker);
    }
  };

  // Show the display name when set; otherwise the email is the single primary line (don't repeat it
  // as a secondary line — that read as duplicated for accounts with no display name).
  const displayName = auth.user?.display_name?.trim();
  const hasDisplayName = !!displayName;
  const primaryName = displayName || auth.user?.email || '';

  const tags = panelTags(
    dataMode === 'demo' ? 'demo' : auth.authenticated ? 'signedIn' : 'signedOut',
  );

  return (
    // design/src/screens/settings.mjs:5 — `minmax(0, 760px)` content column; the section rail
    // (`:28`) is DEFERRED by owner ruling D-B (council/decisions.md) and stays out of scope here.
    <Container maxWidth="sm" sx={{ py: 4, maxWidth: 760 }} data-testid="settings-page">
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h1" sx={{ fontSize: '1.9rem', fontWeight: 700 }}>
          {C.title}
        </Typography>
        {/* Honest, mode-aware subtitle (redesign-stage-0 §4.1): anonymous prefs are client-local —
            never claim account persistence for a signed-out user. */}
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {dataMode === 'demo'
            ? "Saved in this browser's demo workspace."
            : auth.authenticated
              ? C.subtitleSignedIn
              : C.subtitleAnonymous}
        </Typography>
      </Stack>

      <Stack spacing={3}>
        {/* ===== 1. Account panel — display + Sign out (log out now lives here) ===== */}
        <PanelCard heading={C.accountHeading} tag={tags.account} testId="settings-account-panel">
          {dataMode === 'demo' ? (
            // Always signed in to the seed demo account (owner, 2026-10-14). In place of sign-out,
            // a reset puts the seed account back.
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              data-testid="settings-account-demo"
            >
              <Box sx={AVATAR_SX} aria-hidden>
                {avatarInitial(auth.user)}
              </Box>
              {/* 200px floor: on a phone the reset button drops below instead of squeezing this. */}
              <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {auth.user?.display_name ?? 'Demo account'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Sample data. Your changes stay in this browser until you reset.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                data-testid="settings-demo-reset"
                onClick={resetDemoWorkspace}
                sx={{ flex: 'none' }}
              >
                Reset demo data
              </Button>
            </Stack>
          ) : auth.authenticated ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center' }}
              data-testid="settings-account-signed-in"
            >
              <Box sx={AVATAR_SX} aria-hidden>
                {avatarInitial(auth.user)}
              </Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {primaryName}
                </Typography>
                {hasDisplayName && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    {auth.user?.email}
                  </Typography>
                )}
              </Box>
              <Button
                variant="outlined"
                size="small"
                data-testid="settings-signout"
                onClick={() => {
                  void auth.signOut();
                }}
              >
                {C.signOut}
              </Button>
            </Stack>
          ) : (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              data-testid="settings-account-signed-out"
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {C.accountSignedOutPrompt}
              </Typography>
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

        {/* ===== 2. Preferences panel — appearance only (score-neutral) =====
            Panel order (tradeable-rec-inputs, PLAN.md reconciliation): Account → Preferences →
            Risk inputs → AI key → Brokerage. A trader input (Risk inputs) must not be grouped with
            credentials (AI key / Brokerage) — Preferences moves above AI key to make room for it. */}
        <PanelCard
          heading={C.preferencesHeading}
          tag={tags.preferences}
          testId="settings-preferences-panel"
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {C.themeHelper}
          </Typography>

          {/* U-19: one line while the session is still resolving, removed the instant it resolves —
              `auth.ready === false` otherwise freezes these three controls with no explanation. */}
          {!auth.ready && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mb: 2 }}
              data-testid="settings-session-resolving"
            >
              {C.sessionResolving}
            </Typography>
          )}

          <Stack spacing={2.5}>
            {/* Active persona + Default ticker side by side ≥ tablet (768px, theme.ts:91 — the
                design's own breakpoint, design/src/screens/settings.mjs:37-40, `.set-2`). Stacked
                below, exactly as shipped. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', tablet: '1fr 1fr' },
                gap: '16px',
              }}
            >
              {/* Active persona */}
              <Box>
                <FieldLabel>{C.activePersona}</FieldLabel>
                <FormControl fullWidth size="small">
                  <InputLabel id="settings-persona-label" sx={{ display: 'none' }}>
                    {C.activePersona}
                  </InputLabel>
                  <Select
                    labelId="settings-persona-label"
                    aria-label={C.activePersona}
                    value={settings.effective.personaId}
                    onChange={(e) => onPersona(String(e.target.value))}
                    disabled={!auth.ready}
                    inputProps={{ 'data-testid': 'settings-persona' }}
                    // GATE Z, finding 3 (criterion 66): MUI `Select` self-duplicates its own class
                    // (`&.${selectClasses.select}`, `Select/SelectInput.js`) to "win specificity
                    // over the input base" at (0,2,0) — `theme.ts`'s coarse-pointer floor (a bare
                    // `[role="combobox"]`, (0,1,0)) cannot reach it; a scoped `sx` descendant
                    // selector tied at (0,2,0) loses too (confirmed by measuring computed
                    // `min-height` in a real browser). Doubling the same class here reaches
                    // (0,3,0), which wins unconditionally.
                    sx={{
                      '@media (pointer: coarse)': {
                        '& .MuiSelect-select.MuiSelect-select': { minHeight: 44 },
                      },
                    }}
                  >
                    {personaOptions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Default ticker */}
              <Box>
                <FieldLabel>{C.defaultTicker}</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  helperText={C.defaultTickerHelper}
                  value={tickerDraft}
                  onChange={(e) => setTickerDraft(e.target.value)}
                  onBlur={commitTicker}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitTicker();
                    }
                  }}
                  disabled={!auth.ready}
                  slotProps={{
                    htmlInput: { 'aria-label': C.defaultTicker, 'data-testid': 'settings-ticker' },
                  }}
                />
              </Box>
            </Box>

            {/* Theme — segmented control (Dark / Light / System) */}
            <Box>
              <FieldLabel>{C.theme}</FieldLabel>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={settings.effective.theme}
                disabled={!auth.ready}
                onChange={(_e, v) => {
                  if (v) void onTheme(v as ThemePref);
                }}
                aria-label={C.theme}
                data-testid="settings-theme"
                sx={{
                  // Three equal, spaced, OUTLINED tiles, not MUI's connected/filled toggle group.
                  // Active = phosphor label, steel outline and a neutral tint: amber is spent on
                  // the screen's one contained primary (owner ruling A, 2026-10-15; the Final
                  // Settings board draws these tiles neutral).
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
                    '&:not(:first-of-type)': {
                      ml: 0,
                      borderLeft: '1px solid',
                      borderColor: 'divider',
                    },
                    '&.Mui-selected': {
                      color: 'text.primary',
                      borderColor: 'text.secondary',
                      bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
                    },
                    '&.Mui-selected:hover': {
                      bgcolor: (theme) => alpha(theme.palette.text.primary, 0.12),
                    },
                    '&:not(:first-of-type).Mui-selected': { borderColor: 'text.secondary' },
                  },
                }}
              >
                <ToggleButton value="dark" data-testid="settings-theme-dark" sx={{ gap: '8px' }}>
                  <DarkModeOutlinedIcon fontSize="small" aria-hidden />
                  {C.themeDark}
                </ToggleButton>
                <ToggleButton value="light" data-testid="settings-theme-light" sx={{ gap: '8px' }}>
                  <LightModeOutlinedIcon fontSize="small" aria-hidden />
                  {C.themeLight}
                </ToggleButton>
                <ToggleButton
                  value="system"
                  data-testid="settings-theme-system"
                  sx={{ gap: '8px' }}
                >
                  <SettingsBrightnessOutlinedIcon fontSize="small" aria-hidden />
                  {C.themeSystem}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>

          {settings.saveError && (
            <Alert
              severity="error"
              onClose={settings.clearSaveError}
              data-testid="settings-save-error"
              sx={{ mt: 2 }}
            >
              {C.saveError}
            </Alert>
          )}
        </PanelCard>

        {/* ===== 3. Risk inputs panel (tradeable-rec-inputs) — a trader input, not a credential ===== */}
        <PanelCard
          heading={RISK_INPUTS_COPY.heading}
          tag={tags.risk}
          testId="settings-risk-inputs-panel"
        >
          <RiskInputsSection />
        </PanelCard>

        {/* ===== 4. AI providers panel (ai-providers — keep #ai-key for Ask-AI deep-link) ===== */}
        <PanelCard heading={C.aiKey.heading} tag={tags.ai} testId="settings-ai-key-panel">
          <AiKeySection embedded />
        </PanelCard>

        {/* ===== 5. Brokerage panel (broker-connect — the byo-ai-key shape; #brokerage anchor) ===== */}
        <PanelCard
          heading={C.brokerage.heading}
          tag={tags.brokerage}
          testId="settings-brokerage-panel"
        >
          <BrokerageSection embedded />
        </PanelCard>

        {/* The standing disclaimer — ONE shared source with the site footer, so the two copies
            cannot drift again (they already had; see `shared/copy/disclaimer.tsx`). */}
        <Typography
          variant="caption"
          data-testid="settings-disclaimer"
          sx={{ color: 'text.secondary', mt: 1 }}
        >
          <DisclaimerCopy />
        </Typography>
      </Stack>

      <Snackbar
        open={savedOpen}
        autoHideDuration={2000}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* curvature-v2-surfaces criterion 41 (SB): the confirmation is neutral chrome — it keeps the
            word it ships with and loses the direction-reserved success palette. An error is a STATE
            (the settings-save-error Alert above keeps severity="error" and its icon, unchanged). */}
        <Alert severity="info" data-testid="settings-saved">
          {C.saved}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default SettingsPage;
