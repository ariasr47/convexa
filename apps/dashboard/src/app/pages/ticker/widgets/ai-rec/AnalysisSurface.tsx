import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Drawer, IconButton, Stack, Typography } from '@mui/material';
import type { Grounding, OpenPositionsDigest, RecResponse, RiskInputs, TickerBundle } from '@convexa/api';
import { COPY } from './copy';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CapAnnotation } from './CapAnnotation';
import { CitedContractLine } from './CitedContractLine';
import { GroundingNote } from './GroundingNote';
import { LevelsStrip, ReasoningSection } from './reasoning';
import { NumbersSaidStrip } from './NumbersSaidStrip';

export function analysisTitle(ticker: string): string {
  return `${COPY.action.analysis} · ${ticker}`;
}

function AnalysisSummary({ rec }: { rec: RecResponse }) {
  const strategy = rec.strategy!;
  return (
    <Stack spacing={1} data-testid="analysis-summary">
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Read summary</Typography>
      <Typography variant="h6">{strategy.decision === 'no_trade' ? COPY.noTrade.title : `${strategy.decision} · ${strategy.bias}`}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Persona · {rec.persona.name} · As of {rec.as_of ?? '—'}
      </Typography>
      {rec.scenario && <Typography variant="caption">{`SCRIPTED SCENARIO · ${rec.scenario.name} · ${COPY.provenance.sim}`}</Typography>}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {strategy.structure ?? '—'} · {strategy.expiration ?? '—'} · {strategy.time_horizon ?? '—'}
      </Typography>
    </Stack>
  );
}

function GroundingDetail({ grounding }: { grounding: Grounding | null | undefined }) {
  return (
    <Box data-testid="grounding-detail">
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Cited contract and grounding</Typography>
      <GroundingNote grounding={grounding} />
      {grounding && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          Checked {grounding.counts.checked} · traced {grounding.counts.traced} · untraced {grounding.counts.untraced} · not checkable {grounding.counts.not_checkable}
        </Typography>
      )}
    </Box>
  );
}

function AsSentInputs({ riskInputs, openPositions }: { riskInputs: RiskInputs | null | undefined; openPositions: OpenPositionsDigest | null | undefined }) {
  const effective = riskInputs?.effective_dollar_cap;
  const underlying = openPositions?.this_underlying;
  const portfolio = openPositions?.portfolio;
  return (
    <Box data-testid="as-sent-inputs">
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>As-sent risk inputs</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {riskInputs ? `State: ${riskInputs.state} · Account size: ${riskInputs.account_size ?? '—'} · Per-trade cap: ${riskInputs.per_trade_cap ? `${riskInputs.per_trade_cap.value} ${riskInputs.per_trade_cap.unit}` : '—'} · Effective cap: ${effective?.value ?? '—'} (${effective?.state ?? '—'}; reason: ${effective?.not_derivable_reason ?? '—'}; derived from account ${effective?.derived_from.account_size ?? '—'}, cap ${effective?.derived_from.cap_value ?? '—'} ${effective?.derived_from.cap_unit ?? '—'}) · Storage available: ${riskInputs.storage_available} · Updated at: ${riskInputs.updated_at ?? '—'}` : 'Risk inputs not available.'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Open positions: {openPositions ? `${openPositions.state} · ${openPositions.source} · Underlying: ${underlying ? `${underlying.direction}, ${underlying.leg_count} legs, ${underlying.nearest_expiry_dte} DTE, max loss ${underlying.max_loss.value ?? '—'} (${underlying.max_loss.state}; reason: ${underlying.max_loss.reason ?? '—'})` : '—'} · Portfolio: ${portfolio ? `${portfolio.open_count} open, capital at risk ${portfolio.capital_at_risk ?? '—'}` : '—'}` : 'not available'}
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

export function AnalysisSurface({ open, ticker, rec, bundle, onClose, onViewExport }: AnalysisSurfaceProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  const pendingExportRef = useRef(false);
  const [pendingExport, setPendingExport] = useState(false);
  const [surfaceOpen, setSurfaceOpen] = useState(open);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && !document.activeElement.closest('[role="dialog"]')) {
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
          sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100vw', overflow: 'hidden', bgcolor: 'background.paper' },
        },
      }}
    >
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        <Stack direction="row" sx={{ position: 'sticky', top: 0, zIndex: 1, alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography id="ai-rec-analysis-title" component="h2" variant="subtitle1">{analysisTitle(ticker)}</Typography>
          <IconButton autoFocus aria-label="Close analysis" onClick={handleClose}><CloseIcon /></IconButton>
        </Stack>
        <Stack data-testid="analysis-content" spacing={2} sx={{ minHeight: 0, overflowX: 'hidden', overflowY: 'auto', p: 2.5 }}>
          <AnalysisSummary rec={rec} />
          <Box data-testid="analysis-rationale"><ReasoningSection strategy={strategy} expanded /></Box>
          <Box data-testid="analysis-levels"><LevelsStrip bundle={bundle ?? null} /></Box>
          <Box data-testid="analysis-numbers"><NumbersSaidStrip candidates={rec.sent?.candidates} move={bundle?.market_state?.straddle_move} citedExpiration={strategy.expiration} /></Box>
          <Box data-testid="analysis-cited"><CitedContractLine cited={rec.cited_contract} asOf={rec.sent?.candidates?.as_of ?? null} /></Box>
          <Box data-testid="analysis-grounding"><GroundingDetail grounding={rec.grounding} /></Box>
          <Box data-testid="analysis-cap"><CapAnnotation capCheck={rec.cap_check} /></Box>
          <Box data-testid="analysis-as-sent"><AsSentInputs riskInputs={rec.sent?.risk_inputs} openPositions={rec.sent?.open_positions} /></Box>
          <Box data-testid="analysis-export"><Button disabled={pendingExport} onClick={handleExport}>{COPY.action.requestExport}</Button></Box>
        </Stack>
      </Stack>
    </Drawer>
  );
}
