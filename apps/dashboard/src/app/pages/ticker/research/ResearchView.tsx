import { usePublicTicker } from '@/pages/research/publicData';
import { SecRecordSections } from '@/pages/research/SecRecordSections';
import { TickerTabs } from '@/pages/ticker/TickerTabs';
import {
  loadSampleResearch,
  type LocalOutcome,
  type PublicTicker,
  type SampleResearchCase,
} from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoNoteSide } from './DemoNoteSide';

/**
 * The public-record band under the sample note (Final · Planned · Insider clusters and Figures
 * against the filing, staging boards): the same SEC sections the production note carries, on the
 * demo transport's sample answer, so nothing leaves the browser. Each frame is dashed and hatched and
 * says what it is shaped like (canon P-3, P-8). A fund has no Form 4 trades or company reports.
 */
function DemoPublicRecord({ symbol, d }: { symbol: string; d: PublicTicker }) {
  const company = d.insiders !== null || d.periodic.length > 0;
  return (
    <Box
      component="section"
      aria-labelledby="public-record"
      sx={{ display: 'grid', gap: 3, minWidth: 0, pt: { xs: 1, md: 2 } }}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Typography
          id="public-record"
          component="h2"
          variant="overline"
          color="text.secondary"
          sx={{ lineHeight: 1.6 }}
        >
          {`Public record · ${symbol}`}
        </Typography>
        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', maxWidth: '72ch' }}>
          Demo · sample data; nothing here is an SEC record.
        </Box>
      </Box>
      {company ? (
        <SecRecordSections d={d} />
      ) : (
        <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary' }}>
          {`${symbol} is a fund, not a company: it files no Form 4 trades or quarterly reports, so the sample has none.`}
        </Box>
      )}
    </Box>
  );
}

type ReadyState = {
  phase: 'ready';
  result: Extract<LocalOutcome<SampleResearchCase>, { state: 'ready' }>;
  refreshing: boolean;
  refreshError?: string;
};
type RequestState =
  { phase: 'loading' } | { phase: 'cold-error'; detail: string; title: string } | ReadyState;

function FactList({
  title,
  facts,
  symbol,
  scenarioId,
}: {
  title: string;
  facts: SampleResearchCase['evidence'];
  symbol: string;
  scenarioId: string;
}) {
  return (
    <Box>
      <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack component="ul" spacing={1} sx={{ pl: 2, mt: 0 }}>
        {facts.map((fact, index) => (
          <Box component="li" key={`${title}-${index}`}>
            {fact.state === 'present' ? (
              <>
                <Typography component="span">{fact.text}</Typography>
                {fact.sourceIds.length <= 3 ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}
                    Source: {fact.sourceIds.join(', ')}
                  </Typography>
                ) : (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}
                      Source: {fact.sourceIds.slice(0, 3).join(', ')} …
                    </Typography>
                    <Box component="details" sx={{ minWidth: 0 }}>
                      <Box
                        component="summary"
                        sx={{
                          minHeight: 44,
                          display: 'flex',
                          alignItems: 'center',
                          color: 'text.secondary',
                          cursor: 'pointer',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {fact.sourceIds.length === 60 &&
                        new Set(fact.sourceIds).size === 60 &&
                        fact.sourceIds.every((id) => id.startsWith(`${scenarioId}:${symbol}:`))
                          ? '60 source IDs · all 60 authored bars'
                          : `${fact.sourceIds.length} source IDs · show all`}
                      </Box>
                      <Typography
                        component="div"
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                      >
                        {fact.sourceIds.join(', ')}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </>
            ) : fact.state === 'checked_none' ? (
              <Typography color="text.secondary">Checked · {fact.text}</Typography>
            ) : (
              <Typography color="text.secondary">Not curated for this sample.</Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export function ResearchView({ symbol }: { symbol: string }) {
  // The demo transport's public-data answer (in the browser): the side column and the band read it.
  const pub = usePublicTicker(symbol.toUpperCase());
  const [state, setState] = useState<RequestState>({ phase: 'loading' });
  const stateRef = useRef(state);
  const requestRef = useRef(0);
  const setCurrent = (next: RequestState) => {
    stateRef.current = next;
    setState(next);
  };
  const fetchResearch = useCallback(
    async (retain: boolean) => {
      const requestId = ++requestRef.current;
      const previous = stateRef.current;
      if (retain && previous.phase === 'ready')
        setCurrent({ ...previous, refreshing: true, refreshError: undefined });
      else setCurrent({ phase: 'loading' });
      try {
        const result = await loadSampleResearch(symbol);
        if (requestId !== requestRef.current) return;
        if (result.state === 'ready') setCurrent({ phase: 'ready', result, refreshing: false });
        else if (retain && previous.phase === 'ready')
          setCurrent({ ...previous, refreshing: false, refreshError: result.detail });
        else if (result.state === 'unsupported')
          setCurrent({
            phase: 'cold-error',
            title: 'No sample research note for this symbol.',
            detail: `No sample data for ${symbol}. Choose a supported symbol.`,
          });
        else if (result.state === 'unavailable')
          setCurrent({
            phase: 'cold-error',
            title: 'Analysis unavailable.',
            detail: 'Research is not available from the live provider.',
          });
        else
          setCurrent({
            phase: 'cold-error',
            title: 'Sample data could not load.',
            detail: result.detail,
          });
      } catch {
        if (requestId !== requestRef.current) return;
        if (retain && previous.phase === 'ready')
          setCurrent({
            ...previous,
            refreshing: false,
            refreshError: 'Sample data could not load.',
          });
        else
          setCurrent({
            phase: 'cold-error',
            title: 'Sample data could not load.',
            detail: 'Sample data could not load.',
          });
      }
    },
    [symbol],
  );
  useEffect(() => {
    void fetchResearch(false);
  }, [fetchResearch]);

  if (state.phase === 'loading')
    return (
      <Stack spacing={2} aria-label="Loading sample research">
        <Typography component="h1" variant="overline" color="text.secondary">
          Sample research note · authored for this scenario
        </Typography>
        <Skeleton variant="rounded" height={90} />
        <Skeleton variant="rounded" height={250} />
        <Typography role="status">Loading sample data…</Typography>
      </Stack>
    );
  if (state.phase === 'cold-error')
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" onClick={() => void fetchResearch(false)}>
            Retry demo
          </Button>
        }
      >
        <Typography component="h1" variant="inherit" sx={{ display: 'inline', fontWeight: 700 }}>
          {state.title}
        </Typography>{' '}
        {state.detail}
      </Alert>
    );
  const research = state.result.value;
  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          gap: '8px 16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="overline" color="text.secondary">
          Sample research note · authored for this scenario
        </Typography>
        <TickerTabs ticker={symbol.toUpperCase()} current="research" />
      </Box>
      {state.refreshError && (
        <Alert severity="warning">
          Couldn’t update the sample view. Showing the last sample. {state.refreshError}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 340px)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ borderTop: 2, borderTopColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
                {research.title}
              </Typography>
              <Typography color="text.secondary">{research.thesis}</Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                Authored scenario · {research.snapshotAsOf} · {research.scenarioId} · advisory
                context
              </Typography>
            </CardContent>
          </Card>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1.4fr) minmax(240px,1fr)' },
              gap: 2,
            }}
          >
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2.5}>
                  <FactList
                    title="Evidence"
                    facts={research.evidence}
                    symbol={symbol}
                    scenarioId={research.scenarioId}
                  />
                  <Box>
                    <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
                      Risks
                    </Typography>
                    <Stack component="ul" spacing={1} sx={{ pl: 2, mt: 0 }}>
                      {research.risks.map((risk) => (
                        <Typography component="li" key={risk}>
                          {risk}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                  <Box>
                    <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
                      Invalidation
                    </Typography>
                    <Typography color="text.secondary">{research.invalidation}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2.5}>
                  <FactList
                    title="Catalysts"
                    facts={research.catalysts}
                    symbol={symbol}
                    scenarioId={research.scenarioId}
                  />
                  <Box>
                    <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
                      Assumptions
                    </Typography>
                    <Stack component="ul" spacing={1} sx={{ pl: 2, mt: 0 }}>
                      {research.assumptions.map((assumption) => (
                        <Typography component="li" key={assumption}>
                          {assumption}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Same {symbol} scenario · no external news, AI or forecast citations
            </Typography>
            <Button
              onClick={() => void fetchResearch(true)}
              disabled={state.refreshing}
              // Neutral text button from the theme (owner ruling A, 2026-10-15).
              sx={{ minHeight: 44 }}
            >
              {state.refreshing ? 'Refreshing…' : 'Refresh sample'}
            </Button>
          </Box>
        </Stack>
        <DemoNoteSide symbol={symbol.toUpperCase()} read={pub} />
      </Box>
      {pub.data && <DemoPublicRecord symbol={symbol.toUpperCase()} d={pub.data} />}
    </Stack>
  );
}
