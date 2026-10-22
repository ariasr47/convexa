/**
 * Staging only: “Reset demo data” asks in place before it clears this browser's demo changes, then
 * `onReset` (resetDemoWorkspace) reloads on the seed account. A Popover under the button: it takes
 * focus, closes on Esc or “Keep my changes”, and focus returns to the button
 * (shared/a11y/modalFocusHandoff.ts).
 *
 * Two placements share the one confirmation: the demo bar (`placement="bar"`, a quiet text button)
 * and the phone drawer (`placement="drawer"`, a full-width secondary button, its own testid).
 *
 * In the bar the button takes `margin-left: auto`, so it sits at the right end of whichever line it
 * wraps to (a spacer box let it fall to the left of line two). `shortLabel` is the visible label
 * below 600px (the bar’s one-line phone form shows “Reset”); the accessible name stays
 * “Reset demo data” at every width, and the visible label begins it (spec 01, Design › Bar).
 *
 * Design: design/src/screens/final/shell-site-front.mjs (shellStates, “Reset demo data · confirm”)
 * and shell-site-kit.mjs drawerF.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useId, useRef, useState } from 'react';

const NAME = 'Reset demo data';

export function ResetDemoControl({
  onReset,
  placement = 'bar',
  shortLabel,
}: {
  onReset: () => void;
  placement?: 'bar' | 'drawer';
  /** Visible label below 600px; the accessible name stays “Reset demo data”. */
  shortLabel?: string;
}) {
  const drawer = placement === 'drawer';
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  return (
    <>
      <Button
        ref={anchor}
        size={drawer ? 'medium' : 'small'}
        variant={drawer ? 'outlined' : 'text'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={shortLabel ? NAME : undefined}
        onClick={() => setOpen(true)}
        data-testid={drawer ? 'nav-drawer-reset' : 'demo-reset'}
        // Neutral in both placements (owner ruling A, 2026-10-15): the theme gives outlined and
        // text primary buttons a `text.primary` label; amber is the screen's one contained action.
        sx={
          drawer
            ? { minHeight: 44, justifyContent: 'flex-start' }
            : { minHeight: 44, ml: 'auto', flex: 'none' }
        }
      >
        {shortLabel ? (
          <>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              {shortLabel}
            </Box>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              {NAME}
            </Box>
          </>
        ) : (
          NAME
        )}
      </Button>
      <Popover
        open={open}
        anchorEl={anchor.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'alertdialog',
            'aria-labelledby': titleId,
            'aria-describedby': bodyId,
            sx: { p: 2, maxWidth: 'min(360px, calc(100vw - 32px))' },
          },
        }}
        data-testid="demo-reset-confirm"
      >
        <Typography id={titleId} component="h2" sx={{ fontSize: 14, fontWeight: 700, m: 0 }}>
          Reset the demo?
        </Typography>
        <Typography
          id={bodyId}
          component="p"
          sx={{ fontSize: 13, color: 'text.secondary', mt: 0.75, mb: 1.5 }}
        >
          Clears your demo positions, alerts and settings in this browser and puts the seed account
          back.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
            data-testid="demo-reset-confirm-yes"
            sx={{ minHeight: 44 }}
          >
            Reset demo data
          </Button>
          <Button
            variant="text"
            onClick={() => setOpen(false)}
            sx={{ minHeight: 44, color: 'text.primary' }}
          >
            Keep my changes
          </Button>
        </Box>
      </Popover>
    </>
  );
}
