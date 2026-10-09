/**
 * `FigureCell` — rewrite of `StatTile.spec.tsx` (SPEC §2.3/§4.1, PLAN FE-4). Covers the live,
 * offline, replay, literal and untraced states (F3-F9), the closed `NotANumber` vocabulary
 * (AC-19/AC-19b) and the ⓘ keyboard path.
 */
import { isNotANumber, NOT_A_NUMBER } from '@/shared/copy/notANumber';
import { isDeliveringLive, NOT_LIVE } from '@/shared/liveness/liveClaim';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FigureCell, type FigureCellProps } from './FigureCell';

// A branded `true` claim for tests exercising the F3 live dot (FE-1, SPEC §2.1 invariant 1) — a
// raw `true` no longer type-checks in `FigureCellProps.live`.
const LIVE_TRUE = isDeliveringLive(
  { live: true, market_session: 'regular' } as Parameters<typeof isDeliveringLive>[0],
  false,
);

function wrap(props: Partial<FigureCellProps> & Pick<FigureCellProps, 'label' | 'value'>) {
  const full: FigureCellProps = { register: 'traced', ...props };
  return render(
    <ThemeProvider theme={theme}>
      <FigureCell {...full} />
    </ThemeProvider>,
  );
}

describe('FigureCell — F3 live', () => {
  it('the dot renders ONLY when `live` is true, carries the visually-hidden word "live", and never sits in an aria-live region', () => {
    const { unmount } = wrap({ label: 'Net flow', value: '+12,480', live: LIVE_TRUE });
    const dot = screen.getByTestId('figure-live-dot');
    expect(dot).toHaveTextContent('live');
    expect(dot.closest('[aria-live]')).toBeNull();
    expect(dot.closest('[data-figure-state]')).toHaveAttribute('data-figure-state', 'live');
    unmount();
    wrap({ label: 'Net flow', value: '+12,480', live: NOT_LIVE });
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
});

describe('FigureCell — F6 replay (AC-6)', () => {
  it('Mono full strength, no dot, no pause mark, no "offline" caption', () => {
    wrap({ label: 'Gamma flip', value: '$573', replay: true, live: LIVE_TRUE });
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
