/**
 * AI providers — flow-integration centerpiece (SPEC AC-1–8, 11–13, 16–19, 28).
 * Mounts Settings against a mocked network boundary.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { SettingsPage } from '@/features/auth/SettingsPage';
import { AppThemeProvider } from '@/features/auth/ThemeProvider';
import { AUTH_COPY, maskedKeyLabel } from '@/features/auth/copy';
import {
  defaultAiCatalog,
  emptyAiSlots,
  installAuthBackend,
  uninstallAuthBackend,
  userSession,
} from '@/features/auth/testBackend';
import { POWERING } from '@/pages/ticker/widgets/ai-rec/copy';
import { BYO_PROVIDERS, type ByoProvider } from '@convexa/api';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

const RAW: Record<ByoProvider, string> = {
  anthropic: 'sk-ant-supersecret-anth1234',
  openai: 'sk-openai-supersecret5678',
  xai: 'xai-supersecret-grok9012',
  gemini: 'AIza-supersecret-gem3456',
};

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AuthDialogProvider>
            <Routes>
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AuthDialogProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </AuthProvider>,
  );
}

describe('AI providers · Settings matrix + Ask-AI agreement', () => {
  afterEach(() => {
    uninstallAuthBackend();
    cleanup();
  });

  it('anonymous Settings is sign-in only — no credential / OAuth / model forms (AC-12)', async () => {
    installAuthBackend();
    renderAt('/settings#ai-key');
    expect(await screen.findByTestId('settings-ai-key-anonymous')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-key-input')).toBeNull();
    expect(screen.queryByTestId('settings-grok-connect')).toBeNull();
    expect(screen.queryByTestId('settings-ai-model-select')).toBeNull();
    expect(screen.getByTestId('settings-ai-key-section')).toHaveAttribute('id', 'ai-key');
    expect(document.getElementById('ai-providers')).toBeTruthy();
    expect(screen.getByTestId('settings-ai-key-panel')).toHaveTextContent(
      AUTH_COPY.settings.aiKey.heading,
    );
  });

  it('oauth_expired vs oauth_unlinked vs subscription_unavailable stay distinct (AC-14/15)', async () => {
    const C = AUTH_COPY.settings.aiKey;
    const cases = [
      {
        reason: 'oauth_expired' as const,
        connected: true,
        id: 'settings-grok-expired',
        copy: C.grokExpired,
        others: ['settings-grok-unlinked', 'settings-grok-subscription-unavailable'] as const,
        connect: true,
      },
      {
        reason: 'oauth_unlinked' as const,
        connected: false,
        id: 'settings-grok-unlinked',
        copy: C.grokUnlinked,
        others: ['settings-grok-expired', 'settings-grok-subscription-unavailable'] as const,
        connect: true,
      },
      {
        reason: 'subscription_unavailable' as const,
        connected: true,
        id: 'settings-grok-subscription-unavailable',
        copy: C.grokSubscriptionUnavailable,
        others: ['settings-grok-expired', 'settings-grok-unlinked'] as const,
        connect: false,
      },
    ];
    for (const c of cases) {
      uninstallAuthBackend();
      cleanup();
      installAuthBackend({
        session: userSession('u-1', 'a@x.com'),
        aiKey: {
          storage_available: true,
          put: 'ok',
          slots: emptyAiSlots(),
          grok: { available: true, connected: c.connected, unavailable_reason: c.reason },
          preference: { power_path: null, provider: null, model: 'claude-opus-4-8' },
          catalog: defaultAiCatalog(),
        },
      });
      renderAt('/settings');
      const block = await screen.findByTestId(c.id);
      expect(block).toHaveTextContent(c.copy);
      expect(block.textContent ?? '').not.toMatch(/Convexa Grok pool|free|cheaper|included/i);
      for (const other of c.others) expect(screen.queryByTestId(other)).toBeNull();
      if (c.connect) expect(screen.getByTestId('settings-grok-connect')).toBeInTheDocument();
      else expect(screen.queryByTestId('settings-grok-connect')).toBeNull();
      if (c.reason === 'oauth_expired') {
        expect(block.querySelector('.MuiAlert-icon')).toBeTruthy();
      }
    }
  });

  it('add / replace / remove isolate per provider and never echo the secret (AC-1–4)', async () => {
    const be = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    const user = userEvent.setup();
    renderAt('/settings');
    await screen.findByTestId('settings-ai-key-matrix');

    // Surfaces fidelity repair (change 3/F7): the matrix is now provider TABS — one key panel for
    // the selected provider (design/src/screens/settings.mjs:52-63) — so each provider's fields
    // only exist in the DOM while its own tab is selected. `anthropic` is the shipped default tab;
    // selecting it explicitly here is harmless and keeps the loop uniform.
    for (const provider of BYO_PROVIDERS) {
      await user.click(screen.getByTestId(`settings-ai-key-tab-${provider}`));
      const inputId =
        provider === 'anthropic' ? 'settings-ai-key-input' : `settings-ai-key-input-${provider}`;
      const addId =
        provider === 'anthropic' ? 'settings-ai-key-add' : `settings-ai-key-add-${provider}`;
      await user.click(screen.getByTestId(inputId));
      await user.paste(RAW[provider]);
      await user.click(screen.getByTestId(addId));
      const last4 = RAW[provider].slice(-4);
      await waitFor(() =>
        expect(
          screen.getByTestId(
            provider === 'anthropic'
              ? 'settings-ai-key-masked'
              : `settings-ai-key-masked-${provider}`,
          ),
        ).toHaveTextContent(maskedKeyLabel(last4)),
      );
      expect(document.body.textContent ?? '').not.toContain(RAW[provider]);
    }

    expect(be.aiKeyPutBodies).toHaveLength(4);
    for (const provider of BYO_PROVIDERS) {
      expect(be.aiKeyPutBodies.some((b) => b.includes(`"provider":"${provider}"`))).toBe(true);
    }
    // Other slots stay set after adding the last one — asserted against the BACKEND STATE, which
    // holds regardless of which provider's tab happens to be selected.
    expect(be.state.aiKey.slots.anthropic.set).toBe(true);
    expect(be.state.aiKey.slots.openai.set).toBe(true);
    expect(be.state.aiKey.slots.xai.set).toBe(true);
    expect(be.state.aiKey.slots.gemini.set).toBe(true);

    // Replace OpenAI only (select its tab first).
    await user.click(screen.getByTestId('settings-ai-key-tab-openai'));
    await user.click(screen.getByTestId('settings-ai-key-replace-openai'));
    const rotated = 'sk-openai-rotated-9999';
    await user.click(screen.getByTestId('settings-ai-key-input-openai'));
    await user.paste(rotated);
    await user.click(screen.getByTestId('settings-ai-key-replace-submit-openai'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-ai-key-masked-openai')).toHaveTextContent(
        maskedKeyLabel('9999'),
      ),
    );
    expect(document.body.textContent ?? '').not.toContain(rotated);
    // Anthropic's own key is untouched by the OpenAI replace — switch to its tab to observe it.
    await user.click(screen.getByTestId('settings-ai-key-tab-anthropic'));
    expect(screen.getByTestId('settings-ai-key-masked')).toHaveTextContent(maskedKeyLabel('1234'));

    // Remove Gemini only (select its tab first).
    await user.click(screen.getByTestId('settings-ai-key-tab-gemini'));
    await user.click(screen.getByTestId('settings-ai-key-remove-gemini'));
    await user.click(screen.getByTestId('settings-ai-key-remove-confirm-btn-gemini'));
    expect(await screen.findByTestId('settings-ai-key-empty-gemini')).toBeInTheDocument();
    expect(be.state.aiKey.slots.gemini.set).toBe(false);
    expect(be.state.aiKey.slots.anthropic.set).toBe(true);
  });

  it('Use this key writes own_key and is how you leave the subscription path (AC-11)', async () => {
    const be = installAuthBackend({
      session: userSession('u-1', 'a@x.com'),
      aiKey: {
        storage_available: true,
        put: 'ok',
        slots: {
          ...emptyAiSlots(),
          anthropic: { set: true, last4: '1234' },
          openai: { set: true, last4: '5678' },
        },
        grok: { available: false, connected: false, unavailable_reason: null },
        preference: { power_path: 'own_key', provider: 'anthropic', model: 'claude-opus-4-8' },
        catalog: defaultAiCatalog(),
      },
    });
    const user = userEvent.setup();
    renderAt('/settings');
    await screen.findByTestId('settings-ai-key-set');
    // Default tab is `anthropic` (BYO_PROVIDERS[0]), which happens to match this fixture's
    // standing preference — its own "active" chip is visible without switching tabs.
    expect(screen.getByTestId('settings-ai-key-active-anthropic')).toBeInTheDocument();
    await user.click(screen.getByTestId('settings-ai-key-tab-openai'));
    await user.click(screen.getByTestId('settings-ai-key-use-openai'));
    await waitFor(() => expect(be.state.aiKey.preference.provider).toBe('openai'));
    expect(be.state.aiKey.preference.power_path).toBe('own_key');
    expect(await screen.findByTestId('settings-ai-key-active-openai')).toBeInTheDocument();
  });

  it('changing the model writes the standing preference (AC-6)', async () => {
    const catalog = defaultAiCatalog();
    catalog.providers = catalog.providers.map((p) =>
      p.provider === 'anthropic'
        ? {
            provider: 'anthropic',
            models: [
              { id: 'claude-opus-4-8', recommended: true },
              { id: 'claude-sonnet-4-5', recommended: false },
            ],
          }
        : p,
    );
    const be = installAuthBackend({
      session: userSession('u-1', 'a@x.com'),
      aiKey: {
        storage_available: true,
        put: 'ok',
        slots: emptyAiSlots(),
        grok: { available: false, connected: false, unavailable_reason: null },
        preference: { power_path: null, provider: null, model: 'claude-opus-4-8' },
        catalog,
      },
    });
    const user = userEvent.setup();
    renderAt('/settings');
    const select = await screen.findByRole('combobox', {
      name: AUTH_COPY.settings.aiKey.modelHeading,
    });
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: /claude-sonnet-4-5/ }));
    await waitFor(() => expect(be.state.aiKey.preference.model).toBe('claude-sonnet-4-5'));
  });

  it('Settings + Ask-AI powering copy never says free / pool / cheaper / included (AC-19)', () => {
    const blobs = [JSON.stringify(AUTH_COPY.settings.aiKey), JSON.stringify(POWERING)];
    for (const blob of blobs) {
      expect(blob).not.toMatch(/Convexa Grok pool/);
      expect(blob).not.toMatch(/\bfree\b/i);
      expect(blob).not.toMatch(/cheaper/i);
      expect(blob).not.toMatch(/\bincluded\b/i);
    }
  });
});
