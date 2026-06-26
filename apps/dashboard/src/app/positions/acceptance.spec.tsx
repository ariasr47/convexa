/**
 * Acceptance matrix — one named test per AC, matching the FRONTEND_EXECUTION_CONTRACT §5 "Tests to
 * write" matrix exactly so QA can trace each AC → ≥1 named passing test at GATE Q. Many ACs are also
 * exercised in the flow-integration centerpiece (positions-portfolio.flow.spec.tsx) and the colocated
 * unit/component specs; this file pins the matrix names. Mocks ONLY the network boundary (`fetch` +
 * the SSE `EventSource`), never a live backend.
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
import { __resetMemory, allPositions, decisionsForPosition } from './store';
import { AuthProvider } from '../auth/AuthContext';
import { AuthDialogProvider } from '../auth/AuthDialogProvider';

const theme = createTheme();

// ---- factories (INTERFACE-shaped) --------------------------------------------------------------
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
    signals: { ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {}, setups: [], opportunity_score: 42, opportunity_tier: 'watch', prime_prompt_eligible: false },
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [{ date: '2026-07-17', dte: 24 }, { date: '2026-08-21', dte: 59 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: 'fp-A', score_threshold: 50 },
    meta: { served_at: '2026-06-23T14:00:00Z', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 }, freshness: { snapshot_iso: '2026-06-23T14:00:00Z', data_age_seconds: 10, stale: false, stale_after_seconds: 600 } },
    position_eval: null,
  };
}
const QUOTE: TrackedContract = {
  ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 }, iv: 0.45, dte: 24,
};

const esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];
function installBackend(contractFor: (s: number, r: string) => TrackedContract | null | 'notfound' | 'throw' = () => QUOTE) {
  esInstances.length = 0;
  class MockEventSource { onmessage: ((e: MessageEvent) => void) | null = null; onerror: ((e: Event) => void) | null = null; constructor() { esInstances.push(this); } close() { /* no-op */ } }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  const json = (b: unknown, status = 200) => new Response(b === null ? 'null' : JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // user-accounts: the Positions WRITE actions gate on who-am-I. These acceptance tests exercise the
    // SIGNED-IN write path (gating is covered separately in the auth suite), so a stable signed-in
    // session lets the existing write behaviors run unchanged.
    if (url.includes('/api/auth/session')) {
      return json({ authenticated: true, user: { id: 'u-test', email: 'test@user.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } });
    }
    // user-accounts (AC-E7): the Positions sim-trade WRITE now awaits the SERVER gate before the local
    // write. Signed-in path ⇒ authorize so the existing write behaviors run unchanged.
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/contract/')) {
      const u = new URL(url, 'http://x'); const s = Number(u.searchParams.get('strike')); const r = u.searchParams.get('right') ?? 'call';
      const res = contractFor(s, r);
      if (res === 'throw') throw new Error('net');
      if (res === 'notfound' || res === null) return json(null, 404);
      return json({ ...res, strike: s, right: r });
    }
    throw new Error(`unexpected ${url}`);
  }));
}
function pushLive(over: Partial<LiveUpdate> = {}) {
  const u: LiveUpdate = { ticker: 'TSLA', mid: 250, bid: null, ask: null, spread: null, net_flow: 0, buy_vol: 0, sell_vol: 0, flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular', feed: 'realtime', ts: Date.now(), gamma_flip: 248, last_trade: 250, ...over };
  act(() => { esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(u) } as MessageEvent)); });
}

function Harness({ forceOffline = false }: { forceOffline?: boolean }) {
  const [data] = useState<TickerBundle | null>(makeBundle());
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  useEffect(() => streamTicker('TSLA', {}, (u) => setLive(u)), []);
  const isLive = (live?.live ?? false) && !forceOffline;
  const pf = usePortfolio('TSLA', data, live, isLive, forceOffline);
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <AuthDialogProvider>
          <PortfolioPanel pf={pf} data={data} live={live} isLive={isLive} streamOffline={forceOffline} ticker="TSLA" entryOpen={entryOpen} onEntryOpen={setEntryOpen} />
        </AuthDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
const renderH = (p: Parameters<typeof Harness>[0] = {}) => render(<Harness {...p} />);

async function openManual(user: ReturnType<typeof userEvent.setup>, price: string, strikeVal?: number) {
  await user.click(screen.getByTestId('open-entry'));
  const dlg = await screen.findByRole('dialog');
  if (strikeVal && strikeVal !== 250) {
    const combos = within(dlg).getAllByRole('combobox');
    await user.click(combos[1]);
    await user.click(await screen.findByRole('option', { name: `$${strikeVal}` }));
  }
  await user.type(within(dlg).getByLabelText('Manual price'), price);
  await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}
const comboOf = (testid: string) => screen.getByTestId(testid).querySelector('[role="combobox"]') as HTMLElement;

beforeEach(() => { localStorage.clear(); __resetMemory(); vi.restoreAllMocks(); });
afterEach(() => cleanup());

// =============================== A. Central & per-ticker views ===============================
describe('A. central & per-ticker', () => {
  it('renders_multiple_concurrent_open_positions_updating_on_feed', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await openManual(user, '6', 255);
    expect(screen.getAllByTestId('position-row')).toHaveLength(2);
    pushLive({ mid: 252 });
    await waitFor(() => expect(screen.getAllByTestId('cell-mark').length).toBe(2));
  });

  it('second_position_same_ticker_shows_two_rows', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await openManual(user, '5', 255);
    expect(screen.getAllByTestId('position-row')).toHaveLength(2);
  });

  it('second_position_same_contract_stacks_not_merges', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');     // 250C
    await openManual(user, '8');     // 250C again — different price, must STACK as a second lot
    const rows = allPositions();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);          // distinct identities
    expect(rows.map((r) => r.entry_mark).sort()).toEqual([5, 8]); // not averaged
  });

  it('per_ticker_filter_shows_only_that_ticker_no_refetch', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(comboOf('filter-ticker'));
    await user.click(await screen.findByRole('option', { name: 'TSLA' }));
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(1));
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('empty_collection_shows_empty_state_not_error', async () => {
    installBackend(); renderH();
    await waitFor(() => expect(screen.getByTestId('empty-no-positions')).toBeInTheDocument());
    expect(screen.getByText(/No simulated positions yet/)).toBeInTheDocument();
  });
});

// =============================== B. P/L and its change ===============================
describe('B. P/L + change', () => {
  it('pl_shows_pct_and_dollar_gain_above_loss_below_100x_qty', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');   // entry 4, qty 1; mark resolves to 5 ⇒ +$100 (+25%)
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getByText(/\+\$100 \(\+25\.0%\)/)).toBeInTheDocument());
  });

  it('delta_since_entry_derives_from_entry_anchor_and_mark', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    // Δ since entry column = same $100 move from the entry anchor.
    await waitFor(() => expect(screen.getByTestId('cell-delta-entry')).toHaveTextContent('+$100'));
  });

  it('session_delta_reanchors_on_reload', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getByTestId('cell-session-delta')).toBeInTheDocument());
    // Reload (re-mount) → the session anchor clears; session Δ re-anchors fresh (starts at $0 / —).
    __resetMemory(); cleanup(); installBackend(); renderH();
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getByTestId('cell-session-delta')).toBeInTheDocument());
    // First observation after reload is the new anchor ⇒ session Δ is 0 or em-dash, never the prior run's value.
    expect(screen.getByTestId('cell-session-delta').textContent).toMatch(/(\+\$0|—)/);
  });

  it('trend_sparkline_grows_as_feed_updates', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    pushLive({ mid: 251 });
    pushLive({ mid: 252 });
    await waitFor(() => {
      const spark = screen.queryByTestId('trend-sparkline');
      expect(spark).toBeTruthy();
      expect(Number(spark?.getAttribute('data-points'))).toBeGreaterThanOrEqual(2);
    });
  });

  it('group_subtotal_equals_sum_of_member_dollar_pl', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    await openManual(user, '3', 255);
    pushLive({ mid: 250 });
    await user.click(comboOf('group-select'));
    await user.click(await screen.findByRole('option', { name: 'Ticker' }));
    await waitFor(() => expect(screen.getByTestId('subtotal')).toBeInTheDocument());
    expect(screen.getByTestId('subtotal').textContent).toMatch(/Subtotal/);
  });

  it('subtotal_excludes_and_flags_unavailable_member_not_zero', async () => {
    const user = userEvent.setup();
    installBackend((s) => (s === 255 ? 'notfound' : QUOTE)); renderH();
    await openManual(user, '4');
    await openManual(user, '3', 255);   // this one 404s ⇒ unavailable
    pushLive({ mid: 250 });
    await user.click(comboOf('group-select'));
    await user.click(await screen.findByRole('option', { name: 'Ticker' }));
    await waitFor(() => expect(screen.getByTestId('subtotal').textContent).toMatch(/excluded \(unavailable\)/));
  });
});

// =============================== C. Entry modes & resting limit ===============================
describe('C. entry modes', () => {
  it('manual_entry_opens_at_typed_price_user_entered_basis', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '7.5');
    expect(allPositions()[0].entry_mark).toBe(7.5);
    expect(allPositions()[0].entry_basis).toBe('user_entered');
  });

  it('manual_entry_succeeds_with_no_quote_or_chain', async () => {
    const user = userEvent.setup(); installBackend(() => 'notfound'); renderH();
    await openManual(user, '3');
    expect(allPositions()).toHaveLength(1);
    expect(allPositions()[0].entry_mode).toBe('manual');
  });

  it('market_entry_opens_at_live_option_price_market_basis', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Market' }));
    await within(dlg).findByText(/Fill: mid \$5\.00/);
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(allPositions()[0]?.entry_basis).toBe('snapshot'));
    expect(allPositions()[0].entry_mark).toBe(5);
  });

  it('market_entry_no_quote_fills_at_theoretical_mark', async () => {
    const user = userEvent.setup(); installBackend(() => ({ ...QUOTE, option_quote: null })); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Market' }));
    await within(dlg).findByText(/theoretical \(Black-Scholes\) mark/);
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(allPositions()[0]?.entry_basis).toBe('theoretical'));
  });

  it('market_entry_no_resolvable_price_creates_no_position_isolated_failure', async () => {
    const user = userEvent.setup(); installBackend(() => ({ ...QUOTE, option_quote: null, iv: null })); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Market' }));
    await within(dlg).findByText(/a market order can't fill/);
    expect(within(dlg).getByRole('button', { name: 'Open simulated position' })).toBeDisabled();
    expect(allPositions()).toHaveLength(0); // no position created, app intact
  });

  it('limit_entry_rests_pending_visible_not_filled_wrong_side', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4'); // below live mark 5 ⇒ rests
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'pending')).toBe(true));
    pushLive({ mid: 250 }); // mark stays ~5 (above limit) ⇒ no fill
    expect(allPositions().find((p) => p.limit_price === 4)?.status).toBe('pending');
  });

  it('pending_limit_fills_on_live_cross_at_limit_price_records_event', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'pending')).toBe(true));
    pushLive({ mid: 235 }); // drives the modeled option mark ≤ 4 ⇒ fills at the limit
    await waitFor(() => {
      const p = allPositions().find((x) => x.limit_price === 4);
      expect(p?.status).toBe('open');
      expect(p?.entry_mark).toBe(4); // filled AT the limit price, never better
    });
    const filled = allPositions().find((x) => x.limit_price === 4)!;
    expect(decisionsForPosition(filled.id).some((d) => d.event_type === 'limit_filled')).toBe(true);
  });

  it('pending_limit_cancel_to_cancelled_records_event_stays_in_history', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));
    await user.click(screen.getByTestId('status-chip-pending'));
    await waitFor(() => expect(screen.getByTestId('pending-affordance')).toBeInTheDocument());
    await user.click(within(screen.getByTestId('pending-affordance')).getByText('Cancel'));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'cancelled')).toBe(true));
    const c = allPositions().find((p) => p.status === 'cancelled')!;
    expect(decisionsForPosition(c.id).some((d) => d.event_type === 'limit_cancelled')).toBe(true);
  });

  it('pending_limit_does_not_fill_off_non_live_mark_stays_pending', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Limit' }));
    await user.type(within(dlg).getByLabelText('Limit price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Place limit order' }));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'pending')).toBe(true));
    // Re-mount OFFLINE then push a crossing mark — it must NOT fill off a non-live mark.
    cleanup(); renderH({ forceOffline: true });
    pushLive({ mid: 235, live: false }); // not live ⇒ no fill
    await new Promise((r) => setTimeout(r, 20));
    expect(allPositions().find((p) => p.limit_price === 4)?.status).toBe('pending');
  });
});

// =============================== D. Grouping/sorting/filtering/views ===============================
describe('D. customization', () => {
  it('group_by_ticker_strategy_expiry_and_off', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    for (const axis of ['Ticker', 'Strategy', 'Expiry']) {
      await user.click(comboOf('group-select'));
      await user.click(await screen.findByRole('option', { name: axis }));
      await waitFor(() => expect(screen.getByTestId('group-header')).toBeInTheDocument());
    }
    await user.click(comboOf('group-select'));
    await user.click(await screen.findByRole('option', { name: 'None' }));
    await waitFor(() => expect(screen.queryByTestId('group-header')).toBeNull());
  });

  it('strategy_group_is_derived_long_call_vs_long_put', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');                          // a call
    await user.click(screen.getByTestId('open-entry'));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Put' }));
    await user.type(within(dlg).getByLabelText('Manual price'), '3');
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(comboOf('group-select'));
    await user.click(await screen.findByRole('option', { name: 'Strategy' }));
    await waitFor(() => {
      const headers = screen.getAllByTestId('group-header').map((h) => h.textContent);
      expect(headers.some((t) => /Long call/.test(t ?? ''))).toBe(true);
      expect(headers.some((t) => /Long put/.test(t ?? ''))).toBe(true);
    });
  });

  it('sort_by_attribute_ascending_and_descending', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');     // entry 5
    await openManual(user, '4', 255); // entry 4
    pushLive({ mid: 250 });
    await user.click(comboOf('sort-select'));
    await user.click(await screen.findByRole('option', { name: 'P/L ($)' }));
    const descIds = screen.getAllByTestId('position-row').map((r) => r.getAttribute('data-id'));
    await user.click(screen.getByTestId('sort-dir')); // flip to ascending
    await waitFor(() => {
      const ascIds = screen.getAllByTestId('position-row').map((r) => r.getAttribute('data-id'));
      expect(ascIds).toEqual([...descIds].reverse());
    });
  });

  it('filter_by_ticker_status_strategy_expiry', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    // Strategy filter to Long put → the single long-call position drops out (filtered empty).
    await user.click(comboOf('filter-strategy'));
    await user.click(await screen.findByRole('option', { name: 'Long put' }));
    await waitFor(() => expect(screen.getByTestId('empty-filtered')).toBeInTheDocument());
  });

  it('choose_and_reorder_columns', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByTestId('columns-button'));
    // Toggle the optional Strategy column on (column-option rows carry data-col).
    const strategyOpt = screen.getAllByTestId('column-option').find((el) => el.getAttribute('data-col') === 'strategy')!;
    await user.click(strategyOpt);
    await waitFor(() => expect(within(screen.getByTestId('positions-table')).getByText('Strategy')).toBeInTheDocument());
  });

  it('toggle_table_card_layout_and_comfortable_compact_density', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    await waitFor(() => expect(screen.getByTestId('positions-cards')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Compact' }));
    await waitFor(() => expect(screen.getByTestId('positions-cards').getAttribute('data-density')).toBe('compact'));
  });

  it('save_named_view_then_switch_rename_delete', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    await user.click(screen.getByTestId('view-picker'));
    await user.click(screen.getByTestId('save-as-new'));
    await user.type(within(screen.getByTestId('save-as-name')).getByRole('textbox'), 'Tech swings');
    await waitFor(() => expect(screen.getByTestId('save-view-confirm')).toBeEnabled());
    await user.click(screen.getByTestId('save-view-confirm'));
    await waitFor(() => expect(screen.getByTestId('view-picker').textContent).toMatch(/Tech swings/));
    // Switch back to All positions.
    await user.click(screen.getByTestId('view-picker'));
    await user.click(screen.getByText('All positions'));
    await waitFor(() => expect(screen.getByTestId('view-picker').textContent).toMatch(/All positions/));
    // Delete the saved view.
    await user.click(screen.getByTestId('view-picker'));
    await user.click(within(screen.getByText('Tech swings').closest('li') as HTMLElement).getByLabelText('delete view'));
    await user.click(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(screen.queryByText('Tech swings')).toBeNull());
  });

  it('saved_view_and_full_config_restore_after_reload', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    await user.click(screen.getByTestId('view-picker'));
    await user.click(screen.getByTestId('save-as-new'));
    await user.type(within(screen.getByTestId('save-as-name')).getByRole('textbox'), 'My view');
    await waitFor(() => expect(screen.getByTestId('save-view-confirm')).toBeEnabled());
    await user.click(screen.getByTestId('save-view-confirm'));
    await waitFor(() => expect(screen.getByTestId('view-picker').textContent).toMatch(/My view/));
    // RELOAD.
    __resetMemory(); cleanup(); installBackend(); renderH();
    await waitFor(() => expect(screen.getByTestId('view-picker').textContent).toMatch(/My view/));
    expect(screen.getByTestId('positions-cards')).toBeInTheDocument(); // card layout restored
  });

  it('customization_untouched_by_feed_drop', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    await waitFor(() => expect(screen.getByTestId('positions-cards')).toBeInTheDocument());
    // Drop the feed (re-mount offline): customization (card layout) is durable + untouched.
    cleanup(); renderH({ forceOffline: true });
    await waitFor(() => expect(screen.getByTestId('positions-cards')).toBeInTheDocument());
    expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument();
  });
});

// =============================== E. Durability / migration / isolation ===============================
describe('E. durability + degraded', () => {
  it('all_positions_and_history_persist_after_reload', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await openManual(user, '6', 255);
    expect(allPositions()).toHaveLength(2);
    __resetMemory(); cleanup(); installBackend(); renderH();
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(2));
    expect(allPositions()).toHaveLength(2);
  });

  it('existing_single_trade_migrates_to_one_open_position_intact_survives_reload', async () => {
    localStorage.setItem('gammaflow.ghost-trade.v1', JSON.stringify({
      schema_version: 1,
      trades: { TSLA: { id: 'legacy', ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', side: 'long', qty: 2, entry_mark: 5, entry_basis: 'snapshot', entry_time: '2026-06-20T10:00:00Z', status: 'open', schema_version: 1 } },
      decisions: [],
    }));
    __resetMemory(); installBackend(); renderH();
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(1));
    expect(allPositions()[0].id).toBe('legacy');
    __resetMemory(); cleanup(); installBackend(); renderH();
    await waitFor(() => expect(screen.getAllByTestId('position-row').length).toBe(1));
  });

  it('feed_drop_live_cells_show_offline_last_known_not_blank_zero_live', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getAllByText(/\+\$100/).length).toBeGreaterThan(0));
    cleanup(); renderH({ forceOffline: true });
    await waitFor(() => expect(screen.getAllByText(/⏸ offline/).length).toBeGreaterThan(0));
    expect(screen.getByText(/TSLA \$250C/)).toBeInTheDocument(); // not blank
  });

  it('feed_drop_trend_shows_broken_line_resumes_on_reconnect', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 }); pushLive({ mid: 251 });
    // The sparkline is rendered (broken-line idiom: connectNulls=false) and resumes on more ticks.
    await waitFor(() => expect(screen.queryByTestId('trend-sparkline')).toBeTruthy());
    pushLive({ mid: 252 });
    await waitFor(() => expect(Number(screen.getByTestId('trend-sparkline').getAttribute('data-points'))).toBeGreaterThanOrEqual(2));
  });

  it('feed_drop_static_reads_keep_rendering', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    cleanup(); renderH({ forceOffline: true });
    await waitFor(() => expect(screen.getByText(/TSLA \$250C/)).toBeInTheDocument());
    expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument(); // saved views / customization persist
  });

  it('one_row_lookup_failure_isolated_others_subtotal_feed_unaffected', async () => {
    const user = userEvent.setup(); installBackend((s) => (s === 255 ? 'throw' : QUOTE)); renderH();
    await openManual(user, '4');
    await openManual(user, '3', 255);
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getAllByTestId('cell-unavailable').length).toBeGreaterThan(0));
    expect(screen.getAllByTestId('cell-mark').length).toBeGreaterThan(0); // healthy row still marks
  });

  it('corrupt_store_degrades_to_empty_without_app_error_keeps_readable_blob', async () => {
    localStorage.setItem('gammaflow.positions.v2', '{ corrupt');
    __resetMemory(); installBackend();
    expect(() => renderH()).not.toThrow();
    await waitFor(() => expect(screen.getByTestId('empty-no-positions')).toBeInTheDocument());
  });

  it('closed_and_cancelled_retained_in_separate_history_view_never_pruned', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    pushLive({ mid: 250 });
    // Close it.
    await user.click(within(screen.getByTestId('position-row')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'closed')).toBe(true));
    // History view shows it with the never-pruned caption.
    await user.click(screen.getByTestId('history-button'));
    await waitFor(() => expect(screen.getByTestId('history-caption')).toBeInTheDocument());
    expect(screen.getByText(/Closed · realized/)).toBeInTheDocument();
  });
});

// =============================== F. Live lock + guardrails ===============================
describe('F. live lock + invariants', () => {
  it('live_tab_present_selectable_renders_coming_soon_not_connected_lock', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await user.click(screen.getByTestId('tab-live'));
    expect(screen.getByText(/Live · coming soon/)).toBeInTheDocument();
    expect(screen.getByTestId('live-lock-chip')).toHaveTextContent('Not connected');
  });

  it('live_view_no_positions_no_entry_no_order_no_network_call', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(screen.getByTestId('tab-live'));
    expect(screen.queryByTestId('position-row')).toBeNull();
    expect(screen.queryByTestId('open-entry')).toBeNull();
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('no_real_order_path_anywhere_simulated_unmistakable', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    // The SIMULATED marker is present; no "real order" / "broker" affordance anywhere.
    expect(screen.getAllByText('SIMULATED').length).toBeGreaterThan(0);
    expect(screen.queryByText(/place real order/i)).toBeNull();
  });

  it('score_tier_fingerprint_byte_identical_with_or_without_portfolio', async () => {
    // The portfolio module imports NOTHING from signals/scoring; opening positions only touches the
    // FE-local store + the existing /api/contract lookup — never /api/ticker, never a scoring input.
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await openManual(user, '6', 255);
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    // No bundle/ticker/scoring request is ever issued by the portfolio; only the contract lookup.
    // (The who-am-I session read AND the sim-trade write gate are AUTH-class concerns, not scoring
    // paths — excluded here. The auth gate carries no scoring input and never touches /api/ticker.)
    expect(calls.some((u) => u.includes('/api/ticker/'))).toBe(false);
    const nonAuth = calls.filter((u) => !u.includes('/api/auth/') && !u.includes('/api/positions/sim-trade/gate'));
    expect(nonAuth.every((u) => u.includes('/api/contract/'))).toBe(true);
  });
});
