/**
 * `commandTable` — the ⌘K palette's STATIC closed list of trader routes (SPEC §2.6). No `/_ops`
 * entry exists BY CONSTRUCTION: this table is the only place the palette resolves a "surface"
 * command from, and it is exhaustively enumerated here, never derived from a route glob that could
 * pick up an operator page.
 */
export interface PaletteCommand {
  id: string;
  label: string;
  to: string;
  /** True when a signed-out trader hits the same visible sign-in wall the nav link produces
   *  (AC-28) — i.e. this surface is behind `useGate`/the server gate elsewhere in the app. None of
   *  the four are gated at the NAVIGATION level today (the gate lives on the WRITE actions inside
   *  Positions), so this is reserved for future entries rather than used by the shipped four. */
  gated?: boolean;
}

/** The four product surfaces (canon rule 19) — exactly these, nothing else. */
export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { id: 'surface-scanner', label: 'Scanner', to: '/scanner' },
  { id: 'surface-ticker', label: 'Ticker', to: '/ticker' },
  { id: 'surface-positions', label: 'Positions', to: '/positions' },
  { id: 'surface-alerts', label: 'Alerts', to: '/alerts' },
] as const;
