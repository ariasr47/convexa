/**
 * AiReadSample — a landing-local composition over `shared/figure` + `shared/ui` (SPEC §2.2 item 3,
 * §4 "Landing — score and AI-read samples"). The frame's title is `AI read`; the verdict row
 * carries the shipped `SIMULATED` chip; the caption is this panel's OWN sample mark
 * (`AI_SAMPLE_MARK`) — a DIFFERENT withdrawal than the hero/field's shared `SAMPLE_MARK`, because
 * the claim it withdraws is different: no model run happened here, as against no live read.
 *
 * The first three cells (`Max risk`, `Invalidation`, `Entry`) are Convexa's own traced figures —
 * `MONO_FACE`. `Target` is the model's own untraced number — `SANS_FACE` + `UNTRACED_RULE`, the
 * dotted rule that survives a black-and-white screenshot (canon rules 13/23).
 *
 * As the Final board draws it (`design/src/screens/final/shell-site-kit.mjs` `aiIll`; fidelity
 * SITE-06): a caps "Verdict" label, then the verdict in Archivo 26/700 `text.primary` — canon's one
 * display role inside a panel (`DESIGN_SYSTEM.md`, Type), neutral, never amber — then the lean and
 * conviction in steel. The four cells are one joined strip on the well, and a line under them says
 * whose number each face is. The board draws no pictures of controls, so this panel has none:
 * `[no-real-order-path]` holds trivially, nothing here is or looks like an action.
 *
 * The frame is the shared ChartFrame in its sample provenance (P-3, P-8): dashed, with the hatch
 * stripe. Production tags it "Illustrative sample" and carries `AI_SAMPLE_MARK` as its caption;
 * staging carries the demo's dashed chip in its place (Env 2026-10-14).
 */
import { ChartFrame } from '@/shared/charts/frame';
import { MONO_FACE, SANS_FACE, UNTRACED_RULE } from '@/shared/figure';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { LANDING_COPY } from './copy';
import { AI_SAMPLE_MARK } from './samples';

// No symbol: the values are illustrative and are no real ticker's structure (spec 01, Copy › Landing).
const TITLE = 'AI read';

interface ReadCell {
  label: string;
  value: string;
  caption: string;
  traced: boolean;
}

/** The board's `.caps`: 11px, 600, +6% tracking, steel. */
const CAPS_SX = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  lineHeight: 1.3,
  color: 'text.secondary',
} as const;

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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Stack
          direction="row"
          useFlexGap
          sx={{ alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.5, rowGap: 1 }}
        >
          <Box component="span" sx={CAPS_SX}>
            Verdict
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: typographyTokens.displayFontFamily,
              fontStretch: typographyTokens.displayFontStretch,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.1,
              color: 'text.primary',
            }}
          >
            Trade
          </Box>
          <Box component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>
            · bullish lean · conviction high
          </Box>
          <Chip
            label="SIMULATED"
            size="small"
            variant="outlined"
            sx={{ fontSize: 11, height: 20, ml: 'auto', alignSelf: 'center' }}
          />
        </Stack>
        <Box component="span" sx={{ fontSize: 14 }}>
          <Box component="b" sx={{ fontWeight: 600 }}>
            Bull call spread
          </Box>{' '}
          <Box component="span" sx={MONO_FACE}>
            575 / 580
          </Box>{' '}
          · Sep 18
        </Box>

        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
            },
            // One joined strip: the hairline shows through a 1px gap between the cells on the well.
            gap: '1px',
            bgcolor: 'divider',
            borderRadius: '10px',
            overflow: 'hidden',
            '& > div': { bgcolor: extrasFor(theme).well },
          })}
        >
          {CELLS.map((cell) => (
            <Box
              key={cell.label}
              sx={{
                px: 1.5,
                py: 1.25,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: 0,
              }}
            >
              <Box component="span" sx={CAPS_SX}>
                {cell.label}
              </Box>
              <Box
                component="span"
                sx={
                  cell.traced
                    ? [MONO_FACE, { fontSize: 17, fontWeight: 500, lineHeight: 1.25 }]
                    : [
                        SANS_FACE,
                        UNTRACED_RULE,
                        {
                          fontSize: 16,
                          fontWeight: 500,
                          lineHeight: 1.25,
                          alignSelf: 'flex-start',
                        },
                      ]
                }
              >
                {cell.value}
              </Box>
              <Box
                component="span"
                sx={{ fontSize: 11.5, lineHeight: 1.45, color: 'text.secondary' }}
              >
                {cell.caption}
              </Box>
            </Box>
          ))}
        </Box>

        <Box
          component="span"
          sx={{ fontSize: 12, lineHeight: 1.45, color: 'text.secondary', textWrap: 'pretty' }}
        >
          Figures in mono trace to the snapshot; the target in body type is the model’s own number.
        </Box>
      </Box>
    </ChartFrame>
  );
}
