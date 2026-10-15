/**
 * Ticker desk composition — GATE Z (FE-11, curvature-v2-desk-and-read), criteria 47 and 54 (SPEC §1,
 * §4, PLAN FE-11 Steps 2/3). Mounts the real app via the route table, mocking only the network
 * boundary.
 *
 * Criterion 47 — AI-read isolation: signed out, without a key, cooling down, capped, or after a
 * request failure, the structure, the tape, the strip and the quiet band all render UNCHANGED
 * (byte-identical `textContent`) against a produced-nothing baseline. `[live-vs-static-isolation]`'s
 * own shape, extended to the AI-read axis (SPEC §5: "AI-read failure is isolated").
 * Walked here for two representative states (signed out, after a request failure); no key, cooling
 * down and capped vary only the same status-driven panel branch.
 *
 * Criterion 54 — one shared entry dialog: the masthead's primary action, the position brief's own
 * CTA, and the AI read brief's "Review simulated trade" all open the SAME `TradeEntryDialog`
 * (`[single-shared-sim-entry-dialog]`); no second entry-dialog component exists anywhere in the app
 * (`?raw` source scan). `[no-real-order-path]` is proven behaviourally by `orders.risk.spec.tsx`.
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

/** The quiet band, sampled by two of its own widgets (same discipline `ticker.risk.spec.tsx`'s
 *  `STATIC_WIDGETS` already established) — never a live-derived figure, so this doubles as the
 *  "quiet band never wears a live mark" half incidentally, though criterion 8 is proven elsewhere.
 *  PASS 2 change 8 (owner ruling `context-band-is-the-designs-card-list`): `widget-iv-rank` dropped
 *  — `IvRank` no longer mounts on `/ticker` (was a sample of three before this pass). */
const QUIET_BAND_WIDGETS = ['widget-market-context', 'widget-dealer-flow-projection'] as const;

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

let cachedBaseline: Record<string, string> | null = null;

/** The produced-nothing baseline (idle, fully available), captured ONCE per file and reused by
 *  every row — the market bundle/structure figures are identical fixtures in every render, so a
 *  same-process baseline is the honest comparison. Saves one full App mount per row. */
async function captureBaselineOnce(): Promise<Record<string, string>> {
  if (cachedBaseline) return cachedBaseline;
  installBackend();
  renderApp();
  await screen.findByText('Call wall');
  await screen.findByText('AI read · TSLA');
  const regions = captureRegions();
  // Sanity: the baseline itself is non-trivial (regions actually carry real text).
  for (const v of Object.values(regions)) expect(v.length).toBeGreaterThan(0);
  cleanup();
  cachedBaseline = regions;
  return regions;
}

describe('Ticker desk — criterion 47: the AI-read axis never leaks into structure/tape/strip/quiet band', () => {
  it.each([
    [
      'signed out',
      (): BackendConfig => ({ authenticated: false }),
      async () => {
        /* no interaction needed — the panel renders its own sign-in gate immediately */
      },
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
        await within(panel).findByText(/Couldn’t get a read/i);
      },
    ],
  ] as const)(
    '%s: the four other regions render BYTE-IDENTICAL to the baseline',
    async (_label, cfg, drive) => {
      const baseline = await captureBaselineOnce();

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

  it("the position brief's own CTA opens the SAME dialog surface the AI read brief opens (behavioural proof, not merely structural)", async () => {
    installBackend();
    const user = renderApp();
    await screen.findByText('Call wall');
    await screen.findByText('AI read · TSLA');

    expect(screen.queryByTestId('trade-entry-dialog')).toBeNull();
    await user.click(screen.getByTestId('position-brief-open-trade'));
    // `data-testid="trade-entry-dialog"` lives on `TradeEntryDialogView`'s own `DialogContent` — the
    // SAME node the AI-accept path renders (`ai-rec.grounding.spec.tsx`'s own "Accept opens the
    // shared entry dialog" test proves that path; this proves the position-brief path reaches the
    // identical surface, not a lookalike).
    expect(await screen.findByTestId('trade-entry-dialog')).toBeInTheDocument();
  });
});
