/**
 * The Lab on a live build (owner ruling 2026-10-14: production mocks nothing). Every instrument runs
 * on synthetic data, and a synthetic instrument is a mock, so here each says what its live form would
 * show, why it's off, and opens the same instrument on the demo, where all of them run.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (Lab, production) and lab-kit.mjs.
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LAB_DEMOS, type LabDemo } from './labCatalog';

const WHY =
  'its live form reads the options chain, a paid feed this site doesn’t run, and its synthetic version is a mock, which this site doesn’t show.';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };
const PANEL_SX = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '12px',
} as const;

function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = 'Convexa';
    };
  }, [title]);
}

/** `heading`: the card's title. The index names the instrument; the instrument's own page, whose h1
 *  already does, names the metric the frame would draw. */
function NotLiveBody({ demo, heading }: { demo: LabDemo; heading: string }) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px 10px',
        }}
      >
        <Box component="h2" sx={{ m: 0, fontSize: 17, fontWeight: 700 }}>
          {heading}
        </Box>
        <DataStateTag state="notLive" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
        {demo.tagline}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textWrap: 'pretty' }}>
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Would show
        </Box>{' '}
        {demo.would}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textWrap: 'pretty' }}>
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Off because
        </Box>{' '}
        {WHY}
      </Typography>
      <Link
        href={`${STAGING_DEMO_URL}${demo.path}`}
        variant="body2"
        underline="always"
        sx={{ ...linkSx, justifySelf: 'start', minHeight: 24 }}
      >
        See it on the demo →
      </Link>
    </>
  );
}

/** /lab on a live build: the five instruments, each Not live with its way to the demo. */
export function LabIndexNotLive() {
  useTitle('Lab — Convexa');
  return (
    <Box data-testid="lab-index" sx={{ minHeight: '70vh', bgcolor: 'background.default', pb: 6 }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'grid', gap: 1.5, mb: 3, maxWidth: 720 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Instrument lab
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
            Instruments that may move onto the ticker desk. Each one runs on synthetic data, and
            this site shows no mocks, so here each says what it would show and opens on the demo,
            where all of them run.
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
            gap: 2,
          }}
        >
          {LAB_DEMOS.map((d) => (
            <Box
              component="section"
              key={d.id}
              data-testid={`lab-card-${d.id}`}
              aria-label={d.title}
              sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1, alignContent: 'start' }}
            >
              <NotLiveBody demo={d} heading={d.title} />
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/** /lab/<id> on a live build: the instrument's Not live panel, with the way back to the Lab. */
export function LabInstrumentNotLive({ id }: { id: string }) {
  const demo = LAB_DEMOS.find((d) => d.id === id);
  useTitle(`${demo?.title ?? 'Lab'} — Convexa`);
  if (!demo) return null;
  return (
    <Box
      data-testid={`lab-${id}-not-live`}
      sx={{ minHeight: '70vh', bgcolor: 'background.default', pb: 6 }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'grid', gap: 2, maxWidth: 760 }}>
          <Link
            component={RouterLink}
            to="/lab"
            variant="body2"
            underline="always"
            sx={{ ...linkSx, justifySelf: 'start', minHeight: 24 }}
          >
            ← All instruments
          </Link>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            {demo.title}
          </Typography>
          <Box
            component="section"
            aria-label={`${demo.title}, not live`}
            sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1 }}
          >
            <NotLiveBody demo={demo} heading={demo.metric} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
