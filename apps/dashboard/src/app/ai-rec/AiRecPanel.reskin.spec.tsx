/**
 * AiRecPanel re-skin — component-state coverage for the convexa-redesign Ticker re-skin. The full
 * ai-rec state machine is exhaustively covered by `ai-rec.spec.tsx` / `byo-ai-key.spec.tsx`; THIS spec
 * pins the re-skin promise: the new card design **preserves** the gate/produced/no-key/Accept/export
 * states (testids + risk-first copy + Accept→ghost-trade) after the visual refresh. Mounts <App/> at
 * /ticker/TSLA, mocking ONLY the network boundary (never a live backend).
 */
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TickerBundle, RecResponse, RecStatus } from '@org/api';
import { PRESETS } from '../personas/presets';
import { clearTrade, getTrade } from '../ghost-trade/store';
import App from '../app';

const SNAP_A = '2026-06-23T14:03:11Z';
const FP_A = 'fp-A';

function makeBundle(): TickerBundle {
  return {
    market_state: {
      ticker: 'TSLA', price: 250.5, gex_spot: 250, timestamp: 1, timestamp_iso: SNAP_A,
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
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [] },
    expirations: [{ date: '2026-07-18', dte: 25 }],
    ai_eval: { ready: true, reasons: [], changed: true, state_fingerprint: FP_A, score_threshold: 50 },
    meta: {
      served_at: SNAP_A, cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: { snapshot_iso: SNAP_A, data_age_seconds: 30, stale: false, stale_after_seconds: 600 },
    },
    off_exchange: { ratio_pct: 38, offex_shares: 38_000, total_shares: 100_000, levels: [], blocks: [], block_min_shares: 5000, note: '' },
    position_eval: null,
  };
}

function producedRec(): RecResponse {
  return {
    status: 'produced', persona: { id: null, name: 'Default (no persona)' },
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
  };
}

function noKeyRec(): RecResponse {
  return { ...producedRec(), status: 'unavailable', strategy: null, unavailable_reason: 'no_key', free_uses_total: 3 };
}

let status: RecStatus;
let rec: RecResponse;

function installBackend() {
  status = { availability: { in_app_enabled: true }, gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] }, cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' } };
  rec = producedRec();
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
  class MockEventSource { onmessage: ((e: MessageEvent) => void) | null = null; onerror: ((e: Event) => void) | null = null; close() { /* */ } }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/auth/session')) {
      return json({ authenticated: true, user: { id: 'u', email: 't@u.com', display_name: null, auth_methods: ['password'] }, google_available: false, settings: { active_persona_id: null, default_ticker: null, theme: 'dark' } });
    }
    if (url.includes('/api/ticker/')) return json(makeBundle());
    if (url.includes('/api/recommendation/status/')) return json(status);
    if (url.includes('/api/recommendation/export/')) return json({ ticker: 'TSLA', as_of: SNAP_A, context: {}, persona_prompt: '', glossary: '', egress_note: '' });
    if (url.includes('/api/recommendation/') && init?.method === 'POST') return json(rec);
    if (url.includes('/api/personas')) return json(PRESETS);
    if (url.includes('/api/contract/')) return json(null);
    throw new Error(`Unexpected fetch: ${url}`);
  }));
}

beforeEach(() => { localStorage.clear(); clearTrade('TSLA'); installBackend(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); cleanup(); });

function renderApp() {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/ticker/TSLA']}><App /></MemoryRouter>);
  return user;
}
const panel = () => screen.getByTestId('ai-rec-panel');
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}

describe('AiRecPanel re-skin — states preserved on the new card', () => {
  it('renders inside the re-skinned card (ai-rec-panel testid present)', async () => {
    renderApp();
    await settle();
    expect(panel()).toBeInTheDocument();
  });

  it('PRODUCED: risk-first card renders Max risk before Structure + Accept/View export controls', async () => {
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    const p = panel();
    expect(within(p).getByText('Max risk')).toBeInTheDocument();
    expect(within(p).getByText('Invalidation')).toBeInTheDocument();
    expect(within(p).getByText('call debit spread')).toBeInTheDocument();
    // Risk-first ordering preserved through the re-skin (Max risk precedes Structure in the DOM).
    const maxRisk = within(p).getByText('Max risk');
    const structure = within(p).getByText('Structure');
    expect(maxRisk.compareDocumentPosition(structure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Accept + export controls present (Accept→ghost-trade, export floor).
    expect(within(p).getByRole('button', { name: 'Accept into ghost trade' })).toBeInTheDocument();
    expect(within(p).getAllByRole('button', { name: "View what's sent" }).length).toBeGreaterThan(0);
  });

  it('Accept on the re-skinned card opens a pre-filled ghost-trade entry (no real order)', async () => {
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    await within(panel()).findByText('1.5% of account ($300)');
    await user.click(within(panel()).getByRole('button', { name: 'Accept into ghost trade' }));
    // The mandatory-confirm entry dialog opens; nothing is tracked until confirm (no trade yet).
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(getTrade('TSLA')).toBeNull();
  });

  it('NO-KEY state keeps its distinct CTA block + Add-key control on the re-skinned card', async () => {
    rec = noKeyRec();
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getByRole('button', { name: 'Get AI recommendation' }));
    const cta = await within(panel()).findByTestId('ai-rec-state-no-key');
    expect(cta).toBeInTheDocument();
    expect(within(cta).getByTestId('ai-rec-add-key-cta')).toBeInTheDocument();
  });

  it('export floor ("View what\'s sent") stays present in the header in every state', async () => {
    renderApp();
    await settle();
    // Before any rec is produced, the header export control is already present (the always-on floor).
    expect(within(panel()).getByRole('button', { name: "View what's sent" })).toBeInTheDocument();
  });
});
