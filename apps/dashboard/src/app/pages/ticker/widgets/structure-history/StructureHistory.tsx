/**
 * Structure history — session path of slow-lane structure recomputes.
 *
 * Static (structure) surface: never dims with the live stream. Samples land only when the
 * scanner slow lane finishes a structure recompute (thinned ≥5m server-side). Empty = honest
 * cold-start, not an error. Neutral type only — score/flip path is NOT P/L direction.
 *
 * `[live-vs-static-isolation]` · `[model-read-carries-its-assumptions]` · type floor ≥11px.
 */
import { Widget } from '@/shared/ui/Widget';
import { Box, Skeleton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { StructureSample } from '@org/api';
import { useMemo } from 'react';
import { humanAge } from '../_kit';
import { fmtPathDelta, sparkPoints, summarizePath } from './historyMath';

const SPARK_W = 120;
const SPARK_H = 28;

export interface StructureHistoryProps {
  symbol: string;
  samples: StructureSample[] | null;
  /** Server basis string when present. */
  basis?: string | null;
  loading?: boolean;
  /** Transport fault after no samples — soft; empty cold-start is separate. */
  error?: string | null;
}

function Spark({
  samples,
  series,
  label,
  testid,
}: {
  samples: StructureSample[];
  series: 'score' | 'dist_to_flip_pct';
  label: string;
  testid: string;
}) {
  const theme = useTheme();
  const points = useMemo(
    () =>
      sparkPoints(
        samples,
        series === 'score' ? (s) => s.score : (s) => s.dist_to_flip_pct,
        SPARK_W,
        SPARK_H,
      ),
    [samples, series],
  );
  if (!points) {
    return (
      <Typography
        component="span"
        data-testid={`${testid}-empty`}
        sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontFamily: 'var(--font-mono)' }}
      >
        —
      </Typography>
    );
  }
  return (
    <Box
      component="svg"
      data-testid={testid}
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      aria-label={label}
      sx={{ display: 'block', flexShrink: 0 }}
    >
      <polyline
        fill="none"
        stroke={theme.palette.text.secondary}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </Box>
  );
}

export function StructureHistory({
  symbol,
  samples,
  basis = null,
  loading = false,
  error = null,
}: StructureHistoryProps) {
  const path = samples ? summarizePath(samples) : null;
  const windowAge =
    path && path.n >= 2 ? humanAge(Math.max(0, path.lastAsOf - path.firstAsOf)) : null;

  return (
    <Widget
      id="structure-history"
      title="Structure path"
      subtitle="Slow-lane samples · session path, not live ticks"
      span={2}
      bodyVariant="inset"
    >
      <Box data-testid="structure-history" data-symbol={symbol.toUpperCase()}>
        {loading && samples == null ? (
          <Skeleton variant="rounded" height={48} data-testid="structure-history-skeleton" />
        ) : null}

        {error && (samples == null || samples.length === 0) ? (
          <Typography
            component="p"
            data-testid="structure-history-error"
            sx={{ m: 0, fontSize: '0.75rem', color: 'text.secondary' }}
          >
            {error}
          </Typography>
        ) : null}

        {!loading && !error && (samples == null || samples.length === 0) ? (
          <Typography
            component="p"
            data-testid="structure-history-empty"
            sx={{ m: 0, fontSize: '0.75rem', color: 'text.secondary' }}
          >
            Building history — samples land after each structure recompute (thinned to ≥5 min).
          </Typography>
        ) : null}

        {samples && samples.length > 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 2,
              rowGap: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="p"
                sx={{
                  m: 0,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Score path
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Spark
                  samples={samples}
                  series="score"
                  label="Score over structure samples"
                  testid="structure-history-score-spark"
                />
                {path?.scoreDelta != null ? (
                  <Typography
                    component="span"
                    data-testid="structure-history-score-delta"
                    sx={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtPathDelta(path.scoreDelta)}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="p"
                sx={{
                  m: 0,
                  fontSize: '0.6875rem',
                  color: 'text.secondary',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Dist to flip
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Spark
                  samples={samples}
                  series="dist_to_flip_pct"
                  label="Distance to flip over structure samples"
                  testid="structure-history-flipdist-spark"
                />
                {path?.flipDistDelta != null ? (
                  <Typography
                    component="span"
                    data-testid="structure-history-flipdist-delta"
                    sx={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtPathDelta(path.flipDistDelta, 1)}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Typography
              component="p"
              data-testid="structure-history-meta"
              sx={{
                m: 0,
                ml: { md: 'auto' },
                fontSize: '0.6875rem',
                color: 'text.disabled',
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {path?.n ?? samples.length} sample{path && path.n === 1 ? '' : 's'}
              {windowAge ? ` · ${windowAge} window` : ''}
            </Typography>
          </Box>
        ) : null}

        {basis ? (
          <Typography
            component="p"
            data-testid="structure-history-basis"
            sx={{ m: 0, mt: 1.25, fontSize: '0.6875rem', color: 'text.disabled' }}
          >
            {basis}
          </Typography>
        ) : null}
      </Box>
    </Widget>
  );
}
