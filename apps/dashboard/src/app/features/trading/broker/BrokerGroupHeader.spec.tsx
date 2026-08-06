/**
 * BrokerGroupHeader / BrokerGroupPanel — the ONE shared group-header presentational unit, run over
 * BOTH form factors (SPEC §2.8, PLAN F5). Groups are built from the F1 fixtures via `groupBook` —
 * never hand-typed — so every assertion here is grounded in the real composition.
 */
import type { MarkResult } from '@/features/trading/model/mark';
import type { BrokerBook } from '@org/api';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { BrokerGroupHeader, BrokerGroupPanel } from './BrokerGroupHeader';
import { brokerLegId, buildBrokerPositionView } from './brokerView';
import {
  BOOK_CAPTURED_COMPLETE,
  BOOK_CF_CREDIT,
  BOOK_CF_DOUBLY_BROKEN,
  BOOK_CF_MIXED_CAUSE,
  BOOK_CF_NO_COST,
  BOOK_CF_NO_RECON_NOTE,
  BOOK_CF_NO_SIZE,
  BOOK_CF_UNPARSEABLE,
  BOOK_CF_ZERO_NET,
  FIXED_NOW_MS,
} from './fixtures';
import { groupBook, type BrokerGroup } from './grouping';

/** Real marks (off each leg's own `broker_mark`) so `pl_dollar` resolves to a figure rather than
 *  going `unavailable` for want of a live mark — a test-setup concern, orthogonal to the book/entry
 *  withholding axis this spec actually exercises. */
function marksForBook(book: BrokerBook): Map<string, MarkResult> {
  const m = new Map<string, MarkResult>();
  for (const p of book.positions) {
    p.legs.forEach((l, i) => {
      const mark = l.broker_mark.state === 'supplied' ? (l.broker_mark.value ?? 0) : 0;
      m.set(brokerLegId(p.broker_position_id, i), { mark, basis: 'snapshot', frozen: false });
    });
  }
  return m;
}

function groupsOf(book: BrokerBook) {
  const legMarks = marksForBook(book);
  return groupBook(
    book.positions.map((position) =>
      buildBrokerPositionView({ position, legMarks, dte: null, nowMs: FIXED_NOW_MS, book }),
    ),
    book,
    FIXED_NOW_MS,
  );
}

function groupByKey(book: BrokerBook, key: string): BrokerGroup {
  const g = groupsOf(book).groups.find((x) => x.key === key);
  if (g == null) throw new Error(`no group ${key}`);
  return g;
}

/** BOOK_CAPTURED_COMPLETE's three real groups (leg_count > 1) — TSLA/AAPL/META. */
const tslaGroup = () => groupByKey(BOOK_CAPTURED_COMPLETE, 'TSLA');
const aaplGroup = () => groupByKey(BOOK_CAPTURED_COMPLETE, 'AAPL');
const metaGroup = () => groupByKey(BOOK_CAPTURED_COMPLETE, 'META');

function renderHeader(
  group: BrokerGroup,
  variant: 'row' | 'card',
  opts: {
    expanded?: boolean;
    onToggle?: () => void;
    streamOffline?: boolean;
    isStale?: boolean;
    asOf?: string | null;
  } = {},
) {
  const {
    expanded = false,
    onToggle = () => undefined,
    streamOffline = false,
    isStale = false,
    asOf = null,
  } = opts;
  return render(
    <>
      <BrokerGroupHeader
        group={group}
        variant={variant}
        expanded={expanded}
        onToggle={onToggle}
        panelId="group-panel-1"
        streamOffline={streamOffline}
        isStale={isStale}
        asOf={asOf}
      />
      <BrokerGroupPanel group={group} id="group-panel-1" expanded={expanded}>
        <div data-testid="member-slot" />
      </BrokerGroupPanel>
    </>,
  );
}

afterEach(() => cleanup());

describe.each(['row', 'card'] as const)('BrokerGroupHeader — variant %s', (variant) => {
  it('AC-2 — carries the ticker, the count, the net + label, the P/L + label, and the toggle', () => {
    renderHeader(tslaGroup(), variant);
    const header = screen.getByTestId('broker-group-header');
    expect(header.textContent).toContain('TSLA');
    expect(screen.getByTestId('broker-group-count')).toBeTruthy();
    expect(screen.getByTestId('broker-group-net')).toBeTruthy();
    expect(screen.getByTestId('broker-group-net-label')).toBeTruthy();
    expect(screen.getByTestId('broker-group-pl')).toBeTruthy();
    expect(screen.getByTestId('broker-group-pl-label')).toBeTruthy();
    expect(screen.getByTestId('broker-group-toggle')).toBeTruthy();
    // The only button in the header is the toggle.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('AC-3 / AC-16b — no quantity figure, no percent', () => {
    renderHeader(tslaGroup(), variant);
    const header = screen.getByTestId('broker-group-header');
    expect(header.textContent).not.toMatch(/×/);
    expect(header.textContent).not.toMatch(/%/);
    expect(screen.queryByTestId('broker-qty')).toBeNull();
  });

  if (variant === 'row') {
    it('AC-16b — the identity cell spans both leading grid columns (no separate quantity cell)', () => {
      renderHeader(tslaGroup(), variant);
      const header = screen.getByTestId('broker-group-header');
      // Exactly 3 direct grid items — identity (spanning columns 1–2), net, P/L — never 4: a 4th
      // would be the quantity cell BrokerPositionRow carries and this level never does.
      expect(header.children).toHaveLength(3);
      const identityCell = header.children[0] as HTMLElement;
      expect(identityCell.contains(screen.getByTestId('broker-group-count'))).toBe(true);
      expect(identityCell.contains(screen.getByTestId('broker-group-toggle'))).toBe(true);
    });
  }

  it('AC-6b — the noun and the number: `3 option legs`/`2 option legs`, never positions/rows/holdings/contracts/trades', () => {
    renderHeader(tslaGroup(), variant);
    expect(screen.getByTestId('broker-group-count').textContent).toBe(
      '3 option legs · grouped by underlying',
    );
    const header = screen.getByTestId('broker-group-header').textContent ?? '';
    for (const word of ['positions', 'rows', 'holdings', 'contracts', 'trades']) {
      expect(header.toLowerCase()).not.toContain(word);
    }
  });

  it('AC-6b — AAPL / META render `2 option legs`', () => {
    for (const group of [aaplGroup(), metaGroup()]) {
      const { unmount } = renderHeader(group, variant);
      expect(screen.getByTestId('broker-group-count').textContent).toContain('2 option legs');
      unmount();
    }
  });

  it('AC-9 — one figure with the shipped direction word + a named basis; the figure never renders unlabeled', () => {
    renderHeader(tslaGroup(), variant);
    expect(screen.getByTestId('broker-group-net').textContent).toBe('$13,760.00 debit');
    expect(screen.getByTestId('broker-group-net-label').textContent).toBe('netted by Convexa');
  });

  it('AC-9c + P3 — `$0.00` bare, the basis clause still present (a zero net is still a figure)', () => {
    const g = groupByKey(BOOK_CF_ZERO_NET, 'TSLA');
    renderHeader(g, variant);
    const netText = screen.getByTestId('broker-group-net').textContent ?? '';
    expect(netText).toBe('$0.00');
    expect(netText).not.toMatch(/debit|credit/);
    expect(screen.getByTestId('broker-group-net-label')).toBeTruthy();
  });

  it('AC-16a — only two literals can appear in the withheld slots', () => {
    for (const book of [
      BOOK_CF_NO_COST,
      BOOK_CF_NO_SIZE,
      BOOK_CF_UNPARSEABLE,
      BOOK_CF_MIXED_CAUSE,
      BOOK_CF_DOUBLY_BROKEN,
    ]) {
      const g = groupByKey(book, 'TSLA');
      const { unmount } = renderHeader(g, variant);
      const net = screen.getByTestId('broker-group-net').textContent;
      const pl = screen.getByTestId('broker-group-pl').textContent ?? '';
      expect(['not provided', 'unavailable']).toContain(net);
      expect(
        pl === 'not provided' ||
          pl === 'unavailable' ||
          pl.includes('not provided') ||
          pl.includes('unavailable'),
      ).toBe(true);
      const header = screen.getByTestId('broker-group-header').textContent ?? '';
      expect(header).not.toContain('not recorded');
      expect(header).not.toContain('no basis');
      unmount();
    }
  });

  it('AC-17a — the count beside the literal names the cause the literal shows, exactly once', () => {
    const g = groupByKey(BOOK_CF_DOUBLY_BROKEN, 'TSLA');
    renderHeader(g, variant);
    expect(screen.getByTestId('broker-group-withheld-count').textContent).toBe('1 of these 2 legs');
    expect(screen.getAllByTestId('broker-group-withheld-count')).toHaveLength(1);
  });

  it('AC-13 — the P/L is withheld with the net, the same literal', () => {
    const g = groupByKey(BOOK_CF_NO_COST, 'TSLA');
    renderHeader(g, variant);
    expect(screen.getByTestId('broker-group-net').textContent).toBe('not provided');
    expect(screen.getByTestId('broker-group-pl').textContent).toBe('not provided');
  });

  it('AC-18 — snapshot stale: the family dims and the P/L label carries the dual basis', () => {
    const staleBook: BrokerBook = { ...BOOK_CAPTURED_COMPLETE, as_of: '2026-08-01T14:20:00Z' };
    const g = groupByKey(staleBook, 'TSLA');
    expect(g.modeled_label).toBe('dual');
    renderHeader(g, variant, { isStale: true, asOf: staleBook.as_of ?? null });
    const count = screen.getByTestId('broker-group-count');
    let el: HTMLElement | null = count;
    let dimmed = false;
    for (let i = 0; i < 6 && el; i++) {
      if (getComputedStyle(el).opacity === '0.62') {
        dimmed = true;
        break;
      }
      el = el.parentElement;
    }
    expect(dimmed).toBe(true);
    expect(screen.getByTestId('broker-group-pl-label').textContent).toMatch(
      /modeled now · on your book as of/,
    );
  });

  it('AC-19 — mark feed down: the P/L dims + marks ⏸ and stays non-empty; the net is NOT dimmed by it', () => {
    renderHeader(tslaGroup(), variant, { streamOffline: true });
    const pl = screen.getByTestId('broker-group-pl');
    expect(pl.textContent).toMatch(/^⏸/);
    expect(pl.textContent && pl.textContent.length > 0).toBe(true);
    expect(getComputedStyle(pl).opacity).toBe('0.5');
    const net = screen.getByTestId('broker-group-net');
    expect(getComputedStyle(net).opacity).not.toBe('0.5');
  });

  it('AC-30 / AC-32 — no reassess affordance, no disabled variant, no coming-soon', () => {
    renderHeader(tslaGroup(), variant);
    const header = screen.getByTestId('broker-group-header');
    expect(header.textContent).not.toMatch(/build reassessment/i);
    expect(header.textContent).not.toMatch(/coming soon/i);
    expect(header.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
    expect(header.querySelectorAll('button[disabled]')).toHaveLength(0);
  });

  it('AC-36 — the disclosure is real: aria-expanded flips, aria-controls resolves, Enter/Space toggle', async () => {
    const user = userEvent.setup();
    let expanded = false;
    const onToggle = () => {
      expanded = !expanded;
    };
    const { rerender } = render(
      <>
        <BrokerGroupHeader
          group={tslaGroup()}
          variant={variant}
          expanded={expanded}
          onToggle={onToggle}
          panelId="group-panel-2"
          streamOffline={false}
          isStale={false}
          asOf={null}
        />
        <BrokerGroupPanel group={tslaGroup()} id="group-panel-2" expanded={expanded}>
          <div data-testid="member-slot" />
        </BrokerGroupPanel>
      </>,
    );
    const button = screen.getByTestId('broker-group-toggle');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button.getAttribute('aria-controls')).toBe('group-panel-2');
    expect(document.getElementById('group-panel-2')).toBeTruthy();

    await user.click(button);
    rerender(
      <>
        <BrokerGroupHeader
          group={tslaGroup()}
          variant={variant}
          expanded={expanded}
          onToggle={onToggle}
          panelId="group-panel-2"
          streamOffline={false}
          isStale={false}
          asOf={null}
        />
        <BrokerGroupPanel group={tslaGroup()} id="group-panel-2" expanded={expanded}>
          <div data-testid="member-slot" />
        </BrokerGroupPanel>
      </>,
    );
    expect(screen.getByTestId('broker-group-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('group-panel-2')).toBeTruthy();

    button.focus();
    await user.keyboard('{Enter}');
    expect(expanded).toBe(false);
    await user.keyboard(' ');
    expect(expanded).toBe(true);
  });

  it('P1 — the derived-size clause is absent when the boolean is false', () => {
    const g = groupByKey(BOOK_CF_NO_RECON_NOTE, 'TSLA');
    expect(g.net_rests_on_derived_size).toBe(false);
    renderHeader(g, variant, { expanded: true });
    const note = screen.getByTestId('broker-group-note').textContent ?? '';
    expect(note).not.toMatch(/contract size/i);
    expect(note).toBe(
      "Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent. Advisory context, not a broker figure.",
    );
  });

  it('the panel REPLACES the basis sentence with the withheld reason', () => {
    const g = groupByKey(BOOK_CF_DOUBLY_BROKEN, 'TSLA');
    renderHeader(g, variant, { expanded: true });
    const note = screen.getByTestId('broker-group-note').textContent;
    expect(note).toBe('Net entry needs all 2 legs. 1 is missing a cost or a contract size.');
    expect(note).not.toMatch(/arithmetic/);
  });

  it('the count clause is a real tab stop, wrapped in a keyboard-reachable Tooltip trigger', async () => {
    const user = userEvent.setup();
    renderHeader(tslaGroup(), variant);
    const count = screen.getByTestId('broker-group-count');
    expect(count).toHaveAttribute('tabindex', '0');
    // Reachability via Tab alone (no pointer) — the OPEN behaviour itself is proven on the `Refused`
    // primitive in `faulted.a11y.spec.tsx`, where the control is the FIRST tab stop; jsdom/nwsapi's
    // `:focus-visible` emulation only fires reliably there, so it is not re-attempted deep in this tree.
    let guard = 0;
    while (document.activeElement !== count && guard++ < 15) await user.tab();
    expect(document.activeElement).toBe(count);
  });
});

describe('BOOK_CF_CREDIT — a credit group renders the word with a positive magnitude', () => {
  it('renders `$1,600.00 credit`, never a minus sign', () => {
    const { groups } = groupsOf(BOOK_CF_CREDIT);
    renderHeader(groups[0], 'row');
    const text = screen.getByTestId('broker-group-net').textContent ?? '';
    expect(text).toBe('$1,600.00 credit');
    expect(text).not.toMatch(/[-−]/);
  });
});
