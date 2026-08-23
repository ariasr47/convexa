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
import { typographyTokens } from '@/shared/theme/tokens';
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
import { formatAmount, validateAccountSize, validateCap } from './riskInputs';
import { useSettings } from './useSettings';

const MONO = typographyTokens.monoFontFamily;

function isCapUnit(value: string): value is CapUnit {
  return value === 'usd' || value === 'percent';
}

/** Field label — matches the auth-modal / Settings uppercase idiom. */
function FieldLabel({ children }: { children: ReactNode }) {
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
  // for an unset field — `formatAmount(null)` is `''`).
  useEffect(() => {
    setAccountDraft(formatAmount(stored?.account_size ?? null));
    setCapDraft(formatAmount(stored?.per_trade_cap?.value ?? null));
    const unit = stored?.per_trade_cap?.unit ?? 'percent';
    if (isCapUnit(unit)) setCapUnit(unit);
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
      <Typography variant="body2" sx={{ color: 'text.secondary' }} data-testid="risk-inputs-helper">
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
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 2 }}
      >
        {C.openPositionsIncluded}
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

      <Stack spacing={2.5} aria-disabled={anonymous} data-testid="risk-inputs-form">
        <Box>
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
              value={accountDraft}
              placeholder="0"
              onChange={(e) => !anonymous && setAccountDraft(e.currentTarget.value)}
              sx={{
                fontFamily: MONO,
                fontSize: 15,
                px: 1.25,
                py: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                color: 'text.primary',
                width: 160,
                '&::before': { content: '"$"' },
              }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {C.accountSizeHelper}
          </Typography>
          {accountError && (
            <Typography
              variant="caption"
              color="error"
              data-testid="risk-inputs-account-error"
              sx={{ display: 'block', mt: 0.25 }}
            >
              {accountError}
            </Typography>
          )}
        </Box>

        <Box>
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
              value={capDraft}
              placeholder="0"
              onChange={(e) => !anonymous && setCapDraft(e.currentTarget.value)}
              sx={{
                fontFamily: MONO,
                fontSize: 15,
                px: 1.25,
                py: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                color: 'text.primary',
                width: 120,
              }}
            />
            {/* Unit-bearing numeric input (DESIGN_SYSTEM Amendment 2026-08-12) — an explicit unit
                control; a bare number with an inferred unit never renders anywhere (AC-31). */}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={capUnit}
              aria-label="Cap unit"
              aria-disabled={anonymous}
              data-testid="risk-inputs-cap-unit"
              onChange={(_e, v) => !anonymous && v && setCapUnit(v as CapUnit)}
            >
              <ToggleButton
                value="usd"
                data-testid="risk-inputs-cap-unit-usd"
                aria-disabled={anonymous}
              >
                $
              </ToggleButton>
              <ToggleButton
                value="percent"
                data-testid="risk-inputs-cap-unit-percent"
                aria-disabled={anonymous}
              >
                %
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {C.maxRiskHelper}
          </Typography>
          {capError && (
            <Typography
              variant="caption"
              color="error"
              data-testid="risk-inputs-cap-error"
              sx={{ display: 'block', mt: 0.25 }}
            >
              {capError}
            </Typography>
          )}
          {/* The derived figure — rendered VERBATIM from the server, labelled "derived from your
              inputs", never "validated", "checked" or "enforced". No client arithmetic here. */}
          {!anonymous && stored?.effective_dollar_cap.state === 'derived' && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
              data-testid="risk-inputs-effective-cap"
            >
              {`Effective dollar cap (derived from your inputs): $${stored.effective_dollar_cap.value}`}
            </Typography>
          )}
          {!anonymous && stored?.effective_dollar_cap.state === 'not_derivable' && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
              data-testid="risk-inputs-not-derivable"
            >
              {C.accountSizeNotSetReason}
            </Typography>
          )}
        </Box>

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
            size="small"
            disabled={saving}
            aria-disabled={anonymous}
            data-testid="risk-inputs-save"
            onClick={() => !anonymous && void save()}
          >
            Save
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
        <Alert severity="success" data-testid="risk-inputs-saved">
          {C.saved}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default RiskInputsSection;
