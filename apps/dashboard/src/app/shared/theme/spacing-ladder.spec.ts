/**
 * AC-45c — the SPACING FENCE (ruling 4: radius In, spacing fenced). Off-ladder `sx` multipliers
 * are scanned, today's offenders ship as a LIVE-CHECKED exemption list, the occurrence count goes
 * in the build report, and a NAMED later phase burns it down. A stale list that silently stops
 * matching is worse than no list — that is what the liveness assertion is for.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');

/** The declared 4-pt rhythm as MUI multipliers: 4 8 12 16 20 24 32 40 → 0.5 1 1.5 2 2.5 3 4 5. */
const LADDER = new Set([0, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
const SPACING_PROPS =
  /\b(p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|rowGap|columnGap|spacing):\s*([0-9]+(?:\.[0-9]+)?)/g;

/** THE BURN-DOWN PHASE. Not an open-ended grandfather — this name is the list's expiry. */
export const SPACING_DEBT_BURNDOWN_PHASE = 'curvature-v2 phase 4 (responsive sweep)';

/**
 * Seeded with today's files (measured 2026-09-04 by running this scan with EXEMPT empty): 49
 * occurrences across 26 files. The architect's number (SPEC §2.2 / PLAN FE-3) was 86 occurrences
 * across 35 files — recorded as the architect's number, never independently verified; this is the
 * measured count under THIS scan's specific regex (spacing shorthand props + gap variants, object
 * literal `key: n` syntax only — it does not walk `<Stack spacing={n}>` JSX attribute syntax or
 * template-literal spacing, which is the likely source of the delta). Reported in BUILD_REPORT.md
 * beside the architect's figure per PLAN FE-3 Step 5. EVERY entry must still carry an off-ladder
 * value (checked below).
 *
 * FE-11 BURN-DOWN (owner ruling 4, "the files this phase rewrites only"): `chrome/TapePulseStrip.tsx`
 * is the one EXEMPT file this phase actually rewrote (its `Mid` readout gained the offline pause
 * mark + dim, SPEC §4.1) — its one off-ladder value (`px: 1.25`) moved onto the ladder (`1.5`) and its
 * entry is removed here. Measured again after: **48 occurrences across 25 files.** No other EXEMPT
 * file was touched this phase (`position-brief/PositionBrief.tsx` is READ, not rewritten — only its
 * call site moved in `TickerDashboard.tsx`) — do not widen the fence to files this phase did not
 * actually rewrite; the remainder stays booked to `SPACING_DEBT_BURNDOWN_PHASE`.
 *
 * TICKER FIDELITY REPAIR BURN-DOWN (2026-09-08, changes 3/4): `chrome/TickerHeader.tsx`'s one
 * off-ladder value (`ml: 1.25`, on the headline's "(levels @ …)" parenthetical) is GONE — that
 * parenthetical moved to the new second line as separate on-ladder spans (change 3, F3) — so its
 * entry is removed here, not merely re-justified. `read-strip/ReadStrip.tsx` is a NEW file this
 * repair adds (change 4, F4); its two off-ladder drafts (`py: 1.25`, `gap: 1.25`) were fixed to
 * `1.5`/`1` before landing, never exempted — new code ships on-ladder, it does not grow this list.
 *
 * CURVATURE-V2-LANDING-AND-SITE F2 (2026-09-10): `app.tsx`'s one off-ladder value (`py: 8`, the
 * `RouteFallback` loading fill) MOVED byte-identically to the new `shared/ui/RouteFallback.tsx`
 * (SPEC §2.2 item 6, PLAN F2 step 4 — same markup, same value, zero render change). The debt
 * travels with the code, so the entry moves with it rather than being dropped; `app.tsx` now
 * carries no off-ladder value at all and drops off this list.
 */
const EXEMPT: string[] = [
  'features/auth/AiKeySection.tsx',
  'features/auth/RiskInputsSection.tsx',
  'features/auth/SettingsPage.tsx',
  'features/trading/outcomes/TrackRecordSection.tsx',
  'pages/alerts/AlertsPage.tsx',
  'pages/lab/LabIndex.tsx',
  'pages/lab/LabShell.tsx',
  'pages/lab/StructureFieldLab.tsx',
  'pages/methodology/MethodologyPage.tsx',
  'pages/scanner/ScanTable.tsx',
  // Re-pointed (not deleted): StatTile.tsx → FigureCell.tsx at curvature-v2-foundations, carrying
  // forward the same `pl: 2.25` (CardContent inset) byte-for-byte.
  'pages/ticker/widgets/_kit/FigureCell.tsx',
  'pages/ticker/widgets/ai-rec/StateExportDrawer.tsx',
  'pages/ticker/widgets/ai-rec/reasoning.tsx',
  'pages/ticker/widgets/chrome/CommandDeck.tsx',
  'pages/ticker/widgets/chrome/QuickSymbols.tsx',
  'pages/ticker/widgets/chrome/TickerToolbar.tsx',
  'pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx',
  'pages/ticker/widgets/iv-rank/IvRank.tsx',
  'pages/ticker/widgets/market-context/MarketContext.tsx',
  'pages/ticker/widgets/position-brief/PositionBrief.tsx',
  'pages/ticker/widgets/straddle-move/StraddleMove.tsx',
  'pages/ticker/widgets/structure-history/StructurePathStrip.tsx',
  'shared/ui/RouteFallback.tsx',
  'shared/ui/TintChip.tsx',
];

function offLadder(files: Record<string, string>, exempt: string[]): string[] {
  const out: string[] = [];
  for (const [key, src] of Object.entries(files)) {
    const file = appPath(key);
    if (exempt.includes(file)) continue;
    for (const m of src.matchAll(SPACING_PROPS)) {
      if (!LADDER.has(Number(m[2]))) out.push(`${file} → ${m[1]}: ${m[2]}`);
    }
  }
  return out;
}

describe('spacing ladder — fenced, live-checked, with a named expiry', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: an off-ladder value is caught, an on-ladder one is not', () => {
    expect(offLadder({ '/src/app/pages/x.tsx': 'sx={{ p: 3.75 }}' }, [])).toHaveLength(1);
    expect(offLadder({ '/src/app/pages/x.tsx': 'sx={{ p: 2.5 }}' }, [])).toHaveLength(0);
  });

  it('no NEW off-ladder spacing outside the seeded exemption list', () => {
    const v = offLadder(SOURCES, EXEMPT);
    expect(
      v,
      `off the 4-pt ladder (burn-down: ${SPACING_DEBT_BURNDOWN_PHASE}):\n${v.join('\n')}`,
    ).toEqual([]);
  });

  it('the exemption list is LIVE — every listed file still carries an off-ladder value', () => {
    for (const file of EXEMPT) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} exempted but missing — remove the entry`);
      expect(
        offLadder({ [`/src/app/${file}`]: entry[1] }, []).length,
        `${file} is now on-ladder — remove the entry`,
      ).toBeGreaterThan(0);
    }
  });
});
