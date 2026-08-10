/**
 * Integration — `usePortfolio` emits `PositionView[]` over a de-duplicated per-LEG fan-out, on the
 * cut-over `convexa.positions.v3` store (SPEC §2.5, §2.7; AC-38, AC-39, AC-40, AC-42, AC-43).
 *
 * Risk-based. The four things here regress silently and are invisible to review:
 *   1. the fan-out DE-DUPLICATION — two positions sharing one contract must issue ONE lookup, and
 *      an equity leg must issue NONE (a regression just costs quota and looks fine);
 *   2. per-contract ISOLATION — one contract's 404 marks only the legs that reference it;
 *   3. `live-vs-static-isolation` — an SSE drop leaves a last-known number PRESENT, never blanked;
 *   4. all-or-nothing withholding, and the excluded-but-COUNTED subtotal.
 *
 * Mocks ONLY the network boundary (`@convexa/api`'s `fetchTrackedContract`) — never the store, never the
 * derivation, never a live backend.
 */
import type { LiveUpdate, TickerBundle, TrackedContract } from '@convexa/api';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveGroups } from './derive';
import type { SimPosition } from './leg';
import { liftLegacyRecord } from './migrate';
import { PORTFOLIO_V2_KEY, PORTFOLIO_V3_KEY, __resetMemory, putPosition } from './store';
import type { Position } from './types';
import { usePortfolio } from './usePortfolio';

// The ONLY mocked boundary. `vi.mock` is hoisted, so the spy lives in a module-scope holder.
const fetchSpy = vi.fn<(ticker: string, q: Record<string, unknown>) => Promise<unknown>>();
vi.mock('@convexa/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@convexa/api')>();
  return {
    ...actual,
    fetchTrackedContract: (ticker: string, q: Record<string, unknown>) => fetchSpy(ticker, q),
  };
});

function quote(over: Partial<TrackedContract> = {}): TrackedContract {
  return {
    ticker: 'TSLA',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
    greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
    iv: 0.45,
    dte: 24,
    ...over,
  };
}

function bundle(): TickerBundle {
  return {
    market_state: { ticker: 'TSLA', price: 250 },
    signals: { opportunity_tier: 'watch' },
    meta: { served_at: '2026-06-23T14:00:00Z' },
  } as unknown as TickerBundle;
}

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return { ticker: 'TSLA', mid: 252, live: true, market_session: 'regular', ...over } as LiveUpdate;
}

/** A durable record, authored flat and put through the ONE lift — never a hand conversion. */
function pos(over: Partial<Position> = {}): SimPosition {
  const raw: Position = {
    id: 'p-1',
    ticker: 'TSLA',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 4,
    entry_basis: 'user_entered',
    entry_time: '2026-06-12T15:32:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
  return liftLegacyRecord(raw) as SimPosition;
}

type Portfolio = ReturnType<typeof usePortfolio>;
let pf: Portfolio;

function Probe({
  live = null,
  isLive = true,
  streamOffline = false,
}: {
  live?: LiveUpdate | null;
  isLive?: boolean;
  streamOffline?: boolean;
}) {
  // The bundle is STABLE across renders, exactly as `app.tsx` holds it — a fresh object per render
  // would re-arm every mark-derived memo and is a caller bug, not a hook one.
  const [data] = useState(bundle);
  const p = usePortfolio('TSLA', data, live, isLive, streamOffline);
  useEffect(() => {
    pf = p;
  });
  pf = p;
  return null;
}

/** Mount, then let every in-flight lookup land and the resulting state settle. */
async function mount(props: Parameters<typeof Probe>[0] = {}) {
  const r = render(<Probe {...props} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return r;
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  fetchSpy.mockReset();
  fetchSpy.mockResolvedValue(quote());
});
afterEach(() => cleanup());

// =================================================================================================

describe('usePortfolio · the PositionView projection', () => {
  it('emits one PositionView per position, with the structure derived from the LEGS', async () => {
    putPosition(pos({ id: 'a' }));
    putPosition(pos({ id: 'b', right: 'put', strike: 380 }));
    await mount();

    expect(pf.views).toHaveLength(2);
    expect(pf.views.map((v) => v.structure).sort()).toEqual(['long_call', 'long_put']);
    // Derived from the leg set, never carried forward from a stored `Strategy`.
    expect(pf.views.every((v) => v.position.legs.length === 1)).toBe(true);
    expect(pf.views.every((v) => 'strategy' in v === false)).toBe(true);
  });

  it('AC-43/AC-80 — RENDERING writes nothing: the book is byte-identical after a mount', async () => {
    putPosition(pos());
    const before = localStorage.getItem(PORTFOLIO_V3_KEY);
    await mount();
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBe(before);
    // The superseded keys are never written to, and never re-created.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeNull();
    expect(localStorage.getItem('gammaflow.positions.v3')).toBeNull();
  });

  it('exposes health.faulted from the store SYNCHRONOUSLY on the first render', async () => {
    localStorage.setItem(PORTFOLIO_V3_KEY, '{"schema_version":3,"positions":{ NOT JSON');
    __resetMemory();
    let firstPaint: boolean | null = null;
    function Capture() {
      const p = usePortfolio('TSLA', bundle(), null, false, false);
      if (firstPaint == null) firstPaint = p.health.faulted;
      return null;
    }
    render(<Capture />);
    expect(firstPaint).toBe(true); // no frame ever paints on a stale value
  });
});

describe('usePortfolio · the resolver fan-out', () => {
  it('de-duplicates by (ticker, expiration, strike, right) across the WHOLE portfolio', async () => {
    // Two positions on the SAME contract — one lookup, not two.
    putPosition(pos({ id: 'a', qty: 1 }));
    putPosition(pos({ id: 'b', qty: 3 }));
    putPosition(pos({ id: 'c', strike: 440 }));
    await mount();

    const contracts = fetchSpy.mock.calls.map(
      ([t, q]) => `${t}|${q.expiration}|${q.strike}|${q.right}`,
    );
    expect(new Set(contracts).size).toBe(contracts.length); // no duplicate lookup
    expect(contracts.sort()).toEqual(['TSLA|2026-08-21|400|call', 'TSLA|2026-08-21|440|call']);
  });

  it('never issues a contract lookup for a closed position, and never one it cannot key', async () => {
    putPosition(pos({ id: 'closed', status: 'closed' }));
    // A record whose `right` was never recorded cannot be keyed in ANY cycle.
    putPosition({
      ...pos({ id: 'malformed' }),
      legs: [{ ...pos().legs[0], right: null }],
    } as unknown as SimPosition);
    await mount();
    expect(fetchSpy).not.toHaveBeenCalled();
    // …and it still renders: `unpriceable` selects the PERMANENT tip, not the this-cycle one.
    const malformed = pf.views.find((v) => v.position.id === 'malformed');
    expect(malformed?.unpriceable).toBe(true);
    expect(malformed?.unavailable).toBe(true);
  });

  it("one contract's 404 marks ONLY the legs referencing it; every other row keeps pricing", async () => {
    fetchSpy.mockImplementation(async (_t, q) => (q.strike === 440 ? null : quote()));
    putPosition(pos({ id: 'ok', strike: 400 }));
    putPosition(pos({ id: 'gone', strike: 440 }));
    await mount({ live: liveUpdate() });

    const ok = pf.views.find((v) => v.position.id === 'ok');
    const gone = pf.views.find((v) => v.position.id === 'gone');
    expect(gone?.unavailable).toBe(true);
    expect(gone?.pl_dollar).toBeNull();
    expect(ok?.unavailable).toBe(false);
    expect(ok?.mark.net_mark).not.toBeNull();
    expect(ok?.pl_dollar).not.toBeNull();
  });
});

describe('usePortfolio · degraded states (live-vs-static-isolation)', () => {
  it('AC-39/AC-40 — a withheld row is EXCLUDED from the subtotal and COUNTED, never summed as zero', async () => {
    fetchSpy.mockImplementation(async (_t, q) => (q.strike === 440 ? null : quote()));
    putPosition(pos({ id: 'ok', strike: 400, entry_mark: 4 }));
    putPosition(pos({ id: 'gone', strike: 440 }));
    await mount({ live: liveUpdate() });

    const [group] = deriveGroups(pf.views, {
      filter: { ticker: null, status: ['open'], structure: null, expiry: null },
      sortKey: 'pl_dollar',
      sortDir: 'desc',
      group: 'none',
    });
    expect(group.excludedCount).toBe(1);
    const ok = pf.views.find((v) => v.position.id === 'ok');
    expect(group.subtotal).toBeCloseTo(ok?.pl_dollar as number, 6); // the withheld row adds NOTHING
    expect(group.subtotal).not.toBe(0);
  });

  it('AC-38 — an SSE drop leaves a last-known number PRESENT and dimmable, never blanked', async () => {
    putPosition(pos());
    const { rerender } = await mount({ live: liveUpdate(), isLive: true });
    const online = pf.views[0];
    expect(online.pl_dollar).not.toBeNull();

    // The transport drops. The record, its structure line and its net entry are STATIC reads and
    // must not move; only the mark's BASIS degrades.
    await act(async () => {
      rerender(<Probe live={liveUpdate()} isLive={false} streamOffline />);
      await Promise.resolve();
    });
    const offline = pf.views[0];
    expect(offline.pl_dollar).not.toBeNull(); // a number is still there
    expect(offline.mark.basis).toBe('last_known');
    expect(offline.mark.unavailable).toBe(false); // offline !== unavailable, structurally
    expect(offline.structure_line).toBe(online.structure_line); // static reads never move
    expect(offline.net_entry_cost).toBe(online.net_entry_cost);
    expect(offline.max_loss).toEqual(online.max_loss);
  });

  it('AC-42 — offline and unavailable are DIFFERENT states, never rendered alike', async () => {
    fetchSpy.mockResolvedValue(null); // the lookup fails → the aggregate is WITHHELD
    putPosition(pos());
    await mount({ live: liveUpdate(), isLive: false, streamOffline: true });
    expect(pf.views[0].mark.unavailable).toBe(true);
    expect(pf.views[0].pl_dollar).toBeNull(); // withheld, not a dimmed last-known
  });
});

describe('usePortfolio · the resting composite limit (AC-44)', () => {
  it('a pending limit still fills on a live cross AT the limit price — byte-identically to shipped', async () => {
    // mid 5, delta .5, spot 250 → a live underlying of 235 models the option down through $4.
    putPosition(pos({ id: 'lim', status: 'pending', limit_price: 4, entry_mark: 4 }));
    await mount({ live: liveUpdate({ mid: 235 }), isLive: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(pf.positions.find((p) => p.id === 'lim')?.status).toBe('open');
  });

  it('never fills off a stale mark — an offline stream fills nothing', async () => {
    putPosition(pos({ id: 'lim', status: 'pending', limit_price: 4, entry_mark: 4 }));
    await mount({ live: liveUpdate({ mid: 235 }), isLive: false, streamOffline: true });
    expect(pf.positions.find((p) => p.id === 'lim')?.status).toBe('pending');
  });

  it('does NOT fill while the mark sits above the limit (the wrong side of the cross)', async () => {
    putPosition(pos({ id: 'lim', status: 'pending', limit_price: 4, entry_mark: 4 }));
    await mount({ live: liveUpdate({ mid: 250 }), isLive: true });
    expect(pf.positions.find((p) => p.id === 'lim')?.status).toBe('pending');
  });
});

describe('usePortfolio · openPosition — ONE code path for one leg and for six (F15)', () => {
  const optionLeg = (over: Record<string, unknown> = {}) => ({
    kind: 'option' as const,
    ticker: 'TSLA',
    side: 'long' as const,
    qty: 1,
    multiplier: 100,
    price: 12.4,
    expiration: '2026-08-21',
    strike: 400,
    right: 'call' as const,
    ...over,
  });

  it('a MULTI-LEG position is persisted with every leg — never flattened to its first contract', async () => {
    await mount();
    act(() => {
      pf.openPosition({
        entryMode: 'manual',
        // A textbook iron condor: long the wings, short the body, one expiration.
        legs: [
          optionLeg({ strike: 440, price: 12.4 }),
          optionLeg({ side: 'short', strike: 420, price: 6.1 }),
          optionLeg({ side: 'short', strike: 380, right: 'put', price: 5 }),
          optionLeg({ strike: 360, right: 'put', price: 2.5 }),
        ],
      });
    });
    const view = pf.views.find((v) => v.position.legs.length === 4);
    expect(view).toBeDefined();
    expect(view?.structure).toBe('iron_condor');
    // …and it SURVIVES the durable round-trip through the ONE lift, not just in memory.
    const blob = JSON.parse(localStorage.getItem(PORTFOLIO_V3_KEY) as string);
    const record = Object.values(blob.positions).find(
      (r) => ((r as { legs?: unknown[] }).legs ?? []).length === 4,
    ) as { legs: { side: string; strike: number; entry_price: number }[] };
    expect(record.legs.map((l) => l.strike).sort((a, b) => a - b)).toEqual([360, 380, 420, 440]);
    // Per-leg prices are the trader's OWN typed prices — never back-solved from a net.
    expect(record.legs.map((l) => l.entry_price)).toEqual([12.4, 6.1, 5, 2.5]);
  });

  it('MULTI-UNDERLYING is REJECTED AT CONSTRUCTION — nothing is written, and the refusal is stated', async () => {
    await mount();
    const before = localStorage.getItem(PORTFOLIO_V3_KEY);
    let result: { ok: boolean; reason?: string } | undefined;
    act(() => {
      result = pf.openPosition({
        entryMode: 'manual',
        legs: [optionLeg(), optionLeg({ ticker: 'AAPL', side: 'short' })],
      });
    });
    expect(result?.ok).toBe(false);
    expect(result?.reason).toMatch(/same underlying/i);
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBe(before);
  });

  it('a SINGLE-leg entry takes the same path and still produces exactly one leg', async () => {
    await mount();
    act(() => {
      pf.openPosition({ entryMode: 'manual', legs: [optionLeg({ strike: 410 })] });
    });
    const view = pf.views.find((v) => v.position.legs[0]?.strike === 410);
    expect(view?.position.legs).toHaveLength(1);
    expect(view?.structure).toBe('long_call');
  });

  it('a MULTI-LEG resting limit never fills: its per-unit limit has no structure-level meaning', async () => {
    fetchSpy.mockImplementation(async () => quote());
    await mount({ live: liveUpdate({ mid: 100 }), isLive: true }); // deep in the money for a fill
    act(() => {
      pf.openPosition({
        entryMode: 'limit',
        limitPrice: 99,
        legs: [optionLeg(), optionLeg({ side: 'short', strike: 420 })],
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    const pending = pf.positions.find((p) => (p.legs ?? []).length === 2);
    expect(pending?.status).toBe('pending'); // still resting — NEVER filled off an undefined number
  });
});
