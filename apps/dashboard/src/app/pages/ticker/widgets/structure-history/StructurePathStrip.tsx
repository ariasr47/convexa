/**
 * Structure path strip — session slow-lane path embedded under Structure Field chrome.
 * Not a free-standing bento peer: history of structure, not a second GEX field.
 *
 * REPAIR TASK item 8 (`STRUCTURE_HERO_REPAIR_TASK.md`; `design/src/screens/desk.mjs:307-312`): loses
 * its own background and bottom border — a flat row with a top hairline, matching the tape row above
 * it. Every testid, and the empty/error/loading arms, are unchanged.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import type { StructureSample } from '@convexa/api';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
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
        sx={{
          fontSize: '0.6875rem',
          color: 'text.secondary',
          fontFamily: typographyTokens.monoFontFamily,
        }}
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
        px: 0.5,
        pt: 1,
        mt: 0.75,
        borderTop: 1,
        borderColor: 'divider',
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
        Structure path · slow lane
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
                    fontFamily: typographyTokens.monoFontFamily,
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
                    fontFamily: typographyTokens.monoFontFamily,
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
              color: 'text.secondary',
              fontFamily: typographyTokens.monoFontFamily,
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
          sx={{ m: 0, mt: 0.75, fontSize: '0.6875rem', color: 'text.secondary' }}
        >
          {basis}
        </Typography>
      ) : null}
    </Box>
  );
}
