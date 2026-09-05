/**
 * `TapeTrailRow` — the trail-paused caption, verbatim (SPEC §4.6): "tape paused · trail frozen"
 * when the latch holds a value, "tape paused" alone when it never drew — the same two-arm
 * discipline owner ruling 2 sets for values (§2.2). Additive spec, beyond PLAN's enumerated FE-6
 * file list (which names `StructureHeroPanel.spec.tsx` but not this one) — cheap regression
 * insurance on copy that is otherwise only exercised indirectly through the host.
 */
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import type { StructureFieldSurfaces } from '@/shared/charts/structure-field/StructureFieldCanvas';
import { NOT_LIVE, isDeliveringLive } from '@/shared/liveness/liveClaim';
import { theme } from '@/shared/theme/theme';
import { extrasFor } from '@/shared/theme/tokens';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TapeTrailRow } from './TapeTrailRow';

const palette = resolveLevelPalette(theme);
const surfaces: StructureFieldSurfaces = {
  ink: theme.palette.background.default,
  panel: theme.palette.background.paper,
  raised: extrasFor(theme).panelRaised,
  phosphor: theme.palette.text.primary,
  steel: theme.palette.text.secondary,
  warning: theme.palette.warning.main,
};

describe('TapeTrailRow — the trail-paused caption (SPEC §4.6)', () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders NO caption at all while genuinely delivering (not paused)', () => {
    const claim = isDeliveringLive(
      { ticker: 'SPY', live: true, market_session: 'open' } as Parameters<
        typeof isDeliveringLive
      >[0],
      false,
    );
    render(
      <ThemeProvider theme={theme}>
        <TapeTrailRow
          structureMid={450}
          claim={claim}
          mid={450.5}
          retained
          paused={false}
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('tape-trail-caption')).toBeNull();
  });

  it('renders `tape paused · trail frozen` when paused AND the latch holds a value', () => {
    render(
      <ThemeProvider theme={theme}>
        <TapeTrailRow
          structureMid={450}
          claim={NOT_LIVE}
          mid={450.5}
          retained
          paused
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tape-trail-caption')).toHaveTextContent(
      'tape paused · trail frozen',
    );
  });

  it('renders `tape paused` ALONE when paused and the latch never held a value — never asserting a frozen trail that was never drawn', () => {
    render(
      <ThemeProvider theme={theme}>
        <TapeTrailRow
          structureMid={450}
          claim={NOT_LIVE}
          mid={null}
          retained={false}
          paused
          palette={palette}
          surfaces={surfaces}
        />
      </ThemeProvider>,
    );
    const caption = screen.getByTestId('tape-trail-caption');
    expect(caption).toHaveTextContent('tape paused');
    expect(caption.textContent).not.toMatch(/trail frozen/);
  });
});
