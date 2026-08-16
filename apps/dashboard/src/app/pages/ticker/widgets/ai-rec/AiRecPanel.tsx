/**
 * AiRecPanel — the dedicated rec card + its full state machine (UX_BLUEPRINT §2/§3). Independently
 * nullable: its failure NEVER blanks the GEX chart, the neutral tiles, the off-exchange blocks, the
 * ghost-trade tracker, or the live stream (the page renders this as one isolated sibling card; a
 * thrown rec fault is caught in the hook and shown here as `unavailable`).
 *
 * Binding framing honored throughout: advice behind an explicit Accept (never a command), risk +
 * invalidation FIRST, `no_trade` first-class (info, not red), honest "as of {snapshot}" + stale
 * wording, the export floor reachable from every state. SIMULATED everywhere.
 */
import { AUTH_COPY } from '@/features/auth/copy';
import { useGate } from '@/features/auth/useGate';
import { useSettings } from '@/features/auth/useSettings';
import {
  RUN_SCENARIO,
  SCENARIO_CAPTION,
  SCENARIO_LABEL,
  SCENARIO_NONE,
  SCRIPTED_CHIP,
} from '@/features/trading/orders/copy';
import { typographyTokens } from '@/shared/theme/tokens';
import { Widget } from '@/shared/ui/Widget';
import type { PersonaDefinition, RecResponse, RecScenarioInfo, TickerBundle } from '@convexa/api';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnalysisSurface } from './AnalysisSurface';
import {
  adminExhaustedTitle,
  BYO_KEY,
  CAP_CAPTION,
  capTitle,
  cooldownCaption,
  cooldownLabel,
  COPY,
  FREE_USES_TOTAL_FALLBACK,
  friendlyResetTime,
  retryInCooldown,
  retryWhenReset,
} from './copy';
import { DecisionCard } from './DecisionCard';
import { deriveAiRecPresentation } from './presentationPolicy';
import type { AiRec, RecRequestOpts } from './useAiRecommendation';

export { useReadPersonas } from './useReadPersonas';

const MONO = typographyTokens.monoFontFamily; // verdict labels render in Roboto Mono (Figma 149:598)

/** Map an `unavailable` rec's `unavailable_reason` to one of the three key-resolution CTA states
 *  (a/c/e). Returns null when it's NOT a byo-ai-key reason (so the shipped `unavailable` block shows).
 *  The FE keys ONLY off these three intents (UX_BLUEPRINT §3); any other reason falls through. */
function byoCtaState(
  rec: RecResponse | null,
): 'no_key' | 'over_limit' | 'shared_key_unconfigured' | null {
  if (!rec || rec.status !== 'unavailable') return null;
  const r = rec.unavailable_reason;
  if (r === 'no_key' || r === 'over_limit' || r === 'shared_key_unconfigured') return r;
  return null;
}

interface Props {
  ticker: string;
  bundle: TickerBundle | null;
  ai: AiRec;
  personas: PersonaDefinition[]; // canonical (or embedded fallback) read-persona options
  activePersonaId: string; // 'default' | preset/custom id
  dataAge: string | null; // humanized bundle age, for the stale-born strip
  onAccept: (rec: RecResponse, personaName: string) => void;
  /** ai-rec-backtest-orders: "Act as sim order" (UX §2). Optional so non-order hosts/tests stay
   *  unchanged; the affordance is ABSENT (never disabled) when omitted. */
  onAct?: (rec: RecResponse, personaName: string) => void;
  onViewExport: (personaId: string | null) => void;
  readPersonaId: string;
  onChangeReadPersona: (id: string) => void;
  /** Fill the parent's height (for the side-by-side Term/AI row) instead of the default top margin. */
  fillHeight?: boolean;
}

export function AiRecPanel({
  ticker,
  bundle,
  ai,
  personas,
  activePersonaId,
  dataAge,
  onAccept,
  onAct,
  onViewExport,
  readPersonaId,
  onChangeReadPersona,
  fillHeight,
}: Props) {
  const { rec, loading, stale, inAppEnabled, cap, effectiveGateState, cooldownRemaining, gate } =
    ai;
  const navigate = useNavigate();

  // Auth gate is OUTERMOST over ai-rec's own gating (D6f, AC-E4/E5). Logged-out ⇒ the "ask AI" control
  // shows a sign-in prompt and the LLM is NOT invoked; ai-rec's cooldown/cap/no_key are NOT shown. The
  // manual export floor stays anonymous-usable (AC-E6) — that control lives in the header, ungated.
  const authGate = useGate();
  // Signed-in = auth allowed AND no server-set sign-in prompt pending (a 403 sets promptText). When
  // signed out we show ONLY the sign-in gate (no persona/snapshot) — the Figma signed-out state.
  const signedIn = authGate.allowed && !authGate.promptText;
  const { riskInputs: currentRiskInputs } = useSettings();

  // The "Add your key in Settings" CTA navigates to the Settings route + deep-links the AI-key section.
  const goToSettings = () => navigate('/settings#ai-key');

  const activeName = personas.find((p) => p.id === activePersonaId)?.name ?? 'Default (no persona)';
  const readName = personas.find((p) => p.id === readPersonaId)?.name ?? activeName;
  const readPersonaIdForRequest = readPersonaId === 'default' ? null : readPersonaId;

  // ai-rec-backtest-orders (UX §6): the operator's scenario selection. '' = real read. Rendered
  // ONLY when the wire advertises `scenarios.enabled` (AC-34) and only signed-in (AC-42 — the
  // signed-out gate replaces the whole action surface).
  const [scenarioId, setScenarioId] = useState('');
  const scenariosEnabled = ai.scenarios?.enabled === true;
  const scenarioSelected = scenariosEnabled && scenarioId !== '';

  // Guard the LLM invoke: logged-out ⇒ prompt + no invoke; a server 403 (stale cookie) ⇒ same prompt
  // and nothing produced (AC-E7). Auth FIRST, then ai-rec's existing gating runs inside `ai.request`.
  // A selected scenario rides the SAME request (auth stays outermost, AC-42).
  const doRequest = (o: RecRequestOpts = {}) =>
    void authGate.guard(AUTH_COPY.askAi.gate, () =>
      ai.request({
        ...o,
        personaId: readPersonaIdForRequest,
        personaName: readName,
        scenarioId: scenarioSelected ? scenarioId : null,
      }),
    );

  // The byo-ai-key key-resolution state (layer 3, UX_BLUEPRINT §2/§3). Read OFF the status fields,
  // never re-derived: an `unavailable` rec whose reason is one of no_key (a) / over_limit (c) /
  // shared_key_unconfigured (e) renders a distinct CTA block instead of the generic unavailable Alert.
  const byoCta = byoCtaState(rec);

  // Exactly one body state. A byo CTA (a/c/e) preempts the generic `unavailable` block.
  const phase = loading
    ? 'loading'
    : byoCta
      ? 'byo_cta'
      : rec?.status === 'unavailable'
        ? 'unavailable'
        : rec && rec.status === 'produced' && rec.strategy?.decision === 'no_trade'
          ? 'no_trade'
          : rec && rec.status === 'produced'
            ? 'produced'
            : 'idle';

  const hasRec = phase === 'produced' || phase === 'no_trade';
  const presentation = deriveAiRecPresentation({
    rec,
    loading,
    stale,
    signedIn,
    canCreateOrder: Boolean(onAct),
    inAppEnabled,
    cap,
    cooldownRemaining,
    effectiveGateState,
    scenarioSelected,
    currentRiskInputs,
  });
  const [analysisOpen, setAnalysisOpen] = useState(false);
  // A retained response is still pinned while a new request is loading, but the decision card
  // must not present that old read as the current result. Analysis is likewise pinned to this
  // produced response and never recomputed by opening/closing the surface.
  // Auth is the outer presentation boundary: a retained result is hidden immediately when the
  // session becomes signed out, including its analysis/persona/quota/simulation controls.
  const producedRec = signedIn && rec?.status === 'produced' && rec.strategy ? rec : null;

  // The always-available export link, lifted into the Widget header `actions` slot (Figma 149:621).
  // Stage-3 §4.1: link-class action text binds `info` (the token rule: links/info = signal),
  // never amber — amber on this surface belongs to the Trade verdict alone.
  const exportAction = presentation.actions.directExport ? (
    <Button
      size="small"
      onClick={() => onViewExport(readPersonaIdForRequest)}
      sx={{
        p: 0,
        minWidth: 0,
        textTransform: 'none',
        fontWeight: 500,
        color: 'info.main',
        whiteSpace: 'nowrap',
        '&:hover': { bgcolor: 'transparent' },
      }}
    >
      {COPY.action.viewExport}
      <Box component="span" aria-hidden sx={{ ml: 0.5 }}>
        →
      </Box>
    </Button>
  ) : null;

  return (
    <Box
      data-testid="ai-rec-panel"
      sx={fillHeight ? { display: 'flex', flexDirection: 'column', flex: 1 } : undefined}
    >
      <Widget
        id="ai-rec"
        title={`AI recommendation · ${ticker}`}
        actions={exportAction}
        bodySx={fillHeight ? { display: 'flex', flexDirection: 'column', flex: 1 } : undefined}
      >
        {/* The advisory intro, then the per-query persona override with a label ABOVE the (recessed)
            select. The title + export link now live in the Widget header. */}
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {COPY.intro}
        </Typography>
        {/* Persona override — signed-in only (you can't ask a read while logged out, so the Figma
            signed-out state omits it). */}
        {signedIn && (
          <Box sx={{ mb: 1.5 }}>
            <Typography
              component="label"
              htmlFor="read-persona-select"
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.disabled',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: 11,
                fontWeight: 500,
                mb: 0.5,
              }}
            >
              Next read persona
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                id="read-persona-select"
                value={readPersonaId}
                inputProps={{ 'aria-label': 'Next read persona' }}
                onChange={(e) => onChangeReadPersona(String(e.target.value))}
              >
                {personas.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip
              arrow
              describeChild
              title={`Defaults to your active persona (${activeName}). Changes apply only to the next read and never recompute the pinned result.`}
            >
              <Typography
                variant="caption"
                component="span"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
              >
                Next request only · does not change the active persona
              </Typography>
            </Tooltip>
          </Box>
        )}
        {/* Scenario picker (operator-only, flag-gated OFF — D1/AC-34). Rendered ONLY when the
            status read advertises it; ZERO scenario surface otherwise. Signed-out ⇒ the gate
            replaces this whole region (AC-42). */}
        {signedIn && scenariosEnabled && (
          <Box sx={{ mb: 1.5 }} data-testid="scenario-picker">
            <Typography
              component="label"
              htmlFor="scenario-select"
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.disabled',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: 11,
                fontWeight: 500,
                mb: 0.5,
              }}
            >
              {SCENARIO_LABEL}
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                id="scenario-select"
                value={scenarioId}
                displayEmpty
                inputProps={{ 'aria-label': SCENARIO_LABEL }}
                onChange={(e) => setScenarioId(String(e.target.value))}
              >
                <MenuItem value="">{SCENARIO_NONE}</MenuItem>
                {(ai.scenarios?.catalog ?? []).map((s: RecScenarioInfo) => (
                  // Server-provided display name rendered verbatim, registry order (AC-36).
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {SCENARIO_CAPTION}
            </Typography>
          </Box>
        )}

        {/* Body */}
        {signedIn && phase === 'loading' && <LoadingBlock ticker={ticker} readName={readName} />}

        {/* byo-ai-key CTA states (a/c/e) — distinct testids + copy; all route to Settings. The
            "View what's sent" export floor in the header stays present in every state (AC-23). */}
        {signedIn && phase === 'byo_cta' && byoCta && (
          <ByoKeyCta reason={byoCta} rec={rec as RecResponse} onAddKey={goToSettings} />
        )}

        {signedIn && phase === 'unavailable' && (
          <UnavailableBlock
            cap={cap}
            cooldownRemaining={cooldownRemaining}
            retryAllowed={presentation.actions.retry}
            onRetry={ai.retry}
            scenario={rec?.scenario ?? null}
          />
        )}

        {signedIn && producedRec && !loading && (
          <DecisionCard
            rec={producedRec}
            bundle={bundle}
            presentation={presentation}
            dataAge={dataAge}
            onReview={() =>
              authGate.guard(AUTH_COPY.positions.gateAcceptRec, () =>
                onAccept(producedRec, producedRec.persona.name),
              )
            }
            onCreateOrder={
              presentation.actions.createOrder
                ? () => onAct!(producedRec, producedRec.persona.name)
                : undefined
            }
            onAnalysis={() => setAnalysisOpen(true)}
            onRefresh={() => doRequest({ override: false })}
            onDismiss={ai.dismiss}
          />
        )}

        {/* The action region (primary action in idle; the NEXT-query control alongside a rendered
            rec). Hidden while loading, the byo CTA, and the unavailable block (each owns its action). */}
        {!signedIn ? (
          <SignedOutGate
            hasRec={false}
            promptText={authGate.promptText}
            onSignIn={() => authGate.signIn(AUTH_COPY.askAi.gate)}
          />
        ) : (
          phase !== 'loading' &&
          phase !== 'unavailable' &&
          phase !== 'byo_cta' && (
            <>
              {!hasRec && <SnapshotHint bundle={bundle} />}
              {!producedRec && (
                <ActionRegion
                  cap={cap}
                  cooldownRemaining={cooldownRemaining}
                  reasons={gate.reasons}
                  compact={hasRec}
                  ticker={ticker}
                  scenarioSelected={scenarioSelected}
                  requestState={presentation.requestState}
                  actions={presentation.actions}
                  onGet={() => doRequest({ override: false })}
                  onAskAnyway={() => doRequest({ override: true })}
                />
              )}
            </>
          )
        )}
      </Widget>
      <AnalysisSurface
        open={analysisOpen}
        ticker={ticker}
        rec={producedRec}
        bundle={bundle}
        onClose={() => setAnalysisOpen(false)}
        onViewExport={() => {
          setAnalysisOpen(false);
          onViewExport(producedRec?.persona.id ?? null);
        }}
      />
    </Box>
  );
}

// ---- Loading (AC1/AC2) -----------------------------------------------------------------------
function LoadingBlock({ ticker, readName }: { ticker: string; readName: string }) {
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CircularProgress size={18} />
        {/* component="p" (stage-3 §5.6): a transient state title must not mount/unmount an <h6>. */}
        <Typography variant="subtitle1" component="p">
          {COPY.loading.title}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Asking the AI for a risk-first read on {ticker} ({readName}). This can take a few seconds.
      </Typography>
    </Box>
  );
}

// ---- Snapshot idle hint ----------------------------------------------------------------------
function SnapshotHint({ bundle }: { bundle: TickerBundle | null }) {
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
      Reads the current snapshot
      {bundle?.meta.freshness.snapshot_iso ? `, as of ${bundle.meta.freshness.snapshot_iso}` : ''}.
    </Typography>
  );
}

// ---- Signed-out gate (AC-E4/E7) — Figma 149:598 signed-out state -----------------------------
// A centered prompt + a single enabled "Sign in to ask AI" CTA (no disabled Get button). When the
// sign-in transport itself is degraded, show that warning copy with no button.
function SignedOutGate({
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

// ---- The gated action control ----------------------------------------------------------------
function ActionRegion({
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

  // no_fresh_edge (AC8) — the guardrails' stance is no_trade; de-emphasized + explicit one-tap
  // override. The real readiness gate behaves IDENTICALLY with a scenario selected (AC-43).
  if (requestState === 'no_edge') {
    return (
      <Box sx={box}>
        <Typography sx={{ fontFamily: MONO, fontSize: 12, color: 'text.disabled', mb: 0.5 }}>
          no_trade
        </Typography>
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
function UnavailableBlock({
  cap,
  cooldownRemaining,
  retryAllowed,
  onRetry,
  scenario = null,
}: {
  cap: { over_limit: boolean; resets_at: string };
  cooldownRemaining: number;
  retryAllowed: boolean;
  onRetry: () => void;
  /** Non-null when a FAULT SCENARIO produced this degraded state — the scripted marking still
   *  shows so the operator knows it was scripted (UX §6, AC-40). The block itself is the standard
   *  unavailable handling — no special copy (AC-35). */
  scenario?: RecScenarioInfo | null;
}) {
  // Retry respects cooldown + cap (E6): if a retry would land in cooldown/over-cap, disable it.
  const blockedByCooldown = cooldownRemaining > 0;
  const blockedByCap = cap.over_limit;
  const retryDisabled = blockedByCooldown || blockedByCap;
  const sub = blockedByCooldown
    ? retryInCooldown(cooldownRemaining)
    : blockedByCap
      ? retryWhenReset(friendlyResetTime(cap.resets_at))
      : null;
  return (
    <Alert
      severity="warning"
      sx={{ mt: 1 }}
      action={
        <Stack spacing={0.25} sx={{ alignItems: 'flex-end' }}>
          {retryAllowed && (
            <Button color="inherit" size="small" disabled={retryDisabled} onClick={onRetry}>
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
        {COPY.unavailable.title}
      </Typography>
      <Typography variant="body2">{COPY.unavailable.body}</Typography>
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

// ---- byo-ai-key CTA states (a/c/e) — UX_BLUEPRINT §3 ------------------------------------------
// Three observably-distinct CTA bodies (distinct testid + title/body copy; same button label). None
// is an error red; none frames a free trial. (c) implies daily renewal. Each routes to Settings.
function ByoKeyCta({
  reason,
  rec,
  onAddKey,
}: {
  reason: 'no_key' | 'over_limit' | 'shared_key_unconfigured';
  rec: RecResponse;
  onAddKey: () => void;
}) {
  const total = rec.free_uses_total ?? FREE_USES_TOTAL_FALLBACK;
  const cfg =
    reason === 'no_key'
      ? {
          testid: 'ai-rec-state-no-key',
          title: BYO_KEY.noKey.title,
          body: BYO_KEY.noKey.body,
          cta: BYO_KEY.noKey.cta,
        }
      : reason === 'over_limit'
        ? {
            testid: 'ai-rec-state-admin-exhausted',
            title: adminExhaustedTitle(total),
            body: BYO_KEY.adminExhausted.body,
            cta: BYO_KEY.adminExhausted.cta,
          }
        : {
            testid: 'ai-rec-state-shared-unconfigured',
            title: BYO_KEY.sharedUnconfigured.title,
            body: BYO_KEY.sharedUnconfigured.body,
            cta: BYO_KEY.sharedUnconfigured.cta,
          };
  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }} data-testid={cfg.testid}>
      {/* component="p" (stage-3 §5.6): BYO-key CTA titles are transient, never headings. */}
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
        onClick={onAddKey}
      >
        {cfg.cta}
      </Button>
    </Box>
  );
}
