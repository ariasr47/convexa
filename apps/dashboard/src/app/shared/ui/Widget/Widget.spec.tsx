/**
 * Widget (the shared bento shell) — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-16 migration). The `orders`/`ai-rec` widgets depend on
 * this behavior contract; we test ONLY where a silent regression is plausible AND invisible:
 *
 *   1. Selection — the one-at-a-time context: click/focus selects, selecting another deselects,
 *      click-outside clears. (A broken provider still renders fine — invisible in per-widget tests.)
 *   2. Expand/peek — BOTH paths of the state machine: the Dialog fallback when
 *      `document.startViewTransition` is absent, and the View-Transitions path when present.
 *   3. Reduced motion — expand STILL opens and the VT morph is bypassed (function preserved,
 *      motion inert).
 *   4. Stagger wiring — the inherited `--widget-reveal-delay` increases with board position and is
 *      STABLE across a same-props re-render (a 60s poll must never replay the reveal). The keyframe
 *      itself is a CSS engine feature verified visually.
 *
 * NOT asserted here (visible + intentional → review/QA): title/subtitle/actions presence, the grip/
 * `⋮` coming-soon affordances, the live accent, exact per-step delay values. jsdom cannot layout
 * View Transitions/scroll timelines — those are asserted at the behavioral seam only.
 */
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/shared/theme/theme';
import { Widget } from '@/shared/ui/Widget';
import { WidgetSelectionProvider } from '@/shared/ui/Widget/WidgetSelectionContext';

function wrap(ui: React.ReactNode, withProvider = true) {
  const tree = withProvider ? <WidgetSelectionProvider>{ui}</WidgetSelectionProvider> : ui;
  return render(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
  (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe('Widget — selection (one at a time)', () => {
  it('click selects (aria-current), selecting another deselects, click-outside clears', async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Widget id="a" title="A">
          <div>a-body</div>
        </Widget>
        <Widget id="b" title="B">
          <div>b-body</div>
        </Widget>
        <button type="button">outside</button>
      </>,
    );
    const a = screen.getByTestId('widget-a');
    const b = screen.getByTestId('widget-b');
    expect(a).not.toHaveAttribute('aria-current');

    await user.click(a);
    expect(a).toHaveAttribute('aria-current', 'true');

    // Selecting B deselects A (one-at-a-time).
    await user.click(b);
    expect(b).toHaveAttribute('aria-current', 'true');
    expect(a).not.toHaveAttribute('aria-current');

    // Click outside clears the selection.
    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(b).not.toHaveAttribute('aria-current');
  });

  it('the frame is keyboard-focusable and focusing selects', async () => {
    wrap(
      <Widget id="a" title="A">
        <div>a</div>
      </Widget>,
    );
    const a = screen.getByTestId('widget-a');
    expect(a).toHaveAttribute('tabindex', '0');
    a.focus();
    // focus triggers onFocus → select.
    await vi.waitFor(() => expect(a).toHaveAttribute('aria-current', 'true'));
  });
});

describe('Widget — expand/peek state machine (both paths)', () => {
  it('FALLBACK: with no View Transitions support, expand opens the Dialog overlay and close returns', async () => {
    const user = userEvent.setup();
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    wrap(
      <Widget id="w1" title="Expandable">
        <div>peek body</div>
      </Widget>,
    );

    expect(screen.queryByTestId('widget-overlay-w1')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Expand widget' }));
    // The overlay renders the widget again (its header + body) in a focus dialog.
    expect(await screen.findByTestId('widget-overlay-w1')).toBeInTheDocument();
    // Close returns to the inline card.
    await user.click(screen.getByRole('button', { name: 'Close expanded widget' }));
    await vi.waitFor(() => expect(screen.queryByTestId('widget-overlay-w1')).toBeNull());
  });

  it('VIEW-TRANSITIONS path: startViewTransition drives the open when supported', async () => {
    const user = userEvent.setup();
    const startVT = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startVT;

    wrap(
      <Widget id="w1" title="Expandable">
        <div>peek body</div>
      </Widget>,
    );
    await user.click(screen.getByRole('button', { name: 'Expand widget' }));

    expect(startVT).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('widget-overlay-w1')).toBeInTheDocument();
  });
});

describe('Widget — reduced motion', () => {
  it('expand STILL opens; the VT morph is bypassed (motion inert, function preserved)', async () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    // Even with startViewTransition present, reduced motion bypasses it (no morph) but still opens.
    const startVT = vi.fn((cb: () => void) => {
      cb();
    });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startVT;
    const user = userEvent.setup();
    wrap(
      <Widget id="w1" title="X">
        <div>b</div>
      </Widget>,
    );

    await user.click(screen.getByRole('button', { name: 'Expand widget' }));
    expect(await screen.findByTestId('widget-overlay-w1')).toBeInTheDocument();
    // Reduced motion → the VT morph is skipped.
    expect(startVT).not.toHaveBeenCalled();
  });
});

describe('Widget — staggered mount reveal wiring', () => {
  const delay = (id: string) =>
    screen.getByTestId(`widget-${id}`).style.getPropertyValue('--widget-reveal-delay').trim();

  it('the reveal delay increases with board position and is one-shot (stable across re-render)', () => {
    const view = wrap(
      <>
        <Widget id="a" title="A" revealIndex={0}>
          <div>a</div>
        </Widget>
        <Widget id="b" title="B" revealIndex={1}>
          <div>b</div>
        </Widget>
        <Widget id="c" title="C" revealIndex={3}>
          <div>c</div>
        </Widget>
      </>,
    );
    // Strictly increasing with position — the actual cascade guarantee (exact ms are impl detail).
    expect(parseInt(delay('b'), 10)).toBeGreaterThan(parseInt(delay('a'), 10));
    expect(parseInt(delay('c'), 10)).toBeGreaterThan(parseInt(delay('b'), 10));

    // One-shot: a poll-driven re-render with the SAME props keeps the delay unchanged — nothing
    // re-triggers the animation (no remount, no delay reset/replay).
    const before = delay('b');
    view.rerender(
      <ThemeProvider theme={theme}>
        <WidgetSelectionProvider>
          <Widget id="a" title="A" revealIndex={0}>
            <div>a</div>
          </Widget>
          <Widget id="b" title="B" revealIndex={1}>
            <div>b</div>
          </Widget>
          <Widget id="c" title="C" revealIndex={3}>
            <div>c</div>
          </Widget>
        </WidgetSelectionProvider>
      </ThemeProvider>,
    );
    expect(delay('b')).toBe(before);
  });
});
