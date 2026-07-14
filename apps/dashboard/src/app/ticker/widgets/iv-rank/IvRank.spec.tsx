/**
 * IvRank — Suite A (component states + copy, iv-rank FRONTEND_EXECUTION_CONTRACT §5). Renders every
 * required body state off the additive `market_state.iv_rank` shape and asserts the locked copy + the
 * binding invariants:
 *   - `[best-effort-isolated-or-null]`: whole-read null / unknown state → ONE muted "IV rank
 *     unavailable this cycle." line — NEVER a fabricated midpoint / number / band.
 *   - `[live-vs-static-isolation]`: no `⏸ offline` caption in any state; no live/offline prop exists.
 *   - `model-read-carries-its-assumptions`: NEVER a bare number — the basis line + advisory framing sit
 *     in the SAME body whenever a rank/percentile renders.
 *   - `digested-labels-not-raw-dump`: ONE band token via the closed lookup (never re-derived from the
 *     rank); no series/list/table/chart import.
 *   - `theme-token-discipline` (dark/light parity, zero hardcoded hex, source-scanned via `?raw`).
 */
import { ThemeProvider } from '@mui/material/styles';
import type { IvRankRead } from '@org/api';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lightTheme, theme } from '@/shared/theme/theme';
import { IvRank } from './IvRank';
import ivrSource from './IvRank.tsx?raw';
import { IVR_ADVISORY, IVR_FLAT_NOTE, IVR_WHOLE_EMPTY, ivrBuildingMessage } from '../_kit/copy';

// The source with comments stripped — the doc header legitimately NAMES the forbidden props/hooks to
// STATE the invariant (mirrors MarketContext.spec's E-3); the scans target executable CODE only.
const ivrCode = ivrSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---- Fixtures (blueprint §5 anatomy, so the expected display strings are deterministic). The wire
// `*_descriptor`/`advisory_note` strings carry a sentinel so any accidental FE render is caught.
const WIRE_DESC = 'WIRE-DESCRIPTOR-NEVER-RENDERED';

/** Default / Computed: rank 82 / pct 74 / window 252 / sessions 130 / count 130 / interpolated_30d. */
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
/** Building: sample_count 12 / min_samples 20; no rank/percentile/band. */
const building = (over: Partial<IvRankRead> = {}): IvRankRead => ({
  state: 'building',
  rank: null,
  rank_unavailable_reason: null,
  percentile: null,
  band: null,
  current_iv: 40.0,
  window_sessions: 12,
  sample_count: 12,
  window_cap: 252,
  min_samples: 20,
  iv_basis: 'interpolated_30d',
  basis_dte: 30,
  window_descriptor: WIRE_DESC,
  basis_descriptor: WIRE_DESC,
  advisory_note: WIRE_DESC,
  ...over,
});
/** Degenerate-flat: state computed, rank null, flat reason, no band; percentile present. */
const flat = (over: Partial<IvRankRead> = {}): IvRankRead =>
  computed({
    rank: null,
    rank_unavailable_reason: 'flat_window',
    band: null,
    percentile: 74,
    ...over,
  });

function renderIvr(value: IvRankRead | null, t = theme) {
  return render(
    <ThemeProvider theme={t}>
      <IvRank read={value} />
    </ThemeProvider>,
  );
}

describe('IvRank (component states — Suite A)', () => {
  // ---- T-AC-1 -------------------------------------------------------------------------------
  it('T-AC-1: renders in the static family (widget-iv-rank shell + iv-rank body) with headline Rank, secondary Percentile, band token, basis line; no ⏸ offline caption', () => {
    renderIvr(computed());
    expect(screen.getByTestId('widget-iv-rank')).toBeInTheDocument();
    expect(screen.getByTestId('iv-rank')).toBeInTheDocument();
    expect(screen.getByTestId('ivr-rank-value')).toHaveTextContent('82');
    expect(screen.getByTestId('ivr-pct-value')).toHaveTextContent('74');
    expect(screen.getByTestId('ivr-band')).toHaveTextContent('premium rich');
    expect(screen.getByTestId('ivr-basis')).toBeInTheDocument();
    // Static frame subtitle + never the live-tile `⏸ offline` caption.
    expect(screen.queryByText(/⏸/)).toBeNull();
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  // ---- T-AC-3 (source-scan: no auth/gate/session) -------------------------------------------
  it('T-AC-3: the code contains NO auth/gate/session reference; renders with no gate wiring', () => {
    // Comment-stripped code (the `window_sessions`/`sample_count` wire fields legitimately contain the
    // substring "session"; the auth surface uses these specific identifiers).
    expect(ivrCode).not.toMatch(
      /useGate|simTradeGate|useSession|useAuth|SignInPrompt|AuthContext|gateAction/i,
    );
    // And it renders for an anonymous caller (no provider/gate context needed).
    expect(() => renderIvr(computed())).not.toThrow();
  });

  // ---- T-AC-4 (headline rank + descriptor) --------------------------------------------------
  it('T-AC-4: headline Rank 82 (0–100) + the pinned plain-language descriptor both render', () => {
    renderIvr(computed());
    expect(screen.getByTestId('ivr-rank-value')).toHaveTextContent('82');
    expect(screen.getByTestId('ivr-rank-descriptor')).toHaveTextContent(
      "Today's IV sits at the 82th position of its 252-session low-to-high range.",
    );
  });

  // ---- T-AC-5 (percentile in Computed AND degenerate-flat) ----------------------------------
  it('T-AC-5: secondary Percentile 74 + its descriptor render in Computed AND degenerate-flat', () => {
    for (const v of [computed(), flat()]) {
      const { unmount } = renderIvr(v);
      expect(screen.getByTestId('ivr-pct-value')).toHaveTextContent('74');
      expect(screen.getByTestId('ivr-pct-descriptor')).toHaveTextContent(
        '74% of sessions in the window had lower IV than today.',
      );
      unmount();
    }
  });

  // ---- T-AC-6 (band consistency — three fixtures, wire token trusted, one token) ------------
  it('T-AC-6: each rank/band fixture renders exactly ONE band token matching the wire enum (closed lookup, not recomputed)', () => {
    const cases: Array<[number, IvRankRead['band'], string]> = [
      [82, 'premium_rich', 'premium rich'],
      [50, 'neutral', 'neutral'],
      [18, 'premium_cheap', 'premium cheap'],
    ];
    for (const [rank, band, label] of cases) {
      const { unmount } = renderIvr(computed({ rank, band }));
      const tokens = screen.getAllByTestId('ivr-band');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toHaveTextContent(label);
      unmount();
    }
  });

  it('T-AC-6b: the FE TRUSTS the wire token — a rank of 18 with a wire band of premium_rich renders "premium rich" (never recomputed to cheap)', () => {
    // The wire pairing is deliberately inconsistent to prove the FE does not re-derive the band.
    renderIvr(computed({ rank: 18, band: 'premium_rich' }));
    expect(screen.getByTestId('ivr-band')).toHaveTextContent('premium rich');
    expect(screen.queryByText('premium cheap')).toBeNull();
  });

  it('T-AC-6c: an unknown band enum renders NO band token (fail-honest, never a raw pass-through)', () => {
    renderIvr(computed({ band: 'wat' as IvRankRead['band'] }));
    expect(screen.queryByTestId('ivr-band')).toBeNull();
    expect(screen.queryByText('wat')).toBeNull();
    // The rest of the computed body still renders.
    expect(screen.getByTestId('ivr-rank-value')).toHaveTextContent('82');
  });

  // ---- T-AC-7 (basis line — sessions + count + clean CM30 wording, no interaction) ----------
  it('T-AC-7: the basis line renders window_sessions + sample_count + clean-CM30 wording without interaction', () => {
    renderIvr(computed());
    expect(screen.getByTestId('ivr-basis')).toHaveTextContent(
      'Over 130 of the last 252 sessions · 130 samples · ~30-day constant-maturity IV.',
    );
  });

  // ---- T-AC-8 (advisory footer in Computed AND Building) ------------------------------------
  it('T-AC-8: the verbatim advisory footer renders in Computed AND Building', () => {
    for (const v of [computed(), building()]) {
      const { unmount } = renderIvr(v);
      expect(screen.getByTestId('ivr-footer')).toHaveTextContent(IVR_ADVISORY);
      unmount();
    }
  });

  // ---- T-AC-9 (no raw series in any state; source imports no chart/series) ------------------
  it('T-AC-9: no series/list/table/chart of daily IV renders; the source imports no chart/series component', () => {
    for (const v of [computed(), building(), flat(), null]) {
      const { container, unmount } = renderIvr(v);
      expect(container.querySelector('svg.recharts-surface')).toBeNull();
      expect(container.querySelector('table')).toBeNull();
      expect(container.querySelector('ul')).toBeNull();
      unmount();
    }
    expect(ivrSource).not.toMatch(/recharts|Sparkline|LineChart|ResponsiveContainer|Chart|Series/);
  });

  // ---- T-AC-10 (Building message with the actual count) ------------------------------------
  it('T-AC-10: Building renders "Building history — 12 of 20 sessions…" with the actual count', () => {
    renderIvr(building({ sample_count: 12, min_samples: 20 }));
    expect(screen.getByTestId('ivr-building-message')).toHaveTextContent(
      ivrBuildingMessage(12, 20),
    );
    expect(screen.getByTestId('ivr-building-message')).toHaveTextContent(
      'Building history — 12 of 20 sessions',
    );
  });

  // ---- T-AC-11 (Building: no rank, no percentile) ------------------------------------------
  it('T-AC-11: Building renders NO rank number and NO percentile number (not even a placeholder)', () => {
    renderIvr(building({ sample_count: 12, min_samples: 20 }));
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
    expect(screen.queryByTestId('ivr-rank-slot')).toBeNull();
    expect(screen.queryByTestId('ivr-pct-value')).toBeNull();
    expect(screen.queryByTestId('ivr-pct-slot')).toBeNull();
    expect(screen.queryByTestId('ivr-band')).toBeNull();
  });

  // ---- T-AC-12 (Building vs Unavailable contrast — distinct copy) --------------------------
  it('T-AC-12: the Building body and the Unavailable body are textually distinct (different copy)', () => {
    const b = renderIvr(building());
    const buildingText = screen.getByTestId('iv-rank').textContent ?? '';
    b.unmount();
    renderIvr(null);
    const unavailableText = screen.getByTestId('iv-rank').textContent ?? '';
    expect(buildingText).not.toBe(unavailableText);
    expect(buildingText).toContain('Building history');
    expect(unavailableText).toBe(IVR_WHOLE_EMPTY);
  });

  // ---- T-AC-13 (degenerate-flat: flat note in rank slot, no number, no band; pct + basis) ---
  it('T-AC-13: degenerate-flat renders the flat note in the rank slot, NO number there, NO band; Percentile + basis still render', () => {
    renderIvr(flat());
    expect(screen.getByTestId('ivr-flat-note')).toHaveTextContent(IVR_FLAT_NOTE);
    // No rank number in the rank slot (not even a fabricated midpoint like 50).
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
    expect(screen.queryByText('50')).toBeNull();
    // No band token.
    expect(screen.queryByTestId('ivr-band')).toBeNull();
    // Percentile + basis line still render.
    expect(screen.getByTestId('ivr-pct-value')).toHaveTextContent('74');
    expect(screen.getByTestId('ivr-basis')).toBeInTheDocument();
  });

  // ---- T-AC-14 (Unavailable — one muted line, no error/blank/footer) -----------------------
  it('T-AC-14: read == null → the single muted "IV rank unavailable this cycle." line; no error/blank/advisory footer', () => {
    expect(() => renderIvr(null)).not.toThrow();
    expect(screen.getByTestId('ivr-whole-empty')).toHaveTextContent(IVR_WHOLE_EMPTY);
    expect(screen.getByTestId('widget-iv-rank')).toBeInTheDocument();
    // No sub-content, no footer, no error, no fabricated number.
    expect(screen.queryByTestId('ivr-footer')).toBeNull();
    expect(screen.queryByTestId('ivr-rank-slot')).toBeNull();
    expect(screen.queryByTestId('ivr-building')).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('T-AC-14b: an unknown state degrades to the Unavailable body (fail-honest, no thrown render)', () => {
    expect(() => renderIvr(computed({ state: 'weird' as IvRankRead['state'] }))).not.toThrow();
    expect(screen.getByTestId('ivr-whole-empty')).toHaveTextContent(IVR_WHOLE_EMPTY);
    expect(screen.queryByTestId('ivr-rank-value')).toBeNull();
  });

  // ---- T-AC-18 (never a bare number — basis + advisory in the same body) -------------------
  it('T-AC-18: whenever a rank/number renders, the basis line + advisory framing are present in the SAME body (Computed + degenerate-flat)', () => {
    for (const v of [computed(), flat()]) {
      const { unmount } = renderIvr(v);
      const body = screen.getByTestId('iv-rank');
      // A number renders (rank 82 in computed; percentile 74 in both) …
      expect(within(body).getByTestId('ivr-pct-value')).toBeInTheDocument();
      // … and the basis line + advisory footer are in that same body.
      expect(within(body).getByTestId('ivr-basis')).toBeInTheDocument();
      expect(within(body).getByTestId('ivr-footer')).toHaveTextContent(IVR_ADVISORY);
      unmount();
    }
  });

  // ---- T-AC-19 (fallback basis wording incl. the actual DTE) --------------------------------
  it('T-AC-19: iv_basis == nearest_tenor renders the fallback basis wording incl. ~23d, distinct from the clean-CM30 wording', () => {
    renderIvr(computed({ iv_basis: 'nearest_tenor', basis_dte: 23 }));
    expect(screen.getByTestId('ivr-basis')).toHaveTextContent(
      'Over 130 of the last 252 sessions · 130 samples · nearest-tenor IV (~23d) — clean 30-day basis unavailable this day.',
    );
    expect(screen.queryByText(/~30-day constant-maturity IV/)).toBeNull();
  });

  // ---- T-descriptors (sentinel: wire descriptors NEVER rendered) ----------------------------
  it('T-descriptors: the wire window_descriptor/basis_descriptor/advisory_note sentinel never appears in the DOM (FE renders its own pinned copy)', () => {
    for (const v of [computed(), building(), flat()]) {
      const { container, unmount } = renderIvr(v);
      expect(container.textContent ?? '').not.toContain(WIRE_DESC);
      unmount();
    }
  });

  // ---- T-theme (dark + light render; zero hardcoded hex) ------------------------------------
  it('T-theme: Default + Unavailable render under BOTH dark and light themes; the source carries ZERO hardcoded hex', () => {
    for (const t of [theme, lightTheme]) {
      for (const v of [computed(), null]) {
        const { unmount } = renderIvr(v, t);
        expect(screen.getByTestId('widget-iv-rank')).toBeInTheDocument();
        unmount();
      }
    }
    expect(ivrSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  // ---- T-static-source (static-isolation, AC-17 structural half) ---------------------------
  it('T-static-source: the code references NO live-stream / offline plumbing (static-isolation, AC-17 structural half)', () => {
    // Comments stripped — the doc header legitimately NAMES the forbidden props to state the invariant.
    expect(ivrCode).not.toMatch(
      /streamTicker|EventSource|streamOffline|isLive\b|payload-gap|watchdog/,
    );
  });

  it('T-honesty: no rendered string carries buy/sell/smart-money/stop/target/sizing framing (the band lean lives only in its tooltip)', () => {
    const BANNED = /\b(buy|sell|smart money|stop|target|sizing|distance to)\b/i;
    for (const v of [computed(), building(), flat(), null]) {
      const { container, unmount } = renderIvr(v);
      expect(container.textContent ?? '').not.toMatch(BANNED);
      unmount();
    }
  });
});
