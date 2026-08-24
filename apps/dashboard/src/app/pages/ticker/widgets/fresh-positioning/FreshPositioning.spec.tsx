import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FreshPositioning } from './FreshPositioning';

afterEach(() => cleanup());

describe('FreshPositioning empty contrast', () => {
  it.each(['dark', 'light'] as const)(
    '%s uses readable secondary ink at full opacity',
    (scheme) => {
      render(
        <ThemeProvider theme={themeForPref(scheme)}>
          <FreshPositioning chainVolOiRatio={null} volOiThreshold={1} unusualStrikes={[]} />
        </ThemeProvider>,
      );
      const node = screen.getByText('Vol/OI unavailable this cycle.');
      expect(node.className).toContain('MuiTypography');
    },
  );
});
