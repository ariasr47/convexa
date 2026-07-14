/**
 * DealerFlowProjection — Suite A (component states, FRONTEND_EXECUTION_CONTRACT §5). Renders every
 * required state off the additive `dealer_flow_projection` shape and asserts the locked copy + the
 * binding invariants:
 *   - `[best-effort-isolated-or-null]`: per-limb + whole-object null render muted "unavailable this
 *     cycle" text, NEVER a fabricated 0 / date / horizon; limbs degrade independently.
 *   - `[live-vs-static-isolation]`: this widget carries NO `⏸ offline` caption in any state and takes
 *     no live/offline prop (its Props type has none) — proven end-to-end in the flow spec.
 *   - `[additive-keeps-score-byte-identical]` (honesty posture): no bull/bear/buy/sell/edge/score/tier
 *     framing in any rendered string.
 * The FE renders `illustrative_projected_delta` verbatim (never multiplies).
 */
import { ThemeProvider } from '@mui/material/styles';
import type { DealerFlowProjection as Dfp } from '@org/api';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { theme } from '../../../theme';
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

describe('DealerFlowProjection (component states — Suite A)', () => {
  // ---- T-AC-1 -------------------------------------------------------------------------------
  it('T-AC-1: renders in the static family (Widget id/testid dealer-flow-projection) with both limbs, no offline chip', () => {
    renderDfp(dfp());
    // The static-family Widget shell (its testid is `widget-${id}`) + the body testid.
    expect(screen.getByTestId('widget-dealer-flow-projection')).toBeInTheDocument();
    expect(screen.getByTestId('dealer-flow-projection')).toBeInTheDocument();
    // Both limbs present.
    expect(screen.getByTestId('dfp-charm')).toBeInTheDocument();
    expect(screen.getByTestId('dfp-vanna')).toBeInTheDocument();
    // Static frame subtitle + never the live-tile `⏸ offline` caption.
    expect(
      screen.getByText('Snapshot, never live — refreshes with the data load, not the stream.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/⏸/)).toBeNull();
  });

  // ---- T-AC-2 -------------------------------------------------------------------------------
  it('T-AC-2: charm shows drift + horizon_days + opex_date TOGETHER in one block', () => {
    renderDfp(dfp());
    const charmBlock = screen.getByTestId('dfp-charm');
    // Drift figure (fmtUsdCompact of 4.2M).
    expect(within(charmBlock).getByText('+$4.2M delta drift')).toBeInTheDocument();
    // Horizon: human OPEX date AND the day count together in one line.
    expect(within(charmBlock).getByText('to Fri Jul 17 (11 days)')).toBeInTheDocument();
  });

  // ---- T-AC-3 -------------------------------------------------------------------------------
  it('T-AC-3: charm per-day base line renders alongside the drift', () => {
    renderDfp(dfp());
    const charmBlock = screen.getByTestId('dfp-charm');
    expect(within(charmBlock).getByText('base +$380.0K / day')).toBeInTheDocument();
    // drift is still present in the same block (alongside).
    expect(within(charmBlock).getByText('+$4.2M delta drift')).toBeInTheDocument();
  });

  // ---- T-AC-4 -------------------------------------------------------------------------------
  it('T-AC-4: vanna shows BOTH +1 IV pt AND +5 IV pt (illus.), each labeled with its move; +5 rendered verbatim', () => {
    // Use a +5 figure that is NOT 5× the +1 figure to prove the FE renders the wire value directly.
    renderDfp(
      dfp({
        vanna: vanna({ projected_delta: 1_850_000, illustrative_projected_delta: 9_250_000 }),
      }),
    );
    const vannaBlock = screen.getByTestId('dfp-vanna');
    expect(within(vannaBlock).getByText('+$1.9M on +1 IV pt')).toBeInTheDocument();
    expect(within(vannaBlock).getByText('+$9.3M on +5 IV pt (illus.)')).toBeInTheDocument();
    // The two figures are unambiguously distinct queryable elements.
    expect(screen.getByTestId('dfp-vanna-base')).not.toBe(screen.getByTestId('dfp-vanna-illus'));
  });

  it('T-AC-4b: illustrative figure is the WIRE value, never a client multiplication of the base', () => {
    // Base +$1.0M, illustrative +$3.0M (deliberately NOT 5× base). The FE must print +$3.0M as-is.
    renderDfp(
      dfp({
        vanna: vanna({ projected_delta: 1_000_000, illustrative_projected_delta: 3_000_000 }),
      }),
    );
    expect(screen.getByText('+$3.0M on +5 IV pt (illus.)')).toBeInTheDocument();
    expect(screen.queryByText('+$5.0M on +5 IV pt (illus.)')).toBeNull(); // NOT 5× the base
  });

  // ---- T-AC-5 -------------------------------------------------------------------------------
  it('T-AC-5: the reference-direction + negation line is present; NO second/decrease numeric figure', () => {
    renderDfp(dfp());
    expect(screen.getByText('+ = vol up · a vol drop flips the sign')).toBeInTheDocument();
    // Exactly two dollar figures in the vanna area (the +1 and the +5) — no third "decrease" number.
    const vannaBlock = screen.getByTestId('dfp-vanna');
    const dollarFigures = within(vannaBlock).getAllByText(/\$[\d.]+[BMK]?/);
    expect(dollarFigures).toHaveLength(2);
  });

  // ---- T-AC-6 -------------------------------------------------------------------------------
  it('T-AC-6: the assumptions footer is present WITH the read — each clause asserted', () => {
    renderDfp(dfp());
    // Horizon (days + date on charm).
    expect(screen.getByText('to Fri Jul 17 (11 days)')).toBeInTheDocument();
    // Vanna move sizes + direction.
    expect(screen.getByText('+$1.9M on +1 IV pt')).toBeInTheDocument();
    expect(screen.getByText('+$9.3M on +5 IV pt (illus.)')).toBeInTheDocument();
    expect(screen.getByText('+ = vol up · a vol drop flips the sign')).toBeInTheDocument();
    // Linear/first-order wording + spot basis (spot_basis).
    expect(
      screen.getByText('Linear first-order projection at spot $178.4, holding spot & vol.'),
    ).toBeInTheDocument();
    // Honesty frame line — verbatim.
    expect(
      screen.getByText(
        'Dealer-flow context — not a price forecast, not a scored signal, not a guarantee.',
      ),
    ).toBeInTheDocument();
  });

  // ---- T-AC-9 (Charm-only) ------------------------------------------------------------------
  it('T-AC-9: charm-only (vanna null) — charm populated; "Vanna unavailable this cycle."; NO $0/0 in vanna; footer + charm intact', () => {
    renderDfp(dfp({ vanna: null }));
    // Charm populated.
    expect(screen.getByText('+$4.2M delta drift')).toBeInTheDocument();
    // Vanna is the muted empty text.
    expect(screen.getByText('Vanna unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByTestId('dfp-vanna')).toBeNull();
    // NO fabricated 0 anywhere.
    expect(screen.queryByText(/\$0\b/)).toBeNull();
    expect(screen.queryByText(/on \+1 IV pt/)).toBeNull();
    // Footer still present (spot basis + honesty frame).
    expect(screen.getByTestId('dfp-footer')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Dealer-flow context — not a price forecast, not a scored signal, not a guarantee.',
      ),
    ).toBeInTheDocument();
  });

  // ---- T-AC-10 (Vanna-only) -----------------------------------------------------------------
  it('T-AC-10: vanna-only (charm null) — vanna populated; "Charm unavailable this cycle."; NO 0/fabricated date/horizon in charm', () => {
    renderDfp(dfp({ charm: null }));
    // Vanna populated (both figures + negation).
    expect(screen.getByText('+$1.9M on +1 IV pt')).toBeInTheDocument();
    expect(screen.getByText('+$9.3M on +5 IV pt (illus.)')).toBeInTheDocument();
    // Charm is the muted empty text.
    expect(screen.getByText('Charm unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByTestId('dfp-charm')).toBeNull();
    // NO fabricated 0, date, or horizon.
    expect(screen.queryByText(/\$0\b/)).toBeNull();
    expect(screen.queryByText(/delta drift/)).toBeNull();
    expect(screen.queryByText(/\d+ days?\)/)).toBeNull(); // no fabricated horizon line
    expect(screen.getByTestId('dfp-footer')).toBeInTheDocument();
  });

  // ---- T-AC-10b (Whole-read null) -----------------------------------------------------------
  it('T-AC-10b: whole-read null — single "Projected dealer flow unavailable this cycle."; NO 0; no thrown error', () => {
    // Rendering with dfp=null must not throw / trip an error boundary.
    expect(() => renderDfp(null)).not.toThrow();
    expect(screen.getByText('Projected dealer flow unavailable this cycle.')).toBeInTheDocument();
    // The shell is still there (header renders).
    expect(screen.getByTestId('widget-dealer-flow-projection')).toBeInTheDocument();
    // No limbs, no footer, no fabricated 0.
    expect(screen.queryByTestId('dfp-charm')).toBeNull();
    expect(screen.queryByTestId('dfp-vanna')).toBeNull();
    expect(screen.queryByTestId('dfp-footer')).toBeNull();
    expect(screen.queryByText(/\$0\b/)).toBeNull();
  });

  // ---- T-E2 (LOADING ≠ EMPTY ≠ OFFLINE) -----------------------------------------------------
  it('T-E2: the resolved-null muted text is NOT a cold-load skeleton, and NO ⏸/offline caption ever appears', () => {
    renderDfp(null);
    // EMPTY = muted text element (not a skeleton).
    const empty = screen.getByTestId('dfp-whole-empty');
    expect(empty).toBeInTheDocument();
    expect(empty.querySelector('[role="progressbar"]')).toBeNull();
    // No skeleton class (cold-load look) inside this widget.
    expect(screen.queryByTestId('cold-skeleton')).toBeNull();
    // OFFLINE is N/A for this widget in every state.
    expect(screen.queryByText(/⏸/)).toBeNull();
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it('T-E2b: no ⏸ / offline caption appears in the DEFAULT or partial states either', () => {
    for (const v of [dfp(), dfp({ vanna: null }), dfp({ charm: null })]) {
      const { unmount } = renderDfp(v);
      expect(screen.queryByText(/⏸/)).toBeNull();
      expect(screen.queryByText(/offline/i)).toBeNull();
      unmount();
    }
  });

  // ---- T-E4 (no bias / scoring framing) -----------------------------------------------------
  it('T-E4: no rendered string carries bias/scoring framing across default + partials (honesty posture)', () => {
    const BANNED = /\b(bull(ish)?|bear(ish)?|buy|sell|edge|smart money|opportunity tier)\b/i;
    for (const v of [dfp(), dfp({ vanna: null }), dfp({ charm: null }), null]) {
      const { container, unmount } = renderDfp(v);
      // The rendered widget text carries no bias/scoring framing.
      expect(container.textContent ?? '').not.toMatch(BANNED);
      // "score"/"tier" only ever appear inside the fixed honesty-frame phrase "not a scored signal".
      const text = container.textContent ?? '';
      const scoreHits = text.match(/scored?/gi) ?? [];
      if (scoreHits.length) expect(text).toContain('not a scored signal');
      unmount();
    }
  });
});
