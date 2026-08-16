import type { RecResponse, TickerBundle } from '@convexa/api';
import { Alert, Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { AccessibleHelp } from './AccessibleHelp';
import { FigureClause } from './FigureClause';
import { GroundingNote } from './GroundingNote';
import { fieldLiteral, planFieldLiteral, registerSx, type FieldLiteral, type PlanFieldLiteral } from './literals';
import { BYO_KEY, COPY, dteWindowCaption, incompleteAction, literalCopy, PLAN_FIELD_LABEL, MAX_RISK_TIP, FREE_USES_TOTAL_FALLBACK, freeUsesChip, OWN_KEY_CHIP, staleBornStrip, staleStrip, SUPERSEDED_STRIP } from './copy';
import { deriveReasoning } from './reasoning';
import type { AiRecPresentation } from './presentationPolicy';
import { CapAnnotation } from './CapAnnotation';
import { ProvenanceChip } from './ProvenanceChip';

export interface DecisionCardProps {
  rec: RecResponse;
  bundle: TickerBundle | null;
  presentation: AiRecPresentation;
  dataAge: string | null;
  onReview: () => void;
  onCreateOrder?: () => void;
  onAnalysis: () => void;
  onRefresh: () => void;
  onDismiss: () => void;
}

function RiskField({ label, literal, tip, clause, groundingState, caption }: { label: string; literal: FieldLiteral | PlanFieldLiteral; tip?: string; clause?: React.ReactNode; groundingState?: Parameters<typeof registerSx>[0]; caption?: React.ReactNode }) {
  const value = literal.kind === 'value' ? literal.text : literalCopy(literal.kind).text;
  const help = literal.kind === 'value' ? tip : literalCopy(literal.kind).tip;
  return (
    <Box>
      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        {help && <AccessibleHelp label={`${label} help`} text={help} />}
      </Stack>
      <Typography variant="body2" sx={groundingState ? registerSx(groundingState) : undefined}>{literal.kind === 'not_set' ? <>{value} <Button component="a" href="/settings#risk-inputs" size="small" sx={{ p: 0, minWidth: 0, textTransform: 'none' }}>Set your risk inputs</Button></> : <>{value}{literal.kind === 'value' && caption}</>}</Typography>
      {literal.kind === 'value' && clause}
    </Box>
  );
}

export function Provenance({ rec }: { rec: RecResponse }) {
  const free = rec.key_source === 'shared_admin' && rec.remaining_free_uses != null;
  const own = rec.key_source === 'own_key';
  return <Stack direction="row" spacing={0.75} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }} data-testid="decision-provenance">
    {rec.scenario && <><Chip size="small" color="warning" variant="outlined" label="SCRIPTED" /><AccessibleHelp label="Scripted scenario help" text={`Scripted scenario — ${rec.scenario.name}`} /></>}
    <Chip size="small" variant="outlined" label={`Persona · ${rec.persona.name}`} /><AccessibleHelp label="Persona provenance help" text={COPY.tooltip.persona.replace('{name}', rec.persona.name)} />
    <Chip size="small" variant="outlined" label={`As of ${rec.as_of ?? 'unknown snapshot'}`} /><AccessibleHelp label="Snapshot provenance help" text={COPY.tooltip.asOf} />
    <Chip size="small" variant="outlined" label={COPY.provenance.sim} /><AccessibleHelp label="Simulated advisory help" text={COPY.tooltip.advisory} />
    {free && <><Chip size="small" variant="outlined" label={freeUsesChip(rec.remaining_free_uses as number, rec.free_uses_total ?? FREE_USES_TOTAL_FALLBACK)} /><AccessibleHelp label="Shared key allowance help" text={BYO_KEY.freeUses.tooltip} /></>}
    {own && <><Chip size="small" variant="outlined" label={OWN_KEY_CHIP} /><AccessibleHelp label="Own key help" text={BYO_KEY.ownKey.tooltip} /></>}
    <ProvenanceChip riskInputs={rec.sent?.risk_inputs} />
  </Stack>;
}

function DecisionContext({ rec, dataAge }: { rec: RecResponse; dataAge: string | null }) {
  return (
    <Box data-testid="decision-context">
      {rec.scenario && <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1 }}>Scripted scenario — {rec.scenario.name}. <strong>SIMULATED / advisory</strong></Alert>}
    </Box>
  );
}

function DecisionMetadata({ rec, bundle }: { rec: RecResponse; bundle: TickerBundle | null }) {
  const s = rec.strategy!;
  const strikeText = s.strikes?.filter(Number.isFinite).map((x) => `$${x}`).join(' / ') ?? '';
  const dteMin = Number.isFinite(bundle?.market_state?.dte_min) ? bundle?.market_state?.dte_min : null;
  const dteMax = Number.isFinite(bundle?.market_state?.dte_max) ? bundle?.market_state?.dte_max : null;
  const confidence = planFieldLiteral({ decision: s.decision, value: s.confidence, reason: rec.field_reasons?.confidence });
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} data-testid="decision-metadata">
      <RiskField label={PLAN_FIELD_LABEL.structure} literal={planFieldLiteral({ decision: s.decision, value: s.structure, reason: rec.field_reasons?.structure })} />
      <RiskField label={PLAN_FIELD_LABEL.strikes} literal={planFieldLiteral({ decision: s.decision, value: strikeText, reason: rec.field_reasons?.strikes })} />
      <RiskField label={PLAN_FIELD_LABEL.expiration} literal={planFieldLiteral({ decision: s.decision, value: s.expiration, reason: rec.field_reasons?.expiration })} caption={dteMin != null && dteMax != null ? <Typography component="span" variant="caption" color="text.secondary">{dteWindowCaption(dteMin, dteMax)}</Typography> : undefined} />
      <RiskField label={PLAN_FIELD_LABEL.entryTrigger} literal={planFieldLiteral({ decision: s.decision, value: s.entry_trigger, reason: rec.field_reasons?.entry_trigger })} />
      <RiskField label={PLAN_FIELD_LABEL.timeHorizon} literal={planFieldLiteral({ decision: s.decision, value: s.time_horizon, reason: rec.field_reasons?.time_horizon })} />
      <Box><Stack direction="row" sx={{ alignItems: 'center' }}><Typography variant="caption" color="text.secondary">{PLAN_FIELD_LABEL.confidence}</Typography><AccessibleHelp label="Confidence help" text={confidence.kind === 'value' ? 'Confidence supplied by the read.' : literalCopy(confidence.kind).tip} /></Stack>{confidence.kind === 'value' ? <Chip size="small" label={s.confidence} /> : <Typography variant="body2">{literalCopy(confidence.kind).text}</Typography>}</Box>
    </Stack>
  );
}

export function DecisionCard({ rec, bundle, presentation, dataAge, onReview, onCreateOrder, onAnalysis, onRefresh, onDismiss }: DecisionCardProps) {
  const strategy = rec.strategy!;
  const isTrade = strategy.decision === 'trade';
  const reasoning = deriveReasoning(strategy);
  const missing = presentation.missingPositionFields;
  const maxRiskLiteral = fieldLiteral({ decision: strategy.decision, value: strategy.max_risk, reason: rec.field_reasons?.max_risk });
  const invalidationLiteral = fieldLiteral({ decision: strategy.decision, value: strategy.invalidation_level, reason: rec.field_reasons?.invalidation_level });
  const entryTriggerLiteral = planFieldLiteral({ decision: strategy.decision, value: strategy.entry_trigger, reason: rec.field_reasons?.entry_trigger });
  const targetLiteral = fieldLiteral({ decision: strategy.decision, value: strategy.exit_plan?.target, reason: rec.field_reasons?.exit_target });
  const localRulesDeclared = rec.grounding?.card === 'local_rules';

  return (
    <Box
      data-testid="ai-rec-decision-card"
      sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'visible' }}
      data-rec-pinned-fingerprint={rec.pinned_fingerprint ?? ''}
      data-rec-as-of={rec.as_of ?? ''}
      data-rec-persona-id={rec.persona.id}
      data-rec-persona-name={rec.persona.name}
    >
      <DecisionContext rec={rec} dataAge={dataAge} />
      <Provenance rec={rec} />
      {(presentation.resultState === 'stale_newer_snapshot' || presentation.resultState === 'stale_at_generation' || presentation.resultState === 'superseded_inputs') && (
        <Alert severity={presentation.resultState === 'stale_at_generation' ? 'warning' : 'info'} icon={presentation.resultState === 'stale_at_generation' ? <WarningAmberIcon /> : undefined} sx={{ mt: 1 }} data-testid="decision-degraded">
          {presentation.resultState === 'stale_newer_snapshot' ? staleStrip(rec.as_of) : presentation.resultState === 'stale_at_generation' ? staleBornStrip(dataAge ?? 'older data') : SUPERSEDED_STRIP}
        </Alert>
      )}
      <Box data-testid="decision-verdict" sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Typography variant="subtitle1">{isTrade ? `Trade · ${strategy.bias}` : COPY.noTrade.title}</Typography>
      </Box>
      {isTrade && <DecisionMetadata rec={rec} bundle={bundle} />}
      {reasoning.lead && <Typography data-testid="decision-thesis" variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>{reasoning.lead}</Typography>}
      {!isTrade && strategy.reengage_when?.length ? <Typography variant="body2" sx={{ mt: 1 }}>{strategy.reengage_when.join(' · ')}</Typography> : null}
      {isTrade && <>
        {missing.length > 0 && !localRulesDeclared && !(presentation.resultState === 'stale_newer_snapshot' || presentation.resultState === 'stale_at_generation' || presentation.resultState === 'superseded_inputs') && <Alert severity="info" sx={{ mt: 1 }} data-testid="rec-not-actionable">{incompleteAction(missing)}</Alert>}
        <Box data-testid="decision-grid" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 1 }}>
          <RiskField label="Max risk" literal={maxRiskLiteral} tip={MAX_RISK_TIP} />
          <RiskField label="Invalidation" literal={invalidationLiteral} tip="The level that says the idea is wrong." groundingState={rec.grounding?.fields.invalidation_level?.state} clause={<FigureClause field={rec.grounding?.fields.invalidation_level} testId="clause-invalidation" />} />
          <RiskField label="Entry" literal={entryTriggerLiteral} />
          <RiskField label="Target" literal={targetLiteral} groundingState={rec.grounding?.fields.exit_target?.state} clause={<FigureClause field={rec.grounding?.fields.exit_target} testId="clause-target" />} />
        </Box>
      </>}
      <Box data-testid="decision-evidence" sx={{ mt: 1 }}><GroundingNote grounding={rec.grounding} /><CapAnnotation capCheck={rec.cap_check} /></Box>
      <Divider sx={{ my: 1.5 }} />
      <Stack data-testid="decision-actions" direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: { xs: 'nowrap', sm: 'wrap' }, '& .MuiButton-root': { '@media (pointer: coarse)': { minHeight: 44 } } }}>
        {presentation.actions.reviewTrade && <Button variant="contained" onClick={onReview}>{COPY.action.reviewTrade}</Button>}
        {presentation.actions.createOrder && onCreateOrder && <Button variant="outlined" onClick={onCreateOrder} data-testid="ai-rec-act">{COPY.action.createOrder}</Button>}
        {presentation.actions.analysis && <Button onClick={onAnalysis}>{COPY.action.analysis}</Button>}
        {presentation.actions.refresh && <Button onClick={onRefresh}>{COPY.action.refresh}</Button>}
        {presentation.actions.dismiss && <Button color="inherit" onClick={onDismiss}>{COPY.action.dismiss}</Button>}
      </Stack>
    </Box>
  );
}
