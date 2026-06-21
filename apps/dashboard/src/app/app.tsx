import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  AppBar, Toolbar, Typography, Container, Box, Card, CardContent,
  Chip, CircularProgress, TextField, Stack, Alert,
  FormControl, InputLabel, Select, OutlinedInput, MenuItem, Checkbox, ListItemText,
} from '@mui/material';
import { getTicker, TickerBundle } from '@org/api';
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'up' | 'down' | 'neutral' }) {
  return (
    <StatTile accent={accent} variant="outlined">
      <CardContent>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6">{value}</Typography>
      </CardContent>
    </StatTile>
  );
}

function TickerDashboard() {
  const { ticker = 'TSLA' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TickerBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState(ticker);
  // Selected expirations to scope the GEX profile. [] means "all" (no filter sent).
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(() => {
    getTicker(ticker, { expirations: selected })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [ticker, selected]);

  // Reset the expiration filter (back to "all") whenever the ticker changes.
  useEffect(() => { setSelected([]); setData(null); }, [ticker]);

  // (Re)load on ticker/selection change, then poll on the cache cadence.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const m = data?.market_state;
  const fresh = data?.meta.freshness;
  const sig = data?.signals;

  const allDates = data?.expirations.map((e) => e.date) ?? [];
  // What the Select shows as "checked": the explicit selection, or every date when "all".
  const checked = selected.length ? selected : allDates;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <TextField
          size="small" label="Ticker" value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && symbol) navigate(`/${symbol}`); }}
        />
        <FormControl size="small" sx={{ minWidth: 220 }} disabled={!allDates.length}>
          <InputLabel>Expirations</InputLabel>
          <Select
            multiple
            value={checked}
            input={<OutlinedInput label="Expirations" />}
            onChange={(e) => {
              const v = (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value);
              // All checked -> store [] ("all", no filter); otherwise the chosen subset.
              setSelected(v.length === allDates.length ? [] : v);
            }}
            renderValue={() => (selected.length === 0 ? 'All expirations' : `${selected.length} selected`)}
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
        {sig?.regime && (
          <Chip
            label={sig.regime.replace('_', ' ')}
            color={sig.regime === 'positive_gamma' ? 'success' : 'error'}
          />
        )}
        {fresh?.stale && (
          <Alert severity="warning" sx={{ py: 0 }}>
            data is {humanAge(fresh.data_age_seconds)} old — levels may be unreliable
          </Alert>
        )}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <CircularProgress />}

      {m && (
        <>
          <Typography variant="h1" gutterBottom>
            {m.ticker} · ${m.price?.toFixed(2)}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              (levels @ ${m.gex_spot?.toFixed(2)} · {selected.length === 0 ? 'all expirations' : `${selected.length} expirations`})
            </Typography>
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
            <Stat label="Call wall" value={`$${m.call_wall}`} accent="up" />
            <Stat label="Put wall" value={`$${m.put_wall}`} accent="down" />
            <Stat label="Gamma flip" value={`$${m.gamma_flip}`} accent="neutral" />
            <Stat label="Peak GEX (magnet)" value={`$${m.peak_gex_strike ?? '—'}`} accent="neutral" />
            <Stat label="Net GEX" value={`$${(m.net_gex / 1e6).toFixed(1)}M`} accent={m.net_gex >= 0 ? 'up' : 'down'} />
            <Stat label="Max pain" value={`$${m.max_pain ?? '—'}`} accent="neutral" />
            <Stat label="IV / HV" value={m.iv_hv_ratio.toFixed(2)} accent="neutral" />
            <Stat label="Opportunity" value={`${sig?.opportunity_score ?? 0}`} accent="neutral" />
          </Box>

          {data?.strike_profile && (
            <GexProfileChart
              strikes={data.strike_profile.strikes}
              spot={m.gex_spot ?? m.price}
              callWall={m.call_wall}
              putWall={m.put_wall}
              gammaFlip={m.gamma_flip}
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
