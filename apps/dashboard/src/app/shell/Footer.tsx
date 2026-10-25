/**
 * Footer — the site footer (its own UI component; the Figma "Footer", node `85:305`). Extracted from
 * the inline Landing footer so it is standalone, testable, and reusable across full pages.
 *
 * Chrome ONLY: owns no feature data, makes no fetch, opens no SSE. The page-body ↔ footer seam is
 * the shared ArcDivider (redesign-stage-2 §5.2 seam #1), then the
 * ConvexaMark wordmark and the simulated/paper honesty disclaimer (`[no-real-order-path]`).
 *
 * Layout is the Final boards' `v4Footer` (design/src/lib.mjs `.v4-foot-in`): on the one page column
 * (`pageColumnSx`), one wrapping row of the 14px wordmark, the 13px links and the disclaimer (12px,
 * at most 560 wide), pushed right while the row has room; the author and copyright lines each take
 * a line of their own below (fidelity audit 2026-10-25, COL and SITE-08).
 *
 * On the staging demo only, an author line sits above the copyright: who built it, and the
 * engineering post (spec 01, Behaviour › Footer (staging)). Production's footer has no such line.
 */
import { DisclaimerCopy } from '@/shared/copy/disclaimer';
import { isDemoBuild } from '@/shared/lib/demoSite';
import { ArcDivider } from '@/shared/ui/ArcDivider';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { ConvexaMark } from './ConvexaMark';

/** The footer's links: 13px steel, each a 24px-tall target (the board's `.v4-foot-in nav a`). */
const linkSx = {
  color: 'text.secondary',
  width: 'fit-content',
  fontSize: 13,
  lineHeight: 1.5,
  minHeight: 24,
  display: 'inline-flex',
  alignItems: 'center',
} as const;

/** The 12px steel lines: the disclaimer, the author line and the copyright. */
const lineSx = { m: 0, fontSize: 12, lineHeight: 1.5, color: 'text.secondary' } as const;

export function Footer() {
  const demo = isDemoBuild();
  return (
    <Box component="footer" data-testid="site-footer">
      <ArcDivider />
      <Box
        sx={{
          ...pageColumnSx,
          pt: 3,
          pb: 4,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 3,
          rowGap: 1,
        }}
      >
        <ConvexaMark fontSize="14px" />
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', columnGap: 2.5, rowGap: 0.5 }}>
          <Link
            component={RouterLink}
            to="/research"
            underline="hover"
            sx={linkSx}
            data-testid="footer-research-link"
          >
            Research notes
          </Link>
          <Link
            component={RouterLink}
            to="/methodology"
            underline="hover"
            sx={linkSx}
            data-testid="footer-methodology-link"
          >
            How Convexa works
          </Link>
          <Link
            component={RouterLink}
            to="/blog"
            underline="hover"
            sx={linkSx}
            data-testid="footer-blog-link"
          >
            Blog — how we read structure
          </Link>
          <Link
            component={RouterLink}
            to="/settings"
            underline="hover"
            sx={linkSx}
            data-testid="footer-settings-link"
          >
            Settings
          </Link>
          {/* The three trust pages (design/src/screens/final/trust.mjs). The Lab that sat here was
                removed (owner, 2026-10-14): it shipped in neither environment. */}
          <Link
            component={RouterLink}
            to="/credits"
            underline="hover"
            sx={linkSx}
            data-testid="footer-credits-link"
          >
            Sources and credits
          </Link>
          <Link
            component={RouterLink}
            to="/privacy"
            underline="hover"
            sx={linkSx}
            data-testid="footer-privacy-link"
          >
            Privacy
          </Link>
          <Link
            component={RouterLink}
            to="/terms"
            underline="hover"
            sx={linkSx}
            data-testid="footer-terms-link"
          >
            Terms
          </Link>
        </Stack>
        {/* Takes the row's spare width, so the disclaimer sits at the right end while it fits on
            the links' line (1600px and up) and starts its own line below them otherwise. */}
        <Box aria-hidden sx={{ flex: 1 }} />
        <Typography component="p" sx={{ ...lineSx, maxWidth: 560 }} data-testid="footer-disclaimer">
          <DisclaimerCopy />
        </Typography>
        {demo && (
          // The spec's line ends "· GitHub ↗"; that link waits on owner question S1-Q3 (the
          // profile or the repository), so it is left out until answered.
          <Typography
            component="p"
            sx={{ ...lineSx, flex: '1 1 100%' }}
            data-testid="footer-author"
          >
            Built by Rodrigo Arias ·{' '}
            <Link
              component={RouterLink}
              to="/blog/how-convexa-is-built"
              underline="hover"
              sx={{ color: 'text.secondary', fontSize: 'inherit' }}
              data-testid="footer-built-link"
            >
              How it’s built
            </Link>
          </Typography>
        )}
        <Typography
          component="p"
          sx={{ ...lineSx, flex: '1 1 100%' }}
          data-testid="footer-copyright"
        >
          © {new Date().getFullYear()} Convexa. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}

export default Footer;
