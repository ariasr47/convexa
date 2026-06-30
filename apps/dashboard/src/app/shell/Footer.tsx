/**
 * Footer — the site footer (its own UI component; the Figma "Footer", node `85:305`). Extracted from
 * the inline Landing footer so it is standalone, testable, and reusable across full pages.
 *
 * Chrome ONLY: owns no feature data, makes no fetch, opens no SSE. A top divider, the ConvexaMark
 * wordmark, and the simulated/paper honesty disclaimer (`[no-real-order-path]`). Content constrained
 * to the same `lg` column as the rest of the page.
 */
import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { ConvexaMark } from './ConvexaMark';

export function Footer() {
  return (
    <Box component="footer" data-testid="site-footer">
      <Divider />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1}>
          <ConvexaMark size={16} fontSize="1rem" />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
            data-testid="footer-disclaimer"
          >
            Convexa is an analysis tool. All positions and trades shown are <strong>simulated</strong>{' '}
            (paper). Not investment advice. No brokerage connection.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default Footer;
