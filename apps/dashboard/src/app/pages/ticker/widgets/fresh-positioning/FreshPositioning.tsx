/**
 * FreshPositioning — the full-chain unusual-strike list (Vol/OI ≥ cutoff), ranked desc, top-N (Figma
 * `Ticker · Fresh Positioning`, node 149:639): a card with header + subtitle over recessed mono rows
 * (`$strike · Vol/OI N× · N contracts`). Static bundle field; activity only, no side/direction;
 * catches strikes outside the chart window.
 *
 * Owner decision NO-1 A (2026-10-25, fidelity lane L5): in the quiet band the card is the board's
 * summary (`design/src/screens/final/ticker-desk.mjs:230`): the top strike and its ratio as the
 * figure, the next two in the one line, and on the demo the sample source chip; on the live build the
 * foot states the structure's as-of. The rows and the caption render in the expand overlay.
 */
import { faceFor, figureStateOf } from '@/shared/figure';
import { Widget } from '@/shared/ui/Widget';
import { useWidgetProvenance } from '@/shared/ui/Widget/WidgetProvenanceContext';
import type { StrikeRow } from '@convexa/api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { memo, type ReactNode } from 'react';
import { fmtThresh, freshCaption, volOiTip, withStructureAge } from '../_kit/copy';
import {
  ContextSummary,
  OverlayFoot,
  OverlayLead,
  QUIET_BODY_SX,
  structureAsOf,
  SummaryFoot,
  SummaryOrFull,
} from '../market-context/ContextSummary';

/** The board's sample source chip for this card (`ticker-desk.mjs:230`). */
const SAMPLE_SOURCE = 'Sample · shaped like the chain';

/**
 * How many strikes the desk hands this card: `TickerDashboard` ranks the chain's strikes at or above
 * the cutoff and keeps the top 8 (`.slice(0, 8)` where it builds `unusualStrikes`). A list this long
 * may have been cut, so its length is a true count only below this number.
 */
export const FRESH_TOP_N = 8;

interface Props {
  chainVolOiRatio: number | null;
  volOiThreshold: number;
  /** The strikes at or above the cutoff, ranked by Vol/OI, cut to the desk's top `FRESH_TOP_N`. */
  unusualStrikes: StrikeRow[];
  /**
   * How many strikes in the whole chain meet the cutoff, counted before the list was cut. When it is
   * absent the card states a count only for a list shorter than `FRESH_TOP_N`.
   */
  unusualCount?: number | null;
  /** Fill the parent's height (for the side-by-side row) instead of the default top margin. */
  fillHeight?: boolean;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/**
 * The count the summary may state, in words. The list's own length is true only while it is shorter
 * than the cut; at the cut the chain may hold more, so the line says "eight or more" unless the caller
 * passed the uncut count.
 */
function strikeCountWords(listed: number, total: number | null | undefined): string {
  if (total != null && total >= listed) return countWord(total);
  return listed < FRESH_TOP_N ? countWord(listed) : `${countWord(FRESH_TOP_N)} or more`;
}

/** "$715 · 1.68×": a strike and its Vol/OI ratio, the summary's figure form. */
const strikeRatio = (s: StrikeRow) => `$${s.strike} · ${(s.vol_oi_ratio as number).toFixed(2)}×`;

/** The two empty states, the same sentences in the band and the overlay. */
function emptySentence(
  chainVolOiRatio: number | null,
  volOiThreshold: number,
  unusualStrikes: StrikeRow[],
): string | null {
  if (chainVolOiRatio == null) return 'Vol/OI unavailable this cycle.';
  if (unusualStrikes.length === 0)
    return `No strikes above the ${fmtThresh(volOiThreshold)}× Vol/OI cutoff this session.`;
  return null;
}

/**
 * The quiet-band summary: "$715 · 1.68×", then "the top of three strikes where today’s volume
 * outruns open interest ($710 1.56×, $705 1.44×)". "Outruns" is only said when the cutoff is at
 * least 1.0×, where a listed strike's volume is at least its open interest; below that the line
 * names the cutoff instead. The count never comes from a list that may have been cut
 * (`strikeCountWords`): 14 qualifying strikes read "the top of eight or more strikes", not "eight".
 */
function FreshSummary({
  chainVolOiRatio,
  volOiThreshold,
  unusualStrikes,
  unusualCount,
  foot,
}: {
  chainVolOiRatio: number | null;
  volOiThreshold: number;
  unusualStrikes: StrikeRow[];
  unusualCount: number | null | undefined;
  foot: ReactNode;
}) {
  const empty = emptySentence(chainVolOiRatio, volOiThreshold, unusualStrikes);
  if (empty != null) return <ContextSummary line={empty} foot={foot} />;
  const [top, ...rest] = unusualStrikes;
  const count = strikeCountWords(unusualStrikes.length, unusualCount);
  const where =
    volOiThreshold >= 1
      ? 'where today’s volume outruns open interest'
      : `at Vol/OI ≥ ${fmtThresh(volOiThreshold)}×`;
  const lead = count === 'one' ? `the one strike ${where}` : `the top of ${count} strikes ${where}`;
  // Each figure in the line is traced (a real Convexa-computed ratio), resolved through the shared
  // module as the overlay's rows are.
  const next = rest.slice(0, 2).map((s) => {
    const text = `$${s.strike} ${(s.vol_oi_ratio as number).toFixed(2)}×`;
    const state = figureStateOf({ value: text, register: 'traced' });
    return { key: s.strike, text, state };
  });
  const head = figureStateOf({ value: strikeRatio(top), register: 'traced' });
  return (
    <ContextSummary
      figure={strikeRatio(top)}
      figureAttrs={{
        'data-figure-state': head.figureState,
        'data-figure-register': head.mono ? 'mono' : 'sans',
      }}
      line={
        <>
          {lead}
          {next.length > 0 && (
            <>
              {' ('}
              {next.map((x, i) => (
                <span key={x.key}>
                  {i > 0 && ', '}
                  <span
                    data-figure-state={x.state.figureState}
                    data-figure-register={x.state.mono ? 'mono' : 'sans'}
                  >
                    {x.text}
                  </span>
                </span>
              ))}
              {')'}
            </>
          )}
        </>
      }
      foot={foot}
    />
  );
}

/** The full list, in the expand overlay: the caption, then up to three recessed strike rows. */
function FreshFull({
  chainVolOiRatio,
  volOiThreshold,
  unusualStrikes,
  caption,
  foot,
}: {
  chainVolOiRatio: number | null;
  volOiThreshold: number;
  unusualStrikes: StrikeRow[];
  caption: string;
  foot: ReactNode;
}) {
  const empty = emptySentence(chainVolOiRatio, volOiThreshold, unusualStrikes);
  return (
    <Box>
      <OverlayLead>{caption}</OverlayLead>
      {empty != null ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {empty}
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {/* Ticker fidelity repair, change 2 (F2) — three rows, no "+N more" affordance
              (`design/src/screens/desk.mjs:43`'s `contextCard('Fresh positioning · Vol/OI', ...)`).
              `unusualStrikes` is already the desk's top `FRESH_TOP_N`; this cuts it to three rows.
              The ⓘ tooltip's count (`volOiTip`) is `unusualCount` when the caller passes it, else
              this list's length, which stops at `FRESH_TOP_N`. */}
          {unusualStrikes.slice(0, 3).map((s) => {
            // The strike + Vol/OI ratio — always a real Convexa-computed figure on a row the
            // backend returned (SPEC §2.4): traced register through the shared module.
            const headState = figureStateOf({
              value: `$${s.strike} · Vol/OI ${(s.vol_oi_ratio as number).toFixed(2)}×`,
              register: 'traced',
            });
            // The contract count is a SEPARATE figure that can itself be absent — the absent
            // token gets its own Sans span at the row's own 12px (never `FigureCell`'s 15px
            // literal size, which would invert this 12px list's hierarchy) rather than sitting
            // inside the mono run (criterion 54: no untraced/not-a-number member in mono).
            const volumeText = s.volume != null ? s.volume.toLocaleString() : '—';
            const volumeState = figureStateOf({ value: volumeText, register: 'traced' });
            return (
              <Box
                key={s.strike}
                sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}
              >
                <Typography
                  component="span"
                  data-figure-state={headState.figureState}
                  data-figure-register={headState.mono ? 'mono' : 'sans'}
                  sx={{ ...faceFor(headState.mono), fontSize: 12 }}
                >
                  {`$${s.strike} · Vol/OI ${(s.vol_oi_ratio as number).toFixed(2)}× · `}
                </Typography>
                <Typography
                  component="span"
                  data-figure-state={volumeState.figureState}
                  data-figure-register={volumeState.mono ? 'mono' : 'sans'}
                  sx={{ ...faceFor(volumeState.mono), fontSize: 12 }}
                >
                  {volumeText}
                </Typography>
                <Typography component="span" sx={{ ...faceFor(headState.mono), fontSize: 12 }}>
                  {' contracts'}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
      {foot != null && <OverlayFoot>{foot}</OverlayFoot>}
    </Box>
  );
}

export const FreshPositioning = memo(function FreshPositioning({
  chainVolOiRatio,
  volOiThreshold,
  unusualStrikes,
  unusualCount = null,
  structureAgeSeconds = null,
}: Props) {
  // The foot: the sample source chip on the demo (so the head carries no Sample tag, owner D1), the
  // structure's as-of on the live build. The overlay repeats only the chip; its caption already
  // states the as-of.
  const sample = useWidgetProvenance() === 'sample';
  const foot = (
    <SummaryFoot
      sample={sample}
      sampleSource={SAMPLE_SOURCE}
      basis={structureAsOf(structureAgeSeconds)}
    />
  );
  return (
    // NO-1 A: the caption moved into the overlay body (`FreshFull`), since the Widget header is
    // shared by the band card and the overlay.
    <Widget
      id="fresh-positioning"
      title="Fresh positioning (Vol/OI)"
      info={volOiTip(volOiThreshold, unusualCount ?? unusualStrikes.length)}
      sampleTag={false}
      bodySx={QUIET_BODY_SX}
    >
      <SummaryOrFull
        summary={
          <FreshSummary
            chainVolOiRatio={chainVolOiRatio}
            volOiThreshold={volOiThreshold}
            unusualStrikes={unusualStrikes}
            unusualCount={unusualCount}
            foot={foot}
          />
        }
        full={
          <FreshFull
            chainVolOiRatio={chainVolOiRatio}
            volOiThreshold={volOiThreshold}
            unusualStrikes={unusualStrikes}
            caption={withStructureAge(freshCaption(volOiThreshold), structureAgeSeconds)}
            foot={sample ? foot : null}
          />
        }
      />
    </Widget>
  );
});

export default FreshPositioning;
