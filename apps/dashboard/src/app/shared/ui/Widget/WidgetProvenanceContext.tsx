/**
 * Where a board's figures come from (canon P-8), for every `Widget` inside it: `sample` dashes each
 * card's border and adds the hatch stripe, the same treatment the chart frame gives sample data.
 * The app shell sets it once from the build (every figure on the demo is its sample; the live build
 * stays `primary`, so production cards keep their solid border), and the ticker desk sets the same
 * value again for its board. A `ChartFrame` or `ProvenanceChip` given no provenance of its own reads
 * it too.
 */
import type { Provenance } from '@/shared/charts/frame';
import { createContext, useContext, type ReactNode } from 'react';

const WidgetProvenanceContext = createContext<Provenance>('primary');

export function WidgetProvenanceProvider({
  value,
  children,
}: {
  value: Provenance;
  children: ReactNode;
}) {
  return (
    <WidgetProvenanceContext.Provider value={value}>{children}</WidgetProvenanceContext.Provider>
  );
}

export function useWidgetProvenance(): Provenance {
  return useContext(WidgetProvenanceContext);
}
