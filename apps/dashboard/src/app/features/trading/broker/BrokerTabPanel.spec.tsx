/**
 * F4 — the Broker tab's nine states + the two-axis degradation grid (SPEC §4), rendered from the
 * typed wire fixtures with ONLY the network boundary mocked.
 *
 * The invariants automated here (SPEC §7):
 *  - each S-state renders a DISTINCT surface; S4 ≠ S5 textually (AC-10 render arm);
 *  - S7 ≠ S8 ≠ credential_unreadable — distinct copy off distinct wire values (a generic
 *    catch-all is the regression, AC-13);
 *  - the S7/S8 last-known clause renders IFF the RESPONSE carries a served snapshot (wire-keyed,
 *    never client memory);
 *  - stamp invariant: an as-of stamp whenever any broker datum renders;
 *  - two axes: an SSE drop dims ONLY the modeled P/L (⏸, never blank) while snapshot fields stay
 *    byte-identical; a stale book under a live feed keeps the figure updating ONLY under the
 *    dual-basis label (AC-21 — a single-basis label over a stale book fails here);
 *  - a throttled refresh renders the honest unchanged-and-why note (AC-8) — never a silent no-op.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import type { BrokerBook, TickerBundle } from '@convexa/api';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrokerTabPanel } from './BrokerTabPanel';
import { BROKER_COPY, stampTime } from './copy';
import {
  BOOK_EMPTY,
  BOOK_OK_FRESH,
  BOOK_OK_STALE,
  BOOK_REAUTH_NO_SNAPSHOT,
  BOOK_REAUTH_WITH_SNAPSHOT,
  BOOK_UNREADABLE_WITH_SNAPSHOT,
  POS_EQUITY,
  POS_PARTIAL,
  POS_UNRECOGNIZED,
  bookDegraded,
  bookUnknown,
} from './fixtures';

const theme = createTheme();

/**
 * Minimal bundle — the broker mark path reads market_state.ticker + .price + meta.served_at.
 *
 * `ticker` is REQUIRED here (R8): the mark path names which underlying this bundle's price belongs
 * to, so a leg on a different symbol is priced off its own spot instead of borrowing this one. It
 * is a required field on the real wire (`MarketState.ticker`); omitting it from the fixture made
 * every equity mark below withhold, which quietly turned the ⏸-last-known assertion vacuous.
 */
const BUNDLE = {
  market_state: { ticker: 'TSLA', price: 250 },
  meta: { served_at: '2026-08-01T14:59:30Z' },
} as unknown as TickerBundle;

/** An equity-only book variant: marks resolve off the bundle price (no /api/contract in play). */
const equityBook = (over: Partial<BrokerBook> = {}): BrokerBook => ({
  ...BOOK_OK_FRESH,
  positions: [POS_EQUITY],
  ...over,
});

interface InstallOpts {
  session?: { authenticated: boolean };
  hint?: { set: boolean; last4: string | null; storage_available: boolean };
  /** 'pending' keeps the GET hanging (S2/S9); a function returns per-call. */
  book?: BrokerBook | 'pending' | 'transport-fail';
  refresh?: BrokerBook | 'transport-fail';
}

let fetchMock: ReturnType<typeof vi.fn>;

function installFetch(opts: InstallOpts = {}) {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
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
      return json(opts.refresh ?? BOOK_OK_FRESH);
    }
    if (url.includes('/api/broker/book')) {
      if (opts.book === 'pending') return new Promise<Response>(() => undefined);
      if (opts.book === 'transport-fail') throw new Error('down');
      return json(opts.book ?? BOOK_OK_FRESH);
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// =================================================================================================
// The states, each a DISTINCT surface
// =================================================================================================

describe('BrokerTabPanel · the closed states', () => {
  it('signed out ⇒ the shared SignInPrompt, and NO broker request is issued (auth carve-out)', async () => {
    installFetch({ session: { authenticated: false } });
    renderPanel();
    await screen.findByTestId('broker-signin-prompt');
    const brokerCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/broker/'));
    expect(brokerCalls).toHaveLength(0);
  });

  it('S2 first-sync: credential stored + first fetch in flight ⇒ skeletons + the named copy, no numbers', async () => {
    installFetch({ hint: { set: true, last4: '4242', storage_available: true }, book: 'pending' });
    renderPanel();
    await screen.findByTestId('broker-s2');
    expect(screen.getByText(BROKER_COPY.s2)).toBeInTheDocument();
    expect(screen.queryByTestId('broker-row')).toBeNull();
    expect(screen.queryByTestId('broker-count')).toBeNull(); // no zero-count claim
  });

  it('S9 cold skeleton: first fetch pending with NO stored-credential knowledge ⇒ skeleton, no claims', async () => {
    installFetch({ hint: { set: false, last4: null, storage_available: true }, book: 'pending' });
    renderPanel();
    await screen.findByTestId('broker-s9');
    expect(screen.queryByText(BROKER_COPY.s2)).toBeNull(); // ≠ S2 (no first-sync claim)
    expect(screen.queryByTestId('broker-degraded-banner')).toBeNull(); // ≠ S7 (nothing degraded)
  });

  it('S3 populated: provenance header + count + read-only rows', async () => {
    installFetch({ book: equityBook() });
    renderPanel();
    await screen.findByTestId('broker-rows');
    expect(screen.getByTestId('broker-provenance-header')).toBeInTheDocument();
    expect(screen.getByTestId('broker-readonly-chip')).toHaveTextContent('Webull · read-only');
    expect(screen.getByTestId('broker-count')).toHaveTextContent('1 position');
    expect(screen.getByTestId('broker-row')).toBeInTheDocument();
  });

  it('S4 ≠ S5 TEXTUALLY: confirmed-empty carries its check stamp; unknown never claims empty (AC-10)', async () => {
    installFetch({ book: BOOK_EMPTY });
    const r1 = renderPanel();
    const s4 = await screen.findByTestId('broker-s4');
    expect(within(s4).getByText(BROKER_COPY.s4.heading)).toBeInTheDocument();
    expect(screen.getByTestId('broker-s4-checked')).toHaveTextContent('This is a confirmed read');
    expect(screen.queryByTestId('broker-s5')).toBeNull();
    r1.unmount();

    installFetch({ book: bookUnknown('broker_unreachable') });
    renderPanel();
    const s5 = await screen.findByTestId('broker-s5');
    expect(within(s5).getByText(BROKER_COPY.s5.body)).toBeInTheDocument();
    expect(screen.queryByTestId('broker-s4')).toBeNull();
    expect(screen.queryByText(BROKER_COPY.s4.heading)).toBeNull(); // never the empty claim
    expect(within(s5).getByTestId('broker-try-again')).toHaveTextContent(BROKER_COPY.s5.cta);
  });

  it('S5 on a cold-start transport fault (nothing known) — an empty table never renders', async () => {
    installFetch({ book: 'transport-fail' });
    renderPanel();
    await screen.findByTestId('broker-s5');
    expect(screen.queryByTestId('broker-rows')).toBeNull();
    expect(screen.queryByTestId('broker-s4')).toBeNull();
  });
});

// =================================================================================================
// S7 ≠ S8 ≠ credential_unreadable — distinct renders off distinct wire values
// =================================================================================================

describe('BrokerTabPanel · degraded/warning family', () => {
  it('S7 degraded: info banner naming the as-of, LAST-KNOWN rows still below', async () => {
    installFetch({ book: bookDegraded('broker_unreachable') });
    renderPanel();
    const banner = await screen.findByTestId('broker-degraded-banner');
    expect(banner).toHaveTextContent("Couldn't reach Webull just now");
    expect(banner).toHaveTextContent('Everything else in Convexa is unaffected.');
    expect(screen.getByTestId('broker-rows')).toBeInTheDocument(); // the book stays visible
    expect(screen.queryByTestId('broker-reauth-banner')).toBeNull();
    expect(screen.queryByTestId('broker-unreadable-banner')).toBeNull();
  });

  it('S8 reauth WITH a served snapshot: warning + Reconnect CTA + the last-known clause + rows', async () => {
    installFetch({ book: BOOK_REAUTH_WITH_SNAPSHOT });
    renderPanel();
    const banner = await screen.findByTestId('broker-reauth-banner');
    expect(banner).toHaveTextContent(BROKER_COPY.s8.banner);
    expect(banner).toHaveTextContent('stays below');
    expect(screen.getByTestId('broker-reconnect-cta')).toHaveAttribute(
      'href',
      '/settings#brokerage',
    );
    expect(screen.getByTestId('broker-rows')).toBeInTheDocument();
  });

  it('S8 reauth WITHOUT a snapshot: the clause and the rows are ABSENT (wire-keyed, not memory)', async () => {
    installFetch({ book: BOOK_REAUTH_NO_SNAPSHOT });
    renderPanel();
    const banner = await screen.findByTestId('broker-reauth-banner');
    expect(banner).not.toHaveTextContent('stays below');
    expect(screen.queryByTestId('broker-rows')).toBeNull();
    expect(screen.queryByTestId('broker-as-of-stamp')).toBeNull();
  });

  it('credential_unreadable: OUR-fault copy + Replace CTA — NEVER the "Webull stopped accepting" copy (AC-13)', async () => {
    installFetch({ book: BOOK_UNREADABLE_WITH_SNAPSHOT });
    renderPanel();
    const banner = await screen.findByTestId('broker-unreadable-banner');
    expect(banner).toHaveTextContent('a fault on our side');
    expect(banner).not.toHaveTextContent('Webull stopped accepting');
    expect(screen.queryByTestId('broker-reauth-banner')).toBeNull();
    expect(screen.getByTestId('broker-replace-cta')).toHaveTextContent(BROKER_COPY.unreadable.cta);
  });

  it('stamp invariant: an as-of stamp is present whenever any broker datum renders (S3/S4/S6/S7/S8)', async () => {
    const arms: BrokerBook[] = [
      equityBook(),
      BOOK_EMPTY,
      BOOK_OK_STALE,
      bookDegraded('rate_limited'),
      BOOK_REAUTH_WITH_SNAPSHOT,
      BOOK_UNREADABLE_WITH_SNAPSHOT,
    ];
    for (const book of arms) {
      installFetch({ book });
      const r = renderPanel();
      await screen.findByTestId('broker-as-of-stamp');
      r.unmount();
      cleanup();
    }
  });
});

// =================================================================================================
// The two degradation axes — independent, all four combinations (AC-11 / AC-21)
// =================================================================================================

describe('BrokerTabPanel · two-axis degradation', () => {
  it('SSE drop: the modeled P/L dims to the declared stroke icon, last-known (never blank); snapshot fields BYTE-IDENTICAL', async () => {
    installFetch({ book: equityBook() });
    const up = renderPanel({ streamOffline: false });
    await screen.findByTestId('broker-row');
    const plUp = screen.getByTestId('broker-pl').textContent;
    const snapshotUp = screen.getByTestId('broker-snapshot-fields').innerHTML;
    // The declared stroke icon replaces the retired `⏸` glyph (criterion 29) — query the rendered
    // icon, never the character, so a weakened assertion cannot pass against its `aria-hidden` markup.
    expect(
      screen.getByTestId('broker-pl').querySelector('svg[data-testid="PauseIcon"]'),
    ).toBeNull();
    up.unmount();
    cleanup();

    installFetch({ book: equityBook() });
    renderPanel({ streamOffline: true });
    await screen.findByTestId('broker-row');
    const plDownEl = screen.getByTestId('broker-pl');
    const plDown = plDownEl.textContent ?? '';
    expect(plDownEl.querySelector('svg[data-testid="PauseIcon"]')).toBeTruthy(); // dimmed last-known, never a blank
    expect(plDown).toBe(plUp); // the FIGURE is retained, byte-identical (no glyph ever entered the text)
    // The book-snapshot family is untouched by the market-data axis.
    expect(screen.getByTestId('broker-snapshot-fields').innerHTML).toBe(snapshotUp);
  });

  it('stale book + feed up: the figure KEEPS rendering and the label names BOTH bases — a single-basis label over a stale book is the regression (AC-21)', async () => {
    installFetch({ book: equityBook({ as_of: BOOK_OK_STALE.as_of, basis: 'cache' }) });
    renderPanel({ streamOffline: false });
    await screen.findByTestId('broker-row');
    const label = screen.getByTestId('broker-pl-label').textContent ?? '';
    expect(label).toBe(BROKER_COPY.modeled.dualLabel(stampTime(BOOK_OK_STALE.as_of as string)));
    expect(label).not.toBe(BROKER_COPY.modeled.label);
    expect(
      screen.getByTestId('broker-pl').querySelector('svg[data-testid="PauseIcon"]'),
    ).toBeNull();
    // The snapshot fields carry the S6 treatment + the age-foregrounded stamp.
    expect(screen.getByTestId('broker-as-of-stamp').textContent).toContain('old — refresh');
  });

  it('fresh book + feed up: single-basis label, no stale clause (the default cell of the grid)', async () => {
    // The panel derives staleness against the REAL clock — a genuinely fresh as_of, not the
    // fixed-instant fixture stamp (which is days old by the time this suite runs).
    const justNow = new Date(Date.now() - 30_000).toISOString();
    installFetch({
      book: equityBook({ as_of: justNow, basis: 'fresh', last_attempt_at: justNow }),
    });
    renderPanel({ streamOffline: false });
    await screen.findByTestId('broker-row');
    expect(screen.getByTestId('broker-pl-label')).toHaveTextContent(BROKER_COPY.modeled.label);
    expect(screen.getByTestId('broker-as-of-stamp').textContent).not.toContain('old — refresh');
  });
});

// =================================================================================================
// Refresh honesty (AC-8) + fidelity entries (AC-14)
// =================================================================================================

describe('BrokerTabPanel · refresh + fidelity', () => {
  it('a THROTTLED refresh renders the unchanged-and-why note — never a silent no-op', async () => {
    const book = equityBook({ basis: 'cache' });
    installFetch({ book, refresh: book }); // identical envelope: cache + unmoved last_attempt_at
    renderPanel();
    await screen.findByTestId('broker-row');
    await userEvent.click(screen.getByTestId('broker-refresh'));
    const note = await screen.findByTestId('broker-refresh-note');
    expect(note).toHaveTextContent('Unchanged — still your book as of');
    expect(note).toHaveTextContent('protecting your rate limits');
  });

  it('a transport-faulted refresh still notes itself (incomplete), keeping the book rendered', async () => {
    installFetch({ book: equityBook(), refresh: 'transport-fail' });
    renderPanel();
    await screen.findByTestId('broker-row');
    await userEvent.click(screen.getByTestId('broker-refresh'));
    const note = await screen.findByTestId('broker-refresh-note');
    expect(note).toHaveTextContent("Couldn't complete the refresh");
    expect(screen.getByTestId('broker-row')).toBeInTheDocument();
  });

  it('fidelity: UNRECOGNIZED gets the cannot-fully-display entry, PARTIAL keeps its full row; the count never understates (AC-14)', async () => {
    installFetch({ book: equityBook({ positions: [POS_EQUITY, POS_PARTIAL, POS_UNRECOGNIZED] }) });
    renderPanel();
    await screen.findByTestId('broker-rows');
    expect(screen.getByTestId('broker-count')).toHaveTextContent('3 positions'); // all counted

    // R4/G1 — the bare entry is for `unrecognized` ONLY (no mapped legs). Routing `partial` there
    // too blanked 9 of the owner's 14 real rows and threw away the quantity/cost Webull DID send.
    const unfaithful = screen.getAllByTestId('broker-row-unfaithful');
    expect(unfaithful).toHaveLength(1);
    expect(unfaithful[0]).toHaveTextContent(BROKER_COPY.cannotFullyDisplay);

    // The `partial` row renders the full grammar — and still names every omission.
    expect(screen.getAllByTestId('broker-snapshot-fields')).toHaveLength(2); // equity + partial
    expect(screen.getAllByTestId('broker-fidelity-note').length).toBe(2); // partial + unrecognized
  });
});
