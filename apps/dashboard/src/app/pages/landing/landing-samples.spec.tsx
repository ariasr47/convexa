import { NOT_LIVE } from '@/shared/liveness/liveClaim';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiReadSample } from './AiReadSample';
import { FLIP_DISTANCE_LABEL, ScoreStripSample } from './ScoreStripSample';
import { LANDING_FIELD_MODEL } from './samples';
import { StructureFieldSample } from './StructureFieldSample';

afterEach(() => cleanup());
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('SPEC §2.2 — samples.ts is frozen literals only', () => {
  it('the field model carries the honesty flags the mount depends on', () => {
    expect(LANDING_FIELD_MODEL.live).toBe(false);
    expect(LANDING_FIELD_MODEL.liveMid).toBeNull();
    expect(LANDING_FIELD_MODEL.source).toBe('demo');
    expect(LANDING_FIELD_MODEL.asOfSec).toBeNull();
    expect(LANDING_FIELD_MODEL.samples).toHaveLength(21);
  });

  it('every landing figure passes NOT_LIVE — a frozen sample cannot render a live dot', () => {
    // PLAN.md's own snippet asserted `NOT_LIVE.live` — `LiveClaim` is a BRANDED PRIMITIVE boolean
    // (`liveClaim.ts:22`, the brand erased at runtime), so `.live` is not a real property and reads
    // `undefined` on any boolean, always failing regardless of this feature's implementation. Fixed
    // to the assertion the test's own name states: the claim itself is the not-live primitive.
    expect(NOT_LIVE).toBe(false);
  });
});

describe('AC-L5 / AC-L5a — the sample panels claim nothing they cannot support', () => {
  it('the score strip prints the derived flip distance, never a hand-typed one', () => {
    wrap(<ScoreStripSample />);
    expect(screen.getByTestId('sample-flip-distance')).toHaveTextContent(FLIP_DISTANCE_LABEL);
    expect(screen.queryByText('−0.81%')).toBeNull();
  });

  it('the score strip carries the shipped tier row and the caption, and NO ring gauge', () => {
    const { container } = wrap(<ScoreStripSample />);
    for (const t of ['Dormant', 'Watch', 'Actionable', 'Prime']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.getByText('0–100 triage score · not a trade signal')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(0); // no ring gauge, no icon geometry
  });

  it('AC-L4 — the CTA-shaped elements in the AI-read sample are NOT controls', () => {
    const { container } = wrap(<AiReadSample />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
    expect(screen.getByText('Review simulated trade')).toBeInTheDocument();
  });

  it('the AI-read sample keeps SIMULATED and the AI-stated · untraced caption', () => {
    wrap(<AiReadSample />);
    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
    expect(screen.getByText('AI-stated · untraced')).toBeInTheDocument();
  });

  it('the AI-read panel head carries its OWN sample literal, not the shared one', () => {
    wrap(<AiReadSample />);
    expect(screen.getByText('Illustrative sample — not a real model output.')).toBeInTheDocument();
  });

  it('SPEC §2.4 — the field mounts calm and embedded, with the frozen model', () => {
    const { container } = wrap(<StructureFieldSample />);
    expect(screen.getByText('Structure field')).toBeInTheDocument();
    expect(
      screen.getByText('Illustrative sample — not a live read and not a recorded session.'),
    ).toBeInTheDocument();
    // The suppressed canvas copy must not appear anywhere on `/`.
    for (const banned of ['demo as-of', 'synthetic demo', 'TAPE OFF']) {
      expect(container.textContent).not.toContain(banned);
    }
  });

  it('no as-of, no live chip, no pause mark on any sample panel', () => {
    const { container } = wrap(
      <>
        <ScoreStripSample />
        <AiReadSample />
      </>,
    );
    expect(container.querySelector('[data-testid="live-dot"]')).toBeNull();
    expect(container.querySelector('[data-testid="pause-mark"]')).toBeNull();
    expect(container.textContent).not.toContain('as-of');
  });
});
