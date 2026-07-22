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
 *   4. Motion NEGATIVE SPACE (redesign-stage-3 §3.3 — the REPLACEMENT for the retired stagger
 *      guard, per the §6a-2 supersession ruling: replaced in the same commit, never deleted-red):
 *      the stagger/spin machinery is structurally ABSENT from the shell while the kept live-pulse
 *      data signal stays PRESENT. The hero curve-draw guards (`pages/landing/HeroCurve.spec.tsx`,
 *      green + untouched) are the replacement's other half — they pin THE one remaining moment.
 *
 * NOT asserted here (visible + intentional → review/QA): title/subtitle/actions presence, the grip/
 * `⋮` coming-soon affordances, the live accent, exact colors. jsdom cannot layout
 * View Transitions/scroll timelines — those are asserted at the behavioral seam only.
 */
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/shared/theme/theme';
import { Widget } from '@/shared/ui/Widget';
// Source text of the shell (Vite `?raw`) — the stage-3 negative-space scan asserts on the CODE,
// so a re-introduced stagger/spin fails even if a render happens not to exercise it.
import widgetSource from '@/shared/ui/Widget/Widget?raw';
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

describe('Widget — motion negative space (stage 3: reveal retired)', () => {
  // Pure checker (mutation-guarded below): the retired motion tokens a source must NOT carry,
  // and the kept data-signal token it MUST still carry.
  const RETIRED_TOKENS = [
    'widgetRise',
    '--widget-reveal-delay',
    'revealIndex',
    'widgetAngleSpin',
    '@property --angle',
  ] as const;
  const retiredTokensIn = (src: string): string[] => RETIRED_TOKENS.filter((t) => src.includes(t));
  const keepsLivePulse = (src: string): boolean => src.includes('widgetLivePulse');

  it('MUTATION GUARD: the checkers flag a re-introduced stagger and a swept-away live pulse', () => {
    expect(retiredTokensIn(`animationName: 'widgetRise'`)).toEqual(['widgetRise']);
    expect(retiredTokensIn(`style={{ ['--widget-reveal-delay']: '55ms' }}`)).toEqual([
      '--widget-reveal-delay',
    ]);
    expect(retiredTokensIn(`animation: 'widgetAngleSpin 4s linear infinite'`)).toEqual([
      'widgetAngleSpin',
    ]);
    expect(retiredTokensIn(`'@property --angle': {}`)).toEqual(['@property --angle']);
    expect(keepsLivePulse('const clean = 1;')).toBe(false);
  });

  it('the stagger/spin machinery is ABSENT from Widget.tsx; the live-pulse data signal is PRESENT', () => {
    // Absent: the retired spectacle families (§3.1-1 stagger, §3.1-6 conic spin) cannot silently
    // return — a hit here is a red build, not a review comment.
    expect(retiredTokensIn(widgetSource)).toEqual([]);
    // Present: the KEPT data signal (§3.1-5) was not swept away with them.
    expect(keepsLivePulse(widgetSource)).toBe(true);
  });

  it('the rendered frame carries NO mount animation (widgets appear at rest)', () => {
    wrap(
      <Widget id="rest" title="At rest">
        <div>body</div>
      </Widget>,
    );
    const frame = screen.getByTestId('widget-rest');
    // No inline stagger-delay var survives on the frame.
    expect(frame.getAttribute('style') ?? '').not.toContain('--widget-reveal-delay');

    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    // The retired mount keyframe is gone from the injected CSS entirely…
    expect(css).not.toContain('widgetRise');
    expect(css).not.toContain('widgetAngleSpin');
    // …and the frame's own emotion rules attach no animation at rest (MUI sx compiles to classes —
    // assert on injected CSS, never `getAttribute('style')`).
    const compact = css.replace(/\s+/g, '');
    for (const cls of Array.from(frame.classList).filter((c) => c.startsWith('css-'))) {
      const rule = compact.split(`.${cls}{`)[1]?.split('}')[0] ?? '';
      expect(rule, `frame rule .${cls} must not carry a mount animation`).not.toContain(
        'animation-name',
      );
    }
  });
});
