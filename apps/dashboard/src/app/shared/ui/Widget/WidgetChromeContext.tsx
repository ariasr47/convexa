/**
 * Board chrome intensity for ticker (and similar) bento boards.
 * `quiet` — supporting/context band: no hover lift, softer presence, fewer affordances.
 */
import { createContext, useContext, type ReactNode } from 'react';

export type WidgetChrome = 'default' | 'quiet';

const WidgetChromeContext = createContext<WidgetChrome>('default');

export function WidgetChromeProvider({
  value,
  children,
}: {
  value: WidgetChrome;
  children: ReactNode;
}) {
  return <WidgetChromeContext.Provider value={value}>{children}</WidgetChromeContext.Provider>;
}

export function useWidgetChrome(): WidgetChrome {
  return useContext(WidgetChromeContext);
}
