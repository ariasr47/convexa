/**
 * /alerts — manage structure alert rules + recent firings (v1).
 * Static page chrome; evaluation runs on ticker/scan snapshots elsewhere.
 */
import type { AlertKind, LevelRef } from '@/features/alerts/types';
import { useAlerts } from '@/features/alerts/useAlerts';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const KINDS: { value: AlertKind; label: string }[] = [
  { value: 'score_gate', label: 'Score gate' },
  { value: 'tier_change', label: 'Tier change' },
  { value: 'level_touch', label: 'Level touch' },
];

const LEVELS: { value: LevelRef; label: string }[] = [
  { value: 'gamma_flip', label: 'Gamma flip' },
  { value: 'call_wall', label: 'Call wall' },
  { value: 'put_wall', label: 'Put wall' },
  { value: 'price', label: 'Price threshold' },
];

export function AlertsPage() {
  const a = useAlerts();
  const [symbol, setSymbol] = useState('SPY');
  const [kind, setKind] = useState<AlertKind>('score_gate');
  const [level, setLevel] = useState<LevelRef>('gamma_flip');
  const [scoreMin, setScoreMin] = useState(70);
  const [priceThreshold, setPriceThreshold] = useState(500);

  const add = () => {
    a.addRule({
      kind,
      symbol,
      level: kind === 'level_touch' ? level : undefined,
      scoreMin: kind === 'score_gate' ? scoreMin : undefined,
      priceThreshold: kind === 'level_touch' && level === 'price' ? priceThreshold : undefined,
    });
  };

  return (
    <Box
      data-testid="alerts-page"
      sx={{
        maxWidth: 720,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: { xs: 2, md: 4 },
        pb: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700, m: 0 }}>
          Alerts
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
          Level-touch, tier-change, and score-gate on structure snapshots — not a live stream. Open
          a ticker so rules can evaluate; optional browser notifications after you allow them.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          See <RouterLink to="/methodology">Methodology</RouterLink> for two-speed structure vs
          tape.
        </Typography>
      </Stack>

      <Stack spacing={2} sx={{ mb: 4 }} data-testid="alerts-composer">
        <TextField
          label="Symbol"
          size="small"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          slotProps={{ htmlInput: { 'aria-label': 'Alert symbol' } }}
        />
        <FormControl size="small">
          <InputLabel id="alert-kind">Kind</InputLabel>
          <Select
            labelId="alert-kind"
            label="Kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AlertKind)}
          >
            {KINDS.map((k) => (
              <MenuItem key={k.value} value={k.value}>
                {k.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {kind === 'score_gate' && (
          <TextField
            label="Score ≥"
            type="number"
            size="small"
            value={scoreMin}
            onChange={(e) => setScoreMin(Number(e.target.value))}
          />
        )}
        {kind === 'level_touch' && (
          <>
            <FormControl size="small">
              <InputLabel id="alert-level">Level</InputLabel>
              <Select
                labelId="alert-level"
                label="Level"
                value={level}
                onChange={(e) => setLevel(e.target.value as LevelRef)}
              >
                {LEVELS.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {level === 'price' && (
              <TextField
                label="Price threshold"
                type="number"
                size="small"
                value={priceThreshold}
                onChange={(e) => setPriceThreshold(Number(e.target.value))}
              />
            )}
          </>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={add} data-testid="alerts-add" sx={{ minHeight: 44 }}>
            Add rule
          </Button>
          <Button
            variant="outlined"
            onClick={() => void a.requestBrowserPermission()}
            data-testid="alerts-notify"
            sx={{ minHeight: 44 }}
          >
            {a.notifyBrowser ? 'Browser notify on' : 'Enable browser notify'}
          </Button>
          {a.unread > 0 && (
            <Button variant="text" onClick={() => a.markAllEventsRead()} sx={{ minHeight: 44 }}>
              Mark {a.unread} read
            </Button>
          )}
        </Stack>
      </Stack>

      <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Rules ({a.rules.length})
      </Typography>
      <Stack spacing={1} sx={{ mb: 3 }} data-testid="alerts-rules">
        {a.rules.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No rules yet — add a score gate on SPY to try the path.
          </Typography>
        )}
        {a.rules.map((r) => (
          <Box
            key={r.id}
            data-testid="alerts-rule"
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={r.enabled}
                  onChange={(_, on) => a.upsertRule({ ...r, enabled: on })}
                  size="small"
                />
              }
              label={`${r.symbol} · ${r.kind}`}
            />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {r.kind === 'score_gate' && `≥ ${r.scoreMin ?? 60}`}
              {r.kind === 'level_touch' && (r.level ?? 'level')}
              {r.kind === 'tier_change' && 'any tier transition'}
            </Typography>
            <Button size="small" onClick={() => a.removeRule(r.id)} sx={{ minHeight: 40 }}>
              Remove
            </Button>
          </Box>
        ))}
      </Stack>

      <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Recent ({a.events.length})
      </Typography>
      <Stack spacing={1} data-testid="alerts-events">
        {a.events.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Firings appear after a structure snapshot crosses a rule (open the ticker to poll).
          </Typography>
        )}
        {a.events.slice(0, 20).map((e) => (
          <Box
            key={e.id}
            data-testid="alerts-event"
            data-read={e.read ? 'true' : 'false'}
            sx={{
              p: 1.25,
              borderLeft: 3,
              borderColor: e.read ? 'divider' : 'primary.main',
              pl: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {e.message}
            </Typography>
            {e.detail && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {e.detail}
              </Typography>
            )}
            <Typography variant="caption" color="text.disabled">
              {new Date(e.at).toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default AlertsPage;
