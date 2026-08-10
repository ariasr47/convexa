/**
 * V7 — FULL-PAGE INTEGRATION over a SEEDED DURABLE STORE. The centerpiece: it drives the real user
 * flow through the real page, the real store, the real migration and the real derivation, and mocks
 * ONLY the network boundary (`GET /api/ticker`, `GET /api/contract`, the SSE transport).
 *
 * Never the store. Never the derivation. Mocking either is exactly what makes an integration test
 * agree with a broken implementation — which, in a feature whose hardest invariant is
 * `loss-free-durable-migration`, would be worse than having no test at all.
 *
 * NOT owned here, deliberately: the 393px overflow with a 4-leg block expanded, and the collapsed
 * card-height equality. Both live in `dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts`, in the tier
 * that can measure honestly — jsdom reports every box as 0, so a copy here would pass vacuously and
 * be a second source of truth besides.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { StrikeRow, TickerBundle, TrackedContract } from '@convexa/api';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { STALE_SAVED_VIEW_CUSTOMIZATION } from '@/features/trading/positions/fixtures';
import { staleViewNotice } from '@/features/trading/positions/labels';
import {
  __resetMemory,
  allPositions,
  PORTFOLIO_V1_KEY,
  PORTFOLIO_V2_KEY,
  PORTFOLIO_V3_KEY,
} from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';

// =================================================================================================
// The network boundary — and nothing else
// =================================================================================================

function strike(s: number): StrikeRow {
  return {
    strike: s,
    net_gex: 0,
    call_gex: 0,
    put_gex: 0,
    call_oi: 10,
    put_oi: 10,
    total_oi: 20,
    net_dex: 0,
    call_dex: 0,
    put_dex: 0,
    volume: 5,
    vol_oi_ratio: 0.25,
  };
}

function makeBundle(ticker = 'TSLA'): TickerBundle {
  return {
    market_state: {
      ticker,
      price: 250,
      gex_spot: 250,
      timestamp: 1,
      timestamp_iso: '2026-06-23T14:00:00Z',
      call_wall: 260,
      put_wall: 240,
      peak_gex_strike: 255,
      gamma_flip: 248,
      max_pain: 250,
      max_pain_expiration: '2026-06-26',
      net_gex: 1,
      call_gex: 1,
      put_gex: -1,
      total_gex: 1,
      net_dex: 1,
      call_dex: 1,
      put_dex: -1,
      net_vanna: null,
      net_charm: null,
      net_volga: null,
      vwap: 249,
      vwap_upper_2: null,
      vwap_upper_3: null,
      vwap_lower_2: null,
      vwap_lower_3: null,
      dte_min: 7,
      dte_max: 45,
      atm_iv: 45,
      hv_30d: 40,
      iv_hv_ratio: 1.1,
      net_flow: null,
      put_call_ratio: 0.8,
      chain_vol_oi_ratio: 0.5,
      total_volume: 100000,
      vol_oi_unusual_threshold: 1,
      iv_skew: null,
      term_structure: null,
      dealer_flow_projection: null,
    },
    signals: {
      ticker,
      regime: 'positive_gamma',
      regime_note: null,
      vol_regime: 'neutral',
      distances: {},
      setups: [],
      opportunity_score: 42,
      opportunity_tier: 'watch',
      prime_prompt_eligible: false,
    },
    strike_profile: { ticker, spot: 250, strikes: [strike(245), strike(250), strike(255)] },
    expirations: [{ date: '2026-08-21', dte: 24 }],
    ai_eval: {
      ready: true,
      reasons: [],
      changed: true,
      state_fingerprint: 'fp',
      score_threshold: 50,
    },
    meta: {
      served_at: '2026-06-23T14:00:00Z',
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: '2026-06-23T14:00:00Z',
        data_age_seconds: 10,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    off_exchange: {
      ratio_pct: 38,
      offex_shares: 1,
      total_shares: 1,
      levels: [],
      blocks: [],
      block_min_shares: 5000,
      note: '',
    },
    position_eval: null,
  } as unknown as TickerBundle;
}

function quoteFor(strikeValue: number, right: string): TrackedContract {
  return {
    ticker: 'TSLA',
    expiration: '2026-08-21',
    strike: strikeValue,
    right: right as TrackedContract['right'],
    option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
    greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
    iv: 0.45,
    dte: 24,
  };
}

/** Contracts that must resolve to `null` this cycle — the per-contract 404 isolation lever. */
let unresolvableStrikes = new Set<number>();
let esInstances: { onmessage: ((e: MessageEvent) => void) | null }[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  unresolvableStrikes = new Set();
  esInstances = [];

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      esInstances.push(this as { onmessage: ((e: MessageEvent) => void) | null });
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown, status = 200) =>
      new Response(b === null ? 'null' : JSON.stringify(b), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/api/auth/session'))
      return json({
        authenticated: true,
        user: { id: 'u', email: 'a@b.c', display_name: null, auth_methods: ['password'] },
        google_available: false,
        settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
      });
    if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
    if (url.includes('/api/ticker/')) {
      const tk = (url.match(/\/api\/ticker\/([A-Z]+)/) ?? [])[1] ?? 'TSLA';
      return json(makeBundle(tk));
    }
    if (url.includes('/api/recommendation/status/'))
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) {
      const k = Number(new URL(url, 'http://x').searchParams.get('strike'));
      const right = new URL(url, 'http://x').searchParams.get('right') ?? 'call';
      if (unresolvableStrikes.has(k)) return json(null, 404);
      return json(quoteFor(k, right));
    }
    throw new Error(`Unexpected fetch in the integration suite: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderAt(path = '/positions') {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function pushLive(over: Record<string, unknown> = {}) {
  act(() => {
    esInstances.forEach((es) =>
      es.onmessage?.({
        data: JSON.stringify({
          ticker: 'TSLA',
          mid: 252,
          live: true,
          market_session: 'regular',
          ...over,
        }),
      } as MessageEvent),
    );
  });
}

// =================================================================================================
// Durable seeds — written as LEGACY v2 bytes, so every case goes through the REAL migration
// =================================================================================================

const leg = (over: Record<string, unknown> = {}) => ({
  kind: 'option',
  ticker: 'TSLA',
  side: 'long',
  qty: 1,
  multiplier: 100,
  entry_price: 4,
  entry_basis: 'user_entered',
  expiration: '2026-08-21',
  strike: 250,
  right: 'call',
  ...over,
});

/** A v2 record whose flat contract fields describe ONLY leg 0 — the pre-cutover multi-leg shape. */
function v2Record(id: string, legs: Record<string, unknown>[], over: Record<string, unknown> = {}) {
  const head = legs[0];
  return {
    id,
    ticker: head.ticker,
    expiration: head.expiration ?? '',
    strike: head.strike ?? 0,
    right: head.right ?? 'call',
    side: 'long',
    qty: head.qty,
    entry_mark: head.entry_price,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-12T15:32:00Z',
    status: 'open',
    schema_version: 2,
    legs,
    ...over,
  };
}

function seedV2(
  records: Record<string, unknown>[],
  extra: { decisions?: unknown[]; customization?: unknown } = {},
) {
  const positions: Record<string, unknown> = {};
  for (const r of records) positions[(r as { id: string }).id] = r;
  localStorage.setItem(
    PORTFOLIO_V2_KEY,
    JSON.stringify({
      schema_version: 2,
      positions,
      decisions: extra.decisions ?? [],
      ...(extra.customization ? { customization: extra.customization } : {}),
    }),
  );
  __resetMemory();
}

const VERTICAL = () =>
  v2Record('p-vertical', [
    leg({ strike: 250, entry_price: 8 }),
    leg({ strike: 260, side: 'short', entry_price: 4 }),
  ]);
const SHARES = () =>
  v2Record('p-shares', [
    leg({
      kind: 'equity',
      qty: 100,
      multiplier: 1,
      entry_price: 250,
      expiration: null,
      strike: null,
      right: null,
    }),
  ]);
const COVERED_CALL = () =>
  v2Record('p-covered', [
    leg({
      kind: 'equity',
      qty: 100,
      multiplier: 1,
      entry_price: 250,
      expiration: null,
      strike: null,
      right: null,
    }),
    leg({ strike: 260, side: 'short', entry_price: 4 }),
  ]);
const CONDOR = () =>
  v2Record('p-condor', [
    leg({ strike: 260, entry_price: 4 }),
    leg({ strike: 255, side: 'short', entry_price: 6 }),
    leg({ strike: 245, right: 'put', side: 'short', entry_price: 5 }),
    leg({ strike: 240, right: 'put', entry_price: 3 }),
  ]);
const SINGLE = (id = 'p-single', strikeValue = 250) => v2Record(id, [leg({ strike: strikeValue })]);

const rows = () => screen.queryAllByTestId('position-row');
const rowById = async (id: string) => {
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  const match = rows().find((r) => r.getAttribute('data-id') === id);
  return match ?? null;
};

// =================================================================================================
// 1. One row per position, whatever it is made of
// =================================================================================================

describe('the book renders ONE row per position (AC-1, AC-2, AC-3, AC-23)', () => {
  it('AC-1 — a two-leg vertical appears as ONE row, not two', async () => {
    seedV2([VERTICAL()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    // The row carries BOTH strikes in one cell — one object with parts, not two rows.
    const cell = within(rows()[0]).getByTestId('cell-contract');
    expect(cell.textContent).toContain('$250');
    expect(cell.textContent).toContain('$260');
  });

  it('AC-2/AC-3 — a shares-only position and a covered call are each ONE row', async () => {
    seedV2([SHARES(), COVERED_CALL()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(2));
    const shares = await rowById('p-shares');
    expect(within(shares as HTMLElement).getByTestId('cell-contract').textContent).toContain(
      '100 shares',
    );
    const covered = await rowById('p-covered');
    expect(within(covered as HTMLElement).getByTestId('cell-contract').textContent).toContain(
      '100 sh',
    );
  });

  it('AC-23 — every position shows ONE net P/L figure covering all of its legs', async () => {
    seedV2([VERTICAL(), SINGLE()]);
    renderAt();
    // The assertion MUST live inside the waitFor. `cell-pl` does not exist until the row's mark
    // resolves — `PositionRow`'s `pl` case renders `unavailableCell` while `pl_dollar` is null —
    // and that resolution is an async per-row `GET /api/contract`. Waiting only for the ROWS to
    // appear and then asserting synchronously raced the marks: green locally, ~50% red on a loaded
    // CI runner, failing with `Unable to find an element by: [data-testid="cell-pl"]`.
    // Retry the whole thing instead. (The property under test is unchanged: exactly ONE net P/L
    // figure per row, however many legs it has.)
    await waitFor(() => {
      const current = rows();
      expect(current).toHaveLength(2);
      for (const row of current) {
        expect(within(row).getAllByTestId('cell-pl')).toHaveLength(1);
      }
    });
  });
});

// =================================================================================================
// 2. THE DURABLE HALF OF F18 STEP 3b, on the rendered page
// =================================================================================================

describe('a four-leg condor entered BEFORE the cutover still renders as a condor AFTER it', () => {
  it('renders `Iron condor`, not `Long call`, and discloses all four legs', async () => {
    seedV2([CONDOR()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // The structure chip carries the authoritative name, derived from the LEGS.
    expect(await screen.findByText('Iron condor')).toBeInTheDocument();
    expect(screen.queryByText('Long call')).toBeNull();

    // …and the legs are all there. A condor that re-reads as one long call is the silent, total,
    // irreversible loss `loss-free-durable-migration` was promoted on severity to prevent.
    const user = userEvent.setup();
    await user.click(screen.getByTestId('leg-disclosure-toggle'));
    expect(screen.getAllByTestId('leg-line')).toHaveLength(4);

    // The durable record really is four legs, not a render-only illusion.
    expect(allPositions().find((p) => p.id === 'p-condor')?.legs).toHaveLength(4);
  });

  it('and it survives a RELOAD out of the promoted v3 blob, still four legs', async () => {
    seedV2([CONDOR()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).not.toBeNull();

    cleanup();
    __resetMemory();
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(await screen.findByText('Iron condor')).toBeInTheDocument();
    expect(allPositions()[0].legs).toHaveLength(4);
  });
});

// =================================================================================================
// 3. Degradation — per-contract isolation, and the four states never rendering alike
// =================================================================================================

describe('degraded states (AC-38, AC-39, AC-40, AC-42)', () => {
  it('AC-39/AC-40 — one unpriceable leg withholds the WHOLE position, is counted, and costs no other row', async () => {
    unresolvableStrikes = new Set([260]); // the vertical's short leg only
    seedV2([VERTICAL(), SINGLE('p-ok', 250)]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(2));

    const vertical = (await rowById('p-vertical')) as HTMLElement;
    await waitFor(() =>
      expect(within(vertical).getAllByTestId('cell-unavailable').length).toBeGreaterThan(0),
    );
    // pl, pl_pct AND mark are ALL withheld — never a partial sum, which would flip a credit's sign.
    // The withheld cell REPLACES the figure: there is no `cell-pl` to dim on this row at all.
    expect(within(vertical).queryByTestId('cell-pl')).toBeNull();
    expect(within(vertical).getAllByTestId('cell-unavailable').length).toBeGreaterThanOrEqual(3);

    // The OTHER row keeps pricing: per-contract isolation, not a page-wide failure.
    const ok = (await rowById('p-ok')) as HTMLElement;
    await waitFor(() => expect(within(ok).getByTestId('cell-pl').textContent).toMatch(/\d/));

    // …and the withheld row is EXCLUDED from the subtotal AND COUNTED, never summed as zero.
    // (The subtotal renders on a GROUP header, so group the book to read it.)
    const user = userEvent.setup();
    await user.click(screen.getByTestId('group-select-ticker'));
    await waitFor(() =>
      expect(screen.getByTestId('subtotal').textContent).toMatch(/1 position excluded/),
    );
  });

  it('AC-38/AC-42/AC-43 — an SSE drop degrades the live block only; STATIC cells never dim', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedV2([VERTICAL()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    pushLive();

    const staticBefore = {
      contract: within(rows()[0]).getByTestId('cell-contract').className,
      maxLoss: within(rows()[0]).queryByTestId('cell-max-loss')?.className ?? null,
    };
    await waitFor(() => expect(within(rows()[0]).getByTestId('cell-pl').textContent).toMatch(/\d/));
    const plBefore = (within(rows()[0]).getByTestId('cell-pl').textContent ?? '').trim();

    // Drop the stream: the watchdog flips offline after the payload gap.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeInTheDocument());

    // The number is STILL THERE — last-known, dimmed, MARKED. Never blanked, never replaced.
    const plAfter = (within(rows()[0]).getByTestId('cell-pl').textContent ?? '').trim();
    expect(plAfter.startsWith(plBefore)).toBe(true);
    expect(plAfter).toContain('⏸ offline'); // the marker is APPENDED, the figure is untouched
    expect(screen.getAllByText(/⏸ offline/).length).toBeGreaterThan(0);
    // Static cells are byte-identical: no dim, no marker, no class change.
    expect(within(rows()[0]).getByTestId('cell-contract').className).toBe(staticBefore.contract);
    expect(within(rows()[0]).queryByTestId('cell-max-loss')?.className ?? null).toBe(
      staticBefore.maxLoss,
    );
    // Offline and unavailable are DIFFERENT: nothing here reads `unavailable`.
    expect(within(rows()[0]).queryAllByTestId('cell-unavailable')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('a stream drop never blanks a loaded read, and reconnect restores the live marker', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedV2([SINGLE()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    pushLive();
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeInTheDocument());
    expect(rows()).toHaveLength(1); // the record persisted through the drop

    pushLive({ mid: 253 }); // auto-reconnect
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).toBeNull());
    expect(screen.queryAllByText(/⏸ offline/)).toHaveLength(0);
    vi.useRealTimers();
  });
});

// =================================================================================================
// 4. Saved views — a stale filter is FLAGGED, never healed, and never written
// =================================================================================================

describe('AC-53/AC-54 — the seeded stale saved view', () => {
  it('opens, shows rows, is flagged adjusted, and writes NOTHING to the stored views', async () => {
    seedV2([SINGLE()], { customization: STALE_SAVED_VIEW_CUSTOMIZATION });
    const storedViews = JSON.stringify(STALE_SAVED_VIEW_CUSTOMIZATION.views);

    renderAt();
    // It OPENS and SHOWS ROWS — the stale filter degraded for rendering, it did not blank the page.
    await waitFor(() => expect(rows()).toHaveLength(1));
    // …and it is FLAGGED, naming the view, not silently healed.
    expect(await screen.findByTestId('stale-view-notice')).toBeInTheDocument();
    expect(screen.getByTestId('stale-view-notice').textContent).toContain(
      staleViewNotice('Tech swings'),
    );

    // AC-82/AC-54: the STORED views are byte-identical. Nothing was rewritten to make this work.
    const after = JSON.parse(localStorage.getItem(PORTFOLIO_V3_KEY) as string) as {
      customization: { views: unknown[] };
    };
    expect(JSON.stringify(after.customization.views)).toBe(storedViews);
  });

  it('the notice is dismissible and dismissing it writes nothing either', async () => {
    seedV2([SINGLE()], { customization: STALE_SAVED_VIEW_CUSTOMIZATION });
    renderAt();
    await screen.findByTestId('stale-view-notice');
    const before = localStorage.getItem(PORTFOLIO_V3_KEY);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('stale-view-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('stale-view-notice')).toBeNull());
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBe(before);
  });
});

// =================================================================================================
// 5. The merge notice — once, for the right trader only
// =================================================================================================

describe('AC-51/AC-52 — the merge notice', () => {
  function seedBothSurfaces() {
    seedV2([SINGLE('p-book')]);
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: {
          TSLA: {
            id: 'g-ticker',
            ticker: 'TSLA',
            expiration: '2026-08-21',
            strike: 250,
            right: 'call',
            side: 'long',
            qty: 1,
            entry_mark: 4,
            entry_basis: 'snapshot',
            entry_time: '2026-06-18T14:05:00Z',
            status: 'open',
            schema_version: 1,
          },
        },
        decisions: [],
      }),
    );
    __resetMemory();
  }

  it('appears ONCE for a both-surfaces trader, and never returns after dismissal', async () => {
    seedBothSurfaces();
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(2)); // ONE list, both items
    expect(await screen.findByTestId('merge-notice')).toBeInTheDocument();
    // It states NO counts at all (SPEC §4 ruling 2).
    expect(screen.getByTestId('merge-notice').textContent).not.toMatch(/\d/);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('merge-notice-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('merge-notice')).toBeNull());

    // Reload — it is gone for good, and no record moved.
    cleanup();
    __resetMemory();
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByTestId('merge-notice')).toBeNull();
  });

  it('AC-52 — a Positions-page-only trader never sees it', async () => {
    seedV2([SINGLE()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByTestId('merge-notice')).toBeNull();
  });
});

// =================================================================================================
// 6. One book, two pages
// =================================================================================================

describe('AC-70/AC-71 — one book across both pages, without a reload', () => {
  it('a position opened from the Ticker page appears in the portfolio', async () => {
    const user = userEvent.setup();
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(allPositions()).toHaveLength(0);

    await user.click(await screen.findByTestId('open-sim-trade'));
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText('Manual price'), '4');
    await user.click(within(dlg).getByRole('button', { name: 'Open simulated position' }));

    await waitFor(() => expect(allPositions()).toHaveLength(1));
    // …and it is in the PORTFOLIO, on the other page, with no reload of the store in between.
    await user.click(screen.getByTestId('nav-positions'));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('a close on the Positions page is reflected without a reload', async () => {
    const user = userEvent.setup();
    seedV2([SINGLE()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));

    await user.click(within(rows()[0]).getByRole('button', { name: /close/i }));
    // The row leaves the default (open-only) view immediately — no reload, no refetch.
    await waitFor(() => expect(rows()).toHaveLength(0));
    expect(allPositions()[0].status).toBe('closed');
    expect(allPositions()[0].close_time).toEqual(expect.any(String));
  });
});

// =================================================================================================
// 7. Nothing here is real
// =================================================================================================

describe('AC-76 — every position surface stays SIMULATED', () => {
  it('the PAPER badge and the browser-local disclosure survive verbatim; no order path exists', async () => {
    seedV2([VERTICAL()]);
    renderAt();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(screen.getByTestId('tab-simulated')).getByText('PAPER')).toBeInTheDocument();
    expect(screen.getByTestId('positions-disclosure')).toBeInTheDocument();
    // broker-connect: the second tab now reads "Broker" (the poll-honesty label ruling); the
    // internal `tab-live` testid stays per the decisions.md carve-out. It is a TAB, not an order
    // affordance — the no-order-path assertions below are about write affordances.
    expect(screen.getByTestId('tab-live').textContent).toContain('Broker');
    expect(screen.queryByText(/place real order/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /real money|place order/i })).toBeNull();
  });
});
