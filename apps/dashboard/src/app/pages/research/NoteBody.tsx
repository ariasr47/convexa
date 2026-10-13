/**
 * Renders a research note's parsed body (types.ts) as React elements. The tree comes from
 * tools/research-notes/notes.mjs, which only ever admits http(s) and same-site links, and nothing
 * here produces HTML from strings, so a note can't inject markup.
 *
 * Note headings shift down one level (## → h3, ### → h4): the page owns h1 and each note title is h2.
 */
import { MONO_FACE } from '@/shared/figure/figureFace';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Fragment, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { NoteBlock, NoteInline, NoteList } from './types';

export function NoteInlines({ nodes }: { nodes: NoteInline[] }): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.text}</Fragment>;
      case 'strong':
        return (
          <Box component="strong" key={index} sx={{ fontWeight: 600 }}>
            <NoteInlines nodes={node.children} />
          </Box>
        );
      case 'em':
        return (
          <em key={index}>
            <NoteInlines nodes={node.children} />
          </em>
        );
      case 'code':
        return (
          <Box
            component="code"
            key={index}
            sx={{
              ...MONO_FACE,
              fontSize: '0.9em',
              px: 0.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            {node.text}
          </Box>
        );
      case 'link':
        return node.href.startsWith('/') ? (
          <Link component={RouterLink} to={node.href} key={index}>
            <NoteInlines nodes={node.children} />
          </Link>
        ) : (
          <Link href={node.href} target="_blank" rel="noopener noreferrer" key={index}>
            <NoteInlines nodes={node.children} />
          </Link>
        );
    }
  });
}

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

function Block({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography
          component={block.level === 2 ? 'h3' : 'h4'}
          variant={block.level === 2 ? 'subtitle1' : 'subtitle2'}
          sx={{ fontWeight: 600, mt: 1 }}
        >
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
        <Box sx={{ overflowX: 'auto', minWidth: 0 }}>
          <Box
            component="table"
            sx={{
              borderCollapse: 'collapse',
              width: '100%',
              '& th, & td': {
                textAlign: 'left',
                verticalAlign: 'top',
                py: 1,
                px: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              },
              '& th': { color: 'text.secondary', fontWeight: 500, fontSize: 13 },
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
                    <Typography component="td" key={c} variant="body2">
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
  }
}

export function NoteBody({ blocks }: { blocks: NoteBlock[] }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
      {blocks.map((block, index) => (
        <Block block={block} key={index} />
      ))}
    </Box>
  );
}
