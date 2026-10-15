/**
 * AiReadSample — a landing-local composition over `shared/figure` + `shared/ui` (SPEC §2.2 item 3,
 * §4 "Landing — score and AI-read samples"). The frame's title is `AI read · SPY`; the verdict row
 * carries the shipped `SIMULATED` chip; the caption is this panel's OWN sample mark
 * (`AI_SAMPLE_MARK`) — a DIFFERENT withdrawal than the hero/field's shared `SAMPLE_MARK`, because
 * the claim it withdraws is different: no model run happened here, as against no live read.
 *
 * The first three cells (`Max risk`, `Invalidation`, `Entry`) are Convexa's own traced figures —
 * `MONO_FACE`. `Target` is the model's own untraced number — `SANS_FACE` + `UNTRACED_RULE`, the
 * dotted rule that survives a black-and-white screenshot (canon rules 13/23).
 *
 * `[no-real-order-path]`: the two CTA-shaped elements are non-focusable presentational nodes —
 * `<Box component="span">`, no `tabIndex`, no `href`, no `onClick` — a picture of a control never
 * enters the tab order and never becomes a mounted `TradeEntryDialog`.
 *
 * The frame is the shared ChartFrame in its sample provenance (P-3, P-8): dashed, with the hatch
 * stripe. Production tags it "Illustrative sample" and carries `AI_SAMPLE_MARK` as its caption;
 * staging carries the demo's dashed chip in its place (Env 2026-10-14).
 */
import { ChartFrame } from '@/shared/charts/frame';
import { MONO_FACE, SANS_FACE, UNTRACED_RULE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { LANDING_COPY } from './copy';
import { AI_SAMPLE_MARK } from './samples';

const TITLE = 'AI read · SPY';

interface ReadCell {
  label: string;
  value: string;
  caption: string;
  traced: boolean;
}

const CELLS: ReadCell[] = [
  { label: 'Max risk', value: '$420', caption: '1.7% of account', traced: true },
  { label: 'Invalidation', value: '568.50', caption: 'the gamma flip', traced: true },
  { label: 'Entry', value: 'near 573', caption: 'pullback to VWAP', traced: true },
  { label: 'Target', value: '579.50', caption: 'AI-stated · untraced', traced: false },
];

export function AiReadSample({ demo = false }: { demo?: boolean }) {
  return (
    <ChartFrame
      testId="landing-ai-read-panel"
      finding={TITLE}
      metric={TITLE}
      provenance="sample"
      height={200}
      tag={demo ? undefined : { state: 'sample', word: LANDING_COPY.sample.tag }}
      source={demo ? { text: LANDING_COPY.sample.demoChip } : undefined}
      note={demo ? undefined : AI_SAMPLE_MARK}
    >
      <Box>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'baseline', flexWrap: 'wrap', rowGap: 0.5 }}
        >
          <Box
            component="span"
            sx={(theme) => ({ fontSize: 26, fontWeight: 600, color: extrasFor(theme).textAmber })}
          >
            Trade
          </Box>
          <Box component="span" sx={{ fontSize: 20, fontWeight: 500, color: 'text.secondary' }}>
            ·
          </Box>
          <Box component="span" sx={{ fontSize: 26, fontWeight: 500 }}>
            Bullish
          </Box>
          <Chip
            label="SIMULATED"
            size="small"
            variant="outlined"
            sx={{ fontSize: 11, height: 20, ml: 'auto', alignSelf: 'center' }}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 0.5, fontSize: 12.5 }}
        >
          <Box component="span" sx={{ fontWeight: 600 }}>
            Bull call spread
          </Box>
          <Box component="span" sx={MONO_FACE}>
            575 / 580
          </Box>
          <Box component="span">Sep 18</Box>
          <Chip
            label="high"
            size="small"
            sx={(theme) => ({
              height: 20,
              fontSize: 11,
              bgcolor: alpha(theme.palette.primary.main, 0.16),
              color: extrasFor(theme).textAmber,
            })}
          />
        </Stack>

        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {CELLS.map((cell) => (
            <Box
              key={cell.label}
              sx={[
                {
                  borderRadius: 1.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  px: 1.5,
                  py: 1.5,
                },
                (theme) => ({ bgcolor: extrasFor(theme).panelRaised }),
              ]}
            >
              <Box
                component="div"
                sx={{
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
                sx={
                  cell.traced
                    ? [MONO_FACE, { fontSize: 18, mt: 0.5 }]
                    : [SANS_FACE, UNTRACED_RULE, { fontSize: 18, mt: 0.5, display: 'inline-block' }]
                }
              >
                {cell.value}
              </Box>
              <Box component="div" sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                {cell.caption}
              </Box>
            </Box>
          ))}
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5 }}>
          <Box
            component="span"
            sx={(theme) => ({
              flex: '1 1 180px',
              textAlign: 'center',
              borderRadius: 1,
              px: 2,
              py: 1,
              fontSize: 13,
              fontWeight: 600,
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            })}
          >
            Review simulated trade
          </Box>
          <Box
            component="span"
            sx={{
              borderRadius: 1,
              px: 2,
              py: 1,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.primary',
            }}
          >
            Full analysis
          </Box>
        </Stack>
      </Box>
    </ChartFrame>
  );
}
