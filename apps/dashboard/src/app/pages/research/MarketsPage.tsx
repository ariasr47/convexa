/**
 * Markets: Treasury yields and futures positioning from public sources, through the API. Every title
 * here is worked out from the data (a claim, not a label), every figure carries its source and date,
 * and the 10-year is checked against the rate each note was valued with.
 */
import { ChartFrame, chartRoles, type Provenance } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { extrasFor } from '@/shared/theme/tokens';
import { dataMode, type PublicMarkets } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { researchIndex } from 'virtual:convexa-research';
import { formatNoteDate, formatShortDate } from './format';
import { DRIFT_FLAG_POINTS, noteRates, spread2s10s, type YieldPoint } from './marketsMath';
import { ResearchColumn } from './NotesView';
import { usePublicMarkets } from './publicData';
import { Disclaimer, ProvenanceChip, ReadStrip, SourceProblem, StaleNote } from './publicUi';
import { ResearchTabs } from './ResearchTabs';
import { DISPLAY, MONO, PANEL_SX } from './ui';
import { useWidth } from './useWidth';

type Rates = NonNullable<PublicMarkets['rates']>;
type Futures = NonNullable<PublicMarkets['futures']>;

const pts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;

const TSY_URL = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates';

/** A Treasury chart's provenance on this build (canon P-8): the primary source on the live site, the
 *  demo's sample data, dashed, on staging. Every chart in the rates section takes its frame from here. */
function treasuryFrame(
  source: string,
  asOf: string,
  tag: { state: DataStateKey; detail?: string },
): {
  provenance: Provenance;
  source: { text: string; href?: string };
  asOf: string;
  tag: { state: DataStateKey; detail?: string };
} {
  return dataMode === 'demo'
    ? {
        provenance: 'sample',
        source: { text: 'Demo · shaped like U.S. Treasury data' },
        asOf: `Scenario · ${formatNoteDate(asOf)}`,
        tag: { state: 'demo' },
      }
    : {
        provenance: 'primary',
        source: { text: source, href: TSY_URL },
        asOf: `As of ${formatNoteDate(asOf)}`,
        tag,
      };
}
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(2)}%`);

export function MarketsPage() {
  const read = usePublicMarkets();
  const data = read.data;
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
            Markets
          </Box>
          <Box
            component="p"
            sx={{
              m: 0,
              maxWidth: '64ch',
              color: 'text.secondary',
              fontSize: 16,
              textWrap: 'pretty',
            }}
          >
            Rates and futures positioning from public sources, refreshed each business day. The
            10-year on this page is the risk-free rate every note&apos;s valuation starts from.
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {dataMode === 'demo' && <ProvenanceChip text="Demo · sample data" kind="sample" />}
            {data?.rates && (
              <ProvenanceChip
                text={`${data.rates.source} · through ${formatNoteDate(data.rates.as_of)}`}
                kind={dataMode === 'demo' ? 'sample' : 'primary'}
              />
            )}
            {data?.futures && (
              <ProvenanceChip
                text={`${data.futures.source} · as of ${formatShortDate(data.futures.report_date)}`}
                kind={dataMode === 'demo' ? 'sample' : 'primary'}
              />
            )}
            {/* One state word per source (canon P-2); demo builds say it once, in the chip above. */}
            {data &&
              dataMode !== 'demo' &&
              (data.state === 'off' ? (
                <DataStateTag state="off" />
              ) : (
                <>
                  {data.rates ? (
                    <DataStateTag
                      state="updated"
                      detail={`rates ${formatShortDate(data.rates.as_of)}`}
                    />
                  ) : (
                    <DataStateTag state="sourceDown" detail="rates" />
                  )}
                  {data.futures ? (
                    <DataStateTag
                      state="delayed"
                      detail={`positioning as of ${formatShortDate(data.futures.report_date)}`}
                    />
                  ) : (
                    <DataStateTag state="sourceDown" detail="positioning" />
                  )}
                </>
              ))}
          </Box>
        </Box>

        {read.loading && !data ? (
          <MarketsSkeleton />
        ) : read.error || !data ? (
          <SourceProblem
            title="Rates and positioning didn't load."
            body="Convexa's server didn't answer, so there is nothing to show yet. The notes and the Scorecard don't depend on it."
            onRetry={read.retry}
          />
        ) : data.state === 'off' ? (
          <SourceProblem
            title="Public data is switched off on this server."
            body="Rates and positioning come from the U.S. Treasury and the CFTC through Convexa's API, which has them turned off."
          />
        ) : (
          <>
            {data.detail && dataMode !== 'demo' && <StaleNote text={data.detail} />}
            {data.rates ? (
              <RatesSection rates={data.rates} />
            ) : (
              <SourceProblem
                title="Rates are unavailable right now."
                body="The Treasury's rate files didn't answer and there is no earlier copy to show."
                onRetry={read.retry}
              />
            )}
            {data.futures ? (
              <FuturesSection futures={data.futures} />
            ) : (
              <SourceProblem
                title="Futures positioning is unavailable right now."
                body="The CFTC didn't answer and there is no earlier copy to show."
                onRetry={read.retry}
              />
            )}
          </>
        )}

        <Disclaimer>
          Rates: U.S. Department of the Treasury, Daily Treasury Par Yield Curve and Par Real Yield
          Curve Rates. Positioning: CFTC Commitments of Traders, Traders in Financial Futures.
          Personal research. Not financial advice.
        </Disclaimer>
      </Box>
    </ResearchColumn>
  );
}

function RatesSection({ rates }: { rates: Rates }) {
  const latest = rates.latest as YieldPoint;
  const ago = (rates.year_ago ?? null) as YieldPoint | null;
  const daily = rates.daily as YieldPoint[];
  const yearAgoDate = useMemo(() => {
    const d = new Date(`${latest.date}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, [latest.date]);
  const spread = useMemo(
    () => spread2s10s(daily).filter((p) => p.date > yearAgoDate),
    [daily, yearAgoDate],
  );
  const lo = spread.reduce((m, p) => (p.value < m.value ? p : m), spread[0]);
  const hi = spread.reduce((m, p) => (p.value > m.value ? p : m), spread[0]);
  const last = spread[spread.length - 1];
  const be = (p: YieldPoint | null) =>
    p && p.t10y !== null && p.real10y !== null ? p.t10y - p.real10y : null;
  const change = (k: keyof Omit<YieldPoint, 'date'>) =>
    ago && latest[k] !== null && ago[k] !== null
      ? (latest[k] as number) - (ago[k] as number)
      : null;

  return (
    <>
      <ReadStrip
        label="Rates today"
        cells={[
          {
            label: '10-year Treasury',
            value: pct(latest.t10y),
            sub:
              change('t10y') === null
                ? ''
                : `${pts(change('t10y') as number)} pts on a year · was ${pct(ago?.t10y)}`,
          },
          {
            label: 'Real 10-year (TIPS)',
            value: pct(latest.real10y),
            sub:
              change('real10y') === null
                ? ''
                : `${pts(change('real10y') as number)} pts on a year · was ${pct(ago?.real10y)}`,
          },
          {
            label: '10-year breakeven',
            value: pct(be(latest)),
            sub: `10-year less real (calc)${be(ago) === null ? '' : ` · was ${pct(be(ago))}`}`,
          },
          last
            ? {
                label: '2s10s spread',
                value: pts(last.value),
                sub: `pts · year's range ${lo.value.toFixed(2)}–${hi.value.toFixed(2)}`,
              }
            : { label: '2s10s spread', value: '—', sub: 'not published' },
          {
            label: '3-month bill',
            value: pct(latest.t3m),
            sub:
              change('t3m') === null
                ? ''
                : `${pts(change('t3m') as number)} pts on a year · was ${pct(ago?.t3m)}`,
          },
        ]}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
        <Box sx={{ flex: '999 1 600px', minWidth: 0 }}>
          <CurvePanel latest={latest} ago={ago} />
        </Box>
        <Box sx={{ flex: '1 1 340px', minWidth: 0 }}>
          <Decomposition latest={latest} ago={ago} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
        <Box sx={{ flex: '999 1 600px', minWidth: 0 }}>
          {last && <SpreadPanel series={spread} lo={lo} hi={hi} last={last} asOf={rates.as_of} />}
        </Box>
        <Box sx={{ flex: '1 1 340px', minWidth: 0 }}>
          <FeedsNotes daily={daily} latest={latest} />
        </Box>
      </Box>
    </>
  );
}

const MATURITIES: { key: 't3m' | 't2y' | 't5y' | 't10y' | 't30y'; label: string; years: number }[] =
  [
    { key: 't3m', label: '3M', years: 0.25 },
    { key: 't2y', label: '2Y', years: 2 },
    { key: 't5y', label: '5Y', years: 5 },
    { key: 't10y', label: '10Y', years: 10 },
    { key: 't30y', label: '30Y', years: 30 },
  ];

function CurvePanel({ latest, ago }: { latest: YieldPoint; ago: YieldPoint | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const now = MATURITIES.map((m) => latest[m.key]);
  const before = ago ? MATURITIES.map((m) => ago[m.key]) : [];
  const changes = now
    .map((v, i) => (v !== null && before[i] != null ? v - (before[i] as number) : null))
    .filter((v): v is number => v !== null);
  const avg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
  const inverted = (p: YieldPoint | null) =>
    !!p && p.t3m !== null && p.t2y !== null && p.t3m > p.t2y;
  const title =
    avg === null
      ? 'The Treasury curve today.'
      : `The curve ${avg >= 0 ? 'rose' : 'fell'} about ${Math.abs(avg) >= 0.95 && Math.abs(avg) < 1.05 ? 'a point' : `${Math.abs(avg).toFixed(1)} points`} in a year${
          inverted(latest)
            ? ', and the front still inverts.'
            : inverted(ago)
              ? ', and the front no longer inverts.'
              : '.'
        }`;
  const all = [...now, ...before].filter((v): v is number => v !== null);
  const yMin = Math.floor(Math.min(...all)) - 0.5 < 0 ? 0 : Math.floor(Math.min(...all));
  const yMax = Math.ceil(Math.max(...all));
  const W = Math.max(280, width);
  const narrow = W < 520;
  const H = narrow ? 240 : 280;
  const L = 40;
  const R = narrow ? 66 : 104;
  const T = 24;
  const B = 36;
  const s0 = Math.sqrt(MATURITIES[0].years);
  const s1 = Math.sqrt(MATURITIES[MATURITIES.length - 1].years);
  const x = (years: number) => L + ((Math.sqrt(years) - s0) / (s1 - s0)) * (W - L - R);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) =>
        v === null ? null : `${x(MATURITIES[i].years).toFixed(1)},${y(v).toFixed(1)}`,
      )
      .filter(Boolean)
      .join(' ');
  const grid = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);
  const aria = `Yield curve. ${formatNoteDate(latest.date)}: ${MATURITIES.map((m, i) => `${m.label} ${pct(now[i])}`).join(', ')}.${ago ? ` ${formatNoteDate(ago.date)}: ${MATURITIES.map((m, i) => `${m.label} ${pct(before[i])}`).join(', ')}.` : ''}`;
  const lastNow = now[now.length - 1];
  const lastAgo = before[before.length - 1];
  return (
    <ChartFrame
      finding={title}
      metric="Treasury yield curve"
      sub={`U.S. Treasury par yields by maturity · percent · ${formatNoteDate(latest.date)}${ago ? ` against ${formatNoteDate(ago.date)}` : ''} · maturities spaced by √years`}
      height={H}
      {...treasuryFrame('U.S. Treasury · daily par yield curve', latest.date, {
        state: 'updated',
        detail: formatShortDate(latest.date),
      })}
      table={{
        caption: 'Treasury par yields by maturity, percent',
        cols: ['Maturity', formatNoteDate(latest.date), ...(ago ? [formatNoteDate(ago.date)] : [])],
        rows: MATURITIES.map((m, i) => [m.label, pct(now[i]), ...(ago ? [pct(before[i])] : [])]),
      }}
      testId="chart-curve"
    >
      <Box ref={ref} sx={{ minWidth: 0 }}>
        <svg
          role="img"
          aria-label={aria}
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block' }}
        >
          <Box
            component="g"
            sx={{
              fontFamily: MONO.fontFamily,
              fontSize: 11,
              fill: 'currentColor',
              color: 'text.secondary',
            }}
          >
            {grid.map((g) => (
              <g key={g}>
                <Box
                  component="line"
                  x1={L}
                  x2={W - R}
                  y1={y(g)}
                  y2={y(g)}
                  sx={(t) => ({
                    stroke: alpha(t.palette.text.secondary, g === yMin ? 0.3 : 0.14),
                    strokeDasharray: g === yMin ? undefined : '3 4',
                  })}
                />
                <text x={L - 8} y={y(g) + 4} textAnchor="end">{`${g}%`}</text>
              </g>
            ))}
            {MATURITIES.map((m) => (
              <text key={m.key} x={x(m.years)} y={H - 14} textAnchor="middle">
                {m.label}
              </text>
            ))}
          </Box>
          {ago && (
            <Box
              component="polyline"
              points={line(before)}
              // The older comparison takes the second context step (P-9); its end label names it.
              sx={(t) => ({
                fill: 'none',
                stroke: chartRoles(t).ctx2,
                strokeWidth: 2,
                strokeLinejoin: 'round',
              })}
            />
          )}
          <Box
            component="polyline"
            points={line(now)}
            sx={(t) => ({
              fill: 'none',
              stroke: t.palette.text.primary,
              strokeWidth: 2.5,
              strokeLinejoin: 'round',
            })}
          />
          {now.map(
            (v, i) =>
              v !== null && (
                <g key={i}>
                  <Box
                    component="circle"
                    cx={x(MATURITIES[i].years)}
                    cy={y(v)}
                    r={3.5}
                    sx={{ fill: 'currentColor', color: 'text.primary' }}
                  />
                  <Box
                    component="text"
                    x={x(MATURITIES[i].years) + (i === 0 ? 8 : 0)}
                    y={y(v) - 10}
                    textAnchor="middle"
                    sx={{
                      fontFamily: MONO.fontFamily,
                      fontSize: 11,
                      fill: 'currentColor',
                      color: 'text.primary',
                    }}
                  >
                    {v.toFixed(2)}
                  </Box>
                </g>
              ),
          )}
          {lastNow !== null && (
            <Box
              component="text"
              x={W - R + 10}
              y={y(lastNow) + 4}
              sx={{ fontSize: 12, fontWeight: 600, fill: 'currentColor', color: 'text.primary' }}
            >
              {narrow ? formatShortDate(latest.date) : formatNoteDate(latest.date)}
            </Box>
          )}
          {ago && lastAgo != null && (
            <Box
              component="text"
              x={W - R + 10}
              y={y(lastAgo) + 4}
              sx={{ fontSize: 12, fontWeight: 600, fill: 'currentColor', color: 'text.secondary' }}
            >
              {narrow
                ? `${formatShortDate(ago.date).split(' ')[0]} '${ago.date.slice(2, 4)}`
                : formatNoteDate(ago.date)}
            </Box>
          )}
        </svg>
      </Box>
    </ChartFrame>
  );
}

function Decomposition({ latest, ago }: { latest: YieldPoint; ago: YieldPoint | null }) {
  if (
    !ago ||
    latest.t10y === null ||
    ago.t10y === null ||
    latest.real10y === null ||
    ago.real10y === null
  ) {
    return null;
  }
  const d10 = latest.t10y - ago.t10y;
  const dReal = latest.real10y - ago.real10y;
  const dBe = d10 - dReal;
  const share = Math.abs(d10) < 0.05 ? null : dReal / d10;
  const title =
    share === null
      ? 'The 10-year barely moved in a year.'
      : share >= 0.9
        ? 'Real yields did all of it. Inflation expectations held still.'
        : share >= 0.5
          ? 'Mostly real yields, with some help from inflation expectations.'
          : 'Mostly inflation expectations, not real yields.';
  const scale = Math.max(Math.abs(d10), Math.abs(dReal), Math.abs(dBe), 0.01) * 1.08;
  // One shared zero in the middle of every track: a rise grows right of it, a fall left, and the
  // signed figure says it too, so no colour carries the sign (P-11).
  const bar = (label: React.ReactNode, v: number, strong: boolean) => {
    const w = (Math.abs(v) / scale) * 50;
    return (
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <Box component="span" sx={{ fontWeight: strong ? 600 : 400 }}>
            {label}
          </Box>
          <Box component="span" sx={MONO}>
            {pts(v)}
          </Box>
        </Box>
        <Box
          sx={(t) => ({
            position: 'relative',
            height: 14,
            borderRadius: '4px',
            bgcolor: extrasFor(t).well,
          })}
        >
          <Box
            aria-hidden
            sx={(t) => ({
              position: 'absolute',
              left: '50%',
              top: -3,
              bottom: -3,
              borderLeft: `1px solid ${chartRoles(t).axis}`,
            })}
          />
          <Box
            sx={(t) => ({
              position: 'absolute',
              top: w < 0.5 ? 2 : 0,
              bottom: w < 0.5 ? 2 : 0,
              left: v >= 0 ? '50%' : `calc(50% - ${Math.max(w, 0.4)}%)`,
              width: `${Math.max(w, 0.4)}%`,
              borderRadius: v >= 0 ? '0 4px 4px 0' : '4px 0 0 4px',
              bgcolor: strong ? chartRoles(t).emph : chartRoles(t).ctx,
            })}
          />
        </Box>
      </Box>
    );
  };
  return (
    <ChartFrame
      finding={title}
      metric="The 10-year's move, split"
      sub={`Change over the year to ${formatNoteDate(latest.date)} · percentage points · 10-year = real (TIPS) + breakeven (calculated) · zero at the centre`}
      height={170}
      {...treasuryFrame('U.S. Treasury · par and real curves', latest.date, { state: 'computed' })}
      note="The 10-year is a real yield plus expected inflation, so this splits its move between the two. Breakeven is the 10-year less the real 10-year."
      table={{
        caption: 'Change over a year, percentage points',
        cols: ['Measure', formatNoteDate(ago.date), formatNoteDate(latest.date), 'Change'],
        rows: [
          ['10-year Treasury', pct(ago.t10y), pct(latest.t10y), pts(d10)],
          ['Real 10-year (TIPS)', pct(ago.real10y), pct(latest.real10y), pts(dReal)],
          [
            'Breakeven (calc)',
            pct(ago.t10y - ago.real10y),
            pct(latest.t10y - latest.real10y),
            pts(dBe),
          ],
        ],
      }}
      testId="chart-decomposition"
    >
      <Box
        role="img"
        aria-label={`10-year ${pts(d10)} points; real 10-year ${pts(dReal)}; breakeven ${pts(dBe)}`}
        sx={{ display: 'grid', gap: 2.25 }}
      >
        {bar('10-year Treasury', d10, true)}
        {bar('Real 10-year', dReal, false)}
        {bar(
          <>
            Breakeven inflation{' '}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              (calc)
            </Box>
          </>,
          dBe,
          false,
        )}
      </Box>
    </ChartFrame>
  );
}

function SpreadPanel({
  series,
  lo,
  hi,
  last,
  asOf,
}: {
  series: { date: string; value: number }[];
  lo: { date: string; value: number };
  hi: { date: string; value: number };
  last: { date: string; value: number };
  asOf: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(280, width);
  const H = 220;
  const L = 36;
  const R = 52;
  const T = 20;
  const B = 32;
  const vMin = Math.min(0, Math.floor(lo.value * 5) / 5);
  const vMax = Math.ceil(hi.value * 5) / 5 + 0.2;
  const n = series.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + ((vMax - v) / (vMax - vMin)) * (H - T - B);
  const iLo = series.indexOf(lo);
  const iHi = series.indexOf(hi);
  const ticks = [vMin, (vMin + vMax) / 2, vMax];
  // One row per month (its last business day), then the year's high and low.
  const monthly = series.filter(
    (p, k) => k === n - 1 || series[k + 1].date.slice(0, 7) !== p.date.slice(0, 7),
  );
  return (
    <ChartFrame
      finding={`2s10s has held between ${lo.value.toFixed(2)} and ${hi.value.toFixed(2)} points all year. It is ${last.value.toFixed(2)} now.`}
      metric="2s10s spread"
      sub="10-year less 2-year Treasury par yield · percentage points · each business day for a year · band = the year's range"
      height={H}
      {...treasuryFrame('U.S. Treasury · daily par yield curve', asOf, { state: 'computed' })}
      table={{
        caption: '2s10s spread, percentage points, month-end and the year’s extremes',
        cols: ['Date', 'Spread'],
        rows: [
          ...monthly.map((p) => [formatNoteDate(p.date), pts(p.value)]),
          [`High · ${formatNoteDate(hi.date)}`, pts(hi.value)],
          [`Low · ${formatNoteDate(lo.date)}`, pts(lo.value)],
        ],
      }}
      testId="chart-spread"
    >
      <Box ref={ref} sx={{ minWidth: 0 }}>
        <svg
          role="img"
          aria-label={`2s10s over the past year: high ${hi.value.toFixed(2)} on ${formatNoteDate(hi.date)}, low ${lo.value.toFixed(2)} on ${formatNoteDate(lo.date)}, ${last.value.toFixed(2)} on ${formatNoteDate(last.date)}`}
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block' }}
        >
          {/* The year's range: a band wash whose edges are hairlines, never the wash alone (P-9). */}
          <Box
            component="rect"
            x={L}
            y={y(hi.value)}
            width={W - L - R}
            height={y(lo.value) - y(hi.value)}
            sx={(t) => ({ fill: chartRoles(t).band })}
          />
          {[hi.value, lo.value].map((v) => (
            <Box
              key={v}
              component="line"
              x1={L}
              x2={W - R}
              y1={y(v)}
              y2={y(v)}
              sx={(t) => ({ stroke: chartRoles(t).edge, strokeWidth: 1 })}
            />
          ))}
          <Box
            component="g"
            sx={{
              fontFamily: MONO.fontFamily,
              fontSize: 11,
              fill: 'currentColor',
              color: 'text.secondary',
            }}
          >
            {ticks.map((v, i) => (
              <g key={i}>
                <Box
                  component="line"
                  x1={L}
                  x2={W - R}
                  y1={y(v)}
                  y2={y(v)}
                  sx={(t) => ({
                    stroke: alpha(t.palette.text.secondary, i === 0 ? 0.3 : 0.14),
                    strokeDasharray: i === 0 ? undefined : '3 4',
                  })}
                />
                <text x={L - 6} y={y(v) + 4} textAnchor="end">
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={L} y={H - 10}>
              {formatShortDate(series[0].date)}
            </text>
            <text x={W - R} y={H - 10} textAnchor="end">
              {formatShortDate(last.date)}
            </text>
          </Box>
          <Box
            component="polyline"
            points={series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
            sx={(t) => ({
              fill: 'none',
              stroke: t.palette.text.primary,
              strokeWidth: 1.75,
              strokeLinejoin: 'round',
            })}
          />
          <Box
            component="g"
            sx={{
              fontFamily: MONO.fontFamily,
              fontSize: 11,
              fill: 'currentColor',
              color: 'text.primary',
            }}
          >
            <circle cx={x(iHi)} cy={y(hi.value)} r={3} />
            <text
              x={x(iHi) + (iHi > n * 0.7 ? -6 : 6)}
              y={y(hi.value) - 6}
              textAnchor={iHi > n * 0.7 ? 'end' : 'start'}
            >{`${hi.value.toFixed(2)} · ${formatShortDate(hi.date)}`}</text>
            <circle cx={x(iLo)} cy={y(lo.value)} r={3} />
            <text
              x={x(iLo) + (iLo > n * 0.7 ? -6 : 6)}
              y={y(lo.value) + 16}
              textAnchor={iLo > n * 0.7 ? 'end' : 'start'}
            >{`${lo.value.toFixed(2)} · ${formatShortDate(lo.date)}`}</text>
            <circle cx={x(n - 1)} cy={y(last.value)} r={4} />
            <text x={x(n - 1) + 8} y={y(last.value) + 4}>
              {last.value.toFixed(2)}
            </text>
          </Box>
        </svg>
      </Box>
    </ChartFrame>
  );
}

function FeedsNotes({ daily, latest }: { daily: YieldPoint[]; latest: YieldPoint }) {
  const notes = researchIndex
    .filter((r) => r.latest.valuation)
    .map((r) => ({
      ticker: r.ticker,
      priced: (r.latest.valuation as NonNullable<typeof r.latest.valuation>).price.asOf,
    }));
  if (latest.t10y === null || notes.length === 0) return null;
  const today = latest.t10y;
  const rows = noteRates(daily, today, notes);
  const priced = rows.filter((r): r is typeof r & { used: NonNullable<typeof r.used> } => !!r.used);
  const flagged = rows.filter((r) => r.flagged);
  const used = [...new Set(priced.map((r) => r.used.value))];
  const words = ['No note’s', 'One note’s', 'Two notes’', 'Three notes’'];
  const finding =
    flagged.length === 0
      ? used.length === 1
        ? `No note’s discount rate has moved a quarter point: all ${rows.length} started from ${used[0].toFixed(2)}%, now ${today.toFixed(2)}%`
        : `No note’s discount rate has moved a quarter point from today’s 10-year (${today.toFixed(2)}%)`
      : `${words[flagged.length] ?? `${flagged.length} notes’`} discount rate started more than a quarter point from today’s 10-year (${today.toFixed(2)}%)`;
  // One price scale, in quarter points, wide enough for every rate used, today and the ±0.25 band.
  const vals = [
    ...priced.map((r) => r.used.value),
    today - DRIFT_FLAG_POINTS,
    today + DRIFT_FLAG_POINTS,
  ];
  const lo = Math.floor(Math.min(...vals) * 4) / 4 - 0.125;
  const hi = Math.ceil(Math.max(...vals) * 4) / 4 + 0.125;
  const X = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo * 4) / 4; v <= hi; v += 0.25) ticks.push(+v.toFixed(2));
  const ROW = 26;
  const plotH = rows.length * ROW;
  return (
    <ChartFrame
      finding={finding}
      metric="Note discount rates against the 10-year"
      sub={`The 10-year rate each note’s discount rate started from (dot) and the move to today (line) · percent · band = within ±${DRIFT_FLAG_POINTS.toFixed(2)} points of today, where a valuation is flagged for review`}
      height={plotH + 48}
      {...treasuryFrame('U.S. Treasury · daily par yield curve', latest.date, {
        state: 'computed',
      })}
      table={{
        caption: 'Each note’s starting 10-year rate and its drift to today, percent',
        cols: ['Note', 'Priced', 'Rate used', 'Drift', 'Review'],
        rows: rows.map((r) => [
          r.ticker,
          formatNoteDate(r.priced),
          r.used ? `${r.used.value.toFixed(2)}%` : '—',
          r.drift === null ? '—' : pts(r.drift),
          r.flagged ? 'yes' : 'no',
        ]),
      }}
      testId="chart-drift"
    >
      <Box
        role="img"
        aria-label={`${rows.length} notes against today’s 10-year of ${today.toFixed(2)}%. ${flagged.length === 0 ? 'None is flagged.' : `Flagged: ${flagged.map((r) => `${r.ticker} ${pts(r.drift as number)}`).join(', ')}.`}`}
        sx={{
          position: 'relative',
          pl: '52px',
          pr: flagged.length ? '96px' : '12px',
          pt: '28px',
          pb: '24px',
        }}
      >
        <Box sx={{ position: 'relative', height: plotH }}>
          {/* Within ±0.25 of today: no review. A wash with hairline edges, never the wash alone. */}
          <Box
            sx={(t) => ({
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: X(today - DRIFT_FLAG_POINTS),
              width: `calc(${X(today + DRIFT_FLAG_POINTS)} - ${X(today - DRIFT_FLAG_POINTS)})`,
              bgcolor: chartRoles(t).band,
              borderLeft: `1px solid ${chartRoles(t).edge}`,
              borderRight: `1px solid ${chartRoles(t).edge}`,
            })}
          />
          {ticks.map((v) => (
            <Box
              key={v}
              component="span"
              sx={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: X(v),
                transform: 'translateX(-50%)',
                ...MONO,
                fontSize: 11,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              {v.toFixed(2)}
            </Box>
          ))}
          <Box
            sx={(t) => ({
              position: 'absolute',
              top: -6,
              bottom: 0,
              left: X(today),
              borderLeft: `1.5px solid ${chartRoles(t).emph}`,
            })}
          />
          <Box
            component="span"
            sx={{
              position: 'absolute',
              top: -26,
              left: X(today),
              transform: 'translateX(-50%)',
              px: 0.75,
              height: 20,
              display: 'inline-flex',
              alignItems: 'center',
              border: 1,
              borderColor: 'divider',
              borderRadius: '999px',
              bgcolor: 'background.paper',
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {`Today ${today.toFixed(2)}%`}
          </Box>
          {rows.map((r, k) => {
            const y = k * ROW + ROW / 2;
            const u = r.used ? r.used.value : null;
            return (
              <Box key={r.ticker}>
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    right: 'calc(100% + 10px)',
                    top: y,
                    transform: 'translateY(-50%)',
                    ...MONO,
                    fontSize: 12,
                    fontWeight: r.flagged ? 600 : 400,
                    color: r.flagged ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {r.ticker}
                </Box>
                {u !== null ? (
                  <>
                    <Box
                      sx={(t) => ({
                        position: 'absolute',
                        top: y,
                        left: u <= today ? X(u) : X(today),
                        width: `calc(${X(Math.max(u, today))} - ${X(Math.min(u, today))})`,
                        borderTop: `1.5px solid ${chartRoles(t).ctx}`,
                      })}
                    />
                    <Box
                      sx={(t) => ({
                        position: 'absolute',
                        top: y,
                        left: X(u),
                        width: r.flagged ? 10 : 8,
                        height: r.flagged ? 10 : 8,
                        borderRadius: '50%',
                        transform: 'translate(-50%, -50%)',
                        bgcolor: r.flagged ? chartRoles(t).emph : chartRoles(t).ctx,
                        boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
                      })}
                    />
                    {r.flagged && (
                      <Box
                        component="span"
                        sx={{
                          position: 'absolute',
                          left: 'calc(100% + 10px)',
                          top: y,
                          transform: 'translateY(-50%)',
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {`${pts(r.drift as number)} · review`}
                      </Box>
                    )}
                  </>
                ) : (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: y,
                      transform: 'translateY(-50%)',
                      fontSize: 11,
                      color: 'text.secondary',
                    }}
                  >
                    no rate on its price date
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </ChartFrame>
  );
}

const fmtK = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n) / 1000).toLocaleString('en-US')}`;

const CFTC_URL = 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm';

function FuturesSection({ futures }: { futures: Futures }) {
  const groups = futures.markets.flatMap((m) => [
    { market: m, who: 'Asset managers', g: m.asset_managers },
    { market: m, who: 'Leveraged funds', g: m.leveraged_funds },
  ]);
  const extreme = groups.reduce(
    (a, b) =>
      Math.abs(b.g.position_in_range - 0.5) > Math.abs(a.g.position_in_range - 0.5) ? b : a,
    groups[0],
  );
  const where = (p: number) =>
    p >= 0.9
      ? 'near the top of'
      : p <= 0.1
        ? 'near the bottom of'
        : `${Math.round(p * 100)}% of the way through`;
  const finding = extreme
    ? `${extreme.who}' ${extreme.market.name} ${extreme.g.net >= 0 ? 'long' : 'short'} sits ${where(extreme.g.position_in_range)} its 3-year range.`
    : 'Futures positioning';
  // Positions are as of a Tuesday and published the Friday after.
  const published = new Date(`${futures.report_date}T12:00:00Z`);
  published.setUTCDate(published.getUTCDate() + 3);
  const demo = dataMode === 'demo';
  return (
    <ChartFrame
      finding={finding}
      metric="Futures positioning"
      sub="Net futures positions · thousands of contracts · this week within its own 3-year range · tick = 3-year median · bar = this week · 0 marks the switch from net short to net long"
      headingLevel="h2"
      height={300}
      provenance={demo ? 'sample' : 'primary'}
      tag={
        demo
          ? { state: 'demo' }
          : { state: 'delayed', detail: `as of ${formatShortDate(futures.report_date)}` }
      }
      source={
        demo
          ? { text: 'Demo · shaped like CFTC data' }
          : { text: 'CFTC · Traders in Financial Futures', href: CFTC_URL }
      }
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(futures.report_date)}`
          : `Positions ${formatNoteDate(futures.report_date)} · published ${formatShortDate(published.toISOString().slice(0, 10))}`
      }
      note="Reported as of Tuesday and published Friday, so this view is three days old when it updates. It describes who holds what, not what any of them will do."
      table={{
        caption: 'Net futures positions, thousands of contracts, and their 3-year range',
        cols: [
          'Contract · group',
          'Net',
          'On the week',
          '3-yr low',
          '3-yr median',
          '3-yr high',
          'Of range',
        ],
        rows: groups.map(({ market, who, g }) => [
          `${market.name} · ${who}`,
          fmtK(g.net),
          fmtK(g.week_change),
          fmtK(g.min_3y),
          fmtK(g.median_3y),
          fmtK(g.max_3y),
          `${Math.round(g.position_in_range * 100)}%`,
        ]),
      }}
      testId="chart-positioning"
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
          gap: 2,
        }}
      >
        {futures.markets.map((m) => (
          <Box
            key={m.code}
            component="article"
            sx={(t) => ({
              p: 2,
              borderRadius: '10px',
              border: `1px solid ${t.palette.divider}`,
              display: 'grid',
              gap: 1.5,
            })}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 1,
              }}
            >
              <Box component="h3" sx={{ m: 0, fontSize: 15, fontWeight: 600 }}>
                {m.name}
              </Box>
              <Box
                component="span"
                sx={{ ...MONO, fontSize: 11, color: 'text.secondary' }}
              >{`${m.exchange} · ${m.code}`}</Box>
            </Box>
            <RangeRow who="Asset managers" g={m.asset_managers} />
            <RangeRow who="Leveraged funds" g={m.leveraged_funds} />
          </Box>
        ))}
      </Box>
    </ChartFrame>
  );
}

function RangeRow({ who, g }: { who: string; g: Futures['markets'][number]['asset_managers'] }) {
  const span = g.max_3y - g.min_3y;
  const at = (v: number) => (span === 0 ? 0.5 : (v - g.min_3y) / span);
  const median = at(g.median_3y);
  // Where the range crosses zero, mark it: left of it is net short, right of it net long (P-11).
  const zero = g.min_3y < 0 && g.max_3y > 0 ? at(0) : null;
  return (
    <Box sx={{ display: 'grid', gap: 0.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {who}
        </Box>
        <Box component="span" sx={MONO}>
          {`${fmtK(g.net)} ${g.net >= 0 ? 'long' : 'short'}`}
          <Box
            component="span"
            sx={{ color: 'text.secondary' }}
          >{` · ${fmtK(g.week_change)} on week`}</Box>
        </Box>
      </Box>
      <Box
        role="img"
        aria-label={`${who} ${fmtK(g.net)} thousand contracts, net ${g.net >= 0 ? 'long' : 'short'}, ${Math.round(g.position_in_range * 100)}% of the way from the 3-year low of ${fmtK(g.min_3y)} to the high of ${fmtK(g.max_3y)}; 3-year median ${fmtK(g.median_3y)}`}
        sx={{ position: 'relative', height: 22 }}
      >
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: 0,
            right: 0,
            top: 9,
            height: 4,
            borderRadius: '2px',
            bgcolor: chartRoles(t).grid,
          })}
        />
        {zero !== null && (
          <Box
            sx={(t) => ({
              position: 'absolute',
              left: `${zero * 100}%`,
              top: 2,
              height: 18,
              borderLeft: `1px dashed ${chartRoles(t).edge}`,
            })}
          />
        )}
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: `${median * 100}%`,
            top: 5,
            width: 2,
            height: 12,
            ml: '-1px',
            bgcolor: chartRoles(t).ctx,
          })}
        />
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: `${g.position_in_range * 100}%`,
            top: 1,
            width: 4,
            height: 20,
            ml: '-2px',
            borderRadius: '2px',
            bgcolor: chartRoles(t).emph,
            boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
          })}
        />
      </Box>
      <Box
        sx={{
          position: 'relative',
          height: 14,
          ...MONO,
          fontSize: 11,
          color: 'text.secondary',
        }}
      >
        <Box
          component="span"
          sx={{ position: 'absolute', left: 0 }}
        >{`3-yr low ${fmtK(g.min_3y)}`}</Box>
        {zero !== null && zero > 0.22 && zero < 0.78 && (
          <Box
            component="span"
            sx={{ position: 'absolute', left: `${zero * 100}%`, transform: 'translateX(-50%)' }}
          >
            0
          </Box>
        )}
        <Box
          component="span"
          sx={{ position: 'absolute', right: 0 }}
        >{`high ${fmtK(g.max_3y)}`}</Box>
      </Box>
    </Box>
  );
}

function MarketsSkeleton() {
  const block = (h: number) => (
    <Box sx={(t) => ({ ...PANEL_SX, height: h, bgcolor: alpha(t.palette.text.secondary, 0.06) })} />
  );
  return (
    <Box
      aria-busy="true"
      aria-label="Loading rates and positioning"
      sx={{ display: 'grid', gap: 2 }}
    >
      {block(104)}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: '999 1 600px' }}>{block(380)}</Box>
        <Box sx={{ flex: '1 1 340px' }}>{block(380)}</Box>
      </Box>
    </Box>
  );
}
