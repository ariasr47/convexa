/**
 * RiskInputsSection — the Settings `Risk inputs` panel (tradeable-rec-inputs SPEC §4, PLAN F5).
 * Owner-entered account size + one per-trade cap (dollars or percent), server-side, per-user, behind
 * the server-enforced write gate (`[server-side-gate-enforcement]`) — a bypassed/absent client check
 * is still refused at the server (AC-24). Disclosed BEFORE the first save (AC-16): the egress
 * sentence is the section helper's first sentence, above BOTH fields, never a tooltip.
 *
 * Anonymous (AC-30): the section renders with `aria-disabled` + STILL-FOCUSABLE controls — never the
 * HTML `disabled` attribute, which would swallow pointer events and remove the reason from the
 * accessibility tree — plus the sign-in line. Nothing is written to any durable client store.
 */
import { faceFor } from '@/shared/figure';
import { downText } from '@/shared/theme/tokens';
import type { CapUnit } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { RISK_INPUTS_COPY as C, SETTINGS_DEFAULTS } from './copy';
import { formatAccountSize, formatAmount, validateAccountSize, validateCap } from './riskInputs';
import { useSettings } from './useSettings';

/** Field label, the Settings `.fld` label: 13px, 600, sentence case, primary text (fidelity audit
 *  2026-10-25, ACC-22; same as `SettingsPage.tsx`'s). */
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'text.primary', mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

/** One cell of the cap strip (the board's `.hd-fig`): an 11px caps label over its figure. */
function StripCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        p: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: 0,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1.3,
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** The shared look of the two figure inputs: the board's `.fld .in`, full width of its cell. */
const INPUT_SX = {
  ...faceFor(true),
  fontSize: 15,
  px: 1.25,
  py: 1,
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.default',
  color: 'text.primary',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
} as const;

export function RiskInputsSection() {
  const auth = useAuth();
  const settings = useSettings();
  const navigate = useNavigate();

  const stored = settings.riskInputs;
  const [accountDraft, setAccountDraft] = useState('');
  const [capDraft, setCapDraft] = useState('');
  const [capUnit, setCapUnit] = useState<CapUnit>('percent');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [capError, setCapError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);

  // Server-wins: seed the drafts from the stored value whenever it changes (never pre-populate `0`
  // for an unset field — `formatAmount(null)` is `''`). The account size reads "$25,000" as the
  // board draws it (site check D-23); saving reads that text back to the same stored number.
  useEffect(() => {
    setAccountDraft(formatAccountSize(stored?.account_size ?? null));
    setCapDraft(formatAmount(stored?.per_trade_cap?.value ?? null));
    setCapUnit(stored?.per_trade_cap?.unit ?? 'percent');
  }, [stored?.account_size, stored?.per_trade_cap?.value, stored?.per_trade_cap?.unit]);

  const anonymous = !auth.authenticated;
  const storageUnavailable = stored?.storage_available === false;

  const viewWhatsSent = () =>
    navigate(`/ticker/${settings.effective.defaultTicker || SETTINGS_DEFAULTS.ticker}`);

  async function save() {
    setAccountError(null);
    setCapError(null);
    setSaveError(false);
    const accountResult = validateAccountSize(accountDraft);
    if (!accountResult.ok) {
      setAccountError(accountResult.error);
      return; // refused LOCALLY — no network write occurs
    }
    const capResult = validateCap(capDraft, capUnit, accountResult.value);
    if (!capResult.ok) {
      setCapError(capResult.error);
      return; // refused LOCALLY — no network write occurs
    }
    setSaving(true);
    try {
      await settings.setRiskInputs({
        account_size: accountResult.value,
        per_trade_cap: capResult.value,
      });
      setSaved(true);
    } catch {
      setSaveError(true); // typed values STAY in the fields; never shows `Saved`
    } finally {
      setSaving(false);
    }
  }

  const notSet = !anonymous && stored != null && stored.state === 'not_set';

  return (
    <Box data-testid="settings-risk-inputs-section">
      {/* Section helper — egress sentence FIRST, above BOTH fields, never a tooltip (AC-16). */}
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', mb: 1.5 }}
        data-testid="risk-inputs-helper"
      >
        {C.helper}{' '}
        <Button
          size="small"
          onClick={viewWhatsSent}
          data-testid="risk-inputs-view-whats-sent"
          sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 500, color: 'info.main' }}
        >
          {C.viewWhatsSent} →
        </Button>
      </Typography>

      {anonymous && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="risk-inputs-anonymous">
          {C.anonymous}
        </Alert>
      )}
      {!anonymous && storageUnavailable && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="risk-inputs-storage-unavailable">
          {C.storageUnavailable}
        </Alert>
      )}

      <Stack spacing={1.5} aria-disabled={anonymous} data-testid="risk-inputs-form">
        {/* The two fields share the row equally and wrap under 220px each (the Final Settings
            board's risk grid, `repeat(auto-fit, minmax(min(220px, 100%), 1fr))`, 12px gap; fidelity
            audit 2026-10-25, SET): each field fills its cell. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
            gap: '12px',
            alignItems: 'start',
          }}
        >
          <Box sx={{ minWidth: 0 }} data-testid="risk-inputs-account-field">
            <FieldLabel>{C.accountSizeLabel}</FieldLabel>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box
                component="input"
                type="text"
                inputMode="decimal"
                aria-label={C.accountSizeLabel}
                aria-disabled={anonymous}
                disabled={saving}
                data-testid="risk-inputs-account-size"
                data-figure-register="mono"
                value={accountDraft}
                placeholder="not set"
                onChange={(e) => !anonymous && setAccountDraft(e.currentTarget.value)}
                sx={INPUT_SX}
              />
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {C.accountSizeHelper}
            </Typography>
            {accountError && (
              <Typography
                variant="caption"
                data-testid="risk-inputs-account-error"
                sx={{ display: 'block', mt: 0.25, color: downText }}
              >
                {accountError}
              </Typography>
            )}
          </Box>

          <Box sx={{ minWidth: 0 }} data-testid="risk-inputs-cap-field">
            <FieldLabel>{C.maxRiskLabel}</FieldLabel>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box
                component="input"
                type="text"
                inputMode="decimal"
                aria-label={C.maxRiskLabel}
                aria-disabled={anonymous}
                disabled={saving}
                data-testid="risk-inputs-cap-value"
                data-figure-register="mono"
                value={capDraft}
                placeholder="not set"
                onChange={(e) => !anonymous && setCapDraft(e.currentTarget.value)}
                sx={{ ...INPUT_SX, flex: '1 1 auto' }}
              />
              {/* Unit-bearing numeric input (DESIGN_SYSTEM Amendment 2026-08-12) — an explicit unit
                control; a bare number with an inferred unit never renders anywhere (AC-31). Fuller
                labels (design/src/screens/settings.mjs:47, `% of account | $ per trade`) — same
                testids, same toggle semantics, no test pins the `$`/`%` glyphs. */}
              <ToggleButtonGroup
                exclusive
                size="small"
                value={capUnit}
                aria-label="Cap unit"
                aria-disabled={anonymous}
                data-testid="risk-inputs-cap-unit"
                onChange={(_e, v) => !anonymous && v && setCapUnit(v as CapUnit)}
                sx={{ flex: 'none' }}
              >
                <ToggleButton
                  value="percent"
                  data-testid="risk-inputs-cap-unit-percent"
                  aria-disabled={anonymous}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  % of account
                </ToggleButton>
                <ToggleButton
                  value="usd"
                  data-testid="risk-inputs-cap-unit-usd"
                  aria-disabled={anonymous}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  $ per trade
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {C.maxRiskHelper}
            </Typography>
            {capError && (
              <Typography
                variant="caption"
                data-testid="risk-inputs-cap-error"
                sx={{ display: 'block', mt: 0.25, color: downText }}
              >
                {capError}
              </Typography>
            )}
          </Box>
        </Box>

        {/* The cap strip (the Final Settings board's `.hd-fig`, two cells; fidelity audit 2026-10-25,
            ACC-22): the effective cap per trade, and what the request includes from the book. The
            derived figure is rendered VERBATIM from the server and labelled "derived from your
            inputs", never "validated", "checked" or "enforced" (tradeable-rec-inputs SPEC §4) — no
            client arithmetic here. Not derivable reads the field-scoped reason, never $0. */}
        {!anonymous && stored != null && (
          <Box
            data-testid="cap-row"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '1px',
              bgcolor: 'divider',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <StripCell label="Effective cap per trade">
              {stored.effective_dollar_cap.state === 'derived' ? (
                <Box data-testid="risk-inputs-effective-cap">
                  <Typography
                    component="span"
                    data-figure-register="mono"
                    sx={{ ...faceFor(true), display: 'block', fontSize: 18, lineHeight: 1.2 }}
                  >
                    {`$${stored.effective_dollar_cap.value}`}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ display: 'block', fontSize: 12, color: 'text.secondary' }}
                  >
                    Derived from your inputs
                  </Typography>
                </Box>
              ) : stored.effective_dollar_cap.state === 'not_derivable' ? (
                <Typography
                  component="span"
                  sx={{ fontSize: 14, lineHeight: 1.3, color: 'text.secondary' }}
                  data-testid="risk-inputs-not-derivable"
                >
                  {C.accountSizeNotSetReason}
                </Typography>
              ) : (
                <Typography
                  component="span"
                  sx={{ fontSize: 14, lineHeight: 1.3, color: 'text.secondary' }}
                >
                  not set
                </Typography>
              )}
            </StripCell>
            <StripCell label="Open positions included">
              <Typography
                component="span"
                sx={{ fontSize: 14, lineHeight: 1.3 }}
                data-testid="risk-inputs-open-positions"
              >
                {/* `C.openPositionsIncluded` without its "Open positions included:" lead-in,
                    which is now the cell's label. */}
                Your simulated positions in this browser.
              </Typography>
            </StripCell>
          </Box>
        )}

        {notSet && (
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary' }}
            data-testid="risk-inputs-not-set-consequence"
          >
            {C.notSetConsequence}
          </Typography>
        )}

        <Box>
          <Button
            variant="contained"
            disabled={saving}
            aria-disabled={anonymous}
            data-testid="risk-inputs-save"
            onClick={() => !anonymous && void save()}
          >
            Save risk inputs
          </Button>
        </Box>
      </Stack>

      {saveError && (
        <Alert severity="error" sx={{ mt: 2 }} data-testid="risk-inputs-save-error">
          {C.saveError}
        </Alert>
      )}

      <Snackbar
        open={saved}
        autoHideDuration={2000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* criterion 41 (SB): neutral chrome, word unchanged — the error Alert above (severity="error",
            :300, unchanged) keeps its icon; an error is a state, not a direction. */}
        <Alert severity="info" data-testid="risk-inputs-saved">
          {C.saved}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default RiskInputsSection;
