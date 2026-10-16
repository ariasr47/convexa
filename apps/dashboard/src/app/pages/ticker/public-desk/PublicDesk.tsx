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
import { DISPLAY, FreshnessLine, MONO, PANEL_SX } from '@/pages/research/ui';
import { recordVisit } from '@/pages/ticker/recentTickers/store';
import { TradingViewDaily } from '@/pages/ticker/technical-analysis/TradingViewDaily';
import { QuickSymbols } from '@/pages/ticker/widgets/chrome/QuickSymbols';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { DATA_STATES, publicDataWord, type DataStateKey } from '@/shared/dataState/vocabulary';
import { demoDeskUrl } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import type { PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
    <Container maxWidth="lg" sx={{ py: 3, display: 'grid', gap: 3 }}>
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
                  fontSize: { xs: 36, sm: 44 },
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
            <Tabs
              value="overview"
              aria-label={`${ticker} ticker views`}
              variant={phone ? 'scrollable' : 'standard'}
              scrollButtons={phone ? 'auto' : false}
              sx={{
                minHeight: 44,
                '& .MuiTab-root': { minHeight: 44, minWidth: 96 },
                '& .MuiTab-root.Mui-selected': { color: (t) => extrasFor(t).textAmber },
              }}
            >
              <Tab component={RouterLink} to={path} value="overview" label="Overview" />
              <Tab
                component={RouterLink}
                to={`${path}/technical-analysis`}
                value="technical"
                label="Technical"
              />
              <Tab
                component={RouterLink}
                to={`${path}/research`}
                value="research"
                label="Research"
              />
            </Tabs>
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
    </Container>
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
        sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: { xs: 22, sm: 26 } }}
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

  return (
    <Box component="section" aria-labelledby="public-zone" sx={{ display: 'grid', gap: 2 }}>
      <ZoneHead
        id="public-zone"
        title="Live from public data"
        sub="Each panel names its source and how late that source reports."
      />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <TradingViewDaily ticker={ticker} height={520} phoneHeight={420} />
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <NoteCard ticker={ticker} note={note} d={d} />
          {d && d.state !== 'off' && !read.error && <ShortVolumeCard d={d} />}
        </Box>
      </Box>
      {cards ??
        (d && (
          <>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
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
                FINRA owns and is the source of the short-interest and short-sale-volume data here,
                including the percentages and averages Convexa calculates from it. Shown free for
                non-commercial personal use; please don&apos;t redistribute it.
              </Box>
            )}
          </>
        ))}
    </Box>
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
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px 10px',
        }}
      >
        <Caps>Research note</Caps>
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
          <FreshnessLine freshness={f} notFollowingSince={n.notFollowingSince} />
        </Box>
      </Box>
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
  const latest = d.filings[0];
  const tag = (
    <DataStateTag
      state={publicDataWord(d.filings_state, {
        stale: d.filings_state === 'live' && !!d.filings_detail,
      })}
      detail={latest && !d.filings_detail ? `latest ${formatShortDate(latest.filed)}` : null}
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
};

/** The desk's panels that read the options chain or the intraday tape, in the desk's reading order. */
const FEED_PANELS: FeedPanel[] = [
  {
    key: 'gamma',
    title: (t) => `${t} net dealer gamma by strike`,
    would:
      'net dealer gamma at each strike, with +γ above the zero line and −γ below, the walls, the gamma flip and max pain.',
  },
  {
    key: 'levels',
    title: () => 'Levels',
    would: 'the call wall, max pain, the gamma flip and the put wall.',
    levels: true,
  },
  {
    key: 'read',
    title: () => 'Read strip',
    would:
      'eight figures from the chain: opportunity, net DEX, IV/HV, IV rank, Vol/OI, IV skew, term structure and the off-exchange share.',
  },
  {
    key: 'score',
    title: () => 'Score and structure path',
    would:
      'the scanner’s 0–100 score for this ticker, and how it and the distance to the flip moved this session.',
  },
  {
    key: 'ai',
    title: () => 'AI read',
    would:
      'a verdict-first brief on the dealer structure, risk before rationale, on your own provider key.',
  },
  {
    key: 'tape',
    title: (t) => `${t} mid · last 5 minutes`,
    would: 'the live mid, one point a second, against the mid the levels use.',
  },
  {
    key: 'flow',
    title: () => 'Dealer flow projection',
    would: 'how charm and vanna push dealer hedging into the nearest expiry.',
  },
  {
    key: 'term',
    title: () => 'Term structure',
    would: 'implied volatility by days to expiry, and whether it slopes up or down.',
  },
  {
    key: 'straddle',
    title: () => 'Straddle-implied move',
    would: 'the move the nearest at-the-money straddle prices in, against the walls.',
  },
  {
    key: 'fresh',
    title: () => 'Fresh positioning · Vol/OI',
    would: 'strikes where today’s volume outruns open interest.',
  },
  {
    key: 'blocks',
    title: () => 'Off-exchange blocks',
    would: 'large prints away from the exchanges, as they happen.',
  },
  { key: 'setups', title: () => 'Setups', would: 'the scanner’s named setups on this ticker.' },
];

const OFF_BECAUSE: Record<FeedOff, string> = {
  not_live: 'it needs the options feed, a paid feed this site doesn’t run.',
  paused: 'it needs the options feed, which is paused on this site.',
};

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
        sub="These panels read the options chain or the intraday tape. Each says what it would show; the demo shows all of them on sample data."
      />
      {phone ? (
        <Box component="article" sx={{ ...PANEL_SX, p: '16px 18px', display: 'grid', gap: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Box component="h3" sx={{ m: 0, fontSize: 15, fontWeight: 600 }}>
              {`${FEED_PANELS.length} panels need the options feed`}
            </Box>
          </Box>
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
            {`Off because ${OFF_BECAUSE[feed]}`}
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
          <WhatAReadSendsLink ticker={ticker} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
            // The AI read spans its row; the panels after it fill the cells before it.
            gridAutoFlow: 'row dense',
          }}
        >
          {FEED_PANELS.map((p) =>
            p.key === 'ai' ? (
              <AiReadNotLive key={p.key} ticker={ticker} feed={feed} demoUrl={demoUrl} />
            ) : (
              <Box
                component="article"
                key={p.key}
                aria-labelledby={`feed-${p.key}`}
                sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1, alignContent: 'start' }}
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
                  <Box
                    component="h3"
                    id={`feed-${p.key}`}
                    sx={{ m: 0, fontSize: 15, fontWeight: 600 }}
                  >
                    {p.title(ticker)}
                  </Box>
                  <DataStateTag state={tag} />
                </Box>
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
                <Box
                  component="p"
                  sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}
                >
                  <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Would show
                  </Box>{' '}
                  {p.would}
                </Box>
                <Box
                  component="p"
                  sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}
                >
                  <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    Off because
                  </Box>{' '}
                  {OFF_BECAUSE[feed]}
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
            ),
          )}
        </Box>
      )}
    </Box>
  );
}
