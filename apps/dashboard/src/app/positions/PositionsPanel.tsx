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
import { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { TickerBundle, LiveUpdate } from '@org/api';
import { usePortfolio, OpenPositionInput } from './usePortfolio';
import { deriveGroups } from './derive';
import type { DerivedRow } from './derive';
import type { PositionStatus } from './types';
import { PositionsView } from './PositionsView';
import { CustomizationToolbar } from './CustomizationToolbar';
import { TradeEntryDialog, EntryPrefill } from '../trading/TradeEntryDialog';
import type { RowContext } from './PositionRow';
import { SignInPrompt } from '../auth/SignInPrompt';
import { AUTH_COPY } from '../auth/copy';
import { OrdersPanel } from '../orders/OrdersPanel';

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
}

export function PositionsPanel({
  pf, data, live = null, isLive = false, streamOffline, ticker, gate, onRequestOpenEntry,
  guardSaveView, onConfirm, entryPrefill, entryOpen, onEntryOpen,
}: Props) {
  const m = data?.market_state;
  // Position-side backlink (AC-31): "From sim order · view order →" opens the order detail in the
  // Orders panel above.
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  // Build a markRes for a row by re-running the existing engine off the row's tracked stats.
  const markResFor = (row: DerivedRow): RowContext['markRes'] => {
    if (row.position.status !== 'open' && row.position.status !== 'pending') return null;
    return pf.markFor(row.position);
  };

  const { working } = pf;
  const groups = useMemo(
    () => deriveGroups(pf.rows, {
      filter: working.filter, sortKey: working.sortKey, sortDir: working.sortDir, group: working.group,
    }),
    [pf.rows, working.filter, working.sortKey, working.sortDir, working.group],
  );

  const strikeList = Array.from(new Set((data?.strike_profile.strikes ?? []).map((s) => s.strike))).sort((a, b) => a - b);
  const expirations = data?.expirations.map((e) => e.date) ?? [];

  return (
    <Box data-testid="simulated-surface">
      {/* In-context sign-in prompt for a gated write (never silent; never a misleading error). */}
      <SignInPrompt
        text={gate.promptText}
        onSignIn={() => gate.signIn(gate.promptText ?? AUTH_COPY.positions.gateTrack)}
        testid="positions-signin-prompt"
      />

      {/* Simulated orders — the management home (UX §4.5), ABOVE the positions view, inside the
          Simulated tab only (the Live tab stays the locked placeholder). All tickers; rows for
          tickers other than this page's focused/streamed one read not-evaluated (D5 — correct). */}
      <OrdersPanel
        coverage={{ ticker, mid: live?.mid ?? null, isLive, streamOffline }}
        openDetailOrderId={viewOrderId}
        onDetailClose={() => setViewOrderId(null)}
        onViewPosition={() => setViewOrderId(null)}
      />

      <CustomizationToolbar
        pf={pf}
        positions={pf.positions}
        guardSaveView={guardSaveView}
        streamOffline={streamOffline}
        onOpenEntry={onRequestOpenEntry}
        canOpenEntry={!!data}
      />

      {/* Honest browser-local disclosure (D6d, mandatory) — a subtle info line; shown whether signed
          in or out (a property of data residency, not auth state). Must NOT imply sync/account-scoping. */}
      <Typography
        component="p"
        data-testid="positions-disclosure"
        sx={{ fontSize: '0.72rem', color: 'text.disabled', m: '0 0 12px', lineHeight: 1.5 }}
      >
        {AUTH_COPY.positions.disclosure}
      </Typography>

      <PositionsView
        groups={groups}
        columns={working.columns}
        layout={working.layout}
        density={working.density}
        streamOffline={streamOffline}
        totalCount={pf.positions.length}
        isHistory={isHistoryFilter(working.filter.status)}
        markResFor={markResFor}
        trendFor={pf.trendFor}
        onOpenEntry={onRequestOpenEntry}
        onClearFilter={() => pf.setFilter({ ticker: null, strategy: null, expiry: null, status: ['open'] })}
        onClose={pf.closePosition}
        onCancel={pf.cancelLimit}
        onViewOrder={setViewOrderId}
      />

      {/* The SHARED sim-entry dialog (`trading/TradeEntryDialog`, also the Ticker page's). Positions
          rests a limit `pending` (fills only on a live cross via the existing resolver lifecycle), so
          `restingLimit` is on. Its mode-tagged submit is structurally an `OpenPositionInput`; confirm
          stays the server-gated write upstream (`useGate` → POST /api/positions/sim-trade/gate). */}
      <TradeEntryDialog
        open={entryOpen}
        ticker={ticker}
        expirations={expirations}
        strikes={strikeList}
        spot={m?.price ?? 0}
        prefill={entryPrefill}
        restingLimit
        onClose={() => onEntryOpen(false)}
        onConfirm={onConfirm}
      />
    </Box>
  );
}
