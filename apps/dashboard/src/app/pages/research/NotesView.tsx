/**
 * The ticker's Research tab in live mode: the newest note in full, and every earlier note one click
 * away at its own address (`/ticker/<T>/research/<file-name>`), where it reads as superseded. Notes
 * come from research/<TICKER>/*.md at build time, so this tab works while market data is paused.
 * (Demo mode keeps the authored sample note in `ticker/research/ResearchView.tsx`, whose figures match
 * the demo scenario.)
 */
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { filedSince } from './filings';
import { formatNoteDate } from './format';
import { NotePublicPanels } from './NotePublicPanels';
import { useTickerNotes } from './notesData';
import { NoteView } from './NoteView';
import { usePublicFilings, usePublicMarkets, usePublicTicker } from './publicData';
import { fomcDays } from './reviewTriggers';
import type { ResearchNote } from './types';
import { Panel, StateDot } from './ui';

export { RESEARCH_DISCLAIMER } from './NoteView';

/** The research column: wider than the standard page column, for the rail, the note and the sidebar. */
export function ResearchColumn({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        maxWidth: 1240,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        pt: { xs: 1, md: 1.5 },
        pb: 'max(4rem, env(safe-area-inset-bottom))',
      }}
    >
      {children}
    </Box>
  );
}

function TickerTabs({ ticker }: { ticker: string }) {
  const base = `/ticker/${encodeURIComponent(ticker)}`;
  const tab = (to: string, label: string, current = false) => (
    <Box
      component={RouterLink}
      to={to}
      aria-current={current ? 'page' : undefined}
      sx={{
        px: 1.5,
        py: 1.75,
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: current ? 600 : 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: current ? 'text.primary' : 'text.secondary',
        boxShadow: (t) => (current ? `inset 0 -2px 0 ${t.palette.text.primary}` : 'none'),
        '&:hover': { color: 'text.primary' },
      }}
    >
      {label}
    </Box>
  );
  return (
    <Box
      component="nav"
      aria-label={`${ticker} pages`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        mb: { xs: 2.5, md: 4 },
        overflowX: 'auto',
      }}
    >
      {tab(base, 'Overview')}
      {tab(`${base}/technical-analysis`, 'Technical')}
      {tab(`${base}/research`, 'Research', true)}
      <Box sx={{ flex: 1 }} />
      <Link
        component={RouterLink}
        to="/research"
        sx={{ fontSize: 13, whiteSpace: 'nowrap', pl: 1.5 }}
      >
        All research
      </Link>
    </Box>
  );
}

function OtherNotes({
  notes,
  shown,
  ticker,
}: {
  notes: ResearchNote[];
  shown: ResearchNote;
  ticker: string;
}) {
  const others = notes.filter((n) => n.slug !== shown.slug);
  if (!others.length) return null;
  return (
    <Box
      component="section"
      aria-labelledby="other-notes"
      sx={{ display: 'grid', gap: 1.5, mt: 6 }}
    >
      <Box
        component="h2"
        id="other-notes"
        sx={{
          m: 0,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {shown === notes[0] ? 'Earlier notes' : 'Other notes on this ticker'}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
        {others.map((n) => {
          const latest = n === notes[0];
          return (
            <li key={n.slug}>
              <Panel
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '6px 14px',
                  py: 1.5,
                }}
              >
                <StateDot state={latest ? 'current' : 'superseded'} />
                <Link
                  component={RouterLink}
                  to={
                    latest
                      ? `/ticker/${encodeURIComponent(ticker)}/research`
                      : `/ticker/${encodeURIComponent(ticker)}/research/${encodeURIComponent(n.slug)}`
                  }
                  sx={{ fontWeight: 600, flex: '1 1 260px', minWidth: 0 }}
                >
                  {n.title}
                </Link>
                <Box
                  component="span"
                  sx={(t) => ({
                    fontSize: 12,
                    color: 'text.secondary',
                    bgcolor: alpha(t.palette.text.secondary, 0.12),
                    px: 1,
                    borderRadius: '999px',
                  })}
                >
                  {latest ? 'Latest' : 'Superseded'}
                </Box>
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {formatNoteDate(n.date)}
                </Box>
              </Panel>
            </li>
          );
        })}
      </Box>
    </Box>
  );
}

export function NotesView({ symbol, slug }: { symbol: string; slug?: string }) {
  const ticker = symbol.toUpperCase();
  const { state, retry } = useTickerNotes(ticker);
  const pub = usePublicTicker(ticker);
  const summary = researchIndex.find((r) => r.ticker === ticker)?.latest ?? null;
  // The release calendar's review triggers for the newest note: FOMC days (the Fed's schedule, with
  // the calendar's reading laid over it) and the company's estimated results window.
  const markets = usePublicMarkets(summary !== null);
  const results = usePublicFilings([ticker], summary !== null);
  const calendar = useMemo(
    () => ({ fomc: fomcDays(markets.data?.calendar), windows: results.data?.results ?? [] }),
    [markets.data, results.data],
  );
  return (
    <ResearchColumn>
      <TickerTabs ticker={ticker} />

      {state.phase === 'loading' && (
        <Box sx={{ display: 'grid', gap: 2 }} aria-label={`Loading ${ticker} research`}>
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={180} />
          <Skeleton variant="rounded" height={420} />
        </Box>
      )}

      {state.phase === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" onClick={() => void retry()}>
              Try again
            </Button>
          }
        >
          {ticker} research couldn't load ({state.detail}).
        </Alert>
      )}

      {state.phase === 'none' && (
        <Panel sx={{ display: 'grid', gap: 1.5, justifyItems: 'start', p: 3 }}>
          <Box component="h1" sx={{ m: 0, fontSize: 18, fontWeight: 600 }}>
            No research on {ticker} yet.
          </Box>
          <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
            Notes appear here once they're written. The research index lists every ticker that has
            them.
          </Box>
          <Button component={RouterLink} to="/research" variant="outlined" size="small">
            See all research
          </Button>
        </Panel>
      )}

      {state.phase === 'ready' &&
        (() => {
          const notes = state.notes;
          const shown = slug ? notes.find((n) => n.slug === slug) : notes[0];
          if (!shown)
            return (
              <Panel sx={{ display: 'grid', gap: 1.5, justifyItems: 'start', p: 3 }}>
                <Box component="h1" sx={{ m: 0, fontSize: 18, fontWeight: 600 }}>
                  No {ticker} note named “{slug}”.
                </Box>
                <Link component={RouterLink} to={`/ticker/${encodeURIComponent(ticker)}/research`}>
                  Read the latest {ticker} note →
                </Link>
              </Panel>
            );
          const isLatest = shown === notes[0];
          const isFirst = shown === notes[notes.length - 1];
          // Only the newest note reads today's filings and positioning; an older one is superseded.
          const accessions = isLatest ? (summary?.accessions ?? []) : [];
          const filed =
            isLatest && pub.data
              ? filedSince(pub.data.filings, { date: shown.date, accessions })
              : [];
          return (
            <>
              <NoteView
                key={shown.slug}
                note={shown}
                filed={filed}
                calendar={isLatest ? calendar : null}
                kind={
                  isFirst
                    ? notes.length === 1
                      ? 'Initiation · first note'
                      : 'Initiation'
                    : 'Update'
                }
                latest={isLatest ? null : { slug: notes[0].slug, date: notes[0].date }}
              />
              {isLatest && (
                <Box sx={{ mt: { xs: 4, md: 6 } }}>
                  <NotePublicPanels
                    ticker={ticker}
                    read={pub}
                    note={{ date: shown.date, accessions, aging: shown.aging }}
                  />
                </Box>
              )}
              <OtherNotes notes={notes} shown={shown} ticker={ticker} />
            </>
          );
        })()}
    </ResearchColumn>
  );
}
