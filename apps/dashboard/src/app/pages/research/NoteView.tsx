/**
 * One research note, as designed on the Convexa Research View canvas: the answer first (header strip,
 * price against value, the 30-second summary, freshness), then five parts of numbered sections with a
 * side rail that tracks where you are, and a sidebar for what comes next and what's yours to decide.
 *
 * Freshness is worked out HERE, in the reader's browser, from the note's own dates: the site isn't
 * rebuilt after it deploys, so a build-time answer would say "current" forever.
 */
import { coarseFloor } from '@/shared/ui/touch';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { freshness as freshnessOf, localToday, upcoming } from 'virtual:convexa-research';
import { StripBlock, TldrBlock } from './blocks/Figures';
import { PriceValueFrame, stripData } from './blocks/Valuation';
import {
  daysBetween,
  formatNoteDate,
  formatShortDate,
  money,
  STANCE_LABEL,
  UNCERTAINTY_LABEL,
} from './format';
import { NoteInlines } from './Inlines';
import { NoteBody } from './NoteBody';
import { NoteContext } from './noteContext';
import { FiledSinceCard } from './NotePublicPanels';
import {
  calendarTriggers,
  ESTIMATE_TRIGGER,
  FOMC_TRIGGER,
  withCalendar,
  type CalendarInputs,
} from './reviewTriggers';
import type { Aging, Freshness, NoteBlock, ResearchNote, ValuationBlock } from './types';
import { DISPLAY, Eyebrow, FreshnessLine, MONO, Panel, Pill, YourCall } from './ui';
import { useActiveSection } from './useActiveSection';

/** The Notes page's footnote (Final · Research index, production: design/src/screens/final/
 *  research.mjs:146; fidelity R-21). */
export const RESEARCH_DISCLAIMER =
  'Personal research notes. Prices in the notes are each note’s own, from its price date. Not investment advice.';
/** A note's own footnote opens as its board's does (final/ticker-note.mjs:111; fidelity R-21). */
const NOTE_DISCLAIMER = 'Personal research notes. Not investment advice.';

const pad2 = (n: number) => String(n).padStart(2, '0');

function allBlocks(note: ResearchNote): NoteBlock[] {
  return [
    ...note.lead,
    ...note.parts.flatMap((p) => [...p.intro, ...p.sections.flatMap((s) => s.blocks)]),
  ];
}

function daysAgo(n: number) {
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}

function FreshnessBanner({
  note,
  f,
  today,
  latest,
}: {
  note: ResearchNote;
  f: Freshness;
  today: string;
  latest: { slug: string; date: string } | null;
}) {
  if (f.state === 'current') return null;
  let head: string;
  let body: React.ReactNode;
  if (f.state === 'archived') {
    head = `Not following since ${formatNoteDate(note.notFollowingSince ?? note.date)}.`;
    body = 'Kept as a dated record. Nothing here is being kept up to date.';
  } else if (f.state === 'superseded') {
    head = `Superseded. A newer note${latest ? ` (${formatNoteDate(latest.date)})` : ''} replaces this one.`;
    body = latest ? (
      <Link component={RouterLink} to={`/ticker/${encodeURIComponent(note.ticker)}/research`}>
        Read the latest note →
      </Link>
    ) : null;
  } else {
    head = `Review due. Written ${formatNoteDate(note.date)}, ${daysAgo(daysBetween(note.date, today))}.`;
    body = (
      <>
        Since then:{' '}
        {f.passed.map((e, i) => (
          <span key={`${e.label}-${e.date}`}>
            {i > 0 && ' · '}
            <Box component="span" sx={{ color: 'text.primary' }}>
              {e.label}
            </Box>{' '}
            <Box component="span" sx={{ ...MONO, fontSize: 12 }}>
              {e.whenLabel && e.whenLabel !== formatNoteDate(e.date)
                ? e.whenLabel
                : formatShortDate(e.date)}
            </Box>
          </span>
        ))}
        . The figures below predate them.
      </>
    );
  }
  return (
    <Box
      role="status"
      sx={(t) => ({
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr)',
        gap: 1.75,
        alignItems: 'start',
        px: 2.5,
        py: 2,
        borderRadius: '12px',
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(t.palette.text.primary, 0.3)}`,
      })}
    >
      <ScheduleOutlined sx={{ fontSize: 22, color: 'text.primary' }} aria-hidden />
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Box component="span" sx={{ fontWeight: 600, fontSize: 16 }}>
          {head}
        </Box>
        {body && (
          <Box component="span" sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.55 }}>
            {body}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Header({
  note,
  f,
  today,
  valuation,
  kind,
}: {
  note: ResearchNote;
  f: Freshness;
  today: string;
  valuation: ValuationBlock | null;
  kind: string;
}) {
  const deck = note.lead.filter((b) => b.type === 'paragraph');
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: { xs: 2, md: 3 } }}
    >
      <Box sx={{ flex: '999 1 540px', minWidth: 0, display: 'grid', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 18px' }}>
          <Box
            component="span"
            sx={{ ...DISPLAY, fontWeight: 800, fontSize: { xs: 40, md: 56 }, lineHeight: 1 }}
          >
            {note.ticker}
          </Box>
          {(note.company || note.about) && (
            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {note.company && (
                <Box component="span" sx={{ fontSize: 17, fontWeight: 600 }}>
                  {note.company}
                </Box>
              )}
              {note.about && (
                <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {note.about}
                </Box>
              )}
            </Box>
          )}
        </Box>
        <Box
          component="h1"
          id="note-title"
          sx={{
            ...DISPLAY,
            m: 0,
            fontWeight: 700,
            fontSize: { xs: 26, md: 38 },
            lineHeight: 1.12,
            maxWidth: '26ch',
            textWrap: 'balance',
          }}
        >
          {note.title}
        </Box>
        {deck.map((b, i) =>
          b.type === 'paragraph' ? (
            <Box
              component="p"
              key={i}
              sx={{
                m: 0,
                fontSize: 16,
                color: 'text.secondary',
                maxWidth: '70ch',
                lineHeight: 1.6,
              }}
            >
              <NoteInlines nodes={b.children} />
            </Box>
          ) : null,
        )}
      </Box>
      <Box
        sx={{
          flex: '1 1 300px',
          display: 'grid',
          gap: 0.75,
          justifyItems: 'start',
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        {valuation && (
          <span>
            <Box component="span" sx={{ ...MONO, color: 'text.primary' }}>
              Price
            </Box>{' '}
            as of {formatNoteDate(valuation.price.asOf)} ·{' '}
            {f.priceAgeDays !== null && f.priceAgeDays > 1
              ? `${f.priceAgeDays} days old`
              : daysAgo(f.priceAgeDays ?? 0)}
          </span>
        )}
        <span>
          <Box component="span" sx={{ ...MONO, color: 'text.primary' }}>
            Thesis
          </Box>{' '}
          reviewed {formatNoteDate(note.updated ?? note.date)} ·{' '}
          {daysAgo(daysBetween(note.updated ?? note.date, today))}
        </span>
        <Box
          component="span"
          sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}
        >
          <Box component="span" sx={{ ...MONO, color: 'text.primary' }}>
            Status
          </Box>
          <FreshnessLine freshness={f} notFollowingSince={note.notFollowingSince} withReason />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {note.stance ? (
            <Pill variant="strong">Stance · {STANCE_LABEL[note.stance]}</Pill>
          ) : (
            <YourCall label="Stance · your call" />
          )}
          <Pill>Position · {note.position ?? 'not stated'}</Pill>
          {note.target !== null && note.targetDate && (
            <Pill variant="strong">
              Your target {money(note.target)} by {formatShortDate(note.targetDate)}
            </Pill>
          )}
          <Pill>
            {note.readMinutes} min · {Math.max(1, Math.round(note.readMinutes / 4))} min skim
          </Pill>
          <Pill>{kind}</Pill>
        </Box>
      </Box>
    </Box>
  );
}

function PartRule({ n, title }: { n: number; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
        Part {n}
      </Box>
      <Box
        component="span"
        sx={{
          ...DISPLAY,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Box>
      <Box
        component="span"
        sx={(t) => ({ flexGrow: 1, height: '1px', bgcolor: alpha(t.palette.text.secondary, 0.22) })}
      />
    </Box>
  );
}

function Rail({ note, active }: { note: ResearchNote; active: string }) {
  const sections = note.parts.flatMap((p) => p.sections);
  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === active),
  );
  const progress = sections.length ? (index + 1) / sections.length : 0;
  const activePart = note.parts.findIndex((p) => p.sections.some((s) => s.id === active));
  const left = Math.max(1, Math.round(note.readMinutes * (1 - progress)));
  return (
    <Box
      component="nav"
      aria-label="On this page"
      sx={{ position: 'sticky', top: 88, display: 'grid', gap: 1.25, alignContent: 'start' }}
    >
      <Eyebrow>On this page</Eyebrow>
      <Box
        sx={(t) => ({
          height: 3,
          borderRadius: '3px',
          bgcolor: alpha(t.palette.text.secondary, 0.16),
        })}
        role="img"
        aria-label={`Section ${index + 1} of ${sections.length}`}
      >
        <Box
          sx={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: '3px',
            bgcolor: 'text.primary',
            transition: 'width 200ms ease',
          }}
        />
      </Box>
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        {note.parts.length > 1 && activePart >= 0
          ? `Part ${activePart + 1} of ${note.parts.length} · `
          : ''}
        about {left} min left
      </Box>
      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
        {note.parts.map((part, pi) => {
          const open = pi === activePart;
          const first = part.sections[0];
          if (!first) return null;
          return (
            <Box component="li" key={pi} sx={{ display: 'grid', gap: 0.25 }}>
              <Box
                component="a"
                href={`#${first.id}`}
                sx={(t) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  minHeight: 36,
                  ...coarseFloor,
                  px: 1.25,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: 13,
                  color: open ? 'text.primary' : 'text.secondary',
                  fontWeight: open ? 600 : 400,
                  bgcolor: open ? 'action.selected' : 'transparent',
                  '&:hover': {
                    color: 'text.primary',
                    bgcolor: alpha(t.palette.text.secondary, 0.08),
                  },
                })}
              >
                {/* On the open row's selected fill, secondary measured 4.32:1 (dark): use primary. */}
                <Box
                  component="span"
                  sx={{
                    ...MONO,
                    fontSize: 11,
                    color: open ? 'text.primary' : 'text.secondary',
                    width: 16,
                  }}
                >
                  {pi + 1}
                </Box>
                <Box component="span" sx={{ flexGrow: 1 }}>
                  {part.title ?? 'Notes'}
                </Box>
                <Box
                  component="span"
                  sx={{ ...MONO, fontSize: 11, color: open ? 'text.primary' : 'text.secondary' }}
                >
                  {part.sections.length}
                </Box>
              </Box>
              {open && (
                <Box
                  component="ol"
                  sx={(t) => ({
                    listStyle: 'none',
                    m: '0 0 4px 17px',
                    p: '0 0 0 10px',
                    display: 'grid',
                    gap: '2px',
                    borderLeft: `1px solid ${alpha(t.palette.text.secondary, 0.22)}`,
                  })}
                >
                  {part.sections.map((s) => (
                    <li key={s.id}>
                      <Box
                        component="a"
                        href={`#${s.id}`}
                        aria-current={s.id === active ? 'location' : undefined}
                        sx={(t) => ({
                          display: 'block',
                          px: 1,
                          py: '5px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: 12,
                          color: s.id === active ? 'text.primary' : 'text.secondary',
                          bgcolor:
                            s.id === active ? alpha(t.palette.text.secondary, 0.12) : 'transparent',
                        })}
                      >
                        {s.label}
                      </Box>
                    </li>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** "The verdict" → "Verdict": chips are short, so the article goes. */
const chipLabel = (title: string | null) => {
  const t = (title ?? 'Notes').replace(/^The /, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Below md the rail becomes a sticky row of part chips. */
function PartChips({ note, active }: { note: ResearchNote; active: string }) {
  const activePart = note.parts.findIndex((p) => p.sections.some((s) => s.id === active));
  const sections = note.parts.flatMap((p) => p.sections);
  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === active),
  );
  return (
    <Box
      component="nav"
      aria-label="Parts of this note"
      sx={(t) => ({
        display: { xs: 'grid', md: 'none' },
        position: 'sticky',
        top: 56,
        zIndex: 5,
        mx: -2,
        px: 2,
        py: 1.25,
        // The padding trade: under a coarse pointer each pill's link is 44px tall around its 32px
        // fill, so the bar's padding drops from 10px to 4px and the bar keeps its height (spec
        // 2026-10-21/02, part (b)).
        '@media (pointer: coarse)': { py: 0.5 },
        gap: 1,
        bgcolor: alpha(t.palette.background.default, 0.94),
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      })}
    >
      <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {note.parts.map((p, i) =>
          p.sections[0] ? (
            // The link is the target: transparent, 44px under a coarse pointer; the span inside
            // draws the 32px pill. The row scrolls sideways (overflowX), which would clip a
            // pseudo-element hit area, hence the padding trade above.
            <Box
              key={i}
              component="a"
              href={`#${p.sections[0].id}`}
              sx={[
                {
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '999px',
                  textDecoration: 'none',
                  minHeight: 32,
                },
                coarseFloor,
              ]}
            >
              <Box
                component="span"
                sx={(t) => ({
                  px: 1.5,
                  minHeight: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '999px',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  // Light: steel on its own 16% steel tint measured 4.08:1, so the resting pill
                  // label is text.primary there (spec 2026-10-21/02, part (c)).
                  ...(i === activePart
                    ? { bgcolor: 'text.primary', color: 'background.default', fontWeight: 600 }
                    : {
                        bgcolor: alpha(t.palette.text.secondary, 0.16),
                        color: t.palette.mode === 'light' ? 'text.primary' : 'text.secondary',
                      }),
                })}
              >
                {chipLabel(p.title)}
              </Box>
            </Box>
          ) : null,
        )}
      </Box>
      <Box
        sx={(t) => ({
          height: 3,
          borderRadius: '3px',
          bgcolor: alpha(t.palette.text.secondary, 0.16),
        })}
      >
        <Box
          sx={{
            width: `${sections.length ? ((index + 1) / sections.length) * 100 : 0}%`,
            height: '100%',
            borderRadius: '3px',
            bgcolor: 'text.primary',
          }}
        />
      </Box>
    </Box>
  );
}

function SideCards({
  note,
  aging,
  fromCalendar,
  f,
  today,
  valuation,
  newest,
}: {
  note: ResearchNote;
  /** The note's dates with the calendar's review triggers added. */
  aging: Aging;
  fromCalendar: boolean;
  f: Freshness;
  today: string;
  valuation: ValuationBlock | null;
  /** The ticker's newest note: only it reads what was filed since. */
  newest: boolean;
}) {
  const next = upcoming(aging.events, today, 3650)[0] ?? null;
  const due = [
    ...aging.events
      .filter((e) => !e.resolved && e.when.end && e.when.end >= today)
      .map((e) =>
        e.label === ESTIMATE_TRIGGER
          ? { date: e.when.start ?? (e.when.end as string), label: `${e.label} (${e.when.label})` }
          : e.label === FOMC_TRIGGER
            ? { date: e.when.end as string, label: `${e.label} · moves the discount rate` }
            : { date: e.when.end as string, label: e.label },
      ),
    ...(note.aging.priceAsOf && !f.priceStale
      ? [{ date: shiftDays(note.aging.priceAsOf, 30), label: 'Price turns 30 days old' }]
      : []),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const label = { fontSize: 11 } as const;
  return (
    <>
      {next && (
        <Panel sx={{ display: 'grid', gap: 0.5 }}>
          <Eyebrow sx={label}>
            Next up ·{' '}
            {next.inDays <= 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`}
          </Eyebrow>
          <Box component="span" sx={{ fontWeight: 600, fontSize: 15 }}>
            {next.label}
          </Box>
          <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
            {next.whenLabel}
          </Box>
        </Panel>
      )}
      {f.state !== 'archived' && due.length > 0 && (
        <Panel sx={{ display: 'grid', gap: 1 }}>
          <Eyebrow sx={label}>This note comes due</Eyebrow>
          {/* The board's `.drows` (`final-note-production`, `design/src/lib.mjs:55-56`): each date a
              12px row at 1.5 between hairline rules, 6px above and below, the date in steel Mono
              (fidelity R3; the rows had no rules and sat 6px apart at 13px). */}
          <Box
            component="ol"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', fontSize: 12, lineHeight: 1.5 }}
          >
            {due.map((d) => (
              <Box
                component="li"
                key={`${d.date}-${d.label}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '56px minmax(0, 1fr)',
                  gap: 1,
                  alignItems: 'baseline',
                  py: '6px',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
                  {formatShortDate(d.date)}
                </Box>
                <span>{d.label}</span>
              </Box>
            ))}
          </Box>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}>
            {fromCalendar
              ? "After the first date, this page names what happened since. Worked out in your browser from the note's own dates and the published release calendar."
              : "After the first date, this page names what happened since. Worked out in your browser from the note's own dates."}
          </Box>
        </Panel>
      )}
      {/* Beside what makes the note due, the filings that would (fidelity NO-4 A, owner 2026-10-25). */}
      {newest && <FiledSinceCard ticker={note.ticker} />}
      {valuation?.uncertainty && (
        <Panel sx={{ display: 'grid', gap: 1 }}>
          <Eyebrow sx={label}>
            Why uncertainty is {UNCERTAINTY_LABEL[valuation.uncertainty].toLowerCase()}
          </Eyebrow>
          {valuation.uncertaintyWhy && (
            <Box component="span" sx={{ fontSize: 13, lineHeight: 1.5 }}>
              <NoteInlines nodes={valuation.uncertaintyWhy} />
            </Box>
          )}
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}>
            That is why the value range is wide: {money(valuation.result.range.lo)} to{' '}
            {money(valuation.result.range.hi)} a share.
          </Box>
        </Panel>
      )}
      <Panel
        sx={(t) => ({
          display: 'grid',
          gap: 1,
          bgcolor: 'transparent',
          borderStyle: 'dashed',
          borderColor: alpha(t.palette.text.secondary, 0.4),
        })}
      >
        <Eyebrow sx={label}>Your stance, target, position</Eyebrow>
        {note.stance || note.target !== null || note.position ? (
          <Box component="ul" sx={{ m: 0, pl: 2.25, fontSize: 13, display: 'grid', gap: 0.25 }}>
            <li>Stance: {note.stance ? STANCE_LABEL[note.stance] : 'not set'}</li>
            <li>
              Target:{' '}
              {note.target !== null && note.targetDate
                ? `${money(note.target)} by ${formatNoteDate(note.targetDate)}`
                : 'not set'}
            </li>
            <li>Position: {note.position ?? 'not stated'}</li>
          </Box>
        ) : (
          <Box component="span" sx={{ fontSize: 14 }}>
            Not set yet.
          </Box>
        )}
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
          These are the author's own calls, set in the note's front matter. Nothing on this page
          sets them.
        </Box>
      </Panel>
    </>
  );
}

function shiftDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

export function NoteView({
  note,
  kind,
  latest,
  filed = [],
  calendar = null,
}: {
  note: ResearchNote;
  /** "Initiation · first note", "Update", … */
  kind: string;
  /** The ticker's newest note when this one is older; null when this is the newest. */
  latest: { slug: string; date: string } | null;
  /** Results and quarterly filings made since the note that it doesn't cite: each makes it due. */
  filed?: { date: string; label: string }[];
  /** The release calendar's review triggers (the newest note only): FOMC days and the API's
   *  estimated results windows. */
  calendar?: CalendarInputs | null;
}) {
  const today = useMemo(() => localToday(), []);
  const blocks = allBlocks(note);
  const valuation =
    (blocks.find((b) => b.type === 'valuation') as ValuationBlock | undefined) ?? null;
  const triggers = calendar
    ? calendarTriggers({
        note: {
          ticker: note.ticker,
          date: note.date,
          valued: valuation !== null,
          aging: note.aging,
        },
        today,
        ...calendar,
      })
    : [];
  const aging = withCalendar(note.aging, triggers);
  const f = freshnessOf(aging, {
    today,
    superseded: latest !== null,
    notFollowingSince: note.notFollowingSince,
    filed,
  });
  const strip = note.lead.find((b) => b.type === 'strip');
  const tldr = note.lead.find((b) => b.type === 'tldr');
  const rest = note.lead.filter((b) => !['strip', 'tldr', 'paragraph'].includes(b.type));
  const ids = useMemo(() => note.parts.flatMap((p) => p.sections.map((s) => s.id)), [note]);
  const active = useActiveSection(ids);
  let partNumber = 0;
  return (
    <NoteContext.Provider
      value={{
        today,
        ticker: note.ticker,
        date: note.date,
        freshness: f,
        valuation,
        sources: note.sources,
      }}
    >
      <Box
        component="article"
        aria-labelledby="note-title"
        sx={{ display: 'grid', gap: { xs: 3, md: 4 }, minWidth: 0 }}
      >
        <FreshnessBanner note={note} f={f} today={today} latest={latest} />
        <Header note={note} f={f} today={today} valuation={valuation} kind={kind} />
        {strip?.type === 'strip' && <StripBlock block={strip} />}
        {(valuation || tldr) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2 }}>
            {valuation && (
              <Box sx={{ flex: '999 1 520px', minWidth: 0, display: 'grid' }}>
                <PriceValueFrame
                  data={stripData(valuation)}
                  uncertainty={valuation.uncertainty}
                  priceAgeDays={f.priceAgeDays}
                  priceStale={f.priceStale}
                />
              </Box>
            )}
            {tldr?.type === 'tldr' && (
              <Box sx={{ flex: '1 1 340px', minWidth: 0, display: 'grid' }}>
                <TldrBlock block={tldr} />
              </Box>
            )}
          </Box>
        )}
        {rest.length > 0 && <NoteBody blocks={rest} label={note.title} />}
        <Box
          sx={{
            display: { xs: 'grid', desktop: 'none' },
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 1.5,
            // Each card at its own height: a stretched card spreads its few lines over the row.
            alignItems: 'start',
          }}
        >
          <SideCards
            note={note}
            aging={aging}
            fromCalendar={triggers.length > 0}
            f={f}
            today={today}
            valuation={valuation}
            newest={latest === null}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            // The board's tracks (final/ticker-note.mjs, v4/notes.mjs:8, :21; fidelity DESK-18): rail
            // 220 and side 450 with 40px gaps from 1300px, so 220 / 530 / 450 at 1440, the body
            // taking what wider screens add; a 200px rail and the body below 1300, where the side's
            // cards sit above the parts (the board moves them under the whole note).
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: '200px minmax(0, 1fr)',
              desktop: '220px minmax(0, 1fr) 450px',
            },
            gap: { xs: 3, md: 5 },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: { xs: 'none', md: 'block' }, alignSelf: 'stretch' }}>
            <Rail note={note} active={active} />
          </Box>
          <Box sx={{ minWidth: 0, display: 'grid', gap: 6 }}>
            <PartChips note={note} active={active} />
            {note.parts.map((part, pi) => {
              if (part.title) partNumber += 1;
              return (
                <Box key={pi} sx={{ display: 'grid', gap: 5, minWidth: 0 }}>
                  {part.title && <PartRule n={partNumber} title={part.title} />}
                  {part.intro.length > 0 && (
                    <NoteBody blocks={part.intro} label={part.title ?? note.title} />
                  )}
                  {part.sections.map((s) => (
                    <Box
                      component="section"
                      key={s.id}
                      id={s.id}
                      aria-labelledby={`${s.id}-h`}
                      sx={{ display: 'grid', gap: 2, scrollMarginTop: 96, minWidth: 0 }}
                    >
                      <Box sx={{ display: 'grid', gap: 0.75 }}>
                        <Box
                          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
                        >
                          <Eyebrow>
                            {pad2(s.n)} · {s.label}
                          </Eyebrow>
                          {s.carried && (
                            <Pill sx={{ fontSize: 11 }}>
                              Carried from {formatShortDate(s.carried.from)} · re-confirmed{' '}
                              {formatShortDate(s.carried.reconfirmed)}
                            </Pill>
                          )}
                        </Box>
                        <Box
                          component="h2"
                          id={`${s.id}-h`}
                          sx={{
                            ...DISPLAY,
                            m: 0,
                            fontWeight: 600,
                            fontSize: { xs: 21, md: 26 },
                            lineHeight: 1.2,
                            textWrap: 'balance',
                          }}
                        >
                          <NoteInlines nodes={s.title} />
                        </Box>
                      </Box>
                      <NoteBody blocks={s.blocks} label={s.label} />
                    </Box>
                  ))}
                </Box>
              );
            })}
            <Box
              component="p"
              sx={{ m: 0, fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}
            >
              {NOTE_DISCLAIMER} Figures come from the cited sources as of the dates shown; "calc"
              marks arithmetic on cited figures. Valuation values are computed from the stated
              inputs when the site builds. Stance, target, odds and forecast probabilities are the
              author's own and stay blank until set.
            </Box>
          </Box>
          <Box
            sx={{
              display: { xs: 'none', desktop: 'grid' },
              gap: 1.5,
              position: 'sticky',
              top: 88,
              alignContent: 'start',
              // A sidebar taller than the window can't be sticky, or its last cards are unreachable.
              '@media (max-height: 860px)': { position: 'static' },
            }}
          >
            <SideCards
              note={note}
              aging={aging}
              fromCalendar={triggers.length > 0}
              f={f}
              today={today}
              valuation={valuation}
              newest={latest === null}
            />
          </Box>
        </Box>
      </Box>
    </NoteContext.Provider>
  );
}
