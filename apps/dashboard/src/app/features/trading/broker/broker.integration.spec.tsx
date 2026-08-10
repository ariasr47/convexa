/**
 * F8 — the CENTERPIECE integration: the real App, the real router, the real Positions page and
 * Settings page, driven through the whole broker journey with ONLY the network boundary mocked
 * (a STATEFUL fetch mock standing in for the server — never the store, never the derivation).
 *
 * The journey (SPEC §4 flows 1/2/4): never-connected S1 → the CTA deep-links `/settings#brokerage`
 * → both halves saved (masked hint) → back to Positions → S2 first-sync while the first read is
 * in flight → S3 populated with the provenance header + read-only rows → a THROTTLED refresh
 * renders the honest unchanged-and-why note → Disconnect (confirm) → S1 again with NO residual
 * broker row text anywhere (AC-3 FE arm).
 */
import type { BrokerBook } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { theme } from '@/shared/theme/theme';
import { BROKER_COPY } from './copy';
import { POS_SPREAD, optionLeg, supplied } from './fixtures';

// =================================================================================================
// The stateful "server" — the network boundary, and nothing else
// =================================================================================================

/** A broker book on a DISTINCT underlying so residual-text assertions cannot collide with the
 *  sim page's own ticker copy. */
const NVDA_SPREAD = {
  ...POS_SPREAD,
  broker_position_id: 'bp-nvda-1',
  legs: [
    optionLeg({
      symbol: 'NVDA260918C00120000',
      underlying: 'NVDA',
      expiry: '2026-09-18',
      strike: 120,
      quantity: 1,
      cost_basis: supplied(6.1),
    }),
    optionLeg({
      symbol: 'NVDA260918C00130000',
      underlying: 'NVDA',
      expiry: '2026-09-18',
      strike: 130,
      quantity: -1,
      cost_basis: supplied(2.4),
    }),
  ],
};

interface ServerState {
  credentialSet: boolean;
  last4: string | null;
  /** Deferred first read after connect — how S2 becomes observable. */
  pendingBookResolvers: ((book: BrokerBook) => void)[];
  deferNextBookRead: boolean;
}

let server: ServerState;
let asOfIso: string;
let fetchMock: ReturnType<typeof vi.fn>;

function servedBook(): BrokerBook {
  return {
    state: 'ok',
    as_of: asOfIso,
    basis: 'cache',
    stale_after_seconds: 300,
    account_ref: 'acctref0123456789',
    positions: [NVDA_SPREAD],
    last_attempt_at: asOfIso,
    last_attempt_outcome: 'ok',
  };
}

const NO_CREDENTIAL_BOOK: BrokerBook = {
  state: 'unknown',
  reason: 'no_credential_stored',
  positions: [],
};

/** A complete-enough bundle for the Positions page derivations (the positions.integration shape). */
function makeBundle() {
  const strike = (s: number) => ({
    strike: s,
    net_gex: 0,
    call_gex: 0,
    put_gex: 0,
    call_oi: 10,
    put_oi: 10,
    total_oi: 20,
    net_dex: 0,
    call_dex: 0,
    put_dex: 0,
    volume: 5,
    vol_oi_ratio: 0.25,
  });
  return {
    market_state: { ticker: 'TSLA', price: 250, gex_spot: 250, timestamp: 1 },
    signals: {
      ticker: 'TSLA',
      regime: 'positive_gamma',
      regime_note: null,
      vol_regime: 'neutral',
      distances: {},
      setups: [],
      opportunity_score: 42,
      opportunity_tier: 'watch',
      prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [strike(245), strike(250)] },
    expirations: [{ date: '2026-09-18', dte: 47 }],
    ai_eval: {
      ready: true,
      reasons: [],
      changed: true,
      state_fingerprint: 'fp',
      score_threshold: 50,
    },
    meta: {
      served_at: asOfIso,
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: asOfIso,
        data_age_seconds: 10,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    off_exchange: null,
    position_eval: null,
  };
}

beforeEach(() => {
  localStorage.clear();
  asOfIso = new Date(Date.now() - 30_000).toISOString(); // genuinely fresh vs the real clock
  server = {
    credentialSet: false,
    last4: null,
    pendingBookResolvers: [],
    deferNextBookRead: false,
  };

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const json = (b: unknown, status = 200) =>
    new Response(b === null ? 'null' : JSON.stringify(b), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/auth/session'))
      return json({
        authenticated: true,
        user: { id: 'u', email: 'o@x.y', display_name: null, auth_methods: ['password'] },
        google_available: false,
        settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
      });
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/auth/ai-key'))
      return json({ set: false, last4: null, storage_available: true });
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/recommendation/status/'))
      return json({
        availability: { in_app_enabled: false },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 0, resets_at: '2026-08-02T04:00:00Z' },
      });
    if (url.includes('/api/ticker/')) return json(makeBundle());
    if (url.includes('/api/contract/'))
      return json({
        ticker: 'NVDA',
        expiration: '2026-09-18',
        strike: 120,
        right: 'call',
        option_quote: { bid: 6.4, ask: 6.8, mid: 6.6 },
        greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
        iv: 0.5,
        dte: 47,
      });

    // ---- The broker surface (stateful) ----------------------------------------------------------
    if (url.includes('/api/broker/credential')) {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { app_key: string; app_secret: string };
        server.credentialSet = true;
        server.last4 = body.app_key.slice(-4);
        server.deferNextBookRead = true; // the FIRST read after connect hangs → S2 is observable
        return json({ set: true, last4: server.last4, storage_available: true });
      }
      if (init?.method === 'DELETE') {
        server.credentialSet = false;
        server.last4 = null;
        // Server cache invalidated on delete (AC-3) — the next read is the no-credential arm.
        return json({ set: false, storage_available: true });
      }
      return json({ set: server.credentialSet, last4: server.last4, storage_available: true });
    }
    if (url.includes('/api/broker/book/refresh') && init?.method === 'POST') {
      // Throttled: cached snapshot, basis cache, last_attempt_at UNMOVED (C4/C5).
      return json(server.credentialSet ? servedBook() : NO_CREDENTIAL_BOOK);
    }
    if (url.includes('/api/broker/book')) {
      if (!server.credentialSet) return json(NO_CREDENTIAL_BOOK);
      if (server.deferNextBookRead) {
        server.deferNextBookRead = false;
        return new Promise<Response>((resolve) => {
          server.pendingBookResolvers.push((book) => resolve(json(book)));
        });
      }
      return json(servedBook());
    }
    throw new Error(`Unexpected fetch in the broker integration suite: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderApp() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/positions']}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

// =================================================================================================
// The journey
// =================================================================================================

describe('broker-connect · the full journey through the real app', () => {
  it('S1 → connect via #brokerage → S2 → S3 rows → throttled refresh note → disconnect → S1, no residue', async () => {
    const user = userEvent.setup();
    renderApp();

    // ---- 1. Positions → Broker tab → S1 (never an empty table) -------------------------------
    await screen.findByTestId('portfolio-panel');
    await user.click(screen.getByTestId('tab-live'));
    const s1 = await screen.findByTestId('broker-s1');
    expect(within(s1).getByText(BROKER_COPY.s1.heading)).toBeInTheDocument();

    // ---- 2. The CTA deep-links the REAL router to /settings#brokerage -------------------------
    await user.click(screen.getByTestId('broker-connect-cta'));
    await screen.findByTestId('settings-brokerage-section');

    // ---- 3. Save both halves → masked hint (write-only round trip) ----------------------------
    await user.type(screen.getByTestId('settings-brokerage-app-key'), 'wb-key-000042');
    await user.type(screen.getByTestId('settings-brokerage-app-secret'), 'wb-secret-xyz');
    await user.click(screen.getByTestId('settings-brokerage-connect'));
    await screen.findByTestId('settings-brokerage-set');
    expect(screen.getByTestId('settings-brokerage-masked')).toHaveTextContent('····0042');

    // ---- 4. Back to Positions → Broker: S2 while the FIRST read is in flight ------------------
    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    await user.click(screen.getByTestId('tab-live'));
    await screen.findByTestId('broker-s2');
    expect(screen.getByText(BROKER_COPY.s2)).toBeInTheDocument();
    expect(screen.queryByTestId('broker-row')).toBeNull(); // no numbers, no zero-count

    // ---- 5. The read lands → S3: provenance header + read-only rows ---------------------------
    act(() => {
      server.pendingBookResolvers.forEach((r) => r(servedBook()));
      server.pendingBookResolvers = [];
    });
    await screen.findByTestId('broker-rows');
    expect(screen.getByTestId('broker-provenance-header')).toBeInTheDocument();
    expect(screen.getByTestId('broker-readonly-chip')).toHaveTextContent('Webull · read-only');
    expect(screen.getByTestId('broker-as-of-stamp')).toBeInTheDocument();
    expect(screen.getByTestId('broker-count')).toHaveTextContent('1 position');
    // broker-option-grouping: NVDA_SPREAD is ONE position carrying TWO option legs — the
    // anti-coincidence case (SPEC §2.4/§2.6, `BOOK_CF_TWO_LEG_MEMBER`) — so it renders as a 2-leg
    // GROUP header, not a lone-leg row; its underlying member still renders (hidden) inside the
    // collapsed panel, so "NVDA" is now present at least twice (header + nested member).
    expect(screen.getAllByText(/NVDA/).length).toBeGreaterThan(0);
    // Read-only is ABSENCE, even here in the full app.
    expect(screen.queryByRole('button', { name: /^(close|trim|roll)$/i })).toBeNull();

    // ---- 6. Throttled refresh → the honest unchanged-and-why note (AC-8) ----------------------
    await user.click(screen.getByTestId('broker-refresh'));
    const note = await screen.findByTestId('broker-refresh-note');
    expect(note).toHaveTextContent('Unchanged — still your book as of');
    expect(note).toHaveTextContent('protecting your rate limits');

    // ---- 7. Disconnect in Settings (avatar → inline confirm → DELETE) --------------------------
    await user.click(screen.getByTestId('account-avatar'));
    await screen.findByTestId('settings-brokerage-set');
    await user.click(screen.getByTestId('settings-brokerage-disconnect'));
    await user.click(await screen.findByTestId('settings-brokerage-disconnect-confirm-btn'));
    await screen.findByTestId('settings-brokerage-empty'); // hint back to not-set

    // ---- 8. Back on the Broker tab: S1 again, and NO residual broker row text (AC-3) -----------
    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('portfolio-panel');
    await user.click(screen.getByTestId('tab-live'));
    await screen.findByTestId('broker-s1');
    expect(screen.queryByTestId('broker-row')).toBeNull();
    expect(screen.queryByText(/NVDA/)).toBeNull(); // no field of the old book survives anywhere
    expect(screen.queryByTestId('broker-as-of-stamp')).toBeNull();
  }, 30000);
});
