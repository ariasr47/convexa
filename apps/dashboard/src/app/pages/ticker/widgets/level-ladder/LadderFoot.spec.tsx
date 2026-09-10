/**
 * `LadderFoot` — criterion 6 (review): Vol-norm GEX and Raw GEX (1% shock) still render, with their
 * shipped tooltips. Not in PLAN's enumerated `Owns` file list (review-only criteria carry no
 * mandated spec there) — added anyway as cheap regression insurance on a byte-for-byte copy: a
 * silent typo in a tooltip carried forward from a file FE-8 deletes whole would otherwise have no
 * mechanism catching it before a human reviewer happens to compare the two files side by side.
 */
import { theme } from '@/shared/theme/theme';
import type { VolNormalizedGex } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LadderFoot } from './LadderFoot';

afterEach(() => cleanup());

const VOL_NORM: VolNormalizedGex = {
  basis_note: 'Normalized to a 1-sigma daily move.',
  call_gex: 1e9,
  net_gex: 5e8,
  put_gex: -5e8,
  total_gex: 1e9,
  vol_basis: 'atm_iv',
  vol_used: 0.32,
};

function wrap(props: Partial<Parameters<typeof LadderFoot>[0]> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LadderFoot volNormalizedGex={VOL_NORM} netGex={7.5e8} {...props} />
    </ThemeProvider>,
  );
}

describe('LadderFoot — Vol-norm GEX and Raw GEX still render (criterion 6)', () => {
  it('renders Vol-norm GEX with its computed value', () => {
    wrap();
    expect(screen.getByText('Vol-norm GEX')).toBeInTheDocument();
    expect(screen.getByText('$500.0M')).toBeInTheDocument();
  });

  it('renders Raw GEX (1% shock) with its computed value', () => {
    wrap();
    expect(screen.getByText('Raw GEX (1% shock)')).toBeInTheDocument();
    expect(screen.getByText('$750.0M')).toBeInTheDocument();
  });

  // The full "opens on tap/Enter/Space" mechanics of the ⓘ control are already proven once, for
  // ALL call sites, by `FigureCell.spec.tsx` — re-driving a real Tooltip open/close cycle per case
  // here proved flaky across sibling tests in this file (MUI's Popper transition state leaking
  // across a fast `cleanup()`/remount boundary in jsdom, confirmed by running each case in
  // isolation — every one passes alone). MUI's `Tooltip` sets the exact `title` text natively on
  // its child as an accessibility fallback regardless of open state, so asserting on `title` proves
  // the same byte-for-byte copy without re-exercising Tooltip's own open mechanism.
  it("Vol-norm GEX renders `unavailable` when the sub-object is absent — the observable input-dependency case, NOT D-14's `—`", () => {
    wrap({ volNormalizedGex: null });
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Vol-norm GEX' })).toHaveAttribute(
      'title',
      'Primary magnitude read — unavailable until ATM IV or 30d HV lands on this snapshot.',
    );
  });

  it('the Vol-norm GEX tooltip is byte-for-byte the shipped copy when present', () => {
    wrap();
    expect(screen.getByRole('button', { name: 'About Vol-norm GEX' })).toHaveAttribute(
      'title',
      'Primary magnitude (vol-normalized). Normalized to a 1-sigma daily move.',
    );
  });

  it('the Raw GEX tooltip is byte-for-byte the shipped copy', () => {
    wrap();
    expect(screen.getByRole('button', { name: 'About Raw GEX (1% shock)' })).toHaveAttribute(
      'title',
      'Secondary: raw dollar dealer gamma for a fixed 1% shock. Prefer Vol-norm GEX above for cross-regime magnitude.',
    );
  });
});
