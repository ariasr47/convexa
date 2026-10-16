/**
 * The ONE stroke table (SPEC §2.7, canon 14). Keyed by LADDER-ROW IDENTITY and exporting TOKEN KEYS,
 * never colours: the React host resolves keys → colours via `useTheme()` and passes a RESOLVED
 * palette into the canvas as a prop. Drift becomes impossible because there is one table — a second
 * table for the ladder would make "one object" a coincidence that breaks on the first token change
 * (SPEC §2.7, rejected approaches).
 *
 * Key choice, measured against `shared/theme/tokens.ts` + `design/src/verify-tokens.mjs` (the design
 * system's own CSS-var truth, `design/src/components/ladder.mjs`'s `--up`/`--down`/`--steel`/
 * `--amber`/`--signal`): the gamma-flip line binds `text.primary` (phosphor in dark, ink in light).
 * It used to bind `primary.main` (amber); the owner's P-15 ruling (2026-10-14) draws the flip in
 * phosphor, not amber, and ruling A (2026-10-15) spends amber on the one primary action only, so
 * the Final boards draw the flip neutral (site check D-08). The mid row binds `info.main`: "links/info/live
 * status bind `info` (signal — deliberately quieter than amber)" (dark `signal`, light `lightInfo` —
 * `verify-tokens.mjs:23,26`). Neither is a bare `extras.*` key — `tokens.ts`'s `extras`/`extrasLight`
 * objects carry no `gammaAmber`/`signal` members; those two names are top-level, mode-INVARIANT
 * constants, and using them directly here would reintroduce a scheme-invariant stroke.
 */
import { alpha, type Theme } from '@mui/material/styles';

export type LadderRowId = 'callWall' | 'mid' | 'maxPain' | 'gammaFlip' | 'putWall';

/** A token KEY. The resolver below is the only place a key becomes a colour. */
export type StrokeTokenKey =
  | 'palette.success.main'
  | 'palette.error.main'
  | 'palette.text.secondary'
  | 'palette.text.primary'
  | 'palette.info.main';

export const LEVEL_STROKES: Readonly<Record<LadderRowId, StrokeTokenKey>> = {
  callWall: 'palette.success.main',
  putWall: 'palette.error.main',
  gammaFlip: 'palette.text.primary',
  mid: 'palette.info.main',
  maxPain: 'palette.text.secondary',
} as const;

/** The resolved palette handed to the canvas (and, from FE-5, the ladder) as a PROP. */
export type LevelPalette = Readonly<Record<LadderRowId, string>>;

function resolveToken(theme: Theme, key: StrokeTokenKey): string {
  switch (key) {
    case 'palette.success.main':
      return theme.palette.success.main;
    case 'palette.error.main':
      return theme.palette.error.main;
    case 'palette.text.secondary':
      return theme.palette.text.secondary;
    case 'palette.text.primary':
      return theme.palette.text.primary;
    case 'palette.info.main':
      return theme.palette.info.main;
    default: {
      // Exhaustiveness: a sixth `StrokeTokenKey` member is a compile error here, not a runtime gap.
      const neverKey: never = key;
      return neverKey;
    }
  }
}

const LADDER_ROW_IDS: readonly LadderRowId[] = [
  'callWall',
  'mid',
  'maxPain',
  'gammaFlip',
  'putWall',
];

/** The canvas never reads a theme — this is the only place a token key becomes a colour. */
export function resolveLevelPalette(theme: Theme): LevelPalette {
  const out = {} as Record<LadderRowId, string>;
  for (const id of LADDER_ROW_IDS) {
    out[id] = resolveToken(theme, LEVEL_STROKES[id]);
  }
  return out;
}

/**
 * Derive an alpha-varied paint from an already-RESOLVED colour (a `LevelPalette` entry or a
 * `surfaces.*` value) — never a fresh literal. Thin wrapper over MUI's own `alpha()`, which every
 * other themed surface in this app already uses for the same purpose.
 */
export function withAlpha(color: string, opacity: number): string {
  return alpha(color, opacity);
}
