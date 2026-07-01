/**
 * AI-recommendations flow-integration suite — the centerpiece. Drives the REAL user flow end-to-end
 * through <App/>, mocking ONLY the network boundary (`fetch` + `EventSource`) so the real @org/api
 * client + the real hook/panel/dialog code run; never a live backend. The fetch router below IS the
 * controllable mock backend (it emits exactly the INTERFACE_CONTRACT §1 shapes).
 *
 * Traceability: every row of the FRONTEND_EXECUTION_CONTRACT "Tests to write" matrix (T1–T18 + the
 * promoted-invariant edges E1–E7) is a named test here. QA traces each AC → ≥1 passing test at GATE Q.
 */
import { render, screen, within, act, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  TickerBundle, RecResponse, RecStatus, RecExport, StrikeRow, TrackedContract,
} from '@org/api';
import { PRESETS } from '../personas/presets';
import { getTrade, clearTrade } from '../ghost-trade/store';
import App from '../app';

// ---- INTERFACE-shaped factories --------------------------------------------------------------
const FP_A = 'fp-A';
const SNAP_A = '2026-06-23T14:03:11Z';

function strike(s: number): StrikeRow {
  return {
    strike: s, net_gex: 0, call_gex: 0, put_gex: 0, call_oi: 10, put_oi: 10, total_oi: 20,
    net_dex: 0, call_dex: 0, put_dex: 0, volume: 5, vol_oi_ratio: 0.25,
  };
}

function makeBundle(over: Partial<{ fingerprint: string; snapshot: string }> = {}): TickerBundle {
  const fingerprint = over.fingerprint ?? FP_A;
  const snapshot = over.snapshot ?? SNAP_A;
  return {
    market_state: {
      ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1_700_000_000,
      timestamp_iso: snapshot, call_wall: 260, put_wall: 240, peak_gex_strike: 255, gamma_flip: 248,
      max_pain: 250, max_pain_expiration: '2026-06-26', net_gex: 1.2e9, call_gex: 2e9, put_gex: -0.8e9,
      total_gex: 1.2e9, net_dex: 5e8, call_dex: 6e8, put_dex: -1e8, net_vanna: null, net_charm: null,
      net_volga: null, vwap: 249, vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null,
      vwap_lower_3: null, dte_min: 7, dte_max: 45, atm_iv: 45, hv_30d: 40, iv_hv_ratio: 1.12,
      net_flow: null, put_call_ratio: 0.8, chain_vol_oi_ratio: 0.5, total_volume: 100_000,
      vol_oi_unusual_threshold: 1, iv_skew: null, term_structure: null,
    },
    signals: {
      ticker: 'TSLA', regime: 'positive_gamma', regime_note: null, vol_regime: 'neutral',
      distances: {}, setups: [], opportunity_score: 42, opportunity_tier: 'watch',
      prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [strike(255), strike(260), strike(265)] },
    expirations: [{ date: '2026-06-26', dte: 3 }, { date: '2026-07-18', dte: 25 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: fingerprint, score_threshold: 50 },
    meta: {
      served_at: snapshot,
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: snapshot, data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: {
      ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [],
      block_min_shares: 5000, note: '',
    },
    position_eval: null,
  };
}

const PERSONA_NAMES: Record<string, string> = {
  default: 'Default (no persona)', income_keeper: 'Income Keeper', steady_swinger: 'Steady Swinger',
};

function producedRec(over: Partial<RecResponse> = {}, body?: { persona_id?: string | null }): RecResponse {
  const pid = body?.persona_id ?? null;
  return {
    status: 'produced',
    persona: { id: pid, name: PERSONA_NAMES[pid ?? 'default'] ?? 'Default (no persona)' },
    as_of: SNAP_A, pinned_fingerprint: FP_A, stale_born: false,
    strategy: {
      decision: 'trade', bias: 'long', structure: 'call debit spread', strikes: [260],
      expiration: '2026-07-18', entry_trigger: 'break and hold above the 260 call wall',
      invalidation_level: 242, max_risk: '1.5% of account ($300)', position_size: '2 contracts',
      exit_plan: { target: 12.5, stop: 6 }, time_horizon: '5–10 trading days', confidence: 'medium',
      rationale: 'magnet at 255, flip at 248; IV/HV cheap.',
    },
    unavailable_reason: null,
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-24T04:00:00Z' },
    ...over,
  };
}

function noTradeRec(): RecResponse {
  const r = producedRec();
  return {
    ...r,
    strategy: {
      decision: 'no_trade', bias: 'neutral', structure: null, strikes: [], expiration: null,
      entry_trigger: null, invalidation_level: null, max_risk: null, position_size: null,
      exit_plan: { target: null, stop: null }, time_horizon: null, confidence: null,
      rationale: 'No clean edge — price is mid-range between the walls.',
    },
  };
}

function makeStatus(over: Partial<RecStatus> = {}): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
    ...over,
  };
}

function makeExport(): RecExport {
  return {
    ticker: 'TSLA', as_of: SNAP_A,
    context: { gamma_flip: 248, call_wall: 260, opportunity_score: 42 },
    persona_prompt: 'You are a disciplined options strategist…',
    glossary: 'market_state_glossary…',
    egress_note: 'Complete list of what leaves the machine for TSLA: context + persona prompt + glossary. No key, no other ticker, no identity, no order data.',
  };
}

const contract: TrackedContract = {
  ticker: 'TSLA', expiration: '2026-07-18', strike: 260, right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 }, greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45, dte: 25,
};

// ---- Controllable mock backend (the network boundary) ----------------------------------------
interface BackendCfg {
  bundle?: TickerBundle | (() => TickerBundle);
  status?: RecStatus;
  rec?: RecResponse | ((body: { persona_id?: string | null; override?: boolean }) => RecResponse) | 'throw';
  export?: RecExport | 'notfound';
  personas?: unknown | 'throw';
  contract?: TrackedContract | null;
  deferRec?: boolean;
}

function installBackend(cfg: BackendCfg) {
  const calls = { ticker: 0, status: 0, rec: 0, export: 0, personas: 0, contract: 0 };
  const esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];
  let pendingRec: (() => void) | null = null;
  const state: Required<BackendCfg> = {
    bundle: cfg.bundle ?? makeBundle(),
    status: cfg.status ?? makeStatus(),
    rec: cfg.rec ?? producedRec(),
    export: cfg.export ?? makeExport(),
    personas: cfg.personas ?? PRESETS,
    contract: cfg.contract ?? contract,
    deferRec: cfg.deferRec ?? false,
  };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() { esInstances.push(this); }
    close() { /* no-op */ }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // user-accounts: the app now reads who-am-I on mount. These ai-rec tests exercise the SIGNED-IN
    // path (the auth gate is OUTERMOST over ai-rec; it is covered separately in the auth suite), so a
    // stable signed-in session lets the existing ai-rec behaviors run unchanged.
    if (url.includes('/api/auth/session')) {
      return json({
        authenticated: true,
        user: { id: 'u-test', email: 'test@user.com', display_name: null, auth_methods: ['password'] },
        google_available: false,
        settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
      });
    }
    if (url.includes('/api/ticker/')) {
      calls.ticker++;
      return json(typeof state.bundle === 'function' ? state.bundle() : state.bundle);
    }
    if (url.includes('/api/recommendation/status/')) { calls.status++; return json(state.status); }
    if (url.includes('/api/recommendation/export/')) {
      calls.export++;
      return state.export === 'notfound' ? json({ detail: 'no bundle' }, 404) : json(state.export);
    }
    if (url.includes('/api/recommendation/') && init?.method === 'POST') {
      calls.rec++;
      const body = init.body ? JSON.parse(String(init.body)) : {};
      if (state.rec === 'throw') throw new Error('network down');
      const make = () => (typeof state.rec === 'function' ? state.rec(body) : state.rec) as RecResponse;
      if (state.deferRec) return new Promise<Response>((res) => { pendingRec = () => res(json(make())); });
      return json(make());
    }
    if (url.includes('/api/personas')) {
      calls.personas++;
      return state.personas === 'throw' ? json({ detail: 'down' }, 500) : json(state.personas);
    }
    if (url.includes('/api/contract/')) { calls.contract++; return json(state.contract); }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }));

  return {
    calls,
    esCount: () => esInstances.length,
    setState: (patch: Partial<BackendCfg>) => Object.assign(state, patch),
    emit: (payload: unknown) => esInstances.forEach((es) => es.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)),
    resolveRec: () => { pendingRec?.(); pendingRec = null; },
  };
}

const liveUpdate = (over: Record<string, unknown> = {}) => ({
  ticker: 'TSLA', mid: 250.5, bid: 250.4, ask: 250.6, spread: 0.2, net_flow: 100, buy_vol: 10,
  sell_vol: 5, flow_window_s: 300, spot_ts: 1, live: true, tick_age_s: 1, market_session: 'regular',
  feed: 'realtime', ts: 1, gamma_flip: 248, last_trade: 250.5, ...over,
});

async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

function renderApp() {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/ticker/TSLA']}><App /></MemoryRouter>);
  return user;
}

const panel = () => screen.getByTestId('ai-rec-panel');
/** Wait for the dashboard bundle + the rec panel to mount (the panel's gated action then resolves
 *  from `fetchRecStatus`; each test waits for its own state). */
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}
/** Open the read-persona MUI Select (version-agnostic: click its `.MuiSelect-select` trigger). */
function openReadPersona() {
  return panel().querySelector('.MuiSelect-select') as HTMLElement;
}
// The ghost-trade store keeps a module-level memory cache on top of a single localStorage key, so
// reset BOTH between tests (clearTrade rewrites the cache empty for the ticker we exercise).
beforeEach(() => { localStorage.clear(); clearTrade('TSLA'); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); cleanup(); });

// =============================================================================================
describe('AI recommendations — required matrix (T1–T18)', () => {
  it('T1 produces a risk-first rec after a thinking state', async () => {
    const be = installBackend({ deferRec: true });
    const user = renderApp();
    await settle();

    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    // loading → "Thinking…" while the query is in flight.
    expect(await within(panel()).findByText('Thinking…')).toBeInTheDocument();

    be.resolveRec();
    // produced: full field set renders, with max-risk + invalidation FIRST.
    await within(panel()).findByText('1.5% of account ($300)');
    const p = panel();
    expect(within(p).getByText('Max risk')).toBeInTheDocument();
    expect(within(p).getByText('Invalidation')).toBeInTheDocument();
    expect(within(p).getByText('call debit spread')).toBeInTheDocument();
    expect(within(p).getByText('break and hold above the 260 call wall')).toBeInTheDocument();
    expect(within(p).getByText('2 contracts')).toBeInTheDocument();
    expect(within(p).getByText('5–10 trading days')).toBeInTheDocument();
    expect(within(p).getByText('medium')).toBeInTheDocument();
    expect(within(p).getByText(/magnet at 255/)).toBeInTheDocument();

    // Risk-first ordering: Max risk renders before Structure in the DOM.
    const maxRisk = within(p).getByText('Max risk');
    const structure = within(p).getByText('Structure');
    expect(maxRisk.compareDocumentPosition(structure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('T2 renders the rec whole, never partially streamed', async () => {
    const be = installBackend({ deferRec: true });
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('Thinking…');
    // No rec field is in the DOM during loading.
    expect(within(panel()).queryByText('1.5% of account ($300)')).toBeNull();
    expect(within(panel()).queryByText('call debit spread')).toBeNull();
    be.resolveRec();
    // The full rec appears atomically, replacing "Thinking…".
    await within(panel()).findByText('1.5% of account ($300)');
    expect(within(panel()).queryByText('Thinking…')).toBeNull();
  });

  it('T3 shows persona attribution on the rec', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    expect(await within(panel()).findByText('Persona · Default (no persona)')).toBeInTheDocument();
  });

  it('T4 shows the pinned snapshot as-of on the rec', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    expect(await within(panel()).findByText(`As of ${SNAP_A}`)).toBeInTheDocument();
  });

  it('T5 renders no_trade as a legitimate outcome with no Accept', async () => {
    installBackend({ rec: noTradeRec() });
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('No trade — sit this one out');
    const p = panel();
    // Info, not error: the no-trade caption + rationale show; provenance chips still present.
    expect(within(p).getByText(/a 'no trade' read is a complete, correct answer/)).toBeInTheDocument();
    expect(within(p).getByText(/No clean edge/)).toBeInTheDocument();
    expect(within(p).getByText('Persona · Default (no persona)')).toBeInTheDocument();
    expect(within(p).getByText(`As of ${SNAP_A}`)).toBeInTheDocument();
    // No Accept control anywhere on a no_trade rec.
    expect(within(p).queryByRole('button', { name: 'Accept into ghost trade' })).toBeNull();
  });

  it('T8 de-emphasizes on no-fresh-edge but allows an explicit override query', async () => {
    const be = installBackend({
      status: makeStatus({ gate: { state: 'no_fresh_edge', cooldown_remaining_seconds: 0, reasons: ['score below the actionable threshold'] } }),
      deferRec: true,
    });
    const user = renderApp();
    await settle();
    const p = panel();
    await within(p).findByText('No fresh edge right now — score below the actionable threshold');
    // The override is one tap.
    await user.click(within(p).getByRole('button', { name: 'Ask anyway' }));
    expect(await within(p).findByText('Thinking…')).toBeInTheDocument();
    expect(be.calls.rec).toBe(1);
  });

  it('T10 shows a calm daily-cap state with resets-when and keeps the export available', async () => {
    const be = installBackend({
      status: makeStatus({ cap: { over_limit: true, remaining_today: 0, resets_at: '2026-06-24T04:00:00Z' } }),
    });
    const user = renderApp();
    await settle();
    const p = panel();
    const capBtn = await within(p).findByRole('button', { name: /Daily AI limit reached — resets/ });
    expect(capBtn).toBeDisabled();
    // Not error styling: no alert role around the cap message.
    expect(within(p).getByText(/The manual export below still works/)).toBeInTheDocument();
    // The export floor still works (no in-app call).
    await user.click(within(p).getAllByRole('button', { name: "View what's sent" })[0]);
    expect(await screen.findByText("What's sent to the AI · TSLA")).toBeInTheDocument();
    expect(be.calls.export).toBe(1);
    expect(be.calls.rec).toBe(0);
  });

  it('T12 cleanly disables in-app when no key is configured but keeps the manual floor', async () => {
    const be = installBackend({ status: makeStatus({ availability: { in_app_enabled: false } }) });
    const user = renderApp();
    await settle();
    const p = panel();
    await within(p).findByText('In-app AI not configured');
    expect(within(p).getByRole('button', { name: 'Get AI recommendation' })).toBeDisabled();
    // Manual floor: the export drawer still works; the rest of the dashboard is untouched.
    await user.click(within(p).getAllByRole('button', { name: "View what's sent" })[0]);
    expect(await screen.findByText("What's sent to the AI · TSLA")).toBeInTheDocument();
    expect(be.calls.rec).toBe(0);
    expect(screen.getByText('Call wall')).toBeInTheDocument();
  });

  it('T11 shows AI-unavailable with retry and degrades the rec surface alone', async () => {
    installBackend({ rec: 'throw' });
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('AI unavailable — try again');
    const p = panel();
    expect(within(p).getByRole('button', { name: 'Retry' })).toBeEnabled();
    // Isolation: the rest of the dashboard keeps rendering — no dashboard-wide error banner.
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText('Put wall')).toBeInTheDocument();
    expect(screen.getByText('Net GEX')).toBeInTheDocument();
    expect(screen.getByTestId('open-sim-trade')).toBeInTheDocument();
    expect(screen.queryByText(/No option-chain data/)).toBeNull();
  });

  it('T13 pre-fills the editable ghost-trade entry dialog from a trade rec', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    await user.click(within(panel()).getByRole('button', { name: 'Accept into ghost trade' }));

    const dialog = await screen.findByRole('dialog');
    const d = within(dialog);
    // Provenance + sizing copy present; fields seeded + editable.
    expect(d.getByText('Pre-filled from AI read · Default (no persona)')).toBeInTheDocument();
    expect(d.getByText(/Suggested size from the AI read/)).toBeInTheDocument();
    expect((d.getByLabelText('Quantity') as HTMLInputElement).value).toBe('2');
    expect((d.getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('6');
    expect((d.getByLabelText('Target (optional)') as HTMLInputElement).value).toBe('12.5');
    expect(d.getByText('$260')).toBeInTheDocument(); // strike select shows the seeded strike
    // Editability: the user can change the suggested size (overwrite the seeded value).
    const qty = d.getByLabelText('Quantity') as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '5' } });
    expect(qty.value).toBe('5');
  });

  it('T14 creates no trade until confirm and none on cancel', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    await user.click(within(panel()).getByRole('button', { name: 'Accept into ghost trade' }));
    await screen.findByRole('dialog');
    // Nothing tracked on open.
    expect(getTrade('TSLA')).toBeNull();
    // Cancel → still nothing.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(getTrade('TSLA')).toBeNull();

    // Re-open and confirm → exactly one trade is created. Use Market mode to fill at the auto-resolved
    // snapshot mid (the reskin defaults to Manual price, which needs a typed price).
    await user.click(await within(panel()).findByRole('button', { name: 'Accept into ghost trade' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Market' }));
    await within(dialog).findByText(/Fill: mid/);
    await user.click(within(dialog).getByRole('button', { name: 'Open simulated position' }));
    await flush();
    expect(getTrade('TSLA')).not.toBeNull();
  });

  it('T15 produces an unmistakably SIMULATED trade with no real-order path', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    await user.click(within(panel()).getByRole('button', { name: 'Accept into ghost trade' }));
    const dialog = await screen.findByRole('dialog');
    // Market mode fills at the auto-resolved snapshot mid (reskin default is Manual price).
    await user.click(within(dialog).getByRole('button', { name: 'Market' }));
    await within(dialog).findByText(/Fill: mid/);
    await user.click(within(dialog).getByRole('button', { name: 'Open simulated position' }));
    await flush();

    // The resulting ghost trade is SIMULATED + the same store/kind as a manual one; no order path.
    const stored = getTrade('TSLA');
    expect(stored?.status).toBe('open');
    expect(stored?.ticker).toBe('TSLA');
    expect(screen.getAllByText('SIMULATED').length).toBeGreaterThan(0);
    // No real-order path: there is no execute/submit/place-order/live-buy affordance anywhere.
    expect(screen.queryByRole('button', { name: /execute|submit order|place( a)? order|buy to open/i })).toBeNull();
  });

  it('T16 uses active persona by default and a per-query override without recompute', async () => {
    const be = installBackend({ rec: (body) => producedRec({}, body) });
    const user = renderApp();
    await settle();
    const tickerCallsBefore = be.calls.ticker;
    const esBefore = be.esCount();

    // Change the per-query read persona (presentation-only override).
    await user.click(openReadPersona());
    await user.click(await screen.findByRole('option', { name: 'Income Keeper' }));
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));

    // The rec is attributed to the chosen persona…
    expect(await within(panel()).findByText('Persona · Income Keeper')).toBeInTheDocument();
    // …the request carried that persona id…
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => String(c[0]).includes('/api/recommendation/') && (c[1] as RequestInit)?.method === 'POST',
    )?.[1].body as string);
    expect(body.persona_id).toBe('income_keeper');
    // …the globally-active persona is UNCHANGED (the panel caption still names Default as active)…
    expect(within(panel()).getByText(/active persona \(Default \(no persona\)\)/)).toBeInTheDocument();
    // …and no bundle re-fetch / no new stream was triggered by the read (no recompute).
    expect(be.calls.ticker).toBe(tickerCallsBefore);
    expect(be.esCount()).toBe(esBefore);
  });

  it('T17 lets the user view/copy the export without a call, even when in-app is unavailable', async () => {
    const be = installBackend({ status: makeStatus({ availability: { in_app_enabled: false } }) });
    const user = renderApp();
    // userEvent.setup() installs its own clipboard in jsdom — spy on THAT (post-render) so the assert
    // tracks the writeText the component actually calls.
    if (!navigator.clipboard) Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await settle();
    await user.click(within(panel()).getAllByRole('button', { name: "View what's sent" })[0]);

    await screen.findByText("What's sent to the AI · TSLA");
    expect(screen.getByText(/Complete list of what leaves the machine for TSLA/)).toBeInTheDocument();
    expect(screen.getByText('Persona prompt')).toBeInTheDocument();
    expect(screen.getByText('Field glossary')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy all' }));
    expect(writeText).toHaveBeenCalled();
    // No in-app LLM call was triggered.
    expect(be.calls.rec).toBe(0);
  });

  it('T18 keeps the score/tier/gate/live tiles byte-identical across rec activity', async () => {
    const be = installBackend({ rec: (body) => producedRec({}, body) });
    const user = renderApp();
    await settle();
    const oppBefore = screen.getByText(/^42 · /).textContent;
    const gexBefore = screen.getByText('$1.2B').textContent;
    const tickerBefore = be.calls.ticker;

    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');

    // After a produced rec: the bundle-derived tiles are observably identical, and no bundle re-fetch.
    expect(screen.getByText(/^42 · /).textContent).toBe(oppBefore);
    expect(screen.getByText('$1.2B').textContent).toBe(gexBefore);
    expect(be.calls.ticker).toBe(tickerBefore);
  });
});

// =============================================================================================
describe('AI recommendations — promoted invariants (E1–E7)', () => {
  it('E1 rec failure is isolated to its own surface', async () => {
    const be = installBackend({ rec: 'throw' });
    const user = renderApp();
    await settle();
    const tickerBefore = be.calls.ticker;
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('AI unavailable — try again');
    // No HTTP error reached the bundle/page: all other surfaces still live, no extra bundle fetch.
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText('Off-exchange blocks')).toBeInTheDocument();
    expect(screen.getByTestId('open-sim-trade')).toBeInTheDocument();
    expect(be.calls.ticker).toBe(tickerBefore);
  });

  it('E3 score/tier/fingerprint unchanged with and without a rec, and across persona override', async () => {
    // The dedicated hand-off DOM surface for the fingerprint was removed (the toolbar now matches the
    // Figma). Eval invariance is therefore asserted from STORED STATE: the always-visible opportunity
    // tile (score · tier) stays byte-identical AND the no-recompute guards hold (no extra bundle fetch
    // / SSE), which together mean the underlying ai_eval — including its fingerprint — never changed.
    const be = installBackend({ rec: (body) => producedRec({}, body) });
    const user = renderApp();
    await settle();

    const oppBaseline = screen.getByText(/^42 · /).textContent; // opportunity tile: "42 · <tier>"
    const tickerBaseline = be.calls.ticker;
    const esBaseline = be.esCount();

    // (a) Request a rec → opportunity tile byte-identical, and NO extra getTicker/streamTicker bundle
    // fetch (the rec is purely additive — it cannot have recomputed the eval/fingerprint).
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    expect(screen.getByText(/^42 · /).textContent).toBe(oppBaseline);
    expect(be.calls.ticker).toBe(tickerBaseline);
    expect(be.esCount()).toBe(esBaseline);

    // (b) Per-query persona override (as exercised in T16) → those same values are STILL unchanged;
    // the override is pure prompt-framing — recomputes nothing, fetches nothing.
    await user.click(openReadPersona());
    await user.click(await screen.findByRole('option', { name: 'Income Keeper' }));
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('Persona · Income Keeper');
    expect(screen.getByText(/^42 · /).textContent).toBe(oppBaseline);
    expect(be.calls.ticker).toBe(tickerBaseline);
    expect(be.esCount()).toBe(esBaseline);
  });

  it('E4 export carries only context, persona prompt, glossary for the current ticker', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getAllByRole('button', { name: "View what's sent" })[0]);
    await screen.findByText("What's sent to the AI · TSLA");
    const drawer = screen.getByText("What's sent to the AI · TSLA").closest('.MuiDrawer-paper') as HTMLElement;
    const text = drawer.textContent ?? '';
    expect(text).toMatch(/Computed snapshot \(context\)/);
    expect(text).toMatch(/Persona prompt/);
    expect(text).toMatch(/Field glossary/);
    // Egress honesty: no key, no other ticker, no identity, no order data leaked into the drawer.
    expect(text).not.toMatch(/api[_-]?key/i);
    expect(text).not.toMatch(/AAPL|NVDA|SPY/);
    expect(text).not.toMatch(/broker|account number|order_id/i);
  });

  it('E5 flags a stale-born rec generated off an already-stale bundle', async () => {
    installBackend({ rec: producedRec({ stale_born: true }) });
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    // Stale-born warning AT BIRTH — distinct from the post-generation "Stale · based on older data".
    expect(within(panel()).getByText(/generated from a snapshot already marked stale/)).toBeInTheDocument();
    expect(within(panel()).queryByText('Stale · based on older data')).toBeNull();
  });

  it('E6 disables retry when it would land in cooldown or over-cap', async () => {
    // A 200 `unavailable` whose gate carries a live cooldown ⇒ Retry must be disabled + sub-caption.
    installBackend({
      rec: producedRec({
        status: 'unavailable', strategy: null, unavailable_reason: 'over_cap',
        gate: { state: 'cooling_down', cooldown_remaining_seconds: 30, reasons: [] },
      }),
    });
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('AI unavailable — try again');
    const p = panel();
    expect(within(p).getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(within(p).getByText(/Retry available in 30s/)).toBeInTheDocument();
  });

  it('E7 falls back to the embedded persona template when canonical personas are unavailable', async () => {
    const be = installBackend({ personas: 'throw' });
    const user = renderApp();
    await settle();
    // Canonical fetch failed, but the read-persona select is still populated from the FE embed…
    await user.click(openReadPersona());
    expect(await screen.findByRole('option', { name: 'Income Keeper' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // …and a rec can still be produced (the feature degrades to the embed, never breaks).
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    expect(await within(panel()).findByText('1.5% of account ($300)')).toBeInTheDocument();
    expect(be.calls.personas).toBe(1);
  });
});

// =============================================================================================
describe('AI recommendations — timer-driven states (T6/E2, T7, T9)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // Drive the action button with fireEvent (no userEvent internal delays — avoids the
  // fake-timer/userEvent interplay), flushing pending fetch microtasks via advanceTimersByTimeAsync.
  const tick = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const recoButton = () => within(panel()).getByText('Get AI recommendation').closest('button') as HTMLButtonElement;

  it('T9 disables the action with a visible cooldown that re-enables', async () => {
    installBackend({
      rec: producedRec({ gate: { state: 'cooling_down', cooldown_remaining_seconds: 3, reasons: [] } }),
    });
    render(<MemoryRouter initialEntries={['/ticker/TSLA']}><App /></MemoryRouter>);
    await tick();

    await act(async () => { fireEvent.click(recoButton()); });
    await tick();
    // Disabled with a visible countdown.
    expect(within(panel()).getByText(/Cooling down · 3s/).closest('button')).toBeDisabled();
    // Advancing the timer past the window re-enables the action.
    await tick(3000);
    expect(recoButton()).toBeEnabled();
  });

  it('T6/E2 marks the rec stale on a newer bundle without refreshing it; SSE drop leaves it untouched', async () => {
    const be = installBackend({});
    render(<MemoryRouter initialEntries={['/ticker/TSLA']}><App /></MemoryRouter>);
    await tick();

    await act(async () => { fireEvent.click(recoButton()); });
    await tick();
    expect(within(panel()).getByText('1.5% of account ($300)')).toBeInTheDocument();
    const recCallsAtProduce = be.calls.rec;

    // --- T7 first: an SSE drop must leave the rec UNTOUCHED (it is not a live-derived tile). ---
    await act(async () => { be.emit(liveUpdate()); });   // one payload → live engages + arms the watchdog
    await tick(15_000);                                  // gap watchdog → page-level Live offline
    expect(screen.getByText(/Live offline/)).toBeInTheDocument();
    expect(within(panel()).queryByText('Stale · based on older data')).toBeNull();
    expect(within(panel()).queryByText(/offline/i)).toBeNull();            // no offline chrome on the rec
    expect(within(panel()).getByText('1.5% of account ($300)')).toBeInTheDocument(); // pinned, intact

    // --- T6: a NEWER bundle (poll) staleness — distinct transition. ---
    be.setState({ bundle: () => makeBundle({ fingerprint: 'fp-B', snapshot: '2026-06-23T14:09:00Z' }) });
    await tick(60_000);                                  // the 60s poll lands the newer bundle
    expect(within(panel()).getByText('Stale · based on older data')).toBeInTheDocument();
    expect(within(panel()).getByText(/A newer snapshot has arrived/)).toBeInTheDocument();
    // The rec body is byte-stable (not refreshed/mutated) and NO new rec query was fired.
    expect(within(panel()).getByText('1.5% of account ($300)')).toBeInTheDocument();
    expect(be.calls.rec).toBe(recCallsAtProduce);
  });
});
