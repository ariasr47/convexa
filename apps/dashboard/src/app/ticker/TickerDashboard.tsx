/**
 * Ticker viewer — recomposed from reusable section components (convexa-redesign Ticker re-skin +
 * componentize). The monolith's stat-tile grid, headline, toolbar, term-structure card, fresh
 * positioning, off-exchange blocks, setups, and GEX chart are now the `ticker/sections/*` components
 * (StatTile · TickerToolbar · TickerHeader · LiveTape · DealerPositioning · GexStrikeProfile ·
 * TermStructureCard · FreshPositioning · OffExchangeBlocks · Setups). This file is the COMPOSITION +
 * data wiring only.
 *
 * RE-SKIN + COMPONENTIZE, NOT a logic rewrite (FRONTEND_EXECUTION_CONTRACT hard rules): the bundle
 * poll (~60s), the page-scoped SSE subscription + payload-gap watchdog, the AI-rec hook, the
 * ghost-trade/portfolio/persona wiring, the skeleton-first load, the four-metric nullability, and the
 * scoring readout are all UNCHANGED. The connection state is a STREAM-DRIVEN status indicator (NOT a
 * "Connection (demo)" toggle). Invariants honored: `[live-vs-static-isolation]`,
 * `[best-effort-isolated-or-null]`, `[additive-keeps-score-byte-identical]`, `[no-real-order-path]`,
 * `[operator-vs-trader-path-separation]`.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Container, Box, Alert, Button, Skeleton, Fade, Tooltip, Typography,
} from '@mui/material';
import { getTicker, streamTicker, TickerBundle, LiveUpdate, RecResponse } from '@org/api';
import { useGhostTrade } from '../ghost-trade/useGhostTrade';
import { TradeEntryDialog, EntryPrefill } from '../ghost-trade/TradeEntryDialog';
import { PrimeBanner, tierMeta } from '../ghost-trade/OpportunityTier';
import { usePersona } from '../personas/usePersona';
import { PersonaCustomizeForm } from '../personas/components';
import { AiRecPanel, useReadPersonas } from '../ai-rec/AiRecPanel';
import { useAiRecommendation } from '../ai-rec/useAiRecommendation';
import { StateExportDrawer } from '../ai-rec/StateExportDrawer';
import { recToPrefill } from '../ai-rec/prefill';
import { COPY } from '../ai-rec/copy';

import { StatSkeleton } from './sections/StatTile';
import { WidgetSelectionProvider } from './sections/WidgetSelectionContext';
import { ComingSoonBox } from '../ui/ComingSoonBox';
import { TickerToolbar } from './sections/TickerToolbar';
import { TickerHeader, LastTradeReadout } from './sections/TickerHeader';
import { LiveTape } from './sections/LiveTape';
import { DealerPositioning } from './sections/DealerPositioning';
import { GexStrikeProfile } from './sections/GexStrikeProfile';
import { TermStructureCard } from './sections/TermStructure';
import { FreshPositioning } from './sections/FreshPositioning';
import { OffExchangeBlocks } from './sections/OffExchangeBlocks';
import { Setups } from './sections/Setups';
import { FreshnessLine } from './sections/FreshnessLine';
import { humanAge } from './sections/copy';

const POLL_MS = 60_000; // matches the backend cache TTL
// A healthy SSE session pushes a payload every ~1.5s even when the market isn't ticking, so an
// onmessage gap this long means the transport dropped — not a quiet session. Flips "Live offline".
const STREAM_OFFLINE_MS = 15_000;

// The cold-load stat grid: the full tile structure as shimmer (AC-Skel-1).
function StatGridSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
      {Array.from({ length: 12 }).map((_, i) => <StatSkeleton key={i} />)}
    </Box>
  );
}

export function TickerDashboard() {
  const { ticker = 'TSLA' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TickerBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState(ticker);
  const [live, setLive] = useState<LiveUpdate | null>(null);
  // Stream Offline: set when the SSE transport drops (no payload for > STREAM_OFFLINE_MS after having
  // been live). Degrades ONLY the live-derived tiles + the connection chip; the static bundle is
  // untouched. Clears on the next payload (auto-reconnect).
  const [streamOffline, setStreamOffline] = useState(false);
  // Expiration filter: null = all (no filter), [] = none selected, else an explicit subset.
  const [selected, setSelected] = useState<string[] | null>(null);
  // Dark-pool (off-exchange) context: fixed ON (the toolbar toggle was removed to match the Figma).
  const darkPool = true;

  // "Live" only if a real tick arrived recently AND the transport isn't offline.
  const isLive = (live?.live ?? false) && !streamOffline;
  const gt = useGhostTrade(ticker, data, live, isLive, streamOffline);
  const persona = usePersona();

  // AI recommendation (independently-nullable sibling card).
  const { personas: readPersonas } = useReadPersonas(persona.personas);
  const [readPersonaId, setReadPersonaId] = useState('default');
  useEffect(() => { setReadPersonaId(persona.activeId); }, [persona.activeId]);
  const aiRec = useAiRecommendation(ticker, data, {
    personaId: persona.activeId === 'default' ? null : persona.activeId,
    personaName: persona.active.name,
    dteMin: data?.market_state.dte_min ?? null,
    dteMax: data?.market_state.dte_max ?? null,
    darkPool,
  });
  const [exportDrawer, setExportDrawer] = useState<{ open: boolean; personaId: string | null }>({ open: false, personaId: null });
  const openExport = useCallback((personaId: string | null) => setExportDrawer({ open: true, personaId }), []);

  // Persona DTE pre-fill (one-shot, explicit-navigation only).
  const [dtePrefill, setDtePrefill] = useState<{ min: number; max: number; persona: string } | null>(null);
  const pendingPrefill = useRef<{ min: number; max: number } | null>(null);

  const load = useCallback(() => {
    if (selected !== null && selected.length === 0) return; // nothing selected -> nothing to fetch
    const pf = pendingPrefill.current; pendingPrefill.current = null; // consume one-shot
    setLoading(true);
    getTicker(ticker, {
      expirations: selected ?? undefined, darkPool, position: gt.positionQuery,
      minDte: pf?.min, maxDte: pf?.max,
    })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, selected, darkPool, gt.positionQuery]);

  // Reset the filter to "all" whenever the ticker changes; clear data + any prior error.
  useEffect(() => { setSelected(null); setData(null); setError(null); }, [ticker]);

  // (Re)load on ticker/selection change, then poll on the cache cadence.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Live SSE stream + payload-gap watchdog (stream-drop detection). The watchdog never touches the
  // static bundle. The next payload (EventSource auto-reconnects) clears offline.
  useEffect(() => {
    setLive(null);
    setStreamOffline(false);
    if (selected !== null && selected.length === 0) return;
    let gapTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = streamTicker(ticker, { expirations: selected ?? undefined }, (u) => {
      setLive(u);
      setStreamOffline(false);
      if (gapTimer) clearTimeout(gapTimer);
      gapTimer = setTimeout(() => setStreamOffline(true), STREAM_OFFLINE_MS);
    });
    return () => { if (gapTimer) clearTimeout(gapTimer); unsub(); };
  }, [ticker, selected]);

  const theme = useTheme();
  const m = data?.market_state;
  const fresh = data?.meta.freshness;
  const sig = data?.signals;

  // Vol/OI "Fresh positioning": strikes at/above the cutoff, ranked desc, short top-N (full-chain).
  const volOiThreshold = m?.vol_oi_unusual_threshold ?? 1;
  const unusualStrikes = (data?.strike_profile.strikes ?? [])
    .filter((s) => s.vol_oi_ratio != null && s.vol_oi_ratio >= volOiThreshold)
    .sort((a, b) => (b.vol_oi_ratio as number) - (a.vol_oi_ratio as number))
    .slice(0, 8);

  const allDates = data?.expirations.map((e) => e.date) ?? [];
  const noneSelected = selected !== null && selected.length === 0;
  const checked = selected ?? allDates; // dates shown ticked in the menu

  // Ghost-trade entry dialog + Prime banner.
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryPrefill, setEntryPrefill] = useState<EntryPrefill | undefined>();
  const [showPrimeBanner, setShowPrimeBanner] = useState(false);
  const prevTierRef = useRef<string | null>(null);
  const tradeOpen = gt.trade?.status === 'open';
  useEffect(() => {
    const t = sig?.opportunity_tier;
    if (t === 'prime' && sig?.prime_prompt_eligible && prevTierRef.current !== 'prime') setShowPrimeBanner(true);
    if (t !== 'prime') setShowPrimeBanner(false);
    prevTierRef.current = t ?? null;
  }, [sig?.opportunity_tier, sig?.prime_prompt_eligible]);
  const openEntry = (prefill?: EntryPrefill) => {
    setEntryPrefill(prefill); setEntryOpen(true);
  };
  // Accept an AI rec → pre-fill the SHIPPED ghost-trade entry dialog (every field editable). Nothing
  // is tracked until the user confirms; no Accept path exists for a no_trade rec (panel omits it).
  const onAcceptRec = (rec: RecResponse, personaName: string) => {
    if (!rec.strategy) return;
    const pf = recToPrefill(rec.strategy, personaName, COPY.accept.sizing);
    if (pf) openEntry(pf);
  };
  const strikeList = Array.from(new Set((data?.strike_profile.strikes ?? []).map((s) => s.strike))).sort((a, b) => a - b);
  const tm = tierMeta(theme, sig?.opportunity_tier ?? 'dormant');

  // Persona customize dialog (the hand-off viewer was removed to match the Figma toolbar).
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Offer the active persona's DTE preference as a staged pre-fill — ONLY when the user hasn't set an
  // explicit expiration window. Setting it touches no fetch; applied to the next nav via the one-shot.
  useEffect(() => {
    if (selected !== null) { setDtePrefill(null); return; } // user picked expirations → their window wins
    const pref = persona.active.dte_pref;
    setDtePrefill(pref ? { min: pref.min_dte, max: pref.max_dte, persona: persona.active.name } : null);
  }, [persona.active, selected]);

  const onSubmitSymbol = () => {
    // Apply the staged DTE pre-fill to THIS explicit navigation only (one-shot).
    if (dtePrefill) pendingPrefill.current = { min: dtePrefill.min, max: dtePrefill.max };
    navigate(`/ticker/${symbol}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <TickerToolbar
        symbol={symbol} onSymbolChange={setSymbol} onSubmitSymbol={onSubmitSymbol}
        expirations={data?.expirations ?? []} allDates={allDates} selected={selected}
        checked={checked} onSelectExpirations={setSelected}
        persona={persona} onOpenCustomize={() => setCustomizeOpen(true)}
        loading={loading}
      />

      {/* Cold-start failure (no bundle ever loaded) is the ONLY blank/error screen: red error + Retry.
          A poll failure AFTER a prior success keeps the whole bundle on screen behind a soft warning. */}
      {error && !data && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}
        >
          {error}
        </Alert>
      )}
      {error && data && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Couldn't refresh — showing data from {humanAge(fresh?.data_age_seconds ?? null)} ago. Retrying automatically.
        </Alert>
      )}

      {/* COLD-LOAD skeleton (AC-Skel-1): structure paints as shimmer; the last-trade line fills on the
          first SSE payload, the rest on the REST bundle. Skeleton class never appears post-load. */}
      {!data && !error && !noneSelected && (
        <Box data-testid="cold-load">
          <Box sx={{ mb: 1 }}>
            <Skeleton variant="text" width={280} sx={{ fontSize: '3rem' }} />
            <LastTradeReadout live={live} streamOffline={streamOffline} />
          </Box>
          <StatGridSkeleton />
        </Box>
      )}

      {noneSelected && (
        <Alert severity="info">
          No expirations selected — pick one or more above, or click <strong>All</strong>.
        </Alert>
      )}

      {!noneSelected && m && (
        <Fade in appear timeout={250}>
          <Box>
          {showPrimeBanner && !tradeOpen && (
            <PrimeBanner onSimulate={() => openEntry()} onDismiss={() => setShowPrimeBanner(false)} />
          )}

          {/* Headline ANCHOR + secondary last-trade readout + the persistent "+ Open simulated trade"
              CTA (right-aligned in the header, so it stays out of the analysis flow). Not a widget. */}
          <TickerHeader
            m={m} sig={sig} live={live} isLive={isLive} streamOffline={streamOffline} selected={selected}
            onOpenTrade={() => openEntry()}
          />

          {/* REST-bundle freshness caption (static path, NOT live/SSE). Not a widget. */}
          <FreshnessLine
            snapshotIso={fresh?.snapshot_iso ?? null}
            dataAgeSeconds={fresh?.data_age_seconds ?? null}
            refreshing={loading}
          />

          {/* The widget BENTO board. One-selected-at-a-time selection is provided here (click-outside
              clears — the provider's ClearOnOutside listener lives inside each selected Widget). The
              grid is a two-column bento: full-width rows (Live tape · Dealer · GEX · Setups, span 2)
              and paired cells (Term‖AI-rec, Fresh‖Off-exchange). Container queries drive each cell's
              internals, so a widget looks right at any cell size. */}
          <WidgetSelectionProvider>
            <Box
              data-testid="widget-bento"
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gridAutoRows: 'minmax(0, auto)',
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              {/* LIVE-DERIVED tiles — dim on an SSE drop (span 2). */}
              <LiveTape m={m} live={live} isLive={isLive} streamOffline={streamOffline} />

              {/* STATIC positioning tiles — stay rendered on an SSE drop; each nullable its own empty. */}
              <DealerPositioning
                m={m} sig={sig} offExchange={data?.off_exchange}
                volOiThreshold={volOiThreshold} unusualCount={unusualStrikes.length}
                tierWord={tm.word} tierColor={tm.color} opportunityScore={sig?.opportunity_score ?? 0}
              />

              {data?.strike_profile && (
                <GexStrikeProfile
                  strikes={data.strike_profile.strikes}
                  spot={m.gex_spot ?? m.price}
                  callWall={m.call_wall}
                  putWall={m.put_wall}
                  gammaFlip={live?.gamma_flip ?? m.gamma_flip}
                  liveSpot={isLive ? live!.mid : null}
                />
              )}

              {/* Paired cell: Term structure (left) + the independently-nullable AI-rec (right). */}
              <TermStructureCard termStructure={m.term_structure} />
              <AiRecPanel
                ticker={ticker} bundle={data} ai={aiRec} personas={readPersonas}
                activePersonaId={persona.activeId}
                dataAge={fresh ? humanAge(fresh.data_age_seconds) : null}
                onAccept={onAcceptRec} onViewExport={openExport}
                readPersonaId={readPersonaId} onChangeReadPersona={setReadPersonaId}
                fillHeight
              />

              {/* Paired cell: Fresh positioning + Off-exchange blocks. Off-exchange is REST-only; with
                  Dark pool off, Fresh positioning takes the full row. */}
              <FreshPositioning
                chainVolOiRatio={m.chain_vol_oi_ratio}
                volOiThreshold={volOiThreshold} unusualStrikes={unusualStrikes}
              />
              {darkPool && <OffExchangeBlocks offExchange={data?.off_exchange} />}

              <Setups setups={sig?.setups} />

              {/* Inert "+ Add widget" ghost slot — affordance-only (coming soon). Reuses the hatched
                  ComingSoonBox; cursor:not-allowed; tooltip. Never links or fake-adds anything. */}
              <Tooltip arrow title="Add widget — coming soon">
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}>
                  <ComingSoonBox
                    data-testid="add-widget-slot"
                    aria-disabled
                    sx={{
                      cursor: 'not-allowed', minHeight: 72, borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                      + Add widget
                    </Typography>
                  </ComingSoonBox>
                </Box>
              </Tooltip>
            </Box>
          </WidgetSelectionProvider>
          </Box>
        </Fade>
      )}

      {/* Ghost-trade entry. */}
      <TradeEntryDialog
        open={entryOpen && !tradeOpen}
        ticker={ticker}
        expirations={allDates}
        strikes={strikeList}
        spot={m?.price ?? 0}
        prefill={entryPrefill}
        onClose={() => setEntryOpen(false)}
        onConfirm={(form) => { gt.openTrade(form); setEntryOpen(false); }}
      />

      {/* Persona customize — presentation-only, off the compute path. */}
      <PersonaCustomizeForm open={customizeOpen} onClose={() => setCustomizeOpen(false)} persona={persona} />

      {/* The structured-state export floor — reachable from the rec panel ("View what's sent"). */}
      <StateExportDrawer
        open={exportDrawer.open} ticker={ticker} personaId={exportDrawer.personaId}
        onClose={() => setExportDrawer((s) => ({ ...s, open: false }))}
      />
    </Container>
  );
}

export default TickerDashboard;
