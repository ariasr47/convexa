/**
 * ScoreStripSample — a landing-local composition over `shared/figure` + `shared/ui`. Its CTA-shaped
 * elements are non-focusable presentational nodes: a picture of a control never enters the tab order.
 *
 * FLIP_DISTANCE_LABEL is DERIVED AT MODULE LOAD from `samples.ts`, never hand-typed: the design's own
 * artboard prints this sample distance as `−0.81%` (`landing.mjs:88`) and `−0.8%` (`landing.mjs:65`),
 * and the first is not what the shipped formatter produces from those constants. The projection is a
 * MIRROR of `pages/ticker/widgets/_kit/distanceToLevel.ts`'s `distancePercentOnly` — no ticker file may
 * be edited by this feature, and a page may not import a sibling page — and the two are pinned EQUAL by
 * `curvature-v2-landing-samples.structural.spec.ts` (SPEC §7 item 14). Poison a constant there and the
 * rendered string must move.
 *
 * No ring gauge (SPEC §2 — no ring-gauge component exists in `apps/dashboard`, and inventing one for
 * the acquisition page only is a second illustration under the canon's one-hero-instrument limit) and
 * no `<svg>` at all in this file, so §7 item 2's set-equality scan stays decidable.
 *
 * GATE Z I-3 (AC-L5a, amendment 3): this panel carries the SHARED sample literal
 * (`SAMPLE_MARK`) once — the same words the hero and field panels carry, so `/` still has two
 * sample literals (this one, and the AI-read panel's own distinct withdrawal) and only two, never
 * a third vocabulary for the same claim.
 */
import { MONO_FACE, SANS_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import { TintChip } from '@/shared/ui';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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

interface ScoreCell {
  label: string;
  value: string;
  caption: string;
  /** Only the sample's OWN tier renders in the amber emphasis register — the other three cells are
   *  plain traced figures. */
  emphasize?: boolean;
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
    emphasize: true,
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

export function ScoreStripSample() {
  return (
    <Box
      data-testid="landing-score-panel"
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        divider={
          <Box
            sx={{
              borderBottom: { xs: '1px solid', sm: 0 },
              borderRight: { sm: '1px solid' },
              borderColor: 'divider',
            }}
          />
        }
      >
        {CELLS.map((cell) => (
          <Box key={cell.label} sx={{ flex: 1, minWidth: 0, px: 2, py: 2 }}>
            <Box
              component="div"
              sx={{
                ...SANS_FACE,
                fontSize: 11,
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
                { fontSize: 20, fontWeight: 500, mt: 0.5 },
                (theme) => ({
                  color: cell.emphasize ? extrasFor(theme).textAmber : theme.palette.text.primary,
                }),
              ]}
            >
              {cell.value}
            </Box>
            <Box component="div" sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              {cell.caption}
            </Box>
          </Box>
        ))}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          alignItems: 'center',
          flexWrap: 'wrap',
          rowGap: 1,
        }}
      >
        {TIERS.map((tier, i) => (
          <Stack key={tier} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TintChip tone={tier === LANDING_SAMPLE.tier ? 'emphasis' : 'neutral'} label={tier} />
            {i < TIERS.length - 1 && (
              <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                →
              </Box>
            )}
          </Stack>
        ))}
        <Box component="span" sx={{ ml: 'auto', fontSize: 12, color: 'text.secondary' }}>
          0–100 triage score · not a trade signal
        </Box>
      </Stack>
      <Typography
        variant="caption"
        data-testid="landing-score-caption"
        sx={{
          display: 'block',
          px: 2,
          py: 1,
          color: 'text.secondary',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {SAMPLE_MARK}
      </Typography>
    </Box>
  );
}
