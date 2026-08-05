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
import { Box, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ConvexaMark } from './ConvexaMark';

export function Footer() {
  return (
    <Box component="footer" data-testid="site-footer">
      <ArcDivider />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1}>
          <ConvexaMark size={16} fontSize="1rem" />
          <Link
            component={RouterLink}
            to="/blog"
            variant="caption"
            underline="hover"
            sx={{ color: 'text.secondary', width: 'fit-content' }}
            data-testid="footer-blog-link"
          >
            Blog — how Convexa is built
          </Link>
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
