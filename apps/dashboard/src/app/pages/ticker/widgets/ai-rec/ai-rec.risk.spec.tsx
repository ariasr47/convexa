/**
 * AI-rec widget — RISK-BASED suite (per the amended QA rule, `.claude/agents/qa-verify.md` §4,
 * 2026-07-13). Consolidates the former per-AC mirrors (`ai-rec.spec.tsx`, `byo-ai-key.spec.tsx`,
 * `AiRecPanel.reskin.spec.tsx`) down to the invariants where a silent regression is plausible AND
 * invisible to a reviewer:
 *
 *   1. GROUNDING — "Levels in play" is BUNDLE-sourced, never LLM-sourced: a rec that carries a
 *      conflicting number renders it in its own fields but can never leak into the levels strip.
 *   2. AUTH OUTERMOST — logged out, the sign-in gate replaces the whole action surface; the inner
 *      cooldown/cap/key states can NEVER surface (enforced by construction: the mock status is
 *      poisoned with all of them armed), and a signed-out transition hides the retained read.
 *   3. The ALWAYS-200 STATUS MACHINE — the host wiring for no-power-path vs own-key, the standing
 *      model preference write, an LLM call only on an explicit tap, and a transport fault that
 *      degrades the rec surface ALONE (bundle tiles keep rendering). The per-state mapping itself is
 *      unit-proven in `presentationPolicy.spec.ts`.
 *   4. STATIC ARTIFACT — the rec is pinned to its snapshot: an SSE drop leaves it untouched, a newer
 *      bundle only marks it stale (content byte-stable, NO silent re-run — asserted on the mock's
 *      POST count, by construction).
 *   5. ADVICE, NEVER A COMMAND — review/order cancel writes nothing and confirm writes exactly one
 *      record, the pinned read unchanged; the Accept→prefill handoff object is unit-proven (the
 *      dialog's internals belong to its own risk spec).
 *   6. WRITE-ONLY KEY — a failed key save never echoes the raw key (add/replace/remove live in
 *      `features/auth/aiProviders.flow.spec.tsx`).
 *
 * NOT asserted here (visible + intentional → review/QA; brittle to automate): exact copy/disclaimer
 * wording, chip/testid presence for its own sake, re-skin structure/styling, per-field label text.
 * The fetch mock THROWS on any unexpected call, so "no hidden network" is enforced by construction.
 * Server-side enforcement (key resolution, allowance decrement, caps) is backend-verified — these
 * tests cover the FE half only: render what the wire says, leak nothing it doesn't.
 */
import App from '@/app';
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { SettingsPage } from '@/features/auth/SettingsPage';
import { AppThemeProvider } from '@/features/auth/ThemeProvider';
import {
  defaultAiCatalog,
  emptyAiSlots,
  makeAiBootstrap,
  makeBundle,
} from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import { __resetOrdersMemory, allOrders } from '@/features/trading/orders/store';
import {
  __resetMemory as __resetPositions,
  allPositions,
} from '@/features/trading/positions/store';
import type {
  ByoProvider,
  RecResponse,
  RecStatus,
  RecStrategy,
  RiskInputs,
  TickerBundle,
} from '@convexa/api';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY, PREFILL_WITHHELD } from './copy';
import {
  recAllTraced,
  recBlockAbsent,
  recCouldNotCheck,
  recFabricated,
  tradeRecEqualToCap,
} from './fixtures';
import { recToPrefill } from './prefill';

// Test-only mutable consumer seam: the production AuthProvider remains untouched. Transition tests
// flip the value consumed by AiRecPanel and rerender the same mounted tree.
let gateOverride: { allowed: boolean; promptText: string | null } | null = null;
let rerenderCurrent: (() => void) | null = null;
vi.mock('@/features/auth/useGate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth/useGate')>();
  return {
    ...actual,
    useGate: () => {
      const base = actual.useGate();
      return gateOverride ? { ...base, ...gateOverride } : base;
    },
  };
});

// ---- INTERFACE-shaped fixtures (pinned to the shared bundle: fp-A / 2026-06-26T14:00:00Z) ------
const FP_A = 'fp-A';
const SNAP_A = '2026-06-26T14:00:00Z';
const RAW_KEY = 'sk-ant-supersecretkey1234';
const REC_BODY = '1.5% of account ($300)'; // the produced-rec marker (max_risk)

function tradeStrategy(over: Partial<RecStrategy> = {}): RecStrategy {
  return {
    decision: 'trade',
    bias: 'long',
    structure: 'call debit spread',
    strikes: [260],
    expiration: '2026-07-18',
    entry_trigger: 'break and hold above the 260 call wall',
    invalidation_level: 242,
    max_risk: REC_BODY,
    position_size: '2 contracts',
    exit_plan: { target: 12.5, stop: 6 },
    time_horizon: '5–10 trading days',
    confidence: 'medium',
    rationale: 'magnet at 255, flip at 248; IV/HV cheap.',
    ...over,
  };
}

/** AC-30/AC-31 — a fully-traced grounding block matching `tradeStrategy()`'s own stop/target/
 *  invalidation figures, so the SSE-drop / newer-bundle / superseded-inputs tests can assert the
 *  card-level line AND a per-figure clause stay byte-stable across events unrelated to the rec. */
const GROUNDING_ALL_TRACED_FOR_TRADE_STRATEGY = {
  card: 'all_traced' as const,
  counts: { checked: 4, traced: 4, untraced: 0, not_checkable: 0 },
  tolerance_pct: 0.1,
  fields: {
    exit_stop: {
      state: 'traced' as const,
      basis: 'near' as const,
      anchor_kind: 'call_wall' as const,
      anchor_value: 6.05,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: null,
    },
    exit_target: {
      state: 'traced' as const,
      basis: 'inside_range' as const,
      anchor_kind: null,
      anchor_value: null,
      range_low: 10,
      range_high: 15,
      expiration: '2026-07-18',
      not_checkable_reason: null,
    },
    invalidation_level: {
      state: 'traced' as const,
      basis: 'exact' as const,
      anchor_kind: 'gamma_flip' as const,
      anchor_value: 242,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: null,
    },
    max_risk: {
      state: 'not_checkable' as const,
      basis: null,
      anchor_kind: null,
      anchor_value: null,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: 'structurally_unchecked' as const,
    },
    position_size: {
      state: 'not_checkable' as const,
      basis: null,
      anchor_kind: null,
      anchor_value: null,
      range_low: null,
      range_high: null,
      expiration: null,
      not_checkable_reason: 'structurally_unchecked' as const,
    },
  },
};

function producedRec(over: Partial<RecResponse> = {}): RecResponse {
  return {
    status: 'produced',
    persona: { id: null, name: 'Default (no persona)' },
    as_of: SNAP_A,
    pinned_fingerprint: FP_A,
    stale_born: false,
    strategy: tradeStrategy(),
    unavailable_reason: null,
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' },
    ...over,
  };
}

const producedOwn = () =>
  producedRec({ key_source: 'own_key', provider: 'anthropic', model: 'claude-opus-4-8' });
const recUnavailable = (reason: string, extra: Partial<RecResponse> = {}) =>
  producedRec({
    status: 'unavailable',
    strategy: null,
    unavailable_reason: reason,
    key_source: 'none',
    ...extra,
  });

function makeStatus(over: Partial<RecStatus> = {}): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
    ...over,
  };
}

// ---- Controllable mock backend (the network boundary — NEVER a live backend) -------------------
// STRICT: any URL this router doesn't know THROWS, so a new hidden fetch fails every test here.
interface BackendCfg {
  authenticated?: boolean;
  bundle?: TickerBundle | (() => TickerBundle);
  status?: RecStatus;
  rec?: RecResponse | 'throw';
  personas?: unknown | 'throw';
  aiKey?: {
    set?: boolean;
    last4?: string | null;
    storage_available?: boolean;
    put?: 'ok' | 'transport';
    catalog?: ReturnType<typeof defaultAiCatalog>;
  };
  /** tradeable-rec-inputs AC-64 — the CURRENTLY stored risk block, echoed on the who-am-I settings
   *  read, so a test can diverge it from a produced rec's `sent.risk_inputs` and observe the
   *  superseded-inputs strip. Omitted ⇒ no `risk_inputs` key at all (matches the shipped shape). */
  riskInputs?: RiskInputs;
}

function installBackend(cfg: BackendCfg = {}) {
  const state = {
    authenticated: cfg.authenticated ?? true,
    bundle: cfg.bundle ?? makeBundle(),
    status: cfg.status ?? makeStatus(),
    rec: cfg.rec ?? producedRec(),
    personas: cfg.personas ?? PRESETS,
    aiKey: {
      set: cfg.aiKey?.set ?? false,
      last4: cfg.aiKey?.last4 ?? null,
      storage_available: cfg.aiKey?.storage_available ?? true,
      put: cfg.aiKey?.put ?? ('ok' as 'ok' | 'transport'),
      catalog: cfg.aiKey?.catalog ?? defaultAiCatalog(),
      slots: {
        ...emptyAiSlots(),
        ...(cfg.aiKey?.set ? { anthropic: { set: true, last4: cfg.aiKey.last4 ?? '1234' } } : {}),
      },
    },
    riskInputs: cfg.riskInputs,
  };
  const calls = {
    ticker: 0,
    status: 0,
    rec: 0,
    export: 0,
    personas: 0,
    aiKeyPut: 0,
    settingsPut: 0,
  };
  const recPostBodies: string[] = [];
  const aiKeyPutBodies: string[] = [];
  const settingsPutBodies: string[] = [];
  const responsesSeen: string[] = []; // every JSON body the FE received (egress scans)
  const esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];

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

  const json = (b: unknown, status = 200) => {
    responsesSeen.push(JSON.stringify(b));
    return new Response(JSON.stringify(b), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/api/auth/session')) {
        return json(
          state.authenticated
            ? {
                authenticated: true,
                user: {
                  id: 'u-1',
                  email: 'a@x.com',
                  display_name: null,
                  auth_methods: ['password'],
                },
                google_available: false,
                settings: {
                  active_persona_id: null,
                  default_ticker: null,
                  theme: 'dark',
                  ...(state.riskInputs ? { risk_inputs: state.riskInputs } : {}),
                },
              }
            : { authenticated: false, user: null, google_available: false, settings: null },
        );
      }
      if (url.includes('/api/positions/sim-trade/gate')) return json({ allowed: true });
      if (url.includes('/api/auth/settings') && method === 'PUT') {
        calls.settingsPut++;
        settingsPutBodies.push(String(init?.body ?? ''));
        const patch = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return json({
          active_persona_id: null,
          default_ticker: null,
          theme: 'dark',
          ...patch,
        });
      }
      if (url.includes('/api/auth/ai-key')) {
        if (!state.authenticated) return json({ error: 'auth_required', message: 'sign in' }, 403);
        if (method === 'GET') {
          const slots = state.aiKey.slots ?? emptyAiSlots();
          if (state.aiKey.set) slots.anthropic = { set: true, last4: state.aiKey.last4 ?? '1234' };
          return json(
            makeAiBootstrap({
              storage_available: state.aiKey.storage_available,
              put: state.aiKey.put,
              slots,
              grok: { available: false, connected: false, unavailable_reason: null },
              preference: {
                power_path: state.aiKey.set ? 'own_key' : null,
                provider: state.aiKey.set ? 'anthropic' : null,
                model: 'claude-opus-4-8',
              },
              catalog: state.aiKey.catalog,
            }),
          );
        }
        if (method === 'PUT') {
          calls.aiKeyPut++;
          aiKeyPutBodies.push(String(init?.body ?? ''));
          if (state.aiKey.put === 'transport') return new Response('', { status: 502 });
          const parsed = init?.body
            ? (JSON.parse(String(init.body)) as { key?: string; provider?: ByoProvider })
            : {};
          const provider = parsed.provider ?? 'anthropic';
          state.aiKey.set = true;
          state.aiKey.last4 = (parsed.key ?? '').slice(-4);
          state.aiKey.slots = {
            ...emptyAiSlots(),
            ...state.aiKey.slots,
            [provider]: { set: true, last4: state.aiKey.last4 },
          };
          return json(
            makeAiBootstrap({
              storage_available: true,
              put: 'ok',
              slots: state.aiKey.slots,
              grok: { available: false, connected: false, unavailable_reason: null },
              preference: { power_path: 'own_key', provider, model: 'claude-opus-4-8' },
              catalog: state.aiKey.catalog,
            }),
          );
        }
        if (method === 'DELETE') {
          const provider = (new URL(url, 'http://local.invalid').searchParams.get('provider') ??
            'anthropic') as ByoProvider;
          state.aiKey.set = provider === 'anthropic' ? false : state.aiKey.set;
          state.aiKey.last4 = provider === 'anthropic' ? null : state.aiKey.last4;
          state.aiKey.slots = {
            ...emptyAiSlots(),
            ...state.aiKey.slots,
            [provider]: { set: false, last4: null },
          };
          return json(
            makeAiBootstrap({
              storage_available: state.aiKey.storage_available,
              put: 'ok',
              slots: state.aiKey.slots,
              grok: { available: false, connected: false, unavailable_reason: null },
              preference: { power_path: null, provider: null, model: 'claude-opus-4-8' },
              catalog: state.aiKey.catalog,
            }),
          );
        }
      }
      if (url.includes('/api/ticker/')) {
        calls.ticker++;
        return json(typeof state.bundle === 'function' ? state.bundle() : state.bundle);
      }
      if (url.includes('/api/recommendation/status/')) {
        calls.status++;
        return json(state.status);
      }
      if (url.includes('/api/recommendation/export/')) {
        calls.export++;
        return json({
          ticker: 'TSLA',
          as_of: SNAP_A,
          context: { gamma_flip: 248, call_wall: 260, opportunity_score: 42 },
          persona_prompt: 'You are a disciplined options strategist…',
          glossary: 'glossary…',
          egress_note:
            'Complete list: context + persona prompt + glossary. No other ticker, no identity, ' +
            'no order data, and no API key ever leave.',
        });
      }
      if (url.includes('/api/recommendation/') && method === 'POST') {
        calls.rec++;
        recPostBodies.push(String(init?.body ?? ''));
        if (state.rec === 'throw') throw new Error('network down');
        return json(state.rec);
      }
      if (url.includes('/api/personas')) {
        calls.personas++;
        return state.personas === 'throw' ? json({ detail: 'down' }, 500) : json(state.personas);
      }
      if (url.includes('/api/contract/')) return json(null);
      if (url.includes('/history'))
        return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
      throw new Error(`Unexpected fetch in ai-rec risk test: ${url}`);
    }),
  );

  return {
    calls,
    recPostBodies,
    aiKeyPutBodies,
    settingsPutBodies,
    responsesSeen,
    esCount: () => esInstances.length,
    emit: (payload: unknown) =>
      esInstances.forEach((es) =>
        es.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent),
      ),
    setState: (patch: Partial<typeof state>) => Object.assign(state, patch),
  };
}

const liveUpdate = () => ({
  ticker: 'TSLA',
  mid: 250.5,
  bid: 250.4,
  ask: 250.6,
  spread: 0.2,
  net_flow: 100,
  buy_vol: 10,
  sell_vol: 5,
  flow_window_s: 300,
  spot_ts: 1,
  live: true,
  tick_age_s: 1,
  market_session: 'regular',
  feed: 'realtime',
  ts: 1,
  gamma_flip: 248,
  last_trade: 250.5,
});

// ---- Mounts ------------------------------------------------------------------------------------
function renderApp() {
  const user = userEvent.setup();
  const mounted = render(
    <MemoryRouter initialEntries={['/ticker/TSLA']}>
      <App />
    </MemoryRouter>,
  );
  rerenderCurrent = () =>
    mounted.rerender(
      <MemoryRouter initialEntries={['/ticker/TSLA']}>
        <App />
      </MemoryRouter>,
    );
  return user;
}
function renderSettings() {
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <AuthDialogProvider>
            <Routes>
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
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
/** Click "Get AI recommendation" once its gated state has resolved. */
async function ask(user: ReturnType<typeof renderApp>) {
  await waitFor(() =>
    expect(within(panel()).getByRole('button', { name: COPY.action.get })).toBeEnabled(),
  );
  await user.click(within(panel()).getByRole('button', { name: COPY.action.get }));
}
async function openAnalysis(user: ReturnType<typeof renderApp>) {
  await user.click(within(panel()).getByRole('button', { name: COPY.action.analysis }));
  return screen.findByRole('dialog', { name: /Full analysis & data/ });
}
function pinnedCardSnapshot(card: HTMLElement) {
  return {
    text: card.textContent,
    fingerprint: card.dataset.recPinnedFingerprint,
    asOf: card.dataset.recAsOf,
    personaId: card.dataset.recPersonaId,
    personaName: card.dataset.recPersonaName,
  };
}
function expectPinnedActionsUnchanged(be: ReturnType<typeof installBackend>) {
  expect(be.calls.rec).toBe(1);
  expect(within(panel()).queryByRole('button', { name: COPY.action.refresh })).toBeNull();
}

beforeEach(() => {
  localStorage.clear();
  __resetPositions(); // the ONE book — the ghost-trade store has no writer any more
  __resetOrdersMemory();
});
afterEach(() => {
  gateOverride = null;
  rerenderCurrent = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

// =================================================================================================
// 1. GROUNDING — "Levels in play" is bundle-sourced; the LLM's numbers can never leak into it
// =================================================================================================
describe('ai-rec · grounding (levels are bundle-sourced)', () => {
  it('a rec carrying a CONFLICTING level renders it in its own fields, but the levels strip shows the bundle', async () => {
    // The bundle says call_wall=260 / gamma_flip=248 / put_wall=240. The LLM claims 999 everywhere.
    installBackend({
      rec: producedRec({
        strategy: tradeStrategy({
          strikes: [999],
          invalidation_level: 999,
          entry_trigger: 'break and hold above 999',
          rationale: 'the call wall at 999 is the magnet.',
        }),
      }),
    });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(REC_BODY);

    // The rec's own fields DO show the LLM's number (the fixture conflict is real)…
    expect(within(panel()).getByText('$999')).toBeInTheDocument();

    // …but the "Levels in play" strip is fed by the BUNDLE alone: 260/248/240 win, 999 never appears.
    const analysis = await openAnalysis(user);
    const strip = within(analysis).getByTestId('analysis-levels');
    expect(within(strip).getByText('260')).toBeInTheDocument(); // call wall (bundle)
    expect(within(strip).getByText('248')).toBeInTheDocument(); // gamma flip (bundle)
    expect(within(strip).getByText('240')).toBeInTheDocument(); // put wall (bundle)
    expect(within(strip).queryByText(/999/)).toBeNull(); // the LLM's number never leaks in
  });
});

// =================================================================================================
// 2. AUTH OUTERMOST — logged out, no inner state can surface; the export floor stays anonymous
// =================================================================================================
describe('ai-rec · auth gate is outermost', () => {
  it('logged out: the sign-in gate ONLY — poisoned cooldown/cap/key states never surface, no LLM call', async () => {
    // Poison the status with EVERY inner state armed: if the gate ordering ever regresses, one of
    // these leaks into the DOM and this fails.
    const be = installBackend({
      authenticated: false,
      status: makeStatus({
        gate: { state: 'cooling_down', cooldown_remaining_seconds: 30, reasons: [] },
        cap: { over_limit: true, remaining_today: 0, resets_at: '2026-06-27T04:00:00Z' },
      }),
      rec: recUnavailable('no_key'),
    });
    renderApp();
    await settle();

    expect(await within(panel()).findByTestId('ai-rec-signin-prompt')).toBeInTheDocument();
    expect(within(panel()).getByTestId('ai-rec-signin-button')).toBeEnabled();
    // None of the inner states is reachable while signed out.
    expect(within(panel()).queryByText(/Cooling down/)).toBeNull();
    expect(within(panel()).queryByText(/Daily AI limit/)).toBeNull();
    for (const id of [
      'ai-rec-state-no-key',
      'ai-rec-state-key-unusable',
      'ai-rec-state-key-rejected',
      'ai-rec-state-model-missing',
      'ai-rec-state-oauth-expired',
      'ai-rec-own-key',
    ]) {
      expect(within(panel()).queryByTestId(id)).toBeNull();
    }
    expect(be.calls.rec).toBe(0); // the LLM was never invoked
    expect(within(panel()).queryByTestId('ai-rec-model-select')).toBeNull();
  });

  async function assertSignedOutTransition(be: ReturnType<typeof installBackend>) {
    const requestsBefore = be.calls.rec;
    act(() => {
      gateOverride = { allowed: false, promptText: null };
      rerenderCurrent?.();
    });
    await waitFor(() =>
      expect(within(panel()).getByTestId('ai-rec-auth-gate')).toBeInTheDocument(),
    );
    expect(within(panel()).getByTestId('ai-rec-signin-button')).toBeEnabled();
    expect(
      within(panel()).getAllByRole('button', { name: COPY.action.viewExport }).length,
    ).toBeGreaterThan(0);
    for (const testId of [
      'ai-rec-decision-card',
      'ai-rec-state-no-key',
      'ai-rec-state-key-unusable',
      'ai-rec-state-key-rejected',
      'ai-rec-state-model-missing',
    ]) {
      expect(within(panel()).queryByTestId(testId)).toBeNull();
    }
    for (const label of [
      COPY.action.retry,
      COPY.action.accept,
      COPY.action.createOrder,
      COPY.action.analysis,
      COPY.action.dismiss,
    ]) {
      expect(within(panel()).queryByRole('button', { name: label })).toBeNull();
    }
    expect(within(panel()).queryByText(COPY.loading.title)).toBeNull();
    expect(within(panel()).queryByText(COPY.unavailable.title)).toBeNull();
    expect(
      within(panel()).queryByText(/Next read persona|AI key|Daily AI limit|Cooling down/),
    ).toBeNull();
    expect(be.calls.rec).toBe(requestsBefore);
  }

  it('produced retained read transitions from signed-in to signed-out without remount/request', async () => {
    const be = installBackend({ authenticated: true, rec: recAllTraced() });
    const user = renderApp();
    await settle();
    await ask(user);
    expect(within(panel()).getByTestId('ai-rec-decision-card')).toBeInTheDocument();
    await assertSignedOutTransition(be);
  });
});

// =================================================================================================
// 3. The ALWAYS-200 STATUS MACHINE — one distinct affordance per state; the surface degrades alone
// =================================================================================================
describe('ai-rec · key-resolution machine (distinct affordance per state)', () => {
  const CTA_IDS = [
    'ai-rec-state-no-key',
    'ai-rec-state-key-unusable',
    'ai-rec-state-key-rejected',
    'ai-rec-state-model-missing',
    'ai-rec-state-oauth-expired',
    'ai-rec-state-oauth-unlinked',
    'ai-rec-state-subscription-unavailable',
  ] as const;
  it.each([
    {
      name: 'no power path → setup block (not model-missing)',
      rec: recUnavailable('no_key'),
      cta: 'ai-rec-state-no-key',
      chip: null,
    },
    {
      name: 'own key → produced rec + Using your Anthropic key, NO free-uses',
      rec: producedOwn(),
      cta: null,
      chip: 'Using your Anthropic key',
    },
  ])('$name', async ({ rec, cta, chip }) => {
    installBackend({ rec });
    const user = renderApp();
    await settle();
    await ask(user);

    if (cta) {
      const block = await within(panel()).findByTestId(cta);
      expect(within(block).getByTestId('ai-rec-add-key-cta')).toBeEnabled();
      expect(within(panel()).queryByText(REC_BODY)).toBeNull();
      expect(within(panel()).queryByRole('button', { name: COPY.action.accept })).toBeNull();
      expect(within(panel()).queryByText(/free uses|Convexa Grok pool/i)).toBeNull();
    } else {
      await within(panel()).findByText(REC_BODY);
      expect(within(panel()).getByRole('button', { name: COPY.action.accept })).toBeEnabled();
      expect(within(panel()).getByText(chip as string)).toBeInTheDocument();
      expect(within(panel()).queryByText(/free uses|Convexa Grok pool/i)).toBeNull();
    }
    for (const id of CTA_IDS) if (id !== cta) expect(within(panel()).queryByTestId(id)).toBeNull();
    expect(screen.getByText('Call wall')).toBeInTheDocument();
  });

  it('Ask-AI model select writes the standing preference (AC-6 / D6)', async () => {
    const catalog = defaultAiCatalog();
    catalog.providers = catalog.providers.map((p) =>
      p.provider === 'anthropic'
        ? {
            provider: 'anthropic',
            models: [
              { id: 'claude-opus-4-8', recommended: true },
              { id: 'claude-sonnet-4-5', recommended: false },
            ],
          }
        : p,
    );
    const be = installBackend({ rec: producedOwn(), aiKey: { catalog } });
    const user = renderApp();
    await settle();
    const select = await within(panel()).findByRole('combobox', {
      name: 'Model for recommendations',
    });
    await user.click(select);
    const opt = await screen.findByRole('option', { name: /claude-sonnet-4-5/ });
    await user.click(opt);
    await waitFor(() => expect(be.calls.settingsPut).toBe(1));
    expect(JSON.parse(be.settingsPutBodies[0])).toEqual({ ai_model: 'claude-sonnet-4-5' });
    expect(screen.queryByRole('option', { name: /^default$/i })).toBeNull();
  });

  it('no-fresh-edge: the offered affordance is an explicit one-tap override that fires exactly one POST', async () => {
    const be = installBackend({
      status: makeStatus({
        gate: { state: 'no_fresh_edge', cooldown_remaining_seconds: 0, reasons: ['score low'] },
      }),
    });
    const user = renderApp();
    await settle();
    const askAnyway = await within(panel()).findByRole('button', { name: COPY.action.askAnyway });
    expect(be.calls.rec).toBe(0); // nothing fired without the explicit tap
    await user.click(askAnyway);
    await within(panel()).findByText(REC_BODY);
    expect(be.calls.rec).toBe(1);
  });

  it('transport fault: Retry is offered and the failure never escapes the panel (page intact, no re-fetch)', async () => {
    const be = installBackend({ rec: 'throw' });
    const user = renderApp();
    await settle();
    const tickerBefore = be.calls.ticker;
    await ask(user);
    await within(panel()).findByText(COPY.unavailable.title);
    expect(within(panel()).getByRole('button', { name: COPY.action.retry })).toBeEnabled();
    // Isolation: the dashboard keeps rendering; the fault triggered no bundle re-fetch.
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByTestId('open-sim-trade')).toBeInTheDocument();
    expect(be.calls.ticker).toBe(tickerBefore);
  });
});

// =================================================================================================
// 4. STATIC ARTIFACT — pinned to its snapshot; marked, never mutated; never silently re-run
// =================================================================================================
describe('ai-rec · static artifact pinned to its snapshot (timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // fireEvent (not userEvent) under fake timers; flush micro/macrotasks via advanceTimersByTimeAsync.
  const tick = (ms = 0) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const recoButton = () =>
    within(panel()).getByText(COPY.action.get).closest('button') as HTMLButtonElement;

  it('SSE drop leaves the rec untouched; a newer bundle marks it stale WITHOUT mutating it or re-running', async () => {
    const be = installBackend({
      rec: producedRec({ grounding: GROUNDING_ALL_TRACED_FOR_TRADE_STRATEGY }),
    });
    render(
      <MemoryRouter initialEntries={['/ticker/TSLA']}>
        <App />
      </MemoryRouter>,
    );
    await tick();
    await act(async () => {
      fireEvent.click(recoButton());
    });
    await tick();
    expect(within(panel()).getByText(REC_BODY)).toBeInTheDocument();
    const recCallsAtProduce = be.calls.rec;
    // AC-30/AC-31 — capture the grounding surface BEFORE either event, so "byte-stable" is an actual
    // before/after comparison, not an assumption.
    const cardLineBefore = within(panel()).getByTestId('grounding-card-line').textContent;
    fireEvent.click(within(panel()).getByRole('button', { name: COPY.action.analysis }));
    await tick();
    const analysis = screen.getByRole('dialog', { name: /Full analysis & data/ });
    const clauseBefore = within(analysis).getByTestId('clause-stop').textContent;
    expect(cardLineBefore).toMatch(/Every checked figure traces/);

    // (a) SSE drop: the page's LIVE surface goes offline, but the rec is not a live-derived tile —
    // no stale marker, no offline chrome on the rec, content intact.
    await act(async () => {
      be.emit(liveUpdate());
    });
    await tick(15_000); // gap watchdog → page-level Live offline
    expect(screen.getByText(/Live offline/)).toBeInTheDocument();
    expect(within(panel()).queryByText(COPY.stale.chip)).toBeNull();
    expect(within(panel()).queryByText(/offline/i)).toBeNull();
    expect(within(panel()).getByText(REC_BODY)).toBeInTheDocument();
    // AC-30 (SB) — no grounding clause dims, changes, disappears or flips to "couldn't check": the
    // card line and the stop clause are BYTE-IDENTICAL to before the drop, and the node carries no
    // offline/dimmed marker (unlike the live-derived tiles the assertion above already checked).
    expect(within(panel()).getByTestId('grounding-card-line').textContent).toBe(cardLineBefore);
    expect(within(analysis).getByTestId('clause-stop').textContent).toBe(clauseBefore);
    expect(
      within(panel()).getByTestId('grounding-card-line').getAttribute('aria-disabled'),
    ).toBeNull();

    // (b) A NEWER bundle lands on the 60s poll: the stale marker appears; the rec body is
    // byte-stable and NO second POST was fired (no silent re-run — by construction).
    be.setState({
      bundle: () => {
        const b = makeBundle();
        return {
          ...b,
          ai_eval: { ...b.ai_eval, state_fingerprint: 'fp-B' },
          meta: {
            ...b.meta,
            freshness: { ...b.meta.freshness, snapshot_iso: '2026-06-26T14:09:00Z' },
          },
        };
      },
    });
    await tick(60_000);
    expect(within(panel()).getByTestId('decision-degraded')).toHaveTextContent('newer snapshot');
    expect(within(panel()).getByText(REC_BODY)).toBeInTheDocument(); // untouched
    expect(be.calls.rec).toBe(recCallsAtProduce); // NEVER re-ran without a user action
    // AC-31 — a newer bundle never re-derives or upgrades a grounding state: still byte-identical.
    expect(within(panel()).getByTestId('grounding-card-line').textContent).toBe(cardLineBefore);
    expect(within(analysis).getByTestId('clause-stop').textContent).toBe(clauseBefore);
  });
});

// =================================================================================================
// 5. ADVICE, NEVER A COMMAND — the Accept seam
// =================================================================================================
describe('ai-rec · advice behind Accept', () => {
  it('next-read persona changes do not request or relabel the pinned read', async () => {
    const be = installBackend({});
    const user = renderApp();
    await settle();
    const select = within(panel()).getByLabelText('Next read persona');
    await user.click(select);
    const options = await screen.findAllByRole('option');
    if (options.length > 1) await user.click(options[1]);
    else await user.keyboard('{Escape}');
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
    const calls = be.calls.rec;
    await user.click(select);
    const afterOptions = await screen.findAllByRole('option');
    if (afterOptions.length > 1) await user.click(afterOptions[0]);
    else await user.keyboard('{Escape}');
    expect(be.calls.rec).toBe(calls);
    expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
    expect(before).toContain('Persona ·');
    expect(before).toContain('As of');
  });

  it('review cancel preserves the pinned card and writes no position', async () => {
    const orderRec = recAllTraced();
    orderRec.strategy!.expiration = '2026-09-18';
    const be = installBackend({ rec: orderRec });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    expectPinnedActionsUnchanged(be);
    const pinnedCard = within(panel()).getByTestId('ai-rec-decision-card');
    const before = pinnedCardSnapshot(pinnedCard);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.reviewTrade }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(allPositions()).toHaveLength(0);
    expect(pinnedCardSnapshot(within(panel()).getByTestId('ai-rec-decision-card'))).toEqual(before);
    expectPinnedActionsUnchanged(be);
  });

  it('review confirmation writes exactly one position and keeps the pinned read', async () => {
    const orderRec = recAllTraced();
    const be = installBackend({ rec: orderRec });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    const pinnedCard = within(panel()).getByTestId('ai-rec-decision-card');
    expectPinnedActionsUnchanged(be);
    const before = pinnedCardSnapshot(pinnedCard);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.reviewTrade }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Manual price' }));
    await user.type(within(dialog).getByLabelText('Manual price'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(allPositions()).toHaveLength(1));
    expect(pinnedCardSnapshot(within(panel()).getByTestId('ai-rec-decision-card'))).toEqual(before);
    expectPinnedActionsUnchanged(be);
  });

  it('create-order cancel preserves the pinned read and writes no order', async () => {
    const orderRec = recAllTraced();
    const be = installBackend({ rec: orderRec });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    const pinnedCard = within(panel()).getByTestId('ai-rec-decision-card');
    expect(be.calls.rec).toBe(1);
    const before = pinnedCardSnapshot(pinnedCard);
    const action = within(panel()).getByRole('button', { name: COPY.action.createOrder });
    await user.click(action);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Simulated order/);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(allOrders()).toHaveLength(0);
    expect(pinnedCardSnapshot(within(panel()).getByTestId('ai-rec-decision-card'))).toEqual(before);
    expectPinnedActionsUnchanged(be);
  });

  it('create-order confirmation writes exactly one simulated order and keeps the pinned read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    try {
      const orderRec = recAllTraced();
      const be = installBackend({ rec: orderRec });
      const user = renderApp();
      await settle();
      await ask(user);
      await within(panel()).findByTestId('ai-rec-decision-card');
      const pinnedCard = within(panel()).getByTestId('ai-rec-decision-card');
      expectPinnedActionsUnchanged(be);
      const before = pinnedCardSnapshot(pinnedCard);
      const action = within(panel()).getByRole('button', { name: COPY.action.createOrder });
      await user.click(action);
      const dialog = await screen.findByRole('dialog');
      const confirm = within(dialog).getByRole('button', { name: 'Place simulated order' });
      expect(confirm).toBeEnabled();
      await user.click(confirm);
      await waitFor(() => expect(allOrders()).toHaveLength(1));
      expect(pinnedCardSnapshot(within(panel()).getByTestId('ai-rec-decision-card'))).toEqual(
        before,
      );
      expectPinnedActionsUnchanged(be);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Unit — the Accept→prefill handoff object (the dialog's INTERNALS have their own risk spec;
// what this widget owns is the exact mapping it hands over).
describe('ai-rec · recToPrefill (the handoff object)', () => {
  // A fully-traced grounding block — used wherever a test wants the shipped `main` seeding behavior
  // without exercising the AC-7 gate itself.
  const allTraced = () => recAllTraced().grounding;

  it('maps a produced trade rec to the exact editable seed — with NO qty field (AC-79, ship-blocking)', () => {
    const pf = recToPrefill(tradeStrategy(), 'Income Keeper', 'sizing note', allTraced());
    expect(pf).toEqual({
      expiration: '2026-07-18',
      strike: 260,
      right: 'call',
      stop: 6,
      target: 12.5,
      stopWithheldReason: null,
      targetWithheldReason: null,
      // rec-absence-literals-hole (AC-13) — a fully-named rec carries NO reason line.
      contractWithheldReason: null,
      provenance: 'Pre-filled from AI read · Income Keeper',
      sizingNote: 'sizing note',
      sizeText: '2 contracts',
    });
    expect(Object.prototype.hasOwnProperty.call(pf, 'qty')).toBe(false);
  });

  it('hands over NOTHING for a no_trade rec', () => {
    expect(
      recToPrefill(
        tradeStrategy({ decision: 'no_trade' }),
        'Default (no persona)',
        's',
        allTraced(),
      ),
    ).toBeNull();
  });

  it('AC-80 — a rec with no size text at all yields `size not suggested`, distinct from `not set`', () => {
    const pf = recToPrefill(
      tradeStrategy({ position_size: null }),
      'Default (no persona)',
      's',
      allTraced(),
    );
    expect(pf?.sizeText).toBe('size not suggested');
  });

  // -----------------------------------------------------------------------------------------------
  // ai-rec-grounding — AC-7 (SB): the gated prefill
  // -----------------------------------------------------------------------------------------------
  // A stop/target seeds only when TRACED; every other arm withholds it and says why, and a missing
  // grounding block carries its OWN reason, never the `not_checkable` literal (D8).
  it.each([
    {
      arm: 'traced seeds exactly as on `main`',
      makeRec: recAllTraced,
      seeds: true,
      reason: null as string | null,
      distinctFrom: null as string | null,
    },
    {
      arm: 'untraced does not seed, and says why',
      makeRec: recFabricated,
      seeds: false,
      reason: PREFILL_WITHHELD.untraced,
      distinctFrom: null,
    },
    {
      arm: 'not_checkable does not seed, and says why',
      makeRec: recCouldNotCheck,
      seeds: false,
      reason: PREFILL_WITHHELD.not_checkable,
      distinctFrom: null,
    },
    {
      arm: 'no grounding block never licences a pre-fill, and carries its OWN reason (D8)',
      makeRec: recBlockAbsent, // states real stop/target figures — see fixtures.ts
      seeds: false,
      reason: PREFILL_WITHHELD.block_absent,
      distinctFrom: PREFILL_WITHHELD.not_checkable,
    },
  ])(
    'AC-7 (SB) — the stop/target prefill is gated on grounding: $arm',
    ({ makeRec, seeds, reason, distinctFrom }) => {
      const rec = makeRec();
      const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding)!;
      expect(pf.stop).toBe(seeds ? rec.strategy!.exit_plan.stop : null);
      expect(pf.target).toBe(seeds ? rec.strategy!.exit_plan.target : null);
      expect(pf.stopWithheldReason).toBe(reason);
      expect(pf.targetWithheldReason).toBe(reason);
      if (distinctFrom) expect(pf.stopWithheldReason).not.toBe(distinctFrom);
    },
  );

  it('AC-7 (SB) — nothing else acquires a value derived from a withheld figure', () => {
    const rec = recFabricated();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding)!;
    // The shipped AC-79 rule still holds: there is no `qty` on the prefill at all.
    expect('qty' in pf).toBe(false);
    // strike / expiration come from the rec's OWN contract identity, not from stop/target.
    expect(pf.strike).toBe(rec.strategy!.strikes[0]);
    expect(pf.expiration).toBe(rec.strategy!.expiration);
  });
});

// =================================================================================================
// 6. WRITE-ONLY KEY — the raw key rides the PUT body once and never re-enters the DOM
// =================================================================================================
describe('byo key · write-only (Settings)', () => {
  it('a save transport fault surfaces an error WITHOUT echoing the key', async () => {
    installBackend({ aiKey: { put: 'transport' } });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-empty');
    await user.type(screen.getByTestId('settings-ai-key-input'), RAW_KEY);
    await user.click(screen.getByTestId('settings-ai-key-add'));
    const err = await screen.findByTestId('settings-ai-key-error');
    expect(err.textContent ?? '').not.toContain(RAW_KEY);
    expect(document.body.textContent ?? '').not.toContain(RAW_KEY);
  });
});

// =================================================================================================
// 7. tradeable-rec-inputs — the provenance chip (F7)
// =================================================================================================
describe('tradeable-rec-inputs · the provenance chip renders the entered values verbatim (AC-61)', () => {
  it('shows the account size and cap exactly as sent, with no client-side arithmetic', async () => {
    installBackend({ rec: tradeRecEqualToCap() });
    const user = renderApp();
    await settle();
    await ask(user);
    const chip = await within(panel()).findByTestId('ai-rec-provenance-chip');
    expect(chip).toHaveTextContent('50,000');
    expect(chip).toHaveTextContent('1');
  });
});

// =================================================================================================
// GATE Q correction — AC-3 / AC-8 / AC-62 / AC-64 (bounced back with production consumers missing)
// =================================================================================================

describe('tradeable-rec-inputs · AC-64 — the superseded-inputs strip fires on a changed risk block', () => {
  it('renders the shipped stale-strip treatment (info, not warning+icon) with Get a fresh recommendation, when the CURRENTLY stored block differs from what was sent', async () => {
    const sentRiskInputs = tradeRecEqualToCap().sent!.risk_inputs;
    installBackend({
      rec: tradeRecEqualToCap(),
      // The owner edited the risk block AFTER this rec was produced.
      riskInputs: { ...sentRiskInputs, account_size: 75000 },
    });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(`Trade · ${tradeRecEqualToCap().strategy!.bias}`);
    const strip = await within(panel()).findByTestId('decision-degraded');
    expect(strip).toHaveTextContent('changed after this read');
    expect(within(panel()).getByRole('button', { name: COPY.action.refresh })).toBeInTheDocument();
    // AC-31 (second half) — editing the risk inputs afterwards shows the shipped superseded-inputs
    // strip, but the grounding surface itself is UNCHANGED: still the pinned `all_traced` line, no
    // "changed"/re-derived grounding state anywhere.
    expect(within(panel()).getByTestId('grounding-card-line')).toHaveTextContent(
      'Every checked figure traces to a Convexa number.',
    );
  });
});
