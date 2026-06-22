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

function Stat({ label, value, accent, info }:
  { label: string; value: string; accent?: 'up' | 'down' | 'neutral'; info?: string }) {
  const tile = (
    <StatTile accent={accent} variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          {info && <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
        </Stack>
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
  useEffect(() => { setSelected(null); setData(null); }, [ticker]);

  // (Re)load on ticker/selection change, then poll on the cache cadence. Data is updated
  // in place (not cleared) on a re-filter, so the view doesn't flicker between fetches.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Live SSE stream: mirrors the expiration filter. Skipped when nothing is selected.
  useEffect(() => {
    setLive(null);
    if (selected !== null && selected.length === 0) return;
    return streamTicker(ticker, { expirations: selected ?? undefined }, setLive);
  }, [ticker, selected]);

  const m = data?.market_state;
  const fresh = data?.meta.freshness;
  const sig = data?.signals;

  const allDates = data?.expirations.map((e) => e.date) ?? [];
  const noneSelected = selected !== null && selected.length === 0;
  const checked = selected ?? allDates; // dates shown ticked in the menu
  const isLive = live?.live ?? false;   // a real tick arrived recently (vs. stale last-known)
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
        {ls && (
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

      {error && <Alert severity="error">{error}</Alert>}
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
              value={`$${live?.gamma_flip ?? m.gamma_flip}`} accent="neutral"
              info="The price where dealer hedging switches from calming moves to amplifying them. Above it → steadier/range-bound; below it → more volatile/trending." />
            <Stat
              label={`Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`}
              value={isLive ? `${live!.net_flow >= 0 ? '+' : ''}${live!.net_flow.toLocaleString()}` : '—'}
              accent={!isLive ? 'neutral' : live!.net_flow >= 0 ? 'up' : 'down'}
              info="Aggressive buys minus sells over the last few minutes, from the live trade tape. Positive = buyers lifting the ask; negative = sellers hitting the bid." />
            <Stat label="Spread" value={isLive && live?.spread != null ? `$${live.spread.toFixed(2)}` : '—'} accent="neutral"
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
