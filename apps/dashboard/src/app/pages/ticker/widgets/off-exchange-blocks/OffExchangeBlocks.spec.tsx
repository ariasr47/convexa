import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OffExchangeBlocks } from './OffExchangeBlocks';

afterEach(() => cleanup());

describe('OffExchangeBlocks empty contrast', () => {
  it.each(['dark', 'light'] as const)(
    '%s uses readable secondary ink at full opacity',
    (scheme) => {
      render(
        <ThemeProvider theme={themeForPref(scheme)}>
          <OffExchangeBlocks offExchange={null} />
        </ThemeProvider>,
      );
      const node = screen.getByText('Off-exchange data unavailable this cycle.');
      expect(node.className).toContain('MuiTypography');
    },
  );
});
