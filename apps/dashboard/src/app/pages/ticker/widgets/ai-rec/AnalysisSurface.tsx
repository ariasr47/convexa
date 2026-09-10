import type {
  Grounding,
  OpenPositionsDigest,
  RecResponse,
  RiskInputs,
  TickerBundle,
} from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtAsOfEt, fmtExpiry } from '@/pages/ticker/widgets/_kit/copy';
import { CapAnnotation } from './CapAnnotation';
import { CitedContractLine } from './CitedContractLine';
import { FigureClause } from './FigureClause';
import { GroundingNote } from './GroundingNote';
import { NumbersSaidStrip } from './NumbersSaidStrip';
import { COPY, PLAN_FIELD_LABEL, literalCopy } from './copy';
import { fieldLiteral, planFieldLiteral, registerSx } from './literals';
import { LevelsStrip, ReasoningSection } from './reasoning';

export function analysisTitle(ticker: string): string {
  return `${COPY.action.analysis} · ${ticker}`;
}

function AnalysisSummary({ rec }: { rec: RecResponse }) {
  const strategy = rec.strategy;
  if (!strategy) return null;
  return (
    <Stack spacing={1} data-testid="analysis-summary">
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Read summary
      </Typography>
      <Typography variant="h6">
        {strategy.decision === 'no_trade'
          ? COPY.noTrade.title
          : `${strategy.decision} · ${strategy.bias}`}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Persona · {rec.persona.name}
        {/* Fidelity repair 2, N5 — the exchange-clock form, never the raw ISO instant. */}
        {rec.as_of ? ` · As of ${fmtAsOfEt(rec.as_of)}` : ''}
      </Typography>
      {rec.scenario && (
        <Typography variant="caption">{`SCRIPTED SCENARIO · ${rec.scenario.name} · ${COPY.provenance.sim}`}</Typography>
      )}
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: 'wrap' }}
        data-testid="analysis-structured-summary"
      >
        {(
          [
            [PLAN_FIELD_LABEL.structure, strategy.structure, rec.field_reasons?.structure],
            [PLAN_FIELD_LABEL.expiration, strategy.expiration, rec.field_reasons?.expiration],
            // Fidelity repair 2, N6 — Time horizon dropped HERE (kept once, in `analysis-plan-fields`
            // below, beside Confidence — the design's `MANAGE THE TRADE` grouping). It used to render
            // in BOTH lists (`Structure · Expiration · Time horizon` then `Time horizon ·
            // Confidence`), visible in the accepted `ai-recommendation` baseline.
          ] as const
        ).map(([label, value, reason]) => {
          const literal = planFieldLiteral({ decision: strategy.decision, value, reason });
          // Fidelity repair 2, N5 — the closed literal selector decides value/dash/not-set/… on the
          // RAW wire token first; only a resolved `value` literal's TEXT is reformatted, and only
          // for the expiration field (design: `Sep 18 (15 DTE)`) — structure is a plain string,
          // untouched.
          const text =
            literal.kind === 'value'
              ? label === PLAN_FIELD_LABEL.expiration
                ? fmtExpiry(literal.text)
                : literal.text
              : literalCopy(literal.kind).text;
          return (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2">{text}</Typography>
            </Box>
          );
        })}
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: 'wrap' }}
        data-testid="analysis-plan-fields"
      >
        {(
          [
            [PLAN_FIELD_LABEL.timeHorizon, strategy.time_horizon, rec.field_reasons?.time_horizon],
            [PLAN_FIELD_LABEL.confidence, strategy.confidence, rec.field_reasons?.confidence],
          ] as const
        ).map(([label, value, reason]) => {
          const literal = planFieldLiteral({ decision: strategy.decision, value, reason });
          return (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography data-testid={`analysis-field-${label}`} variant="body2">
                {literal.kind === 'value' ? literal.text : literalCopy(literal.kind).text}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

function GroundingDetail({
  grounding,
  rec,
}: {
  grounding: Grounding | null | undefined;
  rec: RecResponse;
}) {
  const strategy = rec.strategy;
  if (!strategy) return null;
  const rows = [
    [
      'Stop',
      strategy.exit_plan?.stop,
      rec.field_reasons?.exit_stop,
      grounding?.fields.exit_stop,
      'clause-stop',
    ],
    [
      'Target',
      strategy.exit_plan?.target,
      rec.field_reasons?.exit_target,
      grounding?.fields.exit_target,
      'clause-target',
    ],
    [
      'Invalidation',
      strategy.invalidation_level,
      rec.field_reasons?.invalidation_level,
      grounding?.fields.invalidation_level,
      'clause-invalidation',
    ],
  ] as const;
  return (
    <Box data-testid="grounding-detail">
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        Cited contract and grounding
      </Typography>
      {strategy.decision === 'trade' && <GroundingNote grounding={grounding} />}
      <Stack spacing={1} data-testid="analysis-grounding-fields" sx={{ mt: 1 }}>
        {rows.map(([label, value, reason, field, testId]) => {
          const literal = fieldLiteral({ decision: strategy.decision, value, reason });
          return (
            <Box key={label}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {label}
              </Typography>
              <Typography variant="body2" sx={field ? registerSx(field.state) : undefined}>
                {literal.kind === 'value' ? literal.text : literalCopy(literal.kind).text}
              </Typography>
              {literal.kind === 'value' && <FigureClause field={field} testId={testId} />}
            </Box>
          );
        })}
      </Stack>
      {grounding && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          Checked {grounding.counts.checked} · traced {grounding.counts.traced} · untraced{' '}
          {grounding.counts.untraced} · not checkable {grounding.counts.not_checkable}
        </Typography>
      )}
    </Box>
  );
}

function AsSentInputs({
  riskInputs,
  openPositions,
}: {
  riskInputs: RiskInputs | null | undefined;
  openPositions: OpenPositionsDigest | null | undefined;
}) {
  const effective = riskInputs?.effective_dollar_cap;
  const underlying = openPositions?.this_underlying;
  const portfolio = openPositions?.portfolio;
  const riskLines = riskInputs
    ? [
        `State: ${riskInputs.state}`,
        riskInputs.account_size != null ? `Account size: ${riskInputs.account_size}` : null,
        riskInputs.per_trade_cap
          ? `Per-trade cap: ${riskInputs.per_trade_cap.value} ${riskInputs.per_trade_cap.unit}`
          : null,
        effective?.value != null ? `Effective cap: ${effective.value}` : null,
        effective?.state ? `Effective cap state: ${effective.state}` : null,
        effective?.not_derivable_reason
          ? `Effective cap reason: ${effective.not_derivable_reason}`
          : null,
        effective?.derived_from.account_size != null
          ? `Derived from account: ${effective.derived_from.account_size}`
          : null,
        effective?.derived_from.cap_value != null
          ? `Derived from cap: cap ${effective.derived_from.cap_value}${effective.derived_from.cap_unit ? ` ${effective.derived_from.cap_unit}` : ''}`
          : null,
        `Storage available: ${riskInputs.storage_available}`,
        riskInputs.updated_at ? `Updated at: ${riskInputs.updated_at}` : null,
      ].filter((line): line is string => Boolean(line))
    : [];
  const underlyingLines = underlying
    ? [
        `Underlying: ${underlying.direction}`,
        `Legs: ${underlying.leg_count}`,
        underlying.nearest_expiry_dte != null
          ? `Nearest expiry: ${underlying.nearest_expiry_dte} DTE`
          : null,
        underlying.max_loss.value != null ? `Max loss: ${underlying.max_loss.value}` : null,
        `Max loss state: ${underlying.max_loss.state}`,
        underlying.max_loss.reason ? `Max loss reason: ${underlying.max_loss.reason}` : null,
      ].filter((line): line is string => Boolean(line))
    : [];
  const portfolioLines = portfolio
    ? [
        `Open positions: ${portfolio.open_count}`,
        portfolio.capital_at_risk != null ? `Capital at risk: ${portfolio.capital_at_risk}` : null,
      ].filter((line): line is string => Boolean(line))
    : [];
  return (
    <Box data-testid="as-sent-inputs">
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        As-sent risk inputs
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {riskLines.length ? riskLines.join(' · ') : 'Risk inputs not available.'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {openPositions
          ? [
              `State: ${openPositions.state}`,
              `Source: ${openPositions.source}`,
              ...underlyingLines,
              ...portfolioLines,
            ].join(' · ')
          : 'Open positions not available.'}
      </Typography>
    </Box>
  );
}

export interface AnalysisSurfaceProps {
  open: boolean;
  ticker: string;
  rec: RecResponse | null | undefined;
  bundle: TickerBundle | null | undefined;
  onClose: () => void;
  onViewExport: () => void;
}

export function AnalysisSurface({
  open,
  ticker,
  rec,
  bundle,
  onClose,
  onViewExport,
}: AnalysisSurfaceProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  const pendingExportRef = useRef(false);
  const [pendingExport, setPendingExport] = useState(false);
  const [surfaceOpen, setSurfaceOpen] = useState(open);
  useLayoutEffect(() => {
    if (
      open &&
      document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest('[role="dialog"]')
    ) {
      openerRef.current = document.activeElement;
    }
  }, [open]);
  useEffect(() => setSurfaceOpen(open), [open]);
  useEffect(() => {
    if (open && (!rec || rec.status !== 'produced' || !rec.strategy)) onClose();
  }, [open, rec, onClose]);
  const handleClose = () => {
    onClose();
    requestAnimationFrame(() => openerRef.current?.focus());
  };
  const handleExport = () => {
    pendingExportRef.current = true;
    setPendingExport(true);
    setSurfaceOpen(false);
  };
  if (!open || !rec || rec.status !== 'produced' || !rec.strategy) return null;
  const strategy = rec.strategy;
  return (
    <Drawer
      anchor="right"
      open={open && surfaceOpen}
      onClose={handleClose}
      aria-labelledby="ai-rec-analysis-title"
      slotProps={{
        transition: {
          onExited: () => {
            if (pendingExportRef.current) {
              pendingExportRef.current = false;
              setPendingExport(false);
              onClose();
              onViewExport();
            }
          },
        },
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'ai-rec-analysis-title',
          sx: {
            width: { xs: '100%', sm: 560 },
            maxWidth: '100vw',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          },
        },
      }}
    >
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        <Stack
          direction="row"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 2,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography id="ai-rec-analysis-title" component="h2" variant="subtitle1">
            {analysisTitle(ticker)}
          </Typography>
          <IconButton autoFocus aria-label="Close analysis" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Stack
          data-testid="analysis-content"
          spacing={2}
          sx={{
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            overflowWrap: 'anywhere',
            p: 2.5,
          }}
        >
          <AnalysisSummary rec={rec} />
          <Box data-testid="analysis-rationale">
            <ReasoningSection strategy={strategy} expanded />
          </Box>
          <Box data-testid="analysis-levels">
            <LevelsStrip bundle={bundle ? bundle : null} />
          </Box>
          <Box data-testid="analysis-numbers">
            <NumbersSaidStrip
              candidates={rec.sent?.candidates}
              move={bundle?.market_state?.straddle_move}
              citedExpiration={strategy.expiration}
            />
          </Box>
          <Box data-testid="analysis-cited">
            <CitedContractLine
              cited={rec.cited_contract}
              asOf={rec.sent?.candidates?.as_of ?? null}
            />
          </Box>
          <Box data-testid="analysis-grounding">
            <GroundingDetail grounding={rec.grounding} rec={rec} />
          </Box>
          <Box data-testid="analysis-cap">
            <CapAnnotation capCheck={rec.cap_check} />
          </Box>
          <Box data-testid="analysis-as-sent">
            <AsSentInputs
              riskInputs={rec.sent?.risk_inputs}
              openPositions={rec.sent?.open_positions}
            />
          </Box>
          <Box data-testid="analysis-export">
            <Button disabled={pendingExport} onClick={handleExport}>
              {COPY.action.requestExport}
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Drawer>
  );
}
