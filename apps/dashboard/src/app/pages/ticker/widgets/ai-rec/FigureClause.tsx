/**
 * FigureClause — the per-figure grounding clause, rendered directly beneath the value it qualifies, on
 * the exit stop, the exit target and the invalidation level ONLY. Always a quiet caption: no icon, no
 * chip, no border, no tint. Selected by the wire `basis` token alone (AC-3).
 *
 * An untraced value NEVER renders identically to a traced one: `the AI's own number` is in VISIBLE TEXT
 * beneath it (never colour alone, never tooltip alone — tooltips are unreachable on touch).
 */
import type { GroundingField } from '@convexa/api';
import { Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import {
  COULD_NOT_CHECK_LINE,
  couldNotCheckTip,
  insideRangeLine,
  nearLine,
  tracesToLine,
  UNTRACED_LINE,
  UNTRACED_TIP,
} from './copy';
import { figureClause } from './literals';

export function FigureClause({
  field,
  testId,
}: {
  field: GroundingField | null | undefined;
  testId: string;
}) {
  const c = figureClause(field);
  if (c.kind === 'none') return null;
  const caption = (text: string, tip?: string): ReactNode => {
    const el = (
      <Typography
        variant="caption"
        data-testid={testId}
        data-clause={c.kind}
        sx={{ color: 'text.secondary', display: 'block' }}
      >
        {text}
      </Typography>
    );
    return tip ? (
      <Tooltip arrow title={tip}>
        {el}
      </Tooltip>
    ) : (
      el
    );
  };
  switch (c.kind) {
    case 'exact':
      return caption(tracesToLine(c.anchor, c.value));
    case 'near':
      return caption(nearLine(c.anchor, c.value));
    case 'inside_range':
      return caption(insideRangeLine(c.expiration, c.low, c.high));
    case 'untraced':
      return caption(UNTRACED_LINE, UNTRACED_TIP);
    case 'not_checkable':
      return caption(COULD_NOT_CHECK_LINE, couldNotCheckTip(c.clause));
    default:
      return null;
  }
}
