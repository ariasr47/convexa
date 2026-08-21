/**
 * TermStructureCard — ATM IV by tenor as Term Heat (structure clock).
 * Cross-tenor; ignores DTE filter; static bundle field, never offline-dimmed.
 */
import { Widget } from '@/shared/ui/Widget';
import type { TermStructure } from '@convexa/api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import { sampleTermPoints, termTip, withStructureAge } from '../_kit/copy';
import { TermHeatChart } from './TermHeatChart';

interface Props {
  termStructure: TermStructure | null;
  structureAgeSeconds?: number | null;
}

export const TermStructureCard = memo(function TermStructureCard({
  termStructure,
  structureAgeSeconds = null,
}: Props) {
  const termSampled = termStructure ? sampleTermPoints(termStructure.points) : [];
  const unavailable = termStructure == null || termSampled.length === 0;

  const stateLabel =
    unavailable || !termStructure || termStructure.points.length < 2 ? '—' : termStructure.state;
  const subtitle = withStructureAge(`ATM IV by tenor · ${stateLabel}`, structureAgeSeconds);

  return (
    <Widget
      id="term-structure"
      title="Term structure"
      subtitle={subtitle}
      info={termStructure ? termTip(termStructure) : undefined}
      bodySx={{ display: 'flex', flexDirection: 'column', flex: 1 }}
      bodyPad={unavailable ? 'default' : 'none'}
    >
      <Box
        data-testid="term-structure"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 160,
          px: unavailable ? 0 : 0,
        }}
      >
        {unavailable || !termStructure ? (
          <Typography variant="body2" sx={{ color: 'text.disabled', p: 2 }}>
            Term structure unavailable this cycle.
          </Typography>
        ) : (
          <TermHeatChart points={termSampled} state={termStructure.state} height={168} />
        )}
      </Box>
    </Widget>
  );
});

export default TermStructureCard;
