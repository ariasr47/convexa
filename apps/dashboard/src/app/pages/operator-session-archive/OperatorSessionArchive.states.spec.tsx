import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OperatorSessionArchive } from './OperatorSessionArchive';
import { COPY } from './copy';
import type { FetchResearchResult } from './researchClient';

function wrap(ui: ReactElement) {
  return render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);
}

function jsonResult(status: number, body: Record<string, unknown>): FetchResearchResult {
  return { status, json: body, bodyText: JSON.stringify(body) };
}

const listHit = jsonResult(200, {
  symbol: 'SPY',
  count: 1,
  books: [
    {
      symbol: 'SPY',
      et_date: '2024-06-03',
      source: 'live_massive',
      source_as_of: '2024-06-03T20:00:00Z',
    },
  ],
  store: 'hit',
  detail: null,
  vendor_called: false,
  authorizes: 'nothing',
  framing: 'RESEARCH READ — SESSION BOOK',
  provenance: 'loaded from session archive · no vendor call',
  license: 'Our research · not redistributed on a trader route.',
});

const coverageReady = jsonResult(200, {
  framing: 'RESEARCH READ — SESSION ARCHIVE COVERAGE',
  command: 'archive-coverage',
  evidence: 'this process',
  symbols: ['SPY', 'QQQ', 'IWM'],
  et_date: '2024-06-03',
  checkpoint: 'after 16:00 America/New_York',
  vendor_called: false,
  authorizes: 'nothing',
  verdict: 'fail',
  expected_due: 3,
  present: 1,
  missing: 1,
  unreadable: 0,
  not_yet_due: 1,
  blocked_occupancy: 0,
  rows: [
    {
      symbol: 'SPY',
      et_date: '2024-06-03',
      cell: 'present',
      last_readable: 'SPY 2024-06-03',
    },
    {
      symbol: 'QQQ',
      et_date: '2024-06-03',
      cell: 'missing',
      last_readable: 'none (seed fixture excluded)',
    },
  ],
  holes: [{ symbol: 'QQQ', et_date: '2024-06-03', class: 'missing' }],
});

async function unlockUsable(
  fetchImpl: ReturnType<typeof vi.fn>,
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByTestId('osa-origin'), 'http://127.0.0.1:8000');
  await user.type(screen.getByTestId('osa-token'), 'tok');
  await user.click(screen.getByTestId('osa-unlock'));
  await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
}

describe('OperatorSessionArchive distinguishable states', () => {
  it('unauthorized paints metrics_unauthorized, not origin-blocked', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResult(401, {
        error: 'metrics_unauthorized',
        detail: COPY.unauthorizedBody,
      }),
    );
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getByText(COPY.unauthorizedTitle)).toBeInTheDocument();
    });
    expect(screen.queryByText(COPY.originBlockedTitle)).not.toBeInTheDocument();
    expect(screen.queryByTestId('osa-books-table')).not.toBeInTheDocument();
  });

  it('family 404 paints origin-blocked', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 404,
      json: null,
      bodyText: 'Not Found',
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getByText(COPY.originBlockedTitle)).toBeInTheDocument();
    });
    expect(screen.queryByText(COPY.booksFramingEmpty)).not.toBeInTheDocument();
  });

  it('cors-fault title present; stale chip absent', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} corsSignal={() => true} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getByText(COPY.corsTitle)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('osa-stale-chip')).not.toBeInTheDocument();
    expect(screen.queryByText(COPY.staleChip)).not.toBeInTheDocument();
  });

  it('empty list framing; books columns et_date source source_as_of only', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) return coverageReady;
      return jsonResult(200, {
        symbol: 'SPY',
        count: 0,
        books: [],
        store: 'miss',
        detail: 'no session book for SPY',
        vendor_called: false,
        authorizes: 'nothing',
        framing: COPY.booksFramingEmpty,
      });
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getByText(COPY.booksFramingEmpty)).toBeInTheDocument();
    });
    expect(screen.queryByText(COPY.originBlockedTitle)).not.toBeInTheDocument();
  });

  it('ready list + coverage; no present/kept books column; present is a button', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) return coverageReady;
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getByTestId('osa-books-table')).toBeInTheDocument();
    });
    const table = screen.getByTestId('osa-books-table');
    expect(within(table).getByText('et_date')).toBeInTheDocument();
    expect(within(table).getByText('source')).toBeInTheDocument();
    expect(within(table).getByText('source_as_of')).toBeInTheDocument();
    expect(within(table).queryByText('present')).not.toBeInTheDocument();
    expect(within(table).queryByText('kept')).not.toBeInTheDocument();
    expect(screen.getByTestId('osa-present-SPY')).toBeInTheDocument();
    expect(screen.getByText(COPY.coverageEvidence)).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('Export')).not.toBeInTheDocument();
  });

  it('chip-switch hides previous dates', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) return coverageReady;
      if (tail.includes('/QQQ')) {
        return jsonResult(200, {
          symbol: 'QQQ',
          count: 1,
          books: [
            {
              symbol: 'QQQ',
              et_date: '2024-07-01',
              source: 'live_massive',
              source_as_of: 'x',
            },
          ],
          store: 'hit',
          detail: null,
          vendor_called: false,
          authorizes: 'nothing',
          framing: COPY.booksFramingHit,
        });
      }
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => screen.getByTestId('osa-book-row-2024-06-03'));
    await user.click(screen.getByTestId('osa-chip-QQQ'));
    await waitFor(() => {
      expect(screen.queryByTestId('osa-book-row-2024-06-03')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('osa-book-row-2024-07-01')).toBeInTheDocument();
    });
  });

  it('coverage unclassified fail → Coverage readout unavailable; no stale chip', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) throw new TypeError('Failed to fetch');
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} corsSignal={() => false} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getByText(COPY.coverageUnavailable)).toBeInTheDocument();
    });
    expect(screen.getByTestId('osa-books-table')).toBeInTheDocument();
    expect(screen.queryByTestId('osa-stale-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('osa-coverage-rows')).not.toBeInTheDocument();
  });

  it('warm coverage unclassified after prior matrix → AC-38, prior matrix not kept', async () => {
    const user = userEvent.setup();
    let coverageCalls = 0;
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) {
        coverageCalls += 1;
        if (coverageCalls === 1) return coverageReady;
        throw new TypeError('Failed to fetch');
      }
      if (tail.includes('/QQQ')) throw new TypeError('Failed to fetch');
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} corsSignal={() => false} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => screen.getByTestId('osa-coverage-rows'));
    // Chip-switch → books offline (Retry visible); page Retry re-issues coverage → AC-38
    await user.click(screen.getByTestId('osa-chip-QQQ'));
    await waitFor(() => screen.getByTestId('osa-retry'));
    await user.click(screen.getByTestId('osa-retry'));
    await waitFor(() => {
      expect(screen.getByText(COPY.coverageUnavailable)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('osa-coverage-rows')).not.toBeInTheDocument();
  });

  it('not-storing exclusive standing — no books table', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResult(500, {
        error: 'session_archive_not_storing',
        detail: 'session archive not storing',
      }),
    );
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => {
      expect(screen.getAllByText(/session archive not storing/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId('osa-books-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('osa-stale-chip')).not.toBeInTheDocument();
  });

  const NO_EXPECTED = 'RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES';
  const ORDINARY = 'RESEARCH READ — SESSION ARCHIVE COVERAGE';

  const coverageHoliday = jsonResult(200, {
    framing: NO_EXPECTED,
    command: 'archive-coverage',
    evidence: 'this process',
    symbols: ['SPY', 'QQQ', 'IWM'],
    et_date: '2026-11-26',
    checkpoint: 'after 16:00 America/New_York',
    vendor_called: false,
    authorizes: 'nothing',
    license: 'Our research · not redistributed on a trader route.',
    verdict: 'not_due',
    expected_due: 0,
    present: 0,
    missing: 0,
    unreadable: 0,
    not_yet_due: 0,
    blocked_occupancy: 0,
    rows: [],
    holes: [],
  });

  const coverageNotYetDue = jsonResult(200, {
    framing: ORDINARY,
    command: 'archive-coverage',
    evidence: 'this process',
    symbols: ['SPY', 'QQQ', 'IWM'],
    et_date: '2099-01-05',
    checkpoint: 'after 16:00 America/New_York',
    vendor_called: false,
    authorizes: 'nothing',
    license: 'Our research · not redistributed on a trader route.',
    verdict: 'not_due',
    expected_due: 0,
    present: 0,
    missing: 0,
    unreadable: 0,
    not_yet_due: 3,
    blocked_occupancy: 0,
    rows: [
      {
        symbol: 'SPY',
        et_date: '2099-01-05',
        cell: 'not yet due',
        last_readable: 'none (seed fixture excluded)',
      },
      {
        symbol: 'QQQ',
        et_date: '2099-01-05',
        cell: 'not yet due',
        last_readable: 'none (seed fixture excluded)',
      },
      {
        symbol: 'IWM',
        et_date: '2099-01-05',
        cell: 'not yet due',
        last_readable: 'none (seed fixture excluded)',
      },
    ],
    holes: [],
  });

  it('holiday empty-expected: no-expected framing, zero counts, no rows, no verdict token, no weekend word', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) return coverageHoliday;
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    const card = await screen.findByTestId('osa-coverage');
    expect(card).toHaveTextContent(NO_EXPECTED);
    expect(card).toHaveTextContent(
      'Expected due: 0 · present: 0 · missing: 0 · unreadable: 0 · not yet due: 0 · blocked occupancy: 0',
    );
    expect(screen.queryByTestId('osa-coverage-rows')).not.toBeInTheDocument();
    expect(card.textContent).not.toMatch(/\bpass\b/i);
    expect(card.textContent).not.toMatch(/\bfail\b/i);
    expect(card.textContent).not.toMatch(/not_due/);
    expect(card.textContent).not.toMatch(/\[PASS\]/);
    expect(card.textContent?.toLowerCase()).not.toContain('weekend');
    expect(card.textContent).not.toMatch(/Thanksgiving/i);
    expect(card).toHaveTextContent(COPY.coverageClosing);
  });

  it('not-yet-due session weekday is ordinary framing + rows + verdict (footgun pin)', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) return coverageNotYetDue;
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    const card = await screen.findByTestId('osa-coverage');
    expect(card).toHaveTextContent(ORDINARY);
    expect(card.textContent).not.toContain('NO EXPECTED IDENTITIES');
    expect(screen.getByTestId('osa-coverage-rows')).toBeInTheDocument();
    expect(card).toHaveTextContent('not_due');
    expect(card).toHaveTextContent('not yet due');
  });

  it('AC-29: digest Retry after unreadable re-issues that identity load GET only', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) return coverageReady;
      if (tail.includes('/book')) {
        return jsonResult(500, {
          error: 'session_book_unreadable',
          detail: 'session book unreadable: body object unreadable: missing',
        });
      }
      return listHit;
    });
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await unlockUsable(fetchImpl, user);
    await waitFor(() => screen.getByTestId('osa-book-row-2024-06-03'));
    await user.click(screen.getByTestId('osa-book-row-2024-06-03'));
    await waitFor(() => {
      expect(screen.getByText('session book unreadable:')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('osa-stale-chip')).not.toBeInTheDocument();

    fetchImpl.mockClear();
    await user.click(screen.getByTestId('osa-retry'));
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const tail = (fetchImpl.mock.calls[0][0] as { tail: string }).tail;
    expect(tail).toContain('/session-books/SPY/book');
    expect(tail).toContain('et_date=2024-06-03');
    await waitFor(() => {
      expect(screen.getByText('session book unreadable:')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('osa-stale-chip')).not.toBeInTheDocument();
  });
});
