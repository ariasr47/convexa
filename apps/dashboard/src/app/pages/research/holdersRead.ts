/**
 * The words the Fund holdings (13F) section says over its data (design: Planned · Fund holdings,
 * HOLDERS_SPEC). Pure, so the claims are pinned by a spec: a change in points is never called buying
 * when it is a cut, and a section with nothing to draw never claims a finding.
 */
import type { PublicTicker } from '@convexa/api';

export type PublicHolders = NonNullable<PublicTicker['holders']>;
export type PublicHolder = PublicHolders['holders'][number];

const one = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** ▲ 0.4 / ▼ 0.1 / ± 0.0: the change in points, the sign in the glyph and the position, never hue. */
export function changeText(pts: number | null | undefined): string {
  if (pts == null) return 'new';
  const rounded = Math.round(pts * 10) / 10;
  return `${rounded > 0 ? '▲' : rounded < 0 ? '▼' : '±'} ${one(Math.abs(rounded))}`;
}

/** Shares or receipts, compact: 1,009.8M. */
export function heldText(n: number): string {
  if (n >= 1e9) return `${one(n / 1e9)}B`;
  if (n >= 1e6) return `${one(n / 1e6)}M`;
  return Math.round(n).toLocaleString('en-US');
}

/** The frame's title over data (P-10): the two largest holders and the biggest change. */
export function holdersFinding(h: PublicHolders, ticker: string, demo: boolean): string {
  const rows = h.holders ?? [];
  const lead = demo ? 'In the sample, the' : 'The';
  if (h.units === 'receipts' || rows.some((r) => r.pct == null)) {
    const top = rows[0];
    return `${demo ? 'In the sample, ' : ''}${top.manager} holds the most ${ticker} ${h.units === 'receipts' ? 'depositary receipts' : 'shares'} among the managers read: ${heldText(top.shares)}`;
  }
  const two = rows.slice(0, 2).reduce((s, r) => s + (r.pct ?? 0), 0);
  const moves = rows.filter((r) => r.change_pts != null && Math.round(r.change_pts * 10) !== 0);
  const biggest = moves.reduce<PublicHolder | null>(
    (a, r) => (a && Math.abs(a.change_pts ?? 0) >= Math.abs(r.change_pts ?? 0) ? a : r),
    null,
  );
  const largest =
    rows.length >= 2 ? `two largest holders own ${one(two)}%` : `largest holder owns ${one(two)}%`;
  const change = biggest
    ? `; the biggest change was ${biggest.manager} ${(biggest.change_pts ?? 0) > 0 ? 'adding' : 'cutting'} ${one(Math.abs(biggest.change_pts ?? 0))} points`
    : '; none of them moved by a tenth of a point';
  return `${lead} ${largest} of ${ticker}${change}`;
}

export type HoldersView =
  | { kind: 'hidden' }
  | { kind: 'notSetUp' }
  | { kind: 'unavailable'; cause: string }
  | { kind: 'empty'; cause: string }
  | { kind: 'ready'; stale: boolean };

/** Which state the section is in. `holders` absent: a server from before the section existed. */
export function holdersView(
  d: Pick<PublicTicker, 'state'> & { holders?: PublicHolders | null },
): HoldersView {
  const h = d.holders;
  if (d.state === 'off' || h == null) return { kind: 'hidden' };
  if (h.state === 'not_configured') return { kind: 'notSetUp' };
  if (h.state === 'off') return { kind: 'hidden' };
  if (h.state === 'unavailable')
    return { kind: 'unavailable', cause: h.detail ?? 'SEC EDGAR didn’t answer.' };
  if (!h.holders?.length)
    return { kind: 'empty', cause: h.detail ?? 'No manager read reports this security.' };
  return { kind: 'ready', stale: h.source_state === 'last_good' };
}
