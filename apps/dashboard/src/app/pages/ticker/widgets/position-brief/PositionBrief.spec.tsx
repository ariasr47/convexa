/**
 * PositionBrief — product spine #5. Risk-based: empty vs single vs multi vs faulted,
 * sim-only language, mark basis present with P/L, multi never picks one of N.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  FX_CALL_DEBIT_SPREAD,
  FX_LONG_CALL,
  mkPosition,
  mkLeg,
  viewOf,
} from '@/features/trading/positions/fixtures';
import { PositionBrief } from './PositionBrief';
import { BRIEF_COPY } from './copy';

function renderBrief(
  props: Partial<React.ComponentProps<typeof PositionBrief>> & {
    openViews?: React.ComponentProps<typeof PositionBrief>['openViews'];
  } = {},
) {
  const { openViews = [], ...rest } = props;
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <PositionBrief ticker="TSLA" openViews={openViews} {...rest} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('PositionBrief (product spine #5)', () => {
  it('empty state names the symbol, offers sim CTA, and links to the book — no real-order language', () => {
    const onOpenTrade = vi.fn();
    renderBrief({ onOpenTrade });
    expect(screen.getByTestId('position-brief')).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('position-brief-empty')).toHaveTextContent(
      BRIEF_COPY.empty('TSLA'),
    );
    expect(screen.getByTestId('position-brief-open-trade')).toHaveTextContent(
      BRIEF_COPY.emptyCta,
    );
    expect(screen.getByTestId('position-brief-open-book')).toHaveAttribute('href', '/positions');
    expect(screen.getByTestId('position-brief').textContent).toMatch(/simulated/i);
    expect(screen.getByTestId('position-brief').textContent).not.toMatch(
      /broker|place order|send to market/i,
    );
  });

  it('empty CTA calls onOpenTrade; entryBlocked hides the CTA', async () => {
    const user = userEvent.setup();
    const onOpenTrade = vi.fn();
    const { unmount } = renderBrief({ onOpenTrade });
    await user.click(screen.getByTestId('position-brief-open-trade'));
    expect(onOpenTrade).toHaveBeenCalledTimes(1);
    unmount();
    renderBrief({ onOpenTrade, entryBlocked: true });
    expect(screen.queryByTestId('position-brief-open-trade')).toBeNull();
  });

  it('single open position shows structure, P/L direction, and mark basis (never bare numbers)', () => {
    const view = viewOf(FX_LONG_CALL, { mark: { mark: 14, basis: 'snapshot', frozen: false } });
    renderBrief({ openViews: [view] });
    expect(screen.getByTestId('position-brief')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('position-brief-single')).toBeInTheDocument();
    expect(screen.getByTestId('position-brief-structure').textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId('position-brief-pl').textContent).toMatch(/[+$−-]/);
    expect(screen.getByTestId('position-brief-basis')).toHaveAttribute('data-basis', 'snapshot');
    expect(screen.getByTestId('position-brief-basis')).toHaveTextContent(/snapshot/i);
    expect(screen.getByTestId('position-brief-sim')).toHaveTextContent(/simulated/i);
  });

  it('last_known basis is labelled and dimmed — never framed as live', () => {
    const view = viewOf(FX_LONG_CALL, {
      mark: { mark: 11, basis: 'last_known', frozen: false },
    });
    renderBrief({ openViews: [view] });
    const basis = screen.getByTestId('position-brief-basis');
    expect(basis).toHaveAttribute('data-basis', 'last_known');
    expect(basis.textContent).toMatch(/last known/i);
    expect(basis.textContent).toMatch(/⏸/);
  });

  it('multi open never picks one of N — count only + open book', () => {
    const a = viewOf(FX_LONG_CALL);
    const b = viewOf(
      mkPosition([mkLeg({ strike: 410, right: 'call' })], { id: 'other-pos' }),
    );
    renderBrief({ openViews: [a, b] });
    expect(screen.getByTestId('position-brief')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('position-brief-multi')).toHaveTextContent(
      BRIEF_COPY.multi(2, 'TSLA'),
    );
    expect(screen.queryByTestId('position-brief-single')).toBeNull();
    expect(screen.queryByTestId('position-brief-pl')).toBeNull();
    expect(screen.getByTestId('position-brief-open-book')).toHaveAttribute('href', '/positions');
  });

  it('store faulted refuses empty/full claims', () => {
    renderBrief({
      storeFaulted: true,
      openViews: [viewOf(FX_CALL_DEBIT_SPREAD)],
    });
    expect(screen.getByTestId('position-brief')).toHaveAttribute('data-faulted', 'true');
    expect(screen.getByTestId('position-brief-faulted')).toHaveTextContent(BRIEF_COPY.faulted);
    expect(screen.queryByTestId('position-brief-single')).toBeNull();
    expect(screen.queryByTestId('position-brief-empty')).toBeNull();
  });

  it('unavailable mark shows honest P/L unavailable — never a fabricated 0', () => {
    const view = viewOf(FX_LONG_CALL, { mark: null });
    renderBrief({ openViews: [view] });
    expect(screen.getByTestId('position-brief-pl')).toHaveTextContent(
      BRIEF_COPY.plUnavailable,
    );
    expect(screen.getByTestId('position-brief-pl').textContent).not.toMatch(/\b0\b/);
  });
});
