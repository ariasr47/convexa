import { theme } from '@/shared/theme/theme';
import type { StraddleMove as StraddleMoveRead } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StraddleMove } from './StraddleMove';
import straddleMoveSource from './StraddleMove?raw';
import { NO_EXPIRATION_IN_WINDOW, NO_QUOTE, TOOLTIP, UNAVAILABLE } from './copy';

afterEach(() => cleanup());

function renderWidget(move: StraddleMoveRead | null | undefined) {
  return render(
    <ThemeProvider theme={theme}>
      <StraddleMove move={move} />
    </ThemeProvider>,
  );
}

function okMove(overrides: Partial<StraddleMoveRead> = {}): StraddleMoveRead {
  return {
    state: 'ok',
    as_of: '2026-06-26T14:00:00Z',
    session_basis: 'after_close',
    anchor_spot: 250,
    anchor_basis: 'gex_spot',
    anchor_label: 'gex_spot',
    primary_expiration: '2026-07-18',
    wide_quote_threshold_pct: 15,
    tenors: [
      {
        expiration: '2026-08-21',
        dte: 59,
        strike_used: 250,
        strike_distance_pct: 0,
        straddle_price: 15,
        move_dollars: 15,
        move_pct: 6,
        basis: 'atm_straddle_mid',
        quote_spread_pct_of_mid: 5,
        wide_quotes: false,
      },
      {
        expiration: '2026-07-18',
        dte: 25,
        strike_used: 250,
        strike_distance_pct: 0,
        straddle_price: 10,
        move_dollars: 10,
        move_pct: 4,
        basis: 'atm_straddle_mid',
        quote_spread_pct_of_mid: 8,
        wide_quotes: false,
      },
    ],
    ...overrides,
  };
}

describe('StraddleMove — the ok state (AC-43/45/53)', () => {
  it('renders exactly ONE tenor — the payload-designated primary, selected by EXACT expiration match, never array order', () => {
    renderWidget(okMove());
    // primary_expiration is '2026-07-18' (move_dollars 10), which is SECOND in the array — proving
    // the widget does not just take tenors[0].
    expect(screen.getByTestId('straddle-move-headline')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('straddle-move-headline')).toHaveTextContent('4.0%');
  });

  it('the basis line is visible WITHOUT hovering, and names the expiration/DTE/anchor', () => {
    renderWidget(okMove());
    const basis = screen.getByTestId('straddle-move-basis');
    expect(basis).toHaveTextContent('2026-07-18');
    expect(basis).toHaveTextContent('25 DTE');
    expect(basis).toHaveTextContent('gex_spot');
    expect(basis).toHaveTextContent('250');
  });

  it('the advisory line is visible without hovering', () => {
    renderWidget(okMove());
    expect(screen.getByTestId('straddle-move-advisory')).toHaveTextContent(/not a forecast/);
  });

  it('"Expected move" appears ONLY inside the tooltip, never as a label/heading/chip (AC-44)', () => {
    renderWidget(okMove());
    expect(screen.queryByText(/Expected move/i)).not.toBeInTheDocument();
    expect(TOOLTIP).toMatch(/expected move/i);
  });

  it('a wide straddle carries the marker and the threshold applied (AC-49)', () => {
    renderWidget(
      okMove({
        tenors: okMove().tenors.map((t) =>
          t.expiration === '2026-07-18' ? { ...t, wide_quotes: true } : t,
        ),
      }),
    );
    expect(screen.getByTestId('straddle-move-wide-quotes')).toHaveTextContent('15%');
  });
});

describe('StraddleMove — the three distinct unavailable causes (AC-46/47/48)', () => {
  it('no_quote renders its own literal', () => {
    renderWidget({ ...okMove(), state: 'no_quote', tenors: [] });
    expect(screen.getByTestId('straddle-move-no-quote')).toHaveTextContent(NO_QUOTE);
  });
  it('not_computed renders its own literal, distinct from no_quote', () => {
    renderWidget({ ...okMove(), state: 'not_computed', tenors: [] });
    expect(screen.getByTestId('straddle-move-unavailable')).toHaveTextContent(UNAVAILABLE);
  });
  it('no_expiration_in_window renders its own literal, distinct from the other two', () => {
    renderWidget({ ...okMove(), state: 'no_expiration_in_window', tenors: [] });
    expect(screen.getByTestId('straddle-move-no-window')).toHaveTextContent(
      NO_EXPIRATION_IN_WINDOW,
    );
  });
  it('a null/undefined read degrades to unavailable, fail-honest, never a throw', () => {
    renderWidget(null);
    expect(screen.getByTestId('straddle-move-unavailable')).toBeInTheDocument();
    cleanup();
    renderWidget(undefined);
    expect(screen.getByTestId('straddle-move-unavailable')).toBeInTheDocument();
  });
});

// Strips comments before scanning (mirrors `outcomes/boundaries.spec.ts`): the doc comment here
// deliberately QUOTES the forbidden props as prose ("takes NO offline/isLive prop") — that prose is
// the point and must not fail its own guard. The scan asserts what the CODE does.
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('static-read discipline (reviewer probe)', () => {
  it('takes no offline/isLive prop and binds no opacity to any stream state', () => {
    expect(code(straddleMoveSource)).not.toMatch(/streamOffline|isLive|opacity:/);
  });
  it('selects the tenor by `find(t => t.expiration === primary_expiration)`, never array order', () => {
    expect(straddleMoveSource).toMatch(/t\.expiration === move\.primary_expiration/);
  });
});
