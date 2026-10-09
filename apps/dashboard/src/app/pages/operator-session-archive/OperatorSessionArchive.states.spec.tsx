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
  await user.click(screen.getByTestId('osa-origin'));
  await user.paste('http://127.0.0.1:8000');
  await user.click(screen.getByTestId('osa-token'));
  await user.paste('tok');
  await user.click(screen.getByTestId('osa-unlock'));
  await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
}

describe('OperatorSessionArchive distinguishable states', () => {
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
});
