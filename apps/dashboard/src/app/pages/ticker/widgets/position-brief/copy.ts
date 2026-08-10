/**
 * Position brief (product spine #5) — closed copy for the ticker "your book" strip.
 * Sim-only; never implies a real order path.
 */
export const BRIEF_COPY = {
  /** Overline — names the book basis (sim) up front. */
  overline: 'Your book · simulated',
  /** Empty state — honest absence, not a failure. */
  empty: (symbol: string) => `No open sim position on ${symbol}.`,
  emptyCta: 'Open simulated trade',
  openBook: 'Open book',
  /** Multi-position: never pick one of N as “the” position. */
  multi: (n: number, symbol: string) =>
    `${n} open sim positions on ${symbol} — open the book for the full read.`,
  /** Mark unavailable this cycle (partial structure / missing leg). */
  plUnavailable: 'P/L unavailable this cycle',
  /** Store fault — never claim the book is empty when we cannot read it. */
  faulted: "Couldn't read the sim book this session — nothing was deleted.",
  simulatedTip:
    'A paper trade — no broker, no real money, no real order is ever placed.',
} as const;
