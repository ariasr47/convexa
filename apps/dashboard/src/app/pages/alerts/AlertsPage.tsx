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
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { extrasFor } from '@/shared/theme/tokens';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
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
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { Link as RouterLink } from 'react-router-dom';

/** The three score-gate quick presets (design/src/screens/alerts.mjs:23, `50 · 70 · 85`) — they
 *  fill the SAME `scoreMin` field the number input already drives; no second source of truth. */
const SCORE_PRESETS = [50, 70, 85] as const;

/** Rules-list filter (design/src/screens/alerts.mjs:30, `All · Armed · Paused`) — a READ-side
 *  derivation over `a.rules`, never a store write; default `all` renders every rule, exactly as
 *  the page did before this control existed. */
type RuleFilter = 'all' | 'armed' | 'paused';

// ---- The faulted posture — a small LOCAL mirror of `PositionRow.tsx:122-127`'s attribute set -----
// (PLAN FE-10 note 7: the test asserts the SAME attribute set as `Refused` so the two cannot drift
// silently, without importing the trading domain into alerts.)

const ALERTS_FAULTED_BANNER_ID = 'alerts-faulted-banner';

const ALERTS_WRITE_REFUSED_TIP =
  "Paused — Convexa couldn't read your saved alerts and won't save anything new until that's " +
  'sorted. Your existing rules are untouched.';

// GATE Z, finding 3 (criterion 66): MUI `Select` self-duplicates its own class
// (`&.${selectClasses.select}`, `Select/SelectInput.js`) to "win specificity over the input
// base" at (0,2,0) — a bare `[role="combobox"]` (0,1,0) or a scoped `sx` descendant selector tied
// at (0,2,0) both lose that fight (confirmed by measuring computed `min-height` in a real
// browser). Doubling the SAME class ourselves reaches (0,3,0), which wins unconditionally —
// `theme.ts`'s own coarse-pointer floor comment points here as the pattern.
const selectCoarseFloorSx = {
  '@media (pointer: coarse)': {
    '& .MuiSelect-select.MuiSelect-select': { minHeight: 44 },
  },
} as const;

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
  const marketDataMode = useMarketDataMode();
  const [symbol, setSymbol] = useState('SPY');
  const [kind, setKind] = useState<AlertKind>('score_gate');
  const [level, setLevel] = useState<LevelRef>('gamma_flip');
  const [scoreMin, setScoreMin] = useState(70);
  const [priceThreshold, setPriceThreshold] = useState(500);
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all');

  const filteredRules = useMemo(() => {
    if (ruleFilter === 'armed') return a.rules.filter((r) => r.enabled);
    if (ruleFilter === 'paused') return a.rules.filter((r) => !r.enabled);
    return a.rules;
  }, [a.rules, ruleFilter]);

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

  const RULE_FILTERS: { key: RuleFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'armed', label: 'Armed' },
    { key: 'paused', label: 'Paused' },
  ];
  const filterPillSx = (active: boolean) => ({
    cursor: 'pointer',
    border: '1px solid',
    font: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 600,
    borderRadius: 999,
    padding: '3px 10px',
    minHeight: 26,
    ...(active
      ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.main' }
      : { background: 'transparent', color: 'text.secondary', borderColor: 'divider' }),
  });

  return (
    <Box
      data-testid="alerts-page"
      sx={{
        maxWidth: 1160,
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
      {/* Rules evaluate on structure snapshots, and none arrive while the server runs paused. */}
      {marketDataMode === 'paused' && (
        <Alert severity="info" icon={<PauseCircleOutlinedIcon />} role="status" sx={{ mb: 3 }}>
          Live market data is off, so no rule can fire right now. Rules you add stay saved in this
          browser.
        </Alert>
      )}

      {/* Two columns at ≥ laptop (1100px, `theme.ts:93`) — design/src/screens/alerts.mjs:6,
          `minmax(0,5fr) minmax(0,7fr)`: the New rule composer beside Rules + Fired. One column
          below. The composer's 5fr share stays ≤ 45% of this grid's width at every checked
          width — a CSS fraction, not a pixel cap, so it holds at 1280/1440 by construction. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', laptop: 'minmax(0, 5fr) minmax(0, 7fr)' },
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* ---- New rule composer ---- */}
        <Stack
          spacing={2}
          data-testid="alerts-composer"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '10px',
            p: 2,
            minWidth: 0,
          }}
        >
          <Box>
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, m: 0 }}>
              New rule
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rules evaluate against structure snapshots while a ticker desk is open — not a
              background stream.
            </Typography>
          </Box>
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
              sx={selectCoarseFloorSx}
            >
              {KINDS.map((k) => (
                <MenuItem key={k.value} value={k.value}>
                  {k.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {kind === 'score_gate' && (
            <Stack spacing={1}>
              <TextField
                label="Score ≥"
                type="number"
                size="small"
                value={scoreMin}
                onChange={(e) => setScoreMin(Number(e.target.value))}
              />
              {/* Score presets (design/src/screens/alerts.mjs:23) — fill the SAME field above;
                  purely a shortcut, never a second value. */}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {SCORE_PRESETS.map((v) => (
                  <Box
                    key={v}
                    component="button"
                    type="button"
                    onClick={() => setScoreMin(v)}
                    aria-pressed={scoreMin === v}
                    data-testid={`alerts-score-preset-${v}`}
                    sx={filterPillSx(scoreMin === v)}
                  >
                    {v}
                  </Box>
                ))}
                {/* No "Prime starts around N" caption (the design mock carries one): the tier band
                    is a server setting the client never receives — `TIER_PRIME_SCORE` defaults
                    to 75 and Prime also needs an AI read — so any number here would be a claim
                    the data does not vouch for. */}
              </Stack>
            </Stack>
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
                  sx={selectCoarseFloorSx}
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
          {/* The browser-notifications row (design/src/screens/alerts.mjs:24) — one recessed row
              holding the explanation and the (unchanged) notify button. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              p: '10px 12px',
              borderRadius: '8px',
              bgcolor: (t) => extrasFor(t).well,
              border: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
            }}
          >
            <NotificationsNoneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 160px' }}>
              Fired alerts are listed here. Browser notifications, once allowed, also pop while a
              desk is open.
            </Typography>
            <AlertsRefused when={faulted}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => void a.requestBrowserPermission()}
                data-testid="alerts-notify"
                sx={{ minHeight: 44 }}
              >
                {a.notifyBrowser ? 'Browser notify on' : 'Enable browser notify'}
              </Button>
            </AlertsRefused>
          </Box>
          {notifyExplain && (
            <Typography
              variant="caption"
              color="text.secondary"
              data-testid="alerts-notify-explain"
            >
              {notifyExplain}
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center' }}
          >
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
            <Typography variant="caption" color="text.secondary">
              Stored in this browser · {a.rules.length} rule{a.rules.length === 1 ? '' : 's'}
            </Typography>
          </Stack>
        </Stack>

        {/* ---- Rules + Fired ---- */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 2 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}
            >
              <Typography component="h2" variant="h6" sx={{ fontWeight: 700, m: 0 }}>
                Rules ({a.rules.length})
              </Typography>
              <Box sx={{ flex: 1 }} />
              {/* Rules filter (design/src/screens/alerts.mjs:30) — a read-side view over the SAME
                  `a.rules`, default `all`, never a store write. */}
              <Stack
                direction="row"
                spacing={0.5}
                data-testid="alerts-rule-filter"
                sx={{ alignItems: 'center' }}
              >
                {RULE_FILTERS.map((f) => (
                  <Box
                    key={f.key}
                    component="button"
                    type="button"
                    onClick={() => setRuleFilter(f.key)}
                    aria-pressed={ruleFilter === f.key}
                    data-testid={`alerts-rule-filter-${f.key}`}
                    sx={filterPillSx(ruleFilter === f.key)}
                  >
                    {f.label}
                  </Box>
                ))}
              </Stack>
            </Stack>
            <Stack spacing={1} data-testid="alerts-rules">
              {a.rules.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No rules yet — add a score gate on SPY to try the path.
                </Typography>
              )}
              {a.rules.length > 0 && filteredRules.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No rules match this filter.
                </Typography>
              )}
              {filteredRules.map((r) => (
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
                    // GATE Z (criterion 66, curvature-v2-surfaces phase 3): a `Switch`/`FormControlLabel`
                    // renders a `<label>`/`<span>` pair, neither of which matches `theme.ts`'s coarse-pointer
                    // floor selector (`button, [role="button"], a`), so the floor never applied here — the
                    // label's own effective hit area measured 163.3×24.75 at 393px/coarse, under the 44px
                    // floor in height. Width already clears 44px; only height needed a coarse-pointer floor,
                    // scoped so desktop density is unchanged.
                    sx={{ '@media (pointer: coarse)': { minHeight: 44 } }}
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
                      // GATE Z (criterion 66): the inline `minHeight: 40` compiles to a class
                      // (specificity 0,1,0) which beats `theme.ts`'s plain-element coarse-pointer floor
                      // selector (0,0,1) regardless of the media query, so the global 44px floor never
                      // reached this button — measured 64×40 at 393px/coarse. The nested `@media` rule
                      // below is emitted into the SAME class, so it wins the cascade only when the
                      // condition matches; desktop/fine-pointer stays 40 exactly as shipped.
                      sx={{
                        minHeight: 40,
                        '@media (pointer: coarse)': { minHeight: 44, minWidth: 44 },
                      }}
                    >
                      Remove
                    </Button>
                  </AlertsRefused>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '10px',
              p: 2,
              bgcolor: (t) => extrasFor(t).well,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}
            >
              <Typography component="h2" variant="h6" sx={{ fontWeight: 700, m: 0 }}>
                Recent ({a.events.length})
              </Typography>
              <Box sx={{ flex: 1 }} />
              {/* "Mark N read" acts on THIS list (`markAllEventsRead`), so it lives on this
                  header — same element, text and handler as before, only its home moved. */}
              {a.unread > 0 && (
                <AlertsRefused when={faulted}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => a.markAllEventsRead()}
                    sx={{ minHeight: 44 }}
                  >
                    Mark {a.unread} read
                  </Button>
                </AlertsRefused>
              )}
            </Stack>
            {/* U-24: the back-fill honesty line + the "stored in this browser" durable disclosure. */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Stored in this browser only — not synced to your account or across devices. Firings
              recorded before this update keep their original wording; new firings use the labels
              above.
            </Typography>
            <Stack spacing={1} data-testid="alerts-events">
              {a.events.length === 0 &&
                (!a.hasEvaluated ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    data-testid="alerts-events-empty"
                  >
                    No snapshot has been evaluated yet this session — open a ticker so rules can
                    evaluate.
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    data-testid="alerts-events-empty"
                  >
                    No firings yet — open a ticker so a new snapshot can be evaluated against your
                    rules.
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
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                  >
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
        </Box>
      </Box>
    </Box>
  );
}

export default AlertsPage;
