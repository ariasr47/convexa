/**
 * ComingSoonCard — an honest "coming soon" card (ARCHITECTURE §2.2, `[no-real-order-path]`). Composes
 * the inert `ComingSoonBox` (hatch + dashed `divider` border) with a muted 40px icon square, a title
 * row carrying an amber "coming soon" badge, a secondary body, and a caller-supplied `action` slot.
 *
 * The box itself never navigates (structural inertness — that's `ComingSoonBox`'s contract); any
 * affordance lives in `action` and is the caller's responsibility (e.g. a non-navigating waitlist
 * toast button, or a link to an honest placeholder page). Pure presentation: no data, no fetch.
 */
import { Box, Chip, Stack, Typography } from '@mui/material';
import { ComingSoonBox } from './ComingSoonBox';

/** Small amber "coming soon" badge (pill). Exported for reuse / direct assertion. */
export function ComingSoonBadge() {
  return (
    <Chip
      size="small"
      variant="outlined"
      label="coming soon"
      sx={{ color: 'warning.main', borderColor: 'warning.main', borderRadius: 999 }}
    />
  );
}

/** A muted 40px icon square — same shape as the ValueCard icon, but a neutral/inert tone (not the
 *  active primary tint) so it reads as not-yet-available. */
function ComingSoonIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1.5,
        mb: 1.5,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(255, 255, 255, 0.06)',
        color: 'text.secondary',
      }}
    >
      {icon}
    </Box>
  );
}

export interface ComingSoonCardProps {
  /** A `@mui/icons-material` glyph (or any node) for the muted square. */
  icon: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  /** The (caller-owned) affordance: a non-navigating button, an honest-placeholder link, etc. */
  action?: React.ReactNode;
  /** Wrapper test id (callers tag each card distinctly, e.g. `brokerage-block`). */
  testId?: string;
}

export function ComingSoonCard({ icon, title, body, action, testId }: ComingSoonCardProps) {
  return (
    <ComingSoonBox data-testid={testId}>
      <ComingSoonIcon icon={icon} />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        <ComingSoonBadge />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {body}
      </Typography>
      {action}
    </ComingSoonBox>
  );
}

export default ComingSoonCard;
