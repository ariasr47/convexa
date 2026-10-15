/**
 * Orders — RISK-BASED flow + invariants suite (per the amended QA rule, `.claude/agents/qa-verify.md`
 * §4, 2026-07-13). Consolidates the former 46-test per-AC mirror (`act-orders.flow.spec.tsx`) down to
 * the invariants where a silent regression is plausible AND invisible to a reviewer:
 *
 *   1. THE CENTERPIECE — rec → Act → mandatory confirm → order → live cross → fill → EXACTLY ONE
 *      Position with `origin_order_id` + `trigger_fill` provenance + append-only decision records.
 *   2. `[no-real-order-path]` — enforced by CONSTRUCTION (the strict mock backend throws on any
 *      unexpected fetch) + an explicit sweep: no order-flavored URL ever, no non-GET besides the rec
 *      POST and the sim-trade gate, bundle/SSE requests structurally unchanged by orders existing.
 *   3. The PURE trigger contract at flow level — live-NBBO-mid-only (non-live/closed/overnight
 *      crossing payloads transition NOTHING), no retro-fill across a stream drop, limit fills AT the
 *      limit, terminal states forward-only, clock expiry as the only off-stream transition.
 *   4. `[live-vs-static-isolation]` — on stream loss only the live evaluation cells degrade; the
 *      durable row facts persist un-blanked; auto-reconnect restores evaluation on NEW data only.
 *   5. `[server-side-gate-enforcement]` — a server 403 at confirm aborts with ZERO order stored.
 *   6. Corrupt-store degradation — the honest fault block, the page keeps working, the prior blob is
 *      never overwritten (the pure half lives in `store.spec.ts`).
 *   7. The scenario harness's two LOAD-BEARING facts (the UI mirrors stay deleted): a keyless
 *      deployment never blocks a scenario run (a SHIPPED regression, caught post-QA 2026-07-02), and
 *      the `ai_scenario` provenance marker survives rec → order → position — it is the ONLY thing
 *      the outcomes ledger's scenario_sourced exclusion consumes (`outcomes/ledger.ts` joins
 *      `position.origin_order_id → order.provenance.source`); dropped silently, backtest runs would
 *      pollute the real track record.
 *
 * NOT asserted here (visible + intentional → review/QA): dialog/notice/disclosure wording (D8 strips),
 * row cell formatting, panel/widget layout and tab chrome, the scenario-harness UI, detail-dialog
 * contents, the Accept-flow chrome. The pure engine/seed/store matrices live in their unit specs.
 *
 * Mocks ONLY the network boundary (`fetch` via the @convexa/api client + the SSE `EventSource`).
 */
import type { LiveUpdate, StrikeRow, TickerBundle } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import {
  __resetMemory as __resetPositionsMemory,
  allDecisions,
  allPositions,
} from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import { NOT_EVALUATED_TEXT } from './copy';
import {
  ORDERS_KEY,
  __notifyOrdersChanged,
  __resetOrdersMemory,
  allOrders,
  getOrder,
  putOrder,
} from './store';
import type { SimOrder } from './types';

const T = 20000; // per-test budget (full-App flows)
const DAY = 86_400_000;
const SNAP_ISO = '2026-07-02T14:00:00Z';
const isoDate = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString().slice(0, 10);
const EXP1 = isoDate(24 * DAY);
const EXP2 = isoDate(59 * DAY);
const FUTURE_ISO = new Date(Date.now() + 5 * DAY).toISOString();

// ---- INTERFACE-shaped factories -----------------------------------------------------------------

function strike(s: number): StrikeRow {
  return {
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
  };
}

function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA',
      price: 250,
      gex_spot: 250,
      timestamp: 1,
      timestamp_iso: SNAP_ISO,
      call_wall: 260,
      put_wall: 240,
      peak_gex_strike: 255,
      gamma_flip: 248,
      max_pain: 250,
      max_pain_expiration: EXP1,
      net_gex: 1,
      call_gex: 1,
      put_gex: -1,
      total_gex: 1,
      net_dex: 1,
      call_dex: 1,
      put_dex: -1,
      net_vanna: null,
      net_charm: null,
      net_volga: null,
      vwap: 249,
      vwap_upper_2: null,
      vwap_upper_3: null,
      vwap_lower_2: null,
      vwap_lower_3: null,
      dte_min: 7,
      dte_max: 45,
      atm_iv: 45,
      hv_30d: 40,
      iv_hv_ratio: 1.1,
      net_flow: null,
      put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5,
      total_volume: 100000,
      vol_oi_unusual_threshold: 1,
      iv_skew: null,
      term_structure: null,
      dealer_flow_projection: null,
      straddle_move: {
        state: 'not_computed',
        as_of: null,
        session_basis: null,
        anchor_spot: null,
        anchor_basis: 'gex_spot',
        anchor_label: 'gex_spot',
        primary_expiration: null,
        wide_quote_threshold_pct: 15,
        tenors: [],
      },
    },
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
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [
      { date: EXP1, dte: 24 },
      { date: EXP2, dte: 59 },
    ],
    ai_eval: {
      ready: true,
      reasons: [],
      changed: true,
      state_fingerprint: 'fp-A',
      score_threshold: 50,
    },
    meta: {
      served_at: SNAP_ISO,
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: SNAP_ISO,
        data_age_seconds: 10,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    position_eval: null,
  };
}

/** A produced TRADE rec (the Act entry point). */
function tradeRec() {
  return {
    status: 'produced',
    persona: { id: null, name: 'Default (no persona)' },
    as_of: SNAP_ISO,
    pinned_fingerprint: 'fp-A',
    stale_born: false,
    strategy: {
      decision: 'trade',
      bias: 'long',
      structure: 'long call',
      strikes: [250],
      expiration: EXP1,
      entry_trigger: 'Enter on a break above 252',
      invalidation_level: 245,
      max_risk: '$500',
      position_size: '2 contracts',
      exit_plan: { target: 9, stop: 3 },
      time_horizon: '1-2 weeks',
      confidence: 'medium',
      rationale: 'Momentum building. Dealers short gamma above the wall.',
    },
    unavailable_reason: null,
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-07-03T04:00:00Z' },
  };
}

const QUOTE = {
  ticker: 'TSLA',
  expiration: EXP1,
  strike: 250,
  right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
  greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45,
  dte: 24,
};

// ---- STRICT mock backend (the ONLY thing mocked; unexpected fetch THROWS) ------------------------

interface BackendCfg {
  authenticated: boolean;
  gateStatus: number; // POST /api/positions/sim-trade/gate
  inAppEnabled: boolean; // status availability.in_app_enabled (keyless deployment = false)
  scenarios: { enabled: boolean; catalog: { id: string; name: string }[] };
  rec: (body: Record<string, unknown>) => unknown;
}

const esInstances: { onmessage: ((e: MessageEvent) => void) | null; url: string }[] = [];
const fetchLog: { url: string; method: string; body?: string }[] = [];
let cfg: BackendCfg;

function installBackend(patch: Partial<BackendCfg> = {}) {
  cfg = {
    authenticated: true,
    gateStatus: 200,
    inAppEnabled: true,
    scenarios: { enabled: false, catalog: [] },
    rec: () => tradeRec(),
    ...patch,
  };
  esInstances.length = 0;
  fetchLog.length = 0;
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    url: string;
    constructor(url: string) {
      this.url = url;
      esInstances.push(this);
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      fetchLog.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.includes('/api/auth/session')) {
        return json(
          cfg.authenticated
            ? {
                authenticated: true,
                user: {
                  id: 'u-1',
                  email: 't@u.com',
                  display_name: null,
                  auth_methods: ['password'],
                },
                google_available: false,
                settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
              }
            : { authenticated: false, user: null, google_available: false, settings: null },
        );
      }
      if (url.includes('/api/positions/sim-trade/gate')) {
        if (cfg.gateStatus === 200) return json({ authorized: true });
        return json({ error: 'auth_required', message: 'Sign in required.' }, cfg.gateStatus);
      }
      if (url.includes('/api/recommendation/status/')) {
        return json({
          availability: { in_app_enabled: cfg.inAppEnabled },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-07-03T04:00:00Z' },
          scenarios: cfg.scenarios,
        });
      }
      if (url.includes('/api/recommendation/') && method === 'POST') {
        return json(cfg.rec(init?.body ? JSON.parse(init.body as string) : {}));
      }
      if (url.includes('/api/personas'))
        return json([{ id: 'default', name: 'Default (no persona)' }]);
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
      throw new Error(`unexpected fetch ${url}`); // [no-real-order-path] by construction
    }),
  );
}

/** Push an SSE payload to all live EventSources (act-wrapped). */
function pushLive(over: Partial<LiveUpdate> = {}) {
  const u: LiveUpdate = {
    ticker: 'TSLA',
    mid: 250,
    bid: null,
    ask: null,
    spread: null,
    net_flow: 0,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: true,
    tick_age_s: 1,
    market_session: 'regular',
    feed: 'realtime',
    ts: Date.now(),
    gamma_flip: 248,
    last_trade: over.mid ?? 250,
    ...over,
  };
  act(() => {
    esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(u) } as MessageEvent));
  });
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

/** Seed an order straight into the durable store. */
let seedN = 0;
function seedOrder(over: Partial<SimOrder> = {}): SimOrder {
  const o: SimOrder = {
    id: `seed-${++seedN}`,
    created_time: new Date().toISOString(),
    schema_version: 1,
    ticker: 'TSLA',
    expiration: EXP1,
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 1,
    trigger: { kind: 'underlying_above', level: 252 },
    limit_price: 0.5,
    stop: null,
    target: null,
    expires_at: FUTURE_ISO,
    provenance: {
      source: 'ai_rec',
      rec_fingerprint: 'fp-A',
      rec_as_of: SNAP_ISO,
      persona: { id: null, name: 'Default (no persona)' },
      trigger_source_text: 'Enter on a break above 252',
    },
    status: 'waiting',
    ...over,
  };
  putOrder(o);
  __notifyOrdersChanged();
  return o;
}

async function settleTicker() {
  await screen.findByTestId('account-avatar'); // who-am-I resolved
  await screen.findByText('AI read · TSLA', undefined, { timeout: T }); // lazy route + bundle + panel mounted
}

async function actIntoDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Analyze current snapshot' }));
  await user.click(await screen.findByTestId('ai-rec-act'));
  return await screen.findByTestId('trade-entry-dialog');
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
});

// =====================================================================================================
// 1. THE CENTERPIECE — rec → Act → order → live cross → fill → position, with full provenance
// =====================================================================================================

describe('orders · the end-to-end flow (rec → order → position provenance)', () => {
  it(
    'act_confirm_live_cross_fill_creates_exactly_one_position_with_provenance',
    async () => {
      const user = userEvent.setup();
      renderAt('/ticker/TSLA');
      await settleTicker();

      // Mandatory confirm: dismissing the Act dialog creates NOTHING.
      let dlg = await actIntoDialog(user);
      await user.click(within(dlg).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByTestId('trade-entry-dialog')).toBeNull());
      expect(allOrders()).toHaveLength(0);

      // Re-open and confirm (market-on-trigger; the rec seeded trigger above 252, qty 2, stop/target).
      await user.click(screen.getByTestId('ai-rec-act'));
      dlg = await screen.findByTestId('trade-entry-dialog');
      await user.click(within(dlg).getByRole('button', { name: 'Place simulated order' }));
      await waitFor(() => expect(allOrders()).toHaveLength(1));
      const o = allOrders()[0];
      expect(o.status).toBe('waiting');
      expect(o.trigger).toEqual({ kind: 'underlying_above', level: 252 });
      // tradeable-rec-inputs AC-79 (ship-blocking, sanctioned behavior): the quantity field is NEVER
      // seeded from the model's size text — it always opens at the dialog's own default of 1, even
      // though the rec's `position_size` here reads "2 contracts". `prefill.ts::parseQty` is DELETED
      // by design; this assertion was previously `toBe(2)` (a pre-feature artifact of the deleted
      // parser) and is corrected here to assert the new rule on purpose, not by accident.
      expect(o.qty).toBe(1);
      // The fixture's exit_plan is intentionally ungrounded (no grounding block), so D8 withholds
      // both values from the order prefill; model prose alone never licenses a stop/target.
      expect(o.stop).toBeNull();
      expect(o.target).toBeNull();
      // Rec provenance pinned on the order itself.
      expect(o.provenance.source).toBe('ai_rec');
      expect(o.provenance.rec_fingerprint).toBe('fp-A');
      expect(o.provenance.trigger_source_text).toBe('Enter on a break above 252');
      await screen.findByTestId('order-row');

      // A non-satisfying live mid does nothing.
      pushLive({ mid: 251 });
      expect(getOrder(o.id)?.status).toBe('waiting');

      // The live cross triggers AND fills at the first live-resolvable mark (trigger_fill).
      await waitFor(() => {
        pushLive({ mid: 253 });
        expect(getOrder(o.id)?.status).toBe('filled');
      });
      const filled = getOrder(o.id) as SimOrder;
      expect(filled.fill_basis).toBe('trigger_fill');
      expect(filled.fill_mark).toBeCloseTo(6.545, 3); // modeled: 5 + 0.5·3 + 0.005·9

      // EXACTLY ONE position, with the two-way durable join + the plan data carried.
      expect(allPositions()).toHaveLength(1);
      const pos = allPositions()[0];
      expect(pos.origin_order_id).toBe(o.id);
      expect(filled.position_id).toBe(pos.id);
      expect(pos.legs[0].entry_basis).toBe('trigger_fill');
      expect(pos.legs[0].entry_price).toBeCloseTo(6.545, 3);
      // Carried through from the SAME order's qty (AC-79: dialog default 1, never seeded from the
      // rec's size text — see the correction at `:437`).
      expect(pos.legs[0].qty).toBe(1);
      expect(pos.stop).toBeNull();
      expect(pos.target).toBeNull();

      // Decision records: append-only audit of every transition, joined to the position.
      const events = allDecisions()
        .filter((d) => d.trade_id === o.id)
        .map((d) => d.event_type);
      expect(events).toContain('order_placed');
      expect(events).toContain('order_triggered'); // the collapsed tick still records the trigger fact
      expect(events).toContain('order_filled');
      const fillRec = allDecisions().find(
        (d) => d.trade_id === o.id && d.event_type === 'order_filled',
      );
      expect(fillRec?.position_id).toBe(pos.id);
      expect(allDecisions().some((d) => d.trade_id === pos.id && d.event_type === 'open')).toBe(
        true,
      );

      // Continued live updates: NO double fill, no duplicate position, the log only ever grows.
      const decisionCount = allDecisions().length;
      pushLive({ mid: 254 });
      pushLive({ mid: 255 });
      expect(allPositions()).toHaveLength(1);
      expect(getOrder(o.id)?.fill_mark).toBeCloseTo(6.545, 3);
      expect(allDecisions().length).toBe(decisionCount);

      // [no-real-order-path]: beyond the throw-by-construction, sweep the log — NOTHING
      // order-flavored ever rode the wire. The only non-GETs are the recommendation POST,
      // the simulated-trade gate POST, and the durable-book PUT.
      expect(fetchLog.some((c) => /order|broker/i.test(c.url))).toBe(false);
      const nonGets = fetchLog.filter((c) => c.method !== 'GET');
      expect(nonGets.length).toBeGreaterThan(0);
      for (const c of nonGets) {
        expect(
          (c.method === 'POST' && /^\/api\/recommendation\/[^/]+$/.test(c.url)) ||
            (c.method === 'POST' && c.url === '/api/positions/sim-trade/gate') ||
            (c.method === 'PUT' && c.url === '/api/book'),
        ).toBe(true);
      }
    },
    T,
  );
});

// =====================================================================================================
// 2. Terminal paths — cancel and clock expiry (forward-only, off-stream expiry)
// =====================================================================================================

describe('orders · cancel / expiry terminal paths', () => {
  it(
    'cancel_is_terminal_and_the_order_stops_evaluating',
    async () => {
      const o = seedOrder({ limit_price: null });
      const user = userEvent.setup();
      renderAt('/ticker/TSLA');
      await settleTicker();
      await screen.findByTestId('order-row');
      // Two-step inline cancel: first click arms, second cancels.
      await user.click(screen.getByTestId('order-cancel'));
      await user.click(screen.getByTestId('order-cancel-confirm'));
      await waitFor(() => expect(getOrder(o.id)?.status).toBe('cancelled'));
      expect(getOrder(o.id)?.close_time).toBeTruthy();
      // A satisfying cross after cancel transitions NOTHING and creates NO position.
      pushLive({ mid: 260 });
      expect(getOrder(o.id)?.status).toBe('cancelled');
      expect(allPositions()).toHaveLength(0);
      expect(
        allDecisions().some((d) => d.trade_id === o.id && d.event_type === 'order_cancelled'),
      ).toBe(true);
    },
    T,
  );

  it(
    'clock_expiry_applies_off_stream_with_no_live_payload_at_all',
    async () => {
      // The good-til bound passed while NO stream was up — the ONLY off-stream transition.
      const o = seedOrder({ expires_at: new Date(Date.now() - 60_000).toISOString() });
      renderAt('/positions');
      await screen.findByTestId('orders-panel');
      await waitFor(() => expect(getOrder(o.id)?.status).toBe('expired'));
      expect(getOrder(o.id)?.close_reason).toBe('expired');
      expect(allPositions()).toHaveLength(0);
      expect(
        allDecisions().some((d) => d.trade_id === o.id && d.event_type === 'order_expired'),
      ).toBe(true);
    },
    T,
  );
});

// =====================================================================================================
// 3. Live-only evaluation + stream degradation ([live-vs-static-isolation], no retro-fill)
// =====================================================================================================

describe('orders · live-only evaluation and stream degradation', () => {
  it(
    'non_live_payloads_never_transition_stream_drop_degrades_only_live_cells_no_retro_fill',
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const tsla = seedOrder({ limit_price: 0.5 }); // uncrossable limit ⇒ `triggered` observable
      const msft = seedOrder({ ticker: 'MSFT' }); // NOT covered by the TSLA stream
      renderAt('/ticker/TSLA');
      const widget = await screen.findByTestId('widget-orders');

      // Frozen/stale/closed payloads that CROSS the level transition nothing (live-mid-only).
      pushLive({ mid: 300, live: false });
      pushLive({ mid: 300, live: false, market_session: 'closed', tick_age_s: null });
      pushLive({ mid: 300, live: false, market_session: 'overnight' });
      expect(getOrder(tsla.id)?.status).toBe('waiting');
      expect(allPositions()).toHaveLength(0);

      // A live payload below the level: evaluated ("Watching"), no transition.
      pushLive({ mid: 250 });
      await screen.findByTestId('order-eval-watching');
      expect(getOrder(tsla.id)?.status).toBe('waiting');

      // The >15s payload gap trips the watchdog ⇒ stream offline. ONLY the live evaluation cell
      // degrades (last-known mid, honest not-evaluated words); the durable row facts persist.
      act(() => {
        vi.advanceTimersByTime(16_000);
      });
      const offline = await screen.findByTestId('order-eval-offline');
      expect(offline).toHaveTextContent(NOT_EVALUATED_TEXT);
      expect(within(offline).getByTestId('order-eval-distance-offline')).toHaveTextContent(
        'mid 250',
      );
      expect(within(widget).getByTestId('order-contract')).toHaveTextContent('TSLA 250C');
      expect(within(widget).getByTestId('order-status-waiting')).toBeInTheDocument();

      // During the outage the level crossed invisibly and came back. The reconnect payload is BELOW
      // the level ⇒ still waiting — NO retro-fill, no catch-up; live cells auto-restore.
      pushLive({ mid: 251 });
      await screen.findByTestId('order-eval-watching');
      expect(getOrder(tsla.id)?.status).toBe('waiting');

      // Evaluation resumes on NEW live data only: the next satisfying payload triggers TSLA —
      // and NEVER the uncovered MSFT order (wrong-ticker isolation).
      pushLive({ mid: 253 });
      await waitFor(() => expect(getOrder(tsla.id)?.status).toBe('triggered'));
      expect(getOrder(msft.id)?.status).toBe('waiting');
      expect(allPositions()).toHaveLength(0); // the 0.5 limit never crossed — nothing filled
    },
    T,
  );

  it(
    'limit_order_rests_above_the_limit_and_fills_only_on_a_live_cross_AT_the_limit',
    async () => {
      const o = seedOrder({ limit_price: 4 });
      renderAt('/ticker/TSLA');
      await settleTicker();
      await screen.findByTestId('order-row');
      pushLive({ mid: 253 }); // triggers; modeled mark ≈6.5 > 4 ⇒ rests
      await waitFor(() => expect(getOrder(o.id)?.status).toBe('triggered'));
      pushLive({ mid: 253 });
      expect(getOrder(o.id)?.status).toBe('triggered'); // still resting — no fill above the limit
      // The LIVE cross at the limit fills AT the limit price, with the limit_fill basis.
      await waitFor(() => {
        pushLive({ mid: 235 });
        expect(getOrder(o.id)?.status).toBe('filled');
      });
      expect(getOrder(o.id)?.fill_mark).toBe(4);
      expect(getOrder(o.id)?.fill_basis).toBe('limit_fill');
      const pos = allPositions().find((p) => p.origin_order_id === o.id);
      expect(pos?.legs[0].entry_price).toBe(4);
      expect(pos?.legs[0].entry_basis).toBe('limit_fill');
    },
    T,
  );
});

// =====================================================================================================
// 4. Wire + labeling invariants ([no-real-order-path] structural half)
// =====================================================================================================

describe('orders · nothing order-flavored rides the wire; SIMULATED labeling', () => {
  it(
    'orders_in_every_state_leave_bundle_and_sse_requests_structurally_unchanged',
    async () => {
      seedOrder({ status: 'waiting' });
      seedOrder({ status: 'triggered', trigger: null, triggered_time: new Date().toISOString() });
      seedOrder({
        status: 'filled',
        filled_time: new Date().toISOString(),
        fill_mark: 4,
        fill_basis: 'limit_fill',
      });
      seedOrder({
        status: 'cancelled',
        close_time: new Date().toISOString(),
        close_reason: 'cancelled',
      });
      seedOrder({
        status: 'expired',
        close_time: new Date().toISOString(),
        close_reason: 'expired',
      });
      const view = renderAt('/ticker/TSLA');
      await settleTicker();
      const widget = await screen.findByTestId('widget-orders');
      pushLive({ mid: 250 });
      // Only the shipped params, nothing order-/scenario-flavored, on EVERY request + stream.
      const ALLOWED = new Set([
        'min_dte',
        'max_dte',
        'expirations',
        'dark_pool',
        'pos_expiration',
        'pos_strike',
        'pos_right',
        'pos_pl_pct',
      ]);
      const bundleCalls = fetchLog.filter((c) => c.url.includes('/api/ticker/'));
      expect(bundleCalls.length).toBeGreaterThan(0);
      for (const c of bundleCalls) {
        const u = new URL(c.url, 'http://x');
        for (const key of u.searchParams.keys()) expect(ALLOWED.has(key)).toBe(true);
      }
      expect(fetchLog.some((c) => /order|scenario|broker/i.test(c.url))).toBe(false);
      // The seeded local portfolio may complete its autonomous signed-in book sync while this
      // full-App flow is running. That exact persistence write is sanctioned; no order write is.
      const nonGets = fetchLog.filter((c) => c.method !== 'GET');
      for (const c of nonGets) expect(c).toMatchObject({ method: 'PUT', url: '/api/book' });
      expect(esInstances.length).toBeGreaterThan(0);
      for (const es of esInstances) {
        const u = new URL(es.url, 'http://x');
        expect(u.pathname).toBe('/api/stream/TSLA');
        for (const key of u.searchParams.keys()) expect(ALLOWED.has(key)).toBe(true);
      }
      // SIMULATED marking on both orders surfaces; no broker/real-order affordance anywhere.
      expect(within(widget).getByText('SIMULATED')).toBeInTheDocument();
      view.unmount();
      renderAt('/positions');
      const panel = await screen.findByTestId('orders-panel');
      expect(within(panel).getByText('SIMULATED')).toBeInTheDocument();
      expect(
        within(panel).queryByRole('button', {
          name: /execute|submit order|buy to open|connect broker/i,
        }),
      ).toBeNull();
    },
    T,
  );
});

// =====================================================================================================
// 5. The server-side gate + corrupt-store degradation
// =====================================================================================================

describe('orders · gate enforcement and store-fault degradation', () => {
  it(
    'server_gate_403_aborts_the_confirm_with_zero_order_stored',
    async () => {
      // FE session says signed-in; the SERVER gate rejects — the server is the boundary of record.
      installBackend({ gateStatus: 403 });
      const user = userEvent.setup();
      renderAt('/ticker/TSLA');
      await settleTicker();
      const dlg = await actIntoDialog(user);
      await user.click(within(dlg).getByRole('button', { name: 'Place simulated order' }));
      await screen.findByTestId('orders-signin-prompt');
      expect(allOrders()).toHaveLength(0);
      await waitFor(() => expect(screen.queryByTestId('trade-entry-dialog')).toBeNull());
    },
    T,
  );

  it(
    'corrupt_orders_store_degrades_to_the_honest_block_page_keeps_working_blob_preserved',
    async () => {
      localStorage.setItem(ORDERS_KEY, '{mangled-by-hand');
      renderAt('/ticker/TSLA');
      await settleTicker();
      // The honest fault block — while the rest of the page (bundle, stream) keeps working.
      const fault = await screen.findByTestId('orders-store-fault');
      expect(fault).toHaveTextContent('Orders unavailable');
      expect(screen.getByTestId('widget-live-tape')).toBeInTheDocument();
      pushLive({ mid: 253 }); // the stream consumer must not crash on a faulted store
      expect(localStorage.getItem(ORDERS_KEY)).toBe('{mangled-by-hand'); // never overwritten
    },
    T,
  );
});

// =====================================================================================================
// 6. Scenario harness — ONLY the two load-bearing facts (the picker/catalog/bypass UI stays untested)
// =====================================================================================================

describe('orders · scenario harness (keyless never blocks; ai_scenario provenance is durable)', () => {
  it(
    'keyless_scenario_run_not_blocked_and_ai_scenario_marker_survives_to_the_ledger_join',
    async () => {
      installBackend({
        // KEYLESS deployment — the SHIPPED 2026-07-02 regression wrongly blocked scenario runs here.
        inAppEnabled: false,
        scenarios: {
          enabled: true,
          catalog: [{ id: 'break_above', name: 'Conditional entry — break above' }],
        },
        rec: (body) => ({
          ...tradeRec(),
          scenario: body['scenario_id']
            ? { id: String(body['scenario_id']), name: 'Conditional entry — break above' }
            : null,
        }),
      });
      const user = userEvent.setup();
      renderAt('/ticker/TSLA');
      await settleTicker();
      // Keyless: the REAL in-app read is unavailable (powering setup, not a disabled Analyze).
      expect(await screen.findByTestId('ai-rec-state-no-key')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Analyze current snapshot' })).toBeNull();
      // …but a scenario run is NOT gated on key resolution/availability: it runs and POSTs.
      await screen.findByTestId('scenario-picker');
      await user.click(
        screen.getByTestId('scenario-picker').querySelector('.MuiSelect-select') as HTMLElement,
      );
      await user.click(
        await screen.findByRole('option', { name: 'Conditional entry — break above' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Run scenario' }));
      await screen.findByTestId('ai-rec-act'); // a produced, actionable scripted rec
      const post = fetchLog.find(
        (c) => c.url.includes('/api/recommendation/') && c.method === 'POST',
      );
      expect(JSON.parse(post?.body ?? '{}').scenario_id).toBe('break_above');

      // Act → confirm → live fill: the ai_scenario marker rides the WHOLE chain.
      await user.click(screen.getByTestId('ai-rec-act'));
      const dlg = await screen.findByTestId('trade-entry-dialog');
      await user.click(within(dlg).getByRole('button', { name: 'Place simulated order' }));
      await waitFor(() => expect(allOrders()).toHaveLength(1));
      const o = allOrders()[0];
      expect(o.provenance.source).toBe('ai_scenario');
      expect(o.provenance.scenario_id).toBe('break_above');
      await waitFor(() => {
        pushLive({ mid: 253 });
        expect(getOrder(o.id)?.status).toBe('filled');
      });
      // The EXACT join the outcomes ledger's scenario_sourced exclusion consumes
      // (`outcomes/ledger.ts`): position.origin_order_id → order.provenance.source.
      expect(allPositions()).toHaveLength(1);
      const pos = allPositions()[0];
      expect(pos.origin_order_id).toBe(o.id);
      expect(getOrder(pos.origin_order_id as string)?.provenance.source).toBe('ai_scenario');
    },
    T,
  );
});
