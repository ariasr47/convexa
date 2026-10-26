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
import { ownKeyChip, pathLabel } from '@/features/auth/aiProviderLabels';
import { useAuth } from '@/features/auth/AuthContext';
import { AUTH_COPY } from '@/features/auth/copy';
import { useGate } from '@/features/auth/useGate';
import { useSettings } from '@/features/auth/useSettings';
import { SCENARIO_CAPTION, SCENARIO_LABEL, SCENARIO_NONE } from '@/features/trading/orders/copy';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { Widget } from '@/shared/ui/Widget';
import {
  dataMode,
  getAiKeyStatus,
  type AiProvidersBootstrap,
  type PersonaDefinition,
  type RecResponse,
  type RecScenarioInfo,
  type TickerBundle,
} from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionRegion,
  AskModelSelect,
  LoadingBlock,
  PoweringCta,
  QuietGateNote,
  SignedOutGate,
  SnapshotHint,
  UnavailableBlock,
} from './AiRecPanelBlocks';
import { AnalysisSurface } from './AnalysisSurface';
import { COPY } from './copy';
import { DecisionCard } from './DecisionCard';
import { deriveAiRecPresentation } from './presentationPolicy';
import { readLayoutFor } from './readLayout';
import { ReadSheet } from './ReadSheet';
import type { AiRec, RecRequestOpts } from './useAiRecommendation';

export { useReadPersonas } from './useReadPersonas';

const POWERING_STATES = new Set([
  'missing_key',
  'key_unusable',
  'key_rejected',
  'model_not_in_catalog',
  'model_unset',
  'oauth_expired',
  'oauth_unlinked',
  'subscription_unavailable',
]);

interface Props {
  ticker: string;
  bundle: TickerBundle | null;
  ai: AiRec;
  personas: PersonaDefinition[]; // canonical (or embedded fallback) read-persona options
  activePersonaId: string; // 'default' | preset/custom id
  dataAge: string | null; // humanized bundle age, for the stale-born strip
  onAccept: (rec: RecResponse, personaName: string) => void;
  /** Optional simulated-order callback for hosts that expose that affordance. Non-order hosts/tests stay
   *  unchanged; the affordance is ABSENT (never disabled) when omitted. */
  onAct?: (rec: RecResponse, personaName: string) => void;
  onViewExport: (personaId: string | null, sampleFingerprint?: string | null) => void;
  readPersonaId: string;
  onChangeReadPersona: (id: string) => void;
  /** Fill the parent's height (for the side-by-side Term/AI row) instead of the default top margin. */
  fillHeight?: boolean;
}

/**
 * `fillHeight`: the panel fills its grid row, and so does the read's Widget inside it. On a wide
 * screen `ReadSheet` renders its children as a fragment, so the Widget root is this box's direct
 * child; without `flex: 1` it stopped 135px short of the row the side column sets, where the Final
 * board's `.tk-work` stretches the read to the row (fidelity DESK-03).
 */
const FILL_HEIGHT_SX = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  '& > [data-widget-id="ai-rec"]': { flex: 1 },
} as const;

export const AiRecPanel = memo(function AiRecPanel({
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
  const {
    rec,
    loading,
    stale,
    inAppEnabled,
    powering,
    cap,
    readinessGateState,
    cooldownRemaining,
    gate,
  } = ai;
  const navigate = useNavigate();
  const auth = useAuth();
  const demo = dataMode === 'demo';

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

  const [bootstrap, setBootstrap] = useState<AiProvidersBootstrap | null>(null);
  useEffect(() => {
    if (!signedIn) {
      setBootstrap(null);
      return;
    }
    let cancelled = false;
    getAiKeyStatus()
      .then((s) => {
        if (!cancelled) setBootstrap(s);
      })
      .catch(() => {
        if (!cancelled) setBootstrap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

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

  const presentation = deriveAiRecPresentation({
    rec,
    loading,
    stale,
    signedIn,
    canCreateOrder: Boolean(onAct),
    inAppEnabled,
    cap,
    cooldownRemaining,
    readinessGateState,
    scenarioSelected,
    currentRiskInputs,
    poweringReason:
      rec?.status === 'produced'
        ? null
        : rec?.status === 'unavailable'
          ? rec.unavailable_reason
          : (powering?.unavailable_reason ?? null),
  });
  const poweringCta = POWERING_STATES.has(presentation.requestState);
  // The ONE total mapping (SPEC §2.6, readLayout.ts) is what actually GATES the A1c annex below —
  // not a parallel `requestState === 'no_edge'` re-check. A regression in the mapping (e.g. the
  // corrected earlier draft's error, collapsing no_edge back to an idle-only body) therefore shows
  // up here, in the real render, not only in the mapping's own isolated tests.
  const readLayout = readLayoutFor(presentation.requestState, presentation.resultState);
  const showQuietGateAnnex = readLayout.annexes.includes('A1c');

  // Exactly one body state. A powering CTA preempts the generic `unavailable` block.
  const phase = loading
    ? 'loading'
    : poweringCta
      ? 'powering_cta'
      : rec?.status === 'unavailable'
        ? 'unavailable'
        : rec && rec.status === 'produced' && rec.strategy?.decision === 'no_trade'
          ? 'no_trade'
          : rec && rec.status === 'produced'
            ? 'produced'
            : 'idle';

  const hasRec = phase === 'produced' || phase === 'no_trade';
  const [analysisOpen, setAnalysisOpen] = useState(false);

  // Site check D-07: the demo's read is authored, not a model call, so it shows on arrival — the
  // board draws the verdict without a click. One automatic read per ticker and snapshot (the expiry
  // set picks the snapshot); a failure or a dismissal is never re-asked automatically.
  const sampleFingerprint = demo ? (bundle?.ai_eval.state_fingerprint ?? null) : null;
  const autoAsked = useRef<string | null>(null);
  useEffect(() => {
    if (!demo || !sampleFingerprint) return;
    const key = `${ticker}|${sampleFingerprint}`;
    if (autoAsked.current === key) return;
    autoAsked.current = key;
    void ai.request({ personaId: null, personaName: 'Authored sample' });
    // `ai.request` changes identity with its own loading state; the key alone decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, ticker, sampleFingerprint]);
  // A retained response is still pinned while a new request is loading, but the decision card
  // must not present that old read as the current result. Analysis is likewise pinned to this
  // produced response and never recomputed by opening/closing the surface.
  // Auth is the outer presentation boundary: a retained result is hidden immediately when the
  // session becomes signed out, including its analysis/persona/quota/simulation controls.
  const producedRec = signedIn && rec?.status === 'produced' && rec.strategy ? rec : null;

  // The bottom sheet's peek row (SPEC §2.5/§4.1, criterion 45): the SAME value from the SAME model
  // field `DecisionCard`'s own `decision-verdict-word` renders (`producedRec.strategy.decision`/
  // `.bias`), computed once here rather than re-derived inside `ReadSheet` from a wire scalar. `null`
  // whenever no verdict is mounted in the wide anatomy either (row 42 — idle's verdict slot is empty).
  const verdictStrategy = producedRec?.strategy;
  const isTradeVerdict = verdictStrategy?.decision === 'trade';
  const verdictText = verdictStrategy
    ? isTradeVerdict
      ? `Trade · ${verdictStrategy.bias}`
      : COPY.noTrade.title
    : null;

  // The always-available export link, lifted into the Widget header `actions` slot (Figma 149:621).
  // Stage-3 §4.1: link-class action text binds `info` (the token rule: links/info = signal),
  // never amber — amber on this surface belongs to the Trade verdict alone.
  const exportAction =
    demo || presentation.actions.directExport ? (
      <Button
        size="small"
        onClick={() =>
          onViewExport(
            readPersonaIdForRequest,
            demo ? (bundle?.ai_eval.state_fingerprint ?? null) : undefined,
          )
        }
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
        {demo ? COPY.demo.viewExport : COPY.action.viewExport}
        <Box component="span" aria-hidden sx={{ ml: 0.5 }}>
          →
        </Box>
      </Button>
    ) : null;

  if (demo) {
    // The demo's authored sample read takes the live read's anatomy (owner, 2026-10-14: staging shows
    // the whole product): the read sheet and its peek row, the decision card with Why and Re-engage,
    // and the full-analysis drawer. The provenance lines above it say no model was called.
    const sampleRec = rec?.status === 'produced' && rec.strategy ? rec : null;
    const sampleStrategy = sampleRec?.strategy;
    const sampleIsTrade = sampleStrategy?.decision === 'trade';
    const sampleVerdict = sampleStrategy
      ? sampleIsTrade
        ? `Trade · ${sampleStrategy.bias}`
        : COPY.noTrade.title
      : null;
    return (
      <Box data-testid="ai-rec-panel" sx={fillHeight ? FILL_HEIGHT_SX : undefined}>
        <ReadSheet verdict={sampleVerdict} isTrade={Boolean(sampleIsTrade)} defaultExpanded={false}>
          <Widget
            id="ai-rec"
            title={`Sample analysis · ${ticker}`}
            // The board names this card's sample state "Sample read" (ticker-desk.mjs aiBrief).
            sampleTag={false}
            titleBadge={
              <Box component="span" sx={{ flex: 'none', display: 'inline-flex' }}>
                <DataStateTag state="sample" word="Sample read" />
              </Box>
            }
            actions={exportAction}
            bodySx={fillHeight ? { display: 'flex', flexDirection: 'column', flex: 1 } : undefined}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {/* The time is on the card's own "As of … ET" chip; no raw timestamp here. */}
              {COPY.demo.provenance}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}
            >
              {COPY.demo.noModel}
            </Typography>
            {ai.requestFailed && sampleRec && (
              <Alert
                severity="info"
                sx={{ mb: 1.5 }}
                data-testid="sample-analysis-retained"
                action={
                  <Button color="inherit" size="small" onClick={ai.retry}>
                    {COPY.demo.retry}
                  </Button>
                }
              >
                {COPY.demo.retainedError}
              </Alert>
            )}
            {ai.requestFailed && !sampleRec && (
              <Alert
                severity="warning"
                sx={{ mb: 1.5 }}
                data-testid="sample-analysis-error"
                action={
                  <Button color="inherit" size="small" onClick={ai.retry}>
                    {COPY.demo.retry}
                  </Button>
                }
              >
                {COPY.demo.coldError}
              </Alert>
            )}
            {!ai.requestFailed && rec?.status === 'unavailable' && (
              <Alert
                severity="info"
                sx={{ mb: 1.5 }}
                data-testid="sample-analysis-unavailable"
                action={
                  <Button color="inherit" size="small" onClick={ai.retry}>
                    {COPY.demo.retry}
                  </Button>
                }
              >
                Sample analysis is unavailable for this scenario.
              </Alert>
            )}
            {sampleRec && !ai.loading && (
              <Box data-testid="sample-analysis-result" sx={{ mb: 1.5 }}>
                <DecisionCard
                  rec={sampleRec}
                  bundle={bundle}
                  presentation={presentation}
                  dataAge={dataAge}
                  onReview={() => onAccept(sampleRec, sampleRec.persona.name)}
                  onCreateOrder={
                    presentation.actions.createOrder && onAct
                      ? () => onAct(sampleRec, sampleRec.persona.name)
                      : undefined
                  }
                  onAnalysis={() => setAnalysisOpen(true)}
                  onRefresh={() =>
                    void ai.request({ personaId: null, personaName: 'Authored sample' })
                  }
                  onDismiss={ai.dismiss}
                />
              </Box>
            )}
            {ai.loading && (
              <Typography role="status" variant="caption" sx={{ display: 'block', mb: 1 }}>
                Loading sample analysis…
              </Typography>
            )}
            {/* Reads the sample for the expiry set now selected (each set has its own authored read). */}
            {/* A quiet text button in every state (the Final desk board's `btn ghost`): the
                desk's one amber fill is "+ Open simulated trade" (owner ruling A, 2026-10-15). */}
            <Button
              variant="text"
              size="small"
              disabled={!bundle || ai.loading}
              onClick={() => void ai.request({ personaId: null, personaName: 'Authored sample' })}
              sx={{ alignSelf: 'flex-start' }}
            >
              {COPY.demo.action}
            </Button>
          </Widget>
        </ReadSheet>
        <AnalysisSurface
          open={analysisOpen}
          ticker={ticker}
          rec={sampleRec}
          bundle={bundle}
          onClose={() => setAnalysisOpen(false)}
          onViewExport={() => {
            setAnalysisOpen(false);
            onViewExport(null, bundle?.ai_eval.state_fingerprint ?? null);
          }}
        />
      </Box>
    );
  }

  return (
    <Box data-testid="ai-rec-panel" sx={fillHeight ? FILL_HEIGHT_SX : undefined}>
      <ReadSheet verdict={verdictText} isTrade={Boolean(isTradeVerdict)}>
        <Widget
          id="ai-rec"
          title={`AI read · ${ticker}`}
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
                  color: 'text.secondary',
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
                  color: 'text.secondary',
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
          {signedIn && phase === 'loading' && (
            <LoadingBlock
              ticker={ticker}
              readName={readName}
              path={
                pathLabel(powering?.key_source, powering?.provider) ??
                (powering?.key_source === 'own_key' ? ownKeyChip(powering.provider) : null)
              }
              model={powering?.model ?? bootstrap?.preference.model ?? null}
            />
          )}

          {signedIn && (
            <AskModelSelect
              bootstrap={bootstrap}
              disabled={loading}
              onChange={async (id) => {
                try {
                  await auth.updateSettings({ ai_model: id });
                  const next = await getAiKeyStatus();
                  setBootstrap(next);
                } catch {
                  /* save-error is surfaced by settings; keep last known catalog */
                }
              }}
            />
          )}

          {/* Distinct powering CTAs — never collapse reasons; never free-uses. Export stays in header. */}
          {signedIn && phase === 'powering_cta' && (
            <PoweringCta reason={presentation.requestState} onSettings={goToSettings} />
          )}

          {signedIn && phase === 'unavailable' && (
            <UnavailableBlock
              cap={cap}
              cooldownRemaining={cooldownRemaining}
              retryAllowed={presentation.actions.retry}
              onRetry={ai.retry}
              scenario={rec?.scenario ?? null}
              reason={rec?.unavailable_reason ?? null}
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
                presentation.actions.createOrder && onAct
                  ? () => onAct(producedRec, producedRec.persona.name)
                  : undefined
              }
              onAnalysis={() => setAnalysisOpen(true)}
              onRefresh={() => doRequest({ override: false })}
              onDismiss={ai.dismiss}
            />
          )}

          {/* A1c — the quiet-gate annex (SPEC §4.5, §2.6): a request-scope condition, not a peer body
            state. `no_edge` composes over a produced read rather than replacing it — the same note,
            caption and `Ask anyway` control as A1b (idle · quiet gate), rendered IN BODY beneath the
            read, and WITHOUT A1b's Mono `no_trade` stance line (a real verdict is mounted here; the
            machine stance would collide with it, canon rule 23 / row 42). `refresh`/`retry` both
            resolve false under `no_edge` by construction (presentationPolicy.ts:169,177), so this is
            the ONLY recovery control the panel would otherwise leave the user without (row 59). */}
          {signedIn && producedRec && !loading && showQuietGateAnnex && (
            <QuietGateNote
              reasons={gate.reasons}
              onAskAnyway={() => doRequest({ override: true })}
              includeStanceLine={false}
              sx={{ mt: 1.5 }}
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
            phase !== 'powering_cta' && (
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
      </ReadSheet>
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
});
