import { DIALOG_FILL_MODE_SINGLE_LEG_ONLY } from '@/features/trading/positions/labels';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { FillMode } from './types';

export function FillModeToggle({
  value,
  singleOptionEntry,
  onChange,
}: {
  value: FillMode;
  singleOptionEntry: boolean;
  onChange: (next: FillMode) => void;
}) {
  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        onChange={(_, v) => v && singleOptionEntry && onChange(v)}
        fullWidth
        aria-label="fill mode"
      >
        <ToggleButton value="manual">Manual price</ToggleButton>
        <ToggleButton
          value="market"
          aria-disabled={!singleOptionEntry}
          title={singleOptionEntry ? undefined : DIALOG_FILL_MODE_SINGLE_LEG_ONLY}
        >
          Market
        </ToggleButton>
        <ToggleButton
          value="limit"
          aria-disabled={!singleOptionEntry}
          title={singleOptionEntry ? undefined : DIALOG_FILL_MODE_SINGLE_LEG_ONLY}
        >
          Limit
        </ToggleButton>
      </ToggleButtonGroup>
      {!singleOptionEntry && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
          data-testid="entry-fill-mode-note"
        >
          {DIALOG_FILL_MODE_SINGLE_LEG_ONLY}
        </Typography>
      )}
    </Box>
  );
}
