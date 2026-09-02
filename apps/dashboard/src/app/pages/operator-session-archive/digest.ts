/** Count-only projection of a load body — raw arrays never leave this surface. */

export type DigestProjection = {
  symbol: string;
  et_date: string;
  source_as_of: string;
  source: string;
  authorizes: string;
  framing: string;
  provenance: string;
  license: string;
  contractsCount: number;
  dailyBarsCount: number;
  minutesCount: number;
  tradesCount: number;
};

type LoadBodyLike = {
  symbol: string;
  et_date: string;
  source_as_of: string;
  source: string;
  authorizes: string;
  framing: string;
  provenance: string;
  license: string;
  market?: { contracts?: unknown[] } | null;
  daily_bars?: unknown[] | null;
  minutes?: unknown[] | null;
  trades?: unknown[] | null;
};

export function projectDigest(body: LoadBodyLike): DigestProjection {
  return {
    symbol: body.symbol,
    et_date: body.et_date,
    source_as_of: body.source_as_of,
    source: body.source,
    authorizes: body.authorizes,
    framing: body.framing,
    provenance: body.provenance,
    license: body.license,
    contractsCount: Array.isArray(body.market?.contracts) ? body.market.contracts.length : 0,
    dailyBarsCount: Array.isArray(body.daily_bars) ? body.daily_bars.length : 0,
    minutesCount: Array.isArray(body.minutes) ? body.minutes.length : 0,
    tradesCount: Array.isArray(body.trades) ? body.trades.length : 0,
  };
}
