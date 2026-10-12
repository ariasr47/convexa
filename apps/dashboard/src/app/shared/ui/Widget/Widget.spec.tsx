/**
 * Widget (the shared bento shell) — RISK-BASED test suite (per the amended QA rule,
 * `.claude/agents/qa-verify.md` §4, 2026-07-16 migration). We test ONLY where a silent regression
 * is plausible AND invisible:
 *
 *   Reduced motion — expand STILL opens and the VT morph is bypassed (function preserved, motion
 *   inert). The retired stagger/spin negative space is pinned repo-wide by
 *   `single-motion-moment.spec.ts`.
 *
 * NOT asserted here (visible + intentional → review/QA): title/subtitle/actions presence, the grip/
 * `⋮` coming-soon affordances, the live accent, exact colors. jsdom cannot layout
 * View Transitions/scroll timelines — those are asserted at the behavioral seam only.
 */
import { theme } from '@/shared/theme/theme';
import { Widget } from '@/shared/ui/Widget';
import { WidgetSelectionProvider } from '@/shared/ui/Widget/WidgetSelectionContext';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

function wrap(ui: React.ReactNode, withProvider = true) {
  const tree = withProvider ? <WidgetSelectionProvider>{ui}</WidgetSelectionProvider> : ui;
  return render(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
  (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
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
