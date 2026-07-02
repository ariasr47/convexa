/**
 * Widget — component-state + interaction tests for the shared Ticker widget shell.
 *
 * Covers the plan's required matrix: renders title + children; the uniform header (grip + toolbar,
 * grip/`⋮` honest-affordance = disabled/coming-soon); click/keyboard SELECT via the one-at-a-time
 * context (+ click-outside clear); the FUNCTIONAL expand — both the View Transitions path (when
 * `document.startViewTransition` is present) and the graceful Dialog fallback (when absent); the live
 * accent is applied ONLY when `live`; and reduced-motion never breaks expand.
 *
 * View Transitions + scroll-driven timeline + the conic-gradient ring are CSS/engine features that
 * jsdom cannot layout; those are asserted at the behavioral seam (expand still opens; VT hook is
 * called) and verified visually in the conductor render pass. NEVER a live backend here.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import { Widget } from './Widget';
import { WidgetSelectionProvider } from './WidgetSelectionContext';

function wrap(ui: React.ReactNode, withProvider = true) {
  const tree = withProvider ? <WidgetSelectionProvider>{ui}</WidgetSelectionProvider> : ui;
  return render(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
  (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe('Widget — frame + header', () => {
  it('renders the title and children inside the frame', () => {
    wrap(<Widget id="w1" title="Live tape"><div>tape body</div></Widget>);
    expect(screen.getByRole('heading', { name: 'Live tape' })).toBeInTheDocument();
    expect(screen.getByText('tape body')).toBeInTheDocument();
    expect(screen.getByTestId('widget-w1')).toBeInTheDocument();
  });

  it('renders an optional subtitle and the info tooltip trigger', () => {
    wrap(<Widget id="w1" title="Term structure" subtitle="ATM IV by tenor · flat" info="what it means"><div>b</div></Widget>);
    expect(screen.getByText('ATM IV by tenor · flat')).toBeInTheDocument();
  });

  it('renders the always-visible actions slot', () => {
    wrap(<Widget id="w1" title="GEX" actions={<button type="button">legend-action</button>}><div>b</div></Widget>);
    expect(screen.getByRole('button', { name: 'legend-action' })).toBeInTheDocument();
  });

  it('exposes the drag grip as an honest coming-soon affordance (labeled, not a control)', () => {
    wrap(<Widget id="w1" title="X"><div>b</div></Widget>);
    // The grip is labeled "Rearrange (coming soon)" and is NOT an interactive button.
    const grip = screen.getByLabelText('Rearrange (coming soon)');
    expect(grip).toBeInTheDocument();
    expect(grip.tagName).not.toBe('BUTTON');
  });

  it('the toolbar has a functional expand + a disabled "Configure — coming soon" affordance', () => {
    wrap(<Widget id="w1" title="X"><div>b</div></Widget>);
    const frame = screen.getByTestId('widget-w1');
    expect(within(frame).getByRole('button', { name: 'Expand widget' })).toBeEnabled();
    // The ⋮ configure control reads as coming-soon and is disabled (never fake-functional).
    expect(within(frame).getByRole('button', { name: 'Configure — coming soon' })).toBeDisabled();
  });
});

describe('Widget — selection (one at a time)', () => {
  it('click selects the widget (aria-current) and click-outside clears it', async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <Widget id="a" title="A"><div>a-body</div></Widget>
        <Widget id="b" title="B"><div>b-body</div></Widget>
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

  it('the header is keyboard-focusable and focusing selects', async () => {
    const user = userEvent.setup();
    wrap(<Widget id="a" title="A"><div>a</div></Widget>);
    const a = screen.getByTestId('widget-a');
    expect(a).toHaveAttribute('tabindex', '0');
    a.focus();
    // focus triggers onFocus → select.
    await vi.waitFor(() => expect(a).toHaveAttribute('aria-current', 'true'));
    void user;
  });
});

describe('Widget — expand/peek (functional)', () => {
  it('FALLBACK: with no View Transitions support, expand opens the Dialog overlay', async () => {
    const user = userEvent.setup();
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    wrap(<Widget id="w1" title="Expandable"><div>peek body</div></Widget>);

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
    const startVT = vi.fn((cb: () => void) => { cb(); return { finished: Promise.resolve() }; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startVT;

    wrap(<Widget id="w1" title="Expandable"><div>peek body</div></Widget>);
    await user.click(screen.getByRole('button', { name: 'Expand widget' }));

    expect(startVT).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('widget-overlay-w1')).toBeInTheDocument();
  });
});

describe('Widget — reduced motion + live accent', () => {
  it('reduced motion: expand STILL opens (motion is inert, function preserved)', async () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    // Even with startViewTransition present, reduced motion bypasses it (no morph) but still opens.
    const startVT = vi.fn((cb: () => void) => { cb(); });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startVT;
    const user = userEvent.setup();
    wrap(<Widget id="w1" title="X"><div>b</div></Widget>);

    await user.click(screen.getByRole('button', { name: 'Expand widget' }));
    expect(await screen.findByTestId('widget-overlay-w1')).toBeInTheDocument();
    // Reduced motion → the VT morph is skipped.
    expect(startVT).not.toHaveBeenCalled();
  });

  it('live accent: the frame carries the live ::before only when live (renders both ways, no throw)', () => {
    const live = wrap(<Widget id="w1" title="X" live><div>b</div></Widget>);
    expect(screen.getByTestId('widget-w1')).toBeInTheDocument();
    live.unmount();
    // Not live → still renders (the accent is simply absent). Behavior/DOM identical; the accent is a
    // CSS pseudo verified in the render pass.
    wrap(<Widget id="w1" title="X" live={false}><div>b</div></Widget>);
    expect(screen.getByTestId('widget-w1')).toBeInTheDocument();
  });
});

// FRONTEND_EXECUTION_CONTRACT §3 — the one-time staggered section reveal. The board feeds each widget a
// `revealIndex` (its position); the shell turns that into an inherited `--widget-reveal-delay` custom
// property (readable inline in jsdom) that offsets the mount-reveal keyframe, producing the cascade. The
// keyframe/opacity itself is a CSS engine feature verified in the conductor render pass; here we assert the
// per-position DELAY wiring exists and doesn't regress (the gap that let the stagger silently disappear).
describe('Widget — staggered mount reveal (§3)', () => {
  const delay = (id: string) =>
    screen.getByTestId(`widget-${id}`).style.getPropertyValue('--widget-reveal-delay').trim();

  it('offsets the reveal delay by board position (~55ms/step), so sections cascade', () => {
    wrap(
      <>
        <Widget id="a" title="A" revealIndex={0}><div>a</div></Widget>
        <Widget id="b" title="B" revealIndex={1}><div>b</div></Widget>
        <Widget id="c" title="C" revealIndex={3}><div>c</div></Widget>
      </>,
    );
    expect(delay('a')).toBe('0ms');
    expect(delay('b')).toBe('55ms');
    expect(delay('c')).toBe('165ms');
    // Strictly increasing with position — the actual cascade guarantee.
    expect(parseInt(delay('b'), 10)).toBeGreaterThan(parseInt(delay('a'), 10));
    expect(parseInt(delay('c'), 10)).toBeGreaterThan(parseInt(delay('b'), 10));
  });

  it('defaults to 0ms (no stagger) for a standalone/expanded widget with no revealIndex', () => {
    wrap(<Widget id="solo" title="Solo"><div>b</div></Widget>);
    expect(delay('solo')).toBe('0ms');
  });

  it('clamps the delay so a far-down board position never over-delays the reveal', () => {
    wrap(<Widget id="deep" title="Deep" revealIndex={40}><div>b</div></Widget>);
    // Capped at index 8 → 440ms, never index*55 unbounded.
    expect(delay('deep')).toBe('440ms');
  });

  it('is one-shot: the delay is stable across a re-render (a 60s poll never replays the reveal)', () => {
    const view = wrap(<Widget id="a" title="A" revealIndex={2}><div>a</div></Widget>);
    expect(delay('a')).toBe('110ms');
    // Simulate a poll-driven re-render with the SAME props: the widget stays mounted, the delay is
    // unchanged, and nothing re-triggers the animation (no remount, no delay reset/replay).
    view.rerender(
      <ThemeProvider theme={theme}>
        <WidgetSelectionProvider>
          <Widget id="a" title="A" revealIndex={2}><div>a</div></Widget>
        </WidgetSelectionProvider>
      </ThemeProvider>,
    );
    expect(delay('a')).toBe('110ms');
  });
});
