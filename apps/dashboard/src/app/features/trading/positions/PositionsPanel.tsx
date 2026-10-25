/**
 * PositionsPanel (convexa-redesign · Positions — Figma PositionsPanel `113:838`). The reusable composite
 * positions data view = **Toolbar + Filters + body** (Table of PositionRow OR a 2-up PositionCard grid,
 * per the View toggle). EXTRACTED from `PortfolioPanel`'s Simulated surface — same markup, same
 * `data-testid`s (`simulated-surface`, the toolbar/filters/disclosure, the entry dialog), same gate
 * wiring + handlers. `PortfolioPanel` now renders this for the Simulated tab; the future Live-positions
 * tab can reuse the same panel once a real source exists (today Live stays the zero-import LOCKED panel,
 * `[no-real-order-path]`).
 *
 * This is a presentation composite: it owns NO durable state and NO fetch — it consumes the portfolio
 * hook + the already-sourced `data`/`streamOffline` and forwards the same handlers. Live cells degrade
 * on an SSE drop via PositionsView/PositionRow while static records persist (`[live-vs-static-isolation]`);
 * positions never feed scoring (`[additive-keeps-score-byte-identical]`).
 */
import { SignInPrompt } from '@/features/auth/SignInPrompt';
import { AUTH_COPY } from '@/features/auth/copy';
import { EntryPrefill, TradeEntryDialog } from '@/features/trading/TradeEntryDialog';
import { OrdersPanel } from '@/features/trading/orders/OrdersPanel';
import { marketDataOff } from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import type { LiveUpdate, TickerBundle } from '@convexa/api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useMemo, useState, type ReactNode } from 'react';
import { CustomizationToolbar } from './CustomizationToolbar';
import { PositionsView } from './PositionsView';
import { deriveGroups } from './derive';
import type { PositionStatus } from './types';
import { OpenPositionInput, usePortfolio } from './usePortfolio';

type Portfolio = ReturnType<typeof usePortfolio>;

/** The gate surface this panel needs (a subset of `useGate()`), forwarded from the parent. */
export interface PanelGate {
  promptText: string | null;
  signIn: (text: string) => void;
}

function isHistoryFilter(status: PositionStatus[]): boolean {
  return status.length > 0 && status.every((s) => s === 'closed' || s === 'cancelled');
}

interface Props {
  pf: Portfolio;
  data: TickerBundle | null;
  /** ai-rec-backtest-orders: the page's live payload + liveness — feeds the Orders panel's
   *  §4.3 evaluation-reality states. Optional so existing hosts/specs stay valid (absent ⇒ every
   *  order row reads not-evaluated, the honest default). */
  live?: LiveUpdate | null;
  isLive?: boolean;
  streamOffline: boolean;
  ticker: string;
  /** The in-context sign-in prompt surface (UX only; the server is the boundary of record). */
  gate: PanelGate;
  /** Open the entry dialog (gated upstream). */
  onRequestOpenEntry: () => void;
  /** Gate a save-view WRITE (server-enforced upstream). */
  guardSaveView: (run: () => void) => void;
  /** Confirm a position write (server-gated upstream). */
  onConfirm: (input: OpenPositionInput) => void;
  entryPrefill?: EntryPrefill;
  entryOpen: boolean;
  onEntryOpen: (open: boolean) => void;
  /** Leads the toolbar's row: the page's book switch (Simulated | Broker). */
  toolbarLead?: ReactNode;
  /** The panel beside the orders panel: the page's Track record (owner NO-6 A, 2026-10-25). */
  besideOrders?: ReactNode;
}

export function PositionsPanel({
  pf,
  data,
  live = null,
  isLive = false,
  streamOffline,
  ticker,
  gate,
  onRequestOpenEntry,
  guardSaveView,
  onConfirm,
  entryPrefill,
  entryOpen,
  onEntryOpen,
  toolbarLead,
  besideOrders,
}: Props) {
  const m = data?.market_state;
  // No options feed on this site: there is no bundle to pick a contract from, so the entry opens
  // without one and the contract is typed (tradeEntry/manualContract.ts). With a feed, the entry
  // waits for the bundle as before.
  const marketDataMode = useMarketDataMode();
  const chainless = marketDataOff(marketDataMode);
  // Position-side backlink (AC-31): "From sim order · view order →" opens the order detail in the
  // Orders panel below the book.
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  // No `markResFor` any more: every presentational component reads the `PositionView` the hook
  // already built (`pf.rows[i].view`), so the row and the card can never disagree about a number.
  const { working } = pf;
  const groups = useMemo(
    () =>
      deriveGroups(pf.views, {
        filter: working.filter,
        sortKey: working.sortKey,
        sortDir: working.sortDir,
        group: working.group,
        sessionDeltaOf: pf.sessionDeltaFor,
      }),
    [pf.views, pf.sessionDeltaFor, working.filter, working.sortKey, working.sortDir, working.group],
  );

  const strikeList = Array.from(
    new Set((data?.strike_profile.strikes ?? []).map((s) => s.strike)),
  ).toSorted((a, b) => a - b);
  const expirations = data?.expirations.map((e) => e.date) ?? [];

  return (
    <Box data-testid="simulated-surface">
      {/* In-context sign-in prompt for a gated write (never silent; never a misleading error). */}
      <SignInPrompt
        text={gate.promptText}
        onSignIn={() => gate.signIn(gate.promptText ?? AUTH_COPY.positions.gateTrack)}
        testid="positions-signin-prompt"
      />

      <CustomizationToolbar
        lead={toolbarLead}
        pf={pf}
        positions={pf.positions}
        guardSaveView={guardSaveView}
        streamOffline={streamOffline}
        onOpenEntry={onRequestOpenEntry}
        canOpenEntry={!!data || chainless}
        // Driven FROM the health flag, computed synchronously at store init — never from trying a
        // write and failing. That is what guarantees no frame paints an enabled affordance.
        faulted={pf.health.faulted}
        // The banner region's two dismissible notices. Both PRODUCED by the store read (the merge
        // notice from `provenance`, the stale-view name from read-time view normalization) — F14
        // built the props and the render; this is the producer they were waiting on.
        mergeNoticePending={pf.mergeNoticePending}
        onDismissMerge={pf.dismissMerge}
        staleViewName={pf.staleViewName}
      />

      {/* Honest browser-local disclosure (D6d, mandatory) — a subtle info line; shown whether signed
          in or out (a property of data residency, not auth state). Must NOT imply sync/account-scoping. */}
      <Typography
        component="p"
        data-testid="positions-disclosure"
        sx={{ fontSize: '0.72rem', color: 'text.secondary', m: '0 0 12px', lineHeight: 1.5 }}
      >
        {AUTH_COPY.positions.disclosure}
      </Typography>

      <PositionsView
        groups={groups}
        columns={working.columns}
        layout={working.layout}
        density={working.density}
        streamOffline={streamOffline}
        faulted={pf.health.faulted}
        totalCount={pf.positions.length}
        isHistory={isHistoryFilter(working.filter.status)}
        trendFor={pf.trendFor}
        sessionDeltaFor={pf.sessionDeltaFor}
        onOpenEntry={onRequestOpenEntry}
        onClearFilter={() =>
          pf.setFilter({ ticker: null, structure: null, expiry: null, status: ['open'] })
        }
        onClose={pf.closePosition}
        onCancel={pf.cancelLimit}
        onViewOrder={setViewOrderId}
      />

      {/* The book first, then the orders panel beside the Track record (owner, NO-6 A, 2026-10-25:
          the Final board's `positionsStaging`, `repeat(auto-fit, minmax(min(420px, 100%), 1fr))`,
          gap 16). Simulated orders are the management home (UX §4.5), inside the Simulated tab
          only. All tickers; rows for tickers other than this page's focused/streamed one read
          not-evaluated (D5 — correct). */}
      <Box
        data-testid="orders-track-row"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
          gap: 2,
          mt: '22px',
        }}
      >
        <OrdersPanel
          coverage={{ ticker, mid: live?.mid ?? null, isLive, streamOffline }}
          openDetailOrderId={viewOrderId}
          onDetailClose={() => setViewOrderId(null)}
          onViewPosition={() => setViewOrderId(null)}
        />
        {besideOrders}
      </Box>

      {/* The SHARED sim-entry dialog (`trading/TradeEntryDialog`, also the Ticker page's). Positions
          rests a limit `pending` (fills only on a live cross via the existing resolver lifecycle), so
          `restingLimit` is on. Its mode-tagged submit is structurally an `OpenPositionInput`; confirm
          stays the server-gated write upstream (`useGate` → POST /api/positions/sim-trade/gate). */}
      {/* The dialog NEVER OPENS on a faulted store (AC-63): the refusal is applied at the source,
          not by opening something the confirm would then refuse. */}
      <TradeEntryDialog
        open={entryOpen && !pf.health.faulted}
        ticker={ticker}
        expirations={expirations}
        strikes={strikeList}
        spot={m?.price ?? 0}
        prefill={entryPrefill}
        restingLimit
        multiLeg
        onClose={() => onEntryOpen(false)}
        onConfirm={onConfirm}
      />
    </Box>
  );
}
