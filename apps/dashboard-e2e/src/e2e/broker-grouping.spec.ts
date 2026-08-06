import { expect, test, type Page } from '@playwright/test';

/**
 * broker-option-grouping e2e (F11) — risk-based, joining the existing `broker.spec.ts` idiom: the
 * grouping STATE MACHINE lives in the component suite (`grouping.spec.ts`,
 * `BrokerGroupHeader.spec.tsx`, `grouping.integration.spec.tsx`); here the real browser proves the
 * four seams jsdom can't: real keyboard focus + computed styles (AC-36), a real viewport's
 * `scrollWidth` after a real click expands real content (AC-37), the collapsed-on-load/after-reload
 * contract with NO durable persistence (AC-7/AC-26), and the no-naming invariant on ACTUAL rendered
 * text rather than a jsdom approximation (AC-4).
 *
 * Network fully stubbed (no live backend) — same idiom as `broker.spec.ts`.
 *
 * THE FIXTURE: three of `BOOK_CAPTURED_COMPLETE`'s five real ticker groups (TSLA 3 legs · AAPL 2
 * legs · META 2 legs), same broker ids/costs/marks, net figures verified against ground truth
 * (never Webull's own `total_cost`): AAPL $3,850.00 debit · META $3,805.00 debit · TSLA $13,760.00
 * debit. Deliberately OMITS the two real lone legs (NVDA/PLTR) and the 5 equity rows — those are
 * UNGROUPED entries whose own pre-existing `StructureChip` renders a real structure label (`Custom`
 * for an unclassifiable single leg, `Shares` for an equity), which is OUT OF SCOPE for this
 * feature's no-naming rule (SPEC §2.3/AC-4b: the rule binds the GROUP-authored surface — header,
 * count, tooltip, export — not the pre-existing per-position chip). Restricting the fixture to
 * grouped-only content keeps AC-4's whole-tab-innerText check meaningful without tripping on
 * unrelated, already-shipped behaviour.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE_393 = { width: 393, height: 852 };

const AS_OF_FRESH = new Date(Date.now() - 30_000).toISOString();

function notSupplied() {
  return { state: 'not_supplied' as const };
}

function supplied(value: number) {
  return { state: 'supplied' as const, value };
}

/** A generic option leg exactly as the real Webull feed yields it — no strike/expiry/right. */
function optionLeg(underlying: string, quantity: number, unitCost: number, mark: number) {
  return {
    kind: 'option',
    symbol: underlying,
    underlying,
    quantity,
    multiplier: 100,
    cost_basis: supplied(unitCost),
    broker_mark: supplied(mark),
  };
}

const CAPTURED_NOTES = [
  "Webull's positions feed carries no strike, expiry, or call/put for a held option — Convexa " +
    'will not guess them',
  "contract multiplier not supplied — reproduced exactly from Webull's own total_cost",
];

function optionPosition(
  id: string,
  underlying: string,
  quantity: number,
  unitCost: number,
  mark: number,
) {
  return {
    broker_position_id: id,
    fidelity: 'partial',
    fidelity_notes: CAPTURED_NOTES,
    legs: [optionLeg(underlying, quantity, unitCost, mark)],
    unrealized_pl: notSupplied(),
  };
}

/** Three real captured groups only — AAPL 2 · META 2 · TSLA 3 (see file header for why). */
function groupedBook() {
  return {
    state: 'ok',
    as_of: AS_OF_FRESH,
    basis: 'fresh',
    stale_after_seconds: 300,
    account_ref: 'acctref0123456789',
    positions: [
      optionPosition('1061810120', 'AAPL', 10, 6.92, 7.4),
      optionPosition('1061810138', 'AAPL', -10, 3.07, 2.83),
      optionPosition('1062038210', 'META', -5, 2.15, 1.8),
      optionPosition('1062038307', 'META', 5, 9.76, 10.3),
      optionPosition('1061810101', 'TSLA', 10, 10.62, 9.1),
      optionPosition('1062038045', 'TSLA', -4, 8.49, 0.02),
      optionPosition('1062038112', 'TSLA', 4, 16.34, 15.2),
    ],
    last_attempt_at: AS_OF_FRESH,
    last_attempt_outcome: 'ok',
  };
}

/** Mirrored from `src/testing/noNamingVocabulary.ts` (not imported — e2e stays self-contained, the
 *  standing idiom in this suite). Any drift between the two is a spec-level concern, not a test one. */
const LABEL_VALUES = [
  'Shares',
  'Short shares',
  'Long call',
  'Long put',
  'Short call',
  'Short put',
  'Call debit spread',
  'Call credit spread',
  'Put debit spread',
  'Put credit spread',
  'Long straddle',
  'Short straddle',
  'Long strangle',
  'Short strangle',
  'Covered call',
  'Protective put',
  'Collar',
  'Iron condor',
  'Iron butterfly',
  'Calendar',
  'Diagonal',
  'Custom',
];

const B2_TERMS: readonly RegExp[] = [
  /\bverticals?\b/i,
  /\bspreads?\b/i,
  /\bcondors?\b/i,
  /\bbutterfl(?:y|ies)\b/i,
  /\bstraddles?\b/i,
  /\bstrangles?\b/i,
  /\bcollars?\b/i,
  /\biron\b/i,
  /\bcalendars?\b/i,
  /\bdiagonals?\b/i,
  /\bcovered\b/i,
  /\bprotective\b/i,
  /\bcustom\b/i,
];

/** ONE handler, explicit branching — the shipped `broker.spec.ts` idiom. */
async function stubNetwork(page: Page, book: unknown) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.startsWith('/api/auth/session')) {
      return route.fulfill({
        json: {
          authenticated: true,
          user: { id: 'u', email: 'o@x.y', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        },
      });
    }
    if (path.startsWith('/api/broker/credential')) {
      return route.fulfill({ json: { set: true, last4: '1234', storage_available: true } });
    }
    if (path.startsWith('/api/broker/book')) {
      return route.fulfill({ json: book });
    }
    if (path.startsWith('/api/contract/')) return route.fulfill({ status: 404, body: '' });
    if (path.startsWith('/api/personas')) {
      return route.fulfill({ json: [{ id: 'default', name: 'Default (no persona)' }] });
    }
    if (path.startsWith('/api/recommendation/status/')) {
      return route.fulfill({
        json: {
          availability: { in_app_enabled: false },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 0, resets_at: '2026-08-03T04:00:00Z' },
        },
      });
    }
    return route.fallback();
  });
}

async function openBrokerTab(page: Page) {
  await page.goto('/positions');
  await page.getByTestId('tab-live').click();
  await expect(page.getByTestId('broker-group-header').first()).toBeVisible();
}

test.describe('broker grouping', () => {
  test('AC-37 — 393px, a group EXPANDED, no horizontal overflow', async ({ page }) => {
    await stubNetwork(page, groupedBook());
    await page.setViewportSize(MOBILE_393);
    await openBrokerTab(page);

    // Vacuity guards FIRST — without these a selector that stops matching makes the overflow
    // check vacuous (the exact failure mode this file's header docs cite).
    const headerCount = await page.getByTestId('broker-group-header').count();
    expect(headerCount).toBeGreaterThan(0);

    await page.getByTestId('broker-group-toggle').first().click();
    await expect(page.locator('[aria-expanded="true"]').first()).toBeAttached();
    const legLineCount = await page.getByTestId('broker-leg-line').count();
    expect(legLineCount).toBeGreaterThan(0);

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `scrollWidth ${scrollWidth} must fit ${innerWidth}`).toBeLessThanOrEqual(
      innerWidth,
    );
  });

  test('AC-36 — the group control carries exactly ONE focus indicator', async ({ page }) => {
    await stubNetwork(page, groupedBook());
    await page.setViewportSize(DESKTOP);
    await openBrokerTab(page);

    // Real keyboard Tab, not a programmatic .focus() — only a real keyboard traversal reliably
    // sets `:focus-visible` the way this assertion depends on.
    let reached = false;
    for (let i = 0; i < 60 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') === 'broker-group-toggle',
      );
    }
    expect(reached, 'never reached broker-group-toggle by keyboard Tab').toBe(true);
    await expect(page.getByTestId('broker-group-toggle').first()).toBeFocused();

    // No ANCESTOR of the focused toggle carries its own outline — the shipped `BrokerPositionRow`
    // `:focus-within` ring must not be inherited by the group control (it never wraps it).
    const ancestorOutlineStyles = await page.evaluate(() => {
      const styles: string[] = [];
      let node = document.activeElement?.parentElement ?? null;
      while (node) {
        styles.push(getComputedStyle(node).outlineStyle);
        node = node.parentElement;
      }
      return styles;
    });
    expect(ancestorOutlineStyles.every((s) => s === 'none')).toBe(true);
  });

  test('AC-4 — the populated (collapsed) tab names no shape, on real rendered text', async ({
    page,
  }) => {
    await stubNetwork(page, groupedBook());
    await page.setViewportSize(DESKTOP);
    await openBrokerTab(page);

    // Sanity anchor — the real ground-truth net figures, never Webull's own `total_cost`
    // (`$3,802.00`/`$7,889.00` would be that mistake; they must never appear).
    const panelText = (await page.getByTestId('broker-tab-panel').innerText()) ?? '';
    expect(panelText).toContain('$3,850.00 debit'); // AAPL
    expect(panelText).toContain('$3,805.00 debit'); // META
    expect(panelText).toContain('$13,760.00 debit'); // TSLA
    expect(panelText).not.toContain('3,802.00');
    expect(panelText).not.toContain('7,889.00');

    for (const v of LABEL_VALUES) {
      expect(panelText.toLowerCase(), v).not.toContain(v.toLowerCase());
    }
    for (const re of B2_TERMS) {
      expect(re.test(panelText), String(re)).toBe(false);
    }
  });

  test('AC-7 / AC-26 — collapsed on load, and collapsed again after a reload', async ({ page }) => {
    await stubNetwork(page, groupedBook());
    await page.setViewportSize(DESKTOP);
    await openBrokerTab(page);

    const readAllExpanded = async () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-expanded]')).map((el) =>
          el.getAttribute('aria-expanded'),
        ),
      );

    // AC-7 — every group starts collapsed.
    const onLoad = await readAllExpanded();
    expect(onLoad.length).toBeGreaterThan(0); // vacuity guard
    expect(onLoad.every((v) => v === 'false')).toBe(true);

    // Expand one.
    await page.getByTestId('broker-group-toggle').first().click();
    await expect(page.locator('[aria-expanded="true"]').first()).toBeAttached();

    // AC-26 — a reload never persists expand state (ephemeral, no durable key). The Broker tab
    // selection itself is not persisted either, so re-select it after the reload.
    await page.reload();
    await page.getByTestId('tab-live').click();
    await expect(page.getByTestId('broker-group-header').first()).toBeVisible();
    const afterReload = await readAllExpanded();
    expect(afterReload.length).toBeGreaterThan(0);
    expect(afterReload.every((v) => v === 'false')).toBe(true);
  });
});
