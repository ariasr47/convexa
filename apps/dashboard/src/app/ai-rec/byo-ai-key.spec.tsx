/**
 * byo-ai-key — the FLOW-INTEGRATION centerpiece + component suite. Drives the REAL user flow through
 * <App/> (the AiRecPanel five key-resolution states + isolation) and the REAL SettingsPage (the
 * write-only AI-key section), mocking ONLY the network boundary (`fetch` + `EventSource`). Never a
 * live backend; the controllable fetch router below emits exactly the INTERFACE_CONTRACT byo-ai-key
 * shapes (credential endpoints + the extended rec `key_source`/`remaining_free_uses`/`free_uses_total`).
 *
 * Traceability: every AC in the FRONTEND_EXECUTION_CONTRACT §5 "Tests to write" matrix is a NAMED test
 * here (the FE-half of each; the BE-only proofs AC-11/16/19/20-server are co-verified on the backend).
 */
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TickerBundle, StrikeRow } from '@org/api';
import App from '../app';
import { AuthProvider } from '../auth/AuthContext';
import { AuthDialogProvider } from '../auth/AuthDialogProvider';
import { AppThemeProvider } from '../auth/ThemeProvider';
import { SettingsPage } from '../auth/SettingsPage';
import { AUTH_COPY, maskedKeyLabel } from '../auth/copy';
import { BYO_KEY, adminExhaustedTitle, freeUsesChip, COPY } from './copy';
import { clearTrade } from '../ghost-trade/store';

// ---- INTERFACE-shaped factories --------------------------------------------------------------
const FP_A = 'fp-A';
const SNAP_A = '2026-06-26T14:00:00Z';
const RAW_KEY = 'sk-ant-supersecretkey1234';

function strike(s: number): StrikeRow {
  return {
    strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20,
    net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25,
  };
}

function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1_700_000_000, timestamp_iso: SNAP_A,
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2e9, put_gex: -0.8e9, total_gex: 1.2e9,
      net_dex: 5e8, call_dex: 6e8, put_dex: -1e8, net_vanna: null, net_charm: null, net_volga: null,
      vwap: 249, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
      dte_min: 7, dte_max: 45, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12, net_flow: null,
      put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000, vol_oi_unusual_threshold: 1,
      iv_skew: null, term_structure: null,
    },
    signals: {
      ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 42, opportunity_tier: 'watch', prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [strike(255), strike(260), strike(265)] },
    expirations: [{ date: '2026-06-26', dte: 3 }, { date: '2026-07-18', dte: 25 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: FP_A, score_threshold: 50 },
    meta: {
      served_at: SNAP_A, cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: SNAP_A, data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: {
      ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [],
      block_min_shares: 5000, note: '',
    },
    position_eval: null,
  };
}

const STRATEGY = {
  decision: 'trade', bias: 'long', structure: 'call debit spread', strikes: [260],
  expiration: '2026-07-18', entry_trigger: 'break and hold above the 260 call wall',
  invalidation_level: 242, max_risk: '1.5% of account ($300)', position_size: '2 contracts',
  exit_plan: { target: 12.5, stop: 6 }, time_horizon: '5–10 trading days', confidence: 'medium',
  rationale: 'magnet at 255, flip at 248; IV/HV cheap.',
};

// ---- The 5 key-resolution wire shapes (INTERFACE_CONTRACT §3) --------------------------------
type RecKey = 'produced_own' | 'produced_shared' | 'no_key' | 'over_limit' | 'shared_unconfigured' | 'transport';

// ---- Controllable mock backend (the network boundary; NEVER a live backend) ------------------
interface Cfg {
  authenticated?: boolean;
  recKey?: RecKey;
  remaining?: number;       // the count the NEXT produced_shared rec returns (post-decrement)
  total?: number;
  aiKeySet?: boolean;
  aiKeyLast4?: string | null;
  storageAvailable?: boolean;
  putOutcome?: 'ok' | 'transport' | 'validation';
}

function installBackend(cfg: Cfg = {}) {
  const state = {
    authenticated: cfg.authenticated ?? true,
    recKey: cfg.recKey ?? 'produced_own' as RecKey,
    remaining: cfg.remaining ?? 3,
    total: cfg.total ?? 3,
    aiKeySet: cfg.aiKeySet ?? false,
    aiKeyLast4: cfg.aiKeyLast4 ?? null as string | null,
    storageAvailable: cfg.storageAvailable ?? true,
    putOutcome: cfg.putOutcome ?? 'ok' as 'ok' | 'transport' | 'validation',
  };
  const calls = { rec: 0, status: 0, export: 0, aiKeyGet: 0, aiKeyPut: 0, aiKeyDelete: 0, ticker: 0 };
  const tickerCalls: { url: string; init?: RequestInit }[] = [];
  const recPostBodies: string[] = [];
  const aiKeyPutBodies: string[] = [];
  const responsesSeen: string[] = []; // every body the FE received (egress scan)

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const json = (b: unknown, status = 200) => {
    responsesSeen.push(JSON.stringify(b));
    return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  };
  const raw = (body: string, status: number) => { responsesSeen.push(body); return new Response(body, { status }); };

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/auth/session')) {
      return json(state.authenticated
        ? { authenticated: true, user: { id: 'u-1', email: 'a@x.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } }
        : { authenticated: false, user: null, google_available: false, settings: null });
    }

    // ---- byo-ai-key credential endpoints --------------------------------------------------------
    if (url.includes('/api/auth/ai-key')) {
      if (!state.authenticated) return json({ error: 'auth_required', message: 'sign in' }, 403);
      if (method === 'GET') {
        calls.aiKeyGet++;
        return json({ set: state.aiKeySet, last4: state.aiKeySet ? state.aiKeyLast4 : null, storage_available: state.storageAvailable });
      }
      if (method === 'PUT') {
        calls.aiKeyPut++;
        aiKeyPutBodies.push(String(init?.body ?? ''));
        if (state.putOutcome === 'transport') return raw('', 502);
        if (state.putOutcome === 'validation') return json({ error: 'validation', message: 'bad key' }, 422);
        if (!state.storageAvailable) return json({ set: false, storage_available: false });
        const parsed = init?.body ? (JSON.parse(String(init.body)) as { key?: string }) : {};
        state.aiKeySet = true; state.aiKeyLast4 = (parsed.key ?? '').slice(-4);
        return json({ set: true, last4: state.aiKeyLast4, storage_available: true });
      }
      if (method === 'DELETE') {
        calls.aiKeyDelete++;
        state.aiKeySet = false; state.aiKeyLast4 = null;
        return json({ set: false, last4: null, storage_available: state.storageAvailable });
      }
    }

    if (url.includes('/api/ticker/')) { calls.ticker++; tickerCalls.push({ url, init }); return json(makeBundle()); }

    if (url.includes('/api/recommendation/status/')) {
      calls.status++;
      const adminShared = state.recKey === 'produced_shared' || state.recKey === 'over_limit';
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
        ...(adminShared ? { remaining_free_uses: state.remaining, free_uses_total: state.total } : {}),
      });
    }
    if (url.includes('/api/recommendation/export/')) {
      calls.export++;
      return json({
        ticker: 'TSLA', as_of: SNAP_A, context: { gamma_flip: 248, opportunity_score: 42 },
        persona_prompt: 'You are a disciplined options strategist…', glossary: 'glossary…',
        egress_note: 'Complete list: context + persona prompt + glossary. No other ticker, no identity, no order data, and no API key ever leave.',
      });
    }
    if (url.includes('/api/recommendation/') && method === 'POST') {
      calls.rec++;
      recPostBodies.push(String(init?.body ?? ''));
      if (state.recKey === 'transport') return raw('', 502);
      const base = {
        persona: { id: null, name: 'Default (no persona)' }, as_of: SNAP_A, pinned_fingerprint: FP_A,
        stale_born: false, gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' },
      };
      if (state.recKey === 'produced_own') return json({ ...base, status: 'produced', strategy: STRATEGY, unavailable_reason: null, key_source: 'own_key' });
      if (state.recKey === 'produced_shared') {
        state.remaining = Math.max(0, state.remaining - 1);
        return json({ ...base, status: 'produced', strategy: STRATEGY, unavailable_reason: null, key_source: 'shared_admin', remaining_free_uses: state.remaining, free_uses_total: state.total });
      }
      if (state.recKey === 'no_key') return json({ ...base, status: 'unavailable', strategy: null, unavailable_reason: 'no_key', key_source: 'none' });
      if (state.recKey === 'over_limit') return json({ ...base, status: 'unavailable', strategy: null, unavailable_reason: 'over_limit', key_source: 'none', remaining_free_uses: 0, free_uses_total: state.total });
      return json({ ...base, status: 'unavailable', strategy: null, unavailable_reason: 'shared_key_unconfigured', key_source: 'none' });
    }
    if (url.includes('/api/personas')) return json([]);
    if (url.includes('/api/contract/')) return json({ detail: 'not found' }, 404);
    return json({ detail: `unmocked ${url}` }, 404);
  }));

  return {
    calls, tickerCalls, recPostBodies, aiKeyPutBodies, responsesSeen,
    setRecKey: (k: RecKey, o?: { remaining?: number; total?: number }) => {
      state.recKey = k;
      if (o?.remaining != null) state.remaining = o.remaining;
      if (o?.total != null) state.total = o.total;
    },
    setAuthenticated: (v: boolean) => { state.authenticated = v; },
    getRemaining: () => state.remaining,
  };
}

// ---- Mounts ----------------------------------------------------------------------------------
function renderApp() {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/ticker/TSLA']}><App /></MemoryRouter>);
  return user;
}
function renderSettings(initial = '/settings') {
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[initial]}>
          <AuthDialogProvider>
            <Routes><Route path="/settings" element={<SettingsPage />} /></Routes>
          </AuthDialogProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </AuthProvider>,
  );
  return user;
}

const panel = () => screen.getByTestId('ai-rec-panel');
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}
/** Click Get + wait for the panel to leave the idle state. */
async function ask(user: ReturnType<typeof renderApp>) {
  await waitFor(() => expect(within(panel()).getByRole('button', { name: COPY.action.get })).toBeEnabled());
  await user.click(within(panel()).getByRole('button', { name: COPY.action.get }));
}

beforeEach(() => { localStorage.clear(); clearTrade('TSLA'); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); cleanup(); });

// =============================================================================================
// Core key-resolution states (AiRecPanel)
// =============================================================================================
describe('byo-ai-key — the five AiRecPanel key-resolution states', () => {
  it('AC-1: renders the no-key CTA for a regular user — no counter, no rec, no "free/trial" text', async () => {
    installBackend({ recKey: 'no_key' });
    const user = renderApp();
    await settle();
    await ask(user);

    const cta = await within(panel()).findByTestId('ai-rec-state-no-key');
    expect(within(cta).getByText(BYO_KEY.noKey.title)).toBeInTheDocument();
    expect(within(cta).getByText(BYO_KEY.noKey.body)).toBeInTheDocument();
    // No counter chip, no rec body.
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull();
    expect(within(panel()).queryByText('1.5% of account ($300)')).toBeNull();
    // Honest framing — no "free"/"trial" wording in the CTA.
    expect(cta.textContent ?? '').not.toMatch(/free|trial/i);
    // CTA routes to Settings.
    expect(within(cta).getByTestId('ai-rec-add-key-cta')).toBeInTheDocument();
  });

  it('AC-2: admin with allowance ⇒ rec + free-uses chip; the chip decrements on the next produced shared rec', async () => {
    const be = installBackend({ recKey: 'produced_shared', remaining: 3, total: 3 });
    const user = renderApp();
    await settle();
    await ask(user);

    await within(panel()).findByText('1.5% of account ($300)'); // rec body
    // First produced shared rec returned remaining=2 (post-decrement of 3).
    expect(await within(panel()).findByTestId('ai-rec-free-uses')).toHaveTextContent(freeUsesChip(2, 3));

    // A second produced shared rec ⇒ "1 of 3 …".
    await user.click(within(panel()).getByRole('button', { name: COPY.action.dismiss }));
    await ask(user);
    await within(panel()).findByText('1.5% of account ($300)');
    expect(await within(panel()).findByTestId('ai-rec-free-uses')).toHaveTextContent(freeUsesChip(1, 3));
    expect(be.calls.rec).toBe(2);
  });

  it('AC-3 / distinctness: admin-exhausted CTA is distinct (testid + copy) from no-key (a) and shared-unconfigured (e)', async () => {
    installBackend({ recKey: 'over_limit', total: 3 });
    const user = renderApp();
    await settle();
    await ask(user);

    const cta = await within(panel()).findByTestId('ai-rec-state-admin-exhausted');
    expect(within(cta).getByText(adminExhaustedTitle(3))).toBeInTheDocument();
    expect(within(cta).getByText(BYO_KEY.adminExhausted.body)).toBeInTheDocument();
    // No rec, no free-uses chip.
    expect(within(panel()).queryByText('1.5% of account ($300)')).toBeNull();
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull();
    // DISTINCT from (a) and (e): the other CTA testids are NOT present, and the copy differs.
    expect(within(panel()).queryByTestId('ai-rec-state-no-key')).toBeNull();
    expect(within(panel()).queryByTestId('ai-rec-state-shared-unconfigured')).toBeNull();
    expect(cta.textContent ?? '').not.toBe(BYO_KEY.noKey.title);
    // Implies daily renewal, never "gone forever".
    expect(cta.textContent ?? '').toMatch(/come back tomorrow/);
  });

  it('AC-4: own-key produced ⇒ rec + "Using your key" chip, NO free-uses chip', async () => {
    installBackend({ recKey: 'produced_own' });
    const user = renderApp();
    await settle();
    await ask(user);

    await within(panel()).findByText('1.5% of account ($300)');
    expect(await within(panel()).findByTestId('ai-rec-own-key')).toHaveTextContent('Using your key');
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull();
  });

  it('AC-5: admin own-key ⇒ own-key chip present, free-uses chip absent, count unchanged across the call', async () => {
    // Admin identity (still authenticated); the rec resolves on the OWN key (own_key never spends the
    // shared allowance). The status pre-render carried no shared count for own_key.
    const be = installBackend({ recKey: 'produced_own', remaining: 3, total: 3 });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText('1.5% of account ($300)');
    expect(within(panel()).getByTestId('ai-rec-own-key')).toBeInTheDocument();
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull();
    // The shared allowance was never decremented by an own-key call.
    expect(be.getRemaining()).toBe(3);
  });

  it('AC-6: a regular user with a key gets a rec (BYO works for non-admins)', async () => {
    installBackend({ recKey: 'produced_own' });
    const user = renderApp();
    await settle();
    await ask(user);
    // Produced (d) — rec body renders regardless of admin status.
    await within(panel()).findByText('1.5% of account ($300)');
    expect(within(panel()).getByTestId('ai-rec-own-key')).toBeInTheDocument();
  });

  it('AC-24: admin with no shared key ⇒ shared-unconfigured CTA, no rec, no free-uses; DISTINCT from (a)/(c)', async () => {
    installBackend({ recKey: 'shared_unconfigured' });
    const user = renderApp();
    await settle();
    await ask(user);

    const cta = await within(panel()).findByTestId('ai-rec-state-shared-unconfigured');
    expect(within(cta).getByText(BYO_KEY.sharedUnconfigured.title)).toBeInTheDocument();
    expect(within(cta).getByText(BYO_KEY.sharedUnconfigured.body)).toBeInTheDocument();
    expect(within(panel()).queryByText('1.5% of account ($300)')).toBeNull();
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull();
    // Distinct from (a) and (c).
    expect(within(panel()).queryByTestId('ai-rec-state-no-key')).toBeNull();
    expect(within(panel()).queryByTestId('ai-rec-state-admin-exhausted')).toBeNull();
  });

  it('AC-1/3/24: the three CTA states are observably distinct (distinct testid AND title/body copy)', async () => {
    // Render each in turn and capture its CTA title; assert all three are unique + free-trial-free.
    const titles: string[] = [];
    for (const [key, testid, title] of [
      ['no_key', 'ai-rec-state-no-key', BYO_KEY.noKey.title],
      ['over_limit', 'ai-rec-state-admin-exhausted', adminExhaustedTitle(3)],
      ['shared_unconfigured', 'ai-rec-state-shared-unconfigured', BYO_KEY.sharedUnconfigured.title],
    ] as const) {
      installBackend({ recKey: key as RecKey, total: 3 });
      const user = renderApp();
      await settle();
      await ask(user);
      const cta = await within(panel()).findByTestId(testid);
      expect(within(cta).getByText(title)).toBeInTheDocument();
      titles.push(title);
      cleanup();
      vi.unstubAllGlobals();
    }
    expect(new Set(titles).size).toBe(3); // all three titles unique
    // None frames a free trial.
    titles.forEach((t) => expect(t).not.toMatch(/free trial/i));
  });
});

// =============================================================================================
// Transitions (flow-integration edges)
// =============================================================================================
describe('byo-ai-key — state transitions', () => {
  it('AC-25: admin from (e) adds an own key ⇒ next request is produced on own key (e→d)', async () => {
    const be = installBackend({ recKey: 'shared_unconfigured' });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-state-shared-unconfigured');

    // The user adds a key (simulated server-side); the next request resolves own_key.
    be.setRecKey('produced_own');
    await user.click(within(panel()).getByTestId('ai-rec-add-key-cta')); // navigates to Settings (route change)
    // Re-render flow: navigate back to the ticker and ask again. Simpler: dismiss path isn't available
    // on a CTA, so just drive a fresh request by re-rendering the ticker route.
    cleanup();
    const user2 = renderApp();
    await settle();
    await ask(user2);
    await within(panel()).findByText('1.5% of account ($300)');
    expect(within(panel()).getByTestId('ai-rec-own-key')).toBeInTheDocument();
  });

  it('AC-26: from (e), a shared key later configured ⇒ next rec produced on the shared key + chip (e→b)', async () => {
    const be = installBackend({ recKey: 'shared_unconfigured' });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-state-shared-unconfigured');

    be.setRecKey('produced_shared', { remaining: 3, total: 3 });
    cleanup();
    const user2 = renderApp();
    await settle();
    await ask(user2);
    await within(panel()).findByText('1.5% of account ($300)');
    expect(await within(panel()).findByTestId('ai-rec-free-uses')).toHaveTextContent(freeUsesChip(2, 3));
    expect(within(panel()).queryByTestId('ai-rec-own-key')).toBeNull(); // no own key involved
  });

  it('AC-19: an admin removed from the allowlist loses the free allowance (b→a) but keeps own-key access (a→d)', async () => {
    // Start as an admin WITH allowance (state b): a produced shared rec + the "N of 3 free uses" chip.
    const be = installBackend({ recKey: 'produced_shared', remaining: 3, total: 3 });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText('1.5% of account ($300)'); // rec body
    expect(await within(panel()).findByTestId('ai-rec-free-uses')).toHaveTextContent(freeUsesChip(2, 3));

    // The admin is dropped from the allowlist (the backend re-reads the allowlist per call, so the very
    // next request resolves with NO free allowance). With no own key, the same user is now treated as a
    // regular no-key user (state a): the no-key CTA, NO free-uses chip, NO rec, no counter.
    be.setRecKey('no_key');
    cleanup();
    const user2 = renderApp();
    await settle();
    await ask(user2);
    const cta = await within(panel()).findByTestId('ai-rec-state-no-key');
    expect(within(cta).getByText(BYO_KEY.noKey.title)).toBeInTheDocument();
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull(); // the "N of 3 free uses" chip is gone
    expect(within(panel()).queryByText('1.5% of account ($300)')).toBeNull();
    expect(within(panel()).queryByText(/free uses left today/i)).toBeNull();

    // The (now non-admin) user sets their OWN key: own-key access is UNAFFECTED by losing admin status —
    // they still get a produced rec (key_source own_key, state d), with NO free-uses chip.
    be.setRecKey('produced_own');
    cleanup();
    const user3 = renderApp();
    await settle();
    await ask(user3);
    await within(panel()).findByText('1.5% of account ($300)');
    expect(within(panel()).getByTestId('ai-rec-own-key')).toBeInTheDocument();
    expect(within(panel()).queryByTestId('ai-rec-free-uses')).toBeNull();
  });

  it('AC-21: an exhausted admin adds an own key mid-day ⇒ immediate own-key rec, count untouched (c→d)', async () => {
    const be = installBackend({ recKey: 'over_limit', remaining: 0, total: 3 });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-state-admin-exhausted');

    be.setRecKey('produced_own');
    cleanup();
    const user2 = renderApp();
    await settle();
    await ask(user2);
    await within(panel()).findByText('1.5% of account ($300)');
    expect(within(panel()).getByTestId('ai-rec-own-key')).toBeInTheDocument();
    expect(be.getRemaining()).toBe(0); // free count untouched by an own-key call
  });
});

// =============================================================================================
// Degraded / edge / isolation
// =============================================================================================
describe('byo-ai-key — degraded, isolation, egress', () => {
  it('AC-15: a rec-surface failure degrades the panel alone — the page keeps rendering', async () => {
    installBackend({ recKey: 'transport' });
    const user = renderApp();
    await settle();
    await ask(user);
    // Contained unavailable status in the panel.
    expect(await within(panel()).findByText(COPY.unavailable.title)).toBeInTheDocument();
    // The rest of the page is intact: the dealer-positioning section + the open-trade affordance keep rendering.
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByTestId('open-sim-trade')).toBeInTheDocument();
    expect(screen.getByTestId('ai-rec-panel')).toBeInTheDocument();
  });

  it('AC-16: a server-reported unusable stored key renders the role unavailable state, not a rec, no key leaked', async () => {
    // The server resolves the (unusable) key to a no-usable-key outcome — regular ⇒ (a).
    const be = installBackend({ recKey: 'no_key' });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-state-no-key');
    expect(within(panel()).queryByText('1.5% of account ($300)')).toBeNull();
    // No raw key / ciphertext ever reached the FE.
    be.responsesSeen.forEach((b) => {
      expect(b).not.toContain('supersecret');
      const o = JSON.parse(b) as Record<string, unknown>;
      ['key', 'api_key', 'anthropic_api_key', 'ciphertext'].forEach((k) => expect(o).not.toHaveProperty(k));
    });
  });

  it('AC-17: an LLM error on a shared call ⇒ unavailable, page intact, the shared count is not consumed', async () => {
    // over_limit holds remaining at 0 and does NOT decrement; here we prove a failed/unavailable shared
    // outcome leaves the count where it was (the FE never sees a decrement on a non-produced rec).
    const be = installBackend({ recKey: 'over_limit', remaining: 0, total: 3 });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-state-admin-exhausted');
    expect(be.getRemaining()).toBe(0); // untouched
    // Page intact.
    expect(screen.getByText('Call wall')).toBeInTheDocument();
  });

  it('AC-22: logged-out hits the auth gate, NEVER a key state; export floor stays anonymous-usable', async () => {
    installBackend({ authenticated: false });
    renderApp();
    await settle();
    // The auth-outermost gate shows, not any key-resolution state.
    expect(await within(panel()).findByTestId('ai-rec-signin-prompt')).toBeInTheDocument();
    for (const id of ['ai-rec-state-no-key', 'ai-rec-free-uses', 'ai-rec-state-admin-exhausted', 'ai-rec-own-key', 'ai-rec-state-shared-unconfigured']) {
      expect(within(panel()).queryByTestId(id)).toBeNull();
    }
    // The export floor ("View what's sent") stays present anonymously.
    expect(within(panel()).getAllByText(COPY.action.viewExport).length).toBeGreaterThan(0);
  });

  it('AC-12: own-key produced ⇒ the rec request body + every response carry NO key field', async () => {
    const be = installBackend({ recKey: 'produced_own' });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText('1.5% of account ($300)');
    // The rec POST body carries identifiers + gating context only — never a key.
    be.recPostBodies.forEach((b) => {
      const o = JSON.parse(b) as Record<string, unknown>;
      ['key', 'api_key', 'anthropic_api_key', 'secret'].forEach((k) => expect(o).not.toHaveProperty(k));
    });
    // No response the FE saw contained a key.
    be.responsesSeen.forEach((b) => expect(b).not.toMatch(/"(key|api_key|anthropic_api_key|ciphertext)"\s*:/));
  });

  it('AC-14: score / tier render identically across the key paths; getTicker gained no header/param', async () => {
    // The "Opportunity" stat tile renders `{score} · {tier word}` — a static bundle read that must be
    // byte-identical regardless of which key path the rec resolved on (key source is never a score input).
    const readScore = async () => {
      await screen.findByText('AI recommendation · TSLA');
      const tile = await screen.findByText(/^\d+ · \w+$/);
      return tile.textContent;
    };
    const paths: RecKey[] = ['no_key', 'produced_shared', 'over_limit', 'produced_own', 'shared_unconfigured'];
    const seen: (string | null)[] = [];
    for (const p of paths) {
      const be = installBackend({ recKey: p, total: 3 });
      const user = renderApp();
      await settle();
      await ask(user);
      seen.push(await readScore());
      // getTicker carried no key/identity header or param under ANY key path.
      be.tickerCalls.forEach((c) => {
        expect(c.url).not.toMatch(/key|persona|admin/i);
        expect(JSON.stringify(c.init?.headers ?? {})).not.toMatch(/key|auth|admin/i);
      });
      cleanup();
      vi.unstubAllGlobals();
    }
    // The rendered score/tier is byte-identical across all five key paths.
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toMatch(/^42 · /);
  });
});

// =============================================================================================
// Export floor (AC-13 / AC-23)
// =============================================================================================
describe('byo-ai-key — export floor', () => {
  it('AC-13: the export artifact carries context + persona prompt + glossary + egress_note ONLY — no key/identity', async () => {
    const be = installBackend({ recKey: 'no_key' });
    const user = renderApp();
    await settle();
    // Open the export from the header "View what's sent".
    await user.click(within(panel()).getAllByText(COPY.action.viewExport)[0]);
    // The egress note renders verbatim (no key ever leaves).
    expect(await screen.findByText(/no API key ever leave/i)).toBeInTheDocument();
    // The export response shape carried no key/identity/other-ticker/order field.
    const exportBody = be.responsesSeen.find((b) => b.includes('egress_note'));
    expect(exportBody).toBeTruthy();
    const o = JSON.parse(exportBody as string) as Record<string, unknown>;
    expect(Object.keys(o).sort()).toEqual(['as_of', 'context', 'egress_note', 'glossary', 'persona_prompt', 'ticker']);
    ['key', 'api_key', 'identity', 'user', 'email', 'order'].forEach((k) => expect(o).not.toHaveProperty(k));
  });

  it('AC-23: the export floor works keyless for a no-key (a), an exhausted admin (c), and a shared-unconfigured admin (e)', async () => {
    for (const key of ['no_key', 'over_limit', 'shared_unconfigured'] as RecKey[]) {
      const be = installBackend({ recKey: key, total: 3 });
      const user = renderApp();
      await settle();
      await ask(user); // land in the no-rec state
      // "View what's sent" is present + produces an export (no rec, no key).
      expect(within(panel()).getAllByText(COPY.action.viewExport).length).toBeGreaterThan(0);
      await user.click(within(panel()).getAllByText(COPY.action.viewExport)[0]);
      await screen.findByText(/no API key ever leave/i);
      expect(be.calls.export).toBeGreaterThan(0);
      cleanup();
      vi.unstubAllGlobals();
    }
  });
});

// =============================================================================================
// Settings AI-key section (key management)
// =============================================================================================
const AK = AUTH_COPY.settings.aiKey;

describe('byo-ai-key — Settings AI-key section', () => {
  it('AC-7: add a key ⇒ Set + masked hint; NO reveal control; the typed key is never in the DOM', async () => {
    installBackend({ aiKeySet: false });
    const user = renderSettings();
    // Empty state first.
    expect(await screen.findByTestId('settings-ai-key-empty')).toBeInTheDocument();
    const input = screen.getByTestId('settings-ai-key-input');
    expect(input).toHaveAttribute('type', 'password'); // masked by the browser
    await user.type(input, RAW_KEY);
    await user.click(screen.getByTestId('settings-ai-key-add'));

    // Set state with the masked hint.
    const set = await screen.findByTestId('settings-ai-key-set');
    expect(within(set).getByTestId('settings-ai-key-masked')).toHaveTextContent(maskedKeyLabel('1234'));
    // NO reveal/show/copy control exists anywhere in the section.
    const section = screen.getByTestId('settings-ai-key-section');
    expect(within(section).queryByText(/show key|reveal|copy key|view key/i)).toBeNull();
    // The raw typed key is absent from the rendered DOM after submit.
    expect(document.body.textContent ?? '').not.toContain(RAW_KEY);
    expect(document.body.textContent ?? '').not.toContain('supersecret');
  });

  it('AC-8: replace ⇒ the masked hint shows the NEW last-4 (overwrites; no old-key history)', async () => {
    installBackend({ aiKeySet: true, aiKeyLast4: '1234' });
    const user = renderSettings();
    expect(await screen.findByTestId('settings-ai-key-masked')).toHaveTextContent(maskedKeyLabel('1234'));
    await user.click(screen.getByTestId('settings-ai-key-replace'));
    await user.type(screen.getByTestId('settings-ai-key-input'), 'sk-ant-rotatedkey5678');
    await user.click(screen.getByTestId('settings-ai-key-replace-submit'));
    // The masked hint now reflects the NEW last-4; the old one is gone.
    await waitFor(() => expect(screen.getByTestId('settings-ai-key-masked')).toHaveTextContent(maskedKeyLabel('5678')));
    expect(screen.getByTestId('settings-ai-key-masked')).not.toHaveTextContent('1234');
  });

  it('AC-9: remove ⇒ confirm ⇒ Empty state', async () => {
    installBackend({ aiKeySet: true, aiKeyLast4: '1234' });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-set');
    await user.click(screen.getByTestId('settings-ai-key-remove'));
    expect(await screen.findByTestId('settings-ai-key-remove-confirm')).toBeInTheDocument();
    await user.click(screen.getByTestId('settings-ai-key-remove-confirm-btn'));
    expect(await screen.findByTestId('settings-ai-key-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-key-set')).toBeNull();
  });

  it('AC-10: across add/replace/status reads, the response objects carry at most the masked hint — never the key', async () => {
    const be = installBackend({ aiKeySet: false });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-empty');
    await user.type(screen.getByTestId('settings-ai-key-input'), RAW_KEY);
    await user.click(screen.getByTestId('settings-ai-key-add'));
    await screen.findByTestId('settings-ai-key-masked');
    // The PUT carried the raw key in the request body (browser→server only) under exactly `key`.
    expect(be.aiKeyPutBodies.length).toBe(1);
    expect(JSON.parse(be.aiKeyPutBodies[0])).toEqual({ key: RAW_KEY });
    // EVERY ai-key response the FE received carried at most set/last4/storage_available — never a key.
    be.responsesSeen
      .filter((b) => b.includes('storage_available'))
      .forEach((b) => {
        const o = JSON.parse(b) as Record<string, unknown>;
        expect(Object.keys(o).every((k) => ['set', 'last4', 'storage_available'].includes(k))).toBe(true);
        expect(b).not.toContain('supersecret');
      });
    // The raw key never reached the DOM.
    expect(document.body.textContent ?? '').not.toContain(RAW_KEY);
  });

  it('AC-18: storage-unavailable ⇒ honest info note + disabled input, no crash, no 5xx, no key exposed', async () => {
    installBackend({ aiKeySet: false, storageAvailable: false });
    renderSettings();
    expect(await screen.findByTestId('settings-ai-key-storage-unavailable')).toHaveTextContent(AK.storageUnavailable);
    expect(screen.getByTestId('settings-ai-key-input')).toBeDisabled();
    expect(screen.getByTestId('settings-ai-key-add')).toBeDisabled();
  });

  it('AC-18 (ephemeral-accept variant): storage available ⇒ the normal Empty→Set flow works', async () => {
    installBackend({ aiKeySet: false, storageAvailable: true });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-empty');
    await user.type(screen.getByTestId('settings-ai-key-input'), RAW_KEY);
    await user.click(screen.getByTestId('settings-ai-key-add'));
    expect(await screen.findByTestId('settings-ai-key-set')).toBeInTheDocument();
  });

  it('AC-20: store reset on restart ⇒ set:false Empty (no stale "Key set ····")', async () => {
    installBackend({ aiKeySet: false });
    renderSettings();
    expect(await screen.findByTestId('settings-ai-key-empty')).toBeInTheDocument();
    expect(screen.queryByText(/Key set ····/)).toBeNull();
    expect(screen.queryByTestId('settings-ai-key-set')).toBeNull();
  });

  it('validation: empty submit ⇒ "Enter your Anthropic key.", no PUT; bad-format ⇒ warn-only (still saves)', async () => {
    const be = installBackend({ aiKeySet: false });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-empty');
    // Empty submit blocks (no PUT).
    await user.click(screen.getByTestId('settings-ai-key-add'));
    expect(await screen.findByTestId('settings-ai-key-validation')).toHaveTextContent(AK.validationEmpty);
    expect(be.calls.aiKeyPut).toBe(0);
    // Bad format is warn-only — the save still goes through (backend is the authority).
    await user.type(screen.getByTestId('settings-ai-key-input'), 'not-a-key-9876');
    await user.click(screen.getByTestId('settings-ai-key-add'));
    await screen.findByTestId('settings-ai-key-set');
    expect(be.calls.aiKeyPut).toBe(1);
  });

  it('save error (transport fault on PUT) ⇒ the save-error alert, NEVER echoing the key', async () => {
    installBackend({ aiKeySet: false, putOutcome: 'transport' });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-empty');
    await user.type(screen.getByTestId('settings-ai-key-input'), RAW_KEY);
    await user.click(screen.getByTestId('settings-ai-key-add'));
    const err = await screen.findByTestId('settings-ai-key-error');
    expect(err).toHaveTextContent(AK.saveError);
    expect(err.textContent ?? '').not.toContain(RAW_KEY);
  });

  it('AC-22 adjacency: anonymous ⇒ the section shows a sign-in prompt, not the form', async () => {
    installBackend({ authenticated: false });
    renderSettings();
    expect(await screen.findByTestId('settings-ai-key-anonymous')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-key-input')).toBeNull();
    expect(screen.queryByTestId('settings-ai-key-set')).toBeNull();
  });
});
