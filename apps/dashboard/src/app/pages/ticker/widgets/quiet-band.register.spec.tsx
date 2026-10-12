/**
 * The quiet band — live-mark absence and the Setups closed copy site (curvature-v2-surfaces SPEC
 * §2.4, §4.6; criteria 56a, 58). No quiet-band widget may wear a live mark, and `Setups` keeps its
 * never-delivered (`undefined`) and checked-empty (`[]`) arms as two different sentences.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
// Setups — 56a (test): two sentences where the shipped widget rendered one. `[]` keeps the shipped
// sentence byte-for-byte; `undefined` states the degrade instead of a positive market claim.
// ---------------------------------------------------------------------------------------------
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
});

// MUTATION PROOF R (56a) targets the two `it`s directly above: collapsing `Setups.tsx`'s
// `undefined`/`[]` arms back to one shared sentence must turn both of them red (one loses its
// "unavailable this cycle" text, the other gains a false "No clean setup right now." on the
// never-delivered arm). Run manually against a reverted `Setups.tsx`; the build report records the
// verbatim red output, then the revert — never re-narrated as a passing test in this file.
