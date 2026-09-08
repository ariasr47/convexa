/**
 * Product spine #3 — Ticker hierarchy / less equal weight.
 *
 * Guards the board reading order so the page cannot silently regress to a flat equal-weight
 * wall of cards. DOM order is the contract (CSS grid follows source order on the two-column
 * bento). Zone labels are visual only — never headings (heading semantics stay h1 → h2 widgets).
 *
 * Mounts the real app via the route table; mocks only the network boundary.
 */
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { __resetMemory } from '@/features/trading/positions/store';
import { theme } from '@/shared/theme/theme';
import { allRulesForClass, emotionClassOf, joinedStyleText } from './widgets/_kit/emotionCssReader';

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      if (url.includes('/api/ticker/')) return json(makeBundle());
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
      if (url.includes('/history'))
        return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderTicker() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={['/ticker/TSLA']}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Document order of elements (for hierarchy assertions). */
function docIndex(el: Element | null): number {
  if (!el) return -1;
  const all = Array.from(document.body.querySelectorAll('*'));
  return all.indexOf(el);
}

describe('Ticker · board hierarchy (product spine #3)', () => {
  it('exposes the three zone labels as non-headings', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const structure = screen.getByTestId('board-zone-structure');
    const plan = screen.getByTestId('board-zone-plan');
    const context = screen.getByTestId('board-zone-context');

    expect(structure.tagName.toLowerCase()).toBe('p');
    expect(plan.tagName.toLowerCase()).toBe('p');
    expect(context.tagName.toLowerCase()).toBe('p');
    expect(structure).toHaveTextContent(/structure/i);
    expect(plan).toHaveTextContent(/tape\s*&\s*plan/i);
    expect(context).toHaveTextContent(/supporting context/i);

    // Zone labels must never pollute the heading outline.
    for (const el of [structure, plan, context]) {
      expect(el.closest('h1,h2,h3,h4,h5,h6')).toBeNull();
      expect(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']).not.toContain(el.tagName);
    }
  });

  it('DOM order is Structure → Tape & plan (live tape, position brief, AI read, orders) → Supporting context', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const zoneStructure = screen.getByTestId('board-zone-structure');
    const zonePlan = screen.getByTestId('board-zone-plan');
    const zoneContext = screen.getByTestId('board-zone-context');
    // (curvature-v2-desk-and-read FE-11) `StructureHeroPanel` is the desk's ONE structure instrument
    // (the old dealer positioning widget AND the standalone `GexStrikeProfile` are both deleted).
    const dealer = screen.getByTestId('structure-hero');
    const live = screen.getByTestId('live-tape');
    // FE-11 moves `position-brief` OUT of the structure zone and INTO the plan group, beside
    // LiveTape/AiRecPanel/OrdersWidget (SPEC §1's flow: "AI read brief wide beside tape / position /
    // orders") — it is no longer a bridge ahead of the zone label.
    const brief = screen.getByTestId('position-brief');

    // Zones ordered: structure → plan → context.
    expect(docIndex(zoneStructure)).toBeLessThan(docIndex(zonePlan));
    expect(docIndex(zonePlan)).toBeLessThan(docIndex(zoneContext));

    // Primary structure (the hero) appears before live tape — not equal-weight top-of-board.
    expect(docIndex(zoneStructure)).toBeLessThan(docIndex(dealer));
    expect(docIndex(dealer)).toBeLessThan(docIndex(zonePlan));
    expect(docIndex(dealer)).toBeLessThan(docIndex(live));

    // Position brief now lives WITH the plan group, not ahead of it.
    expect(docIndex(zonePlan)).toBeLessThan(docIndex(live));
    expect(docIndex(zonePlan)).toBeLessThan(docIndex(brief));
    expect(docIndex(live)).toBeLessThan(docIndex(brief));
    expect(docIndex(brief)).toBeLessThan(docIndex(zoneContext));
    expect(docIndex(live)).toBeLessThan(docIndex(zoneContext));
  });

  it('position brief is always present on a loaded board (empty book still shown)', async () => {
    renderTicker();
    await screen.findByText('Call wall');
    const brief = screen.getByTestId('position-brief');
    expect(brief).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('position-brief-empty')).toBeInTheDocument();
    expect(brief.textContent).toMatch(/simulated/i);
  });

  it('act → watch stays adjacent: AI-rec widget before orders, both before supporting context', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const ai = await screen.findByTestId('widget-ai-rec');
    const orders = screen.getByTestId('widget-orders');
    const zoneContext = screen.getByTestId('board-zone-context');

    expect(docIndex(ai)).toBeLessThan(docIndex(orders));
    expect(docIndex(orders)).toBeLessThan(docIndex(zoneContext));
  });
});

// =====================================================================================================
// Ticker fidelity repair, change 1 (F1) — the `.work` grid (`design/src/screens/desk.mjs:32`,
// `DESK_CSS`): `minmax(0,8fr) minmax(0,4fr)` behind a ≥1000px CONTAINER query, AI read wide on the
// left, Live tape / Position brief / Sim orders stacked in the side column on the right. Before this
// repair `ticker-work`/`ticker-work-side` did not exist at all (Live tape was a full-width `span={2}`
// bento row, Position brief a full-width `gridColumn:'1 / -1'` bar, and AI-rec/Orders a half-width
// pair) — every assertion below is a fresh pin, not a copy of pre-existing behaviour.
// =====================================================================================================
describe('Ticker · tape & plan work grid (ticker fidelity repair F1)', () => {
  it('groups the AI read and the tape/position/orders side column under one work container, AI read first in DOM order', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const container = screen.getByTestId('ticker-work-container');
    const work = screen.getByTestId('ticker-work');
    const side = screen.getByTestId('ticker-work-side');
    const ai = screen.getByTestId('widget-ai-rec');
    const live = screen.getByTestId('live-tape');
    const brief = screen.getByTestId('position-brief');
    const orders = screen.getByTestId('widget-orders');

    // The design's markup order (`aiRead()` then `.side`): AI read is the work grid's first child,
    // the side column's three widgets follow it — matching the design's left-to-right read.
    expect(container.contains(work)).toBe(true);
    expect(work.contains(ai)).toBe(true);
    expect(work.contains(side)).toBe(true);
    expect(side.contains(live)).toBe(true);
    expect(side.contains(brief)).toBe(true);
    expect(side.contains(orders)).toBe(true);
    expect(docIndex(ai)).toBeLessThan(docIndex(live));
    // Existing order guard, preserved: tape before brief before orders inside the side column.
    expect(docIndex(live)).toBeLessThan(docIndex(brief));
    expect(docIndex(brief)).toBeLessThan(docIndex(orders));
  });

  it('the work grid is one column by default and declares the design’s 8fr/4fr split behind a ≥1000px `ticker-work` container query (never a viewport media query)', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const work = screen.getByTestId('ticker-work');
    const cls = emotionClassOf(work);
    expect(cls, 'the work grid should carry an emotion (sx) class').toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string)
      .join(';')
      .replace(/\s+/g, '');

    expect(rules).toContain('grid-template-columns:1fr');
    expect(rules).toContain('grid-template-columns:minmax(0,8fr)minmax(0,4fr)');

    // MUTATION GUARD (the container-query hazard, `ReadStrip.tsx`'s own module doc): the 8fr/4fr
    // split must be GATED behind `@container ticker-work`, never unconditional and never a bare
    // `@media` — a version that dropped the container-query key and always applied 8fr/4fr would
    // still pass the two `toContain`s above, so the raw prelude is checked on its own here.
    const squashed = joinedStyleText().replace(/\s+/g, '');
    expect(squashed).toContain('@containerticker-work(min-width:1000px)');
    expect(squashed).not.toMatch(/@media\([^)]*min-width:1000px[^)]*\)\{[^}]*8fr/);
  });

  it('the work container establishes the named `ticker-work` container the grid queries (canon 21 — panels/layout groups are containers)', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const container = screen.getByTestId('ticker-work-container');
    const cls = emotionClassOf(container);
    expect(cls, 'the work container should carry an emotion (sx) class').toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string)
      .join(';')
      .replace(/\s+/g, '');

    expect(rules).toContain('container-type:inline-size');
    expect(rules).toContain('container-name:ticker-work');
  });

  it('position brief no longer spans the full bento row — the "Your book" bar is absorbed into the side column (F1)', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const brief = screen.getByTestId('position-brief');
    const cls = emotionClassOf(brief);
    expect(cls, 'position-brief should carry an emotion (sx) class').toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string)
      .join(';')
      .replace(/\s+/g, '');

    expect(rules).not.toContain('grid-column:1/-1');
  });
});

// =====================================================================================================
// Ticker fidelity repair, change 2 (F2) — the context band's `ctx-head` + `ctx-grid`
// (`design/src/screens/desk.mjs:43`): a `Context` header with a presentational `All · Flow · Vol ·
// Positioning` filter (only `All` wired, no invented state) over a `repeat(3, minmax(0,1fr))` quiet
// grid, DOM order matching the design's own card enumeration. Before this repair `ticker-context-
// grid`/`context-band-filter` did not exist (the band was a flat 2-col bento run) — fresh pins, not
// copies of pre-existing behaviour.
// =====================================================================================================
describe('Ticker · context band grid (ticker fidelity repair F2)', () => {
  it('the context band is a 3-column quiet grid with a presentational All/Flow/Vol/Positioning filter — only All is enabled', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const grid = screen.getByTestId('ticker-context-grid');
    const cls = emotionClassOf(grid);
    expect(cls, 'the context grid should carry an emotion (sx) class').toBeTruthy();
    const rules = allRulesForClass(joinedStyleText(), cls as string)
      .join(';')
      .replace(/\s+/g, '');
    expect(rules).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');

    const filter = screen.getByTestId('context-band-filter');
    const all = within(filter).getByRole('button', { name: 'All' });
    const flow = within(filter).getByRole('button', { name: 'Flow' });
    const vol = within(filter).getByRole('button', { name: 'Vol' });
    const positioning = within(filter).getByRole('button', { name: 'Positioning' });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(all).not.toBeDisabled();
    // Presentational-until-wired (the task's own words) — no invented filtering state.
    for (const seg of [flow, vol, positioning]) expect(seg).toBeDisabled();
  });

  it('DOM order matches the design’s ctx-grid enumeration: dealer flow → market context → term structure → (IV rank, kept) → straddle move → fresh positioning → off-exchange → setups → add widget', async () => {
    renderTicker();
    await screen.findByText('Call wall');

    const order = [
      'widget-dealer-flow-projection',
      'widget-market-context',
      'widget-term-structure',
      'widget-iv-rank',
      'widget-straddle-move',
      'widget-fresh-positioning',
      'widget-setups',
      'add-widget-slot',
    ].map((id) => screen.getByTestId(id));

    for (let i = 0; i < order.length - 1; i += 1) {
      expect(
        docIndex(order[i]),
        `${order[i].dataset.testid} should come before ${order[i + 1].dataset.testid}`,
      ).toBeLessThan(docIndex(order[i + 1]));
    }
  });
});
