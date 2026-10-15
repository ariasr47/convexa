/**
 * `/scanner` on a live build with no options feed (`/api/health` says `not_live`), signed in.
 * Every column of the scan reads the options chain, so the page explains what it would show, why it
 * is off and links the same screen on the demo, over the table's outline (never an empty table).
 * Below, links to what is live on this site without the feed, each with its own state word, and an
 * "On this page" legend counting them (canon P-1, P-2; owner ruling 2026-10-14 (1)).
 *
 * This page never calls /api/scan*: app.tsx mounts it instead of <Scanner/>.
 *
 * Design: design/src/screens/final/account-pages.mjs `scannerProductionSignedIn`.
 */
import { formatShortDate } from '@/pages/research/format';
import { usePublicMarkets, usePublicTicker } from '@/pages/research/publicData';
import { Caps } from '@/pages/research/publicUi';
import { MONO, PANEL_SX } from '@/pages/research/ui';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { DATA_STATES, type DataStateKey } from '@/shared/dataState/vocabulary';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import type { PublicDataState } from '@convexa/api';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { SCAN_COPY } from './labels';

const linkSx = {
  color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  fontWeight: 600,
} as const;

/** The FINRA short-interest card reads one well-covered name; the design draws AMD. */
const SHORT_TICKER = 'AMD';

type Tag = { state: DataStateKey; detail?: string } | null;

/** A source-level answer's word when its part is missing (off, not set up, or down). */
function partTag(state: PublicDataState, present: boolean, ok: Tag): Tag {
  if (state === 'off') return { state: 'off' };
  if (state === 'not_configured') return { state: 'notSetUp' };
  return present ? ok : { state: 'sourceDown' };
}

interface LiveCard {
  to: string;
  title: string;
  body: string;
  tag: Tag;
}

function useLiveCards(): LiveCard[] {
  const markets = usePublicMarkets();
  const ticker = usePublicTicker(SHORT_TICKER);
  const m = markets.data;
  const t = ticker.data;
  const failed: Tag = { state: 'couldntLoad' };
  return [
    {
      to: '/research/markets',
      title: 'Treasury yields',
      body: 'Par yield curve and 2s10s from Treasury.gov, daily after the close.',
      tag: markets.error
        ? failed
        : m
          ? partTag(m.state, m.rates != null, {
              state: 'updated',
              detail: m.rates ? formatShortDate(m.rates.as_of) : undefined,
            })
          : null,
    },
    {
      to: '/research/markets',
      title: 'Futures positioning',
      body: 'CFTC Traders in Financial Futures; published Fridays.',
      tag: markets.error
        ? failed
        : m
          ? partTag(m.state, m.futures != null, {
              state: 'delayed',
              detail: m.futures ? `as of ${formatShortDate(m.futures.report_date)}` : undefined,
            })
          : null,
    },
    {
      to: `/ticker/${SHORT_TICKER}/research`,
      title: 'Short interest',
      body: 'FINRA, twice a month, about a week after settlement.',
      tag: ticker.error
        ? failed
        : t
          ? t.state === 'off'
            ? { state: 'off' }
            : partTag(t.short_interest_state, t.short_interest != null, {
                state: 'delayed',
                detail: t.short_interest
                  ? `as of ${formatShortDate(t.short_interest.settlement_date)}`
                  : undefined,
              })
          : null,
    },
    {
      to: '/research/filings',
      title: 'Filings',
      body: 'SEC EDGAR; starts once SEC access is set up on this site.',
      tag: ticker.error
        ? failed
        : t
          ? t.state === 'off'
            ? { state: 'off' }
            : partTag(t.filings_state, t.filings_state === 'live', { state: 'updated' })
          : null,
    },
  ];
}

function Legend({ counts }: { counts: [DataStateKey, number][] }) {
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
    </Box>
  );
}

const GHOST_HEAD = ['Symbol', 'Price', 'Chg', 'Score', 'Tier', 'Regime', 'Flip dist', 'Walls'];
const GHOST_W = [54, 70, 48, 80, 62, 66, 50, 74];

/** The scan table's outline: its columns, no figures. Decorative; the panel's words carry it. */
function GhostTable() {
  const cols = {
    gridTemplateColumns: { xs: '1.2fr repeat(3, 1fr)', md: '1.2fr repeat(7, 1fr)' },
  };
  const hideNarrow = (i: number) => (i >= 4 ? { display: { xs: 'none', md: 'block' } } : {});
  return (
    <Box
      aria-hidden
      data-testid="scan-not-live-outline"
      sx={(t) => ({
        border: `1px dashed ${t.palette.divider}`,
        borderRadius: '12px',
        overflow: 'hidden',
      })}
    >
      <Box
        sx={(t) => ({
          display: 'grid',
          ...cols,
          gap: '12px',
          px: '14px',
          py: '10px',
          borderBottom: `1px dashed ${t.palette.divider}`,
        })}
      >
        {GHOST_HEAD.map((h, i) => (
          <Caps key={h} sx={hideNarrow(i)}>
            {h}
          </Caps>
        ))}
      </Box>
      {[0, 1, 2].map((r) => (
        <Box
          key={r}
          sx={(t) => ({
            display: 'grid',
            ...cols,
            gap: '12px',
            p: '14px',
            borderBottom: r < 2 ? `1px dashed ${t.palette.divider}` : 0,
          })}
        >
          {GHOST_W.map((w, i) => (
            <Box
              key={i}
              sx={(t) => ({
                ...hideNarrow(i),
                height: 8,
                width: `${w}%`,
                borderRadius: '4px',
                border: `1px dashed ${t.palette.divider}`,
              })}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function ScannerNotLive() {
  const cards = useLiveCards();
  const tally = new Map<DataStateKey, number>([['notLive', 1]]);
  for (const c of cards) if (c.tag) tally.set(c.tag.state, (tally.get(c.tag.state) ?? 0) + 1);
  // The page's own state first (the board's order), then the live cards' words.
  const order = [
    'notLive',
    ...(Object.keys(DATA_STATES) as DataStateKey[]).filter((k) => k !== 'notLive'),
  ] as DataStateKey[];
  const counts = order.filter((k) => tally.has(k)).map((k) => [k, tally.get(k) as number]) as [
    DataStateKey,
    number,
  ][];

  return (
    <Box
      data-testid="scanner-not-live"
      sx={{ maxWidth: 1240, mx: 'auto', p: { xs: 2, sm: 3 }, display: 'grid', gap: 3 }}
    >
      <Box component="header">
        <Box component="h1" sx={{ fontSize: '1.7rem', fontWeight: 700, m: '0 0 4px' }}>
          {SCAN_COPY.heading}
        </Box>
        <Box component="p" sx={{ fontSize: '0.88rem', color: 'text.secondary', m: 0 }}>
          One dense read of the tracked universe, ranked by dealer structure. Open any row for its
          desk.
        </Box>
      </Box>

      <Legend counts={counts} />

      <Box
        component="section"
        aria-label="Scanner, not live"
        sx={{ ...PANEL_SX, p: { xs: '16px', sm: '18px 20px' }, display: 'grid', gap: 1.5 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box component="h2" sx={{ m: 0, fontSize: 16, fontWeight: 600 }}>
            Scanner
          </Box>
          <DataStateTag state="notLive" />
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary', textWrap: 'pretty' }}>
          <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Would show
          </Box>{' '}
          the tracked names ranked by dealer structure, re-scored about every 3 minutes: score,
          tier, regime, distance to the flip and the walls.
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary', textWrap: 'pretty' }}>
          <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Off because
          </Box>{' '}
          every column reads the options chain, a paid feed this site doesn’t run. Signing in
          doesn’t change that.
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px' }}>
          <Link
            href={`${STAGING_DEMO_URL}/scanner`}
            underline="always"
            data-testid="scanner-not-live-demo"
            sx={linkSx}
          >
            See it on the demo →
          </Link>
          <Link
            component={RouterLink}
            to="/methodology"
            underline="always"
            sx={{ ...linkSx, color: 'text.secondary', fontWeight: 400 }}
          >
            How a score is built
          </Link>
        </Box>
        <GhostTable />
      </Box>

      <Box component="section" aria-labelledby="live-here" sx={{ display: 'grid', gap: 1.5 }}>
        <Box component="h2" id="live-here" sx={{ m: 0, fontSize: 18, fontWeight: 600 }}>
          Live on this site
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
          Public data that needs no options feed. Each says how late its source is.
        </Box>
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {cards.map((c) => (
            <Box component="li" key={c.title} sx={{ display: 'flex' }}>
              <Box
                component={RouterLink}
                to={c.to}
                data-testid="scanner-live-card"
                sx={{
                  ...PANEL_SX,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  p: '14px 16px',
                  minHeight: 44,
                  textDecoration: 'none',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'text.secondary' },
                  '&:focus-visible': { outlineOffset: 2 },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Box component="b" sx={{ fontSize: 14 }}>
                    {c.title}
                  </Box>
                  {c.tag && <DataStateTag state={c.tag.state} detail={c.tag.detail} />}
                </Box>
                <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {c.body}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default ScannerNotLive;
