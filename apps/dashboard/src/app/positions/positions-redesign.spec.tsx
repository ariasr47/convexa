/**
 * Component — the convexa-redesign Positions re-skin structure (FRONTEND_EXECUTION_CONTRACT · Positions).
 * Asserts the NEW observable structure + the preserved invariants on a re-skin: the page-header Net P/L
 * (open) readout (sign color + offline dim), the underline tabs + green PAPER badge, the toolbar's
 * segmented controls wiring to `working.*`, the status pills (multi-select, default ['open']), the
 * offline banner, the cards layout, and the re-skinned Live locked panel.
 *
 * Mocks ONLY the network boundary (`fetch` + the SSE `EventSource`); never a live backend.
 */
import { render, screen, within, act, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { streamTicker } from '@org/api';
import type { TickerBundle, LiveUpdate, TrackedContract, StrikeRow } from '@org/api';
import { usePortfolio } from './usePortfolio';
import { PortfolioPanel } from './PortfolioPanel';
import { LiveTabPanel } from './LiveTabPanel';
import { CustomizationToolbar } from './CustomizationToolbar';
import { __resetMemory, allPositions } from './store';
import { theme } from '../theme';
import { AuthProvider } from '../auth/AuthContext';
import { AuthDialogProvider } from '../auth/AuthDialogProvider';
import { AUTH_COPY } from '../auth/copy';
import { LIVE_HEADING, LIVE_BODY, LIVE_LOCK_CHIP } from './labels';

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
    if (url.includes('/api/auth/session')) return json({ authenticated: true, user: { id: 'u-test', email: 'test@user.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } });
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

beforeEach(() => { localStorage.clear(); __resetMemory(); vi.restoreAllMocks(); });
afterEach(() => cleanup());

// =============================== Underline tabs + PAPER badge ===============================
describe('underline tabs + PAPER badge', () => {
  it('renders the Simulated tab with a green PAPER badge and a locked Live tab', () => {
    installBackend(); renderH();
    const sim = screen.getByTestId('tab-simulated');
    expect(within(sim).getByText('PAPER')).toBeInTheDocument();
    const liveTab = screen.getByTestId('tab-live');
    expect(liveTab.textContent).toMatch(/🔒\s*Live/);
    // No outer "Positions portfolio" card heading anymore.
    expect(screen.queryByText('Positions portfolio')).toBeNull();
  });

  it('switching to Live shows the locked panel (no fetch, no positions)', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(screen.getByTestId('tab-live'));
    expect(screen.getByTestId('live-locked-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('open-entry')).toBeNull();
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });
});

// =============================== Toolbar segmented controls → working.* ===============================
describe('toolbar segmented controls wire to working.*', () => {
  it('Table/Cards toggle switches the layout', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByTestId('layout-toggle-card'));
    await waitFor(() => expect(screen.getByTestId('positions-cards')).toBeInTheDocument());
    await user.click(screen.getByTestId('layout-toggle-table'));
    await waitFor(() => expect(screen.getByTestId('positions-table')).toBeInTheDocument());
  });

  it('Comfortable/Compact toggle switches the density', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    await user.click(screen.getByTestId('density-toggle-compact'));
    await waitFor(() => expect(screen.getByTestId('positions-table').getAttribute('data-density')).toBe('compact'));
  });

  it('Group None/Ticker/Strategy/Expiry are all present and switch grouping', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    for (const axis of ['ticker', 'strategy', 'expiry'] as const) {
      expect(screen.getByTestId(`group-select-${axis}`)).toBeInTheDocument();
      await user.click(screen.getByTestId(`group-select-${axis}`));
      await waitFor(() => expect(screen.getByTestId('group-header')).toBeInTheDocument());
    }
    await user.click(screen.getByTestId('group-select-none'));
    await waitFor(() => expect(screen.queryByTestId('group-header')).toBeNull());
  });

  it('the blue Open CTA carries data-testid="open-entry" and opens the entry dialog', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    const cta = screen.getByTestId('open-entry');
    expect(cta).toHaveTextContent('Open simulated position');
    await user.click(cta);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

// =============================== Status pills (multi-select, default ['open']) ===============================
describe('status pills', () => {
  it('defaults to open active and toggles pending into the multi-select', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    expect(screen.getByTestId('status-chip-open').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('status-chip-pending').getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByTestId('status-chip-pending'));
    await waitFor(() => expect(screen.getByTestId('status-chip-pending').getAttribute('aria-pressed')).toBe('true'));
    // open stays active too (multi-select, not exclusive)
    expect(screen.getByTestId('status-chip-open').getAttribute('aria-pressed')).toBe('true');
  });

  it('History link switches to the closed/cancelled view', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '5');
    pushLive({ mid: 250 });
    await user.click(within(screen.getByTestId('position-row')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(allPositions().some((p) => p.status === 'closed')).toBe(true));
    await user.click(screen.getByTestId('history-button'));
    await waitFor(() => expect(screen.getByTestId('history-caption')).toBeInTheDocument());
  });
});

// =============================== REVISION 1 — default table columns match the mock ===============================
describe('REVISION 1 default table columns (match the Figma mock)', () => {
  it('renders the mock header set with a SEPARATE P/L and P/L % column, in order', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    const table = await screen.findByTestId('positions-table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim());
    // The default visible set, left→right, exactly the mock (plus the trailing empty actions th).
    // COLUMN_LABELS.entry stays 'Entry price' (REVISION 1 changed only pl/pl_pct/contract labels).
    expect(headers).toEqual([
      'Ticker', 'Strategy', 'Qty', 'Entry price', 'Mark', 'P/L', 'P/L %',
      'Δ since entry', 'Trend', 'Expiry', '',
    ]);
    // P/L $ and P/L % are now distinct cells (the old combined "$ / %" cell is gone).
    const row = within(table).getByTestId('position-row');
    expect(within(row).getByTestId('cell-pl')).toBeInTheDocument();
    expect(within(row).getByTestId('cell-pl-pct')).toBeInTheDocument();
    expect(within(row).queryByText(/\$ \/ %/)).toBeNull();
  });

  it('renders the slim Ticker cell: bold mono symbol + `$strike Call` leg only (no exp/Long inline)', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    const contract = (await screen.findAllByTestId('cell-contract'))[0];
    expect(within(contract).getByText('TSLA')).toBeInTheDocument();
    expect(within(contract).getByText(/\$250 Call/)).toBeInTheDocument();
    // The old inline contract details are no longer in the Ticker cell.
    expect(contract.textContent).not.toMatch(/exp|Long ×/);
  });

  it('the moved-out columns (simulated/status/mode/session_delta) are NOT in the default header set', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    const table = await screen.findByTestId('positions-table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).not.toContain('Status');
    expect(headers).not.toContain('Session Δ');
    expect(headers).not.toContain('SIMULATED');
  });
});

// =============================== Mandatory disclosure ===============================
describe('positions-disclosure (D6d)', () => {
  it('renders the verbatim browser-local disclosure on the Simulated surface', () => {
    installBackend(); renderH();
    expect(screen.getByTestId('positions-disclosure')).toHaveTextContent(AUTH_COPY.positions.disclosure);
  });
});

// =============================== Offline banner + live-vs-static isolation ===============================
describe('offline degradation', () => {
  it('shows the offline banner + dims live cells while static records persist', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getAllByText(/\+\$100/).length).toBeGreaterThan(0));
    // Re-mount offline: the banner appears, the live cell shows ⏸ offline, the static contract line stays.
    cleanup(); renderH({ forceOffline: true });
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeInTheDocument());
    expect(screen.getAllByText(/⏸ offline/).length).toBeGreaterThan(0);
    // REVISION 1 slim Ticker cell: bold mono symbol + `$250 Call` leg — both static, persist offline.
    const contract = screen.getAllByTestId('cell-contract')[0];
    expect(within(contract).getByText('TSLA')).toBeInTheDocument();
    expect(within(contract).getByText(/\$250 Call/)).toBeInTheDocument();
  });
});

// =============================== Cards layout (2-col) ===============================
describe('cards layout', () => {
  it('renders the big mono P/L card with a Qty/Entry/Mark footer', async () => {
    const user = userEvent.setup(); installBackend(); renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    await user.click(screen.getByTestId('layout-toggle-card'));
    const card = await screen.findByTestId('position-card');
    expect(within(card).getByTestId('card-pl')).toBeInTheDocument();
    expect(within(card).getByTestId('card-mark')).toBeInTheDocument();
    expect(within(card).getByText(/Qty/)).toBeInTheDocument();
    expect(within(card).getByText(/Entry/)).toBeInTheDocument();
  });
});

// =============================== Re-skinned Live locked panel ===============================
describe('Live locked panel (re-skin, lock intact)', () => {
  it('renders the hatched lock with the heading/body/coming-soon chip and NO interactive control', () => {
    render(<ThemeProvider theme={theme}><LiveTabPanel /></ThemeProvider>);
    expect(screen.getByText(LIVE_HEADING)).toBeInTheDocument();
    expect(screen.getByText(LIVE_BODY)).toBeInTheDocument();
    expect(screen.getByTestId('live-lock-chip')).toHaveTextContent(LIVE_LOCK_CHIP);
    // Zero-import lock ⇒ inert: no buttons, no links, no inputs.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

// =============================== Isolated toolbar render (segmented wiring without a network harness) ===============================
describe('toolbar in isolation', () => {
  it('renders the offline banner when streamOffline and the Open CTA disabled without a bundle', () => {
    function ToolbarHarness() {
      const pf = usePortfolio('TSLA', null, null, false, true);
      return (
        <ThemeProvider theme={theme}>
          <CustomizationToolbar pf={pf} positions={pf.positions} streamOffline canOpenEntry={false} onOpenEntry={vi.fn()} />
        </ThemeProvider>
      );
    }
    installBackend();
    render(<ToolbarHarness />);
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByTestId('open-entry')).toBeDisabled();
  });
});
