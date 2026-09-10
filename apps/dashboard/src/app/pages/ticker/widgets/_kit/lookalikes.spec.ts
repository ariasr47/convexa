/**
 * AC-22c — the four hand-rolled "StatTile-family" widgets (`IvRank`, `MarketContext`,
 * `StraddleMove`, `DealerFlowProjection`) are NOT converted to `FigureCell` this phase (ruling 6 /
 * SPEC §2.3: "the state matrix does not reach them by a primitive swap"). This is a
 * STALE-ENTRY-CHECKED exemption list (the `hex-discipline` EXEMPT idiom) recording that they are
 * register-correct and liveness-correct BY ABSENCE (all four declared static, all four bind
 * `typographyTokens.monoFontFamily` by hand), but are NOT register-ENFORCED and NOT
 * container-stepped — so the FigureCell enforcement scan is scoped to the 16 converted sites and
 * cannot pass vacuously by silently including these four.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');

/** The four hand-rolled StatTile-family widgets. A listed path that no longer exists RED-BUILDS. */
const NOT_REGISTER_ENFORCED = [
  'pages/ticker/widgets/iv-rank/IvRank.tsx',
  'pages/ticker/widgets/market-context/MarketContext.tsx',
  'pages/ticker/widgets/straddle-move/StraddleMove.tsx',
  'pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx',
] as const;

describe('AC-22c — the four look-alike widgets stay register-correct BY ABSENCE, not enforced', () => {
  it('the exemption list is LIVE — every listed path still exists', () => {
    for (const file of NOT_REGISTER_ENFORCED) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      expect(entry, `${file} exempted but missing — remove the entry`).toBeTruthy();
    }
  });

  it('all four bind `typographyTokens.monoFontFamily` by hand (mono, dotless — correct by construction)', () => {
    for (const file of NOT_REGISTER_ENFORCED) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      const src = entry?.[1] ?? '';
      expect(src, `${file} should bind typographyTokens.monoFontFamily`).toContain(
        'typographyTokens.monoFontFamily',
      );
    }
  });

  it('none of the four imports FigureCell — the primitive swap does not reach them this phase', () => {
    for (const file of NOT_REGISTER_ENFORCED) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      const src = entry?.[1] ?? '';
      expect(src, `${file} should not import FigureCell`).not.toMatch(
        /from\s+['"][^'"]*\/FigureCell['"]/,
      );
    }
  });

  it('none of the four declares a live dot (`figure-live-dot`) — liveness-correct by absence', () => {
    for (const file of NOT_REGISTER_ENFORCED) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      const src = entry?.[1] ?? '';
      expect(src, `${file} should carry no live-dot testid`).not.toContain('figure-live-dot');
    }
  });
});
