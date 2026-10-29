/**
 * Markets: Treasury yields and futures positioning from public sources, through the API. Every title
 * here is worked out from the data (a claim, not a label), every figure carries its source and date,
 * and the 10-year is checked against the rate each note was valued with.
 */
import { ChartFrame, chartRoles, type Provenance } from '@/shared/charts/frame';
import type { FrameHeight, FrameReserve } from '@/shared/charts/frame/ChartFrame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { publicDataWord, type DataStateKey } from '@/shared/dataState/vocabulary';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { extrasFor } from '@/shared/theme/tokens';
import { coarseFloor } from '@/shared/ui/touch';
import { FrameDemoTagProvider } from '@/shared/ui/Widget/WidgetProvenanceContext';
import { dataMode, DEMO_NOTE_PRICED, type PublicMarkets } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import { useId, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { ComingUpSection, MarketsSectionHead } from './ComingUpSection';
import {
  FOMC_CHECKED,
  FOMC_OUTCOMES_CHECKED,
  FOMC_SOURCE,
  fomcInSeries,
  fomcOutcome,
  outcomeLabel,
  outcomeWords,
} from './fomc';
import { formatNoteDate, formatShortDate } from './format';
import { LiquiditySection } from './LiquiditySection';
import {
  curveFinding,
  curveOn,
  DRIFT_FLAG_POINTS,
  monthsBefore,
  noteRates,
  onWeekdays,
  servingLastGood,
  spread2s10s,
  type YieldPoint,
} from './marketsMath';
import { ResearchColumn } from './NotesView';
import { usePublicMarkets } from './publicData';
import {
  Caps,
  Disclaimer,
  PAGE_BODY_SX,
  PageHead,
  ProvenanceChip,
  ReadStrip,
  SourceProblem,
  StaleNote,
} from './publicUi';
import { ResearchTabs } from './ResearchTabs';
import { STRESS_LEAD, STRESS_METRIC, STRESS_NOTE, STRESS_SUB } from './stressRead';
import { STRESS_HEIGHT, StressSection } from './StressSection';
import { MONO, PANEL_SX } from './ui';
import { useWidth } from './useWidth';

type Rates = NonNullable<PublicMarkets['rates']>;
type Futures = NonNullable<PublicMarkets['futures']>;

const pts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;

/** The API's source names, as its stale notes spell them (marketsMath.ts sourceNote). */
const TREASURY = 'U.S. Treasury';
const CFTC = 'CFTC';

const TSY_URL = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates';

/** A Treasury chart's source and as-of on this build: the primary source on the live site, the
 *  demo's sample data on staging (its dashed frame comes from the board, canon P-8, and its source
 *  chip is its one Sample mark: the page opts out of the frame's demo tag, owner decision D1).
 *  Every chart in the rates section takes its frame from here. */
function treasuryFrame(
  source: string,
  asOf: string,
  tag: { state: DataStateKey; detail?: string },
): {
  source: { text: string; href?: string };
  asOf: string;
  tag: { state: DataStateKey; detail?: string };
} {
  return dataMode === 'demo'
    ? {
        source: { text: 'Demo · shaped like U.S. Treasury data' },
        asOf: `Scenario · ${formatNoteDate(asOf)}`,
        tag,
      }
    : {
        source: { text: source, href: TSY_URL },
        asOf: `As of ${formatNoteDate(asOf)}`,
        tag,
      };
}
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(2)}%`);

/** The shell's demo bar is this page's one "Demo · sample data", so its frames don't repeat it
 *  (FrameDemoTagProvider; owner decision D1, spec 01 step 5). No effect on the live build. */
export function MarketsPage() {
  useDocumentTitle('Markets — Convexa');
  return (
    <FrameDemoTagProvider value={false}>
      <MarketsBody />
    </FrameDemoTagProvider>
  );
}

function MarketsBody() {
  const read = usePublicMarkets();
  const data = read.data;
  return (
    <>
      <ResearchTabs />
      <ResearchColumn>
        <Box sx={PAGE_BODY_SX}>
          <PageHead
            title="Markets"
            lead={
              dataMode === 'demo' ? (
                'Rates, positioning and the money behind them, shaped like the public sources Convexa reads each business day. The 10-year on this page is the risk-free rate every note’s valuation starts from.'
              ) : (
                <>
                  Rates, positioning and the money behind them, from public sources, refreshed each
                  business day. The 10-year on this page is the risk-free rate every note&apos;s
                  valuation starts from.
                </>
              )
            }
            chips={
              data ? (
                <>
                  {data?.rates && (
                    <ProvenanceChip
                      text={`${data.rates.source} · through ${formatNoteDate(data.rates.as_of)}`}
                    />
                  )}
                  {data?.futures && (
                    <ProvenanceChip
                      text={`${data.futures.source} · as of ${formatShortDate(data.futures.report_date)}`}
                    />
                  )}
                  {/* One state word per source (canon P-2); demo builds say it once, in the shell's bar. */}
                  {data &&
                    dataMode !== 'demo' &&
                    (data.state === 'off' ? (
                      <DataStateTag state="off" />
                    ) : (
                      <>
                        {/* A source that failed this cycle shows its last good copy, never "Updated". */}
                        {data.rates ? (
                          <DataStateTag
                            state={publicDataWord(data.state, {
                              stale: servingLastGood(
                                data.rates?.source_state,
                                data.detail,
                                TREASURY,
                              ),
                            })}
                            detail={`rates ${formatShortDate(data.rates.as_of)}`}
                          />
                        ) : (
                          <DataStateTag state="sourceDown" detail="rates" />
                        )}
                        {data.futures ? (
                          <DataStateTag
                            state={publicDataWord(data.state, {
                              stale: servingLastGood(data.futures?.source_state, data.detail, CFTC),
                              delayed: true,
                            })}
                            detail={`positioning as of ${formatShortDate(data.futures.report_date)}`}
                          />
                        ) : (
                          <DataStateTag state="sourceDown" detail="positioning" />
                        )}
                      </>
                    ))}
                </>
              ) : undefined
            }
          />

          {(read.loading || (data && data.state !== 'off')) && (
            <JumpRail
              // An API from before the gauge sends no `stress`: no section, so no link to it.
              stress={!data || data.stress != null}
              liquidity={!data || data.liquidity !== undefined}
              comingUp={!data || data.calendar !== undefined}
            />
          )}

          {read.loading && !data ? (
            <MarketsLoading />
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
              <MarketsSection id="rates" title="Rates">
                {data.rates ? (
                  <RatesSection
                    rates={data.rates}
                    stale={servingLastGood(data.rates?.source_state, data.detail, TREASURY)}
                  />
                ) : (
                  <SourceProblem
                    title="Rates are unavailable right now."
                    body="The Treasury's rate files didn't answer and there is no earlier copy to show."
                    onRetry={read.retry}
                  />
                )}
              </MarketsSection>
              <MarketsSection id="positioning" title="Positioning">
                {data.futures ? (
                  <>
                    <FuturesSection
                      futures={data.futures}
                      stale={servingLastGood(data.futures?.source_state, data.detail, CFTC)}
                    />
                    <PositioningGroups
                      futures={data.futures}
                      stale={servingLastGood(data.futures?.source_state, data.detail, CFTC)}
                    />
                  </>
                ) : (
                  <SourceProblem
                    title="Futures positioning is unavailable right now."
                    body="The CFTC didn't answer and there is no earlier copy to show."
                    onRetry={read.retry}
                  />
                )}
              </MarketsSection>
              {/* The fear–greed gauge (spec 2026-10-21/07). Absent (an API from before it): no
                section, as Liquidity. The API sends `null` only with public data off, which the
                page answers above. */}
              {data.stress && (
                <MarketsSection id="stress" title="Stress" lead={STRESS_LEAD}>
                  <StressSection stress={data.stress} sources={data.sources} onRetry={read.retry} />
                </MarketsSection>
              )}
              {/* `null`: the sources failed with nothing cached. Absent (an API from before
                liquidity existed): nothing to say, so nothing drawn. */}
              {data.liquidity !== undefined && (
                <MarketsSection id="liquidity" title="Liquidity" lead={LIQUIDITY_LEAD}>
                  {data.liquidity ? (
                    <LiquiditySection
                      liquidity={data.liquidity}
                      stale={servingLastGood(
                        data.liquidity?.source_state,
                        data.detail,
                        'Liquidity',
                      )}
                    />
                  ) : (
                    <SourceProblem
                      title="Liquidity is unavailable right now."
                      body="The Fed, the Treasury or the NY Fed didn't answer and there is no earlier copy to show."
                      onRetry={read.retry}
                    />
                  )}
                </MarketsSection>
              )}
            </>
          )}

          <ComingUpSection read={read} />

          {/* The demo bar is the page's one "Demo · sample data" (owner decision D1), so the
              staging line says "Sample data" (spec 2026-10-21/07, Copy › Page disclaimer). */}
          <Disclaimer>
            {dataMode === 'demo'
              ? 'Sample data shaped like the Federal Reserve’s, the Treasury’s, the OFR’s, the CFTC’s, the BLS’s and the BEA’s files; nothing on this page is a real observation. Research and tools, not investment advice.'
              : 'Rates: U.S. Department of the Treasury, Daily Treasury Par Yield Curve and Par Real Yield Curve Rates. Positioning: CFTC Commitments of Traders, Traders in Financial Futures. Liquidity: Federal Reserve H.4.1, Treasury Daily Treasury Statement and NY Fed reverse repo operations. Stress: Office of Financial Research, OFR Financial Stress Index, and CFTC Commitments of Traders (TFF); the percentiles and the gauge are Convexa’s arithmetic. Research and tools, not investment advice.'}
          </Disclaimer>
        </Box>
      </ResearchColumn>
    </>
  );
}

const LIQUIDITY_LEAD =
  'How much money the Fed’s balance sheet leaves in the system after the Treasury’s cash account and overnight reverse repo. When the Treasury rebuilds its cash, it drains reserves the same way the Fed shrinking would.';

const JUMPS: { id: string; name: string }[] = [
  { id: 'rates', name: 'Rates' },
  { id: 'positioning', name: 'Positioning' },
  { id: 'stress', name: 'Stress' },
  { id: 'liquidity', name: 'Liquidity' },
  { id: 'coming-up', name: 'Coming up' },
];

/** "On this page": the page's five sections (design: planned-kit marketsHost jump rail). */
function JumpRail({
  stress,
  liquidity,
  comingUp,
}: {
  stress: boolean;
  liquidity: boolean;
  comingUp: boolean;
}) {
  const shown = JUMPS.filter(
    (j) =>
      (j.id !== 'stress' || stress) &&
      (j.id !== 'liquidity' || liquidity) &&
      (j.id !== 'coming-up' || comingUp),
  );
  // index.html declares <base href="/">, which resolves a bare "#stress" to "/#stress", the landing;
  // the page's own path keeps it a same-document fragment, native and without a reload (the
  // methodology index's fix, MethodologyPage.tsx).
  const { pathname } = useLocation();
  return (
    <Box
      component="nav"
      aria-label="On this page"
      sx={(t) => ({
        display: 'flex',
        flexWrap: { xs: 'nowrap', sm: 'wrap' },
        overflowX: { xs: 'auto', sm: 'visible' },
        alignItems: 'center',
        gap: '6px 4px',
        py: 1,
        borderTop: `1px solid ${t.palette.divider}`,
        borderBottom: `1px solid ${t.palette.divider}`,
      })}
    >
      <Box
        component="span"
        sx={{ fontSize: 12, color: 'text.secondary', mr: 0.75, whiteSpace: 'nowrap' }}
      >
        On this page
      </Box>
      {shown.map((j) => (
        <Box
          key={j.id}
          component="a"
          href={`${pathname}#${j.id}`}
          // 44px under a coarse pointer (32 before); the links draw no fill, so nothing visible
          // changes but the row's height (spec 2026-10-21/02, part (b)).
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 32,
            ...coarseFloor,
            px: 1.25,
            borderRadius: '999px',
            fontSize: 13,
            color: 'text.secondary',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { color: 'text.primary' },
          }}
        >
          {j.name}
        </Box>
      ))}
    </Box>
  );
}

/** One of the page's sections, under its own heading (design: planned-kit `section`). */
function MarketsSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby={`${id}-h`}
      sx={{ display: 'grid', gap: 2, minWidth: 0, scrollMarginTop: { xs: 72, md: 80 } }}
    >
      <MarketsSectionHead id={`${id}-h`} title={title} lead={lead} />
      {children}
    </Box>
  );
}

/** Two frames side by side from 900px, 7fr/5fr, each at its own height (design: research.mjs `.fr-2`,
 *  `align-items: start`); one column below. */
const PAIR_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
  gap: 2,
  alignItems: 'start',
} as const;

function RatesSection({ rates, stale = false }: { rates: Rates; stale?: boolean }) {
  const latest = rates.latest as YieldPoint;
  const ago = (rates.year_ago ?? null) as YieldPoint | null;
  const daily = rates.daily as YieldPoint[];
  // The curve a month back: the last business day on or before the same day last month.
  const month = useMemo(() => {
    const p = curveOn(daily, monthsBefore(latest.date, 1));
    return p && p.date < latest.date ? p : null;
  }, [daily, latest.date]);
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
    ago && latest[k] != null && ago[k] != null ? (latest[k] as number) - (ago[k] as number) : null;

  const demo = dataMode === 'demo';
  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
          <Caps
            sx={{ color: 'text.primary' }}
          >{`Rates today · ${formatNoteDate(latest.date)}`}</Caps>
          {/* The strip has no source line, so on the demo its head says Sample (owner decision D1). */}
          {demo ? (
            <DataStateTag state="sample" />
          ) : (
            <DataStateTag
              state={stale ? 'lastGood' : 'updated'}
              detail={`rates ${formatShortDate(latest.date)}`}
            />
          )}
        </Box>
        {/* Sample data is dashed with the hatch stripe (P-3, P-8), as every frame below it is. */}
        <Box
          sx={
            demo
              ? (t: Theme) => ({
                  '& > section': {
                    borderStyle: 'dashed',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 8,
                      borderRadius: '11px 11px 0 0',
                      pointerEvents: 'none',
                      background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(t.palette.text.secondary, 0.28)} 6px 12px)`,
                    },
                  },
                })
              : undefined
          }
        >
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
        </Box>
      </Box>
      {/* The curve beside its decomposition, 7fr/5fr and aligned to the start (design: `.fr-2`): each
          frame keeps its own height, so neither carries a blank band (fidelity audit R-02). */}
      <Box sx={PAIR_SX}>
        <Box sx={{ minWidth: 0 }}>
          <CurvePanel latest={latest} month={month} ago={ago} stale={stale} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Decomposition latest={latest} ago={ago} />
        </Box>
      </Box>
      {/* 2s10s on a row of its own, then note-rate drift on its own (owner, NO-5 B, 2026-10-25):
          drift's height follows the note count, so no pairing balances on both builds, and 2s10s's
          year of FOMC marks gets the page's full width (fidelity audit R-02, FND-04). */}
      {last && (
        <Box sx={{ minWidth: 0 }}>
          <SpreadPanel series={spread} lo={lo} hi={hi} last={last} asOf={rates.as_of} />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <FeedsNotes daily={daily} latest={latest} />
      </Box>
    </>
  );
}

type Maturity = {
  key: 't1m' | 't3m' | 't1y' | 't2y' | 't5y' | 't10y' | 't30y';
  label: string;
  long: string;
  years: number;
  /** An axis label the board marks minor: dropped on a narrow plot (design curveChart x ticks). */
  minor?: boolean;
  /** No axis label at all: the board names the curve's 1-month end in the subtitle, not the axis,
   *  where it would sit a few pixels from 3M on the √years scale. */
  unlabelled?: boolean;
};
const MATURITIES: Maturity[] = [
  { key: 't1m', label: '1M', long: '1 month', years: 1 / 12, unlabelled: true },
  { key: 't3m', label: '3M', long: '3 months', years: 0.25, minor: true },
  { key: 't1y', label: '1Y', long: '1 year', years: 1, minor: true },
  { key: 't2y', label: '2Y', long: '2 years', years: 2 },
  { key: 't5y', label: '5Y', long: '5 years', years: 5 },
  { key: 't10y', label: '10Y', long: '10 years', years: 10 },
  { key: 't30y', label: '30Y', long: '30 years', years: 30 },
];
/** A maturity's yield on one curve; an API from before the 1-month and 1-year sends neither. */
const yieldAt = (p: YieldPoint, k: Maturity['key']): number | null => p[k] ?? null;

function CurvePanel({
  latest,
  month,
  ago,
  stale = false,
}: {
  latest: YieldPoint;
  month: YieldPoint | null;
  ago: YieldPoint | null;
  stale?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  // The maturities some curve has: an API from before the 1-month and 1-year draws what it sends.
  const shown = MATURITIES.filter((m) =>
    [latest, month, ago].some((p) => p !== null && yieldAt(p, m.key) !== null),
  );
  const now = shown.map((m) => yieldAt(latest, m.key));
  const mid = month ? shown.map((m) => yieldAt(month, m.key)) : [];
  const before = ago ? shown.map((m) => yieldAt(ago, m.key)) : [];
  // The year's change at both ends, never an average of the maturities (D-11, marketsMath.ts).
  const title = curveFinding(latest, ago) ?? 'The Treasury curve today.';
  const all = [...now, ...mid, ...before].filter((v): v is number => v !== null);
  const yMin = Math.floor(Math.min(...all)) - 0.5 < 0 ? 0 : Math.floor(Math.min(...all));
  const yMax = Math.ceil(Math.max(...all));
  const W = Math.max(280, width);
  const narrow = W < 520;
  const H = narrow ? 240 : 280;
  const L = 40;
  const R = narrow ? 66 : 104;
  const T = 24;
  const B = 36;
  const first = shown.length > 1 ? shown[0] : MATURITIES[0];
  const last = shown.length > 1 ? shown[shown.length - 1] : MATURITIES[MATURITIES.length - 1];
  const s0 = Math.sqrt(first.years);
  const s1 = Math.sqrt(last.years);
  const x = (years: number) => L + ((Math.sqrt(years) - s0) / (s1 - s0)) * (W - L - R);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : `${x(shown[i].years).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(' ');
  // Axis labels as the board ticks them: 3M and 1Y are minor and leave a narrow plot; 1M is named
  // in the subtitle instead of beside 3M.
  const axisLabels = shown.filter((m) => !m.unlabelled && !(narrow && m.minor));
  // Today's values over their dots, from the long end in, each at least 32px from the last one
  // drawn so the front end's close maturities never overprint (a narrow plot labels the major
  // maturities only). The table twin carries every value.
  const valueLabels = new Set<number>();
  let lastLabelX = Infinity;
  for (let i = shown.length - 1; i >= 0; i--) {
    const v = now[i];
    const m = shown[i];
    if (v === null || (narrow && (m.minor || m.unlabelled))) continue;
    const at = x(m.years);
    if (lastLabelX - at < 32) continue;
    valueLabels.add(i);
    lastLabelX = at;
  }
  const grid = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);
  // The three curves, newest last so it draws on top; each named at its long end.
  const curves = [
    ago && { key: 'yr', p: ago, vals: before, label: narrow ? '1Y ago' : formatNoteDate(ago.date) },
    month && {
      key: 'mo',
      p: month,
      vals: mid,
      label: narrow ? '1M ago' : formatShortDate(month.date),
    },
    { key: 'now', p: latest, vals: now, label: narrow ? 'Now' : formatNoteDate(latest.date) },
  ].filter((c): c is { key: string; p: YieldPoint; vals: (number | null)[]; label: string } => !!c);
  // End labels at least 14px apart, in value order, so three close curves never overprint.
  const ends = curves
    .flatMap((c) => {
      const v = c.vals[c.vals.length - 1];
      return v == null ? [] : [{ key: c.key, label: c.label, at: y(v) + 4 }];
    })
    .sort((a, b) => a.at - b.at);
  for (let i = 1; i < ends.length; i++) ends[i].at = Math.max(ends[i].at, ends[i - 1].at + 14);
  const stroke = (t: Theme, key: string) =>
    key === 'now' ? t.palette.text.primary : key === 'mo' ? chartRoles(t).ctx : chartRoles(t).ctx2;
  const aria = `Yield curve. ${curves
    .map(
      (c) =>
        `${formatNoteDate(c.p.date)}: ${shown.map((m, i) => `${m.label} ${pct(c.vals[i])}`).join(', ')}.`,
    )
    .join(' ')}`;
  return (
    <ChartFrame
      finding={title}
      metric="Treasury yield curve"
      sub={`U.S. Treasury par yields by maturity · percent · ${formatNoteDate(latest.date)}${ago || month ? ` against ${month && ago ? 'a month and a year' : month ? 'a month' : 'a year'} earlier` : ''} · ${first.long} to ${last.long}, spaced by √years`}
      height={H}
      {...treasuryFrame('U.S. Treasury · daily par yield curve', latest.date, {
        state: stale ? 'lastGood' : 'updated',
        detail: formatShortDate(latest.date),
      })}
      legend={
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 16px',
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {[...curves].reverse().map((c) => (
            <Box
              key={c.key}
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <Box
                component="i"
                aria-hidden
                sx={(t) => ({
                  display: 'inline-block',
                  width: 16,
                  borderTop: `${c.key === 'now' ? 2.5 : 2}px solid ${stroke(t, c.key)}`,
                })}
              />
              {formatNoteDate(c.p.date)}
            </Box>
          ))}
        </Box>
      }
      table={{
        caption: 'Treasury par yields by maturity, percent',
        cols: ['Maturity', ...[...curves].reverse().map((c) => formatNoteDate(c.p.date))],
        rows: shown.map((m, i) => [m.label, ...[...curves].reverse().map((c) => pct(c.vals[i]))]),
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
                  // Solid hairline gridlines, the baseline one step stronger (design: chart-kit
                  // `--c-grid`; fidelity audit FND-17).
                  sx={(t) => ({
                    stroke: g === yMin ? alpha(t.palette.text.secondary, 0.3) : chartRoles(t).grid,
                  })}
                />
                <text x={L - 8} y={y(g) + 4} textAnchor="end">{`${g}%`}</text>
              </g>
            ))}
            {axisLabels.map((m) => (
              <text key={m.key} x={x(m.years)} y={H - 14} textAnchor="middle">
                {m.label}
              </text>
            ))}
          </Box>
          {curves.map((c) => (
            <Box
              key={c.key}
              component="polyline"
              points={line(c.vals)}
              // Now in the claim's colour; a month back and a year back step down through the
              // two context roles (P-9), each named at its end.
              sx={(t) => ({
                fill: 'none',
                stroke: stroke(t, c.key),
                strokeWidth: c.key === 'now' ? 2.5 : 2,
                strokeLinejoin: 'round',
              })}
            />
          ))}
          {now.map(
            (v, i) =>
              v !== null && (
                <g key={shown[i].key}>
                  <Box
                    component="circle"
                    cx={x(shown[i].years)}
                    cy={y(v)}
                    r={3.5}
                    sx={{ fill: 'currentColor', color: 'text.primary' }}
                  />
                  {valueLabels.has(i) && (
                    <Box
                      component="text"
                      x={x(shown[i].years) + (i === 0 ? 8 : 0)}
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
                  )}
                </g>
              ),
          )}
          {ends.map((e) => (
            <Box
              key={e.key}
              component="text"
              x={W - R + 10}
              y={e.at}
              sx={{
                fontSize: 12,
                fontWeight: 600,
                fill: 'currentColor',
                color: e.key === 'now' ? 'text.primary' : 'text.secondary',
              }}
            >
              {e.label}
            </Box>
          ))}
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
  const hatchId = useId();
  const theme = useTheme();
  const W = Math.max(280, width);
  const narrow = W < 480;
  // The plot, then the FOMC lane under it (each decision's mark over its outcome), then the dates.
  const H = 262;
  const L = 44;
  const R = 52;
  const T = 20;
  const B = 74;
  const LANE = H - B + 16;
  // Every weekday stays on the axis (P-8/P-10, design spreadPlot gaps): a weekday the Treasury
  // published no spread for is a hatched "Not published" gap, never closed up or drawn across.
  const axis = useMemo(() => onWeekdays(series.map((p) => p.date)), [series]);
  const valueOn = useMemo(() => new Map(series.map((p) => [p.date, p.value])), [series]);
  const n = axis.days.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const ix = (date: string) => axis.index.get(date) ?? 0;
  const vMin = Math.min(0, Math.floor(lo.value * 5) / 5);
  const vMax = Math.ceil(hi.value * 5) / 5 + 0.2;
  const y = (v: number) => T + ((vMax - v) / (vMax - vMin)) * (H - T - B);
  const iLo = ix(lo.date);
  const iHi = ix(hi.date);
  const ticks = [vMin, (vMin + vMax) / 2, vMax];
  // The line breaks at every gap: one polyline per run of consecutive weekdays.
  const runs: { date: string; value: number }[][] = [];
  for (const p of series) {
    const run = runs[runs.length - 1];
    if (run && ix(p.date) === ix(run[run.length - 1].date) + 1) run.push(p);
    else runs.push([p]);
  }
  // Each gap's hatch spans its missing weekdays, at least 3px wide so a single day still reads.
  const gapBands = axis.gaps.map((g) => {
    const x0 = Math.max(L, x(g.from - 0.5));
    const x1 = Math.min(W - R, x(g.to + 0.5));
    const pad = Math.max(0, (3 - (x1 - x0)) / 2);
    return { ...g, x0: x0 - pad, x1: x1 + pad };
  });
  const gapDays = axis.gaps.flatMap((g) => axis.days.slice(g.from, g.to + 1));
  const hiRight = iHi > n * 0.7;
  const loRight = iLo > n * 0.7;
  const hiText = `${hi.value.toFixed(2)} · ${formatShortDate(hi.date)}`;
  const loText = `${lo.value.toFixed(2)} · ${formatShortDate(lo.date)}`;
  // The latest gap is named on the plot, the subtitle names the hatch for the rest. Its words go at
  // the foot of the plot, or the top, or the middle: the first place clear of the other labels.
  const named = gapBands[gapBands.length - 1];
  const namedRight = named ? (named.x0 + named.x1) / 2 > L + (W - L - R) / 2 : false;
  const namedX = named ? (namedRight ? named.x0 - 4 : named.x1 + 4) : 0;
  const textBox = (at: number, end: boolean, w: number, base: number) => ({
    x0: end ? at - w : at,
    x1: end ? at : at + w,
    y0: base - 10,
    y1: base + 3,
  });
  const taken = [
    textBox(x(iHi) + (hiRight ? -6 : 6), hiRight, hiText.length * 6.7, y(hi.value) - 6),
    textBox(x(iLo) + (loRight ? -6 : 6), loRight, loText.length * 6.7, y(lo.value) + 16),
    textBox(L + 6, false, 16 * 6.7, y(0) - 6),
  ];
  const namedY =
    [H - B - 6, T + 12, Math.round((T + H - B) / 2)].find((base) => {
      const b = textBox(namedX, namedRight, 80, base);
      return !taken.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
    }) ?? H - B - 6;
  // Text over the hatch and the band keeps a halo of the panel colour, so neither strikes it out.
  const halo = (t: Theme) => ({
    stroke: t.palette.background.paper,
    strokeWidth: 3,
    paintOrder: 'stroke',
    strokeLinejoin: 'round',
  });
  const meetings = fomcInSeries(axis.days).map((m) => ({ ...m, outcome: fomcOutcome(m.date) }));
  // Outcome labels from the latest back, each at least 30px from the last one drawn; a narrow plot
  // keeps the moves and the latest decision and drops the other holds (design: minor FOMC chips).
  const labelled = new Set<string>();
  let lastLabelX = Infinity;
  const latestWithOutcome = [...meetings].reverse().find((m) => m.outcome)?.date;
  for (const m of [...meetings].reverse()) {
    if (!m.outcome) continue;
    if (narrow && m.outcome.moveBp === 0 && m.date !== latestWithOutcome) continue;
    const mx = x(m.index);
    if (lastLabelX - mx < 30) continue;
    labelled.add(m.date);
    lastLabelX = mx;
  }
  // One row per month (its last published day), every weekday not published, in date order; then
  // the year's high and low and each FOMC decision with its outcome.
  const monthly = series.filter(
    (p, k) => k === series.length - 1 || series[k + 1].date.slice(0, 7) !== p.date.slice(0, 7),
  );
  const dated = [
    ...monthly.map((p) => ({ date: p.date, cell: pts(p.value) })),
    ...gapDays.map((d) => ({ date: d, cell: 'not published' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const decisionAria = meetings
    .map(
      (m) =>
        `${formatShortDate(m.date)} ${m.outcome ? outcomeLabel(m.outcome) : 'outcome not listed'}`,
    )
    .join(', ');
  return (
    <ChartFrame
      finding={`2s10s has held between ${lo.value.toFixed(2)} and ${hi.value.toFixed(2)} points all year. It is ${last.value.toFixed(2)} now.`}
      metric="2s10s spread"
      sub="10-year less 2-year Treasury par yield · percentage points · each weekday for a year, hatched where the Treasury published none · band = the year's range · below 0 the curve inverts · FOMC = a Fed rate decision and its change to the target range in basis points (◆ with projections)"
      height={H}
      {...treasuryFrame('U.S. Treasury · daily par yield curve', asOf, { state: 'computed' })}
      table={{
        caption:
          '2s10s spread, percentage points: month-end, every weekday not published, the year’s extremes and each FOMC decision',
        cols: ['Date', 'Spread'],
        rows: [
          ...dated.map((r) => [formatNoteDate(r.date), r.cell]),
          [`High · ${formatNoteDate(hi.date)}`, pts(hi.value)],
          [`Low · ${formatNoteDate(lo.date)}`, pts(lo.value)],
          ...meetings.map((m) => {
            const v = valueOn.get(m.date);
            return [
              `FOMC decision · ${formatNoteDate(m.date)} · ${m.outcome ? outcomeWords(m.outcome) : 'outcome not yet copied from its statement'}${m.sep ? ' · projections' : ''}`,
              v === undefined ? 'not published' : pts(v),
            ];
          }),
        ],
      }}
      note={
        <>
          FOMC dates from the{' '}
          <Box
            component="a"
            href={FOMC_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit' }}
          >
            Federal Reserve’s meeting calendar
          </Box>{' '}
          (checked {formatNoteDate(FOMC_CHECKED)}), each on its decision day, with the change to the
          target range copied from that day’s FOMC statement (checked{' '}
          {formatNoteDate(FOMC_OUTCOMES_CHECKED)}).
        </>
      }
      testId="chart-spread"
    >
      <Box ref={ref} sx={{ minWidth: 0 }}>
        <svg
          role="img"
          aria-label={`2s10s over the past year: high ${hi.value.toFixed(2)} on ${formatNoteDate(hi.date)}, low ${lo.value.toFixed(2)} on ${formatNoteDate(lo.date)}, ${last.value.toFixed(2)} on ${formatNoteDate(last.date)}${gapDays.length ? `; not published on ${gapDays.length} weekday${gapDays.length === 1 ? '' : 's'}` : ''}${meetings.length ? `; FOMC decisions: ${decisionAria}` : ''}`}
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block' }}
        >
          <defs>
            <pattern
              id={hatchId}
              width="3"
              height="3"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="1" height="3" fill={alpha(theme.palette.text.secondary, 0.4)} />
            </pattern>
          </defs>
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
          {/* Weekdays with no spread: hatched over the plot's full height, the line broken there. */}
          {gapBands.map((g) => (
            <rect
              key={g.from}
              x={g.x0}
              y={T}
              width={g.x1 - g.x0}
              height={H - B - T}
              fill={`url(#${hatchId})`}
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
                {v !== 0 && (
                  <Box
                    component="line"
                    x1={L}
                    x2={W - R}
                    y1={y(v)}
                    y2={y(v)}
                    // Solid hairline gridlines, the bottom one step stronger (FND-17).
                    sx={(t) => ({
                      stroke: i === 0 ? alpha(t.palette.text.secondary, 0.3) : chartRoles(t).grid,
                    })}
                  />
                )}
                <text x={L - 6} y={y(v) + 4} textAnchor="end">
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            {/* Zero means something here: below it the curve inverts. One step stronger than the
                grid, and named (design spreadPlot hlines: "Inverted below 0"). */}
            <Box
              component="line"
              x1={L}
              x2={W - R}
              y1={y(0)}
              y2={y(0)}
              sx={(t) => ({ stroke: chartRoles(t).axis, strokeWidth: 1.25 })}
            />
            <Box component="text" x={L + 6} y={y(0) - 6} sx={halo}>
              Inverted below 0
            </Box>
            {named && (
              <Box
                component="text"
                x={namedX}
                y={namedY}
                textAnchor={namedRight ? 'end' : 'start'}
                sx={(t) => ({
                  ...halo(t),
                  fontFamily: t.typography.fontFamily ?? 'inherit',
                  fontSize: 11,
                })}
              >
                Not published
              </Box>
            )}
            {/* The FOMC lane: a hairline through the plot at each decision, a mark in the lane
                (a diamond when the Fed also published projections), and under it the change to
                the target range from that day's statement. */}
            <text x={L - 6} y={LANE + 4} textAnchor="end">
              FOMC
            </text>
            {meetings.map((m) => (
              <g key={m.date}>
                <Box
                  component="line"
                  x1={x(m.index)}
                  x2={x(m.index)}
                  y1={T}
                  y2={LANE - 7}
                  sx={(t) => ({ stroke: chartRoles(t).edge, strokeDasharray: '2 3' })}
                />
                {m.sep ? (
                  <rect
                    x={x(m.index) - 4}
                    y={LANE - 4}
                    width={8}
                    height={8}
                    transform={`rotate(45 ${x(m.index)} ${LANE})`}
                  />
                ) : (
                  <circle cx={x(m.index)} cy={LANE} r={3.5} />
                )}
                {m.outcome && labelled.has(m.date) && (
                  <Box
                    component="text"
                    x={Math.max(L + 12, x(m.index))}
                    y={LANE + 19}
                    textAnchor="middle"
                    sx={{
                      color: m.outcome.moveBp === 0 ? 'text.secondary' : 'text.primary',
                      fontWeight: m.outcome.moveBp === 0 ? 400 : 600,
                    }}
                  >
                    {outcomeLabel(m.outcome)}
                  </Box>
                )}
              </g>
            ))}
            <text x={L} y={H - 10}>
              {formatShortDate(series[0].date)}
            </text>
            <text x={W - R} y={H - 10} textAnchor="end">
              {formatShortDate(last.date)}
            </text>
          </Box>
          {runs.map((run) =>
            run.length === 1 ? (
              <Box
                key={run[0].date}
                component="circle"
                cx={x(ix(run[0].date))}
                cy={y(run[0].value)}
                r={1.5}
                sx={(t) => ({ fill: t.palette.text.primary })}
              />
            ) : (
              <Box
                key={run[0].date}
                component="polyline"
                points={run
                  .map((p) => `${x(ix(p.date)).toFixed(1)},${y(p.value).toFixed(1)}`)
                  .join(' ')}
                sx={(t) => ({
                  fill: 'none',
                  stroke: t.palette.text.primary,
                  strokeWidth: 1.75,
                  strokeLinejoin: 'round',
                })}
              />
            ),
          )}
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
            <Box
              component="text"
              x={x(iHi) + (hiRight ? -6 : 6)}
              y={y(hi.value) - 6}
              textAnchor={hiRight ? 'end' : 'start'}
              sx={halo}
            >
              {hiText}
            </Box>
            <circle cx={x(iLo)} cy={y(lo.value)} r={3} />
            <Box
              component="text"
              x={x(iLo) + (loRight ? -6 : 6)}
              y={y(lo.value) + 16}
              textAnchor={loRight ? 'end' : 'start'}
              sx={halo}
            >
              {loText}
            </Box>
            <circle cx={x(ix(last.date))} cy={y(last.value)} r={4} />
            <text x={x(ix(last.date)) + 8} y={y(last.value) + 4}>
              {last.value.toFixed(2)}
            </text>
          </Box>
        </svg>
      </Box>
    </ChartFrame>
  );
}

function FeedsNotes({ daily, latest }: { daily: YieldPoint[]; latest: YieldPoint }) {
  const demo = dataMode === 'demo';
  // Staging draws the demo's sample notes on the sample 10-year, never production's notes (D-05).
  const notes = demo
    ? DEMO_NOTE_PRICED
    : researchIndex
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
      source={
        demo
          ? { text: 'Demo · the sample notes · Treasury-shaped 10-year' }
          : { text: 'The notes · U.S. Treasury 10-year', href: TSY_URL }
      }
      table={{
        caption: demo
          ? 'Each sample note’s starting 10-year rate and its drift to today, percent'
          : 'Each note’s starting 10-year rate and its drift to today, percent',
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

// "—" for a figure an older API doesn't send (the percentiles), never "NaN".
const fmtK = (n: number) =>
  Number.isFinite(n)
    ? `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n) / 1000).toLocaleString('en-US')}`
    : '—';

const CFTC_URL = 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm';

/** What every CFTC frame shares: state tag, source and the as-of (positions are as of a Tuesday
 *  and published the Friday after). Its provenance comes from the board; on the demo its source
 *  chip is its one Sample mark (owner decision D1). */
function cftcFrame(futures: Futures, stale = false) {
  const published = new Date(`${futures.report_date}T12:00:00Z`);
  published.setUTCDate(published.getUTCDate() + 3);
  const demo = dataMode === 'demo';
  return {
    tag: {
      state: stale ? ('lastGood' as const) : ('delayed' as const),
      detail: `as of ${formatShortDate(futures.report_date)}`,
    },
    source: demo
      ? { text: 'Demo · shaped like CFTC data' }
      : { text: 'CFTC · Traders in Financial Futures', href: CFTC_URL },
    asOf: demo
      ? `Scenario · ${formatNoteDate(futures.report_date)}`
      : `Positions ${formatNoteDate(futures.report_date)} · published ${formatShortDate(published.toISOString().slice(0, 10))}`,
  };
}

function FuturesSection({ futures, stale = false }: { futures: Futures; stale?: boolean }) {
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
  return (
    <ChartFrame
      {...cftcFrame(futures, stale)}
      finding={finding}
      metric="Futures positioning"
      sub="Net futures positions · thousands of contracts · this week within its own 3-year range · band = 10th–90th percentile · tick = 3-year median · bar = this week · 0 marks the switch from net short to net long"
      height={300}
      note="Reported as of Tuesday and published Friday, so this view is three days old when it updates. It describes who holds what, not what any of them will do."
      table={{
        caption: 'Net futures positions, thousands of contracts, and their 3-year range',
        cols: [
          'Contract · group',
          'Net',
          'On the week',
          '3-yr low',
          '10th pct',
          '3-yr median',
          '90th pct',
          '3-yr high',
          'Of range',
        ],
        rows: groups.map(({ market, who, g }) => [
          `${market.name} · ${who}`,
          fmtK(g.net),
          fmtK(g.week_change),
          fmtK(g.min_3y),
          fmtK(g.p10_3y),
          fmtK(g.median_3y),
          fmtK(g.p90_3y),
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
        aria-label={`${who} ${fmtK(g.net)} thousand contracts, net ${g.net >= 0 ? 'long' : 'short'}, ${Math.round(g.position_in_range * 100)}% of the way from the 3-year low of ${fmtK(g.min_3y)} to the high of ${fmtK(g.max_3y)}; 3-year median ${fmtK(g.median_3y)}; 10th to 90th percentile ${fmtK(g.p10_3y)} to ${fmtK(g.p90_3y)}`}
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
        {/* The middle 80% of the three years' weeks: 10th to 90th percentile (absent from an API
            that predates it, so drawn only when present). */}
        {Number.isFinite(g.p10_3y) && Number.isFinite(g.p90_3y) && (
          <Box
            sx={(t) => ({
              position: 'absolute',
              left: `${at(g.p10_3y) * 100}%`,
              width: `${Math.max(0.5, (at(g.p90_3y) - at(g.p10_3y)) * 100)}%`,
              top: 5,
              height: 12,
              boxSizing: 'border-box',
              borderRadius: '2px',
              bgcolor: chartRoles(t).band,
              borderLeft: `1px solid ${chartRoles(t).edge}`,
              borderRight: `1px solid ${chartRoles(t).edge}`,
            })}
          />
        )}
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

type GroupKey = 'dealers' | 'asset_managers' | 'leveraged_funds' | 'other_reportables';
const GROUPS: { key: GroupKey; name: string }[] = [
  { key: 'dealers', name: 'Dealers' },
  { key: 'asset_managers', name: 'Asset managers' },
  { key: 'leveraged_funds', name: 'Leveraged funds' },
  { key: 'other_reportables', name: 'Other reportables' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/**
 * The 10-year note's four trader groups as small multiples on one scale (design cftcMultiples):
 * four panels, never four hues (P-9); above zero is net long, below net short (P-11). Drawn only
 * when every week in the window carries all four groups.
 */
function PositioningGroups({ futures, stale = false }: { futures: Futures; stale?: boolean }) {
  const m = futures.markets.find((x) => x.code === '043602');
  // `?? []`: an API from before the history existed (a deploy can briefly pair a new page with it)
  // draws nothing here rather than failing the page.
  const weeks = m?.history ?? [];
  if (!m || weeks.length < 2 || !m.dealers || !m.other_reportables) return null;
  const value = (w: (typeof weeks)[number], k: GroupKey) => w[k] ?? 0;
  const all = weeks.flatMap((w) => GROUPS.map((g) => value(w, g.key)));
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const am = m.asset_managers.net;
  const lev = m.leveraged_funds.net;
  const side = (n: number) => (n >= 0 ? 'long' : 'short');
  const always = weeks.every((w) => Math.sign(w.asset_managers) !== Math.sign(w.leveraged_funds));
  const finding =
    Math.sign(am) !== Math.sign(lev)
      ? `Asset managers are net ${side(am)} the ${m.name} and leveraged funds net ${side(lev)}${always ? ', as in every week of the last three years' : ''}`
      : `Asset managers and leveraged funds are both net ${side(am)} the ${m.name}`;
  const first = weeks[0].date;
  const last = weeks[weeks.length - 1].date;
  return (
    <ChartFrame
      {...cftcFrame(futures, stale)}
      finding={finding}
      metric="Positioning by trader group"
      sub={`Net futures positions, ${m.name}, by trader group · thousands of contracts · weekly, ${monthYear(first)} – ${monthYear(last)} · one scale in every panel · above zero is net long`}
      height={280}
      table={{
        caption: `${m.name} net positions by trader group, thousands of contracts, newest week first`,
        cols: ['Week of', ...GROUPS.map((g) => g.name)],
        rows: [...weeks]
          .reverse()
          .map((w) => [w.date, ...GROUPS.map((g) => fmtK(value(w, g.key)))]),
      }}
      testId="chart-positioning-groups"
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
          gap: 2,
        }}
      >
        {GROUPS.map((g) => (
          <GroupPanel
            key={g.key}
            name={g.name}
            series={weeks.map((w) => value(w, g.key))}
            lo={lo}
            hi={hi}
            first={first}
            last={last}
          />
        ))}
      </Box>
    </ChartFrame>
  );
}

function GroupPanel({
  name,
  series,
  lo,
  hi,
  first,
  last,
}: {
  name: string;
  series: number[];
  lo: number;
  hi: number;
  first: string;
  last: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const net = series[series.length - 1];
  // Room for the widest axis label ("+2,828K", 7 mono characters at 11px) and its gap.
  const PL = 62;
  // The top tick's label sits 4px under its line; its em box needs ~9px above that baseline.
  const PT = 9;
  const PH = 76;
  const H = PT + PH + 20;
  const x = (i: number) => PL + (i / Math.max(1, series.length - 1)) * Math.max(0, W - PL - 4);
  const y = (v: number) => PT + ((hi - v) / (hi - lo || 1)) * PH;
  const ticks = [hi, 0, lo].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <Box
      component="article"
      sx={(t) => ({
        p: 1.5,
        borderRadius: '10px',
        border: `1px solid ${t.palette.divider}`,
        display: 'grid',
        gap: 0.75,
        minWidth: 0,
      })}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box component="h3" sx={{ m: 0, fontSize: 14, fontWeight: 600 }}>
          {name}
        </Box>
        <Box component="span" sx={{ ...MONO, fontSize: 12 }}>
          {`${fmtK(net)}K net ${net >= 0 ? 'long' : 'short'}`}
        </Box>
      </Box>
      <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
        {W > 0 && (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`${name}: net ${net >= 0 ? 'long' : 'short'} ${fmtK(net)} thousand contracts now; weekly from ${first} to ${last}`}
            style={{ display: 'block' }}
          >
            <GroupAxes ticks={ticks} y={y} W={W} PL={PL} />
            <GroupLine points={series.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            <GroupDates W={W} PL={PL} yBase={PT + PH + 15} first={first} last={last} />
          </svg>
        )}
      </Box>
    </Box>
  );
}

function GroupAxes({
  ticks,
  y,
  W,
  PL,
}: {
  ticks: number[];
  y: (v: number) => number;
  W: number;
  PL: number;
}) {
  return (
    <Box
      component="g"
      sx={(t) => ({
        '& line': { stroke: chartRoles(t).grid },
        '& line.zero': { stroke: chartRoles(t).axis },
        '& text': { fill: t.palette.text.secondary },
      })}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'zero' : undefined} x1={PL} x2={W} y1={y(v)} y2={y(v)} />
          <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize={11} style={MONO}>
            {v === 0 ? '0' : `${fmtK(v)}K`}
          </text>
        </g>
      ))}
    </Box>
  );
}

function GroupLine({ points }: { points: string }) {
  return (
    <Box
      component="polyline"
      points={points}
      sx={(t) => ({
        fill: 'none',
        stroke: chartRoles(t).emph,
        strokeWidth: 1.5,
        strokeLinejoin: 'round',
      })}
    />
  );
}

function GroupDates({
  W,
  PL,
  yBase,
  first,
  last,
}: {
  W: number;
  PL: number;
  yBase: number;
  first: string;
  last: string;
}) {
  return (
    <Box component="g" sx={(t) => ({ '& text': { fill: t.palette.text.secondary } })}>
      <text x={PL} y={yBase} fontSize={11} style={MONO}>
        {monthYear(first)}
      </text>
      <text x={W} y={yBase} textAnchor="end" fontSize={11} style={MONO}>
        {monthYear(last)}
      </text>
    </Box>
  );
}

/**
 * First paint while /api/public-data/markets answers (a cold read takes seconds): every section
 * under its heading and every frame at its final height, each naming its metric (P-10), never bare
 * grey blocks (D-09).
 */
function MarketsLoading() {
  const provenance: Provenance = dataMode === 'demo' ? 'sample' : 'primary';
  const frame = (metric: string, sub: string, height: FrameHeight, reserve?: FrameReserve) => (
    <ChartFrame
      finding={metric}
      metric={metric}
      sub={sub}
      provenance={provenance}
      status={{ kind: 'loading' }}
      height={height}
      reserve={reserve}
    />
  );
  return (
    <Box
      aria-busy="true"
      aria-label="Loading rates and positioning"
      sx={{ display: 'grid', gap: 4 }}
    >
      <MarketsSection id="rates" title="Rates">
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <Caps>Rates today</Caps>
          <Box
            role="status"
            sx={(t) => ({
              ...PANEL_SX,
              height: 104,
              display: 'flex',
              alignItems: 'center',
              px: 2.5,
              fontSize: 13,
              color: 'text.secondary',
              bgcolor: alpha(t.palette.text.secondary, 0.04),
            })}
          >
            Loading the Treasury’s latest curve…
          </Box>
        </Box>
        <Box sx={PAIR_SX}>
          <Box sx={{ minWidth: 0 }}>
            {frame(
              'Treasury yield curve',
              'U.S. Treasury par yields by maturity · percent',
              // CurvePanel's H: 240 on a narrow plot, 280 otherwise.
              { xs: 240, sm: 280 },
              // The ready head's rows at their usual length (curveFinding, CurvePanel's sub and
              // legend), held so the frame keeps its height when the data lands (FND-15).
              {
                finding:
                  'The front end fell 0.21 points in a year while the 30-year rose 0.72: the curve steepened; the front no longer inverts',
                sub: 'U.S. Treasury par yields by maturity · percent · Oct 7, 2026 against a month and a year earlier · 1 month to 30 years, spaced by √years',
                tag: { state: 'updated', detail: 'Oct 7' },
                legend: 3,
              },
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {frame('The 10-year’s move, split', 'Change over the year · percentage points', 160, {
              finding: 'Real yields did all of it. Inflation expectations held still.',
              sub: 'Change over the year to Oct 7, 2026 · percentage points · 10-year = real (TIPS) + breakeven (calculated) · zero at the centre',
              tag: { state: 'computed' },
              note: 'The 10-year is a real yield plus expected inflation, so this splits its move between the two. Breakeven is the 10-year less the real 10-year.',
            })}
          </Box>
        </Box>
        {frame('2s10s spread', '10-year less 2-year Treasury par yield · percentage points', 262)}
        {frame(
          'Note discount rates against the 10-year',
          'The 10-year rate each note’s discount rate started from · percent',
          200,
        )}
      </MarketsSection>
      <MarketsSection id="positioning" title="Positioning">
        {frame(
          'Futures positioning',
          'CFTC Traders in Financial Futures · thousands of contracts',
          300,
        )}
        {frame('Positioning by trader group', '10-year T-note · weekly, three years', 280)}
      </MarketsSection>
      <MarketsSection id="stress" title="Stress" lead={STRESS_LEAD}>
        {frame(
          STRESS_METRIC,
          STRESS_SUB,
          STRESS_HEIGHT,
          // The ready head and note at their usual length, held so the frame keeps its height.
          {
            finding:
              'The fear–greed gauge reads Neutral (50): vol positioning pulls toward fear, equity stress toward greed',
            tag: { state: 'computed', detail: 'as of Oct 19' },
            note: STRESS_NOTE,
          },
        )}
      </MarketsSection>
      <MarketsSection id="liquidity" title="Liquidity" lead={LIQUIDITY_LEAD}>
        {frame(
          'Net liquidity',
          'Fed total assets less the Treasury General Account less overnight reverse repo · weekly',
          320,
        )}
      </MarketsSection>
    </Box>
  );
}
