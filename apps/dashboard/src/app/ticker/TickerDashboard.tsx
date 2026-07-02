/**
 * Ticker viewer — recomposed from reusable section components (convexa-redesign Ticker re-skin +
 * componentize). The monolith's stat-tile grid, headline, toolbar, term-structure card, fresh
 * positioning, off-exchange blocks, setups, and GEX chart are now the `ticker/widgets/*` components
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
import { useGhostTrade, NewTradeForm } from '../ghost-trade/useGhostTrade';
import {
  TradeEntryDialog, EntryPrefill, TradeEntrySubmit, OrderPlan, OrderEntrySubmit,
} from '../trading/TradeEntryDialog';
import { PrimeBanner, tierMeta } from '../ghost-trade/OpportunityTier';
import { usePersona } from '../personas/usePersona';
import { PersonaCustomizeForm } from '../personas/components';
import { AiRecPanel, useReadPersonas } from '../ai-rec/AiRecPanel';
import { useAiRecommendation } from '../ai-rec/useAiRecommendation';
import { StateExportDrawer } from '../ai-rec/StateExportDrawer';
import { recToPrefill } from '../ai-rec/prefill';
import { COPY } from '../ai-rec/copy';
import { OrdersWidget } from '../orders/OrdersWidget';
import { useOrderEngine } from '../orders/useOrderEngine';
import { createOrder } from '../orders/useOrders';
import { parseTriggerSeed } from '../orders/seed';
import { GATE_SIGN_IN } from '../orders/copy';
import type { OrderProvenance } from '../orders/types';
import { useGate } from '../auth/useGate';
import { SignInPrompt } from '../auth/SignInPrompt';

import { StatSkeleton } from './widgets/StatTile';
import { WidgetSelectionProvider } from './widgets/WidgetSelectionContext';
import { ComingSoonBox } from '../ui/ComingSoonBox';
import { TickerToolbar } from './widgets/TickerToolbar';
import { CommandDeck } from './widgets/CommandDeck';
import { LastTradeReadout } from './widgets/TickerHeader';
import { LiveTape } from './widgets/LiveTape';
import { DealerPositioning } from './widgets/DealerPositioning';
import { GexStrikeProfile } from './widgets/GexStrikeProfile';
import { TermStructureCard } from './widgets/TermStructure';
import { FreshPositioning } from './widgets/FreshPositioning';
import { OffExchangeBlocks } from './widgets/OffExchangeBlocks';
import { Setups } from './widgets/Setups';
import { humanAge } from './widgets/copy';

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

  // ---- ai-rec-backtest-orders: the Act flow (order variant of the SAME shared dialog) ----------
  // The sim-order engine evaluates THIS ticker's orders off THIS page's existing stream (arch §5 —
  // it opens no EventSource of its own and adds nothing to any request, AC-44).
  useOrderEngine({ ticker, bundle: data, live, isLive, streamOffline });
  const orderGate = useGate();
  const [actState, setActState] = useState<{
    open: boolean; plan?: OrderPlan; prefill?: EntryPrefill; provenance?: OrderProvenance;
  }>({ open: false });
  const [orderError, setOrderError] = useState<string | null>(null);
  // Act on a produced TRADE rec (real or scenario): seeds contract/qty/stop/target via the
  // EXISTING recToPrefill rules (D3) + the D2 trigger seed; the verbatim entry_trigger text and
  // the rec's pin travel as provenance. Signed-out ⇒ the standard gated-write prompt, no dialog.
  const onActRec = (rec: RecResponse, personaName: string) => {
    if (!rec.strategy || rec.strategy.decision !== 'trade') return;
    if (!orderGate.allowed) { orderGate.prompt(GATE_SIGN_IN); return; }
    orderGate.clear();
    const pf = recToPrefill(rec.strategy, personaName, COPY.accept.sizing);
    if (!pf) return;
    const scenario = rec.scenario ?? null;
    const provenance: OrderProvenance = {
      source: scenario ? 'ai_scenario' : 'ai_rec',
      rec_fingerprint: rec.pinned_fingerprint,
      rec_as_of: rec.as_of,
      persona: { id: rec.persona.id, name: rec.persona.name },
      ...(scenario ? { scenario_id: scenario.id, scenario_name: scenario.name } : {}),
      trigger_source_text: rec.strategy.entry_trigger ?? null,
    };
    const plan: OrderPlan = {
      seededTrigger: parseTriggerSeed(rec.strategy.entry_trigger),
      triggerSourceText: rec.strategy.entry_trigger ?? null,
      provenance: {
        source: scenario ? 'ai_scenario' : 'ai_rec',
        personaName: rec.persona.name,
        asOf: rec.as_of,
        ...(scenario ? { scenarioName: scenario.name } : {}),
      },
      stale: aiRec.stale,
      liveMid: isLive ? live?.mid ?? null : null,
    };
    setOrderError(null);
    setActState({ open: true, plan, prefill: pf, provenance });
  };
  // Confirm = the gated, state-bearing write: the SERVER gate is awaited BEFORE the local orders
  // store write ([server-side-gate-enforcement], AC-11). 403 ⇒ prompt + abort, ZERO order; 503 ⇒
  // the shipped "couldn't reach sign-in" copy + abort. A faulted store ⇒ inline error, nothing
  // partial (§4.6).
  const onConfirmOrder = async (submit: OrderEntrySubmit) => {
    const provenance = actState.provenance;
    if (!provenance) return;
    let ran = false;
    await orderGate.guard(GATE_SIGN_IN, () => {
      ran = true;
      const res = createOrder({
        ticker: submit.ticker, expiration: submit.expiration, strike: submit.strike,
        right: submit.right, qty: submit.qty, trigger: submit.trigger,
        limit_price: submit.limitPrice, stop: submit.stop, target: submit.target,
        expires_at: submit.expiresAt, provenance,
      }, { spot: live?.mid ?? m?.price ?? 0, tier: sig?.opportunity_tier ?? '' });
      if (!res.ok) { setOrderError(res.reason ?? null); return; }
      setOrderError(null);
      setActState({ open: false });
    }, { serverGate: orderGate.simTradeGate });
    // Gate rejected (403/503) ⇒ the flow ABORTS before anything is stored; re-initiate after
    // sign-in (no auto-resume, D10).
    if (!ran) setActState({ open: false });
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
      {/* Whenever the full deck is NOT shown (cold-load / cold-start error / none-selected) the deck
          hero has no market state to anchor, so only the control strip renders standalone — the trader
          can still change ticker/expirations. Once `m` is present AND some expirations are selected,
          the full CommandDeck (hero + strip + sticky) renders in its place, below. */}
      {!(m && !noneSelected) && (
        <Box sx={{ mb: 2 }}>
          <TickerToolbar
            symbol={symbol} onSymbolChange={setSymbol} onSubmitSymbol={onSubmitSymbol}
            expirations={data?.expirations ?? []} allDates={allDates} selected={selected}
            checked={checked} onSelectExpirations={setSelected}
            persona={persona} onOpenCustomize={() => setCustomizeOpen(true)}
            loading={loading}
          />
        </Box>
      )}

      {/* In-context sign-in prompt for a gated Act (D8-6/D10 — the standard gated-write pattern):
          a 403 at confirm aborts the flow with ZERO order stored and surfaces this. */}
      <SignInPrompt
        text={orderGate.promptText}
        onSignIn={() => orderGate.signIn(orderGate.promptText ?? GATE_SIGN_IN)}
        testid="orders-signin-prompt"
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

          {/* The unified COMMAND DECK — chrome (NOT a widget): the hero identity row (regime +
              connection chips, the anchor, the meta line folding last-trade + the relocated freshness,
              the "+ Open simulated trade" CTA), the segmented control strip, a downward hand-off
              gradient, and a scroll-out sticky condensed bar. Sits above the widget board. */}
          <CommandDeck
            m={m} sig={sig} live={live} isLive={isLive} streamOffline={streamOffline} selected={selected}
            onOpenTrade={() => openEntry()}
            freshness={{
              snapshotIso: fresh?.snapshot_iso ?? null,
              dataAgeSeconds: fresh?.data_age_seconds ?? null,
              refreshing: loading,
            }}
            symbol={symbol} onSymbolChange={setSymbol} onSubmitSymbol={onSubmitSymbol}
            expirations={data?.expirations ?? []} allDates={allDates}
            checked={checked} onSelectExpirations={setSelected}
            persona={persona} onOpenCustomize={() => setCustomizeOpen(true)}
            loading={loading}
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
              {/* `revealIndex` = board position → the one-time staggered mount reveal (§3): each
                  section rises + fades in ~55ms after the previous one. Reduced-motion → instant. */}
              {/* LIVE-DERIVED tiles — dim on an SSE drop (span 2). */}
              <LiveTape m={m} live={live} isLive={isLive} streamOffline={streamOffline} revealIndex={0} />

              {/* STATIC positioning tiles — stay rendered on an SSE drop; each nullable its own empty. */}
              <DealerPositioning
                m={m} sig={sig} offExchange={data?.off_exchange}
                volOiThreshold={volOiThreshold} unusualCount={unusualStrikes.length}
                tierWord={tm.word} tierColor={tm.color} opportunityScore={sig?.opportunity_score ?? 0}
                revealIndex={1}
              />

              {data?.strike_profile && (
                <GexStrikeProfile
                  strikes={data.strike_profile.strikes}
                  spot={m.gex_spot ?? m.price}
                  callWall={m.call_wall}
                  putWall={m.put_wall}
                  gammaFlip={live?.gamma_flip ?? m.gamma_flip}
                  liveSpot={isLive ? live!.mid : null}
                  revealIndex={2}
                />
              )}

              {/* Paired cell: Term structure (left) + the independently-nullable AI-rec (right). */}
              <TermStructureCard termStructure={m.term_structure} revealIndex={3} />
              <AiRecPanel
                ticker={ticker} bundle={data} ai={aiRec} personas={readPersonas}
                activePersonaId={persona.activeId}
                dataAge={fresh ? humanAge(fresh.data_age_seconds) : null}
                onAccept={onAcceptRec} onAct={onActRec} onViewExport={openExport}
                readPersonaId={readPersonaId} onChangeReadPersona={setReadPersonaId}
                fillHeight revealIndex={4}
              />

              {/* Simulated orders — directly after the AI-rec widget (act → watch reads as one
                  motion, UX §4.4); next revealIndex in the cascade (the sections below shift +1). */}
              <OrdersWidget
                ticker={ticker} live={live} isLive={isLive} streamOffline={streamOffline}
                revealIndex={5}
              />

              {/* Paired cell: Fresh positioning + Off-exchange blocks. Off-exchange is REST-only; with
                  Dark pool off, Fresh positioning takes the full row. */}
              <FreshPositioning
                chainVolOiRatio={m.chain_vol_oi_ratio}
                volOiThreshold={volOiThreshold} unusualStrikes={unusualStrikes}
                revealIndex={6}
              />
              {darkPool && <OffExchangeBlocks offExchange={data?.off_exchange} revealIndex={7} />}

              <Setups setups={sig?.setups} revealIndex={8} />

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

      {/* Ghost-trade entry — the SHARED sim-entry dialog (`trading/TradeEntryDialog`). The single-
          trade engine has no resting-limit lifecycle (no `restingLimit`), so the mode-tagged submit
          maps onto the existing `NewTradeForm`: manual/limit open immediately at the typed price
          (basis `manual`, the shipped behavior); market opens at the resolved snapshot/theoretical
          fill. `useGhostTrade.openTrade` is unchanged. */}
      <TradeEntryDialog
        open={entryOpen && !tradeOpen}
        ticker={ticker}
        expirations={allDates}
        strikes={strikeList}
        spot={m?.price ?? 0}
        prefill={entryPrefill}
        onClose={() => setEntryOpen(false)}
        onConfirm={(s: TradeEntrySubmit) => {
          const base = { expiration: s.expiration, strike: s.strike, right: s.right, qty: s.qty, stop: s.stop, target: s.target };
          const form: NewTradeForm =
            s.entryMode === 'market'
              ? { ...base, entryMark: s.resolvedMark, entryBasis: s.resolvedBasis }
              : { ...base, entryMark: s.entryMode === 'manual' ? s.price : s.limitPrice, entryBasis: 'manual' };
          gt.openTrade(form);
          setEntryOpen(false);
        }}
      />

      {/* ai-rec-backtest-orders: the SAME shared dialog in its additive ORDER VARIANT (never a
          fork). A separate instance from the ghost-trade one so Act works even while a ghost trade
          is open; the ghost path above is untouched (AC-47). The already-met notice re-evaluates
          LIVE against the current mid via `orderPlan.liveMid`. */}
      {actState.plan && (
        <TradeEntryDialog
          open={actState.open}
          ticker={ticker}
          expirations={allDates}
          strikes={strikeList}
          spot={m?.price ?? 0}
          prefill={actState.prefill}
          orderPlan={{ ...actState.plan, liveMid: isLive ? live?.mid ?? null : null }}
          orderError={orderError}
          onConfirmOrder={(s: OrderEntrySubmit) => { void onConfirmOrder(s); }}
          onClose={() => { setActState({ open: false }); setOrderError(null); }}
          onConfirm={() => { /* order variant confirms via onConfirmOrder */ }}
        />
      )}

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
