/**
 * Coarse-pointer touch floor, the local half (canon rule 7: ≥44px effective targets on coarse
 * pointers; spec 2026-10-21/02, part (b)).
 *
 * WHY A LOCAL HALF EXISTS: the theme floor (`shared/theme/theme.ts`, `MuiCssBaseline`) is an
 * element selector, `button, [role="button"], a, input, summary` at specificity (0,0,1). Every
 * `sx` rule compiles to a class at (0,1,0), so any local `minHeight` below 44 — or a local
 * `minWidth: 0` — beats it, and `min-height` does nothing on a `display: inline` anchor. The rule:
 * an interactive element that sets a local `minHeight` (or `minWidth`) below 44 carries its own
 * coarse 44 as well. These helpers carry it.
 *
 * Every size here changes under `(pointer: coarse)` only; desktop density with a mouse is untouched.
 * Spreading one of these into an `sx` object that ALSO has a `'@media (pointer: coarse)'` key loses
 * one of the two blocks (the later key wins) — use an `sx` array (`sx={[coarseFloor, {...}]}`) there.
 */
import { extrasFor } from '@/shared/theme/tokens';

type ThemeArg = Parameters<typeof extrasFor>[0];

/** Spread into any interactive element's `sx` that sets a `minHeight` below 44. */
export const coarseFloor = {
  '@media (pointer: coarse)': { minHeight: 44 },
} as const;

/**
 * The coarse floor for an MUI `Select` (its visible target is `role="combobox"`). MUI's own
 * `SelectSelect` self-duplicates its class (`&.${selectClasses.select}`, `Select/SelectInput.js`)
 * to "win specificity over the input base": `.MuiSelect-select.MuiSelect-select` sits at (0,2,0),
 * which beats a bare `[role="combobox"]` (0,1,0) and ties a scoped `sx` descendant selector
 * (confirmed by measuring computed `min-height` in a real browser — both lost). Doubling the same
 * class under the `sx` root class reaches (0,3,0), which wins unconditionally.
 *
 * `boxSizing: 'border-box'`: `.MuiSelect-select` is content-box with 8.5px vertical padding on a
 * small select (MUI `InputBase.js`, `OutlinedInput.js`), so a content-box `min-height: 44px` drew a
 * 61px select. Border-box makes a small select exactly 44px; a medium select is already 56px and
 * keeps it. Moved here from `pages/alerts/alertsUi.tsx`.
 */
export const selectCoarseFloorSx = {
  '@media (pointer: coarse)': {
    '& .MuiSelect-select.MuiSelect-select': { minHeight: 44, boxSizing: 'border-box' },
  },
} as const;

/**
 * A link that stands on its own line or in a row of controls ('← All posts', 'What's live',
 * 'Open the live site →'): signal-blue text, a 24px row at a fine pointer, 44px under coarse, with
 * its content centred in the taller box.
 */
export const standaloneLinkSx = {
  color: (t: ThemeArg) => extrasFor(t).textInfo,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  ...coarseFloor,
} as const;

/**
 * A link inside a sentence: colour only. It stays `display: inline`, which the touch floor's one
 * box exemption covers (an inline `A` whose parent is `P`, `LI` or `SPAN`).
 */
export const proseLinkSx = {
  color: (t: ThemeArg) => extrasFor(t).textInfo,
} as const;
