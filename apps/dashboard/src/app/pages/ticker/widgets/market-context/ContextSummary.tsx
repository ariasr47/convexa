/**
 * The context band's quiet summary (owner decision NO-1, option A, 2026-10-25; fidelity audit
 * `docs/design/fidelity-2026-10-25/AUDIT.md`, lane L5). In the band each card shows the board's
 * summary (`design/src/screens/final/ticker-desk.mjs:218` `sampleCard`): the card's name in its head,
 * one figure (18px Mono, or 16/600 Sans for a read in words), one 12px line, and the source chip at
 * the foot, each 12px apart. The card's full body moves to the Widget's existing expand overlay
 * (1200×720), so nothing the card used to say is lost, only one click further away. Measured on the
 * board at 1440: the band is 710px tall and no row's cards differ by more than 53px; the full bodies
 * made it 1188px with 21.8% of it empty.
 *
 * Why a DOM probe decides which body renders: `Widget` renders the same `children` inline and in its
 * overlay, and its `inOverlay` flag stays inside the header. React context crosses the Dialog's
 * portal unchanged, so no context can tell the two copies apart; only the overlay's copy sits inside
 * a `role="dialog"` element. The probe runs in a layout effect, so the overlay paints the full body on
 * its first frame. The cleaner seam is a context that `shared/ui/Widget/Widget.tsx` provides around
 * its overlay body; this file would then read that instead (reported to the lane that owns Widget).
 *
 * This lives beside Market context because the five context-band widgets share it and the lane that
 * built it may edit only their folders; its natural home is `widgets/_kit/`.
 */
import { faceFor } from '@/shared/figure';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { structureAsOfPhrase } from '../_kit/copy';
import { SampleSourceChip } from '../_kit/SampleSourceChip';

/**
 * The Widget body's top pad for these cards: 8px under the header rule instead of the default 12.
 * The app's head row is 26px (its ⓘ button) plus a rule where the board's is a 22px tag row with no
 * rule, so at 12 every summary card ran 6px over the board's (170 vs 164 at 1440); at 8 it is within
 * 2px. Applies to the overlay body too, where 4px less under the rule changes nothing visible.
 */
export const QUIET_BODY_SX = { pt: 1 } as const;

/**
 * Renders `summary` in the quiet band and `full` in the expand overlay. The hidden probe span is the
 * one stable node across the switch: it stays mounted while the body under it changes.
 */
export function SummaryOrFull({ summary, full }: { summary: ReactNode; full: ReactNode }) {
  const probe = useRef<HTMLSpanElement>(null);
  const [inOverlay, setInOverlay] = useState(false);
  useLayoutEffect(() => {
    setInOverlay(probe.current?.closest('[role="dialog"]') != null);
  }, []);
  return (
    <>
      <span ref={probe} hidden aria-hidden="true" />
      {inOverlay ? full : summary}
    </>
  );
}

/**
 * The summary's anatomy: figure, line, foot. `face` picks the figure's register: `mono` for a
 * number (18px), `sans` for a read in words (16/600), as the board draws Market context and Setups.
 * `help` sits on the figure's row (an ⓘ for the figure itself, or a chip that belongs to it).
 */
export function ContextSummary({
  testid,
  figure,
  face = 'mono',
  figureAttrs,
  help,
  line,
  foot,
}: {
  testid?: string;
  figure?: ReactNode;
  face?: 'mono' | 'sans';
  /** Data attributes for the figure element (`data-figure-state`, `data-testid`, …). */
  figureAttrs?: Record<`data-${string}`, string | undefined>;
  help?: ReactNode;
  line?: ReactNode;
  foot?: ReactNode;
}) {
  const mono = face === 'mono';
  return (
    <Box
      data-testid={testid}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}
    >
      {figure != null && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 1,
            rowGap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            component="p"
            {...figureAttrs}
            sx={{
              ...faceFor(mono),
              m: 0,
              minWidth: 0,
              fontSize: mono ? 18 : 16,
              fontWeight: mono ? 400 : 600,
              lineHeight: 1.5,
              overflowWrap: 'anywhere',
            }}
          >
            {figure}
          </Typography>
          {/* The help sits on the figure's line without setting its height: a 26px ⓘ button next
              to a 24px Sans figure would add 2px to the card, and on a coarse pointer its 44px
              touch floor would add 17. The target keeps its full size; it overhangs into the 12px
              gaps around the row, where nothing else is interactive. */}
          {help != null && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                my: '-2px',
                '@media (pointer: coarse)': { my: '-8.5px' },
              }}
            >
              {help}
            </Box>
          )}
        </Box>
      )}
      {line != null && (
        <Typography
          component="p"
          sx={{
            m: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'text.secondary',
            textWrap: 'pretty',
            overflowWrap: 'break-word',
          }}
        >
          {line}
        </Typography>
      )}
      {foot != null && <Box sx={{ display: 'flex', minWidth: 0 }}>{foot}</Box>}
    </Box>
  );
}

/** The subtitle the card's head carried before NO-1, now the first line of its overlay body. */
export function OverlayLead({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
      {children}
    </Typography>
  );
}

/** The overlay body's foot: the same source chip the summary shows, under the full read. */
export function OverlayFoot({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', mt: 2 }}>{children}</Box>;
}

/**
 * The summary's foot: on the demo the card's sample source chip (owner D1: a sample frame names the
 * sample once, here, so the head carries no Sample tag); on the live build `basis`, the card's as-of
 * or basis in a 12px line where the board's chip sits, so every card states it (canon: the quiet
 * context band carries its own basis and as-of).
 */
export function SummaryFoot({
  sample,
  sampleSource,
  basis,
}: {
  sample: boolean;
  sampleSource: string;
  basis: string;
}) {
  if (sample) return <SampleSourceChip text={sampleSource} />;
  return (
    <Typography sx={{ m: 0, fontSize: 12, lineHeight: 1.45, color: 'text.secondary' }}>
      {basis}
    </Typography>
  );
}

/** The live foot of a card that rides the bundle's age: "Structure as-of 42s", or "Structure
 *  snapshot" with no age to state (never "unknown age"). */
export const structureAsOf = (ageSeconds: number | null | undefined): string =>
  ageSeconds == null || !Number.isFinite(ageSeconds)
    ? 'Structure snapshot'
    : structureAsOfPhrase(ageSeconds, false);

/** The live foot of a read that takes no age (`[live-vs-static-isolation]`: its text must stay
 *  byte-identical between bundles' clock ticks): its own subtitles' first clause. */
export const STATIC_BASIS = 'Snapshot, never live';
