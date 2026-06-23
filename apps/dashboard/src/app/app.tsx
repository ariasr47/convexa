import { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { styled, useTheme } from '@mui/material/styles';
import {
  AppBar, Toolbar, Typography, Container, Box, Card, CardContent,
  Chip, CircularProgress, TextField, Stack, Alert, Button, ButtonGroup, Tooltip,
  FormControl, InputLabel, Select, OutlinedInput, MenuItem, Checkbox, ListItemText,
  Switch, FormControlLabel,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
} from 'recharts';
import { getTicker, streamTicker, TickerBundle, LiveUpdate, IvSkew, TermStructure, RecResponse } from '@org/api';
import { GexProfileChart } from './gex-profile-chart';
import { useGhostTrade } from './ghost-trade/useGhostTrade';
import { GhostTradePanel } from './ghost-trade/GhostTradePanel';
import { TradeEntryDialog, EntryPrefill } from './ghost-trade/TradeEntryDialog';
import { PrimeBanner, tierMeta, OPPORTUNITY_TIER_INFO } from './ghost-trade/OpportunityTier';
import { OperatorMetrics } from './operator-metrics';
import { usePersona } from './personas/usePersona';
import { PersonaPicker, HandoffDialog, PersonaCustomizeForm } from './personas/components';
import { AiRecPanel, useReadPersonas } from './ai-rec/AiRecPanel';
import { useAiRecommendation } from './ai-rec/useAiRecommendation';
import { StateExportDrawer } from './ai-rec/StateExportDrawer';
import { recToPrefill } from './ai-rec/prefill';
import { COPY } from './ai-rec/copy';

const POLL_MS = 60_000; // matches the backend cache TTL
// A healthy SSE session pushes a payload every ~1.5s (the live broadcast throttle) even when
// the market isn't ticking (`live:false`), so an onmessage gap this long means the transport
// dropped — not a quiet session. Used to flip the single "Live offline" connection state.
const STREAM_OFFLINE_MS = 15_000;
// Fallback for the blocks empty-state copy when a (pre-amendment) bundle omits the threshold.
// The live threshold now rides the payload as off_exchange.block_min_shares; this only covers an
// older/partial bundle that predates that field. Mirrors the backend default.
const BLOCK_MIN_SHARES_DISPLAY = 5000;

const BLOCKS_TOOLTIP =
  'Individual large off-exchange ("dark pool") prints from the recent window, ranked by ' +
  'notional (size × price), largest first. Off-exchange volume includes internalized retail ' +
  'and the prints carry no reliable side, so this is positioning context only — never a ' +
  'buy/sell signal. Updates only when new chain data loads, not from the live stream.';
const PROXIMITY_TOOLTIP =
  'How far this print is from current spot. Above spot is +, below is −. Lets you see at a ' +
  'glance whether it overlaps a wall or the gamma flip.';
const OFFLINE_CHIP_TOOLTIP =
  'The live stream dropped. The positioning levels and the GEX chart below are still current ' +
  'as of the last data load — only live price, spread, net flow and the live gamma flip are ' +
  'paused. Reconnecting automatically; no refresh needed.';

// ---- DEX · Vol/OI · IV skew · Term structure (all neutral, snapshot — never live) ----------
// These four ride the REST bundle, carry NO side/direction, and are excluded from the live
// offline treatment. Each is independently nullable → its own "unavailable this cycle".
const fmtDexM = (v: number | null) => (v == null ? '—' : `$${(v / 1e6).toFixed(1)}M`);
const fmtThresh = (t: number) => (Number.isInteger(t) ? t.toFixed(1) : String(t)); // 1 -> "1.0"
const TERM_BUCKETS = [7, 14, 30, 60, 90]; // nominal display tenors, each mapped to nearest point

// IV skew "what vol is paying for" word from slope (put_iv − call_iv); small neutral band.
const SKEW_BAND = 0.5; // IV points
function skewState(slope: number): 'fear' | 'greed' | 'balanced' {
  if (slope > SKEW_BAND) return 'fear';
  if (slope < -SKEW_BAND) return 'greed';
  return 'balanced';
}
const SKEW_PHRASE: Record<'fear' | 'greed' | 'balanced', string> = {
  fear: 'downside hedging is bid (fear)',
  greed: 'upside is bid (greed/complacency)',
  balanced: 'balanced',
};
const TERM_STATE_CLAUSE: Record<'contango' | 'backwardation' | 'flat', string> = {
  contango: 'Upward = contango: near-term vol calm vs longer tenors — "normal."',
  backwardation: 'Downward = backwardation: near-term vol elevated — near-term stress / event.',
  flat: 'Flat.',
};

const netDexTip = (callDex: number | null, putDex: number | null) =>
  `Net dealer delta exposure — the delta analogue of GEX. Shows which way dealer hedging ` +
  `pressure leans across the selected expirations (call ${fmtDexM(callDex)}, put ${fmtDexM(putDex)}). ` +
  `Positioning context only: the hedging implication is indirect — this is not a buy/sell signal ` +
  `and does not mean "dealers are bullish, go long." Moves with the expiration window, like GEX. ` +
  `Snapshot from the last chain load.`;
const volOiTip = (threshold: number, n: number) =>
  `Chain-wide option volume ÷ open interest — turnover intensity: how much of today's trading is ` +
  `fresh vs standing positions. Activity only — no side, no direction; never bullish/bearish or ` +
  `"smart money." Uses the full chain (ignores the expiration filter). ${n} strike(s) show ` +
  `unusual activity (Vol/OI ≥ ${fmtThresh(threshold)}×) — see Fresh positioning below.`;
const freshCaption = (threshold: number) =>
  `Strikes trading heavily versus standing open interest (Vol/OI ≥ ${fmtThresh(threshold)}×). ` +
  `Activity, not direction — no side implied.`;
const skewTip = (s: IvSkew) =>
  `IV skew at the ${s.dte}-DTE tenor (${s.expiration}): downside IV ${s.put_iv.toFixed(1)}% vs ` +
  `upside IV ${s.call_iv.toFixed(1)}% (±25-delta${s.reference === 'moneyness' ? ', fixed-moneyness fallback' : ''}). ` +
  `A read of what volatility is paying for — ${SKEW_PHRASE[skewState(s.slope)]} — not a ` +
  `price-direction call. Single snapshot, no history.`;
const termTip = (t: TermStructure) => {
  const near = t.points[0];
  const far = t.points[t.points.length - 1];
  return `ATM implied vol across expirations. ${TERM_STATE_CLAUSE[t.state]} Near (${near?.dte}d) ` +
    `${t.near_iv.toFixed(1)}% vs far (${far?.dte}d) ${t.far_iv.toFixed(1)}%. Cross-tenor by ` +
    `definition (ignores the expiration filter). Single snapshot, no history.`;
};

/** Sample the nominal display tenors to the nearest available point; dedupe, plot points at
 *  their REAL dte/atm_iv (never fabricate an absent bucket). Ascending by dte. */
function sampleTermPoints(points: TermStructure['points']): TermStructure['points'] {
  const seen = new Set<number>();
  const out: TermStructure['points'] = [];
  for (const b of TERM_BUCKETS) {
    let best: TermStructure['points'][number] | null = null;
    for (const p of points) {
      if (best == null || Math.abs(p.dte - b) < Math.abs(best.dte - b)) best = p;
    }
    if (best && !seen.has(best.dte)) { seen.add(best.dte); out.push(best); }
  }
  return out.sort((a, b) => a.dte - b.dte);
}

/** Conventional DTE label: 0 = expires today (0DTE), 1 = tomorrow, else N days. */
function dteLabel(dte: number | null): string | undefined {
  if (dte == null) return undefined;
  if (dte <= 0) return 'expires today · 0DTE';
  if (dte === 1) return '1 day to expiry';
  return `${dte} days to expiry`;
}

/** Compact, human-readable age from seconds, e.g. 242779 -> "2d 19h". */
function humanAge(seconds: number | null): string {
  if (seconds == null) return 'unknown age';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

// Example of MUI's styled() API (the styled-components-style authoring experience, on
// MUI's Emotion engine). Color reacts to a prop, the way you'd do in styled-components.
const StatTile = styled(Card)<{ accent?: 'up' | 'down' | 'neutral' }>(
  ({ theme, accent }) => ({
    height: '100%',
    borderLeft: `4px solid ${
      accent === 'up' ? theme.palette.success.main
      : accent === 'down' ? theme.palette.error.main
      : theme.palette.divider
    }`,
  })
);

function Stat({ label, value, accent, info, offline, accentColor }:
  { label: string; value: string; accent?: 'up' | 'down' | 'neutral'; info?: string; offline?: boolean; accentColor?: string }) {
  const tile = (
    // Stream Offline: dim the (live-derived) tile and caption it `⏸ offline` so a kept last
    // value is never mistaken for a current one. Static tiles never receive `offline`.
    // `accentColor` overrides the left border (used for non-directional tier emphasis).
    <StatTile accent={accent} variant="outlined"
      sx={{ ...(offline ? { opacity: 0.5 } : {}), ...(accentColor ? { borderLeftColor: accentColor } : {}) }}>
      <CardContent>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          {info && <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
        </Stack>
        {offline && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', lineHeight: 1 }}>
            ⏸ offline
          </Typography>
        )}
        <Typography variant="h6">{value}</Typography>
      </CardContent>
    </StatTile>
  );
  // Whole-tile hover tooltip (the ⓘ just signals one exists). Only when `info` is given.
  return info ? <Tooltip title={info} arrow placement="top">{tile}</Tooltip> : tile;
}

// Session-aware live status: explains WHY there are (or aren't) live ticks, instead of a
// frozen price that silently contradicts an overnight-capable platform like Webull.
function liveStatus(live: LiveUpdate | null):
  { color: 'info' | 'warning' | 'default'; label: string; tip: string } | null {
  if (!live) return null;
  const last = live.mid != null ? ` · last $${live.mid.toFixed(2)}` : '';
  if (live.live) {
    const s: Record<string, string> = { premarket: 'pre-market', regular: 'open',
      afterhours: 'after-hours', overnight: 'overnight' };
    return { color: 'info', label: `● live · ${s[live.market_session] ?? live.market_session} · $${live.mid?.toFixed(2)}`,
      tip: `Streaming live ${live.feed} ticks.` };
  }
  if (live.market_session === 'overnight') {
    return { color: 'warning', label: `○ overnight — no live data${last}`,
      tip: 'Massive covers 4 AM–8 PM ET only; the 8 PM–4 AM overnight session is not provided, so this is the last close. Overnight-capable platforms (e.g. Webull) will show a different, live price.' };
  }
  if (live.market_session === 'closed') {
    return { color: 'default', label: `○ market closed${last}`,
      tip: 'Market is closed (weekend/holiday). Showing the last completed session.' };
  }
  return { color: 'warning', label: `○ no live ticks${last}`,
    tip: 'In a covered session but no ticks are arriving — the feed may be lagging, or it is a market holiday.' };
}

function TickerDashboard() {
  const { ticker = 'TSLA' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TickerBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState(ticker);
  const [live, setLive] = useState<LiveUpdate | null>(null);
  // Stream Offline: set when the SSE transport drops (no payload for > STREAM_OFFLINE_MS after
  // having been live). Degrades ONLY the live-derived tiles + the connection chip; the static
  // bundle (chart, stats, blocks) is untouched. Clears on the next payload (auto-reconnect).
  const [streamOffline, setStreamOffline] = useState(false);
  // Expiration filter: null = all (no filter), [] = none selected, else an explicit subset.
  const [selected, setSelected] = useState<string[] | null>(null);
  // Dark-pool (off-exchange) context: off => excluded from the bundle AND the opportunity score.
  const [darkPool, setDarkPool] = useState(true);

  // "Live" only if a real tick arrived recently AND the transport isn't offline. Declared early so
  // the ghost-trade hook + the bundle's position context can use it.
  const isLive = (live?.live ?? false) && !streamOffline;
  // Ghost trade (paper sim): owns the durable position, mark/P-L, alerts, and the reassessment
  // boundary. `positionQuery` (set when a trade is open) makes the bundle compute position_eval.
  const gt = useGhostTrade(ticker, data, live, isLive, streamOffline);
  // Trader persona (prompt-layer overlay): switching is pure client-state — assembleHandoff is
  // synchronous + bundle-independent, so it triggers NO getTicker/streamTicker and NO recompute.
  const persona = usePersona();

  // AI recommendation (in-app risk-first ENTRY rec). The rec surface is an INDEPENDENTLY NULLABLE
  // sibling card: its hook catches any fault and renders `unavailable` here, never touching the
  // chart/tiles/ghost-trade/live stream. Per-query read persona is canonical-sourced (embed
  // fallback) and presentation-only — it never recomputes the bundle.
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
  // Shared export drawer (the always-available floor): opened from the rec panel AND the persona
  // HandoffDialog — the SAME export feeds both paths. Triggers no in-app LLM call.
  const [exportDrawer, setExportDrawer] = useState<{ open: boolean; personaId: string | null }>({ open: false, personaId: null });
  const openExport = useCallback((personaId: string | null) => setExportDrawer({ open: true, personaId }), []);

  // Persona DTE pre-fill: a visible, clearable staged window for the NEXT load. One-shot ref so it
  // applies ONLY on an explicit ticker navigation — never on the 60s poll and never on a persona
  // switch (so it can't retro-mutate the current view or recompute the bundle by itself).
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

  // Reset the filter to "all" whenever the ticker changes; clear data so we show a spinner.
  // Clear any prior error too, so a stale cold-start error never flashes over the new ticker.
  useEffect(() => { setSelected(null); setData(null); setError(null); }, [ticker]);

  // (Re)load on ticker/selection change, then poll on the cache cadence. Data is updated
  // in place (not cleared) on a re-filter, so the view doesn't flicker between fetches.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Live SSE stream: mirrors the expiration filter. Skipped when nothing is selected.
  // Stream-drop detection rides a payload-gap watchdog rather than a new payload field: a
  // dropped stream sends nothing at all, so it's only visible at the transport layer. The gap
  // is armed AFTER the first payload (before that we're in "loading (cold)", not "offline"),
  // then re-armed on every payload; if it fires, we flip Stream Offline. The next payload
  // (EventSource auto-reconnects) clears it. The watchdog never touches the static bundle.
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

  // Vol/OI "Fresh positioning": strikes at/above the cutoff, ranked desc, short top-N. Full-chain
  // (these rows are not window-scoped). Term-structure display points sampled to nominal tenors.
  const volOiThreshold = m?.vol_oi_unusual_threshold ?? 1;
  const unusualStrikes = (data?.strike_profile.strikes ?? [])
    .filter((s) => s.vol_oi_ratio != null && s.vol_oi_ratio >= volOiThreshold)
    .sort((a, b) => (b.vol_oi_ratio as number) - (a.vol_oi_ratio as number))
    .slice(0, 8);
  const termSampled = m?.term_structure ? sampleTermPoints(m.term_structure.points) : [];

  const allDates = data?.expirations.map((e) => e.date) ?? [];
  const noneSelected = selected !== null && selected.length === 0;
  const checked = selected ?? allDates; // dates shown ticked in the menu
  const ls = liveStatus(live);          // session-aware live/stale status for the chip

  // Ghost-trade entry dialog + Prime banner (over-trading guard: the banner shows only on the
  // change INTO Prime + prime_prompt_eligible, is dismissible, and never re-shows every poll).
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
  // is tracked until the user confirms (mandatory `Open simulated trade`); cancel leaves nothing.
  // No Accept path exists for a no_trade rec (the panel omits the control).
  const onAcceptRec = (rec: RecResponse, personaName: string) => {
    if (!rec.strategy) return;
    const pf = recToPrefill(rec.strategy, personaName, COPY.accept.sizing);
    if (pf) openEntry(pf);
  };
  const strikeList = Array.from(new Set((data?.strike_profile.strikes ?? []).map((s) => s.strike))).sort((a, b) => a - b);
  const tm = tierMeta(theme, sig?.opportunity_tier ?? 'dormant');

  // Persona hand-off + customize dialogs.
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Offer the active persona's DTE preference as a staged pre-fill — ONLY when the user hasn't set
  // an explicit expiration window. Setting it touches no fetch (it's a note); it's applied to the
  // next ticker navigation via the one-shot ref. A user-set window is never overridden.
  useEffect(() => {
    if (selected !== null) { setDtePrefill(null); return; } // user picked expirations → their window wins
    const pref = persona.active.dte_pref;
    setDtePrefill(pref ? { min: pref.min_dte, max: pref.max_dte, persona: persona.active.name } : null);
  }, [persona.active, selected]);

  // Hover label for a term-structure point: real tenor + expiration + ATM IV (auditable).
  const TermPointTooltip = ({ active, payload }:
    { active?: boolean; payload?: { payload: { dte: number; expiration: string; atm_iv: number } }[] }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <Box sx={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, px: 1.25, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">{p.dte}d · {p.expiration}</Typography>
        <Typography variant="body2">ATM IV {p.atm_iv.toFixed(1)}%</Typography>
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <TextField
          size="small" label="Ticker" value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && symbol) {
              // Apply the staged DTE pre-fill to THIS explicit navigation only (one-shot).
              if (dtePrefill) pendingPrefill.current = { min: dtePrefill.min, max: dtePrefill.max };
              navigate(`/${symbol}`);
            }
          }}
        />
        <FormControl size="small" sx={{ minWidth: 240 }} disabled={!allDates.length}>
          <InputLabel>Expirations</InputLabel>
          <Select
            multiple
            displayEmpty
            value={checked}
            input={<OutlinedInput label="Expirations" />}
            onChange={(e) => {
              const v = (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value);
              // Every date ticked -> null ("all", no filter); otherwise the explicit subset (incl. []).
              setSelected(v.length === allDates.length ? null : v);
            }}
            renderValue={() =>
              selected === null ? 'All expirations'
              : selected.length === 0 ? 'None selected'
              : `${selected.length} of ${allDates.length}`}
            MenuProps={{ slotProps: { paper: { sx: { maxHeight: 360 } } } }}
          >
            {data?.expirations.map((e) => (
              <MenuItem key={e.date} value={e.date}>
                <Checkbox checked={checked.includes(e.date)} />
                <ListItemText primary={e.date} secondary={dteLabel(e.dte)} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ButtonGroup size="small" variant="outlined" disabled={!allDates.length}>
          <Button onClick={() => setSelected(null)} disabled={selected === null}>All</Button>
          <Button onClick={() => setSelected([])} disabled={noneSelected}>Clear</Button>
        </ButtonGroup>
        <Tooltip arrow title="Include off-exchange (dark-pool) volume context. Off = excluded from the opportunity score and from what the downstream AI sees.">
          <FormControlLabel
            control={<Switch size="small" checked={darkPool} onChange={(e) => setDarkPool(e.target.checked)} />}
            label="Dark pool" sx={{ ml: 0 }}
          />
        </Tooltip>
        {/* Persona (prompt-layer overlay) + hand-off viewer — pure presentation, never recomputes. */}
        <PersonaPicker persona={persona} onOpenCustomize={() => setCustomizeOpen(true)} />
        <Button size="small" variant="outlined" onClick={() => setHandoffOpen(true)}>View AI hand-off</Button>
        {dtePrefill && (
          <Tooltip arrow title="Visible, overridable pre-fill — it won't touch the current view or recompute anything.">
            <Chip size="small" variant="outlined" onDelete={() => setDtePrefill(null)}
              label={`Pre-filled ${dtePrefill.persona}'s preferred horizon (${dtePrefill.min}–${dtePrefill.max} DTE) for your next load`} />
          </Tooltip>
        )}
        {loading && <CircularProgress size={18} />}
        {sig?.regime && (
          <Tooltip arrow title="Positive gamma: dealers dampen moves → range-bound, fade extremes. Negative gamma: dealers amplify moves → trending, don't fade.">
            <Chip
              label={sig.regime.replace('_', ' ')}
              color={sig.regime === 'positive_gamma' ? 'success' : 'error'}
            />
          </Tooltip>
        )}
        {/* Exactly one connection chip: the offline warning supersedes the session chip so a
            stale "● live" can never contradict the dropped transport. */}
        {streamOffline ? (
          <Tooltip arrow title={OFFLINE_CHIP_TOOLTIP}>
            <Chip size="small" color="warning" label="⚠ Live offline — reconnecting…" />
          </Tooltip>
        ) : ls && (
          <Tooltip arrow title={ls.tip}>
            <Chip size="small" variant="outlined" color={ls.color} label={ls.label} />
          </Tooltip>
        )}
        {fresh?.stale && (
          <Tooltip arrow title="Age of the option-chain snapshot the levels were computed from. Large here is expected outside market hours; mid-session staleness means the data is lagging.">
            <Alert severity="warning" sx={{ py: 0 }}>
              data is {humanAge(fresh.data_age_seconds)} old — levels may be unreliable
            </Alert>
          </Tooltip>
        )}
      </Stack>

      {/* Cold-start failure (no bundle ever loaded) is the ONLY blank/error screen: red error
          + Retry. A poll failure AFTER a prior success keeps the whole bundle on screen behind
          a soft warning — never blank what's already rendered. */}
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
      {!data && !error && <CircularProgress />}

      {noneSelected && (
        <Alert severity="info">
          No expirations selected — pick one or more above, or click <strong>All</strong>.
        </Alert>
      )}

      {/* Cold-start with a durable ghost trade: the trade record never blanks — show its entry
          facts + last-known P/L even before any bundle loads (contract stats read "unavailable
          until data loads"). When a bundle exists, the panel renders below the headline instead. */}
      {!data && gt.trade && !noneSelected && (
        <GhostTradePanel gt={gt} data={null} live={live} isLive={isLive} streamOffline={streamOffline} onOpenEntry={() => openEntry()} briefing={persona.active.name} />
      )}

      {!noneSelected && m && (
        <>
          {showPrimeBanner && !tradeOpen && (
            <PrimeBanner onSimulate={() => openEntry()} onDismiss={() => setShowPrimeBanner(false)} />
          )}
          <Typography variant="h1" gutterBottom>
            {m.ticker} · ${(isLive ? live!.mid : m.price)?.toFixed(2)}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              (levels @ ${m.gex_spot?.toFixed(2)} · {selected === null ? 'all expirations' : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`})
            </Typography>
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
            <Stat label="Call wall" value={`$${m.call_wall}`} accent="up"
              info="Strike with the most positive dealer gamma — tends to act as resistance (dealers sell into rallies here)." />
            <Stat label="Put wall" value={`$${m.put_wall}`} accent="down"
              info="Strike with the most negative dealer gamma — tends to act as support (dealers buy dips here)." />
            <Stat
              label={isLive ? 'Gamma flip (live)' : 'Gamma flip'}
              // When not live (cold or offline) show the authoritative static flip, never the
              // last stale live value — the live flip drops its "(live)" suffix too.
              value={`$${(isLive ? live?.gamma_flip : null) ?? m.gamma_flip}`} accent="neutral"
              offline={streamOffline}
              info="The price where dealer hedging switches from calming moves to amplifying them. Above it → steadier/range-bound; below it → more volatile/trending." />
            <Stat
              label={`Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`}
              value={isLive ? `${live!.net_flow >= 0 ? '+' : ''}${live!.net_flow.toLocaleString()}` : '—'}
              accent={!isLive ? 'neutral' : live!.net_flow >= 0 ? 'up' : 'down'}
              offline={streamOffline}
              info="Aggressive buys minus sells over the last few minutes, from the live trade tape. Positive = buyers lifting the ask; negative = sellers hitting the bid." />
            <Stat label="Spread" value={isLive && live?.spread != null ? `$${live.spread.toFixed(2)}` : '—'} accent="neutral"
              offline={streamOffline}
              info="Best ask minus best bid. Wider = a thinner, more volatile market." />
            <Stat label="Net GEX" value={`$${(m.net_gex / 1e6).toFixed(1)}M`} accent={m.net_gex >= 0 ? 'up' : 'down'}
              info="Total dealer gamma across the chain. Positive = dealers dampen moves (range-bound); negative = they amplify moves (trending)." />
            <Stat label="Net DEX"
              value={m.net_dex == null ? 'unavailable' : `$${(m.net_dex / 1e6).toFixed(1)}M`} accent="neutral"
              info={netDexTip(m.call_dex, m.put_dex)} />
            <Stat label="Max pain" value={`$${m.max_pain ?? '—'}`} accent="neutral"
              info="Price at the nearest monthly expiration where the most option value expires worthless — a mild magnet into expiry." />
            <Stat label="IV / HV" value={m.iv_hv_ratio.toFixed(2)} accent="neutral"
              info="Implied volatility ÷ recent realized volatility. >1 = options look expensive (favor selling); <1 = cheap (favor buying)." />
            <Stat label="Vol/OI"
              value={m.chain_vol_oi_ratio == null ? 'unavailable' : `${m.chain_vol_oi_ratio.toFixed(2)}×`}
              accent="neutral" info={volOiTip(volOiThreshold, unusualStrikes.length)} />
            <Stat label="IV skew"
              value={m.iv_skew == null ? 'unavailable'
                : `${m.iv_skew.slope >= 0 ? '+' : '−'}${Math.abs(m.iv_skew.slope).toFixed(1)} pts · ${skewState(m.iv_skew.slope)}`}
              accent="neutral"
              info={m.iv_skew == null ? 'IV skew unavailable this cycle.' : skewTip(m.iv_skew)} />
            <Stat label="Term structure"
              value={m.term_structure == null ? 'unavailable'
                : m.term_structure.points.length < 2 ? '—' : m.term_structure.state}
              accent="neutral"
              info={m.term_structure == null ? 'Term structure unavailable this cycle.' : termTip(m.term_structure)} />
            <Stat label="VWAP" value={m.vwap != null ? `$${m.vwap.toFixed(2)}` : '—'} accent="neutral"
              info="Volume-weighted average price for the session — a common intraday fair-value / mean-reversion reference." />
            {data?.off_exchange?.ratio_pct != null && (
              <Stat label="Off-exchange %" value={`${data.off_exchange.ratio_pct}%`} accent="neutral"
                info={`Share of recent volume printed off-lit (dark pools/ATS + internalized retail). Top levels: ${
                  data.off_exchange.levels.slice(0, 3).map((l) => `$${l.price} (${l.share_of_offex_pct}%)`).join(', ') || '—'
                }. Side/intent unknown — context only, not a directional signal.`} />
            )}
            <Stat label="Opportunity" value={`${sig?.opportunity_score ?? 0} · ${tm.word}`} accent="neutral" accentColor={tm.color}
              info={"0–100 triage score for how actionable the setup is now (closeness to a key level + volatility extremity + confluence). Not a trade signal." + OPPORTUNITY_TIER_INFO} />
          </Box>

          {/* Ghost-trade panel (paper sim) — below the headline/grid. Durable parts never blank;
              P/L + mark degrade with the live stream only. */}
          <GhostTradePanel gt={gt} data={data} live={live} isLive={isLive} streamOffline={streamOffline} onOpenEntry={() => openEntry()} briefing={persona.active.name} />

          {/* AI recommendation — a dedicated, independently-nullable sibling card. A rec
              error/timeout/over-cap/no-key degrades ONLY this surface; everything above and below
              keeps rendering the bundle. The rec is a STATIC artifact: stale on a newer bundle,
              untouched on an SSE drop. */}
          <AiRecPanel
            ticker={ticker} bundle={data} ai={aiRec} personas={readPersonas}
            activePersonaId={persona.activeId}
            dataAge={fresh ? humanAge(fresh.data_age_seconds) : null}
            onAccept={onAcceptRec} onViewExport={openExport}
            readPersonaId={readPersonaId} onChangeReadPersona={setReadPersonaId}
          />

          {data?.strike_profile && (
            <GexProfileChart
              strikes={data.strike_profile.strikes}
              spot={m.gex_spot ?? m.price}
              callWall={m.call_wall}
              putWall={m.put_wall}
              gammaFlip={live?.gamma_flip ?? m.gamma_flip}
              liveSpot={isLive ? live!.mid : null}
            />
          )}

          {/* Term structure — cross-tenor ATM-IV curve (ignores the DTE filter). Static bundle
              field; never offline-dimmed. Sampled to nominal tenors; absent buckets omitted. */}
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h6">Term structure</Typography>
              {m.term_structure && (
                <Tooltip arrow title={termTip(m.term_structure)}>
                  <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                </Tooltip>
              )}
            </Stack>
            {m.term_structure == null || termSampled.length === 0 ? (
              <Typography variant="body2" color="text.disabled">Term structure unavailable this cycle.</Typography>
            ) : (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    ATM IV by tenor · {m.term_structure.points.length < 2 ? '—' : m.term_structure.state}
                  </Typography>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={termSampled} margin={{ top: 10, right: 20, bottom: 4, left: 0 }}>
                      <XAxis dataKey="dte" tickFormatter={(d) => `${d}d`}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }} stroke={theme.palette.text.secondary} />
                      <YAxis width={42} tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }} stroke={theme.palette.text.secondary} domain={['auto', 'auto']} />
                      <RTooltip cursor={{ stroke: theme.palette.divider }} content={<TermPointTooltip />} />
                      <Line type="monotone" dataKey="atm_iv" stroke={theme.palette.text.secondary}
                        strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Fresh positioning (Vol/OI) — full-chain unusual strikes (≥ cutoff). Static bundle
              field; activity only, no side/direction; catches strikes outside the chart window. */}
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="h6">Fresh positioning (Vol/OI)</Typography>
              <Tooltip arrow title={volOiTip(volOiThreshold, unusualStrikes.length)}>
                <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              </Tooltip>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {freshCaption(volOiThreshold)}
            </Typography>
            {m.chain_vol_oi_ratio == null ? (
              <Typography variant="body2" color="text.disabled">Vol/OI unavailable this cycle.</Typography>
            ) : unusualStrikes.length === 0 ? (
              <Typography variant="body2" color="text.disabled">
                No strikes above the {fmtThresh(volOiThreshold)}× Vol/OI cutoff this session.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {/* Ranked by Vol/OI desc (server rows); blank-OI strikes never appear (null filtered). */}
                {unusualStrikes.map((s) => (
                  <Card key={s.strike} variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="body2">
                        ${s.strike} · Vol/OI {(s.vol_oi_ratio as number).toFixed(2)}× · {s.volume?.toLocaleString() ?? '—'} contracts
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>

          {/* Off-exchange blocks — rides the REST bundle only (never the live stream) and has
              no offline state of its own; it ages with the bundle freshness indicator. Hidden
              entirely when the Dark pool toggle is off. */}
          {darkPool && (
            <Box sx={{ mt: 3 }}>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="h6">Off-exchange blocks</Typography>
                <Tooltip arrow title={BLOCKS_TOOLTIP}>
                  <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                </Tooltip>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Largest recent off-exchange prints near spot. Context, not a signal — no side or direction.
              </Typography>
              {!data?.off_exchange ? (
                // Best-effort miss: off_exchange absent from an otherwise-good bundle. The chart
                // and every other stat render normally — this never implies a chart problem.
                <Typography variant="body2" color="text.disabled">
                  Off-exchange data unavailable this cycle.
                </Typography>
              ) : !(data.off_exchange.blocks?.length) ? (
                <Typography variant="body2" color="text.disabled">
                  No blocks ≥ {(data.off_exchange.block_min_shares ?? BLOCK_MIN_SHARES_DISPLAY).toLocaleString()} shares in the recent window.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {/* Already largest-notional-first, top-5 from the backend — render in order,
                      do NOT re-sort or re-cap. No side/direction; proximity chip is neutral. */}
                  {data.off_exchange.blocks.map((b, i) => {
                    const pct = b.proximity_pct * 100; // payload is a signed ratio vs spot
                    const prox = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% vs spot`;
                    return (
                      <Card key={i} variant="outlined">
                        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                            <Typography variant="body2">
                              {b.shares.toLocaleString()} sh @ ${b.price.toFixed(2)}
                            </Typography>
                            <Tooltip arrow title={PROXIMITY_TOOLTIP}>
                              <Chip size="small" variant="outlined" label={prox} />
                            </Tooltip>
                            <Typography variant="caption" color="text.secondary">
                              {humanAge(b.age_seconds)} ago
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}

          {sig?.setups?.length ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>Setups</Typography>
              <Stack spacing={1}>
                {sig.setups.map((s, i) => (
                  <Card key={i} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1">
                        {s.name} <Chip size="small" label={s.conviction} sx={{ ml: 1 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{s.rationale}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 3 }}>No clean setup right now.</Alert>
          )}
        </>
      )}

      {/* Ghost-trade entry. One open trade per ticker is enforced by the panel (no open affordance
          while a trade is open) + the hook's openTrade guard. */}
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

      {/* Persona hand-off viewer + customize — presentation-only, off the compute path. The
          hand-off dialog now also opens the SAME structured export drawer (augmenting the manual
          hand-off; the export feeds both the in-app call and this copy-paste path). */}
      <HandoffDialog
        open={handoffOpen} onClose={() => setHandoffOpen(false)}
        handoff={persona.handoff} data={data} stale={fresh?.stale ?? false}
        dataAge={fresh ? humanAge(fresh.data_age_seconds) : null}
        onViewExport={() => openExport(persona.handoff.persona.id)}
      />
      <PersonaCustomizeForm open={customizeOpen} onClose={() => setCustomizeOpen(false)} persona={persona} />

      {/* The structured-state export floor — reachable from the rec panel AND the hand-off dialog. */}
      <StateExportDrawer
        open={exportDrawer.open} ticker={ticker} personaId={exportDrawer.personaId}
        onClose={() => setExportDrawer((s) => ({ ...s, open: false }))}
      />
    </Container>
  );
}

// Trader app (the GammaFlow dashboard). The operator metrics readout is a SEPARATE surface,
// deliberately NOT under this AppBar and NOT linked from here.
function TraderApp() {
  return (
    <>
      <AppBar position="static" elevation={0}>
        <Toolbar><Typography variant="h6">GammaFlow</Typography></Toolbar>
      </AppBar>
      <Routes>
        <Route path="/" element={<Navigate to="/TSLA" replace />} />
        <Route path="/:ticker" element={<TickerDashboard />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <Routes>
      {/* Operator-only readout — off the trader routes, unlinked from the trader UI. */}
      <Route path="/_ops/metrics" element={<OperatorMetrics />} />
      <Route path="/*" element={<TraderApp />} />
    </Routes>
  );
}

export default App;
