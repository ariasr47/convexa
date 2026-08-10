/**
 * Structure path strip — session slow-lane path embedded under Structure Field chrome.
 * Not a free-standing bento peer: history of structure, not a second GEX field.
 */
import type { StructureSample } from '@convexa/api';
import { Box, Skeleton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { humanAge } from '../_kit';
import { fmtPathDelta, sparkPoints, summarizePath } from './historyMath';

const SPARK_W = 96;
const SPARK_H = 22;

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

export interface StructurePathStripProps {
  symbol: string;
  samples: StructureSample[] | null;
  loading?: boolean;
  error?: string | null;
  basis?: string | null;
}

/** Compact path strip for the GEX widget header region. */
export function StructurePathStrip({
  symbol,
  samples,
  loading = false,
  error = null,
  basis = null,
}: StructurePathStripProps) {
  const path = samples ? summarizePath(samples) : null;
  const windowAge =
    path && path.n >= 2 ? humanAge(Math.max(0, path.lastAsOf - path.firstAsOf)) : null;

  return (
    <Box
      data-testid="structure-history"
      data-symbol={symbol.toUpperCase()}
      sx={{
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.03)'),
      }}
    >
      <Typography
        component="p"
        sx={{
          m: 0,
          mb: 0.75,
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        Structure path · session slow-lane · not live ticks
      </Typography>

      {loading && samples == null ? (
        <Skeleton variant="rounded" height={28} data-testid="structure-history-skeleton" />
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
          sx={{ m: 0, fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.45 }}
        >
          Cold start — path empty until the scanner slow lane recomputes structure for{' '}
          {symbol.toUpperCase()}.
        </Typography>
      ) : null}

      {samples && samples.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
            rowGap: 1,
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
              Score
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
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
          sx={{ m: 0, mt: 0.75, fontSize: '0.6875rem', color: 'text.disabled' }}
        >
          {basis}
        </Typography>
      ) : null}
    </Box>
  );
}
