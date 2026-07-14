/**
 * WidgetSelectionContext — the one-selected-at-a-time selection state for the Ticker widget board.
 * A single `selectedId` (or null) lives here; `<Widget>` reads it to render its selected ring and
 * calls `select(id)` on click / focus. Provided once in `TickerDashboard`, wrapping the bento grid,
 * with a click-outside handler that clears the selection.
 *
 * Presentation-only: selection drives NO data path — it is the seam future per-widget configuration
 * will hang off (select-to-configure), shipped now purely as identity/affordance. No backend touch.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface WidgetSelection {
  selectedId: string | null;
  select: (id: string) => void;
  clear: () => void;
}

const WidgetSelectionCtx = createContext<WidgetSelection | null>(null);

export function WidgetSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const select = useCallback((id: string) => setSelectedId(id), []);
  const clear = useCallback(() => setSelectedId(null), []);
  const value = useMemo(() => ({ selectedId, select, clear }), [selectedId, select, clear]);
  return <WidgetSelectionCtx.Provider value={value}>{children}</WidgetSelectionCtx.Provider>;
}

/**
 * useWidgetSelection — read the selection state. Safe to call outside a provider (returns a no-op
 * selection) so a `<Widget>` rendered standalone in a test never throws.
 */
export function useWidgetSelection(): WidgetSelection {
  const ctx = useContext(WidgetSelectionCtx);
  if (ctx) return ctx;
  return { selectedId: null, select: () => undefined, clear: () => undefined };
}

export default WidgetSelectionProvider;
