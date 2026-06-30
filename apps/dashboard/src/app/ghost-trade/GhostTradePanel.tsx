/**
 * Ghost-trade panel — the open (paper) position at a glance. Durable parts (contract line, entry
 * facts, decision history) NEVER blank; the live parts (P/L + current mark) degrade independently
 * (stream-offline → ⏸ last known; overnight/closed → frozen). Everything reads SIMULATED.
 */
import { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Chip, Button, Tooltip, Collapse, TextField, Alert, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TickerBundle, LiveUpdate } from '@org/api';
import { MARK_BASIS_META, ADD_QTY_MAX } from './mark';
import type { useGhostTrade } from './useGhostTrade';

const SIMULATED_TIP = 'A paper trade — no broker, no real money, no real order is ever placed.';
const PL_TIP = 'Running gain/loss = (current mark − entry mark) × 100 × qty. The 100× contract multiplier is included; fees and slippage are not. Green = gain, red = loss.';
const STATS_TIP = "The held contract's current option price, greeks (Δ/Γ/Θ/V), IV, days to expiry, and where its strike sits vs spot, the walls and the gamma flip. From the chain snapshot — independent of the expiration filter above.";
const REASSESS_TIP = 'Ask the downstream AI to judge this open position’s health (hold / trim / add / exit / roll). The AI suggests — you accept or reject. Nothing is auto-applied.';
const REASSESS_DISABLED_TIP = 'Reassess needs fresh market data — paused while the feed is stale/closed.';
const VERDICT_GLOSSARY = 'Hold = keep as-is · Trim = scale out (reduce qty) · Add = scale in (capped) · Exit = close and book P/L · Roll = close this and open the suggested replacement. Risk-first: the AI weighs downside before upside.';
const ACCEPT_REMINDER = 'The AI suggests — you decide. Nothing is applied until you accept.';

type Gt = ReturnType<typeof useGhostTrade>;

function ageLabel(s: number | null | undefined): string {
  if (s == null) return '';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
const money = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(0)}`;
const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;

export function GhostTradePanel({ gt, data, live, isLive, streamOffline, onOpenEntry, briefing }: {
  gt: Gt; data: TickerBundle | null; live: LiveUpdate | null; isLive: boolean; streamOffline: boolean; onOpenEntry: () => void;
  briefing?: string;
}) {
  const theme = useTheme();
  const { trade, tracked, trackingUnavailable, markRes, plNow, alerts } = gt;
  const m = data?.market_state;
  const frozen = markRes?.frozen ?? false;
  const age = data?.meta.freshness.data_age_seconds;

  // No position → the entry affordance (only meaningful with a loaded chain).
  if (!trade) {
    return (
      <Box sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={onOpenEntry} disabled={!data}>Open simulated trade</Button>
      </Box>
    );
  }

  const contractLine = `${trade.ticker} $${trade.strike}${trade.right === 'call' ? 'C' : 'P'} · exp ${trade.expiration} · Long ×${trade.qty}`;

  // Closed → realized summary.
  if (trade.status === 'closed') {
    const held = trade.close_time ? Math.round((Date.parse(trade.close_time) - Date.parse(trade.entry_time)) / 60000) : 0;
    const r$ = trade.realized_pl_dollar ?? 0;
    return (
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" variant="outlined" label="SIMULATED" />
            <Typography variant="subtitle1">{contractLine}</Typography>
          </Stack>
          <Typography variant="h6" sx={{ color: r$ >= 0 ? theme.palette.success.main : theme.palette.error.main, mt: 1 }}>
            Closed · realized {money(r$)} ({pct(trade.realized_pl_pct ?? 0)}) · held {held < 60 ? `${held}m` : `${Math.floor(held / 60)}h ${held % 60}m`}
          </Typography>
          <DecisionHistory gt={gt} />
          <Button sx={{ mt: 1 }} size="small" variant="outlined" onClick={() => { gt.startNew(); onOpenEntry(); }}>
            Open a new simulated trade
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Open position.
  const plDim = streamOffline; // P/L + mark only
  const plColor = plNow.dollar == null ? theme.palette.text.primary : plNow.dollar >= 0 ? theme.palette.success.main : theme.palette.error.main;
  const basisMeta = markRes ? MARK_BASIS_META[markRes.basis] : null;
  const strikeVsSpot = m ? ((trade.strike - m.price) / m.price) * 100 : null;

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        {/* Alerts strip (most recent first). */}
        {alerts.map((al) => (
          <Alert key={al.id} severity="info" sx={{ mb: 1 }} onClose={() => gt.dismissAlert(al.id)}
            action={<Button color="inherit" size="small" onClick={gt.requestReassess} disabled={gt.reassessDisabled}>Reassess</Button>}>
            {al.message}
          </Alert>
        ))}

        {/* Contract line + controls. */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
          <Tooltip arrow title={SIMULATED_TIP}><Chip size="small" variant="outlined" label="SIMULATED" /></Tooltip>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>{contractLine}</Typography>
          <Button size="small" onClick={() => gt.closeTrade()}>Close</Button>
        </Stack>

        {/* P/L + mark (the only live-degrading parts). */}
        <Stack direction="row" spacing={3} sx={{ alignItems: 'baseline', flexWrap: 'wrap', opacity: plDim ? 0.5 : 1 }}>
          <Box>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>P/L</Typography>
              <Tooltip arrow title={PL_TIP}><Typography variant="caption" sx={{ color: 'text.disabled' }}>ⓘ</Typography></Tooltip>
              {streamOffline && <Typography variant="caption" sx={{ color: 'text.disabled' }}>· ⏸ offline</Typography>}
            </Stack>
            <Typography variant="h6" sx={{ color: plColor }}>
              {plNow.dollar == null ? '—' : `${money(plNow.dollar)} (${plNow.pct == null ? '' : pct(plNow.pct)})`}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Mark</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="h6">
                {markRes?.mark == null ? '—' : `${markRes.basis === 'modeled' ? '≈ ' : ''}$${markRes.mark.toFixed(2)}`}
              </Typography>
              {basisMeta && <Tooltip arrow title={basisMeta.tip}><Chip size="small" variant="outlined" label={basisMeta.label} /></Tooltip>}
              {age != null && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{ageLabel(age)}</Typography>}
            </Stack>
          </Box>
        </Stack>
        {frozen && (
          <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>
            market closed — no overnight pricing
          </Typography>
        )}

        {/* Contract stats (durable / cached lane). */}
        <Box sx={{ mt: 1.5 }}>
          {!data ? (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>Contract stats unavailable until data loads.</Typography>
          ) : trackingUnavailable ? (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>Trade tracking unavailable this cycle — your position is safe.</Typography>
          ) : tracked ? (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Tooltip arrow title={STATS_TIP}><Typography variant="caption" sx={{ color: 'text.disabled' }}>ⓘ</Typography></Tooltip>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Δ{fmt(tracked.greeks.delta)} Γ{fmt(tracked.greeks.gamma)} Θ{fmt(tracked.greeks.theta)} V{fmt(tracked.greeks.vega)}
                {' · '}IV {tracked.iv == null ? '—' : `${(tracked.iv > 1 ? tracked.iv : tracked.iv * 100).toFixed(1)}%`}
                {' · '}DTE {tracked.dte}
                {strikeVsSpot != null && <> · strike {pct(strikeVsSpot)} vs spot</>}
                {m && <> · {trade.strike >= m.gamma_flip ? 'above' : 'below'} flip, {trade.strike >= m.call_wall ? 'above' : 'below'} call wall</>}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>Contract stats unavailable until data loads.</Typography>
          )}
        </Box>

        <Divider sx={{ my: 1.5 }} />
        <ReassessCard gt={gt} briefing={briefing} />
        <DecisionHistory gt={gt} />
      </CardContent>
    </Card>
  );
}

function fmt(n: number | null): string { return n == null ? '—' : n.toFixed(2); }

// ---- Reassess card -------------------------------------------------------------------------
function ReassessCard({ gt, briefing }: { gt: Gt; briefing?: string }) {
  const theme = useTheme();
  const { reassess, reassessDisabled, reassessmentRequest } = gt;
  const [showRequest, setShowRequest] = useState(false);
  const [verdictText, setVerdictText] = useState('');
  const rec = reassess.rec;

  const idle = reassess.phase === 'idle';
  return (
    <Box sx={{ mt: 1 }}>
      {/* Active persona briefing — the reassessment hand-off is framed by this persona. */}
      {briefing && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Briefing: {briefing}</Typography>}
      {(idle || reassess.phase === 'accepted' || reassess.phase === 'rejected' || reassess.phase === 'failed') && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip arrow title={reassessDisabled ? REASSESS_DISABLED_TIP : REASSESS_TIP}>
            <span><Button size="small" variant="outlined" disabled={reassessDisabled} onClick={gt.requestReassess}>Reassess</Button></span>
          </Tooltip>
          {reassess.phase === 'accepted' && <Typography variant="caption" sx={{ color: 'success.main' }}>{reassess.note ?? 'Applied — recorded in decision history.'}</Typography>}
          {reassess.phase === 'rejected' && <Typography variant="caption" sx={{ color: 'text.secondary' }}>Left as-is — recorded as your override.</Typography>}
          {reassess.phase === 'failed' && <Typography variant="caption" color="error">Couldn't reach the AI — try again.</Typography>}
        </Stack>
      )}

      {reassess.phase === 'pending' && (
        <Box>
          <Typography variant="body2">Reassessment requested — awaiting the AI's read.</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => setShowRequest((v) => !v)}>View request</Button>
            <Button size="small" onClick={() => navigator.clipboard?.writeText(JSON.stringify(reassessmentRequest, null, 2))}>Copy request</Button>
          </Stack>
          <Collapse in={showRequest}>
            <TextField multiline minRows={4} maxRows={12} fullWidth size="small" sx={{ mt: 1 }}
              value={JSON.stringify(reassessmentRequest, null, 2)} slotProps={{ input: { readOnly: true } }} />
          </Collapse>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Paste the AI's verdict JSON to ingest it:
          </Typography>
          <TextField multiline minRows={2} fullWidth size="small" sx={{ mt: 0.5 }} placeholder='{"recommendation": {"verdict": "Hold", ...}}'
            value={verdictText} onChange={(e) => setVerdictText(e.target.value)} />
          <Button size="small" variant="contained" sx={{ mt: 1 }} disabled={!verdictText.trim()} onClick={() => gt.ingestVerdict(verdictText)}>
            Load verdict
          </Button>
        </Box>
      )}

      {reassess.phase === 'ready' && rec && (
        <Card variant="outlined" sx={{ mt: 1, borderColor: theme.palette.warning.main }}>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <Tooltip arrow title={VERDICT_GLOSSARY}><Chip size="small" color="warning" label={rec.verdict} /></Tooltip>
              {rec.verdict === 'Add' && <Typography variant="caption" sx={{ color: 'text.secondary' }}>Add is capped to keep the simulation from nudging over-trading (max {ADD_QTY_MAX}).</Typography>}
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{rec.rationale}</Typography>
            {rec.verdict === 'Roll' && rec.replacement_contract && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Replacement: {rec.replacement_contract.expiration} ${rec.replacement_contract.strike}{rec.replacement_contract.right === 'call' ? 'C' : 'P'}
              </Typography>
            )}
            {reassess.note && <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>{reassess.note}</Typography>}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>{ACCEPT_REMINDER}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" variant="contained" onClick={gt.acceptVerdict}>Accept</Button>
              <Button size="small" onClick={gt.rejectVerdict}>Reject</Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ---- Decision history ----------------------------------------------------------------------
function DecisionHistory({ gt }: { gt: Gt }) {
  const [open, setOpen] = useState(false);
  const { decisions } = gt;
  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button size="small" onClick={() => setOpen((v) => !v)}>Decision history ({decisions.length})</Button>
        <Tooltip arrow title="Export decision history">
          <Button size="small" onClick={() => { import('./store').then((s) => s.exportLog()); }}>Export</Button>
        </Tooltip>
      </Stack>
      <Collapse in={open}>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {decisions.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>No decisions recorded yet.</Typography>
          ) : decisions.map((d, i) => (
            <Typography key={i} variant="caption" sx={{ color: 'text.secondary' }}>
              {new Date(d.clock_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {d.event_type}
              {d.ai_verdict ? ` · ${d.ai_verdict}${d.user_choice ? ` → ${d.user_choice === 'accept' ? 'Accepted' : 'Rejected'}` : ''}` : ''}
              {' · '}mark ${d.mark_price.toFixed(2)} ({d.mark_basis}) · {pct(d.pl_pct)}
            </Typography>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
