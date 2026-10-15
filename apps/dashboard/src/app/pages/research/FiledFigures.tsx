/**
 * Checked against the filing (design: Planned · Figures against the filing, XBRL_SPEC). Each figure
 * the note states with its XBRL concept, beside the value the filing tagged for the same period, and
 * the check: Matches at the note's precision, Computed from tagged inputs, Differs with the gap
 * (warning glyph and burnt orange, never red or green), or Not tagged when no standard concept exists.
 * A check, not an editor: the note keeps its own figure. The comparison is
 * tools/research-notes/filing-check.mjs, the same code the author's research check runs.
 *
 * Below it, annual revenue as each 10-K first filed it, with a "Restated" marker where a later
 * filing changed a year.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { dataMode, type PublicAnnualRevenue, type PublicTicker } from '@convexa/api';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import FunctionsOutlined from '@mui/icons-material/FunctionsOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import type { ComponentType } from 'react';
import { checkFigures, researchIndex } from 'virtual:convexa-research';
import { formatNoteDate, formatShortDate } from './format';
import { billionsWord, currencyPrefix, formatBillions, inOneUnit, niceTicks } from './money';
import { tickerSecStale } from './secState';
import type { FiledCheckRow, FiledFiling, NoteFigure } from './types';
import { lowerLead, MONO } from './ui';
import { useWidth } from './useWidth';

const DEMO_DAY = '2026-10-07';
const NOT_SET_UP_CAUSE =
  'Figures are checked against the SEC’s company facts, through EDGAR. EDGAR asks every program that reads it to identify itself with a contact address; this site hasn’t been given one.';

/** Demo figures, written the way a note writes them, from the sample 10-Q: one a cent off, so the
 *  Differs form is visible. Sample only; production reads the note's own figures. */
function demoFigures(filing: FiledFiling | undefined): NoteFigure[] {
  if (!filing) return [];
  const fact = (c: string) => filing.tagged.find((t) => t.concept === c);
  const v = (c: string) => fact(c)?.value;
  const money = (c: string) => formatBillions(v(c) ?? 0, fact(c)?.unit ?? 'USD');
  const period = `Q${filing.fiscal_period?.slice(1) ?? '2'} FY${filing.fiscal_year ?? 2027}`;
  const out: NoteFigure[] = [];
  const rev = v('us-gaap:Revenues');
  const net = v('us-gaap:NetIncomeLoss');
  const eps = v('us-gaap:EarningsPerShareDiluted');
  const cash = v('us-gaap:CashAndCashEquivalentsAtCarryingValue');
  if (rev != null)
    out.push({
      label: 'Revenue',
      value: money('us-gaap:Revenues'),
      asOf: period,
      concept: 'us-gaap:Revenues',
      why: null,
    });
  if (net != null)
    out.push({
      label: 'Net income',
      value: money('us-gaap:NetIncomeLoss'),
      asOf: period,
      concept: 'us-gaap:NetIncomeLoss',
      why: null,
    });
  if (eps != null)
    out.push({
      label: 'Diluted EPS',
      value: `${currencyPrefix(fact('us-gaap:EarningsPerShareDiluted')?.unit ?? 'USD') ?? ''}${(eps + 0.01).toFixed(2)}`,
      asOf: period,
      concept: 'us-gaap:EarningsPerShareDiluted',
      why: null,
    });
  if (cash != null && filing.period_end)
    out.push({
      label: 'Cash and equivalents',
      value: money('us-gaap:CashAndCashEquivalentsAtCarryingValue'),
      asOf: filing.period_end,
      concept: 'us-gaap:CashAndCashEquivalentsAtCarryingValue',
      why: null,
    });
  return out;
}

const filingsOf = (d: PublicTicker): FiledFiling[] =>
  d.periodic.map((p) => ({
    accession: p.accession,
    form: p.form,
    filed: p.filed,
    period_end: p.period_end,
    // `?? …`: an API from before the filed figures existed reads as "not in yet", never as a match.
    fiscal_year: p.fiscal_year ?? null,
    fiscal_period: p.fiscal_period ?? null,
    tagged: p.tagged ?? [],
  }));

const ok = (r: FiledCheckRow) => ['matches', 'computed', 'not_tagged'].includes(r.status);
const waiting = (r: FiledCheckRow) => r.status === 'pending' || r.status === 'not_found';

/** The frame's title over checked figures (P-10): what differs, or that everything agrees. */
export function filedFinding(rows: FiledCheckRow[], form: string, demo: boolean): string {
  const lead = demo ? 'In the sample, ' : '';
  const say = (s: string) => (lead ? `${lead}${s.charAt(0).toLowerCase()}${s.slice(1)}` : s);
  const off = rows.filter((r) => !ok(r) && !waiting(r));
  const of = `${rows.length === 1 ? 'the one figure' : `${rows.length} figures`} in the note`;
  if (off.length === 1) {
    const r = off[0];
    return say(
      `One of ${of.replace(/^the one figure/, '1 figure')} ${r.status === 'differs' ? 'differs from' : 'can’t be matched to'} the ${r.form ?? form}: ${lowerLead(r.label)}${r.gap ? `, by ${r.gap}` : ''}`,
    );
  }
  if (off.length > 1) return say(`${off.length} of ${of} don’t match the ${form}`);
  const pending = rows.filter(waiting).length;
  if (pending === rows.length) return say(`None of ${of} is in a filing read yet`);
  if (pending)
    return say(
      `${rows.length - pending} of ${of} match the ${form}; ${pending} aren’t in a filing read yet`,
    );
  return say(
    `${rows.length === 1 ? 'The one figure' : `All ${rows.length} figures`} in the note match the ${form}`,
  );
}

export function FiledFiguresSection({ d }: { d: PublicTicker }) {
  // One currency per chart: a series that mixes units keeps the years in the unit most years use.
  const years = inOneUnit(d.annual_revenue ?? []);
  return (
    <Box component="section" aria-labelledby="checked-filing" sx={{ display: 'grid', gap: 1.75 }}>
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Box
          component="h2"
          id="checked-filing"
          sx={{
            m: 0,
            fontFamily: '"Archivo", "IBM Plex Sans", sans-serif',
            fontStretch: '112.5%',
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          Checked against the filing
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 13, color: 'text.secondary', maxWidth: '72ch', textWrap: 'pretty' }}
        >
          Every figure this note states, beside the value the company tagged in its filing for the
          same period. The note keeps its own figure; where they differ, both are shown.
        </Box>
      </Box>
      <CheckFrame d={d} />
      {d.filings_state === 'live' && years.length > 1 && <RevenueAsFiled d={d} years={years} />}
    </Box>
  );
}

function CheckFrame({ d }: { d: PublicTicker }) {
  const demo = dataMode === 'demo';
  const filings = filingsOf(d);
  const newest = filings.find((f) => f.tagged.length > 0) ?? filings[0];
  const figures = demo
    ? demoFigures(newest)
    : (researchIndex.find((r) => r.ticker === d.ticker)?.latest.figures ?? []);
  const metric = `${d.ticker} note figures against the filing`;
  const source = demo
    ? { text: 'Demo · shaped like SEC XBRL company facts' }
    : {
        text: 'SEC · XBRL company facts',
        href: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
      };
  const form = newest?.form ?? '10-Q';
  const sub = newest
    ? `Each figure the note states, beside the value the ${demo ? 'sample ' : ''}${form}${newest.period_end ? ` for the period to ${formatNoteDate(newest.period_end)}` : ''} (filed ${formatShortDate(newest.filed)}) tags for the same period · rounding to the note’s precision counts as a match`
    : 'Each figure the note states, beside the value its filing tags for the same period · rounding to the note’s precision counts as a match';
  const message = (
    tag: DataStateKey,
    tone: 'warn' | 'quiet',
    text: string,
    cause?: string,
    action?: React.ReactNode,
  ) => (
    <ChartFrame
      finding={metric}
      metric={metric}
      sub={sub}
      provenance={demo ? 'sample' : 'primary'}
      status={{ kind: 'message', tone, text, cause }}
      tag={{ state: tag }}
      height={150}
      source={source}
      action={action}
      testId="chart-filed-figures"
    />
  );
  if (d.filings_state === 'not_configured')
    return message(
      'notSetUp',
      'quiet',
      'SEC filings aren’t set up on this site yet.',
      NOT_SET_UP_CAUSE,
      <Box component="details" sx={{ fontSize: 12, color: 'text.secondary' }}>
        <Box component="summary" sx={{ cursor: 'pointer', minHeight: 24 }}>
          For the site’s operator
        </Box>
        <Box component="span" sx={{ ...MONO, fontSize: 11 }}>
          Set SEC_USER_AGENT on the API
        </Box>
      </Box>,
    );
  if (d.filings_state === 'off') return null;
  // A sample company the demo authors no quarterly report for (AAPL): nothing to check, and the
  // production copy about linking a note's figures doesn't apply to a sample.
  if (demo && filings.length === 0)
    return message(
      'demo',
      'quiet',
      `The sample authors no quarterly report for ${d.ticker}, so there is nothing to check its figures against.`,
    );
  if (d.filings_state === 'unavailable' && filings.length === 0)
    return message(
      'sourceDown',
      'warn',
      'Couldn’t load the filed figures.',
      `${d.filings_detail ?? 'SEC EDGAR didn’t answer.'} The note’s figures are unchanged.`,
    );
  if (figures.length === 0)
    return message(
      'computed',
      'quiet',
      'This note’s figures aren’t linked to the filing yet.',
      'Each figure needs its concept (for example us-gaap:Revenues) in the last cell of its metrics or strip row; then its filed value appears beside it.',
    );
  const rows = checkFigures(figures, filings);
  const pending = rows.some((r) => r.status === 'pending');
  const stale = !demo && tickerSecStale(d);
  const factsNote = d.detail && /company facts/i.test(d.detail) && !demo ? d.detail : null;
  const staleNote = stale ? d.filings_detail : null;
  return (
    <ChartFrame
      finding={filedFinding(rows, form, demo)}
      metric={metric}
      sub={sub}
      provenance={demo ? 'sample' : 'primary'}
      tag={
        demo
          ? { state: 'demo' }
          : stale
            ? { state: 'lastGood' }
            : pending
              ? { state: 'delayed', detail: 'facts not in yet' }
              : { state: 'computed', detail: 'checked against the filing' }
      }
      height={rows.length * 48 + 40}
      source={source}
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(DEMO_DAY)}`
          : newest
            ? `${newest.form} filed ${formatNoteDate(newest.filed)}`
            : undefined
      }
      note={
        rows.some((r) => r.status === 'differs')
          ? 'The note keeps its own figure; the check shows both and never rewrites the note. The author sees the same flag in the research check before a note publishes.'
          : 'The note keeps its own figures; the check never rewrites them.'
      }
      testId="chart-filed-figures"
    >
      {[staleNote, factsNote].map(
        (text) =>
          text && (
            <Box
              component="p"
              key={text}
              sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}
            >
              {text}
            </Box>
          ),
      )}
      <CheckTable rows={rows} />
    </ChartFrame>
  );
}

const CHECK: Record<
  FiledCheckRow['status'],
  {
    word: string;
    Glyph: ComponentType<{ sx?: object; 'aria-hidden'?: boolean }>;
    tone: 'solid' | 'warn' | 'quiet';
  }
> = {
  matches: { word: 'Matches', Glyph: CheckOutlined, tone: 'solid' },
  computed: { word: 'Computed', Glyph: FunctionsOutlined, tone: 'solid' },
  differs: { word: 'Differs', Glyph: WarningAmberOutlined, tone: 'warn' },
  not_tagged: { word: 'Not tagged · cites the filing', Glyph: DescriptionOutlined, tone: 'quiet' },
  pending: { word: 'Facts not in yet', Glyph: ScheduleOutlined, tone: 'quiet' },
  not_found: { word: 'Not in a filing read', Glyph: ScheduleOutlined, tone: 'quiet' },
  missing: { word: 'Not tagged in the filing', Glyph: WarningAmberOutlined, tone: 'warn' },
  unit: { word: 'Units differ', Glyph: WarningAmberOutlined, tone: 'warn' },
  invalid: { word: 'Can’t be checked', Glyph: WarningAmberOutlined, tone: 'warn' },
};

function CheckTag({ row }: { row: FiledCheckRow }) {
  const { word, Glyph, tone } = CHECK[row.status];
  return (
    <Box
      component="span"
      title={row.detail}
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        minHeight: 24,
        px: 1,
        py: '2px',
        borderRadius: '12px',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.35,
        color:
          tone === 'warn'
            ? t.palette.warning.main
            : tone === 'quiet'
              ? t.palette.text.secondary
              : t.palette.text.primary,
        border: `1px solid ${tone === 'warn' ? alpha(t.palette.warning.main, 0.6) : alpha(t.palette.text.secondary, tone === 'quiet' ? 0.55 : 0.32)}`,
      })}
    >
      <Glyph aria-hidden sx={{ fontSize: 14, flex: 'none' }} />
      <span>{row.gap ? `${word} · ${row.gap}` : word}</span>
    </Box>
  );
}

const conceptText = (c: string) =>
  c === 'none'
    ? 'no standard concept'
    : // A break opportunity after each taxonomy prefix, so a long concept wraps at its name.
      c.replace(/ \/ /g, ' ÷ ').replace(/ - /g, ' − ').replace(/:/g, ':\u200b');
const figureLabel = (r: FiledCheckRow) =>
  `${r.label} · ${/^\d{4}-\d{2}-\d{2}$/.test(r.asOf) ? formatShortDate(r.asOf) : r.asOf}`;

/** Wide: the design's five-column table. Narrow: one card per figure, note and filing side by side. */
function CheckTable({ rows }: { rows: FiledCheckRow[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const narrow = W > 0 && W < 640;
  return (
    <Box ref={ref} sx={{ minWidth: 0 }}>
      {narrow ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
          {rows.map((r) => (
            <Box
              component="li"
              key={`${r.label}-${r.asOf}`}
              sx={(t) => ({
                display: 'grid',
                gap: 0.75,
                p: 1.5,
                borderRadius: '10px',
                border: `1px solid ${t.palette.divider}`,
                ...(r.status === 'differs' && { bgcolor: alpha(t.palette.text.secondary, 0.06) }),
              })}
            >
              <Box component="span" sx={{ fontWeight: 600, fontSize: 14 }}>
                {figureLabel(r)}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Pair k="In the note" v={r.note} />
                <Pair k="In the filing" v={r.filedText ?? '—'} />
              </Box>
              <Box
                component="span"
                sx={{ ...MONO, fontSize: 11, color: 'text.secondary', overflowWrap: 'anywhere' }}
              >
                {conceptText(r.concept)}
              </Box>
              <Box>
                <CheckTag row={r} />
              </Box>
              {r.why && (
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {`The note says: ${r.why}`}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          role="region"
          aria-label="Figures against the filing"
          tabIndex={0}
          sx={{ overflowX: 'auto' }}
        >
          <Box
            component="table"
            sx={(t) => ({
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              '& th': {
                ...MONO,
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                p: '6px 10px',
                borderBottom: `1px solid ${t.palette.divider}`,
                whiteSpace: 'nowrap',
              },
              '& td': {
                p: '10px',
                borderBottom: `1px solid ${t.palette.divider}`,
                verticalAlign: 'top',
              },
              '& td.n': { ...MONO, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
              '& td.c': {
                ...MONO,
                fontSize: 11.5,
                color: 'text.secondary',
                overflowWrap: 'anywhere',
                maxWidth: 280,
              },
              '& tr.flag td': { bgcolor: alpha(t.palette.text.secondary, 0.06) },
            })}
          >
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">In the note</th>
                <th scope="col">In the filing</th>
                <th scope="col">Where it comes from</th>
                <th scope="col">Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.label}-${r.asOf}`}
                  className={r.status === 'differs' ? 'flag' : undefined}
                >
                  <td>
                    <b style={{ fontWeight: 600 }}>{figureLabel(r)}</b>
                    {r.why && (
                      <Box
                        component="span"
                        sx={{ display: 'block', fontSize: 12, color: 'text.secondary' }}
                      >
                        {`The note says: ${r.why}`}
                      </Box>
                    )}
                  </td>
                  <td className="n">{r.note}</td>
                  <td className="n">{r.filedText ?? '—'}</td>
                  <td className="c">{conceptText(r.concept)}</td>
                  <td>
                    <CheckTag row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
      <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
        {k}
      </Box>
      <Box component="span" sx={{ ...MONO, fontSize: 14 }}>
        {v}
      </Box>
    </Box>
  );
}

const yearLabel = (y: PublicAnnualRevenue) =>
  y.fiscal_year != null ? `FY${String(y.fiscal_year).slice(2)}` : formatShortDate(y.period_end);

/** Annual revenue as first filed: a column per fiscal year, the latest lit, a restated year marked.
 *  Every label carries the series' own currency (the wire `unit`): a foreign filer's 20-F revenue is
 *  in its reporting currency, never dollars. `years` share one unit (FiledFiguresSection). */
function RevenueAsFiled({ d, years }: { d: PublicTicker; years: PublicAnnualRevenue[] }) {
  const demo = dataMode === 'demo';
  const stale = !demo && tickerSecStale(d);
  const unit = years[0].unit;
  const billions = (v: number) => formatBillions(v, unit);
  const first = years[0];
  const last = years[years.length - 1];
  const restated = years.filter((y) => y.restated_value != null);
  const ratio = first.value > 0 ? last.value / first.value : null;
  const grew = years.every((y, i) => i === 0 || y.value >= years[i - 1].value);
  const change =
    ratio == null
      ? `went from ${billions(first.value)} to ${billions(last.value)}`
      : ratio >= 2
        ? `grew ${Math.round(ratio)}-fold`
        : ratio >= 1
          ? `grew ${Math.round((ratio - 1) * 100)}%`
          : `fell ${Math.round((1 - ratio) * 100)}%`;
  const finding = `${demo ? 'In the sample, revenue' : 'Revenue as filed'} ${change} in ${years.length - 1} fiscal years${grew && ratio != null && ratio >= 1 ? '' : ''}; ${
    restated.length === 0
      ? 'no year was restated in a later annual report'
      : `${restated.map(yearLabel).join(', ')} ${restated.length === 1 ? 'was' : 'were'} restated later`
  }`;
  return (
    <ChartFrame
      finding={finding}
      metric={`${d.ticker} annual revenue as filed`}
      sub={`${d.ticker} annual revenue · ${billionsWord(unit)} · as tagged in each year’s annual report · a figure a later filing changed carries a “Restated” marker`}
      provenance={demo ? 'sample' : 'primary'}
      tag={
        demo
          ? { state: 'demo' }
          : stale
            ? { state: 'lastGood' }
            : { state: 'updated', detail: 'on filing' }
      }
      height={220}
      source={
        demo
          ? { text: 'Demo · shaped like SEC XBRL company facts' }
          : {
              text: 'SEC · XBRL company facts',
              href: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
            }
      }
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(DEMO_DAY)}`
          : `Through the ${yearLabel(last)} annual report`
      }
      table={{
        caption: 'Annual revenue and the filing it comes from',
        cols: [
          'Fiscal year',
          `Revenue, ${currencyPrefix(unit)?.trim() ?? ''}B`,
          'Filed',
          `Restated to, ${currencyPrefix(unit)?.trim() ?? ''}B`,
        ],
        rows: years.map((y) => [
          yearLabel(y),
          (y.value / 1e9).toFixed(3),
          y.filed ? formatNoteDate(y.filed) : '—',
          y.restated_value == null ? '—' : (y.restated_value / 1e9).toFixed(3),
        ]),
      }}
      testId="chart-revenue-as-filed"
    >
      {stale && d.filings_detail && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}>
          {d.filings_detail}
        </Box>
      )}
      <RevenueBars years={years} unit={unit} />
    </ChartFrame>
  );
}

/** Mono 11px: about 6.7px a character, for fitting a label to the room it has. */
const CHAR_PX = 6.7;

function RevenueBars({ years, unit }: { years: PublicAnnualRevenue[]; unit: string }) {
  const t = useTheme();
  const c = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const code = currencyPrefix(unit) ?? '';
  const maxB = Math.max(0, ...years.map((y) => y.value)) / 1e9;
  // A 1, 2 or 5 step at any magnitude: a NT$3.8T filer gets five ticks, not sixty-five.
  const ticks = niceTicks(maxB);
  const top = ticks[ticks.length - 1];
  const tickText = (v: number) =>
    v === top ? `${code}${v.toLocaleString('en-US')}B` : v.toLocaleString('en-US');
  const PL = Math.max(50, Math.ceil(tickText(top).length * CHAR_PX) + 10);
  const PR = 16;
  const PT = 30;
  const PH = 150;
  const H = PT + PH + 24;
  const slot = Math.max(0, W - PL - PR) / years.length;
  const x = (i: number) => PL + slot * (i + 0.5);
  const y = (b: number) => PT + (1 - b / top) * PH;
  const bw = Math.max(8, Math.min(44, slot * 0.55));
  // A bar's label in full when it fits its slot; else the number alone (the axis and the sub-line
  // carry the currency); else none (the table twin has every figure).
  const barText = (v: number) => {
    const full = formatBillions(v, unit);
    const bare = (v / 1e9).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const room = slot - 4;
    return full.length * CHAR_PX <= room ? full : bare.length * CHAR_PX <= room ? bare : '';
  };
  return (
    <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`Annual revenue as filed: ${years.map((v) => `${yearLabel(v)} ${formatBillions(v.value, unit)}${v.restated_value != null ? ', restated' : ''}`).join(', ')}`}
          style={{ display: 'block' }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke={v === 0 ? c.axis : c.grid} />
              <text
                x={PL - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill={t.palette.text.secondary}
                style={MONO}
              >
                {tickText(v)}
              </text>
            </g>
          ))}
          {years.map((v, i) => {
            const b = v.value / 1e9;
            const lit = i === years.length - 1;
            return (
              <g key={v.period_end}>
                <rect
                  x={x(i) - bw / 2}
                  y={y(b)}
                  width={bw}
                  height={Math.max(1, y(0) - y(b))}
                  rx={2}
                  fill={lit ? c.emph : c.ctx}
                />
                <text
                  x={x(i)}
                  y={y(b) - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={t.palette.text.primary}
                  style={MONO}
                >
                  {barText(v.value)}
                </text>
                {v.restated_value != null && (
                  <text
                    x={x(i)}
                    y={y(b) - 20}
                    textAnchor="middle"
                    fontSize={11}
                    fill={t.palette.text.secondary}
                  >
                    Restated
                  </text>
                )}
                <text
                  x={x(i)}
                  y={PT + PH + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill={t.palette.text.secondary}
                  style={MONO}
                >
                  {yearLabel(v)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </Box>
  );
}
