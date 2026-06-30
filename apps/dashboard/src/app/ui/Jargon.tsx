/**
 * Jargon — a dotted, help-cursor jargon-tooltip term (ARCHITECTURE §2.2). A decorative inline `span`
 * with a dotted underline that surfaces a plain-language glossary string on hover/focus via MUI
 * `Tooltip`. NO navigation, NO data, NO fetch — purely presentational.
 *
 * Reusable across surfaces (Landing value props, the Ticker tiles, etc.): the caller supplies the
 * VERBATIM glossary copy (the honesty floor lives in the copy, not here).
 */
import { Box, Tooltip } from '@mui/material';

export interface JargonProps {
  /** The visible (underlined) term. */
  term: React.ReactNode;
  /** The plain-language glossary string shown in the tooltip (caller-supplied, verbatim). */
  gloss: string;
}

export function Jargon({ term, gloss }: JargonProps) {
  return (
    <Tooltip arrow title={gloss}>
      <Box component="span" data-testid="jargon" sx={{ borderBottom: '1px dotted', cursor: 'help' }}>
        {term}
      </Box>
    </Tooltip>
  );
}

export default Jargon;
