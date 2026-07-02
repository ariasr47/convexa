/**
 * Portfolio shell (UX_BLUEPRINT §6 S1): the two tabs (Simulated · Live), the customization toolbar,
 * and the all-positions surface. Re-homes the single-position ghost-trade panel into a portfolio
 * surface. Switching tabs re-derives the view only — it triggers no fetch and mutates no position.
 *
 * The Live tab renders the LOCKED placeholder (zero data source, zero network) — when Live is active
 * NO position data, entry affordance, or feed is wired.
 *
 * Re-skin (convexa-redesign · Positions): the outer `Card`/"Positions portfolio" heading/`SIMULATED`
 * chip chrome is removed — underline tabs (Simulated + green PAPER badge ‖ 🔒 Live) render directly
 * under the page header. The gated "Open simulated position" CTA moves onto the toolbar's blue pill
 * (`data-testid="open-entry"`). The mandatory `positions-disclosure` (D6d) + the in-context sign-in
 * prompt + the server-gate wiring are all preserved verbatim. No data/handler changes.
 */
import { useState } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import type { TickerBundle, LiveUpdate } from '@org/api';
import { usePortfolio, OpenPositionInput } from './usePortfolio';
import { PositionsPanel } from './PositionsPanel';
import { LiveTabPanel } from './LiveTabPanel';
import { EntryPrefill } from '../trading/TradeEntryDialog';
import { useGate } from '../auth/useGate';
import { AUTH_COPY } from '../auth/copy';

type Portfolio = ReturnType<typeof usePortfolio>;

interface Props {
  pf: Portfolio;
  data: TickerBundle | null;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
  ticker: string;
  /** External request to open the entry dialog (e.g. from Accept-an-AI-rec). */
  entryPrefill?: EntryPrefill;
  entryOpen: boolean;
  onEntryOpen: (open: boolean) => void;
}

export function PortfolioPanel({ pf, data, live, isLive, streamOffline, ticker, entryPrefill, entryOpen, onEntryOpen }: Props) {
  const [tab, setTab] = useState<'simulated' | 'live'>('simulated');
  const [toast, setToast] = useState<string | null>(null);

  // Gated WRITE actions (UX_BLUEPRINT §2.6, AC-E1/E2/E3/E7). The route stays viewable anonymously;
  // ONLY the write actions gate. Logged-out ⇒ an in-context sign-in prompt, no execute.
  const gate = useGate();

  // Opening the entry dialog is itself a write intent: gate it logged-out (prompt, no dialog).
  const requestOpenEntry = () => {
    if (!gate.allowed) { gate.prompt(AUTH_COPY.positions.gateTrack); return; }
    gate.clear();
    onEntryOpen(true);
  };

  const handleConfirm = (input: OpenPositionInput) => {
    // Confirm is the state-bearing write (open / resting-limit / accept-an-AI-rec all land here).
    // SERVER-ENFORCED gate (AC-E7/D6e): await `POST /api/positions/sim-trade/gate` BEFORE the local
    // `openPosition` write. A stale-cookie / bypassed-FE-check path ⇒ the server returns 403 ⇒ the
    // guard re-shows the prompt and `openPosition` never runs, so NOTHING is persisted. The server is
    // the boundary of record; the FE auth check above is UX sugar only (D6e).
    void gate.guard(AUTH_COPY.positions.gateTrack, () => {
      const res = pf.openPosition(input);
      if (!res.ok && res.reason) setToast(res.reason);
      onEntryOpen(false);
    }, { serverGate: gate.simTradeGate });
  };

  // Save-view writes (save-as-new / save-changes) are state-bearing too — server-gate them the same
  // way so the local customization write is rejected server-side without a valid session (AC-E7).
  const guardSaveView = (run: () => void) => {
    void gate.guard(AUTH_COPY.positions.gateSaveView, run, { serverGate: gate.simTradeGate });
  };

  const tabSx = (active: boolean, activeColor: string, inactiveColor: string) => ({
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    font: 'inherit',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '10px 4px',
    color: active ? activeColor : inactiveColor,
    borderBottom: '2px solid',
    borderColor: active ? 'primary.main' : 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  });

  return (
    <Box data-testid="portfolio-panel">
      {/* Underline tabs — directly under the page header (no outer Card chrome). */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', mt: '20px' }}>
        <Box
          component="button"
          type="button"
          onClick={() => setTab('simulated')}
          data-testid="tab-simulated"
          sx={tabSx(tab === 'simulated', 'primary.main', 'text.secondary')}
        >
          Simulated
          <Box
            component="span"
            sx={{
              fontSize: '0.62rem', fontWeight: 700, color: 'success.main',
              border: '1px solid', borderColor: (t) => `${t.palette.success.main}66`,
              borderRadius: '4px', padding: '1px 5px',
            }}
          >
            PAPER
          </Box>
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => setTab('live')}
          data-testid="tab-live"
          sx={{ ...tabSx(tab === 'live', 'text.primary', 'text.disabled'), ml: '18px' }}
        >
          🔒 Live
        </Box>
      </Box>

      {tab === 'live' ? (
        <LiveTabPanel />
      ) : (
        <PositionsPanel
          pf={pf}
          data={data}
          live={live}
          isLive={isLive}
          streamOffline={streamOffline}
          ticker={ticker}
          gate={{ promptText: gate.promptText, signIn: gate.signIn }}
          onRequestOpenEntry={requestOpenEntry}
          guardSaveView={guardSaveView}
          onConfirm={handleConfirm}
          entryPrefill={entryPrefill}
          entryOpen={entryOpen}
          onEntryOpen={onEntryOpen}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast(null)}>
        <Alert severity="warning" onClose={() => setToast(null)} data-testid="entry-failure-toast">{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
