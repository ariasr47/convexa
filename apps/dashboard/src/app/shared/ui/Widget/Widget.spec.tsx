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
import { theme } from '@/shared/theme/theme';
import { Widget } from '@/shared/ui/Widget';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('Widget — body variants (not booleans)', () => {
  it('padding and surface are named variants; noBodyPad is not a prop', () => {
    expect(widgetSource).toMatch(/bodyPad\?: 'default' \| 'none'/);
    expect(widgetSource).toMatch(/bodyVariant\?: 'flush' \| 'inset'/);
    expect(widgetSource).not.toMatch(/noBodyPad\?:/);
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

// ==================================================================================================
// Ticker fidelity repair, change 4 (F4) — `hideHeader`, a new opt-in prop
// ("no Widget title/subtitle" — `ReadStrip.tsx`'s own doc comment). Default `false`; every existing
// test above this block (title/subtitle/actions were already explicitly OUT of this file's scope
// per its header comment) is unaffected — confirmed by the full suite staying green. This block is
// the first direct coverage of the new prop itself.
// ==================================================================================================
describe('Widget — `hideHeader` (F4): the frame with no header row, an accessible name via aria-label', () => {
  it('default (false): the title renders as a visible h2, aria-labelledby names the group', () => {
    wrap(
      <Widget id="w" title="Read strip">
        <div>body</div>
      </Widget>,
    );
    const frame = screen.getByTestId('widget-w');
    expect(screen.getByRole('heading', { level: 2, name: 'Read strip' })).toBeInTheDocument();
    expect(frame).toHaveAttribute('aria-labelledby');
    expect(frame).not.toHaveAttribute('aria-label');
  });

  it('hideHeader=true: no visible heading, no header row at all — the group is named by aria-label instead', () => {
    wrap(
      <Widget id="w" title="Read strip" hideHeader>
        <div>body</div>
      </Widget>,
    );
    const frame = screen.getByTestId('widget-w');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByText('Read strip')).toBeNull();
    expect(frame).toHaveAttribute('aria-label', 'Read strip');
    expect(frame).not.toHaveAttribute('aria-labelledby');
    expect(frame.querySelector('.widget__header')).toBeNull();
  });

  it('hideHeader=true: no expand overlay is mounted (its only trigger, the header, is also gone)', () => {
    wrap(
      <Widget id="w" title="Read strip" hideHeader>
        <div>body</div>
      </Widget>,
    );
    expect(screen.queryByTestId('widget-overlay-w')).toBeNull();
    expect(document.querySelector('.MuiDialog-root')).toBeNull();
  });

  it('hideHeader=true still renders children in a named `panel` container, unaffected', () => {
    wrap(
      <Widget id="w" title="Read strip" hideHeader>
        <div data-testid="probe">body</div>
      </Widget>,
    );
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });
});

// ==================================================================================================
// Ticker fidelity repair, PASS 2 change 7 — the hero header collapse at 390 (`S…` title, subtitle
// wrapped one word per line). Root cause: the title region (`flex: 1`, a 0% flex-basis) shrinks to
// nothing before the actions region (`flexShrink: 0`) ever wraps, so `flexWrap: { xs: 'wrap', sm:
// 'nowrap' }` never actually triggers below `sm`. Fix: the title region keeps the FULL row below
// `sm` (`flexBasis: { xs: '100%', sm: 'auto' }`), deterministically pushing `actions` to a second
// row instead of squeezing the title. `titleBadge` is the new opt-in slot (design's `widgetHead`
// `live` chip — rendered BESIDE the title, in the SAME row, not inside `actions`) so a per-widget
// live marker (`StructureHeroPanel`'s `● mid · tape` chip) keeps that adjacency even after the row
// wraps — only `actions` (the Field/Magnet toggle) drops to row two. Shared-header change: every
// other widget's header is unaffected by DEFAULT (`titleBadge` unset renders nothing extra); the
// `flexBasis` fix applies to every widget's header uniformly (verified across the desk in the
// harness, not just the hero — this file cannot lay out `@container`/media-query wrap in jsdom, so
// the pixel proof is the Playwright harness; this suite pins the SOURCE-level fix + the new prop's
// DOM presence/absence and gating).
// ==================================================================================================
describe('Widget — title region keeps the row below `sm`, `titleBadge` (PASS 2 change 7)', () => {
  it('MUTATION GUARD: the title region carries a responsive flexBasis that fills the row below `sm`', () => {
    // A 0%/auto-only flex-basis (`flex: 1` alone) is exactly the regression this pins: the title
    // would shrink to nothing beside a non-shrinking actions region instead of wrapping the row.
    expect(widgetSource).toMatch(/flexBasis:\s*{\s*xs:\s*'100%',\s*sm:\s*'auto'\s*}/);
  });

  it('default (no titleBadge): renders exactly as before — nothing extra beside the title', () => {
    wrap(
      <Widget id="w" title="Read strip">
        <div>body</div>
      </Widget>,
    );
    const header = screen.getByTestId('widget-w').querySelector('.widget__header');
    expect(header).not.toBeNull();
    // Only the title text itself, no adornment markup injected.
    expect(header?.textContent).toBe('Read strip');
  });

  it('titleBadge renders beside the title (same header row group), not inside `actions`', () => {
    wrap(
      <Widget
        id="w"
        title="Structure field"
        titleBadge={<span data-testid="probe-badge">mid · tape</span>}
        actions={<button data-testid="probe-action">Field</button>}
      >
        <div>body</div>
      </Widget>,
    );
    const header = screen.getByTestId('widget-w').querySelector('.widget__header');
    expect(header).not.toBeNull();
    const badge = screen.getByTestId('probe-badge');
    const action = screen.getByTestId('probe-action');
    expect(header).toContainElement(badge);
    expect(header).toContainElement(action);
    // The badge sits in the TITLE's own row group, a different ancestor than the actions region.
    const titleHeading = screen.getByRole('heading', { level: 2, name: 'Structure field' });
    expect(titleHeading.parentElement).toContainElement(badge);
    expect(titleHeading.parentElement).not.toContainElement(action);
  });

  it('titleBadge is absent from the DOM when not passed (no empty wrapper left behind)', () => {
    wrap(
      <Widget id="w" title="Read strip">
        <div>body</div>
      </Widget>,
    );
    expect(screen.queryByTestId('probe-badge')).toBeNull();
  });
});

// =================================================================================================
// Fidelity repair 2, N2 — `titleWrap`, an opt-in title-wrap escape hatch. `OrdersWidget`'s title
// still ellipsised in the 379px side column even after the design's shorter copy fix — measured 5px
// over in a real browser (`Sim orders · SPY` beside the SIMULATED chip + `All orders →` link). Default
// off: every OTHER widget keeps today's single-line ellipsis, unchanged.
// =================================================================================================
describe('Widget — `titleWrap` (fidelity repair 2, N2): opt-in title wrap, default off', () => {
  it('default (unset): the title keeps white-space:nowrap / text-overflow:ellipsis — every existing widget is byte-identical', () => {
    wrap(
      <Widget id="w" title="Read strip">
        <div>body</div>
      </Widget>,
    );
    const title = screen.getByRole('heading', { level: 2, name: 'Read strip' });
    const cs = getComputedStyle(title);
    expect(cs.whiteSpace).toBe('nowrap');
    expect(cs.textOverflow).toBe('ellipsis');
  });

  it('titleWrap: the title allows wrapping — no white-space:nowrap / text-overflow:ellipsis', () => {
    wrap(
      <Widget id="w" title="Sim orders · SPY" titleWrap>
        <div>body</div>
      </Widget>,
    );
    const title = screen.getByRole('heading', { level: 2, name: 'Sim orders · SPY' });
    const cs = getComputedStyle(title);
    expect(cs.whiteSpace).not.toBe('nowrap');
    expect(cs.textOverflow).not.toBe('ellipsis');
  });
});
