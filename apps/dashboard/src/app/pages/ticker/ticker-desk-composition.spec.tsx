/**
 * Ticker desk composition — GATE Z (FE-11, curvature-v2-desk-and-read), criteria 47 and 54 (SPEC §1,
 * §4, PLAN FE-11 Steps 2/3). Mounts the real app via the route table, mocking only the network
 * boundary — the same harness shape `ticker-hierarchy.spec.tsx`/`ai-rec.absence.spec.tsx` already
 * establish.
 *
 * Criterion 47 — AI-read isolation: signed out, without a key, cooling down, capped, or after a
 * request failure, the structure, the tape, the strip and the quiet band all render UNCHANGED
 * (byte-identical `textContent`) against a produced-nothing baseline. `[live-vs-static-isolation]`'s
 * own shape, extended to the AI-read axis (SPEC §5: "AI-read failure is isolated").
 *
 * Criterion 54 — one shared entry dialog: the masthead's primary action, the position brief's own
 * CTA, and the AI read brief's "Review simulated trade" all open the SAME `TradeEntryDialog`
 * (`[single-shared-sim-entry-dialog]`); no second entry-dialog component exists anywhere in the app
 * (`?raw` source scan); nothing reaches a real order path (`[no-real-order-path]`).
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import { __resetMemory as __resetPositions } from '@/features/trading/positions/store';
import type { RecStatus, TickerBundle } from '@convexa/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPY } from './widgets/ai-rec/copy';

function baseStatus(over: Partial<RecStatus> = {}): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
    ...over,
  };
}

interface BackendConfig {
  authenticated?: boolean;
  status?: RecStatus;
  /** When set, the POST /api/recommendation/ call FAILS with this HTTP status (never auth-class). */
  recPostFailStatus?: number;
  bundle?: TickerBundle;
}

function installBackend(cfg: BackendConfig = {}) {
  __resetPositions();
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);

  const bundle = cfg.bundle ?? makeBundle();
  const status = cfg.status ?? baseStatus();
  const authenticated = cfg.authenticated ?? true;

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/auth/session')) {
      return authenticated
        ? json({
            authenticated: true,
            user: { id: 'u-1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
            google_available: false,
            settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
          })
        : json({ authenticated: false, user: null, google_available: false, settings: null });
    }
    if (url.includes('/api/positions/sim-trade/gate')) return json({ allowed: true });
    if (url.includes('/api/ticker/')) return json(bundle);
    if (url.includes('/api/recommendation/status/')) return json(status);
    if (url.includes('/api/recommendation/') && method === 'POST') {
      if (cfg.recPostFailStatus != null) {
        return json({ error: 'synthetic transport fault' }, cfg.recPostFailStatus);
      }
      throw new Error('this test never asks for a produced read');
    }
    if (url.includes('/api/personas')) return json(PRESETS);
    if (url.includes('/api/contract/')) return json(null);
    if (url.includes('/history'))
      return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
    throw new Error(`Unexpected fetch in ticker-desk-composition test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock };
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------------------------
// Criterion 47 — AI-read isolation
// ---------------------------------------------------------------------------------------------

/** The quiet band, sampled by three of its own widgets (same discipline `ticker.risk.spec.tsx`'s
 *  `STATIC_WIDGETS` already established) — never a live-derived figure, so this doubles as the
 *  "quiet band never wears a live mark" half incidentally, though criterion 8 is proven elsewhere. */
const QUIET_BAND_WIDGETS = [
  'widget-market-context',
  'widget-iv-rank',
  'widget-dealer-flow-projection',
] as const;

/** Captures the four non-AI regions' rendered text, per criterion 47's own naming. */
function captureRegions(): Record<string, string> {
  const out: Record<string, string> = {
    structure: screen.getByTestId('widget-structure-hero').textContent ?? '',
    tape: screen.getByTestId('widget-live-tape').textContent ?? '',
    strip: screen.getByTestId('widget-read-strip').textContent ?? '',
  };
  for (const id of QUIET_BAND_WIDGETS) {
    out[id] = screen.getByTestId(id).textContent ?? '';
  }
  return out;
}

describe('Ticker desk — criterion 47: the AI-read axis never leaks into structure/tape/strip/quiet band', () => {
  it('captures the baseline (idle, fully available) once, for every other case to compare against', async () => {
    installBackend();
    renderApp();
    await screen.findByText('Call wall');
    await screen.findByText('AI recommendation · TSLA');
    // Sanity: the baseline itself is non-trivial (regions actually carry real text).
    const regions = captureRegions();
    for (const v of Object.values(regions)) expect(v.length).toBeGreaterThan(0);
  });

  it.each([
    [
      'signed out',
      (): BackendConfig => ({ authenticated: false }),
      async () => {
        /* no interaction needed — the panel renders its own sign-in gate immediately */
      },
    ],
    [
      'without a key',
      (): BackendConfig => ({
        status: baseStatus({
          powering: {
            key_source: 'none',
            provider: null,
            model: null,
            unavailable_reason: 'no_key',
            preference: { power_path: null, provider: null, model: null },
          },
        }),
      }),
      async () => undefined,
    ],
    [
      'cooling down',
      (): BackendConfig => ({
        status: baseStatus({
          gate: { state: 'available', cooldown_remaining_seconds: 45, reasons: ['recent_request'] },
        }),
      }),
      async () => undefined,
    ],
    [
      'capped',
      (): BackendConfig => ({
        status: baseStatus({
          cap: { over_limit: true, remaining_today: 0, resets_at: '2026-06-28T04:00:00Z' },
        }),
      }),
      async () => undefined,
    ],
    [
      'after a request failure',
      (): BackendConfig => ({ recPostFailStatus: 500 }),
      async (user: ReturnType<typeof userEvent.setup>) => {
        const panel = screen.getByTestId('ai-rec-panel');
        await waitFor(() =>
          expect(within(panel).getByRole('button', { name: COPY.action.get })).toBeEnabled(),
        );
        await user.click(within(panel).getByRole('button', { name: COPY.action.get }));
        await within(panel).findByText(/AI unavailable/i);
      },
    ],
  ] as const)(
    '%s: the four other regions render BYTE-IDENTICAL to the baseline',
    async (_label, cfg, drive) => {
      // Fresh baseline capture in THIS render (never reused across `render()` calls/instances) —
      // the market bundle/structure figures are otherwise-identical fixtures either way, so a
      // same-process baseline is the honest comparison, not a cross-test snapshot.
      installBackend();
      renderApp();
      await screen.findByText('Call wall');
      await screen.findByText('AI recommendation · TSLA');
      const baseline = captureRegions();
      cleanup();

      installBackend(cfg());
      const user = renderApp();
      await screen.findByText('Call wall');
      await drive(user);
      const after = captureRegions();

      expect(after).toEqual(baseline);
    },
  );
});

// ---------------------------------------------------------------------------------------------
// Criterion 54 — one shared entry dialog
// ---------------------------------------------------------------------------------------------

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('Ticker desk — criterion 54: exactly one shared trade-entry dialog', () => {
  it('[single-shared-sim-entry-dialog] no second entry-dialog component is declared anywhere in the app', () => {
    // A component "shaped like" a trade/order ENTRY dialog — never `OrderDetailDialog` (a VIEW of an
    // existing order, not a creation flow) or any other dialog in the app (settings, export, sign-in).
    const declarationsRe = /\bexport\s+(?:function|const)\s+(\w*Entry\w*Dialog\w*)\b/g;
    const found = new Map<string, string[]>();
    for (const [file, src] of Object.entries(APP_SOURCES)) {
      for (const m of src.matchAll(declarationsRe)) {
        const name = m[1];
        const list = found.get(name) ?? [];
        list.push(file);
        found.set(name, list);
      }
    }
    const names = [...found.keys()].sort();
    // `TradeEntryDialog` is the ONLY declaration this pattern may ever match — its own home is
    // `tradeEntry/TradeEntryDialogView.tsx`, but `features/trading/TradeEntryDialog.tsx` is a pure
    // re-export barrel (`export { TradeEntryDialog } from './tradeEntry'`), not a second
    // declaration. Anything else here is a second, competing entry-dialog component.
    expect(names).toEqual(['TradeEntryDialog']);
    expect(found.get('TradeEntryDialog')).toEqual([
      '/src/app/features/trading/tradeEntry/TradeEntryDialogView.tsx',
    ]);
  });

  it('TickerDashboard.tsx wires exactly ONE trade-flows hook and mounts `TradeEntryDialog` from exactly one import', () => {
    const src = APP_SOURCES['/src/app/pages/ticker/TickerDashboard.tsx'];
    expect(src, 'TickerDashboard.tsx must exist at its locked path').toBeTruthy();
    expect((src.match(/useTickerTradeFlows\(/g) ?? []).length).toBe(1);
    expect((src.match(/^import\s*\{[^}]*\bTradeEntryDialog\b[^}]*\}\s*from/gm) ?? []).length).toBe(
      1,
    );
    // Two JSX mounts of the ONE imported component (the ghost-entry instance + the additive ORDER
    // variant, both documented in-file as the SAME shared dialog, never a fork).
    expect((src.match(/<TradeEntryDialog\b/g) ?? []).length).toBe(2);
    // The masthead CTA and the position brief's own CTA both call the SAME `openEntry` the hook
    // returns; the AI read brief's "Review simulated trade" routes through `onAcceptRec`, which
    // itself calls `openEntry` (see `useTickerTradeFlows.ts`) — never a second, parallel opener.
    expect(src).toContain('onOpenTrade={() => openEntry()}');
    expect(src).toContain('onAccept={onAcceptRec}');
  });

  it("the position brief's own CTA opens the SAME dialog surface the AI read brief opens (behavioural proof, not merely structural)", async () => {
    installBackend();
    const user = renderApp();
    await screen.findByText('Call wall');
    await screen.findByText('AI recommendation · TSLA');

    expect(screen.queryByTestId('trade-entry-dialog')).toBeNull();
    await user.click(screen.getByTestId('position-brief-open-trade'));
    // `data-testid="trade-entry-dialog"` lives on `TradeEntryDialogView`'s own `DialogContent` — the
    // SAME node the AI-accept path renders (`ai-rec.grounding.spec.tsx`'s own "Accept opens the
    // shared entry dialog" test proves that path; this proves the position-brief path reaches the
    // identical surface, not a lookalike).
    expect(await screen.findByTestId('trade-entry-dialog')).toBeInTheDocument();
  });

  it('[no-real-order-path] `TickerDashboard.tsx` never calls a real order-placing endpoint directly', () => {
    const src = APP_SOURCES['/src/app/pages/ticker/TickerDashboard.tsx'];
    expect(src).not.toMatch(/fetch\(\s*['"`].*\/api\/orders/);
    // Confirms is not a fabricated address — `usePortfolio`/`useOrderEngine` are the sanctioned
    // simulated-book writers this file delegates to (already broadly guarded by
    // `TradeEntryDialog.risk.spec.tsx`/`orders.risk.spec.tsx`'s own `[no-real-order-path]` suites,
    // which this test does not re-derive).
    expect(src).toContain('useOrderEngine');
    expect(src).toContain('usePortfolio');
  });
});
