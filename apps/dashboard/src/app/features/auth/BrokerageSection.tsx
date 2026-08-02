/**
 * BrokerageSection — the Settings "Brokerage" section (SPEC §4, the byo-ai-key shape reused
 * deliberately; `AiKeySection` is the pattern of record).
 *
 * Security floor, in code:
 *  - WRITE-ONLY: the App Key + App Secret live ONLY in local draft state during the submit and
 *    are CLEARED on success — never persisted, never logged, never placed in any other state.
 *  - The status read returns at most `set`/`last4`/`storage_available` — never a key, secret,
 *    or ciphertext. There is NO reveal/show/copy control anywhere.
 *  - BOTH HALVES OR NOTHING: the pair is one logical record; client validation mirrors the
 *    server 422 (which is the boundary of record) — never one half saved.
 *  - Errors never echo any fragment of either input (AC-5).
 *  - storage-unavailable is a contained info note (200-shape), never error-red, never a dead end.
 *
 * Disconnect also invalidates the server book cache (AC-3) — the Broker tab returns to
 * not-connected with no ghost book; that behavior is the server's, exercised by the broker
 * integration suite.
 */
import { Alert, Box, Button, Snackbar, Stack, TextField, Typography } from '@mui/material';
import {
  AuthError,
  deleteBrokerCredential,
  fetchBrokerCredential,
  putBrokerCredential,
  type BrokerCredentialHint,
} from '@org/api';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { typographyTokens } from '@/shared/theme/tokens';
import { useAuth } from './AuthContext';
import { SignInPrompt } from './SignInPrompt';
import { AUTH_COPY } from './copy';
import { useGate } from './useGate';

const C = AUTH_COPY.settings.brokerage;

type Mode = 'view' | 'replace';

export function BrokerageSection({ embedded = false }: { embedded?: boolean } = {}) {
  const auth = useAuth();
  const gate = useGate();
  const [hint, setHint] = useState<BrokerCredentialHint | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [appKey, setAppKey] = useState(''); // local-only, cleared on success
  const [appSecret, setAppSecret] = useState(''); // local-only, cleared on success
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const readHint = useCallback(() => {
    let cancelled = false;
    fetchBrokerCredential()
      .then((h) => {
        if (!cancelled) setHint(h);
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth.authenticated) {
      setHint(null);
      return;
    }
    return readHint();
  }, [auth.authenticated, readHint]);

  const clearDrafts = useCallback(() => {
    setAppKey('');
    setAppSecret('');
    setValidation(null);
  }, []);

  const submit = useCallback(async () => {
    const key = appKey.trim();
    const secret = appSecret.trim();
    // BOTH halves or nothing — the client mirror of the server 422 (the boundary of record).
    if (!key || !secret) {
      setValidation(C.validationBoth);
      return;
    }
    setValidation(null);
    setSubmitting(true);
    setSaveError(false);
    try {
      const next = await putBrokerCredential({ app_key: key, app_secret: secret });
      clearDrafts(); // the typed halves are NEVER retained past success
      setHint(next);
      setMode('view');
      if (next.set) setToast(C.savedToast);
    } catch (err) {
      // 422 ⇒ the both-halves copy; anything else ⇒ the generic error. NEITHER echoes any input.
      if (err instanceof AuthError && err.code === 'validation') setValidation(C.validationBoth);
      else setSaveError(true);
    } finally {
      setSubmitting(false);
    }
  }, [appKey, appSecret, clearDrafts]);

  const doDisconnect = useCallback(async () => {
    setSubmitting(true);
    setSaveError(false);
    try {
      const next = await deleteBrokerCredential();
      setHint(next);
      setDisconnectConfirm(false);
      setMode('view');
      setToast(C.removedToast);
    } catch {
      setSaveError(true);
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ---- Anonymous: a stored credential is per-account — sign-in prompt, no form -----------------
  if (!auth.authenticated) {
    return (
      <Section embedded={embedded}>
        <Box data-testid="settings-brokerage-anonymous">
          <SignInPrompt
            text={C.anonymous}
            onSignIn={() => gate.signIn(C.anonymous)}
            testid="settings-brokerage-signin"
          />
        </Box>
      </Section>
    );
  }

  const storageUnavailable = hint != null && hint.storage_available === false;
  const isSet = hint?.set === true;
  const showConnectForm = !isSet || storageUnavailable;
  const showReplaceForm = isSet && !storageUnavailable && mode === 'replace';

  const form = (kind: 'connect' | 'replace') => (
    <KeyPairForm
      kind={kind}
      appKey={appKey}
      appSecret={appSecret}
      onAppKey={setAppKey}
      onAppSecret={setAppSecret}
      submitting={submitting}
      disabledInput={storageUnavailable}
      validation={validation}
      onSubmit={() => void submit()}
      onCancel={() => {
        clearDrafts();
        setMode('view');
      }}
    />
  );

  return (
    <Section embedded={embedded}>
      {storageUnavailable && (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="settings-brokerage-storage-unavailable">
          {C.storageUnavailable}
        </Alert>
      )}

      {/* Saved state: masked hint + Replace keys + Disconnect. No reveal control exists. */}
      {isSet && !storageUnavailable && mode === 'view' && (
        <Box sx={{ mt: 1 }} data-testid="settings-brokerage-set">
          <Typography
            data-testid="settings-brokerage-masked"
            sx={{
              fontFamily: typographyTokens.monoFontFamily,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'text.primary',
            }}
          >
            {C.savedLabel(hint?.last4 ?? null)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {C.savedSubLine}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              data-testid="settings-brokerage-replace"
              onClick={() => {
                clearDrafts();
                setMode('replace');
              }}
            >
              {C.replaceBtn}
            </Button>
            <Button
              size="small"
              color="error"
              data-testid="settings-brokerage-disconnect"
              onClick={() => setDisconnectConfirm(true)}
            >
              {C.disconnectBtn}
            </Button>
          </Stack>

          {disconnectConfirm && (
            <Alert
              severity="warning"
              sx={{ mt: 1 }}
              data-testid="settings-brokerage-disconnect-confirm"
              action={
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={submitting}
                    data-testid="settings-brokerage-disconnect-cancel"
                    onClick={() => setDisconnectConfirm(false)}
                  >
                    {C.disconnectCancelBtn}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={submitting}
                    data-testid="settings-brokerage-disconnect-confirm-btn"
                    onClick={() => void doDisconnect()}
                  >
                    {C.disconnectConfirmBtn}
                  </Button>
                </Stack>
              }
            >
              <Typography variant="subtitle2">{C.disconnectConfirmTitle}</Typography>
              <Typography variant="body2">{C.disconnectConfirmBody}</Typography>
            </Alert>
          )}
        </Box>
      )}

      {showReplaceForm && form('replace')}
      {showConnectForm && form('connect')}

      {saveError && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          data-testid="settings-brokerage-error"
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
        <Alert severity="success" data-testid="settings-brokerage-saved">
          {toast ?? ''}
        </Alert>
      </Snackbar>
    </Section>
  );
}

/** The write-only two-field form. Hoisted to module scope so React preserves input identity. */
function KeyPairForm({
  kind,
  appKey,
  appSecret,
  onAppKey,
  onAppSecret,
  submitting,
  disabledInput,
  validation,
  onSubmit,
  onCancel,
}: {
  kind: 'connect' | 'replace';
  appKey: string;
  appSecret: string;
  onAppKey: (v: string) => void;
  onAppSecret: (v: string) => void;
  submitting: boolean;
  disabledInput: boolean;
  validation: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <Stack
      spacing={1}
      sx={{ mt: 1 }}
      data-testid={
        kind === 'connect' ? 'settings-brokerage-empty' : 'settings-brokerage-replace-form'
      }
    >
      <TextField
        type="password"
        label={C.appKeyLabel}
        value={appKey}
        disabled={submitting || disabledInput}
        onChange={(e) => onAppKey(e.target.value)}
        onKeyDown={onEnter}
        slotProps={{
          htmlInput: { 'data-testid': 'settings-brokerage-app-key', autoComplete: 'off' },
        }}
        fullWidth
      />
      <TextField
        type="password"
        label={C.appSecretLabel}
        helperText={C.inputHelper}
        value={appSecret}
        disabled={submitting || disabledInput}
        onChange={(e) => onAppSecret(e.target.value)}
        onKeyDown={onEnter}
        slotProps={{
          htmlInput: { 'data-testid': 'settings-brokerage-app-secret', autoComplete: 'off' },
        }}
        fullWidth
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          disabled={submitting || disabledInput}
          data-testid={
            kind === 'connect' ? 'settings-brokerage-connect' : 'settings-brokerage-replace-submit'
          }
          onClick={onSubmit}
        >
          {kind === 'connect'
            ? submitting
              ? C.connectingBtn
              : C.connectBtn
            : submitting
              ? C.replacingBtn
              : C.replaceSubmitBtn}
        </Button>
        {kind === 'replace' && (
          <Button
            size="small"
            color="inherit"
            disabled={submitting}
            data-testid="settings-brokerage-replace-cancel"
            onClick={onCancel}
          >
            {C.cancelBtn}
          </Button>
        )}
      </Stack>
      {validation && (
        <Alert severity="info" data-testid="settings-brokerage-validation">
          {validation}
        </Alert>
      )}
    </Stack>
  );
}

/** Section frame with the `#brokerage` deep-link anchor (the Broker tab's S1 CTA lands here). */
function Section({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  return (
    <Box id="brokerage" data-testid="settings-brokerage-section">
      {!embedded && <Typography variant="h6">{C.heading}</Typography>}
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {C.helper}
      </Typography>
      {children}
    </Box>
  );
}
