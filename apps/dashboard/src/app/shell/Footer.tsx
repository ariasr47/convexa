/**
 * Footer — the site footer (its own UI component; the Figma "Footer", node `85:305`). Extracted from
 * the inline Landing footer so it is standalone, testable, and reusable across full pages.
 *
 * Chrome ONLY: owns no feature data, makes no fetch, opens no SSE. The page-body ↔ footer seam is
 * the shared ArcDivider (redesign-stage-2 §5.2 seam #1 — a named seam pin in arc.spec.ts), then the
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
            {/* (v2) Lab demoted from the top nav to the footer (canon rule 19, AC-23) — still
                reachable, just not a product-spine link. */}
            <Link
              component={RouterLink}
              to="/lab"
              variant="caption"
              underline="hover"
              sx={{ color: 'text.secondary', width: 'fit-content' }}
              data-testid="footer-lab-link"
            >
              Lab — instrument demos
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
