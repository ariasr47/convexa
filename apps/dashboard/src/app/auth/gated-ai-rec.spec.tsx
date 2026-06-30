/**
 * Component/integration — the "Ask AI" gated action with the auth gate OUTERMOST over ai-rec's own
 * gating (D6f, UX_BLUEPRINT §2.7, AC-E4/E5/E6/E7). Mounts the REAL AiRecPanel + the REAL
 * useAiRecommendation hook under the auth providers, mocking ONLY the network boundary.
 *
 * Traceability: T-E4 (gated logged-out, NO cooldown/cap/no_key), T-E5 (signed-in ⇒ proceeds into the
 * existing ai-rec gating; auth-first order), T-E6 (manual export floor stays anonymous-usable),
 * T-E7 (server 403 ⇒ prompt, nothing produced).
 */
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { TickerBundle } from '@org/api';
import { AuthProvider } from './AuthContext';
import { AuthDialogProvider } from './AuthDialogProvider';
import { AUTH_COPY } from './copy';
import { AiRecPanel } from '../ai-rec/AiRecPanel';
import { useAiRecommendation } from '../ai-rec/useAiRecommendation';
import { COPY } from '../ai-rec/copy';
import {
  installAuthBackend, uninstallAuthBackend, userSession, makeBundle, type AuthBackend,
} from './testBackend';

function PanelHarness({ bundle }: { bundle: TickerBundle }) {
  const [readPersonaId, setReadPersonaId] = useState('default');
  const ai = useAiRecommendation('TSLA', bundle, {
    personaId: null, personaName: 'Default (no persona)', dteMin: 7, dteMax: 45, darkPool: true,
  });
  return (
    <AiRecPanel
      ticker="TSLA" bundle={bundle} ai={ai} personas={[]} activePersonaId="default"
      dataAge="30s ago"
      onAccept={() => undefined}
      onViewExport={() => undefined}
      readPersonaId={readPersonaId} onChangeReadPersona={setReadPersonaId}
    />
  );
}

function Mount({ bundle }: { bundle: TickerBundle }) {
  // The AiRecPanel now uses `useNavigate` for the byo-ai-key "Add your key in Settings" CTA, so it
  // must mount under a Router (it always does in the app; the harness mirrors that).
  return (
    <MemoryRouter initialEntries={['/ticker/TSLA']}>
      <AuthProvider>
        <AuthDialogProvider>
          <PanelHarness bundle={bundle} />
        </AuthDialogProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

let backend: AuthBackend;
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); uninstallAuthBackend(); localStorage.clear(); });

describe('Ask AI — gated logged out (AC-E4, D6f)', () => {
  it('T-E4: the LLM is NOT invoked and NO cooldown/cap/no_key is shown — only the sign-in prompt', async () => {
    backend = installAuthBackend(); // anonymous
    const user = userEvent.setup();
    render(<Mount bundle={makeBundle()} />);

    // The auth-outermost gate region is shown with the sign-in prompt copy.
    expect(await screen.findByTestId('ai-rec-auth-gate')).toBeInTheDocument();
    expect(screen.getByTestId('ai-rec-signin-prompt')).toHaveTextContent(AUTH_COPY.askAi.signedOut);
    // The signed-out state shows the sign-in CTA only — no disabled Get button (Figma 149:598).
    expect(screen.getByTestId('ai-rec-signin-button')).toBeEnabled();
    // ai-rec's OWN messaging is NOT shown (auth outermost): no cooldown / cap / no_key copy.
    expect(screen.queryByText(COPY.noKey.chip)).not.toBeInTheDocument();
    expect(screen.queryByText(/cooldown|daily limit|reached/i)).not.toBeInTheDocument();
    // The LLM POST was never issued.
    expect(backend.calls.recPost).toBe(0);
  });

  it('T-E6: the manual export floor stays anonymous-usable', async () => {
    backend = installAuthBackend(); // anonymous
    render(<Mount bundle={makeBundle()} />);
    // The "View what's sent" export control renders even when logged out (the floor).
    expect(await screen.findAllByText(COPY.action.viewExport)).not.toHaveLength(0);
  });
});

describe('Ask AI — enabled signed in (AC-E5, auth-first-then-ai-rec)', () => {
  it('T-E5: signed in ⇒ the LLM invoke proceeds (auth passes, then ai-rec gating runs)', async () => {
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com') });
    const user = userEvent.setup();
    render(<Mount bundle={makeBundle()} />);

    // No auth gate region when signed in; the real Get button is present.
    await waitFor(() => expect(screen.queryByTestId('ai-rec-auth-gate')).not.toBeInTheDocument());
    const get = await screen.findByRole('button', { name: COPY.action.get });
    await waitFor(() => expect(get).toBeEnabled());
    await user.click(get);
    // Auth passed FIRST, so the ai-rec invoke is issued (then the existing gating applies).
    await waitFor(() => expect(backend.calls.recPost).toBe(1));
  });
});

describe('Ask AI — server-enforced gate (AC-E7)', () => {
  it('T-E7: signed-in FE but the server rejects with 403 ⇒ sign-in prompt, nothing produced', async () => {
    // The FE believes it is signed in, but the server-side auth check rejects (stale cookie).
    backend = installAuthBackend({ session: userSession('u-1', 'a@x.com'), gatedAction: 'auth_required' });
    const user = userEvent.setup();
    render(<Mount bundle={makeBundle()} />);

    // Wait for who-am-I to resolve signed-in (the auth-gate region disappears, real Get appears).
    await waitFor(() => expect(screen.queryByTestId('ai-rec-auth-gate')).not.toBeInTheDocument());
    const get = await screen.findByRole('button', { name: COPY.action.get });
    await waitFor(() => expect(get).toBeEnabled());
    await user.click(get);
    // The POST was attempted (FE thought it was allowed) but the server returned 403.
    await waitFor(() => expect(backend.calls.recPost).toBe(1));
    // The FE re-syncs who-am-I and surfaces the sign-in prompt; no rec body was produced.
    expect(await screen.findByTestId('ai-rec-signin-prompt')).toHaveTextContent(AUTH_COPY.askAi.signedOut);
    expect(screen.queryByText(/Rationale/)).not.toBeInTheDocument();
  });
});
