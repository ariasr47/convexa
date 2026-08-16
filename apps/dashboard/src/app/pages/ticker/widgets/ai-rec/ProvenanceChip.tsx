/**
 * ProvenanceChip — "Sized against your inputs · Account $X · Max Y" (SPEC §4). Renders the owner's
 * entered values VERBATIM; no client code multiplies, divides or otherwise derives a figure from
 * them (AC-61). Renders only when the risk block was actually sent (`sent.risk_inputs.state ===
 * 'set'`) — an unset block has nothing to attribute.
 */
import type { RiskInputs } from '@convexa/api';
import { Chip } from '@mui/material';
import { PROVENANCE_CHIP_TIP, provenanceChip } from './copy';
import { AccessibleHelp } from './AccessibleHelp';

export function ProvenanceChip({ riskInputs }: { riskInputs: RiskInputs | undefined | null }) {
  if (!riskInputs || riskInputs.state !== 'set' || riskInputs.account_size == null) return null;
  const cap = riskInputs.per_trade_cap;
  const capText = cap
    ? cap.unit === 'percent'
      ? `Max ${cap.value}%/trade`
      : `Max $${cap.value}/trade`
    : 'no per-trade cap set';
  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        data-testid="ai-rec-provenance-chip"
        label={provenanceChip(riskInputs.account_size, capText)}
      />
      <AccessibleHelp label="Risk input provenance help" text={PROVENANCE_CHIP_TIP} />
    </>
  );
}
