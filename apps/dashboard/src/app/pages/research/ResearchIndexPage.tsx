/**
 * `/research` — every ticker with published notes (live mode): what's coming up across all of them,
 * then one card per ticker with its headline, a revenue sketch, the next catalyst and the note's
 * freshness (the metric row and price-vs-value strip live in the note's header, owner 2026-10-14).
 * Everything comes from the build's index; freshness and
 * "coming up" are worked out in the reader's browser. In the demo build the per-ticker tabs carry
 * authored sample notes instead, so this page points at those.
 */
import { chartRoles } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { dataMode, loadSampleBars, loadSampleResearch } from '@convexa/api';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  freshness as freshnessOf,
  localToday,
  researchIndex,
  upcoming,
} from 'virtual:convexa-research';
import { filedSince } from './filings';
import { formatNoteDate, STANCE_LABEL, UNCERTAINTY_LABEL } from './format';
import { RESEARCH_DISCLAIMER, ResearchColumn } from './NotesView';
import { usePublicFilings, usePublicMarkets } from './publicData';
import { ProvenanceChip } from './publicUi';
import { ResearchTabs } from './ResearchTabs';
import { calendarTriggers, FOMC_TRIGGER, fomcDays, withCalendar } from './reviewTriggers';
import type { Aging, ChartBlock, Freshness, NoteStance, ResearchTickerSummary } from './types';
import {
  DISPLAY,
  Eyebrow,
  FreshnessLine,
  MONO,
  Panel,
  PANEL_SX,
  Pill,
  StateDot,
  YourCall,
} from './ui';

const TICKERS = researchIndex.map((r) => r.ticker);

const DEMO = dataMode === 'demo';

/** The demo's sample symbols, by name (the scenario carries tickers only). */
const SAMPLE_NAMES: Record<string, string> = {
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  NVDA: 'NVIDIA',
  QQQ: 'Invesco QQQ Trust',
  SPY: 'SPDR S&P 500 ETF',
  TSLA: 'Tesla',
};

type SampleCard = { ticker: string; title: string; thesis: string; chart: ChartBlock | null };

/** The six authored sample notes, each with its last ten sample sessions' close-to-close change. */
function useSampleCards(): SampleCard[] | null | undefined {
  const [cards, setCards] = useState<SampleCard[] | null | undefined>(undefined);
  useEffect(() => {
    if (!DEMO) return;
    let alive = true;
    const symbols = [...STAGING_DEMO_SYMBOLS].sort();
    void Promise.all(
      symbols.map(async (symbol): Promise<SampleCard | null> => {
        const [research, bars] = await Promise.all([
          loadSampleResearch(symbol),
          loadSampleBars(symbol),
        ]);
        if (research.state !== 'ready') return null;
        const closes = bars.state === 'ready' ? bars.value.bars.slice(-11) : [];
        const changes = closes.slice(1).map((b, i) => ({
          date: b.date,
          // Sample sessions move by hundredths of a percent: shown to two places.
          value: Math.round(((b.close - closes[i].close) / closes[i].close) * 10000) / 100,
        }));
        return {
          ticker: symbol,
          title: research.value.title,
          thesis: research.value.thesis,
          chart: changes.length
            ? {
                type: 'chart',
                caption: 'Daily close change, % · last 10 sample sessions',
                bars: changes.map((c) => ({
                  label: formatNoteDate(c.date),
                  value: c.value,
                  kind: '',
                  shown: `${c.value > 0 ? '▲ +' : c.value < 0 ? '▼ −' : '± '}${Math.abs(c.value).toFixed(2)}%`,
                })),
                latest: changes.length - 1,
              }
            : null,
        };
      }),
    ).then(
      (list) => {
        if (alive) setCards(list.filter((c): c is SampleCard => c !== null));
      },
      () => {
        if (alive) setCards(null);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return cards;
}

/** A sample note's card: the same card as production's, dashed with the hatch stripe (canon P-3). */
function SampleNoteCard({ card }: { card: SampleCard }) {
  const href = `/ticker/${encodeURIComponent(card.ticker)}/research`;
  return (
    <Box
      component="article"
      aria-labelledby={`card-${card.ticker}`}
      sx={(t) => ({
        ...PANEL_SX,
        position: 'relative',
        borderRadius: '16px',
        border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
        p: 2.5,
        pt: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        minWidth: 0,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 8,
          borderRadius: '15px 15px 0 0',
          pointerEvents: 'none',
          background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(t.palette.text.secondary, 0.28)} 6px 12px)`,
        },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
          <Link
            component={RouterLink}
            to={href}
            id={`card-${card.ticker}`}
            underline="hover"
            sx={{ ...DISPLAY, fontWeight: 800, fontSize: 32, lineHeight: 1, color: 'text.primary' }}
          >
            {card.ticker}
          </Link>
          <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
            {SAMPLE_NAMES[card.ticker] ?? card.ticker}
          </Box>
        </Box>
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <DataStateTag state="sample" />
        </Box>
      </Box>
      <Box
        component="h2"
        sx={{
          ...DISPLAY,
          m: 0,
          fontWeight: 600,
          fontSize: 19,
          lineHeight: 1.25,
          textWrap: 'balance',
        }}
      >
        {card.title}
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        {card.thesis}
      </Box>
      {card.chart && <MiniChart chart={card.chart} />}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px 14px',
          fontSize: 12,
          color: 'text.secondary',
          mt: 'auto',
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <StateDot state="current" />
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Current
          </Box>
          <span>· scenario of Oct 7</span>
        </Box>
        <Link component={RouterLink} to={href} sx={{ ml: 'auto', fontWeight: 500 }}>
          Open note →
        </Link>
      </Box>
    </Box>
  );
}

/** Why freshness falls back to the notes' own dates: filings aren't set up, are off, or failed. */
function FilingsFallback({ state }: { state: 'not_configured' | 'off' | 'unavailable' | 'error' }) {
  const [tag, detail, why]: [DataStateKey, string, string] =
    state === 'not_configured'
      ? ['notSetUp', 'filings', 'Filings aren’t checked on this site yet']
      : state === 'off'
        ? ['off', 'filings', 'Public data is switched off on this server']
        : state === 'unavailable'
          ? ['sourceDown', 'SEC EDGAR', 'SEC EDGAR didn’t answer and no earlier copy is cached']
          : ['couldntLoad', 'filings', 'Convexa’s server didn’t answer the filings check'];
  return (
    <Box
      component="p"
      role="note"
      sx={{
        m: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px 10px',
        fontSize: 13,
        color: 'text.secondary',
      }}
    >
      <DataStateTag state={tag} detail={detail} />
      <Box component="span" sx={{ minWidth: 0, flex: '1 1 320px', textWrap: 'pretty' }}>
        {`Freshness here comes from each note’s dates. ${why}, so a new 10-Q won’t mark a note due until its own date passes.`}
      </Box>
    </Box>
  );
}

/** `aging`: the note's own dates with the calendar's review triggers added (reviewTriggers.ts). */
type Row = ResearchTickerSummary & { f: Freshness; aging: Aging };

const HATCH = (t: Theme) =>
  `repeating-linear-gradient(135deg, ${alpha(t.palette.text.secondary, 0.7)} 0 3px, ${alpha(t.palette.text.secondary, 0.28)} 3px 6px)`;

function MiniChart({ chart }: { chart: Omit<ChartBlock, 'type'> }) {
  // One scale that includes zero, so a loss goes below a zero line instead of reading as a 3px stub
  // that looks like zero (design/CHARTS-2026-10-13.md RN-13: HOOD's −90% margin, MU's loss).
  const lo = Math.min(0, ...chart.bars.map((b) => b.value));
  const hi = Math.max(0, ...chart.bars.map((b) => b.value));
  const span = hi - lo || 1;
  const y = (v: number) => ((v - lo) / span) * 56;
  const last = chart.bars[chart.latest];
  return (
    // One column that may shrink below the caption's width; a long caption wraps (its unit is often
    // at the end, so it is never cut off) instead of widening the card past a phone screen.
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        <Box component="span" sx={{ minWidth: 0, lineHeight: 1.4, textWrap: 'pretty' }}>
          {chart.caption}
        </Box>
        {last && (
          <Box component="span" sx={{ ...MONO, color: 'text.primary', whiteSpace: 'nowrap' }}>
            {last.shown || last.value.toLocaleString('en-US')}
          </Box>
        )}
      </Box>
      <Box
        role="img"
        aria-label={`${chart.caption}: ${chart.bars.map((b) => `${b.label} ${b.shown || b.value}`).join(', ')}`}
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          gap: 0.5,
          height: 56,
          position: 'relative',
        }}
      >
        <Box
          aria-hidden
          sx={(t) => ({
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `${y(0)}px`,
            borderTop: `1px solid ${chartRoles(t).axis}`,
            pointerEvents: 'none',
          })}
        />
        {chart.bars.map((b, i) => (
          <Box
            key={i}
            sx={(t) => ({
              // Bars stay thin (≤ 18px) at any card width and are never scaled down below that.
              flex: '1 1 0',
              maxWidth: 18,
              height: Math.max(2, Math.round(y(Math.max(0, b.value)) - y(Math.min(0, b.value)))),
              mb: `${Math.round(y(Math.min(0, b.value)))}px`,
              borderRadius: b.value < 0 ? '1px 1px 3px 3px' : '3px 3px 1px 1px',
              boxSizing: 'border-box',
              ...(b.kind === 'guide'
                ? { border: `1.5px dashed ${chartRoles(t).ctx}` }
                : b.kind === 'approx'
                  ? { background: HATCH(t) }
                  : { bgcolor: i === chart.latest ? chartRoles(t).emph : chartRoles(t).ctx }),
            })}
          />
        ))}
      </Box>
    </Box>
  );
}

function TickerCard({ row, today }: { row: Row; today: string }) {
  const n = row.latest;
  const href = `/ticker/${encodeURIComponent(row.ticker)}/research`;
  const next =
    row.f.state === 'archived' ? null : (upcoming(row.aging.events, today, 3650)[0] ?? null);
  return (
    <Box
      component="article"
      aria-labelledby={`card-${row.ticker}`}
      sx={(t) => ({
        ...PANEL_SX,
        borderRadius: '16px',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        boxShadow:
          t.palette.mode === 'dark'
            ? `0 1px 2px ${alpha(t.palette.common.black, 0.24)}, 0 2px 6px ${alpha(t.palette.common.black, 0.16)}`
            : 'none',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
          <Link
            component={RouterLink}
            to={href}
            id={`card-${row.ticker}`}
            underline="hover"
            sx={{ ...DISPLAY, fontWeight: 800, fontSize: 32, lineHeight: 1, color: 'text.primary' }}
          >
            {row.ticker}
          </Link>
          {(n.company || n.about) && (
            <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
              {[n.company, n.about?.split('·')[0]?.trim()].filter(Boolean).join(' · ')}
            </Box>
          )}
        </Box>
        <Box sx={{ ml: 'auto', display: 'grid', justifyItems: 'end', gap: 0.5, flexShrink: 0 }}>
          {n.stance ? (
            <Pill variant="strong">{STANCE_LABEL[n.stance]}</Pill>
          ) : (
            <YourCall label="Stance · your call" />
          )}
          {n.uncertainty && (
            <Box
              component="span"
              sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              Uncertainty ·{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {UNCERTAINTY_LABEL[n.uncertainty]}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      <Box
        component="h2"
        sx={{
          ...DISPLAY,
          m: 0,
          fontWeight: 600,
          fontSize: 19,
          lineHeight: 1.25,
          textWrap: 'balance',
        }}
      >
        {n.title}
      </Box>
      {n.chart && <MiniChart chart={n.chart} />}
      {next && (
        <Box
          sx={(t) => ({
            display: 'grid',
            gap: 0.25,
            px: 1.5,
            py: 1.25,
            borderRadius: '10px',
            bgcolor:
              t.palette.mode === 'dark'
                ? alpha(t.palette.common.black, 0.2)
                : alpha(t.palette.text.primary, 0.04),
            border: 1,
            borderColor: 'divider',
          })}
        >
          <Eyebrow sx={{ fontSize: 11 }}>
            Next ·{' '}
            {next.inDays <= 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`}
          </Eyebrow>
          <Box component="span" sx={{ fontSize: 14, fontWeight: 500 }}>
            {next.label}, {next.whenLabel}
          </Box>
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          fontSize: 12,
          color: 'text.secondary',
          mt: 'auto',
        }}
      >
        <FreshnessLine freshness={row.f} notFollowingSince={n.notFollowingSince} />
        <span>Written {formatNoteDate(n.date)}</span>
        <span>{n.readMinutes} min read</span>
        {n.sourceCount > 0 && (
          <span>{n.sourceCount === 1 ? '1 source' : `${n.sourceCount} sources`}</span>
        )}
        <Link component={RouterLink} to={href} sx={{ ml: 'auto', fontWeight: 500 }}>
          Open note →
        </Link>
      </Box>
    </Box>
  );
}

const FILTER_SX =
  (on: boolean, dashed = false) =>
  (t: Theme) => ({
    height: 36,
    px: 1.75,
    borderRadius: '999px',
    font: 'inherit',
    fontSize: 13,
    fontWeight: on ? 600 : 500,
    cursor: 'pointer',
    border: on
      ? '1px solid transparent'
      : `1px ${dashed ? 'dashed' : 'solid'} ${alpha(t.palette.text.secondary, 0.4)}`,
    bgcolor: on ? 'text.primary' : 'transparent',
    color: on ? 'background.default' : 'text.secondary',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
  });

type StanceFilter = 'all' | NoteStance | 'unset';
type FreshFilter = 'any' | Freshness['state'];

export function ResearchIndexPage() {
  const today = useMemo(() => localToday(), []);
  const [query, setQuery] = useState('');
  const [stance, setStance] = useState<StanceFilter>('all');
  const [fresh, setFresh] = useState<FreshFilter>('any');
  // Filings since each note make it due too; without them (API off or down) dates alone decide,
  // and the page says so.
  const filingsRead = usePublicFilings(TICKERS, !DEMO);
  const filings = filingsRead.data?.state === 'live' ? filingsRead.data.filings : null;
  // The calendar's review triggers: FOMC decisions for valued notes, estimated results windows.
  const markets = usePublicMarkets(!DEMO);
  const fomc = useMemo(() => fomcDays(markets.data?.calendar), [markets.data]);
  const windows = filingsRead.data?.results;
  const filingsFallback =
    DEMO || filingsRead.loading
      ? null
      : filingsRead.error
        ? ('error' as const)
        : filingsRead.data && filingsRead.data.state !== 'live'
          ? filingsRead.data.state
          : null;
  const samples = useSampleCards();
  const sampleShown = (samples ?? []).filter(
    (c) =>
      !query ||
      `${c.ticker} ${SAMPLE_NAMES[c.ticker] ?? ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const rows: Row[] = useMemo(
    () =>
      researchIndex.map((r) => {
        const aging = withCalendar(
          r.latest.aging,
          calendarTriggers({
            note: {
              ticker: r.ticker,
              date: r.latest.date,
              valued: r.latest.valuation !== null,
              aging: r.latest.aging,
            },
            today,
            fomc,
            windows: windows ?? [],
          }),
        );
        return {
          ...r,
          aging,
          f: freshnessOf(aging, {
            today,
            notFollowingSince: r.latest.notFollowingSince,
            filed: filings
              ? filedSince(
                  filings.filter((x) => x.ticker === r.ticker),
                  r.latest,
                )
              : [],
          }),
        };
      }),
    [today, filings, fomc, windows],
  );
  const shown = rows.filter(
    (r) =>
      (!query ||
        `${r.ticker} ${r.latest.company ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())) &&
      (stance === 'all' ||
        (stance === 'unset' ? r.latest.stance === null : r.latest.stance === stance)) &&
      (fresh === 'any' || r.f.state === fresh),
  );
  const live = rows.filter((r) => r.f.state !== 'archived');
  // The FOMC is one row for every valued note, as on the calendar, not one per note.
  const nextFomc = live
    .flatMap((r) => upcoming(r.aging.events, today, 70).filter((u) => u.label === FOMC_TRIGGER))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  // It always keeps a place among the six: it makes more notes due than any one catalyst.
  const soon = [
    ...live
      .flatMap((r) =>
        upcoming(r.aging.events, today, 70)
          .filter((u) => u.label !== FOMC_TRIGGER)
          .map((u) => ({ ...u, ticker: r.ticker })),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, nextFomc ? 5 : 6),
    ...(nextFomc
      ? [{ ...nextFomc, ticker: 'Fed', whenLabel: `${nextFomc.whenLabel} · every valued note` }]
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const count = (pred: (r: Row) => boolean) => rows.filter(pred).length;
  const stances: { key: StanceFilter; label: string; dashed?: boolean }[] = [
    { key: 'all', label: `All · ${rows.length}` },
    ...(['bullish', 'bearish', 'neutral', 'watching'] as NoteStance[])
      .map((s) => ({
        key: s as StanceFilter,
        label: `${STANCE_LABEL[s]} · ${count((r) => r.latest.stance === s)}`,
      }))
      .filter((s) => !s.label.endsWith('· 0')),
    {
      key: 'unset',
      label: `Stance not set · ${count((r) => r.latest.stance === null)}`,
      dashed: true,
    },
  ];
  const freshStates: Freshness['state'][] = ['current', 'due', 'archived'];

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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 32px' }}>
          <Box sx={{ flex: '999 1 480px', display: 'grid', gap: 1.25 }}>
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
              Research
            </Box>
            <Box
              component="p"
              sx={{ m: 0, maxWidth: '62ch', color: 'text.secondary', fontSize: 16 }}
            >
              {DEMO
                ? 'Sample research notes authored for the demo scenario, one per sample symbol. Each opens with its thesis, evidence and what would change it.'
                : 'Notes on the tickers being followed: what the price implies, the evidence, the debate, a valuation with its assumptions shown, and what comes next. Each opens with a 30-second summary.'}
            </Box>
            {DEMO && (
              <Box>
                <ProvenanceChip
                  text="Demo · sample notes · scenario of Oct 7, 2026"
                  kind="sample"
                />
              </Box>
            )}
          </Box>
          {(DEMO || rows.length > 0) && (
            <Box
              sx={{
                flex: '1 1 240px',
                display: 'flex',
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
              }}
            >
              <Box
                component="label"
                htmlFor="research-find"
                sx={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                }}
              >
                Find a ticker
              </Box>
              <Box
                component="input"
                id="research-find"
                type="search"
                placeholder="Find a ticker"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                sx={(t) => ({
                  width: '100%',
                  maxWidth: 260,
                  height: 44,
                  boxSizing: 'border-box',
                  px: 1.75,
                  borderRadius: '8px',
                  border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  font: 'inherit',
                  fontSize: 14,
                })}
              />
            </Box>
          )}
        </Box>

        {DEMO ? (
          <>
            <Box
              component="section"
              aria-labelledby="coming-up"
              sx={(t) => ({
                ...PANEL_SX,
                border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
                p: { xs: 2, sm: 2.5 },
                display: 'grid',
                gap: 0.75,
              })}
            >
              <Box
                component="h2"
                id="coming-up"
                sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 20 }}
              >
                Coming up · next 10 weeks
              </Box>
              <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
                The demo’s sample notes carry no dated catalysts, so nothing comes due in this
                scenario. In production this lists the next six events across every note.
              </Box>
            </Box>
            <Box
              component="section"
              aria-label="Sample notes"
              aria-busy={samples === undefined}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                gap: 2,
              }}
            >
              {sampleShown.map((card) => (
                <SampleNoteCard key={card.ticker} card={card} />
              ))}
              {samples === null && (
                <Box component="p" role="status" sx={{ m: 0, color: 'text.secondary' }}>
                  The sample notes didn&apos;t load. Reload the page to try again.
                </Box>
              )}
              {samples && sampleShown.length === 0 && (
                <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
                  No ticker matches this search.
                </Box>
              )}
            </Box>
          </>
        ) : rows.length === 0 ? (
          <Panel sx={{ p: 3, display: 'grid', gap: 0.5 }}>
            <Box component="h2" sx={{ m: 0, fontSize: 17, fontWeight: 600 }}>
              No research published yet.
            </Box>
            <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
              Notes will be listed here as they're written.
            </Box>
          </Panel>
        ) : (
          <>
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Box
                role="group"
                aria-label="Filter by stance"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                {stances.map((s) => (
                  <Box
                    component="button"
                    type="button"
                    key={s.key}
                    aria-pressed={stance === s.key}
                    onClick={() => setStance(s.key)}
                    sx={FILTER_SX(stance === s.key, s.dashed)}
                  >
                    {s.label}
                  </Box>
                ))}
              </Box>
              <Box
                role="group"
                aria-label="Filter by freshness"
                sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
              >
                <Eyebrow sx={{ mr: 0.5 }}>Freshness</Eyebrow>
                {freshStates.map((s) => (
                  <Box
                    component="button"
                    type="button"
                    key={s}
                    aria-pressed={fresh === s}
                    onClick={() => setFresh(fresh === s ? 'any' : s)}
                    sx={FILTER_SX(fresh === s)}
                  >
                    {s === 'current' ? 'Current' : s === 'due' ? 'Review due' : 'Archived'} ·{' '}
                    {count((r) => r.f.state === s)}
                  </Box>
                ))}
              </Box>
              {filingsFallback && <FilingsFallback state={filingsFallback} />}
            </Box>

            {soon.length > 0 && (
              <Box
                component="section"
                aria-labelledby="coming-up"
                sx={{ display: 'grid', gap: 1.5 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: '4px 12px',
                  }}
                >
                  <Box
                    component="h2"
                    id="coming-up"
                    sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 20 }}
                  >
                    Coming up
                  </Box>
                  <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
                    Catalysts from every note, next 10 weeks, and the calendar’s: the FOMC for every
                    note with a valuation, and results windows estimated from filing history. Each
                    date is when its note comes due for review; an estimated window, once the
                    results are filed.
                  </Box>
                </Box>
                <Box
                  component="ol"
                  sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: 1.25,
                  }}
                >
                  {soon.map((u, i) => (
                    <Box
                      component="li"
                      key={`${u.ticker}-${u.label}-${u.date}`}
                      sx={(t) => ({
                        ...PANEL_SX,
                        px: 1.75,
                        py: 1.5,
                        display: 'grid',
                        gap: 0.75,
                        ...(i === 0 ? { borderColor: alpha(t.palette.text.primary, 0.35) } : {}),
                      })}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Box
                          component="span"
                          sx={(t) => ({
                            ...MONO,
                            fontSize: 11,
                            fontWeight: 600,
                            px: 0.875,
                            py: '2px',
                            borderRadius: '5px',
                            bgcolor: alpha(t.palette.text.secondary, 0.16),
                          })}
                        >
                          {u.ticker}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            ...MONO,
                            fontSize: 11,
                            color: i === 0 ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {u.inDays <= 0
                            ? 'today'
                            : u.inDays === 1
                              ? 'tomorrow'
                              : u.inDays < 14
                                ? `in ${u.inDays} days`
                                : `~${Math.round(u.inDays / 7)} weeks`}
                        </Box>
                      </Box>
                      <Box
                        component="span"
                        sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}
                      >
                        {u.label}
                      </Box>
                      <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
                        {u.whenLabel}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Box
              component="section"
              aria-label="Tickers"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                gap: 2,
              }}
            >
              {shown.map((row) => (
                <TickerCard key={row.ticker} row={row} today={today} />
              ))}
              {shown.length === 0 && (
                <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
                  No ticker matches these filters.
                </Box>
              )}
            </Box>
          </>
        )}

        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
          {DEMO
            ? 'Sample notes written for the demo; no news, filings or AI read is cited. Not financial advice.'
            : RESEARCH_DISCLAIMER}
        </Box>
      </Box>
    </ResearchColumn>
  );
}

export default ResearchIndexPage;
