/**
 * Renders a research note's parsed blocks (types.ts) as React elements: plain Markdown here, named
 * blocks through ./blocks. The tree comes from tools/research-notes/notes.mjs, which only ever admits
 * http(s) and same-site links, and nothing here produces HTML from strings, so a note can't inject
 * markup. A section's `###` renders as h3 (the page owns h1, each section heading is h2).
 */
import { MONO_FACE } from '@/shared/figure/figureFace';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { BridgeBlock, ChartBlock, CompareBlock, SplitBlock, UnitsBlock } from './blocks/Charts';
import { MetricsBlock, StripBlock, TldrBlock } from './blocks/Figures';
import {
  CaseBlock,
  MoatBlock,
  PremortemBlock,
  ScorecardBlock,
  VariantBlock,
} from './blocks/Judgment';
import {
  CatalystsBlock,
  ChangelogBlock,
  ForecastsBlock,
  KillBlock,
  MovesBlock,
  SinceBlock,
  SourcesBlock,
} from './blocks/Record';
import { ImpliedBlockView, ValuationBlockView } from './blocks/Valuation';
import { NoteInlines } from './Inlines';
import type { NoteBlock, NoteList } from './types';

export { NoteInlines };

function List({ list }: { list: NoteList }) {
  return (
    <Box component={list.ordered ? 'ol' : 'ul'} sx={{ pl: 3, my: 0, display: 'grid', gap: 0.75 }}>
      {list.items.map((item, index) => (
        <Typography component="li" key={index}>
          <NoteInlines nodes={item.children} />
          {item.list && (
            <Box sx={{ mt: 0.75 }}>
              <List list={item.list} />
            </Box>
          )}
        </Typography>
      ))}
    </Box>
  );
}

export function Block({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
          <NoteInlines nodes={block.children} />
        </Typography>
      );
    case 'paragraph':
      return (
        <Typography>
          <NoteInlines nodes={block.children} />
        </Typography>
      );
    case 'list':
      return <List list={block} />;
    case 'quote':
      return (
        <Box
          component="blockquote"
          sx={{
            m: 0,
            pl: 2,
            borderLeft: 2,
            borderColor: 'divider',
            color: 'text.secondary',
            display: 'grid',
            gap: 1,
          }}
        >
          {block.children.map((child, index) => (
            <Block block={child} key={index} />
          ))}
        </Box>
      );
    case 'codeblock':
      return (
        <Box
          component="pre"
          sx={{
            ...MONO_FACE,
            m: 0,
            p: 1.5,
            fontSize: 13,
            borderRadius: 2,
            bgcolor: 'action.hover',
            overflowX: 'auto',
          }}
        >
          {block.text}
        </Box>
      );
    case 'table':
      return (
        <Box
          sx={{
            overflowX: 'auto',
            minWidth: 0,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '12px',
          }}
        >
          <Box
            component="table"
            sx={{
              borderCollapse: 'collapse',
              width: '100%',
              '& th, & td': { textAlign: 'left', verticalAlign: 'top', py: 1.25, px: 2 },
              '& tbody tr': { borderTop: 1, borderColor: 'divider' },
              '& th': {
                ...MONO_FACE,
                color: 'text.secondary',
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                bgcolor: (t) => extrasFor(t).well,
              },
              '& td:first-of-type': { fontWeight: 600 },
            }}
          >
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index} scope="col">
                    <NoteInlines nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <Typography
                      component="td"
                      key={c}
                      variant="body2"
                      sx={{ color: c === 0 ? 'text.primary' : 'text.secondary' }}
                    >
                      <NoteInlines nodes={cell} />
                    </Typography>
                  ))}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      );
    case 'rule':
      return <Box component="hr" sx={{ border: 0, borderTop: 1, borderColor: 'divider', my: 1 }} />;
    case 'strip':
      return <StripBlock block={block} />;
    case 'tldr':
      return <TldrBlock block={block} />;
    case 'metrics':
      return <MetricsBlock block={block} />;
    case 'chart':
      return <ChartBlock block={block} />;
    case 'split':
      return <SplitBlock block={block} />;
    case 'compare':
      return <CompareBlock block={block} />;
    case 'bridge':
      return <BridgeBlock block={block} />;
    case 'units':
      return <UnitsBlock block={block} />;
    case 'implied':
      return <ImpliedBlockView />;
    case 'variant':
      return <VariantBlock block={block} />;
    case 'scorecard':
      return <ScorecardBlock block={block} />;
    case 'moat':
      return <MoatBlock block={block} />;
    case 'case':
      return <CaseBlock block={block} />;
    case 'premortem':
      return <PremortemBlock block={block} />;
    case 'valuation':
      return <ValuationBlockView block={block} />;
    case 'catalysts':
      return <CatalystsBlock block={block} />;
    case 'kill':
      return <KillBlock block={block} />;
    case 'forecasts':
      return <ForecastsBlock block={block} />;
    case 'changelog':
      return <ChangelogBlock block={block} />;
    case 'sources':
      return <SourcesBlock block={block} />;
    case 'since':
      return <SinceBlock block={block} />;
    case 'moves':
      return <MovesBlock block={block} />;
  }
}

export function NoteBody({ blocks }: { blocks: NoteBlock[] }) {
  // `break-word`, not `anywhere`: both break a token only when it can't fit its line (a long URL in
  // prose), but `anywhere` also counts every character as a break when a table sizes its columns,
  // so cells shrank to one or two characters ("T/O/T/A/L", "108/.5") instead of the table scrolling.
  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0, overflowWrap: 'break-word' }}>
      {blocks.map((block, index) => (
        <Block block={block} key={index} />
      ))}
    </Box>
  );
}
