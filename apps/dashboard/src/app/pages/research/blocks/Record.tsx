/**
 * Dated blocks: catalysts, kill criteria, forecasts, the change log, an update note's `since` and
 * `moves`, and the numbered sources. Anything that depends on today's date (next up, "outcome not
 * recorded", "awaiting resolution") is worked out here, in the reader's browser.
 */
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { alpha } from '@mui/material/styles';
import { formatNoteDate, INPUT_LABEL } from '../format';
import { NoteInlines } from '../Inlines';
import { useNoteContext } from '../noteContext';
import type { NoteBlock, When } from '../types';
import { HEAD_ROW_SX, MONO, Panel, PANEL_SX, Pill } from '../ui';

type Of<T extends NoteBlock['type']> = Extract<NoteBlock, { type: T }>;

/** How a written date reads: approximate windows get a "~". */
export function whenText(when: When) {
  return when.approx &&
    when.kind !== 'by' &&
    when.kind !== 'ongoing' &&
    when.kind !== 'year' &&
    when.kind !== 'quarter'
    ? `~${when.label}`
    : when.label;
}

const passed = (when: When, today: string) => Boolean(when.end && today > when.end);

function daysUntil(today: string, day: string) {
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = day.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

function inDays(n: number) {
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 14) return `in ${n} days`;
  if (n < 70) return `in ${Math.round(n / 7)} weeks`;
  return `in ${Math.round(n / 30)} months`;
}

export function CatalystsBlock({ block }: { block: Of<'catalysts'> }) {
  const { today } = useNoteContext();
  const nextIndex = block.items.findIndex((c) => !c.outcome && c.when.end && c.when.end >= today);
  return (
    <Box
      component="ol"
      sx={{
        ...PANEL_SX,
        listStyle: 'none',
        m: 0,
        p: 2.5,
        pb: 0.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {block.items.map((c, i) => {
        const isNext = i === nextIndex;
        const gone = !c.outcome && passed(c.when, today);
        const last = i === block.items.length - 1;
        const start = c.when.start ?? c.when.end;
        const chip = c.outcome
          ? 'Outcome recorded'
          : gone
            ? 'Outcome not recorded'
            : isNext && start
              ? `Next up · ${inDays(daysUntil(today, start))}`
              : c.status === 'confirmed'
                ? 'Confirmed'
                : c.status === 'target'
                  ? 'Company target'
                  : 'Expected';
        return (
          <Box
            component="li"
            key={i}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '84px 16px minmax(0, 1fr)',
                sm: '120px 20px minmax(0, 1fr)',
              },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <Box
              component="span"
              sx={{
                ...MONO,
                fontSize: 12,
                color: isNext ? 'text.primary' : 'text.secondary',
                pt: '2px',
                textAlign: 'right',
              }}
            >
              {whenText(c.when)}
            </Box>
            <Box
              component="span"
              aria-hidden
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                alignSelf: 'stretch',
              }}
            >
              <Box
                component="span"
                sx={(t) => ({
                  width: 12,
                  height: 12,
                  mt: '4px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  ...(isNext
                    ? {
                        bgcolor: 'text.primary',
                        boxShadow: `0 0 0 4px ${alpha(t.palette.text.primary, 0.16)}`,
                      }
                    : c.outcome || c.status === 'confirmed'
                      ? { bgcolor: 'text.secondary' }
                      : { border: `2px solid ${t.palette.text.secondary}` }),
                })}
              />
              {!last && (
                <Box
                  component="span"
                  sx={(t) => ({
                    flexGrow: 1,
                    width: 2,
                    mt: 0.5,
                    bgcolor: alpha(t.palette.text.secondary, 0.22),
                  })}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 2.25, minWidth: 0 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Box component="span" sx={{ fontWeight: 600, fontSize: 14 }}>
                  {c.event}
                </Box>
                <Pill variant={gone ? 'dashed' : isNext ? 'strong' : 'quiet'} sx={{ fontSize: 11 }}>
                  {chip}
                </Pill>
              </Box>
              <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}>
                <NoteInlines nodes={c.detail} />
              </Box>
              {c.outcome && (
                <Box component="span" sx={{ fontSize: 13, lineHeight: 1.5 }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    Outcome:{' '}
                  </Box>
                  <NoteInlines nodes={c.outcome} />
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Table({
  label,
  columns,
  head,
  children,
}: {
  label: string;
  columns: string;
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <Box role="table" aria-label={label} sx={{ ...PANEL_SX, overflow: 'hidden' }}>
      <Box
        role="row"
        sx={(t) => ({
          ...HEAD_ROW_SX(t),
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: columns,
          gap: 1.5,
          px: 2.25,
          py: 1.25,
        })}
      >
        {head.map((h) => (
          <Box role="columnheader" key={h} component="span">
            {h}
          </Box>
        ))}
      </Box>
      {children}
    </Box>
  );
}

const rowSx = (columns: string) =>
  ({
    display: 'grid',
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: columns },
    gap: { xs: 0.5, md: 1.5 },
    px: 2.25,
    py: 1.5,
    borderTop: 1,
    borderColor: 'divider',
    fontSize: 13,
    lineHeight: 1.5,
    alignItems: 'start',
  }) as const;

export function KillBlock({ block }: { block: Of<'kill'> }) {
  const { today } = useNoteContext();
  const columns = '40px 1.3fr 1fr 0.8fr 110px 1fr';
  return (
    <Table
      label="Kill criteria"
      columns={columns}
      head={['#', 'Trigger', 'Threshold', 'Source', 'Check by', 'Then']}
    >
      {block.items.map((k) => {
        const unchecked = !k.outcome && passed(k.checkBy, today);
        return (
          <Box role="row" key={k.n} sx={rowSx(columns)}>
            <Box role="cell" component="span" sx={{ ...MONO, color: 'text.secondary' }}>
              {k.n}
            </Box>
            <Box role="cell" component="span" sx={{ fontWeight: 600 }}>
              {k.trigger}
            </Box>
            <Box role="cell" component="span">
              <NoteInlines nodes={k.threshold} />
            </Box>
            <Box role="cell" component="span" sx={{ color: 'text.secondary' }}>
              {k.source}
            </Box>
            <Box
              role="cell"
              sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}
            >
              <Box component="span" sx={{ ...MONO, fontSize: 12 }}>
                {whenText(k.checkBy)}
              </Box>
              {unchecked && (
                <Pill variant="dashed" sx={{ fontSize: 11 }}>
                  Not checked
                </Pill>
              )}
            </Box>
            <Box role="cell" component="span" sx={{ color: 'text.secondary' }}>
              {k.outcome ? (
                <Box component="span" sx={{ color: 'text.primary' }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    Checked:{' '}
                  </Box>
                  <NoteInlines nodes={k.outcome} />
                </Box>
              ) : (
                <NoteInlines nodes={k.then} />
              )}
            </Box>
          </Box>
        );
      })}
    </Table>
  );
}

export function ForecastsBlock({ block }: { block: Of<'forecasts'> }) {
  const { today } = useNoteContext();
  return (
    <Box sx={{ ...PANEL_SX, overflow: 'hidden' }}>
      {block.items.map((f, i) => {
        const waiting = !f.outcome && passed(f.resolveBy, today);
        return (
          <Box
            key={i}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) 170px 120px' },
              gap: 1.5,
              px: 2.25,
              py: 1.75,
              borderTop: i === 0 ? 0 : 1,
              borderColor: 'divider',
              alignItems: 'center',
              fontSize: 14,
            }}
          >
            <span>
              <NoteInlines nodes={f.claim} />
            </span>
            <Box
              component="span"
              sx={{ gridRow: { xs: 2, md: 'auto' }, fontSize: 12, color: 'text.secondary' }}
            >
              {f.outcome
                ? f.outcome === 'void'
                  ? 'Voided'
                  : `Resolved ${f.outcome === 'yes' ? 'yes' : 'no'}${f.brier !== null ? ` · Brier ${f.brier.toFixed(2)}` : ''}`
                : waiting
                  ? 'Awaiting resolution'
                  : `resolves ${whenText(f.resolveBy)}`}
            </Box>
            <Box
              component="span"
              sx={{ justifySelf: 'end', gridRow: { xs: '1 / span 2', md: 'auto' } }}
            >
              {f.p === null ? (
                <Pill variant="dashed" sx={{ ...MONO, fontSize: 12 }}>
                  P · yours
                </Pill>
              ) : (
                <Pill variant="strong" sx={{ ...MONO, fontSize: 12 }}>
                  P {f.p.toFixed(2)}
                </Pill>
              )}
            </Box>
          </Box>
        );
      })}
      <Box
        sx={(t) => ({
          ...HEAD_ROW_SX(t),
          textTransform: 'none',
          letterSpacing: 0,
          fontFamily: 'inherit',
          fontSize: 12,
          px: 2.25,
          py: 1.25,
        })}
      >
        Probabilities are the author's to set. Each forecast is scored with a Brier score once it
        resolves.
      </Box>
    </Box>
  );
}

const KIND_WORD = {
  initiation: 'Initiation',
  update: 'Update',
  outcome: 'Outcome',
  revision: 'Revision',
  'roll-forward': 'Roll-forward',
  correction: 'Correction',
} as const;

export function ChangelogBlock({ block }: { block: Of<'changelog'> }) {
  return (
    <Box sx={{ ...PANEL_SX, overflow: 'hidden' }}>
      {block.items.map((c, i) => (
        <Box
          key={i}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', sm: '120px 112px minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'baseline',
            px: 2.25,
            py: 1.5,
            borderTop: i === 0 ? 0 : 1,
            borderColor: 'divider',
            fontSize: 13,
          }}
        >
          <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
            {formatNoteDate(c.date)}
          </Box>
          <Box component="span">
            <Pill
              variant={c.kind === 'revision' || c.kind === 'correction' ? 'strong' : 'quiet'}
              sx={{ fontSize: 11 }}
            >
              {KIND_WORD[c.kind]}
            </Pill>
          </Box>
          <Box component="span" sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <NoteInlines nodes={c.text} />
          </Box>
        </Box>
      ))}
      <Box
        sx={(t) => ({
          ...HEAD_ROW_SX(t),
          textTransform: 'none',
          letterSpacing: 0,
          fontFamily: 'inherit',
          fontSize: 12,
          px: 2.25,
          py: 1.25,
          lineHeight: 1.55,
        })}
      >
        Outcome: a catalyst resolved · Revision: a judgment moved (trigger, old → new, why) ·
        Roll-forward: automatic, like the valuation date moving · Correction: an error fixed, and
        said so. A full update is a new note.
      </Box>
    </Box>
  );
}

const SINCE_WORD = {
  catalyst: 'Catalyst',
  forecast: 'Forecast',
  kill: 'Kill criterion',
  pillar: 'Pillar',
} as const;

export function SinceBlock({ block }: { block: Of<'since'> }) {
  const columns = '120px 1.3fr 1.2fr';
  return (
    <Table
      label="The previous note's calls, scored"
      columns={columns}
      head={['Call', 'Made in the last note', 'What happened']}
    >
      {block.items.map((s, i) => (
        <Box role="row" key={i} sx={rowSx(columns)}>
          <Box role="cell" component="span" sx={{ color: 'text.secondary' }}>
            {SINCE_WORD[s.kind]}
          </Box>
          <Box role="cell" component="span" sx={{ fontWeight: 500 }}>
            <NoteInlines nodes={s.call} />
          </Box>
          <Box role="cell" component="span">
            <NoteInlines nodes={s.outcome} />
          </Box>
        </Box>
      ))}
    </Table>
  );
}

const inputLabel = (input: string) => {
  const [scenario, key] = input.includes('.') ? input.split('.') : [null, input];
  const name =
    INPUT_LABEL[key] ??
    (key === 'odds' ? 'Scenario odds' : key.charAt(0).toUpperCase() + key.slice(1));
  return scenario ? `${scenario.charAt(0).toUpperCase() + scenario.slice(1)} · ${name}` : name;
};

export function MovesBlock({ block }: { block: Of<'moves'> }) {
  const columns = '1.1fr 1fr 0.9fr 1.2fr';
  return (
    <Table
      label="Judgments that moved"
      columns={columns}
      head={['Input', 'Old → new', 'Trigger', 'Why']}
    >
      {block.items.map((m, i) => (
        <Box role="row" key={i} sx={rowSx(columns)}>
          <Box role="cell" component="span" sx={{ fontWeight: 600 }}>
            {inputLabel(m.input)}
          </Box>
          <Box role="cell" component="span" sx={{ ...MONO, fontSize: 12 }}>
            {m.change}
          </Box>
          <Box role="cell" component="span" sx={{ color: 'text.secondary' }}>
            {m.trigger}
          </Box>
          <Box role="cell" component="span">
            <NoteInlines nodes={m.why} />
          </Box>
        </Box>
      ))}
    </Table>
  );
}

export function SourcesBlock({ block }: { block: Of<'sources'> }) {
  return (
    <Panel component="ol" sx={{ listStyle: 'none', m: 0, display: 'grid', gap: 1 }}>
      {block.items.map((s) => (
        <Box
          component="li"
          key={s.n}
          id={`source-${s.n}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '36px minmax(0, 1fr)', sm: '40px 130px minmax(0, 1fr)' },
            gap: 1.5,
            alignItems: 'baseline',
            fontSize: 14,
          }}
        >
          <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
            [{s.n}]
          </Box>
          <Box
            component="span"
            sx={{
              ...MONO,
              fontSize: 12,
              color: 'text.secondary',
              display: { xs: 'none', sm: 'block' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {s.host}
          </Box>
          <Link
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {s.title}
          </Link>
        </Box>
      ))}
    </Panel>
  );
}
