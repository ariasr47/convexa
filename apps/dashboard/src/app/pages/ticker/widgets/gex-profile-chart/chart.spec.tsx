/**
 * `GexProfileChart` — the host half of SPEC §2.7 / criteria 52-53 (DELEGATED P5): the canvas has no
 * theme input of its own, so THIS component is where `palette`/`surfaces` get resolved via
 * `useTheme()` and handed down. Criterion 52 (does the field actually render on the light panel
 * surface) is `review` — a real browser check. Criterion 53 ("no surface this phase creates renders
 * a hardcoded, scheme-invariant background or text colour") is `test`-able here: the resolved
 * `surfaces` object this host computes must differ between the dark and light theme.
 */
import type { StructureFieldCanvasProps } from '@/shared/charts/structure-field';
import { lightTheme, theme } from '@/shared/theme/theme';
import type { StrikeRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GexProfileChart } from './chart';

const captured: StructureFieldCanvasProps[] = [];

vi.mock('@/shared/charts/structure-field', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/charts/structure-field')>();
  return {
    ...actual,
    StructureFieldCanvas: (props: StructureFieldCanvasProps) => {
      captured.push(props);
      return null;
    },
  };
});

const strikes: StrikeRow[] = [
  {
    strike: 448,
    net_gex: -2_000_000,
    call_gex: 0,
    put_gex: -2_000_000,
    call_oi: 0,
    put_oi: 0,
    total_oi: 0,
    net_dex: null,
    vol_oi_ratio: null,
    volume: null,
  },
  {
    strike: 452,
    net_gex: 3_000_000,
    call_gex: 3_000_000,
    put_gex: 0,
    call_oi: 0,
    put_oi: 0,
    total_oi: 0,
    net_dex: null,
    vol_oi_ratio: null,
    volume: null,
  },
];

describe('GexProfileChart — resolves scheme-aware palette/surfaces (criterion 53)', () => {
  afterEach(() => {
    captured.length = 0;
  });

  it('hands the canvas a five-member palette and a full surfaces object, per render', () => {
    render(
      <ThemeProvider theme={theme}>
        <GexProfileChart strikes={strikes} spot={450} callWall={452} putWall={448} gammaFlip={449} />
      </ThemeProvider>,
    );
    expect(captured).toHaveLength(1);
    const { palette, surfaces } = captured[0];
    expect(Object.keys(palette).sort()).toEqual(
      ['callWall', 'gammaFlip', 'maxPain', 'mid', 'putWall'].sort(),
    );
    expect(Object.keys(surfaces).sort()).toEqual(
      ['ink', 'panel', 'phosphor', 'raised', 'steel', 'warning'].sort(),
    );
  });

  it('never renders the same surfaces object across the dark and light schemes (no scheme-invariant surface)', () => {
    render(
      <ThemeProvider theme={theme}>
        <GexProfileChart strikes={strikes} spot={450} callWall={452} putWall={448} gammaFlip={449} />
      </ThemeProvider>,
    );
    const dark = captured[0].surfaces;
    captured.length = 0;

    render(
      <ThemeProvider theme={lightTheme}>
        <GexProfileChart strikes={strikes} spot={450} callWall={452} putWall={448} gammaFlip={449} />
      </ThemeProvider>,
    );
    const light = captured[0].surfaces;

    const keys = Object.keys(dark) as (keyof typeof dark)[];
    const differing = keys.filter((k) => dark[k] !== light[k]);
    expect(differing.length).toBeGreaterThan(0);
  });
});
