/**
 * Refused — signed-out (or otherwise blocked) write affordance.
 *
 * Visibly disabled look, still focusable, carries an honest reason. Never a silent no-op button.
 * Pair with `useGate` for the actual write path.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface RefusedProps {
  /** Short label that would have been the live action (e.g. "Simulate this trade"). */
  actionLabel: string;
  /** Why the action is refused — shown as supporting text. */
  reason: string;
  /** Primary recovery: open sign-in. */
  onSignIn?: () => void;
  /** Optional secondary (dismiss). */
  onDismiss?: () => void;
  /** Extra content (e.g. icon). */
  children?: ReactNode;
  testId?: string;
}

export function Refused({
  actionLabel,
  reason,
  onSignIn,
  onDismiss,
  children,
  testId = 'refused-affordance',
}: RefusedProps) {
  return (
    <Box
      role="group"
      aria-label={`${actionLabel} unavailable`}
      data-testid={testId}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      {children}
      <Box sx={{ flex: '1 1 12rem', minWidth: 0 }}>
        <Typography
          component="p"
          variant="body2"
          sx={{ m: 0, fontWeight: 600, color: 'text.secondary' }}
        >
          {actionLabel}
        </Typography>
        <Typography
          component="p"
          variant="caption"
          data-testid={`${testId}-reason`}
          sx={{ m: 0, color: 'text.secondary', display: 'block', lineHeight: 1.4 }}
        >
          {reason}
        </Typography>
      </Box>
      {onSignIn ? (
        <Button
          size="small"
          variant="contained"
          onClick={onSignIn}
          data-testid={`${testId}-sign-in`}
          sx={{ minHeight: 40 }}
        >
          Sign in
        </Button>
      ) : null}
      {onDismiss ? (
        <Button
          size="small"
          variant="text"
          onClick={onDismiss}
          data-testid={`${testId}-dismiss`}
          sx={{ minHeight: 40 }}
        >
          Dismiss
        </Button>
      ) : null}
    </Box>
  );
}

export default Refused;
