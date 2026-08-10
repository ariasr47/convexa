import { theme } from '@/shared/theme/theme';
import { WidgetSelectionProvider } from '@/shared/ui/Widget';
import { ThemeProvider } from '@mui/material/styles';
import type { StructureSample } from '@convexa/api';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { StructureHistory } from './StructureHistory';

afterEach(() => cleanup());

function sample(as_of: number, score: number, dist: number): StructureSample {
  return {
    symbol: 'SPY',
    as_of,
    price: 500,
    score,
    tier: 'watch',
    regime: 'positive_gamma',
    vol_regime: 'neutral',
    flip: 495,
    dist_to_flip_pct: dist,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: -2,
  };
}

function mount(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <WidgetSelectionProvider>{ui}</WidgetSelectionProvider>
    </ThemeProvider>,
  );
}

describe('StructureHistory', () => {
  it('empty cold-start is honest (not an error)', () => {
    mount(<StructureHistory symbol="SPY" samples={[]} />);
    expect(screen.getByTestId('structure-history-empty').textContent).toMatch(/Building history/i);
    expect(screen.queryByTestId('structure-history-error')).toBeNull();
  });

  it('renders path deltas and sparklines from ≥2 samples (neutral, not green/red)', () => {
    mount(
      <StructureHistory
        symbol="spy"
        samples={[sample(1000, 70, 2), sample(2000, 75, 1)]}
        basis="Slow-lane only."
      />,
    );
    expect(screen.getByTestId('structure-history-score-delta').textContent).toBe('↑5');
    expect(screen.getByTestId('structure-history-flipdist-delta').textContent).toBe('↓1.0');
    expect(screen.getByTestId('structure-history-score-spark').tagName.toLowerCase()).toBe('svg');
    expect(screen.getByTestId('structure-history-basis').textContent).toMatch(/Slow-lane/);
    // No success/error palette classes on the delta (neutral text.secondary only).
    const delta = screen.getByTestId('structure-history-score-delta');
    expect(delta.className).not.toMatch(/MuiTypography-colorSuccess|error/i);
  });

  it('skeleton while loading with no samples yet', () => {
    mount(<StructureHistory symbol="SPY" samples={null} loading />);
    expect(screen.getByTestId('structure-history-skeleton')).toBeInTheDocument();
  });
});
