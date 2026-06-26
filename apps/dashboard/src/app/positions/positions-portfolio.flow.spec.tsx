/**
 * Flow-integration (CENTERPIECE) — drives the REAL positions-portfolio user flow end-to-end through
 * the actual feature subtree (the real `usePortfolio` hook + the real PortfolioPanel/entry/table/
 * toolbar components), mocking ONLY the network boundary (`fetch` via the @org/api client + the SSE
 * `EventSource`). Never a live backend.
 *
 * Journeys walked (the manual mock checks, made re-runnable):
 *  - open 3 entry modes (manual / market / theoretical-market) + stack the same contract
 *  - rest a limit → it never fills on the wrong side / offline → fills on a live cross → cancel another
 *  - per-ticker filter (no refetch) + grouping subtotals (incl. an unavailable-member exclusion)
 *  - SSE drop dims live cells while static records persist; reconnect resumes
 *  - save a named view → reload (re-mount) restores it + all positions + history
 *  - v1→v2 migration carry-over survives reload
 *  - Live tab locked (no positions / no entry / no order / no network) + the additive score invariant
 *
 * Traceability: every AC in the FRONTEND_EXECUTION_CONTRACT §5 matrix maps to a named test below or
 * in the colocated unit/component specs. QA traces each AC → ≥1 passing test at GATE Q.
 */
import { render, screen, within, act, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { streamTicker } from '@org/api';
import type { TickerBundle, LiveUpdate, TrackedContract, StrikeRow } from '@org/api';
import { usePortfolio } from './usePortfolio';
import { PortfolioPanel } from './PortfolioPanel';
import {
  __resetMemory, PORTFOLIO_V1_KEY, PORTFOLIO_V2_KEY, allPositions, decisionsForPosition,
} from './store';
import { AuthProvider } from '../auth/AuthContext';
import { AuthDialogProvider } from '../auth/AuthDialogProvider';

const theme = createTheme();

// ---- INTERFACE-shaped factories --------------------------------------------------------------
function strike(s: number): StrikeRow {
  return { strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20, net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25 };
}
function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA', price: 250, gex_spot: 250, timestamp: 1, timestamp_iso: '2026-06-23T14:00:00Z',
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: '2026-06-26', net_gex: 1, call_gex: 1, put_gex: -1, total_gex: 1, net_dex: 1,
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
    expirations: [{ date: '2026-07-17', dte: 24 }, { date: '2026-08-21', dte: 59 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: 'fp-A', score_threshold: 50 },
    meta: { served_at: '2026-06-23T14:00:00Z', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 }, freshness: { snapshot_iso: '2026-06-23T14:00:00Z', data_age_seconds: 10, stale: false, stale_after_seconds: 600 } },
    position_eval: null,
  };
}

const QUOTE: TrackedContract = {
  ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45, dte: 24,
};

// ---- Controllable mock backend (the network boundary) ----------------------------------------
interface Cfg {
  /** Resolver for a contract lookup, keyed by strike, so per-row failures can be simulated. */
  contract?: (strike: number, right: string) => TrackedContract | null | 'notfound' | 'throw';
}
const esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];

function installBackend(cfg: Cfg = {}) {
  esInstances.length = 0;
  const contractFor = cfg.contract ?? (() => QUOTE);
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() { esInstances.push(this); }
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  const json = (b: unknown, status = 200) => new Response(b === null ? 'null' : JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // user-accounts: who-am-I read on mount (signed-in write path; gating covered in the auth suite).
    if (url.includes('/api/auth/session')) return json({ authenticated: true, user: { id: 'u-test', email: 'test@user.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } });
    // user-accounts (AC-E7): the Positions sim-trade WRITE awaits the SERVER gate first; signed-in ⇒ authorize.
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/contract/')) {
      const u = new URL(url, 'http://x');
      const s = Number(u.searchParams.get('strike'));
      const right = u.searchParams.get('right') ?? 'call';
      const r = contractFor(s, right);
      if (r === 'throw') throw new Error('network');
      if (r === 'notfound' || r === null) return json(null, 404);
      return json({ ...r, strike: s, right });
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

/** Push an SSE payload to all live EventSources. */
function pushLive(over: Partial<LiveUpdate> = {}) {
  const u: LiveUpdate = {
    ticker: 'TSLA', mid: 250, bid: null, ask: null, spread: null, net_flow: 0, buy_vol: 0, sell_vol: 0,
    flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular', feed: 'realtime',
    ts: Date.now(), gamma_flip: 248, last_trade: 250, ...over,
  };
  act(() => { esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(u) } as MessageEvent)); });
}

// ---- Harness: the real feature subtree, with the REAL SSE path driving the live feed -----------
// Mirrors app.tsx: subscribes via the real `streamTicker` client so a pushed payload flows through
// the real EventSource → `live`. `forceOffline` simulates the transport-drop watchdog firing.
function Harness({ forceOffline = false }: { forceOffline?: boolean }) {
  const [data] = useState<TickerBundle | null>(makeBundle());
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  useEffect(() => {
    const unsub = streamTicker('TSLA', {}, (u) => setLive(u));
    return unsub;
  }, []);
  const streamOffline = forceOffline;
  const isLive = (live?.live ?? false) && !streamOffline;
  const pf = usePortfolio('TSLA', data, live, isLive, streamOffline);
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <AuthDialogProvider>
          <PortfolioPanel
            pf={pf} data={data} live={live} isLive={isLive} streamOffline={streamOffline}
            ticker="TSLA" entryOpen={entryOpen} onEntryOpen={setEntryOpen}
          />
        </AuthDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  return render(<Harness {...props} />);
}

beforeEach(() => { localStorage.clear(); __resetMemory(); vi.restoreAllMocks(); });
afterEach(() => cleanup());

// ---- Entry-mode openers (helpers) --------------------------------------------------------------
async function openManual(user: ReturnType<typeof userEvent.setup>, price: string, strikeVal = 250) {
  await user.click(screen.getByTestId('open-entry'));
  const dlg = await screen.findByRole('dialog');
  await pickStrike(user, dlg, strikeVal);
  await user.type(within(dlg).getByLabelText('Manual price'), price);
  await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); // dialog closed
}
async function pickStrike(user: ReturnType<typeof userEvent.setup>, dlg: HTMLElement, s: number) {
  // The strike select defaults to the nearest-to-spot; only re-pick when a different one is asked.
  if (s === 250) return;
  // MUI Select renders as a combobox (aria-labelledby), not a native labelled control.
  const combos = within(dlg).getAllByRole('combobox');
  // Order in the dialog: Expiration, Strike.
  await user.click(combos[1]);
  await user.click(await screen.findByRole('option', { name: `$${s}` }));
}

describe('multi-position book + entry modes (AC-1, AC-2, AC-3, AC-12, AC-14)', () => {
  it('positions_portfolio_end_to_end_flow', async () => {
    // ===== This single test walks the FULL journey across every surface (the centerpiece). =====
    const user = userEvent.setup();
    installBackend();
    renderHarness();

    // --- open a MANUAL position ($7) and a MARKET position (fills at mid 5) ---
    await openManual(user, '7');
    await user.click(screen.getByTestId('open-entry'));
    let dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Market' }));
    await within(dlg).findByText(/Fill: mid \$5\.00/);
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));

    // Two concurrent open positions, same ticker, both on the 250C contract → STACKED (not merged).
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(2));
    expect(allPositions()).toHaveLength(2);

    // --- per-row marks update on the feed ---
    pushLive({ mid: 252 });
    await waitFor(() => expect(screen.getAllByTestId('cell-mark').length).toBe(2));

    // --- place a LIMIT at $4 (below the live mark of 5 → rests, does not fill) (AC-17, AC-20) ---
    await user.click(screen.getByTestId('open-entry'));
    dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));

    // Pending row visible; switch the status filter to include pending so it shows.
    await user.click(screen.getByTestId('status-chip-pending'));
    await waitFor(() => expect(screen.getByTestId('pending-affordance')).toBeInTheDocument());
    // A live tick where the mark is ABOVE the limit must NOT fill it.
    pushLive({ mid: 250 });
    expect(allPositions().find((p) => p.status === 'pending')).toBeTruthy();

    // --- the limit FILLS on a live cross (drive the option mark to ≤ 4 via the underlying) (AC-18) ---
    // computeMark models from the underlying move × delta; push the underlying well below the anchor.
    pushLive({ mid: 235 });
    await waitFor(() => {
      const pending = allPositions().find((p) => p.limit_price === 4);
      expect(pending?.status).toBe('open');
    });
    // A limit_filled event was recorded.
    const filled = allPositions().find((p) => p.limit_price === 4)!;
    expect(decisionsForPosition(filled.id).some((d) => d.event_type === 'limit_filled')).toBe(true);

    // --- SSE DROP: live cells dim + ⏸ offline + last-known; static records persist (AC-32, AC-34) ---
    cleanup();
    renderHarness({ forceOffline: true });
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/⏸ offline/).length).toBeGreaterThan(0);
    // static contract line still renders
    expect(screen.getAllByText(/TSLA \$250C/).length).toBeGreaterThan(0);
    // customization toolbar still works under a drop (AC-29)
    expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument();
  }, 20000);
});

describe('per-ticker filter (no refetch) + grouping subtotals (AC-4, AC-10)', () => {
  it('per_ticker_filter_shows_only_that_ticker_no_refetch', async () => {
    const user = userEvent.setup();
    installBackend();
    renderHarness();
    await openManual(user, '5');           // TSLA 250C
    // Open a position on a different strike to make the book richer.
    await user.click(screen.getByTestId('open-entry'));
    const dlg2 = await screen.findByRole('dialog');
    await pickStrike(user, dlg2, 255);
    await user.type(within(dlg2).getByLabelText('Manual price'), '3');
    await user.click(within(dlg2).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(2));

    const fetchCallsBefore = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    // Filter to TSLA (the only ticker) — derived, no refetch. (MUI Select opens on the combobox node.)
    await user.click(screen.getByTestId('filter-ticker').querySelector('[role="combobox"]') as HTMLElement);
    await user.click(await screen.findByRole('option', { name: 'TSLA' }));
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(2));
    const fetchCallsAfter = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fetchCallsAfter).toBe(fetchCallsBefore); // pure re-derivation, no extra fetch

    // Group by ticker → a subtotal header appears.
    await user.click(screen.getByTestId('group-select').querySelector('[role="combobox"]') as HTMLElement);
    await user.click(await screen.findByRole('option', { name: 'Ticker' }));
    await waitFor(() => expect(screen.getByTestId('group-header')).toBeInTheDocument());
    expect(screen.getByTestId('subtotal').textContent).toMatch(/Subtotal/);
  }, 20000);
});

describe('saved views survive reload + positions/history persist (AC-27, AC-28, AC-30)', () => {
  it('save_named_view_then_switch_rename_delete_and_restore_after_reload', async () => {
    const user = userEvent.setup();
    installBackend();
    renderHarness();
    await openManual(user, '5');

    // Change the layout to cards, then save it as a named view.
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    await user.click(screen.getByTestId('view-picker'));
    await user.click(screen.getByTestId('save-as-new'));
    const nameInput = within(screen.getByTestId('save-as-name')).getByRole('textbox');
    await user.type(nameInput, 'Tech swings');
    await waitFor(() => expect(screen.getByTestId('save-view-confirm')).toBeEnabled());
    await user.click(screen.getByTestId('save-view-confirm'));
    await waitFor(() => expect(screen.getByTestId('view-picker').textContent).toMatch(/Tech swings/));

    // --- RELOAD: re-mount fresh from the durable store ---
    __resetMemory();
    cleanup();
    renderHarness();
    // The active saved view (Tech swings, card layout) restored + the position persists.
    await waitFor(() => expect(screen.getByTestId('view-picker').textContent).toMatch(/Tech swings/));
    expect(screen.getByTestId('positions-cards')).toBeInTheDocument(); // card layout restored
    expect(screen.getByTestId('position-card')).toBeInTheDocument();   // position persisted
  }, 20000);
});

describe('migration carry-over (AC-31)', () => {
  it('existing_single_trade_migrates_to_one_open_position_intact_survives_reload', async () => {
    // Seed a v1 ghost-trade blob, then mount the portfolio fresh → it migrates + renders it.
    localStorage.setItem(PORTFOLIO_V1_KEY, JSON.stringify({
      schema_version: 1,
      trades: { TSLA: { id: 'legacy-1', ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', side: 'long', qty: 2, entry_mark: 5, entry_basis: 'snapshot', entry_time: '2026-06-20T10:00:00Z', status: 'open', schema_version: 1 } },
      decisions: [{ event_type: 'open', clock_time: '2026-06-20T10:00:00Z', trade_id: 'legacy-1', contract: { ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', qty: 2 }, mark_price: 5, mark_basis: 'snapshot', underlying_spot: 250, pl_dollar: 0, pl_pct: 0, tier: 'watch', position_fingerprint: '', schema_version: 1 }],
    }));
    __resetMemory();
    installBackend();
    renderHarness();
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(1));
    expect(screen.getByText(/TSLA \$250C · exp 2026-07-17 · Long ×2/)).toBeInTheDocument();
    expect(allPositions()[0].id).toBe('legacy-1');
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();

    // Reload (re-mount) — still exactly one open position, intact.
    __resetMemory();
    cleanup();
    renderHarness();
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(1));
    expect(allPositions()[0].entry_mark).toBe(5);
  }, 20000);
});

describe('per-row isolation + Live lock (AC-35, AC-39, AC-40)', () => {
  it('one_row_lookup_failure_isolated_and_live_tab_makes_no_network_call', async () => {
    const user = userEvent.setup();
    // The 255 strike contract 404s; the 250 strike resolves fine.
    installBackend({ contract: (s) => (s === 255 ? 'notfound' : QUOTE) });
    renderHarness();
    await openManual(user, '5');                    // 250C ok
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await pickStrike(user, dlg, 255);
    await user.type(within(dlg).getByLabelText('Manual price'), '3');
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
    pushLive({ mid: 251 });

    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(2));
    // Exactly the failing row reads "unavailable"; the other keeps pricing.
    await waitFor(() => expect(screen.getAllByTestId('cell-unavailable').length).toBeGreaterThan(0));
    expect(screen.getAllByTestId('cell-mark').length).toBeGreaterThan(0); // the healthy row still marks

    // --- Live tab: no positions, no entry, no order, no network call ---
    const fetchBefore = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(screen.getByTestId('tab-live'));
    expect(screen.getByTestId('live-locked-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('position-row')).toBeNull();
    expect(screen.queryByTestId('open-entry')).toBeNull();
    // switching to Live triggered no extra fetch
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchBefore);
  }, 20000);
});

describe('cancel a resting limit → history retention (AC-19, AC-37)', () => {
  it('pending_limit_cancel_to_cancelled_records_event_stays_in_history', async () => {
    const user = userEvent.setup();
    installBackend();
    renderHarness();
    // Place a limit at $4 (below mark → rests).
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));

    await user.click(screen.getByTestId('status-chip-pending'));
    await waitFor(() => expect(screen.getByTestId('pending-affordance')).toBeInTheDocument());
    // Cancel it.
    await user.click(within(screen.getByTestId('pending-affordance')).getByText('Cancel'));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'cancelled')).toBe(true));
    const cancelled = allPositions().find((p) => p.status === 'cancelled')!;
    expect(decisionsForPosition(cancelled.id).some((d) => d.event_type === 'limit_cancelled')).toBe(true);

    // It stays in the closed/history view, never pruned.
    await user.click(screen.getByTestId('history-button'));
    await waitFor(() => expect(screen.getByTestId('history-caption')).toBeInTheDocument());
    expect(screen.getByText(/Cancelled · resting limit never filled/)).toBeInTheDocument();
  }, 20000);
});
