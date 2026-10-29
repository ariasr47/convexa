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
 * On the staging demo only, an author line sits above the copyright: who built it, the engineering
 * post and the public repository (spec 01, Behaviour › Footer (staging); owner answer S1-Q3,
 * 2026-10-25: the repository, not the profile). Production's footer has no such line.
 *
 * The copyright line names Convexa's version in both builds (owner, 2026-10-28): the root
 * package.json's, inlined at build time (shared/lib/version.ts).
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { DisclaimerCopy } from '@/shared/copy/disclaimer';
import { MONO_FACE } from '@/shared/figure/figureFace';
import { isDemoBuild } from '@/shared/lib/demoSite';
import { CONVEXA_VERSION } from '@/shared/lib/version';
import { ArcDivider } from '@/shared/ui/ArcDivider';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { coarseFloor } from '@/shared/ui/touch';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { ConvexaMark } from './ConvexaMark';

/**
 * The footer's links: 13px steel, each a 24px-tall target at a fine pointer (the board's
 * `.v4-foot-in nav a`). The local `minHeight: 24` is a class rule, so it beats the theme's
 * element-selector touch floor; `coarseFloor` puts the 44px back under a coarse pointer (canon
 * rule 7; `shared/ui/touch.ts`).
 */
const linkSx = {
  color: 'text.secondary',
  width: 'fit-content',
  fontSize: 13,
  lineHeight: 1.5,
  minHeight: 24,
  display: 'inline-flex',
  alignItems: 'center',
  ...coarseFloor,
} as const;

/** The 12px steel lines: the disclaimer, the author line and the copyright. */
const lineSx = { m: 0, fontSize: 12, lineHeight: 1.5, color: 'text.secondary' } as const;

/** The repository the staging footer's "GitHub ↗" opens (owner answer S1-Q3, 2026-10-25). */
const REPOSITORY_URL = 'https://github.com/ariasr47/convexa';

/**
 * The author line's links: steel, inline in the 12px line at a fine pointer, as the board's
 * `FINAL_AUTHOR` draws them (design/src/lib.mjs). An inline anchor ignores `min-height`, so under a
 * coarse pointer each one becomes a 44px-tall inline box (canon rule 7; `shared/ui/touch.ts`).
 */
const authorLinkSx = {
  color: 'text.secondary',
  fontSize: 'inherit',
  '@media (pointer: coarse)': { display: 'inline-flex', alignItems: 'center', minHeight: 44 },
} as const;

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
              sx={authorLinkSx}
              data-testid="footer-built-link"
            >
              How it’s built
            </Link>{' '}
            · {/* A new tab with the ↗ mark, as PrivacyPage's external link (spec 01 step 4). */}
            <Link
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={authorLinkSx}
              data-testid="footer-github-link"
            >
              GitHub ↗
            </Link>
          </Typography>
        )}
        <Typography
          component="p"
          sx={{ ...lineSx, flex: '1 1 100%' }}
          data-testid="footer-copyright"
        >
          © {new Date().getFullYear()} Convexa{' '}
          {/* The version is Convexa's own figure, so Mono (canon rule 23), at the line's size and
              colour. A screen reader hears "Convexa version" and the number, not "v" and the
              number: an aria-label on a role-less span is prohibited and ignored (NotFound.tsx's
              ⌘K), so the drawn "v…" is hidden from it and a visually hidden "version …" is read.
              That one is unselectable, so a copied line reads as drawn. */}
          <Box component="span" aria-hidden sx={MONO_FACE} data-testid="footer-version">
            v{CONVEXA_VERSION}
          </Box>
          <Box component="span" sx={{ ...visuallyHidden, userSelect: 'none' }}>
            version {CONVEXA_VERSION}
          </Box>
          . All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}

export default Footer;
