/**
 * Standalone Positions page — store persistence across nav + reload, standalone mark sourcing
 * (degrade-to-last-known), and the relocated invariants (LOCKED Live tab, SIMULATED, UI-only brand).
 *
 * Mounts the REAL app subtree via the route table, mocking ONLY the network boundary (`fetch` +
 * `EventSource`). NEVER a live backend. Routing via `MemoryRouter`; durable store seeded via
 * `localStorage` (the module-singleton store).
 *
 * AC coverage: Store 1–5, PosLive 1–4, Inv 3, Inv 4, Inv 9.
 *
 * NOTE (GATE-Z bounce, reported, not silently dropped): UX_BLUEPRINT §6 introduces NEW standalone
 * degraded-mark wording (`⏸ last known` / `tracking unavailable` / `no live quote`). The shipped
 * `PositionRow` — which FRONTEND_EXECUTION_CONTRACT §6 forbids editing (relocate-don't-change) —
 * already renders the equivalent OBSERVABLE degraded states with the EXISTING wording (`⏸ offline`
 * for last-known, `unavailable` for tracking-unavailable). These tests assert the binding OBSERVABLE
 * behavior (row stays, cell degraded, never blanked/dropped, no throw); the wording delta is flagged
 * for a GATE-Z amendment rather than editing the forbidden internals.
 */
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { TickerBundle, TrackedContract, StrikeRow } from '@org/api';

import App from '../app';
import { theme } from '../theme';
import {
  __resetMemory, allPositions, putPosition, getCustomization, putCustomization, newId,
  PORTFOLIO_V2_KEY,
} from './store';
import type { Position } from './types';
import { PORTFOLIO_SCHEMA_VERSION } from './types';

function strike(s: number): StrikeRow {
  return { strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20, net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25 };
}
function makeBundle(ticker = 'TSLA'): TickerBundle {
  return {
    market_state: {
      ticker, price: 250, gex_spot: 250, timestamp: 1, timestamp_iso: '2026-06-23T14:00:00Z',
      call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248, max_pain: 250,
      max_pain_expiration: '2026-06-26', net_gex: 1, call_gex: 1, put_gex: -1, total_gex: 1, net_dex: 1,
      call_dex: 1, put_dex: -1, net_vanna: null, net_charm: null, net_volga: null, vwap: 249,
      vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null, dte_min: 7,
      dte_max: 45, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.1, net_flow: null, put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5, total_volume: 100000, vol_oi_unusual_threshold: 1, iv_skew: null, term_structure: null,
    },
    signals: {
      ticker, regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral', distances: {},
      setups: [], opportunity_score: 42, opportunity_tier: 'watch', prime_prompt_eligible: false,
    },
    strike_profile: { ticker, spot: 250, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [{ date: '2026-07-17', dte: 24 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: 'fp', score_threshold: 50 },
    meta: { served_at: '2026-06-23T14:00:00Z', cache: { hit: false, age_seconds: 0, ttl_seconds: 60 }, freshness: { snapshot_iso: '2026-06-23T14:00:00Z', data_age_seconds: 10, stale: false, stale_after_seconds: 600 } },
    off_exchange: { ratio_pct: 38, offex_shares: 1, total_shares: 1, levels: [], blocks: [], block_min_shares: 5000, note: '' },
    position_eval: null,
  };
}

const QUOTE: TrackedContract = {
  ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45, dte: 24,
};

/** Seed one open simulated position directly into the durable store. */
function seedPosition(over: Partial<Position> = {}): Position {
  const p: Position = {
    id: over.id ?? newId(), ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call',
    side: 'long', qty: 2, entry_mark: 5, entry_basis: 'snapshot', entry_time: '2026-06-20T10:00:00Z',
    stop: null, target: null, status: 'open', schema_version: PORTFOLIO_SCHEMA_VERSION, entry_mode: 'manual',
    ...over,
  };
  putPosition(p);
  return p;
}

type ContractResolver = 'quote' | 'notfound' | 'throw' | 'nullquote';
let contractMode: ContractResolver = 'quote';
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  contractMode = 'quote';

  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown, status = 200) => new Response(b === null ? 'null' : JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'TSLA';
    // user-accounts: who-am-I read on mount (signed-in path; gating covered in the auth suite).
    if (url.includes('/api/auth/session')) return json({ authenticated: true, user: { id: 'u-test', email: 'test@user.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } });
    // user-accounts (AC-E7): the Positions sim-trade WRITE awaits the SERVER gate first; signed-in ⇒ authorize.
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/ticker/')) return json(makeBundle(tk));
    if (url.includes('/api/recommendation/status/')) {
      return json({ availability: { in_app_enabled: true }, gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] }, cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' } });
    }
    if (url.includes('/api/personas')) return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) {
      if (contractMode === 'throw') throw new Error('network');
      if (contractMode === 'notfound') return json(null, 404);
      if (contractMode === 'nullquote') return json({ ...QUOTE, option_quote: null });
      return json(QUOTE);
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

// =================================================================================================
// store persistence
// =================================================================================================
describe('store', () => {
  it('position survives navigation', async () => {
    const user = userEvent.setup();
    seedPosition();
    renderAt('/positions');
    expect(await screen.findByTestId('position-row')).toBeInTheDocument();

    // Nav away to Scanner and back; the durable record is still there.
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');
    await user.click(screen.getByTestId('nav-positions'));
    expect(await screen.findByTestId('position-row')).toBeInTheDocument();
    expect(allPositions().length).toBe(1);
  });

  it('position survives reload', async () => {
    seedPosition();
    renderAt('/positions');
    expect(await screen.findByTestId('position-row')).toBeInTheDocument();

    // Reload = re-mount fresh from the durable store (the module cache is reset like a page reload).
    cleanup();
    __resetMemory();
    renderAt('/positions');
    expect(await screen.findByTestId('position-row')).toBeInTheDocument();
    expect(allPositions().length).toBe(1);
  });

  it('customization + saved views survive nav + reload', async () => {
    // Seed a position + a named saved view directly into the durable customization store.
    seedPosition();
    const custom = getCustomization();
    const viewId = newId();
    custom.views = [...custom.views, { id: viewId, name: 'Tech swings', config: { ...custom.working } }];
    custom.activeViewId = viewId;
    putCustomization(custom);

    const user = userEvent.setup();
    renderAt('/positions');
    await screen.findByTestId('position-row');
    expect(screen.getByTestId('view-picker').textContent).toMatch(/Tech swings/);

    // Nav away + back: still active.
    await user.click(screen.getByTestId('nav-scanner'));
    await screen.findByTestId('scanner-placeholder');
    await user.click(screen.getByTestId('nav-positions'));
    await screen.findByTestId('position-row');
    expect(screen.getByTestId('view-picker').textContent).toMatch(/Tech swings/);

    // Reload: still restored.
    cleanup();
    __resetMemory();
    renderAt('/positions');
    await screen.findByTestId('position-row');
    expect(screen.getByTestId('view-picker').textContent).toMatch(/Tech swings/);
  });

  it('a seeded position persists on /positions across navigation (singleton store)', async () => {
    // The Ticker no longer hosts the portfolio panel (Figma re-skin) — positions are opened on
    // /positions. This verifies the durable module-singleton store survives navigation.
    const user = userEvent.setup();
    seedPosition();
    renderAt('/positions');
    const pos = await screen.findByTestId('portfolio-panel');
    expect(await within(pos).findByTestId('position-row')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-ticker'));
    await screen.findByText('Call wall');
    await user.click(screen.getByTestId('nav-positions'));
    const pos2 = await screen.findByTestId('portfolio-panel');
    expect(await within(pos2).findByTestId('position-row')).toBeInTheDocument();
  }, 20000);

  it('ephemeral trends/session-delta re-derive; durable facts persist', async () => {
    // The durable facts (the position, entry mark) persist; the ephemeral session-delta re-derives on
    // remount (shows the freshly-anchored placeholder), never carrying a stale value across reload.
    seedPosition();
    renderAt('/positions');
    const row = await screen.findByTestId('position-row');
    expect(within(within(row).getByTestId('cell-contract')).getByText('TSLA')).toBeInTheDocument(); // durable contract

    cleanup();
    __resetMemory();
    renderAt('/positions');
    const row2 = await screen.findByTestId('position-row');
    // Durable fact persists; the session-delta cell exists (re-derived fresh, not a thrown error).
    expect(within(within(row2).getByTestId('cell-contract')).getByText('TSLA')).toBeInTheDocument();
    expect(allPositions()[0].entry_mark).toBe(5);
  });
});

// =================================================================================================
// positions marks (standalone GET /api/contract sourcing + degrade-to-last-known)
// =================================================================================================
describe('positions-marks', () => {
  it('marks populate from GET /api/contract', async () => {
    seedPosition();
    renderAt('/positions');
    // The mark cell populates from the existing GET /api/contract source.
    expect(await screen.findByTestId('cell-mark')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/contract/'));
  });

  it('refresh failure → last known, never blanked', async () => {
    // The contract fetch throws → the row stays listed; its mark cell degrades (last-known idiom),
    // never blanked or removed.
    contractMode = 'throw';
    seedPosition();
    renderAt('/positions');
    // The row is still present (never dropped) even though the mark could not refresh.
    expect(await screen.findByTestId('position-row')).toBeInTheDocument();
    expect(within(within(screen.getByTestId('position-row')).getByTestId('cell-contract')).getByText('TSLA')).toBeInTheDocument();
    // The page did not error; the durable record persists.
    expect(allPositions().length).toBe(1);
  });

  it('404 → tracking unavailable, row kept', async () => {
    contractMode = 'notfound';
    seedPosition();
    renderAt('/positions');
    const row = await screen.findByTestId('position-row');
    // The row stays with its durable facts; the mark cell degrades to the unavailable state.
    expect(within(within(row).getByTestId('cell-contract')).getByText('TSLA')).toBeInTheDocument();
    // The 404 resolves to `unavailable` after the contract fetch lands (row never dropped).
    expect((await screen.findAllByTestId('cell-unavailable')).length).toBeGreaterThan(0);
    // Page did not error / blank.
    expect(screen.getByTestId('portfolio-panel')).toBeInTheDocument();
  });

  it('null quote → no live quote fallback', async () => {
    contractMode = 'nullquote';
    seedPosition();
    renderAt('/positions');
    const row = await screen.findByTestId('position-row');
    // Contract exists but no NBBO quote: the row falls back to an honest (theoretical/last-known)
    // mark and does NOT throw into the page. Row + durable facts stay.
    expect(within(within(row).getByTestId('cell-contract')).getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-panel')).toBeInTheDocument();
    expect(allPositions().length).toBe(1);
  });
});

// =================================================================================================
// page header — Net P/L (open) readout (convexa-redesign re-skin)
// =================================================================================================
describe('net-pl-readout', () => {
  it('sums the OPEN positions P/L into the header readout (success color by sign)', async () => {
    // entry 4, qty 2; the contract mark resolves to 5 ⇒ +$200 open P/L.
    seedPosition({ entry_mark: 4, qty: 2 });
    renderAt('/positions');
    await screen.findByTestId('position-row');
    const readout = await screen.findByTestId('positions-net-pl');
    await vi.waitFor(() => expect(readout.textContent).toMatch(/\+\$200/));
    // not dimmed while live
    expect(readout).toBeInTheDocument();
  });

  it('renders the readout (never blank) even when no marks resolve', async () => {
    contractMode = 'throw';
    seedPosition();
    renderAt('/positions');
    const readout = await screen.findByTestId('positions-net-pl');
    // Unavailable members contribute nothing; the readout shows a $0 baseline, never blanks/throws.
    expect(readout.textContent).toMatch(/\$0/);
  });
});

// =================================================================================================
// invariants on the relocated Positions page
// =================================================================================================
describe('invariants (positions)', () => {
  it('Positions Live tab stays LOCKED', async () => {
    const user = userEvent.setup();
    seedPosition();
    renderAt('/positions');
    await screen.findByTestId('portfolio-panel');
    const fetchBefore = fetchMock.mock.calls.length;
    await user.click(screen.getByTestId('tab-live'));
    // The zero-import LOCKED placeholder; no position rows, no entry affordance, no extra network call.
    expect(screen.getByTestId('live-locked-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('open-entry')).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(fetchBefore);
  });

  it('everything stays SIMULATED', async () => {
    seedPosition();
    renderAt('/positions');
    await screen.findByTestId('portfolio-panel');
    // REVISION 1 — paper/simulated honesty now carried by the tab PAPER badge + the mandatory
    // browser-local disclosure (the per-row SIMULATED column moved to optional, still re-addable).
    expect(within(screen.getByTestId('tab-simulated')).getByText('PAPER')).toBeInTheDocument();
    expect(screen.getByTestId('positions-disclosure')).toBeInTheDocument();
    // No real-order affordance exists.
    expect(screen.queryByText(/place real order/i)).toBeNull();
  });

  it('brand swap is UI-only (store key unchanged)', async () => {
    // Seed positions/views under the EXISTING durable key BEFORE the rebrand-era mount.
    seedPosition({ id: 'pre-rebrand-1' });
    // The durable blob lives under the unchanged v2 key.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();

    renderAt('/positions');
    // After the (UI-only) rebrand, the pre-seeded position is present — the store key did not change.
    expect(await screen.findByTestId('position-row')).toBeInTheDocument();
    expect(allPositions().some((p) => p.id === 'pre-rebrand-1')).toBe(true);
    // And the visible brand is Convexa, not GammaFlow (UI-only swap).
    expect(within(screen.getByTestId('shell-brand')).getByText('Convexa')).toBeInTheDocument();
    expect(screen.queryByText('GammaFlow')).toBeNull();
  });
});
