/**
 * The Technical analysis tab on the live site. Indicators need daily bars from a market-data feed;
 * the live build has none (market data is paused, and no daily-bar provider exists yet), so this
 * states that once, without a retry, and points at what does work: research and the full demo.
 */
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

export function TechnicalAnalysisOff({ symbol }: { symbol: string }) {
  const ticker = symbol.toUpperCase();
  const path = `/ticker/${encodeURIComponent(ticker)}`;
  return (
    <Stack spacing={2}>
      <Typography component="h1" variant="overline" color="text.secondary">
        Technical analysis · {ticker}
      </Typography>
      <Alert severity="info" icon={<PauseCircleOutlinedIcon />} role="status">
        <AlertTitle>Technical analysis isn’t available on the live site.</AlertTitle>
        <Typography variant="body2">
          It needs daily price bars from a market-data feed, and live market data is off. The full
          demo shows it with sample data.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1, rowGap: 0.5, flexWrap: 'wrap' }}>
          <Link
            component={RouterLink}
            to={`${path}/research`}
            variant="body2"
            underline="always"
            sx={linkSx}
          >
            Read {ticker} research →
          </Link>
          <Link href={STAGING_DEMO_URL} variant="body2" underline="always" sx={linkSx}>
            Try the full demo →
          </Link>
          <Link component={RouterLink} to={path} variant="body2" underline="always" sx={linkSx}>
            Back to the overview
          </Link>
        </Stack>
      </Alert>
    </Stack>
  );
}
