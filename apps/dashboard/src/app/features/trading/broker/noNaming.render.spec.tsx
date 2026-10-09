/**
 * LAYER 3 — the OUTCOME. Layers 1 and 2 pin the mechanism; this pins what reaches the trader.
 * Rendered from a fixture whose legs DO carry strike, expiry and right (the post-contract-detail
 * world, simulable today), COLLAPSED, on both form factors.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  B2_TERMS,
  STRUCTURE_LABEL_VALUES,
  b1HitsIn,
  b2HitsIn,
} from '../../../../testing/noNamingVocabulary';
import { BrokerGroupHeader, BrokerGroupPanel } from './BrokerGroupHeader';
import { buildBrokerPositionView } from './brokerView';
import { BOOK_CF_FUTURE_FEED, FIXED_NOW_MS } from './fixtures';
import { groupBook, type BrokerGroup } from './grouping';

/** The trader-visible naming surface. Class names, ids and testids are deliberately EXCLUDED. */
function namingSurfaceOf(root: HTMLElement, extraTexts: readonly string[] = []): string {
  const parts: string[] = [root.textContent ?? ''];
  const push = (v: string | null) => {
    if (v != null) parts.push(v);
  };
  push(root.getAttribute('aria-label'));
  push(root.getAttribute('title'));
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>('[aria-label],[title],[alt],[placeholder]'),
  )) {
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) push(el.getAttribute(a));
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[aria-labelledby]'))) {
    for (const id of (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)) {
      push(document.getElementById(id)?.textContent ?? '');
    }
  }
  parts.push(...extraTexts);
  return parts.join(' | ');
}

const escapeForRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The single TSLA group `BOOK_CF_FUTURE_FEED` composes — two option legs WITH strike/expiry/right. */
function futureFeedGroup(): BrokerGroup {
  const views = BOOK_CF_FUTURE_FEED.positions.map((p) =>
    buildBrokerPositionView({
      position: p,
      legMarks: new Map(),
      dte: null,
      nowMs: FIXED_NOW_MS,
      book: BOOK_CF_FUTURE_FEED,
    }),
  );
  const group = groupBook(views, BOOK_CF_FUTURE_FEED, FIXED_NOW_MS).groups[0];
  if (group == null) throw new Error('BOOK_CF_FUTURE_FEED did not compose a group');
  return group;
}

afterEach(() => cleanup());

describe.each(['row', 'card'] as const)(
  'AC-4b · a COLLAPSED group under the FUTURE feed names no shape (%s)',
  (variant) => {
    beforeEach(() => {
      const group = futureFeedGroup();
      render(
        <>
          <BrokerGroupHeader
            group={group}
            variant={variant}
            expanded={false}
            onToggle={() => undefined}
            panelId="future-feed-panel"
            streamOffline={false}
            isStale={false}
            asOf={BOOK_CF_FUTURE_FEED.as_of ?? null}
          />
          <BrokerGroupPanel group={group} id="future-feed-panel" expanded={false}>
            <div data-testid="member-slot" />
          </BrokerGroupPanel>
        </>,
      );
    });

    it('channel 1 — B1: no label value in the header subtree’s innerHTML', () => {
      const header = screen.getByTestId('broker-group-header');
      expect(b1HitsIn(header.innerHTML)).toEqual([]);
    });

    it('channel 2 — B2: no bare shape word on the assembled naming surface', () => {
      const header = screen.getByTestId('broker-group-header');
      expect(b2HitsIn(namingSurfaceOf(header))).toEqual([]);
    });

    it('channel 3 — no control’s COMPUTED accessible name names a shape', () => {
      const header = screen.getByTestId('broker-group-header');
      for (const v of STRUCTURE_LABEL_VALUES) {
        expect(
          within(header).queryByRole('button', { name: new RegExp(escapeForRegExp(v), 'i') }),
          v,
        ).toBeNull();
      }
      for (const re of B2_TERMS) {
        expect(within(header).queryByRole('button', { name: re }), String(re)).toBeNull();
      }
    });

    it('channel 4 — every keyboard-reachable tooltip is clean on BOTH arms', async () => {
      // ONE ENVIRONMENT NOTE, so nobody weakens these assertions to work around it.
      // `@mui/utils/isFocusVisible` gates Tooltip's open-on-focus behind
      // `element.matches(':focus-visible')`; probed directly, jsdom/nwsapi
      // grants that pseudo-class to a native `<button>` on its first-ever Tab but NEVER to a
      // `tabIndex`-bearing non-native element (a `<Box component="span">`, which is what every
      // trigger in this header is) — a real browser does grant it there, so this is an
      // environment gap, not a product defect. Two channels prove the two halves the spec cares
      // about, exactly as the cited precedent does ("and by hover as well, so neither input
      // modality is a dead end"): TAB proves the trigger is in the keyboard tab order; HOVER —
      // which MUI gates on pointer entry, not on `:focus-visible` — reliably opens the SAME
      // tooltip so its content can be asserted clean on both arms.
      for (const testid of ['broker-group-count', 'broker-group-net-label']) {
        cleanup();
        const group = futureFeedGroup();
        render(
          <BrokerGroupHeader
            group={group}
            variant={variant}
            expanded={false}
            onToggle={() => undefined}
            panelId="future-feed-panel-ch4"
            streamOffline={false}
            isStale={false}
            asOf={BOOK_CF_FUTURE_FEED.as_of ?? null}
          />,
        );
        const user = userEvent.setup();
        const trigger = screen.getByTestId(testid);

        // Keyboard reachability — the real property a screen-reader/keyboard user depends on.
        let guard = 0;
        while (document.activeElement !== trigger && guard++ < 20) await user.tab();
        expect(document.activeElement, testid).toBe(trigger);
        await user.tab({ shift: true }); // release focus so hover starts from a clean state

        // Content cleanliness — opened via the channel this environment can express reliably.
        await user.hover(trigger);
        const tip = await screen.findByRole('tooltip');
        const text = tip.textContent ?? '';
        expect(b1HitsIn(text), testid).toEqual([]);
        expect(b2HitsIn(text), testid).toEqual([]);
        await user.unhover(trigger);
      }
    });
  },
);

describe('Layer 3 · MUTATION GUARDS — five poisons, because one poison proves one assertion', () => {
  it('1. a label value in the RENDERED TEXT fails the B1 channel', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>TSLA</span><span>Call debit spread</span>';
    expect(b1HitsIn(el.innerHTML).length).toBeGreaterThan(0);
  });

  it('2. a label value in an ARIA-LABEL fails the B1 channel (an aria-label is not text content)', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button aria-label="Show the Iron condor">x</button>';
    expect(el.textContent).not.toContain('Iron condor'); // the pass-1 gap, demonstrated
    expect(b1HitsIn(el.innerHTML).length).toBeGreaterThan(0);
  });

  it('3. a label value in a TOOLTIP fails the B1 channel', () => {
    expect(b1HitsIn('This reads as a Long straddle.').length).toBeGreaterThan(0);
  });

  it('4. B2 poison in the count clause — and B1 does NOT catch it', () => {
    const poison = '3 option legs · may form a spread';
    expect(b2HitsIn(poison).length).toBeGreaterThan(0);
    expect(b1HitsIn(poison)).toEqual([]);
  });

  it('5. B2 poison in a tooltip — and B1 does NOT catch it', () => {
    const poison = 'reads like an iron play';
    expect(b2HitsIn(poison).length).toBeGreaterThan(0);
    expect(b1HitsIn(poison)).toEqual([]);
  });
});
