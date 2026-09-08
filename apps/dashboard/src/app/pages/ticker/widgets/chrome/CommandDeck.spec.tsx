/**
 * CommandDeck — RISK-BASED spec (qa-verify.md §4, 2026-07-13). The App-mounted flow (cold-load → live
 * → drop → reconnect, last-trade states, freshness) lives in `pages/ticker/ticker.risk.spec.tsx`; this
 * spec keeps the deck's OWN invariants where a silent regression is plausible AND invisible:
 *   1. `connectionChip` (pure unit) — the SINGLE stream-driven chip: offline SUPERSEDES a would-be
 *      live session (a stale "● live" chip over a dead stream is the invisible failure), reduced
 *      motion strips the pulse, no payload → no chip.
 *   2. The sticky condensed bar is STATE-DRIVEN: absent until the deck scrolls out, collapses back
 *      when it returns, and on an SSE drop FREEZES to the STATIC price + offline chip — never the
 *      stale live mid styled current (`[live-vs-static-isolation]`).
 *   3. The Expirations tri-state WIRE semantics: all-ticked → null (no filter), a partial pick → the
 *      explicit subset, none → [] — a refactor sending the full list instead of null changes backend
 *      scoping with zero visible UI difference.
 *   4. Ticker fidelity repair, change 3 (F3) — the masthead is bare on the ink (no raised-panel
 *      chrome), the chip row groups regime/connection/last-trade, the headline carries no
 *      parenthetical, the second line carries Levels@/Structure-as-of/refreshes/expirations, the
 *      embedded toolbar carries no bare ticker input, and the quick row forwards the caller's
 *      `universeMemberNote`. This composition WAS explicitly out of this file's scope before F3;
 *      it is now pinned because this task's own rules require a layout change to get a test.
 * NOT asserted (visible + intentional → review/page): persona picker contents, CTA wiring, loading
 * spinner, reduced-motion transition styling.
 */
import { usePersona } from '@/features/personas/usePersona';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import type { LiveUpdate, MarketState, Signals } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionStateFor } from '../../connection/connectionState';
import { resolveChipContent } from '../../connection/copy';
import type { SessionTapeOccupancy } from '../../sessionTapeStanding';
import { allRulesForClass, emotionClassOf, joinedStyleText } from '../_kit/emotionCssReader';
import { CommandDeck } from './CommandDeck';

/**
 * Migrated off the deleted `TickerHeader.connectionChip()` (curvature-v2-foundations, SPEC §2.4:
 * "the resolver moves out of `TickerHeader.tsx`"). This adapter mirrors the OLD signature/shape
 * exactly (`(live, streamOffline, reduced, routeSymbol?) => {tone,text,tip,dot,pulse,warnIcon} |
 * null`) over the NEW resolver + pure chip-content function, so the 14 call sites below need no
 * further shape changes — only the two sites asserting the now-corrected `drop`/`fault` and S0
 * `offline` copy (the literal `⚠` dropped in favour of a real icon, SPEC §4.2 Icons row).
 */
function chip(
  live: LiveUpdate | null,
  streamOffline: boolean,
  reduced: boolean,
  routeSymbol?: string,
) {
  const route = routeSymbol ?? live?.ticker ?? '';
  const state = connectionStateFor({ live, streamOffline, routeSymbol: route });
  if (state == null) return null;
  return resolveChipContent(state, live, route, reduced);
}

// ---- Fixtures --------------------------------------------------------------------------------
function marketState(over: Partial<MarketState> = {}): MarketState {
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
    net_dex: 5.0e8,
    call_dex: 6.0e8,
    put_dex: -1.0e8,
    net_vanna: null,
    net_charm: null,
    net_volga: null,
    vwap: 414,
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
    ...over,
  } as MarketState;
}
const signals: Signals = {
  ticker: 'TSLA',
  regime: 'positive_gamma',
  regime_note: null,
  vol_regime: 'neutral',
  distances: {},
  setups: [],
  opportunity_score: 73,
  opportunity_tier: 'actionable',
  prime_prompt_eligible: false,
} as Signals;

function liveUpdate(
  over: Partial<LiveUpdate> & { session_tape?: SessionTapeOccupancy } = {},
): LiveUpdate {
  return {
    ticker: 'TSLA',
    mid: 416.5,
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
    gamma_flip: 408,
    last_trade: 416.13,
    ...over,
  } as LiveUpdate;
}

function tapeOcc(over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy {
  return {
    symbol: 'SPY',
    et_date: '2026-08-10',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  };
}

// A harness that supplies the real `usePersona` (client-local, no network) to the deck.
type DeckProps = React.ComponentProps<typeof CommandDeck>;
function Harness(props: Partial<DeckProps>) {
  const persona = usePersona();
  const base: DeckProps = {
    m: marketState(),
    sig: signals,
    live: null,
    isLive: false,
    streamOffline: false,
    selected: null,
    onOpenTrade: vi.fn(),
    freshness: { snapshotIso: '2026-06-23T14:30:00Z', dataAgeSeconds: 30, refreshing: false },
    symbol: 'TSLA',
    onSymbolChange: vi.fn(),
    onSubmitSymbol: vi.fn(),
    expirations: [
      { date: '2026-06-26', dte: 3 },
      { date: '2026-07-03', dte: 10 },
    ],
    allDates: ['2026-06-26', '2026-07-03'],
    checked: ['2026-06-26', '2026-07-03'],
    onSelectExpirations: vi.fn(),
    persona,
    onOpenCustomize: vi.fn(),
    loading: false,
    routeSymbol: 'TSLA',
    onSelectQuickSymbol: vi.fn(),
    ...props,
  };
  return <CommandDeck {...base} />;
}

function renderDeck(props: Partial<DeckProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Harness {...props} />
    </ThemeProvider>,
  );
}

// A controllable IntersectionObserver so a test can toggle the sticky condensed bar without a real
// scroll (jsdom has none). The most-recent instance's callback is captured.
let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
function installIntersectionObserver() {
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
  vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
}
function setDeckVisible(visible: boolean) {
  act(() => {
    ioCallback?.([{ isIntersecting: visible }]);
  });
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  ioCallback = null;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ============================================================================================
describe('connectionChip — the single stream-driven chip (unit)', () => {
  it('live session → live chip with pulse; reduced motion strips the pulse', () => {
    const c = chip(liveUpdate({ live: true, market_session: 'regular' }), false, false);
    expect(c?.tone).toBe('info');
    expect(c?.text).toContain('live');
    expect(c?.pulse).toBe(true);
    expect(chip(liveUpdate({ live: true }), false, true)?.pulse).toBe(false);
  });

  it('stream offline SUPERSEDES a would-be live session — never a stale "live", never a pulse', () => {
    const c = chip(liveUpdate({ live: true, market_session: 'regular' }), true, false);
    expect(c?.tone).toBe('warning');
    expect(c?.text).toContain('Live offline');
    expect(c?.pulse).toBe(false);
  });

  it('no payload → no chip; no ticks in a covered session → the non-live warning (no pulse)', () => {
    expect(chip(null, false, false)).toBeNull();
    const c = chip(liveUpdate({ live: false, market_session: 'regular' }), false, false);
    expect(c?.tone).toBe('warning');
    expect(c?.pulse).toBe(false);
  });

  it('S1 starting chip is session tape · starting… not liveStatus', () => {
    const c = chip(
      liveUpdate({
        live: false,
        feed: 'session_tape',
        market_session: 'session_tape',
        session_tape: tapeOcc({ tape_time_et: null }),
      }),
      false,
      false,
      'SPY',
    );
    expect(c?.text).toBe('session tape · starting…');
    expect(c?.dot).toBe('○');
    expect(c?.pulse).toBe(false);
    expect(c?.tone).toBe('neutral');
    expect(c?.text).not.toMatch(/live|no live ticks|overnight|market closed/i);
  });

  it('S1 playing omits · 1× and prints tape HH:MM:SS ET', () => {
    const c = chip(
      liveUpdate({ live: false, feed: 'session_tape', session_tape: tapeOcc({ pace: 1 }) }),
      false,
      false,
      'SPY',
    );
    expect(c?.text).toContain('tape 09:35:00 ET');
    expect(c?.text).not.toMatch(/1×/);
    expect(c?.pulse).toBe(false);
    expect(c?.dot).toBe('○');
  });

  it('S1 playing prints · 4× when pace is 4', () => {
    const c = chip(
      liveUpdate({ live: false, feed: 'session_tape', session_tape: tapeOcc({ pace: 4 }) }),
      false,
      false,
      'SPY',
    );
    expect(c?.text).toMatch(/4×/);
  });

  it('S1 streamOffline during playing is Session tape stream dropped not live-offline', () => {
    const c = chip(
      liveUpdate({ live: false, feed: 'session_tape', session_tape: tapeOcc() }),
      true,
      false,
      'SPY',
    );
    expect(c?.text).toBe('Session tape stream dropped');
    expect(c?.text).not.toContain('Live offline');
    expect(c?.tone).toBe('warning');
  });

  it('S0 streamOffline is still Live offline reconnecting', () => {
    const c = chip(liveUpdate({ live: true, market_session: 'regular' }), true, false);
    expect(c?.text).toContain('Live offline — reconnecting…');
  });

  it('poison live true + session_tape still hollow session tape not ● live', () => {
    const c = chip(
      liveUpdate({
        live: true,
        feed: 'session_tape',
        session_tape: tapeOcc({ tape_time_et: '10:00:00' }),
      }),
      false,
      false,
      'SPY',
    );
    expect(c?.dot).toBe('○');
    expect(c?.pulse).toBe(false);
    expect(c?.text).not.toMatch(/●/);
    expect(c?.text).toMatch(/session tape/);
  });

  it('not-this-ticker chip names the armed identity', () => {
    const c = chip(
      liveUpdate({
        ticker: 'QQQ',
        live: false,
        feed: 'session_tape',
        session_tape: tapeOcc(),
      }),
      false,
      false,
      'QQQ',
    );
    expect(c?.text).toBe('session tape · SPY · Mon Aug 10 · not this ticker');
  });

  it('ended chip is session tape ended not live-offline', () => {
    const c = chip(
      liveUpdate({
        live: false,
        feed: 'session_tape',
        session_tape: tapeOcc({ phase: 'ended', tape_time_et: '16:00:00' }),
      }),
      false,
      false,
      'SPY',
    );
    expect(c?.text).toBe('session tape ended · SPY · Mon Aug 10');
    expect(c?.tone).toBe('warning');
    expect(c?.text).not.toContain('Live offline');
  });

  it('gap chip only when standing is gap', () => {
    const c = chip(
      liveUpdate({
        live: false,
        feed: 'session_tape',
        session_tape: tapeOcc({ phase: 'gap', tape_time_et: '09:40:00' }),
      }),
      false,
      false,
      'SPY',
    );
    expect(c?.text).toBe('session tape gap · SPY · Mon Aug 10');
    expect(c?.tone).toBe('warning');
  });
});

// ============================================================================================
describe('CommandDeck — sticky condensed bar (state-driven scroll condense + live isolation)', () => {
  it('is absent until the deck scrolls out, reveals with the live-correct price, and collapses back when the deck returns', () => {
    installIntersectionObserver();
    renderDeck({ live: liveUpdate({ live: true, mid: 416.5 }), isLive: true });
    expect(screen.queryByTestId('deck-sticky')).toBeNull(); // not condensed initially

    setDeckVisible(false); // deck scrolled out → condensed
    const sticky = screen.getByTestId('deck-sticky');
    expect(sticky).toHaveTextContent('TSLA · $416.50'); // live-correct anchor
    expect(within(sticky).getByText(/live/)).toBeInTheDocument();

    setDeckVisible(true); // deck back in view → expands back (no duplicate chip left in the DOM)
    expect(screen.queryByTestId('deck-sticky')).toBeNull();
  });

  it('FREEZES on an SSE drop — the STATIC price + offline chip, never the stale live mid as current', () => {
    installIntersectionObserver();
    renderDeck({
      live: liveUpdate({ live: true, mid: 416.5 }),
      isLive: false,
      streamOffline: true,
    });
    setDeckVisible(false);
    const sticky = screen.getByTestId('deck-sticky');
    expect(sticky).toHaveTextContent('TSLA · $415.99'); // static price, NOT the stale 416.50 live mid
    expect(within(sticky).getByText('Live offline — reconnecting…')).toBeInTheDocument();
    expect(within(sticky).queryByText(/● live/)).toBeNull();
  });
});

// ============================================================================================
describe('CommandDeck — Expirations tri-state wire semantics (null = all · subset · [] = none)', () => {
  it('all ticked → null; a partial pick → the explicit subset; none → []', async () => {
    const user = userEvent.setup();

    // Ticking the last unticked date reaches "all" → null (no filter), NOT the full list.
    const onAll = vi.fn();
    const r1 = renderDeck({
      selected: ['2026-06-26'],
      checked: ['2026-06-26'],
      onSelectExpirations: onAll,
    });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-07-03'));
    expect(onAll).toHaveBeenLastCalledWith(null);
    r1.unmount();

    // Unticking one from "all" → the explicit remaining subset.
    const onSubset = vi.fn();
    const r2 = renderDeck({
      selected: null,
      checked: ['2026-06-26', '2026-07-03'],
      onSelectExpirations: onSubset,
    });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-07-03'));
    expect(onSubset).toHaveBeenLastCalledWith(['2026-06-26']);
    r2.unmount();

    // Unticking the only remaining date → [] (none), NOT null.
    const onNone = vi.fn();
    renderDeck({
      selected: ['2026-06-26'],
      checked: ['2026-06-26'],
      onSelectExpirations: onNone,
    });
    await user.click(screen.getByLabelText('Expirations'));
    await user.click(screen.getByText('2026-06-26'));
    expect(onNone).toHaveBeenLastCalledWith([]);
  });
});

// ============================================================================================
describe('CommandDeck — Quick symbols row (recent-ticker-chips)', () => {
  it('renders quick-symbols BELOW the toolbar inside command-deck (AC-1)', () => {
    installIntersectionObserver();
    renderDeck({ symbol: 'TSLA' });
    const deck = screen.getByTestId('command-deck');
    const quick = within(deck).getByTestId('quick-symbols');
    const toolbar = within(deck).getByTestId('ticker-toolbar');
    // DOM order: toolbar then quick
    expect(toolbar.compareDocumentPosition(quick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sticky condensed bar has NO quick chips (AC-7)', () => {
    installIntersectionObserver();
    renderDeck({ live: liveUpdate({ live: true, mid: 416.5 }), isLive: true });
    setDeckVisible(false);
    const sticky = screen.getByTestId('deck-sticky');
    expect(within(sticky).queryByTestId('quick-symbols')).toBeNull();
    expect(within(sticky).queryByText('QUICK')).toBeNull();
  });

  it('forwards `universeMemberNote` through to the quick row, verbatim', () => {
    renderDeck({ universeMemberNote: 'Universe member · 69 tracked names' });
    expect(screen.getByTestId('quick-symbols-note')).toHaveTextContent(
      'Universe member · 69 tracked names',
    );
  });

  it('omits the quick-row note when the caller sends none (nonmember/unknown/unresolved)', () => {
    renderDeck({ universeMemberNote: null });
    expect(screen.queryByTestId('quick-symbols-note')).toBeNull();
  });
});

// ============================================================================================
// Ticker fidelity repair, change 3 (F3) — the masthead is bare on the ink
// (`design/src/screens/desk.mjs:255-288`), not a raised panel: the chip row groups regime,
// connection and last-trade; the headline carries no parenthetical; the second line carries
// Levels@/Structure-as-of/refreshes/expirations; the EMBEDDED toolbar has no bare ticker input.
// This composition was explicitly out of this file's scope before F3 (no `command-deck` chrome or
// `deck-meta` content was pinned anywhere) — every assertion below is a fresh pin.
// ============================================================================================
describe('CommandDeck — masthead composition (ticker fidelity repair F3)', () => {
  it('the deck surface carries no raised-panel chrome — no border, fill or shadow', () => {
    renderDeck();
    const deck = screen.getByTestId('command-deck');
    const cls = emotionClassOf(deck);
    expect(cls, 'command-deck should carry an emotion (sx) class').toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string)
      .join(';')
      .replace(/\s+/g, '');

    expect(rules).not.toContain('border:1pxsolid');
    expect(rules).not.toContain('box-shadow');
    expect(rules).not.toContain('border-radius');
    expect(rules).not.toMatch(/background-color:(?!transparent)/);
  });

  it('the chip row groups regime, connection and last-trade on one row, ahead of the headline', () => {
    // A real `live` update, not the pre-first-fact placeholder (rule 18) — so the RESOLVED chip
    // (`connection-chip`, not `connection-chip-placeholder`) is the one under test.
    renderDeck({ live: liveUpdate({ live: true, mid: 416.5 }), isLive: true });
    const deck = screen.getByTestId('command-deck');
    const connectionChip = within(deck).getByTestId('connection-chip');
    const lastTrade = within(deck).getByTestId('last-trade');
    const headline = screen.getByRole('heading', { level: 1 });
    const deckMeta = within(deck).getByTestId('deck-meta');

    // Same row: last-trade's row-level ancestor also contains the connection chip.
    const chipRow = connectionChip.closest('div');
    expect(chipRow).not.toBeNull();
    expect(chipRow?.contains(lastTrade)).toBe(true);

    // Chip row before the headline; headline before the second line.
    expect(
      (chipRow?.compareDocumentPosition(headline) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      headline.compareDocumentPosition(deckMeta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('the headline carries only symbol + mid — no "(levels @ … · expirations)" parenthetical', () => {
    renderDeck({ m: marketState({ ticker: 'TSLA', price: 415.99, gex_spot: 410 }) });
    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline).toHaveTextContent('TSLA · $415.99');
    expect(headline.textContent).not.toContain('levels @');
    expect(headline.textContent).not.toContain('expiration');
  });

  it('the second line carries Levels@, Structure as-of, the documented refresh cadence, and the expirations count', () => {
    renderDeck({
      m: marketState({ gex_spot: 410 }),
      selected: ['2026-06-26', '2026-07-03'],
      freshness: { snapshotIso: null, dataAgeSeconds: 30, refreshing: false },
    });
    const meta = screen.getByTestId('deck-meta');
    expect(meta).toHaveTextContent('Levels @ $410.00');
    expect(meta).toHaveTextContent('Structure as-of');
    expect(meta).toHaveTextContent('refreshes ~60s');
    expect(meta).toHaveTextContent('2 expirations');
  });

  it('all expirations selected reads "All expirations" on the second line, not a bare count', () => {
    renderDeck({ selected: null });
    expect(screen.getByTestId('deck-meta')).toHaveTextContent('All expirations');
  });

  it('the embedded toolbar (inside the deck) carries no bare ticker input — EXPIRATIONS/PERSONA only', () => {
    renderDeck();
    const toolbar = screen.getByTestId('ticker-toolbar');
    expect(within(toolbar).queryByLabelText('Ticker')).toBeNull();
    expect(document.getElementById('ticker-input')).toBeNull();
    expect(within(toolbar).getByLabelText('Expirations')).toBeInTheDocument();
  });
});
