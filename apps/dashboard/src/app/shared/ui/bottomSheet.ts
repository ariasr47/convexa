/**
 * The phone bottom sheet: under 600px every dialog becomes a sheet, full width at the foot of the
 * screen with a grab handle, and its actions stack full width at 44px. The Final boards draw every
 * overlay this way on a phone (`design/src/screens/final/account-dialogs.mjs`, "Overlays on a phone",
 * `.ac-sheet`); New alert built it first (`pages/alerts/NewAlertDialog.tsx`), and these are its
 * values, hoisted unchanged so every dialog can take the same sheet (fidelity audit 2026-10-25,
 * ACC-15).
 *
 * Use:
 *   <Dialog sx={bottomSheetDialogSx} …>
 *     <Box aria-hidden sx={grabHandleSx} />
 *     …
 *     <Box sx={[footerSx, bottomSheetActionsSx]}>…buttons…</Box>
 *
 * The sheet is the layout only; the surface (panel colour, no wash, the line border) is the theme's
 * (`MuiDialog.styleOverrides.paper`, `shared/theme/theme.ts`). A dialog with its own `sx` puts both
 * in an array (`sx={[bottomSheetDialogSx, {…}]}`), so neither media block replaces the other.
 */

/** Below 600px. The same edge New alert uses; desktop is untouched. */
const PHONE = '@media (max-width: 599px)';

/** On the `Dialog` root: under 600px the paper sits at the foot of the screen, full width, with
 *  only its top corners rounded, and stops at 92% of the dynamic viewport height. */
export const bottomSheetDialogSx = {
  [PHONE]: {
    '& .MuiDialog-container': { alignItems: 'flex-end' },
    '& .MuiDialog-paper': {
      m: 0,
      width: '100%',
      maxWidth: '100%',
      maxHeight: '92dvh',
      borderRadius: '16px 16px 0 0',
    },
  },
} as const;

/** The grab handle, the paper's first child: a 40×4 bar, centred, shown below `sm` only. Decorative,
 *  so it carries `aria-hidden` at the call site. */
export const grabHandleSx = {
  display: { xs: 'block', sm: 'none' },
  width: 40,
  height: 4,
  borderRadius: 2,
  bgcolor: 'divider',
  mx: 'auto',
  mt: 1,
} as const;

/** On the actions row (a flex row): under 600px each button takes a full row at 44px, in source
 *  order, so the sheet's actions stack (the board's `.ac-sheet .df .btn`). */
export const bottomSheetActionsSx = {
  [PHONE]: {
    flexWrap: 'wrap',
    '& .MuiButton-root': { flex: '1 1 100%', minHeight: 44 },
  },
} as const;
