import { DIALOG_FILL_MODE_SINGLE_LEG_ONLY } from '@/features/trading/positions/labels';
import { demoDeskUrl } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { FillMode } from './types';

/** The reason on the control when the site runs no options feed (Final Overlays, DLG-01). */
export const FILL_MODE_FEED_OFF =
  'Market and Limit fill at a live quote, which needs the options feed. Manual price opens at your price: user-entered, not a market quote.';

export function FillModeToggle({
  value,
  singleOptionEntry,
  feedOff = false,
  ticker = 'SPY',
  onChange,
}: {
  value: FillMode;
  singleOptionEntry: boolean;
  /** No options feed on this site: only Manual price can fill. */
  feedOff?: boolean;
  /** For the demo link, the same desk on the demo. */
  ticker?: string;
  onChange: (next: FillMode) => void;
}) {
  const quoteModes = singleOptionEntry && !feedOff;
  const refusal = feedOff ? FILL_MODE_FEED_OFF : DIALOG_FILL_MODE_SINGLE_LEG_ONLY;
  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        onChange={(_, v) => v && quoteModes && onChange(v)}
        fullWidth
        aria-label="fill mode"
      >
        <ToggleButton value="manual">Manual price</ToggleButton>
        <ToggleButton
          value="market"
          aria-disabled={!quoteModes}
          title={quoteModes ? undefined : refusal}
        >
          Market
        </ToggleButton>
        <ToggleButton
          value="limit"
          aria-disabled={!quoteModes}
          title={quoteModes ? undefined : refusal}
        >
          Limit
        </ToggleButton>
      </ToggleButtonGroup>
      {feedOff ? (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: 12 }}
          data-testid="entry-fill-mode-note"
        >
          {FILL_MODE_FEED_OFF} On the demo, all three fill modes work against the sample chain.{' '}
          <Link
            href={demoDeskUrl(ticker)}
            underline="always"
            data-testid="entry-fill-mode-demo"
            sx={{ color: (t) => extrasFor(t).textInfo, fontWeight: 600 }}
          >
            See it on the demo →
          </Link>
        </Typography>
      ) : (
        !singleOptionEntry && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            data-testid="entry-fill-mode-note"
          >
            {DIALOG_FILL_MODE_SINGLE_LEG_ONLY}
          </Typography>
        )
      )}
    </Box>
  );
}
