/**
 * Portfolio shell (UX_BLUEPRINT §6 S1): the two tabs (Simulated · Broker), the customization
 * toolbar, and the all-positions surface. Re-homes the single-position ghost-trade panel into a
 * portfolio surface. Switching to Simulated re-derives the view only; switching to Broker mounts
 * the read-only broker surface, whose ONLY network calls are the gated `/api/broker/*` reads —
 * never a bundle/scoring request, never SSE.
 *
 * broker-connect: the LOCKED `LiveTabPanel` placeholder is REPLACED by `BrokerTabPanel` (the
 * sanctioned unlock). The trader-visible label reads "Broker" (the poll-honesty label ruling);
 * the internal `tab-live` testid stays per the decisions.md internal-names carve-out. READ-ONLY
 * renders as ABSENCE on that surface — no entry affordance is wired to it in any state.
 *
 * Re-skin (convexa-redesign · Positions): the outer `Card`/"Positions portfolio" heading/`SIMULATED`
 * chip chrome is removed — underline tabs render directly under the page header. The gated "Open
 * simulated position" CTA moves onto the toolbar's blue pill (`data-testid="open-entry"`). The
 * mandatory `positions-disclosure` (D6d) + the in-context sign-in prompt + the server-gate wiring
 * are all preserved verbatim.
 */
import { AUTH_COPY } from '@/features/auth/copy';
import { useGate } from '@/features/auth/useGate';
import { EntryPrefill } from '@/features/trading/TradeEntryDialog';
import { BrokerTabPanel } from '@/features/trading/broker/BrokerTabPanel';
import { extrasFor } from '@/shared/theme/tokens';
import type { LiveUpdate, TickerBundle } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import { useState, type FocusEvent } from 'react';
import { PositionsPanel } from './PositionsPanel';
import { OpenPositionInput, usePortfolio } from './usePortfolio';

type Portfolio = ReturnType<typeof usePortfolio>;

function revealFocusedControl(event: FocusEvent<HTMLElement>) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const left = viewport.offsetLeft;
  const top = viewport.offsetTop;
  const right = left + viewport.width;
  const bottom = top + viewport.height;
  const intersects =
    rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom;
  if (intersects) return;
  const dx = rect.right <= left ? rect.left - left : rect.left >= right ? rect.right - right : 0;
  const dy = rect.bottom <= top ? rect.top - top : rect.top >= bottom ? rect.bottom - bottom : 0;
  window.scrollBy({ left: dx, top: dy, behavior: 'auto' });
}

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

export function PortfolioPanel({
  pf,
  data,
  live,
  isLive,
  streamOffline,
  ticker,
  entryPrefill,
  entryOpen,
  onEntryOpen,
}: Props) {
  const [tab, setTab] = useState<'simulated' | 'live'>('simulated');
  const [toast, setToast] = useState<string | null>(null);

  // Gated WRITE actions (UX_BLUEPRINT §2.6, AC-E1/E2/E3/E7). The route stays viewable anonymously;
  // ONLY the write actions gate. Logged-out ⇒ an in-context sign-in prompt, no execute.
  const gate = useGate();

  // Opening the entry dialog is itself a write intent: gate it logged-out (prompt, no dialog).
  const requestOpenEntry = () => {
    if (!gate.allowed) {
      gate.prompt(AUTH_COPY.positions.gateTrack);
      return;
    }
    gate.clear();
    onEntryOpen(true);
  };

  const handleConfirm = (input: OpenPositionInput) => {
    // Confirm is the state-bearing write (open / resting-limit / accept-an-AI-rec all land here).
    // SERVER-ENFORCED gate (AC-E7/D6e): await `POST /api/positions/sim-trade/gate` BEFORE the local
    // `openPosition` write. A stale-cookie / bypassed-FE-check path ⇒ the server returns 403 ⇒ the
    // guard re-shows the prompt and `openPosition` never runs, so NOTHING is persisted. The server is
    // the boundary of record; the FE auth check above is UX sugar only (D6e).
    void gate.guard(
      AUTH_COPY.positions.gateTrack,
      () => {
        const res = pf.openPosition(input);
        if (!res.ok && res.reason) setToast(res.reason);
        onEntryOpen(false);
      },
      { serverGate: gate.simTradeGate },
    );
  };

  // Save-view writes (save-as-new / save-changes) are state-bearing too — server-gate them the same
  // way so the local customization write is rejected server-side without a valid session (AC-E7).
  const guardSaveView = (run: () => void) => {
    void gate.guard(AUTH_COPY.positions.gateSaveView, run, { serverGate: gate.simTradeGate });
  };

  // Segmented pill (design/src/screens/positions.mjs:69, `.pos-tools .seg`): `Simulated | Live ·
  // read-only`. Same testids/handlers as the shipped underline tabs — this is a visual re-skin
  // only (canon rule 21's quiet-panel idiom applied to a control, not a value primitive).
  const segTabSx = (active: boolean) => (theme: { palette: { mode: string } }) => ({
    cursor: 'pointer',
    border: '1px solid',
    borderColor: active ? 'divider' : 'transparent',
    background: active ? extrasFor(theme).panelRaised : 'transparent',
    font: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '7px 13px',
    borderRadius: '7px',
    color: active ? 'text.primary' : 'text.secondary',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <Box
      data-testid="portfolio-panel"
      sx={{
        '& [data-testid="positions-disclosure"]': { color: 'text.secondary !important' },
        '& [data-testid^="tr-family-empty-"]': { color: 'text.secondary !important' },
      }}
    >
      {/* Plain buttons, deliberately no `role="tab"`/`tablist`: this is a VISUAL re-skin (a segmented
          pill, not an ARIA tab panel pair) — inventing an incomplete tablist pattern (no `aria-controls`,
          no roving tabindex) would be a NEW axe finding this task does not own. */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          bgcolor: (t) => extrasFor(t).panelRaised,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '9px',
          padding: '3px',
          mt: '20px',
        }}
      >
        <Box
          component="button"
          type="button"
          onClick={() => setTab('simulated')}
          data-testid="tab-simulated"
          sx={segTabSx(tab === 'simulated')}
        >
          Simulated
          <Box
            component="span"
            sx={{
              fontSize: '0.6875rem', // type floor >=11px (redesign-stage-0 item 4)
              fontWeight: 700,
              // Neutral chrome: green is reserved for direction (canon; site check D-23).
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '4px',
              padding: '1px 5px',
            }}
          >
            PAPER
          </Box>
        </Box>
        {/* Internal name/testid keep `live` (decisions.md I-4 carve-out); the trader reads "Broker". */}
        <Box
          component="button"
          type="button"
          onClick={() => setTab('live')}
          data-testid="tab-live"
          onFocus={revealFocusedControl}
          sx={segTabSx(tab === 'live')}
        >
          Broker
        </Box>
      </Box>

      {tab === 'live' ? (
        <BrokerTabPanel data={data} live={live} isLive={isLive} streamOffline={streamOffline} />
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
        <Alert severity="warning" onClose={() => setToast(null)} data-testid="entry-failure-toast">
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
