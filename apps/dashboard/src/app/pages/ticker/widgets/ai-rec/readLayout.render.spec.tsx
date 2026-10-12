/**
 * readLayout.render.spec.tsx — the render-level proof that degraded and powering-failure reads never
 * collapse onto one message (SPEC §4.5, §2.6; rows 33 and 37). The shipped presentational blocks
 * (`DecisionCard`, `PoweringCta`) are rendered directly with hand-built fixtures/presentations.
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoweringCta } from './AiRecPanelBlocks';
import { DecisionCard } from './DecisionCard';
import { recAllTraced } from './fixtures';
import type { AiRecPresentation } from './presentationPolicy';

afterEach(cleanup);

// ---- shared fixtures --------------------------------------------------------------------------

const actions = (o: Partial<AiRecPresentation['actions']> = {}): AiRecPresentation['actions'] => ({
  directExport: false,
  analyze: false,
  askAnyway: false,
  retry: false,
  settings: false,
  signIn: false,
  reviewTrade: true,
  createOrder: true,
  analysis: true,
  refresh: false,
  dismiss: true,
  ...o,
});
const pres = (o: Partial<AiRecPresentation> = {}): AiRecPresentation => ({
  requestState: 'idle',
  resultState: 'fresh_trade',
  missingPositionFields: [],
  actions: actions(),
  ...o,
});

function renderThemed(node: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

// ---- row 33 — the degraded result states never collapse onto one line --------------------------

describe('row 33 — no two degraded result states collapse onto the same primary line', () => {
  it('the three degraded result states render three DIFFERENT lines through the SAME alert, never the same string', () => {
    const rec = recAllTraced();
    const lines = (
      ['stale_newer_snapshot', 'stale_at_generation', 'superseded_inputs'] as const
    ).map((resultState) => {
      const { unmount } = renderThemed(
        <DecisionCard
          rec={rec}
          bundle={null}
          presentation={pres({ resultState })}
          dataAge="older data"
          onReview={vi.fn()}
          onAnalysis={vi.fn()}
          onRefresh={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );
      const line = screen.getByTestId('decision-degraded').textContent;
      unmount();
      cleanup();
      return line;
    });
    expect(new Set(lines).size).toBe(3);
  });
});

// ---- row 37 — the eight powering reasons never collapse -----------------------------------------

describe('row 37 — the eight powering reasons each render their own sentence; titles never collapse', () => {
  const reasons = [
    'no_key',
    'key_unusable',
    'key_rejected',
    'model_not_in_catalog',
    'model_unset',
    'oauth_expired',
    'oauth_unlinked',
    'subscription_unavailable',
  ];

  it('all eight titles are distinct strings', () => {
    const titles = reasons.map((reason) => {
      const { unmount } = renderThemed(<PoweringCta reason={reason} onSettings={vi.fn()} />);
      const title =
        screen.getByRole('button').previousElementSibling?.previousElementSibling?.textContent;
      unmount();
      cleanup();
      return title;
    });
    expect(new Set(titles).size).toBe(8);
  });
});
