/**
 * IvRank — the read strip's digest of the IV-rank read (curvature-v2-desk-and-read FE-7, SPEC
 * §2.3/§2.4: "IV rank comes from IvRank.tsx"). The `IvRank` widget itself no longer mounts on
 * `/ticker` (owner ruling `context-band-is-the-designs-card-list`); only `ivRankStripFigure` is live
 * (`readStripModel.ts`), so this spec covers that pure function alone:
 *   - a computed read renders the rank plus the closed band label, and the label is the WIRE band via
 *     the closed lookup, never re-derived from the rank (`digested-labels-not-raw-dump`);
 *   - an unknown band renders no token (never a raw pass-through);
 *   - building, degenerate-flat, an unknown state and a null read all digest to the closed
 *     `unavailable` member — never a fabricated midpoint, never a throw.
 */
import type { IvRankRead } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { ivRankStripFigure } from './IvRank';

// The wire `*_descriptor`/`advisory_note` strings carry a sentinel so any accidental render is caught.
const WIRE_DESC = 'WIRE-DESCRIPTOR-NEVER-RENDERED';

const computed = (over: Partial<IvRankRead> = {}): IvRankRead => ({
  state: 'computed',
  rank: 82,
  rank_unavailable_reason: null,
  percentile: 74,
  band: 'premium_rich',
  current_iv: 41.2,
  window_sessions: 130,
  sample_count: 130,
  window_cap: 252,
  min_samples: 20,
  iv_basis: 'interpolated_30d',
  basis_dte: 30,
  window_descriptor: WIRE_DESC,
  basis_descriptor: WIRE_DESC,
  advisory_note: WIRE_DESC,
  ...over,
});
const building = (over: Partial<IvRankRead> = {}): IvRankRead =>
  computed({
    state: 'building',
    rank: null,
    percentile: null,
    band: null,
    current_iv: 40.0,
    window_sessions: 12,
    sample_count: 12,
    ...over,
  });
const flat = (over: Partial<IvRankRead> = {}): IvRankRead =>
  computed({ rank: null, rank_unavailable_reason: 'flat_window', band: null, ...over });

describe('ivRankStripFigure — the read strip digest (criteria 25, 28)', () => {
  it('digests to the rank plus the wire band label, or to `unavailable` — never a midpoint, a raw band or a rank-derived band', () => {
    const rows: ReadonlyArray<readonly [string, IvRankRead | null, string]> = [
      ['computed, recognized band', computed(), '82 · premium rich'],
      // Rank 82 would derive "rich" under a naive rank-based mapping; the wire band must win.
      [
        'the wire band beats the rank',
        computed({ rank: 82, band: 'premium_cheap' }),
        '82 · premium cheap',
      ],
      ['computed, unrecognized band', computed({ band: 'wat' as IvRankRead['band'] }), '82'],
      ['computed, no band', computed({ band: null }), '82'],
      ['degenerate-flat (rank null)', flat(), 'unavailable'],
      ['building', building(), 'unavailable'],
      ['unknown wire state', computed({ state: 'weird' as IvRankRead['state'] }), 'unavailable'],
      ['whole read null', null, 'unavailable'],
    ];
    for (const [name, read, figure] of rows) {
      expect(ivRankStripFigure(read), name).toBe(figure);
    }
  });
});
