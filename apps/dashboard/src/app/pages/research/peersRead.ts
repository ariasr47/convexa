/**
 * The words and state of the Peers section (design: Planned · Peers, PEERS_SPEC). Pure, so the rules
 * are pinned by a spec: a comparison needs four peers with the figure, peers that haven't filed are
 * named (never dropped), and the claim ranks the note's company only over figures it has.
 */
import type { PublicTicker } from '@convexa/api';

export type PublicPeers = NonNullable<PublicTicker['peers']>;
export type PublicPeerRow = PublicPeers['rows'][number];

/** `CY2026Q2` → `CY2026 Q2`. */
export const quarterLabel = (q: string | null | undefined) =>
  q ? q.replace(/^CY(\d{4})Q(\d)$/, 'CY$1 Q$2') : 'the latest quarter';

export type PeersView =
  | { kind: 'hidden' }
  | { kind: 'notSetUp' }
  | { kind: 'unavailable'; cause: string }
  | { kind: 'empty'; cause: string }
  | { kind: 'ready'; missing: string[]; stale: boolean };

export function peersView(
  d: Pick<PublicTicker, 'state' | 'ticker'> & { peers?: PublicPeers | null },
): PeersView {
  const p = d.peers;
  if (d.state === 'off' || p == null) return { kind: 'hidden' };
  if (p.state === 'not_configured') return { kind: 'notSetUp' };
  if (p.state === 'off') return { kind: 'hidden' };
  if (p.state === 'unavailable')
    return { kind: 'unavailable', cause: p.detail ?? 'The SEC’s frames request failed.' };
  const filed = (p.rows ?? []).filter((r) => !r.subject).length;
  const subject = (p.rows ?? []).some((r) => r.subject);
  const min = p.min_peers ?? 4;
  if (!subject)
    return {
      kind: 'empty',
      cause:
        p.detail ??
        `${d.ticker} has no quarter in the SEC’s frames for ${quarterLabel(p.quarter)}: not filed yet, or a foreign filer.`,
    };
  if (filed < min)
    return {
      kind: 'empty',
      cause: `A peer comparison needs at least ${min} filers with the figure for the same calendar quarter; ${filed === 0 ? 'none has' : filed === 1 ? 'one has' : `${filed} have`} filed for ${quarterLabel(p.quarter)}.`,
    };
  return {
    kind: 'ready',
    missing: [...(p.missing ?? []), ...(p.unknown ?? [])],
    stale: p.source_state === 'last_good',
  };
}

/** Rank among the companies with the figure, highest first (1 = highest). */
function rankOf(rows: PublicPeerRow[], pick: (r: PublicPeerRow) => number | null | undefined) {
  const withValue = rows.filter((r) => pick(r) != null);
  const sorted = [...withValue].sort((a, b) => (pick(b) ?? 0) - (pick(a) ?? 0));
  const at = sorted.findIndex((r) => r.subject);
  return { rank: at + 1, of: sorted.length, top: sorted[0] };
}

const ORDINAL = [
  '',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];
const ordinal = (n: number) => ORDINAL[n] ?? `${n}th`;
const pct = (v: number) =>
  `${v > 0 ? '' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`;

/** The frame's title over data: where the company ranks on growth and on gross margin. */
export function peersFinding(p: PublicPeers, ticker: string, demo: boolean): string {
  const rows = p.rows ?? [];
  const me = rows.find((r) => r.subject);
  if (!me) return `${ticker} against its peers`;
  const g = rankOf(rows, (r) => r.growth_pct);
  const m = rankOf(rows, (r) => r.gross_margin_pct);
  const lead = demo ? 'In the sample, ' : '';
  const growth =
    me.growth_pct == null
      ? `${ticker} tags no year-earlier quarter to grow from`
      : g.rank === 1
        ? `${ticker} grew fastest of ${g.of}, ${pct(me.growth_pct)} on a year`
        : `${ticker} ranks ${ordinal(g.rank)} of ${g.of} on growth, ${pct(me.growth_pct)} on a year`;
  const margin =
    me.gross_margin_pct == null
      ? 'it tags no gross profit'
      : m.rank === 1
        ? `on gross margin it leads, at ${pct(me.gross_margin_pct)}`
        : `on gross margin it ranks ${ordinal(m.rank)}, behind ${m.top.ticker}`;
  return `${lead}${growth}; ${margin}`;
}
