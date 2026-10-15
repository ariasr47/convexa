/**
 * Footer — the site footer (its own UI component; the Figma "Footer", node `85:305`). Extracted from
 * the inline Landing footer so it is standalone, testable, and reusable across full pages.
 *
 * Chrome ONLY: owns no feature data, makes no fetch, opens no SSE. The page-body ↔ footer seam is
 * the shared ArcDivider (redesign-stage-2 §5.2 seam #1), then the
 * ConvexaMark wordmark and the simulated/paper honesty disclaimer (`[no-real-order-path]`). Content
 * constrained to the same `lg` column as the rest of the page.
 */
import { DisclaimerCopy } from '@/shared/copy/disclaimer';
import { ArcDivider } from '@/shared/ui/ArcDivider';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { ConvexaMark } from './ConvexaMark';

export function Footer() {
  return (
    <Box component="footer" data-testid="site-footer">
      <ArcDivider />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1}>
          <ConvexaMark size={16} fontSize="1rem" />
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            <Link
              component={RouterLink}
              to="/research"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-research-link"
            >
              Research notes
            </Link>
            <Link
              component={RouterLink}
              to="/methodology"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-methodology-link"
            >
              How Convexa works
            </Link>
            <Link
              component={RouterLink}
              to="/blog"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-blog-link"
            >
              Blog — how we read structure
            </Link>
            {/* The three trust pages (design/src/screens/final/trust.mjs). The Lab that sat here was
                removed (owner, 2026-10-14): it shipped in neither environment. */}
            <Link
              component={RouterLink}
              to="/credits"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-credits-link"
            >
              Sources and credits
            </Link>
            <Link
              component={RouterLink}
              to="/privacy"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-privacy-link"
            >
              Privacy
            </Link>
            <Link
              component={RouterLink}
              to="/terms"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-terms-link"
            >
              Terms
            </Link>
          </Stack>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
            data-testid="footer-disclaimer"
          >
            <DisclaimerCopy />
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
            data-testid="footer-copyright"
          >
            © {new Date().getFullYear()} Convexa. All rights reserved.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default Footer;
