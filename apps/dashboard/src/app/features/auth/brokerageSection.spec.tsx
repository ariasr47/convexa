/**
 * F5 — the Settings "Brokerage" section (byo-ai-key shape). The invariants automated here:
 * write-only round trip (no typed half EVER rendered after save), both-halves-or-nothing client
 * validation mirroring the server 422, disconnect confirm → DELETE → not-set hint, the
 * storage-unavailable contained note, and the anonymous sign-in prompt.
 */
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { AuthDialogProvider } from './AuthDialogProvider';
import { BrokerageSection } from './BrokerageSection';
import { AUTH_COPY } from './copy';

const C = AUTH_COPY.settings.brokerage;
const theme = createTheme();

const APP_KEY = 'wb-app-key-000042';
const APP_SECRET = 'wb-app-secret-77secret';

let fetchMock: ReturnType<typeof vi.fn>;

function install(opts: {
  authenticated?: boolean;
  hint?: { set: boolean; last4: string | null; storage_available: boolean };
  putResponse?: { set: boolean; last4?: string | null; storage_available: boolean } | 422;
} = {}) {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  let hint = opts.hint ?? { set: false, last4: null, storage_available: true };
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/auth/session'))
      return json(
        opts.authenticated === false
          ? { authenticated: false, user: null, google_available: false, settings: null }
          : {
              authenticated: true,
              user: { id: 'u', email: 'o@x.y', display_name: null, auth_methods: ['password'] },
              google_available: false,
              settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
            },
      );
    if (url.includes('/api/broker/credential')) {
      if (init?.method === 'PUT') {
        if (opts.putResponse === 422)
          return json({ error: 'validation', message: 'both halves required' }, 422);
        const body = JSON.parse(String(init.body)) as { app_key: string; app_secret: string };
        hint = (opts.putResponse as typeof hint | undefined) ?? {
          set: true,
          last4: body.app_key.slice(-4),
          storage_available: true,
        };
        return json(hint);
      }
      if (init?.method === 'DELETE') {
        hint = { set: false, last4: null, storage_available: hint.storage_available };
        return json(hint);
      }
      return json(hint);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function renderSection() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthProvider>
          <AuthDialogProvider>
            <BrokerageSection />
          </AuthDialogProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BrokerageSection', () => {
  it('connect flow: two-field form → masked hint; NO typed half is rendered anywhere afterwards', async () => {
    install();
    const { container } = renderSection();
    await screen.findByTestId('settings-brokerage-empty');

    await userEvent.type(screen.getByTestId('settings-brokerage-app-key'), APP_KEY);
    await userEvent.type(screen.getByTestId('settings-brokerage-app-secret'), APP_SECRET);
    await userEvent.click(screen.getByTestId('settings-brokerage-connect'));

    await screen.findByTestId('settings-brokerage-set');
    expect(screen.getByTestId('settings-brokerage-masked')).toHaveTextContent(
      C.savedLabel('0042'),
    );
    // The write-only floor: neither half appears in the rendered document, in any element.
    expect(container.textContent).not.toContain(APP_KEY);
    expect(container.textContent).not.toContain(APP_SECRET);
    expect(container.innerHTML).not.toContain(APP_SECRET);
    // …and no reveal/show/copy control exists.
    expect(screen.queryByText(/reveal|show key|copy key/i)).toBeNull();
  });

  it('both-halves-or-nothing: a single half never issues the PUT (client mirror of the 422)', async () => {
    install();
    renderSection();
    await screen.findByTestId('settings-brokerage-empty');
    await userEvent.type(screen.getByTestId('settings-brokerage-app-key'), APP_KEY);
    await userEvent.click(screen.getByTestId('settings-brokerage-connect'));

    expect(await screen.findByTestId('settings-brokerage-validation')).toHaveTextContent(
      C.validationBoth,
    );
    const puts = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(puts).toHaveLength(0);
  });

  it('a server 422 renders the validation copy and echoes NO fragment of either input', async () => {
    install({ putResponse: 422 });
    const { container } = renderSection();
    await screen.findByTestId('settings-brokerage-empty');
    await userEvent.type(screen.getByTestId('settings-brokerage-app-key'), APP_KEY);
    await userEvent.type(screen.getByTestId('settings-brokerage-app-secret'), APP_SECRET);
    await userEvent.click(screen.getByTestId('settings-brokerage-connect'));

    await screen.findByTestId('settings-brokerage-validation');
    // The inputs still hold the draft (type=password), but no TEXT node echoes a fragment.
    expect(container.textContent).not.toContain(APP_KEY.slice(-8));
    expect(container.textContent).not.toContain(APP_SECRET.slice(-8));
  });

  it('disconnect: inline confirm (Disconnect / Keep connection) → DELETE → the not-set form returns', async () => {
    install({ hint: { set: true, last4: '0042', storage_available: true } });
    renderSection();
    await screen.findByTestId('settings-brokerage-set');

    await userEvent.click(screen.getByTestId('settings-brokerage-disconnect'));
    const confirm = await screen.findByTestId('settings-brokerage-disconnect-confirm');
    expect(confirm).toHaveTextContent(C.disconnectConfirmTitle);
    expect(confirm).toHaveTextContent(C.disconnectConfirmBody);
    expect(screen.getByTestId('settings-brokerage-disconnect-cancel')).toHaveTextContent(
      C.disconnectCancelBtn,
    );

    await userEvent.click(screen.getByTestId('settings-brokerage-disconnect-confirm-btn'));
    await screen.findByTestId('settings-brokerage-empty');
    const deletes = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'DELETE',
    );
    expect(deletes).toHaveLength(1);
    expect(screen.queryByTestId('settings-brokerage-set')).toBeNull();
  });

  it('Keep connection aborts: no DELETE issued, the hint stays', async () => {
    install({ hint: { set: true, last4: '0042', storage_available: true } });
    renderSection();
    await screen.findByTestId('settings-brokerage-set');
    await userEvent.click(screen.getByTestId('settings-brokerage-disconnect'));
    await userEvent.click(await screen.findByTestId('settings-brokerage-disconnect-cancel'));
    await waitFor(() =>
      expect(screen.queryByTestId('settings-brokerage-disconnect-confirm')).toBeNull(),
    );
    expect(
      fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE'),
    ).toHaveLength(0);
    expect(screen.getByTestId('settings-brokerage-masked')).toBeInTheDocument();
  });

  it('storage-unavailable: contained info note (never error-red), inputs disabled', async () => {
    install({ hint: { set: false, last4: null, storage_available: false } });
    renderSection();
    const note = await screen.findByTestId('settings-brokerage-storage-unavailable');
    expect(note).toHaveTextContent(C.storageUnavailable);
    expect(note.className).toMatch(/colorInfo|MuiAlert-standardInfo/);
    expect(screen.getByTestId('settings-brokerage-app-key')).toBeDisabled();
    expect(screen.getByTestId('settings-brokerage-connect')).toBeDisabled();
  });

  it('anonymous: the sign-in prompt, and NO broker request is issued', async () => {
    install({ authenticated: false });
    renderSection();
    await screen.findByTestId('settings-brokerage-anonymous');
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/broker/')),
    ).toHaveLength(0);
  });
});
