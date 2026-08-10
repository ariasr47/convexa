/**
 * AC-69 — THE TICKER-PAGE DOOR. The faulted state is NOT scoped to `/positions`.
 *
 * This header's CTA opens the SAME shared dialog against the SAME book, so it carries the same
 * refused treatment as the Positions page and its own one-line notice. The behavioural half is
 * pinned on the shared primitive (`positions/faulted.a11y.spec.tsx`); what this file pins is that
 * THIS surface is actually wired to it — the second door is the one that gets forgotten, and it was:
 * GATE Q found this exact CTA rendering as a fully bright, fully opaque amber button while the fault
 * notice sat right above it, indistinguishable from enabled.
 *
 * `sx` compiles to emotion CLASSES, so `getAttribute('style')` is always empty; and the theme is
 * CSS-variable-backed, so `action.disabled` serialises as `var(--mui-palette-action-disabled)`
 * rather than a colour literal. Both forms are checked, in both colour schemes.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { MarketState } from '@convexa/api';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TickerHeader } from './TickerHeader';

afterEach(() => cleanup());

const M = { ticker: 'TSLA', price: 250, timestamp_iso: '2026-06-23T14:30:00Z' } as MarketState;

function mount(storeFaulted: boolean, scheme: 'dark' | 'light') {
  return render(
    <ThemeProvider theme={themeForPref(scheme)}>
      <TickerHeader
        m={M}
        sig={undefined}
        live={null}
        isLive={false}
        streamOffline={false}
        selected={null}
        onOpenTrade={vi.fn()}
        storeFaulted={storeFaulted}
      />
    </ThemeProvider>,
  );
}

/** The declarations that actually apply to an element's own emotion class (no compound rules). */
function baseCss(el: Element): string {
  const sheet = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '')
    .toLowerCase();
  let out = '';
  for (const c of Array.from(el.classList).filter((c) => c.startsWith('css-'))) {
    for (const m of sheet.matchAll(new RegExp(`\\.${c.toLowerCase()}\\{([^{}]*)\\}`, 'g'))) {
      out += `${m[1]};`;
    }
  }
  return out;
}

function bindsDisabled(el: Element, scheme: 'dark' | 'light'): boolean {
  const a = themeForPref(scheme).palette.action;
  const css = baseCss(el);
  return [
    '--mui-palette-action-disabled',
    a.disabled.toLowerCase().replace(/\s+/g, ''),
    a.disabledBackground.toLowerCase().replace(/\s+/g, ''),
  ].some((t) => css.includes(t));
}

describe('AC-69 · the Ticker-page entry CTA carries the SAME refusal', () => {
  for (const scheme of ['dark', 'light'] as const) {
    it(`${scheme}: refused is visibly quieter than enabled, and the notice explains it`, () => {
      mount(true, scheme);
      const refused = screen.getByTestId('open-sim-trade');
      const refusedClass = refused.className;

      // The one-line door notice, and the CTA described BY it.
      expect(screen.getByTestId('ticker-faulted-notice')).toBeInTheDocument();
      expect(refused).toHaveAttribute('aria-describedby', 'store-faulted-banner');

      // The aria/keyboard half — unchanged, and never the HTML attribute.
      expect(refused).toHaveAttribute('aria-disabled', 'true');
      expect(refused).not.toBeDisabled();
      expect(refused).not.toHaveAttribute('disabled');
      expect(baseCss(refused)).not.toContain('pointer-events:none');

      // The VISUAL half.
      expect(bindsDisabled(refused, scheme)).toBe(true);

      cleanup();
      mount(false, scheme);
      const enabled = screen.getByTestId('open-sim-trade');
      // Vacuity guards: a healthy CTA is a different, undimmed control with no notice above it.
      expect(screen.queryByTestId('ticker-faulted-notice')).toBeNull();
      expect(enabled.className).not.toBe(refusedClass);
      expect(bindsDisabled(enabled, scheme)).toBe(false);
    });
  }
});
