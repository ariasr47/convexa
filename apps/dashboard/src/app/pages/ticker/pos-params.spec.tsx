/**
 * `additive-keeps-score-byte-identical`, at the wire (SPEC §7 invariant 10; AC-74, AC-77, AC-83).
 *
 * THE CLAIM: suppression is a RENDER decision ONLY. The `pos_*` request is UNCONDITIONAL and its
 * shape NEVER branches — not on leg count, not on position count — so a multi-leg (or
 * three-position) `pos_*` request appearing in the network tab is CORRECT, not a defect, and the
 * owner can revisit either suppression after ship without re-architecture.
 *
 * Risk-based: what is automated here is the REQUEST SHAPE and the three-way render, both of which
 * regress silently. The copy for a future alert surface is not asserted — no consumer ships.
 *
 * Mounts the REAL Ticker page through the route table, mocking ONLY `fetch` + `EventSource`. The
 * fetch mock is STRICT: an unexpected endpoint throws, so "no hidden request" holds by construction.
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { evalSubjectOf, tickerEvalSubject } from '@/features/trading/positions/evalSubject';
import type { SimPosition } from '@/features/trading/positions/leg';
import { liftLegacyRecord } from '@/features/trading/positions/migrate';
import { __resetMemory, putPosition } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import type { TickerBundle } from '@convexa/api';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- the network boundary, and nothing else -----------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;
let bundle: TickerBundle;

/** Every `/api/ticker/` URL this render issued, in order. */
const tickerUrls = () =>
  fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/api/ticker/'));

/** The PARAM KEY SET of the last bundle request — the thing that must never branch. */
function lastParamKeys(): string[] {
  const urls = tickerUrls();
  const qs = urls[urls.length - 1]?.split('?')[1] ?? '';
  return [...new URLSearchParams(qs).keys()].sort();
}

function posParams(): Record<string, string> {
  const urls = tickerUrls();
  const qs = urls[urls.length - 1]?.split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(qs)) if (k.startsWith('pos_')) out[k] = v;
  return out;
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  bundle = makeBundle();

  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
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
    if (url.includes('/api/auth/session'))
      return json({ authenticated: false, user: null, google_available: false, settings: null });
    if (url.includes('/api/ticker/')) return json(bundle);
    if (url.includes('/api/recommendation/status/'))
      return json({
        availability: { in_app_enabled: true },
        gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
        cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
      });
    if (url.includes('/api/personas'))
      return json([{ id: 'default', name: 'Default (no persona)' }]);
    if (url.includes('/api/contract/')) return json(null);
    if (url.includes('/history'))
      return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
    throw new Error(`Unexpected fetch from the Ticker page: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- durable seeds, all through the ONE lift ----------------------------------------------------

const optionLeg = (over: Record<string, unknown> = {}) => ({
  id: `l-${Math.random().toString(36).slice(2)}`,
  kind: 'option',
  ticker: 'TSLA',
  side: 'long',
  qty: 1,
  multiplier: 100,
  entry_price: 12.4,
  entry_basis: 'user_entered',
  expiration: '2026-08-21',
  strike: 400,
  right: 'call',
  ...over,
});

function seed(id: string, legs: Record<string, unknown>[], over: Record<string, unknown> = {}) {
  const p = liftLegacyRecord({
    id,
    ticker: legs[0].ticker,
    expiration: legs[0].expiration,
    strike: legs[0].strike,
    right: legs[0].right,
    qty: legs[0].qty,
    entry_mark: legs[0].entry_price,
    entry_basis: 'user_entered',
    entry_time: '2026-06-12T15:32:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    legs,
    ...over,
  }) as SimPosition;
  putPosition(p);
  return p;
}

const seedSingleLeg = (id = 'p-single') => seed(id, [optionLeg()]);
const seedCondor = (id = 'p-condor') =>
  seed(id, [
    optionLeg({ strike: 440 }),
    optionLeg({ strike: 420, side: 'short', entry_price: 6.1 }),
    optionLeg({ strike: 380, right: 'put', side: 'short', entry_price: 5 }),
    optionLeg({ strike: 360, right: 'put', entry_price: 2.5 }),
  ]);
const seedShares = (id = 'p-shares') =>
  seed(id, [
    {
      ...optionLeg(),
      kind: 'equity',
      qty: 100,
      multiplier: 1,
      entry_price: 250,
      expiration: null,
      strike: null,
      right: null,
    },
  ]);

async function mount() {
  const r = render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/ticker/TSLA']}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
  await screen.findByText('Call wall');
  await waitFor(() => expect(tickerUrls().length).toBeGreaterThan(0));
  return r;
}

// =================================================================================================
// The request shape — it NEVER branches
// =================================================================================================

describe('AC-74/AC-77 — the pos_* request shape never branches', () => {
  it('issues the SAME pos_* param set for a single-leg and a multi-leg position', async () => {
    seedSingleLeg();
    await mount();
    const single = lastParamKeys();
    expect(single).toContain('pos_expiration');
    expect(single).toContain('pos_strike');
    expect(single).toContain('pos_right');

    cleanup();
    __resetMemory();
    localStorage.clear();
    fetchMock.mockClear();
    seedCondor();
    await mount();
    expect(lastParamKeys()).toEqual(single);
  });

  it('B1/AC-83 — issues the SAME pos_* param set when the ticker holds THREE open positions', async () => {
    seedSingleLeg('p-1');
    await mount();
    const one = lastParamKeys();

    cleanup();
    fetchMock.mockClear();
    seedSingleLeg('p-2');
    seedSingleLeg('p-3');
    await mount();
    // Unconditional: it does NOT disappear, shrink, or gain a param when N > 1.
    expect(lastParamKeys()).toEqual(one);
    expect(Object.keys(posParams())).toHaveLength(3);
  });

  it('B1 — the request is issued even while the evaluation is SUPPRESSED (render-only)', async () => {
    const a = seedSingleLeg('p-1');
    const b = seedSingleLeg('p-2');
    await mount();
    // The projection says SUPPRESSED…
    const sel = tickerEvalSubject([a, b], 'TSLA');
    expect(sel.suppressed).toBe(true);
    expect(sel.subject).toEqual({ kind: 'none', reason: 'multiple_positions' });
    // …and the request went out anyway, carrying the pos_* triple.
    expect(Object.keys(posParams()).sort()).toEqual(['pos_expiration', 'pos_right', 'pos_strike']);
  });

  it('0 open positions — no pos_* params at all, exactly as today', async () => {
    await mount();
    expect(posParams()).toEqual({});
    expect(tickerEvalSubject([], 'TSLA').subject).toEqual({
      kind: 'none',
      reason: 'no_option_leg',
    });
  });

  it('a CLOSED position on the ticker contributes no pos_* params (as today)', async () => {
    seed('p-closed', [optionLeg()], { status: 'closed' });
    await mount();
    expect(posParams()).toEqual({});
  });

  it('never adds a NEW query parameter to the bundle request', async () => {
    seedCondor();
    await mount();
    const allowed = new Set([
      'min_dte',
      'max_dte',
      'expirations',
      'dark_pool',
      'pos_expiration',
      'pos_strike',
      'pos_right',
      'pos_pl_pct',
    ]);
    for (const k of lastParamKeys()) expect(allowed.has(k), `unexpected param ${k}`).toBe(true);
  });

  it('opportunity score and tier are unchanged by any position activity', async () => {
    // (v2, curvature-v2-desk-and-read FE-8) the opportunity cell moved from the old dealer
    // positioning widget's
    // grid (deleted) to the read strip's own `opportunity` slot — same value, new address.
    await mount();
    const before = await screen.findByTestId('read-strip-cell-opportunity');
    const scoreBefore = before.textContent;

    cleanup();
    fetchMock.mockClear();
    seedCondor();
    seedSingleLeg('p-extra');
    await mount();
    expect((await screen.findByTestId('read-strip-cell-opportunity')).textContent).toBe(
      scoreBefore,
    );
  });
});

// =================================================================================================
// The three-way render (B1 / AC-83) + the leg-level rule (ruling #9)
// =================================================================================================

describe('AC-83 — position-context behaviour is three-way by OPEN-POSITION COUNT', () => {
  it('0 open positions on the focused ticker — behaves as today', () => {
    const sel = tickerEvalSubject([], 'TSLA');
    expect(sel.position).toBeNull();
    expect(sel.queryLeg).toBeNull();
    expect(sel.suppressed).toBe(true);
  });

  it('exactly 1 single-option position — BYTE-IDENTICAL to today: surfaced, whole_position', () => {
    const p = seedSingleLeg();
    const sel = tickerEvalSubject([p], 'TSLA');
    expect(sel.suppressed).toBe(false);
    expect(sel.subject).toEqual({ kind: 'whole_position', leg_id: p.legs[0].id });
    // …and the leg the request is read off IS that leg.
    expect(sel.queryLeg?.id).toBe(p.legs[0].id);
  });

  it('exactly 1 MULTI-LEG position — suppressed at LEVEL 2 (ruling #9), still primary_leg', () => {
    const p = seedCondor();
    const sel = tickerEvalSubject([p], 'TSLA');
    expect(sel.suppressed).toBe(true);
    expect(sel.subject.kind).toBe('primary_leg');
    expect(sel.queryLeg).not.toBeNull(); // the REQUEST is still well defined
  });

  it('more than 1 — suppressed, carrying EvalNoneReason.multiple_positions, never a silent null', () => {
    const a = seedSingleLeg('p-1');
    const b = seedSingleLeg('p-2');
    const c = seedSingleLeg('p-3');
    const sel = tickerEvalSubject([a, b, c], 'TSLA');
    expect(sel.suppressed).toBe(true);
    expect(sel.subject).toEqual({ kind: 'none', reason: 'multiple_positions' });
    // The pick is DETERMINISTIC (lowest id) so the request shape cannot flap between reloads…
    expect(sel.position?.id).toBe('p-1');
    expect(tickerEvalSubject([c, a, b], 'TSLA').position?.id).toBe('p-1');
    // …and it never reaches a surface: `subject` is what a renderer reads, and it says `none`.
  });

  it('positions on OTHER tickers do not count toward the focused ticker`s tally', () => {
    const tsla = seedSingleLeg('p-tsla');
    const nvda = seed('p-nvda', [optionLeg({ ticker: 'NVDA', strike: 170, right: 'put' })]);
    const sel = tickerEvalSubject([tsla, nvda], 'TSLA');
    expect(sel.suppressed).toBe(false); // still exactly ONE TSLA position
    expect(sel.subject.kind).toBe('whole_position');
  });

  it('AC-75 — a shares-only position carries an EXPLICIT reason, not an ambiguous null', () => {
    const p = seedShares();
    expect(evalSubjectOf(p)).toEqual({ kind: 'none', reason: 'no_option_leg' });
    const sel = tickerEvalSubject([p], 'TSLA');
    expect(sel.suppressed).toBe(true);
    expect(sel.subject).toEqual({ kind: 'none', reason: 'no_option_leg' });
    expect(sel.queryLeg).toBeNull(); // nothing to key a pos_* request off, so none is sent
  });

  it('AC-74 — no position-context evaluation is SURFACED for a multi-leg position, on any surface', async () => {
    seedCondor();
    bundle = {
      ...makeBundle(),
      position_eval: {
        fingerprint: 'fp-1',
        changed: true,
        verdict: 'reassess',
      },
    } as unknown as TickerBundle;
    await mount();
    // The bundle CARRIES an evaluation (the request is unconditional, so the server answered) and
    // the app surfaces none of it: no alert, no reassessment hand-off, no assessment readout.
    expect(screen.queryByText(/reassess/i)).toBeNull();
    expect(document.body.textContent).not.toContain('fp-1');
  });
});
