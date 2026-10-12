import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiReadSample } from './AiReadSample';
import { ScoreStripSample } from './ScoreStripSample';

afterEach(() => cleanup());
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('AC-L5 / AC-L5a — the sample panels claim nothing they cannot support', () => {
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
