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
  ACT_TOOLTIP,
  RUN_SCENARIO,
  SCENARIO_CAPTION,
  SCENARIO_LABEL,
  SCENARIO_NONE,
  SCRIPTED_CHIP,
  scriptedStrip,
} from '@/features/trading/orders/copy';
import { typographyTokens } from '@/shared/theme/tokens';
import { Widget } from '@/shared/ui/Widget';
import type {
  GroundingState,
  PersonaDefinition,
  RecResponse,
  RecScenarioInfo,
  RecStrategy,
  TickerBundle,
} from '@convexa/api';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapAnnotation } from './CapAnnotation';
import { CitedContractLine } from './CitedContractLine';
import {
  adminExhaustedTitle,
  asOfChip,
  BYO_KEY,
  CAP_CAPTION,
  capTitle,
  cooldownCaption,
  cooldownLabel,
  COPY,
  dteWindowCaption,
  FREE_USES_TOTAL_FALLBACK,
  freeUsesChip,
  friendlyResetTime,
  literalCopy,
  MAX_RISK_TIP,
  notActionableLine,
  OWN_KEY_CHIP,
  personaChip,
  PLAN_FIELD_LABEL,
  retryInCooldown,
  retryWhenReset,
  RISK_FIELD_COPY,
  staleBornStrip,
  staleStrip,
  SUPERSEDED_STRIP,
} from './copy';
import { FigureClause } from './FigureClause';
import { DecisionCard } from './DecisionCard';
import { AnalysisSurface } from './AnalysisSurface';
import { deriveAiRecPresentation } from './presentationPolicy';
import { GroundingNote } from './GroundingNote';
import {
  fieldLiteral,
  planFieldLiteral,
  registerSx,
  riskInputsSuperseded,
  type FieldLiteral,
  type PlanFieldLiteral,
} from './literals';
import { NumbersSaidStrip } from './NumbersSaidStrip';
import { ProvenanceChip } from './ProvenanceChip';
import { deriveReasoning, Field, LevelsStrip, ReasoningSection } from './reasoning';
import type { AiRec, RecRequestOpts } from './useAiRecommendation';

export { deriveReasoning, leadAndRest, LevelsStrip, ReasoningSection } from './reasoning';
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

// Kept exported for legacy focused tests while the mounted result uses DecisionCard.
export { RecResult };

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
  const producedRec = rec?.status === 'produced' && rec.strategy ? rec : null;

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
      <Box component="span" aria-hidden sx={{ ml: 0.5 }}>→</Box>
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
            <Tooltip arrow describeChild title={`Defaults to your active persona (${activeName}). Changes apply only to the next read and never recompute the pinned result.`}>
              <Typography variant="caption" component="span" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
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
        {phase === 'loading' && <LoadingBlock ticker={ticker} readName={readName} />}

        {/* byo-ai-key CTA states (a/c/e) — distinct testids + copy; all route to Settings. The
            "View what's sent" export floor in the header stays present in every state (AC-23). */}
        {phase === 'byo_cta' && byoCta && (
          <ByoKeyCta reason={byoCta} rec={rec as RecResponse} onAddKey={goToSettings} />
        )}

        {phase === 'unavailable' && (
          <UnavailableBlock
            cap={cap}
            cooldownRemaining={cooldownRemaining}
            onRetry={ai.retry}
            scenario={rec?.scenario ?? null}
          />
        )}

        {producedRec && !loading && (
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
            onCreateOrder={onAct && signedIn ? () => onAct(producedRec, producedRec.persona.name) : undefined}
            onAnalysis={() => setAnalysisOpen(true)}
            onRefresh={() => doRequest({ override: false })}
            onDismiss={ai.dismiss}
          />
        )}

        {/* The action region (primary action in idle; the NEXT-query control alongside a rendered
            rec). Hidden while loading, the byo CTA, and the unavailable block (each owns its action). */}
        {phase !== 'loading' &&
          phase !== 'unavailable' &&
          phase !== 'byo_cta' &&
          // Auth OUTERMOST (AC-E4/E7): logged-out (or a server 403 on a stale cookie) ⇒ the sign-in
          // gate ONLY — no persona/snapshot/cooldown/cap/no_key. Matches the Figma signed-out state.
          (!signedIn ? (
            <SignedOutGate
              hasRec={hasRec}
              promptText={authGate.promptText}
              onSignIn={() => authGate.signIn(AUTH_COPY.askAi.gate)}
            />
          ) : (
            <>
              {!hasRec && <SnapshotHint bundle={bundle} />}
              {!producedRec && (
                <ActionRegion
                  inAppEnabled={inAppEnabled}
                  cap={cap}
                  effectiveGateState={effectiveGateState}
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
          ))}
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
  inAppEnabled,
  cap,
  effectiveGateState,
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
  inAppEnabled: boolean;
  cap: { over_limit: boolean; resets_at: string };
  effectiveGateState: string;
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
        <Button variant="contained" size="small" onClick={onGet} disabled={!actions.analyze && !actions.retry}>
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
  onRetry,
  scenario = null,
}: {
  cap: { over_limit: boolean; resets_at: string };
  cooldownRemaining: number;
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
          <Button color="inherit" size="small" disabled={retryDisabled} onClick={onRetry}>
            {COPY.action.retry}
          </Button>
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

// ---- Provenance header (AC3/AC4) + byo-ai-key key-source chips (b/d) --------------------------
function Provenance({ rec }: { rec: RecResponse }) {
  // The provenance chip reads ONLY `key_source` (never a score field — AC-14). shared_admin (b) ⇒ the
  // subordinate free-uses chip; own_key (d) ⇒ the "Using your key" chip. NO chip for none.
  const showFreeUses = rec.key_source === 'shared_admin' && rec.remaining_free_uses != null;
  const showOwnKey = rec.key_source === 'own_key';
  const freeUsesTotal = rec.free_uses_total ?? FREE_USES_TOTAL_FALLBACK;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}
    >
      {/* SCRIPTED SCENARIO marking (D8-4) — keyed OFF rec.scenario ONLY (INTERFACE §1.3). */}
      {rec.scenario && (
        <Tooltip arrow title={scriptedStrip(rec.scenario.name)}>
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={SCRIPTED_CHIP}
            data-testid="ai-rec-scripted-chip"
          />
        </Tooltip>
      )}
      <Tooltip arrow title={COPY.tooltip.persona.replace('{name}', rec.persona.name)}>
        <Chip size="small" variant="outlined" label={personaChip(rec.persona.name)} />
      </Tooltip>
      <Tooltip arrow title={COPY.tooltip.asOf}>
        <Chip size="small" variant="outlined" label={asOfChip(rec.as_of)} />
      </Tooltip>
      <Tooltip arrow title={COPY.tooltip.advisory}>
        <Chip size="small" variant="outlined" label={COPY.provenance.sim} />
      </Tooltip>
      {showFreeUses && (
        <Tooltip arrow describeChild title={BYO_KEY.freeUses.tooltip}>
          <Chip
            size="small"
            variant="outlined"
            data-testid="ai-rec-free-uses"
            label={freeUsesChip(rec.remaining_free_uses as number, freeUsesTotal)}
          />
        </Tooltip>
      )}
      {showOwnKey && (
        <Tooltip arrow describeChild title={BYO_KEY.ownKey.tooltip}>
          <Chip size="small" variant="outlined" data-testid="ai-rec-own-key" label={OWN_KEY_CHIP} />
        </Tooltip>
      )}
      {/* Provenance chip (SPEC §4) — the owner's entered values verbatim; no client arithmetic. */}
      <ProvenanceChip riskInputs={rec.sent?.risk_inputs} />
    </Stack>
  );
}

/** A `Field` driven by the closed `FieldLiteral` set (AC-69/70/71/72). `not_set` carries the
 *  `Set your risk inputs` action, which navigates to the Settings panel. */
function RiskField({
  label,
  literal,
  valueTip,
  clause,
  groundingState,
}: {
  label: string;
  literal: FieldLiteral;
  /** AC-62: a tip shown ONLY when the field carries a real value (e.g. the max-risk attribution). */
  valueTip?: string;
  /** ai-rec-grounding — a clause renders ONLY on the `value` member, never beside an absence literal
   *  (never pairing a grounding sentence with a numeric `0` treated as absent, or vice versa). */
  clause?: ReactNode;
  /** F12 (DESIGN_SYSTEM Amendment 2026-08-13, D3) — the value's TYPE REGISTER (mono = Convexa's,
   *  sans = the AI's own), a closed lookup via `registerSx`. Applied to the value itself, alongside
   *  (never instead of) the visible `clause` text — complementary signals, per D3. Undefined on
   *  fields with no grounding data at all (Max risk, Suggested size, Structure, Strike(s),
   *  Expiration, Entry trigger), which never pass this prop and stay at the shared default. */
  groundingState?: GroundingState;
}) {
  const navigate = useNavigate();
  // F12: the register lookup applies ONLY when a caller passes `groundingState` (stop/target/
  // invalidation) — every other `RiskField` call site (Max risk, Suggested size) omits the prop and
  // stays byte-identical to `main`, never explicitly forced into either register.
  const valueSx = groundingState === undefined ? undefined : registerSx(groundingState);
  if (literal.kind === 'value')
    return (
      <Box>
        <Field label={label} value={literal.text} tip={valueTip} valueSx={valueSx} />
        {clause}
      </Box>
    );
  const cfg =
    literal.kind === 'dash'
      ? RISK_FIELD_COPY.dash
      : literal.kind === 'not_set'
        ? RISK_FIELD_COPY.notSet
        : literal.kind === 'not_given'
          ? RISK_FIELD_COPY.notGiven
          : RISK_FIELD_COPY.unavailable;
  return (
    <Field
      label={label}
      tip={cfg.tip}
      value={
        <>
          {cfg.text}
          {literal.kind === 'not_set' && (
            <Button
              size="small"
              onClick={() => navigate('/settings#risk-inputs')}
              sx={{ ml: 0.5, p: 0, minWidth: 0, textTransform: 'none', fontSize: 12 }}
              data-testid="risk-field-set-risk-inputs"
            >
              {RISK_FIELD_COPY.notSet.action}
            </Button>
          )}
        </>
      }
    />
  );
}

// ---- rec-absence-literals-hole: the six plan/conviction render sites (§7 Layer 1) --------------
/** The plan-row renderer: takes a `PlanFieldLiteral`, NEVER a rendered `React.ReactNode`. That is
 *  what makes a bare `?? '—'` at one of these sites a TYPE ERROR rather than a style violation
 *  (§7 Layer 1). The `Field` primitive is unchanged — the literal→element mapping happens here. */
function PlanField({
  label,
  literal,
  caption,
}: {
  label: string;
  literal: PlanFieldLiteral;
  /** Rendered ONLY beside the `value` member (AC-26) — the caller decides, this component enforces. */
  caption?: ReactNode;
}) {
  if (literal.kind === 'value')
    return (
      <Field
        label={label}
        value={
          <>
            {literal.text}
            {caption}
          </>
        }
      />
    );
  const cfg = literalCopy(literal.kind);
  return <Field label={label} tip={cfg.tip} value={cfg.text} />;
}

/** The conviction slot. A `Chip` when a value was stated; PLAIN TEXT (chip suppressed) for every
 *  absence member — a chip whose label is an absence word reads as a stated grade. Same copy table as
 *  `PlanField` (`literalCopy`), never a second one. */
function ConvictionSlot({ literal }: { literal: PlanFieldLiteral }) {
  if (literal.kind === 'value') return <Chip size="small" label={literal.text} />;
  const cfg = literalCopy(literal.kind);
  return (
    <Tooltip arrow describeChild title={cfg.tip}>
      <Typography variant="body2">{cfg.text}</Typography>
    </Tooltip>
  );
}

// ---- The rendered rec (produced + no_trade) --------------------------------------------------
function RecResult({
  rec,
  stale,
  dataAge,
  bundle,
  onAccept,
  onAct,
  onDismiss,
  onViewExport,
  onFresh,
  freshDisabled,
}: {
  rec: RecResponse;
  stale: boolean;
  dataAge: string | null;
  bundle: TickerBundle | null;
  onAccept: () => void;
  onAct?: () => void;
  onDismiss: () => void;
  onViewExport: () => void;
  onFresh: () => void;
  freshDisabled: boolean;
}) {
  const s = rec.strategy as RecStrategy;
  const isNoTrade = s.decision === 'no_trade';
  const dteMin = bundle?.market_state.dte_min;
  const dteMax = bundle?.market_state.dte_max;
  const heroLead = deriveReasoning(s).lead;
  // AC-64 — the superseded-inputs detector: the pinned as-sent block's signature compared against
  // the CURRENTLY stored block (SPEC §2.4(a)); `useSettings().riskInputs` is `null` when unresolved
  // (anonymous / still loading), so an unknown current block never claims supersession.
  const currentRiskInputs = useSettings().riskInputs;
  const superseded = riskInputsSuperseded(rec.sent?.risk_inputs, currentRiskInputs);

  // rec-absence-literals-hole — the six plan/conviction literals, computed ONCE so the rows and the
  // standing line (below) read the same objects (§2.3).
  const structureLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.structure,
    reason: rec.field_reasons?.structure,
  });
  const strikesLiteral = planFieldLiteral({
    decision: s.decision,
    // Joining the array into a display string BEFORE the lookup is formatting, not cause selection
    // (§2.3 UX-3(a)).
    value: s.strikes.length ? s.strikes.map((x) => `$${x}`).join(' / ') : '',
    reason: rec.field_reasons?.strikes,
  });
  const expirationLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.expiration,
    reason: rec.field_reasons?.expiration,
  });
  const entryTriggerLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.entry_trigger,
    reason: rec.field_reasons?.entry_trigger,
  });
  const timeHorizonLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.time_horizon,
    reason: rec.field_reasons?.time_horizon,
  });
  const convictionLiteral = planFieldLiteral({
    decision: s.decision,
    value: s.confidence,
    reason: rec.field_reasons?.confidence,
  });

  // AC-10 — the ONE standing line. Exempt ONLY on an AFFIRMATIVE local-rules declaration; a response
  // with no grounding block at all is NOT an exemption (AC-10c) — missing information never is.
  const localRulesDeclared = rec.grounding?.card === 'local_rules';
  const unnamedPositionFields = (
    [
      [PLAN_FIELD_LABEL.structure, structureLiteral],
      [PLAN_FIELD_LABEL.strikes, strikesLiteral],
      [PLAN_FIELD_LABEL.expiration, expirationLiteral],
      [PLAN_FIELD_LABEL.entryTrigger, entryTriggerLiteral],
    ] as const
  )
    .filter(([, l]) => l.kind !== 'value')
    .map(([label]) => label);
  const standingLine =
    !localRulesDeclared && unnamedPositionFields.length > 0
      ? notActionableLine(unnamedPositionFields)
      : null;

  return (
    <Box>
      {/* Scripted-scenario strip (D8-4) — every scenario-produced rec is marked, never mistakable
          for a real AI read. Warning-tinted, never red. */}
      {rec.scenario && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }} data-testid="ai-rec-scripted-strip">
          {scriptedStrip(rec.scenario.name)}
        </Alert>
      )}

      {/* Stale-born (E5) — generated off an already-stale bundle; warned AT BIRTH. */}
      {rec.stale_born && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
          {staleBornStrip(dataAge ?? 'older data')}
        </Alert>
      )}

      {/* Stale (AC6) — a NEWER bundle arrived after generation. Rec body stays byte-stable. */}
      {stale && (
        <Box sx={{ mb: 1 }}>
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={COPY.stale.chip}
            sx={{ mb: 0.5 }}
          />
          <Alert
            severity="info"
            sx={{ py: 0 }}
            action={
              <Button color="inherit" size="small" disabled={freshDisabled} onClick={onFresh}>
                {COPY.action.freshRec}
              </Button>
            }
          >
            {staleStrip(rec.as_of)}
          </Alert>
        </Box>
      )}

      {/* Superseded-inputs (AC-64) — the shipped STALE-STRIP treatment (info, never warning.*+icon):
          the risk block changed after this rec was produced. Fires only when BOTH the as-sent block
          and the currently-stored block are known and their signatures differ. */}
      {superseded && (
        <Box sx={{ mb: 1 }}>
          <Alert
            severity="info"
            sx={{ py: 0 }}
            data-testid="ai-rec-superseded-strip"
            action={
              <Button color="inherit" size="small" disabled={freshDisabled} onClick={onFresh}>
                {COPY.action.freshRec}
              </Button>
            }
          >
            {SUPERSEDED_STRIP}
          </Alert>
        </Box>
      )}

      <Provenance rec={rec} />

      <LevelsStrip bundle={bundle} />

      {/* `What the numbers said` — on EVERY verdict including no_trade (AC-66, ship-blocking). */}
      <NumbersSaidStrip
        candidates={rec.sent?.candidates}
        move={bundle?.market_state.straddle_move}
        citedExpiration={s.expiration}
      />

      {isNoTrade ? (
        <Box>
          {/* Verdict hero — the answer at a glance (calm/info, never red), with the one-line lead. */}
          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover', mb: 1.5 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              <InfoOutlinedIcon color="info" sx={{ fontSize: 18 }} />
              {/* component="p" (stage-3 §5.6): a verdict is data/copy, not document structure. */}
              <Typography variant="subtitle1" component="p">
                {COPY.noTrade.title}
              </Typography>
              {/* AC-3d — the ONE carve-out from the no-plan-rows rule: an absent conviction renders
                  `not given` as TEXT, never the reserved mark, never nothing. This line sits OUTSIDE
                  the four-field risk row below (`:` unchanged), which keeps its zero-line diff. */}
              <Box data-testid="no-trade-conviction">
                {s.confidence ? (
                  <Chip size="small" variant="outlined" label={`conviction · ${s.confidence}`} />
                ) : (
                  <Typography variant="body2">{literalCopy('not_given').text}</Typography>
                )}
              </Box>
            </Stack>
            {heroLead && (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.6 }}
              >
                {heroLead}
              </Typography>
            )}
          </Box>
          {/* AC-69/70 — `no_trade` is a RESULT, not an empty card: the four fields still render, each
              through the SAME `fieldLiteral` closed lookup the trade branch uses. `decision ===
              'no_trade'` short-circuits every one of them to the `dash` member (`—` + `No entry, so
              there is nothing to size.`) — this is the card's only not-applicable statement, and the
              cap surface still renders NOTHING here (AC-58a; no `CapAnnotation` is mounted). */}
          <Stack
            direction="row"
            spacing={4}
            sx={{ flexWrap: 'wrap', rowGap: 1, mb: 1.5 }}
            data-testid="no-trade-four-field-row"
          >
            <RiskField
              label={COPY.risk.maxRisk}
              literal={fieldLiteral({ decision: s.decision, value: s.max_risk, reason: null })}
            />
            <RiskField
              label="Suggested size"
              literal={fieldLiteral({ decision: s.decision, value: s.position_size, reason: null })}
            />
            <RiskField
              label="Target"
              literal={fieldLiteral({
                decision: s.decision,
                value: s.exit_plan?.target,
                reason: null,
              })}
            />
            <RiskField
              label="Stop"
              literal={fieldLiteral({
                decision: s.decision,
                value: s.exit_plan?.stop,
                reason: null,
              })}
            />
          </Stack>
          <ReasoningSection strategy={s} suppressLead />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
            {COPY.noTrade.caption}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {/* Verdict header — decision + direction at a glance + the one-line lead (structure and the
              rest sit in the plan below; risk stays first among the detail tiles). */}
          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {/* The verdict hero icon KEEPS `primary` (§4.1) — the Trade verdict IS this
                  surface's one line that matters (its no-trade sibling stays `info`: the
                  asymmetry is the meaning). */}
              <InfoOutlinedIcon color="primary" sx={{ fontSize: 18 }} />
              {/* component="p" (stage-3 §5.6): a verdict is data/copy, not document structure. */}
              <Typography variant="subtitle1" component="p">{`Trade · ${s.bias}`}</Typography>
            </Stack>
            {heroLead && (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.6 }}
              >
                {heroLead}
              </Typography>
            )}
          </Box>
          {/* The ONE card-level grounding line (SPEC §4) — a qualifier on everything below it, so it
              sits directly above the risk tile and nowhere else. It is one line; it is never a
              section. */}
          <GroundingNote grounding={rec.grounding} />
          {/* rec-absence-literals-hole (AC-10a/b/c, AC-11, AC-15) — the ONE standing not-actionable
              line. Exempt only on a DECLARED local-rules card; plain body text, no icon, no tint, no
              `warning.*` — the card-level amber is already spent by the grounding line above. */}
          {standingLine && (
            <Typography
              variant="body2"
              data-testid="rec-not-actionable"
              sx={{ color: 'text.secondary' }}
            >
              {standingLine}
            </Typography>
          )}
          {/* 2. RISK FIRST (foremost). Upgraded-tile chrome: rounded surface + error-tinted LEFT
              accent bar (risk = the most-important field), clipped to the radius. All four risk-input
              fields render through `fieldLiteral` — a closed lookup on the wire token, never a null
              test (AC-69/70/71/72). */}
          <Box
            sx={{
              position: 'relative',
              p: 1.25,
              pl: 2.25,
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: 'action.hover',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                bgcolor: 'error.main',
              },
            }}
          >
            <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <RiskField
                label={COPY.risk.maxRisk}
                literal={fieldLiteral({
                  decision: s.decision,
                  value: s.max_risk,
                  reason: rec.field_reasons?.max_risk,
                })}
                valueTip={MAX_RISK_TIP}
              />
              <RiskField
                label={COPY.risk.invalidation}
                literal={fieldLiteral({
                  decision: s.decision,
                  value: s.invalidation_level,
                  reason: rec.field_reasons?.invalidation_level,
                })}
                valueTip="The level that says the idea is wrong. If price reaches it, the thesis is invalidated."
                clause={
                  <FigureClause
                    field={rec.grounding?.fields.invalidation_level}
                    testId="clause-invalidation"
                  />
                }
                groundingState={rec.grounding?.fields.invalidation_level.state}
              />
            </Stack>
            {/* The cap surface — an entry-stating verdict ONLY. `not_applicable` (no_trade) never
                reaches this branch at all (AC-58a). */}
            <Box sx={{ mt: 1 }}>
              <CapAnnotation capCheck={rec.cap_check} />
            </Box>
          </Box>
          {/* 3. Plan. Every row goes through `planFieldLiteral` — a closed lookup on the wire token,
              never a null test, never a bare fallback (rec-absence-literals-hole §2.3). */}
          <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <PlanField label={PLAN_FIELD_LABEL.structure} literal={structureLiteral} />
            <PlanField label={PLAN_FIELD_LABEL.strikes} literal={strikesLiteral} />
            <PlanField
              label={PLAN_FIELD_LABEL.expiration}
              literal={expirationLiteral}
              caption={
                dteMin != null && dteMax != null ? (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    {dteWindowCaption(dteMin, dteMax)}
                  </Typography>
                ) : undefined
              }
            />
            <PlanField label={PLAN_FIELD_LABEL.entryTrigger} literal={entryTriggerLiteral} />
          </Stack>
          {/* The cited-contract fact line — a real quote for the named contract, or an honest literal
              saying why it's absent (AC-73–77). */}
          <CitedContractLine
            cited={rec.cited_contract}
            asOf={rec.sent?.candidates?.as_of ?? null}
          />
          {/* 4. Exit. */}
          <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <RiskField
              label="Target"
              literal={fieldLiteral({
                decision: s.decision,
                value: s.exit_plan?.target,
                reason: rec.field_reasons?.exit_target,
              })}
              clause={
                <FigureClause field={rec.grounding?.fields.exit_target} testId="clause-target" />
              }
              groundingState={rec.grounding?.fields.exit_target.state}
            />
            <RiskField
              label="Stop"
              literal={fieldLiteral({
                decision: s.decision,
                value: s.exit_plan?.stop,
                reason: rec.field_reasons?.exit_stop,
              })}
              clause={<FigureClause field={rec.grounding?.fields.exit_stop} testId="clause-stop" />}
              groundingState={rec.grounding?.fields.exit_stop.state}
            />
          </Stack>
          {/* 5. Sizing. */}
          <Box>
            <RiskField
              label="Suggested size"
              literal={fieldLiteral({
                decision: s.decision,
                value: s.position_size,
                reason: rec.field_reasons?.position_size,
              })}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              A suggestion. Your size is your risk decision — you'll be able to change it during review.
            </Typography>
          </Box>
          {/* 6. Read context. */}
          <Stack
            direction="row"
            spacing={4}
            sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}
          >
            <PlanField label={PLAN_FIELD_LABEL.timeHorizon} literal={timeHorizonLiteral} />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {PLAN_FIELD_LABEL.confidence}
              </Typography>
              <ConvictionSlot literal={convictionLiteral} />
            </Box>
          </Stack>
          {/* 7. Reasoning — Why bullets + Manage list + collapsible full read (the lead is shown in
              the verdict header above). Degrades gracefully when the model omits structure. */}
          <ReasoningSection strategy={s} suppressLead reengageLabel={COPY.reasoning.manage} />
        </Stack>
      )}

      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        {/* Accept is ABSENT on a no_trade rec (AC5) — never just disabled. Accept stays FIRST and
            byte-identical with Act beside it (orders AC-1/47). */}
        {!isNoTrade && (
          <Tooltip arrow describeChild title={COPY.tooltip.advisory}>
            <Button variant="contained" size="small" onClick={onAccept}>
              {COPY.action.accept}
            </Button>
          </Tooltip>
        )}
        {/* Act as sim order (UX §2.1): produced TRADE rec ONLY (real or scenario); ABSENT on
            no_trade and every degraded/gated state — the host omits the handler there. */}
        {!isNoTrade && onAct && (
          <Tooltip arrow describeChild title={ACT_TOOLTIP}>
            <Button variant="outlined" size="small" onClick={onAct} data-testid="ai-rec-act">
              {COPY.action.createOrder}
            </Button>
          </Tooltip>
        )}
        <Button size="small" onClick={onViewExport}>
          {COPY.action.viewExport}
        </Button>
        <Button size="small" color="inherit" onClick={onDismiss}>
          {COPY.action.dismiss}
        </Button>
      </Stack>
    </Box>
  );
}
