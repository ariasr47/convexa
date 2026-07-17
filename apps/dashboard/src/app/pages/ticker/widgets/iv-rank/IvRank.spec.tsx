/**
 * IvRank — RISK-BASED widget spec (qa-verify.md §4, 2026-07-13). The page-level contract (whole-null
 * matrix, wire-band-beats-rank authority, basis-rides-with-value presence) lives in
 * `pages/ticker/ticker.risk.spec.tsx`; this spec keeps ONLY the widget's own state machine, where a
 * silent regression is plausible AND invisible:
 *   1. Building never fabricates — no rank/percentile/band number, not even a placeholder — and stays
 *      DISTINCT from Unavailable (the two honest-empty states must not collapse into one).
 *   2. Degenerate-flat never fabricates a rank midpoint (the classic silent "50") and drops the band,
 *      while the percentile limb + its basis still render (partial isolation).
 *   3. Fail-honest on unknown wire values — an unknown `state` degrades to Unavailable without
 *      throwing; an unknown `band` renders NO token (never raw pass-through) with the rest intact.
 *   4. The wire descriptors are never rendered — sentinel by construction, across all states.
 * NOT asserted (visible + intentional → review): headline/descriptor/basis/advisory wording, band
 * label wording (closure unit-tested in `../_kit/copy.spec.ts`), auth/chart/theme source scans.
 */
import { ThemeProvider } from '@mui/material/styles';
import type { IvRankRead } from '@org/api';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { theme } from '@/shared/theme/theme';
import { IvRank } from './IvRank';
import { IVR_WHOLE_EMPTY } from '../_kit/copy';

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

function renderIvr(value: IvRankRead | null) {
  return render(
    <ThemeProvider theme={theme}>
      <IvRank read={value} />
    </ThemeProvider>,
  );
}

describe('IvRank · state machine honesty', () => {
  it('Building fabricates NOTHING (no rank/percentile/band, no placeholder) and is distinct from Unavailable', () => {
    const b = renderIvr(building());
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
    expect(screen.queryByTestId('ivr-rank-slot')).toBeNull();
    expect(screen.queryByTestId('ivr-pct-value')).toBeNull();
    expect(screen.queryByTestId('ivr-pct-slot')).toBeNull();
    expect(screen.queryByTestId('ivr-band')).toBeNull();
    const buildingText = screen.getByTestId('iv-rank').textContent ?? '';
    b.unmount();

    // Unavailable is a DIFFERENT body — the two honest-empty states never collapse into one.
    expect(() => renderIvr(null)).not.toThrow();
    expect(screen.getByTestId('ivr-whole-empty')).toHaveTextContent(IVR_WHOLE_EMPTY);
    expect((screen.getByTestId('iv-rank').textContent ?? '')).not.toBe(buildingText);
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
  });

  it('Degenerate-flat: no fabricated rank midpoint, no band — the percentile limb + basis still render', () => {
    renderIvr(flat());
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
    expect(screen.queryByText('50')).toBeNull(); // never an invented midpoint
    expect(screen.queryByTestId('ivr-band')).toBeNull();
    // Partial isolation: the percentile + its self-description survive the degraded rank.
    expect(screen.getByTestId('ivr-pct-value')).toHaveTextContent('74');
    expect(screen.getByTestId('ivr-basis')).toBeInTheDocument();
  });

  it('fail-honest on unknown wire values: unknown state → Unavailable (no throw); unknown band → no token, raw never rendered', () => {
    const s = renderIvr(computed({ state: 'weird' as IvRankRead['state'] }));
    expect(screen.getByTestId('ivr-whole-empty')).toHaveTextContent(IVR_WHOLE_EMPTY);
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
    s.unmount();

    renderIvr(computed({ band: 'wat' as IvRankRead['band'] }));
    expect(screen.queryByTestId('ivr-band')).toBeNull();
    expect(screen.queryByText('wat')).toBeNull();
    expect(screen.getByTestId('ivr-rank-value')).toHaveTextContent('82'); // the rest stays intact
  });

  it('the wire window/basis/advisory descriptor strings never reach the DOM (any state)', () => {
    for (const v of [computed(), building(), flat()]) {
      const { container, unmount } = renderIvr(v);
      expect(container.textContent ?? '').not.toContain(WIRE_DESC);
      unmount();
    }
  });
});
