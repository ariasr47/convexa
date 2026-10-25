/**
 * The demo build, a symbol its scenario doesn't cover. The demo runs one authored day for six
 * symbols; anything else has no sample data, and that is a fact about the demo, not a failed load,
 * so it never reads "Couldn't load … HTTP 422". It names the six instead.
 *
 * Design: design/src/screens/final/ticker.mjs (desk states, "Not in the demo").
 */
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

export function DemoSymbolMissing({ ticker }: { ticker: string }) {
  const t = ticker.toUpperCase();
  return (
    <Box sx={{ ...pageColumnSx, py: 3 }}>
      <Box
        component="section"
        role="status"
        data-testid="demo-symbol-missing"
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: '12px',
          p: { xs: 2, sm: 3 },
          display: 'grid',
          gap: 1.5,
          maxWidth: 720,
        }}
      >
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
          {`${t} isn’t in the demo scenario.`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textWrap: 'pretty' }}>
          The demo runs one authored day, Oct 7, 2026, for six symbols, so it has no sample data for{' '}
          {t}. Open one of these instead:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {STAGING_DEMO_SYMBOLS.map((s) => (
            <Button
              key={s}
              component={RouterLink}
              to={`/ticker/${s}`}
              variant="outlined"
              color="inherit"
              sx={{ minHeight: 44, minWidth: 72, borderColor: 'divider' }}
            >
              {s}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
