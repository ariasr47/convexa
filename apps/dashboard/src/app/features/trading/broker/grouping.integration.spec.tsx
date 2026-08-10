/**
 * F9 — THE CENTERPIECE: the real Broker tab, driven through the grouping user flow end-to-end,
 * mocking ONLY the network boundary (a stateful `fetch` stub — never the store, never the
 * derivation). Covers PLAN F9's AC table over `BrokerTabPanel` (SPEC §2, §4, §7).
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { BrokerBook, TickerBundle } from '@convexa/api';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrokerPositionRow } from './BrokerPositionRow';
import { BrokerTabPanel } from './BrokerTabPanel';
import { buildBrokerPositionView } from './brokerView';
import {
  BOOK_CAPTURED_COMPLETE,
  BOOK_CF_TWO_LEG_MEMBER,
  BOOK_EMPTY,
  BOOK_NO_CREDENTIAL,
  BOOK_REAUTH_WITH_SNAPSHOT,
  FIXED_NOW_MS,
  bookDegraded,
  bookUnknown,
} from './fixtures';
import { groupBook } from './grouping';

const theme = createTheme();

const BUNDLE = {
  market_state: { ticker: 'TSLA', price: 250 },
  meta: { served_at: '2026-08-01T14:59:30Z' },
} as unknown as TickerBundle;

interface InstallOpts {
  session?: { authenticated: boolean };
  hint?: { set: boolean; last4: string | null; storage_available: boolean };
  book?: BrokerBook | 'pending' | 'transport-fail';
  refresh?: BrokerBook | 'transport-fail';
}

let fetchMock: ReturnType<typeof vi.fn>;
let calledUrls: string[];

function installFetch(opts: InstallOpts = {}) {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  calledUrls = [];
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calledUrls.push(url);
    if (url.includes('/api/auth/session'))
      return json(
        opts.session?.authenticated === false
          ? { authenticated: false, user: null, google_available: false, settings: null }
          : {
              authenticated: true,
              user: { id: 'u', email: 'o@x.y', display_name: null, auth_methods: ['password'] },
              google_available: false,
              settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
            },
      );
    if (url.includes('/api/broker/credential'))
      return json(opts.hint ?? { set: true, last4: '4242', storage_available: true });
    if (url.includes('/api/broker/book/refresh') && init?.method === 'POST') {
      if (opts.refresh === 'transport-fail') throw new Error('down');
      return json(opts.refresh ?? BOOK_CAPTURED_COMPLETE);
    }
    if (url.includes('/api/broker/book')) {
      if (opts.book === 'pending') return new Promise<Response>(() => undefined);
      if (opts.book === 'transport-fail') throw new Error('down');
      return json(opts.book ?? BOOK_CAPTURED_COMPLETE);
    }
    if (url.includes('/api/contract/')) return json(null, 404); // per-leg isolation: honest 404
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function renderPanel(props: Partial<Parameters<typeof BrokerTabPanel>[0]> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthProvider>
          <AuthDialogProvider>
            <BrokerTabPanel
              data={BUNDLE}
              live={null}
              isLive={false}
              streamOffline={false}
              {...props}
            />
          </AuthDialogProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Real DOM count helper: top-level entries = group headers + rows NOT nested inside a panel. */
function topLevelCounts(container: HTMLElement) {
  const groupHeaders = container.querySelectorAll('[data-testid="broker-group-header"]').length;
  const allRows = container.querySelectorAll('[data-testid="broker-row"]').length;
  const nestedRows = container.querySelectorAll(
    '[data-testid="broker-group-panel"] [data-testid="broker-row"]',
  ).length;
  const loneRows = container.querySelectorAll('[data-testid="broker-lone-leg-clause"]').length;
  const topLevelRows = allRows - nestedRows;
  const equityRows = topLevelRows - loneRows;
  return { groupHeaders, allRows, nestedRows, loneRows, topLevelRows, equityRows };
}

/** Parse `$X,XXX.XX debit`/`credit`/`$0.00` back to a signed number. */
function parseSignedDollar(text: string): number {
  const match = /\$([\d,]+\.\d{2})/.exec(text);
  if (match == null) throw new Error(`not a dollar figure: "${text}"`);
  const magnitude = Number(match[1].replace(/,/g, ''));
  return /credit/.test(text) ? -magnitude : magnitude;
}

/** Throws with a legible message instead of a bare non-null assertion. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`expected to find ${what}`);
  return value;
}

function findGroupToggle(ticker: string, legCount: number) {
  return screen.getByRole('button', { name: new RegExp(`Show ${ticker}'s ${legCount}`, 'i') });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// =================================================================================================
// AC-1 / AC-6 / AC-34 — the captured book's whole shape
// =================================================================================================

describe('AC-1 · the captured book composes 3 groups + 2 lone legs + 5 equity rows = 10 top-level entries', () => {
  it('renders exactly that shape', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    const r = renderPanel();
    await screen.findByTestId('broker-rows');
    const counts = topLevelCounts(r.container);
    expect(counts.groupHeaders).toBe(3);
    expect(counts.loneRows).toBe(2);
    expect(counts.equityRows).toBe(5);
    expect(counts.groupHeaders + counts.topLevelRows).toBe(10);
  });
});

describe('AC-34 · the count line never becomes a group count', () => {
  it('reads "14 positions", never a group count or a `· N groups` clause', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const count = screen.getByTestId('broker-count');
    expect(count).toHaveTextContent('14 positions');
    expect(count.textContent ?? '').not.toMatch(/group/i);
  });
});

describe('AC-6 · totality — every eligible position lands in exactly one group or ungrouped', () => {
  it.each([
    ['captured book', BOOK_CAPTURED_COMPLETE, 14],
    ['BOOK_CF_TWO_LEG_MEMBER', BOOK_CF_TWO_LEG_MEMBER, 2],
  ])(
    'Σ group.position_count + ungrouped.length equals the book position count: %s',
    (_n, book, n) => {
      const views = book.positions.map((p) =>
        buildBrokerPositionView({
          position: p,
          legMarks: new Map(),
          dte: null,
          nowMs: FIXED_NOW_MS,
          book,
        }),
      );
      const { groups, ungrouped } = groupBook(views, book, FIXED_NOW_MS);
      const total = groups.reduce((acc, g) => acc + g.position_count, 0) + ungrouped.length;
      expect(total).toBe(n);
    },
  );
});

// =================================================================================================
// AC-7 — collapsed on first render
// =================================================================================================

describe('AC-7 · every group is collapsed on first render', () => {
  it('aria-expanded="false" and the panel is hidden, for every group', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    for (const btn of screen.getAllByTestId('broker-group-toggle')) {
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    }
    for (const panel of screen.getAllByTestId('broker-group-panel')) {
      expect(panel).toHaveAttribute('hidden');
    }
  });
});

// =================================================================================================
// AC-5 / AC-6c — expanding TSLA: content byte-identity + leg-count agreement
// =================================================================================================

describe('AC-5 · expanded member content is byte-identical to a standalone render', () => {
  it('TSLA members: snapshot fields, net entry, P/L and fidelity notes match a standalone render', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    const r = renderPanel();
    await screen.findByTestId('broker-rows');
    const toggle = findGroupToggle('TSLA', 3);
    const user = userEvent.setup();
    await user.click(toggle);

    const entry = must(toggle.closest('[data-testid="broker-group-entry"]'), 'TSLA group entry');
    const panel = must(
      entry.querySelector('[data-testid="broker-group-panel"]'),
      'TSLA group panel',
    ) as HTMLElement;
    const nestedRows = within(panel).getAllByTestId('broker-row');
    expect(nestedRows).toHaveLength(3);

    const tslaPositions = BOOK_CAPTURED_COMPLETE.positions.filter(
      (p) => p.legs[0]?.underlying === 'TSLA' && p.legs[0]?.kind === 'option',
    );
    expect(tslaPositions).toHaveLength(3);

    for (const [i, bp] of tslaPositions.entries()) {
      const view = buildBrokerPositionView({
        position: bp,
        legMarks: new Map(),
        dte: null,
        nowMs: FIXED_NOW_MS,
        book: BOOK_CAPTURED_COMPLETE,
      });
      const standalone = render(
        <BrokerPositionRow
          view={view}
          streamOffline={false}
          isStale={false}
          asOf={BOOK_CAPTURED_COMPLETE.as_of ?? null}
        />,
      );
      const nested = nestedRows[i];
      // `render()`'s bound queries default to `document.body` (baseElement), not the isolated
      // container — with the main panel ALSO mounted, an unscoped query here would match across
      // the whole page. Scope explicitly to `standalone.container`.
      const alone = within(standalone.container);
      expect(within(nested).getByTestId('broker-snapshot-fields').textContent).toBe(
        alone.getByTestId('broker-snapshot-fields').textContent,
      );
      expect(within(nested).getByTestId('broker-net-entry').textContent).toBe(
        alone.getByTestId('broker-net-entry').textContent,
      );
      expect(within(nested).getByTestId('broker-pl').textContent).toBe(
        alone.getByTestId('broker-pl').textContent,
      );
      const nestedNotes = within(nested)
        .queryAllByTestId('broker-fidelity-note')
        .map((n) => n.textContent);
      const standaloneNotes = alone
        .queryAllByTestId('broker-fidelity-note')
        .map((n) => n.textContent);
      expect(nestedNotes).toEqual(standaloneNotes);
      standalone.unmount();
    }
    r.unmount();
  });
});

describe('AC-6c · the expanded leg-line count equals the header’s own stated leg count', () => {
  it('BOOK_CF_TWO_LEG_MEMBER: header says 3, expanding shows exactly 3 broker-leg-line elements', async () => {
    installFetch({ book: BOOK_CF_TWO_LEG_MEMBER });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const toggle = findGroupToggle('TSLA', 3);
    const user = userEvent.setup();
    await user.click(toggle);
    expect(screen.getAllByTestId('broker-leg-line')).toHaveLength(3);
  });
});

// =================================================================================================
// AC-8 — the rendered net equals the signed sum of the expanded members' own net-entry texts
// =================================================================================================

describe('AC-8 · the group net is the signed sum of its members’ own net-entry figures', () => {
  it('TSLA: 10,620 debit − 3,396 credit + 6,536 debit = 13,760 debit, read back from the DOM', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const toggle = findGroupToggle('TSLA', 3);
    const user = userEvent.setup();
    await user.click(toggle);

    const entry = toggle.closest('[data-testid="broker-group-entry"]') as HTMLElement;
    const panel = entry.querySelector('[data-testid="broker-group-panel"]') as HTMLElement;
    const memberTexts = within(panel)
      .getAllByTestId('broker-net-entry')
      .map((el) => el.textContent ?? '')
      .filter((t) => /debit|credit/.test(t));
    expect(memberTexts).toHaveLength(3);
    const sum = memberTexts.reduce((acc, t) => acc + parseSignedDollar(t), 0);
    const groupNetText = within(entry).getByTestId('broker-group-net').textContent ?? '';
    expect(parseSignedDollar(groupNetText)).toBe(sum);
    expect(groupNetText).toBe('$13,760.00 debit');
  });
});

// =================================================================================================
// AC-11 / [absent-is-not-none] — the group P/L never disagrees with its expanded members, on the
// REAL feed (no stubbed contract lookups: `/api/contract/` 404s for every option leg, exactly as
// production does for a broker feed carrying no strike/expiry/right)
// =================================================================================================

describe('AC-11 · the group P/L literal is byte-identical to its expanded members’, end to end', () => {
  it('captured book: every group header P/L reads the SAME literal its members read — never `unavailable` over `not provided`', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    const r = renderPanel();
    await screen.findByTestId('broker-rows');

    for (const [ticker, legCount] of [
      ['AAPL', 2],
      ['META', 2],
      ['TSLA', 3],
    ] as const) {
      const toggle = findGroupToggle(ticker, legCount);
      const user = userEvent.setup();
      await user.click(toggle);

      const entry = must(
        toggle.closest('[data-testid="broker-group-entry"]'),
        `${ticker} group entry`,
      ) as HTMLElement;
      const panel = must(
        entry.querySelector('[data-testid="broker-group-panel"]'),
        `${ticker} group panel`,
      ) as HTMLElement;

      // The net entry still renders a FIGURE — cost basis is fully known on this feed. This is
      // exactly the shape that made the old hardcoded branch fall through to `unavailable`.
      const netText = within(entry).getByTestId('broker-group-net').textContent ?? '';
      expect(netText).toMatch(/debit|credit/);

      const headerPl = within(entry).getByTestId('broker-group-pl').textContent;
      expect(headerPl).toBe('not provided');

      const memberPls = within(panel)
        .getAllByTestId('broker-pl')
        .map((el) => el.textContent);
      expect(memberPls.length).toBe(legCount);
      for (const memberPl of memberPls) {
        expect(memberPl).toBe(headerPl);
      }
    }
    r.unmount();
  });
});

// =================================================================================================
// AC-20 / AC-21 — no-book states vs degraded/reauth states
// =================================================================================================

describe('AC-20 · no served book ⇒ zero group chrome anywhere, and each state’s copy is unchanged', () => {
  it.each([
    ['BOOK_NO_CREDENTIAL', BOOK_NO_CREDENTIAL, 'broker-s1'],
    ['bookUnknown(broker_unreachable)', bookUnknown('broker_unreachable'), 'broker-s5'],
    ['BOOK_EMPTY', BOOK_EMPTY, 'broker-s4'],
  ])('%s', async (_n, book, testid) => {
    installFetch({ book });
    renderPanel();
    await screen.findByTestId(testid);
    expect(screen.queryAllByTestId('broker-group-header')).toHaveLength(0);
    expect(screen.queryAllByTestId('broker-group-toggle')).toHaveLength(0);
    expect(screen.queryAllByTestId('broker-leg-line')).toHaveLength(0);
  });

  it('cold skeleton (pending, no credential hint yet): zero group chrome', async () => {
    installFetch({ hint: { set: false, last4: null, storage_available: true }, book: 'pending' });
    renderPanel();
    await screen.findByTestId('broker-s9');
    expect(screen.queryAllByTestId('broker-group-header')).toHaveLength(0);
  });
});

describe('AC-21 · a degraded/reauth read with a last-known snapshot still renders grouped', () => {
  it.each([
    ['degraded (broker_unreachable)', bookDegraded('broker_unreachable')],
    ['reauth with a snapshot', BOOK_REAUTH_WITH_SNAPSHOT],
  ])('%s: groups still render beneath the banner', async (_n, book) => {
    installFetch({ book });
    renderPanel();
    await screen.findByTestId('broker-rows');
    expect(screen.getAllByTestId('broker-group-header').length).toBeGreaterThan(0);
  });
});

// =================================================================================================
// AC-23 — the lone-leg rows (NVDA, PLTR): exactly one clause, no group chrome, unchanged figures
// =================================================================================================

describe('AC-23 · lone option legs render today’s row plus EXACTLY one clause, no group chrome', () => {
  it('NVDA and PLTR: no button/aria-expanded/aria-controls/chevron/"netted by Convexa"', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');

    const clauses = screen.getAllByTestId('broker-lone-leg-clause');
    expect(clauses).toHaveLength(2);
    for (const clause of clauses) {
      expect(clause.textContent).toBe('1 option leg · as Webull reports it');
      const row = must(
        clause.closest('[data-testid="broker-row"]'),
        'the lone leg’s row',
      ) as HTMLElement;
      expect(within(row).queryAllByTestId('broker-group-toggle')).toHaveLength(0);
      expect(row.querySelector('[aria-expanded]')).toBeNull();
      expect(row.querySelector('[aria-controls]')).toBeNull();
      expect(row.textContent ?? '').not.toMatch(/netted by Convexa/);
    }

    // Qty and entry figures unchanged from a standalone render (NVDA: +10 @ 7.89 → $7,890.00 debit).
    const nvdaBp = must(
      BOOK_CAPTURED_COMPLETE.positions.find((p) => p.legs[0]?.underlying === 'NVDA'),
      'the NVDA position fixture',
    );
    const nvdaView = buildBrokerPositionView({
      position: nvdaBp,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
      book: BOOK_CAPTURED_COMPLETE,
    });
    expect(nvdaView.qty_text).toBeTruthy();
    expect(nvdaView.net_entry_text).toBe('$7,890.00 debit');
    const nvdaClause = must(
      clauses.find((c) =>
        (c.closest('[data-testid="broker-row"]') as HTMLElement | null)?.textContent?.includes(
          'NVDA',
        ),
      ),
      'the NVDA lone-leg clause',
    );
    const nvdaRow = must(
      nvdaClause.closest('[data-testid="broker-row"]'),
      'the NVDA row',
    ) as HTMLElement;
    expect(within(nvdaRow).getByTestId('broker-net-entry').textContent).toBe('$7,890.00 debit');
  });
});

// =================================================================================================
// AC-25 / AC-27 — expand state survives a same-book refresh and the 30s tick; no localStorage touch
// =================================================================================================

describe('AC-25 · expand state survives a refresh and the 30s staleness tick', () => {
  it('stays expanded after a same-book refresh AND after the 30s tick fires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    installFetch({ book: BOOK_CAPTURED_COMPLETE, refresh: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const toggle = findGroupToggle('TSLA', 3);
    const user = userEvent.setup();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByTestId('broker-refresh'));
    await screen.findByTestId('broker-rows');
    // Re-query by `aria-controls` (a fact, not the accessible NAME, which switches Show→Hide once
    // expanded — a name-based re-query would, correctly, stop matching after the first click).
    const tslaToggle = () =>
      must(
        screen
          .getAllByTestId('broker-group-toggle')
          .find((b) => b.getAttribute('aria-controls') === 'broker-group-panel-TSLA'),
        'the TSLA group toggle',
      );
    expect(tslaToggle()).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(tslaToggle()).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('AC-27 · expand/collapse never touches localStorage', () => {
  it('Object.keys(localStorage) is identical before and after expand + collapse', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const before = Object.keys(localStorage).sort();
    const toggle = findGroupToggle('TSLA', 3);
    const user = userEvent.setup();
    await user.click(toggle);
    await user.click(toggle);
    const after = Object.keys(localStorage).sort();
    expect(after).toEqual(before);
  });
});

// =================================================================================================
// AC-28 — a second book without a previously-expanded ticker: no error, no stray empty group
// =================================================================================================

describe('AC-28 · a refresh that drops a previously-expanded group renders cleanly', () => {
  it('no error, no stray empty group, when the refreshed book lacks that ticker', async () => {
    const withoutTsla: BrokerBook = {
      ...BOOK_CAPTURED_COMPLETE,
      positions: BOOK_CAPTURED_COMPLETE.positions.filter((p) => p.legs[0]?.underlying !== 'TSLA'),
    };
    installFetch({ book: BOOK_CAPTURED_COMPLETE, refresh: withoutTsla });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const toggle = findGroupToggle('TSLA', 3);
    const user = userEvent.setup();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByTestId('broker-refresh'));
    await screen.findByTestId('broker-rows');
    expect(screen.queryByText(/^TSLA$/)).toBeNull();
    expect(screen.getAllByTestId('broker-group-header')).toHaveLength(2); // AAPL + META remain
  });
});

// =================================================================================================
// AC-29 — mobile parity: same groups, leg counts, net figure, basis label, withheld literal
// =================================================================================================

describe('AC-29 · mobile (<sm) renders the same grouped shape as desktop', () => {
  it('same group count, leg counts, net figures and basis label', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches: q.includes('max-width'),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      })),
    );
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    expect(screen.getAllByTestId('broker-group-header')).toHaveLength(3);
    const tslaHeader = must(
      findGroupToggle('TSLA', 3).closest('[data-testid="broker-group-header"]'),
      'the TSLA group header',
    ) as HTMLElement;
    expect(within(tslaHeader).getByTestId('broker-group-net')).toHaveTextContent(
      '$13,760.00 debit',
    );
    expect(within(tslaHeader).getByTestId('broker-group-net-label')).toHaveTextContent(
      'netted by Convexa',
    );
  });
});

// =================================================================================================
// AC-33 — deterministic order across renders
// =================================================================================================

describe('AC-33 · group order is deterministic (key ascending); members by broker_position_id', () => {
  it('two renders of the same book give the same group order', () => {
    const views = BOOK_CAPTURED_COMPLETE.positions.map((p) =>
      buildBrokerPositionView({
        position: p,
        legMarks: new Map(),
        dte: null,
        nowMs: FIXED_NOW_MS,
        book: BOOK_CAPTURED_COMPLETE,
      }),
    );
    const first = groupBook(views, BOOK_CAPTURED_COMPLETE, FIXED_NOW_MS);
    const second = groupBook(views, BOOK_CAPTURED_COMPLETE, FIXED_NOW_MS);
    // `groupBook()` itself groups every option ticker, including singletons (NVDA/PLTR) — the
    // "render as a lone row" branch is a call-site decision in `BrokerTabPanel`, not this function.
    expect(first.groups.map((g) => g.key)).toEqual(second.groups.map((g) => g.key));
    expect(first.groups.map((g) => g.key)).toEqual(['AAPL', 'META', 'NVDA', 'PLTR', 'TSLA']);
    const tsla = must(
      first.groups.find((g) => g.key === 'TSLA'),
      'the TSLA group',
    );
    const ids = tsla.members.map((m) => m.broker.broker_position_id);
    expect(ids).toEqual([...ids].sort());
  });
});

// =================================================================================================
// AC-35 — no captured unrealized_pl value reaches rendered text on any group surface
// =================================================================================================

describe('AC-35 · Webull’s own unrealized P/L never reaches the group surface', () => {
  it('no captured value renders anywhere on the populated tab', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    const r = renderPanel();
    await screen.findByTestId('broker-rows');
    const text = r.container.textContent ?? '';
    // The captured book's carried (never-rendered) unrealized_pl figures — distinctive enough that
    // no legitimate rendered figure could coincidentally match.
    for (const bp of BOOK_CAPTURED_COMPLETE.positions) {
      if (bp.unrealized_pl.state === 'supplied' && bp.unrealized_pl.value != null) {
        expect(text).not.toContain(bp.unrealized_pl.value.toFixed(2));
      }
    }
  });
});

// =================================================================================================
// AC-31 (FE half) — no fetch call added beyond the shipped pattern
// =================================================================================================

describe('AC-31 (FE half) · no new fetch call is introduced by grouping', () => {
  it('the network stub records exactly the shipped call pattern (session/credential/book/contract)', async () => {
    installFetch({ book: BOOK_CAPTURED_COMPLETE });
    renderPanel();
    await screen.findByTestId('broker-rows');
    const allowed = [
      '/api/auth/session',
      '/api/broker/credential',
      '/api/broker/book',
      '/api/contract/',
      '/api/ticker/', // pre-existing `useTickerSpots` per-underlying spot fetch (equity marks)
    ];
    for (const url of calledUrls) {
      expect(
        allowed.some((a) => url.includes(a)),
        url,
      ).toBe(true);
    }
  });
});
