/**
 * The ticker's Research tab in live mode: the owner's published notes for this symbol, newest first.
 * Notes come from research/<TICKER>/*.md at build time, so this tab works while market data is
 * paused. (Demo mode keeps the authored sample note in `ticker/research/ResearchView.tsx`, whose
 * figures match the demo scenario.)
 */
import { extrasFor } from '@/shared/theme/tokens';
import { TintChip } from '@/shared/ui/TintChip';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { NoteBody } from './NoteBody';
import { formatNoteDate, STANCE_LABEL, STANCE_TONE, useTickerNotes } from './notesData';
import type { ResearchNote } from './types';

export const RESEARCH_DISCLAIMER = 'Personal research notes. Not financial advice.';

export function NoteMeta({
  note,
}: {
  note: Pick<ResearchNote, 'date' | 'updated' | 'horizon' | 'stance' | 'tags'>;
}) {
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.75 }}
    >
      <Typography variant="caption" color="text.secondary">
        {formatNoteDate(note.date)}
        {note.updated && note.updated !== note.date && ` · updated ${formatNoteDate(note.updated)}`}
        {note.horizon && ` · horizon ${note.horizon}`}
      </Typography>
      {note.stance && (
        <TintChip tone={STANCE_TONE[note.stance]} label={STANCE_LABEL[note.stance]} />
      )}
      {note.tags.map((tag) => (
        <TintChip key={tag} tone="neutral" label={tag} />
      ))}
    </Box>
  );
}

function Sources({ sources }: { sources: ResearchNote['sources'] }) {
  if (!sources.length) return null;
  return (
    <Box>
      <Typography component="h3" variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        Sources
      </Typography>
      <Box component="ol" sx={{ pl: 3, my: 0, display: 'grid', gap: 0.5 }}>
        {sources.map((source) => (
          <Typography component="li" variant="body2" key={source.href}>
            <Link href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </Link>
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function NoteCard({ note, latest }: { note: ResearchNote; latest: boolean }) {
  const body = (
    <Stack spacing={2}>
      <NoteBody blocks={note.blocks} />
      <Sources sources={note.sources} />
    </Stack>
  );
  if (latest)
    return (
      <Card
        variant="outlined"
        component="article"
        id={`note-${note.slug}`}
        sx={{ borderTop: 2, borderTopColor: 'primary.main' }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Typography variant="h5" component="h2">
                {note.title}
              </Typography>
              <NoteMeta note={note} />
            </Stack>
            {body}
          </Stack>
        </CardContent>
      </Card>
    );
  return (
    <Card variant="outlined" component="article" id={`note-${note.slug}`}>
      <Box
        component="details"
        sx={{ '&[open] > summary': { borderBottom: 1, borderColor: 'divider' } }}
      >
        <Box
          component="summary"
          sx={{ cursor: 'pointer', px: 2, py: 1.5, minHeight: 44, display: 'grid', gap: 0.75 }}
        >
          <Typography
            component="h2"
            variant="subtitle1"
            sx={{ display: 'inline', fontWeight: 600 }}
          >
            {note.title}
          </Typography>
          <NoteMeta note={note} />
        </Box>
        <CardContent>{body}</CardContent>
      </Box>
    </Card>
  );
}

export function NotesView({ symbol }: { symbol: string }) {
  const ticker = symbol.toUpperCase();
  const { state, retry } = useTickerNotes(ticker);
  const navSx = (theme: Parameters<typeof extrasFor>[0]) => ({
    minHeight: 44,
    color: extrasFor(theme).textAmber,
  });

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography component="h1" variant="h5">
          {ticker} research
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          component={RouterLink}
          to={`/ticker/${encodeURIComponent(ticker)}`}
          size="small"
          sx={navSx}
        >
          Overview
        </Button>
        <Button
          component={RouterLink}
          to={`/ticker/${encodeURIComponent(ticker)}/technical-analysis`}
          size="small"
          sx={navSx}
        >
          Technical analysis
        </Button>
        <Button component={RouterLink} to="/research" size="small" sx={navSx}>
          All research
        </Button>
      </Box>

      {state.phase === 'loading' && (
        <Stack spacing={2} aria-label={`Loading ${ticker} research`}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={260} />
        </Stack>
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
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
                No research on {ticker} yet.
              </Typography>
              <Typography color="text.secondary">
                Notes appear here once they're written. The research index lists every ticker that
                has them.
              </Typography>
              <Button component={RouterLink} to="/research" variant="outlined" size="small">
                See all research
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {state.phase === 'ready' && (
        <>
          <Typography variant="body2" color="text.secondary">
            {state.notes.length === 1 ? '1 note' : `${state.notes.length} notes`}, newest first
          </Typography>
          <NoteCard note={state.notes[0]} latest />
          {state.notes.length > 1 && (
            <Stack spacing={1.5}>
              <Typography component="h2" variant="overline" color="text.secondary">
                Earlier notes
              </Typography>
              {state.notes.slice(1).map((note) => (
                <NoteCard note={note} latest={false} key={note.slug} />
              ))}
            </Stack>
          )}
        </>
      )}

      <Typography variant="caption" color="text.secondary">
        {RESEARCH_DISCLAIMER}
      </Typography>
    </Stack>
  );
}
