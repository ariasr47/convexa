/**
 * redesign-stage-3 §5.6 / §8-10 — TRANSIENT STATES ARE HEADING-FREE (skill rule 6: a data value /
 * transient title is never a heading; MUI subtitle1/subtitle2 default to <h6> and were silently
 * mounting/unmounting headings with panel state).
 *
 * Rendered assertions on the named sites (styling byte-identical, element only):
 *   - ai-rec: loading `Thinking…` · unavailable · BYO-key CTA · no-trade verdict · Trade·bias
 *     verdict — each renders <p>, the ONLY heading in the widget stays the h2 title.
 *   - CommandDeck sticky condensed bar: `TICKER · $price` is a DATA VALUE → <p>, never a heading.
 *   - OrdersWidget store-fault block: transient fault title → <p>.
 *
 * (The route-level walk — one h1, widget h2s, the EXTENDED data-value pattern incl. the
 * `TICKER · $…` form — lives in `ticker-semantics.spec.tsx`, extended this stage per §8-10.)
 */
import { ThemeProvider } from '@mui/material/styles';
import type { LiveUpdate, MarketState, RecResponse, RecStrategy } from '@org/api';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { usePersona } from '@/features/personas/usePersona';
import { StoreFaultBlock } from '@/features/trading/orders/OrdersWidget';
import { theme } from '@/shared/theme/theme';
import { AiRecPanel } from './widgets/ai-rec/AiRecPanel';
import { BYO_KEY, COPY } from './widgets/ai-rec/copy';
import type { AiRec } from './widgets/ai-rec/useAiRecommendation';
import { CommandDeck } from './widgets/chrome/CommandDeck';

// ---- shared fixtures -----------------------------------------------------------------------

const GATE = { state: 'available', cooldown_remaining_seconds: 0, reasons: [] };
const CAP = { over_limit: false, remaining_today: 50, resets_at: '2026-07-23T04:00:00Z' };

function strategy(over: Partial<RecStrategy> = {}): RecStrategy {
  return {
    decision: 'trade',
    bias: 'long',
    structure: 'call debit spread',
    strikes: [260],
    expiration: '2026-07-31',
    entry_trigger: 'break above 260',
    invalidation_level: 242,
    max_risk: '$300',
    position_size: '2 contracts',
    exit_plan: { target: 12, stop: 6 },
    time_horizon: '5d',
    confidence: 'medium',
    rationale: 'One sentence. Another.',
    ...over,
  } as RecStrategy;
}

function rec(over: Partial<RecResponse> = {}): RecResponse {
  return {
    status: 'produced',
    persona: { id: null, name: 'Default (no persona)' },
    as_of: '2026-07-22T14:30:00Z',
    pinned_fingerprint: 'fp',
    stale_born: false,
    strategy: strategy(),
    unavailable_reason: null,
    gate: GATE,
    cap: CAP,
    ...over,
  } as RecResponse;
}

function aiStub(over: Partial<Record<string, unknown>> = {}): AiRec {
  return {
    inAppEnabled: true,
    gate: GATE,
    cap: CAP,
    statusReady: true,
    cooldownRemaining: 0,
    effectiveGateState: 'available',
    scenarios: null,
    rec: null,
    loading: false,
    stale: false,
    request: vi.fn(),
    retry: vi.fn(),
    dismiss: vi.fn(),
    refreshStatus: vi.fn(),
    ...over,
  } as unknown as AiRec;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return new Response(
          JSON.stringify({
            authenticated: false,
            user: null,
            google_available: false,
            settings: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/personas')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderPanel(ai: AiRec) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthProvider>
          <AuthDialogProvider>
            <AiRecPanel
              ticker="TSLA"
              bundle={null}
              ai={ai}
              personas={[{ id: 'default', name: 'Default (no persona)' } as never]}
              activePersonaId="default"
              dataAge={null}
              onAccept={vi.fn()}
              onViewExport={vi.fn()}
              readPersonaId="default"
              onChangeReadPersona={vi.fn()}
            />
          </AuthDialogProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Flush the AuthProvider's who-am-I microtask inside act() so the test exits clean. */
async function flushAuth() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** The §5.6 contract: the given text renders, is NOT a heading, and the panel's ONLY heading
 *  element is the widget's own h2 title. */
function expectHeadingFree(container: HTMLElement, transientTitle: string | RegExp) {
  const el = screen.getByText(transientTitle);
  expect(el.tagName, `"${String(transientTitle)}" must not be a heading element`).toBe('P');
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  expect(headings.map((h) => h.tagName.toLowerCase())).toEqual(['h2']); // the widget title alone
}

describe('§5.6 · ai-rec transient states mount no heading (component="p")', () => {
  it('loading — the Thinking… title is a <p>; the widget h2 is the only heading', async () => {
    const { container } = renderPanel(aiStub({ loading: true }));
    expectHeadingFree(container, COPY.loading.title);
    await flushAuth();
  });

  it('unavailable — the transient title is a <p>', async () => {
    const { container } = renderPanel(
      aiStub({
        rec: rec({ status: 'unavailable', strategy: null, unavailable_reason: 'transport' }),
      }),
    );
    expectHeadingFree(container, COPY.unavailable.title);
    await flushAuth();
  });

  it('BYO-key CTA (no_key) — the CTA title is a <p>', async () => {
    const { container } = renderPanel(
      aiStub({ rec: rec({ status: 'unavailable', strategy: null, unavailable_reason: 'no_key' }) }),
    );
    expectHeadingFree(container, BYO_KEY.noKey.title);
    await flushAuth();
  });

  it('no-trade verdict — the verdict is data/copy, a <p>', async () => {
    const { container } = renderPanel(
      aiStub({ rec: rec({ strategy: strategy({ decision: 'no_trade' }) }) }),
    );
    expectHeadingFree(container, COPY.noTrade.title);
    await flushAuth();
  });

  it('Trade · bias verdict — the verdict is data/copy, a <p>', async () => {
    const { container } = renderPanel(aiStub({ rec: rec() }));
    expectHeadingFree(container, 'Trade · long');
    await flushAuth();
  });
});

// ---- CommandDeck sticky condensed bar --------------------------------------------------------

function deckMarketState(): MarketState {
  return {
    ticker: 'TSLA',
    price: 415.99,
    gex_spot: 410,
    timestamp: 1,
    timestamp_iso: '2026-06-23T14:30:00Z',
    call_wall: 430,
    put_wall: 400,
    peak_gex_strike: 420,
    gamma_flip: 408,
    max_pain: 415,
    max_pain_expiration: '2026-06-26',
    net_gex: 1.2e9,
    call_gex: 2.0e9,
    put_gex: -0.8e9,
    total_gex: 1.2e9,
    vwap: 414,
    atm_iv: 45,
    hv_30d: 40,
    iv_hv_ratio: 1.12,
    put_call_ratio: 0.8,
    chain_vol_oi_ratio: 0.5,
    total_volume: 100_000,
    vol_oi_unusual_threshold: 1,
  } as MarketState;
}

let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class MockIO {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    ioCallback = cb;
  }
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
}

function DeckHarness() {
  const persona = usePersona();
  return (
    <CommandDeck
      m={deckMarketState()}
      sig={undefined}
      live={{ ticker: 'TSLA', mid: 416.5, live: true, market_session: 'regular' } as LiveUpdate}
      isLive
      streamOffline={false}
      selected={null}
      onOpenTrade={vi.fn()}
      freshness={{ snapshotIso: '2026-06-23T14:30:00Z', dataAgeSeconds: 30, refreshing: false }}
      symbol="TSLA"
      onSymbolChange={vi.fn()}
      onSubmitSymbol={vi.fn()}
      expirations={[]}
      allDates={[]}
      checked={[]}
      onSelectExpirations={vi.fn()}
      persona={persona}
      onOpenCustomize={vi.fn()}
      loading={false}
    />
  );
}

describe('§5.6 · CommandDeck condensed bar — TICKER · $price is a <p>, never a heading', () => {
  it('the sticky bar mounts a data-value paragraph, not an <h6>', () => {
    vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <DeckHarness />
        </MemoryRouter>
      </ThemeProvider>,
    );
    act(() => {
      ioCallback?.([{ isIntersecting: false }]); // deck scrolled out → the condensed bar mounts
    });
    const sticky = screen.getByTestId('deck-sticky');
    const anchor = within(sticky).getByText(/TSLA · \$/);
    expect(anchor.tagName).toBe('P');
    expect(sticky.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });
});

describe('§5.6 · OrdersWidget store-fault block is heading-free', () => {
  it('the fault title renders as a <p>; the block mounts zero heading elements', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <StoreFaultBlock />
      </ThemeProvider>,
    );
    const block = screen.getByTestId('orders-store-fault');
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
    const title = block.querySelector('p');
    expect(title?.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
