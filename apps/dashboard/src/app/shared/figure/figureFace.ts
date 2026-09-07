/**
 * `figureFace` — the ONE face binding outside `shared/theme/tokens.ts`
 * (curvature-v2-surfaces SPEC §2.1/§2.3, criterion N-1).
 *
 * WHY THIS FILE EXISTS. Fourteen files under `features/trading/`, `pages/positions/` and
 * `pages/scanner/` bind the mono face by hand today (each one a `MONO`/`monoSx` constant of its
 * own). Every one of them is an independent chance for a figure to wear the wrong register, and
 * the closed nine to be rendered *inside* it. From here on the register is resolved through
 * `figureStateOf` and painted with `faceFor(mono)` — so `fonts.spec.ts`'s second needle can say
 * "no source in those three trees names a font family at all" and mean it.
 *
 * THESE ARE PLAIN OBJECTS CONSUMERS SPREAD INTO THEIR OWN `sx` — deliberately. **The ladder does
 * not travel** (§2.1): 20/17/15 and the fixed 15px literal size are `FigureCell`'s panel-scale
 * constants, a 12px list row keeps 12px and a table cell keeps `fontSize: 'inherit'`. Register and
 * state travel; size does not. Nothing here may grow a `fontSize` key.
 */
import { typographyTokens } from '@/shared/theme/tokens';

/** The traced register — Convexa's own figure. Tabular numerals are part of the face, not a size. */
export const MONO_FACE = {
  fontFamily: typographyTokens.monoFontFamily,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0,
} as const;

/** The untraced/literal register — Plex Sans, the app's own text face. */
export const SANS_FACE = {
  fontFamily: typographyTokens.fontFamily,
} as const;

/**
 * The dotted rule that marks an ASSERTED-but-untraced figure (F9). Carried across from
 * `FigureCell.tsx`'s inline `{ borderBottom: '1px dotted', borderColor: 'text.secondary' }`
 * byte-for-byte — `borderColor` stays a palette PATH, resolved by MUI's `sx`, never a hex.
 */
export const UNTRACED_RULE = {
  borderBottom: '1px dotted',
  borderColor: 'text.secondary',
} as const;

/** The one call a consumer needs: the face for a resolved register. */
export const faceFor = (mono: boolean) => (mono ? MONO_FACE : SANS_FACE);
