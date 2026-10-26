import { formatNoteDate } from '@/pages/research/format';
import { usePublicTicker } from '@/pages/research/publicData';
import { SecRecordSections } from '@/pages/research/SecRecordSections';
import { DISPLAY, Eyebrow } from '@/pages/research/ui';
import { useActiveSection } from '@/pages/research/useActiveSection';
import { SampleTaChart } from '@/pages/ticker/technical-analysis/SampleTaChart';
import { TickerTabs } from '@/pages/ticker/TickerTabs';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import {
  loadSampleBars,
  loadSampleResearch,
  type LocalOutcome,
  type PublicTicker,
  type SampleBarsView,
  type SampleResearchCase,
} from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { DemoNoteSide, SampleChip } from './DemoNoteSide';

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
      <Stack component="ul" spacing={1} sx={{ pl: 2, my: 0 }}>
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

/** The sample note's sections, in the board's order (design ticker-note.mjs noteStagingBody), with
 *  the authored case's assumptions after its catalysts. */
const SECTIONS = [
  ['thesis', 'Thesis'],
  ['evidence', 'Evidence'],
  ['risks', 'Risks'],
  ['invalidation', 'Invalidation'],
  ['catalysts', 'Catalysts'],
  ['assumptions', 'Assumptions'],
] as const;
type SectionKey = (typeof SECTIONS)[number][0];
const sectionId = (k: SectionKey) => `sample-${k}`;
const SECTION_IDS = SECTIONS.map(([k]) => sectionId(k));

/** The section rail: a column of links beside the note from `md`, a sideways strip of 44 px links
 *  above it on a phone. The section in view is marked by weight, fill and `aria-current`. */
function SampleRail({ active, strip = false }: { active: string; strip?: boolean }) {
  return (
    <Box
      component="nav"
      aria-label={strip ? 'Sections of this note' : 'On this page'}
      sx={
        strip
          ? {
              display: { xs: 'flex', md: 'none' },
              gap: 0.75,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              minWidth: 0,
            }
          : { position: 'sticky', top: 88, display: 'grid', gap: 0.5, alignContent: 'start' }
      }
    >
      {SECTIONS.map(([k, label]) => {
        const current = sectionId(k) === active;
        return (
          <Box
            key={k}
            component="a"
            href={`#${sectionId(k)}`}
            aria-current={current ? 'location' : undefined}
            sx={(t) => ({
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              minHeight: strip ? 44 : 36,
              px: strip ? 1.5 : 1.25,
              borderRadius: strip ? '999px' : '8px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: current ? 600 : 400,
              // On the phone strip's 10% steel tint, steel measured 4.4:1 in light: text.primary
              // there (spec 2026-10-21/02, part (c)).
              color:
                current || (strip && t.palette.mode === 'light')
                  ? 'text.primary'
                  : 'text.secondary',
              bgcolor: current
                ? 'action.selected'
                : strip
                  ? alpha(t.palette.text.secondary, 0.1)
                  : 'transparent',
              '&:hover': { color: 'text.primary', bgcolor: alpha(t.palette.text.secondary, 0.12) },
            })}
          >
            {label}
          </Box>
        );
      })}
    </Box>
  );
}

function Section({ k, title, children }: { k: SectionKey; title: string; children: ReactNode }) {
  return (
    <Box
      component="section"
      id={sectionId(k)}
      aria-labelledby={`${sectionId(k)}-h`}
      sx={{ display: 'grid', gap: 1.5, minWidth: 0, scrollMarginTop: 96 }}
    >
      <Box
        component="h2"
        id={`${sectionId(k)}-h`}
        sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: { xs: 21, md: 26 }, lineHeight: 1.2 }}
      >
        {title}
      </Box>
      {children}
    </Box>
  );
}

type BarsState =
  | { phase: 'loading' }
  | { phase: 'ready'; view: SampleBarsView }
  | { phase: 'error'; detail: string };

/** The sample close chart under the evidence (board: `sampleTaChart({ rsi: false })`): the same
 *  authored bars the Technical tab draws, read in the browser. */
function SampleNoteChart({ symbol }: { symbol: string }) {
  const [bars, setBars] = useState<BarsState>({ phase: 'loading' });
  const [selected, setSelected] = useState(59);
  useEffect(() => {
    let live = true;
    void loadSampleBars(symbol).then(
      (result) => {
        if (!live) return;
        if (result.state === 'ready') {
          setBars({ phase: 'ready', view: result.value });
          setSelected(result.value.bars.length - 1);
        } else setBars({ phase: 'error', detail: result.detail });
      },
      () => live && setBars({ phase: 'error', detail: 'Sample bars could not be loaded.' }),
    );
    return () => {
      live = false;
    };
  }, [symbol]);
  if (bars.phase === 'loading')
    return <Skeleton variant="rounded" height={340} aria-label="Loading the sample chart" />;
  if (bars.phase === 'error')
    return (
      <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
        {`The sample chart couldn’t load: ${bars.detail}`}
      </Box>
    );
  return (
    <SampleTaChart
      symbol={symbol}
      view={bars.view}
      selected={Math.min(selected, bars.view.bars.length - 1)}
      onSelect={setSelected}
      rsi={false}
    />
  );
}

/** The authored sample case laid out as the note board draws it: rail, header with the Sample note
 *  tag and the scenario chip, sections, the sample chart, and the side column. */
function SampleNote({
  symbol,
  research,
  side,
  footer,
}: {
  symbol: string;
  research: SampleResearchCase;
  side: ReactNode;
  footer: ReactNode;
}) {
  const active = useActiveSection(SECTION_IDS);
  // "2026-10-07T18:30:00Z" → "Oct 7, 2026": the scenario's day, never the raw timestamp.
  const asOf = formatNoteDate(research.snapshotAsOf.slice(0, 10));
  return (
    <Box
      sx={{
        display: 'grid',
        // The board's tracks (final/ticker-note.mjs `.nv`, v4/notes.mjs:8, :21): rail 220, body
        // 530 and the side the rest, with 40px gaps from 1300px (220 / 530 / 450 at 1440); below
        // 1300 a 200px rail with the side under the body.
        gap: { xs: 3, md: 5 },
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: '200px minmax(0, 1fr)',
          desktop: '220px minmax(0, 530px) minmax(0, 1fr)',
        },
        alignItems: 'start',
      }}
    >
      <Box sx={{ display: { xs: 'none', md: 'block' }, alignSelf: 'stretch' }}>
        <SampleRail active={active} />
      </Box>
      <Stack spacing={4} sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
          <Eyebrow>Sample research note · authored for this scenario</Eyebrow>
          <Box
            component="h1"
            sx={{
              ...DISPLAY,
              m: 0,
              fontWeight: 700,
              fontSize: { xs: 26, md: 38 },
              lineHeight: 1.12,
              textWrap: 'balance',
            }}
          >
            {research.title}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <DataStateTag state="sample" word="Sample note" />
            <SampleChip
              text={`Authored scenario · ${asOf} · ${research.scenarioId} · advisory context`}
            />
          </Box>
        </Box>
        <SampleRail active={active} strip />
        <Section k="thesis" title="Thesis">
          <Box component="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.65 }}>
            {research.thesis}
          </Box>
        </Section>
        <Section k="evidence" title="Evidence">
          <FactList
            title="Evidence"
            facts={research.evidence}
            symbol={symbol}
            scenarioId={research.scenarioId}
          />
          <SampleNoteChart symbol={symbol} />
        </Section>
        <Section k="risks" title="Risks">
          <Stack component="ul" spacing={1} sx={{ pl: 2, my: 0 }}>
            {research.risks.map((risk) => (
              <Typography component="li" key={risk}>
                {risk}
              </Typography>
            ))}
          </Stack>
        </Section>
        <Section k="invalidation" title="Invalidation">
          <Typography>{research.invalidation}</Typography>
        </Section>
        <Section k="catalysts" title="Catalysts">
          <FactList
            title="Catalysts"
            facts={research.catalysts}
            symbol={symbol}
            scenarioId={research.scenarioId}
          />
        </Section>
        <Section k="assumptions" title="Assumptions">
          <Stack component="ul" spacing={1} sx={{ pl: 2, my: 0 }}>
            {research.assumptions.map((assumption) => (
              <Typography component="li" key={assumption}>
                {assumption}
              </Typography>
            ))}
          </Stack>
        </Section>
        {footer}
      </Stack>
      <Box sx={{ gridColumn: { md: '2', desktop: 'auto' }, minWidth: 0 }}>{side}</Box>
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
  const ticker = symbol.toUpperCase();
  return (
    <Stack spacing={{ xs: 2.5, md: 3 }} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0 16px',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <TickerTabs ticker={ticker} current="research" />
        <Link
          component={RouterLink}
          to="/research"
          sx={{
            ml: 'auto',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          All research →
        </Link>
      </Box>
      {state.refreshError && (
        <Alert severity="warning">
          Couldn’t update the sample view. Showing the last sample. {state.refreshError}
        </Alert>
      )}
      <SampleNote
        symbol={ticker}
        research={research}
        side={<DemoNoteSide symbol={ticker} read={pub} />}
        footer={
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
              Same {ticker} scenario · no external news, AI or forecast citations. Not investment
              advice.
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
        }
      />
      {pub.data && <DemoPublicRecord symbol={ticker} d={pub.data} />}
    </Stack>
  );
}
