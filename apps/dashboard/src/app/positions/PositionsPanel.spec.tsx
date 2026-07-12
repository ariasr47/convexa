/**
 * Component/flow — PositionsPanel (convexa-redesign · Positions, Figma `113:838`). The reusable composite
 * = Toolbar + Filters + body. Asserts the contract's required cases ("PositionsPanel: renders toolbar +
 * filters + body; Table↔Cards toggle switches the body; filter chips") + the disclosure + the offline
 * banner + the entry-dialog wiring. Mocks ONLY the network boundary (`fetch` + SSE `EventSource`); never
 * a live backend.
 */
import { ThemeProvider } from '@mui/material/styles';
import type { LiveUpdate, StrikeRow, TickerBundle, TrackedContract } from '@org/api';
import { streamTicker } from '@org/api';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_COPY } from '../auth/copy';
import { theme } from '../theme';
import { PositionsPanel } from './PositionsPanel';
import { __resetMemory } from './store';
import { OpenPositionInput, usePortfolio } from './usePortfolio';

// ---- INTERFACE-shaped factories --------------------------------------------------------------
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
      timestamp_iso: '2026-06-23T14:00:00Z',
      call_wall: 260,
      put_wall: 240,
      peak_gex_strike: 255,
      gamma_flip: 248,
      max_pain: 250,
      max_pain_expiration: '2026-06-26',
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
      { date: '2026-07-17', dte: 24 },
      { date: '2026-08-21', dte: 59 },
    ],
    ai_eval: {
      ready: true,
      reasons: [],
      changed: true,
      state_fingerprint: 'fp-A',
      score_threshold: 50,
    },
    meta: {
      served_at: '2026-06-23T14:00:00Z',
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: '2026-06-23T14:00:00Z',
        data_age_seconds: 10,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    position_eval: null,
  };
}
const QUOTE: TrackedContract = {
  ticker: 'TSLA',
  expiration: '2026-07-17',
  strike: 250,
  right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
  greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45,
  dte: 24,
};

const esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];
function installBackend() {
  esInstances.length = 0;
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      esInstances.push(this);
    }
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/contract/')) {
        const u = new URL(url, 'http://x');
        const s = Number(u.searchParams.get('strike'));
        const r = u.searchParams.get('right') ?? 'call';
        return json({ ...QUOTE, strike: s, right: r });
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
}
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
    last_trade: 250,
    ...over,
  };
  act(() => {
    esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(u) } as MessageEvent));
  });
}

// A bare gate (no auth providers needed): this panel only renders the in-context prompt + forwards
// the open/confirm handlers. The confirm path here runs the local sim write directly (the server-gate
// enforcement is exercised by the PortfolioPanel/flow specs).
function Harness({ forceOffline = false }: { forceOffline?: boolean }) {
  const [data] = useState<TickerBundle | null>(makeBundle());
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  useEffect(() => streamTicker('TSLA', {}, (u) => setLive(u)), []);
  const isLive = (live?.live ?? false) && !forceOffline;
  const pf = usePortfolio('TSLA', data, live, isLive, forceOffline);
  const onConfirm = (input: OpenPositionInput) => {
    pf.openPosition(input);
    setEntryOpen(false);
  };
  return (
    <ThemeProvider theme={theme}>
      <PositionsPanel
        pf={pf}
        data={data}
        streamOffline={forceOffline}
        ticker="TSLA"
        gate={{ promptText: null, signIn: vi.fn() }}
        onRequestOpenEntry={() => setEntryOpen(true)}
        guardSaveView={(run) => run()}
        onConfirm={onConfirm}
        entryOpen={entryOpen}
        onEntryOpen={setEntryOpen}
      />
    </ThemeProvider>
  );
}
const renderH = (p: Parameters<typeof Harness>[0] = {}) => render(<Harness {...p} />);

async function openManual(user: ReturnType<typeof userEvent.setup>, price: string) {
  await user.click(screen.getByTestId('open-entry'));
  const dlg = await screen.findByRole('dialog');
  await user.type(within(dlg).getByLabelText('Manual price'), price);
  await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe('PositionsPanel — composite structure', () => {
  it('renders the toolbar + filter chips + disclosure + body', () => {
    installBackend();
    renderH();
    expect(screen.getByTestId('simulated-surface')).toBeInTheDocument();
    expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('status-chips')).toBeInTheDocument();
    expect(screen.getByTestId('positions-disclosure')).toHaveTextContent(
      AUTH_COPY.positions.disclosure,
    );
    // Empty body (no positions yet) renders the no-positions empty state, never a blank/error.
    expect(screen.getByTestId('empty-no-positions')).toBeInTheDocument();
  });
});

describe('PositionsPanel — Table↔Cards toggle switches the body', () => {
  it('renders the table by default and switches to the cards grid on the toggle, and back', async () => {
    const user = userEvent.setup();
    installBackend();
    renderH();
    await openManual(user, '5');
    pushLive({ mid: 250 });
    expect(screen.getByTestId('positions-table')).toBeInTheDocument();
    await user.click(screen.getByTestId('layout-toggle-card'));
    await waitFor(() => expect(screen.getByTestId('positions-cards')).toBeInTheDocument());
    expect(screen.getByTestId('position-card')).toBeInTheDocument();
    expect(screen.queryByTestId('positions-table')).toBeNull();
    await user.click(screen.getByTestId('layout-toggle-table'));
    await waitFor(() => expect(screen.getByTestId('positions-table')).toBeInTheDocument());
  });
});

describe('PositionsPanel — filter chips', () => {
  it('defaults to open and toggles pending into the multi-select', async () => {
    const user = userEvent.setup();
    installBackend();
    renderH();
    expect(screen.getByTestId('status-chip-open').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('status-chip-pending').getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByTestId('status-chip-pending'));
    await waitFor(() =>
      expect(screen.getByTestId('status-chip-pending').getAttribute('aria-pressed')).toBe('true'),
    );
    expect(screen.getByTestId('status-chip-open').getAttribute('aria-pressed')).toBe('true');
  });

  it('History switches the body to the closed/cancelled view', async () => {
    const user = userEvent.setup();
    installBackend();
    renderH();
    await openManual(user, '5');
    pushLive({ mid: 250 });
    await user.click(
      within(screen.getByTestId('position-row')).getByRole('button', { name: 'Close' }),
    );
    await user.click(screen.getByTestId('history-button'));
    await waitFor(() => expect(screen.getByTestId('history-caption')).toBeInTheDocument());
  });
});

describe('PositionsPanel — offline banner + live-vs-static isolation', () => {
  it('renders the offline banner + dims live cells while static records keep rendering', async () => {
    const user = userEvent.setup();
    installBackend();
    renderH();
    await openManual(user, '4');
    pushLive({ mid: 250 });
    await waitFor(() => expect(screen.getAllByText(/\+\$100/).length).toBeGreaterThan(0));
    cleanup();
    renderH({ forceOffline: true });
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeInTheDocument());
    expect(screen.getAllByText(/⏸ offline/).length).toBeGreaterThan(0);
    const contract = screen.getAllByTestId('cell-contract')[0];
    expect(within(contract).getByText('TSLA')).toBeInTheDocument();
  });
});

describe('PositionsPanel — entry dialog wiring', () => {
  it('opens the entry dialog from the toolbar CTA', async () => {
    const user = userEvent.setup();
    installBackend();
    renderH();
    await user.click(screen.getByTestId('open-entry'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
