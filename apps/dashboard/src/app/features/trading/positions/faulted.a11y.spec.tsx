/**
 * V6 — THE A11Y FLOOR FOR THE FAULTED STATE (SPEC §7 invariant 7; AC-63, AC-64, AC-79).
 *
 * F16's behavioural suite proves the refusal is applied. THIS file proves the floor beneath it, and
 * one property in particular that a screenshot can never show and a diff never flags:
 *
 *   THE REASON A CONTROL IS REFUSED IS REACHABLE FROM THE KEYBOARD.
 *
 * That is the whole argument for `aria-disabled` over the HTML `disabled` attribute. A `disabled`
 * MUI button leaves the tab order and swallows pointer events, so its tooltip opens for nobody. If
 * someone "tidies" the refusal into `disabled`, every F16 test that checks `aria-disabled` could be
 * made to pass again while this property silently disappears — so it is pinned here, on its own.
 *
 * ─ ONE ENVIRONMENT NOTE, so nobody weakens these assertions to work around it. ─
 * jsdom (via nwsapi) only reports `:focus-visible` for the FIRST element tabbed to in a document;
 * every subsequent tab stop reports `false` even though the focus arrived from the keyboard. MUI's
 * Tooltip opens on focus ONLY when the child is focus-visible — correctly, that is the product
 * behaviour — so a keyboard-tooltip assertion made deep inside a mounted page tests jsdom's
 * emulation rather than our code. The keyboard property is therefore proven HERE, on the `Refused`
 * primitive, where the control is the first tab stop and the environment can express it; and the
 * integration suite proves that EVERY refused control in the real tree goes through that same
 * primitive (`faulted.spec.tsx`, "EVERY refused control goes through the ONE primitive"). Together
 * those two are strictly stronger than one flaky end-to-end assertion. Do not merge them.
 */
import { themeForPref } from '@/shared/theme/theme';
import { Box, Button, ThemeProvider } from '@mui/material';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAULTED_BANNER_ID, FaultedBanner, Refused, TickerFaultedNotice } from './FaultedBanner';
import { FX_IRON_CONDOR, viewOf } from './fixtures';
import { WRITE_REFUSED_TIP } from './labels';
import { LegDisclosureButton, LegDisclosurePanel } from './LegDisclosure';
import { PositionCard } from './PositionCard';
import type { RowContext } from './PositionRow';

function wrap(ui: React.ReactElement, scheme: 'dark' | 'light' = 'dark') {
  return render(<ThemeProvider theme={themeForPref(scheme)}>{ui}</ThemeProvider>);
}

afterEach(() => cleanup());

// =================================================================================================
// The keyboard route to the reason — the property `disabled` destroys
// =================================================================================================

describe('AC-63 · the refusal explains itself to a keyboard user', () => {
  it('TAB reaches the refused control and the reason enters the accessibility tree', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    wrap(
      <>
        <FaultedBanner onReload={() => undefined} />
        <Refused when>
          <Button onClick={onClick} data-testid="cta">
            + Open simulated position
          </Button>
        </Refused>
      </>,
    );

    // The banner's own actions come first in the DOM; tab until the CTA has focus.
    const cta = screen.getByTestId('cta');
    let guard = 0;
    while (document.activeElement !== cta && guard++ < 10) await user.tab();
    expect(document.activeElement).toBe(cta);

    // THE ASSERTION. Not "the title attribute is set" — the tooltip is in the a11y tree, reached
    // from the keyboard alone, with no pointer involved.
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent(WRITE_REFUSED_TIP);
  });

  it('…and by hover as well, so neither input modality is a dead end', async () => {
    const user = userEvent.setup();
    wrap(
      <Refused when>
        <Button data-testid="cta">Close</Button>
      </Refused>,
    );
    await user.hover(screen.getByTestId('cta'));
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent(WRITE_REFUSED_TIP));
  });

  it('the HTML `disabled` attribute is NEVER applied, and activation does nothing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    wrap(
      <Refused when>
        <Button onClick={onClick} data-testid="cta">
          Close
        </Button>
      </Refused>,
    );
    const cta = screen.getByTestId('cta');
    expect(cta).not.toHaveAttribute('disabled');
    expect(cta).not.toBeDisabled();
    expect(cta).toHaveAttribute('aria-disabled', 'true');

    await user.click(cta);
    await user.type(cta, '{Enter}');
    await user.type(cta, ' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('the banner is the `aria-describedby` TARGET, and that target actually exists', () => {
    wrap(
      <>
        <FaultedBanner onReload={() => undefined} />
        <Refused when>
          <Button data-testid="cta">Close</Button>
        </Refused>
      </>,
    );
    const described = screen.getByTestId('cta').getAttribute('aria-describedby') as string;
    expect(described).toBe(FAULTED_BANNER_ID);
    // A dangling `aria-describedby` is worse than none — it promises an explanation that is not
    // in the document.
    const target = document.getElementById(described);
    expect(target).not.toBeNull();
    expect(target?.textContent).toMatch(/couldn't read your saved data/i);
  });

  it('the Ticker-page notice carries the SAME id, so the door explains itself too', () => {
    wrap(
      <>
        <TickerFaultedNotice />
        <Refused when>
          <Button data-testid="cta">+ Open simulated trade</Button>
        </Refused>
      </>,
    );
    const target = document.getElementById(FAULTED_BANNER_ID);
    expect(target).not.toBeNull();
    expect(screen.getByTestId('cta')).toHaveAttribute('aria-describedby', FAULTED_BANNER_ID);
  });

  it('`when=false` is a pass-through: no aria, no tooltip, no wrapper, no cost', () => {
    const onClick = vi.fn();
    wrap(
      <Refused when={false}>
        <Button onClick={onClick} data-testid="cta">
          Close
        </Button>
      </Refused>,
    );
    const cta = screen.getByTestId('cta');
    expect(cta).not.toHaveAttribute('aria-disabled');
    expect(cta).not.toHaveAttribute('aria-describedby');
    expect(cta).not.toHaveAttribute('data-refused');
  });
});

// =================================================================================================
// The banner's own a11y
// =================================================================================================

describe('AC-62 · the banner announces without hijacking', () => {
  it('is `role="status"` — a standing condition, not an alert that interrupts', () => {
    wrap(<FaultedBanner onReload={() => undefined} />);
    const banner = screen.getByTestId('faulted-banner');
    expect(banner).toHaveAttribute('role', 'status');
    // NOT `alert`: this state persists for the whole session, and an assertive live region that
    // re-announces on every re-render is hostile.
    expect(banner).not.toHaveAttribute('aria-live', 'assertive');
  });

  it('both of its actions are real buttons with accessible names', () => {
    const onReload = vi.fn();
    wrap(<FaultedBanner onReload={onReload} />);
    const banner = screen.getByTestId('faulted-banner');
    for (const testid of ['faulted-export-pointer', 'faulted-reload']) {
      const el = within(banner).getByTestId(testid);
      expect(el.tagName).toBe('BUTTON');
      expect((el.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('the warning ICON is decorative — the heading beside it already carries the meaning', () => {
    wrap(<FaultedBanner onReload={() => undefined} />);
    const svg = screen.getByTestId('faulted-banner').querySelector('svg');
    expect(svg).not.toBeNull();
    // Hue alone never carries "warning", so the icon must be present — but it must not be read out
    // a second time on top of the heading it sits beside.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('offers NO repair / reset / clear path — the store never repairs and never deletes', () => {
    wrap(<FaultedBanner onReload={() => undefined} />);
    const banner = screen.getByTestId('faulted-banner');
    expect(
      within(banner).queryByRole('button', { name: /repair|reset|clear|delete|start over|fix/i }),
    ).toBeNull();
  });
});

// =================================================================================================
// The read side keeps its floor while faulted — a fault refuses WRITES, not reading
// =================================================================================================

function condorCtx(faulted: boolean): RowContext {
  return {
    view: viewOf(FX_IRON_CONDOR),
    faulted,
    trend: [],
    sessionDelta: null,
    streamOffline: false,
    onClose: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('AC-79 · the disclosure floor survives the faulted state', () => {
  it('the leg disclosure keeps aria-expanded / aria-controls correct while faulted', async () => {
    const user = userEvent.setup();
    const view = viewOf(FX_IRON_CONDOR);
    wrap(
      <PositionCard
        view={view}
        ctx={condorCtx(true)}
        streamOffline={false}
        onClose={() => undefined}
      />,
    );
    const toggle = screen.getByTestId('leg-disclosure-toggle');
    // A READ is never refused.
    expect(toggle).not.toHaveAttribute('aria-disabled');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controls = toggle.getAttribute('aria-controls') as string;
    expect(controls).toBeTruthy();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // `aria-controls` must point at the panel that actually appeared.
    expect(document.getElementById(controls)).not.toBeNull();
    expect(screen.getAllByTestId('leg-line')).toHaveLength(4);
  });

  it('leg text holds the 11px floor and leg side is a WORD, never a coloured glyph', () => {
    const view = viewOf(FX_IRON_CONDOR);
    wrap(
      <>
        <LegDisclosureButton
          expanded
          onToggle={() => undefined}
          panelId="p"
          legCount={view.legs.length}
          variant="card"
        />
        <LegDisclosurePanel view={view} id="p" expanded />
      </>,
    );
    // jsdom does not resolve `rem` against the root, so the unit is converted rather than parsed.
    const toPx = (v: string) =>
      v.endsWith('rem') || v.endsWith('em') ? parseFloat(v) * 16 : parseFloat(v);
    const lines = screen.getAllByTestId('leg-line');
    expect(lines.length).toBeGreaterThan(0); // vacuity guard
    for (const line of lines) {
      expect(toPx(getComputedStyle(line).fontSize || '16px')).toBeGreaterThanOrEqual(11);
      // Side renders as the word, so a screen reader says "Long"/"Short" rather than a symbol.
      expect(line.textContent).toMatch(/Long|Short/);
      expect(line.textContent).not.toMatch(/[+−]\s*1\s*×/);
    }
  });

  it('the mobile disclosure hit target is at least 44px', () => {
    const view = viewOf(FX_IRON_CONDOR);
    wrap(
      <PositionCard
        view={view}
        ctx={condorCtx(true)}
        streamOffline={false}
        onClose={() => undefined}
      />,
    );
    const toggle = screen.getByTestId('leg-disclosure-toggle');
    const minH = getComputedStyle(toggle).minHeight;
    expect(parseFloat(minH || '0')).toBeGreaterThanOrEqual(44);
  });

  it('STAT VALUES ARE NEVER HEADINGS — not on the card, not while faulted', () => {
    const view = viewOf(FX_IRON_CONDOR);
    wrap(
      <PositionCard
        view={view}
        ctx={condorCtx(true)}
        streamOffline={false}
        onClose={() => undefined}
      />,
    );
    // The documented failure this guards is the 29-`<h6>` ticker page: a figure styled large is not
    // a document section, and a screen-reader heading list full of numbers is unnavigable.
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });
});

// =================================================================================================
// Both colour schemes — the refusal must be legible in either
// =================================================================================================

describe('dark/light parity of the refused treatment', () => {
  for (const scheme of ['dark', 'light'] as const) {
    it(`${scheme}: the banner renders with an icon and both actions, and adds no hardcoded hex`, () => {
      const { container } = wrap(<FaultedBanner onReload={() => undefined} />, scheme);
      expect(screen.getByTestId('faulted-banner')).toBeInTheDocument();
      expect(screen.getByTestId('faulted-export-pointer')).toBeInTheDocument();
      expect(screen.getByTestId('faulted-reload')).toBeInTheDocument();
      // Every colour resolves through the theme; a literal hex in the markup would mean a value was
      // improvised rather than taken from the token plan.
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  }
});

// =================================================================================================
// AC-63 — THE VISUAL HALF. A refused control must LOOK refused.
//
// This block exists because its absence shipped. The lane built the aria/keyboard half correctly,
// the whole behavioural suite went green, and the CTA still rendered as a fully bright, fully opaque
// amber button while the fault banner sat above it — indistinguishable from enabled. A control that
// looks live and then refuses is the *"accepts input and fails after the fact"* failure §2.9 exists
// to prevent, arriving one layer up, and no assertion anywhere could see it.
//
// So: the refusal must be assertable as a STYLE difference, in BOTH colour schemes, and the
// assertions must be able to go red. `getAttribute('style')` is always empty — `sx` compiles to
// emotion CLASSES — and the theme is CSS-variable-backed, so `action.disabled` serialises as
// `var(--mui-palette-action-disabled)` rather than a colour literal. Both forms are checked, so this
// keeps working if the variable layer is ever turned off.
// =================================================================================================

/**
 * Every injected CSS declaration that ACTUALLY APPLIES to an element's emotion classes, including
 * the `:hover` rule — emotion emits that as a separate selector on the same class, so a naive "up
 * to the first `}`" read would miss exactly the hover-shift half of the requirement.
 *
 * Only the bare class and its pseudo-classes count. A compound rule like `.css-x.Mui-disabled{…}`
 * is in the sheet but applies to nobody here, and counting it would let a control "prove" a
 * property (or fail one) it does not actually render.
 */
function injectedCss(el: Element, scope: 'base' | 'hover' | 'all' = 'all'): string {
  const sheet = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '');
  let out = '';
  for (const c of Array.from(el.classList).filter((c) => c.startsWith('css-'))) {
    const selector =
      scope === 'base'
        ? `\\.${c}`
        : scope === 'hover'
          ? `\\.${c}:hover`
          : `\\.${c}(?::[\\w-]+(?:\\([^()]*\\))?)*`;
    for (const m of sheet.matchAll(new RegExp(`${selector}\\{([^{}]*)\\}`, 'g'))) {
      out += `${m[1]};`;
    }
  }
  return out.toLowerCase();
}

/**
 * The value that actually WINS for one property in a class body. Emotion concatenates the
 * component's own styles and the `sx` layer into ONE class, so an overridden declaration is still
 * present in the text — "the amber is gone" is a CASCADE claim (last declaration wins), not a
 * text-absence claim, and asserting it as absence would assert something false.
 *
 * One level of custom-property indirection is resolved: MUI v7 paints a Button's variant colour as
 * `background-color: var(--variant-containedBg)` and defines that property in the same class body,
 * so a check that stopped at the pointer would be checking the pointer, not the colour.
 */
function effective(css: string, prop: string): string {
  const read = (p: string) => {
    const hits = Array.from(css.matchAll(new RegExp(`(?:^|;)${p}:([^;]*)`, 'g')));
    return hits.length ? hits[hits.length - 1][1] : '';
  };
  const value = read(prop);
  const pointer = value.match(/^var\((--variant-[\w-]+)\)$/);
  return pointer ? read(pointer[1]) || value : value;
}

/** Does a resolved value bind the theme's disabled ink/fill — in EITHER serialised form? */
function bindsDisabled(value: string, scheme: 'dark' | 'light'): boolean {
  const a = themeForPref(scheme).palette.action;
  return [
    '--mui-palette-action-disabled',
    a.disabled.toLowerCase().replace(/\s+/g, ''),
    a.disabledBackground.toLowerCase().replace(/\s+/g, ''),
  ].some((t) => value.includes(t));
}

/** The brand amber the enabled CTA wears — the thing that must NOT survive the refusal. */
function bindsPrimary(value: string, scheme: 'dark' | 'light'): boolean {
  return ['--mui-palette-primary-main', themeForPref(scheme).palette.primary.main.toLowerCase()].some(
    (t) => value.includes(t),
  );
}

describe('AC-63 · a refused control is VISIBLY refused, in both colour schemes', () => {
  for (const scheme of ['dark', 'light'] as const) {
    it(`${scheme}: the refused CTA wears the theme's disabled tokens and the enabled one does not`, () => {
      // The same control, twice, under one theme — the ONLY difference is the refusal.
      wrap(
        <>
          <Refused when={false}>
            <Button variant="contained" data-testid="enabled">
              + Open simulated trade
            </Button>
          </Refused>
          <Refused when>
            <Button variant="contained" data-testid="refused">
              + Open simulated trade
            </Button>
          </Refused>
        </>,
        scheme,
      );
      const enabled = screen.getByTestId('enabled');
      const refused = screen.getByTestId('refused');

      // VACUITY GUARD. If the sheet were empty or the classes unfound, every assertion below is
      // trivially satisfiable and the test would "pass" by finding nothing at all. So first prove
      // the ENABLED control resolves to the brand amber on a real fill.
      const enabledCss = injectedCss(enabled, 'base');
      const refusedCss = injectedCss(refused, 'base');
      expect(enabledCss.length).toBeGreaterThan(0);
      expect(refusedCss.length).toBeGreaterThan(0);
      expect(bindsPrimary(effective(enabledCss, 'background-color'), scheme)).toBe(true);
      expect(bindsDisabled(effective(enabledCss, 'background-color'), scheme)).toBe(false);
      expect(bindsDisabled(effective(enabledCss, 'color'), scheme)).toBe(false);

      // THE ASSERTION. Delete the treatment and both halves of this go red: the refused control
      // wears a different class, and what that class RESOLVES to is the theme's own disabled
      // ink and fill — not the amber, in either scheme.
      expect(refused.className).not.toBe(enabled.className);
      for (const prop of ['background-color', 'color'] as const) {
        const won = effective(refusedCss, prop);
        expect(won, `${scheme}: refused ${prop} must resolve to a disabled token`).not.toBe('');
        expect(bindsDisabled(won, scheme), `${scheme}: refused ${prop} = ${won}`).toBe(true);
        expect(bindsPrimary(won, scheme), `${scheme}: refused ${prop} is still amber`).toBe(false);
      }
    });

    it(`${scheme}: hover shifts neither colour nor elevation on a refused control`, async () => {
      const user = userEvent.setup();
      wrap(
        <Refused when>
          <Button variant="contained" data-testid="refused">
            Close
          </Button>
        </Refused>,
        scheme,
      );
      const refused = screen.getByTestId('refused');
      const cls = refused.className;
      // No elevation at rest: a raised, shadowed control reads as live even when its ink is quiet.
      expect(effective(injectedCss(refused, 'base'), 'box-shadow')).toBe('none');

      // The `:hover` rule is a real, separate selector on the same emotion class, so it is read on
      // its own rather than inferred from the absence of one. MUI ships its own hover rule for this
      // button, so this is NOT vacuous by construction — remove the treatment and the winning
      // declarations become `--variant-containedBg: primary.dark` + a shadow, and this goes red.
      const hoverCss = injectedCss(refused, 'hover');
      expect(hoverCss.length).toBeGreaterThan(0); // vacuity guard: there IS a hover rule
      expect(bindsDisabled(effective(hoverCss, 'background-color'), scheme)).toBe(true);
      expect(bindsDisabled(effective(hoverCss, 'color'), scheme)).toBe(true);
      expect(effective(hoverCss, 'box-shadow')).toBe('none');

      await user.hover(refused);
      // …and hovering does not swap the class out for a live-looking one.
      expect(refused.className).toBe(cls);
    });
  }

  it('a REFUSED control is still a first-class tab stop — the treatment is additive, never `disabled`', async () => {
    const user = userEvent.setup();
    wrap(
      <Refused when>
        <Button variant="contained" data-testid="refused">
          + Open simulated trade
        </Button>
      </Refused>,
    );
    const refused = screen.getByTestId('refused');
    // The three ways a dimming treatment could recreate the exact defect the HTML `disabled`
    // attribute was banned for. Each is a regression, not a refinement (SPEC §4).
    expect(refused).not.toBeDisabled();
    expect(refused).not.toHaveAttribute('disabled');
    expect(injectedCss(refused)).not.toContain('pointer-events:none');
    expect(refused.getAttribute('tabindex')).not.toBe('-1');
    await user.tab();
    expect(document.activeElement).toBe(refused);
  });

  it('the treatment MERGES with the control’s own sx — it never discards it', () => {
    wrap(
      <Refused when>
        <Box component="button" data-testid="refused" sx={{ borderRadius: '6px', px: '9px' }}>
          Close
        </Box>
      </Refused>,
    );
    const css = injectedCss(screen.getByTestId('refused'), 'base');
    // The site's own geometry survives…
    expect(css).toContain('border-radius:6px');
    expect(css).toContain('padding-left:9px');
    // …and the refusal is layered on top of it.
    expect(bindsDisabled(effective(css, 'color'), 'dark')).toBe(true);
  });

  it('`when={false}` adds NO style at all — a healthy surface is byte-identical to shipped', () => {
    wrap(
      <>
        <Button variant="contained" data-testid="bare">
          Close
        </Button>
        <Refused when={false}>
          <Button variant="contained" data-testid="passthrough">
            Close
          </Button>
        </Refused>
      </>,
    );
    expect(screen.getByTestId('passthrough').className).toBe(
      screen.getByTestId('bare').className,
    );
  });
});

// =================================================================================================
// The export pointer moves FOCUS — it does not duplicate the export button
// =================================================================================================

describe('AC-68 · the export pointer is a pointer', () => {
  it('moves focus to the Archive block instead of duplicating or renaming its action', async () => {
    const user = userEvent.setup();
    wrap(
      <>
        <FaultedBanner onReload={() => undefined} />
        <Box data-testid="tr-archive">
          <Button>Export archive</Button>
        </Box>
      </>,
    );
    const banner = screen.getByTestId('faulted-banner');
    // The banner carries NO second export button of its own.
    expect(within(banner).queryByRole('button', { name: 'Export archive' })).toBeNull();

    await user.click(within(banner).getByTestId('faulted-export-pointer'));
    expect(document.activeElement).toBe(screen.getByTestId('tr-archive'));
  });
});
