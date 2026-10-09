/**
 * StateExportDrawer — the tradeable-rec-inputs additions (SPEC §4, AC-91/92/93/94/95/97, PLAN F9).
 * Mocks ONLY the network boundary (`fetch`).
 */
import { theme } from '@/shared/theme/theme';
import type { RecExport } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAWER_NOT_SENT, DRAWER_RISK_AS_NEXT, DRAWER_RISK_AS_SENT } from './copy';
import { StateExportDrawer } from './StateExportDrawer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeExport(overrides: Partial<RecExport> = {}): RecExport {
  return {
    ticker: 'TSLA',
    as_of: '2026-06-26T14:00:00Z',
    context: {
      gamma_flip: 248,
      candidates: {
        ticker: 'TSLA',
        state: 'ok',
        as_of: '2026-06-26T14:00:00Z',
        snapshot_age_seconds: 30,
        session_basis: 'after_close',
        quote_age: 'unknown',
        anchor_spot: 250,
        anchor_basis: 'gex_spot',
        band_pct: 15,
        budget: 'handoff',
        sent_to_model: false,
        caps: {
          tenors: 4,
          rights: 2,
          strikes_per_tenor_right: 8,
          max_records: 64,
          max_bytes: 24000,
        },
        included: { contracts: 12, expirations: ['2026-07-18'], expiration_count: 1 },
        omitted: {
          total: 3,
          expirations_omitted_by_cap: 0,
          by_reason: {
            outside_window: 0,
            outside_band: 3,
            no_interest: 0,
            expiration_cap: 0,
            strike_cap: 0,
          },
        },
        liquidity: {
          quoted: 10,
          no_two_sided_quote: 2,
          atm_relative_spread_band: 'moderate',
          wide_quotes: false,
          wide_quote_threshold_pct: 15,
        },
        contracts: [],
      },
      risk_inputs: {
        state: 'not_set',
        account_size: null,
        per_trade_cap: null,
        effective_dollar_cap: {
          state: 'not_set',
          value: null,
          not_derivable_reason: null,
          derived_from: { account_size: null, cap_value: null, cap_unit: null },
        },
      },
      open_positions: { source: 'simulated', state: 'not_sent' },
    },
    persona_prompt: 'prompt text',
    glossary: 'glossary text',
    egress_note: 'the complete list',
    egress_categories: [
      { key: 'context', sent: true },
      { key: 'candidates', sent: true },
      { key: 'risk_inputs', sent: true },
      { key: 'open_positions', sent: true },
      { key: 'persona_prompt', sent: true },
      { key: 'glossary', sent: true },
    ],
    ...overrides,
  };
}

function stubFetch(body: RecExport) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

function renderDrawer(props: Partial<Parameters<typeof StateExportDrawer>[0]> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StateExportDrawer open ticker="TSLA" personaId={null} onClose={() => undefined} {...props} />
    </ThemeProvider>,
  );
}

describe('StateExportDrawer — Candidate contracts / risk inputs / open positions (AC-91)', () => {
  // AC-91 + AC-3: the candidate-contracts line carries the wire counts only, and each cap clause
  // renders only when its own count is non-zero.
  function capBoundExport(): RecExport {
    const base = makeExport();
    return makeExport({
      context: {
        ...base.context,
        candidates: {
          ...base.context.candidates,
          omitted: {
            total: 14254,
            expirations_omitted_by_cap: 29,
            by_reason: {
              outside_window: 724,
              outside_band: 6296,
              no_interest: 988,
              expiration_cap: 5527,
              strike_cap: 719,
            },
          },
        },
      },
    });
  }

  it.each([
    {
      name: 'a cap that never bound shows the counts and adds no cap clause',
      capBound: false,
      present: ['12 contracts across 1 expirations', '3 omitted (outside_band)'],
      absent: ['omitted by the cap', 'strikes dropped'],
    },
    {
      name: 'AC-3 — a tenor cap that bound names expirations omitted BY THE CAP and strikes dropped',
      capBound: true,
      present: ['29 expirations omitted by the cap', '719 strikes dropped (strike cap)'],
      absent: [],
    },
  ])(
    'the candidate-contracts line states wire counts and cap clauses: $name',
    async ({ capBound, present, absent }) => {
      stubFetch(capBound ? capBoundExport() : makeExport());
      renderDrawer();
      await waitFor(() => expect(screen.getByText('Candidate contracts')).toBeInTheDocument());
      const section = screen.getByText('Candidate contracts').closest('div')
        ?.parentElement as HTMLElement;
      for (const text of present) expect(section.textContent).toContain(text);
      for (const text of absent) expect(section.textContent).not.toContain(text);
    },
  );

  it('AC-97 — anonymous export reports risk_inputs as `not set`, section present, never omitted', async () => {
    stubFetch(makeExport());
    renderDrawer();
    await waitFor(() => expect(screen.getByText(DRAWER_RISK_AS_NEXT)).toBeInTheDocument());
    expect(screen.getAllByText(/"state": "not_set"/).length).toBeGreaterThan(0);
  });
});

describe('StateExportDrawer — risk-inputs label (AC-65)', () => {
  it('labels as-sent when a rec is on screen; as-next otherwise — never both', async () => {
    stubFetch(makeExport());
    renderDrawer({ hasRecOnScreen: true });
    await waitFor(() => expect(screen.getByText(DRAWER_RISK_AS_SENT)).toBeInTheDocument());
    expect(screen.queryByText(DRAWER_RISK_AS_NEXT)).not.toBeInTheDocument();
  });
});

describe('StateExportDrawer — an unsent category (AC-92)', () => {
  it('renders the explicit Not sent line rather than an omitted section', async () => {
    stubFetch(
      makeExport({
        egress_categories: [
          { key: 'context', sent: true },
          { key: 'candidates', sent: false },
          { key: 'risk_inputs', sent: true },
          { key: 'open_positions', sent: true },
          { key: 'persona_prompt', sent: true },
          { key: 'glossary', sent: true },
        ],
      }),
    );
    renderDrawer();
    await waitFor(() => expect(screen.getAllByTestId('export-not-sent').length).toBeGreaterThan(0));
    expect(screen.getAllByText(DRAWER_NOT_SENT).length).toBeGreaterThan(0);
  });
});

describe('StateExportDrawer — the as-sent set cannot be recovered (AC-95)', () => {
  it('states the recovery failure instead of listing a re-assembled set', async () => {
    stubFetch(makeExport());
    renderDrawer({ hasRecOnScreen: true, asSentCandidates: undefined });
    await waitFor(() =>
      expect(
        screen.getByText(/as-sent candidate set .* could not be recovered/),
      ).toBeInTheDocument(),
    );
  });
});
