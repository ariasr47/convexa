import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  AppBar, Toolbar, Typography, Container, Box, Card, CardContent,
  Chip, CircularProgress, TextField, Stack, Alert, Button, ButtonGroup, Tooltip,
  FormControl, InputLabel, Select, OutlinedInput, MenuItem, Checkbox, ListItemText,
  Switch, FormControlLabel,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getTicker, streamTicker, TickerBundle, LiveUpdate } from '@org/api';
import { GexProfileChart } from './gex-profile-chart';

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

function Stat({ label, value, accent, info, offline }:
  { label: string; value: string; accent?: 'up' | 'down' | 'neutral'; info?: string; offline?: boolean }) {
  const tile = (
    // Stream Offline: dim the (live-derived) tile and caption it `⏸ offline` so a kept last
    // value is never mistaken for a current one. Static tiles never receive `offline`.
    <StatTile accent={accent} variant="outlined" sx={offline ? { opacity: 0.5 } : undefined}>
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

  const load = useCallback(() => {
    if (selected !== null && selected.length === 0) return; // nothing selected -> nothing to fetch
    setLoading(true);
    getTicker(ticker, { expirations: selected ?? undefined, darkPool })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, selected, darkPool]);

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

  const m = data?.market_state;
  const fresh = data?.meta.freshness;
  const sig = data?.signals;

  const allDates = data?.expirations.map((e) => e.date) ?? [];
  const noneSelected = selected !== null && selected.length === 0;
  const checked = selected ?? allDates; // dates shown ticked in the menu
  // "Live" only if a real tick arrived recently AND the transport isn't offline — once offline,
  // the last payload's `live:true` must not keep live values on screen as if current.
  const isLive = (live?.live ?? false) && !streamOffline;
  const ls = liveStatus(live);          // session-aware live/stale status for the chip

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <TextField
          size="small" label="Ticker" value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && symbol) navigate(`/${symbol}`); }}
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

      {!noneSelected && m && (
        <>
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
            <Stat label="Max pain" value={`$${m.max_pain ?? '—'}`} accent="neutral"
              info="Price at the nearest monthly expiration where the most option value expires worthless — a mild magnet into expiry." />
            <Stat label="IV / HV" value={m.iv_hv_ratio.toFixed(2)} accent="neutral"
              info="Implied volatility ÷ recent realized volatility. >1 = options look expensive (favor selling); <1 = cheap (favor buying)." />
            <Stat label="VWAP" value={m.vwap != null ? `$${m.vwap.toFixed(2)}` : '—'} accent="neutral"
              info="Volume-weighted average price for the session — a common intraday fair-value / mean-reversion reference." />
            {data?.off_exchange?.ratio_pct != null && (
              <Stat label="Off-exchange %" value={`${data.off_exchange.ratio_pct}%`} accent="neutral"
                info={`Share of recent volume printed off-lit (dark pools/ATS + internalized retail). Top levels: ${
                  data.off_exchange.levels.slice(0, 3).map((l) => `$${l.price} (${l.share_of_offex_pct}%)`).join(', ') || '—'
                }. Side/intent unknown — context only, not a directional signal.`} />
            )}
            <Stat label="Opportunity" value={`${sig?.opportunity_score ?? 0}`} accent="neutral"
              info="0–100 triage score for how actionable the setup is now (closeness to a key level + volatility extremity + confluence). Not a trade signal." />
          </Box>

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
    </Container>
  );
}

export function App() {
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

export default App;
