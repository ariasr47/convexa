/**
 * Chip navigation glue: uppercase → sync input → client route.
 * Same destination as submitting the ticker field (`/ticker/:ticker`).
 * Durable recents are recorded by TickerDashboard's route-param effect, not here.
 */
export function selectTickerSymbol(args: {
  symbol: string;
  navigate: (to: string) => void;
  setSymbol: (s: string) => void;
}): void {
  const s = args.symbol.trim().toUpperCase();
  if (!s) return;
  args.setSymbol(s);
  args.navigate(`/ticker/${s}`);
}
