/** Judgment blocks: the variant view, the thesis scorecard, the moat check, the case for and against,
 *  and the pre-mortem. Status is a word plus a glyph, never colour alone. */
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { NoteInlines } from '../Inlines';
import type { NoteBlock } from '../types';
import { HEAD_ROW_SX, MONO, Panel, PANEL_SX, YourCall } from '../ui';

type Of<T extends NoteBlock['type']> = Extract<NoteBlock, { type: T }>;

/** A bordered table that becomes stacked cards under `stackBelow` px of viewport. */
function Grid({
  columns,
  head,
  rows,
  label,
}: {
  columns: string;
  head: string[];
  rows: React.ReactNode[][];
  label: string;
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
      {rows.map((cells, r) => (
        <Box
          role="row"
          key={r}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: columns },
            gap: { xs: 0.75, md: 1.5 },
            px: 2.25,
            py: 1.5,
            borderTop: r === 0 ? { xs: 0, md: 1 } : 1,
            borderColor: 'divider',
            fontSize: 13,
            lineHeight: 1.5,
            alignItems: 'start',
          }}
        >
          {cells.map((cell, c) => (
            <Box
              role="cell"
              key={c}
              sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}
            >
              <Box
                component="span"
                sx={{
                  display: { xs: c === 0 ? 'none' : 'block', md: 'none' },
                  ...MONO,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}
              >
                {head[c]}
              </Box>
              {cell}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

const quiet = { color: 'text.secondary' } as const;
const strong = { fontWeight: 600 } as const;

export function VariantBlock({ block }: { block: Of<'variant'> }) {
  return (
    <Grid
      label="Your view against what the price implies"
      columns="140px 1.2fr 0.8fr 1.2fr"
      head={['Driver', 'The price implies', 'Your view', 'What settles it']}
      rows={block.items.map((v) => [
        <Box component="span" sx={strong}>
          {v.driver}
        </Box>,
        <span>
          <NoteInlines nodes={v.implied} />
        </span>,
        v.view.length ? (
          <span>
            <NoteInlines nodes={v.view} />
          </span>
        ) : (
          <span>
            <YourCall />
          </span>
        ),
        <Box component="span" sx={quiet}>
          <NoteInlines nodes={v.settles} />
        </Box>,
      ])}
    />
  );
}

// A status is a glyph, a word and a weight, never a hue: green and red are reserved for money moving
// (canon Banned: green/red on status chips). Broken is the loudest, as a solid fill.
const STATUS: Record<'ok' | 'watch' | 'broken', { word: string; sx: (t: Theme) => object }> = {
  ok: {
    word: '✓ On track',
    sx: (t) => ({
      color: t.palette.text.primary,
      boxShadow: `inset 0 0 0 1px ${alpha(t.palette.text.secondary, 0.45)}`,
    }),
  },
  watch: {
    word: '! Watch',
    sx: (t) => ({ color: t.palette.text.primary, bgcolor: alpha(t.palette.text.secondary, 0.18) }),
  },
  broken: {
    word: '✕ Broken',
    sx: (t) => ({ color: t.palette.background.default, bgcolor: t.palette.text.primary }),
  },
};

export function StatusPill({ status }: { status: 'ok' | 'watch' | 'broken' }) {
  return (
    <Box
      component="span"
      sx={(t) => ({
        alignSelf: 'flex-start',
        px: 1,
        py: '2px',
        borderRadius: '999px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...STATUS[status].sx(t),
      })}
    >
      {STATUS[status].word}
    </Box>
  );
}

export function ScorecardBlock({ block }: { block: Of<'scorecard'> }) {
  return (
    <Grid
      label="Thesis scorecard"
      columns="1.3fr 1.1fr 0.9fr 110px 1.3fr"
      head={['Pillar', 'Metric', 'Latest', 'Status', 'Kill criterion']}
      rows={block.items.map((p) => [
        <Box component="span" sx={strong}>
          {p.pillar}
        </Box>,
        <Box component="span" sx={quiet}>
          {p.metric}
        </Box>,
        <Box component="span" sx={{ ...MONO, fontSize: 12 }}>
          {p.latest}
        </Box>,
        <StatusPill status={p.status} />,
        <Box component="span" sx={quiet}>
          <NoteInlines nodes={p.kill} />
        </Box>,
      ])}
    />
  );
}

const MOAT_WORD = { evidence: 'Some evidence', unproven: 'Unproven', none: 'None seen' } as const;

export function MoatBlock({ block }: { block: Of<'moat'> }) {
  return (
    <Panel sx={{ display: 'grid', gap: 1 }}>
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        Morningstar's five moat sources, checked against the evidence
      </Box>
      {block.items.map((m) => (
        <Box
          key={m.source}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr auto', sm: '130px 112px minmax(0, 1fr)' },
            gap: 1.25,
            alignItems: 'baseline',
            fontSize: 13,
            pt: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box component="span" sx={strong}>
            {m.source}
          </Box>
          <Box
            component="span"
            sx={(t) => ({
              justifySelf: 'start',
              px: 1,
              py: '2px',
              borderRadius: '999px',
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: m.status === 'evidence' ? 'text.primary' : 'text.secondary',
              bgcolor:
                m.status === 'evidence' ? alpha(t.palette.text.secondary, 0.18) : 'transparent',
              border:
                m.status === 'evidence'
                  ? '1px solid transparent'
                  : `1px dashed ${alpha(t.palette.text.secondary, 0.45)}`,
            })}
          >
            {MOAT_WORD[m.status]}
          </Box>
          <Box
            component="span"
            sx={{
              gridColumn: { xs: '1 / -1', sm: 'auto' },
              fontSize: 12,
              color: 'text.secondary',
              lineHeight: 1.45,
            }}
          >
            <NoteInlines nodes={m.why} />
          </Box>
        </Box>
      ))}
    </Panel>
  );
}

function CaseSide({ side, items }: { side: 'for' | 'against'; items: Of<'case'>['items'] }) {
  const isFor = side === 'for';
  return (
    <Panel sx={{ p: 2.5, display: 'grid', gap: 1.75, alignContent: 'start' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          component="span"
          aria-hidden
          sx={(t) => ({
            width: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: alpha(t.palette.text.secondary, 0.16),
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
          })}
        >
          {isFor ? '▲' : '▼'}
        </Box>
        <Box component="h3" sx={{ m: 0, fontWeight: 600, fontSize: 16 }}>
          {isFor ? 'Case for' : 'Strongest case against'}
        </Box>
      </Box>
      {items.map((p, i) => (
        <Box
          key={i}
          sx={{
            display: 'grid',
            gridTemplateColumns: '12px minmax(0, 1fr)',
            gap: 1.25,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={(t) => ({
              width: 8,
              height: 8,
              mt: '8px',
              borderRadius: '50%',
              boxSizing: 'border-box',
              // For is a filled dot, against a ring: the side reads by shape, never by hue.
              ...(isFor
                ? { bgcolor: 'text.primary' }
                : { border: `1.5px solid ${t.palette.text.secondary}` }),
            })}
          />
          <span>
            <Box component="span" sx={strong}>
              <NoteInlines nodes={p.head} />
            </Box>{' '}
            <Box component="span" sx={quiet}>
              <NoteInlines nodes={p.body} />
            </Box>
          </span>
        </Box>
      ))}
    </Panel>
  );
}

export function CaseBlock({ block }: { block: Of<'case'> }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      <CaseSide side="for" items={block.items.filter((i) => i.side === 'for')} />
      <CaseSide side="against" items={block.items.filter((i) => i.side === 'against')} />
    </Box>
  );
}

export function PremortemBlock({ block }: { block: Of<'premortem'> }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
      {block.items.map((p, i) => (
        <Box
          component="li"
          key={i}
          sx={{
            ...PANEL_SX,
            px: 2.25,
            py: 1.75,
            display: 'grid',
            gridTemplateColumns: { xs: '24px minmax(0, 1fr)', sm: '28px minmax(0, 1fr) 150px' },
            gap: 1.5,
            alignItems: 'baseline',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
            {i + 1}
          </Box>
          <span>
            <NoteInlines nodes={p.story} />
          </span>
          {p.kill && (
            <Box
              component="span"
              sx={{
                gridColumn: { xs: '2', sm: 'auto' },
                fontSize: 12,
                color: 'text.secondary',
                textAlign: { sm: 'right' },
              }}
            >
              → kill criterion {p.kill}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
