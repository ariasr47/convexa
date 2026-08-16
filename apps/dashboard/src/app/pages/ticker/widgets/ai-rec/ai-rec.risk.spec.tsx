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
 *      poisoned with all of them armed). The manual export floor stays anonymous-usable.
 *   3. The ALWAYS-200 STATUS MACHINE — each of the 5 key-resolution outcomes + gated_off/cap/
 *      no-fresh-edge/transport offers its DISTINCT action affordance, and the rec surface degrades
 *      ALONE (bundle tiles keep rendering in every state).
 *   4. STATIC ARTIFACT — the rec is pinned to its snapshot: an SSE drop leaves it untouched, a newer
 *      bundle only marks it stale (content byte-stable, NO silent re-run — asserted on the mock's
 *      POST count, by construction).
 *   5. ADVICE, NEVER A COMMAND — no_trade has no Accept; Accept opens the shared dialog with nothing
 *      tracked until confirm; the Accept→prefill handoff object is unit-proven (the dialog's
 *      internals belong to its own risk spec).
 *   6. WRITE-ONLY KEY — the raw key rides ONLY the PUT body; it never re-enters the DOM (masked
 *      last-4 only) across add/replace/remove/error; every response the FE receives is scanned.
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
import { maskedKeyLabel } from '@/features/auth/copy';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import {
  __resetMemory as __resetPositions,
  allPositions,
} from '@/features/trading/positions/store';
import { __resetOrdersMemory, allOrders } from '@/features/trading/orders/store';
import type { RecResponse, RecStatus, RecStrategy, RiskInputs, TickerBundle } from '@convexa/api';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY, EXPORT_HEADER, PREFILL_WITHHELD, RISK_FIELD_COPY } from './copy';
import {
  noTradeRec as fixtureNoTradeRec,
  recAllTraced,
  recBlockAbsent,
  recCouldNotCheck,
  recFabricated,
  tradeRecEqualToCap,
  tradeRecNoRiskBlock,
  tradeRecOverCap,
} from './fixtures';
import { biasToRight, recToPrefill } from './prefill';

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

const producedOwn = () => producedRec({ key_source: 'own_key' });
const producedShared = (remaining = 2, total = 3) =>
  producedRec({
    key_source: 'shared_admin',
    remaining_free_uses: remaining,
    free_uses_total: total,
  });
const recUnavailable = (
  reason: 'no_key' | 'over_limit' | 'shared_key_unconfigured',
  extra: Partial<RecResponse> = {},
) =>
  producedRec({
    status: 'unavailable',
    strategy: null,
    unavailable_reason: reason,
    key_source: 'none',
    ...extra,
  });
const noTradeRec = () =>
  producedRec({
    strategy: tradeStrategy({
      decision: 'no_trade',
      bias: 'neutral',
      structure: null,
      strikes: [],
      expiration: null,
      entry_trigger: null,
      invalidation_level: null,
      max_risk: null,
      position_size: null,
      exit_plan: { target: null, stop: null },
      time_horizon: null,
      confidence: null,
      rationale: 'No clean edge — price is mid-range between the walls.',
    }),
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
  };
  /** tradeable-rec-inputs AC-64 — the CURRENTLY stored risk block, echoed on the who-am-I settings
   *  read, so a test can diverge it from a produced rec's `sent.risk_inputs` and observe the
   *  superseded-inputs strip. Omitted ⇒ no `risk_inputs` key at all (matches the shipped shape). */
  riskInputs?: RiskInputs;
  /** Optional flow-test seam: hold the second recommendation response until the test settles it. */
  secondRecDeferred?: Promise<RecResponse>;
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
    },
    riskInputs: cfg.riskInputs,
    secondRecDeferred: cfg.secondRecDeferred,
  };
  const calls = { ticker: 0, status: 0, rec: 0, export: 0, personas: 0, aiKeyPut: 0 };
  const recPostBodies: string[] = [];
  const aiKeyPutBodies: string[] = [];
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
      // byo-ai-key credential endpoints — the ONLY channel the raw key ever rides (browser→server).
      if (url.includes('/api/auth/ai-key')) {
        if (!state.authenticated) return json({ error: 'auth_required', message: 'sign in' }, 403);
        if (method === 'GET') {
          return json({
            set: state.aiKey.set,
            last4: state.aiKey.set ? state.aiKey.last4 : null,
            storage_available: state.aiKey.storage_available,
          });
        }
        if (method === 'PUT') {
          calls.aiKeyPut++;
          aiKeyPutBodies.push(String(init?.body ?? ''));
          if (state.aiKey.put === 'transport') return new Response('', { status: 502 });
          const parsed = init?.body ? (JSON.parse(String(init.body)) as { key?: string }) : {};
          state.aiKey.set = true;
          state.aiKey.last4 = (parsed.key ?? '').slice(-4);
          return json({ set: true, last4: state.aiKey.last4, storage_available: true });
        }
        if (method === 'DELETE') {
          state.aiKey.set = false;
          state.aiKey.last4 = null;
          return json({
            set: false,
            last4: null,
            storage_available: state.aiKey.storage_available,
          });
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
        if (calls.rec === 2 && state.secondRecDeferred) {
          return json(await state.secondRecDeferred);
        }
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
  render(
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

beforeEach(() => {
  localStorage.clear();
  __resetPositions(); // the ONE book — the ghost-trade store has no writer any more
  __resetOrdersMemory();
});
afterEach(() => {
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
    const strip = screen.getByText('Levels in play').parentElement as HTMLElement;
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
      'ai-rec-state-admin-exhausted',
      'ai-rec-state-shared-unconfigured',
      'ai-rec-free-uses',
      'ai-rec-own-key',
    ]) {
      expect(within(panel()).queryByTestId(id)).toBeNull();
    }
    expect(be.calls.rec).toBe(0); // the LLM was never invoked
  });

  it('the manual export floor stays anonymous-usable (no auth gate, no rec call, no key in the payload)', async () => {
    const be = installBackend({ authenticated: false });
    const user = renderApp();
    await settle();
    await user.click(within(panel()).getAllByRole('button', { name: COPY.action.viewExport })[0]);
    expect(await screen.findByText(EXPORT_HEADER('TSLA'))).toBeInTheDocument();
    expect(be.calls.export).toBe(1);
    expect(be.calls.rec).toBe(0);
    // Egress scan: no response the export path produced carries a key field.
    be.responsesSeen.forEach((b) => expect(b).not.toMatch(/"(key|api_key|ciphertext)"\s*:/));
  });
});

// =================================================================================================
// 3. The ALWAYS-200 STATUS MACHINE — one distinct affordance per state; the surface degrades alone
// =================================================================================================
describe('ai-rec · key-resolution machine (distinct affordance per state)', () => {
  // The parameterized 5-state matrix: what matters is WHICH affordance each state offers (the
  // add-key path vs the Accept path vs a chip), not its wording — and that the page renders on.
  const CTA_IDS = [
    'ai-rec-state-no-key',
    'ai-rec-state-admin-exhausted',
    'ai-rec-state-shared-unconfigured',
  ] as const;
  it.each([
    {
      name: 'regular user, no key (a) → the add-key path',
      rec: recUnavailable('no_key'),
      cta: 'ai-rec-state-no-key',
      chip: null,
    },
    {
      name: 'admin exhausted (c) → the add-key path',
      rec: recUnavailable('over_limit', { remaining_free_uses: 0, free_uses_total: 3 }),
      cta: 'ai-rec-state-admin-exhausted',
      chip: null,
    },
    {
      name: 'admin, shared key unconfigured (e) → the add-key path',
      rec: recUnavailable('shared_key_unconfigured'),
      cta: 'ai-rec-state-shared-unconfigured',
      chip: null,
    },
    {
      name: 'own key (d) → a produced rec + Accept, own-key chip, NO counter',
      rec: producedOwn(),
      cta: null,
      chip: 'ai-rec-own-key',
    },
    {
      name: 'admin with allowance (b) → a produced rec + Accept, the free-uses counter',
      rec: producedShared(2, 3),
      cta: null,
      chip: 'ai-rec-free-uses',
    },
  ])('$name', async ({ rec, cta, chip }) => {
    installBackend({ rec });
    const user = renderApp();
    await settle();
    await ask(user);

    if (cta) {
      // Degraded key states: the ONE offered affordance is the add-key→Settings CTA; no rec body.
      const block = await within(panel()).findByTestId(cta);
      expect(within(block).getByTestId('ai-rec-add-key-cta')).toBeEnabled();
      expect(within(panel()).queryByText(REC_BODY)).toBeNull();
      expect(within(panel()).queryByRole('button', { name: COPY.action.accept })).toBeNull();
    } else {
      // Produced states: the offered affordance is Accept; the provenance chip matches the source.
      await within(panel()).findByText(REC_BODY);
      expect(within(panel()).getByRole('button', { name: COPY.action.accept })).toBeEnabled();
      expect(within(panel()).getByTestId(chip as string)).toBeInTheDocument();
    }
    // The states are mutually exclusive: no OTHER state's block/chip is in the DOM.
    for (const id of CTA_IDS) if (id !== cta) expect(within(panel()).queryByTestId(id)).toBeNull();
    for (const c of ['ai-rec-own-key', 'ai-rec-free-uses'])
      if (c !== chip) expect(within(panel()).queryByTestId(c)).toBeNull();
    // best-effort-isolated: the rec surface degrades ALONE — the bundle tiles keep rendering.
    expect(screen.getByText('Call wall')).toBeInTheDocument();
  });

  it('gated_off (in-app disabled): the ask affordance is inert; the export floor is offered instead', async () => {
    const be = installBackend({ status: makeStatus({ availability: { in_app_enabled: false } }) });
    const user = renderApp();
    await settle();
    await waitFor(() =>
      expect(within(panel()).getByRole('button', { name: COPY.action.get })).toBeDisabled(),
    );
    await user.click(within(panel()).getAllByRole('button', { name: COPY.action.viewExport })[0]);
    expect(await screen.findByText(EXPORT_HEADER('TSLA'))).toBeInTheDocument();
    expect(be.calls.rec).toBe(0);
    expect(screen.getByText('Call wall')).toBeInTheDocument();
  });

  it('daily cap: a calm disabled affordance; the export floor still works without a rec call', async () => {
    const be = installBackend({
      status: makeStatus({
        cap: { over_limit: true, remaining_today: 0, resets_at: '2026-06-27T04:00:00Z' },
      }),
    });
    const user = renderApp();
    await settle();
    expect(
      await within(panel()).findByRole('button', { name: /Daily AI limit reached/ }),
    ).toBeDisabled();
    await user.click(within(panel()).getAllByRole('button', { name: COPY.action.viewExport })[0]);
    expect(await screen.findByText(EXPORT_HEADER('TSLA'))).toBeInTheDocument();
    expect(be.calls.rec).toBe(0);
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

  it('personas endpoint down: the panel degrades to the embedded presets and still produces a rec', async () => {
    const be = installBackend({ personas: 'throw' });
    const user = renderApp();
    await settle();
    // The read-persona select is still populated from the FE embed…
    await user.click(panel().querySelector('.MuiSelect-select') as HTMLElement);
    expect(await screen.findByRole('option', { name: 'Income Keeper' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // …and the feature still works end-to-end.
    await ask(user);
    expect(await within(panel()).findByText(REC_BODY)).toBeInTheDocument();
    expect(be.calls.personas).toBe(1);
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
    const clauseBefore = within(panel()).getByTestId('clause-stop').textContent;
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
    expect(within(panel()).getByTestId('clause-stop').textContent).toBe(clauseBefore);
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
    expect(within(panel()).getByText(COPY.stale.chip)).toBeInTheDocument();
    expect(within(panel()).getByText(REC_BODY)).toBeInTheDocument(); // untouched
    expect(be.calls.rec).toBe(recCallsAtProduce); // NEVER re-ran without a user action
    // AC-31 — a newer bundle never re-derives or upgrades a grounding state: still byte-identical.
    expect(within(panel()).getByTestId('grounding-card-line').textContent).toBe(cardLineBefore);
    expect(within(panel()).getByTestId('clause-stop').textContent).toBe(clauseBefore);
  });

  it('retains only direct export while a refreshed recommendation is pending', async () => {
    vi.useRealTimers();
    let resolveSecond!: (rec: RecResponse) => void;
    let rejectSecond!: (reason?: unknown) => void;
    const secondRec = new Promise<RecResponse>((resolve, reject) => {
      resolveSecond = resolve;
      rejectSecond = reject;
    });
    const be = installBackend({ rec: producedRec({ stale_born: true }), secondRecDeferred: secondRec });
    try {
      const user = renderApp();
      await settle();
      await ask(user);
      await within(panel()).findByTestId('ai-rec-decision-card');
      expect(be.calls.rec).toBe(1);
      const refresh = within(panel()).getByRole('button', { name: COPY.action.refresh });
      await user.click(refresh);

      expect(be.calls.rec).toBe(2); // exactly one explicit refresh POST
      expect(within(panel()).getByRole('button', { name: COPY.action.viewExport })).toBeInTheDocument();
      expect(within(panel()).queryByTestId('ai-rec-decision-card')).toBeNull();
      expect(within(panel()).queryByRole('button', { name: COPY.action.reviewTrade })).toBeNull();
      expect(within(panel()).queryByRole('button', { name: COPY.action.createOrder })).toBeNull();
      expect(within(panel()).queryByRole('button', { name: COPY.action.analysis })).toBeNull();
      expect(within(panel()).queryByText(REC_BODY)).toBeNull(); // old pinned response is not actionable

      resolveSecond(producedRec({ strategy: tradeStrategy({ max_risk: '2% of account ($400)' }) }));
      await within(panel()).findByTestId('ai-rec-decision-card');
      expect(be.calls.rec).toBe(2);
    } finally {
      // Settle the controllable request even if an assertion above fails, so the test cannot hang.
      resolveSecond(producedRec());
      rejectSecond(new Error('retained-loading cleanup'));
    }
  });

  it('cooldown disables the ask affordance and re-enables when it elapses', async () => {
    installBackend({
      rec: producedRec({
        gate: { state: 'cooling_down', cooldown_remaining_seconds: 3, reasons: [] },
      }),
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
    expect(
      within(panel())
        .getByText(/Cooling down · 3s/)
        .closest('button'),
    ).toBeDisabled();
    await tick(3000);
    expect(recoButton()).toBeEnabled();
  });
});

describe('ai-rec · honest provenance', () => {
  it('a stale-born rec carries its at-birth warning (distinct from the newer-bundle stale marker)', async () => {
    installBackend({ rec: producedRec({ stale_born: true }) });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(REC_BODY);
    expect(within(panel()).getByText(/already marked stale/)).toBeInTheDocument();
    expect(within(panel()).queryByText(COPY.stale.chip)).toBeNull();
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
    if (options.length > 1) await user.click(options[1]); else await user.keyboard('{Escape}');
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
    const calls = be.calls.rec;
    await user.click(select);
    const afterOptions = await screen.findAllByRole('option');
    if (afterOptions.length > 1) await user.click(afterOptions[0]); else await user.keyboard('{Escape}');
    expect(be.calls.rec).toBe(calls);
    expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
    expect(before).toContain('Persona ·');
    expect(before).toContain('As of');
  });

  it('no_trade is a complete answer with NO Accept affordance', async () => {
    installBackend({ rec: noTradeRec() });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).queryByRole('button', { name: COPY.action.accept })).toBeNull();
  });

  it('Accept opens the shared entry dialog — NOTHING is tracked until the user confirms there', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(REC_BODY);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(allPositions()).toEqual([]); // advice, not a command
  });

  it('review cancel preserves the pinned card and writes no position', async () => {
    const orderRec = recAllTraced();
    orderRec.strategy!.expiration = '2026-09-18';
    installBackend({ rec: orderRec });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
    await user.click(within(panel()).getByRole('button', { name: COPY.action.reviewTrade }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(allPositions()).toHaveLength(0);
    expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
  });

  it('review confirmation writes exactly one position and keeps the pinned read', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByTestId('ai-rec-decision-card');
    const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
    await user.click(within(panel()).getByRole('button', { name: COPY.action.reviewTrade }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Manual price' }));
    await user.type(within(dialog).getByLabelText('Manual price'), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Open simulated position' }));
    await waitFor(() => expect(allPositions()).toHaveLength(1));
    expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
  });

  it('create-order cancel preserves the pinned read and writes no order', async () => {
    installBackend({});
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(REC_BODY);
    const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
    const action = within(panel()).queryByRole('button', { name: COPY.action.createOrder });
    if (!action) return;
    await user.click(action);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Simulated order/);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(allOrders()).toHaveLength(0);
    expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
  });

  it('create-order confirmation writes exactly one simulated order and keeps the pinned read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    try {
      installBackend({});
      const user = renderApp();
      await settle();
      await ask(user);
      await within(panel()).findByText(REC_BODY);
      const before = within(panel()).getByTestId('ai-rec-decision-card').textContent;
      const action = within(panel()).getByRole('button', { name: COPY.action.createOrder });
      await user.click(action);
      const dialog = await screen.findByRole('dialog');
      const confirm = within(dialog).getByRole('button', { name: 'Place simulated order' });
      expect(confirm).toBeEnabled();
      await user.click(confirm);
      await waitFor(() => expect(allOrders()).toHaveLength(1));
      expect(within(panel()).getByTestId('ai-rec-decision-card').textContent).toBe(before);
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

  it('derives the right from structure first, bias as fallback when structure IS stated but names neither word', () => {
    expect(biasToRight({ structure: 'put credit spread', bias: 'long' })).toBe('put');
    expect(biasToRight({ structure: 'iron condor', bias: 'short' })).toBe('put');
    expect(biasToRight({ structure: 'iron condor', bias: 'neutral' })).toBe('call');
  });

  // rec-absence-literals-hole (AC-12c) — a NEVER-NAMED structure derives NO direction, even when a
  // bias is stated: the bias fallback above fires only once structure is confirmed present. Updated
  // from the pre-feature assertion that `structure: null` derived a direction from `bias` alone —
  // that is exactly the fabricated-direction defect this feature closes.
  it('AC-12c — an unnamed structure derives NOTHING, regardless of bias', () => {
    expect(biasToRight({ structure: null, bias: 'short' })).toBeNull();
    expect(biasToRight({ structure: null, bias: 'neutral' })).toBeNull();
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

  it('AC-81 — a size string naming no whole number of contracts is carried verbatim', () => {
    const pf = recToPrefill(
      tradeStrategy({ position_size: 'small (rule-based local rec; not LLM)' }),
      'Default (no persona)',
      's',
      allTraced(),
    );
    expect(pf?.sizeText).toBe('small (rule-based local rec; not LLM)');
  });

  // -----------------------------------------------------------------------------------------------
  // ai-rec-grounding — AC-7 (SB): the gated prefill
  // -----------------------------------------------------------------------------------------------
  it('AC-7 (SB) — a TRACED stop/target seeds exactly as on `main`', () => {
    const rec = recAllTraced();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.stop).toBe(rec.strategy!.exit_plan.stop);
    expect(pf!.target).toBe(rec.strategy!.exit_plan.target);
    expect(pf!.stopWithheldReason).toBeNull();
    expect(pf!.targetWithheldReason).toBeNull();
  });

  it('AC-7 (SB) — an UNTRACED stop does not seed, and says why', () => {
    const rec = recFabricated();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.stop).toBeNull();
    expect(pf!.stopWithheldReason).toBe(PREFILL_WITHHELD.untraced);
  });

  it('AC-7 (SB) — a NOT_CHECKABLE target does not seed, and says why', () => {
    const rec = recCouldNotCheck();
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.target).toBeNull();
    expect(pf!.targetWithheldReason).toBe(PREFILL_WITHHELD.not_checkable);
  });

  it('AC-7 (SB) + D8 — NO grounding block never licences a pre-fill, and carries its OWN reason', () => {
    const rec = recBlockAbsent(); // states real stop/target figures — see fixtures.ts
    const pf = recToPrefill(rec.strategy!, 'Default (no persona)', 's', rec.grounding);
    expect(pf!.stop).toBeNull();
    expect(pf!.target).toBeNull();
    expect(pf!.stopWithheldReason).toBe(PREFILL_WITHHELD.block_absent);
    expect(pf!.targetWithheldReason).toBe(PREFILL_WITHHELD.block_absent);
    // Never the `not_checkable` literal — that would be the `absent-is-not-none` collapse.
    expect(pf!.stopWithheldReason).not.toBe(PREFILL_WITHHELD.not_checkable);
  });

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
  it('add: the raw key rides ONLY the PUT body; the DOM shows the masked hint and never the key', async () => {
    const be = installBackend({});
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-empty');
    await user.type(screen.getByTestId('settings-ai-key-input'), RAW_KEY);
    await user.click(screen.getByTestId('settings-ai-key-add'));

    expect(await screen.findByTestId('settings-ai-key-masked')).toHaveTextContent(
      maskedKeyLabel('1234'),
    );
    // The raw key left the browser exactly once, in the PUT body…
    expect(be.aiKeyPutBodies).toEqual([JSON.stringify({ key: RAW_KEY })]);
    // …and never re-entered: not in the DOM, no reveal control, and no response carried it.
    expect(document.body.textContent ?? '').not.toContain(RAW_KEY);
    expect(screen.queryByText(/show key|reveal|copy key|view key/i)).toBeNull();
    be.responsesSeen
      .filter((b) => b.includes('storage_available'))
      .forEach((b) => {
        const o = JSON.parse(b) as Record<string, unknown>;
        expect(Object.keys(o).every((k) => ['set', 'last4', 'storage_available'].includes(k))).toBe(
          true,
        );
      });
  });

  it('replace then remove: the hint swaps to the NEW last-4, then clears — no raw key ever echoes', async () => {
    const ROTATED = 'sk-ant-rotatedkey5678';
    installBackend({ aiKey: { set: true, last4: '1234' } });
    const user = renderSettings();
    await screen.findByTestId('settings-ai-key-set');

    await user.click(screen.getByTestId('settings-ai-key-replace'));
    await user.type(screen.getByTestId('settings-ai-key-input'), ROTATED);
    await user.click(screen.getByTestId('settings-ai-key-replace-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-ai-key-masked')).toHaveTextContent(
        maskedKeyLabel('5678'),
      ),
    );
    expect(screen.getByTestId('settings-ai-key-masked')).not.toHaveTextContent('1234');
    expect(document.body.textContent ?? '').not.toContain(ROTATED);

    await user.click(screen.getByTestId('settings-ai-key-remove'));
    await user.click(await screen.findByTestId('settings-ai-key-remove-confirm-btn'));
    expect(await screen.findByTestId('settings-ai-key-empty')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain(ROTATED);
  });

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

  it('storage unavailable: a key that cannot be stored cannot be typed (input + save inert)', async () => {
    installBackend({ aiKey: { storage_available: false } });
    renderSettings();
    await screen.findByTestId('settings-ai-key-storage-unavailable');
    expect(screen.getByTestId('settings-ai-key-input')).toBeDisabled();
    expect(screen.getByTestId('settings-ai-key-add')).toBeDisabled();
  });

  it('anonymous: the section offers sign-in, never a key form', async () => {
    installBackend({ authenticated: false });
    renderSettings();
    expect(await screen.findByTestId('settings-ai-key-anonymous')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-key-input')).toBeNull();
  });
});

// =================================================================================================
// 7. tradeable-rec-inputs — the four fields, the cap surface, the provenance chip (F7)
// =================================================================================================
describe('tradeable-rec-inputs · the cap surface never appears on no_trade (AC-58a, ship-blocking)', () => {
  it('renders NO cap-annotation DOM node at all on a no_trade card — with a cap set AND with none', async () => {
    installBackend({ rec: fixtureNoTradeRec() });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).queryByTestId('cap-annotation')).toBeNull();

    // ...and again with no effective cap at all — still nothing renders.
    installBackend({
      rec: {
        ...fixtureNoTradeRec(),
        cap_check: {
          verdict: 'not_applicable',
          effective_dollar_cap: null,
          cap_not_derivable_reason: null,
          parsed_risk_dollars: null,
          model_max_risk_text: null,
          risk_refusal: null,
        },
      },
    });
    cleanup();
    const user2 = renderApp();
    await settle();
    await ask(user2);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).queryByTestId('cap-annotation')).toBeNull();
  });

  it('AC-69/70 (GATE Q correction) — the four-field row RENDERS on a no_trade verdict, `—` shown on all four with the not-applicable tip; never `not set` or `unavailable`', async () => {
    installBackend({ rec: fixtureNoTradeRec() });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    // POSITIVE — the row is present (this is the guard that was vacuous: it must assert the row
    // EXISTS and shows `—`, not merely that the OTHER two literals are absent from an empty card).
    const row = within(panel()).getByTestId('no-trade-four-field-row');
    expect(within(row).getByText(COPY.risk.maxRisk)).toBeInTheDocument();
    expect(within(row).getByText('Suggested size')).toBeInTheDocument();
    expect(within(row).getByText('Target')).toBeInTheDocument();
    expect(within(row).getByText('Stop')).toBeInTheDocument();
    expect(within(row).getAllByText(RISK_FIELD_COPY.dash.text)).toHaveLength(4);
    // NEGATIVE — never `not set` or `unavailable` on a no_trade card.
    expect(within(panel()).queryByText(RISK_FIELD_COPY.notSet.text)).toBeNull();
    expect(within(panel()).queryByText(RISK_FIELD_COPY.unavailable.text)).toBeNull();
  });
});

describe('tradeable-rec-inputs · an over-cap rec stays actionable (AC-59/60)', () => {
  it('renders the warning cap annotation and Accept stays enabled', async () => {
    installBackend({ rec: tradeRecOverCap() });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(`Trade · ${tradeRecOverCap().strategy!.bias}`);
    const annotation = await within(panel()).findByTestId('cap-annotation');
    expect(annotation).toHaveAttribute('data-verdict', 'above');
    expect(within(panel()).getByRole('button', { name: COPY.action.accept })).toBeEnabled();
  });

  it('a figure exactly equal to the cap renders `within` (AC-63)', async () => {
    installBackend({ rec: tradeRecEqualToCap() });
    const user = renderApp();
    await settle();
    await ask(user);
    const annotation = await within(panel()).findByTestId('cap-annotation');
    expect(annotation).toHaveAttribute('data-verdict', 'within');
  });
});

describe('tradeable-rec-inputs · an empty risk block renders `not set` with the action (AC-71)', () => {
  it('max_risk and position_size render `not set` with a `Set your risk inputs` action', async () => {
    installBackend({ rec: tradeRecNoRiskBlock() });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(`Trade · ${tradeRecNoRiskBlock().strategy!.bias}`);
    expect(within(panel()).getAllByText(RISK_FIELD_COPY.notSet.text).length).toBeGreaterThan(0);
    expect(within(panel()).getAllByTestId('risk-field-set-risk-inputs').length).toBeGreaterThan(0);
  });
});

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

describe('tradeable-rec-inputs · AC-8 — the candidate set as-of + session basis render, un-hovered', () => {
  it('the strip carries a freshness line naming the as-of and whether it is live-session or prior-close', async () => {
    installBackend({ rec: tradeRecEqualToCap() });
    const user = renderApp();
    await settle();
    await ask(user);
    const line = await within(panel()).findByTestId('numbers-said-freshness');
    expect(line).toHaveTextContent(tradeRecEqualToCap().sent!.candidates.as_of as string);
    expect(line).toHaveTextContent(/prior close|live session/);
  });

  it('the cited-contract line interpolates the real as-of — never the bare "from the chain snapshot" literal', async () => {
    installBackend({ rec: tradeRecEqualToCap() });
    const user = renderApp();
    await settle();
    await ask(user);
    const cited = await within(panel()).findByTestId('cited-contract-line');
    expect(cited).toHaveTextContent(tradeRecEqualToCap().sent!.candidates.as_of as string);
    expect(cited.textContent ?? '').not.toContain('from the chain snapshot');
  });
});

describe('tradeable-rec-inputs · AC-62 — the max-risk tip attributes the figure to the AI', () => {
  it('carries a tooltip on Max risk when it holds a value', async () => {
    installBackend({ rec: tradeRecEqualToCap() });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.risk.maxRisk);
    // The tip renders via the shared `Field` info-icon affordance beside the label.
    const maxRiskLabel = within(panel()).getByText(COPY.risk.maxRisk);
    const infoIcon = maxRiskLabel.parentElement?.querySelector('svg');
    expect(infoIcon).toBeTruthy();
  });
});

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
    const strip = await within(panel()).findByTestId('ai-rec-superseded-strip');
    expect(strip).toHaveTextContent('changed after this read');
    expect(within(strip).getByRole('button', { name: COPY.action.freshRec })).toBeInTheDocument();
    // AC-31 (second half) — editing the risk inputs afterwards shows the shipped superseded-inputs
    // strip, but the grounding surface itself is UNCHANGED: still the pinned `all_traced` line, no
    // "changed"/re-derived grounding state anywhere.
    expect(within(panel()).getByTestId('grounding-card-line')).toHaveTextContent(
      'Every checked figure traces to a Convexa number.',
    );
  });

  it('renders nothing when the currently stored block still matches what was sent', async () => {
    const sentRiskInputs = tradeRecEqualToCap().sent!.risk_inputs;
    installBackend({ rec: tradeRecEqualToCap(), riskInputs: sentRiskInputs });
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(`Trade · ${tradeRecEqualToCap().strategy!.bias}`);
    expect(within(panel()).queryByTestId('ai-rec-superseded-strip')).toBeNull();
  });
});
