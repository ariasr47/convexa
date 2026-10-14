/**
 * Live builds only: a slim, persistent notice while the server reports `market_data` as `not_live`
 * (no paid feed exists, canon P-1) or `paused` (an operator paused one) (GET /api/health). The live counterpart of the demo provenance bar — it states a standing fact,
 * claims no liveness (rule 18's connection chip is untouched), and points at what still works.
 * It disappears on its own once the server runs with live data again.
 */
import { marketDataOff, NOT_LIVE_COPY, PAUSED_COPY } from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

export function MarketDataNotice() {
  const mode = useMarketDataMode();
  if (!marketDataOff(mode)) return null;
  const copy = mode === 'not_live' ? NOT_LIVE_COPY : PAUSED_COPY;
  return (
    <Box
      role="status"
      aria-label="Market data status"
      data-testid="market-data-notice"
      sx={{
        px: { xs: 2, md: 3 },
        py: 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 0.25, sm: 1 }}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', rowGap: 0.5 }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {copy.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {copy.body}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={2}>
          <Link
            component={RouterLink}
            to="/research"
            variant="caption"
            underline="always"
            sx={linkSx}
          >
            Read research
          </Link>
          <Link href={STAGING_DEMO_URL} variant="caption" underline="always" sx={linkSx}>
            Try the full demo →
          </Link>
        </Stack>
      </Stack>
    </Box>
  );
}
