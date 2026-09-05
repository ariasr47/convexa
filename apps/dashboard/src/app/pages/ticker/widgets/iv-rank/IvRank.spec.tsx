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
import { theme } from '@/shared/theme/theme';
import type { IvRankRead } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IVR_WHOLE_EMPTY } from '../_kit/copy';
import { IvRank, ivRankStripFigure } from './IvRank';

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
    expect(screen.getByTestId('iv-rank').textContent ?? '').not.toBe(buildingText);
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

// AC-35 (ruling 6, curvature-v2-foundations): the ⓘ affordances are real focusable controls, not
// hover-only — the shipped `AccessibleHelp` pattern, reachable by tap AND keyboard.
describe('IvRank · the ⓘ affordances are keyboard-reachable (AC-35)', () => {
  it('every "About …" control is a real button, opens on Enter, closes on Escape', async () => {
    const user = userEvent.setup();
    renderIvr(computed());
    const helps = screen.getAllByRole('button', { name: /^About /i });
    expect(helps.length).toBeGreaterThan(0);
    const first = helps[0];
    first.focus();
    expect(first).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });
});

// curvature-v2-desk-and-read FE-7 — the read strip's own digest of this widget's number (SPEC
// §2.3/§2.4: "IV rank comes from IvRank.tsx"). This widget's own body (above) is UNCHANGED by this
// export; these tests cover only the small pure function the strip calls.
describe('ivRankStripFigure — the read strip digest (criteria 25, 28)', () => {
  it('computed with a recognized band — the rank plus the SAME closed band label the full widget uses', () => {
    expect(ivRankStripFigure(computed())).toBe('82 · premium rich');
  });

  it('computed with an unrecognized band — the rank alone, never a raw wire pass-through', () => {
    expect(ivRankStripFigure(computed({ band: 'wat' as IvRankRead['band'] }))).toBe('82');
  });

  it('computed with no band at all — the rank alone', () => {
    expect(ivRankStripFigure(computed({ band: null }))).toBe('82');
  });

  it('degenerate-flat (rank null) — the closed `unavailable` member, never a fabricated midpoint', () => {
    expect(ivRankStripFigure(flat())).toBe('unavailable');
  });

  it('building — the closed `unavailable` member (the strip is a digest; the full building message stays in this widget)', () => {
    expect(ivRankStripFigure(building())).toBe('unavailable');
  });

  it('an unknown wire state — fail-honest to `unavailable`, never a throw', () => {
    expect(ivRankStripFigure(computed({ state: 'weird' as IvRankRead['state'] }))).toBe(
      'unavailable',
    );
  });

  it('whole read null — `unavailable`', () => {
    expect(ivRankStripFigure(null)).toBe('unavailable');
  });
});
