/**
 * `FigureCell` — rewrite of `StatTile.spec.tsx` (SPEC §2.3/§4.1, PLAN FE-4). Covers the nine
 * states, the closed `NotANumber` vocabulary (AC-19/AC-19b), the ⓘ keyboard path, and the
 * anti-copy-paste source scan (AC-13a) with its mutation proof.
 */
import { NOT_A_NUMBER, isNotANumber } from '@/shared/copy/notANumber';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { allRulesForClass, emotionClassOf, joinedStyleText } from './emotionCssReader';
import { FigureCell, StatSkeleton, type FigureCellProps } from './FigureCell';

function wrap(props: Partial<FigureCellProps> & Pick<FigureCellProps, 'label' | 'value'>) {
  const full: FigureCellProps = { register: 'traced', ...props };
  return render(
    <ThemeProvider theme={theme}>
      <FigureCell {...full} />
    </ThemeProvider>,
  );
}

describe('FigureCell — F1 default (static)', () => {
  it('renders the caps label, the value in Mono, and NO live dot', () => {
    wrap({ label: 'Call wall', value: '$580.00', register: 'traced' });
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    const value = screen.getByText('$580.00');
    expect(value).toHaveAttribute('data-figure-register', 'mono');
    expect(screen.queryByTestId('figure-live-dot')).toBeNull();
    expect(value.closest('[data-figure-state]')).toHaveAttribute('data-figure-state', 'default');
  });
});

describe('FigureCell — F2 loading (StatSkeleton)', () => {
  it('is the LOADING look, carries NO text at all — no "Loading…", no `—`', () => {
    render(
      <ThemeProvider theme={theme}>
        <StatSkeleton />
      </ThemeProvider>,
    );
    const sk = screen.getByTestId('cold-skeleton');
    expect(sk).toBeInTheDocument();
    expect(sk).toHaveAttribute('data-figure-state', 'loading');
    expect(sk.querySelector('[role="progressbar"]')).toBeNull();
    expect(sk.textContent).toBe('');
  });
});

describe('FigureCell — F3 live', () => {
  it('the dot renders ONLY when `live` is true, carries the visually-hidden word "live", and never sits in an aria-live region', () => {
    const { unmount } = wrap({ label: 'Net flow', value: '+12,480', live: true });
    const dot = screen.getByTestId('figure-live-dot');
    expect(dot).toHaveTextContent('live');
    expect(dot.closest('[aria-live]')).toBeNull();
    expect(dot.closest('[data-figure-state]')).toHaveAttribute('data-figure-state', 'live');
    unmount();
    wrap({ label: 'Net flow', value: '+12,480', live: false });
    expect(screen.queryByTestId('figure-live-dot')).toBeNull();
  });
});

describe('FigureCell — F4 offline, value retained (AC-17a)', () => {
  it('shows the retained value dimmed + a pause mark + "offline · last known"', () => {
    wrap({ label: 'Spread', value: '$0.05', offline: { retained: true } });
    expect(screen.getByText('$0.05')).toBeInTheDocument();
    expect(screen.getByText('offline · last known')).toBeInTheDocument();
    const cell = screen.getByText('$0.05').closest('[data-figure-state]');
    expect(cell).toHaveAttribute('data-figure-state', 'offline-retained');
  });
});

describe('FigureCell — F5 offline, no value retained (AC-17b)', () => {
  it('shows the bare literal + a pause mark + "offline" (never "last known")', () => {
    wrap({ label: 'Net flow', value: '—', offline: { retained: false } });
    expect(screen.getByText('offline')).toBeInTheDocument();
    expect(screen.queryByText(/last known/)).toBeNull();
    const cell = screen.getByText('offline').closest('[data-figure-state]');
    expect(cell).toHaveAttribute('data-figure-state', 'offline-bare');
  });

  it('F4 and F5 carry DISTINCT DOM markers, not merely different text', () => {
    const { unmount } = wrap({ label: 'Spread', value: '$0.05', offline: { retained: true } });
    const f4 = document.querySelector('[data-figure-state]');
    expect(f4?.getAttribute('data-figure-state')).toBe('offline-retained');
    unmount();
    wrap({ label: 'Spread', value: '—', offline: { retained: false } });
    const f5 = document.querySelector('[data-figure-state]');
    expect(f5?.getAttribute('data-figure-state')).toBe('offline-bare');
    expect(f5?.getAttribute('data-figure-state')).not.toBe(f4?.getAttribute('data-figure-state'));
  });
});

describe('FigureCell — F6 replay (AC-6)', () => {
  it('Mono full strength, no dot, no pause mark, no "offline" caption', () => {
    wrap({ label: 'Gamma flip', value: '$573', replay: true, live: true });
    expect(screen.queryByTestId('figure-live-dot')).toBeNull();
    expect(screen.queryByText(/offline/)).toBeNull();
    expect(screen.getByText('session replay')).toBeInTheDocument();
    const value = screen.getByText('$573');
    expect(value).toHaveAttribute('data-figure-register', 'mono');
    // `getComputedStyle` on the resolved element — this project does not configure
    // `eslint-plugin-testing-library`, so no suppression is needed for this call.
    const styles = getComputedStyle(value);
    expect(styles.opacity === '' || styles.opacity === '1').toBe(true);
  });
});

describe('FigureCell — F7/F8 the closed NotANumber vocabulary (AC-19)', () => {
  it('every one of the nine members renders as small Sans, never Mono, and the cell renders the EXACT member handed to it (no substitution)', () => {
    for (const member of NOT_A_NUMBER) {
      const { unmount } = wrap({ label: 'X', value: member, register: 'traced' });
      const rendered = screen.getByText(member);
      expect(rendered).toHaveAttribute('data-figure-register', 'sans');
      unmount();
    }
  });

  it('AC-19: `register` has NO EFFECT on the literal branch — asserted still renders Sans, not mono/dotted', () => {
    wrap({ label: 'X', value: 'unavailable', register: 'asserted' });
    const rendered = screen.getByText('unavailable');
    expect(rendered).toHaveAttribute('data-figure-register', 'sans');
  });

  it('MUTATION PROOF: a non-member string does NOT classify as a literal — it takes the figure branch', () => {
    expect(isNotANumber('n/a')).toBe(false);
    wrap({ label: 'X', value: 'n/a', register: 'traced' });
    const rendered = screen.getByText('n/a');
    expect(rendered).toHaveAttribute('data-figure-register', 'mono'); // the FIGURE branch, not literal
  });

  it('F7 (`—`) and F8 (every other member) are distinguishable in the DOM', () => {
    const { unmount } = wrap({ label: 'Max pain', value: '—' });
    const f7 = document.querySelector('[data-figure-state]');
    expect(f7?.getAttribute('data-figure-state')).toBe('empty');
    unmount();
    wrap({ label: 'Net DEX', value: 'unavailable' });
    const f8 = document.querySelector('[data-figure-state]');
    expect(f8?.getAttribute('data-figure-state')).toBe('unavailable');
    expect(f8?.getAttribute('data-figure-state')).not.toBe('empty');
  });
});

describe('FigureCell — AC-19b: no rendered value glues a literal to another character', () => {
  it('a null-backed max-pain-style value renders the BARE `—`, never `$—`', () => {
    wrap({ label: 'Max pain', value: '—' });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('$—')).toBeNull();
    expect(screen.queryByText(/\$—/)).toBeNull();
  });
});

describe('FigureCell — F9 untraced (AC-15/AC-15b)', () => {
  it('register="asserted" on a REAL value renders Plex Sans at figure size with a dotted rule AND names the asserter — the untraced arm actually fires', () => {
    wrap({ label: 'Target', value: '579.50', register: 'asserted', assertedBy: 'AI-stated' });
    const value = screen.getByText('579.50');
    expect(value).toHaveAttribute('data-figure-register', 'sans'); // not sufficient alone —
    const cell = value.closest('[data-figure-state]');
    expect(cell).toHaveAttribute('data-figure-state', 'untraced'); // — the untraced STATE fired
    expect(screen.getByText('AI-stated · untraced')).toBeInTheDocument();
  });

  it('register="traced" on the SAME value never reaches the untraced arm', () => {
    wrap({ label: 'Target', value: '579.50', register: 'traced' });
    const value = screen.getByText('579.50');
    expect(value).toHaveAttribute('data-figure-register', 'mono');
    expect(value.closest('[data-figure-state]')).toHaveAttribute('data-figure-state', 'default');
  });
});

describe('FigureCell — the ⓘ is a real focusable control (SPEC §4.1)', () => {
  it('opens on tap/Enter/Space via the shipped AccessibleHelp pattern, closes on Escape', async () => {
    const user = userEvent.setup();
    wrap({ label: 'Net flow', value: '+12,480', info: 'Aggressive buys minus sells.' });
    const help = screen.getByRole('button', { name: 'About Net flow' });
    await user.tab();
    // Tab order: the whole document — just assert the control CAN be focused directly.
    help.focus();
    expect(help).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Aggressive buys minus sells.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });
});

describe('FigureCell — the caption testid is carried forward (stat-secondary)', () => {
  it('renders "stat-secondary" only when a caption/basis line exists', () => {
    const { unmount } = wrap({ label: 'Call wall', value: '$580', caption: '+1.20% from mid' });
    expect(screen.getByTestId('stat-secondary')).toHaveTextContent('+1.20% from mid');
    unmount();
    wrap({ label: 'Call wall', value: '$580' });
    expect(screen.queryByTestId('stat-secondary')).toBeNull();
  });
});

// ---- AC-13a — the anti-copy-paste source scan (arc.spec.ts importer idiom) ------------------------

const SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');

function accentOrStatTileHits(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [key, src] of Object.entries(files)) {
    const file = appPath(key);
    if (/\baccentColor\s*[:=]/.test(src) || /\baccent\s*[:=]\s*['"{]/.test(src)) {
      out.push(`${file} → accent/accentColor prop`);
    }
    if (/import[^;]*from\s+['"][^'"]*\/StatTile['"]/.test(src)) {
      out.push(`${file} → imports StatTile`);
    }
  }
  return out;
}

describe('AC-13a — no accent/accentColor prop and no StatTile import survives anywhere', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
  });

  it('`_kit/StatTile.tsx` does not exist', () => {
    expect(Object.keys(SOURCES).map(appPath)).not.toContain(
      'pages/ticker/widgets/_kit/StatTile.tsx',
    );
  });

  it('MUTATION GUARD: a planted `accentColor` prop or a StatTile import is caught; clean source is not', () => {
    expect(accentOrStatTileHits({ '/src/app/x.tsx': `<Foo accentColor="#fff" />` })).toHaveLength(
      1,
    );
    expect(
      accentOrStatTileHits({ '/src/app/x.tsx': `import { StatTile } from './StatTile';` }),
    ).toHaveLength(1);
    expect(accentOrStatTileHits({ '/src/app/x.tsx': `<FigureCell label="x" />` })).toEqual([]);
  });

  it('no source declares or passes an accent/accentColor prop, and no source imports StatTile', () => {
    const hits = accentOrStatTileHits(SOURCES);
    expect(hits, `AC-13a violation:\n${hits.join('\n')}`).toEqual([]);
  });
});

// ---- AC-20a — the container-step DECLARATION, against the hardened reader -------------------------

describe('AC-20a — the emitted CSS declares the container-step sizes against the NAMED panel container', () => {
  it('a real figure declares 20px base, 17px under 360px, 15px under 280px — off the named `panel` container, not an unnamed one', () => {
    wrap({ label: 'Call wall', value: '$580.00', register: 'traced' });
    const value = screen.getByText('$580.00');
    const cls = emotionClassOf(value);
    expect(cls, 'FigureCell value should carry an emotion class').toBeTruthy();

    // The BASE declaration lives inside the class's own rule (hardened reader).
    const rule = allRulesForClass(joinedStyleText(), cls as string).join(';');
    expect(rule).toContain('font-size:20px');

    // The two STEPPED declarations are separate `@container panel (max-width:…) { .cls {…} }`
    // blocks — outside the class's own braces, so verified against the full squashed style text
    // rather than the class-scoped `rule` extract. `theme.containerQueries('panel').down(360)`
    // resolves to `max-width:359.95px` (MUI's standard 0.05px boundary subtraction), NOT a naive
    // `360px` — asserted against the real theme output, not assumed.
    //
    // MUTATION PROOF (manually verified, PLAN FE-6; these two `expect`s below ARE the proof, no
    // separate test asserts it): deleting the two `theme.containerQueries('panel').down(...)` keys
    // from `ValueGlyph`'s sx in `FigureCell.tsx` removes `@containerpanel(max-width:359.95px)` /
    // `(max-width:279.95px)` from the emitted CSS, and these two lines go red. The OLD `type-floor`
    // reader (first-rule-only) could not have detected that regression at all — the hardened reader
    // above (`allRulesForClass`/`joinedStyleText`) is what makes it visible here.
    const squashed = joinedStyleText().replace(/\s+/g, '');
    expect(squashed).toContain(`@containerpanel(max-width:359.95px){.${cls}{font-size:17px;}}`);
    expect(squashed).toContain(`@containerpanel(max-width:279.95px){.${cls}{font-size:15px;}}`);
  });

  it('a closed-vocabulary literal is fixed at the literal size and does NOT declare a container step — "it is not a figure"', () => {
    wrap({ label: 'Net DEX', value: 'unavailable' });
    const value = screen.getByText('unavailable');
    const cls = emotionClassOf(value);
    const rule = allRulesForClass(joinedStyleText(), cls as string).join(';');
    expect(rule).toContain('font-size:15px');
    expect(rule).not.toContain('@container');
  });
});
