/**
 * The keyboard shortcuts sheet, opened with `?` anywhere in the shell (or from the ⌘K footer).
 * A MUI Dialog: it traps focus, closes on Esc or its Close button, and focus returns to where it
 * was (shared/a11y/modalFocusHandoff.ts). Lists only bindings that exist.
 *
 * Design: design/src/screens/final/shell-site-front.mjs (shellStates, “Keyboard shortcuts”).
 */
import { typographyTokens } from '@/shared/theme/tokens';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardCommandKeyOutlined from '@mui/icons-material/KeyboardCommandKeyOutlined';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';

/** Read by screen readers, not drawn. Same clip-rect pattern as shared/figure/FigureMarks.tsx. */
const visuallyHidden = {
  position: 'absolute',
  // '1px' strings: in MUI sx a bare width/height <= 1 is a percentage (1 -> '100%').
  width: '1px',
  height: '1px',
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

function Kbd({ children }: { children: ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1px',
        minWidth: 22,
        justifyContent: 'center',
        px: 0.75,
        py: '1px',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: 'divider',
        fontFamily: typographyTokens.monoFontFamily,
        fontSize: 12,
        lineHeight: 1.5,
        color: 'text.primary',
      }}
    >
      {children}
    </Box>
  );
}

const sep = (text: string) => (
  <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, mx: 0.5 }}>
    {text}
  </Box>
);

const ROWS: { keys: ReactNode; does: string }[] = [
  {
    keys: (
      <>
        {/* The ⌘ icon is hidden and the word is spoken instead: an aria-label on a <kbd> is
            prohibited (axe aria-prohibited-attr) and was ignored, so screen readers read “K”. */}
        <Kbd>
          <Box component="span" sx={visuallyHidden}>
            Command{' '}
          </Box>
          <KeyboardCommandKeyOutlined sx={{ fontSize: 12 }} aria-hidden />K
        </Kbd>
        {sep('or')}
        <Kbd>Ctrl K</Kbd>
        {sep('or')}
        <Kbd>/</Kbd>
      </>
    ),
    does: 'Jump to a ticker or note',
  },
  {
    keys: (
      <>
        <Kbd>g</Kbd>
        {sep('then')}
        <Kbd>s</Kbd> <Kbd>t</Kbd> <Kbd>r</Kbd> <Kbd>p</Kbd> <Kbd>a</Kbd>
      </>
    ),
    does: 'Scanner · Ticker · Research · Positions · Alerts',
  },
  {
    keys: (
      <>
        <Kbd>j</Kbd> <Kbd>k</Kbd>
      </>
    ),
    does: 'Next · previous filing, in Research → Filings',
  },
  { keys: <Kbd>?</Kbd>, does: 'This sheet' },
  { keys: <Kbd>esc</Kbd>, does: 'Close a dialog or sheet' },
];

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby={titleId}
      data-testid="shortcuts-sheet"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 3,
          pt: 2,
          pb: 1,
        }}
      >
        <Typography id={titleId} component="h2" sx={{ fontSize: 17, fontWeight: 700, m: 0 }}>
          Keyboard shortcuts
        </Typography>
        <IconButton aria-label="Close keyboard shortcuts" onClick={onClose} sx={{ mr: -1 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          px: 3,
          pb: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, auto) minmax(0, 1fr)' },
          columnGap: 3,
          rowGap: { xs: 0.5, sm: 1.25 },
          alignItems: 'center',
        }}
      >
        {ROWS.map((row) => (
          <Box key={row.does} sx={{ display: 'contents' }}>
            <Box
              component="dt"
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.25,
                pt: { xs: 1, sm: 0 },
              }}
            >
              {row.keys}
            </Box>
            <Box component="dd" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
              {row.does}
            </Box>
          </Box>
        ))}
      </Box>
    </Dialog>
  );
}
