/**
 * R4 — the honest GENERIC OPTION ROW, against capture-shaped fixtures.
 *
 * The real Webull positions feed carries no strike, expiry, call/put or contract multiplier for a
 * held option, and `symbol` is the bare underlying ticker. 9 of the owner's 14 real positions are
 * therefore `fidelity: partial`. Four gaps closed here, each with a distinct failure mode:
 *
 *  G1 — routing ANY non-`exact` fidelity into the bare "can't fully display" state blanked 9 of 14
 *       rows and DISCARDED the quantity and cost Webull did supply. Reporting less than we honestly
 *       know is its own dishonesty.
 *  G2 — `not recorded` ("our own saved record never held it") is FALSE on a broker row: Convexa
 *       holds no record of it at all. The fact is missing from the FEED ⇒ `not provided`.
 *  G3 — `unavailable` frames a gap as "this cycle"; a contract that can't be identified will not
 *       become priceable on refresh. That is a PERMANENT withhold with its own explanation.
 *  G4 — with no multiplier, `Net entry` / `$ P/L` / `% P/L` are units claims we cannot make. They
 *       are withheld, never defaulted to ×1 or ×100 (the positions-legs lesson).
 */
import type { BrokerPosition } from '@convexa/api';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrokerPositionCard } from './BrokerPositionCard';
import { BrokerPositionRow } from './BrokerPositionRow';
import { buildBrokerPositionView } from './brokerView';
import { BROKER_COPY } from './copy';
import {
  BOOK_CAPTURE_SHAPED_POSITIONS,
  FIXED_NOW_MS,
  NOTE_MULTIPLIER_WITHHELD,
  NOTE_NO_CONTRACT_DETAIL,
  POS_CAPTURE_AMD_STOCK,
  POS_CAPTURE_NO_MULTIPLIER,
  POS_CAPTURE_NVDA_OPTION,
  POS_CAPTURE_SHORT_OPTION,
  POS_EQUITY,
  POS_NO_COST_BASIS,
  POS_PARTIAL,
  POS_SPREAD,
  POS_UNRECOGNIZED,
} from './fixtures';

function viewOf(bp: BrokerPosition) {
  return buildBrokerPositionView({
    position: bp,
    legMarks: new Map(),
    dte: null,
    nowMs: FIXED_NOW_MS,
    book: null,
  });
}

function renderRow(bp: BrokerPosition, streamOffline = false) {
  return render(
    <BrokerPositionRow
      view={viewOf(bp)}
      streamOffline={streamOffline}
      isStale={false}
      asOf={null}
    />,
  );
}

afterEach(() => cleanup());

// =================================================================================================
// G1 — `partial` keeps the full row grammar; only `unrecognized` collapses
// =================================================================================================

describe('R4 · G1 — fidelity routing', () => {
  it('a PARTIAL generic option renders the FULL row, not the bare cannot-display state', () => {
    renderRow(POS_CAPTURE_NVDA_OPTION);
    // The bare state is NOT used…
    expect(screen.queryByTestId('broker-row-unfaithful')).toBeNull();
    expect(screen.queryByText(BROKER_COPY.cannotFullyDisplay)).toBeNull();
    // …and the facts Webull DID supply are all on screen.
    expect(screen.getByTestId('broker-snapshot-fields')).toBeTruthy();
    expect(screen.getByTestId('broker-qty').textContent).toBe('10 ×');
    expect(screen.getByTestId('broker-net-entry').textContent).toBe('$7,890.00 debit');
    expect(screen.getByTestId('broker-leg-line').textContent).toContain('Long 10 ×');
    expect(screen.getByTestId('broker-leg-line').textContent).toContain('cost $7.89');
  });

  it('…and still NAMES every omission (nothing is invented in the gap)', () => {
    renderRow(POS_CAPTURE_NVDA_OPTION);
    const notes = screen.getAllByTestId('broker-fidelity-note').map((n) => n.textContent);
    expect(notes).toContain(NOTE_NO_CONTRACT_DETAIL);
    expect(notes.length).toBe(POS_CAPTURE_NVDA_OPTION.fidelity_notes?.length);
  });

  it('UNRECOGNIZED — and only unrecognized — gets the bare entry', () => {
    renderRow(POS_UNRECOGNIZED);
    expect(screen.getByTestId('broker-row-unfaithful')).toBeTruthy();
    expect(screen.getByText(BROKER_COPY.cannotFullyDisplay)).toBeTruthy();
    expect(screen.queryByTestId('broker-snapshot-fields')).toBeNull();
    // The omission is still named — one component serves both states.
    expect(screen.getAllByTestId('broker-fidelity-note').length).toBe(1);
  });

  it('the <sm CARD collapse follows the same rule', () => {
    const shared = { streamOffline: false, isStale: false, asOf: null };
    const { rerender } = render(
      <BrokerPositionCard view={viewOf(POS_CAPTURE_NVDA_OPTION)} {...shared} />,
    );
    expect(screen.queryByTestId('broker-row-unfaithful')).toBeNull();
    expect(screen.getByTestId('broker-qty').textContent).toBe('10 ×');
    expect(screen.getAllByTestId('broker-fidelity-note').length).toBeGreaterThan(0);

    rerender(<BrokerPositionCard view={viewOf(POS_UNRECOGNIZED)} {...shared} />);
    expect(screen.getByTestId('broker-row-unfaithful')).toBeTruthy();
  });

  it('a short generic option keeps its SIDE and size from the signed wire quantity', () => {
    renderRow(POS_CAPTURE_SHORT_OPTION);
    expect(screen.getByTestId('broker-leg-line').textContent).toContain('Short 10 ×');
    expect(screen.getByTestId('broker-qty').textContent).toBe('10 ×');
  });

  it('an EXACT stock row is unchanged by any of this', () => {
    renderRow(POS_CAPTURE_AMD_STOCK);
    expect(screen.queryByTestId('broker-row-unfaithful')).toBeNull();
    expect(screen.queryAllByTestId('broker-fidelity-note')).toEqual([]);
    expect(screen.getByTestId('broker-qty').textContent).toBe('25 sh');
  });
});

// =================================================================================================
// broker-option-grouping F10 — defect repair: the mobile/desktop `ModeledPl` parity split on
// `unrecognized`. `BrokerPositionRow` renders `<ModeledPl>` OUTSIDE the `unfaithful` branch;
// `BrokerPositionCard` rendered it only INSIDE the non-unfaithful branch, so the mobile card
// OMITTED the slot entirely on an `unrecognized` entry — the shape `[absent-is-not-none]`
// forbids, since the mobile reader cannot tell "no answer" from "nothing to say". Named
// pre-existing-defect repair (owner ruling Q1 = A, 2026-08-06); NOT grouping behaviour.
// =================================================================================================

describe('R4/F10 · G1 parity — the modeled P/L withheld literal on `unrecognized` (AC-24b)', () => {
  it('an `unrecognized` entry renders the withheld modeled P/L with its label on BOTH form factors', () => {
    const view = viewOf(POS_UNRECOGNIZED);
    const shared = { view, streamOffline: false, isStale: false, asOf: null };
    const desktop = render(<BrokerPositionRow {...shared} />);
    const desktopPl = desktop.getByTestId('broker-pl').textContent;
    const desktopLabel = desktop.getByTestId('broker-pl-label').textContent;
    desktop.unmount();

    const mobile = render(<BrokerPositionCard {...shared} />);
    expect(mobile.getByTestId('broker-pl').textContent).toBe(desktopPl);
    expect(mobile.getByTestId('broker-pl-label').textContent).toBe(desktopLabel);
    expect(desktopPl).toBe('not provided'); // the literal, not a blank and not a number
    mobile.unmount();
  });
});

// =================================================================================================
// G2 — `not recorded` belongs to OUR records and appears in NO broker state
// =================================================================================================

describe('R4 · G2 — the feed literal, never the own-record one', () => {
  const ALL_ARMS: [string, BrokerPosition][] = [
    ['capture NVDA option', POS_CAPTURE_NVDA_OPTION],
    ['capture short option', POS_CAPTURE_SHORT_OPTION],
    ['capture AMD stock', POS_CAPTURE_AMD_STOCK],
    ['capture no-multiplier', POS_CAPTURE_NO_MULTIPLIER],
    ['equity', POS_EQUITY],
    ['spread', POS_SPREAD],
    ['no cost basis', POS_NO_COST_BASIS],
    ['partial (legacy fixture)', POS_PARTIAL],
    ['unrecognized', POS_UNRECOGNIZED],
  ];

  it('a generic option row renders `not provided` where the contract detail would be', () => {
    renderRow(POS_CAPTURE_NVDA_OPTION);
    const legLine = screen.getByTestId('broker-leg-line').textContent ?? '';
    expect(legLine).toContain('not provided');
    expect(legLine).not.toContain('not recorded');
  });

  it.each(ALL_ARMS)('the string `not recorded` appears in NO broker state: %s', (_name, bp) => {
    const r = renderRow(bp);
    expect(r.container.textContent).not.toContain('not recorded');
    // …in the projection too, not merely in what this row happens to render.
    const v = viewOf(bp);
    expect(JSON.stringify([v.legs, v.structure_line_full, v.qty_tip])).not.toContain(
      'not recorded',
    );
    r.unmount();
  });

  it('the SIM book keeps `not recorded` — this substitution is broker-only', async () => {
    const { buildPositionView, NOT_RECORDED } = await import('@/features/trading/positions/view');
    const v = buildPositionView({
      position: {
        id: 'p',
        legs: [
          {
            id: 'l',
            kind: 'option',
            ticker: 'TSLA',
            side: 'long',
            qty: 1,
            multiplier: 100,
            entry_price: 4,
            entry_basis: 'user_entered',
            expiration: null,
            strike: null,
            right: null,
          },
        ],
        opened_time: '',
        status: 'open',
        entry_mode: 'manual',
        schema_version: 3,
      },
      legMarks: new Map(),
      dte: null,
    });
    expect(v.legs[0].instrument_text).toBe(NOT_RECORDED);
  });
});

// =================================================================================================
// G3 — permanent vs this-cycle withholding on the modeled figure
// =================================================================================================

describe('R4 · G3 — the modeled P/L withholds PERMANENTLY when the contract is unidentifiable', () => {
  it('renders `not provided` (never `unavailable`) with the model’s own explanation', async () => {
    renderRow(POS_CAPTURE_NVDA_OPTION);
    const pl = screen.getByTestId('broker-pl');
    expect(pl.textContent).toBe('not provided');
    expect(pl.textContent).not.toBe('unavailable');
    // The tip explains the permanence — a refresh will not fix it.
    expect(viewOf(POS_CAPTURE_NVDA_OPTION).unpriceable).toBe(true);
    expect(BROKER_COPY.modeled.unpriceableTip).toMatch(/can't identify/);
  });

  it('the figure is always basis-LABELLED even while withheld (AC-21)', () => {
    renderRow(POS_CAPTURE_NVDA_OPTION);
    expect(screen.getByTestId('broker-pl-label').textContent).toBe(BROKER_COPY.modeled.label);
  });

  it('a fully-identified contract with an unresolved mark keeps the THIS-CYCLE literal', () => {
    // POS_SPREAD carries strike/expiry/right; nothing resolved this cycle ⇒ `unavailable`.
    expect(viewOf(POS_SPREAD).unpriceable).toBe(false);
    renderRow(POS_SPREAD);
    expect(screen.getByTestId('broker-pl').textContent).toBe('unavailable');
  });

  it('a missing COST BASIS also withholds permanently (the feed never sent it)', () => {
    renderRow(POS_NO_COST_BASIS);
    expect(screen.getByTestId('broker-pl').textContent).toBe('not provided');
    expect(screen.getByTestId('broker-net-entry').textContent).toBe('not provided');
  });
});

// =================================================================================================
// G4 — the multiplier gate (guard-only against real data; built and tested regardless)
// =================================================================================================

describe('R4 · G4 — an unknown multiplier withholds every multiplier-dependent output', () => {
  it('withholds Net entry, the $ figure and the %, and never defaults to ×1 or ×100', () => {
    const v = viewOf(POS_CAPTURE_NO_MULTIPLIER);
    expect(v.multiplier_known).toBe(false);
    expect(v.net_entry_text).toBe('not provided');
    expect(v.pl_dollar).toBeNull();
    expect(v.pl_pct).toEqual({ kind: 'unavailable' });
    // ×1 would be 3396; ×100 would be 339600. Neither is claimed.
    expect(v.mark.net_mark).toBeNull();
  });

  it('drops the contract-size clause from the qty tip rather than asserting one', () => {
    expect(viewOf(POS_CAPTURE_NO_MULTIPLIER).qty_tip).toBe('4 contracts.');
    expect(viewOf(POS_CAPTURE_NO_MULTIPLIER).qty_tip).not.toContain('shares each');
    // A row whose multiplier IS known keeps the clause.
    expect(viewOf(POS_CAPTURE_NVDA_OPTION).qty_tip).toContain('100 shares each');
  });

  it('renders the withheld row without leaking NaN anywhere', () => {
    const r = renderRow(POS_CAPTURE_NO_MULTIPLIER);
    expect(r.container.textContent).not.toContain('NaN');
    expect(screen.getByTestId('broker-net-entry').textContent).toBe('not provided');
    expect(screen.getByTestId('broker-pl').textContent).toBe('not provided');
    // The broker-supplied facts Webull DID send are still rendered — withholding is scoped.
    expect(screen.getByTestId('broker-qty').textContent).toBe('4 ×');
    expect(screen.getByTestId('broker-leg-line').textContent).toContain('cost $8.49');
    expect(screen.getAllByTestId('broker-fidelity-note').map((n) => n.textContent)).toContain(
      NOTE_MULTIPLIER_WITHHELD,
    );
  });

  it('a KNOWN multiplier still produces the full figures (the gate is not a blanket)', () => {
    const v = viewOf(POS_CAPTURE_NVDA_OPTION);
    expect(v.multiplier_known).toBe(true);
    expect(v.net_entry_text).toBe('$7,890.00 debit'); // 7.89 × 10 × 100, Webull's own total_cost
  });
});

// =================================================================================================
// The capture-shaped book, end to end
// =================================================================================================

describe('R4 · the capture-shaped book renders every row honestly', () => {
  it('no row is blanked, and no row invents a fact', () => {
    render(
      <>
        {BOOK_CAPTURE_SHAPED_POSITIONS.map((bp) => (
          <BrokerPositionRow
            key={bp.broker_position_id}
            view={viewOf(bp)}
            streamOffline={false}
            isStale={false}
            asOf={null}
          />
        ))}
      </>,
    );
    // Every position present, none collapsed to the bare entry.
    expect(screen.getAllByTestId('broker-row').length).toBe(BOOK_CAPTURE_SHAPED_POSITIONS.length);
    expect(screen.queryAllByTestId('broker-row-unfaithful')).toEqual([]);
    expect(screen.getAllByTestId('broker-qty').map((n) => n.textContent)).toEqual([
      '25 sh',
      '10 ×',
      '10 ×',
    ]);
  });
});
