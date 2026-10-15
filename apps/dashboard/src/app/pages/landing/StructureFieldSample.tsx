/**
 * StructureFieldSample — the mount wrapper supplying the canvas's props (SPEC §2.4).
 * The canvas has one form since the Lab went (owner, 2026-10-14): always calm (no phosphor grain)
 * and embedded (no title strip, tape pill, `demo as-of`, `synthetic demo` or warning-toned
 * `TAPE OFF` pill — the strings a frozen sample may never show). The `variant='ticker'` prop that
 * used to select that form is gone, so nothing here can drift back into the Lab's.
 *
 * The panel header and the sample footnote are DOM copy OWNED BY THE LANDING, not canvas pixels.
 * The frame is the shared ChartFrame in its sample provenance (P-3, P-8): dashed, with the hatch
 * stripe. Production tags it "Illustrative sample" and keeps the caption; staging carries the demo's
 * dashed chip in its place (Env 2026-10-14).
 *
 * GATE Z I-3 (SPEC amendment 3, AC-L5a): `describedById="landing-field-caption"` overrides the
 * canvas's own generated accessible description (written for a real ticker desk — "the live tape
 * mid", "the level ladder beside this field") with a pointer at THIS panel's own sample caption
 * below, mirroring the hero panel's `aria-describedby="gs-sample-caption"` mechanism exactly. The
 * caption makes no live, tape or current claim and names no ladder `/` does not render.
 *
 * EAGER IMPORT — no React.lazy, no Suspense, no IntersectionObserver (SPEC §2.4). Every candidate
 * fallback is already forbidden: a spinner is a second moving element on a page whose motion budget
 * is the hero draw; a shimmer is a data-signal keyframe with no stream to gate it; a zero-height box
 * is layout shift directly under the H1. The measured 20 kB-gzipped trigger is the closer's (F16).
 */
import { ChartFrame } from '@/shared/charts/frame';
import { StructureFieldCanvas } from '@/shared/charts/structure-field';
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { LANDING_COPY } from './copy';
import { LANDING_FIELD_MODEL, SAMPLE_MARK } from './samples';

const CAPTION_ID = 'landing-field-caption';
const TITLE = 'Net dealer gamma by strike · SPY';

export function StructureFieldSample({ demo = false }: { demo?: boolean }) {
  const theme = useTheme();
  const palette = useMemo(() => resolveLevelPalette(theme), [theme]);
  const surfaces = useMemo(
    () => ({
      ink: theme.palette.background.default,
      panel: theme.palette.background.paper,
      raised: extrasFor(theme).panelRaised,
      phosphor: theme.palette.text.primary,
      steel: theme.palette.text.secondary,
      warning: theme.palette.warning.main,
    }),
    [theme],
  );
  return (
    <ChartFrame
      testId="landing-field-panel"
      finding={TITLE}
      metric={TITLE}
      provenance="sample"
      height={240}
      tag={demo ? undefined : { state: 'sample', word: LANDING_COPY.sample.tag }}
      source={demo ? { text: LANDING_COPY.sample.demoChip } : undefined}
      note={
        demo ? undefined : (
          <span id={CAPTION_ID} data-testid="landing-field-caption">
            {SAMPLE_MARK}
          </span>
        )
      }
    >
      <StructureFieldCanvas
        model={LANDING_FIELD_MODEL}
        height={240}
        palette={palette}
        surfaces={surfaces}
        describedById={CAPTION_ID}
      />
      {/* Staging: the canvas's description target, saying what the chip says. */}
      {demo && (
        <Box
          component="span"
          id={CAPTION_ID}
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {`${LANDING_COPY.sample.demoChip}. ${SAMPLE_MARK}`}
        </Box>
      )}
    </ChartFrame>
  );
}
