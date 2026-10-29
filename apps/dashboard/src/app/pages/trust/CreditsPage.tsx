/**
 * `/credits` — every source the site reads in one place: who owns it, what Convexa reads, how often
 * and how late it publishes, the terms it is shown under, a link to it, and whether it is working on
 * this site right now.
 *
 * Only each card's state tag is live; its text is static and renders at once, so a failed state check
 * never blanks the page. The states are the API's own `sources` rows, one per source in the P-2
 * words, carried by the two public-data reads the research pages already make (/markets for
 * Treasury, CFTC, the liquidity inputs and the release schedules; /tickers/SPY for FINRA and SEC).
 * Only the API knows whether the copy it serves came from this cycle's fetch, so only its row can
 * say Last good copy. A server from before the rows existed is still read the old way. The legend
 * counts the same states the cards draw, and says how many are still being checked, on the line
 * their tags fill once the first check lands, which it does all at once. FINRA's two
 * cards say Off with the reason while the owner keeps FINRA off (shared/dataState/finraSwitch.ts).
 * The demo build makes no request: every card is dashed sample data, and TradingView is off. The
 * state decisions live in cardState.ts.
 *
 * Design: design/src/screens/final/trust.mjs (credits row), trust-pages.mjs (creditsArticle).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { publicDataWord } from '@/shared/dataState/vocabulary';
import { isDemoBuild, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { coarseFloor, standaloneLinkSx } from '@/shared/ui/touch';
import type { PublicDataState, PublicSource } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { formatShortDate } from '../research/format';
import { usePublicMarkets, usePublicTicker } from '../research/publicData';
import { ProvenanceChip } from '../research/publicUi';
import {
  DOWN,
  fromRow,
  legendCounts,
  liquidityLine,
  longDate,
  NOT_SET,
  notLiveState,
  schedulesState,
  SEC_NOT_SET,
  switchedOff,
  utcTime,
  type CardState,
} from './cardState';
import { DocPage, DocTable, FinraNotice, H2, Lead, linkSx, Para } from './DocPage';
import { SOURCES, TYPEFACES, type Source, type SourceId } from './sources';

const TOC = [
  ['sources', 'On this page'],
  ...SOURCES.map((s) => [s.id, s.toc] as const),
  ['typefaces', 'Typefaces'],
  ['ours', 'What Convexa makes'],
] as const;

/** Which read carries each card's state. TradingView and Massive have none: their state is fixed. */
const FROM_MARKETS: readonly SourceId[] = [
  'treasury',
  'cftc',
  'fed-h41',
  'treasury-dts',
  'nyfed-rrp',
  'schedules',
];
const FROM_TICKER: readonly SourceId[] = ['finra-si', 'finra-shvol', 'sec'];
/** The API's rows behind the one Release schedules card. */
const SCHEDULE_ROWS = ['fed-fomc', 'bls', 'bea', 'treasury-qr'] as const;

function useLiveStates(enabled: boolean): {
  states: Record<SourceId, CardState>;
  failed: boolean;
  retry: () => void;
} {
  const markets = usePublicMarkets(enabled);
  const spy = usePublicTicker(enabled ? 'SPY' : '');
  const checking: CardState = { tag: 'loading', note: 'Checking this source…' };
  const couldnt: CardState = { tag: 'couldntLoad', note: 'Couldn’t check this source.' };

  // The page's first check lands all at once: until both reads have answered, every card they
  // decide stays Checking. Their answers come tens of milliseconds apart, and the page drawn
  // between them grew the legend by a row and then rearranged it again (site audit 2026-10-25,
  // PERF-04). A retry afterwards checks only the read that failed, as before.
  const inFlight = markets.loading || spy.loading;
  const [firstCheckDone, setFirstCheckDone] = useState(!enabled);
  useEffect(() => {
    if (enabled && !inFlight) setFirstCheckDone(true);
  }, [enabled, inFlight]);
  const holding = !firstCheckDone && inFlight;

  const m = markets.data;
  const t = spy.data;
  // Rows by id. A server from before 2026-10-15 sends none: each card then falls back to working
  // its state out from the answer itself, as this page did before the rows existed.
  const rows = new Map<string, PublicSource>(
    [...(m?.sources ?? []), ...(t?.sources ?? [])].map((row) => [row.id, row]),
  );

  // ---- the fallback for an older server ----------------------------------------------------
  const treasury: CardState = !m
    ? couldnt
    : (notLiveState(m.state, NOT_SET) ??
      (m.rates
        ? {
            tag: 'updated',
            detail: formatShortDate(m.rates.as_of),
            note: `Rates for ${longDate(m.rates.as_of)} · checked ${utcTime(m.rates.fetched_at)} UTC.`,
          }
        : { tag: 'sourceDown', note: DOWN }));
  const cftc: CardState = !m
    ? couldnt
    : (notLiveState(m.state, NOT_SET) ??
      (m.futures
        ? {
            tag: 'delayed',
            detail: `as of ${formatShortDate(m.futures.report_date)}`,
            note: `Positions as of ${longDate(m.futures.report_date)}. The CFTC publishes each week’s positions the Friday after.`,
          }
        : { tag: 'sourceDown', note: DOWN }));
  const liquidity: CardState | null = !m
    ? couldnt
    : (notLiveState(m.state, NOT_SET) ?? (m.liquidity ? null : { tag: 'sourceDown', note: DOWN }));
  const tickerPart = (
    state: PublicDataState | undefined,
    live: () => CardState,
    notConfiguredNote = SEC_NOT_SET,
  ): CardState => (!t || !state ? couldnt : (notLiveState(state, notConfiguredNote) ?? live()));
  const si = t?.short_interest;
  const sv = t?.short_volume;
  const legacy: Record<SourceId, CardState> = {
    treasury,
    cftc,
    'fed-h41': liquidity ?? liquidityLine('fed-h41', m?.liquidity?.as_of ?? ''),
    'treasury-dts': liquidity ?? liquidityLine('treasury-dts', m?.liquidity?.as_of ?? ''),
    'nyfed-rrp': liquidity ?? liquidityLine('nyfed-rrp', m?.liquidity?.as_of ?? ''),
    schedules: {
      tag: 'notSetUp',
      note: 'This site’s server doesn’t read the release schedules yet.',
    },
    'finra-si': tickerPart(t?.short_interest_state, () =>
      si
        ? {
            tag: publicDataWord('live', { delayed: true }),
            detail: `settled ${formatShortDate(si.settlement_date)}`,
            note: `Settlement of ${longDate(si.settlement_date)}. FINRA publishes about a week after each settlement.`,
          }
        : { tag: 'delayed', note: 'FINRA answered; it has no report for the ticker checked.' },
    ),
    'finra-shvol': tickerPart(t?.short_volume_state, () =>
      sv
        ? {
            tag: 'updated',
            detail: `${formatShortDate(sv.date)} file`,
            note: `The file for ${longDate(sv.date)}.`,
          }
        : { tag: 'updated', note: 'FINRA answered; it has no file for the ticker checked.' },
    ),
    sec: tickerPart(t?.filings_state, () => ({
      tag: 'updated',
      note: 'Convexa checks filings every hour and company facts every 24 hours.',
    })),
    tradingview: {
      tag: 'thirdParty',
      note: 'Loads when you open the view. Convexa can’t see whether TradingView is up.',
    },
    massive: {
      tag: 'notLive',
      note: 'Nothing built from the options chain is live on this site. Each of those panels says so and links to the same screen on the demo.',
    },
  };

  const stateOf = (id: SourceId): CardState => {
    const off = switchedOff(id);
    if (off) return off;
    const read = FROM_MARKETS.includes(id) ? markets : FROM_TICKER.includes(id) ? spy : null;
    if (!read) return legacy[id];
    if (holding || read.loading) return checking;
    if (!read.data) return couldnt;
    if (id === 'schedules') {
      const own = SCHEDULE_ROWS.map((r) => rows.get(r)).filter((r): r is PublicSource => !!r);
      return own.length ? schedulesState(own) : legacy.schedules;
    }
    const row = rows.get(id);
    return row ? fromRow(id, row) : legacy[id];
  };

  return {
    states: Object.fromEntries(SOURCES.map((s) => [s.id, stateOf(s.id)])) as Record<
      SourceId,
      CardState
    >,
    failed: !holding && ((!markets.loading && !m) || (!spy.loading && !t)),
    retry: () => {
      if (!m) markets.retry();
      if (!t) spy.retry();
    },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <Box
        component="dt"
        sx={{
          color: 'text.secondary',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          pt: '3px',
        }}
      >
        {label}
      </Box>
      <Box
        component="dd"
        sx={{ m: 0, mb: { xs: 1.25, sm: 0 }, color: 'text.primary', textWrap: 'pretty' }}
      >
        {children}
      </Box>
    </>
  );
}

function SourceCard({ s, state, demo }: { s: Source; state: CardState; demo: boolean }) {
  const tvDemo = demo && s.id === 'tradingview';
  return (
    <Box
      component="section"
      id={s.id}
      aria-labelledby={`${s.id}-h`}
      data-testid={`source-${s.id}`}
      sx={{
        border: 1,
        borderStyle: demo ? 'dashed' : 'solid',
        borderColor: demo ? 'text.secondary' : 'divider',
        borderRadius: '12px',
        bgcolor: 'background.paper',
        p: { xs: 2, sm: '18px 20px' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        minWidth: 0,
        scrollMarginTop: { xs: 72, md: 80 },
      }}
    >
      <Box
        component="header"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 16px',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* An h2: each card is a top-level section of the page, listed in the contents beside
              Typefaces and What Convexa makes, and nothing sits between it and the h1 (axe
              heading-order, fidelity round 4). Drawn at the card's own 17px, not the H2's 24. */}
          <Box component="h2" id={`${s.id}-h`} sx={{ m: 0, fontSize: 17, lineHeight: 1.3 }}>
            {s.name}
          </Box>
          <Box
            component="span"
            sx={{ display: 'block', mt: '2px', fontSize: 13, color: 'text.secondary' }}
          >
            {s.owner}
          </Box>
        </Box>
        {state.tag === 'loading' ? (
          <Skeleton
            variant="rounded"
            width={150}
            height={24}
            sx={{ borderRadius: '12px' }}
            aria-label="Checking this source"
          />
        ) : (
          <DataStateTag state={state.tag} detail={tvDemo ? 'on the demo' : state.detail} />
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}>
        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
          {state.note}
        </Box>
        {demo && s.shaped && (
          <ProvenanceChip text={`Demo · shaped like ${s.shaped}`} kind="sample" />
        )}
        {!demo && s.operator && state.tag === 'notSetUp' && (
          <Box component="details" sx={{ fontSize: 13, color: 'text.secondary' }}>
            <Box component="summary" sx={{ cursor: 'pointer', minHeight: 24, ...coarseFloor }}>
              For the site’s operator
            </Box>
            {s.operator}
          </Box>
        )}
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '168px minmax(0, 1fr)' },
          gap: { xs: '2px', sm: '10px 16px' },
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        <Row label="What Convexa reads">{s.reads}</Row>
        <Row label="How often, how late">{s.cadence}</Row>
        <Row label="Terms">
          {s.terms}
          {s.finra && (
            <Box sx={{ mt: 1 }}>
              <FinraNotice />
            </Box>
          )}
        </Row>
        {s.privacy && <Row label="Your privacy">{s.privacy}</Row>}
        <Row label="Where it shows">{s.where}</Row>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 18px',
          alignItems: 'center',
          pt: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        {/* A row of standalone links: 24px at a fine pointer, 44px under a coarse one (spec
            2026-10-21/02, part (b); each measured 24px tall at 390 before). */}
        <Link
          href={s.link[1]}
          target="_blank"
          rel="noopener noreferrer"
          underline="always"
          sx={standaloneLinkSx}
        >
          {s.link[0]} ↗
        </Link>
        {s.more?.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            underline="always"
            sx={standaloneLinkSx}
          >
            {label} ↗
          </Link>
        ))}
        {!demo && s.id === 'massive' && (
          <Link href={`${STAGING_DEMO_URL}/ticker/SPY`} underline="always" sx={standaloneLinkSx}>
            See them on the demo →
          </Link>
        )}
        {tvDemo && (
          <Link
            href="https://convexa.pages.dev/ticker/SPY/technical-analysis"
            underline="always"
            sx={standaloneLinkSx}
          >
            TradingView’s chart on the live site ↗
          </Link>
        )}
      </Box>
    </Box>
  );
}

const DEMO_STATE: CardState = {
  tag: 'demo',
  note: 'Sample data from the October 7, 2026 scenario. The demo never contacts this source.',
};
const DEMO_TV: CardState = {
  tag: 'off',
  note: 'The demo never loads TradingView: the Technical tab draws sample bars instead, and no request leaves this browser.',
};

export function CreditsPage() {
  const demo = isDemoBuild();
  const live = useLiveStates(!demo);
  const stateOf = (s: Source): CardState =>
    demo ? (s.id === 'tradingview' ? DEMO_TV : DEMO_STATE) : live.states[s.id];

  // The legend counts the states the cards draw, from the same values, and says while some are
  // still being checked.
  const { counts, checking } = legendCounts(SOURCES.map(stateOf));

  return (
    <DocPage
      path="/credits"
      eyebrow="Sources and credits"
      title="Data sources and credits"
      docTitle="Data sources and credits — Convexa"
      toc={TOC}
      testId="credits-page"
      lead={
        demo ? (
          <Lead>
            <strong>
              This is the demo: every figure on it is sample data shaped like the sources below.
            </strong>{' '}
            The demo calls none of them, and none of its numbers describes a real market. The live
            site reads them as listed here.
          </Lead>
        ) : (
          <Lead>
            Every figure on this site names its source on the card where it appears. This page lists
            them all: who owns each source, what Convexa reads from it, how often and how late it
            publishes, the terms it is shown under, and whether it is working on this site right
            now.
          </Lead>
        )
      }
    >
      <Box
        id="sources"
        role="group"
        aria-label="Sources by state"
        data-testid="credits-legend"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 12px',
          alignItems: 'center',
          p: '12px 16px',
          border: 1,
          borderColor: 'divider',
          borderRadius: '10px',
          bgcolor: 'background.paper',
          scrollMarginTop: { xs: 72, md: 80 },
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          On this page
        </Box>
        {counts.map(([tag, n]) => (
          <DataStateTag
            key={tag}
            state={tag}
            detail={`${tag === 'off' && demo ? 'on the demo · ' : ''}${n}`}
          />
        ))}
        {checking > 0 && (
          <Box
            component="span"
            sx={{
              // A line of its own at a tag's height (DataStateTag: 22px, 24 at a coarse pointer):
              // the row the checked sources' tags fill when they land, so the cards below don't
              // move then (site audit 2026-10-25, PERF-04).
              flexBasis: '100%',
              display: 'flex',
              alignItems: 'center',
              minHeight: 22,
              '@media (pointer: coarse)': { minHeight: 24 },
              fontSize: 13,
              color: 'text.secondary',
            }}
          >
            {checking === SOURCES.length
              ? 'Checking each source…'
              : `${checking} more still checking…`}
          </Box>
        )}
        {!demo && live.failed && (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={live.retry}
            sx={{ minHeight: 32, ...coarseFloor }}
          >
            Try again
          </Button>
        )}
      </Box>

      {demo ? (
        <>
          <Para>On the live site, FINRA’s figures carry the notice FINRA’s terms require:</Para>
          <FinraNotice />
          <Box>
            <Link
              href="https://convexa.pages.dev/credits"
              underline="always"
              sx={{ ...standaloneLinkSx, fontWeight: 600 }}
            >
              The live site’s sources and credits ↗
            </Link>
          </Box>
        </>
      ) : (
        <Para sx={{ fontSize: 13 }}>
          States are checked when you open this page. What each card says about its source never
          depends on that check.
        </Para>
      )}

      {SOURCES.map((s) => (
        <SourceCard key={s.id} s={s} state={stateOf(s)} demo={demo} />
      ))}

      <H2 id="typefaces">Typefaces</H2>
      <Para>
        Three open-source typefaces, served from this site. Loading a page contacts no font service.
      </Para>
      <DocTable
        head={['Typeface', 'Copyright', 'Licence']}
        rows={TYPEFACES.map(([name, copyright, href]) => [
          name,
          copyright,
          <Link key={href} href={href} underline="always" sx={standaloneLinkSx}>
            SIL OFL 1.1
          </Link>,
        ])}
      />

      <H2 id="ours">What Convexa makes</H2>
      <Para>
        <strong>Research notes</strong> are written for Convexa, each with its price date and its
        review date. <strong>Computed</strong> figures — a yield spread, a short share, an average —
        are worked out by Convexa from the inputs named on their card. The landing page’s
        illustrations are <strong>illustrative samples</strong>, labelled as such, and never market
        data.
      </Para>
      <Para sx={{ fontSize: 13, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        A source missing from this page, or a credit that’s wrong? The{' '}
        <Link component={RouterLink} to="/methodology" underline="always" sx={linkSx}>
          Methodology page
        </Link>{' '}
        says how each state is decided; the{' '}
        <Link component={RouterLink} to="/privacy" underline="always" sx={linkSx}>
          Privacy page
        </Link>{' '}
        says what each third party learns about you.
      </Para>
    </DocPage>
  );
}

export default CreditsPage;
