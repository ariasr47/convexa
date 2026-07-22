/**
 * ConvexaMark — the rebuilt CONVEXA lockup's structural guards (redesign-stage-2 §3.2):
 *   - accessibility: the split text nodes ("CONVE" + glyph + "A") would read wrong, so the
 *     wrapper is `role="img"` with the STABLE accessible name "Convexa"; inner nodes aria-hidden;
 *   - the arc-X glyph keeps `data-testid="convexa-mark"` (the preserved suite contract), renders
 *     the two arc paths as `currentColor` strokes — no literal color, no gradient;
 *   - the Expanded width is a REAL `font-stretch` (125%) — `scaleX` faux stretch is BANNED
 *     (Stage 1 §10-1 rule carried; source-level scan).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConvexaMark } from './ConvexaMark';

afterEach(() => cleanup());

const MARK_RAW = import.meta.glob(['/src/app/shell/ConvexaMark.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const markSrc = Object.values(MARK_RAW)[0] ?? '';

function renderMark() {
  return render(
    <ThemeProvider theme={theme}>
      <ConvexaMark />
    </ThemeProvider>,
  );
}

describe('ConvexaMark · the lockup', () => {
  it('accessible name is "Convexa" (role img); the split text nodes are hidden from AT', () => {
    renderMark();
    const lockup = screen.getByRole('img', { name: 'Convexa' });
    expect(lockup).toBeInTheDocument();
    // The visible caps render as CONVE + [X] + A, each aria-hidden (never "CONVE A" to a reader).
    expect(screen.getByText('CONVE')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
  });

  it('the arc-X glyph keeps its testid and renders two currentColor arc strokes', () => {
    renderMark();
    const glyph = screen.getByTestId('convexa-mark');
    expect(glyph.tagName.toLowerCase()).toBe('svg');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    const paths = glyph.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    for (const p of Array.from(paths)) {
      expect(p.getAttribute('stroke')).toBe('currentColor');
      expect(p.getAttribute('fill')).toBe('none');
      expect(p.getAttribute('d')).toContain('Q'); // convex arcs, never straight diagonals
    }
  });

  it('legacy API preserved: `size` + `fontSize` props accepted (zero call-site churn)', () => {
    render(
      <ThemeProvider theme={theme}>
        <ConvexaMark size={16} fontSize="1rem" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'Convexa' })).toBeInTheDocument();
  });

  it('REAL Expanded width — `fontStretch` 125%, and NO scaleX faux stretch (source scan)', () => {
    expect(markSrc).toContain("fontStretch: '125%'");
    expect(markSrc.includes('scaleX')).toBe(false);
  });
});
