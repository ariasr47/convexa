/**
 * ScoreStripSample — a landing-local composition over `shared/figure` and the shared ChartFrame. Its
 * CTA-shaped elements are non-focusable presentational nodes: a picture of a control never enters the
 * tab order.
 *
 * FLIP_DISTANCE_LABEL is DERIVED AT MODULE LOAD from `samples.ts`, never hand-typed: the design's own
 * artboard prints this sample distance as `−0.81%` (`landing.mjs:88`) and `−0.8%` (`landing.mjs:65`),
 * and the first is not what the shipped formatter produces from those constants. The projection is a
 * MIRROR of `pages/ticker/widgets/_kit/distanceToLevel.ts`'s `distancePercentOnly` — no ticker file may
 * be edited by this feature, and a page may not import a sibling page — keep the two equal by hand
 * (SPEC §7 item 14).
 *
 * No ring gauge and no `<svg>` in this file.
 *
 * The frame is the sample provenance (P-3, P-8): dashed, with the hatch stripe. Production tags it
 * "Illustrative sample" and carries the shared `SAMPLE_MARK`; staging carries the demo's dashed chip in
 * its place (Env 2026-10-14). The sample's tier is marked by outline and weight, not amber (P-6, amber
 * spent), and no figure here is amber.
 */
import { ChartFrame } from '@/shared/charts/frame';
import { MONO_FACE, SANS_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import { LANDING_COPY } from './copy';
import { LANDING_SAMPLE, SAMPLE_MARK } from './samples';

/** The mirrored projection (see the docblock). Signed percentage only, one decimal, figure minus. */
function percentOnly(level: number, spot: number): string {
  const delta = level - spot;
  if (Math.abs(delta) < 1e-9) return 'at spot';
  const abs = Math.abs(delta);
  const pct = (abs / Math.abs(spot)) * 100;
  return `${delta > 0 ? '+' : '−'}${pct.toFixed(1)}%`;
}

export const FLIP_DISTANCE_LABEL = percentOnly(LANDING_SAMPLE.gammaFlip, LANDING_SAMPLE.spot);

const TIERS = ['Dormant', 'Watch', 'Actionable', 'Prime'] as const;
const TITLE = 'Triage score · SPY';

interface ScoreCell {
  label: string;
  value: string;
  caption: string;
  valueTestId?: string;
}

// The Opportunity cell's headline is the numeric score (a figure); the tier folds into the caption
// sentence rather than repeating as its own exact text node — the tier row below is the ONE place
// each tier name ('Dormant'/'Watch'/'Actionable'/'Prime') renders as a uniquely-findable node.
const CELLS: ScoreCell[] = [
  {
    label: 'Opportunity',
    value: String(LANDING_SAMPLE.score),
    caption: `${LANDING_SAMPLE.tier} · near wall · IV cheap`,
  },
  { label: 'IV / HV', value: LANDING_SAMPLE.ivHv, caption: 'options look cheap' },
  {
    label: 'Flip dist',
    value: FLIP_DISTANCE_LABEL,
    caption: 'mid above the flip',
    valueTestId: 'sample-flip-distance',
  },
  { label: 'Vol / OI', value: LANDING_SAMPLE.volOi, caption: '3 unusual strikes' },
];

export function ScoreStripSample({ demo = false }: { demo?: boolean }) {
  return (
    <ChartFrame
      testId="landing-score-panel"
      finding={TITLE}
      metric={TITLE}
      provenance="sample"
      height={120}
      tag={demo ? undefined : { state: 'sample', word: LANDING_COPY.sample.tag }}
      source={demo ? { text: LANDING_COPY.sample.demoChip } : undefined}
      note={demo ? undefined : <span data-testid="landing-score-caption">{SAMPLE_MARK}</span>}
    >
      {/* Four cells, 2 × 2 on a phone; hairlines are the 1px gaps over the divider colour. */}
      <Box
        sx={(t) => ({
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: '1px',
          bgcolor: 'divider',
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          overflow: 'hidden',
          '& > div': { bgcolor: extrasFor(t).well },
        })}
      >
        {CELLS.map((cell) => (
          <Box
            key={cell.label}
            sx={{
              minWidth: 0,
              px: 2,
              py: 1.75,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            <Box
              component="div"
              sx={{
                ...SANS_FACE,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {cell.label}
            </Box>
            <Box
              component="div"
              data-testid={cell.valueTestId}
              sx={[
                MONO_FACE,
                { fontSize: 24, fontWeight: 500, lineHeight: 1.1, color: 'text.primary' },
              ]}
            >
              {cell.value}
            </Box>
            <Box component="div" sx={{ fontSize: 12, lineHeight: 1.4, color: 'text.secondary' }}>
              {cell.caption}
            </Box>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px 8px',
          fontSize: 12.5,
          color: 'text.secondary',
        }}
      >
        {TIERS.map((tier, i) => {
          const on = tier === LANDING_SAMPLE.tier;
          return (
            <Box
              key={tier}
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
            >
              {i > 0 && (
                <Box component="span" aria-hidden="true">
                  →
                </Box>
              )}
              <Box
                component="span"
                aria-current={on ? 'true' : undefined}
                sx={(t) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 26,
                  px: 1.25,
                  borderRadius: 999,
                  border: '1px solid',
                  // P-6: the sample's tier is marked by outline and weight, not amber.
                  borderColor: on ? t.palette.text.primary : t.palette.divider,
                  boxShadow: on ? `inset 0 0 0 1px ${t.palette.text.primary}` : 'none',
                  color: on ? 'text.primary' : 'text.secondary',
                  fontWeight: on ? 700 : 500,
                })}
              >
                {tier}
              </Box>
            </Box>
          );
        })}
        <Box component="span" sx={{ ml: 'auto' }}>
          0–100 triage score · not a trade signal
        </Box>
      </Box>
    </ChartFrame>
  );
}
