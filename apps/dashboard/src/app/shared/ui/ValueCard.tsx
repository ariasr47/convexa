/**
 * ValueCard — the Landing "what works today" value card (ARCHITECTURE §2.2,
 * FRONTEND_EXECUTION_CONTRACT F2). Pure presentation: a tinted 40px rounded-square icon + title (700)
 * + secondary body + a primary text-link CTA. NO fetch, NO store, NO global state.
 *
 * `icon` is a `@mui/icons-material` glyph supplied by the caller (README §Assets:
 * `BarChart`/`AccountBalanceWallet`/`AutoAwesome`/`Lock`/`Radar`). `to` is the CTA route; the CTA is
 * the ONLY navigating element (the card body does not link).
 */
import { Box, Card, CardContent, Link, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { elevationFor, extrasFor } from '@/shared/theme/tokens';

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
}

export function ValueCard({
  icon,
  title,
  body,
  to,
  ctaLabel,
  testId = 'value-card',
  ctaTestId = 'value-card-cta',
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
          background: (theme) =>
            `linear-gradient(90deg, ${theme.palette.primary.main}, ${extrasFor(theme).accentViolet})`,
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 260ms ease',
        },
        // Soft primary light-bleed from the top-right corner on hover.
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: (theme) =>
            `radial-gradient(140px 140px at 88% -12%, ${alpha(theme.palette.primary.main, 0.18)}, transparent 70%)`,
          opacity: 0,
          transition: 'opacity 260ms ease',
          pointerEvents: 'none',
        },
        // Hover lift (e2): neutral depth carries the elevation; the primary border + a faint brand
        // bleed are the accent rim (was a pure colored glow — reads more premium as neutral+rim).
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'primary.main',
          boxShadow: (theme) =>
            `${elevationFor(theme).e2}, 0 10px 30px -18px ${alpha(theme.palette.primary.main, 0.3)}`,
        },
        '&:hover::before': { transform: 'scaleX(1)' },
        '&:hover::after': { opacity: 1 },
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
          '&::before, &::after': { transition: 'none' },
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
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(extrasFor(theme).accentViolet, 0.12)})`,
              color: 'primary.main',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 200ms ease, box-shadow 200ms ease',
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
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
