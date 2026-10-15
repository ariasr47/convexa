/**
 * Staging only: “Reset demo data” asks in place before it clears this browser's demo changes, then
 * `onReset` (resetDemoWorkspace) reloads on the seed account. A Popover under the button: it takes
 * focus, closes on Esc or “Keep my changes”, and focus returns to the button
 * (shared/a11y/modalFocusHandoff.ts).
 *
 * Two placements share the one confirmation: the demo bar (`placement="bar"`, a quiet text button)
 * and the phone drawer (`placement="drawer"`, a full-width secondary button, its own testid).
 *
 * Design: design/src/screens/final/shell-site-front.mjs (shellStates, “Reset demo data · confirm”)
 * and shell-site-kit.mjs drawerF.
 */
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useId, useRef, useState } from 'react';

export function ResetDemoControl({
  onReset,
  placement = 'bar',
}: {
  onReset: () => void;
  placement?: 'bar' | 'drawer';
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
        onClick={() => setOpen(true)}
        data-testid={drawer ? 'nav-drawer-reset' : 'demo-reset'}
        sx={(theme) =>
          drawer
            ? {
                minHeight: 44,
                justifyContent: 'flex-start',
                color: 'text.primary',
                borderColor: 'divider',
              }
            : { minHeight: 44, color: extrasFor(theme).textAmber }
        }
      >
        Reset demo data
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
