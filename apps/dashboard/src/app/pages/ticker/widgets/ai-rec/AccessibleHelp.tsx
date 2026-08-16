import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { IconButton, Tooltip } from '@mui/material';

/** Keyboard and pointer reachable help trigger used by the decision card. */
export function AccessibleHelp({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip arrow title={text} describeChild>
      <IconButton size="small" aria-label={label} sx={{ p: 0.5 }}>
        <InfoOutlinedIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
