/**
 * Stress, on /research/markets#stress (spec docs/product/specs/2026-10-21/07-stress-gauge.md): the
 * fear–greed gauge as a component table, one gauge row over the seven inputs in table order, never
 * a dial. The API computes every figure (`PublicMarkets.stress`, apps/api stress.rs); the words are
 * in stressRead.ts.
 *
 * - Each row joins its `source` to the answer's `sources` row of that id for its data state: an
 *   input carries no state of its own. A row on a last good copy says so beside its date.
 * - A withheld reading (fewer than 5 of 7 fresh) keeps the frame `ready`, so the rows and the twin
 *   still draw: the title names the metric, the head tag and the first line say why in one quiet
 *   form, and no number, band or finding shows (spec Behaviour › Withheld).
 * - Nothing green or red, and no amber: fear and greed are carried by position and words (P-11,
 *   rule 16). The bars are aria-hidden; each row's text says everything they show.
 * - Staging draws the authored sample: the frame takes the board's dashed provenance and its source
 *   chip is its one Sample mark (owner decision D1); the credit lines say what the values are shaped
 *   like, and no agency is credited for them.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { ChartFrame, chartRoles, type TableTwinCell } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { extrasFor } from '@/shared/theme/tokens';
import {
  dataMode,
  type PublicSource,
  type PublicStress,
  type PublicStressComponent,
} from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { Theme } from '@mui/material/styles';
import { formatNoteDate, formatShortDate } from './format';
import {
  BAND_WORD,
  bandOf,
  CREDIT,
  INPUTS,
  meanText,
  notCountedLine,
  percentileSentence,
  rawFigure,
  rawParts,
  STRESS_CAPTION,
  STRESS_METRIC,
  STRESS_NOTE,
  STRESS_SUB,
  stressFinding,
  wholeScore,
  withheldCause,
  withheldLine,
  type StressBand,
  type WithheldCause,
} from './stressRead';
import { MONO } from './ui';

const OFR_URL = 'https://www.financialresearch.gov/financial-stress-index/';

/**
 * One grid for the axis and every row, so the band names sit over the bars. A phone stacks each
 * row (its score beside its name); from 768px the bar takes a column between the input and its
 * score; from 1300px the row reads across, as the spec's desktop sketch does: input, raw value, bar,
 * score, sentence, with the credit line under the raw value.
 */
const GRID = {
  display: 'grid',
  columnGap: 2,
  rowGap: 0.5,
  minWidth: 0,
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr) auto',
    tablet: 'minmax(0, 220px) minmax(0, 1fr) 136px',
    desktop: '176px 216px minmax(0, 1fr) 136px minmax(0, 1fr)',
  },
} as const;
const ROW_AREAS = {
  xs: '"label score" "raw raw" "bar bar" "sent sent" "cred cred"',
  tablet: '"label bar score" "raw sent sent" "cred cred cred"',
  desktop: '"label raw bar score sent" "label cred cred cred sent"',
} as const;
const AXIS_AREAS = {
  xs: '"bar bar"',
  tablet: '". bar score"',
  desktop: '". . bar score ."',
} as const;

/** The band spans on the 0–100 track, as the axis names them once. */
const BANDS: { band: StressBand; from: number; to: number }[] = [
  { band: 'extreme_fear', from: 0, to: 25 },
  { band: 'fear', from: 25, to: 45 },
  { band: 'neutral', from: 45, to: 55 },
  { band: 'greed', from: 55, to: 75 },
  { band: 'extreme_greed', from: 75, to: 100 },
];
const TICKS = [0, 25, 45, 55, 75, 100];

const shortDate = (day: string | null | undefined) => (day ? formatShortDate(day) : null);
const datesOf = (cs: PublicStressComponent[]) =>
  cs.flatMap((c) => (c.as_of ? [c.as_of] : [])).sort();

export function StressSection({
  stress,
  sources,
  onRetry,
}: {
  stress: PublicStress;
  /** The answer's `sources` rows: each input's data state is its source's row. */
  sources: PublicSource[] | undefined;
  /** Read the markets answer again (Try again, where a fetch failed). */
  onRetry: () => void;
}) {
  const demo = dataMode === 'demo';
  const rowOf = (id: PublicStressComponent['source']) => (sources ?? []).find((r) => r.id === id);
  const ofrRow = rowOf('ofr');
  const published = stress.published && stress.gauge != null && stress.band != null;
  const cause = published ? null : withheldCause(ofrRow, stress);
  const ofrInputs = stress.components.filter((c) => c.source === 'ofr');
  const cftcInputs = stress.components.filter((c) => c.source === 'cftc');
  // The foot dates each source's copy: its `sources` row's as-of (the newest day the OFR file holds,
  // the CFTC report's Tuesday), else its inputs' newest. Each row still shows its own date, and the
  // gauge row and tag the gauge's (its oldest counted OFR input, rule 9).
  const ofrDate = ofrRow?.as_of ?? datesOf(ofrInputs).at(-1) ?? null;
  const cftcDate = rowOf('cftc')?.as_of ?? datesOf(cftcInputs).at(-1) ?? null;
  const asOfLine = [
    ofrDate && `OFR as of ${formatShortDate(ofrDate)}`,
    cftcDate && `CFTC positions ${formatShortDate(cftcDate)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const twinText = (text: string): TableTwinCell => ({ text });
  const dash = twinText('—');
  const table = {
    caption: STRESS_CAPTION,
    cols: [
      'Input',
      'Source',
      'As of',
      'Raw',
      'Window',
      'Percentile',
      'Higher means',
      'Score',
      'Band',
      'Counted',
    ],
    rows: [
      ...stress.components.map((c): TableTwinCell[] => {
        const raw = rawFigure(c);
        const whole = c.counted ? wholeScore(c) : null;
        return [
          INPUTS[c.id].name,
          twinText(c.source === 'ofr' ? 'OFR' : 'CFTC'),
          c.as_of ? formatNoteDate(c.as_of) : dash,
          raw ?? twinText('unavailable'),
          c.as_of && c.window > 0 ? c.window.toLocaleString('en-US') : dash,
          c.percentile == null ? dash : c.percentile.toFixed(1),
          twinText(c.higher_means),
          // The score averaged into the gauge: an uncounted input's is not.
          c.counted && c.score != null ? c.score.toFixed(1) : dash,
          whole == null ? dash : twinText(BAND_WORD[bandOf(whole)]),
          twinText(c.counted ? 'yes' : 'no'),
        ];
      }),
      [
        'Gauge',
        twinText('Convexa'),
        stress.as_of ? formatNoteDate(stress.as_of) : dash,
        dash,
        dash,
        dash,
        dash,
        published && stress.mean != null ? `${meanText(stress.mean)} → ${stress.gauge}` : dash,
        published ? twinText(BAND_WORD[stress.band as StressBand]) : dash,
        `${stress.counted} of 7`,
      ],
    ],
  };

  return (
    <ChartFrame
      finding={stressFinding(stress, demo)}
      metric={STRESS_METRIC}
      sub={STRESS_SUB}
      headingLevel="h3"
      height={STRESS_HEIGHT}
      // The `ofr` row decides: five of the seven inputs are the OFR's. A CFTC last good copy changes
      // only its two rows. On the demo the frame wears no head tag (owner decision D1).
      tag={
        cause
          ? { state: cause }
          : {
              state: ofrRow?.state === 'last_good' ? 'lastGood' : 'computed',
              detail: stress.as_of ? `as of ${formatShortDate(stress.as_of)}` : undefined,
            }
      }
      note={STRESS_NOTE}
      source={
        demo
          ? { text: 'Demo · shaped like OFR and CFTC data' }
          : { text: 'OFR Financial Stress Index · CFTC TFF', href: OFR_URL }
      }
      asOf={demo ? `Scenario · ${formatNoteDate(stress.judged_on)}` : asOfLine || undefined}
      table={table}
      testId="chart-stress"
    >
      <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        {cause && (
          <Withheld
            cause={cause}
            line={withheldLine(cause, {
              counted: stress.counted,
              ends: ofrDate,
              since: ofrRow?.checked_at ?? null,
            })}
            onRetry={cause === 'delayed' ? undefined : onRetry}
          />
        )}
        <GaugeRow stress={stress} published={published} />
        <Box sx={{ display: 'grid', minWidth: 0 }}>
          <Axis />
          {/* In table order, never re-sorted by score, so the reading is stable day to day.
              `role="list"`: WebKit drops a list's semantics with its bullets. */}
          <Box
            component="ol"
            role="list"
            aria-label="The seven inputs"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', minWidth: 0 }}
          >
            {stress.components.map((c) => (
              <InputRow
                key={c.id}
                c={c}
                lastGood={rowOf(c.source)?.state === 'last_good'}
                demo={demo}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </ChartFrame>
  );
}

/** The ready body's height at 1440 (the gauge row, the axis and seven rows; 621px measured on the
 *  live answer of 2026-10-29), which the loading frame keeps (MarketsPage's MarketsLoading). Narrower
 *  layouts stack each row and grow taller, below the fold (spec Behaviour › Loading). */
export const STRESS_HEIGHT = 621;

/** A withheld reading's one quiet form, for every cause: the P-2 word, the line, and Try again
 *  where a fetch failed (spec Behaviour › Withheld; not spec 4's LoadFailure). */
function Withheld({
  cause,
  line,
  onRetry,
}: {
  cause: WithheldCause;
  line: string;
  onRetry?: () => void;
}) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        p: '12px 14px',
        borderRadius: '10px',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <DataStateTag state={cause} />
      <Box
        component="p"
        sx={{ m: 0, fontSize: 13, lineHeight: 1.5, color: 'text.secondary', textWrap: 'pretty' }}
      >
        {line}
      </Box>
      {onRetry && (
        // 44px at every pointer, outlined and neutral.
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={onRetry}
          sx={{ minHeight: 44 }}
        >
          Try again
        </Button>
      )}
    </Box>
  );
}

/** The gauge on top: a caps label, its figure (Mono, Convexa's number, never a heading) and its
 *  band word with how many inputs it counts and their date; withheld, a dash and the count. */
function GaugeRow({ stress, published }: { stress: PublicStress; published: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: 1.5,
        rowGap: 0.5,
        minWidth: 0,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        Fear–greed
      </Box>
      {published ? (
        <Box component="span" sx={{ ...MONO, fontSize: 28, fontWeight: 500, lineHeight: 1.1 }}>
          {stress.gauge}
        </Box>
      ) : (
        // A not-a-number member: Sans, never a figure (rule 24).
        <Box component="span" sx={{ fontSize: 28, lineHeight: 1.1 }}>
          —
        </Box>
      )}
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
        {published ? (
          <>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {BAND_WORD[stress.band as StressBand]}
            </Box>
            {` · ${stress.counted} of 7 inputs counted${stress.as_of ? ` · as of ${formatShortDate(stress.as_of)}` : ''}`}
          </>
        ) : (
          `${stress.counted} of 7 inputs counted, 5 needed`
        )}
      </Box>
    </Box>
  );
}

/** The track's scale, once: the band names over their spans and the edges under them from 768px;
 *  on a phone only the two ends, so no label shrinks below 11px (P-13). The score column's header
 *  sits beside it from 768px. */
function Axis() {
  const label = { fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' } as const;
  const figure = { ...MONO, fontSize: 11, color: 'text.secondary' } as const;
  return (
    <Box sx={{ ...GRID, gridTemplateAreas: AXIS_AREAS, pb: 0.75 }}>
      <Box aria-hidden sx={{ gridArea: 'bar', minWidth: 0 }}>
        <Box sx={{ display: { xs: 'none', tablet: 'block' } }}>
          <Box sx={{ position: 'relative', height: 16 }}>
            {BANDS.map((b) => (
              <Box
                key={b.band}
                component="span"
                sx={{
                  ...label,
                  position: 'absolute',
                  left: `${(b.from + b.to) / 2}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {BAND_WORD[b.band]}
              </Box>
            ))}
          </Box>
          <Box sx={{ position: 'relative', height: 15 }}>
            {TICKS.map((t) => (
              <Box
                key={t}
                component="span"
                sx={{
                  ...figure,
                  position: 'absolute',
                  left: `${t}%`,
                  transform:
                    t === 0 ? 'none' : t === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {t}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: { xs: 'grid', tablet: 'none' }, gridTemplateColumns: '1fr 1fr' }}>
          <Box component="span" sx={label}>
            Fear
          </Box>
          <Box component="span" sx={{ ...label, textAlign: 'right' }}>
            Greed
          </Box>
          <Box component="span" sx={figure}>
            0
          </Box>
          <Box component="span" sx={{ ...figure, textAlign: 'right' }}>
            100
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          gridArea: 'score',
          display: { xs: 'none', tablet: 'block' },
          alignSelf: 'end',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'text.secondary',
        }}
      >
        Score · 0 fear – 100 greed
      </Box>
    </Box>
  );
}

/** One input: what it is, its raw value and date, its bar, its score with its band word, its
 *  percentile sentence, why it is not counted (if so), and its credit line. */
function InputRow({
  c,
  lastGood,
  demo,
}: {
  c: PublicStressComponent;
  /** Its source's `sources` row is `last_good`. */
  lastGood: boolean;
  demo: boolean;
}) {
  const words = INPUTS[c.id];
  const raw = rawParts(c);
  const whole = c.counted ? wholeScore(c) : null;
  const sentence = percentileSentence(c);
  const notCounted = notCountedLine(c);
  // An uncounted input keeps its value and date, dimmed (a solid token, never opacity: rule 13).
  const ink = (t: Theme, normal: string) => (c.counted ? normal : extrasFor(t).textDim);
  return (
    <Box
      component="li"
      sx={{
        ...GRID,
        gridTemplateAreas: ROW_AREAS,
        alignItems: 'start',
        py: 1.25,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ gridArea: 'label', minWidth: 0, display: 'grid', gap: '2px', lineHeight: 1.4 }}>
        <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>
          {words.name}
        </Box>
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
          {words.what}
        </Box>
      </Box>
      <Box
        sx={{
          gridArea: 'raw',
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2px 8px',
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {raw ? (
          <Box component="span" sx={(t) => ({ color: ink(t, t.palette.text.secondary) })}>
            <Box
              component="span"
              sx={(t) => ({ ...MONO, fontSize: 13, color: ink(t, t.palette.text.primary) })}
            >
              {raw.figure}
            </Box>
            {raw.rest}
          </Box>
        ) : (
          // A not-a-number member: Sans, never a figure (rule 24).
          <Box component="span" sx={{ fontSize: 13 }}>
            unavailable
          </Box>
        )}
        {c.as_of && (
          <Box
            component="span"
            sx={(t) => ({ ...MONO, fontSize: 11, color: ink(t, t.palette.text.secondary) })}
          >
            {`as of ${shortDate(c.as_of)}`}
          </Box>
        )}
        {lastGood && <DataStateTag state="lastGood" />}
      </Box>
      <Box sx={{ gridArea: 'bar', minWidth: 0, alignSelf: 'center' }}>
        {c.score != null && <Bar score={c.score} counted={c.counted} />}
      </Box>
      <Box
        sx={{
          gridArea: 'score',
          position: 'relative',
          minWidth: 0,
          textAlign: { xs: 'right', tablet: 'left' },
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}
      >
        {whole == null ? (
          // Uncounted: a dash, Sans, and no band word.
          <Box component="span" sx={{ fontSize: 15 }}>
            —
          </Box>
        ) : (
          <>
            <Box component="span" aria-hidden>
              <Box component="span" sx={{ ...MONO, fontSize: 15, fontWeight: 500 }}>
                {whole}
              </Box>{' '}
              <Box component="span" sx={{ fontSize: 12 }}>
                {BAND_WORD[bandOf(whole)]}
              </Box>
            </Box>
            <Box component="span" sx={visuallyHidden}>
              {`score ${whole} of 100, ${BAND_WORD[bandOf(whole)]}`}
            </Box>
          </>
        )}
      </Box>
      <Box
        sx={{
          gridArea: 'sent',
          minWidth: 0,
          display: 'grid',
          gap: 0.25,
          fontSize: 12.5,
          lineHeight: 1.45,
          textWrap: 'pretty',
        }}
      >
        {sentence && (
          <Box component="p" sx={(t) => ({ m: 0, color: ink(t, t.palette.text.secondary) })}>
            {sentence}
          </Box>
        )}
        {notCounted && (
          <Box component="p" sx={{ m: 0, color: 'text.primary' }}>
            {notCounted}
          </Box>
        )}
      </Box>
      <Box
        sx={{
          gridArea: 'cred',
          minWidth: 0,
          fontSize: 11.5,
          lineHeight: 1.4,
          color: 'text.secondary',
        }}
      >
        {demo ? CREDIT[c.source].demo : CREDIT[c.source].live}
      </Box>
    </Box>
  );
}

/** The 0–100 track with one marker at the score (aria-hidden: the row's text says it). The Neutral
 *  span is a band wash between two edge hairlines; the 25 and 75 edges are dotted hairlines; an
 *  uncounted input's marker steps down to the second context role (P-9), and its row says why. */
function Bar({ score, counted }: { score: number; counted: boolean }) {
  const at = Math.min(100, Math.max(0, score));
  return (
    <Box aria-hidden sx={{ position: 'relative', height: 16, mx: '2px' }}>
      <Box
        sx={(t) => ({
          position: 'absolute',
          left: 0,
          right: 0,
          top: 7,
          height: 2,
          borderRadius: '1px',
          bgcolor: chartRoles(t).grid,
        })}
      />
      <Box
        sx={(t) => ({
          position: 'absolute',
          left: '45%',
          width: '10%',
          top: 2,
          height: 12,
          boxSizing: 'border-box',
          bgcolor: chartRoles(t).band,
          borderLeft: `1px solid ${chartRoles(t).edge}`,
          borderRight: `1px solid ${chartRoles(t).edge}`,
        })}
      />
      {[25, 75].map((e) => (
        <Box
          key={e}
          sx={(t) => ({
            position: 'absolute',
            left: `${e}%`,
            top: 2,
            height: 12,
            borderLeft: `1px dotted ${chartRoles(t).edge}`,
          })}
        />
      ))}
      {[0, 100].map((e) => (
        <Box
          key={e}
          sx={(t) => ({
            position: 'absolute',
            left: `${e}%`,
            top: 3,
            height: 10,
            borderLeft: `1px solid ${chartRoles(t).axis}`,
          })}
        />
      ))}
      <Box
        sx={(t) => ({
          position: 'absolute',
          left: `${at}%`,
          top: 0,
          width: 4,
          height: 16,
          ml: '-2px',
          borderRadius: '2px',
          bgcolor: counted ? chartRoles(t).emph : chartRoles(t).ctx2,
          boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
        })}
      />
    </Box>
  );
}
