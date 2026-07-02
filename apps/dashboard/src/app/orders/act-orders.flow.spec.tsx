/**
 * Flow-integration CENTERPIECE (ai-rec-backtest-orders, FRONTEND contract §7): the whole USER
 * FLOW — rec → Act → confirm → order → live evaluation → fill → position → review — driven
 * through the REAL pages (the full <App/> route table), mocking ONLY the network boundary
 * (`fetch` via the @org/api client + the SSE `EventSource`). Never a live backend.
 *
 * Every named test below ⇔ its AC (GATE Q traceability). Invariants exercised end-to-end:
 * `[no-real-order-path]` · `[server-side-gate-enforcement]` · `[live-vs-static-isolation]` ·
 * `[best-effort-isolated-or-null]` · `[additive-keeps-score-byte-identical]` (structural FE half).
 */
import { render, screen, within, act, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { TickerBundle, LiveUpdate, StrikeRow } from '@org/api';

import App from '../app';
import { theme } from '../theme';
import { defaultGoodTil } from '../trading/TradeEntryDialog';
import {
  __resetMemory as __resetPositionsMemory, allPositions, allDecisions, decisionsForPosition,
  putPosition,
} from '../positions/store';
import { getTrade } from '../ghost-trade/store';
import {
  ORDERS_KEY, allOrders, getOrder, putOrder, buildOrdersExport,
  __resetOrdersMemory, __notifyOrdersChanged,
} from './store';
import type { SimOrder } from './types';
import { NOT_EVALUATED_TEXT } from './copy';

const T = 20000; // per-test budget (full-App flows)
const DAY = 86_400_000;
const SNAP_ISO = '2026-07-02T14:00:00Z';
const isoDate = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString().slice(0, 10);
const EXP1 = isoDate(24 * DAY);
const EXP2 = isoDate(59 * DAY);
const FUTURE_ISO = new Date(Date.now() + 5 * DAY).toISOString();

// ---- INTERFACE-shaped factories -----------------------------------------------------------------

function strike(s: number): StrikeRow {
  return { strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20, net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25 };
}

function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA', price: 250, gex_spot: 250, timestamp: 1, timestamp_iso: SNAP_ISO,
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: EXP1, net_gex: 1, call_gex: 1, put_gex: -1, total_gex: 1, net_dex: 1,
      call_dex: 1, put_dex: -1, net_vanna: null, net_charm: null, net_volga: null, vwap: 249,
      vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null, dte_min: 7,
      dte_max: 45, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.1, net_flow: null, put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5, total_volume: 100000, vol_oi_unusual_threshold: 1, iv_skew: null, term_structure: null,
    },
    signals: {
      ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 42, opportunity_tier: 'watch', prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [{ date: EXP1, dte: 24 }, { date: EXP2, dte: 59 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: 'fp-A', score_threshold: 50 },
    meta: { served_at: SNAP_ISO, cache: { hit: false, age_seconds: 0, ttl_seconds: 60 }, freshness: { snapshot_iso: SNAP_ISO, data_age_seconds: 10, stale: false, stale_after_seconds: 600 } },
    position_eval: null,
  };
}

/** A produced TRADE rec (the Act entry point). Override per test. */
function tradeRec(over: Record<string, unknown> = {}, strategyOver: Record<string, unknown> = {}) {
  return {
    status: 'produced',
    persona: { id: null, name: 'Default (no persona)' },
    as_of: SNAP_ISO, pinned_fingerprint: 'fp-A', stale_born: false,
    strategy: {
      decision: 'trade', bias: 'long', structure: 'long call', strikes: [250], expiration: EXP1,
      entry_trigger: 'Enter on a break above 252', invalidation_level: 245, max_risk: '$500',
      position_size: '2 contracts', exit_plan: { target: 9, stop: 3 }, time_horizon: '1-2 weeks',
      confidence: 'medium', rationale: 'Momentum building. Dealers short gamma above the wall.',
      ...strategyOver,
    },
    unavailable_reason: null,
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-07-03T04:00:00Z' },
    ...over,
  };
}

const QUOTE = {
  ticker: 'TSLA', expiration: EXP1, strike: 250, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45, dte: 24,
};

// ---- Controllable mock backend (the ONLY thing mocked) ------------------------------------------

interface BackendCfg {
  authenticated: boolean;
  gateStatus: number;                 // POST /api/positions/sim-trade/gate
  inAppEnabled: boolean;              // status availability.in_app_enabled (keyless deployment = false)
  scenarios: { enabled: boolean; catalog: { id: string; name: string }[] };
  gate: { state: string; cooldown_remaining_seconds: number; reasons: string[] };
  cap: { over_limit: boolean; remaining_today: number; resets_at: string };
  rec: (body: Record<string, unknown>) => unknown;
  recPending: boolean;                // hold the rec POST unresolved (loading state)
}

const esInstances: { onmessage: ((e: MessageEvent) => void) | null; url: string }[] = [];
const fetchLog: { url: string; method: string; body?: string }[] = [];
let cfg: BackendCfg;
let releaseRec: (() => void) | null = null;

function defaultCfg(): BackendCfg {
  return {
    authenticated: true,
    gateStatus: 200,
    inAppEnabled: true,
    scenarios: { enabled: false, catalog: [] },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-07-03T04:00:00Z' },
    rec: () => tradeRec(),
    recPending: false,
  };
}

function installBackend(patch: Partial<BackendCfg> = {}) {
  cfg = { ...defaultCfg(), ...patch };
  esInstances.length = 0;
  fetchLog.length = 0;
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    url: string;
    constructor(url: string) { this.url = url; esInstances.push(this); }
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    fetchLog.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined });
    if (url.includes('/api/auth/session')) {
      return json(cfg.authenticated
        ? { authenticated: true, user: { id: 'u-1', email: 't@u.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } }
        : { authenticated: false, user: null, google_available: false, settings: null });
    }
    if (url.includes('/api/positions/sim-trade/gate')) {
      if (cfg.gateStatus === 200) return json({ authorized: true });
      if (cfg.gateStatus === 403) return json({ error: 'auth_required', message: 'Sign in required.' }, 403);
      return json({ error: 'auth_unavailable', message: 'Auth degraded.' }, 503);
    }
    if (url.includes('/api/recommendation/status/')) {
      return json({ availability: { in_app_enabled: cfg.inAppEnabled }, gate: cfg.gate, cap: cfg.cap, scenarios: cfg.scenarios });
    }
    if (url.includes('/api/recommendation/') && method === 'POST') {
      if (cfg.recPending) {
        await new Promise<void>((resolve) => { releaseRec = resolve; });
      }
      const body = init?.body ? JSON.parse(init.body as string) : {};
      return json(cfg.rec(body));
    }
    if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/ticker/')) return json(makeBundle());
    if (url.includes('/api/contract/')) {
      const u = new URL(url, 'http://x');
      return json({
        ...QUOTE,
        strike: Number(u.searchParams.get('strike')),
        right: u.searchParams.get('right') ?? 'call',
        expiration: u.searchParams.get('expiration') ?? EXP1,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

/** Push an SSE payload to all live EventSources (act-wrapped). */
function pushLive(over: Partial<LiveUpdate> = {}) {
  const u: LiveUpdate = {
    ticker: 'TSLA', mid: 250, bid: null, ask: null, spread: null, net_flow: 0, buy_vol: 0, sell_vol: 0,
    flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular', feed: 'realtime',
    ts: Date.now(), gamma_flip: 248, last_trade: over.mid ?? 250, ...over,
  };
  act(() => { esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(u) } as MessageEvent)); });
}

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Seed an order straight into the durable store (reload/coverage/history fixtures). */
let seedN = 0;
function seedOrder(over: Partial<SimOrder> = {}): SimOrder {
  const o: SimOrder = {
    id: `seed-${++seedN}`, created_time: new Date().toISOString(), schema_version: 1,
    ticker: 'TSLA', expiration: EXP1, strike: 250, right: 'call', side: 'long', qty: 1,
    trigger: { kind: 'underlying_above', level: 252 }, limit_price: 0.5,
    stop: null, target: null, expires_at: FUTURE_ISO,
    provenance: {
      source: 'ai_rec', rec_fingerprint: 'fp-A', rec_as_of: SNAP_ISO,
      persona: { id: null, name: 'Default (no persona)' }, trigger_source_text: 'Enter on a break above 252',
    },
    status: 'waiting',
    ...over,
  };
  putOrder(o);
  __notifyOrdersChanged();
  return o;
}

// ---- Flow helpers ---------------------------------------------------------------------------------

async function settleTicker(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId('account-avatar');           // who-am-I resolved (FE gate check passes)
  await screen.findByText(`AI recommendation · TSLA`);   // bundle + panel mounted
  return user;
}

async function produceTradeRec(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
  await screen.findByTestId('ai-rec-act');
}

async function openActDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('ai-rec-act'));
  const dlg = await screen.findByTestId('trade-entry-dialog');
  expect(within(dlg).getByText('Simulated order — act on this rec')).toBeInTheDocument();
  return dlg;
}

async function confirmOrder(user: ReturnType<typeof userEvent.setup>, dlg: HTMLElement) {
  await user.click(within(dlg).getByRole('button', { name: 'Place simulated order' }));
}

beforeEach(() => {
  localStorage.clear();
  __resetOrdersMemory();
  __resetPositionsMemory();
  vi.restoreAllMocks();
  installBackend();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  releaseRec = null;
});

// =====================================================================================================
// A. Acting on a rec (creation flow)
// =====================================================================================================

describe('acting on a rec — the Act affordance + creation dialog (AC-1..11)', () => {
  it('act_button_present_on_trade_rec_alongside_unchanged_accept', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const accept = screen.getByRole('button', { name: 'Accept into ghost trade' });
    const actBtn = screen.getByTestId('ai-rec-act');
    expect(actBtn).toHaveTextContent('Act as sim order');
    // Accept stays FIRST in the action row; Act sits beside it.
    expect(accept.compareDocumentPosition(actBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }, T);

  it('no_trade_rec_offers_no_act_affordance', async () => {
    installBackend({
      rec: () => tradeRec({}, {
        decision: 'no_trade', structure: null, strikes: [], expiration: null, entry_trigger: null,
      }),
    });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
    await screen.findByText('No trade — sit this one out');
    expect(screen.queryByTestId('ai-rec-act')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept into ghost trade' })).toBeNull();
  }, T);

  it('degraded_rec_states_offer_no_act', async () => {
    // (a) unavailable × reasons — the generic degraded block offers no Act.
    for (const reason of ['llm_error', 'timeout']) {
      installBackend({ rec: () => tradeRec({ status: 'unavailable', strategy: null, unavailable_reason: reason }) });
      const user = userEvent.setup();
      renderAt('/ticker/TSLA');
      await settleTicker(user);
      await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
      await screen.findByText('AI unavailable — try again');
      expect(screen.queryByTestId('ai-rec-act')).toBeNull();
      cleanup();
    }
    // (b) a byo key CTA state (no_key) — no Act.
    installBackend({ rec: () => tradeRec({ status: 'unavailable', strategy: null, unavailable_reason: 'no_key' }) });
    let user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
    await screen.findByTestId('ai-rec-state-no-key');
    expect(screen.queryByTestId('ai-rec-act')).toBeNull();
    cleanup();
    // (c) loading — no Act while the request is in flight.
    installBackend({ recPending: true });
    user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
    await screen.findByText('Thinking…');
    expect(screen.queryByTestId('ai-rec-act')).toBeNull();
    act(() => releaseRec?.());
    await screen.findByTestId('ai-rec-act'); // sanity: it appears only once produced
    cleanup();
    // (d) signed out — the gate replaces the whole action surface; idle offers no Act either.
    installBackend({ authenticated: false });
    renderAt('/ticker/TSLA');
    await screen.findByTestId('ai-rec-auth-gate');
    expect(screen.queryByTestId('ai-rec-act')).toBeNull();
  }, T);

  it('act_opens_creation_dialog_prefilled_all_fields_editable', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    // Prefill per the EXISTING Accept seeding rules (D3): contract, qty (parseQty '2 contracts'),
    // stop/target from the exit plan.
    expect(within(dlg).getByLabelText('Quantity')).toHaveValue(2);
    expect(within(dlg).getByLabelText('Stop (optional)')).toHaveValue(3);
    expect(within(dlg).getByLabelText('Target (optional)')).toHaveValue(9);
    expect(within(dlg).getByLabelText('Trigger level')).toHaveValue(252);
    // Every plan field is editable before confirm. (Quantity clamps to ≥1 on each change — the
    // shipped behavior — so edit it with a single change event.)
    const qty = within(dlg).getByLabelText('Quantity');
    fireEvent.change(qty, { target: { value: '3' } });
    expect(qty).toHaveValue(3);
    const level = within(dlg).getByLabelText('Trigger level');
    await user.clear(level);
    await user.type(level, '255');
    expect(level).toHaveValue(255);
  }, T);

  it('explicit_numeric_level_seeds_labeled_editable_trigger_with_verbatim_text', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    expect(within(dlg).getByLabelText('Trigger level')).toHaveValue(252);
    expect(within(dlg).getByTestId('order-seed-chip')).toHaveTextContent('Derived from the rec');
    expect(within(dlg).getByTestId('order-verbatim-words')).toHaveTextContent('Enter on a break above 252');
  }, T);

  it('unparseable_trigger_text_seeds_empty_and_allows_immediate_arm', async () => {
    installBackend({ rec: () => tradeRec({}, { entry_trigger: 'Enter on strength through the call wall' }) });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    expect(within(dlg).getByLabelText('Trigger level')).toHaveValue(null);
    expect(within(dlg).getByTestId('order-no-seed-helper')).toBeInTheDocument();
    expect(within(dlg).getByTestId('order-verbatim-words')).toHaveTextContent('Enter on strength through the call wall');
    // Proceeding with NO trigger arms immediately (a plain market-on-trigger order).
    await confirmOrder(user, dlg);
    await waitFor(() => expect(allOrders()).toHaveLength(1));
    expect(allOrders()[0].trigger).toBeNull();
    expect(allOrders()[0].status).toBe('triggered');
  }, T);

  it('dismiss_creates_nothing_and_simulated_disclosure_present', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    // The D8-1 disclosure, VERBATIM, always visible above the confirm.
    expect(within(dlg).getByTestId('order-simulated-disclosure')).toHaveTextContent(
      'Simulated only — no real order is ever placed. Once confirmed, this order can trigger and ' +
      'fill unattended whenever a live stream for TSLA is open in this browser. Orders are stored ' +
      'in this browser — not synced to your account.',
    );
    await user.click(within(dlg).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByTestId('trade-entry-dialog')).toBeNull());
    expect(allOrders()).toHaveLength(0); // nothing created; Orders surfaces unchanged
    expect(screen.getByTestId('orders-widget-empty')).toBeInTheDocument();
  }, T);

  it('good_til_defaults_7d_capped_at_expiration_never_blank', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    const input = within(dlg).getByLabelText('Good-til');
    expect(input).toHaveValue(defaultGoodTil(EXP1)); // = now+7d (24-DTE expiration ⇒ uncapped)
    // Blank ⇒ impossible to submit; the verbatim validation shows.
    fireEvent.change(input, { target: { value: '' } });
    expect(within(dlg).getByRole('button', { name: 'Place simulated order' })).toBeDisabled();
    expect(within(dlg).getByText("Set a good-til date after now and no later than the contract's expiration.")).toBeInTheDocument();
    // Editable within (now → expiration].
    fireEvent.change(input, { target: { value: isoDate(3 * DAY) } });
    expect(within(dlg).getByRole('button', { name: 'Place simulated order' })).toBeEnabled();
  }, T);

  it('already_met_notice_shown_and_triggers_on_first_live_update', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    pushLive({ mid: 253 }); // live mid ALREADY above the rec's 252 level
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    expect(within(dlg).getByTestId('order-already-met')).toHaveTextContent(
      'Condition already met — TSLA is already above 252 on live data. This order will trigger on the first live update after you place it.',
    );
    // Force a LIMIT resting entry so the trigger is observable as `triggered` (not instant fill).
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '0.5');
    await confirmOrder(user, dlg);
    await waitFor(() => expect(allOrders()).toHaveLength(1));
    expect(allOrders()[0].status).toBe('waiting');
    // The FIRST live update after placement satisfies the comparator ⇒ triggered.
    pushLive({ mid: 253 });
    await waitFor(() => expect(allOrders()[0].status).toBe('triggered'));
  }, T);

  it('stale_rec_disclosure_shown_proceed_allowed', async () => {
    // The rec pins fp-OLD while the live bundle carries fp-A ⇒ stale at Act time (D7/D8-5).
    installBackend({ rec: () => tradeRec({ pinned_fingerprint: 'fp-OLD' }) });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    expect(within(dlg).getByTestId('order-stale-strip')).toHaveTextContent(
      `Newer data has arrived since this read was pinned (as of ${SNAP_ISO}). The plan below reflects that older snapshot; the trigger still evaluates against live data only.`,
    );
    // Never blocks: the user may still proceed.
    await confirmOrder(user, dlg);
    await waitFor(() => expect(allOrders()).toHaveLength(1));
  }, T);

  it('gate_403_prompts_sign_in_and_aborts_with_zero_order', async () => {
    // FE session says signed-in; the SERVER gate rejects (bypassed client / expired session) —
    // the server is the boundary of record ([server-side-gate-enforcement]).
    installBackend({ gateStatus: 403 });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    await confirmOrder(user, dlg);
    // Standard sign-in prompt (D8-6), flow ABORTED before anything is stored: zero order.
    await screen.findByTestId('orders-signin-prompt');
    expect(screen.getByTestId('orders-signin-prompt')).toHaveTextContent('Sign in to place a simulated order.');
    expect(allOrders()).toHaveLength(0);
    await waitFor(() => expect(screen.queryByTestId('trade-entry-dialog')).toBeNull());
  }, T);

  it('gate_503_shows_couldnt_reach_sign_in_and_aborts (extra, §3.2 gate-unavailable)', async () => {
    installBackend({ gateStatus: 503 });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    await confirmOrder(user, dlg);
    await screen.findByTestId('orders-signin-prompt');
    expect(screen.getByTestId('orders-signin-prompt')).toHaveTextContent(
      "Couldn't reach sign-in right now. Please try again in a moment.",
    );
    expect(allOrders()).toHaveLength(0);
  }, T);
});

// =====================================================================================================
// B. Orders surface & lifecycle
// =====================================================================================================

describe('orders surface & lifecycle (AC-12..24)', () => {
  it('confirmed_trigger_order_appears_waiting_with_plan_facts_time_source', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    await confirmOrder(user, dlg);
    const row = await screen.findByTestId('order-row');
    expect(within(row).getByTestId('order-status-waiting')).toHaveTextContent('Waiting');
    expect(within(row).getByTestId('order-contract')).toHaveTextContent(`TSLA 250C · ${EXP1}`);
    expect(within(row).getByTestId('order-trigger')).toHaveTextContent('trigger above 252');
    expect(within(row).getByTestId('order-entry-price')).toHaveTextContent('market on trigger');
    expect(within(row).getByTestId('order-stop-target')).toHaveTextContent('stop $3 · target $9');
    expect(within(row).getByTestId('order-good-til')).toHaveTextContent(/Good-til \d{4}-\d{2}-\d{2}/);
    expect(within(row).getByTestId('order-status-time')).toHaveTextContent(/placed /);
    expect(within(row).getByTestId('order-source')).toHaveTextContent('AI read · Default (no persona)');
  }, T);

  it('triggerless_order_appears_triggered_never_waiting', async () => {
    installBackend({ rec: () => tradeRec({}, { entry_trigger: null }) });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    const dlg = await openActDialog(user);
    expect(within(dlg).getByTestId('order-verbatim-words')).toHaveTextContent('— (the rec stated no entry trigger)');
    await confirmOrder(user, dlg);
    const row = await screen.findByTestId('order-row');
    expect(within(row).getByTestId('order-status-triggered')).toHaveTextContent('Triggered · working entry');
    expect(getOrder(allOrders()[0].id)?.status).toBe('triggered');
    expect(getOrder(allOrders()[0].id)?.triggered_time).toBeTruthy();
  }, T);

  it('positions_panel_all_tickers_widget_scoped_same_store', async () => {
    const tsla = seedOrder({ ticker: 'TSLA' });
    const msft = seedOrder({ ticker: 'MSFT' });
    const done = seedOrder({ ticker: 'TSLA', status: 'filled', filled_time: new Date().toISOString(), fill_mark: 4, fill_basis: 'limit_fill' });
    // Ticker widget: THAT ticker's orders only.
    const view = renderAt('/ticker/TSLA');
    const widget = await screen.findByTestId('widget-orders');
    await waitFor(() => expect(within(widget).getAllByTestId('order-row').length).toBeGreaterThanOrEqual(1));
    const widgetIds = within(widget).getAllByTestId('order-row').map((r) => r.getAttribute('data-order-id'));
    expect(widgetIds).toContain(tsla.id);
    expect(widgetIds).not.toContain(msft.id);
    view.unmount();
    // Positions panel: ALL tickers + terminal history — the SAME store (one truth).
    renderAt('/positions');
    const panel = await screen.findByTestId('orders-panel');
    const openIds = within(panel).getAllByTestId('order-row').map((r) => r.getAttribute('data-order-id'));
    expect(openIds).toEqual(expect.arrayContaining([tsla.id, msft.id]));
    const user = userEvent.setup();
    await user.click(within(panel).getByTestId('orders-tab-history'));
    const histIds = within(panel).getAllByTestId('order-row').map((r) => r.getAttribute('data-order-id'));
    expect(histIds).toContain(done.id);
  }, T);

  it('live_mid_cross_moves_waiting_to_triggered_visibly', async () => {
    seedOrder({ limit_price: 0.5 }); // uncrossable limit ⇒ observable `triggered`
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    pushLive({ mid: 251 }); // below the 252 level — stays waiting
    expect(screen.getByTestId('order-status-waiting')).toBeInTheDocument();
    pushLive({ mid: 253 }); // the live cross
    const chip = await screen.findByTestId('order-status-triggered');
    expect(chip).toHaveTextContent('Triggered · working entry');
    expect(screen.getByTestId('order-status-time')).toHaveTextContent(/triggered /);
  }, T);

  it('limit_fills_only_on_live_cross_at_limit_fill_price_is_limit', async () => {
    const o = seedOrder({ limit_price: 4 });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    pushLive({ mid: 253 }); // triggers; modeled mark ≈6.5 > 4 ⇒ rests, does NOT fill
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('triggered'));
    pushLive({ mid: 253 });
    expect(getOrder(o.id)?.status).toBe('triggered');
    // The LIVE cross at the limit (underlying down ⇒ modeled mark ≤ 4) fills AT the limit.
    await waitFor(() => {
      pushLive({ mid: 235 });
      expect(getOrder(o.id)?.status).toBe('filled');
    });
    expect(getOrder(o.id)?.fill_mark).toBe(4);
    expect(getOrder(o.id)?.fill_basis).toBe('limit_fill');
    const pos = allPositions().find((p) => p.origin_order_id === o.id);
    expect(pos?.entry_mark).toBe(4);
    expect(pos?.entry_basis).toBe('limit_fill');
  }, T);

  it('market_on_trigger_fills_at_first_live_resolvable_mark', async () => {
    const o = seedOrder({ limit_price: null });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    // The first live-resolvable option mark after the cross: modeled = 5 + 0.5·3 + 0.005·9 = 6.545.
    await waitFor(() => {
      pushLive({ mid: 253 });
      expect(getOrder(o.id)?.status).toBe('filled');
    });
    expect(getOrder(o.id)?.fill_basis).toBe('trigger_fill');
    expect(getOrder(o.id)?.fill_mark).toBeCloseTo(6.545, 3);
    const pos = allPositions().find((p) => p.origin_order_id === o.id);
    expect(pos?.entry_mark).toBeCloseTo(6.545, 3);
    expect(pos?.entry_basis).toBe('trigger_fill');
  }, T);

  it('fill_creates_exactly_one_position_no_double_fill_on_continued_updates', async () => {
    const o = seedOrder({ limit_price: null, qty: 2, stop: 3, target: 9 });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    await waitFor(() => {
      pushLive({ mid: 253 });
      expect(getOrder(o.id)?.status).toBe('filled');
    });
    // Continued live updates: no duplicate position, no second fill.
    pushLive({ mid: 254 });
    pushLive({ mid: 255 });
    pushLive({ mid: 256 });
    expect(allPositions()).toHaveLength(1);
    const pos = allPositions()[0];
    expect(pos.qty).toBe(2);
    expect(pos.stop).toBe(3);      // plan data carried
    expect(pos.target).toBe(9);
    expect(pos.origin_order_id).toBe(o.id);
    expect(getOrder(o.id)?.position_id).toBe(pos.id); // the order links to it
  }, T);

  it('cancel_waiting_terminal_no_position_stops_evaluating', async () => {
    const o = seedOrder({ limit_price: null });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    // Two-step inline cancel: first click arms, second cancels.
    await user.click(screen.getByTestId('order-cancel'));
    await user.click(screen.getByTestId('order-cancel-confirm'));
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('cancelled'));
    expect(getOrder(o.id)?.close_time).toBeTruthy();
    // It no longer evaluates: a cross transitions NOTHING and creates NO position.
    pushLive({ mid: 260 });
    expect(getOrder(o.id)?.status).toBe('cancelled');
    expect(allPositions()).toHaveLength(0);
  }, T);

  it('cancel_triggered_unfilled_terminal_no_position', async () => {
    const o = seedOrder({ limit_price: 0.5 });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    pushLive({ mid: 253 });
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('triggered'));
    await user.click(screen.getByTestId('order-cancel'));
    await user.click(screen.getByTestId('order-cancel-confirm'));
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('cancelled'));
    pushLive({ mid: 235 }); // would have crossed the limit — terminal stays terminal
    expect(getOrder(o.id)?.status).toBe('cancelled');
    expect(allPositions()).toHaveLength(0);
    expect(decisionsForPosition(o.id).some((d) => d.event_type === 'order_cancelled')).toBe(true);
  }, T);

  it('expiry_applies_off_stream_on_render_and_reload', async () => {
    // The good-til bound passed while NO stream was up — the clock-only transition applies on the
    // next view (the render-time sweep), with no live payload at all.
    const o = seedOrder({ expires_at: new Date(Date.now() - 60_000).toISOString() });
    renderAt('/positions');
    await screen.findByTestId('orders-panel');
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('expired'));
    expect(getOrder(o.id)?.close_reason).toBe('expired');
    expect(allPositions()).toHaveLength(0);
    expect(decisionsForPosition(o.id).some((d) => d.event_type === 'order_expired')).toBe(true);
    // Reload (fresh hydrate) keeps it expired, in History.
    cleanup();
    __resetOrdersMemory();
    const user = userEvent.setup();
    renderAt('/positions');
    const panel = await screen.findByTestId('orders-panel');
    await user.click(within(panel).getByTestId('orders-tab-history'));
    expect(within(panel).getByTestId('order-status-expired')).toBeInTheDocument();
  }, T);

  it('no_edit_affordance_only_details_and_cancel', async () => {
    seedOrder();
    renderAt('/positions');
    const row = await screen.findByTestId('order-row');
    const buttons = within(row).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Details', 'Cancel order']);
    expect(within(row).queryByText(/edit/i)).toBeNull();
  }, T);

  it('orders_survive_reload_including_triggered_unfilled', async () => {
    const o = seedOrder({ limit_price: 0.5 });
    const user = userEvent.setup();
    const view = renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    pushLive({ mid: 253 });
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('triggered'));
    // Full reload: unmount + drop the in-memory cache; re-hydrate from localStorage.
    view.unmount();
    __resetOrdersMemory();
    renderAt('/positions');
    const panel = await screen.findByTestId('orders-panel');
    const row = within(panel).getByTestId('order-row');
    expect(row.getAttribute('data-order-id')).toBe(o.id);
    expect(within(row).getByTestId('order-status-triggered')).toBeInTheDocument();
  }, T);

  it('terminal_orders_never_transition_and_stay_in_history', async () => {
    const filled = seedOrder({ status: 'filled', filled_time: new Date().toISOString(), fill_mark: 4, fill_basis: 'limit_fill' });
    const cancelled = seedOrder({ status: 'cancelled', close_time: new Date().toISOString(), close_reason: 'cancelled' });
    const expired = seedOrder({ status: 'expired', close_time: new Date().toISOString(), close_reason: 'expired' });
    const user = userEvent.setup();
    renderAt('/positions');
    const panel = await screen.findByTestId('orders-panel');
    await user.click(within(panel).getByTestId('orders-tab-history'));
    expect(within(panel).getAllByTestId('order-row')).toHaveLength(3);
    // Live crosses transition nothing terminal.
    pushLive({ mid: 300 });
    expect(getOrder(filled.id)?.status).toBe('filled');
    expect(getOrder(cancelled.id)?.status).toBe('cancelled');
    expect(getOrder(expired.id)?.status).toBe('expired');
    // Terminal rows show no evaluation cell and no cancel.
    expect(within(panel).queryByTestId('order-cancel')).toBeNull();
    expect(within(panel).queryByTestId('order-eval-watching')).toBeNull();
  }, T);
});

// =====================================================================================================
// C. Honest coverage & degraded states
// =====================================================================================================

describe('honest coverage & degraded states (AC-25..29)', () => {
  it('uncovered_ticker_shows_not_evaluated_state_never_suppressed', async () => {
    // An MSFT order on the Positions page whose focused stream is TSLA: not evaluated — correct
    // and REQUIRED (D5), with the D8-3 words verbatim.
    seedOrder({ ticker: 'MSFT' });
    const user = userEvent.setup();
    renderAt('/positions');
    const cell = await screen.findByTestId('order-eval-not-evaluated');
    expect(cell).toHaveTextContent(NOT_EVALUATED_TEXT);
    expect(cell).toHaveTextContent('Waiting for live data — not currently evaluated');
    // The D8-3 tooltip carries the full honesty copy.
    await user.hover(cell);
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent(
      "No live stream for MSFT is open in this tab (or the session is closed), so this order cannot trigger or fill right now — and it will not catch up on moves it missed. Open MSFT's ticker page during live hours to watch it. It can still expire on the clock, and you can still cancel it.",
    );
    // Live pushes for the FOCUSED ticker never move the uncovered order.
    pushLive({ mid: 300 });
    expect(allOrders()[0].status).toBe('waiting');
  }, T);

  it('offline_cross_causes_no_transition_live_cells_dim_rows_persist', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const o = seedOrder({ limit_price: 0.5 });
    renderAt('/ticker/TSLA');
    const widget = await screen.findByTestId('widget-orders');
    pushLive({ mid: 250 }); // live, below the level ⇒ Watching
    await screen.findByTestId('order-eval-watching');
    // The >15s payload gap trips the watchdog ⇒ stream offline.
    act(() => { vi.advanceTimersByTime(16_000); });
    const offline = await screen.findByTestId('order-eval-offline');
    // Live-derived cells degrade: dim + LAST-KNOWN mid, never blank; the honest not-evaluated text.
    expect(offline).toHaveTextContent(NOT_EVALUATED_TEXT);
    expect(within(offline).getByTestId('order-eval-distance-offline')).toHaveTextContent('mid 250');
    expect(within(offline).getByTestId('order-eval-distance-offline')).toHaveTextContent('⏸ offline');
    // The durable row facts persist un-blanked.
    expect(within(widget).getByTestId('order-contract')).toHaveTextContent('TSLA 250C');
    expect(within(widget).getByTestId('order-status-waiting')).toBeInTheDocument();
    // A cross "driven via the mock" while non-live (stale payload) causes NO transition.
    pushLive({ mid: 300, live: false });
    expect(getOrder(o.id)?.status).toBe('waiting');
  }, T);

  it('no_retro_fill_after_reconnect_resumes_on_new_live_data_only', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const o = seedOrder({ limit_price: 0.5 });
    renderAt('/ticker/TSLA');
    await screen.findByTestId('widget-orders');
    pushLive({ mid: 250 });
    await screen.findByTestId('order-eval-watching');
    act(() => { vi.advanceTimersByTime(16_000); }); // stream drops
    await screen.findByTestId('order-eval-offline');
    // During the outage the level crossed (invisibly) and came back. The reconnect payload is
    // BELOW the level ⇒ the order simply remains waiting — no retro-fill, no catch-up (AC-27).
    pushLive({ mid: 251 });
    await screen.findByTestId('order-eval-watching'); // auto-reconnect: live cells return
    expect(getOrder(o.id)?.status).toBe('waiting');
    // Evaluation resumes on NEW live data only: the next satisfying payload triggers.
    pushLive({ mid: 253 });
    await waitFor(() => expect(getOrder(o.id)?.status).toBe('triggered'));
  }, T);

  it('frozen_stale_last_known_closed_payloads_never_trigger_or_fill', async () => {
    const waiting = seedOrder({ limit_price: 0.5 });
    const working = seedOrder({ status: 'triggered', trigger: null, limit_price: 4, triggered_time: new Date().toISOString() });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('widget-orders');
    // Stale payload (live:false): a crossing mid transitions nothing.
    pushLive({ mid: 300, live: false });
    expect(getOrder(waiting.id)?.status).toBe('waiting');
    // Closed/overnight session payloads (frozen anchors): nothing transitions, nothing fills.
    pushLive({ mid: 235, live: false, market_session: 'closed', tick_age_s: null });
    pushLive({ mid: 235, live: false, market_session: 'overnight' });
    expect(getOrder(waiting.id)?.status).toBe('waiting');
    expect(getOrder(working.id)?.status).toBe('triggered'); // the ≤4 mark was NOT live ⇒ no fill
    expect(allPositions()).toHaveLength(0);
  }, T);

  it('corrupt_orders_store_isolated_unavailable_positions_untouched', async () => {
    // Pre-existing positions data + a hand-mangled orders blob.
    localStorage.setItem(ORDERS_KEY, '{mangled-by-hand');
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    // The Orders widget shows the honest §4.6 block…
    const fault = await screen.findByTestId('orders-store-fault');
    expect(fault).toHaveTextContent('Orders unavailable');
    expect(fault).toHaveTextContent(
      "This browser's orders storage couldn't be read. Everything else keeps working — positions, live data, and charts are unaffected, and previously saved orders were not overwritten.",
    );
    // …while the ticker page, bundle and live stream keep working…
    expect(screen.getByTestId('widget-live-tape')).toBeInTheDocument();
    pushLive({ mid: 253 });
    // …the prior blob is NOT overwritten…
    expect(localStorage.getItem(ORDERS_KEY)).toBe('{mangled-by-hand');
    // …and the Positions surface (own store) is untouched.
    cleanup();
    renderAt('/positions');
    await screen.findByTestId('portfolio-panel');
    expect(screen.getByTestId('orders-store-fault')).toBeInTheDocument(); // same honest block
    expect(screen.getByTestId('simulated-surface')).toBeInTheDocument(); // positions view intact
  }, T);
});

// =====================================================================================================
// D. Provenance & audit
// =====================================================================================================

describe('provenance & audit (AC-30..33)', () => {
  it('order_detail_shows_fingerprint_persona_or_scenario_and_verbatim_words', async () => {
    seedOrder();
    const user = userEvent.setup();
    renderAt('/positions');
    await screen.findByTestId('orders-panel');
    await user.click(screen.getByRole('button', { name: 'Details' }));
    const dlg = await screen.findByTestId('order-detail-dialog');
    expect(within(dlg).getByTestId('order-detail-source')).toHaveTextContent('AI read · Default (no persona)');
    expect(within(dlg).getByTestId('order-detail-source')).toHaveTextContent(`Pinned to fp-A · as of ${SNAP_ISO}`);
    expect(within(dlg).getByTestId('order-detail-verbatim')).toHaveTextContent('Enter on a break above 252');
    expect(within(dlg).getByTestId('order-detail-plan')).toHaveTextContent('trigger above 252');
  }, T);

  it('two_way_order_position_linkage_navigable_both_directions', async () => {
    // A filled order + the position its fill created (the durable join both surfaces render).
    const posId = 'pos-linked-1';
    const o = seedOrder({
      status: 'filled', filled_time: new Date().toISOString(), fill_mark: 6.5,
      fill_basis: 'trigger_fill', position_id: posId,
    });
    putPosition({
      id: posId, ticker: 'TSLA', expiration: EXP1, strike: 250, right: 'call', side: 'long', qty: 1,
      entry_mark: 6.5, entry_basis: 'trigger_fill', entry_time: new Date().toISOString(),
      stop: null, target: null, status: 'open', entry_mode: 'market', schema_version: 2,
      origin_order_id: o.id,
    });
    const user = userEvent.setup();
    renderAt('/positions');
    await screen.findByTestId('orders-panel');
    // Position → order: the backlink on the position row opens the order detail.
    const backlink = await screen.findByTestId('position-view-order');
    expect(backlink).toHaveTextContent('From sim order');
    expect(backlink).toHaveTextContent('view order →');
    await user.click(backlink);
    const dlg = await screen.findByTestId('order-detail-dialog');
    expect(within(dlg).getByTestId('order-detail-lifecycle')).toHaveTextContent('filled');
    // Order → position: "View position →" is offered from the filled order's detail.
    expect(within(dlg).getByTestId('order-view-position')).toBeInTheDocument();
    await user.click(within(dlg).getByTestId('order-view-position'));
    await waitFor(() => expect(screen.queryByTestId('order-detail-dialog')).toBeNull());
  }, T);

  it('every_transition_appends_decision_record_fill_also_in_position_history', async () => {
    const o = seedOrder({ limit_price: null });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    await waitFor(() => {
      pushLive({ mid: 253 });
      expect(getOrder(o.id)?.status).toBe('filled');
    });
    const events = allDecisions().filter((d) => d.trade_id === o.id).map((d) => d.event_type);
    expect(events).toContain('order_triggered'); // collapsed tick still records the trigger fact
    expect(events).toContain('order_filled');
    const filledRec = allDecisions().find((d) => d.trade_id === o.id && d.event_type === 'order_filled');
    const posId = getOrder(o.id)?.position_id as string;
    expect(filledRec?.position_id).toBe(posId);
    // The fill ALSO appears in the position's own history (the existing `open` event).
    expect(decisionsForPosition(posId).some((d) => d.event_type === 'open')).toBe(true);
  }, T);

  it('export_json_joins_rec_order_position_chain', async () => {
    const o = seedOrder({ limit_price: null });
    const user = userEvent.setup();
    const view = renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('order-row');
    await waitFor(() => {
      pushLive({ mid: 253 });
      expect(getOrder(o.id)?.status).toBe('filled');
    });
    view.unmount();
    // The Export JSON action on the Positions panel produces a client-side download.
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    try {
      renderAt('/positions');
      await screen.findByTestId('orders-panel');
      await user.click(screen.getByTestId('orders-export'));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
    // The exported payload joins the FULL chain: rec identity → order → position.
    const payload = buildOrdersExport(allDecisions());
    const exported = payload.orders.find((x) => x.id === o.id) as SimOrder;
    expect(exported.provenance.rec_fingerprint).toBe('fp-A');                    // rec identity
    expect(exported.provenance.trigger_source_text).toBe('Enter on a break above 252');
    expect(exported.position_id).toBeTruthy();                                    // order → position
    const filled = payload.decisions.find((d) => d.trade_id === o.id && d.event_type === 'order_filled');
    expect(filled?.position_id).toBe(exported.position_id);
    expect(payload.decisions.some((d) => d.trade_id === exported.position_id && d.event_type === 'open')).toBe(true);
  }, T);
});

// =====================================================================================================
// E. Scenario harness (FE halves)
// =====================================================================================================

const D2_CATALOG = [
  { id: 'long_call', name: 'Long call (entry/stop/target)' },
  { id: 'long_put', name: 'Long put' },
  { id: 'break_above', name: 'Conditional entry — break above' },
  { id: 'break_below', name: 'Conditional entry — break below' },
  { id: 'unparseable_trigger', name: 'Trade with unparseable trigger text' },
  { id: 'already_met', name: 'Condition already met at placement' },
  { id: 'no_trade', name: 'No trade' },
  { id: 'fault_timeout', name: 'Provider timeout fault' },
  { id: 'fault_llm_error', name: 'Provider error fault' },
];

function openScenarioSelect() {
  return screen.getByTestId('scenario-picker').querySelector('.MuiSelect-select') as HTMLElement;
}

describe('scenario harness — the FE halves (AC-34..42 + AC-38 UI)', () => {
  it('scenario_picker_absent_when_status_disabled', async () => {
    installBackend({ scenarios: { enabled: false, catalog: [] } });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    // ZERO scenario surface anywhere: no picker, no option, no copy (AC-34).
    expect(screen.queryByTestId('scenario-picker')).toBeNull();
    expect(screen.queryByText('Scenario (operator)')).toBeNull();
    expect(screen.queryByText(/Run scenario/)).toBeNull();
  }, T);

  it('scenario_refusal_renders_standard_unavailable_no_crash', async () => {
    // Flag OFF + a crafted scenario-selecting request ⇒ the contained refusal token — the panel's
    // EXISTING generic unavailable block handles it, no special copy, no crash (AC-35).
    installBackend({
      rec: () => tradeRec({ status: 'unavailable', strategy: null, unavailable_reason: 'scenario_unavailable' }),
    });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
    await screen.findByText('AI unavailable — try again');
    expect(screen.getByTestId('widget-live-tape')).toBeInTheDocument(); // page intact
    // Same for the scenario_error token.
    installBackend({
      rec: () => tradeRec({ status: 'unavailable', strategy: null, unavailable_reason: 'scenario_error' }),
    });
    cleanup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await user.click(await screen.findByRole('button', { name: 'Get AI recommendation' }));
    await screen.findByText('AI unavailable — try again');
  }, T);

  it('picker_lists_catalog_names_when_enabled', async () => {
    installBackend({ scenarios: { enabled: true, catalog: D2_CATALOG } });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('scenario-picker');
    await user.click(openScenarioSelect());
    // Default option + ALL NINE D2 catalog entries by server-provided display name (AC-36).
    expect(await screen.findByRole('option', { name: 'Real AI read (no scenario)' })).toBeInTheDocument();
    for (const s of D2_CATALOG) {
      expect(screen.getByRole('option', { name: s.name })).toBeInTheDocument();
    }
  }, T);

  it('run_scenario_not_blocked_by_cooldown_or_cap_ui', async () => {
    // Daily cap exhausted: without a scenario the action is the calm disabled block; WITH a
    // scenario selected it stays an enabled "Run scenario" (AC-38 FE half).
    installBackend({
      scenarios: { enabled: true, catalog: D2_CATALOG },
      cap: { over_limit: true, remaining_today: 0, resets_at: '2026-07-03T04:00:00Z' },
    });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    expect(await screen.findByRole('button', { name: /Daily AI limit reached/ })).toBeDisabled();
    await screen.findByTestId('scenario-picker');
    await user.click(openScenarioSelect());
    await user.click(await screen.findByRole('option', { name: 'Long call (entry/stop/target)' }));
    expect(await screen.findByRole('button', { name: 'Run scenario' })).toBeEnabled();
    cleanup();
    // Cooldown active: same bypass.
    installBackend({
      scenarios: { enabled: true, catalog: D2_CATALOG },
      gate: { state: 'cooling_down', cooldown_remaining_seconds: 42, reasons: [] },
    });
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    expect(await screen.findByRole('button', { name: /Cooling down/ })).toBeDisabled();
    await screen.findByTestId('scenario-picker');
    await user.click(openScenarioSelect());
    await user.click(await screen.findByRole('option', { name: 'Long call (entry/stop/target)' }));
    expect(await screen.findByRole('button', { name: 'Run scenario' })).toBeEnabled();
  }, T);

  it('run_scenario_not_blocked_by_no_key_availability', async () => {
    // Keyless deployment (availability.in_app_enabled = false): without a scenario the action is
    // the inert "not configured" block; WITH a scenario selected it stays an enabled
    // "Run scenario" that actually POSTs — scenario runs are keyless by design (the server skips
    // key resolution entirely; BE proof AC-37). Guards the GATE Z render-pass catch 2026-07-02.
    installBackend({
      inAppEnabled: false,
      scenarios: { enabled: true, catalog: D2_CATALOG },
      rec: (body) => tradeRec({
        scenario: body['scenario_id'] ? { id: String(body['scenario_id']), name: 'Conditional entry — break above' } : null,
      }),
    });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    expect(await screen.findByRole('button', { name: 'Get AI recommendation' })).toBeDisabled();
    await screen.findByTestId('scenario-picker');
    await user.click(openScenarioSelect());
    await user.click(await screen.findByRole('option', { name: 'Conditional entry — break above' }));
    await user.click(await screen.findByRole('button', { name: 'Run scenario' }));
    await screen.findByTestId('ai-rec-scripted-chip');
    const post = fetchLog.find((c) => c.url.includes('/api/recommendation/TSLA') && c.method === 'POST');
    expect(JSON.parse(post?.body ?? '{}').scenario_id).toBe('break_above');
  }, T);

  it('scripted_marking_on_rec_dialog_order_detail_and_export', async () => {
    // A scenario-produced trade rec: `scenario` non-null is the ONLY marker (INTERFACE §1.3).
    installBackend({
      scenarios: { enabled: true, catalog: D2_CATALOG },
      rec: (body) => tradeRec({
        scenario: body['scenario_id'] ? { id: String(body['scenario_id']), name: 'Conditional entry — break above' } : null,
      }),
    });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('scenario-picker');
    await user.click(openScenarioSelect());
    await user.click(await screen.findByRole('option', { name: 'Conditional entry — break above' }));
    await user.click(await screen.findByRole('button', { name: 'Run scenario' }));
    // 1) The rec panel: SCRIPTED SCENARIO chip + strip.
    await screen.findByTestId('ai-rec-scripted-chip');
    expect(screen.getByTestId('ai-rec-scripted-strip')).toHaveTextContent(
      'Scripted scenario · Conditional entry — break above — deterministic scripted output run through the real rec pipeline. Not a real AI read.',
    );
    // The POST carried the selector (and only then).
    const post = fetchLog.find((c) => c.url.includes('/api/recommendation/TSLA') && c.method === 'POST');
    expect(JSON.parse(post?.body ?? '{}').scenario_id).toBe('break_above');
    // 2) A scenario rec DOES offer Act (S6); the creation dialog carries the D8-4 strip.
    const dlg = await openActDialog(user);
    expect(within(dlg).getByTestId('order-scenario-strip')).toHaveTextContent(
      'Scripted scenario — this plan came from the "Conditional entry — break above" scenario, not a real AI read.',
    );
    expect(within(dlg).getByTestId('order-provenance-line')).toHaveTextContent('From scripted scenario · Conditional entry — break above');
    await confirmOrder(user, dlg);
    // 3) The order row is marked scripted.
    const row = await screen.findByTestId('order-row');
    expect(within(row).getByTestId('order-source')).toHaveTextContent('Scripted · Conditional entry — break above');
    // 4) Detail carries the scenario identity end-to-end.
    await user.click(within(row).getByRole('button', { name: 'Details' }));
    const detail = await screen.findByTestId('order-detail-dialog');
    expect(within(detail).getByTestId('order-detail-scripted-chip')).toBeInTheDocument();
    expect(within(detail).getByTestId('order-detail-source')).toHaveTextContent(
      'Scripted scenario · Conditional entry — break above (break_above)',
    );
    // 5) The export records carry the scripted provenance.
    const exported = buildOrdersExport(allDecisions()).orders[0];
    expect(exported.provenance.source).toBe('ai_scenario');
    expect(exported.provenance.scenario_id).toBe('break_above');
  }, T);

  it('fault_scenario_renders_contained_degraded_state_page_intact', async () => {
    installBackend({
      scenarios: { enabled: true, catalog: D2_CATALOG },
      rec: (body) => tradeRec({
        status: 'unavailable', strategy: null, unavailable_reason: 'timeout',
        scenario: body['scenario_id'] ? { id: String(body['scenario_id']), name: 'Provider timeout fault' } : null,
      }),
    });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('scenario-picker');
    await user.click(openScenarioSelect());
    await user.click(await screen.findByRole('option', { name: 'Provider timeout fault' }));
    await user.click(await screen.findByRole('button', { name: 'Run scenario' }));
    // The SAME degraded rec state the real fault produces — contained…
    await screen.findByText('AI unavailable — try again');
    // …plus the scripted marking so the operator knows it was scripted (UX §6).
    expect(screen.getByTestId('ai-rec-scripted-chip')).toBeInTheDocument();
    // Bundle, chart, live stream untouched.
    expect(screen.getByTestId('widget-live-tape')).toBeInTheDocument();
    expect(screen.getByTestId('widget-bento')).toBeInTheDocument();
    pushLive({ mid: 251 }); // the stream consumer still works
  }, T);

  it('signed_out_with_scenario_selected_shows_sign_in_gate_only', async () => {
    installBackend({ authenticated: false, scenarios: { enabled: true, catalog: D2_CATALOG } });
    renderAt('/ticker/TSLA');
    await screen.findByTestId('ai-rec-auth-gate');
    // The auth gate is OUTERMOST: signed out shows ONLY the sign-in gate — no scenario picker, no
    // run affordance, never a scenario rec (AC-42).
    expect(screen.getByTestId('ai-rec-signin-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('scenario-picker')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run scenario' })).toBeNull();
    expect(fetchLog.filter((c) => c.method === 'POST' && c.url.includes('/api/recommendation/'))).toHaveLength(0);
  }, T);
});

// =====================================================================================================
// F. Invariants & coexistence
// =====================================================================================================

describe('invariants & coexistence (AC-44/46/47/48)', () => {
  it('orders_in_every_state_add_no_param_to_bundle_or_sse_requests', async () => {
    // Orders in EVERY lifecycle state present…
    seedOrder({ status: 'waiting' });
    seedOrder({ status: 'triggered', trigger: null, triggered_time: new Date().toISOString() });
    seedOrder({ status: 'filled', filled_time: new Date().toISOString(), fill_mark: 4, fill_basis: 'limit_fill' });
    seedOrder({ status: 'cancelled', close_time: new Date().toISOString(), close_reason: 'cancelled' });
    seedOrder({ status: 'expired', close_time: new Date().toISOString(), close_reason: 'expired' });
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await screen.findByTestId('widget-orders');
    pushLive({ mid: 250 });
    // …and every bundle/SSE request stays byte-shape-identical: only the shipped params, nothing
    // order- or scenario-flavored anywhere (the structural FE half of AC-44; BE owns byte-identity).
    const ALLOWED = new Set(['min_dte', 'max_dte', 'expirations', 'dark_pool', 'pos_expiration', 'pos_strike', 'pos_right', 'pos_pl_pct']);
    const bundleCalls = fetchLog.filter((c) => c.url.includes('/api/ticker/'));
    expect(bundleCalls.length).toBeGreaterThan(0);
    for (const c of bundleCalls) {
      const u = new URL(c.url, 'http://x');
      for (const key of u.searchParams.keys()) expect(ALLOWED.has(key)).toBe(true);
      expect(c.url).not.toMatch(/order|scenario/i);
    }
    expect(esInstances.length).toBeGreaterThan(0);
    for (const es of esInstances) {
      const u = new URL(es.url, 'http://x');
      expect(u.pathname).toBe('/api/stream/TSLA');
      for (const key of u.searchParams.keys()) expect(ALLOWED.has(key)).toBe(true);
      expect(es.url).not.toMatch(/order|scenario/i);
    }
  }, T);

  it('simulated_labeling_everywhere_no_broker_affordance_live_tab_locked', async () => {
    seedOrder();
    const user = userEvent.setup();
    // The Ticker widget carries the SIMULATED chip.
    const view = renderAt('/ticker/TSLA');
    const widget = await screen.findByTestId('widget-orders');
    expect(within(widget).getByText('SIMULATED')).toBeInTheDocument();
    view.unmount();
    // The Positions Orders panel: SIMULATED chip + paper-only subtitle; the Live tab stays LOCKED.
    renderAt('/positions');
    const panel = await screen.findByTestId('orders-panel');
    expect(within(panel).getByText('SIMULATED')).toBeInTheDocument();
    expect(within(panel).getByText('Rec-driven entries watched against live data. Paper only — never a real order.')).toBeInTheDocument();
    // No broker/real-order affordance anywhere in the orders surfaces.
    expect(within(panel).queryByRole('button', { name: /execute|submit order|buy to open|connect broker/i })).toBeNull();
    await user.click(screen.getByTestId('tab-live'));
    expect(screen.getByText('Live positions — coming soon')).toBeInTheDocument();
  }, T);

  it('accept_flow_end_to_end_unchanged_with_orders_present', async () => {
    seedOrder(); // Orders present…
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await settleTicker(user);
    await produceTradeRec(user);
    // …Accept still opens the SHIPPED pre-filled entry dialog, byte-identical (3-mode control,
    // shipped title), and confirms into the ghost-trade tracker exactly as shipped.
    await user.click(screen.getByRole('button', { name: 'Accept into ghost trade' }));
    const dlg = await screen.findByTestId('trade-entry-dialog');
    expect(within(dlg).getByText('Open simulated position · TSLA')).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Manual price' })).toBeInTheDocument();
    expect(within(dlg).queryByTestId('order-trigger-section')).toBeNull(); // NOT the order variant
    await user.type(within(dlg).getByLabelText('Manual price'), '5');
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(getTrade('TSLA')?.status).toBe('open'));
    expect(allOrders()).toHaveLength(1); // Accept created NO order
  }, T);

  it('limit_mode_still_creates_pending_position_existing_pendings_untouched', async () => {
    // An existing pending limit position + an order, both present before the new write (D4 coexist).
    putPosition({
      id: 'pending-existing', ticker: 'TSLA', expiration: EXP1, strike: 245, right: 'call', side: 'long',
      qty: 1, entry_mark: 3, entry_basis: 'limit_fill', entry_time: '', placed_time: new Date().toISOString(),
      status: 'pending', entry_mode: 'limit', limit_price: 3, schema_version: 2,
    });
    seedOrder();
    const user = userEvent.setup();
    renderAt('/positions');
    await screen.findByTestId('account-avatar');
    await waitFor(() => expect(screen.getByTestId('open-entry')).toBeEnabled());
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByTestId('trade-entry-dialog');
    // The SHIPPED dialog (not the order variant): limit mode still creates a `pending` Position.
    expect(within(dlg).queryByTestId('order-trigger-section')).toBeNull();
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '2');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));
    await waitFor(() => expect(allPositions().filter((p) => p.status === 'pending')).toHaveLength(2));
    // The pre-existing pending is untouched; the new one is a Position, NOT an order.
    const existing = allPositions().find((p) => p.id === 'pending-existing');
    expect(existing?.status).toBe('pending');
    expect(existing?.limit_price).toBe(3);
    expect(allOrders()).toHaveLength(1); // the seeded order only — nothing rerouted
  }, T);
});
