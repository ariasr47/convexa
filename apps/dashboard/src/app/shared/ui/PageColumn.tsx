import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/** The standard page column: centred, max 1160px, with the side gutter phones need (Alerts' layout). */
export function PageColumn({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        maxWidth: 1160,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: { xs: 2, md: 4 },
        pb: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </Box>
  );
}
