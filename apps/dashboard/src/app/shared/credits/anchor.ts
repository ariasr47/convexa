/**
 * Which /credits card a provenance chip's text names. Every chip on the site that names a source
 * links to that source's card (/credits#finra-si), from one place: the chip components call this,
 * so no page wires its own links. The anchors are the card ids on /credits (pages/trust/sources.ts)
 * and the `id`s of the API's `sources` rows.
 *
 * Design: design/src/screens/final/trust.mjs (credits row: deep links).
 */
export type CreditsAnchor =
  | 'treasury'
  | 'cftc'
  | 'fed-h41'
  | 'treasury-dts'
  | 'nyfed-rrp'
  | 'schedules'
  | 'finra-si'
  | 'finra-shvol'
  | 'sec'
  | 'tradingview'
  | 'massive';

/** First match wins: the more specific names come before "Treasury". */
const RULES: readonly (readonly [RegExp, CreditsAnchor])[] = [
  [/TradingView/i, 'tradingview'],
  [/Massive/i, 'massive'],
  // The calendar's chip names four agencies and SEC EDGAR; its card is the schedules one.
  [/schedules?\b|\bBLS\b|\bBEA\b|FOMC calendar/i, 'schedules'],
  [/Reg SHO|short-sale volume/i, 'finra-shvol'],
  [/short interest/i, 'finra-si'],
  [/CFTC/i, 'cftc'],
  [/\bSEC\b|EDGAR|Form 4/i, 'sec'],
  [/H\.4\.1/i, 'fed-h41'],
  [/\bDTS\b|Daily Treasury Statement/i, 'treasury-dts'],
  [/reverse repo/i, 'nyfed-rrp'],
  [/Treasury/i, 'treasury'],
];

/** The card a chip's text names, or null (a demo label, Convexa's own notes). */
export function creditsAnchor(text: string): CreditsAnchor | null {
  for (const [pattern, anchor] of RULES) if (pattern.test(text)) return anchor;
  return null;
}

export const creditsHref = (anchor: CreditsAnchor) => `/credits#${anchor}`;
