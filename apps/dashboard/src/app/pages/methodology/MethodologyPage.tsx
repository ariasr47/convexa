/**
 * `/methodology` — product spine #7 trust surface.
 * STATIC: no fetch, no SSE, no store. Honest methodology for structure/score/two-speed data.
 * Renders inside AppShell's `<main>`; this page does not nest a second main.
 */
import { METHOD_COPY } from './copy';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const SECTIONS = [
  METHOD_COPY.sections.structure,
  METHOD_COPY.sections.gammaSources,
  METHOD_COPY.sections.twoSpeed,
  METHOD_COPY.sections.score,
  METHOD_COPY.sections.fails,
  METHOD_COPY.sections.never,
] as const;

export function MethodologyPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'How Convexa works — methodology';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <Box
      data-testid="methodology-page"
      sx={{ maxWidth: 720, mx: 'auto', px: 3, py: { xs: 3, md: 5 } }}
    >
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        <Typography
          component="h1"
          variant="h4"
          sx={{ fontWeight: 700, letterSpacing: '-0.01em', m: 0 }}
        >
          {METHOD_COPY.title}
        </Typography>
        <Typography component="p" variant="body1" sx={{ color: 'text.secondary', m: 0 }}>
          {METHOD_COPY.subhead}
        </Typography>
      </Stack>

      <Stack spacing={4} component="div">
        {SECTIONS.map((section) => (
          <Box
            key={section.h}
            component="section"
            data-testid="methodology-section"
            aria-labelledby={`method-h-${section.h.slice(0, 24).replace(/\s+/g, '-')}`}
          >
            <Typography
              component="h2"
              id={`method-h-${section.h.slice(0, 24).replace(/\s+/g, '-')}`}
              variant="h6"
              sx={{ fontWeight: 700, mb: 1.25, letterSpacing: '-0.01em' }}
            >
              {section.h}
            </Typography>
            <Stack spacing={1.25}>
              {section.body.map((para) => (
                <Typography
                  key={para.slice(0, 40)}
                  component="p"
                  variant="body2"
                  sx={{ color: 'text.secondary', m: 0, lineHeight: 1.65 }}
                >
                  {para}
                </Typography>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Typography
        component="p"
        variant="caption"
        data-testid="methodology-disclaimer"
        sx={{ display: 'block', color: 'text.secondary', mt: 4, lineHeight: 1.5 }}
      >
        {METHOD_COPY.disclaimer}
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mt: 3 }}
        data-testid="methodology-ctas"
      >
        <Button
          component={RouterLink}
          to="/scanner"
          variant="contained"
          data-testid="methodology-cta-scanner"
          sx={{ minHeight: 44 }}
        >
          {METHOD_COPY.ctaScanner}
        </Button>
        <Button
          component={RouterLink}
          to="/ticker"
          variant="outlined"
          data-testid="methodology-cta-ticker"
          sx={{ minHeight: 44 }}
        >
          {METHOD_COPY.ctaTicker}
        </Button>
        <Button
          component={RouterLink}
          to="/"
          variant="text"
          data-testid="methodology-cta-home"
          sx={{ minHeight: 44 }}
        >
          {METHOD_COPY.ctaBack}
        </Button>
      </Stack>
    </Box>
  );
}

export default MethodologyPage;
