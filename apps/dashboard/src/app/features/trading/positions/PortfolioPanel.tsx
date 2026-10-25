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
import { coarseFloor } from '@/shared/ui/touch';
import type { LiveUpdate, TickerBundle } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { PositionsPanel } from './PositionsPanel';
import { revealFocusedControl } from './revealFocusedControl';
import { OpenPositionInput, usePortfolio } from './usePortfolio';

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
  /** The panel beside the orders panel (the page's Track record; owner NO-6 A, 2026-10-25). A node,
   *  not an import: this file may not reach `features/trading/outcomes` (boundaries.spec). */
  besideOrders?: ReactNode;
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
  besideOrders,
}: Props) {
  const [tab, setTab] = useState<'simulated' | 'live'>('simulated');
  const [toast, setToast] = useState<string | null>(null);

  // The book switch stands in a different place on each tab (it leads the toolbar's row on
  // Simulated and stands on its own row on Broker), so a tab change unmounts the very button that
  // was pressed and the browser drops focus to <body>. When the switch held focus, hand it to the
  // same control in its new place, so Enter on Broker and then Tab moves on from the switch, not
  // from the top of the page (WCAG 2.4.3; fidelity review L9-A11Y-BOOK-SWITCH-FOCUS). A click that
  // never focused the button (Safari's mouse) is left alone.
  const simulatedTabRef = useRef<HTMLButtonElement>(null);
  const brokerTabRef = useRef<HTMLButtonElement>(null);
  const refocusSwitch = useRef(false);
  const pickTab = (next: 'simulated' | 'live') => (e: MouseEvent<HTMLButtonElement>) => {
    if (next === tab) return;
    refocusSwitch.current = e.currentTarget === document.activeElement;
    setTab(next);
  };
  useLayoutEffect(() => {
    if (!refocusSwitch.current) return;
    refocusSwitch.current = false;
    (tab === 'live' ? brokerTabRef : simulatedTabRef).current?.focus();
  }, [tab]);

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
    // The board's segment button (`.seg4 button`): 6 inside the control's 8 (fidelity ACC-24).
    borderRadius: '6px',
    color: active ? 'text.primary' : 'text.secondary',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    whiteSpace: 'nowrap' as const,
    // The coarse 44 (canon rule 7; fidelity ACC-17).
    ...coarseFloor,
  });

  // The book switch. On the Simulated tab it leads the toolbar's one row (the Final board's `.ap-bar`,
  // owner NO-6 A, 2026-10-25); on the Broker tab, which has no toolbar, it stands on its own row.
  /* Plain buttons, deliberately no `role="tab"`/`tablist`: this is a VISUAL re-skin (a segmented
     pill, not an ARIA tab panel pair) — inventing an incomplete tablist pattern (no
     `aria-controls`, no roving tabindex) would be a NEW axe finding this task does not own. */
  const bookSwitch = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        bgcolor: (t) => extrasFor(t).panelRaised,
        border: '1px solid',
        borderColor: 'divider',
        // The control role, 8 (fidelity ACC-24).
        borderRadius: '8px',
        padding: '3px',
      }}
    >
      <Box
        component="button"
        type="button"
        ref={simulatedTabRef}
        onClick={pickTab('simulated')}
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
        ref={brokerTabRef}
        onClick={pickTab('live')}
        data-testid="tab-live"
        onFocus={revealFocusedControl}
        sx={segTabSx(tab === 'live')}
      >
        Broker
      </Box>
    </Box>
  );

  return (
    <Box
      data-testid="portfolio-panel"
      sx={{
        '& [data-testid="positions-disclosure"]': { color: 'text.secondary !important' },
        '& [data-testid^="tr-family-empty-"]': { color: 'text.secondary !important' },
      }}
    >
      {tab === 'live' ? (
        <>
          {/* The toolbar row's own bottom space (14px), so the switch sits where it does above the
              book. */}
          <Box sx={{ mb: '14px' }}>{bookSwitch}</Box>
          <BrokerTabPanel data={data} live={live} isLive={isLive} streamOffline={streamOffline} />
          {/* The Track record is the simulated book's, so it stays reachable from the Broker tab. */}
          {besideOrders && <Box sx={{ mt: '22px' }}>{besideOrders}</Box>}
        </>
      ) : (
        <PositionsPanel
          toolbarLead={bookSwitch}
          besideOrders={besideOrders}
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
