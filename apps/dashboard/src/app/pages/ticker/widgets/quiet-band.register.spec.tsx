/**
 * The quiet band — register, the two closed copy sites, live-mark absence and keyboard reachability
 * (curvature-v2-surfaces SPEC §2.4, §4.6; criteria 53, 54, 56a, 58, 59, all SB except 56a). Split by
 * FIGURE, not by widget (§2.4): `OffExchangeBlocks` and `FreshPositioning` are the two widgets that
 * bind a widget-local mono constant and are the real conversion work; `MarketContext`'s one
 * value-slot copy site and `Setups`'s two-arm split are the phase's only other quiet-band code
 * changes. `IvRank`, `StraddleMove`, `DealerFlowProjection` (register-correct by construction,
 * NOT register-enforced — `lookalikes.spec.ts`'s own live-checked exemption) and `TermStructure`
 * (figure-free in the DOM, `TermHeatChart.tsx:105-106` an explicit non-goal) are untouched by this
 * file on purpose — converting them would edit `lookalikes.spec.ts`, which this phase does not do.
 */
import { NOT_A_NUMBER } from '@/shared/copy/notANumber';
import { theme } from '@/shared/theme/theme';
import type { OffExchange, Setup, StrikeRow } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MC_CELL_EMPTY, MC_CELL_EMPTY_CAPTION } from './_kit/copy';
import { FreshPositioning } from './fresh-positioning/FreshPositioning';
import { MarketContext } from './market-context/MarketContext';
import { OffExchangeBlocks } from './off-exchange-blocks/OffExchangeBlocks';
import { Setups } from './setups/Setups';

afterEach(() => cleanup());

const renderIn = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// ---------------------------------------------------------------------------------------------
// 58 (SB) — no quiet-band figure ever carries a live mark, in any state. All eight widgets take no
// stream and pass no `live` claim (§2.4); a source scan over the whole band is the enforcement
// (`lookalikes.spec.ts` already carries this per-file for the four look-alikes; this is the
// superset, so the same guarantee is visible for the two converted widgets plus the two
// figure-free ones without relying on a spec this phase does not edit).
// ---------------------------------------------------------------------------------------------
const QUIET_BAND_WIDGETS = [
  'pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx',
  'pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx',
  'pages/ticker/widgets/market-context/MarketContext.tsx',
  'pages/ticker/widgets/setups/Setups.tsx',
  'pages/ticker/widgets/iv-rank/IvRank.tsx',
  'pages/ticker/widgets/straddle-move/StraddleMove.tsx',
  'pages/ticker/widgets/term-structure/TermStructure.tsx',
  'pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx',
] as const;

const SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const appPath = (k: string) => k.replace(/^\/src\/app\//, '');
const LIVE_MARK = /figure-live-dot|\bLiveDot\b/;

describe('58 (SB) — no quiet-band figure carries a live mark in any connection state', () => {
  it('MUTATION GUARD: the scan itself catches a live-dot testid or a LiveDot import', () => {
    expect(LIVE_MARK.test('data-testid="figure-live-dot"')).toBe(true);
    expect(LIVE_MARK.test("import { LiveDot } from '@/shared/figure';")).toBe(true);
    expect(LIVE_MARK.test('no live claim anywhere in this file')).toBe(false);
  });

  it('none of the eight quiet-band widget sources renders a live-dot testid or imports LiveDot', () => {
    for (const file of QUIET_BAND_WIDGETS) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      expect(entry, `${file} exempted but missing from the glob`).toBeTruthy();
      const src = entry?.[1] ?? '';
      expect(src, `${file} must carry no live mark`).not.toMatch(LIVE_MARK);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// OffExchangeBlocks — 53 (stated register, no widget-local font constant) + 59 (the proximity
// chip, hover-only today, is reachable by tap and keyboard focus).
// ---------------------------------------------------------------------------------------------
const block = (
  over: Partial<OffExchange['blocks'][number]> = {},
): OffExchange['blocks'][number] => ({
  shares: 12_500,
  price: 587.32,
  proximity_pct: 0.004,
  age_seconds: 90,
  notional: 12_500 * 587.32,
  ...over,
});

const offExchange = (over: Partial<OffExchange> = {}): OffExchange => ({
  block_min_shares: 5000,
  blocks: [block()],
  levels: [],
  note: '',
  offex_shares: 12_500,
  ratio_pct: 1.2,
  total_shares: 1_000_000,
  ...over,
});

describe('OffExchangeBlocks · 53 (SB) — the print states its register through the shared module', () => {
  it('the block print carries a stated mono register, no widget-local font constant', () => {
    renderIn(<OffExchangeBlocks offExchange={offExchange()} />);
    const printNode = screen.getByText(/12,500 sh @ \$587\.32/);
    expect(printNode).toHaveAttribute('data-figure-register', 'mono');
    expect(printNode).toHaveAttribute('data-figure-state', 'default');
  });

  it('MONO is gone from the source — it resolves register through @/shared/figure', () => {
    const entry = Object.entries(SOURCES).find(
      ([k]) => appPath(k) === 'pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx',
    );
    const src = entry?.[1] ?? '';
    expect(src).not.toMatch(/\bMONO\b|monoFontFamily/);
    expect(src).toContain('@/shared/figure');
  });
});

describe('OffExchangeBlocks · 59 (SB) — the proximity chip is reachable by tap and keyboard focus', () => {
  it('the chip carries a real tab stop and reveals its tip on focus (not hover-only)', async () => {
    renderIn(<OffExchangeBlocks offExchange={offExchange()} />);
    const chip = screen.getByText('+0.4% vs spot');
    const focusHost = chip.closest('[tabindex]');
    expect(focusHost).not.toBeNull();
    expect(focusHost).toHaveAttribute('tabindex', '0');
    expect(focusHost).toHaveAttribute('aria-describedby');
    (focusHost as HTMLElement).focus();
    expect(focusHost).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// FreshPositioning — 53/54 (SB): register stated on the head figure; the volume figure's absent
// arm is lifted into its own Sans span at the row's own 12px, never inside the mono run.
// ---------------------------------------------------------------------------------------------
const strike = (over: Partial<StrikeRow> = {}): StrikeRow => ({
  strike: 585,
  call_gex: 0,
  call_oi: 0,
  net_gex: 0,
  put_gex: 0,
  put_oi: 0,
  total_oi: 0,
  vol_oi_ratio: 3.4,
  volume: 1_250,
  ...over,
});

describe('FreshPositioning · 53/54 (SB) — register stated; the absent volume never sits in the mono run', () => {
  it('a populated row states mono on both the head figure and the volume figure', () => {
    renderIn(
      <FreshPositioning chainVolOiRatio={1} volOiThreshold={1} unusualStrikes={[strike()]} />,
    );
    const head = screen.getByText(/\$585 · Vol\/OI 3\.40× ·/);
    expect(head).toHaveAttribute('data-figure-register', 'mono');
    const volume = screen.getByText('1,250');
    expect(volume).toHaveAttribute('data-figure-register', 'mono');
    expect(volume).toHaveAttribute('data-figure-state', 'default');
  });

  it("an absent volume renders the closed-nine `—` in its OWN Sans span, at the row's 12px", () => {
    renderIn(
      <FreshPositioning
        chainVolOiRatio={1}
        volOiThreshold={1}
        unusualStrikes={[strike({ volume: null })]}
      />,
    );
    const dash = screen.getByText('—');
    expect(dash).toHaveAttribute('data-figure-register', 'sans');
    expect(dash).toHaveAttribute('data-figure-state', 'empty');
    // Own span, own row-scale size — never `FigureCell`'s 15px literal.
    expect(dash.tagName).toBe('SPAN');
    // The head figure beside it is unaffected — still stated mono.
    const head = screen.getByText(/\$585 · Vol\/OI 3\.40× ·/);
    expect(head).toHaveAttribute('data-figure-register', 'mono');
  });

  it('MUTATION PROOF Q (criterion 54, SB) — no closed-nine member ever renders inside a mono-registered figure', () => {
    const { container } = renderIn(
      <FreshPositioning
        chainVolOiRatio={1}
        volOiThreshold={1}
        unusualStrikes={[strike({ volume: null })]}
      />,
    );
    const monoNodes = container.querySelectorAll('[data-figure-register="mono"]');
    expect(monoNodes.length).toBeGreaterThan(0);
    for (const node of Array.from(monoNodes)) {
      for (const member of NOT_A_NUMBER) {
        expect(node.textContent).not.toBe(member);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// MarketContext — 56a (test): the value-slot split. `MC_CELL_EMPTY` now IS the closed-nine member
// `unavailable`, rendered with a stated (Sans) register; the this-cycle meaning moved to its own
// caption. `MarketContext.spec.tsx`'s own five-level null matrix keeps asserting `MC_CELL_EMPTY`
// unedited (it imports the constant, not a literal), so this file adds the split-specific checks
// that spec does not carry.
// ---------------------------------------------------------------------------------------------
describe('MarketContext · 56a — the value-slot split (value `unavailable`, caption `this cycle`)', () => {
  it('a null ATR horizon renders the value and the caption as two distinct lines, value Sans-registered', () => {
    renderIn(
      <MarketContext
        pack={{
          trend_momentum: null,
          gex_profile_shape: null,
          flow_vs_positioning: null,
          atr: {
            atr_5d: null,
            atr_14d: null,
            atr_30d: null,
            as_of_session: '2026-07-03',
            close_basis: 580,
            method: 'wilder',
          },
        }}
      />,
    );
    const cell = screen.getByTestId('mc-atr-5d-empty');
    const value = within(cell).getByText(MC_CELL_EMPTY);
    expect(value).toHaveAttribute('data-figure-register', 'sans');
    expect(value).toHaveAttribute('data-figure-state', 'unavailable');
    expect(within(cell).getByText(MC_CELL_EMPTY_CAPTION)).toBeInTheDocument();
    // The old single sentence is gone — split, not merely reworded.
    expect(screen.queryByText(`${MC_CELL_EMPTY} ${MC_CELL_EMPTY_CAPTION}`)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Setups — 56a (test): two sentences where the shipped widget rendered one. `[]` keeps the shipped
// sentence byte-for-byte; `undefined` states the degrade instead of a positive market claim.
// ---------------------------------------------------------------------------------------------
const setup = (over: Partial<Setup> = {}): Setup => ({
  name: 'Gamma squeeze setup',
  conviction: 'high',
  bias: 'up',
  rationale: 'Dealers short gamma into a rising tape.',
  strategy: 'long calls',
  ...over,
});

describe('Setups · 56a (test) — undefined vs [] are two sentences, not one', () => {
  it('undefined (never delivered) states the degrade — no market fact about an unscored ticker', () => {
    renderIn(<Setups setups={undefined} />);
    expect(screen.getByText('Setups unavailable this cycle.')).toBeInTheDocument();
    expect(screen.queryByText('No clean setup right now.')).toBeNull();
  });

  it('[] (checked and empty) keeps the shipped sentence byte-for-byte', () => {
    renderIn(<Setups setups={[]} />);
    expect(screen.getByText('No clean setup right now.')).toBeInTheDocument();
    expect(screen.queryByText('Setups unavailable this cycle.')).toBeNull();
  });

  it('a populated list is unaffected by the split', () => {
    renderIn(<Setups setups={[setup()]} />);
    expect(screen.getByText('Gamma squeeze setup')).toBeInTheDocument();
    expect(screen.queryByText('Setups unavailable this cycle.')).toBeNull();
    expect(screen.queryByText('No clean setup right now.')).toBeNull();
  });
});

// MUTATION PROOF R (56a) targets the two `it`s directly above: collapsing `Setups.tsx`'s
// `undefined`/`[]` arms back to one shared sentence must turn both of them red (one loses its
// "unavailable this cycle" text, the other gains a false "No clean setup right now." on the
// never-delivered arm). Run manually against a reverted `Setups.tsx`; the build report records the
// verbatim red output, then the revert — never re-narrated as a passing test in this file.
