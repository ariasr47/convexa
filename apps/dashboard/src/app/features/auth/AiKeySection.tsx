/**
 * AiKeySection — Settings "AI providers" panel (SPEC §4).
 * Preferred Grok subscription card + per-provider BYO matrix + named model control.
 * Write-only keys: drafts live only in local state and are CLEARED on success. No reveal/show/copy.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import {
  AuthError,
  BYO_PROVIDERS,
  disconnectGrok,
  getAiKeyStatus,
  GROK_OAUTH_START,
  removeAiKey,
  setAiKey,
  type AiProvidersBootstrap,
  type ByoProvider,
} from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BYO_PROVIDER_LABEL,
  BYO_PROVIDER_PLACEHOLDER,
  catalogForPreference,
} from './aiProviderLabels';
import { useAuth } from './AuthContext';
import { AUTH_COPY, maskedKeyLabel } from './copy';
import { SignInPrompt } from './SignInPrompt';
import { useGate } from './useGate';

const C = AUTH_COPY.settings.aiKey;
const MONO = typographyTokens.monoFontFamily;

const EMPTY_DRAFTS: Record<ByoProvider, string> = {
  anthropic: '',
  openai: '',
  xai: '',
  gemini: '',
};

export function AiKeySection({ embedded = false }: { embedded?: boolean } = {}) {
  const auth = useAuth();
  const gate = useGate();
  const [status, setStatus] = useState<AiProvidersBootstrap | null>(null);
  const [replaceFor, setReplaceFor] = useState<ByoProvider | null>(null);
  const [drafts, setDrafts] = useState<Record<ByoProvider, string>>(EMPTY_DRAFTS);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [validation, setValidation] = useState<Partial<Record<ByoProvider, string>>>({});
  const [saveError, setSaveError] = useState(false);
  const [removeFor, setRemoveFor] = useState<ByoProvider | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const readStatus = useCallback(() => {
    let cancelled = false;
    getAiKeyStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth.authenticated) {
      setStatus(null);
      return;
    }
    return readStatus();
  }, [auth.authenticated, readStatus]);

  const setDraft = useCallback((provider: ByoProvider, value: string) => {
    setDrafts((d) => ({ ...d, [provider]: value }));
  }, []);

  const clearDraft = useCallback((provider: ByoProvider) => {
    setDrafts((d) => ({ ...d, [provider]: '' }));
    setValidation((v) => ({ ...v, [provider]: undefined }));
  }, []);

  const submitKey = useCallback(
    async (provider: ByoProvider) => {
      const key = drafts[provider].trim();
      if (!key) {
        setValidation((v) => ({ ...v, [provider]: C.validationEmpty }));
        return;
      }
      setValidation((v) => ({ ...v, [provider]: undefined }));
      setSubmitting(provider);
      setSaveError(false);
      try {
        const next = await setAiKey(key, provider);
        clearDraft(provider);
        setStatus(next);
        setReplaceFor(null);
        setToast(C.savedAdd);
      } catch (err) {
        if (err instanceof AuthError && err.code === 'validation') {
          setValidation((v) => ({ ...v, [provider]: C.validationEmpty }));
        } else setSaveError(true);
      } finally {
        setSubmitting(null);
      }
    },
    [drafts, clearDraft],
  );

  const doRemove = useCallback(async (provider: ByoProvider) => {
    setSubmitting(`remove-${provider}`);
    setSaveError(false);
    try {
      const next = await removeAiKey(provider);
      setStatus(next);
      setRemoveFor(null);
      setReplaceFor(null);
      setToast(C.savedRemove);
    } catch {
      setSaveError(true);
    } finally {
      setSubmitting(null);
    }
  }, []);

  const preferOwnKey = useCallback(
    async (provider: ByoProvider) => {
      setSubmitting(`use-${provider}`);
      setSaveError(false);
      try {
        await auth.updateSettings({ ai_power_path: 'own_key', ai_provider: provider });
        const next = await getAiKeyStatus();
        setStatus(next);
        setToast(C.usingProvider(BYO_PROVIDER_LABEL[provider]));
      } catch {
        setSaveError(true);
      } finally {
        setSubmitting(null);
      }
    },
    [auth],
  );

  const preferGrokSubscription = useCallback(async () => {
    setSubmitting('use-sub');
    setSaveError(false);
    try {
      await auth.updateSettings({ ai_power_path: 'grok_subscription' });
      const next = await getAiKeyStatus();
      setStatus(next);
      setToast(C.grokConnected);
    } catch {
      setSaveError(true);
    } finally {
      setSubmitting(null);
    }
  }, [auth]);

  const doDisconnectGrok = useCallback(async () => {
    setSubmitting('disconnect-grok');
    setSaveError(false);
    try {
      await disconnectGrok();
      const next = await getAiKeyStatus();
      setStatus(next);
      setToast(C.grokDisconnected);
    } catch {
      setSaveError(true);
    } finally {
      setSubmitting(null);
    }
  }, []);

  const changeModel = useCallback(
    async (id: string) => {
      if (!id) return;
      setSubmitting('model');
      setSaveError(false);
      try {
        await auth.updateSettings({ ai_model: id });
        const next = await getAiKeyStatus();
        setStatus(next);
      } catch {
        setSaveError(true);
      } finally {
        setSubmitting(null);
      }
    },
    [auth],
  );

  if (!auth.authenticated) {
    return (
      <Section embedded={embedded}>
        <Box data-testid="settings-ai-key-anonymous">
          <SignInPrompt
            text={C.anonymous}
            onSignIn={() => gate.signIn(C.anonymous)}
            testid="settings-ai-key-signin"
          />
        </Box>
      </Section>
    );
  }

  const storageUnavailable = status != null && status.storage_available === false;
  const disabled = storageUnavailable || submitting != null;
  const ready =
    status != null &&
    Array.isArray(status.providers) &&
    status.grok != null &&
    status.preference != null &&
    status.catalog != null;
  const models = ready ? catalogForPreference(status) : [];
  const selectedModel = ready ? (status.preference.model ?? '') : '';
  const selectedInCatalog = models.some((m) => m.id === selectedModel);
  const unpowered = ready && status.preference.power_path == null;

  return (
    <Section embedded={embedded}>
      {storageUnavailable && (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="settings-ai-key-storage-unavailable">
          {C.storageUnavailable}
        </Alert>
      )}

      {ready && (
        <>
          <GrokCard
            status={status}
            disabled={disabled}
            submitting={submitting}
            onConnect={() => {
              window.location.assign(GROK_OAUTH_START);
            }}
            onDisconnect={() => void doDisconnectGrok()}
            onUse={() => void preferGrokSubscription()}
          />

          <Typography
            component="div"
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mt: 2.5,
              mb: 1,
            }}
          >
            {C.alternativeHeading}
          </Typography>

          <Stack spacing={1.5} data-testid="settings-ai-key-matrix">
            {BYO_PROVIDERS.map((provider) => {
              const row = status.providers.find((p) => p.provider === provider);
              const set = row?.set === true;
              const last4 = row?.last4 ?? null;
              const active =
                status.preference.power_path === 'own_key' &&
                status.preference.provider === provider;
              return (
                <ProviderRow
                  key={provider}
                  provider={provider}
                  set={set}
                  last4={last4}
                  active={active}
                  replacing={replaceFor === provider}
                  draft={drafts[provider]}
                  onDraft={(v) => setDraft(provider, v)}
                  submitting={submitting}
                  disabled={disabled}
                  validation={validation[provider] ?? null}
                  removeConfirm={removeFor === provider}
                  onAdd={() => void submitKey(provider)}
                  onReplace={() => {
                    clearDraft(provider);
                    setReplaceFor(provider);
                    setRemoveFor(null);
                  }}
                  onReplaceCancel={() => {
                    clearDraft(provider);
                    setReplaceFor(null);
                  }}
                  onRemoveAsk={() => setRemoveFor(provider)}
                  onRemoveCancel={() => setRemoveFor(null)}
                  onRemoveConfirm={() => void doRemove(provider)}
                  onUse={() => void preferOwnKey(provider)}
                />
              );
            })}
          </Stack>

          <Box sx={{ mt: 2.5 }} data-testid="settings-ai-model">
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
              {C.modelHeading}
            </Typography>
            {models.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary' }}
                data-testid="settings-ai-model-empty"
              >
                {C.modelEmpty}
              </Typography>
            ) : (
              <FormControl fullWidth size="small" disabled={disabled}>
                <Select
                  aria-label={C.modelHeading}
                  value={selectedInCatalog ? selectedModel : ''}
                  displayEmpty
                  onChange={(e) => void changeModel(String(e.target.value))}
                  inputProps={{ 'data-testid': 'settings-ai-model-select' }}
                  sx={{ fontFamily: MONO }}
                >
                  {!selectedInCatalog && selectedModel && (
                    <MenuItem value="" disabled>
                      {selectedModel}
                    </MenuItem>
                  )}
                  {models.map((m) => (
                    <MenuItem key={m.id} value={m.id} sx={{ fontFamily: MONO }}>
                      {m.id}
                      {m.recommended ? ` · ${C.modelRecommendedCaption}` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {unpowered && selectedModel && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                data-testid="settings-ai-model-unpowered"
              >
                {C.modelUnpoweredCaption}
              </Typography>
            )}
            {status.preference.power_path != null && selectedModel && !selectedInCatalog && (
              <Alert
                severity="warning"
                sx={{ mt: 1 }}
                data-testid="settings-ai-model-not-in-catalog"
              >
                {C.modelNotInCatalog}
              </Alert>
            )}
          </Box>
        </>
      )}

      {saveError && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          data-testid="settings-ai-key-error"
          onClose={() => setSaveError(false)}
        >
          {C.saveError}
        </Alert>
      )}

      <Snackbar
        open={toast != null}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* curvature-v2-surfaces criterion 41 (SB, extended in-lane): this panel renders on the SAME
            settings page as the readout the criterion names, and the whole page is the one surface
            criterion 41 covers — "no confirmation on settings renders in the direction-reserved
            colours" — so this confirmation loses the same success palette. Nothing else here changes;
            this file is otherwise untouched by FE-8. */}
        <Alert severity="info" data-testid="settings-ai-key-saved">
          {toast ?? ''}
        </Alert>
      </Snackbar>
    </Section>
  );
}

function GrokCard({
  status,
  disabled,
  submitting,
  onConnect,
  onDisconnect,
  onUse,
}: {
  status: AiProvidersBootstrap;
  disabled: boolean;
  submitting: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onUse: () => void;
}) {
  const { grok, preference } = status;
  const active = preference.power_path === 'grok_subscription';
  const expired = grok.unavailable_reason === 'oauth_expired';
  const unlinked = grok.unavailable_reason === 'oauth_unlinked';
  const subUnavailable = grok.unavailable_reason === 'subscription_unavailable';

  return (
    <Box
      sx={{ mt: 2, p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}
      data-testid="settings-grok-card"
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700 }}>{C.preferredHeading}</Typography>
        {active && grok.connected && (
          <Chip
            size="small"
            variant="outlined"
            label={C.grokActive}
            data-testid="settings-grok-active"
          />
        )}
      </Stack>

      {!grok.available && (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="settings-grok-unavailable">
          {C.grokUnavailable}
        </Alert>
      )}

      {grok.available && expired && (
        <Alert severity="warning" sx={{ mt: 1 }} data-testid="settings-grok-expired">
          {C.grokExpired}
        </Alert>
      )}

      {grok.available && !grok.connected && unlinked && (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mt: 1 }}
          data-testid="settings-grok-unlinked"
        >
          {C.grokUnlinked}
        </Typography>
      )}

      {grok.available && subUnavailable && (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="settings-grok-subscription-unavailable">
          {C.grokSubscriptionUnavailable}
        </Alert>
      )}

      {grok.available && (
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          {(!grok.connected || expired) && (
            <Button
              size="small"
              variant="contained"
              disabled={disabled}
              data-testid="settings-grok-connect"
              onClick={onConnect}
            >
              {submitting === 'connect-grok' ? C.grokConnectingBtn : C.grokConnectBtn}
            </Button>
          )}
          {grok.connected && !active && (
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              data-testid="settings-grok-use"
              onClick={onUse}
            >
              {C.grokUseBtn}
            </Button>
          )}
          {grok.connected && (
            <Button
              size="small"
              color="error"
              disabled={disabled}
              data-testid="settings-grok-disconnect"
              onClick={onDisconnect}
            >
              {C.grokDisconnectBtn}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}

function ProviderRow({
  provider,
  set,
  last4,
  active,
  replacing,
  draft,
  onDraft,
  submitting,
  disabled,
  validation,
  removeConfirm,
  onAdd,
  onReplace,
  onReplaceCancel,
  onRemoveAsk,
  onRemoveCancel,
  onRemoveConfirm,
  onUse,
}: {
  provider: ByoProvider;
  set: boolean;
  last4: string | null;
  active: boolean;
  replacing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  submitting: string | null;
  disabled: boolean;
  validation: string | null;
  removeConfirm: boolean;
  onAdd: () => void;
  onReplace: () => void;
  onReplaceCancel: () => void;
  onRemoveAsk: () => void;
  onRemoveCancel: () => void;
  onRemoveConfirm: () => void;
  onUse: () => void;
}) {
  const label = BYO_PROVIDER_LABEL[provider];
  const busy = submitting != null;
  const showForm = !set || replacing;

  return (
    <Box
      sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}
      data-testid={`settings-ai-key-row-${provider}`}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
        {active && (
          <Chip
            size="small"
            variant="outlined"
            label={C.grokActive}
            data-testid={`settings-ai-key-active-${provider}`}
          />
        )}
      </Stack>

      {set && !replacing && (
        <Box
          sx={{ mt: 1 }}
          data-testid={
            provider === 'anthropic' ? 'settings-ai-key-set' : `settings-ai-key-set-${provider}`
          }
        >
          <Typography
            data-testid={
              provider === 'anthropic'
                ? 'settings-ai-key-masked'
                : `settings-ai-key-masked-${provider}`
            }
            sx={{
              fontFamily: MONO,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'text.primary',
            }}
          >
            {maskedKeyLabel(last4)}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
          >
            {C.setSubLine}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              disabled={busy || disabled}
              data-testid={
                provider === 'anthropic'
                  ? 'settings-ai-key-replace'
                  : `settings-ai-key-replace-${provider}`
              }
              onClick={onReplace}
            >
              {C.replaceBtn}
            </Button>
            <Button
              size="small"
              color="error"
              disabled={busy || disabled}
              data-testid={
                provider === 'anthropic'
                  ? 'settings-ai-key-remove'
                  : `settings-ai-key-remove-${provider}`
              }
              onClick={onRemoveAsk}
            >
              {C.removeBtn}
            </Button>
            <Button
              size="small"
              variant={active ? 'text' : 'contained'}
              disabled={busy || disabled || active}
              data-testid={`settings-ai-key-use-${provider}`}
              onClick={onUse}
            >
              {C.useThisKeyBtn}
            </Button>
          </Stack>
        </Box>
      )}

      {removeConfirm && (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          data-testid={
            provider === 'anthropic'
              ? 'settings-ai-key-remove-confirm'
              : `settings-ai-key-remove-confirm-${provider}`
          }
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" color="inherit" disabled={busy} onClick={onRemoveCancel}>
                {C.removeCancelBtn}
              </Button>
              <Button
                size="small"
                color="error"
                disabled={busy}
                data-testid={
                  provider === 'anthropic'
                    ? 'settings-ai-key-remove-confirm-btn'
                    : `settings-ai-key-remove-confirm-btn-${provider}`
                }
                onClick={onRemoveConfirm}
              >
                {C.removeConfirmBtn}
              </Button>
            </Stack>
          }
        >
          <Typography variant="subtitle2">{C.removeConfirmTitle}</Typography>
          <Typography variant="body2">{C.removeConfirmBody}</Typography>
        </Alert>
      )}

      {showForm && (
        <Stack
          spacing={1}
          sx={{ mt: 1 }}
          data-testid={
            replacing
              ? provider === 'anthropic'
                ? 'settings-ai-key-replace-form'
                : `settings-ai-key-replace-form-${provider}`
              : provider === 'anthropic'
                ? 'settings-ai-key-empty'
                : `settings-ai-key-empty-${provider}`
          }
        >
          <TextField
            type="password"
            label={`${label} ${C.inputLabel}`}
            placeholder={BYO_PROVIDER_PLACEHOLDER[provider]}
            helperText={C.inputHelper}
            value={draft}
            disabled={busy || disabled}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd();
              }
            }}
            slotProps={{
              htmlInput: {
                'data-testid':
                  provider === 'anthropic'
                    ? 'settings-ai-key-input'
                    : `settings-ai-key-input-${provider}`,
                autoComplete: 'off',
              },
            }}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              disabled={busy || disabled}
              data-testid={
                replacing
                  ? provider === 'anthropic'
                    ? 'settings-ai-key-replace-submit'
                    : `settings-ai-key-replace-submit-${provider}`
                  : provider === 'anthropic'
                    ? 'settings-ai-key-add'
                    : `settings-ai-key-add-${provider}`
              }
              onClick={onAdd}
            >
              {replacing
                ? submitting === provider
                  ? C.replacingBtn
                  : C.replaceSubmitBtn
                : submitting === provider
                  ? C.addingBtn
                  : C.addBtn}
            </Button>
            {replacing && (
              <Button
                size="small"
                color="inherit"
                disabled={busy}
                data-testid={
                  provider === 'anthropic'
                    ? 'settings-ai-key-replace-cancel'
                    : `settings-ai-key-replace-cancel-${provider}`
                }
                onClick={onReplaceCancel}
              >
                {C.cancelBtn}
              </Button>
            )}
          </Stack>
          {validation && (
            <Alert
              severity="info"
              data-testid={
                provider === 'anthropic'
                  ? 'settings-ai-key-validation'
                  : `settings-ai-key-validation-${provider}`
              }
            >
              {validation}
            </Alert>
          )}
        </Stack>
      )}
    </Box>
  );
}

function Section({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  return (
    <Box id="ai-key" data-testid="settings-ai-key-section">
      <Box id="ai-providers" />
      {!embedded && <Divider sx={{ mb: 2 }} />}
      {!embedded && <Typography variant="h6">{C.heading}</Typography>}
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {C.helper}
      </Typography>
      {children}
    </Box>
  );
}
