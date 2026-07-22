/**
 * Stage 0 item 4 — the chip/label TYPE FLOOR ≥ 11px (redesign-stage-0 FRONTEND_EXECUTION_CONTRACT
 * §8.4; convexa-design skill rule 7 — the 9px "vs spot" TintChip was the documented failure).
 *
 *   1. RENDERED check — `TintChip` (this `_kit`'s pill, the former 9px site) carries a computed
 *      `font-size: 11px`. MUI `sx` compiles to classes, so we assert on the emotion class's injected
 *      CSS text (never `getAttribute('style')` — the testing gotcha).
 *   2. SOURCE-SCAN floor (`?raw`, vacuity-guarded, mutation-tested) — no `fontSize` below 11px
 *      (numeric px or `'<n>rem'` below 0.6875rem) anywhere under `pages/`, `features/`, `shell/`,
 *      `shared/ui/` — EXCEPT the enumerated SVG-chart tick-text exemptions (chart annotation, not UI
 *      chips/labels; bumping them moves LOCKED-chart geometry — contract §10.1, flagged not decided).
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { theme } from '@/shared/theme/theme';
import { TintChip } from './TintChip';

afterEach(() => cleanup());

// ---- 1. TintChip renders at the floor ------------------------------------------------------------

describe('TintChip — computed font-size is the 11px floor', () => {
  const chipRule = (label: string) => {
    const { getByText } = render(
      <ThemeProvider theme={theme}>
        <TintChip tone={label === 'HIGH' ? 'emphasis' : 'neutral'} label={label} />
      </ThemeProvider>,
    );
    const chip = getByText(label);
    const emotionClass = Array.from(chip.classList).find((c) => c.startsWith('css-'));
    expect(emotionClass, 'TintChip should carry an emotion (sx) class').toBeTruthy();

    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
      .replace(/\s+/g, '');
    return css.split(`.${emotionClass}{`)[1]?.split('}')[0] ?? '';
  };

  it('the emotion class the chip wears declares font-size:11px', () => {
    expect(chipRule('+1.2% vs spot')).toContain('font-size:11px');
  });

  it('the stage-3 emphasis tone holds the same 11px floor (§8-4)', () => {
    expect(chipRule('HIGH')).toContain('font-size:11px');
  });
});

// ---- 2. Source-scan floor -------------------------------------------------------------------------

const SOURCES = import.meta.glob(
  [
    '/src/app/pages/**/*.{ts,tsx}',
    '/src/app/features/**/*.{ts,tsx}',
    '/src/app/shell/**/*.{ts,tsx}',
    '/src/app/shared/ui/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** SVG-chart tick text at 10px — chart annotation OUTSIDE the chip/label floor (contract §10.1:
 *  recorded exemption, not a silent decision; each entry must STILL carry a sub-floor size or it is
 *  stale and must be removed). */
const EXEMPT_CHART_TICKS = [
  'pages/ticker/widgets/gex-profile-chart/chart.tsx',
  'pages/ticker/widgets/term-structure/TermStructure.tsx',
  'pages/operator-metrics/LatencyTrend.tsx',
];

const FLOOR_PX = 11;
const PX_RE = /fontSize:\s*([0-9]+(?:\.[0-9]+)?)\s*[,}\s]/g;
const REM_RE = /fontSize:\s*['"]([0-9.]+)rem['"]/g;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');

/** Pure checker (drives the mutation guard): every sub-floor fontSize in a non-exempt file. */
function floorViolations(files: Record<string, string>, exempt: string[]): string[] {
  const out: string[] = [];
  for (const [key, src] of Object.entries(files)) {
    const file = appPath(key);
    if (exempt.includes(file)) continue;
    for (const m of src.matchAll(PX_RE)) {
      if (Number(m[1]) < FLOOR_PX) out.push(`${file} → fontSize: ${m[1]}`);
    }
    for (const m of src.matchAll(REM_RE)) {
      if (Number(m[1]) * 16 < FLOOR_PX) out.push(`${file} → fontSize: '${m[1]}rem'`);
    }
  }
  return out;
}

describe('type-floor source scan — no chip/label fontSize below 11px', () => {
  it('the glob is not vacuous (and covers the floor’s home dirs)', () => {
    const keys = Object.keys(SOURCES).map(appPath);
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.some((k) => k.startsWith('pages/'))).toBe(true);
    expect(keys.some((k) => k.startsWith('features/'))).toBe(true);
    expect(keys.some((k) => k.startsWith('shared/ui/'))).toBe(true);
  });

  it('MUTATION GUARD: the scan fails on sub-floor px AND rem sources', () => {
    expect(floorViolations({ '/src/app/pages/x.tsx': 'sx={{ fontSize: 9, }}' }, [])).toHaveLength(1);
    expect(
      floorViolations({ '/src/app/pages/x.tsx': "sx={{ fontSize: '0.62rem' }}" }, []),
    ).toHaveLength(1);
    expect(floorViolations({ '/src/app/pages/x.tsx': 'sx={{ fontSize: 11 }}' }, [])).toHaveLength(0);
  });

  it('no source carries a sub-11px fontSize outside the chart-tick exemptions', () => {
    const violations = floorViolations(SOURCES, EXEMPT_CHART_TICKS);
    expect(
      violations,
      `chip/label type floor is 11px (convexa-design rule 7):\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('the exemption list is LIVE — every exempted file still exists and still carries a sub-floor size', () => {
    for (const file of EXEMPT_CHART_TICKS) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      expect(entry, `${file} exempted but missing — remove the entry`).toBeTruthy();
      expect(
        floorViolations({ [`/src/app/${file}`]: entry![1] }, []).length,
        `${file} exempted but carries no sub-floor fontSize anymore — remove the entry`,
      ).toBeGreaterThan(0);
    }
  });
});
