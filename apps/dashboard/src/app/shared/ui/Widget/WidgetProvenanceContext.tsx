/**
 * Where a board's figures come from (canon P-8), for every `Widget` inside it: `sample` dashes each
 * card's border and adds the hatch stripe, the same treatment the chart frame gives sample data.
 * The ticker desk sets it once for the demo build (every figure there is the demo's sample); the
 * live build leaves it `primary`, so production cards keep their solid border.
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
