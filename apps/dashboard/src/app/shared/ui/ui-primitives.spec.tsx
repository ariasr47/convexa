/**
 * Foundation `ui/` primitives — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-16 migration). The ONLY invariant left here is the one
 * where a silent regression is plausible AND invisible: `no-real-order-path` STRUCTURAL inertness of
 * the coming-soon primitives — the box/card must never carry a navigating element of its own, on
 * every surface that composes them (a link sneaking into the primitive would leak onto ALL of them
 * at once, invisibly to per-page review).
 *
 * NOT asserted here (visible + intentional → review/QA; or covered at the page level): icon/title/
 * body/badge presence, dashed-border styling, Jargon gloss copy, the ConvexityMotif SVG geometry.
 */
import { theme } from '@/shared/theme/theme';
import LockIcon from '@mui/icons-material/Lock';
import Button from '@mui/material/Button';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComingSoonBox, ComingSoonCard } from './index';

afterEach(() => cleanup());

function renderUi(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

describe('coming-soon primitives — no-real-order-path structural inertness', () => {
  it('ComingSoonBox carries NO navigating element of its own', () => {
    const { container } = renderUi(
      <ComingSoonBox>
        <span>inert</span>
      </ComingSoonBox>,
    );
    const box = screen.getByTestId('coming-soon-box');
    // The box itself is not an anchor/button and adds no link.
    expect(box.tagName.toLowerCase()).not.toBe('a');
    expect(container.querySelector('[data-testid="coming-soon-box"] a')).toBeNull();
    expect(container.querySelector('[data-testid="coming-soon-box"] button')).toBeNull();
  });

  it('ComingSoonCard with no action has ZERO links/buttons of its own', () => {
    renderUi(
      <ComingSoonCard
        testId="scanner-block"
        icon={<LockIcon />}
        title="Scanner"
        body="Coming soon."
      />,
    );
    const card = screen.getByTestId('scanner-block');
    expect(card.querySelector('a')).toBeNull();
    expect(card.querySelector('button')).toBeNull();
  });

  it('only the CALLER-supplied action is interactive: a button action fires in place, never links', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderUi(
      <ComingSoonCard
        testId="parked-block"
        icon={<LockIcon />}
        title="A parked capability"
        body="x"
        action={
          <Button data-testid="parked-action" onClick={onClick}>
            Tell me more
          </Button>
        }
      />,
    );
    const btn = screen.getByTestId('parked-action');
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn).not.toHaveAttribute('href');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
