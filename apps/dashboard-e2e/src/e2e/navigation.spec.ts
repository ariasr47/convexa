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
      // Owner lockdown (2026-08-06): /positions and /scanner sit behind RequireAuth, so these
      // layout/nav walks must be SIGNED IN — the wall is not what they are testing.
      return route.fulfill({
        json: {
          authenticated: true,
          user: {
            id: 'e2e',
            email: 'e2e@test.invalid',
            display_name: null,
            auth_methods: ['password'],
          },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        },
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
    // `<Route path="/ticker" element={<DefaultTickerRedirect />} />` — the effective-default
    // redirect (index-first-defaults AC-1/AC-2: a stored `default_ticker` pref wins; the UNSET
    // fallback is SPY). Router behaviour rather than page behaviour and therefore worth pinning
    // across an upgrade. `replace` also means it must NOT leave an extra history entry. This run is
    // anonymous with no client-local pref, so the unset SPY fallback is what resolves.
    await page.goto('/');
    await expect(page.getByTestId('landing')).toBeAttached();

    await page.goto('/ticker');
    await expect(page).toHaveURL(/\/ticker\/SPY$/);

    // One Back should return to the landing page, not to the bare /ticker that redirected away.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('methodology on-page index (GATE Z I-1, AC-M6/AC-M1) — click stays in-page despite <base href="/">', async ({
    page,
  }) => {
    // `apps/dashboard/index.html:5` declares `<base href="/">`. jsdom implements no <base>
    // resolution at all, so `methodology.spec.tsx` cannot see this class of regression — only a
    // real browser resolves a bare `href="#id"` against that base (landing it on `/#id`, the
    // landing page) instead of against the document's current path. This is the only mechanism
    // that can prove the fix.
    await page.goto('/methodology');
    await expect(page.getByTestId('methodology-page')).toBeAttached();
    await plantSpaSentinel(page);

    const toc = page.getByTestId('methodology-toc');
    const entry = toc.getByRole('link', { name: 'Where the read is weak' });
    await expect(entry).toHaveAttribute('href', '/methodology#where-the-read-is-weak');
    await entry.click();

    // Stayed on `/methodology` (never ejected to the landing) and the URL now carries the anchor.
    await expect(page).toHaveURL(/\/methodology#where-the-read-is-weak$/);
    await expect(page.getByTestId('methodology-page')).toBeAttached();
    expect(
      await sentinelSurvived(page),
      'clicking a TOC entry reloaded the document',
    ).toBe(true);

    // Reached the section: its heading sits at or above the viewport's top edge, not still at
    // the top of the document (scrollY 0 is exactly the failure GATE Q observed).
    const target = page.getByRole('heading', { level: 2, name: 'Where the read is weak' });
    await expect(target).toBeInViewport();
  });

  test('methodology deep link (GATE Z I-1, AC-M1) — a fresh load of /methodology#id lands on its section', async ({
    page,
  }) => {
    await page.goto('/methodology#vocabulary');
    await expect(page.getByTestId('methodology-page')).toBeAttached();

    const target = page.getByRole('heading', { level: 2, name: 'Vocabulary' });
    await expect(target).toBeInViewport();
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY, 'a fresh deep link left the page at the top (GATE Q failure)').toBeGreaterThan(
      0,
    );
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
