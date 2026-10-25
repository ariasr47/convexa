/**
 * `/research` — every ticker with published notes (live mode): what's coming up across all of them,
 * then one card per ticker with its headline, a revenue sketch, the next catalyst and the note's
 * freshness (the metric row and price-vs-value strip live in the note's header, owner 2026-10-14).
 * Everything comes from the build's index; freshness and
 * "coming up" are worked out in the reader's browser. In the demo build the per-ticker tabs carry
 * authored sample notes instead, so this page points at those.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { chartRoles } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { STAGING_DEMO_NAMES, STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { FrameDemoTagProvider } from '@/shared/ui/Widget/WidgetProvenanceContext';
import {
  dataMode,
  DEMO_CALENDAR,
  DEMO_CALENDAR_TODAY,
  DEMO_FOLLOWED,
  DEMO_NOTE_RESULTS,
  DEMO_RESULTS_WINDOWS,
  loadSampleBars,
  loadSampleResearch,
} from '@convexa/api';
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
import { formatNoteDate, formatShortDate, STANCE_LABEL, UNCERTAINTY_LABEL } from './format';
import { RESEARCH_DISCLAIMER, ResearchColumn } from './NotesView';
import { usePublicFilings } from './publicData';
import { PAGE_BODY_SX, PageHead, ProvenanceChip } from './publicUi';
import { ResearchTabs } from './ResearchTabs';
import {
  calendarTriggers,
  FOMC_TRIGGER,
  fomcDays,
  sampleNoteAging,
  withCalendar,
} from './reviewTriggers';
import type {
  Aging,
  ChartBlock,
  Freshness,
  NoteStance,
  ResearchTickerSummary,
  Upcoming,
} from './types';
import { DISPLAY, FreshnessLine, MONO, Panel, PANEL_SX, Pill, StateDot, YourCall } from './ui';

const TICKERS = researchIndex.map((r) => r.ticker);
/** The newest note in the build: the date the production chip names. */
const NEWEST_NOTE = researchIndex.reduce<string | null>(
  (max, r) => (max === null || r.latest.date > max ? r.latest.date : max),
  null,
);

const DEMO = dataMode === 'demo';

/**
 * FOMC decision days for the review triggers: the Fed's published schedule (fomc.ts). This page and
 * the note page read the dated table rather than /api/public-data/markets, an ~89 KB answer they
 * would fetch only for these dates; the calendar's reading of a moved meeting reaches them when the
 * table is next checked. /research/markets#coming-up, which draws the releases, still reads it.
 */
const FOMC_DAYS = fomcDays(null);

/** A Coming up row: `expected` when the note gives the catalyst as expected, not confirmed. */
type ComingUpItem = Upcoming & { ticker: string; expected?: boolean };

/** Whether the note gives this catalyst as expected (its catalysts block's status word), so its row
 *  can say so beside the window, as the note's own list does ("Expected"). */
const isExpected = (events: Aging['events'], u: Upcoming) =>
  events.some(
    (e) =>
      e.kind === 'catalyst' &&
      e.status === 'expected' &&
      e.label === u.label &&
      e.when.end === u.date,
  );

/**
 * The next catalysts across notes, up to six, soonest first as upcoming() orders them. The FOMC is one
 * row for every note it makes due, as on the calendar, not one per note, and it always keeps a
 * place: it makes more notes due than any one catalyst.
 */
function comingUp(
  rows: { ticker: string; aging: Aging }[],
  today: string,
  fomcWho: string,
): ComingUpItem[] {
  // As upcoming() orders each note's: the day it opens, or once open, the day it closes.
  const byStart = (a: Upcoming, b: Upcoming) =>
    a.at.localeCompare(b.at) || a.date.localeCompare(b.date);
  const nextFomc = rows
    .flatMap((r) => upcoming(r.aging.events, today, 70).filter((u) => u.label === FOMC_TRIGGER))
    .sort(byStart)[0];
  return [
    ...rows
      .flatMap((r) =>
        upcoming(r.aging.events, today, 70)
          .filter((u) => u.label !== FOMC_TRIGGER)
          .map((u) => ({ ...u, ticker: r.ticker, expected: isExpected(r.aging.events, u) })),
      )
      .sort(byStart)
      .slice(0, nextFomc ? 5 : 6),
    ...(nextFomc
      ? [{ ...nextFomc, ticker: 'Fed', whenLabel: `${nextFomc.whenLabel} · ${fomcWho}` }]
      : []),
  ].sort(byStart);
}

/** Staging's sample notes with the scenario calendar's review triggers (owner ruling 7). */
const SAMPLE_AGING = DEMO
  ? sampleNoteAging({
      followed: DEMO_FOLLOWED,
      noteResults: DEMO_NOTE_RESULTS,
      calendar: DEMO_CALENDAR,
      windows: DEMO_RESULTS_WINDOWS,
      today: DEMO_CALENDAR_TODAY,
    })
  : [];

/** The demo's sample symbols, by name: the one shared list, also read by ⌘K (shared/lib/demoSite). */
const SAMPLE_NAMES = STAGING_DEMO_NAMES;

type SampleCard = { ticker: string; title: string; thesis: string; chart: ChartBlock | null };

/** Every sample note is current on its scenario day (its card says “Current · scenario of Oct 7”);
 *  the demo's freshness chip counts the same word. */
const SAMPLE_FRESHNESS: Freshness['state'] = 'current';

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
                caption: 'Daily close change, % · last 10 sessions',
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

/**
 * A note card's anatomy (design: research.mjs noteCard / demoCard, `.fr-card`): the ticker inline in
 * mono with the company beside it, the title, the mini chart, one 12px meta line (uncertainty and the
 * next catalyst), and a ruled footer of freshness, when it was written and the link. Compact, so a row
 * of cards reads at a glance (fidelity audit 2026-10-25, R-01).
 */
const CARD_SX = (t: Theme) => ({
  ...PANEL_SX,
  p: '18px 20px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 1.25,
  minWidth: 0,
  boxShadow:
    t.palette.mode === 'dark'
      ? `0 1px 2px ${alpha(t.palette.common.black, 0.24)}, 0 2px 6px ${alpha(t.palette.common.black, 0.16)}`
      : 'none',
});

const CARD_TITLE_SX = {
  ...DISPLAY,
  m: 0,
  fontWeight: 600,
  fontSize: 16.5,
  lineHeight: 1.3,
  textWrap: 'balance',
} as const;

/** The card's head: the ticker inline in 16px mono, its company in 13px beside it, and the card's
 *  one chip (stance, or the sample tag) at the right. */
function CardHead({
  ticker,
  href,
  company,
  chip,
}: {
  ticker: string;
  href: string;
  company: string | null;
  chip: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px 8px',
      }}
    >
      {/* One line: a long legal name ("Space Exploration Technologies Corp. (SpaceX)") ends in an
          ellipsis rather than pushing the chip to a line of its own. The clip box reaches 4px past
          the text (padding, cancelled by the margin, so nothing moves): the ticker link names the
          card, and its keyboard ring (2px outline at a 2px offset, theme.ts) must not be clipped. */}
      <Box
        component="span"
        title={company ?? undefined}
        sx={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          p: '4px',
          m: '-4px',
        }}
      >
        <Link
          component={RouterLink}
          to={href}
          id={`card-${ticker}`}
          underline="hover"
          sx={{ ...MONO, fontWeight: 600, fontSize: 16, color: 'text.primary' }}
        >
          {ticker}
        </Link>
        {company && (
          <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
            {' '}
            {company}
          </Box>
        )}
      </Box>
      <Box sx={{ flexShrink: 0 }}>{chip}</Box>
    </Box>
  );
}

/** When a catalyst falls, from the reader's today: "open now", "today", "tomorrow", "in 6 days". */
const relativeDay = (u: Upcoming, weeks = false) =>
  u.start < u.at
    ? 'open now'
    : u.inDays <= 0
      ? 'today'
      : u.inDays === 1
        ? 'tomorrow'
        : weeks && u.inDays >= 14
          ? `~${Math.round(u.inDays / 7)} weeks`
          : `in ${u.inDays} days`;

/** A catalyst's when-label without the year when it falls in the year it is read in: "Oct 27–30". */
const shortWhen = (u: Upcoming) =>
  u.whenLabel.replace(/, (\d{4})\b/, (m, y: string) => (y === u.at.slice(0, 4) ? '' : m));

/** The card's one meta line: uncertainty, then the next catalyst with its date and how far off. */
function CardMeta({ uncertainty, next }: { uncertainty: string | null; next: Upcoming | null }) {
  if (!uncertainty && !next) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 12px',
        fontSize: 12,
        color: 'text.secondary',
      }}
    >
      {uncertainty && <span>Uncertainty · {uncertainty}</span>}
      {next && <span>{`Next · ${next.label} · ${shortWhen(next)} · ${relativeDay(next)}`}</span>}
    </Box>
  );
}

/** The card's ruled footer: freshness, then the rest, then the link at the right edge. */
function CardFoot({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px 12px',
        pt: 1.25,
        mt: 'auto',
        borderTop: `1px solid ${t.palette.divider}`,
        fontSize: 12,
        color: 'text.secondary',
      })}
    >
      {children}
      <Link
        component={RouterLink}
        to={href}
        underline="hover"
        sx={{ fontWeight: 500, fontSize: 13 }}
      >
        Open note →
      </Link>
    </Box>
  );
}

/** A sample note's card: the same card as production's, dashed with the hatch stripe (canon P-3). */
function SampleNoteCard({ card }: { card: SampleCard }) {
  const href = `/ticker/${encodeURIComponent(card.ticker)}/research`;
  const aging = SAMPLE_AGING.find((s) => s.ticker === card.ticker)?.aging;
  const next = aging ? (upcoming(aging.events, DEMO_CALENDAR_TODAY, 3650)[0] ?? null) : null;
  return (
    <Box
      component="article"
      aria-labelledby={`card-${card.ticker}`}
      sx={(t) => ({
        ...CARD_SX(t),
        position: 'relative',
        border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
        boxShadow: 'none',
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
      })}
    >
      {/* Clear of the hatch band (design: demoCard `.t` margin-top 4px). */}
      <Box sx={{ mt: 0.5 }}>
        <CardHead
          ticker={card.ticker}
          href={href}
          company={SAMPLE_NAMES[card.ticker] ?? null}
          chip={<DataStateTag state="sample" word="Sample note" />}
        />
      </Box>
      <Box component="h2" sx={CARD_TITLE_SX}>
        {card.title}
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        {card.thesis}
      </Box>
      {card.chart && <MiniChart chart={card.chart} />}
      <CardMeta uncertainty={null} next={next} />
      <CardFoot href={href}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <StateDot state={SAMPLE_FRESHNESS} />
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Current
          </Box>
          <span>· scenario of Oct 7</span>
        </Box>
      </CardFoot>
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
  // The caption names the bar styles it uses, so a dashed guide or a hatched approximation never
  // reads as a reported figure (Notes spec acceptance: "dashed = guide or consensus").
  const keys = [
    chart.bars.some((b) => b.kind === 'guide') && 'dashed = guide or consensus',
    chart.bars.some((b) => b.kind === 'approx') && 'hatched = approximate',
  ].filter(Boolean);
  const caption = [chart.caption, ...keys].join(' · ');
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
          {caption}
        </Box>
        {last && (
          <Box component="span" sx={{ ...MONO, color: 'text.primary', whiteSpace: 'nowrap' }}>
            {last.shown || last.value.toLocaleString('en-US')}
          </Box>
        )}
      </Box>
      <Box
        role="img"
        aria-label={`${caption}: ${chart.bars.map((b) => `${b.label} ${b.shown || b.value}`).join(', ')}`}
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
    <Box component="article" aria-labelledby={`card-${row.ticker}`} sx={CARD_SX}>
      <CardHead
        ticker={row.ticker}
        href={href}
        company={n.company ?? n.about?.split('·')[0]?.trim() ?? null}
        chip={
          n.stance ? (
            <Pill variant="strong">{STANCE_LABEL[n.stance]}</Pill>
          ) : (
            <YourCall label="Stance · your call" />
          )
        }
      />
      <Box component="h2" sx={CARD_TITLE_SX}>
        {n.title}
      </Box>
      {n.chart && <MiniChart chart={n.chart} />}
      <CardMeta uncertainty={n.uncertainty ? UNCERTAINTY_LABEL[n.uncertainty] : null} next={next} />
      <CardFoot href={href}>
        <FreshnessLine freshness={row.f} notFollowingSince={n.notFollowingSince} />
        <span>Written {formatShortDate(n.date)}</span>
      </CardFoot>
    </Box>
  );
}

/**
 * Coming up on /research: the next six catalysts across notes, each the day its note comes due for
 * review. Production lists the notes' own catalysts and the calendar's triggers; staging lists the
 * sample notes' review triggers from the scenario's calendar (owner ruling 7, the Calendar board).
 * One panel with a ruled list (design: research.mjs indexBody `coming`, `.drows`; fidelity audit
 * 2026-10-25, R-06): date, what, and how far off. On staging the panel is dashed with the hatch
 * stripe and says Sample once, in its head (canon P-3, P-8; owner decision D1, spec 01 step 5).
 * Production's lead is the board's, naming the calendar too (two lines on a phone, one from a
 * tablet up); what it used to spell out sits on the rows themselves:
 * the FOMC row names every valued note, the estimate row says it is estimated from filing history,
 * and a catalyst the note gives as expected says "expected" beside its window.
 */
function ComingUpList({ items, demo = false }: { items: ComingUpItem[]; demo?: boolean }) {
  if (items.length === 0) return null;
  return (
    <Box
      component="section"
      aria-labelledby="coming-up"
      sx={(t) => ({
        ...PANEL_SX,
        // 16px on a phone, as the board's panels below 768px (`.hd-p { padding: 16px }`).
        p: { xs: '16px', tablet: '18px 20px' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minWidth: 0,
        // Sample data: dashed, with the hatch band the alerts Panel and ChartFrame draw.
        ...(demo && {
          position: 'relative',
          border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
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
        }),
      })}
    >
      {/* The tag stays at the right of the title (the board's `.ph`): on a phone the title wraps
          beside it rather than the tag dropping to a line of its own; only below ~120px of room for
          the title does the tag go under it. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 10px' }}>
        <Box
          component="h2"
          id="coming-up"
          sx={{
            m: 0,
            flex: '1 1 120px',
            minWidth: 0,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {/* Wrapped beside the tag, it breaks after "Coming up ·", never inside "next 10 weeks". */}
          Coming up ·{' '}
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            next 10 weeks
          </Box>
        </Box>
        <Box sx={{ flex: 'none', display: 'flex' }}>
          {demo ? (
            <DataStateTag state="sample" />
          ) : (
            <DataStateTag state="computed" detail="from every note" />
          )}
        </Box>
      </Box>
      <Box
        component="p"
        sx={{ m: 0, fontSize: 12, lineHeight: 1.45, color: 'text.secondary', textWrap: 'pretty' }}
      >
        {demo
          ? 'Each note’s results date, the FOMC decision for every note, and results windows estimated from filing history. Each date is when its note comes due for review. As of Oct 7, 2026.'
          : 'Catalysts from every note and the calendar. Each date is also when its note comes due for review.'}
      </Box>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
        {items.map((u, i) => {
          const day = formatShortDate(u.at);
          // What the when-label says beyond the date column: a window's span ("Oct 27–30"), or the
          // FOMC row's "every valued note". A single day is the date column's already.
          const short = shortWhen(u);
          const when =
            short === day
              ? ''
              : short.startsWith(`${day} · `)
                ? short.slice(day.length + 3)
                : short;
          return (
            <Box
              component="li"
              key={`${u.ticker}-${u.label}-${u.date}`}
              sx={(t) => ({
                display: 'grid',
                gridTemplateColumns: '64px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                borderTop: `1px solid ${t.palette.divider}`,
                fontSize: 13,
                lineHeight: 1.5,
              })}
            >
              <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
                {day}
              </Box>
              <Box component="span" sx={{ minWidth: 0, textWrap: 'pretty' }}>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {`${u.ticker} · ${u.label}`}
                </Box>
                {when && (
                  <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {` · ${u.expected ? 'expected ' : ''}${when}`}
                  </Box>
                )}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  color: i === 0 ? 'text.primary' : 'text.secondary',
                }}
              >
                {relativeDay(u, true)}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

const FILTER_SX =
  (on: boolean, dashed = false) =>
  (t: Theme) => ({
    // 44 px touch targets on a phone (the board's `.fr-bar .pill`).
    height: { xs: 44, sm: 36 },
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

/** The shell's demo bar is this page's one "Demo · sample data", so its frames don't repeat it
 *  (FrameDemoTagProvider; owner decision D1, spec 01 step 5). No effect on the live build. */
export function ResearchIndexPage() {
  return (
    <FrameDemoTagProvider value={false}>
      <ResearchIndexBody />
    </FrameDemoTagProvider>
  );
}

function ResearchIndexBody() {
  const today = useMemo(() => localToday(), []);
  const [query, setQuery] = useState('');
  const [stance, setStance] = useState<StanceFilter>('all');
  const [fresh, setFresh] = useState<FreshFilter>('any');
  // Filings since each note make it due too; without them (API off or down) dates alone decide,
  // and the page says so.
  const filingsRead = usePublicFilings(TICKERS, !DEMO);
  const filings = filingsRead.data?.state === 'live' ? filingsRead.data.filings : null;
  // The calendar's review triggers: FOMC decisions for valued notes (the Fed's table, FOMC_DAYS),
  // estimated results windows (from the filings answer this page already reads).
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
      (!query ||
        `${c.ticker} ${SAMPLE_NAMES[c.ticker] ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())) &&
      (fresh === 'any' || fresh === SAMPLE_FRESHNESS),
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
            fomc: FOMC_DAYS,
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
    [today, filings, windows],
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
  const soon = comingUp(live, today, 'every valued note');
  const sampleSoon = DEMO ? comingUp(SAMPLE_AGING, DEMO_CALENDAR_TODAY, 'every note') : [];
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
    <>
      <ResearchTabs />
      <ResearchColumn>
        <Box sx={PAGE_BODY_SX}>
          <PageHead
            title="Research"
            lead={
              DEMO
                ? 'Research notes on the tickers Convexa follows. Each opens with its thesis, the evidence and what would change it.'
                : 'Notes on the tickers being followed: what the price implies, the evidence, the debate, a valuation with its assumptions shown, and what comes next. Each opens with a 30-second summary.'
            }
            // Production names where the cards come from: the notes in the build (design: indexBody
            // head chip; fidelity audit R-10). On the demo the bar says it (owner decision D1).
            chips={
              !DEMO && NEWEST_NOTE ? (
                <ProvenanceChip
                  text={`Research notes · written through ${formatNoteDate(NEWEST_NOTE)}`}
                  kind="primary"
                />
              ) : undefined
            }
          />

          {(DEMO || rows.length > 0) && (
            // The board's filter bar (design research.mjs indexBody): the search, then the chips, on
            // one wrapping row. Staging filters its sample notes by freshness; production by stance
            // and freshness, each chip with its count.
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Box
                role="group"
                aria-label="Filter notes"
                sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 10px' }}
              >
                <Box sx={{ flex: '1 1 260px', maxWidth: { sm: 340 }, minWidth: 0 }}>
                  <Box component="label" htmlFor="research-find" sx={visuallyHidden}>
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
                {DEMO ? (
                  <Box
                    role="group"
                    aria-label="Filter by freshness"
                    sx={{
                      display: 'inline-flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      aria-pressed={fresh === 'any'}
                      onClick={() => setFresh('any')}
                      sx={FILTER_SX(fresh === 'any')}
                    >
                      All · {samples?.length ?? 0}
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      aria-pressed={fresh === SAMPLE_FRESHNESS}
                      onClick={() =>
                        setFresh(fresh === SAMPLE_FRESHNESS ? 'any' : SAMPLE_FRESHNESS)
                      }
                      sx={FILTER_SX(fresh === SAMPLE_FRESHNESS)}
                    >
                      Current · {samples?.length ?? 0}
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Box
                      role="group"
                      aria-label="Filter by stance"
                      sx={{
                        display: 'inline-flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 0.75,
                      }}
                    >
                      <Box
                        component="span"
                        aria-hidden
                        sx={{ fontSize: 12, color: 'text.secondary' }}
                      >
                        Stance
                      </Box>
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
                      sx={{
                        display: 'inline-flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 0.75,
                      }}
                    >
                      <Box
                        component="span"
                        aria-hidden
                        sx={{ fontSize: 12, color: 'text.secondary' }}
                      >
                        Freshness
                      </Box>
                      {freshStates
                        // A state no note is in has no chip (the board's), unless it is the one chosen.
                        .filter((s) => fresh === s || count((r) => r.f.state === s) > 0)
                        .map((s) => (
                          <Box
                            component="button"
                            type="button"
                            key={s}
                            aria-pressed={fresh === s}
                            onClick={() => setFresh(fresh === s ? 'any' : s)}
                            sx={FILTER_SX(fresh === s)}
                          >
                            {s === 'current' ? 'Current' : s === 'due' ? 'Review due' : 'Archived'}{' '}
                            · {count((r) => r.f.state === s)}
                          </Box>
                        ))}
                    </Box>
                  </>
                )}
              </Box>
              {!DEMO && filingsFallback && <FilingsFallback state={filingsFallback} />}
            </Box>
          )}

          {DEMO ? (
            <>
              <ComingUpList items={sampleSoon} demo />
              <Box
                component="section"
                aria-label="Sample notes"
                aria-busy={samples === undefined}
                sx={{
                  display: 'grid',
                  // Three cards a row from 1100px, two from 900px, one below (design: `.fr-cards`).
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'repeat(2, minmax(0, 1fr))',
                    laptop: 'repeat(3, minmax(0, 1fr))',
                  },
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
              <ComingUpList items={soon} />

              <Box
                component="section"
                aria-label="Tickers"
                sx={{
                  display: 'grid',
                  // Three cards a row from 1100px, two from 900px, one below (design: `.fr-cards`).
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'repeat(2, minmax(0, 1fr))',
                    laptop: 'repeat(3, minmax(0, 1fr))',
                  },
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
              ? 'Sample notes written for the demo; no news, filings or AI read is cited. Not investment advice.'
              : RESEARCH_DISCLAIMER}
          </Box>
        </Box>
      </ResearchColumn>
    </>
  );
}

export default ResearchIndexPage;
