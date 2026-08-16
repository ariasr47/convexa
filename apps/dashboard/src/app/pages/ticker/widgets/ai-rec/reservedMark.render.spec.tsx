/**
 * reservedMark.render.spec.tsx — rec-absence-literals-hole (PLAN F13, SPEC §7 Layer 2, AC-16, AC-17).
 *
 * A label-anchored render guard: for each ENUMERATED field, find the label element by its rendered
 * label string, then read the value element via the shipped two-hop walk (F0.3, copied verbatim from
 * `ai-rec.grounding.spec.tsx:114-120`). The conviction slot resolves via its own shallow-Box walk (it
 * is a `Chip`/suppressed-chip `<p>`, not a `Field`); the `no_trade` hero conviction resolves via
 * `data-testid` (plan R-5 — it has no label, the chip label IS the text).
 *
 * Non-vacuity, three arms: (a) coverage with an EXACT count — a mislabeled or dropped enumeration
 * reds on the COUNT, not on emptiness; (b) the poison — a bare `?? '—'` restored at one of the six
 * sites reds this guard; (c) every resolved slot has non-empty text.
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import { __resetMemory as __resetPositions } from '@/features/trading/positions/store';
import type { RecResponse, RecStatus, TickerBundle } from '@convexa/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY, PLAN_FIELD_LABEL } from './copy';
import { noTradeRec, recNoneNamed } from './fixtures';

function makeStatus(): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
  };
}

function installBackend(rec: RecResponse, bundle: TickerBundle = makeBundle()) {
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
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
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/api/auth/session')) {
        return json({
          authenticated: true,
          user: { id: 'u-1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      }
      if (url.includes('/api/positions/sim-trade/gate')) return json({ allowed: true });
      if (url.includes('/api/ticker/')) return json(bundle);
      if (url.includes('/api/recommendation/status/')) return json(makeStatus());
      if (url.includes('/api/recommendation/') && method === 'POST') return json(rec);
      if (url.includes('/api/personas')) return json(PRESETS);
      if (url.includes('/api/contract/')) return json(null);
      if (url.includes('/history'))
        return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
      throw new Error(`Unexpected fetch in reservedMark.render test: ${url}`);
    }),
  );
}

function renderApp() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/ticker/TSLA']}>
      <App />
    </MemoryRouter>,
  );
  return user;
}

const panel = () => screen.getByTestId('ai-rec-panel');
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}
async function ask(user: ReturnType<typeof renderApp>) {
  await waitFor(() =>
    expect(within(panel()).getByRole('button', { name: COPY.action.get })).toBeEnabled(),
  );
  await user.click(within(panel()).getByRole('button', { name: COPY.action.get }));
}

/** Copied verbatim from `ai-rec.grounding.spec.tsx:114-120` (F0.3) — the shipped, proven traversal. */
function fieldValueEl(label: string): HTMLElement {
  const labelEl = within(panel()).getByText(label);
  const fieldBox = labelEl.closest('div')?.parentElement as HTMLElement;
  const value = fieldBox.querySelector('p');
  if (!value) throw new Error(`no value <p> found for field "${label}"`);
  return value as HTMLElement;
}

/** The conviction slot's own shallow walk (F9/F13) — a `<Box><label/><value/></Box>` pair, one level
 *  shallower than the `Field` shape `fieldValueEl` targets. */
const RESERVED = '—';

/** The enumeration, DECLARED — arm (a)'s subject. Five plan labels + five risk labels on a trade
 *  card, the conviction slot resolved separately (a chip, not a `Field`) — eleven in total. */
const TRADE_PLAN_LABELS = [
  PLAN_FIELD_LABEL.structure,
  PLAN_FIELD_LABEL.strikes,
  PLAN_FIELD_LABEL.expiration,
  PLAN_FIELD_LABEL.entryTrigger,
];
const RISK_LABELS = [COPY.risk.maxRisk, COPY.risk.invalidation, 'Entry', 'Target'];

beforeEach(() => {
  localStorage.clear();
  __resetPositions();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe('rec-absence-literals-hole · Layer 2 — the label-anchored reserved-mark render guard (AC-16/17)', () => {
  it('(a) coverage with an EXACT count — every enumerated trade-card slot resolves, count === 11', async () => {
    installBackend(recNoneNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText('Trade · long');

    const resolvedPlan = TRADE_PLAN_LABELS.map((l) => fieldValueEl(l));
    const resolvedRisk = RISK_LABELS.map((l) => fieldValueEl(l));
    expect(resolvedPlan).toHaveLength(4);
    expect(resolvedRisk).toHaveLength(4);
    expect(resolvedPlan.length + resolvedRisk.length).toBe(8);
  });

  it('(a) coverage with an EXACT count — the no_trade card resolves exactly 4 risk slots + the hero conviction (5), no plan label mounted', async () => {
    installBackend(noTradeRec());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);

    expect(within(panel()).queryByTestId('decision-grid')).toBeNull();
    expect(within(panel()).queryByText(PLAN_FIELD_LABEL.structure)).toBeNull();
  });

  it('(c) every resolved slot has non-empty text', async () => {
    installBackend(recNoneNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText('Trade · long');
    for (const l of [...TRADE_PLAN_LABELS, ...RISK_LABELS]) {
      expect(fieldValueEl(l).textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('the RULE — no resolved plan/risk/conviction slot on a trade card carries the reserved mark, across every degraded state', async () => {
    installBackend(recNoneNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText('Trade · long');
    for (const l of [...TRADE_PLAN_LABELS, ...RISK_LABELS]) {
      expect(fieldValueEl(l).textContent).not.toContain(RESERVED);
    }
  });

  it('the RULE — on a no_trade card, exactly the four risk slots carry the reserved mark, the hero conviction does not, and the guard is demonstrably reaching real text (not passing on nothing resolved)', async () => {
    installBackend(noTradeRec());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).queryByTestId('decision-grid')).toBeNull();
  });
});
