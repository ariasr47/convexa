/**
 * The Scorecard: how the calls in the notes turn out. It reads every note's forecast ledger from the
 * build (no API), scores the ones that carried a probability and resolved (tools/research-notes/
 * scoring.mjs), and says plainly when there is nothing to score yet. A probability lives in the note's
 * Markdown, so the action here is copying the row to fill in, never a field that would pretend to save.
 *
 * The demo build reads the six sample notes' ledger instead (sampleLedger.ts), with an authored scored
 * history, on the scenario's own date, every frame dashed as sample data (canon P-3, P-8).
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { STAGING_DEMO_SYMBOLS, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { dataMode, type SampleSignalGrade } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { localToday, researchIndex, scoreForecasts } from 'virtual:convexa-research';
import { formatNoteDate, formatShortDate } from './format';
import { ResearchColumn } from './NotesView';
import { ProvenanceChip } from './publicUi';
import { ResearchTabs } from './ResearchTabs';
import { useSampleLedger } from './sampleLedger';
import type { LedgerForecast } from './types';
import { DISPLAY, MONO, PANEL_SX } from './ui';
import { useWidth } from './useWidth';
import { wilson } from './wilson';

type Row = LedgerForecast & { ticker: string; id: string };

const DEMO = dataMode === 'demo';
const CALIBRATION_MIN = 20;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

const LIVE_ROWS: Row[] = researchIndex.flatMap((r) =>
  r.latest.forecasts.map((f, i) => ({ ...f, ticker: r.ticker, id: `${r.ticker}-${i}` })),
);

export function ScorecardPage() {
  const ledger = useSampleLedger();
  const liveToday = useMemo(() => localToday(), []);
  // The demo is read on its scenario's day, so its past-due and next-two-weeks rows stay put.
  const today = DEMO ? (ledger?.today ?? '2026-10-07') : liveToday;
  const rows: Row[] = useMemo(
    () =>
      DEMO
        ? (ledger?.forecasts ?? []).map((f, i) => ({ ...f, id: `${f.ticker}-${i}` }))
        : LIVE_ROWS,
    [ledger],
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
  const waiting = DEMO && ledger === undefined;

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
          {DEMO && (
            <Box>
              <ProvenanceChip
                text="Demo · the sample notes’ forecasts · scenario of Oct 7, 2026"
                kind="sample"
              />
            </Box>
          )}
        </Box>

        {waiting ? (
          <Box
            aria-busy="true"
            aria-label="Loading the sample forecasts"
            sx={(t) => ({
              ...PANEL_SX,
              height: 120,
              bgcolor: alpha(t.palette.text.secondary, 0.06),
            })}
          />
        ) : DEMO && ledger === null ? (
          <Box component="p" role="status" sx={{ m: 0, color: 'text.secondary' }}>
            The sample forecasts didn&apos;t load. Reload the page to try again.
          </Box>
        ) : (
          <>
            <Ledger score={score} open={open} firstDate={soon[0]?.resolveBy.end ?? null} />

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
                              : `; ${soon.length === 1 ? 'it carries' : 'all carry'} a probability.`
                        }`
                  }
                  hint={
                    DEMO
                      ? 'Sample forecasts on the demo’s authored price paths.'
                      : "Copy a row, paste it over the same row in the note's forecasts block, replace ___ with your probability, and push. The check refuses the row until you do."
                  }
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
                {DEMO && ledger ? <SignalsSample grades={ledger.signals} /> : <SignalsOff />}
              </Box>
            </Box>
          </>
        )}

        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
          {DEMO
            ? 'Sample forecasts and outcomes authored for the demo. Not financial advice.'
            : "Forecasts come from each note's forecasts block. Personal research notes. Not financial advice."}
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
  open,
  firstDate,
}: {
  score: ReturnType<typeof scoreForecasts>;
  open: Row[];
  firstDate: string | null;
}) {
  // Probabilities that still count: an open call can get one; a resolved one never can.
  const openWithP = open.filter((f) => f.p !== null).length;
  const notes = DEMO ? STAGING_DEMO_SYMBOLS.length : researchIndex.length;
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
      sx={(t) => ({
        ...PANEL_SX,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
        ...(DEMO && { border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}` }),
      })}
    >
      {cell(
        'Open forecasts',
        figure(String(score.open)),
        DEMO ? `across the ${notes} sample notes` : `across ${notes} notes`,
      )}
      {cell(
        'With your probability',
        figure(String(openWithP)),
        openWithP === 0 ? 'the notes leave it blank for you' : `of ${open.length} open`,
      )}
      {cell(
        'Resolved',
        figure(String(score.resolved)),
        score.resolved === 0 && firstDate
          ? `first on ${formatShortDate(firstDate)}`
          : DEMO
            ? 'scored in the sample history'
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
      sx={(t) => ({
        ...PANEL_SX,
        p: { xs: 2, sm: 3 },
        display: 'grid',
        gap: 1.75,
        height: '100%',
        alignContent: 'start',
        ...(DEMO && { border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}` }),
      })}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px 10px' }}>
          <Box
            component="h2"
            sx={{
              ...DISPLAY,
              m: 0,
              flex: '1 1 260px',
              fontWeight: 600,
              fontSize: 20,
              lineHeight: 1.25,
              textWrap: 'balance',
            }}
          >
            {title}
          </Box>
          {DEMO && <DataStateTag state="demo" />}
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
                {f.p === null ? 'not set' : `P ${Math.round(f.p * 100)}%`}
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
  DEMO
    ? {
        provenance: 'sample' as const,
        tag: { state: 'demo' as const },
        source: { text: 'Demo · the sample notes’ forecasts' },
        asOf: 'Scenario · Oct 7, 2026',
      }
    : {
        provenance: 'primary' as const,
        tag: { state: 'computed' as const },
        source: { text: 'Convexa research notes · forecasts' },
        asOf: `As of ${formatNoteDate(today)}`,
      };

function ByMonth({ open, today }: { open: Row[]; today: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  // Past due first (so the bars sum to every open call), then this month and the nine after it, then
  // everything later in one.
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const keys = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  const due = open.filter((f) => f.resolveBy.end && f.resolveBy.end < today);
  const ahead = open.filter((f) => !f.resolveBy.end || f.resolveBy.end >= today);
  const counts = keys.map((k) => ahead.filter((f) => f.resolveBy.end?.slice(0, 7) === k).length);
  const later = ahead.filter(
    (f) => !f.resolveBy.end || f.resolveBy.end.slice(0, 7) > keys[keys.length - 1],
  ).length;
  const cols = [
    ...(due.length ? [{ key: 'due', long: 'Due', name: 'Past due', n: due.length }] : []),
    ...keys.map((k, i) => ({
      key: k,
      // Three letters always: one letter repeats (J, M, A). A new year names itself.
      long:
        k.slice(5, 7) === '01' && k.slice(0, 4) !== keys[0].slice(0, 4)
          ? `Jan ’${k.slice(2, 4)}`
          : monthName(k),
      short: monthName(k),
      name: `${monthName(k)} ${k.slice(0, 4)}`,
      n: counts[i],
    })),
    { key: 'later', long: 'Later', name: 'Later', n: later },
  ];
  // This month and next are the near term, with anything already past due.
  const near = (i: number) => i < (due.length ? 3 : 2);
  const max = Math.max(...cols.map((c) => c.n), 1);
  const byNext = due.length + counts[0] + counts[1];
  const nextMonthName = MONTHS_LONG[Number(keys[1].slice(5, 7)) - 1];
  // Room per column decides whether "Jan ’27" fits or the year moves to the table.
  const wide = width / cols.length >= 40;
  return (
    <ChartFrame
      finding={`${byNext} of the ${open.length} open forecasts resolve by the end of ${nextMonthName}${
        due.length ? `, ${due.length} of them already past due` : ''
      }`}
      metric="Open forecasts by month"
      sub={`Open forecasts by the month their date falls in · count · ${due.length ? 'past due first, so the bars sum to the total · ' : ''}${monthName(keys[0])} ${keys[0].slice(0, 4)} – ${monthName(keys[keys.length - 1])} ${keys[keys.length - 1].slice(0, 4)}, then later`}
      height={190}
      {...notesFrame(today)}
      table={{
        caption: 'Open forecasts by the month they resolve',
        cols: ['Month', 'Open forecasts'],
        rows: cols.map((c) => [c.name, c.n]),
      }}
      testId="chart-by-month"
    >
      <Box ref={ref} sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
        <Box
          role="img"
          aria-label={`Open forecasts by the month they resolve: ${cols.map((c) => `${c.name} ${c.n}`).join(', ')}`}
          sx={(t) => ({
            display: 'grid',
            // "Later" is the one long label: its column takes the room it needs.
            gridTemplateColumns: `repeat(${cols.length - 1}, minmax(0, 1fr)) minmax(0, 1.7fr)`,
            gap: { xs: 0.5, sm: 0.75 },
            alignItems: 'end',
            height: 170,
            borderBottom: `1px solid ${chartRoles(t).axis}`,
          })}
        >
          {cols.map((c, i) => (
            <Box
              key={c.key}
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
                sx={{ ...MONO, fontSize: 11, color: near(i) ? 'text.primary' : 'text.secondary' }}
              >
                {c.n}
              </Box>
              <Box
                sx={(t) => ({
                  width: '100%',
                  maxWidth: 32,
                  height: c.n === 0 ? 2 : Math.round((c.n / max) * 140),
                  borderRadius: '4px 4px 1px 1px',
                  bgcolor: near(i) ? chartRoles(t).emph : chartRoles(t).ctx,
                })}
              />
            </Box>
          ))}
        </Box>
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            // "Later" is the one long label: its column takes the room it needs.
            gridTemplateColumns: `repeat(${cols.length - 1}, minmax(0, 1fr)) minmax(0, 1.7fr)`,
            gap: { xs: 0.5, sm: 0.75 },
            ...MONO,
            fontSize: 11,
            color: 'text.secondary',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {cols.map((c) => (
            <Box
              component="span"
              key={c.key}
              sx={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}
            >
              {wide || !('short' in c) ? c.long : c.short}
            </Box>
          ))}
        </Box>
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
  const t = useTheme();
  const roles = chartRoles(t);
  const [ref, width] = useWidth<HTMLDivElement>();
  const ready = score.scored >= CALIBRATION_MIN;
  // Each bin's hits, its 95% interval and how many calls it holds: a dot is never drawn without both.
  const bins = score.bins.map((b) => {
    const k = Math.round(b.hitRate * b.n);
    const [ciLo, ciHi] = wilson(k, b.n);
    return { ...b, k, ciLo, ciHi };
  });
  // How far, on average, calls came true from the odds they were given (weighted by calls per bin).
  const total = bins.reduce((a, b) => a + b.n, 0);
  const gap = ready ? bins.reduce((a, b) => a + Math.abs(b.hitRate - b.meanP) * b.n, 0) / total : 0;
  const thin = ready ? bins.reduce((a, b) => (b.n < a.n ? b : a), bins[0]) : null;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const W = Math.max(260, Math.min(width, 560));
  const H = 300;
  const L = 44;
  const R = 16;
  const T = 30;
  const B = 34;
  const X = (p: number) => L + p * (W - L - R);
  const Y = (v: number) => T + (1 - v) * (H - T - B);
  const narrow = W < 420;
  // Each bin's "n" sits above its interval, or below it when that spot is taken, and never on a dot,
  // the axis label or another n (D-24: at 390 px "n 12" ran into "n 5", and a bin true 100% of the
  // time had its n printed over its dot). Thin bins are placed first: their n is the warning. A label
  // with no free spot is left to the table, as the busy middle bins already are on a narrow plot.
  const CH = 6.7; // one mono character at 11px
  type Rect = { x0: number; x1: number; y0: number; y1: number };
  const hits = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const taken: Rect[] = [
    { x0: L - 6, x1: L - 6 + 11 * CH, y0: T - 20, y1: T - 8 }, // "came true ↑"
    ...bins.map((b) => {
      const x = X(b.meanP);
      const y = Y(b.hitRate);
      return { x0: x - 5, x1: x + 5, y0: y - 5, y1: y + 5 };
    }),
  ];
  const nLabels = new Map<number, number>();
  for (const b of [...bins].sort((a, c) => a.n - c.n)) {
    // On a narrow plot, the busy middle bins keep their n in the table only.
    if (narrow && b.n > 20 && b.meanP >= 0.2 && b.meanP <= 0.8) continue;
    const x = X(b.meanP);
    const half = (`n ${b.n}`.length * CH) / 2 + 2;
    for (const y of [Y(b.ciHi) - 7, Y(b.ciLo) + 15]) {
      const box = { x0: x - half, x1: x + half, y0: y - 10, y1: y + 1 };
      if (box.y0 < 0 || box.y1 > H - B - 2 || taken.some((r) => hits(r, box))) continue;
      taken.push(box);
      nLabels.set(b.lo, y);
      break;
    }
  }
  return (
    <ChartFrame
      finding={`Calls came true within ${Math.round(gap * 100)} points of their stated odds, on average${
        thin && thin.n < 10
          ? `; the ${pct(thin.lo)}–${pct(thin.hi)} bin holds only ${thin.n} calls, too few to judge`
          : ''
      }`}
      metric="Calibration"
      sub={`How often calls made at each stated probability came true, in tenths · ${score.scored} scored calls · dot = how often they came true, bar = its 95% interval (Wilson), n = calls in the bin · on the dashed diagonal, calls are well calibrated${score.brier === null ? '' : ` · Brier ${score.brier.toFixed(3)}`}`}
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
      note="Brier score is the average squared miss. Saying 50% to everything scores 0.25; lower is better. A short bar means the bin holds enough calls to judge; a long one, that it doesn’t yet."
      table={{
        caption: 'Calibration by probability bin, with each bin’s 95% interval (Wilson)',
        cols: ['Probability', 'Calls', 'Came true', 'Rate', '95% interval'],
        rows: bins.map((b) => [
          `${pct(b.lo)}–${pct(b.hi)}`,
          b.n,
          b.k,
          pct(b.hitRate),
          `${pct(b.ciLo)}–${pct(b.ciHi)}`,
        ]),
      }}
      testId="chart-calibration"
    >
      <Box ref={ref} sx={{ minWidth: 0 }}>
        {width > 0 && (
          <svg
            role="img"
            aria-label={`Calibration: ${bins.map((b) => `${pct(b.meanP)} calls came true ${pct(b.hitRate)} of ${b.n}, 95% interval ${pct(b.ciLo)} to ${pct(b.ciHi)}`).join('; ')}`}
            width={W}
            height={H}
            style={{ display: 'block' }}
          >
            <g fontFamily={MONO.fontFamily} fontSize={11} fill={t.palette.text.secondary}>
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={roles.grid} />
                  <line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke={roles.grid} />
                  <text x={L - 6} y={Y(v) + 4} textAnchor="end">
                    {v === 0 ? '0' : pct(v)}
                  </text>
                  <text
                    x={X(v)}
                    y={H - B + 16}
                    textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}
                  >
                    {v === 0 ? '0' : v === 1 ? '100% said' : pct(v)}
                  </text>
                </g>
              ))}
              <text x={L - 6} y={T - 10} textAnchor="start">
                came true ↑
              </text>
            </g>
            <line
              x1={X(0)}
              y1={Y(0)}
              x2={X(1)}
              y2={Y(1)}
              stroke={roles.edge}
              strokeDasharray="5 5"
            />
            {bins.map((b) => {
              const x = X(b.meanP);
              const nY = nLabels.get(b.lo);
              return (
                <g key={b.lo}>
                  <line
                    x1={x}
                    x2={x}
                    y1={Y(b.ciLo)}
                    y2={Y(b.ciHi)}
                    stroke={roles.ctx}
                    strokeWidth={1.5}
                  />
                  <line x1={x - 4} x2={x + 4} y1={Y(b.ciLo)} y2={Y(b.ciLo)} stroke={roles.ctx} />
                  <line x1={x - 4} x2={x + 4} y1={Y(b.ciHi)} y2={Y(b.ciHi)} stroke={roles.ctx} />
                  <circle cx={x} cy={Y(b.hitRate)} r={4.5} fill={roles.emph} />
                  {nY !== undefined && (
                    <text
                      x={x}
                      y={nY}
                      textAnchor="middle"
                      fontFamily={MONO.fontFamily}
                      fontSize={11}
                      fill={t.palette.text.secondary}
                    >
                      {`n ${b.n}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
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
        <DataStateTag state="notLive" detail="price source" />
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
          It runs on the demo&apos;s sample prices
        </Box>
      </Box>
      <Box
        component="a"
        href={`${STAGING_DEMO_URL}/research/scorecard`}
        sx={{
          justifySelf: 'start',
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 44,
          fontWeight: 500,
        }}
      >
        See it on the demo →
      </Box>
    </Box>
  );
}

/** Staging only: the scanner's setups graded on the demo's sample prices (authored sample grades). */
function SignalsSample({ grades }: { grades: SampleSignalGrade[] }) {
  const sorted = [...grades].sort((a, b) => b.hitRate - a.hitRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <ChartFrame
      finding={`${best.setup} setups came true most often after costs (${pct(best.hitRate)}); ${worst.setup.toLowerCase()} setups least (${pct(worst.hitRate)})`}
      metric="Signal track record"
      sub="Share of scanner setups that reached their named level within 5 sessions, after a 0.10% cost · by setup · n = setups graded · dashed line = half the time"
      height={200}
      provenance="sample"
      tag={{ state: 'demo' }}
      source={{ text: 'Demo · setups graded on sample prices' }}
      asOf="Scenario · Oct 7, 2026"
      table={{
        caption: 'Signal track record by setup, sample prices',
        cols: ['Setup', 'Setups graded', 'Came true'],
        rows: grades.map((g) => [g.setup, g.n, pct(g.hitRate)]),
      }}
      testId="chart-signals"
    >
      <Box
        role="img"
        aria-label={grades.map((g) => `${g.setup} ${pct(g.hitRate)} of ${g.n}`).join(', ')}
        sx={{ display: 'grid', gap: 1.25 }}
      >
        {grades.map((g) => (
          <Box key={g.setup} sx={{ display: 'grid', gap: 0.5 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
                fontSize: 13,
              }}
            >
              <span>
                {g.setup}{' '}
                <Box component="span" sx={{ ...MONO, fontSize: 11, color: 'text.secondary' }}>
                  n {g.n}
                </Box>
              </span>
              <Box component="span" sx={{ ...MONO, fontSize: 12 }}>
                {pct(g.hitRate)}
              </Box>
            </Box>
            <Box
              sx={(t) => ({
                position: 'relative',
                height: 10,
                borderRadius: '2px',
                bgcolor: chartRoles(t).band,
              })}
            >
              <Box
                sx={(t) => ({
                  width: pct(g.hitRate),
                  height: '100%',
                  borderRadius: '2px',
                  bgcolor: g === best ? chartRoles(t).emph : chartRoles(t).ctx,
                })}
              />
              <Box
                aria-hidden
                sx={(t) => ({
                  position: 'absolute',
                  left: '50%',
                  top: -3,
                  bottom: -3,
                  borderLeft: `1px dashed ${chartRoles(t).edge}`,
                })}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </ChartFrame>
  );
}
