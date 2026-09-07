/**
 * /alerts — manage structure alert rules + recent firings (v1).
 * Static page chrome; evaluation runs on ticker/scan snapshots elsewhere.
 *
 * curvature-v2-surfaces FE-10 (SPEC §2.5, §2.6, §3 E, §4.5): closed lookups replace raw wire
 * tokens (45); thresholds render by type with the closed-nine `not set` where a value is absent
 * (46, 47a/47b); the unread marker moves off the coloured edge alone (44); three distinct empty
 * sentences (48); the read-fault latch's faulted posture (N-5, identical in shape to
 * `PositionRow.tsx:122-127`'s `Refused`/`FaultedBanner`, mirrored locally rather than importing the
 * trading domain into alerts — carried debt, FE-14 item 7).
 */
import { KINDS, KIND_LABEL, LEVELS, LEVEL_LABEL, NOT_SET } from '@/features/alerts/labels';
import { alertsReadFaulted } from '@/features/alerts/store';
import type { AlertKind, AlertRule, LevelRef } from '@/features/alerts/types';
import { useAlerts } from '@/features/alerts/useAlerts';
import { NOT_RECORDED } from '@/shared/copy/notANumber';
import { faceFor } from '@/shared/figure';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import type { SxProps, Theme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  cloneElement,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { Link as RouterLink } from 'react-router-dom';

// ---- The faulted posture — a small LOCAL mirror of `PositionRow.tsx:122-127`'s attribute set -----
// (PLAN FE-10 note 7: the test asserts the SAME attribute set as `Refused` so the two cannot drift
// silently, without importing the trading domain into alerts.)

const ALERTS_FAULTED_BANNER_ID = 'alerts-faulted-banner';

const ALERTS_WRITE_REFUSED_TIP =
  "Paused — Convexa couldn't read your saved alerts and won't save anything new until that's " +
  'sorted. Your existing rules are untouched.';

const alertsRefusedSx = {
  color: 'action.disabled',
  bgcolor: 'action.disabledBackground',
  borderColor: 'action.disabledBackground',
  boxShadow: 'none',
  cursor: 'not-allowed',
  '&:hover': {
    color: 'action.disabled',
    bgcolor: 'action.disabledBackground',
    borderColor: 'action.disabledBackground',
    boxShadow: 'none',
  },
} as const;

/**
 * Wrap ANY control to refuse it while the alerts store is faulted — the SAME attribute set as
 * `features/trading/positions/FaultedBanner.tsx`'s `Refused`: `aria-disabled`, `aria-describedby`
 * pointing at the banner, `data-refused="true"`, no HTML `disabled` (which would drop the tab stop
 * and swallow the explaining tooltip), a no-op activation, and the theme's own
 * `action.disabled*` emphasis. `when === false` returns the child untouched.
 */
function AlertsRefused({ when, children }: { when: boolean; children: ReactElement }) {
  if (!when) return children;
  const swallow = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const ownSx = (children.props as { sx?: SxProps<Theme> }).sx;
  const blocked = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-disabled': true,
    'aria-describedby': ALERTS_FAULTED_BANNER_ID,
    'data-refused': 'true',
    onClick: (e: MouseEvent) => swallow(e),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') swallow(e);
    },
    sx: [...(Array.isArray(ownSx) ? ownSx : [ownSx]), alertsRefusedSx].filter(Boolean),
  });
  return (
    <Tooltip arrow title={ALERTS_WRITE_REFUSED_TIP}>
      {blocked}
    </Tooltip>
  );
}

/** `role="status"` — a standing condition, non-dismissible (a dismissal can't be persisted by a
 *  store that refuses writes). Four blocks, mirroring the positions banner's shape: what happened ·
 *  what was protected and what is refused · what you can do · what to expect. No apology, no error
 *  code. Nothing dims and no pause mark appears anywhere on this surface (faulted ≠ offline). */
function AlertsFaultedBanner() {
  return (
    <Box
      id={ALERTS_FAULTED_BANNER_ID}
      role="status"
      data-testid="alerts-faulted-banner"
      sx={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        border: '1px solid',
        borderColor: 'warning.main',
        borderRadius: 1,
        p: '10px 12px',
        mb: 3,
      }}
    >
      <WarningAmberIcon fontSize="small" aria-hidden sx={{ color: 'warning.main', mt: '1px' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'warning.main', m: 0 }}
        >
          Alerts paused — Convexa couldn't read your saved alerts
        </Typography>
        <Typography
          component="p"
          sx={{ fontSize: '0.78rem', color: 'text.primary', m: '4px 0 0', lineHeight: 1.5 }}
        >
          Rather than overwrite it, Convexa left your saved data exactly as it is. Nothing was
          deleted. The rules and firings below are the ones that loaded. New rules, firing history
          and read/unread changes will not be saved while this lasts.
        </Typography>
        <Box
          component="button"
          type="button"
          data-testid="alerts-faulted-reload"
          onClick={() => window.location.reload()}
          sx={{
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            font: 'inherit',
            fontSize: '0.78rem',
            color: 'info.main',
            p: 0,
            mt: '6px',
            textAlign: 'left',
          }}
        >
          Reload the page
        </Box>
        <Typography
          component="p"
          sx={{ fontSize: '0.78rem', color: 'text.secondary', m: '6px 0 0', lineHeight: 1.5 }}
        >
          If it comes back after a reload, the saved data in this browser needs attention. Convexa
          will keep it untouched either way.
        </Typography>
      </Box>
    </Box>
  );
}

// ---- Threshold rendering (§4.5, D-D) --------------------------------------------------------

/** A user-entered number: Mono (traced), no dotted rule — never the F9 `· untraced` caption
 *  (D-D, criteria 47a/47b). */
function TracedValue({ children, testId }: { children: string; testId?: string }) {
  return (
    <Box
      component="span"
      data-figure-register="mono"
      data-testid={testId}
      sx={{ ...faceFor(true), fontSize: '0.8rem' }}
    >
      {children}
    </Box>
  );
}

function RuleSummary({ rule }: { rule: AlertRule }) {
  if (rule.kind === 'score_gate') {
    return (
      <>
        {'Score gate: '}
        {rule.scoreMin != null ? (
          <TracedValue testId="alert-rule-threshold">{`≥ ${rule.scoreMin}`}</TracedValue>
        ) : (
          NOT_SET
        )}
      </>
    );
  }
  if (rule.kind === 'level_touch') {
    if (rule.level === 'price') {
      return (
        <>
          {'Price threshold: '}
          {rule.priceThreshold != null ? (
            <TracedValue testId="alert-rule-threshold">{`$${rule.priceThreshold}`}</TracedValue>
          ) : (
            NOT_SET
          )}
        </>
      );
    }
    // Structure level: the label FROM the closed lookup, no threshold number of the rule's own —
    // the level's value is a market fact the record does not hold (47d).
    return <>{rule.level ? LEVEL_LABEL[rule.level] : NOT_RECORDED}</>;
  }
  // tier_change — byte-identical.
  return <>any tier transition</>;
}

export function AlertsPage() {
  const a = useAlerts();
  const faulted = alertsReadFaulted();
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

  // Criterion 50 — a denied/unavailable permission renders a state SAYING SO; the control itself
  // (`a.notifyBrowser`, computed in `useAlerts` from the ACTUAL `Notification.permission`) already
  // never reads as "on" for a permission the browser did not grant.
  const notifyExplain =
    a.notifyPermission === 'denied'
      ? 'Browser notifications are blocked for this site. Alerts still show here, but nothing pops from the browser.'
      : a.notifyPermission === 'unavailable'
        ? "Browser notifications aren't available in this browser. Alerts still show here."
        : null;

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
        {/* Criterion 49: rules evaluate on structure snapshots, not a stream — no live mark or
            pulse anywhere on this page. */}
        <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
          Level-touch, tier-change, and score-gate on structure snapshots — not a live stream. Open
          a ticker so rules can evaluate; optional browser notifications after you allow them.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          See <RouterLink to="/methodology">Methodology</RouterLink> for two-speed structure vs
          tape.
        </Typography>
      </Stack>

      {faulted && <AlertsFaultedBanner />}

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
              // Criterion 47c (review): the unit rides the CONTROL itself, not just the label —
              // a `$` adornment, never a bare number whose unit is only implied.
              <TextField
                label="Price threshold"
                type="number"
                size="small"
                value={priceThreshold}
                onChange={(e) => setPriceThreshold(Number(e.target.value))}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                }}
              />
            )}
          </>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <AlertsRefused when={faulted}>
            <Button
              variant="contained"
              onClick={add}
              data-testid="alerts-add"
              sx={{ minHeight: 44 }}
            >
              Add rule
            </Button>
          </AlertsRefused>
          <AlertsRefused when={faulted}>
            <Button
              variant="outlined"
              onClick={() => void a.requestBrowserPermission()}
              data-testid="alerts-notify"
              sx={{ minHeight: 44 }}
            >
              {a.notifyBrowser ? 'Browser notify on' : 'Enable browser notify'}
            </Button>
          </AlertsRefused>
          {a.unread > 0 && (
            <AlertsRefused when={faulted}>
              <Button variant="text" onClick={() => a.markAllEventsRead()} sx={{ minHeight: 44 }}>
                Mark {a.unread} read
              </Button>
            </AlertsRefused>
          )}
        </Stack>
        {notifyExplain && (
          <Typography variant="caption" color="text.secondary" data-testid="alerts-notify-explain">
            {notifyExplain}
          </Typography>
        )}
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
                <AlertsRefused when={faulted}>
                  <Switch
                    checked={r.enabled}
                    onChange={(_, on) => {
                      if (faulted) return; // defense in depth alongside AlertsRefused's own swallow
                      a.upsertRule({ ...r, enabled: on });
                    }}
                    size="small"
                  />
                </AlertsRefused>
              }
              label={`${r.symbol} · ${KIND_LABEL[r.kind]}`}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1 }}
              data-testid="alerts-rule-summary"
            >
              <RuleSummary rule={r} />
            </Typography>
            <AlertsRefused when={faulted}>
              <Button
                size="small"
                onClick={() => {
                  if (faulted) return;
                  a.removeRule(r.id);
                }}
                sx={{ minHeight: 40 }}
              >
                Remove
              </Button>
            </AlertsRefused>
          </Box>
        ))}
      </Stack>

      <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Recent ({a.events.length})
      </Typography>
      {/* U-24: the back-fill honesty line + the "stored in this browser" durable disclosure. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Stored in this browser only — not synced to your account or across devices. Firings recorded
        before this update keep their original wording; new firings use the labels above.
      </Typography>
      <Stack spacing={1} data-testid="alerts-events">
        {a.events.length === 0 &&
          (!a.hasEvaluated ? (
            <Typography variant="body2" color="text.secondary" data-testid="alerts-events-empty">
              No snapshot has been evaluated yet this session — open a ticker so rules can evaluate.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" data-testid="alerts-events-empty">
              No firings yet — open a ticker so a new snapshot can be evaluated against your rules.
            </Typography>
          ))}
        {a.events.slice(0, 20).map((e) => (
          <Box
            key={e.id}
            data-testid="alerts-event"
            data-read={e.read ? 'true' : 'false'}
            sx={{
              p: 1.25,
              // The coloured edge is now REDUNDANT, never the sole carrier of the distinction
              // (criterion 44) — the label row + type below carry it, and the two states are
              // still distinguishable with colour removed entirely.
              borderLeft: 3,
              borderColor: e.read ? 'divider' : 'primary.main',
              pl: 1.5,
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
              {!e.read && (
                <Typography
                  component="span"
                  variant="caption"
                  data-testid="alerts-event-unread-label"
                  sx={{
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.primary',
                  }}
                >
                  Unread
                </Typography>
              )}
              {/* Stored `message` renders VERBATIM — no re-labelling of history (U-23a). */}
              <Typography variant="body2" sx={{ fontWeight: e.read ? 400 : 700 }}>
                {e.message}
              </Typography>
            </Stack>
            {e.detail && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {e.detail}
              </Typography>
            )}
            {/* U-27: every firing timestamp names its zone. */}
            <Typography variant="caption" color="text.disabled">
              {new Date(e.at).toLocaleString(undefined, { timeZoneName: 'short' })}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default AlertsPage;
