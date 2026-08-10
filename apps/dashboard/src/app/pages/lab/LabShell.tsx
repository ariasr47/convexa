/**
 * Shared chrome for individual lab demo pages — back link, title, candidate chip.
 */
import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export function LabShell({
  title,
  tagline,
  tickerCandidate,
  testId,
  children,
  actions,
}: {
  title: string;
  tagline: string;
  tickerCandidate: string;
  testId: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box data-testid={testId} sx={{ minHeight: '70vh', bgcolor: 'background.default', pb: 6 }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5} sx={{ mb: 2.5, maxWidth: 760 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip label="Lab" size="small" color="primary" variant="outlined" />
            <Chip label="Ticker candidate" size="small" variant="outlined" />
          </Stack>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
            {tagline}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Could land on:</strong> {tickerCandidate}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ pt: 0.5 }}>
            <Button component={RouterLink} to="/lab" variant="outlined" size="small">
              All demos
            </Button>
            <Button component={RouterLink} to="/ticker/SPY" variant="text" size="small">
              Open SPY ticker
            </Button>
            {actions}
          </Stack>
        </Stack>
        {children}
      </Container>
    </Box>
  );
}
