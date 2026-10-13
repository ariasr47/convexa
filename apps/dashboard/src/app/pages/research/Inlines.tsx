/**
 * Inline text in a research note (types.ts `NoteInline`) as React elements. The tree comes from
 * tools/research-notes/notes.mjs, which only ever admits http(s) and same-site links, and nothing here
 * produces HTML from strings, so a note can't inject markup.
 */
import { MONO_FACE } from '@/shared/figure/figureFace';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Fragment, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { NoteInline } from './types';

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
