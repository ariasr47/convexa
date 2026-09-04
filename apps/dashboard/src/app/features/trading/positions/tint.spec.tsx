/**
 * Tint discipline on the positions surface (AC-78, owner ruling #18; SPEC §4 *Call/put tint* and §7
 * invariant 6). The scoped canon lives in `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (Banned table,
 * green/red row, amended 2026-09-03) and is quoted verbatim in the `docs/design/DESIGN_SYSTEM.md` stub.
 *
 * THE RULE: `success.main` / `error.main` appear on this surface in exactly FIVE places, all of them
 * SIGNED DOLLAR DIRECTION — the `pl` cell, the `pl_pct` cell, the group subtotal, the sparkline
 * stroke, and the `ClosedSummary` realized figure. Nothing else is ever tinted.
 *
 * THE DECISIVE ARGUMENT, carried so nobody re-proposes it: A SHORT CALL IS BEARISH. Tinting a
 * position green because it contains a call tells the trader the opposite of the truth — the same
 * error class as the off-exchange proximity chips rendering green on a no-side datum, but on the
 * trader's own money. Gamma/GEX surfaces KEEP call-vs-put colouring (there it distinguishes call
 * gamma from put gamma, a domain fact); position and P&L surfaces use DIRECTION ONLY.
 *
 * WHY className IDENTITY and never `getAttribute('style')`: MUI `sx` compiles to emotion CLASSES, so
 * the inline style attribute is always empty and a style-based assertion is vacuous by construction.
 * Two elements that differ only in a datum must therefore wear the SAME class — if one of them
 * acquires a tint, its class changes and these go red.
 *
 * WHAT TURNS THIS RED: any branch in `PositionRow` / `PositionCard` / `LegDisclosure` that selects a
 * colour from call-vs-put, from long-vs-short, from debit-vs-credit, from the structure name, or
 * from the risk slot's figure-vs-reason. The final case is the vacuity guard: without it, a change
 * that strips ALL tint from the surface would pass every other assertion here.
 */
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedGroup } from './derive';
import {
  FX_CALL_DEBIT_SPREAD,
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_LONG_STRADDLE,
  FX_PROTECTIVE_PUT,
  FX_RATIO_1X2,
  FX_SHARES_LONG,
  FX_SHORT_CALL,
  FX_SHORT_VERTICAL,
  viewOf,
} from './fixtures';
import { PositionsView, type ViewProps } from './PositionsView';
import type { PositionView } from './view';

function groupsOf(views: PositionView[]): DerivedGroup[] {
  return [{ key: '__all__', label: 'All', views, subtotal: 0, excludedCount: 0 }];
}

function renderRows(views: PositionView[], over: Partial<ViewProps> = {}) {
  return render(
    <ThemeProvider theme={themeForPref('dark')}>
      <PositionsView
        groups={groupsOf(views)}
        columns={[]}
        layout="table"
        density="comfortable"
        streamOffline={false}
        totalCount={views.length}
        isHistory={false}
        trendFor={() => []}
        onOpenEntry={vi.fn()}
        onClearFilter={vi.fn()}
        onClose={vi.fn()}
        onCancel={vi.fn()}
        {...over}
      />
    </ThemeProvider>,
  );
}

/** The emotion class an element wears — the only assertable carrier of an `sx` colour. */
const cls = (el: Element) => el.className;

/** The CSS body of the emotion class an element wears (`getAttribute('style')` is always empty). */
function sxCss(el: Element): string {
  const emotionClass = Array.from(el.classList).find((c) => c.startsWith('css-'));
  if (!emotionClass) return '';
  const sheets = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '');
  return sheets.split(`.${emotionClass}{`)[1]?.split('}')[0] ?? '';
}

/**
 * Does this element resolve to one of the TWO directional colours? The theme is CSS-variable-backed,
 * so `color: 'error.main'` serialises as `var(--mui-palette-error-main)` and NOT as the hex — both
 * forms are checked so this keeps working if the variable layer is ever turned off.
 */
function isTinted(el: Element): boolean {
  const p = themeForPref('dark').palette;
  const css = sxCss(el).toLowerCase();
  return [
    '--mui-palette-success-main',
    '--mui-palette-error-main',
    p.success.main.toLowerCase(),
    p.error.main.toLowerCase(),
  ].some((c) => css.includes(c));
}

/** jsdom has no `matchMedia`; the `max_loss` column only renders at `lg` and above. */
function stubViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => {
      const min = /min-width:\s*([\d.]+)px/.exec(q);
      const max = /max-width:\s*([\d.]+)px/.exec(q);
      return {
        matches: !((min && width < Number(min[1])) || (max && width > Number(max[1]))),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      };
    }),
  );
}

beforeEach(() => stubViewport(1440));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('tint discipline — className identity (AC-78)', () => {
  it('a Short leg label and a Long leg label are className-identical', async () => {
    const user = userEvent.setup();
    // The condor has both, on the same expiry, in one disclosure.
    renderRows([viewOf(FX_IRON_CONDOR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    const sides = screen.getAllByTestId('leg-side');
    const words = new Set(sides.map((s) => s.textContent));
    expect(words).toEqual(new Set(['Long', 'Short'])); // vacuity guard: BOTH are present
    const classes = new Set(sides.map(cls));
    expect(classes.size).toBe(1);
  });

  it('`Call` and `Put` in the leg list are className-identical', async () => {
    const user = userEvent.setup();
    renderRows([viewOf(FX_IRON_CONDOR)]);
    await user.click(screen.getByTestId('leg-disclosure-toggle'));

    const instruments = screen.getAllByTestId('leg-instrument');
    const calls = instruments.filter((n) => n.textContent?.includes('Call'));
    const puts = instruments.filter((n) => n.textContent?.includes('Put'));
    expect(calls.length).toBeGreaterThan(0); // vacuity guards
    expect(puts.length).toBeGreaterThan(0);
    expect(new Set([...calls, ...puts].map(cls)).size).toBe(1);
  });

  it('a credit entry cell and a debit entry cell are className-identical', () => {
    renderRows([viewOf(FX_CALL_DEBIT_SPREAD), viewOf(FX_SHORT_VERTICAL)]);
    const cells = screen.getAllByTestId('cell-entry');
    const texts = cells.map((c) => c.textContent);
    // A credit is money RECEIVED, not a gain: tinting it green manufactures a verdict.
    expect(texts.some((t) => t?.includes('debit'))).toBe(true);
    expect(texts.some((t) => t?.includes('credit'))).toBe(true);
    expect(new Set(cells.map(cls)).size).toBe(1);
  });

  it('the structure chip is className-identical for Iron condor, Shares and Custom', () => {
    renderRows([viewOf(FX_IRON_CONDOR), viewOf(FX_SHARES_LONG), viewOf(FX_RATIO_1X2)]);
    const chips = screen.getAllByTestId('cell-structure');
    expect(chips.map((c) => c.textContent)).toEqual(['Iron condor', 'Shares', 'Custom']);
    // `Custom` renders in the SAME neutral register as every other name — no error styling, no
    // alert colour, no icon; and not amber either (amber is spent on the one entry CTA).
    expect(new Set(chips.map(cls)).size).toBe(1);
  });

  it('the risk slot carries NO directional colour, for a figure or for a withheld reason', () => {
    // NOT className identity here, deliberately: SPEC §4 gives the figure the mono `tabular-nums`
    // treatment and the reason the shared not-a-number-literal treatment (`text.disabled`), so the
    // two legitimately wear different classes. What must hold is that NEITHER is directional — so
    // this reads the emotion rule each one actually wears and looks for the tint itself.
    renderRows([viewOf(FX_PROTECTIVE_PUT), viewOf(FX_SHORT_CALL)]);
    const slots = screen.getAllByTestId('cell-max-loss');
    expect(slots[0].textContent).toMatch(/^\$\d/); // a figure
    expect(slots[1].textContent).toBe('unlimited risk'); // a reason
    for (const slot of slots) expect(isTinted(slot)).toBe(false);
    // VACUITY GUARD for this technique: the P/L cell in the same render IS detected as tinted.
    expect(
      screen
        .getAllByTestId('cell-pl')
        .some((c) => Array.from(c.querySelectorAll('*')).some(isTinted)),
    ).toBe(true);
  });

  it('the not-a-number literals and the offline tag are className-identical', () => {
    renderRows([viewOf(FX_PROTECTIVE_PUT, { mark: null }), viewOf(FX_LONG_STRADDLE)], {
      streamOffline: true,
    });
    const unavailable = screen.getAllByTestId('cell-unavailable');
    expect(unavailable.length).toBeGreaterThan(0);
    // Every `unavailable` cell wears one class, and a degraded state is NEVER directional.
    expect(new Set(unavailable.map(cls)).size).toBe(1);
    expect(screen.getByTestId('positions-table').innerHTML).toMatch(/⏸ offline/);
  });

  it('the card mirrors the row: no tint on the chip, the entry qualifier or the risk slot', () => {
    renderRows([viewOf(FX_PROTECTIVE_PUT), viewOf(FX_SHORT_VERTICAL)], { layout: 'card' });
    const chips = screen.getAllByTestId('card-structure-chip');
    const entries = screen.getAllByTestId('card-net-entry');
    const risks = screen.getAllByTestId('card-max-loss');
    expect(new Set(chips.map(cls)).size).toBe(1);
    expect(new Set(entries.map(cls)).size).toBe(1);
    expect(new Set(risks.map(cls)).size).toBe(1);
  });

  it('NEGATIVE SPACE — nothing outside the five carriers is tinted anywhere on the surface', async () => {
    const user = userEvent.setup();
    renderRows([
      viewOf(FX_IRON_CONDOR),
      viewOf(FX_SHORT_VERTICAL),
      viewOf(FX_SHARES_LONG),
      viewOf(FX_RATIO_1X2),
      viewOf(FX_SHORT_CALL),
      viewOf(FX_PROTECTIVE_PUT, { mark: null }),
    ]);
    await user.click(screen.getAllByTestId('leg-disclosure-toggle')[0]);

    // The five carriers, by the container they live in. `subtotal` and `card-pl` are here so the
    // same sweep keeps working when this runs over the grouped and card projections.
    const CARRIERS = ['cell-pl', 'cell-pl-pct', 'subtotal', 'card-pl'];
    const inCarrier = (el: Element) =>
      CARRIERS.some((t) => el.closest(`[data-testid="${t}"]`) != null) ||
      (el.textContent ?? '').startsWith('Closed · realized');

    const all = Array.from(document.querySelectorAll('*'));
    const tinted = all.filter(isTinted);
    expect(tinted.length).toBeGreaterThan(0); // vacuity guard: the detector still detects
    expect(tinted.filter((el) => !inCarrier(el)).map((el) => el.textContent?.slice(0, 40))).toEqual(
      [],
    );
  });

  it('THE VACUITY GUARD — the P/L cell IS tinted, and DIFFERENTLY for a gain and a loss', () => {
    // The long call entered at 12.40 and marked at 6.20 is a LOSS; the short call sold at 6.10 and
    // marked at 5.00 is a GAIN. Both off the SAME render, so one row is red and the other green.
    renderRows([
      viewOf(FX_LONG_CALL, { mark: { mark: 6.2, basis: 'snapshot', frozen: false } }),
      viewOf(FX_SHORT_CALL, { mark: { mark: 5, basis: 'snapshot', frozen: false } }),
    ]);
    const [loss, gain] = screen.getAllByTestId('cell-pl').map((c) => within(c).getByText(/\$/));
    expect(loss.textContent).toMatch(/^−\$/);
    expect(gain.textContent).toMatch(/^\+\$/);
    // Without THIS case, a change that strips ALL tint from the surface would pass every other
    // assertion in this file.
    expect(cls(loss)).not.toBe(cls(gain));
  });

  it('THE VACUITY GUARD — the group subtotal is tinted by sign too', () => {
    const views = [viewOf(FX_LONG_CALL)];
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <PositionsView
          groups={[{ key: 'TSLA', label: 'TSLA', views, subtotal: -420, excludedCount: 0 }]}
          columns={[]}
          layout="table"
          density="comfortable"
          streamOffline={false}
          totalCount={1}
          isHistory={false}
          trendFor={() => []}
          onOpenEntry={vi.fn()}
          onClearFilter={vi.fn()}
          onClose={vi.fn()}
          onCancel={vi.fn()}
        />
      </ThemeProvider>,
    );
    const negative = cls(within(screen.getByTestId('subtotal')).getByText('−$420'));
    cleanup();
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <PositionsView
          groups={[{ key: 'TSLA', label: 'TSLA', views, subtotal: 420, excludedCount: 0 }]}
          columns={[]}
          layout="table"
          density="comfortable"
          streamOffline={false}
          totalCount={1}
          isHistory={false}
          trendFor={() => []}
          onOpenEntry={vi.fn()}
          onClearFilter={vi.fn()}
          onClose={vi.fn()}
          onCancel={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(cls(within(screen.getByTestId('subtotal')).getByText('+$420'))).not.toBe(negative);
  });

  it('dark and light parity: the same discipline holds in both schemes', async () => {
    for (const scheme of ['dark', 'light'] as const) {
      render(
        <ThemeProvider theme={themeForPref(scheme)}>
          <PositionsView
            groups={groupsOf([viewOf(FX_IRON_CONDOR), viewOf(FX_SHORT_VERTICAL)])}
            columns={[]}
            layout="table"
            density="comfortable"
            streamOffline={false}
            totalCount={2}
            isHistory={false}
            trendFor={() => []}
            onOpenEntry={vi.fn()}
            onClearFilter={vi.fn()}
            onClose={vi.fn()}
            onCancel={vi.fn()}
          />
        </ThemeProvider>,
      );
      const user = userEvent.setup();
      await user.click(screen.getAllByTestId('leg-disclosure-toggle')[0]);
      expect(new Set(screen.getAllByTestId('leg-side').map(cls)).size).toBe(1);
      expect(new Set(screen.getAllByTestId('cell-structure').map(cls)).size).toBe(1);
      expect(new Set(screen.getAllByTestId('cell-entry').map(cls)).size).toBe(1);
      cleanup();
    }
  });
});

describe('tint discipline — token discipline (AC-81)', () => {
  const SOURCES = import.meta.glob(['./*.tsx', '!./*.spec.tsx'], {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>;

  it('no component under positions/ contains a hardcoded hex colour', () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(4); // vacuity guard: the scan actually loaded sources
    for (const [file, src] of Object.entries(SOURCES)) {
      const hits = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hits, `hardcoded hex in ${file}: ${hits.join(', ')}`).toEqual([]);
    }
  });

  /**
   * The FIVE legitimate carriers, each recognised by the SIGN COMPARISON that selects it. A tint
   * chosen from `right === 'call'`, `side === 'long'`, `net_entry_basis`, the structure name or the
   * risk slot's figure-vs-reason matches none of these and fails the scan.
   */
  const DIRECTION_BRANCH = /(pl_dollar|plColor|r\$|subtotal|last)\s*>=\s*0/;

  /**
   * PRE-EXISTING, OUT OF SCOPE: the `PAPER` tab badge in `PortfolioPanel` is chrome, not a position
   * or P&L datum, and it predates this feature. AC-78 scopes the ban to the row/card data surface.
   * Exempted BY LINE CONTENT (not by file) so the rest of that file stays covered.
   */
  const EXEMPT = /PAPER badge|color: 'success\.main',$|palette\.success\.main\}66/;

  it('success/error are selected ONLY by a sign comparison — never by a leg or structure attribute', () => {
    const offenders: string[] = [];
    let carriers = 0;
    for (const [file, src] of Object.entries(SOURCES)) {
      for (const line of src.split('\n')) {
        const code = line.trim();
        if (code.startsWith('*') || code.startsWith('//')) continue; // prose cannot offend
        if (!/success\.main|error\.main/.test(code)) continue;
        if (DIRECTION_BRANCH.test(code)) {
          carriers += 1;
          continue;
        }
        if (EXEMPT.test(code)) continue;
        offenders.push(`${file}: ${code}`);
      }
    }
    expect(offenders).toEqual([]);
    // EXACTLY five carriers: pl cell, pl_pct cell (same `plColor`), the group subtotal, the
    // sparkline stroke, the ClosedSummary realized figure, and the card's own P/L block. A sixth
    // tinted site anywhere under positions/ fails here rather than shipping quietly.
    expect(carriers).toBe(5);
  });
});
