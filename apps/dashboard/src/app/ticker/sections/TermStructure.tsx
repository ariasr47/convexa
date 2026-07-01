/**
 * TermStructureCard — the ATM-IV-by-tenor mini card (Figma `Ticker · Term Structure`, node 149:597):
 * card header (title + "ATM IV by tenor · {state}") over a cyan (info) line chart with nominal tenor
 * labels (1w/1m/3m…). Cross-tenor — ignores the DTE filter; static bundle field, never offline-dimmed.
 * Sampled to nominal tenors; absent buckets omitted. Shown side-by-side with the AI-rec card.
 */
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip } from 'recharts';
import type { TermStructure } from '@org/api';
import { sampleTermPoints, termTip } from './copy';
import { typographyTokens } from '../../tokens';
import { Widget } from './Widget';

const MONO = typographyTokens.monoFontFamily;
// Map an actual DTE to the nearest nominal tenor label (the Figma axis: 1w · 1m · 3m · 6m · 9m …).
const TENORS: [number, string][] = [[7, '1w'], [14, '2w'], [30, '1m'], [60, '2m'], [90, '3m'], [180, '6m'], [270, '9m'], [365, '1y']];
const tenorLabel = (dte: number) => TENORS.reduce((b, t) => (Math.abs(t[0] - dte) < Math.abs(b[0] - dte) ? t : b), TENORS[0])[1];

interface Props {
  termStructure: TermStructure | null;
}

export function TermStructureCard({ termStructure }: Props) {
  const theme = useTheme();
  const termSampled = termStructure ? sampleTermPoints(termStructure.points) : [];
  const unavailable = termStructure == null || termSampled.length === 0;

  const TermPointTooltip = ({ active, payload }:
    { active?: boolean; payload?: { payload: { dte: number; expiration: string; atm_iv: number } }[] }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <Box sx={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 1.25, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{p.dte}d · {p.expiration}</Typography>
        <Typography variant="body2">ATM IV {p.atm_iv.toFixed(1)}%</Typography>
      </Box>
    );
  };

  const subtitle = `ATM IV by tenor · ${unavailable || termStructure.points.length < 2 ? '—' : termStructure.state}`;

  return (
    <Widget
      id="term-structure" title="Term structure" subtitle={subtitle}
      info={termStructure ? termTip(termStructure) : undefined}
      bodySx={{ display: 'flex', flexDirection: 'column', flex: 1 }}
    >
      <Box data-testid="term-structure" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 160 }}>
        {unavailable ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>Term structure unavailable this cycle.</Typography>
        ) : (
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={termSampled} margin={{ top: 10, right: 20, bottom: 4, left: 0 }}>
                <XAxis dataKey="dte" tickFormatter={tenorLabel}
                  tick={{ fontSize: 10, fill: theme.palette.text.disabled, fontFamily: MONO }} stroke={theme.palette.divider} />
                <YAxis width={42} tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }} stroke={theme.palette.divider} domain={['auto', 'auto']} />
                <RTooltip cursor={{ stroke: theme.palette.divider }} content={<TermPointTooltip />} />
                <Line type="monotone" dataKey="atm_iv" stroke={theme.palette.info.main}
                  strokeWidth={2} dot={{ r: 3, fill: theme.palette.info.main }} activeDot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Box>
    </Widget>
  );
}

export default TermStructureCard;
