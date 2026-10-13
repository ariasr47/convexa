/**
 * Filings: what the followed companies filed with the SEC, newest first, each marked against its note
 * (cited, new since the note, or unused). A periodic report shows the figures it reported against the
 * prior period; a results release says where its figures will arrive. The filter lives in the URL so
 * Back and a shared link keep it; j and k move through the list, o opens the filing.
 */
import { dataMode, type PublicFiling } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { localToday, researchIndex, upcoming } from 'virtual:convexa-research';
import { standing } from './filings';
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

const notesByTicker = new Map(researchIndex.map((r) => [r.ticker, r.latest]));
const TICKERS = researchIndex.map((r) => r.ticker);

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
      researchIndex
        .flatMap((r) =>
          upcoming(r.latest.aging.events, today, 42)
            .filter((u) => /results|earnings/i.test(u.label))
            .map((u) => ({ ...u, ticker: r.ticker })),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [today],
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
              {`What the ${TICKERS.length} followed companies filed with the SEC, newest first. A results or quarterly filing the note hasn't read makes it due.`}
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
            <Box
              component="span"
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
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

        {expected.length > 0 && (
          <Box component="section" aria-labelledby="expected" sx={{ display: 'grid', gap: 1 }}>
            <Caps>
              <span id="expected">Expected · next six weeks</span>
            </Caps>
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
                    border: `1px dashed ${alpha(t.palette.text.secondary, 0.4)}`,
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
                </Box>
              ))}
            </Box>
          </Box>
        )}

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
          <SourceProblem
            title="SEC filings aren't set up yet."
            body="EDGAR asks every program that reads it to identify itself with a contact address. Set SEC_USER_AGENT on the API and filings appear here."
          />
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
      sx={{ ...PANEL_SX, listStyle: 'none', m: 0, p: 0, overflow: 'hidden' }}
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
  const fmt = (v: number, unit: string) =>
    unit.includes('/shares')
      ? `$${v.toFixed(2)}`
      : Math.abs(v) >= 1e9
        ? `$${(v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`
        : Math.abs(v) >= 1e6
          ? `$${(v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
          : v.toLocaleString('en-US');
  return (
    <Box
      component="section"
      aria-labelledby="filing-detail"
      sx={{ ...PANEL_SX, p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}
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
        ticker.loading && !ticker.data ? (
          <Box
            sx={(t) => ({
              height: 160,
              borderRadius: '8px',
              bgcolor: alpha(t.palette.text.secondary, 0.06),
            })}
            aria-busy="true"
            aria-label="Loading the reported figures"
          />
        ) : report && report.facts.length > 0 ? (
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <Box component="tr" sx={{ textAlign: 'left' }}>
                {['Figure', 'This period', 'Prior period'].map((h, i) => (
                  <Box
                    component="th"
                    scope="col"
                    key={h}
                    sx={(t) => ({
                      ...{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                      },
                      py: 0.75,
                      pr: 1,
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
              {report.facts.map((fact) => (
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
                  <Box
                    component="td"
                    sx={(t) => ({
                      ...MONO,
                      textAlign: 'right',
                      py: 1.25,
                      pr: 1,
                      borderBottom: `1px solid ${t.palette.divider}`,
                    })}
                  >
                    {fmt(fact.value, fact.unit)}
                    <Box
                      component="span"
                      sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}
                    >
                      {formatShortDate(fact.period_end)}
                    </Box>
                  </Box>
                  <Box
                    component="td"
                    sx={(t) => ({
                      ...MONO,
                      textAlign: 'right',
                      py: 1.25,
                      color: 'text.secondary',
                      borderBottom: `1px solid ${t.palette.divider}`,
                    })}
                  >
                    {fact.prior_value == null ? '—' : fmt(fact.prior_value, fact.unit)}
                    {fact.prior_period_end && (
                      <Box component="span" sx={{ display: 'block', fontSize: 11 }}>
                        {formatShortDate(fact.prior_period_end)}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </tbody>
          </Box>
        ) : (
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
            The machine-readable figures for this report aren&apos;t available yet. The filing
            itself has them.
          </Box>
        )
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
