/**
 * DealerFlowProjection — RISK-BASED widget spec (qa-verify.md §4, 2026-07-13). The page-level contract
 * (whole-null matrix, basis-rides-with-value presence, stream isolation) lives in
 * `pages/ticker/ticker.risk.spec.tsx`; this spec keeps ONLY the widget's own invariants where a silent
 * regression is plausible AND invisible:
 *   1. PARTIAL-object null tolerance (`best-effort-isolated-or-null`) — charm and vanna degrade
 *      INDEPENDENTLY to their pinned copy (imported from `_kit/copy`), the surviving limb + footer
 *      stay intact, nothing fabricates a $0 / horizon / date, and a whole-null render never throws.
 *   2. The +5 IV-pt illustrative figure is the WIRE value, never a client-side base×5 — a "simplifying"
 *      refactor to multiplication would render plausible numbers a reviewer cannot catch.
 * NOT asserted (visible + intentional → review): titles/subtitle/footer/negation wording, tooltip
 * copy, banned-language scans, offline-caption scans (page-level byte-identity covers live coupling).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { DealerFlowProjection as Dfp } from '@org/api';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CHARM_EMPTY, DFP_WHOLE_EMPTY, VANNA_EMPTY } from '../_kit/copy';
import { DealerFlowProjection } from './DealerFlowProjection';

const charm = (over: Partial<NonNullable<Dfp['charm']>> = {}): NonNullable<Dfp['charm']> => ({
  projected_delta: 4_200_000,
  per_day_base: 380_000,
  horizon_days: 11,
  opex_date: '2026-07-17',
  ...over,
});
const vanna = (over: Partial<NonNullable<Dfp['vanna']>> = {}): NonNullable<Dfp['vanna']> => ({
  projected_delta: 1_850_000,
  move_iv_points: 1.0,
  illustrative_move_iv_points: 5.0,
  illustrative_projected_delta: 9_250_000,
  reference_direction: 'increase',
  ...over,
});
const dfp = (over: Partial<Dfp> = {}): Dfp => ({
  spot_basis: 178.4,
  charm: charm(),
  vanna: vanna(),
  ...over,
});

function renderDfp(value: Dfp | null) {
  return render(
    <ThemeProvider theme={theme}>
      <DealerFlowProjection dfp={value} />
    </ThemeProvider>,
  );
}

describe('DealerFlowProjection · independent limb degradation', () => {
  it('vanna=null → charm + footer intact, pinned vanna copy, NO fabricated $0 or +1-IV figure', () => {
    renderDfp(dfp({ vanna: null }));
    expect(screen.getByText(VANNA_EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId('dfp-vanna')).toBeNull();
    expect(screen.getByText('+$4.2M delta drift')).toBeInTheDocument(); // charm survives
    expect(screen.getByTestId('dfp-footer')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\b/)).toBeNull();
    expect(screen.queryByText(/on \+1 IV pt/)).toBeNull();
  });

  it('charm=null → vanna + footer intact, pinned charm copy, NO fabricated horizon/date/$0', () => {
    renderDfp(dfp({ charm: null }));
    expect(screen.getByText(CHARM_EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId('dfp-charm')).toBeNull();
    expect(screen.getByText('+$1.9M on +1 IV pt')).toBeInTheDocument(); // vanna survives
    expect(screen.getByTestId('dfp-footer')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\b/)).toBeNull();
    expect(screen.queryByText(/delta drift/)).toBeNull();
    expect(screen.queryByText(/\d+ days?\)/)).toBeNull(); // no invented horizon line
  });

  it('whole-read null → the single pinned empty line, no limbs/footer, no $0, no thrown render', () => {
    expect(() => renderDfp(null)).not.toThrow();
    expect(screen.getByText(DFP_WHOLE_EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId('dfp-charm')).toBeNull();
    expect(screen.queryByTestId('dfp-vanna')).toBeNull();
    expect(screen.queryByTestId('dfp-footer')).toBeNull();
    expect(screen.queryByText(/\$0\b/)).toBeNull();
  });
});

describe('DealerFlowProjection · illustrative figure is wire-verbatim', () => {
  it('renders the wire +5 IV-pt value, never base×5 (fixture deliberately NOT 5× the base)', () => {
    renderDfp(
      dfp({
        vanna: vanna({ projected_delta: 1_000_000, illustrative_projected_delta: 3_000_000 }),
      }),
    );
    const vannaBlock = screen.getByTestId('dfp-vanna');
    expect(within(vannaBlock).getByText('+$1.0M on +1 IV pt')).toBeInTheDocument();
    expect(within(vannaBlock).getByText('+$3.0M on +5 IV pt (illus.)')).toBeInTheDocument();
    expect(screen.queryByText('+$5.0M on +5 IV pt (illus.)')).toBeNull(); // NOT 5× the base
  });
});
