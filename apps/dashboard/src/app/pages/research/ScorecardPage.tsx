/**
 * The Scorecard: how the calls in the notes turn out. It reads every note's forecast ledger from the
 * build (no API), scores the ones that carried a probability and resolved (tools/research-notes/
 * scoring.mjs), and says plainly when there is nothing to score yet. A probability lives in the note's
 * Markdown, so the action here is copying the row to fill in, never a field that would pretend to save.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { localToday, researchIndex, scoreForecasts } from 'virtual:convexa-research';
import { formatNoteDate, formatShortDate } from './format';
import { ResearchColumn } from './NotesView';
import { ResearchTabs } from './ResearchTabs';
import type { LedgerForecast } from './types';
import { DISPLAY, MONO, PANEL_SX } from './ui';

type Row = LedgerForecast & { ticker: string; id: string };

const CALIBRATION_MIN = 20;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const caps = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const;

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ScorecardPage() {
  const today = useMemo(() => localToday(), []);
  const rows: Row[] = useMemo(
    () =>
      researchIndex.flatMap((r) =>
        r.latest.forecasts.map((f, i) => ({ ...f, ticker: r.ticker, id: `${r.ticker}-${i}` })),
      ),
    [],
  );
  const score = useMemo(() => scoreForecasts(rows), [rows]);
  const open = rows.filter((f) => f.outcome === null);
  const horizon = addDays(today, 14);
  const soon = open
    .filter((f) => f.resolveBy.end && f.resolveBy.end >= today && f.resolveBy.end <= horizon)
    .sort((a, b) => (a.resolveBy.end ?? '').localeCompare(b.resolveBy.end ?? ''));
  const pastDue = open
    .filter((f) => f.resolveBy.end && f.resolveBy.end < today)
    .sort((a, b) => (a.resolveBy.end ?? '').localeCompare(b.resolveBy.end ?? ''));
  const soonUnset = soon.filter((f) => f.p === null).length;

  return (
    <ResearchColumn>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 4,
          pt: { xs: 1, md: 2 },
        }}
      >
        <ResearchTabs />
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box
            component="h1"
            sx={{
              ...DISPLAY,
              m: 0,
              fontWeight: 800,
              fontSize: { xs: 36, md: 48 },
              lineHeight: 1.05,
            }}
          >
            Scorecard
          </Box>
          <Box
            component="p"
            sx={{
              m: 0,
              maxWidth: '66ch',
              color: 'text.secondary',
              fontSize: 16,
              textWrap: 'pretty',
            }}
          >
            How the calls in the notes turn out. A forecast is scored when its date passes, but only
            if it carried your probability before then. Scoring a call after the answer is known
            would be fiction.
          </Box>
        </Box>

        <Ledger score={score} firstDate={soon[0]?.resolveBy.end ?? null} />

        {pastDue.length > 0 && (
          <ForecastList
            title={`${pastDue.length} past ${pastDue.length === 1 ? 'its date' : 'their dates'} and waiting for an outcome.`}
            hint="Add yes, no or void as the fifth cell of each row, set updated: in the front matter, and log it in the change log."
            rows={pastDue}
          />
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: '999 1 560px', minWidth: 0 }}>
            <ForecastList
              title={
                soon.length === 0
                  ? 'Nothing resolves in the next two weeks.'
                  : `${countWord(soon.length)} ${soon.length === 1 ? 'forecast resolves' : 'forecasts resolve'} in the next two weeks${
                      soonUnset === soon.length
                        ? ', all still without a probability.'
                        : soonUnset > 0
                          ? `; ${soonUnset} without a probability.`
                          : '.'
                    }`
              }
              hint="Copy a row, paste it over the same row in the note's forecasts block, replace ___ with your probability, and push. The check refuses the row until you do."
              rows={soon}
            />
          </Box>
          <Box sx={{ flex: '1 1 360px', minWidth: 0 }}>
            <ByMonth open={open} today={today} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: '1 1 480px', minWidth: 0 }}>
            <Calibration score={score} today={today} />
          </Box>
          <Box sx={{ flex: '1 1 480px', minWidth: 0 }}>
            <SignalsOff />
          </Box>
        </Box>

        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
          Forecasts come from each note&apos;s forecasts block. Personal research notes. Not
          financial advice.
        </Box>
      </Box>
    </ResearchColumn>
  );
}

function countWord(n: number) {
  const words = [
    'No',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
  ];
  return n < words.length ? words[n] : String(n);
}

function Ledger({
  score,
  firstDate,
}: {
  score: ReturnType<typeof scoreForecasts>;
  firstDate: string | null;
}) {
  const cell = (label: string, value: React.ReactNode, sub: string) => (
    <Box
      sx={(t) => ({
        p: '16px 20px',
        display: 'grid',
        gap: 0.5,
        alignContent: 'start',
        bgcolor: 'background.paper',
        minWidth: 0,
        boxShadow: `inset -1px 0 0 ${t.palette.divider}`,
      })}
    >
      <Box component="span" sx={caps}>
        {label}
      </Box>
      {value}
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        {sub}
      </Box>
    </Box>
  );
  const figure = (v: string) => (
    <Box component="span" sx={{ ...MONO, fontSize: 26, fontWeight: 500, lineHeight: 1.2 }}>
      {v}
    </Box>
  );
  return (
    <Box
      component="section"
      aria-label="Forecast ledger"
      sx={{
        ...PANEL_SX,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
      }}
    >
      {cell('Open forecasts', figure(String(score.open)), `across ${researchIndex.length} notes`)}
      {cell(
        'With your probability',
        figure(String(score.withProbability)),
        score.withProbability === 0 ? 'the notes leave it blank for you' : `of ${score.total}`,
      )}
      {cell(
        'Resolved',
        figure(String(score.resolved)),
        score.resolved === 0 && firstDate
          ? `first on ${formatShortDate(firstDate)}`
          : `${score.scored} scored`,
      )}
      {cell(
        'Brier score',
        score.brier === null ? (
          <Box
            component="span"
            sx={{ fontSize: 17, fontWeight: 500, color: 'text.secondary', py: '5px' }}
          >
            not set
          </Box>
        ) : (
          figure(score.brier.toFixed(3))
        ),
        score.brier === null
          ? 'needs resolved calls that carried a probability'
          : 'saying 50% to everything scores 0.250',
      )}
    </Box>
  );
}

function ForecastList({ title, hint, rows }: { title: string; hint: string; rows: Row[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const copy = async (row: Row) => {
    try {
      await navigator.clipboard.writeText(row.row);
      setCopied(row.id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };
  return (
    <Box
      component="section"
      sx={{
        ...PANEL_SX,
        p: { xs: 2, sm: 3 },
        display: 'grid',
        gap: 1.75,
        height: '100%',
        alignContent: 'start',
      }}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Box
          component="h2"
          sx={{
            ...DISPLAY,
            m: 0,
            fontWeight: 600,
            fontSize: 20,
            lineHeight: 1.25,
            textWrap: 'balance',
          }}
        >
          {title}
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
          {hint}
        </Box>
      </Box>
      <Box
        component="span"
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {copied ? 'Row copied' : ''}
      </Box>
      {rows.length > 0 && (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
          {rows.map((f) => (
            <Box
              component="li"
              key={f.id}
              sx={(t) => ({
                display: 'grid',
                gridTemplateColumns: {
                  xs: '56px minmax(0, 1fr)',
                  sm: '64px 52px minmax(0, 1fr) auto auto',
                },
                gap: { xs: '4px 12px', sm: 1.5 },
                alignItems: 'center',
                py: 1.25,
                borderTop: `1px solid ${t.palette.divider}`,
                fontSize: 13,
              })}
            >
              <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
                {f.resolveBy.end ? formatShortDate(f.resolveBy.end) : f.resolveBy.label}
              </Box>
              <Box
                component="span"
                sx={(t) => ({
                  ...MONO,
                  justifySelf: 'start',
                  fontSize: 11,
                  fontWeight: 600,
                  px: 0.75,
                  py: '2px',
                  borderRadius: '5px',
                  bgcolor: alpha(t.palette.text.secondary, 0.16),
                })}
              >
                {f.ticker}
              </Box>
              <Box
                component="span"
                sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, minWidth: 0, textWrap: 'pretty' }}
              >
                {f.claim}
              </Box>
              <Box
                component="span"
                sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}
              >
                {f.p === null ? 'not set' : `${Math.round(f.p * 100)}%`}
              </Box>
              <Box
                component="button"
                type="button"
                onClick={() => void copy(f)}
                aria-label={`Copy the Markdown row for: ${f.claim}`}
                sx={(t) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifySelf: 'start',
                  gap: 0.75,
                  minHeight: 32,
                  px: 1.25,
                  borderRadius: '8px',
                  border: `1px solid ${alpha(t.palette.text.secondary, copied === f.id ? 0.55 : 0.3)}`,
                  bgcolor: copied === f.id ? alpha(t.palette.text.primary, 0.05) : 'transparent',
                  color: 'text.primary',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'transform 100ms ease-out',
                  '&:active': { transform: 'scale(0.98)' },
                  '@media (pointer: coarse)': { minHeight: 44 },
                })}
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {copied === f.id ? (
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  ) : (
                    <>
                      <rect x="8" y="8" width="12" height="12" rx="2" />
                      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
                    </>
                  )}
                </svg>
                {copied === f.id ? 'Copied' : 'Copy row'}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** The Scorecard's charts are Convexa's own figures, worked out from its notes: solid on the live
 *  site, dashed sample data on the demo (canon P-8). */
const notesFrame = (today: string) =>
  dataMode === 'demo'
    ? {
        provenance: 'sample' as const,
        tag: { state: 'demo' as const },
        source: { text: 'Demo · sample research notes' },
        asOf: 'Scenario · Oct 7, 2026',
      }
    : {
        provenance: 'primary' as const,
        tag: { state: 'computed' as const },
        source: { text: 'Convexa research notes · forecasts' },
        asOf: `As of ${formatNoteDate(today)}`,
      };

function ByMonth({ open, today }: { open: Row[]; today: string }) {
  // Eleven columns: this month and the ten after it, then everything later in one.
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const keys = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  const counts = keys.map((k) => open.filter((f) => f.resolveBy.end?.slice(0, 7) === k).length);
  const later = open.filter(
    (f) => !f.resolveBy.end || f.resolveBy.end.slice(0, 7) > keys[keys.length - 1],
  ).length;
  const cols = [...counts, later];
  const labels = [...keys.map((k) => MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 1)), 'Later'];
  const max = Math.max(...cols, 1);
  const byNextMonth = counts[0] + counts[1];
  const nextMonthName = MONTHS[Number(keys[1].slice(5, 7)) - 1];
  const aria = `Open forecasts by the month they resolve: ${keys
    .map((k, i) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)} ${counts[i]}`)
    .join(', ')}, later ${later}`;
  return (
    <ChartFrame
      finding={`${byNextMonth} of the ${open.length} resolve by the end of ${nextMonthName}.`}
      metric="Open forecasts by month"
      sub={`Open forecasts by the month their date falls in · count · from ${MONTHS[Number(keys[0].slice(5, 7)) - 1]} ${keys[0].slice(0, 4)} · this month and next emphasised`}
      height={190}
      {...notesFrame(today)}
      table={{
        caption: 'Open forecasts by the month they resolve',
        cols: ['Month', 'Open forecasts'],
        rows: [
          ...keys.map((k, i) => [
            `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`,
            counts[i],
          ]),
          ['Later', later],
        ],
      }}
      testId="chart-by-month"
    >
      <Box
        role="img"
        aria-label={aria}
        sx={(t) => ({
          display: 'grid',
          gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
          gap: 0.75,
          alignItems: 'end',
          height: 170,
          borderBottom: `1px solid ${chartRoles(t).axis}`,
        })}
      >
        {cols.map((n, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 0.5,
              height: '100%',
            }}
          >
            <Box
              component="span"
              sx={{ ...MONO, fontSize: 11, color: i < 2 ? 'text.primary' : 'text.secondary' }}
            >
              {n}
            </Box>
            <Box
              sx={(t) => ({
                width: '100%',
                maxWidth: 32,
                height: n === 0 ? 2 : Math.round((n / max) * 140),
                borderRadius: '4px 4px 1px 1px',
                bgcolor: i < 2 ? chartRoles(t).emph : chartRoles(t).ctx,
              })}
            />
          </Box>
        ))}
      </Box>
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
          gap: 0.75,
          ...MONO,
          fontSize: 11,
          color: 'text.secondary',
          textAlign: 'center',
        }}
      >
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </Box>
    </ChartFrame>
  );
}

function Calibration({
  score,
  today,
}: {
  score: ReturnType<typeof scoreForecasts>;
  today: string;
}) {
  const ready = score.scored >= CALIBRATION_MIN;
  const X = (p: number) => 32 + p * 200;
  const Y = (p: number) => 208 - p * 200;
  // How far, on average, calls came true from the odds they were given (weighted by calls per bin).
  const gap = ready
    ? score.bins.reduce((a, b) => a + Math.abs(b.hitRate - b.meanP) * b.n, 0) /
      Math.max(
        1,
        score.bins.reduce((a, b) => a + b.n, 0),
      )
    : 0;
  return (
    <ChartFrame
      finding={`Calls came true within ${Math.round(gap * 100)} points of their stated odds, on average${score.brier === null ? '' : `; Brier ${score.brier.toFixed(3)}`}`}
      metric="Calibration"
      sub="How often calls made at each confidence came true · your probability across, in tenths · how often it happened up · on the diagonal, calls are well calibrated"
      height={240}
      status={
        ready
          ? { kind: 'ready' }
          : {
              kind: 'message',
              tone: 'quiet',
              text: `${score.scored} of ${CALIBRATION_MIN} forecasts with a probability have resolved.`,
              cause: `The chart appears at ${CALIBRATION_MIN}: fewer calls than that can’t show whether 70% calls come true about 70% of the time, so nothing is drawn until then.`,
            }
      }
      {...notesFrame(today)}
      // A tag says what the drawn figures are; with nothing drawn there is nothing to tag.
      tag={ready ? notesFrame(today).tag : undefined}
      note="Brier score is the average squared miss. Saying 50% to everything scores 0.25; lower is better."
      table={{
        caption: 'Calibration by probability bin',
        cols: ['Probability', 'Calls', 'Mean probability', 'Came true'],
        rows: score.bins.map((b) => [
          `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%`,
          b.n,
          `${Math.round(b.meanP * 100)}%`,
          `${Math.round(b.hitRate * 100)}%`,
        ]),
      }}
      testId="chart-calibration"
    >
      <Box
        component="svg"
        role="img"
        aria-label={`Calibration: ${score.bins.map((b) => `${Math.round(b.meanP * 100)}% calls came true ${Math.round(b.hitRate * 100)}% of ${b.n}`).join('; ')}`}
        viewBox="0 0 240 240"
        sx={{ width: 240, height: 240, maxWidth: '100%' }}
      >
        <Box
          component="rect"
          x="32"
          y="8"
          width="200"
          height="200"
          sx={(t) => ({ fill: 'transparent', stroke: chartRoles(t).axis })}
        />
        <Box
          component="line"
          x1="32"
          y1="208"
          x2="232"
          y2="8"
          sx={(t) => ({ stroke: chartRoles(t).edge, strokeDasharray: '4 4' })}
        />
        <Box
          component="g"
          sx={{
            fontFamily: MONO.fontFamily,
            fontSize: 11,
            fill: 'currentColor',
            color: 'text.secondary',
          }}
        >
          <text x="26" y="211" textAnchor="end">
            0
          </text>
          <text x="26" y="111" textAnchor="end">
            50%
          </text>
          <text x="26" y="12" textAnchor="end">
            100%
          </text>
          <text x="32" y="224" textAnchor="middle">
            0
          </text>
          <text x="132" y="224" textAnchor="middle">
            50%
          </text>
          <text x="232" y="224" textAnchor="middle">
            100%
          </text>
        </Box>
        {score.bins.map((b) => (
          <Box
            component="circle"
            key={b.lo}
            cx={X(b.meanP)}
            cy={Y(b.hitRate)}
            r={3 + Math.sqrt(b.n) * 1.5}
            sx={(t) => ({ fill: chartRoles(t).emph })}
          />
        ))}
      </Box>
    </ChartFrame>
  );
}

function SignalsOff() {
  return (
    <Box
      component="section"
      aria-labelledby="signals-off"
      sx={(t) => ({
        ...PANEL_SX,
        border: `1px solid ${alpha(t.palette.text.secondary, 0.25)}`,
        p: { xs: 2, sm: 3 },
        display: 'grid',
        gap: 1.5,
        height: '100%',
        alignContent: 'start',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Box
          component="h2"
          id="signals-off"
          sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 20 }}
        >
          Signal track record
        </Box>
        <Box
          component="span"
          sx={(t) => ({
            fontSize: 11,
            px: 1,
            py: '2px',
            borderRadius: '999px',
            border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
            color: 'text.secondary',
          })}
        >
          off
        </Box>
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 14, textWrap: 'pretty' }}>
        Grading the scanner&apos;s setups means pricing what happened after each one, net of trading
        costs. That needs a price history licensed for public display, and the free feeds are for
        personal use only.
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
          gap: '8px 16px',
          fontSize: 13,
        }}
      >
        <Box component="dt" sx={{ color: 'text.secondary' }}>
          Would show
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          Hit rate and average move after costs, by setup
        </Box>
        <Box component="dt" sx={{ color: 'text.secondary' }}>
          Would need
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          Daily closes for every scanned symbol, with display rights
        </Box>
        <Box component="dt" sx={{ color: 'text.secondary' }}>
          Meanwhile
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          Run privately on the demo&apos;s sample data
        </Box>
      </Box>
    </Box>
  );
}
