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
 * counts the same states the cards draw. The demo build makes no request: every card is dashed
 * sample data, and TradingView is off.
 *
 * Design: design/src/screens/final/trust.mjs (credits row), trust-pages.mjs (creditsArticle).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { publicDataWord, sourceStateWord, type DataStateKey } from '@/shared/dataState/vocabulary';
import { isDemoBuild, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import type { PublicDataState, PublicSource } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { Link as RouterLink } from 'react-router-dom';
import { formatShortDate } from '../research/format';
import { usePublicMarkets, usePublicTicker } from '../research/publicData';
import { ProvenanceChip } from '../research/publicUi';
import { DocPage, DocTable, FinraNotice, H2, Lead, linkSx, Para } from './DocPage';
import { SOURCES, TYPEFACES, type Source, type SourceId } from './sources';

const TOC = [
  ['sources', 'On this page'],
  ...SOURCES.map((s) => [s.id, s.toc] as const),
  ['typefaces', 'Typefaces'],
  ['ours', 'What Convexa makes'],
] as const;

/** One card's state: a tag (or a skeleton while checking) and the line under it. */
type CardState = { tag: DataStateKey | 'loading'; detail?: string; note: string };

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const utcTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

const DOWN =
  'The source didn’t answer and no earlier copy is kept. Convexa asks again on its next check.';
const OFF = 'Public data is switched off on this site. Convexa isn’t contacting this source.';
const NOT_SET = 'This source isn’t set up on this site.';
const SEC_NOT_SET =
  'This site hasn’t been given the contact line EDGAR asks for, so filings and insider trades don’t load yet.';
const LAST_GOOD =
  'The source didn’t answer on Convexa’s last check; this is the last copy it read.';

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

/** A public part's state when it isn't live: Off, Not set up or Source down, with its line. */
function notLiveState(state: PublicDataState, notConfiguredNote: string): CardState | null {
  if (state === 'live') return null;
  const tag = publicDataWord(state);
  return {
    tag,
    note: state === 'off' ? OFF : state === 'not_configured' ? notConfiguredNote : DOWN,
  };
}

/** The line and tag detail for a source that answered on its schedule. */
function answered(id: SourceId, row: PublicSource): { detail?: string; note: string } {
  const asOf = row.as_of;
  const checked = row.checked_at ? ` · checked ${utcTime(row.checked_at)} UTC` : '';
  switch (id) {
    case 'treasury':
      return asOf
        ? { detail: formatShortDate(asOf), note: `Rates for ${longDate(asOf)}${checked}.` }
        : { note: `Treasury answered${checked}.` };
    case 'cftc':
      return asOf
        ? {
            detail: `as of ${formatShortDate(asOf)}`,
            note: `Positions as of ${longDate(asOf)}. The CFTC publishes each week’s positions the Friday after.`,
          }
        : { note: `The CFTC answered${checked}.` };
    case 'fed-h41':
    case 'treasury-dts':
    case 'nyfed-rrp':
      return asOf
        ? {
            detail: `week to ${formatShortDate(asOf)}`,
            note: `Netted for the week to Wednesday, ${longDate(asOf)}${checked}.`,
          }
        : { note: `Answered${checked}.` };
    case 'finra-si':
      return asOf
        ? {
            detail: `settled ${formatShortDate(asOf)}`,
            note: `Settlement of ${longDate(asOf)}. FINRA publishes about a week after each settlement.`,
          }
        : { note: 'FINRA answered; it has no report for the ticker checked.' };
    case 'finra-shvol':
      return asOf
        ? { detail: `${formatShortDate(asOf)} file`, note: `The file for ${longDate(asOf)}.` }
        : { note: 'FINRA answered; it has no file for the ticker checked.' };
    case 'sec':
      return { note: 'Convexa checks filings every hour and company facts every 24 hours.' };
    default:
      return { note: `Answered${checked}.` };
  }
}

/** One card's state from the API's own row for it (servers from 2026-10-15 on). */
function fromRow(id: SourceId, row: PublicSource): CardState {
  const tag = sourceStateWord(row.state);
  switch (tag) {
    case null:
      return { tag: 'couldntLoad', note: 'This server reported a state this page doesn’t know.' };
    case 'off':
      return { tag, note: OFF };
    case 'notSetUp':
      return { tag, note: id === 'sec' ? SEC_NOT_SET : NOT_SET };
    case 'sourceDown':
      return { tag, note: DOWN };
    case 'lastGood':
      return {
        tag,
        detail: row.checked_at ? `read ${formatShortDate(row.checked_at.slice(0, 10))}` : undefined,
        note: row.detail ?? LAST_GOOD,
      };
    default:
      return { tag, ...answered(id, row) };
  }
}

const RANK: Partial<Record<DataStateKey, number>> = {
  sourceDown: 5,
  lastGood: 4,
  couldntLoad: 4,
  notSetUp: 3,
  off: 2,
};

/** The schedules card: the worst of its four rows, naming the ones that aren't current. */
function schedulesState(rows: PublicSource[]): CardState {
  const states = rows.map((row) => ({ row, card: fromRow('schedules', row) }));
  const worst = states.reduce((a, b) =>
    (RANK[b.card.tag as DataStateKey] ?? 0) > (RANK[a.card.tag as DataStateKey] ?? 0) ? b : a,
  );
  if (worst.card.tag === 'updated') {
    const oldest = rows
      .map((r) => r.checked_at)
      .filter((t): t is string => !!t)
      .sort()[0];
    return {
      tag: 'updated',
      note: `All ${rows.length} schedules read${oldest ? ` · checked ${utcTime(oldest)} UTC` : ''}.`,
    };
  }
  if (worst.card.tag === 'off' || worst.card.tag === 'notSetUp') return worst.card;
  const behind = states
    .filter((s) => s.card.tag !== 'updated')
    .map((s) => s.row.detail ?? `${s.row.name}: ${s.card.note}`);
  return { tag: worst.card.tag, detail: worst.card.detail, note: behind.join(' ') };
}

function useLiveStates(enabled: boolean): {
  states: Record<SourceId, CardState>;
  failed: boolean;
  retry: () => void;
} {
  const markets = usePublicMarkets(enabled);
  const spy = usePublicTicker(enabled ? 'SPY' : '');
  const checking: CardState = { tag: 'loading', note: 'Checking this source…' };
  const couldnt: CardState = { tag: 'couldntLoad', note: 'Couldn’t check this source.' };

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
  const liquidity: CardState = !m
    ? couldnt
    : (notLiveState(m.state, NOT_SET) ??
      (m.liquidity
        ? {
            tag: 'updated',
            detail: `week to ${formatShortDate(m.liquidity.as_of)}`,
            note: `Netted for the week to Wednesday, ${longDate(m.liquidity.as_of)}.`,
          }
        : { tag: 'sourceDown', note: DOWN }));
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
    'fed-h41': liquidity,
    'treasury-dts': liquidity,
    'nyfed-rrp': liquidity,
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
    const read = FROM_MARKETS.includes(id) ? markets : FROM_TICKER.includes(id) ? spy : null;
    if (!read) return legacy[id];
    if (read.loading) return checking;
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
    failed: (!markets.loading && !m) || (!spy.loading && !t),
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
          <Box component="h3" id={`${s.id}-h`} sx={{ m: 0, fontSize: 17, lineHeight: 1.3 }}>
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
            <Box component="summary" sx={{ cursor: 'pointer', minHeight: 24 }}>
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
          '& a': { display: 'inline-flex', alignItems: 'center', minHeight: 24 },
        }}
      >
        <Link
          href={s.link[1]}
          target="_blank"
          rel="noopener noreferrer"
          underline="always"
          sx={linkSx}
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
            sx={linkSx}
          >
            {label} ↗
          </Link>
        ))}
        {!demo && s.id === 'massive' && (
          <Link href={`${STAGING_DEMO_URL}/ticker/SPY`} underline="always" sx={linkSx}>
            See them on the demo →
          </Link>
        )}
        {tvDemo && (
          <Link
            href="https://convexa.pages.dev/ticker/SPY/technical-analysis"
            underline="always"
            sx={linkSx}
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

  // The legend counts the states the cards draw, from the same values.
  const counts = new Map<DataStateKey, number>();
  for (const s of SOURCES) {
    const tag = stateOf(s).tag;
    if (tag !== 'loading') counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

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
        {[...counts].map(([tag, n]) => (
          <DataStateTag
            key={tag}
            state={tag}
            detail={`${tag === 'off' && demo ? 'on the demo · ' : ''}${n}`}
          />
        ))}
        {!demo && live.failed && (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={live.retry}
            sx={{ minHeight: 32 }}
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
              sx={{ ...linkSx, fontWeight: 600 }}
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
          <Link key={href} href={href} underline="always" sx={linkSx}>
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
