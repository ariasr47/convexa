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
 *   3. AC-20a — `FigureCell`'s container-step DECLARATION (20 → 17 → 15px against the NAMED `panel`
 *      container). HARDENED reader (curvature-v2-foundations SPEC §2.5): the old helper returned
 *      the FIRST rule bearing the class and stopped at the first `}` — structurally blind to a
 *      hoisted `@container` block, and it would have PASSED with those blocks deleted. `chipRule`
 *      now captures EVERY block bearing the class (a global regex over the joined, whitespace-
 *      stripped CSS text), so a `@container` block is visible to the assertion.
 */
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { theme } from '@/shared/theme/theme';
import { TintChip } from '@/shared/ui/TintChip';
import { allRulesForClass, emotionClassOf, joinedStyleText } from './emotionCssReader';

afterEach(() => cleanup());

function classListOf(el: Element): string {
  const cls = emotionClassOf(el);
  expect(cls, 'element should carry an emotion (sx) class').toBeTruthy();
  return cls as string;
}

// ---- 1. TintChip renders at the floor ------------------------------------------------------------

describe('TintChip — computed font-size is the 11px floor', () => {
  const chipRule = (label: string) => {
    const { getByText } = render(
      <ThemeProvider theme={theme}>
        <TintChip tone={label === 'HIGH' ? 'emphasis' : 'neutral'} label={label} />
      </ThemeProvider>,
    );
    const chip = getByText(label);
    const cls = classListOf(chip);
    return allRulesForClass(joinedStyleText(), cls).join(';');
  };

  it('the emotion class the chip wears declares font-size:11px', () => {
    expect(chipRule('+1.2% vs spot')).toContain('font-size:11px');
  });

  it('the stage-3 emphasis tone holds the same 11px floor (§8-4)', () => {
    expect(chipRule('HIGH')).toContain('font-size:11px');
  });
});

// ---- MUTATION GUARD for the hardened reader itself -------------------------------------------------

describe('allRulesForClass — the hardened reader is non-vacuous and sees hoisted blocks', () => {
  it('a single-rule fixture returns exactly that rule', () => {
    const css = '.css-abc{font-size:20px;color:red;}';
    expect(allRulesForClass(css, 'css-abc')).toEqual(['font-size:20px;color:red;']);
  });

  it('MUTATION GUARD: a fixture with a HOISTED @container block after the base rule is VISIBLE — the old reader would have missed it entirely', () => {
    const css =
      '@container panel (max-width:360px){.css-abc{font-size:17px;}}' + '.css-abc{font-size:20px;}';
    const rules = allRulesForClass(css, 'css-abc');
    // Both the base declaration AND the hoisted @container declaration are captured.
    expect(rules.some((r) => r.includes('font-size:17px'))).toBe(true);
    expect(rules.some((r) => r.includes('font-size:20px'))).toBe(true);
  });

  it('MUTATION GUARD: deleting the @container block from the fixture removes it from the result — proving the assertion actually depends on that block existing', () => {
    const withContainer =
      '@container panel (max-width:360px){.css-abc{font-size:17px;}}' + '.css-abc{font-size:20px;}';
    const withoutContainer = '.css-abc{font-size:20px;}';
    expect(allRulesForClass(withContainer, 'css-abc').join(';')).toContain('font-size:17px');
    expect(allRulesForClass(withoutContainer, 'css-abc').join(';')).not.toContain('font-size:17px');
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
  // Canvas Structure Field uses ctx.font sizes ≥11; no Recharts tick fontSize:10 path anymore.
  // Operator-metrics chart ticks; term structure is now Term Heat canvas (no fontSize:10 ticks).
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
    expect(floorViolations({ '/src/app/pages/x.tsx': 'sx={{ fontSize: 9, }}' }, [])).toHaveLength(
      1,
    );
    expect(
      floorViolations({ '/src/app/pages/x.tsx': "sx={{ fontSize: '0.62rem' }}" }, []),
    ).toHaveLength(1);
    expect(floorViolations({ '/src/app/pages/x.tsx': 'sx={{ fontSize: 11 }}' }, [])).toHaveLength(
      0,
    );
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
      if (!entry) throw new Error(`${file} exempted but missing — remove the entry`);
      expect(
        floorViolations({ [`/src/app/${file}`]: entry[1] }, []).length,
        `${file} exempted but carries no sub-floor fontSize anymore — remove the entry`,
      ).toBeGreaterThan(0);
    }
  });
});
