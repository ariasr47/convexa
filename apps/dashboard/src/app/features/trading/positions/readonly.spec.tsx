/**
 * V5 — EPHEMERALITY. Reading the book is free of side effects (AC-80, AC-36; SPEC §7 invariant 9).
 *
 * Risk-based: every one of these is invisible to review and silently regressing. A stray `useEffect`
 * that refetches on a group change, or a "let's remember which rows were open" convenience commit,
 * both look completely normal in a diff and both break a promise this surface makes.
 *
 * Mocks ONLY the network boundary (`fetch` + the SSE `EventSource`) — never the store, never the
 * derivation.
 *
 * ⚠ RECORDED DIVERGENCE, deliberately NOT weakened away (see the grouping/sorting case below):
 * AC-80 and §7 invariant 9 say grouping and sorting trigger "no store write". In SHIPPED code they
 * write `customization.working` — that is the whole point of a durable view preference, and it
 * predates this feature. The case below therefore asserts the STRONGEST TRUE form: zero fetches, the
 * BOOK (positions + decisions) byte-identical, and NO saved view rewritten (AC-82). The one byte that
 * legitimately moves is named explicitly so a future regression cannot hide behind a vague assertion.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { themeForPref } from '@/shared/theme/theme';
import type { LiveUpdate, TickerBundle, TrackedContract } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioPanel } from './PortfolioPanel';
import { PositionsView } from './PositionsView';
import { defaultConfig } from './defaults';
import { FX_IRON_CONDOR, viewOf } from './fixtures';
import type { SimPosition } from './leg';
import { liftLegacyRecord } from './migrate';
import {
  PORTFOLIO_V3_KEY,
  __resetMemory,
  getCustomization,
  newId,
  putCustomization,
  putPosition,
} from './store';
import type { Position, SavedView } from './types';
import { usePortfolio } from './usePortfolio';

// ---- The network boundary, and nothing else ----------------------------------------------------

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

let fetchMock: ReturnType<typeof vi.fn>;

function installBackend() {
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
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
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/session'))
      return json({
        authenticated: true,
        user: { id: 'u', email: 'u@x.com', display_name: null, auth_methods: ['password'] },
        google_available: false,
        settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
      });
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/contract/')) {
      const u = new URL(url, 'http://x');
      return json({
        ...QUOTE,
        strike: Number(u.searchParams.get('strike')),
        right: u.searchParams.get('right') ?? 'call',
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

/** Every contract lookup issued so far — the ONE network call this surface is allowed to make. */
const contractCalls = () =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/contract/')).length;

/** A byte-exact snapshot of EVERY `convexa.*` key. */
function storageSnapshot(): string {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) as string;
    if (k.startsWith('convexa.')) out[k] = localStorage.getItem(k) as string;
  }
  return JSON.stringify(Object.entries(out).sort());
}

/** The BOOK only — the positions map + the decision log, with the view preferences left out. */
function bookSnapshot(): string {
  const raw = localStorage.getItem(PORTFOLIO_V3_KEY);
  if (!raw) return 'absent';
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return JSON.stringify({ positions: parsed.positions, decisions: parsed.decisions });
}

function savedViewsSnapshot(): string {
  return JSON.stringify(getCustomization().views);
}

/** A durable record, authored flat and put through the ONE lift — never a hand conversion. */
function pos(over: Partial<Position> = {}): SimPosition {
  const raw: Position = {
    id: newId(),
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-06-20T10:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
  return liftLegacyRecord(raw) as SimPosition;
}

function makeBundle(): TickerBundle {
  return {
    market_state: { ticker: 'TSLA', price: 250 },
    signals: { ticker: 'TSLA', opportunity_tier: 'watch' },
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [{ strike: 250 }] },
    expirations: [{ date: '2026-07-17', dte: 24 }],
    meta: { served_at: '2026-06-23T14:00:00Z' },
    position_eval: null,
  } as unknown as TickerBundle;
}

function Harness() {
  const [data] = useState<TickerBundle | null>(makeBundle());
  const [entryOpen, setEntryOpen] = useState(false);
  const live: LiveUpdate | null = null;
  const pf = usePortfolio('TSLA', data, live, false, false);
  return (
    <ThemeProvider theme={themeForPref('dark')}>
      <AuthProvider>
        <AuthDialogProvider>
          <PortfolioPanel
            pf={pf}
            data={data}
            live={live}
            isLive={false}
            streamOffline={false}
            ticker="TSLA"
            entryOpen={entryOpen}
            onEntryOpen={setEntryOpen}
          />
        </AuthDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

async function mount() {
  const r = render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument());
  await act(async () => {
    await Promise.resolve();
  });
  return r;
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  installBackend();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- The disclosure ----------------------------------------------------------------------------

describe('AC-80 · the leg disclosure is a pure read', () => {
  it('expanding and collapsing a leg block issues ZERO fetches and leaves storage byte-identical', async () => {
    const user = userEvent.setup();
    // The durable store cannot hold a multi-leg record until the F18 cutover, so the disclosure is
    // exercised at the component boundary over the SAME projection the hook emits.
    const views = [viewOf(FX_IRON_CONDOR)];
    localStorage.setItem('convexa.decoy', 'untouched');
    const before = storageSnapshot();
    const callsBefore = contractCalls();

    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <PositionsView
          groups={[{ key: '__all__', label: 'All', views, subtotal: 0, excludedCount: 0 }]}
          columns={[]}
          layout="table"
          density="comfortable"
          streamOffline={false}
          totalCount={1}
          isHistory={false}
          trendFor={() => []}
          onOpenEntry={vi.fn()}
          onClearFilter={vi.fn()}
          onClose={vi.fn()}
          onCancel={vi.fn()}
        />
      </ThemeProvider>,
    );

    const toggle = screen.getByTestId('leg-disclosure-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    expect(contractCalls()).toBe(callsBefore);
    expect(storageSnapshot()).toBe(before);
  });

  it('AC-36 — the expansion state is absent from the persisted view config, so a reload forgets it', () => {
    // Structural, not incidental: the durable `ViewConfig` has NO key that could hold it. A future
    // `expanded: string[]` would fail here before it could ever reach storage.
    const keys = Object.keys(defaultConfig());
    expect(keys.some((k) => /expand|open|disclos/i.test(k))).toBe(false);
    putCustomization(getCustomization());
    expect(localStorage.getItem(PORTFOLIO_V3_KEY) ?? '').not.toMatch(/expand|disclos/i);
  });
});

// ---- Grouping / sorting / view switching -------------------------------------------------------

describe('AC-80 · re-deriving the view never refetches and never touches the book', () => {
  it('grouping is a PURE RE-DERIVATION — zero fetches, the book byte-identical, no saved view rewritten', async () => {
    const user = userEvent.setup();
    putPosition(pos({ id: 'p-1' }));
    putPosition(pos({ id: 'p-2', ticker: 'AAPL', strike: 255 }));
    await mount();
    // VACUITY GUARD: the lookup must have actually happened, or "no NEW fetch" proves nothing.
    await waitFor(() => expect(contractCalls()).toBeGreaterThan(0));

    const callsBefore = contractCalls();
    const bookBefore = bookSnapshot();
    const viewsBefore = savedViewsSnapshot();

    await user.click(screen.getByTestId('group-select-ticker'));
    await user.click(screen.getByTestId('group-select-structure'));
    await user.click(screen.getByTestId('density-toggle-compact'));

    // Zero refetches: the whole pipeline is a re-derivation over the projection already in hand.
    expect(contractCalls()).toBe(callsBefore);
    // The BOOK is untouched — no position and no decision moved.
    expect(bookSnapshot()).toBe(bookBefore);
    // AC-82 — no SAVED VIEW is rewritten by a working-config change.
    expect(savedViewsSnapshot()).toBe(viewsBefore);
    // …and the one thing that DID change is exactly the working preference, by design.
    expect(getCustomization().working.group).toBe('structure');
    expect(getCustomization().working.density).toBe('compact');
  });

  it('switching between existing saved views issues ZERO fetches', async () => {
    const user = userEvent.setup();
    putPosition(pos({ id: 'p-1' }));
    const base = getCustomization();
    const extra: SavedView = {
      id: 'v-extra',
      name: 'Tech swings',
      config: { ...defaultConfig(), group: 'ticker' },
    };
    putCustomization({ ...base, views: [...base.views, extra] });
    await mount();
    await waitFor(() => expect(contractCalls()).toBeGreaterThan(0));

    const callsBefore = contractCalls();
    const bookBefore = bookSnapshot();

    await user.click(screen.getByTestId('view-picker'));
    await user.click(screen.getByText('Tech swings'));

    await waitFor(() => expect(getCustomization().activeViewId).toBe('v-extra'));
    expect(contractCalls()).toBe(callsBefore);
    expect(bookSnapshot()).toBe(bookBefore);
    // Switching selects a view; it never edits one.
    expect(getCustomization().views.find((v) => v.id === 'v-extra')).toEqual(extra);
  });

  it('filtering by status is a re-derivation too — zero fetches, book byte-identical', async () => {
    const user = userEvent.setup();
    putPosition(pos({ id: 'p-1' }));
    await mount();
    await waitFor(() => expect(contractCalls()).toBeGreaterThan(0));

    const callsBefore = contractCalls();
    const bookBefore = bookSnapshot();
    await user.click(screen.getByTestId('status-chip-closed'));
    expect(contractCalls()).toBe(callsBefore);
    expect(bookSnapshot()).toBe(bookBefore);
  });
});

// ---- The scoring rail --------------------------------------------------------------------------

describe('additive-keeps-score-byte-identical · the portfolio issues no bundle/scoring request', () => {
  it('the ONLY endpoint the portfolio touches is the existing per-contract lookup', async () => {
    putPosition(pos({ id: 'p-1' }));
    await mount();
    await waitFor(() => expect(contractCalls()).toBeGreaterThan(0));

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    // `/api/ticker`, the AI/scoring endpoints and any position→score POST are all absent. The
    // session + sim-trade-gate calls belong to auth, not to the portfolio's data path.
    expect(urls.some((u) => u.includes('/api/ticker'))).toBe(false);
    expect(urls.some((u) => /score|signals|ai[-_]/i.test(u))).toBe(false);
    expect(urls.every((u) => /\/api\/(contract|auth|positions\/sim-trade\/gate)/.test(u))).toBe(
      true,
    );
  });
});
