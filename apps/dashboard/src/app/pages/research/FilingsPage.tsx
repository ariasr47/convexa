/**
 * Filings: what the followed companies filed with the SEC, newest first, each marked against its note
 * (cited, new since the note, or unused). A periodic report shows the figures it reported against the
 * prior period; a results release says where its figures will arrive. The filter lives in the URL so
 * Back and a shared link keep it; j and k move through the list, o opens the filing.
 */
import { ChartFrame, type ChartStatus } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { publicDataWord } from '@/shared/dataState/vocabulary';
import { STAGING_DEMO_SYMBOLS, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { dataMode, demoNoteFilings, type PublicFiling, type PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha, type Theme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { localToday, researchIndex, upcoming } from 'virtual:convexa-research';
import { figureChange, standing } from './filings';
import { formatNoteDate, formatShortDate } from './format';
import { ResearchColumn } from './NotesView';
import { usePublicFilings, usePublicTicker } from './publicData';
import { Caps, Disclaimer, ProvenanceChip, SourceProblem, StaleNote } from './publicUi';
import { ResearchTabs } from './ResearchTabs';
import { DISPLAY, MONO, PANEL_SX } from './ui';

type Kind = PublicFiling['kind'];
const KINDS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'results', label: 'Results' },
  { key: 'periodic', label: 'Quarterly and annual' },
  { key: 'financing', label: 'Deals and financing' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'other', label: 'Other' },
];
const KIND_WORD: Record<Kind, string> = {
  results: 'Results',
  periodic: 'Quarterly and annual',
  financing: 'Deals and financing',
  ownership: 'Ownership',
  other: 'Other',
};

const DEMO = dataMode === 'demo';
// The demo's sample filings belong to its six sample symbols, and its sample notes cite them
// (demo/public-data.ts demoNoteFilings), not the production notes.
const notesByTicker = new Map<string, { date: string; accessions: string[] }>(
  DEMO
    ? STAGING_DEMO_SYMBOLS.flatMap((t) => {
        const cites = demoNoteFilings(t);
        return cites ? [[t, cites] as const] : [];
      })
    : researchIndex.map((r) => [r.ticker, r.latest] as const),
);
const TICKERS: string[] = DEMO ? [...STAGING_DEMO_SYMBOLS] : researchIndex.map((r) => r.ticker);
const EDGAR_SEARCH = 'https://www.sec.gov/edgar/search/';
/** Sample data is dashed (canon P-3). */
const DEMO_EDGE = (t: Theme) =>
  DEMO ? { border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}` } : {};

export function FilingsPage() {
  const today = useMemo(() => localToday(), []);
  const read = usePublicFilings(TICKERS);
  const [params, setParams] = useSearchParams();
  const kind = (KINDS.find((k) => k.key === params.get('kind'))?.key ?? 'all') as Kind | 'all';
  const filings = read.data?.filings ?? [];
  const shown = kind === 'all' ? filings : filings.filter((f) => f.kind === kind);
  const [selected, setSelected] = useState<string | null>(null);
  const current = shown.find((f) => f.accession === selected) ?? shown[0] ?? null;
  const expected = useMemo(
    () =>
      // The demo's sample notes carry no dated results.
      (DEMO ? [] : researchIndex)
        .flatMap((r) =>
          upcoming(r.latest.aging.events, today, 42)
            .filter((u) => /results|earnings/i.test(u.label))
            .map((u) => ({ ...u, ticker: r.ticker })),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [today],
  );

  const notSetUp = read.data?.state === 'not_configured' && !DEMO;
  const expectedSection = (
    <Box component="section" aria-labelledby="expected" sx={{ display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
        <Caps>
          <span id="expected">Expected · next six weeks</span>
        </Caps>
        {!DEMO && <DataStateTag state="computed" detail="from the notes" />}
      </Box>
      {expected.length === 0 ? (
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
          {DEMO
            ? 'The demo’s sample notes carry no dated results, so nothing is expected in this scenario.'
            : 'No note expects results in the next six weeks.'}
        </Box>
      ) : (
        <Box
          component="ol"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))',
            gap: 1,
          }}
        >
          {expected.map((e, i) => (
            <Box
              component="li"
              key={i}
              sx={(t) => ({
                display: 'grid',
                gap: 0.5,
                p: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${alpha(t.palette.text.secondary, 0.25)}`,
              })}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <TickerChip ticker={e.ticker} />
                <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
                  {e.whenLabel}
                </Box>
              </Box>
              <Box component="span" sx={{ fontSize: 14, fontWeight: 500 }}>
                {e.label}
              </Box>
              <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
                {`makes the ${e.ticker} note due when filed`}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  const setKind = (k: Kind | 'all') => {
    const next = new URLSearchParams(params);
    if (k === 'all') next.delete('kind');
    else next.set('kind', k);
    setParams(next, { replace: true });
    setSelected(null);
  };

  return (
    <ResearchColumn>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 3.5,
          pt: { xs: 1, md: 2 },
        }}
      >
        <ResearchTabs />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 32px' }}>
          <Box sx={{ flex: '999 1 520px', display: 'grid', gap: 1.5 }}>
            <Box
              component="h1"
              sx={{
                ...DISPLAY,
                m: 0,
                fontWeight: 800,
                fontSize: { xs: 36, md: 48 },
                lineHeight: 1.05,
              }}
            >
              Filings
            </Box>
            <Box
              component="p"
              sx={{
                m: 0,
                maxWidth: '66ch',
                color: 'text.secondary',
                fontSize: 16,
                textWrap: 'pretty',
              }}
            >
              {DEMO
                ? "What the demo's sample companies filed, newest first. A results or quarterly filing the note hasn't read makes it due."
                : `What the ${TICKERS.length} followed companies filed with the SEC, newest first. A results or quarterly filing the note hasn't read makes it due.`}
            </Box>
          </Box>
          <Box
            sx={{
              flex: '1 1 260px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'flex-start', md: 'flex-end' },
              gap: 1,
            }}
          >
            {dataMode === 'demo' && <ProvenanceChip text="Demo · sample data" kind="sample" />}
            {read.data?.checked_at && (
              <ProvenanceChip
                text={
                  dataMode === 'demo'
                    ? `Sample filings, shaped like SEC EDGAR · ${formatShortDate(read.data.checked_at.slice(0, 10))}`
                    : `SEC EDGAR · checked ${formatShortDate(read.data.checked_at.slice(0, 10))}, ${read.data.checked_at.slice(11, 16)} UTC`
                }
                kind={dataMode === 'demo' ? 'sample' : 'primary'}
              />
            )}
            {notSetUp && (
              <ProvenanceChip text="SEC EDGAR · not set up on this site" kind="primary" />
            )}
            {read.data && dataMode !== 'demo' && (
              <DataStateTag
                state={publicDataWord(read.data.state, {
                  stale: read.data.state === 'live' && !!read.data.detail,
                })}
              />
            )}
            <Box
              component="span"
              sx={{
                display: { xs: 'none', md: notSetUp ? 'none' : 'inline-flex' },
                alignItems: 'center',
                gap: 0.75,
                fontSize: 12,
                color: 'text.secondary',
              }}
            >
              <Kbd>j</Kbd>
              <Kbd>k</Kbd>
              move
              <Kbd sx={{ ml: 1 }}>o</Kbd>
              open the filing
            </Box>
          </Box>
        </Box>

        {!notSetUp && expectedSection}

        {read.loading && !read.data ? (
          <FeedSkeleton />
        ) : read.error || !read.data ? (
          <SourceProblem
            title="Filings didn't load."
            body="Convexa's server didn't answer. The notes keep their own dates, so nothing comes due late because of it."
            onRetry={read.retry}
          />
        ) : read.data.state === 'off' ? (
          <SourceProblem
            title="Public data is switched off on this server."
            body="Filings come from SEC EDGAR through Convexa's API, which has them turned off."
          />
        ) : read.data.state === 'not_configured' ? (
          <>
            <NotSetUp />
            {expectedSection}
          </>
        ) : (
          <>
            {read.data.detail && dataMode !== 'demo' && <StaleNote text={read.data.detail} />}
            <Box
              role="group"
              aria-label="Filter filings"
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
            >
              {KINDS.map((k) => {
                const n =
                  k.key === 'all' ? filings.length : filings.filter((f) => f.kind === k.key).length;
                if (n === 0 && k.key !== 'all') return null;
                const on = kind === k.key;
                return (
                  <Box
                    component="button"
                    type="button"
                    key={k.key}
                    aria-pressed={on}
                    onClick={() => setKind(k.key)}
                    sx={(t) => ({
                      minHeight: 36,
                      px: 1.75,
                      borderRadius: '999px',
                      border: on ? 0 : `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
                      bgcolor: on ? 'text.primary' : 'transparent',
                      color: on ? 'background.default' : 'text.secondary',
                      font: 'inherit',
                      fontSize: 13,
                      fontWeight: on ? 600 : 500,
                      cursor: 'pointer',
                      '@media (pointer: coarse)': { minHeight: 44 },
                    })}
                  >
                    {`${k.label} · ${n}`}
                  </Box>
                );
              })}
            </Box>
            {shown.length === 0 ? (
              <SourceProblem
                title="Nothing filed in the last 90 days."
                body="When a followed company files with the SEC it appears here within the hour."
              />
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                <Box sx={{ flex: '999 1 560px', minWidth: 0 }}>
                  <Feed filings={shown} current={current} onSelect={setSelected} />
                </Box>
                <Box
                  sx={{
                    flex: '1 1 400px',
                    minWidth: 0,
                    position: { md: 'sticky' },
                    top: { md: 88 },
                  }}
                >
                  {current && <Detail filing={current} />}
                </Box>
              </Box>
            )}
            <Unlisted missing={read.data.missing} filings={filings} />
          </>
        )}

        <Disclaimer>
          Filings from SEC EDGAR, the public record. Personal research notes. Not financial advice.
        </Disclaimer>
      </Box>
    </ResearchColumn>
  );
}

function Kbd({ children, sx }: { children: string; sx?: object }) {
  return (
    <Box
      component="kbd"
      sx={(t) => ({
        ...MONO,
        fontSize: 11,
        px: 0.75,
        py: '1px',
        borderRadius: '4px',
        border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
        color: 'text.primary',
        ...sx,
      })}
    >
      {children}
    </Box>
  );
}

function TickerChip({ ticker }: { ticker: string }) {
  return (
    <Box
      component="span"
      sx={(t) => ({
        ...MONO,
        justifySelf: 'start',
        fontSize: 11,
        fontWeight: 600,
        px: 0.75,
        py: '2px',
        borderRadius: '5px',
        bgcolor: alpha(t.palette.text.secondary, 0.16),
      })}
    >
      {ticker}
    </Box>
  );
}

function Feed({
  filings,
  current,
  onSelect,
}: {
  filings: PublicFiling[];
  current: PublicFiling | null;
  onSelect: (a: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const move = (dir: 1 | -1) => {
    const i = filings.findIndex((f) => f.accession === current?.accession);
    const next = filings[Math.min(filings.length - 1, Math.max(0, i + dir))];
    if (!next) return;
    onSelect(next.accession);
    list.current?.querySelector<HTMLButtonElement>(`[data-accession="${next.accession}"]`)?.focus();
  };
  return (
    <Box
      component="ol"
      ref={list}
      aria-label="Filings, newest first"
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'j') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'k') {
          e.preventDefault();
          move(-1);
        } else if (e.key === 'o' && current) {
          e.preventDefault();
          window.open(current.url, '_blank', 'noopener,noreferrer');
        }
      }}
      sx={[{ ...PANEL_SX, listStyle: 'none', m: 0, p: 0, overflow: 'hidden' }, DEMO_EDGE]}
    >
      {filings.map((f, i) => {
        const note = notesByTicker.get(f.ticker);
        const stand = note ? standing(f, note) : 'unused';
        const on = current?.accession === f.accession;
        return (
          <Box component="li" key={f.accession}>
            <Box
              component="button"
              type="button"
              data-accession={f.accession}
              aria-current={on ? 'true' : undefined}
              onClick={() => onSelect(f.accession)}
              sx={(t) => ({
                width: '100%',
                display: 'grid',
                gridTemplateColumns: {
                  xs: '56px minmax(0, 1fr)',
                  sm: '64px 56px 72px minmax(0, 1fr) auto',
                },
                gap: { xs: '4px 12px', sm: 1.5 },
                alignItems: 'center',
                textAlign: 'left',
                p: '12px 16px',
                border: 0,
                borderTop: i === 0 ? 0 : `1px solid ${t.palette.divider}`,
                bgcolor: on ? alpha(t.palette.text.primary, 0.06) : 'transparent',
                boxShadow: on ? `inset 2px 0 0 ${t.palette.text.primary}` : 'none',
                color: 'text.primary',
                font: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
                '&:hover': { bgcolor: alpha(t.palette.text.primary, on ? 0.06 : 0.03) },
              })}
            >
              <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
                {formatShortDate(f.filed)}
              </Box>
              <TickerChip ticker={f.ticker} />
              <Box
                component="span"
                sx={{
                  ...MONO,
                  fontSize: 11,
                  color: 'text.secondary',
                  display: { xs: 'none', sm: 'inline' },
                }}
              >
                {f.items.length
                  ? `${f.form} ${f.items.filter((it) => it !== '9.01').join(', ')}`
                  : f.form}
              </Box>
              <Box
                component="span"
                sx={{
                  display: 'grid',
                  gap: 0.25,
                  minWidth: 0,
                  gridColumn: { xs: '1 / -1', sm: 'auto' },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.description || f.form}
                </Box>
                <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {KIND_WORD[f.kind]}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  color: stand === 'new' ? 'text.primary' : 'text.secondary',
                  fontWeight: stand === 'new' ? 600 : 400,
                  display: { xs: 'none', sm: 'inline' },
                }}
              >
                {stand === 'cited'
                  ? 'in note'
                  : stand === 'new'
                    ? 'new since the note'
                    : 'not cited'}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Detail({ filing }: { filing: PublicFiling }) {
  const note = notesByTicker.get(filing.ticker);
  const stand = note ? standing(filing, note) : 'unused';
  const isPeriodic = filing.kind === 'periodic';
  const ticker = usePublicTicker(isPeriodic ? filing.ticker : '');
  const report = isPeriodic
    ? (ticker.data?.periodic ?? []).find((p) => p.accession === filing.accession)
    : undefined;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const command = `npm run research:new ${filing.ticker}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Box
      component="section"
      aria-labelledby="filing-detail"
      sx={[{ ...PANEL_SX, p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }, DEMO_EDGE]}
    >
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <TickerChip ticker={filing.ticker} />
          <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
            {`${filing.form}${filing.items.length ? ` · Item ${filing.items.filter((it) => it !== '9.01').join(', ')}` : ''} · ${formatNoteDate(filing.filed)}`}
          </Box>
        </Box>
        <Box
          component="h2"
          id="filing-detail"
          sx={{
            ...DISPLAY,
            m: 0,
            fontWeight: 600,
            fontSize: 20,
            lineHeight: 1.25,
            textWrap: 'balance',
          }}
        >
          {filing.description || `${filing.form} filed ${formatNoteDate(filing.filed)}`}
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
          {stand === 'cited'
            ? `The ${filing.ticker} note already cites this filing.`
            : stand === 'new'
              ? `Filed after the ${filing.ticker} note was written${filing.kind === 'results' || filing.kind === 'periodic' ? ', so the note is due for review.' : '.'}`
              : `Filed before the ${filing.ticker} note and not cited by it.`}
        </Box>
      </Box>

      {isPeriodic ? (
        <ReportedFigures filing={filing} read={ticker} report={report} />
      ) : filing.kind === 'results' ? (
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
          A results release. Its tables are in the exhibit; the same figures arrive in
          machine-readable form with the next quarterly or annual report.
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center' }}>
        {stand === 'new' && (filing.kind === 'results' || filing.kind === 'periodic') && (
          <Box
            component="button"
            type="button"
            onClick={() => void copy()}
            sx={{
              minHeight: 44,
              px: 2.25,
              borderRadius: '8px',
              border: 0,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              font: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 100ms ease-out',
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            {copied ? 'Copied' : 'Copy the draft command'}
          </Box>
        )}
        <Box
          component="a"
          href={filing.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={(t) => ({
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            px: 2,
            borderRadius: '8px',
            border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
            color: 'text.primary',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          })}
        >
          Open the filing
        </Box>
      </Box>
      {stand === 'new' && (filing.kind === 'results' || filing.kind === 'periodic') && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}>
          {`Run ${command} in the repo: it writes a dated update note from the latest one, with every figure blanked to re-read against this filing. Nothing published changes until you push it.`}
        </Box>
      )}
      <Box
        component="span"
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {copied ? 'Command copied' : ''}
      </Box>
    </Box>
  );
}

function FeedSkeleton() {
  return (
    <Box aria-busy="true" aria-label="Loading filings" sx={{ ...PANEL_SX, overflow: 'hidden' }}>
      {Array.from({ length: 6 }, (_, i) => (
        <Box
          key={i}
          sx={(t) => ({
            display: 'grid',
            gridTemplateColumns: '64px 56px minmax(0, 1fr)',
            gap: 1.5,
            alignItems: 'center',
            p: '12px 16px',
            borderTop: i === 0 ? 0 : `1px solid ${t.palette.divider}`,
          })}
        >
          {[12, 18, 12].map((h, j) => (
            <Box
              key={j}
              sx={(t) => ({
                height: h,
                width: j === 2 ? `${60 + ((i * 7) % 30)}%` : '100%',
                borderRadius: '4px',
                bgcolor: alpha(t.palette.text.secondary, 0.14),
              })}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/** Production before the operator sets SEC_USER_AGENT: what's missing in the reader's words, what
 *  it would show, what still works, and the operator's step folded away (design: Final · Filings). */
function NotSetUp() {
  return (
    <Box
      component="section"
      aria-labelledby="not-set-up"
      sx={(t) => ({
        ...PANEL_SX,
        border: `1px solid ${alpha(t.palette.text.secondary, 0.25)}`,
        p: { xs: 2, sm: 3 },
        display: 'grid',
        gap: 1.75,
        maxWidth: 920,
      })}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
        <Box
          component="h2"
          id="not-set-up"
          sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 18, lineHeight: 1.3 }}
        >
          SEC filings aren’t set up on this site yet.
        </Box>
        <DataStateTag state="notSetUp" />
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.55, textWrap: 'pretty' }}>
        Filings come from SEC EDGAR, which asks every program that reads it to identify itself with
        a contact address. This site hasn’t been given one, so nothing is fetched and no filing is
        shown. Nothing here is a fault: the notes keep their own dates, so nothing comes due late.
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'max-content minmax(0, 1fr)',
          gap: '8px 16px',
          fontSize: 13,
        }}
      >
        <Box component="dt" sx={{ color: 'text.secondary' }}>
          Would show
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          {`What the ${TICKERS.length} followed companies filed in the last 90 days, newest first; which filings a note hasn’t read yet; reported figures from each quarterly and annual report`}
        </Box>
        <Box component="dt" sx={{ color: 'text.secondary' }}>
          Covers
        </Box>
        <Box component="dd" sx={{ m: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {TICKERS.map((t) => (
            <Box
              component="span"
              key={t}
              sx={(th) => ({
                ...MONO,
                fontSize: 12,
                px: 1,
                py: '2px',
                borderRadius: '6px',
                border: `1px solid ${alpha(th.palette.text.secondary, 0.3)}`,
              })}
            >
              {t}
            </Box>
          ))}
        </Box>
        <Box component="dt" sx={{ color: 'text.secondary' }}>
          Meanwhile
        </Box>
        <Box component="dd" sx={{ m: 0 }}>
          Each note links the filings it cites, and Expected below still works from the notes’ own
          dates
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 20px' }}>
        <Box
          component="a"
          href={`${STAGING_DEMO_URL}/research/filings`}
          sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontWeight: 500 }}
        >
          See sample filings on the demo →
        </Box>
        <Box
          component="a"
          href={EDGAR_SEARCH}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
        >
          Search EDGAR yourself ↗
        </Box>
      </Box>
      <Box component="details" sx={{ fontSize: 13 }}>
        <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 600, py: 1.25 }}>
          For the site’s operator
        </Box>
        <Box component="p" sx={{ m: '4px 0 0', color: 'text.secondary', textWrap: 'pretty' }}>
          Set{' '}
          <Box component="code" sx={{ ...MONO, fontSize: 12 }}>
            SEC_USER_AGENT
          </Box>{' '}
          on the API to a name and a contact email address (EDGAR’s fair-access rule), then restart
          it. Filings appear within the hour; company facts within a day.
        </Box>
      </Box>
    </Box>
  );
}

/** Tickers the feed has nothing for, named rather than silently dropped: the ones EDGAR's ticker map
 *  doesn't know (the API's `missing` list) and the ones that filed nothing in the window. */
function Unlisted({ missing, filings }: { missing: string[]; filings: PublicFiling[] }) {
  const filed = new Set(filings.map((f) => f.ticker));
  const quiet = TICKERS.filter((t) => !missing.includes(t) && !filed.has(t));
  if (missing.length === 0 && quiet.length === 0) return null;
  const list = (ts: string[]) =>
    ts.length === 1 ? ts[0] : `${ts.slice(0, -1).join(', ')} and ${ts[ts.length - 1]}`;
  return (
    <Box
      component="section"
      aria-label="Not in the feed"
      sx={{ display: 'grid', gap: 1, fontSize: 13, color: 'text.secondary' }}
    >
      {missing.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
          <Box
            component="span"
            sx={(t) => ({
              fontSize: 12,
              fontWeight: 500,
              px: 1,
              py: '2px',
              borderRadius: '12px',
              border: `1px solid ${alpha(t.palette.text.secondary, 0.55)}`,
            })}
          >
            Not an SEC filer
          </Box>
          <Box component="span" sx={{ minWidth: 0, textWrap: 'pretty' }}>
            {`${list(missing)} ${missing.length === 1 ? 'isn’t' : 'aren’t'} in EDGAR’s list of company tickers, so there are no company reports to show for ${missing.length === 1 ? 'it' : 'them'}. Funds and some foreign issuers read this way.`}
          </Box>
        </Box>
      )}
      {quiet.length > 0 && (
        <Box component="span" sx={{ textWrap: 'pretty' }}>
          {DEMO
            ? `${list(quiet)} ${quiet.length === 1 ? 'has' : 'have'} no sample filings in this scenario.`
            : `${list(quiet)} filed nothing in the last 90 days (ownership forms 3, 4, 5 and 144 are left out).`}
        </Box>
      )}
    </Box>
  );
}

/** "$96.2B", "$885.0M", "$2.31" for a per-share figure. */
function figure(v: number, unit: string) {
  if (unit.includes('/shares')) return `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9)
    return `${sign}$${(a / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`;
  if (a >= 1e6)
    return `${sign}$${(a / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
  return `${sign}${a.toLocaleString('en-US')}`;
}

type Periodic = PublicTicker['periodic'][number];

/** A periodic report's figures against the prior period, in the chart frame: a finding from the
 *  figures, a change column (▲/▼, neutral), the source chip. A failed request says Couldn't load
 *  and offers Try again; "not yet" is kept for figures that genuinely haven't arrived. */
function ReportedFigures({
  filing,
  read,
  report,
}: {
  filing: PublicFiling;
  read: ReturnType<typeof usePublicTicker>;
  report: Periodic | undefined;
}) {
  const failed = !!read.error || (!!read.data && read.data.filings_state !== 'live');
  const facts = report?.facts ?? [];
  const lead = facts.find((f) => f.concept === 'Revenue') ?? facts[0];
  const leadChange = lead ? figureChange(lead.prior_value, lead.value) : null;
  const finding = lead
    ? `${DEMO ? 'Sample figures: ' : ''}${lead.label} ${figure(lead.value, lead.unit)}${
        leadChange && lead.prior_period_end
          ? `, ${leadChange.replace('▲', 'up').replace('▼', 'down').replace('± ', 'flat at ')} from the period to ${formatShortDate(lead.prior_period_end)}`
          : ''
      }`
    : 'Reported figures';
  const status: ChartStatus =
    read.loading && !read.data
      ? { kind: 'loading' }
      : failed
        ? {
            kind: 'message',
            tone: 'warn',
            text: 'Couldn’t load the reported figures.',
            cause: `${read.data?.filings_detail ?? `The SEC company-facts request failed${read.error ? ` (${read.error})` : ''}.`} The filing itself is linked below.`,
          }
        : facts.length === 0
          ? {
              kind: 'message',
              tone: 'quiet',
              text: 'The machine-readable figures for this report aren’t available yet.',
              cause:
                'The SEC adds them to its company facts after the filing; the filing itself has them now.',
            }
          : { kind: 'ready' };
  const cell = (t: Theme) => ({
    ...MONO,
    textAlign: 'right' as const,
    py: 1.25,
    pr: 1,
    borderBottom: `1px solid ${t.palette.divider}`,
  });
  return (
    <ChartFrame
      finding={finding}
      metric="Reported figures"
      sub={`${filing.form}${report?.period_end ? `, period to ${formatNoteDate(report.period_end)}` : ''}, against the prior period of the same length · change with ▲/▼`}
      height={160}
      status={status}
      provenance={DEMO ? 'sample' : 'primary'}
      tag={
        failed
          ? { state: 'couldntLoad' }
          : status.kind !== 'ready'
            ? undefined
            : DEMO
              ? { state: 'demo' }
              : { state: 'updated', detail: `filed ${formatShortDate(filing.filed)}` }
      }
      source={
        DEMO
          ? { text: 'Demo · shaped like SEC EDGAR company facts' }
          : { text: 'SEC · company facts (XBRL)', href: filing.url }
      }
      asOf={DEMO ? 'Scenario · Oct 7, 2026' : `Filed ${formatNoteDate(filing.filed)}`}
      action={
        failed ? (
          <Box
            component="button"
            type="button"
            onClick={read.retry}
            sx={(t) => ({
              minHeight: 36,
              px: 1.75,
              borderRadius: '8px',
              border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
              bgcolor: 'transparent',
              color: 'text.primary',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              '@media (pointer: coarse)': { minHeight: 44 },
            })}
          >
            Try again
          </Box>
        ) : undefined
      }
      testId="chart-reported-figures"
    >
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <Box
          component="caption"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          {`Reported figures, ${filing.ticker} ${filing.form}, against the prior period`}
        </Box>
        <thead>
          <Box component="tr">
            {['Figure', 'This period', 'Prior period', 'Change'].map((h, i) => (
              <Box
                component="th"
                scope="col"
                key={h}
                sx={(t) => ({
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  py: 0.75,
                  pr: i === 3 ? 0 : 1,
                  textAlign: i === 0 ? 'left' : 'right',
                  borderBottom: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
                })}
              >
                {h}
              </Box>
            ))}
          </Box>
        </thead>
        <tbody>
          {facts.map((fact) => (
            <Box component="tr" key={fact.concept}>
              <Box
                component="th"
                scope="row"
                sx={(t) => ({
                  textAlign: 'left',
                  fontWeight: 500,
                  py: 1.25,
                  pr: 1,
                  borderBottom: `1px solid ${t.palette.divider}`,
                })}
              >
                {fact.label}
              </Box>
              <Box component="td" sx={cell}>
                {figure(fact.value, fact.unit)}
                <Box
                  component="span"
                  sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}
                >
                  {formatShortDate(fact.period_end)}
                </Box>
              </Box>
              <Box component="td" sx={(t) => ({ ...cell(t), color: 'text.secondary' })}>
                {fact.prior_value == null ? '—' : figure(fact.prior_value, fact.unit)}
                {fact.prior_period_end && (
                  <Box component="span" sx={{ display: 'block', fontSize: 11 }}>
                    {formatShortDate(fact.prior_period_end)}
                  </Box>
                )}
              </Box>
              <Box component="td" sx={(t) => ({ ...cell(t), pr: 0, whiteSpace: 'nowrap' })}>
                {figureChange(fact.prior_value, fact.value) ?? '—'}
              </Box>
            </Box>
          ))}
        </tbody>
      </Box>
    </ChartFrame>
  );
}
