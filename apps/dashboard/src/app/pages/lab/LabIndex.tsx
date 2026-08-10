/**
 * /lab — hub for instrument demos that may graduate onto the ticker page.
 */
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LAB_DEMOS } from './labCatalog';

export function LabIndex() {
  useEffect(() => {
    document.title = 'Lab — Convexa';
    return () => {
      document.title = 'Convexa';
    };
  }, []);

  return (
    <Box data-testid="lab-index" sx={{ minHeight: '70vh', bgcolor: 'background.default', pb: 6 }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5} sx={{ mb: 3, maxWidth: 720 }}>
          <Chip
            label="Lab"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          />
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Instrument lab
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
            Canvas / WebGL experiments for the ticker desk. Each demo is a candidate surface —
            dual-clock honesty, brand tokens, reduced-motion. Synthetic data by default so you can
            feel the instrument without a live chain.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          {LAB_DEMOS.map((d) => (
            <Card
              key={d.id}
              data-testid={`lab-card-${d.id}`}
              variant="outlined"
              sx={{
                bgcolor: 'background.paper',
                borderColor: 'divider',
                transition: 'border-color 160ms ease, transform 160ms ease',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                '@media (prefers-reduced-motion: reduce)': {
                  '&:hover': { transform: 'none' },
                },
              }}
            >
              <CardActionArea component={RouterLink} to={d.path} sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {d.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={d.status === 'shipped' ? 'On ticker' : 'Candidate'}
                        color={d.status === 'shipped' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                      {d.tagline}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.85 }}>
                      Ticker fit: {d.tickerCandidate}
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default LabIndex;
