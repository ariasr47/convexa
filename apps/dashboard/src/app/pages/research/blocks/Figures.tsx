/** Figure blocks: the header strip, the 30-second summary, and dated figure tiles. */
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { formatAsOf, labelWithAsOf } from '../format';
import { NoteInlines } from '../Inlines';
import { useNoteContext } from '../noteContext';
import { firstSource, type NoteSource } from '../provenance';
import type { Direction, NoteBlock, NoteInline } from '../types';
import { Eyebrow, MONO, Panel, SourceChip } from '../ui';

type Of<T extends NoteBlock['type']> = Extract<NoteBlock, { type: T }>;

export function StripBlock({ block }: { block: Of<'strip'> }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1px',
        bgcolor: 'divider',
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {block.items.map((item) => (
        <Box
          key={item.label}
          sx={{
            bgcolor: 'background.paper',
            px: 2,
            py: 1.5,
            display: 'grid',
            gap: 0.25,
            minWidth: 0,
          }}
        >
          <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
            {item.label}
          </Box>
          <Box component="span" sx={{ ...MONO, fontSize: 18, fontWeight: 500, lineHeight: 1.3 }}>
            {item.value}
          </Box>
          <Box component="span" sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4 }}>
            {formatAsOf(item.asOf)}
            {item.sub.length > 0 && (
              <>
                {' · '}
                <NoteInlines nodes={item.sub} />
              </>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function TldrBlock({ block }: { block: Of<'tldr'> }) {
  return (
    <Panel
      sx={{ px: 3, py: 2.5, display: 'grid', gap: 1.5 }}
      component="section"
      aria-label="Summary"
    >
      <Eyebrow>TL;DR · 30 seconds</Eyebrow>
      {block.items.map((item, i) => (
        <Box
          key={i}
          sx={{
            display: 'grid',
            gridTemplateColumns: '72px minmax(0, 1fr)',
            gap: 1.75,
            alignItems: 'baseline',
            pt: 1.25,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            component="span"
            sx={{ ...MONO, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            {item.figure}
          </Box>
          <Box component="span" sx={{ fontSize: 14, lineHeight: 1.5 }}>
            <NoteInlines nodes={item.text} />
          </Box>
        </Box>
      ))}
    </Panel>
  );
}

/** A delta pill. A company figure's direction is its arrow; green and red stay reserved for money
 *  moving (P&L, flow, gamma sign), so a company fact is never tinted (canon, 2026-10-13). */
export function DeltaPill({ dir, children }: { dir: Direction; children: string }) {
  return (
    <Box
      component="span"
      sx={(t) => {
        return {
          ...MONO,
          alignSelf: 'flex-start',
          px: 1,
          py: '2px',
          // 10px rounds a one-line pill fully and keeps a wrapped one a soft box: a long delta wraps
          // inside its tile instead of running into the next.
          borderRadius: '10px',
          fontSize: 12,
          fontWeight: 500,
          color: dir === 'flat' ? t.palette.text.secondary : t.palette.text.primary,
          bgcolor: alpha(t.palette.text.secondary, 0.16),
        };
      }}
    >
      {children}
    </Box>
  );
}

export function MetricsBlock({ block }: { block: Of<'metrics'> }) {
  const { sources } = useNoteContext();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 1.5,
      }}
    >
      {block.items.map((item) => (
        <Panel key={item.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            {labelWithAsOf(item.label, item.asOf)}
          </Box>
          <Box component="span" sx={{ ...MONO, fontSize: 26, fontWeight: 500, lineHeight: 1.1 }}>
            {item.value}
          </Box>
          {item.delta && <DeltaPill dir={item.dir}>{item.delta}</DeltaPill>}
          {item.note.length > 0 && (
            <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.45 }}>
              <NoteInlines nodes={item.note} />
            </Box>
          )}
          <MetricSource note={item.note} sources={sources} />
        </Panel>
      ))}
    </Box>
  );
}

/** The figure's first cited source, as a chip under it (none when the figure cites nothing). */
function MetricSource({ note, sources }: { note: NoteInline[]; sources: NoteSource[] }) {
  const source = firstSource(note, sources);
  return source ? <SourceChip source={source} /> : null;
}
