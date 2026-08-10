import { Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** Uppercase caption label above a field (Figma label pattern; not a MUI floating InputLabel). */
export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <Typography
      component="label"
      htmlFor={htmlFor}
      sx={{
        display: 'block',
        mb: 0.5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'text.disabled',
      }}
    >
      {children}
    </Typography>
  );
}
