/**
 * ValueCard — the Landing "what works today" value card (ARCHITECTURE §2.2,
 * FRONTEND_EXECUTION_CONTRACT F2). Pure presentation: a tinted 40px rounded-square icon + title (700)
 * + secondary body + a primary text-link CTA. NO fetch, NO store, NO global state.
 *
 * `icon` is a `@mui/icons-material` glyph supplied by the caller (README §Assets:
 * `BarChart`/`AccountBalanceWallet`/`AutoAwesome`/`Lock`/`Radar`). `to` is the CTA route; the CTA is
 * the ONLY navigating element (the card body does not link).
 */
import { elevationFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';

export interface ValueCardProps {
  /** A `@mui/icons-material` element (or any node) rendered in the tinted 40px square. */
  icon: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  /** CTA destination route. */
  to: string;
  ctaLabel: React.ReactNode;
  /** Optional override for the card wrapper test id (callers tag each card distinctly). */
  testId?: string;
  /** Optional override for the CTA link test id. */
  ctaTestId?: string;
  /** Heading element for the title (redesign-stage-2 §6.2 — the landing outline wants `h3`;
   *  `variant="h6"` STYLING is unchanged). */
  titleComponent?: React.ElementType;
}

export function ValueCard({
  icon,
  title,
  body,
  to,
  ctaLabel,
  testId = 'value-card',
  ctaTestId = 'value-card-cta',
  titleComponent = 'h3',
}: ValueCardProps) {
  return (
    <Card
      variant="outlined"
      data-testid={testId}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        height: '100%',
        // Resting elevation (e1): a real panel on the canvas, not a flat cutout.
        boxShadow: (theme) => elevationFor(theme).e1,
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
        // High-tech accent line that wipes in along the top edge on hover.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          // Stage-1 rebind (§3.3-2): violet retired — the accent line is brand amber only
          // (primary.main → primary.dark, both theme slots; no new hue).
          background: (theme) =>
            `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 260ms ease',
        },
        // (redesign-stage-2 §6.3 — the named remove-one-accessory cut: the `::after` hover
        // radial light-bleed is GONE. Same generic radial-glow vocabulary the stage removes from
        // the hero; the card keeps its lift, top-edge wipe, border accent, icon scale, CTA nudge.)
        // Hover lift (e2): neutral depth carries the elevation; the primary border + a faint brand
        // bleed are the accent rim (was a pure colored glow — reads more premium as neutral+rim).
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'primary.main',
          boxShadow: (theme) =>
            `${elevationFor(theme).e2}, 0 10px 30px -18px ${alpha(theme.palette.primary.main, 0.3)}`,
        },
        '&:hover::before': { transform: 'scaleX(1)' },
        '&:hover [data-testid="value-card-icon"]': {
          transform: 'scale(1.08)',
          boxShadow: (theme) =>
            `0 0 0 1px ${alpha(theme.palette.primary.main, 0.45)}, 0 0 22px -4px ${alpha(theme.palette.primary.main, 0.55)}`,
        },
        '&:hover [data-testid="value-card-cta"]': { transform: 'translateX(3px)' },
        // Respect reduced-motion: keep the color/glow cues, drop the movement.
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          '&:hover': { transform: 'none' },
          '&:hover [data-testid="value-card-icon"]': { transform: 'none' },
          '&:hover [data-testid="value-card-cta"]': { transform: 'none' },
          '&::before': { transition: 'none' },
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <Box
            data-testid="value-card-icon"
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              // Stage-1 rebind (§3.3-2): icon tint = alpha(primary) only (violet retired).
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.primary.main, 0.08)})`,
              color: 'primary.main',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 200ms ease, box-shadow 200ms ease',
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" component={titleComponent} sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
            {body}
          </Typography>
          <Box>
            <Link
              component={RouterLink}
              to={to}
              underline="hover"
              data-testid={ctaTestId}
              sx={{ fontWeight: 600, display: 'inline-block', transition: 'transform 200ms ease' }}
            >
              {ctaLabel}
            </Link>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default ValueCard;
