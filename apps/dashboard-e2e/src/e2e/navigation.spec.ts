import { expect, test, type Page } from '@playwright/test';

/**
 * CLIENT-SIDE NAVIGATION — added 2026-07-28 alongside the react-router v6 -> v7 upgrade.
 *
 * WHY IT DID NOT EXIST BEFORE, AND WHY THAT MATTERED. Every other e2e in this project reaches a route
 * with `page.goto()`, which is a FULL PAGE LOAD. That exercises route *rendering* and never exercises
 * the router: a build where every `<Link>` was broken, or where the router failed to update the URL,
 * would have passed the entire suite. Upgrading the router across a major with zero navigation
 * coverage is precisely the gap worth closing, so it is closed here rather than eyeballed once.
 *
 * THE SPA ASSERTION IS THE POINT. Checking the URL and the destination content is not enough — a
 * plain anchor that triggers a full document load would satisfy both while proving the router does
 * nothing. So a sentinel is planted on `window` before the click and asserted afterwards: it survives
 * client-side navigation and is destroyed by a real page load. That single check is what makes this a
 * router test instead of a link test.
 */

const DESKTOP = { width: 1280, height: 900 };

/** Stub only what the destination pages need to render content-full; see no-overflow.spec.ts. */
async function stubNetwork(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/auth/session')) {
      return route.fulfill({
        json: { authenticated: false, user: null, google_available: false, settings: null },
      });
    }
    if (path.startsWith('/api/scan/universe')) {
      return route.fulfill({ json: { symbols: ['SPY'], universe_size: 1 } });
    }
    if (path.startsWith('/api/scan')) {
      return route.fulfill({
        json: {
          view: {
            source: 'default',
            authenticated: false,
            name: null,
            symbols: ['SPY'],
            sort: { key: 'score', dir: 'desc' },
            density: 'compact',
          },
          rows: [],
          sweep: { updated_at: 0, sweep_last_completed: 0, universe_size: 1 },
        },
      });
    }
    return route.fallback();
  });
}

/**
 * Plant a value that only survives if the document is never reloaded. `addInitScript` re-runs on every
 * real navigation, so the sentinel is set once AFTER load instead — if the document reloads, it is
 * gone.
 */
async function plantSpaSentinel(page: Page) {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__spaSentinel = 'alive';
  });
}

async function sentinelSurvived(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as Record<string, unknown>).__spaSentinel === 'alive',
  );
}

test.describe('client-side navigation', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await stubNetwork(page);
  });

  test('the nav links route WITHOUT a page reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing')).toBeAttached();
    await plantSpaSentinel(page);

    // Positions
    await page.getByTestId('nav-positions').click();
    await expect(page).toHaveURL(/\/positions$/);
    await expect(page.getByTestId('portfolio-panel')).toBeAttached();
    expect(await sentinelSurvived(page), 'navigating to /positions reloaded the document').toBe(
      true,
    );

    // Scanner — a second hop, because a router can get the first navigation right and then wedge.
    await page.getByTestId('nav-scanner').click();
    await expect(page).toHaveURL(/\/scanner$/);
    await expect(page.getByTestId('scanner-page')).toBeAttached();
    expect(await sentinelSurvived(page), 'navigating to /scanner reloaded the document').toBe(true);
  });

  test('browser Back and Forward are wired to the router', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing')).toBeAttached();
    await plantSpaSentinel(page);

    await page.getByTestId('nav-positions').click();
    await expect(page).toHaveURL(/\/positions$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('landing')).toBeAttached();

    await page.goForward();
    await expect(page).toHaveURL(/\/positions$/);
    await expect(page.getByTestId('portfolio-panel')).toBeAttached();
  });

  test('the /ticker redirect resolves to the default symbol', async ({ page }) => {
    // `<Route path="/ticker" element={<Navigate to="/ticker/TSLA" replace />} />` — a redirect route,
    // which is router behaviour rather than page behaviour and therefore worth pinning across an
    // upgrade. `replace` also means it must NOT leave an extra history entry.
    await page.goto('/');
    await expect(page.getByTestId('landing')).toBeAttached();

    await page.goto('/ticker');
    await expect(page).toHaveURL(/\/ticker\/TSLA$/);

    // One Back should return to the landing page, not to the bare /ticker that redirected away.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a URL parameter reaches the page it addresses', async ({ page }) => {
    // `useParams` is the other router surface this app depends on; pin that it still binds.
    //
    // Asserted on the toolbar's Ticker INPUT VALUE rather than on page text, deliberately: the
    // symbol arrives as the value of a controlled input, so a text locator finds nothing even when
    // the param bound correctly (which is exactly how the first version of this test failed). The
    // input value is also the stronger claim — it proves the param reached the page's own STATE, not
    // merely that the string appears somewhere on screen.
    //
    // The bundle is deliberately NOT stubbed: this asserts routing, and the param must bind whether
    // the data request succeeds or fails. Stubbed to a failure so the test never depends on a real
    // backend being reachable.
    await page.route('**/api/ticker/**', (route) => route.fulfill({ status: 503, body: '' }));

    await page.goto('/ticker/NVDA');
    await expect(page).toHaveURL(/\/ticker\/NVDA$/);
    await expect(page.getByRole('textbox', { name: 'Ticker' })).toHaveValue('NVDA');
  });
});
