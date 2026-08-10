/**
 * F6 — reassessment referencing a real holding: the built request carries the as-of basis
 * (AC-18's testable arm), the reference uses the EXISTING pos_* shape off the EXISTING
 * eval-subject selection, and the verdict/export surface offers NO accept or write affordance
 * (AC-19). The sim Accept flow's own specs are untouched elsewhere and stay green.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { brokerLegId, buildBrokerPositionView } from './brokerView';
import { BOOK_OK_FRESH, FIXED_NOW_MS, POS_EQUITY, POS_SPREAD } from './fixtures';
import { BrokerReassessAction, buildBrokerReassessment } from './reassess';

const theme = createTheme();
const mark = (m: number): MarkResult => ({ mark: m, basis: 'snapshot', frozen: false });

const spreadView = buildBrokerPositionView({
  position: POS_SPREAD,
  legMarks: new Map([
    [brokerLegId('bp-spread-1', 0), mark(5.1)],
    [brokerLegId('bp-spread-1', 1), mark(2.0)],
  ]),
  dte: 20,
  nowMs: FIXED_NOW_MS,
  book: BOOK_OK_FRESH,
});

afterEach(cleanup);

describe('buildBrokerReassessment', () => {
  it('carries the as-of basis STRING and the machine stamp — staleness always disclosed (AC-18)', () => {
    const req = buildBrokerReassessment(spreadView, BOOK_OK_FRESH);
    expect(req.as_of).toBe(BOOK_OK_FRESH.as_of);
    expect(req.as_of_basis).toContain(`on your book as of ${BOOK_OK_FRESH.as_of}`);
    expect(req.as_of_basis).toContain('a snapshot, never live');
  });

  it('references the holding through the EXISTING pos_* shape off the EXISTING eval subject', () => {
    const req = buildBrokerReassessment(spreadView, BOOK_OK_FRESH);
    // evalSubjectOf picks the long option leg — the 250C of the spread.
    expect(req.position).toEqual({
      expiration: '2026-08-21',
      strike: 250,
      right: 'call',
      plPct: expect.any(Number),
    });
    expect(req.ticker).toBe('TSLA');
  });

  it('the modeled figure never travels without its named basis', () => {
    const req = buildBrokerReassessment(spreadView, BOOK_OK_FRESH);
    expect(req.modeled_pl_dollar).toBe(spreadView.pl_dollar);
    expect(req.modeled_pl_basis).toBe('Convexa-modeled');
  });

  it('a shares-only holding yields position: null (no option subject) — total, never a throw', () => {
    const equityView = buildBrokerPositionView({
      position: POS_EQUITY,
      legMarks: new Map([[brokerLegId('bp-equity-1', 0), mark(250.4)]]),
      dte: null,
      nowMs: FIXED_NOW_MS,
      book: BOOK_OK_FRESH,
    });
    const req = buildBrokerReassessment(equityView, BOOK_OK_FRESH);
    expect(req.position).toBeNull();
    expect(req.as_of_basis).toContain('on your book as of');
  });
});

describe('BrokerReassessAction — advisory only (AC-19)', () => {
  it('opens the export with the visible basis line + JSON; offers NO accept or write affordance', async () => {
    render(
      <ThemeProvider theme={theme}>
        <BrokerReassessAction view={spreadView} book={BOOK_OK_FRESH} />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByTestId('broker-reassess'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('broker-reassess-basis').textContent).toContain(
      'on your book as of',
    );
    expect(within(dialog).getByTestId('broker-reassess-json').textContent).toContain(
      '"source": "broker_webull"',
    );

    // The negative space: no accept, no tracker write, no order words — absence, not disabled.
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByTestId('open-entry')).toBeNull();
    expect(within(dialog).queryByText(/add to (your )?tracker/i)).toBeNull();
    expect(
      within(dialog).queryByRole('button', { name: /close position|trim|roll|order/i }),
    ).toBeNull();
  });
});
