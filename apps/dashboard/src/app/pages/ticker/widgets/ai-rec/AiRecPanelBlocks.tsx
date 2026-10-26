/**
 * Presentational blocks for AiRecPanel (loading, signed-out, actions, powering, model).
 * The panel owns the state machine; these never fetch or invent policy.
 */
import { catalogForPreference } from '@/features/auth/aiProviderLabels';
import { AUTH_COPY } from '@/features/auth/copy';
import { RUN_SCENARIO, SCRIPTED_CHIP } from '@/features/trading/orders/copy';
import { fmtAsOfEt } from '@/pages/ticker/widgets/_kit/copy';
import { typographyTokens } from '@/shared/theme/tokens';
import type { AiProvidersBootstrap, RecScenarioInfo, TickerBundle } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  CAP_CAPTION,
  capTitle,
  cooldownCaption,
  cooldownLabel,
  COPY,
  friendlyResetTime,
  POWERING,
  retryInCooldown,
  retryWhenReset,
  unavailableCause,
} from './copy';
import { MARKET_DATA_PAUSED_REASON, type deriveAiRecPresentation } from './presentationPolicy';

const MONO = typographyTokens.monoFontFamily;

// ---- Loading (AC1/AC2) -----------------------------------------------------------------------
export function LoadingBlock({
  ticker,
  readName,
  path,
  model,
}: {
  ticker: string;
  readName: string;
  path: string | null;
  model: string | null;
}) {
  const asking =
    path && model
      ? `Asking ${path} (${model})…`
      : `Asking the AI for a risk-first read on ${ticker} (${readName}). This can take a few seconds.`;
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CircularProgress size={18} />
        <Typography variant="subtitle1" component="p">
          {COPY.loading.title}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {asking}
      </Typography>
    </Box>
  );
}

// ---- Snapshot idle hint ----------------------------------------------------------------------
export function SnapshotHint({ bundle }: { bundle: TickerBundle | null }) {
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
      Reads the current snapshot
      {/* Fidelity repair 2, N5 — the exchange-clock form (design: `Snapshot as of 10:41:52 ET`),
          never the raw ISO instant. */}
      {bundle?.meta.freshness.snapshot_iso
        ? `, as of ${fmtAsOfEt(bundle.meta.freshness.snapshot_iso)}`
        : ''}
      .
    </Typography>
  );
}

// ---- Signed-out gate (AC-E4/E7) — Figma 149:598 signed-out state -----------------------------
// A centered prompt + a single enabled "Sign in to ask AI" CTA (no disabled Get button). When the
// sign-in transport itself is degraded, show that warning copy with no button.
export function SignedOutGate({
  hasRec,
  promptText,
  onSignIn,
}: {
  hasRec: boolean;
  promptText: string | null;
  onSignIn: () => void;
}) {
  const degraded = promptText === AUTH_COPY.gate.unavailable;
  return (
    <Box
      data-testid="ai-rec-auth-gate"
      sx={{
        mt: hasRec ? 2 : 1,
        p: 3,
        borderRadius: 3,
        bgcolor: 'action.hover',
        textAlign: 'center',
      }}
    >
      <Typography
        data-testid="ai-rec-signin-prompt"
        variant="body2"
        sx={{ color: degraded ? 'warning.main' : 'text.secondary', mb: degraded ? 0 : 1.5 }}
      >
        {degraded ? promptText : AUTH_COPY.askAi.signedOut}
      </Typography>
      {!degraded && (
        <Tooltip arrow describeChild title={AUTH_COPY.askAi.tooltip}>
          <Button variant="contained" onClick={onSignIn} data-testid="ai-rec-signin-button">
            {AUTH_COPY.askAi.cta}
          </Button>
        </Tooltip>
      )}
    </Box>
  );
}

/**
 * The quiet-gate note — the ONE shared shell for both A1b (idle · quiet gate) and A1c (the
 * request-scope annex composing over a produced read, SPEC §4.5). `includeStanceLine` is the ONLY
 * difference between the two arms' DOM: A1b renders Convexa's own Mono `no_trade` stance (there is
 * no verdict yet to collide with); A1c never does, because a real verdict IS mounted and printing
 * the machine stance beside it would put two competing stances at the top of one panel (canon rule
 * 23, criterion 42). Both arms render the SAME title/caption/`Ask anyway` — row 33 forbids
 * identifying either arm by that shared string alone, which is why callers key on the stance line's
 * presence/absence (or a mounted verdict) rather than on this component's own testid.
 */
export function QuietGateNote({
  reasons,
  onAskAnyway,
  includeStanceLine,
  sx,
}: {
  reasons: string[];
  onAskAnyway: () => void;
  includeStanceLine: boolean;
  sx?: object;
}) {
  return (
    <Box data-testid="ai-rec-quiet-gate" sx={sx}>
      {includeStanceLine && (
        <Typography
          data-testid="ai-rec-quiet-gate-stance"
          sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary', mb: 0.5 }}
        >
          no_trade
        </Typography>
      )}
      <Typography sx={{ fontWeight: 500, fontSize: 14, color: 'text.primary', mb: 1.5 }}>
        {COPY.noEdge.title}
        {reasons.length ? ` — ${reasons[0]}` : ''}
      </Typography>
      <Tooltip arrow describeChild title={COPY.tooltip.askAnyway}>
        <Button variant="outlined" size="small" color="inherit" onClick={onAskAnyway}>
          {COPY.action.askAnyway}
        </Button>
      </Tooltip>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
        {COPY.noEdge.caption}
      </Typography>
    </Box>
  );
}

// ---- The gated action control ----------------------------------------------------------------
export function ActionRegion({
  cap,
  cooldownRemaining,
  reasons,
  compact,
  ticker,
  scenarioSelected = false,
  requestState,
  actions,
  onGet,
  onAskAnyway,
}: {
  cap: { over_limit: boolean; resets_at: string };
  cooldownRemaining: number;
  reasons: string[];
  compact: boolean;
  ticker: string;
  /** ai-rec-backtest-orders: a selected scenario is keyless/cost-free — cooldown/cap disabled
   *  states do NOT block it (AC-38); the readiness gate + override stay exactly real (AC-43). */
  scenarioSelected?: boolean;
  requestState: ReturnType<typeof deriveAiRecPresentation>['requestState'];
  actions: ReturnType<typeof deriveAiRecPresentation>['actions'];
  onGet: () => void;
  onAskAnyway: () => void;
}) {
  const box = { mt: compact ? 2 : 1 };
  // With a scenario selected, the primary action reads "Run scenario" (UX §6).
  const primaryLabel = scenarioSelected ? RUN_SCENARIO : COPY.action.get;

  // Policy is derived once by the host. These branches only render the named state and never
  // re-check freshness/completeness independently.
  // A selected scenario is NOT blocked by a keyless deployment: scenario runs are keyless by
  // design (the server skips key resolution entirely) — mirrors the cap/cooldown bypass below.
  if (requestState === 'missing_key') {
    return (
      <Box sx={box}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
        >
          <Button variant="contained" size="small" disabled>
            {COPY.action.get}
          </Button>
          <Chip size="small" variant="outlined" label={COPY.noKey.chip} />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {COPY.noKey.caption}
        </Typography>
      </Box>
    );
  }

  // daily_cap_reached (AC10) — calm blocked state, NOT an error; export floor stays. A scenario
  // run is neither blocked by nor consumes the cap (AC-38) — the action stays enabled.
  if (requestState === 'daily_cap') {
    return (
      <Box sx={box}>
        <Button variant="contained" size="small" disabled>
          {capTitle(friendlyResetTime(cap.resets_at))}
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {CAP_CAPTION}
        </Typography>
      </Box>
    );
  }

  // cooling_down (AC9) — disabled with a visible countdown; re-enables at 0. A scenario run is
  // not blocked by the cooldown (AC-38).
  if (requestState === 'cooldown') {
    return (
      <Box sx={box}>
        <Button variant="contained" size="small" disabled>
          {cooldownLabel(cooldownRemaining)}
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {cooldownCaption(cooldownRemaining)}
        </Typography>
      </Box>
    );
  }

  // no_fresh_edge (AC8) — A1b, "idle · quiet gate" (SPEC §4.5 row 41): everything idle (A1a)
  // renders — the same primary control, disabled under the closed gate exactly as it is disabled
  // under any other non-actionable idle sub-state — PLUS the quiet-gate note as a footnote beneath
  // it. `no_edge` is an OVERRIDE, not a wall (`ai-rec/copy.ts:89`): a state that hid the composer and
  // replaced it outright rendered the override as a block, which is the shape SPEC §4.5 corrects.
  // The real readiness gate behaves IDENTICALLY with a scenario selected (AC-43).
  if (requestState === 'no_edge') {
    return (
      <Box sx={box}>
        <Tooltip arrow describeChild title={COPY.tooltip.get.replace('{TICKER}', ticker)}>
          <Button
            variant="contained"
            size="small"
            onClick={onGet}
            disabled={!actions.analyze && !actions.retry}
          >
            {primaryLabel}
          </Button>
        </Tooltip>
        <QuietGateNote
          reasons={reasons}
          onAskAnyway={onAskAnyway}
          includeStanceLine
          sx={{ mt: 1.5 }}
        />
      </Box>
    );
  }

  if (requestState === 'unavailable') {
    return null;
  }

  // idle — Available (AC1 entry point). "Run scenario" when a scenario is selected.
  return (
    <Box sx={box}>
      <Tooltip arrow describeChild title={COPY.tooltip.get.replace('{TICKER}', ticker)}>
        <Button
          variant="contained"
          size="small"
          onClick={onGet}
          disabled={!actions.analyze && !actions.retry}
        >
          {primaryLabel}
        </Button>
      </Tooltip>
    </Box>
  );
}

// ---- Unavailable (AC11) ----------------------------------------------------------------------
export function UnavailableBlock({
  cap,
  cooldownRemaining,
  retryAllowed,
  onRetry,
  scenario = null,
  reason = null,
}: {
  cap: { over_limit: boolean; resets_at: string };
  cooldownRemaining: number;
  retryAllowed: boolean;
  onRetry: () => void;
  /** Non-null when a FAULT SCENARIO produced this degraded state — the scripted marking still
   *  shows so the operator knows it was scripted (UX §6, AC-40). The block itself is the standard
   *  unavailable handling — no special copy (AC-35). */
  scenario?: RecScenarioInfo | null;
  /** `rec.unavailable_reason` (no-vendor-production-posture F4). A `market_data_paused` fault gets
   *  its own honest, no-blame copy and an info tone — `retryAllowed` is already false for it
   *  (`presentationPolicy.ts`'s sole authority), this only swaps the WORDS. Every other reason
   *  reads "Couldn’t get a read" with its cause (`unavailableCause`). */
  reason?: string | null;
}) {
  const paused = reason === MARKET_DATA_PAUSED_REASON;
  // Presentation policy is the sole authority for retry actionability. Cap/cooldown remain visible
  // as explanatory context, but must not independently disable a retry (scenario retries bypass them).
  const blockedByCooldown = cooldownRemaining > 0;
  const blockedByCap = cap.over_limit;
  const sub = paused
    ? null // nothing about cap/cooldown explains a standing paused fact
    : blockedByCooldown
      ? retryInCooldown(cooldownRemaining)
      : blockedByCap
        ? retryWhenReset(friendlyResetTime(cap.resets_at))
        : null;
  return (
    <Alert
      severity={paused ? 'info' : 'warning'}
      sx={{ mt: 1 }}
      data-testid={paused ? 'ai-rec-state-market-data-paused' : undefined}
      action={
        <Stack spacing={0.25} sx={{ alignItems: 'flex-end' }}>
          {retryAllowed && (
            <Button color="inherit" size="small" onClick={onRetry}>
              {COPY.action.retry}
            </Button>
          )}
          {sub && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {sub}
            </Typography>
          )}
        </Stack>
      }
    >
      {/* component="p" (stage-3 §5.6): transient-state title, not document structure. */}
      <Typography variant="subtitle2" component="p">
        {paused ? COPY.marketDataPaused.title : COPY.unavailable.title}
      </Typography>
      <Typography variant="body2">
        {paused
          ? COPY.marketDataPaused.body
          : `${unavailableCause(reason)} ${COPY.unavailable.body}`}
      </Typography>
      {scenario && (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          label={SCRIPTED_CHIP}
          data-testid="ai-rec-scripted-chip"
          sx={{ mt: 0.5 }}
        />
      )}
    </Alert>
  );
}

export function AskModelSelect({
  bootstrap,
  disabled,
  onChange,
}: {
  bootstrap: AiProvidersBootstrap | null;
  disabled: boolean;
  onChange: (id: string) => void | Promise<void>;
}) {
  if (!bootstrap) return null;
  const models = catalogForPreference(bootstrap);
  if (models.length === 0) return null;
  const selected = bootstrap.preference?.model ?? '';
  const inCatalog = models.some((m) => m.id === selected);
  return (
    <FormControl size="small" fullWidth sx={{ mt: 1, mb: 1 }} data-testid="ai-rec-model-select">
      <Select
        aria-label="Model for recommendations"
        value={inCatalog ? selected : ''}
        displayEmpty
        disabled={disabled}
        onChange={(e) => void onChange(String(e.target.value))}
        inputProps={{ 'data-testid': 'ai-rec-model-select-input' }}
        sx={{ fontFamily: MONO }}
      >
        {models.map((m) => (
          <MenuItem key={m.id} value={m.id} sx={{ fontFamily: MONO }}>
            {m.id}
            {m.recommended ? ' · catalog recommended default' : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function PoweringCta({ reason, onSettings }: { reason: string; onSettings: () => void }) {
  const cfg =
    reason === 'key_unusable'
      ? { testid: 'ai-rec-state-key-unusable', ...POWERING.keyUnusable }
      : reason === 'key_rejected'
        ? { testid: 'ai-rec-state-key-rejected', ...POWERING.keyRejected }
        : reason === 'model_not_in_catalog'
          ? { testid: 'ai-rec-state-model-missing', ...POWERING.modelMissing }
          : reason === 'model_unset'
            ? { testid: 'ai-rec-state-model-unset', ...POWERING.modelUnset }
            : reason === 'oauth_expired'
              ? { testid: 'ai-rec-state-oauth-expired', ...POWERING.oauthExpired }
              : reason === 'oauth_unlinked'
                ? { testid: 'ai-rec-state-oauth-unlinked', ...POWERING.oauthUnlinked }
                : reason === 'subscription_unavailable'
                  ? {
                      testid: 'ai-rec-state-subscription-unavailable',
                      ...POWERING.subscriptionUnavailable,
                    }
                  : { testid: 'ai-rec-state-no-key', ...POWERING.noKey };
  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }} data-testid={cfg.testid}>
      <Typography variant="subtitle1" component="p">
        {cfg.title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {cfg.body}
      </Typography>
      <Button
        variant="contained"
        size="small"
        sx={{ mt: 1.5 }}
        data-testid="ai-rec-add-key-cta"
        onClick={onSettings}
      >
        {cfg.cta}
      </Button>
    </Box>
  );
}
