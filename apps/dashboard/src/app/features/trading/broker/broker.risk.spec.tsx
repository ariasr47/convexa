/**
 * F7 — the broker negative-space suite: the SUCCESSOR to the LiveTabPanel inert-by-construction
 * test (positions.risk.spec.tsx §5, superseded by broker-connect).
 *
 *  1. SOURCE SCANS (the `?raw`/glob idiom, mutation-guarded): the ENTIRE broker module —
 *     every non-spec file under `features/trading/broker/` — references no `TradeEntryDialog`
 *     (the narrowed `[single-shared-sim-entry-dialog]`), imports no `positions/store`, and
 *     contains no `convexa.` durable-key string (durable isolation: no broker datum is ever
 *     persisted client-side).
 *  2. NEGATIVE SPACE RENDERED: across every wire arm, no order/trade/close/modify affordance
 *     exists — including disabled ones (READ-ONLY is ABSENCE, AC-15).
 *  3. FORBIDDEN WORD: the trader-visible rendered strings never use `live` as a freshness
 *     claim — the ONLY allowed occurrence is inside the negation phrase `a snapshot, never
 *     live` (decisions.md label ruling; internal names/routes/testids exempt — `tab-live`
 *     must NOT trip this).
 *  4. SIM-BOOK ISOLATION (AC-16 FE arm): rendering the broker surface across connect/disconnect
 *     arms leaves every `convexa.*` durable byte — sim book AND outcome ledger — identical.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { AUTH_COPY } from '@/features/auth/copy';
import type { BrokerBook, TickerBundle } from '@convexa/api';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrokerTabPanel } from './BrokerTabPanel';
import { BROKER_COPY } from './copy';
import {
  BOOK_EMPTY,
  BOOK_NO_CREDENTIAL,
  BOOK_OK_FRESH,
  BOOK_OK_STALE,
  BOOK_REAUTH_NO_SNAPSHOT,
  BOOK_REAUTH_WITH_SNAPSHOT,
  BOOK_UNREADABLE_WITH_SNAPSHOT,
  POS_EQUITY,
  POS_PARTIAL,
  POS_SPREAD,
  POS_UNRECOGNIZED,
  bookDegraded,
  bookUnknown,
} from './fixtures';

const theme = createTheme();

// =================================================================================================
// 1. Source scans — the whole module, by construction
// =================================================================================================

// Every non-spec source file in this folder, as raw text. A NEW file lands in the scan
// automatically — the negative space cannot silently grow a hole.
const RAW_SOURCES = import.meta.glob('./*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_FILES = Object.entries(RAW_SOURCES).filter(([path]) => !path.includes('.spec.'));

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The scan predicate, extracted so it can be MUTATION-TESTED (a scan that can't fail is worthless). */
function violations(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  if (/TradeEntryDialog/.test(code)) out.push('TradeEntryDialog reference');
  if (/positions\/store/.test(code)) out.push('positions/store import');
  if (/convexa\./.test(code)) out.push('convexa.* durable key string');
  if (/localStorage/.test(code)) out.push('direct durable storage access');
  return out;
}

describe('broker module · source scans (the LiveTabPanel inert-test successor)', () => {
  it('scans a REAL, non-empty file set', () => {
    expect(APP_FILES.length).toBeGreaterThanOrEqual(10);
    expect(APP_FILES.map(([p]) => p)).toEqual(
      expect.arrayContaining(['./BrokerTabPanel.tsx', './brokerView.ts', './useBrokerBook.ts']),
    );
  });

  it('MUTATION GUARD: the predicate actually fires on each violation class', () => {
    expect(violations("import { TradeEntryDialog } from '../TradeEntryDialog';")).toContain(
      'TradeEntryDialog reference',
    );
    expect(violations("import { putPosition } from '../positions/store';")).toContain(
      'positions/store import',
    );
    expect(violations("localStorage.setItem('convexa.broker.v1', x)")).toEqual(
      expect.arrayContaining(['convexa.* durable key string', 'direct durable storage access']),
    );
    expect(violations('const clean = 1;')).toEqual([]);
  });

  it('NO broker file references TradeEntryDialog, the sim store, or any durable key', () => {
    for (const [path, src] of APP_FILES) {
      expect(violations(src), `${path}: ${violations(src).join(', ')}`).toEqual([]);
    }
  });
});

// =================================================================================================
// Shared render harness (network boundary only)
// =================================================================================================

/** `ticker` is REQUIRED (R8): it names which underlying this bundle's price belongs to, so a leg
 *  on another symbol withholds instead of borrowing it. Required on the real wire. */
const BUNDLE = {
  market_state: { ticker: 'TSLA', price: 250 },
  meta: { served_at: '2026-08-01T14:59:30Z' },
} as unknown as TickerBundle;

function install(book: BrokerBook, hintSet = true) {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/session'))
        return json({
          authenticated: true,
          user: { id: 'u', email: 'o@x.y', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      if (url.includes('/api/broker/credential'))
        return json({ set: hintSet, last4: hintSet ? '4242' : null, storage_available: true });
      if (url.includes('/api/broker/book/refresh') && init?.method === 'POST') return json(book);
      if (url.includes('/api/broker/book')) return json(book);
      if (url.includes('/api/contract/')) return json(null, 404);
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
}

function renderPanel() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthProvider>
          <AuthDialogProvider>
            <BrokerTabPanel data={BUNDLE} live={null} isLive={false} streamOffline={false} />
          </AuthDialogProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Every wire arm the surface can render — the sweep set for §2 and §3. */
const ALL_ARMS: [string, BrokerBook][] = [
  ['S1 no credential', BOOK_NO_CREDENTIAL],
  [
    'S3 ok (equity+spread+partial+unrecognized)',
    { ...BOOK_OK_FRESH, positions: [POS_EQUITY, POS_SPREAD, POS_PARTIAL, POS_UNRECOGNIZED] },
  ],
  ['S4 empty', BOOK_EMPTY],
  ['S5 unreachable', bookUnknown('broker_unreachable')],
  ['S5 rate limited', bookUnknown('rate_limited')],
  ['S5 adapter fault', bookUnknown('adapter_fault')],
  ['S6 stale', BOOK_OK_STALE],
  ['S7 degraded', bookDegraded('broker_unreachable')],
  ['S8 reauth + book', BOOK_REAUTH_WITH_SNAPSHOT],
  ['S8 reauth no book', BOOK_REAUTH_NO_SNAPSHOT],
  ['unreadable + book', BOOK_UNREADABLE_WITH_SNAPSHOT],
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// =================================================================================================
// 2. Rendered negative space — READ-ONLY is ABSENCE, on EVERY arm (AC-15), and the rendered text
//    never claims `live` (the §3 forbidden word, swept in the same render)
// =================================================================================================

const NEGATION = /a snapshot, never live/gi;

/** Strip every allowed negation phrase, then any word-bounded `live` left is a violation. */
function liveViolations(text: string): string[] {
  const stripped = text.replace(NEGATION, '');
  return stripped.match(/\blive\b/gi) ?? [];
}

describe('broker surface · zero order affordances on every wire arm', () => {
  const FORBIDDEN_TESTIDS = ['open-entry', 'pending-affordance', 'position-row'];
  const FORBIDDEN_BUTTONS = /^(close|trim|roll|add|cancel order|place|buy|sell|execute)$/i;

  it.each(ALL_ARMS)(
    '%s: no order/trade/close/modify affordance — not even disabled — and no rendered `live` claim',
    async (_label, book) => {
      install(book);
      renderPanel();
      await screen.findByTestId('broker-tab-panel');
      // Let the state settle (any arm's terminal testid is fine; we just need the fetch to land).
      await vi.waitFor(() => {
        expect(screen.queryByTestId('broker-s9')).toBeNull();
      });
      for (const tid of FORBIDDEN_TESTIDS) {
        expect(screen.queryByTestId(tid), tid).toBeNull();
      }
      for (const btn of screen.queryAllByRole('button')) {
        expect(btn.textContent ?? '', 'order-verb button').not.toMatch(FORBIDDEN_BUTTONS);
      }
      // No "coming soon" order copy either — the out-of-scope list bans implying a path exists.
      expect(document.body.textContent).not.toMatch(/coming soon|place (an )?order/i);
      // The forbidden freshness word: the RENDERED text never claims `live` (testids/routes exempt
      // by construction).
      expect(liveViolations(document.body.textContent ?? ''), _label).toHaveLength(0);
    },
  );
});

// =================================================================================================
// 3. Forbidden word — `live` only inside the negation phrase, trader-visible strings only
// =================================================================================================

/** Flatten BROKER_COPY (invoking formatters with dummy args) into its rendered strings. */
function copyStrings(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (typeof node === 'function')
    return [String((node as (...a: string[]) => string)('14:59:00', '20m'))];
  if (node != null && typeof node === 'object')
    return Object.values(node).flatMap((v) => copyStrings(v));
  return [];
}

describe('broker surface · the forbidden freshness word', () => {
  it('MUTATION GUARD: the checker fires on a bare `live` and passes the negation phrase', () => {
    expect(liveViolations('LIVE positions update live')).toHaveLength(2);
    expect(liveViolations('read on demand — a snapshot, never live.')).toHaveLength(0);
    expect(liveViolations('delivers liveliness')).toHaveLength(0); // word-bounded
  });

  it('every BROKER_COPY string + the Settings brokerage copy: `live` appears ONLY negated', () => {
    for (const s of [...copyStrings(BROKER_COPY), ...copyStrings(AUTH_COPY.settings.brokerage)]) {
      expect(liveViolations(s), s).toHaveLength(0);
    }
  });
});

// =================================================================================================
// 4. Sim-book isolation (AC-16 FE arm) — connect/disconnect leaves every durable byte identical
// =================================================================================================

describe('broker surface · durable isolation across connect/disconnect', () => {
  it('rendering + refreshing a connected book, then the disconnected arm, mutates NO convexa.* byte', async () => {
    // A seeded durable world: sim book bytes + an outcome-ledger blob (content is opaque here —
    // the claim is byte-identity, not shape).
    localStorage.clear();
    localStorage.setItem('convexa.positions.v3', '{"positions":{"p1":{"id":"p1"}},"v":3}');
    localStorage.setItem('convexa.decisions.v1', '[{"id":"d1","pl_dollar":42}]');
    const before = JSON.stringify(
      Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
    );

    // Connected arm: rows render, a refresh runs.
    install({ ...BOOK_OK_FRESH, positions: [POS_EQUITY, POS_SPREAD] });
    const connected = renderPanel();
    await screen.findByTestId('broker-rows');
    await userEvent.click(screen.getByTestId('broker-refresh'));
    connected.unmount();
    cleanup();

    // Disconnected arm (post-DELETE): S1, no residual data.
    install(BOOK_NO_CREDENTIAL, false);
    renderPanel();
    await screen.findByTestId('broker-s1');

    const after = JSON.stringify(
      Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
    );
    expect(after).toBe(before); // byte-identical: no key added, none touched
  });
});
