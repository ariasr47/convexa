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
import { Link as RouterLink } from 'react-router-dom';
import { palette, extras } from '../tokens';

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
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
        // High-tech accent line that wipes in along the top edge on hover.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, ${palette.dark.primary}, ${extras.accentViolet})`,
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 260ms ease',
        },
        // Soft primary light-bleed from the top-right corner on hover.
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(140px 140px at 88% -12%, rgba(79, 156, 255, 0.18), transparent 70%)',
          opacity: 0,
          transition: 'opacity 260ms ease',
          pointerEvents: 'none',
        },
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'primary.main',
          boxShadow: '0 12px 34px -12px rgba(79, 156, 255, 0.45)',
        },
        '&:hover::before': { transform: 'scaleX(1)' },
        '&:hover::after': { opacity: 1 },
        '&:hover [data-testid="value-card-icon"]': {
          transform: 'scale(1.08)',
          boxShadow: '0 0 0 1px rgba(79, 156, 255, 0.45), 0 0 22px -4px rgba(79, 156, 255, 0.55)',
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
              background:
                'linear-gradient(135deg, rgba(79, 156, 255, 0.18), rgba(123, 92, 255, 0.12))',
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
