import { GROK_SUBSCRIPTION_LABEL, ownKeyChip } from '@/features/auth/aiProviderLabels';
import { fmtAsOfEt, fmtExpiry } from '@/pages/ticker/widgets/_kit/copy';
import { typographyTokens } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui';
import type { RecResponse, TickerBundle } from '@convexa/api';
import { demoNowMs } from '@convexa/api';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CapAnnotation } from './CapAnnotation';
import {
  COPY,
  dteWindowCaption,
  incompleteAction,
  literalCopy,
  MAX_RISK_TIP,
  PLAN_FIELD_LABEL,
  PLAN_FIELDS_NOT_CHECKED,
  POWERING,
  staleBornStrip,
  staleStrip,
  SUPERSEDED_STRIP,
} from './copy';
import { FigureClause } from './FigureClause';
import { GroundingNote } from './GroundingNote';
import {
  fieldLiteral,
  planFieldLiteral,
  registerSx,
  type FieldLiteral,
  type PlanFieldLiteral,
} from './literals';
import { shouldShowPlanFieldsNotChecked } from './planScopeCaption';
import type { AiRecPresentation } from './presentationPolicy';
import { ProvenanceChip } from './ProvenanceChip';
import { deriveReasoning } from './reasoning';

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

function RiskField({
  label,
  literal,
  tip,
  clause,
  groundingState,
  caption,
}: {
  label: string;
  literal: FieldLiteral | PlanFieldLiteral;
  tip?: string;
  clause?: React.ReactNode;
  groundingState?: Parameters<typeof registerSx>[0];
  caption?: React.ReactNode;
}) {
  const value = literal.kind === 'value' ? literal.text : literalCopy(literal.kind).text;
  const help = literal.kind === 'value' ? tip : literalCopy(literal.kind).tip;
  // Row 31 (SPEC §4.5): "the model's own number" (untraced) reads Plex Sans WITH A DOTTED RULE —
  // NEVER in colour. The dotted rule is layered on TOP of `registerSx`'s shared fontFamily switch
  // here, at the call site, rather than inside `literals.ts` (out of this task's Owns list, and
  // `literals.spec.ts`'s own "registerSx — D3" suite already pins untraced/not_checkable/
  // not_applicable as mutually EQUAL font-only objects — a settled prior contract this task does not
  // reopen). Scoped to an actual rendered number (`literal.kind === 'value'`) so an absence literal
  // (dash/not given/unavailable) never grows a spurious rule under it.
  const dottedRule =
    literal.kind === 'value' && groundingState === 'untraced'
      ? { borderBottom: '1px dotted', borderColor: 'text.disabled', display: 'inline-block' }
      : undefined;
  return (
    <Box>
      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {help && <AccessibleHelp label={`${label} help`} text={help} />}
      </Stack>
      <Typography
        variant="body2"
        sx={groundingState ? { ...registerSx(groundingState), ...dottedRule } : undefined}
      >
        {literal.kind === 'not_set' ? (
          <>
            {value}{' '}
            <Button
              component="a"
              href="/settings#risk-inputs"
              size="small"
              color="info"
              sx={{ p: 0, minWidth: 0, textTransform: 'none' }}
            >
              Set your risk inputs
            </Button>
          </>
        ) : (
          <>
            {value}
            {literal.kind === 'value' && caption}
          </>
        )}
      </Typography>
      {literal.kind === 'value' && clause}
    </Box>
  );
}

export function Provenance({ rec }: { rec: RecResponse }) {
  const source = rec.key_source;
  const own = source === 'own_key';
  const subscription = source === 'grok_subscription';
  const model = rec.model?.trim() ? rec.model.trim() : null;
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}
      data-testid="decision-provenance"
    >
      {rec.scenario && (
        <>
          <Chip size="small" color="warning" variant="outlined" label="SCRIPTED" />
          <AccessibleHelp
            label="Scripted scenario help"
            text={`Scripted scenario — ${rec.scenario.name}`}
          />
        </>
      )}
      <Chip size="small" variant="outlined" label={`Persona · ${rec.persona.name}`} />
      <AccessibleHelp
        label="Persona provenance help"
        text={COPY.tooltip.persona.replace('{name}', rec.persona.name)}
      />
      {/* The age runs on the demo's scenario clock there (demoNowMs is Date.now() on a live build).
          Fidelity repair 2, N5 — the exchange-clock form (design: `read pinned as of 10:41:52 ET ·
          48s ago`), never the raw ISO instant. `data-rec-as-of` (below, the card root) keeps the raw
          ISO for machine consumers — this chip is copy, not the attribute. */}
      <Chip size="small" variant="outlined" label={`As of ${fmtAsOfEt(rec.as_of, demoNowMs())}`} />
      <AccessibleHelp label="Snapshot provenance help" text={COPY.tooltip.asOf} />
      <Chip size="small" variant="outlined" label={COPY.provenance.sim} />
      <AccessibleHelp label="Simulated advisory help" text={COPY.tooltip.advisory} />
      {subscription && (
        <>
          <Chip
            size="small"
            variant="outlined"
            label={GROK_SUBSCRIPTION_LABEL}
            data-testid="ai-rec-path-chip"
          />
          <AccessibleHelp label="Grok subscription help" text={POWERING.subscription.tooltip} />
        </>
      )}
      {own && (
        <>
          <Chip
            size="small"
            variant="outlined"
            label={ownKeyChip(rec.provider)}
            data-testid="ai-rec-path-chip"
          />
          <AccessibleHelp label="Own key help" text={POWERING.ownKey.tooltip} />
        </>
      )}
      {model && (
        <Chip
          size="small"
          variant="outlined"
          label={`Model · ${model}`}
          data-testid="ai-rec-model-chip"
          sx={{ fontFamily: typographyTokens.monoFontFamily }}
        />
      )}
      <ProvenanceChip riskInputs={rec.sent?.risk_inputs} />
    </Stack>
  );
}

function DecisionContext({ rec }: { rec: RecResponse }) {
  return (
    <Box data-testid="decision-context">
      {rec.scenario && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1 }}>
          Scripted scenario — {rec.scenario.name}. <strong>SIMULATED / advisory</strong>
        </Alert>
      )}
    </Box>
  );
}

function DecisionMetadata({ rec, bundle }: { rec: RecResponse; bundle: TickerBundle | null }) {
  const s = rec.strategy;
  if (!s) return null;
  const strikeText =
    s.strikes
      ?.filter(Number.isFinite)
      .map((x) => `$${x}`)
      .join(' / ') ?? '';
  const dteMin = Number.isFinite(bundle?.market_state?.dte_min)
    ? bundle?.market_state?.dte_min
    : null;
  const dteMax = Number.isFinite(bundle?.market_state?.dte_max)
    ? bundle?.market_state?.dte_max
    : null;
  const confidence = planFieldLiteral({
    decision: s.decision,
    value: s.confidence,
    reason: rec.field_reasons?.confidence,
  });
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} data-testid="decision-metadata">
      <RiskField
        label={PLAN_FIELD_LABEL.structure}
        literal={planFieldLiteral({
          decision: s.decision,
          value: s.structure,
          reason: rec.field_reasons?.structure,
        })}
      />
      <RiskField
        label={PLAN_FIELD_LABEL.strikes}
        literal={planFieldLiteral({
          decision: s.decision,
          value: strikeText,
          reason: rec.field_reasons?.strikes,
        })}
      />
      <RiskField
        label={PLAN_FIELD_LABEL.expiration}
        // Fidelity repair 2, N5 — the closed literal selector decides value/dash/not-set/… on the
        // RAW wire token first (never on the formatted string — `fmtExpiry`'s own `unavailable`
        // fallback must not race the selector's own reason-token lookup); only a resolved `value`
        // literal's TEXT is then reformatted (design: `Sep 18 (15 DTE)`).
        literal={(() => {
          const literal = planFieldLiteral({
            decision: s.decision,
            value: s.expiration,
            reason: rec.field_reasons?.expiration,
          });
          return literal.kind === 'value' ? { ...literal, text: fmtExpiry(literal.text) } : literal;
        })()}
        caption={
          dteMin != null && dteMax != null ? (
            <Typography component="span" variant="caption" color="text.secondary">
              {dteWindowCaption(dteMin, dteMax)}
            </Typography>
          ) : undefined
        }
      />
      <RiskField
        label={PLAN_FIELD_LABEL.entryTrigger}
        literal={planFieldLiteral({
          decision: s.decision,
          value: s.entry_trigger,
          reason: rec.field_reasons?.entry_trigger,
        })}
      />
      <RiskField
        label={PLAN_FIELD_LABEL.timeHorizon}
        literal={planFieldLiteral({
          decision: s.decision,
          value: s.time_horizon,
          reason: rec.field_reasons?.time_horizon,
        })}
      />
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {PLAN_FIELD_LABEL.confidence}
          </Typography>
          <AccessibleHelp
            label="Confidence help"
            text={
              confidence.kind === 'value'
                ? 'Confidence supplied by the read.'
                : literalCopy(confidence.kind).tip
            }
          />
        </Stack>
        {confidence.kind === 'value' ? (
          <Chip size="small" label={s.confidence} />
        ) : (
          <Typography variant="body2">{literalCopy(confidence.kind).text}</Typography>
        )}
      </Box>
    </Stack>
  );
}

export function DecisionCard({
  rec,
  bundle,
  presentation,
  dataAge,
  onReview,
  onCreateOrder,
  onAnalysis,
  onRefresh,
  onDismiss,
}: DecisionCardProps) {
  const strategy = rec.strategy;
  if (!strategy) return null;
  const isTrade = strategy.decision === 'trade';
  const reasoning = deriveReasoning(strategy);
  const missing = presentation.missingPositionFields;
  const maxRiskLiteral = fieldLiteral({
    decision: strategy.decision,
    value: strategy.max_risk,
    reason: rec.field_reasons?.max_risk,
  });
  const invalidationLiteral = fieldLiteral({
    decision: strategy.decision,
    value: strategy.invalidation_level,
    reason: rec.field_reasons?.invalidation_level,
  });
  const entryTriggerLiteral = planFieldLiteral({
    decision: strategy.decision,
    value: strategy.entry_trigger,
    reason: rec.field_reasons?.entry_trigger,
  });
  const targetLiteral = fieldLiteral({
    decision: strategy.decision,
    value: strategy.exit_plan?.target,
    reason: rec.field_reasons?.exit_target,
  });

  return (
    <Box
      data-testid="ai-rec-decision-card"
      sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'visible' }}
      data-rec-pinned-fingerprint={rec.pinned_fingerprint ?? ''}
      data-rec-as-of={rec.as_of ?? ''}
      data-rec-persona-id={rec.persona.id}
      data-rec-persona-name={rec.persona.name}
    >
      <DecisionContext rec={rec} />
      <Provenance rec={rec} />
      {(presentation.resultState === 'stale_newer_snapshot' ||
        presentation.resultState === 'stale_at_generation' ||
        presentation.resultState === 'superseded_inputs') && (
        <Alert
          severity={presentation.resultState === 'stale_at_generation' ? 'warning' : 'info'}
          icon={
            presentation.resultState === 'stale_at_generation' ? <WarningAmberIcon /> : undefined
          }
          sx={{ mt: 1 }}
          data-testid="decision-degraded"
        >
          {presentation.resultState === 'stale_newer_snapshot'
            ? staleStrip(rec.as_of)
            : presentation.resultState === 'stale_at_generation'
              ? staleBornStrip(dataAge ?? 'older data')
              : SUPERSEDED_STRIP}
        </Alert>
      )}
      {/* Row 29/30 (SPEC §4.5, canon rule 16): the verdict word is the first content node of the
          read's own body (after the fixed attribution chrome above — provenance and, when present,
          a composing degraded strip, both of which the design source itself draws ABOVE the verdict
          too, and criterion 43 requires for the degraded strip specifically) and it is the ONLY
          element in the panel that ever spends amber AS TEXT. `Trade` alone carries it — the
          separator and the bias word stay in the default type register (`Archivo display`, canon's
          own trio; never `subtitle1`, which is Plex Sans). `No trade` spends NO amber at all: amber
          means "there is a trade," not "here is the verdict slot" (ruling 8 — tier emphasis survives
          in the word, in type only, never a replacement colour; no_trade is info-toned, not red, and
          not amber either). */}
      <Box
        data-testid="decision-verdict"
        sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}
      >
        <Typography
          component="p"
          data-testid="decision-verdict-word"
          sx={{
            m: 0,
            fontFamily: typographyTokens.displayFontFamily,
            fontStretch: typographyTokens.displayFontStretch,
            fontWeight: 700,
            letterSpacing: '-0.015em',
            fontSize: { xs: '20px', sm: '26px' },
            // ONE text node, byte-identical to the pre-existing `Trade · {bias}` / `No trade`
            // strings every other spec already queries by text — splitting it into separate spans
            // for the word alone breaks `getByText`'s direct-text-node matching across dozens of
            // existing call sites for no spec benefit (row 30 only requires that the VERDICT be the
            // sole amber-as-text spender, not that a sub-string of it be excluded). `No trade` never
            // spends amber at all (ruling 8 / §4.5: no_trade is info-toned, never a directional
            // colour) — the whole element only turns amber for a trade verdict.
            color: isTrade ? 'primary.main' : undefined,
          }}
        >
          {isTrade ? `Trade · ${strategy.bias}` : COPY.noTrade.title}
        </Typography>
      </Box>
      {isTrade && <DecisionMetadata rec={rec} bundle={bundle} />}
      {shouldShowPlanFieldsNotChecked(rec) && (
        <Typography
          variant="caption"
          data-testid="plan-fields-not-checked"
          sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
        >
          {PLAN_FIELDS_NOT_CHECKED}
        </Typography>
      )}
      {/* Row 31: the four risk fields render their grounding BEFORE any prose — `AiRecPanel.tsx`'s
          own header doc already declares "risk + invalidation FIRST"; the DOM order below is what
          makes that literally true (moved ahead of `decision-thesis`, not merely asserted). */}
      {isTrade && (
        <>
          {missing.length > 0 &&
            !(
              presentation.resultState === 'stale_newer_snapshot' ||
              presentation.resultState === 'stale_at_generation' ||
              presentation.resultState === 'superseded_inputs'
            ) && (
              <Alert severity="info" sx={{ mt: 1 }} data-testid="rec-not-actionable">
                {incompleteAction(missing)}
              </Alert>
            )}
          <Box
            data-testid="decision-grid"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1,
              mt: 1,
            }}
          >
            <RiskField
              label="Max risk"
              literal={maxRiskLiteral}
              tip={MAX_RISK_TIP}
              groundingState={rec.grounding?.fields.max_risk?.state}
            />
            <RiskField
              label="Invalidation"
              literal={invalidationLiteral}
              tip="The level that says the idea is wrong."
              groundingState={rec.grounding?.fields.invalidation_level?.state}
              clause={
                <FigureClause
                  field={rec.grounding?.fields.invalidation_level}
                  testId="clause-invalidation"
                />
              }
            />
            {/* `Entry` (`entry_trigger`) carries no wire grounding field (the checked set is exactly
                exit_stop / exit_target / invalidation_level / max_risk / position_size) — it is a
                plan detail, never traced-or-untraced, so it renders in the plain register rather than
                a register this build cannot honestly assign. */}
            <RiskField label="Entry" literal={entryTriggerLiteral} />
            <RiskField
              label="Target"
              literal={targetLiteral}
              groundingState={rec.grounding?.fields.exit_target?.state}
              clause={
                <FigureClause field={rec.grounding?.fields.exit_target} testId="clause-target" />
              }
            />
          </Box>
        </>
      )}
      {reasoning.lead && (
        <Typography
          data-testid="decision-thesis"
          variant="body2"
          sx={{ mt: 1, color: 'text.secondary' }}
        >
          {reasoning.lead}
        </Typography>
      )}
      {!isTrade && strategy.reengage_when?.length ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {strategy.reengage_when.join(' · ')}
        </Typography>
      ) : null}
      <Box data-testid="decision-evidence" sx={{ mt: 1 }}>
        {isTrade && <GroundingNote grounding={rec.grounding} />}
        <CapAnnotation capCheck={rec.cap_check} />
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Stack
        data-testid="decision-actions"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          flexWrap: { xs: 'nowrap', sm: 'wrap' },
          '& .MuiButton-root': { '@media (pointer: coarse)': { minHeight: 44 } },
        }}
      >
        {/* Row 30 (SPEC §4.5): amber on this surface belongs to the verdict word alone. MUI's
            unthemed default for a `variant="outlined"`/`"text"` Button is `color="primary"`, which
            resolves to the SAME brand amber the verdict uses — every secondary/link-style control
            below binds an EXPLICIT non-amber color (mirrors `AiRecPanel.tsx`'s own export-link
            precedent: "link-class action text binds `info`... never amber"). Only the ONE primary,
            filled CTA (`reviewTrade`, `variant="contained"`) is exempt: a CONTAINED button's text is
            `primary.contrastText` (ink on an amber FILL), the fill-grade spend `tokens.ts` already
            reserves for buttons/bars/borders/icons — never the text-grade spend rule 16 scopes. */}
        {presentation.actions.reviewTrade && (
          <Button variant="contained" onClick={onReview}>
            {COPY.action.reviewTrade}
          </Button>
        )}
        {presentation.actions.createOrder && onCreateOrder && (
          <Button
            variant="outlined"
            color="inherit"
            onClick={onCreateOrder}
            data-testid="ai-rec-act"
          >
            {COPY.action.createOrder}
          </Button>
        )}
        {presentation.actions.analysis && (
          <Button color="info" onClick={onAnalysis}>
            {COPY.action.analysis}
          </Button>
        )}
        {presentation.actions.refresh && (
          <Button color="inherit" onClick={onRefresh}>
            {COPY.action.refresh}
          </Button>
        )}
        {presentation.actions.dismiss && (
          <Button color="inherit" onClick={onDismiss}>
            {COPY.action.dismiss}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
