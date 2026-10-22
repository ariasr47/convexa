/**
 * Where a board's figures come from (canon P-8), for every `Widget` inside it: `sample` dashes each
 * card's border and adds the hatch stripe, the same treatment the chart frame gives sample data.
 * The app shell sets it once from the build (every figure on the demo is its sample; the live build
 * stays `primary`, so production cards keep their solid border), and the ticker desk sets the same
 * value again for its board. A `ChartFrame` or `ProvenanceChip` given no provenance of its own reads
 * it too.
 *
 * The second context says whether a `ChartFrame` on a sample board wears the demo's own tag, "Demo ·
 * sample data". It does by default (the desk and its tabs, Scorecard, Positions, Scanner). A page
 * whose shell demo bar is its one "Demo · sample data" sets it to false (spec 01 step 5, owner
 * decision D1): its frames then name the sample once, by their own "Demo · shaped like …" source
 * chip, or by one "Sample" tag in the head when they have no source line. The Research pages set it;
 * the sample note page sets it too (spec 04 C2).
 */
import type { Provenance } from '@/shared/charts/frame';
import { createContext, useContext, type ReactNode } from 'react';

const WidgetProvenanceContext = createContext<Provenance>('primary');
const FrameDemoTagContext = createContext<boolean>(true);

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

/** False: the page's demo bar says "Demo · sample data", so its board-default frames don't. */
export function FrameDemoTagProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <FrameDemoTagContext.Provider value={value}>{children}</FrameDemoTagContext.Provider>;
}

export function useFrameDemoTag(): boolean {
  return useContext(FrameDemoTagContext);
}
