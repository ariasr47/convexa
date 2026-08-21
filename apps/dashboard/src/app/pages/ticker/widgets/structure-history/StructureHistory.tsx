/**
 * Structure history — kept as a testable Widget wrapper around StructurePathStrip.
 * Production ticker embeds the strip inside GEX (no free-standing peer card).
 */
import { Widget } from '@/shared/ui/Widget';
import type { StructureSample } from '@convexa/api';
import { StructurePathStrip } from './StructurePathStrip';

export interface StructureHistoryProps {
  symbol: string;
  samples: StructureSample[] | null;
  basis?: string | null;
  loading?: boolean;
  error?: string | null;
}

export function StructureHistory({
  symbol,
  samples,
  basis = null,
  loading = false,
  error = null,
}: StructureHistoryProps) {
  return (
    <Widget
      id="structure-history"
      title="Structure path"
      subtitle="Slow-lane samples · session path, not live ticks"
      span={2}
      bodyVariant="inset"
      bodyPad="none"
    >
      <StructurePathStrip
        symbol={symbol}
        samples={samples}
        basis={basis}
        loading={loading}
        error={error}
      />
    </Widget>
  );
}

export default StructureHistory;
