/**
 * `TapePulseStrip` — PRESENTATIONAL spec (curvature-v2-desk-and-read, SPEC §2.1/§4.2, FE-6 step 3).
 * The store-driven fixture (`publishLiveTape`/`resetLiveTape`) is gone: this file no longer reads
 * `useLiveTape()` itself, so every case below drives it through props, matching the real call site
 * (`structure-hero/TapeTrailRow.tsx`).
 */
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import type { StructureFieldSurfaces } from '@/shared/charts/structure-field/StructureFieldCanvas';
import { isDeliveringLive, NOT_LIVE } from '@/shared/liveness/liveClaim';
import { themeForPref } from '@/shared/theme/theme';
import { extrasFor } from '@/shared/theme/tokens';
import { ThemeProvider } from '@mui/material/styles';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TapePulseStrip } from './TapePulseStrip';

const darkTheme = themeForPref('dark');
const palette = resolveLevelPalette(darkTheme);
const surfaces: StructureFieldSurfaces = {
  ink: darkTheme.palette.background.default,
  panel: darkTheme.palette.background.paper,
  raised: extrasFor(darkTheme).panelRaised,
  phosphor: darkTheme.palette.text.primary,
  steel: darkTheme.palette.text.secondary,
  warning: darkTheme.palette.warning.main,
};

describe('TapePulseStrip responsive header', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new Proxy({}, { get: () => vi.fn() }) as unknown as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    act(() => undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders offline tape and structure as separate wrapping header fields; carries NO second page-scope liveness claim', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={null}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    const header = screen.getByTestId('tape-pulse-header');
    expect(getComputedStyle(header).display).toBe('flex');
    expect(getComputedStyle(header).flexWrap).toBe('wrap');
    // No mid ever arrived on this claim (drop-with-empty-latch) — the bare not-a-number member,
    // never the structure mid under the `Mid` label (criterion 10).
    expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid —');
    expect(screen.getByTestId('tape-structure-readout')).toHaveTextContent('Structure $146.15');
    // Re-pointed (curvature-v2-foundations, AC-57): `tape-stream-state` was a SECOND page-scope
    // liveness authority beside the header connection chip (canon rule 18). It is now DELETED —
    // the ONE connection chip (`TickerHeader`/`CommandDeck`) is the sole authority; that assertion
    // lives in `ticker.risk.spec.tsx` / the new `connection` specs, not here.
    expect(screen.queryByTestId('tape-stream-state')).toBeNull();
  });

  it('the label is `Mid` — never `Live` — even while genuinely delivering with a mid present (SPEC §4.2, criterion 9)', () => {
    const claim = isDeliveringLive(
      { ticker: 'SPY', live: true, market_session: 'open' } as Parameters<
        typeof isDeliveringLive
      >[0],
      false,
    );
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={claim}
          mid={147.02}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    const readout = screen.getByTestId('tape-mid-readout');
    expect(readout).toHaveTextContent('Mid $147.02');
    expect(readout.textContent).not.toMatch(/\bLive\b/);
  });

  it('never renders the STRUCTURE mid under the `Mid` label — a delivering stream with NO mid present makes no live claim (criterion 10, SB)', () => {
    // Genuinely delivering, but the tick carried no mid — `andPresent` composes false; the old
    // `displayMid = liveMid ?? structureMid` bug would have printed `Mid $146.15` here.
    const claim = isDeliveringLive(
      { ticker: 'SPY', live: true, market_session: 'open' } as Parameters<
        typeof isDeliveringLive
      >[0],
      false,
    );
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={claim}
          mid={null}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid —');
  });

  it('a latched mid renders under `Mid` on a drop — retained, never blanked, never the structure figure', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={147.5}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid $147.50');
  });
});

describe('TapePulseStrip — the Mid readout offline pause mark (GATE Z, SPEC §4.1 "Tape trail row")', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new Proxy({}, { get: () => vi.fn() }) as unknown as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    act(() => undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('no `paused` prop: no pause mark, the value is not dimmed (default, unchanged shape)', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={147.5}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('tape-mid-pause')).toBeNull();
  });

  it('paused + a retained latched mid: pause mark present, value dimmed, latched number still shown', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={147.5}
          paused
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tape-mid-pause')).toBeInTheDocument();
    const readout = screen.getByTestId('tape-mid-readout');
    expect(readout).toHaveTextContent('Mid $147.50');
    const valueSpan = screen.getByText('$147.50');
    expect(getComputedStyle(valueSpan).opacity).toBe('0.5');
  });

  it('paused + an empty latch (bare): pause mark present, value dimmed, shows `—`', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={null}
          paused
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tape-mid-pause')).toBeInTheDocument();
    expect(screen.getByTestId('tape-mid-readout')).toHaveTextContent('Mid —');
  });

  it('16b: `paused=false` during a replay standing renders full strength — no pause mark, never dimmed', () => {
    // Mirrors the host's own invariant: `tileOffline` (this component's `paused`) is `st ? false :
    // streamOffline`, so a replay standing reaches this component with `paused=false` structurally,
    // never by an `!isLive` check here. This proves the component honours that contract when it does.
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={147.5}
          paused={false}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('tape-mid-pause')).toBeNull();
    const valueSpan = screen.getByText('$147.50');
    expect(getComputedStyle(valueSpan).opacity).not.toBe('0.5');
  });
});

/**
 * F-D (BACKLOG Harvest addendum 2026-09-08): the visual gate freezes the frame — the clock is paused
 * and every pending animation frame is cancelled — and a ResizeObserver notification that lands after
 * that freeze used to reset `canvas.width` (which clears the bitmap) while leaving the repaint to a
 * frame that never comes. The `ticker-desktop` baseline captured a blank sparkline slot in 6 of 7
 * runs and the drawn trail in the seventh. These cases run with `requestAnimationFrame` stubbed to
 * NEVER fire, so a paint that only happens inside the frame loop is invisible to them.
 */
describe('TapePulseStrip — the sparkline never waits for an animation frame after a layout (F-D)', () => {
  let ctxCalls: { name: string; args: unknown[] }[];
  let resizeCallbacks: ResizeObserverCallback[];

  // The full-canvas ink fill is the first stroke of every paint — count it to count paints.
  const paints = () =>
    ctxCalls.filter((c) => c.name === 'fillRect' && c.args[0] === 0 && c.args[1] === 0).length;
  // The dashed structure baseline is what the gate's diff showed missing (bbox y 549–578).
  const dashedBaselines = () =>
    ctxCalls.filter(
      (c) => c.name === 'setLineDash' && Array.isArray(c.args[0]) && c.args[0].length === 2,
    ).length;

  beforeEach(() => {
    ctxCalls = [];
    const recording = new Proxy(
      {},
      {
        get:
          (_target, name) =>
          (...args: unknown[]) => {
            ctxCalls.push({ name: String(name), args });
          },
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      recording as unknown as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    resizeCallbacks = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe() {
          // The test fires the captured callback itself; nothing to observe in jsdom.
        }
        unobserve() {
          // See observe().
        }
        disconnect() {
          // See observe().
        }
      },
    );
  });

  afterEach(() => {
    cleanup();
    act(() => undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const mount = () =>
    render(
      <ThemeProvider theme={darkTheme}>
        <TapePulseStrip
          structureMid={146.15}
          claim={NOT_LIVE}
          mid={147.5}
          paused
          palette={palette}
          surfaces={surfaces}
          height={30}
        />
      </ThemeProvider>,
    );

  it('paints once on mount, before any animation frame has run', () => {
    mount();
    expect(paints()).toBe(1);
    expect(dashedBaselines()).toBe(1);
  });

  it('a ResizeObserver notification repaints in the same turn — a resize can never leave the canvas cleared until the next frame', () => {
    mount();
    const before = paints();
    expect(resizeCallbacks.length).toBeGreaterThan(0);
    act(() => {
      for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
    });
    expect(paints()).toBe(before + 1);
    expect(dashedBaselines()).toBe(before + 1);
  });
});
