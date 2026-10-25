/**
 * The ticker desk on a live build while the options feed is off (canon P-1; owner ruling 2026-10-14:
 * production mocks nothing). What works without the feed is live: TradingView's daily chart, the
 * research note, FINRA short interest and short-sale volume, SEC filings and insider trades. The
 * twelve panels that read the options chain or the intraday tape each show Not live: what they would
 * show, why they're off, and the same desk on the demo. An "On this page" legend counts the states.
 *
 * This page never calls the endpoints that need the feed (the ticker bundle, the stream, the AI read,
 * the scan): app.tsx mounts it instead of TickerDashboard, so those hooks never run.
 *
 * Design: design/src/screens/final/ticker-desk.mjs (Final · Convexa v1, "Ticker desk" row).
 */
import {
  CardHead,
  finraShown,
  InsidersCard,
  Missing,
  ShortInterestCard,
  ShortVolumeCard,
} from '@/pages/research/NotePublicPanels';
import { filedSince } from '@/pages/research/filings';
import { formatNoteDate, formatShortDate } from '@/pages/research/format';
import { usePublicTicker } from '@/pages/research/publicData';
import { Caps, SourceProblem } from '@/pages/research/publicUi';
import { notSecFiler, tickerSecStale } from '@/pages/research/secState';
import { DISPLAY, FreshnessLine, MONO, PANEL_SX } from '@/pages/research/ui';
import { TickerTabs } from '@/pages/ticker/TickerTabs';
import { recordVisit } from '@/pages/ticker/recentTickers/store';
import { TradingViewDaily } from '@/pages/ticker/technical-analysis/TradingViewDaily';
import { QuickSymbols } from '@/pages/ticker/widgets/chrome/QuickSymbols';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { FINRA_OFF_REASON } from '@/shared/dataState/finraSwitch';
import {
  DATA_STATES,
  publicDataWord,
  publicPartGap,
  type DataStateKey,
} from '@/shared/dataState/vocabulary';
import { demoDeskUrl } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import type { PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { freshness, localToday, researchIndex } from 'virtual:convexa-research';
import { AiReadNotLive, WhatAReadSendsLink } from './AiReadNotLive';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

/** `not_live`: no feed exists on this site. `paused`: an operator paused one. */
export type FeedOff = 'not_live' | 'paused';

export function PublicDesk({ feed }: { feed: FeedOff }) {
  const { ticker: param = 'SPY' } = useParams();
  const ticker = param.toUpperCase();
  const navigate = useNavigate();
  useEffect(() => {
    recordVisit(ticker);
  }, [ticker]);
  const read = usePublicTicker(ticker);
  const note = researchIndex.find((r) => r.ticker === ticker) ?? null;
  const demoUrl = demoDeskUrl(ticker);
  const zonesRef = useRef<HTMLDivElement>(null);
  const counts = useStateCounts(zonesRef);
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const path = `/ticker/${encodeURIComponent(ticker)}`;

  return (
    <Box sx={{ ...pageColumnSx, py: 3, display: 'grid', gap: 3 }}>
      <Box component="header" sx={{ display: 'grid', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'grid', gap: 0.75, minWidth: 0, maxWidth: 640 }}>
            <Box
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px' }}
            >
              <Box
                component="h1"
                sx={{
                  ...DISPLAY,
                  m: 0,
                  fontWeight: 700,
                  // The Final board's desk h1 (`.tk-mast .who h1`): 36 at 1440, 30 on a phone
                  // (fidelity DESK-11; it was 44/36).
                  fontSize: 'clamp(30px, 2.8vw, 36px)',
                  lineHeight: 1,
                }}
              >
                {ticker}
              </Box>
              {note?.latest.company && (
                <Box component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>
                  {note.latest.company}
                </Box>
              )}
            </Box>
            <Box
              component="p"
              sx={{ m: 0, fontSize: 14, color: 'text.secondary', textWrap: 'pretty' }}
            >
              Convexa shows no price of its own on this site: the daily chart below is
              TradingView’s, with US prices delayed. Panels that need the options feed say what they
              would show.
            </Box>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              justifyItems: { xs: 'stretch', sm: 'end' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {/* The same tab control as the demo desk and the other two tabs (one control, one size). */}
            <TickerTabs ticker={ticker} current="overview" />
            {note && (
              <Button
                component={RouterLink}
                to={`${path}/research`}
                variant="contained"
                color="primary"
                sx={{ minHeight: 44 }}
              >
                Read the {ticker} note
              </Button>
            )}
          </Box>
        </Box>
        <QuickSymbols
          currentSymbol={ticker}
          onSelect={(s) => navigate(`/ticker/${encodeURIComponent(s)}`)}
        />
      </Box>

      <Legend counts={counts} demoUrl={demoUrl} />

      <Box ref={zonesRef} sx={{ display: 'grid', gap: 5 }}>
        <PublicZone ticker={ticker} read={read} note={note} />
        <FeedZone ticker={ticker} feed={feed} demoUrl={demoUrl} phone={phone} />
      </Box>

      <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
        Research and tools, not investment advice.
      </Box>
    </Box>
  );
}

// ---- The legend: counted from the tags the panels actually show ----------------------------------

/** Counts every data-state tag inside `ref`, and recounts when the panels change (a read lands, a
 *  source turns out to be down). The legend therefore can't disagree with the page. */
function useStateCounts(ref: React.RefObject<HTMLElement | null>) {
  const [counts, setCounts] = useState<[DataStateKey, number][]>([]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recount = () => {
      const tally = new Map<DataStateKey, number>();
      el.querySelectorAll<HTMLElement>('[data-state]').forEach((n) => {
        const k = n.dataset.state as DataStateKey;
        if (k in DATA_STATES) tally.set(k, (tally.get(k) ?? 0) + 1);
      });
      const order = Object.keys(DATA_STATES) as DataStateKey[];
      setCounts(order.filter((k) => tally.has(k)).map((k) => [k, tally.get(k) as number]));
    };
    recount();
    const mo = new MutationObserver(recount);
    mo.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
    return () => mo.disconnect();
  }, [ref]);
  return counts;
}

function Legend({ counts, demoUrl }: { counts: [DataStateKey, number][]; demoUrl: string }) {
  return (
    <Box
      component="section"
      aria-label="On this page"
      sx={{
        ...PANEL_SX,
        px: 2,
        py: 1.25,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 16px',
      }}
    >
      <Caps>On this page</Caps>
      <Box
        component="ul"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}
      >
        {counts.map(([k, n]) => (
          <Box
            component="li"
            key={k}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
          >
            {/* The legend sits outside the counted zones, so its own tags aren't counted. */}
            <DataStateTag state={k} />
            <Box
              component="span"
              sx={{ ...MONO, fontSize: 13 }}
              aria-label={`${n} ${DATA_STATES[k].word}`}
            >
              {n}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <Link href={demoUrl} variant="body2" underline="always" sx={{ ...linkSx, fontSize: 13 }}>
        See the whole desk on the demo →
      </Link>
    </Box>
  );
}

// ---- Live from public data -----------------------------------------------------------------------

function ZoneHead({ id, title, sub }: { id: string; title: string; sub: string }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px' }}>
      <Box
        component="h2"
        id={id}
        // The board's `.tk-zone h2`: 22/700, 20 on a phone (fidelity DESK-11; it was 26/600).
        sx={{ ...DISPLAY, m: 0, fontWeight: 700, fontSize: { xs: 20, sm: 22 } }}
      >
        {title}
      </Box>
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        {sub}
      </Box>
    </Box>
  );
}

type Note = (typeof researchIndex)[number];

function PublicZone({
  ticker,
  read,
  note,
}: {
  ticker: string;
  read: ReturnType<typeof usePublicTicker>;
  note: Note | null;
}) {
  const d = read.data;
  const cards: ReactNode = (() => {
    if (read.loading && !d) return <CardsLoading ticker={ticker} />;
    if (read.error || !d)
      return (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Box sx={{ justifySelf: 'start' }}>
            <DataStateTag state="couldntLoad" />
          </Box>
          <SourceProblem
            title="Short data and filings didn't load."
            body="Convexa's server didn't answer. TradingView's chart and the research note don't depend on it."
            onRetry={read.retry}
          />
        </Box>
      );
    if (d.state === 'off')
      return (
        <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary' }}>
          Public data (short interest, short-sale volume, filings) is switched off on this site.{' '}
          <DataStateTag state="off" />
        </Box>
      );
    return null;
  })();

  // Lane 4: when FINRA is Off for both of its parts (the owner's switch, finraSwitch.ts), its two
  // cards no longer take the side column beside the chart and a 3fr row to say the same sentence:
  // the live SEC panels move up beside the chart, and FINRA folds into one Off card after them, with
  // the owner's reason. With FINRA on, the cards render as before.
  const finraOff = !!d && !read.error && d.state !== 'off' && finraFolded(d);
  const theme = useTheme();
  const twoColumns = useMediaQuery(theme.breakpoints.up('md'));
  const chartRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const chartHeight = useLevelChartHeight(chartRef, sideRef, twoColumns, CHART_MIN_HEIGHT);
  return (
    <Box component="section" aria-labelledby="public-zone" sx={{ display: 'grid', gap: 2 }}>
      <ZoneHead
        id="public-zone"
        title="Live from public data"
        sub="Each panel names its source and how late that source reports."
      />
      {/* The board's `.tk-hero` row: the chart beside the side column, stretched, and the chart
          as tall as the side column so both end level (fidelity DESK-19; a fixed 520 ended 91px
          short of the side). The side's cards keep their own heights (`alignContent: start`). */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
          alignItems: 'stretch',
        }}
      >
        <Box ref={chartRef} sx={{ minWidth: 0 }}>
          <TradingViewDaily ticker={ticker} height={chartHeight} phoneHeight={420} />
        </Box>
        <Box ref={sideRef} sx={{ display: 'grid', gap: 2, minWidth: 0, alignContent: 'start' }}>
          <NoteCard ticker={ticker} note={note} d={d} />
          {d && finraOff && (
            <>
              <FilingsCard d={d} />
              <InsidersCard d={d} />
            </>
          )}
          {d && d.state !== 'off' && !read.error && !finraOff && <ShortVolumeCard d={d} />}
        </Box>
      </Box>
      {finraOff && <FinraOffCard />}
      {!finraOff &&
        (cards ??
          (d && (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'minmax(0, 3fr) minmax(0, 2fr)',
                  },
                  alignItems: 'start',
                }}
              >
                <ShortInterestCard d={d} compact />
                <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <FilingsCard d={d} />
                  <InsidersCard d={d} />
                </Box>
              </Box>
              {finraShown(d) && (
                <Box
                  component="p"
                  sx={{
                    m: 0,
                    fontSize: 12,
                    color: 'text.secondary',
                    maxWidth: 720,
                    textWrap: 'pretty',
                  }}
                >
                  FINRA owns and is the source of the short-interest and short-sale-volume data
                  here, including the percentages and averages Convexa calculates from it. Shown
                  free for non-commercial personal use; please don&apos;t redistribute it.
                </Box>
              )}
            </>
          )))}
      {finraOff && cards}
    </Box>
  );
}

/** The TradingView frame's floor beside the side column, and its height when the row is one column. */
const CHART_MIN_HEIGHT = 520;

/**
 * The TradingView frame's height that ends the chart level with the side column: the side column's
 * content height less the chart section's own chrome (its head, caption, gaps and the fence's
 * padding), never under `min`. The chrome is the chart section's height less the frame's, read from
 * `TradingViewDaily`'s markup (a section holding the head row, then the fenced frame), so it doesn't
 * depend on the frame's height: a blocked chart (an alert in the frame's place) can't feed back
 * into the target. The side column is measured to its last card, not its box, because the row
 * stretches the box to the chart. One column (below `md`): `min`, and TradingViewDaily's own phone
 * height below `sm`.
 */
function useLevelChartHeight(
  chartRef: React.RefObject<HTMLDivElement | null>,
  sideRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  min: number,
): number {
  const [height, setHeight] = useState(min);
  useEffect(() => {
    const chart = chartRef.current;
    const side = sideRef.current;
    if (!enabled || !chart || !side || typeof ResizeObserver === 'undefined') {
      setHeight(min);
      return;
    }
    const measure = () => {
      const section = chart.firstElementChild;
      const frame = section?.children[1]?.firstElementChild;
      const last = side.lastElementChild;
      if (!section || !frame || !last) return;
      const chrome = section.getBoundingClientRect().height - frame.getBoundingClientRect().height;
      const sideContent = last.getBoundingClientRect().bottom - side.getBoundingClientRect().top;
      setHeight(Math.max(min, Math.round(sideContent - chrome)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(side);
    ro.observe(chart);
    Array.from(side.children).forEach((c) => ro.observe(c));
    // A card that mounts later (the filings once the public read lands) changes the side's children.
    const mo = new MutationObserver(() => {
      Array.from(side.children).forEach((c) => ro.observe(c));
      measure();
    });
    mo.observe(side, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [chartRef, sideRef, enabled, min]);
  return height;
}

/** Both FINRA parts read Off (the owner's switch): nothing of FINRA's to show, one reason to give. */
function finraFolded(d: PublicTicker): boolean {
  return (
    publicPartGap(d.short_interest_state, !!d.short_interest) === 'off' &&
    publicPartGap(d.short_volume_state, !!d.short_volume) === 'off'
  );
}

/** FINRA's two panels, folded into one Off card with the owner's reason (finraSwitch.ts). */
function FinraOffCard() {
  return (
    <Missing
      label="Short interest · Short-sale volume"
      tag={<DataStateTag state="off" />}
      text={FINRA_OFF_REASON}
    />
  );
}

function CardsLoading({ ticker }: { ticker: string }) {
  return (
    <Box
      aria-busy="true"
      aria-label={`Loading ${ticker} short data and filings`}
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box key={i} sx={{ ...PANEL_SX, height: 180, opacity: 0.5 }} />
      ))}
    </Box>
  );
}

/** The latest research note: its title, freshness and a link. Freshness counts filings the note
 *  hasn't read when the public read has them; dates alone decide otherwise. */
function NoteCard({
  ticker,
  note,
  d,
}: {
  ticker: string;
  note: Note | null;
  d: PublicTicker | null;
}) {
  const today = useMemo(() => localToday(), []);
  if (!note)
    return (
      <Missing
        label="Research note"
        text={`No research note for ${ticker} yet. The research index lists every ticker with one.`}
      />
    );
  const n = note.latest;
  const f = freshness(n.aging, {
    today,
    notFollowingSince: n.notFollowingSince,
    filed: d ? filedSince(d.filings, n) : [],
  });
  const path = `/ticker/${encodeURIComponent(ticker)}/research`;
  return (
    <Box
      component="article"
      sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1.25, alignContent: 'start' }}
    >
      {/* The same card head as the filings and insider cards beside it, so the side column's
          titles share one style (the boards' `.ph h3`, fidelity DESK-22, comes with CardHead). */}
      <CardHead
        label="Research note"
        tag={
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            <FreshnessLine freshness={f} notFollowingSince={n.notFollowingSince} />
          </Box>
        }
      />
      <Box
        component="h3"
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
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        {`Written ${formatNoteDate(n.date)}${n.aging.priceAsOf ? ` · price as of ${formatShortDate(n.aging.priceAsOf)}` : ''}`}
      </Box>
      <Link
        component={RouterLink}
        to={path}
        variant="body2"
        underline="always"
        sx={{ ...linkSx, justifySelf: 'start' }}
      >
        Open the note →
      </Link>
    </Box>
  );
}

/** Filings from SEC EDGAR, newest first. Unknown reads as unknown, never as an empty list. */
function FilingsCard({ d }: { d: PublicTicker }) {
  if (d.filings_state === 'not_configured')
    return (
      <Missing
        label="Recent filings"
        tag={<DataStateTag state="notSetUp" />}
        text="SEC filings aren't set up on this site yet: EDGAR asks every program that reads it for a contact address."
      />
    );
  if (d.filings_state === 'unavailable' && d.filings.length === 0)
    return (
      <Missing
        label="Recent filings"
        tag={<DataStateTag state="sourceDown" />}
        text={`${d.filings_detail ?? 'EDGAR did not answer.'} This list is unknown, not empty.`}
      />
    );
  // EDGAR lists no company under the symbol (VIX, SPX, a fresh IPO): a fact, not a stale copy.
  if (notSecFiler(d))
    return (
      <Missing
        label="Recent filings"
        text={`Not an SEC filer: ${d.filings_detail ?? `SEC EDGAR lists no company under ${d.ticker}.`}`}
      />
    );
  const latest = d.filings[0];
  // Last good copy only on EDGAR's own word for this answer, never on the mere presence of a detail.
  const stale = d.filings_state === 'live' && tickerSecStale(d);
  const tag = (
    <DataStateTag
      state={publicDataWord(d.filings_state, { stale })}
      detail={latest && !stale ? `latest ${formatShortDate(latest.filed)}` : null}
    />
  );
  if (d.filings.length === 0)
    return <Missing label="Recent filings" tag={tag} text="No filings in the last 90 days." />;
  return (
    <Box
      component="article"
      sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1, alignContent: 'start' }}
    >
      <CardHead label="Recent filings" tag={tag} />
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
        {d.filings.slice(0, 4).map((f) => (
          <Box
            component="li"
            key={f.accession}
            sx={(t) => ({
              display: 'grid',
              gridTemplateColumns: '56px minmax(0, 1fr) auto',
              gap: 1.25,
              alignItems: 'center',
              py: 1,
              borderTop: `1px solid ${t.palette.divider}`,
              fontSize: 13,
            })}
          >
            <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
              {formatShortDate(f.filed)}
            </Box>
            <Box
              component="span"
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <Box component="span" sx={{ ...MONO, fontSize: 11, color: 'text.secondary', mr: 1 }}>
                {f.form}
              </Box>
              {f.description || f.form}
            </Box>
            <Link
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              underline="always"
              sx={{ ...linkSx, fontSize: 12 }}
            >
              Open
            </Link>
          </Box>
        ))}
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
        SEC EDGAR · checked every hour
      </Box>
    </Box>
  );
}

// ---- Needs the options feed ----------------------------------------------------------------------

type FeedPanel = {
  key: string;
  title: (t: string) => string;
  would: string;
  levels?: boolean;
  /** Where the panel sits on a wide screen: beside the field, or in the context rows. The AI read
   *  has its own row between them. */
  group: 'structure' | 'ai' | 'context';
};

/** The desk's panels that read the options chain or the intraday tape, in the desk's reading order. */
const FEED_PANELS: FeedPanel[] = [
  {
    key: 'gamma',
    group: 'structure',
    title: (t) => `${t} net dealer gamma by strike`,
    would:
      'net dealer gamma at each strike, with +γ above the zero line and −γ below, the walls, the gamma flip and max pain.',
  },
  {
    key: 'levels',
    group: 'structure',
    title: () => 'Levels',
    would: 'the call wall, max pain, the gamma flip and the put wall.',
    levels: true,
  },
  {
    key: 'read',
    group: 'context',
    title: () => 'Read strip',
    would:
      'eight figures from the chain: opportunity, net DEX, IV/HV, IV rank, Vol/OI, IV skew, term structure and the off-exchange share.',
  },
  {
    key: 'score',
    group: 'context',
    title: () => 'Score and structure path',
    would:
      'the scanner’s 0–100 score for this ticker, and how it and the distance to the flip moved this session.',
  },
  {
    key: 'ai',
    group: 'ai',
    title: () => 'AI read',
    would:
      'a verdict-first brief on the dealer structure, risk before rationale, on your own provider key.',
  },
  {
    key: 'tape',
    group: 'context',
    title: (t) => `${t} mid · last 5 minutes`,
    would: 'the live mid, one point a second, against the mid the levels use.',
  },
  {
    key: 'flow',
    group: 'context',
    title: () => 'Dealer flow projection',
    would: 'how charm and vanna push dealer hedging into the nearest expiry.',
  },
  {
    key: 'term',
    group: 'context',
    title: () => 'Term structure',
    would: 'implied volatility by days to expiry, and whether it slopes up or down.',
  },
  {
    key: 'straddle',
    group: 'context',
    title: () => 'Straddle-implied move',
    would: 'the move the nearest at-the-money straddle prices in, against the walls.',
  },
  {
    key: 'fresh',
    group: 'context',
    title: () => 'Fresh positioning · Vol/OI',
    would: 'strikes where today’s volume outruns open interest.',
  },
  {
    key: 'blocks',
    group: 'context',
    title: () => 'Off-exchange blocks',
    would: 'large prints away from the exchanges, as they happen.',
  },
  {
    key: 'setups',
    group: 'context',
    title: () => 'Setups',
    would: 'the scanner’s named setups on this ticker.',
  },
];

/**
 * The shape the gamma panel would draw, as an outline with no values (board ticker-desk.mjs
 * `gexBars('outline')`): dashed, neutral, aria-hidden. It shows the form of the chart, never a
 * figure — no axis, no level, no number.
 */
function GammaOutline() {
  const vals = [-6, -10, -14, -8, -3, 4, 9, 15, 11, 6, 3, 1];
  const h = 120;
  const mid = h / 2;
  return (
    <Box
      component="svg"
      aria-hidden="true"
      viewBox={`0 0 240 ${h}`}
      preserveAspectRatio="none"
      sx={(t) => ({ width: '100%', height: h, display: 'block', color: extrasFor(t).lineStrong })}
    >
      <line x1="0" x2="240" y1={mid} y2={mid} stroke="currentColor" />
      {vals.map((v, i) => {
        const bh = (Math.abs(v) * (h / 2 - 6)) / 15;
        return (
          <rect
            key={i}
            x={6 + i * 19.5}
            y={v > 0 ? mid - bh : mid}
            width="13"
            height={bh}
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 3"
          />
        );
      })}
    </Box>
  );
}

/** One Not live panel: its title and tag, what it would show, and the same desk on the demo. */
function FeedPanel({
  p,
  ticker,
  tag,
  demoUrl,
}: {
  p: FeedPanel;
  ticker: string;
  tag: DataStateKey;
  demoUrl: string;
}) {
  return (
    <Box
      component="article"
      aria-labelledby={`feed-${p.key}`}
      sx={{ ...PANEL_SX, p: '16px 18px', display: 'grid', gap: 1, alignContent: 'start' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px 10px',
        }}
      >
        {/* 14/600, the boards' panel title (`.hd-p .ph h3`, fidelity DESK-22). */}
        <Box component="h3" id={`feed-${p.key}`} sx={{ m: 0, fontSize: 14, fontWeight: 600 }}>
          {p.title(ticker)}
        </Box>
        <DataStateTag state={tag} />
      </Box>
      {p.key === 'gamma' && <GammaOutline />}
      {p.levels ? (
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: '6px 12px',
            fontSize: 13,
          }}
        >
          {['Call wall', 'Max pain', 'Gamma flip', 'Put wall'].map((l) => (
            <Box key={l} sx={{ display: 'contents' }}>
              <Box component="dt" sx={{ color: 'text.secondary' }}>
                {l}
              </Box>
              <Box
                component="dd"
                sx={{ ...MONO, m: 0, color: 'text.secondary' }}
                aria-label="No value"
              >
                —
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}
      <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Would show
        </Box>{' '}
        {p.would}
      </Box>
      {p.levels && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
          No level is shown as a number: a dash is not a price.
        </Box>
      )}
      <Link
        href={demoUrl}
        variant="body2"
        underline="always"
        sx={{ ...linkSx, justifySelf: 'start', mt: 0.5 }}
      >
        See it on the demo →
      </Link>
    </Box>
  );
}

/** Why the zone is off, said once at its head. */
function feedCause(feed: FeedOff): string {
  return feed === 'paused'
    ? 'these panels read the options chain or the intraday tape, and that feed is paused on this site.'
    : 'these panels read the options chain or the intraday tape, a paid feed this site doesn’t run.';
}

function FeedZone({
  ticker,
  feed,
  demoUrl,
  phone,
}: {
  ticker: string;
  feed: FeedOff;
  demoUrl: string;
  phone: boolean;
}) {
  const tag: DataStateKey = feed === 'paused' ? 'paused' : 'notLive';
  return (
    <Box component="section" aria-labelledby="feed-zone" sx={{ display: 'grid', gap: 2 }}>
      <ZoneHead
        id="feed-zone"
        title="Needs the options feed"
        sub={`Off because ${feedCause(feed)} Each panel says what it would show; the demo shows all of them on sample data.`}
      />
      {phone ? (
        <Box component="article" sx={{ ...PANEL_SX, p: '16px 18px', display: 'grid', gap: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Box component="h3" sx={{ m: 0, fontSize: 14, fontWeight: 600 }}>
              {`${FEED_PANELS.length} panels need the options feed`}
            </Box>
          </Box>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {FEED_PANELS.map((p) => (
              <Box
                component="li"
                key={p.key}
                sx={(t) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  minHeight: 44,
                  borderTop: `1px solid ${t.palette.divider}`,
                  fontSize: 14,
                })}
              >
                <span>{p.title(ticker)}</span>
                <DataStateTag state={tag} />
              </Box>
            ))}
          </Box>
          <Link
            href={demoUrl}
            variant="body2"
            underline="always"
            sx={{ ...linkSx, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          >
            See them on the demo →
          </Link>
          <WhatAReadSendsLink ticker={ticker} feed={feed} />
        </Box>
      ) : (
        // Lane 4: grouped by the desk's own read, in full rows: the structure (gamma by strike wide,
        // the levels beside it, as the hero draws them), the AI read across, then the context panels
        // three to a row. The cause sits once in the zone head; the panels no longer repeat it
        // eleven times (the phone list above already states it once).
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
            }}
          >
            {FEED_PANELS.filter((p) => p.group === 'structure').map((p) => (
              <FeedPanel key={p.key} p={p} ticker={ticker} tag={tag} demoUrl={demoUrl} />
            ))}
          </Box>
          <AiReadNotLive ticker={ticker} feed={feed} demoUrl={demoUrl} />
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {FEED_PANELS.filter((p) => p.group === 'context').map((p) => (
              <FeedPanel key={p.key} p={p} ticker={ticker} tag={tag} demoUrl={demoUrl} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
