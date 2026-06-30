/**
 * AiKeySection — the byo-ai-key "AI key" Settings section (UX_BLUEPRINT §4, FRONTEND_EXECUTION §3).
 * A WRITE-ONLY key entry: the key is SENT on save; only the masked last-4 hint + a `set` flag are
 * ever read back. There is NO reveal/show/copy control anywhere (PRODUCT_CONTRACT §6).
 *
 * Egress floor honored in code:
 *  - The typed key lives ONLY in `draft` local state during the submit and is CLEARED on success
 *    (never persisted, never logged, never put in any other state — AC-10/12).
 *  - The status read (`getAiKeyStatus`) returns at most `set`/`last4`/`storage_available` — never a key.
 *  - storage-unavailable is a contained, honest info note (never a 5xx / never an error red — AC-18).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Box, Stack, Typography, TextField, Button, Alert, Divider, Snackbar,
} from '@mui/material';
import { AuthError, getAiKeyStatus, setAiKey, removeAiKey, type AiKeyStatus } from '@org/api';
import { typographyTokens } from '../tokens';
import { useAuth } from './AuthContext';
import { useGate } from './useGate';
import { SignInPrompt } from './SignInPrompt';
import { AUTH_COPY, maskedKeyLabel } from './copy';

const C = AUTH_COPY.settings.aiKey;

type Mode = 'view' | 'replace';

/** `embedded` (Settings panel re-skin): the parent PanelCard already renders the "AI key" heading +
 *  the card border, so the inner Section drops its own heading + leading divider. Behavior, testids,
 *  and the write-only/no-reveal security floor are unchanged either way. */
export function AiKeySection({ embedded = false }: { embedded?: boolean } = {}) {
  const auth = useAuth();
  const gate = useGate();
  const [status, setStatus] = useState<AiKeyStatus | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState('');          // the typed key — local-only, cleared on success
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Read the masked hint on mount + after each mutation. 403 ⇒ anonymous (the section shows the
  // sign-in prompt instead, driven by auth state). Other faults degrade to a treated-as-empty read.
  const readStatus = useCallback(() => {
    let cancelled = false;
    getAiKeyStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!auth.authenticated) { setStatus(null); return; }
    return readStatus();
  }, [auth.authenticated, readStatus]);

  const clearDraft = useCallback(() => { setDraft(''); setValidation(null); }, []);

  const submitKey = useCallback(async () => {
    const key = draft.trim();
    if (!key) { setValidation(C.validationEmpty); return; }
    // Soft format warning is warn-only (the backend is the authority) — it does NOT block the submit.
    setValidation(key.startsWith('sk-ant-') ? null : C.validationFormat);
    setSubmitting(true);
    setSaveError(false);
    try {
      const next = await setAiKey(key);
      clearDraft();                         // CLEAR the typed key on success — never retained (AC-10)
      setStatus(next);
      setMode('view');
      setToast(C.savedAdd);
    } catch (err) {
      // A 422 validation surfaces as the inline validation copy; any other fault → the save-error
      // alert (NEVER echoes the key). A storage-unavailable case is a 200, not caught here.
      if (err instanceof AuthError && err.code === 'validation') setValidation(C.validationFormat);
      else setSaveError(true);
    } finally {
      setSubmitting(false);
    }
  }, [draft, clearDraft]);

  const doRemove = useCallback(async () => {
    setSubmitting(true);
    setSaveError(false);
    try {
      const next = await removeAiKey();
      setStatus(next);
      setRemoveConfirm(false);
      setMode('view');
      setToast(C.savedRemove);
    } catch {
      setSaveError(true);
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ---- Anonymous: a stored key is per-account — show a sign-in prompt, no form (UX §4.5) --------
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
  const isSet = status?.set === true;
  const showAddForm = !isSet || storageUnavailable;
  const showReplaceForm = isSet && !storageUnavailable && mode === 'replace';

  const form = (kind: 'add' | 'replace') => (
    <KeyForm
      kind={kind}
      draft={draft}
      onDraft={setDraft}
      submitting={submitting}
      disabledInput={storageUnavailable}
      validation={validation}
      onSubmit={() => void submitKey()}
      onCancel={() => { clearDraft(); setMode('view'); }}
    />
  );

  return (
    <Section embedded={embedded}>
      {/* storage-unavailable (AC-18) — info, never error; the input is disabled below. */}
      {storageUnavailable && (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="settings-ai-key-storage-unavailable">
          {C.storageUnavailable}
        </Alert>
      )}

      {/* Set state: masked hint + Replace + Remove. NO reveal/show/copy control exists. */}
      {isSet && !storageUnavailable && mode === 'view' && (
        <Box sx={{ mt: 1 }} data-testid="settings-ai-key-set">
          <Typography
            data-testid="settings-ai-key-masked"
            sx={{ fontFamily: typographyTokens.monoFontFamily, fontSize: 15, fontWeight: 600, letterSpacing: '0.02em', color: 'text.primary' }}
          >
            {maskedKeyLabel(status?.last4 ?? null)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {C.setSubLine}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" variant="outlined" data-testid="settings-ai-key-replace"
              onClick={() => { clearDraft(); setMode('replace'); }}>
              {C.replaceBtn}
            </Button>
            <Button size="small" color="error" data-testid="settings-ai-key-remove"
              onClick={() => setRemoveConfirm(true)}>
              {C.removeBtn}
            </Button>
          </Stack>

          {removeConfirm && (
            <Alert severity="warning" sx={{ mt: 1 }} data-testid="settings-ai-key-remove-confirm"
              action={
                <Stack direction="row" spacing={1}>
                  <Button size="small" color="inherit" disabled={submitting}
                    onClick={() => setRemoveConfirm(false)}>
                    {C.removeCancelBtn}
                  </Button>
                  <Button size="small" color="error" disabled={submitting}
                    data-testid="settings-ai-key-remove-confirm-btn" onClick={() => void doRemove()}>
                    {C.removeConfirmBtn}
                  </Button>
                </Stack>
              }>
              <Typography variant="subtitle2">{C.removeConfirmTitle}</Typography>
              <Typography variant="body2">{C.removeConfirmBody}</Typography>
            </Alert>
          )}
        </Box>
      )}

      {/* Replace form (overwrites the existing key; AC-8). */}
      {showReplaceForm && form('replace')}

      {/* Empty state — the add form. Also shown (disabled) in the storage-unavailable variant. */}
      {showAddForm && form('add')}

      {saveError && (
        <Alert severity="error" sx={{ mt: 1 }} data-testid="settings-ai-key-error"
          onClose={() => setSaveError(false)}>
          {C.saveError}
        </Alert>
      )}

      <Snackbar
        open={toast != null}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" data-testid="settings-ai-key-saved">{toast ?? ''}</Alert>
      </Snackbar>
    </Section>
  );
}

/** The write-only key entry form (Empty add / Replace). Hoisted to module scope so React preserves
 *  the input element identity across keystrokes (an inline definition would remount it each render). */
function KeyForm({
  kind, draft, onDraft, submitting, disabledInput, validation, onSubmit, onCancel,
}: {
  kind: 'add' | 'replace';
  draft: string;
  onDraft: (v: string) => void;
  submitting: boolean;
  disabledInput: boolean;
  validation: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <Stack spacing={1} sx={{ mt: 1 }}
      data-testid={kind === 'add' ? 'settings-ai-key-empty' : 'settings-ai-key-replace-form'}>
      <TextField
        type="password"
        label={C.inputLabel}
        placeholder={C.inputPlaceholder}
        helperText={C.inputHelper}
        value={draft}
        disabled={submitting || disabledInput}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
        slotProps={{ htmlInput: { 'data-testid': 'settings-ai-key-input', autoComplete: 'off' } }}
        fullWidth
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained" size="small"
          disabled={submitting || disabledInput}
          data-testid={kind === 'add' ? 'settings-ai-key-add' : 'settings-ai-key-replace-submit'}
          onClick={onSubmit}
        >
          {kind === 'add'
            ? (submitting ? C.addingBtn : C.addBtn)
            : (submitting ? C.replacingBtn : C.replaceSubmitBtn)}
        </Button>
        {kind === 'replace' && (
          <Button size="small" color="inherit" disabled={submitting}
            data-testid="settings-ai-key-replace-cancel" onClick={onCancel}>
            {C.cancelBtn}
          </Button>
        )}
      </Stack>
      {validation && (
        <Alert severity="info" data-testid="settings-ai-key-validation">{validation}</Alert>
      )}
    </Stack>
  );
}

/** Section frame — helper (+ heading/divider when standalone), with the section testid + deep-link
 *  anchor. When `embedded` (inside the Settings PanelCard), the heading + leading divider are dropped
 *  because the card already provides them; the helper + the section testid + all children stay. */
function Section({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  return (
    <Box id="ai-key" data-testid="settings-ai-key-section">
      {!embedded && <Divider sx={{ mb: 2 }} />}
      {!embedded && <Typography variant="h6">{C.heading}</Typography>}
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{C.helper}</Typography>
      {children}
    </Box>
  );
}
