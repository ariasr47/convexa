/**
 * GroundingNote — the ONE card-level grounding line (SPEC §4). Renders by CLOSED LOOKUP on the server
 * token via `cardGroundingLine`; the browser never counts, compares or folds. The only client-selected
 * branch is block ABSENCE. Sits below the verdict hero and above the risk tile, nowhere else.
 *
 * Chrome: only the unhappy members carry `warning.*` + icon — per-figure clauses are always quiet
 * captions, because four warning icons per card become wallpaper inside a week, which makes the honest
 * marker LESS honest.
 */
import { AccessibleHelp } from '@/shared/ui';
import type { Grounding } from '@convexa/api';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { cardGroundingLine } from './literals';

export function GroundingNote({ grounding }: { grounding: Grounding | null | undefined }) {
  const line = cardGroundingLine(grounding);
  if (line.kind === 'none') return null;
  const warn = line.kind === 'warning';
  return (
    <Stack
      direction="row"
      spacing={0.5}
      data-testid="grounding-card-line"
      data-member={grounding?.card ?? 'block_absent'}
      sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 0.5 }}
    >
      {warn && <WarningAmberIcon aria-hidden color="warning" sx={{ fontSize: 16 }} />}
      <Typography variant="caption" sx={{ color: warn ? 'warning.main' : 'text.secondary' }}>
        {line.text}
      </Typography>
      {line.tip && <AccessibleHelp label="Evidence help" text={line.tip} />}
    </Stack>
  );
}
