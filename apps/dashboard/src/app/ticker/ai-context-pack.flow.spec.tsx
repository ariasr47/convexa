/**
 * ai-context-pack — Suite B (flow-integration CENTERPIECE, FRONTEND_EXECUTION_CONTRACT §5).
 * Drives the REAL ticker journey end-to-end, mounting the actual ticker subtree (via <App/>) and
 * mocking ONLY the network boundary (`fetch` + a controllable `EventSource`) — NEVER a live backend.
 *
 * Required matrix cases:
 *   - T-AC-8   refresh rule: SSE ticks change NOTHING in the widget (byte-identical); a new bundle
 *              with different pack values re-renders it.
 *   - T-AC-9   stale bundle ⇒ the page's EXISTING staleness presentation only (freshness line /
 *              "Couldn't refresh…" after a failed refresh); the widget adds NO per-widget stale
 *              badge and NO freshness claim of its own.
 *   - T-AC-10  the ISOLATION centerpiece: on an SSE drop all four reads stay visible + un-dimmed
 *              with NO `⏸ offline`, while — as the contrast control — the LiveTape tiles DO dim and
 *              show `⏸ offline`; on reconnect the pack is unchanged until the next bundle.
 *   - T-AC-11  (FE face) structural: props accept ONLY the pack (+ optional revealIndex); no
 *              live/offline prop exists (compile-time), nothing reads the SSE hook or watchdog.
 *   - T-AC-19  the StateExportDrawer ("View what's sent") contains `market_context` with the SAME
 *              values the page renders.
 *   - T-AC-20  a null read in the bundle shows null in the export — never a fabricated value.
 *   - T-AC-21  (FE face) the Default-persona hand-off assembly is byte-identical with vs without
 *              the pack and mentions none of its fields.
 *   - T-AC-26  (FE face) trader routes render nothing pack-related from `meta` (trace_id/timings
 *              present in the mock, incl. a context_pack stage span).
 *   - Extras:  bundle-level missing key (pre-feature backend) ⇒ L5 with clean console; whole-pack
 *              null never blanks/errors the rest of the board.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { LiveUpdate, MarketContextPack, MetaTimings, TickerBundle } from '@org/api';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../app';
import { PRESETS } from '../personas/presets';
import { assembleHandoff } from '../personas/template';
import { __resetMemory } from '../positions/store';
import { theme } from '../theme';
import { MC_ATR_EMPTY, MC_WHOLE_EMPTY } from './widgets/copy';
import { MarketContext } from './widgets/MarketContext';

const PACK_DEFAULT: MarketContextPack = {
  trend_momentum: {
    as_of_session: '2026-07-03',
    direction: {
      label: 'uptrend',
      close: 178.4,
      ema20: 176.21,
      ema50: 171.83,
      window: 'close vs EMA20 vs EMA50, daily closes',
      thresholds: 'fixed',
    },
    strength: {
      label: 'strong',
      adx: 28.4,
      window: 'ADX(14), Wilder, daily high/low/close',
      thresholds: 'fixed',
    },
    momentum: {
      label: 'neutral',
      rsi: 51.2,
      window: 'RSI(14), Wilder, daily closes',
      thresholds: 'fixed',
    },
  },
  gex_profile_shape: {
    concentration: 0.41,
    concentration_label: 'concentrated',
    balance: 0.34,
    balance_label: 'above_skewed',
    center_of_mass_distance: 0.012,
    eligible_strikes: 23,
    spot_basis: 178.4,
    thresholds: 'fixed',
  },
  flow_vs_positioning: {
    flow_basis: 'today volume vs standing OI (wire descriptor)',
    location: { label: 'rotating', distribution_shift: 0.42, thresholds: 'fixed' },
    composition: {
      label: 'consistent',
      volume_pcr: 0.92,
      oi_pcr: 0.88,
      tilt_ratio: 1.05,
      thresholds: 'fixed',
    },
  },
  atr: {
    as_of_session: '2026-07-03',
    close_basis: 178.4,
    method: 'simple mean of true range (wire descriptor)',
    atr_5d: { value: 4.12, pct_of_close: 2.31, window_bars: 5 },
    atr_14d: { value: 3.87, pct_of_close: 2.17, window_bars: 14 },
    atr_30d: { value: 3.51, pct_of_close: 1.97, window_bars: 30 },
  },
};

/** A sentinel meaning "omit the field entirely" (pre-feature / older-backend shape) — distinct from a
 *  `null` field (a legitimate whole-pack-null cycle). */
const ABSENT = Symbol('market_context absent');

function makeBundle(pack: MarketContextPack | null | typeof ABSENT = PACK_DEFAULT): TickerBundle {
  const market_state: TickerBundle['market_state'] = {
    ticker: 'TSLA',
    price: 250.5,
    gex_spot: 250,
    timestamp: 1,
    timestamp_iso: '2026-06-23T14:30:00Z',
    call_wall: 260,
    put_wall: 240,
    peak_gex_strike: 255,
    gamma_flip: 248,
    max_pain: 250,
    max_pain_expiration: '2026-06-26',
    net_gex: 1.2e9,
    call_gex: 2.0e9,
    put_gex: -0.8e9,
    total_gex: 1.2e9,
    net_dex: 5.0e8,
    call_dex: 6.0e8,
    put_dex: -1.0e8,
    net_vanna: null,
    net_charm: null,
    net_volga: null,
    vwap: 249,
    vwap_upper_2: null,
    vwap_upper_3: null,
    vwap_lower_2: null,
    vwap_lower_3: null,
    dte_min: null,
    dte_max: null,
    atm_iv: 45,
    hv_30d: 40,
    iv_hv_ratio: 1.12,
    net_flow: null,
    put_call_ratio: 0.8,
    chain_vol_oi_ratio: 0.5,
    total_volume: 100_000,
    vol_oi_unusual_threshold: 1,
    iv_skew: null,
    term_structure: null,
    dealer_flow_projection: null,
    market_context: pack === ABSENT ? null : pack,
  };
  // The ABSENT sentinel ⇒ the KEY is omitted entirely (the pre-feature / older-backend shape).
  if (pack === ABSENT) delete (market_state as { market_context?: unknown }).market_context;
  return {
    market_state,
    signals: {
      ticker: 'TSLA',
      regime: 'positive_gamma',
      regime_note: null,
      vol_regime: 'neutral',
      distances: {},
      setups: [],
      opportunity_score: 73,
      opportunity_tier: 'actionable',
      prime_prompt_eligible: false,
    },
    strike_profile: { ticker: 'TSLA', spot: 250.5, strikes: [] },
    expirations: [
      { date: '2026-06-26', dte: 3 },
      { date: '2026-07-17', dte: 24 },
    ],
    ai_eval: {
      ready: false,
      reasons: [],
      changed: false,
      state_fingerprint: 'fp-byte-identical',
      score_threshold: 60,
    },
    meta: {
      served_at: '2026-06-23T14:30:00Z',
      cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
      freshness: {
        snapshot_iso: '2026-06-23T14:30:00Z',
        data_age_seconds: 30,
        stale: false,
        stale_after_seconds: 600,
      },
    },
    off_exchange: {
      ratio_pct: 38,
      offex_shares: 38_000,
      total_shares: 100_000,
      levels: [],
      blocks: [],
      block_min_shares: 5000,
      note: '',
    },
    position_eval: null,
  };
}

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'TSLA',
    mid: 251,
    bid: null,
    ask: null,
    spread: 0.05,
    net_flow: 1200,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: true,
    tick_age_s: 1,
    market_session: 'regular',
    feed: 'realtime',
    ts: Date.now(),
    gamma_flip: 248,
    last_trade: 251.13,
    ...over,
  };
}

interface MockES {
  onmessage: ((e: MessageEvent) => void) | null;
  closed: boolean;
}
let esInstances: MockES[] = [];
/** The bundle (or an error) the fetch mock serves for the CURRENT ticker request. */
let bundleForUrl: (url: string) => TickerBundle | { __error: number } = () => makeBundle();
let exportContext: unknown = null;
let fetchMock: ReturnType<typeof vi.fn>;

function pushLive(over: Partial<LiveUpdate> = {}) {
  act(() => {
    esInstances.forEach((es) =>
      es.onmessage?.({ data: JSON.stringify(liveUpdate(over)) } as MessageEvent),
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  esInstances = [];
  bundleForUrl = () => makeBundle();
  exportContext = null;

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    closed = false;
    constructor() {
      esInstances.push(this as unknown as MockES);
    }
    close() {
      this.closed = true;
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (b: unknown) =>
      new Response(JSON.stringify(b), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/api/ticker/')) {
      const b = bundleForUrl(url);
      if ('__error' in (b as object))
        return new Response('{"detail":"boom"}', { status: (b as { __error: number }).__error });
      return json(b);
    }
    if (url.includes('/api/recommendation/export/')) {
      return json({
        ticker: 'TSLA',
        as_of: '2026-06-23T14:30:00Z',
        context: exportContext,
        persona_prompt: 'PROMPT',
        glossary: 'GLOSSARY',
        egress_note: 'Complete list of what leaves the machine…',
      });
    }
    if (url.includes('/api/recommendation/status/')) {
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    }
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

// ============================================================================================
describe('ai-context-pack — flow (the static-read journey)', () => {
  it('T-AC-8: SSE ticks change NOTHING in the widget (byte-identical); a NEW bundle with different pack values updates it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let current: MarketContextPack = PACK_DEFAULT;
    bundleForUrl = () => makeBundle(current);
    renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');

    const before = screen.getByTestId('market-context').textContent;
    // A flurry of live ticks (mid / net-flow moves) must NOT move the static read.
    pushLive({ live: true, mid: 300, net_flow: 9_999, last_trade: 300 });
    pushLive({ live: true, mid: 305, net_flow: -4_200, last_trade: 305 });
    expect(screen.getByTestId('market-context').textContent).toBe(before);

    // Bundle B (next poll, 60s) carries different pack values → the widget re-renders from it.
    current = {
      ...PACK_DEFAULT,
      trend_momentum: {
        ...PACK_DEFAULT.trend_momentum!,
        direction: { ...PACK_DEFAULT.trend_momentum!.direction!, label: 'downtrend', close: 170.1 },
      },
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await screen.findByText('Downtrend');
    expect(screen.queryByText('Uptrend')).toBeNull();
  });

  it('T-AC-9: a stale bundle shares the page-level staleness presentation ONLY — no per-widget stale badge or freshness claim', async () => {
    bundleForUrl = () => {
      const b = makeBundle(PACK_DEFAULT);
      return {
        ...b,
        meta: {
          ...b.meta,
          freshness: { ...b.meta.freshness, stale: true, data_age_seconds: 7200 },
        },
      };
    };
    renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');

    // The page-level freshness presentation exists (the CommandDeck freshness line)…
    expect(screen.getByTestId('freshness-line')).toBeInTheDocument();
    // …while the widget itself claims NOTHING about freshness and carries no stale badge.
    const widget = screen.getByTestId('widget-market-context');
    expect(within(widget).queryByText(/stale/i)).toBeNull();
    expect(within(widget).queryByText(/Updated .* ago/)).toBeNull();
    expect(within(widget).queryByTestId('freshness-line')).toBeNull();
    // The values still render (never blanked on stale).
    expect(within(widget).getByText('$4.12 · 2.3%')).toBeInTheDocument();
  });

  it('T-AC-9b: a FAILED refresh after a prior success keeps the widget rendering behind the page-level "Couldn\'t refresh" warning', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bundleForUrl = () => makeBundle(PACK_DEFAULT);
    renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');

    // The next poll fails → the page's soft warning appears; the widget NEVER blanks.
    bundleForUrl = () => ({ __error: 500 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await screen.findByText(/Couldn't refresh/);
    expect(screen.getByText('Uptrend')).toBeInTheDocument();
    expect(screen.getByText('$4.12 · 2.3%')).toBeInTheDocument();
    // The widget adds no badge/claim of its own.
    const widget = screen.getByTestId('widget-market-context');
    expect(within(widget).queryByText(/Couldn't refresh|stale/i)).toBeNull();
  });

  it('T-AC-10 (isolation centerpiece): on an SSE drop the widget is byte-identical + un-dimmed with NO ⏸, while LiveTape DID go offline; reconnect changes nothing until the next bundle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bundleForUrl = () => makeBundle(PACK_DEFAULT);
    renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');

    const widget = screen.getByTestId('widget-market-context');
    const before = screen.getByTestId('market-context').textContent;

    // Go live, then drop the stream (no payload for > STREAM_OFFLINE_MS).
    pushLive({ live: true, last_trade: 251.13 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    // CONTRAST CONTROL: the LiveTape tiles DID go offline (⏸ offline caption present there).
    const liveTape = screen.getByTestId('live-tape');
    expect(within(liveTape).getAllByText('⏸ offline').length).toBeGreaterThan(0);

    // The Market context widget: byte-identical, un-dimmed, NO ⏸/offline caption of its own.
    expect(screen.getByTestId('market-context').textContent).toBe(before);
    expect(within(widget).queryByText(/⏸/)).toBeNull();
    expect(within(widget).queryByText(/offline/i)).toBeNull();
    expect(
      getComputedStyle(widget).opacity === '' || getComputedStyle(widget).opacity === '1',
    ).toBe(true);
    // All four reads still visible.
    expect(within(widget).getByText('Uptrend')).toBeInTheDocument();
    expect(within(widget).getByText('Concentrated')).toBeInTheDocument();
    expect(within(widget).getByText('Rotating')).toBeInTheDocument();
    expect(within(widget).getByText('$4.12 · 2.3%')).toBeInTheDocument();

    // Reconnect (a new payload clears offline): the pack is UNCHANGED until the next bundle.
    pushLive({ live: true, mid: 260 });
    expect(screen.getByTestId('market-context').textContent).toBe(before);
  });

  it('T-AC-11 (FE face, structural): props accept ONLY the pack (+ optional revealIndex) — no live/offline prop exists', () => {
    type P = ComponentProps<typeof MarketContext>;
    // Compile-time closure of the props surface: any added live/offline prop breaks this line.
    const onlyDeclaredProps: keyof P extends 'pack' | 'revealIndex' ? true : false = true;
    expect(onlyDeclaredProps).toBe(true);
    // And the live props CANNOT be passed (excess-property check would reject them).
    type Forbidden = 'isLive' | 'streamOffline' | 'offline';
    const noLiveProp: Extract<keyof P, Forbidden> extends never ? true : false = true;
    expect(noLiveProp).toBe(true);
  });

  it("T-AC-19: the StateExportDrawer ('View what's sent') contains market_context with the SAME values the page renders", async () => {
    const user = userEvent.setup();
    const bundle = makeBundle(PACK_DEFAULT);
    bundleForUrl = () => bundle;
    exportContext = bundle.market_state; // the export serializes market_state wholesale (BE-proven)
    renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');

    await user.click(screen.getAllByRole('button', { name: "View what's sent" })[0]);
    await screen.findByText('Computed snapshot (context)');
    const pre = Array.from(document.querySelectorAll('pre'))
      .map((p) => p.textContent ?? '')
      .join('\n');
    // The pack rides the export…
    expect(pre).toContain('"market_context"');
    // …with the SAME values the page renders (spot-check labels + scalars against the rendered UI).
    expect(pre).toContain('"label": "uptrend"'); // page shows: Uptrend
    expect(screen.getByText('Uptrend')).toBeInTheDocument();
    expect(pre).toContain('"adx": 28.4'); // page shows: ADX(14) 28.4
    expect(screen.getByText('ADX(14) 28.4')).toBeInTheDocument();
    expect(pre).toContain('"concentration": 0.41'); // page shows: HHI 0.41
    expect(screen.getByText('HHI 0.41')).toBeInTheDocument();
    expect(pre).toContain('"distribution_shift": 0.42'); // page shows: shift 0.42
    expect(screen.getByText('shift 0.42')).toBeInTheDocument();
    expect(pre).toContain('"value": 4.12'); // page shows: $4.12 · 2.3%
    expect(screen.getByText('$4.12 · 2.3%')).toBeInTheDocument();
  });

  it('T-AC-20: a null read in the bundle is null in the export too — never a fabricated value', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ ...PACK_DEFAULT, atr: null });
    bundleForUrl = () => bundle;
    exportContext = bundle.market_state;
    renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');
    // The page shows the ATR read's unavailable state…
    expect(screen.getByText(MC_ATR_EMPTY)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: "View what's sent" })[0]);
    await screen.findByText('Computed snapshot (context)');
    const pre = Array.from(document.querySelectorAll('pre'))
      .map((p) => p.textContent ?? '')
      .join('\n');
    // …and the export carries that read as null — no fabricated horizon values anywhere.
    expect(pre).toContain('"atr": null');
    expect(pre).not.toContain('"atr_5d"');
    expect(pre).toContain('"market_context"'); // the pack itself still rides
  });

  it('T-AC-21 (FE face): the Default-persona hand-off assembly is byte-identical with vs without the pack and never mentions it', async () => {
    const DEFAULT = PRESETS.find((p) => p.id === 'default')!;
    // With the pack in the bundle…
    bundleForUrl = () => makeBundle(PACK_DEFAULT);
    const withPack = renderAt('/ticker/TSLA');
    await within(withPack.container).findByText('Uptrend');
    const handoffWith = assembleHandoff(DEFAULT);
    withPack.unmount();

    // …and without it (pre-feature bundle).
    bundleForUrl = () => makeBundle(ABSENT);
    const withoutPack = renderAt('/ticker/TSLA');
    await within(withoutPack.container).findByText(MC_WHOLE_EMPTY);
    const handoffWithout = assembleHandoff(DEFAULT);
    withoutPack.unmount();

    // Byte-identical assembly (the pack is export-ride-along only; no template change).
    expect(handoffWithout.entry.text).toBe(handoffWith.entry.text);
    expect(handoffWithout.reassessment.text).toBe(handoffWith.reassessment.text);
    // No mention of the pack or its fields in either prompt.
    const NO_PACK =
      /market_context|trend_momentum|gex_profile_shape|flow_vs_positioning|\batr\b|market context/i;
    expect(handoffWith.entry.text).not.toMatch(NO_PACK);
    expect(handoffWith.reassessment.text).not.toMatch(NO_PACK);
  });

  it('T-AC-26 (FE face): trader routes render NOTHING pack-related from meta (trace_id + a context_pack stage present in the mock)', async () => {
    bundleForUrl = () => {
      const b = makeBundle(PACK_DEFAULT);
      return {
        ...b,
        meta: {
          ...b.meta,
          trace_id: 'trace-abc-123',
          timings: {
            total_ms: 120,
            stages: [
              { stage: 'engine_build', kind: 'cpu_engine', duration_ms: 40, status: 'ok' },
              { stage: 'context_pack', kind: 'cpu_engine', duration_ms: 3.2, status: 'ok' },
            ],
            vendor_calls: [],
          } as unknown as MetaTimings,
        },
      };
    };
    const { container } = renderAt('/ticker/TSLA');
    await screen.findByText('Uptrend');
    // Nothing operator-facing leaks onto the trader route.
    expect(container.textContent).not.toContain('context_pack');
    expect(container.textContent).not.toContain('trace-abc-123');
    expect(container.textContent).not.toContain('duration_ms');
  });

  it('extra (T-AC-18 flow face): a PRE-FEATURE bundle (key absent) renders the whole-pack unavailable state — no crash, console clean', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bundleForUrl = () => makeBundle(ABSENT);
    renderAt('/ticker/TSLA');
    await screen.findByText(MC_WHOLE_EMPTY);
    // The board is intact around it (walls + score render; no error screen).
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText(/73 ·/)).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('extra (T-AC-17 flow face): a whole-pack-null cycle never blanks/errors the rest of the board (isolation)', async () => {
    bundleForUrl = () => makeBundle(null);
    renderAt('/ticker/TSLA');
    await screen.findByText('Call wall');
    expect(screen.getByText('$260')).toBeInTheDocument();
    expect(screen.getByText(/73 ·/)).toBeInTheDocument();
    expect(screen.getByText(MC_WHOLE_EMPTY)).toBeInTheDocument();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('extra: window re-selection re-fetches and re-renders the shape read from the NEW bundle (window-scoped basis)', async () => {
    // The shape read is window-scoped (its DTE basis is the bundle's dte_min/dte_max): a narrowed
    // expiration selection produces a NEW bundle whose shape values replace the old ones.
    const wide = PACK_DEFAULT;
    const narrow: MarketContextPack = {
      ...PACK_DEFAULT,
      gex_profile_shape: {
        ...PACK_DEFAULT.gex_profile_shape!,
        concentration: 0.12,
        concentration_label: 'dispersed',
        eligible_strikes: 7,
      },
    };
    bundleForUrl = (url) => makeBundle(url.includes('expirations=') ? narrow : wide);
    renderAt('/ticker/TSLA');
    await screen.findByText('Concentrated');

    const select = screen.getByLabelText('Expirations');
    fireEvent.mouseDown(select);
    const option = await screen.findByText('2026-06-26');
    fireEvent.click(option);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    await screen.findByText('Dispersed');
    expect(screen.getByText('HHI 0.12')).toBeInTheDocument();
    expect(screen.queryByText('Concentrated')).toBeNull();
    expect(
      screen.getByText('At spot $178.40 · 7 strikes in the selected window'),
    ).toBeInTheDocument();
  });
});
