/**
 * Coming up, on /research/markets#coming-up (design: Planned · Calendar, CALENDAR_SPEC;
 * design/src/screens/final/planned.mjs calSection, planned-charts.mjs calendarChart). Six week
 * columns of macro releases from the agencies' published schedules (Fed, BLS, BEA, Treasury, read by
 * the API: `PublicMarkets.calendar`), the notes' own results dates, and results windows estimated
 * from each company's EDGAR filing history (`PublicFilings.results`). Each results row names the
 * note it makes due; the FOMC makes every valued note due.
 *
 * Reads defensively: an API from before the calendar existed sends no `calendar` field, and the
 * section then draws nothing. The demo build draws the scenario's sample calendar, dashed.
 */
import { ChartFrame } from '@/shared/charts/frame';
import { sourceStateWord, type DataStateKey } from '@/shared/dataState/vocabulary';
import {
  dataMode,
  DEMO_CALENDAR_TODAY,
  DEMO_FOLLOWED,
  DEMO_NOTE_RESULTS,
  type PublicMarkets,
  type PublicSource,
} from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { localToday, researchIndex } from 'virtual:convexa-research';
import { buildComingUp, shortDay, type CalEvent, type NoteResult } from './comingUp';
import { usePublicFilings, type Read } from './publicData';
import { StaleNote } from './publicUi';
import { MONO } from './ui';

const SCHEDULE_IDS = ['fed-fomc', 'bls', 'bea', 'treasury-qr'];
const METRIC = 'Releases and results, next six weeks';
const RESULTS = /\bresults\b|\bearnings\b/i;

/** The followed companies and the results dates their notes give (a day, not a month). */
function fromNotes(): { followed: string[]; noteResults: NoteResult[] } {
  const rows = researchIndex.filter((r) => !r.latest.notFollowingSince);
  return {
    followed: rows.map((r) => r.ticker),
    noteResults: rows.flatMap((r) =>
      r.latest.aging.events
        .filter(
          (e) =>
            e.kind === 'catalyst' &&
            !e.resolved &&
            e.when.kind === 'day' &&
            !!e.when.start &&
            RESULTS.test(e.label),
        )
        .map((e) => ({ ticker: r.ticker, date: e.when.start as string, label: e.label })),
    ),
  };
}

/** The schedules' state for the frame's tag: the worst of the four rows. */
function scheduleTag(rows: PublicSource[]): { state: DataStateKey; detail?: string } {
  const words = rows.map((r) => sourceStateWord(r.state));
  for (const worst of ['sourceDown', 'lastGood', 'notSetUp', 'off'] as const)
    if (words.includes(worst)) return { state: worst };
  const read = rows
    .map((r) => r.checked_at)
    .filter((t): t is string => !!t)
    .sort()[0];
  return { state: 'updated', detail: read ? `read ${shortDay(read)}` : undefined };
}

export function ComingUpSection({ read }: { read: Read<PublicMarkets> }) {
  const demo = dataMode === 'demo';
  const today = useMemo(() => (demo ? DEMO_CALENDAR_TODAY : localToday()), [demo]);
  const notes = useMemo(
    () => (demo ? { followed: DEMO_FOLLOWED, noteResults: DEMO_NOTE_RESULTS } : fromNotes()),
    [demo],
  );
  const filings = usePublicFilings(notes.followed);
  const markets = read.data;
  const calendar = markets?.calendar;
  const releases = calendar?.releases;
  const windows = filings.data?.results;
  const built = useMemo(
    () =>
      buildComingUp({
        today,
        releases: releases ?? [],
        noteResults: notes.noteResults,
        windows: windows ?? [],
        followed: notes.followed,
        demo,
      }),
    [today, releases, windows, notes, demo],
  );

  // An API from before the calendar: nothing to say, so nothing drawn.
  if (markets && calendar === undefined) return null;

  const rows = (markets?.sources ?? []).filter((r) => SCHEDULE_IDS.includes(r.id));
  const behind = rows.filter((r) => r.state === 'last_good' || r.state === 'source_down');
  const secRow = filings.data?.sources?.find((r) => r.id === 'sec');
  const secNotSet =
    !demo && (filings.data?.state === 'not_configured' || secRow?.state === 'not_set_up');
  const moved = built.weeks.flatMap((w) => w.events).filter((e) => e.movedFrom);
  const count = built.weeks.reduce((n, w) => n + w.events.length, 0);

  const status = read.loading
    ? ({ kind: 'loading' } as const)
    : !markets
      ? ({
          kind: 'message',
          tone: 'warn',
          text: 'The calendar didn’t load.',
          cause: 'Convexa’s server didn’t answer. Each note still lists its own dates.',
        } as const)
      : markets.state === 'off'
        ? ({
            kind: 'message',
            tone: 'quiet',
            text: 'Public data is switched off on this server.',
            cause:
              'The agencies’ schedules come through Convexa’s API, which has them turned off. Each note still lists its own dates.',
          } as const)
        : count === 0
          ? ({
              kind: 'message',
              tone: 'quiet',
              text: 'Nothing scheduled in the next six weeks.',
              cause:
                'Fed, BLS, BEA and Treasury releases and the followed companies’ results appear here as their dates are set.',
            } as const)
          : ({ kind: 'ready' } as const);

  const followedWord = demo
    ? `${built.reporting.length} of the ${notes.followed.length} demo names`
    : `${built.reporting.length} of the ${notes.followed.length} followed companies`;
  const finding = `${demo ? 'In the sample, ' : ''}${followedWord} ${built.reporting.length === 1 ? 'reports' : 'report'} in the next six weeks${built.fomc ? `; the Fed decides on ${shortDay(built.fomc)}` : ''}`;

  const tag = demo
    ? ({ state: 'demo' } as const)
    : calendar === null
      ? ({ state: 'sourceDown' } as const)
      : rows.length
        ? scheduleTag(rows)
        : undefined;

  return (
    <Box component="section" id="coming-up" sx={{ scrollMarginTop: { xs: 72, md: 80 } }}>
      <ChartFrame
        finding={finding}
        metric={METRIC}
        sub={`Macro releases from the agencies’ published schedules and results dates from the notes, or estimated from each company’s filing history · ${shortDay(built.from)} – ${shortDay(built.weeks[5].end)} · times Eastern`}
        headingLevel="h2"
        height={180}
        provenance={demo ? 'sample' : 'primary'}
        status={status}
        tag={tag}
        action={
          !markets && !read.loading ? (
            <Button size="small" variant="outlined" color="inherit" onClick={read.retry}>
              Try again
            </Button>
          ) : undefined
        }
        legend={<Key />}
        source={
          demo
            ? { text: 'Demo · shaped like agency schedules and EDGAR filing history' }
            : { text: 'Fed · BLS · BEA · Treasury schedules · SEC EDGAR' }
        }
        asOf={
          demo
            ? `Scenario · ${shortDay(DEMO_CALENDAR_TODAY)}, 2026`
            : tag?.state === 'updated' && tag.detail
              ? `Schedules ${tag.detail}`
              : undefined
        }
        note="An estimated window comes from the company’s last four results dates (its 8-K earnings releases, or its 10-Q and 10-K dates); it turns into a date when the note gives one."
        table={{
          caption: 'Releases and results, next six weeks',
          cols: ['Date', 'Event', 'Source', 'Makes due'],
          rows: built.weeks.flatMap((w) =>
            w.events.map((e) => [
              e.end && e.end !== e.date
                ? `${shortDay(e.date)} – ${shortDay(e.end)}`
                : shortDay(e.date),
              e.label,
              e.source,
              e.due ?? '—',
            ]),
          ),
        }}
      >
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {!demo && calendar === null && (
            <StaleNote text="The agencies’ schedules didn’t answer and no earlier copy is kept. Results dates still show." />
          )}
          {!demo &&
            behind.map((r) => (
              <StaleNote
                key={r.id}
                text={
                  r.detail ??
                  `${r.name}: ${r.state === 'last_good' ? 'last good copy' : 'source down'}.`
                }
              />
            ))}
          {!demo &&
            moved.map((e) => (
              <Box key={`${e.label}-${e.date}`} component="p" sx={{ m: 0, fontSize: 13 }}>
                {`${e.source.split(' · ')[0]} moved the ${e.label} from ${shortDay(e.movedFrom as string)} to ${shortDay(e.date)}.`}
              </Box>
            ))}
          {secNotSet && (
            <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
              Results dates come from the notes only. Estimating the rest needs SEC filings, which
              aren’t set up on this site yet.
            </Box>
          )}
          <Grid weeks={built.weeks} />
        </Box>
      </ChartFrame>
    </Box>
  );
}

function Key() {
  const swatch = (kind: 'macro' | 'note' | 'est') => (
    <Box
      component="i"
      aria-hidden
      sx={(t) => ({
        display: 'inline-block',
        width: 14,
        height: 12,
        mr: 0.75,
        verticalAlign: '-2px',
        borderRadius: '3px',
        border: `1px ${kind === 'est' ? 'dashed' : 'solid'} ${alpha(t.palette.text.secondary, 0.5)}`,
        bgcolor: kind === 'est' ? 'transparent' : 'background.default',
        ...(kind === 'macro' && { boxShadow: `inset 2px 0 0 ${t.palette.text.primary}` }),
      })}
    />
  );
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 16px',
        fontSize: 12,
        color: 'text.secondary',
      }}
    >
      <span>{swatch('macro')}Macro release · published schedule</span>
      <span>{swatch('note')}Results · date from the note</span>
      <span>{swatch('est')}Results · estimated window, from filing history</span>
    </Box>
  );
}

function Grid({ weeks }: { weeks: ReturnType<typeof buildComingUp>['weeks'] }) {
  return (
    <Box
      role="list"
      aria-label="Next six weeks"
      sx={(t) => ({
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'repeat(3, minmax(0, 1fr))',
          lg: 'repeat(6, minmax(0, 1fr))',
        },
        gap: '1px',
        bgcolor: 'divider',
        border: `1px solid ${t.palette.divider}`,
        borderRadius: '10px',
        overflow: 'hidden',
      })}
    >
      {weeks.map((w) => (
        <Box
          key={w.start}
          role="listitem"
          sx={{
            bgcolor: 'background.paper',
            p: '10px 10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minWidth: 0,
          }}
        >
          <Box
            component="span"
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            {`${shortDay(w.start)}–${weekEnd(w.start, w.end)}`}
          </Box>
          {w.events.length ? (
            w.events.map((e) => <Event key={`${e.kind}-${e.label}-${e.date}`} e={e} />)
          ) : (
            <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
              Nothing scheduled
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** "16", or "Nov 2" when the week crosses a month. */
function weekEnd(start: string, end: string): string {
  const s = shortDay(start);
  const e = shortDay(end);
  return s.split(' ')[0] === e.split(' ')[0] ? e.split(' ')[1] : e;
}

function Event({ e }: { e: CalEvent }) {
  const when =
    e.end && e.end !== e.date ? `${shortDay(e.date)}–${weekEnd(e.date, e.end)}` : shortDay(e.date);
  return (
    <Box
      data-kind={e.kind}
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        p: '6px 8px',
        borderRadius: '8px',
        border: `1px ${e.kind === 'est' ? 'dashed' : 'solid'} ${alpha(t.palette.text.secondary, 0.35)}`,
        bgcolor: e.kind === 'est' ? 'transparent' : 'background.default',
        fontSize: 12.5,
        lineHeight: 1.35,
        minWidth: 0,
        overflowWrap: 'anywhere',
        ...(e.kind === 'macro' && { boxShadow: `inset 2px 0 0 ${t.palette.text.primary}` }),
      })}
    >
      <Box component="span" sx={{ fontFamily: MONO, fontSize: 11.5, color: 'text.secondary' }}>
        {when}
      </Box>
      <Box component="b" sx={{ fontWeight: 600 }}>
        {e.label}
      </Box>
      <Box component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        {e.source}
      </Box>
      {e.movedFrom && (
        <Box component="span" sx={{ fontSize: 11.5 }}>
          {`Moved from ${shortDay(e.movedFrom)}`}
        </Box>
      )}
      {e.due && (
        <Box component="span" sx={{ fontSize: 11.5 }}>
          {`Makes due: ${e.due}`}
        </Box>
      )}
    </Box>
  );
}
