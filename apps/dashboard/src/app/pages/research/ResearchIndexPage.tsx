/**
 * `/research` — every ticker with published notes, newest first (live mode). In the demo build the
 * per-ticker tabs carry authored sample notes instead, so this page points at those.
 */
import { TintChip } from '@/shared/ui/TintChip';
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { formatNoteDate, STANCE_LABEL, STANCE_TONE } from './notesData';
import { RESEARCH_DISCLAIMER } from './NotesView';

const SAMPLE_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];

function DemoNotice() {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
            Sample research in this demo
          </Typography>
          <Typography color="text.secondary">
            Each sample symbol has an authored research note that matches its demo scenario.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
            {SAMPLE_SYMBOLS.map((symbol) => (
              <Link component={RouterLink} key={symbol} to={`/ticker/${symbol}/research`}>
                {symbol}
              </Link>
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ResearchIndexPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography component="h1" variant="h4">
            Research
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: '62ch' }}>
            Notes on the tickers being followed: thesis, evidence, catalysts and risks, written by
            hand and updated as things change.
          </Typography>
        </Stack>

        {dataMode === 'demo' ? (
          <DemoNotice />
        ) : researchIndex.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
                No research published yet.
              </Typography>
              <Typography color="text.secondary">
                Notes will be listed here as they're written.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {researchIndex.map((row) => (
              <Box component="li" key={row.ticker}>
                <Card variant="outlined">
                  <CardActionArea
                    component={RouterLink}
                    to={`/ticker/${encodeURIComponent(row.ticker)}/research`}
                    sx={{ p: 2 }}
                  >
                    <Stack spacing={1}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          flexWrap: 'wrap',
                          columnGap: 1.5,
                          rowGap: 0.5,
                        }}
                      >
                        <Typography component="h2" variant="h6">
                          {row.ticker}
                        </Typography>
                        <Typography sx={{ fontWeight: 600, minWidth: 0 }}>
                          {row.latest.title}
                        </Typography>
                        {row.latest.stance && (
                          <TintChip
                            tone={STANCE_TONE[row.latest.stance]}
                            label={STANCE_LABEL[row.latest.stance]}
                          />
                        )}
                      </Box>
                      {row.latest.summary && (
                        <Typography variant="body2" color="text.secondary">
                          {row.latest.summary}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatNoteDate(row.latest.updated ?? row.latest.date)}
                        {' · '}
                        {row.count === 1 ? '1 note' : `${row.count} notes`}
                      </Typography>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Box>
            ))}
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary">
          {RESEARCH_DISCLAIMER}
        </Typography>
      </Stack>
    </Container>
  );
}

export default ResearchIndexPage;
