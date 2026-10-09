/**
 * ai-rec-grounding — the card + prefill-gate integration suite (PLAN F10, F17). The prefill gate
 * mounts the real app at `/ticker/TSLA` against a strict fetch mock (throws on any unexpected call);
 * the PAYLOAD FIXTURE is the mock — never a mocked selector, never a mocked lookup. The rendered-text
 * guards (AC-32, AC-34) render `DecisionCard` / `AnalysisSurface` directly with the same props the
 * panel passes them.
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import { __resetMemory as __resetPositions } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import type { RecResponse, RecStatus, TickerBundle } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisSurface } from './AnalysisSurface';
import { COPY } from './copy';
import { DecisionCard } from './DecisionCard';
import { noTradeRec, recAllTraced, recFabricated } from './fixtures';
import { deriveAiRecPresentation } from './presentationPolicy';

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

  const calls = { rec: 0 };
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
      if (url.includes('/api/recommendation/') && method === 'POST') {
        calls.rec++;
        return json(rec);
      }
      if (url.includes('/api/personas')) return json(PRESETS);
      if (url.includes('/api/contract/')) return json(null);
      if (url.includes('/history'))
        return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
      throw new Error(`Unexpected fetch in ai-rec-grounding test: ${url}`);
    }),
  );

  return { calls };
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

/** Direct render of the card with the presentation the real policy derives for `rec`. */
function renderCard(rec: RecResponse, bundle: TickerBundle = makeBundle()) {
  const presentation = deriveAiRecPresentation({
    rec,
    loading: false,
    stale: false,
    signedIn: true,
    canCreateOrder: true,
    inAppEnabled: true,
    cap: makeStatus().cap,
    cooldownRemaining: 0,
    readinessGateState: 'available',
    scenarioSelected: false,
    currentRiskInputs: null,
  });
  return render(
    <ThemeProvider theme={theme}>
      <DecisionCard
        rec={rec}
        bundle={bundle}
        presentation={presentation}
        dataAge="older data"
        onReview={vi.fn()}
        onCreateOrder={vi.fn()}
        onAnalysis={vi.fn()}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />
    </ThemeProvider>,
  );
}

/** Direct render of the open analysis surface; returns its dialog. */
function renderAnalysis(rec: RecResponse, bundle: TickerBundle = makeBundle()): HTMLElement {
  render(
    <ThemeProvider theme={theme}>
      <AnalysisSurface
        open
        ticker="TSLA"
        rec={rec}
        bundle={bundle}
        onClose={vi.fn()}
        onViewExport={vi.fn()}
      />
    </ThemeProvider>,
  );
  return screen.getByRole('dialog', { name: /Full analysis & data/ });
}

beforeEach(() => {
  localStorage.clear();
  __resetPositions();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

// =================================================================================================
// F10 — the card component specs
// =================================================================================================
describe('ai-rec-grounding · the card (F10)', () => {
  it('AC-32 (amended) — no grounding wire token ever renders as user-visible text', () => {
    // DecisionCard only: the analysis surface's as-sent section intentionally prints raw tokens.
    renderCard(recFabricated());
    const card = screen.getByTestId('ai-rec-decision-card');
    expect(
      within(card).getByText(/No figure here traces to a Convexa number\./),
    ).toBeInTheDocument();
    const text = card.textContent ?? '';
    const tokens = [
      'not_applicable',
      'not_checkable',
      'local_rules',
      'none_traced',
      'could_not_check',
      'some_traced',
      'all_traced',
      'inside_range',
      'no_named_level',
      'no_cited_expiration',
      'straddle_move_unavailable',
      'structurally_unchecked',
      'no_text',
      'no_dollar_figure',
      'multiple_different_figures',
      'gex_spot',
      'call_wall',
      'put_wall',
      'peak_gex_strike',
      'gamma_flip',
      'max_pain',
      'vwap_upper_2',
      'vwap_upper_3',
      'vwap_lower_2',
      'vwap_lower_3',
    ];
    for (const t of tokens) expect(text).not.toContain(t);
    // Anti-vacuity: the same probe over a hand-built poison string DOES fire.
    expect('this card is not_checkable today').toContain('not_checkable');
  });
});

// =================================================================================================
// F17 — the prefill-gate integration specs (AC-7, AC-68)
// =================================================================================================
describe('ai-rec-grounding · the prefill gate, end to end (F17)', () => {
  it('AC-7 (SB) · untraced — Accept opens both price fields EMPTY with the untraced reason line', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByLabelText('Target (optional)') as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByTestId('entry-stop-withheld')).toHaveTextContent(
      "Not pre-filled — this was the AI's own number.",
    );
    expect(within(dialog).getByTestId('entry-target-withheld')).toHaveTextContent(
      "Not pre-filled — this was the AI's own number.",
    );
  });
});

// =================================================================================================
// The seven-AC coverage gap (GATE Z bounce, shared item) — AC-29 named here; AC-2/AC-23 live
// in `literals.spec.ts` (pure-function layer); AC-30/AC-31 extend the shipped SSE/superseded tests in
// `ai-rec.risk.spec.tsx`.
// =================================================================================================
describe('ai-rec-grounding · the seven-AC coverage gap (GATE Z bounce, shared item)', () => {
  it('AC-29 — the bundle-failure (unavailable) envelope renders no card-level line and no per-figure clause at all', async () => {
    const rec: RecResponse = {
      ...noTradeRec(),
      status: 'unavailable',
      strategy: null,
      unavailable_reason: 'transport',
    };
    installBackend(rec);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.unavailable.title);
    expect(within(panel()).queryByTestId('grounding-card-line')).toBeNull();
    expect(within(panel()).queryAllByTestId(/^clause-/)).toHaveLength(0);
  });
});

// =================================================================================================
// AC-34 (GATE Z coverage gap, item 2 of 2 — the FE half of the seven-AC list) — numbers inside the
// AI's free prose acquire NO grounding treatment. NON-VACUOUS (the fixture's prose genuinely contains
// numbers). That prose never moves the counts is pinned at unit level: `cardGroundingLine` only
// accepts a `Grounding` object (`literals.spec.ts`).
// =================================================================================================
describe('ai-rec-grounding · AC-34 — prose numbers acquire no grounding marker', () => {
  function withProseNumbers(base: RecResponse): RecResponse {
    return {
      ...base,
      strategy: {
        ...base.strategy!,
        key_points: [
          'Gamma flip sits at 248, below spot — dealers are long gamma.',
          'IV/HV at 1.12 is only mildly rich.',
        ],
        reengage_when: ['If spot breaks below 240 the setup is invalidated.'],
        rationale:
          'The 260 call wall caps upside near-term. A break above 265 would change the read.',
      },
    };
  }

  it('AC-34(a) — no number inside the reasoning prose acquires a grounding state, marker, chip, tint, link or tooltip', async () => {
    const analysis = renderAnalysis(withProseNumbers(recAllTraced()));
    // VACUITY GUARD — the prose really does carry numbers, or this test proves nothing (the exact
    // trap named in the bounce: a numberless card would pass vacuously).
    const items = within(analysis).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((el) => /\d/.test(el.textContent ?? ''))).toBe(true);

    for (const el of items) {
      expect(el.getAttribute('data-clause')).toBeNull();
      expect(el.closest('[data-testid^="clause-"]')).toBeNull();
      expect(el.closest('a')).toBeNull();
      expect(el.getAttribute('title')).toBeNull();
      // The type register (F12) is reserved for the three GROUNDED fields — a prose number must
      // never pick up the mono register, which in this app now specifically claims "traces to
      // Convexa" (DESIGN_SYSTEM Amendment 2026-08-13).
      expect(getComputedStyle(el).fontFamily).not.toContain('IBM Plex Mono');
    }

    // The expanded "Analyst read" prose carries a number too ("265") — same guarantees apply there.
    const detail = await within(analysis).findByText(/A break above 265/);
    expect(detail.getAttribute('data-clause')).toBeNull();
    expect(detail.closest('[data-testid^="clause-"]')).toBeNull();
    expect(detail.closest('a')).toBeNull();
    expect(detail.getAttribute('title')).toBeNull();
    expect(getComputedStyle(detail).fontFamily).not.toContain('IBM Plex Mono');
  });
});
