import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FreshPositioning } from './FreshPositioning';

afterEach(() => cleanup());

describe('FreshPositioning empty read', () => {
  it('a null Vol/OI ratio says the read is unavailable this cycle', () => {
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <FreshPositioning chainVolOiRatio={null} volOiThreshold={1} unusualStrikes={[]} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Vol/OI unavailable this cycle.')).toBeInTheDocument();
  });
});
